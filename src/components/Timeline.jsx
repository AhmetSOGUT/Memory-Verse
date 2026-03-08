import MemoryCard from "./MemoryCard";
import EmptyState from "./EmptyState";

function Timeline({ memories, onEdit, onDelete }) {
  return (
    <div className="timeline-container">
      <div className="timeline-line"></div>

      <div id="memoriesWrapper">
        {memories.length === 0 ? (
          <EmptyState />
        ) : (
          memories.map((memory, index) => (
            <MemoryCard
              key={`${memory.date}-${memory.title}-${index}`}
              memory={memory}
              index={index}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default Timeline;