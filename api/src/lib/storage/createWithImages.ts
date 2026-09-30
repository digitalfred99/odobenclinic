// src/lib/storage/createWithImages.ts
import { getStorageAdapter } from "./getStorageAdapter";

export interface ImageFileInput {
  fieldName: string;   // e.g. "profileImage", "diplomaCertificate"
  buffer: Buffer;
  originalName: string;
}

/**
 * Uploads one or more images, then runs `persist` with a map of
 * fieldName -> storedUrl. If `persist` throws (DB save fails for
 * any reason), every image uploaded in this call is deleted again.
 */
export async function createWithImages<T>(
  images: ImageFileInput | ImageFileInput[],
  persist: (urls: Record<string, string>) => Promise<T>,
  options?: { folder?: string }
): Promise<T> {
  const storage = getStorageAdapter();
  const list = Array.isArray(images) ? images : [images];
  const uploaded: { fieldName: string; url: string }[] = [];

  try {
    for (const img of list) {
      const url = await storage.upload(img.buffer, img.originalName, options?.folder);
      uploaded.push({ fieldName: img.fieldName, url });
    }

    const urlMap = Object.fromEntries(uploaded.map((u) => [u.fieldName, u.url]));
    return await persist(urlMap);
  } catch (err) {
    await Promise.allSettled(uploaded.map((u) => storage.delete(u.url)));
    throw err;
  }
}