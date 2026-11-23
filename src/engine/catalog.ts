/**
 * Semiconductor Empire — Complete Engineering & Technology Catalog.
 * Pure data & lookup helpers — zero React/DOM dependencies.
 * Zero historical date locks: every technology is unlocked purely via player R&D.
 */

import type {
  CoolingSpec,
  CpuArchSpec,
  FacilityKind,
  FrontierTrackSpec,
  GpuArchSpec,
  IsaExtensionSpec,
  LithographySpec,
  MemoryCategory,
  MemoryCellArchSpec,
  MemoryInterfaceSpec,
  MemoryTechSpec,
  PackagingSpec,
  ProcessNodeSpec,
  TechModifiers,
  TechNode,
  TransistorStructureSpec,
} from './types';
import {
  GENERATED_TECH_TREE,
  TECH_CANVAS_HEIGHT,
  TECH_CANVAS_WIDTH,
  TECH_COL_STEP,
  TECH_ERAS,
  TECH_LANES,
  TECH_LANE_MAP,
  TECH_NODE_H,
  TECH_NODE_MAP,
  TECH_NODE_W,
  TECH_START_X,
} from './techTreeGenerator';

export {
  TECH_CANVAS_HEIGHT,
  TECH_CANVAS_WIDTH,
  TECH_COL_STEP,
  TECH_ERAS,
  TECH_LANES,
  TECH_LANE_MAP,
  TECH_NODE_H,
  TECH_NODE_W,
  TECH_START_X,
};

export const PROCESS_NODES: ProcessNodeSpec[] = [
  {
    id: 'node_10000nm',
    name: '10 μm Primitive Planar',
    featureSizeNm: 10000,
    eraLabel: 'Foundation Era',
    logicDensityMTrPerMm2: 0.0025,
    sramDensityMTrPerMm2: 0.0018,
    nominalVoltageV: 5.0,
    refClockGHz: 0.012,
    capacitanceFactor: 6.5,
    leakageCoeff: 0.018,
    tunnelingFloorWPerMTr: 0,
    baseDefectDensity: 0.85,
    siliconPerWafer: 4,
    powerMWPer100Wafers: 1.5,
    paradigm: 'none',
  },
  {
    id: 'node_3000nm',
    name: '3.0 μm Optical MOS',
    featureSizeNm: 3000,
    eraLabel: 'Early LSI',
    logicDensityMTrPerMm2: 0.022,
    sramDensityMTrPerMm2: 0.015,
    nominalVoltageV: 4.2,
    refClockGHz: 0.055,
    capacitanceFactor: 3.1,
    leakageCoeff: 0.014,
    tunnelingFloorWPerMTr: 0,
    baseDefectDensity: 0.72,
    siliconPerWafer: 6,
    powerMWPer100Wafers: 2.2,
    paradigm: 'none',
    requiredTechId: 'fab_3000nm',
  },
  {
    id: 'node_1000nm',
    name: '1.0 μm CMOS Stepper',
    featureSizeNm: 1000,
    eraLabel: 'VLSI Dawn',
    logicDensityMTrPerMm2: 0.18,
    sramDensityMTrPerMm2: 0.12,
    nominalVoltageV: 3.3,
    refClockGHz: 0.18,
    capacitanceFactor: 1.35,
    leakageCoeff: 0.01,
    tunnelingFloorWPerMTr: 0,
    baseDefectDensity: 0.62,
    siliconPerWafer: 9,
    powerMWPer100Wafers: 3.4,
    paradigm: 'none',
    requiredTechId: 'fab_1000nm',
  },
  {
    id: 'node_350nm',
    name: '350 nm Deep Optical',
    featureSizeNm: 350,
    eraLabel: 'Sub-Micron',
    logicDensityMTrPerMm2: 1.2,
    sramDensityMTrPerMm2: 0.85,
    nominalVoltageV: 2.5,
    refClockGHz: 0.55,
    capacitanceFactor: 0.62,
    leakageCoeff: 0.006,
    tunnelingFloorWPerMTr: 0,
    baseDefectDensity: 0.54,
    siliconPerWafer: 13,
    powerMWPer100Wafers: 5.0,
    paradigm: 'none',
    requiredTechId: 'fab_350nm',
  },
  {
    id: 'node_130nm',
    name: '130 nm Copper Interconnect',
    featureSizeNm: 130,
    eraLabel: 'Gigahertz Era',
    logicDensityMTrPerMm2: 7.5,
    sramDensityMTrPerMm2: 5.2,
    nominalVoltageV: 1.5,
    refClockGHz: 1.85,
    capacitanceFactor: 0.24,
    leakageCoeff: 0.0028,
    tunnelingFloorWPerMTr: 0.0002,
    baseDefectDensity: 0.48,
    siliconPerWafer: 18,
    powerMWPer100Wafers: 7.5,
    paradigm: 'none',
    requiredTechId: 'fab_130nm',
  },
  {
    id: 'node_45nm',
    name: '45 nm Immersion DUV',
    featureSizeNm: 45,
    eraLabel: 'Multicore Age',
    logicDensityMTrPerMm2: 28,
    sramDensityMTrPerMm2: 18,
    nominalVoltageV: 1.15,
    refClockGHz: 3.2,
    capacitanceFactor: 0.095,
    leakageCoeff: 0.0014,
    tunnelingFloorWPerMTr: 0.0018,
    baseDefectDensity: 0.44,
    siliconPerWafer: 24,
    powerMWPer100Wafers: 11.5,
    paradigm: 'none',
    requiredTechId: 'fab_45nm',
  },
  {
    id: 'node_14nm',
    name: '14 nm Fin-Ready DUV',
    featureSizeNm: 14,
    eraLabel: '3D Gate Era',
    logicDensityMTrPerMm2: 78,
    sramDensityMTrPerMm2: 44,
    nominalVoltageV: 0.95,
    refClockGHz: 4.3,
    capacitanceFactor: 0.042,
    leakageCoeff: 0.00085,
    tunnelingFloorWPerMTr: 0.0042,
    baseDefectDensity: 0.4,
    siliconPerWafer: 32,
    powerMWPer100Wafers: 16.5,
    paradigm: 'none',
    requiredTechId: 'fab_14nm',
  },
  {
    id: 'node_5nm',
    name: '5 nm EUV Lithography',
    featureSizeNm: 5,
    eraLabel: 'Extreme UV',
    logicDensityMTrPerMm2: 185,
    sramDensityMTrPerMm2: 88,
    nominalVoltageV: 0.82,
    refClockGHz: 5.2,
    capacitanceFactor: 0.022,
    leakageCoeff: 0.00055,
    tunnelingFloorWPerMTr: 0.0095,
    baseDefectDensity: 0.38,
    siliconPerWafer: 44,
    powerMWPer100Wafers: 24,
    paradigm: 'none',
    requiredTechId: 'fab_5nm',
  },
  {
    id: 'node_2nm',
    name: '2 nm Nanosheet GAA',
    featureSizeNm: 2,
    eraLabel: 'Nanosheet Era',
    logicDensityMTrPerMm2: 340,
    sramDensityMTrPerMm2: 128,
    nominalVoltageV: 0.72,
    refClockGHz: 5.9,
    capacitanceFactor: 0.014,
    leakageCoeff: 0.00042,
    tunnelingFloorWPerMTr: 0.018,
    baseDefectDensity: 0.42,
    siliconPerWafer: 58,
    powerMWPer100Wafers: 34,
    paradigm: 'none',
    requiredTechId: 'fab_2nm',
  },
  {
    id: 'node_07nm',
    name: '0.7 nm Angstrom CFET',
    featureSizeNm: 0.7,
    eraLabel: 'Angstrom Era',
    logicDensityMTrPerMm2: 680,
    sramDensityMTrPerMm2: 205,
    nominalVoltageV: 0.62,
    refClockGHz: 6.8,
    capacitanceFactor: 0.009,
    leakageCoeff: 0.00038,
    tunnelingFloorWPerMTr: 0.036,
    baseDefectDensity: 0.52,
    siliconPerWafer: 76,
    powerMWPer100Wafers: 48,
    paradigm: 'none',
    requiredTechId: 'fab_07nm',
  },
  // Four distinct post-silicon Frontier Paradigm nodes with real engineering trade-offs
  {
    id: 'node_cryo_05nm',
    name: '0.5 nm Cryogenic Super-CMOS',
    featureSizeNm: 0.5,
    eraLabel: 'Frontier: Cryogenic',
    logicDensityMTrPerMm2: 920,
    sramDensityMTrPerMm2: 290,
    nominalVoltageV: 0.34,
    refClockGHz: 14.5,
    capacitanceFactor: 0.0052,
    leakageCoeff: 0.00012,
    tunnelingFloorWPerMTr: 0.012,
    baseDefectDensity: 0.58,
    siliconPerWafer: 92,
    powerMWPer100Wafers: 75,
    paradigm: 'cryogenic',
    requiredTechId: 'frontier_cryogenic',
  },
  {
    id: 'node_photonic_1nm',
    name: '1.0 nm Silicon-Photonic Mesh',
    featureSizeNm: 1.0,
    eraLabel: 'Frontier: Photonic',
    logicDensityMTrPerMm2: 460,
    sramDensityMTrPerMm2: 240,
    nominalVoltageV: 0.52,
    refClockGHz: 11.2,
    capacitanceFactor: 0.0038,
    leakageCoeff: 0.00018,
    tunnelingFloorWPerMTr: 0.004,
    baseDefectDensity: 0.46,
    siliconPerWafer: 88,
    powerMWPer100Wafers: 58,
    paradigm: 'photonic',
    requiredTechId: 'frontier_photonic',
  },
  {
    id: 'node_cnt_02nm',
    name: '0.2 nm 3D Monolithic CNT',
    featureSizeNm: 0.2,
    eraLabel: 'Frontier: Carbon 3D',
    logicDensityMTrPerMm2: 1850,
    sramDensityMTrPerMm2: 640,
    nominalVoltageV: 0.48,
    refClockGHz: 9.4,
    capacitanceFactor: 0.0058,
    leakageCoeff: 0.00024,
    tunnelingFloorWPerMTr: 0.015,
    baseDefectDensity: 0.88, // High CNT alignment defect challenge!
    siliconPerWafer: 105,
    powerMWPer100Wafers: 64,
    paradigm: 'cnt_3d',
    requiredTechId: 'frontier_cnt',
  },
  {
    id: 'node_topo_01nm',
    name: '0.1 nm Topological Hybrid',
    featureSizeNm: 0.1,
    eraLabel: 'Frontier: Topological',
    logicDensityMTrPerMm2: 2600,
    sramDensityMTrPerMm2: 920,
    nominalVoltageV: 0.38,
    refClockGHz: 12.8,
    capacitanceFactor: 0.0042,
    leakageCoeff: 0.00022,
    tunnelingFloorWPerMTr: 0.022,
    baseDefectDensity: 0.96, // Extreme defect & packaging complexity
    siliconPerWafer: 135,
    powerMWPer100Wafers: 92,
    paradigm: 'topological',
    requiredTechId: 'frontier_topological',
  },
];

