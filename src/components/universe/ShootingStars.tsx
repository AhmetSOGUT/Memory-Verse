import { useEffect, useState } from "react";

interface Star { id: number; left: number; top: number }

/** Üç buçuk saniyede bir ekranın üst köşesinden kayan yıldız (CSS animasyonu). */
export default function ShootingStars() {
  const [stars, setStars] = useState<Star[]>([]);

  useEffect(() => {
    let nextId = 0;
    const timeouts = new Set<number>();
    const interval = window.setInterval(() => {
      const id = nextId++;
      const star: Star = {
        id,
        left: window.innerWidth * (0.4 + Math.random() * 0.5),
        top: window.innerHeight * (Math.random() * 0.35),
      };
      setStars((prev) => [...prev, star]);
      const t = window.setTimeout(() => {
        setStars((prev) => prev.filter((s) => s.id !== id));
        timeouts.delete(t);
      }, 1700);
      timeouts.add(t);
    }, 3500);

    return () => {
      window.clearInterval(interval);
      timeouts.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  return (
    <>
      {stars.map((s) => (
        <div key={s.id} className="shooting-star" style={{ left: s.left, top: s.top }} />
      ))}
    </>
  );
}
