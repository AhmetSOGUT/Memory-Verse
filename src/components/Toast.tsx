import { useEffect } from "react";

interface ToastProps {
  message: string | null;
  onClose: () => void;
}

/** Kısa süre görünen hata/bilgi mesajı. `onClose` sabit (useCallback) olmalı. */
function Toast({ message, onClose }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, 7000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;
  return (
    <div className="toast" role="alert" onClick={onClose}>
      {message}
    </div>
  );
}

export default Toast;