export const TRANSISTOR_STRUCTURES: TransistorStructureSpec[] = [
  {
    id: 'trans_planar',
    name: 'Planar MOSFET',
    densityMultiplier: 1.0,
    leakageMultiplier: 1.0,
    tunnelingMitigation: 0.0,
    clockMultiplier: 1.0,
    defectMultiplier: 1.0,
    description: 'Conventional single-gate planar channel deposited on bulk silicon.',
    constraintNote: 'Suffers severe sub-threshold & quantum tunneling leakage below 45 nm.',
  },
  {
    id: 'trans_hkmg',
    name: 'High-k Metal Gate',
    densityMultiplier: 1.12,
    leakageMultiplier: 0.68,
    tunnelingMitigation: 0.32,
    clockMultiplier: 1.08,
    defectMultiplier: 1.04,
    description: 'Hafnium-based high-k dielectric replaces SiO2 to curb gate oxide leakage.',
    constraintNote: 'Slight process complexity increase (+4% defect sensitivity).',
    requiredTechId: 'fab_hkmg',
  },
  {
    id: 'trans_finfet',
    name: '3D FinFET',
    densityMultiplier: 1.38,
    leakageMultiplier: 0.46,
    tunnelingMitigation: 0.62,
    clockMultiplier: 1.16,
    defectMultiplier: 1.08,
    description: 'Tri-gate vertical silicon fin provides electrostatic channel control on 3 sides.',
    constraintNote: 'Quantized fin widths add routing constraint (+8% defect sensitivity).',
    requiredTechId: 'fab_finfet',
  },
  {
    id: 'trans_gaa',
    name: 'GAA Nanosheet',
    densityMultiplier: 1.7,
    leakageMultiplier: 0.32,
    tunnelingMitigation: 0.82,
    clockMultiplier: 1.24,
    defectMultiplier: 1.14,
    description: 'Gate-All-Around stacked horizontal nanosheets eliminate channel shorting.',
    constraintNote: 'Demands tight epitaxial etch precision (+14% defect sensitivity).',
    requiredTechId: 'fab_gaafet',
  },
  {
    id: 'trans_cfet',
    name: '3D Stacked CFET',
    densityMultiplier: 2.35,
    leakageMultiplier: 0.25,
    tunnelingMitigation: 0.9,
    clockMultiplier: 1.3,
    defectMultiplier: 1.22,
    description: 'Complementary n-FET stacked directly atop p-FET halves standard cell footprint.',
    constraintNote: 'Vertical stacking concentrates heat flux density and requires mature QA.',
    requiredTechId: 'fab_cfet',
  },
  {
    id: 'trans_ballistic_cnt',
    name: 'Ballistic CNT Channel',
    densityMultiplier: 3.1,
    leakageMultiplier: 0.2,
    tunnelingMitigation: 0.93,
    clockMultiplier: 1.45,
    defectMultiplier: 1.36,
    description: 'Aligned semiconducting carbon nanotubes enable ballistic carrier transport.',
    constraintNote: 'Metallic nanotube impurities raise defect density (+36%) without heavy QA.',
    requiredTechId: 'frontier_cnt',
  },
  {
    id: 'trans_photonic_gate',
    name: 'Electro-Optic Modulator',
    densityMultiplier: 1.55,
    leakageMultiplier: 0.14,
    tunnelingMitigation: 0.96,
    clockMultiplier: 1.52,
    defectMultiplier: 1.18,
    description: 'Micro-ring photonic resonators switch optical pulses with ultra-low dynamic loss.',
    constraintNote: 'Optical cavities occupy extra area and drift if junction temp exceeds 78 C.',
    requiredTechId: 'frontier_photonic',
  },
  {
    id: 'trans_cryo_josephson',
    name: 'Cryo-Hybrid Josephson',
    densityMultiplier: 2.1,
    leakageMultiplier: 0.08,
    tunnelingMitigation: 0.97,
    clockMultiplier: 1.75,
    defectMultiplier: 1.28,
    description: 'Superconducting flux logic coupled to deep-cryo CMOS registers.',
    constraintNote: 'Requires Cryogenic Cooling; thermal quench occurs rapidly above 15 C.',
    requiredTechId: 'frontier_cryogenic',
  },
];

export const LITHOGRAPHY_SPECS: LithographySpec[] = [
  {
    id: 'litho_contact',
    name: 'Contact Mask Aligner',
    defectMultiplier: 1.25,
    reticleLimitMm2: 260,
    powerOverheadMultiplier: 1.0,
  },
  {
    id: 'litho_stepper',
    name: 'Optical Projection Stepper',
    defectMultiplier: 0.92,
    reticleLimitMm2: 440,
    powerOverheadMultiplier: 1.15,
    requiredTechId: 'fab_stepper',
  },
  {
    id: 'litho_duv',
    name: '193 nm Immersion DUV',
    defectMultiplier: 0.72,
    reticleLimitMm2: 680,
    powerOverheadMultiplier: 1.35,
    requiredTechId: 'fab_duv',
  },
  {
    id: 'litho_euv',
    name: '13.5 nm EUV Scanner',
    defectMultiplier: 0.56,
    reticleLimitMm2: 858,
    powerOverheadMultiplier: 1.65,
    requiredTechId: 'fab_euv',
  },
  {
    id: 'litho_high_na',
    name: 'High-NA EUV 0.55',
    defectMultiplier: 0.44,
    reticleLimitMm2: 1050,
    powerOverheadMultiplier: 1.95,
    requiredTechId: 'fab_high_na',
  },
  {
    id: 'litho_xray_atomic',
    name: 'Atomic Direct-Write Beam',
    defectMultiplier: 0.34,
    reticleLimitMm2: 1600,
    powerOverheadMultiplier: 2.4,
    requiredTechId: 'frontier_atomic_litho',
  },
];

