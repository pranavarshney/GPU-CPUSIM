import React, { useState } from 'react';
import type { ChipPhysicsReport, DieBlockRect } from '../engine/types';

interface DieFloorplanSVGProps {
  title: string;
  nodeLabel: string;
  physics: ChipPhysicsReport;
  thermalOverlay: boolean;
  onToggleThermal: () => void;
}

const CATEGORY_STYLES: Record<
  DieBlockRect['category'],
  { fill: string; stroke: string; text: string; name: string }
> = {
  p_core: {
    fill: '#0E3A4A',
    stroke: '#06B6D4',
    text: '#CFFAFE',
    name: 'Performance Core',
  },
  e_core: {
    fill: '#132F3B',
    stroke: '#0891B2',
    text: '#A5F3FC',
    name: 'Efficiency Core',
  },
  shader: {
    fill: '#0E3A4A',
    stroke: '#06B6D4',
    text: '#CFFAFE',
    name: 'Shader Cluster',
  },
  cache: {
    fill: '#2B2113',
    stroke: '#D97706',
    text: '#FDE68A',
    name: 'SRAM Cache',
  },
  igpu: {
    fill: '#18283D',
    stroke: '#38BDF8',
    text: '#BAE6FD',
    name: 'Integrated GPU',
  },
  npu: {
    fill: '#1E293B',
    stroke: '#A78BFA',
    text: '#DDD6FE',
    name: 'Neural Engine',
  },
  rop_tmu: {
    fill: '#261D15',
    stroke: '#F59E0B',
    text: '#FDE68A',
    name: 'ROPs / TMUs',
  },
  memory_ctrl: {
    fill: '#14242A',
    stroke: '#14B8A6',
    text: '#99F6E4',
    name: 'Memory Controller / PHY',
  },
  io: {
    fill: '#161E2C',
    stroke: '#64748B',
    text: '#CBD5E1',
    name: 'PCIe & I/O Fabric',
  },
  uncore: {
    fill: '#171E2E',
    stroke: '#475569',
    text: '#CBD5E1',
    name: 'Uncore Logic',
  },
  mem_array: {
    fill: '#0F2E35',
    stroke: '#14B8A6',
    text: '#CCFBF1',
    name: 'Memory Cell Array',
  },
  sense_amp: {
    fill: '#2B2113',
    stroke: '#D97706',
    text: '#FDE68A',
    name: 'Sense Amps & Decoders',
  },
  ecc_ctrl: {
    fill: '#1E2538',
    stroke: '#818CF8',
    text: '#E0E7FF',
    name: 'ECC & Wear Controller',
  },
  tsv_phy: {
    fill: '#0E3A4A',
    stroke: '#06B6D4',
    text: '#CFFAFE',
    name: 'TSV / High-Speed PHY',
  },
};

function thermalColorForFlux(fluxWPerMm2: number): { fill: string; stroke: string } {
  // Normalized typical silicon heat flux scale: 0.05 W/mm^2 (cool) -> 1.8 W/mm^2 (hot)
  const norm = Math.max(0, Math.min(1, fluxWPerMm2 / 1.6));
  if (norm < 0.25) return { fill: '#0C2D3E', stroke: '#06B6D4' };
  if (norm < 0.5) return { fill: '#18403A', stroke: '#10B981' };
  if (norm < 0.72) return { fill: '#452E10', stroke: '#F59E0B' };
  if (norm < 0.88) return { fill: '#572212', stroke: '#F97316' };
  return { fill: '#5B141D', stroke: '#EF4444' };
}

