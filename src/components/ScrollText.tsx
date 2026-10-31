import { useEffect, useRef, useState, type ReactNode } from "react";

interface ScrollTextProps {
  className: string;
  children: ReactNode;
}

/**
 * Uzun yazı için kutu: yüksekliği CSS'teki max-height ile sınırlanır, fazlası kutunun İÇİNDE aşağı kayar
 * (kartın geri kalanı, ör. fotoğraf, yerinde kalır). Altta okunmamış içerik varsa `data-more="true"` olur
 * ve CSS soluk bir gölge gösterir.
 */
export default function ScrollText({ className, children }: ScrollTextProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setMore(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
    el.addEventListener("scroll", update, { passive: true });
    // ResizeObserver, gözlem başlar başlamaz bir kez çalışır: ilk durum da böylece hesaplanır
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [children]);

  return (
    <div ref={ref} className={className} data-more={more} tabIndex={more ? 0 : undefined}>
      {children}
    </div>
  );
}