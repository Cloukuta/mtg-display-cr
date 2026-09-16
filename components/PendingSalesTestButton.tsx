"use client";

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

export default function PendingSalesTestButton() {
  const supabase = getSupabase();
  const [working, setWorking] = useState(false);

  async function createTestOrder() {
    if (!supabase || working) return;
    const ok = window.confirm(
      "Create a TEST ORDER using 1 real card from your inventory? Canceling it will not change stock; completing it will deduct 1 card."
    );
    if (!ok) return;

    setWorking(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) throw new Error("You must be signed in.");

      const [{ data: item, error: itemError }, { data: pricing }] = await Promise.all([
        supabase
          .from("inventory_items")
          .select("id,quantity,condition,language,finish,pricing_mode,custom_price_crc,cards(name,cardkingdom_price_usd)")
          .eq("seller_id", user.id)
          .eq("available", true)
          .gt("quantity", 0)
          .limit(1)
          .maybeSingle(),
        supabase
          .from("seller_pricing_settings")
          .select("usd_to_crc,discount_percent")
          .eq("seller_id", user.id)
          .maybeSingle(),
      ]);

      if (itemError) throw itemError;
      if (!item) throw new Error("No available inventory card was found for the test.");

      const card = Array.isArray(item.cards) ? item.cards[0] : item.cards;
      const rate = Number(pricing?.usd_to_crc ?? 520);
      const discount = Number(pricing?.discount_percent ?? 20);
      const ckUsd = card?.cardkingdom_price_usd == null ? null : Number(card.cardkingdom_price_usd);
      let unitPrice = 0;
      if (item.pricing_mode === "custom" && item.custom_price_crc != null) unitPrice = Number(item.custom_price_crc);
      else if (ckUsd != null) {
        const base = Math.round(ckUsd * rate);
        unitPrice = item.pricing_mode === "discount" ? Math.round(base * (1 - discount / 100)) : base;
      }

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          seller_id: user.id,
          customer_name: "TEST ORDER",
          customer_phone: "TEST",
          buyer_email: user.email ?? null,
          customer_note: `TEST ORDER — ${card?.name ?? "inventory card"}. Safe to cancel. Completing deducts one unit.`,
          status: "inventory_confirmation",
        })
        .select("id")
        .single();
      if (orderError || !order) throw orderError ?? new Error("Could not create test order.");

      const { error: itemInsertError } = await supabase.from("order_items").insert({
        order_id: order.id,
        inventory_item_id: item.id,
        quantity: 1,
        requested_quantity: 1,
        unit_price_crc: Math.max(0, unitPrice),
        pricing_mode: item.pricing_mode,
        finish: item.finish,
        condition: item.condition,
        language: item.language,
      });
      if (itemInsertError) {
        await supabase.from("orders").delete().eq("id", order.id).eq("seller_id", user.id);
        throw itemInsertError;
      }

      await supabase.from("order_events").insert({
        order_id: order.id,
        actor_id: user.id,
        actor_role: "seller",
        event_type: "test_order_created",
        message: "Controlled TEST ORDER created from real seller inventory",
      });

      window.location.reload();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not create the test order.");
      setWorking(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void createTestOrder()}
      disabled={working}
      className="hidden items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-300/[.08] px-3 py-2 text-xs font-bold text-amber-500 transition hover:bg-amber-300/[.14] disabled:opacity-40 sm:inline-flex"
      title="Creates a controlled order using one real inventory card"
    >
      <FlaskConical size={16} />
      {working ? "Creating…" : "Create Test Order"}
    </button>
  );
}
