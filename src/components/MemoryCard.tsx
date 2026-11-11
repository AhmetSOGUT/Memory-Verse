import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Memory } from "../types";
import { memoryImages } from "../lib/photos";
import PhotoCarousel from "./PhotoCarousel";
import PhotoViewer from "./PhotoViewer";
import ScrollText from "./ScrollText";

interface MemoryCardProps {
  memory: Memory;
  onEdit: (memory: Memory) => void;
  onDelete: (id: number) => void;
}

/**
 * Kart ekrana girince `revealed` true olur. Yalnızca telefon düzeninde (main.css) yumuşak belirme için kullanılır;
 * masaüstü CSS'i bu değere bakmaz, kartlar hep görünür kalır. IntersectionObserver yoksa baştan görünür.
 */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -6% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, revealed] as const;
}

function MemoryCard({ memory, onEdit, onDelete }: MemoryCardProps) {
  /** Tam ekran açıkken hangi fotoğraf gösteriliyor (null = kapalı). */
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);
  const [cardRef, revealed] = useReveal();
  const images = memoryImages(memory);
  const cover = images[0] ?? null;
  /**
   * Kapak fotoğrafının en-boy oranı ("3 / 4" gibi). Mobilde kart fotoğrafının kutusu buna göre
   * boyutlanır: fotoğraf kırpılmadan, kart genişliğinde tam boyutta görünür (masaüstü sabit kalır).
   */
  const [coverAspect, setCoverAspect] = useState<string | null>(null);

  useEffect(() => {
    // Kart görünür olunca ölç: uzun zaman çizgisinde boşuna fotoğraf indirmeyelim
    if (!cover || !revealed) return;
    let cancelled = false;
    const probe = new Image();
    probe.onload = () => {
      if (cancelled || !probe.naturalWidth || !probe.naturalHeight) return;
      setCoverAspect(`${probe.naturalWidth} / ${probe.naturalHeight}`);
    };
    probe.src = cover;
    return () => {
      cancelled = true;
    };
  }, [cover, revealed]);

  const photoStyle = coverAspect ? ({ "--photo-ar": coverAspect } as CSSProperties) : undefined;

  const formattedDate = new Date(memory.date).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <div className="memory-card visible" ref={cardRef} data-revealed={revealed}>
        <div className="timeline-dot"></div>

        <div className="card-content">
          <div className="card-actions">
            <button
              className="action-btn"
              onClick={() => onEdit(memory)}
              aria-label="Düzenle"
            >
              ✏️
            </button>

            <button
              className="action-btn"
              onClick={() => onDelete(memory.id)}
              aria-label="Sil"
            >
              🗑️
            </button>
          </div>

          <div className="card-badges">
            <span className="date-badge">{formattedDate}</span>
            {memory.category && <span className="category-badge">🏷️ {memory.category}</span>}
          </div>
          <h2 className="memory-title">{memory.title}</h2>
          <ScrollText className="memory-description">{memory.description}</ScrollText>

          {images.length > 0 && (
            <PhotoCarousel
              images={images}
              alt={memory.title}
              className="memory-carousel"
              imgClassName="memory-image"
              onOpen={setZoomIndex}
              counter
              style={photoStyle}
            />
          )}
        </div>
      </div>

      {zoomIndex !== null && images[zoomIndex] && (
        <PhotoViewer images={images} index={zoomIndex} onClose={() => setZoomIndex(null)} />
      )}
    </>
  );
}

export default MemoryCard;
