import React, { useMemo, useState } from 'react';
import {
  ArchitectStudioShell,
  formatDelta,
  type TelemetryMetricRow,
} from '../components/ArchitectStudioShell';
import { AccordionSection } from '../components/ui/AccordionSection';
import { PrecisionSlider } from '../components/ui/PrecisionSlider';
import {
  applyCpuPreset,
  generateSmartChipName,
  getNextUnlockHints,
  optimizeCpuDraft,
  type ArchitectPresetId,
  type OptimizeActionId,
} from '../engine/architectHelpers';
import {
  COOLING_SPECS,
  CPU_ARCHITECTURES,
  getCpuArch,
  getMaxPcieGen,
  getProcessNode,
  ISA_EXTENSIONS,
  MEMORY_TECHS,
  PACKAGING_SPECS,
  PROCESS_NODES,
  TRANSISTOR_STRUCTURES,
} from '../engine/catalog';
import {
  applyCpuArchChange,
  applyCpuNodeChange,
  applyCpuTransistorChange,
  clampToSlider,
  evaluateCpuPhysics,
  getCpuSliderBounds,
  getStabilizedVoltageV,
} from '../engine/physics';
import { buildPreviewPhysicsContext, createStarterCpuDraft } from '../engine/simulation';
import type { CpuBlueprint, GameState } from '../engine/types';
import { useDraftHistory } from '../hooks/useDraftHistory';

interface CpuArchitectViewProps {
  state: GameState;
  thermalOverlay: boolean;
  onToggleThermal: () => void;
  onUpdateDraft: (next: CpuBlueprint) => void;
  onStartTapeOut: (draft: CpuBlueprint, autoAssignLineId?: string) => { error?: string };
  onTestPrototype: () => void;
  onJumpToTech?: (techId: string) => void;
}

