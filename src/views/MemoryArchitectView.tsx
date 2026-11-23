import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FlaskConical, Gauge, Layers, Play } from 'lucide-react';
import { DieFloorplanSVG } from '../components/DieFloorplanSVG';
import {
  COOLING_SPECS,
  getMemoryCellArch,
  getMemoryInterface,
  getProcessNode,
  getTechNode,
  getUnlockedMemoryCellArchs,
  getUnlockedMemoryInterfaces,
  MEMORY_CATEGORY_META,
  PACKAGING_SPECS,
  PROCESS_NODES,
  TRANSISTOR_STRUCTURES,
} from '../engine/catalog';
import {
  applyMemoryCategoryChange,
  applyMemoryCellArchChange,
  applyMemoryInterfaceChange,
  applyMemoryNodeChange,
  applyMemoryStackOrBitsChange,
  applyMemoryTransistorChange,
  BITS_PER_CELL_META,
  clampToSlider,
  ECC_LEVEL_META,
  evaluateMemoryPhysics,
  getMemorySliderBounds,
  getStabilizedVoltageV,
} from '../engine/physics';
import { buildPreviewPhysicsContext, canResearchTech, formatCompactNumber } from '../engine/simulation';
import type { GameState, MemoryBlueprint, MemoryCategory } from '../engine/types';

interface MemoryArchitectViewProps {
  state: GameState;
  thermalOverlay: boolean;
  onToggleThermal: () => void;
  onUpdateDraft: (next: MemoryBlueprint) => void;
  onStartTapeOut: (draft: MemoryBlueprint) => { error?: string };
  onTestPrototype: () => void;
  onStartResearch: (techId: string) => void;
  onJumpToTechTree: () => void;
}

const CATEGORIES: MemoryCategory[] = ['dram', 'vram', 'rom_nand', 'storage_class'];

const CATEGORY_GATE_TECH: Partial<Record<MemoryCategory, string>> = {
  vram: 'mem_vram_foundations',
  storage_class: 'mem_pcm_scm',
};

