import path from "node:path";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

/** Host başlığından yalnızca alan adını alır ("Pc.ts.net:443" → "pc.ts.net"). Geçersizse null. */
export function hostnameOf(hostHeader: string | undefined): string | null {
  if (!hostHeader) return null;
  const match = /^(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::\d{1,5})?$/.exec(hostHeader.trim().toLowerCase());
  return match ? match[1]! : null;
}

/**
 * Host doğrulaması (DNS rebinding savunması): yalnızca izin verilen adlarla gelen istekler işlenir.
 * Kötü niyetli bir site kendi alan adını bizim 127.0.0.1'e yönlendirse bile Host başlığı farklı olur ve reddedilir.
 */
export function registerHostCheck(app: FastifyInstance, allowedHosts: string[]) {
  const allowed = new Set(allowedHosts.map((h) => h.toLowerCase()));
  app.addHook("onRequest", async (req, reply) => {
    const host = hostnameOf(req.headers.host);
    if (!host || !allowed.has(host)) {
      req.log.warn({ host: req.headers.host }, "izin verilmeyen Host başlığı reddedildi");
      return reply.status(421).send({ error: "Geçersiz adres" });
    }
  });
}

/**
 * Derlenmiş ön yüzü (dist/) servis eder. Bu dosyalar herkese açıktır (giriş ekranı da bunlarla yüklenir);
 * anılar ve fotoğraflar ise /api arkasında, girişle korunur.
 */
export function registerStaticSite(app: FastifyInstance, webRoot: string) {
  app.register(fastifyStatic, {
    root: path.resolve(webRoot),
    dotfiles: "ignore",
    cacheControl: false, // başlıkları aşağıda biz belirliyoruz
    setHeaders(reply, filePath) {
      // /assets/ altındaki dosya adlarında içerik özeti var (değişirse ad değişir) → uzun süre önbelleğe alınabilir
      const hashed = filePath.split(path.sep).includes("assets");
      reply.header("Cache-Control", hashed ? "public, max-age=31536000, immutable" : "no-cache");
    },
  });

  // SPA yedeği: dosya olmayan sayfa yolları index.html'e düşer. /api/* ve uzantılı (dosya gibi) yollar gerçek 404 olur.
  app.setNotFoundHandler((req, reply) => {
    const pathname = req.url.split("?")[0]!;
    const isApi = pathname === "/api" || pathname.startsWith("/api/");
    const looksLikeFile = /\.[a-z0-9]+$/i.test(pathname);
    const isRead = req.method === "GET" || req.method === "HEAD";
    if (isRead && !isApi && !looksLikeFile) return reply.sendFile("index.html");
    return reply.status(404).send({ error: "Bulunamadı" });
  });
}