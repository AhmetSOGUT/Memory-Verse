import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const config = {
  /** Varsayılan olarak yalnızca bu bilgisayar dinlenir; ağa açılmaz. */
  host: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 3001),
  /** Veritabanı ve fotoğraflar burada durur. Git'e girmez. */
  dataDir: process.env.DATA_DIR ?? path.join(serverRoot, "data"),
};