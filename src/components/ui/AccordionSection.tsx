import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface AccordionSectionProps {
  indexLabel?: string;
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * Single-elevation collapsible Foundry CAD parameter group with hairline divisions.
 */
export const AccordionSection: React.FC<AccordionSectionProps> = ({
  indexLabel,
  title,
  summary,
  defaultOpen = true,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="bg-[#101521] border border-[#1E293B] rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-[#161D2D]/60 transition-colors cursor-pointer"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? (
            <ChevronDown className="w-3.5 h-3.5 text-[#06B6D4] shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
          )}
          {indexLabel && (
            <span className="font-mono text-[11px] text-[#64748B] shrink-0">{indexLabel}</span>
          )}
          <h2 className="text-xs font-semibold text-[#E8EEF7] tracking-wide truncate">{title}</h2>
        </div>
        {summary && (
          <span className="text-[11px] font-mono tabular-nums text-[#8C9BB2] truncate max-w-[50%] text-right">
            {summary}
          </span>
        )}
      </button>
      {open && <div className="px-4 pb-4 pt-3 border-t border-[#1E293B] space-y-4">{children}</div>}
    </section>
  );
};
