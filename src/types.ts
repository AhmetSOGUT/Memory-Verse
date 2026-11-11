/** Sunucudan gelen bir anı. */
export interface Memory {
  id: number;
  date: string;
  title: string;
  description: string;
  /** Elle yazılan kategori; yoksa null/undefined. */
  category?: string | null;
  /** Kapak fotoğrafı (ilk fotoğraf) adresi; yoksa null. */
  image?: string | null;
  /** Bütün fotoğraflar, kapak ilk sırada. Eski kayıtlarda boş olabilir (o zaman `image` kullanılır). */
  images?: string[];
  /** Anıyı ekleyen kişinin görünen adı. */
  author?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Formda kullanıcının doldurduğu alanlar (id, fotoğraf ve yazar sunucudan gelir). */
export type MemoryDraft = Pick<Memory, "date" | "title" | "description" | "category">;

/** Kaydederken fotoğraflara ne olacağı. */
export type PhotoEdits = {
  /** Yeni eklenecek dosyalar (seçim sırasına göre; sunucu bu sırayla ekler). */
  added: File[];
  /** Silinecek mevcut fotoğrafların dosya adları (ör. "ab12….jpg"). */
  removed: string[];
  /** Nihai sıra; ilk sıradaki kapak olur. Yeni dosyalar `added` içindeki indeksle gösterilir. */
  order: Array<{ kind: "existing"; name: string } | { kind: "new"; index: number }>;
};

/** Giriş yapmış kullanıcı. */
export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
}