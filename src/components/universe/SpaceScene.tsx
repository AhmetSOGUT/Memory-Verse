import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { Memory } from "../../types";
import { demoOptionsFromUrl, mergeDemo } from "../../universe/demo";
import OrbPanel from "./OrbPanel";


// Three.js ayrı pakete bölünür; timeline açılırken yüklenmez.
const UniverseCanvas = lazy(() => import("../../universe/UniverseCanvas"));

interface SpaceSceneProps {
  isOpen: boolean;
  onClose: () => void;
  memories: Memory[];
}

export default function SpaceScene({ isOpen, onClose, memories: realMemories }: SpaceSceneProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  /** Her artışta kamera dünyanın merkezine döner. */
  const [homeTick, setHomeTick] = useState(0);
  // Gizli deneme modu: adreste ?demo=300 varsa o kadar sahte anı eklenir (yalnızca burada görünür, kaydedilmez)
  const demo = useMemo(() => demoOptionsFromUrl(), []);
  const demoCount = demo.count;
  const memories = useMemo(
    () => (demoCount ? mergeDemo(realMemories, demoCount, demo.photo) : realMemories),
    [realMemories, demoCount, demo.photo],
  );
  // Silinmiş/değişmiş anıya işaret ediyorsa otomatik boşa düşer
  const selected = memories.find((m) => m.id === selectedId) ?? null;
  const selectedIndex = selected ? memories.indexOf(selected) : -1;

  // Esc: seçili küreyi bırak
  useEffect(() => {
    if (!isOpen || selectedId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, selectedId]);

  function handleClose() {
    setSelectedId(null);
    onClose();
  }

  const goHome = () => {
    setSelectedId(null);
    setHomeTick((t) => t + 1);
  };
  const goNewest = () => {
    const last = memories[memories.length - 1];
    if (last) setSelectedId(last.id);
  };
  const goTo = (index: number) => {
    const target = memories[index];
    if (target) setSelectedId(target.id);
  };

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
              homeTick={homeTick}
            />
          </Suspense>
        )}
      </div>

      <div className="space-ui">
        <h2 className="space-title">Anı Evreni</h2>
        <p className="space-subtitle">Her anın, sonsuz uzayda parlayan bir küredir.</p>
      </div>

      {demoCount > 0 && <p id="demoStats" className="demo-stats" />}

      <div className="space-nav">
        <button onClick={goHome} title="Merkeze dön" aria-label="Merkeze dön">⌂</button>
        <button onClick={goNewest} title="En yeni anıya git" aria-label="En yeni anıya git">⏭</button>
      </div>

      <button className="space-close-btn" onClick={handleClose} aria-label="Evreni kapat">✕</button>

      <p className="space-hint">
        <span className="hint-mouse">Sürükle: bak · Tekerlek / W-S: ileri-geri · Küreye tıkla: incele</span>
        <span className="hint-touch">Sürükle: bak · İki parmak: ileri-geri · Küreye dokun: incele</span>
      </p>

      {isOpen && selected && (
        <OrbPanel
          key={selected.id}
          memory={selected}
          onClose={() => setSelectedId(null)}
          position={{ index: selectedIndex, total: memories.length }}
          onPrev={selectedIndex > 0 ? () => goTo(selectedIndex - 1) : undefined}
          onNext={selectedIndex < memories.length - 1 ? () => goTo(selectedIndex + 1) : undefined}
        />
      )}
    </div>
  );
}