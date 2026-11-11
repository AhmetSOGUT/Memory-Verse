import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, errorMessage } from "../api/client";
import {
  createMemory, deleteMemory, listMemories, removeMemoryPhoto, setMemoryPhoto, updateMemory,
} from "../api/memories";
import { useLiveSync, type LiveEvent } from "../hooks/useLiveSync";
import type { AuthUser, Memory, MemoryDraft, PhotoChange } from "../types";
import ConfirmModal from "./ConfirmModal";
import FloatingHearts from "./FloatingHearts";
import Header from "./Header";
import MemoryModal from "./MemoryModal";
import Timeline from "./Timeline";
import Toast from "./Toast";
import SpaceScene from "./universe/SpaceScene";
import UserBar from "./UserBar";
import { collectCategoryStats, filterMemories } from "../lib/search";
import MemorySearch from "./MemorySearch";

interface WorkspaceProps {
  user: AuthUser;
  onLogout: () => void;
}

type LoadState = "loading" | "ready" | "error";
interface ToastState {
  text: string;
  kind: "info" | "error";
}

/** Canlı bildirimlerde uzun başlıklar mesajı şişirmesin. */
const shorten = (text: string) => (text.length > 60 ? `${text.slice(0, 60)}…` : text);

function describeEvent(e: LiveEvent): string {
  const title = `“${shorten(e.title)}”`;
  if (e.action === "created") return `${e.by} yeni bir anı ekledi: ${title}`;
  if (e.action === "deleted") return `${e.by} ${title} anısını sildi`;
  return `${e.by} ${title} anısını güncelledi`;
}

