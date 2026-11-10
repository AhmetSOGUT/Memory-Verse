import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { DB } from "./db.js";
import type { LiveHub } from "./live.js";
import type { PhotoStore } from "./photoStore.js";

export interface MemoryRow {
  id: number;
  date: string;
  title: string;
  description: string;
  category: string | null;
  photo: string | null;
  created_at: string;
  updated_at: string;
  author: string | null;
}

/** Anıyı yazarının görünen adıyla birlikte seçer. */
export const MEMORY_SELECT =
  "SELECT m.*, u.display_name AS author FROM memories m LEFT JOIN users u ON u.id = m.created_by";

/** Arayüzün beklediği biçim (src/types.ts'teki Memory ile uyumlu). */
export function toApi(row: MemoryRow) {
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    description: row.description,
    category: row.category,
    image: row.photo ? `/api/photos/${row.photo}` : null,
    author: row.author,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const isRealDate = (value: string) => {
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
};

/** Boş/boşluklu kategoriyi NULL olarak sakla: "aynı yazılanlar" temiz eşleşsin. */
const cleanCategory = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

// Gelen her veri doğrulanır. Bilinmeyen alanlar reddedilir (strictObject).
const memoryBody = z.strictObject({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isRealDate, "Geçersiz tarih"),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(10_000),
  category: z.string().trim().max(60, "Kategori en fazla 60 karakter olabilir").nullish(),
});

// Düzenlerken: formu açtığındaki sürüm. Arada başkası değiştirmişse 409 döner (sessizce ezilmesin).
const updateBody = memoryBody.extend({ expectedUpdatedAt: z.string().max(40).optional() });

const idParams = z.object({ id: z.coerce.number().int().positive() });

export function registerMemoryRoutes(app: FastifyInstance, db: DB, photos: PhotoStore, hub: LiveHub): void {
  const list = db.prepare<[], MemoryRow>(`${MEMORY_SELECT} ORDER BY m.date ASC, m.id ASC`);
  const get = db.prepare<[number], MemoryRow>(`${MEMORY_SELECT} WHERE m.id = ?`);
  const insert = db.prepare<[string, string, string, string | null, number]>(
    "INSERT INTO memories (date, title, description, category, created_by) VALUES (?, ?, ?, ?, ?)",
  );
  const update = db.prepare<[string, string, string, string | null, number]>(
    `UPDATE memories
        SET date = ?, title = ?, description = ?, category = ?,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ?`,
  );
  const remove = db.prepare<[number]>("DELETE FROM memories WHERE id = ?");

  app.get("/api/memories", async () => list.all().map(toApi));

  app.post("/api/memories", async (req, reply) => {
    const body = memoryBody.parse(req.body);
    const { lastInsertRowid } = insert.run(
      body.date,
      body.title,
      body.description,
      cleanCategory(body.category),
      req.user!.id,
    );
    const row = get.get(Number(lastInsertRowid))!;
    hub.publish({ action: "created", id: row.id, title: row.title, by: req.user!.displayName, byId: req.user!.id });
    return reply.status(201).send(toApi(row));
  });

  app.put("/api/memories/:id", async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const { expectedUpdatedAt, ...body } = updateBody.parse(req.body);
    // Bu bölümde await yok: kontrol ile güncelleme arasına başka istek giremez
    const current = get.get(id);
    if (!current) return reply.status(404).send({ error: "Anı bulunamadı" });
    if (expectedUpdatedAt !== undefined && expectedUpdatedAt !== current.updated_at) {
      return reply.status(409).send({ error: "Bu anı sen düzenlerken başka biri değiştirdi", current: toApi(current) });
    }
    update.run(body.date, body.title, body.description, cleanCategory(body.category), id);
    const row = get.get(id)!;
    hub.publish({ action: "updated", id, title: row.title, by: req.user!.displayName, byId: req.user!.id });
    return toApi(row);
  });

  app.delete("/api/memories/:id", async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const existing = get.get(id);
    if (!existing || remove.run(id).changes === 0) {
      return reply.status(404).send({ error: "Anı bulunamadı" });
    }
    hub.publish({ action: "deleted", id, title: existing.title, by: req.user!.displayName, byId: req.user!.id });
    await photos.remove(existing.photo); // fotoğraf dosyası da silinir
    return reply.status(204).send();
  });
}