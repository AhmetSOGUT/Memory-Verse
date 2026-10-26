import { lazy, Suspense, useState } from "react";
import type { Memory } from "../../types";
import OrbPanel from "./OrbPanel";
import ShootingStars from "./ShootingStars";

// Three.js ayrı pakete bölünür; timeline açılırken yüklenmez.
const UniverseCanvas = lazy(() => import("../../universe/UniverseCanvas"));

interface SpaceSceneProps {
  isOpen: boolean;
  onClose: () => void;
  memories: Memory[];
}

export default function SpaceScene({ isOpen, onClose, memories }: SpaceSceneProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // Silinmiş/değişmiş anıya işaret ediyorsa otomatik boşa düşer
  const selected = memories.find((m) => m.id === selectedId) ?? null;

  function handleClose() {
    setSelectedId(null);
    onClose();
  }

  return (
    <div
      id="spaceScene"
      className={`space-scene ${isOpen ? "space-scene--visible" : ""}`}
      aria-hidden={!isOpen}
    >
      <div className="space-canvas-container">
        {isOpen && (
          <Suspense fallback={null}>
            <UniverseCanvas
              memories={memories}
              selectedId={selected?.id ?? null}
              onSelect={setSelectedId}
              onDeselect={() => setSelectedId(null)}
            />
          </Suspense>
        )}
      </div>

      {isOpen && <ShootingStars />}

      <div className="space-ui">
        <h2 className="space-title">Anı Evreni</h2>
        <p className="space-subtitle">Her anın, sonsuz uzayda parlayan bir küredir.</p>
      </div>

      <button className="space-close-btn" onClick={handleClose} aria-label="Evreni kapat">✕</button>

      <p className="space-hint">Sürükle · Kaydır · Kürelere tıkla</p>

      {isOpen && selected && (
        <OrbPanel key={selected.id} memory={selected} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
