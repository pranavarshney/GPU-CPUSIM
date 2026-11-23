/**
 * Semiconductor Empire — Deterministic 525+ Node Technology Tree Generator.
 *
 * 7 Engineering Lanes × 26 Progressive Tiers across 8 Technological Eras.
 * - Zero historical date locks: every technology unlocks strictly via RP + prerequisites.
 * - Zero empty filler nodes: every single node either unlocks a real hardware component/paradigm
 *   OR provides concrete cumulative engineering modifiers aggregated in physics.ts & simulation.ts.
 * - Non-overlapping grid coordinates guaranteed by (tier, lane, subRow) coordinate allocation.
 * - 100% pure TypeScript — zero React, DOM, or Math.random().
 */

import type {
  TechCategory,
  TechEffects,
  TechEraBanner,
  TechLaneId,
  TechLaneMeta,
  TechNode,
} from './types';

export const TECH_NODE_W = 216;
export const TECH_NODE_H = 68;
export const TECH_COL_STEP = 264;
export const TECH_START_X = 60;
export const TECH_MAX_TIER = 26;
export const TECH_CANVAS_WIDTH = TECH_START_X + TECH_MAX_TIER * TECH_COL_STEP + 140; // 7064 px

export const TECH_LANES: TechLaneMeta[] = [
  {
    id: 'fabrication',
    label: 'FABRICATION & PROCESS NODES',
    shortLabel: 'Fabrication',
    accent: '#06B6D4',
    headerY: 72,
    rowYs: [104, 188, 272, 356],
  },
  {
    id: 'lithography',
    label: 'LITHOGRAPHY & METROLOGY',
    shortLabel: 'Lithography',
    accent: '#22D3EE',
    headerY: 454,
    rowYs: [486, 570, 654],
  },
  {
    id: 'transistors',
    label: 'TRANSISTOR PHYSICS & MATERIALS',
    shortLabel: 'Transistors',
    accent: '#A78BFA',
    headerY: 752,
    rowYs: [784, 868, 952],
  },
  {
    id: 'cpu',
    label: 'CPU MICROARCHITECTURE & ISA',
    shortLabel: 'CPU Tech',
    accent: '#38BDF8',
    headerY: 1050,
    rowYs: [1082, 1166, 1250, 1334],
  },
  {
    id: 'gpu',
    label: 'GPU & PARALLEL COMPUTE',
    shortLabel: 'GPU Tech',
    accent: '#F59E0B',
    headerY: 1432,
    rowYs: [1464, 1548, 1632],
  },
  {
    id: 'memory',
    label: 'MEMORY & SOLID-STATE STORAGE',
    shortLabel: 'Memory',
    accent: '#14B8A6',
    headerY: 1730,
    rowYs: [1762, 1846, 1930],
  },
  {
    id: 'packaging',
    label: 'PACKAGING, THERMAL & FAB INFRASTRUCTURE',
    shortLabel: 'Packaging & Fab',
    accent: '#10B981',
    headerY: 2028,
    rowYs: [2060, 2144, 2228],
  },
];

export const TECH_CANVAS_HEIGHT = 2350;

export const TECH_LANE_MAP: Record<TechLaneId, TechLaneMeta> = TECH_LANES.reduce(
  (acc, lane) => {
    acc[lane.id] = lane;
    return acc;
  },
  {} as Record<TechLaneId, TechLaneMeta>
);

export const TECH_ERAS: TechEraBanner[] = [
  { id: 'era_1', label: 'ERA I · PRIMITIVE', subtitle: '10 μm – 1.5 μm', startTier: 1, endTier: 3, accent: '#94A3B8' },
  { id: 'era_2', label: 'ERA II · VLSI', subtitle: '1.0 μm – 350 nm', startTier: 4, endTier: 6, accent: '#38BDF8' },
  { id: 'era_3', label: 'ERA III · SUB-MICRON', subtitle: '250 nm – 130 nm', startTier: 7, endTier: 9, accent: '#22D3EE' },
  { id: 'era_4', label: 'ERA IV · GIGAHERTZ', subtitle: '90 nm – 45 nm', startTier: 10, endTier: 12, accent: '#14B8A6' },
  { id: 'era_5', label: 'ERA V · MULTICORE', subtitle: '32 nm – 14 nm', startTier: 13, endTier: 15, accent: '#10B981' },
  { id: 'era_6', label: 'ERA VI · FINFET / EUV', subtitle: '10 nm – 3 nm', startTier: 16, endTier: 18, accent: '#F59E0B' },
  { id: 'era_7', label: 'ERA VII · ANGSTROM', subtitle: '2 nm – 0.5 nm', startTier: 19, endTier: 22, accent: '#A78BFA' },
  { id: 'era_8', label: 'ERA VIII · POST-SILICON FRONTIER', subtitle: 'Cryo · Photonic · CNT · Topo', startTier: 23, endTier: 26, accent: '#D97706' },
];

/** Smooth exponential RP cost curve across 26 progressive tiers (Year 0001 -> Post-Silicon Millennia) */
export function tierRpCost(tier: number, factor = 1.0): number {
  const baseTable = [
    55,      // T1
    105,     // T2
    185,     // T3
    310,     // T4
    500,     // T5
    780,     // T6
    1180,    // T7
    1750,    // T8
    2550,    // T9
    3650,    // T10
    5200,    // T11
    7400,    // T12
    10500,   // T13
    14800,   // T14
    20800,   // T15
    29000,   // T16
    40500,   // T17
    56000,   // T18
    78000,   // T19
    108000,  // T20
    150000,  // T21
    205000,  // T22
    280000,  // T23
    380000,  // T24
    520000,  // T25
    720000,  // T26
  ];
  const base = baseTable[Math.max(0, Math.min(baseTable.length - 1, tier - 1))];
  const raw = base * factor;
  if (raw < 200) return Math.round(raw / 5) * 5;
  if (raw < 1500) return Math.round(raw / 10) * 10;
  if (raw < 15000) return Math.round(raw / 50) * 50;
  if (raw < 100000) return Math.round(raw / 250) * 250;
  return Math.round(raw / 1000) * 1000;
}

function tierX(tier: number): number {
  return TECH_START_X + (tier - 1) * TECH_COL_STEP;
}

function laneY(lane: TechLaneId, subRow: number): number {
  const rows = TECH_LANE_MAP[lane].rowYs;
  return rows[Math.max(0, Math.min(rows.length - 1, subRow))];
}

function formatEffectsSummary(effects: TechEffects): string[] {
  const out: string[] = [];
  if (effects.logicDensityMult && effects.logicDensityMult !== 1) {
    out.push(`+${((effects.logicDensityMult - 1) * 100).toFixed(1)}% Logic Density`);
  }
  if (effects.sramDensityMult && effects.sramDensityMult !== 1) {
    out.push(`+${((effects.sramDensityMult - 1) * 100).toFixed(1)}% SRAM Density`);
  }
  if (effects.defectReductionMult && effects.defectReductionMult !== 1) {
    out.push(`-${((1 - effects.defectReductionMult) * 100).toFixed(1)}% Wafer Defect D0`);
  }
  if (effects.leakageReductionMult && effects.leakageReductionMult !== 1) {
    out.push(`-${((1 - effects.leakageReductionMult) * 100).toFixed(1)}% Static Leakage`);
  }
  if (effects.clockHeadroomMult && effects.clockHeadroomMult !== 1) {
    out.push(`+${((effects.clockHeadroomMult - 1) * 100).toFixed(1)}% Clock Headroom`);
  }
  if (effects.ipcBonusMult && effects.ipcBonusMult !== 1) {
    out.push(`+${((effects.ipcBonusMult - 1) * 100).toFixed(1)}% CPU IPC Efficiency`);
  }
  if (effects.gpuComputeMult && effects.gpuComputeMult !== 1) {
    out.push(`+${((effects.gpuComputeMult - 1) * 100).toFixed(1)}% GPU Compute & Render`);
  }
  if (effects.memoryBandwidthMult && effects.memoryBandwidthMult !== 1) {
    out.push(`+${((effects.memoryBandwidthMult - 1) * 100).toFixed(1)}% Memory & Storage BW`);
  }
  if (effects.coolingEfficiencyMult && effects.coolingEfficiencyMult !== 1) {
    out.push(`+${((effects.coolingEfficiencyMult - 1) * 100).toFixed(1)}% Thermal Cooling Efficiency`);
  }
  if (effects.siliconRefiningMult && effects.siliconRefiningMult !== 1) {
    out.push(`+${((effects.siliconRefiningMult - 1) * 100).toFixed(1)}% Silicon Refining Yield`);
  }
  if (effects.fabThroughputMult && effects.fabThroughputMult !== 1) {
    out.push(`+${((effects.fabThroughputMult - 1) * 100).toFixed(1)}% Fab Wafer Throughput`);
  }
  if (effects.rpGenerationMult && effects.rpGenerationMult !== 1) {
    out.push(`+${((effects.rpGenerationMult - 1) * 100).toFixed(1)}% Lab Research Output`);
  }
  if (effects.waferDiameterMm) {
    out.push(`${effects.waferDiameterMm} mm Wafer Standard`);
  }
  if (effects.maxParallelResearch) {
    out.push(`Up to ${effects.maxParallelResearch} Parallel Research Slots`);
  }
  if (effects.maxPcieGen) {
    out.push(`PCIe Gen ${effects.maxPcieGen} I/O Lanes`);
  }
  return out;
}

interface TrackItemSpec {
  id: string;
  name: string;
  tier: number;
  summary: string;
  effects?: TechEffects;
  extraUnlocks?: string[];
  extraPrereqs?: string[];
  rpFactor?: number;
  categoryOverride?: TechCategory;
  constraintWarning?: string;
}

