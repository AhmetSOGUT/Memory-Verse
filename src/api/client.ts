/** Sunucudan gelen anlaşılır hata (mesaj kullanıcıya gösterilebilir). */
export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP durum kodu; 0 = sunucuya hiç ulaşılamadı. */
    readonly status: number,
    /** Sunucunun gönderdiği ek veri (ör. 409'da güncel anı); yoksa undefined. */
    readonly data?: unknown,
  ) {
    super(message);
  }
}

let onUnauthorized: (() => void) | null = null;

/** Oturum herhangi bir istekte düşerse (401) çağrılır: arayüz giriş ekranına döner. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : "Bilinmeyen bir hata oluştu";

async function readError(res: Response): Promise<{ message: string; data?: unknown }> {
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    /* gövde JSON değil */
  }
  const body = (data ?? {}) as { error?: string; message?: string; details?: string[] };
  const base = body.error ?? body.message;
  if (base) return { message: body.details?.length ? `${base}: ${body.details.join("; ")}` : base, data };
  if (res.status >= 500) return { message: "Sunucu bir hata verdi. Biraz sonra tekrar dene.", data };
  return { message: `İstek başarısız oldu (${res.status})`, data };
}

interface RequestOptions {
  json?: unknown;
  body?: BodyInit;
}

/**
 * Tüm sunucu istekleri buradan geçer.
 * - Çerez otomatik gider (aynı kaynak); X-MV-Request başlığı CSRF korumasını karşılar.
 * - Hata durumunda ApiError fırlatır; 401'de oturum düştüğünü arayüze bildirir.
 */
export async function api<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { "X-MV-Request": "1" };
  let body = options.body;
  if (options.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.json);
  }

  let res: Response;
  try {
    res = await fetch(path, { method, headers, body, credentials: "same-origin" });
  } catch {
    throw new ApiError("Sunucuya ulaşılamıyor. Bağlantını ve sunucunun açık olduğunu kontrol et.", 0);
  }

  if (res.status === 401 && path !== "/api/auth/login") onUnauthorized?.();
  if (!res.ok) {
    const { message, data } = await readError(res);
    throw new ApiError(message, res.status, data);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}