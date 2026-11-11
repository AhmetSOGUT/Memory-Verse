import fs from "node:fs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { DB } from "./db.js";
import type { LiveHub } from "./live.js";
import { MEMORY_SELECT, photoNamesOf, toApi, type MemoryRow } from "./memories.js";
import { PhotoError, PhotoStore } from "./photoStore.js";

/** Bir anıya eklenebilecek en fazla fotoğraf sayısı (istemcide de aynı sınır var). */
export const MAX_PHOTOS = 12;

const idParams = z.object({ id: z.coerce.number().int().positive() });
const nameParams = z.object({ name: z.string().max(100) });
const orderBody = z.strictObject({ names: z.array(z.string().max(100)).max(MAX_PHOTOS) });

/** Dosya uzantısı → servis edilecek içerik türü. Fotoğraflar yeniden kodlanmadığı için uzantı biçimi belirler. */
const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function registerPhotoRoutes(app: FastifyInstance, db: DB, store: PhotoStore, hub: LiveHub): void {
  const get = db.prepare<[number], MemoryRow>(`${MEMORY_SELECT} WHERE m.id = ?`);
  const insertPhoto = db.prepare<[number, string, number]>(
    "INSERT INTO memory_photos (memory_id, name, sort) VALUES (?, ?, ?)",
  );
  const deletePhoto = db.prepare<[number, string]>(
    "DELETE FROM memory_photos WHERE memory_id = ? AND name = ?",
  );
  const setSort = db.prepare<[number, number, string]>(
    "UPDATE memory_photos SET sort = ? WHERE memory_id = ? AND name = ?",
  );
  const countPhotos = db.prepare<[number], { n: number }>(
    "SELECT COUNT(*) AS n FROM memory_photos WHERE memory_id = ?",
  );
  // Kapak (memories.photo) her zaman ilk fotoğraf; fotoğraf listesi değişince güncellenir.
  const touch = db.prepare<[string | null, number]>(
    `UPDATE memories
        SET photo = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ?`,
  );

  function syncCover(id: number): void {
    touch.run(photoNamesOf(db, id)[0] ?? null, id);
  }

  /** Kayıtlı anıyı güncel fotoğraf listesiyle döndürür ve canlı bildirim yayınlar. */
  function respond(id: number, userId: number, displayName: string) {
    const row = get.get(id)!;
    hub.publish({ action: "updated", id, title: row.title, by: displayName, byId: userId });
    return toApi(row, photoNamesOf(db, id));
  }

  // Fotoğraf(lar) ekle: multipart, birden fazla dosya (sırayla eklenir)
  app.post("/api/memories/:id/photos", async (req, reply) => {
    const { id } = idParams.parse(req.params);
    if (!get.get(id)) return reply.status(404).send({ error: "Anı bulunamadı" });

    const count = countPhotos.get(id)!.n;
    const saved: string[] = [];
    try {
      for await (const part of req.parts()) {
        if (part.type !== "file") continue;
        if (count + saved.length >= MAX_PHOTOS) {
          throw new PhotoError(`Bir anıya en fazla ${MAX_PHOTOS} fotoğraf eklenebilir`, 400);
        }
        saved.push(await store.save(await part.toBuffer()));
      }
    } catch (err) {
      await Promise.all(saved.map((name) => store.remove(name))); // yarım kalanları temizle
      throw err;
    }
    if (saved.length === 0) throw new PhotoError("Dosya gönderilmedi", 400);

    try {
      db.transaction(() => {
        saved.forEach((name, index) => insertPhoto.run(id, name, count + index));
        syncCover(id);
      })();
    } catch (err) {
      await Promise.all(saved.map((name) => store.remove(name)));
      throw err;
    }
    return respond(id, req.user!.id, req.user!.displayName);
  });

  // Tek fotoğrafı kaldır (kapak da gerekirse kayar)
  app.delete("/api/memories/:id/photos/:name", async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const { name } = nameParams.parse(req.params);
    if (!get.get(id)) return reply.status(404).send({ error: "Anı bulunamadı" });
    if (!PhotoStore.isValidName(name)) return reply.status(404).send({ error: "Fotoğraf bulunamadı" });

    const removed = db.transaction(() => {
      const changes = deletePhoto.run(id, name).changes;
      if (changes) syncCover(id);
      return changes;
    })();
    if (!removed) return reply.status(404).send({ error: "Fotoğraf bulunamadı" });

    await store.remove(name);
    return respond(id, req.user!.id, req.user!.displayName);
  });

  // Fotoğraf sırasını değiştir (ilk sıradaki kapak olur)
  app.put("/api/memories/:id/photos/order", async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const { names } = orderBody.parse(req.body);
    if (!get.get(id)) return reply.status(404).send({ error: "Anı bulunamadı" });

    const current = photoNamesOf(db, id);
    const sameSet =
      names.length === current.length &&
      new Set(names).size === names.length &&
      names.every((name) => current.includes(name));
    if (!sameSet) {
      return reply.status(400).send({ error: "Fotoğraf sırası güncel listeyle uyuşmuyor" });
    }

    db.transaction(() => {
      names.forEach((name, index) => setSort.run(index, id, name));
      syncCover(id);
    })();
    return respond(id, req.user!.id, req.user!.displayName);
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
