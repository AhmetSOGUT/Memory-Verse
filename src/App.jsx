import { useMemo, useState } from "react";
import Header from "./components/Header";
import Timeline from "./components/Timeline";
import MemoryModal from "./components/MemoryModal";
import FloatingHearts from "./components/FloatingHearts";
import { deleteMemory, getMemories, saveMemory } from "./data/memoryStorage";
import SpaceScene from "./components/universe/SpaceScene";

function App() {
  const [isSpaceOpen, setIsSpaceOpen] = useState(false);
  const [memories, setMemories] = useState(getMemories());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);

  const editingMemory = useMemo(() => {
    if (editingIndex === null) return null;
    return memories[editingIndex] || null;
  }, [editingIndex, memories]);

  function refreshMemories() {
    setMemories(getMemories());
  }

  function handleAddNew() {
    setEditingIndex(null);
    setIsModalOpen(true);
  }

  function handleEdit(index) {
    setEditingIndex(index);
    setIsModalOpen(true);
  }

  function handleDelete(index) {
    const confirmed = window.confirm("Bu anıyı silmek istiyor musun?");
    if (!confirmed) return;

    deleteMemory(index);
    refreshMemories();
  }

  function handleSave(memory) {
    saveMemory(memory, editingIndex);
    refreshMemories();
    setIsModalOpen(false);
    setEditingIndex(null);
  }

  function handleCloseModal() {
    setIsModalOpen(false);
    setEditingIndex(null);
  }

  function handleUniverseClick() {
    setIsSpaceOpen(true);
  }
  function handleCloseSpace() {
    setIsSpaceOpen(false);
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
        onClick={handleUniverseClick}
        title="Anı Evreni"
      >
        🌌
      </button>

      <MemoryModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSave}
        editingMemory={editingMemory}
      />

      <SpaceScene
        isOpen={isSpaceOpen}
        onClose={handleCloseSpace}
        memories={memories}
      />
    </>
  );
}

export default App;