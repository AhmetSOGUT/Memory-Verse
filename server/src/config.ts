import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const config = {
  /** Varsayılan olarak yalnızca bu bilgisayar dinlenir; ağa açılmaz. */
  host: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 3001),
  /** Veritabanı ve fotoğraflar burada durur. Git'e girmez. */
  dataDir: process.env.DATA_DIR ?? path.join(serverRoot, "data"),

  /**
   * Çerez "Secure" işaretli olur (yalnızca HTTPS'te gönderilir; Chrome/Edge/Firefox localhost'ta da kabul eder).
   * Tarayıcı çerezi reddederse geliştirme için INSECURE_COOKIES=1 ile kapatılabilir; canlıda ASLA.
   */
  secureCookies: process.env.INSECURE_COOKIES !== "1",

};