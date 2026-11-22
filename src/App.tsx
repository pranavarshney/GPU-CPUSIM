import { useCallback, useEffect, useRef, useState } from 'react';
import { PhysicsReferenceModal } from './components/PhysicsReferenceModal';
import { SaveLoadModal } from './components/SaveLoadModal';
import { Sidebar } from './components/Sidebar';
import { TopCommandBar } from './components/TopCommandBar';
import { ChipMetricsCache } from './engine/physics';
import {
  adjustDepartmentStaff,
  advanceFrontierTrack,
  advanceSimulationDays,
  archiveChipBlueprint,
  assignProductionLine,
  cancelResearchProject,
  createInitialState,
  queueFacilityBuild,
  queueFacilityUpgrade,
  recomputeTelemetry,
  setDepartmentBudgets,
  setQaBudget,
  startChipTapeOut,
  startResearchProject,
} from './engine/simulation';
import {
  loadLatestSaveIfAny,
  loadUiSettings,
  saveQuarterlyAutosave,
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
  SimulationSpeed,
  UiSettings,
} from './engine/types';
import { CpuArchitectView } from './views/CpuArchitectView';
import { FinancesView } from './views/FinancesView';
import { GpuArchitectView } from './views/GpuArchitectView';
import { InfrastructureView } from './views/InfrastructureView';
import { ManufacturingView } from './views/ManufacturingView';
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

