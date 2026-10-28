import { useEffect, useState } from "react";
import Header from "./components/Header";
import Timeline from "./components/Timeline";
import MemoryModal from "./components/MemoryModal";
import ConfirmModal from "./components/ConfirmModal";
import FloatingHearts from "./components/FloatingHearts";
import {
  deleteMemory,
  getMemories,
  saveMemory,
  migrateFromLocalStorage,
} from "./data/memoryStorage";
import SpaceScene from "./components/universe/SpaceScene";
import type { Memory, MemoryInput } from "./types";

function App() {
  const [isSpaceOpen, setIsSpaceOpen] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  useEffect(() => {
    migrateFromLocalStorage().then(refreshMemories);
  }, []);

  async function refreshMemories() {
    const data = await getMemories();
    setMemories(data);
  }

  function handleAddNew() {
    setEditingMemory(null);
    setIsModalOpen(true);
  }

  function handleEdit(memory: Memory) {
    setEditingMemory(memory);
    setIsModalOpen(true);
  }

  function handleDelete(id: number) {
    setPendingDeleteId(id);
    setConfirmOpen(true);
  }

  async function handleConfirmDelete() {
    setConfirmOpen(false);
    if (pendingDeleteId !== null) await deleteMemory(pendingDeleteId);
    setPendingDeleteId(null);
    refreshMemories();
  }

  function handleCancelDelete() {
    setConfirmOpen(false);
    setPendingDeleteId(null);
  }

  async function handleSave(memory: MemoryInput) {
    setIsSaving(true);
    try {
      await saveMemory(memory, editingMemory?.id ?? null);
      await refreshMemories();
      setIsModalOpen(false);
      setEditingMemory(null);
    } finally {
      setIsSaving(false);
    }
  }

  function handleCloseModal() {
    setIsModalOpen(false);
    setEditingMemory(null);
  }

  return (
    <>
      <FloatingHearts />
      <Header />

      <Timeline
        memories={memories}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <button
        className="add-memory-btn"
        onClick={handleAddNew}
        title="Anı Ekle"
      >
        +
      </button>

      <button
        className="space-toggle-btn"
        onClick={() => setIsSpaceOpen(true)}
        title="Anı Evreni"
      >
        🌌
      </button>

      <MemoryModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSave}
        editingMemory={editingMemory}
        isSaving={isSaving}
      />

      <ConfirmModal
        isOpen={confirmOpen}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      <SpaceScene
        isOpen={isSpaceOpen}
        onClose={() => setIsSpaceOpen(false)}
        memories={memories}
      />
    </>
  );
}

export default App;