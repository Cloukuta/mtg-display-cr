import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { compressEvidenceImage } from "@/lib/compressEvidenceImage";

let client: SupabaseClient | null = null;

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
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
        return originalUpload(path, compressed, {
          ...options,
          contentType: compressed.type,
        });
      } catch (error) {
        console.error("Evidence image compression failed", error);
        return { data: null, error: new Error("EVIDENCE_IMAGE_COMPRESSION_FAILED") } as Awaited<ReturnType<typeof originalUpload>>;
      }
    }) as typeof bucket.upload;
    return bucket;
  }) as typeof storage.from;

  storage.__evidenceCompressionInstalled = true;
}

export function getSupabase() {
  if (!isSupabaseConfigured()) return null;

  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }
    );
    installEvidenceCompression(client);
  }

  return client;
}