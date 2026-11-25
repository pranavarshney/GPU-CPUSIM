/**
 * Deterministic Architect Studio Assistants, Role Presets & Smart Naming.
 * Pure TypeScript — zero React or DOM dependencies, zero Math.random().
 */

import {
  COOLING_SPECS,
  CPU_ARCHITECTURES,
  getCpuArch,
  getGpuArch,
  getMemoryCellArch,
  getMemoryInterface,
  getPackagingSpec,
  getProcessNode,
  GPU_ARCHITECTURES,
  MEMORY_CATEGORY_META,
  MEMORY_CELL_ARCHS,
  MEMORY_INTERFACES,
  MEMORY_TECHS,
  PACKAGING_SPECS,
  PROCESS_NODES,
  TRANSISTOR_STRUCTURES,
} from './catalog';
import {
  clampToSlider,
  evaluateCpuPhysics,
  evaluateGpuPhysics,
  evaluateMemoryPhysics,
  getCpuSliderBounds,
  getGpuSliderBounds,
  getMemorySliderBounds,
  getStabilizedVoltageV,
  GPU_BUS_WIDTHS,
} from './physics';
import { buildPreviewPhysicsContext } from './simulation';
import type {
  CpuBlueprint,
  GameState,
  GpuBlueprint,
  MemoryBlueprint,
} from './types';

export type ArchitectPresetId = 'low_power' | 'balanced' | 'high_yield' | 'flagship';

export interface ArchitectPresetMeta {
  id: ArchitectPresetId;
  label: string;
  description: string;
}

export const ARCHITECT_PRESETS: ArchitectPresetMeta[] = [
  { id: 'low_power', label: 'Low-Power / Mobile', description: 'Tight TDP, high Perf/W, cool thermals' },
  { id: 'balanced', label: 'Balanced Mainstream', description: 'Optimal yield, bandwidth & sustained clocks' },
  { id: 'high_yield', label: 'High-Yield Volume', description: 'Compact die area for maximum good dies/wafer' },
  { id: 'flagship', label: 'Flagship Max Compute', description: 'Pushes reticle, clocks & cooling to peak output' },
];

export type OptimizeActionId =
  | 'stabilize_voltage'
  | 'fit_reticle'
  | 'match_cooling'
  | 'balance_bandwidth';

export function bumpRevisionName(name: string): string {
  const trimmed = name.trim() || 'Silicon Design';
  const match = trimmed.match(/^(.*?)\s+Rev\s+(\d+)$/i);
  if (match) {
    return `${match[1]} Rev ${Number(match[2]) + 1}`;
  }
  return `${trimmed} Rev 2`;
}

export function generateSmartChipName(
  draft: CpuBlueprint | GpuBlueprint | MemoryBlueprint,
  existingCount: number
): string {
  const node = getProcessNode(draft.processNodeId);
  const nodeTag =
    node.featureSizeNm >= 1000
      ? `${Math.round(node.featureSizeNm / 1000)}u`
      : node.featureSizeNm >= 1
        ? `${Math.round(node.featureSizeNm)}nm`
        : `${Math.round(node.featureSizeNm * 10)}A`;
  const gen = existingCount + 1;

  if (draft.kind === 'cpu') {
    const cores = draft.pCores + draft.eCores;
    const tier =
      cores >= 32 ? 'XE' : cores >= 8 ? 'Pro' : draft.powerLimitW <= 35 ? 'LV' : 'Core';
    return `SE-${gen}00 ${tier} ${cores}C (${nodeTag})`;
  }
  if (draft.kind === 'gpu') {
    const tier =
      draft.shaderCores >= 2048 ? 'Titan' : draft.shaderCores >= 256 ? 'XT' : 'GT';
    return `GV-${gen}0 ${tier} ${draft.memoryBusWidthBits}b (${nodeTag})`;
  }
  const catShort = MEMORY_CATEGORY_META[draft.memoryCategory].shortLabel;
  const capLabel =
    draft.capacityGB >= 1024
      ? `${Math.round(draft.capacityGB / 1024)}TB`
      : draft.capacityGB >= 1
        ? `${Math.round(draft.capacityGB)}GB`
        : `${Math.round(draft.capacityGB * 1024)}MB`;
  return `SM-${gen} ${catShort} ${capLabel} ${draft.stackLayers}L (${nodeTag})`;
}

