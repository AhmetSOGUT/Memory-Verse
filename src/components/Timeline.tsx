import MemoryCard from "./MemoryCard";
import EmptyState from "./EmptyState";
import type { Memory } from "../types";

interface TimelineProps {
  memories: Memory[];
  onEdit: (memory: Memory) => void;
  onDelete: (id: number) => void;
  /** Arama/filtre aktifken sonuç yoksa "henüz anı yok" yerine filtre mesajı gösterilir. */
  isFiltered?: boolean;
  onClearFilters?: () => void;
}

function Timeline({ memories, onEdit, onDelete, isFiltered = false, onClearFilters }: TimelineProps) {
  return (
    <div className="timeline-container">
      <div className="timeline-line"></div>

      <div id="memoriesWrapper">
        {memories.length === 0 ? (
          isFiltered ? (
            <div className="empty-state">
              <p style={{ fontSize: "3rem" }}>🔎</p>
              <h3>Aramanla eşleşen anı yok</h3>
              <p>Başka bir kelime dene ya da filtreleri temizle.</p>
              {onClearFilters && (
                <button className="primary-btn status-btn" onClick={onClearFilters}>
                  Filtreleri temizle
                </button>
              )}
            </div>
          ) : (
            <EmptyState />
          )
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
