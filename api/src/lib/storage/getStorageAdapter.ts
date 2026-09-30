// src/lib/storage/getStorageAdapter.ts
// Switches storage backend based on STORAGE_DRIVER:
//   STORAGE_DRIVER=local  -> LocalDiskStorageAdapter (writes to /public/uploads)
//   anything else/unset   -> CloudinaryStorageAdapter (needs CLOUDINARY_* env vars)
// Picked once and cached for the life of the process — same pattern as
// getEmailProvider/getSmsProvider. Changing STORAGE_DRIVER requires a
// server restart to take effect, it won't hot-swap mid-process.
import { ImageStorageAdapter } from "./imageStorage.types";
import { CloudinaryStorageAdapter } from "./cloudinaryStorageAdapter";
import { LocalDiskStorageAdapter } from "./localDiskStorageAdapter";

let adapter: ImageStorageAdapter | null = null;

export function getStorageAdapter(): ImageStorageAdapter {
  if (!adapter) {
    adapter =
      process.env.STORAGE_DRIVER === "local"
        ? new LocalDiskStorageAdapter()
        : new CloudinaryStorageAdapter();
  }
  return adapter;
}
