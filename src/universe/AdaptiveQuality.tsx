import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { QUALITY } from "./constants";

interface AdaptiveQualityProps {
  tier: number;
  onTierChange: (tier: number) => void;
}

/**
 * FPS'i izler; art arda yavaş ölçümde kaliteyi bir kademe düşürür (çözünürlük, bloom).
 * Yalnızca aşağı iner — yukarı çıkıp tekrar düşme (titreme) olmaz.
 */
export function AdaptiveQuality({ tier, onTierChange }: AdaptiveQualityProps) {
  const s = useRef({ elapsed: 0, frames: 0, warm: 0, bad: 0 });

  useFrame((_, delta) => {
    const st = s.current;
    if (st.warm < QUALITY.warmupSeconds) {
      st.warm += delta;
      return;
    }
    st.elapsed += delta;
    st.frames += 1;
    if (st.elapsed < QUALITY.sampleSeconds) return;

    const fps = st.frames / st.elapsed;
    st.elapsed = 0;
    st.frames = 0;
    if (QUALITY.debug) console.log(`[evren] ${fps.toFixed(0)} fps · kalite kademesi ${tier}`);

    st.bad = fps < QUALITY.lowFps ? st.bad + 1 : 0;
    if (st.bad >= QUALITY.badWindows && tier > 0) {
      st.bad = 0;
      st.warm = QUALITY.warmupSeconds - 1; // yeni ayarın oturması için kısa bekleme
      onTierChange(tier - 1);
    }
  });

  return null;
}