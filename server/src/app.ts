import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { ZodError } from "zod";
import { registerAuth } from "./authRoutes.js";
import { config } from "./config.js";
import type { DB } from "./db.js";
import { registerMemoryRoutes } from "./memories.js";
import { PasswordHasher } from "./passwords.js";
import { registerPhotoRoutes } from "./photoRoutes.js";
import { PhotoStore } from "./photoStore.js";

export interface AppOptions {
  photosDir: string;
  logger?: boolean;
  /** scrypt maliyeti; yalnızca testlerde düşürülür. */
  hashCost?: number;
  secureCookies?: boolean;
}

export function buildApp(db: DB, options: AppOptions) {
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

  // Her API yanıtı özeldir: önbelleğe alınmasın, çerçeveye gömülmesin
  app.addHook("onSend", async (_req, reply) => {
    if (!reply.hasHeader("cache-control")) reply.header("Cache-Control", "no-store");
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "no-referrer");
  });

  app.register(cookie);
  app.register(rateLimit, { global: false });

  // Bu kapsamdaki her rota giriş ister (açıkça `public` işaretlenenler hariç)
  const hasher = new PasswordHasher(options.hashCost);
  app.register(async (secured) => {
    registerAuth(secured, db, { hasher, secureCookies: options.secureCookies ?? config.secureCookies });
    registerMemoryRoutes(secured, db, photos);
    registerPhotoRoutes(secured, db, photos);
  });

  return app;
}