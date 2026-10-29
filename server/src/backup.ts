import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

/**
 * Şifreli yedek (.mvbak): veritabanı + fotoğraflar tek dosyada.
 *
 * Dosya biçimi:
 *   [40 bayt başlık: sihirli sayı, scrypt parametreleri, tuz, IV]  ← AAD olarak kimlik doğrulamaya dahil
 *   [AES-256-GCM ile şifreli akış]                                 ← içinde: { ad, boyut, veri }* + manifest + bitiş işareti
 *   [16 bayt GCM etiketi]
 * Anahtar: parola → scrypt (N=2^17, r=8, p=1). GCM etiketi dosyanın SONUNDA doğrulanır;
 * bu yüzden geri yükleme geçici klasöre yazar ve yalnızca doğrulama geçerse yerine koyar.
 */

export const BACKUP_PASSWORD_MIN = 12;
export const DEFAULT_LOG2N = 17;
const MAGIC = Buffer.from("MVBAK1\0\0", "latin1");
const HEADER_LEN = 40;
const TAG_LEN = 16;
const DB_NAME = "memory-verse.sqlite";
const MANIFEST_NAME = "manifest.json";
const MANIFEST_MAX = 16 * 1024 * 1024;
const PHOTO_FILE = /^[a-f0-9]{32}\.webp$/;
const PHOTO_ENTRY = /^photos\/[a-f0-9]{32}\.webp$/;
const BACKUP_FILE = /^memory-verse-\d{4}-\d{2}-\d{2}_\d{6}\.mvbak$/;

export class BackupError extends Error {}

export interface Entry {
  name: string;
  size: number;
  data: () => AsyncIterable<Buffer>;
}
interface ManifestFile { name: string; size: number; sha256: string }
interface Manifest { version: 1; createdAt: string; files: ManifestFile[] }

export interface BackupSummary { files: number; photos: number; bytes: number; createdAt: string }

function checkPassword(password: string) {
  if ([...password].length < BACKUP_PASSWORD_MIN) {
    throw new BackupError(`Yedek parolası en az ${BACKUP_PASSWORD_MIN} karakter olmalı`);
  }
}

function deriveKey(password: string, salt: Buffer, log2N: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"), salt, 32,
      { N: 2 ** log2N, r, p, maxmem: 512 * 1024 * 1024 },
      (err, key) => (err ? reject(err) : resolve(key)),
    );
  });
}

function write(stream: fs.WriteStream, buf: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    if (buf.length === 0) return resolve();
    stream.write(buf, (err) => (err ? reject(err) : resolve()));
  });
}

function endStream(stream: fs.WriteStream): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.once("error", reject);
    stream.end(() => resolve());
  });
}

// ─── Yazma ────────────────────────────────────────────────────────────────────

/** Girdileri (+ manifest) şifreleyip `file`'a yazar. Dosya zaten varsa hata verir (üzerine yazmaz). */
export async function encryptEntries(
  file: string, password: string, entries: AsyncIterable<Entry>, log2N = DEFAULT_LOG2N,
): Promise<void> {
  checkPassword(password);
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const header = Buffer.alloc(HEADER_LEN);
  MAGIC.copy(header, 0);
  header[8] = log2N; header[9] = 8; header[10] = 1; header[11] = 0;
  salt.copy(header, 12);
  iv.copy(header, 28);

  const key = await deriveKey(password, salt, log2N, 8, 1);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(header);
  const out = fs.createWriteStream(file, { flags: "wx", mode: 0o600 });
  out.on("error", () => {}); // hata aşağıdaki write/endStream çağrılarında yakalanır
  const enc = (buf: Buffer) => write(out, cipher.update(buf));

  try {
    await write(out, header);
    const files: ManifestFile[] = [];
    for await (const entry of entries) {
      const nameBuf = Buffer.from(entry.name, "utf8");
      if (nameBuf.length === 0 || nameBuf.length > 255) throw new BackupError("Geçersiz dosya adı uzunluğu");
      const head = Buffer.alloc(2 + nameBuf.length + 8);
      head.writeUInt16BE(nameBuf.length, 0);
      nameBuf.copy(head, 2);
      head.writeBigUInt64BE(BigInt(entry.size), 2 + nameBuf.length);
      await enc(head);

      const hash = createHash("sha256");
      let written = 0;
      for await (const chunk of entry.data()) {
        hash.update(chunk);
        written += chunk.length;
        await enc(chunk);
      }
      if (written !== entry.size) throw new BackupError(`${entry.name}: yedeklenirken değişti, tekrar dene`);
      files.push({ name: entry.name, size: entry.size, sha256: hash.digest("hex") });
    }

    const manifest: Manifest = { version: 1, createdAt: new Date().toISOString(), files };
    const manifestBuf = Buffer.from(JSON.stringify(manifest), "utf8");
    const nameBuf = Buffer.from(MANIFEST_NAME, "utf8");
    const head = Buffer.alloc(2 + nameBuf.length + 8);
    head.writeUInt16BE(nameBuf.length, 0);
    nameBuf.copy(head, 2);
    head.writeBigUInt64BE(BigInt(manifestBuf.length), 2 + nameBuf.length);
    await enc(head);
    await enc(manifestBuf);
    await enc(Buffer.alloc(2)); // bitiş işareti (ad uzunluğu 0)

    await write(out, cipher.final());
    await write(out, cipher.getAuthTag());
    await endStream(out);
  } catch (err) {
    out.destroy();
    await fsp.rm(file, { force: true });
    throw err;
  }
}

function localStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function assertIntegrity(dbFile: string) {
  const db = new Database(dbFile, { readonly: true, fileMustExist: true });
  try {
    const result = db.pragma("integrity_check", { simple: true });
    if (result !== "ok") throw new BackupError(`Veritabanı bütünlük kontrolü başarısız: ${String(result)}`);
  } finally {
    db.close();
  }
}

export interface CreateOptions {
  dbPath: string;
  photosDir: string;
  destDir: string;
  password: string;
  keep?: number;
  log2N?: number;
  now?: Date;
}
export interface CreateResult { file: string; bytes: number; summary: BackupSummary; pruned: string[] }

/** Sunucu çalışırken de güvenlidir: veritabanı SQLite'ın yedekleme API'siyle tutarlı kopyalanır. */
export async function createBackup(opts: CreateOptions): Promise<CreateResult> {
  const { dbPath, photosDir, destDir, password } = opts;
  checkPassword(password);
  if (!fs.existsSync(destDir) || !fs.statSync(destDir).isDirectory()) {
    throw new BackupError(`Hedef klasör bulunamadı: ${destDir}`);
  }
  const final = path.join(destDir, `memory-verse-${localStamp(opts.now ?? new Date())}.mvbak`);
  const partial = `${final}.partial`;
  if (fs.existsSync(final) || fs.existsSync(partial)) throw new BackupError(`Bu yedek zaten var: ${final}`);

  const workDir = path.join(path.dirname(dbPath), `.backup-tmp-${randomBytes(4).toString("hex")}`);
  fs.mkdirSync(workDir, { recursive: true });
  try {
    const snapshot = path.join(workDir, DB_NAME);
    const source = new Database(dbPath, { readonly: true, fileMustExist: true });
    try {
      await source.backup(snapshot);
    } finally {
      source.close();
    }
    assertIntegrity(snapshot);

    const photoNames = fs.existsSync(photosDir)
      ? fs.readdirSync(photosDir).filter((n) => PHOTO_FILE.test(n)).sort()
      : [];

    async function* entries(): AsyncGenerator<Entry> {
      yield { name: DB_NAME, size: fs.statSync(snapshot).size, data: () => fs.createReadStream(snapshot, { highWaterMark: 1 << 20 }) };
      for (const name of photoNames) {
        const file = path.join(photosDir, name);
        let size: number;
        try {
          size = fs.statSync(file).size;
        } catch {
          continue; // yedek sırasında silinmiş fotoğraf
        }
        yield { name: `photos/${name}`, size, data: () => fs.createReadStream(file, { highWaterMark: 1 << 20 }) };
      }
    }

    await encryptEntries(partial, password, entries(), opts.log2N ?? DEFAULT_LOG2N);
    // Yazılan dosyanın şifresini gerçekten açıp doğrula: doğrulanmayan yedek yedek sayılmaz
    const summary = await verifyBackup(partial, password, workDir);
    await fsp.rename(partial, final);
    const pruned = pruneBackups(destDir, opts.keep ?? 10);
    return { file: final, bytes: fs.statSync(final).size, summary, pruned };
  } catch (err) {
    await fsp.rm(partial, { force: true });
    throw err;
  } finally {
    await fsp.rm(workDir, { recursive: true, force: true });
  }
}

