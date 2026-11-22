/**
 * Semiconductor Empire — Pure EU4-Style Simulation Engine & State Reducers.
 *
 * ZERO React or DOM dependencies.
 * Optimized for 10x speed and multi-millennia runs via:
 *   - Dirty-flagged ChipMetricsCache (zero daily physics recomputation)
 *   - Multi-day batched ticking before single UI commit
 *   - Bounded monthly ring buffer (120 pts) + decimated multi-century history (240 pts)
 *
 * Economic invariant:
 *   - Manufacturing consumes ONLY abstract physical resources:
 *     Refined Silicon (Si), Grid Power (MW), Fab Wafer Capacity, and Packaging Capacity.
 *   - There are ZERO monetary wafer prices.
 *   - Credits (CR) fund infrastructure, R&D, chip tape-outs, and company operations/payroll.
 */

import {
  FACILITY_BLUEPRINTS,
  FRONTIER_TRACKS,
  getBestLithography,
  getBestUnlockedProcessNode,
  getFrontierTrackCost,
  getMaxParallelResearch,
  getPackagingSpec,
  getProcessNode,
  getTechNode,
  TECH_TREE,
} from './catalog';
import { ChipMetricsCache, type PhysicsContext } from './physics';
import type {
  ChipBlueprint,
  CpuBlueprint,
  DepartmentBudgets,
  DepartmentStaff,
  Facility,
  FacilityKind,
  GameState,
  GpuBlueprint,
  HistoryPoint,
  MilestoneEvent,
  ProductionLine,
  TechCategory,
} from './types';

export const STAFF_MONTHLY_PAYROLL_CR: Record<keyof DepartmentStaff, number> = {
  research: 28,
  architecture: 32,
  fabrication: 22,
  qa: 24,
};

export function formatSimDate(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `Y${y} · M${m} · D${d}`;
}

export function formatCompactNumber(val: number, decimals = 1): string {
  const abs = Math.abs(val);
  if (abs >= 1e12) return `${(val / 1e12).toFixed(decimals)}T`;
  if (abs >= 1e9) return `${(val / 1e9).toFixed(decimals)}B`;
  if (abs >= 1e6) return `${(val / 1e6).toFixed(decimals)}M`;
  if (abs >= 1e3) return `${(val / 1e3).toFixed(decimals)}K`;
  return val.toFixed(decimals === 0 ? 0 : Math.min(decimals, 2)).replace(/\.00$/, '');
}

export function getQaStaffLevelBonus(qaStaff: number): number {
  return Math.min(2, Math.floor(qaStaff / 12));
}

export function getBestFabCleanroomGrade(facilities: Facility[]): number {
  let best = 1;
  for (const fac of facilities) {
    if (fac.kind === 'fab' && (fac.cleanroomGrade ?? 1) > best) {
      best = fac.cleanroomGrade ?? 1;
    }
  }
  return best;
}

export function buildPhysicsContext(
  state: GameState,
  nodeId: string,
  cleanroomGrade = 1,
  qaStrictness = 1.0
): PhysicsContext {
  return {
    unlockedTechIds: state.unlockedTechIds,
    maturationXp: state.nodeMaturationXp[nodeId] ?? 0,
    cleanroomGrade,
    qaBudgetLevel: state.qaBudgetLevel,
    qaStrictness,
    frontierLevels: state.frontierLevels,
  };
}

/**
 * Shared preview physics context used by Architects, Product Testing, and Tape-Out validation
 * so preview yield matches best-fab production yield (including QA staff bonus).
 */
export function buildPreviewPhysicsContext(
  state: GameState,
  nodeId: string,
  qaStrictness = 1.0
): PhysicsContext {
  const ctx = buildPhysicsContext(
    state,
    nodeId,
    getBestFabCleanroomGrade(state.facilities),
    qaStrictness
  );
  ctx.qaBudgetLevel = Math.min(5, state.qaBudgetLevel + getQaStaffLevelBonus(state.staff.qa));
  return ctx;
}

export function createStarterCpuDraft(): CpuBlueprint {
  return {
    id: 'draft_cpu',
    kind: 'cpu',
    name: 'SE-101 Scalar Rev B',
    revision: 1,
    status: 'draft',
    createdYear: 1,
    processNodeId: 'node_10000nm',
    transistorStructureId: 'trans_planar',
    packagingId: 'pkg_dip',
    architectureId: 'cpu_scalar',
    pCores: 1,
    eCores: 0,
    pClockGHz: 0.01,
    eClockGHz: 0.008,
    voltageV: 5.0,
    ipcTuning: 1.0,
    l1CacheKBPerCore: 2,
    l2CacheMBTotal: 0.004,
    l3CacheMBTotal: 0,
    isaExtensions: ['isa_int'],
    memoryTechId: 'ram_dram',
    memoryChannels: 1,
    pcieLanes: 4,
    powerLimitW: 20,
    igpuTier: 0,
    npuTier: 0,
    coolingId: 'cool_passive',
  };
}

export function createStarterGpuDraft(): GpuBlueprint {
  return {
    id: 'draft_gpu',
    kind: 'gpu',
    name: 'GV-10 Raster Engine',
    revision: 1,
    status: 'draft',
    createdYear: 1,
    processNodeId: 'node_10000nm',
    transistorStructureId: 'trans_planar',
    packagingId: 'pkg_dip',
    architectureId: 'gpu_fixed',
    shaderCores: 4,
    clockGHz: 0.006,
    voltageV: 5.0,
    vramCapacityGB: 0.125,
    vramTechId: 'vram_sdr',
    memoryBusWidthBits: 64,
    l1CacheMB: 0.004,
    l2CacheMB: 0.008,
    rops: 2,
    tmus: 4,
    powerLimitW: 20,
    coolingId: 'cool_passive',
  };
}

