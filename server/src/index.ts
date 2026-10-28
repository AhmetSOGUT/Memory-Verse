import fs from "node:fs";
import path from "node:path";
import { buildApp } from "./app.js";
import { config } from "./config.js";
import { openDatabase } from "./db.js";

fs.mkdirSync(config.dataDir, { recursive: true });
const db = openDatabase(path.join(config.dataDir, "memory-verse.sqlite"));
const app = buildApp(db, { logger: true, photosDir: path.join(config.dataDir, "photos") });

// Düzgün kapanış: bekleyen istekler bitsin, veritabanı temiz kapansın
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await app.close();
    db.close();
    process.exit(0);
  });
}

if (!["127.0.0.1", "::1", "localhost"].includes(config.host)) {
  app.log.warn(`Sunucu ${config.host} adresinde dinliyor: ağa açık! Yalnızca bilerek yapıyorsan devam et.`);
}

await app.listen({ host: config.host, port: config.port });