import React, { useMemo, useState } from 'react';
import type { ChipPhysicsReport, DieBlockRect } from '../engine/types';

interface DieFloorplanSVGProps {
  title: string;
  nodeLabel: string;
  physics: ChipPhysicsReport;
  waferDiameterMm?: number;
  thermalOverlay: boolean;
  onToggleThermal: () => void;
}

type VisualizerTab = 'floorplan' | 'thermal' | 'wafer';

const CATEGORY_STYLES: Record<
  DieBlockRect['category'],
  { fill: string; stroke: string; text: string; name: string; bucket: 'compute' | 'cache' | 'io' | 'uncore' }
> = {
  p_core: {
    fill: '#0E3A4A',
    stroke: '#06B6D4',
    text: '#CFFAFE',
    name: 'Performance Core',
    bucket: 'compute',
  },
  e_core: {
    fill: '#132F3B',
    stroke: '#0891B2',
    text: '#A5F3FC',
    name: 'Efficiency Core',
    bucket: 'compute',
  },
  shader: {
    fill: '#0E3A4A',
    stroke: '#06B6D4',
    text: '#CFFAFE',
    name: 'Shader Cluster',
    bucket: 'compute',
  },
  cache: {
    fill: '#2B2113',
    stroke: '#D97706',
    text: '#FDE68A',
    name: 'SRAM Cache',
    bucket: 'cache',
  },
  igpu: {
    fill: '#18283D',
    stroke: '#38BDF8',
    text: '#BAE6FD',
    name: 'Integrated GPU',
    bucket: 'compute',
  },
  npu: {
    fill: '#1E293B',
    stroke: '#A78BFA',
    text: '#DDD6FE',
    name: 'Neural Engine',
    bucket: 'compute',
  },
  rop_tmu: {
    fill: '#261D15',
    stroke: '#F59E0B',
    text: '#FDE68A',
    name: 'ROPs / TMUs',
    bucket: 'cache',
  },
  memory_ctrl: {
    fill: '#14242A',
    stroke: '#14B8A6',
    text: '#99F6E4',
    name: 'Memory Controller / PHY',
    bucket: 'io',
  },
  io: {
    fill: '#161E2C',
    stroke: '#64748B',
    text: '#CBD5E1',
    name: 'PCIe & I/O Fabric',
    bucket: 'io',
  },
  uncore: {
    fill: '#171E2E',
    stroke: '#475569',
    text: '#CBD5E1',
    name: 'Uncore Logic',
    bucket: 'uncore',
  },
  mem_array: {
    fill: '#0F2E35',
    stroke: '#14B8A6',
    text: '#CCFBF1',
    name: 'Memory Cell Array',
    bucket: 'compute',
  },
  sense_amp: {
    fill: '#2B2113',
    stroke: '#D97706',
    text: '#FDE68A',
    name: 'Sense Amps & Decoders',
    bucket: 'cache',
  },
  ecc_ctrl: {
    fill: '#1E2538',
    stroke: '#818CF8',
    text: '#E0E7FF',
    name: 'ECC & Wear Controller',
    bucket: 'uncore',
  },
  tsv_phy: {
    fill: '#0E3A4A',
    stroke: '#06B6D4',
    text: '#CFFAFE',
    name: 'TSV / High-Speed PHY',
    bucket: 'io',
  },
};

function thermalColorForFlux(fluxWPerMm2: number): { fill: string; stroke: string } {
  const norm = Math.max(0, Math.min(1, fluxWPerMm2 / 1.6));
  if (norm < 0.25) return { fill: '#0C2D3E', stroke: '#06B6D4' };
  if (norm < 0.5) return { fill: '#18403A', stroke: '#10B981' };
  if (norm < 0.72) return { fill: '#452E10', stroke: '#F59E0B' };
  if (norm < 0.88) return { fill: '#572212', stroke: '#F97316' };
  return { fill: '#5B141D', stroke: '#EF4444' };
}

