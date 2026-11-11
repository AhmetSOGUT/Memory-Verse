import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import sharp from "sharp";
import { createTestApp } from "./test-helpers.js";

const valid = { date: "2026-10-08", title: "Fotoğraflı anı", description: "Çok güzeldi" };

interface Part {
  filename: string;
  type: string;
  data: Buffer;
}

/** Elle multipart gövdesi kurar (birden fazla dosya alanı). */
function multipart(files: Part[]) {
  const boundary = `----test${Math.random().toString(16).slice(2)}`;
  const parts: Buffer[] = [];
  for (const f of files) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${f.filename}"\r\nContent-Type: ${f.type}\r\n\r\n`,
      ),
      f.data,
      Buffer.from("\r\n"),
    );
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    payload: Buffer.concat(parts),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}

const jpeg = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 3, background: "#ff3366" } }).jpeg().toBuffer();

const nameOf = (url: string) => url.slice(url.lastIndexOf("/") + 1);

describe("fotoğraf API'si", () => {
  let ctx: ReturnType<typeof createTestApp>;
  let app: ReturnType<typeof createTestApp>["app"];
  let id: number;

  const files = () => fs.readdirSync(ctx.photosDir);
  const upload = (memoryId: number, parts: Part[]) =>
    app.inject({ method: "POST", url: `/api/memories/${memoryId}/photos`, ...multipart(parts) });

  beforeEach(async () => {
    ctx = createTestApp();
    app = ctx.app;
    id = (await app.inject({ method: "POST", url: "/api/memories", payload: valid })).json().id;
  });
  afterEach(() => ctx.cleanup());

  it("fotoğrafı yeniden kodlamadan, yüklenen baytlarla saklar", async () => {
    const original = await jpeg(3000, 2000);
    const res = await upload(id, [{ filename: "tatil.jpg", type: "image/jpeg", data: original }]);
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.images.length, 1);
    assert.match(body.images[0], /^\/api\/photos\/[a-f0-9]{32}\.jpg$/);
    assert.equal(body.image, body.images[0]); // kapak = ilk fotoğraf

    const img = await app.inject({ method: "GET", url: body.images[0] });
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

  it("tek istekte birden fazla fotoğrafı sırayla ekler", async () => {
    const a = await jpeg(40, 40);
    const b = await jpeg(60, 60);
    const c = await jpeg(80, 80);
    const res = await upload(id, [
      { filename: "a.jpg", type: "image/jpeg", data: a },
      { filename: "b.jpg", type: "image/jpeg", data: b },
      { filename: "c.jpg", type: "image/jpeg", data: c },
    ]);
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.images.length, 3);
    assert.equal(body.image, body.images[0]);

    const stored = files().sort();
    assert.equal(stored.length, 3);
    const served = await Promise.all(body.images.map((url: string) => app.inject({ method: "GET", url })));
    assert.deepEqual(served.map((r) => r.rawPayload), [a, b, c]);
  });

  it("silinen fotoğrafın dosyasını ve satırını kaldırır, kapağı kaydırır", async () => {
    const a = await jpeg(30, 30);
    const b = await jpeg(50, 50);
    const created = (await upload(id, [
      { filename: "a.jpg", type: "image/jpeg", data: a },
      { filename: "b.jpg", type: "image/jpeg", data: b },
    ])).json();

    const first = nameOf(created.images[0]);
    const res = await app.inject({ method: "DELETE", url: `/api/memories/${id}/photos/${first}` });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.images.length, 1);
    assert.equal(body.image, body.images[0]);
    assert.deepEqual(files(), [nameOf(body.images[0])]);

    // Olmayan fotoğrafı silmek 404
    assert.equal((await app.inject({ method: "DELETE", url: `/api/memories/${id}/photos/${first}` })).statusCode, 404);
  });

  it("fotoğraf sırasını değiştirir; ilk sıradaki kapak olur", async () => {
    const created = (await upload(id, [
      { filename: "a.jpg", type: "image/jpeg", data: await jpeg(30, 30) },
      { filename: "b.jpg", type: "image/jpeg", data: await jpeg(50, 50) },
      { filename: "c.jpg", type: "image/jpeg", data: await jpeg(70, 70) },
    ])).json();
    const [first, second, third] = created.images.map(nameOf);

    const res = await app.inject({
      method: "PUT",
      url: `/api/memories/${id}/photos/order`,
      payload: { names: [third, first, second] },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.deepEqual(body.images.map(nameOf), [third, first, second]);
    assert.equal(body.image, `/api/photos/${third}`);
  });

  it("güncel listeyle uyuşmayan sıra isteğini reddeder", async () => {
    const created = (await upload(id, [
      { filename: "a.jpg", type: "image/jpeg", data: await jpeg(30, 30) },
      { filename: "b.jpg", type: "image/jpeg", data: await jpeg(50, 50) },
    ])).json();
    const [first] = created.images.map(nameOf);

    for (const names of [[first], [first, first], [first, "a".repeat(32) + ".jpg"]]) {
      const res = await app.inject({ method: "PUT", url: `/api/memories/${id}/photos/order`, payload: { names } });
      assert.equal(res.statusCode, 400, JSON.stringify(names));
    }
  });

  it("bir anıya en fazla 12 fotoğraf eklenir", async () => {
    const many = await Promise.all(Array.from({ length: 13 }, (_, i) => jpeg(10 + i, 10 + i)));
    const res = await upload(id, many.map((data, i) => ({ filename: `${i}.jpg`, type: "image/jpeg", data })));
    assert.equal(res.statusCode, 400);
    assert.deepEqual(files(), []); // yarım kalan dosya bırakılmaz

    const ok = await upload(id, many.slice(0, 12).map((data, i) => ({ filename: `${i}.jpg`, type: "image/jpeg", data })));
    assert.equal(ok.statusCode, 200);
    const oneMore = await upload(id, [{ filename: "fazla.jpg", type: "image/jpeg", data: many[12] }]);
    assert.equal(oneMore.statusCode, 400);
    assert.equal(files().length, 12);
  });

  it("görsel olmayan dosyayı, uzantısı .jpg olsa bile reddeder", async () => {
    const res = await upload(id, [
      { filename: "kotu.jpg", type: "image/jpeg", data: Buffer.from("bu bir resim degil, <script>alert(1)</script>") },
    ]);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(files(), []);
  });

  it("SVG'yi reddeder (betik taşıyabilir)", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>');
    const res = await upload(id, [{ filename: "x.svg", type: "image/svg+xml", data: svg }]);
    assert.equal(res.statusCode, 415);
    assert.deepEqual(files(), []);
  });

  it("25 MB'tan büyük dosyayı reddeder", async () => {
    const res = await upload(id, [{ filename: "dev.jpg", type: "image/jpeg", data: Buffer.alloc(26 * 1024 * 1024, 1) }]);
    assert.equal(res.statusCode, 413);
    assert.deepEqual(files(), []);
  });

  it("çok büyük pikselli geçerli görseli de olduğu gibi saklar (küçültme yok)", async () => {
    const big = await sharp({ create: { width: 7000, height: 5000, channels: 3, background: "#000" } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    assert.ok(big.length < 25 * 1024 * 1024, "test görseli sınırın altında olmalı");
    const res = await upload(id, [{ filename: "buyuk.png", type: "image/png", data: big }]);
    assert.equal(res.statusCode, 200);
    const stored = fs.readFileSync(path.join(ctx.photosDir, files()[0]));
    assert.ok(stored.equals(big));
    const meta = await sharp(stored).metadata();
    assert.equal(meta.width, 7000);
    assert.equal(meta.height, 5000);
  });

  it("olmayan anıya yüklemede 404 verir ve dosya bırakmaz", async () => {
    const res = await upload(9999, [{ filename: "x.jpg", type: "image/jpeg", data: await jpeg(100, 100) }]);
    assert.equal(res.statusCode, 404);
    assert.deepEqual(files(), []);
  });

  it("multipart olmayan istekte 500 değil, istemci hatası verir", async () => {
    const res = await app.inject({ method: "POST", url: `/api/memories/${id}/photos`, payload: { a: 1 } });
    assert.ok(res.statusCode >= 400 && res.statusCode < 500, `durum: ${res.statusCode}`);
  });

  it("yol gezinmesi (path traversal) denemelerini reddeder", async () => {
    await upload(id, [{ filename: "x.jpg", type: "image/jpeg", data: await jpeg(50, 50) }]);
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

  it("fotoğrafı kaldırınca ve anıyı silince dosyaları da siler", async () => {
    const created = (await upload(id, [
      { filename: "a.jpg", type: "image/jpeg", data: await jpeg(30, 30) },
      { filename: "b.jpg", type: "image/jpeg", data: await jpeg(50, 50) },
    ])).json();
    assert.equal(files().length, 2);

    await app.inject({ method: "DELETE", url: `/api/memories/${id}/photos/${nameOf(created.images[1])}` });
    assert.equal(files().length, 1);

    await app.inject({ method: "DELETE", url: `/api/memories/${id}` });
    assert.deepEqual(files(), []);
  });

  it("listeleme bütün fotoğrafları kapak sırasıyla döndürür", async () => {
    await upload(id, [
      { filename: "a.jpg", type: "image/jpeg", data: await jpeg(30, 30) },
      { filename: "b.jpg", type: "image/jpeg", data: await jpeg(50, 50) },
    ]);
    const listed = (await app.inject({ method: "GET", url: "/api/memories" })).json();
    const memory = listed.find((m: { id: number }) => m.id === id);
    assert.equal(memory.images.length, 2);
    assert.equal(memory.image, memory.images[0]);
  });
});
