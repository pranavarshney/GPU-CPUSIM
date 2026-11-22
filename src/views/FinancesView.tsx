import React from 'react';
import { Minus, Plus, Users } from 'lucide-react';
import { formatCompactNumber, STAFF_MONTHLY_PAYROLL_CR } from '../engine/simulation';
import type { DepartmentStaff, GameState } from '../engine/types';

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
    role: 'Generates +0.52 RP/day per engineer (amplified by lab multipliers).',
  },
  {
    key: 'architecture',
    title: 'Silicon Architecture & Verification',
    role: 'Accelerates chip Tape-Out engineering duration and contributes +0.22 RP/day.',
  },
  {
    key: 'fabrication',
    title: 'Fabrication Operations',
    role: 'Increases effective wafer capacity across all fabs via shift optimization (up to 1.50×).',
  },
  {
    key: 'qa',
    title: 'Metrology & Quality Assurance',
    role: 'Boosts effective die screening and wafer yield reliability across all production lines.',
  },
];

export const FinancesView: React.FC<FinancesViewProps> = ({ state, onAdjustStaff }) => {
  const { telemetry } = state;
  const totalHeadcount =
    state.staff.research +
    state.staff.architecture +
    state.staff.fabrication +
    state.staff.qa;

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#1F2A3D] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E8EEF7] tracking-tight">
            Finances &amp; Company Operations
          </h1>
          <p className="text-sm text-[#8C9BB2] mt-0.5">
            Abstract Civilization Compute Demand credits fund infrastructure, R&amp;D, tape-outs, and {totalHeadcount} engineering personnel
          </p>
        </div>
        <div className="text-sm font-mono tabular-nums text-[#E8EEF7]">
          Treasury: <span className="text-[#22D3EE] font-semibold">{formatCompactNumber(state.credits, 1)} CR</span>
        </div>
      </div>

      {/* Monthly Cash Flow Ledger Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-4 space-y-1">
          <div className="text-xs text-[#8C9BB2]">Civilization Demand Revenue</div>
          <div className="text-2xl font-mono tabular-nums font-bold text-emerald-400">
            +{formatCompactNumber(telemetry.monthlyCreditIncome, 1)}
            <span className="text-xs font-normal text-[#8C9BB2] ml-1.5">CR/mo</span>
          </div>
          <div className="text-xs text-[#8C9BB2]">
            Ecosystem synergy {telemetry.activeChipEcosystemBonus.toFixed(2)}×
          </div>
        </div>

        <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-4 space-y-1">
          <div className="text-xs text-[#8C9BB2]">Engineering Payroll &amp; QA</div>
          <div className="text-2xl font-mono tabular-nums font-bold text-[#E8EEF7]">
            −{formatCompactNumber(telemetry.monthlyPayrollCR, 1)}
            <span className="text-xs font-normal text-[#8C9BB2] ml-1.5">CR/mo</span>
          </div>
          <div className="text-xs text-[#8C9BB2] font-mono tabular-nums">
            {totalHeadcount} staff · QA Tier {state.qaBudgetLevel}
          </div>
        </div>

        <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-4 space-y-1">
          <div className="text-xs text-[#8C9BB2]">Facility Maintenance</div>
          <div className="text-2xl font-mono tabular-nums font-bold text-[#E8EEF7]">
            −{formatCompactNumber(telemetry.monthlyUpkeepCR, 1)}
            <span className="text-xs font-normal text-[#8C9BB2] ml-1.5">CR/mo</span>
          </div>
          <div className="text-xs text-[#8C9BB2]">
            Across {state.facilities.length} active facilities (zero wafer fees)
          </div>
        </div>

        <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-4 space-y-1">
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
          <div className="text-xs text-[#8C9BB2]">
            {telemetry.monthlyCreditNet >= 0 ? 'Surplus compounding' : 'Drawing down treasury'}
          </div>
        </div>
      </div>

      {/* Engineering Department Staffing */}
      <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#E8EEF7] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#06B6D4]" />
              <span>Engineering Departments &amp; Workforce Capacity</span>
            </h2>
            <p className="text-xs text-[#8C9BB2] mt-0.5">
              Expand technical teams to accelerate research, chip tape-outs, fab wafer throughput, and metrology QA
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DEPARTMENTS.map((dept) => {
            const count = state.staff[dept.key];
            const costPer = STAFF_MONTHLY_PAYROLL_CR[dept.key];
            const deptPayroll = count * costPer;
            return (
              <div
                key={dept.key}
                className="p-4 rounded-md bg-[#0B0F17] border border-[#1F2A3D] flex flex-col justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[#E8EEF7]">{dept.title}</h3>
                    <span className="font-mono tabular-nums text-sm font-bold text-[#22D3EE]">
                      {count} staff
                    </span>
                  </div>
                  <p className="text-xs text-[#8C9BB2]">{dept.role}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#1F2A3D]">
                  <span className="text-xs font-mono tabular-nums text-[#8C9BB2]">
                    {deptPayroll.toLocaleString()} CR/mo ({costPer} CR/head)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={count <= 1}
                      onClick={() => onAdjustStaff(dept.key, -5)}
                      className="h-7 px-2 rounded bg-[#111622] hover:bg-[#171E2E] disabled:opacity-35 border border-[#1F2A3D] text-xs font-mono text-[#E8EEF7] cursor-pointer"
                    >
                      -5
                    </button>
                    <button
                      type="button"
                      disabled={count <= 1}
                      onClick={() => onAdjustStaff(dept.key, -1)}
                      className="h-7 w-7 rounded bg-[#111622] hover:bg-[#171E2E] disabled:opacity-35 border border-[#1F2A3D] flex items-center justify-center text-[#E8EEF7] cursor-pointer"
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
                      className="h-7 px-2 rounded bg-[#06B6D4]/20 hover:bg-[#06B6D4]/30 border border-[#06B6D4]/40 text-xs font-mono text-[#22D3EE] cursor-pointer"
                    >
                      +5
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Economic Architecture Note */}
      <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-5 space-y-2">
        <h2 className="text-sm font-semibold text-[#E8EEF7]">Monopoly Economic Structure</h2>
        <p className="text-xs text-[#8C9BB2] leading-relaxed">
          As the sole semiconductor institution in existence, manufacturing wafers consumes no monetary fees—production scales strictly with physical Refined Silicon (Si), Grid Power (MW), Wafer Capacity, and OSAT Packaging throughput. Abstract Credits (CR) flow from Civilization Compute Demand (amplified 1.32× when delivering both CPU and GPU silicon) to fund capital construction, tape-out engineering, QA programs, and specialist payroll across centuries.
        </p>
      </div>
    </div>
  );
};
