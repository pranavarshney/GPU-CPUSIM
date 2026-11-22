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
 *
 * 2. DIE AREA (mm^2):
 *    A = ( N_logic / (delta_logic * eta_trans * frontierDensity)
 *        + N_cache / (delta_SRAM  * sqrt(eta_trans) * frontierDensity) )
 *        * (1 + gamma_routing(cores)) + A_IO_pads
 *    Note: SRAM scales slower than logic below 5nm (embedded in node.sramDensityMTrPerMm2).
 *
 * 3. VOLTAGE-FREQUENCY WALL & POWER (GHz, V, W):
 *    V_min(f) = V_nom * (0.72 + 0.28 * (f / (f_ref * archClockEff * transClockMult))^1.85)
 *    P_dyn    = alpha * C_eff * V^2 * f_eff
 *    P_leak   = k_leak * eta_leak * N_tr * V * exp((T_j - 25) / 42)
 *    P_tunnel = tunnelFloor * (1 - trans.tunnelingMitigation) * N_tr
 *    P_raw    = P_dyn + P_leak + P_tunnel
 *    If P_raw > powerLimitW, f_eff rolls back via cubic power-frequency conservation.
 *
 * 4. THERMAL EQUILIBRIUM & CONTINUOUS THROTTLING (deg C, W/mm^2):
 *    Solved via 5-step fixed-point iteration coupling T_j <-> P_leak(T_j):
 *    heatFlux q = P_eff / max(A, 1)  [W/mm^2]
 *    R_hotspot  = 0.12 * q^0.6 * frontierFluxPenalty  [C/W]
 *    T_j = T_amb + P_eff * (max(0.03, (R_cool - R_pkgOffset) * frontierThermal) + R_hotspot)
 *    If T_j > T_throttle:
 *       thermalRatio = max(0.22, 1 - 0.022 * (T_j - T_throttle))
 *       f_sustained  = f_eff * thermalRatio
 *    Cryogenic cooling adds Carnot refrigeration draw: P_carnot = P_eff * carnotOverheadFactor.
 *
 * 5. MURPHY / SQUARED-POISSON WAFER YIELD (defects/cm^2, %):
 *    A_scribe = (sqrt(A) + 0.2)^2  [mm^2], edge exclusion e = 3 mm
 *    N_gross  = floor( pi*(D_w/2 - e)^2 / A_scribe - pi*(D_w - 2e) / sqrt(2 * A_scribe) )
 *    D_eff    = D_base * M_litho * M_trans * M_pkg * M_cleanroom * M_maturation * M_frontier
 *               where M_maturation = 0.45 + 0.55 * exp(-0.08 * maturationXP)
 *    Y        = ((1 - exp(-A_cm2 * D_eff)) / (A_cm2 * D_eff))^2 * eta_QA
 *
 * 6. PERFORMANCE & ROOFLINE BOTTLENECK MODEL:
 *    - CPU Multi-Core uses Amdahl + Interconnect contention:
 *      Scale(C) = C / (1 + 0.025*(C-1) + beta_interconnect * C^1.35 / pkg.interconnectBonus)
 *      Combined smoothly with RAM Bandwidth ceiling (GB/s) via harmonic roofline.
 *    - GPU Rendering combines Shader FLOPS, Pixel/Texel Fill-Rate (ROPs/TMUs), and
 *      VRAM Bandwidth (BusWidth/8 * DataRate * Compression). VRAM capacity does NOT boost
 *      speed linearly; it governs a Workload Footprint Cap penalty only when undersized.
 *
 * LIMITATIONS:
 *    - Steady-state DC thermal equilibrium (no transient ms turbo thermal capacitance).
 *    - Uniform-random defect clustering approximated via Murphy squared-Poisson formula.
 *    - Abstracted macro-engineering models rather than cycle-accurate RTL gate simulation.
 */

