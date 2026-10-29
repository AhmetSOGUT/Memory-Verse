/** Sunucudan gelen bir anı. */
export interface Memory {
  id: number;
  date: string;
  title: string;
  description: string;
  /** Fotoğrafın sunucudaki adresi (/api/photos/...); yoksa null. */
  image?: string | null;
  /** Anıyı ekleyen kişinin görünen adı. */
  author?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Formda kullanıcının doldurduğu alanlar (id, fotoğraf ve yazar sunucudan gelir). */
export type MemoryDraft = Pick<Memory, "date" | "title" | "description">;

/** Kaydederken fotoğrafa ne olacağı. */
export type PhotoChange =
  | { kind: "keep" }
  | { kind: "set"; dataUrl: string }
  | { kind: "remove" };

/** Giriş yapmış kullanıcı. */
export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
}