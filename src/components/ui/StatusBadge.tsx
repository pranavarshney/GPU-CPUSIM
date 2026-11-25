import React from 'react';

export type StatusTone = 'nominal' | 'warning' | 'critical' | 'idle' | 'muted' | 'info';

interface StatusBadgeProps {
  tone: StatusTone;
  label: string;
  compact?: boolean;
  className?: string;
}

const TONE_MAP: Record<StatusTone, { glyph: string; cls: string }> = {
  nominal: { glyph: '●', cls: 'text-emerald-400' },
  warning: { glyph: '▲', cls: 'text-amber-400' },
  critical: { glyph: '✖', cls: 'text-rose-400' },
  idle: { glyph: '○', cls: 'text-[#8C9BB2]' },
  muted: { glyph: '○', cls: 'text-[#8C9BB2]' },
  info: { glyph: '◆', cls: 'text-[#22D3EE]' },
};

/**
 * Cleanroom telemetry status indicator: text-first with semantic glyph, zero static pills.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  tone,
  label,
  compact = false,
  className = '',
}) => {
  const cfg = TONE_MAP[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono ${
        compact ? 'text-[10px]' : 'text-[11px]'
      } font-medium whitespace-nowrap ${cfg.cls} ${className}`}
    >
      <span aria-hidden="true" className="text-[9px] leading-none">
        {cfg.glyph}
      </span>
      <span>{label}</span>
    </span>
  );
};
