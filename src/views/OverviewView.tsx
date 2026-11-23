import React, { useState } from 'react';
import { ArrowRight, Cpu, FlaskConical, Factory, GitBranch, HardDrive } from 'lucide-react';
import { getBestLithography, getMaxWaferDiameterMm, getTechNode } from '../engine/catalog';
import { formatCompactNumber, formatSimDate } from '../engine/simulation';
import type { GameState, HistoryPoint, MainSection } from '../engine/types';

interface OverviewViewProps {
  state: GameState;
  onNavigate: (section: MainSection) => void;
}

const TrendChartSVG: React.FC<{ data: HistoryPoint[]; metric: 'computeIndex' | 'credits' }> = ({
  data,
  metric,
}) => {
  if (data.length < 2) {
    return (
      <div className="h-[170px] flex items-center justify-center text-xs text-[#64748B]">
        Unpause the simulation to begin recording monthly foundry telemetry.
      </div>
    );
  }

  const w = 620;
  const h = 160;
  const padX = 12;
  const padY = 16;

  const vals = data.map((d) => d[metric]);
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals, minVal + 1);

  const pts = data.map((d, i) => {
    const x = padX + (i / (data.length - 1)) * (w - padX * 2);
    const y = h - padY - ((d[metric] - minVal) / (maxVal - minVal)) * (h - padY * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const strokeColor = metric === 'computeIndex' ? '#06B6D4' : '#D97706';
  const fillPath = `M ${padX},${h - padY} L ${pts.join(' L ')} L ${w - padX},${h - padY} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[170px]" role="img" aria-label="Historical trend chart">
      <defs>
        <linearGradient id={`grad_${metric}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.22" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((frac) => {
        const y = padY + frac * (h - padY * 2);
        return (
          <line
            key={frac}
            x1={padX}
            x2={w - padX}
            y1={y}
            y2={y}
            stroke="#1F2A3D"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        );
      })}
      <path d={fillPath} fill={`url(#grad_${metric})`} />
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        points={pts.join(' ')}
      />
      <text x={padX} y="12" fill="#8C9BB2" fontSize="10" fontFamily="ui-monospace, SFMono-Regular, Consolas, Menlo, monospace">
        Max: {formatCompactNumber(maxVal, 1)}
      </text>
      <text
        x={w - padX}
        y="12"
        textAnchor="end"
        fill="#8C9BB2"
        fontSize="10"
        fontFamily="ui-monospace, SFMono-Regular, Consolas, Menlo, monospace"
      >
        Y{String(data[0].year).padStart(4, '0')} – Y{String(data[data.length - 1].year).padStart(4, '0')}
      </text>
    </svg>
  );
};

