/**
 * Semiconductor Empire — Pure, Deterministic Semiconductor Physics & Benchmark Kernel.
 *
 * ZERO React or DOM dependencies. Independently testable and unit-verifiable.
 *
 * ============================================================================
 * DOCUMENTED EQUATIONS, UNITS, ASSUMPTIONS & LIMITATIONS
 * ============================================================================
 * 1. TRANSISTOR BUDGET (MTr = Millions of Transistors):
 *    - CPU: N_tr = [ (C_P * T_P + C_E * T_E) * (1 + kappa_ISA) * ipcAreaFactor ]
 *                  + [ 6.4 * (L1_MB + L2_MB + L3_MB) ]  (6T SRAM + tag/ECC overhead)
 *                  + [ T_iGPU + T_NPU + T_IMC(ch) + T_PCIe(lanes) ]
 *    - GPU: N_tr = [ S_cores * T_shader + N_ROP * T_ROP + N_TMU * T_TMU ]
 *                  + [ 6.4 * (L1_MB + L2_MB) ]
 *                  + [ T_PHY(busBits) ]
 *    - MEMORY / STORAGE:
 *                  Bit cells (capacitors, floating gates, MTJs, PCM) are passive storage
 *                  elements scaled by vertical 3D stack tiers and multi-bit encoding (SLC..PLC),
 *                  while CMOS periphery logic comprises Sense Amps + ECC Controller + I/O PHY.
 *
 * 2. DIE AREA (mm^2):
 *    A = ( N_logic / (delta_logic * eta_trans * frontierDensity)
 *        + N_cache / (delta_SRAM  * sqrt(eta_trans) * frontierDensity) )
 *        * (1 + gamma_routing(cores)) + A_IO_pads
 *    Note: SRAM scales slower than logic below 5nm (embedded in node.sramDensityMTrPerMm2).
 *    Memory Array Effective Density (Gbit/mm^2):
 *      rho_eff = rho_base * (delta_SRAM / 44)^0.72 * sqrt(eta_trans) * frontierDensity
 *                * layers^alpha_stack * bitsPerCell / (1 + eccAreaOverhead)
 *      where alpha_stack = 0.91 (3D V-NAND) or 0.94 (HBM / 3D DRAM / SCM).
 *
 * 3. VOLTAGE-FREQUENCY WALL & POWER (GHz / MT/s, V, W):
 *    Unified across CPU, GPU, and Memory:
 *    V_min(f) = V_nom * (0.72 + 0.28 * (f / f_ref_eff)^1.85) * (1 + 0.035*(bitsPerCell - 1))
 *      where CPU f_ref_eff = f_ref * archClockEff * transClockMult
 *      and   GPU f_ref_eff = f_ref * 0.72 * archClockEff * transClockMult
 *      and   MEM r_ref_eff = min(iface.maxRate, cellArch.refRate * (f_ref/4.3)^0.55 * transClockMult)
 *    P_dyn    = alpha * C_eff * V^2 * f_eff  (scales with clock ratio as P_dyn ∝ f^2.2)
 *    P_leak   = k_leak * eta_leak * N_tr * V * exp((T_j - 25) / 42)
 *               (+ temperature-coupled DRAM/VRAM capacitor refresh power P_refresh(T_j))
 *    P_tunnel = tunnelFloor * (1 - trans.tunnelingMitigation) * N_tr
 *    P_raw    = P_dyn + P_leak + P_tunnel
 *    If P_dyn + P_leak + P_tunnel > powerLimitW inside the thermal loop, f_eff rolls back via P_dyn ∝ f^2.2.
 *
 * 4. THERMAL EQUILIBRIUM & ITERATIVE THROTTLING (deg C, W/mm^2):
 *    Solved via 5-step fixed-point iteration coupling T_j <-> P_leak(T_j) <-> powerLimitW:
 *    heatFlux q = P_eff / max(A, 1)  [W/mm^2]
 *    R_hotspot  = 0.12 * q^0.6 * frontierFluxPenalty  [C/W]
 *    R_stack    = 0.06 * log2(layers) [HBM/3D DRAM] or 0.025 * log2(layers) [3D V-NAND]
 *    T_j = T_amb + P_eff * (max(0.032, (R_cool - R_pkgOffset) * frontierThermal) + R_stack + R_hotspot)
 *    If T_j > T_throttle:
 *       Iteratively solves thermalRatio (up to 6 passes, floor 0.22) scaling P_dyn ∝ ratio^2.2
 *       and recomputing P_leak(T_j), q, and T_j until T_j <= T_throttle or the 0.22 floor is hit.
 *       f_sustained = f_target * powerRatio * thermalRatio
 *    Cryogenic cooling adds Carnot refrigeration draw: P_carnot = P_eff * carnotOverheadFactor.
 *
 * 5. MURPHY / SQUARED-POISSON WAFER YIELD (defects/cm^2, %):
 *    A_scribe = (sqrt(A) + 0.2)^2  [mm^2], edge exclusion e = 3 mm
 *    N_gross  = floor( pi*(D_w/2 - e)^2 / A_scribe - pi*(D_w - 2e) / sqrt(2 * A_scribe) )
 *    D_eff    = D_base * M_litho * M_trans * M_pkg * M_cleanroom * M_maturation * M_frontier
 *               (* M_cell * M_stack * M_bits * (1 - eccRescue) for memory arrays)
 *               where M_maturation = 0.45 + 0.55 * exp(-0.08 * maturationXP)
 *    Y        = ((1 - exp(-A_cm2 * D_eff)) / (A_cm2 * D_eff))^2 * eta_QA
 *
 * 6. PERFORMANCE & ROOFLINE BOTTLENECK MODEL:
 *    - CPU Multi-Core uses Amdahl + Interconnect contention:
 *      Scale(C) = C / (1 + 0.025*(C-1) + beta_interconnect * C^1.35 / pkg.interconnectBonus)
 *      Combined smoothly with RAM Bandwidth ceiling (GB/s) via harmonic roofline.
 *      PCIe aggregate bandwidth (lanes * perLaneGBs(maxPcieGen)) feeds General Compute & Gaming
 *      with logarithmic diminishing returns and flags I/O bottlenecks when undersized.
 *    - GPU Rendering combines Shader FLOPS, Pixel/Texel Fill-Rate (ROPs/TMUs), and
 *      VRAM Bandwidth (BusWidth/8 * DataRate * Compression) aided by L1 + L2 cache relief
 *      (1 + 0.14*ln(1 + L2_MB/2) + 0.04*ln(1 + L1_MB/0.016)). VRAM capacity does NOT boost
 *      speed linearly; it governs a Workload Footprint Cap penalty only when undersized.
 *    - Memory & Storage balances Sequential Bandwidth ((BusWidth/8) * sustainedMT/s),
 *      Random Access Latency/IOPS (bank parallelism vs. multi-bit voltage sensing & ECC overhead),
 *      Areal Bit Density (Gbit/mm^2), and Program/Erase Endurance TBW (SLC..PLC vs. LDPC ECC).
 *
 * 7. CUMULATIVE R&D ENGINEERING MODIFIERS (590+ Tech Tree Nodes):
 *    Aggregated via getAggregatedTechModifiers(unlockedTechIds) with smooth physical caps:
 *    - logicDensityMult (≤3.5×), sramDensityMult (≤3.0×), defectReductionMult (≥0.25×),
 *      leakageReductionMult (≥0.25×), clockHeadroomMult (≤1.45×, lowers V_min & switching energy),
 *      ipcBonusMult (≤2.4×), gpuComputeMult (≤2.8×), memoryBandwidthMult (≤2.8×),
 *      coolingEfficiencyMult (≤2.2×).
 *
 * LIMITATIONS:
 *    - Steady-state DC thermal equilibrium (no transient ms turbo thermal capacitance).
 *    - Uniform-random defect clustering approximated via Murphy squared-Poisson formula.
 *    - Abstracted macro-engineering models rather than cycle-accurate RTL gate simulation.
 */

import {
  getAggregatedTechModifiers,
  getBestLithography,
  getCoolingSpec,
  getCpuArch,
  getGpuArch,
  getMaxPcieGen,
  getMaxWaferDiameterMm,
  getMemoryCellArch,
  getMemoryInterface,
  getMemoryTech,
  getPackagingSpec,
  getPcieBandwidthPerLaneGBs,
  getProcessNode,
  getTransistorStructure,
  getUnlockedMemoryCellArchs,
  getUnlockedMemoryInterfaces,
  ISA_EXTENSIONS,
  MEMORY_CELL_ARCHS,
  MEMORY_INTERFACES,
} from './catalog';
import type {
  BottleneckDiagnostic,
  ChipBenchmarkReport,
  ChipBlueprint,
  ChipEvaluation,
  ChipPhysicsReport,
  CpuBlueprint,
  DieBlockRect,
  GpuBlueprint,
  MemoryBlueprint,
  MemoryCategory,
} from './types';

// ─── DOCUMENTED PHYSICS & UI TUNING CONSTANTS ───────────────────────────────
/** Power-frequency scaling exponent for dynamic power rollback (P_dyn ∝ f^2.2). */
export const POWER_FREQ_EXPONENT = 2.2;
/** GPU effective reference clock multiplier relative to process node refClockGHz. */
export const GPU_REF_CLOCK_FACTOR = 0.72;
/** Unified voltage-frequency wall baseline fraction at low clocks (V_min = V_nom * (base + slope * ratio^exp)). */
export const V_MIN_BASE = 0.72;
/** Unified voltage-frequency wall slope coefficient across CPU and GPU. */
export const V_MIN_SLOPE = 0.28;
/** Voltage-frequency wall non-linearity exponent. */
export const V_MIN_EXPONENT = 1.85;
/** Max slider clock ratio above effective reference clock so V_min(R) <= 1.45 * V_nom (0.72 + 0.28*1.55^1.85 ≈ 1.35). */
export const MAX_CLOCK_RATIO_CAP = 1.55;
/** Voltage slider step (V); 0.01 V keeps every nominalVoltageV on an exact slider step. */
export const VOLTAGE_SLIDER_STEP = 0.01;
/** Minimum core voltage slider bound (V). */
export const VOLTAGE_SLIDER_MIN = 0.25;
/** Baseline maximum voltage multiplier over process node nominal voltage. */
export const VOLTAGE_MAX_MULTIPLIER = 1.45;
/** Efficiency-core dynamic power multiplier relative to P-core architecture powerMultiplier. */
export const E_CORE_POWER_FACTOR = 0.85;
/** Efficiency-core voltage rail ratio relative to primary Vcore. */
export const E_CORE_VOLTAGE_SCALE = 0.9;
/** Minimum dynamic power fraction preserved during power-limit frequency rollback. */
export const POWER_DYN_FLOOR = 0.08;
/** Minimum clock ratio floor under power-limit throttling. */
export const POWER_RATIO_FLOOR = 0.28;
/** Minimum clock ratio floor under iterative thermal throttling. */
export const THERMAL_RATIO_FLOOR = 0.22;
/** Fixed-point iterations coupling Tj, leakage, and power-limit rollback. */
export const THERMAL_SOLVER_ITERATIONS = 5;
/** Maximum iterations for iterative thermal throttling convergence. */
export const THERMAL_THROTTLE_MAX_ITERATIONS = 6;
/** Valid GPU memory bus widths (bits). */
export const GPU_BUS_WIDTHS = [64, 128, 192, 256, 384, 512, 1024, 2048, 4096] as const;
/** Max slider data-rate ratio above effective memory reference rate. */
export const MEMORY_MAX_RATE_RATIO_CAP = 1.48;
/** Valid Memory bank / plane counts. */
export const MEMORY_BANK_COUNTS = [4, 8, 16, 32, 64] as const;
/** Multi-bit cell naming & physical trade-offs (1=SLC/1T1C .. 5=PLC). */
export const BITS_PER_CELL_META = [
  { bits: 1, shortLabel: 'SLC / 1-bit', states: 2, enduranceMult: 1.0, latencyMult: 1.0 },
  { bits: 2, shortLabel: 'MLC (2-bit)', states: 4, enduranceMult: 0.32, latencyMult: 1.45 },
  { bits: 3, shortLabel: 'TLC (3-bit)', states: 8, enduranceMult: 0.08, latencyMult: 2.1 },
  { bits: 4, shortLabel: 'QLC (4-bit)', states: 16, enduranceMult: 0.02, latencyMult: 3.1 },
  { bits: 5, shortLabel: 'PLC (5-bit)', states: 32, enduranceMult: 0.005, latencyMult: 4.4 },
] as const;
/** On-die ECC & spare redundancy tiers. */
export const ECC_LEVEL_META = [
  { level: 0, label: 'None', areaOverhead: 0.0, defectMitigation: 0.0, enduranceMult: 1.0, latencyMult: 1.0 },
  { level: 1, label: 'SECDED', areaOverhead: 0.06, defectMitigation: 0.16, enduranceMult: 1.35, latencyMult: 1.04 },
  { level: 2, label: 'LDPC', areaOverhead: 0.14, defectMitigation: 0.3, enduranceMult: 2.1, latencyMult: 1.1 },
  { level: 3, label: 'Deep AI-LDPC', areaOverhead: 0.24, defectMitigation: 0.42, enduranceMult: 3.4, latencyMult: 1.18 },
] as const;

export interface SliderRange {
  min: number;
  max: number;
  step: number;
}

export interface PhysicsContext {
  unlockedTechIds: string[];
  maturationXp: number;
  cleanroomGrade: number; // 1..5
  qaBudgetLevel: number; // 1..5
  qaStrictness?: number; // 0.5..1.5
  frontierLevels: Record<string, number>;
}

export interface PhysicsDocEntry {
  title: string;
  equation: string;
  units: string;
  assumptions: string;
}

export const PHYSICS_DOCUMENTATION: PhysicsDocEntry[] = [
  {
    title: 'Die Area & SRAM Scaling Divergence',
    equation: 'A = (N_logic / (δ_logic · η_trans · F_dens) + N_cache / (δ_SRAM · √η_trans · F_dens)) · (1 + γ_route) + A_IO',
    units: 'mm², MTr/mm²',
    assumptions: '6T SRAM + ECC overhead = 6.4 MTr/MB. Below 5 nm, SRAM density scales slower than logic.',
  },
  {
    title: 'Voltage-Frequency Wall & Dynamic Power',
    equation: 'V_min(f) = V_nom · (0.72 + 0.28 · (f / f_ref_eff)^1.85)  |  P_dyn = α · C_eff · V² · f_eff  (P_dyn ∝ f^2.2)',
    units: 'V, GHz, W',
    assumptions: 'Unified V_min curve for CPU and GPU (GPU f_ref_eff includes 0.72× factor). Exceeding power limit invokes P_dyn ∝ f^2.2 rollback.',
  },
  {
    title: 'Leakage, Quantum Tunneling & Iterative Thermal Loop',
    equation: 'P_leak = k_leak · N_tr · V · exp((T_j − 25)/42) + P_tunnel  |  T_j = T_amb + P_eff · (R_θ + 0.12 · q^0.6)',
    units: 'W, °C, W/mm², °C/W',
    assumptions: '5-step fixed-point solver couples T_j, P_leak, and power-limit rollback; up to 6-pass thermal loop settles T_j ≤ T_throttle (0.22× floor).',
  },
  {
    title: 'Murphy Wafer Yield & Process Maturation',
    equation: 'Y = ((1 − exp(−A_cm² · D_eff)) / (A_cm² · D_eff))² · η_QA  |  M_mat = 0.45 + 0.55 · exp(−0.08 · XP)',
    units: 'defects/cm², cm², %',
    assumptions: 'Squared-Poisson Murphy model with 3 mm wafer edge exclusion and 0.2 mm scribe lanes.',
  },
  {
    title: 'Roofline Bandwidth, Caches & PCIe I/O',
    equation: 'Scale(C) = C / (1 + 0.025(C−1) + β · C^1.35 / η_pkg)  |  BW_VRAM = (Bus/8) · MT/s · η_comp · (1 + 0.14·ln(1+L2/2) + 0.04·ln(1+L1/0.016))',
    units: 'GB/s, GFLOPS',
    assumptions: 'CPU PCIe bandwidth (lanes × gen GB/s) feeds General Compute & Gaming with diminishing returns. GPU VRAM capacity enforces footprint sufficiency.',
  },
  {
    title: 'Memory & Solid-State 3D Array Physics',
    equation: 'ρ_eff = ρ_base · (δ_SRAM/44)^0.72 · √η_trans · L^α · b / (1 + ε_ECC)  |  BW = (Bus/8) · MT/s_eff',
    units: 'Gbit/mm², GB/s, ns, TBW',
    assumptions: '3D stacks compound defect & TSV thermal resistance (0.06·log₂L °C/W). Multi-bit cells (SLC→PLC) scale density linearly while cutting P/E endurance exponentially unless shielded by LDPC ECC.',
  },
  {
    title: 'Constrained Frontier Synthesis',
    equation: 'Cost(L) = RP_0 · r^L  |  Gain(L) = c · ln(1 + k · L)',
    units: 'RP, dimensionless multiplier',
    assumptions: 'Exponential RP escalation, logarithmic diminishing returns, plus physical trade-offs (Carnot overhead, flux sensitivity, metrology power).',
  },
  {
    title: 'Cumulative R&D Engineering Modifiers',
    equation: 'M_k = clamp(∏_{t ∈ U} m_{k,t}, cap_min, cap_max)',
    units: 'dimensionless multiplier',
    assumptions: '590+ research nodes compound smoothly into density, defect D0, leakage, clock voltage headroom, IPC, GPU compute, memory BW, and thermal efficiency within physical caps.',
  },
];

