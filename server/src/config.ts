import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const config = {
  /** Varsayılan olarak yalnızca bu bilgisayar dinlenir; ağa açılmaz. */
  host: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 3001),
  /** Veritabanı ve fotoğraflar burada durur. Git'e girmez. */
  dataDir: process.env.DATA_DIR ?? path.join(serverRoot, "data"),

  /** Derlenmiş ön yüz (npm run build → ana klasörde dist/). */
  webRoot: process.env.WEB_ROOT ?? path.join(serverRoot, "..", "dist"),

  /**
   * Kabul edilen Host adları (DNS rebinding savunması). Tailscale adını ALLOWED_HOSTS ile ekle:
   * ALLOWED_HOSTS=pc-adin.tailxxxx.ts.net  (virgülle birden fazla yazılabilir)
   */
  allowedHosts: [
    "localhost", "127.0.0.1", "[::1]",
    ...(process.env.ALLOWED_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean),
  ],

  /** tailscale serve gibi bir vekil önde duruyorsa TRUST_PROXY=1 (yalnızca bu bilgisayardan gelen X-Forwarded-* kabul edilir). */
  trustProxy: process.env.TRUST_PROXY === "1" ? "127.0.0.1" : false,

  /**
   * Çerez "Secure" işaretli olur (yalnızca HTTPS'te gönderilir; Chrome/Edge/Firefox localhost'ta da kabul eder).
   * Tarayıcı çerezi reddederse geliştirme için INSECURE_COOKIES=1 ile kapatılabilir; canlıda ASLA.
   */
  secureCookies: process.env.INSECURE_COOKIES !== "1",
};