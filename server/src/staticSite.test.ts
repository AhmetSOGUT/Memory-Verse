import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { buildApp } from "./app.js";
import { openDatabase } from "./db.js";
import { hostnameOf } from "./staticSite.js";
import { TEST_HASH_COST } from "./test-helpers.js";

describe("derlenmiş siteyi servis etme", () => {
  let tmp: string;
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "memory-verse-site-"));
    const web = path.join(tmp, "dist");
    fs.mkdirSync(path.join(web, "assets"), { recursive: true });
    fs.writeFileSync(path.join(web, "index.html"), "<!doctype html><title>MV</title>");
    fs.writeFileSync(path.join(web, "assets", "app-abc123.js"), "console.log(1)");
    fs.writeFileSync(path.join(web, ".gizli"), "gizli");
    fs.writeFileSync(path.join(tmp, "dis-dosya.txt"), "dist disinda");
    app = buildApp(openDatabase(":memory:"), {
      photosDir: path.join(tmp, "photos"),
      hashCost: TEST_HASH_COST,
      secureCookies: true,
      webRoot: web,
      allowedHosts: ["localhost", "pc.tail1234.ts.net"],
    });
    await app.ready();
  });
  afterEach(async () => {
    await app.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("giriş yapmadan siteyi verir (CSP ve güvenlik başlıklarıyla)", async () => {
    const res = await app.inject({ method: "GET", url: "/" });
    assert.equal(res.statusCode, 200);
    assert.match(res.headers["content-type"] as string, /text\/html/);
    assert.equal(res.headers["cache-control"], "no-cache");
    const csp = res.headers["content-security-policy"] as string;
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.doesNotMatch(csp, /unsafe-eval/);
    assert.match(res.headers["strict-transport-security"] as string, /max-age=/);
    assert.equal(res.headers["x-content-type-options"], "nosniff");
  });

  it("assets dosyaları uzun süre önbelleğe alınır", async () => {
    const res = await app.inject({ method: "GET", url: "/assets/app-abc123.js" });
    assert.equal(res.statusCode, 200);
    assert.match(res.headers["cache-control"] as string, /immutable/);
  });

  it("dosya olmayan sayfa yolları index.html'e düşer", async () => {
    const res = await app.inject({ method: "GET", url: "/baska/sayfa?x=1" });
    assert.equal(res.statusCode, 200);
    assert.match(res.body, /<title>MV<\/title>/);
  });

  it("olmayan dosya ve olmayan /api yolu gerçek 404 verir", async () => {
    assert.equal((await app.inject({ method: "GET", url: "/yok.js" })).statusCode, 404);
    const api = await app.inject({ method: "GET", url: "/api/yok" });
    assert.equal(api.statusCode, 404);
    assert.match(api.headers["content-type"] as string, /json/);
    assert.equal((await app.inject({ method: "POST", url: "/baska/sayfa" })).statusCode, 404);
  });

  it("API hâlâ giriş ister, health açık kalır", async () => {
    assert.equal((await app.inject({ method: "GET", url: "/api/memories" })).statusCode, 401);
    assert.equal((await app.inject({ method: "GET", url: "/api/photos/" + "a".repeat(32) + ".webp" })).statusCode, 401);
    assert.equal((await app.inject({ method: "GET", url: "/api/health" })).statusCode, 200);
  });

  it("dist dışına ve gizli dosyalara erişilmez", async () => {
    for (const url of ["/.gizli", "/..%2fdis-dosya.txt", "/%2e%2e/dis-dosya.txt", "/assets/..%2f..%2fdis-dosya.txt"]) {
      const res = await app.inject({ method: "GET", url });
      assert.notEqual(res.body, "dist disinda", url);
      assert.notEqual(res.body, "gizli", url);
    }
  });

  it("izin verilmeyen Host başlığını reddeder (DNS rebinding)", async () => {
    for (const host of ["evil.example.com", "evil.example.com:3001", "localhost.evil.com", "bozuk host"]) {
      const res = await app.inject({ method: "GET", url: "/", headers: { host } });
      assert.equal(res.statusCode, 421, `Host: "${host}"`);
    }
    const api = await app.inject({ method: "GET", url: "/api/health", headers: { host: "evil.example.com" } });
    assert.equal(api.statusCode, 421);
  });

  it("izinli Host adlarını kabul eder (port ve büyük harf fark etmez)", async () => {
    for (const host of ["localhost:3001", "PC.tail1234.ts.net", "pc.tail1234.ts.net:443"]) {
      assert.equal((await app.inject({ method: "GET", url: "/", headers: { host } })).statusCode, 200, host);
    }
  });
});

describe("hostnameOf", () => {
  it("alan adını ayıklar", () => {
    assert.equal(hostnameOf("Localhost:3001"), "localhost");
    assert.equal(hostnameOf("[::1]:3001"), "[::1]");
    assert.equal(hostnameOf("127.0.0.1"), "127.0.0.1");
    assert.equal(hostnameOf(undefined), null);
    assert.equal(hostnameOf("a b"), null);
    assert.equal(hostnameOf("evil.com/x"), null);
  });
});