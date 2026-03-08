const DB_NAME = "MemoryVerseDB";
const DB_VERSION = 1;
const STORE_NAME = "memories";

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("date", "date", { unique: false });
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

// ─── Image compression ────────────────────────────────────────────────────────

/**
 * Compresses a base64 image string using a canvas.
 * Max dimension: 1200px, quality: 0.82 (JPEG)
 * Returns a compressed base64 string (or original if not an image).
 */
export function compressImage(base64, maxDim = 1200, quality = 0.82) {
  return new Promise((resolve) => {
    if (!base64 || !base64.startsWith("data:image")) {
      resolve(base64);
      return;
    }

    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      if (width <= maxDim && height <= maxDim) {
        // Already small enough — still re-encode to JPEG to save space
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", quality));
        return;
      }

      if (width > height) {
        height = Math.round((height / width) * maxDim);
        width = maxDim;
      } else {
        width = Math.round((width / height) * maxDim);
        height = maxDim;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };

    img.onerror = () => resolve(base64); // fallback: return original
    img.src = base64;
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns all memories sorted by date (oldest first).
 */
export async function getMemories() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).index("date").getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error("getMemories error:", err);
    return [];
  }
}

/**
 * Saves a new memory or updates an existing one (by id).
 * Automatically compresses the image before storing.
 */
export async function saveMemory(memory, editId = null) {
  try {
    // Compress image if present
    if (memory.image) {
      memory = { ...memory, image: await compressImage(memory.image) };
    }

    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

      let req;
      if (editId !== null) {
        req = store.put({ ...memory, id: editId });
      } else {
        const { id: _drop, ...memWithoutId } = memory;
        req = store.add(memWithoutId);
      }

      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error("saveMemory error:", err);
  }
}

/**
 * Deletes a memory by its IndexedDB id.
 */
export async function deleteMemory(id) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const req = tx.objectStore(STORE_NAME).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error("deleteMemory error:", err);
  }
}

// ─── One-time migration from localStorage ─────────────────────────────────────

/**
 * If old localStorage data exists, migrates it to IndexedDB and clears localStorage.
 * Call this once on app start.
 */
export async function migrateFromLocalStorage() {
  const LEGACY_KEY = "memories";
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) return;

  try {
    const old = JSON.parse(raw);
    if (!Array.isArray(old) || old.length === 0) {
      localStorage.removeItem(LEGACY_KEY);
      return;
    }

    for (const mem of old) {
      await saveMemory(mem, null);
    }

    localStorage.removeItem(LEGACY_KEY);
    console.info(`✅ ${old.length} anı localStorage'dan IndexedDB'ye taşındı.`);
  } catch (err) {
    console.error("Migration error:", err);
  }
}