// ─── SHARED CLOCK / VOLTAGE / SLIDER BOUNDS & CLAMPING HELPERS ──────────────

function roundToPrecision(val: number, step: number): number {
  const decimals = step < 0.01 ? 3 : step < 0.1 ? 2 : step < 1 ? 3 : 0;
  return Number(val.toFixed(decimals));
}

export function clampToSlider(value: number, range: SliderRange): number {
  const clamped = Math.max(range.min, Math.min(range.max, value));
  const steps = Math.round((clamped - range.min) / range.step);
  const snapped = Math.max(range.min, Math.min(range.max, range.min + steps * range.step));
  return roundToPrecision(snapped, range.step);
}

/**
 * Computes the lowest voltage aligned to the voltage slider grid that clears Vmin
 * with a clean +1 step stability margin, clamped safely within [range.min, range.max].
 */
export function getStabilizedVoltageV(minStableVoltageV: number, range: SliderRange): number {
  const target = Math.max(range.min, minStableVoltageV + VOLTAGE_SLIDER_STEP);
  const steps = Math.ceil((target - range.min - 1e-9) / range.step);
  const snapped = Math.min(range.max, Math.max(range.min, range.min + Math.max(0, steps) * range.step));
  return roundToPrecision(snapped, range.step);
}

export function getEffectiveRefClockGHz(
  kind: 'cpu' | 'gpu',
  nodeId: string,
  archId: string,
  transId: string
): number {
  const node = getProcessNode(nodeId);
  const trans = getTransistorStructure(transId);
  if (kind === 'cpu') {
    const arch = getCpuArch(archId);
    return node.refClockGHz * arch.clockEfficiency * trans.clockMultiplier;
  }
  const arch = getGpuArch(archId);
  return node.refClockGHz * GPU_REF_CLOCK_FACTOR * arch.clockEfficiency * trans.clockMultiplier;
}

export function getClockStepForMax(maxClockGHz: number): number {
  return maxClockGHz < 0.2 ? 0.002 : maxClockGHz < 2 ? 0.02 : 0.05;
}

export function computeMinStableVoltageV(
  kind: 'cpu' | 'gpu',
  nodeId: string,
  archId: string,
  transId: string,
  clockGHz: number
): number {
  const node = getProcessNode(nodeId);
  const effectiveRefClockGHz = getEffectiveRefClockGHz(kind, nodeId, archId, transId);
  const clockRatio = clockGHz / Math.max(0.005, effectiveRefClockGHz);
  return Number(
    (
      node.nominalVoltageV *
      (V_MIN_BASE + V_MIN_SLOPE * Math.pow(Math.max(0.1, clockRatio), V_MIN_EXPONENT))
    ).toFixed(3)
  );
}

/**
 * Returns the maximum target clock slider ceiling (GHz) aligned to clockStep,
 * using the exact same effective reference clock as the evaluator so V_min(maxClock)
 * always stays within the voltage slider range.
 */
export function getMaxClockForArch(
  kind: 'cpu' | 'gpu',
  nodeId: string,
  archId: string,
  transId: string
): number {
  const effRef = getEffectiveRefClockGHz(kind, nodeId, archId, transId);
  const rawMax = effRef * MAX_CLOCK_RATIO_CAP;
  const step = getClockStepForMax(rawMax);
  const snapped = Math.floor((rawMax + 1e-9) / step) * step;
  return Math.max(step, roundToPrecision(snapped, step));
}

export function getMinClockForArch(
  kind: 'cpu' | 'gpu',
  nodeId: string,
  archId: string,
  transId: string
): number {
  const maxClock = getMaxClockForArch(kind, nodeId, archId, transId);
  const step = getClockStepForMax(maxClock);
  const effRef = getEffectiveRefClockGHz(kind, nodeId, archId, transId);
  const rawMin = Math.max(0.004, effRef * (kind === 'cpu' ? 0.35 : 0.25));
  const snapped = Math.round(rawMin / step) * step;
  return Math.min(maxClock, Math.max(step, roundToPrecision(snapped, step)));
}

export function getMaxVoltageForConfig(
  kind: 'cpu' | 'gpu',
  nodeId: string,
  archId: string,
  transId: string
): number {
  const node = getProcessNode(nodeId);
  const maxClock = getMaxClockForArch(kind, nodeId, archId, transId);
  const vMinAtMax = computeMinStableVoltageV(kind, nodeId, archId, transId, maxClock);
  const baseMax = Math.max(1.8, node.nominalVoltageV * VOLTAGE_MAX_MULTIPLIER);
  const required = Math.max(baseMax, vMinAtMax + VOLTAGE_SLIDER_STEP);
  const steps = Math.ceil((required - VOLTAGE_SLIDER_MIN - 1e-9) / VOLTAGE_SLIDER_STEP);
  return Number((VOLTAGE_SLIDER_MIN + Math.max(1, steps) * VOLTAGE_SLIDER_STEP).toFixed(2));
}

export function getMaxBusWidthForVram(vramTechId: string): number {
  return vramTechId === 'vram_hbm' || vramTechId === 'vram_photonic' ? 4096 : 512;
}

export function getCpuSliderBounds(
  draft: Pick<CpuBlueprint, 'processNodeId' | 'architectureId' | 'transistorStructureId' | 'pClockGHz'>
): {
  pCores: SliderRange;
  eCores: SliderRange;
  pClockGHz: SliderRange;
  eClockGHz: SliderRange;
  voltageV: SliderRange;
  ipcTuning: SliderRange;
  l1CacheKBPerCore: SliderRange;
  l2CacheMBTotal: SliderRange;
  l3CacheMBTotal: SliderRange;
  memoryChannels: SliderRange;
  pcieLanes: SliderRange;
  powerLimitW: SliderRange;
  igpuTier: SliderRange;
  npuTier: SliderRange;
} {
  const node = getProcessNode(draft.processNodeId);
  const arch = getCpuArch(draft.architectureId);
  const pClockMax = getMaxClockForArch('cpu', draft.processNodeId, draft.architectureId, draft.transistorStructureId);
  const clockStep = getClockStepForMax(pClockMax);
  const pClockMin = getMinClockForArch('cpu', draft.processNodeId, draft.architectureId, draft.transistorStructureId);

  const effRef = getEffectiveRefClockGHz('cpu', draft.processNodeId, draft.architectureId, draft.transistorStructureId);
  const rawEMin = Math.max(0.004, effRef * 0.25);
  const eClockMin = Math.min(
    pClockMax,
    Math.max(clockStep, roundToPrecision(Math.round(rawEMin / clockStep) * clockStep, clockStep))
  );
  const clampedPClock = clampToSlider(draft.pClockGHz, { min: pClockMin, max: pClockMax, step: clockStep });
  const eClockMax = Math.max(eClockMin, clampedPClock);

  const l2Range: SliderRange =
    node.featureSizeNm > 1000
      ? { min: 0, max: 0.256, step: 0.004 }
      : node.featureSizeNm > 50
        ? { min: 0, max: 16, step: 0.5 }
        : { min: 0, max: 128, step: 0.5 };

  const l3Range: SliderRange =
    node.featureSizeNm > 1000
      ? { min: 0, max: 1, step: 0.25 }
      : node.featureSizeNm > 50
        ? { min: 0, max: 32, step: 2 }
        : { min: 0, max: 512, step: 2 };

  return {
    pCores: { min: 1, max: arch.maxPCores, step: 1 },
    eCores: { min: 0, max: arch.supportsECores ? arch.maxECores : 0, step: 1 },
    pClockGHz: { min: pClockMin, max: pClockMax, step: clockStep },
    eClockGHz: { min: eClockMin, max: eClockMax, step: clockStep },
    voltageV: {
      min: VOLTAGE_SLIDER_MIN,
      max: getMaxVoltageForConfig('cpu', draft.processNodeId, draft.architectureId, draft.transistorStructureId),
      step: VOLTAGE_SLIDER_STEP,
    },
    ipcTuning: { min: 0.85, max: arch.maxIpcTuning, step: 0.05 },
    l1CacheKBPerCore: { min: 2, max: 256, step: 2 },
    l2CacheMBTotal: l2Range,
    l3CacheMBTotal: l3Range,
    memoryChannels: { min: 1, max: 16, step: 1 },
    pcieLanes: { min: 4, max: 128, step: 4 },
    powerLimitW: { min: 5, max: 1200, step: 5 },
    igpuTier: { min: 0, max: 5, step: 1 },
    npuTier: { min: 0, max: 5, step: 1 },
  };
}

export function getGpuSliderBounds(
  draft: Pick<GpuBlueprint, 'processNodeId' | 'architectureId' | 'transistorStructureId' | 'vramTechId'>
): {
  shaderCores: SliderRange;
  clockGHz: SliderRange;
  rops: SliderRange;
  tmus: SliderRange;
  voltageV: SliderRange;
  vramCapacityGB: SliderRange;
  l1CacheMB: SliderRange;
  l2CacheMB: SliderRange;
  powerLimitW: SliderRange;
  maxBusWidthBits: number;
} {
  const node = getProcessNode(draft.processNodeId);
  const arch = getGpuArch(draft.architectureId);
  const clockMax = getMaxClockForArch('gpu', draft.processNodeId, draft.architectureId, draft.transistorStructureId);
  const clockStep = getClockStepForMax(clockMax);
  const clockMin = getMinClockForArch('gpu', draft.processNodeId, draft.architectureId, draft.transistorStructureId);

  const shaderStep = arch.maxShaderCores > 2000 ? 64 : arch.maxShaderCores > 256 ? 8 : 2;
  const maxRops = Math.max(16, Math.min(512, Math.floor(arch.maxShaderCores / 16 / 2) * 2));
  const maxTmus = Math.max(32, Math.min(1024, Math.floor(arch.maxShaderCores / 8 / 2) * 2));

  const vramCapacityGB: SliderRange =
    draft.vramTechId === 'vram_sdr'
      ? { min: 0.125, max: 2, step: 0.125 }
      : draft.vramTechId === 'vram_gddr5'
        ? { min: 2, max: 16, step: 2 }
        : { min: 2, max: 256, step: 2 };

  const l1CacheMB: SliderRange =
    node.featureSizeNm > 500
      ? { min: 0.004, max: 0.5, step: 0.004 }
      : { min: 0.5, max: 32, step: 0.5 };

  const l2CacheMB: SliderRange =
    node.featureSizeNm > 500
      ? { min: 0.008, max: 2, step: 0.008 }
      : { min: 2, max: 192, step: 2 };

  return {
    shaderCores: { min: shaderStep, max: arch.maxShaderCores, step: shaderStep },
    clockGHz: { min: clockMin, max: clockMax, step: clockStep },
    rops: { min: 2, max: maxRops, step: 2 },
    tmus: { min: 2, max: maxTmus, step: 2 },
    voltageV: {
      min: VOLTAGE_SLIDER_MIN,
      max: getMaxVoltageForConfig('gpu', draft.processNodeId, draft.architectureId, draft.transistorStructureId),
      step: VOLTAGE_SLIDER_STEP,
    },
    vramCapacityGB,
    l1CacheMB,
    l2CacheMB,
    powerLimitW: { min: 10, max: 1400, step: 10 },
    maxBusWidthBits: getMaxBusWidthForVram(draft.vramTechId),
  };
}

export function applyCpuNodeChange(draft: CpuBlueprint, nodeId: string): CpuBlueprint {
  const node = getProcessNode(nodeId);
  const effRef = getEffectiveRefClockGHz('cpu', nodeId, draft.architectureId, draft.transistorStructureId);
  const nextDraftBase = { ...draft, processNodeId: nodeId };
  const bounds = getCpuSliderBounds(nextDraftBase);
  const pClockGHz = clampToSlider(effRef, bounds.pClockGHz);
  const boundsWithP = getCpuSliderBounds({ ...nextDraftBase, pClockGHz });
  const eClockGHz = clampToSlider(effRef * 0.72, boundsWithP.eClockGHz);
  const voltageV = clampToSlider(node.nominalVoltageV, boundsWithP.voltageV);
  return {
    ...nextDraftBase,
    pClockGHz,
    eClockGHz,
    voltageV,
    l2CacheMBTotal: clampToSlider(draft.l2CacheMBTotal, boundsWithP.l2CacheMBTotal),
    l3CacheMBTotal: clampToSlider(draft.l3CacheMBTotal, boundsWithP.l3CacheMBTotal),
  };
}

export function applyCpuArchChange(draft: CpuBlueprint, archId: string): CpuBlueprint {
  const arch = getCpuArch(archId);
  const nextDraftBase = { ...draft, architectureId: archId };
  const bounds = getCpuSliderBounds(nextDraftBase);
  const pClockGHz = clampToSlider(draft.pClockGHz, bounds.pClockGHz);
  const boundsWithP = getCpuSliderBounds({ ...nextDraftBase, pClockGHz });
  return {
    ...nextDraftBase,
    pCores: clampToSlider(draft.pCores, boundsWithP.pCores),
    eCores: arch.supportsECores ? clampToSlider(draft.eCores, boundsWithP.eCores) : 0,
    ipcTuning: clampToSlider(draft.ipcTuning, boundsWithP.ipcTuning),
    pClockGHz,
    eClockGHz: clampToSlider(draft.eClockGHz, boundsWithP.eClockGHz),
    voltageV: clampToSlider(draft.voltageV, boundsWithP.voltageV),
  };
}

export function applyCpuTransistorChange(draft: CpuBlueprint, transId: string): CpuBlueprint {
  const nextDraftBase = { ...draft, transistorStructureId: transId };
  const bounds = getCpuSliderBounds(nextDraftBase);
  const pClockGHz = clampToSlider(draft.pClockGHz, bounds.pClockGHz);
  const boundsWithP = getCpuSliderBounds({ ...nextDraftBase, pClockGHz });
  return {
    ...nextDraftBase,
    pClockGHz,
    eClockGHz: clampToSlider(draft.eClockGHz, boundsWithP.eClockGHz),
    voltageV: clampToSlider(draft.voltageV, boundsWithP.voltageV),
  };
}

export function applyGpuNodeChange(draft: GpuBlueprint, nodeId: string): GpuBlueprint {
  const node = getProcessNode(nodeId);
  const effRef = getEffectiveRefClockGHz('gpu', nodeId, draft.architectureId, draft.transistorStructureId);
  const nextDraftBase = { ...draft, processNodeId: nodeId };
  const bounds = getGpuSliderBounds(nextDraftBase);
  return {
    ...nextDraftBase,
    clockGHz: clampToSlider(effRef, bounds.clockGHz),
    voltageV: clampToSlider(node.nominalVoltageV, bounds.voltageV),
    l1CacheMB: clampToSlider(draft.l1CacheMB, bounds.l1CacheMB),
    l2CacheMB: clampToSlider(draft.l2CacheMB, bounds.l2CacheMB),
  };
}

export function applyGpuArchChange(draft: GpuBlueprint, archId: string): GpuBlueprint {
  const nextDraftBase = { ...draft, architectureId: archId };
  const bounds = getGpuSliderBounds(nextDraftBase);
  return {
    ...nextDraftBase,
    shaderCores: clampToSlider(draft.shaderCores, bounds.shaderCores),
    rops: clampToSlider(draft.rops, bounds.rops),
    tmus: clampToSlider(draft.tmus, bounds.tmus),
    clockGHz: clampToSlider(draft.clockGHz, bounds.clockGHz),
    voltageV: clampToSlider(draft.voltageV, bounds.voltageV),
  };
}

export function applyGpuTransistorChange(draft: GpuBlueprint, transId: string): GpuBlueprint {
  const nextDraftBase = { ...draft, transistorStructureId: transId };
  const bounds = getGpuSliderBounds(nextDraftBase);
  return {
    ...nextDraftBase,
    clockGHz: clampToSlider(draft.clockGHz, bounds.clockGHz),
    voltageV: clampToSlider(draft.voltageV, bounds.voltageV),
  };
}

export function applyGpuVramChange(draft: GpuBlueprint, vramTechId: string): GpuBlueprint {
  const nextDraftBase = { ...draft, vramTechId };
  const bounds = getGpuSliderBounds(nextDraftBase);
  const allowedBuses = GPU_BUS_WIDTHS.filter((b) => b <= bounds.maxBusWidthBits);
  const clampedBus = allowedBuses.includes(draft.memoryBusWidthBits as (typeof GPU_BUS_WIDTHS)[number])
    ? draft.memoryBusWidthBits
    : allowedBuses[allowedBuses.length - 1] ?? 64;
  return {
    ...nextDraftBase,
    memoryBusWidthBits: clampedBus,
    vramCapacityGB: clampToSlider(draft.vramCapacityGB, bounds.vramCapacityGB),
  };
}

