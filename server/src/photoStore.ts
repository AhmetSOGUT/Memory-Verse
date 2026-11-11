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

/** İzin verilen biçimler ve diskteki uzantıları (SVG gibi betik taşıyabilen biçimler YOK). */
const ALLOWED_FORMATS = new Map([
  ["jpeg", "jpg"],
  ["png", "png"],
  ["webp", "webp"],
]);
const NAME_PATTERN = /^[a-f0-9]{32}\.(?:jpg|png|webp)$/;

/**
 * Fotoğraf deposu. Yüklenen dosya **hiç yeniden kodlanmadan**, geldiği gibi saklanır:
 *  - kalite kaybı yok, çözünürlük düşmez (kullanıcı neyi yüklediyse o kalır)
 *  - gerçekten bir görsel olduğu yine doğrulanır (uzantıya/Content-Type'a güvenilmez)
 *  - EXIF (yön, cihaz, tarih) da korunur; yön bilgisini tarayıcılar kendisi uygular
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
    let format: string | undefined;
    try {
      // Yalnızca başlığı okur (çözmez): dosya gerçekten bir görsel mi?
      format = (await sharp(input, { failOn: "error" }).metadata()).format;
    } catch {
      throw new PhotoError("Dosya geçerli bir görsel değil", 400);
    }

    const ext = format ? ALLOWED_FORMATS.get(format) : undefined;
    if (!ext) throw new PhotoError("Yalnızca JPEG, PNG veya WebP yüklenebilir", 415);

    const name = `${randomBytes(16).toString("hex")}.${ext}`;
    await fs.promises.writeFile(path.join(this.dir, name), input, { flag: "wx" });
    return name;
  }

  /** Dosyayı siler; yoksa sessizce geçer. */
  async remove(name: string | null | undefined): Promise<void> {
    if (!name || !PhotoStore.isValidName(name)) return;
    await fs.promises.rm(path.join(this.dir, name), { force: true });
  }
}
