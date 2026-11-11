import type { Memory } from "../types";

export interface DemoOptions {
  /** ?demo=300: kaç sahte anı (1–3000); 0 = deneme modu kapalı. */
  count: number;
  /** ?photo=/api/photos/....webp: sahte anıların hepsine basılacak fotoğraf. Yoksa ilk gerçek fotoğraflı anının fotoğrafı. */
  photo: string | null;
  /** ?near=300: tam çizilecek (cam + fotoğraf) küre sayısı. Yoksa constants.ts'teki değer. */
  near: number | null;
}

const PHOTO_PATH = /^\/api\/photos\/[a-f0-9]{32}\.(?:jpg|png|webp)$/;

/**
 * Gizli deneme modu seçenekleri. Örnek: ?demo=300&photo=/api/photos/XXXX.webp&near=300
 * Yalnızca evrende görünür, hiçbir yere kaydedilmez. Fotoğraf yalnızca bu sitenin kendi /api/photos/ yolundan olabilir.
 */
export function demoOptionsFromUrl(search: string = window.location.search): DemoOptions {
  const params = new URLSearchParams(search);
  const num = (key: string, max: number) => {
    const n = Number(params.get(key));
    return Number.isInteger(n) && n > 0 ? Math.min(n, max) : 0;
  };
  let photo: string | null = null;
  const raw = params.get("photo");
  if (raw) {
    try {
      const url = new URL(raw, window.location.origin); // tam adres ya da yalnızca yol, ikisi de olur
      if (url.origin === window.location.origin && PHOTO_PATH.test(url.pathname)) photo = url.pathname;
    } catch {
      /* geçersiz adres: yok say */
    }
  }
  return { count: num("demo", 3000), photo, near: num("near", 3000) || null };
}

/** Evrenin çok anıyla nasıl görüneceğini denemek için sahte anılar (negatif kimlik: gerçek anılarla karışmaz). */
export function makeDemoMemories(count: number, image: string | null): Memory[] {
  const start = Date.UTC(2021, 0, 1);
  const end = Date.UTC(2026, 9, 31);
  return Array.from({ length: count }, (_, i) => {
    const jitter = ((i * 2654435761) % 1000) / 1000; // sabit, rastgele görünümlü
    const t = start + ((end - start) * (i + jitter * 0.8)) / count;
    return {
      id: -(i + 1),
      date: new Date(t).toISOString().slice(0, 10),
      title: `Deneme anısı ${i + 1}`,
      description: "Bu, evrenin çok anıyla nasıl göründüğünü denemek için üretilmiş sahte bir anıdır. Hiçbir yere kaydedilmez.",
      image,
      author: "Deneme",
    };
  });
}

/** Gerçek anılar ile sahte anıları tarih sırasında birleştirir (sunucunun sırasıyla aynı: tarih, sonra kimlik). */
export function mergeDemo(real: Memory[], count: number, photo: string | null): Memory[] {
  const image = photo ?? real.find((m) => m.image)?.image ?? null;
  return [...real, ...makeDemoMemories(count, image)].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
}