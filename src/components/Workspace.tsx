import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../api/client";
import {
  createMemory, deleteMemory, listMemories, removeMemoryPhoto, setMemoryPhoto, updateMemory,
} from "../api/memories";
import type { AuthUser, Memory, MemoryDraft, PhotoChange } from "../types";
import ConfirmModal from "./ConfirmModal";
import FloatingHearts from "./FloatingHearts";
import Header from "./Header";
import MemoryModal from "./MemoryModal";
import Timeline from "./Timeline";
import Toast from "./Toast";
import SpaceScene from "./universe/SpaceScene";
import UserBar from "./UserBar";

interface WorkspaceProps {
  user: AuthUser;
  onLogout: () => void;
}

type LoadState = "loading" | "ready" | "error";

/**
 * Giriş yapılmış ana ekran. Çıkış yapınca bu bileşen kaldırılır, tüm anı verisi de onunla gider.
 */
function Workspace({ user, onLogout }: WorkspaceProps) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);

  const [isSpaceOpen, setIsSpaceOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    let cancelled = false;
    listMemories()
      .then((data) => {
        if (cancelled) return;
        setMemories(data);
        setLoadState("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(errorMessage(err));
        setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  function retryLoad() {
    setLoadState("loading");
    setLoadAttempt((n) => n + 1);
  }

  async function refresh() {
    setMemories(await listMemories());
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
    const id = pendingDeleteId;
    setConfirmOpen(false);
    setPendingDeleteId(null);
    if (id === null) return;
    try {
      await deleteMemory(id);
      await refresh();
    } catch (err) {
      setToast(`Anı silinemedi: ${errorMessage(err)}`);
    }
  }

  function handleCancelDelete() {
    setConfirmOpen(false);
    setPendingDeleteId(null);
  }

  async function handleSave(draft: MemoryDraft, photo: PhotoChange) {
    setIsSaving(true);

    // 1) Anının kendisi. Başarısız olursa form açık kalır, kullanıcı tekrar deneyebilir.
    let saved: Memory;
    try {
      saved = editingMemory ? await updateMemory(editingMemory.id, draft) : await createMemory(draft);
    } catch (err) {
      setToast(`Anı kaydedilemedi: ${errorMessage(err)}`);
      setIsSaving(false);
      return;
    }

    // 2) Fotoğraf. Anı artık kayıtlı olduğundan bir hata formu açık tutmaz (çift kayıt olmasın).
    let photoError: string | null = null;
    try {
      if (photo.kind === "set") await setMemoryPhoto(saved.id, photo.dataUrl);
      else if (photo.kind === "remove") await removeMemoryPhoto(saved.id);
    } catch (err) {
      photoError = errorMessage(err);
    }

    try {
      await refresh();
    } catch (err) {
      setToast(`Liste yenilenemedi: ${errorMessage(err)}`);
    }

    setIsModalOpen(false);
    setEditingMemory(null);
    setIsSaving(false);
    if (photoError) setToast(`Anı kaydedildi ama fotoğraf yüklenemedi: ${photoError}`);
  }

  function handleCloseModal() {
    setIsModalOpen(false);
    setEditingMemory(null);
  }

  return (
    <>
      <FloatingHearts />
      <UserBar name={user.displayName} onLogout={onLogout} />
      <Header />

      {loadState === "loading" && <p className="status-inline">Anılar yükleniyor…</p>}
      {loadState === "error" && (
        <div className="status-inline status-inline--error" role="alert">
          <p>Anılar yüklenemedi: {loadError}</p>
          <button className="primary-btn status-btn" onClick={retryLoad}>
            Tekrar dene
          </button>
        </div>
      )}
      {loadState === "ready" && <Timeline memories={memories} onEdit={handleEdit} onDelete={handleDelete} />}

      <button className="add-memory-btn" onClick={handleAddNew} title="Anı Ekle">
        +
      </button>

      <button className="space-toggle-btn" onClick={() => setIsSpaceOpen(true)} title="Anı Evreni">
        🌌
      </button>

      <MemoryModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSave}
        editingMemory={editingMemory}
        isSaving={isSaving}
      />

      <ConfirmModal isOpen={confirmOpen} onConfirm={handleConfirmDelete} onCancel={handleCancelDelete} />

      <SpaceScene isOpen={isSpaceOpen} onClose={() => setIsSpaceOpen(false)} memories={memories} />

      <Toast message={toast} onClose={dismissToast} />
    </>
  );
}

export default Workspace;