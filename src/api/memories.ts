import type { Memory, MemoryDraft } from "../types";
import { api } from "./client";

export const listMemories = () => api<Memory[]>("GET", "/api/memories");

export const createMemory = (draft: MemoryDraft) => api<Memory>("POST", "/api/memories", { json: draft });

export const updateMemory = (id: number, draft: MemoryDraft) =>
  api<Memory>("PUT", `/api/memories/${id}`, { json: draft });

export const deleteMemory = (id: number) => api<void>("DELETE", `/api/memories/${id}`);

/** Tarayıcıda sıkıştırılmış base64 görseli dosya olarak yükler (sunucu yine de yeniden kodlar). */
export async function setMemoryPhoto(id: number, dataUrl: string): Promise<Memory> {
  const blob = await (await fetch(dataUrl)).blob();
  const form = new FormData();
  form.append("file", blob, "photo.jpg");
  return api<Memory>("PUT", `/api/memories/${id}/photo`, { body: form });
}

export const removeMemoryPhoto = (id: number) => api<Memory>("DELETE", `/api/memories/${id}/photo`);