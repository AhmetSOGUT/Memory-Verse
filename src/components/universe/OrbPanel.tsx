import type { Memory } from "../../types";

interface OrbPanelProps {
  memory: Memory;
  onClose: () => void;
}

/**
 * Seçili anının detay paneli.
 * Not: Eski sürüm innerHTML ile string birleştiriyordu (başlık/açıklama kaçışsızdı → XSS).
 * React metni otomatik kaçırır.
 */
export default function OrbPanel({ memory, onClose }: OrbPanelProps) {
  const date = new Date(memory.date).toLocaleDateString("tr-TR", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <aside className="orb-panel" role="dialog" aria-label={memory.title}>
      {memory.image ? (
        <div className="orb-panel__photo">
          <img src={memory.image} alt={memory.title} />
        </div>
      ) : (
        <div className="orb-panel__placeholder">💫</div>
      )}
      <div className="orb-panel__body">
        <div className="orb-panel__date">{date}</div>
        <div className="orb-panel__title">{memory.title}</div>
        <div className="orb-panel__desc">{memory.description}</div>
      </div>
      <button className="orb-panel__close" onClick={onClose} aria-label="Kapat">✕</button>
    </aside>
  );
}
