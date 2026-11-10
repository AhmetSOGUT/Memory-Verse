import type { Memory } from "../types";

/**
 * Türkçe'ye duyarlı küçük harfe çevirme + I/İ/ı/i farkını yok sayma.
 * Böylece "ISTANBUL", "İstanbul", "istanbul" hep aynı bulunur.
 */
const lower = (text: string) => text.toLocaleLowerCase("tr-TR").replace(/ı/g, "i");

/** Arama için metni sadeleştir: küçük harf + art arda boşlukları teke indir. */
export const normalizeText = (text: string) => lower(text).replace(/\s+/g, " ").trim();

/** Bir anının aranabilir metni: başlık + içerik + kategori + tarih (ISO ve Türkçe yazım). */
export function memoryHaystack(memory: Memory): string {
  const formatted = new Date(`${memory.date}T00:00:00`).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return normalizeText(
    [memory.title, memory.description, memory.category ?? "", memory.date, formatted].join(" "),
  );
}

export interface MemoryFilter {
  query?: string;
  category?: string | null;
  fromDate?: string;
  toDate?: string;
}

/**
 * Arama mantığı:
 * - Metindeki HER kelime, anının başlık/içerik/kategori/tarih metninde geçmeli (sıra önemsiz).
 * - Kategori büyük/küçük harf farkı gözetmeden eşleşir.
 * - Tarih aralığı ISO (YYYY-MM-DD) karşılaştırmasıyla süzülür.
 */
export function filterMemories(memories: Memory[], filter: MemoryFilter): Memory[] {
  const query = filter.query ?? "";
  const category = filter.category ?? "";
  const fromDate = filter.fromDate ?? "";
  const toDate = filter.toDate ?? "";
  const words = normalizeText(query).split(" ").filter(Boolean);
  const wantedCategory = lower(category.trim());

  return memories.filter((memory) => {
    if (wantedCategory) {
      const memoryCategory = lower((memory.category ?? "").trim());
      if (memoryCategory !== wantedCategory) return false;
    }
    if (fromDate && memory.date < fromDate) return false;
    if (toDate && memory.date > toDate) return false;
    if (words.length === 0) return true;
    const haystack = memoryHaystack(memory);
    return words.every((word) => haystack.includes(word));
  });
}

/** Daha önce kullanılan kategoriler: çok kullanılandan aza, eşitse alfabetik. */
export function collectCategories(memories: Memory[]): string[] {
  const groups = new Map<string, { name: string; count: number }>();
  for (const memory of memories) {
    const name = (memory.category ?? "").trim();
    if (!name) continue;
    const key = lower(name);
    const existing = groups.get(key);
    if (existing) existing.count += 1;
    else groups.set(key, { name, count: 1 });
  }
  return [...groups.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "tr"))
    .map((group) => group.name);
}

/** Yazılan kategoriyi, varsa aynı kategorinin mevcut yazımıyla eşleştir (ör. "tatil" → "Tatil"). */
export function canonicalCategory(value: string, categories: string[]): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const needle = lower(trimmed);
  return categories.find((name) => lower(name) === needle) ?? trimmed;
}