import type { Memory, MemoryDraft } from "../types";
import { api } from "./client";

export const listMemories = () => api<Memory[]>("GET", "/api/memories");

export const createMemory = (draft: MemoryDraft) => api<Memory>("POST", "/api/memories", { json: draft });

/**
 * `expectedUpdatedAt`: formu açtığındaki sürüm. Arada başkası değiştirmişse sunucu 409 döner
 * (iki kişi aynı anıyı düzenlerken biri diğerini sessizce ezmesin).
 */
export const updateMemory = (id: number, draft: MemoryDraft, expectedUpdatedAt?: string) =>
  api<Memory>("PUT", `/api/memories/${id}`, { json: { ...draft, expectedUpdatedAt } });

export const deleteMemory = (id: number) => api<void>("DELETE", `/api/memories/${id}`);

/** Fotoğrafları olduğu gibi (yeniden sıkıştırmadan) yükler; sunucu verilen sırayla ekler. */
export async function addMemoryPhotos(id: number, files: File[]): Promise<Memory> {
  const form = new FormData();
  for (const file of files) form.append("files", file, file.name || "photo");
  return api<Memory>("POST", `/api/memories/${id}/photos`, { body: form });
}

export const removeMemoryPhoto = (id: number, name: string) =>
  api<Memory>("DELETE", `/api/memories/${id}/photos/${encodeURIComponent(name)}`);

/** Fotoğraf sırasını değiştirir; ilk sıradaki kapak (küre/kart) olur. */
export const reorderMemoryPhotos = (id: number, names: string[]) =>
  api<Memory>("PUT", `/api/memories/${id}/photos/order`, { json: { names } });