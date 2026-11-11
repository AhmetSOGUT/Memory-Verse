import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { ZodError } from "zod";
import { registerAuth } from "./authRoutes.js";
import { registerEventRoutes } from "./eventRoutes.js";
import { LiveHub } from "./live.js";
import { config } from "./config.js";
import type { DB } from "./db.js";
import { registerMemoryRoutes } from "./memories.js";
import { PasswordHasher } from "./passwords.js";
import { registerPhotoRoutes } from "./photoRoutes.js";
import { PhotoStore } from "./photoStore.js";
import type { SessionStore } from "./sessions.js";
import { registerHostCheck, registerStaticSite } from "./staticSite.js";

export interface AppOptions {
  photosDir: string;
  logger?: boolean;
  /** scrypt maliyeti; yalnızca testlerde düşürülür. */
  hashCost?: number;
  secureCookies?: boolean;
  /** Derlenmiş ön yüzün (dist/) klasörü. Verilmezse yalnızca API çalışır. */
  webRoot?: string;
  /** Kabul edilen Host adları (portsuz). */
  allowedHosts?: string[];
  /** Canlı bildirim ayarları (yalnızca testlerde değiştirilir). */
  live?: { heartbeatMs?: number; maxPerUser?: number };
  /** Önde güvenilir bir ters vekil varsa (tailscale serve): gerçek istemci adresi X-Forwarded-For'dan alınır. */
  trustProxy?: boolean | string;
}

/**
 * İçerik güvenlik politikası: yalnızca kendi kaynağımızdan betik/stil/font; görseller için data:/blob: (form önizlemesi ve doku).
 * style-src 'unsafe-inline': React'in style="..." öznitelikleri için (betik tarafı sıkı kalır).
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export function buildApp(db: DB, options: AppOptions) {
  const app = Fastify({
    logger: options.logger ?? false,
    trustProxy: options.trustProxy ?? false,
    bodyLimit: 64 * 1024, // JSON gövdesi en fazla 64 KB (fotoğraflar multipart ile, aşağıdaki sınırlarla)
  });

  // Host doğrulaması en başta: izin verilmeyen adla gelen hiçbir isteğe cevap verilmez
  registerHostCheck(app, options.allowedHosts ?? config.allowedHosts);

  app.register(multipart, {
    limits: { fileSize: 25 * 1024 * 1024, files: 1, fields: 0, parts: 2 }, // en fazla 25 MB (fotoğraflar yeniden sıkıştırılmaz), tek dosya
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
    reply.header("Content-Security-Policy", CSP);
    reply.header("Cross-Origin-Opener-Policy", "same-origin");
    reply.header("Cross-Origin-Resource-Policy", "same-origin");
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
    if (options.secureCookies ?? config.secureCookies) {
      reply.header("Strict-Transport-Security", "max-age=15552000"); // 180 gün; HTTPS'e zorlar (HTTP'de tarayıcı yok sayar)
    }
  });

  app.register(cookie);
  app.register(rateLimit, { global: false });

  // Bu kapsamdaki her rota giriş ister (açıkça `public` işaretlenenler hariç)
  const hasher = new PasswordHasher(options.hashCost);
  let sessionStore: SessionStore | undefined;
  const hub = new LiveHub({
    isSessionActive: (id) => sessionStore?.isActive(id) ?? false,
    heartbeatMs: options.live?.heartbeatMs,
    maxPerUser: options.live?.maxPerUser,
  });
  // Açık canlı bağlantılar kapanmadan sunucu kapanamaz: önce onları kapat
  app.addHook("preClose", async () => hub.shutdown());

  app.register(async (secured) => {
    sessionStore = registerAuth(secured, db, {
      hasher,
      secureCookies: options.secureCookies ?? config.secureCookies,
      onLogout: (sessionId) => hub.closeSession(sessionId),
    });
    registerMemoryRoutes(secured, db, photos, hub);
    registerPhotoRoutes(secured, db, photos, hub);
    registerEventRoutes(secured, hub);
  });

  // En sonda: /api rotaları kesinleşmiş olsun, geri kalan her şey siteye (veya 404'e) düşsün
  if (options.webRoot) registerStaticSite(app, options.webRoot);

  return app;
}