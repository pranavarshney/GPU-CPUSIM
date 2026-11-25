import React, { useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  Gauge,
  GitCompare,
  Play,
  Redo2,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Undo2,
  Wand2,
} from 'lucide-react';
import { getMaxWaferDiameterMm, getTechNode } from '../engine/catalog';
import {
  ARCHITECT_PRESETS,
  type ArchitectPresetId,
  type NextUnlockHint,
  type OptimizeActionId,
} from '../engine/architectHelpers';
import { formatCompactNumber } from '../engine/simulation';
import type {
  ChipBlueprint,
  ChipEvaluation,
  GameState,
} from '../engine/types';
import { DieFloorplanSVG } from './DieFloorplanSVG';
import { MeterBar } from './ui/MeterBar';
import { StatusBadge } from './ui/StatusBadge';

export interface TelemetryMetricRow {
  label: string;
  value: string;
  baselineDelta?: { text: string; positive: boolean } | null;
  tone?: 'default' | 'cyan' | 'teal' | 'emerald' | 'amber' | 'rose';
}

interface ArchitectStudioShellProps {
  title: string;
  subtitle: string;
  accent: 'cyan' | 'teal';
  state: GameState;
  draftName: string;
  nodeLabel: string;
  evaluation: ChipEvaluation;
  baselineChips: ChipBlueprint[];
  baselineChipId: string;
  baselineEval?: ChipEvaluation;
  onSelectBaseline: (chipId: string) => void;
  thermalOverlay: boolean;
  onToggleThermal: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onResetDefaults: () => void;
  onAutoName: () => void;
  onApplyPreset: (preset: ArchitectPresetId) => void;
  onOptimize: (action: OptimizeActionId) => void;
  onTestPrototype: () => void;
  onStartTapeOut: (autoAssignLineId?: string) => void;
  tapeOutDisabled?: boolean;
  feedback: { type: 'error' | 'ok'; msg: string } | null;
  topStrip?: React.ReactNode;
  extraVisualizer?: React.ReactNode;
  telemetryRows: TelemetryMetricRow[];
  nextUnlockHints: NextUnlockHint[];
  onJumpToTech?: (techId: string) => void;
  children: React.ReactNode;
}

export function formatDelta(
  current: number,
  baseline: number,
  higherIsBetter = true,
  unit = ''
): { text: string; positive: boolean } | null {
  if (!Number.isFinite(baseline) || Math.abs(baseline) < 1e-6) return null;
  const diff = current - baseline;
  const pct = (diff / Math.abs(baseline)) * 100;
  if (Math.abs(pct) < 0.5) return null;
  const sign = diff > 0 ? '+' : '';
  const positive = higherIsBetter ? diff > 0 : diff < 0;
  return {
    text: unit ? `${sign}${diff.toFixed(1)}${unit}` : `${sign}${Math.round(pct)}%`,
    positive,
  };
}

