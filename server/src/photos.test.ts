import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import sharp from "sharp";
import { createTestApp } from "./test-helpers.js";

const valid = { date: "2026-10-08", title: "Fotoğraflı anı", description: "Çok güzeldi" };

/** Elle multipart gövdesi kurar (tek dosya alanı). */
function multipart(filename: string, contentType: string, data: Buffer) {
  const boundary = `----test${Math.random().toString(16).slice(2)}`;
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, data, tail]),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}

const jpeg = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 3, background: "#ff3366" } }).jpeg().toBuffer();

describe("fotoğraf API'si", () => {
  let ctx: ReturnType<typeof createTestApp>;
  let app: ReturnType<typeof createTestApp>["app"];
  let id: number;

  const files = () => fs.readdirSync(ctx.photosDir);
  const upload = (memoryId: number, name: string, type: string, data: Buffer) =>
    app.inject({ method: "PUT", url: `/api/memories/${memoryId}/photo`, ...multipart(name, type, data) });

  beforeEach(async () => {
    ctx = createTestApp();
    app = ctx.app;
    id = (await app.inject({ method: "POST", url: "/api/memories", payload: valid })).json().id;
  });
  afterEach(() => ctx.cleanup());

  it("fotoğrafı yeniden kodlamadan, yüklenen baytlarla saklar", async () => {
    const original = await jpeg(3000, 2000);
    const res = await upload(id, "tatil.jpg", "image/jpeg", original);
    assert.equal(res.statusCode, 200);
    const url: string = res.json().image;
    assert.match(url, /^\/api\/photos\/[a-f0-9]{32}\.jpg$/);

    const img = await app.inject({ method: "GET", url });
    assert.equal(img.statusCode, 200);
    assert.equal(img.headers["content-type"], "image/jpeg");
    assert.equal(img.headers["x-content-type-options"], "nosniff");
    assert.match(String(img.headers["cache-control"]), /private/);

    // Kalite kaybı yok: diskteki ve servis edilen dosya, yüklenenin birebir aynısı
    assert.deepEqual(img.rawPayload, original);

    const meta = await sharp(img.rawPayload).metadata();
    assert.equal(meta.format, "jpeg");
    assert.equal(meta.width, 3000); // küçültme yok
    assert.equal(meta.height, 2000);
  });

  it("PNG ve WebP'yi de olduğu gibi saklar, içerik türünü uzantıya göre verir", async () => {
    const png = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#00ff00" } })
      .png()
      .toBuffer();
    const pngRes = await upload(id, "x.png", "image/png", png);
    assert.match(pngRes.json().image, /\.png$/);
    const pngGet = await app.inject({ method: "GET", url: pngRes.json().image });
    assert.equal(pngGet.headers["content-type"], "image/png");
    assert.deepEqual(pngGet.rawPayload, png);

    const webp = await sharp({ create: { width: 40, height: 40, channels: 3, background: "#0000ff" } })
      .webp()
      .toBuffer();
    const webpRes = await upload(id, "y.webp", "image/webp", webp);
    assert.match(webpRes.json().image, /\.webp$/);
    const webpGet = await app.inject({ method: "GET", url: webpRes.json().image });
    assert.equal(webpGet.headers["content-type"], "image/webp");
    assert.deepEqual(webpGet.rawPayload, webp);
  });

  it("EXIF (yön/cihaz) verisini korur: dosyaya dokunulmaz", async () => {
    const withExif = await sharp({ create: { width: 200, height: 200, channels: 3, background: "#000" } })
      .jpeg()
      .withExif({ IFD0: { ImageDescription: "GIZLI-KONUM-41.01,28.97" } })
      .toBuffer();
    assert.ok(withExif.includes("GIZLI-KONUM"), "test görseli EXIF taşımalı");

    const res = await upload(id, "x.jpg", "image/jpeg", withExif);
    assert.equal(res.statusCode, 200);
    // Orijinal kalite istendiği için EXIF de olduğu gibi kalır (yeniden kodlama yok)
    const stored = fs.readFileSync(path.join(ctx.photosDir, files()[0]));
    assert.ok(stored.equals(withExif));
  });

  it("görsel olmayan dosyayı, uzantısı .jpg olsa bile reddeder", async () => {
    const res = await upload(id, "kotu.jpg", "image/jpeg", Buffer.from("bu bir resim degil, <script>alert(1)</script>"));
    assert.equal(res.statusCode, 400);
    assert.deepEqual(files(), []);
  });

  it("SVG'yi reddeder (betik taşıyabilir)", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>');
    const res = await upload(id, "x.svg", "image/svg+xml", svg);
    assert.equal(res.statusCode, 415);
    assert.deepEqual(files(), []);
  });

  it("25 MB'tan büyük dosyayı reddeder", async () => {
    const res = await upload(id, "dev.jpg", "image/jpeg", Buffer.alloc(26 * 1024 * 1024, 1));
    assert.equal(res.statusCode, 413);
    assert.deepEqual(files(), []);
  });

  it("çok büyük pikselli geçerli görseli de olduğu gibi saklar (küçültme yok)", async () => {
    const big = await sharp({ create: { width: 7000, height: 5000, channels: 3, background: "#000" } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    assert.ok(big.length < 25 * 1024 * 1024, "test görseli sınırın altında olmalı");
    const res = await upload(id, "buyuk.png", "image/png", big);
    assert.equal(res.statusCode, 200);
    const stored = fs.readFileSync(path.join(ctx.photosDir, files()[0]));
    assert.ok(stored.equals(big));
    const meta = await sharp(stored).metadata();
    assert.equal(meta.width, 7000);
    assert.equal(meta.height, 5000);
  });

  it("olmayan anıya yüklemede 404 verir ve dosya bırakmaz", async () => {
    const res = await upload(9999, "x.jpg", "image/jpeg", await jpeg(100, 100));
    assert.equal(res.statusCode, 404);
    assert.deepEqual(files(), []);
  });

  it("multipart olmayan istekte 500 değil, istemci hatası verir", async () => {
    const res = await app.inject({ method: "PUT", url: `/api/memories/${id}/photo`, payload: { a: 1 } });
    assert.ok(res.statusCode >= 400 && res.statusCode < 500, `durum: ${res.statusCode}`);
  });

  it("yol gezinmesi (path traversal) denemelerini reddeder", async () => {
    await upload(id, "x.jpg", "image/jpeg", await jpeg(50, 50));
    const attempts = [
      "/api/photos/..%2F..%2Fpackage.json",
      "/api/photos/..%5C..%5Cpackage.json",
      "/api/photos/%2e%2e%2fmemory-verse.sqlite",
      "/api/photos/" + "a".repeat(32) + ".webp", // geçerli biçim ama yok
      "/api/photos/" + "a".repeat(32) + ".webp%00.png",
      "/api/photos/x.jpg",
    ];
    for (const url of attempts) {
      const res = await app.inject({ method: "GET", url });
      assert.ok([400, 404].includes(res.statusCode), `${url} → ${res.statusCode}`);
      assert.notEqual(res.headers["content-type"], "image/webp", url);
    }
  });

  it("fotoğrafı değiştirince eskisini diskten siler", async () => {
    await upload(id, "bir.jpg", "image/jpeg", await jpeg(100, 100));
    const first = files();
    assert.equal(first.length, 1);
    await upload(id, "iki.jpg", "image/jpeg", await jpeg(120, 120));
    const second = files();
    assert.equal(second.length, 1);
    assert.notEqual(first[0], second[0]);
  });

  it("fotoğrafı kaldırınca ve anıyı silince dosyayı da siler", async () => {
    await upload(id, "bir.jpg", "image/jpeg", await jpeg(100, 100));
    const removed = await app.inject({ method: "DELETE", url: `/api/memories/${id}/photo` });
    assert.equal(removed.json().image, null);
    assert.deepEqual(files(), []);

    await upload(id, "iki.jpg", "image/jpeg", await jpeg(100, 100));
    assert.equal(files().length, 1);
    await app.inject({ method: "DELETE", url: `/api/memories/${id}` });
    assert.deepEqual(files(), []);
  });
});