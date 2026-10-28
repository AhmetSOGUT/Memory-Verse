import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { CSRF_HEADER, cookieNameFor } from "./authRoutes.js";
import { PasswordHasher } from "./passwords.js";
import { createTestApp, TEST_HASH_COST } from "./test-helpers.js";
import { createUser, UserError } from "./users.js";

const PASSWORD = "dogru-parola-2026!";
const COOKIE_NAME = cookieNameFor(true);
const hasher = new PasswordHasher(TEST_HASH_COST);

describe("kimlik doğrulama", () => {
  let ctx: ReturnType<typeof createTestApp>;

  const login = (username: string, password: string, headers: Record<string, string> = {}) =>
    ctx.rawApp.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { [CSRF_HEADER]: "1", ...headers },
      payload: { username, password },
    });
  const cookieFrom = (res: { headers: Record<string, unknown> }) => {
    const match = String(res.headers["set-cookie"]).match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
    return match ? `${COOKIE_NAME}=${match[1]}` : "";
  };
  const get = (url: string, cookie?: string) =>
    ctx.rawApp.inject({ method: "GET", url, headers: cookie ? { cookie } : {} });

  beforeEach(async () => {
    ctx = createTestApp();
    await createUser(ctx.db, hasher, { username: "ahmet", displayName: "Ahmet", password: PASSWORD });
  });
  afterEach(() => ctx.cleanup());

  it("giriş yapmadan hiçbir uç nokta açılmaz (deny-by-default)", async () => {
    const protectedRoutes: Array<[string, string]> = [
      ["GET", "/api/memories"], ["POST", "/api/memories"], ["PUT", "/api/memories/1"], ["DELETE", "/api/memories/1"],
      ["PUT", "/api/memories/1/photo"], ["DELETE", "/api/memories/1/photo"], ["GET", "/api/photos/" + "a".repeat(32) + ".webp"],
      ["GET", "/api/auth/me"], ["POST", "/api/auth/logout"], ["POST", "/api/auth/password"],
    ];
    for (const [method, url] of protectedRoutes) {
      const res = await ctx.rawApp.inject({ method: method as "GET", url, headers: { [CSRF_HEADER]: "1" } });
      assert.equal(res.statusCode, 401, `${method} ${url} → ${res.statusCode}`);
    }
  });

  it("sağlık kontrolü ve giriş herkese açık", async () => {
    assert.equal((await get("/api/health")).statusCode, 200);
    assert.equal((await login("ahmet", PASSWORD)).statusCode, 200);
  });

  it("CSRF: başlık yoksa geçerli çerezle bile durum değiştiren istek reddedilir", async () => {
    const cookie = cookieFrom(await login("ahmet", PASSWORD));
    for (const [method, url] of [["POST", "/api/memories"], ["DELETE", "/api/memories/1"], ["POST", "/api/auth/logout"]] as const) {
      const res = await ctx.rawApp.inject({ method, url, headers: { cookie }, payload: method === "POST" ? {} : undefined });
      assert.equal(res.statusCode, 403, `${method} ${url}`);
    }
    // giriş formu da başka siteden tetiklenemez
    const res = await ctx.rawApp.inject({ method: "POST", url: "/api/auth/login", payload: { username: "ahmet", password: PASSWORD } });
    assert.equal(res.statusCode, 403);
  });

  it("doğru parolayla girer; çerez güvenli bayraklarla gelir", async () => {
    const res = await login("Ahmet", PASSWORD); // büyük/küçük harf fark etmez
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json().user, { id: res.json().user.id, username: "ahmet", displayName: "Ahmet" });
    assert.equal(JSON.stringify(res.json()).includes("scrypt"), false, "parola özeti sızmamalı");

    const raw = String(res.headers["set-cookie"]);
    assert.match(raw, /^__Host-mv_session=/);
    assert.match(raw, /HttpOnly/i);
    assert.match(raw, /Secure/i);
    assert.match(raw, /SameSite=Strict/i);
    assert.match(raw, /Path=\//i);
    assert.doesNotMatch(raw, /Domain=/i);

    const me = await get("/api/auth/me", cookieFrom(res));
    assert.equal(me.statusCode, 200);
    assert.equal(me.json().user.username, "ahmet");
  });

  it("oturum anahtarı veritabanında düz metin saklanmaz (yalnızca özeti)", async () => {
    const cookie = cookieFrom(await login("ahmet", PASSWORD));
    const token = cookie.split("=")[1];
    const rows = ctx.db.prepare("SELECT token_hash FROM sessions").all() as Array<{ token_hash: string }>;
    assert.ok(rows.length >= 1);
    for (const r of rows) assert.notEqual(r.token_hash, token);
    assert.equal(JSON.stringify(rows).includes(token), false);
  });

  it("yanlış parola ve olmayan kullanıcı birebir aynı yanıtı verir", async () => {
    const wrongPassword = await login("ahmet", "yanlis-parola-123");
    const noSuchUser = await login("yok-boyle-biri", "yanlis-parola-123");
    assert.equal(wrongPassword.statusCode, 401);
    assert.equal(noSuchUser.statusCode, 401);
    assert.equal(wrongPassword.body, noSuchUser.body);
    assert.equal(wrongPassword.headers["set-cookie"], undefined);
  });

  it("kullanıcı adında SQL enjeksiyonu işe yaramaz", async () => {
    for (const username of ["ahmet' OR '1'='1", "ahmet'--", "'; DROP TABLE users;--"]) {
      const res = await login(username, "x".repeat(12));
      assert.equal(res.statusCode, 401, username);
    }
    assert.equal((await login("ahmet", PASSWORD)).statusCode, 200, "tablo sağlam");
  });

  it("çıkış yapınca eski çerez artık çalışmaz", async () => {
    const cookie = cookieFrom(await login("ahmet", PASSWORD));
    assert.equal((await get("/api/memories", cookie)).statusCode, 200);
    const out = await ctx.rawApp.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie, [CSRF_HEADER]: "1" } });
    assert.equal(out.statusCode, 204);
    assert.equal((await get("/api/memories", cookie)).statusCode, 401);
  });

  it("sahte, bozuk ya da yabancı çerezleri reddeder", async () => {
    for (const value of ["", "a", "x".repeat(43), "x".repeat(500), "../../etc/passwd", "' OR 1=1 --"]) {
      const res = await get("/api/memories", `${COOKIE_NAME}=${encodeURIComponent(value)}`);
      assert.equal(res.statusCode, 401, value.slice(0, 20));
    }
    // aynı değerli ama yanlış adlı çerez (ör. __Host- öneksiz) kabul edilmez
    const cookie = cookieFrom(await login("ahmet", PASSWORD));
    const renamed = cookie.replace(COOKIE_NAME, "mv_session");
    assert.equal((await get("/api/memories", renamed)).statusCode, 401);
  });

  it("süresi dolan oturum reddedilir ve silinir", async () => {
    const cookie = cookieFrom(await login("ahmet", PASSWORD));
    ctx.db.prepare("UPDATE sessions SET expires_at = ?").run(Date.now() - 1000);
    assert.equal((await get("/api/memories", cookie)).statusCode, 401);
    assert.equal((ctx.db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id != ?").get(ctx.userId) as { n: number }).n, 0);
  });

  it("90 günlük mutlak ömür, kullanılsa bile aşılamaz", async () => {
    const cookie = cookieFrom(await login("ahmet", PASSWORD));
    const day = 24 * 60 * 60 * 1000;
    ctx.db.prepare("UPDATE sessions SET created_at = ?, expires_at = ?").run(Date.now() - 91 * day, Date.now() + 10 * day);
    assert.equal((await get("/api/memories", cookie)).statusCode, 401);
  });

  it("kullanıldıkça oturum süresi uzar (saatte en fazla bir yazım)", async () => {
    const cookie = cookieFrom(await login("ahmet", PASSWORD));
    const hour = 60 * 60 * 1000;
    const stale = Date.now() - 2 * hour;
    ctx.db.prepare("UPDATE sessions SET last_seen_at = ?, expires_at = ?").run(stale, Date.now() + 1000);
    assert.equal((await get("/api/memories", cookie)).statusCode, 200);
    const row = ctx.db.prepare("SELECT last_seen_at, expires_at FROM sessions WHERE user_id != ?").get(ctx.userId) as {
      last_seen_at: number; expires_at: number;
    };
    assert.ok(row.last_seen_at > stale);
    assert.ok(row.expires_at > Date.now() + 29 * 24 * hour);
  });

  it("oturum sabitleme: giriş yapınca eski oturum iptal olur, yeni anahtar üretilir", async () => {
    const first = cookieFrom(await login("ahmet", PASSWORD));
    const second = cookieFrom(await login("ahmet", PASSWORD, { cookie: first }));
    assert.notEqual(first, second);
    assert.equal((await get("/api/memories", first)).statusCode, 401);
    assert.equal((await get("/api/memories", second)).statusCode, 200);
  });

  it("çok fazla yanlış denemede 429 verir (kaba kuvvet engeli)", async () => {
    const results: number[] = [];
    for (let i = 0; i < 12; i++) results.push((await login("ahmet", `yanlis-${i}-parola`)).statusCode);
    assert.equal(results.slice(0, 10).every((s) => s === 401), true);
    assert.equal(results[10], 429);
    // limit dolunca doğru parola bile bir süre geçmez
    const blocked = await login("ahmet", PASSWORD);
    assert.equal(blocked.statusCode, 429);
    assert.match(blocked.json().error ?? blocked.json().message, /deneme/i);
  });

  it("parola değişimi: doğrulamalar, diğer oturumların kapanması, yeni parolanın geçerli olması", async () => {
    const phone = cookieFrom(await login("ahmet", PASSWORD));
    const laptop = cookieFrom(await login("ahmet", PASSWORD));
    const change = (cookie: string, currentPassword: string, newPassword: string) =>
      ctx.rawApp.inject({
        method: "POST", url: "/api/auth/password",
        headers: { cookie, [CSRF_HEADER]: "1" }, payload: { currentPassword, newPassword },
      });

    assert.equal((await change(laptop, "yanlis-mevcut-parola", "yeni-parola-2026!")).statusCode, 403);
    assert.equal((await change(laptop, PASSWORD, "kisa")).statusCode, 400);
    assert.equal((await change(laptop, PASSWORD, "ahmet-ahmet-ahmet")).statusCode, 400); // kullanıcı adını içeriyor
    assert.equal((await change(laptop, PASSWORD, "yeni-parola-2026!")).statusCode, 204);

    assert.equal((await get("/api/memories", laptop)).statusCode, 200, "değişikliği yapan oturum açık kalır");
    assert.equal((await get("/api/memories", phone)).statusCode, 401, "diğer cihazın oturumu kapanır");
    assert.equal((await login("ahmet", PASSWORD)).statusCode, 401, "eski parola artık geçmez");
    assert.equal((await login("ahmet", "yeni-parola-2026!")).statusCode, 200);
  });

  it("kullanıcı silinince oturumları da gider", async () => {
    const cookie = cookieFrom(await login("ahmet", PASSWORD));
    ctx.db.prepare("DELETE FROM users WHERE username = 'ahmet'").run();
    assert.equal((await get("/api/memories", cookie)).statusCode, 401);
  });

  it("anıyı kimin eklediği kaydedilir", async () => {
    const cookie = cookieFrom(await login("ahmet", PASSWORD));
    const res = await ctx.rawApp.inject({
      method: "POST", url: "/api/memories", headers: { cookie, [CSRF_HEADER]: "1" },
      payload: { date: "2026-10-08", title: "Yazar", description: "deneme" },
    });
    assert.equal(res.json().author, "Ahmet");
  });

  it("yanıtlar önbelleğe alınmaz ve güvenlik başlıklarını taşır", async () => {
    const res = await get("/api/memories", ctx.cookie);
    assert.equal(res.headers["cache-control"], "no-store");
    assert.equal(res.headers["x-content-type-options"], "nosniff");
    assert.equal(res.headers["x-frame-options"], "DENY");
  });
});

