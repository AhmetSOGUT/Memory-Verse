import fs from "node:fs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { DB } from "./db.js";
import type { LiveHub } from "./live.js";
import { MEMORY_SELECT, toApi, type MemoryRow } from "./memories.js";
import { PhotoError, PhotoStore } from "./photoStore.js";

const idParams = z.object({ id: z.coerce.number().int().positive() });
const nameParams = z.object({ name: z.string().max(100) });

/** Dosya uzantısı → servis edilecek içerik türü. Fotoğraflar yeniden kodlanmadığı için uzantı biçimi belirler. */
const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function registerPhotoRoutes(app: FastifyInstance, db: DB, store: PhotoStore, hub: LiveHub): void {
  const get = db.prepare<[number], MemoryRow>(`${MEMORY_SELECT} WHERE m.id = ?`);
  const setPhoto = db.prepare<[string | null, number]>(
    `UPDATE memories SET photo = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
  );

  // Fotoğrafı yükle / değiştir (multipart, tek dosya)
  app.put("/api/memories/:id/photo", async (req, reply) => {
    const { id } = idParams.parse(req.params);

    const file = await req.file();
    if (!file) throw new PhotoError("Dosya gönderilmedi", 400);
    const buffer = await file.toBuffer(); // boyut sınırı aşılırsa 413 fırlatır

    const memory = get.get(id);
    if (!memory) return reply.status(404).send({ error: "Anı bulunamadı" });

    const name = await store.save(buffer);
    try {
      setPhoto.run(name, id);
    } catch (err) {
      await store.remove(name); // veritabanı başarısızsa yetim dosya bırakma
      throw err;
    }
    await store.remove(memory.photo); // eski fotoğrafı temizle
    const row = get.get(id)!;
    hub.publish({ action: "updated", id, title: row.title, by: req.user!.displayName, byId: req.user!.id });
    return toApi(row);
  });

  // Fotoğrafı kaldır
  app.delete("/api/memories/:id/photo", async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const memory = get.get(id);
    if (!memory) return reply.status(404).send({ error: "Anı bulunamadı" });
    setPhoto.run(null, id);
    await store.remove(memory.photo);
    const row = get.get(id)!;
    hub.publish({ action: "updated", id, title: row.title, by: req.user!.displayName, byId: req.user!.id });
    return toApi(row);
  });

  // Fotoğrafı göster
  app.get("/api/photos/:name", async (req, reply) => {
    const { name } = nameParams.parse(req.params);
    if (!PhotoStore.isValidName(name)) return reply.status(404).send({ error: "Bulunamadı" });

    const file = store.pathOf(name);
    try {
      await fs.promises.access(file);
    } catch {
      return reply.status(404).send({ error: "Bulunamadı" });
    }
    const ext = name.slice(name.lastIndexOf(".") + 1);
    return reply
      .type(CONTENT_TYPES[ext] ?? "application/octet-stream")
      .header("Cache-Control", "private, max-age=31536000, immutable") // ad her yüklemede yeni, güvenle önbelleğe alınır
      .header("X-Content-Type-Options", "nosniff")
      .header("Content-Security-Policy", "default-src 'none'; sandbox")
      .send(fs.createReadStream(file));
  });
}