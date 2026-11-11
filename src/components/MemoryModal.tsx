import { useEffect, useMemo, useRef, useState } from "react";
import { canonicalCategory } from "../lib/search";
import { MAX_PHOTOS, memoryImages, photoName } from "../lib/photos";
import type { Memory, MemoryDraft, PhotoEdits } from "../types";

interface MemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (draft: MemoryDraft, photos: PhotoEdits) => void | Promise<void>;
  editingMemory: Memory | null;
  /** Daha önce kullanılan kategoriler (yazılabilir açılır liste). */
  categories: string[];
  isSaving: boolean;
}

/**
 * Kapalıyken hiçbir şey çizmez; açılınca formu yeni (temiz) bir bileşen olarak kurar.
 * Böylece form alanlarını elle sıfırlamaya gerek kalmaz.
 */
function MemoryModal({ isOpen, ...rest }: MemoryModalProps) {
  if (!isOpen) return null;
  return <MemoryForm key={rest.editingMemory?.id ?? "new"} {...rest} />;
}

/** Formdaki tek bir fotoğraf: mevcut (sunucuda kayıtlı) ya da yeni seçilmiş dosya. */
interface PhotoItem {
  /** Kararlı anahtar (mevcut fotoğrafın dosya adı ya da yeni-<n>). */
  key: string;
  /** Önizleme adresi (yeni dosyalarda blob adresi). */
  url: string;
  /** Mevcut fotoğrafın sunucudaki dosya adı; yeni seçilenlerde null. */
  name: string | null;
  /** Yeni seçilen dosya; kaydederken olduğu gibi yüklenir. */
  file: File | null;
}

