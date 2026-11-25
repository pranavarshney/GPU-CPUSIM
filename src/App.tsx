import { useCallback, useEffect, useRef, useState } from 'react';
import { CommandPalette } from './components/CommandPalette';
import { PhysicsReferenceModal } from './components/PhysicsReferenceModal';
import { SaveLoadModal } from './components/SaveLoadModal';
import { SettingsModal } from './components/SettingsModal';
import { Sidebar } from './components/Sidebar';
import { ToastStack, type ToastItem } from './components/ToastStack';
import { TopCommandBar } from './components/TopCommandBar';
import { bumpRevisionName } from './engine/architectHelpers';
import { ChipMetricsCache } from './engine/physics';
import {
  adjustDepartmentStaff,
  advanceFrontierTrack,
  advanceSimulationDays,
  archiveChipBlueprint,
  assignProductionLine,
  batchScaleProductionLines,
  cancelResearchProject,
  createInitialState,
  migrateGameState,
  queueFacilityBuild,
  queueFacilityUpgrade,
  recomputeTelemetry,
  renameCompany,
  restoreChipBlueprint,
  setDepartmentBudgets,
  setQaBudget,
  startChipTapeOut,
  startResearchProject,
} from './engine/simulation';
import {
  loadLatestSaveIfAny,
  loadUiSettings,
  saveQuarterlyAutosave,
  saveToSlot,
  saveUiSettings,
} from './engine/storage';
import type {
  ChipBlueprint,
  CpuBlueprint,
  DepartmentBudgets,
  DepartmentStaff,
  FacilityKind,
  GameState,
  GpuBlueprint,
  MainSection,
  MemoryBlueprint,
  MilestoneEvent,
  SimulationSpeed,
  UiSettings,
} from './engine/types';
import { CpuArchitectView } from './views/CpuArchitectView';
import { FinancesView } from './views/FinancesView';
import { GpuArchitectView } from './views/GpuArchitectView';
import { InfrastructureView } from './views/InfrastructureView';
import { ManufacturingView } from './views/ManufacturingView';
import { MemoryArchitectView } from './views/MemoryArchitectView';
import { OverviewView } from './views/OverviewView';
import { ProductTestingView } from './views/ProductTestingView';
import { ResearchView } from './views/ResearchView';
import { TechTreeView } from './views/TechTreeView';

const DAYS_PER_SECOND: Record<SimulationSpeed, number> = {
  0: 0,
  1: 2.0,
  2: 5.0,
  5: 16.0,
  10: 45.0,
};

const ALT_SECTION_SHORTCUTS: Record<string, MainSection> = {
  '1': 'overview',
  '2': 'research',
  '3': 'tech_tree',
  '4': 'cpu_architect',
  '5': 'gpu_architect',
  '6': 'memory_architect',
  '7': 'manufacturing',
  '8': 'testing',
  '9': 'infrastructure',
  '0': 'finances',
};

function actionForCategory(category: MilestoneEvent['category']): {
  section: MainSection;
  label: string;
  tone: ToastItem['tone'];
} {
  switch (category) {
    case 'research':
      return { section: 'research', label: 'Open Research', tone: 'info' };
    case 'tapeout':
      return { section: 'manufacturing', label: 'Assign to Fab', tone: 'nominal' };
    case 'construction':
      return { section: 'infrastructure', label: 'View Facilities', tone: 'nominal' };
    case 'warning':
      return { section: 'finances', label: 'Inspect Operations', tone: 'warning' };
    default:
      return { section: 'overview', label: 'View Overview', tone: 'info' };
  }
}

