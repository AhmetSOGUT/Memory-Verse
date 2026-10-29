import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import Database from "better-sqlite3";
import {
  BackupError, createBackup, encryptEntries, pruneBackups, restoreBackup, verifyBackup, type Entry,
} from "./backup.js";
import { openDatabase } from "./db.js";

const PASSWORD = "dogru-at-pil-mum-2026";
const FAST = 10; // testlerde hızlı scrypt (üretimde 17)
const sha = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");

describe("şifreli yedek", () => {
  let root: string, dataDir: string, photosDir: string, destDir: string, dbPath: string;
  const photos = new Map<string, Buffer>();

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "mv-backup-"));
    dataDir = path.join(root, "data");
    photosDir = path.join(dataDir, "photos");
    destDir = path.join(root, "drive");
    fs.mkdirSync(photosDir, { recursive: true });
    fs.mkdirSync(destDir);
    dbPath = path.join(dataDir, "memory-verse.sqlite");

    const db = openDatabase(dbPath);
    db.prepare("INSERT INTO users (username, display_name, password_hash) VALUES (?, ?, ?)").run("ahmet", "Ahmet", "x");
    db.prepare("INSERT INTO memories (date, title, description, created_by) VALUES (?, ?, ?, 1)").run("2026-10-08", "İlk buluşma ğüşıöç", "Çok güzeldi");
    db.close();

    photos.clear();
    photos.set(`${randomBytes(16).toString("hex")}.webp`, randomBytes(3 * 1024 * 1024 + 123)); // ~3 MB: parçalı okumayı dener
    photos.set(`${randomBytes(16).toString("hex")}.webp`, randomBytes(1000));
    for (const [name, buf] of photos) fs.writeFileSync(path.join(photosDir, name), buf);
    fs.writeFileSync(path.join(photosDir, "yabanci.txt"), "yedeğe girmemeli");
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  const backup = (extra: object = {}) =>
    createBackup({ dbPath, photosDir, destDir, password: PASSWORD, log2N: FAST, ...extra });

  it("yedek alır, doğrular ve birebir geri yükler", async () => {
    const result = await backup();
    assert.match(path.basename(result.file), /^memory-verse-\d{4}-\d{2}-\d{2}_\d{6}\.mvbak$/);
    assert.equal(result.summary.photos, 2);
    assert.deepEqual(fs.readdirSync(destDir), [path.basename(result.file)]); // .partial kalmadı

    const into = path.join(root, "restored");
    const summary = await restoreBackup({ file: result.file, password: PASSWORD, intoDir: into });
    assert.equal(summary.photos, 2);

    const db = new Database(path.join(into, "memory-verse.sqlite"), { readonly: true });
    const row = db.prepare("SELECT title, description FROM memories").get() as { title: string; description: string };
    db.close();
    assert.equal(row.title, "İlk buluşma ğüşıöç");
    for (const [name, buf] of photos) {
      assert.equal(sha(fs.readFileSync(path.join(into, "photos", name))), sha(buf), name);
    }
    assert.deepEqual(fs.readdirSync(path.join(into, "photos")).sort(), [...photos.keys()].sort());
  });

  it("yedek dosyası düz metin içermez (şifreli)", async () => {
    const { file } = await backup();
    const raw = fs.readFileSync(file);
    assert.equal(raw.includes(Buffer.from("İlk buluşma")), false);
    assert.equal(raw.includes(Buffer.from("SQLite format 3")), false);
    assert.equal(raw.includes(photos.values().next().value!.subarray(0, 64)), false);
  });

  it("yanlış parolayı reddeder ve hedefte hiçbir şey bırakmaz", async () => {
    const { file } = await backup();
    const into = path.join(root, "restored");
    await assert.rejects(
      restoreBackup({ file, password: "yanlis-parola-1234", intoDir: into }),
      (e: Error) => e instanceof BackupError && /Parola yanlış/.test(e.message),
    );
    assert.equal(fs.existsSync(into), false);
    assert.deepEqual(fs.readdirSync(root).filter((n) => n.includes(".tmp-")), []);
  });

  it("değiştirilmiş (bozulmuş) dosyayı reddeder", async () => {
    const { file } = await backup();
    const original = fs.readFileSync(file);
    for (const pos of [10, 20, 100, Math.floor(original.length / 2), original.length - 5]) {
      const bad = Buffer.from(original);
      bad[pos] = bad[pos]! ^ 0xff; // başlık (N, tuz), içerik ve etiket
      const badFile = path.join(root, `bad-${pos}.mvbak`);
      fs.writeFileSync(badFile, bad);
      await assert.rejects(verifyBackup(badFile, PASSWORD, root), BackupError, `bayt ${pos}`);
    }
  });

  it("kırpılmış dosyayı reddeder", async () => {
    const { file } = await backup();
    const original = fs.readFileSync(file);
    const cut = path.join(root, "cut.mvbak");
    fs.writeFileSync(cut, original.subarray(0, original.length - 1000));
    await assert.rejects(verifyBackup(cut, PASSWORD, root), BackupError);
    fs.writeFileSync(cut, original.subarray(0, 20));
    await assert.rejects(verifyBackup(cut, PASSWORD, root), BackupError);
    fs.writeFileSync(cut, "bu bir yedek dosyası değil, sadece metin ".repeat(5));
    await assert.rejects(verifyBackup(cut, PASSWORD, root), BackupError);
  });

  it("dolu hedef klasörün üzerine yazmaz", async () => {
    const { file } = await backup();
    const into = path.join(root, "restored");
    fs.mkdirSync(into);
    fs.writeFileSync(path.join(into, "onemli.txt"), "dokunma");
    await assert.rejects(restoreBackup({ file, password: PASSWORD, intoDir: into }), /boş değil/);
    assert.equal(fs.readFileSync(path.join(into, "onemli.txt"), "utf8"), "dokunma");
  });

  it("kötü niyetli dosya adlarını geri yüklemede reddeder (yol gezinmesi vb.)", async () => {
    const make = (names: string[]): AsyncIterable<Entry> =>
      (async function* () {
        yield { name: "memory-verse.sqlite", size: fs.statSync(dbPath).size, data: () => fs.createReadStream(dbPath) };
        for (const name of names) yield { name, size: 4, data: async function* () { yield Buffer.from("evil"); } };
      })();
    const cases: string[][] = [
      ["../evil.txt"], ["photos/../../evil.webp"], ["/etc/passwd"], ["photos/abc.webp"],
      ["C:\\evil.txt"], ["photos/" + "a".repeat(32) + ".webp", "photos/" + "a".repeat(32) + ".webp"],
    ];
    for (const names of cases) {
      const file = path.join(root, `evil-${cases.indexOf(names)}.mvbak`);
      await encryptEntries(file, PASSWORD, make(names), FAST);
      const into = path.join(root, `into-${cases.indexOf(names)}`);
      await assert.rejects(restoreBackup({ file, password: PASSWORD, intoDir: into }), BackupError, names.join(","));
      assert.equal(fs.existsSync(into), false);
      assert.equal(fs.existsSync(path.join(root, "evil.txt")), false);
    }
  });

  it("kısa parolayı ve var olan yedeğin üzerine yazmayı reddeder", async () => {
    await assert.rejects(backup({ password: "kisa" }), /en az 12/);
    const now = new Date(2026, 9, 29, 12, 0, 0);
    await backup({ now });
    await assert.rejects(backup({ now }), /zaten var/);
  });

  it("olmayan hedef klasörde hata verir (Drive bağlı değilse yanlış yere yazmaz)", async () => {
    await assert.rejects(backup({ destDir: path.join(root, "yok", "klasor") }), /Hedef klasör bulunamadı/);
    assert.equal(fs.existsSync(path.join(root, "yok")), false);
  });

  it("sunucu veritabanı açıkken de tutarlı yedek alır", async () => {
    const live = openDatabase(dbPath); // sunucu gibi açık tut
    live.prepare("INSERT INTO memories (date, title, description, created_by) VALUES (?, ?, ?, 1)").run("2026-11-01", "Yedek sırasında", "x");
    const { file } = await backup();
    const into = path.join(root, "restored");
    await restoreBackup({ file, password: PASSWORD, intoDir: into });
    live.close();
    const db = new Database(path.join(into, "memory-verse.sqlite"), { readonly: true });
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM memories").get() as { n: number }).n, 2);
    db.close();
  });

  it("geçici dosya bırakmaz", async () => {
    await backup();
    assert.deepEqual(fs.readdirSync(dataDir).filter((n) => n.startsWith(".backup-")), []);
  });

  it("yalnızca en yeni N yedeği tutar, yabancı dosyalara dokunmaz", () => {
    for (const d of ["01", "02", "03", "04"]) fs.writeFileSync(path.join(destDir, `memory-verse-2026-10-${d}_120000.mvbak`), "x");
    fs.writeFileSync(path.join(destDir, "benim-dosyam.txt"), "x");
    const pruned = pruneBackups(destDir, 2);
    assert.deepEqual(pruned, ["memory-verse-2026-10-01_120000.mvbak", "memory-verse-2026-10-02_120000.mvbak"]);
    assert.deepEqual(fs.readdirSync(destDir).sort(), [
      "benim-dosyam.txt", "memory-verse-2026-10-03_120000.mvbak", "memory-verse-2026-10-04_120000.mvbak",
    ]);
    assert.throws(() => pruneBackups(destDir, 0), BackupError);
  });
});