// ─── MEMORY & STORAGE BOUNDS & TRANSITION HELPERS ───────────────────────────

export function getEffectiveRefMemoryDataRateMTs(
  nodeId: string,
  cellArchId: string,
  interfaceId: string,
  transId: string
): number {
  const node = getProcessNode(nodeId);
  const cellArch = getMemoryCellArch(cellArchId);
  const iface = getMemoryInterface(interfaceId);
  const trans = getTransistorStructure(transId);
  const nodeRateScale = Math.min(1.65, Math.max(0.15, Math.pow(node.refClockGHz / 4.3, 0.55)));
  const rawRef = cellArch.refDataRateMTs * nodeRateScale * trans.clockMultiplier;
  return Math.max(10, Math.min(iface.maxDataRateMTs, rawRef));
}

export function getMemoryDataRateStepForMax(maxRateMTs: number): number {
  if (maxRateMTs <= 100) return 2;
  if (maxRateMTs <= 800) return 10;
  if (maxRateMTs <= 4000) return 50;
  if (maxRateMTs <= 16000) return 100;
  return 250;
}

export function getMaxMemoryDataRateMTs(
  nodeId: string,
  cellArchId: string,
  interfaceId: string,
  transId: string
): number {
  const iface = getMemoryInterface(interfaceId);
  const effRef = getEffectiveRefMemoryDataRateMTs(nodeId, cellArchId, interfaceId, transId);
  const rawMax = Math.min(iface.maxDataRateMTs, effRef * MEMORY_MAX_RATE_RATIO_CAP);
  const step = getMemoryDataRateStepForMax(rawMax);
  const snapped = Math.floor((rawMax + 1e-9) / step) * step;
  return Math.max(step, roundToPrecision(snapped, step));
}

export function getMinMemoryDataRateMTs(
  nodeId: string,
  cellArchId: string,
  interfaceId: string,
  transId: string
): number {
  const maxRate = getMaxMemoryDataRateMTs(nodeId, cellArchId, interfaceId, transId);
  const step = getMemoryDataRateStepForMax(maxRate);
  const effRef = getEffectiveRefMemoryDataRateMTs(nodeId, cellArchId, interfaceId, transId);
  const rawMin = Math.max(step, effRef * 0.35);
  const snapped = Math.round(rawMin / step) * step;
  return Math.min(maxRate, Math.max(step, roundToPrecision(snapped, step)));
}

export function computeMinStableMemoryVoltageV(
  nodeId: string,
  cellArchId: string,
  interfaceId: string,
  transId: string,
  dataRateMTs: number,
  bitsPerCell: number
): number {
  const node = getProcessNode(nodeId);
  const effRef = getEffectiveRefMemoryDataRateMTs(nodeId, cellArchId, interfaceId, transId);
  const rateRatio = dataRateMTs / Math.max(10, effRef);
  const multiBitMargin = 1 + Math.max(0, bitsPerCell - 1) * 0.035;
  return Number(
    (
      node.nominalVoltageV *
      (V_MIN_BASE + V_MIN_SLOPE * Math.pow(Math.max(0.1, rateRatio), V_MIN_EXPONENT)) *
      multiBitMargin
    ).toFixed(3)
  );
}

export function getMaxMemoryVoltageForConfig(
  nodeId: string,
  cellArchId: string,
  interfaceId: string,
  transId: string,
  bitsPerCell: number
): number {
  const node = getProcessNode(nodeId);
  const maxRate = getMaxMemoryDataRateMTs(nodeId, cellArchId, interfaceId, transId);
  const vMinAtMax = computeMinStableMemoryVoltageV(
    nodeId,
    cellArchId,
    interfaceId,
    transId,
    maxRate,
    bitsPerCell
  );
  const baseMax = Math.max(1.8, node.nominalVoltageV * VOLTAGE_MAX_MULTIPLIER);
  const required = Math.max(baseMax, vMinAtMax + VOLTAGE_SLIDER_STEP);
  const steps = Math.ceil((required - VOLTAGE_SLIDER_MIN - 1e-9) / VOLTAGE_SLIDER_STEP);
  return Number((VOLTAGE_SLIDER_MIN + Math.max(1, steps) * VOLTAGE_SLIDER_STEP).toFixed(2));
}

export function getAllowedStackLayersForArch(cellArchId: string): number[] {
  const cellArch = getMemoryCellArch(cellArchId);
  const maxL = cellArch.maxStackLayers;
  if (maxL <= 1) return [1];
  const candidates = [1, 2, 4, 8, 12, 16, 32, 64, 96, 128, 176, 232, 256, 384, 512];
  const filtered = candidates.filter((v) => v <= maxL);
  if (!filtered.includes(maxL)) filtered.push(maxL);
  return filtered;
}

export function getMemoryCapacityRange(
  nodeId: string,
  cellArchId: string,
  transId: string,
  stackLayers: number,
  bitsPerCell: number
): SliderRange {
  const node = getProcessNode(nodeId);
  const cellArch = getMemoryCellArch(cellArchId);
  const trans = getTransistorStructure(transId);

  const nodeDensityScale =
    Math.pow(node.sramDensityMTrPerMm2 / 44, 0.72) * Math.sqrt(trans.densityMultiplier);
  const layerAlpha = cellArch.category === 'rom_nand' ? 0.91 : 0.94;
  const effectiveLayerGain = Math.pow(Math.max(1, stackLayers), layerAlpha);
  const nomGbitPerMm2 =
    cellArch.baseGbitPerMm2 * nodeDensityScale * effectiveLayerGain * Math.max(1, bitsPerCell);
  const maxReasonableGB = (nomGbitPerMm2 * 420) / 8;

  if (maxReasonableGB < 0.02) return { min: 0.001, max: 0.032, step: 0.001 };
  if (maxReasonableGB < 0.12) return { min: 0.004, max: 0.128, step: 0.004 };
  if (maxReasonableGB < 0.5) return { min: 0.016, max: 0.512, step: 0.016 };
  if (maxReasonableGB < 2.0) return { min: 0.064, max: 2, step: 0.064 };
  if (maxReasonableGB < 8.0) return { min: 0.25, max: 16, step: 0.25 };
  if (maxReasonableGB < 32) return { min: 1, max: 64, step: 1 };
  if (maxReasonableGB < 128) return { min: 4, max: 256, step: 4 };
  if (maxReasonableGB < 512) return { min: 16, max: 1024, step: 16 };
  if (maxReasonableGB < 2048) return { min: 64, max: 4096, step: 64 };
  return { min: 256, max: 16384, step: 256 };
}

export function getMemorySliderBounds(
  draft: Pick<
    MemoryBlueprint,
    | 'processNodeId'
    | 'cellArchId'
    | 'interfaceId'
    | 'transistorStructureId'
    | 'stackLayers'
    | 'bitsPerCell'
  >
): {
  capacityGB: SliderRange;
  stackLayersOptions: number[];
  bitsPerCell: SliderRange;
  dataRateMTs: SliderRange;
  voltageV: SliderRange;
  busWidthOptions: number[];
  bankCountOptions: readonly number[];
  eccLevel: SliderRange;
  powerLimitW: SliderRange;
} {
  const cellArch = getMemoryCellArch(draft.cellArchId);
  const iface = getMemoryInterface(draft.interfaceId);
  const clampedBits = Math.max(1, Math.min(cellArch.maxBitsPerCell, draft.bitsPerCell));
  const stackLayersOptions = getAllowedStackLayersForArch(draft.cellArchId);
  const clampedLayers = stackLayersOptions.includes(draft.stackLayers)
    ? draft.stackLayers
    : stackLayersOptions[stackLayersOptions.length - 1] ?? 1;

  const rateMax = getMaxMemoryDataRateMTs(
    draft.processNodeId,
    draft.cellArchId,
    draft.interfaceId,
    draft.transistorStructureId
  );
  const rateStep = getMemoryDataRateStepForMax(rateMax);
  const rateMin = getMinMemoryDataRateMTs(
    draft.processNodeId,
    draft.cellArchId,
    draft.interfaceId,
    draft.transistorStructureId
  );

  return {
    capacityGB: getMemoryCapacityRange(
      draft.processNodeId,
      draft.cellArchId,
      draft.transistorStructureId,
      clampedLayers,
      clampedBits
    ),
    stackLayersOptions,
    bitsPerCell: { min: 1, max: cellArch.maxBitsPerCell, step: 1 },
    dataRateMTs: { min: rateMin, max: rateMax, step: rateStep },
    voltageV: {
      min: VOLTAGE_SLIDER_MIN,
      max: getMaxMemoryVoltageForConfig(
        draft.processNodeId,
        draft.cellArchId,
        draft.interfaceId,
        draft.transistorStructureId,
        clampedBits
      ),
      step: VOLTAGE_SLIDER_STEP,
    },
    busWidthOptions: iface.busWidths,
    bankCountOptions: MEMORY_BANK_COUNTS,
    eccLevel: { min: 0, max: 3, step: 1 },
    powerLimitW: { min: 2, max: 350, step: 2 },
  };
}

function clampMemoryDraftToBounds(draft: MemoryBlueprint, resetRateAndVoltage = false): MemoryBlueprint {
  const cellArch = getMemoryCellArch(draft.cellArchId);
  const iface = getMemoryInterface(draft.interfaceId);
  const stackOptions = getAllowedStackLayersForArch(draft.cellArchId);
  const stackLayers = stackOptions.includes(draft.stackLayers)
    ? draft.stackLayers
    : stackOptions[Math.min(stackOptions.length - 1, Math.floor(stackOptions.length / 2))] ?? 1;
  const bitsPerCell = Math.max(1, Math.min(cellArch.maxBitsPerCell, Math.round(draft.bitsPerCell)));
  const busWidthBits = iface.busWidths.includes(draft.busWidthBits)
    ? draft.busWidthBits
    : iface.busWidths[Math.min(1, iface.busWidths.length - 1)] ?? iface.busWidths[0];

  const baseDraft: MemoryBlueprint = {
    ...draft,
    memoryCategory: cellArch.category,
    stackLayers,
    bitsPerCell,
    busWidthBits,
  };
  const bounds = getMemorySliderBounds(baseDraft);
  const effRef = getEffectiveRefMemoryDataRateMTs(
    baseDraft.processNodeId,
    baseDraft.cellArchId,
    baseDraft.interfaceId,
    baseDraft.transistorStructureId
  );

  const dataRateMTs = resetRateAndVoltage
    ? clampToSlider(effRef, bounds.dataRateMTs)
    : clampToSlider(baseDraft.dataRateMTs, bounds.dataRateMTs);

  const vMin = computeMinStableMemoryVoltageV(
    baseDraft.processNodeId,
    baseDraft.cellArchId,
    baseDraft.interfaceId,
    baseDraft.transistorStructureId,
    dataRateMTs,
    bitsPerCell
  );
  const node = getProcessNode(baseDraft.processNodeId);
  const voltageV = resetRateAndVoltage
    ? getStabilizedVoltageV(Math.max(vMin, node.nominalVoltageV - VOLTAGE_SLIDER_STEP), bounds.voltageV)
    : clampToSlider(baseDraft.voltageV, bounds.voltageV);

  // Pick a sensible capacity inside the range if outside
  const capInRange =
    baseDraft.capacityGB >= bounds.capacityGB.min && baseDraft.capacityGB <= bounds.capacityGB.max;
  const targetCap = capInRange
    ? baseDraft.capacityGB
    : bounds.capacityGB.min + (bounds.capacityGB.max - bounds.capacityGB.min) * 0.15;

  return {
    ...baseDraft,
    capacityGB: clampToSlider(targetCap, bounds.capacityGB),
    dataRateMTs,
    voltageV,
    eccLevel: clampToSlider(baseDraft.eccLevel, bounds.eccLevel),
    powerLimitW: clampToSlider(baseDraft.powerLimitW, bounds.powerLimitW),
  };
}

export function applyMemoryCategoryChange(
  draft: MemoryBlueprint,
  category: MemoryCategory,
  unlockedTechIds: string[]
): MemoryBlueprint {
  const unlockedArchs = getUnlockedMemoryCellArchs(category, unlockedTechIds);
  const unlockedIfaces = getUnlockedMemoryInterfaces(category, unlockedTechIds);
  const nextArch =
    unlockedArchs[unlockedArchs.length - 1] ??
    MEMORY_CELL_ARCHS.find((a) => a.category === category) ??
    MEMORY_CELL_ARCHS[0];
  const nextIface =
    unlockedIfaces[unlockedIfaces.length - 1] ??
    MEMORY_INTERFACES.find((i) => i.category === category) ??
    MEMORY_INTERFACES[0];

  const defaultLayers =
    nextArch.maxStackLayers >= 128
      ? 64
      : nextArch.maxStackLayers >= 8
        ? 4
        : 1;
  const defaultBits = nextArch.maxBitsPerCell >= 3 ? 3 : nextArch.maxBitsPerCell >= 2 ? 2 : 1;
  const defaultEcc = nextArch.category === 'rom_nand' ? (defaultBits >= 3 ? 2 : 1) : 1;

  return clampMemoryDraftToBounds(
    {
      ...draft,
      memoryCategory: category,
      cellArchId: nextArch.id,
      interfaceId: nextIface.id,
      stackLayers: Math.min(defaultLayers, nextArch.maxStackLayers),
      bitsPerCell: defaultBits,
      eccLevel: defaultEcc,
      busWidthBits: nextIface.busWidths[Math.min(1, nextIface.busWidths.length - 1)] ?? nextIface.busWidths[0],
    },
    true
  );
}

export function applyMemoryNodeChange(draft: MemoryBlueprint, nodeId: string): MemoryBlueprint {
  return clampMemoryDraftToBounds({ ...draft, processNodeId: nodeId }, true);
}

export function applyMemoryCellArchChange(draft: MemoryBlueprint, cellArchId: string): MemoryBlueprint {
  const cellArch = getMemoryCellArch(cellArchId);
  const stackOptions = getAllowedStackLayersForArch(cellArchId);
  const preferredLayers = stackOptions.includes(draft.stackLayers)
    ? draft.stackLayers
    : stackOptions[Math.min(stackOptions.length - 1, Math.floor(stackOptions.length / 2))] ?? 1;
  return clampMemoryDraftToBounds(
    {
      ...draft,
      cellArchId,
      memoryCategory: cellArch.category,
      stackLayers: preferredLayers,
      bitsPerCell: Math.min(draft.bitsPerCell, cellArch.maxBitsPerCell),
    },
    true
  );
}

export function applyMemoryInterfaceChange(draft: MemoryBlueprint, interfaceId: string): MemoryBlueprint {
  return clampMemoryDraftToBounds({ ...draft, interfaceId }, true);
}

export function applyMemoryTransistorChange(draft: MemoryBlueprint, transId: string): MemoryBlueprint {
  return clampMemoryDraftToBounds({ ...draft, transistorStructureId: transId }, false);
}

export function applyMemoryStackOrBitsChange(
  draft: MemoryBlueprint,
  updates: { stackLayers?: number; bitsPerCell?: number }
): MemoryBlueprint {
  return clampMemoryDraftToBounds(
    {
      ...draft,
      ...(updates.stackLayers !== undefined ? { stackLayers: updates.stackLayers } : {}),
      ...(updates.bitsPerCell !== undefined ? { bitsPerCell: updates.bitsPerCell } : {}),
    },
    false
  );
}

function computeFrontierModifiers(frontierLevels: Record<string, number>) {
  const lDens = frontierLevels['ft_density'] ?? 0;
  const lDef = frontierLevels['ft_defect'] ?? 0;
  const lIpc = frontierLevels['ft_ipc'] ?? 0;
  const lTherm = frontierLevels['ft_thermal'] ?? 0;

  return {
    densityMult: 1 + 0.22 * Math.log(1 + 0.35 * lDens),
    fluxPenaltyMult: 1 + 0.025 * lDens,
    defectMult: 1 / (1 + 0.32 * Math.log(1 + lDef)),
    ipcMult: 1 + 0.18 * Math.log(1 + 0.3 * lIpc),
    tapeOutTimeMult: 1 + 0.06 * lIpc,
    thermalResMult: 1 / (1 + 0.28 * Math.log(1 + lTherm)),
  };
}

function computeGrossDiesPerWafer(waferDiameterMm: number, dieAreaMm2: number): number {
  if (dieAreaMm2 <= 0) return 0;
  const effectiveRadius = waferDiameterMm / 2 - 3; // 3mm edge exclusion
  const effectiveDia = waferDiameterMm - 6;
  const dieSideWithScribe = Math.sqrt(dieAreaMm2) + 0.2;
  const areaScribe = dieSideWithScribe * dieSideWithScribe;
  const gross =
    (Math.PI * effectiveRadius * effectiveRadius) / areaScribe -
    (Math.PI * effectiveDia) / Math.sqrt(2 * areaScribe);
  return Math.max(0, Math.floor(gross));
}

function computeMurphyYield(
  dieAreaMm2: number,
  effectiveDefectDensity: number,
  qaFactor: number
): number {
  const areaCm2 = Math.max(0.01, dieAreaMm2 / 100);
  const lambda = areaCm2 * Math.max(0.005, effectiveDefectDensity);
  const murphy = Math.pow((1 - Math.exp(-lambda)) / lambda, 2);
  return Math.max(1.5, Math.min(99.2, murphy * 100 * qaFactor));
}

