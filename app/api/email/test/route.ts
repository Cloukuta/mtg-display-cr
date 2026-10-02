import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[char] || char));
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const brevoApiKey = process.env.BREVO_API_KEY;
  const fromName = process.env.EMAIL_FROM_NAME || "MTG Display CR";
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  const replyTo = process.env.EMAIL_REPLY_TO || fromAddress;
  const authorization = request.headers.get("authorization");

  if (!supabaseUrl || !publishableKey) {
    return NextResponse.json({ error: "Supabase server configuration is missing" }, { status: 503 });
  }
  if (!brevoApiKey || !fromAddress) {
    return NextResponse.json({ error: "Email server is not configured" }, { status: 503 });
  }
  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authorization.slice(7);
  const supabase = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recipient = user.email;
  const safeRecipient = escapeHtml(recipient);
  const htmlContent = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
      <h1 style="font-size:24px">MTG Display CR</h1>
      <p><strong>Prueba de notificaciones por email completada.</strong></p>
      <p>Este mensaje confirma que la conexión entre MTG Display CR, Cloudflare y Brevo está funcionando para <strong>${safeRecipient}</strong>.</p>
      <p style="color:#6b7280;font-size:13px">Este es un mensaje de prueba. Todavía no activa envíos automáticos de Wishlist.</p>
    </div>`;

  let response: Response;
  try {
    response = await fetch(BREVO_SEND_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromAddress },
        to: [{ email: recipient }],
        replyTo: replyTo ? { email: replyTo } : undefined,
        subject: "MTG Display CR — Prueba de email",
        htmlContent,
        textContent: "MTG Display CR — Prueba de email. La conexión entre MTG Display CR, Cloudflare y Brevo está funcionando. Los envíos automáticos de Wishlist todavía no están activos.",
        tags: ["w3-3-test"],
      }),
    });
  } catch (error: any) {
    console.error("Brevo test email request failed", error);
    return NextResponse.json({ error: "Email provider request failed" }, { status: 502 });
  }

  let providerBody: any = null;
  try { providerBody = await response.json(); } catch { /* Brevo may return no JSON on an upstream failure. */ }

  if (!response.ok) {
    console.error("Brevo test email rejected", response.status, providerBody);
    return NextResponse.json({ error: "Email provider rejected the request", providerStatus: response.status }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    provider: "brevo",
    messageId: providerBody?.messageId || null,
    recipient: recipient.replace(/^(.{2}).*(@.*)$/, "$1***$2"),
  });
}
