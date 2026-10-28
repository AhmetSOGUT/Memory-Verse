import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { DB } from "./db.js";
import { PasswordHasher } from "./passwords.js";
import { SessionStore } from "./sessions.js";
import {
  findUserByUsername, PASSWORD_MAX, setPassword, toPublicUser, UserError, type PublicUser,
} from "./users.js";

declare module "fastify" {
  interface FastifyRequest {
    /** Giriş yapmış kullanıcı (herkese açık uç noktalarda null). */
    user: PublicUser | null;
    sessionId: number | null;
  }
  interface FastifyContextConfig {
    /** true ise giriş gerekmez. İşaretlenmeyen her uç nokta giriş ister (deny-by-default). */
    public?: boolean;
  }
}

/** Tüm API'nin üzerine kurulan CSRF başlığı: tarayıcılar bunu başka bir siteden gönderemez. */
export const CSRF_HEADER = "x-mv-request";

const loginBody = z.strictObject({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(PASSWORD_MAX + 72),
});
const passwordBody = z.strictObject({
  currentPassword: z.string().min(1).max(PASSWORD_MAX + 72),
  newPassword: z.string().min(1).max(PASSWORD_MAX + 72),
});

export interface AuthOptions {
  hasher: PasswordHasher;
  secureCookies: boolean;
}

/** Çerez adı: Secure iken `__Host-` öneki (alan adına/yola sabitlenir, alt alan adlarından yazılamaz). */
export const cookieNameFor = (secure: boolean) => (secure ? "__Host-mv_session" : "mv_session");

/**
 * Kimlik doğrulama: kancalar (CSRF + oturum) ve /api/auth/* uç noktaları.
 * Bu fonksiyonun çağrıldığı kapsamdaki (encapsulated) TÜM rotalar korunur.
 */
export function registerAuth(app: FastifyInstance, db: DB, options: AuthOptions): SessionStore {
  const { hasher, secureCookies } = options;
  const cookieName = cookieNameFor(secureCookies);
  const sessions = new SessionStore(db);

  app.decorateRequest("user", null);
  app.decorateRequest("sessionId", null);

  // Süresi dolmuş oturumları temizle (başlangıçta ve saatte bir)
  sessions.purgeExpired();
  const timer = setInterval(() => sessions.purgeExpired(), 60 * 60 * 1000);
  timer.unref();
  app.addHook("onClose", async () => clearInterval(timer));

  // Sahte özet: kullanıcı adı yokken de aynı süreyi harcamak için (kullanıcı adı sızmasın)
  let dummyHash: Promise<string> | undefined;
  const getDummyHash = () => (dummyHash ??= hasher.hash("hic-kullanilmayacak-sahte-parola"));

  // 1) CSRF: durum değiştiren her istek özel başlığı taşımalı
  app.addHook("onRequest", async (req, reply) => {
    const safe = req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS";
    if (!safe && req.headers[CSRF_HEADER] !== "1") {
      return reply.status(403).send({ error: "Geçersiz istek kaynağı" });
    }
  });

  // 2) Oturum: herkese açık işaretlenmeyen her yol giriş ister
  app.addHook("onRequest", async (req, reply) => {
    if (req.routeOptions.config?.public) return;
    const token = req.cookies[cookieName];
    const active = token ? sessions.validate(token) : null;
    if (!active) return reply.status(401).send({ error: "Giriş gerekli" });
    req.user = active.user;
    req.sessionId = active.sessionId;
  });

  const cookieOptions = (maxAge: number) => ({
    httpOnly: true, // JavaScript okuyamaz (XSS çerezi çalamaz)
    secure: secureCookies,
    sameSite: "strict" as const,
    path: "/",
    maxAge,
  });

  app.get("/api/health", { config: { public: true } }, async () => ({ ok: true }));

  app.post(
    "/api/auth/login",
    {
      config: {
        public: true,
        rateLimit: {
          max: 10,
          timeWindow: "5 minutes",
          errorResponseBuilder: (_req: unknown, ctx: { after: string }) => ({
            statusCode: 429,
            error: "Too Many Requests",
            message: `Çok fazla deneme. Biraz bekleyip tekrar dene (${ctx.after}).`,
          }),
        },
      },
    },
    async (req, reply) => {
      const body = loginBody.parse(req.body);
      const user = findUserByUsername(db, body.username);
      // Kullanıcı olsa da olmasa da aynı işi yap: zamanlama farkından kullanıcı adı anlaşılmasın
      const ok = await hasher.verify(body.password, user?.password_hash ?? (await getDummyHash()));
      if (!user || !ok) {
        req.log.warn({ username: body.username.slice(0, 50), ip: req.ip }, "başarısız giriş denemesi");
        return reply.status(401).send({ error: "Kullanıcı adı veya parola hatalı" });
      }

      // Oturum sabitleme (fixation) önlemi: eski çerez varsa iptal et, her girişte yeni anahtar üret
      const previous = req.cookies[cookieName];
      if (previous) sessions.revokeByToken(previous);

      const { token, maxAgeSeconds } = sessions.create(user.id, req.headers["user-agent"]);
      reply.setCookie(cookieName, token, cookieOptions(maxAgeSeconds));
      return { user: toPublicUser(user) };
    },
  );

  app.get("/api/auth/me", async (req) => ({ user: req.user }));

  app.post("/api/auth/logout", async (req, reply) => {
    sessions.revoke(req.sessionId!);
    reply.clearCookie(cookieName, { path: "/" });
    return reply.status(204).send();
  });

  app.post(
    "/api/auth/password",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "10 minutes",
          errorResponseBuilder: (_req: unknown, ctx: { after: string }) => ({
            statusCode: 429,
            error: "Too Many Requests",
            message: `Çok fazla deneme. Biraz bekleyip tekrar dene (${ctx.after}).`,
          }),
        },
      },
    },
    async (req, reply) => {
      const body = passwordBody.parse(req.body);
      const row = findUserByUsername(db, req.user!.username)!;
      if (!(await hasher.verify(body.currentPassword, row.password_hash))) {
        return reply.status(403).send({ error: "Mevcut parola hatalı" });
      }
      try {
        await setPassword(db, hasher, row, body.newPassword);
      } catch (err) {
        if (err instanceof UserError) return reply.status(400).send({ error: err.message });
        throw err;
      }
      sessions.revokeOthers(row.id, req.sessionId!); // başka cihazlardaki oturumlar kapanır
      return reply.status(204).send();
    },
  );

  return sessions;
}