export const DieFloorplanSVG: React.FC<DieFloorplanSVGProps> = ({
  title,
  nodeLabel,
  physics,
  thermalOverlay,
  onToggleThermal,
}) => {
  const [hovered, setHovered] = useState<DieBlockRect | null>(null);
  const sideMm = Math.sqrt(physics.dieAreaMm2);

  return (
    <div className="bg-[#111622] border border-[#1F2A3D] rounded-lg p-4 space-y-3">
      {/* Header & Mode Toggle */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[#E8EEF7] truncate">{title}</h3>
          <p className="text-xs text-[#8C9BB2] font-mono tabular-nums">
            {nodeLabel} · {physics.dieAreaMm2.toFixed(1)} mm² ({sideMm.toFixed(1)} ×{' '}
            {sideMm.toFixed(1)} mm)
          </p>
        </div>
        <div className="flex items-center bg-[#0B0F17] border border-[#1F2A3D] rounded-md p-0.5 shrink-0">
          <button
            type="button"
            onClick={() => thermalOverlay && onToggleThermal()}
            className={`px-2.5 py-1 text-xs font-medium rounded-[4px] transition-colors whitespace-nowrap cursor-pointer ${
              !thermalOverlay
                ? 'bg-[#171E2E] text-[#E8EEF7]'
                : 'text-[#8C9BB2] hover:text-[#E8EEF7]'
            }`}
          >
            Floorplan
          </button>
          <button
            type="button"
            onClick={() => !thermalOverlay && onToggleThermal()}
            className={`px-2.5 py-1 text-xs font-medium rounded-[4px] transition-colors whitespace-nowrap cursor-pointer ${
              thermalOverlay
                ? 'bg-[#D97706]/25 text-[#FBBF24]'
                : 'text-[#8C9BB2] hover:text-[#E8EEF7]'
            }`}
          >
            Thermal Flux
          </button>
        </div>
      </div>

      {/* Live 2D SVG Die Canvas */}
      <div className="relative bg-[#07090E] border border-[#1F2A3D] rounded-md p-3 flex items-center justify-center">
        <svg
          viewBox="0 0 116 116"
          className="w-full max-w-[330px] aspect-square cursor-crosshair"
          role="img"
          aria-label={`2D silicon die floorplan for ${title}`}
        >
          {/* Outer Scribe Ring & Bond Pads */}
          <rect
            x="2"
            y="2"
            width="112"
            height="112"
            rx="2"
            fill="#0B0F17"
            stroke={physics.exceedsReticle ? '#EF4444' : '#2C3B55'}
            strokeWidth={physics.exceedsReticle ? '1.1' : '0.7'}
            strokeDasharray={physics.exceedsReticle ? '3 1.5' : undefined}
          />
          {/* Subtle silicon wafer reticle ticks */}
          {[14, 30, 46, 62, 78, 94].map((pos) => (
            <g key={pos} opacity="0.55">
              <rect x={pos} y="3.5" width="4" height="1.5" fill="#D97706" />
              <rect x={pos} y="111" width="4" height="1.5" fill="#D97706" />
              <rect x="3.5" y={pos} width="1.5" height="4" fill="#D97706" />
              <rect x="111" y={pos} width="1.5" height="4" fill="#D97706" />
            </g>
          ))}

          {/* Active Die Silicon Region (8..108 maps 0..100 coordinates) */}
          <g transform="translate(8, 8)">
            <rect
              x="0"
              y="0"
              width="100"
              height="100"
              rx="1"
              fill="#0D121D"
              stroke="#1F2A3D"
              strokeWidth="0.6"
            />
            {physics.floorplanBlocks.map((block) => {
              const cat = CATEGORY_STYLES[block.category];
              const therm = thermalColorForFlux(block.heatFluxWPerMm2);
              const fill = thermalOverlay ? therm.fill : cat.fill;
              const stroke = thermalOverlay ? therm.stroke : cat.stroke;
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
                    rx="0.8"
                    fill={fill}
                    stroke={isHovered ? '#FFFFFF' : stroke}
                    strokeWidth={isHovered ? '0.9' : '0.55'}
                  />
                  {showLabel && (
                    <text
                      x={block.x + block.w / 2}
                      y={block.y + block.h / 2 + 1.1}
                      textAnchor="middle"
                      fill={thermalOverlay ? '#F8FAFC' : cat.text}
                      fontSize={block.w < 18 ? '2.5' : '3.0'}
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

        {physics.exceedsReticle && (
          <div className="absolute bottom-2 left-2 right-2 bg-rose-950/90 border border-rose-500/60 rounded px-2.5 py-1 text-xs text-rose-200 font-mono tabular-nums text-center">
            Reticle Limit Exceeded ({physics.dieAreaMm2.toFixed(0)} /{' '}
            {physics.reticleLimitMm2.toFixed(0)} mm²)
          </div>
        )}
      </div>

      {/* Interactive Probe Readout / Legend */}
      <div className="flex items-center justify-between text-xs border-t border-[#1F2A3D] pt-2.5 min-h-[28px]">
        {hovered ? (
          <div className="flex items-center justify-between w-full gap-2 font-mono tabular-nums">
            <span className="text-[#E8EEF7] truncate">
              {hovered.label} · {CATEGORY_STYLES[hovered.category].name}
            </span>
            <span className="text-[#8C9BB2] shrink-0">
              {hovered.areaMm2.toFixed(1)} mm² (
              {((hovered.areaMm2 / Math.max(0.1, physics.dieAreaMm2)) * 100).toFixed(0)}%) ·{' '}
              {hovered.heatFluxWPerMm2.toFixed(2)} W/mm²
            </span>
          </div>
        ) : thermalOverlay ? (
          <div className="flex items-center justify-between w-full text-[#8C9BB2]">
            <span>Heat Flux Scale (W/mm²)</span>
            <span className="font-mono tabular-nums">
              Avg {physics.heatFluxWPerMm2.toFixed(2)} W/mm² · Tj {physics.junctionTempC.toFixed(1)} °C
            </span>
          </div>
        ) : physics.capacityGB !== undefined ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[#8C9BB2]">
            <span>Hover block to inspect</span>
            <span>·</span>
            <span className="text-[#2DD4BF]">Cell Array</span>
            <span className="text-[#FBBF24]">Sense Amps</span>
            <span className="text-[#818CF8]">ECC</span>
            <span className="text-[#22D3EE]">I/O PHY</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[#8C9BB2]">
            <span>Hover block to inspect area &amp; flux</span>
            <span>·</span>
            <span className="text-[#22D3EE]">Compute</span>
            <span className="text-[#FBBF24]">Cache / Raster</span>
            <span className="text-[#2DD4BF]">Memory PHY</span>
          </div>
        )}
      </div>
    </div>
  );
};
