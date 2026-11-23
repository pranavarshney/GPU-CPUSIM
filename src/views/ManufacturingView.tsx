import React from 'react';
import { AlertTriangle, Factory, Layers, ShieldCheck } from 'lucide-react';
import {
  getBestLithography,
  getMaxWaferDiameterMm,
  getProcessNode,
  MEMORY_CATEGORY_META,
  PROCESS_NODES,
} from '../engine/catalog';
import { formatCompactNumber } from '../engine/simulation';
import type { GameState, MainSection } from '../engine/types';
import { formatMemoryCapacity } from './MemoryArchitectView';

interface ManufacturingViewProps {
  state: GameState;
  onUpdateLine: (
    lineId: string,
    updates: { chipId?: string | null; targetWaferStartsPerMonth?: number; qaStrictness?: number }
  ) => void;
  onSetQaBudget: (level: number) => void;
  onNavigate: (section: MainSection) => void;
}

export const ManufacturingView: React.FC<ManufacturingViewProps> = ({
  state,
  onUpdateLine,
  onSetQaBudget,
  onNavigate,
}) => {
  const litho = getBestLithography(state.unlockedTechIds);
  const waferDia = getMaxWaferDiameterMm(state.unlockedTechIds);
  const productionChips = state.chips.filter((c) => c.status === 'production');
  const fabMap = new Map(state.facilities.filter((f) => f.kind === 'fab').map((f) => [f.id, f]));

  const unlockedNodes = PROCESS_NODES.filter(
    (n) => !n.requiredTechId || state.unlockedTechIds.includes(n.requiredTechId)
  );

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#1F2A3D] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E8EEF7] tracking-tight">Manufacturing &amp; Fabs</h1>
          <p className="text-sm text-[#8C9BB2] mt-0.5">
            {litho.name} · {waferDia} mm Wafers · Pure resource-driven production (Silicon, Grid Power &amp; Packaging Capacity)
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('infrastructure')}
          className="h-9 px-3.5 rounded-md bg-[#111622] hover:bg-[#171E2E] text-[#E8EEF7] border border-[#2C3B55] text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
        >
          <Layers className="w-3.5 h-3.5 text-[#06B6D4]" />
          <span>Expand Fabs &amp; Utilities</span>
        </button>
      </div>

      {/* Physical Resource Balance Ribbon (No monetary wafer prices!) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-4 space-y-1">
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
          <div className="text-xs text-[#8C9BB2] font-mono tabular-nums">
            Stockpile: {formatCompactNumber(state.silicon, 0)} Si
          </div>
        </div>

        <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-4 space-y-1">
          <div className="text-xs text-[#8C9BB2]">Grid Electrical Load</div>
          <div
            className={`text-xl font-mono tabular-nums font-bold ${
              state.telemetry.powerDeficit ? 'text-rose-400' : 'text-[#E8EEF7]'
            }`}
          >
            {state.telemetry.powerUsedMW.toFixed(1)} / {state.telemetry.powerCapacityMW.toFixed(0)}
            <span className="text-xs font-normal text-[#8C9BB2] ml-1">MW</span>
          </div>
          <div className="text-xs text-[#8C9BB2] font-mono tabular-nums">
            Litho Power Factor {litho.powerOverheadMultiplier.toFixed(2)}×
          </div>
        </div>

        <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-4 space-y-1">
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
          <div className="text-xs text-[#8C9BB2] font-mono tabular-nums">
            {(() => {
              const memTB = state.telemetry.monthlyMemoryCapacityTB ?? 0;
              if (memTB <= 0) return '2.5D/3D & TSV stacking multiplies OSAT load';
              if (memTB >= 100) return `Memory shipped: ${formatCompactNumber(memTB, 1)} TB/mo`;
              if (memTB >= 1) return `Memory shipped: ${memTB.toFixed(2)} TB/mo`;
              return `Memory shipped: ${(memTB * 1024).toFixed(1)} GB/mo`;
            })()}
          </div>
        </div>

        <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-4 space-y-2">
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
            Higher QA improves die screening &amp; yield (+{(state.qaBudgetLevel - 1) * 140} CR/mo ops)
          </div>
        </div>
      </div>

      {/* Resource Bottleneck Alert Banner if active */}
      {(state.telemetry.powerDeficit ||
        state.telemetry.siliconStarved ||
        state.telemetry.packagingStarved) && (
        <div className="p-3.5 rounded-md bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              Fab output is currently throttled by a physical resource ceiling (
              {state.telemetry.powerDeficit
                ? 'Grid Power MW'
                : state.telemetry.siliconStarved
                  ? 'Refined Silicon Si'
                  : 'OSAT Packaging Capacity'}
              ). Construct or upgrade utilities in Infrastructure to restore full wafer output.
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
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-[#E8EEF7]">
          Wafer Fabrication Lines ({state.productionLines.length})
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {state.productionLines.map((line) => {
            const fab = fabMap.get(line.fabId);
            if (!fab) return null;
            const maxWafers = fab.waferCapacityPerMonth ?? 120;
            const assignedChip = state.chips.find((c) => c.id === line.chipId);

            return (
              <div
                key={line.id}
                className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-5 space-y-4"
              >
                <div className="flex items-start justify-between gap-3 border-b border-[#1F2A3D] pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[#E8EEF7] flex items-center gap-2">
                      <Factory className="w-4 h-4 text-[#06B6D4]" />
                      <span>{fab.name}</span>
                    </h3>
                    <div className="text-xs text-[#8C9BB2] font-mono tabular-nums mt-0.5">
                      Level {fab.level} · Cleanroom ISO-{6 - (fab.cleanroomGrade ?? 1)} · Cap{' '}
                      {maxWafers} wfr/mo
                    </div>
                  </div>
                  <span
                    className={`text-xs font-mono ${
                      line.statusNote === 'Nominal'
                        ? 'text-emerald-400'
                        : line.statusNote === 'Unassigned'
                          ? 'text-[#8C9BB2]'
                          : 'text-amber-400'
                    }`}
                  >
                    {line.statusNote}
                  </span>
                </div>

                {/* Chip Assignment */}
                <label className="space-y-1 block">
                  <span className="text-xs text-[#8C9BB2]">Assigned Silicon Design</span>
                  <select
                    value={line.chipId ?? ''}
                    onChange={(e) =>
                      onUpdateLine(line.id, { chipId: e.target.value || null })
                    }
                    className="w-full h-9 px-2.5 rounded bg-[#0B0F17] border border-[#1F2A3D] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
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
                        {Math.round(line.targetWaferStartsPerMonth)} / {maxWafers} wfr/mo
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={maxWafers}
                      step={5}
                      value={line.targetWaferStartsPerMonth}
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

                {/* Live Line Output Metrics */}
                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-[#1F2A3D] text-xs">
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
                  <div className="text-[11px] text-[#8C9BB2] font-mono tabular-nums flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Node: {getProcessNode(assignedChip.processNodeId).name} · Actual runs:{' '}
                      {line.actualWaferStartsPerMonth.toFixed(0)} wfr/mo
                    </span>
                    {assignedChip.kind === 'memory' && (
                      <span className="text-[#14B8A6]">
                        {line.goodDiesPerMonth * assignedChip.capacityGB >= 1024
                          ? `${((line.goodDiesPerMonth * assignedChip.capacityGB) / 1024).toFixed(2)} TB/mo`
                          : `${(line.goodDiesPerMonth * assignedChip.capacityGB).toFixed(1)} GB/mo`}{' '}
                        · {assignedChip.stackLayers}L Stack
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Process Node Maturation Matrix */}
      <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-[#E8EEF7]">
            Process Node Maturation &amp; Defect Learning Curves
          </h2>
          <p className="text-xs text-[#8C9BB2] mt-0.5">
            Running wafers on a node accumulates fabrication experience, asymptotically cutting baseline defect density D0 by up to 55%
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {unlockedNodes.map((node) => {
            const xp = state.nodeMaturationXp[node.id] ?? 0;
            const pct = Math.min(100, (xp / 60) * 100);
            const matMult = 0.45 + 0.55 * Math.exp(-0.08 * xp);
            return (
              <div
                key={node.id}
                className="p-3 rounded-md bg-[#0B0F17] border border-[#1F2A3D] space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#E8EEF7]">{node.name}</span>
                  <span className="font-mono tabular-nums text-[#22D3EE]">
                    D0 ×{matMult.toFixed(2)}
                  </span>
                </div>
                <div className="h-1.5 bg-[#171E2E] rounded overflow-hidden">
                  <div
                    className="h-full bg-[#06B6D4]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-mono tabular-nums text-[#64748B]">
                  <span>Maturation {pct.toFixed(0)}%</span>
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