export const CpuArchitectView: React.FC<CpuArchitectViewProps> = ({
  state,
  thermalOverlay,
  onToggleThermal,
  onUpdateDraft,
  onStartTapeOut,
  onTestPrototype,
  onJumpToTech,
}) => {
  const [feedback, setFeedback] = useState<{ type: 'error' | 'ok'; msg: string } | null>(null);
  const [baselineChipId, setBaselineChipId] = useState<string>('');
  const draft = state.cpuDraft;
  const unlocked = state.unlockedTechIds;

  const { pushAndApply, undo, redo, canUndo, canRedo } = useDraftHistory<CpuBlueprint>(
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
  const unlockedArchs = CPU_ARCHITECTURES.filter(
    (a) => !a.requiredTechId || unlocked.includes(a.requiredTechId)
  );
  const unlockedRam = MEMORY_TECHS.filter(
    (m) => m.kind === 'ram' && (!m.requiredTechId || unlocked.includes(m.requiredTechId))
  );
  const unlockedCooling = COOLING_SPECS.filter(
    (c) => !c.requiredTechId || unlocked.includes(c.requiredTechId)
  );
  const unlockedIsa = ISA_EXTENSIONS.filter(
    (i) => !i.requiredTechId || unlocked.includes(i.requiredTechId)
  );

  const socUnlocked = unlocked.includes('cpu_igpu_npu');
  const maxPcieGen = getMaxPcieGen(unlocked);
  const currentNode = getProcessNode(draft.processNodeId);
  const currentArch = getCpuArch(draft.architectureId);
  const sliderBounds = getCpuSliderBounds(draft);

  const evaluation = useMemo(() => {
    const ctx = buildPreviewPhysicsContext(state, draft.processNodeId, 1.0);
    return evaluateCpuPhysics(draft, ctx);
  }, [draft, state]);

  const cpuChips = useMemo(
    () => state.chips.filter((c): c is CpuBlueprint => c.kind === 'cpu'),
    [state.chips]
  );

  const baselineEval = useMemo(() => {
    const base = cpuChips.find((c) => c.id === baselineChipId);
    if (!base) return undefined;
    const ctx = buildPreviewPhysicsContext(state, base.processNodeId, 1.0);
    return evaluateCpuPhysics(base, ctx);
  }, [cpuChips, baselineChipId, state]);

  const nextUnlockHints = useMemo(() => getNextUnlockHints('cpu', unlocked), [unlocked]);

  const { physics, benchmarks } = evaluation;

  const patch = (partial: Partial<CpuBlueprint>) => {
    pushAndApply({ ...draft, ...partial });
  };

  const commitDraft = (next: CpuBlueprint) => {
    pushAndApply(next);
  };

  const toggleIsa = (isaId: string) => {
    if (isaId === 'isa_int') return;
    const exists = draft.isaExtensions.includes(isaId);
    patch({
      isaExtensions: exists
        ? draft.isaExtensions.filter((x) => x !== isaId)
        : [...draft.isaExtensions, isaId],
    });
  };

  const handleApplyPreset = (preset: ArchitectPresetId) => {
    const next = applyCpuPreset(draft, preset, state);
    commitDraft(next);
    setFeedback({ type: 'ok', msg: `Applied ${preset.replace('_', ' ')} CPU blueprint profile.` });
  };

  const handleOptimize = (action: OptimizeActionId) => {
    const next = optimizeCpuDraft(draft, action, state);
    commitDraft(next);
    const labelMap: Record<OptimizeActionId, string> = {
      fit_reticle: 'Fitted die geometry within reticle ceiling.',
      stabilize_voltage: 'Stabilized core voltage above Vmin threshold.',
      match_cooling: 'Matched cooling solution and TDP envelope to raw power draw.',
      balance_bandwidth: 'Balanced RAM technology and channels for core count.',
    };
    setFeedback({ type: 'ok', msg: labelMap[action] });
  };

  const handleReset = () => {
    const starter = createStarterCpuDraft();
    const bestNode = unlockedNodes[unlockedNodes.length - 1] ?? unlockedNodes[0];
    commitDraft(applyCpuNodeChange(starter, bestNode.id));
    setFeedback({ type: 'ok', msg: `Reset CPU draft on ${bestNode.name}.` });
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

  const formatClock = (ghz: number) =>
    ghz < 1 ? `${Math.round(ghz * 1000)} MHz` : `${ghz.toFixed(2)} GHz`;

  const telemetryRows: TelemetryMetricRow[] = [
    {
      label: 'Transistor Count',
      value:
        physics.transistorCountMTr >= 1000
          ? `${(physics.transistorCountMTr / 1000).toFixed(2)} B`
          : `${physics.transistorCountMTr.toFixed(2)} M`,
      baselineDelta: baselineEval
        ? formatDelta(physics.transistorCountMTr, baselineEval.physics.transistorCountMTr, true)
        : null,
    },
    {
      label: 'Sustained Clock',
      value: formatClock(physics.sustainedClockGHz),
      tone: 'cyan',
      baselineDelta: baselineEval
        ? formatDelta(physics.sustainedClockGHz, baselineEval.physics.sustainedClockGHz, true)
        : null,
    },
    {
      label: 'Effective IPC',
      value: `${(physics.effectiveIpc ?? currentArch.baseIpc * draft.ipcTuning).toFixed(2)} IPC`,
      baselineDelta:
        baselineEval && physics.effectiveIpc && baselineEval.physics.effectiveIpc
          ? formatDelta(physics.effectiveIpc, baselineEval.physics.effectiveIpc, true)
          : null,
    },
    {
      label: 'Effective Power',
      value: `${physics.effectivePowerW.toFixed(1)} W${physics.carnotOverheadW > 0 ? ` (+${physics.carnotOverheadW.toFixed(0)}W cryo)` : ''}`,
      tone: physics.powerThrottledRatio < 0.96 ? 'amber' : 'default',
      baselineDelta: baselineEval
        ? formatDelta(physics.effectivePowerW, baselineEval.physics.effectivePowerW, false, 'W')
        : null,
    },
    {
      label: 'Memory Bandwidth',
      value: `${physics.memoryBandwidthGBs.toFixed(1)} GB/s`,
      tone: 'teal',
      baselineDelta: baselineEval
        ? formatDelta(physics.memoryBandwidthGBs, baselineEval.physics.memoryBandwidthGBs, true)
        : null,
    },
    {
      label: 'Single / Multi Score',
      value: `${benchmarks.singleCoreCpu} / ${benchmarks.multiCoreCpu}`,
      tone: 'cyan',
      baselineDelta: baselineEval
        ? formatDelta(benchmarks.multiCoreCpu, baselineEval.benchmarks.multiCoreCpu, true)
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

  return (
    <ArchitectStudioShell
      title="CPU Architect"
      subtitle="Configure silicon geometry, voltage-frequency envelopes, caches, and interconnects with live physics verification"
      accent="cyan"
      state={state}
      draftName={draft.name}
      nodeLabel={currentNode.name}
      evaluation={evaluation}
      baselineChips={cpuChips}
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
      onAutoName={() => patch({ name: generateSmartChipName(draft, cpuChips.length) })}
      onApplyPreset={handleApplyPreset}
      onOptimize={handleOptimize}
      onTestPrototype={onTestPrototype}
      onStartTapeOut={handleTapeOut}
      feedback={feedback}
      telemetryRows={telemetryRows}
      nextUnlockHints={nextUnlockHints}
      onJumpToTech={onJumpToTech}
    >
      {/* 01. Process, Architecture & Substrate */}
      <AccordionSection
        indexLabel="01"
        title="Silicon Process & Architecture"
        summary={`${currentNode.name} · ${currentArch.name}`}
        defaultOpen
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <label className="space-y-1 block">
            <span className="text-xs text-[#8C9BB2]">Processor Designation</span>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              className="w-full h-9 px-3 rounded bg-[#0A0E16] border border-[#1E293B] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
            />
          </label>

          <label className="space-y-1 block">
            <span className="text-xs text-[#8C9BB2]">Process Node</span>
            <select
              value={draft.processNodeId}
              onChange={(e) => commitDraft(applyCpuNodeChange(draft, e.target.value))}
              className="foundry-select w-full h-9 px-2.5 rounded bg-[#0A0E16] border border-[#1E293B] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
            >
              {unlockedNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} ({n.logicDensityMTrPerMm2} MTr/mm²)
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 block">
            <span className="text-xs text-[#8C9BB2]">CPU Microarchitecture</span>
            <select
              value={draft.architectureId}
              onChange={(e) => commitDraft(applyCpuArchChange(draft, e.target.value))}
              className="foundry-select w-full h-9 px-2.5 rounded bg-[#0A0E16] border border-[#1E293B] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
            >
              {unlockedArchs.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} (IPC {a.baseIpc}×)
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 block">
            <span className="text-xs text-[#8C9BB2]">Transistor Structure</span>
            <select
              value={draft.transistorStructureId}
              onChange={(e) => commitDraft(applyCpuTransistorChange(draft, e.target.value))}
              className="foundry-select w-full h-9 px-2.5 rounded bg-[#0A0E16] border border-[#1E293B] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
            >
              {unlockedTransistors.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.densityMultiplier}× dens)
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 block sm:col-span-2">
            <span className="text-xs text-[#8C9BB2]">Packaging &amp; Interconnect Substrate</span>
            <select
              value={draft.packagingId}
              onChange={(e) => patch({ packagingId: e.target.value })}
              className="foundry-select w-full h-9 px-2.5 rounded bg-[#0A0E16] border border-[#1E293B] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
            >
              {unlockedPackaging.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (max {p.maxDieAreaMm2} mm² · {p.interconnectBonus}× scaling)
                </option>
              ))}
            </select>
          </label>
        </div>
      </AccordionSection>

      {/* 02. Core Topology, Clocks & Voltage */}
      <AccordionSection
        indexLabel="02"
        title="Core Topology, Clocks & Voltage"
        summary={`${draft.pCores}P${draft.eCores > 0 ? `+${draft.eCores}E` : ''} · ${formatClock(draft.pClockGHz)} · ${draft.voltageV.toFixed(2)}V`}
        defaultOpen
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PrecisionSlider
            label="Performance Cores (P-Cores)"
            value={draft.pCores}
            min={1}
            max={currentArch.maxPCores}
            step={1}
            displayValue={`${draft.pCores} / ${currentArch.maxPCores}`}
            onChange={(v) => patch({ pCores: Math.round(v) })}
          />

          <PrecisionSlider
            label="Efficiency Cores (E-Cores)"
            value={draft.eCores}
            min={0}
            max={Math.max(0, currentArch.maxECores)}
            step={1}
            disabled={!currentArch.supportsECores}
            displayValue={
              currentArch.supportsECores
                ? `${draft.eCores} / ${currentArch.maxECores}`
                : 'Superscalar+'
            }
            onChange={(v) => patch({ eCores: Math.round(v) })}
          />

          <PrecisionSlider
            label="Target P-Core Clock"
            value={clampToSlider(draft.pClockGHz, sliderBounds.pClockGHz)}
            min={sliderBounds.pClockGHz.min}
            max={sliderBounds.pClockGHz.max}
            step={sliderBounds.pClockGHz.step}
            displayValue={formatClock(draft.pClockGHz)}
            accent="cyan"
            threshold={{
              value: sliderBounds.pClockGHz.min + (sliderBounds.pClockGHz.max - sliderBounds.pClockGHz.min) * 0.82,
              kind: 'above-warn',
              label: 'Steep voltage/thermal wall region',
            }}
            onChange={(nextP) =>
              patch({
                pClockGHz: nextP,
                eClockGHz: Math.min(draft.eClockGHz, nextP),
              })
            }
          />

          <PrecisionSlider
            label={`Core Voltage (Vmin ${physics.minStableVoltageV.toFixed(2)}V)`}
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
                    : 'bg-[#0A0E16] border-[#2C3B55] text-[#22D3EE] hover:bg-[#161D2D]'
                }`}
              >
                Auto-Vmin
              </button>
            }
            onChange={(v) => patch({ voltageV: v })}
          />

          <PrecisionSlider
            label="Microarchitecture IPC Tuning"
            value={clampToSlider(draft.ipcTuning, sliderBounds.ipcTuning)}
            min={sliderBounds.ipcTuning.min}
            max={sliderBounds.ipcTuning.max}
            step={sliderBounds.ipcTuning.step}
            displayValue={`${(physics.effectiveIpc ?? currentArch.baseIpc * draft.ipcTuning).toFixed(2)} IPC`}
            unitHint={`${draft.ipcTuning.toFixed(2)}×`}
            onChange={(v) => patch({ ipcTuning: v })}
          />

          {currentArch.supportsECores && draft.eCores > 0 && (
            <PrecisionSlider
              label="Target E-Core Clock"
              value={clampToSlider(draft.eClockGHz, sliderBounds.eClockGHz)}
              min={sliderBounds.eClockGHz.min}
              max={sliderBounds.eClockGHz.max}
              step={sliderBounds.eClockGHz.step}
              displayValue={formatClock(draft.eClockGHz)}
              onChange={(v) => patch({ eClockGHz: v })}
            />
          )}
        </div>
      </AccordionSection>

      {/* 03. Cache Hierarchy & ISA */}
      <AccordionSection
        indexLabel="03"
        title="Cache Hierarchy & Instruction Sets"
        summary={`L1 ${draft.l1CacheKBPerCore}KB · L2 ${draft.l2CacheMBTotal < 1 ? `${Math.round(draft.l2CacheMBTotal * 1024)}KB` : `${draft.l2CacheMBTotal.toFixed(1)}MB`} · L3 ${draft.l3CacheMBTotal}MB`}
        defaultOpen
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <PrecisionSlider
            label="L1 / Core"
            value={clampToSlider(draft.l1CacheKBPerCore, sliderBounds.l1CacheKBPerCore)}
            min={sliderBounds.l1CacheKBPerCore.min}
            max={sliderBounds.l1CacheKBPerCore.max}
            step={sliderBounds.l1CacheKBPerCore.step}
            displayValue={`${draft.l1CacheKBPerCore} KB`}
            onChange={(v) => patch({ l1CacheKBPerCore: v })}
          />

          <PrecisionSlider
            label="L2 Total"
            value={clampToSlider(draft.l2CacheMBTotal, sliderBounds.l2CacheMBTotal)}
            min={sliderBounds.l2CacheMBTotal.min}
            max={sliderBounds.l2CacheMBTotal.max}
            step={sliderBounds.l2CacheMBTotal.step}
            displayValue={
              draft.l2CacheMBTotal === 0
                ? 'None'
                : draft.l2CacheMBTotal < 1
                  ? `${Math.round(draft.l2CacheMBTotal * 1024)} KB`
                  : `${draft.l2CacheMBTotal.toFixed(1)} MB`
            }
            onChange={(v) => patch({ l2CacheMBTotal: v })}
          />

          <PrecisionSlider
            label="L3 Shared"
            value={clampToSlider(draft.l3CacheMBTotal, sliderBounds.l3CacheMBTotal)}
            min={sliderBounds.l3CacheMBTotal.min}
            max={sliderBounds.l3CacheMBTotal.max}
            step={sliderBounds.l3CacheMBTotal.step}
            displayValue={draft.l3CacheMBTotal === 0 ? 'None' : `${draft.l3CacheMBTotal} MB`}
            onChange={(v) => patch({ l3CacheMBTotal: v })}
          />
        </div>

        <div className="pt-2 border-t border-[#1E293B] space-y-2">
          <div className="text-xs text-[#8C9BB2]">Enabled Instruction Sets &amp; SIMD</div>
          <div className="flex flex-wrap gap-1.5">
            {unlockedIsa.map((ext) => {
              const active = draft.isaExtensions.includes(ext.id);
              return (
                <button
                  key={ext.id}
                  type="button"
                  onClick={() => toggleIsa(ext.id)}
                  className={`h-7 px-2.5 rounded text-[11px] font-mono border transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-[#06B6D4]/20 border-[#06B6D4]/55 text-[#22D3EE]'
                      : 'bg-[#0A0E16] border-[#1E293B] text-[#8C9BB2] hover:text-[#E8EEF7]'
                  }`}
                >
                  {ext.shortLabel}
                </button>
              );
            })}
          </div>
        </div>
      </AccordionSection>

      {/* 04. Memory, I/O, Accelerators & Thermal Envelope */}
      <AccordionSection
        indexLabel="04"
        title="Memory, I/O, SoC Accelerators & Cooling"
        summary={`${draft.memoryChannels}ch (${physics.memoryBandwidthGBs.toFixed(0)} GB/s) · ${draft.powerLimitW}W TDP`}
        defaultOpen
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-1 block">
            <span className="text-xs text-[#8C9BB2]">Supported RAM Technology</span>
            <select
              value={draft.memoryTechId}
              onChange={(e) => patch({ memoryTechId: e.target.value })}
              className="foundry-select w-full h-9 px-2.5 rounded bg-[#0A0E16] border border-[#1E293B] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
            >
              {unlockedRam.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.gbpsPerUnit} GB/s per ch)
                </option>
              ))}
            </select>
          </label>

          <PrecisionSlider
            label={`Memory Channels (${physics.memoryBandwidthGBs.toFixed(1)} GB/s)`}
            value={draft.memoryChannels}
            min={1}
            max={16}
            step={1}
            displayValue={`${draft.memoryChannels} ch`}
            accent="teal"
            onChange={(v) => patch({ memoryChannels: Math.round(v) })}
          />

          <PrecisionSlider
            label={`PCIe Lanes (Gen ${maxPcieGen} · ${(physics.pcieBandwidthGBs ?? 0).toFixed(1)} GB/s)`}
            value={clampToSlider(draft.pcieLanes, sliderBounds.pcieLanes)}
            min={sliderBounds.pcieLanes.min}
            max={sliderBounds.pcieLanes.max}
            step={sliderBounds.pcieLanes.step}
            displayValue={`${draft.pcieLanes} lanes`}
            onChange={(v) => patch({ pcieLanes: Math.round(v) })}
          />

          <PrecisionSlider
            label="Package Power Limit (TDP)"
            value={clampToSlider(draft.powerLimitW, sliderBounds.powerLimitW)}
            min={sliderBounds.powerLimitW.min}
            max={sliderBounds.powerLimitW.max}
            step={sliderBounds.powerLimitW.step}
            displayValue={`${draft.powerLimitW} W`}
            accent="amber"
            onChange={(v) => patch({ powerLimitW: Math.round(v) })}
          />

          <PrecisionSlider
            label="Integrated GPU Tier"
            value={draft.igpuTier}
            min={0}
            max={5}
            step={1}
            disabled={!socUnlocked}
            displayValue={
              socUnlocked ? (draft.igpuTier === 0 ? 'Disabled' : `Tier ${draft.igpuTier}`) : 'Research SoC'
            }
            onChange={(v) => patch({ igpuTier: Math.round(v) })}
          />

          <PrecisionSlider
            label="Neural Engine (NPU) Tier"
            value={draft.npuTier}
            min={0}
            max={5}
            step={1}
            disabled={!socUnlocked}
            displayValue={
              socUnlocked ? (draft.npuTier === 0 ? 'Disabled' : `Tier ${draft.npuTier}`) : 'Research SoC'
            }
            onChange={(v) => patch({ npuTier: Math.round(v) })}
          />

          <label className="space-y-1 block sm:col-span-2">
            <span className="text-xs text-[#8C9BB2]">Cooling Solution</span>
            <select
              value={draft.coolingId}
              onChange={(e) => patch({ coolingId: e.target.value })}
              className="foundry-select w-full h-9 px-2.5 rounded bg-[#0A0E16] border border-[#1E293B] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
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
