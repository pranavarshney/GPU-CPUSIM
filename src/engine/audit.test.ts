/**
 * Semiconductor Empire — Audit Fix Verification Suite.
 * Pure TypeScript test script (run with: npx tsx src/engine/audit.test.ts).
 */

import assert from 'node:assert/strict';
import {
  COOLING_SPECS,
  CPU_ARCHITECTURES,
  FACILITY_BLUEPRINTS,
  getAggregatedTechModifiers,
  getBestUnlockedProcessNode,
  GPU_ARCHITECTURES,
  ISA_EXTENSIONS,
  LITHOGRAPHY_SPECS,
  MEMORY_CELL_ARCHS,
  MEMORY_INTERFACES,
  MEMORY_TECHS,
  PACKAGING_SPECS,
  PROCESS_NODES,
  TECH_LANES,
  TECH_NODE_H,
  TECH_NODE_W,
  TECH_TREE,
  TRANSISTOR_STRUCTURES,
} from './catalog';
import {
  applyCpuNodeChange,
  applyGpuNodeChange,
  applyGpuVramChange,
  ChipMetricsCache,
  evaluateCpuPhysics,
  evaluateGpuPhysics,
  evaluateMemoryPhysics,
  getCpuSliderBounds,
  getGpuSliderBounds,
  getMaxClockForArch,
  getMaxMemoryDataRateMTs,
  getMaxMemoryVoltageForConfig,
  getMaxVoltageForConfig,
  getMemorySliderBounds,
  getStabilizedVoltageV,
  solveThermalAndPower,
  THERMAL_RATIO_FLOOR,
  type PhysicsContext,
  type SliderRange,
} from './physics';
import {
  advanceSimulationDays,
  buildPreviewPhysicsContext,
  createInitialState,
  createStarterCpuDraft,
  createStarterGpuDraft,
  createStarterMemoryDraft,
  migrateGameState,
  queueFacilityBuild,
  queueFacilityUpgrade,
  recomputeTelemetry,
  startChipTapeOut,
} from './simulation';
import type { GameState, MemoryBlueprint } from './types';

const BASE_CTX: PhysicsContext = {
  unlockedTechIds: [
    'sup_cooling_air',
    'sup_ram_sdram',
    'sup_packaging_flipchip',
    'sup_cooling_vapor',
    'sup_ram_ddr',
    'sup_cooling_liquid',
    'sup_packaging_25d',
    'sup_ram_ddr5',
    'sup_packaging_3d',
    'sup_cooling_immersion',
    'frontier_cryogenic',
    'frontier_photonic',
    'frontier_cnt',
    'frontier_topological',
  ],
  maturationXp: 20,
  cleanroomGrade: 2,
  qaBudgetLevel: 2,
  qaStrictness: 1.0,
  frontierLevels: {},
};

function assertInSliderRange(label: string, val: number, range: SliderRange): void {
  assert.ok(
    val >= range.min - 1e-9 && val <= range.max + 1e-9,
    `${label}: value ${val} out of [${range.min}, ${range.max}]`
  );
  const stepsFromMin = (val - range.min) / range.step;
  assert.ok(
    Math.abs(stepsFromMin - Math.round(stepsFromMin)) < 1e-5,
    `${label}: value ${val} is not aligned to min=${range.min}, step=${range.step} (offset=${stepsFromMin})`
  );
  const spanSteps = (range.max - range.min) / range.step;
  assert.ok(
    Math.abs(spanSteps - Math.round(spanSteps)) < 1e-5,
    `${label}: max=${range.max} is not aligned to min=${range.min}, step=${range.step}`
  );
}

