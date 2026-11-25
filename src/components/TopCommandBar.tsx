import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  FastForward,
  Menu,
  Pause,
  Play,
  Save,
  Search,
  Settings,
  ShieldAlert,
} from 'lucide-react';
import { formatCompactNumber, formatSimDate } from '../engine/simulation';
import type { GameState, MainSection, MilestoneEvent, SimulationSpeed } from '../engine/types';

interface TopCommandBarProps {
  state: GameState;
  onSetSpeed: (speed: SimulationSpeed) => void;
  onNavigate: (section: MainSection) => void;
  onQuickSave: () => void;
  onOpenSaveModal: () => void;
  onOpenCommandPalette: () => void;
  onOpenSettings: () => void;
  onOpenMobileMenu: () => void;
  autosaveNotice: string | null;
}

const SPEEDS: SimulationSpeed[] = [0, 1, 2, 5, 10];

function sectionForEventCategory(cat: MilestoneEvent['category']): MainSection {
  switch (cat) {
    case 'research':
      return 'research';
    case 'tapeout':
      return 'manufacturing';
    case 'construction':
      return 'infrastructure';
    case 'warning':
      return 'finances';
    default:
      return 'overview';
  }
}

export const TopCommandBar: React.FC<TopCommandBarProps> = ({
  state,
  onSetSpeed,
  onNavigate,
  onQuickSave,
  onOpenSaveModal,
  onOpenCommandPalette,
  onOpenSettings,
  onOpenMobileMenu,
  autosaveNotice,
}) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const [lastSeenEventId, setLastSeenEventId] = useState<string>(state.events[0]?.id ?? '');
  const notifRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!notifOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [notifOpen]);

  const { clock, telemetry } = state;
  const powerPct =
    telemetry.powerCapacityMW > 0
      ? Math.round((telemetry.powerUsedMW / telemetry.powerCapacityMW) * 100)
      : 100;
  const inDebt = Boolean(telemetry.inDebt) || state.credits < 0;
  const hasResourceAlert =
    inDebt || telemetry.siliconStarved || telemetry.powerDeficit || telemetry.packagingStarved;
  const isPaused = state.speed === 0;

  const netSi = telemetry.monthlySiliconProd - telemetry.monthlySiliconConsumed;
  const runwayMonths =
    telemetry.monthlyCreditNet < 0 && state.credits > 0
      ? state.credits / Math.abs(telemetry.monthlyCreditNet)
      : null;

  const unreadCount = (() => {
    if (!lastSeenEventId) return 0;
    const idx = state.events.findIndex((e) => e.id === lastSeenEventId);
    return idx === -1 ? Math.min(9, state.events.length) : Math.min(9, idx);
  })();

  const handleToggleNotif = () => {
    setNotifOpen((prev) => {
      const next = !prev;
      if (next && state.events[0]) {
        setLastSeenEventId(state.events[0].id);
      }
      return next;
    });
  };

  return (
    <header className="relative h-[52px] shrink-0 bg-[#0A0E16] border-b border-[#1E293B] px-3 lg:px-4 flex items-center justify-between gap-3 select-none">
      {/* Subtle top status edge bar (Amber when Paused, Cyan when Running) */}
      <div
        aria-hidden="true"
        className={`absolute top-0 left-0 right-0 h-[2px] transition-colors ${
          inDebt
            ? 'bg-rose-500/80'
            : isPaused
              ? 'bg-amber-500/75'
              : 'bg-[#06B6D4]/55'
        }`}
      />

      {/* Left: Mobile Drawer Button + EU4 Date + Speed Selector */}
      <div className="flex items-center gap-2.5 lg:gap-3.5 shrink-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden h-8 w-8 rounded bg-[#101521] border border-[#1E293B] text-[#E8EEF7] flex items-center justify-center cursor-pointer"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          <span className="font-mono tabular-nums text-[13px] font-semibold text-[#E8EEF7] tracking-wide whitespace-nowrap">
            {formatSimDate(clock.year, clock.month, clock.day)}
          </span>
          <span
            className={`hidden xl:inline font-mono text-[11px] whitespace-nowrap ${
              isPaused ? 'text-amber-400' : 'text-[#22D3EE]'
            }`}
          >
            {isPaused ? 'PAUSED' : `${state.speed}×`}
          </span>
        </div>

        <div
          className="flex items-center bg-[#101521] border border-[#1E293B] rounded-[5px] p-0.5"
          role="group"
          aria-label="Simulation speed controls"
        >
          {SPEEDS.map((spd) => {
            const active = state.speed === spd;
            return (
              <button
                key={spd}
                type="button"
                onClick={() => onSetSpeed(spd)}
                title={spd === 0 ? 'Pause (Space)' : `Run at ${spd}× speed`}
                className={`h-6 px-2 text-[11px] font-mono font-medium rounded-[3px] flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? spd === 0
                      ? 'bg-[#D97706]/25 text-[#FBBF24] border border-[#D97706]/60'
                      : 'bg-[#06B6D4]/20 text-[#22D3EE] border border-[#06B6D4]/55'
                    : 'text-[#8C9BB2] hover:text-[#E8EEF7] border border-transparent'
                }`}
              >
                {spd === 0 ? (
                  <Pause className="w-3 h-3" />
                ) : spd === 1 ? (
                  <>
                    <Play className="w-2.5 h-2.5" />
                    <span>1×</span>
                  </>
                ) : spd === 10 ? (
                  <>
                    <FastForward className="w-3 h-3" />
                    <span>10×</span>
                  </>
                ) : (
                  <span>{spd}×</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Center: Clickable Drill-Down Resource Counters with Hover Telemetry Popovers */}
      <div className="flex items-center gap-1 md:gap-2 overflow-x-auto no-scrollbar">
        {/* Credits */}
        <div className="relative group">
          <button
            type="button"
            onClick={() => onNavigate('finances')}
            className="px-2 py-1 rounded hover:bg-[#101521] flex items-baseline gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
            title="Open Finances & Workforce"
          >
            <span className="text-[11px] text-[#8C9BB2]">CR</span>
            <span
              className={`font-mono tabular-nums text-[13px] font-semibold ${
                inDebt ? 'text-rose-400' : 'text-[#E8EEF7]'
              }`}
            >
              {formatCompactNumber(state.credits, 1)}
            </span>
            <span
              className={`hidden sm:inline font-mono tabular-nums text-[11px] ${
                telemetry.monthlyCreditNet >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {telemetry.monthlyCreditNet >= 0 ? '+' : ''}
              {formatCompactNumber(telemetry.monthlyCreditNet, 0)}
            </span>
          </button>
          <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity fixed md:absolute left-0 top-full mt-1.5 w-60 bg-[#101521] border border-[#2C3B55] rounded-md p-3 shadow-2xl z-50 text-[11px] space-y-1">
            <div className="font-semibold text-[#E8EEF7] border-b border-[#1E293B] pb-1">
              Treasury &amp; Cash Flow (Click to open)
            </div>
            <div className="flex justify-between font-mono tabular-nums">
              <span className="text-[#8C9BB2]">Demand Revenue</span>
              <span className="text-emerald-400">+{formatCompactNumber(telemetry.monthlyCreditIncome, 1)}/mo</span>
            </div>
            <div className="flex justify-between font-mono tabular-nums">
              <span className="text-[#8C9BB2]">Payroll + Upkeep</span>
              <span className="text-[#E8EEF7]">
                −{formatCompactNumber(telemetry.monthlyPayrollCR + telemetry.monthlyUpkeepCR, 1)}/mo
              </span>
            </div>
            {runwayMonths !== null && (
              <div className="flex justify-between font-mono tabular-nums text-rose-400 pt-1 border-t border-[#1E293B]">
                <span>Runway to Debt</span>
                <span>{runwayMonths.toFixed(1)} mo</span>
              </div>
            )}
          </div>
        </div>

        <span className="text-[#1E293B]" aria-hidden="true">|</span>

        {/* Silicon */}
        <div className="relative group">
          <button
            type="button"
            onClick={() => onNavigate('manufacturing')}
            className="px-2 py-1 rounded hover:bg-[#101521] flex items-baseline gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
            title="Open Manufacturing & Fabs"
          >
            <span className="text-[11px] text-[#8C9BB2]">Si</span>
            <span
              className={`font-mono tabular-nums text-[13px] font-semibold ${
                telemetry.siliconStarved ? 'text-amber-400' : 'text-[#E8EEF7]'
              }`}
            >
              {formatCompactNumber(state.silicon, 1)}
            </span>
            <span
              className={`hidden md:inline font-mono tabular-nums text-[11px] ${
                netSi >= 0 ? 'text-[#8C9BB2]' : 'text-amber-400'
              }`}
            >
              {netSi >= 0 ? '+' : ''}
              {formatCompactNumber(netSi, 0)}
            </span>
          </button>
          <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity hidden md:block absolute left-0 top-full mt-1.5 w-60 bg-[#101521] border border-[#2C3B55] rounded-md p-3 shadow-2xl z-50 text-[11px] space-y-1">
            <div className="font-semibold text-[#E8EEF7] border-b border-[#1E293B] pb-1">
              Refined Silicon Feedstock
            </div>
            <div className="flex justify-between font-mono tabular-nums">
              <span className="text-[#8C9BB2]">Refinery Output</span>
              <span className="text-emerald-400">+{formatCompactNumber(telemetry.monthlySiliconProd, 0)}/mo</span>
            </div>
            <div className="flex justify-between font-mono tabular-nums">
              <span className="text-[#8C9BB2]">Fab Consumption</span>
              <span className="text-[#E8EEF7]">−{formatCompactNumber(telemetry.monthlySiliconConsumed, 0)}/mo</span>
            </div>
            <div className="flex justify-between font-mono tabular-nums pt-1 border-t border-[#1E293B]">
              <span className="text-[#8C9BB2]">OSAT Pkg Load</span>
              <span className={telemetry.packagingStarved ? 'text-amber-400' : 'text-[#CBD5E1]'}>
                {Math.round(
                  (telemetry.packagingUsedPerMonth / Math.max(1, telemetry.packagingCapacityPerMonth)) * 100
                )}
                %
              </span>
            </div>
          </div>
        </div>

        <span className="text-[#1E293B]" aria-hidden="true">|</span>

        {/* Grid Power */}
        <div className="relative group">
          <button
            type="button"
            onClick={() => onNavigate('infrastructure')}
            className="px-2 py-1 rounded hover:bg-[#101521] flex items-baseline gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
            title="Open Infrastructure & Power Grid"
          >
            <span className="text-[11px] text-[#8C9BB2]">Grid</span>
            <span
              className={`font-mono tabular-nums text-[13px] font-semibold ${
                telemetry.powerDeficit
                  ? 'text-rose-400'
                  : powerPct > 85
                    ? 'text-amber-400'
                    : 'text-[#E8EEF7]'
              }`}
            >
              {telemetry.powerUsedMW.toFixed(0)}/{telemetry.powerCapacityMW.toFixed(0)}
              <span className="text-[10px] font-normal text-[#64748B] ml-0.5">MW</span>
            </span>
          </button>
          <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity hidden md:block absolute left-0 top-full mt-1.5 w-56 bg-[#101521] border border-[#2C3B55] rounded-md p-3 shadow-2xl z-50 text-[11px] space-y-1">
            <div className="font-semibold text-[#E8EEF7] border-b border-[#1E293B] pb-1">
              Electrical Grid Capacity
            </div>
            <div className="flex justify-between font-mono tabular-nums">
              <span className="text-[#8C9BB2]">Utilization</span>
              <span className={powerPct > 90 ? 'text-amber-400' : 'text-[#22D3EE]'}>{powerPct}%</span>
            </div>
            <div className="flex justify-between font-mono tabular-nums">
              <span className="text-[#8C9BB2]">Headroom</span>
              <span className={telemetry.powerDeficit ? 'text-rose-400' : 'text-emerald-400'}>
                {(telemetry.powerCapacityMW - telemetry.powerUsedMW).toFixed(1)} MW
              </span>
            </div>
          </div>
        </div>

        <span className="text-[#1E293B]" aria-hidden="true">|</span>

        {/* Research Output */}
        <div className="relative group">
          <button
            type="button"
            onClick={() => onNavigate('research')}
            className="px-2 py-1 rounded hover:bg-[#101521] flex items-baseline gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
            title="Open Research & Labs"
          >
            <span className="text-[11px] text-[#8C9BB2]">R&amp;D</span>
            <span className="font-mono tabular-nums text-[13px] font-semibold text-[#22D3EE]">
              +{telemetry.rpPerDay.toFixed(1)}
              <span className="text-[10px] font-normal text-[#64748B] ml-0.5">RP/d</span>
            </span>
          </button>
          <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity hidden md:block absolute right-0 top-full mt-1.5 w-56 bg-[#101521] border border-[#2C3B55] rounded-md p-3 shadow-2xl z-50 text-[11px] space-y-1">
            <div className="font-semibold text-[#E8EEF7] border-b border-[#1E293B] pb-1">
              Research Output
            </div>
            <div className="flex justify-between font-mono tabular-nums">
              <span className="text-[#8C9BB2]">Active Projects</span>
              <span className="text-[#22D3EE]">{state.activeResearch.length}</span>
            </div>
            <div className="flex justify-between font-mono tabular-nums">
              <span className="text-[#8C9BB2]">Banked RP</span>
              <span className="text-[#E8EEF7]">{formatCompactNumber(state.researchPointsBank, 0)} RP</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Alert + Command Palette + Notifications + Settings + Quick-Save / Save Modal */}
      <div className="flex items-center gap-1.5 shrink-0">
        {hasResourceAlert && (
          <button
            type="button"
            onClick={() => onNavigate(inDebt ? 'finances' : 'infrastructure')}
            className={`hidden xl:inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded cursor-pointer whitespace-nowrap ${
              inDebt
                ? 'text-rose-400 hover:bg-rose-950/40'
                : 'text-amber-400 hover:bg-amber-950/40'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>
              {inDebt
                ? 'In Debt'
                : telemetry.powerDeficit
                  ? 'Power Deficit'
                  : telemetry.siliconStarved
                    ? 'Silicon Deficit'
                    : 'OSAT Cap'}
            </span>
          </button>
        )}

        {autosaveNotice && !hasResourceAlert && (
          <span className="hidden 2xl:inline text-[11px] font-mono text-[#8C9BB2] whitespace-nowrap mr-1">
            {autosaveNotice}
          </span>
        )}

        {/* Ctrl+K Command Palette */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          title="Command Palette (Ctrl+K)"
          className="h-8 px-2.5 text-xs bg-[#101521] hover:bg-[#161D2D] text-[#8C9BB2] hover:text-[#E8EEF7] border border-[#1E293B] rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
        >
          <Search className="w-3.5 h-3.5 text-[#06B6D4]" />
          <span className="hidden xl:inline font-mono text-[10px] text-[#64748B]">Ctrl+K</span>
        </button>

        {/* Notification History Popover */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={handleToggleNotif}
            title="Recent Empire Notifications"
            aria-label="Recent Empire Notifications"
            className="relative h-8 w-8 bg-[#101521] hover:bg-[#161D2D] text-[#8C9BB2] hover:text-[#E8EEF7] border border-[#1E293B] rounded-md flex items-center justify-center transition-colors cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded bg-[#06B6D4] text-[#06080D] font-mono text-[10px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-80 max-w-[calc(100vw-2rem)] bg-[#101521] border border-[#2C3B55] rounded-md shadow-2xl z-50 overflow-hidden">
              <div className="px-3.5 py-2.5 bg-[#0A0E16] border-b border-[#1E293B] flex items-center justify-between">
                <span className="text-xs font-semibold text-[#E8EEF7]">Notification Feed</span>
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen(false);
                    onNavigate('overview');
                  }}
                  className="text-[11px] text-[#22D3EE] hover:text-[#67E8F9] cursor-pointer"
                >
                  Full Chronicle
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-[#1E293B]">
                {state.events.slice(0, 12).map((evt) => (
                  <button
                    key={evt.id}
                    type="button"
                    onClick={() => {
                      onNavigate(sectionForEventCategory(evt.category));
                      setNotifOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-[#161D2D]/60 transition-colors cursor-pointer space-y-0.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-[#E8EEF7] truncate">
                        {evt.title}
                      </span>
                      <span className="font-mono tabular-nums text-[10px] text-[#64748B] shrink-0">
                        {formatSimDate(evt.year, evt.month, evt.day)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8C9BB2] line-clamp-2">{evt.detail}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Settings & Auto-Pause Rules */}
        <button
          type="button"
          onClick={onOpenSettings}
          title="Settings, Auto-Pause & Shortcuts (?)"
          aria-label="Settings and Shortcuts"
          className="h-8 w-8 bg-[#101521] hover:bg-[#161D2D] text-[#8C9BB2] hover:text-[#E8EEF7] border border-[#1E293B] rounded-md flex items-center justify-center transition-colors cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        {/* Quick-Save + Save/Load Split Button */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={onQuickSave}
            title="Quick Save to Slot 1 (Ctrl+S)"
            className="h-8 px-2.5 text-xs font-medium bg-[#101521] hover:bg-[#161D2D] text-[#E8EEF7] border border-[#1E293B] hover:border-[#2C3B55] rounded-l-md flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Save className="w-3.5 h-3.5 text-[#06B6D4]" />
            <span className="hidden sm:inline">Save</span>
          </button>
          <button
            type="button"
            onClick={onOpenSaveModal}
            title="Manage Save Slots, Autosaves & JSON Export"
            className="h-8 px-2 text-[11px] font-mono bg-[#0A0E16] hover:bg-[#161D2D] text-[#8C9BB2] hover:text-[#E8EEF7] border border-l-0 border-[#1E293B] hover:border-[#2C3B55] rounded-r-md transition-colors whitespace-nowrap cursor-pointer"
          >
            Slots
          </button>
        </div>
      </div>
    </header>
  );
};