/** Deterministic spatial hash for repeatable wafer defect visualization (zero Math.random) */
function hashDie(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const DieFloorplanSVG: React.FC<DieFloorplanSVGProps> = ({
  title,
  nodeLabel,
  physics,
  waferDiameterMm = 200,
  thermalOverlay,
  onToggleThermal,
}) => {
  const [hovered, setHovered] = useState<DieBlockRect | null>(null);
  const [waferMode, setWaferMode] = useState(false);

  const activeTab: VisualizerTab = waferMode
    ? 'wafer'
    : thermalOverlay
      ? 'thermal'
      : 'floorplan';

  const selectTab = (tab: VisualizerTab) => {
    if (tab === 'wafer') {
      setWaferMode(true);
    } else if (tab === 'thermal') {
      setWaferMode(false);
      if (!thermalOverlay) onToggleThermal();
    } else {
      setWaferMode(false);
      if (thermalOverlay) onToggleThermal();
    }
  };

  const sideMm = Math.sqrt(Math.max(1, physics.dieAreaMm2));

  // Proportional area allocation across blocks
  const areaBreakdown = useMemo(() => {
    const totals = { compute: 0, cache: 0, io: 0, uncore: 0 };
    for (const b of physics.floorplanBlocks) {
      totals[CATEGORY_STYLES[b.category].bucket] += b.areaMm2;
    }
    const sum = Math.max(0.01, totals.compute + totals.cache + totals.io + totals.uncore);
    return {
      computePct: (totals.compute / sum) * 100,
      cachePct: (totals.cache / sum) * 100,
      ioPct: (totals.io / sum) * 100,
      uncorePct: (totals.uncore / sum) * 100,
    };
  }, [physics.floorplanBlocks]);

  // Proportional power breakdown
  const powerBreakdown = useMemo(() => {
    const dyn = Math.max(0, physics.dynamicPowerW);
    const leak = Math.max(0, physics.leakagePowerW);
    const tun = Math.max(0, physics.tunnelingPowerW);
    const sum = Math.max(0.01, dyn + leak + tun);
    return {
      dynPct: (dyn / sum) * 100,
      leakPct: (leak / sum) * 100,
      tunPct: (tun / sum) * 100,
      dynW: dyn,
      leakW: leak,
      tunW: tun,
    };
  }, [physics.dynamicPowerW, physics.leakagePowerW, physics.tunnelingPowerW]);

  // Deterministic Circular Wafer Map geometry
  const waferGrid = useMemo(() => {
    const radiusMm = waferDiameterMm / 2;
    const usableR = Math.max(10, radiusMm - 3); // 3mm edge exclusion
    // Clamp rendered die size slightly so ultra-tiny dies remain crisp and fast in SVG
    const renderSideMm = Math.max(waferDiameterMm / 28, sideMm);
    const pitchMm = renderSideMm * 1.04;
    const scale = 48 / radiusMm; // maps wafer radius into SVG radius 48 (center 58, 58)
    const cells: { x: number; y: number; size: number; good: boolean; key: string }[] = [];
    const yieldFrac = Math.max(0, Math.min(1, physics.yieldPercent / 100));
    const seed = Math.round(physics.dieAreaMm2 * 10 + waferDiameterMm);

    const maxSteps = Math.ceil(usableR / pitchMm);
    for (let gy = -maxSteps; gy <= maxSteps; gy++) {
      for (let gx = -maxSteps; gx <= maxSteps; gx++) {
        const cx = (gx + 0.5) * pitchMm;
        const cy = (gy + 0.5) * pitchMm;
        const half = renderSideMm / 2;
        const corners = [
          [cx - half, cy - half],
          [cx + half, cy - half],
          [cx - half, cy + half],
          [cx + half, cy + half],
        ];
        const inside = corners.every(([px, py]) => px * px + py * py <= usableR * usableR);
        if (!inside) continue;
        // Edge-bias defect probability slightly higher near wafer rim
        const distNorm = Math.sqrt(cx * cx + cy * cy) / usableR;
        const localYield = Math.max(0.02, Math.min(0.995, yieldFrac * (1.06 - 0.14 * distNorm * distNorm)));
        const good = !physics.exceedsReticle && hashDie(gx, gy, seed) < localYield;
        cells.push({
          x: 58 + (cx - half) * scale,
          y: 58 + (cy - half) * scale,
          size: Math.max(1.2, renderSideMm * scale - 0.35),
          good,
          key: `${gx}_${gy}`,
        });
      }
    }
    const waferAreaMm2 = Math.PI * radiusMm * radiusMm;
    const utilizedPct = Math.min(
      99,
      ((physics.grossDiesPerWafer * physics.dieAreaMm2) / Math.max(1, waferAreaMm2)) * 100
    );
    return { cells, utilizedPct };
  }, [waferDiameterMm, sideMm, physics.yieldPercent, physics.dieAreaMm2, physics.grossDiesPerWafer, physics.exceedsReticle]);

  return (
    <div className="bg-[#101521] border border-[#1E293B] rounded-md p-4 space-y-3">
      {/* Header & 3-Mode Visualizer Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[#E8EEF7] truncate">{title}</h3>
          <p className="text-[11px] text-[#8C9BB2] font-mono tabular-nums">
            {nodeLabel} · {physics.dieAreaMm2.toFixed(1)} mm² ({sideMm.toFixed(1)} × {sideMm.toFixed(1)} mm)
          </p>
        </div>
        <div
          className="flex items-center bg-[#06080D] border border-[#1E293B] rounded-[4px] p-0.5 shrink-0"
          role="tablist"
          aria-label="Silicon visualization mode"
        >
          {(
            [
              { id: 'floorplan', label: 'Floorplan' },
              { id: 'thermal', label: 'Thermal' },
              { id: 'wafer', label: `Wafer ${waferDiameterMm}mm` },
            ] as { id: VisualizerTab; label: string }[]
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectTab(tab.id)}
                className={`px-2 py-1 text-[11px] font-medium rounded-[3px] transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? tab.id === 'thermal'
                      ? 'bg-[#D97706]/25 text-[#FBBF24]'
                      : tab.id === 'wafer'
                        ? 'bg-[#14B8A6]/20 text-[#2DD4BF]'
                        : 'bg-[#161D2D] text-[#E8EEF7]'
                    : 'text-[#8C9BB2] hover:text-[#E8EEF7]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live 2D SVG Canvas (Floorplan / Thermal / Circular Wafer Map) */}
      <div className="relative foundry-grid-bg border border-[#1E293B] rounded-[4px] p-3 flex items-center justify-center">
        {activeTab === 'wafer' ? (
          <svg
            viewBox="0 0 116 116"
            className="w-full max-w-[320px] aspect-square"
            role="img"
            aria-label={`${waferDiameterMm}mm silicon wafer map for ${title}`}
          >
            {/* Wafer Disc & Crystal Notch */}
            <circle
              cx="58"
              cy="58"
              r="50"
              fill="#0A0E16"
              stroke={physics.exceedsReticle ? '#F43F5E' : '#2C3B55'}
              strokeWidth="0.9"
            />
            <circle
              cx="58"
              cy="58"
              r="47.8"
              fill="none"
              stroke="#1E293B"
              strokeWidth="0.4"
              strokeDasharray="2 2"
            />
            {/* Wafer orientation notch at bottom */}
            <path d="M 55.5 107.8 L 58 105.5 L 60.5 107.8" fill="#06080D" stroke="#2C3B55" strokeWidth="0.7" />

            {/* Packed Dies */}
            {waferGrid.cells.map((cell) => (
              <rect
                key={cell.key}
                x={cell.x}
                y={cell.y}
                width={cell.size}
                height={cell.size}
                rx="0.25"
                fill={cell.good ? '#0E3A4A' : '#2A1219'}
                stroke={cell.good ? '#06B6D4' : '#9F1239'}
                strokeWidth="0.28"
              />
            ))}

            {/* Diameter caliper annotation */}
            <text
              x="58"
              y="6.2"
              textAnchor="middle"
              fill="#8C9BB2"
              fontSize="3.2"
              fontFamily="ui-monospace, SFMono-Regular, Consolas, Menlo, monospace"
            >
              Ø {waferDiameterMm} mm · {physics.goodDiesPerWafer.toFixed(0)} GOOD / {physics.grossDiesPerWafer} GROSS
            </text>
          </svg>
        ) : (
          <svg
            viewBox="0 0 116 116"
            className="w-full max-w-[320px] aspect-square cursor-crosshair"
            role="img"
            aria-label={`2D silicon die floorplan for ${title}`}
          >
            {/* Outer Scribe Ring & Alignment Fiducials */}
            <rect
              x="2"
              y="2"
              width="112"
              height="112"
              rx="1.5"
              fill="#0A0E16"
              stroke={physics.exceedsReticle ? '#F43F5E' : '#2C3B55'}
              strokeWidth={physics.exceedsReticle ? '1.1' : '0.7'}
              strokeDasharray={physics.exceedsReticle ? '3 1.5' : undefined}
            />
            {/* Corner CAD alignment fiducials */}
            {[
              [4, 4],
              [112, 4],
              [4, 112],
              [112, 112],
            ].map(([fx, fy], idx) => (
              <g key={idx} opacity="0.7">
                <line x1={fx - 1.5} y1={fy} x2={fx + 1.5} y2={fy} stroke="#06B6D4" strokeWidth="0.45" />
                <line x1={fx} y1={fy - 1.5} x2={fx} y2={fy + 1.5} stroke="#06B6D4" strokeWidth="0.45" />
              </g>
            ))}

            {/* Copper Bond Pads */}
            {[16, 32, 48, 64, 80, 96].map((pos) => (
              <g key={pos} opacity="0.55">
                <rect x={pos} y="3.5" width="3.8" height="1.4" fill="#D97706" />
                <rect x={pos} y="111.1" width="3.8" height="1.4" fill="#D97706" />
                <rect x="3.5" y={pos} width="1.4" height="3.8" fill="#D97706" />
                <rect x="111.1" y={pos} width="1.4" height="3.8" fill="#D97706" />
              </g>
            ))}

            {/* Active Die Silicon Region */}
            <g transform="translate(8, 8)">
              <rect
                x="0"
                y="0"
                width="100"
                height="100"
                rx="0.8"
                fill="#0D121D"
                stroke="#1E293B"
                strokeWidth="0.6"
              />
              {physics.floorplanBlocks.map((block) => {
                const cat = CATEGORY_STYLES[block.category];
                const therm = thermalColorForFlux(block.heatFluxWPerMm2);
                const fill = activeTab === 'thermal' ? therm.fill : cat.fill;
                const stroke = activeTab === 'thermal' ? therm.stroke : cat.stroke;
                const isHovered = hovered?.id === block.id;
                const showLabel = block.w >= 11 && block.h >= 8;

                return (
                  <g
                    key={block.id}
                    onMouseEnter={() => setHovered(block)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <rect
                      x={block.x}
                      y={block.y}
                      width={Math.max(1, block.w)}
                      height={Math.max(1, block.h)}
                      rx="0.6"
                      fill={fill}
                      stroke={isHovered ? '#FFFFFF' : stroke}
                      strokeWidth={isHovered ? '0.9' : '0.55'}
                    />
                    {showLabel && (
                      <text
                        x={block.x + block.w / 2}
                        y={block.y + block.h / 2 + 1.1}
                        textAnchor="middle"
                        fill={activeTab === 'thermal' ? '#F8FAFC' : cat.text}
                        fontSize={block.w < 18 ? '2.4' : '2.9'}
                        fontFamily="ui-monospace, SFMono-Regular, Consolas, Menlo, monospace"
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {block.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        )}

        {physics.exceedsReticle && (
          <div className="absolute bottom-2 left-2 right-2 bg-rose-950/90 border border-rose-500/60 rounded px-2.5 py-1 text-[11px] text-rose-200 font-mono tabular-nums text-center">
            ✖ Reticle Limit Exceeded ({physics.dieAreaMm2.toFixed(0)} / {physics.reticleLimitMm2.toFixed(0)} mm²)
          </div>
        )}
      </div>

      {/* Mode-Specific Interactive Probe / Calibrated Legend */}
      <div className="text-[11px] border-t border-[#1E293B] pt-2.5 min-h-[28px]">
        {activeTab === 'wafer' ? (
          <div className="flex flex-wrap items-center justify-between gap-2 font-mono tabular-nums text-[#8C9BB2]">
            <span className="text-[#22D3EE]">
              ■ Good ({physics.yieldPercent.toFixed(1)}%)
            </span>
            <span className="text-rose-400">
              ■ Defect ({(100 - physics.yieldPercent).toFixed(1)}%)
            </span>
            <span>Wafer Util {waferGrid.utilizedPct.toFixed(0)}%</span>
            <span>D0 {physics.effectiveDefectDensity.toFixed(3)}/cm²</span>
          </div>
        ) : hovered ? (
          <div className="flex items-center justify-between w-full gap-2 font-mono tabular-nums">
            <span className="text-[#E8EEF7] truncate">
              {hovered.label} · {CATEGORY_STYLES[hovered.category].name}
            </span>
            <span className="text-[#22D3EE] shrink-0">
              {hovered.areaMm2.toFixed(1)} mm² (
              {((hovered.areaMm2 / Math.max(0.1, physics.dieAreaMm2)) * 100).toFixed(0)}%) ·{' '}
              {hovered.heatFluxWPerMm2.toFixed(2)} W/mm²
            </span>
          </div>
        ) : activeTab === 'thermal' ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[#8C9BB2] font-mono tabular-nums">
              <span>Heat Flux Scale (W/mm²)</span>
              <span>
                Avg {physics.heatFluxWPerMm2.toFixed(2)} W/mm² · Tj {physics.junctionTempC.toFixed(1)} °C
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-[#64748B]">0.05</span>
              <div
                className="flex-1 h-1.5 rounded-[2px]"
                style={{
                  background:
                    'linear-gradient(to right, #06B6D4 0%, #10B981 30%, #F59E0B 62%, #F97316 82%, #EF4444 100%)',
                }}
              />
              <span className="font-mono text-[10px] text-[#64748B]">1.60+</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 text-[#8C9BB2]">
            <span>Hover die block to probe area &amp; heat flux</span>
            <div className="flex items-center gap-2.5 font-mono text-[10px]">
              <span className="text-[#22D3EE]">
                {physics.capacityGB !== undefined ? 'Array' : 'Compute'} {areaBreakdown.computePct.toFixed(0)}%
              </span>
              <span className="text-[#FBBF24]">
                {physics.capacityGB !== undefined ? 'Sense' : 'Cache'} {areaBreakdown.cachePct.toFixed(0)}%
              </span>
              <span className="text-[#2DD4BF]">PHY/IO {areaBreakdown.ioPct.toFixed(0)}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Compact Die Area & Power Breakdown Stacked Bars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#1E293B]">
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono text-[#8C9BB2]">
            <span>DIE AREA SPLIT</span>
            <span>{physics.dieAreaMm2.toFixed(1)} mm²</span>
          </div>
          <div className="h-1.5 bg-[#06080D] rounded-[2px] overflow-hidden flex">
            <div
              className="bg-[#06B6D4]"
              style={{ width: `${areaBreakdown.computePct}%` }}
              title={`Compute/Array: ${areaBreakdown.computePct.toFixed(1)}%`}
            />
            <div
              className="bg-[#D97706]"
              style={{ width: `${areaBreakdown.cachePct}%` }}
              title={`Cache/Sense: ${areaBreakdown.cachePct.toFixed(1)}%`}
            />
            <div
              className="bg-[#14B8A6]"
              style={{ width: `${areaBreakdown.ioPct}%` }}
              title={`I/O & Memory PHY: ${areaBreakdown.ioPct.toFixed(1)}%`}
            />
            <div
              className="bg-[#475569]"
              style={{ width: `${areaBreakdown.uncorePct}%` }}
              title={`Uncore / ECC: ${areaBreakdown.uncorePct.toFixed(1)}%`}
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono text-[#8C9BB2]">
            <span>POWER SPLIT (DYN / LEAK)</span>
            <span>
              {powerBreakdown.dynW.toFixed(1)}W / {(powerBreakdown.leakW + powerBreakdown.tunW).toFixed(1)}W
            </span>
          </div>
          <div className="h-1.5 bg-[#06080D] rounded-[2px] overflow-hidden flex">
            <div
              className="bg-[#22D3EE]"
              style={{ width: `${powerBreakdown.dynPct}%` }}
              title={`Dynamic Switching: ${powerBreakdown.dynW.toFixed(1)} W`}
            />
            <div
              className="bg-[#F59E0B]"
              style={{ width: `${powerBreakdown.leakPct}%` }}
              title={`Thermal Leakage: ${powerBreakdown.leakW.toFixed(1)} W`}
            />
            <div
              className="bg-[#F43F5E]"
              style={{ width: `${powerBreakdown.tunPct}%` }}
              title={`Quantum Tunneling: ${powerBreakdown.tunW.toFixed(1)} W`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