/**
 * Giriş yapılmış ana ekran. Çıkış yapınca bu bileşen kaldırılır, tüm anı verisi de onunla gider.
 * Canlı senkron: başka bir kişi/cihaz bir anıyı ekler, düzenler ya da silerse liste kendiliğinden yenilenir
 * (zaman çizgisi ve evren aynı listeyi kullanır).
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

  const [toast, setToast] = useState<ToastState | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const showToast = useCallback((text: string, kind: ToastState["kind"] = "error") => setToast({ text, kind }), []);

  // Arama / filtre durumu
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const categoryStats = useMemo(() => collectCategoryStats(memories), [memories]);
  const categories = useMemo(() => categoryStats.map((stat) => stat.name), [categoryStats]);
  const filteredMemories = useMemo(
    () => filterMemories(memories, { query, category: categoryFilter, fromDate, toDate }),
    [memories, query, categoryFilter, fromDate, toDate],
  );
  const hasActiveFilters =
    query.trim() !== "" || categoryFilter !== "" || fromDate !== "" || toDate !== "";

  const clearFilters = useCallback(() => {
    setQuery("");
    setCategoryFilter("");
    setFromDate("");
    setToDate("");
  }, []);

  /** Düzenleme formu açılırken anının sürümü; kaydederken sunucuya "arada değişti mi?" kontrolü için gönderilir. */
  const editBase = useRef<string | undefined>(undefined);
  const refreshTimer = useRef<number | undefined>(undefined);
  /** Yeni eklenen anının hemen ardından gelen "güncellendi" (fotoğraf yüklemesi) bildirimini bastırmak için. */
  const recentCreated = useRef(new Map<number, number>());

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

  /** Art arda gelen bildirimler tek bir yenilemede birleşir (anı + fotoğraf yüklemesi gibi). */
  const scheduleRefresh = useCallback(() => {
    window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => {
      listMemories()
        .then(setMemories)
        .catch(() => undefined); // sessizce: bir sonraki bildirimde ya da bağlantı yenilenince tekrar denenir
    }, 400);
  }, []);
  useEffect(() => () => window.clearTimeout(refreshTimer.current), []);

  const handleLiveEvent = useCallback(
    (e: LiveEvent) => {
      scheduleRefresh();
      if (e.byId === user.id) return; // kendi işlemin için bildirim gösterme (başka cihazın da yenilenir)
      const now = Date.now();
      if (e.action === "created") recentCreated.current.set(e.id, now);
      else if (e.action === "updated" && now - (recentCreated.current.get(e.id) ?? 0) < 15_000) return;
      showToast(describeEvent(e), "info");
    },
    [scheduleRefresh, showToast, user.id],
  );
  useLiveSync({ onEvent: handleLiveEvent, onSync: scheduleRefresh });

  function handleAddNew() {
    editBase.current = undefined;
    setEditingMemory(null);
    setIsModalOpen(true);
  }

  function handleEdit(memory: Memory) {
    editBase.current = memory.updatedAt;
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
      if (err instanceof ApiError && err.status === 404) {
        await refresh().catch(() => undefined);
        showToast("Bu anı zaten silinmiş.");
        return;
      }
      showToast(`Anı silinemedi: ${errorMessage(err)}`);
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
      saved = editingMemory
        ? await updateMemory(editingMemory.id, draft, editBase.current)
        : await createMemory(draft);
    } catch (err) {
      setIsSaving(false);
      if (err instanceof ApiError && err.status === 409) {
        // Form açıkken başka biri aynı anıyı değiştirdi. Yazdıkların formda duruyor; tekrar Kaydet'e basarsan
        // bilerek onun değişikliğinin üzerine yazarsın (güncel sürümü baz alıyoruz).
        const current = (err.data as { current?: Memory } | undefined)?.current;
        if (current?.updatedAt) editBase.current = current.updatedAt;
        scheduleRefresh();
        showToast(
          "Bu anı sen düzenlerken başka biri değiştirdi. Yazdıkların korundu; yine de Kaydet'e basarsan onun değişikliğinin üzerine yazarsın.",
        );
        return;
      }
      if (err instanceof ApiError && err.status === 404 && editingMemory) {
        setIsModalOpen(false);
        setEditingMemory(null);
        scheduleRefresh();
        showToast("Bu anı artık yok (başka biri silmiş).");
        return;
      }
      showToast(`Anı kaydedilemedi: ${errorMessage(err)}`);
      return;
    }

    // 2) Fotoğraf. Anı artık kayıtlı olduğundan bir hata formu açık tutmaz (çift kayıt olmasın).
    let photoError: string | null = null;
    try {
      if (photo.kind === "set") await setMemoryPhoto(saved.id, photo.file);
      else if (photo.kind === "remove") await removeMemoryPhoto(saved.id);
    } catch (err) {
      photoError = errorMessage(err);
    }

    try {
      await refresh();
    } catch (err) {
      showToast(`Liste yenilenemedi: ${errorMessage(err)}`);
    }

    setIsModalOpen(false);
    setEditingMemory(null);
    setIsSaving(false);
    if (photoError) showToast(`Anı kaydedildi ama fotoğraf yüklenemedi: ${photoError}`);
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
      {loadState === "ready" && memories.length > 0 && (
        <MemorySearch
          query={query}
          onQueryChange={setQuery}
          category={categoryFilter}
          onCategoryChange={setCategoryFilter}
          categories={categories}
          categoryStats={categoryStats}
          fromDate={fromDate}
          onFromDateChange={setFromDate}
          toDate={toDate}
          onToDateChange={setToDate}
          resultCount={filteredMemories.length}
          totalCount={memories.length}
          onClear={clearFilters}
        />
      )}

      {loadState === "ready" && (
        <Timeline
          memories={filteredMemories}
          onEdit={handleEdit}
          onDelete={handleDelete}
          isFiltered={hasActiveFilters}
          onClearFilters={clearFilters}
        />
      )}

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
        categories={categories}
        isSaving={isSaving}
      />

      <ConfirmModal isOpen={confirmOpen} onConfirm={handleConfirmDelete} onCancel={handleCancelDelete} />

      <SpaceScene isOpen={isSpaceOpen} onClose={() => setIsSpaceOpen(false)} memories={memories} />

      <Toast message={toast?.text ?? null} kind={toast?.kind} onClose={dismissToast} />
    </>
  );
}

export default Workspace;