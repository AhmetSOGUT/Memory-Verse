import { useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

interface PhotoCarouselProps {
  images: string[];
  alt: string;
  /** Sarmalayıcı sınıfı (boyut/çerçeve için). */
  className?: string;
  /** <img> sınıfı (mevcut stillerle uyum için). */
  imgClassName?: string;
  /** Fotoğrafa dokununca/tıklayınca (sürükleme değilse) çağrılır. */
  onOpen?: (index: number) => void;
  /** Oklar: yalnızca fareyle üzerine gelince, her zaman ya da hiç. */
  arrows?: "hover" | "always" | "none";
  /** Sağ altta küçük "2 / 5" sayacı. */
  counter?: boolean;
}

/** Yatay sürükleme eşiği (px); altında kalan hareket tıklama sayılır. */
const DRAG_START = 8;

/**
 * Fotoğraflar arasında yatay kaydırma (sürükleme) + ince ‹ › okları.
 * Dikey hareket sayfaya bırakılır (CSS `touch-action: pan-y`), böylece sayfa kaydırması bozulmaz.
 * Kenarlarda lastik bant etkisi vardır; eşiği geçen kaydırma bir sonraki/önceki fotoğrafa geçer.
 */
export default function PhotoCarousel({
  images,
  alt,
  className,
  imgClassName,
  onOpen,
  arrows = "hover",
  counter = false,
}: PhotoCarouselProps) {
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; x: number; y: number; axis: "?" | "x" | "y"; width: number } | null>(null);
  const moved = useRef(false);

  // Fotoğraf sayısı azalırsa (ör. silme) indeks aralık dışında kalmasın
  const current = Math.min(index, Math.max(0, images.length - 1));

  const go = (next: number) => setIndex(Math.max(0, Math.min(images.length - 1, next)));

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
        drag.current = null; // dikey: sayfa kaydırması devralsın
        return;
      }
      d.axis = "x";
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
    }

    const atStart = current === 0 && dx > 0;
    const atEnd = current === images.length - 1 && dx < 0;
    setDragX(atStart || atEnd ? dx * 0.3 : dx); // uçlarda lastik bant
    if (Math.abs(dx) > DRAG_START) moved.current = true;
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);

    if (d.axis === "x") {
      const threshold = Math.max(36, d.width * 0.16);
      if (dragX <= -threshold) go(current + 1);
      else if (dragX >= threshold) go(current - 1);
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

  function handleClick() {
    if (moved.current) {
      moved.current = false;
      return;
    }
    onOpen?.(current);
  }

  function handleKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(current + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(current - 1);
    } else if (onOpen && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onOpen(current);
    }
  }

  const classes = ["photo-carousel", className, dragging ? "is-dragging" : ""].filter(Boolean).join(" ");

  return (
    <div
      className={classes}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={onOpen ? 0 : undefined}
      aria-label={images.length > 1 ? `${alt} — ${current + 1}/${images.length}` : alt}
    >
      <div
        className="photo-carousel__track"
        style={{
          transform: `translate3d(calc(${-current * 100}% + ${dragX}px), 0, 0)`,
          transition: dragging ? "none" : undefined,
        }}
      >
        {images.map((src, i) => (
          <div className="photo-carousel__slide" key={`${src}-${i}`} aria-hidden={i !== current}>
            <img
              src={src}
              alt={i === 0 ? alt : `${alt} (${i + 1})`}
              className={imgClassName}
              draggable={false}
              loading="lazy"
            />
          </div>
        ))}
      </div>

      {images.length > 1 && arrows !== "none" && (
        <>
          <button
            type="button"
            className={`photo-carousel__nav photo-carousel__nav--prev photo-carousel__nav--${arrows}`}
            onClick={(e) => {
              e.stopPropagation();
              go(current - 1);
            }}
            disabled={current === 0}
            aria-label="Önceki fotoğraf"
          >
            ‹
          </button>
          <button
            type="button"
            className={`photo-carousel__nav photo-carousel__nav--next photo-carousel__nav--${arrows}`}
            onClick={(e) => {
              e.stopPropagation();
              go(current + 1);
            }}
            disabled={current === images.length - 1}
            aria-label="Sonraki fotoğraf"
          >
            ›
          </button>
        </>
      )}

      {images.length > 1 && counter && (
        <span className="photo-carousel__count" aria-hidden="true">
          {current + 1} / {images.length}
        </span>
      )}
    </div>
  );
}
