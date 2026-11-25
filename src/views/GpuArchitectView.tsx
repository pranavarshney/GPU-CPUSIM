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
  applyGpuPreset,
  generateSmartChipName,
  getNextUnlockHints,
  optimizeGpuDraft,
  type ArchitectPresetId,
  type OptimizeActionId,
} from '../engine/architectHelpers';
import {
  COOLING_SPECS,
  getGpuArch,
  getProcessNode,
  GPU_ARCHITECTURES,
  MEMORY_TECHS,
  PACKAGING_SPECS,
  PROCESS_NODES,
  TRANSISTOR_STRUCTURES,
} from '../engine/catalog';
import {
  applyGpuArchChange,
  applyGpuNodeChange,
  applyGpuTransistorChange,
  applyGpuVramChange,
  clampToSlider,
  evaluateGpuPhysics,
  getGpuSliderBounds,
  getStabilizedVoltageV,
  GPU_BUS_WIDTHS,
} from '../engine/physics';
import { buildPreviewPhysicsContext, createStarterGpuDraft } from '../engine/simulation';
import type { GameState, GpuBlueprint } from '../engine/types';
import { useDraftHistory } from '../hooks/useDraftHistory';

interface GpuArchitectViewProps {
  state: GameState;
  thermalOverlay: boolean;
  onToggleThermal: () => void;
  onUpdateDraft: (next: GpuBlueprint) => void;
  onStartTapeOut: (draft: GpuBlueprint, autoAssignLineId?: string) => { error?: string };
  onTestPrototype: () => void;
  onStartGpuUnlockResearch: () => void;
  onJumpToTech?: (techId: string) => void;
}

