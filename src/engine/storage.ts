/**
 * Semiconductor Empire — Persistence Layer.
 *
 * Primary Save System: IndexedDB ('SemiconductorEmpireDB')
 *   - 4 manual save slots ('slot-1' .. 'slot-4')
 *   - Rolling quarterly autosaves ('autosave-1' .. 'autosave-4')
 *   - Full JSON file export & validated import
 *
 * Lightweight UI Settings: localStorage ('se_ui_settings_v1')
 *   - pauseOnMilestone, thermalOverlayDefault, showEquationsBanner
 */

import type { GameState, SaveRecord, SaveSlotMetadata, UiSettings } from './types';

const DB_NAME = 'SemiconductorEmpireDB';
const DB_VERSION = 1;
const STORE_SAVES = 'saves';
const UI_SETTINGS_KEY = 'se_ui_settings_v1';

export const MANUAL_SLOT_IDS = ['slot-1', 'slot-2', 'slot-3', 'slot-4'] as const;
const MAX_AUTOSAVES = 4;

// In-memory fallbacks used automatically if a browser restricts IndexedDB or localStorage on file:// origins
const memorySaveStore = new Map<string, SaveRecord>();
let memoryUiSettings: UiSettings | null = null;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is unavailable in this environment.'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_SAVES)) {
          db.createObjectStore(STORE_SAVES, { keyPath: 'meta.slotId' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB.'));
    } catch (err) {
      reject(err instanceof Error ? err : new Error('IndexedDB access restricted.'));
    }
  });
}

function buildMetadata(slotId: string, label: string, isAutosave: boolean, state: GameState): SaveSlotMetadata {
  return {
    slotId,
    label,
    isAutosave,
    savedAtIso: new Date().toISOString(),
    year: state.clock.year,
    month: state.clock.month,
    day: state.clock.day,
    credits: Math.round(state.credits),
    computeIndex: state.civilizationComputeIndex,
    unlockedTechCount: state.unlockedTechIds.length,
  };
}

export async function saveToSlot(
  slotId: string,
  label: string,
  state: GameState,
  isAutosave = false
): Promise<SaveSlotMetadata> {
  const record: SaveRecord = {
    meta: buildMetadata(slotId, label, isAutosave, state),
    state,
  };
  memorySaveStore.set(slotId, record);

  try {
    const db = await openDb();
    return await new Promise<SaveSlotMetadata>((resolve, reject) => {
      const tx = db.transaction(STORE_SAVES, 'readwrite');
      tx.objectStore(STORE_SAVES).put(record);
      tx.oncomplete = () => {
        db.close();
        resolve(record.meta);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error('Failed to write save record.'));
      };
    });
  } catch {
    return record.meta;
  }
}

export async function saveQuarterlyAutosave(state: GameState): Promise<SaveSlotMetadata> {
  const all = await listSaveSlots();
  const autosaves = all
    .filter((m) => m.isAutosave)
    .sort((a, b) => b.savedAtIso.localeCompare(a.savedAtIso));

  const quarter = Math.ceil(state.clock.month / 3);
  const slotId = `autosave-Y${state.clock.year}-Q${quarter}-${Date.now()}`;
  const label = `Quarterly Autosave · Y${String(state.clock.year).padStart(4, '0')} Q${quarter}`;
  const saved = await saveToSlot(slotId, label, state, true);

  // Prune older autosaves beyond MAX_AUTOSAVES
  if (autosaves.length >= MAX_AUTOSAVES) {
    const toDelete = autosaves.slice(MAX_AUTOSAVES - 1);
    for (const old of toDelete) {
      await deleteSaveSlot(old.slotId).catch(() => undefined);
    }
  }
  return saved;
}

export async function loadFromSlot(slotId: string): Promise<GameState | null> {
  try {
    const db = await openDb();
    return await new Promise<GameState | null>((resolve, reject) => {
      const tx = db.transaction(STORE_SAVES, 'readonly');
      const req = tx.objectStore(STORE_SAVES).get(slotId);
      req.onsuccess = () => {
        db.close();
        const rec = req.result as SaveRecord | undefined;
        resolve(rec ? rec.state : (memorySaveStore.get(slotId)?.state ?? null));
      };
      req.onerror = () => {
        db.close();
        reject(req.error ?? new Error('Failed to load save slot.'));
      };
    });
  } catch {
    return memorySaveStore.get(slotId)?.state ?? null;
  }
}

export async function deleteSaveSlot(slotId: string): Promise<void> {
  memorySaveStore.delete(slotId);
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SAVES, 'readwrite');
      tx.objectStore(STORE_SAVES).delete(slotId);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error('Failed to delete save slot.'));
      };
    });
  } catch {
    // Already removed from in-memory fallback store
  }
}

export async function listSaveSlots(): Promise<SaveSlotMetadata[]> {
  try {
    const db = await openDb();
    return await new Promise<SaveSlotMetadata[]>((resolve, reject) => {
      const tx = db.transaction(STORE_SAVES, 'readonly');
      const req = tx.objectStore(STORE_SAVES).getAll();
      req.onsuccess = () => {
        db.close();
        const records = (req.result as SaveRecord[]) ?? [];
        resolve(records.map((r) => r.meta));
      };
      req.onerror = () => {
        db.close();
        reject(req.error ?? new Error('Failed to list saves.'));
      };
    });
  } catch {
    return Array.from(memorySaveStore.values()).map((r) => r.meta);
  }
}

