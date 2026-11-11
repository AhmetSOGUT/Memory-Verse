/** Sunucudan gelen bir anı. */
export interface Memory {
  id: number;
  date: string;
  title: string;
  description: string;
  /** Elle yazılan kategori; yoksa null/undefined. */
  category?: string | null;
  /** Fotoğrafın sunucudaki adresi (/api/photos/...); yoksa null. */
  image?: string | null;
  /** Anıyı ekleyen kişinin görünen adı. */
  author?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Formda kullanıcının doldurduğu alanlar (id, fotoğraf ve yazar sunucudan gelir). */
export type MemoryDraft = Pick<Memory, "date" | "title" | "description" | "category">;

/** Kaydederken fotoğrafa ne olacağı. */
export type PhotoChange =
  | { kind: "keep" }
  /** Kullanıcının seçtiği dosya; sunucuya olduğu gibi (sıkıştırılmadan) yüklenir. */
  | { kind: "set"; file: File }
  | { kind: "remove" };

/** Giriş yapmış kullanıcı. */
export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
}