export const ArchitectStudioShell: React.FC<ArchitectStudioShellProps> = ({
  title,
  subtitle,
  accent,
  state,
  draftName,
  nodeLabel,
  evaluation,
  baselineChips,
  baselineChipId,
  baselineEval,
  onSelectBaseline,
  thermalOverlay,
  onToggleThermal,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onResetDefaults,
  onAutoName,
  onApplyPreset,
  onOptimize,
  onTestPrototype,
  onStartTapeOut,
  tapeOutDisabled = false,
  feedback,
  topStrip,
  extraVisualizer,
  telemetryRows,
  nextUnlockHints,
  onJumpToTech,
  children,
}) => {
  const [autoAssignLineId, setAutoAssignLineId] = React.useState<string>('');
  const { physics, benchmarks } = evaluation;
  const waferDiameterMm = getMaxWaferDiameterMm(state.unlockedTechIds);

  const fabLines = useMemo(() => {
    const fabMap = new Map(state.facilities.filter((f) => f.kind === 'fab').map((f) => [f.id, f]));
    return state.productionLines.map((line) => ({
      line,
      fabName: fabMap.get(line.fabId)?.name ?? line.fabId,
      isIdle: line.chipId === null,
    }));
  }, [state.facilities, state.productionLines]);

  const reticlePct = (physics.dieAreaMm2 / Math.max(1, physics.reticleLimitMm2)) * 100;
  const thermalPct = (physics.junctionTempC / Math.max(1, physics.throttleTempC)) * 100;

  const overallStatus: { tone: 'nominal' | 'warning' | 'critical'; label: string } =
    physics.exceedsReticle || physics.voltageUnstable
      ? { tone: 'critical', label: physics.exceedsReticle ? 'Reticle Exceeded' : 'Voltage Unstable' }
      : physics.thermalThrottledRatio < 0.96 || physics.powerThrottledRatio < 0.96 || physics.yieldPercent < 40
        ? { tone: 'warning', label: 'Constraint Active' }
        : { tone: 'nominal', label: 'Tape-Out Ready' };

  const scoreDelta = baselineEval
    ? formatDelta(benchmarks.overallRating, baselineEval.benchmarks.overallRating, true)
    : null;

  return (
    <div className="p-4 lg:p-6 max-w-[1640px] mx-auto space-y-4">
      {/* Sticky Studio Header & CAD Toolbar */}
      <div className="sticky top-0 z-20 -mx-4 lg:-mx-6 px-4 lg:px-6 pt-1 pb-3 bg-[#06080D]/95 backdrop-blur-sm border-b border-[#1E293B] space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl lg:text-2xl font-bold text-[#E8EEF7] tracking-tight">{title}</h1>
              <StatusBadge tone={overallStatus.tone} label={overallStatus.label} />
            </div>
            <p className="text-xs text-[#8C9BB2] mt-0.5">{subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Auto-deploy target Fab selector */}
            {fabLines.length > 0 && (
              <select
                value={autoAssignLineId}
                onChange={(e) => setAutoAssignLineId(e.target.value)}
                title="Optional: auto-assign this chip to a Fab line when Tape-Out completes"
                aria-label="Auto-assign fab line on tape-out completion"
                className="foundry-select h-9 px-2.5 rounded bg-[#101521] border border-[#1E293B] focus:border-[#06B6D4] text-xs text-[#CBD5E1]"
              >
                <option value="">Deploy: Manual</option>
                {fabLines.map(({ line, fabName, isIdle }) => (
                  <option key={line.id} value={line.id}>
                    Auto-Deploy → {fabName} {isIdle ? '(Idle)' : '(Replace)'}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={onTestPrototype}
              className="h-9 px-3 rounded bg-[#101521] hover:bg-[#161D2D] text-[#E8EEF7] border border-[#2C3B55] text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Gauge className="w-3.5 h-3.5 text-[#06B6D4]" />
              <span>Benchmarks</span>
            </button>

            <button
              type="button"
              onClick={() => onStartTapeOut(autoAssignLineId || undefined)}
              disabled={tapeOutDisabled || physics.exceedsReticle || physics.voltageUnstable}
              className={`h-9 px-4 rounded text-[#06080D] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
                accent === 'teal'
                  ? 'bg-[#14B8A6] hover:bg-[#2DD4BF]'
                  : 'bg-[#06B6D4] hover:bg-[#22D3EE]'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>
                Tape-Out ({formatCompactNumber(physics.tapeOutCreditCost, 0)} CR · {physics.tapeOutDays}d)
              </span>
            </button>
          </div>
        </div>

        {/* Studio Action Ribbon: Presets, Auto-Optimize, Undo/Redo, Auto-Name, Baseline Pin */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1E293B]/80">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Presets selector */}
            <div className="flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#64748B]" />
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) onApplyPreset(e.target.value as ArchitectPresetId);
                }}
                aria-label="Apply engineering preset"
                className="foundry-select h-7 px-2 rounded bg-[#101521] border border-[#1E293B] hover:border-[#2C3B55] text-[11px] text-[#E8EEF7] cursor-pointer"
              >
                <option value="">Apply Role Preset...</option>
                {ARCHITECT_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} — {p.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Auto-Optimize Solvers */}
            <div className="flex items-center gap-1">
              <Wand2 className="w-3.5 h-3.5 text-[#06B6D4]" />
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) onOptimize(e.target.value as OptimizeActionId);
                }}
                aria-label="Auto-optimize parameter"
                className="foundry-select h-7 px-2 rounded bg-[#101521] border border-[#1E293B] hover:border-[#2C3B55] text-[11px] text-[#22D3EE] cursor-pointer"
              >
                <option value="">Auto-Optimize...</option>
                <option value="fit_reticle">Auto-Fit Within Reticle Limit</option>
                <option value="stabilize_voltage">Auto-Stabilize Supply Voltage (Vmin)</option>
                <option value="match_cooling">Auto-Match Cooling &amp; TDP Envelope</option>
                <option value="balance_bandwidth">Auto-Balance Memory Bandwidth</option>
              </select>
            </div>

            <button
              type="button"
              onClick={onAutoName}
              title="Generate foundry-style model designation"
              className="h-7 px-2 rounded bg-[#101521] hover:bg-[#161D2D] border border-[#1E293B] text-[11px] text-[#CBD5E1] flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-[#D97706]" />
              <span>Auto-Name</span>
            </button>

            <div className="flex items-center border border-[#1E293B] rounded overflow-hidden">
              <button
                type="button"
                disabled={!canUndo}
                onClick={onUndo}
                title="Undo edit (Ctrl+Z)"
                aria-label="Undo draft edit"
                className="h-7 px-2 bg-[#101521] hover:bg-[#161D2D] disabled:opacity-35 text-[#CBD5E1] cursor-pointer disabled:cursor-not-allowed"
              >
                <Undo2 className="w-3 h-3" />
              </button>
              <button
                type="button"
                disabled={!canRedo}
                onClick={onRedo}
                title="Redo edit (Ctrl+Y)"
                aria-label="Redo draft edit"
                className="h-7 px-2 bg-[#101521] hover:bg-[#161D2D] disabled:opacity-35 text-[#CBD5E1] border-l border-[#1E293B] cursor-pointer disabled:cursor-not-allowed"
              >
                <Redo2 className="w-3 h-3" />
              </button>
            </div>

            <button
              type="button"
              onClick={onResetDefaults}
              title="Reset draft to clean starter configuration"
              className="h-7 px-2 rounded bg-[#101521] hover:bg-[#161D2D] border border-[#1E293B] text-[11px] text-[#8C9BB2] hover:text-[#E8EEF7] flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>

          {/* Live Baseline Pin Compare */}
          <div className="flex items-center gap-1.5">
            <GitCompare className="w-3.5 h-3.5 text-[#D97706]" />
            <select
              value={baselineChipId}
              onChange={(e) => onSelectBaseline(e.target.value)}
              aria-label="Compare draft live against existing chip"
              className="foundry-select h-7 px-2 rounded bg-[#101521] border border-[#1E293B] focus:border-[#D97706] text-[11px] text-[#E8EEF7]"
            >
              <option value="">Baseline Compare: None</option>
              {baselineChips.map((c) => (
                <option key={c.id} value={c.id}>
                  vs {c.name} (Y{String(c.createdYear).padStart(4, '0')})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {topStrip}

      {feedback && (
        <div
          className={`px-4 py-2.5 rounded-md border text-xs flex items-center gap-2 ${
            feedback.type === 'error'
              ? 'bg-rose-950/50 border-rose-500/50 text-rose-200'
              : 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200'
          }`}
        >
          {feedback.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Adaptive CAD Studio Grid: 2-pane on XL, full 3-pane on 2XL */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Pane 1: Collapsible Parameter Workbench */}
        <div className="xl:col-span-7 2xl:col-span-5 space-y-3.5">
          {children}

          {/* Inline R&D Unlock Roadmap Hints */}
          {nextUnlockHints.length > 0 && (
            <div className="bg-[#0A0E16] border border-[#1E293B] rounded-md p-3.5 space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
                <FlaskConical className="w-3.5 h-3.5 text-[#06B6D4]" />
                <span>Next Unlockable Silicon Hardware</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {nextUnlockHints.map((hint) => {
                  const tech = getTechNode(hint.techId);
                  return (
                    <button
                      key={`${hint.slotLabel}_${hint.techId}`}
                      type="button"
                      onClick={() => onJumpToTech?.(hint.techId)}
                      className="px-2.5 py-2 rounded bg-[#101521] hover:bg-[#161D2D] border border-[#1E293B] hover:border-[#2C3B55] text-left transition-colors cursor-pointer"
                    >
                      <div className="text-[10px] font-mono text-[#64748B]">{hint.slotLabel}</div>
                      <div className="text-xs font-medium text-[#E8EEF7] truncate">
                        {hint.itemName}
                      </div>
                      {tech && (
                        <div className="text-[10px] font-mono text-[#22D3EE] truncate mt-0.5">
                          Research: {tech.name} ({tech.rpCost.toLocaleString()} RP)
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Pane 2: Sticky Live Silicon Visualizer (Floorplan / Thermal / Wafer) */}
        <div className="xl:col-span-5 2xl:col-span-4 space-y-4 xl:sticky xl:top-[126px]">
          <DieFloorplanSVG
            title={draftName || 'Unnamed Silicon'}
            nodeLabel={nodeLabel}
            physics={physics}
            waferDiameterMm={waferDiameterMm}
            thermalOverlay={thermalOverlay}
            onToggleThermal={onToggleThermal}
          />
          {extraVisualizer}
        </div>

        {/* Pane 3: Verification Telemetry, Calibrated Meters & Bottlenecks */}
        <div className="xl:col-span-12 2xl:col-span-3 space-y-4 2xl:sticky 2xl:top-[126px]">
          <div className="bg-[#101521] border border-[#1E293B] rounded-md p-4 space-y-4">
            {/* Score Headline */}
            <div className="flex items-baseline justify-between border-b border-[#1E293B] pb-3">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-[#64748B]">
                  Overall Benchmark Index
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-mono tabular-nums font-bold text-[#E8EEF7]">
                    {benchmarks.overallRating.toLocaleString()}
                  </span>
                  {scoreDelta && (
                    <span
                      className={`font-mono tabular-nums text-xs font-semibold ${
                        scoreDelta.positive ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {scoreDelta.text}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right font-mono tabular-nums">
                <div className="text-[10px] text-[#64748B]">PERF / WATT</div>
                <div className="text-sm font-semibold text-[#22D3EE]">
                  {benchmarks.powerEfficiency.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Calibrated Instrument Meters */}
            <div className="space-y-3">
              <MeterBar
                label="Reticle Area Usage"
                valueText={`${physics.dieAreaMm2.toFixed(1)} / ${physics.reticleLimitMm2.toFixed(0)} mm²`}
                subText={`Yield ${physics.yieldPercent.toFixed(1)}% · ${physics.goodDiesPerWafer.toFixed(0)} good/wfr`}
                percent={reticlePct}
                warnAt={82}
                critAt={100}
                accent={accent}
              />
              <MeterBar
                label="Junction Thermal Envelope"
                valueText={`${physics.junctionTempC.toFixed(1)} / ${physics.throttleTempC} °C`}
                subText={`Heat flux ${physics.heatFluxWPerMm2.toFixed(2)} W/mm²`}
                percent={thermalPct}
                warnAt={85}
                critAt={99}
                accent="amber"
              />
            </div>

            {/* Key Physical Telemetry Table */}
            <div className="divide-y divide-[#1E293B] border-t border-[#1E293B] text-xs">
              {telemetryRows.map((row) => {
                const valTone =
                  row.tone === 'cyan'
                    ? 'text-[#22D3EE] font-semibold'
                    : row.tone === 'teal'
                      ? 'text-[#2DD4BF] font-semibold'
                      : row.tone === 'emerald'
                        ? 'text-emerald-400 font-semibold'
                        : row.tone === 'amber'
                          ? 'text-amber-400 font-semibold'
                          : row.tone === 'rose'
                            ? 'text-rose-400 font-semibold'
                            : 'text-[#E8EEF7]';
                return (
                  <div key={row.label} className="py-2 flex items-center justify-between gap-2">
                    <span className="text-[#8C9BB2] truncate">{row.label}</span>
                    <div className="flex items-center gap-1.5 font-mono tabular-nums shrink-0">
                      <span className={valTone}>{row.value}</span>
                      {row.baselineDelta && (
                        <span
                          className={`text-[10px] ${
                            row.baselineDelta.positive ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          ({row.baselineDelta.text})
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Live Engineering Diagnostics */}
            <div className="space-y-2 pt-2 border-t border-[#1E293B]">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#64748B]">
                Live Physical Diagnostics
              </div>
              {benchmarks.bottlenecks.slice(0, 3).map((b) => (
                <div
                  key={b.id}
                  className={`p-2.5 rounded border text-xs space-y-0.5 ${
                    b.severity === 'critical'
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                      : b.severity === 'warning'
                        ? 'bg-amber-950/35 border-amber-500/40 text-amber-200'
                        : 'bg-[#0A0E16] border-[#1E293B] text-[#CBD5E1]'
                  }`}
                >
                  <div className="font-semibold flex items-center gap-1.5">
                    <span>
                      {b.severity === 'critical'
                        ? '✖'
                        : b.severity === 'warning'
                          ? '▲'
                          : '●'}
                    </span>
                    <span>{b.title}</span>
                  </div>
                  <p className="text-[11px] opacity-90 leading-relaxed">{b.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