// ─── NEXT UNLOCKED TECH HINTS ───────────────────────────────────────────────

export interface NextUnlockHint {
  slotLabel: string;
  itemName: string;
  techId: string;
}

export function getNextUnlockHints(
  kind: 'cpu' | 'gpu' | 'memory',
  unlockedTechIds: string[],
  memoryCategory?: MemoryBlueprint['memoryCategory']
): NextUnlockHint[] {
  const unlocked = new Set(unlockedTechIds);
  const hints: NextUnlockHint[] = [];

  const nextNode = PROCESS_NODES.find((n) => n.requiredTechId && !unlocked.has(n.requiredTechId));
  if (nextNode?.requiredTechId) {
    hints.push({ slotLabel: 'Next Process Node', itemName: nextNode.name, techId: nextNode.requiredTechId });
  }

  const nextTrans = TRANSISTOR_STRUCTURES.find((t) => t.requiredTechId && !unlocked.has(t.requiredTechId));
  if (nextTrans?.requiredTechId) {
    hints.push({ slotLabel: 'Next Transistor', itemName: nextTrans.name, techId: nextTrans.requiredTechId });
  }

  const nextPkg = PACKAGING_SPECS.find((p) => p.requiredTechId && !unlocked.has(p.requiredTechId));
  if (nextPkg?.requiredTechId) {
    hints.push({ slotLabel: 'Next Packaging', itemName: nextPkg.name, techId: nextPkg.requiredTechId });
  }

  if (kind === 'cpu') {
    const nextArch = CPU_ARCHITECTURES.find((a) => a.requiredTechId && !unlocked.has(a.requiredTechId));
    if (nextArch?.requiredTechId) {
      hints.push({ slotLabel: 'Next CPU Arch', itemName: nextArch.name, techId: nextArch.requiredTechId });
    }
  } else if (kind === 'gpu') {
    const nextArch = GPU_ARCHITECTURES.find((a) => a.requiredTechId && !unlocked.has(a.requiredTechId));
    if (nextArch?.requiredTechId) {
      hints.push({ slotLabel: 'Next GPU Arch', itemName: nextArch.name, techId: nextArch.requiredTechId });
    }
  } else if (kind === 'memory' && memoryCategory) {
    const nextCell = MEMORY_CELL_ARCHS.find(
      (a) => a.category === memoryCategory && a.requiredTechId && !unlocked.has(a.requiredTechId)
    );
    if (nextCell?.requiredTechId) {
      hints.push({ slotLabel: 'Next Cell Arch', itemName: nextCell.name, techId: nextCell.requiredTechId });
    }
    const nextIface = MEMORY_INTERFACES.find(
      (i) => i.category === memoryCategory && i.requiredTechId && !unlocked.has(i.requiredTechId)
    );
    if (nextIface?.requiredTechId) {
      hints.push({ slotLabel: 'Next Interface', itemName: nextIface.name, techId: nextIface.requiredTechId });
    }
  }

  return hints.slice(0, 4);
}

// ─── BEST COOLING MATCHER ───────────────────────────────────────────────────

function pickBestCoolingForPower(
  unlockedTechIds: string[],
  targetPowerW: number
): string {
  const unlockedCooling = COOLING_SPECS.filter(
    (c) => !c.requiredTechId || unlockedTechIds.includes(c.requiredTechId)
  ).sort((a, b) => a.maxRecommendedTdpW - b.maxRecommendedTdpW);

  const sufficient = unlockedCooling.find((c) => c.maxRecommendedTdpW >= targetPowerW * 1.12);
  return (sufficient ?? unlockedCooling[unlockedCooling.length - 1])?.id ?? 'cool_passive';
}

// ─── CPU PRESETS & OPTIMIZERS ───────────────────────────────────────────────