/** En yeni `keep` yedeği tutar, eskilerini siler. Yalnızca bu programın adlandırdığı dosyalara dokunur. */
export function pruneBackups(destDir: string, keep: number): string[] {
  if (!Number.isInteger(keep) || keep < 1) throw new BackupError("keep en az 1 olmalı");
  const names = fs.readdirSync(destDir).filter((n) => BACKUP_FILE.test(n)).sort();
  const old = names.slice(0, Math.max(0, names.length - keep));
  for (const name of old) fs.rmSync(path.join(destDir, name), { force: true });
  return old;
}

// ─── Okuma ────────────────────────────────────────────────────────────────────

async function* decryptChunks(file: string, password: string): AsyncGenerator<Buffer> {
  const fh = await fsp.open(file, "r");
  let header: Buffer, tag: Buffer, size: number;
  try {
    size = (await fh.stat()).size;
    if (size <= HEADER_LEN + TAG_LEN) throw new BackupError("Bu bir yedek dosyası değil ya da eksik/bozuk");
    header = Buffer.alloc(HEADER_LEN);
    tag = Buffer.alloc(TAG_LEN);
    await fh.read(header, 0, HEADER_LEN, 0);
    await fh.read(tag, 0, TAG_LEN, size - TAG_LEN);
  } finally {
    await fh.close();
  }
  if (!header.subarray(0, 8).equals(MAGIC)) throw new BackupError("Bu bir Memory Verse yedek dosyası değil");
  const log2N = header[8]!, r = header[9]!, p = header[10]!;
  if (log2N < 10 || log2N > 18 || r !== 8 || p !== 1) throw new BackupError("Yedek dosyasının başlığı geçersiz");

  const key = await deriveKey(password, header.subarray(12, 28), log2N, r, p);
  const decipher = createDecipheriv("aes-256-gcm", key, header.subarray(28, 40));
  decipher.setAAD(header);
  decipher.setAuthTag(tag);

  const stream = fs.createReadStream(file, { start: HEADER_LEN, end: size - TAG_LEN - 1, highWaterMark: 1 << 20 });
  for await (const chunk of stream) {
    const plain = decipher.update(chunk as Buffer);
    if (plain.length) yield plain;
  }
  let last: Buffer;
  try {
    last = decipher.final(); // etiket burada doğrulanır
  } catch {
    throw new BackupError("Parola yanlış ya da dosya bozulmuş/değiştirilmiş");
  }
  if (last.length) yield last;
}

class ByteReader {
  private buf: Buffer = Buffer.alloc(0);
  private done = false;
  constructor(private readonly it: AsyncIterator<Buffer>) {}

  private async pull(): Promise<boolean> {
    if (this.done) return false;
    const r = await this.it.next();
    if (r.done) { this.done = true; return false; }
    this.buf = this.buf.length ? Buffer.concat([this.buf, r.value]) : r.value;
    return true;
  }
  async exact(n: number): Promise<Buffer> {
    while (this.buf.length < n) {
      if (!(await this.pull())) throw new BackupError("Yedek dosyası eksik");
    }
    const out = this.buf.subarray(0, n);
    this.buf = this.buf.subarray(n);
    return out;
  }
  async streamTo(n: number, sink: (chunk: Buffer) => Promise<void>): Promise<void> {
    let left = n;
    while (left > 0) {
      if (this.buf.length === 0 && !(await this.pull())) throw new BackupError("Yedek dosyası eksik");
      const take = Math.min(left, this.buf.length);
      const piece = this.buf.subarray(0, take);
      this.buf = this.buf.subarray(take);
      left -= take;
      await sink(piece);
    }
  }
  /** Akışı sonuna kadar tüketir (GCM etiketi bu sırada doğrulanır). Fazladan veri varsa hata verir. */
  async finish(): Promise<void> {
    while (await this.pull()) { /* tüket */ }
    if (this.buf.length > 0) throw new BackupError("Yedek dosyasında beklenmeyen fazladan veri var");
  }
  async discardAll(): Promise<void> {
    while (await this.pull()) this.buf = Buffer.alloc(0);
  }
}

