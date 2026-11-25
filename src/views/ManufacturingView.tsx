import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Copy,
  Factory,
  Gauge,
  Layers,
  Scale,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { MeterBar } from '../components/ui/MeterBar';
import { StatusBadge } from '../components/ui/StatusBadge';
import {
  getBestLithography,
  getMaxWaferDiameterMm,
  getProcessNode,
  MEMORY_CATEGORY_META,
  PROCESS_NODES,
} from '../engine/catalog';
import {
  formatCompactNumber,
  getEffectiveFabCapacity,
} from '../engine/simulation';
import type { ChipBlueprint, GameState, MainSection } from '../engine/types';
import { formatMemoryCapacity } from './MemoryArchitectView';

interface ManufacturingViewProps {
  state: GameState;
  onUpdateLine: (
    lineId: string,
    updates: { chipId?: string | null; targetWaferStartsPerMonth?: number; qaStrictness?: number }
  ) => void;
  onBatchScaleLines?: (mode: 'max' | 'balance') => void;
  onSetQaBudget: (level: number) => void;
  onNavigate: (section: MainSection) => void;
  onInspectChip?: (chipId: string) => void;
  onCloneChip?: (chip: ChipBlueprint) => void;
}

export const ManufacturingView: React.FC<ManufacturingViewProps> = ({
  state,
  onUpdateLine,
  onBatchScaleLines,
  onSetQaBudget,
  onNavigate,
  onInspectChip,
  onCloneChip,
}) => {
  const [maturationFilter, setMaturationFilter] = useState<'all' | 'active'>('all');
  const litho = getBestLithography(state.unlockedTechIds);
  const waferDia = getMaxWaferDiameterMm(state.unlockedTechIds);
  const productionChips = state.chips.filter((c) => c.status === 'production');
  const fabMap = new Map(state.facilities.filter((f) => f.kind === 'fab').map((f) => [f.id, f]));

  const activeNodeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const line of state.productionLines) {
      if (!line.chipId) continue;
      const chip = state.chips.find((c) => c.id === line.chipId);
      if (chip) ids.add(chip.processNodeId);
    }
    return ids;
  }, [state.productionLines, state.chips]);

  const unlockedNodes = useMemo(
    () =>
      PROCESS_NODES.filter(
        (n) => !n.requiredTechId || state.unlockedTechIds.includes(n.requiredTechId)
      ),
    [state.unlockedTechIds]
  );

  const displayedNodes = useMemo(
    () =>
      maturationFilter === 'active'
        ? unlockedNodes.filter((n) => activeNodeIds.has(n.id) || (state.nodeMaturationXp[n.id] ?? 0) > 0)
        : unlockedNodes,
    [unlockedNodes, maturationFilter, activeNodeIds, state.nodeMaturationXp]
  );

  const hasAssignedLines = state.productionLines.some((l) => l.chipId !== null);
  const siPct =
    (state.telemetry.monthlySiliconConsumed / Math.max(1, state.telemetry.monthlySiliconProd)) * 100;
  const powerPct = (state.telemetry.powerUsedMW / Math.max(1, state.telemetry.powerCapacityMW)) * 100;
  const pkgPct =
    (state.telemetry.packagingUsedPerMonth / Math.max(1, state.telemetry.packagingCapacityPerMonth)) *
    100;

  return (
    <div className="p-5 lg:p-6 max-w-[1480px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#1E293B] pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#E8EEF7] tracking-tight">
              Manufacturing &amp; Fabs
            </h1>
            <StatusBadge
              tone={
                state.telemetry.powerDeficit
                  ? 'critical'
                  : state.telemetry.siliconStarved || state.telemetry.packagingStarved
                    ? 'warning'
                    : 'nominal'
              }
              label={
                state.telemetry.powerDeficit
                  ? 'Grid Throttled'
                  : state.telemetry.siliconStarved
                    ? 'Silicon Limited'
                    : state.telemetry.packagingStarved
                      ? 'OSAT Limited'
                      : 'Lines Nominal'
              }
            />
          </div>
          <p className="text-xs text-[#8C9BB2] mt-1 font-mono tabular-nums">
            {litho.name} · {waferDia} mm Wafers · Pure physical resource manufacturing (zero monetary wafer fees)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onBatchScaleLines && hasAssignedLines && (
            <>
              <button
                type="button"
                onClick={() => onBatchScaleLines('balance')}
                title="Scale all active fab lines to maximum sustainable throughput without starving Si, Power, or OSAT"
                className="h-9 px-3 rounded-md bg-[#101521] hover:bg-[#161D2D] text-[#E8EEF7] border border-[#2C3B55] text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Scale className="w-3.5 h-3.5 text-emerald-400" />
                <span>Balance to Resources</span>
              </button>
              <button
                type="button"
                onClick={() => onBatchScaleLines('max')}
                title="Set all assigned fab lines to 100% effective wafer capacity"
                className="h-9 px-3 rounded-md bg-[#101521] hover:bg-[#161D2D] text-[#E8EEF7] border border-[#2C3B55] text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-[#06B6D4]" />
                <span>Max All Active</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => onNavigate('infrastructure')}
            className="h-9 px-3.5 rounded-md bg-[#06B6D4] hover:bg-[#22D3EE] text-[#06080D] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Expand Fabs &amp; Utilities</span>
          </button>
        </div>
      </div>

      {/* Physical Resource Balance Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-[#101521] border border-[#1E293B] rounded-lg p-4 space-y-2">
          <div className="text-xs text-[#8C9BB2]">Silicon Feedstock Flow</div>
          <div
            className={`text-xl font-mono tabular-nums font-bold ${
              state.telemetry.siliconStarved ? 'text-amber-400' : 'text-[#E8EEF7]'
            }`}
          >
            {formatCompactNumber(state.telemetry.monthlySiliconConsumed, 0)} /{' '}
            {formatCompactNumber(state.telemetry.monthlySiliconProd, 0)}
            <span className="text-xs font-normal text-[#8C9BB2] ml-1">Si/mo</span>
          </div>
          <MeterBar
            value={siPct}
            max={100}
            tone={state.telemetry.siliconStarved ? 'amber' : 'emerald'}
            height="sm"
          />
          <div className="text-[11px] text-[#8C9BB2] font-mono tabular-nums">
            Reserve: {formatCompactNumber(state.silicon, 0)} Si
          </div>
        </div>

        <div className="bg-[#101521] border border-[#1E293B] rounded-lg p-4 space-y-2">
          <div className="text-xs text-[#8C9BB2]">Grid Electrical Load</div>
          <div
            className={`text-xl font-mono tabular-nums font-bold ${
              state.telemetry.powerDeficit ? 'text-rose-400' : 'text-[#E8EEF7]'
            }`}
          >
            {state.telemetry.powerUsedMW.toFixed(1)} / {state.telemetry.powerCapacityMW.toFixed(0)}
            <span className="text-xs font-normal text-[#8C9BB2] ml-1">MW</span>
          </div>
          <MeterBar
            value={powerPct}
            max={100}
            tone={state.telemetry.powerDeficit ? 'rose' : powerPct > 85 ? 'amber' : 'cyan'}
            height="sm"
          />
          <div className="text-[11px] text-[#8C9BB2] font-mono tabular-nums">
            Litho Power Factor {litho.powerOverheadMultiplier.toFixed(2)}×
          </div>
        </div>

        <div className="bg-[#101521] border border-[#1E293B] rounded-lg p-4 space-y-2">
          <div className="text-xs text-[#8C9BB2]">OSAT Packaging Load</div>
          <div
            className={`text-xl font-mono tabular-nums font-bold ${
              state.telemetry.packagingStarved ? 'text-amber-400' : 'text-[#E8EEF7]'
            }`}
          >
            {formatCompactNumber(state.telemetry.packagingUsedPerMonth, 0)} /{' '}
            {formatCompactNumber(state.telemetry.packagingCapacityPerMonth, 0)}
            <span className="text-xs font-normal text-[#8C9BB2] ml-1">pkg/mo</span>
          </div>
          <MeterBar
            value={pkgPct}
            max={100}
            tone={state.telemetry.packagingStarved ? 'amber' : 'teal'}
            height="sm"
          />
          <div className="text-[11px] text-[#8C9BB2] font-mono tabular-nums">
            {(() => {
              const memTB = state.telemetry.monthlyMemoryCapacityTB ?? 0;
              if (memTB <= 0) return '2.5D/3D & TSV stacking multiplies OSAT load';
              if (memTB >= 100) return `Memory shipped: ${formatCompactNumber(memTB, 1)} TB/mo`;
              if (memTB >= 1) return `Memory shipped: ${memTB.toFixed(2)} TB/mo`;
              return `Memory shipped: ${(memTB * 1024).toFixed(1)} GB/mo`;
            })()}
          </div>
        </div>

        <div className="bg-[#101521] border border-[#1E293B] rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#8C9BB2] flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#06B6D4]" />
              Global QA Tier
            </span>
            <span className="font-mono tabular-nums text-[#E8EEF7]">
              Level {state.qaBudgetLevel} / 5
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={5}
            value={state.qaBudgetLevel}
            onChange={(e) => onSetQaBudget(Number(e.target.value))}
            className="foundry-slider"
          />
          <div className="text-[11px] text-[#8C9BB2]">
            Improves die screening &amp; yield (+{(state.qaBudgetLevel - 1) * 140} CR/mo ops)
          </div>
        </div>
      </div>

      {/* Resource Bottleneck Alert Banner */}
      {(state.telemetry.powerDeficit ||
        state.telemetry.siliconStarved ||
        state.telemetry.packagingStarved) && (
        <div className="p-3.5 rounded-md bg-amber-950/35 border border-amber-500/40 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              Fab output is currently throttled by a physical ceiling (
              {state.telemetry.powerDeficit
                ? 'Grid Power MW'
                : state.telemetry.siliconStarved
                  ? 'Refined Silicon Si'
                  : 'OSAT Packaging Capacity'}
              ). Expand utilities in Infrastructure or use Balance to Resources.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('infrastructure')}
            className="px-3 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 whitespace-nowrap cursor-pointer"
          >
            Go to Infrastructure
          </button>
        </div>
      )}

      {/* Active Fab Production Lines */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#E8EEF7]">
            Wafer Fabrication Lines ({state.productionLines.length})
          </h2>
          <span className="text-[11px] text-[#64748B] font-mono tabular-nums">
            Effective capacity includes Fabrication staff &amp; R&amp;D throughput multipliers
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {state.productionLines.map((line) => {
            const fab = fabMap.get(line.fabId);
            if (!fab) return null;
            const effectiveMaxWafers = getEffectiveFabCapacity(state, fab);
            const assignedChip = state.chips.find((c) => c.id === line.chipId);

            const statusTone: 'nominal' | 'muted' | 'warning' =
              line.statusNote === 'Nominal'
                ? 'nominal'
                : line.statusNote === 'Unassigned'
                  ? 'muted'
                  : 'warning';

            return (
              <div
                key={line.id}
                className="bg-[#101521] border border-[#1E293B] rounded-lg p-4 space-y-4"
              >
                <div className="flex items-start justify-between gap-3 border-b border-[#1E293B] pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[#E8EEF7] flex items-center gap-2">
                      <Factory className="w-4 h-4 text-[#06B6D4]" />
                      <span>{fab.name}</span>
                    </h3>
                    <div className="text-xs text-[#8C9BB2] font-mono tabular-nums mt-0.5">
                      Level {fab.level} · ISO-{6 - (fab.cleanroomGrade ?? 1)} Cleanroom · Eff. Cap{' '}
                      {effectiveMaxWafers.toLocaleString()} wfr/mo
                    </div>
                  </div>
                  <StatusBadge tone={statusTone} label={line.statusNote} />
                </div>

                {/* Chip Assignment */}
                <label className="space-y-1 block">
                  <span className="text-xs text-[#8C9BB2]">Assigned Silicon Design</span>
                  <select
                    value={line.chipId ?? ''}
                    onChange={(e) =>
                      onUpdateLine(line.id, { chipId: e.target.value || null })
                    }
                    className="foundry-select w-full h-9 px-2.5 rounded bg-[#0A0E16] border border-[#1E293B] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
                  >
                    <option value="">— Idle (No Product Assigned) —</option>
                    {productionChips.map((chip) => {
                      const n = getProcessNode(chip.processNodeId);
                      const label =
                        chip.kind === 'memory'
                          ? `[${MEMORY_CATEGORY_META[chip.memoryCategory].shortLabel}] ${chip.name} (${formatMemoryCapacity(chip.capacityGB)}) · ${n.name}`
                          : `[${chip.kind.toUpperCase()}] ${chip.name} · ${n.name}`;
                      return (
                        <option key={chip.id} value={chip.id}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </label>

                {/* Wafer Volume & QA Strictness */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#8C9BB2]">Target Wafer Starts</span>
                      <span className="font-mono tabular-nums text-[#E8EEF7]">
                        {Math.round(line.targetWaferStartsPerMonth).toLocaleString()} /{' '}
                        {effectiveMaxWafers.toLocaleString()}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={effectiveMaxWafers}
                      step={5}
                      value={Math.min(effectiveMaxWafers, line.targetWaferStartsPerMonth)}
                      onChange={(e) =>
                        onUpdateLine(line.id, {
                          targetWaferStartsPerMonth: Number(e.target.value),
                        })
                      }
                      className="foundry-slider"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#8C9BB2]">QA Inspection Strictness</span>
                      <span className="font-mono tabular-nums text-[#E8EEF7]">
                        {line.qaStrictness.toFixed(2)}×
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.6}
                      max={1.4}
                      step={0.05}
                      value={line.qaStrictness}
                      onChange={(e) =>
                        onUpdateLine(line.id, { qaStrictness: Number(e.target.value) })
                      }
                      className="foundry-slider"
                    />
                  </div>
                </div>

                {/* Live Yield Bar & Output Metrics */}
                {assignedChip && (
                  <MeterBar
                    label="Wafer Yield"
                    value={line.yieldPercent}
                    max={100}
                    valueLabel={`${line.yieldPercent.toFixed(1)}% · Actual ${line.actualWaferStartsPerMonth.toFixed(0)} wfr/mo`}
                    tone={
                      line.yieldPercent < 35
                        ? 'rose'
                        : line.yieldPercent < 60
                          ? 'amber'
                          : 'emerald'
                    }
                    height="sm"
                  />
                )}

                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-[#1E293B] text-xs">
                  <div>
                    <div className="text-[#64748B]">Yield</div>
                    <div className="font-mono tabular-nums font-semibold text-emerald-400">
                      {line.yieldPercent.toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[#64748B]">Good Dies/mo</div>
                    <div className="font-mono tabular-nums font-semibold text-[#22D3EE]">
                      {formatCompactNumber(line.goodDiesPerMonth, 1)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#64748B]">Silicon/mo</div>
                    <div className="font-mono tabular-nums text-[#E8EEF7]">
                      {formatCompactNumber(line.siliconConsumedPerMonth, 0)} Si
                    </div>
                  </div>
                  <div>
                    <div className="text-[#64748B]">Power Draw</div>
                    <div className="font-mono tabular-nums text-[#E8EEF7]">
                      {line.powerDrawMW.toFixed(1)} MW
                    </div>
                  </div>
                </div>

                {assignedChip && (
                  <div className="pt-2 border-t border-[#1E293B] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-[#8C9BB2]">
                    <span>
                      Node: {getProcessNode(assignedChip.processNodeId).name}
                      {assignedChip.kind === 'memory' && (
                        <span className="text-[#14B8A6] ml-2">
                          ·{' '}
                          {line.goodDiesPerMonth * assignedChip.capacityGB >= 1024
                            ? `${((line.goodDiesPerMonth * assignedChip.capacityGB) / 1024).toFixed(2)} TB/mo`
                            : `${(line.goodDiesPerMonth * assignedChip.capacityGB).toFixed(1)} GB/mo`}{' '}
                          ({assignedChip.stackLayers}L)
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-1.5 font-sans">
                      {onInspectChip && (
                        <button
                          type="button"
                          onClick={() => onInspectChip(assignedChip.id)}
                          className="h-6 px-2 rounded bg-[#0A0E16] hover:bg-[#161D2D] border border-[#1E293B] text-[11px] text-[#CBD5E1] flex items-center gap-1 cursor-pointer"
                        >
                          <Gauge className="w-3 h-3 text-[#06B6D4]" />
                          <span>Test</span>
                        </button>
                      )}
                      {onCloneChip && (
                        <button
                          type="button"
                          onClick={() => onCloneChip(assignedChip)}
                          className="h-6 px-2 rounded bg-[#0A0E16] hover:bg-[#161D2D] border border-[#1E293B] text-[11px] text-[#CBD5E1] flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3 text-[#D97706]" />
                          <span>Revise</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Process Node Maturation Matrix */}
      <div className="bg-[#101521] border border-[#1E293B] rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#E8EEF7]">
              Process Node Maturation &amp; Defect Learning Curves
            </h2>
            <p className="text-xs text-[#8C9BB2] mt-0.5">
              Running wafers accumulates node experience, cutting baseline defect density D0 by up to 55%
            </p>
          </div>
          <div className="flex items-center bg-[#0A0E16] border border-[#1E293B] rounded p-0.5">
            <button
              type="button"
              onClick={() => setMaturationFilter('all')}
              className={`px-2.5 py-1 text-[11px] rounded cursor-pointer whitespace-nowrap ${
                maturationFilter === 'all'
                  ? 'bg-[#161D2D] text-[#E8EEF7]'
                  : 'text-[#8C9BB2] hover:text-[#E8EEF7]'
              }`}
            >
              All Unlocked ({unlockedNodes.length})
            </button>
            <button
              type="button"
              onClick={() => setMaturationFilter('active')}
              className={`px-2.5 py-1 text-[11px] rounded cursor-pointer whitespace-nowrap ${
                maturationFilter === 'active'
                  ? 'bg-[#161D2D] text-[#E8EEF7]'
                  : 'text-[#8C9BB2] hover:text-[#E8EEF7]'
              }`}
            >
              Active / Trained
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {displayedNodes.map((node) => {
            const xp = state.nodeMaturationXp[node.id] ?? 0;
            const pct = Math.min(100, (xp / 60) * 100);
            const matMult = 0.45 + 0.55 * Math.exp(-0.08 * xp);
            const isRunning = activeNodeIds.has(node.id);
            return (
              <div
                key={node.id}
                className={`p-3 rounded-md bg-[#0A0E16] border space-y-1.5 ${
                  isRunning ? 'border-[#06B6D4]/50' : 'border-[#1E293B]'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#E8EEF7]">{node.name}</span>
                  <span className="font-mono tabular-nums text-[#22D3EE]">
                    D0 ×{matMult.toFixed(2)}
                  </span>
                </div>
                <MeterBar value={pct} max={100} tone={pct >= 99 ? 'emerald' : 'cyan'} height="sm" />
                <div className="flex justify-between text-[11px] font-mono tabular-nums text-[#64748B]">
                  <span>
                    {pct.toFixed(0)}% mature{isRunning ? ' · Running' : ''}
                  </span>
                  <span>
                    {node.siliconPerWafer} Si/wfr · {node.powerMWPer100Wafers} MW/100w
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
