import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowUpCircle, Building2, Plus } from 'lucide-react';
import { MeterBar } from '../components/ui/MeterBar';
import { StatusBadge } from '../components/ui/StatusBadge';
import { FACILITY_BLUEPRINTS } from '../engine/catalog';
import { formatCompactNumber } from '../engine/simulation';
import type { Facility, FacilityKind, GameState } from '../engine/types';

interface InfrastructureViewProps {
  state: GameState;
  onBuildFacility: (kind: FacilityKind) => { error?: string };
  onUpgradeFacility: (facilityId: string) => { error?: string };
}

const FACILITY_ORDER: FacilityKind[] = [
  'fab',
  'silicon_refinery',
  'power_plant',
  'research_lab',
  'packaging_plant',
];

const KIND_LABELS: Record<FacilityKind, string> = {
  fab: 'Wafer Fabs',
  silicon_refinery: 'Refineries',
  power_plant: 'Power Grid',
  research_lab: 'R&D Labs',
  packaging_plant: 'OSAT Plants',
};

function facilityOutputSummary(fac: Facility): string {
  switch (fac.kind) {
    case 'fab':
      return `${fac.waferCapacityPerMonth} wfr/mo · ISO-${6 - (fac.cleanroomGrade ?? 1)} Cleanroom`;
    case 'silicon_refinery':
      return `+${fac.siliconOutputPerMonth} Si/mo feedstock`;
    case 'power_plant':
      return `+${fac.powerCapacityMW} MW electrical grid`;
    case 'research_lab':
      return `+${fac.researchOutputPerDay?.toFixed(1)} RP/day base output`;
    case 'packaging_plant':
      return `${fac.packagingCapacityPerMonth?.toLocaleString()} pkg units/mo`;
  }
}

function facilityUpgradeDelta(fac: Facility): string {
  switch (fac.kind) {
    case 'fab': {
      const nextCap = Math.round((fac.waferCapacityPerMonth ?? 120) * 1.55);
      const nextIso = 6 - Math.min(5, (fac.cleanroomGrade ?? 1) + 1);
      return `→ ${nextCap} wfr/mo · ISO-${nextIso}`;
    }
    case 'silicon_refinery':
      return `→ +${Math.round((fac.siliconOutputPerMonth ?? 950) * 1.6)} Si/mo`;
    case 'power_plant':
      return `→ +${Math.round((fac.powerCapacityMW ?? 35) * 1.65)} MW`;
    case 'research_lab':
      return `→ +${((fac.researchOutputPerDay ?? 3.6) * 1.65).toFixed(1)} RP/day`;
    case 'packaging_plant':
      return `→ ${Math.round((fac.packagingCapacityPerMonth ?? 12000) * 1.65).toLocaleString()} pkg/mo`;
  }
}

