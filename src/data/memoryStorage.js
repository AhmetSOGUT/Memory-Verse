const STORAGE_KEY = "memories";

export function getMemories() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveMemory(memory, editIndex = null) {
  const memories = getMemories();

  if (editIndex !== null) {
    memories[editIndex] = memory;
  } else {
    memories.push(memory);
  }

  memories.sort((a, b) => new Date(a.date) - new Date(b.date));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
}

export function deleteMemory(index) {
  const memories = getMemories();
  memories.splice(index, 1);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
}