interface ConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  message?: string;
}

function ConfirmModal({ isOpen, onConfirm, onCancel, message }: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.85)",
        backdropFilter: "blur(8px)",
        zIndex: 5000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#1e293b",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "24px",
          padding: "36px 32px",
          width: "90%",
          maxWidth: "380px",
          textAlign: "center",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
        }}
      >
        <p style={{ fontSize: "2.4rem", marginBottom: "12px" }}>🗑️</p>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "10px" }}>
          Anıyı Sil
        </h3>
        <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginBottom: "28px", lineHeight: 1.6 }}>
          {message || "Bu anıyı silmek istediğine emin misin? Bu işlem geri alınamaz."}
        </p>

        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.15)",
              background: "transparent",
              color: "white",
              cursor: "pointer",
              fontSize: "0.95rem",
              fontFamily: "inherit",
            }}
          >
            Vazgeç
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "12px",
              border: "none",
              background: "linear-gradient(135deg, #ef4444, #b91c1c)",
              color: "white",
              cursor: "pointer",
              fontSize: "0.95rem",
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            Evet, Sil
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;