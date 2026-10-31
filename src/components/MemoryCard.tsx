import { useEffect, useRef, useState } from "react";
import type { Memory } from "../types";
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
  const [zoomOpen, setZoomOpen] = useState(false);
  const [cardRef, revealed] = useReveal();

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

          <span className="date-badge">{formattedDate}</span>
          <h2 className="memory-title">{memory.title}</h2>
          <ScrollText className="memory-description">{memory.description}</ScrollText>

          {memory.image && (
            <img
              src={memory.image}
              className="memory-image"
              alt="Anı fotoğrafı"
              onClick={() => setZoomOpen(true)}
            />
          )}
        </div>
      </div>

      {zoomOpen && memory.image && <PhotoViewer src={memory.image} onClose={() => setZoomOpen(false)} />}
    </>
  );
}

export default MemoryCard;