export function solveThermalAndPower(params: {
  dynamicPowerAtTargetW: number;
  baseLeakageAt25CW: number;
  tunnelingPowerW: number;
  powerLimitW: number;
  dieAreaMm2: number;
  coolingId: string;
  packagingId: string;
  transistorId: string;
  frontierThermalMult: number;
  frontierFluxPenalty: number;
  extraThermalResistanceCPerW?: number;
  throttleTempOverrideC?: number;
}): {
  effectivePowerW: number;
  rawPowerW: number;
  dynamicPowerW: number;
  leakagePowerW: number;
  powerThrottledRatio: number;
  heatFluxWPerMm2: number;
  junctionTempC: number;
  throttleTempC: number;
  thermalThrottledRatio: number;
  thermalFloorHit: boolean;
  carnotOverheadW: number;
} {
  const cooling = getCoolingSpec(params.coolingId);
  const pkg = getPackagingSpec(params.packagingId);

  // Effective thermal resistance (including optional 3D stack TSV vertical resistance)
  const baseR =
    Math.max(
      0.032,
      (cooling.thermalResistanceCPerW - pkg.thermalResistanceOffset) * params.frontierThermalMult
    ) + (params.extraThermalResistanceCPerW ?? 0);

  // Photonic modulators & photonic SCM cavities have an optical drift ceiling at 78 C
  let throttleTempC =
    params.transistorId === 'trans_photonic_gate'
      ? Math.min(cooling.throttleTempC, 78)
      : cooling.throttleTempC;
  if (params.throttleTempOverrideC !== undefined) {
    throttleTempC = Math.min(throttleTempC, params.throttleTempOverrideC);
  }

  const evalHotspotR = (flux: number) =>
    0.12 * Math.pow(Math.max(0.01, flux), 0.6) * params.frontierFluxPenalty;

  // Step 1: 5-iteration fixed-point solver coupling Tj <-> P_leak(Tj) <-> powerLimitW (P_dyn ∝ f^2.2)
  let junctionTempC = cooling.ambientTempC + 20;
  let leakagePowerW = params.baseLeakageAt25CW;
  let powerThrottledRatio = 1.0;
  let dynPowerW = params.dynamicPowerAtTargetW;
  let effectivePowerW = dynPowerW + leakagePowerW + params.tunnelingPowerW;
  let heatFluxWPerMm2 = effectivePowerW / Math.max(params.dieAreaMm2, 1);

  for (let i = 0; i < THERMAL_SOLVER_ITERATIONS; i++) {
    const tempArg = Math.max(-140, Math.min(180, junctionTempC));
    leakagePowerW = params.baseLeakageAt25CW * Math.exp((tempArg - 25) / 42);

    const uncappedPowerW = params.dynamicPowerAtTargetW + leakagePowerW + params.tunnelingPowerW;
    if (uncappedPowerW > params.powerLimitW && params.dynamicPowerAtTargetW > 0.01) {
      const allowedDyn = Math.max(
        POWER_DYN_FLOOR * params.dynamicPowerAtTargetW,
        params.powerLimitW - leakagePowerW - params.tunnelingPowerW
      );
      powerThrottledRatio = Math.max(
        POWER_RATIO_FLOOR,
        Math.min(1.0, Math.pow(allowedDyn / params.dynamicPowerAtTargetW, 1 / POWER_FREQ_EXPONENT))
      );
    } else {
      powerThrottledRatio = 1.0;
    }

    dynPowerW = params.dynamicPowerAtTargetW * Math.pow(powerThrottledRatio, POWER_FREQ_EXPONENT);
    effectivePowerW = dynPowerW + leakagePowerW + params.tunnelingPowerW;
    heatFluxWPerMm2 = effectivePowerW / Math.max(params.dieAreaMm2, 1);
    const rHotspot = evalHotspotR(heatFluxWPerMm2);
    junctionTempC = cooling.ambientTempC + effectivePowerW * (baseR + rHotspot);
  }

  const dynAfterPowerCapW = dynPowerW;

  // Step 2: Iterative thermal throttling loop (up to 6 passes, floor THERMAL_RATIO_FLOOR = 0.22)
  // Converges smoothly to Tj <= throttleTempC so raising powerLimitW never reduces sustained clock.
  let thermalThrottledRatio = 1.0;
  if (junctionTempC > throttleTempC) {
    const tempBudgetC = Math.max(0, throttleTempC - cooling.ambientTempC);
    let pThermalEst = tempBudgetC / baseR;
    const leakAtLimitW =
      params.baseLeakageAt25CW * Math.exp((Math.max(-140, Math.min(180, throttleTempC)) - 25) / 42);

    for (let iter = 0; iter < THERMAL_THROTTLE_MAX_ITERATIONS; iter++) {
      const fluxEst = pThermalEst / Math.max(params.dieAreaMm2, 1);
      const rHotEst = evalHotspotR(fluxEst);
      const tjAtEst = cooling.ambientTempC + pThermalEst * (baseR + rHotEst);
      const dTjPerW = baseR + 1.6 * rHotEst;
      pThermalEst = Math.max(0, pThermalEst - (tjAtEst - throttleTempC) / Math.max(0.001, dTjPerW));

      const refLeakW = Math.min(leakagePowerW, leakAtLimitW);
      const allowedDynW = Math.max(0, pThermalEst - refLeakW - params.tunnelingPowerW);

      thermalThrottledRatio = Math.max(
        THERMAL_RATIO_FLOOR,
        Math.min(
          1.0,
          Math.pow(allowedDynW / Math.max(0.01, dynAfterPowerCapW), 1 / POWER_FREQ_EXPONENT)
        )
      );

      dynPowerW = dynAfterPowerCapW * Math.pow(thermalThrottledRatio, POWER_FREQ_EXPONENT);

      // Re-settle leakage, heat flux, and Tj at the new throttled dynamic power
      let settledTj = Math.min(junctionTempC, throttleTempC);
      for (let s = 0; s < 2; s++) {
        const tempArg = Math.max(-140, Math.min(180, settledTj));
        leakagePowerW = params.baseLeakageAt25CW * Math.exp((tempArg - 25) / 42);
        effectivePowerW = dynPowerW + leakagePowerW + params.tunnelingPowerW;
        heatFluxWPerMm2 = effectivePowerW / Math.max(params.dieAreaMm2, 1);
        const rHotNext = evalHotspotR(heatFluxWPerMm2);
        settledTj = cooling.ambientTempC + effectivePowerW * (baseR + rHotNext);
      }
      junctionTempC = settledTj;

      if (thermalThrottledRatio <= THERMAL_RATIO_FLOOR + 1e-9) {
        break;
      }
      if (junctionTempC <= throttleTempC && throttleTempC - junctionTempC < 0.05) {
        break;
      }
    }
  }

  const thermalFloorHit =
    thermalThrottledRatio <= THERMAL_RATIO_FLOOR + 1e-9 && junctionTempC > throttleTempC;

  const rawPowerW = params.dynamicPowerAtTargetW + leakagePowerW + params.tunnelingPowerW;
  const carnotOverheadW = effectivePowerW * cooling.carnotOverheadFactor;

  return {
    effectivePowerW,
    rawPowerW,
    dynamicPowerW: dynPowerW,
    leakagePowerW,
    powerThrottledRatio,
    heatFluxWPerMm2,
    junctionTempC,
    throttleTempC,
    thermalThrottledRatio,
    thermalFloorHit,
    carnotOverheadW,
  };
}

function buildCpuFloorplan(params: {
  pCores: number;
  eCores: number;
  l2Area: number;
  l3Area: number;
  pArea: number;
  eArea: number;
  igpuArea: number;
  npuArea: number;
  ioArea: number;
  imcArea: number;
  totalArea: number;
  baseFlux: number;
}): DieBlockRect[] {
  const blocks: DieBlockRect[] = [];
  const safeTotal = Math.max(1, params.totalArea);

  // Top band: I/O & PCIe + Memory Controllers (height proportional, clamped 11..22%)
  const topFraction = Math.max(0.12, Math.min(0.22, (params.ioArea + params.imcArea) / safeTotal));
  const topH = topFraction * 100;
  const imcRatio = params.imcArea / Math.max(0.01, params.ioArea + params.imcArea);
  const imcW = Math.max(22, Math.min(55, imcRatio * 100));

  blocks.push({
    id: 'imc',
    label: 'Memory Ctrl',
    category: 'memory_ctrl',
    x: 2,
    y: 2,
    w: imcW - 2.5,
    h: topH - 2,
    areaMm2: params.imcArea,
    heatFluxWPerMm2: params.baseFlux * 0.72,
  });

  blocks.push({
    id: 'io',
    label: 'PCIe / I/O Fabric',
    category: 'io',
    x: imcW + 0.5,
    y: 2,
    w: 97.5 - imcW,
    h: topH - 2,
    areaMm2: params.ioArea,
    heatFluxWPerMm2: params.baseFlux * 0.58,
  });

  // Bottom band if iGPU or NPU present
  const auxArea = params.igpuArea + params.npuArea;
  const hasAux = auxArea > 0.001;
  const bottomH = hasAux ? Math.max(14, Math.min(28, (auxArea / safeTotal) * 100)) : 0;

  if (hasAux) {
    const yAux = 98 - bottomH;
    if (params.igpuArea > 0 && params.npuArea > 0) {
      const igpuW = Math.max(28, Math.min(72, (params.igpuArea / auxArea) * 96));
      blocks.push({
        id: 'igpu',
        label: 'Integrated GPU',
        category: 'igpu',
        x: 2,
        y: yAux,
        w: igpuW - 1,
        h: bottomH,
        areaMm2: params.igpuArea,
        heatFluxWPerMm2: params.baseFlux * 1.15,
      });
      blocks.push({
        id: 'npu',
        label: 'Neural Engine (NPU)',
        category: 'npu',
        x: 2 + igpuW,
        y: yAux,
        w: 96 - igpuW,
        h: bottomH,
        areaMm2: params.npuArea,
        heatFluxWPerMm2: params.baseFlux * 1.05,
      });
    } else if (params.igpuArea > 0) {
      blocks.push({
        id: 'igpu',
        label: 'Integrated GPU',
        category: 'igpu',
        x: 2,
        y: yAux,
        w: 96,
        h: bottomH,
        areaMm2: params.igpuArea,
        heatFluxWPerMm2: params.baseFlux * 1.15,
      });
    } else {
      blocks.push({
        id: 'npu',
        label: 'Neural Engine (NPU)',
        category: 'npu',
        x: 2,
        y: yAux,
        w: 96,
        h: bottomH,
        areaMm2: params.npuArea,
        heatFluxWPerMm2: params.baseFlux * 1.05,
      });
    }
  }

  // Middle compute & cache fabric
  const midY = topH + 2;
  const midH = Math.max(30, 96 - midY - (hasAux ? bottomH + 2 : 0));
  const cacheArea = params.l2Area + params.l3Area;
  const computeArea = params.pArea + params.eArea;
  const cacheW = Math.max(16, Math.min(44, (cacheArea / Math.max(0.01, cacheArea + computeArea)) * 96));
  const coreZoneW = 96 - cacheW - 1.5;

  // L3 / Shared Cache Slice on right side of middle band
  blocks.push({
    id: 'l3_cache',
    label: 'L2 / L3 Cache SRAM',
    category: 'cache',
    x: 2 + coreZoneW + 1.5,
    y: midY,
    w: cacheW,
    h: midH,
    areaMm2: cacheArea,
    heatFluxWPerMm2: params.baseFlux * 0.52,
  });

  // P-core grid & E-core cluster inside coreZoneW
  const hasE = params.eCores > 0;
  const eZoneH = hasE ? Math.max(16, Math.min(midH * 0.42, (params.eArea / Math.max(0.01, computeArea)) * midH)) : 0;
  const pZoneH = midH - (hasE ? eZoneH + 1.5 : 0);

  // Render up to 16 distinct P-core tiles (grouped cleanly for 32-512 core chips)
  const pTiles = Math.min(params.pCores, 16);
  const pCols = Math.ceil(Math.sqrt(pTiles * (coreZoneW / Math.max(10, pZoneH))));
  const pRows = Math.ceil(pTiles / Math.max(1, pCols));
  const tileW = (coreZoneW - (pCols - 1) * 1.0) / Math.max(1, pCols);
  const tileH = (pZoneH - (pRows - 1) * 1.0) / Math.max(1, pRows);
  const coresPerTile = Math.ceil(params.pCores / Math.max(1, pTiles));

  for (let i = 0; i < pTiles; i++) {
    const r = Math.floor(i / pCols);
    const c = i % pCols;
    blocks.push({
      id: `p_${i}`,
      label: coresPerTile > 1 ? `P×${coresPerTile}` : `P${i + 1}`,
      category: 'p_core',
      x: 2 + c * (tileW + 1.0),
      y: midY + r * (tileH + 1.0),
      w: tileW,
      h: tileH,
      areaMm2: params.pArea / Math.max(1, pTiles),
      heatFluxWPerMm2: params.baseFlux * 1.48,
    });
  }

  if (hasE) {
    const eTiles = Math.min(params.eCores, 8);
    const eCols = Math.min(eTiles, 4);
    const eRows = Math.ceil(eTiles / eCols);
    const ew = (coreZoneW - (eCols - 1) * 1.0) / eCols;
    const eh = (eZoneH - (eRows - 1) * 1.0) / eRows;
    const ePerTile = Math.ceil(params.eCores / eTiles);

    for (let i = 0; i < eTiles; i++) {
      const r = Math.floor(i / eCols);
      const c = i % eCols;
      blocks.push({
        id: `e_${i}`,
        label: ePerTile > 1 ? `E×${ePerTile}` : `E${i + 1}`,
        category: 'e_core',
        x: 2 + c * (ew + 1.0),
        y: midY + pZoneH + 1.5 + r * (eh + 1.0),
        w: ew,
        h: eh,
        areaMm2: params.eArea / Math.max(1, eTiles),
        heatFluxWPerMm2: params.baseFlux * 0.92,
      });
    }
  }

  return blocks;
}

function buildGpuFloorplan(params: {
  shaderCores: number;
  shaderArea: number;
  ropTmuArea: number;
  cacheArea: number;
  phyArea: number;
  totalArea: number;
  baseFlux: number;
}): DieBlockRect[] {
  const blocks: DieBlockRect[] = [];
  const safeTotal = Math.max(1, params.totalArea);

  // Outer left & right vertical VRAM PHY strips
  const phyStripW = Math.max(8, Math.min(15, (params.phyArea / safeTotal) * 55));
  blocks.push({
    id: 'phy_left',
    label: 'VRAM PHY',
    category: 'memory_ctrl',
    x: 2,
    y: 2,
    w: phyStripW,
    h: 96,
    areaMm2: params.phyArea / 2,
    heatFluxWPerMm2: params.baseFlux * 0.78,
  });
  blocks.push({
    id: 'phy_right',
    label: 'VRAM PHY',
    category: 'memory_ctrl',
    x: 98 - phyStripW,
    y: 2,
    w: phyStripW,
    h: 96,
    areaMm2: params.phyArea / 2,
    heatFluxWPerMm2: params.baseFlux * 0.78,
  });

  const innerX = 2 + phyStripW + 1.5;
  const innerW = 96 - 2 * (phyStripW + 1.5);

  // Center horizontal L2 Cache + Command Scheduler
  const cacheH = Math.max(14, Math.min(26, (params.cacheArea / safeTotal) * 100));
  const ropH = Math.max(11, Math.min(20, (params.ropTmuArea / safeTotal) * 100));
  const shaderTotalH = Math.max(40, 96 - cacheH - ropH - 4);
  const topShaderH = shaderTotalH / 2;
  const botShaderH = shaderTotalH / 2;

  // Top & Bottom Shader Cluster Arrays (SMs)
  const smTilesPerHalf = Math.min(12, Math.max(2, Math.round(Math.sqrt(params.shaderCores) / 2)));
  const cols = Math.min(6, Math.max(2, Math.ceil(smTilesPerHalf / 2)));
  const rows = Math.ceil(smTilesPerHalf / cols);
  const tw = (innerW - (cols - 1) * 1.0) / cols;
  const th = (topShaderH - (rows - 1) * 1.0) / rows;
  const shadersPerTile = Math.max(1, Math.round(params.shaderCores / (smTilesPerHalf * 2)));

  for (let half = 0; half < 2; half++) {
    const baseY = half === 0 ? 2 : 2 + topShaderH + 1.5 + cacheH + 1.5;
    for (let i = 0; i < smTilesPerHalf; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      blocks.push({
        id: `sm_${half}_${i}`,
        label: `SM (${shadersPerTile})`,
        category: 'shader',
        x: innerX + c * (tw + 1.0),
        y: baseY + r * (th + 1.0),
        w: tw,
        h: th,
        areaMm2: params.shaderArea / (smTilesPerHalf * 2),
        heatFluxWPerMm2: params.baseFlux * 1.38,
      });
    }
  }

  // L2 Cache Spine
  blocks.push({
    id: 'gpu_l2',
    label: 'Unified L2 Cache',
    category: 'cache',
    x: innerX,
    y: 2 + topShaderH + 1.5,
    w: innerW,
    h: cacheH,
    areaMm2: params.cacheArea,
    heatFluxWPerMm2: params.baseFlux * 0.62,
  });

  // Bottom ROP / TMU / Display Engine bar
  blocks.push({
    id: 'rop_tmu',
    label: 'ROPs / TMUs / Raster',
    category: 'rop_tmu',
    x: innerX,
    y: 98 - ropH,
    w: innerW,
    h: ropH,
    areaMm2: params.ropTmuArea,
    heatFluxWPerMm2: params.baseFlux * 0.95,
  });

  return blocks;
}

