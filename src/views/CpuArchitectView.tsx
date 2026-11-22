import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Gauge, Layers, Play } from 'lucide-react';
import { DieFloorplanSVG } from '../components/DieFloorplanSVG';
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
} from '../engine/physics';
import { buildPreviewPhysicsContext, formatCompactNumber } from '../engine/simulation';
import type { CpuBlueprint, GameState } from '../engine/types';

interface CpuArchitectViewProps {
  state: GameState;
  thermalOverlay: boolean;
  onToggleThermal: () => void;
  onUpdateDraft: (next: CpuBlueprint) => void;
  onStartTapeOut: (draft: CpuBlueprint) => { error?: string };
  onTestPrototype: () => void;
}

export const CpuArchitectView: React.FC<CpuArchitectViewProps> = ({
  state,
  thermalOverlay,
  onToggleThermal,
  onUpdateDraft,
  onStartTapeOut,
  onTestPrototype,
}) => {
  const [feedback, setFeedback] = useState<{ type: 'error' | 'ok'; msg: string } | null>(null);
  const draft = state.cpuDraft;
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

  const { physics, benchmarks } = evaluation;

  const patch = (partial: Partial<CpuBlueprint>) => {
    setFeedback(null);
    onUpdateDraft({
      ...draft,
      ...partial,
      revision: draft.revision + 1,
    });
  };

  const commitDraft = (next: CpuBlueprint) => {
    setFeedback(null);
    onUpdateDraft({
      ...next,
      revision: draft.revision + 1,
    });
  };

  const handleNodeChange = (nodeId: string) => {
    commitDraft(applyCpuNodeChange(draft, nodeId));
  };

  const handleArchChange = (archId: string) => {
    commitDraft(applyCpuArchChange(draft, archId));
  };

  const handleTransistorChange = (transId: string) => {
    commitDraft(applyCpuTransistorChange(draft, transId));
  };

  const toggleIsa = (isaId: string) => {
    if (isaId === 'isa_int') return; // Base integer ISA always present
    const exists = draft.isaExtensions.includes(isaId);
    patch({
      isaExtensions: exists
        ? draft.isaExtensions.filter((x) => x !== isaId)
        : [...draft.isaExtensions, isaId],
    });
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

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#1F2A3D] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E8EEF7] tracking-tight">CPU Architect</h1>
          <p className="text-sm text-[#8C9BB2] mt-0.5">
            Configure silicon geometry, voltage-frequency targets, caches, and interconnects with real-time physics feedback
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

      {/* Asymmetric Split Console */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 7 cols: Engineering Workbench */}
        <div className="xl:col-span-7 space-y-5">
          {/* Identity & Fabrication Stack */}
          <section className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-4 space-y-4">
            <h2 className="text-xs font-semibold text-[#8C9BB2] tracking-wide">
              01. Silicon Process &amp; Architecture
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <label className="space-y-1 block">
                <span className="text-xs text-[#8C9BB2]">Processor Designation</span>
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
                <span className="text-xs text-[#8C9BB2]">CPU Microarchitecture</span>
                <select
                  value={draft.architectureId}
                  onChange={(e) => handleArchChange(e.target.value)}
                  className="w-full h-9 px-2.5 rounded bg-[#0B0F17] border border-[#1F2A3D] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
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
                  onChange={(e) => handleTransistorChange(e.target.value)}
                  className="w-full h-9 px-2.5 rounded bg-[#0B0F17] border border-[#1F2A3D] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
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
                  className="w-full h-9 px-2.5 rounded bg-[#0B0F17] border border-[#1F2A3D] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
                >
                  {unlockedPackaging.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (max {p.maxDieAreaMm2} mm² · {p.interconnectBonus}× scaling)
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          {/* Cores, Clocks, Voltage & IPC */}
          <section className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-4 space-y-4">
            <h2 className="text-xs font-semibold text-[#8C9BB2] tracking-wide">
              02. Core Topology, Clocks &amp; Voltage
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#8C9BB2]">Performance Cores (P-Cores)</span>
                  <span className="font-mono tabular-nums text-[#E8EEF7]">
                    {draft.pCores} / {currentArch.maxPCores}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={currentArch.maxPCores}
                  value={draft.pCores}
                  onChange={(e) => patch({ pCores: Number(e.target.value) })}
                  className="foundry-slider"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#8C9BB2]">Efficiency Cores (E-Cores)</span>
                  <span className="font-mono tabular-nums text-[#E8EEF7]">
                    {currentArch.supportsECores
                      ? `${draft.eCores} / ${currentArch.maxECores}`
                      : 'Requires Superscalar+'}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, currentArch.maxECores)}
                  disabled={!currentArch.supportsECores}
                  value={draft.eCores}
                  onChange={(e) => patch({ eCores: Number(e.target.value) })}
                  className="foundry-slider"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#8C9BB2]">Target P-Core Clock</span>
                  <span className="font-mono tabular-nums text-[#22D3EE]">
                    {draft.pClockGHz < 1
                      ? `${Math.round(draft.pClockGHz * 1000)} MHz`
                      : `${draft.pClockGHz.toFixed(2)} GHz`}
                  </span>
                </div>
                <input
                  type="range"
                  min={sliderBounds.pClockGHz.min}
                  max={sliderBounds.pClockGHz.max}
                  step={sliderBounds.pClockGHz.step}
                  value={clampToSlider(draft.pClockGHz, sliderBounds.pClockGHz)}
                  onChange={(e) => {
                    const nextP = Number(e.target.value);
                    patch({
                      pClockGHz: nextP,
                      eClockGHz: Math.min(draft.eClockGHz, nextP),
                    });
                  }}
                  className="foundry-slider"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#8C9BB2]">
                    Core Voltage (Vmin {physics.minStableVoltageV.toFixed(2)} V)
                  </span>
                  <span
                    className={`font-mono tabular-nums ${
                      physics.voltageUnstable ? 'text-rose-400 font-semibold' : 'text-[#E8EEF7]'
                    }`}
                  >
                    {draft.voltageV.toFixed(2)} V
                  </span>
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
                  <span className="text-[#8C9BB2]">Microarchitecture IPC Tuning</span>
                  <span className="font-mono tabular-nums text-[#E8EEF7]">
                    {(physics.effectiveIpc ?? currentArch.baseIpc * draft.ipcTuning).toFixed(2)} IPC ({draft.ipcTuning.toFixed(2)}×)
                  </span>
                </div>
                <input
                  type="range"
                  min={sliderBounds.ipcTuning.min}
                  max={sliderBounds.ipcTuning.max}
                  step={sliderBounds.ipcTuning.step}
                  value={clampToSlider(draft.ipcTuning, sliderBounds.ipcTuning)}
                  onChange={(e) => patch({ ipcTuning: Number(e.target.value) })}
                  className="foundry-slider"
                />
              </div>

              {currentArch.supportsECores && draft.eCores > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#8C9BB2]">Target E-Core Clock</span>
                    <span className="font-mono tabular-nums text-[#E8EEF7]">
                      {draft.eClockGHz < 1
                        ? `${Math.round(draft.eClockGHz * 1000)} MHz`
                        : `${draft.eClockGHz.toFixed(2)} GHz`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={sliderBounds.eClockGHz.min}
                    max={sliderBounds.eClockGHz.max}
                    step={sliderBounds.eClockGHz.step}
                    value={clampToSlider(draft.eClockGHz, sliderBounds.eClockGHz)}
                    onChange={(e) => patch({ eClockGHz: Number(e.target.value) })}
                    className="foundry-slider"
                  />
                </div>
              )}
            </div>
          </section>

          {/* Cache Hierarchy & ISA */}
          <section className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-4 space-y-4">
            <h2 className="text-xs font-semibold text-[#8C9BB2] tracking-wide">
              03. Cache Hierarchy &amp; Instruction Set Extensions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#8C9BB2]">L1 / Core</span>
                  <span className="font-mono tabular-nums text-[#E8EEF7]">
                    {draft.l1CacheKBPerCore} KB
                  </span>
                </div>
                <input
                  type="range"
                  min={sliderBounds.l1CacheKBPerCore.min}
                  max={sliderBounds.l1CacheKBPerCore.max}
                  step={sliderBounds.l1CacheKBPerCore.step}
                  value={clampToSlider(draft.l1CacheKBPerCore, sliderBounds.l1CacheKBPerCore)}
                  onChange={(e) => patch({ l1CacheKBPerCore: Number(e.target.value) })}
                  className="foundry-slider"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#8C9BB2]">L2 Total</span>
                  <span className="font-mono tabular-nums text-[#E8EEF7]">
                    {draft.l2CacheMBTotal === 0
                      ? 'None'
                      : draft.l2CacheMBTotal < 1
                        ? `${Math.round(draft.l2CacheMBTotal * 1024)} KB`
                        : `${draft.l2CacheMBTotal.toFixed(1)} MB`}
                  </span>
                </div>
                <input
                  type="range"
                  min={sliderBounds.l2CacheMBTotal.min}
                  max={sliderBounds.l2CacheMBTotal.max}
                  step={sliderBounds.l2CacheMBTotal.step}
                  value={clampToSlider(draft.l2CacheMBTotal, sliderBounds.l2CacheMBTotal)}
                  onChange={(e) => patch({ l2CacheMBTotal: Number(e.target.value) })}
                  className="foundry-slider"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#8C9BB2]">L3 Shared</span>
                  <span className="font-mono tabular-nums text-[#E8EEF7]">
                    {draft.l3CacheMBTotal === 0 ? 'None' : `${draft.l3CacheMBTotal} MB`}
                  </span>
                </div>
                <input
                  type="range"
                  min={sliderBounds.l3CacheMBTotal.min}
                  max={sliderBounds.l3CacheMBTotal.max}
                  step={sliderBounds.l3CacheMBTotal.step}
                  value={clampToSlider(draft.l3CacheMBTotal, sliderBounds.l3CacheMBTotal)}
                  onChange={(e) => patch({ l3CacheMBTotal: Number(e.target.value) })}
                  className="foundry-slider"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-[#1F2A3D] space-y-2">
              <div className="text-xs text-[#8C9BB2]">Enabled Instruction Sets &amp; SIMD</div>
              <div className="flex flex-wrap gap-2">
                {unlockedIsa.map((ext) => {
                  const active = draft.isaExtensions.includes(ext.id);
                  return (
                    <button
                      key={ext.id}
                      type="button"
                      onClick={() => toggleIsa(ext.id)}
                      className={`h-8 px-3 rounded text-xs font-mono border transition-colors whitespace-nowrap cursor-pointer ${
                        active
                          ? 'bg-[#06B6D4]/20 border-[#06B6D4]/50 text-[#22D3EE]'
                          : 'bg-[#0B0F17] border-[#1F2A3D] text-[#8C9BB2] hover:text-[#E8EEF7]'
                      }`}
                    >
                      {ext.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Memory, I/O, SoC Accelerators & Thermal Envelope */}
          <section className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-4 space-y-4">
            <h2 className="text-xs font-semibold text-[#8C9BB2] tracking-wide">
              04. Memory, I/O, Accelerators &amp; Thermal Envelope
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="space-y-1 block">
                <span className="text-xs text-[#8C9BB2]">Supported RAM Technology</span>
                <select
                  value={draft.memoryTechId}
                  onChange={(e) => patch({ memoryTechId: e.target.value })}
                  className="w-full h-9 px-2.5 rounded bg-[#0B0F17] border border-[#1F2A3D] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
                >
                  {unlockedRam.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.gbpsPerUnit} GB/s per ch)
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#8C9BB2]">Memory Channels ({physics.memoryBandwidthGBs.toFixed(1)} GB/s)</span>
                  <span className="font-mono tabular-nums text-[#E8EEF7]">{draft.memoryChannels} ch</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={16}
                  value={draft.memoryChannels}
                  onChange={(e) => patch({ memoryChannels: Number(e.target.value) })}
                  className="foundry-slider"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#8C9BB2]">
                    PCIe Lanes (Gen {maxPcieGen} · {(physics.pcieBandwidthGBs ?? 0).toFixed(1)} GB/s)
                  </span>
                  <span className="font-mono tabular-nums text-[#E8EEF7]">{draft.pcieLanes} lanes</span>
                </div>
                <input
                  type="range"
                  min={sliderBounds.pcieLanes.min}
                  max={sliderBounds.pcieLanes.max}
                  step={sliderBounds.pcieLanes.step}
                  value={clampToSlider(draft.pcieLanes, sliderBounds.pcieLanes)}
                  onChange={(e) => patch({ pcieLanes: Number(e.target.value) })}
                  className="foundry-slider"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#8C9BB2]">Package Power Limit (TDP)</span>
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

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#8C9BB2]">Integrated GPU Tier</span>
                  <span className="font-mono tabular-nums text-[#E8EEF7]">
                    {socUnlocked ? (draft.igpuTier === 0 ? 'Disabled' : `Tier ${draft.igpuTier}`) : 'Research SoC Tech'}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={5}
                  disabled={!socUnlocked}
                  value={draft.igpuTier}
                  onChange={(e) => patch({ igpuTier: Number(e.target.value) })}
                  className="foundry-slider"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#8C9BB2]">Neural Engine (NPU) Tier</span>
                  <span className="font-mono tabular-nums text-[#E8EEF7]">
                    {socUnlocked ? (draft.npuTier === 0 ? 'Disabled' : `Tier ${draft.npuTier}`) : 'Research SoC Tech'}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={5}
                  disabled={!socUnlocked}
                  value={draft.npuTier}
                  onChange={(e) => patch({ npuTier: Number(e.target.value) })}
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

        {/* Right 5 cols: Live 2D SVG Die Floorplan + Physics & Bottleneck Telemetry */}
        <div className="xl:col-span-5 space-y-5 xl:sticky xl:top-6">
          <DieFloorplanSVG
            title={draft.name || 'Unnamed CPU'}
            nodeLabel={currentNode.name}
            physics={physics}
            thermalOverlay={thermalOverlay}
            onToggleThermal={onToggleThermal}
          />

          {/* Live Physical Telemetry Readout */}
          <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[#8C9BB2] tracking-wide flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#06B6D4]" />
                <span>Real-Time Silicon Telemetry</span>
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
                <span className="text-[#8C9BB2]">Sustained Clock</span>
                <span className="font-mono tabular-nums text-[#22D3EE]">
                  {physics.sustainedClockGHz < 1
                    ? `${Math.round(physics.sustainedClockGHz * 1000)} MHz`
                    : `${physics.sustainedClockGHz.toFixed(2)} GHz`}
                </span>
              </div>
              <div className="flex justify-between border-b border-[#1F2A3D] pb-1.5">
                <span className="text-[#8C9BB2]">Effective Power</span>
                <span className="font-mono tabular-nums text-[#E8EEF7]">
                  {physics.effectivePowerW.toFixed(1)} W
                  {physics.carnotOverheadW > 0 ? ` (+${physics.carnotOverheadW.toFixed(0)}W cryo)` : ''}
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
                <span className="text-[#8C9BB2]">Single / Multi</span>
                <span className="font-mono tabular-nums text-[#E8EEF7]">
                  {benchmarks.singleCoreCpu} / {benchmarks.multiCoreCpu}
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
