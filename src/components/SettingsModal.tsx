import React from 'react';
import { Keyboard, Settings, X } from 'lucide-react';
import type { UiSettings } from '../engine/types';

interface SettingsModalProps {
  settings: UiSettings;
  companyName: string;
  onUpdateSettings: (patch: Partial<UiSettings>) => void;
  onRenameCompany: (nextName: string) => void;
  onClose: () => void;
}

const SHORTCUTS: { keys: string; desc: string }[] = [
  { keys: 'Space', desc: 'Pause / Resume simulation' },
  { keys: '1 / 2 / 3 / 4', desc: 'Set simulation speed (1×, 2×, 5×, 10×)' },
  { keys: 'Ctrl + K', desc: 'Open Global Command Palette' },
  { keys: 'Ctrl + S', desc: 'Quick Save to Slot 1' },
  { keys: 'Alt + 1..9, 0', desc: 'Switch directly to workspace section' },
  { keys: 'Ctrl + Z / Y', desc: 'Undo / Redo inside CPU, GPU, Memory Architects' },
  { keys: '?', desc: 'Open Settings & Keyboard Shortcuts' },
  { keys: 'Esc', desc: 'Close active modal or drawer' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  companyName,
  onUpdateSettings,
  onRenameCompany,
  onClose,
}) => {
  const [draftCompany, setDraftCompany] = React.useState(companyName);

  const ToggleRow: React.FC<{
    label: string;
    desc: string;
    checked: boolean;
    onChange: (v: boolean) => void;
  }> = ({ label, desc, checked, onChange }) => (
    <label className="flex items-start justify-between gap-4 py-2.5 cursor-pointer">
      <div>
        <div className="text-xs font-medium text-[#E8EEF7]">{label}</div>
        <div className="text-[11px] text-[#8C9BB2] mt-0.5">{desc}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-9 h-5 rounded-[3px] border transition-colors cursor-pointer ${
          checked
            ? 'bg-[#06B6D4]/25 border-[#06B6D4]'
            : 'bg-[#0A0E16] border-[#2C3B55]'
        }`}
      >
        <span
          className={`block w-3.5 h-3.5 rounded-[2px] transition-transform ${
            checked
              ? 'translate-x-[18px] bg-[#22D3EE]'
              : 'translate-x-[2px] bg-[#64748B]'
          }`}
        />
      </button>
    </label>
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Simulation Settings and Keyboard Shortcuts"
    >
      <div
        className="w-full max-w-2xl max-h-[86vh] flex flex-col bg-[#101521] border border-[#2C3B55] rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#0A0E16] border-b border-[#1E293B] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#06B6D4]" />
            <h2 className="text-sm font-semibold text-[#E8EEF7]">
              Foundry Preferences &amp; Controls
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#8C9BB2] hover:text-[#E8EEF7] cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-6">
          {/* Company Identity */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-[#8C9BB2] tracking-wide">
              Company Designation
            </h3>
            <div className="flex items-center gap-2">
              <input
                type="text"
                maxLength={48}
                value={draftCompany}
                onChange={(e) => setDraftCompany(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onRenameCompany(draftCompany);
                }}
                className="flex-1 h-9 px-3 rounded bg-[#0A0E16] border border-[#1E293B] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7]"
              />
              <button
                type="button"
                disabled={!draftCompany.trim() || draftCompany.trim() === companyName}
                onClick={() => onRenameCompany(draftCompany)}
                className="h-9 px-3.5 rounded bg-[#06B6D4] hover:bg-[#22D3EE] disabled:opacity-40 text-[#06080D] text-xs font-semibold cursor-pointer disabled:cursor-not-allowed"
              >
                Save Name
              </button>
            </div>
          </section>

          {/* Granular Auto-Pause Rules */}
          <section className="space-y-1 border-t border-[#1E293B] pt-4">
            <h3 className="text-xs font-semibold text-[#8C9BB2] tracking-wide mb-1">
              Granular Auto-Pause Triggers
            </h3>
            <div className="divide-y divide-[#1E293B]">
              <ToggleRow
                label="Pause on Research Breakthrough"
                desc="Stop simulation clock whenever an R&D technology completes."
                checked={settings.pauseOnResearch ?? settings.pauseOnMilestone}
                onChange={(v) => onUpdateSettings({ pauseOnResearch: v, pauseOnMilestone: v })}
              />
              <ToggleRow
                label="Pause on Tape-Out Completion"
                desc="Stop clock when a new CPU, GPU, or Memory chip passes silicon bring-up."
                checked={settings.pauseOnTapeOut ?? settings.pauseOnMilestone}
                onChange={(v) => onUpdateSettings({ pauseOnTapeOut: v })}
              />
              <ToggleRow
                label="Pause on Facility Construction"
                desc="Stop clock when a new fab, substation, refinery, or upgrade comes online."
                checked={settings.pauseOnConstruction ?? false}
                onChange={(v) => onUpdateSettings({ pauseOnConstruction: v })}
              />
              <ToggleRow
                label="Pause on Entering Treasury Debt"
                desc="Stop clock immediately if Credits drop below zero."
                checked={settings.pauseOnDebt ?? true}
                onChange={(v) => onUpdateSettings({ pauseOnDebt: v })}
              />
              <ToggleRow
                label="Pause on Resource Starvation"
                desc="Stop clock if fabs become throttled by Silicon, Grid MW, or OSAT limits."
                checked={settings.pauseOnStarvation ?? false}
                onChange={(v) => onUpdateSettings({ pauseOnStarvation: v })}
              />
            </div>
          </section>

          {/* Display Preferences */}
          <section className="space-y-1 border-t border-[#1E293B] pt-4">
            <h3 className="text-xs font-semibold text-[#8C9BB2] tracking-wide mb-1">
              Workspace &amp; Telemetry Display
            </h3>
            <div className="divide-y divide-[#1E293B]">
              <ToggleRow
                label="Compact Navigation Rail"
                desc="Collapse left sidebar to icon-only mode (64px) for maximum CAD canvas width."
                checked={Boolean(settings.sidebarCollapsed)}
                onChange={(v) => onUpdateSettings({ sidebarCollapsed: v })}
              />
              <ToggleRow
                label="Compact Data Density"
                desc="Tighten typography slightly for higher viewport telemetry density."
                checked={Boolean(settings.compactDensity)}
                onChange={(v) => onUpdateSettings({ compactDensity: v })}
              />
              <ToggleRow
                label="Default Thermal Flux Overlay"
                desc="Open CPU, GPU, and Memory floorplans in Thermal Flux heatmap mode."
                checked={settings.thermalOverlayDefault}
                onChange={(v) => onUpdateSettings({ thermalOverlayDefault: v })}
              />
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section className="space-y-2 border-t border-[#1E293B] pt-4">
            <h3 className="text-xs font-semibold text-[#8C9BB2] tracking-wide flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5 text-[#06B6D4]" />
              <span>Keyboard Shortcuts</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SHORTCUTS.map((sc) => (
                <div
                  key={sc.keys}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-[#0A0E16] border border-[#1E293B] text-xs"
                >
                  <span className="text-[#CBD5E1]">{sc.desc}</span>
                  <span className="font-mono text-[11px] text-[#22D3EE] shrink-0">{sc.keys}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
