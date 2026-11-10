import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CategoryStat } from "../lib/search";

interface MemorySearchProps {
  query: string;
  onQueryChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  categories: string[];
  categoryStats: CategoryStat[];
  fromDate: string;
  onFromDateChange: (value: string) => void;
  toDate: string;
  onToDateChange: (value: string) => void;
  resultCount: number;
  totalCount: number;
  onClear: () => void;
}

const pad = (value: number) => String(value).padStart(2, "0");
const toIso = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** "Son 7 gün / Bu ay / Bu yıl" gibi tek dokunuşluk tarih aralıkları. */
function buildPresets() {
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 6);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const yearStart = new Date(today.getFullYear(), 0, 1);
  return [
    { key: "week", label: "Son 7 gün", from: toIso(weekStart), to: toIso(today) },
    { key: "month", label: "Bu ay", from: toIso(monthStart), to: toIso(today) },
    { key: "year", label: "Bu yıl", from: toIso(yearStart), to: toIso(today) },
  ];
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20.5 20.5-3.9-3.9" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/**
 * Arama & filtre: ana ekranda yer kaplamaz.
 * Masaüstünde sağ kenardaki ince sekme, telefonda alt ortadaki yüzen düğme paneli açar.
 * Panel sağdan (telefonda alttan) kayarak gelir; yazdıkça sonuçlar canlı süzülür.
 * "/" ya da Ctrl/Cmd + K ile açılır, Esc ile kapanır.
 */
