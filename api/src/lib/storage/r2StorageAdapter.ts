// src/lib/storage/r2StorageAdapter.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import path from "path";
import crypto from "crypto";
import { ImageStorageAdapter } from "./imageStorage.types";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/** Fail fast at startup instead of silently producing broken data later. */
function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`R2 storage: missing required environment variable ${name}`);
  }
  return value;
}

export class R2StorageAdapter implements ImageStorageAdapter {
  private readonly client: S3Client;
  private readonly bucket: string;
  // Optional top folder for every object key (e.g. "odoben-health-center").
  // Unset, empty or whitespace-only means no prefix.
  private readonly keyPrefix: string;

  constructor() {
    const accountId = requireEnv("R2_ACCOUNT_ID");
    this.bucket = requireEnv("R2_BUCKET");
    this.keyPrefix = (process.env.R2_KEY_PREFIX ?? "").trim().replace(/^\/+|\/+$/g, "");
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
      },
    });
  }

  /**
   * Uploads the image and returns its object KEY (not a URL).
   * Store the key in the database and turn it into a URL when reading,
   * with resolveImageUrl() from ./imageUrl. That way the public base URL
   * lives in exactly one env var (R2_PUBLIC_BASE_URL).
   */
  async upload(buffer: Buffer, originalName: string, folder = ""): Promise<string> {
    const ext = path.extname(originalName).toLowerCase();
    const contentType = CONTENT_TYPES[ext] ?? "image/jpeg";
    const filename = `${crypto.randomUUID()}${CONTENT_TYPES[ext] ? ext : ".jpg"}`;

    // Drop empty, "." and ".." segments so a folder can never escape its prefix.
    const safeFolder = folder
      .split("/")
      .filter((part) => part && part !== "." && part !== "..")
      .join("/");

    // filter(Boolean) drops whichever parts are empty, so this gives
    // "prefix/folder/file", "folder/file" or just "file" as appropriate.
    const key = [this.keyPrefix, safeFolder, filename].filter(Boolean).join("/");

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        // Keys are random UUIDs and never overwritten, so browsers can cache them forever.
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    return key;
  }

  /**
   * Accepts a stored key OR a full URL (legacy rows). The host is ignored, so
   * deletes keep working after the public base URL changes (r2.dev -> custom domain).
   */
  async delete(stored: string): Promise<void> {
    const key = this.toKey(stored);
    if (!key) {
      console.warn(`[r2] delete skipped, value is not one of our objects: ${stored}`);
      return;
    }
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  private toKey(stored: string): string | null {
    let key = stored.trim();
    if (/^https?:\/\//i.test(key)) {
      try {
        key = decodeURIComponent(new URL(key).pathname);
      } catch {
        return null;
      }
    }
    key = key.replace(/^\/+/, "");
    if (!key || key.split("/").includes("..")) return null;
    // Only ever delete inside our own prefix.
    if (this.keyPrefix && !key.startsWith(`${this.keyPrefix}/`)) return null;
    return key;
  }
}