export default function App() {
  const cacheRef = useRef<ChipMetricsCache>(new ChipMetricsCache());
  const [state, setState] = useState<GameState>(() => createInitialState());
  const [activeSection, setActiveSection] = useState<MainSection>('overview');
  const [testingSelectedId, setTestingSelectedId] = useState<string | undefined>(undefined);
  const [focusTechId, setFocusTechId] = useState<string | null>(null);
  const [uiSettings, setUiSettings] = useState<UiSettings>(() => loadUiSettings());

  // Modals & drawers
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showPhysicsModal, setShowPhysicsModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [autosaveNotice, setAutosaveNotice] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const lastNonZeroSpeedRef = useRef<SimulationSpeed>(1);
  const uiSettingsRef = useRef<UiSettings>(uiSettings);
  uiSettingsRef.current = uiSettings;
  const stateRef = useRef<GameState>(state);
  stateRef.current = state;

  const toastTimersRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timer = toastTimersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (item: ToastItem) => {
      setToasts((prev) => {
        if (prev.some((t) => t.id === item.id)) return prev;
        return [item, ...prev].slice(0, 3);
      });
      if (!toastTimersRef.current.has(item.id)) {
        const timer = window.setTimeout(() => {
          toastTimersRef.current.delete(item.id);
          setToasts((prev) => prev.filter((t) => t.id !== item.id));
        }, 5200);
        toastTimersRef.current.set(item.id, timer);
      }
    },
    []
  );

  // Clean up pending toast timers on unmount
  useEffect(() => {
    const timers = toastTimersRef.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  // Attempt to restore most recent IndexedDB save on startup
  useEffect(() => {
    let active = true;
    loadLatestSaveIfAny().then((loaded) => {
      if (active && loaded) {
        cacheRef.current.clear();
        const refreshed = recomputeTelemetry(
          migrateGameState({ ...loaded, speed: 0 }),
          cacheRef.current
        );
        setState(refreshed);
        setAutosaveNotice('Restored last session (Paused)');
        window.setTimeout(() => setAutosaveNotice(null), 4000);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Persist lightweight UI preferences in localStorage
  useEffect(() => {
    saveUiSettings(uiSettings);
  }, [uiSettings]);

  const handleUpdateUiSettings = useCallback((patch: Partial<UiSettings>) => {
    setUiSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  // EU4-Style Real-Time Simulation Loop with Multi-Day Batching for 10x Multi-Millennia Performance
  const speed = state.speed;
  useEffect(() => {
    if (speed === 0) return;

    let rafId = 0;
    let lastTs = performance.now();
    let dayAccumulator = 0;

    const frame = (now: number) => {
      const dtSec = Math.min(0.25, (now - lastTs) / 1000);
      lastTs = now;
      dayAccumulator += dtSec * DAYS_PER_SECOND[speed];

      if (dayAccumulator >= 1) {
        const wholeDays = Math.min(30, Math.floor(dayAccumulator));
        dayAccumulator -= wholeDays;

        setState((prev) => {
          if (prev.speed === 0) return prev;
          const res = advanceSimulationDays(prev, wholeDays, cacheRef.current);
          let nextState = res.state;
          const settings = uiSettingsRef.current;
          const cats = res.triggeredCategories ?? [];

          // Granular auto-pause rules
          let shouldPause = false;
          if (res.milestoneTriggered && settings.pauseOnMilestone) {
            if (cats.includes('research') && (settings.pauseOnResearch ?? true)) {
              shouldPause = true;
            }
            if (cats.includes('tapeout') && (settings.pauseOnTapeOut ?? true)) {
              shouldPause = true;
            }
            if (cats.includes('construction') && (settings.pauseOnConstruction ?? false)) {
              shouldPause = true;
            }
            if (cats.includes('milestone')) {
              shouldPause = true;
            }
          }
          if (res.enteredDebt && (settings.pauseOnDebt ?? true)) {
            shouldPause = true;
          }
          if (res.enteredStarvation && (settings.pauseOnStarvation ?? false)) {
            shouldPause = true;
          }

          if (shouldPause) {
            nextState = { ...nextState, speed: 0 };
          }

          // Actionable toast notifications (queued outside updater cleanly via microtask)
          if (res.milestoneTriggered || res.enteredDebt || res.enteredStarvation) {
            const latest = nextState.events[0];
            if (res.enteredDebt) {
              queueMicrotask(() => {
                pushToast({
                  id: `debt-${nextState.clock.totalDays}`,
                  title: 'Operating Credit Deficit',
                  detail:
                    'Treasury fell below zero. Review opex, staffing, or assign profitable silicon lines.',
                  tone: 'critical',
                  actionSection: 'finances',
                  actionLabel: 'Open Finances',
                });
              });
            } else if (res.enteredStarvation) {
              queueMicrotask(() => {
                pushToast({
                  id: `starve-${nextState.clock.totalDays}`,
                  title: 'Foundry Supply Bottleneck',
                  detail:
                    'Production lines are throttled by raw silicon, power, or packaging capacity.',
                  tone: 'warning',
                  actionSection: 'infrastructure',
                  actionLabel: 'Expand Infra',
                });
              });
            } else if (latest) {
              const meta = actionForCategory(latest.category);
              queueMicrotask(() => {
                pushToast({
                  id: latest.id,
                  title: latest.title,
                  detail: latest.detail,
                  tone: meta.tone,
                  actionSection: meta.section,
                  actionLabel: meta.label,
                });
              });
            }
          }

          if (res.shouldAutosave) {
            saveQuarterlyAutosave(nextState)
              .then(() => {
                setAutosaveNotice(
                  `Autosaved Y${String(nextState.clock.year).padStart(4, '0')}`
                );
                window.setTimeout(() => setAutosaveNotice(null), 3000);
              })
              .catch(() => undefined);
          }

          return nextState;
        });
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [speed, pushToast]);

  const handleSetSpeed = useCallback((nextSpeed: SimulationSpeed) => {
    if (nextSpeed !== 0) {
      lastNonZeroSpeedRef.current = nextSpeed;
    }
    setState((prev) => ({ ...prev, speed: nextSpeed }));
  }, []);

  const handleQuickSave = useCallback(() => {
    const current = stateRef.current;
    const label = `Quick Save · Y${String(current.clock.year).padStart(4, '0')}`;
    saveToSlot('slot-1', label, current, false)
      .then(() => {
        setAutosaveNotice(`Quick-saved Slot 1 (Y${String(current.clock.year).padStart(4, '0')})`);
        window.setTimeout(() => setAutosaveNotice(null), 3200);
        pushToast({
          id: `quicksave-${Date.now()}`,
          title: 'Quick Save Complete',
          detail: `Saved campaign snapshot to Manual Slot 1 (${label}).`,
          tone: 'nominal',
        });
      })
      .catch(() => {
        pushToast({
          id: `quicksave-err-${Date.now()}`,
          title: 'Quick Save Warning',
          detail: 'Browser storage restricted; export a JSON backup from Save / Load.',
          tone: 'warning',
        });
      });
  }, [pushToast]);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      // Ctrl/Cmd + K -> Command Palette (works even while focused in inputs)
      if ((e.ctrlKey || e.metaKey) && key === 'k') {
        e.preventDefault();
        setShowCommandPalette((v) => !v);
        return;
      }

      // Ctrl/Cmd + S -> Quick Save to Slot 1
      if ((e.ctrlKey || e.metaKey) && key === 's') {
        e.preventDefault();
        handleQuickSave();
        return;
      }

      // Escape closes topmost modal or drawer
      if (e.key === 'Escape') {
        if (showCommandPalette) {
          setShowCommandPalette(false);
          return;
        }
        if (showSettingsModal) {
          setShowSettingsModal(false);
          return;
        }
        if (showSaveModal) {
          setShowSaveModal(false);
          return;
        }
        if (showPhysicsModal) {
          setShowPhysicsModal(false);
          return;
        }
        if (mobileNavOpen) {
          setMobileNavOpen(false);
          return;
        }
      }

      // Alt + 1..9, 0 -> Direct workspace navigation
      if (e.altKey && !e.ctrlKey && !e.metaKey && ALT_SECTION_SHORTCUTS[e.key]) {
        e.preventDefault();
        setActiveSection(ALT_SECTION_SHORTCUTS[e.key]);
        return;
      }

      // Skip single-key shortcuts when typing or when modal is open
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (showCommandPalette || showSettingsModal || showSaveModal || showPhysicsModal) {
        return;
      }

      if (e.key === '?') {
        e.preventDefault();
        setShowSettingsModal(true);
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setState((prev) => ({
          ...prev,
          speed: prev.speed === 0 ? lastNonZeroSpeedRef.current : 0,
        }));
      } else if (e.key === '1') {
        handleSetSpeed(1);
      } else if (e.key === '2') {
        handleSetSpeed(2);
      } else if (e.key === '3') {
        handleSetSpeed(5);
      } else if (e.key === '4') {
        handleSetSpeed(10);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleSetSpeed,
    handleQuickSave,
    showCommandPalette,
    showSettingsModal,
    showSaveModal,
    showPhysicsModal,
    mobileNavOpen,
  ]);

  // ─── PURE STATE ACTION WRAPPERS ───────────────────────────────────────────

  const handleStartResearch = useCallback((techId: string) => {
    setState((prev) => startResearchProject(prev, techId));
  }, []);

  const handleCancelResearch = useCallback((techId: string) => {
    setState((prev) => cancelResearchProject(prev, techId));
  }, []);

  const handleUpdateResearchBudgets = useCallback((budgets: DepartmentBudgets) => {
    setState((prev) => setDepartmentBudgets(prev, budgets));
  }, []);

  const handleAdvanceFrontier = useCallback((trackId: string) => {
    setState((prev) => advanceFrontierTrack(prev, trackId, cacheRef.current));
  }, []);

  const handleUpdateCpuDraft = useCallback((next: CpuBlueprint) => {
    setState((prev) => ({ ...prev, cpuDraft: next }));
  }, []);

  const handleUpdateGpuDraft = useCallback((next: GpuBlueprint) => {
    setState((prev) => ({ ...prev, gpuDraft: next }));
  }, []);

  const handleUpdateMemoryDraft = useCallback((next: MemoryBlueprint) => {
    setState((prev) => ({ ...prev, memoryDraft: next }));
  }, []);

  const handleStartTapeOut = useCallback(
    (draft: ChipBlueprint, autoAssignLineId?: string): { error?: string } => {
      let errorOut: string | undefined;
      setState((prev) => {
        const res = startChipTapeOut(prev, draft, cacheRef.current, autoAssignLineId);
        errorOut = res.error;
        return res.state;
      });
      return { error: errorOut };
    },
    []
  );

  const handleUpdateLine = useCallback(
    (
      lineId: string,
      updates: { chipId?: string | null; targetWaferStartsPerMonth?: number; qaStrictness?: number }
    ) => {
      setState((prev) => assignProductionLine(prev, lineId, updates, cacheRef.current));
    },
    []
  );

  const handleSetQaBudget = useCallback((level: number) => {
    setState((prev) => setQaBudget(prev, level, cacheRef.current));
  }, []);

  const handleBuildFacility = useCallback((kind: FacilityKind): { error?: string } => {
    let errorOut: string | undefined;
    setState((prev) => {
      const res = queueFacilityBuild(prev, kind);
      errorOut = res.error;
      return res.state;
    });
    return { error: errorOut };
  }, []);

  const handleUpgradeFacility = useCallback((facilityId: string): { error?: string } => {
    let errorOut: string | undefined;
    setState((prev) => {
      const res = queueFacilityUpgrade(prev, facilityId);
      errorOut = res.error;
      return res.state;
    });
    return { error: errorOut };
  }, []);

  const handleAdjustStaff = useCallback((dept: keyof DepartmentStaff, delta: number) => {
    setState((prev) => adjustDepartmentStaff(prev, dept, delta, cacheRef.current));
  }, []);

  const handleArchiveChip = useCallback((chipId: string) => {
    setState((prev) => archiveChipBlueprint(prev, chipId, cacheRef.current));
  }, []);

  const handleRestoreChip = useCallback((chipId: string) => {
    setState((prev) => restoreChipBlueprint(prev, chipId, cacheRef.current));
  }, []);

  const handleBatchScaleLines = useCallback((mode: 'max' | 'balance') => {
    setState((prev) => batchScaleProductionLines(prev, mode, cacheRef.current));
  }, []);

  const handleRenameCompany = useCallback((nextName: string) => {
    setState((prev) => renameCompany(prev, nextName));
  }, []);

  const handleJumpToTech = useCallback((techId: string) => {
    setFocusTechId(techId);
    setActiveSection('tech_tree');
  }, []);

  const handleInspectChip = useCallback((chipId: string) => {
    setTestingSelectedId(chipId);
    setActiveSection('testing');
  }, []);

  const handleLoadChipIntoArchitect = useCallback((chip: ChipBlueprint) => {
    const nextName = bumpRevisionName(chip.name);
    if (chip.kind === 'cpu') {
      setState((prev) => ({
        ...prev,
        cpuDraft: {
          ...chip,
          id: 'draft_cpu',
          status: 'draft',
          name: nextName,
          revision: prev.cpuDraft.revision + 1,
        },
      }));
      setActiveSection('cpu_architect');
    } else if (chip.kind === 'gpu') {
      setState((prev) => ({
        ...prev,
        gpuDraft: {
          ...chip,
          id: 'draft_gpu',
          status: 'draft',
          name: nextName,
          revision: prev.gpuDraft.revision + 1,
        },
      }));
      setActiveSection('gpu_architect');
    } else {
      setState((prev) => ({
        ...prev,
        memoryDraft: {
          ...chip,
          id: 'draft_memory',
          status: 'draft',
          name: nextName,
          revision: prev.memoryDraft.revision + 1,
        },
      }));
      setActiveSection('memory_architect');
    }
  }, []);

  const handleLoadSavedState = useCallback((loaded: GameState, notice: string) => {
    cacheRef.current.clear();
    setState(recomputeTelemetry(migrateGameState({ ...loaded, speed: 0 }), cacheRef.current));
    setAutosaveNotice(notice);
    window.setTimeout(() => setAutosaveNotice(null), 4000);
  }, []);

  const handleResetGame = useCallback(() => {
    cacheRef.current.clear();
    setState(createInitialState());
    setActiveSection('overview');
    setAutosaveNotice('New campaign initialized (Year 0001)');
    window.setTimeout(() => setAutosaveNotice(null), 4000);
  }, []);

  return (
    <div
      data-density={uiSettings.compactDensity ? 'compact' : 'comfortable'}
      className="h-screen w-screen overflow-hidden bg-[#06080D] text-[#E8EEF7] flex"
    >
      {/* Left Navigation Sidebar (Desktop Rail + Mobile Drawer) */}
      <Sidebar
        activeSection={activeSection}
        state={state}
        collapsed={Boolean(uiSettings.sidebarCollapsed)}
        mobileOpen={mobileNavOpen}
        onToggleCollapse={() =>
          handleUpdateUiSettings({ sidebarCollapsed: !uiSettings.sidebarCollapsed })
        }
        onCloseMobile={() => setMobileNavOpen(false)}
        onSelectSection={setActiveSection}
        onOpenPhysicsRef={() => setShowPhysicsModal(true)}
      />

      {/* Right Main Column: Top Command Bar + Active Workspace */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <TopCommandBar
          state={state}
          onSetSpeed={handleSetSpeed}
          onNavigate={setActiveSection}
          onQuickSave={handleQuickSave}
          onOpenSaveModal={() => setShowSaveModal(true)}
          onOpenCommandPalette={() => setShowCommandPalette(true)}
          onOpenSettings={() => setShowSettingsModal(true)}
          onOpenMobileMenu={() => setMobileNavOpen(true)}
          autosaveNotice={autosaveNotice}
        />

        <main className="flex-1 overflow-y-auto bg-[#06080D] relative">
          {activeSection === 'overview' && (
            <OverviewView
              state={state}
              onNavigate={setActiveSection}
              onJumpToTech={handleJumpToTech}
            />
          )}

          {activeSection === 'research' && (
            <ResearchView
              state={state}
              onStartResearch={handleStartResearch}
              onCancelResearch={handleCancelResearch}
              onUpdateBudgets={handleUpdateResearchBudgets}
              onAdvanceFrontier={handleAdvanceFrontier}
              onNavigate={setActiveSection}
              onJumpToTech={handleJumpToTech}
            />
          )}

          {activeSection === 'cpu_architect' && (
            <CpuArchitectView
              state={state}
              thermalOverlay={uiSettings.thermalOverlayDefault}
              onToggleThermal={() =>
                handleUpdateUiSettings({
                  thermalOverlayDefault: !uiSettings.thermalOverlayDefault,
                })
              }
              onUpdateDraft={handleUpdateCpuDraft}
              onStartTapeOut={handleStartTapeOut}
              onTestPrototype={() => {
                setTestingSelectedId('draft_cpu');
                setActiveSection('testing');
              }}
              onJumpToTech={handleJumpToTech}
            />
          )}

          {activeSection === 'gpu_architect' && (
            <GpuArchitectView
              state={state}
              thermalOverlay={uiSettings.thermalOverlayDefault}
              onToggleThermal={() =>
                handleUpdateUiSettings({
                  thermalOverlayDefault: !uiSettings.thermalOverlayDefault,
                })
              }
              onUpdateDraft={handleUpdateGpuDraft}
              onStartTapeOut={handleStartTapeOut}
              onTestPrototype={() => {
                setTestingSelectedId('draft_gpu');
                setActiveSection('testing');
              }}
              onStartGpuUnlockResearch={() => {
                handleStartResearch('gpu_fixed_pipeline');
                setActiveSection('research');
              }}
              onJumpToTech={handleJumpToTech}
            />
          )}

          {activeSection === 'memory_architect' && (
            <MemoryArchitectView
              state={state}
              thermalOverlay={uiSettings.thermalOverlayDefault}
              onToggleThermal={() =>
                handleUpdateUiSettings({
                  thermalOverlayDefault: !uiSettings.thermalOverlayDefault,
                })
              }
              onUpdateDraft={handleUpdateMemoryDraft}
              onStartTapeOut={handleStartTapeOut}
              onTestPrototype={() => {
                setTestingSelectedId('draft_memory');
                setActiveSection('testing');
              }}
              onStartResearch={(techId) => {
                handleStartResearch(techId);
                setActiveSection('research');
              }}
              onJumpToTechTree={() => setActiveSection('tech_tree')}
              onJumpToTech={handleJumpToTech}
            />
          )}

          {activeSection === 'manufacturing' && (
            <ManufacturingView
              state={state}
              onUpdateLine={handleUpdateLine}
              onBatchScaleLines={handleBatchScaleLines}
              onSetQaBudget={handleSetQaBudget}
              onNavigate={setActiveSection}
              onInspectChip={handleInspectChip}
              onCloneChip={handleLoadChipIntoArchitect}
            />
          )}

          {activeSection === 'testing' && (
            <ProductTestingView
              state={state}
              initialSelectedId={testingSelectedId}
              onArchiveChip={handleArchiveChip}
              onRestoreChip={handleRestoreChip}
              onLoadIntoArchitect={handleLoadChipIntoArchitect}
            />
          )}

          {activeSection === 'infrastructure' && (
            <InfrastructureView
              state={state}
              onBuildFacility={handleBuildFacility}
              onUpgradeFacility={handleUpgradeFacility}
            />
          )}

          {activeSection === 'finances' && (
            <FinancesView state={state} onAdjustStaff={handleAdjustStaff} />
          )}

          {activeSection === 'tech_tree' && (
            <TechTreeView
              state={state}
              onStartResearch={handleStartResearch}
              onCancelResearch={handleCancelResearch}
              focusTechId={focusTechId}
              onFocusConsumed={() => setFocusTechId(null)}
            />
          )}
        </main>
      </div>

      {/* Stackable Actionable Toast Notifications */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} onNavigate={setActiveSection} />

      {/* Modals */}
      {showCommandPalette && (
        <CommandPalette
          state={state}
          onClose={() => setShowCommandPalette(false)}
          onNavigate={setActiveSection}
          onJumpToTech={handleJumpToTech}
          onStartResearch={handleStartResearch}
          onInspectChip={handleInspectChip}
          onCloneChip={handleLoadChipIntoArchitect}
          onSetSpeed={handleSetSpeed}
          onQuickSave={handleQuickSave}
          onOpenSaveModal={() => setShowSaveModal(true)}
          onOpenSettings={() => setShowSettingsModal(true)}
          onOpenPhysicsRef={() => setShowPhysicsModal(true)}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          settings={uiSettings}
          companyName={state.companyName}
          onUpdateSettings={handleUpdateUiSettings}
          onRenameCompany={handleRenameCompany}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {showSaveModal && (
        <SaveLoadModal
          state={state}
          onClose={() => setShowSaveModal(false)}
          onLoadState={handleLoadSavedState}
          onResetGame={handleResetGame}
        />
      )}

      {showPhysicsModal && (
        <PhysicsReferenceModal onClose={() => setShowPhysicsModal(false)} />
      )}
    </div>
  );
}
