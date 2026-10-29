import MemoryCard from "./MemoryCard";
import EmptyState from "./EmptyState";
import type { Memory } from "../types";

interface TimelineProps {
  memories: Memory[];
  onEdit: (memory: Memory) => void;
  onDelete: (id: number) => void;
}

function Timeline({ memories, onEdit, onDelete }: TimelineProps) {
  return (
    <div className="timeline-container">
      <div className="timeline-line"></div>

      <div id="memoriesWrapper">
        {memories.length === 0 ? (
          <EmptyState />
        ) : (
          memories.map((memory) => (
            <MemoryCard
              key={memory.id}
              memory={memory}
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