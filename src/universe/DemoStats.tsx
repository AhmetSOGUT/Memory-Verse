import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { WorldStore } from "./world";

/** Deneme modunda (?demo=N) köşede anı sayısı, tam çizilen küre, çizim çağrısı ve FPS gösterir. */
export function DemoStats({ store }: { store: React.RefObject<WorldStore> }) {
  const acc = useRef({ frames: 0, since: 0, draws: 0 });

  useFrame(({ gl, camera }) => {
    const a = acc.current;
    const now = performance.now();
    if (a.since === 0) a.since = now;
    gl.info.autoReset = false; // son geçişi değil, karedeki tüm geçişleri say
    a.draws = Math.max(a.draws, gl.info.render.calls);
    gl.info.reset();
    a.frames++;
    if (now - a.since < 500) return;
    const fps = (a.frames * 1000) / (now - a.since);
    const g = store.current;
    const el = document.getElementById("demoStats");
    if (el) {
      el.textContent =
        `anı ${g.n} · tam küre ${g.near.size} · çizim ${a.draws} · ${fps.toFixed(0)} fps · merkezden ${camera.position.length().toFixed(0)}`;
    }
    (window as unknown as { __mvWorld?: unknown }).__mvWorld = { store: g, camera };
    a.frames = 0;
    a.draws = 0;
    a.since = now;
  });
  return null;
}