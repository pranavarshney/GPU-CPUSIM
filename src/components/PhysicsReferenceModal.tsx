import React from 'react';
import { X } from 'lucide-react';
import { PHYSICS_DOCUMENTATION } from '../engine/physics';

interface PhysicsReferenceModalProps {
  onClose: () => void;
}

export const PhysicsReferenceModal: React.FC<PhysicsReferenceModalProps> = ({ onClose }) => {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Semiconductor Physics Model Documentation"
    >
      <div className="w-full max-w-3xl bg-[#111622] border border-[#2C3B55] rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#1F2A3D] flex items-center justify-between">
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
            className="p-1.5 rounded text-[#8C9BB2] hover:text-[#E8EEF7] hover:bg-[#171E2E] cursor-pointer"
            aria-label="Close documentation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {PHYSICS_DOCUMENTATION.map((entry) => (
            <div
              key={entry.title}
              className="p-3.5 rounded-md bg-[#0B0F17] border border-[#1F2A3D] space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#E8EEF7]">{entry.title}</h3>
                <span className="text-xs font-mono text-[#D97706]">{entry.units}</span>
              </div>
              <div className="font-mono text-xs text-[#22D3EE] bg-[#07090E] border border-[#1F2A3D] rounded px-3 py-2 overflow-x-auto">
                {entry.equation}
              </div>
              <p className="text-xs text-[#8C9BB2] leading-relaxed">{entry.assumptions}</p>
            </div>
          ))}

          <div className="p-3.5 rounded-md bg-[#0B0F17] border border-[#1F2A3D] space-y-1">
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
