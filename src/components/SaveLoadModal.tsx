import React, { useEffect, useRef, useState } from 'react';
import { Download, RotateCcw, Save, Trash2, Upload, X } from 'lucide-react';
import { formatCompactNumber, formatSimDate } from '../engine/simulation';
import {
  deleteSaveSlot,
  exportStateToJson,
  listSaveSlots,
  loadFromSlot,
  MANUAL_SLOT_IDS,
  parseImportedSaveJson,
  saveToSlot,
} from '../engine/storage';
import type { GameState, SaveSlotMetadata } from '../engine/types';

interface SaveLoadModalProps {
  state: GameState;
  onClose: () => void;
  onLoadState: (loaded: GameState, notice: string) => void;
  onResetGame: () => void;
}

export const SaveLoadModal: React.FC<SaveLoadModalProps> = ({
  state,
  onClose,
  onLoadState,
  onResetGame,
}) => {
  const [slots, setSlots] = useState<SaveSlotMetadata[]>([]);
  const [slotLabels, setSlotLabels] = useState<Record<string, string>>({
    'slot-1': 'Campaign Slot 1',
    'slot-2': 'Campaign Slot 2',
    'slot-3': 'Campaign Slot 3',
    'slot-4': 'Campaign Slot 4',
  });
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmOverwriteSlot, setConfirmOverwriteSlot] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refreshSlots = async () => {
    try {
      const list = await listSaveSlots();
      setSlots(list);
      setSlotLabels((prev) => {
        const nextLabels: Record<string, string> = { ...prev };
        for (const m of list) {
          if (!m.isAutosave) nextLabels[m.slotId] = m.label;
        }
        return nextLabels;
      });
    } catch {
      setErrorMsg('IndexedDB save list could not be read.');
    }
  };

  useEffect(() => {
    refreshSlots();
  }, []);

  const executeManualSave = async (slotId: string) => {
    setErrorMsg(null);
    setConfirmOverwriteSlot(null);
    try {
      const label = slotLabels[slotId]?.trim() || slotId;
      await saveToSlot(slotId, label, state, false);
      setStatusMsg(`Saved to "${label}" (IndexedDB).`);
      await refreshSlots();
    } catch {
      setErrorMsg('Failed to write save slot to IndexedDB.');
    }
  };

  const handleSaveClick = (slotId: string, existing?: SaveSlotMetadata) => {
    // Guard against accidentally overwriting a deeper campaign with an earlier year
    if (existing && existing.year > state.clock.year && confirmOverwriteSlot !== slotId) {
      setConfirmOverwriteSlot(slotId);
      return;
    }
    executeManualSave(slotId);
  };

  const handleLoad = async (slotId: string, label: string) => {
    setErrorMsg(null);
    try {
      const loaded = await loadFromSlot(slotId);
      if (!loaded) {
        setErrorMsg('Save slot is empty.');
        return;
      }
      onLoadState(loaded, `Loaded ${label}`);
      onClose();
    } catch {
      setErrorMsg('Failed to read save slot from IndexedDB.');
    }
  };

  const handleDelete = async (slotId: string) => {
    try {
      await deleteSaveSlot(slotId);
      setConfirmOverwriteSlot(null);
      setStatusMsg('Deleted save slot.');
      await refreshSlots();
    } catch {
      setErrorMsg('Could not delete save slot.');
    }
  };

  const handleExportJson = () => {
    const json = exportStateToJson(state);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `semiconductor-empire-Y${String(state.clock.year).padStart(4, '0')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatusMsg('Exported portable JSON campaign backup.');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input value so re-selecting the same file always triggers onChange
    e.target.value = '';
    if (!file) return;
    setErrorMsg(null);
    try {
      const text = await file.text();
      const res = parseImportedSaveJson(text);
      if (res.error || !res.state) {
        setErrorMsg(res.error ?? 'Invalid JSON save file.');
        return;
      }
      onLoadState(res.state, `Imported ${file.name}`);
      onClose();
    } catch {
      setErrorMsg('Unable to read selected file.');
    }
  };

  const manualMap = new Map(slots.filter((s) => !s.isAutosave).map((s) => [s.slotId, s]));
  const autosaves = slots
    .filter((s) => s.isAutosave)
    .sort((a, b) => b.savedAtIso.localeCompare(a.savedAtIso));

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Save and Load Campaign"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl bg-[#101521] border border-[#2C3B55] rounded-lg overflow-hidden shadow-2xl">
        <div className="px-5 py-3.5 bg-[#0A0E16] border-b border-[#1E293B] flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#E8EEF7]">Campaign Storage (IndexedDB)</h2>
            <p className="text-xs text-[#8C9BB2] font-mono tabular-nums">
              Current: {formatSimDate(state.clock.year, state.clock.month, state.clock.day)} ·{' '}
              {formatCompactNumber(state.credits, 1)} CR · {state.unlockedTechIds.length} techs
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-[#8C9BB2] hover:text-[#E8EEF7] hover:bg-[#161D2D] cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          {statusMsg && (
            <div className="px-3 py-2 rounded bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-300">
              {statusMsg}
            </div>
          )}
          {errorMsg && (
            <div className="px-3 py-2 rounded bg-rose-950/60 border border-rose-500/40 text-xs text-rose-300">
              {errorMsg}
            </div>
          )}

          {/* 4 Manual Save Slots */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-[#8C9BB2] tracking-wide">
              Manual Save Slots (Ctrl+S quick-saves Slot 1)
            </h3>
            <div className="divide-y divide-[#1E293B] border border-[#1E293B] rounded-md bg-[#0A0E16]">
              {MANUAL_SLOT_IDS.map((slotId, idx) => {
                const meta = manualMap.get(slotId);
                const awaitingConfirm = confirmOverwriteSlot === slotId;
                return (
                  <div
                    key={slotId}
                    className="p-3 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <input
                        type="text"
                        value={slotLabels[slotId] ?? `Slot ${idx + 1}`}
                        onChange={(e) =>
                          setSlotLabels((prev) => ({ ...prev, [slotId]: e.target.value }))
                        }
                        className="bg-transparent text-sm font-medium text-[#E8EEF7] border-b border-transparent focus:border-[#06B6D4] focus:outline-none w-full max-w-[240px]"
                      />
                      {meta ? (
                        <div className="text-xs text-[#8C9BB2] font-mono tabular-nums">
                          {formatSimDate(meta.year, meta.month, meta.day)} ·{' '}
                          {formatCompactNumber(meta.credits, 1)} CR · Index{' '}
                          {meta.computeIndex.toLocaleString()} · {meta.unlockedTechCount} techs
                        </div>
                      ) : (
                        <div className="text-xs text-[#64748B]">Empty slot</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {awaitingConfirm ? (
                        <>
                          <button
                            type="button"
                            onClick={() => executeManualSave(slotId)}
                            className="h-8 px-2.5 rounded text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 whitespace-nowrap cursor-pointer"
                          >
                            Overwrite Y{String(meta?.year ?? 1).padStart(4, '0')}?
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmOverwriteSlot(null)}
                            className="h-8 px-2 rounded text-xs text-[#8C9BB2] hover:text-[#E8EEF7] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSaveClick(slotId, meta)}
                            className="h-8 px-3 rounded text-xs font-medium bg-[#06B6D4]/20 hover:bg-[#06B6D4]/30 text-[#22D3EE] border border-[#06B6D4]/40 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Save</span>
                          </button>
                          <button
                            type="button"
                            disabled={!meta}
                            onClick={() => handleLoad(slotId, meta?.label ?? slotId)}
                            className="h-8 px-3 rounded text-xs font-medium bg-[#161D2D] hover:bg-[#1E293B] disabled:opacity-40 text-[#E8EEF7] border border-[#2C3B55] whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
                          >
                            Load
                          </button>
                          {meta && (
                            <button
                              type="button"
                              onClick={() => handleDelete(slotId)}
                              className="h-8 w-8 rounded flex items-center justify-center text-[#8C9BB2] hover:text-rose-400 hover:bg-[#161D2D] cursor-pointer"
                              title="Delete slot"
                              aria-label="Delete save slot"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rolling Quarterly Autosaves */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-[#8C9BB2] tracking-wide">
              Quarterly Autosaves
            </h3>
            {autosaves.length === 0 ? (
              <div className="p-3 rounded-md bg-[#0A0E16] border border-[#1E293B] text-xs text-[#64748B]">
                No quarterly autosaves recorded yet. Autosaves trigger automatically every simulated quarter.
              </div>
            ) : (
              <div className="divide-y divide-[#1E293B] border border-[#1E293B] rounded-md bg-[#0A0E16]">
                {autosaves.map((meta) => (
                  <div
                    key={meta.slotId}
                    className="p-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm font-medium text-[#E8EEF7]">{meta.label}</div>
                      <div className="text-xs text-[#8C9BB2] font-mono tabular-nums">
                        {formatSimDate(meta.year, meta.month, meta.day)} ·{' '}
                        {formatCompactNumber(meta.credits, 1)} CR · {meta.unlockedTechCount} techs
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleLoad(meta.slotId, meta.label)}
                      className="h-8 px-3 rounded text-xs font-medium bg-[#161D2D] hover:bg-[#1E293B] text-[#E8EEF7] border border-[#2C3B55] whitespace-nowrap cursor-pointer"
                    >
                      Load
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* JSON Export / Import & Campaign Reset */}
          <div className="pt-2 border-t border-[#1E293B] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportJson}
                className="h-8 px-3 rounded text-xs font-medium bg-[#161D2D] hover:bg-[#1E293B] text-[#E8EEF7] border border-[#2C3B55] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#06B6D4]" />
                <span>Export JSON</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 px-3 rounded text-xs font-medium bg-[#161D2D] hover:bg-[#1E293B] text-[#E8EEF7] border border-[#2C3B55] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-[#D97706]" />
                <span>Import JSON</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportFile}
                className="hidden"
              />
            </div>

            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="h-8 px-3 rounded text-xs font-medium text-rose-400 hover:bg-rose-950/50 border border-rose-500/30 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Year 0001</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-rose-300">Start fresh?</span>
                <button
                  type="button"
                  onClick={() => {
                    onResetGame();
                    onClose();
                  }}
                  className="h-8 px-3 rounded text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white whitespace-nowrap cursor-pointer"
                >
                  Confirm Reset
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="h-8 px-2.5 rounded text-xs text-[#8C9BB2] hover:text-[#E8EEF7] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