export function createInitialState(): GameState {
  const starterChip: CpuBlueprint = {
    id: 'chip_se100',
    kind: 'cpu',
    name: 'SE-100 Scalar',
    revision: 1,
    status: 'production',
    createdYear: 1,
    processNodeId: 'node_10000nm',
    transistorStructureId: 'trans_planar',
    packagingId: 'pkg_dip',
    architectureId: 'cpu_scalar',
    pCores: 1,
    eCores: 0,
    pClockGHz: 0.01,
    eClockGHz: 0.008,
    voltageV: 5.0,
    ipcTuning: 1.0,
    l1CacheKBPerCore: 2,
    l2CacheMBTotal: 0.004,
    l3CacheMBTotal: 0,
    isaExtensions: ['isa_int'],
    memoryTechId: 'ram_dram',
    memoryChannels: 1,
    pcieLanes: 4,
    powerLimitW: 15,
    igpuTier: 0,
    npuTier: 0,
    coolingId: 'cool_passive',
  };

  const fabBp = FACILITY_BLUEPRINTS.fab;
  const refBp = FACILITY_BLUEPRINTS.silicon_refinery;
  const pwrBp = FACILITY_BLUEPRINTS.power_plant;
  const labBp = FACILITY_BLUEPRINTS.research_lab;
  const pkgBp = FACILITY_BLUEPRINTS.packaging_plant;

  const facilities: Facility[] = [
    {
      id: 'fab_1',
      name: 'Foundry Alpha',
      kind: 'fab',
      level: 1,
      waferCapacityPerMonth: fabBp.baseWaferCapacityPerMonth ?? 120,
      assignedNodeId: 'node_10000nm',
      cleanroomGrade: fabBp.baseCleanroomGrade ?? 1,
      monthlyUpkeepCR: fabBp.monthlyUpkeepCR,
      powerDrawMW: fabBp.powerDrawMW,
    },
    {
      id: 'ref_1',
      name: 'Silicon Refinery 01',
      kind: 'silicon_refinery',
      level: 1,
      siliconOutputPerMonth: refBp.baseSiliconOutputPerMonth ?? 950,
      monthlyUpkeepCR: refBp.monthlyUpkeepCR,
      powerDrawMW: refBp.powerDrawMW,
    },
    {
      id: 'pwr_1',
      name: 'Substation Prime',
      kind: 'power_plant',
      level: 1,
      powerCapacityMW: pwrBp.basePowerCapacityMW ?? 35,
      monthlyUpkeepCR: pwrBp.monthlyUpkeepCR,
      powerDrawMW: pwrBp.powerDrawMW,
    },
    {
      id: 'lab_1',
      name: 'Central Physics Lab',
      kind: 'research_lab',
      level: 1,
      researchOutputPerDay: labBp.baseResearchOutputPerDay ?? 3.6,
      monthlyUpkeepCR: labBp.monthlyUpkeepCR,
      powerDrawMW: labBp.powerDrawMW,
    },
    {
      id: 'pkg_1',
      name: 'OSAT Assembly Line 01',
      kind: 'packaging_plant',
      level: 1,
      packagingCapacityPerMonth: pkgBp.basePackagingCapacityPerMonth ?? 12000,
      monthlyUpkeepCR: pkgBp.monthlyUpkeepCR,
      powerDrawMW: pkgBp.powerDrawMW,
    },
  ];

  const productionLines: ProductionLine[] = [
    {
      id: 'line_fab_1',
      fabId: 'fab_1',
      chipId: starterChip.id,
      targetWaferStartsPerMonth: 75,
      qaStrictness: 1.0,
      actualWaferStartsPerMonth: 75,
      yieldPercent: 72,
      goodDiesPerMonth: 0,
      siliconConsumedPerMonth: 300,
      powerDrawMW: 1.1,
      statusNote: 'Nominal',
    },
  ];

  const initial: GameState = {
    version: 1,
    companyName: 'Aethelgard Silicon Monopoly',
    clock: { year: 1, month: 1, day: 1, totalDays: 0 },
    speed: 0, // Start paused so player can inspect Year 0001 comfortably
    credits: 4200,
    silicon: 1800,
    researchPointsBank: 0,
    civilizationComputeIndex: 10,
    telemetry: {
      monthlyCreditIncome: 0,
      monthlyPayrollCR: 0,
      monthlyUpkeepCR: 0,
      monthlyCreditNet: 0,
      monthlySiliconProd: 950,
      monthlySiliconConsumed: 300,
      powerCapacityMW: 35,
      powerUsedMW: 20,
      packagingCapacityPerMonth: 12000,
      packagingUsedPerMonth: 0,
      rpPerDay: 5.0,
      goodDiesPerMonth: 0,
      activeChipEcosystemBonus: 1.0,
      siliconStarved: false,
      powerDeficit: false,
      packagingStarved: false,
      inDebt: false,
    },
    unlockedTechIds: [],
    activeResearch: [],
    frontierLevels: {},
    nodeMaturationXp: { node_10000nm: 4 },
    chips: [starterChip],
    cpuDraft: createStarterCpuDraft(),
    gpuDraft: createStarterGpuDraft(),
    facilities,
    productionLines,
    tapeOutQueue: [],
    constructionQueue: [],
    staff: {
      research: 8,
      architecture: 6,
      fabrication: 10,
      qa: 5,
    },
    researchBudgets: {
      fabrication: 35,
      cpu: 25,
      gpu: 20,
      support: 20,
    },
    qaBudgetLevel: 1,
    monthlyHistory: [
      {
        year: 1,
        month: 1,
        totalDays: 0,
        credits: 4200,
        monthlyCreditNet: 0,
        computeIndex: 10,
        goodDiesPerMonth: 0,
        rpPerDay: 5,
      },
    ],
    longTermHistory: [
      {
        year: 1,
        month: 1,
        totalDays: 0,
        credits: 4200,
        monthlyCreditNet: 0,
        computeIndex: 10,
        goodDiesPerMonth: 0,
        rpPerDay: 5,
      },
    ],
    events: [
      {
        id: 'evt_init',
        year: 1,
        month: 1,
        day: 1,
        category: 'milestone',
        title: 'Year 0001 — Silicon Monopoly Chartered',
        detail:
          'Foundry Alpha is online on 10 μm Planar silicon producing SE-100 Scalar CPUs. Unpause time or launch your first research project.',
      },
    ],
    lastAutosaveQuarterKey: 'Y1Q1',
    globalPhysicsRevision: 1,
  };

  // Run one telemetry recalculation pass so Year 0001 dashboard starts with exact real numbers
  const cache = new ChipMetricsCache();
  return recomputeTelemetry(initial, cache);
}