/**
 * Evaluate a CPU blueprint through the documented physics & benchmark kernel.
 */
export function evaluateCpuPhysics(spec: CpuBlueprint, ctx: PhysicsContext): ChipEvaluation {
  const node = getProcessNode(spec.processNodeId);
  const trans = getTransistorStructure(spec.transistorStructureId);
  const pkg = getPackagingSpec(spec.packagingId);
  const arch = getCpuArch(spec.architectureId);
  const mem = getMemoryTech(spec.memoryTechId);
  const litho = getBestLithography(ctx.unlockedTechIds);
  const waferDia = getMaxWaferDiameterMm(ctx.unlockedTechIds);
  const frontier = computeFrontierModifiers(ctx.frontierLevels);
  const techMods = getAggregatedTechModifiers(ctx.unlockedTechIds);

  // 1. ISA extensions impact
  let isaOverhead = 0;
  let isaSingleBonus = 1.0;
  let isaComputeBonus = 1.0;
  let isaPowerPenalty = 1.0;
  for (const extId of spec.isaExtensions) {
    const ext = ISA_EXTENSIONS.find((e) => e.id === extId);
    if (ext) {
      isaOverhead += ext.transistorOverheadRatio;
      isaSingleBonus *= ext.singleCoreBonus;
      isaComputeBonus *= ext.generalComputeBonus;
      isaPowerPenalty *= ext.powerPenalty;
    }
  }

  // IPC tuning adds super-linear logic complexity (wider dispatch / ROB)
  const ipcAreaFactor = 1 + Math.max(0, spec.ipcTuning - 1.0) * 1.15;
  const pCoreTotalMTr = spec.pCores * arch.pCoreMTr * (1 + isaOverhead) * ipcAreaFactor;
  const eCoreTotalMTr = spec.eCores * arch.eCoreMTr * (1 + isaOverhead * 0.5);
  const logicCoreMTr = pCoreTotalMTr + eCoreTotalMTr;

  // Cache SRAM budget (6.4 MTr per MB of SRAM incl. tags/ECC)
  const l1TotalMB = ((spec.pCores + spec.eCores) * spec.l1CacheKBPerCore) / 1024;
  const totalCacheMB = l1TotalMB + spec.l2CacheMBTotal + spec.l3CacheMBTotal;
  const cacheMTr = totalCacheMB * 6.4;

  // Uncore (iGPU, NPU, IMC, PCIe)
  const igpuMTr = spec.igpuTier > 0 ? Math.pow(spec.igpuTier, 2.2) * 12 : 0;
  const npuMTr = spec.npuTier > 0 ? Math.pow(spec.npuTier, 2.0) * 9 : 0;
  const imcMTr = spec.memoryChannels * Math.max(0.08, node.logicDensityMTrPerMm2 * 0.14);
  const pcieMTr = spec.pcieLanes * Math.max(0.015, node.logicDensityMTrPerMm2 * 0.018);
  const uncoreMTr = igpuMTr + npuMTr + imcMTr + pcieMTr;

  const logicMTr = logicCoreMTr + uncoreMTr;
  const transistorCountMTr = logicMTr + cacheMTr;

  // 2. Die area (mm^2)
  const effLogicDensity =
    node.logicDensityMTrPerMm2 *
    trans.densityMultiplier *
    frontier.densityMult *
    techMods.logicDensityMult;
  const effSramDensity =
    node.sramDensityMTrPerMm2 *
    Math.sqrt(trans.densityMultiplier) *
    frontier.densityMult *
    techMods.sramDensityMult;

  const totalCores = spec.pCores + spec.eCores;
  const routingOverhead = 0.09 + 0.018 * Math.log2(1 + totalCores);

  const pArea = (pCoreTotalMTr / effLogicDensity) * (1 + routingOverhead);
  const eArea = (eCoreTotalMTr / effLogicDensity) * (1 + routingOverhead);
  const l2Area = (spec.l2CacheMBTotal * 6.4) / effSramDensity + (l1TotalMB * 6.4) / effSramDensity;
  const l3Area = (spec.l3CacheMBTotal * 6.4) / effSramDensity;
  const igpuArea = igpuMTr / effLogicDensity;
  const npuArea = npuMTr / effLogicDensity;
  const imcArea = Math.max(1.2, imcMTr / effLogicDensity + spec.memoryChannels * 1.1);
  const ioArea = Math.max(1.8, pcieMTr / effLogicDensity + spec.pcieLanes * 0.22);

  const dieAreaMm2 = Math.max(
    4.0,
    pArea + eArea + l2Area + l3Area + igpuArea + npuArea + imcArea + ioArea
  );
  const reticleLimitMm2 = Math.min(pkg.maxDieAreaMm2, litho.reticleLimitMm2 * (pkg.id === 'pkg_interposer' || pkg.id === 'pkg_3d_wow' || pkg.id === 'pkg_optical_substrate' ? 2.5 : 1.0));
  const exceedsReticle = dieAreaMm2 > reticleLimitMm2;

  // 3. Voltage-Frequency wall & Power
  const effectiveRefClockGHz = getEffectiveRefClockGHz(
    'cpu',
    spec.processNodeId,
    spec.architectureId,
    spec.transistorStructureId
  );
  const rawMinStableVoltageV = computeMinStableVoltageV(
    'cpu',
    spec.processNodeId,
    spec.architectureId,
    spec.transistorStructureId,
    spec.pClockGHz
  );
  const minStableVoltageV = Number(
    (rawMinStableVoltageV / Math.pow(techMods.clockHeadroomMult, 0.35)).toFixed(3)
  );
  const voltageUnstable = spec.voltageV < minStableVoltageV - 0.005;

  // Dynamic switching power: P_dyn = alpha * C_eff * V^2 * f
  const clockSwitchEff = 1 / Math.pow(techMods.clockHeadroomMult, 0.22);
  const pDyn =
    0.42 *
    pCoreTotalMTr *
    node.capacitanceFactor *
    arch.powerMultiplier *
    isaPowerPenalty *
    clockSwitchEff *
    spec.voltageV *
    spec.voltageV *
    spec.pClockGHz;
  const eDyn =
    0.34 *
    eCoreTotalMTr *
    node.capacitanceFactor *
    arch.powerMultiplier *
    E_CORE_POWER_FACTOR *
    clockSwitchEff *
    Math.pow(spec.voltageV * E_CORE_VOLTAGE_SCALE, 2) *
    spec.eClockGHz;
  const uncoreDyn =
    (cacheMTr * 0.06 + igpuMTr * 0.24 + npuMTr * 0.18) *
    node.capacitanceFactor *
    clockSwitchEff *
    spec.voltageV *
    spec.voltageV *
    Math.min(spec.pClockGHz, effectiveRefClockGHz) +
    spec.memoryChannels * mem.powerPerChannelW * 0.65 +
    spec.pcieLanes * 0.08;

  const dynamicPowerAtTargetW = Math.max(0.25, pDyn + eDyn + uncoreDyn);
  const baseLeakageAt25CW =
    node.leakageCoeff *
    trans.leakageMultiplier *
    techMods.leakageReductionMult *
    transistorCountMTr *
    spec.voltageV;
  const tunnelingPowerW =
    node.tunnelingFloorWPerMTr * (1 - trans.tunnelingMitigation) * transistorCountMTr;

  const thermal = solveThermalAndPower({
    dynamicPowerAtTargetW,
    baseLeakageAt25CW,
    tunnelingPowerW,
    powerLimitW: spec.powerLimitW,
    dieAreaMm2,
    coolingId: spec.coolingId,
    packagingId: spec.packagingId,
    transistorId: spec.transistorStructureId,
    frontierThermalMult: frontier.thermalResMult / techMods.coolingEfficiencyMult,
    frontierFluxPenalty: frontier.fluxPenaltyMult,
  });

  const combinedClockRatio = thermal.powerThrottledRatio * thermal.thermalThrottledRatio;
  const sustainedClockGHz = spec.pClockGHz * combinedClockRatio;
  const sustainedEClockGHz = spec.eClockGHz * combinedClockRatio;

  // 4. Wafer Yield (Murphy model)
  const maturationMult = 0.45 + 0.55 * Math.exp(-0.08 * Math.max(0, ctx.maturationXp));
  const cleanroomMult = Math.pow(0.86, Math.max(0, ctx.cleanroomGrade - 1));
  const effectiveDefectDensity =
    node.baseDefectDensity *
    litho.defectMultiplier *
    trans.defectMultiplier *
    pkg.defectMultiplier *
    cleanroomMult *
    maturationMult *
    frontier.defectMult *
    techMods.defectReductionMult;

  const qaFactor = 0.94 + ctx.qaBudgetLevel * 0.015 + ((ctx.qaStrictness ?? 1.0) - 1.0) * 0.04;
  const grossDiesPerWafer = exceedsReticle ? 0 : computeGrossDiesPerWafer(waferDia, dieAreaMm2);
  const yieldPercent = exceedsReticle
    ? 0
    : computeMurphyYield(dieAreaMm2, effectiveDefectDensity, qaFactor);
  const goodDiesPerWafer = (grossDiesPerWafer * yieldPercent) / 100;

  // 5. Benchmarks & Roofline Bottleneck Analysis
  const memoryBandwidthGBs = spec.memoryChannels * mem.gbpsPerUnit * techMods.memoryBandwidthMult;
  const maxPcieGen = getMaxPcieGen(ctx.unlockedTechIds);
  const pcieBandwidthGBs = spec.pcieLanes * getPcieBandwidthPerLaneGBs(maxPcieGen);

  // Diminishing-return cache multiplier
  const cacheGain =
    1 +
    0.09 * Math.log(1 + spec.l1CacheKBPerCore / 32) +
    0.11 * Math.log(1 + spec.l2CacheMBTotal / Math.max(0.5, totalCores * 0.25)) +
    0.13 * Math.log(1 + spec.l3CacheMBTotal / Math.max(1, totalCores * 1.5));

  const effectiveIpc = arch.baseIpc * spec.ipcTuning * frontier.ipcMult * techMods.ipcBonusMult;
  const stabilityPenalty = voltageUnstable ? 0.35 : 1.0;

  const singleCoreCpu = Math.round(
    sustainedClockGHz * 1000 * effectiveIpc * cacheGain * isaSingleBonus * stabilityPenalty
  );

  // Multicore Amdahl + Interconnect contention
  const pWeight = spec.pCores;
  const eWeight = spec.eCores * 0.52 * (sustainedEClockGHz / Math.max(0.001, sustainedClockGHz));
  const effCoreCount = pWeight + eWeight;
  const interconnectPenalty = (arch.interconnectContention * Math.pow(effCoreCount, 1.35)) / pkg.interconnectBonus;
  const rawScaling = effCoreCount / (1 + 0.025 * Math.max(0, effCoreCount - 1) + interconnectPenalty);

  // Memory bandwidth demand scales with core count * clock * IPC
  const memDemandGBs = effCoreCount * sustainedClockGHz * effectiveIpc * 0.85;
  const bwSatisfaction = memoryBandwidthGBs / Math.max(0.1, memDemandGBs);
  const memRooflineFactor = Math.min(1.0, Math.pow(bwSatisfaction, 0.45));

  // Diminishing-return PCIe I/O fabric multiplier for system compute and external GPU/storage feeding
  const pcieComputeBonus = 1 + 0.045 * Math.log(1 + pcieBandwidthGBs / 4);
  const pcieGamingBonus = 1 + 0.035 * Math.log(1 + pcieBandwidthGBs / 4);

  const multiCoreCpu = Math.round(singleCoreCpu * rawScaling * (0.35 + 0.65 * memRooflineFactor));
  const generalComputing = Math.round(
    ((singleCoreCpu * 0.32 + multiCoreCpu * 0.55) * isaComputeBonus +
      spec.npuTier * 180 * Math.sqrt(Math.max(1, node.logicDensityMTrPerMm2))) *
      pcieComputeBonus
  );
  const memoryPerformance = Math.round(memoryBandwidthGBs * 18 * (0.7 + 0.3 * Math.min(1.5, cacheGain)));
  const gamingRendering = Math.round(
    (singleCoreCpu * 0.42 +
      Math.min(multiCoreCpu, singleCoreCpu * 5.5) * 0.25 +
      spec.igpuTier * 220 * Math.sqrt(Math.max(0.5, sustainedClockGHz * memoryBandwidthGBs))) *
      pcieGamingBonus
  );
  const gpuCompute = Math.round(
    spec.igpuTier > 0
      ? spec.igpuTier * 260 * Math.pow(Math.max(0.2, sustainedClockGHz), 0.7) * Math.sqrt(Math.max(1, memoryBandwidthGBs))
      : 0
  );

  const totalSystemPowerW = thermal.effectivePowerW + thermal.carnotOverheadW;
  const powerEfficiency = Math.round((multiCoreCpu / Math.max(1, totalSystemPowerW)) * 10);
  const thermalHeadroom = thermal.throttleTempC - thermal.junctionTempC;
  const thermalPerformance = Math.max(
    5,
    Math.min(100, Math.round(68 + thermalHeadroom * 0.9 - (1 - thermal.thermalThrottledRatio) * 85))
  );

  const overallRating = Math.round(
    singleCoreCpu * 0.24 +
      multiCoreCpu * 0.36 +
      generalComputing * 0.25 +
      memoryPerformance * 0.15
  );

  // Bottleneck Diagnostics (plain-English engineering explanations)
  const bottlenecks: BottleneckDiagnostic[] = [];

  if (exceedsReticle) {
    bottlenecks.push({
      id: 'reticle_exceeded',
      severity: 'critical',
      title: 'Die Area Exceeds Lithography / Package Limit',
      explanation: `At ${dieAreaMm2.toFixed(1)} mm², this die exceeds the ${reticleLimitMm2.toFixed(0)} mm² maximum printable reticle/package limit and cannot be manufactured.`,
      recommendation: 'Reduce core count or cache size, shrink to a denser process node, or unlock 2.5D/3D chiplet packaging.',
    });
  }

  if (voltageUnstable) {
    bottlenecks.push({
      id: 'voltage_unstable',
      severity: 'critical',
      title: 'Insufficient Core Voltage (Timing Violations)',
      explanation: `${spec.pClockGHz.toFixed(2)} GHz requires at least ${minStableVoltageV.toFixed(2)} V on ${node.name}, but Vcore is set to ${spec.voltageV.toFixed(2)} V.`,
      recommendation: `Raise Vcore to ≥ ${minStableVoltageV.toFixed(2)} V or lower target clock speed to restore signal stability.`,
    });
  }

  if (thermal.thermalFloorHit) {
    bottlenecks.push({
      id: 'thermal_runaway',
      severity: 'critical',
      title: 'Thermal Runaway — Minimum Throttle Floor Exceeded',
      explanation: `Even at the ${(THERMAL_RATIO_FLOOR * 100).toFixed(0)}% clock throttle floor, junction temperature stays at ${thermal.junctionTempC.toFixed(1)} °C (limit ${thermal.throttleTempC} °C).`,
      recommendation: 'Upgrade cooling solution immediately, lower core voltage/power limit, or reduce transistor count.',
    });
  } else if (thermal.thermalThrottledRatio < 0.96) {
    const lossPct = Math.round((1 - thermal.thermalThrottledRatio) * 100);
    bottlenecks.push({
      id: 'thermal_throttle',
      severity: thermal.thermalThrottledRatio < 0.78 ? 'critical' : 'warning',
      title: `Thermal Throttling (-${lossPct}% Sustained Clock)`,
      explanation: `Junction temperature reached ${thermal.junctionTempC.toFixed(1)} °C (limit ${thermal.throttleTempC} °C) at ${thermal.heatFluxWPerMm2.toFixed(2)} W/mm² heat flux.`,
      recommendation: 'Upgrade cooling tier, reduce Vcore/clock speed, or lower power limit to stay below thermal throttle threshold.',
    });
  }

  if (thermal.powerThrottledRatio < 0.92) {
    const lossPct = Math.round((1 - thermal.powerThrottledRatio) * 100);
    bottlenecks.push({
      id: 'power_limit',
      severity: 'warning',
      title: `Power Envelope Capped (-${lossPct}% Clock)`,
      explanation: `Uncapped power (${thermal.rawPowerW.toFixed(1)} W) exceeds your ${spec.powerLimitW} W TDP cap, forcing sustained frequency pullback.`,
      recommendation: 'Raise TDP limit (if cooling permits), undervolt closer to Vmin, or move to a lower-capacitance node.',
    });
  }

  if (bwSatisfaction < 0.72 && totalCores >= 2) {
    bottlenecks.push({
      id: 'mem_starved',
      severity: bwSatisfaction < 0.45 ? 'critical' : 'warning',
      title: 'Memory Bandwidth Starvation',
      explanation: `${spec.memoryChannels}-channel ${mem.name} supplies ${memoryBandwidthGBs.toFixed(1)} GB/s against ~${memDemandGBs.toFixed(1)} GB/s multicore demand.`,
      recommendation: 'Add memory channels, unlock faster RAM generation, or enlarge L3 cache to shield cores from off-chip stalls.',
    });
  }

  const pcieDemandGBs = Math.max(memoryBandwidthGBs * 0.25, effCoreCount * 0.8);
  if (pcieBandwidthGBs < pcieDemandGBs && (totalCores >= 4 || memoryBandwidthGBs >= 16)) {
    bottlenecks.push({
      id: 'pcie_bottleneck',
      severity: pcieBandwidthGBs < pcieDemandGBs * 0.5 ? 'warning' : 'info',
      title: 'PCIe I/O Bandwidth Bottleneck',
      explanation: `${spec.pcieLanes}× PCIe Gen ${maxPcieGen} provides ${pcieBandwidthGBs.toFixed(1)} GB/s against ~${pcieDemandGBs.toFixed(1)} GB/s system I/O demand.`,
      recommendation: 'Add PCIe lanes or research higher PCIe generations to prevent off-package I/O starvation.',
    });
  }

  if (interconnectPenalty > 0.35 && totalCores >= 8) {
    bottlenecks.push({
      id: 'interconnect_contention',
      severity: 'warning',
      title: 'Multicore Interconnect Contention',
      explanation: `Core-to-core coherence traffic on ${arch.name} adds ${(interconnectPenalty * 100).toFixed(0)}% scaling overhead at ${totalCores} cores.`,
      recommendation: 'Research Wide Heterogeneous / Optical architectures or upgrade to 2.5D/3D chiplet packaging.',
    });
  }

  if (yieldPercent < 42 && !exceedsReticle) {
    bottlenecks.push({
      id: 'low_yield',
      severity: 'warning',
      title: `Severe Wafer Yield Loss (${yieldPercent.toFixed(1)}%)`,
      explanation: `Large ${dieAreaMm2.toFixed(1)} mm² die area combined with ${effectiveDefectDensity.toFixed(2)} defects/cm² kills most dies during fabrication.`,
      recommendation: 'Mature this process node via production runs, upgrade lithography/cleanrooms, or trim cache/core footprint.',
    });
  }

  if (tunnelingPowerW > thermal.effectivePowerW * 0.22) {
    bottlenecks.push({
      id: 'quantum_tunneling',
      severity: 'warning',
      title: 'Quantum Tunneling Leakage Floor',
      explanation: `${trans.name} leaks ${tunnelingPowerW.toFixed(1)} W continuously via gate tunneling on ${node.name}.`,
      recommendation: 'Switch to FinFET, GAA Nanosheet, or CFET 3D transistor structures to suppress gate tunneling.',
    });
  }

  if (bottlenecks.length === 0) {
    bottlenecks.push({
      id: 'balanced',
      severity: 'info',
      title: 'Balanced Silicon Architecture',
      explanation: 'Compute throughput, memory bandwidth, thermal dissipation, and wafer yield are well matched.',
      recommendation: 'Ready for tape-out or experimental frequency/core tuning.',
    });
  }

  const floorplanBlocks = buildCpuFloorplan({
    pCores: spec.pCores,
    eCores: spec.eCores,
    l2Area,
    l3Area,
    pArea,
    eArea,
    igpuArea,
    npuArea,
    ioArea,
    imcArea,
    totalArea: dieAreaMm2,
    baseFlux: thermal.heatFluxWPerMm2,
  });

  // Tape-out engineering cost & duration scale with complexity
  const complexity = Math.log10(10 + transistorCountMTr * 12) * (1 + totalCores * 0.04);
  const tapeOutCreditCost = Math.round(280 * complexity * (1 + dieAreaMm2 / 400));
  const tapeOutDays = Math.round(Math.min(540, (24 + complexity * 18) * frontier.tapeOutTimeMult));

  // Civilization compute contribution per good die
  const computePowerRating = Math.max(1, overallRating * 0.012);

  const physics: ChipPhysicsReport = {
    transistorCountMTr,
    logicMTr,
    cacheMTr,
    uncoreMTr,
    dieAreaMm2,
    reticleLimitMm2,
    exceedsReticle,
    minStableVoltageV,
    voltageUnstable,
    dynamicPowerW: thermal.dynamicPowerW,
    leakagePowerW: thermal.leakagePowerW,
    tunnelingPowerW,
    carnotOverheadW: thermal.carnotOverheadW,
    rawPowerW: thermal.rawPowerW,
    effectivePowerW: thermal.effectivePowerW,
    powerThrottledRatio: thermal.powerThrottledRatio,
    heatFluxWPerMm2: thermal.heatFluxWPerMm2,
    junctionTempC: thermal.junctionTempC,
    throttleTempC: thermal.throttleTempC,
    thermalThrottledRatio: thermal.thermalThrottledRatio,
    thermalFloorHit: thermal.thermalFloorHit,
    sustainedClockGHz,
    sustainedEClockGHz,
    effectiveIpc,
    memoryBandwidthGBs,
    pcieBandwidthGBs,
    grossDiesPerWafer,
    effectiveDefectDensity,
    yieldPercent,
    goodDiesPerWafer,
    floorplanBlocks,
    computePowerRating,
    tapeOutCreditCost,
    tapeOutDays,
  };

  const benchmarks: ChipBenchmarkReport = {
    singleCoreCpu,
    multiCoreCpu,
    generalComputing,
    memoryPerformance,
    gamingRendering,
    gpuCompute,
    powerEfficiency,
    thermalPerformance,
    overallRating,
    bottlenecks,
  };

  return {
    physics,
    benchmarks,
    cacheKey: `${spec.id}_r${spec.revision}_m${Math.floor(ctx.maturationXp)}_c${ctx.cleanroomGrade}_q${ctx.qaBudgetLevel}`,
  };
}

