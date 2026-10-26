/** Bir anı kaydı (IndexedDB'de saklanan biçim). */
export interface Memory {
  id: number;
  date: string;
  title: string;
  description: string;
  /** base64 data URL — sunucuya geçince dosya URL'si olacak. */
  image?: string | null;
}
