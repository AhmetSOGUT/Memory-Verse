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

/** Seçilen fotoğrafı olduğu gibi (yeniden sıkıştırmadan) yükler. */
export async function setMemoryPhoto(id: number, file: File): Promise<Memory> {
  const form = new FormData();
  form.append("file", file, file.name || "photo");
  return api<Memory>("PUT", `/api/memories/${id}/photo`, { body: form });
}

export const removeMemoryPhoto = (id: number) => api<Memory>("DELETE", `/api/memories/${id}/photo`);