export function applyCpuPreset(
  draft: CpuBlueprint,
  preset: ArchitectPresetId,
  state: GameState
): CpuBlueprint {
  const arch = getCpuArch(draft.architectureId);
  const bounds = getCpuSliderBounds(draft);
  const unlockedRam = MEMORY_TECHS.filter(
    (m) => m.kind === 'ram' && (!m.requiredTechId || state.unlockedTechIds.includes(m.requiredTechId))
  );
  const bestRam = unlockedRam[unlockedRam.length - 1] ?? unlockedRam[0];

  const clockSpan = bounds.pClockGHz.max - bounds.pClockGHz.min;
  let next: CpuBlueprint = { ...draft, memoryTechId: bestRam?.id ?? draft.memoryTechId };

  if (preset === 'low_power') {
    const pCores = Math.max(1, Math.min(arch.maxPCores, Math.ceil(arch.maxPCores * 0.25)));
    const eCores = arch.supportsECores ? Math.min(arch.maxECores, Math.ceil(arch.maxECores * 0.5)) : 0;
    const pClock = clampToSlider(bounds.pClockGHz.min + clockSpan * 0.42, bounds.pClockGHz);
    next = {
      ...next,
      pCores,
      eCores,
      pClockGHz: pClock,
      eClockGHz: clampToSlider(pClock * 0.72, bounds.eClockGHz),
      ipcTuning: clampToSlider(1.0, bounds.ipcTuning),
      memoryChannels: Math.max(1, Math.min(4, Math.ceil(pCores / 2))),
      powerLimitW: clampToSlider(bounds.powerLimitW.min + (bounds.powerLimitW.max - bounds.powerLimitW.min) * 0.18, bounds.powerLimitW),
    };
  } else if (preset === 'high_yield') {
    const pCores = Math.max(1, Math.min(arch.maxPCores, Math.ceil(arch.maxPCores * 0.2)));
    const pClock = clampToSlider(bounds.pClockGHz.min + clockSpan * 0.58, bounds.pClockGHz);
    next = {
      ...next,
      pCores,
      eCores: 0,
      pClockGHz: pClock,
      eClockGHz: clampToSlider(pClock * 0.75, bounds.eClockGHz),
      l1CacheKBPerCore: bounds.l1CacheKBPerCore.min,
      l2CacheMBTotal: clampToSlider(bounds.l2CacheMBTotal.max * 0.15, bounds.l2CacheMBTotal),
      l3CacheMBTotal: clampToSlider(bounds.l3CacheMBTotal.max * 0.1, bounds.l3CacheMBTotal),
      igpuTier: 0,
      npuTier: 0,
      memoryChannels: Math.max(1, Math.min(4, Math.ceil(pCores / 2))),
    };
  } else if (preset === 'flagship') {
    const pCores = Math.max(1, Math.round(arch.maxPCores * 0.85));
    const eCores = arch.supportsECores ? Math.round(arch.maxECores * 0.75) : 0;
    const pClock = clampToSlider(bounds.pClockGHz.min + clockSpan * 0.88, bounds.pClockGHz);
    next = {
      ...next,
      pCores,
      eCores,
      pClockGHz: pClock,
      eClockGHz: clampToSlider(pClock * 0.76, bounds.eClockGHz),
      ipcTuning: bounds.ipcTuning.max,
      l2CacheMBTotal: clampToSlider(bounds.l2CacheMBTotal.max * 0.65, bounds.l2CacheMBTotal),
      l3CacheMBTotal: clampToSlider(bounds.l3CacheMBTotal.max * 0.65, bounds.l3CacheMBTotal),
      memoryChannels: Math.min(16, Math.max(4, Math.ceil((pCores + eCores * 0.5) / 3))),
      powerLimitW: bounds.powerLimitW.max,
    };
  } else {
    // balanced
    const pCores = Math.max(1, Math.min(arch.maxPCores, Math.ceil(arch.maxPCores * 0.5)));
    const eCores = arch.supportsECores ? Math.min(arch.maxECores, Math.ceil(arch.maxECores * 0.35)) : 0;
    const pClock = clampToSlider(bounds.pClockGHz.min + clockSpan * 0.68, bounds.pClockGHz);
    next = {
      ...next,
      pCores,
      eCores,
      pClockGHz: pClock,
      eClockGHz: clampToSlider(pClock * 0.75, bounds.eClockGHz),
      ipcTuning: clampToSlider(1.05, bounds.ipcTuning),
      l2CacheMBTotal: clampToSlider(bounds.l2CacheMBTotal.max * 0.35, bounds.l2CacheMBTotal),
      l3CacheMBTotal: clampToSlider(bounds.l3CacheMBTotal.max * 0.35, bounds.l3CacheMBTotal),
      memoryChannels: Math.min(16, Math.max(2, Math.ceil(pCores / 2))),
      powerLimitW: clampToSlider(bounds.powerLimitW.min + (bounds.powerLimitW.max - bounds.powerLimitW.min) * 0.45, bounds.powerLimitW),
    };
  }

  // Fit reticle, stabilize voltage, and match cooling cleanly
  next = optimizeCpuDraft(next, 'fit_reticle', state);
  next = optimizeCpuDraft(next, 'stabilize_voltage', state);
  next = optimizeCpuDraft(next, 'match_cooling', state);
  return next;
}

