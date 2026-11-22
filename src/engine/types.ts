/**
 * Core domain types for Semiconductor Empire.
 * Pure TypeScript definitions — zero React or DOM dependencies.
 */

export type SimulationSpeed = 0 | 1 | 2 | 5 | 10;

export type MainSection =
  | 'overview'
  | 'research'
  | 'cpu_architect'
  | 'gpu_architect'
  | 'manufacturing'
  | 'testing'
  | 'infrastructure'
  | 'finances'
  | 'tech_tree';

export type TechCategory = 'fabrication' | 'cpu' | 'gpu' | 'support' | 'frontier';

export type FrontierParadigmId = 'none' | 'cryogenic' | 'photonic' | 'cnt_3d' | 'topological';

export interface SimClock {
  year: number; // Starts at 1 (displayed as Y0001)
  month: number; // 1..12
  day: number; // 1..30
  totalDays: number;
}

export interface ProcessNodeSpec {
  id: string;
  name: string;
  featureSizeNm: number;
  eraLabel: string;
  /** Logic transistor density in Millions of Transistors per mm^2 */
  logicDensityMTrPerMm2: number;
  /** SRAM density in MTr/mm^2 (scales slower than logic below 5nm) */
  sramDensityMTrPerMm2: number;
  /** Nominal operating voltage (V) */
  nominalVoltageV: number;
  /** Reference clock ceiling before steep voltage wall (GHz) */
  refClockGHz: number;
  /** Relative dynamic switching capacitance factor (1.0 at 1000nm reference) */
  capacitanceFactor: number;
  /** Baseline static leakage coefficient (W per MTr per V at 25C) */
  leakageCoeff: number;
  /** Quantum tunneling leakage floor (W per MTr) on deep sub-nm nodes */
  tunnelingFloorWPerMTr: number;
  /** Base defect density D0 (defects / cm^2) before lithography/cleanroom/maturation */
  baseDefectDensity: number;
  /** Silicon units consumed per wafer start */
  siliconPerWafer: number;
  /** Megawatts consumed per 100 wafer starts/month on this node */
  powerMWPer100Wafers: number;
  /** Paradigm affinity if exotic frontier node */
  paradigm: FrontierParadigmId;
  requiredTechId?: string;
}

export interface TransistorStructureSpec {
  id: string;
  name: string;
  densityMultiplier: number;
  leakageMultiplier: number;
  tunnelingMitigation: number; // 0..0.95 fraction of tunneling removed
  clockMultiplier: number;
  defectMultiplier: number;
  description: string;
  constraintNote: string;
  requiredTechId?: string;
}

export interface LithographySpec {
  id: string;
  name: string;
  defectMultiplier: number;
  reticleLimitMm2: number;
  powerOverheadMultiplier: number;
  requiredTechId?: string;
}

export interface PackagingSpec {
  id: string;
  name: string;
  maxDieAreaMm2: number;
  thermalResistanceOffset: number; // C/W reduction
  defectMultiplier: number; // Assembly yield impact
  interconnectBonus: number; // Reduces multicore scaling contention
  packagingLoadPerDie: number; // Consumes Packaging Facility capacity
  description: string;
  requiredTechId?: string;
}

export interface CoolingSpec {
  id: string;
  name: string;
  ambientTempC: number;
  thermalResistanceCPerW: number;
  maxRecommendedTdpW: number;
  throttleTempC: number;
  /** Carnot refrigeration overhead multiplier on top of chip TDP (0 for non-cryo) */
  carnotOverheadFactor: number;
  description: string;
  requiredTechId?: string;
}

export interface CpuArchSpec {
  id: string;
  name: string;
  baseIpc: number;
  maxIpcTuning: number;
  pCoreMTr: number;
  eCoreMTr: number;
  clockEfficiency: number;
  powerMultiplier: number;
  interconnectContention: number; // Beta in Amdahl+interconnect scaling
  maxPCores: number;
  maxECores: number;
  supportsECores: boolean;
  description: string;
  requiredTechId?: string;
}