export const PACKAGING_SPECS: PackagingSpec[] = [
  {
    id: 'pkg_dip',
    name: 'Ceramic DIP',
    maxDieAreaMm2: 240,
    thermalResistanceOffset: 0.0,
    defectMultiplier: 1.0,
    interconnectBonus: 1.0,
    packagingLoadPerDie: 1,
    description: 'Basic dual in-line ceramic carrier with wire-bonded leads.',
  },
  {
    id: 'pkg_pga',
    name: 'Flip-Chip PGA / LGA',
    maxDieAreaMm2: 620,
    thermalResistanceOffset: 0.08,
    defectMultiplier: 0.96,
    interconnectBonus: 1.12,
    packagingLoadPerDie: 2,
    description: 'Solder-bump flip-chip mounting with integrated copper heat spreader.',
    requiredTechId: 'sup_packaging_flipchip',
  },
  {
    id: 'pkg_interposer',
    name: '2.5D Silicon Interposer',
    maxDieAreaMm2: 1450,
    thermalResistanceOffset: 0.14,
    defectMultiplier: 0.88, // Chiplet partitioning improves effective die yield!
    interconnectBonus: 1.38,
    packagingLoadPerDie: 4,
    description: 'Multi-die chiplet integration over high-density silicon interposer fabric.',
    requiredTechId: 'sup_packaging_25d',
  },
  {
    id: 'pkg_3d_wow',
    name: '3D Wafer-on-Wafer Hybrid Bond',
    maxDieAreaMm2: 2600,
    thermalResistanceOffset: 0.19,
    defectMultiplier: 0.82,
    interconnectBonus: 1.72,
    packagingLoadPerDie: 7,
    description: 'Direct copper-to-copper TSV vertical die stacking with ultra-low latency.',
    requiredTechId: 'sup_packaging_3d',
  },
  {
    id: 'pkg_optical_substrate',
    name: 'Photonic Glass Substrate',
    maxDieAreaMm2: 4200,
    thermalResistanceOffset: 0.24,
    defectMultiplier: 0.78,
    interconnectBonus: 2.25,
    packagingLoadPerDie: 12,
    description: 'Co-packaged optical waveguides embedded in rigid glass core substrate.',
    requiredTechId: 'frontier_photonic',
  },
];

export const COOLING_SPECS: CoolingSpec[] = [
  {
    id: 'cool_passive',
    name: 'Passive Aluminum Fin',
    ambientTempC: 28,
    thermalResistanceCPerW: 1.65,
    maxRecommendedTdpW: 25,
    throttleTempC: 92,
    carnotOverheadFactor: 0,
    description: 'Natural convection heatsink. Silent, zero auxiliary draw, severely limited TDP.',
  },
  {
    id: 'cool_air',
    name: 'Forced Air Axial Fan',
    ambientTempC: 26,
    thermalResistanceCPerW: 0.62,
    maxRecommendedTdpW: 85,
    throttleTempC: 95,
    carnotOverheadFactor: 0,
    description: 'Active airflow across extruded fins for mainstream desktop envelopes.',
    requiredTechId: 'sup_cooling_air',
  },
  {
    id: 'cool_heatpipe',
    name: 'Vapor-Chamber Copper Tower',
    ambientTempC: 25,
    thermalResistanceCPerW: 0.29,
    maxRecommendedTdpW: 220,
    throttleTempC: 98,
    carnotOverheadFactor: 0,
    description: 'Sintered copper heatpipes and vapor base spread high heat-flux hotspots.',
    requiredTechId: 'sup_cooling_vapor',
  },
  {
    id: 'cool_liquid',
    name: 'Direct-Die Microchannel Liquid',
    ambientTempC: 24,
    thermalResistanceCPerW: 0.145,
    maxRecommendedTdpW: 480,
    throttleTempC: 100,
    carnotOverheadFactor: 0.04,
    description: 'Closed-loop coolant pumped through micro-channels etched near the die.',
    requiredTechId: 'sup_cooling_liquid',
  },
  {
    id: 'cool_twophase',
    name: 'Two-Phase Immersion Array',
    ambientTempC: 22,
    thermalResistanceCPerW: 0.075,
    maxRecommendedTdpW: 950,
    throttleTempC: 102,
    carnotOverheadFactor: 0.12,
    description: 'Dielectric phase-change boiling removes extreme datacenter heat flux.',
    requiredTechId: 'sup_cooling_immersion',
  },
  {
    id: 'cool_cryogenic',
    name: 'Cryogenic Helium Microfluidic',
    ambientTempC: -120,
    thermalResistanceCPerW: 0.055,
    maxRecommendedTdpW: 1400,
    throttleTempC: 15, // Strict superconducting/cryo ceiling!
    carnotOverheadFactor: 0.72, // Steep Carnot refrigeration power cost!
    description: 'Sub-zero closed-cycle cryo chiller unlocking superconducting speeds at steep Carnot power cost.',
    requiredTechId: 'frontier_cryogenic',
  },
];

export const CPU_ARCHITECTURES: CpuArchSpec[] = [
  {
    id: 'cpu_scalar',
    name: 'Scalar In-Order',
    baseIpc: 0.65,
    maxIpcTuning: 1.05,
    pCoreMTr: 0.025,
    eCoreMTr: 0.015,
    clockEfficiency: 1.0,
    powerMultiplier: 1.0,
    interconnectContention: 0.14,
    maxPCores: 2,
    maxECores: 0,
    supportsECores: false,
    description: 'Single-issue sequential pipeline. Simple silicon, low transistor cost, modest IPC.',
  },
  {
    id: 'cpu_pipelined',
    name: 'Pipelined RISC',
    baseIpc: 1.15,
    maxIpcTuning: 1.25,
    pCoreMTr: 0.18,
    eCoreMTr: 0.09,
    clockEfficiency: 1.22,
    powerMultiplier: 1.08,
    interconnectContention: 0.1,
    maxPCores: 4,
    maxECores: 0,
    supportsECores: false,
    description: '5-stage overlapped instruction pipeline doubles throughput and clock headroom.',
    requiredTechId: 'cpu_pipelined',
  },
  {
    id: 'cpu_superscalar',
    name: 'Superscalar Dual-Issue',
    baseIpc: 1.95,
    maxIpcTuning: 1.35,
    pCoreMTr: 1.8,
    eCoreMTr: 0.75,
    clockEfficiency: 1.15,
    powerMultiplier: 1.22,
    interconnectContention: 0.07,
    maxPCores: 8,
    maxECores: 4,
    supportsECores: true,
    description: 'Multiple execution units dispatch parallel instructions per clock cycle.',
    requiredTechId: 'cpu_superscalar',
  },
  {
    id: 'cpu_ooo',
    name: 'Out-of-Order Speculative',
    baseIpc: 3.35,
    maxIpcTuning: 1.45,
    pCoreMTr: 16,
    eCoreMTr: 5.5,
    clockEfficiency: 1.18,
    powerMultiplier: 1.34,
    interconnectContention: 0.042,
    maxPCores: 32,
    maxECores: 16,
    supportsECores: true,
    description: 'Deep reorder buffer, register renaming, and branch prediction maximize instruction-level parallelism.',
    requiredTechId: 'cpu_ooo',
  },
  {
    id: 'cpu_hetero',
    name: 'Wide Heterogeneous Mesh',
    baseIpc: 5.2,
    maxIpcTuning: 1.55,
    pCoreMTr: 58,
    eCoreMTr: 16,
    clockEfficiency: 1.24,
    powerMultiplier: 1.42,
    interconnectContention: 0.02,
    maxPCores: 64,
    maxECores: 64,
    supportsECores: true,
    description: '6-wide P-cores paired with dense E-core clusters over coherent 2D mesh fabric.',
    requiredTechId: 'cpu_hetero',
  },
  {
    id: 'cpu_neural',
    name: 'Neural-Predicted Adaptive Core',
    baseIpc: 7.8,
    maxIpcTuning: 1.65,
    pCoreMTr: 135,
    eCoreMTr: 38,
    clockEfficiency: 1.28,
    powerMultiplier: 1.48,
    interconnectContention: 0.011,
    maxPCores: 128,
    maxECores: 128,
    supportsECores: true,
    description: 'Perceptron branch predictors and dynamic micro-op fusion sustain extreme IPC.',
    requiredTechId: 'cpu_neural',
  },
  {
    id: 'cpu_photonic_mesh',
    name: 'Optical Coherent Continuum',
    baseIpc: 11.4,
    maxIpcTuning: 1.75,
    pCoreMTr: 240,
    eCoreMTr: 70,
    clockEfficiency: 1.35,
    powerMultiplier: 1.32,
    interconnectContention: 0.0045,
    maxPCores: 256,
    maxECores: 256,
    supportsECores: true,
    description: 'Zero-hop optical waveguide cache coherence eliminates multicore mesh contention.',
    requiredTechId: 'frontier_photonic',
  },
  {
    id: 'cpu_topological',
    name: 'Topological Braided Execution',
    baseIpc: 15.8,
    maxIpcTuning: 1.85,
    pCoreMTr: 410,
    eCoreMTr: 110,
    clockEfficiency: 1.42,
    powerMultiplier: 1.55,
    interconnectContention: 0.003,
    maxPCores: 512,
    maxECores: 256,
    supportsECores: true,
    description: 'Hybrid deterministic-topological scheduling collapses dependency chains across threads.',
    requiredTechId: 'frontier_topological',
  },
];

