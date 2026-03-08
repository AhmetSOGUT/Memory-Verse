import { useEffect, useRef } from "react";
import { SpaceSceneController } from "../../universe/scene";

function SpaceScene({ isOpen, onClose, memories }) {
  const overlayRef = useRef(null);
  const canvasRef = useRef(null);
  const controllerRef = useRef(null);

  useEffect(() => {
    if (!overlayRef.current || !canvasRef.current) return;

    controllerRef.current = new SpaceSceneController({
      overlayEl: overlayRef.current,
      canvasContainerEl: canvasRef.current,
      memories,
    });

    return () => {
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.setMemories(memories);
  }, [memories]);

  useEffect(() => {
    if (!controllerRef.current) return;

    if (isOpen) {
      controllerRef.current.open();
    } else {
      controllerRef.current.close();
    }
  }, [isOpen]);

  return (
    <div
      ref={overlayRef}
      id="spaceScene"
      className={`space-scene ${isOpen ? "space-scene--visible" : ""}`}
      aria-hidden={!isOpen}
      style={{ display: isOpen ? "flex" : "none" }}
    >
      <div
        ref={canvasRef}
        id="spaceCanvasContainer"
        className="space-canvas-container"
      ></div>

      <div className="space-ui">
        <h2 className="space-title">Anı Evreni</h2>
        <p className="space-subtitle">
          Her anın, sonsuz uzayda parlayan bir küredir.
        </p>
      </div>

      <button className="space-close-btn" onClick={onClose}>
        ✕
      </button>

      <p className="space-hint">Sürükle · Kaydır · Kürelere tıkla</p>
    </div>
  );
}

export default SpaceScene;