export interface GpuArchSpec {
  id: string;
  name: string;
  opsPerCorePerClock: number;
  shaderMTrPerCore: number;
  clockEfficiency: number;
  powerMultiplier: number;
  memoryCompression: number; // Effective bandwidth multiplier
  rayTracingFactor: number;
  computeEfficiency: number;
  maxShaderCores: number;
  description: string;
  requiredTechId?: string;
}

export interface MemoryTechSpec {
  id: string;
  name: string;
  kind: 'ram' | 'vram';
  /** Data rate in MT/s */
  dataRateMTs: number;
  powerPerChannelW: number;
  /** Bandwidth per channel (GB/s) for RAM or per 32-bit bus slice for VRAM */
  gbpsPerUnit: number;
  maxCapacityPerUnitGB: number;
  requiredTechId?: string;
}

export interface IsaExtensionSpec {
  id: string;
  name: string;
  shortLabel: string;
  transistorOverheadRatio: number; // Fraction added to core logic
  singleCoreBonus: number;
  generalComputeBonus: number;
  powerPenalty: number;
  requiredTechId?: string;
}

export interface TechNode {
  id: string;
  name: string;
  category: TechCategory;
  tier: number;
  rpCost: number;
  prerequisites: string[];
  /** Graph coordinates for zoomable canvas */
  x: number;
  y: number;
  summary: string;
  unlocksSummary: string[];
  /** New engineering trade-off or physical constraint introduced */
  constraintWarning?: string;
  /** Optional global modifiers */
  effects?: {
    waferDiameterMm?: number;
    cleanroomDefectMult?: number;
    lithoId?: string;
    rpMultiplier?: number;
    siliconEfficiency?: number;
    powerEfficiency?: number;
    maxParallelResearch?: number;
    maxPcieGen?: number;
    unlocksIgpuMaxTier?: number;
    unlocksNpuMaxTier?: number;
    unlocksParadigm?: FrontierParadigmId;
  };
}

export interface FrontierTrackSpec {
  id: string;
  name: string;
  paradigm: FrontierParadigmId;
  baseRpCost: number;
  costExponent: number; // e.g., 1.65^level
  description: string;
  diminishingFormulaLabel: string;
  constraintTradeoff: string;
}

export interface CpuBlueprint {
  id: string;
  kind: 'cpu';
  name: string;
  revision: number;
  status: 'draft' | 'taping_out' | 'production' | 'archived';
  createdYear: number;
  processNodeId: string;
  transistorStructureId: string;
  packagingId: string;
  architectureId: string;
  pCores: number;
  eCores: number;
  pClockGHz: number;
  eClockGHz: number;
  voltageV: number;
  ipcTuning: number; // 0.85 .. arch.maxIpcTuning
  l1CacheKBPerCore: number;
  l2CacheMBTotal: number;
  l3CacheMBTotal: number;
  isaExtensions: string[];
  memoryTechId: string;
  memoryChannels: number;
  pcieLanes: number;
  powerLimitW: number;
  igpuTier: number; // 0 = none, 1..5
  npuTier: number; // 0 = none, 1..5
  coolingId: string;
}

export interface GpuBlueprint {
  id: string;
  kind: 'gpu';
  name: string;
  revision: number;
  status: 'draft' | 'taping_out' | 'production' | 'archived';
  createdYear: number;
  processNodeId: string;
  transistorStructureId: string;
  packagingId: string;
  architectureId: string;
  shaderCores: number;
  clockGHz: number;
  voltageV: number;
  vramCapacityGB: number;
  vramTechId: string;
  memoryBusWidthBits: number;
  l1CacheMB: number;
  l2CacheMB: number;
  rops: number;
  tmus: number;
  powerLimitW: number;
  coolingId: string;
}