describe("parola özetleme ve hesap kuralları", () => {
  it("aynı parola farklı tuzla farklı özet verir ve doğrulanır", async () => {
    const a = await hasher.hash(PASSWORD);
    const b = await hasher.hash(PASSWORD);
    assert.notEqual(a, b);
    assert.match(a, /^scrypt\$1024\$8\$1\$/);
    assert.equal(await hasher.verify(PASSWORD, a), true);
    assert.equal(await hasher.verify(PASSWORD + "x", a), false);
  });

  it("bozuk ya da sınır dışı özet biçimlerinde hata fırlatmadan false döner", async () => {
    for (const bad of ["", "düz-metin", "scrypt$1$2$3$4$5", "scrypt$1024$8$1$$", "scrypt$999999999$8$1$AAAA$AAAA", "bcrypt$10$x$y$z$w"]) {
      assert.equal(await hasher.verify(PASSWORD, bad), false, bad);
    }
  });

  it("Unicode: farklı biçimde yazılmış aynı parola eşleşir (Türkçe karakterler)", async () => {
    const composed = "g\u00fcl\u00fcm-\u015fiir-2026!"; // ü ş tek karakter
    const decomposed = "gu\u0308lu\u0308m-s\u0327iir-2026!"; // ü ş ayrık işaretlerle
    assert.notEqual(composed, decomposed);
    const h = await hasher.hash(composed);
    assert.equal(await hasher.verify(decomposed, h), true);
  });

  it("hesap kuralları: kısa parola, kullanıcı adını içeren parola, geçersiz ad ve yinelenen ad reddedilir", async () => {
    const { db, cleanup } = createTestApp();
    try {
      const make = (username: string, password: string) =>
        createUser(db, hasher, { username, displayName: "X", password });
      await assert.rejects(make("zeynep", "kisa"), UserError);
      await assert.rejects(make("zeynep", "zeynep-zeynep-1"), UserError);
      await assert.rejects(make("zeynep", "aaaaaaaaaaaaaaaa"), UserError); // çok basit
      await assert.rejects(make("a", "guclu-bir-parola-1"), UserError);
      await assert.rejects(make("boşluk var", "guclu-bir-parola-1"), UserError);
      await assert.rejects(make("x".repeat(33), "guclu-bir-parola-1"), UserError);
      await make("zeynep", "guclu-bir-parola-1");
      await assert.rejects(make("ZEYNEP", "baska-guclu-parola-2"), UserError); // büyük/küçük harf aynı kabul
    } finally {
      cleanup();
    }
  });
});