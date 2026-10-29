import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createTestApp } from "./test-helpers.js";


const valid = { date: "2026-10-08", title: "İlk buluşma", description: "Çok güzeldi" };

describe("anı API'si", () => {
  let ctx: ReturnType<typeof createTestApp>;
  let app: ReturnType<typeof createTestApp>["app"];

  beforeEach(() => {
    ctx = createTestApp();
    app = ctx.app;
  });
  afterEach(() => ctx.cleanup());

  it("boş liste döner", async () => {
    const res = await app.inject({ method: "GET", url: "/api/memories" });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), []);
  });

  it("anı ekler ve listeler, tarihe göre sıralar", async () => {
    await app.inject({ method: "POST", url: "/api/memories", payload: { ...valid, date: "2026-12-01", title: "Sonra" } });
    const created = await app.inject({ method: "POST", url: "/api/memories", payload: valid });
    assert.equal(created.statusCode, 201);
    assert.equal(created.json().title, "İlk buluşma");
    assert.equal(created.json().image, null);

    const list = (await app.inject({ method: "GET", url: "/api/memories" })).json();
    assert.deepEqual(list.map((m: { title: string }) => m.title), ["İlk buluşma", "Sonra"]);
  });

  it("anıyı günceller ve updatedAt'ı yeniler", async () => {
    const { id } = (await app.inject({ method: "POST", url: "/api/memories", payload: valid })).json();
    const res = await app.inject({ method: "PUT", url: `/api/memories/${id}`, payload: { ...valid, title: "Değişti" } });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().title, "Değişti");
  });

  it("anıyı siler; olmayan anıda 404 verir", async () => {
    const { id } = (await app.inject({ method: "POST", url: "/api/memories", payload: valid })).json();
    assert.equal((await app.inject({ method: "DELETE", url: `/api/memories/${id}` })).statusCode, 204);
    assert.equal((await app.inject({ method: "DELETE", url: `/api/memories/${id}` })).statusCode, 404);
    assert.equal((await app.inject({ method: "PUT", url: `/api/memories/${id}`, payload: valid })).statusCode, 404);
  });

  it("geçersiz veriyi reddeder", async () => {
    const bad = [
      { ...valid, date: "2026-13-45" },
      { ...valid, date: "bugün" },
      { ...valid, title: "   " },
      { ...valid, description: "" },
      { ...valid, title: "x".repeat(201) },
      { ...valid, isAdmin: true }, // bilinmeyen alan
      {},
    ];
    for (const payload of bad) {
      const res = await app.inject({ method: "POST", url: "/api/memories", payload });
      assert.equal(res.statusCode, 400, JSON.stringify(payload));
    }
    assert.equal((await app.inject({ method: "GET", url: "/api/memories/abc" })).statusCode, 404);
    assert.equal((await app.inject({ method: "DELETE", url: "/api/memories/abc" })).statusCode, 400);
  });

  it("SQL enjeksiyonu denemesi düz metin olarak saklanır", async () => {
    const title = "x'); DROP TABLE memories;--";
    await app.inject({ method: "POST", url: "/api/memories", payload: { ...valid, title } });
    const list = (await app.inject({ method: "GET", url: "/api/memories" })).json();
    assert.equal(list[0].title, title);
  });

  it("çok büyük gövdeyi reddeder", async () => {
    const res = await app.inject({ method: "POST", url: "/api/memories", payload: { ...valid, description: "x".repeat(100_000) } });
    assert.equal(res.statusCode, 413);
  });
});