export type ChipBlueprint = CpuBlueprint | GpuBlueprint;

export interface DieBlockRect {
  id: string;
  label: string;
  category:
    | 'p_core'
    | 'e_core'
    | 'shader'
    | 'cache'
    | 'igpu'
    | 'npu'
    | 'io'
    | 'memory_ctrl'
    | 'rop_tmu'
    | 'uncore';
  x: number; // 0..100 normalized
  y: number; // 0..100 normalized
  w: number;
  h: number;
  areaMm2: number;
  heatFluxWPerMm2: number;
}

export interface BottleneckDiagnostic {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  explanation: string;
  recommendation: string;
}

export interface ChipPhysicsReport {
  transistorCountMTr: number;
  logicMTr: number;
  cacheMTr: number;
  uncoreMTr: number;
  dieAreaMm2: number;
  reticleLimitMm2: number;
  exceedsReticle: boolean;
  minStableVoltageV: number;
  voltageUnstable: boolean;
  dynamicPowerW: number;
  leakagePowerW: number;
  tunnelingPowerW: number;
  carnotOverheadW: number;
  rawPowerW: number;
  effectivePowerW: number;
  powerThrottledRatio: number; // 1.0 = no power cap
  heatFluxWPerMm2: number;
  junctionTempC: number;
  throttleTempC: number;
  thermalThrottledRatio: number; // 1.0 = no thermal throttle
  sustainedClockGHz: number;
  sustainedEClockGHz?: number;
  memoryBandwidthGBs: number;
  grossDiesPerWafer: number;
  effectiveDefectDensity: number;
  yieldPercent: number;
  goodDiesPerWafer: number;
  floorplanBlocks: DieBlockRect[];
  computePowerRating: number; // Unified civilization compute contribution per good die
  tapeOutRpCost: number;
  tapeOutCreditCost: number;
  tapeOutDays: number;
}

export interface ChipBenchmarkReport {
  singleCoreCpu: number;
  multiCoreCpu: number;
  generalComputing: number;
  memoryPerformance: number;
  gamingRendering: number;
  gpuCompute: number;
  powerEfficiency: number; // Perf per Watt index
  thermalPerformance: number; // 0..100 sustained thermal headroom score
  overallRating: number;
  bottlenecks: BottleneckDiagnostic[];
}

export interface ChipEvaluation {
  physics: ChipPhysicsReport;
  benchmarks: ChipBenchmarkReport;
  cacheKey: string;
}

export type FacilityKind =
  | 'fab'
  | 'silicon_refinery'
  | 'power_plant'
  | 'research_lab'
  | 'packaging_plant';

export interface Facility {
  id: string;
  name: string;
  kind: FacilityKind;
  level: number;
  /** For fabs: maximum wafer starts/month */
  waferCapacityPerMonth?: number;
  /** For fabs: assigned process node */
  assignedNodeId?: string;
  /** For fabs: cleanroom grade (1..5) lowering defect density */
  cleanroomGrade?: number;
  /** For refineries: Si produced per month */
  siliconOutputPerMonth?: number;
  /** For power plants: MW supplied */
  powerCapacityMW?: number;
  /** For research labs: base RP / day */
  researchOutputPerDay?: number;
  /** For packaging plants: package capacity / month */
  packagingCapacityPerMonth?: number;
  monthlyUpkeepCR: number;
  powerDrawMW: number;
}

export interface ProductionLine {
  id: string;
  fabId: string;
  chipId: string | null;
  targetWaferStartsPerMonth: number;
  /** 0.5 (fast/loose) .. 1.5 (strict QA screening) */
  qaStrictness: number;
  /** Derived live metrics updated on tick */
  actualWaferStartsPerMonth: number;
  yieldPercent: number;
  goodDiesPerMonth: number;
  siliconConsumedPerMonth: number;
  powerDrawMW: number;
  statusNote: string;
}

