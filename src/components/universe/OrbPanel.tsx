import { useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { Memory } from "../../types";
import { memoryImages } from "../../lib/photos";
import PhotoCarousel from "../PhotoCarousel";
import PhotoViewer from "../PhotoViewer";
import ScrollText from "../ScrollText";

interface OrbPanelProps {
  memory: Memory;
  onClose: () => void;
  /** Tarih sırasındaki yeri ("12 / 87") ve önceki/sonraki anıya geçiş (kamera oraya uçar). */
  position?: { index: number; total: number };
  onPrev?: () => void;
  onNext?: () => void;
  /** Panelde gösterilen fotoğrafın sırası; kürenin dokusu da bunu izler. */
  photoIndex?: number;
  /** Panelde (ya da tam ekranda) fotoğraf değişince çağrılır. */
  onPhotoIndexChange?: (index: number) => void;
}

/** Telefondaki alt panel en fazla bu kadar küçülür: tamamen kapanmaz, tutamaç görünür kalır. */
const MIN_SHEET_HEIGHT = 110;
/** Sürükleme oranı: parmak 1px inince panel 1px küçülür. */
const DRAG_RATIO = 1;

/**
 * Seçili anının detay paneli.
 * Masaüstünde sağda duran kart; telefonda (dar/dikey ekran) alttan açılan panel (bkz. main.css).
 * Fotoğraf yerinde kalır, uzun yazı kendi kutusunda aşağı kayar; fotoğrafa dokununca tam ekran açılır.
 * Önceki/Sonraki düğmeleri anıları tarih sırasıyla gezdirir: çok anı olunca da her anıya kolayca ulaşılır.
 * Telefonda üstteki tutamaçtan aşağı sürükleyince panel küçülür (kapanmaz, bir parçası açıkta kalır).
 * Not: Eski sürüm innerHTML ile string birleştiriyordu (başlık/açıklama kaçışsızdı → XSS).
 * React metni otomatik kaçırır.
 */
export default function OrbPanel({
  memory,
  onClose,
  position,
  onPrev,
  onNext,
  photoIndex = 0,
  onPhotoIndexChange,
}: OrbPanelProps) {
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ startY: number; startHeight: number; maxHeight: number } | null>(null);
  /** Panelin küçültülmemiş (doğal) yüksekliği; yukarı sürükleyince buraya kadar geri açılır. */
  const naturalHeightRef = useRef<number | null>(null);
  const images = memoryImages(memory);

  const date = new Date(memory.date).toLocaleDateString("tr-TR", {
    day: "numeric", month: "long", year: "numeric",
  });

  function handleGripDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const el = panelRef.current;
    if (!el) return;
    const startHeight = el.getBoundingClientRect().height;
    // İlk tutuşta panel henüz küçültülmemişti: doğal yükseklik bu.
    if (naturalHeightRef.current === null) naturalHeightRef.current = startHeight;
    const maxHeight = Math.max(naturalHeightRef.current, startHeight);
    dragRef.current = { startY: e.clientY, startHeight, maxHeight };
    setHeight(startHeight);
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleGripMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dy = (e.clientY - drag.startY) * DRAG_RATIO;
    const next = Math.min(drag.maxHeight, Math.max(MIN_SHEET_HEIGHT, drag.startHeight - dy));
    setHeight(next);
  }

  function handleGripUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  return (
    <aside
      ref={panelRef}
      className={`orb-panel${dragging ? " orb-panel--dragging" : ""}`}
      role="dialog"
      aria-label={memory.title}
      style={height !== null ? ({ "--sheet-height": `${height}px` } as CSSProperties) : undefined}
    >
      <div
        className="orb-panel__grip"
        onPointerDown={handleGripDown}
        onPointerMove={handleGripMove}
        onPointerUp={handleGripUp}
        onPointerCancel={handleGripUp}
      />
      <div className="orb-panel__scroll">
        {images.length > 0 ? (
          <div className="orb-panel__photo">
            <PhotoCarousel
              images={images}
              alt={memory.title}
              onOpen={setZoomIndex}
              counter
              index={photoIndex}
              onIndexChange={onPhotoIndexChange}
            />
          </div>
        ) : (
          <div className="orb-panel__placeholder">💫</div>
        )}
        <div className="orb-panel__body">
          <div className="orb-panel__date">
            {memory.category && <span className="orb-panel__category">🏷️ {memory.category}</span>}
            {date}
          </div>
          <div className="orb-panel__title">{memory.title}</div>
          <ScrollText className="orb-panel__desc">{memory.description}</ScrollText>
          {position && (
            <div className="orb-panel__nav">
              <button onClick={onPrev} disabled={!onPrev} aria-label="Önceki anı">‹ Önceki</button>
              <span>{position.index + 1} / {position.total}</span>
              <button onClick={onNext} disabled={!onNext} aria-label="Sonraki anı">Sonraki ›</button>
            </div>
          )}
        </div>
      </div>
      <button className="orb-panel__close" onClick={onClose} aria-label="Kapat">✕</button>
      {zoomIndex !== null && images[zoomIndex] && (
        <PhotoViewer
          images={images}
          index={zoomIndex}
          onClose={() => setZoomIndex(null)}
          onIndexChange={onPhotoIndexChange}
        />
      )}
    </aside>
  );
}