function MemoryForm({ onClose, onSave, editingMemory, categories, isSaving }: Omit<MemoryModalProps, "isOpen">) {
  const [date, setDate] = useState(editingMemory?.date || "");
  const [title, setTitle] = useState(editingMemory?.title || "");
  const [description, setDescription] = useState(editingMemory?.description || "");
  const [category, setCategory] = useState(editingMemory?.category || "");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  /** Seçili fotoğraflar; ilk sıradaki kapak olur. */
  const [photos, setPhotos] = useState<PhotoItem[]>(() =>
    (editingMemory ? memoryImages(editingMemory) : []).map((url) => {
      const name = photoName(url);
      return { key: name, url, name, file: null };
    }),
  );
  /** Kaydederken silinecek mevcut fotoğrafların dosya adları. */
  const [removedPhotos, setRemovedPhotos] = useState<string[]>([]);
  const objectUrls = useRef<string[]>([]);
  const nextKey = useRef(0);
  const categoryBox = useRef<HTMLDivElement>(null);

  // Yeni dosyalar için üretilen blob adresleri, bileşen kapanınca serbest bırakılır
  useEffect(() => () => {
    for (const url of objectUrls.current) URL.revokeObjectURL(url);
  }, []);

  const suggestions = useMemo(() => {
    const needle = category.trim().toLocaleLowerCase("tr-TR");
    const list = needle
      ? categories.filter((name) => name.toLocaleLowerCase("tr-TR").includes(needle))
      : categories;
    return list.slice(0, 50);
  }, [categories, category]);

  // Liste açıkken dışarı tıklanınca kapansın
  useEffect(() => {
    if (!categoryOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (!categoryBox.current?.contains(event.target as Node)) setCategoryOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [categoryOpen]);

  function pickCategory(name: string) {
    setCategory(name);
    setCategoryOpen(false);
    setActiveIndex(-1);
  }

  function handleCategoryKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && suggestions.length > 0) {
      event.preventDefault();
      setCategoryOpen(true);
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp" && suggestions.length > 0) {
      event.preventDefault();
      setCategoryOpen(true);
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === "Enter" && categoryOpen && activeIndex >= 0 && suggestions[activeIndex]) {
      event.preventDefault();
      pickCategory(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setCategoryOpen(false);
    }
  }

  function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ""; // aynı dosya tekrar seçilebilsin
    if (picked.length === 0) return;

    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return;

    // Yeniden boyutlandırma/sıkıştırma YOK: dosyalar olduğu gibi yüklenir, önizleme için geçici adres üretilir.
    const items: PhotoItem[] = picked.slice(0, room).map((file) => {
      const url = URL.createObjectURL(file);
      objectUrls.current.push(url);
      return { key: `new-${nextKey.current++}`, url, name: null, file };
    });
    setPhotos((prev) => [...prev, ...items]);
  }

  function removePhoto(item: PhotoItem) {
    if (item.name) setRemovedPhotos((prev) => [...prev, item.name!]);
    else {
      URL.revokeObjectURL(item.url);
      objectUrls.current = objectUrls.current.filter((url) => url !== item.url);
    }
    setPhotos((prev) => prev.filter((p) => p.key !== item.key));
  }

  /** Fotoğrafı başa alır: kapak (küre/kart) o fotoğraf olur. */
  function makeCover(item: PhotoItem) {
    setPhotos((prev) => [item, ...prev.filter((p) => p.key !== item.key)]);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Sıra, formdaki görüntüleme sırasıdır; yeni dosyalar `added` içindeki indeksleriyle işaretlenir.
    const added: File[] = [];
    const order = photos.map((item) => {
      if (item.file) {
        added.push(item.file);
        return { kind: "new" as const, index: added.length - 1 };
      }
      return { kind: "existing" as const, name: item.name! };
    });

    onSave(
      { date, title, description, category: canonicalCategory(category, categories) },
      { added, removed: removedPhotos, order },
    );
  }

  const busy = isSaving;

  return (
    <div className="modal" style={{ display: "flex" }}>
      <div className="modal-content">
        <h2 style={{ marginBottom: "24px" }}>
          {editingMemory ? "Anıyı Düzenle 💖" : "Yeni Bir Anı 💖"}
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "15px" }}>
            <label>Tarih Seç</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              disabled={busy}
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label>Başlık</label>
            <input
              type="text"
              placeholder="Örn: İlk Akşam Yemeği"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={busy}
            />
          </div>

          {/* ── Kategori ── */}
          <div style={{ marginBottom: "15px" }} ref={categoryBox}>
            <label htmlFor="memory-category">Kategori</label>
            <div className="category-combobox">
              <input
                id="memory-category"
                type="text"
                placeholder="Örn: Tatil, Yıl Dönümü, İlkler…"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setCategoryOpen(true);
                  setActiveIndex(-1);
                }}
                onFocus={() => setCategoryOpen(true)}
                onKeyDown={handleCategoryKeyDown}
                maxLength={60}
                autoComplete="off"
                disabled={busy}
              />

              {category !== "" && (
                <button
                  type="button"
                  className="category-clear"
                  onClick={() => {
                    setCategory("");
                    setActiveIndex(-1);
                  }}
                  aria-label="Kategoriyi temizle"
                >
                  ✕
                </button>
              )}

              {categoryOpen && suggestions.length > 0 && (
                <ul className="category-options" role="listbox" aria-label="Önceki kategoriler">
                  {suggestions.map((name, index) => (
                    <li key={name}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={name.toLocaleLowerCase("tr-TR") === category.trim().toLocaleLowerCase("tr-TR")}
                        className={index === activeIndex ? "is-active" : undefined}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickCategory(name)}
                      >
                        <span aria-hidden="true">🏷️</span>
                        {name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {categoryOpen && suggestions.length === 0 && category.trim() !== "" && (
                <div className="category-new">Yeni kategori: “{category.trim()}”</div>
              )}
            </div>
            <p className="category-hint">
              Yaz ya da listeden seç — aynı yazılan kategoriler otomatik eşleşir.
            </p>
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label>Hikayenizi Yazın</label>
            <textarea
              rows={4}
              placeholder="O an neler hissetmiştin?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              disabled={busy}
            />
          </div>

          {/* ── Fotoğraf alanı ── */}
          <div style={{ marginBottom: "20px" }}>
            <label>Fotoğraflar</label>

            {photos.length === 0 ? (
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFilesChange}
                disabled={busy}
              />
            ) : (
              <div className="photo-picker">
                {photos.map((item, index) => (
                  <div key={item.key} className={`photo-thumb${index === 0 ? " photo-thumb--cover" : ""}`}>
                    <img
                      src={item.url}
                      alt={index === 0 ? "Kapak fotoğrafı" : `Fotoğraf ${index + 1}`}
                      onClick={() => makeCover(item)}
                      title={index === 0 ? "Kapak fotoğrafı" : "Kapak yapmak için dokun"}
                    />
                    {index === 0 && <span className="photo-thumb__badge">Kapak</span>}
                    <button
                      type="button"
                      className="photo-thumb__remove"
                      onClick={() => removePhoto(item)}
                      aria-label="Fotoğrafı kaldır"
                      disabled={busy}
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {photos.length < MAX_PHOTOS && (
                  <label className="photo-thumb photo-thumb--add" title="Fotoğraf ekle">
                    <span aria-hidden="true">＋</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFilesChange}
                      disabled={busy}
                      hidden
                    />
                  </label>
                )}
              </div>
            )}

            <p className="photo-picker__hint">
              {photos.length > 1
                ? "İlk fotoğraf kapak olur. Kapak yapmak istediğin fotoğrafa dokun."
                : "Birden fazla fotoğraf ekleyebilirsin. İlk fotoğraf kapak olur."}
              {photos.length > 0 && ` · ${photos.length}/${MAX_PHOTOS}`}
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              style={{
                flex: 1,
                background: "transparent",
                color: "white",
                border: "1px solid rgba(255,255,255,0.2)",
                cursor: busy ? "not-allowed" : "pointer",
                borderRadius: "12px",
                padding: "12px",
                opacity: busy ? 0.5 : 1,
              }}
            >
              İptal
            </button>

            <button
              type="submit"
              disabled={busy}
              style={{
                flex: 2,
                background: busy ? "rgba(255,126,95,0.4)" : "var(--gradient)",
                border: "none",
                color: "white",
                padding: "12px",
                borderRadius: "12px",
                cursor: busy ? "not-allowed" : "pointer",
                fontWeight: 600,
                transition: "background 0.3s",
              }}
            >
              {isSaving ? "💾 Kaydediliyor..." : "Kaydet 💕"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MemoryModal;