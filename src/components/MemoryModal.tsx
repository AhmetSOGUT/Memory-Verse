import { useEffect, useMemo, useRef, useState } from "react";
import { canonicalCategory } from "../lib/search";
import type { Memory, MemoryDraft, PhotoChange } from "../types";

interface MemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (draft: MemoryDraft, photo: PhotoChange) => void | Promise<void>;
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

/** Dosya boyutunu okunur biçimde yazar (KB / MB). */
function formatSize(bytes: number): string {
  const kb = bytes / 1024;
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(0)} KB`;
}

function MemoryForm({ onClose, onSave, editingMemory, categories, isSaving }: Omit<MemoryModalProps, "isOpen">) {
  const [date, setDate] = useState(editingMemory?.date || "");
  const [title, setTitle] = useState(editingMemory?.title || "");
  const [description, setDescription] = useState(editingMemory?.description || "");
  const [category, setCategory] = useState(editingMemory?.category || "");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  /** Formda gösterilen fotoğraf adresi: mevcut anının fotoğrafı ya da yeni seçilen dosyanın blob adresi. */
  const [preview, setPreview] = useState<string | null>(editingMemory?.image || null);
  /** Yeni seçilen dosya; sunucuya olduğu gibi gönderilir (kalite kaybı olmaz). */
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [pickedSize, setPickedSize] = useState<string | null>(null);
  /** Mevcut fotoğraf kullanıcı tarafından kaldırıldı mı? (kaydederken silinir) */
  const [imageRemoved, setImageRemoved] = useState(false);
  const objectUrl = useRef<string | null>(null);
  const categoryBox = useRef<HTMLDivElement>(null);

  // Önizleme için oluşturulan blob adresi, bileşen kapanınca serbest bırakılır
  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Yeniden boyutlandırma/sıkıştırma YOK: dosya olduğu gibi yüklenir, önizleme için geçici adres üretilir.
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    const url = URL.createObjectURL(file);
    objectUrl.current = url;

    setPickedFile(file);
    setPickedSize(formatSize(file.size));
    setPreview(url);
    setImageRemoved(false);
  }

  function handleRemoveImage() {
    if (objectUrl.current) {
      URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
    }
    setPickedFile(null);
    setPickedSize(null);
    setPreview(null);
    setImageRemoved(true);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    let photo: PhotoChange = { kind: "keep" };
    if (pickedFile) photo = { kind: "set", file: pickedFile };
    else if (imageRemoved) photo = { kind: "remove" };
    onSave({ date, title, description, category: canonicalCategory(category, categories) }, photo);
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
            <label>Fotoğraf Ekle</label>

            {!preview ? (
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={busy}
              />
            ) : (
              <div style={{ marginTop: "10px" }}>
                {/* Önizleme */}
                <div style={{ position: "relative", display: "inline-block", width: "100%" }}>
                  <img
                    src={preview}
                    alt="Önizleme"
                    style={{
                      width: "100%",
                      borderRadius: "12px",
                      maxHeight: "200px",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "8px",
                      background: "rgba(0,0,0,0.7)",
                      border: "none",
                      borderRadius: "50%",
                      color: "white",
                      width: "28px",
                      height: "28px",
                      cursor: "pointer",
                      fontSize: "14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Fotoğraf bilgisi: kalite korunur, sıkıştırma yapılmaz */}
                {pickedSize && (
                  <p style={{ fontSize: "0.78rem", color: "#6ee7b7", marginTop: "6px" }}>
                    ✅ {pickedSize} · orijinal kalite (yeniden sıkıştırılmaz)
                  </p>
                )}
              </div>
            )}
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