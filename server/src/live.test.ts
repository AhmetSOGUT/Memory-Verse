import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { buildApp } from "./app.js";
import { CSRF_HEADER, cookieNameFor } from "./authRoutes.js";
import { openDatabase } from "./db.js";
import type { LiveEvent } from "./live.js";
import { SessionStore } from "./sessions.js";
import { TEST_HASH_COST } from "./test-helpers.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function eventually(check: () => boolean, what: string, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (check()) return;
    await sleep(10);
  }
  assert.fail(`Zaman aşımı: ${what}`);
}

/** Gerçek bir SSE bağlantısını okur: olayları ve kalp atışlarını toplar. */
class SseClient {
  events: LiveEvent[] = [];
  pings = 0;
  closed = false;
  status = 0;
  private readonly abort = new AbortController();

  static async open(base: string, cookie: string | null): Promise<SseClient> {
    const client = new SseClient();
    const res = await fetch(`${base}/api/events`, {
      headers: cookie ? { cookie } : {},
      signal: client.abort.signal,
    });
    client.status = res.status;
    if (res.status === 200) void client.pump(res);
    return client;
  }

  private async pump(res: Response) {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          if (block.startsWith(": ping")) this.pings++;
          const data = block.split("\n").find((l) => l.startsWith("data: "));
          if (block.includes("event: memory") && data) this.events.push(JSON.parse(data.slice(6)) as LiveEvent);
        }
      }
    } catch {
      /* iptal edildi / bağlantı koptu */
    }
    this.closed = true;
  }

  close() {
    this.abort.abort();
  }
}

