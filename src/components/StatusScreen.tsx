import FloatingHearts from "./FloatingHearts";

interface StatusScreenProps {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Tam ekran durum mesajı: yükleniyor, sunucuya ulaşılamıyor vb. */
function StatusScreen({ title, message, actionLabel, onAction }: StatusScreenProps) {
  return (
    <>
      <FloatingHearts />
      <div className="status-screen" role="status">
        <h2>{title}</h2>
        {message && <p>{message}</p>}
        {actionLabel && onAction && (
          <button className="primary-btn status-btn" onClick={onAction}>
            {actionLabel}
          </button>
        )}
      </div>
    </>
  );
}

export default StatusScreen;