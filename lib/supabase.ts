import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { compressEvidenceImage } from "@/lib/compressEvidenceImage";

let client: SupabaseClient | null = null;

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

function installEvidenceCompression(supabase: SupabaseClient) {
  if (typeof window === "undefined") return;
  const storage = supabase.storage as typeof supabase.storage & { __evidenceCompressionInstalled?: boolean };
  if (storage.__evidenceCompressionInstalled) return;
  const originalFrom = storage.from.bind(storage);
  storage.from = ((bucketId: string) => {
    const bucket = originalFrom(bucketId);
    if (bucketId !== "order-attachments") return bucket;
    const originalUpload = bucket.upload.bind(bucket);
    bucket.upload = (async (path: string, body: File | Blob | ArrayBuffer | FormData | string, options?: Parameters<typeof originalUpload>[2]) => {
      if (!(body instanceof File)) return originalUpload(path, body, options);
      try {
        const compressed = await compressEvidenceImage(body);
        return originalUpload(path, compressed, { ...options, contentType: compressed.type });
      } catch (error) {
        console.error("Evidence image compression failed", error);
        return { data: null, error: new Error("EVIDENCE_IMAGE_COMPRESSION_FAILED") } as Awaited<ReturnType<typeof originalUpload>>;
      }
    }) as typeof bucket.upload;
    return bucket;
  }) as typeof storage.from;
  storage.__evidenceCompressionInstalled = true;
}

const orderRpcEvents:Record<string,string>={
  propose_inventory_confirmation:"inventory_proposed",
  respond_inventory_changes:"inventory_response",
  request_order_payment:"payment_requested",
  submit_order_payment:"payment_submitted",
  cancel_order_with_reason:"cancelled"
};

function eventForRpc(name:string,body:any){
  if(name==="advance_order_status"){
    const action=String(body?.p_action||"");
    return ({confirm_payment:"payment_confirmed",mark_shipped:"shipped",complete:"completed"} as Record<string,string>)[action]||null;
  }
  return orderRpcEvents[name]||null;
}

async function supabaseFetchWithOrderPush(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  if (typeof window === "undefined") return response;
  try {
    const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url=new URL(requestUrl),method=init?.method?.toUpperCase();
    if(method!=="POST"||!response.ok)return response;
    const requestBody=typeof init.body==="string"?JSON.parse(init.body):null;
    const headers=new Headers(init.headers),authorization=headers.get("authorization");
    if(!authorization?.startsWith("Bearer "))return response;

    if(url.pathname.includes("/rest/v1/order_messages")){
      const responseBody=await response.clone().json(),row=Array.isArray(responseBody)?responseBody[0]:responseBody,body=Array.isArray(requestBody)?requestBody[0]:requestBody;
      const messageId=Number(row?.id),orderId=Number(body?.order_id);
      if(Number.isInteger(messageId)&&Number.isInteger(orderId))void fetch("/api/push/order-message",{method:"POST",headers:{"content-type":"application/json",authorization},body:JSON.stringify({orderId,messageId})}).then(async r=>{if(!r.ok)console.error("Order message push failed",r.status,await r.text())}).catch(e=>console.error("Order message push failed",e));
      return response;
    }

    const rpcMatch=url.pathname.match(/\/rest\/v1\/rpc\/([^/]+)$/);
    if(rpcMatch){const eventType=eventForRpc(rpcMatch[1],requestBody),orderId=Number(requestBody?.p_order_id);if(eventType&&Number.isInteger(orderId))void fetch("/api/push/order-event",{method:"POST",headers:{"content-type":"application/json",authorization},body:JSON.stringify({orderId,eventType})}).then(async r=>{if(!r.ok)console.error("Order event push failed",r.status,await r.text())}).catch(e=>console.error("Order event push failed",e));}
  } catch (error) { console.error("Order push trigger failed", error); }
  return response;
}

export function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }, global: { fetch: supabaseFetchWithOrderPush } });
    installEvidenceCompression(client);
  }
  return client;
}