import {
  getBestLithography,
  getCoolingSpec,
  getCpuArch,
  getGpuArch,
  getMaxWaferDiameterMm,
  getMemoryTech,
  getPackagingSpec,
  getProcessNode,
  getTransistorStructure,
  ISA_EXTENSIONS,
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
} from './types';

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
    equation: 'V_min(f) = V_nom · (0.72 + 0.28 · (f / f_ref)^1.85)  |  P_dyn = α · C_eff · V² · f_eff',
    units: 'V, GHz, W',
    assumptions: 'Operating below V_min triggers voltage instability. Exceeding power limit invokes cubic frequency rollback.',
  },
  {
    title: 'Leakage, Quantum Tunneling & Thermal Loop',
    equation: 'P_leak = k_leak · N_tr · V · exp((T_j − 25)/42) + P_tunnel  |  T_j = T_amb + P_eff · (R_θ + 0.12 · q^0.6)',
    units: 'W, °C, W/mm², °C/W',
    assumptions: '5-iteration fixed-point solver couples T_j and P_leak. T_j > T_throttle reduces sustained clock continuously.',
  },
  {
    title: 'Murphy Wafer Yield & Process Maturation',
    equation: 'Y = ((1 − exp(−A_cm² · D_eff)) / (A_cm² · D_eff))² · η_QA  |  M_mat = 0.45 + 0.55 · exp(−0.08 · XP)',
    units: 'defects/cm², cm², %',
    assumptions: 'Squared-Poisson Murphy model with 3 mm wafer edge exclusion and 0.2 mm scribe lanes.',
  },
  {
    title: 'Roofline Bandwidth & Multicore Scaling',
    equation: 'Scale(C) = C / (1 + 0.025(C−1) + β · C^1.35 / η_pkg)  |  BW_VRAM = (Bus/8) · MT/s · η_comp',
    units: 'GB/s, GFLOPS',
    assumptions: 'VRAM capacity does not linearly boost FPS; it enforces workload footprint sufficiency. Oversized caches follow logarithmic diminishing returns.',
  },
  {
    title: 'Constrained Frontier Synthesis',
    equation: 'Cost(L) = RP_0 · r^L  |  Gain(L) = c · ln(1 + k · L)',
    units: 'RP, dimensionless multiplier',
    assumptions: 'Exponential RP escalation, logarithmic diminishing returns, plus physical trade-offs (Carnot overhead, flux sensitivity, metrology power).',
  },
];

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