/**
 * Evaluate a GPU blueprint through the documented physics & Roofline benchmark kernel.
 */
export function evaluateGpuPhysics(spec: GpuBlueprint, ctx: PhysicsContext): ChipEvaluation {
  const node = getProcessNode(spec.processNodeId);
  const trans = getTransistorStructure(spec.transistorStructureId);
  const pkg = getPackagingSpec(spec.packagingId);
  const arch = getGpuArch(spec.architectureId);
  const vram = getMemoryTech(spec.vramTechId);
  const litho = getBestLithography(ctx.unlockedTechIds);
  const waferDia = getMaxWaferDiameterMm(ctx.unlockedTechIds);
  const frontier = computeFrontierModifiers(ctx.frontierLevels);
  const techMods = getAggregatedTechModifiers(ctx.unlockedTechIds);

  // 1. Transistor budget
  const shaderMTr = spec.shaderCores * arch.shaderMTrPerCore;
  const ropTmuMTr = spec.rops * 0.28 + spec.tmus * 0.14;
  const cacheMTr = (spec.l1CacheMB + spec.l2CacheMB) * 6.4;
  const busSlices = spec.memoryBusWidthBits / 32;
  const phyMTr = busSlices * Math.max(0.25, node.logicDensityMTrPerMm2 * 0.22);

  const logicMTr = shaderMTr + ropTmuMTr + phyMTr;
  const uncoreMTr = ropTmuMTr + phyMTr;
  const transistorCountMTr = logicMTr + cacheMTr;

  // 2. Die Area (mm^2)
  const effLogicDensity =
    node.logicDensityMTrPerMm2 *
    trans.densityMultiplier *
    frontier.densityMult *
    techMods.logicDensityMult;
  const effSramDensity =
    node.sramDensityMTrPerMm2 *
    Math.sqrt(trans.densityMultiplier) *
    frontier.densityMult *
    techMods.sramDensityMult;

  const routingOverhead = 0.11 + 0.014 * Math.log2(1 + spec.shaderCores / 16);
  const shaderArea = (shaderMTr / effLogicDensity) * (1 + routingOverhead);
  const ropTmuArea = Math.max(1.5, (ropTmuMTr / effLogicDensity) * 1.15);
  const cacheArea = cacheMTr / effSramDensity;
  const phyArea = Math.max(3.0, phyMTr / effLogicDensity + busSlices * 1.65);

  const dieAreaMm2 = Math.max(8.0, shaderArea + ropTmuArea + cacheArea + phyArea);
  const reticleLimitMm2 = Math.min(
    pkg.maxDieAreaMm2,
    litho.reticleLimitMm2 *
      (pkg.id === 'pkg_interposer' || pkg.id === 'pkg_3d_wow' || pkg.id === 'pkg_optical_substrate' ? 2.5 : 1.0)
  );
  const exceedsReticle = dieAreaMm2 > reticleLimitMm2;

  // 3. Voltage-Frequency wall & Power (unified curve across CPU & GPU)
  const rawMinStableVoltageV = computeMinStableVoltageV(
    'gpu',
    spec.processNodeId,
    spec.architectureId,
    spec.transistorStructureId,
    spec.clockGHz
  );
  const minStableVoltageV = Number(
    (rawMinStableVoltageV / Math.pow(techMods.clockHeadroomMult, 0.35)).toFixed(3)
  );
  const voltageUnstable = spec.voltageV < minStableVoltageV - 0.005;

  const clockSwitchEff = 1 / Math.pow(techMods.clockHeadroomMult, 0.22);
  const vramBoardPowerW = busSlices * vram.powerPerChannelW * 0.55 + Math.log2(1 + spec.vramCapacityGB) * 1.8;
  const dynamicPowerAtTargetW = Math.max(
    0.5,
    0.54 *
      (shaderMTr + ropTmuMTr * 0.7 + cacheMTr * 0.12) *
      node.capacitanceFactor *
      arch.powerMultiplier *
      clockSwitchEff *
      spec.voltageV *
      spec.voltageV *
      spec.clockGHz +
      vramBoardPowerW
  );

  const baseLeakageAt25CW =
    node.leakageCoeff *
    trans.leakageMultiplier *
    techMods.leakageReductionMult *
    transistorCountMTr *
    spec.voltageV;
  const tunnelingPowerW =
    node.tunnelingFloorWPerMTr * (1 - trans.tunnelingMitigation) * transistorCountMTr;

  const thermal = solveThermalAndPower({
    dynamicPowerAtTargetW,
    baseLeakageAt25CW,
    tunnelingPowerW,
    powerLimitW: spec.powerLimitW,
    dieAreaMm2,
    coolingId: spec.coolingId,
    packagingId: spec.packagingId,
    transistorId: spec.transistorStructureId,
    frontierThermalMult: frontier.thermalResMult / techMods.coolingEfficiencyMult,
    frontierFluxPenalty: frontier.fluxPenaltyMult,
  });

  const sustainedClockGHz =
    spec.clockGHz * thermal.powerThrottledRatio * thermal.thermalThrottledRatio;

  // 4. Murphy Wafer Yield
  const maturationMult = 0.45 + 0.55 * Math.exp(-0.08 * Math.max(0, ctx.maturationXp));
  const cleanroomMult = Math.pow(0.86, Math.max(0, ctx.cleanroomGrade - 1));
  const effectiveDefectDensity =
    node.baseDefectDensity *
    litho.defectMultiplier *
    trans.defectMultiplier *
    pkg.defectMultiplier *
    cleanroomMult *
    maturationMult *
    frontier.defectMult *
    techMods.defectReductionMult;

  const qaFactor = 0.94 + ctx.qaBudgetLevel * 0.015 + ((ctx.qaStrictness ?? 1.0) - 1.0) * 0.04;
  const grossDiesPerWafer = exceedsReticle ? 0 : computeGrossDiesPerWafer(waferDia, dieAreaMm2);
  const yieldPercent = exceedsReticle
    ? 0
    : computeMurphyYield(dieAreaMm2, effectiveDefectDensity, qaFactor);
  const goodDiesPerWafer = (grossDiesPerWafer * yieldPercent) / 100;

  // 5. Roofline Performance Model
  const rawBandwidthGBs = busSlices * vram.gbpsPerUnit * techMods.memoryBandwidthMult;
  const effectiveBandwidthGBs = rawBandwidthGBs * arch.memoryCompression;
  const memoryBandwidthGBs = rawBandwidthGBs;

  const cacheRelief =
    1 + 0.14 * Math.log(1 + spec.l2CacheMB / 2) + 0.04 * Math.log(1 + spec.l1CacheMB / 0.016);
  const peakGflops =
    spec.shaderCores *
    sustainedClockGHz *
    arch.opsPerCorePerClock *
    frontier.ipcMult *
    techMods.gpuComputeMult *
    (voltageUnstable ? 0.35 : 1.0);

  // Pixel & Texel fill-rate demand vs shader compute
  const pixelFillScore = spec.rops * sustainedClockGHz * 14;
  const texelFillScore = spec.tmus * sustainedClockGHz * 7.5;
  const bwScore = effectiveBandwidthGBs * cacheRelief * 3.8;
  const shaderScore = peakGflops * 1.15;

  // Harmonic-weighted roofline so any single severely starved subsystem visibly pulls down rendering!
  const renderingHarmonic =
    1 /
    (0.42 / Math.max(1, shaderScore) +
      0.28 / Math.max(1, bwScore) +
      0.16 / Math.max(1, pixelFillScore) +
      0.14 / Math.max(1, texelFillScore));

  // VRAM capacity DOES NOT linearly boost speed; it enforces workload footprint sufficiency
  const recommendedVramGB = Math.max(0.125, Math.pow(Math.max(1, peakGflops) / 180, 0.52));
  const vramFootprintRatio = Math.min(1.0, Math.pow(spec.vramCapacityGB / recommendedVramGB, 0.45));
  const rayBonus = 1 + arch.rayTracingFactor * 0.28;

  const gamingRendering = Math.round(renderingHarmonic * rayBonus * (0.45 + 0.55 * vramFootprintRatio));

  // GPU Compute depends heavily on shader FLOPS + memory bandwidth + architecture compute efficiency
  const computeHarmonic =
    1 / (0.62 / Math.max(1, peakGflops * arch.computeEfficiency * 1.25) + 0.38 / Math.max(1, bwScore));
  const gpuCompute = Math.round(computeHarmonic * (0.55 + 0.45 * vramFootprintRatio));

  const memoryPerformance = Math.round(effectiveBandwidthGBs * 14 * cacheRelief);
  const generalComputing = Math.round(gpuCompute * 0.72 + memoryPerformance * 0.12);
  const totalSystemPowerW = thermal.effectivePowerW + thermal.carnotOverheadW;
  const powerEfficiency = Math.round(((gamingRendering + gpuCompute) / 2 / Math.max(1, totalSystemPowerW)) * 10);
  const thermalHeadroom = thermal.throttleTempC - thermal.junctionTempC;
  const thermalPerformance = Math.max(
    5,
    Math.min(100, Math.round(68 + thermalHeadroom * 0.9 - (1 - thermal.thermalThrottledRatio) * 85))
  );

  const overallRating = Math.round(
    gamingRendering * 0.45 + gpuCompute * 0.38 + memoryPerformance * 0.17
  );

  // Diagnostic Bottleneck Analyzer
  const bottlenecks: BottleneckDiagnostic[] = [];

  if (exceedsReticle) {
    bottlenecks.push({
      id: 'gpu_reticle',
      severity: 'critical',
      title: 'Die Area Exceeds Reticle / Package Limit',
      explanation: `GPU die (${dieAreaMm2.toFixed(1)} mm²) exceeds the ${reticleLimitMm2.toFixed(0)} mm² limit.`,
      recommendation: 'Shrink process node, trim shader count or L2 cache, or adopt 2.5D/3D chiplet packaging.',
    });
  }

  if (voltageUnstable) {
    bottlenecks.push({
      id: 'gpu_voltage',
      severity: 'critical',
      title: 'Core Voltage Below Stability Floor',
      explanation: `${spec.clockGHz.toFixed(2)} GHz requires ≥ ${minStableVoltageV.toFixed(2)} V (set to ${spec.voltageV.toFixed(2)} V).`,
      recommendation: 'Increase GPU voltage or reduce core clock speed.',
    });
  }

  if (bwScore < shaderScore * 0.58) {
    const potentialGain = Math.min(65, Math.round(((shaderScore / Math.max(1, bwScore)) - 1) * 28));
    bottlenecks.push({
      id: 'gpu_bw_starved',
      severity: bwScore < shaderScore * 0.35 ? 'critical' : 'warning',
      title: 'Memory Bandwidth Starved',
      explanation: `${spec.memoryBusWidthBits}-bit ${vram.name} delivers ${rawBandwidthGBs.toFixed(1)} GB/s (${effectiveBandwidthGBs.toFixed(1)} GB/s effective) against ${peakGflops.toFixed(0)} GFLOPS shader throughput.`,
      recommendation: `Widen memory bus, switch to faster VRAM (GDDR7/HBM4), or expand L2 cache to unlock up to +${potentialGain}% performance.`,
    });
  }

  if (pixelFillScore < shaderScore * 0.5 || texelFillScore < shaderScore * 0.5) {
    bottlenecks.push({
      id: 'gpu_fillrate',
      severity: 'warning',
      title: 'ROP / TMU Fill-Rate Bottleneck',
      explanation: `${spec.rops} ROPs and ${spec.tmus} TMUs cannot retire pixels/texels fast enough for ${spec.shaderCores} shader cores.`,
      recommendation: 'Increase ROP and TMU counts proportionally with your shader array for stronger gaming scores.',
    });
  }

  if (spec.vramCapacityGB < recommendedVramGB * 0.72) {
    bottlenecks.push({
      id: 'gpu_vram_cap',
      severity: 'warning',
      title: 'VRAM Footprint Constrained',
      explanation: `${spec.vramCapacityGB} GB VRAM is tight for this compute tier (recommended ≥ ${recommendedVramGB.toFixed(1)} GB), causing high-workload paging penalties.`,
      recommendation: 'Increase VRAM capacity to eliminate footprint overflow (note: excess VRAM beyond demand will not boost raw FPS).',
    });
  } else if (spec.vramCapacityGB > recommendedVramGB * 3.5 && bwScore < shaderScore * 0.85) {
    bottlenecks.push({
      id: 'gpu_vram_overkill',
      severity: 'info',
      title: 'Excess VRAM Capacity Without Bandwidth Headroom',
      explanation: `${spec.vramCapacityGB} GB VRAM greatly exceeds compute tier needs while memory bus bandwidth remains the true limiter.`,
      recommendation: 'Prioritize bus width or faster VRAM generation rather than stacking extra capacity.',
    });
  }

  if (thermal.thermalFloorHit) {
    bottlenecks.push({
      id: 'gpu_thermal_runaway',
      severity: 'critical',
      title: 'Thermal Runaway — Minimum Throttle Floor Exceeded',
      explanation: `Even at the ${(THERMAL_RATIO_FLOOR * 100).toFixed(0)}% clock throttle floor, GPU junction temperature remains at ${thermal.junctionTempC.toFixed(1)} °C (limit ${thermal.throttleTempC} °C).`,
      recommendation: 'Upgrade cooling solution immediately, lower voltage/power limit, or trim shader array footprint.',
    });
  } else if (thermal.thermalThrottledRatio < 0.96) {
    const lossPct = Math.round((1 - thermal.thermalThrottledRatio) * 100);
    bottlenecks.push({
      id: 'gpu_thermal',
      severity: thermal.thermalThrottledRatio < 0.78 ? 'critical' : 'warning',
      title: `Thermal Throttling (-${lossPct}% Sustained Clock)`,
      explanation: `GPU die hit ${thermal.junctionTempC.toFixed(1)} °C (limit ${thermal.throttleTempC} °C) at ${thermal.heatFluxWPerMm2.toFixed(2)} W/mm².`,
      recommendation: 'Upgrade cooling system, lower core voltage/clock, or raise die efficiency with a newer node.',
    });
  }

  if (yieldPercent < 42 && !exceedsReticle) {
    bottlenecks.push({
      id: 'gpu_yield',
      severity: 'warning',
      title: `Low Wafer Yield (${yieldPercent.toFixed(1)}%)`,
      explanation: `A ${dieAreaMm2.toFixed(1)} mm² monolithic GPU suffers steep defect losses at ${effectiveDefectDensity.toFixed(2)} defects/cm².`,
      recommendation: 'Mature the process node, upgrade lithography, or reduce die footprint.',
    });
  }

  if (bottlenecks.length === 0) {
    bottlenecks.push({
      id: 'gpu_balanced',
      severity: 'info',
      title: 'Balanced GPU Pipeline',
      explanation: 'Shader throughput, ROP/TMU fill rates, VRAM bandwidth, and thermals are well calibrated.',
      recommendation: 'Ready for tape-out and volume production.',
    });
  }

  const floorplanBlocks = buildGpuFloorplan({
    shaderCores: spec.shaderCores,
    shaderArea,
    ropTmuArea,
    cacheArea,
    phyArea,
    totalArea: dieAreaMm2,
    baseFlux: thermal.heatFluxWPerMm2,
  });

  const complexity = Math.log10(12 + transistorCountMTr * 10) * (1 + Math.log2(1 + spec.shaderCores) * 0.14);
  const tapeOutCreditCost = Math.round(320 * complexity * (1 + dieAreaMm2 / 420));
  const tapeOutDays = Math.round(Math.min(540, (28 + complexity * 19) * frontier.tapeOutTimeMult));
  const computePowerRating = Math.max(1, overallRating * 0.0135);

  return {
    physics: {
      transistorCountMTr,
      logicMTr,
      cacheMTr,
      uncoreMTr,
      dieAreaMm2,
      reticleLimitMm2,
      exceedsReticle,
      minStableVoltageV,
      voltageUnstable,
      dynamicPowerW: thermal.dynamicPowerW,
      leakagePowerW: thermal.leakagePowerW,
      tunnelingPowerW,
      carnotOverheadW: thermal.carnotOverheadW,
      rawPowerW: thermal.rawPowerW,
      effectivePowerW: thermal.effectivePowerW,
      powerThrottledRatio: thermal.powerThrottledRatio,
      heatFluxWPerMm2: thermal.heatFluxWPerMm2,
      junctionTempC: thermal.junctionTempC,
      throttleTempC: thermal.throttleTempC,
      thermalThrottledRatio: thermal.thermalThrottledRatio,
      thermalFloorHit: thermal.thermalFloorHit,
      sustainedClockGHz,
      memoryBandwidthGBs,
      grossDiesPerWafer,
      effectiveDefectDensity,
      yieldPercent,
      goodDiesPerWafer,
      floorplanBlocks,
      computePowerRating,
      tapeOutCreditCost,
      tapeOutDays,
    },
    benchmarks: {
      singleCoreCpu: 0,
      multiCoreCpu: 0,
      generalComputing,
      memoryPerformance,
      gamingRendering,
      gpuCompute,
      powerEfficiency,
      thermalPerformance,
      overallRating,
      bottlenecks,
    },
    cacheKey: `${spec.id}_r${spec.revision}_m${Math.floor(ctx.maturationXp)}_c${ctx.cleanroomGrade}_q${ctx.qaBudgetLevel}`,
  };
}