/**
 * Compute derived live telemetry (resource balances, yields, power, packaging, income)
 * without mutating day count. Fast due to ChipMetricsCache.
 */
export function recomputeTelemetry(state: GameState, cache: ChipMetricsCache): GameState {
  const litho = getBestLithography(state.unlockedTechIds);
  const ftDefectLvl = state.frontierLevels['ft_defect'] ?? 0;
  const ftThermalLvl = state.frontierLevels['ft_thermal'] ?? 0;
  const metrologyPowerMult = 1 + 0.04 * ftDefectLvl;
  const thermalSiMult = 1 + 0.03 * ftThermalLvl;

  let techRpMult = 1.0;
  let techSiEff = 1.0;
  for (const tid of state.unlockedTechIds) {
    const t = getTechNode(tid);
    if (t?.effects?.rpMultiplier) techRpMult *= t.effects.rpMultiplier;
    if (t?.effects?.siliconEfficiency) techSiEff *= t.effects.siliconEfficiency;
  }

  let powerCapacityMW = 0;
  let baseFacilityPowerMW = 0;
  let monthlySiliconProd = 0;
  let packagingCapacityPerMonth = 0;
  let baseLabRpPerDay = 0;
  let monthlyUpkeepCR = 0;

  const fabMap = new Map<string, Facility>();
  for (const fac of state.facilities) {
    monthlyUpkeepCR += fac.monthlyUpkeepCR;
    baseFacilityPowerMW += fac.powerDrawMW;
    if (fac.kind === 'fab') {
      fabMap.set(fac.id, fac);
    } else if (fac.kind === 'power_plant') {
      powerCapacityMW += fac.powerCapacityMW ?? 0;
    } else if (fac.kind === 'silicon_refinery') {
      monthlySiliconProd += (fac.siliconOutputPerMonth ?? 0) * techSiEff;
    } else if (fac.kind === 'packaging_plant') {
      packagingCapacityPerMonth += fac.packagingCapacityPerMonth ?? 0;
    } else if (fac.kind === 'research_lab') {
      baseLabRpPerDay += fac.researchOutputPerDay ?? 0;
    }
  }

  // Staff multipliers
  const fabStaffBonus = Math.min(1.5, 0.72 + Math.log10(1 + state.staff.fabrication) * 0.42);
  const qaStaffLevelBonus = getQaStaffLevelBonus(state.staff.qa);

  // Pass 1: Determine gross requested resources across production lines
  let requestedSiPerMonth = 0;
  let requestedFabPowerMW = 0;
  let requestedPackagingPerMonth = 0;

  const chipMap = new Map<string, ChipBlueprint>();
  for (const c of state.chips) chipMap.set(c.id, c);

  interface LinePlan {
    line: ProductionLine;
    fab: Facility;
    chip: ChipBlueprint;
    waferTarget: number;
    siNeeded: number;
    powerMW: number;
    goodDiesAtFull: number;
    pkgNeeded: number;
    yieldPct: number;
    computePerDie: number;
  }

  const plans: LinePlan[] = [];

  for (const line of state.productionLines) {
    const fab = fabMap.get(line.fabId);
    const chip = line.chipId ? chipMap.get(line.chipId) : undefined;
    if (!fab || !chip || chip.status !== 'production' || line.targetWaferStartsPerMonth <= 0) {
      continue;
    }
    const node = getProcessNode(chip.processNodeId);
    const pkg = getPackagingSpec(chip.packagingId);
    const maxWafers = (fab.waferCapacityPerMonth ?? 100) * fabStaffBonus;
    // Stricter QA trades a bit of throughput for yield & reliability
    const qaThroughputFactor = 1.12 - line.qaStrictness * 0.12;
    const waferTarget = Math.min(line.targetWaferStartsPerMonth, maxWafers * qaThroughputFactor);

    const ctx = buildPhysicsContext(
      state,
      chip.processNodeId,
      fab.cleanroomGrade ?? 1,
      line.qaStrictness
    );
    ctx.qaBudgetLevel = Math.min(5, state.qaBudgetLevel + qaStaffLevelBonus);
    const evalRes = cache.getOrCompute(chip, ctx, state.globalPhysicsRevision);

    if (evalRes.physics.exceedsReticle || evalRes.physics.goodDiesPerWafer <= 0) {
      continue;
    }

    const siNeeded = waferTarget * node.siliconPerWafer * thermalSiMult;
    const powerMW =
      (waferTarget / 100) *
      node.powerMWPer100Wafers *
      litho.powerOverheadMultiplier *
      metrologyPowerMult;
    const goodDiesAtFull = waferTarget * evalRes.physics.goodDiesPerWafer;
    const pkgNeeded = goodDiesAtFull * pkg.packagingLoadPerDie;

    requestedSiPerMonth += siNeeded;
    requestedFabPowerMW += powerMW;
    requestedPackagingPerMonth += pkgNeeded;

    plans.push({
      line,
      fab,
      chip,
      waferTarget,
      siNeeded,
      powerMW,
      goodDiesAtFull,
      pkgNeeded,
      yieldPct: evalRes.physics.yieldPercent,
      computePerDie: evalRes.physics.computePowerRating,
    });
  }

  // Physical resource throttling ratios (purely resource-driven, zero monetary wafer price)
  const totalPowerRequested = baseFacilityPowerMW + requestedFabPowerMW;
  const powerScale =
    totalPowerRequested > powerCapacityMW && requestedFabPowerMW > 0
      ? Math.max(0.1, (powerCapacityMW - baseFacilityPowerMW) / requestedFabPowerMW)
      : 1.0;

  // Silicon can draw from reserve buffer too, but warns if monthly consumption exceeds supply + reserve
  const availableSiThisMonth = monthlySiliconProd + state.silicon * 0.5;
  const siliconScale =
    requestedSiPerMonth > availableSiThisMonth && requestedSiPerMonth > 0
      ? Math.max(0.05, availableSiThisMonth / requestedSiPerMonth)
      : 1.0;

  const packagingScale =
    requestedPackagingPerMonth > packagingCapacityPerMonth && requestedPackagingPerMonth > 0
      ? Math.max(0.08, packagingCapacityPerMonth / requestedPackagingPerMonth)
      : 1.0;

  const globalRunScale = Math.min(1.0, powerScale, siliconScale, packagingScale);

  let totalGoodDiesPerMonth = 0;
  let totalDeliveredCompute = 0;
  let actualSiConsumed = 0;
  let actualFabPowerMW = 0;
  let actualPkgUsed = 0;
  let hasActiveCpu = false;
  let hasActiveGpu = false;

  const updatedLines: ProductionLine[] = state.productionLines.map((line) => {
    const plan = plans.find((p) => p.line.id === line.id);
    if (!plan) {
      return {
        ...line,
        actualWaferStartsPerMonth: 0,
        yieldPercent: 0,
        goodDiesPerMonth: 0,
        siliconConsumedPerMonth: 0,
        powerDrawMW: 0,
        statusNote: line.chipId ? 'Idle / Incompatible' : 'Unassigned',
      };
    }

    const actualWafers = plan.waferTarget * globalRunScale;
    const goodDies = plan.goodDiesAtFull * globalRunScale;
    const siUsed = plan.siNeeded * globalRunScale;
    const pwr = plan.powerMW * globalRunScale;
    const pkgUsed = plan.pkgNeeded * globalRunScale;

    totalGoodDiesPerMonth += goodDies;
    totalDeliveredCompute += goodDies * plan.computePerDie;
    actualSiConsumed += siUsed;
    actualFabPowerMW += pwr;
    actualPkgUsed += pkgUsed;
    if (plan.chip.kind === 'cpu') hasActiveCpu = true;
    if (plan.chip.kind === 'gpu') hasActiveGpu = true;

    let statusNote = 'Nominal';
    if (powerScale < 0.99) statusNote = 'Power Throttled';
    else if (siliconScale < 0.99) statusNote = 'Silicon Starved';
    else if (packagingScale < 0.99) statusNote = 'Packaging Capped';

    return {
      ...line,
      actualWaferStartsPerMonth: actualWafers,
      yieldPercent: plan.yieldPct,
      goodDiesPerMonth: goodDies,
      siliconConsumedPerMonth: siUsed,
      powerDrawMW: pwr,
      statusNote,
    };
  });

  // Ecosystem synergy: supplying both CPUs and GPUs amplifies Civilization Compute Demand
  const ecosystemBonus = hasActiveCpu && hasActiveGpu ? 1.32 : 1.0;

  // Civilization Compute Index grows smoothly with delivered compute (logarithmic-power balance across millennia)
  const effectiveComputeIndex = Math.max(
    1,
    Math.round(Math.pow(1 + totalDeliveredCompute * 0.08 * ecosystemBonus, 0.72))
  );

  // Civilization Demand Credit Income (CR/month)
  // Scales organically from Year 0001 (~1,400 CR/mo) across futuristic millennia without inflation runaway
  const techTierFactor = 1 + state.unlockedTechIds.length * 0.14;
  const monthlyCreditIncome = Math.round(
    (220 + Math.pow(totalDeliveredCompute * ecosystemBonus, 0.56) * 24) *
      Math.pow(techTierFactor, 0.62)
  );

  const monthlyPayrollCR =
    state.staff.research * STAFF_MONTHLY_PAYROLL_CR.research +
    state.staff.architecture * STAFF_MONTHLY_PAYROLL_CR.architecture +
    state.staff.fabrication * STAFF_MONTHLY_PAYROLL_CR.fabrication +
    state.staff.qa * STAFF_MONTHLY_PAYROLL_CR.qa +
    (state.qaBudgetLevel - 1) * 140;

  const monthlyCreditNet = monthlyCreditIncome - monthlyPayrollCR - monthlyUpkeepCR;

  // RP / day generation from Research Labs + Research Staff + Architecture Staff synergy
  const staffRpPerDay =
    state.staff.research * 0.52 + state.staff.architecture * 0.22;
  const rpPerDay = Number(
    ((baseLabRpPerDay + staffRpPerDay) * techRpMult * (powerScale < 0.99 ? 0.85 : 1.0)).toFixed(2)
  );

  return {
    ...state,
    civilizationComputeIndex: Math.max(state.civilizationComputeIndex, effectiveComputeIndex),
    productionLines: updatedLines,
    telemetry: {
      monthlyCreditIncome,
      monthlyPayrollCR,
      monthlyUpkeepCR,
      monthlyCreditNet,
      monthlySiliconProd,
      monthlySiliconConsumed: actualSiConsumed,
      powerCapacityMW,
      powerUsedMW: baseFacilityPowerMW + actualFabPowerMW,
      packagingCapacityPerMonth,
      packagingUsedPerMonth: actualPkgUsed,
      rpPerDay,
      goodDiesPerMonth: totalGoodDiesPerMonth,
      activeChipEcosystemBonus: ecosystemBonus,
      siliconStarved: siliconScale < 0.99,
      powerDeficit: totalPowerRequested > powerCapacityMW,
      packagingStarved: packagingScale < 0.99,
      inDebt: state.credits < 0,
    },
  };
}