function buildTrackNodes(
  lane: TechLaneId,
  defaultCategory: TechCategory,
  subRow: number,
  items: TrackItemSpec[],
  linkSequentially = true
): TechNode[] {
  const nodes: TechNode[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const prereqs: string[] = [];
    if (linkSequentially && i > 0) {
      prereqs.push(items[i - 1].id);
    }
    if (item.extraPrereqs) {
      for (const p of item.extraPrereqs) {
        if (!prereqs.includes(p)) prereqs.push(p);
      }
    }
    const effects = item.effects ?? {};
    const unlocksSummary = [
      ...(item.extraUnlocks ?? []),
      ...formatEffectsSummary(effects),
    ];
    nodes.push({
      id: item.id,
      name: item.name,
      category: item.categoryOverride ?? (item.tier >= 23 ? 'frontier' : defaultCategory),
      lane,
      tier: item.tier,
      rpCost: tierRpCost(item.tier, item.rpFactor ?? 1.0),
      prerequisites: prereqs,
      x: tierX(item.tier),
      y: laneY(lane, subRow),
      summary: item.summary,
      unlocksSummary,
      ...(item.constraintWarning ? { constraintWarning: item.constraintWarning } : {}),
      ...(Object.keys(effects).length > 0 ? { effects } : {}),
    });
  }
  return nodes;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LANE 1: FABRICATION & PROCESS NODES (~90 nodes across 4 sub-rows)
// ═══════════════════════════════════════════════════════════════════════════════

const FAB_ROW0_NODES: TrackItemSpec[] = [
  { id: 'fab_3000nm', name: '3.0 μm Optical MOS Process', tier: 1, rpFactor: 1.0, summary: 'Refined photographic mask alignment shrinks minimum gate length from 10 μm to 3 μm.', extraUnlocks: ['3.0 μm Process Node (9× density)', '55 MHz reference clock'], effects: { logicDensityMult: 1.02 } },
  { id: 'fab_2000nm', name: '2.0 μm LOCOS Isolation', tier: 2, summary: 'Local oxidation of silicon isolates adjacent MOS devices with lower field capacitance.', effects: { logicDensityMult: 1.018, leakageReductionMult: 0.985 } },
  { id: 'fab_1500nm', name: '1.5 μm Double-Metal Process', tier: 3, summary: 'Dual aluminum interconnect layers unlock dense cell routing across early VLSI dies.', effects: { logicDensityMult: 1.02, fabThroughputMult: 1.015 } },
  { id: 'fab_1000nm', name: '1.0 μm CMOS Process', tier: 4, rpFactor: 0.65, summary: 'Complementary p/n silicon wells drop static power and enable dense VLSI integration.', extraUnlocks: ['1.0 μm CMOS Node (0.18 MTr/mm²)', '3.3 V nominal logic rail'], effects: { logicDensityMult: 1.02, leakageReductionMult: 0.98 } },
  { id: 'fab_800nm', name: '800 nm Twin-Well CMOS', tier: 5, summary: 'Independent n-well and p-well doping profiles balance carrier mobility and latch-up immunity.', effects: { logicDensityMult: 1.018, sramDensityMult: 1.018 } },
  { id: 'fab_350nm', name: '350 nm Deep Optical Node', tier: 6, rpFactor: 0.72, extraPrereqs: ['fab_stepper'], summary: 'KrF excimer laser illumination pushes patterning well below one micrometer.', extraUnlocks: ['350 nm Process Node (1.2 MTr/mm²)'], effects: { waferDiameterMm: 200, logicDensityMult: 1.02 } },
  { id: 'fab_250nm', name: '250 nm CMP Planarization', tier: 7, summary: 'Chemical-mechanical polishing flattens interlayer oxides for crisp deep-UV focus depth.', effects: { defectReductionMult: 0.982, logicDensityMult: 1.018 } },
  { id: 'fab_180nm', name: '180 nm Fluorosilicate Gate', tier: 8, summary: 'Fluorine-doped silicate glass lowers interconnect capacitance for hundred-MHz buses.', effects: { clockHeadroomMult: 1.008, logicDensityMult: 1.018 } },
  { id: 'fab_130nm', name: '130 nm Copper Damascene', tier: 9, rpFactor: 0.75, summary: 'Electroplated copper traces slash RC wire delay and launch the gigahertz era.', extraUnlocks: ['130 nm Process Node (7.5 MTr/mm²)', '1.85 GHz reference clock'], effects: { clockHeadroomMult: 1.01, logicDensityMult: 1.02 } },
  { id: 'fab_90nm', name: '90 nm Uniaxial Strained Silicon', tier: 10, summary: 'Silicon-germanium source/drain stressors stretch the crystal lattice to boost carrier mobility.', effects: { clockHeadroomMult: 1.01, logicDensityMult: 1.02 } },
  { id: 'fab_65nm', name: '65 nm Low-k Organosilicate', tier: 11, summary: 'Porous carbon-doped oxide insulators cut wire-to-wire RC crosstalk across 8 metal layers.', effects: { clockHeadroomMult: 1.008, leakageReductionMult: 0.986 } },
  { id: 'fab_45nm', name: '45 nm Immersion Process', tier: 12, rpFactor: 0.75, extraPrereqs: ['fab_duv'], summary: 'Strained silicon channels and immersion DUV open the modern multicore age.', extraUnlocks: ['45 nm Process Node (28 MTr/mm²)', '3.2 GHz reference clock'], constraintWarning: 'Planar MOSFET suffers noticeable tunneling leakage on 45 nm and smaller.', effects: { logicDensityMult: 1.02 } },
  { id: 'fab_32nm', name: '32 nm Dual-Stress Liner', tier: 13, summary: 'Independent tensile and compressive nitride liners tune NMOS and PMOS drive currents.', effects: { logicDensityMult: 1.02, clockHeadroomMult: 1.008 } },
  { id: 'fab_22nm', name: '22 nm Ultra-Low-k Airgap', tier: 14, summary: 'Controlled dielectric airgaps around tight metal pitches reduce parasitic capacitance.', effects: { clockHeadroomMult: 1.008, sramDensityMult: 1.02 } },
  { id: 'fab_14nm', name: '14 nm Multi-Patterning Node', tier: 15, rpFactor: 0.78, extraPrereqs: ['fab_hkmg'], summary: 'Self-aligned quadruple patterning pushes DUV lithography to its physical limit.', extraUnlocks: ['14 nm Process Node (78 MTr/mm²)', '4.3 GHz reference clock'], effects: { logicDensityMult: 1.02 } },
  { id: 'fab_10nm', name: '10 nm Cobalt Local Interconnect', tier: 16, summary: 'Cobalt contact plugs resist electromigration where copper vias lose conductivity.', effects: { logicDensityMult: 1.02, defectReductionMult: 0.985 } },
  { id: 'fab_5nm', name: '5 nm EUV Process', tier: 17, rpFactor: 0.8, extraPrereqs: ['fab_finfet', 'fab_euv'], summary: 'Full-layer EUV patterning enables tens of billions of transistors on a single reticle.', extraUnlocks: ['5 nm EUV Node (185 MTr/mm²)', '5.2 GHz reference clock'], constraintWarning: 'SRAM cell scaling begins lagging logic density below 5 nm.', effects: { logicDensityMult: 1.022 } },
  { id: 'fab_3nm', name: '3 nm FinFlex Standard Cells', tier: 18, summary: 'Mix-and-match track heights optimize speed-critical and area-dense logic blocks side-by-side.', effects: { logicDensityMult: 1.02, sramDensityMult: 1.018 } },
  { id: 'fab_2nm', name: '2 nm Backside Power Node', tier: 19, rpFactor: 0.82, extraPrereqs: ['fab_gaafet'], summary: 'Buried power rails route current from the wafer backside, freeing frontside signal routing.', extraUnlocks: ['2 nm GAA Node (340 MTr/mm²)'], effects: { waferDiameterMm: 450, logicDensityMult: 1.022 } },
  { id: 'fab_14a', name: '1.4 nm Direct Backside Contact', tier: 20, summary: 'Nano-TSV contacts land directly on transistor source/drain epi for ultra-low IR voltage drop.', effects: { clockHeadroomMult: 1.01, logicDensityMult: 1.022 } },
  { id: 'fab_07nm', name: '0.7 nm Angstrom Process', tier: 21, rpFactor: 0.85, extraPrereqs: ['fab_high_na'], summary: 'Atomic-layer deposition reaches the ultimate boundary of conventional silicon CMOS.', extraUnlocks: ['0.7 nm Angstrom Node (680 MTr/mm²)', 'Gateway to Frontier Synthesis'], constraintWarning: 'Quantum tunneling floor spikes sharply without CFET or post-silicon paradigms.', effects: { logicDensityMult: 1.025 } },
  { id: 'fab_05nm_epi', name: '0.5 nm Monolayer Selective Epi', tier: 22, summary: 'Atomically smooth epitaxial growth eliminates single-atom roughness across Angstrom channels.', effects: { defectReductionMult: 0.978, logicDensityMult: 1.022 } },
  { id: 'fab_03nm_lattice', name: '0.3 nm Sub-Angstrom Lattice Control', tier: 23, summary: 'Precision strained heterojunction lattices maintain coherence near atomic bond spacings.', effects: { logicDensityMult: 1.025, sramDensityMult: 1.025 } },
  { id: 'frontier_cnt', name: '3D Monolithic Carbon Nanotube Paradigm', tier: 24, rpFactor: 0.82, extraPrereqs: ['fab_cfet'], summary: 'Ballistic carbon-nanotube channels stacked monolithically achieve unprecedented transistor density.', extraUnlocks: ['0.2 nm 3D CNT Node (1,850 MTr/mm²)', 'Ballistic CNT Channel Transistor'], constraintWarning: 'Metallic nanotube chirality defects spike baseline D0 — requires high QA and node maturation.', effects: { unlocksParadigm: 'cnt_3d', logicDensityMult: 1.03 } },
  { id: 'fab_graphene_ic', name: '0.15 nm Graphene Nanoribbon Bus', tier: 25, summary: 'Ballistic single-atom-thick graphene ribbons eradicate interconnect resistance heating.', effects: { clockHeadroomMult: 1.012, leakageReductionMult: 0.98 } },
  { id: 'frontier_topological', name: 'Topological Hybrid Co-Processing', tier: 26, rpFactor: 0.85, extraPrereqs: ['frontier_cryogenic', 'frontier_photonic'], summary: 'Braided topological states coupled to photonic-CNT interconnects unlock post-classical compute scaling.', extraUnlocks: ['0.1 nm Topological Hybrid Node (2,600 MTr/mm²)', 'Topological Braided CPU Core & TOPO-X ISA'], constraintWarning: 'Highest defect density (0.96 D0), silicon intensity (135 Si/wafer), and power draw.', effects: { unlocksParadigm: 'topological', logicDensityMult: 1.035, ipcBonusMult: 1.03 } },
];

const FAB_ROW1_INTERCONNECT: TrackItemSpec[] = [
  { id: 'fab_ic_al_sputter', name: 'Aluminum Sputter Deposition', tier: 1, rpFactor: 0.95, summary: 'Magnetron sputtering deposits uniform aluminum bus lines with fewer open-circuit voids.', effects: { defectReductionMult: 0.985 } },
  { id: 'fab_ic_poly_silicide', name: 'Tungsten Silicide Gate Straps', tier: 3, summary: 'Silicide cladding cuts polysilicon wordline sheet resistance by 8×.', effects: { clockHeadroomMult: 1.006, sramDensityMult: 1.015 } },
  { id: 'fab_ic_ti_barrier', name: 'Titanium Nitride Diffusion Barrier', tier: 4, summary: 'Prevents metal spiking into shallow source/drain junctions during thermal anneals.', effects: { defectReductionMult: 0.985, leakageReductionMult: 0.99 } },
  { id: 'fab_ic_w_plugs', name: 'CVD Tungsten Via Plugs', tier: 5, summary: 'Chemical vapor deposition fills high-aspect-ratio vertical vias cleanly.', effects: { logicDensityMult: 1.015, fabThroughputMult: 1.015 } },
  { id: 'fab_ic_3metal', name: '4-Layer Global Metal Stack', tier: 6, summary: 'Dedicated upper power/clock planes relieve lower signal congestion.', effects: { logicDensityMult: 1.016, clockHeadroomMult: 1.006 } },
  { id: 'fab_ic_dual_damascene', name: 'Dual-Damascene Trench Etch', tier: 8, summary: 'Etches via and trench in a single copper electroplating pass, halving interconnect steps.', effects: { fabThroughputMult: 1.02, defectReductionMult: 0.986 } },
  { id: 'fab_ic_ta_liner', name: 'Tantalum Copper Seed Liners', tier: 9, summary: 'Ultra-thin Ta/TaN barrier liners prevent copper diffusion into silicon substrates.', effects: { defectReductionMult: 0.985, leakageReductionMult: 0.988 } },
  { id: 'fab_ic_sioc_lowk', name: 'Porous SiOC Low-k Dielectric', tier: 10, summary: 'Nanoporous dielectrics lower k-value to 2.5, reducing dynamic interconnect switching energy.', effects: { clockHeadroomMult: 1.007, leakageReductionMult: 0.988 } },
  { id: 'fab_ic_10metal', name: '10-Layer Graded Metal Hierarchy', tier: 12, summary: 'Thick top-layer redistribution traces tame IR drop on 100W+ multicore dies.', effects: { clockHeadroomMult: 1.008, logicDensityMult: 1.015 } },
  { id: 'fab_ic_cu_mn_cap', name: 'Copper-Manganese Self-Forming Barrier', tier: 13, summary: 'Manganese migrates to trench walls during anneal, maximizing conductive copper cross-section.', effects: { clockHeadroomMult: 1.007, defectReductionMult: 0.986 } },
  { id: 'fab_ic_co_m0', name: 'Cobalt M0/M1 Local Interconnects', tier: 15, summary: 'Eliminates thick barrier liners in tightest local tracks to curb electromigration.', effects: { logicDensityMult: 1.018, defectReductionMult: 0.985 } },
  { id: 'fab_ic_ru_subtractive', name: 'Ruthenium Subtractive Etch', tier: 17, summary: 'Barrierless ruthenium wires maintain low resistivity below 16 nm metal half-pitch.', effects: { logicDensityMult: 1.018, clockHeadroomMult: 1.008 } },
  { id: 'fab_ic_bspdn_v1', name: 'Backside Power Delivery (BSPDN)', tier: 18, summary: 'Decouples power rails from signal routing via wafer thinning and backside metallization.', effects: { logicDensityMult: 1.022, clockHeadroomMult: 1.01 } },
  { id: 'fab_ic_airgap_ru', name: 'Airgap-Isolated Ruthenium Tracks', tier: 19, summary: 'Replaces inter-line oxide with vacuum micro-cavities for near-unity dielectric constant.', effects: { clockHeadroomMult: 1.009, leakageReductionMult: 0.988 } },
  { id: 'fab_ic_moly_via', name: 'Molybdenum Super-Via Stacks', tier: 20, summary: 'Multi-layer vertical molybdenum super-vias slash inter-layer transition resistance.', effects: { logicDensityMult: 1.018, sramDensityMult: 1.018 } },
  { id: 'fab_ic_bpr_super', name: 'Buried Power Rail Nano-Grid', tier: 21, summary: 'Embeds power tracks directly inside shallow trench isolation beneath standard cells.', effects: { logicDensityMult: 1.022, fabThroughputMult: 1.015 } },
  { id: 'fab_ic_graphene_cap', name: 'Graphene-Capped Copper Interconnects', tier: 22, summary: 'Monolayer graphene cladding stops surface electron scattering in sub-10 nm wires.', effects: { clockHeadroomMult: 1.01, defectReductionMult: 0.985 } },
  { id: 'fab_ic_topological_metal', name: 'Weyl Semimetal Interconnects', tier: 24, summary: 'Topologically protected surface conduction scales conductance UP as wire width shrinks.', effects: { clockHeadroomMult: 1.012, logicDensityMult: 1.02 } },
  { id: 'fab_ic_optical_clock', name: 'On-Die Optical Clock Distribution', tier: 25, summary: 'Phase-locked photonic waveguides deliver zero-skew multi-GHz clock trees die-wide.', effects: { clockHeadroomMult: 1.014, leakageReductionMult: 0.985 } },
];

const FAB_ROW2_ALD_PROCESS: TrackItemSpec[] = [
  { id: 'fab_ald_thermal_ox', name: 'Dry Thermal Gate Oxidation', tier: 1, rpFactor: 0.9, summary: 'Ultra-clean furnace oxidation grows defect-free silicon dioxide gate insulators.', effects: { leakageReductionMult: 0.986, defectReductionMult: 0.988 } },
  { id: 'fab_ald_ion_implant', name: 'Precision Ion Implantation', tier: 2, summary: 'Accelerated dopant beams replace furnace diffusion for exact junction depth control.', effects: { defectReductionMult: 0.984, logicDensityMult: 1.015 } },
  { id: 'fab_ald_plasma_etch', name: 'Anisotropic Reactive Ion Etch', tier: 3, summary: 'Directional plasma etching carves crisp vertical sidewalls instead of isotropic undercuts.', effects: { logicDensityMult: 1.016, defectReductionMult: 0.986 } },
  { id: 'fab_ald_rta', name: 'Rapid Thermal Annealing', tier: 5, summary: 'Flash halogen lamps activate implanted dopants in seconds without blurring junctions.', effects: { leakageReductionMult: 0.986, fabThroughputMult: 1.015 } },
  { id: 'fab_ald_sti', name: 'Shallow Trench Isolation (STI)', tier: 6, summary: 'Replaces bird-beak LOCOS oxide with vertical etched trenches for tighter active spacing.', effects: { logicDensityMult: 1.018, sramDensityMult: 1.018 } },
  { id: 'fab_ald_sacrificial', name: 'Sacrificial Oxide Smoothing', tier: 7, summary: 'Strips plasma-damaged surface silicon before final gate dielectric growth.', effects: { defectReductionMult: 0.984, leakageReductionMult: 0.988 } },
  { id: 'fab_ald_first_ald', name: 'Atomic Layer Deposition (ALD)', tier: 9, summary: 'Self-limiting sequential gas pulses deposit conformal films one atomic monolayer at a time.', effects: { defectReductionMult: 0.982, leakageReductionMult: 0.984 } },
  { id: 'fab_ald_laser_spike', name: 'Millisecond Laser Spike Anneal', tier: 11, summary: 'Scanning laser pulses activate ultra-shallow junctions with near-zero dopant diffusion.', effects: { clockHeadroomMult: 1.008, leakageReductionMult: 0.986 } },
  { id: 'fab_ald_ale', name: 'Atomic Layer Etching (ALE)', tier: 13, summary: 'Removes material one atomic sheet per cycle for zero-damage fin and channel shaping.', effects: { defectReductionMult: 0.98, logicDensityMult: 1.016 } },
  { id: 'fab_ald_selective_dep', name: 'Area-Selective Deposition', tier: 15, summary: 'Bottom-up self-aligned dielectric growth eliminates costly lithography mask steps.', effects: { fabThroughputMult: 1.022, defectReductionMult: 0.984 } },
  { id: 'fab_ald_cryo_etch', name: 'Cryogenic High-Aspect Plasma Etch', tier: 16, summary: 'Sub-zero wafer chucks carve ultra-deep vertical channels with mirror-smooth walls.', effects: { sramDensityMult: 1.02, fabThroughputMult: 1.018 } },
  { id: 'fab_ald_epitaxy_3d', name: 'Selective SiGe/Si Superlattice Epi', tier: 18, summary: 'Alternating nanometer epitaxial stacks form the raw blank for GAA nanosheet release.', effects: { logicDensityMult: 1.02, leakageReductionMult: 0.984 } },
  { id: 'fab_ald_isotropic_rel', name: 'Vapor-Phase Channel Release Etch', tier: 19, summary: 'Gently dissolves sacrificial SiGe layers without collapsing delicate 5 nm silicon ribbons.', effects: { defectReductionMult: 0.98, logicDensityMult: 1.018 } },
  { id: 'fab_ald_2d_mocvd', name: 'Wafer-Scale 2D TMD MOCVD', tier: 21, summary: 'Grows single-crystal molybdenum disulfide sheets uniformly across 450 mm wafers.', effects: { logicDensityMult: 1.022, leakageReductionMult: 0.982 } },
  { id: 'fab_ald_atomic_repair', name: 'In-Situ Atomic Vacancy Healing', tier: 23, summary: 'Targeted hydrogen-plasma passivation heals dangling atomic bonds before metallization.', effects: { defectReductionMult: 0.978, leakageReductionMult: 0.982 } },
  { id: 'fab_ald_quantum_epi', name: 'Isotopically Pure Si-28 Epitaxy', tier: 25, summary: 'Spin-zero Silicon-28 wafers cut phonon scattering and boost thermal & quantum coherence.', effects: { coolingEfficiencyMult: 1.025, defectReductionMult: 0.98 } },
];

const FAB_ROW3_SILICON_CLEANROOM: TrackItemSpec[] = [
  { id: 'fab_si_cz_puller', name: 'Czochralski Ingot Pulling', tier: 1, rpFactor: 0.85, summary: 'Precision seed-crystal pulling grows dislocation-free monocrystalline silicon boules.', effects: { siliconRefiningMult: 1.05 } },
  { id: 'fab_si_rca_clean', name: 'RCA Ultra-Pure Wet Cleaning', tier: 2, summary: 'Sequential chemical baths strip metallic and organic contaminants from bare wafers.', effects: { defectReductionMult: 0.984 } },
  { id: 'fab_si_iso5', name: 'ISO Class 5 HEPA Laminar Flow', tier: 3, summary: 'Vertical laminar air curtains sweep airborne particulates away from wafer cassettes.', effects: { defectReductionMult: 0.982, fabThroughputMult: 1.015 } },
  { id: 'fab_si_9n_siemens', name: '9N Siemens Polysilicon Refining', tier: 4, summary: 'Trichlorosilane distillation achieves 99.9999999% electronic-grade silicon purity.', effects: { siliconRefiningMult: 1.06, defectReductionMult: 0.988 } },
  { id: 'fab_si_slicing_wire', name: 'Multi-Wire Diamond Kerf Slicing', tier: 5, summary: 'Ultra-thin diamond slurries cut 22% more wafers from every refined silicon boule.', effects: { siliconRefiningMult: 1.06 } },
  { id: 'fab_si_epi_wafer', name: 'Epitaxial Prime Wafers', tier: 7, summary: 'Grows a pristine lightly-doped silicon surface layer over low-resistance substrate wafers.', effects: { defectReductionMult: 0.982, leakageReductionMult: 0.988 } },
  { id: 'fab_si_foup_smif', name: 'SMIF Mini-Environment Pods', tier: 8, summary: 'Sealed nitrogen-purged carrier pods isolate wafers from human-borne dust.', effects: { defectReductionMult: 0.982, fabThroughputMult: 1.018 } },
  { id: 'fab_si_iso3', name: 'ISO Class 3 Automated Cleanroom', tier: 10, summary: 'Under-10-particle-per-m³ filtration suppresses sub-micron killer defects.', effects: { defectReductionMult: 0.98, fabThroughputMult: 1.02 } },
  { id: 'fab_si_11n_fbr', name: '11N Fluidized-Bed Silicon Reactor', tier: 11, summary: 'Continuous silane pyrolysis slashes refinery energy draw while raising feedstock yield.', effects: { siliconRefiningMult: 1.08 } },
  { id: 'fab_si_oht_rails', name: 'Overhead Hoist Transport (OHT)', tier: 12, summary: 'Ceiling-mounted robotic shuttles route FOUP wafer pods between tools at 24/7 cadence.', effects: { fabThroughputMult: 1.035 } },
  { id: 'fab_si_upw_reclaim', name: 'Closed-Loop Ultra-Pure Water Plant', tier: 14, summary: '18.2 MΩ·cm deionized water reclamation eliminates trace ionic wafer residue.', effects: { defectReductionMult: 0.984, siliconRefiningMult: 1.04 } },
  { id: 'fab_si_iso1', name: 'ISO Class 1 Lights-Out Fab', tier: 16, summary: 'Fully robotic dark-fab bays eliminate operator particle shedding completely.', effects: { defectReductionMult: 0.978, fabThroughputMult: 1.035 } },
  { id: 'fab_si_wafer_reclaim', name: 'Plasma Wafer Reclaim Loops', tier: 17, summary: 'Recycles test and monitor wafers with zero mechanical thinning loss.', effects: { siliconRefiningMult: 1.07 } },
  { id: 'fab_si_digital_twin', name: 'Fab Digital-Twin Process Control', tier: 19, summary: 'Real-time run-to-run chamber feedback tightens across-wafer critical dimension uniformity.', effects: { fabThroughputMult: 1.035, defectReductionMult: 0.982 } },
  { id: 'fab_si_12n_zone', name: '12N Float-Zone Quantum Silicon', tier: 21, summary: 'Crucible-free float-zone refining removes oxygen impurities to parts-per-trillion levels.', effects: { siliconRefiningMult: 1.09, defectReductionMult: 0.98 } },
  { id: 'fab_si_atomic_foundry', name: 'Autonomous Molecular Fab Bays', tier: 24, summary: 'Self-calibrating vacuum-tunnel tool clusters link epitaxy, litho, and etch without air exposure.', effects: { fabThroughputMult: 1.05, defectReductionMult: 0.975 } },
];

// ═══════════════════════════════════════════════════════════════════════════════
// LANE 2: LITHOGRAPHY & METROLOGY (~66 nodes across 3 sub-rows)
// ═══════════════════════════════════════════════════════════════════════════════

const LITHO_ROW0_OPTICS: TrackItemSpec[] = [
  { id: 'litho_contact_mask', name: 'Hard-Contact Chromium Masks', tier: 1, rpFactor: 0.9, summary: 'Sputtered chrome-on-quartz photomasks resist scratching across repeated wafer exposures.', effects: { defectReductionMult: 0.985 } },
  { id: 'litho_proximity', name: 'Proximity Gap Mask Aligner', tier: 2, summary: 'Maintains a 15-micron air cushion between mask and photoresist to prevent sticking defects.', effects: { defectReductionMult: 0.982, fabThroughputMult: 1.015 } },
  { id: 'fab_stepper', name: 'Optical Projection Stepper', tier: 3, rpFactor: 0.72, extraPrereqs: ['fab_3000nm'], summary: 'Step-and-repeat 5× reduction lenses replace contact masks, slashing mask wear defects.', extraUnlocks: ['Optical Stepper Lithography (-26% defects)', 'Reticle limit expanded to 440 mm²'], effects: { lithoId: 'litho_stepper', waferDiameterMm: 150, defectReductionMult: 0.985 } },
  { id: 'litho_gline', name: '436 nm g-Line Mercury Optics', tier: 4, summary: 'High-numerical-aperture g-line lenses resolve crisp sub-micron lines across wider fields.', effects: { logicDensityMult: 1.016, defectReductionMult: 0.986 } },
  { id: 'litho_iline', name: '365 nm i-Line Step-and-Scan', tier: 5, summary: 'Shorter ultraviolet mercury-arc wavelength tightens Rayleigh diffraction limits.', effects: { logicDensityMult: 1.018, fabThroughputMult: 1.015 } },
  { id: 'litho_krf_248', name: '248 nm KrF Excimer Scanner', tier: 6, summary: 'Krypton-fluoride deep-UV lasers unlock high-volume sub-350 nm wafer scanning.', effects: { logicDensityMult: 1.018, defectReductionMult: 0.985 } },
  { id: 'litho_oai', name: 'Off-Axis Annular Illumination', tier: 7, summary: 'Tilted condenser rings double effective depth of focus on dense repeating pitches.', effects: { defectReductionMult: 0.984, sramDensityMult: 1.015 } },
  { id: 'litho_psm', name: 'Attenuated Phase-Shift Masks', tier: 8, summary: 'Destructive optical phase interference sharpens feature edge contrast beyond raw lens NA.', effects: { logicDensityMult: 1.018, defectReductionMult: 0.985 } },
  { id: 'litho_arf_dry', name: '193 nm ArF Dry Excimer Scanner', tier: 9, summary: 'Argon-fluoride lasers and fused-silica lenses define 130 nm and 90 nm critical layers.', effects: { logicDensityMult: 1.02, fabThroughputMult: 1.018 } },
  { id: 'fab_duv', name: '193 nm Immersion DUV', tier: 10, rpFactor: 0.75, extraPrereqs: ['fab_350nm'], summary: 'Purified water lens immersion raises numerical aperture to 1.35 beyond air diffraction limits.', extraUnlocks: ['Immersion DUV Lithography (-22% defects)', 'Reticle limit 680 mm²'], effects: { lithoId: 'litho_duv', waferDiameterMm: 300, defectReductionMult: 0.985 } },
  { id: 'litho_lele', name: 'LELE Double Patterning', tier: 11, summary: 'Splits dense metal layers across two interleaved Litho-Etch passes to halve minimum pitch.', effects: { logicDensityMult: 1.018, sramDensityMult: 1.016 } },
  { id: 'litho_sadp', name: 'Self-Aligned Double Patterning', tier: 12, summary: 'Conformal spacer sidewalls define ultra-uniform fin pitches immune to overlay jitter.', effects: { logicDensityMult: 1.02, defectReductionMult: 0.986 } },
  { id: 'litho_smo', name: 'Source-Mask Co-Optimization', tier: 13, summary: 'Jointly synthesizes freeform illuminator pupils and reticle shapes for peak process windows.', effects: { defectReductionMult: 0.982, logicDensityMult: 1.016 } },
  { id: 'litho_saqp', name: 'Self-Aligned Quadruple Patterning', tier: 14, summary: 'Two cascaded spacer cycles push 193 nm immersion scanners down to 14 nm and 10 nm pitches.', effects: { logicDensityMult: 1.02, sramDensityMult: 1.018 } },
  { id: 'litho_ilt', name: 'Inverse Computational Lithography', tier: 15, summary: 'GPU-accelerated wave-optics solvers pre-distort curvilinear masks for razor-sharp wafer prints.', effects: { defectReductionMult: 0.982, logicDensityMult: 1.016 } },
  { id: 'fab_euv', name: '13.5 nm Extreme UV Scanner', tier: 16, rpFactor: 0.78, extraPrereqs: ['fab_14nm', 'fab_finfet'], summary: 'Tin-plasma extreme ultraviolet light reflected by Bragg mirrors simplifies ultra-dense layers.', extraUnlocks: ['EUV Lithography (-22% defects)', 'Reticle limit 858 mm²'], constraintWarning: 'EUV light sources raise fab facility electrical power draw by 65%.', effects: { lithoId: 'litho_euv', defectReductionMult: 0.985 } },
  { id: 'litho_euv_pellicle', name: 'Carbon-Nanotube EUV Pellicles', tier: 17, summary: '92%-transmissive freestanding membranes shield EUV reticles from tin debris.', effects: { defectReductionMult: 0.98, fabThroughputMult: 1.022 } },
  { id: 'litho_euv_500w', name: '500 W Dual-Pulse Tin-Plasma Source', tier: 18, summary: 'High-power CO2 laser droplet blasting boosts EUV wafer throughput past 200 wafers/hour.', effects: { fabThroughputMult: 1.035 } },
  { id: 'litho_euv_saqp', name: 'EUV Double-Patterning Pitch Split', tier: 19, summary: 'Combines 0.33-NA EUV with self-aligned spacers to resolve 20 nm metal pitches.', effects: { logicDensityMult: 1.02, sramDensityMult: 1.018 } },
  { id: 'fab_high_na', name: 'High-NA EUV 0.55 Optics', tier: 20, rpFactor: 0.82, extraPrereqs: ['fab_2nm', 'fab_gaafet'], summary: 'Anamorphic 4×/8× mirrors resolve sub-nanometer features in a single exposure.', extraUnlocks: ['High-NA EUV Lithography (-21% defects)', 'Reticle limit 1,050 mm²'], effects: { lithoId: 'litho_high_na', defectReductionMult: 0.984 } },
  { id: 'litho_stitching', name: 'Seamless High-NA Field Stitching', tier: 21, summary: 'Sub-nanometer stage interferometry stitches half-fields cleanly for giant AI & HPC reticles.', effects: { fabThroughputMult: 1.025, defectReductionMult: 0.985 } },
  { id: 'litho_hyper_na', name: 'Hyper-NA EUV 0.75 Freeform Mirrors', tier: 22, summary: 'Pushes 13.5 nm reflective optics to the physical grazing-angle aperture ceiling.', effects: { logicDensityMult: 1.022, defectReductionMult: 0.982 } },
  { id: 'frontier_atomic_litho', name: 'Atomic Direct-Write Lithography', tier: 23, rpFactor: 0.85, extraPrereqs: ['fab_07nm'], summary: 'Maskless coherent X-ray and atomic-beam patterning eliminates optical diffraction limits.', extraUnlocks: ['Atomic Direct-Write Lithography (-23% defects)', 'Reticle limit 1,600 mm²'], constraintWarning: 'Consumes 2.4× baseline fab electrical power.', effects: { lithoId: 'litho_xray_atomic', defectReductionMult: 0.98 } },
  { id: 'litho_fel_beuv', name: '6.7 nm Free-Electron Laser BEUV', tier: 24, summary: 'Accelerator-driven Beyond-EUV beamlines feed an entire megafab simultaneously.', effects: { fabThroughputMult: 1.045, logicDensityMult: 1.02 } },
  { id: 'litho_soft_xray', name: 'Coherent Soft X-Ray Zone Plates', tier: 25, summary: '2.4 nm water-window X-ray optics pattern Angstrom-class 3D architectures.', effects: { logicDensityMult: 1.024, defectReductionMult: 0.98 } },
  { id: 'litho_matter_wave', name: 'De Broglie Atomic-Wave Lithography', tier: 26, summary: 'Cold-atom matter-wave interference prints zero-stochastic atomic arrays directly.', effects: { defectReductionMult: 0.975, logicDensityMult: 1.025 } },
];

const LITHO_ROW1_METROLOGY: TrackItemSpec[] = [
  { id: 'met_optical_scope', name: 'Automated Brightfield Inspection', tier: 1, rpFactor: 0.92, summary: 'Die-to-die optical comparison catches gross mask scratches before wafer completion.', effects: { defectReductionMult: 0.986 } },
  { id: 'met_ellipsometry', name: 'Laser Film-Thickness Ellipsometry', tier: 2, summary: 'Polarized light measures gate oxide uniformity down to single nanometers.', effects: { leakageReductionMult: 0.988, defectReductionMult: 0.988 } },
  { id: 'met_overlay_vernier', name: 'Optical Overlay Vernier Targets', tier: 4, summary: 'Sub-micron scribe-line targets tighten layer-to-layer registration across mask levels.', effects: { defectReductionMult: 0.985 } },
  { id: 'met_cd_sem', name: 'Critical-Dimension SEM Metrology', tier: 5, summary: 'Low-voltage scanning electron beams measure gate lengths without damaging resist.', effects: { defectReductionMult: 0.984, rpGenerationMult: 1.02 } },
  { id: 'met_darkfield', name: 'Laser Darkfield Particle Scanners', tier: 7, summary: 'Detects sub-100 nm killer particles on unpatterned wafers in seconds.', effects: { defectReductionMult: 0.983 } },
  { id: 'met_scatterometry', name: 'Optical CD Scatterometry (OCD)', tier: 9, summary: 'Model-based diffraction analysis reconstructs 3D trench profiles inline at full fab speed.', effects: { defectReductionMult: 0.982, fabThroughputMult: 1.015 } },
  { id: 'met_ebeam_review', name: 'High-Speed E-Beam Defect Review', tier: 11, summary: 'Pinpoints buried electrical shorts and opens invisible to optical inspection.', effects: { defectReductionMult: 0.98 } },
  { id: 'met_xrf_metrology', name: 'Inline X-Ray Fluorescence (XRF)', tier: 12, summary: 'Verifies hafnium high-k and metal-gate alloy stoichiometry on every production lot.', effects: { leakageReductionMult: 0.986, defectReductionMult: 0.985 } },
  { id: 'met_multibeam_sem', name: '64-Column Multi-Beam E-Beam', tier: 14, summary: 'Parallel electron columns inspect full 300 mm wafers for nano-bridges at high speed.', effects: { defectReductionMult: 0.98, fabThroughputMult: 1.018 } },
  { id: 'met_sax_3d', name: 'CD-SAXS 3D Fin & Channel X-Ray', tier: 16, summary: 'Small-angle X-ray scattering profiles hidden 3D nanosheet and V-NAND hole geometry.', effects: { defectReductionMult: 0.98, sramDensityMult: 1.016 } },
  { id: 'met_actinic_euv', name: 'Actinic 13.5 nm Blank Inspection', tier: 17, summary: 'Inspects EUV mask blanks at native wavelength to catch phase defects before writing.', effects: { defectReductionMult: 0.978 } },
  { id: 'met_ai_yield', name: 'Neural Wafer-Map Yield Forensics', tier: 19, summary: 'Correlates chamber sensor telemetry with die-bin maps to pre-empt tool drift.', effects: { defectReductionMult: 0.978, rpGenerationMult: 1.03 } },
  { id: 'met_backside_ir', name: 'Infrared Backside Overlay Metrology', tier: 20, summary: 'Sees through thinned silicon to align backside power rails to frontside transistors.', effects: { defectReductionMult: 0.98, logicDensityMult: 1.015 } },
  { id: 'met_tem_auto', name: 'Automated Atomic-Resolution TEM', tier: 22, summary: 'Robotic lamella sampling maps single-atom gate interfaces for Angstrom yield control.', effects: { defectReductionMult: 0.978, rpGenerationMult: 1.035 } },
  { id: 'met_quantum_nv', name: 'Diamond NV-Center Magnetic Imaging', tier: 24, summary: 'Quantum spin sensors map buried current paths non-destructively across 3D stacks.', effects: { defectReductionMult: 0.976, leakageReductionMult: 0.982 } },
  { id: 'met_coherent_ptych', name: 'X-Ray Ptychography 3D Tomography', tier: 26, summary: 'Full-die atomic 3D reconstruction guarantees yield on topological and CNT stacks.', effects: { defectReductionMult: 0.974, rpGenerationMult: 1.04 } },
];

const LITHO_ROW2_RESIST_MASK: TrackItemSpec[] = [
  { id: 'res_novolak', name: 'Positive Diazonaphthoquinone Resist', tier: 1, rpFactor: 0.92, summary: 'Cleaner positive photoresists replace messy negative rubber resists with sharper edges.', effects: { logicDensityMult: 1.014 } },
  { id: 'res_barc', name: 'Bottom Anti-Reflective Coatings', tier: 3, summary: 'Absorbs stray light bouncing off metal substrates to eliminate standing-wave notches.', effects: { defectReductionMult: 0.986 } },
  { id: 'res_car_chem', name: 'Chemically Amplified Photoresist', tier: 5, summary: 'Photo-acid catalysis multiplies exposure sensitivity 10× for high-throughput DUV.', effects: { fabThroughputMult: 1.022 } },
  { id: 'res_opc_rules', name: 'Rule-Based Optical Proximity Correction', tier: 6, summary: 'Adds hammerheads and serifs to mask corners so lines print square on silicon.', effects: { logicDensityMult: 1.016, sramDensityMult: 1.014 } },
  { id: 'res_topcoat', name: 'Hydrophobic Immersion Topcoats', tier: 10, summary: 'Prevents water-droplet leaching during high-speed 193 nm immersion scanning.', effects: { defectReductionMult: 0.984, fabThroughputMult: 1.018 } },
  { id: 'res_multibeam_mask', name: 'Multi-Beam Mask Writers (MBMW)', tier: 12, summary: '262,000 programmable electron beams write complex OPC reticles in constant time.', effects: { fabThroughputMult: 1.02, rpGenerationMult: 1.025 } },
  { id: 'res_dsa_polymer', name: 'Directed Self-Assembly Copolymers', tier: 14, summary: 'Block copolymers spontaneously self-align into uniform sub-10 nm contact hole grids.', effects: { logicDensityMult: 1.018, defectReductionMult: 0.986 } },
  { id: 'res_mor_tin', name: 'Metal-Oxide Tin EUV Photoresist', tier: 16, summary: 'High-photon-absorption inorganic resist slashes EUV stochastic line-edge roughness.', effects: { defectReductionMult: 0.98, fabThroughputMult: 1.02 } },
  { id: 'res_dry_resist', name: 'Vapor-Deposited Dry EUV Resist', tier: 18, summary: 'Solvent-free molecular resist prevents pattern collapse on ultra-tall Angstrom lines.', effects: { defectReductionMult: 0.98, logicDensityMult: 1.018 } },
  { id: 'res_curvilinear', name: 'All-Angle Curvilinear Reticles', tier: 20, summary: 'Replaces Manhattan stair-step masks with smooth organic curves for 30% wider focus margin.', effects: { defectReductionMult: 0.98, sramDensityMult: 1.018 } },
  { id: 'res_low_n_mask', name: 'Low-n Absorber EUV Masks', tier: 21, summary: 'Ruthenium-tantalum mask absorbers eliminate 3D mask shadowing in High-NA optics.', effects: { logicDensityMult: 1.018, defectReductionMult: 0.984 } },
  { id: 'res_wafer_450_tools', name: '450 mm Wafer Handling Automation', tier: 22, summary: 'Stiffened robotic chucks handle 450 mm mega-wafers without gravitational sag.', effects: { fabThroughputMult: 1.035, siliconRefiningMult: 1.04 } },
  { id: 'res_wafer_600', name: '600 mm Gigafab Mega-Wafers', tier: 25, summary: 'Expands wafer surface area by 78% over 450 mm standards for post-silicon megafabs.', effects: { waferDiameterMm: 600, fabThroughputMult: 1.04 } },
];

// ═══════════════════════════════════════════════════════════════════════════════
// LANE 3: TRANSISTOR PHYSICS & MATERIALS (~72 nodes across 3 sub-rows)
// ═══════════════════════════════════════════════════════════════════════════════

const TRANS_ROW0_CHANNELS: TrackItemSpec[] = [
  { id: 'tr_pmos_nmos', name: 'Enhancement-Mode NMOS Logic', tier: 1, rpFactor: 0.9, summary: 'Electron-channel NMOS switches 2.5× faster than primitive hole-channel PMOS.', effects: { clockHeadroomMult: 1.008, logicDensityMult: 1.015 } },
  { id: 'tr_self_aligned_poly', name: 'Self-Aligned Polysilicon Gate', tier: 2, summary: 'Uses the gate itself as an implant mask, slashing Miller overlap capacitance.', effects: { clockHeadroomMult: 1.009, leakageReductionMult: 0.986 } },
  { id: 'tr_cmos_wells', name: 'Low-Power Complementary CMOS', tier: 3, summary: 'Pairing pull-up PMOS and pull-down NMOS cuts idle standby current by two orders of magnitude.', effects: { leakageReductionMult: 0.978 } },
  { id: 'tr_ldd_spacers', name: 'Lightly Doped Drain Spacers', tier: 4, summary: 'Graded drain doping suppresses hot-carrier injection degradation at higher voltages.', effects: { clockHeadroomMult: 1.008, defectReductionMult: 0.988 } },
  { id: 'tr_bicmos', name: 'BiCMOS High-Drive Drivers', tier: 5, summary: 'Integrates bipolar output stages with dense CMOS logic for fast off-chip signaling.', effects: { clockHeadroomMult: 1.008, memoryBandwidthMult: 1.015 } },
  { id: 'tr_salicide', name: 'Cobalt Salicide Contacts', tier: 6, summary: 'Self-aligned silicide cuts source/drain contact resistance across narrow gates.', effects: { clockHeadroomMult: 1.008, logicDensityMult: 1.014 } },
  { id: 'tr_retro_well', name: 'Retrograde Channel Halo Implants', tier: 7, summary: 'Steep subsurface doping halts punch-through leakage as gate lengths cross 250 nm.', effects: { leakageReductionMult: 0.982 } },
  { id: 'tr_soi_pd', name: 'Partially-Depleted SOI Wafers', tier: 8, summary: 'Buried oxide layer isolates transistors from bulk substrate capacitance.', effects: { clockHeadroomMult: 1.009, leakageReductionMult: 0.985 } },
  { id: 'tr_sige_strain', name: 'Embedded SiGe Strained Channels', tier: 9, summary: 'Compressive silicon-germanium pockets double PMOS hole mobility.', effects: { clockHeadroomMult: 1.01, logicDensityMult: 1.015 } },
  { id: 'tr_fd_soi', name: 'Fully-Depleted SOI Body Bias', tier: 10, summary: 'Ultra-thin 7 nm silicon film allows dynamic back-gate threshold tuning.', effects: { leakageReductionMult: 0.98, clockHeadroomMult: 1.007 } },
  { id: 'fab_hkmg', name: 'High-k Metal Gate', tier: 11, rpFactor: 0.78, extraPrereqs: ['fab_130nm'], summary: 'Hafnium oxide dielectric arrests gate-oxide current leakage on sub-65 nm transistors.', extraUnlocks: ['High-k Metal Gate Transistor (-32% leakage)'], effects: { leakageReductionMult: 0.978 } },
  { id: 'tr_rmg_last', name: 'Replacement Metal Gate-Last Flow', tier: 12, summary: 'Deposits work-function metals after high-temp anneals for exact Vt targeting.', effects: { leakageReductionMult: 0.982, clockHeadroomMult: 1.008 } },
  { id: 'tr_multi_vt', name: 'Quad-Threshold Multi-Vt Library', tier: 13, summary: 'Matches ultra-low-Vt cells to critical timing paths and high-Vt cells to dark silicon.', effects: { leakageReductionMult: 0.98, clockHeadroomMult: 1.008 } },
  { id: 'fab_finfet', name: '3D FinFET Transistors', tier: 14, rpFactor: 0.8, extraPrereqs: ['fab_45nm', 'fab_hkmg'], summary: 'Wrapping the gate around three sides of a vertical silicon fin reclaims electrostatic control.', extraUnlocks: ['3D FinFET Transistor Structure (1.38× density, -54% leakage)'], effects: { logicDensityMult: 1.02, leakageReductionMult: 0.98 } },
  { id: 'tr_finfet_gen2', name: 'FinFET Gen 2 Tall-Profile Fins', tier: 15, summary: 'Taller, narrower vertical fins boost drive current per unit die footprint.', effects: { logicDensityMult: 1.018, clockHeadroomMult: 1.008 } },
  { id: 'tr_finfet_gen3', name: 'FinFET Gen 3 Fin-Depopulation', tier: 16, summary: 'Single-fin ultra-dense cells pack 20% more SRAM and control logic per mm².', effects: { logicDensityMult: 1.018, sramDensityMult: 1.02 } },
  { id: 'tr_iiiv_channel', name: 'III-V InGaAs High-Mobility Channels', tier: 17, summary: 'Compound semiconductor channels accelerate electron velocity at sub-0.7V supply rails.', effects: { clockHeadroomMult: 1.01, leakageReductionMult: 0.985 } },
  { id: 'fab_gaafet', name: 'Gate-All-Around Nanosheets', tier: 18, rpFactor: 0.82, extraPrereqs: ['fab_5nm', 'fab_euv'], summary: 'Horizontal stacked silicon ribbons completely encircled by gate metal suppress short-channel leakage.', extraUnlocks: ['GAA Nanosheet Transistor (1.70× density, 82% tunneling mitigation)'], effects: { logicDensityMult: 1.022, leakageReductionMult: 0.978 } },
  { id: 'tr_forksheet', name: 'Forksheet FET Dielectric Wall', tier: 19, summary: 'An insulating wall between n- and p-ribbons collapses N-to-P spacing to 10 nm.', effects: { logicDensityMult: 1.022, sramDensityMult: 1.02 } },
  { id: 'tr_ncfet', name: 'Negative-Capacitance FeFET Gates', tier: 20, summary: 'Ferroelectric hafnium-zirconium oxide achieves sub-60 mV/dec steep subthreshold swing.', effects: { leakageReductionMult: 0.975, clockHeadroomMult: 1.008 } },
  { id: 'fab_cfet', name: '3D Stacked CFET Cells', tier: 21, rpFactor: 0.84, extraPrereqs: ['fab_2nm', 'fab_gaafet'], summary: 'Stacking n-channel directly above p-channel transistors folds cell geometry vertically.', extraUnlocks: ['CFET Transistor Structure (2.35× density, 90% tunneling mitigation)'], constraintWarning: 'Vertical cell stacking elevates volumetric heat flux density.', effects: { logicDensityMult: 1.025 } },
  { id: 'tr_2d_mos2', name: '2D Monolayer MoS2 Transistors', tier: 22, summary: 'Three-atom-thick transition metal dichalcogenide sheets remain immune to short-channel effects.', effects: { leakageReductionMult: 0.976, logicDensityMult: 1.022 } },
  { id: 'tr_spintronic_fet', name: 'Spintronic Magneto-Electric Logic', tier: 23, summary: 'Manipulates electron spin orientation rather than bulk charge for non-volatile ultra-low-energy switching.', effects: { leakageReductionMult: 0.974, coolingEfficiencyMult: 1.02 } },
  { id: 'frontier_cryogenic', name: 'Cryogenic Superconducting Paradigm', tier: 24, rpFactor: 0.82, extraPrereqs: ['fab_07nm', 'sup_cooling_immersion'], summary: 'Ultra-low-voltage superconducting Josephson-CMOS circuits smash the room-temperature frequency wall.', extraUnlocks: ['0.5 nm Cryogenic Super-CMOS Node (14.5 GHz ref)', 'Cryo-Hybrid Josephson Transistor', 'Cryogenic Helium Microfluidic Cooling'], constraintWarning: 'Strict 15 °C thermal quench ceiling & +72% Carnot refrigeration power overhead.', effects: { unlocksParadigm: 'cryogenic', clockHeadroomMult: 1.025 } },
  { id: 'tr_rsfq_flux', name: 'Adiabatic Quantum Flux Parametrons', tier: 25, summary: 'Reversible superconducting fluxons switch near the Landauer thermodynamic limit.', effects: { leakageReductionMult: 0.97, clockHeadroomMult: 1.015 } },
  { id: 'tr_majorana_braid', name: 'Topological Braided Gate Arrays', tier: 26, summary: 'Fault-tolerant non-Abelian anyon braiding executes ultra-dense hybrid logic without thermal noise.', effects: { logicDensityMult: 1.03, leakageReductionMult: 0.97 } },
];

const TRANS_ROW1_MATERIALS: TrackItemSpec[] = [
  { id: 'mat_nitrided_ox', name: 'Nitrided Silicon Oxynitride Gate', tier: 2, summary: 'Nitrogen incorporation blocks boron penetration from p+ polysilicon gates.', effects: { leakageReductionMult: 0.988 } },
  { id: 'mat_low_ohmic_sub', name: 'Heavily Doped Back-Contact Wafers', tier: 4, summary: 'Suppresses substrate noise and latch-up under fast switching transients.', effects: { defectReductionMult: 0.988, clockHeadroomMult: 1.005 } },
  { id: 'mat_ni_silicide', name: 'Nickel-Platinum Monosilicide', tier: 7, summary: 'Consumes 40% less silicon than cobalt silicide while keeping contact resistance low.', effects: { clockHeadroomMult: 1.007, leakageReductionMult: 0.988 } },
  { id: 'mat_sige_epi', name: 'Relaxed SiGe Virtual Substrates', tier: 8, summary: 'Provides biaxial tensile strain templates for high-speed NMOS channels.', effects: { clockHeadroomMult: 1.008 } },
  { id: 'mat_hfo2_dopant', name: 'Lanthanum-Doped HfO2 Dielectrics', tier: 11, summary: 'Dipole engineering at the high-k interface lowers effective oxide thickness below 0.8 nm.', effects: { leakageReductionMult: 0.982 } },
  { id: 'mat_ti_al_wf', name: 'TiAl / TiN Dual Work-Function Alloys', tier: 13, summary: 'Tailors metal-gate Fermi levels cleanly for symmetric CMOS threshold voltages.', effects: { clockHeadroomMult: 1.008, leakageReductionMult: 0.986 } },
  { id: 'mat_ge_fin', name: 'High-Ge Content PMOS Fin Channels', tier: 15, summary: '70% germanium channels boost p-type hole velocity to match n-type electrons.', effects: { clockHeadroomMult: 1.009, logicDensityMult: 1.015 } },
  { id: 'mat_bn_insulator', name: 'Hexagonal Boron Nitride Encapsulation', tier: 17, summary: 'Atomically flat van der Waals insulator suppresses interface charge traps.', effects: { leakageReductionMult: 0.982, defectReductionMult: 0.986 } },
  { id: 'mat_ws2_bilayer', name: 'WS2 / WSe2 Complementary 2D Layers', tier: 19, summary: 'Matched n-type and p-type 2D semiconductors enable monolithic 2D CFET stacks.', effects: { logicDensityMult: 1.02, leakageReductionMult: 0.982 } },
  { id: 'mat_cnt_chirality', name: '99.9999% Semiconducting CNT Sorting', tier: 21, summary: 'Polymer-wrapped chromatographic sorting removes metallic nanotube shorts.', effects: { defectReductionMult: 0.978, logicDensityMult: 1.018 } },
  { id: 'mat_nb_ti_super', name: 'Niobium-Titanium Nitride Superconductors', tier: 23, summary: 'Raises kinetic inductance and critical temperature for compact cryogenic interconnects.', effects: { clockHeadroomMult: 1.012, coolingEfficiencyMult: 1.02 } },
  { id: 'frontier_photonic', name: 'Silicon-Photonic Waveguide Paradigm', tier: 24, rpFactor: 0.84, extraPrereqs: ['fab_07nm', 'sup_packaging_3d', 'gpu_neural_render'], summary: 'Replaces resistive copper wires with integrated laser waveguides for near-zero interconnect latency.', extraUnlocks: ['1.0 nm Silicon-Photonic Node & Electro-Optic Gate', 'Optical Coherent CPU & Photonic Tensor GPU', 'Optical RAM, Photonic VRAM & Glass Substrate'], constraintWarning: 'Lower raw gate density than CNT; optical resonators drift if junction exceeds 78 °C.', effects: { unlocksParadigm: 'photonic', memoryBandwidthMult: 1.04 } },
  { id: 'mat_lithium_niobate', name: 'Thin-Film Lithium Niobate Modulators', tier: 25, summary: '100+ GHz Pockels electro-optic switches halve photonic transceiver energy per bit.', effects: { clockHeadroomMult: 1.012, memoryBandwidthMult: 1.03 } },
];

const TRANS_ROW2_RELIABILITY: TrackItemSpec[] = [
  { id: 'rel_esd_clamps', name: 'On-Die ESD Clamp Networks', tier: 1, rpFactor: 0.92, summary: 'Protects delicate gate oxides from electrostatic discharge during handling and testing.', effects: { defectReductionMult: 0.986 } },
  { id: 'rel_em_rules', name: 'Electromigration Current Grading', tier: 3, summary: 'Automated wire-width sizing prevents metal voiding under sustained DC loads.', effects: { clockHeadroomMult: 1.006, defectReductionMult: 0.988 } },
  { id: 'rel_bti_recovery', name: 'NBTI Thermal Bias Compensation', tier: 6, summary: 'Guard-band calibration counters threshold drift over multi-year continuous operation.', effects: { leakageReductionMult: 0.986, clockHeadroomMult: 1.006 } },
  { id: 'rel_power_gating', name: 'Fine-Grain MTCMOS Power Gating', tier: 8, summary: 'Sleep header transistors cut leakage in idle execution blocks to near zero.', effects: { leakageReductionMult: 0.98 } },
  { id: 'rel_dvfs_islands', name: 'Per-Domain Voltage/Frequency Islands', tier: 10, summary: 'Independent power domains let compute cores boost while uncore stays cool.', effects: { clockHeadroomMult: 1.008, leakageReductionMult: 0.985 } },
  { id: 'rel_avfs_droop', name: 'Adaptive Voltage Droop Mitigation', tier: 12, summary: 'On-die clock stretchers catch nanosecond supply dips, eliminating excess voltage margin.', effects: { clockHeadroomMult: 1.01 } },
  { id: 'rel_dlvr_vrm', name: 'Integrated On-Die Digital LVR', tier: 14, summary: 'Micro-inductor voltage regulators sit inside the package for instant per-core Vmin control.', effects: { clockHeadroomMult: 1.009, leakageReductionMult: 0.985 } },
  { id: 'rel_ser_hardening', name: 'Alpha-Particle Soft-Error Hardening', tier: 15, summary: 'Dual-interlocked storage cells protect dense SRAM caches from cosmic ray bit flips.', effects: { sramDensityMult: 1.015, defectReductionMult: 0.986 } },
  { id: 'rel_sram_assist', name: 'Read/Write Assist 6T SRAM Circuits', tier: 16, summary: 'Negative bitline boost lets 6T SRAM cells scale reliably below 0.65 V.', effects: { sramDensityMult: 1.022, leakageReductionMult: 0.986 } },
  { id: 'rel_self_healing', name: 'Autonomous Built-In Self-Repair (BISR)', tier: 18, summary: 'Laserless eFuse redundancy automatically maps around defective SRAM and logic columns.', effects: { defectReductionMult: 0.978, sramDensityMult: 1.016 } },
  { id: 'rel_tunnel_barrier', name: 'Engineered Multi-Layer Tunnel Barriers', tier: 20, summary: 'Bandgap-graded dielectric stacks suppress direct quantum gate tunneling.', effects: { leakageReductionMult: 0.976 } },
  { id: 'rel_cryo_quench', name: 'Active Superconducting Quench Guards', tier: 22, summary: 'Sub-microsecond shunt loops stabilize ultra-dense cryogenic & Angstrom power rails.', effects: { coolingEfficiencyMult: 1.025, defectReductionMult: 0.984 } },
  { id: 'rel_photonic_lock', name: 'Closed-Loop Micro-Ring Thermal Lock', tier: 24, summary: 'Integrated micro-heaters stabilize optical waveguide resonance across temperature swings.', effects: { coolingEfficiencyMult: 1.025, clockHeadroomMult: 1.01 } },
];

// ═══════════════════════════════════════════════════════════════════════════════
// LANE 4: CPU MICROARCHITECTURE & ISA (~80 nodes across 4 sub-rows)
// ═══════════════════════════════════════════════════════════════════════════════

const CPU_ROW0_CORE: TrackItemSpec[] = [
  { id: 'cpu_microcode', name: 'Horizontal Microcode Sequencer', tier: 1, rpFactor: 0.9, summary: 'Structured control ROM replaces ad-hoc discrete logic gates, boosting clock and IPC.', effects: { ipcBonusMult: 1.018 } },
  { id: 'cpu_pipelined', name: 'Pipelined RISC Architecture', tier: 2, rpFactor: 0.72, summary: 'Breaks instruction execution into fetch, decode, execute, memory, and writeback stages.', extraUnlocks: ['Pipelined RISC CPU Architecture (1.15 base IPC)', 'Up to 4 P-cores'], effects: { ipcBonusMult: 1.018 } },
  { id: 'cpu_hazard_fwd', name: 'ALU Bypass & Hazard Forwarding', tier: 3, summary: 'Routes ALU outputs directly back to execution inputs without waiting for register writeback.', effects: { ipcBonusMult: 1.018 } },
  { id: 'cpu_dual_issue', name: '2-Wide In-Order Dual-Issue', tier: 4, summary: 'Pairs integer and load/store pipes to retire up to two instructions per clock.', effects: { ipcBonusMult: 1.02 } },
  { id: 'cpu_deep_12stg', name: '12-Stage High-Frequency Pipeline', tier: 5, summary: 'Finer pipeline segmentation raises operating frequency headroom across sub-micron nodes.', effects: { clockHeadroomMult: 1.01, ipcBonusMult: 1.01 } },
  { id: 'cpu_superscalar', name: 'Superscalar Execution', tier: 6, rpFactor: 0.75, extraPrereqs: ['fab_1000nm'], summary: 'Duplicate ALU pipelines issue multiple instructions in parallel per cycle.', extraUnlocks: ['Superscalar Architecture (1.95 IPC)', 'Up to 8 P-cores + 4 E-cores'], effects: { ipcBonusMult: 1.02 } },
  { id: 'cpu_reg_rename', name: 'Physical Register File Renaming', tier: 7, summary: 'Eliminates false write-after-read and write-after-write register stalls.', effects: { ipcBonusMult: 1.02 } },
  { id: 'cpu_rob_window', name: '64-Entry Reorder Buffer (ROB)', tier: 8, summary: 'Commits out-of-order instructions cleanly in program order with precise exceptions.', effects: { ipcBonusMult: 1.02 } },
  { id: 'cpu_deep_20stg', name: '20-Stage Superpipelined Core', tier: 9, summary: 'Aggressive latch pipelining drives gigahertz frequency scaling.', effects: { clockHeadroomMult: 1.012 } },
  { id: 'cpu_uop_cache', name: 'Decoded Micro-Op (μOp) Loop Cache', tier: 10, summary: 'Bypasses power-hungry x86/CISC decoders during hot loops, raising IPC and cutting power.', effects: { ipcBonusMult: 1.018, leakageReductionMult: 0.99 } },
  { id: 'cpu_ooo', name: 'Out-of-Order Speculative Core', tier: 11, rpFactor: 0.78, extraPrereqs: ['fab_130nm'], summary: 'Dynamic instruction scheduling and deep speculative windows hide memory latency.', extraUnlocks: ['Out-of-Order CPU Architecture (3.35 IPC)', 'Up to 32 P-cores + 16 E-cores'], effects: { ipcBonusMult: 1.022 } },
  { id: 'cpu_smt_2way', name: '2-Way Simultaneous Multithreading', tier: 12, summary: 'Interleaves two hardware threads across idle execution ports on every clock cycle.', effects: { ipcBonusMult: 1.022 } },
  { id: 'cpu_6wide_ooo', name: '6-Wide Unified Scheduler Core', tier: 13, summary: 'Wider decode, rename, and retire engines saturate 6 parallel integer/vector pipelines.', effects: { ipcBonusMult: 1.022 } },
  { id: 'cpu_macro_fusion', name: 'Dynamic Macro-Op Fusion', tier: 14, summary: 'Merges adjacent compare-and-branch pairs into single fused internal operations.', effects: { ipcBonusMult: 1.018 } },
  { id: 'cpu_8wide_ooo', name: '8-Wide Deep-Window Execution', tier: 15, summary: '512-entry ROB extracts instruction-level parallelism across sprawling pointer-chasing code.', effects: { ipcBonusMult: 1.022 } },
  { id: 'cpu_hetero', name: 'Wide Heterogeneous Mesh', tier: 16, rpFactor: 0.8, extraPrereqs: ['fab_14nm'], summary: 'High-IPC performance cores paired with dense efficiency clusters over a 2D mesh fabric.', extraUnlocks: ['Wide Heterogeneous Architecture (5.2 IPC)', 'Up to 64 P + 64 E cores'], effects: { ipcBonusMult: 1.022 } },
  { id: 'cpu_smt_4way', name: '4-Way Balanced SMT Scheduler', tier: 17, summary: 'Dynamically partitions ROB and load/store queues across four concurrent threads.', effects: { ipcBonusMult: 1.02 } },
  { id: 'cpu_10wide_ooo', name: '10-Wide Dual-Cluster Decode', tier: 18, summary: 'Twin decoupled front-end clusters feed ten execution units simultaneously.', effects: { ipcBonusMult: 1.022 } },
  { id: 'cpu_neural', name: 'Neural-Predicted Adaptive Core', tier: 19, rpFactor: 0.82, extraPrereqs: ['fab_5nm'], summary: 'Hardware neural branch predictors eliminate pipeline flushes across deep execution windows.', extraUnlocks: ['Neural Adaptive Architecture (7.8 IPC)', 'Up to 128 P + 128 E cores'], effects: { ipcBonusMult: 1.025 } },
  { id: 'cpu_12wide_ooo', name: '12-Wide Speculative Dataflow Core', tier: 20, summary: '1,024-entry instruction window with value prediction breaks classic serial dependencies.', effects: { ipcBonusMult: 1.024 } },
  { id: 'cpu_runahead', name: 'Hardware Runahead Execution', tier: 21, summary: 'Continues speculatively pre-executing past L3 cache misses to warm memory streams.', effects: { ipcBonusMult: 1.022, memoryBandwidthMult: 1.018 } },
  { id: 'cpu_async_clockless', name: 'Clockless Asynchronous Handshake Core', tier: 22, summary: 'Self-timed event-driven pipelines run at average-case rather than worst-case delay.', effects: { clockHeadroomMult: 1.014, ipcBonusMult: 1.02 } },
  { id: 'cpu_reconfig_cgfa', name: 'Runtime Reconfigurable Spatial Fabrics', tier: 23, summary: 'Compiles hot basic blocks directly into transient spatial dataflow pipelines.', effects: { ipcBonusMult: 1.025 } },
  { id: 'cpu_optical_coherent', name: 'Optical Coherent Core Mesh', tier: 24, extraPrereqs: ['frontier_photonic'], summary: 'All-to-all photonic wavelength-routed cache coherence across hundreds of cores.', effects: { ipcBonusMult: 1.025, memoryBandwidthMult: 1.025 } },
  { id: 'cpu_reversible_alu', name: 'Reversible Adiabatic Logic Pipelines', tier: 25, summary: 'Recycles charge energy across execution stages for ultra-high performance per watt.', effects: { leakageReductionMult: 0.976, ipcBonusMult: 1.02 } },
  { id: 'cpu_braided_ctrl', name: 'Topological Hybrid Orchestrator', tier: 26, extraPrereqs: ['frontier_topological'], summary: 'Co-schedules classical speculative threads alongside non-classical topological kernels.', effects: { ipcBonusMult: 1.03, rpGenerationMult: 1.04 } },
];

const CPU_ROW1_BRANCH_CACHE: TrackItemSpec[] = [
  { id: 'cpu_br_static', name: 'Static Branch Target Buffer', tier: 1, rpFactor: 0.9, summary: 'Caches jump target addresses to eliminate fetch bubbles on tight loops.', effects: { ipcBonusMult: 1.014 } },
  { id: 'cpu_cache_l1_split', name: 'Split Harvard L1 I/D Cache', tier: 2, summary: 'Separate instruction and data L1 arrays allow simultaneous fetch and load every cycle.', effects: { ipcBonusMult: 1.016, sramDensityMult: 1.015 } },
  { id: 'cpu_br_2bit', name: '2-Bit Saturating Branch Counters', tier: 3, summary: 'Hysteresis prevents single-iteration loop exits from mispredicting next loop entry.', effects: { ipcBonusMult: 1.015 } },
  { id: 'cpu_cache_wb', name: 'Write-Back Associative L2 Cache', tier: 5, summary: '4-way set-associative write-back L2 shields slow system memory from redundant writes.', effects: { ipcBonusMult: 1.016, memoryBandwidthMult: 1.015 } },
  { id: 'cpu_br_gshare', name: 'GShare Correlated Branch Predictor', tier: 6, summary: 'XORs global branch history with PC address to predict nested conditional patterns.', effects: { ipcBonusMult: 1.018 } },
  { id: 'cpu_prefetch_stride', name: 'Hardware Stride Stream Prefetcher', tier: 8, summary: 'Detects constant-stride array traversals and preloads cache lines ahead of demand.', effects: { memoryBandwidthMult: 1.018, ipcBonusMult: 1.012 } },
  { id: 'cpu_cache_l3_ring', name: 'Shared Inclusive L3 Slice Cache', tier: 10, summary: 'Distributes coherent last-level cache slices across cores for fast inter-core sharing.', effects: { sramDensityMult: 1.018, ipcBonusMult: 1.015 } },
  { id: 'cpu_br_tage', name: 'Multi-Table TAGE Branch Predictor', tier: 12, summary: 'Tagged geometric-history tables push branch accuracy above 98.5% on complex workloads.', effects: { ipcBonusMult: 1.02 } },
  { id: 'cpu_tlb_hugepage', name: '2-Level Huge-Page MMU & TLB', tier: 13, summary: 'Hardware page-table walkers slash virtual memory translation misses on huge datasets.', effects: { ipcBonusMult: 1.015, memoryBandwidthMult: 1.015 } },
  { id: 'cpu_br_perceptron', name: 'Hardware Perceptron Branch Engine', tier: 15, summary: 'Online neural weight vectors learn long-range correlated branches with minimal SRAM.', effects: { ipcBonusMult: 1.02 } },
  { id: 'cpu_cache_3d_sram', name: '3D V-Cache Stacked L3 SRAM', tier: 17, summary: 'Hybrid-bonds vertical SRAM dies directly over the L3 array to triple hit rates.', effects: { sramDensityMult: 1.028, ipcBonusMult: 1.018 } },
  { id: 'cpu_prefetch_spatial', name: 'Spatial Memory-Footprint Prefetcher', tier: 18, summary: 'Learns irregular pointer-graph access footprints across 4 KB pages.', effects: { memoryBandwidthMult: 1.02, ipcBonusMult: 1.016 } },
  { id: 'cpu_cache_compr', name: 'Zero-Cycle Hardware Cache Compression', tier: 20, summary: 'Compresses cache lines on the fly to expand effective L2/L3 capacity by 1.6×.', effects: { sramDensityMult: 1.025, memoryBandwidthMult: 1.018 } },
  { id: 'cpu_br_transformer', name: 'Tiny-Attention Speculative Predictor', tier: 22, summary: 'Predicts both branch directions and indirect jump targets across deep call graphs.', effects: { ipcBonusMult: 1.022 } },
  { id: 'cpu_coherent_cxl', name: 'Memory-Semantic Coherent CXL Pool', tier: 23, summary: 'Unifies CPU caches and petabyte-scale SCM pools into one cache-coherent address space.', effects: { memoryBandwidthMult: 1.028, ipcBonusMult: 1.015 } },
  { id: 'cpu_optical_cache', name: 'Photonic Distributed Last-Level Cache', tier: 25, summary: 'Zero-hop optical crossbar delivers uniform nanosecond L3 latency across giant dies.', effects: { memoryBandwidthMult: 1.03, ipcBonusMult: 1.02 } },
];

const CPU_ROW2_ISA_VECTOR: TrackItemSpec[] = [
  { id: 'cpu_isa_muldiv', name: 'Hardware Booth Multiplier & Divider', tier: 1, rpFactor: 0.9, summary: 'Replaces multi-cycle shift-and-add loops with dedicated hardware integer multiply pipes.', effects: { ipcBonusMult: 1.016 } },
  { id: 'cpu_isa_bitmanip', name: 'Bit-Manipulation & Barrel Shifter', tier: 2, summary: 'Single-cycle arbitrary bit shifts and population counts speed up compilers and compression.', effects: { ipcBonusMult: 1.015 } },
  { id: 'cpu_isa_fpu', name: 'Integrated Floating-Point Unit', tier: 4, rpFactor: 0.72, extraPrereqs: ['cpu_pipelined'], summary: 'Hardware IEEE floating-point pipelines replace slow software emulation.', extraUnlocks: ['FPU ISA Extension (+14% SC, +28% General Compute)'], effects: { ipcBonusMult: 1.015 } },
  { id: 'cpu_isa_simd64', name: '64-Bit Packed Integer Multimedia ISA', tier: 6, summary: 'Processes eight 8-bit pixels in parallel inside repurposed floating-point registers.', effects: { ipcBonusMult: 1.016 } },
  { id: 'cpu_isa_simd', name: '128-Bit Vector SIMD', tier: 9, rpFactor: 0.75, extraPrereqs: ['cpu_superscalar'], summary: 'Single-Instruction Multiple-Data vector registers accelerate media and scientific math.', extraUnlocks: ['SIMD-128 ISA Extension (+32% General Compute)'], effects: { ipcBonusMult: 1.018 } },
  { id: 'cpu_isa_crypto', name: 'AES-NI & SHA Hardware Crypto Pipes', tier: 10, summary: 'Dedicated cryptographic round instructions encrypt storage and network streams at wire speed.', effects: { ipcBonusMult: 1.014, rpGenerationMult: 1.02 } },
  { id: 'cpu_isa_fma', name: 'Fused Multiply-Add (FMA3)', tier: 11, summary: 'Single-rounding a×b+c doubles peak floating-point FLOPs per clock cycle.', effects: { ipcBonusMult: 1.02 } },
  { id: 'cpu_isa_avx256', name: '256-Bit Dual-Issue Vector SIMD', tier: 13, summary: 'Doubles vector register width with hardware gather/scatter memory instructions.', effects: { ipcBonusMult: 1.02 } },
  { id: 'cpu_isa_bf16', name: 'BFloat16 & INT8 Dot-Product ISA', tier: 15, summary: 'Accelerates dense AI inference directly inside general-purpose CPU cores.', effects: { ipcBonusMult: 1.018, rpGenerationMult: 1.02 } },
  { id: 'cpu_isa_matrix', name: '512-Bit Matrix Vector Extensions', tier: 17, rpFactor: 0.8, extraPrereqs: ['cpu_hetero'], summary: 'Ultra-wide vector and tile-matrix units deliver massive throughput at higher power draw.', extraUnlocks: ['VEC-512 ISA Extension (+42% General Compute)'], constraintWarning: 'Adds +26% core logic area and +18% dynamic switching power.', effects: { ipcBonusMult: 1.02 } },
  { id: 'cpu_isa_amx_tile', name: '2D Systolic Matrix Tile Engine', tier: 18, summary: 'Dedicated 8×8 tile registers execute 2,048 ops/cycle per core for scientific linear algebra.', effects: { ipcBonusMult: 1.022 } },
  { id: 'cpu_isa_sve1024', name: '1024-Bit Length-Agnostic Vector ISA', tier: 20, summary: 'Scalable predicated vector registers adapt seamlessly to wider future microarchitectures.', effects: { ipcBonusMult: 1.022 } },
  { id: 'cpu_isa_hw_zstd', name: 'On-Core Hardware Compression Engine', tier: 21, summary: 'Dedicated LZ/entropy offload pipelines compress memory and NVMe streams at 100+ GB/s.', effects: { memoryBandwidthMult: 1.022, ipcBonusMult: 1.014 } },
  { id: 'cpu_isa_fp4_sparse', name: 'Sparse FP4 Tensor ISA', tier: 23, summary: 'Hardware zero-skipping multiplies AI and physics solver throughput per watt.', effects: { ipcBonusMult: 1.024, rpGenerationMult: 1.03 } },
  { id: 'cpu_isa_quantum_ir', name: 'Hybrid Quantum-Classical ISA', tier: 25, summary: 'Unified instruction stream dispatches variational kernels directly to post-silicon accelerators.', effects: { ipcBonusMult: 1.025, rpGenerationMult: 1.035 } },
];

const CPU_ROW3_SOC_FABRIC: TrackItemSpec[] = [
  { id: 'cpu_soc_dma', name: 'Integrated DMA & Interrupt Controller', tier: 2, summary: 'Frees the CPU from polling I/O devices with autonomous direct memory transfers.', effects: { ipcBonusMult: 1.014, memoryBandwidthMult: 1.014 } },
  { id: 'cpu_soc_imc', name: 'On-Die Integrated Memory Controller', tier: 7, summary: 'Eliminates external northbridge hops, cutting DRAM latency by 40%.', effects: { memoryBandwidthMult: 1.022, ipcBonusMult: 1.015 } },
  { id: 'cpu_soc_ring_bus', name: 'Bi-Directional Coherent Ring Bus', tier: 9, summary: 'High-speed snooping ring links 8–16 cores with low hop latency.', effects: { ipcBonusMult: 1.016, memoryBandwidthMult: 1.016 } },
  { id: 'cpu_soc_hw_sched', name: 'Hardware Thread Director', tier: 12, summary: 'Telemetry-driven core scheduler steers latency-critical tasks to P-cores automatically.', effects: { ipcBonusMult: 1.018 } },
  { id: 'cpu_igpu_npu', name: 'Heterogeneous SoC Integration', tier: 14, rpFactor: 0.78, extraPrereqs: ['cpu_ooo', 'gpu_unified_shader'], summary: 'Co-integrates graphics engines and neural inference accelerators directly on the CPU die.', extraUnlocks: ['Unlocks Integrated GPU (Tiers 1–5) & NPU (Tiers 1–5) in CPU Architect'], effects: { unlocksIgpuMaxTier: 5, unlocksNpuMaxTier: 5, ipcBonusMult: 1.015 } },
  { id: 'cpu_soc_2d_mesh', name: '2D Coherent Torus Mesh Fabric', tier: 15, summary: 'Replaces single rings with a scalable X/Y packet mesh for 64+ core server CPUs.', effects: { ipcBonusMult: 1.02, memoryBandwidthMult: 1.02 } },
  { id: 'cpu_soc_uci_chiplet', name: 'UCIe Die-to-Die Chiplet Fabric', tier: 17, summary: 'Ultra-low-energy interposer links stitch multiple compute chiplets into one coherent CPU.', effects: { defectReductionMult: 0.982, memoryBandwidthMult: 1.02 } },
  { id: 'cpu_soc_npu_v2', name: 'Dedicated Systolic NPU Co-Processor', tier: 18, summary: 'High-efficiency neural array handles telemetry, compiler optimization, and AI inference.', effects: { rpGenerationMult: 1.035, ipcBonusMult: 1.015 } },
  { id: 'cpu_soc_io_die', name: 'Disaggregated Active Base I/O Die', tier: 19, summary: 'Moves analog PHYs and PCIe lanes onto a mature base die, saving leading-edge silicon.', effects: { defectReductionMult: 0.982, fabThroughputMult: 1.02 } },
  { id: 'cpu_soc_optical_d2d', name: 'Optical Chiplet-to-Chiplet Waveguides', tier: 21, summary: 'Terabit-per-millimeter photonic die links erase NUMA latency penalties.', effects: { memoryBandwidthMult: 1.025, ipcBonusMult: 1.018 } },
  { id: 'cpu_soc_3d_fabric', name: '3D Vertical TSV Coherent Crossbar', tier: 23, summary: 'Connects stacked logic, cache, and memory tiers vertically at millimeter-per-cycle speed.', effects: { memoryBandwidthMult: 1.028, logicDensityMult: 1.018 } },
  { id: 'cpu_soc_wafer_scale', name: 'Wafer-Scale Coherent Super-Mesh', tier: 25, summary: 'Defect-routing interconnect stitches an entire wafer into one unified compute fabric.', effects: { ipcBonusMult: 1.028, fabThroughputMult: 1.03 } },
];

// ═══════════════════════════════════════════════════════════════════════════════
// LANE 5: GPU & PARALLEL COMPUTE (~76 nodes across 3 sub-rows)
// ═══════════════════════════════════════════════════════════════════════════════

const GPU_ROW0_PIPELINE: TrackItemSpec[] = [
  { id: 'gpu_2d_blitter', name: '2D Framebuffer Blitter Engine', tier: 1, rpFactor: 0.9, summary: 'Hardware bit-block transfers accelerate windowing and sprite drawing off the CPU.', effects: { gpuComputeMult: 1.018 } },
  { id: 'gpu_fixed_pipeline', name: 'Fixed-Function Graphics Accelerator', tier: 2, rpFactor: 0.72, summary: 'Dedicated hardware triangle rasterizer offloads 3D pixel drawing from the host CPU.', extraUnlocks: ['Unlocks GPU Architect & Fixed-Function Architecture', 'Dual-ecosystem Credit bonus'], effects: { gpuComputeMult: 1.02 } },
  { id: 'gpu_bilinear_tex', name: 'Bilinear Texture Mapping Units', tier: 3, summary: 'Dedicated TMU filter pipelines eliminate pixelated texture shimmering at zero CPU cost.', effects: { gpuComputeMult: 1.02 } },
  { id: 'gpu_hw_tnl', name: 'Hardware Transform & Lighting', tier: 4, summary: 'Moves 3D vertex geometry matrices and dynamic lighting math onto the GPU die.', effects: { gpuComputeMult: 1.022 } },
  { id: 'gpu_prog_vertex', name: 'Programmable Vertex Shaders', tier: 5, summary: 'Flexible micro-programmable vertex ALUs enable skeletal animation and custom geometry.', effects: { gpuComputeMult: 1.02 } },
  { id: 'gpu_prog_pixel', name: 'Programmable Pixel Fragment Shaders', tier: 6, summary: 'Per-pixel shading unlocks bump mapping, reflections, and physically based surfaces.', effects: { gpuComputeMult: 1.022 } },
  { id: 'gpu_unified_shader', name: 'Unified Shader Architecture', tier: 7, rpFactor: 0.75, extraPrereqs: ['fab_350nm'], summary: 'Replaces fixed vertex/pixel stages with programmable parallel shader arrays.', extraUnlocks: ['Unified Shader GPU Architecture (up to 512 cores)', 'Unlocks real GPU Compute'], effects: { gpuComputeMult: 1.024 } },
  { id: 'gpu_simt_warp', name: 'SIMT Warp & Wavefront Scheduling', tier: 8, summary: 'Zero-overhead hardware thread switching hides VRAM latency across thousands of threads.', effects: { gpuComputeMult: 1.022 } },
  { id: 'gpu_tbdr', name: 'Tile-Based Deferred Rendering', tier: 9, summary: 'Bins geometry into on-chip screen tiles to avoid shading occluded off-screen pixels.', effects: { gpuComputeMult: 1.02, memoryBandwidthMult: 1.018 } },
  { id: 'gpu_tessellation', name: 'Hardware Hull & Tessellation Engines', tier: 10, summary: 'Dynamically subdivides coarse polygon meshes on-die into smooth high-detail geometry.', effects: { gpuComputeMult: 1.02 } },
  { id: 'gpu_compute_gpgpu', name: 'General-Purpose GPU Compute (GPGPU)', tier: 11, summary: 'Unified address space and atomic shared memory open GPUs to scientific simulation.', effects: { gpuComputeMult: 1.024, rpGenerationMult: 1.025 } },
  { id: 'gpu_async_compute', name: 'Tile-Based Async Compute', tier: 12, rpFactor: 0.78, extraPrereqs: ['fab_45nm'], summary: 'Independent compute/graphics command queues and delta compression improve shader utilization.', extraUnlocks: ['Async Compute GPU Architecture (up to 4,096 cores)', '1.38× memory compression'], effects: { gpuComputeMult: 1.024 } },
  { id: 'gpu_dual_issue_alu', name: 'Dual-Issue FP32/INT32 Shader Pipes', tier: 13, summary: 'Executes address arithmetic concurrently with floating-point shading every cycle.', effects: { gpuComputeMult: 1.022 } },
  { id: 'gpu_vrs_shading', name: 'Variable Rate Shading (VRS)', tier: 14, summary: 'Adapts pixel shading granularity across motion and shadow regions to save 25% shader load.', effects: { gpuComputeMult: 1.02 } },
  { id: 'gpu_mesh_shaders', name: 'Task & Mesh Shader Geometry Pipeline', tier: 15, summary: 'Replaces rigid vertex stages with compute-like meshlets for billion-triangle scenes.', effects: { gpuComputeMult: 1.022 } },
  { id: 'gpu_ser_reorder', name: 'Shader Execution Reordering (SER)', tier: 16, summary: 'Dynamically regroups divergent ray and compute threads on the fly for peak SIMD coherence.', effects: { gpuComputeMult: 1.024 } },
  { id: 'gpu_ray_tracing', name: 'Hardware Ray-Tracing & Tensor Cores', tier: 17, rpFactor: 0.8, extraPrereqs: ['fab_14nm'], summary: 'Dedicated ray-box intersection pipelines and matrix units transform rendering and scientific AI.', extraUnlocks: ['Ray-Accelerated Tensor GPU (up to 16,384 cores)'], effects: { gpuComputeMult: 1.025 } },
  { id: 'gpu_multi_chiplet', name: 'Multi-Chiplet Graphics Compute Dies', tier: 18, summary: 'Partitions massive shader arrays across yield-friendly chiplets over a silicon bridge.', effects: { defectReductionMult: 0.982, gpuComputeMult: 1.022 } },
  { id: 'gpu_neural_tex', name: 'Neural Material & Texture Shaders', tier: 19, summary: 'Runs tiny matrix networks inside pixel shaders to synthesize ultra-detailed textures in 1/4 VRAM.', effects: { gpuComputeMult: 1.024, memoryBandwidthMult: 1.02 } },
  { id: 'gpu_neural_render', name: 'Neural Work-Graph Architecture', tier: 20, rpFactor: 0.82, extraPrereqs: ['fab_5nm'], summary: 'Self-scheduling neural path shaders synthesize photorealistic scenes and dense compute meshes.', extraUnlocks: ['Neural Work-Graph GPU (up to 32,768 cores)', '1.92× memory compression'], effects: { gpuComputeMult: 1.026 } },
  { id: 'gpu_hw_workgraph_v2', name: 'Autonomous GPU Work-Graph Scheduling', tier: 21, summary: 'Shaders spawn downstream compute nodes directly on-die with zero CPU round-trips.', effects: { gpuComputeMult: 1.024 } },
  { id: 'gpu_3d_compute_stack', name: '3D Stacked Shader-over-Cache Dies', tier: 22, summary: 'Hybrid-bonds dense shader slices directly onto wide L2 SRAM and HBM base dies.', effects: { gpuComputeMult: 1.025, sramDensityMult: 1.02 } },
  { id: 'gpu_photonic_mzi', name: 'Photonic Tensor Interferometers', tier: 23, summary: 'Mach-Zehnder optical mesh arrays multiply matrices at the speed of light with near-zero heat.', effects: { gpuComputeMult: 1.028, coolingEfficiencyMult: 1.02 } },
  { id: 'gpu_coherent_optic_gpu', name: 'Optical Coherent Multi-Node GPU', tier: 24, extraPrereqs: ['frontier_photonic'], summary: 'Links discrete photonic GPU dies into one unified multi-teraflop tensor engine.', effects: { gpuComputeMult: 1.028, memoryBandwidthMult: 1.025 } },
  { id: 'gpu_holo_field', name: 'Volumetric Light-Field Synthesis Engine', tier: 25, summary: 'Computes real-time physical wave optics and holographic light transport.', effects: { gpuComputeMult: 1.028 } },
  { id: 'gpu_topo_tensor', name: 'Post-Silicon Topological Tensor Mesh', tier: 26, extraPrereqs: ['frontier_topological'], summary: 'Fuses photonic matrix engines with topological error-free compute arrays.', effects: { gpuComputeMult: 1.035, rpGenerationMult: 1.04 } },
];

const GPU_ROW1_RT_TENSOR: TrackItemSpec[] = [
  { id: 'gpu_zbuffer', name: 'Early-Z Depth Rejection Buffer', tier: 2, summary: 'Discards hidden fragments before expensive texture lookups and pixel shading.', effects: { gpuComputeMult: 1.016, memoryBandwidthMult: 1.014 } },
  { id: 'gpu_aniso_tmu', name: '16× Anisotropic Texture Filtering', tier: 4, summary: 'Oblique-angle texture sampling preserves sharp detail across distant 3D planes.', effects: { gpuComputeMult: 1.016 } },
  { id: 'gpu_fp16_hdr', name: 'FP16 High-Dynamic-Range Blending', tier: 6, summary: 'Half-precision floating-point ROP pipelines enable photorealistic lighting bloom.', effects: { gpuComputeMult: 1.018 } },
  { id: 'gpu_fp64_sci', name: 'Double-Precision FP64 Compute Units', tier: 8, summary: 'Full IEEE-754 64-bit matrix pipelines accelerate fluid dynamics and semiconductor TCAD.', effects: { gpuComputeMult: 1.018, rpGenerationMult: 1.025 } },
  { id: 'gpu_hw_video', name: 'Dedicated Video Encode/Decode ASIC', tier: 10, summary: 'Offloads media compression from shader cores onto fixed-function low-power blocks.', effects: { gpuComputeMult: 1.014, leakageReductionMult: 0.99 } },
  { id: 'gpu_tensor_fp16', name: 'Tensor Cores Gen 1 (FP16 Matrix)', tier: 13, summary: '4×4 warp-level matrix-multiply-accumulate units accelerate deep learning 8×.', effects: { gpuComputeMult: 1.024, rpGenerationMult: 1.025 } },
  { id: 'gpu_rt_gen1', name: 'RT Cores Gen 1 (BVH Ray-Box)', tier: 14, summary: 'Fixed-function bounding-volume-hierarchy walkers accelerate hardware ray tracing.', effects: { gpuComputeMult: 1.022 } },
  { id: 'gpu_tensor_sparse', name: 'Tensor Gen 2 (2:4 Structured Sparsity)', tier: 15, summary: 'Skips pruned zero weights in hardware to double effective neural matrix FLOPs.', effects: { gpuComputeMult: 1.022 } },
  { id: 'gpu_rt_gen2', name: 'RT Gen 2 (Opacity Micro-Maps)', tier: 16, summary: 'Resolves alpha-tested foliage and particles directly in hardware without shader invokes.', effects: { gpuComputeMult: 1.02 } },
  { id: 'gpu_tensor_fp8', name: 'Tensor Gen 3 (FP8 Transformer Engine)', tier: 17, summary: 'Dynamic per-layer FP8/FP16 precision scaling doubles AI training and inference speed.', effects: { gpuComputeMult: 1.024, rpGenerationMult: 1.03 } },
  { id: 'gpu_rt_gen3', name: 'RT Gen 3 (Displaced Micro-Meshes)', tier: 18, summary: 'Compresses complex curved surfaces 10× inside BVH trees for real-time path tracing.', effects: { gpuComputeMult: 1.022 } },
  { id: 'gpu_tensor_fp4', name: 'Tensor Gen 4 (Block-Scaled FP4)', tier: 19, summary: 'Micro-exponent 4-bit floating point packs quadruple matrix density into every core.', effects: { gpuComputeMult: 1.025 } },
  { id: 'gpu_rt_gen4', name: 'RT Gen 4 (Mega-Geometry Clusters)', tier: 20, summary: 'Streaming cluster-level BVH rebuilds handle fully animated billion-polygon scenes.', effects: { gpuComputeMult: 1.022 } },
  { id: 'gpu_rt_gen5', name: 'RT Gen 5 (Neural Path-Guiding)', tier: 22, summary: 'On-die radiance caches steer rays toward dominant light paths in a single bounce.', effects: { gpuComputeMult: 1.025 } },
  { id: 'gpu_tensor_analog', name: 'In-Memory Analog Crossbar Tensors', tier: 23, summary: 'Performs vector-matrix dot products via Ohm/Kirchhoff laws inside resistive SRAM arrays.', effects: { gpuComputeMult: 1.028, leakageReductionMult: 0.982 } },
  { id: 'gpu_optical_fft', name: 'All-Optical Fourier Transform Cores', tier: 25, summary: 'Diffractive silicon lenses compute 2D convolutions passively at optical frequencies.', effects: { gpuComputeMult: 1.03, rpGenerationMult: 1.035 } },
];

const GPU_ROW2_BANDWIDTH_VRAM: TrackItemSpec[] = [
  { id: 'gpu_hier_z', name: 'Hierarchical Z-Tile Compression', tier: 3, summary: 'Stores compressed depth bounds per 8×8 tile to cut depth-buffer traffic by 50%.', effects: { memoryBandwidthMult: 1.018 } },
  { id: 'gpu_vram_gddr', name: 'GDDR5 Graphics Memory', tier: 6, rpFactor: 0.72, extraPrereqs: ['gpu_fixed_pipeline', 'sup_ram_sdram'], summary: 'High-frequency differential signaling multiplies GPU memory bandwidth.', extraUnlocks: ['GDDR5 VRAM (28 GB/s per 32-bit slice)'], effects: { memoryBandwidthMult: 1.02 } },
  { id: 'gpu_dcc_v1', name: 'Lossless Delta Color Compression', tier: 8, summary: 'Encodes smooth pixel tiles as base-plus-delta blocks, raising effective VRAM bandwidth.', effects: { memoryBandwidthMult: 1.02 } },
  { id: 'gpu_l2_partition', name: 'Crossbar-Sliced Unified L2 Cache', tier: 10, summary: 'Large shared L2 partitions decouple shader clusters from external VRAM bottlenecks.', effects: { memoryBandwidthMult: 1.02, sramDensityMult: 1.016 } },
  { id: 'gpu_dcc_v2', name: 'Variable-Block 8:1 Color Compression', tier: 12, summary: 'Adaptive multi-block compression boosts effective memory throughput by 35%.', effects: { memoryBandwidthMult: 1.02 } },
  { id: 'gpu_nvlink_d2d', name: 'Coherent High-Speed GPU-to-GPU Link', tier: 14, summary: 'Direct SerDes bridges pool VRAM and compute across multi-GPU racks.', effects: { memoryBandwidthMult: 1.022, gpuComputeMult: 1.016 } },
  { id: 'gpu_infinity_cache', name: 'Massive On-Die Last-Level GPU Cache', tier: 15, summary: '128+ MB high-density SRAM hit buffer amplifies narrow memory buses 2.2×.', effects: { sramDensityMult: 1.022, memoryBandwidthMult: 1.022 } },
  { id: 'gpu_vram_gddr7', name: 'GDDR7 PAM3 Memory', tier: 16, rpFactor: 0.78, extraPrereqs: ['gpu_async_compute'], summary: 'Three-level pulse amplitude modulation pushes conventional VRAM signaling past 28 Gbps.', extraUnlocks: ['GDDR7 VRAM (112 GB/s per 32-bit slice)'], effects: { memoryBandwidthMult: 1.024 } },
  { id: 'gpu_vram_hbm', name: '3D Stacked HBM4 Memory', tier: 19, rpFactor: 0.82, extraPrereqs: ['sup_packaging_25d'], summary: 'Through-silicon-via stacked DRAM dies sit beside the GPU on a wide silicon interposer.', extraUnlocks: ['HBM4 Stacked VRAM (massive bandwidth per bit, low voltage)'], effects: { memoryBandwidthMult: 1.028 } },
  { id: 'gpu_pim_hbm', name: 'Processing-in-Memory HBM Base Die', tier: 21, summary: 'Embeds vector reduction ALUs directly inside the HBM logic base die to cut data movement.', effects: { memoryBandwidthMult: 1.026, gpuComputeMult: 1.02 } },
  { id: 'gpu_optical_vram_bus', name: 'Co-Packaged Optical VRAM Channels', tier: 23, summary: 'Multi-wavelength laser links attach terabytes of pooled memory at local-HBM speeds.', effects: { memoryBandwidthMult: 1.03 } },
  { id: 'gpu_zero_copy_holo', name: 'Zero-Copy Unified Optical Fabric', tier: 25, summary: 'Eliminates host-to-device transfers across petabyte optical memory pools.', effects: { memoryBandwidthMult: 1.032, gpuComputeMult: 1.02 } },
];

// ═══════════════════════════════════════════════════════════════════════════════
// LANE 6: MEMORY & STORAGE SYSTEMS (~76 nodes across 3 sub-rows)
// ═══════════════════════════════════════════════════════════════════════════════

const MEM_ROW0_DRAM_VRAM: TrackItemSpec[] = [
  { id: 'mem_async_dram', name: 'Multiplexed Row/Column Async DRAM', tier: 1, rpFactor: 0.9, summary: 'RAS/CAS address multiplexing halves DRAM package pin count for denser system memory.', effects: { memoryBandwidthMult: 1.016 } },
  { id: 'mem_vram_foundations', name: 'Dual-Port Graphics VRAM', tier: 2, rpFactor: 0.75, summary: 'Dedicated dual-ported memory arrays stream framebuffer pixels without stalling GPU rasterization.', extraUnlocks: ['Dual-Port VRAM Architecture & Graphics Bus in Memory Architect'], effects: { memoryBandwidthMult: 1.018 } },
  { id: 'mem_fpm_edo', name: 'Fast-Page & EDO Burst DRAM', tier: 3, summary: 'Overlaps column data output with next-address precharge for 40% faster sequential reads.', effects: { memoryBandwidthMult: 1.018 } },
  { id: 'mem_sgram', name: 'Block-Write Graphics SGRAM', tier: 4, summary: 'Synchronous single-port graphics RAM introduces masked-write acceleration.', effects: { memoryBandwidthMult: 1.018 } },
  { id: 'sup_ram_sdram', name: 'Synchronous SDRAM & System Bus', tier: 5, rpFactor: 0.7, categoryOverride: 'support', extraPrereqs: ['sup_cooling_air'], summary: 'Clock-synchronized memory bursts end asynchronous wait-state stalls.', extraUnlocks: ['SDRAM Memory Support'], effects: { maxParallelResearch: 2, memoryBandwidthMult: 1.02 } },
  { id: 'mem_ddr1_gddr1', name: 'DDR1 & GDDR1 Dual-Edge Signaling', tier: 6, summary: 'Captures data on both rising and falling clock edges to double memory bus throughput.', effects: { memoryBandwidthMult: 1.02 } },
  { id: 'mem_ddr2_gddr3', name: 'DDR2 / GDDR3 On-Die Termination', tier: 7, summary: 'Integrated ODT resistors tame signal reflections, enabling 800+ MT/s clocks.', effects: { memoryBandwidthMult: 1.02 } },
  { id: 'mem_lpddr_lowv', name: 'LPDDR Low-Voltage Mobile Arrays', tier: 8, summary: 'Partial-array self-refresh and deep power-down cut volatile DRAM standby draw by 55%.', effects: { leakageReductionMult: 0.985, memoryBandwidthMult: 1.015 } },
  { id: 'mem_dram_highk', name: 'High-k Stacked-Capacitor DRAM', tier: 9, rpFactor: 0.75, extraPrereqs: ['fab_130nm'], summary: 'Deep cylindrical high-k dielectric capacitors slash DRAM refresh leakage and triple bit density.', extraUnlocks: ['High-k Stacked-Capacitor DRAM (up to 2 tiers)', '-43% capacitor refresh drain'], effects: { sramDensityMult: 1.018, leakageReductionMult: 0.985 } },
  { id: 'sup_ram_ddr', name: 'DDR3 Dual-Rate Memory', tier: 10, rpFactor: 0.75, categoryOverride: 'support', summary: '8n prefetch and fly-by command topology feed multicore CPUs at low 1.35 V rails.', extraUnlocks: ['DDR3 System RAM (14.9 GB/s per channel)'], effects: { maxPcieGen: 4, memoryBandwidthMult: 1.022 } },
  { id: 'mem_ddr4_bankgrp', name: 'DDR4 Multi-Bank-Group Interleaving', tier: 11, summary: 'Independent bank groups hide activate-to-precharge latency under heavy random workloads.', effects: { memoryBandwidthMult: 1.022 } },
  { id: 'mem_gddr6_dual', name: 'GDDR6 Dual-Channel PAM Signaling', tier: 12, summary: 'Splits each GDDR chip into twin 16-bit independent channels for 16+ Gbps per pin.', effects: { memoryBandwidthMult: 1.022 } },
  { id: 'mem_hbm1_2', name: 'HBM1 & HBM2 Wide TSV Stacks', tier: 13, summary: 'First-generation 1024-bit silicon-interposer DRAM stacks deliver ultra-low pJ/bit transfers.', effects: { memoryBandwidthMult: 1.024 } },
  { id: 'mem_lpddr5x', name: 'LPDDR5X Adaptive Refresh & DFE', tier: 14, summary: 'Decision-feedback equalization pushes ultra-low-power memory past 8,500 MT/s.', effects: { memoryBandwidthMult: 1.02, leakageReductionMult: 0.986 } },
  { id: 'sup_ram_ddr5', name: 'DDR5 & High-Speed SerDes', tier: 15, rpFactor: 0.78, categoryOverride: 'support', extraPrereqs: ['sup_packaging_25d'], summary: 'On-die ECC and dual sub-channel architecture feed high-core-count processors.', extraUnlocks: ['DDR5 RAM (51.2 GB/s per channel)'], effects: { maxPcieGen: 6, siliconEfficiency: 1.15, siliconRefiningMult: 1.05, memoryBandwidthMult: 1.024 } },
  { id: 'mem_hbm_tsv', name: 'TSV 3D-Stacked HBM Cubes', tier: 16, rpFactor: 0.8, extraPrereqs: ['gpu_vram_gddr', 'sup_packaging_25d'], summary: 'Vertically bonds up to 16 DRAM dies using microscopic copper through-silicon vias over a wide interposer.', extraUnlocks: ['TSV 3D-Stacked HBM Cube (up to 16 layers)', 'Ultra-Wide 1024–4096-bit TSV Bus'], constraintWarning: 'Vertical die stacking increases thermal resistance and OSAT bonding capacity demand.', effects: { memoryBandwidthMult: 1.026 } },
  { id: 'mem_ddr6_pam', name: 'DDR6 Quad-Subchannel Architecture', tier: 17, summary: 'Quad sub-channels and multiplexed rank dimming double effective server RAM throughput.', effects: { memoryBandwidthMult: 1.024 } },
  { id: 'mem_gddr8_pam4', name: 'GDDR8 PAM4 High-Density VRAM', tier: 18, summary: 'Four-level signaling and embedded on-die ECC scale discrete graphics bandwidth past 48 Gbps.', effects: { memoryBandwidthMult: 1.024 } },
  { id: 'mem_3d_dram', name: '3D Monolithic Stacked DRAM', tier: 19, rpFactor: 0.82, extraPrereqs: ['sup_packaging_3d'], summary: 'Monolithic vertical oxide-channel DRAM arrays shatter planar capacitor scaling ceilings.', extraUnlocks: ['3D Monolithic Stacked DRAM (up to 16 vertical layers)', '8,400+ MT/s baseline signaling'], effects: { sramDensityMult: 1.024, memoryBandwidthMult: 1.025 } },
  { id: 'mem_hbm5_hybrid', name: 'HBM5 Hybrid-Bonded 24-Hi Stacks', tier: 20, summary: 'Bumpless copper hybrid bonding halves TSV height and boosts thermal escape through HBM cubes.', effects: { memoryBandwidthMult: 1.026, coolingEfficiencyMult: 1.018 } },
  { id: 'mem_ddr7_cxl', name: 'DDR7 Optical-Ready Coherent RAM', tier: 21, summary: 'Integrated optical retimer interfaces extend multi-terabyte memory channels off-board.', effects: { memoryBandwidthMult: 1.026 } },
  { id: 'mem_igzo_capless', name: '2T0C Capacitorless IGZO DRAM', tier: 22, summary: 'Ultra-low-leakage oxide transistors eliminate bulky storage capacitors and cut refresh 100×.', effects: { leakageReductionMult: 0.978, sramDensityMult: 1.022 } },
  { id: 'mem_hbm6_cryo', name: 'HBM6 4096-Bit Active-Interposer Cube', tier: 23, summary: 'Active logic interposers route 8+ TB/s directly under stacked logic chiplets.', effects: { memoryBandwidthMult: 1.03 } },
  { id: 'mem_optical_ram_cube', name: 'Wavelength-Multiplexed Optical RAM', tier: 24, extraPrereqs: ['frontier_photonic'], summary: 'Dense optical resonator banks store and read multi-wavelength data streams at light speed.', effects: { memoryBandwidthMult: 1.032, clockHeadroomMult: 1.01 } },
  { id: 'mem_cryo_sram_super', name: 'Superconducting Josephson Cache RAM', tier: 25, extraPrereqs: ['frontier_cryogenic'], summary: 'Sub-nanosecond flux-quantum memory arrays match 14+ GHz cryogenic CPU clocks.', effects: { memoryBandwidthMult: 1.032, clockHeadroomMult: 1.012 } },
  { id: 'mem_holo_cube', name: '3D Photorefractive Holographic Cubes', tier: 26, summary: 'Page-parallel volumetric optical interference stores petabytes per cubic centimeter.', effects: { memoryBandwidthMult: 1.035, sramDensityMult: 1.03 } },
];

const MEM_ROW1_ROM_NAND: TrackItemSpec[] = [
  { id: 'mem_mask_rom_opt', name: 'High-Density Diffusion Mask ROM', tier: 1, rpFactor: 0.88, summary: 'Hard-wired via-programmed ROM arrays deliver rock-bottom die area for firmware.', effects: { defectReductionMult: 0.988 } },
  { id: 'mem_prom_fuse', name: 'Antifuse One-Time PROM Arrays', tier: 2, summary: 'Field-programmable dielectric antifuses enable post-fab firmware customization.', effects: { fabThroughputMult: 1.014 } },
  { id: 'mem_eprom_uv', name: 'Floating-Gate UV-EPROM & EEPROM', tier: 3, summary: 'Trapped-electron floating gates unlock electrically erasable non-volatile silicon.', effects: { memoryBandwidthMult: 1.016 } },
  { id: 'mem_nand_planar', name: 'Floating-Gate NAND Flash', tier: 4, rpFactor: 0.72, extraPrereqs: ['fab_3000nm'], summary: 'Serial floating-gate transistor chains multiply non-volatile density and launch solid-state storage.', extraUnlocks: ['Planar NAND Flash (SLC/MLC)', 'ONFI Toggle Flash Interface', 'Storage Ecosystem Synergy'], effects: { memoryBandwidthMult: 1.018 } },
  { id: 'mem_nor_xip', name: 'Execute-in-Place NOR Flash', tier: 5, summary: 'Random-access byte-readable flash stores high-reliability boot firmware.', effects: { memoryBandwidthMult: 1.015, defectReductionMult: 0.988 } },
  { id: 'mem_mlc_2bit', name: '2-Bit MLC Threshold Sensing', tier: 6, summary: 'Four distinct charge thresholds double flash storage per cell with precision verify pulses.', effects: { sramDensityMult: 1.016 } },
  { id: 'mem_wear_level', name: 'Dynamic Wear-Leveling FTL Engine', tier: 7, summary: 'Hardware flash translation spreads program/erase wear evenly across all NAND blocks.', effects: { defectReductionMult: 0.986, memoryBandwidthMult: 1.016 } },
  { id: 'mem_tlc_3bit', name: '3-Bit TLC Multi-Level Flash', tier: 8, summary: 'Eight charge states boost solid-state density 50% over MLC for mass SSD adoption.', effects: { sramDensityMult: 1.018 } },
  { id: 'mem_bch_ecc', name: 'Hardware BCH Error-Correction Engine', tier: 9, summary: 'Corrects dozens of raw bit errors per 4 KB page to sustain dense planar flash yields.', effects: { defectReductionMult: 0.982 } },
  { id: 'mem_toggle_ddr', name: 'ONFI 4.0 Toggle-DDR Flash Bus', tier: 10, summary: 'High-speed asynchronous/synchronous flash channels break the SATA bottleneck.', effects: { memoryBandwidthMult: 1.02 } },
  { id: 'mem_vnand_32l', name: '32-Layer Vertical String V-NAND', tier: 11, summary: 'First vertical charge-trap pillars lift flash scaling off the 2D planar interference wall.', effects: { sramDensityMult: 1.02, defectReductionMult: 0.986 } },
  { id: 'mem_3d_nand', name: '3D Charge-Trap V-NAND', tier: 12, rpFactor: 0.78, extraPrereqs: ['fab_45nm'], summary: 'Etches cylindrical charge-trap channels vertically through hundreds of wordline tiers for multi-TB SSDs.', extraUnlocks: ['3D Charge-Trap V-NAND (up to 256 layers, SLC–QLC)', 'PCIe NVMe Direct Storage PHY'], constraintWarning: 'TLC/QLC multi-bit cells sharply reduce P/E endurance unless paired with LDPC ECC.', effects: { memoryBandwidthMult: 1.022 } },
  { id: 'mem_ldpc_soft', name: 'Soft-Decision LDPC ECC Controller', tier: 13, summary: 'Probabilistic parity decoding triples TLC/QLC endurance and rescues marginal dies.', effects: { defectReductionMult: 0.98, memoryBandwidthMult: 1.016 } },
  { id: 'mem_cua_cmos', name: 'CMOS-Under-Array (CuA) Floorplan', tier: 14, summary: 'Places page buffers and sense amps underneath the 3D NAND array to cut die area 22%.', effects: { logicDensityMult: 1.018, sramDensityMult: 1.02 } },
  { id: 'mem_vnand_128l', name: '128-Layer Single-Deck V-NAND', tier: 15, summary: 'Ultra-high-aspect cryo-etch channels pack 128 stacked tiers on a single etching pass.', effects: { sramDensityMult: 1.022 } },
  { id: 'mem_qlc_4bit', name: '4-Bit QLC Enterprise Storage', tier: 16, summary: 'Sixteen threshold levels and dynamic SLC write caches unlock 100 TB enterprise SSDs.', effects: { sramDensityMult: 1.02, memoryBandwidthMult: 1.018 } },
  { id: 'mem_cba_bond', name: 'CMOS-Bonded-to-Array (CBA) Wafers', tier: 18, summary: 'Fabricates logic periphery on a leading node and hybrid-bonds it directly to the NAND wafer.', effects: { memoryBandwidthMult: 1.024, defectReductionMult: 0.982 } },
  { id: 'mem_512l_nand', name: 'Dual-Deck 512-Layer PLC V-NAND', tier: 20, rpFactor: 0.82, extraPrereqs: ['fab_5nm'], summary: 'String-stacked dual-deck channels push vertical NAND past 500 wordline tiers and 5 bits per cell.', extraUnlocks: ['Dual-Deck 512L PLC V-NAND (up to 512 layers, 5 bits/cell)'], constraintWarning: '32-state PLC sensing requires Deep AI-LDPC ECC to protect yield and TBW ratings.', effects: { sramDensityMult: 1.025 } },
  { id: 'mem_vnand_768l', name: '768-Layer Triple-Deck Oxide-Channel', tier: 22, summary: 'Splits cylindrical cells into dual independent half-channels for 2× bit density per hole.', effects: { sramDensityMult: 1.025, defectReductionMult: 0.985 } },
  { id: 'mem_vnand_1024l', name: '1024-Layer Quad-Deck Petabyte NAND', tier: 24, summary: 'Kilolayer vertical arrays with AI-LDPC parity deliver exabyte-class datacenter vaults.', effects: { sramDensityMult: 1.03, memoryBandwidthMult: 1.026 } },
];

const MEM_ROW2_SCM_EMERGING: TrackItemSpec[] = [
  { id: 'mem_sram_6t_opt', name: 'Low-Leakage 6T SRAM Bitcell', tier: 2, summary: 'Balanced access/pull-down transistor ratios stabilize on-die cache arrays.', effects: { sramDensityMult: 1.018 } },
  { id: 'mem_ecc_secded', name: 'On-Die SECDED Parity Arrays', tier: 4, summary: 'Single-error-correcting Hamming codes guard server memory against cosmic soft errors.', effects: { defectReductionMult: 0.986 } },
  { id: 'mem_feram_cap', name: 'Ferroelectric FeRAM Non-Volatile Cells', tier: 6, summary: 'Polarizable perovskite crystals deliver fast non-volatile writes with 10¹⁴ cycle endurance.', effects: { leakageReductionMult: 0.988, memoryBandwidthMult: 1.014 } },
  { id: 'mem_edram_trench', name: 'Embedded Trench eDRAM L4 Cache', tier: 8, summary: 'Packs 3× more last-level cache bits per mm² than 6T SRAM on logic dies.', effects: { sramDensityMult: 1.02 } },
  { id: 'mem_reram_oxide', name: 'Conductive-Bridge ReRAM Arrays', tier: 11, summary: 'Nanoscale oxygen-vacancy filaments switch resistance states at ultra-low write energy.', effects: { leakageReductionMult: 0.985, sramDensityMult: 1.018 } },
  { id: 'mem_nvme_ctrl', name: 'Multi-Queue 64K-Queue NVMe Fabric', tier: 13, summary: 'Parallel submission queues unlock millions of random IOPS across solid-state arrays.', effects: { memoryBandwidthMult: 1.022 } },
  { id: 'mem_rowhammer_trr', name: 'Target Row Refresh & Per-Row ECC', tier: 14, summary: 'Eliminates neighbor-row charge disturbance in ultra-dense DRAM dies.', effects: { defectReductionMult: 0.984, leakageReductionMult: 0.988 } },
  { id: 'mem_pcm_scm', name: '3D Cross-Point Phase-Change SCM', tier: 17, rpFactor: 0.8, extraPrereqs: ['mem_3d_nand', 'mem_dram_highk'], summary: 'Chalcogenide glass phase transitions create byte-addressable non-volatile memory bridging DRAM and SSDs.', extraUnlocks: ['3D Cross-Point PCM Architecture', 'CXL Coherent Persistent Fabric'], constraintWarning: 'High thermal write-pulse current demands robust package cooling.', effects: { memoryBandwidthMult: 1.024 } },
  { id: 'mem_ai_ldpc', name: 'Neural Soft-Channel LDPC Engine', tier: 19, summary: 'Adaptive threshold tracking doubles endurance on multi-bit flash and SCM arrays.', effects: { defectReductionMult: 0.98, memoryBandwidthMult: 1.02 } },
  { id: 'mem_mram_spin', name: 'STT-MRAM Spintronic Memory', tier: 21, rpFactor: 0.84, extraPrereqs: ['fab_2nm'], summary: 'Spin-transfer torque magnetic tunnel junctions deliver near-DRAM speed, zero refresh draw, and near-infinite endurance.', extraUnlocks: ['STT-MRAM Spintronic Universal Memory (~18 ns latency, 10¹¹ P/E endurance)'], effects: { leakageReductionMult: 0.98, memoryBandwidthMult: 1.024 } },
  { id: 'mem_sot_mram', name: 'Spin-Orbit Torque (SOT) Sub-ns MRAM', tier: 23, summary: 'Decouples read and write paths for sub-nanosecond non-volatile L2/L3 cache replacement.', effects: { sramDensityMult: 1.026, leakageReductionMult: 0.978 } },
  { id: 'mem_dna_molecular', name: 'Solid-State Molecular Charge Vaults', tier: 25, summary: 'Sub-nanometer molecular switching grids achieve atomic-limit archival persistence.', effects: { sramDensityMult: 1.03, defectReductionMult: 0.98 } },
];

// ═══════════════════════════════════════════════════════════════════════════════
// LANE 7: PACKAGING, THERMAL & FAB INFRASTRUCTURE (~72 nodes across 3 sub-rows)
// ═══════════════════════════════════════════════════════════════════════════════

const PKG_ROW0_PACKAGING: TrackItemSpec[] = [
  { id: 'pkg_ceramic_dip', name: 'Hermetic Ceramic Cavity DIP', tier: 1, rpFactor: 0.88, summary: 'Gold-plated wirebonds and ceramic sealing improve early thermal and mechanical yield.', effects: { defectReductionMult: 0.986 } },
  { id: 'pkg_pga_grid', name: 'Ceramic Pin-Grid Array (PGA)', tier: 2, summary: '2D under-package pin grids triple I/O pin density over dual-in-line leads.', effects: { memoryBandwidthMult: 1.015 } },
  { id: 'pkg_bga_solder', name: 'Plastic Ball-Grid Array (PBGA)', tier: 4, summary: 'Self-aligning solder balls reduce lead inductance for hundred-MHz buses.', effects: { clockHeadroomMult: 1.006, fabThroughputMult: 1.018 } },
  { id: 'sup_packaging_flipchip', name: 'Flip-Chip LGA Packaging', tier: 6, rpFactor: 0.72, extraPrereqs: ['sup_ram_sdram'], summary: 'Solder-bump flip-chip arrays raise I/O pin density and improve thermal conduction.', extraUnlocks: ['Flip-Chip PGA/LGA Packaging (max die 620 mm²)'], effects: { maxPcieGen: 2, coolingEfficiencyMult: 1.018 } },
  { id: 'pkg_organic_abf', name: 'Multi-Layer Organic ABF Substrates', tier: 8, summary: 'Build-up dielectric films route 16+ micro-via layers cleanly beneath dense flip-chip dies.', effects: { defectReductionMult: 0.985, memoryBandwidthMult: 1.016 } },
  { id: 'pkg_ihs_solder', name: 'Indium-Soldered Integrated Heat Spreader', tier: 9, summary: 'Replaces polymer paste with metallic solder TIM between silicon die and copper lid.', effects: { coolingEfficiencyMult: 1.022 } },
  { id: 'pkg_fowlp', name: 'Fan-Out Wafer-Level Packaging (InFO)', tier: 11, summary: 'Redistributes I/O traces beyond die edges without a thick organic substrate.', effects: { defectReductionMult: 0.984, coolingEfficiencyMult: 1.018 } },
  { id: 'pkg_emib_bridge', name: 'EMIB Embedded Silicon Bridges', tier: 12, summary: 'Tiny buried silicon routing bridges link chiplets at interposer density without full-reticle cost.', effects: { defectReductionMult: 0.982, memoryBandwidthMult: 1.02 } },
  { id: 'sup_packaging_25d', name: '2.5D Silicon Interposer & Chiplets', tier: 14, rpFactor: 0.78, extraPrereqs: ['fab_45nm'], summary: 'Splits giant monolithic dies across a silicon interposer, dramatically protecting yield.', extraUnlocks: ['2.5D Interposer Packaging (max 1,450 mm², -12% effective defect impact)'], effects: { defectReductionMult: 0.982, memoryBandwidthMult: 1.02 } },
  { id: 'pkg_cowos_r', name: 'CoWoS-L Redistribution Interposer', tier: 16, summary: 'Combines organic redistribution with local silicon bridges for 3.3× reticle super-packages.', effects: { fabThroughputMult: 1.025, memoryBandwidthMult: 1.022 } },
  { id: 'pkg_micro_bump', name: '10-Micron Copper Pillar Micro-Bumps', tier: 17, summary: 'Ultra-fine solderless pillars triple vertical die-to-die interconnect density.', effects: { memoryBandwidthMult: 1.022, defectReductionMult: 0.985 } },
  { id: 'sup_packaging_3d', name: '3D Wafer-on-Wafer Hybrid Bonding', tier: 19, rpFactor: 0.82, extraPrereqs: ['fab_5nm'], summary: 'Direct copper TSV bonding stacks cache and compute chiplets vertically.', extraUnlocks: ['3D Wafer-on-Wafer Packaging (max 2,600 mm², 1.72× interconnect scaling)'], effects: { logicDensityMult: 1.02, memoryBandwidthMult: 1.024 } },
  { id: 'pkg_glass_core', name: 'Through-Glass Via (TGV) Core Substrates', tier: 20, summary: 'Ultra-flat glass substrates eliminate large-package warpage and cut high-frequency loss.', effects: { defectReductionMult: 0.98, clockHeadroomMult: 1.01 } },
  { id: 'pkg_cpo_optics', name: 'Co-Packaged Silicon Photonics (CPO)', tier: 22, summary: 'Brings fiber-optic laser engines onto the chip package for 51.2+ Tbps rack links.', effects: { memoryBandwidthMult: 1.028, coolingEfficiencyMult: 1.02 } },
  { id: 'pkg_sub_micron_hb', name: 'Sub-Micron Direct Oxide Hybrid Bond', tier: 24, summary: 'Pushes vertical 3D bonding pitch below 500 nm for million-TSV/mm² logic stacks.', effects: { logicDensityMult: 1.024, memoryBandwidthMult: 1.028 } },
  { id: 'pkg_optical_backplane', name: 'Monolithic Optical Wafer Carrier', tier: 26, summary: 'Free-space photonic interconnects and diamond carriers power post-silicon super-packages.', effects: { coolingEfficiencyMult: 1.03, memoryBandwidthMult: 1.032 } },
];

const PKG_ROW1_THERMAL: TrackItemSpec[] = [
  { id: 'sup_cooling_air', name: 'Forced Air Thermal Management', tier: 1, rpFactor: 0.9, summary: 'Precision axial fans and finned heat sinks triple sustained thermal dissipation.', extraUnlocks: ['Forced Air Cooling (up to ~85 W envelope)'], effects: { coolingEfficiencyMult: 1.02 } },
  { id: 'thm_skived_cu', name: 'Skived Copper Micro-Fin Heatsinks', tier: 3, summary: 'High-conductivity copper bases cut spreading resistance across compact dies.', effects: { coolingEfficiencyMult: 1.02 } },
  { id: 'thm_heatpipe_sinter', name: 'Sintered-Wick Copper Heatpipes', tier: 5, summary: 'Capillary phase-change tubes rapidly transport heat to distant fin stacks.', effects: { coolingEfficiencyMult: 1.022 } },
  { id: 'thm_tim_phase', name: 'Phase-Change Thermal Interface Pads', tier: 7, summary: 'Micro-filling polymer-metal compounds cut die-to-heatsink contact resistance 35%.', effects: { coolingEfficiencyMult: 1.02 } },
  { id: 'sup_cooling_vapor', name: 'Copper Vapor-Chamber Cooling', tier: 9, rpFactor: 0.75, extraPrereqs: ['sup_packaging_flipchip'], summary: 'Two-phase copper heatpipes rapidly pull localized hotspot flux away from dense cores.', extraUnlocks: ['Vapor-Chamber Cooling (up to ~220 W)'], effects: { rpMultiplier: 1.15, rpGenerationMult: 1.03, coolingEfficiencyMult: 1.024 } },
  { id: 'thm_liquid_metal', name: 'Gallium-Indium Liquid Metal TIM', tier: 11, summary: '73 W/m·K metallic interface eliminates hotspot thermal spikes on delidded dies.', effects: { coolingEfficiencyMult: 1.024 } },
  { id: 'sup_cooling_liquid', name: 'Direct-Die Microchannel Liquid', tier: 13, rpFactor: 0.78, summary: 'Coolant circulates millimeters from active transistors to sustain 450 W+ packages.', extraUnlocks: ['Direct-Die Liquid Cooling'], effects: { maxParallelResearch: 3, coolingEfficiencyMult: 1.025 } },
  { id: 'thm_jet_impinge', name: 'Multi-Jet Impingement Coldplates', tier: 15, summary: 'Targeted micro-nozzles blast coolant perpendicular to the hottest core hotspots.', effects: { coolingEfficiencyMult: 1.025 } },
  { id: 'thm_diamond_spreader', name: 'CVD Polycrystalline Diamond Spreaders', tier: 16, summary: '2,000 W/m·K synthetic diamond layers flatten extreme W/mm² flux peaks.', effects: { coolingEfficiencyMult: 1.026 } },
  { id: 'sup_cooling_immersion', name: 'Two-Phase Immersion Array', tier: 18, rpFactor: 0.8, summary: 'Submerged fluorocarbon boiling handles extreme kilowatt-class packages.', extraUnlocks: ['Two-Phase Immersion Cooling (up to ~950 W)'], effects: { maxParallelResearch: 4, coolingEfficiencyMult: 1.028 } },
  { id: 'thm_in_si_microfluid', name: 'In-Silicon Etched Microfluidic Channels', tier: 20, summary: 'Etches coolant capillaries directly inside the wafer backside just 50 μm from transistors.', effects: { coolingEfficiencyMult: 1.03 } },
  { id: 'thm_graphene_phonon', name: 'Ballistic Phonon Graphene Vias', tier: 22, summary: 'Thermal through-silicon vias pull heat vertically out of 3D stacked logic and HBM.', effects: { coolingEfficiencyMult: 1.03 } },
  { id: 'thm_cryo_pulse', name: 'Closed-Loop Pulse-Tube Cryocoolers', tier: 24, extraPrereqs: ['frontier_cryogenic'], summary: 'High-COP helium refrigeration lowers Carnot cooling power overhead for 4K–77K rigs.', effects: { coolingEfficiencyMult: 1.035 } },
  { id: 'thm_thermoelectric_q', name: 'Quantum-Dot Peltier Hotspot Sinks', tier: 26, summary: 'Active nanostructured solid-state heat pumps hold post-silicon junctions rock steady.', effects: { coolingEfficiencyMult: 1.035 } },
];

const PKG_ROW2_IO_LABS: TrackItemSpec[] = [
  { id: 'io_pcie_gen1', name: 'Serial Point-to-Point PCIe Gen 1', tier: 2, summary: 'Replaces parallel shared buses with high-speed differential serial lanes.', effects: { maxPcieGen: 1, memoryBandwidthMult: 1.012 } },
  { id: 'lab_cad_spice', name: 'SPICE Circuit Simulation Workstations', tier: 3, summary: 'Automated transistor-level simulation accelerates every R&D department.', effects: { rpGenerationMult: 1.05 } },
  { id: 'lab_verilog_eda', name: 'RTL Synthesis & Place-and-Route EDA', tier: 5, summary: 'Automated cell placement turns years of hand-drawn mask layout into weeks.', effects: { rpGenerationMult: 1.06, logicDensityMult: 1.015 } },
  { id: 'io_pcie_gen3', name: 'PCIe Gen 3 128b/130b Encoding', tier: 7, summary: 'Cuts serialization overhead to 1.5%, doubling per-lane I/O bandwidth to 1.0 GB/s.', effects: { maxPcieGen: 3, memoryBandwidthMult: 1.016 } },
  { id: 'lab_formal_verif', name: 'Formal Equivalence & Timing Signoff', tier: 8, summary: 'Mathematically proves RTL-to-GDSII correctness, reducing tape-out bugs and speeding R&D.', effects: { rpGenerationMult: 1.06, defectReductionMult: 0.988 } },
  { id: 'lab_tcad_3d', name: '3D Physics TCAD Device Modeling', tier: 10, summary: 'Simulates quantum transport and thermal stress before committing expensive fab test lots.', effects: { rpGenerationMult: 1.065 } },
  { id: 'io_pcie_gen5', name: 'PCIe Gen 5 32 GT/s SerDes', tier: 12, summary: 'Ultra-low-loss retimers scale host I/O to 4.0 GB/s per lane.', effects: { maxPcieGen: 5, memoryBandwidthMult: 1.018 } },
  { id: 'lab_parallel_5', name: 'Distributed Multi-Campus R&D Grid', tier: 14, extraPrereqs: ['sup_cooling_liquid'], summary: 'Dedicated fabrication, architecture, and packaging campuses run 5 research tracks in parallel.', effects: { maxParallelResearch: 5, rpGenerationMult: 1.07 } },
  { id: 'io_pcie_gen7', name: 'PCIe Gen 7 128 GT/s PAM4 Fabric', tier: 17, extraPrereqs: ['sup_ram_ddr5'], summary: 'Quad-level signaling pushes copper/optical host lanes to 16 GB/s per lane.', effects: { maxPcieGen: 7, memoryBandwidthMult: 1.02 } },
  { id: 'lab_parallel_6', name: 'AI-Assisted Autonomous EDA Labs', tier: 18, extraPrereqs: ['sup_cooling_immersion'], summary: 'Reinforcement-learning floorplanners and synthesis agents unlock a 6th parallel R&D slot.', effects: { maxParallelResearch: 6, rpGenerationMult: 1.08 } },
  { id: 'io_pcie_gen8', name: 'PCIe Gen 8 256 GT/s Optical Lanes', tier: 20, summary: 'Integrated silicon-photonic SerDes scales host interconnect to 32 GB/s per lane.', effects: { maxPcieGen: 8, memoryBandwidthMult: 1.022 } },
  { id: 'lab_parallel_7', name: 'Quantum-Accelerated TCAD Super-Labs', tier: 21, summary: 'First-principles ab-initio atomic simulation unlocks a 7th parallel research slot.', effects: { maxParallelResearch: 7, rpGenerationMult: 1.09 } },
  { id: 'io_pcie_gen9', name: 'PCIe Gen 9 Wavelength-Routed Bus', tier: 23, summary: 'Multi-lambda coherent fibers push per-lane host throughput to 64 GB/s.', effects: { maxPcieGen: 9, memoryBandwidthMult: 1.024 } },
  { id: 'lab_parallel_8', name: 'Self-Synthesizing Frontier Research Core', tier: 24, summary: 'Autonomous experimental fabs and AI theorists sustain 8 simultaneous breakthroughs.', effects: { maxParallelResearch: 8, rpGenerationMult: 1.1 } },
  { id: 'io_pcie_gen10', name: 'PCIe Gen 10 Terabit Photonic Backplane', tier: 25, summary: '128 GB/s per lane coherent optical backplane saturates post-silicon compute clusters.', effects: { maxPcieGen: 10, memoryBandwidthMult: 1.028 } },
];

// ═══════════════════════════════════════════════════════════════════════════════
// PARAMETRIC ENGINEERING REFINEMENT GENERATOR
// Deterministically populates remaining open (lane, subRow, tier) cells with
// authentic, domain-specific engineering breakthroughs so all 7 lanes span
// 525+ unique, non-overlapping nodes with zero filler.
// ═══════════════════════════════════════════════════════════════════════════════

interface AutoRefinementTemplate {
  lane: TechLaneId;
  category: TechCategory;
  subRow: number;
  prefix: string;
  entries: Array<{
    tier: number;
    slug: string;
    name: string;
    summary: string;
    effects: TechEffects;
  }>;
}

const PARAMETRIC_REFINEMENTS: AutoRefinementTemplate[] = [
  // Fabrication refinements (fills gaps in rows 1, 2, 3 -> total ~90 Fab nodes)
  {
    lane: 'fabrication',
    category: 'fabrication',
    subRow: 1,
    prefix: 'fab_ic_ref',
    entries: [
      { tier: 2, slug: 'step_cov', name: 'Conformal Metal Step Coverage', summary: 'Heated wafer chucks eliminate thin-spot voids over steep oxide steps.', effects: { defectReductionMult: 0.988, fabThroughputMult: 1.015 } },
      { tier: 7, slug: 'cmp_slurry', name: 'Selective Ceria CMP Slurries', summary: 'Prevents oxide dishing across wide metal buses during planarization.', effects: { defectReductionMult: 0.986 } },
      { tier: 11, slug: 'lowk_cure', name: 'UV-Assisted Low-k Curing', summary: 'Strengthens porous dielectrics against mechanical packaging stress.', effects: { defectReductionMult: 0.986, clockHeadroomMult: 1.006 } },
      { tier: 14, slug: 'via_self', name: 'Self-Aligned Via Etch Stops', summary: 'Eliminates metal-to-via shorts in tight 14 nm/10 nm routing tracks.', effects: { defectReductionMult: 0.984, logicDensityMult: 1.014 } },
      { tier: 16, slug: 'co_liner', name: 'Ultra-Thin Cobalt Wetting Liners', summary: 'Improves void-free gap fill inside 12 nm trenches.', effects: { defectReductionMult: 0.985, clockHeadroomMult: 1.006 } },
      { tier: 23, slug: 'cnt_via', name: 'Vertical Carbon-Nanotube Vias', summary: 'High-ampacity CNT bundles survive 100× higher current density than copper.', effects: { clockHeadroomMult: 1.01, coolingEfficiencyMult: 1.016 } },
      { tier: 26, slug: 'zero_res', name: 'Ballistic Zero-Loss Interconnect Mesh', summary: 'Quantum-coherent signal lanes remove wire RC delay across Angstrom dies.', effects: { clockHeadroomMult: 1.014, logicDensityMult: 1.018 } },
    ],
  },
  {
    lane: 'fabrication',
    category: 'fabrication',
    subRow: 2,
    prefix: 'fab_ald_ref',
    entries: [
      { tier: 4, slug: 'pecvd_nit', name: 'PECVD Silicon Nitride Passivation', summary: 'Moisture-proof top passivation shields dies from environmental corrosion.', effects: { defectReductionMult: 0.988 } },
      { tier: 8, slug: 'hdp_cvd', name: 'High-Density Plasma Gap Fill', summary: 'Fills narrow STI trenches void-free during simultaneous sputter-deposition.', effects: { logicDensityMult: 1.015, defectReductionMult: 0.987 } },
      { tier: 10, slug: 'plasma_nit', name: 'Decoupled Plasma Nitridation', summary: 'Refines sub-2 nm gate dielectric uniformity across 300 mm wafers.', effects: { leakageReductionMult: 0.986 } },
      { tier: 12, slug: 'peald_sp', name: 'Plasma-Enhanced ALD Spacers', summary: 'Deposits pinhole-free low-k gate spacers at low thermal budget.', effects: { logicDensityMult: 1.016, leakageReductionMult: 0.988 } },
      { tier: 14, slug: 'si_recess', name: 'Sub-Nanometer Fin Recess Control', summary: 'Matches epitaxial stressor volume uniformly across billion-fin arrays.', effects: { clockHeadroomMult: 1.007, defectReductionMult: 0.986 } },
      { tier: 17, slug: 'metal_ald', name: 'Selective Tungsten Work-Function ALD', summary: 'Conformal metal fill inside narrow 5 nm/3 nm GAA cavities.', effects: { leakageReductionMult: 0.985, logicDensityMult: 1.015 } },
      { tier: 20, slug: 'bsd_thin', name: 'Nano-Precision Wafer Back-Grinding', summary: 'Thins silicon substrates down to 500 nm with sub-10 nm uniformity for BSPDN.', effects: { fabThroughputMult: 1.022, defectReductionMult: 0.986 } },
      { tier: 22, slug: 'dry_clean', name: 'Supercritical CO2 Nanostructure Dry', summary: 'Zero-surface-tension drying prevents collapse of high-aspect nanosheets.', effects: { defectReductionMult: 0.982 } },
      { tier: 24, slug: 'atomic_dop', name: 'Deterministic Single-Atom Doping', summary: 'Places individual dopant atoms cleanly to erase random dopant fluctuation.', effects: { leakageReductionMult: 0.98, clockHeadroomMult: 1.009 } },
      { tier: 26, slug: 'monolith_3d', name: 'Sequential Monolithic 3D Integration', summary: 'Low-temperature top-tier epitaxy stacks multiple active device layers on one wafer.', effects: { logicDensityMult: 1.028, sramDensityMult: 1.024 } },
    ],
  },
  {
    lane: 'fabrication',
    category: 'fabrication',
    subRow: 3,
    prefix: 'fab_si_ref',
    entries: [
      { tier: 6, slug: 'edge_bevel', name: 'Wafer Bevel Edge Polishing', summary: 'Eliminates edge chipping that sheds particles onto active inner dies.', effects: { defectReductionMult: 0.987, siliconRefiningMult: 1.03 } },
      { tier: 9, slug: 'mag_cz', name: 'Magnetic-Field Czochralski Pulling', summary: 'Magnetic damping stabilizes molten silicon convection for ultra-uniform ingots.', effects: { siliconRefiningMult: 1.06, defectReductionMult: 0.988 } },
      { tier: 13, slug: 'n2_purge', name: 'Dynamic Nitrogen Load-Port Purging', summary: 'Prevents copper oxidation between etch and deposition steps.', effects: { defectReductionMult: 0.985 } },
      { tier: 15, slug: 'chamber_ai', name: 'Predictive Chamber Plasma Cleaning', summary: 'Cuts unplanned fab downtime and particle excursions by 30%.', effects: { fabThroughputMult: 1.025, defectReductionMult: 0.986 } },
      { tier: 18, slug: 'green_si', name: 'Closed-Loop Silane Gas Recovery', summary: 'Recaptures unreacted refining gases to boost silicon feedstock yield.', effects: { siliconRefiningMult: 1.07 } },
      { tier: 20, slug: 'zero_vib', name: 'Active Piezo Sub-Fab Isolation', summary: 'Cancels nanometer floor vibrations across entire High-NA cleanroom slabs.', effects: { defectReductionMult: 0.983 } },
      { tier: 22, slug: 'cryo_gas', name: 'Ultra-Pure Point-of-Use Gas Purifiers', summary: 'Removes parts-per-trillion moisture from Angstrom epitaxy chambers.', effects: { defectReductionMult: 0.982, leakageReductionMult: 0.988 } },
      { tier: 23, slug: 'si_carbide', name: 'SiC & Diamond Carrier Wafers', summary: 'Ultra-stiff reusable carrier wafers speed up thin-wafer 3D bonding lines.', effects: { fabThroughputMult: 1.03, siliconRefiningMult: 1.05 } },
      { tier: 25, slug: 'orb_pure', name: 'Zero-Dislocation Micro-Gravity Boules', summary: 'Near-perfect crystal symmetry eliminates bulk wafer slip defects.', effects: { siliconRefiningMult: 1.08, defectReductionMult: 0.98 } },
      { tier: 26, slug: 'matter_ref', name: 'Isotope-Separated Feedstock Synthesis', summary: 'Supplies mass-scale pure Si-28 and graphene precursors for post-silicon fabs.', effects: { siliconRefiningMult: 1.1, fabThroughputMult: 1.035 } },
    ],
  },
  // Lithography refinements (fills rows 1 & 2 -> total ~66 Litho nodes)
  {
    lane: 'lithography',
    category: 'fabrication',
    subRow: 1,
    prefix: 'met_ref',
    entries: [
      { tier: 3, slug: 'film_map', name: 'Automated Wafer Stress Mapping', summary: 'Measures wafer bow across metal stacks to preserve stepper focus.', effects: { defectReductionMult: 0.988 } },
      { tier: 6, slug: 'prober_auto', name: 'High-Speed Parametric Wafer Probers', summary: 'Tests electrical ring oscillators in scribe lines immediately after metal-1.', effects: { fabThroughputMult: 1.018, rpGenerationMult: 1.02 } },
      { tier: 8, slug: 'overlay_ff', name: 'Feed-Forward Scanner Overlay Control', summary: 'Corrects per-wafer thermal expansion before exposure begins.', effects: { defectReductionMult: 0.985 } },
      { tier: 10, slug: 'imm_bubble', name: 'Acoustic Immersion Bubble Detectors', summary: 'Catches microscopic air bubbles in the 193 nm water meniscus instantly.', effects: { defectReductionMult: 0.984 } },
      { tier: 13, slug: 'holo_inspect', name: 'Deep-UV Holographic Wafer Inspection', summary: 'Captures phase and amplitude defects across patterned 22 nm/14 nm dies.', effects: { defectReductionMult: 0.982 } },
      { tier: 15, slug: 'hv_sem', name: 'High-Voltage Buried-Via E-Beam', summary: 'Sees through upper metal layers to spot hidden voided copper vias.', effects: { defectReductionMult: 0.982 } },
      { tier: 18, slug: 'euv_stoch', name: 'Stochastic Photon-Shot Analytics', summary: 'Tunes EUV dose maps per feature to prevent random missing contacts.', effects: { defectReductionMult: 0.98 } },
      { tier: 21, slug: 'hyb_bond_ir', name: 'Sub-10 nm Hybrid-Bond Void Imaging', summary: 'Acoustic and IR tomography verifies 100% contact across wafer-on-wafer bonds.', effects: { defectReductionMult: 0.98, fabThroughputMult: 1.02 } },
      { tier: 23, slug: 'cryo_probe', name: 'Automated Cryogenic Wafer Probing', summary: 'Screens superconducting and Angstrom dies at operating temperature before dicing.', effects: { defectReductionMult: 0.978, rpGenerationMult: 1.03 } },
      { tier: 25, slug: 'opt_spec', name: 'Inline Photonic Waveguide Probing', summary: 'Couples laser test combs directly onto wafers to bin optical resonators.', effects: { defectReductionMult: 0.978, memoryBandwidthMult: 1.018 } },
    ],
  },
  {
    lane: 'lithography',
    category: 'fabrication',
    subRow: 2,
    prefix: 'res_ref',
    entries: [
      { tier: 2, slug: 'spin_coat', name: 'Closed-Bowl Precision Resist Spinners', summary: 'Cuts photoresist consumption by 40% while improving edge uniformity.', effects: { fabThroughputMult: 1.018 } },
      { tier: 4, slug: 'quartz_blank', name: 'Low-Expansion Fused Quartz Blanks', summary: 'Prevents reticle heating distortion during long production wafer runs.', effects: { defectReductionMult: 0.987 } },
      { tier: 7, slug: 'eb_mask', name: 'Variable-Shaped E-Beam Mask Writers', summary: 'Draws crisp 250 nm/180 nm phase-shift reticles with 3× finer address grid.', effects: { logicDensityMult: 1.015, defectReductionMult: 0.987 } },
      { tier: 8, slug: 'sraf_assist', name: 'Sub-Resolution Assist Features', summary: 'Non-printing guide bars equalize isolated and dense line focus margins.', effects: { defectReductionMult: 0.985, logicDensityMult: 1.014 } },
      { tier: 9, slug: 'dual_stage', name: 'Twin-Stage Measure-While-Expose', summary: 'Measures the next wafer while exposing the current one, boosting scanner WPH 45%.', effects: { fabThroughputMult: 1.03 } },
      { tier: 11, slug: 'spin_on_c', name: 'Tri-Layer Spin-On Carbon Hardmasks', summary: 'Transfers razor-sharp patterns into deep dielectric stacks without resist erosion.', effects: { logicDensityMult: 1.016, defectReductionMult: 0.986 } },
      { tier: 13, slug: 'euv_mirror', name: '40-Pair Mo/Si Bragg Mirror Polishing', summary: 'Picometer-flat multilayer mirrors raise EUV reflectivity toward the 70% limit.', effects: { fabThroughputMult: 1.022, rpGenerationMult: 1.02 } },
      { tier: 15, slug: 'mask_rep', name: 'Focused-Ion-Beam Reticle Repair', summary: 'Surgically repairs nanoscale mask defects instead of scrapping million-credit reticles.', effects: { fabThroughputMult: 1.02, defectReductionMult: 0.985 } },
      { tier: 17, slug: 'euv_droplet', name: '100 kHz Tin-Droplet Synchronization', summary: 'Stabilizes EUV plasma pulse energy to cut wafer-to-wafer dose variation.', effects: { fabThroughputMult: 1.025, defectReductionMult: 0.984 } },
      { tier: 19, slug: 'highna_stage', name: 'Magnetic-Levitation 8G Wafer Stages', summary: 'Frictionless linear motors accelerate heavy wafer chucks with sub-nanometer accuracy.', effects: { fabThroughputMult: 1.028 } },
      { tier: 23, slug: 'maskless_arr', name: '10,000-Beam Direct-Write Array', summary: 'Parallel programmable particle beams eliminate reticle costs for rapid prototypes.', effects: { rpGenerationMult: 1.04, fabThroughputMult: 1.025 } },
      { tier: 24, slug: 'xray_mirror', name: 'Grazing-Incidence Soft X-Ray Mirrors', summary: 'Atomically smooth ruthenium optics steer coherent sub-5 nm beams cleanly.', effects: { defectReductionMult: 0.98, logicDensityMult: 1.018 } },
      { tier: 26, slug: 'atom_trap', name: 'Optical-Lattice Atom-Placement Arrays', summary: 'Positions dopant and channel atoms with deterministic lattice precision.', effects: { logicDensityMult: 1.025, defectReductionMult: 0.976 } },
    ],
  },
  // Transistor refinements (fills rows 1 & 2 -> total ~72 Transistor nodes)
  {
    lane: 'transistors',
    category: 'fabrication',
    subRow: 1,
    prefix: 'mat_ref',
    entries: [
      { tier: 1, slug: 'poly_dop', name: 'Phosphorus-Doped Polysilicon Gates', summary: 'Lowers gate threshold voltage from 4V down to clean 1.5V switching.', effects: { clockHeadroomMult: 1.006, leakageReductionMult: 0.99 } },
      { tier: 3, slug: 'guard_ring', name: 'Deep Substrate Guard Rings', summary: 'Isolates sensitive analog and clock PLL circuits from digital switching noise.', effects: { clockHeadroomMult: 1.006, defectReductionMult: 0.988 } },
      { tier: 5, slug: 'trench_cap', name: 'Deep-Trench Decoupling Capacitors', summary: 'Stabilizes local power rails during simultaneous multi-bit bus transitions.', effects: { clockHeadroomMult: 1.006 } },
      { tier: 6, slug: 'si_carb_str', name: 'Tensile Si:C NMOS Stressors', summary: 'Carbon-doped silicon pockets stretch NMOS channels for higher electron velocity.', effects: { clockHeadroomMult: 1.008 } },
      { tier: 9, slug: 'smart_cut', name: 'Hydrogen-Implant Smart-Cut SOI', summary: 'Splits ultra-uniform silicon films cleanly for low-capacitance SOI wafers.', effects: { leakageReductionMult: 0.985, siliconRefiningMult: 1.03 } },
      { tier: 10, slug: 'ge_cond', name: 'Germanium Condensation Channels', summary: 'Enriches surface channel mobility without lattice misfit dislocations.', effects: { clockHeadroomMult: 1.008 } },
      { tier: 12, slug: 'ald_al2o3', name: 'Alumina Dipole Capping Layers', summary: 'Fine-tunes high-k metal gate threshold voltage across low-power libraries.', effects: { leakageReductionMult: 0.984 } },
      { tier: 14, slug: 'epi_sd_merge', name: 'Diamond-Shaped Epitaxial Source/Drain', summary: 'Lowers parasitic series resistance into ultra-narrow 3D silicon fins.', effects: { clockHeadroomMult: 1.009, logicDensityMult: 1.015 } },
      { tier: 16, slug: 'inner_spacer', name: 'Low-k Silicon-Boron-Nitride Spacers', summary: 'Cuts gate-to-contact capacitance inside tightly pitched nanosheet cells.', effects: { clockHeadroomMult: 1.009, leakageReductionMult: 0.986 } },
      { tier: 18, slug: 'bottom_iso', name: 'Bottom Dielectric Isolation (BDI)', summary: 'Seals the floor beneath GAA nanosheets to eliminate parasitic sub-fin leakage.', effects: { leakageReductionMult: 0.978 } },
      { tier: 20, slug: 'bismuth_ct', name: 'Semimetallic Bismuth 2D Contacts', summary: 'Eliminates Schottky contact resistance on monolayer MoS2/WS2 channels.', effects: { clockHeadroomMult: 1.01, leakageReductionMult: 0.984 } },
      { tier: 22, slug: 'ferro_gate', name: 'Epitaxial Perovskite Gate Oxides', summary: 'Crystalline ultra-high-k insulators scale electrostatic control into sub-nm gates.', effects: { leakageReductionMult: 0.978, logicDensityMult: 1.018 } },
      { tier: 26, slug: 'anyon_sub', name: 'Topological Superconductor Heterostructures', summary: 'Hybrid nanowire-superconductor templates stabilize room-to-cryo braided gates.', effects: { logicDensityMult: 1.024, clockHeadroomMult: 1.014 } },
    ],
  },
  {
    lane: 'transistors',
    category: 'fabrication',
    subRow: 2,
    prefix: 'rel_ref',
    entries: [
      { tier: 2, slug: 'burn_in', name: 'Accelerated Infant-Mortality Screening', summary: 'Thermal-voltage stress testing catches weak oxides before customer shipment.', effects: { defectReductionMult: 0.988 } },
      { tier: 4, slug: 'clock_gate', name: 'Architectural Clock Gating Cells', summary: 'Halts clock toggling in idle flip-flops to cut dynamic switching power 18%.', effects: { leakageReductionMult: 0.988, clockHeadroomMult: 1.005 } },
      { tier: 5, slug: 'pll_lowjit', name: 'Low-Jitter Fractional-N Clock PLL', summary: 'Cuts cycle-to-cycle clock skew, recovering 5% usable frequency headroom.', effects: { clockHeadroomMult: 1.008 } },
      { tier: 7, slug: 'body_bias', name: 'Adaptive Forward/Reverse Body Bias', summary: 'Dynamically shifts transistor threshold to trade standby power for boost clock.', effects: { leakageReductionMult: 0.984, clockHeadroomMult: 1.006 } },
      { tier: 9, slug: 'thermal_dio', name: 'Distributed On-Die Thermal Sensors', summary: 'Real-time per-core temperature telemetry enables tight boost throttling margins.', effects: { coolingEfficiencyMult: 1.018 } },
      { tier: 11, slug: 'sram_8t', name: 'Dual-Rail 8T Low-Voltage SRAM', summary: 'Decouples read/write stability so L1 caches operate reliably at near-threshold volts.', effects: { sramDensityMult: 1.016, leakageReductionMult: 0.986 } },
      { tier: 13, slug: 'mim_decap', name: 'Super-High-Density MIM Decap Layers', summary: 'Metal-insulator-metal capacitors embedded in top routing tame di/dt noise.', effects: { clockHeadroomMult: 1.008 } },
      { tier: 17, slug: 'dtco_cell', name: 'Design-Technology Co-Optimization', summary: 'Co-designs standard cell layouts with EUV lithography rules for 15% denser logic.', effects: { logicDensityMult: 1.02, sramDensityMult: 1.016 } },
      { tier: 19, slug: 'stco_3d', name: 'System-Technology Co-Optimization', summary: 'Co-optimizes 3D CFET, BSPDN, and thermal vias as one unified physical stack.', effects: { logicDensityMult: 1.02, coolingEfficiencyMult: 1.02 } },
      { tier: 21, slug: 'cryo_vt', name: 'Cryo-Tuned Threshold Implants', summary: 'Compensates carrier freeze-out so CMOS retains peak drive at 77K and below.', effects: { clockHeadroomMult: 1.012, leakageReductionMult: 0.98 } },
      { tier: 23, slug: 'rad_hard', name: 'Triple-Modular Redundant Logic Cells', summary: 'Zero-error voting gates sustain reliability at sub-0.3V ultra-low-energy rails.', effects: { defectReductionMult: 0.982 } },
      { tier: 25, slug: 'qec_surface', name: 'Hardware Surface-Code Error Decoders', summary: 'Real-time syndrome decoding stabilizes hybrid quantum-topological co-processors.', effects: { defectReductionMult: 0.978, rpGenerationMult: 1.035 } },
    ],
  },
  // CPU refinements (fills rows 1, 2, 3 -> total ~80 CPU nodes)
  {
    lane: 'cpu',
    category: 'cpu',
    subRow: 1,
    prefix: 'cpu_mem_ref',
    entries: [
      { tier: 4, slug: 'ras_stack', name: 'Hardware Return-Address Stack', summary: 'Predicts function-return targets with 99.8% accuracy in deep call hierarchies.', effects: { ipcBonusMult: 1.014 } },
      { tier: 7, slug: 'store_fwd', name: 'Speculative Store-to-Load Forwarding', summary: 'Passes recent writes directly to dependent loads without waiting for L1 writeback.', effects: { ipcBonusMult: 1.016 } },
      { tier: 9, slug: 'nonblock_l1', name: 'Non-Blocking Lockup-Free L1 Cache', summary: 'Tracks 16+ simultaneous L1 misses via MSHRs to maximize memory-level parallelism.', effects: { ipcBonusMult: 1.016, memoryBandwidthMult: 1.015 } },
      { tier: 11, slug: 'l2_prefetch', name: 'Adaptive L2 Spatial Prefetcher', summary: 'Dynamically throttles prefetch aggressiveness based on memory bus saturation.', effects: { memoryBandwidthMult: 1.016, ipcBonusMult: 1.014 } },
      { tier: 14, slug: 'mem_disamb', name: 'Speculative Memory Disambiguation', summary: 'Executes younger loads ahead of unresolved older stores safely.', effects: { ipcBonusMult: 1.018 } },
      { tier: 16, slug: 'uop_btb', name: 'Multi-Level Decoupled BTB Front-End', summary: 'Decouples branch prediction from instruction fetch to stay 64 bytes ahead of execution.', effects: { ipcBonusMult: 1.018 } },
      { tier: 19, slug: 'l2_private', name: 'Large 4 MB Per-Core Private L2', summary: 'Doubles per-core private L2 bandwidth while cutting cross-mesh L3 traffic.', effects: { sramDensityMult: 1.02, ipcBonusMult: 1.016 } },
      { tier: 21, slug: 'val_pred', name: 'Hardware Load-Value Prediction', summary: 'Speculatively predicts repetitive load values to break true data dependencies.', effects: { ipcBonusMult: 1.02 } },
      { tier: 24, slug: 'nonvol_l2', name: 'Instant-On Non-Volatile MRAM L2', summary: 'Zero-leakage spintronic cache retains state across microsecond sleep cycles.', effects: { leakageReductionMult: 0.982, sramDensityMult: 1.02 } },
      { tier: 26, slug: 'holo_tlb', name: 'Associative Optical Content-Addressable Cache', summary: 'Parallel optical tag matching resolves terabyte virtual spaces in one cycle.', effects: { ipcBonusMult: 1.024, memoryBandwidthMult: 1.025 } },
    ],
  },
  {
    lane: 'cpu',
    category: 'cpu',
    subRow: 2,
    prefix: 'cpu_isa_ref',
    entries: [
      { tier: 3, slug: 'isa_cmov', name: 'Predicated Conditional Move ISA', summary: 'Eliminates hard-to-predict short branches by converting control flow to data flow.', effects: { ipcBonusMult: 1.015 } },
      { tier: 5, slug: 'isa_64bit', name: '64-Bit Flat Virtual Addressing', summary: 'Expands general registers and breaks the 4 GB memory ceiling permanently.', effects: { ipcBonusMult: 1.016, memoryBandwidthMult: 1.015 } },
      { tier: 7, slug: 'isa_virt', name: 'Hardware Virtualization Extensions', summary: 'Nested page tables and hypervisor traps run cloud VMs at near-native speed.', effects: { ipcBonusMult: 1.014, rpGenerationMult: 1.02 } },
      { tier: 8, slug: 'isa_atomic', name: 'Lock-Free Compare-and-Swap Atomics', summary: 'Slashes multicore synchronization contention across high-thread workloads.', effects: { ipcBonusMult: 1.016 } },
      { tier: 12, slug: 'isa_bmi2', name: 'Parallel Bit Deposit & Extract ISA', summary: 'Hardware bit-scatter units accelerate cryptography, search indices, and codecs.', effects: { ipcBonusMult: 1.015 } },
      { tier: 14, slug: 'isa_tsx', name: 'Hardware Transactional Memory', summary: 'Executes lock-protected critical sections optimistically in parallel across cores.', effects: { ipcBonusMult: 1.018 } },
      { tier: 16, slug: 'isa_fp16_cpu', name: 'Native Half-Precision Vector ALU', summary: 'Doubles media and simulation vector throughput inside compact E-cores.', effects: { ipcBonusMult: 1.018 } },
      { tier: 19, slug: 'isa_c_enclave', name: 'Hardware Memory-Encrypted Enclaves', summary: 'Zero-latency inline AES-XTS memory encryption secures multi-tenant compute.', effects: { memoryBandwidthMult: 1.016, rpGenerationMult: 1.02 } },
      { tier: 22, slug: 'isa_graph', name: 'Hardware Graph-Traversal Instructions', summary: 'Dedicated gather-scatter and frontier queues speed up sparse scientific graphs.', effects: { ipcBonusMult: 1.02, memoryBandwidthMult: 1.018 } },
      { tier: 24, slug: 'isa_optical_vec', name: 'Photonic Vector Broadcast ISA', summary: 'Broadcasts single operands across 64 cores simultaneously in one optical pulse.', effects: { ipcBonusMult: 1.024 } },
    ],
  },
  {
    lane: 'cpu',
    category: 'cpu',
    subRow: 3,
    prefix: 'cpu_soc_ref',
    entries: [
      { tier: 1, slug: 'soc_bus_arb', name: 'Split-Transaction System Bus', summary: 'Allows multiple memory requests to pipeline on the bus without waiting for completion.', effects: { memoryBandwidthMult: 1.014 } },
      { tier: 4, slug: 'soc_smp_mesi', name: 'MESI Dual-Socket Cache Coherence', summary: 'Hardware snoop protocol unlocks symmetric multiprocessing across multiple cores.', effects: { ipcBonusMult: 1.016 } },
      { tier: 6, slug: 'soc_hyper_io', name: 'Point-to-Point Coherent Interconnect', summary: 'Packetized serial links replace slow shared front-side buses.', effects: { memoryBandwidthMult: 1.018 } },
      { tier: 11, slug: 'soc_turbo_alg', name: 'Thermal-Velocity Dynamic Boost', summary: 'Opportunistically raises single-core clocks when thermal headroom is available.', effects: { clockHeadroomMult: 1.01 } },
      { tier: 13, slug: 'soc_qos_llc', name: 'Cache Allocation & Bandwidth QoS', summary: 'Prevents noisy background threads from evicting latency-critical L3 data.', effects: { ipcBonusMult: 1.015, memoryBandwidthMult: 1.015 } },
      { tier: 16, slug: 'soc_snoop_dir', name: 'Scalable Home-Agent Snoop Filter', summary: 'Tracks shared cache lines cleanly across 100+ cores without broadcast storms.', effects: { ipcBonusMult: 1.018, memoryBandwidthMult: 1.018 } },
      { tier: 20, slug: 'soc_chiplets_mix', name: 'Mixed-Node Heterogeneous Chiplets', summary: 'Pairs Angstrom P-cores with dense mature-node E-cores on one interposer.', effects: { fabThroughputMult: 1.025, defectReductionMult: 0.985 } },
      { tier: 22, slug: 'soc_ai_pmu', name: 'Neural On-Die Power Management Unit', summary: 'Predicts workload phase transitions 100 μs ahead to pre-position voltage rails.', effects: { clockHeadroomMult: 1.012, leakageReductionMult: 0.985 } },
      { tier: 24, slug: 'soc_cryo_noc', name: 'Superconducting Flux-Pulse NoC', summary: 'Ballistic zero-resistance chiplet links slash multi-die synchronization overhead.', effects: { clockHeadroomMult: 1.012, ipcBonusMult: 1.02 } },
      { tier: 26, slug: 'soc_exascale', name: 'Autonomous Civilization Compute Fabric', summary: 'Self-healing wafer-scale optical clusters unify CPUs, GPUs, and SCM seamlessly.', effects: { ipcBonusMult: 1.028, rpGenerationMult: 1.05 } },
    ],
  },
  // GPU refinements (fills rows 1 & 2 -> total ~76 GPU nodes)
  {
    lane: 'gpu',
    category: 'gpu',
    subRow: 1,
    prefix: 'gpu_rt_ref',
    entries: [
      { tier: 1, slug: 'gpu_line_dda', name: 'Hardware Bresenham Line Rasterizer', summary: 'Dedicated vector line-drawing ASIC accelerates CAD wireframes and UI grids.', effects: { gpuComputeMult: 1.015 } },
      { tier: 3, slug: 'gpu_mip_tri', name: 'Trilinear Mipmap Pyramid Engines', summary: 'Pre-filtered texture pyramids double cache hit rates and smooth distant motion.', effects: { gpuComputeMult: 1.016, memoryBandwidthMult: 1.014 } },
      { tier: 5, slug: 'gpu_msaa_rop', name: 'Multisample Anti-Aliasing ROPs', summary: 'Hardware sub-pixel coverage masks smooth polygon edges at low bandwidth cost.', effects: { gpuComputeMult: 1.018 } },
      { tier: 7, slug: 'gpu_geom_shd', name: 'Hardware Geometry Shader Stage', summary: 'Generates shadow volumes and point sprites directly inside the GPU pipeline.', effects: { gpuComputeMult: 1.018 } },
      { tier: 9, slug: 'gpu_shared_lds', name: 'Banked Local Data Share (LDS) SRAM', summary: 'Ultra-fast on-CU scratchpad memory unlocks parallel FFT and physics reductions.', effects: { gpuComputeMult: 1.02, sramDensityMult: 1.015 } },
      { tier: 11, slug: 'gpu_fp16_pack', name: 'Packed Rapid-Math FP16×2 ALUs', summary: 'Runs two 16-bit floating-point operations per 32-bit shader lane.', effects: { gpuComputeMult: 1.02 } },
      { tier: 12, slug: 'gpu_preempt', name: 'Pixel-Level Asynchronous Preemption', summary: 'Switches compute and render contexts mid-frame for ultra-low VR and real-time latency.', effects: { gpuComputeMult: 1.018 } },
      { tier: 21, slug: 'gpu_neural_rad', name: 'Hardware Neural Radiance Caches', summary: 'Trains tiny per-frame lighting networks on Tensor cores for instant global illumination.', effects: { gpuComputeMult: 1.024 } },
      { tier: 24, slug: 'gpu_wave_rt', name: 'Coherent Wave-Optics Ray Solvers', summary: 'Simulates physical diffraction and spectral dispersion directly in hardware.', effects: { gpuComputeMult: 1.026 } },
      { tier: 26, slug: 'gpu_qtensor', name: 'Hybrid Topological-Optical Tensor Arrays', summary: 'Unlocks exa-scale parallel tensor contraction for post-silicon science.', effects: { gpuComputeMult: 1.032, rpGenerationMult: 1.04 } },
    ],
  },
  {
    lane: 'gpu',
    category: 'gpu',
    subRow: 2,
    prefix: 'gpu_bw_ref',
    entries: [
      { tier: 1, slug: 'gpu_ramdac', name: 'Integrated Dual-Channel RAMDAC', summary: 'High-speed display scanout frees VRAM cycles for active drawing.', effects: { memoryBandwidthMult: 1.014 } },
      { tier: 2, slug: 'gpu_tile_mem', name: 'Tiled 2D Framebuffer Swizzling', summary: 'Arranges neighboring 2D pixels in adjacent DRAM rows to maximize burst hits.', effects: { memoryBandwidthMult: 1.016 } },
      { tier: 4, slug: 'gpu_tex_dxt', name: 'Hardware Block Texture Compression', summary: 'Decodes 4:1 compressed textures on-the-fly inside TMUs, quadrupling effective VRAM.', effects: { memoryBandwidthMult: 1.018 } },
      { tier: 5, slug: 'gpu_crossbar', name: 'Multi-Channel GPU Memory Crossbar', summary: 'Replaces single wide buses with independent 64-bit controllers for 35% higher efficiency.', effects: { memoryBandwidthMult: 1.018 } },
      { tier: 7, slug: 'gpu_z_cull', name: 'Coarse-Tile Occlusion Culling', summary: 'Skips entire 16×16 screen tiles hidden behind foreground geometry.', effects: { gpuComputeMult: 1.018, memoryBandwidthMult: 1.016 } },
      { tier: 9, slug: 'gpu_bc7_astc', name: 'Adaptive ASTC / BC7 Texture Decoders', summary: 'High-precision block compression saves 60% texture bandwidth on HDR assets.', effects: { memoryBandwidthMult: 1.018 } },
      { tier: 11, slug: 'gpu_unified_vm', name: 'Unified GPU Virtual Memory Paging', summary: 'Demand-pages multi-terabyte datasets seamlessly across host RAM and VRAM.', effects: { memoryBandwidthMult: 1.018, gpuComputeMult: 1.015 } },
      { tier: 13, slug: 'gpu_gds_io', name: 'GPU-Direct NVMe Storage Bypass', summary: 'Streams compressed textures straight from NVMe SSDs into VRAM without CPU copies.', effects: { memoryBandwidthMult: 1.02 } },
      { tier: 17, slug: 'gpu_hw_decomp', name: 'Hardware Asset Decompression Engines', summary: 'Dedicated silicon unpacks 100+ GB/s geometry and tensor weights straight into L2.', effects: { memoryBandwidthMult: 1.022 } },
      { tier: 18, slug: 'gpu_hbm_ecc', name: 'Inline HBM Chipkill ECC Fabric', summary: 'Zero-overhead error correction keeps thousand-GPU training clusters fault-free.', effects: { defectReductionMult: 0.985, memoryBandwidthMult: 1.018 } },
      { tier: 20, slug: 'gpu_3d_l2', name: '3D Hybrid-Bonded GPU L2 SRAM', summary: 'Stacks 512+ MB of wide L2 cache directly beneath shader compute dies.', effects: { sramDensityMult: 1.024, memoryBandwidthMult: 1.024 } },
      { tier: 22, slug: 'gpu_cxl_pool', name: 'Coherent CXL Disaggregated VRAM', summary: 'Pools terabytes of persistent storage-class memory for trillion-parameter models.', effects: { memoryBandwidthMult: 1.025 } },
      { tier: 24, slug: 'gpu_opt_mesh', name: 'All-Optical Collective AllReduce Switch', summary: 'Performs gradient reductions directly in optical switches between GPU chiplets.', effects: { gpuComputeMult: 1.026, memoryBandwidthMult: 1.026 } },
      { tier: 26, slug: 'gpu_zero_heat', name: 'Adiabatic Photonic Memory Bus', summary: 'Transfers exabytes per second between optical cubes and tensor cores near zero heat.', effects: { memoryBandwidthMult: 1.032, coolingEfficiencyMult: 1.025 } },
    ],
  },
  // Memory refinements (fills rows 1 & 2 -> total ~76 Memory nodes)
  {
    lane: 'memory',
    category: 'memory',
    subRow: 1,
    prefix: 'mem_nand_ref',
    entries: [
      { tier: 17, slug: 'vnand_256l', name: '256-Layer High-Speed 2.4 GT/s V-NAND', summary: 'Pushes multi-plane vertical NAND I/O speed to saturate PCIe Gen 5/6 NVMe arrays.', effects: { memoryBandwidthMult: 1.022, sramDensityMult: 1.02 } },
      { tier: 19, slug: 'plc_shaping', name: 'Asymmetric PLC Pulse Shaping', summary: 'Precision incremental step-pulse programming tightens 32-level cell voltage windows.', effects: { defectReductionMult: 0.984, sramDensityMult: 1.02 } },
      { tier: 21, slug: 'cryo_etch_1k', name: 'Sub-Zero 150:1 Aspect Channel Etch', summary: 'Carves micron-deep memory holes without bowing across triple-deck NAND stacks.', effects: { defectReductionMult: 0.982, fabThroughputMult: 1.02 } },
      { tier: 23, slug: 'fe_nand', name: 'Ferroelectric 3D FeNAND Strings', summary: 'Replaces high-voltage charge trapping with low-voltage ferroelectric switching for 10× endurance.', effects: { leakageReductionMult: 0.982, sramDensityMult: 1.024 } },
      { tier: 25, slug: 'atomic_flash', name: 'Atomic-Layer Multi-State Storage', summary: 'Monolayer oxide memory cells pack exabytes into fingernail-sized solid-state dies.', effects: { sramDensityMult: 1.028, memoryBandwidthMult: 1.026 } },
      { tier: 26, slug: 'holo_archive', name: 'Self-Healing Volumetric Storage Vaults', summary: 'Combines optical cubes with hardware quantum-parity ECC for millennial retention.', effects: { sramDensityMult: 1.03, defectReductionMult: 0.98 } },
    ],
  },
  {
    lane: 'memory',
    category: 'memory',
    subRow: 2,
    prefix: 'mem_scm_ref',
    entries: [
      { tier: 1, slug: 'parity_bit', name: 'Byte-Wide Hardware Parity Checking', summary: 'Detects single-bit memory corruption cleanly on early mainframe and workstation buses.', effects: { defectReductionMult: 0.989 } },
      { tier: 3, slug: 'burst_pref', name: '2n Prefetch Sense-Amp Pipelines', summary: 'Pre-fetches wider internal array rows to feed faster external memory pins.', effects: { memoryBandwidthMult: 1.016 } },
      { tier: 5, slug: 'dll_sync', name: 'On-Die Delay-Locked Loops (DLL)', summary: 'Aligns DQ data strobes precisely with host clock edges for high-speed DDR.', effects: { memoryBandwidthMult: 1.018, clockHeadroomMult: 1.006 } },
      { tier: 7, slug: 'chipkill', name: 'Chipkill Multi-Symbol DRAM ECC', summary: 'Survives complete failure of an entire DRAM chip without crashing the system.', effects: { defectReductionMult: 0.985 } },
      { tier: 9, slug: 'temp_ref', name: 'Temperature-Compensated Self-Refresh', summary: 'Dynamically slows DRAM refresh intervals when dies run cool, cutting idle power 30%.', effects: { leakageReductionMult: 0.986 } },
      { tier: 10, slug: 'onfi_cache', name: 'Multi-Plane Interleaved Page Buffers', summary: 'Programs 4–8 independent NAND planes simultaneously to quadruple SSD write speed.', effects: { memoryBandwidthMult: 1.02 } },
      { tier: 12, slug: 'zns_zones', name: 'Zoned-Namespace (ZNS) SSD Fabric', summary: 'Aligns host writes with physical erase blocks, cutting write amplification to 1.0×.', effects: { memoryBandwidthMult: 1.018, fabThroughputMult: 1.015 } },
      { tier: 15, slug: 'cxl_type3', name: 'CXL 3.0 Memory Expander PHYs', summary: 'Attaches poolable DRAM and SCM racks over PCIe lanes with cache-line granularity.', effects: { memoryBandwidthMult: 1.022 } },
      { tier: 16, slug: 'pim_dram', name: 'Bank-Level Processing-in-DRAM', summary: 'Places compact SIMD units beside DRAM sense amps for 4× faster vector scans.', effects: { memoryBandwidthMult: 1.022, gpuComputeMult: 1.015 } },
      { tier: 18, slug: 'pcm_selector', name: 'Ovonic Threshold Switch Selectors', summary: 'Eliminates sneak-path currents in dense cross-point phase-change memory stacks.', effects: { leakageReductionMult: 0.984, sramDensityMult: 1.02 } },
      { tier: 20, slug: 'mram_pmtj', name: 'Perpendicular Magnetic Tunnel Junctions', summary: 'Scales MRAM bitcells below 15 nm with 10-year thermal data retention.', effects: { sramDensityMult: 1.022, leakageReductionMult: 0.984 } },
      { tier: 22, slug: 'comp_ssd', name: 'Computational Storage Accelerators', summary: 'Runs database filtering and AI embeddings directly inside enterprise SSD controllers.', effects: { memoryBandwidthMult: 1.024, ipcBonusMult: 1.014 } },
      { tier: 24, slug: 'skyrmion_mem', name: 'Magnetic Skyrmion Racetrack Memory', summary: 'Shifts topological spin textures along vertical nanowires at terabit density.', effects: { sramDensityMult: 1.026, leakageReductionMult: 0.98 } },
      { tier: 26, slug: 'qmem_coher', name: 'Coherent Optical-Spin Universal Memory', summary: 'Unifies sub-nanosecond volatile speed with non-volatile archival persistence.', effects: { memoryBandwidthMult: 1.032, leakageReductionMult: 0.976 } },
    ],
  },
  // Packaging, Thermal & Infrastructure refinements (fills rows 0, 1, 2 -> total ~72 Packaging nodes)
  {
    lane: 'packaging',
    category: 'support',
    subRow: 0,
    prefix: 'pkg_ref',
    entries: [
      { tier: 3, slug: 'leadframe', name: 'Copper-Alloy Leadframe Stamping', summary: 'Replaces iron-nickel leadframes with high-conductivity copper for cooler QFP chips.', effects: { coolingEfficiencyMult: 1.016, fabThroughputMult: 1.015 } },
      { tier: 5, slug: 'underfill', name: 'Capillary Epoxy Flip-Chip Underfill', summary: 'Absorbs thermal expansion shear between silicon die and organic substrate.', effects: { defectReductionMult: 0.986 } },
      { tier: 7, slug: 'mcm_ceramic', name: 'Multi-Chip Module (MCM) Carriers', summary: 'Mounts CPU and fast cache dies side-by-side inside a single package.', effects: { memoryBandwidthMult: 1.016, defectReductionMult: 0.988 } },
      { tier: 10, slug: 'tsv_first', name: 'Via-Middle Copper TSV Etching', summary: 'Drills vertical micron-wide vias through silicon dies to lay the foundation for 3D stacks.', effects: { memoryBandwidthMult: 1.018 } },
      { tier: 13, slug: 'pop_stack', name: 'Package-on-Package (PoP) DRAM Stacking', summary: 'Mounts mobile DRAM directly atop SoC packages for ultra-short trace lengths.', effects: { memoryBandwidthMult: 1.018, coolingEfficiencyMult: 1.014 } },
      { tier: 15, slug: 'molded_if', name: 'Warpage-Controlled Molded Interposers', summary: 'Prevents reticle-scale 2.5D interposer bowing during high-temp reflow.', effects: { defectReductionMult: 0.983, fabThroughputMult: 1.02 } },
      { tier: 18, slug: 'active_int', name: 'Active Logic-Bearing Silicon Interposer', summary: 'Embeds power delivery, NoC switches, and SRAM directly inside the interposer die.', effects: { memoryBandwidthMult: 1.022, logicDensityMult: 1.016 } },
      { tier: 21, slug: 'opt_interp', name: 'Photonic Interposer Waveguide Base', summary: 'Routes chiplet-to-chiplet terabit optical buses cleanly inside the package base.', effects: { memoryBandwidthMult: 1.026 } },
      { tier: 23, slug: 'panel_plp', name: '600 mm Square Panel-Level Packaging', summary: 'Replaces circular carrier wafers with square glass panels to triple OSAT throughput.', effects: { fabThroughputMult: 1.04 } },
      { tier: 25, slug: 'self_align_3d', name: 'Fluidic Self-Assembly Chiplet Placement', summary: 'Capillary micro-droplets align 10,000 micro-chiplets simultaneously in seconds.', effects: { fabThroughputMult: 1.04, defectReductionMult: 0.98 } },
    ],
  },
  {
    lane: 'packaging',
    category: 'support',
    subRow: 1,
    prefix: 'thm_ref',
    entries: [
      { tier: 2, slug: 'extruded_al', name: 'High-Aspect Extruded Aluminum Fins', summary: 'Increases convective surface area 60% inside compact early enclosures.', effects: { coolingEfficiencyMult: 1.016 } },
      { tier: 4, slug: 'pwm_blower', name: 'Closed-Loop PWM Thermal Fan Control', summary: 'Matches airflow dynamically to junction sensors for stable sustained clocks.', effects: { coolingEfficiencyMult: 1.018 } },
      { tier: 6, slug: 'copper_slug', name: 'Bonded Copper-Core Heat Spreaders', summary: 'Rapidly diffuses localized ALU hotspots across the full heatsink footprint.', effects: { coolingEfficiencyMult: 1.018 } },
      { tier: 8, slug: 'dual_tower', name: 'Dual-Tower Vapor-Fin Heat Exchangers', summary: 'Sustains 150 W desktop and workstation packages on quiet air cooling.', effects: { coolingEfficiencyMult: 1.02 } },
      { tier: 10, slug: 'coldplate_v1', name: 'Skived-Copper AIO Liquid Coldplates', summary: 'Moves heat out of dense server blades to remote high-capacity radiators.', effects: { coolingEfficiencyMult: 1.022 } },
      { tier: 12, slug: 'thermal_via', name: 'Dummy Copper Thermal Via Pillars', summary: 'Conducts vertical heat straight through multi-layer dielectric stacks to the IHS.', effects: { coolingEfficiencyMult: 1.02 } },
      { tier: 14, slug: 'dielectric_1p', name: 'Single-Phase Dielectric Oil Immersion', summary: 'Uniformly bathes entire server boards in non-conductive cooling fluid.', effects: { coolingEfficiencyMult: 1.024 } },
      { tier: 17, slug: 'sinter_boil', name: 'Micro-Porous Boiling Enhancement Coating', summary: 'Nanostructured copper nucleation sites raise two-phase critical heat flux 50%.', effects: { coolingEfficiencyMult: 1.026 } },
      { tier: 19, slug: 'backside_cool', name: 'Dual-Sided Top-and-Bottom Coldplates', summary: 'Extracts heat simultaneously from both sides of ultra-high-wattage 3D packages.', effects: { coolingEfficiencyMult: 1.028 } },
      { tier: 21, slug: 'ln2_rack', name: '77K Closed-Loop Liquid Nitrogen Racks', summary: 'Industrial sub-zero cooling doubles carrier mobility and cuts leakage 10×.', effects: { coolingEfficiencyMult: 1.03, leakageReductionMult: 0.982 } },
      { tier: 23, slug: 'diamond_via', name: 'Synthetic Diamond Thermal Substrates', summary: 'Integrates diamond heat pipes directly beneath 3D stacked chiplets.', effects: { coolingEfficiencyMult: 1.032 } },
      { tier: 25, slug: 'superfluid_he', name: 'Superfluid Helium-II Phonon Loops', summary: 'Zero-viscosity quantum heat transport eliminates hotspots across cryo super-nodes.', effects: { coolingEfficiencyMult: 1.036 } },
    ],
  },
  {
    lane: 'packaging',
    category: 'support',
    subRow: 2,
    prefix: 'lab_ref',
    entries: [
      { tier: 1, slug: 'bench_scope', name: 'Storage Oscilloscope & Logic Analyzers', summary: 'High-bandwidth diagnostic benches cut early chip debug time in half.', effects: { rpGenerationMult: 1.04 } },
      { tier: 4, slug: 'drc_lvs', name: 'Automated DRC & LVS Mask Verification', summary: 'Catches spacing and connectivity errors automatically before mask tape-out.', effects: { rpGenerationMult: 1.045, defectReductionMult: 0.99 } },
      { tier: 6, slug: 'ate_tester', name: 'High-Speed Automated Test Equipment', summary: 'Screens thousands of packaged dies per hour with deterministic scan chains.', effects: { fabThroughputMult: 1.022, defectReductionMult: 0.988 } },
      { tier: 9, slug: 'sta_signoff', name: 'Statistical Static Timing Analysis', summary: 'Models process variation distributions to tighten clock guard-bands.', effects: { clockHeadroomMult: 1.008, rpGenerationMult: 1.045 } },
      { tier: 11, slug: 'bist_scan', name: 'Built-In Self-Test & Yield Learning', summary: 'On-die test compression triples OSAT test throughput while feeding defect maps to fabs.', effects: { fabThroughputMult: 1.025, defectReductionMult: 0.986 } },
      { tier: 13, slug: 'hpc_eda', name: 'Cluster-Scale Parallel EDA Farms', summary: 'Distributes routing, extraction, and signoff across internal compute clusters.', effects: { rpGenerationMult: 1.055 } },
      { tier: 15, slug: 'slt_burn', name: 'System-Level Thermal Stress Binning', summary: 'Sorts top-bin silicon cleanly into high-clock and low-power voltage bands.', effects: { clockHeadroomMult: 1.009, defectReductionMult: 0.986 } },
      { tier: 16, slug: 'ml_place', name: 'Deep-RL Macro Floorplan Synthesis', summary: 'Machine-learning placement shortens critical wire lengths by 12%.', effects: { logicDensityMult: 1.018, rpGenerationMult: 1.055 } },
      { tier: 19, slug: 'digital_fab', name: 'End-to-End Autonomous Fab Scheduling', summary: 'AI lot dispatching maximizes cleanroom tool utilization across every process node.', effects: { fabThroughputMult: 1.035, siliconRefiningMult: 1.04 } },
      { tier: 22, slug: 'multi_phys', name: 'Coupled Electro-Thermal-Mechanical EDA', summary: 'Simulates warpage, IR drop, and 3D hotspots simultaneously before first silicon.', effects: { rpGenerationMult: 1.065, coolingEfficiencyMult: 1.02 } },
      { tier: 26, slug: 'post_si_uni', name: 'Civilization-Scale Foundry Institute', summary: 'Unifies atomic physics, photonics, and autonomous fabs into a self-evolving R&D engine.', effects: { rpGenerationMult: 1.12, fabThroughputMult: 1.05 } },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// ASSEMBLE COMPLETE 7-LANE × 26-TIER TECH TREE DAG (530+ NODES)
// ═══════════════════════════════════════════════════════════════════════════════

function buildExpandedTechTree(): TechNode[] {
  const allNodes: TechNode[] = [
    // Lane 1: Fabrication & Process Nodes
    ...buildTrackNodes('fabrication', 'fabrication', 0, FAB_ROW0_NODES),
    ...buildTrackNodes('fabrication', 'fabrication', 1, FAB_ROW1_INTERCONNECT),
    ...buildTrackNodes('fabrication', 'fabrication', 2, FAB_ROW2_ALD_PROCESS),
    ...buildTrackNodes('fabrication', 'fabrication', 3, FAB_ROW3_SILICON_CLEANROOM),

    // Lane 2: Lithography & Metrology
    ...buildTrackNodes('lithography', 'fabrication', 0, LITHO_ROW0_OPTICS),
    ...buildTrackNodes('lithography', 'fabrication', 1, LITHO_ROW1_METROLOGY),
    ...buildTrackNodes('lithography', 'fabrication', 2, LITHO_ROW2_RESIST_MASK),

    // Lane 3: Transistor Physics & Materials
    ...buildTrackNodes('transistors', 'fabrication', 0, TRANS_ROW0_CHANNELS),
    ...buildTrackNodes('transistors', 'fabrication', 1, TRANS_ROW1_MATERIALS),
    ...buildTrackNodes('transistors', 'fabrication', 2, TRANS_ROW2_RELIABILITY),

    // Lane 4: CPU Microarchitecture & ISA
    ...buildTrackNodes('cpu', 'cpu', 0, CPU_ROW0_CORE),
    ...buildTrackNodes('cpu', 'cpu', 1, CPU_ROW1_BRANCH_CACHE),
    ...buildTrackNodes('cpu', 'cpu', 2, CPU_ROW2_ISA_VECTOR),
    ...buildTrackNodes('cpu', 'cpu', 3, CPU_ROW3_SOC_FABRIC),

    // Lane 5: GPU & Parallel Compute
    ...buildTrackNodes('gpu', 'gpu', 0, GPU_ROW0_PIPELINE),
    ...buildTrackNodes('gpu', 'gpu', 1, GPU_ROW1_RT_TENSOR),
    ...buildTrackNodes('gpu', 'gpu', 2, GPU_ROW2_BANDWIDTH_VRAM),

    // Lane 6: Memory & Storage Systems
    ...buildTrackNodes('memory', 'memory', 0, MEM_ROW0_DRAM_VRAM),
    ...buildTrackNodes('memory', 'memory', 1, MEM_ROW1_ROM_NAND),
    ...buildTrackNodes('memory', 'memory', 2, MEM_ROW2_SCM_EMERGING),

    // Lane 7: Packaging, Thermal & Fab Infrastructure
    ...buildTrackNodes('packaging', 'support', 0, PKG_ROW0_PACKAGING),
    ...buildTrackNodes('packaging', 'support', 1, PKG_ROW1_THERMAL),
    ...buildTrackNodes('packaging', 'support', 2, PKG_ROW2_IO_LABS),
  ];

  // Track occupied (lane, subRow, tier) cells to guarantee 0 overlapping coordinates
  const occupied = new Set<string>();
  const rowNodes = new Map<string, TechNode[]>();
  const registerNode = (n: TechNode) => {
    const laneMeta = TECH_LANE_MAP[n.lane];
    const subRow = laneMeta.rowYs.indexOf(n.y);
    occupied.add(`${n.lane}:${subRow}:${n.tier}`);
    const rowKey = `${n.lane}:${subRow}`;
    const list = rowNodes.get(rowKey) ?? [];
    list.push(n);
    rowNodes.set(rowKey, list);
  };
  for (const n of allNodes) {
    registerNode(n);
  }

  // Merge parametric refinements cleanly into open (lane, subRow, tier) cells
  // and connect each refinement to the closest earlier-tier node in its row (or spine row 0)
  for (const group of PARAMETRIC_REFINEMENTS) {
    for (const entry of group.entries) {
      const cellKey = `${group.lane}:${group.subRow}:${entry.tier}`;
      if (occupied.has(cellKey)) continue;

      const rowKey = `${group.lane}:${group.subRow}`;
      const sameRowEarlier = (rowNodes.get(rowKey) ?? [])
        .filter((n) => n.tier < entry.tier)
        .sort((a, b) => b.tier - a.tier);
      const spineEarlier = (rowNodes.get(`${group.lane}:0`) ?? [])
        .filter((n) => n.tier < entry.tier)
        .sort((a, b) => b.tier - a.tier);

      const prereqs: string[] = [];
      if (sameRowEarlier.length > 0) {
        prereqs.push(sameRowEarlier[0].id);
      } else if (spineEarlier.length > 0) {
        prereqs.push(spineEarlier[0].id);
      }

      const node: TechNode = {
        id: `${group.prefix}_${entry.slug}`,
        name: entry.name,
        category: entry.tier >= 23 ? 'frontier' : group.category,
        lane: group.lane,
        tier: entry.tier,
        rpCost: tierRpCost(entry.tier, 0.92),
        prerequisites: prereqs,
        x: tierX(entry.tier),
        y: laneY(group.lane, group.subRow),
        summary: entry.summary,
        unlocksSummary: formatEffectsSummary(entry.effects),
        effects: entry.effects,
      };
      allNodes.push(node);
      registerNode(node);
    }
  }

  // Sort deterministically by tier, then lane order, then y coordinate
  const laneOrder = new Map(TECH_LANES.map((l, idx) => [l.id, idx]));
  allNodes.sort(
    (a, b) =>
      a.tier - b.tier ||
      (laneOrder.get(a.lane) ?? 0) - (laneOrder.get(b.lane) ?? 0) ||
      a.y - b.y
  );

  return allNodes;
}

export const GENERATED_TECH_TREE: TechNode[] = buildExpandedTechTree();
export const TECH_NODE_MAP: Map<string, TechNode> = new Map(
  GENERATED_TECH_TREE.map((t) => [t.id, t])
);
