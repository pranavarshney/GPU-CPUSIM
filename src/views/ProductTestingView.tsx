import React, { useMemo, useState } from 'react';
import { Archive, Copy } from 'lucide-react';
import {
  getCpuArch,
  getGpuArch,
  getMemoryCellArch,
  getProcessNode,
  MEMORY_CATEGORY_META,
} from '../engine/catalog';
import { evaluateChip } from '../engine/physics';
import { buildPreviewPhysicsContext, formatCompactNumber } from '../engine/simulation';
import type { ChipBenchmarkReport, ChipBlueprint, GameState } from '../engine/types';
import { formatLatencyNs, formatMemoryCapacity } from './MemoryArchitectView';

interface ProductTestingViewProps {
  state: GameState;
  initialSelectedId?: string;
  onArchiveChip: (chipId: string) => void;
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

const BenchmarkRadarSVG: React.FC<{
  primary: ChipBenchmarkReport;
  primaryName: string;
  compare?: ChipBenchmarkReport;
  compareName?: string;
}> = ({ primary, primaryName, compare, compareName }) => {
  const cx = 150;
  const cy = 140;
  const radius = 98;

  // Normalize each axis against max(primary, compare, sensible floor) using log scale so early and late chips look crisp
  const norm = (val: number, maxVal: number) => {
    if (val <= 0) return 0.05;
    const lv = Math.log10(1 + val);
    const lm = Math.log10(1 + Math.max(maxVal, 50));
    return Math.max(0.08, Math.min(1, lv / lm));
  };

  const axisMax = BENCH_METRICS.map((m) =>
    Math.max(primary[m.key], compare ? compare[m.key] : 0, m.key === 'thermalPerformance' ? 100 : 100)
  );

  const buildPolygon = (report: ChipBenchmarkReport) =>
    BENCH_METRICS.map((m, idx) => {
      const angle = (Math.PI * 2 * idx) / BENCH_METRICS.length - Math.PI / 2;
      const r = radius * norm(report[m.key], axisMax[idx]);
      return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`;
    }).join(' ');

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 300 280" className="w-full max-w-[310px]" role="img" aria-label="8-axis benchmark radar chart">
        {[0.25, 0.5, 0.75, 1.0].map((lvl) => (
          <polygon
            key={lvl}
            fill="none"
            stroke="#1F2A3D"
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
          const lx = cx + (radius + 20) * Math.cos(angle);
          const ly = cy + (radius + 16) * Math.sin(angle);
          return (
            <g key={m.key}>
              <line x1={cx} y1={cy} x2={x2} y2={y2} stroke="#1F2A3D" strokeWidth="1" />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#8C9BB2"
                fontSize="8.5"
                fontFamily="JetBrains Mono, monospace"
              >
                {m.short}
              </text>
            </g>
          );
        })}

        {compare && (
          <polygon
            points={buildPolygon(compare)}
            fill="#D97706"
            fillOpacity="0.16"
            stroke="#D97706"
            strokeWidth="1.8"
            strokeDasharray="3 2"
          />
        )}

        <polygon
          points={buildPolygon(primary)}
          fill="#06B6D4"
          fillOpacity="0.22"
          stroke="#06B6D4"
          strokeWidth="2"
        />
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

  const [primaryId, setPrimaryId] = useState<string>(initialSelectedId ?? allTestable[0]?.id ?? 'draft_cpu');
  const [compareId, setCompareId] = useState<string>('');

  const primaryChip = allTestable.find((c) => c.id === primaryId) ?? allTestable[0];
  const compareChip = allTestable.find((c) => c.id === compareId);

  const primaryEval = useMemo(() => {
    const ctx = buildPreviewPhysicsContext(state, primaryChip.processNodeId, 1.0);
    return evaluateChip(primaryChip, ctx);
  }, [primaryChip, state]);

  const compareEval = useMemo(() => {
    if (!compareChip) return undefined;
    const ctx = buildPreviewPhysicsContext(state, compareChip.processNodeId, 1.0);
    return evaluateChip(compareChip, ctx);
  }, [compareChip, state]);

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
    <div className="p-6 max-w-[1440px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#1F2A3D] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E8EEF7] tracking-tight">Product Testing &amp; Diagnostics</h1>
          <p className="text-sm text-[#8C9BB2] mt-0.5">
            Run 8-workload silicon validation, inspect physical bottlenecks, and compare architectures side-by-side
          </p>
        </div>

        {/* Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[#8C9BB2]">
            <span>Primary:</span>
            <select
              value={primaryChip.id}
              onChange={(e) => setPrimaryId(e.target.value)}
              className="h-9 px-2.5 rounded bg-[#111622] border border-[#2C3B55] text-xs text-[#E8EEF7] focus:border-[#06B6D4] focus:outline-none"
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
              value={compareId}
              onChange={(e) => setCompareId(e.target.value)}
              className="h-9 px-2.5 rounded bg-[#111622] border border-[#1F2A3D] text-xs text-[#E8EEF7] focus:border-[#D97706] focus:outline-none"
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
        </div>
      </div>

      {/* Main Testing Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 7 cols: 8-Workload Benchmark Breakdown */}
        <div className="xl:col-span-7 space-y-5">
          <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1F2A3D] pb-3">
              <div>
                <h2 className="text-base font-semibold text-[#E8EEF7]">{primaryChip.name}</h2>
                <p className="text-xs text-[#8C9BB2]">
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
                      className="h-8 px-2.5 rounded bg-[#171E2E] hover:bg-[#1F2A3D] border border-[#2C3B55] text-xs text-[#E8EEF7] flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-[#06B6D4]" />
                      <span>Clone to Architect</span>
                    </button>
                    {primaryChip.status === 'production' && (
                      <button
                        type="button"
                        onClick={() => onArchiveChip(primaryChip.id)}
                        className="h-8 px-2.5 rounded bg-[#0B0F17] hover:bg-rose-950/50 border border-[#1F2A3D] text-xs text-[#8C9BB2] hover:text-rose-300 flex items-center gap-1 whitespace-nowrap cursor-pointer"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>Archive</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* 8 Scored Benchmark Bars */}
            <div className="space-y-3">
              {BENCH_METRICS.map((m) => {
                const pVal = primaryEval.benchmarks[m.key];
                const cVal = compareEval ? compareEval.benchmarks[m.key] : null;
                const scaleMax = Math.max(pVal, cVal ?? 0, m.key === 'thermalPerformance' ? 100 : 10);
                const pPct = Math.min(100, (pVal / scaleMax) * 100);
                const cPct = cVal !== null ? Math.min(100, (cVal / scaleMax) * 100) : 0;

                return (
                  <div key={m.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#CBD5E1]">{m.label}</span>
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
                    <div className="h-2 bg-[#0B0F17] rounded overflow-hidden">
                      <div className="h-full bg-[#06B6D4]" style={{ width: `${pPct}%` }} />
                    </div>
                    {cVal !== null && (
                      <div className="h-1.5 bg-[#0B0F17] rounded overflow-hidden">
                        <div className="h-full bg-[#D97706]" style={{ width: `${cPct}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Dedicated Memory & Storage Validation Scores */}
            {primaryChip.kind === 'memory' && (
              <div className="pt-4 border-t border-[#1F2A3D] space-y-2.5">
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
                      className="p-2.5 rounded bg-[#0B0F17] border border-[#1F2A3D] space-y-0.5"
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
          <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-5 space-y-3">
            <h2 className="text-sm font-semibold text-[#E8EEF7]">
              Engineering Bottleneck Analysis
            </h2>
            <div className="space-y-2.5">
              {primaryEval.benchmarks.bottlenecks.map((b) => (
                <div
                  key={b.id}
                  className={`p-3.5 rounded-md border space-y-1 text-xs ${
                    b.severity === 'critical'
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                      : b.severity === 'warning'
                        ? 'bg-amber-950/35 border-amber-500/40 text-amber-200'
                        : 'bg-[#0B0F17] border-[#1F2A3D] text-[#E8EEF7]'
                  }`}
                >
                  <div className="font-semibold">
                    {b.severity === 'critical'
                      ? '✖ Critical Constraint — '
                      : b.severity === 'warning'
                        ? '▲ Bottleneck — '
                        : '● Nominal — '}
                    {b.title}
                  </div>
                  <p className="text-[#CBD5E1] leading-relaxed">{b.explanation}</p>
                  <p className="text-[#8C9BB2]">
                    <span className="text-[#E8EEF7] font-medium">Engineering Remedy:</span>{' '}
                    {b.recommendation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 5 cols: SVG Radar Chart & Physical Verification Ledger */}
        <div className="xl:col-span-5 space-y-5">
          <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-5">
            <h2 className="text-sm font-semibold text-[#E8EEF7] mb-3">
              Multi-Workload Capability Profile
            </h2>
            <BenchmarkRadarSVG
              primary={primaryEval.benchmarks}
              primaryName={primaryChip.name}
              compare={compareEval?.benchmarks}
              compareName={compareChip?.name}
            />
          </div>

          <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-5 space-y-3">
            <h2 className="text-sm font-semibold text-[#E8EEF7]">Physical Verification Ledger</h2>
            <div className="divide-y divide-[#1F2A3D] text-xs font-mono tabular-nums">
              {[
                ['Transistor Count', `${primaryEval.physics.transistorCountMTr.toFixed(2)} MTr`],
                ['Die Area / Reticle', `${primaryEval.physics.dieAreaMm2.toFixed(1)} / ${primaryEval.physics.reticleLimitMm2.toFixed(0)} mm²`],
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
                      [
                        'Access Latency',
                        formatLatencyNs(primaryEval.physics.accessLatencyNs ?? 0),
                      ],
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
                ['Dynamic / Leakage Power', `${primaryEval.physics.dynamicPowerW.toFixed(1)} W / ${(primaryEval.physics.leakagePowerW + primaryEval.physics.tunnelingPowerW).toFixed(1)} W`],
                ['Junction Temp / Limit', `${primaryEval.physics.junctionTempC.toFixed(1)} °C / ${primaryEval.physics.throttleTempC} °C`],
                ['Heat Flux Density', `${primaryEval.physics.heatFluxWPerMm2.toFixed(2)} W/mm²`],
                ['Memory Bandwidth', `${primaryEval.physics.memoryBandwidthGBs.toFixed(1)} GB/s`],
                ...(primaryEval.physics.pcieBandwidthGBs !== undefined
                  ? [['PCIe I/O Bandwidth', `${primaryEval.physics.pcieBandwidthGBs.toFixed(1)} GB/s`]]
                  : []),
                ['Estimated Yield (best fab)', `${primaryEval.physics.yieldPercent.toFixed(1)}% (${primaryEval.physics.goodDiesPerWafer.toFixed(0)} good dies)`],
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
    </div>
  );
};
