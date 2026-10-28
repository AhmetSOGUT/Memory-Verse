import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { InjectOptions } from "fastify";
import { buildApp } from "./app.js";
import { CSRF_HEADER, cookieNameFor } from "./authRoutes.js";
import { openDatabase } from "./db.js";
import { SessionStore } from "./sessions.js";

/** Testlerde parola özetleme hızlı olsun (üretimde 2^17). */
export const TEST_HASH_COST = 2 ** 10;

/**
 * İzole test uygulaması: bellek içi veritabanı + geçici fotoğraf klasörü.
 *  - `app`    → giriş yapmış kullanıcı gibi istek atar (çerez + CSRF başlığı otomatik)
 *  - `rawApp` → hiçbir şey eklemeyen gerçek uygulama (yetkisiz istek testleri için)
 */
export function createTestApp() {
  const photosDir = fs.mkdtempSync(path.join(os.tmpdir(), "memory-verse-test-"));
  const db = openDatabase(":memory:");
  const rawApp = buildApp(db, { photosDir, hashCost: TEST_HASH_COST, secureCookies: true });

  // Giriş akışını (yavaş özetleme) atlayıp doğrudan kullanıcı + oturum oluştur
  const { lastInsertRowid } = db
    .prepare("INSERT INTO users (username, display_name, password_hash) VALUES (?, ?, ?)")
    .run("tester", "Test Kullanıcısı", "kullanilmaz");
  const userId = Number(lastInsertRowid);
  const { token } = new SessionStore(db).create(userId, "test");
  const cookie = `${cookieNameFor(true)}=${token}`;

  const app = {
    inject: (opts: InjectOptions) =>
      rawApp.inject({ ...opts, headers: { cookie, [CSRF_HEADER]: "1", ...opts.headers } }),
  };

  return {
    app,
    rawApp,
    db,
    userId,
    cookie,
    photosDir,
    cleanup: () => fs.rmSync(photosDir, { recursive: true, force: true }),
  };
}