export interface ResearchProject {
  techId: string;
  progressRp: number;
  totalRp: number;
  startedYear: number;
  startedMonth: number;
}

export interface TapeOutProject {
  id: string;
  chipId: string;
  chipName: string;
  kind: 'cpu' | 'gpu';
  daysCompleted: number;
  totalDays: number;
}

export interface ConstructionProject {
  id: string;
  name: string;
  kind: FacilityKind;
  upgradeTargetId?: string; // If upgrading an existing facility
  daysCompleted: number;
  totalDays: number;
  creditCostPaid: number;
}

export interface DepartmentStaff {
  research: number;
  architecture: number;
  fabrication: number;
  qa: number;
}

export interface DepartmentBudgets {
  fabrication: number; // % share 0..100 (normalized)
  cpu: number;
  gpu: number;
  support: number;
}

export interface HistoryPoint {
  year: number;
  month: number;
  totalDays: number;
  credits: number;
  monthlyCreditNet: number;
  computeIndex: number;
  goodDiesPerMonth: number;
  rpPerDay: number;
}

export interface MilestoneEvent {
  id: string;
  year: number;
  month: number;
  day: number;
  category: 'research' | 'tapeout' | 'construction' | 'milestone' | 'warning';
  title: string;
  detail: string;
}

export interface GameState {
  version: number;
  companyName: string;
  clock: SimClock;
  speed: SimulationSpeed;
  credits: number;
  silicon: number;
  researchPointsBank: number;
  civilizationComputeIndex: number;
  /** Daily / Monthly computed flow telemetry */
  telemetry: {
    monthlyCreditIncome: number;
    monthlyPayrollCR: number;
    monthlyUpkeepCR: number;
    monthlyCreditNet: number;
    monthlySiliconProd: number;
    monthlySiliconConsumed: number;
    powerCapacityMW: number;
    powerUsedMW: number;
    packagingCapacityPerMonth: number;
    packagingUsedPerMonth: number;
    rpPerDay: number;
    goodDiesPerMonth: number;
    activeChipEcosystemBonus: number;
    siliconStarved: boolean;
    powerDeficit: boolean;
    packagingStarved: boolean;
  };
  unlockedTechIds: string[];
  activeResearch: ResearchProject[];
  /** Repeatable frontier track levels (id -> level) */
  frontierLevels: Record<string, number>;
  /** Process node maturation XP (nodeId -> accumulated wafer-run XP) */
  nodeMaturationXp: Record<string, number>;
  /** All saved / taped-out / production chips */
  chips: ChipBlueprint[];
  /** Current live drafts in Architects */
  cpuDraft: CpuBlueprint;
  gpuDraft: GpuBlueprint;
  facilities: Facility[];
  productionLines: ProductionLine[];
  tapeOutQueue: TapeOutProject[];
  constructionQueue: ConstructionProject[];
  staff: DepartmentStaff;
  researchBudgets: DepartmentBudgets;
  qaBudgetLevel: number; // 1..5
  /** Rolling high-resolution monthly history (max 120 points = 10 years) */
  monthlyHistory: HistoryPoint[];
  /** Decimated multi-century history (max 240 points across thousands of years) */
  longTermHistory: HistoryPoint[];
  events: MilestoneEvent[];
  /** Internal counters */
  lastAutosaveQuarterKey: string;
  globalPhysicsRevision: number;
}

export interface SaveSlotMetadata {
  slotId: string; // 'slot-1'..'slot-4' or 'autosave-...'
  label: string;
  isAutosave: boolean;
  savedAtIso: string;
  year: number;
  month: number;
  day: number;
  credits: number;
  computeIndex: number;
  unlockedTechCount: number;
}

export interface SaveRecord {
  meta: SaveSlotMetadata;
  state: GameState;
}

export interface UiSettings {
  pauseOnMilestone: boolean;
  thermalOverlayDefault: boolean;
  showEquationsBanner: boolean;
}
