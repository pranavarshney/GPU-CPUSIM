import React, { useMemo, useState } from 'react';
import { Minus, Plus, Users } from 'lucide-react';
import { StatusBadge } from '../components/ui/StatusBadge';
import {
  formatCompactNumber,
  getStaffImpactSummary,
  STAFF_MONTHLY_PAYROLL_CR,
} from '../engine/simulation';
import type { DepartmentStaff, GameState, HistoryPoint } from '../engine/types';

interface FinancesViewProps {
  state: GameState;
  onAdjustStaff: (dept: keyof DepartmentStaff, delta: number) => void;
}

const DEPARTMENTS: {
  key: keyof DepartmentStaff;
  title: string;
  role: string;
}[] = [
  {
    key: 'research',
    title: 'Physics & Lithography R&D',
    role: 'Generates +0.52 RP/day per engineer (amplified by lab and tech multipliers).',
  },
  {
    key: 'architecture',
    title: 'Silicon Architecture & Verification',
    role: 'Accelerates chip Tape-Out engineering speed and adds +0.22 RP/day per engineer.',
  },
  {
    key: 'fabrication',
    title: 'Fabrication Operations',
    role: 'Increases effective wafer capacity across all fabs via shift optimization (up to 1.50×).',
  },
  {
    key: 'qa',
    title: 'Metrology & Quality Assurance',
    role: 'Raises effective QA screening level and wafer yield reliability across all fab lines.',
  },
];

