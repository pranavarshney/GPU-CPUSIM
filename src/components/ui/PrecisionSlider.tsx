import React, { useState } from 'react';
import { Minus, Plus } from 'lucide-react';

interface ThresholdZone {
  /** Value where warning/danger starts or ends */
  value: number;
  /** 'below-danger' colors [min..value] rose (e.g. Vmin); 'above-warn' colors [value..max] amber; 'above-danger' colors [value..max] rose */
  kind: 'below-danger' | 'above-warn' | 'above-danger';
  label?: string;
}

interface PrecisionSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  displayValue: string;
  accent?: 'cyan' | 'amber' | 'teal' | 'rose' | 'default';
  unitHint?: string;
  inlineAction?: React.ReactNode;
  threshold?: ThresholdZone;
  onChange: (next: number) => void;
}

function roundToStep(val: number, min: number, max: number, step: number): number {
  const clamped = Math.max(min, Math.min(max, val));
  if (step <= 0) return clamped;
  const snapped = Math.round((clamped - min) / step) * step + min;
  const decimals = step < 1 ? Math.min(4, String(step).split('.')[1]?.length ?? 2) : 0;
  return Number(Math.max(min, Math.min(max, snapped)).toFixed(decimals));
}

/**
 * Precision CAD scrubber with direct numeric edit, -/+ micro-steppers, and threshold track markers.
 */
export const PrecisionSlider: React.FC<PrecisionSliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  disabled = false,
  displayValue,
  accent = 'default',
  unitHint,
  inlineAction,
  threshold,
  onChange,
}) => {
  const [editing, setEditing] = useState(false);
  const [draftInput, setDraftInput] = useState('');

  const span = Math.max(1e-9, max - min);
  const clampedValue = Math.max(min, Math.min(max, value));
  const fillPct = ((clampedValue - min) / span) * 100;

  let thresholdPct: number | null = null;
  if (threshold !== undefined) {
    thresholdPct = Math.max(0, Math.min(100, ((threshold.value - min) / span) * 100));
  }

  const valueTone =
    accent === 'rose'
      ? 'text-rose-400 font-semibold'
      : accent === 'cyan'
        ? 'text-[#22D3EE] font-semibold'
        : accent === 'amber'
          ? 'text-[#F59E0B] font-semibold'
          : accent === 'teal'
            ? 'text-[#2DD4BF] font-semibold'
            : 'text-[#E8EEF7]';

  const commitEdit = () => {
    setEditing(false);
    const parsed = Number(draftInput);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      onChange(roundToStep(parsed, min, max, step));
    }
  };

  const nudge = (dir: -1 | 1) => {
    if (disabled) return;
    onChange(roundToStep(clampedValue + dir * step, min, max, step));
  };

  // Compute CSS track background with optional threshold zone coloring
  const buildTrackBackground = (): string => {
    const fillCol =
      accent === 'rose'
        ? '#F43F5E'
        : accent === 'amber'
          ? '#D97706'
          : accent === 'teal'
            ? '#14B8A6'
            : '#06B6D4';
    const baseCol = '#1E293B';

    if (threshold && thresholdPct !== null) {
      if (threshold.kind === 'below-danger') {
        const t = thresholdPct.toFixed(1);
        return `linear-gradient(to right, rgba(244,63,94,0.38) 0%, rgba(244,63,94,0.38) ${t}%, ${baseCol} ${t}%, ${baseCol} 100%)`;
      }
      if (threshold.kind === 'above-warn') {
        const t = thresholdPct.toFixed(1);
        return `linear-gradient(to right, ${baseCol} 0%, ${baseCol} ${t}%, rgba(245,158,11,0.35) ${t}%, rgba(245,158,11,0.35) 100%)`;
      }
      if (threshold.kind === 'above-danger') {
        const t = thresholdPct.toFixed(1);
        return `linear-gradient(to right, ${baseCol} 0%, ${baseCol} ${t}%, rgba(244,63,94,0.38) ${t}%, rgba(244,63,94,0.38) 100%)`;
      }
    }
    const p = fillPct.toFixed(1);
    return `linear-gradient(to right, ${fillCol} 0%, ${fillCol} ${p}%, ${baseCol} ${p}%, ${baseCol} 100%)`;
  };

  return (
    <div className={`space-y-1.5 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-[#8C9BB2] truncate">{label}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {inlineAction}
          {editing ? (
            <input
              type="number"
              autoFocus
              step={step}
              min={min}
              max={max}
              value={draftInput}
              onChange={(e) => setDraftInput(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="w-20 h-5 px-1.5 rounded bg-[#06080D] border border-[#06B6D4] font-mono tabular-nums text-[11px] text-[#E8EEF7] text-right focus:outline-none"
              aria-label={`Enter exact value for ${label}`}
            />
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setDraftInput(String(clampedValue));
                setEditing(true);
              }}
              title={disabled ? undefined : 'Click to enter exact numeric value'}
              className={`font-mono tabular-nums text-xs px-1 rounded hover:bg-[#161D2D] transition-colors cursor-pointer disabled:cursor-not-allowed ${valueTone}`}
            >
              {displayValue}
              {unitHint ? <span className="text-[#64748B] ml-1 text-[10px]">{unitHint}</span> : null}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={disabled || clampedValue <= min}
          onClick={() => nudge(-1)}
          aria-label={`Decrease ${label}`}
          className="h-5 w-5 shrink-0 rounded-[3px] bg-[#0A0E16] hover:bg-[#161D2D] border border-[#1E293B] text-[#8C9BB2] hover:text-[#E8EEF7] disabled:opacity-30 flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
        >
          <Minus className="w-2.5 h-2.5" />
        </button>

        <div className="relative flex-1 flex items-center h-5">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 h-[4px] rounded-[2px] pointer-events-none"
            style={{ background: buildTrackBackground() }}
          />
          {thresholdPct !== null && (
            <div
              aria-hidden="true"
              title={threshold?.label}
              className={`absolute top-1 bottom-1 w-[1.5px] pointer-events-none ${
                threshold?.kind === 'above-warn' ? 'bg-amber-400' : 'bg-rose-400'
              }`}
              style={{ left: `${thresholdPct}%` }}
            />
          )}
          <input
            type="range"
            data-custom-track="true"
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            value={clampedValue}
            onChange={(e) => onChange(Number(e.target.value))}
            className="foundry-slider relative z-10"
            aria-label={label}
          />
        </div>

        <button
          type="button"
          disabled={disabled || clampedValue >= max}
          onClick={() => nudge(1)}
          aria-label={`Increase ${label}`}
          className="h-5 w-5 shrink-0 rounded-[3px] bg-[#0A0E16] hover:bg-[#161D2D] border border-[#1E293B] text-[#8C9BB2] hover:text-[#E8EEF7] disabled:opacity-30 flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
        >
          <Plus className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  );
};