export const GpuArchitectView: React.FC<GpuArchitectViewProps> = ({
  state,
  thermalOverlay,
  onToggleThermal,
  onUpdateDraft,
  onStartTapeOut,
  onTestPrototype,
  onStartGpuUnlockResearch,
  onJumpToTech,
}) => {
  const [feedback, setFeedback] = useState<{ type: 'error' | 'ok'; msg: string } | null>(null);
  const [baselineChipId, setBaselineChipId] = useState<string>('');
  const unlocked = state.unlockedTechIds;
  const gpuUnlocked = unlocked.includes('gpu_fixed_pipeline');
  const gpuResearchActive = state.activeResearch.some((r) => r.techId === 'gpu_fixed_pipeline');

  const draft = state.gpuDraft;
  const { pushAndApply, undo, redo, canUndo, canRedo } = useDraftHistory<GpuBlueprint>(
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
  const unlockedArchs = GPU_ARCHITECTURES.filter(
    (a) => !a.requiredTechId || unlocked.includes(a.requiredTechId)
  );
  const unlockedVram = MEMORY_TECHS.filter(
    (m) => m.kind === 'vram' && (!m.requiredTechId || unlocked.includes(m.requiredTechId))
  );
  const unlockedCooling = COOLING_SPECS.filter(
    (c) => !c.requiredTechId || unlocked.includes(c.requiredTechId)
  );

  const currentNode = getProcessNode(draft.processNodeId);
  const currentArch = getGpuArch(draft.architectureId);
  const sliderBounds = getGpuSliderBounds(draft);

  const evaluation = useMemo(() => {
    const ctx = buildPreviewPhysicsContext(state, draft.processNodeId, 1.0);
    return evaluateGpuPhysics(draft, ctx);
  }, [draft, state]);

  const gpuChips = useMemo(
    () => state.chips.filter((c): c is GpuBlueprint => c.kind === 'gpu'),
    [state.chips]
  );

  const baselineEval = useMemo(() => {
    const base = gpuChips.find((c) => c.id === baselineChipId);
    if (!base) return undefined;
    const ctx = buildPreviewPhysicsContext(state, base.processNodeId, 1.0);
    return evaluateGpuPhysics(base, ctx);
  }, [gpuChips, baselineChipId, state]);

  const nextUnlockHints = useMemo(() => getNextUnlockHints('gpu', unlocked), [unlocked]);

  if (!gpuUnlocked) {
    return (
      <div className="p-6 max-w-3xl mx-auto mt-8">
        <div className="bg-[#101521] border border-[#1E293B] rounded-md p-6 space-y-4">
          <h1 className="text-xl font-bold text-[#E8EEF7]">GPU Architect — Technology Required</h1>
          <p className="text-sm text-[#8C9BB2] leading-relaxed">
            Dedicated graphics silicon requires researching{' '}
            <span className="text-[#E8EEF7] font-medium">Fixed-Function Graphics Accelerator</span>{' '}
            (90 RP, zero prerequisites). Shipping both CPUs and GPUs also activates a 1.32×
            ecosystem multiplier on Civilization Compute Demand.
          </p>
          <div className="pt-1 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={gpuResearchActive}
              onClick={onStartGpuUnlockResearch}
              className="h-9 px-4 rounded bg-[#06B6D4] hover:bg-[#22D3EE] disabled:opacity-50 text-[#06080D] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
            >
              <FlaskConical className="w-4 h-4" />
              <span>
                {gpuResearchActive
                  ? 'Currently Researching Fixed-Function Graphics...'
                  : 'Start Research: Fixed-Function Graphics (90 RP)'}
              </span>
            </button>
            {onJumpToTech && (
              <button
                type="button"
                onClick={() => onJumpToTech('gpu_fixed_pipeline')}
                className="h-9 px-3.5 rounded bg-[#0A0E16] hover:bg-[#161D2D] border border-[#1E293B] text-xs text-[#CBD5E1] cursor-pointer"
              >
                Locate in Tech Tree
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const { physics, benchmarks } = evaluation;

  const patch = (partial: Partial<GpuBlueprint>) => {
    pushAndApply({ ...draft, ...partial });
  };

  const commitDraft = (next: GpuBlueprint) => {
    pushAndApply(next);
  };

  const handleApplyPreset = (preset: ArchitectPresetId) => {
    const next = applyGpuPreset(draft, preset, state);
    commitDraft(next);
    setFeedback({ type: 'ok', msg: `Applied ${preset.replace('_', ' ')} GPU blueprint profile.` });
  };

  const handleOptimize = (action: OptimizeActionId) => {
    const next = optimizeGpuDraft(draft, action, state);
    commitDraft(next);
    const labelMap: Record<OptimizeActionId, string> = {
      fit_reticle: 'Fitted shader array & L2 cache within reticle ceiling.',
      stabilize_voltage: 'Stabilized GPU core voltage above Vmin threshold.',
      match_cooling: 'Matched cooling solution and board power limit to GPU load.',
      balance_bandwidth: 'Maximized VRAM bandwidth & L2 cache for shader roofline.',
    };
    setFeedback({ type: 'ok', msg: labelMap[action] });
  };

  const handleReset = () => {
    const starter = createStarterGpuDraft();
    const bestNode = unlockedNodes[unlockedNodes.length - 1] ?? unlockedNodes[0];
    commitDraft(applyGpuNodeChange(starter, bestNode.id));
    setFeedback({ type: 'ok', msg: `Reset GPU draft on ${bestNode.name}.` });
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

  const maxBusForVram = sliderBounds.maxBusWidthBits;

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
      label: 'Memory Bandwidth',
      value: `${physics.memoryBandwidthGBs.toFixed(1)} GB/s`,
      tone: 'teal',
      baselineDelta: baselineEval
        ? formatDelta(physics.memoryBandwidthGBs, baselineEval.physics.memoryBandwidthGBs, true)
        : null,
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
      label: 'Render / Compute',
      value: `${benchmarks.gamingRendering} / ${benchmarks.gpuCompute}`,
      tone: 'cyan',
      baselineDelta: baselineEval
        ? formatDelta(benchmarks.gpuCompute, baselineEval.benchmarks.gpuCompute, true)
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
      title="GPU Architect"
      subtitle="Balance shader arrays, VRAM bus roofline, ROP/TMU fill rates, and package thermals"
      accent="cyan"
      state={state}
      draftName={draft.name}
      nodeLabel={currentNode.name}
      evaluation={evaluation}
      baselineChips={gpuChips}
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
      onAutoName={() => patch({ name: generateSmartChipName(draft, gpuChips.length) })}
      onApplyPreset={handleApplyPreset}
      onOptimize={handleOptimize}
      onTestPrototype={onTestPrototype}
      onStartTapeOut={handleTapeOut}
      feedback={feedback}
      telemetryRows={telemetryRows}
      nextUnlockHints={nextUnlockHints}
      onJumpToTech={onJumpToTech}
    >
      {/* 01. Process Node & Rendering Pipeline */}
      <AccordionSection
        indexLabel="01"
        title="Process Node & Rendering Pipeline"
        summary={`${currentNode.name} · ${currentArch.name}`}
        defaultOpen
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <label className="space-y-1 block">
            <span className="text-xs text-[#8C9BB2]">GPU Designation</span>
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
              onChange={(e) => commitDraft(applyGpuNodeChange(draft, e.target.value))}
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
            <span className="text-xs text-[#8C9BB2]">GPU Core Architecture</span>
            <select
              value={draft.architectureId}
              onChange={(e) => commitDraft(applyGpuArchChange(draft, e.target.value))}
              className="foundry-select w-full h-9 px-2.5 rounded bg-[#0A0E16] border border-[#1E293B] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
            >
              {unlockedArchs.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} (max {a.maxShaderCores.toLocaleString()} cores)
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 block">
            <span className="text-xs text-[#8C9BB2]">Transistor Structure</span>
            <select
              value={draft.transistorStructureId}
              onChange={(e) => commitDraft(applyGpuTransistorChange(draft, e.target.value))}
              className="foundry-select w-full h-9 px-2.5 rounded bg-[#0A0E16] border border-[#1E293B] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
            >
              {unlockedTransistors.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 block sm:col-span-2">
            <span className="text-xs text-[#8C9BB2]">Packaging Substrate</span>
            <select
              value={draft.packagingId}
              onChange={(e) => patch({ packagingId: e.target.value })}
              className="foundry-select w-full h-9 px-2.5 rounded bg-[#0A0E16] border border-[#1E293B] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
            >
              {unlockedPackaging.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (max {p.maxDieAreaMm2} mm²)
                </option>
              ))}
            </select>
          </label>
        </div>
      </AccordionSection>

      {/* 02. Shader Arrays, Raster Units & Clocking */}
      <AccordionSection
        indexLabel="02"
        title="Shader Arrays, Raster Units & Clocking"
        summary={`${draft.shaderCores.toLocaleString()} shaders · ${formatClock(draft.clockGHz)} · ${draft.voltageV.toFixed(2)}V`}
        defaultOpen
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PrecisionSlider
            label="Shader / Compute Cores"
            value={clampToSlider(draft.shaderCores, sliderBounds.shaderCores)}
            min={sliderBounds.shaderCores.min}
            max={sliderBounds.shaderCores.max}
            step={sliderBounds.shaderCores.step}
            displayValue={draft.shaderCores.toLocaleString()}
            unitHint={`/ ${currentArch.maxShaderCores.toLocaleString()}`}
            onChange={(v) => patch({ shaderCores: Math.round(v) })}
          />

          <PrecisionSlider
            label="GPU Core Clock"
            value={clampToSlider(draft.clockGHz, sliderBounds.clockGHz)}
            min={sliderBounds.clockGHz.min}
            max={sliderBounds.clockGHz.max}
            step={sliderBounds.clockGHz.step}
            displayValue={formatClock(draft.clockGHz)}
            accent="cyan"
            threshold={{
              value: sliderBounds.clockGHz.min + (sliderBounds.clockGHz.max - sliderBounds.clockGHz.min) * 0.82,
              kind: 'above-warn',
              label: 'High power/voltage wall region',
            }}
            onChange={(v) => patch({ clockGHz: v })}
          />

          <PrecisionSlider
            label="ROPs (Render Output Units)"
            value={clampToSlider(draft.rops, sliderBounds.rops)}
            min={sliderBounds.rops.min}
            max={sliderBounds.rops.max}
            step={sliderBounds.rops.step}
            displayValue={`${draft.rops}`}
            onChange={(v) => patch({ rops: Math.round(v) })}
          />

          <PrecisionSlider
            label="TMUs (Texture Mapping Units)"
            value={clampToSlider(draft.tmus, sliderBounds.tmus)}
            min={sliderBounds.tmus.min}
            max={sliderBounds.tmus.max}
            step={sliderBounds.tmus.step}
            displayValue={`${draft.tmus}`}
            onChange={(v) => patch({ tmus: Math.round(v) })}
          />

          <div className="sm:col-span-2">
            <PrecisionSlider
              label={`GPU Supply Voltage (Vmin ${physics.minStableVoltageV.toFixed(2)}V)`}
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
          </div>
        </div>
      </AccordionSection>

      {/* 03. VRAM Subsystem, Caches & Cooling */}
      <AccordionSection
        indexLabel="03"
        title="VRAM Bandwidth, Caches & Cooling"
        summary={`${draft.memoryBusWidthBits}-bit (${physics.memoryBandwidthGBs.toFixed(0)} GB/s) · ${draft.powerLimitW}W`}
        defaultOpen
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-1 block">
            <span className="text-xs text-[#8C9BB2]">VRAM Memory Technology</span>
            <select
              value={draft.vramTechId}
              onChange={(e) => commitDraft(applyGpuVramChange(draft, e.target.value))}
              className="foundry-select w-full h-9 px-2.5 rounded bg-[#0A0E16] border border-[#1E293B] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
            >
              {unlockedVram.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.gbpsPerUnit} GB/s per 32-bit)
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 block">
            <span className="text-xs text-[#8C9BB2]">
              Memory Bus Width ({physics.memoryBandwidthGBs.toFixed(1)} GB/s)
            </span>
            <select
              value={draft.memoryBusWidthBits}
              onChange={(e) => patch({ memoryBusWidthBits: Number(e.target.value) })}
              className="foundry-select w-full h-9 px-2.5 rounded bg-[#0A0E16] border border-[#1E293B] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
            >
              {GPU_BUS_WIDTHS.filter((b) => b <= maxBusForVram).map((bits) => (
                <option key={bits} value={bits}>
                  {bits}-bit Bus
                </option>
              ))}
            </select>
          </label>

          <PrecisionSlider
            label="VRAM Capacity"
            value={clampToSlider(draft.vramCapacityGB, sliderBounds.vramCapacityGB)}
            min={sliderBounds.vramCapacityGB.min}
            max={sliderBounds.vramCapacityGB.max}
            step={sliderBounds.vramCapacityGB.step}
            displayValue={
              draft.vramCapacityGB < 1
                ? `${Math.round(draft.vramCapacityGB * 1024)} MB`
                : `${draft.vramCapacityGB} GB`
            }
            accent="teal"
            onChange={(v) => patch({ vramCapacityGB: v })}
          />

          <PrecisionSlider
            label="Shader L1 Cache"
            value={clampToSlider(draft.l1CacheMB, sliderBounds.l1CacheMB)}
            min={sliderBounds.l1CacheMB.min}
            max={sliderBounds.l1CacheMB.max}
            step={sliderBounds.l1CacheMB.step}
            displayValue={
              draft.l1CacheMB < 1
                ? `${Math.round(draft.l1CacheMB * 1024)} KB`
                : `${draft.l1CacheMB.toFixed(1)} MB`
            }
            onChange={(v) => patch({ l1CacheMB: v })}
          />

          <PrecisionSlider
            label="Unified L2 Cache"
            value={clampToSlider(draft.l2CacheMB, sliderBounds.l2CacheMB)}
            min={sliderBounds.l2CacheMB.min}
            max={sliderBounds.l2CacheMB.max}
            step={sliderBounds.l2CacheMB.step}
            displayValue={
              draft.l2CacheMB < 1 ? `${Math.round(draft.l2CacheMB * 1024)} KB` : `${draft.l2CacheMB} MB`
            }
            onChange={(v) => patch({ l2CacheMB: v })}
          />

          <PrecisionSlider
            label="Board Power Limit"
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
              className="foundry-select w-full h-9 px-2.5 rounded bg-[#0A0E16] border border-[#1E293B] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
            >
              {unlockedCooling.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.thermalResistanceCPerW} °C/W · Limit {c.throttleTempC} °C)
                </option>
              ))}
            </select>
          </label>
        </div>
      </AccordionSection>
    </ArchitectStudioShell>
  );
};
