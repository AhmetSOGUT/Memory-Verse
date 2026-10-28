import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

/** İstemciye gösterilebilecek, anlaşılır bir fotoğraf hatası. */
export class PhotoError extends Error {
  constructor(message: string, readonly statusCode = 400) {
    super(message);
  }
}

const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]); // SVG gibi betik taşıyabilen biçimler YOK
const MAX_DIMENSION = 1600;
const MAX_INPUT_PIXELS = 40_000_000; // "dekompresyon bombası" koruması
const NAME_PATTERN = /^[a-f0-9]{32}\.webp$/;

/**
 * Fotoğraf deposu. Yüklenen her dosya yeniden kodlanır:
 *  - gerçekten bir görsel olduğu doğrulanır (uzantıya/Content-Type'a güvenilmez)
 *  - EXIF (konum, cihaz, tarih) tamamen silinir
 *  - yön düzeltilir, boyut sınırlanır, WebP'ye çevrilir
 * Dosya adı rastgeledir; kullanıcıdan gelen hiçbir şey dosya yoluna girmez.
 */
export class PhotoStore {
  constructor(readonly dir: string) {
    fs.mkdirSync(dir, { recursive: true });
  }

  static isValidName(name: string): boolean {
    return NAME_PATTERN.test(name);
  }

  pathOf(name: string): string {
    if (!PhotoStore.isValidName(name)) throw new PhotoError("Geçersiz dosya adı", 400);
    return path.join(this.dir, name);
  }

  async save(input: Buffer): Promise<string> {
    let output: Buffer;
    try {
      const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });
      const meta = await image.metadata();
      if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) {
        throw new PhotoError("Yalnızca JPEG, PNG veya WebP yüklenebilir", 415);
      }
      output = await image
        .rotate() // EXIF yönüne göre düzelt (sonra metadata atılır)
        .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
    } catch (err) {
      if (err instanceof PhotoError) throw err;
      throw new PhotoError("Dosya geçerli bir görsel değil", 400);
    }

    const name = `${randomBytes(16).toString("hex")}.webp`;
    await fs.promises.writeFile(path.join(this.dir, name), output, { flag: "wx" });
    return name;
  }

  /** Dosyayı siler; yoksa sessizce geçer. */
  async remove(name: string | null | undefined): Promise<void> {
    if (!name || !PhotoStore.isValidName(name)) return;
    await fs.promises.rm(path.join(this.dir, name), { force: true });
  }
}