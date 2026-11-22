import React, { useState } from 'react';
import { ArrowUpCircle, Building2, Plus, AlertTriangle } from 'lucide-react';
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

export const InfrastructureView: React.FC<InfrastructureViewProps> = ({
  state,
  onBuildFacility,
  onUpgradeFacility,
}) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    <div className="p-6 max-w-[1440px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#1F2A3D] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E8EEF7] tracking-tight">Infrastructure &amp; Facilities</h1>
          <p className="text-sm text-[#8C9BB2] mt-0.5">
            Invest Credits into physical wafer fabs, silicon refineries, electrical substations, labs, and OSAT packaging plants
          </p>
        </div>
        <div className="text-xs font-mono tabular-nums text-[#8C9BB2]">
          {state.facilities.length} online · {state.constructionQueue.length} under construction ·{' '}
          {formatCompactNumber(state.credits, 1)} CR available
        </div>
      </div>

      {errorMsg && (
        <div className="px-4 py-2.5 rounded-md bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
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
            const count =
              state.facilities.filter((f) => f.kind === kind).length +
              state.constructionQueue.filter((c) => c.kind === kind && !c.upgradeTargetId).length;
            const cost = Math.round(bp.buildCreditCost * Math.pow(1.22, count));
            const canAfford = state.credits >= cost;

            return (
              <div
                key={kind}
                className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <div className="text-xs text-[#8C9BB2] font-mono tabular-nums">
                    Owned: {state.facilities.filter((f) => f.kind === kind).length} · {bp.buildDays}d
                  </div>
                  <h3 className="text-sm font-semibold text-[#E8EEF7]">{bp.name}</h3>
                  <p className="text-xs text-[#8C9BB2] leading-relaxed">{bp.description}</p>
                  <div className="text-xs font-mono text-[#22D3EE] pt-1">{bp.baseOutputLabel}</div>
                  <div className="text-[11px] text-[#64748B] font-mono tabular-nums">
                    Upkeep {bp.monthlyUpkeepCR} CR/mo · {bp.powerDrawMW} MW
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
        <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[#E8EEF7]">
            Active Construction Projects ({state.constructionQueue.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {state.constructionQueue.map((job) => {
              const pct = Math.min(100, (job.daysCompleted / job.totalDays) * 100);
              return (
                <div
                  key={job.id}
                  className="p-3.5 rounded-md bg-[#0B0F17] border border-[#1F2A3D] space-y-2"
                >
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-[#E8EEF7]">{job.name}</span>
                    <span className="font-mono tabular-nums text-[#8C9BB2]">
                      {Math.ceil(job.totalDays - job.daysCompleted)}d remaining ({pct.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-1.5 bg-[#171E2E] rounded overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Existing Facilities Ledger */}
      <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#1F2A3D] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#E8EEF7] flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#D97706]" />
            <span>Operational Facilities</span>
          </h2>
          <span className="text-xs text-[#8C9BB2]">
            Upgrading Fabs increases wafer capacity (+55%) and cleanroom grade (lowering defect density)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0B0F17] text-[#8C9BB2] border-b border-[#1F2A3D]">
              <tr>
                <th className="py-2.5 px-4 font-medium">Facility</th>
                <th className="py-2.5 px-4 font-medium">Tier</th>
                <th className="py-2.5 px-4 font-medium">Capacity / Output</th>
                <th className="py-2.5 px-4 font-medium text-right">Power</th>
                <th className="py-2.5 px-4 font-medium text-right">Monthly Upkeep</th>
                <th className="py-2.5 px-4 font-medium text-right">Expansion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2A3D]">
              {state.facilities.map((fac) => {
                const bp = FACILITY_BLUEPRINTS[fac.kind];
                const upgCost = Math.round(
                  bp.buildCreditCost * Math.pow(bp.upgradeCostMultiplier, fac.level)
                );
                const upgrading = state.constructionQueue.some((c) => c.upgradeTargetId === fac.id);
                const canAfford = state.credits >= upgCost && !upgrading;

                return (
                  <tr key={fac.id} className="hover:bg-[#171E2E]/40 transition-colors">
                    <td className="py-3 px-4 font-medium text-[#E8EEF7]">{fac.name}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-[#22D3EE]">L{fac.level}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-[#CBD5E1]">
                      {facilityOutputSummary(fac)}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-right text-[#8C9BB2]">
                      {fac.powerDrawMW} MW
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-right text-[#E8EEF7]">
                      {fac.monthlyUpkeepCR.toLocaleString()} CR
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => handleUpgrade(fac.id)}
                        className="h-7 px-2.5 rounded text-xs font-medium bg-[#171E2E] hover:bg-[#1F2A3D] disabled:opacity-40 text-[#E8EEF7] border border-[#2C3B55] inline-flex items-center gap-1 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ArrowUpCircle className="w-3.5 h-3.5 text-[#D97706]" />
                        <span>
                          {upgrading ? 'Upgrading...' : `Upgrade (${formatCompactNumber(upgCost, 1)} CR)`}
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
