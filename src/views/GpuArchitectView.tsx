import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FlaskConical, Gauge, Layers, Play } from 'lucide-react';
import { DieFloorplanSVG } from '../components/DieFloorplanSVG';
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
import { buildPreviewPhysicsContext, formatCompactNumber } from '../engine/simulation';
import type { GameState, GpuBlueprint } from '../engine/types';

interface GpuArchitectViewProps {
  state: GameState;
  thermalOverlay: boolean;
  onToggleThermal: () => void;
  onUpdateDraft: (next: GpuBlueprint) => void;
  onStartTapeOut: (draft: GpuBlueprint) => { error?: string };
  onTestPrototype: () => void;
  onStartGpuUnlockResearch: () => void;
}

export const GpuArchitectView: React.FC<GpuArchitectViewProps> = ({
  state,
  thermalOverlay,
  onToggleThermal,
  onUpdateDraft,
  onStartTapeOut,
  onTestPrototype,
  onStartGpuUnlockResearch,
}) => {
  const [feedback, setFeedback] = useState<{ type: 'error' | 'ok'; msg: string } | null>(null);
  const unlocked = state.unlockedTechIds;
  const gpuUnlocked = unlocked.includes('gpu_fixed_pipeline');
  const gpuResearchActive = state.activeResearch.some((r) => r.techId === 'gpu_fixed_pipeline');

  const draft = state.gpuDraft;
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

  const { physics, benchmarks } = evaluation;

  if (!gpuUnlocked) {
    return (
      <div className="p-6 max-w-3xl mx-auto mt-8">
        <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-6 space-y-4">
          <h1 className="text-xl font-bold text-[#E8EEF7]">GPU Architect — Technology Required</h1>
          <p className="text-sm text-[#8C9BB2] leading-relaxed">
            Dedicated graphics silicon requires researching{' '}
            <span className="text-[#E8EEF7] font-medium">Fixed-Function Graphics Accelerator</span>{' '}
            (90 RP, zero prerequisites). Shipping both CPUs and GPUs also activates a 1.32×
            ecosystem multiplier on Civilization Compute Demand.
          </p>
          <div className="pt-1">
            <button
              type="button"
              disabled={gpuResearchActive}
              onClick={onStartGpuUnlockResearch}
              className="h-9 px-4 rounded-md bg-[#06B6D4] hover:bg-[#22D3EE] disabled:opacity-50 text-[#07090E] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
            >
              <FlaskConical className="w-4 h-4" />
              <span>
                {gpuResearchActive
                  ? 'Currently Researching Fixed-Function Graphics...'
                  : 'Start Research: Fixed-Function Graphics (90 RP)'}
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const patch = (partial: Partial<GpuBlueprint>) => {
    setFeedback(null);
    onUpdateDraft({
      ...draft,
      ...partial,
      revision: draft.revision + 1,
    });
  };

  const commitDraft = (next: GpuBlueprint) => {
    setFeedback(null);
    onUpdateDraft({
      ...next,
      revision: draft.revision + 1,
    });
  };

  const handleNodeChange = (nodeId: string) => {
    commitDraft(applyGpuNodeChange(draft, nodeId));
  };

  const handleArchChange = (archId: string) => {
    commitDraft(applyGpuArchChange(draft, archId));
  };

  const handleTransistorChange = (transId: string) => {
    commitDraft(applyGpuTransistorChange(draft, transId));
  };

  const handleVramChange = (vramTechId: string) => {
    commitDraft(applyGpuVramChange(draft, vramTechId));
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

  const maxBusForVram = sliderBounds.maxBusWidthBits;

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#1F2A3D] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E8EEF7] tracking-tight">GPU Architect</h1>
          <p className="text-sm text-[#8C9BB2] mt-0.5">
            Balance shader throughput, VRAM memory bus bandwidth, ROP/TMU fill rates, and package thermals
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
            disabled={physics.exceedsReticle || physics.voltageUnstable}
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

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 7 cols: GPU Parameter Workbench */}
        <div className="xl:col-span-7 space-y-5">
          {/* Process & Rendering Architecture */}
          <section className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-4 space-y-4">
            <h2 className="text-xs font-semibold text-[#8C9BB2] tracking-wide">
              01. Process Node &amp; Rendering Pipeline
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <label className="space-y-1 block">
                <span className="text-xs text-[#8C9BB2]">GPU Designation</span>
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
                  onChange={(e) => handleNodeChange(e.target.value)}
                  className="w-full h-9 px-2.5 rounded bg-[#0B0F17] border border-[#1F2A3D] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
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
                  onChange={(e) => handleArchChange(e.target.value)}
                  className="w-full h-9 px-2.5 rounded bg-[#0B0F17] border border-[#1F2A3D] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
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
                  onChange={(e) => handleTransistorChange(e.target.value)}
                  className="w-full h-9 px-2.5 rounded bg-[#0B0F17] border border-[#1F2A3D] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
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
          </section>

          {/* Shaders, ROPs, TMUs, Clock & Voltage */}
          <section className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-4 space-y-4">
            <h2 className="text-xs font-semibold text-[#8C9BB2] tracking-wide">
              02. Shader Arrays, Raster Units &amp; Clocking
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#8C9BB2]">Shader / Compute Cores</span>
                  <span className="font-mono tabular-nums text-[#E8EEF7]">
                    {draft.shaderCores.toLocaleString()} / {currentArch.maxShaderCores.toLocaleString()}
                  </span>
                </div>
                <input
                  type="range"
                  min={sliderBounds.shaderCores.min}
                  max={sliderBounds.shaderCores.max}
                  step={sliderBounds.shaderCores.step}
                  value={clampToSlider(draft.shaderCores, sliderBounds.shaderCores)}
                  onChange={(e) => patch({ shaderCores: Number(e.target.value) })}
                  className="foundry-slider"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#8C9BB2]">GPU Core Clock</span>
                  <span className="font-mono tabular-nums text-[#22D3EE]">
                    {draft.clockGHz < 1
                      ? `${Math.round(draft.clockGHz * 1000)} MHz`
                      : `${draft.clockGHz.toFixed(2)} GHz`}
                  </span>
                </div>
                <input
                  type="range"
                  min={sliderBounds.clockGHz.min}
                  max={sliderBounds.clockGHz.max}
                  step={sliderBounds.clockGHz.step}
                  value={clampToSlider(draft.clockGHz, sliderBounds.clockGHz)}
                  onChange={(e) => patch({ clockGHz: Number(e.target.value) })}
                  className="foundry-slider"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#8C9BB2]">ROPs (Render Output Units)</span>
                  <span className="font-mono tabular-nums text-[#E8EEF7]">{draft.rops}</span>
                </div>
                <input
                  type="range"
                  min={sliderBounds.rops.min}
                  max={sliderBounds.rops.max}
                  step={sliderBounds.rops.step}
                  value={clampToSlider(draft.rops, sliderBounds.rops)}
                  onChange={(e) => patch({ rops: Number(e.target.value) })}
                  className="foundry-slider"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#8C9BB2]">TMUs (Texture Mapping Units)</span>
                  <span className="font-mono tabular-nums text-[#E8EEF7]">{draft.tmus}</span>
                </div>
                <input
                  type="range"
                  min={sliderBounds.tmus.min}
                  max={sliderBounds.tmus.max}
                  step={sliderBounds.tmus.step}
                  value={clampToSlider(draft.tmus, sliderBounds.tmus)}
                  onChange={(e) => patch({ tmus: Number(e.target.value) })}
                  className="foundry-slider"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-[#8C9BB2] truncate">
                    GPU Voltage (Vmin {physics.minStableVoltageV.toFixed(2)} V)
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
            </div>
          </section>

          {/* VRAM Subsystem, Cache & Power/Cooling */}
          <section className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-4 space-y-4">
            <h2 className="text-xs font-semibold text-[#8C9BB2] tracking-wide">
              03. VRAM Bandwidth, Caches &amp; Cooling
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="space-y-1 block">
                <span className="text-xs text-[#8C9BB2]">VRAM Memory Technology</span>
                <select
                  value={draft.vramTechId}
                  onChange={(e) => handleVramChange(e.target.value)}
                  className="w-full h-9 px-2.5 rounded bg-[#0B0F17] border border-[#1F2A3D] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
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
                  Memory Bus Width ({physics.memoryBandwidthGBs.toFixed(1)} GB/s raw)
                </span>
                <select
                  value={draft.memoryBusWidthBits}
                  onChange={(e) => patch({ memoryBusWidthBits: Number(e.target.value) })}
                  className="w-full h-9 px-2.5 rounded bg-[#0B0F17] border border-[#1F2A3D] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
                >
                  {GPU_BUS_WIDTHS.filter((b) => b <= maxBusForVram).map((bits) => (
                    <option key={bits} value={bits}>
                      {bits}-bit Bus
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#8C9BB2]">VRAM Capacity</span>
                  <span className="font-mono tabular-nums text-[#E8EEF7]">
                    {draft.vramCapacityGB < 1
                      ? `${Math.round(draft.vramCapacityGB * 1024)} MB`
                      : `${draft.vramCapacityGB} GB`}
                  </span>
                </div>
                <input
                  type="range"
                  min={sliderBounds.vramCapacityGB.min}
                  max={sliderBounds.vramCapacityGB.max}
                  step={sliderBounds.vramCapacityGB.step}
                  value={clampToSlider(draft.vramCapacityGB, sliderBounds.vramCapacityGB)}
                  onChange={(e) => patch({ vramCapacityGB: Number(e.target.value) })}
                  className="foundry-slider"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#8C9BB2]">Shader L1 Cache</span>
                  <span className="font-mono tabular-nums text-[#E8EEF7]">
                    {draft.l1CacheMB < 1
                      ? `${Math.round(draft.l1CacheMB * 1024)} KB`
                      : `${draft.l1CacheMB.toFixed(1)} MB`}
                  </span>
                </div>
                <input
                  type="range"
                  min={sliderBounds.l1CacheMB.min}
                  max={sliderBounds.l1CacheMB.max}
                  step={sliderBounds.l1CacheMB.step}
                  value={clampToSlider(draft.l1CacheMB, sliderBounds.l1CacheMB)}
                  onChange={(e) => patch({ l1CacheMB: Number(e.target.value) })}
                  className="foundry-slider"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#8C9BB2]">Unified L2 Cache</span>
                  <span className="font-mono tabular-nums text-[#E8EEF7]">
                    {draft.l2CacheMB < 1 ? `${Math.round(draft.l2CacheMB * 1024)} KB` : `${draft.l2CacheMB} MB`}
                  </span>
                </div>
                <input
                  type="range"
                  min={sliderBounds.l2CacheMB.min}
                  max={sliderBounds.l2CacheMB.max}
                  step={sliderBounds.l2CacheMB.step}
                  value={clampToSlider(draft.l2CacheMB, sliderBounds.l2CacheMB)}
                  onChange={(e) => patch({ l2CacheMB: Number(e.target.value) })}
                  className="foundry-slider"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#8C9BB2]">Board Power Limit</span>
                  <span className="font-mono tabular-nums text-[#D97706]">{draft.powerLimitW} W</span>
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
                      {c.name} ({c.thermalResistanceCPerW} °C/W)
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        </div>

        {/* Right 5 cols: Live GPU Floorplan + Roofline Telemetry */}
        <div className="xl:col-span-5 space-y-5 xl:sticky xl:top-6">
          <DieFloorplanSVG
            title={draft.name || 'Unnamed GPU'}
            nodeLabel={currentNode.name}
            physics={physics}
            thermalOverlay={thermalOverlay}
            onToggleThermal={onToggleThermal}
          />

          <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[#8C9BB2] tracking-wide flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#06B6D4]" />
                <span>GPU Roofline &amp; Thermal Telemetry</span>
              </h3>
              <span className="text-xs font-mono tabular-nums text-[#E8EEF7]">
                Score {benchmarks.overallRating.toLocaleString()}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
              <div className="flex justify-between border-b border-[#1F2A3D] pb-1.5">
                <span className="text-[#8C9BB2]">Transistors</span>
                <span className="font-mono tabular-nums text-[#E8EEF7]">
                  {physics.transistorCountMTr >= 1000
                    ? `${(physics.transistorCountMTr / 1000).toFixed(2)} B`
                    : `${physics.transistorCountMTr.toFixed(2)} M`}
                </span>
              </div>
              <div className="flex justify-between border-b border-[#1F2A3D] pb-1.5">
                <span className="text-[#8C9BB2]">Memory Bandwidth</span>
                <span className="font-mono tabular-nums text-[#22D3EE]">
                  {physics.memoryBandwidthGBs.toFixed(1)} GB/s
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
                <span className="text-[#8C9BB2]">Estimated yield (best fab)</span>
                <span
                  className={`font-mono tabular-nums ${
                    physics.yieldPercent < 45 ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {physics.yieldPercent.toFixed(1)}% ({physics.goodDiesPerWafer.toFixed(0)}/wfr)
                </span>
              </div>
              <div className="flex justify-between border-b border-[#1F2A3D] pb-1.5">
                <span className="text-[#8C9BB2]">Render / Compute</span>
                <span className="font-mono tabular-nums text-[#E8EEF7]">
                  {benchmarks.gamingRendering} / {benchmarks.gpuCompute}
                </span>
              </div>
            </div>

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
                    {b.severity === 'critical' ? 'Critical: ' : b.severity === 'warning' ? 'Bottleneck: ' : ''}
                    {b.title}
                  </div>
                  <p className="text-[11px] opacity-90">{b.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