export function optimizeCpuDraft(
  draft: CpuBlueprint,
  action: OptimizeActionId,
  state: GameState
): CpuBlueprint {
  const ctx = buildPreviewPhysicsContext(state, draft.processNodeId, 1.0);
  const bounds = getCpuSliderBounds(draft);
  let next = { ...draft };

  if (action === 'stabilize_voltage') {
    const ev = evaluateCpuPhysics(next, ctx);
    next.voltageV = getStabilizedVoltageV(ev.physics.minStableVoltageV, bounds.voltageV);
    return next;
  }

  if (action === 'fit_reticle') {
    for (let iter = 0; iter < 40; iter++) {
      const ev = evaluateCpuPhysics(next, ctx);
      if (!ev.physics.exceedsReticle) break;
      if (next.l3CacheMBTotal > bounds.l3CacheMBTotal.min) {
        next.l3CacheMBTotal = clampToSlider(next.l3CacheMBTotal * 0.75, bounds.l3CacheMBTotal);
      } else if (next.eCores > 0) {
        next.eCores = Math.max(0, Math.floor(next.eCores * 0.7));
      } else if (next.pCores > 1) {
        next.pCores = Math.max(1, Math.floor(next.pCores * 0.8));
      } else if (next.l2CacheMBTotal > bounds.l2CacheMBTotal.min) {
        next.l2CacheMBTotal = clampToSlider(next.l2CacheMBTotal * 0.65, bounds.l2CacheMBTotal);
      } else if (next.igpuTier > 0 || next.npuTier > 0) {
        next.igpuTier = Math.max(0, next.igpuTier - 1);
        next.npuTier = Math.max(0, next.npuTier - 1);
      } else {
        break;
      }
    }
    return next;
  }

  if (action === 'match_cooling') {
    const ev = evaluateCpuPhysics(next, ctx);
    const targetW = Math.max(ev.physics.rawPowerW, ev.physics.effectivePowerW);
    next.coolingId = pickBestCoolingForPower(state.unlockedTechIds, targetW);
    next.powerLimitW = clampToSlider(Math.ceil(targetW * 1.15), bounds.powerLimitW);
    return next;
  }

  if (action === 'balance_bandwidth') {
    const unlockedRam = MEMORY_TECHS.filter(
      (m) => m.kind === 'ram' && (!m.requiredTechId || state.unlockedTechIds.includes(m.requiredTechId))
    );
    const bestRam = unlockedRam[unlockedRam.length - 1];
    if (bestRam) next.memoryTechId = bestRam.id;
    const neededCh = Math.min(16, Math.max(2, Math.ceil((next.pCores + next.eCores * 0.5) / 2.5)));
    next.memoryChannels = neededCh;
    return optimizeCpuDraft(next, 'fit_reticle', state);
  }

  return next;
}

// ─── GPU PRESETS & OPTIMIZERS ───────────────────────────────────────────────