let passed = 0;
function test(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  [PASS] ${name}`);
}

console.log('Running Semiconductor Empire Audit Verification Suite...\n');

// ─── TEST 1: Slider clock range vs voltage range for EVERY (node, arch, trans) ──
test('1. Every (node, arch, trans) for CPU and GPU is voltage-stable at max clock + max voltage', () => {
  const cpuBase = createStarterCpuDraft();
  const gpuBase = createStarterGpuDraft();
  let cpuChecked = 0;
  let gpuChecked = 0;

  for (const node of PROCESS_NODES) {
    for (const trans of TRANSISTOR_STRUCTURES) {
      for (const arch of CPU_ARCHITECTURES) {
        const maxClock = getMaxClockForArch('cpu', node.id, arch.id, trans.id);
        const maxVolt = getMaxVoltageForConfig('cpu', node.id, arch.id, trans.id);
        const res = evaluateCpuPhysics(
          {
            ...cpuBase,
            processNodeId: node.id,
            architectureId: arch.id,
            transistorStructureId: trans.id,
            pClockGHz: maxClock,
            eClockGHz: Math.min(maxClock, maxClock * 0.7),
            voltageV: maxVolt,
          },
          BASE_CTX
        );
        assert.equal(
          res.physics.voltageUnstable,
          false,
          `CPU unstable at max clock (${maxClock} GHz) & max voltage (${maxVolt} V, Vmin=${res.physics.minStableVoltageV} V) for ${node.id}/${arch.id}/${trans.id}`
        );
        cpuChecked += 1;
      }

      for (const arch of GPU_ARCHITECTURES) {
        const maxClock = getMaxClockForArch('gpu', node.id, arch.id, trans.id);
        const maxVolt = getMaxVoltageForConfig('gpu', node.id, arch.id, trans.id);
        const res = evaluateGpuPhysics(
          {
            ...gpuBase,
            processNodeId: node.id,
            architectureId: arch.id,
            transistorStructureId: trans.id,
            clockGHz: maxClock,
            voltageV: maxVolt,
          },
          BASE_CTX
        );
        assert.equal(
          res.physics.voltageUnstable,
          false,
          `GPU unstable at max clock (${maxClock} GHz) & max voltage (${maxVolt} V, Vmin=${res.physics.minStableVoltageV} V) for ${node.id}/${arch.id}/${trans.id}`
        );
        gpuChecked += 1;
      }
    }
  }
  assert.ok(cpuChecked > 0 && gpuChecked > 0);
});

// ─── TEST 2: Tj <= throttleTempC after solveThermalAndPower unless 0.22 floor hit ──
test('2. solveThermalAndPower settles Tj <= throttleTempC unless 0.22 floor is hit (with critical diagnostic)', () => {
  const dynPowers = [5, 35, 120, 350, 800, 2000];
  const powerLimits = [15, 65, 180, 450, 1200];
  let floorHitObserved = false;

  for (const cooling of COOLING_SPECS) {
    for (const dyn of dynPowers) {
      for (const pLim of powerLimits) {
        const res = solveThermalAndPower({
          dynamicPowerAtTargetW: dyn,
          baseLeakageAt25CW: dyn * 0.04,
          tunnelingPowerW: dyn * 0.01,
          powerLimitW: pLim,
          dieAreaMm2: 180,
          coolingId: cooling.id,
          packagingId: 'pkg_lga',
          transistorId: 'trans_finfet',
          frontierThermalMult: 1.0,
          frontierFluxPenalty: 1.0,
        });

        if (res.thermalThrottledRatio > THERMAL_RATIO_FLOOR + 1e-6) {
          assert.ok(
            res.junctionTempC <= res.throttleTempC + 1e-3,
            `Tj (${res.junctionTempC}) exceeded throttleTempC (${res.throttleTempC}) without hitting 0.22 floor (ratio=${res.thermalThrottledRatio}, cooling=${cooling.id}, dyn=${dyn}, pLim=${pLim})`
          );
        } else if (res.junctionTempC > res.throttleTempC) {
          assert.equal(res.thermalFloorHit, true, 'thermalFloorHit should be true when floor hit and Tj > limit');
          floorHitObserved = true;
        }
      }
    }
  }
  assert.ok(floorHitObserved, 'Expected extreme cooling overload case to hit the 0.22 thermal floor');

  // Verify evaluator emits critical thermal_runaway bottleneck when 0.22 floor is exceeded
  const hotCpu = evaluateCpuPhysics(
    {
      ...createStarterCpuDraft(),
      processNodeId: 'node_130nm',
      architectureId: 'cpu_ooo',
      transistorStructureId: 'trans_planar',
      packagingId: 'pkg_dip',
      coolingId: 'cool_passive',
      pCores: 32,
      eCores: 16,
      pClockGHz: 2.8,
      eClockGHz: 2.2,
      voltageV: 2.2,
      l3CacheMBTotal: 64,
      powerLimitW: 1200,
    },
    BASE_CTX
  );
  assert.equal(hotCpu.physics.thermalFloorHit, true);
  assert.ok(
    hotCpu.benchmarks.bottlenecks.some((b) => b.id === 'thermal_runaway' && b.severity === 'critical'),
    'Expected critical thermal_runaway bottleneck diagnostic'
  );
});

// ─── TEST 3: Raising powerLimitW never reduces sustainedClockGHz ────────────────
test('3. Raising powerLimitW never reduces sustainedClockGHz across CPU & GPU sweeps', () => {
  const limits = [10, 20, 35, 50, 75, 100, 140, 180, 250, 350, 500, 750, 1000, 1200];
  const cpuConfigs = [
    {
      ...createStarterCpuDraft(),
      processNodeId: 'node_45nm',
      architectureId: 'cpu_ooo',
      transistorStructureId: 'trans_finfet',
      packagingId: 'pkg_lga',
      coolingId: 'cool_air',
      pCores: 8,
      pClockGHz: 3.0,
      voltageV: 1.35,
    },
    {
      ...createStarterCpuDraft(),
      processNodeId: 'node_5nm',
      architectureId: 'cpu_hetero',
      transistorStructureId: 'trans_gaa',
      packagingId: 'pkg_interposer',
      coolingId: 'cool_heatpipe',
      pCores: 24,
      eCores: 16,
      pClockGHz: 5.5,
      eClockGHz: 4.0,
      voltageV: 0.95,
    },
  ];

  for (const cfg of cpuConfigs) {
    let prevClock = 0;
    for (const powerLimitW of limits) {
      const res = evaluateCpuPhysics({ ...cfg, powerLimitW }, BASE_CTX);
      assert.ok(
        res.physics.sustainedClockGHz >= prevClock - 1e-4,
        `CPU sustainedClockGHz dropped from ${prevClock} to ${res.physics.sustainedClockGHz} when raising powerLimitW to ${powerLimitW}W`
      );
      prevClock = res.physics.sustainedClockGHz;
    }
  }

  const gpuCfg = {
    ...createStarterGpuDraft(),
    processNodeId: 'node_14nm',
    architectureId: 'gpu_unified',
    transistorStructureId: 'trans_finfet',
    packagingId: 'pkg_lga',
    coolingId: 'cool_heatpipe',
    shaderCores: 2048,
    rops: 64,
    tmus: 128,
    clockGHz: 1.8,
    voltageV: 1.05,
    vramTechId: 'vram_gddr5',
    memoryBusWidthBits: 256,
    vramCapacityGB: 8,
    l1CacheMB: 2,
    l2CacheMB: 8,
  };
  let prevGpuClock = 0;
  for (const powerLimitW of limits) {
    const res = evaluateGpuPhysics({ ...gpuCfg, powerLimitW }, BASE_CTX);
    assert.ok(
      res.physics.sustainedClockGHz >= prevGpuClock - 1e-4,
      `GPU sustainedClockGHz dropped from ${prevGpuClock} to ${res.physics.sustainedClockGHz} when raising powerLimitW to ${powerLimitW}W`
    );
    prevGpuClock = res.physics.sustainedClockGHz;
  }
});

// ─── TEST 4: Negative credits (debt) & spending blocks ──────────────────────────
test('4. Credits can go negative, sets telemetry.inDebt, and blocks tape-out/builds/upgrades', () => {
  const cache = new ChipMetricsCache();
  let state = createInitialState();
  // Create a clear operating deficit by assigning huge staff and low starting credits
  state = recomputeTelemetry(
    {
      ...state,
      credits: 10,
      staff: { research: 80, architecture: 80, fabrication: 80, qa: 80 },
    },
    cache
  );
  assert.ok(state.telemetry.monthlyCreditNet < 0, 'Expected negative monthly credit net');

  const stepped = advanceSimulationDays(state, 10, cache).state;
  assert.ok(stepped.credits < 0, `Expected credits < 0, got ${stepped.credits}`);
  assert.equal(stepped.telemetry.inDebt, true, 'Expected telemetry.inDebt === true');

  const tapeRes = startChipTapeOut(stepped, stepped.cpuDraft, cache);
  assert.ok(tapeRes.error, 'Tape-out should be blocked while in debt');
  assert.equal(tapeRes.state.tapeOutQueue.length, 0);

  const buildRes = queueFacilityBuild(stepped, 'fab');
  assert.ok(buildRes.error, 'Facility build should be blocked while in debt');
  assert.equal(buildRes.state.constructionQueue.length, 0);

  const upgRes = queueFacilityUpgrade(stepped, stepped.facilities[0].id);
  assert.ok(upgRes.error, 'Facility upgrade should be blocked while in debt');
  assert.equal(upgRes.state.constructionQueue.length, 0);
});

// ─── TEST 5: Deterministic simulation (no Math.random) ──────────────────────────
test('5. Two runs of advanceSimulationDays including facility construction are byte-identical', () => {
  const base = createInitialState();
  const queued = queueFacilityBuild(
    { ...base, credits: 50000, unlockedTechIds: ['fab_3000nm', 'fab_1000nm'] },
    'fab'
  );
  assert.ok(!queued.error, 'Expected fab build to queue cleanly');

  const runA = advanceSimulationDays(queued.state, 150, new ChipMetricsCache()).state;
  const runB = advanceSimulationDays(queued.state, 150, new ChipMetricsCache()).state;

  assert.equal(JSON.stringify(runA), JSON.stringify(runB), 'Simulation runs diverged');

  // Also verify new fab used best unlocked process node and blueprint values
  const newFab = runA.facilities.find((f) => f.kind === 'fab' && f.id !== 'fab_1');
  assert.ok(newFab, 'Expected new fab to complete construction');
  assert.equal(
    newFab.assignedNodeId,
    getBestUnlockedProcessNode(runA.unlockedTechIds).id,
    'New fab should be assigned to best unlocked process node'
  );
  assert.equal(newFab.waferCapacityPerMonth, FACILITY_BLUEPRINTS.fab.baseWaferCapacityPerMonth);

  // Also verify idle RP banking is 100% (no active research)
  const idleBase = createInitialState();
  const after10 = advanceSimulationDays(idleBase, 10, new ChipMetricsCache()).state;
  const expectedRp = idleBase.telemetry.rpPerDay * 10;
  assert.ok(
    Math.abs(after10.researchPointsBank - expectedRp) < 0.01,
    `Expected 100% idle RP banking (${expectedRp}), got ${after10.researchPointsBank}`
  );
});

// ─── TEST 6: Every default & starter draft lies inside slider bounds & step ─────
test('6. Starter CPU draft, starter GPU draft, and starter chip lie within slider [min, max] and step', () => {
  const initState = createInitialState();
  const starterCpus = [createStarterCpuDraft(), initState.chips[0]];

  for (const cpu of starterCpus) {
    assert.equal(cpu.kind, 'cpu');
    const b = getCpuSliderBounds(cpu);
    assertInSliderRange(`${cpu.id}.pCores`, cpu.pCores, b.pCores);
    assertInSliderRange(`${cpu.id}.eCores`, cpu.eCores, b.eCores);
    assertInSliderRange(`${cpu.id}.pClockGHz`, cpu.pClockGHz, b.pClockGHz);
    assertInSliderRange(`${cpu.id}.eClockGHz`, cpu.eClockGHz, b.eClockGHz);
    assertInSliderRange(`${cpu.id}.voltageV`, cpu.voltageV, b.voltageV);
    assertInSliderRange(`${cpu.id}.ipcTuning`, cpu.ipcTuning, b.ipcTuning);
    assertInSliderRange(`${cpu.id}.l1CacheKBPerCore`, cpu.l1CacheKBPerCore, b.l1CacheKBPerCore);
    assertInSliderRange(`${cpu.id}.l2CacheMBTotal`, cpu.l2CacheMBTotal, b.l2CacheMBTotal);
    assertInSliderRange(`${cpu.id}.l3CacheMBTotal`, cpu.l3CacheMBTotal, b.l3CacheMBTotal);
    assertInSliderRange(`${cpu.id}.memoryChannels`, cpu.memoryChannels, b.memoryChannels);
    assertInSliderRange(`${cpu.id}.pcieLanes`, cpu.pcieLanes, b.pcieLanes);
    assertInSliderRange(`${cpu.id}.powerLimitW`, cpu.powerLimitW, b.powerLimitW);
    assertInSliderRange(`${cpu.id}.igpuTier`, cpu.igpuTier, b.igpuTier);
    assertInSliderRange(`${cpu.id}.npuTier`, cpu.npuTier, b.npuTier);
  }

  const gpu = createStarterGpuDraft();
  const gb = getGpuSliderBounds(gpu);
  assertInSliderRange('gpuDraft.shaderCores', gpu.shaderCores, gb.shaderCores);
  assertInSliderRange('gpuDraft.clockGHz', gpu.clockGHz, gb.clockGHz);
  assertInSliderRange('gpuDraft.rops', gpu.rops, gb.rops);
  assertInSliderRange('gpuDraft.tmus', gpu.tmus, gb.tmus);
  assertInSliderRange('gpuDraft.voltageV', gpu.voltageV, gb.voltageV);
  assertInSliderRange('gpuDraft.vramCapacityGB', gpu.vramCapacityGB, gb.vramCapacityGB);
  assertInSliderRange('gpuDraft.l1CacheMB', gpu.l1CacheMB, gb.l1CacheMB);
  assertInSliderRange('gpuDraft.l2CacheMB', gpu.l2CacheMB, gb.l2CacheMB);
  assertInSliderRange('gpuDraft.powerLimitW', gpu.powerLimitW, gb.powerLimitW);

  // Also verify starter CPU and GPU drafts are voltage-stable out of the box
  const ctx = buildPreviewPhysicsContext(initState, 'node_10000nm', 1.0);
  assert.equal(evaluateCpuPhysics(createStarterCpuDraft(), ctx).physics.voltageUnstable, false);
  assert.equal(evaluateGpuPhysics(createStarterGpuDraft(), ctx).physics.voltageUnstable, false);
});

// ─── TEST 7: Switching VRAM tech from HBM to GDDR clamps bus width & capacity ───
test('7. Switching VRAM from HBM (4096-bit, 128GB) to GDDR5 clamps bus <= 512 and capacity <= 16GB', () => {
  const hbmGpu = {
    ...createStarterGpuDraft(),
    vramTechId: 'vram_hbm',
    memoryBusWidthBits: 4096,
    vramCapacityGB: 128,
  };
  const gddrGpu = applyGpuVramChange(hbmGpu, 'vram_gddr5');
  assert.ok(gddrGpu.memoryBusWidthBits <= 512, `Expected bus <= 512, got ${gddrGpu.memoryBusWidthBits}`);
  const bounds = getGpuSliderBounds(gddrGpu);
  assertInSliderRange('gddrGpu.vramCapacityGB', gddrGpu.vramCapacityGB, bounds.vramCapacityGB);
  assert.ok(gddrGpu.vramCapacityGB <= 16, `Expected GDDR5 capacity <= 16GB, got ${gddrGpu.vramCapacityGB}`);
});

// ─── TEST 8: Switching to an older node clamps CPU L2/L3 and GPU L1/L2 ─────────
test('8. Switching to an older process node clamps CPU L2/L3 and GPU L1/L2 into new node bounds', () => {
  const modernCpu = {
    ...createStarterCpuDraft(),
    processNodeId: 'node_5nm',
    l2CacheMBTotal: 64,
    l3CacheMBTotal: 256,
  };
  const oldCpu = applyCpuNodeChange(modernCpu, 'node_10000nm');
  const cpuBounds = getCpuSliderBounds(oldCpu);
  assertInSliderRange('oldCpu.l2CacheMBTotal', oldCpu.l2CacheMBTotal, cpuBounds.l2CacheMBTotal);
  assertInSliderRange('oldCpu.l3CacheMBTotal', oldCpu.l3CacheMBTotal, cpuBounds.l3CacheMBTotal);
  assert.ok(oldCpu.l2CacheMBTotal <= 0.256);
  assert.ok(oldCpu.l3CacheMBTotal <= 1);

  const modernGpu = {
    ...createStarterGpuDraft(),
    processNodeId: 'node_5nm',
    l1CacheMB: 16,
    l2CacheMB: 96,
  };
  const oldGpu = applyGpuNodeChange(modernGpu, 'node_10000nm');
  const gpuBounds = getGpuSliderBounds(oldGpu);
  assertInSliderRange('oldGpu.l1CacheMB', oldGpu.l1CacheMB, gpuBounds.l1CacheMB);
  assertInSliderRange('oldGpu.l2CacheMB', oldGpu.l2CacheMB, gpuBounds.l2CacheMB);
  assert.ok(oldGpu.l1CacheMB <= 0.5);
  assert.ok(oldGpu.l2CacheMB <= 2);
});

// ─── TEST 9: GPU L1 cache & CPU PCIe lanes affect benchmarks ───────────────────
test('9. GPU benchmark changes when only l1CacheMB changes; CPU benchmark changes when only pcieLanes changes', () => {
  const gpuA = {
    ...createStarterGpuDraft(),
    processNodeId: 'node_14nm',
    architectureId: 'gpu_unified',
    transistorStructureId: 'trans_finfet',
    packagingId: 'pkg_lga',
    coolingId: 'cool_liquid',
    shaderCores: 2048,
    rops: 64,
    tmus: 128,
    clockGHz: 1.5,
    voltageV: 1.0,
    vramTechId: 'vram_gddr5',
    memoryBusWidthBits: 256,
    vramCapacityGB: 8,
    l1CacheMB: 0.5,
    l2CacheMB: 4,
    powerLimitW: 400,
  };
  const gpuB = { ...gpuA, l1CacheMB: 16 };
  const evalGpuA = evaluateGpuPhysics(gpuA, BASE_CTX);
  const evalGpuB = evaluateGpuPhysics(gpuB, BASE_CTX);
  assert.ok(
    evalGpuB.benchmarks.memoryPerformance > evalGpuA.benchmarks.memoryPerformance,
    `Expected GPU memoryPerformance to increase with L1 cache (${evalGpuA.benchmarks.memoryPerformance} -> ${evalGpuB.benchmarks.memoryPerformance})`
  );
  assert.ok(
    evalGpuB.benchmarks.overallRating > evalGpuA.benchmarks.overallRating,
    `Expected GPU overallRating to increase with L1 cache (${evalGpuA.benchmarks.overallRating} -> ${evalGpuB.benchmarks.overallRating})`
  );

  const cpuA = {
    ...createStarterCpuDraft(),
    processNodeId: 'node_14nm',
    architectureId: 'cpu_ooo',
    transistorStructureId: 'trans_finfet',
    packagingId: 'pkg_lga',
    coolingId: 'cool_liquid',
    pCores: 8,
    eCores: 4,
    pClockGHz: 3.6,
    eClockGHz: 2.6,
    voltageV: 1.05,
    l1CacheKBPerCore: 64,
    l2CacheMBTotal: 8,
    l3CacheMBTotal: 32,
    memoryTechId: 'ram_ddr5',
    memoryChannels: 4,
    pcieLanes: 4,
    powerLimitW: 300,
  };
  const cpuB = { ...cpuA, pcieLanes: 64 };
  const evalCpuA = evaluateCpuPhysics(cpuA, BASE_CTX);
  const evalCpuB = evaluateCpuPhysics(cpuB, BASE_CTX);
  assert.ok((evalCpuB.physics.pcieBandwidthGBs ?? 0) > (evalCpuA.physics.pcieBandwidthGBs ?? 0));
  assert.ok(
    evalCpuB.benchmarks.generalComputing > evalCpuA.benchmarks.generalComputing,
    `Expected CPU generalComputing to increase with PCIe lanes (${evalCpuA.benchmarks.generalComputing} -> ${evalCpuB.benchmarks.generalComputing})`
  );
  assert.ok(
    evalCpuB.benchmarks.gamingRendering > evalCpuA.benchmarks.gamingRendering,
    `Expected CPU gamingRendering to increase with PCIe lanes (${evalCpuA.benchmarks.gamingRendering} -> ${evalCpuB.benchmarks.gamingRendering})`
  );
});

// ─── BONUS: Preview yield equals production yield for best fab ──────────────────
test('10. Architect preview yield matches production line yield on best fab (with QA staff)', () => {
  const cache = new ChipMetricsCache();
  let state = createInitialState();
  state = {
    ...state,
    staff: { ...state.staff, qa: 24 }, // triggers +2 QA staff level bonus
    facilities: state.facilities.map((f) =>
      f.id === 'fab_1' ? { ...f, cleanroomGrade: 3 } : f
    ),
  };
  state = recomputeTelemetry(state, cache);

  const prodLine = state.productionLines.find((l) => l.fabId === 'fab_1')!;
  const chip = state.chips.find((c) => c.id === prodLine.chipId)!;
  const previewCtx = buildPreviewPhysicsContext(state, chip.processNodeId, prodLine.qaStrictness);
  const previewEval = evaluateCpuPhysics(chip as typeof state.cpuDraft, previewCtx);

  assert.equal(
    Number(previewEval.physics.yieldPercent.toFixed(4)),
    Number(prodLine.yieldPercent.toFixed(4)),
    `Preview yield (${previewEval.physics.yieldPercent}) != production yield (${prodLine.yieldPercent})`
  );
});

// ─── TEST 11: Every (node, cellArch, interface, trans) memory combo is stable at max rate + max voltage ──
test('11. Every (node, cellArch, interface, trans) memory combination is voltage-stable at max rate + max voltage', () => {
  const memBase = createStarterMemoryDraft();
  let checked = 0;

  for (const node of PROCESS_NODES) {
    for (const trans of TRANSISTOR_STRUCTURES) {
      for (const cellArch of MEMORY_CELL_ARCHS) {
        const compatibleIfaces = MEMORY_INTERFACES.filter(
          (i) => i.category === cellArch.category
        );
        for (const iface of compatibleIfaces) {
          const bitsPerCell = cellArch.maxBitsPerCell;
          const maxRate = getMaxMemoryDataRateMTs(node.id, cellArch.id, iface.id, trans.id);
          const maxVolt = getMaxMemoryVoltageForConfig(
            node.id,
            cellArch.id,
            iface.id,
            trans.id,
            bitsPerCell
          );
          const res = evaluateMemoryPhysics(
            {
              ...memBase,
              memoryCategory: cellArch.category,
              processNodeId: node.id,
              cellArchId: cellArch.id,
              interfaceId: iface.id,
              transistorStructureId: trans.id,
              bitsPerCell,
              stackLayers: 1,
              busWidthBits: iface.busWidths[0],
              dataRateMTs: maxRate,
              voltageV: maxVolt,
            },
            BASE_CTX
          );
          assert.equal(
            res.physics.voltageUnstable,
            false,
            `Memory unstable at max rate (${maxRate} MT/s) & max voltage (${maxVolt} V, Vmin=${res.physics.minStableVoltageV} V) for ${node.id}/${cellArch.id}/${iface.id}/${trans.id}`
          );
          checked += 1;
        }
      }
    }
  }
  assert.ok(checked > 0, 'Expected at least one memory combination checked');
});

// ─── TEST 12: Auto-Stabilize Voltage helper works for CPU, GPU, and Memory at max clock/rate ──
test('12. getStabilizedVoltageV produces slider-aligned, voltage-stable voltages for CPU, GPU, and Memory', () => {
  // CPU at max clock
  const cpuDraft = createStarterCpuDraft();
  const cpuBounds = getCpuSliderBounds(cpuDraft);
  const cpuMaxClock = { ...cpuDraft, pClockGHz: cpuBounds.pClockGHz.max, voltageV: cpuBounds.voltageV.min };
  const cpuUnstable = evaluateCpuPhysics(cpuMaxClock, BASE_CTX);
  const cpuStabV = getStabilizedVoltageV(cpuUnstable.physics.minStableVoltageV, cpuBounds.voltageV);
  assertInSliderRange('cpu.stabilizedV', cpuStabV, cpuBounds.voltageV);
  const cpuStable = evaluateCpuPhysics({ ...cpuMaxClock, voltageV: cpuStabV }, BASE_CTX);
  assert.equal(cpuStable.physics.voltageUnstable, false, 'CPU should be stable after getStabilizedVoltageV');

  // GPU at max clock
  const gpuDraft = createStarterGpuDraft();
  const gpuBounds = getGpuSliderBounds(gpuDraft);
  const gpuMaxClock = { ...gpuDraft, clockGHz: gpuBounds.clockGHz.max, voltageV: gpuBounds.voltageV.min };
  const gpuUnstable = evaluateGpuPhysics(gpuMaxClock, BASE_CTX);
  const gpuStabV = getStabilizedVoltageV(gpuUnstable.physics.minStableVoltageV, gpuBounds.voltageV);
  assertInSliderRange('gpu.stabilizedV', gpuStabV, gpuBounds.voltageV);
  const gpuStable = evaluateGpuPhysics({ ...gpuMaxClock, voltageV: gpuStabV }, BASE_CTX);
  assert.equal(gpuStable.physics.voltageUnstable, false, 'GPU should be stable after getStabilizedVoltageV');

  // Memory at max data rate
  const memDraft = createStarterMemoryDraft();
  const memBounds = getMemorySliderBounds(memDraft);
  const memMaxRate = { ...memDraft, dataRateMTs: memBounds.dataRateMTs.max, voltageV: memBounds.voltageV.min };
  const memUnstable = evaluateMemoryPhysics(memMaxRate, BASE_CTX);
  const memStabV = getStabilizedVoltageV(memUnstable.physics.minStableVoltageV, memBounds.voltageV);
  assertInSliderRange('mem.stabilizedV', memStabV, memBounds.voltageV);
  const memStable = evaluateMemoryPhysics({ ...memMaxRate, voltageV: memStabV }, BASE_CTX);
  assert.equal(memStable.physics.voltageUnstable, false, 'Memory should be stable after getStabilizedVoltageV');
});

// ─── TEST 13: Starter Memory draft lies inside slider bounds & is voltage-stable ──
test('13. Starter Memory draft lies inside all getMemorySliderBounds ranges & steps and is voltage-stable', () => {
  const initState = createInitialState();
  const mem = createStarterMemoryDraft();
  const mb = getMemorySliderBounds(mem);

  assertInSliderRange('memoryDraft.capacityGB', mem.capacityGB, mb.capacityGB);
  assertInSliderRange('memoryDraft.dataRateMTs', mem.dataRateMTs, mb.dataRateMTs);
  assertInSliderRange('memoryDraft.voltageV', mem.voltageV, mb.voltageV);
  assertInSliderRange('memoryDraft.powerLimitW', mem.powerLimitW, mb.powerLimitW);
  assert.ok(mb.busWidthOptions.includes(mem.busWidthBits), 'Starter busWidthBits should be allowed');
  assert.ok(mb.stackLayersOptions.includes(mem.stackLayers), 'Starter stackLayers should be allowed');

  const ctx = buildPreviewPhysicsContext(initState, mem.processNodeId, 1.0);
  const ev = evaluateMemoryPhysics(mem, ctx);
  assert.equal(ev.physics.voltageUnstable, false, 'Starter memory draft must be voltage-stable');
});

// ─── TEST 14: Coupled Memory engineering trade-offs (bitsPerCell, ECC, 3D stackLayers) ──
test('14. Memory trade-offs: bitsPerCell, eccLevel, and 3D stackLayers show physical coupling', () => {
  const nandBase: MemoryBlueprint = {
    ...createStarterMemoryDraft(),
    id: 'test_nand',
    name: 'Test 3D NAND',
    memoryCategory: 'rom_nand',
    processNodeId: 'node_14nm',
    transistorStructureId: 'trans_finfet',
    cellArchId: 'mem_3d_vnand',
    interfaceId: 'iface_pcie_nvme_ctrl',
    packagingId: 'pkg_flipchip',
    coolingId: 'cool_heatpipe',
    capacityGB: 32,
    stackLayers: 64,
    bitsPerCell: 1,
    bankCount: 16,
    busWidthBits: 64,
    dataRateMTs: 1600,
    voltageV: 1.05,
    eccLevel: 1,
    powerLimitW: 25,
  };

  // (a) Raising bitsPerCell (SLC 1 -> QLC 4) shrinks die area & increases density,
  //     but slashes enduranceCycles and increases accessLatencyNs.
  const slc = evaluateMemoryPhysics({ ...nandBase, bitsPerCell: 1 }, BASE_CTX);
  const qlc = evaluateMemoryPhysics({ ...nandBase, bitsPerCell: 4 }, BASE_CTX);
  assert.ok(
    qlc.physics.dieAreaMm2 < slc.physics.dieAreaMm2,
    `Expected QLC dieArea (${qlc.physics.dieAreaMm2}) < SLC dieArea (${slc.physics.dieAreaMm2})`
  );
  assert.ok(
    (qlc.physics.densityGbitPerMm2 ?? 0) > (slc.physics.densityGbitPerMm2 ?? 0),
    'Expected QLC areal density > SLC areal density'
  );
  assert.ok(
    (qlc.physics.enduranceCycles ?? 0) < (slc.physics.enduranceCycles ?? 0),
    `Expected QLC enduranceCycles (${qlc.physics.enduranceCycles}) < SLC (${slc.physics.enduranceCycles})`
  );
  assert.ok(
    (qlc.physics.accessLatencyNs ?? 0) > (slc.physics.accessLatencyNs ?? 0),
    `Expected QLC latency (${qlc.physics.accessLatencyNs}) > SLC (${slc.physics.accessLatencyNs})`
  );

  // (b) Raising ECC (0 -> 3) improves yieldPercent and enduranceCycles at an area cost
  const ecc0 = evaluateMemoryPhysics({ ...nandBase, bitsPerCell: 3, eccLevel: 0 }, BASE_CTX);
  const ecc3 = evaluateMemoryPhysics({ ...nandBase, bitsPerCell: 3, eccLevel: 3 }, BASE_CTX);
  assert.ok(
    ecc3.physics.dieAreaMm2 > ecc0.physics.dieAreaMm2,
    `Expected ECC-3 dieArea (${ecc3.physics.dieAreaMm2}) > ECC-0 (${ecc0.physics.dieAreaMm2})`
  );
  assert.ok(
    ecc3.physics.yieldPercent > ecc0.physics.yieldPercent,
    `Expected ECC-3 yield (${ecc3.physics.yieldPercent}%) > ECC-0 (${ecc0.physics.yieldPercent}%)`
  );
  assert.ok(
    (ecc3.physics.enduranceCycles ?? 0) > (ecc0.physics.enduranceCycles ?? 0),
    'Expected ECC-3 enduranceCycles > ECC-0'
  );

  // (c) Raising 3D stackLayers (16 -> 128) shrinks die footprint & raises density,
  //     while raising junction temperature due to TSV thermal resistance (higher flux + Rth)
  const l16 = evaluateMemoryPhysics({ ...nandBase, stackLayers: 16, capacityGB: 32 }, BASE_CTX);
  const l128 = evaluateMemoryPhysics({ ...nandBase, stackLayers: 128, capacityGB: 32 }, BASE_CTX);
  assert.ok(
    l128.physics.dieAreaMm2 < l16.physics.dieAreaMm2,
    `Expected 128L dieArea (${l128.physics.dieAreaMm2}) < 16L (${l16.physics.dieAreaMm2})`
  );
  assert.ok(
    (l128.physics.densityGbitPerMm2 ?? 0) > (l16.physics.densityGbitPerMm2 ?? 0),
    'Expected 128L areal density > 16L'
  );
  assert.ok(
    l128.physics.junctionTempC > l16.physics.junctionTempC,
    `Expected 128L Tj (${l128.physics.junctionTempC}°C) > 16L Tj (${l16.physics.junctionTempC}°C) due to TSV thermal stack`
  );
});

// ─── TEST 15: Full-stack ecosystem synergy (CPU + GPU + RAM + Storage = 1.68x) & determinism ──
test('15. Full-stack CPU + GPU + RAM + Storage production yields 1.68x synergy, TB/mo output, and deterministic runs', () => {
  const base = createInitialState();
  const cpuChip = base.chips[0];
  const gpuChip = {
    ...createStarterGpuDraft(),
    id: 'prod_gpu_1',
    status: 'production' as const,
    processNodeId: 'node_350nm',
    clockGHz: 0.35,
    voltageV: 2.5,
  };
  const dramChip: MemoryBlueprint = {
    ...createStarterMemoryDraft(),
    id: 'prod_dram_1',
    name: 'MR-16 System RAM',
    status: 'production',
    memoryCategory: 'dram',
    capacityGB: 0.002,
    stackLayers: 1,
  };
  const nandChip: MemoryBlueprint = {
    ...createStarterMemoryDraft(),
    id: 'prod_nand_1',
    name: 'Flash-8 Planar SSD',
    status: 'production',
    memoryCategory: 'rom_nand',
    cellArchId: 'mem_planar_nand',
    interfaceId: 'iface_onfi_nvme',
    capacityGB: 0.004,
    stackLayers: 1,
    busWidthBits: 16,
    dataRateMTs: 38,
    voltageV: 5.0,
  };

  const extraFabs = ['fab_2', 'fab_3', 'fab_4'].map((id, i) => ({
    id,
    kind: 'fab' as const,
    name: `Expansion Fab ${i + 2}`,
    level: 2,
    monthlyUpkeepCR: 180,
    powerDrawMW: 12,
    waferCapacityPerMonth: 200,
    cleanroomGrade: 2,
    assignedNodeId: 'node_350nm',
  }));

  const fullStackState: GameState = {
    ...base,
    unlockedTechIds: [
      ...base.unlockedTechIds,
      'fab_3000nm',
      'fab_1000nm',
      'fab_350nm',
      'gpu_fixed_pipeline',
      'mem_nand_planar',
    ],
    silicon: 500000,
    facilities: [
      ...base.facilities.map((f) =>
        f.kind === 'power_plant'
          ? { ...f, powerOutputMW: 500 }
          : f.kind === 'packaging_plant'
            ? { ...f, packagingCapacityPerMonth: 500000 }
            : f.kind === 'silicon_refinery'
              ? { ...f, siliconPerMonth: 500000 }
              : f
      ),
      ...extraFabs,
    ],
    chips: [cpuChip, gpuChip, dramChip, nandChip],
    productionLines: [
      { ...base.productionLines[0], chipId: cpuChip.id, targetWaferStartsPerMonth: 40 },
      {
        id: 'line_2',
        fabId: 'fab_2',
        chipId: gpuChip.id,
        targetWaferStartsPerMonth: 40,
        actualWaferStartsPerMonth: 0,
        qaStrictness: 1.0,
        yieldPercent: 0,
        goodDiesPerMonth: 0,
        siliconConsumedPerMonth: 0,
        powerDrawMW: 0,
        statusNote: 'Nominal',
      },
      {
        id: 'line_3',
        fabId: 'fab_3',
        chipId: dramChip.id,
        targetWaferStartsPerMonth: 40,
        actualWaferStartsPerMonth: 0,
        qaStrictness: 1.0,
        yieldPercent: 0,
        goodDiesPerMonth: 0,
        siliconConsumedPerMonth: 0,
        powerDrawMW: 0,
        statusNote: 'Nominal',
      },
      {
        id: 'line_4',
        fabId: 'fab_4',
        chipId: nandChip.id,
        targetWaferStartsPerMonth: 40,
        actualWaferStartsPerMonth: 0,
        qaStrictness: 1.0,
        yieldPercent: 0,
        goodDiesPerMonth: 0,
        siliconConsumedPerMonth: 0,
        powerDrawMW: 0,
        statusNote: 'Nominal',
      },
    ],
  };

  const computed = recomputeTelemetry(fullStackState, new ChipMetricsCache());
  assert.equal(computed.telemetry.hasActiveCpu, true);
  assert.equal(computed.telemetry.hasActiveGpu, true);
  assert.equal(computed.telemetry.hasActiveMemory, true);
  assert.equal(computed.telemetry.hasActiveStorage, true);
  assert.equal(
    Number(computed.telemetry.activeChipEcosystemBonus.toFixed(2)),
    1.68,
    `Expected full-stack synergy 1.68x, got ${computed.telemetry.activeChipEcosystemBonus}`
  );
  assert.ok(
    (computed.telemetry.monthlyMemoryCapacityTB ?? 0) > 0,
    `Expected monthlyMemoryCapacityTB > 0, got ${computed.telemetry.monthlyMemoryCapacityTB}`
  );

  const runA = advanceSimulationDays(computed, 45, new ChipMetricsCache()).state;
  const runB = advanceSimulationDays(computed, 45, new ChipMetricsCache()).state;
  assert.equal(JSON.stringify(runA), JSON.stringify(runB), 'Full-stack memory simulation must be deterministic');
});

// ─── TEST 16: Legacy save migration cleanly hydrates memoryDraft & researchBudgets.memory ──
test('16. migrateGameState upgrades legacy saves missing memoryDraft, researchBudgets.memory, and new telemetry fields', () => {
  const fresh = createInitialState();
  const legacyRaw = JSON.parse(JSON.stringify(fresh)) as Record<string, unknown>;
  delete legacyRaw.memoryDraft;
  const budgets = legacyRaw.researchBudgets as Record<string, unknown>;
  delete budgets.memory;
  const telem = legacyRaw.telemetry as Record<string, unknown>;
  delete telem.hasActiveMemory;
  delete telem.hasActiveStorage;
  delete telem.monthlyMemoryCapacityTB;
  delete telem.monthlyMemoryDiesByCategory;

  const migrated = recomputeTelemetry(
    migrateGameState(legacyRaw as unknown as GameState),
    new ChipMetricsCache()
  );

  assert.equal(migrated.memoryDraft.kind, 'memory');
  assert.ok(migrated.researchBudgets.memory > 0, 'Expected default memory research budget');
  assert.equal(typeof migrated.telemetry.hasActiveMemory, 'boolean');
  assert.equal(typeof migrated.telemetry.monthlyMemoryCapacityTB, 'number');
  assert.ok(migrated.telemetry.monthlyMemoryDiesByCategory !== undefined);
});

// ─── TEST 17: 520+ Node Tech Tree DAG, Coordinate, and Mechanical-Effect Integrity ──
test('17. Expanded Tech Tree has >= 520 unique nodes across 7 lanes with valid DAG, 0 overlaps, and 0 empty filler nodes', () => {
  assert.ok(
    TECH_TREE.length >= 520,
    `Expected >= 520 tech nodes, got ${TECH_TREE.length}`
  );
  assert.equal(TECH_LANES.length, 7, 'Expected exactly 7 engineering lanes');

  const ids = new Set<string>();
  const names = new Set<string>();
  const laneCounts = new Map<string, number>();

  for (const node of TECH_TREE) {
    assert.ok(!ids.has(node.id), `Duplicate tech node id: ${node.id}`);
    assert.ok(!names.has(node.name), `Duplicate tech node name: ${node.name}`);
    ids.add(node.id);
    names.add(node.name);
    laneCounts.set(node.lane, (laneCounts.get(node.lane) ?? 0) + 1);
    assert.ok(node.tier >= 1 && node.tier <= 26, `Invalid tier ${node.tier} on ${node.id}`);
    assert.ok(node.rpCost > 0, `Invalid rpCost on ${node.id}`);
  }

  for (const lane of TECH_LANES) {
    const count = laneCounts.get(lane.id) ?? 0;
    assert.ok(count >= 60, `Expected >= 60 nodes in lane ${lane.id}, got ${count}`);
  }

  // Every prerequisite must exist and DAG must have 0 cycles (Kahn topological sort)
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const node of TECH_TREE) {
    inDegree.set(node.id, node.prerequisites.length);
    for (const preId of node.prerequisites) {
      assert.ok(ids.has(preId), `Missing prerequisite ${preId} referenced by ${node.id}`);
      const list = adj.get(preId) ?? [];
      list.push(node.id);
      adj.set(preId, list);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }
  let visited = 0;
  while (queue.length > 0) {
    const u = queue.shift()!;
    visited += 1;
    for (const v of adj.get(u) ?? []) {
      const nextDeg = (inDegree.get(v) ?? 1) - 1;
      inDegree.set(v, nextDeg);
      if (nextDeg === 0) queue.push(v);
    }
  }
  assert.equal(
    visited,
    TECH_TREE.length,
    `Detected cycle in Tech Tree DAG (${TECH_TREE.length - visited} nodes unreachable)`
  );

  // Zero overlapping (x, y) node bounding boxes
  for (let i = 0; i < TECH_TREE.length; i++) {
    const a = TECH_TREE[i];
    for (let j = i + 1; j < TECH_TREE.length; j++) {
      const b = TECH_TREE[j];
      const overlaps =
        Math.abs(a.x - b.x) < TECH_NODE_W && Math.abs(a.y - b.y) < TECH_NODE_H;
      assert.ok(
        !overlaps,
        `Overlapping tech nodes: ${a.id} (${a.x},${a.y}) and ${b.id} (${b.x},${b.y})`
      );
    }
  }

  // Every catalog requiredTechId must exist in TECH_TREE, and every node must unlock hardware or have effects
  const catalogUnlockIds = new Set<string>();
  const catalogGroups = [
    PROCESS_NODES,
    LITHOGRAPHY_SPECS,
    TRANSISTOR_STRUCTURES,
    PACKAGING_SPECS,
    COOLING_SPECS,
    CPU_ARCHITECTURES,
    GPU_ARCHITECTURES,
    MEMORY_TECHS,
    MEMORY_CELL_ARCHS,
    MEMORY_INTERFACES,
    ISA_EXTENSIONS,
  ];
  for (const group of catalogGroups) {
    for (const item of group as Array<{ requiredTechId?: string }>) {
      if (item.requiredTechId) {
        assert.ok(
          ids.has(item.requiredTechId),
          `Catalog requiredTechId missing from TECH_TREE: ${item.requiredTechId}`
        );
        catalogUnlockIds.add(item.requiredTechId);
      }
    }
  }

  for (const node of TECH_TREE) {
    const hasEffect = Boolean(node.effects && Object.keys(node.effects).length > 0);
    const unlocksCatalog = catalogUnlockIds.has(node.id);
    assert.ok(
      hasEffect || unlocksCatalog,
      `Tech node ${node.id} has neither catalog unlock nor mechanical effects`
    );
  }
});

// ─── TEST 18: Cumulative Tech Modifiers cleanly improve Physics & Simulation without breaking invariants ──
test('18. Cumulative TechModifiers improve CPU/GPU/Memory physics & simulation cleanly up to 100% completion', () => {
  const allTechIds = TECH_TREE.map((t) => t.id);
  const fullMods = getAggregatedTechModifiers(allTechIds);
  assert.equal(fullMods.maxParallelResearch, 8, 'Expected 8 max parallel research slots at full tree');
  assert.equal(fullMods.maxPcieGen, 10, 'Expected PCIe Gen 10 at full tree');
  assert.equal(fullMods.waferDiameterMm, 600, 'Expected 600 mm wafer diameter at full tree');
  assert.ok(fullMods.logicDensityMult > 1.5 && fullMods.logicDensityMult <= 3.5);
  assert.ok(fullMods.defectReductionMult >= 0.25 && fullMods.defectReductionMult < 0.8);

  const emptyCtx: PhysicsContext = { ...BASE_CTX, unlockedTechIds: [] };
  const fullCtx: PhysicsContext = { ...BASE_CTX, unlockedTechIds: allTechIds };

  const cpu = {
    ...createStarterCpuDraft(),
    processNodeId: 'node_14nm',
    architectureId: 'cpu_ooo',
    transistorStructureId: 'trans_finfet',
    packagingId: 'pkg_lga',
    coolingId: 'cool_liquid',
    pCores: 8,
    eCores: 4,
    pClockGHz: 3.6,
    eClockGHz: 2.6,
    voltageV: 1.05,
    l1CacheKBPerCore: 64,
    l2CacheMBTotal: 8,
    l3CacheMBTotal: 32,
    memoryTechId: 'ram_ddr5',
    memoryChannels: 4,
    pcieLanes: 16,
    powerLimitW: 250,
  };
  const cpuBase = evaluateCpuPhysics(cpu, emptyCtx);
  const cpuFull = evaluateCpuPhysics(cpu, fullCtx);
  assert.ok(cpuFull.physics.dieAreaMm2 < cpuBase.physics.dieAreaMm2, 'Full R&D should shrink CPU die area');
  assert.ok(cpuFull.physics.yieldPercent > cpuBase.physics.yieldPercent, 'Full R&D should improve CPU wafer yield');
  assert.ok(cpuFull.physics.effectiveIpc! > cpuBase.physics.effectiveIpc!, 'Full R&D should boost CPU IPC');
  assert.ok(cpuFull.benchmarks.overallRating > cpuBase.benchmarks.overallRating, 'Full R&D should boost CPU rating');
  assert.equal(cpuFull.physics.voltageUnstable, false, 'Full R&D must keep nominal CPU voltage-stable');
  assert.ok(Number.isFinite(cpuFull.physics.junctionTempC), 'CPU junction temp must remain finite');

  const gpu = {
    ...createStarterGpuDraft(),
    processNodeId: 'node_14nm',
    architectureId: 'gpu_unified',
    transistorStructureId: 'trans_finfet',
    packagingId: 'pkg_lga',
    coolingId: 'cool_liquid',
    shaderCores: 2048,
    rops: 64,
    tmus: 128,
    clockGHz: 1.5,
    voltageV: 1.0,
    vramTechId: 'vram_gddr5',
    memoryBusWidthBits: 256,
    vramCapacityGB: 8,
    l1CacheMB: 2,
    l2CacheMB: 16,
    powerLimitW: 350,
  };
  const gpuBase = evaluateGpuPhysics(gpu, emptyCtx);
  const gpuFull = evaluateGpuPhysics(gpu, fullCtx);
  assert.ok(gpuFull.physics.dieAreaMm2 < gpuBase.physics.dieAreaMm2, 'Full R&D should shrink GPU die area');
  assert.ok(gpuFull.benchmarks.gpuCompute > gpuBase.benchmarks.gpuCompute, 'Full R&D should boost GPU compute');
  assert.ok(gpuFull.physics.memoryBandwidthGBs > gpuBase.physics.memoryBandwidthGBs, 'Full R&D should boost GPU bandwidth');

  const mem = createStarterMemoryDraft();
  const memBase = evaluateMemoryPhysics(mem, emptyCtx);
  const memFull = evaluateMemoryPhysics(mem, fullCtx);
  assert.ok(memFull.physics.memoryBandwidthGBs > memBase.physics.memoryBandwidthGBs, 'Full R&D should boost memory bandwidth');
  assert.ok(memFull.physics.yieldPercent >= memBase.physics.yieldPercent, 'Full R&D should maintain/improve memory yield');

  // Simulation telemetry scaling with all 592 techs unlocked
  const baseState = createInitialState();
  const fullState = recomputeTelemetry(
    { ...baseState, unlockedTechIds: allTechIds, globalPhysicsRevision: baseState.globalPhysicsRevision + 1 },
    new ChipMetricsCache()
  );
  assert.ok(fullState.telemetry.rpPerDay > baseState.telemetry.rpPerDay * 2, 'Lab RP/day should scale strongly with R&D');
  assert.ok(fullState.telemetry.monthlySiliconProd > baseState.telemetry.monthlySiliconProd * 1.5, 'Silicon refining should scale with R&D');
  assert.ok(Number.isFinite(fullState.telemetry.monthlyCreditIncome) && fullState.telemetry.monthlyCreditIncome > 0);
});

console.log(`\nAll ${passed} audit verification tests passed.`);
