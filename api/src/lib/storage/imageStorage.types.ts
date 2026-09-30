// src/lib/storage/imageStorage.types.ts
export interface ImageStorageAdapter {
  /** Persist the buffer, return the URL/path to store in the DB */
  upload(buffer: Buffer, originalName: string, folder?: string): Promise<string>;
  /** Remove a previously uploaded image, given the stored URL/path */
  delete(storedUrl: string): Promise<void>;
}