export function applyGpuPreset(
  draft: GpuBlueprint,
  preset: ArchitectPresetId,
  state: GameState
): GpuBlueprint {
  const arch = getGpuArch(draft.architectureId);
  const bounds = getGpuSliderBounds(draft);
  const unlockedVram = MEMORY_TECHS.filter(
    (m) => m.kind === 'vram' && (!m.requiredTechId || state.unlockedTechIds.includes(m.requiredTechId))
  );
  const bestVram = unlockedVram[unlockedVram.length - 1] ?? unlockedVram[0];
  const validBuses = GPU_BUS_WIDTHS.filter((b) => b <= bounds.maxBusWidthBits);

  const clockSpan = bounds.clockGHz.max - bounds.clockGHz.min;
  let next: GpuBlueprint = { ...draft, vramTechId: bestVram?.id ?? draft.vramTechId };

  if (preset === 'low_power') {
    const shaders = clampToSlider(arch.maxShaderCores * 0.25, bounds.shaderCores);
    next = {
      ...next,
      shaderCores: shaders,
      clockGHz: clampToSlider(bounds.clockGHz.min + clockSpan * 0.45, bounds.clockGHz),
      rops: clampToSlider(bounds.rops.max * 0.25, bounds.rops),
      tmus: clampToSlider(bounds.tmus.max * 0.25, bounds.tmus),
      memoryBusWidthBits: validBuses[Math.min(1, validBuses.length - 1)] ?? draft.memoryBusWidthBits,
      vramCapacityGB: clampToSlider(bounds.vramCapacityGB.max * 0.25, bounds.vramCapacityGB),
      l2CacheMB: clampToSlider(bounds.l2CacheMB.max * 0.2, bounds.l2CacheMB),
    };
  } else if (preset === 'high_yield') {
    const shaders = clampToSlider(arch.maxShaderCores * 0.35, bounds.shaderCores);
    next = {
      ...next,
      shaderCores: shaders,
      clockGHz: clampToSlider(bounds.clockGHz.min + clockSpan * 0.62, bounds.clockGHz),
      rops: clampToSlider(bounds.rops.max * 0.35, bounds.rops),
      tmus: clampToSlider(bounds.tmus.max * 0.35, bounds.tmus),
      memoryBusWidthBits: validBuses[Math.floor(validBuses.length * 0.5)] ?? draft.memoryBusWidthBits,
      l1CacheMB: clampToSlider(bounds.l1CacheMB.max * 0.2, bounds.l1CacheMB),
      l2CacheMB: clampToSlider(bounds.l2CacheMB.max * 0.25, bounds.l2CacheMB),
    };
  } else if (preset === 'flagship') {
    next = {
      ...next,
      shaderCores: clampToSlider(arch.maxShaderCores * 0.9, bounds.shaderCores),
      clockGHz: clampToSlider(bounds.clockGHz.min + clockSpan * 0.85, bounds.clockGHz),
      rops: clampToSlider(bounds.rops.max * 0.85, bounds.rops),
      tmus: clampToSlider(bounds.tmus.max * 0.85, bounds.tmus),
      memoryBusWidthBits: validBuses[validBuses.length - 1] ?? draft.memoryBusWidthBits,
      vramCapacityGB: clampToSlider(bounds.vramCapacityGB.max * 0.75, bounds.vramCapacityGB),
      l1CacheMB: clampToSlider(bounds.l1CacheMB.max * 0.6, bounds.l1CacheMB),
      l2CacheMB: clampToSlider(bounds.l2CacheMB.max * 0.7, bounds.l2CacheMB),
      powerLimitW: bounds.powerLimitW.max,
    };
  } else {
    next = {
      ...next,
      shaderCores: clampToSlider(arch.maxShaderCores * 0.55, bounds.shaderCores),
      clockGHz: clampToSlider(bounds.clockGHz.min + clockSpan * 0.68, bounds.clockGHz),
      rops: clampToSlider(bounds.rops.max * 0.5, bounds.rops),
      tmus: clampToSlider(bounds.tmus.max * 0.5, bounds.tmus),
      memoryBusWidthBits: validBuses[Math.max(0, validBuses.length - 2)] ?? draft.memoryBusWidthBits,
      vramCapacityGB: clampToSlider(bounds.vramCapacityGB.max * 0.45, bounds.vramCapacityGB),
      l1CacheMB: clampToSlider(bounds.l1CacheMB.max * 0.35, bounds.l1CacheMB),
      l2CacheMB: clampToSlider(bounds.l2CacheMB.max * 0.4, bounds.l2CacheMB),
    };
  }

  next = optimizeGpuDraft(next, 'fit_reticle', state);
  next = optimizeGpuDraft(next, 'stabilize_voltage', state);
  next = optimizeGpuDraft(next, 'match_cooling', state);
  return next;
}