export const GPU_ARCHITECTURES: GpuArchSpec[] = [
  {
    id: 'gpu_fixed',
    name: 'Fixed-Function Rasterizer',
    opsPerCorePerClock: 1.0,
    shaderMTrPerCore: 0.012,
    clockEfficiency: 0.85,
    powerMultiplier: 0.95,
    memoryCompression: 1.0,
    rayTracingFactor: 0.0,
    computeEfficiency: 0.18,
    maxShaderCores: 32,
    description: 'Hardwired transform and pixel shading pipeline. Minimal general compute capability.',
    requiredTechId: 'gpu_fixed_pipeline',
  },
  {
    id: 'gpu_unified',
    name: 'Unified Programmable Shader',
    opsPerCorePerClock: 2.0,
    shaderMTrPerCore: 0.045,
    clockEfficiency: 1.0,
    powerMultiplier: 1.12,
    memoryCompression: 1.15,
    rayTracingFactor: 0.08,
    computeEfficiency: 0.65,
    maxShaderCores: 512,
    description: 'Flexible scalar ALUs run vertex, pixel, and general parallel compute workloads.',
    requiredTechId: 'gpu_unified_shader',
  },
  {
    id: 'gpu_async_mesh',
    name: 'Tile-Based Async Compute',
    opsPerCorePerClock: 3.1,
    shaderMTrPerCore: 0.11,
    clockEfficiency: 1.14,
    powerMultiplier: 1.2,
    memoryCompression: 1.38,
    rayTracingFactor: 0.25,
    computeEfficiency: 0.92,
    maxShaderCores: 4096,
    description: 'Concurrent graphics/compute queues with lossless delta color compression.',
    requiredTechId: 'gpu_async_compute',
  },
  {
    id: 'gpu_ray_core',
    name: 'Ray-Accelerated Tensor Core',
    opsPerCorePerClock: 4.6,
    shaderMTrPerCore: 0.24,
    clockEfficiency: 1.22,
    powerMultiplier: 1.32,
    memoryCompression: 1.62,
    rayTracingFactor: 0.85,
    computeEfficiency: 1.28,
    maxShaderCores: 16384,
    description: 'Dedicated BVH ray traversal hardware and matrix tensor engines on every cluster.',
    requiredTechId: 'gpu_ray_tracing',
  },
  {
    id: 'gpu_neural_mesh',
    name: 'Neural Work-Graph Pipeline',
    opsPerCorePerClock: 6.8,
    shaderMTrPerCore: 0.42,
    clockEfficiency: 1.28,
    powerMultiplier: 1.38,
    memoryCompression: 1.92,
    rayTracingFactor: 1.35,
    computeEfficiency: 1.72,
    maxShaderCores: 32768,
    description: 'GPU-driven autonomous work graphs and hardware neural path reconstruction.',
    requiredTechId: 'gpu_neural_render',
  },
  {
    id: 'gpu_photonic_tensor',
    name: 'Photonic Tensor Matrix',
    opsPerCorePerClock: 11.2,
    shaderMTrPerCore: 0.65,
    clockEfficiency: 1.4,
    powerMultiplier: 1.24,
    memoryCompression: 2.35,
    rayTracingFactor: 1.9,
    computeEfficiency: 2.55,
    maxShaderCores: 65536,
    description: 'Optical Mach-Zehnder interferometers perform matrix multiply-accumulate at light speed.',
    requiredTechId: 'frontier_photonic',
  },
];

export const MEMORY_TECHS: MemoryTechSpec[] = [
  // System RAM
  {
    id: 'ram_dram',
    name: 'Async DRAM',
    kind: 'ram',
    dataRateMTs: 66,
    powerPerChannelW: 1.5,
    gbpsPerUnit: 0.53,
    maxCapacityPerUnitGB: 0.25,
  },
  {
    id: 'ram_sdram',
    name: 'Synchronous SDRAM',
    kind: 'ram',
    dataRateMTs: 266,
    powerPerChannelW: 2.2,
    gbpsPerUnit: 2.1,
    maxCapacityPerUnitGB: 2,
    requiredTechId: 'sup_ram_sdram',
  },
  {
    id: 'ram_ddr3',
    name: 'DDR3 Dual-Rate',
    kind: 'ram',
    dataRateMTs: 1866,
    powerPerChannelW: 3.4,
    gbpsPerUnit: 14.9,
    maxCapacityPerUnitGB: 16,
    requiredTechId: 'sup_ram_ddr',
  },
  {
    id: 'ram_ddr5',
    name: 'DDR5 High-Speed',
    kind: 'ram',
    dataRateMTs: 6400,
    powerPerChannelW: 4.8,
    gbpsPerUnit: 51.2,
    maxCapacityPerUnitGB: 128,
    requiredTechId: 'sup_ram_ddr5',
  },
  {
    id: 'ram_optical',
    name: 'Optical Coherent RAM',
    kind: 'ram',
    dataRateMTs: 24000,
    powerPerChannelW: 6.2,
    gbpsPerUnit: 192.0,
    maxCapacityPerUnitGB: 1024,
    requiredTechId: 'frontier_photonic',
  },
  // Graphics VRAM
  {
    id: 'vram_sdr',
    name: 'SDR Framebuffer',
    kind: 'vram',
    dataRateMTs: 200,
    powerPerChannelW: 1.2,
    gbpsPerUnit: 0.8,
    maxCapacityPerUnitGB: 0.125,
  },
  {
    id: 'vram_gddr5',
    name: 'GDDR5 Graphics Memory',
    kind: 'vram',
    dataRateMTs: 7000,
    powerPerChannelW: 3.0,
    gbpsPerUnit: 28,
    maxCapacityPerUnitGB: 2,
    requiredTechId: 'gpu_vram_gddr',
  },
  {
    id: 'vram_gddr7',
    name: 'GDDR7 PAM3',
    kind: 'vram',
    dataRateMTs: 28000,
    powerPerChannelW: 4.5,
    gbpsPerUnit: 112,
    maxCapacityPerUnitGB: 8,
    requiredTechId: 'gpu_vram_gddr7',
  },
  {
    id: 'vram_hbm',
    name: '3D Stacked HBM4',
    kind: 'vram',
    dataRateMTs: 8000,
    powerPerChannelW: 5.5,
    gbpsPerUnit: 256, // Per 256-bit slice equivalent scaled cleanly in physics
    maxCapacityPerUnitGB: 32,
    requiredTechId: 'gpu_vram_hbm',
  },
  {
    id: 'vram_photonic',
    name: '3D Photonic Memory Cube',
    kind: 'vram',
    dataRateMTs: 42000,
    powerPerChannelW: 7.2,
    gbpsPerUnit: 640,
    maxCapacityPerUnitGB: 128,
    requiredTechId: 'frontier_photonic',
  },
];

export const MEMORY_CATEGORY_META: Record<
  MemoryCategory,
  { label: string; shortLabel: string; description: string; nonVolatile: boolean }
