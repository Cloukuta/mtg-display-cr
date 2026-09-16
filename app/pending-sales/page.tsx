"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AlertCircle, CheckCircle2, Minus, Plus, ShoppingBag, XCircle } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, type Language } from "@/lib/i18n";

type OrderItem = {
  id: number;
  inventory_item_id: number;
  quantity: number;
  requested_quantity: number;
  unit_price_crc: number;
  finish: string;
  condition: string;
  language: string;
  inventory_items: {
    quantity: number;
    cards: { name: string; set_code: string; collector_number: string; image_uri: string | null } | null;
  } | null;
};

type Order = {
  id: number;
  customer_name: string | null;
  customer_phone: string | null;
  customer_note: string | null;
  created_at: string;
  order_items: OrderItem[];
};

const crc = new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 0 });

export default function PendingSalesPage() {
  const supabase = getSupabase();
  const configured = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);
  const es = language === "es";

  useEffect(() => {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "es" || stored === "en") setLanguage(stored);
    const handler = (event: Event) => {
      const value = (event as CustomEvent<Language>).detail;
      if (value === "es" || value === "en") setLanguage(value);
    };
    window.addEventListener("mtg-language-change", handler);
    return () => window.removeEventListener("mtg-language-change", handler);
  }, []);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getUser().then(({ data }) => { setUser(data.user); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !user) return;
    void loadOrders();
  }, [supabase, user]);

  async function loadOrders() {
    if (!supabase || !user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select(`id,customer_name,customer_phone,customer_note,created_at,order_items(id,inventory_item_id,quantity,requested_quantity,unit_price_crc,finish,condition,language,inventory_items(quantity,cards(name,set_code,collector_number,image_uri)))`)
      .eq("seller_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) setNotice(error.message);
    else setOrders((data || []) as unknown as Order[]);
    setLoading(false);
  }

  async function changeQuantity(order: Order, item: OrderItem, next: number) {
    if (!supabase || next < 1) return;
    const reservedByOtherOrders = orders
      .flatMap((o) => o.order_items)
      .filter((row) => row.inventory_item_id === item.inventory_item_id && row.id !== item.id)
      .reduce((sum, row) => sum + row.quantity, 0);
    const stock = item.inventory_items?.quantity ?? 0;
    const max = Math.max(1, stock - reservedByOtherOrders);
    if (next > max) {
      setNotice(es ? `Solo hay ${max} unidad(es) disponibles para reservar.` : `Only ${max} unit(s) are available to reserve.`);
      return;
    }
    const { error } = await supabase.from("order_items").update({ quantity: next, updated_at: new Date().toISOString() }).eq("id", item.id);
    if (error) { setNotice(error.message); return; }
    setOrders((current) => current.map((o) => o.id === order.id ? { ...o, order_items: o.order_items.map((row) => row.id === item.id ? { ...row, quantity: next } : row) } : o));
  }

  async function completeOrder(order: Order) {
    if (!supabase || !user) return;
    if (!window.confirm(es ? `¿Confirmar la venta #${order.id}? Las cantidades finales se descontarán del inventario.` : `Complete sale #${order.id}? Final quantities will be deducted from inventory.`)) return;
    setWorking(order.id); setNotice("");
    for (const item of order.order_items) {
      const currentStock = item.inventory_items?.quantity ?? 0;
      if (item.quantity > currentStock) {
        setNotice(es ? `No hay suficiente inventario para ${item.inventory_items?.cards?.name || "una carta"}.` : `Not enough inventory for ${item.inventory_items?.cards?.name || "a card"}.`);
        setWorking(null); return;
      }
      const remaining = currentStock - item.quantity;
      const { error } = remaining === 0
        ? await supabase.from("inventory_items").delete().eq("id", item.inventory_item_id).eq("seller_id", user.id)
        : await supabase.from("inventory_items").update({ quantity: remaining, updated_at: new Date().toISOString() }).eq("id", item.inventory_item_id).eq("seller_id", user.id);
      if (error) { setNotice(error.message); setWorking(null); return; }
    }
    const { error } = await supabase.from("orders").update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", order.id).eq("seller_id", user.id);
    if (error) setNotice(error.message);
    else { setOrders((current) => current.filter((row) => row.id !== order.id)); setNotice(es ? `Venta #${order.id} completada.` : `Sale #${order.id} completed.`); }
    setWorking(null);
  }

  async function cancelOrder(order: Order) {
    if (!supabase || !user) return;
    if (!window.confirm(es ? `¿Cancelar la venta #${order.id}? Las cartas reservadas volverán a quedar disponibles.` : `Cancel sale #${order.id}? Reserved cards will become available again.`)) return;
    setWorking(order.id); setNotice("");
    const { error } = await supabase.from("orders").update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", order.id).eq("seller_id", user.id);
    if (error) setNotice(error.message);
    else { setOrders((current) => current.filter((row) => row.id !== order.id)); setNotice(es ? `Venta #${order.id} cancelada.` : `Sale #${order.id} cancelled.`); }
    setWorking(null);
  }

  const totalCards = useMemo(() => orders.reduce((sum, order) => sum + order.order_items.reduce((s, item) => s + item.quantity, 0), 0), [orders]);

  if (loading) return <main className="grid min-h-screen place-items-center bg-background text-muted-foreground">{es ? "Cargando ventas pendientes…" : "Loading pending sales…"}</main>;
  if (!configured || !user) return <main className="grid min-h-screen place-items-center bg-background p-5 text-foreground"><a href="/dashboard" className="rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground">{es ? "Volver al panel" : "Back to Dashboard"}</a></main>;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AppHeader currentPath="/pending-sales" />
      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[.16em] text-primary">{es ? "Pedidos del vendedor" : "Seller orders"}</p><h1 className="mt-2 font-serif text-4xl font-bold">{es ? "Ventas pendientes" : "Pending Sales"}</h1><p className="mt-2 text-sm text-muted-foreground">{orders.length} {es ? "pedido(s) pendiente(s)" : "pending order(s)"} · {totalCards} {es ? "carta(s) reservada(s)" : "reserved card(s)"}</p></div>
          <a href="/catalog" className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold">{es ? "Volver a Mi catálogo" : "Back to My Catalog"}</a>
        </div>
        {notice && <div className="mt-5 flex gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground"><AlertCircle size={18} className="shrink-0 text-amber-500" />{notice}</div>}
        {orders.length === 0 ? (
          <section className="mt-7 rounded-3xl border border-border bg-card p-12 text-center"><ShoppingBag className="mx-auto text-muted-foreground" size={40} /><h2 className="mt-4 text-xl font-semibold">{es ? "No hay ventas pendientes" : "No pending sales"}</h2><p className="mt-2 text-sm text-muted-foreground">{es ? "Los pedidos confirmados por clientes aparecerán aquí." : "Customer-confirmed orders will appear here."}</p></section>
        ) : (
          <div className="mt-7 space-y-5">{orders.map((order) => {
            const total = order.order_items.reduce((sum, item) => sum + Number(item.unit_price_crc) * item.quantity, 0);
            return <section key={order.id} className="overflow-hidden rounded-3xl border border-border bg-card">
              <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-semibold">{es ? "Venta pendiente" : "Pending Sale"} #{order.id}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString(es ? "es-CR" : "en-US")}</p></div><div className="text-sm sm:text-right"><p>{order.customer_name || (es ? "Cliente" : "Customer")}</p>{order.customer_phone && <p className="text-muted-foreground">{order.customer_phone}</p>}</div></div>
              <div className="divide-y divide-border">{order.order_items.map((item) => { const card = item.inventory_items?.cards; return <div key={item.id} className="grid gap-4 p-5 sm:grid-cols-[56px_1fr_auto] sm:items-center"><div className="h-20 w-14 overflow-hidden rounded-lg bg-secondary">{card?.image_uri && <img src={card.image_uri} alt="" className="h-full w-full object-cover" />}</div><div><p className="font-semibold">{card?.name || "Unknown card"}</p><p className="mt-1 text-xs text-muted-foreground">{card?.set_code?.toUpperCase()} #{card?.collector_number} · {item.finish} · {item.condition} · {item.language}</p><p className="mt-2 text-sm">{crc.format(Number(item.unit_price_crc))} <span className="text-muted-foreground">{es ? "c/u" : "each"}</span></p></div><div className="flex items-center gap-2"><button onClick={() => void changeQuantity(order, item, item.quantity - 1)} disabled={working === order.id || item.quantity <= 1} className="grid h-9 w-9 place-items-center rounded-lg border border-border disabled:opacity-30"><Minus size={15} /></button><div className="min-w-16 text-center"><strong>{item.quantity}</strong><p className="text-[10px] text-muted-foreground">{es ? `pidió ${item.requested_quantity}` : `asked ${item.requested_quantity}`}</p></div><button onClick={() => void changeQuantity(order, item, item.quantity + 1)} disabled={working === order.id} className="grid h-9 w-9 place-items-center rounded-lg border border-border disabled:opacity-30"><Plus size={15} /></button></div></div>; })}</div>
              {order.customer_note && <div className="border-t border-border bg-secondary/30 px-5 py-3 text-sm text-muted-foreground">{order.customer_note}</div>}
              <div className="flex flex-col gap-4 border-t border-border p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{es ? "Total final" : "Final total"}</p><p className="mt-1 text-xl font-bold text-primary">{crc.format(total)}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => void cancelOrder(order)} disabled={working === order.id} className="inline-flex items-center gap-2 rounded-xl border border-red-400/25 bg-red-400/[.06] px-4 py-2 text-sm font-semibold text-red-400 disabled:opacity-40"><XCircle size={17} />{es ? "Venta cancelada" : "Cancel Sale"}</button><button onClick={() => void completeOrder(order)} disabled={working === order.id} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-40"><CheckCircle2 size={17} />{es ? "Venta completada" : "Complete Sale"}</button></div></div>
            </section>;
          })}</div>
        )}
      </div>
    </main>
  );
}
