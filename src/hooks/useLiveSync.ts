import { useEffect, useRef } from "react";
import { api } from "../api/client";

/** Sunucunun gönderdiği değişiklik bildirimi (içerik taşımaz; liste yeniden çekilir). */
export interface LiveEvent {
  action: "created" | "updated" | "deleted";
  id: number;
  title: string;
  /** Değişikliği yapanın görünen adı ve kimliği. */
  by: string;
  byId: number;
}

interface LiveSyncHandlers {
  /** Başka bir yerde (başka kişi ya da cihaz) bir anı değişti. */
  onEvent: (event: LiveEvent) => void;
  /** Bağlantı (yeniden) kuruldu ya da sekme öne geldi: kaçırılan değişiklikler olabilir, listeyi yenile. */
  onSync: () => void;
}

const RETRY_MS = 5000;

/**
 * Canlı bildirim akışı (Server-Sent Events). Tarayıcı kopan bağlantıyı kendisi yeniden dener;
 * bu kanca ek olarak: bağlantı her açıldığında ve sekme öne geldiğinde `onSync` çağırır (kaçırılanı yakalamak için),
 * tarayıcı yeniden denemeyi bırakırsa (ör. oturum düştü, sunucu kapalıydı) kendisi tekrar bağlanır.
 */
export function useLiveSync(handlers: LiveSyncHandlers): void {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: number | undefined;
    let stopped = false;

    const connect = () => {
      source = new EventSource("/api/events");
      source.addEventListener("open", () => latest.current.onSync());
      source.addEventListener("memory", (e) => {
        try {
          latest.current.onEvent(JSON.parse((e as MessageEvent<string>).data) as LiveEvent);
        } catch {
          /* bozuk bildirim: yok say */
        }
      });
      source.addEventListener("error", () => {
        if (source?.readyState !== EventSource.CLOSED) return; // tarayıcı kendisi yeniden deniyor
        source.close();
        source = null;
        if (stopped) return;
        // Oturum düştüyse bu çağrı 401 alır ve arayüz giriş ekranına döner; sunucu kapalıysa sessizce tekrar denenir
        api("GET", "/api/auth/me")
          .catch(() => undefined)
          .finally(() => {
            if (!stopped) retryTimer = window.setTimeout(connect, RETRY_MS);
          });
      });
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      latest.current.onSync();
      if (!source || source.readyState === EventSource.CLOSED) {
        window.clearTimeout(retryTimer);
        connect();
      }
    };

    connect();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      source?.close();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}