function appendEvent(events: MilestoneEvent[], event: MilestoneEvent): MilestoneEvent[] {
  const next = [event, ...events];
  return next.length > 150 ? next.slice(0, 150) : next;
}

function pushBoundedHistory(
  monthly: HistoryPoint[],
  longTerm: HistoryPoint[],
  point: HistoryPoint
): { monthlyHistory: HistoryPoint[]; longTermHistory: HistoryPoint[] } {
  const nextMonthly = [...monthly, point];
  const trimmedMonthly = nextMonthly.length > 120 ? nextMonthly.slice(nextMonthly.length - 120) : nextMonthly;

  let nextLongTerm = longTerm;
  // Record into long-term archive every 6 months (or first 24 months) and decimate if > 240 pts
  if (point.month === 1 || point.month === 7 || longTerm.length < 12) {
    nextLongTerm = [...longTerm, point];
    if (nextLongTerm.length > 240) {
      // Decimate odd indices in the older half while keeping the recent 60 points intact
      const older = nextLongTerm.slice(0, 180).filter((_, idx) => idx % 2 === 0);
      const recent = nextLongTerm.slice(180);
      nextLongTerm = [...older, ...recent];
    }
  }
  return { monthlyHistory: trimmedMonthly, longTermHistory: nextLongTerm };
}

