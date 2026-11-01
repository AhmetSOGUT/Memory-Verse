import type { FastifyInstance } from "fastify";
import type { LiveHub } from "./live.js";

/**
 * Canlı bildirim akışı (Server-Sent Events). Giriş ister (diğer her yol gibi, çerezle).
 * Yalnızca okuma: istemci hiçbir şey göndermez, bu yüzden CSRF başlığı gerekmez.
 */
export function registerEventRoutes(app: FastifyInstance, hub: LiveHub): void {
  app.get("/api/events", async (req, reply) => {
    const { stream, release } = hub.connect(req.user!.id, req.sessionId!);
    // Not: req.raw'ın 'close'u GET'te istek bitince hemen tetiklenir; bağlantının kopmasını yanıt nesnesi bildirir
    reply.raw.once("close", release);
    req.raw.socket.setNoDelay(true);
    reply
      .type("text/event-stream; charset=utf-8")
      .header("Cache-Control", "no-cache, no-transform")
      .header("X-Accel-Buffering", "no");
    return reply.send(stream);
  });
}