export function formatMemoryCapacity(gb: number): string {
  if (gb < 1) {
    const mb = gb * 1024;
    return mb < 10 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`;
  }
  if (gb >= 1024) {
    const tb = gb / 1024;
    return tb >= 10 ? `${tb.toFixed(0)} TB` : `${tb.toFixed(2).replace(/\.00$/, '')} TB`;
  }
  return gb % 1 === 0 ? `${gb} GB` : `${gb.toFixed(2).replace(/0$/, '')} GB`;
}

export function formatLatencyNs(ns: number): string {
  if (ns >= 1000) return `${(ns / 1000).toFixed(1)} μs`;
  return `${ns.toFixed(1)} ns`;
}

export const MemoryArchitectView: React.FC<MemoryArchitectViewProps> = ({
  state,
  thermalOverlay,
  onToggleThermal,
  onUpdateDraft,
  onStartTapeOut,
  onTestPrototype,
  onStartResearch,
  onJumpToTechTree,
}) => {
  const [feedback, setFeedback] = useState<{ type: 'error' | 'ok'; msg: string } | null>(null);
  const [lockedCategoryTab, setLockedCategoryTab] = useState<MemoryCategory | null>(null);

  const draft = state.memoryDraft;
  const unlocked = state.unlockedTechIds;

  const unlockedNodes = PROCESS_NODES.filter(
    (n) => !n.requiredTechId || unlocked.includes(n.requiredTechId)
  );
  const unlockedTransistors = TRANSISTOR_STRUCTURES.filter(
    (t) => !t.requiredTechId || unlocked.includes(t.requiredTechId)
  );
  const unlockedPackaging = PACKAGING_SPECS.filter(
    (p) => !p.requiredTechId || unlocked.includes(p.requiredTechId)
  );
  const unlockedCooling = COOLING_SPECS.filter(
    (c) => !c.requiredTechId || unlocked.includes(c.requiredTechId)
  );

  const unlockedArchsForCategory = getUnlockedMemoryCellArchs(draft.memoryCategory, unlocked);
  const unlockedInterfacesForCategory = getUnlockedMemoryInterfaces(draft.memoryCategory, unlocked);

  const currentNode = getProcessNode(draft.processNodeId);
  const currentCellArch = getMemoryCellArch(draft.cellArchId);
  const currentInterface = getMemoryInterface(draft.interfaceId);
  const sliderBounds = getMemorySliderBounds(draft);

  const evaluation = useMemo(() => {
    const ctx = buildPreviewPhysicsContext(state, draft.processNodeId, 1.0);
    return evaluateMemoryPhysics(draft, ctx);
  }, [draft, state]);

  const { physics, benchmarks } = evaluation;

  const patch = (partial: Partial<MemoryBlueprint>) => {
    setFeedback(null);
    onUpdateDraft({
      ...draft,
      ...partial,
      revision: draft.revision + 1,
    });
  };

  const commitDraft = (next: MemoryBlueprint) => {
    setFeedback(null);
    onUpdateDraft({
      ...next,
      revision: draft.revision + 1,
    });
  };

  const handleSelectCategory = (cat: MemoryCategory) => {
    const availableArchs = getUnlockedMemoryCellArchs(cat, unlocked);
    const availableIfaces = getUnlockedMemoryInterfaces(cat, unlocked);
    if (availableArchs.length === 0 || availableIfaces.length === 0) {
      setLockedCategoryTab(cat);
      return;
    }
    setLockedCategoryTab(null);
    if (cat !== draft.memoryCategory) {
      commitDraft(applyMemoryCategoryChange(draft, cat, unlocked));
    }
  };

  const handleTapeOut = () => {
    const res = onStartTapeOut(draft);
    if (res.error) {
      setFeedback({ type: 'error', msg: res.error });
    } else {
      setFeedback({
        type: 'ok',
        msg: `${draft.name} committed to Tape-Out (${physics.tapeOutDays} days).`,
      });
    }
  };

  const activeCategoryTab = lockedCategoryTab ?? draft.memoryCategory;
  const lockedGateTechId = lockedCategoryTab ? CATEGORY_GATE_TECH[lockedCategoryTab] : undefined;
  const lockedGateTech = lockedGateTechId ? getTechNode(lockedGateTechId) : undefined;
  const lockedGateCheck = lockedGateTechId ? canResearchTech(state, lockedGateTechId) : { ok: false };
  const lockedGateInProgress = lockedGateTechId
    ? state.activeResearch.some((r) => r.techId === lockedGateTechId)
    : false;

  const currentBitsMeta =
    BITS_PER_CELL_META[Math.max(0, Math.min(BITS_PER_CELL_META.length - 1, draft.bitsPerCell - 1))];
  const currentEccMeta =
    ECC_LEVEL_META[Math.max(0, Math.min(ECC_LEVEL_META.length - 1, draft.eccLevel))];

  // Visual layers for 3D stack cross-section (1 to 10 rendered decks representing up to 512 layers)
  const visualLayers =
    draft.stackLayers <= 1
      ? 1
      : draft.stackLayers <= 4
        ? draft.stackLayers
        : draft.stackLayers <= 16
          ? Math.min(8, Math.ceil(draft.stackLayers / 2))
          : 10;

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#1F2A3D] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E8EEF7] tracking-tight">
            Memory &amp; Storage Architect
          </h1>
          <p className="text-sm text-[#8C9BB2] mt-0.5">
            Engineer DRAM, VRAM/HBM stacks, 3D V-NAND flash, and post-silicon storage-class memory arrays
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTestPrototype}
            className="h-9 px-3.5 rounded-md bg-[#111622] hover:bg-[#171E2E] text-[#E8EEF7] border border-[#2C3B55] text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Gauge className="w-3.5 h-3.5 text-[#06B6D4]" />
            <span>Run Full Benchmarks</span>
          </button>
          <button
            type="button"
            onClick={handleTapeOut}
            disabled={Boolean(lockedCategoryTab) || physics.exceedsReticle || physics.voltageUnstable}
            className="h-9 px-4 rounded-md bg-[#06B6D4] hover:bg-[#22D3EE] disabled:opacity-40 text-[#07090E] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
          >
            <Play className="w-3.5 h-3.5" />
            <span>
              Start Tape-Out ({formatCompactNumber(physics.tapeOutCreditCost, 0)} CR ·{' '}
              {physics.tapeOutDays}d)
            </span>
          </button>
        </div>
      </div>

      {/* Division Category Selector */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {CATEGORIES.map((cat) => {
          const meta = MEMORY_CATEGORY_META[cat];
          const unlockedCount = getUnlockedMemoryCellArchs(cat, unlocked).length;
          const isUnlocked = unlockedCount > 0;
          const isSelected = activeCategoryTab === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => handleSelectCategory(cat)}
              className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-[#171E2E] border-[#06B6D4]/70 text-[#E8EEF7]'
                  : isUnlocked
                    ? 'bg-[#111622] border-[#1F2A3D] hover:border-[#2C3B55] text-[#CBD5E1]'
                    : 'bg-[#0B0F17] border-[#1F2A3D] text-[#64748B] hover:border-[#2C3B55]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold truncate">{meta.label}</span>
                <span
                  className={`text-[11px] font-mono tabular-nums shrink-0 ${
                    isUnlocked ? 'text-[#2DD4BF]' : 'text-[#D97706]'
                  }`}
                >
                  {isUnlocked ? `${unlockedCount} arch` : 'R&D'}
                </span>
              </div>
              <p className="text-[11px] text-[#8C9BB2] mt-1 line-clamp-1">
                {meta.nonVolatile ? 'Non-Volatile Storage' : 'Volatile High-Speed RAM'}
              </p>
            </button>
          );
        })}
      </div>

      {lockedCategoryTab && lockedGateTech ? (
        <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-6 max-w-3xl space-y-4">
          <div>
            <h2 className="text-lg font-bold text-[#E8EEF7]">
              {MEMORY_CATEGORY_META[lockedCategoryTab].label} — Technology Required
            </h2>
            <p className="text-sm text-[#8C9BB2] mt-1 leading-relaxed">
              {MEMORY_CATEGORY_META[lockedCategoryTab].description}
            </p>
          </div>
          <div className="bg-[#0B0F17] border border-[#1F2A3D] rounded-md p-3.5 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#E8EEF7]">{lockedGateTech.name}</span>
              <span className="font-mono tabular-nums text-[#22D3EE]">
                {lockedGateTech.rpCost.toLocaleString()} RP
              </span>
            </div>
            <p className="text-[#8C9BB2]">{lockedGateTech.summary}</p>
            {lockedGateTech.prerequisites.length > 0 && (
              <div className="text-[11px] text-[#8C9BB2] pt-1">
                Prerequisites:{' '}
                {lockedGateTech.prerequisites.map((pid, idx) => {
                  const p = getTechNode(pid);
                  const done = unlocked.includes(pid);
                  return (
                    <span key={pid} className={done ? 'text-emerald-400' : 'text-amber-400'}>
                      {idx > 0 ? ', ' : ''}
                      {p?.name ?? pid}
                      {done ? ' (Done)' : ' (Locked)'}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {lockedGateCheck.ok ? (
              <button
                type="button"
                onClick={() => onStartResearch(lockedGateTech.id)}
                className="h-9 px-4 rounded-md bg-[#06B6D4] hover:bg-[#22D3EE] text-[#07090E] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <FlaskConical className="w-4 h-4" />
                <span>Start Research: {lockedGateTech.name}</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={lockedGateInProgress}
                onClick={onJumpToTechTree}
                className="h-9 px-4 rounded-md bg-[#171E2E] hover:bg-[#1E273B] border border-[#2C3B55] text-[#E8EEF7] text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-60"
              >
                <FlaskConical className="w-4 h-4 text-[#06B6D4]" />
                <span>
                  {lockedGateInProgress
                    ? `Researching ${lockedGateTech.name}...`
                    : 'View Prerequisites in Technology Tree'}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setLockedCategoryTab(null)}
              className="h-9 px-3.5 rounded-md bg-[#0B0F17] hover:bg-[#171E2E] border border-[#1F2A3D] text-xs text-[#8C9BB2] hover:text-[#E8EEF7] whitespace-nowrap cursor-pointer"
            >
              Return to {MEMORY_CATEGORY_META[draft.memoryCategory].shortLabel} Workbench
            </button>
          </div>
        </div>
      ) : (
        <>
          {feedback && (
            <div
              className={`px-4 py-2.5 rounded-md border text-xs flex items-center gap-2 ${
                feedback.type === 'error'
                  ? 'bg-rose-950/60 border-rose-500/40 text-rose-200'
                  : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
              }`}
            >
              {feedback.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.msg}</span>
            </div>
          )}

          {/* Asymmetric Split Console */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Left 7 cols: Memory & Storage Workbench */}
            <div className="xl:col-span-7 space-y-5">
              {/* 01. Process, Cell Architecture & Interface */}
              <section className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-4 space-y-4">
                <h2 className="text-xs font-semibold text-[#8C9BB2] tracking-wide">
                  01. Silicon Process, Cell Architecture &amp; Bus Interface
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <label className="space-y-1 block">
                    <span className="text-xs text-[#8C9BB2]">Product Designation</span>
                    <input
                      type="text"
                      value={draft.name}
                      onChange={(e) => patch({ name: e.target.value })}
                      className="w-full h-9 px-3 rounded bg-[#0B0F17] border border-[#1F2A3D] focus:border-[#06B6D4] focus:outline-none text-sm text-[#E8EEF7]"
                    />
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-xs text-[#8C9BB2]">Process Node</span>
                    <select
                      value={draft.processNodeId}
                      onChange={(e) => commitDraft(applyMemoryNodeChange(draft, e.target.value))}
                      className="w-full h-9 px-2.5 rounded bg-[#0B0F17] border border-[#1F2A3D] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
                    >
                      {unlockedNodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name} ({n.sramDensityMTrPerMm2} SRAM MTr/mm²)
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-xs text-[#8C9BB2]">Memory Cell Architecture</span>
                    <select
                      value={draft.cellArchId}
                      onChange={(e) => commitDraft(applyMemoryCellArchChange(draft, e.target.value))}
                      className="w-full h-9 px-2.5 rounded bg-[#0B0F17] border border-[#1F2A3D] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
                    >
                      {unlockedArchsForCategory.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} (max {a.maxStackLayers}L · {a.maxBitsPerCell}-bit)
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-xs text-[#8C9BB2]">Periphery Transistor Structure</span>
                    <select
                      value={draft.transistorStructureId}
                      onChange={(e) =>
                        commitDraft(applyMemoryTransistorChange(draft, e.target.value))
                      }
                      className="w-full h-9 px-2.5 rounded bg-[#0B0F17] border border-[#1F2A3D] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
                    >
                      {unlockedTransistors.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.densityMultiplier}× dens)
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-xs text-[#8C9BB2]">Interface Standard</span>
                    <select
                      value={draft.interfaceId}
                      onChange={(e) => commitDraft(applyMemoryInterfaceChange(draft, e.target.value))}
                      className="w-full h-9 px-2.5 rounded bg-[#0B0F17] border border-[#1F2A3D] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
                    >
                      {unlockedInterfacesForCategory.map((iface) => (
                        <option key={iface.id} value={iface.id}>
                          {iface.name} (up to {iface.maxDataRateMTs.toLocaleString()} MT/s)
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-xs text-[#8C9BB2]">Packaging &amp; Substrate</span>
                    <select
                      value={draft.packagingId}
                      onChange={(e) => patch({ packagingId: e.target.value })}
                      className="w-full h-9 px-2.5 rounded bg-[#0B0F17] border border-[#1F2A3D] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
                    >
                      {unlockedPackaging.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (max {p.maxDieAreaMm2} mm²)
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="text-[11px] text-[#8C9BB2] border-t border-[#1F2A3D] pt-2.5">
                  <span className="text-[#CBD5E1] font-medium">{currentCellArch.name}:</span>{' '}
                  {currentCellArch.description} ·{' '}
                  <span className="text-amber-300/90">{currentCellArch.constraintNote}</span>
                </p>
              </section>

              {/* 02. Capacity, 3D Vertical Stack & Cell Encoding */}
              <section className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-4 space-y-4">
                <h2 className="text-xs font-semibold text-[#8C9BB2] tracking-wide">
                  02. Array Capacity, 3D Stacking &amp; ECC Redundancy
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#8C9BB2]">Target Die / Stack Capacity</span>
                      <span className="font-mono tabular-nums text-[#22D3EE] font-semibold">
                        {formatMemoryCapacity(draft.capacityGB)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={sliderBounds.capacityGB.min}
                      max={sliderBounds.capacityGB.max}
                      step={sliderBounds.capacityGB.step}
                      value={clampToSlider(draft.capacityGB, sliderBounds.capacityGB)}
                      onChange={(e) => patch({ capacityGB: Number(e.target.value) })}
                      className="foundry-slider"
                    />
                  </div>

                  <label className="space-y-1 block">
                    <span className="text-xs text-[#8C9BB2]">
                      3D Vertical Stack Layers (max {currentCellArch.maxStackLayers}L)
                    </span>
                    <select
                      value={draft.stackLayers}
                      disabled={sliderBounds.stackLayersOptions.length <= 1}
                      onChange={(e) =>
                        commitDraft(
                          applyMemoryStackOrBitsChange(draft, { stackLayers: Number(e.target.value) })
                        )
                      }
                      className="w-full h-9 px-2.5 rounded bg-[#0B0F17] border border-[#1F2A3D] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7] disabled:opacity-60"
                    >
                      {sliderBounds.stackLayersOptions.map((layers) => (
                        <option key={layers} value={layers}>
                          {layers === 1
                            ? '1 Layer (Planar)'
                            : `${layers} Stacked Layers (${currentCellArch.category === 'rom_nand' ? '3D Decks' : 'TSV Hi-Stack'})`}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#8C9BB2]">Bits per Physical Cell</span>
                      <span className="font-mono tabular-nums text-[#E8EEF7]">
                        {currentBitsMeta.shortLabel} ({currentBitsMeta.states} states)
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={currentCellArch.maxBitsPerCell}
                      step={1}
                      disabled={currentCellArch.maxBitsPerCell <= 1}
                      value={Math.min(draft.bitsPerCell, currentCellArch.maxBitsPerCell)}
                      onChange={(e) =>
                        commitDraft(
                          applyMemoryStackOrBitsChange(draft, { bitsPerCell: Number(e.target.value) })
                        )
                      }
                      className="foundry-slider"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#8C9BB2]">Independent Banks / Planes</span>
                      <span className="font-mono tabular-nums text-[#E8EEF7]">
                        {draft.bankCount} banks
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {sliderBounds.bankCountOptions.map((banks) => (
                        <button
                          key={banks}
                          type="button"
                          onClick={() => patch({ bankCount: banks })}
                          className={`h-8 px-2.5 rounded text-xs font-mono border transition-colors whitespace-nowrap cursor-pointer ${
                            draft.bankCount === banks
                              ? 'bg-[#06B6D4]/20 border-[#06B6D4]/50 text-[#22D3EE]'
                              : 'bg-[#0B0F17] border-[#1F2A3D] text-[#8C9BB2] hover:text-[#E8EEF7]'
                          }`}
                        >
                          {banks}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#8C9BB2]">On-Die ECC &amp; Spare Redundancy</span>
                      <span className="font-mono tabular-nums text-[#818CF8]">
                        {currentEccMeta.label} (+{Math.round(currentEccMeta.areaOverhead * 100)}% area)
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {ECC_LEVEL_META.map((ecc) => (
                        <button
                          key={ecc.level}
                          type="button"
                          onClick={() => patch({ eccLevel: ecc.level })}
                          className={`h-8 px-2 rounded text-[11px] font-mono border transition-colors whitespace-nowrap cursor-pointer ${
                            draft.eccLevel === ecc.level
                              ? 'bg-[#818CF8]/20 border-[#818CF8]/60 text-[#E0E7FF]'
                              : 'bg-[#0B0F17] border-[#1F2A3D] text-[#8C9BB2] hover:text-[#E8EEF7]'
                          }`}
                        >
                          {ecc.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* 03. Signaling Rate, Bus Width, Voltage & Cooling */}
              <section className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-4 space-y-4">
                <h2 className="text-xs font-semibold text-[#8C9BB2] tracking-wide">
                  03. Signaling Rate, Bus Width, Supply Voltage &amp; Cooling
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#8C9BB2]">Target Data Rate</span>
                      <span className="font-mono tabular-nums text-[#22D3EE]">
                        {draft.dataRateMTs.toLocaleString()} MT/s
                      </span>
                    </div>
                    <input
                      type="range"
                      min={sliderBounds.dataRateMTs.min}
                      max={sliderBounds.dataRateMTs.max}
                      step={sliderBounds.dataRateMTs.step}
                      value={clampToSlider(draft.dataRateMTs, sliderBounds.dataRateMTs)}
                      onChange={(e) => patch({ dataRateMTs: Number(e.target.value) })}
                      className="foundry-slider"
                    />
                  </div>

                  <label className="space-y-1 block">
                    <span className="text-xs text-[#8C9BB2]">
                      Interface Bus Width ({physics.memoryBandwidthGBs.toFixed(1)} GB/s)
                    </span>
                    <select
                      value={draft.busWidthBits}
                      onChange={(e) => patch({ busWidthBits: Number(e.target.value) })}
                      className="w-full h-9 px-2.5 rounded bg-[#0B0F17] border border-[#1F2A3D] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
                    >
                      {sliderBounds.busWidthOptions.map((bits) => (
                        <option key={bits} value={bits}>
                          {bits}-bit {currentInterface.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-[#8C9BB2] truncate">
                        Supply Voltage (Vmin {physics.minStableVoltageV.toFixed(2)} V)
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            patch({
                              voltageV: getStabilizedVoltageV(
                                physics.minStableVoltageV,
                                sliderBounds.voltageV
                              ),
                            })
                          }
                          className={`h-5 px-2 rounded text-[11px] font-medium border transition-colors whitespace-nowrap cursor-pointer ${
                            physics.voltageUnstable
                              ? 'bg-rose-500/20 border-rose-400/60 text-rose-200 hover:bg-rose-500/30'
                              : 'bg-[#0B0F17] border-[#2C3B55] text-[#22D3EE] hover:bg-[#171E2E]'
                          }`}
                        >
                          Auto-Stabilize
                        </button>
                        <span
                          className={`font-mono tabular-nums ${
                            physics.voltageUnstable ? 'text-rose-400 font-semibold' : 'text-[#E8EEF7]'
                          }`}
                        >
                          {draft.voltageV.toFixed(2)} V
                        </span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={sliderBounds.voltageV.min}
                      max={sliderBounds.voltageV.max}
                      step={sliderBounds.voltageV.step}
                      value={clampToSlider(draft.voltageV, sliderBounds.voltageV)}
                      onChange={(e) => patch({ voltageV: Number(e.target.value) })}
                      className="foundry-slider"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#8C9BB2]">Module Power Limit</span>
                      <span className="font-mono tabular-nums text-[#D97706]">
                        {draft.powerLimitW} W
                      </span>
                    </div>
                    <input
                      type="range"
                      min={sliderBounds.powerLimitW.min}
                      max={sliderBounds.powerLimitW.max}
                      step={sliderBounds.powerLimitW.step}
                      value={clampToSlider(draft.powerLimitW, sliderBounds.powerLimitW)}
                      onChange={(e) => patch({ powerLimitW: Number(e.target.value) })}
                      className="foundry-slider"
                    />
                  </div>

                  <label className="space-y-1 block sm:col-span-2">
                    <span className="text-xs text-[#8C9BB2]">Cooling Solution</span>
                    <select
                      value={draft.coolingId}
                      onChange={(e) => patch({ coolingId: e.target.value })}
                      className="w-full h-9 px-2.5 rounded bg-[#0B0F17] border border-[#1F2A3D] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
                    >
                      {unlockedCooling.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} (Rθ {c.thermalResistanceCPerW} °C/W · Limit {c.throttleTempC} °C)
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>
            </div>

            {/* Right 5 cols: Live 2D Die Floorplan + 3D Stack Cross-Section + Telemetry */}
            <div className="xl:col-span-5 space-y-5 xl:sticky xl:top-6">
              <DieFloorplanSVG
                title={draft.name || 'Unnamed Memory Die'}
                nodeLabel={currentNode.name}
                physics={physics}
                thermalOverlay={thermalOverlay}
                onToggleThermal={onToggleThermal}
              />

              {/* 3D Vertical Stack & Multi-Bit Cell Charge Visualizer */}
              <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#8C9BB2] tracking-wide">
                    3D Stack Cross-Section &amp; Cell States
                  </span>
                  <span className="font-mono tabular-nums text-[#2DD4BF]">
                    {draft.stackLayers}L · {currentBitsMeta.shortLabel}
                  </span>
                </div>
                <div className="bg-[#07090E] border border-[#1F2A3D] rounded-md p-2.5">
                  <svg
                    viewBox="0 0 320 108"
                    className="w-full h-[108px]"
                    role="img"
                    aria-label="3D vertical memory stack cross-section and multi-level cell voltage states"
                  >
                    {/* Left Half: 3D Vertical Silicon Stack & Copper TSVs */}
                    <text
                      x="8"
                      y="11"
                      fill="#8C9BB2"
                      fontSize="8"
                      fontFamily="ui-monospace, SFMono-Regular, Consolas, Menlo, monospace"
                    >
                      VERTICAL STACK ({draft.stackLayers}L)
                    </text>
                    {/* Substrate / Interposer Base */}
                    <rect
                      x="14"
                      y="90"
                      width="132"
                      height="10"
                      rx="1.5"
                      fill="#171E2E"
                      stroke="#475569"
                      strokeWidth="0.8"
                    />
                    <text
                      x="80"
                      y="97.5"
                      textAnchor="middle"
                      fill="#94A3B8"
                      fontSize="6.5"
                      fontFamily="ui-monospace, SFMono-Regular, Consolas, Menlo, monospace"
                    >
                      BASE LOGIC / SUBSTRATE
                    </text>

                    {/* Stacked Active Memory Tiers */}
                    {Array.from({ length: visualLayers }).map((_, idx) => {
                      const layerH = Math.min(11, 64 / Math.max(1, visualLayers) - 1.5);
                      const y = 85 - (idx + 1) * (layerH + 1.8);
                      const heatTint =
                        physics.junctionTempC > physics.throttleTempC - 8
                          ? '#F59E0B'
                          : '#14B8A6';
                      return (
                        <g key={idx}>
                          <rect
                            x="22"
                            y={y}
                            width="116"
                            height={Math.max(3.5, layerH)}
                            rx="1"
                            fill="#0F2E35"
                            stroke={heatTint}
                            strokeWidth="0.7"
                          />
                        </g>
                      );
                    })}

                    {/* Copper TSV Vertical Vias when stacked */}
                    {draft.stackLayers > 1 &&
                      [38, 66, 94, 122].map((xPos) => (
                        <line
                          key={xPos}
                          x1={xPos}
                          y1={Math.max(18, 86 - visualLayers * (Math.min(11, 64 / visualLayers - 1.5) + 1.8))}
                          x2={xPos}
                          y2="90"
                          stroke="#D97706"
                          strokeWidth="1.6"
                          strokeDasharray="2 1"
                          opacity="0.85"
                        />
                      ))}

                    {/* Divider */}
                    <line x1="164" y1="8" x2="164" y2="100" stroke="#1F2A3D" strokeWidth="1" />

                    {/* Right Half: Cell Charge States (2^bitsPerCell discrete threshold peaks) */}
                    <text
                      x="174"
                      y="11"
                      fill="#8C9BB2"
                      fontSize="8"
                      fontFamily="ui-monospace, SFMono-Regular, Consolas, Menlo, monospace"
                    >
                      CELL THRESHOLD ({currentBitsMeta.states} STATES)
                    </text>
                    <line x1="174" y1="88" x2="310" y2="88" stroke="#2C3B55" strokeWidth="0.9" />
                    {Array.from({ length: Math.min(16, currentBitsMeta.states) }).map((_, i, arr) => {
                      const count = arr.length;
                      const span = 128;
                      const cx = 178 + (i + 0.5) * (span / count);
                      const peakW = Math.max(3.5, (span / count) * 0.72);
                      const peakH = currentBitsMeta.states >= 16 ? 34 : currentBitsMeta.states >= 8 ? 44 : 54;
                      const strokeColor =
                        currentBitsMeta.bits >= 4
                          ? '#F59E0B'
                          : currentBitsMeta.bits === 3
                            ? '#06B6D4'
                            : '#10B981';
                      return (
                        <path
                          key={i}
                          d={`M ${cx - peakW / 2} 88 Q ${cx} ${88 - peakH} ${cx + peakW / 2} 88`}
                          fill={strokeColor}
                          fillOpacity="0.22"
                          stroke={strokeColor}
                          strokeWidth="1"
                        />
                      );
                    })}
                    <text
                      x="242"
                      y="99"
                      textAnchor="middle"
                      fill="#8C9BB2"
                      fontSize="6.5"
                      fontFamily="ui-monospace, SFMono-Regular, Consolas, Menlo, monospace"
                    >
                      {currentBitsMeta.states > 16
                        ? '32 PLC LEVELS (ULTRA-TIGHT MARGIN)'
                        : currentBitsMeta.bits === 1
                          ? 'WIDE SENSING MARGIN · MAX ENDURANCE'
                          : `ECC: ${currentEccMeta.label.toUpperCase()} NOISE GUARD`}
                    </text>
                  </svg>
                </div>
              </div>

              {/* Real-Time Memory & Storage Telemetry */}
              <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-[#8C9BB2] tracking-wide flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#14B8A6]" />
                    <span>Real-Time Memory Telemetry</span>
                  </h3>
                  <span className="text-xs font-mono tabular-nums text-[#E8EEF7]">
                    Score {benchmarks.overallRating.toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                  <div className="flex justify-between border-b border-[#1F2A3D] pb-1.5">
                    <span className="text-[#8C9BB2]">Areal Density</span>
                    <span className="font-mono tabular-nums text-[#E8EEF7]">
                      {(physics.densityGbitPerMm2 ?? 0) < 0.01
                        ? `${((physics.densityGbitPerMm2 ?? 0) * 1000).toFixed(2)} Mb/mm²`
                        : `${(physics.densityGbitPerMm2 ?? 0).toFixed(2)} Gb/mm²`}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[#1F2A3D] pb-1.5">
                    <span className="text-[#8C9BB2]">Bandwidth</span>
                    <span className="font-mono tabular-nums text-[#22D3EE]">
                      {physics.memoryBandwidthGBs.toFixed(1)} GB/s
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[#1F2A3D] pb-1.5">
                    <span className="text-[#8C9BB2]">Access Latency</span>
                    <span className="font-mono tabular-nums text-[#E8EEF7]">
                      {formatLatencyNs(physics.accessLatencyNs ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[#1F2A3D] pb-1.5">
                    <span className="text-[#8C9BB2]">Random IOPS</span>
                    <span className="font-mono tabular-nums text-[#E8EEF7]">
                      {formatCompactNumber((physics.iopsK ?? 0) * 1000, 1)}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[#1F2A3D] pb-1.5">
                    <span className="text-[#8C9BB2]">
                      {physics.nonVolatile ? 'Endurance (TBW)' : 'Refresh Draw'}
                    </span>
                    <span className="font-mono tabular-nums text-[#E8EEF7]">
                      {physics.nonVolatile
                        ? `${formatCompactNumber(physics.enduranceTBW ?? 0, 1)} TBW`
                        : `${(physics.refreshPowerW ?? 0).toFixed(2)} W`}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[#1F2A3D] pb-1.5">
                    <span className="text-[#8C9BB2]">Effective Power</span>
                    <span className="font-mono tabular-nums text-[#E8EEF7]">
                      {physics.effectivePowerW.toFixed(1)} W
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[#1F2A3D] pb-1.5">
                    <span className="text-[#8C9BB2]">Junction Temp</span>
                    <span
                      className={`font-mono tabular-nums ${
                        physics.thermalThrottledRatio < 0.96
                          ? 'text-rose-400 font-semibold'
                          : 'text-emerald-400'
                      }`}
                    >
                      {physics.junctionTempC.toFixed(1)} °C
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[#1F2A3D] pb-1.5">
                    <span className="text-[#8C9BB2]">Est. Yield (best fab)</span>
                    <span
                      className={`font-mono tabular-nums ${
                        physics.yieldPercent < 45 ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {physics.yieldPercent.toFixed(1)}% ({physics.goodDiesPerWafer.toFixed(0)}/wfr)
                    </span>
                  </div>
                </div>

                {/* Live Engineering Bottlenecks */}
                <div className="space-y-2 pt-1">
                  {benchmarks.bottlenecks.slice(0, 3).map((b) => (
                    <div
                      key={b.id}
                      className={`p-2.5 rounded border text-xs space-y-0.5 ${
                        b.severity === 'critical'
                          ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                          : b.severity === 'warning'
                            ? 'bg-amber-950/35 border-amber-500/40 text-amber-200'
                            : 'bg-[#0B0F17] border-[#1F2A3D] text-[#CBD5E1]'
                      }`}
                    >
                      <div className="font-semibold">
                        {b.severity === 'critical'
                          ? 'Critical: '
                          : b.severity === 'warning'
                            ? 'Bottleneck: '
                            : ''}
                        {b.title}
                      </div>
                      <p className="text-[11px] opacity-90">{b.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
