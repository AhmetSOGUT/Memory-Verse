import { PassThrough } from "node:stream";

/** Bir anıda olan değişiklik. İçerik (açıklama, fotoğraf) taşımaz: alıcı listeyi yetkili yoldan yeniden çeker. */
export interface LiveEvent {
  action: "created" | "updated" | "deleted";
  id: number;
  title: string;
  /** Değişikliği yapanın görünen adı ve kimliği (kendi işlemlerinde bildirim göstermemek için). */
  by: string;
  byId: number;
}

interface Client {
  userId: number;
  sessionId: number;
  stream: PassThrough;
}

export interface LiveHubOptions {
  /** Oturum hâlâ geçerli mi? Süre uzatmaz (açık bir sekme oturumu canlı tutmasın). */
  isSessionActive: (sessionId: number) => boolean;
  /** Kalp atışı aralığı (ms): ara sunucuların bağlantıyı kesmesini önler, biten oturumları kapatır. */
  heartbeatMs?: number;
  /** Kullanıcı başına en fazla açık bağlantı; aşılırsa en eskisi kapanır. */
  maxPerUser?: number;
}

/** Açık SSE bağlantılarını tutar ve olayları dağıtır. */
export class LiveHub {
  private readonly clients = new Set<Client>();
  private readonly timer: NodeJS.Timeout;
  private readonly maxPerUser: number;

  constructor(private readonly options: LiveHubOptions) {
    this.maxPerUser = options.maxPerUser ?? 10;
    this.timer = setInterval(() => this.heartbeat(), options.heartbeatMs ?? 25_000);
    this.timer.unref();
  }

  get size(): number {
    return this.clients.size;
  }

  /** Yeni bir bağlantı açar. `release` bağlantı koptuğunda çağrılmalı. */
  connect(userId: number, sessionId: number): { stream: PassThrough; release: () => void } {
    const mine = [...this.clients].filter((c) => c.userId === userId);
    while (mine.length >= this.maxPerUser) this.drop(mine.shift()!);

    const client: Client = { userId, sessionId, stream: new PassThrough() };
    client.stream.on("error", () => this.drop(client));
    this.clients.add(client);
    client.stream.write("retry: 3000\n\n: bağlandı\n\n");
    return { stream: client.stream, release: () => this.drop(client) };
  }

  publish(event: LiveEvent): void {
    const frame = `event: memory\ndata: ${JSON.stringify(event)}\n\n`;
    for (const client of [...this.clients]) this.send(client, frame);
  }

  /** Çıkış yapan oturumun bağlantılarını hemen kapatır. */
  closeSession(sessionId: number): void {
    for (const client of [...this.clients]) if (client.sessionId === sessionId) this.drop(client);
  }

  /** Sunucu kapanırken: açık bağlantılar kapanmazsa kapanış sonsuza dek bekler. */
  shutdown(): void {
    clearInterval(this.timer);
    for (const client of [...this.clients]) this.drop(client);
  }

  private heartbeat(): void {
    for (const client of [...this.clients]) {
      if (!this.options.isSessionActive(client.sessionId)) this.drop(client);
      else this.send(client, ": ping\n\n");
    }
  }

  private send(client: Client, frame: string): void {
    // Yavaş/takılmış istemci belleği şişirmesin
    if (client.stream.writableLength > 256 * 1024) return this.drop(client);
    client.stream.write(frame);
  }

  private drop(client: Client): void {
    if (!this.clients.delete(client)) return;
    client.stream.end();
  }
}