export default function App() {
  const cacheRef = useRef<ChipMetricsCache>(new ChipMetricsCache());
  const [state, setState] = useState<GameState>(() => createInitialState());
  const [activeSection, setActiveSection] = useState<MainSection>('overview');
  const [testingSelectedId, setTestingSelectedId] = useState<string | undefined>(undefined);
  const [uiSettings, setUiSettings] = useState<UiSettings>(() => loadUiSettings());
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showPhysicsModal, setShowPhysicsModal] = useState(false);
  const [autosaveNotice, setAutosaveNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; detail: string } | null>(null);

  const lastNonZeroSpeedRef = useRef<SimulationSpeed>(1);
  const uiSettingsRef = useRef<UiSettings>(uiSettings);
  uiSettingsRef.current = uiSettings;

  // Attempt to restore most recent IndexedDB save on startup
  useEffect(() => {
    let active = true;
    loadLatestSaveIfAny().then((loaded) => {
      if (active && loaded) {
        cacheRef.current.clear();
        const refreshed = recomputeTelemetry({ ...loaded, speed: 0 }, cacheRef.current);
        setState(refreshed);
        setAutosaveNotice('Restored last session (Paused)');
        setTimeout(() => setAutosaveNotice(null), 4000);
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

  const showToast = useCallback((title: string, detail: string) => {
    setToast({ title, detail });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(id);
  }, [toast]);

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

          if (res.milestoneTriggered) {
            const latest = nextState.events[0];
            if (latest) {
              showToast(latest.title, latest.detail);
            }
            if (uiSettingsRef.current.pauseOnMilestone) {
              nextState = { ...nextState, speed: 0 };
            }
          }

          if (res.shouldAutosave) {
            saveQuarterlyAutosave(nextState)
              .then(() => {
                setAutosaveNotice(
                  `Autosaved Y${String(nextState.clock.year).padStart(4, '0')}`
                );
                setTimeout(() => setAutosaveNotice(null), 3000);
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
  }, [speed, showToast]);

  // Keyboard shortcuts (Space = Pause/Resume, 1..4 = Speed 1x/2x/5x/10x)
  const handleSetSpeed = useCallback((nextSpeed: SimulationSpeed) => {
    if (nextSpeed !== 0) {
      lastNonZeroSpeedRef.current = nextSpeed;
    }
    setState((prev) => ({ ...prev, speed: nextSpeed }));
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
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
  }, [handleSetSpeed]);

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

  const handleStartTapeOut = useCallback(
    (draft: ChipBlueprint): { error?: string } => {
      let errorOut: string | undefined;
      setState((prev) => {
        const res = startChipTapeOut(prev, draft, cacheRef.current);
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

  const handleLoadChipIntoArchitect = useCallback((chip: ChipBlueprint) => {
    if (chip.kind === 'cpu') {
      setState((prev) => ({
        ...prev,
        cpuDraft: {
          ...chip,
          id: 'draft_cpu',
          status: 'draft',
          name: `${chip.name} Rev 2`,
          revision: prev.cpuDraft.revision + 1,
        },
      }));
      setActiveSection('cpu_architect');
    } else {
      setState((prev) => ({
        ...prev,
        gpuDraft: {
          ...chip,
          id: 'draft_gpu',
          status: 'draft',
          name: `${chip.name} Rev 2`,
          revision: prev.gpuDraft.revision + 1,
        },
      }));
      setActiveSection('gpu_architect');
    }
  }, []);

  const handleLoadSavedState = useCallback((loaded: GameState, notice: string) => {
    cacheRef.current.clear();
    setState(recomputeTelemetry({ ...loaded, speed: 0 }, cacheRef.current));
    setAutosaveNotice(notice);
    setTimeout(() => setAutosaveNotice(null), 4000);
  }, []);

  const handleResetGame = useCallback(() => {
    cacheRef.current.clear();
    setState(createInitialState());
    setActiveSection('overview');
    setAutosaveNotice('New campaign initialized (Year 0001)');
    setTimeout(() => setAutosaveNotice(null), 4000);
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#07090E] text-[#E8EEF7] flex">
      {/* Left Navigation Sidebar */}
      <Sidebar
        activeSection={activeSection}
        state={state}
        onSelectSection={setActiveSection}
        onOpenPhysicsRef={() => setShowPhysicsModal(true)}
      />

      {/* Right Main Column: Top EU4 Command Bar + Active Workspace */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <TopCommandBar
          state={state}
          uiSettings={uiSettings}
          onSetSpeed={handleSetSpeed}
          onTogglePauseOnMilestone={() =>
            setUiSettings((s) => ({ ...s, pauseOnMilestone: !s.pauseOnMilestone }))
          }
          onOpenSaveModal={() => setShowSaveModal(true)}
          autosaveNotice={autosaveNotice}
        />

        <main className="flex-1 overflow-y-auto bg-[#07090E] relative">
          {activeSection === 'overview' && (
            <OverviewView state={state} onNavigate={setActiveSection} />
          )}

          {activeSection === 'research' && (
            <ResearchView
              state={state}
              onStartResearch={handleStartResearch}
              onCancelResearch={handleCancelResearch}
              onUpdateBudgets={handleUpdateResearchBudgets}
              onAdvanceFrontier={handleAdvanceFrontier}
              onNavigate={setActiveSection}
            />
          )}

          {activeSection === 'cpu_architect' && (
            <CpuArchitectView
              state={state}
              thermalOverlay={uiSettings.thermalOverlayDefault}
              onToggleThermal={() =>
                setUiSettings((s) => ({
                  ...s,
                  thermalOverlayDefault: !s.thermalOverlayDefault,
                }))
              }
              onUpdateDraft={handleUpdateCpuDraft}
              onStartTapeOut={handleStartTapeOut}
              onTestPrototype={() => {
                setTestingSelectedId('draft_cpu');
                setActiveSection('testing');
              }}
            />
          )}

          {activeSection === 'gpu_architect' && (
            <GpuArchitectView
              state={state}
              thermalOverlay={uiSettings.thermalOverlayDefault}
              onToggleThermal={() =>
                setUiSettings((s) => ({
                  ...s,
                  thermalOverlayDefault: !s.thermalOverlayDefault,
                }))
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
            />
          )}

          {activeSection === 'manufacturing' && (
            <ManufacturingView
              state={state}
              onUpdateLine={handleUpdateLine}
              onSetQaBudget={handleSetQaBudget}
              onNavigate={setActiveSection}
            />
          )}

          {activeSection === 'testing' && (
            <ProductTestingView
              state={state}
              initialSelectedId={testingSelectedId}
              onArchiveChip={handleArchiveChip}
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
            />
          )}
        </main>
      </div>

      {/* Milestone Notification Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-40 max-w-sm bg-[#111622] border border-[#06B6D4]/60 rounded-lg px-4 py-3 shadow-lg">
          <div className="text-xs font-semibold text-[#22D3EE]">{toast.title}</div>
          <div className="text-xs text-[#CBD5E1] mt-0.5 leading-relaxed">{toast.detail}</div>
        </div>
      )}

      {/* Modals */}
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