export function optimizeGpuDraft(
  draft: GpuBlueprint,
  action: OptimizeActionId,
  state: GameState
): GpuBlueprint {
  const ctx = buildPreviewPhysicsContext(state, draft.processNodeId, 1.0);
  const bounds = getGpuSliderBounds(draft);
  let next = { ...draft };

  if (action === 'stabilize_voltage') {
    const ev = evaluateGpuPhysics(next, ctx);
    next.voltageV = getStabilizedVoltageV(ev.physics.minStableVoltageV, bounds.voltageV);
    return next;
  }

  if (action === 'fit_reticle') {
    for (let iter = 0; iter < 40; iter++) {
      const ev = evaluateGpuPhysics(next, ctx);
      if (!ev.physics.exceedsReticle) break;
      if (next.l2CacheMB > bounds.l2CacheMB.min) {
        next.l2CacheMB = clampToSlider(next.l2CacheMB * 0.72, bounds.l2CacheMB);
      } else if (next.shaderCores > bounds.shaderCores.min) {
        next.shaderCores = clampToSlider(next.shaderCores * 0.82, bounds.shaderCores);
        next.rops = clampToSlider(next.rops * 0.85, bounds.rops);
        next.tmus = clampToSlider(next.tmus * 0.85, bounds.tmus);
      } else {
        break;
      }
    }
    return next;
  }

  if (action === 'match_cooling') {
    const ev = evaluateGpuPhysics(next, ctx);
    const targetW = Math.max(ev.physics.rawPowerW, ev.physics.effectivePowerW);
    next.coolingId = pickBestCoolingForPower(state.unlockedTechIds, targetW);
    next.powerLimitW = clampToSlider(Math.ceil(targetW * 1.15), bounds.powerLimitW);
    return next;
  }

  if (action === 'balance_bandwidth') {
    const unlockedVram = MEMORY_TECHS.filter(
      (m) => m.kind === 'vram' && (!m.requiredTechId || state.unlockedTechIds.includes(m.requiredTechId))
    );
    const bestVram = unlockedVram[unlockedVram.length - 1];
    if (bestVram) next.vramTechId = bestVram.id;
    const nextBounds = getGpuSliderBounds(next);
    const validBuses = GPU_BUS_WIDTHS.filter((b) => b <= nextBounds.maxBusWidthBits);
    if (validBuses.length > 0) {
      next.memoryBusWidthBits = validBuses[validBuses.length - 1];
    }
    next.l2CacheMB = clampToSlider(nextBounds.l2CacheMB.max * 0.55, nextBounds.l2CacheMB);
    return optimizeGpuDraft(next, 'fit_reticle', state);
  }

  return next;
}

// ─── MEMORY PRESETS & OPTIMIZERS ────────────────────────────────────────────

export function applyMemoryPreset(
  draft: MemoryBlueprint,
  preset: ArchitectPresetId,
  state: GameState
): MemoryBlueprint {
  const cell = getMemoryCellArch(draft.cellArchId);
  const bounds = getMemorySliderBounds(draft);
  const rateSpan = bounds.dataRateMTs.max - bounds.dataRateMTs.min;
  const capSpan = bounds.capacityGB.max - bounds.capacityGB.min;
  const maxStack = bounds.stackLayersOptions[bounds.stackLayersOptions.length - 1] ?? 1;
  const midStack = bounds.stackLayersOptions[Math.floor(bounds.stackLayersOptions.length / 2)] ?? 1;
  const maxBus = bounds.busWidthOptions[bounds.busWidthOptions.length - 1] ?? draft.busWidthBits;
  const midBus = bounds.busWidthOptions[Math.floor(bounds.busWidthOptions.length / 2)] ?? draft.busWidthBits;
  const maxBanks = bounds.bankCountOptions[bounds.bankCountOptions.length - 1] ?? 4;

  let next: MemoryBlueprint = { ...draft };

  if (preset === 'low_power') {
    next = {
      ...next,
      stackLayers: bounds.stackLayersOptions[0] ?? 1,
      bitsPerCell: 1,
      capacityGB: clampToSlider(bounds.capacityGB.min + capSpan * 0.2, bounds.capacityGB),
      dataRateMTs: clampToSlider(bounds.dataRateMTs.min + rateSpan * 0.45, bounds.dataRateMTs),
      busWidthBits: bounds.busWidthOptions[0] ?? draft.busWidthBits,
      eccLevel: 1,
    };
  } else if (preset === 'high_yield') {
    next = {
      ...next,
      stackLayers: midStack,
      bitsPerCell: Math.min(2, cell.maxBitsPerCell),
      capacityGB: clampToSlider(bounds.capacityGB.min + capSpan * 0.28, bounds.capacityGB),
      dataRateMTs: clampToSlider(bounds.dataRateMTs.min + rateSpan * 0.65, bounds.dataRateMTs),
      busWidthBits: midBus,
      eccLevel: 2,
    };
  } else if (preset === 'flagship') {
    next = {
      ...next,
      stackLayers: maxStack,
      bitsPerCell: Math.min(cell.maxBitsPerCell, cell.nonVolatile ? Math.min(4, cell.maxBitsPerCell) : 1),
      capacityGB: clampToSlider(bounds.capacityGB.min + capSpan * 0.85, bounds.capacityGB),
      dataRateMTs: clampToSlider(bounds.dataRateMTs.min + rateSpan * 0.9, bounds.dataRateMTs),
      busWidthBits: maxBus,
      bankCount: maxBanks,
      eccLevel: cell.maxBitsPerCell >= 3 ? 3 : 2,
    };
  } else {
    next = {
      ...next,
      stackLayers: midStack,
      bitsPerCell: Math.min(cell.maxBitsPerCell, cell.nonVolatile ? Math.min(3, cell.maxBitsPerCell) : 1),
      capacityGB: clampToSlider(bounds.capacityGB.min + capSpan * 0.48, bounds.capacityGB),
      dataRateMTs: clampToSlider(bounds.dataRateMTs.min + rateSpan * 0.72, bounds.dataRateMTs),
      busWidthBits: midBus,
      bankCount: bounds.bankCountOptions[Math.floor(bounds.bankCountOptions.length / 2)] ?? 4,
      eccLevel: cell.maxBitsPerCell >= 2 ? 2 : 1,
    };
  }

  next = optimizeMemoryDraft(next, 'fit_reticle', state);
  next = optimizeMemoryDraft(next, 'stabilize_voltage', state);
  next = optimizeMemoryDraft(next, 'match_cooling', state);
  return next;
}

