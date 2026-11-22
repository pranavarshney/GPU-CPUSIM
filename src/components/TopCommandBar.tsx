import React from 'react';
import { Pause, Play, FastForward, Save, ShieldAlert } from 'lucide-react';
import { formatCompactNumber, formatSimDate } from '../engine/simulation';
import type { GameState, SimulationSpeed, UiSettings } from '../engine/types';

interface TopCommandBarProps {
  state: GameState;
  uiSettings: UiSettings;
  onSetSpeed: (speed: SimulationSpeed) => void;
  onTogglePauseOnMilestone: () => void;
  onOpenSaveModal: () => void;
  autosaveNotice: string | null;
}

const SPEEDS: SimulationSpeed[] = [0, 1, 2, 5, 10];

export const TopCommandBar: React.FC<TopCommandBarProps> = ({
  state,
  uiSettings,
  onSetSpeed,
  onTogglePauseOnMilestone,
  onOpenSaveModal,
  autosaveNotice,
}) => {
  const { clock, telemetry } = state;
  const powerPct =
    telemetry.powerCapacityMW > 0
      ? Math.round((telemetry.powerUsedMW / telemetry.powerCapacityMW) * 100)
      : 100;
  const inDebt = Boolean(telemetry.inDebt) || state.credits < 0;
  const hasResourceAlert =
    inDebt || telemetry.siliconStarved || telemetry.powerDeficit || telemetry.packagingStarved;

  return (
    <header className="h-[52px] shrink-0 bg-[#0B0F17] border-b border-[#1F2A3D] px-4 flex items-center justify-between gap-4 select-none">
      {/* Left: EU4 Date & Speed Controls */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="font-mono tabular-nums text-sm font-semibold text-[#E8EEF7] tracking-wide whitespace-nowrap">
            {formatSimDate(clock.year, clock.month, clock.day)}
          </span>
          <span className="text-xs text-[#8C9BB2] whitespace-nowrap hidden xl:inline">
            {state.speed === 0 ? 'Paused' : `${state.speed}×`}
          </span>
        </div>

        <div
          className="flex items-center bg-[#111622] border border-[#1F2A3D] rounded-md p-0.5"
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
                className={`h-7 px-2.5 text-xs font-mono font-medium rounded-[4px] flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? spd === 0
                      ? 'bg-[#D97706]/20 text-[#FBBF24] border border-[#D97706]/50'
                      : 'bg-[#06B6D4]/20 text-[#22D3EE] border border-[#06B6D4]/50'
                    : 'text-[#8C9BB2] hover:text-[#E8EEF7] border border-transparent'
                }`}
              >
                {spd === 0 ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : spd === 1 ? (
                  <>
                    <Play className="w-3 h-3" />
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

        <button
          type="button"
          onClick={onTogglePauseOnMilestone}
          title="Automatically pause when research, tape-out, or facility construction completes"
          className={`hidden 2xl:inline-flex items-center text-xs px-2 py-1 rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            uiSettings.pauseOnMilestone
              ? 'border-[#1F2A3D] bg-[#111622] text-[#E8EEF7]'
              : 'border-transparent text-[#8C9BB2] hover:text-[#E8EEF7]'
          }`}
        >
          Auto-pause: {uiSettings.pauseOnMilestone ? 'On' : 'Off'}
        </button>
      </div>

      {/* Center: Abstract Economy & Physical Resource Counters */}
      <div className="flex items-center gap-5 overflow-x-auto no-scrollbar">
        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span className="text-xs text-[#8C9BB2]">Credits</span>
          <span
            className={`font-mono tabular-nums text-sm font-semibold ${
              inDebt ? 'text-rose-400' : 'text-[#E8EEF7]'
            }`}
          >
            {formatCompactNumber(state.credits, 1)}
          </span>
          <span
            className={`font-mono tabular-nums text-xs ${
              telemetry.monthlyCreditNet >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            ({telemetry.monthlyCreditNet >= 0 ? '+' : ''}
            {formatCompactNumber(telemetry.monthlyCreditNet, 0)}/mo)
          </span>
        </div>

        <span className="text-[#1F2A3D]" aria-hidden="true">
          |
        </span>

        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span className="text-xs text-[#8C9BB2]">Silicon</span>
          <span
            className={`font-mono tabular-nums text-sm font-semibold ${
              telemetry.siliconStarved ? 'text-amber-400' : 'text-[#E8EEF7]'
            }`}
          >
            {formatCompactNumber(state.silicon, 1)}
          </span>
          <span className="font-mono tabular-nums text-xs text-[#8C9BB2]">
            ({telemetry.monthlySiliconProd - telemetry.monthlySiliconConsumed >= 0 ? '+' : ''}
            {formatCompactNumber(
              telemetry.monthlySiliconProd - telemetry.monthlySiliconConsumed,
              0
            )}
            /mo)
          </span>
        </div>

        <span className="text-[#1F2A3D]" aria-hidden="true">
          |
        </span>

        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span className="text-xs text-[#8C9BB2]">Grid</span>
          <span
            className={`font-mono tabular-nums text-sm font-semibold ${
              telemetry.powerDeficit
                ? 'text-rose-400'
                : powerPct > 85
                  ? 'text-amber-400'
                  : 'text-[#E8EEF7]'
            }`}
          >
            {telemetry.powerUsedMW.toFixed(1)}/{telemetry.powerCapacityMW.toFixed(0)} MW
          </span>
        </div>

        <span className="text-[#1F2A3D]" aria-hidden="true">
          |
        </span>

        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span className="text-xs text-[#8C9BB2]">Research</span>
          <span className="font-mono tabular-nums text-sm font-semibold text-[#22D3EE]">
            +{telemetry.rpPerDay.toFixed(1)} RP/d
          </span>
        </div>
      </div>

      {/* Right: Resource Warning (if real) + Save / Load */}
      <div className="flex items-center gap-3 shrink-0">
        {hasResourceAlert && (
          <span
            className={`hidden lg:inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap ${
              inDebt ? 'text-rose-400' : 'text-amber-400'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            {inDebt
              ? 'In Debt'
              : telemetry.powerDeficit
                ? 'Power Deficit'
                : telemetry.siliconStarved
                  ? 'Silicon Deficit'
                  : 'Packaging Cap'}
          </span>
        )}
        {autosaveNotice && !hasResourceAlert && (
          <span className="hidden lg:inline text-xs text-[#8C9BB2] whitespace-nowrap">
            {autosaveNotice}
          </span>
        )}
        <button
          type="button"
          onClick={onOpenSaveModal}
          className="h-8 px-3 text-xs font-medium bg-[#111622] hover:bg-[#171E2E] text-[#E8EEF7] border border-[#1F2A3D] hover:border-[#2C3B55] rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Save className="w-3.5 h-3.5 text-[#06B6D4]" />
          <span>Save / Load</span>
        </button>
      </div>
    </header>
  );
};
