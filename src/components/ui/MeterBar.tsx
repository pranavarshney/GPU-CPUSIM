import React from 'react';

interface MeterBarProps {
  label: string;
  valueText: string;
  subText?: string;
  percent: number; // 0..100+
  warnAt?: number; // default 80
  critAt?: number; // default 98
  accent?: 'cyan' | 'teal' | 'amber' | 'auto';
}

/**
 * Calibrated horizontal instrument meter with threshold ticks and clear margin status.
 */
export const MeterBar: React.FC<MeterBarProps> = ({
  label,
  valueText,
  subText,
  percent,
  warnAt = 80,
  critAt = 98,
  accent = 'auto',
}) => {
  const clamped = Math.max(0, Math.min(100, percent));
  const isCrit = percent >= critAt;
  const isWarn = !isCrit && percent >= warnAt;

  const barClass = isCrit
    ? 'bg-rose-500'
    : isWarn
      ? 'bg-amber-400'
      : accent === 'teal'
        ? 'bg-[#14B8A6]'
        : accent === 'amber'
          ? 'bg-[#D97706]'
          : 'bg-[#06B6D4]';

  const valClass = isCrit
    ? 'text-rose-400 font-semibold'
    : isWarn
      ? 'text-amber-300 font-semibold'
      : 'text-[#E8EEF7]';

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-[#8C9BB2] truncate">{label}</span>
        <span className={`font-mono tabular-nums shrink-0 ${valClass}`}>{valueText}</span>
      </div>
      <div className="relative h-2 bg-[#06080D] border border-[#1E293B] rounded-[2px] overflow-hidden">
        <div
          className={`h-full transition-all duration-150 ${barClass}`}
          style={{ width: `${clamped}%` }}
        />
        {warnAt > 0 && warnAt < 100 && (
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
          <span>{Math.round(percent)}%</span>
        </div>
      )}
    </div>
  );
};
