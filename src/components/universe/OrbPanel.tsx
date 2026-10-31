import { useState } from "react";
import type { Memory } from "../../types";
import PhotoViewer from "../PhotoViewer";
import ScrollText from "../ScrollText";

interface OrbPanelProps {
  memory: Memory;
  onClose: () => void;
}

/**
 * Seçili anının detay paneli.
 * Masaüstünde sağda duran kart; telefonda (dar/dikey ekran) alttan açılan panel (bkz. main.css).
 * Fotoğraf yerinde kalır, uzun yazı kendi kutusunda aşağı kayar; fotoğrafa dokununca tam ekran açılır.
 * Not: Eski sürüm innerHTML ile string birleştiriyordu (başlık/açıklama kaçışsızdı → XSS).
 * React metni otomatik kaçırır.
 */
export default function OrbPanel({ memory, onClose }: OrbPanelProps) {
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
          <div className="orb-panel__date">{date}</div>
          <div className="orb-panel__title">{memory.title}</div>
          <ScrollText className="orb-panel__desc">{memory.description}</ScrollText>
        </div>
      </div>
      <button className="orb-panel__close" onClick={onClose} aria-label="Kapat">✕</button>
      {zoomOpen && memory.image && <PhotoViewer src={memory.image} onClose={() => setZoomOpen(false)} />}
    </aside>
  );
}