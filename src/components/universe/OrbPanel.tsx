import { useState } from "react";
import type { Memory } from "../../types";
import PhotoViewer from "../PhotoViewer";
import ScrollText from "../ScrollText";

interface OrbPanelProps {
  memory: Memory;
  onClose: () => void;
  /** Tarih sırasındaki yeri ("12 / 87") ve önceki/sonraki anıya geçiş (kamera oraya uçar). */
  position?: { index: number; total: number };
  onPrev?: () => void;
  onNext?: () => void;
}

/**
 * Seçili anının detay paneli.
 * Masaüstünde sağda duran kart; telefonda (dar/dikey ekran) alttan açılan panel (bkz. main.css).
 * Fotoğraf yerinde kalır, uzun yazı kendi kutusunda aşağı kayar; fotoğrafa dokununca tam ekran açılır.
 * Önceki/Sonraki düğmeleri anıları tarih sırasıyla gezdirir: çok anı olunca da her anıya kolayca ulaşılır.
 * Not: Eski sürüm innerHTML ile string birleştiriyordu (başlık/açıklama kaçışsızdı → XSS).
 * React metni otomatik kaçırır.
 */
export default function OrbPanel({ memory, onClose, position, onPrev, onNext }: OrbPanelProps) {
  const [zoomOpen, setZoomOpen] = useState(false);
  const date = new Date(memory.date).toLocaleDateString("tr-TR", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <aside className="orb-panel" role="dialog" aria-label={memory.title}>
      <div className="orb-panel__grip" aria-hidden="true" />
      <div className="orb-panel__scroll">
        {memory.image ? (
          <div className="orb-panel__photo">
            <img src={memory.image} alt={memory.title} onClick={() => setZoomOpen(true)} />
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
      {zoomOpen && memory.image && <PhotoViewer src={memory.image} onClose={() => setZoomOpen(false)} />}
    </aside>
  );
}