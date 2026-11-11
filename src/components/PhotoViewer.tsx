import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";

interface PhotoViewerProps {
  /** Anının bütün fotoğrafları (kapak ilk sırada). */
  images: string[];
  /** Açılışta gösterilecek fotoğrafın sırası. */
  index: number;
  onClose: () => void;
  /** Fotoğraf değişince çağrılır (ör. kürenin dokusunu güncellemek için). */
  onIndexChange?: (index: number) => void;
}

/** Yatay sürüklemenin tıklamadan ayrıldığı eşik (px). */
const DRAG_START = 8;

/**
 * Tam ekran fotoğraf. Burada da fotoğraflar arasında yatay kaydırılır (sürükleme, oklar, klavye).
 * Doğrudan <body>'ye çizilir (portal): dönüşümlü (transform) üst öğelerin içinde `position: fixed` bozulur,
 * yüzen düğmelerin altında da kalmaz.
 */
export default function PhotoViewer({ images, index, onClose, onIndexChange }: PhotoViewerProps) {
  const [current, setCurrent] = useState(() => Math.max(0, Math.min(images.length - 1, index)));
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; x: number; y: number; axis: "?" | "x" | "y"; width: number } | null>(null);
  const moved = useRef(false);

  // Fotoğraf sayısı azalırsa indeks aralık dışında kalmasın
  const shown = Math.max(0, Math.min(current, images.length - 1));
  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(images.length - 1, next));
      setCurrent(clamped);
      onIndexChange?.(clamped);
    },
    [images.length, onIndexChange],
  );

  // Arka plandaki sayfa kaymasın
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Klavye: Esc kapatır, ok tuşları fotoğraf değiştirir
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(shown + 1);
      else if (e.key === "ArrowLeft") go(shown - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, shown, go]);

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (images.length < 2) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    moved.current = false;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, axis: "?", width: e.currentTarget.clientWidth };
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;

    if (d.axis === "?") {
      if (Math.abs(dx) < DRAG_START && Math.abs(dy) < DRAG_START) return;
      if (Math.abs(dx) <= Math.abs(dy)) {
        drag.current = null; // dikey: dokunma sayılsın
        return;
      }
      d.axis = "x";
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
    }

    const atStart = shown === 0 && dx > 0;
    const atEnd = shown === images.length - 1 && dx < 0;
    setDragX(atStart || atEnd ? dx * 0.25 : dx); // uçlarda lastik bant
    if (Math.abs(dx) > DRAG_START) moved.current = true;
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);

    if (d.axis === "x") {
      const threshold = Math.max(48, d.width * 0.12);
      if (dragX <= -threshold) go(shown + 1);
      else if (dragX >= threshold) go(shown - 1);
    }
    setDragX(0);
    setDragging(false);
  }

  function handlePointerCancel(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    drag.current = null;
    setDragX(0);
    setDragging(false);
  }

  /** Boş alana (fotoğrafın dışına) tıklayınca kapanır; sürükleme tıklama sayılmaz. */
  function handleBackgroundClick(e: React.MouseEvent<HTMLDivElement>) {
    if (moved.current) {
      moved.current = false;
      return;
    }
    if ((e.target as HTMLElement).closest("img")) return;
    onClose();
  }

  return createPortal(
    <div
      onClick={handleBackgroundClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.92)",
        zIndex: 9999,
        overflow: "hidden",
        cursor: "zoom-out",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        touchAction: "pan-y", // yatay kaydırma bize, dikey hareket tarayıcıya
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          transform: `translate3d(calc(${-shown * 100}% + ${dragX}px), 0, 0)`,
          transition: dragging ? "none" : "transform 0.3s cubic-bezier(0.2,0.8,0.2,1)",
          willChange: "transform",
        }}
      >
        {images.map((src, i) => (
          <div
            key={`${src}-${i}`}
            aria-hidden={i !== shown}
            style={{
              flex: "0 0 100%",
              minWidth: 0,
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 6px",
            }}
          >
            <img
              src={src}
              alt={i === 0 ? "Tam ekran" : `Tam ekran (${i + 1})`}
              draggable={false}
              style={{
                maxWidth: "92vw",
                maxHeight: "88vh",
                objectFit: "contain",
                borderRadius: "16px",
                boxShadow: "0 40px 80px rgba(0,0,0,0.8)",
                cursor: "default",
              }}
            />
          </div>
        ))}
      </div>

      {images.length > 1 && (
        <>
          <button
            type="button"
            className="photo-viewer__nav photo-viewer__nav--prev"
            onClick={(e) => {
              e.stopPropagation();
              go(shown - 1);
            }}
            disabled={shown === 0}
            aria-label="Önceki fotoğraf"
          >
            ‹
          </button>
          <button
            type="button"
            className="photo-viewer__nav photo-viewer__nav--next"
            onClick={(e) => {
              e.stopPropagation();
              go(shown + 1);
            }}
            disabled={shown === images.length - 1}
            aria-label="Sonraki fotoğraf"
          >
            ›
          </button>
        </>
      )}

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
          zIndex: 10000,
        }}
      >
        ✕
      </button>

      <div
        style={{
          position: "fixed",
          bottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "6px",
          pointerEvents: "none",
          zIndex: 10000,
        }}
      >
        {images.length > 1 && (
          <span className="photo-viewer__count" aria-hidden="true">
            {shown + 1} / {images.length}
          </span>
        )}
        <p className="photo-viewer__hint">
          {images.length > 1 ? "Kaydırarak gezin · kapatmak için ✕" : "Kapatmak için tıkla veya ✕"}
        </p>
      </div>
    </div>,
    document.body,
  );
}
