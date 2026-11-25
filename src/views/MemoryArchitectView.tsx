import React, { useMemo, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import {
  ArchitectStudioShell,
  formatDelta,
  type TelemetryMetricRow,
} from '../components/ArchitectStudioShell';
import { AccordionSection } from '../components/ui/AccordionSection';
import { PrecisionSlider } from '../components/ui/PrecisionSlider';
import {
  applyMemoryPreset,
  generateSmartChipName,
  getNextUnlockHints,
  optimizeMemoryDraft,
  type ArchitectPresetId,
  type OptimizeActionId,
} from '../engine/architectHelpers';
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
import {
  buildPreviewPhysicsContext,
  canResearchTech,
  createStarterMemoryDraft,
  formatCompactNumber,
} from '../engine/simulation';
import type { GameState, MemoryBlueprint, MemoryCategory } from '../engine/types';
import { useDraftHistory } from '../hooks/useDraftHistory';

interface MemoryArchitectViewProps {
  state: GameState;
  thermalOverlay: boolean;
  onToggleThermal: () => void;
  onUpdateDraft: (next: MemoryBlueprint) => void;
  onStartTapeOut: (draft: MemoryBlueprint, autoAssignLineId?: string) => { error?: string };
  onTestPrototype: () => void;
  onStartResearch: (techId: string) => void;
  onJumpToTechTree: () => void;
  onJumpToTech?: (techId: string) => void;
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
  onJumpToTech,
}) => {
  const [feedback, setFeedback] = useState<{ type: 'error' | 'ok'; msg: string } | null>(null);
  const [lockedCategoryTab, setLockedCategoryTab] = useState<MemoryCategory | null>(null);
  const [baselineChipId, setBaselineChipId] = useState<string>('');

  const draft = state.memoryDraft;
  const unlocked = state.unlockedTechIds;

  const { pushAndApply, undo, redo, canUndo, canRedo } = useDraftHistory<MemoryBlueprint>(
    draft,
    (next) => {
      setFeedback(null);
      onUpdateDraft({ ...next, revision: draft.revision + 1 });
    }
  );

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

  const memChips = useMemo(
    () => state.chips.filter((c): c is MemoryBlueprint => c.kind === 'memory'),
    [state.chips]
  );

  const baselineEval = useMemo(() => {
    const base = memChips.find((c) => c.id === baselineChipId);
    if (!base) return undefined;
    const ctx = buildPreviewPhysicsContext(state, base.processNodeId, 1.0);
    return evaluateMemoryPhysics(base, ctx);
  }, [memChips, baselineChipId, state]);

  const nextUnlockHints = useMemo(
    () => getNextUnlockHints('memory', unlocked, draft.memoryCategory),
    [unlocked, draft.memoryCategory]
  );

  const { physics, benchmarks } = evaluation;

  const patch = (partial: Partial<MemoryBlueprint>) => {
    pushAndApply({ ...draft, ...partial });
  };

  const commitDraft = (next: MemoryBlueprint) => {
    pushAndApply(next);
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

  const handleApplyPreset = (preset: ArchitectPresetId) => {
    const next = applyMemoryPreset(draft, preset, state);
    commitDraft(next);
    setFeedback({
      type: 'ok',
      msg: `Applied ${preset.replace('_', ' ')} ${MEMORY_CATEGORY_META[draft.memoryCategory].shortLabel} profile.`,
    });
  };

  const handleOptimize = (action: OptimizeActionId) => {
    const next = optimizeMemoryDraft(draft, action, state);
    commitDraft(next);
    const labelMap: Record<OptimizeActionId, string> = {
      fit_reticle: 'Scaled 3D stack & die capacity within reticle limits.',
      stabilize_voltage: 'Stabilized array supply voltage above Vmin threshold.',
      match_cooling: 'Matched cooling solution and module power limit.',
      balance_bandwidth: 'Maximized bus width, bank parallelism, and signaling rate.',
    };
    setFeedback({ type: 'ok', msg: labelMap[action] });
  };

  const handleReset = () => {
    const starter = createStarterMemoryDraft();
    const bestNode = unlockedNodes[unlockedNodes.length - 1] ?? unlockedNodes[0];
    commitDraft(applyMemoryNodeChange(starter, bestNode.id));
    setLockedCategoryTab(null);
    setFeedback({ type: 'ok', msg: `Reset Memory draft on ${bestNode.name}.` });
  };

  const handleTapeOut = (autoAssignLineId?: string) => {
    const res = onStartTapeOut(draft, autoAssignLineId);
    if (res.error) {
      setFeedback({ type: 'error', msg: res.error });
    } else {
      setFeedback({
        type: 'ok',
        msg: `${draft.name} committed to Tape-Out (${physics.tapeOutDays} days)${autoAssignLineId ? ' with auto-deploy armed' : ''}.`,
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

  const visualLayers =
    draft.stackLayers <= 1
      ? 1
      : draft.stackLayers <= 4
        ? draft.stackLayers
        : draft.stackLayers <= 16
          ? Math.min(8, Math.ceil(draft.stackLayers / 2))
          : 10;

  const categorySelectorStrip = (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
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
            className={`px-3 py-2.5 rounded-md border text-left transition-colors cursor-pointer ${
              isSelected
                ? 'bg-[#161D2D] border-[#14B8A6]/75 text-[#E8EEF7]'
                : isUnlocked
                  ? 'bg-[#101521] border-[#1E293B] hover:border-[#2C3B55] text-[#CBD5E1]'
                  : 'bg-[#0A0E16] border-[#1E293B] text-[#64748B] hover:border-[#2C3B55]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold truncate">{meta.label}</span>
              <span
                className={`text-[10px] font-mono tabular-nums shrink-0 ${
                  isUnlocked ? 'text-[#2DD4BF]' : 'text-[#D97706]'
                }`}
              >
                {isUnlocked ? `${unlockedCount} arch` : 'R&D'}
              </span>
            </div>
            <p className="text-[11px] text-[#8C9BB2] mt-0.5 line-clamp-1">
              {meta.nonVolatile ? 'Non-Volatile Storage' : 'Volatile High-Speed RAM'}
            </p>
          </button>
        );
      })}
    </div>
  );

  if (lockedCategoryTab && lockedGateTech) {
    return (
      <div className="p-4 lg:p-6 max-w-[1640px] mx-auto space-y-5">
        <div className="border-b border-[#1E293B] pb-4">
          <h1 className="text-xl lg:text-2xl font-bold text-[#E8EEF7] tracking-tight">
            Memory &amp; Storage Architect
          </h1>
          <p className="text-xs text-[#8C9BB2] mt-0.5">
            Engineer DRAM, VRAM/HBM stacks, 3D V-NAND flash, and post-silicon storage-class memory arrays
          </p>
        </div>

        {categorySelectorStrip}

        <div className="bg-[#101521] border border-[#1E293B] rounded-md p-6 max-w-3xl space-y-4">
          <div>
            <h2 className="text-lg font-bold text-[#E8EEF7]">
              {MEMORY_CATEGORY_META[lockedCategoryTab].label} — Technology Required
            </h2>
            <p className="text-sm text-[#8C9BB2] mt-1 leading-relaxed">
              {MEMORY_CATEGORY_META[lockedCategoryTab].description}
            </p>
          </div>
          <div className="bg-[#0A0E16] border border-[#1E293B] rounded-md p-3.5 text-xs space-y-1.5">
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
                className="h-9 px-4 rounded bg-[#14B8A6] hover:bg-[#2DD4BF] text-[#06080D] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <FlaskConical className="w-4 h-4" />
                <span>Start Research: {lockedGateTech.name}</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={lockedGateInProgress}
                onClick={() => (onJumpToTech ? onJumpToTech(lockedGateTech.id) : onJumpToTechTree())}
                className="h-9 px-4 rounded bg-[#161D2D] hover:bg-[#1E293B] border border-[#2C3B55] text-[#E8EEF7] text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-60"
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
              className="h-9 px-3.5 rounded bg-[#0A0E16] hover:bg-[#161D2D] border border-[#1E293B] text-xs text-[#8C9BB2] hover:text-[#E8EEF7] whitespace-nowrap cursor-pointer"
            >
              Return to {MEMORY_CATEGORY_META[draft.memoryCategory].shortLabel} Workbench
            </button>
          </div>
        </div>
      </div>
    );
  }

  const telemetryRows: TelemetryMetricRow[] = [
    {
      label: 'Areal Density',
      value:
        (physics.densityGbitPerMm2 ?? 0) < 0.01
          ? `${((physics.densityGbitPerMm2 ?? 0) * 1000).toFixed(2)} Mb/mm²`
          : `${(physics.densityGbitPerMm2 ?? 0).toFixed(2)} Gb/mm²`,
      baselineDelta:
        baselineEval && physics.densityGbitPerMm2 && baselineEval.physics.densityGbitPerMm2
          ? formatDelta(physics.densityGbitPerMm2, baselineEval.physics.densityGbitPerMm2, true)
          : null,
    },
    {
      label: 'Bandwidth',
      value: `${physics.memoryBandwidthGBs.toFixed(1)} GB/s`,
      tone: 'teal',
      baselineDelta: baselineEval
        ? formatDelta(physics.memoryBandwidthGBs, baselineEval.physics.memoryBandwidthGBs, true)
        : null,
    },
    {
      label: 'Access Latency',
      value: formatLatencyNs(physics.accessLatencyNs ?? 0),
      baselineDelta:
        baselineEval && physics.accessLatencyNs && baselineEval.physics.accessLatencyNs
          ? formatDelta(physics.accessLatencyNs, baselineEval.physics.accessLatencyNs, false)
          : null,
    },
    {
      label: 'Random IOPS',
      value: formatCompactNumber((physics.iopsK ?? 0) * 1000, 1),
      tone: 'cyan',
      baselineDelta:
        baselineEval && physics.iopsK && baselineEval.physics.iopsK
          ? formatDelta(physics.iopsK, baselineEval.physics.iopsK, true)
          : null,
    },
    {
      label: physics.nonVolatile ? 'Endurance (TBW)' : 'Refresh Draw',
      value: physics.nonVolatile
        ? `${formatCompactNumber(physics.enduranceTBW ?? 0, 1)} TBW`
        : `${(physics.refreshPowerW ?? 0).toFixed(2)} W`,
    },
    {
      label: 'Effective Power',
      value: `${physics.effectivePowerW.toFixed(1)} W`,
      tone: physics.powerThrottledRatio < 0.96 ? 'amber' : 'default',
      baselineDelta: baselineEval
        ? formatDelta(physics.effectivePowerW, baselineEval.physics.effectivePowerW, false, 'W')
        : null,
    },
    {
      label: 'Est. Yield (Best Fab)',
      value: `${physics.yieldPercent.toFixed(1)}% (${physics.goodDiesPerWafer.toFixed(0)}/wfr)`,
      tone: physics.yieldPercent < 45 ? 'amber' : 'emerald',
      baselineDelta: baselineEval
        ? formatDelta(physics.yieldPercent, baselineEval.physics.yieldPercent, true, '%')
        : null,
    },
  ];

  const stackCrossSectionVisualizer = (
    <div className="bg-[#101521] border border-[#1E293B] rounded-md p-4 space-y-2.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-[#8C9BB2] tracking-wide">
          3D Stack Cross-Section &amp; Cell States
        </span>
        <span className="font-mono tabular-nums text-[#2DD4BF]">
          {draft.stackLayers}L · {currentBitsMeta.shortLabel}
        </span>
      </div>
      <div className="foundry-grid-bg border border-[#1E293B] rounded-[4px] p-2.5">
        <svg
          viewBox="0 0 320 108"
          className="w-full h-[108px]"
          role="img"
          aria-label="3D vertical memory stack cross-section and multi-level cell voltage states"
        >
          <text
            x="8"
            y="11"
            fill="#8C9BB2"
            fontSize="8"
            fontFamily="ui-monospace, SFMono-Regular, Consolas, Menlo, monospace"
          >
            VERTICAL STACK ({draft.stackLayers}L)
          </text>
          <rect
            x="14"
            y="90"
            width="132"
            height="10"
            rx="1.5"
            fill="#161D2D"
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

          {Array.from({ length: visualLayers }).map((_, idx) => {
            const layerH = Math.min(11, 64 / Math.max(1, visualLayers) - 1.5);
            const y = 85 - (idx + 1) * (layerH + 1.8);
            const heatTint =
              physics.junctionTempC > physics.throttleTempC - 8 ? '#F59E0B' : '#14B8A6';
            return (
              <rect
                key={idx}
                x="22"
                y={y}
                width="116"
                height={Math.max(3.5, layerH)}
                rx="1"
                fill="#0F2E35"
                stroke={heatTint}
                strokeWidth="0.7"
              />
            );
          })}

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

          <line x1="164" y1="8" x2="164" y2="100" stroke="#1E293B" strokeWidth="1" />

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
            const peakH =
              currentBitsMeta.states >= 16 ? 34 : currentBitsMeta.states >= 8 ? 44 : 54;
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
  );

  return (
    <ArchitectStudioShell
      title="Memory & Storage Architect"
      subtitle="Engineer DRAM, VRAM/HBM stacks, 3D V-NAND flash, and post-silicon storage-class memory arrays"
      accent="teal"
      state={state}
      draftName={draft.name}
      nodeLabel={currentNode.name}
      evaluation={evaluation}
      baselineChips={memChips}
      baselineChipId={baselineChipId}
      baselineEval={baselineEval}
      onSelectBaseline={setBaselineChipId}
      thermalOverlay={thermalOverlay}
      onToggleThermal={onToggleThermal}
      canUndo={canUndo}
      canRedo={canRedo}
      onUndo={undo}
      onRedo={redo}
      onResetDefaults={handleReset}
      onAutoName={() => patch({ name: generateSmartChipName(draft, memChips.length) })}
      onApplyPreset={handleApplyPreset}
      onOptimize={handleOptimize}
      onTestPrototype={onTestPrototype}
      onStartTapeOut={handleTapeOut}
      feedback={feedback}
      topStrip={categorySelectorStrip}
      extraVisualizer={stackCrossSectionVisualizer}
      telemetryRows={telemetryRows}
      nextUnlockHints={nextUnlockHints}
      onJumpToTech={onJumpToTech}
    >
      {/* 01. Process, Cell Architecture & Interface */}
      <AccordionSection
        indexLabel="01"
        title="Silicon Process, Cell Architecture & Bus Interface"
        summary={`${currentNode.name} · ${currentCellArch.name}`}
        defaultOpen
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <label className="space-y-1 block">
            <span className="text-xs text-[#8C9BB2]">Product Designation</span>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              className="w-full h-9 px-3 rounded bg-[#0A0E16] border border-[#1E293B] focus:border-[#14B8A6] focus:outline-none text-xs text-[#E8EEF7]"
            />
          </label>

          <label className="space-y-1 block">
            <span className="text-xs text-[#8C9BB2]">Process Node</span>
            <select
              value={draft.processNodeId}
              onChange={(e) => commitDraft(applyMemoryNodeChange(draft, e.target.value))}
              className="foundry-select w-full h-9 px-2.5 rounded bg-[#0A0E16] border border-[#1E293B] focus:border-[#14B8A6] focus:outline-none text-xs text-[#E8EEF7]"
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
              className="foundry-select w-full h-9 px-2.5 rounded bg-[#0A0E16] border border-[#1E293B] focus:border-[#14B8A6] focus:outline-none text-xs text-[#E8EEF7]"
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
              onChange={(e) => commitDraft(applyMemoryTransistorChange(draft, e.target.value))}
              className="foundry-select w-full h-9 px-2.5 rounded bg-[#0A0E16] border border-[#1E293B] focus:border-[#14B8A6] focus:outline-none text-xs text-[#E8EEF7]"
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
              className="foundry-select w-full h-9 px-2.5 rounded bg-[#0A0E16] border border-[#1E293B] focus:border-[#14B8A6] focus:outline-none text-xs text-[#E8EEF7]"
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
              className="foundry-select w-full h-9 px-2.5 rounded bg-[#0A0E16] border border-[#1E293B] focus:border-[#14B8A6] focus:outline-none text-xs text-[#E8EEF7]"
            >
              {unlockedPackaging.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (max {p.maxDieAreaMm2} mm²)
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="text-[11px] text-[#8C9BB2] border-t border-[#1E293B] pt-2.5">
          <span className="text-[#CBD5E1] font-medium">{currentCellArch.name}:</span>{' '}
          {currentCellArch.description} ·{' '}
          <span className="text-amber-300/90">{currentCellArch.constraintNote}</span>
        </p>
      </AccordionSection>

      {/* 02. Array Capacity, 3D Stacking & ECC */}
      <AccordionSection
        indexLabel="02"
        title="Array Capacity, 3D Stacking & ECC Redundancy"
        summary={`${formatMemoryCapacity(draft.capacityGB)} · ${draft.stackLayers}L · ${currentBitsMeta.shortLabel}`}
        defaultOpen
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <PrecisionSlider
              label="Target Die / Stack Capacity"
              value={clampToSlider(draft.capacityGB, sliderBounds.capacityGB)}
              min={sliderBounds.capacityGB.min}
              max={sliderBounds.capacityGB.max}
              step={sliderBounds.capacityGB.step}
              displayValue={formatMemoryCapacity(draft.capacityGB)}
              accent="teal"
              onChange={(v) => patch({ capacityGB: v })}
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
              className="foundry-select w-full h-9 px-2.5 rounded bg-[#0A0E16] border border-[#1E293B] focus:border-[#14B8A6] focus:outline-none text-xs text-[#E8EEF7] disabled:opacity-55"
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

          <PrecisionSlider
            label="Bits per Physical Cell"
            value={Math.min(draft.bitsPerCell, currentCellArch.maxBitsPerCell)}
            min={1}
            max={currentCellArch.maxBitsPerCell}
            step={1}
            disabled={currentCellArch.maxBitsPerCell <= 1}
            displayValue={`${currentBitsMeta.shortLabel} (${currentBitsMeta.states} states)`}
            onChange={(v) =>
              commitDraft(applyMemoryStackOrBitsChange(draft, { bitsPerCell: Math.round(v) }))
            }
          />

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-[#8C9BB2]">Independent Banks / Planes</span>
              <span className="font-mono tabular-nums text-[#E8EEF7]">{draft.bankCount} banks</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sliderBounds.bankCountOptions.map((banks) => (
                <button
                  key={banks}
                  type="button"
                  onClick={() => patch({ bankCount: banks })}
                  className={`h-7 px-2.5 rounded text-[11px] font-mono border transition-colors whitespace-nowrap cursor-pointer ${
                    draft.bankCount === banks
                      ? 'bg-[#14B8A6]/20 border-[#14B8A6]/55 text-[#2DD4BF]'
                      : 'bg-[#0A0E16] border-[#1E293B] text-[#8C9BB2] hover:text-[#E8EEF7]'
                  }`}
                >
                  {banks}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-[#8C9BB2]">On-Die ECC Redundancy</span>
              <span className="font-mono tabular-nums text-[#818CF8]">
                {currentEccMeta.label} (+{Math.round(currentEccMeta.areaOverhead * 100)}%)
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {ECC_LEVEL_META.map((ecc) => (
                <button
                  key={ecc.level}
                  type="button"
                  onClick={() => patch({ eccLevel: ecc.level })}
                  className={`h-7 px-1.5 rounded text-[10px] font-mono border transition-colors whitespace-nowrap cursor-pointer ${
                    draft.eccLevel === ecc.level
                      ? 'bg-[#818CF8]/20 border-[#818CF8]/60 text-[#E0E7FF]'
                      : 'bg-[#0A0E16] border-[#1E293B] text-[#8C9BB2] hover:text-[#E8EEF7]'
                  }`}
                >
                  {ecc.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </AccordionSection>

      {/* 03. Signaling Rate, Bus Width, Supply Voltage & Cooling */}
      <AccordionSection
        indexLabel="03"
        title="Signaling Rate, Bus Width, Voltage & Cooling"
        summary={`${draft.dataRateMTs.toLocaleString()} MT/s · ${draft.busWidthBits}-bit · ${draft.voltageV.toFixed(2)}V`}
        defaultOpen
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PrecisionSlider
            label="Target Data Rate"
            value={clampToSlider(draft.dataRateMTs, sliderBounds.dataRateMTs)}
            min={sliderBounds.dataRateMTs.min}
            max={sliderBounds.dataRateMTs.max}
            step={sliderBounds.dataRateMTs.step}
            displayValue={`${draft.dataRateMTs.toLocaleString()} MT/s`}
            accent="teal"
            threshold={{
              value:
                sliderBounds.dataRateMTs.min +
                (sliderBounds.dataRateMTs.max - sliderBounds.dataRateMTs.min) * 0.85,
              kind: 'above-warn',
              label: 'High signaling voltage region',
            }}
            onChange={(v) => patch({ dataRateMTs: Math.round(v) })}
          />

          <label className="space-y-1 block">
            <span className="text-xs text-[#8C9BB2]">
              Interface Bus Width ({physics.memoryBandwidthGBs.toFixed(1)} GB/s)
            </span>
            <select
              value={draft.busWidthBits}
              onChange={(e) => patch({ busWidthBits: Number(e.target.value) })}
              className="foundry-select w-full h-9 px-2.5 rounded bg-[#0A0E16] border border-[#1E293B] focus:border-[#14B8A6] focus:outline-none text-xs text-[#E8EEF7]"
            >
              {sliderBounds.busWidthOptions.map((bits) => (
                <option key={bits} value={bits}>
                  {bits}-bit {currentInterface.name}
                </option>
              ))}
            </select>
          </label>

          <PrecisionSlider
            label={`Supply Voltage (Vmin ${physics.minStableVoltageV.toFixed(2)}V)`}
            value={clampToSlider(draft.voltageV, sliderBounds.voltageV)}
            min={sliderBounds.voltageV.min}
            max={sliderBounds.voltageV.max}
            step={sliderBounds.voltageV.step}
            displayValue={`${draft.voltageV.toFixed(2)} V`}
            accent={physics.voltageUnstable ? 'rose' : 'default'}
            threshold={{
              value: physics.minStableVoltageV,
              kind: 'below-danger',
              label: `Minimum stable voltage (${physics.minStableVoltageV.toFixed(2)} V)`,
            }}
            inlineAction={
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
                className={`h-5 px-1.5 rounded text-[10px] font-medium border transition-colors whitespace-nowrap cursor-pointer ${
                  physics.voltageUnstable
                    ? 'bg-rose-500/20 border-rose-400/60 text-rose-200 hover:bg-rose-500/30'
                    : 'bg-[#0A0E16] border-[#2C3B55] text-[#2DD4BF] hover:bg-[#161D2D]'
                }`}
              >
                Auto-Vmin
              </button>
            }
            onChange={(v) => patch({ voltageV: v })}
          />

          <PrecisionSlider
            label="Module Power Limit"
            value={clampToSlider(draft.powerLimitW, sliderBounds.powerLimitW)}
            min={sliderBounds.powerLimitW.min}
            max={sliderBounds.powerLimitW.max}
            step={sliderBounds.powerLimitW.step}
            displayValue={`${draft.powerLimitW} W`}
            accent="amber"
            onChange={(v) => patch({ powerLimitW: Math.round(v) })}
          />

          <label className="space-y-1 block sm:col-span-2">
            <span className="text-xs text-[#8C9BB2]">Cooling Solution</span>
            <select
              value={draft.coolingId}
              onChange={(e) => patch({ coolingId: e.target.value })}
              className="foundry-select w-full h-9 px-2.5 rounded bg-[#0A0E16] border border-[#1E293B] focus:border-[#14B8A6] focus:outline-none text-xs text-[#E8EEF7]"
            >
              {unlockedCooling.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (Rθ {c.thermalResistanceCPerW} °C/W · Limit {c.throttleTempC} °C)
                </option>
              ))}
            </select>
          </label>
        </div>
      </AccordionSection>
    </ArchitectStudioShell>
  );
};