export function optimizeMemoryDraft(
  draft: MemoryBlueprint,
  action: OptimizeActionId,
  state: GameState
): MemoryBlueprint {
  const ctx = buildPreviewPhysicsContext(state, draft.processNodeId, 1.0);
  const bounds = getMemorySliderBounds(draft);
  let next = { ...draft };

  if (action === 'stabilize_voltage') {
    const ev = evaluateMemoryPhysics(next, ctx);
    next.voltageV = getStabilizedVoltageV(ev.physics.minStableVoltageV, bounds.voltageV);
    return next;
  }

  if (action === 'fit_reticle') {
    for (let iter = 0; iter < 40; iter++) {
      const ev = evaluateMemoryPhysics(next, ctx);
      if (!ev.physics.exceedsReticle) break;
      const nextBounds = getMemorySliderBounds(next);
      const maxStack = nextBounds.stackLayersOptions[nextBounds.stackLayersOptions.length - 1] ?? 1;
      if (next.stackLayers < maxStack) {
        const curIdx = nextBounds.stackLayersOptions.indexOf(next.stackLayers);
        next.stackLayers = nextBounds.stackLayersOptions[Math.min(nextBounds.stackLayersOptions.length - 1, curIdx + 1)];
      } else if (next.capacityGB > nextBounds.capacityGB.min) {
        next.capacityGB = clampToSlider(next.capacityGB * 0.78, nextBounds.capacityGB);
      } else {
        break;
      }
    }
    return next;
  }

  if (action === 'match_cooling') {
    const ev = evaluateMemoryPhysics(next, ctx);
    const targetW = Math.max(ev.physics.rawPowerW, ev.physics.effectivePowerW);
    next.coolingId = pickBestCoolingForPower(state.unlockedTechIds, targetW);
    next.powerLimitW = clampToSlider(Math.ceil(targetW * 1.18), bounds.powerLimitW);
    return next;
  }

  if (action === 'balance_bandwidth') {
    const iface = getMemoryInterface(next.interfaceId);
    const pkg = getPackagingSpec(next.packagingId);
    const nextBounds = getMemorySliderBounds(next);
    next.busWidthBits = nextBounds.busWidthOptions[nextBounds.busWidthOptions.length - 1] ?? next.busWidthBits;
    next.bankCount = nextBounds.bankCountOptions[nextBounds.bankCountOptions.length - 1] ?? next.bankCount;
    next.dataRateMTs = clampToSlider(
      Math.min(iface.maxDataRateMTs, nextBounds.dataRateMTs.max * 0.85),
      nextBounds.dataRateMTs
    );
    if (pkg.maxDieAreaMm2 < 100) {
      next = optimizeMemoryDraft(next, 'fit_reticle', state);
    }
    return optimizeMemoryDraft(next, 'stabilize_voltage', state);
  }

  return next;
}
