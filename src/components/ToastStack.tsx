import React from 'react';
import { ArrowRight, X } from 'lucide-react';
import type { MainSection } from '../engine/types';

export interface ToastItem {
  id: string;
  title: string;
  detail: string;
  tone?: 'info' | 'warning' | 'critical' | 'nominal';
  actionSection?: MainSection;
  actionLabel?: string;
}

interface ToastStackProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  onNavigate: (section: MainSection) => void;
}

export const ToastStack: React.FC<ToastStackProps> = ({ toasts, onDismiss, onNavigate }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-40 flex flex-col gap-2 w-[340px] max-w-[calc(100vw-2rem)]"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const borderCls =
          t.tone === 'critical'
            ? 'border-rose-500/60'
            : t.tone === 'warning'
              ? 'border-amber-500/60'
              : t.tone === 'nominal'
                ? 'border-emerald-500/60'
                : 'border-[#06B6D4]/60';
        const titleCls =
          t.tone === 'critical'
            ? 'text-rose-300'
            : t.tone === 'warning'
              ? 'text-amber-300'
              : t.tone === 'nominal'
                ? 'text-emerald-300'
                : 'text-[#22D3EE]';

        return (
          <div
            key={t.id}
            className={`bg-[#101521] border ${borderCls} rounded-md px-3.5 py-2.5 shadow-xl space-y-1`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className={`text-xs font-semibold ${titleCls}`}>{t.title}</div>
              <button
                type="button"
                onClick={() => onDismiss(t.id)}
                className="text-[#64748B] hover:text-[#E8EEF7] cursor-pointer shrink-0"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="text-[11px] text-[#CBD5E1] leading-relaxed">{t.detail}</div>
            {t.actionSection && (
              <button
                type="button"
                onClick={() => {
                  onNavigate(t.actionSection!);
                  onDismiss(t.id);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#22D3EE] hover:text-[#67E8F9] pt-0.5 cursor-pointer"
              >
                <span>{t.actionLabel ?? 'Inspect'}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};