> = {
  dram: {
    label: 'System RAM (DRAM)',
    shortLabel: 'DRAM',
    description: 'Low-latency volatile main memory arrays balancing capacitor refresh leakage, bank parallelism, and high-speed DDR signaling.',
    nonVolatile: false,
  },
  vram: {
    label: 'Graphics VRAM & HBM',
    shortLabel: 'VRAM/HBM',
    description: 'Ultra-wide graphics memory and TSV 3D-stacked HBM cubes trading TSV thermal density and OSAT load for massive bandwidth.',
    nonVolatile: false,
  },
  rom_nand: {
    label: 'ROM & NAND Flash Storage',
    shortLabel: 'NAND/SSD',
    description: 'Non-volatile solid-state storage scaling via vertical 3D V-NAND tiers and multi-bit cells (SLC to PLC) against P/E endurance.',
    nonVolatile: true,
  },
  storage_class: {
    label: 'Storage-Class Memory (SCM)',
    shortLabel: 'SCM',
    description: 'Byte-addressable non-volatile chalcogenide PCM, spintronic STT-MRAM, and photonic arrays bridging RAM speed with SSD persistence.',
    nonVolatile: true,
  },
};

export const MEMORY_CELL_ARCHS: MemoryCellArchSpec[] = [
  // ─── SYSTEM RAM (DRAM) ───────────────────────────────────────────────
  {
    id: 'mem_1t1c_planar',
    name: 'Planar 1T1C DRAM',
    category: 'dram',
    baseGbitPerMm2: 0.24,
    maxBitsPerCell: 1,
    maxStackLayers: 1,
    baseLatencyNs: 48,
    refDataRateMTs: 266,
    baseEnduranceCycles: 1e12,
    refreshPowerFactor: 0.42,
    activePowerFactor: 0.55,
    defectMultiplier: 1.0,
    nonVolatile: false,
    description: 'Classic one-transistor, one-capacitor planar memory array requiring periodic charge refresh.',
    constraintNote: 'Refresh power scales sharply with capacity and junction temperatures above 85 °C.',
  },
  {
    id: 'mem_stacked_cap_dram',
    name: 'High-k Stacked-Capacitor DRAM',
    category: 'dram',
    baseGbitPerMm2: 0.48,
    maxBitsPerCell: 1,
    maxStackLayers: 2,
    baseLatencyNs: 22,
    refDataRateMTs: 3200,
    baseEnduranceCycles: 1e12,
    refreshPowerFactor: 0.24,
    activePowerFactor: 0.48,
    defectMultiplier: 1.08,
    nonVolatile: false,
    description: 'High-aspect-ratio zirconium/hafnium dielectric cylinder capacitors nearly triple array density.',
    constraintNote: 'Deep trench capacitor etching adds +8% baseline defect sensitivity.',
    requiredTechId: 'mem_dram_highk',
  },
  {
    id: 'mem_3d_dram',
    name: '3D Monolithic Stacked DRAM',
    category: 'dram',
    baseGbitPerMm2: 0.36,
    maxBitsPerCell: 1,
    maxStackLayers: 16,
    baseLatencyNs: 16,
    refDataRateMTs: 8400,
    baseEnduranceCycles: 1e12,
    refreshPowerFactor: 0.2,
    activePowerFactor: 0.44,
    defectMultiplier: 1.22,
    nonVolatile: false,
    description: 'Vertical oxide-semiconductor capacitor tiers stack up to 16 DRAM arrays monolithically.',
    constraintNote: 'Vertical stacking traps heat inside middle tiers and raises defect exposure (+22%).',
    requiredTechId: 'mem_3d_dram',
  },

  // ─── GRAPHICS VRAM & HBM ─────────────────────────────────────────────
  {
    id: 'mem_vram_dualport',
    name: 'Dual-Port Framebuffer VRAM',
    category: 'vram',
    baseGbitPerMm2: 0.19,
    maxBitsPerCell: 1,
    maxStackLayers: 1,
    baseLatencyNs: 36,
    refDataRateMTs: 400,
    baseEnduranceCycles: 1e12,
    refreshPowerFactor: 0.46,
    activePowerFactor: 0.72,
    defectMultiplier: 1.04,
    nonVolatile: false,
    description: 'Simultaneous random-access and serial display shift ports tailored for early graphics pipelines.',
    constraintNote: 'Dual-port sense circuitry reduces cell density compared to standard DRAM.',
    requiredTechId: 'mem_vram_foundations',
  },
  {
    id: 'mem_gddr_cell',
    name: 'High-Speed Pipelined GDDR Array',
    category: 'vram',
    baseGbitPerMm2: 0.42,
    maxBitsPerCell: 1,
    maxStackLayers: 1,
    baseLatencyNs: 18,
    refDataRateMTs: 14000,
    baseEnduranceCycles: 1e12,
    refreshPowerFactor: 0.34,
    activePowerFactor: 0.92,
    defectMultiplier: 1.1,
    nonVolatile: false,
    description: 'Aggressive multi-bank prefetching and PAM-ready I/O drivers engineered for extreme per-pin throughput.',
    constraintNote: 'High per-pin signaling frequency draws substantial I/O PHY power.',
    requiredTechId: 'gpu_vram_gddr',
  },
  {
    id: 'mem_hbm_stack',
    name: 'TSV 3D-Stacked HBM Cube',
    category: 'vram',
    baseGbitPerMm2: 0.32,
    maxBitsPerCell: 1,
    maxStackLayers: 16,
    baseLatencyNs: 14,
    refDataRateMTs: 6400,
    baseEnduranceCycles: 1e12,
    refreshPowerFactor: 0.22,
    activePowerFactor: 0.52,
    defectMultiplier: 1.28,
    nonVolatile: false,
    description: 'Up to 16 vertical DRAM dies bonded via dense copper through-silicon vias (TSVs) over a logic base die.',
    constraintNote: 'Requires wide TSV PHY and adds vertical thermal resistance & OSAT stacking load.',
    requiredTechId: 'mem_hbm_tsv',
  },

  // ─── ROM & NAND FLASH STORAGE ────────────────────────────────────────
  {
    id: 'mem_mask_rom',
    name: 'Planar Mask ROM / EEPROM',
    category: 'rom_nand',
    baseGbitPerMm2: 0.32,
    maxBitsPerCell: 1,
    maxStackLayers: 1,
    baseLatencyNs: 160,
    refDataRateMTs: 133,
    baseEnduranceCycles: 50000,
    refreshPowerFactor: 0,
    activePowerFactor: 0.28,
    defectMultiplier: 0.94,
    nonVolatile: true,
    description: 'Foundational non-volatile floating-gate / mask-programmed memory for firmware and permanent records.',
    constraintNote: 'Zero refresh draw, but planar density limits total capacity on early nodes.',
  },
  {
    id: 'mem_planar_nand',
    name: 'Planar Floating-Gate NAND Flash',
    category: 'rom_nand',
    baseGbitPerMm2: 0.65,
    maxBitsPerCell: 2,
    maxStackLayers: 1,
    baseLatencyNs: 45000,
    refDataRateMTs: 800,
    baseEnduranceCycles: 80000,
    refreshPowerFactor: 0,
    activePowerFactor: 0.32,
    defectMultiplier: 1.06,
    nonVolatile: true,
    description: 'Serial NAND transistor strings pack high non-volatile capacity for solid-state drives (SLC/MLC).',
    constraintNote: 'MLC (2 bits/cell) doubles density but cuts write endurance by ~68% and raises latency.',
    requiredTechId: 'mem_nand_planar',
  },
  {
    id: 'mem_3d_vnand',
    name: '3D Charge-Trap V-NAND',
    category: 'rom_nand',
    baseGbitPerMm2: 0.042,
    maxBitsPerCell: 4,
    maxStackLayers: 256,
    baseLatencyNs: 32000,
    refDataRateMTs: 2400,
    baseEnduranceCycles: 65000,
    refreshPowerFactor: 0,
    activePowerFactor: 0.36,
    defectMultiplier: 1.16,
    nonVolatile: true,
    description: 'Cylindrical charge-trap memory strings etched vertically through up to 256 wordline layers (SLC–QLC).',
    constraintNote: 'TLC/QLC storage demands LDPC ECC to protect yield and prevent premature block wearout.',
    requiredTechId: 'mem_3d_nand',
  },
  {
    id: 'mem_ultra_vnand',
    name: 'Dual-Deck 512L PLC V-NAND',
    category: 'rom_nand',
    baseGbitPerMm2: 0.055,
    maxBitsPerCell: 5,
    maxStackLayers: 512,
    baseLatencyNs: 38000,
    refDataRateMTs: 4200,
    baseEnduranceCycles: 55000,
    refreshPowerFactor: 0,
    activePowerFactor: 0.4,
    defectMultiplier: 1.28,
    nonVolatile: true,
    description: 'String-stacked dual-deck channels reaching 512 vertical wordline tiers and 5-bit Penta-Level Cells.',
    constraintNote: 'PLC (32 charge states per cell) severely degrades raw endurance without Deep AI-LDPC ECC.',
    requiredTechId: 'mem_512l_nand',
  },

  // ─── STORAGE-CLASS & POST-SILICON MEMORY ─────────────────────────────
  {
    id: 'mem_pcm_xpoint',
    name: '3D Cross-Point Phase-Change (PCM)',
    category: 'storage_class',
    baseGbitPerMm2: 0.55,
    maxBitsPerCell: 2,
    maxStackLayers: 8,
    baseLatencyNs: 68,
    refDataRateMTs: 4800,
    baseEnduranceCycles: 1e7,
    refreshPowerFactor: 0,
    activePowerFactor: 0.78,
    defectMultiplier: 1.18,
    nonVolatile: true,
    description: 'Chalcogenide glass phase-change arrays deliver byte-addressable persistence ~500× faster than NAND.',
    constraintNote: 'Thermal phase-change write pulses require elevated active power and solid cooling.',
    requiredTechId: 'mem_pcm_scm',
  },
  {
    id: 'mem_stt_mram',
    name: 'STT-MRAM Spintronic Array',
    category: 'storage_class',
    baseGbitPerMm2: 0.46,
    maxBitsPerCell: 1,
    maxStackLayers: 4,
    baseLatencyNs: 18,
    refDataRateMTs: 9600,
    baseEnduranceCycles: 1e11,
    refreshPowerFactor: 0,
    activePowerFactor: 0.42,
    defectMultiplier: 1.2,
    nonVolatile: true,
    description: 'Magnetic tunnel junctions switched by spin-polarized current unite near-DRAM speed with zero refresh power.',
    constraintNote: 'Lower bit density than 3D NAND, but near-infinite endurance and instant persistence.',
    requiredTechId: 'mem_mram_spin',
  },
  {
    id: 'mem_photonic_holo',
    name: 'Photonic Coherent SCM Matrix',
    category: 'storage_class',
    baseGbitPerMm2: 0.35,
    maxBitsPerCell: 4,
    maxStackLayers: 64,
    baseLatencyNs: 6,
    refDataRateMTs: 36000,
    baseEnduranceCycles: 1e12,
    refreshPowerFactor: 0,
    activePowerFactor: 0.34,
    defectMultiplier: 1.24,
    nonVolatile: true,
    description: 'Multi-level optical phase-change waveguide cavities store persistent states accessed at light speed.',
    constraintNote: 'Optical resonance cavities drift if junction temperature exceeds 78 °C.',
    requiredTechId: 'frontier_photonic',
  },
];