export const OverviewView: React.FC<OverviewViewProps> = ({ state, onNavigate }) => {
  const [chartMetric, setChartMetric] = useState<'computeIndex' | 'credits'>('computeIndex');
  const [chartSpan, setChartSpan] = useState<'monthly' | 'long'>('monthly');

  const litho = getBestLithography(state.unlockedTechIds);
  const waferDia = getMaxWaferDiameterMm(state.unlockedTechIds);
  const activeLines = state.productionLines.filter((l) => l.chipId !== null);
  const chartData = chartSpan === 'monthly' ? state.monthlyHistory : state.longTermHistory;

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#1F2A3D] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E8EEF7] tracking-tight">Company Overview</h1>
          <p className="text-sm text-[#8C9BB2] mt-0.5">
            {state.companyName} · {litho.name} · {waferDia} mm Wafer Standard · Global Monopoly
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('tech_tree')}
            className="h-9 px-3.5 rounded-md bg-[#06B6D4] hover:bg-[#22D3EE] text-[#07090E] text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Open Tech Tree</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('cpu_architect')}
            className="h-9 px-3.5 rounded-md bg-[#111622] hover:bg-[#171E2E] text-[#E8EEF7] border border-[#2C3B55] text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Cpu className="w-3.5 h-3.5 text-[#06B6D4]" />
            <span>Design CPU</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('memory_architect')}
            className="h-9 px-3.5 rounded-md bg-[#111622] hover:bg-[#171E2E] text-[#E8EEF7] border border-[#2C3B55] text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <HardDrive className="w-3.5 h-3.5 text-[#14B8A6]" />
            <span>Design Memory</span>
          </button>
        </div>
      </div>

      {/* Primary 4-KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-4 space-y-1">
          <div className="text-xs text-[#8C9BB2]">Civilization Compute Index</div>
          <div className="text-2xl font-mono tabular-nums font-bold text-[#E8EEF7]">
            {state.civilizationComputeIndex.toLocaleString()}
          </div>
          <div className="text-xs text-[#8C9BB2] font-mono tabular-nums">
            Ecosystem Multiplier {state.telemetry.activeChipEcosystemBonus.toFixed(2)}×
          </div>
        </div>

        <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-4 space-y-1">
          <div className="text-xs text-[#8C9BB2]">Good Silicon Shipped</div>
          <div className="text-2xl font-mono tabular-nums font-bold text-[#22D3EE]">
            {formatCompactNumber(state.telemetry.goodDiesPerMonth, 1)}
            <span className="text-xs font-normal text-[#8C9BB2] ml-1.5">dies/mo</span>
          </div>
          <div className="text-xs text-[#8C9BB2] font-mono tabular-nums">
            {activeLines.length} active fab line{activeLines.length === 1 ? '' : 's'}
          </div>
        </div>

        <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-4 space-y-1">
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
            Demand {formatCompactNumber(state.telemetry.monthlyCreditIncome, 1)} · OpEx{' '}
            {formatCompactNumber(
              state.telemetry.monthlyPayrollCR + state.telemetry.monthlyUpkeepCR,
              1
            )}
          </div>
        </div>

        <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-4 space-y-1">
          <div className="text-xs text-[#8C9BB2]">Research Output</div>
          <div className="text-2xl font-mono tabular-nums font-bold text-[#D97706]">
            +{state.telemetry.rpPerDay.toFixed(1)}
            <span className="text-xs font-normal text-[#8C9BB2] ml-1.5">RP/day</span>
          </div>
          <div className="text-xs text-[#8C9BB2] font-mono tabular-nums">
            {state.activeResearch.length} active · {formatCompactNumber(state.researchPointsBank, 0)} RP banked
          </div>
        </div>
      </div>

      {/* Main Asymmetric Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 cols: Active Projects + Historical Trend Chart */}
        <div className="lg:col-span-7 space-y-6">
          {/* Active Operations Pipeline */}
          <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#E8EEF7]">Active Operations Pipeline</h2>
              <span className="text-xs text-[#8C9BB2] font-mono tabular-nums">
                {state.activeResearch.length} research · {state.tapeOutQueue.length} tape-out ·{' '}
                {state.constructionQueue.length} build
              </span>
            </div>

            {state.activeResearch.length === 0 &&
            state.tapeOutQueue.length === 0 &&
            state.constructionQueue.length === 0 ? (
              <div className="p-4 rounded-md bg-[#0B0F17] border border-[#1F2A3D] flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-[#8C9BB2]">
                  No active engineering or research projects queued. Excess lab output is banking into Research Points.
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
              <div className="space-y-3">
                {state.activeResearch.map((proj) => {
                  const tech = getTechNode(proj.techId);
                  const pct = Math.min(100, (proj.progressRp / proj.totalRp) * 100);
                  return (
                    <div
                      key={proj.techId}
                      className="p-3 rounded-md bg-[#0B0F17] border border-[#1F2A3D] space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[#E8EEF7] flex items-center gap-1.5">
                          <FlaskConical className="w-3.5 h-3.5 text-[#06B6D4]" />
                          {tech?.name ?? proj.techId}
                        </span>
                        <span className="font-mono tabular-nums text-[#8C9BB2]">
                          {Math.round(proj.progressRp)} / {proj.totalRp} RP ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-1.5 bg-[#171E2E] rounded overflow-hidden">
                        <div
                          className="h-full bg-[#06B6D4] transition-all duration-150"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}

                {state.tapeOutQueue.map((job) => {
                  const pct = Math.min(100, (job.daysCompleted / job.totalDays) * 100);
                  return (
                    <div
                      key={job.id}
                      className="p-3 rounded-md bg-[#0B0F17] border border-[#1F2A3D] space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[#E8EEF7] flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-[#D97706]" />
                          Tape-Out: {job.chipName} ({job.kind.toUpperCase()})
                        </span>
                        <span className="font-mono tabular-nums text-[#8C9BB2]">
                          {Math.ceil(job.totalDays - job.daysCompleted)}d left ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-1.5 bg-[#171E2E] rounded overflow-hidden">
                        <div
                          className="h-full bg-[#D97706] transition-all duration-150"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}

                {state.constructionQueue.map((job) => {
                  const pct = Math.min(100, (job.daysCompleted / job.totalDays) * 100);
                  return (
                    <div
                      key={job.id}
                      className="p-3 rounded-md bg-[#0B0F17] border border-[#1F2A3D] space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[#E8EEF7] flex items-center gap-1.5">
                          <Factory className="w-3.5 h-3.5 text-emerald-400" />
                          Construction: {job.name}
                        </span>
                        <span className="font-mono tabular-nums text-[#8C9BB2]">
                          {Math.ceil(job.totalDays - job.daysCompleted)}d left ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-1.5 bg-[#171E2E] rounded overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-150"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bounded Trajectory Chart */}
          <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[#E8EEF7]">Trajectory Telemetry</h2>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-[#0B0F17] border border-[#1F2A3D] rounded p-0.5">
                  <button
                    type="button"
                    onClick={() => setChartMetric('computeIndex')}
                    className={`px-2 py-1 text-xs rounded cursor-pointer whitespace-nowrap ${
                      chartMetric === 'computeIndex'
                        ? 'bg-[#171E2E] text-[#22D3EE]'
                        : 'text-[#8C9BB2] hover:text-[#E8EEF7]'
                    }`}
                  >
                    Compute Index
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMetric('credits')}
                    className={`px-2 py-1 text-xs rounded cursor-pointer whitespace-nowrap ${
                      chartMetric === 'credits'
                        ? 'bg-[#171E2E] text-[#FBBF24]'
                        : 'text-[#8C9BB2] hover:text-[#E8EEF7]'
                    }`}
                  >
                    Credits
                  </button>
                </div>
                <div className="flex items-center bg-[#0B0F17] border border-[#1F2A3D] rounded p-0.5">
                  <button
                    type="button"
                    onClick={() => setChartSpan('monthly')}
                    className={`px-2 py-1 text-xs rounded cursor-pointer whitespace-nowrap ${
                      chartSpan === 'monthly'
                        ? 'bg-[#171E2E] text-[#E8EEF7]'
                        : 'text-[#8C9BB2] hover:text-[#E8EEF7]'
                    }`}
                  >
                    Recent
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartSpan('long')}
                    className={`px-2 py-1 text-xs rounded cursor-pointer whitespace-nowrap ${
                      chartSpan === 'long'
                        ? 'bg-[#171E2E] text-[#E8EEF7]'
                        : 'text-[#8C9BB2] hover:text-[#E8EEF7]'
                    }`}
                  >
                    All Eras
                  </button>
                </div>
              </div>
            </div>
            <div className="bg-[#07090E] border border-[#1F2A3D] rounded-md p-2">
              <TrendChartSVG data={chartData} metric={chartMetric} />
            </div>
          </div>
        </div>

        {/* Right 5 cols: Resource Utilization & Milestone Chronicle */}
        <div className="lg:col-span-5 space-y-6">
          {/* Physical Resource Utilization */}
          <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#E8EEF7]">Physical Resource Balance</h2>
              <button
                type="button"
                onClick={() => onNavigate('manufacturing')}
                className="text-xs text-[#22D3EE] hover:text-[#67E8F9] cursor-pointer whitespace-nowrap"
              >
                Manage Fabs
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[#8C9BB2]">Grid Electrical Load</span>
                  <span className="font-mono tabular-nums text-[#E8EEF7]">
                    {state.telemetry.powerUsedMW.toFixed(1)} / {state.telemetry.powerCapacityMW.toFixed(0)} MW
                  </span>
                </div>
                <div className="h-1.5 bg-[#0B0F17] rounded overflow-hidden">
                  <div
                    className={`h-full ${
                      state.telemetry.powerDeficit ? 'bg-rose-500' : 'bg-[#06B6D4]'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        (state.telemetry.powerUsedMW / Math.max(1, state.telemetry.powerCapacityMW)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[#8C9BB2]">Silicon Feedstock Utilization</span>
                  <span className="font-mono tabular-nums text-[#E8EEF7]">
                    {formatCompactNumber(state.telemetry.monthlySiliconConsumed, 0)} /{' '}
                    {formatCompactNumber(state.telemetry.monthlySiliconProd, 0)} Si/mo
                  </span>
                </div>
                <div className="h-1.5 bg-[#0B0F17] rounded overflow-hidden">
                  <div
                    className={`h-full ${
                      state.telemetry.siliconStarved ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        (state.telemetry.monthlySiliconConsumed /
                          Math.max(1, state.telemetry.monthlySiliconProd)) *
                          100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[#8C9BB2]">OSAT Packaging Capacity</span>
                  <span className="font-mono tabular-nums text-[#E8EEF7]">
                    {formatCompactNumber(state.telemetry.packagingUsedPerMonth, 0)} /{' '}
                    {formatCompactNumber(state.telemetry.packagingCapacityPerMonth, 0)} pkg/mo
                  </span>
                </div>
                <div className="h-1.5 bg-[#0B0F17] rounded overflow-hidden">
                  <div
                    className={`h-full ${
                      state.telemetry.packagingStarved ? 'bg-amber-500' : 'bg-[#D97706]'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        (state.telemetry.packagingUsedPerMonth /
                          Math.max(1, state.telemetry.packagingCapacityPerMonth)) *
                          100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Silicon Division Product Mix & Full-Stack Ecosystem Synergy */}
          <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[#E8EEF7]">
                Full-Stack Silicon Ecosystem
              </h2>
              <span className="text-xs font-mono tabular-nums text-[#22D3EE]">
                {state.telemetry.activeChipEcosystemBonus.toFixed(2)}× / 1.68×
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                {
                  label: 'Compute CPUs',
                  active: state.telemetry.hasActiveCpu,
                  bonus: 'Core Demand',
                  section: 'cpu_architect' as MainSection,
                },
                {
                  label: 'Graphics GPUs',
                  active: state.telemetry.hasActiveGpu,
                  bonus: '+0.32× w/ CPU',
                  section: 'gpu_architect' as MainSection,
                },
                {
                  label: 'System RAM / VRAM',
                  active: state.telemetry.hasActiveMemory,
                  bonus: '+0.18× Synergy',
                  section: 'memory_architect' as MainSection,
                },
                {
                  label: 'Solid-State Storage',
                  active: state.telemetry.hasActiveStorage,
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
                      ? 'bg-[#0E2430]/60 border-[#14B8A6]/50'
                      : 'bg-[#0B0F17] border-[#1F2A3D] hover:border-[#2C3B55]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-medium text-[#E8EEF7] truncate">{div.label}</span>
                    <span
                      className={`font-mono text-[10px] shrink-0 ${
                        div.active ? 'text-emerald-400' : 'text-[#64748B]'
                      }`}
                    >
                      {div.active ? 'SHIPPING' : 'IDLE'}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-[#8C9BB2] mt-0.5">
                    {div.bonus}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-[#1F2A3D] font-mono tabular-nums">
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

          {/* Engineering Chronicle */}
          <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-5 space-y-3">
            <h2 className="text-sm font-semibold text-[#E8EEF7]">Empire Chronicle</h2>
            <div className="divide-y divide-[#1F2A3D] max-h-[300px] overflow-y-auto pr-1">
              {state.events.slice(0, 14).map((evt) => (
                <div key={evt.id} className="py-2.5 first:pt-0 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-[#E8EEF7]">{evt.title}</span>
                    <span className="text-[11px] font-mono tabular-nums text-[#64748B] shrink-0">
                      {formatSimDate(evt.year, evt.month, evt.day)}
                    </span>
                  </div>
                  <p className="text-xs text-[#8C9BB2] leading-relaxed">{evt.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
