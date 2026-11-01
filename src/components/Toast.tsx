import { useEffect } from "react";

interface ToastProps {
  message: string | null;
  /** "error" (varsayılan, kırmızı) ya da "info" (mavi: ör. başkasının yaptığı değişiklik). */
  kind?: "info" | "error";
  onClose: () => void;
}

/** Kısa süre görünen hata/bilgi mesajı. `onClose` sabit (useCallback) olmalı. */
function Toast({ message, kind = "error", onClose }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, 7000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;
  return (
    <div
      className={kind === "info" ? "toast toast--info" : "toast"}
      role={kind === "info" ? "status" : "alert"}
      onClick={onClose}
    >
      {message}
    </div>
  );
}

export default Toast;