export const MEMORY_INTERFACES: MemoryInterfaceSpec[] = [
  // DRAM Interfaces
  {
    id: 'iface_async_dram',
    name: 'Async Parallel DRAM Bus',
    category: 'dram',
    busWidths: [8, 16, 32, 64],
    signalingMultiplier: 1.0,
    maxDataRateMTs: 400,
    phyAreaPerSliceMm2: 0.85,
    phyPowerPerSliceW: 0.25,
    description: 'Asynchronous RAS/CAS strobed parallel data bus.',
  },
  {
    id: 'iface_ddr_sync',
    name: 'Synchronous DDR Bus',
    category: 'dram',
    busWidths: [16, 32, 64, 128],
    signalingMultiplier: 2.0,
    maxDataRateMTs: 4800,
    phyAreaPerSliceMm2: 1.15,
    phyPowerPerSliceW: 0.48,
    description: 'Double-data-rate clocked bursts transferring on rising and falling edges.',
    requiredTechId: 'sup_ram_sdram',
  },
  {
    id: 'iface_ddr5_dual',
    name: 'DDR5 Dual Sub-Channel PHY',
    category: 'dram',
    busWidths: [32, 64, 128, 256],
    signalingMultiplier: 2.6,
    maxDataRateMTs: 12800,
    phyAreaPerSliceMm2: 1.35,
    phyPowerPerSliceW: 0.65,
    description: 'Split dual-subchannel PHY with decision feedback equalization and on-die PMIC.',
    requiredTechId: 'sup_ram_ddr5',
  },
  {
    id: 'iface_optical_ram',
    name: 'Optical Coherent Memory Link',
    category: 'dram',
    busWidths: [64, 128, 256, 512],
    signalingMultiplier: 4.0,
    maxDataRateMTs: 40000,
    phyAreaPerSliceMm2: 1.6,
    phyPowerPerSliceW: 0.72,
    description: 'Wavelength-division multiplexed optical waveguides eliminate electrical trace attenuation.',
    requiredTechId: 'frontier_photonic',
  },

  // VRAM / HBM Interfaces
  {
    id: 'iface_vram_sdr',
    name: 'Dual-Port Graphics Bus',
    category: 'vram',
    busWidths: [32, 64, 128, 256],
    signalingMultiplier: 1.2,
    maxDataRateMTs: 800,
    phyAreaPerSliceMm2: 1.1,
    phyPowerPerSliceW: 0.35,
    description: 'Dedicated graphics framebuffer parallel interface.',
    requiredTechId: 'mem_vram_foundations',
  },
  {
    id: 'iface_gddr_pam',
    name: 'GDDR PAM3 High-Speed PHY',
    category: 'vram',
    busWidths: [64, 128, 256, 384, 512],
    signalingMultiplier: 3.0,
    maxDataRateMTs: 36000,
    phyAreaPerSliceMm2: 1.45,
    phyPowerPerSliceW: 0.88,
    description: 'Three-level pulse amplitude modulation pushing conventional graphics pins past 30 Gbps.',
    requiredTechId: 'gpu_vram_gddr',
  },
  {
    id: 'iface_hbm_tsv',
    name: 'Ultra-Wide TSV Interposer Bus',
    category: 'vram',
    busWidths: [1024, 2048, 4096],
    signalingMultiplier: 2.0,
    maxDataRateMTs: 12000,
    phyAreaPerSliceMm2: 0.24,
    phyPowerPerSliceW: 0.14,
    description: 'Thousands of ultra-short micro-bump silicon interposer lanes delivering terabytes/sec at low pJ/bit.',
    requiredTechId: 'mem_hbm_tsv',
  },

  // ROM / NAND Interfaces
  {
    id: 'iface_parallel_rom',
    name: 'Parallel ROM / Block Bus',
    category: 'rom_nand',
    busWidths: [8, 16, 32],
    signalingMultiplier: 1.0,
    maxDataRateMTs: 266,
    phyAreaPerSliceMm2: 0.65,
    phyPowerPerSliceW: 0.16,
    description: 'Simple parallel address/data bus for early ROM and flash modules.',
  },
  {
    id: 'iface_onfi_nvme',
    name: 'ONFI Toggle Flash Interface',
    category: 'rom_nand',
    busWidths: [8, 16, 32, 64],
    signalingMultiplier: 2.0,
    maxDataRateMTs: 3200,
    phyAreaPerSliceMm2: 0.85,
    phyPowerPerSliceW: 0.28,
    description: 'Multi-channel Toggle-DDR NAND interface paired with SSD flash translation controller.',
    requiredTechId: 'mem_nand_planar',
  },
  {
    id: 'iface_pcie_nvme_ctrl',
    name: 'PCIe NVMe Direct Storage PHY',
    category: 'rom_nand',
    busWidths: [16, 32, 64, 128],
    signalingMultiplier: 2.8,
    maxDataRateMTs: 7200,
    phyAreaPerSliceMm2: 1.05,
    phyPowerPerSliceW: 0.42,
    description: 'High-queue-depth NVMe storage controller interface built for multi-terabyte enterprise arrays.',
    requiredTechId: 'mem_3d_nand',
  },

  // Storage-Class Memory Interfaces
  {
    id: 'iface_cxl_scm',
    name: 'CXL Coherent Persistent Fabric',
    category: 'storage_class',
    busWidths: [32, 64, 128, 256],
    signalingMultiplier: 2.8,
    maxDataRateMTs: 16000,
    phyAreaPerSliceMm2: 1.25,
    phyPowerPerSliceW: 0.56,
    description: 'Cache-coherent load/store memory semantics over high-speed differential SerDes lanes.',
    requiredTechId: 'mem_pcm_scm',
  },
  {
    id: 'iface_optical_scm',
    name: 'Photonic Unified Memory Bus',
    category: 'storage_class',
    busWidths: [64, 128, 256, 512],
    signalingMultiplier: 4.2,
    maxDataRateMTs: 48000,
    phyAreaPerSliceMm2: 1.5,
    phyPowerPerSliceW: 0.68,
    description: 'Co-packaged optical memory interconnect delivering sub-10ns coherent persistent storage access.',
    requiredTechId: 'frontier_photonic',
  },
];

