/**
 * Semiconductor Empire — Audit Fix Verification Suite.
 * Pure TypeScript test script (run with: npx tsx src/engine/audit.test.ts).
 */

import assert from 'node:assert/strict';
import {
  COOLING_SPECS,
  CPU_ARCHITECTURES,
  FACILITY_BLUEPRINTS,
  getBestUnlockedProcessNode,
  GPU_ARCHITECTURES,
  PROCESS_NODES,
  TRANSISTOR_STRUCTURES,
} from './catalog';
import {
  applyCpuNodeChange,
  applyGpuNodeChange,
  applyGpuVramChange,
  ChipMetricsCache,
  evaluateCpuPhysics,
  evaluateGpuPhysics,
  getCpuSliderBounds,
  getGpuSliderBounds,
  getMaxClockForArch,
  getMaxVoltageForConfig,
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
  queueFacilityBuild,
  queueFacilityUpgrade,
  recomputeTelemetry,
  startChipTapeOut,
} from './simulation';

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
      processNodeId: 'node_45nm',
      architectureId: 'cpu_ooo',
      transistorStructureId: 'trans_planar',
      packagingId: 'pkg_lga',
      coolingId: 'cool_passive',
      pCores: 16,
      pClockGHz: 3.2,
      voltageV: 1.5,
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

console.log(`\nAll ${passed} audit verification tests passed.`);
