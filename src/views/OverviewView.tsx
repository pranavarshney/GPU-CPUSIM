import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Cpu,
  Factory,
  FlaskConical,
  GitBranch,
  HardDrive,
  Layers,
} from 'lucide-react';
import { MeterBar } from '../components/ui/MeterBar';
import { StatusBadge } from '../components/ui/StatusBadge';
import {
  getBestLithography,
  getMaxParallelResearch,
  getMaxWaferDiameterMm,
  getTechNode,
} from '../engine/catalog';
import {
  formatCompactNumber,
  formatSimDate,
  getActiveResearchRates,
  getStaffImpactSummary,
} from '../engine/simulation';
import type { GameState, HistoryPoint, MainSection, MilestoneEvent } from '../engine/types';

interface OverviewViewProps {
  state: GameState;
  onNavigate: (section: MainSection) => void;
  onJumpToTech?: (techId: string) => void;
}

type TrendMetric = 'computeIndex' | 'credits' | 'goodDiesPerMonth' | 'rpPerDay';

const TREND_METRIC_META: Record<
  TrendMetric,
  { label: string; shortLabel: string; color: string; unit: string }
> = {
  computeIndex: {
    label: 'Compute Index',
    shortLabel: 'Compute',
    color: '#06B6D4',
    unit: 'idx',
  },
  credits: {
    label: 'Treasury Credits',
    shortLabel: 'Credits',
    color: '#D97706',
    unit: 'CR',
  },
  goodDiesPerMonth: {
    label: 'Good Dies / Mo',
    shortLabel: 'Dies/mo',
    color: '#10B981',
    unit: 'dies',
  },
  rpPerDay: {
    label: 'Research Output',
    shortLabel: 'RP/day',
    color: '#38BDF8',
    unit: 'RP/d',
  },
};

function sectionForEventCategory(cat: MilestoneEvent['category']): MainSection {
  switch (cat) {
    case 'research':
      return 'research';
    case 'tapeout':
      return 'manufacturing';
    case 'construction':
      return 'infrastructure';
    case 'warning':
      return 'finances';
    default:
      return 'overview';
  }
}

