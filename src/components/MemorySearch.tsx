import { useEffect, useRef, useState } from "react";

interface MemorySearchProps {
  query: string;
  onQueryChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  categories: string[];
  fromDate: string;
  onFromDateChange: (value: string) => void;
  toDate: string;
  onToDateChange: (value: string) => void;
  resultCount: number;
  totalCount: number;
  onClear: () => void;
}

/**
 * Sayfanın üstündeki arama/filtre çubuğu.
 * Tek metin kutusu başlık + içerik + kategori + tarihi birden arar; ayrıca kategori ve tarih aralığı süzgeci vardır.
 * "/" tuşu arama kutusuna odaklanır (form alanında yazmıyorsan).
 */
export default function MemorySearch({
  query,
  onQueryChange,
  category,
  onCategoryChange,
  categories,
  fromDate,
  onFromDateChange,
  toDate,
  onToDateChange,
  resultCount,
  totalCount,
  onClear,
}: MemorySearchProps) {
  const [datesOpen, setDatesOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasFilter = query.trim() !== "" || category !== "" || fromDate !== "" || toDate !== "";
  const options = category && !categories.includes(category) ? [category, ...categories] : categories;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      const active = document.activeElement;
      const typing =
        active instanceof HTMLElement &&
        (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
      if (typing) return;
      event.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="memory-search-wrap">
      <div className="memory-search">
        <div className="memory-search__top">
          <div className="memory-search__input">
            <span aria-hidden="true">🔍</span>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Başlık, içerik, kategori veya tarih ara…  ( / )"
              aria-label="Anılarda ara"
            />
            {query !== "" && (
              <button
                type="button"
                className="memory-search__clear-input"
                onClick={() => onQueryChange("")}
                aria-label="Aramayı temizle"
              >
                ✕
              </button>
            )}
          </div>

          <select
            className="memory-search__select"
            value={category}
            onChange={(event) => onCategoryChange(event.target.value)}
            aria-label="Kategoriye göre filtrele"
          >
            <option value="">🏷️ Tüm kategoriler</option>
            {options.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={`memory-search__dates-toggle ${datesOpen || fromDate !== "" || toDate !== "" ? "is-active" : ""}`}
            onClick={() => setDatesOpen((open) => !open)}
            aria-expanded={datesOpen}
          >
            📅 Tarih
          </button>
        </div>

        {datesOpen && (
          <div className="memory-search__dates">
            <label>
              Başlangıç
              <input
                type="date"
                value={fromDate}
                max={toDate || undefined}
                onChange={(event) => onFromDateChange(event.target.value)}
              />
            </label>
            <span aria-hidden="true">—</span>
            <label>
              Bitiş
              <input
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={(event) => onToDateChange(event.target.value)}
              />
            </label>
          </div>
        )}

        <div className="memory-search__footer">
          <span>
            {hasFilter ? (
              <>
                <strong>{resultCount}</strong> / {totalCount} anı bulundu
              </>
            ) : (
              <>{totalCount} anı</>
            )}
          </span>
          {hasFilter && (
            <button type="button" className="memory-search__clear" onClick={onClear}>
              Filtreleri temizle
            </button>
          )}
        </div>
      </div>
    </div>
  );
}