export interface TickResult {
  state: GameState;
  milestoneTriggered: boolean;
  shouldAutosave: boolean;
}

/**
 * Advance simulation by N days in a single pure batch (ideal for 1x..10x speed).
 */
export function advanceSimulationDays(
  prevState: GameState,
  daysToStep: number,
  cache: ChipMetricsCache
): TickResult {
  if (daysToStep <= 0) {
    return { state: prevState, milestoneTriggered: false, shouldAutosave: false };
  }

  let state = prevState;
  let milestoneTriggered = false;
  let shouldAutosave = false;
  let needsTelemetryRefresh = false;

  // Step through days cleanly so month boundaries, completions, and milestones stay exact
  for (let d = 0; d < daysToStep; d++) {
    let year = state.clock.year;
    let month = state.clock.month;
    let day = state.clock.day + 1;
    const totalDays = state.clock.totalDays + 1;

    let monthWrapped = false;
    if (day > 30) {
      day = 1;
      month += 1;
      monthWrapped = true;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }

    // 1. Daily resource accrual (1/30th of monthly flows)
    const dailyCreditNet = state.telemetry.monthlyCreditNet / 30;
    const dailySiliconNet =
      (state.telemetry.monthlySiliconProd - state.telemetry.monthlySiliconConsumed) / 30;

    let credits = state.credits + dailyCreditNet;
    if ((credits < 0) !== Boolean(state.telemetry.inDebt)) {
      needsTelemetryRefresh = true;
    }
    const maxSiliconStorage = 4000 + state.telemetry.monthlySiliconProd * 4;
    let silicon = Math.max(0, Math.min(maxSiliconStorage, state.silicon + dailySiliconNet));

    // 2. Research progress across active projects weighted by department budgets
    let activeResearch = state.activeResearch;
    let unlockedTechIds = state.unlockedTechIds;
    let events = state.events;
    let globalPhysicsRevision = state.globalPhysicsRevision;
    let researchPointsBank = state.researchPointsBank;

    if (activeResearch.length > 0) {
      const totalRpDay = state.telemetry.rpPerDay;
      const budgetSum =
        state.researchBudgets.fabrication +
        state.researchBudgets.cpu +
        state.researchBudgets.gpu +
        state.researchBudgets.support;

      // Compute relative weight of each active project
      const weights = activeResearch.map((proj) => {
        const tech = getTechNode(proj.techId);
        const cat: TechCategory = tech?.category ?? 'fabrication';
        const catShare =
          cat === 'frontier'
            ? 25
            : state.researchBudgets[cat as keyof DepartmentBudgets] ?? 25;
        return Math.max(5, catShare / Math.max(1, budgetSum) * 100);
      });
      const weightSum = weights.reduce((a, b) => a + b, 0);

      const remaining: typeof activeResearch = [];
      for (let i = 0; i < activeResearch.length; i++) {
        const proj = activeResearch[i];
        const shareRp = totalRpDay * (weights[i] / Math.max(1, weightSum));
        const nextProg = proj.progressRp + shareRp;
        if (nextProg >= proj.totalRp) {
          const tech = getTechNode(proj.techId);
          if (tech && !unlockedTechIds.includes(tech.id)) {
            unlockedTechIds = [...unlockedTechIds, tech.id];
            globalPhysicsRevision += 1;
            needsTelemetryRefresh = true;
            milestoneTriggered = true;
            events = appendEvent(events, {
              id: `evt_tech_${tech.id}_${totalDays}`,
              year,
              month,
              day,
              category: 'research',
              title: `Breakthrough: ${tech.name}`,
              detail: tech.unlocksSummary.join(' · '),
            });
          }
        } else {
          remaining.push({ ...proj, progressRp: nextProg });
        }
      }
      activeResearch = remaining;
    } else {
      // Bank 100% of daily RP when no active research projects are running (capped reasonably)
      researchPointsBank = Math.min(
        5_000_000,
        researchPointsBank + state.telemetry.rpPerDay
      );
    }

    // 3. Tape-Out Engineering Projects (accelerated by Architecture staff)
    let tapeOutQueue = state.tapeOutQueue;
    let chips = state.chips;
    if (tapeOutQueue.length > 0) {
      const archSpeed = 1 + Math.log10(1 + state.staff.architecture) * 0.45;
      const nextQueue: typeof tapeOutQueue = [];
      for (const job of tapeOutQueue) {
        const nextDays = job.daysCompleted + archSpeed;
        if (nextDays >= job.totalDays) {
          chips = chips.map((c) =>
            c.id === job.chipId ? { ...c, status: 'production' } : c
          );
          milestoneTriggered = true;
          needsTelemetryRefresh = true;
          events = appendEvent(events, {
            id: `evt_tapeout_${job.chipId}_${totalDays}`,
            year,
            month,
            day,
            category: 'tapeout',
            title: `Tape-Out Complete: ${job.chipName}`,
            detail: `${job.kind.toUpperCase()} passed silicon bring-up and is ready to assign in Manufacturing.`,
          });
        } else {
          nextQueue.push({ ...job, daysCompleted: nextDays });
        }
      }
      tapeOutQueue = nextQueue;
    }

    // 4. Infrastructure Construction & Upgrades
    let constructionQueue = state.constructionQueue;
    let facilities = state.facilities;
    let productionLines = state.productionLines;
    if (constructionQueue.length > 0) {
      const nextConst: typeof constructionQueue = [];
      for (const job of constructionQueue) {
        const nextDays = job.daysCompleted + 1;
        if (nextDays >= job.totalDays) {
          if (job.upgradeTargetId) {
            facilities = facilities.map((f) => {
              if (f.id !== job.upgradeTargetId) return f;
              const nextLvl = f.level + 1;
              return {
                ...f,
                level: nextLvl,
                waferCapacityPerMonth: f.waferCapacityPerMonth
                  ? Math.round(f.waferCapacityPerMonth * 1.55)
                  : undefined,
                cleanroomGrade: f.cleanroomGrade
                  ? Math.min(5, f.cleanroomGrade + 1)
                  : undefined,
                siliconOutputPerMonth: f.siliconOutputPerMonth
                  ? Math.round(f.siliconOutputPerMonth * 1.6)
                  : undefined,
                powerCapacityMW: f.powerCapacityMW
                  ? Math.round(f.powerCapacityMW * 1.65)
                  : undefined,
                researchOutputPerDay: f.researchOutputPerDay
                  ? Number((f.researchOutputPerDay * 1.65).toFixed(2))
                  : undefined,
                packagingCapacityPerMonth: f.packagingCapacityPerMonth
                  ? Math.round(f.packagingCapacityPerMonth * 1.65)
                  : undefined,
                monthlyUpkeepCR: Math.round(f.monthlyUpkeepCR * 1.45),
                powerDrawMW: Math.round(f.powerDrawMW * 1.35),
              };
            });
          } else {
            const bp = FACILITY_BLUEPRINTS[job.kind];
            const newId = `${job.kind}_${totalDays}_${job.id}`;
            const bestNode = getBestUnlockedProcessNode(unlockedTechIds);
            const newFac: Facility = {
              id: newId,
              name: job.name,
              kind: job.kind,
              level: 1,
              monthlyUpkeepCR: bp.monthlyUpkeepCR,
              powerDrawMW: bp.powerDrawMW,
              ...(job.kind === 'fab'
                ? {
                    waferCapacityPerMonth: bp.baseWaferCapacityPerMonth ?? 120,
                    assignedNodeId: bestNode.id,
                    cleanroomGrade: bp.baseCleanroomGrade ?? 1,
                  }
                : {}),
              ...(job.kind === 'silicon_refinery'
                ? { siliconOutputPerMonth: bp.baseSiliconOutputPerMonth ?? 950 }
                : {}),
              ...(job.kind === 'power_plant'
                ? { powerCapacityMW: bp.basePowerCapacityMW ?? 35 }
                : {}),
              ...(job.kind === 'research_lab'
                ? { researchOutputPerDay: bp.baseResearchOutputPerDay ?? 3.6 }
                : {}),
              ...(job.kind === 'packaging_plant'
                ? { packagingCapacityPerMonth: bp.basePackagingCapacityPerMonth ?? 12000 }
                : {}),
            };
            facilities = [...facilities, newFac];
            if (job.kind === 'fab') {
              productionLines = [
                ...productionLines,
                {
                  id: `line_${newId}`,
                  fabId: newId,
                  chipId: null,
                  targetWaferStartsPerMonth: 80,
                  qaStrictness: 1.0,
                  actualWaferStartsPerMonth: 0,
                  yieldPercent: 0,
                  goodDiesPerMonth: 0,
                  siliconConsumedPerMonth: 0,
                  powerDrawMW: 0,
                  statusNote: 'Unassigned',
                },
              ];
            }
          }
          milestoneTriggered = true;
          needsTelemetryRefresh = true;
          events = appendEvent(events, {
            id: `evt_const_${job.id}_${totalDays}`,
            year,
            month,
            day,
            category: 'construction',
            title: job.upgradeTargetId ? `Facility Upgraded: ${job.name}` : `Facility Online: ${job.name}`,
            detail: 'Infrastructure expansion completed and added to company capacity.',
          });
        } else {
          nextConst.push({ ...job, daysCompleted: nextDays });
        }
      }
      constructionQueue = nextConst;
    }

    // 5. Process Node Maturation XP from running wafers
    let nodeMaturationXp = state.nodeMaturationXp;
    let maturationCrossedBucket = false;
    for (const line of productionLines) {
      if (line.chipId && line.actualWaferStartsPerMonth > 0) {
        const chip = chips.find((c) => c.id === line.chipId);
        if (chip) {
          const prevXp = nodeMaturationXp[chip.processNodeId] ?? 0;
          if (prevXp < 60) {
            const gain = (line.actualWaferStartsPerMonth / 30) * 0.012;
            const nextXp = Math.min(60, prevXp + gain);
            if (Math.floor(nextXp) > Math.floor(prevXp)) {
              maturationCrossedBucket = true;
            }
            if (nodeMaturationXp === state.nodeMaturationXp) {
              nodeMaturationXp = { ...nodeMaturationXp };
            }
            nodeMaturationXp[chip.processNodeId] = nextXp;
          }
        }
      }
    }
    if (maturationCrossedBucket) {
      needsTelemetryRefresh = true;
    }

    // 6. Monthly history snapshot & quarterly autosave trigger
    let monthlyHistory = state.monthlyHistory;
    let longTermHistory = state.longTermHistory;
    let lastAutosaveQuarterKey = state.lastAutosaveQuarterKey;

    if (monthWrapped) {
      needsTelemetryRefresh = true;
      const snap: HistoryPoint = {
        year,
        month,
        totalDays,
        credits: Math.round(credits),
        monthlyCreditNet: Math.round(state.telemetry.monthlyCreditNet),
        computeIndex: state.civilizationComputeIndex,
        goodDiesPerMonth: Math.round(state.telemetry.goodDiesPerMonth),
        rpPerDay: state.telemetry.rpPerDay,
      };
      const hist = pushBoundedHistory(monthlyHistory, longTermHistory, snap);
      monthlyHistory = hist.monthlyHistory;
      longTermHistory = hist.longTermHistory;

      const quarter = Math.ceil(month / 3);
      const qKey = `Y${year}Q${quarter}`;
      if (qKey !== lastAutosaveQuarterKey) {
        lastAutosaveQuarterKey = qKey;
        shouldAutosave = true;
      }
    }

    state = {
      ...state,
      clock: { year, month, day, totalDays },
      credits,
      silicon,
      researchPointsBank,
      unlockedTechIds,
      activeResearch,
      nodeMaturationXp,
      chips,
      facilities,
      productionLines,
      tapeOutQueue,
      constructionQueue,
      monthlyHistory,
      longTermHistory,
      events,
      lastAutosaveQuarterKey,
      globalPhysicsRevision,
    };
  }

  if (needsTelemetryRefresh || state.telemetry.siliconStarved) {
    state = recomputeTelemetry(state, cache);
  }

  return { state, milestoneTriggered, shouldAutosave };
}