function buildMemoryFloorplan(params: {
  bankCount: number;
  stackLayers: number;
  arrayArea: number;
  senseAmpArea: number;
  eccArea: number;
  phyArea: number;
  totalArea: number;
  baseFlux: number;
  isHbmTsv: boolean;
}): DieBlockRect[] {
  const blocks: DieBlockRect[] = [];
  const safeTotal = Math.max(1, params.totalArea);

  // Bottom / Center PHY & TSV I/O Spine
  const phyH = Math.max(12, Math.min(24, (params.phyArea / safeTotal) * 100));
  const eccH =
    params.eccArea > 0.05 ? Math.max(9, Math.min(18, (params.eccArea / safeTotal) * 100)) : 0;

  // Sense amplifier central horizontal spine
  const senseH = Math.max(8, Math.min(14, (params.senseAmpArea / safeTotal) * 100));
  const arrayTotalH = Math.max(42, 96 - phyH - eccH - senseH - (eccH > 0 ? 4.5 : 3));
  const topArrayH = arrayTotalH / 2;
  const botArrayH = arrayTotalH / 2;

  const bankTilesPerHalf = Math.min(8, Math.max(2, Math.round(params.bankCount / 2)));
  const cols = Math.min(4, Math.max(2, Math.ceil(bankTilesPerHalf / 2)));
  const rows = Math.ceil(bankTilesPerHalf / cols);
  const tw = (96 - (cols - 1) * 1.0) / cols;
  const th = (topArrayH - (rows - 1) * 1.0) / rows;
  const banksPerTile = Math.max(1, Math.round(params.bankCount / (bankTilesPerHalf * 2)));

  // Top half memory bank arrays
  for (let i = 0; i < bankTilesPerHalf; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    blocks.push({
      id: `bank_top_${i}`,
      label: banksPerTile > 1 ? `B×${banksPerTile}` : `Bank ${i + 1}`,
      category: 'mem_array',
      x: 2 + c * (tw + 1.0),
      y: 2 + r * (th + 1.0),
      w: tw,
      h: th,
      areaMm2: params.arrayArea / (bankTilesPerHalf * 2),
      heatFluxWPerMm2: params.baseFlux * 0.92,
    });
  }

  // Central Sense Amplifiers & Row/Column Decoders
  const senseY = 2 + topArrayH + 1.5;
  blocks.push({
    id: 'sense_spine',
    label: 'Sense Amps & Row Decoders',
    category: 'sense_amp',
    x: 2,
    y: senseY,
    w: 96,
    h: senseH,
    areaMm2: params.senseAmpArea,
    heatFluxWPerMm2: params.baseFlux * 1.24,
  });

  // Bottom half memory bank arrays
  const botY = senseY + senseH + 1.5;
  for (let i = 0; i < bankTilesPerHalf; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    blocks.push({
      id: `bank_bot_${i}`,
      label: banksPerTile > 1 ? `B×${banksPerTile}` : `Bank ${bankTilesPerHalf + i + 1}`,
      category: 'mem_array',
      x: 2 + c * (tw + 1.0),
      y: botY + r * (th + 1.0),
      w: tw,
      h: th,
      areaMm2: params.arrayArea / (bankTilesPerHalf * 2),
      heatFluxWPerMm2: params.baseFlux * 0.92,
    });
  }

  let nextY = botY + botArrayH + 1.5;
  if (eccH > 0) {
    blocks.push({
      id: 'ecc_engine',
      label: 'On-Die ECC & Wear Controller',
      category: 'ecc_ctrl',
      x: 2,
      y: nextY,
      w: 96,
      h: eccH,
      areaMm2: params.eccArea,
      heatFluxWPerMm2: params.baseFlux * 1.18,
    });
    nextY += eccH + 1.5;
  }

  blocks.push({
    id: 'mem_phy',
    label: params.isHbmTsv
      ? `TSV Micro-Bump PHY (${params.stackLayers}-Hi)`
      : 'High-Speed I/O PHY',
    category: 'tsv_phy',
    x: 2,
    y: Math.min(98 - phyH, nextY),
    w: 96,
    h: Math.max(8, 98 - Math.min(98 - phyH, nextY)),
    areaMm2: params.phyArea,
    heatFluxWPerMm2: params.baseFlux * 1.32,
  });

  return blocks;
}

/**
 * Evaluate a Memory or Solid-State Storage blueprint through the physics & benchmark kernel.
 */
