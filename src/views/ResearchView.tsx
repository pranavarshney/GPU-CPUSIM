import React, { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Crosshair,
  FlaskConical,
  GitBranch,
  Play,
  Search,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { MeterBar } from '../components/ui/MeterBar';
import { StatusBadge } from '../components/ui/StatusBadge';
import {
  FRONTIER_TRACKS,
  getFrontierTrackCost,
  getMaxParallelResearch,
  getTechNode,
  TECH_LANE_MAP,
  TECH_TREE,
} from '../engine/catalog';
import {
  canResearchTech,
  formatCompactNumber,
  getActiveResearchRates,
} from '../engine/simulation';
import type { DepartmentBudgets, GameState, MainSection, TechCategory } from '../engine/types';

interface ResearchViewProps {
  state: GameState;
  onStartResearch: (techId: string) => void;
  onCancelResearch: (techId: string) => void;
  onUpdateBudgets: (budgets: DepartmentBudgets) => void;
  onAdvanceFrontier: (trackId: string) => void;
  onNavigate: (section: MainSection) => void;
  onJumpToTech?: (techId: string) => void;
}

type SortMode = 'tier' | 'cost_asc' | 'cost_desc';

const CATEGORY_LABELS: Record<TechCategory, string> = {
  fabrication: 'Fabrication',
  cpu: 'CPU Architecture',
  gpu: 'GPU Architecture',
  memory: 'Memory & Storage',
  support: 'Supporting Tech',
  frontier: 'Frontier Paradigms',
};

const BUDGET_PRESETS: { label: string; budgets: DepartmentBudgets }[] = [
  { label: 'Balanced', budgets: { fabrication: 20, cpu: 20, gpu: 20, memory: 20, support: 20 } },
  { label: 'Fab Focus', budgets: { fabrication: 50, cpu: 15, gpu: 10, memory: 15, support: 10 } },
  { label: 'CPU Focus', budgets: { fabrication: 20, cpu: 50, gpu: 10, memory: 10, support: 10 } },
  { label: 'GPU Focus', budgets: { fabrication: 20, cpu: 10, gpu: 50, memory: 10, support: 10 } },
  { label: 'Memory Focus', budgets: { fabrication: 20, cpu: 10, gpu: 10, memory: 50, support: 10 } },
];

export const ResearchView: React.FC<ResearchViewProps> = ({
  state,
  onStartResearch,
  onCancelResearch,
  onUpdateBudgets,
  onAdvanceFrontier,
  onNavigate,
  onJumpToTech,
}) => {
  const [filterCat, setFilterCat] = useState<'all' | TechCategory>('all');
  const [sortMode, setSortMode] = useState<SortMode>('tier');
  const [searchQuery, setSearchQuery] = useState('');
  const maxSlots = getMaxParallelResearch(state.unlockedTechIds);
  const openSlots = Math.max(0, maxSlots - state.activeResearch.length);
  const frontierUnlocked = state.unlockedTechIds.includes('fab_07nm');

  const activeRates = useMemo(() => getActiveResearchRates(state), [state]);

  const availableTechs = useMemo(() => {
    const unlockedSet = new Set(state.unlockedTechIds);
    const activeSet = new Set(state.activeResearch.map((r) => r.techId));
    const q = searchQuery.trim().toLowerCase();

    const list = TECH_TREE.filter((t) => {
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
    });

    return list.sort((a, b) => {
      if (sortMode === 'cost_asc') return a.rpCost - b.rpCost || a.tier - b.tier;
      if (sortMode === 'cost_desc') return b.rpCost - a.rpCost || b.tier - a.tier;
      return a.tier - b.tier || a.rpCost - b.rpCost;
    });
  }, [state.unlockedTechIds, state.activeResearch, filterCat, searchQuery, sortMode]);

  const handleQuickFillSlots = () => {
    if (openSlots <= 0 || availableTechs.length === 0) return;
    const toStart = availableTechs.slice(0, openSlots);
    for (const tech of toStart) {
      onStartResearch(tech.id);
    }
  };

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
    <div className="p-5 lg:p-6 max-w-[1480px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#1E293B] pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#E8EEF7] tracking-tight">
              Research &amp; Laboratories
            </h1>
            <StatusBadge
              tone={state.activeResearch.length === 0 ? 'warning' : 'info'}
              label={`${state.activeResearch.length}/${maxSlots} Slots Active`}
            />
          </div>
          <p className="text-xs text-[#8C9BB2] mt-1 font-mono tabular-nums">
            Output +{state.telemetry.rpPerDay.toFixed(1)} RP/day · {state.unlockedTechIds.length}/
            {TECH_TREE.length} unlocked · {formatCompactNumber(state.researchPointsBank, 0)} RP banked
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {openSlots > 0 && availableTechs.length > 0 && (
            <button
              type="button"
              onClick={handleQuickFillSlots}
              className="h-9 px-3.5 rounded-md bg-[#06B6D4] hover:bg-[#22D3EE] text-[#06080D] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Quick-Fill {Math.min(openSlots, availableTechs.length)} Open Slot{Math.min(openSlots, availableTechs.length) > 1 ? 's' : ''}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('tech_tree')}
            className="h-9 px-3.5 rounded-md bg-[#101521] hover:bg-[#161D2D] text-[#E8EEF7] border border-[#2C3B55] text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <GitBranch className="w-3.5 h-3.5 text-[#06B6D4]" />
            <span>Inspect Tech Tree ({TECH_TREE.length})</span>
          </button>
        </div>
      </div>

      {/* Top Row: Active Research Slots + Department Priority Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-[#101521] border border-[#1E293B] rounded-lg p-4 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#E8EEF7]">
              Active Research Queue ({state.activeResearch.length}/{maxSlots})
            </h2>
            <span className="text-[11px] text-[#8C9BB2]">
              Research Lab Infrastructure &amp; Architecture unlock up to 8 parallel slots
            </span>
          </div>

          {state.activeResearch.length === 0 ? (
            <div className="p-4 rounded-md bg-[#0A0E16] border border-[#1E293B] text-xs text-[#8C9BB2] flex flex-wrap items-center justify-between gap-3">
              <span>
                All laboratories are banking 100% of daily RP ({state.telemetry.rpPerDay.toFixed(1)} RP/day) into the reserve for Frontier Synthesis.
              </span>
              {availableTechs.length > 0 && (
                <button
                  type="button"
                  onClick={handleQuickFillSlots}
                  className="text-xs font-medium text-[#22D3EE] hover:text-[#67E8F9] whitespace-nowrap cursor-pointer"
                >
                  Auto-Start Next →
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {state.activeResearch.map((proj) => {
                const tech = getTechNode(proj.techId);
                const pct = Math.min(100, (proj.progressRp / proj.totalRp) * 100);
                const actualRate = activeRates[proj.techId] ?? state.telemetry.rpPerDay;
                const etaDays = Math.ceil((proj.totalRp - proj.progressRp) / Math.max(0.1, actualRate));

                return (
                  <div
                    key={proj.techId}
                    className="p-3.5 rounded-md bg-[#0A0E16] border border-[#1E293B] space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#E8EEF7] truncate">
                          {tech?.name ?? proj.techId}
                        </div>
                        <div className="text-xs text-[#8C9BB2] font-mono tabular-nums mt-0.5">
                          {tech
                            ? `${TECH_LANE_MAP[tech.lane]?.shortLabel ?? CATEGORY_LABELS[tech.category]} · T${tech.tier}`
                            : ''}{' '}
                          · +{actualRate.toFixed(1)} RP/d · ~{etaDays.toLocaleString()}d left
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {onJumpToTech && (
                          <button
                            type="button"
                            onClick={() => onJumpToTech(proj.techId)}
                            title="Locate in Tech Tree"
                            className="h-7 px-2 rounded bg-[#101521] hover:bg-[#161D2D] border border-[#1E293B] text-[11px] text-[#8C9BB2] hover:text-[#22D3EE] flex items-center gap-1 cursor-pointer"
                          >
                            <Crosshair className="w-3 h-3" />
                            <span>Tree</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onCancelResearch(proj.techId)}
                          className="h-7 px-2 rounded bg-[#101521] hover:bg-rose-950/50 border border-[#1E293B] hover:border-rose-500/40 text-[11px] text-[#8C9BB2] hover:text-rose-300 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                        >
                          <XCircle className="w-3 h-3" />
                          <span>Cancel</span>
                        </button>
                      </div>
                    </div>
                    <MeterBar value={pct} max={100} tone="cyan" height="md" />
                    <div className="flex justify-between text-[11px] font-mono tabular-nums text-[#8C9BB2]">
                      <span>
                        {Math.round(proj.progressRp).toLocaleString()} /{' '}
                        {proj.totalRp.toLocaleString()} RP
                      </span>
                      <span className="text-[#22D3EE]">{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Departmental Budget Allocation */}
        <div className="lg:col-span-5 bg-[#101521] border border-[#1E293B] rounded-lg p-4 space-y-3.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[#E8EEF7]">Lab Priority Allocation</h2>
              <p className="text-[11px] text-[#8C9BB2] mt-0.5">
                Weights daily RP flow across concurrent research domains
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {BUDGET_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => onUpdateBudgets(preset.budgets)}
                className="h-6 px-2 rounded bg-[#0A0E16] hover:bg-[#161D2D] border border-[#1E293B] text-[11px] text-[#8C9BB2] hover:text-[#E8EEF7] cursor-pointer whitespace-nowrap"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {(['fabrication', 'cpu', 'gpu', 'memory', 'support'] as const).map((key) => {
              const raw = state.researchBudgets[key];
              const pct = Math.round((raw / Math.max(1, budgetSum)) * 100);
              return (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#CBD5E1]">{CATEGORY_LABELS[key]}</span>
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
      <div className="bg-[#101521] border border-[#1E293B] rounded-lg p-4 space-y-4">
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
                className="h-8 pl-8 pr-3 w-48 rounded-md bg-[#0A0E16] border border-[#1E293B] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7] placeholder:text-[#64748B]"
              />
            </div>

            <div className="flex items-center gap-1 bg-[#0A0E16] border border-[#1E293B] rounded-md px-2 h-8 text-xs text-[#8C9BB2]">
              <ArrowUpDown className="w-3 h-3 text-[#64748B]" />
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                aria-label="Sort available technologies"
                className="bg-transparent text-xs text-[#E8EEF7] focus:outline-none cursor-pointer"
              >
                <option value="tier" className="bg-[#0A0E16]">Sort: Tier Order</option>
                <option value="cost_asc" className="bg-[#0A0E16]">Sort: Fastest First</option>
                <option value="cost_desc" className="bg-[#0A0E16]">Sort: Highest RP</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-0.5 bg-[#0A0E16] border border-[#1E293B] rounded-md p-0.5">
              {(['all', 'fabrication', 'cpu', 'gpu', 'memory', 'support', 'frontier'] as const).map(
                (cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFilterCat(cat)}
                    className={`px-2.5 py-1 text-[11px] rounded-[4px] transition-colors whitespace-nowrap cursor-pointer ${
                      filterCat === cat
                        ? 'bg-[#161D2D] text-[#E8EEF7] font-medium'
                        : 'text-[#8C9BB2] hover:text-[#E8EEF7]'
                    }`}
                  >
                    {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {availableTechs.length === 0 ? (
          <div className="p-4 rounded-md bg-[#0A0E16] border border-[#1E293B] text-xs text-[#8C9BB2]">
            No additional technologies currently available in this filter. Complete active research or inspect prerequisite chains in the Technology Tree.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {availableTechs.map((tech) => {
              const check = canResearchTech(state, tech.id);
              const etaDays = Math.ceil(tech.rpCost / Math.max(0.5, state.telemetry.rpPerDay));
              const laneMeta = TECH_LANE_MAP[tech.lane];
              return (
                <div
                  key={tech.id}
                  className="p-3.5 rounded-md bg-[#0A0E16] border border-[#1E293B] hover:border-[#2C3B55] transition-colors flex flex-col justify-between gap-3"
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

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#1E293B]">
                    <span className="text-xs font-mono tabular-nums text-[#64748B]">
                      ~{etaDays.toLocaleString()}d solo
                    </span>
                    <div className="flex items-center gap-1.5">
                      {onJumpToTech && (
                        <button
                          type="button"
                          onClick={() => onJumpToTech(tech.id)}
                          title="Locate node in Tech Tree"
                          className="h-7 w-7 rounded bg-[#101521] hover:bg-[#161D2D] border border-[#1E293B] flex items-center justify-center text-[#8C9BB2] hover:text-[#22D3EE] cursor-pointer"
                        >
                          <Crosshair className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={!check.ok}
                        onClick={() => onStartResearch(tech.id)}
                        title={check.reason}
                        className="h-7 px-2.5 rounded text-xs font-medium bg-[#06B6D4]/20 hover:bg-[#06B6D4]/30 disabled:opacity-40 text-[#22D3EE] border border-[#06B6D4]/40 flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
                      >
                        <FlaskConical className="w-3 h-3" />
                        <span>Research</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Constrained Open-Ended Frontier Synthesis */}
      <div className="bg-[#101521] border border-[#1E293B] rounded-lg p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#E8EEF7] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#D97706]" />
              <span>Open-Ended Frontier Synthesis</span>
            </h2>
            <p className="text-xs text-[#8C9BB2] mt-0.5">
              Exponentially escalating RP costs with logarithmic diminishing returns and physical trade-offs
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-[#D97706]">
            Banked RP: {formatCompactNumber(state.researchPointsBank, 1)}
          </span>
        </div>

        {!frontierUnlocked ? (
          <div className="p-4 rounded-md bg-[#0A0E16] border border-[#1E293B] text-xs text-[#8C9BB2] flex flex-wrap items-center justify-between gap-3">
            <span>
              Locked until <span className="text-[#E8EEF7] font-medium">0.7 nm Angstrom Process</span> is researched. Unlocks indefinite Cryogenic, Photonic, Carbon-Nanotube, and Topological paradigms.
            </span>
            {onJumpToTech && (
              <button
                type="button"
                onClick={() => onJumpToTech('fab_07nm')}
                className="text-xs text-[#22D3EE] hover:text-[#67E8F9] whitespace-nowrap cursor-pointer"
              >
                Locate 0.7 nm Node →
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {FRONTIER_TRACKS.map((track) => {
              const lvl = state.frontierLevels[track.id] ?? 0;
              const cost = getFrontierTrackCost(track, lvl);
              const affordable = state.researchPointsBank >= cost;
              const bankPct = Math.min(100, (state.researchPointsBank / Math.max(1, cost)) * 100);
              return (
                <div
                  key={track.id}
                  className="p-4 rounded-md bg-[#0A0E16] border border-[#1E293B] flex flex-col justify-between gap-3"
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
                  <div className="space-y-2 pt-2 border-t border-[#1E293B]">
                    <MeterBar value={bankPct} max={100} tone={affordable ? 'emerald' : 'amber'} height="sm" />
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono tabular-nums text-[#8C9BB2]">
                        Next: {formatCompactNumber(cost, 1)} RP
                      </span>
                      <button
                        type="button"
                        disabled={!affordable}
                        onClick={() => onAdvanceFrontier(track.id)}
                        className="h-7 px-3 rounded text-xs font-medium bg-[#D97706]/20 hover:bg-[#D97706]/30 disabled:opacity-40 text-[#FBBF24] border border-[#D97706]/40 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
                      >
                        Synthesize L{lvl + 1}
                      </button>
                    </div>
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