// ─── PLAYER COMMAND HANDLERS (PURE REDUCERS) ─────────────────────────────────

export function canResearchTech(state: GameState, techId: string): { ok: boolean; reason?: string } {
  const tech = getTechNode(techId);
  if (!tech) return { ok: false, reason: 'Technology not found.' };
  if (state.unlockedTechIds.includes(techId)) return { ok: false, reason: 'Already researched.' };
  if (state.activeResearch.some((r) => r.techId === techId)) {
    return { ok: false, reason: 'Already in progress.' };
  }
  const maxSlots = getMaxParallelResearch(state.unlockedTechIds);
  if (state.activeResearch.length >= maxSlots) {
    return { ok: false, reason: `All ${maxSlots} parallel research slots occupied.` };
  }
  const missingPrereqs = tech.prerequisites.filter((p) => !state.unlockedTechIds.includes(p));
  if (missingPrereqs.length > 0) {
    return { ok: false, reason: 'Missing prerequisite technologies.' };
  }
  return { ok: true };
}

export function startResearchProject(state: GameState, techId: string): GameState {
  const check = canResearchTech(state, techId);
  if (!check.ok) return state;
  const tech = getTechNode(techId)!;
  // Apply up to 35% of banked RP immediately as head start if available
  const bankBoost = Math.min(state.researchPointsBank, tech.rpCost * 0.35);
  return {
    ...state,
    researchPointsBank: state.researchPointsBank - bankBoost,
    activeResearch: [
      ...state.activeResearch,
      {
        techId,
        progressRp: bankBoost,
        totalRp: tech.rpCost,
        startedYear: state.clock.year,
        startedMonth: state.clock.month,
      },
    ],
  };
}

