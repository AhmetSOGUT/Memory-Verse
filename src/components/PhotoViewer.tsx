import { useEffect } from "react";
import { createPortal } from "react-dom";

interface PhotoViewerProps {
  src: string;
  onClose: () => void;
}

/**
 * Tam ekran fotoğraf. Doğrudan <body>'ye çizilir (portal): dönüşümlü (transform) üst öğelerin içinde
 * `position: fixed` bozulur, yüzen düğmelerin altında da kalmaz.
 */
export default function PhotoViewer({ src, onClose }: PhotoViewerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.92)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "zoom-out",
        backdropFilter: "blur(8px)",
      }}
    >
      <img
        src={src}
        alt="Tam ekran"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "92vw",
          maxHeight: "88vh",
          objectFit: "contain",
          borderRadius: "16px",
          boxShadow: "0 40px 80px rgba(0,0,0,0.8)",
        }}
      />
      <button
        onClick={onClose}
        aria-label="Kapat"
        style={{
          position: "fixed",
          top: "calc(20px + env(safe-area-inset-top, 0px))",
          right: "calc(20px + env(safe-area-inset-right, 0px))",
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: "50%",
          color: "white",
          width: "40px",
          height: "40px",
          fontSize: "18px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backdropFilter: "blur(8px)",
        }}
      >
        ✕
      </button>
      <p
        style={{
          position: "fixed",
          bottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
          left: "50%",
          transform: "translateX(-50%)",
          color: "rgba(255,255,255,0.4)",
          fontSize: "0.8rem",
          pointerEvents: "none",
        }}
      >
        Kapatmak için tıkla veya ✕
      </p>
    </div>,
    document.body,
  );
}