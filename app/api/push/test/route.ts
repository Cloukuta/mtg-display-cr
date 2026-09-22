import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  return Uint8Array.from(atob(normalized), (c) => c.charCodeAt(0));
}
function encodeBase64Url(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function encodeJson(value: unknown) {
  return encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}
async function createVapidJwt(endpoint: string, subject: string, publicKey: string, privateKey: string) {
  const rawPublic = decodeBase64Url(publicKey);
  if (rawPublic.length !== 65 || rawPublic[0] !== 4) throw new Error("Invalid VAPID public key");
  const x = encodeBase64Url(rawPublic.slice(1, 33));
  const y = encodeBase64Url(rawPublic.slice(33, 65));
  const key = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x, y, d: privateKey, ext: true }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const audience = new URL(endpoint).origin;
  const header = encodeJson({ typ: "JWT", alg: "ES256" });
  const claims = encodeJson({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: subject });
  const unsigned = `${header}.${claims}`;
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned)));
  return `${unsigned}.${encodeBase64Url(signature)}`;
}
async function sendEmptyPush(endpoint: string, subject: string, publicKey: string, privateKey: string) {
  const jwt = await createVapidJwt(endpoint, subject, publicKey, privateKey);
  return fetch(endpoint, { method: "POST", headers: { TTL: "60", Authorization: `vapid t=${jwt}, k=${publicKey}` } });
}

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
  const { data: subscriptions, error } = await supabase.from("push_subscriptions").select("id,endpoint").eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!subscriptions?.length) return NextResponse.json({ error: "No push subscriptions found" }, { status: 404 });
  let sent = 0; const expired: string[] = []; const failures: string[] = [];
  for (const sub of subscriptions) {
    try {
      const response = await sendEmptyPush(sub.endpoint, vapidSubject, vapidPublicKey, vapidPrivateKey);
      if (response.ok || response.status === 201) sent++;
      else if (response.status === 404 || response.status === 410) expired.push(sub.id);
      else failures.push(`Push service returned ${response.status}`);
    } catch (e: any) { failures.push(e?.message || "Push failed"); }
  }
  if (expired.length) await supabase.from("push_subscriptions").delete().in("id", expired).eq("user_id", user.id);
  return NextResponse.json({ ok: sent > 0, sent, expired: expired.length, failed: failures.length, errors: failures.slice(0, 3) }, { status: sent > 0 ? 200 : 502 });
}