export function cancelResearchProject(state: GameState, techId: string): GameState {
  const target = state.activeResearch.find((r) => r.techId === techId);
  if (!target) return state;
  return {
    ...state,
    researchPointsBank: state.researchPointsBank + target.progressRp * 0.5,
    activeResearch: state.activeResearch.filter((r) => r.techId !== techId),
  };
}

export function advanceFrontierTrack(
  state: GameState,
  trackId: string,
  cache: ChipMetricsCache
): GameState {
  const track = FRONTIER_TRACKS.find((t) => t.id === trackId);
  if (!track) return state;
  const level = state.frontierLevels[trackId] ?? 0;
  const cost = getFrontierTrackCost(track, level);
  if (state.researchPointsBank < cost) return state;

  const nextState: GameState = {
    ...state,
    researchPointsBank: state.researchPointsBank - cost,
    frontierLevels: {
      ...state.frontierLevels,
      [trackId]: level + 1,
    },
    globalPhysicsRevision: state.globalPhysicsRevision + 1,
    events: appendEvent(state.events, {
      id: `evt_ft_${trackId}_${level + 1}_${state.clock.totalDays}`,
      year: state.clock.year,
      month: state.clock.month,
      day: state.clock.day,
      category: 'research',
      title: `Frontier Synthesis: ${track.name} L${level + 1}`,
      detail: `${track.diminishingFormulaLabel} · Trade-off: ${track.constraintTradeoff}`,
    }),
  };
  return recomputeTelemetry(nextState, cache);
}

export function startChipTapeOut(
  state: GameState,
  draft: ChipBlueprint,
  cache: ChipMetricsCache
): { state: GameState; error?: string } {
  const ctx = buildPreviewPhysicsContext(state, draft.processNodeId, 1.0);
  const evalRes = cache.getOrCompute(draft, ctx, state.globalPhysicsRevision);

  if (evalRes.physics.exceedsReticle) {
    return { state, error: 'Die area exceeds lithography/package reticle limit. Shrink design first.' };
  }
  if (evalRes.physics.voltageUnstable) {
    return { state, error: 'Core voltage is below Vmin stability threshold. Raise voltage or lower clock.' };
  }
  if (state.credits < 0) {
    return {
      state,
      error: 'Company is in debt. Restore a positive treasury balance before initiating tape-outs.',
    };
  }
  if (state.credits < evalRes.physics.tapeOutCreditCost) {
    return {
      state,
      error: `Insufficient Credits (need ${evalRes.physics.tapeOutCreditCost} CR for tape-out engineering).`,
    };
  }

  const newChipId = `chip_${draft.kind}_${state.clock.totalDays}_${state.chips.length + 1}`;
  const committedChip: ChipBlueprint = {
    ...draft,
    id: newChipId,
    status: 'taping_out',
    createdYear: state.clock.year,
    revision: 1,
  };

  const nextState: GameState = {
    ...state,
    credits: state.credits - evalRes.physics.tapeOutCreditCost,
    chips: [committedChip, ...state.chips],
    tapeOutQueue: [
      ...state.tapeOutQueue,
      {
        id: `to_${newChipId}`,
        chipId: newChipId,
        chipName: committedChip.name,
        kind: committedChip.kind,
        daysCompleted: 0,
        totalDays: evalRes.physics.tapeOutDays,
      },
    ],
    events: appendEvent(state.events, {
      id: `evt_start_to_${newChipId}`,
      year: state.clock.year,
      month: state.clock.month,
      day: state.clock.day,
      category: 'tapeout',
      title: `Tape-Out Initiated: ${committedChip.name}`,
      detail: `Mask generation & silicon validation queued (${evalRes.physics.tapeOutDays} days).`,
    }),
  };

  return { state: nextState };
}

