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

export class R2StorageAdapter implements ImageStorageAdapter {
  private readonly client: S3Client;
  private readonly bucket = process.env.R2_BUCKET!;
  // Public URL of the bucket (custom domain or r2.dev), no trailing slash.
  private readonly publicBaseUrl = (process.env.R2_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
  // Optional. When R2_KEY_PREFIX is set (e.g. "odoben-clinic" or
  // "odoben-clinic/dev") it becomes the top folder of every object key.
  // Unset, empty or whitespace-only means no prefix.
  private readonly keyPrefix = (process.env.R2_KEY_PREFIX ?? "").trim().replace(/^\/+|\/+$/g, "");

  constructor() {
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }

  async upload(buffer: Buffer, originalName: string, folder = ""): Promise<string> {
    const ext = path.extname(originalName).toLowerCase();
    const contentType = CONTENT_TYPES[ext] ?? "image/jpeg";
    const filename = `${crypto.randomUUID()}${CONTENT_TYPES[ext] ? ext : ".jpg"}`;

    // filter(Boolean) drops whichever parts are empty, so this gives
    // "prefix/folder/file", "folder/file" or just "file" as appropriate.
    const key = [this.keyPrefix, folder, filename].filter(Boolean).join("/");

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

    return `${this.publicBaseUrl}/${key}`;
  }

  async delete(storedUrl: string): Promise<void> {
    if (!storedUrl.startsWith(`${this.publicBaseUrl}/`)) return;
    const key = storedUrl.slice(this.publicBaseUrl.length + 1);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}