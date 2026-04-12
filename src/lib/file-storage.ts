import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export interface StoredUpload {
  storageUrl: string;
  storageKey: string;
}

export interface UploadStorageAdapter {
  put(input: {
    originalName: string;
    contentType: string;
    buffer: Buffer;
  }): Promise<StoredUpload>;
}

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");

function sanitizeBaseName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getExtension(name: string) {
  const ext = path.extname(name).toLowerCase();
  return ext || "";
}

class LocalUploadStorage implements UploadStorageAdapter {
  async put(input: {
    originalName: string;
    contentType: string;
    buffer: Buffer;
  }): Promise<StoredUpload> {
    await mkdir(LOCAL_UPLOAD_DIR, { recursive: true });

    const extension = getExtension(input.originalName);
    const safeBase = sanitizeBaseName(path.basename(input.originalName, extension)) || "upload";
    const storageKey = `${randomUUID()}-${safeBase}${extension}`;
    const fullPath = path.join(LOCAL_UPLOAD_DIR, storageKey);

    await writeFile(fullPath, input.buffer);

    return {
      storageKey,
      storageUrl: `local://uploads/${storageKey}`
    };
  }
}

// Supabase Storage adapter — uploads the original file to a Supabase bucket.
// Requires SUPABASE_SERVICE_ROLE_KEY (server-only) and NEXT_PUBLIC_SUPABASE_URL.
// Set SUPABASE_STORAGE_BUCKET to the bucket name (default: "uploads").
class SupabaseUploadStorage implements UploadStorageAdapter {
  async put(input: { originalName: string; contentType: string; buffer: Buffer }): Promise<StoredUpload> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "uploads";

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Supabase storage.");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const extension = getExtension(input.originalName);
    const safeBase = sanitizeBaseName(path.basename(input.originalName, extension)) || "upload";
    const storageKey = `${randomUUID()}-${safeBase}${extension}`;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(storageKey, input.buffer, {
        contentType: input.contentType,
        upsert: false
      });

    if (error) {
      throw new Error(`Supabase storage upload failed: ${error.message}`);
    }

    // Private bucket — store the path reference only.
    return { storageKey, storageUrl: `supabase://${bucket}/${storageKey}` };
  }
}

// Skips writing the file — text is already in the DB after extraction.
class NoopUploadStorage implements UploadStorageAdapter {
  async put(input: { originalName: string; contentType: string; buffer: Buffer }): Promise<StoredUpload> {
    const storageKey = `${randomUUID()}-${sanitizeBaseName(input.originalName)}`;
    return { storageKey, storageUrl: `noop://${storageKey}` };
  }
}

export function getUploadStorage(): UploadStorageAdapter {
  const provider = process.env.UPLOAD_STORAGE_PROVIDER?.toLowerCase() ?? "local";

  switch (provider) {
    case "local":
      return new LocalUploadStorage();
    case "supabase":
      return new SupabaseUploadStorage();
    case "none":
      return new NoopUploadStorage();
    default:
      throw new Error(`Unsupported upload storage provider: ${provider}`);
  }
}