/** Şifreyi açıp `tmpDir` içine çıkarır; tüm doğrulamalar geçmeden hiçbir şey kalıcı sayılmaz. */
async function extract(file: string, password: string, tmpDir: string): Promise<BackupSummary> {
  const reader = new ByteReader(decryptChunks(file, password));
  const seen = new Map<string, ManifestFile>();
  let manifest: Manifest | null = null;
  fs.mkdirSync(path.join(tmpDir, "photos"), { recursive: true });

  try {
    for (;;) {
      const nameLen = (await reader.exact(2)).readUInt16BE(0);
      if (nameLen === 0) break;
      const name = (await reader.exact(nameLen)).toString("utf8");
      const sizeBig = (await reader.exact(8)).readBigUInt64BE(0);
      if (sizeBig > BigInt(Number.MAX_SAFE_INTEGER)) throw new BackupError("Geçersiz dosya boyutu");
      const size = Number(sizeBig);
      if (manifest) throw new BackupError("Manifestten sonra veri var");

      if (name === MANIFEST_NAME) {
        if (size > MANIFEST_MAX) throw new BackupError("Manifest çok büyük");
        manifest = JSON.parse((await reader.exact(size)).toString("utf8")) as Manifest;
        continue;
      }
      if (name !== DB_NAME && !PHOTO_ENTRY.test(name)) throw new BackupError("Yedekte izin verilmeyen bir dosya adı var");
      if (seen.has(name)) throw new BackupError("Yedekte yinelenen dosya var");

      const out = fs.createWriteStream(path.join(tmpDir, name), { flags: "wx" });
      out.on("error", () => {});
      const hash = createHash("sha256");
      try {
        await reader.streamTo(size, async (chunk) => { hash.update(chunk); await write(out, chunk); });
        await endStream(out);
      } catch (err) {
        out.destroy();
        throw err;
      }
      seen.set(name, { name, size, sha256: hash.digest("hex") });
    }
  } catch (parseErr) {
    // Yanlış parola/bozuk dosyada asıl nedeni göster: etiket doğrulaması başarısızsa o hatayı ver
    try { await reader.discardAll(); } catch (authErr) { throw authErr; }
    throw parseErr;
  }

  await reader.finish(); // GCM etiketi doğrulandı: buradan sonrası güvenilir
  if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.files)) throw new BackupError("Manifest eksik veya geçersiz");
  if (!seen.has(DB_NAME)) throw new BackupError("Yedekte veritabanı yok");
  if (manifest.files.length !== seen.size) throw new BackupError("Manifest ile içerik uyuşmuyor");
  for (const m of manifest.files) {
    const got = seen.get(m.name);
    if (!got || got.size !== m.size || got.sha256 !== m.sha256) throw new BackupError(`Doğrulama başarısız: ${m.name}`);
  }
  assertIntegrity(path.join(tmpDir, DB_NAME));

  let bytes = 0;
  for (const f of seen.values()) bytes += f.size;
  return { files: seen.size, photos: seen.size - 1, bytes, createdAt: manifest.createdAt };
}

/** Yedeğin şifresini açıp tüm içeriği doğrular; diske kalıcı bir şey bırakmaz. */
export async function verifyBackup(file: string, password: string, workParent = os.tmpdir()): Promise<BackupSummary> {
  const tmp = path.join(workParent, `.backup-verify-${randomBytes(4).toString("hex")}`);
  try {
    return await extract(file, password, tmp);
  } finally {
    await fsp.rm(tmp, { recursive: true, force: true });
  }
}

/** Yedeği `intoDir`'e açar. Hedef boş olmalı: ASLA var olan verinin üzerine yazmaz. */
export async function restoreBackup(opts: { file: string; password: string; intoDir: string }): Promise<BackupSummary> {
  const { file, password, intoDir } = opts;
  if (fs.existsSync(intoDir) && fs.readdirSync(intoDir).length > 0) {
    throw new BackupError(`Hedef klasör boş değil, üzerine yazılmaz: ${intoDir}`);
  }
  const tmp = `${intoDir}.tmp-${randomBytes(4).toString("hex")}`;
  try {
    const summary = await extract(file, password, tmp);
    if (fs.existsSync(intoDir)) fs.rmSync(intoDir, { recursive: true });
    fs.renameSync(tmp, intoDir);
    return summary;
  } catch (err) {
    await fsp.rm(tmp, { recursive: true, force: true });
    throw err;
  }
}