const FinancialHistoryChart: React.FC<{
  data: HistoryPoint[];
  mode: 'credits' | 'net';
}> = ({ data, mode }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (data.length < 2) {
    return (
      <div className="h-[176px] flex items-center justify-center text-xs text-[#64748B]">
        Advance at least two simulated months to plot treasury and net cash-flow history.
      </div>
    );
  }

  const w = 660;
  const h = 176;
  const padX = 14;
  const padTop = 22;
  const padBottom = 18;

  const key = mode === 'credits' ? 'credits' : 'monthlyCreditNet';
  const vals = data.map((d) => d[key]);
  const minVal = Math.min(0, ...vals);
  const maxVal = Math.max(1, ...vals);
  const range = Math.max(1e-6, maxVal - minVal);

  const yFor = (v: number) => h - padBottom - ((v - minVal) / range) * (h - padTop - padBottom);
  const zeroY = yFor(0);

  const coords = data.map((d, i) => ({
    x: padX + (i / (data.length - 1)) * (w - padX * 2),
    y: yFor(d[key]),
    point: d,
  }));

  const pts = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`);
  const strokeColor = mode === 'credits' ? '#D97706' : '#10B981';
  const active = hoverIdx !== null ? coords[Math.min(coords.length - 1, hoverIdx)] : null;

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * w;
    const t = Math.max(0, Math.min(1, (relX - padX) / Math.max(1, w - padX * 2)));
    setHoverIdx(Math.round(t * (data.length - 1)));
  };

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-[176px] cursor-crosshair select-none"
        role="img"
        aria-label="Financial trajectory chart"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {[0, 0.5, 1].map((frac) => {
          const y = padTop + frac * (h - padTop - padBottom);
          return (
            <line
              key={frac}
              x1={padX}
              x2={w - padX}
              y1={y}
              y2={y}
              stroke="#1E293B"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          );
        })}
        {/* Zero reference baseline */}
        <line
          x1={padX}
          x2={w - padX}
          y1={zeroY}
          y2={zeroY}
          stroke="#475569"
          strokeWidth="1"
        />
        <polyline fill="none" stroke={strokeColor} strokeWidth="2" points={pts.join(' ')} />
        {active && (
          <g>
            <line
              x1={active.x}
              x2={active.x}
              y1={padTop}
              y2={h - padBottom}
              stroke="#94A3B8"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            <circle
              cx={active.x}
              cy={active.y}
              r="3.8"
              fill="#06080D"
              stroke={strokeColor}
              strokeWidth="2"
            />
          </g>
        )}
        <text
          x={padX}
          y="13"
          fill="#8C9BB2"
          fontSize="10"
          fontFamily="ui-monospace, SFMono-Regular, Consolas, Menlo, monospace"
        >
          Peak: {formatCompactNumber(maxVal, 1)} CR{mode === 'net' ? '/mo' : ''}
        </text>
        <text
          x={w - padX}
          y="13"
          textAnchor="end"
          fill="#8C9BB2"
          fontSize="10"
          fontFamily="ui-monospace, SFMono-Regular, Consolas, Menlo, monospace"
        >
          Y{String(data[0].year).padStart(4, '0')} – Y{String(data[data.length - 1].year).padStart(4, '0')}
        </text>
      </svg>

      {active && (
        <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded bg-[#101521]/95 border border-[#2C3B55] text-[11px] font-mono tabular-nums text-[#E8EEF7] flex items-center gap-2.5 shadow-lg">
          <span className="text-[#8C9BB2]">
            Y{String(active.point.year).padStart(4, '0')} · M{String(active.point.month).padStart(2, '0')}
          </span>
          <span className="text-[#FBBF24]">
            Bal {formatCompactNumber(active.point.credits, 1)} CR
          </span>
          <span
            className={active.point.monthlyCreditNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}
          >
            Net {active.point.monthlyCreditNet >= 0 ? '+' : ''}
            {formatCompactNumber(active.point.monthlyCreditNet, 1)}/m
          </span>
        </div>
      )}
    </div>
  );
};

export const FinancesView: React.FC<FinancesViewProps> = ({ state, onAdjustStaff }) => {
  const [chartMode, setChartMode] = useState<'credits' | 'net'>('credits');
  const [chartSpan, setChartSpan] = useState<'monthly' | 'long'>('monthly');

  const { telemetry } = state;
  const totalHeadcount =
    state.staff.research +
    state.staff.architecture +
    state.staff.fabrication +
    state.staff.qa;
  const staffImpact = useMemo(() => getStaffImpactSummary(state), [state]);

  const inDebt = Boolean(telemetry.inDebt) || state.credits < 0;
  const totalMonthlyOpex = Math.max(1, telemetry.monthlyPayrollCR + telemetry.monthlyUpkeepCR);
  const qaOpex = (state.qaBudgetLevel - 1) * 140;
  const staffPayrollOnly = Math.max(0, telemetry.monthlyPayrollCR - qaOpex);

  const opexSegments = [
    { label: 'Engineering Payroll', val: staffPayrollOnly, color: '#06B6D4' },
    { label: 'Facility Upkeep', val: telemetry.monthlyUpkeepCR, color: '#D97706' },
    { label: 'QA Program', val: qaOpex, color: '#14B8A6' },
  ];

  const runwayLabel = useMemo(() => {
    if (inDebt) return 'In Deficit';
    if (telemetry.monthlyCreditNet >= 0) {
      const projectedYear = state.credits + telemetry.monthlyCreditNet * 12;
      return `12m Proj: ${formatCompactNumber(projectedYear, 1)} CR`;
    }
    const monthsLeft = Math.max(0, state.credits / Math.abs(telemetry.monthlyCreditNet));
    return `Runway: ${monthsLeft.toFixed(1)} months`;
  }, [inDebt, telemetry.monthlyCreditNet, state.credits]);

  const impactReadout = (key: keyof DepartmentStaff): string => {
    switch (key) {
      case 'research':
        return `+${staffImpact.researchRpPerDay.toFixed(1)} RP/day`;
      case 'architecture':
        return `${staffImpact.tapeOutSpeedMult.toFixed(2)}× tape-out · +${staffImpact.architectureRpPerDay.toFixed(1)} RP/d`;
      case 'fabrication':
        return `${staffImpact.fabThroughputMult.toFixed(2)}× wafer throughput`;
      case 'qa':
        return `+${staffImpact.qaLevelBonus.toFixed(2)} QA yield tier`;
    }
  };

  return (
    <div className="p-5 lg:p-6 max-w-[1480px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#1E293B] pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#E8EEF7] tracking-tight">
              Finances &amp; Company Operations
            </h1>
            <StatusBadge
              tone={inDebt ? 'critical' : telemetry.monthlyCreditNet < 0 ? 'warning' : 'nominal'}
              label={
                inDebt
                  ? 'Treasury In Debt'
                  : telemetry.monthlyCreditNet < 0
                    ? 'Net Burn'
                    : 'Surplus Compounding'
              }
            />
          </div>
          <p className="text-xs text-[#8C9BB2] mt-1 font-mono tabular-nums">
            Civilization Compute Demand revenue funds infrastructure, R&amp;D, tape-outs, and {totalHeadcount} engineering personnel
          </p>
        </div>
        <div className="text-right font-mono tabular-nums">
          <div className="text-sm text-[#E8EEF7]">
            Treasury:{' '}
            <span className={`font-semibold ${inDebt ? 'text-rose-400' : 'text-[#22D3EE]'}`}>
              {formatCompactNumber(state.credits, 1)} CR
            </span>
          </div>
          <div className="text-[11px] text-[#8C9BB2]">{runwayLabel}</div>
        </div>
      </div>

      {inDebt && (
        <div className="px-4 py-3 rounded-md bg-rose-950/45 border border-rose-500/40 text-xs text-rose-200">
          <span className="font-semibold">Treasury In Debt:</span> New tape-outs, facility construction, and facility upgrades are suspended until credits return to a positive balance. Trim payroll or expand active chip shipments to restore surplus.
        </div>
      )}

      {/* Monthly Cash Flow Ledger Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-[#101521] border border-[#1E293B] rounded-lg p-4 space-y-1">
          <div className="text-xs text-[#8C9BB2]">Civilization Demand Revenue</div>
          <div className="text-2xl font-mono tabular-nums font-bold text-emerald-400">
            +{formatCompactNumber(telemetry.monthlyCreditIncome, 1)}
            <span className="text-xs font-normal text-[#8C9BB2] ml-1.5">CR/mo</span>
          </div>
          <div className="text-xs text-[#8C9BB2] font-mono tabular-nums">
            Full-stack synergy {telemetry.activeChipEcosystemBonus.toFixed(2)}× / 1.68×
          </div>
        </div>

        <div className="bg-[#101521] border border-[#1E293B] rounded-lg p-4 space-y-1">
          <div className="text-xs text-[#8C9BB2]">Engineering Payroll &amp; QA</div>
          <div className="text-2xl font-mono tabular-nums font-bold text-[#E8EEF7]">
            −{formatCompactNumber(telemetry.monthlyPayrollCR, 1)}
            <span className="text-xs font-normal text-[#8C9BB2] ml-1.5">CR/mo</span>
          </div>
          <div className="text-xs text-[#8C9BB2] font-mono tabular-nums">
            {totalHeadcount} staff · QA Tier {state.qaBudgetLevel}
          </div>
        </div>

        <div className="bg-[#101521] border border-[#1E293B] rounded-lg p-4 space-y-1">
          <div className="text-xs text-[#8C9BB2]">Facility Maintenance</div>
          <div className="text-2xl font-mono tabular-nums font-bold text-[#E8EEF7]">
            −{formatCompactNumber(telemetry.monthlyUpkeepCR, 1)}
            <span className="text-xs font-normal text-[#8C9BB2] ml-1.5">CR/mo</span>
          </div>
          <div className="text-xs text-[#8C9BB2]">
            Across {state.facilities.length} online facilities (zero wafer fees)
          </div>
        </div>

        <div className="bg-[#101521] border border-[#1E293B] rounded-lg p-4 space-y-1">
          <div className="text-xs text-[#8C9BB2]">Net Monthly Balance</div>
          <div
            className={`text-2xl font-mono tabular-nums font-bold ${
              telemetry.monthlyCreditNet >= 0 ? 'text-[#22D3EE]' : 'text-rose-400'
            }`}
          >
            {telemetry.monthlyCreditNet >= 0 ? '+' : ''}
            {formatCompactNumber(telemetry.monthlyCreditNet, 1)}
            <span className="text-xs font-normal text-[#8C9BB2] ml-1.5">CR/mo</span>
          </div>
          <div className="text-xs text-[#8C9BB2] font-mono tabular-nums">{runwayLabel}</div>
        </div>
      </div>

      {/* Treasury & Cash Flow History + OpEx Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 bg-[#101521] border border-[#1E293B] rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#E8EEF7]">Financial Trajectory</h2>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-[#0A0E16] border border-[#1E293B] rounded p-0.5">
                <button
                  type="button"
                  onClick={() => setChartMode('credits')}
                  className={`px-2 py-1 text-[11px] rounded cursor-pointer whitespace-nowrap ${
                    chartMode === 'credits'
                      ? 'bg-[#161D2D] text-[#FBBF24]'
                      : 'text-[#8C9BB2] hover:text-[#E8EEF7]'
                  }`}
                >
                  Treasury Balance
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode('net')}
                  className={`px-2 py-1 text-[11px] rounded cursor-pointer whitespace-nowrap ${
                    chartMode === 'net'
                      ? 'bg-[#161D2D] text-emerald-400'
                      : 'text-[#8C9BB2] hover:text-[#E8EEF7]'
                  }`}
                >
                  Net Cash Flow / Mo
                </button>
              </div>
              <div className="flex items-center bg-[#0A0E16] border border-[#1E293B] rounded p-0.5">
                <button
                  type="button"
                  onClick={() => setChartSpan('monthly')}
                  className={`px-2 py-1 text-[11px] rounded cursor-pointer whitespace-nowrap ${
                    chartSpan === 'monthly'
                      ? 'bg-[#161D2D] text-[#E8EEF7]'
                      : 'text-[#8C9BB2] hover:text-[#E8EEF7]'
                  }`}
                >
                  Recent
                </button>
                <button
                  type="button"
                  onClick={() => setChartSpan('long')}
                  className={`px-2 py-1 text-[11px] rounded cursor-pointer whitespace-nowrap ${
                    chartSpan === 'long'
                      ? 'bg-[#161D2D] text-[#E8EEF7]'
                      : 'text-[#8C9BB2] hover:text-[#E8EEF7]'
                  }`}
                >
                  All Eras
                </button>
              </div>
            </div>
          </div>
          <div className="bg-[#06080D] border border-[#1E293B] rounded-md p-2">
            <FinancialHistoryChart
              data={chartSpan === 'monthly' ? state.monthlyHistory : state.longTermHistory}
              mode={chartMode}
            />
          </div>
        </div>

        {/* Operating Expense Composition */}
        <div className="lg:col-span-4 bg-[#101521] border border-[#1E293B] rounded-lg p-4 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-[#E8EEF7]">Monthly OpEx Composition</h2>
            <div className="h-3 rounded overflow-hidden bg-[#06080D] border border-[#1E293B] flex">
              {opexSegments.map((seg) => {
                const pct = (seg.val / totalMonthlyOpex) * 100;
                if (pct <= 0) return null;
                return (
                  <div
                    key={seg.label}
                    style={{ width: `${pct}%`, backgroundColor: seg.color }}
                    title={`${seg.label}: ${formatCompactNumber(seg.val, 1)} CR/mo (${pct.toFixed(0)}%)`}
                  />
                );
              })}
            </div>
            <div className="space-y-2 text-xs font-mono tabular-nums pt-1">
              {opexSegments.map((seg) => (
                <div key={seg.label} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[#CBD5E1] font-sans">
                    <span
                      className="w-2 h-2 rounded-[2px] shrink-0"
                      style={{ backgroundColor: seg.color }}
                    />
                    {seg.label}
                  </span>
                  <span className="text-[#E8EEF7]">
                    {formatCompactNumber(seg.val, 1)} CR ({Math.round((seg.val / totalMonthlyOpex) * 100)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-[#1E293B] text-xs text-[#8C9BB2] leading-relaxed">
            Operating margin:{' '}
            <span className="font-mono tabular-nums text-[#E8EEF7] font-semibold">
              {telemetry.monthlyCreditIncome > 0
                ? `${Math.round((telemetry.monthlyCreditNet / telemetry.monthlyCreditIncome) * 100)}%`
                : '0%'}
            </span>
            . Zero per-wafer monetary fees apply across any process node.
          </div>
        </div>
      </div>

      {/* Engineering Department Staffing */}
      <div className="bg-[#101521] border border-[#1E293B] rounded-lg p-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-[#E8EEF7] flex items-center gap-2">
            <Users className="w-4 h-4 text-[#06B6D4]" />
            <span>Engineering Departments &amp; Workforce Capacity</span>
          </h2>
          <p className="text-xs text-[#8C9BB2] mt-0.5">
            Scale specialist headcount to accelerate R&amp;D, chip tape-outs, fab wafer throughput, and metrology QA
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {DEPARTMENTS.map((dept) => {
            const count = state.staff[dept.key];
            const costPer = STAFF_MONTHLY_PAYROLL_CR[dept.key];
            const deptPayroll = count * costPer;
            return (
              <div
                key={dept.key}
                className="p-4 rounded-md bg-[#0A0E16] border border-[#1E293B] flex flex-col justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[#E8EEF7]">{dept.title}</h3>
                    <span className="font-mono tabular-nums text-sm font-bold text-[#22D3EE]">
                      {count} staff
                    </span>
                  </div>
                  <p className="text-xs text-[#8C9BB2]">{dept.role}</p>
                  <div className="text-xs font-mono tabular-nums text-emerald-400 pt-0.5">
                    Live Impact: {impactReadout(dept.key)}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1E293B]">
                  <span className="text-xs font-mono tabular-nums text-[#8C9BB2]">
                    {deptPayroll.toLocaleString()} CR/mo ({costPer} CR/head)
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={count <= 1}
                      onClick={() => onAdjustStaff(dept.key, -10)}
                      className="h-7 px-1.5 rounded bg-[#101521] hover:bg-[#161D2D] disabled:opacity-35 border border-[#1E293B] text-[11px] font-mono text-[#E8EEF7] cursor-pointer"
                    >
                      -10
                    </button>
                    <button
                      type="button"
                      disabled={count <= 1}
                      onClick={() => onAdjustStaff(dept.key, -5)}
                      className="h-7 px-1.5 rounded bg-[#101521] hover:bg-[#161D2D] disabled:opacity-35 border border-[#1E293B] text-[11px] font-mono text-[#E8EEF7] cursor-pointer"
                    >
                      -5
                    </button>
                    <button
                      type="button"
                      disabled={count <= 1}
                      onClick={() => onAdjustStaff(dept.key, -1)}
                      className="h-7 w-7 rounded bg-[#101521] hover:bg-[#161D2D] disabled:opacity-35 border border-[#1E293B] flex items-center justify-center text-[#E8EEF7] cursor-pointer"
                      aria-label={`Reduce ${dept.title} staff`}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onAdjustStaff(dept.key, 1)}
                      className="h-7 w-7 rounded bg-[#06B6D4]/20 hover:bg-[#06B6D4]/30 border border-[#06B6D4]/40 flex items-center justify-center text-[#22D3EE] cursor-pointer"
                      aria-label={`Hire 1 ${dept.title} staff`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onAdjustStaff(dept.key, 5)}
                      className="h-7 px-1.5 rounded bg-[#06B6D4]/20 hover:bg-[#06B6D4]/30 border border-[#06B6D4]/40 text-[11px] font-mono text-[#22D3EE] cursor-pointer"
                    >
                      +5
                    </button>
                    <button
                      type="button"
                      onClick={() => onAdjustStaff(dept.key, 10)}
                      className="h-7 px-1.5 rounded bg-[#06B6D4]/20 hover:bg-[#06B6D4]/30 border border-[#06B6D4]/40 text-[11px] font-mono text-[#22D3EE] cursor-pointer"
                    >
                      +10
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Economic Architecture Note */}
      <div className="bg-[#101521] border border-[#1E293B] rounded-lg p-4 space-y-1.5">
        <h2 className="text-sm font-semibold text-[#E8EEF7]">Monopoly Economic Structure</h2>
        <p className="text-xs text-[#8C9BB2] leading-relaxed">
          As civilization&apos;s sole semiconductor institution, wafer manufacturing consumes zero monetary fees—output scales strictly with physical Refined Silicon (Si), Grid Power (MW), Wafer Capacity, and OSAT Packaging throughput. Credits (CR) flow from Civilization Compute Demand—amplified up to 1.68× when shipping a full-stack ecosystem across CPUs, GPUs, System RAM/VRAM, and Solid-State Storage—to fund capital construction, tape-outs, QA programs, and engineering payroll.
        </p>
      </div>
    </div>
  );
};
