import type { Memory } from "../types";

/** Bir anıya eklenebilecek en fazla fotoğraf (sunucudaki sınırla aynı). */
export const MAX_PHOTOS = 12;

/** Anının fotoğrafları; eski kayıtlarda `images` yoksa kapak fotoğrafına düşer. */
export function memoryImages(memory: Pick<Memory, "image" | "images">): string[] {
  if (memory.images && memory.images.length > 0) return memory.images;
  return memory.image ? [memory.image] : [];
}

/** "/api/photos/abc.jpg" → "abc.jpg" (sunucudaki dosya adı). */
export function photoName(url: string): string {
  return url.slice(url.lastIndexOf("/") + 1);
}
