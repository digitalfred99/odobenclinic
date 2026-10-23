// src/lib/storage/getStorageAdapter.ts
// Switches storage backend based on STORAGE_DRIVER:
//   STORAGE_DRIVER=local       -> LocalDiskStorageAdapter (writes to /public/uploads)
//   STORAGE_DRIVER=r2          -> R2StorageAdapter (Cloudflare R2, needs R2_* env vars)
//   STORAGE_DRIVER=cloudinary  -> CloudinaryStorageAdapter (needs CLOUDINARY_* env vars)
//   unset / empty              -> LocalDiskStorageAdapter (development only; throws when NODE_ENV=production)
//   anything else              -> throws, so a typo can't silently send files to the wrong provider
// Picked once and cached for the life of the process — same pattern as
// getEmailProvider/getSmsProvider. Changing STORAGE_DRIVER requires a
// server restart to take effect, it won't hot-swap mid-process.
import { ImageStorageAdapter } from "./imageStorage.types";
import { CloudinaryStorageAdapter } from "./cloudinaryStorageAdapter";
import { LocalDiskStorageAdapter } from "./localDiskStorageAdapter";
import { R2StorageAdapter } from "./r2StorageAdapter";

let adapter: ImageStorageAdapter | null = null;

export function getStorageAdapter(): ImageStorageAdapter {
  if (!adapter) {
    const driver = (process.env.STORAGE_DRIVER ?? "").trim().toLowerCase();

    // Hosted disks are temporary, so never fall back to local disk in production.
    if (driver === "" && process.env.NODE_ENV === "production") {
      throw new Error('STORAGE_DRIVER is not set; refusing to use local disk in production.');
    }

    switch (driver) {
      case "":
      case "local":
        adapter = new LocalDiskStorageAdapter();
        break;
      case "r2":
        adapter = new R2StorageAdapter();
        break;
      case "cloudinary":
        adapter = new CloudinaryStorageAdapter();
        break;
      default:
        throw new Error(`Unknown STORAGE_DRIVER "${driver}". Use "local", "r2" or "cloudinary".`);
    }
  }
  return adapter;
}