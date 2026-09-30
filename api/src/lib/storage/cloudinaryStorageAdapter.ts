// src/lib/storage/cloudinaryStorageAdapter.ts
import { v2 as cloudinary } from "cloudinary";
import crypto from "crypto";
import { ImageStorageAdapter } from "./imageStorage.types";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export class CloudinaryStorageAdapter implements ImageStorageAdapter {
  async upload(buffer: Buffer, originalName: string, folder = ""): Promise<string> {
    const publicId = crypto.randomUUID();
    const fullFolder = folder ? `yes-awards/${folder}` : "yes-awards";

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: fullFolder,
          public_id: publicId,
          resource_type: "image",
          overwrite: false,
        },
        (error, result) => {
          if (error || !result) return reject(error ?? new Error("Cloudinary upload failed"));
          resolve(result.secure_url);
        }
      );
      stream.end(buffer);
    });
  }

  async delete(storedUrl: string): Promise<void> {
    const publicId = this.extractPublicId(storedUrl);
    if (!publicId) return;
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  }

  // We set public_id ourselves at upload time, so we can reliably
  // recover it from Cloudinary's standard delivery URL shape:
  // https://res.cloudinary.com/<cloud>/image/upload/v169.../yes-awards/profiles/<uuid>.jpg
  private extractPublicId(url: string): string | null {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
    return match ? match[1] : null;
  }
}