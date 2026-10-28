import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { ZodError } from "zod";
import type { DB } from "./db.js";
import { registerMemoryRoutes } from "./memories.js";
import { registerPhotoRoutes } from "./photoRoutes.js";
import { PhotoStore } from "./photoStore.js";

export function buildApp(db: DB, options: { photosDir: string; logger?: boolean }) {
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 64 * 1024, // JSON gövdesi en fazla 64 KB (fotoğraflar multipart ile, aşağıdaki sınırlarla)
  });

  app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0, parts: 2 }, // en fazla 10 MB, tek dosya, alan yok
  });
  const photos = new PhotoStore(options.photosDir);

  // Hata mesajlarıyla içeriden bilgi sızdırma: 5xx'te ayrıntı yok, yalnızca günlüğe yazılır
  app.setErrorHandler((error: unknown, req, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: "Geçersiz istek",
        details: error.issues.map((i) => `${i.path.join(".") || "gövde"}: ${i.message}`),
      });
    }
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) {
      req.log.error(error);
      return reply.status(500).send({ error: "Sunucu hatası" });
    }
    return reply.status(status).send({ error: (error as Error).message });
  });

  app.get("/api/health", async () => ({ ok: true }));
  registerMemoryRoutes(app, db, photos);
  registerPhotoRoutes(app, db, photos);

  return app;
}