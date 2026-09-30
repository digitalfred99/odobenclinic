// src/lib/storage/localDiskStorageAdapter.ts
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { ImageStorageAdapter } from "./imageStorage.types";

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");
const PUBLIC_BASE_URL = "/uploads";

export class LocalDiskStorageAdapter implements ImageStorageAdapter {
  async upload(buffer: Buffer, originalName: string, folder = ""): Promise<string> {
    const ext = path.extname(originalName) || "";
    const filename = `${crypto.randomUUID()}${ext}`;
    const dir = path.join(UPLOAD_ROOT, folder);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, filename), buffer);

    return path.posix.join(PUBLIC_BASE_URL, folder, filename);
  }

  async delete(storedUrl: string): Promise<void> {
    const relative = storedUrl.replace(PUBLIC_BASE_URL, "");
    const fullPath = path.join(UPLOAD_ROOT, relative);

    try {
      await fs.unlink(fullPath);
    } catch (err: unknown) {
      if (!(err && typeof err === "object" && "code" in err && err.code === "ENOENT")) {
        throw err;
      }
    }
  }
}