export function queueFacilityBuild(
  state: GameState,
  kind: FacilityKind
): { state: GameState; error?: string } {
  const bp = FACILITY_BLUEPRINTS[kind];
  const existingCount = state.facilities.filter((f) => f.kind === kind).length +
    state.constructionQueue.filter((c) => c.kind === kind && !c.upgradeTargetId).length;
  // Progressive infrastructure scaling cost (no arbitrary wafer fees)
  const scaledCost = Math.round(bp.buildCreditCost * Math.pow(1.22, existingCount));

  if (state.credits < 0) {
    return { state, error: 'Company is in debt. Restore a positive treasury balance before building facilities.' };
  }
  if (state.credits < scaledCost) {
    return { state, error: `Requires ${scaledCost.toLocaleString()} CR.` };
  }

  const name = `${bp.name} ${String(existingCount + 1).padStart(2, '0')}`;
  return {
    state: {
      ...state,
      credits: state.credits - scaledCost,
      constructionQueue: [
        ...state.constructionQueue,
        {
          id: `build_${kind}_${state.clock.totalDays}_${existingCount + 1}`,
          name,
          kind,
          daysCompleted: 0,
          totalDays: bp.buildDays,
          creditCostPaid: scaledCost,
        },
      ],
    },
  };
}

export function queueFacilityUpgrade(
  state: GameState,
  facilityId: string
): { state: GameState; error?: string } {
  const fac = state.facilities.find((f) => f.id === facilityId);
  if (!fac) return { state, error: 'Facility not found.' };
  if (state.constructionQueue.some((c) => c.upgradeTargetId === facilityId)) {
    return { state, error: 'Upgrade already in progress.' };
  }
  const bp = FACILITY_BLUEPRINTS[fac.kind];
  const upgradeCost = Math.round(
    bp.buildCreditCost * Math.pow(bp.upgradeCostMultiplier, fac.level)
  );
  if (state.credits < 0) {
    return { state, error: 'Company is in debt. Restore a positive treasury balance before upgrading facilities.' };
  }
  if (state.credits < upgradeCost) {
    return { state, error: `Requires ${upgradeCost.toLocaleString()} CR.` };
  }

  return {
    state: {
      ...state,
      credits: state.credits - upgradeCost,
      constructionQueue: [
        ...state.constructionQueue,
        {
          id: `upg_${facilityId}_${state.clock.totalDays}`,
          name: `${fac.name} (L${fac.level + 1})`,
          kind: fac.kind,
          upgradeTargetId: facilityId,
          daysCompleted: 0,
          totalDays: Math.round(bp.upgradeDays * (1 + fac.level * 0.25)),
          creditCostPaid: upgradeCost,
        },
      ],
    },
  };
}

export function assignProductionLine(
  state: GameState,
  lineId: string,
  updates: { chipId?: string | null; targetWaferStartsPerMonth?: number; qaStrictness?: number },
  cache: ChipMetricsCache
): GameState {
  const productionLines = state.productionLines.map((line) =>
    line.id === lineId
      ? {
          ...line,
          ...(updates.chipId !== undefined ? { chipId: updates.chipId } : {}),
          ...(updates.targetWaferStartsPerMonth !== undefined
            ? { targetWaferStartsPerMonth: Math.max(0, updates.targetWaferStartsPerMonth) }
            : {}),
          ...(updates.qaStrictness !== undefined
            ? { qaStrictness: Math.max(0.5, Math.min(1.5, updates.qaStrictness)) }
            : {}),
        }
      : line
  );

  // Sync assigned node on the parent fab automatically when assigning a chip
  let facilities = state.facilities;
  if (updates.chipId) {
    const chip = state.chips.find((c) => c.id === updates.chipId);
    const targetLine = productionLines.find((l) => l.id === lineId);
    if (chip && targetLine) {
      facilities = facilities.map((f) =>
        f.id === targetLine.fabId ? { ...f, assignedNodeId: chip.processNodeId } : f
      );
    }
  }

  return recomputeTelemetry({ ...state, productionLines, facilities }, cache);
}

export function adjustDepartmentStaff(
  state: GameState,
  dept: keyof DepartmentStaff,
  delta: number,
  cache: ChipMetricsCache
): GameState {
  const nextCount = Math.max(1, Math.min(500, state.staff[dept] + delta));
  if (nextCount === state.staff[dept]) return state;
  return recomputeTelemetry(
    {
      ...state,
      staff: { ...state.staff, [dept]: nextCount },
    },
    cache
  );
}

export function setDepartmentBudgets(
  state: GameState,
  budgets: DepartmentBudgets
): GameState {
  return { ...state, researchBudgets: budgets };
}

export function setQaBudget(
  state: GameState,
  level: number,
  cache: ChipMetricsCache
): GameState {
  const clamped = Math.max(1, Math.min(5, Math.round(level)));
  return recomputeTelemetry(
    { ...state, qaBudgetLevel: clamped, globalPhysicsRevision: state.globalPhysicsRevision + 1 },
    cache
  );
}

export function archiveChipBlueprint(
  state: GameState,
  chipId: string,
  cache: ChipMetricsCache
): GameState {
  const chips = state.chips.map((c) =>
    c.id === chipId ? { ...c, status: 'archived' as const } : c
  );
  const productionLines = state.productionLines.map((l) =>
    l.chipId === chipId ? { ...l, chipId: null } : l
  );
  return recomputeTelemetry({ ...state, chips, productionLines }, cache);
}

export function getUnlockedTechCountInfo(state: GameState): { unlocked: number; total: number } {
  return { unlocked: state.unlockedTechIds.length, total: TECH_TREE.length };
}
