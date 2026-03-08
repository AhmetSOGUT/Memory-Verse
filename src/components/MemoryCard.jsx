import { useState } from "react";

function MemoryCard({ memory, onEdit, onDelete }) {
  const [zoomOpen, setZoomOpen] = useState(false);

  const formattedDate = new Date(memory.date).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <div className="memory-card visible">
        <div className="timeline-dot"></div>

        <div className="card-content">
          <div className="card-actions">
            <button
              className="action-btn"
              onClick={() => onEdit(memory)}
              aria-label="Düzenle"
            >
              ✏️
            </button>

            <button
              className="action-btn"
              onClick={() => onDelete(memory.id)}
              aria-label="Sil"
            >
              🗑️
            </button>
          </div>

          <span className="date-badge">{formattedDate}</span>
          <h2 className="memory-title">{memory.title}</h2>
          <p className="memory-description">{memory.description}</p>

          {memory.image && (
            <img
              src={memory.image}
              className="memory-image"
              alt="Anı fotoğrafı"
              onClick={() => setZoomOpen(true)}
            />
          )}
        </div>
      </div>

      {zoomOpen && (
        <div
          onClick={() => setZoomOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.92)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "zoom-out",
            backdropFilter: "blur(8px)",
          }}
        >
          <img
            src={memory.image}
            alt="Tam ekran"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "92vw",
              maxHeight: "88vh",
              objectFit: "contain",
              borderRadius: "16px",
              boxShadow: "0 40px 80px rgba(0,0,0,0.8)",
            }}
          />
          <button
            onClick={() => setZoomOpen(false)}
            style={{
              position: "fixed",
              top: "20px",
              right: "20px",
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "50%",
              color: "white",
              width: "40px",
              height: "40px",
              fontSize: "18px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(8px)",
            }}
          >
            ✕
          </button>
          <p
            style={{
              position: "fixed",
              bottom: "24px",
              left: "50%",
              transform: "translateX(-50%)",
              color: "rgba(255,255,255,0.4)",
              fontSize: "0.8rem",
              pointerEvents: "none",
            }}
          >
            Kapatmak için tıkla veya ✕
          </p>
        </div>
      )}
    </>
  );
}

export default MemoryCard;