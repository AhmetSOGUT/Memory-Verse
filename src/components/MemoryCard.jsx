function MemoryCard({ memory, index, onEdit, onDelete }) {
  const formattedDate = new Date(memory.date).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="memory-card visible">
      <div className="timeline-dot"></div>

      <div className="card-content">
        <div className="card-actions">
          <button
            className="action-btn"
            onClick={() => onEdit(index)}
            aria-label="Düzenle"
          >
            ✏️
          </button>

          <button
            className="action-btn"
            onClick={() => onDelete(index)}
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
          />
        )}
      </div>
    </div>
  );
}

export default MemoryCard;