export function evaluateMemoryPhysics(spec: MemoryBlueprint, ctx: PhysicsContext): ChipEvaluation {
  const node = getProcessNode(spec.processNodeId);
  const trans = getTransistorStructure(spec.transistorStructureId);
  const pkg = getPackagingSpec(spec.packagingId);
  const cellArch = getMemoryCellArch(spec.cellArchId);
  const iface = getMemoryInterface(spec.interfaceId);
  const litho = getBestLithography(ctx.unlockedTechIds);
  const waferDia = getMaxWaferDiameterMm(ctx.unlockedTechIds);
  const frontier = computeFrontierModifiers(ctx.frontierLevels);
  const techMods = getAggregatedTechModifiers(ctx.unlockedTechIds);

  const stackLayers = Math.max(1, Math.min(cellArch.maxStackLayers, spec.stackLayers));
  const bitsPerCell = Math.max(1, Math.min(cellArch.maxBitsPerCell, spec.bitsPerCell));
  const eccIdx = Math.max(0, Math.min(ECC_LEVEL_META.length - 1, Math.round(spec.eccLevel)));
  const eccMeta = ECC_LEVEL_META[eccIdx];
  const bitsMeta = BITS_PER_CELL_META[Math.max(0, Math.min(BITS_PER_CELL_META.length - 1, bitsPerCell - 1))];

  // 1. Array Density & Area Budget
  const rawBitsGbit = Math.max(0.001, spec.capacityGB * 8);
  const arrayCellsM = (rawBitsGbit * 1000) / bitsPerCell;

  const nodeDensityScale =
    Math.pow(node.sramDensityMTrPerMm2 / 44, 0.72) *
    Math.sqrt(trans.densityMultiplier) *
    frontier.densityMult *
    Math.sqrt(techMods.sramDensityMult);
  const layerAlpha = cellArch.category === 'rom_nand' ? 0.91 : 0.94;
  const effectiveLayerGain = Math.pow(stackLayers, layerAlpha);
  const effectiveDensityGbitPerMm2 =
    (cellArch.baseGbitPerMm2 * nodeDensityScale * effectiveLayerGain * bitsPerCell) /
    (1 + eccMeta.areaOverhead);

  // Periphery CMOS logic (Sense Amps, ECC controller, I/O PHY)
  const effLogicDensity =
    node.logicDensityMTrPerMm2 *
    trans.densityMultiplier *
    frontier.densityMult *
    techMods.logicDensityMult;
  const busSlices = Math.max(1, spec.busWidthBits / 16);

  const senseAmpMTr = Math.max(0.04, spec.bankCount * Math.pow(node.logicDensityMTrPerMm2, 0.45) * 0.42);
  const eccCtrlMTr =
    spec.eccLevel > 0
      ? spec.eccLevel * Math.max(0.04, Math.pow(spec.bankCount, 0.68) * Math.pow(node.logicDensityMTrPerMm2, 0.48) * 0.36)
      : 0;
  const phyMTr = busSlices * Math.max(0.05, Math.pow(node.logicDensityMTrPerMm2, 0.44) * 0.22);

  const logicMTr = senseAmpMTr + eccCtrlMTr + phyMTr;
  const uncoreMTr = eccCtrlMTr + phyMTr;
  const cacheMTr = arrayCellsM;
  const transistorCountMTr = logicMTr + cacheMTr;

  const arrayArea = Math.max(2.0, rawBitsGbit / Math.max(1e-6, effectiveDensityGbitPerMm2));
  const eccArea = arrayArea * eccMeta.areaOverhead + (eccCtrlMTr > 0 ? eccCtrlMTr / effLogicDensity : 0);
  const senseAmpArea = Math.max(
    0.8,
    arrayArea * (0.075 + 0.0025 * spec.bankCount) + senseAmpMTr / effLogicDensity
  );
  const phyArea = Math.max(
    1.2,
    busSlices * iface.phyAreaPerSliceMm2 * Math.pow(Math.max(1, node.featureSizeNm / 14), 0.14) +
      phyMTr / effLogicDensity
  );

  const dieAreaMm2 = Math.max(4.0, arrayArea + eccArea + senseAmpArea + phyArea);
  const reticleLimitMm2 = Math.min(
    pkg.maxDieAreaMm2,
    litho.reticleLimitMm2 *
      (pkg.id === 'pkg_interposer' || pkg.id === 'pkg_3d_wow' || pkg.id === 'pkg_optical_substrate'
        ? 2.5
        : 1.0)
  );
  const exceedsReticle = dieAreaMm2 > reticleLimitMm2;

  // 2. Voltage Wall, Active Power, Refresh Power & Thermal Equilibrium
  const effRefRateMTs = getEffectiveRefMemoryDataRateMTs(
    spec.processNodeId,
    spec.cellArchId,
    spec.interfaceId,
    spec.transistorStructureId
  );
  const rawMinStableVoltageV = computeMinStableMemoryVoltageV(
    spec.processNodeId,
    spec.cellArchId,
    spec.interfaceId,
    spec.transistorStructureId,
    spec.dataRateMTs,
    bitsPerCell
  );
  const minStableVoltageV = Number(
    (rawMinStableVoltageV / Math.pow(techMods.clockHeadroomMult, 0.35)).toFixed(3)
  );
  const voltageUnstable = spec.voltageV < minStableVoltageV - 0.005;

  const rateRatio = spec.dataRateMTs / Math.max(10, effRefRateMTs);
  const voltNorm = spec.voltageV / Math.max(0.4, node.nominalVoltageV);
  const clockSwitchEff = 1 / Math.pow(techMods.clockHeadroomMult, 0.22);

  const phyDynW =
    busSlices * iface.phyPowerPerSliceW * clockSwitchEff * voltNorm * voltNorm * Math.pow(rateRatio, 1.35);
  const arrayDynW =
    cellArch.activePowerFactor *
    clockSwitchEff *
    Math.sqrt(Math.max(0.5, spec.bankCount)) *
    Math.pow(Math.max(0.01, spec.capacityGB), 0.2) *
    (1 + (bitsPerCell - 1) * 0.14) *
    voltNorm *
    voltNorm *
    Math.pow(rateRatio, 1.4);
  const eccDynW = spec.eccLevel * 0.28 * Math.sqrt(spec.bankCount / 4) * rateRatio;
  const dynamicPowerAtTargetW = Math.max(0.15, phyDynW + arrayDynW + eccDynW);

  const refreshPowerAt25W = cellArch.nonVolatile
    ? 0
    : cellArch.refreshPowerFactor *
      techMods.leakageReductionMult *
      Math.pow(Math.max(0.001, spec.capacityGB), 0.52) *
      voltNorm;

  const peripheryLeakAt25W =
    node.leakageCoeff *
    trans.leakageMultiplier *
    techMods.leakageReductionMult *
    (logicMTr + Math.sqrt(Math.max(0.1, arrayCellsM)) * 0.14) *
    spec.voltageV;
  const baseLeakageAt25CW = peripheryLeakAt25W + refreshPowerAt25W;

  const tunnelingPowerW =
    node.tunnelingFloorWPerMTr *
    (1 - trans.tunnelingMitigation) *
    (logicMTr + Math.sqrt(Math.max(0.1, arrayCellsM)) * 0.08);

  const stackThermalR =
    stackLayers > 1
      ? (cellArch.category === 'rom_nand' ? 0.025 : 0.06) * Math.log2(stackLayers)
      : 0;

  const thermal = solveThermalAndPower({
    dynamicPowerAtTargetW,
    baseLeakageAt25CW,
    tunnelingPowerW,
    powerLimitW: spec.powerLimitW,
    dieAreaMm2,
    coolingId: spec.coolingId,
    packagingId: spec.packagingId,
    transistorId: spec.transistorStructureId,
    frontierThermalMult: frontier.thermalResMult / techMods.coolingEfficiencyMult,
    frontierFluxPenalty: frontier.fluxPenaltyMult,
    extraThermalResistanceCPerW: stackThermalR,
    throttleTempOverrideC: cellArch.id === 'mem_photonic_holo' ? 78 : undefined,
  });

  const tempArg = Math.max(-140, Math.min(180, thermal.junctionTempC));
  const refreshPowerW = Number((refreshPowerAt25W * Math.exp((tempArg - 25) / 42)).toFixed(2));
  const combinedRateRatio = thermal.powerThrottledRatio * thermal.thermalThrottledRatio;
  const sustainedDataRateMTs = Math.round(spec.dataRateMTs * combinedRateRatio);
  const sustainedClockGHz = sustainedDataRateMTs / (Math.max(1, iface.signalingMultiplier) * 1000);

  // 3. Wafer Yield (Murphy + 3D Stack Defect Compounding + ECC Spare Rescue)
  const maturationMult = 0.45 + 0.55 * Math.exp(-0.08 * Math.max(0, ctx.maturationXp));
  const cleanroomMult = Math.pow(0.86, Math.max(0, ctx.cleanroomGrade - 1));
  const stackDefectFactor =
    1 + (cellArch.category === 'rom_nand' ? 0.055 : 0.14) * Math.log2(stackLayers);
  const bitsDefectFactor = 1 + (bitsPerCell - 1) * 0.09;
  const eccRescueFactor = 1 - eccMeta.defectMitigation;

  const effectiveDefectDensity =
    node.baseDefectDensity *
    litho.defectMultiplier *
    trans.defectMultiplier *
    pkg.defectMultiplier *
    cellArch.defectMultiplier *
    stackDefectFactor *
    bitsDefectFactor *
    eccRescueFactor *
    cleanroomMult *
    maturationMult *
    frontier.defectMult *
    techMods.defectReductionMult;

  const qaFactor = 0.94 + ctx.qaBudgetLevel * 0.015 + ((ctx.qaStrictness ?? 1.0) - 1.0) * 0.04;
  const grossDiesPerWafer = exceedsReticle ? 0 : computeGrossDiesPerWafer(waferDia, dieAreaMm2);
  const yieldPercent = exceedsReticle
    ? 0
    : computeMurphyYield(dieAreaMm2, effectiveDefectDensity, qaFactor);
  const goodDiesPerWafer = (grossDiesPerWafer * yieldPercent) / 100;

  // 4. Bandwidth, Latency, Endurance & Benchmarks
  const stabilityPenalty = voltageUnstable ? 0.35 : 1.0;
  const memoryBandwidthGBs =
    (spec.busWidthBits / 8) *
    (sustainedDataRateMTs / 1000) *
    techMods.memoryBandwidthMult *
    stabilityPenalty;

  const bankRelief = 1 / (1 + 0.09 * Math.log2(Math.max(1, spec.bankCount / 4)));
  const rateRelief = Math.pow(effRefRateMTs / Math.max(10, sustainedDataRateMTs), 0.32);
  const stackLatencyMult = 1 + 0.025 * Math.log2(stackLayers);
  const accessLatencyNs = Number(
    (
      cellArch.baseLatencyNs *
      bitsMeta.latencyMult *
      eccMeta.latencyMult *
      stackLatencyMult *
      bankRelief *
      rateRelief
    ).toFixed(1)
  );

  const enduranceCycles = Math.round(
    cellArch.baseEnduranceCycles * bitsMeta.enduranceMult * eccMeta.enduranceMult
  );
  const enduranceTBW = Math.round((spec.capacityGB * Math.min(enduranceCycles, 1e9)) / 1000);
  const iopsK = Math.max(
    1,
    Math.round(spec.bankCount * (1e6 / Math.max(4, accessLatencyNs)) * 0.045 * stabilityPenalty)
  );

  const sequentialThroughput = Math.round(memoryBandwidthGBs * 18);
  const randomAccessScore = Math.round(
    Math.pow(Math.max(1, iopsK), 0.72) * 14 + (1000 / Math.max(5, accessLatencyNs)) * 35
  );
  const storageDensityScore = Math.round(
    Math.pow(Math.max(0.001, spec.capacityGB * 1000), 0.52) *
      (1 + 0.25 * Math.log10(1 + effectiveDensityGbitPerMm2 * 10))
  );
  const enduranceReliability = cellArch.nonVolatile
    ? Math.max(
        10,
        Math.min(100, Math.round(Math.log10(Math.max(10, enduranceCycles)) * 13.5 + spec.eccLevel * 6))
      )
    : Math.min(100, Math.round(82 + spec.eccLevel * 6));

  const memoryPerformance = Math.round(sequentialThroughput * 0.55 + randomAccessScore * 0.45);
  const generalComputing = Math.round(storageDensityScore * 0.5 + randomAccessScore * 0.5);

  let overallRating = 0;
  if (cellArch.category === 'dram') {
    overallRating = Math.round(
      sequentialThroughput * 0.38 +
        randomAccessScore * 0.34 +
        storageDensityScore * 0.18 +
        enduranceReliability * 1.2
    );
  } else if (cellArch.category === 'vram') {
    overallRating = Math.round(
      sequentialThroughput * 0.56 +
        randomAccessScore * 0.22 +
        storageDensityScore * 0.16 +
        enduranceReliability * 0.8
    );
  } else if (cellArch.category === 'rom_nand') {
    overallRating = Math.round(
      storageDensityScore * 0.42 +
        sequentialThroughput * 0.26 +
        randomAccessScore * 0.18 +
        enduranceReliability * 2.4
    );
  } else {
    overallRating = Math.round(
      randomAccessScore * 0.36 +
        sequentialThroughput * 0.28 +
        storageDensityScore * 0.24 +
        enduranceReliability * 1.8
    );
  }

  const totalSystemPowerW = thermal.effectivePowerW + thermal.carnotOverheadW;
  const powerEfficiency = Math.round((overallRating / Math.max(0.5, totalSystemPowerW)) * 10);
  const thermalHeadroom = thermal.throttleTempC - thermal.junctionTempC;
  const thermalPerformance = Math.max(
    5,
    Math.min(100, Math.round(68 + thermalHeadroom * 0.9 - (1 - thermal.thermalThrottledRatio) * 85))
  );

  // 5. Plain-English Bottleneck Diagnostics
  const bottlenecks: BottleneckDiagnostic[] = [];

  if (exceedsReticle) {
    bottlenecks.push({
      id: 'mem_reticle',
      severity: 'critical',
      title: 'Memory Die Exceeds Reticle / Package Limit',
      explanation: `At ${dieAreaMm2.toFixed(1)} mm², this memory die exceeds the ${reticleLimitMm2.toFixed(0)} mm² limit.`,
      recommendation: 'Add vertical 3D stack layers, increase bits-per-cell, reduce capacity, or migrate to a denser node.',
    });
  }

  if (voltageUnstable) {
    bottlenecks.push({
      id: 'mem_voltage',
      severity: 'critical',
      title: 'Supply Voltage Below Stability Threshold',
      explanation: `${spec.dataRateMTs.toLocaleString()} MT/s (${bitsMeta.shortLabel}) requires ≥ ${minStableVoltageV.toFixed(2)} V, but VDD is ${spec.voltageV.toFixed(2)} V.`,
      recommendation: `Click Auto-Stabilize or raise VDD to ≥ ${minStableVoltageV.toFixed(2)} V to eliminate bit errors.`,
    });
  }

  if (cellArch.nonVolatile && bitsPerCell >= 3 && spec.eccLevel < 2) {
    bottlenecks.push({
      id: 'mem_ecc_needed',
      severity: bitsPerCell >= 4 ? 'critical' : 'warning',
      title: `${bitsMeta.shortLabel} High Bit-Error Exposure`,
      explanation: `${bitsMeta.states} charge states per cell with ${eccMeta.label} ECC leaves raw endurance at ${enduranceCycles.toLocaleString()} P/E cycles and hurts wafer yield.`,
      recommendation: 'Enable LDPC or Deep AI-LDPC on-die ECC to rescue defective columns and multiply write endurance.',
    });
  }

  if (!cellArch.nonVolatile && refreshPowerW > thermal.effectivePowerW * 0.25 && thermal.junctionTempC > 72) {
    bottlenecks.push({
      id: 'mem_refresh_spike',
      severity: 'warning',
      title: 'Elevated DRAM Refresh Power',
      explanation: `At ${thermal.junctionTempC.toFixed(1)} °C, capacitor charge leakage requires ${refreshPowerW.toFixed(1)} W of continuous refresh current.`,
      recommendation: 'Improve cooling, lower VDD, or transition to High-k Stacked-Capacitor DRAM.',
    });
  }

  if (thermal.thermalFloorHit) {
    bottlenecks.push({
      id: 'mem_thermal_runaway',
      severity: 'critical',
      title: 'Thermal Runaway — Minimum Throttle Floor Hit',
      explanation: `Even at ${(THERMAL_RATIO_FLOOR * 100).toFixed(0)}% transfer rate, junction temperature stays at ${thermal.junctionTempC.toFixed(1)} °C (limit ${thermal.throttleTempC} °C).`,
      recommendation: 'Upgrade cooling, lower data rate or VDD, or trim 3D stack height to reduce vertical thermal resistance.',
    });
  } else if (thermal.thermalThrottledRatio < 0.96) {
    const lossPct = Math.round((1 - thermal.thermalThrottledRatio) * 100);
    bottlenecks.push({
      id: 'mem_thermal',
      severity: thermal.thermalThrottledRatio < 0.78 ? 'critical' : 'warning',
      title: `Thermal Throttling (-${lossPct}% Data Rate)`,
      explanation: `Array reached ${thermal.junctionTempC.toFixed(1)} °C (limit ${thermal.throttleTempC} °C)${stackLayers > 1 ? ` across ${stackLayers} stacked vertical layers` : ''}.`,
      recommendation: 'Upgrade cooling or packaging thermal spreader, or trim target MT/s and supply voltage.',
    });
  }

  if (thermal.powerThrottledRatio < 0.92) {
    const lossPct = Math.round((1 - thermal.powerThrottledRatio) * 100);
    bottlenecks.push({
      id: 'mem_power_cap',
      severity: 'warning',
      title: `Power Limit Capped (-${lossPct}% Data Rate)`,
      explanation: `Uncapped power (${thermal.rawPowerW.toFixed(1)} W) exceeds the ${spec.powerLimitW} W module power envelope.`,
      recommendation: 'Raise module power limit or reduce bus width / signaling rate.',
    });
  }

  if (yieldPercent < 42 && !exceedsReticle) {
    bottlenecks.push({
      id: 'mem_low_yield',
      severity: 'warning',
      title: `Low Memory Wafer Yield (${yieldPercent.toFixed(1)}%)`,
      explanation: `${dieAreaMm2.toFixed(1)} mm² die with ${stackLayers}-layer stacking yields poorly at ${effectiveDefectDensity.toFixed(2)} defects/cm².`,
      recommendation: 'Raise on-die ECC redundancy tier, mature the process node, or trim die capacity.',
    });
  }

  if (bottlenecks.length === 0) {
    bottlenecks.push({
      id: 'mem_balanced',
      severity: 'info',
      title: 'Balanced Memory / Storage Architecture',
      explanation: 'Areal bit density, interface bandwidth, endurance, thermals, and wafer yield are cleanly aligned.',
      recommendation: 'Ready for tape-out and volume production.',
    });
  }

  const floorplanBlocks = buildMemoryFloorplan({
    bankCount: spec.bankCount,
    stackLayers,
    arrayArea,
    senseAmpArea,
    eccArea,
    phyArea,
    totalArea: dieAreaMm2,
    baseFlux: thermal.heatFluxWPerMm2,
    isHbmTsv: spec.interfaceId === 'iface_hbm_tsv' || stackLayers >= 4,
  });

  const complexity =
    Math.log10(10 + rawBitsGbit * 8 + logicMTr * 10) * (1 + Math.log2(stackLayers) * 0.12);
  const tapeOutCreditCost = Math.round(240 * complexity * (1 + dieAreaMm2 / 420));
  const tapeOutDays = Math.round(Math.min(480, (20 + complexity * 15) * frontier.tapeOutTimeMult));
  const computePowerRating = Math.max(1, overallRating * 0.0115);

  return {
    physics: {
      transistorCountMTr,
      logicMTr,
      cacheMTr,
      uncoreMTr,
      dieAreaMm2,
      reticleLimitMm2,
      exceedsReticle,
      minStableVoltageV,
      voltageUnstable,
      dynamicPowerW: thermal.dynamicPowerW,
      leakagePowerW: thermal.leakagePowerW,
      tunnelingPowerW,
      carnotOverheadW: thermal.carnotOverheadW,
      rawPowerW: thermal.rawPowerW,
      effectivePowerW: thermal.effectivePowerW,
      powerThrottledRatio: thermal.powerThrottledRatio,
      heatFluxWPerMm2: thermal.heatFluxWPerMm2,
      junctionTempC: thermal.junctionTempC,
      throttleTempC: thermal.throttleTempC,
      thermalThrottledRatio: thermal.thermalThrottledRatio,
      thermalFloorHit: thermal.thermalFloorHit,
      sustainedClockGHz,
      memoryBandwidthGBs,
      grossDiesPerWafer,
      effectiveDefectDensity,
      yieldPercent,
      goodDiesPerWafer,
      floorplanBlocks,
      computePowerRating,
      tapeOutCreditCost,
      tapeOutDays,
      capacityGB: spec.capacityGB,
      densityGbitPerMm2: Number(effectiveDensityGbitPerMm2.toFixed(4)),
      accessLatencyNs,
      enduranceCycles,
      enduranceTBW,
      refreshPowerW,
      sustainedDataRateMTs,
      iopsK,
      stackLayers,
      nonVolatile: cellArch.nonVolatile,
    },
    benchmarks: {
      singleCoreCpu: 0,
      multiCoreCpu: 0,
      generalComputing,
      memoryPerformance,
      gamingRendering: 0,
      gpuCompute: 0,
      powerEfficiency,
      thermalPerformance,
      overallRating,
      bottlenecks,
      sequentialThroughput,
      randomAccessScore,
      storageDensityScore,
      enduranceReliability,
    },
    cacheKey: `${spec.id}_r${spec.revision}_m${Math.floor(ctx.maturationXp)}_c${ctx.cleanroomGrade}_q${ctx.qaBudgetLevel}`,
  };
}

export function evaluateChip(spec: ChipBlueprint, ctx: PhysicsContext): ChipEvaluation {
  if (spec.kind === 'cpu') return evaluateCpuPhysics(spec, ctx);
  if (spec.kind === 'gpu') return evaluateGpuPhysics(spec, ctx);
  return evaluateMemoryPhysics(spec, ctx);
}

/**
 * Dirty-flagged memoization cache for 10x multi-millennia performance.
 * Prevents recomputing expensive semiconductor physics on daily simulation ticks.
 */
export class ChipMetricsCache {
  private map = new Map<string, ChipEvaluation>();

  public getOrCompute(
    chip: ChipBlueprint,
    ctx: PhysicsContext,
    globalRevision: number
  ): ChipEvaluation {
    // Discretize maturation XP to integer buckets so minor daily increments don't thrash cache
    const matBucket = Math.floor(ctx.maturationXp);
    const strictBucket = Math.round((ctx.qaStrictness ?? 1.0) * 20);
    const key = `${chip.id}|r${chip.revision}|g${globalRevision}|t${ctx.unlockedTechIds.length}|m${matBucket}|c${ctx.cleanroomGrade}|q${ctx.qaBudgetLevel}|s${strictBucket}`;
    const existing = this.map.get(key);
    if (existing) return existing;

    const computed = evaluateChip(chip, ctx);
    // Keep cache bounded to prevent unbounded memory growth over millennia
    if (this.map.size > 400) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey) this.map.delete(oldestKey);
    }
    this.map.set(key, computed);
    return computed;
  }

  public clear(): void {
    this.map.clear();
  }
}