const TrendChartSVG: React.FC<{ data: HistoryPoint[]; metric: TrendMetric }> = ({
  data,
  metric,
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const meta = TREND_METRIC_META[metric];

  if (data.length < 2) {
    return (
      <div className="h-[190px] flex items-center justify-center text-xs text-[#64748B]">
        Unpause the simulation (Space) to begin recording monthly foundry telemetry.
      </div>
    );
  }

  const w = 640;
  const h = 186;
  const padX = 14;
  const padTop = 22;
  const padBottom = 18;

  const vals = data.map((d) => d[metric]);
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals, minVal + 1);
  const range = Math.max(1e-6, maxVal - minVal);

  const coords = data.map((d, i) => {
    const x = padX + (i / (data.length - 1)) * (w - padX * 2);
    const y = h - padBottom - ((d[metric] - minVal) / range) * (h - padTop - padBottom);
    return { x, y, point: d };
  });

  const pts = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`);
  const fillPath = `M ${padX},${h - padBottom} L ${pts.join(' L ')} L ${w - padX},${h - padBottom} Z`;

  const activeCoord = hoverIdx !== null ? coords[Math.min(coords.length - 1, hoverIdx)] : null;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * w;
    const t = Math.max(0, Math.min(1, (relX - padX) / Math.max(1, w - padX * 2)));
    const idx = Math.round(t * (data.length - 1));
    setHoverIdx(idx);
  };

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-[190px] cursor-crosshair select-none"
        role="img"
        aria-label={`${meta.label} historical trajectory chart`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id={`grad_${metric}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={meta.color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={meta.color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        {[0, 0.33, 0.66, 1].map((frac) => {
          const y = padTop + frac * (h - padTop - padBottom);
          return (
            <line
              key={frac}
              x1={padX}
              x2={w - padX}
              y1={y}
              y2={y}
              stroke="#1E293B"
              strokeWidth="1"
              strokeDasharray={frac === 1 ? undefined : '3 3'}
            />
          );
        })}
        <path d={fillPath} fill={`url(#grad_${metric})`} />
        <polyline fill="none" stroke={meta.color} strokeWidth="2" points={pts.join(' ')} />

        {/* Interactive Crosshair Probe */}
        {activeCoord && (
          <g>
            <line
              x1={activeCoord.x}
              x2={activeCoord.x}
              y1={padTop}
              y2={h - padBottom}
              stroke="#94A3B8"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            <circle
              cx={activeCoord.x}
              cy={activeCoord.y}
              r="3.8"
              fill="#06080D"
              stroke={meta.color}
              strokeWidth="2"
            />
          </g>
        )}

        <text
          x={padX}
          y="13"
          fill="#8C9BB2"
          fontSize="10"
          fontFamily="ui-monospace, SFMono-Regular, Consolas, Menlo, monospace"
        >
          Peak: {formatCompactNumber(maxVal, 1)} {meta.unit}
        </text>
        <text
          x={w - padX}
          y="13"
          textAnchor="end"
          fill="#8C9BB2"
          fontSize="10"
          fontFamily="ui-monospace, SFMono-Regular, Consolas, Menlo, monospace"
        >
          Y{String(data[0].year).padStart(4, '0')} – Y{String(data[data.length - 1].year).padStart(4, '0')}
        </text>
      </svg>

      {activeCoord && (
        <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded bg-[#101521]/95 border border-[#2C3B55] text-[11px] font-mono tabular-nums text-[#E8EEF7] flex items-center gap-2.5 shadow-lg">
          <span className="text-[#8C9BB2]">
            Y{String(activeCoord.point.year).padStart(4, '0')} · M
            {String(activeCoord.point.month).padStart(2, '0')}
          </span>
          <span style={{ color: meta.color }} className="font-semibold">
            {formatCompactNumber(activeCoord.point[metric], 1)} {meta.unit}
          </span>
          <span className="text-[#64748B]">
            Net {activeCoord.point.monthlyCreditNet >= 0 ? '+' : ''}
            {formatCompactNumber(activeCoord.point.monthlyCreditNet, 1)} CR/m
          </span>
        </div>
      )}
    </div>
  );
};

export const OverviewView: React.FC<OverviewViewProps> = ({
  state,
  onNavigate,
  onJumpToTech,
}) => {
  const [chartMetric, setChartMetric] = useState<TrendMetric>('computeIndex');
  const [chartSpan, setChartSpan] = useState<'monthly' | 'long'>('monthly');
  const [chronicleFilter, setChronicleFilter] = useState<'all' | MilestoneEvent['category']>('all');

  const litho = getBestLithography(state.unlockedTechIds);
  const waferDia = getMaxWaferDiameterMm(state.unlockedTechIds);
  const maxResearchSlots = getMaxParallelResearch(state.unlockedTechIds);
  const activeLines = state.productionLines.filter((l) => l.chipId !== null);
  const idleLines = state.productionLines.length - activeLines.length;
  const chartData = chartSpan === 'monthly' ? state.monthlyHistory : state.longTermHistory;
  const researchRates = useMemo(() => getActiveResearchRates(state), [state]);
  const staffImpact = useMemo(() => getStaffImpactSummary(state), [state]);

  const inDebt = Boolean(state.telemetry.inDebt) || state.credits < 0;

  // Compute live operational advisories (real actionable triggers, zero filler)
  const advisories = useMemo(() => {
    const items: {
      id: string;
      tone: 'critical' | 'warning' | 'info';
      title: string;
      detail: string;
      actionLabel: string;
      section: MainSection;
    }[] = [];

    if (inDebt) {
      items.push({
        id: 'adv_debt',
        tone: 'critical',
        title: 'Operating Credit Deficit',
        detail: 'Capital builds and chip tape-outs are paused until treasury returns above 0 CR.',
        actionLabel: 'Inspect Finances',
        section: 'finances',
      });
    }
    if (state.telemetry.powerDeficit) {
      items.push({
        id: 'adv_power',
        tone: 'critical',
        title: 'Electrical Grid Overload',
        detail: `Fabs are throttled (${state.telemetry.powerUsedMW.toFixed(0)} / ${state.telemetry.powerCapacityMW.toFixed(0)} MW). Commission a Power Substation.`,
        actionLabel: 'Build Power Plant',
        section: 'infrastructure',
      });
    } else if (state.telemetry.siliconStarved) {
      items.push({
        id: 'adv_si',
        tone: 'warning',
        title: 'Silicon Feedstock Starvation',
        detail: 'Wafer starts exceed refinery output. Expand Silicon Refineries to maintain full run rate.',
        actionLabel: 'Build Refinery',
        section: 'infrastructure',
      });
    } else if (state.telemetry.packagingStarved) {
      items.push({
        id: 'adv_pkg',
        tone: 'warning',
        title: 'OSAT Packaging Ceiling Reached',
        detail: 'Finished dies are queueing behind OSAT packaging capacity.',
        actionLabel: 'Expand OSAT',
        section: 'infrastructure',
      });
    }
    if (state.activeResearch.length < maxResearchSlots) {
      const openSlots = maxResearchSlots - state.activeResearch.length;
      items.push({
        id: 'adv_research',
        tone: 'info',
        title: `${openSlots} Open Research Slot${openSlots > 1 ? 's' : ''}`,
        detail: `Labs are generating +${state.telemetry.rpPerDay.toFixed(1)} RP/day (${state.activeResearch.length}/${maxResearchSlots} active).`,
        actionLabel: 'Queue Research',
        section: 'research',
      });
    }
    if (idleLines > 0) {
      items.push({
        id: 'adv_fab',
        tone: 'info',
        title: `${idleLines} Idle Wafer Fab Line${idleLines > 1 ? 's' : ''}`,
        detail: 'Assign a taped-out CPU, GPU, or Memory chip to monetize unused cleanroom capacity.',
        actionLabel: 'Assign Lines',
        section: 'manufacturing',
      });
    }
    return items.slice(0, 3);
  }, [
    inDebt,
    state.telemetry.powerDeficit,
    state.telemetry.powerUsedMW,
    state.telemetry.powerCapacityMW,
    state.telemetry.siliconStarved,
    state.telemetry.packagingStarved,
    state.telemetry.rpPerDay,
    state.activeResearch.length,
    maxResearchSlots,
    idleLines,
  ]);

  const filteredEvents = useMemo(() => {
    const list =
      chronicleFilter === 'all'
        ? state.events
        : state.events.filter((e) => e.category === chronicleFilter);
    return list.slice(0, 20);
  }, [state.events, chronicleFilter]);

  const powerPct = (state.telemetry.powerUsedMW / Math.max(1, state.telemetry.powerCapacityMW)) * 100;
  const siPct =
    (state.telemetry.monthlySiliconConsumed / Math.max(1, state.telemetry.monthlySiliconProd)) * 100;
  const pkgPct =
    (state.telemetry.packagingUsedPerMonth / Math.max(1, state.telemetry.packagingCapacityPerMonth)) *
    100;

  return (
    <div className="p-5 lg:p-6 max-w-[1480px] mx-auto space-y-5">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#1E293B] pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#E8EEF7] tracking-tight">Company Overview</h1>
            <StatusBadge
              tone={
                inDebt || state.telemetry.powerDeficit
                  ? 'critical'
                  : state.telemetry.siliconStarved || state.telemetry.packagingStarved
                    ? 'warning'
                    : 'nominal'
              }
              label={
                inDebt
                  ? 'In Debt'
                  : state.telemetry.powerDeficit
                    ? 'Power Deficit'
                    : state.telemetry.siliconStarved
                      ? 'Silicon Starved'
                      : state.telemetry.packagingStarved
                        ? 'OSAT Capped'
                        : 'Operations Nominal'
              }
            />
          </div>
          <p className="text-xs text-[#8C9BB2] mt-1 font-mono tabular-nums">
            {state.companyName} · {litho.name} · {waferDia} mm Wafer Standard · Global Silicon Monopoly
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('tech_tree')}
            className="h-9 px-3.5 rounded-md bg-[#06B6D4] hover:bg-[#22D3EE] text-[#06080D] text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Open Tech Tree</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('cpu_architect')}
            className="h-9 px-3 rounded-md bg-[#101521] hover:bg-[#161D2D] text-[#E8EEF7] border border-[#2C3B55] text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Cpu className="w-3.5 h-3.5 text-[#06B6D4]" />
            <span>Design CPU</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('memory_architect')}
            className="h-9 px-3 rounded-md bg-[#101521] hover:bg-[#161D2D] text-[#E8EEF7] border border-[#2C3B55] text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <HardDrive className="w-3.5 h-3.5 text-[#14B8A6]" />
            <span>Design Memory</span>
          </button>
        </div>
      </div>

      {/* Actionable Executive Advisories */}
      {advisories.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {advisories.map((adv) => (
            <div
              key={adv.id}
              className={`rounded-md border px-3.5 py-2.5 flex items-center justify-between gap-3 ${
                adv.tone === 'critical'
                  ? 'bg-rose-950/35 border-rose-500/40'
                  : adv.tone === 'warning'
                    ? 'bg-amber-950/30 border-amber-500/40'
                    : 'bg-[#101521] border-[#1E293B]'
              }`}
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#E8EEF7]">
                  {adv.tone !== 'info' && (
                    <AlertTriangle
                      className={`w-3.5 h-3.5 shrink-0 ${
                        adv.tone === 'critical' ? 'text-rose-400' : 'text-amber-400'
                      }`}
                    />
                  )}
                  <span className="truncate">{adv.title}</span>
                </div>
                <p className="text-[11px] text-[#8C9BB2] truncate">{adv.detail}</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate(adv.section)}
                className="h-7 px-2.5 rounded bg-[#0A0E16] hover:bg-[#161D2D] border border-[#2C3B55] text-[11px] font-medium text-[#22D3EE] flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>{adv.actionLabel}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Primary 4-KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => onNavigate('testing')}
          className="bg-[#101521] hover:bg-[#161D2D]/80 border border-[#1E293B] rounded-lg p-4 space-y-1 text-left transition-colors cursor-pointer"
        >
          <div className="text-xs text-[#8C9BB2]">Civilization Compute Index</div>
          <div className="text-2xl font-mono tabular-nums font-bold text-[#E8EEF7]">
            {state.civilizationComputeIndex.toLocaleString()}
          </div>
          <div className="text-xs text-[#8C9BB2] font-mono tabular-nums">
            Ecosystem Synergy {state.telemetry.activeChipEcosystemBonus.toFixed(2)}× / 1.68×
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('manufacturing')}
          className="bg-[#101521] hover:bg-[#161D2D]/80 border border-[#1E293B] rounded-lg p-4 space-y-1 text-left transition-colors cursor-pointer"
        >
          <div className="text-xs text-[#8C9BB2]">Good Silicon Shipped</div>
          <div className="text-2xl font-mono tabular-nums font-bold text-[#22D3EE]">
            {formatCompactNumber(state.telemetry.goodDiesPerMonth, 1)}
            <span className="text-xs font-normal text-[#8C9BB2] ml-1.5">dies/mo</span>
          </div>
          <div className="text-xs text-[#8C9BB2] font-mono tabular-nums">
            {activeLines.length}/{state.productionLines.length} active fab lines
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('finances')}
          className="bg-[#101521] hover:bg-[#161D2D]/80 border border-[#1E293B] rounded-lg p-4 space-y-1 text-left transition-colors cursor-pointer"
        >
          <div className="text-xs text-[#8C9BB2]">Net Monthly Credits</div>
          <div
            className={`text-2xl font-mono tabular-nums font-bold ${
              state.telemetry.monthlyCreditNet >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {state.telemetry.monthlyCreditNet >= 0 ? '+' : ''}
            {formatCompactNumber(state.telemetry.monthlyCreditNet, 1)}
            <span className="text-xs font-normal text-[#8C9BB2] ml-1.5">CR/mo</span>
          </div>
          <div className="text-xs text-[#8C9BB2] font-mono tabular-nums">
            Rev {formatCompactNumber(state.telemetry.monthlyCreditIncome, 1)} · OpEx{' '}
            {formatCompactNumber(
              state.telemetry.monthlyPayrollCR + state.telemetry.monthlyUpkeepCR,
              1
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('research')}
          className="bg-[#101521] hover:bg-[#161D2D]/80 border border-[#1E293B] rounded-lg p-4 space-y-1 text-left transition-colors cursor-pointer"
        >
          <div className="text-xs text-[#8C9BB2]">Research Output</div>
          <div className="text-2xl font-mono tabular-nums font-bold text-[#D97706]">
            +{state.telemetry.rpPerDay.toFixed(1)}
            <span className="text-xs font-normal text-[#8C9BB2] ml-1.5">RP/day</span>
          </div>
          <div className="text-xs text-[#8C9BB2] font-mono tabular-nums">
            {state.activeResearch.length}/{maxResearchSlots} active ·{' '}
            {formatCompactNumber(state.researchPointsBank, 0)} RP banked
          </div>
        </button>
      </div>

      {/* Main Asymmetric Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left 7 cols: Active Projects + Interactive Trajectory Chart */}
        <div className="lg:col-span-7 space-y-5">
          {/* Active Operations Pipeline */}
          <div className="bg-[#101521] border border-[#1E293B] rounded-lg p-4 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[#E8EEF7]">Active Operations Pipeline</h2>
              <span className="text-xs text-[#8C9BB2] font-mono tabular-nums">
                {state.activeResearch.length} research · {state.tapeOutQueue.length} tape-out ·{' '}
                {state.constructionQueue.length} build
              </span>
            </div>

            {state.activeResearch.length === 0 &&
            state.tapeOutQueue.length === 0 &&
            state.constructionQueue.length === 0 ? (
              <div className="p-4 rounded-md bg-[#0A0E16] border border-[#1E293B] flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-[#8C9BB2]">
                  No active research, tape-out, or construction queues. Excess lab output is banking into Research Points.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('research')}
                  className="text-xs font-medium text-[#22D3EE] hover:text-[#67E8F9] flex items-center gap-1 whitespace-nowrap cursor-pointer"
                >
                  <span>Start Research</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {state.activeResearch.map((proj) => {
                  const tech = getTechNode(proj.techId);
                  const pct = Math.min(100, (proj.progressRp / proj.totalRp) * 100);
                  const rate = researchRates[proj.techId] ?? state.telemetry.rpPerDay;
                  const etaDays = Math.ceil((proj.totalRp - proj.progressRp) / Math.max(0.1, rate));
                  return (
                    <div
                      key={proj.techId}
                      className="p-3 rounded-md bg-[#0A0E16] border border-[#1E293B] space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() =>
                            onJumpToTech ? onJumpToTech(proj.techId) : onNavigate('research')
                          }
                          className="font-medium text-[#E8EEF7] hover:text-[#22D3EE] flex items-center gap-1.5 truncate cursor-pointer text-left"
                        >
                          <FlaskConical className="w-3.5 h-3.5 text-[#06B6D4] shrink-0" />
                          <span className="truncate">{tech?.name ?? proj.techId}</span>
                        </button>
                        <span className="font-mono tabular-nums text-[#8C9BB2] shrink-0">
                          {Math.round(proj.progressRp).toLocaleString()} / {proj.totalRp.toLocaleString()} RP · ~{etaDays}d
                        </span>
                      </div>
                      <MeterBar value={pct} max={100} tone="cyan" height="sm" />
                    </div>
                  );
                })}

                {state.tapeOutQueue.map((job) => {
                  const pct = Math.min(100, (job.daysCompleted / job.totalDays) * 100);
                  const calDaysLeft = Math.ceil(
                    (job.totalDays - job.daysCompleted) / Math.max(0.5, staffImpact.tapeOutSpeedMult)
                  );
                  return (
                    <div
                      key={job.id}
                      className="p-3 rounded-md bg-[#0A0E16] border border-[#1E293B] space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => onNavigate('manufacturing')}
                          className="font-medium text-[#E8EEF7] hover:text-[#FBBF24] flex items-center gap-1.5 truncate cursor-pointer"
                        >
                          <Cpu className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
                          <span className="truncate">
                            Tape-Out: {job.chipName} ({job.kind.toUpperCase()})
                          </span>
                        </button>
                        <span className="font-mono tabular-nums text-[#8C9BB2] shrink-0">
                          ~{calDaysLeft}d left ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <MeterBar value={pct} max={100} tone="amber" height="sm" />
                    </div>
                  );
                })}

                {state.constructionQueue.map((job) => {
                  const pct = Math.min(100, (job.daysCompleted / job.totalDays) * 100);
                  return (
                    <div
                      key={job.id}
                      className="p-3 rounded-md bg-[#0A0E16] border border-[#1E293B] space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => onNavigate('infrastructure')}
                          className="font-medium text-[#E8EEF7] hover:text-emerald-300 flex items-center gap-1.5 truncate cursor-pointer"
                        >
                          <Factory className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">Build: {job.name}</span>
                        </button>
                        <span className="font-mono tabular-nums text-[#8C9BB2] shrink-0">
                          {Math.ceil(job.totalDays - job.daysCompleted)}d left ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <MeterBar value={pct} max={100} tone="emerald" height="sm" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Interactive Trajectory Chart */}
          <div className="bg-[#101521] border border-[#1E293B] rounded-lg p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[#E8EEF7]">Trajectory Telemetry</h2>
                <p className="text-[11px] text-[#64748B]">Hover across the timeline to inspect exact monthly snapshots</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center bg-[#0A0E16] border border-[#1E293B] rounded p-0.5">
                  {(Object.keys(TREND_METRIC_META) as TrendMetric[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setChartMetric(m)}
                      className={`px-2 py-1 text-[11px] rounded cursor-pointer whitespace-nowrap transition-colors ${
                        chartMetric === m
                          ? 'bg-[#161D2D] text-[#E8EEF7] font-medium'
                          : 'text-[#8C9BB2] hover:text-[#E8EEF7]'
                      }`}
                    >
                      {TREND_METRIC_META[m].shortLabel}
                    </button>
                  ))}
                </div>
                <div className="flex items-center bg-[#0A0E16] border border-[#1E293B] rounded p-0.5">
                  <button
                    type="button"
                    onClick={() => setChartSpan('monthly')}
                    className={`px-2 py-1 text-[11px] rounded cursor-pointer whitespace-nowrap ${
                      chartSpan === 'monthly'
                        ? 'bg-[#161D2D] text-[#E8EEF7]'
                        : 'text-[#8C9BB2] hover:text-[#E8EEF7]'
                    }`}
                  >
                    Recent
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartSpan('long')}
                    className={`px-2 py-1 text-[11px] rounded cursor-pointer whitespace-nowrap ${
                      chartSpan === 'long'
                        ? 'bg-[#161D2D] text-[#E8EEF7]'
                        : 'text-[#8C9BB2] hover:text-[#E8EEF7]'
                    }`}
                  >
                    All Eras
                  </button>
                </div>
              </div>
            </div>
            <div className="bg-[#06080D] border border-[#1E293B] rounded-md p-2">
              <TrendChartSVG data={chartData} metric={chartMetric} />
            </div>
          </div>
        </div>

        {/* Right 5 cols: Resource Utilization, Full-Stack Ecosystem & Filterable Chronicle */}
        <div className="lg:col-span-5 space-y-5">
          {/* Physical Resource Utilization */}
          <div className="bg-[#101521] border border-[#1E293B] rounded-lg p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#E8EEF7]">Physical Resource Balance</h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('infrastructure')}
                  className="text-xs text-[#8C9BB2] hover:text-[#E8EEF7] flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <Layers className="w-3 h-3" />
                  <span>Infra</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('manufacturing')}
                  className="text-xs text-[#22D3EE] hover:text-[#67E8F9] cursor-pointer whitespace-nowrap"
                >
                  Manage Fabs
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <MeterBar
                label="Grid Electrical Load"
                value={powerPct}
                max={100}
                valueLabel={`${state.telemetry.powerUsedMW.toFixed(1)} / ${state.telemetry.powerCapacityMW.toFixed(0)} MW`}
                tone={state.telemetry.powerDeficit ? 'rose' : powerPct > 85 ? 'amber' : 'cyan'}
                markers={[
                  { value: 85, tone: 'amber' },
                  { value: 100, tone: 'rose' },
                ]}
              />
              <MeterBar
                label="Silicon Feedstock Utilization"
                value={siPct}
                max={100}
                valueLabel={`${formatCompactNumber(state.telemetry.monthlySiliconConsumed, 0)} / ${formatCompactNumber(state.telemetry.monthlySiliconProd, 0)} Si/mo`}
                tone={state.telemetry.siliconStarved ? 'amber' : 'emerald'}
                markers={[{ value: 100, tone: 'amber' }]}
              />
              <MeterBar
                label="OSAT Packaging Capacity"
                value={pkgPct}
                max={100}
                valueLabel={`${formatCompactNumber(state.telemetry.packagingUsedPerMonth, 0)} / ${formatCompactNumber(state.telemetry.packagingCapacityPerMonth, 0)} pkg/mo`}
                tone={state.telemetry.packagingStarved ? 'amber' : 'teal'}
                markers={[{ value: 100, tone: 'amber' }]}
              />
            </div>
          </div>

          {/* Silicon Division Product Mix & Full-Stack Ecosystem Synergy */}
          <div className="bg-[#101521] border border-[#1E293B] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[#E8EEF7]">Full-Stack Silicon Ecosystem</h2>
              <span className="text-xs font-mono tabular-nums text-[#22D3EE]">
                {state.telemetry.activeChipEcosystemBonus.toFixed(2)}× / 1.68×
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                {
                  label: 'Compute CPUs',
                  active: Boolean(state.telemetry.hasActiveCpu),
                  bonus: 'Core Demand',
                  section: 'cpu_architect' as MainSection,
                },
                {
                  label: 'Graphics GPUs',
                  active: Boolean(state.telemetry.hasActiveGpu),
                  bonus: '+0.32× w/ CPU',
                  section: 'gpu_architect' as MainSection,
                },
                {
                  label: 'System RAM / VRAM',
                  active: Boolean(state.telemetry.hasActiveMemory),
                  bonus: '+0.18× Synergy',
                  section: 'memory_architect' as MainSection,
                },
                {
                  label: 'Solid-State Storage',
                  active: Boolean(state.telemetry.hasActiveStorage),
                  bonus: '+0.18× Synergy',
                  section: 'memory_architect' as MainSection,
                },
              ].map((div) => (
                <button
                  key={div.label}
                  type="button"
                  onClick={() => onNavigate(div.section)}
                  className={`p-2.5 rounded-md border text-left transition-colors cursor-pointer ${
                    div.active
                      ? 'bg-[#0E2430]/55 border-[#14B8A6]/45'
                      : 'bg-[#0A0E16] border-[#1E293B] hover:border-[#2C3B55]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-medium text-[#E8EEF7] truncate">{div.label}</span>
                    <StatusBadge
                      tone={div.active ? 'nominal' : 'muted'}
                      label={div.active ? 'Live' : 'Idle'}
                      compact
                    />
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-[#8C9BB2] mt-0.5">
                    {div.bonus}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-[#1E293B] font-mono tabular-nums">
              <span className="text-[#8C9BB2] font-sans">Memory &amp; Storage Shipped</span>
              <span className="text-[#14B8A6] font-semibold">
                {(() => {
                  const memTB = state.telemetry.monthlyMemoryCapacityTB ?? 0;
                  if (memTB >= 100) return `${formatCompactNumber(memTB, 1)} TB/mo`;
                  if (memTB >= 1) return `${memTB.toFixed(2)} TB/mo`;
                  if (memTB > 0) return `${(memTB * 1024).toFixed(1)} GB/mo`;
                  return '0.0 GB/mo';
                })()}
              </span>
            </div>
          </div>

          {/* Filterable Empire Chronicle */}
          <div className="bg-[#101521] border border-[#1E293B] rounded-lg p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[#E8EEF7]">Empire Chronicle</h2>
              <div className="flex items-center bg-[#0A0E16] border border-[#1E293B] rounded p-0.5">
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'research', label: 'R&D' },
                    { id: 'tapeout', label: 'Tape-Out' },
                    { id: 'construction', label: 'Builds' },
                    { id: 'warning', label: 'Alerts' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setChronicleFilter(tab.id)}
                    className={`px-2 py-0.5 text-[11px] rounded cursor-pointer whitespace-nowrap ${
                      chronicleFilter === tab.id
                        ? 'bg-[#161D2D] text-[#E8EEF7]'
                        : 'text-[#8C9BB2] hover:text-[#E8EEF7]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-[#1E293B] max-h-[290px] overflow-y-auto pr-1">
              {filteredEvents.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#64748B]">
                  No chronicle entries in this category yet.
                </div>
              ) : (
                filteredEvents.map((evt) => (
                  <button
                    key={evt.id}
                    type="button"
                    onClick={() => onNavigate(sectionForEventCategory(evt.category))}
                    className="w-full py-2.5 first:pt-0 text-left hover:bg-[#161D2D]/40 transition-colors rounded px-1 -mx-1 space-y-0.5 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-xs font-medium truncate ${
                          evt.category === 'warning' ? 'text-amber-300' : 'text-[#E8EEF7]'
                        }`}
                      >
                        {evt.title}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-[#64748B] shrink-0">
                        {formatSimDate(evt.year, evt.month, evt.day)}
                      </span>
                    </div>
                    <p className="text-xs text-[#8C9BB2] leading-relaxed">{evt.detail}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
