// src/lib/storage/imageUrl.ts
//
// Turns whatever is stored in the database into something a browser can load.
//   "https://..."   -> returned as-is (legacy full URLs, Cloudinary)
//   "/uploads/..."  -> returned as-is (local dev driver)
//   "a/b/c.jpg"     -> R2 object key, prefixed with R2_PUBLIC_BASE_URL
//
// Call this on the SERVER (route handlers, server components) and send the
// resulting URL to the browser, so the frontend needs no storage env vars.
// It has no SDK imports and needs no secrets, so it is cheap to import anywhere on the server.

export function resolveImageUrl(stored: string | null | undefined): string | null {
  const value = stored?.trim();
  if (!value) return null;

  if (/^https?:\/\//i.test(value) || value.startsWith("/")) return value;

  const base = (process.env.R2_PUBLIC_BASE_URL ?? "").trim().replace(/\/+$/, "");
  if (!base) {
    // Don't crash the page; the UI falls back to initials/placeholder.
    console.error(
      `[images] R2_PUBLIC_BASE_URL is not set, cannot build a URL for stored key "${value}"`
    );
    return null;
  }
  return `${base}/${value}`;
}