export default function MemorySearch({
  query,
  onQueryChange,
  category,
  onCategoryChange,
  categories,
  categoryStats,
  fromDate,
  onFromDateChange,
  toDate,
  onToDateChange,
  resultCount,
  totalCount,
  onClear,
}: MemorySearchProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const presets = useMemo(() => buildPresets(), []);

  const hasFilter = query.trim() !== "" || category !== "" || fromDate !== "" || toDate !== "";
  const datesActive = fromDate !== "" || toDate !== "";
  const activePreset = presets.find((preset) => preset.from === fromDate && preset.to === toDate)?.key ?? "";

  // Listede olmayan (ör. az önce silinmiş) bir kategori seçiliyse yine de göster.
  const stats = useMemo(() => {
    if (!category || categoryStats.some((stat) => stat.name === category)) return categoryStats;
    return [{ name: category, count: 0 }, ...categoryStats];
  }, [category, categoryStats]);

  const closePanel = useCallback(() => {
    triggerRef.current?.focus();
    setOpen(false);
  }, []);

  /* Klavye kısayolları: "/" veya Ctrl/Cmd + K açar, Esc kapatır. */
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const active = document.activeElement;
      const typing =
        active instanceof HTMLElement &&
        (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);

      if (event.key === "Escape") {
        if (!open) return;
        event.preventDefault();
        closePanel();
        return;
      }

      if (document.querySelector(".modal")) return; // anı formu açıkken aramayı kapalı tut

      if ((event.ctrlKey || event.metaKey) && (event.key === "k" || event.key === "K")) {
        event.preventDefault();
        setOpen(true);
        return;
      }

      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      if (typing) return;
      event.preventDefault();
      setOpen(true);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, closePanel]);

  /* Panel açıkken sayfa kaymasın; açılışta arama kutusuna odaklan. */
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 160);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timer);
    };
  }, [open]);

  function togglePreset(from: string, to: string) {
    if (fromDate === from && toDate === to) {
      onFromDateChange("");
      onToDateChange("");
    } else {
      onFromDateChange(from);
      onToDateChange(to);
    }
  }

  return (
    <>
      {hasFilter && (
        <div className="memory-search__status" role="status">
          <span className="memory-search__pulse" aria-hidden="true" />
          <span>
            <strong>{resultCount}</strong> / {totalCount} anı
          </span>
          <button type="button" className="memory-search__status-clear" onClick={onClear}>
            Temizle
          </button>
        </div>
      )}

      <button
        ref={triggerRef}
        type="button"
        className={`search-tab${hasFilter ? " is-active" : ""}`}
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="memory-search-panel"
        title="Anılarda ara ve filtrele ( / )"
      >
        <span className="search-tab__icon">
          <SearchIcon />
        </span>
        <span className="search-tab__label">Ara</span>
        {hasFilter && (
          <span className="search-tab__badge" aria-label={`${resultCount} sonuç`}>
            {resultCount > 99 ? "99+" : resultCount}
          </span>
        )}
      </button>

      <div className={`search-drawer${open ? " is-open" : ""}`} aria-hidden={!open}>
        <div className="search-drawer__backdrop" onClick={closePanel} aria-hidden="true" />

        <aside
          id="memory-search-panel"
          className="search-drawer__panel"
          role="dialog"
          aria-modal="true"
          aria-label="Anılarda ara ve filtrele"
        >
          <span className="search-drawer__glow" aria-hidden="true" />
          <span className="search-drawer__grip" aria-hidden="true" />

          <header className="search-drawer__head">
            <div>
              <p className="search-drawer__eyebrow">Koleksiyon</p>
              <h2 className="search-drawer__title">Anılarda ara</h2>
            </div>
            <button type="button" className="search-drawer__close" onClick={closePanel} aria-label="Aramayı kapat">
              <CloseIcon />
            </button>
          </header>

          <div className="search-drawer__body">
            <div className="search-field">
              <span className="search-field__icon">
                <SearchIcon />
              </span>
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Bir an, bir yer, bir his…"
                aria-label="Anılarda ara"
              />
              {query !== "" ? (
                <button
                  type="button"
                  className="search-field__clear"
                  onClick={() => onQueryChange("")}
                  aria-label="Aramayı temizle"
                >
                  ✕
                </button>
              ) : (
                <kbd className="search-field__kbd" aria-hidden="true">
                  /
                </kbd>
              )}
            </div>

            <section className="search-section">
              <div className="search-section__head">
                <span className="search-section__title">Kategoriler</span>
                <span className="search-section__meta">
                  {categories.length > 0 ? `${categories.length} etiket` : "henüz yok"}
                </span>
              </div>
              <div className="search-chips" role="group" aria-label="Kategoriye göre filtrele">
                <button
                  type="button"
                  className={`search-chip${category === "" ? " is-active" : ""}`}
                  onClick={() => onCategoryChange("")}
                  aria-pressed={category === ""}
                >
                  <span className="search-chip__label">Tümü</span>
                  <span className="search-chip__count">{totalCount}</span>
                </button>
                {stats.map((stat) => (
                  <button
                    key={stat.name}
                    type="button"
                    className={`search-chip${category === stat.name ? " is-active" : ""}`}
                    onClick={() => onCategoryChange(category === stat.name ? "" : stat.name)}
                    aria-pressed={category === stat.name}
                    title={stat.name}
                  >
                    <span className="search-chip__label">{stat.name}</span>
                    <span className="search-chip__count">{stat.count}</span>
                  </button>
                ))}
              </div>
              {categories.length === 0 && (
                <p className="search-section__empty">Anılara kategori ekledikçe burada birikir.</p>
              )}
            </section>

            <section className="search-section">
              <div className="search-section__head">
                <span className="search-section__title">Tarih aralığı</span>
                {datesActive && (
                  <button
                    type="button"
                    className="search-section__reset"
                    onClick={() => {
                      onFromDateChange("");
                      onToDateChange("");
                    }}
                  >
                    Sıfırla
                  </button>
                )}
              </div>

              <div className="search-presets">
                {presets.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    className={`search-preset${activePreset === preset.key ? " is-active" : ""}`}
                    onClick={() => togglePreset(preset.from, preset.to)}
                    aria-pressed={activePreset === preset.key}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="search-dates">
                <label className="search-date">
                  <span>Başlangıç</span>
                  <input
                    type="date"
                    value={fromDate}
                    max={toDate || undefined}
                    onChange={(event) => onFromDateChange(event.target.value)}
                  />
                </label>
                <span className="search-date__arrow" aria-hidden="true">
                  →
                </span>
                <label className="search-date">
                  <span>Bitiş</span>
                  <input
                    type="date"
                    value={toDate}
                    min={fromDate || undefined}
                    onChange={(event) => onToDateChange(event.target.value)}
                  />
                </label>
              </div>
            </section>
          </div>

          <footer className="search-drawer__foot">
            <div className="search-result">
              <strong>{resultCount}</strong>
              <span>{hasFilter ? `/ ${totalCount} anı` : "anı"}</span>
            </div>
            {hasFilter && (
              <button type="button" className="search-reset-btn" onClick={onClear}>
                Temizle
              </button>
            )}
            <button type="button" className="search-done-btn" onClick={closePanel}>
              {resultCount === 0 ? "Tamam" : "Sonuçları gör"}
            </button>
          </footer>
        </aside>
      </div>
    </>
  );
}
