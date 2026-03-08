import { useEffect, useState } from "react";

function MemoryModal({ isOpen, onClose, onSave, editingMemory }) {
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null);

  useEffect(() => {
    if (editingMemory) {
      setDate(editingMemory.date || "");
      setTitle(editingMemory.title || "");
      setDescription(editingMemory.description || "");
      setImage(editingMemory.image || null);
    } else {
      setDate("");
      setTitle("");
      setDescription("");
      setImage(null);
    }
  }, [editingMemory, isOpen]);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      setImage(ev.target.result);
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit(e) {
    e.preventDefault();

    onSave({
      date,
      title,
      description,
      image,
    });
  }

  if (!isOpen) return null;

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
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label>Hikayenizi Yazın</label>
            <textarea
              rows="4"
              placeholder="O an neler hissetmiştin?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label>Fotoğraf Ekle</label>
            <input type="file" accept="image/*" onChange={handleFileChange} />
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                background: "transparent",
                color: "white",
                border: "1px solid rgba(255,255,255,0.2)",
                cursor: "pointer",
                borderRadius: "12px",
                padding: "12px",
              }}
            >
              İptal
            </button>

            <button
              type="submit"
              style={{
                flex: 2,
                background: "var(--gradient)",
                border: "none",
                color: "white",
                padding: "12px",
                borderRadius: "12px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Kaydet 💕
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MemoryModal;