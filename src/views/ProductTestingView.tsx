import React, { useEffect, useMemo, useState } from 'react';
import { Archive, ArrowUpDown, Copy, GitCompare, RotateCcw } from 'lucide-react';
import { MeterBar } from '../components/ui/MeterBar';
import { StatusBadge } from '../components/ui/StatusBadge';
import {
  getCpuArch,
  getGpuArch,
  getMemoryCellArch,
  getProcessNode,
  MEMORY_CATEGORY_META,
} from '../engine/catalog';
import { evaluateChip } from '../engine/physics';
import { buildPreviewPhysicsContext, formatCompactNumber } from '../engine/simulation';
import type { ChipBenchmarkReport, ChipBlueprint, ChipEvaluation, GameState } from '../engine/types';
import { formatLatencyNs, formatMemoryCapacity } from './MemoryArchitectView';

interface ProductTestingViewProps {
  state: GameState;
  initialSelectedId?: string;
  onArchiveChip: (chipId: string) => void;
  onRestoreChip?: (chipId: string) => void;
  onLoadIntoArchitect: (chip: ChipBlueprint) => void;
}

interface BenchMetricRow {
  key: keyof Pick<
    ChipBenchmarkReport,
    | 'singleCoreCpu'
    | 'multiCoreCpu'
    | 'generalComputing'
    | 'memoryPerformance'
    | 'gamingRendering'
    | 'gpuCompute'
    | 'powerEfficiency'
    | 'thermalPerformance'
  >;
  label: string;
  short: string;
}

const BENCH_METRICS: BenchMetricRow[] = [
  { key: 'singleCoreCpu', label: 'Single-Core CPU', short: 'SC CPU' },
  { key: 'multiCoreCpu', label: 'Multi-Core CPU', short: 'MC CPU' },
  { key: 'generalComputing', label: 'General Computing', short: 'Compute' },
  { key: 'memoryPerformance', label: 'Memory Bandwidth', short: 'Memory' },
  { key: 'gamingRendering', label: 'Gaming & Rendering', short: 'Render' },
  { key: 'gpuCompute', label: 'GPU Parallel Compute', short: 'GPU Comp' },
  { key: 'powerEfficiency', label: 'Power Efficiency (Perf/W)', short: 'Perf/W' },
  { key: 'thermalPerformance', label: 'Thermal Endurance', short: 'Thermal' },
];

type CatalogSortKey = 'rating' | 'area' | 'power' | 'yield';

