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

function App() {
  const [isSpaceOpen, setIsSpaceOpen] = useState(false);
  const [memories, setMemories] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

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

  function handleEdit(memory) {
    setEditingMemory(memory);
    setIsModalOpen(true);
  }

  function handleDelete(id) {
    setPendingDeleteId(id);
    setConfirmOpen(true);
  }

  async function handleConfirmDelete() {
    setConfirmOpen(false);
    await deleteMemory(pendingDeleteId);
    setPendingDeleteId(null);
    refreshMemories();
  }

  function handleCancelDelete() {
    setConfirmOpen(false);
    setPendingDeleteId(null);
  }

  async function handleSave(memory) {
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