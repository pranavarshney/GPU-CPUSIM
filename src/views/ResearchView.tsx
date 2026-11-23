import React, { useMemo, useState } from 'react';
import { FlaskConical, GitBranch, Search, Sparkles, XCircle } from 'lucide-react';
import {
  FRONTIER_TRACKS,
  getFrontierTrackCost,
  getMaxParallelResearch,
  getTechNode,
  TECH_LANE_MAP,
  TECH_TREE,
} from '../engine/catalog';
import { canResearchTech, formatCompactNumber } from '../engine/simulation';
import type { DepartmentBudgets, GameState, MainSection, TechCategory } from '../engine/types';

interface ResearchViewProps {
  state: GameState;
  onStartResearch: (techId: string) => void;
  onCancelResearch: (techId: string) => void;
  onUpdateBudgets: (budgets: DepartmentBudgets) => void;
  onAdvanceFrontier: (trackId: string) => void;
  onNavigate: (section: MainSection) => void;
}

const CATEGORY_LABELS: Record<TechCategory, string> = {
  fabrication: 'Fabrication',
  cpu: 'CPU Architecture',
  gpu: 'GPU Architecture',
  memory: 'Memory & Storage',
  support: 'Supporting Tech',
  frontier: 'Frontier Paradigms',
};

export const ResearchView: React.FC<ResearchViewProps> = ({
  state,
  onStartResearch,
  onCancelResearch,
  onUpdateBudgets,
  onAdvanceFrontier,
  onNavigate,
}) => {
  const [filterCat, setFilterCat] = useState<'all' | TechCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const maxSlots = getMaxParallelResearch(state.unlockedTechIds);
  const frontierUnlocked = state.unlockedTechIds.includes('fab_07nm');

  const availableTechs = useMemo(() => {
    const unlockedSet = new Set(state.unlockedTechIds);
    const activeSet = new Set(state.activeResearch.map((r) => r.techId));
    const q = searchQuery.trim().toLowerCase();

    return TECH_TREE.filter((t) => {
      if (unlockedSet.has(t.id)) return false;
      if (activeSet.has(t.id)) return false;
      if (!t.prerequisites.every((p) => unlockedSet.has(p))) return false;
      if (filterCat !== 'all' && t.category !== filterCat) return false;
      if (q) {
        const match =
          t.name.toLowerCase().includes(q) ||
          t.summary.toLowerCase().includes(q) ||
          t.unlocksSummary.some((u) => u.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    }).sort((a, b) => a.tier - b.tier || a.rpCost - b.rpCost);
  }, [state.unlockedTechIds, state.activeResearch, filterCat, searchQuery]);

  const handleBudgetSlider = (key: keyof DepartmentBudgets, value: number) => {
    onUpdateBudgets({
      ...state.researchBudgets,
      [key]: value,
    });
  };

  const budgetSum =
    state.researchBudgets.fabrication +
    state.researchBudgets.cpu +
    state.researchBudgets.gpu +
    state.researchBudgets.memory +
    state.researchBudgets.support;

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#1F2A3D] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E8EEF7] tracking-tight">Research &amp; Laboratories</h1>
          <p className="text-sm text-[#8C9BB2] mt-0.5">
            Output {state.telemetry.rpPerDay.toFixed(1)} RP/day · {state.activeResearch.length}/
            {maxSlots} parallel slots · {state.unlockedTechIds.length}/{TECH_TREE.length} unlocked ·{' '}
            {formatCompactNumber(state.researchPointsBank, 0)} RP banked
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('tech_tree')}
          className="h-9 px-3.5 rounded-md bg-[#111622] hover:bg-[#171E2E] text-[#E8EEF7] border border-[#2C3B55] text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
        >
          <GitBranch className="w-3.5 h-3.5 text-[#06B6D4]" />
          <span>Inspect Full Tech Tree ({TECH_TREE.length})</span>
        </button>
      </div>

      {/* Top Row: Active Research Slots + Department Priority Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-[#111622] border border-[#1F2A3D] rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#E8EEF7]">
              Active Research Queue ({state.activeResearch.length}/{maxSlots})
            </h2>
            <span className="text-xs text-[#8C9BB2]">
              Research Lab Infrastructure &amp; CPU Architecture unlock up to 8 parallel slots
            </span>
          </div>

          {state.activeResearch.length === 0 ? (
            <div className="p-5 rounded-md bg-[#0B0F17] border border-[#1F2A3D] text-xs text-[#8C9BB2]">
              All laboratories are currently idle and banking 100% of daily RP for future breakthroughs or Frontier Synthesis. Select an available technology below to begin research.
            </div>
          ) : (
            <div className="space-y-3">
              {state.activeResearch.map((proj) => {
                const tech = getTechNode(proj.techId);
                const pct = Math.min(100, (proj.progressRp / proj.totalRp) * 100);
                const approxRate = state.telemetry.rpPerDay / Math.max(1, state.activeResearch.length);
                const etaDays = Math.ceil((proj.totalRp - proj.progressRp) / Math.max(0.1, approxRate));

                return (
                  <div
                    key={proj.techId}
                    className="p-3.5 rounded-md bg-[#0B0F17] border border-[#1F2A3D] space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[#E8EEF7]">
                          {tech?.name ?? proj.techId}
                        </div>
                        <div className="text-xs text-[#8C9BB2]">
                          {tech ? `${TECH_LANE_MAP[tech.lane]?.shortLabel ?? CATEGORY_LABELS[tech.category]} · Tier ${tech.tier}` : ''} · Est. {etaDays} days remaining
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onCancelResearch(proj.techId)}
                        className="text-xs text-[#8C9BB2] hover:text-rose-400 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Cancel</span>
                      </button>
                    </div>
                    <div className="h-2 bg-[#171E2E] rounded overflow-hidden">
                      <div
                        className="h-full bg-[#06B6D4] transition-all duration-150"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs font-mono tabular-nums text-[#8C9BB2]">
                      <span>
                        {Math.round(proj.progressRp).toLocaleString()} /{' '}
                        {proj.totalRp.toLocaleString()} RP
                      </span>
                      <span>{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Departmental Budget Allocation */}
        <div className="lg:col-span-5 bg-[#111622] border border-[#1F2A3D] rounded-lg p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-[#E8EEF7]">Lab Priority Allocation</h2>
            <p className="text-xs text-[#8C9BB2] mt-0.5">
              Weights daily RP distribution when running multiple research domains in parallel
            </p>
          </div>
          <div className="space-y-3.5">
            {(['fabrication', 'cpu', 'gpu', 'memory', 'support'] as const).map((key) => {
              const raw = state.researchBudgets[key];
              const pct = Math.round((raw / Math.max(1, budgetSum)) * 100);
              return (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#E8EEF7]">{CATEGORY_LABELS[key]}</span>
                    <span className="font-mono tabular-nums text-[#22D3EE]">{pct}%</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={80}
                    value={raw}
                    onChange={(e) => handleBudgetSlider(key, Number(e.target.value))}
                    className="foundry-slider"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Available Technologies Ready to Start */}
      <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[#E8EEF7]">
            Available Research Projects ({availableTechs.length})
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter available projects..."
                className="h-8 pl-8 pr-3 w-52 rounded-md bg-[#0B0F17] border border-[#1F2A3D] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7] placeholder:text-[#64748B]"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1 bg-[#0B0F17] border border-[#1F2A3D] rounded-md p-0.5">
              {(['all', 'fabrication', 'cpu', 'gpu', 'memory', 'support', 'frontier'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFilterCat(cat)}
                  className={`px-2.5 py-1 text-xs rounded-[4px] transition-colors whitespace-nowrap cursor-pointer ${
                    filterCat === cat
                      ? 'bg-[#171E2E] text-[#E8EEF7]'
                      : 'text-[#8C9BB2] hover:text-[#E8EEF7]'
                  }`}
                >
                  {cat === 'all' ? 'All Domains' : CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {availableTechs.length === 0 ? (
          <div className="p-4 rounded-md bg-[#0B0F17] border border-[#1F2A3D] text-xs text-[#8C9BB2]">
            No additional technologies currently available in this filter. Complete active research or inspect dependencies in the Technology Tree.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {availableTechs.map((tech) => {
              const check = canResearchTech(state, tech.id);
              const etaDays = Math.ceil(tech.rpCost / Math.max(0.5, state.telemetry.rpPerDay));
              const laneMeta = TECH_LANE_MAP[tech.lane];
              return (
                <div
                  key={tech.id}
                  className="p-4 rounded-md bg-[#0B0F17] border border-[#1F2A3D] flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-[#8C9BB2]">
                      <span style={{ color: laneMeta?.accent }}>
                        {laneMeta?.shortLabel ?? CATEGORY_LABELS[tech.category]} · T{tech.tier}
                      </span>
                      <span className="font-mono tabular-nums text-[#22D3EE]">
                        {tech.rpCost.toLocaleString()} RP
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-[#E8EEF7]">{tech.name}</h3>
                    <p className="text-xs text-[#8C9BB2] leading-relaxed">{tech.summary}</p>
                    <ul className="text-xs text-[#CBD5E1] space-y-0.5 pt-1">
                      {tech.unlocksSummary.map((u) => (
                        <li key={u} className="truncate">
                          · {u}
                        </li>
                      ))}
                    </ul>
                    {tech.constraintWarning && (
                      <p className="text-[11px] text-amber-400 pt-1">
                        Constraint: {tech.constraintWarning}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#1F2A3D]">
                    <span className="text-xs font-mono tabular-nums text-[#64748B]">
                      ~{etaDays} days
                    </span>
                    <button
                      type="button"
                      disabled={!check.ok}
                      onClick={() => onStartResearch(tech.id)}
                      title={check.reason}
                      className="h-8 px-3 rounded text-xs font-medium bg-[#06B6D4]/20 hover:bg-[#06B6D4]/30 disabled:opacity-40 text-[#22D3EE] border border-[#06B6D4]/40 flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
                    >
                      <FlaskConical className="w-3.5 h-3.5" />
                      <span>Start Research</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Constrained Open-Ended Frontier Synthesis */}
      <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#E8EEF7] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#D97706]" />
              <span>Open-Ended Frontier Synthesis (Constrained Refinements)</span>
            </h2>
            <p className="text-xs text-[#8C9BB2] mt-0.5">
              Exponentially escalating RP costs with logarithmic diminishing returns and real physical trade-offs
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-[#D97706]">
            Banked RP: {formatCompactNumber(state.researchPointsBank, 1)}
          </span>
        </div>

        {!frontierUnlocked ? (
          <div className="p-4 rounded-md bg-[#0B0F17] border border-[#1F2A3D] text-xs text-[#8C9BB2]">
            Locked until <span className="text-[#E8EEF7] font-medium">0.7 nm Angstrom Process</span> is researched. Once reached, you can pioneer Cryogenic, Photonic, Carbon-Nanotube, and Topological paradigms indefinitely.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FRONTIER_TRACKS.map((track) => {
              const lvl = state.frontierLevels[track.id] ?? 0;
              const cost = getFrontierTrackCost(track, lvl);
              const affordable = state.researchPointsBank >= cost;
              return (
                <div
                  key={track.id}
                  className="p-4 rounded-md bg-[#0B0F17] border border-[#1F2A3D] flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#E8EEF7]">{track.name}</span>
                      <span className="font-mono tabular-nums text-[#D97706]">Level {lvl}</span>
                    </div>
                    <p className="text-xs text-[#8C9BB2]">{track.description}</p>
                    <div className="text-xs font-mono text-[#22D3EE]">
                      Gain: {track.diminishingFormulaLabel}
                    </div>
                    <div className="text-[11px] text-amber-400">
                      Trade-off: {track.constraintTradeoff}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[#1F2A3D]">
                    <span className="text-xs font-mono tabular-nums text-[#8C9BB2]">
                      Next: {formatCompactNumber(cost, 1)} RP
                    </span>
                    <button
                      type="button"
                      disabled={!affordable}
                      onClick={() => onAdvanceFrontier(track.id)}
                      className="h-8 px-3 rounded text-xs font-medium bg-[#D97706]/20 hover:bg-[#D97706]/30 disabled:opacity-40 text-[#FBBF24] border border-[#D97706]/40 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
                    >
                      Synthesize L{lvl + 1}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