describe("canlı senkron (SSE) ve eşzamanlılık", () => {
  let tmp: string;
  let app: ReturnType<typeof buildApp>;
  let db: ReturnType<typeof openDatabase>;
  let base: string;
  let sessions: SessionStore;
  const clients: SseClient[] = [];

  const makeUser = (name: string, displayName: string) => {
    const { lastInsertRowid } = db
      .prepare("INSERT INTO users (username, display_name, password_hash) VALUES (?, ?, ?)")
      .run(name, displayName, "kullanilmaz");
    const { token } = sessions.create(Number(lastInsertRowid), "test");
    return { id: Number(lastInsertRowid), cookie: `${cookieNameFor(true)}=${token}` };
  };
  let ayse: { id: number; cookie: string };
  let ahmet: { id: number; cookie: string };

  const call = (who: { cookie: string }, method: "POST" | "PUT" | "DELETE", url: string, payload?: object) =>
    app.inject({ method, url, payload, headers: { cookie: who.cookie, [CSRF_HEADER]: "1" } });
  const connect = async (who: { cookie: string }) => {
    const c = await SseClient.open(base, who.cookie);
    clients.push(c);
    return c;
  };
  const memory = { date: "2026-10-08", title: "İlk buluşma", description: "Çok gizli açıklama" };

  async function start(live?: { heartbeatMs?: number; maxPerUser?: number }) {
    app = buildApp(db, { photosDir: path.join(tmp, "photos"), hashCost: TEST_HASH_COST, secureCookies: true, live });
    await app.listen({ host: "127.0.0.1", port: 0 });
    const addr = app.server.address();
    base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  }

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "memory-verse-live-"));
    db = openDatabase(":memory:");
    sessions = new SessionStore(db);
    ayse = makeUser("ayse", "Ayşe");
    ahmet = makeUser("ahmet", "Ahmet");
  });
  afterEach(async () => {
    for (const c of clients.splice(0)) c.close();
    await app.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("girişsiz bağlantıyı reddeder (401)", async () => {
    await start();
    const c = await SseClient.open(base, null);
    assert.equal(c.status, 401);
  });

  it("bir kişi anı ekleyince diğeri anında haberdar olur (içerik taşımadan)", async () => {
    await start();
    const watcher = await connect(ayse);
    await eventually(() => watcher.status === 200, "bağlantı açıldı");
    const res = await call(ahmet, "POST", "/api/memories", memory);
    assert.equal(res.statusCode, 201);
    const id = res.json().id as number;

    await eventually(() => watcher.events.length === 1, "oluşturma olayı geldi");
    assert.deepEqual(watcher.events[0], { action: "created", id, title: "İlk buluşma", by: "Ahmet", byId: ahmet.id });
    assert.equal(JSON.stringify(watcher.events[0]).includes("gizli"), false, "açıklama olaya girmemeli");
  });

  it("güncelleme, fotoğraf kaldırma ve silme de bildirilir; silinenin başlığı taşınır", async () => {
    await start();
    const id = (await call(ahmet, "POST", "/api/memories", memory)).json().id as number;
    const watcher = await connect(ayse);
    await eventually(() => watcher.status === 200, "bağlantı açıldı");

    await call(ahmet, "PUT", `/api/memories/${id}`, { ...memory, title: "Yeni başlık" });
    await call(ahmet, "DELETE", `/api/memories/${id}/photo`);
    await call(ahmet, "DELETE", `/api/memories/${id}`);

    await eventually(() => watcher.events.length === 3, "üç olay geldi");
    assert.deepEqual(watcher.events.map((e) => [e.action, e.title]), [
      ["updated", "Yeni başlık"], ["updated", "Yeni başlık"], ["deleted", "Yeni başlık"],
    ]);
  });

  it("başarısız istekler olay üretmez", async () => {
    await start();
    const watcher = await connect(ayse);
    await eventually(() => watcher.status === 200, "bağlantı açıldı");
    assert.equal((await call(ahmet, "POST", "/api/memories", { ...memory, title: "" })).statusCode, 400);
    assert.equal((await call(ahmet, "PUT", "/api/memories/999", memory)).statusCode, 404);
    assert.equal((await call(ahmet, "DELETE", "/api/memories/999")).statusCode, 404);
    await sleep(150);
    assert.equal(watcher.events.length, 0);
  });

  it("çıkış yapınca o oturumun akışı hemen kapanır, diğerininki açık kalır", async () => {
    await start();
    const a = await connect(ayse);
    const b = await connect(ahmet);
    await eventually(() => a.status === 200 && b.status === 200, "bağlantılar açıldı");
    const out = await app.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie: ayse.cookie, [CSRF_HEADER]: "1" } });
    assert.equal(out.statusCode, 204);
    await eventually(() => a.closed, "Ayşe'nin akışı kapandı");
    assert.equal(b.closed, false);
  });

  it("kalp atışı gelir; oturumu biten kullanıcının akışı kapanır", async () => {
    await start({ heartbeatMs: 40 });
    const a = await connect(ayse);
    const b = await connect(ahmet);
    await eventually(() => a.pings >= 2 && b.pings >= 2, "kalp atışları geldi");
    const row = db.prepare<[number], { id: number }>("SELECT id FROM sessions WHERE user_id = ?").get(ayse.id)!;
    db.prepare("DELETE FROM sessions WHERE id = ?").run(row.id); // örn. başka cihazdan parola değişti
    await eventually(() => a.closed, "oturumu biten akış kapandı");
    assert.equal(b.closed, false);
  });

  it("süresi dolmuş oturum kalp atışında kapanır, kalp atışı oturumu uzatmaz", async () => {
    await start({ heartbeatMs: 40 });
    const a = await connect(ayse);
    await eventually(() => a.pings >= 1, "bağlandı");
    const before = db.prepare<[number], { last_seen_at: number; expires_at: number }>(
      "SELECT last_seen_at, expires_at FROM sessions WHERE user_id = ?").get(ayse.id)!;
    await sleep(200);
    const after = db.prepare<[number], { last_seen_at: number; expires_at: number }>(
      "SELECT last_seen_at, expires_at FROM sessions WHERE user_id = ?").get(ayse.id)!;
    assert.deepEqual(after, before, "açık sekme oturum süresini uzatmamalı");
    db.prepare("UPDATE sessions SET expires_at = ? WHERE user_id = ?").run(Date.now() - 1000, ayse.id);
    await eventually(() => a.closed, "süresi dolan akış kapandı");
  });

  it("kullanıcı başına bağlantı sınırı: aşılırsa en eski kapanır", async () => {
    await start({ maxPerUser: 2 });
    const [c1, c2] = [await connect(ayse), await connect(ayse)];
    await eventually(() => c1.status === 200 && c2.status === 200, "ilk ikisi açıldı");
    const c3 = await connect(ayse);
    await eventually(() => c1.closed, "en eski kapandı");
    assert.equal(c2.closed, false);
    assert.equal(c3.closed, false);
  });

  it("sunucu açık bağlantılar varken de zamanında kapanır", async () => {
    await start();
    const a = await connect(ayse);
    await eventually(() => a.status === 200, "bağlandı");
    const closed = await Promise.race([app.close().then(() => true), sleep(3000).then(() => false)]);
    assert.equal(closed, true, "app.close() açık akışlar yüzünden takıldı");
    await eventually(() => a.closed, "istemci akışı kapandı");
    // afterEach tekrar close çağırır; Fastify bunu sorunsuz karşılar
  });

  describe("çakışma kontrolü (iki kişi aynı anıyı düzenlerse)", () => {
    it("form açıldığındaki sürüm eskiyse 409 döner ve güncel anıyı gösterir", async () => {
      await start();
      const created = (await call(ahmet, "POST", "/api/memories", memory)).json();
      const opened = created.updatedAt as string; // Ahmet formu bu sürümle açtı
      await sleep(5);
      const theirs = await call(ayse, "PUT", `/api/memories/${created.id}`, { ...memory, title: "Ayşe'nin başlığı", expectedUpdatedAt: opened });
      assert.equal(theirs.statusCode, 200); // Ayşe önce kaydetti
      await sleep(5);
      const mine = await call(ahmet, "PUT", `/api/memories/${created.id}`, { ...memory, title: "Ahmet'in başlığı", expectedUpdatedAt: opened });
      assert.equal(mine.statusCode, 409);
      assert.equal(mine.json().current.title, "Ayşe'nin başlığı");
      // 409'da hiçbir şey yazılmadı
      const list = (await call(ahmet, "PUT", `/api/memories/${created.id}`, { ...memory, title: "Ayşe'nin başlığı", expectedUpdatedAt: theirs.json().updatedAt })).json();
      assert.equal(list.title, "Ayşe'nin başlığı");
    });

    it("güncel sürümle ya da sürümsüz kaydetmek çalışır (bilerek üzerine yazma dahil)", async () => {
      await start();
      const created = (await call(ahmet, "POST", "/api/memories", memory)).json();
      const ok = await call(ahmet, "PUT", `/api/memories/${created.id}`, { ...memory, title: "A", expectedUpdatedAt: created.updatedAt });
      assert.equal(ok.statusCode, 200);
      await sleep(5);
      const noVersion = await call(ayse, "PUT", `/api/memories/${created.id}`, { ...memory, title: "B" });
      assert.equal(noVersion.statusCode, 200);
    });

    it("uydurma alanlar hâlâ reddedilir", async () => {
      await start();
      const created = (await call(ahmet, "POST", "/api/memories", memory)).json();
      const res = await call(ahmet, "PUT", `/api/memories/${created.id}`, { ...memory, hack: 1 });
      assert.equal(res.statusCode, 400);
    });
  });
});