export async function loadLatestSaveIfAny(): Promise<GameState | null> {
  try {
    const metas = await listSaveSlots();
    if (metas.length === 0) return null;
    metas.sort((a, b) => b.savedAtIso.localeCompare(a.savedAtIso));
    return await loadFromSlot(metas[0].slotId);
  } catch {
    return null;
  }
}

export function exportStateToJson(state: GameState): string {
  return JSON.stringify(
    {
      format: 'semiconductor-empire-save',
      exportedAt: new Date().toISOString(),
      version: state.version,
      state,
    },
    null,
    2
  );
}

export function parseImportedSaveJson(rawJson: string): { state?: GameState; error?: string } {
  try {
    const parsed = JSON.parse(rawJson);
    const candidate = parsed?.state ?? parsed;
    if (
      !candidate ||
      typeof candidate !== 'object' ||
      !candidate.clock ||
      typeof candidate.clock.year !== 'number' ||
      !Array.isArray(candidate.facilities) ||
      !Array.isArray(candidate.chips) ||
      !Array.isArray(candidate.unlockedTechIds)
    ) {
      return { error: 'Invalid Semiconductor Empire save file structure.' };
    }
    return { state: candidate as GameState };
  } catch {
    return { error: 'Failed to parse JSON file.' };
  }
}

// ─── LIGHTWEIGHT UI PREFERENCES (localStorage ONLY) ──────────────────────────

const DEFAULT_UI_SETTINGS: UiSettings = {
  pauseOnMilestone: true,
  thermalOverlayDefault: false,
  showEquationsBanner: false,
  pauseOnResearch: true,
  pauseOnTapeOut: true,
  pauseOnConstruction: false,
  pauseOnDebt: true,
  pauseOnStarvation: false,
  compactDensity: false,
  sidebarCollapsed: false,
  numberFormat: 'compact',
};

export function loadUiSettings(): UiSettings {
  try {
    if (typeof localStorage === 'undefined') {
      return memoryUiSettings ?? DEFAULT_UI_SETTINGS;
    }
    const raw = localStorage.getItem(UI_SETTINGS_KEY);
    if (!raw) return memoryUiSettings ?? DEFAULT_UI_SETTINGS;
    const parsed = JSON.parse(raw);
    const legacyPause =
      typeof parsed.pauseOnMilestone === 'boolean'
        ? parsed.pauseOnMilestone
        : DEFAULT_UI_SETTINGS.pauseOnMilestone;
    const hydrated: UiSettings = {
      pauseOnMilestone: legacyPause,
      thermalOverlayDefault:
        typeof parsed.thermalOverlayDefault === 'boolean'
          ? parsed.thermalOverlayDefault
          : DEFAULT_UI_SETTINGS.thermalOverlayDefault,
      showEquationsBanner:
        typeof parsed.showEquationsBanner === 'boolean'
          ? parsed.showEquationsBanner
          : DEFAULT_UI_SETTINGS.showEquationsBanner,
      pauseOnResearch:
        typeof parsed.pauseOnResearch === 'boolean' ? parsed.pauseOnResearch : legacyPause,
      pauseOnTapeOut:
        typeof parsed.pauseOnTapeOut === 'boolean' ? parsed.pauseOnTapeOut : legacyPause,
      pauseOnConstruction:
        typeof parsed.pauseOnConstruction === 'boolean'
          ? parsed.pauseOnConstruction
          : DEFAULT_UI_SETTINGS.pauseOnConstruction,
      pauseOnDebt:
        typeof parsed.pauseOnDebt === 'boolean' ? parsed.pauseOnDebt : DEFAULT_UI_SETTINGS.pauseOnDebt,
      pauseOnStarvation:
        typeof parsed.pauseOnStarvation === 'boolean'
          ? parsed.pauseOnStarvation
          : DEFAULT_UI_SETTINGS.pauseOnStarvation,
      compactDensity:
        typeof parsed.compactDensity === 'boolean'
          ? parsed.compactDensity
          : DEFAULT_UI_SETTINGS.compactDensity,
      sidebarCollapsed:
        typeof parsed.sidebarCollapsed === 'boolean'
          ? parsed.sidebarCollapsed
          : DEFAULT_UI_SETTINGS.sidebarCollapsed,
      numberFormat:
        parsed.numberFormat === 'scientific' || parsed.numberFormat === 'compact'
          ? parsed.numberFormat
          : DEFAULT_UI_SETTINGS.numberFormat,
    };
    memoryUiSettings = hydrated;
    return hydrated;
  } catch {
    return memoryUiSettings ?? DEFAULT_UI_SETTINGS;
  }
}

export function saveUiSettings(settings: UiSettings): void {
  memoryUiSettings = settings;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(settings));
    }
  } catch {
    // Restricted storage (e.g. strict file:// origin) — retained in memoryUiSettings
  }
}