function solveThermalAndPower(params: {
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
  carnotOverheadW: number;
} {
  const cooling = getCoolingSpec(params.coolingId);
  const pkg = getPackagingSpec(params.packagingId);

  // Effective thermal resistance
  const baseR = Math.max(
    0.032,
    (cooling.thermalResistanceCPerW - pkg.thermalResistanceOffset) * params.frontierThermalMult
  );

  // Photonic modulators have an optical drift ceiling at 78 C
  const throttleTempC =
    params.transistorId === 'trans_photonic_gate'
      ? Math.min(cooling.throttleTempC, 78)
      : cooling.throttleTempC;

  // Step 1: Evaluate raw power at nominal temperature estimate to compute power limit rollback
  let tjEstimate = Math.max(cooling.ambientTempC + 10, 45);
  let leakEstimate = params.baseLeakageAt25CW * Math.exp((tjEstimate - 25) / 42);
  let rawPowerW = params.dynamicPowerAtTargetW + leakEstimate + params.tunnelingPowerW;

  // Power limit clamping (cubic frequency-power rollback approximation)
  let powerThrottledRatio = 1.0;
  if (rawPowerW > params.powerLimitW && params.dynamicPowerAtTargetW > 0.01) {
    const allowedDyn = Math.max(
      0.08 * params.dynamicPowerAtTargetW,
      params.powerLimitW - leakEstimate - params.tunnelingPowerW
    );
    powerThrottledRatio = Math.max(
      0.28,
      Math.min(1.0, Math.pow(allowedDyn / params.dynamicPowerAtTargetW, 1 / 2.2))
    );
  }

  let dynPowerW = params.dynamicPowerAtTargetW * Math.pow(powerThrottledRatio, 2.2);

  // Step 2: 5-iteration fixed-point thermal <-> leakage solver
  let junctionTempC = cooling.ambientTempC + 20;
  let leakagePowerW = params.baseLeakageAt25CW;
  let effectivePowerW = dynPowerW + leakagePowerW + params.tunnelingPowerW;
  let heatFluxWPerMm2 = effectivePowerW / Math.max(params.dieAreaMm2, 1);

  for (let i = 0; i < 5; i++) {
    const tempArg = Math.max(-140, Math.min(180, junctionTempC));
    leakagePowerW = params.baseLeakageAt25CW * Math.exp((tempArg - 25) / 42);
    effectivePowerW = Math.min(
      params.powerLimitW * 1.15,
      dynPowerW + leakagePowerW + params.tunnelingPowerW
    );
    heatFluxWPerMm2 = effectivePowerW / Math.max(params.dieAreaMm2, 1);
    const rHotspot = 0.12 * Math.pow(Math.max(0.01, heatFluxWPerMm2), 0.6) * params.frontierFluxPenalty;
    junctionTempC = cooling.ambientTempC + effectivePowerW * (baseR + rHotspot);
  }

  // Step 3: Continuous thermal throttling when Tj > throttleTempC
  let thermalThrottledRatio = 1.0;
  if (junctionTempC > throttleTempC) {
    const excessC = junctionTempC - throttleTempC;
    thermalThrottledRatio = Math.max(0.22, 1 - 0.022 * excessC);
    // Re-settle slightly lower sustained power & temp under throttling
    dynPowerW *= Math.pow(thermalThrottledRatio, 1.8);
    effectivePowerW = dynPowerW + leakagePowerW + params.tunnelingPowerW;
    heatFluxWPerMm2 = effectivePowerW / Math.max(params.dieAreaMm2, 1);
    const rHotspot = 0.12 * Math.pow(Math.max(0.01, heatFluxWPerMm2), 0.6) * params.frontierFluxPenalty;
    junctionTempC = cooling.ambientTempC + effectivePowerW * (baseR + rHotspot);
  }

  rawPowerW = params.dynamicPowerAtTargetW + leakagePowerW + params.tunnelingPowerW;
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
  const effLogicDensity = node.logicDensityMTrPerMm2 * trans.densityMultiplier * frontier.densityMult;
  const effSramDensity =
    node.sramDensityMTrPerMm2 * Math.sqrt(trans.densityMultiplier) * frontier.densityMult;

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
  const effectiveRefClockGHz = node.refClockGHz * arch.clockEfficiency * trans.clockMultiplier;
  const clockRatio = spec.pClockGHz / Math.max(0.005, effectiveRefClockGHz);
  const minStableVoltageV = Number(
    (node.nominalVoltageV * (0.72 + 0.28 * Math.pow(Math.max(0.1, clockRatio), 1.85))).toFixed(3)
  );
  const voltageUnstable = spec.voltageV < minStableVoltageV - 0.005;

  // Dynamic switching power: P_dyn = alpha * C_eff * V^2 * f
  const pDyn =
    0.42 *
    pCoreTotalMTr *
    node.capacitanceFactor *
    arch.powerMultiplier *
    isaPowerPenalty *
    spec.voltageV *
    spec.voltageV *
    spec.pClockGHz;
  const eDyn =
    0.34 *
    eCoreTotalMTr *
    node.capacitanceFactor *
    arch.powerMultiplier *
    0.85 *
    Math.pow(spec.voltageV * 0.9, 2) *
    spec.eClockGHz;
  const uncoreDyn =
    (cacheMTr * 0.06 + igpuMTr * 0.24 + npuMTr * 0.18) *
    node.capacitanceFactor *
    spec.voltageV *
    spec.voltageV *
    Math.min(spec.pClockGHz, effectiveRefClockGHz) +
    spec.memoryChannels * mem.powerPerChannelW * 0.65 +
    spec.pcieLanes * 0.08;

  const dynamicPowerAtTargetW = Math.max(0.25, pDyn + eDyn + uncoreDyn);
  const baseLeakageAt25CW =
    node.leakageCoeff * trans.leakageMultiplier * transistorCountMTr * spec.voltageV;
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
    frontierThermalMult: frontier.thermalResMult,
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
    frontier.defectMult;

  const qaFactor = 0.94 + ctx.qaBudgetLevel * 0.015 + ((ctx.qaStrictness ?? 1.0) - 1.0) * 0.04;
  const grossDiesPerWafer = exceedsReticle ? 0 : computeGrossDiesPerWafer(waferDia, dieAreaMm2);
  const yieldPercent = exceedsReticle
    ? 0
    : computeMurphyYield(dieAreaMm2, effectiveDefectDensity, qaFactor);
  const goodDiesPerWafer = (grossDiesPerWafer * yieldPercent) / 100;

  // 5. Benchmarks & Roofline Bottleneck Analysis
  const memoryBandwidthGBs = spec.memoryChannels * mem.gbpsPerUnit;

  // Diminishing-return cache multiplier
  const cacheGain =
    1 +
    0.09 * Math.log(1 + spec.l1CacheKBPerCore / 32) +
    0.11 * Math.log(1 + spec.l2CacheMBTotal / Math.max(0.5, totalCores * 0.25)) +
    0.13 * Math.log(1 + spec.l3CacheMBTotal / Math.max(1, totalCores * 1.5));

  const effectiveIpc = arch.baseIpc * spec.ipcTuning * frontier.ipcMult;
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

  const multiCoreCpu = Math.round(singleCoreCpu * rawScaling * (0.35 + 0.65 * memRooflineFactor));
  const generalComputing = Math.round(
    (singleCoreCpu * 0.32 + multiCoreCpu * 0.55) * isaComputeBonus +
      spec.npuTier * 180 * Math.sqrt(Math.max(1, node.logicDensityMTrPerMm2))
  );
  const memoryPerformance = Math.round(memoryBandwidthGBs * 18 * (0.7 + 0.3 * Math.min(1.5, cacheGain)));
  const gamingRendering = Math.round(
    singleCoreCpu * 0.42 +
      Math.min(multiCoreCpu, singleCoreCpu * 5.5) * 0.25 +
      spec.igpuTier * 220 * Math.sqrt(Math.max(0.5, sustainedClockGHz * memoryBandwidthGBs))
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

  if (thermal.thermalThrottledRatio < 0.96) {
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
  const tapeOutRpCost = Math.round(18 * complexity);
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
    sustainedClockGHz,
    sustainedEClockGHz,
    memoryBandwidthGBs,
    grossDiesPerWafer,
    effectiveDefectDensity,
    yieldPercent,
    goodDiesPerWafer,
    floorplanBlocks,
    computePowerRating,
    tapeOutRpCost,
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
  const effLogicDensity = node.logicDensityMTrPerMm2 * trans.densityMultiplier * frontier.densityMult;
  const effSramDensity =
    node.sramDensityMTrPerMm2 * Math.sqrt(trans.densityMultiplier) * frontier.densityMult;

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

  // 3. Voltage-Frequency wall & Power
  const effectiveRefClockGHz = node.refClockGHz * 0.72 * arch.clockEfficiency * trans.clockMultiplier;
  const clockRatio = spec.clockGHz / Math.max(0.005, effectiveRefClockGHz);
  const minStableVoltageV = Number(
    (node.nominalVoltageV * (0.7 + 0.3 * Math.pow(Math.max(0.1, clockRatio), 1.85))).toFixed(3)
  );
  const voltageUnstable = spec.voltageV < minStableVoltageV - 0.005;

  const vramBoardPowerW = busSlices * vram.powerPerChannelW * 0.55 + Math.log2(1 + spec.vramCapacityGB) * 1.8;
  const dynamicPowerAtTargetW = Math.max(
    0.5,
    0.54 *
      (shaderMTr + ropTmuMTr * 0.7 + cacheMTr * 0.12) *
      node.capacitanceFactor *
      arch.powerMultiplier *
      spec.voltageV *
      spec.voltageV *
      spec.clockGHz +
      vramBoardPowerW
  );

  const baseLeakageAt25CW =
    node.leakageCoeff * trans.leakageMultiplier * transistorCountMTr * spec.voltageV;
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
    frontierThermalMult: frontier.thermalResMult,
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
    frontier.defectMult;

  const qaFactor = 0.94 + ctx.qaBudgetLevel * 0.015 + ((ctx.qaStrictness ?? 1.0) - 1.0) * 0.04;
  const grossDiesPerWafer = exceedsReticle ? 0 : computeGrossDiesPerWafer(waferDia, dieAreaMm2);
  const yieldPercent = exceedsReticle
    ? 0
    : computeMurphyYield(dieAreaMm2, effectiveDefectDensity, qaFactor);
  const goodDiesPerWafer = (grossDiesPerWafer * yieldPercent) / 100;

  // 5. Roofline Performance Model
  const rawBandwidthGBs = busSlices * vram.gbpsPerUnit;
  const effectiveBandwidthGBs = rawBandwidthGBs * arch.memoryCompression;
  const memoryBandwidthGBs = rawBandwidthGBs;

  const l2CacheRelief = 1 + 0.14 * Math.log(1 + spec.l2CacheMB / 2);
  const peakGflops =
    spec.shaderCores *
    sustainedClockGHz *
    arch.opsPerCorePerClock *
    frontier.ipcMult *
    (voltageUnstable ? 0.35 : 1.0);

  // Pixel & Texel fill-rate demand vs shader compute
  const pixelFillScore = spec.rops * sustainedClockGHz * 14;
  const texelFillScore = spec.tmus * sustainedClockGHz * 7.5;
  const bwScore = effectiveBandwidthGBs * l2CacheRelief * 3.8;
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

  const memoryPerformance = Math.round(effectiveBandwidthGBs * 14 * l2CacheRelief);
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

  if (thermal.thermalThrottledRatio < 0.96) {
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
  const tapeOutRpCost = Math.round(22 * complexity);
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
      sustainedClockGHz,
      memoryBandwidthGBs,
      grossDiesPerWafer,
      effectiveDefectDensity,
      yieldPercent,
      goodDiesPerWafer,
      floorplanBlocks,
      computePowerRating,
      tapeOutRpCost,
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

export function evaluateChip(spec: ChipBlueprint, ctx: PhysicsContext): ChipEvaluation {
  return spec.kind === 'cpu' ? evaluateCpuPhysics(spec, ctx) : evaluateGpuPhysics(spec, ctx);
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
    const key = `${chip.id}|r${chip.revision}|g${globalRevision}|m${matBucket}|c${ctx.cleanroomGrade}|q${ctx.qaBudgetLevel}|s${strictBucket}`;
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
