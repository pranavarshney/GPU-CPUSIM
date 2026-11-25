import React, { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { PHYSICS_DOCUMENTATION } from '../engine/physics';

interface PhysicsReferenceModalProps {
  onClose: () => void;
}

export const PhysicsReferenceModal: React.FC<PhysicsReferenceModalProps> = ({ onClose }) => {
  const [query, setQuery] = useState('');

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PHYSICS_DOCUMENTATION;
    return PHYSICS_DOCUMENTATION.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.equation.toLowerCase().includes(q) ||
        e.assumptions.toLowerCase().includes(q) ||
        e.units.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Semiconductor Physics Model Documentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl bg-[#101521] border border-[#2C3B55] rounded-lg overflow-hidden shadow-2xl">
        <div className="px-5 py-3.5 bg-[#0A0E16] border-b border-[#1E293B] flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#E8EEF7]">
              Semiconductor Physics &amp; Yield Kernel Documentation
            </h2>
            <p className="text-xs text-[#8C9BB2]">
              Governing equations, SI engineering units, assumptions, and explicit model limitations
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-[#8C9BB2] hover:text-[#E8EEF7] hover:bg-[#161D2D] cursor-pointer"
            aria-label="Close documentation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-2.5 bg-[#0A0E16]/70 border-b border-[#1E293B]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter equations, symbols, units (e.g. Murphy, Vmin, Carnot, Roofline, NAND)..."
              className="w-full h-8 pl-8 pr-3 rounded bg-[#06080D] border border-[#1E293B] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7] placeholder:text-[#64748B]"
            />
          </div>
        </div>

        <div className="p-5 space-y-3.5 max-h-[70vh] overflow-y-auto">
          {filteredEntries.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#64748B]">
              No physics equations match &ldquo;{query}&rdquo;.
            </div>
          ) : (
            filteredEntries.map((entry) => (
              <div
                key={entry.title}
                className="p-3.5 rounded-md bg-[#0A0E16] border border-[#1E293B] space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#E8EEF7]">{entry.title}</h3>
                  <span className="text-xs font-mono text-[#D97706]">{entry.units}</span>
                </div>
                <div className="font-mono text-xs text-[#22D3EE] bg-[#06080D] border border-[#1E293B] rounded px-3 py-2 overflow-x-auto">
                  {entry.equation}
                </div>
                <p className="text-xs text-[#8C9BB2] leading-relaxed">{entry.assumptions}</p>
              </div>
            ))
          )}

          <div className="p-3.5 rounded-md bg-[#0A0E16] border border-[#1E293B] space-y-1">
            <h3 className="text-sm font-semibold text-[#E8EEF7]">Explicit Model Limitations</h3>
            <p className="text-xs text-[#8C9BB2] leading-relaxed">
              The physics kernel evaluates steady-state DC thermal equilibrium rather than transient
              millisecond turbo thermal capacitance, approximates spatial defect clustering via
              Murphy&apos;s squared-Poisson model, and models macro-architectural Roofline dynamics
              rather than cycle-accurate RTL gate propagation. All calculations execute in a pure,
              framework-independent simulation module cached across multi-millennia runs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
