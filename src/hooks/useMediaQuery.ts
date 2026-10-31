import { useSyncExternalStore } from "react";

/** Bir CSS medya koşulunun şu an geçerli olup olmadığını verir; ekran döndürülünce/boyut değişince güncellenir. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", notify);
      return () => mql.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}