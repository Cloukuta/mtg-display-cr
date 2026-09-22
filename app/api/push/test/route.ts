import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPush } from "@mmmike/web-push/server";

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || "https://mtg-display-cr.pages.dev";
  const authorization = request.headers.get("authorization");
  if (!supabaseUrl || !publishableKey || !vapidPublicKey || !vapidPrivateKey) return NextResponse.json({ error: "Push server is not configured" }, { status: 503 });
  if (!authorization?.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createClient(supabaseUrl, publishableKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: { user }, error: userError } = await supabase.auth.getUser(authorization.slice(7));
  if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: subscriptions, error } = await supabase.from("push_subscriptions").select("id,endpoint,p256dh,auth_key").eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!subscriptions?.length) return NextResponse.json({ error: "No push subscriptions found" }, { status: 404 });
  let sent = 0; const expired: string[] = []; const failures: string[] = [];
  const payload = JSON.stringify({ title: "MTG Display CR", body: "Web Push funciona correctamente 🎉", url: "/", tag: "push-test" });
  for (const sub of subscriptions) {
    try {
      await sendPush({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } }, payload, { vapid: { subject: vapidSubject, publicKey: vapidPublicKey, privateKey: vapidPrivateKey }, ttl: 60 });
      sent++;
    } catch (e: any) {
      const status = Number(e?.statusCode ?? e?.status ?? 0);
      if (status === 404 || status === 410) expired.push(sub.id); else failures.push(e?.message || "Push failed");
    }
  }
  if (expired.length) await supabase.from("push_subscriptions").delete().in("id", expired).eq("user_id", user.id);
  return NextResponse.json({ ok: sent > 0, sent, expired: expired.length, failed: failures.length, errors: failures.slice(0, 3) }, { status: sent > 0 ? 200 : 502 });
}