const BenchmarkRadarSVG: React.FC<{
  primary: ChipBenchmarkReport;
  primaryName: string;
  compare?: ChipBenchmarkReport;
  compareName?: string;
  hoveredKey: BenchMetricRow['key'] | null;
  onHoverKey: (key: BenchMetricRow['key'] | null) => void;
}> = ({ primary, primaryName, compare, compareName, hoveredKey, onHoverKey }) => {
  const cx = 150;
  const cy = 140;
  const radius = 98;

  const norm = (val: number, maxVal: number) => {
    if (val <= 0) return 0.05;
    const lv = Math.log10(1 + val);
    const lm = Math.log10(1 + Math.max(maxVal, 50));
    return Math.max(0.08, Math.min(1, lv / lm));
  };

  const axisMax = BENCH_METRICS.map((m) =>
    Math.max(primary[m.key], compare ? compare[m.key] : 0, 100)
  );

  const buildPoints = (report: ChipBenchmarkReport) =>
    BENCH_METRICS.map((m, idx) => {
      const angle = (Math.PI * 2 * idx) / BENCH_METRICS.length - Math.PI / 2;
      const r = radius * norm(report[m.key], axisMax[idx]);
      return {
        key: m.key,
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
      };
    });

  const primaryPts = buildPoints(primary);
  const comparePts = compare ? buildPoints(compare) : null;

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 300 280"
        className="w-full max-w-[316px] select-none"
        role="img"
        aria-label="8-axis benchmark radar chart"
      >
        {[0.25, 0.5, 0.75, 1.0].map((lvl) => (
          <polygon
            key={lvl}
            fill="none"
            stroke="#1E293B"
            strokeWidth="1"
            points={BENCH_METRICS.map((_, idx) => {
              const angle = (Math.PI * 2 * idx) / BENCH_METRICS.length - Math.PI / 2;
              const r = radius * lvl;
              return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`;
            }).join(' ')}
          />
        ))}

        {BENCH_METRICS.map((m, idx) => {
          const angle = (Math.PI * 2 * idx) / BENCH_METRICS.length - Math.PI / 2;
          const x2 = cx + radius * Math.cos(angle);
          const y2 = cy + radius * Math.sin(angle);
          const lx = cx + (radius + 21) * Math.cos(angle);
          const ly = cy + (radius + 16) * Math.sin(angle);
          const active = hoveredKey === m.key;
          return (
            <g
              key={m.key}
              className="cursor-pointer"
              onMouseEnter={() => onHoverKey(m.key)}
              onMouseLeave={() => onHoverKey(null)}
            >
              <line
                x1={cx}
                y1={cy}
                x2={x2}
                y2={y2}
                stroke={active ? '#06B6D4' : '#1E293B'}
                strokeWidth={active ? 1.5 : 1}
              />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={active ? '#22D3EE' : '#8C9BB2'}
                fontSize="8.5"
                fontWeight={active ? 700 : 500}
                fontFamily="ui-monospace, SFMono-Regular, Consolas, Menlo, monospace"
              >
                {m.short}
              </text>
            </g>
          );
        })}

        {comparePts && (
          <polygon
            points={comparePts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
            fill="#D97706"
            fillOpacity="0.16"
            stroke="#D97706"
            strokeWidth="1.8"
            strokeDasharray="3 2"
          />
        )}

        <polygon
          points={primaryPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
          fill="#06B6D4"
          fillOpacity="0.22"
          stroke="#06B6D4"
          strokeWidth="2"
        />

        {primaryPts.map((p) => {
          const active = hoveredKey === p.key;
          return (
            <circle
              key={p.key}
              cx={p.x}
              cy={p.y}
              r={active ? 4.5 : 2.6}
              fill={active ? '#22D3EE' : '#06080D'}
              stroke="#06B6D4"
              strokeWidth="1.5"
              onMouseEnter={() => onHoverKey(p.key)}
              onMouseLeave={() => onHoverKey(null)}
              className="cursor-pointer"
            />
          );
        })}
      </svg>

      <div className="flex flex-wrap items-center justify-center gap-4 text-xs mt-1">
        <span className="text-[#22D3EE] font-medium">Primary: {primaryName}</span>
        {compareName && <span className="text-[#FBBF24] font-medium">Baseline: {compareName}</span>}
      </div>
    </div>
  );
};

export const ProductTestingView: React.FC<ProductTestingViewProps> = ({
  state,
  initialSelectedId,
  onArchiveChip,
  onRestoreChip,
  onLoadIntoArchitect,
}) => {
  const allTestable: ChipBlueprint[] = useMemo(() => {
    const list: ChipBlueprint[] = [state.cpuDraft];
    if (state.unlockedTechIds.includes('gpu_fixed_pipeline')) {
      list.push(state.gpuDraft);
    }
    list.push(state.memoryDraft);
    return [...list, ...state.chips];
  }, [state.cpuDraft, state.gpuDraft, state.memoryDraft, state.chips, state.unlockedTechIds]);

  const [primaryId, setPrimaryId] = useState<string>(
    initialSelectedId ?? allTestable[0]?.id ?? 'draft_cpu'
  );
  const [compareId, setCompareId] = useState<string>('');
  const [hoveredMetric, setHoveredMetric] = useState<BenchMetricRow['key'] | null>(null);
  const [catalogFilter, setCatalogFilter] = useState<'all' | 'cpu' | 'gpu' | 'memory' | 'archived'>('all');
  const [catalogSort, setCatalogSort] = useState<CatalogSortKey>('rating');

  // Keep primary selection synced whenever caller navigates with a new initialSelectedId
  useEffect(() => {
    if (initialSelectedId && allTestable.some((c) => c.id === initialSelectedId)) {
      setPrimaryId(initialSelectedId);
      setCompareId((prev) => (prev === initialSelectedId ? '' : prev));
    }
  }, [initialSelectedId, allTestable]);

  const primaryChip = allTestable.find((c) => c.id === primaryId) ?? allTestable[0];
  const compareChip =
    compareId && compareId !== primaryChip.id
      ? allTestable.find((c) => c.id === compareId)
      : undefined;

  const evalMap = useMemo(() => {
    const map = new Map<string, ChipEvaluation>();
    for (const c of allTestable) {
      const ctx = buildPreviewPhysicsContext(state, c.processNodeId, 1.0);
      map.set(c.id, evaluateChip(c, ctx));
    }
    return map;
  }, [allTestable, state]);

  const primaryEval = evalMap.get(primaryChip.id)!;
  const compareEval = compareChip ? evalMap.get(compareChip.id) : undefined;

  const bestSameKindChip = useMemo(() => {
    const candidates = state.chips.filter(
      (c) => c.kind === primaryChip.kind && c.id !== primaryChip.id && c.status === 'production'
    );
    if (candidates.length === 0) return null;
    return candidates.reduce((best, cur) => {
      const bScore = evalMap.get(best.id)?.benchmarks.overallRating ?? 0;
      const cScore = evalMap.get(cur.id)?.benchmarks.overallRating ?? 0;
      return cScore > bScore ? cur : best;
    });
  }, [state.chips, primaryChip.kind, primaryChip.id, evalMap]);

  const catalogRows = useMemo(() => {
    const list = state.chips.filter((c) => {
      if (catalogFilter === 'archived') return c.status === 'archived';
      if (c.status === 'archived') return false;
      if (catalogFilter === 'all') return true;
      return c.kind === catalogFilter;
    });
    return [...list].sort((a, b) => {
      const ea = evalMap.get(a.id);
      const eb = evalMap.get(b.id);
      if (!ea || !eb) return 0;
      if (catalogSort === 'area') return ea.physics.dieAreaMm2 - eb.physics.dieAreaMm2;
      if (catalogSort === 'power') return ea.physics.effectivePowerW - eb.physics.effectivePowerW;
      if (catalogSort === 'yield') return eb.physics.yieldPercent - ea.physics.yieldPercent;
      return eb.benchmarks.overallRating - ea.benchmarks.overallRating;
    });
  }, [state.chips, catalogFilter, catalogSort, evalMap]);

  const archLabel = (chip: ChipBlueprint) => {
    if (chip.kind === 'cpu') return getCpuArch(chip.architectureId).name;
    if (chip.kind === 'gpu') return getGpuArch(chip.architectureId).name;
    return `${MEMORY_CATEGORY_META[chip.memoryCategory].shortLabel} · ${getMemoryCellArch(chip.cellArchId).name}`;
  };

  const kindBadge = (chip: ChipBlueprint) =>
    chip.kind === 'memory'
      ? MEMORY_CATEGORY_META[chip.memoryCategory].shortLabel.toUpperCase()
      : chip.kind.toUpperCase();

  return (
    <div className="p-5 lg:p-6 max-w-[1480px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#1E293B] pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#E8EEF7] tracking-tight">
              Product Testing &amp; Diagnostics
            </h1>
            <StatusBadge
              tone={
                primaryEval.physics.exceedsReticle || primaryEval.physics.voltageUnstable
                  ? 'critical'
                  : primaryEval.physics.thermalThrottledRatio < 0.96
                    ? 'warning'
                    : 'nominal'
              }
              label={`Rating ${primaryEval.benchmarks.overallRating.toLocaleString()}`}
            />
          </div>
          <p className="text-xs text-[#8C9BB2] mt-1">
            8-workload validation suite, physical bottleneck diagnostics, and head-to-head architecture benchmarking
          </p>
        </div>

        {/* Selectors */}
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex items-center gap-2 text-xs text-[#8C9BB2]">
            <span>Primary:</span>
            <select
              value={primaryChip.id}
              onChange={(e) => {
                const nextId = e.target.value;
                setPrimaryId(nextId);
                if (compareId === nextId) setCompareId('');
              }}
              className="foundry-select h-9 px-2.5 rounded bg-[#101521] border border-[#2C3B55] text-xs text-[#E8EEF7] focus:border-[#06B6D4] focus:outline-none"
            >
              {allTestable.map((c) => (
                <option key={c.id} value={c.id}>
                  [{kindBadge(c)} · {c.status === 'draft' ? 'DRAFT' : c.status.toUpperCase()}] {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs text-[#8C9BB2]">
            <span>Compare:</span>
            <select
              value={compareChip?.id ?? ''}
              onChange={(e) => setCompareId(e.target.value)}
              className="foundry-select h-9 px-2.5 rounded bg-[#101521] border border-[#1E293B] text-xs text-[#E8EEF7] focus:border-[#D97706] focus:outline-none"
            >
              <option value="">None</option>
              {allTestable
                .filter((c) => c.id !== primaryChip.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    [{kindBadge(c)}] {c.name}
                  </option>
                ))}
            </select>
          </label>

          {bestSameKindChip && compareChip?.id !== bestSameKindChip.id && (
            <button
              type="button"
              onClick={() => setCompareId(bestSameKindChip.id)}
              className="h-9 px-3 rounded bg-[#101521] hover:bg-[#161D2D] border border-[#2C3B55] text-xs text-[#FBBF24] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>vs Best Shipping</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Testing Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left 7 cols: 8-Workload Benchmark Breakdown */}
        <div className="xl:col-span-7 space-y-5">
          <div className="bg-[#101521] border border-[#1E293B] rounded-lg p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E293B] pb-3">
              <div>
                <h2 className="text-base font-semibold text-[#E8EEF7]">{primaryChip.name}</h2>
                <p className="text-xs text-[#8C9BB2] font-mono tabular-nums mt-0.5">
                  {kindBadge(primaryChip)} · {getProcessNode(primaryChip.processNodeId).name} ·{' '}
                  {archLabel(primaryChip)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {primaryChip.status !== 'draft' && (
                  <>
                    <button
                      type="button"
                      onClick={() => onLoadIntoArchitect(primaryChip)}
                      className="h-8 px-2.5 rounded bg-[#161D2D] hover:bg-[#1E293B] border border-[#2C3B55] text-xs text-[#E8EEF7] flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-[#06B6D4]" />
                      <span>Clone to Architect</span>
                    </button>
                    {primaryChip.status === 'production' && (
                      <button
                        type="button"
                        onClick={() => onArchiveChip(primaryChip.id)}
                        className="h-8 px-2.5 rounded bg-[#0A0E16] hover:bg-rose-950/50 border border-[#1E293B] text-xs text-[#8C9BB2] hover:text-rose-300 flex items-center gap-1 whitespace-nowrap cursor-pointer"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>Archive</span>
                      </button>
                    )}
                    {primaryChip.status === 'archived' && onRestoreChip && (
                      <button
                        type="button"
                        onClick={() => onRestoreChip(primaryChip.id)}
                        className="h-8 px-2.5 rounded bg-[#0A0E16] hover:bg-emerald-950/50 border border-[#1E293B] text-xs text-emerald-400 flex items-center gap-1 whitespace-nowrap cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* 8 Scored Benchmark Bars (interactive hover synced with Radar Chart) */}
            <div className="space-y-2.5">
              {BENCH_METRICS.map((m) => {
                const pVal = primaryEval.benchmarks[m.key];
                const cVal = compareEval ? compareEval.benchmarks[m.key] : null;
                const scaleMax = Math.max(
                  pVal,
                  cVal ?? 0,
                  m.key === 'thermalPerformance' ? 100 : 10
                );
                const pPct = Math.min(100, (pVal / scaleMax) * 100);
                const cPct = cVal !== null ? Math.min(100, (cVal / scaleMax) * 100) : 0;
                const active = hoveredMetric === m.key;

                return (
                  <div
                    key={m.key}
                    onMouseEnter={() => setHoveredMetric(m.key)}
                    onMouseLeave={() => setHoveredMetric(null)}
                    className={`rounded px-2 py-1.5 -mx-2 transition-colors space-y-1 ${
                      active ? 'bg-[#161D2D]/70' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className={active ? 'text-[#E8EEF7] font-medium' : 'text-[#CBD5E1]'}>
                        {m.label}
                      </span>
                      <div className="font-mono tabular-nums flex items-center gap-3">
                        <span className="text-[#22D3EE] font-semibold">
                          {pVal.toLocaleString()}
                          {m.key === 'thermalPerformance' ? '/100' : ''}
                        </span>
                        {cVal !== null && (
                          <span className="text-[#FBBF24]">
                            vs {cVal.toLocaleString()}
                            {cVal > 0 && pVal > 0
                              ? ` (${pVal >= cVal ? '+' : ''}${Math.round(((pVal - cVal) / cVal) * 100)}%)`
                              : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <MeterBar value={pPct} max={100} tone="cyan" height="sm" />
                    {cVal !== null && <MeterBar value={cPct} max={100} tone="amber" height="sm" />}
                  </div>
                );
              })}
            </div>

            {/* Dedicated Memory & Storage Validation Scores */}
            {primaryChip.kind === 'memory' && (
              <div className="pt-4 border-t border-[#1E293B] space-y-2.5">
                <div className="text-xs font-semibold text-[#14B8A6]">
                  Memory &amp; Storage Subsystem Benchmarks
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono tabular-nums">
                  {[
                    {
                      label: 'Seq Throughput',
                      val: primaryEval.benchmarks.sequentialThroughput ?? 0,
                      cmp: compareEval?.benchmarks.sequentialThroughput,
                    },
                    {
                      label: 'Random Access',
                      val: primaryEval.benchmarks.randomAccessScore ?? 0,
                      cmp: compareEval?.benchmarks.randomAccessScore,
                    },
                    {
                      label: 'Storage Density',
                      val: primaryEval.benchmarks.storageDensityScore ?? 0,
                      cmp: compareEval?.benchmarks.storageDensityScore,
                    },
                    {
                      label: 'Endurance & ECC',
                      val: primaryEval.benchmarks.enduranceReliability ?? 0,
                      cmp: compareEval?.benchmarks.enduranceReliability,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="p-2.5 rounded bg-[#0A0E16] border border-[#1E293B] space-y-0.5"
                    >
                      <div className="text-[11px] font-sans text-[#8C9BB2]">{item.label}</div>
                      <div className="text-sm font-semibold text-[#E8EEF7]">
                        {item.val.toLocaleString()}
                      </div>
                      {item.cmp !== undefined && (
                        <div className="text-[10px] text-[#FBBF24]">
                          vs {item.cmp.toLocaleString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Plain-English Bottleneck Diagnostics */}
          <div className="bg-[#101521] border border-[#1E293B] rounded-lg p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[#E8EEF7]">Engineering Bottleneck Analysis</h2>
            <div className="space-y-2.5">
              {primaryEval.benchmarks.bottlenecks.map((b) => (
                <div
                  key={b.id}
                  className={`p-3.5 rounded-md border space-y-1 text-xs ${
                    b.severity === 'critical'
                      ? 'bg-rose-950/35 border-rose-500/40 text-rose-200'
                      : b.severity === 'warning'
                        ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                        : 'bg-[#0A0E16] border-[#1E293B] text-[#E8EEF7]'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <StatusBadge
                      tone={
                        b.severity === 'critical'
                          ? 'critical'
                          : b.severity === 'warning'
                            ? 'warning'
                            : 'nominal'
                      }
                      label={
                        b.severity === 'critical'
                          ? 'Critical'
                          : b.severity === 'warning'
                            ? 'Bottleneck'
                            : 'Nominal'
                      }
                      compact
                    />
                    <span>{b.title}</span>
                  </div>
                  <p className="text-[#CBD5E1] leading-relaxed">{b.explanation}</p>
                  <p className="text-[#8C9BB2]">
                    <span className="text-[#E8EEF7] font-medium">Remedy:</span> {b.recommendation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 5 cols: SVG Radar Chart & Physical Verification Ledger */}
        <div className="xl:col-span-5 space-y-5">
          <div className="bg-[#101521] border border-[#1E293B] rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-[#E8EEF7]">
                Multi-Workload Capability Profile
              </h2>
              <span className="text-[11px] text-[#64748B]">Hover axis or bar to highlight</span>
            </div>
            <BenchmarkRadarSVG
              primary={primaryEval.benchmarks}
              primaryName={primaryChip.name}
              compare={compareEval?.benchmarks}
              compareName={compareChip?.name}
              hoveredKey={hoveredMetric}
              onHoverKey={setHoveredMetric}
            />
          </div>

          <div className="bg-[#101521] border border-[#1E293B] rounded-lg p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[#E8EEF7]">Physical Verification Ledger</h2>
            <div className="divide-y divide-[#1E293B] text-xs font-mono tabular-nums">
              {[
                ['Transistor Count', `${primaryEval.physics.transistorCountMTr.toFixed(2)} MTr`],
                [
                  'Die Area / Reticle',
                  `${primaryEval.physics.dieAreaMm2.toFixed(1)} / ${primaryEval.physics.reticleLimitMm2.toFixed(0)} mm²`,
                ],
                ...(primaryEval.physics.capacityGB !== undefined
                  ? [
                      [
                        'Capacity & Stack Layers',
                        `${formatMemoryCapacity(primaryEval.physics.capacityGB)} (${primaryEval.physics.stackLayers ?? 1}L)`,
                      ],
                      [
                        'Areal Density',
                        `${(primaryEval.physics.densityGbitPerMm2 ?? 0).toFixed(3)} Gbit/mm²`,
                      ],
                      [
                        'Sustained Data Rate',
                        `${Math.round(primaryEval.physics.sustainedDataRateMTs ?? 0).toLocaleString()} MT/s`,
                      ],
                      ['Access Latency', formatLatencyNs(primaryEval.physics.accessLatencyNs ?? 0)],
                      [
                        'Random IOPS',
                        `${formatCompactNumber((primaryEval.physics.iopsK ?? 0) * 1000, 1)} IOPS`,
                      ],
                      [
                        'Endurance / Refresh',
                        primaryEval.physics.nonVolatile
                          ? `${formatCompactNumber(primaryEval.physics.enduranceTBW ?? 0, 1)} TBW (${formatCompactNumber(primaryEval.physics.enduranceCycles ?? 0, 1)} P/E)`
                          : `Volatile · ${(primaryEval.physics.refreshPowerW ?? 0).toFixed(2)} W refresh`,
                      ],
                    ]
                  : [
                      [
                        'Sustained Clock',
                        primaryEval.physics.sustainedClockGHz < 1
                          ? `${Math.round(primaryEval.physics.sustainedClockGHz * 1000)} MHz`
                          : `${primaryEval.physics.sustainedClockGHz.toFixed(2)} GHz`,
                      ],
                    ]),
                ...(primaryEval.physics.effectiveIpc !== undefined
                  ? [['Effective IPC', `${primaryEval.physics.effectiveIpc.toFixed(2)} IPC`]]
                  : []),
                [
                  'Dynamic / Leakage Power',
                  `${primaryEval.physics.dynamicPowerW.toFixed(1)} W / ${(primaryEval.physics.leakagePowerW + primaryEval.physics.tunnelingPowerW).toFixed(1)} W`,
                ],
                [
                  'Junction Temp / Limit',
                  `${primaryEval.physics.junctionTempC.toFixed(1)} °C / ${primaryEval.physics.throttleTempC} °C`,
                ],
                ['Heat Flux Density', `${primaryEval.physics.heatFluxWPerMm2.toFixed(2)} W/mm²`],
                ['Memory Bandwidth', `${primaryEval.physics.memoryBandwidthGBs.toFixed(1)} GB/s`],
                ...(primaryEval.physics.pcieBandwidthGBs !== undefined
                  ? [
                      [
                        'PCIe I/O Bandwidth',
                        `${primaryEval.physics.pcieBandwidthGBs.toFixed(1)} GB/s`,
                      ],
                    ]
                  : []),
                [
                  'Estimated Yield (best fab)',
                  `${primaryEval.physics.yieldPercent.toFixed(1)}% (${primaryEval.physics.goodDiesPerWafer.toFixed(0)} good dies)`,
                ],
              ].map(([k, v]) => (
                <div key={k} className="py-2 flex items-center justify-between gap-2">
                  <span className="text-[#8C9BB2] font-sans">{k}</span>
                  <span className="text-[#E8EEF7]">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sortable Silicon Portfolio Catalog Table */}
      <div className="bg-[#101521] border border-[#1E293B] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1E293B] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#E8EEF7]">
              Silicon Portfolio Catalog ({catalogRows.length})
            </h2>
            <p className="text-[11px] text-[#8C9BB2]">
              Compare, clone, archive, or restore any taped-out silicon architecture
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-[#0A0E16] border border-[#1E293B] rounded px-2 h-7 text-xs">
              <ArrowUpDown className="w-3 h-3 text-[#64748B]" />
              <select
                value={catalogSort}
                onChange={(e) => setCatalogSort(e.target.value as CatalogSortKey)}
                className="bg-transparent text-xs text-[#E8EEF7] focus:outline-none cursor-pointer"
                aria-label="Sort chip catalog"
              >
                <option value="rating" className="bg-[#0A0E16]">Sort: Rating</option>
                <option value="yield" className="bg-[#0A0E16]">Sort: Yield</option>
                <option value="area" className="bg-[#0A0E16]">Sort: Die Area</option>
                <option value="power" className="bg-[#0A0E16]">Sort: Power</option>
              </select>
            </div>
            <div className="flex items-center bg-[#0A0E16] border border-[#1E293B] rounded p-0.5">
              {(
                [
                  { id: 'all', label: 'Active' },
                  { id: 'cpu', label: 'CPU' },
                  { id: 'gpu', label: 'GPU' },
                  { id: 'memory', label: 'Memory' },
                  { id: 'archived', label: 'Archived' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCatalogFilter(tab.id)}
                  className={`px-2 py-0.5 text-[11px] rounded cursor-pointer whitespace-nowrap ${
                    catalogFilter === tab.id
                      ? 'bg-[#161D2D] text-[#E8EEF7]'
                      : 'text-[#8C9BB2] hover:text-[#E8EEF7]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0A0E16] text-[#8C9BB2] border-b border-[#1E293B]">
              <tr>
                <th className="py-2.5 px-4 font-medium">Chip</th>
                <th className="py-2.5 px-3 font-medium">Node</th>
                <th className="py-2.5 px-3 font-medium">Status</th>
                <th className="py-2.5 px-3 font-medium text-right">Rating</th>
                <th className="py-2.5 px-3 font-medium text-right">Area</th>
                <th className="py-2.5 px-3 font-medium text-right">Power</th>
                <th className="py-2.5 px-3 font-medium text-right">Yield</th>
                <th className="py-2.5 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {catalogRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-[#64748B]">
                    No chips in this category yet.
                  </td>
                </tr>
              ) : (
                catalogRows.map((chip) => {
                  const ev = evalMap.get(chip.id);
                  if (!ev) return null;
                  const isPrimary = chip.id === primaryChip.id;
                  const isCompare = chip.id === compareChip?.id;
                  return (
                    <tr
                      key={chip.id}
                      className={`hover:bg-[#161D2D]/40 transition-colors ${
                        isPrimary ? 'bg-[#0E2430]/35' : ''
                      }`}
                    >
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-[#E8EEF7]">{chip.name}</div>
                        <div className="text-[10px] font-mono text-[#64748B]">
                          {kindBadge(chip)} · Y{String(chip.createdYear).padStart(4, '0')}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-[#CBD5E1]">
                        {getProcessNode(chip.processNodeId).name}
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusBadge
                          tone={
                            chip.status === 'production'
                              ? 'nominal'
                              : chip.status === 'taping_out'
                                ? 'info'
                                : 'muted'
                          }
                          label={
                            chip.status === 'production'
                              ? 'Shipping'
                              : chip.status === 'taping_out'
                                ? 'Tape-Out'
                                : 'Archived'
                          }
                          compact
                        />
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-right text-[#22D3EE] font-semibold">
                        {ev.benchmarks.overallRating.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-right text-[#CBD5E1]">
                        {ev.physics.dieAreaMm2.toFixed(1)} mm²
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-right text-[#CBD5E1]">
                        {ev.physics.effectivePowerW.toFixed(1)} W
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-right text-emerald-400">
                        {ev.physics.yieldPercent.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setPrimaryId(chip.id);
                              if (compareId === chip.id) setCompareId('');
                            }}
                            className={`h-6 px-2 rounded border text-[11px] cursor-pointer ${
                              isPrimary
                                ? 'bg-[#06B6D4]/20 border-[#06B6D4]/50 text-[#22D3EE]'
                                : 'bg-[#0A0E16] border-[#1E293B] text-[#CBD5E1] hover:border-[#2C3B55]'
                            }`}
                          >
                            Inspect
                          </button>
                          {!isPrimary && (
                            <button
                              type="button"
                              onClick={() => setCompareId(isCompare ? '' : chip.id)}
                              className={`h-6 px-2 rounded border text-[11px] cursor-pointer ${
                                isCompare
                                  ? 'bg-[#D97706]/20 border-[#D97706]/50 text-[#FBBF24]'
                                  : 'bg-[#0A0E16] border-[#1E293B] text-[#8C9BB2] hover:text-[#E8EEF7]'
                              }`}
                            >
                              {isCompare ? 'Clear' : 'Compare'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onLoadIntoArchitect(chip)}
                            className="h-6 px-2 rounded bg-[#0A0E16] border border-[#1E293B] hover:border-[#2C3B55] text-[11px] text-[#CBD5E1] cursor-pointer"
                          >
                            Clone
                          </button>
                          {chip.status === 'archived' && onRestoreChip && (
                            <button
                              type="button"
                              onClick={() => onRestoreChip(chip.id)}
                              className="h-6 px-2 rounded bg-emerald-950/40 border border-emerald-500/40 text-[11px] text-emerald-300 cursor-pointer"
                            >
                              Restore
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
