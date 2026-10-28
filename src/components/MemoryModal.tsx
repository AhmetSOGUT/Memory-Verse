import { useState } from "react";
import { compressImage } from "../data/memoryStorage";
import type { Memory, MemoryInput } from "../types";

interface MemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (memory: MemoryInput) => void | Promise<void>;
  editingMemory: Memory | null;
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

function MemoryForm({ onClose, onSave, editingMemory, isSaving }: Omit<MemoryModalProps, "isOpen">) {
  const [date, setDate] = useState(editingMemory?.date || "");
  const [title, setTitle] = useState(editingMemory?.title || "");
  const [description, setDescription] = useState(editingMemory?.description || "");
  const [image, setImage] = useState<string | null>(editingMemory?.image || null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [originalSize, setOriginalSize] = useState<string | null>(null);
  const [compressedSize, setCompressedSize] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    setOriginalSize((file.size / 1024).toFixed(1));

    const reader = new FileReader();
    reader.onload = async () => {
      const raw = reader.result as string;
      const compressed = await compressImage(raw);
      const compressedBytes = Math.round((compressed.length * 3) / 4);
      setCompressedSize((compressedBytes / 1024).toFixed(1));
      setImage(compressed);
      setIsCompressing(false);
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveImage() {
    setImage(null);
    setOriginalSize(null);
    setCompressedSize(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSave({ date, title, description, image });
  }

  const busy = isCompressing || isSaving;

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

            {!image ? (
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
                    src={image}
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

                {/* Sıkıştırma bilgisi */}
                {isCompressing && (
                  <p style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: "6px" }}>
                    ⏳ Fotoğraf optimize ediliyor...
                  </p>
                )}
                {!isCompressing && originalSize && compressedSize && (
                  <p style={{ fontSize: "0.78rem", color: "#6ee7b7", marginTop: "6px" }}>
                    ✅ {originalSize} KB → {compressedSize} KB'a sıkıştırıldı
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
              {isCompressing
                ? "⏳ Optimize ediliyor..."
                : isSaving
                ? "💾 Kaydediliyor..."
                : "Kaydet 💕"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MemoryModal;