export const InfrastructureView: React.FC<InfrastructureViewProps> = ({
  state,
  onBuildFacility,
  onUpgradeFacility,
}) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<'all' | FacilityKind>('all');

  const inDebt = Boolean(state.telemetry.inDebt) || state.credits < 0;
  const allFabsBusy =
    state.productionLines.length > 0 && state.productionLines.every((l) => l.chipId !== null);

  const bottleneckKind = useMemo<FacilityKind | null>(() => {
    if (state.telemetry.powerDeficit) return 'power_plant';
    if (state.telemetry.siliconStarved) return 'silicon_refinery';
    if (state.telemetry.packagingStarved) return 'packaging_plant';
    if (allFabsBusy) return 'fab';
    return null;
  }, [
    state.telemetry.powerDeficit,
    state.telemetry.siliconStarved,
    state.telemetry.packagingStarved,
    allFabsBusy,
  ]);

  const filteredFacilities = useMemo(
    () =>
      kindFilter === 'all'
        ? state.facilities
        : state.facilities.filter((f) => f.kind === kindFilter),
    [state.facilities, kindFilter]
  );

  const handleBuild = (kind: FacilityKind) => {
    setErrorMsg(null);
    const res = onBuildFacility(kind);
    if (res.error) setErrorMsg(res.error);
  };

  const handleUpgrade = (id: string) => {
    setErrorMsg(null);
    const res = onUpgradeFacility(id);
    if (res.error) setErrorMsg(res.error);
  };

  return (
    <div className="p-5 lg:p-6 max-w-[1480px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#1E293B] pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#E8EEF7] tracking-tight">
              Infrastructure &amp; Facilities
            </h1>
            {inDebt && <StatusBadge tone="critical" label="Builds Frozen (Debt)" />}
          </div>
          <p className="text-xs text-[#8C9BB2] mt-1 font-mono tabular-nums">
            {state.facilities.length} online · {state.constructionQueue.length} under construction ·{' '}
            {formatCompactNumber(state.credits, 1)} CR available
          </p>
        </div>
        <div className="text-xs font-mono tabular-nums text-[#8C9BB2]">
          Power {state.telemetry.powerUsedMW.toFixed(0)}/{state.telemetry.powerCapacityMW.toFixed(0)} MW · Si{' '}
          {formatCompactNumber(state.telemetry.monthlySiliconConsumed, 0)}/
          {formatCompactNumber(state.telemetry.monthlySiliconProd, 0)}/m
        </div>
      </div>

      {errorMsg && (
        <div className="px-4 py-2.5 rounded-md bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Construction Blueprints */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[#E8EEF7]">Commission New Facility</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3.5">
          {FACILITY_ORDER.map((kind) => {
            const bp = FACILITY_BLUEPRINTS[kind];
            const owned = state.facilities.filter((f) => f.kind === kind).length;
            const queued = state.constructionQueue.filter(
              (c) => c.kind === kind && !c.upgradeTargetId
            ).length;
            const cost = Math.round(bp.buildCreditCost * Math.pow(1.22, owned + queued));
            const canAfford = !inDebt && state.credits >= cost;
            const isPriority = bottleneckKind === kind;

            return (
              <div
                key={kind}
                className={`bg-[#101521] border rounded-lg p-4 flex flex-col justify-between gap-3 ${
                  isPriority ? 'border-amber-500/50' : 'border-[#1E293B]'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1 text-[11px] font-mono tabular-nums text-[#8C9BB2]">
                    <span>
                      Owned: {owned}
                      {queued > 0 ? ` (+${queued})` : ''} · {bp.buildDays}d
                    </span>
                    {isPriority && <StatusBadge tone="warning" label="Needed" compact />}
                  </div>
                  <h3 className="text-sm font-semibold text-[#E8EEF7]">{bp.name}</h3>
                  <p className="text-xs text-[#8C9BB2] leading-relaxed">{bp.description}</p>
                  <div className="text-xs font-mono text-[#22D3EE] pt-1">{bp.baseOutputLabel}</div>
                  <div className="text-[11px] text-[#64748B] font-mono tabular-nums">
                    Upkeep {bp.monthlyUpkeepCR.toLocaleString()} CR/mo · {bp.powerDrawMW} MW
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!canAfford}
                  onClick={() => handleBuild(kind)}
                  className="w-full h-8 px-3 rounded text-xs font-medium bg-[#06B6D4]/20 hover:bg-[#06B6D4]/30 disabled:opacity-40 text-[#22D3EE] border border-[#06B6D4]/40 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Build ({formatCompactNumber(cost, 1)} CR)</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Construction Queue */}
      {state.constructionQueue.length > 0 && (
        <div className="bg-[#101521] border border-[#1E293B] rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold text-[#E8EEF7]">
            Active Construction Projects ({state.constructionQueue.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {state.constructionQueue.map((job) => {
              const pct = Math.min(100, (job.daysCompleted / job.totalDays) * 100);
              return (
                <div
                  key={job.id}
                  className="p-3 rounded-md bg-[#0A0E16] border border-[#1E293B] space-y-2"
                >
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-[#E8EEF7]">{job.name}</span>
                    <span className="font-mono tabular-nums text-[#8C9BB2]">
                      {Math.ceil(job.totalDays - job.daysCompleted)}d left ({pct.toFixed(0)}%)
                    </span>
                  </div>
                  <MeterBar value={pct} max={100} tone="emerald" height="sm" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Existing Facilities Ledger */}
      <div className="bg-[#101521] border border-[#1E293B] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1E293B] flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[#E8EEF7] flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#D97706]" />
            <span>Operational Facilities ({filteredFacilities.length})</span>
          </h2>
          <div className="flex flex-wrap items-center gap-0.5 bg-[#0A0E16] border border-[#1E293B] rounded p-0.5">
            <button
              type="button"
              onClick={() => setKindFilter('all')}
              className={`px-2 py-1 text-[11px] rounded cursor-pointer whitespace-nowrap ${
                kindFilter === 'all'
                  ? 'bg-[#161D2D] text-[#E8EEF7]'
                  : 'text-[#8C9BB2] hover:text-[#E8EEF7]'
              }`}
            >
              All
            </button>
            {FACILITY_ORDER.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKindFilter(k)}
                className={`px-2 py-1 text-[11px] rounded cursor-pointer whitespace-nowrap ${
                  kindFilter === k
                    ? 'bg-[#161D2D] text-[#E8EEF7]'
                    : 'text-[#8C9BB2] hover:text-[#E8EEF7]'
                }`}
              >
                {KIND_LABELS[k]}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0A0E16] text-[#8C9BB2] border-b border-[#1E293B]">
              <tr>
                <th className="py-2.5 px-4 font-medium">Facility</th>
                <th className="py-2.5 px-4 font-medium">Tier</th>
                <th className="py-2.5 px-4 font-medium">Current Output</th>
                <th className="py-2.5 px-4 font-medium">Next Upgrade</th>
                <th className="py-2.5 px-4 font-medium text-right">Power</th>
                <th className="py-2.5 px-4 font-medium text-right">Monthly Upkeep</th>
                <th className="py-2.5 px-4 font-medium text-right">Expansion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {filteredFacilities.map((fac) => {
                const bp = FACILITY_BLUEPRINTS[fac.kind];
                const upgCost = Math.round(
                  bp.buildCreditCost * Math.pow(bp.upgradeCostMultiplier, fac.level)
                );
                const upgrading = state.constructionQueue.some((c) => c.upgradeTargetId === fac.id);
                const canAfford = !inDebt && state.credits >= upgCost && !upgrading;

                return (
                  <tr key={fac.id} className="hover:bg-[#161D2D]/40 transition-colors">
                    <td className="py-2.5 px-4 font-medium text-[#E8EEF7]">{fac.name}</td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-[#22D3EE]">
                      L{fac.level}
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-[#CBD5E1]">
                      {facilityOutputSummary(fac)}
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-emerald-400">
                      {facilityUpgradeDelta(fac)}
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-right text-[#8C9BB2]">
                      {fac.powerDrawMW} MW
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-right text-[#E8EEF7]">
                      {fac.monthlyUpkeepCR.toLocaleString()} CR
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => handleUpgrade(fac.id)}
                        className="h-7 px-2.5 rounded text-xs font-medium bg-[#161D2D] hover:bg-[#1E293B] disabled:opacity-40 text-[#E8EEF7] border border-[#2C3B55] inline-flex items-center gap-1 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ArrowUpCircle className="w-3.5 h-3.5 text-[#D97706]" />
                        <span>
                          {upgrading
                            ? 'Upgrading...'
                            : `Upgrade (${formatCompactNumber(upgCost, 1)} CR)`}
                        </span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