export const ISA_EXTENSIONS: IsaExtensionSpec[] = [
  {
    id: 'isa_int',
    name: 'Integer Base ISA',
    shortLabel: 'INT',
    transistorOverheadRatio: 0.0,
    singleCoreBonus: 1.0,
    generalComputeBonus: 1.0,
    powerPenalty: 1.0,
  },
  {
    id: 'isa_fpu',
    name: 'IEEE Floating-Point Unit',
    shortLabel: 'FPU',
    transistorOverheadRatio: 0.14,
    singleCoreBonus: 1.14,
    generalComputeBonus: 1.28,
    powerPenalty: 1.07,
    requiredTechId: 'cpu_isa_fpu',
  },
  {
    id: 'isa_simd128',
    name: '128-bit Vector SIMD',
    shortLabel: 'SIMD-128',
    transistorOverheadRatio: 0.18,
    singleCoreBonus: 1.12,
    generalComputeBonus: 1.32,
    powerPenalty: 1.09,
    requiredTechId: 'cpu_isa_simd',
  },
  {
    id: 'isa_avx512',
    name: '512-bit Matrix Vector',
    shortLabel: 'VEC-512',
    transistorOverheadRatio: 0.26,
    singleCoreBonus: 1.1,
    generalComputeBonus: 1.42,
    powerPenalty: 1.18,
    requiredTechId: 'cpu_isa_matrix',
  },
  {
    id: 'isa_tensor_q',
    name: 'Topological Tensor Ops',
    shortLabel: 'TOPO-X',
    transistorOverheadRatio: 0.34,
    singleCoreBonus: 1.16,
    generalComputeBonus: 1.65,
    powerPenalty: 1.22,
    requiredTechId: 'frontier_topological',
  },
];

/**
 * Full Technology Tree (592 deterministic nodes across 7 engineering lanes × 26 tiers)
 * generated in ./techTreeGenerator.ts with zero historical date locks and zero overlapping coordinates.
 */
export const TECH_TREE: TechNode[] = GENERATED_TECH_TREE;

/**
 * Repeatable Open-Ended Frontier Synthesis Tracks.
 * Exponential RP cost: baseRpCost * (costExponent ^ level)
 * Logarithmic diminishing gain: ln(1 + 0.25 * level)
 * Plus explicit physical trade-offs so late-game stays strategic across millennia.
 */
export const FRONTIER_TRACKS: FrontierTrackSpec[] = [
  {
    id: 'ft_density',
    name: 'Atomic Packing Refinement',
    paradigm: 'cnt_3d',
    baseRpCost: 180000,
    costExponent: 1.68,
    description: 'Improves effective logic & SRAM density across all nodes via logarithmic atomic packing.',
    diminishingFormulaLabel: '+22% × ln(1 + 0.35·L) density',
    constraintTradeoff: 'Each level slightly elevates volumetric heat flux sensitivity (+2.5% per level).',
  },
  {
    id: 'ft_defect',
    name: 'Quantum Metrology & Defect Cleansing',
    paradigm: 'none',
    baseRpCost: 165000,
    costExponent: 1.62,
    description: 'Real-time atomic-scale wafer inspection reduces defect density D0 logarithmically.',
    diminishingFormulaLabel: 'D0 × 1 / (1 + 0.32·ln(1 + L))',
    constraintTradeoff: 'Increases fab power consumption by +4% per level for inline metrology beams.',
  },
  {
    id: 'ft_ipc',
    name: 'Non-Classical Execution Synthesis',
    paradigm: 'topological',
    baseRpCost: 220000,
    costExponent: 1.72,
    description: 'Raises effective architectural IPC and GPU compute efficiency via asymptotic compiler-silicon co-design.',
    diminishingFormulaLabel: '+18% × ln(1 + 0.30·L) IPC & Compute',
    constraintTradeoff: 'Increases tape-out engineering duration by +6% per level.',
  },
  {
    id: 'ft_thermal',
    name: 'Phonon-Engineered Thermal Interfaces',
    paradigm: 'cryogenic',
    baseRpCost: 175000,
    costExponent: 1.65,
    description: 'Diamond-graphene thermal spreaders reduce thermal resistance Rθ asymptotically.',
    diminishingFormulaLabel: 'Rθ × 1 / (1 + 0.28·ln(1 + L))',
    constraintTradeoff: 'Requires +3% additional Silicon feedstock per wafer for interface layers.',
  },
];

export interface FacilityBlueprint {
  kind: FacilityKind;
  name: string;
  description: string;
  buildCreditCost: number;
  buildDays: number;
  monthlyUpkeepCR: number;
  powerDrawMW: number;
  baseOutputLabel: string;
  baseWaferCapacityPerMonth?: number;
  baseCleanroomGrade?: number;
  baseSiliconOutputPerMonth?: number;
  basePowerCapacityMW?: number;
  baseResearchOutputPerDay?: number;
  basePackagingCapacityPerMonth?: number;
  upgradeCostMultiplier: number;
  upgradeDays: number;
}

export const FACILITY_BLUEPRINTS: Record<FacilityKind, FacilityBlueprint> = {
  fab: {
    kind: 'fab',
    name: 'Wafer Fabrication Facility',
    description: 'Cleanroom semiconductor fab producing wafers on an assigned process node. Consumes Silicon, Grid Power, and Packaging capacity.',
    buildCreditCost: 1800,
    buildDays: 120,
    monthlyUpkeepCR: 160,
    powerDrawMW: 4,
    baseOutputLabel: '120 wafer starts/mo (L1)',
    baseWaferCapacityPerMonth: 120,
    baseCleanroomGrade: 1,
    upgradeCostMultiplier: 1.85,
    upgradeDays: 90,
  },
  silicon_refinery: {
    kind: 'silicon_refinery',
    name: 'Ultra-Pure Silicon Refinery',
    description: 'Czochralski crystal-pulling refinery producing 9N/11N monocrystalline Silicon feedstock for fabs.',
    buildCreditCost: 850,
    buildDays: 60,
    monthlyUpkeepCR: 65,
    powerDrawMW: 6,
    baseOutputLabel: '+950 Si/mo (L1)',
    baseSiliconOutputPerMonth: 950,
    upgradeCostMultiplier: 1.65,
    upgradeDays: 45,
  },
  power_plant: {
    kind: 'power_plant',
    name: 'Foundry Power Substation',
    description: 'Dedicated high-stability industrial electrical generation supplying cleanroom fabs and refineries.',
    buildCreditCost: 720,
    buildDays: 55,
    monthlyUpkeepCR: 55,
    powerDrawMW: 0,
    baseOutputLabel: '+35 MW capacity (L1)',
    basePowerCapacityMW: 35,
    upgradeCostMultiplier: 1.6,
    upgradeDays: 45,
  },
  research_lab: {
    kind: 'research_lab',
    name: 'Semiconductor Research Lab',
    description: 'Dedicated physics, lithography, and architecture laboratory generating daily Research Points (RP).',
    buildCreditCost: 1100,
    buildDays: 75,
    monthlyUpkeepCR: 110,
    powerDrawMW: 5,
    baseOutputLabel: '+3.6 RP/day (L1)',
    baseResearchOutputPerDay: 3.6,
    upgradeCostMultiplier: 1.75,
    upgradeDays: 60,
  },
  packaging_plant: {
    kind: 'packaging_plant',
    name: 'OSAT Packaging & Test Plant',
    description: 'Dicing, substrate assembly, interposer bonding, and burn-in test facility converting good dies into shipped chips.',
    buildCreditCost: 950,
    buildDays: 65,
    monthlyUpkeepCR: 75,
    powerDrawMW: 4,
    baseOutputLabel: '12,000 pkg units/mo (L1)',
    basePackagingCapacityPerMonth: 12000,
    upgradeCostMultiplier: 1.7,
    upgradeDays: 50,
  },
};

export function getProcessNode(id: string): ProcessNodeSpec {
  return PROCESS_NODES.find((n) => n.id === id) ?? PROCESS_NODES[0];
}

export function getTransistorStructure(id: string): TransistorStructureSpec {
  return TRANSISTOR_STRUCTURES.find((t) => t.id === id) ?? TRANSISTOR_STRUCTURES[0];
}

