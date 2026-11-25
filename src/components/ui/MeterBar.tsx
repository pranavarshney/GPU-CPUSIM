import React from 'react';

export type MeterTone = 'cyan' | 'teal' | 'emerald' | 'amber' | 'rose' | 'auto';

interface MeterMarker {
  value: number;
  tone?: 'amber' | 'rose';
}

interface MeterBarProps {
  label?: string;
  valueText?: string;
  valueLabel?: string;
  subText?: string;
  /** Direct percentage (0..100+) */
  percent?: number;
  /** Alternative numeric value paired with max */
  value?: number;
  max?: number;
  warnAt?: number;
  critAt?: number;
  accent?: 'cyan' | 'teal' | 'amber' | 'auto';
  tone?: MeterTone;
  height?: 'sm' | 'md';
  markers?: MeterMarker[];
}

/**
 * Calibrated horizontal instrument meter with threshold ticks and clear margin status.
 */
export const MeterBar: React.FC<MeterBarProps> = ({
  label,
  valueText,
  valueLabel,
  subText,
  percent,
  value,
  max = 100,
  warnAt = 80,
  critAt = 98,
  accent,
  tone,
  height = 'md',
  markers,
}) => {
  const computedPercent =
    percent !== undefined
      ? percent
      : value !== undefined
        ? (value / Math.max(1e-6, max)) * 100
        : 0;
  const clamped = Math.max(0, Math.min(100, computedPercent));

  const effectiveMode = tone ?? accent ?? 'auto';
  const useAutoThresholds = effectiveMode === 'auto' || percent !== undefined;
  const isCrit = useAutoThresholds && computedPercent >= critAt;
  const isWarn = useAutoThresholds && !isCrit && computedPercent >= warnAt;

  let barClass = 'bg-[#06B6D4]';
  if (tone && tone !== 'auto') {
    barClass =
      tone === 'rose'
        ? 'bg-rose-500'
        : tone === 'amber'
          ? 'bg-amber-400'
          : tone === 'emerald'
            ? 'bg-emerald-500'
            : tone === 'teal'
              ? 'bg-[#14B8A6]'
              : 'bg-[#06B6D4]';
  } else if (isCrit) {
    barClass = 'bg-rose-500';
  } else if (isWarn) {
    barClass = 'bg-amber-400';
  } else if (accent === 'teal') {
    barClass = 'bg-[#14B8A6]';
  } else if (accent === 'amber') {
    barClass = 'bg-[#D97706]';
  }

  const valClass =
    tone === 'rose' || isCrit
      ? 'text-rose-400 font-semibold'
      : tone === 'amber' || isWarn
        ? 'text-amber-300 font-semibold'
        : 'text-[#E8EEF7]';

  const displayValue = valueText ?? valueLabel;
  const heightCls = height === 'sm' ? 'h-1.5' : 'h-2';

  return (
    <div className="space-y-1">
      {(label || displayValue) && (
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="text-[#8C9BB2] truncate">{label ?? ''}</span>
          {displayValue && (
            <span className={`font-mono tabular-nums shrink-0 ${valClass}`}>{displayValue}</span>
          )}
        </div>
      )}
      <div
        className={`relative ${heightCls} bg-[#06080D] border border-[#1E293B] rounded-[2px] overflow-hidden`}
      >
        <div
          className={`h-full transition-all duration-150 ${barClass}`}
          style={{ width: `${clamped}%` }}
        />
        {markers
          ? markers.map((m, idx) => {
              const leftPct = Math.max(0, Math.min(100, (m.value / Math.max(1e-6, max)) * 100));
              if (leftPct <= 0 || leftPct >= 100) return null;
              return (
                <div
                  key={idx}
                  aria-hidden="true"
                  className={`absolute top-0 bottom-0 w-px ${
                    m.tone === 'rose' ? 'bg-rose-400/60' : 'bg-amber-400/50'
                  }`}
                  style={{ left: `${leftPct}%` }}
                />
              );
            })
          : percent !== undefined &&
            warnAt > 0 &&
            warnAt < 100 && (
              <div
                aria-hidden="true"
                className="absolute top-0 bottom-0 w-px bg-amber-400/50"
                style={{ left: `${warnAt}%` }}
              />
            )}
      </div>
      {subText && (
        <div className="text-[11px] font-mono tabular-nums text-[#64748B] flex justify-between">
          <span>{subText}</span>
          <span>{Math.round(computedPercent)}%</span>
        </div>
      )}
    </div>
  );
};