export function getPackagingSpec(id: string): PackagingSpec {
  return PACKAGING_SPECS.find((p) => p.id === id) ?? PACKAGING_SPECS[0];
}

export function getCoolingSpec(id: string): CoolingSpec {
  return COOLING_SPECS.find((c) => c.id === id) ?? COOLING_SPECS[0];
}

export function getCpuArch(id: string): CpuArchSpec {
  return CPU_ARCHITECTURES.find((a) => a.id === id) ?? CPU_ARCHITECTURES[0];
}

export function getGpuArch(id: string): GpuArchSpec {
  return GPU_ARCHITECTURES.find((a) => a.id === id) ?? GPU_ARCHITECTURES[0];
}

export function getMemoryTech(id: string): MemoryTechSpec {
  return MEMORY_TECHS.find((m) => m.id === id) ?? MEMORY_TECHS[0];
}

export function getMemoryCellArch(id: string): MemoryCellArchSpec {
  return MEMORY_CELL_ARCHS.find((m) => m.id === id) ?? MEMORY_CELL_ARCHS[0];
}

export function getMemoryInterface(id: string): MemoryInterfaceSpec {
  return MEMORY_INTERFACES.find((i) => i.id === id) ?? MEMORY_INTERFACES[0];
}

export function getUnlockedMemoryCellArchs(
  category: MemoryCategory,
  unlockedTechIds: string[]
): MemoryCellArchSpec[] {
  return MEMORY_CELL_ARCHS.filter(
    (m) =>
      m.category === category && (!m.requiredTechId || unlockedTechIds.includes(m.requiredTechId))
  );
}

export function getUnlockedMemoryInterfaces(
  category: MemoryCategory,
  unlockedTechIds: string[]
): MemoryInterfaceSpec[] {
  return MEMORY_INTERFACES.filter(
    (i) =>
      i.category === category && (!i.requiredTechId || unlockedTechIds.includes(i.requiredTechId))
  );
}

export function getTechNode(id: string): TechNode | undefined {
  return TECH_NODE_MAP.get(id);
}

export function getBestLithography(unlockedTechIds: string[]): LithographySpec {
  let best = LITHOGRAPHY_SPECS[0];
  for (const spec of LITHOGRAPHY_SPECS) {
    if (!spec.requiredTechId || unlockedTechIds.includes(spec.requiredTechId)) {
      best = spec;
    }
  }
  return best;
}

export function getMaxWaferDiameterMm(unlockedTechIds: string[]): number {
  let maxD = 100;
  for (const techId of unlockedTechIds) {
    const t = getTechNode(techId);
    if (t?.effects?.waferDiameterMm && t.effects.waferDiameterMm > maxD) {
      maxD = t.effects.waferDiameterMm;
    }
  }
  return maxD;
}

export function getMaxParallelResearch(unlockedTechIds: string[]): number {
  let slots = 1;
  for (const techId of unlockedTechIds) {
    const t = getTechNode(techId);
    if (t?.effects?.maxParallelResearch && t.effects.maxParallelResearch > slots) {
      slots = t.effects.maxParallelResearch;
    }
  }
  return slots;
}

export function getMaxPcieGen(unlockedTechIds: string[]): number {
  let gen = 1;
  for (const techId of unlockedTechIds) {
    const t = getTechNode(techId);
    if (t?.effects?.maxPcieGen && t.effects.maxPcieGen > gen) {
      gen = t.effects.maxPcieGen;
    }
  }
  return gen;
}

/**
 * Aggregates cumulative engineering modifiers across all unlocked tech nodes.
 * Uses smooth physical caps/floors so unlocking all 590+ technologies rewards
 * continuous R&D across every lane without violating semiconductor physics invariants.
 */
export function getAggregatedTechModifiers(unlockedTechIds: string[]): TechModifiers {
  let logicDensityMult = 1.0;
  let sramDensityMult = 1.0;
  let defectReductionMult = 1.0;
  let leakageReductionMult = 1.0;
  let clockHeadroomMult = 1.0;
  let ipcBonusMult = 1.0;
  let gpuComputeMult = 1.0;
  let memoryBandwidthMult = 1.0;
  let coolingEfficiencyMult = 1.0;
  let siliconRefiningMult = 1.0;
  let fabThroughputMult = 1.0;
  let rpGenerationMult = 1.0;
  let maxParallelResearch = 1;
  let maxPcieGen = 1;
  let waferDiameterMm = 100;

  for (const techId of unlockedTechIds) {
    const eff = TECH_NODE_MAP.get(techId)?.effects;
    if (!eff) continue;
    if (eff.logicDensityMult) logicDensityMult *= eff.logicDensityMult;
    if (eff.sramDensityMult) sramDensityMult *= eff.sramDensityMult;
    if (eff.defectReductionMult) defectReductionMult *= eff.defectReductionMult;
    if (eff.leakageReductionMult) leakageReductionMult *= eff.leakageReductionMult;
    if (eff.clockHeadroomMult) clockHeadroomMult *= eff.clockHeadroomMult;
    if (eff.ipcBonusMult) ipcBonusMult *= eff.ipcBonusMult;
    if (eff.gpuComputeMult) gpuComputeMult *= eff.gpuComputeMult;
    if (eff.memoryBandwidthMult) memoryBandwidthMult *= eff.memoryBandwidthMult;
    if (eff.coolingEfficiencyMult) coolingEfficiencyMult *= eff.coolingEfficiencyMult;
    if (eff.siliconRefiningMult) siliconRefiningMult *= eff.siliconRefiningMult;
    if (eff.siliconEfficiency) siliconRefiningMult *= eff.siliconEfficiency;
    if (eff.fabThroughputMult) fabThroughputMult *= eff.fabThroughputMult;
    if (eff.rpGenerationMult) rpGenerationMult *= eff.rpGenerationMult;
    if (eff.rpMultiplier) rpGenerationMult *= eff.rpMultiplier;
    if (eff.maxParallelResearch && eff.maxParallelResearch > maxParallelResearch) {
      maxParallelResearch = eff.maxParallelResearch;
    }
    if (eff.maxPcieGen && eff.maxPcieGen > maxPcieGen) {
      maxPcieGen = eff.maxPcieGen;
    }
    if (eff.waferDiameterMm && eff.waferDiameterMm > waferDiameterMm) {
      waferDiameterMm = eff.waferDiameterMm;
    }
  }

  return {
    logicDensityMult: Math.min(3.5, logicDensityMult),
    sramDensityMult: Math.min(3.0, sramDensityMult),
    defectReductionMult: Math.max(0.25, defectReductionMult),
    leakageReductionMult: Math.max(0.25, leakageReductionMult),
    clockHeadroomMult: Math.min(1.45, clockHeadroomMult),
    ipcBonusMult: Math.min(2.4, ipcBonusMult),
    gpuComputeMult: Math.min(2.8, gpuComputeMult),
    memoryBandwidthMult: Math.min(2.8, memoryBandwidthMult),
    coolingEfficiencyMult: Math.min(2.2, coolingEfficiencyMult),
    siliconRefiningMult: Math.min(4.0, siliconRefiningMult),
    fabThroughputMult: Math.min(3.5, fabThroughputMult),
    rpGenerationMult: Math.min(12.0, rpGenerationMult),
    maxParallelResearch,
    maxPcieGen,
    waferDiameterMm,
  };
}

export const PCIE_GBPS_PER_LANE: Record<number, number> = {
  1: 0.25,
  2: 0.5,
  3: 1.0,
  4: 2.0,
  5: 4.0,
  6: 8.0,
  7: 16.0,
  8: 32.0,
  9: 64.0,
  10: 128.0,
};

export function getPcieBandwidthPerLaneGBs(gen: number): number {
  if (PCIE_GBPS_PER_LANE[gen] !== undefined) return PCIE_GBPS_PER_LANE[gen];
  return 0.25 * Math.pow(2, Math.max(0, gen - 1));
}

export function getBestUnlockedProcessNode(unlockedTechIds: string[]): ProcessNodeSpec {
  let best = PROCESS_NODES[0];
  for (const node of PROCESS_NODES) {
    const unlocked = !node.requiredTechId || unlockedTechIds.includes(node.requiredTechId);
    if (unlocked && node.logicDensityMTrPerMm2 >= best.logicDensityMTrPerMm2) {
      best = node;
    }
  }
  return best;
}

export function getFrontierTrackCost(track: FrontierTrackSpec, currentLevel: number): number {
  return Math.round(track.baseRpCost * Math.pow(track.costExponent, currentLevel));
}
