import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BookOpen,
  Cpu,
  Factory,
  FastForward,
  FlaskConical,
  Gauge,
  GitBranch,
  HardDrive,
  Landmark,
  Layers,
  Microchip,
  Pause,
  Play,
  Save,
  Search,
  Settings,
  X,
} from 'lucide-react';
import { TECH_TREE, TECH_LANE_MAP } from '../engine/catalog';
import { canResearchTech } from '../engine/simulation';
import type { ChipBlueprint, GameState, MainSection, SimulationSpeed } from '../engine/types';

export interface CommandPaletteProps {
  state: GameState;
  onClose: () => void;
  onNavigate: (section: MainSection) => void;
  onJumpToTech: (techId: string) => void;
  onStartResearch: (techId: string) => void;
  onInspectChip: (chipId: string) => void;
  onCloneChip: (chip: ChipBlueprint) => void;
  onSetSpeed: (speed: SimulationSpeed) => void;
  onQuickSave: () => void;
  onOpenSaveModal: () => void;
  onOpenSettings: () => void;
  onOpenPhysicsRef: () => void;
}

interface PaletteItem {
  id: string;
  group: 'Navigation' | 'Actions' | 'Technologies' | 'Chips' | 'Facilities';
  title: string;
  subtitle: string;
  badge?: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string;
  onSelect: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  state,
  onClose,
  onNavigate,
  onJumpToTech,
  onStartResearch,
  onInspectChip,
  onCloneChip,
  onSetSpeed,
  onQuickSave,
  onOpenSaveModal,
  onOpenSettings,
  onOpenPhysicsRef,
}) => {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const allItems = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = [
      // Navigation
      {
        id: 'nav_overview',
        group: 'Navigation',
        title: 'Company Overview',
        subtitle: 'Empire telemetry, pipeline, ecosystem & chronicle',
        badge: 'Alt+1',
        icon: Activity,
        keywords: 'overview dashboard home command',
        onSelect: () => {
          onNavigate('overview');
          onClose();
        },
      },
      {
        id: 'nav_research',
        group: 'Navigation',
        title: 'Research & Labs',
        subtitle: `${state.activeResearch.length} active projects · ${state.unlockedTechIds.length}/${TECH_TREE.length} unlocked`,
        badge: 'Alt+2',
        icon: FlaskConical,
        keywords: 'research labs rp frontier',
        onSelect: () => {
          onNavigate('research');
          onClose();
        },
      },
      {
        id: 'nav_tech_tree',
        group: 'Navigation',
        title: 'Technology Tree',
        subtitle: `Zoomable 7-lane graph (${TECH_TREE.length} technologies)`,
        badge: 'Alt+3',
        icon: GitBranch,
        keywords: 'tech tree graph roadmap nodes',
        onSelect: () => {
          onNavigate('tech_tree');
          onClose();
        },
      },
      {
        id: 'nav_cpu',
        group: 'Navigation',
        title: 'CPU Architect',
        subtitle: `Draft: ${state.cpuDraft.name}`,
        badge: 'Alt+4',
        icon: Cpu,
        keywords: 'cpu processor cores architect design',
        onSelect: () => {
          onNavigate('cpu_architect');
          onClose();
        },
      },
      {
        id: 'nav_gpu',
        group: 'Navigation',
        title: 'GPU Architect',
        subtitle: `Draft: ${state.gpuDraft.name}`,
        badge: 'Alt+5',
        icon: Microchip,
        keywords: 'gpu graphics shader vram architect design',
        onSelect: () => {
          onNavigate('gpu_architect');
          onClose();
        },
      },
      {
        id: 'nav_memory',
        group: 'Navigation',
        title: 'Memory & Storage Architect',
        subtitle: `Draft: ${state.memoryDraft.name}`,
        badge: 'Alt+6',
        icon: HardDrive,
        keywords: 'memory ram dram vram hbm nand ssd storage scm',
        onSelect: () => {
          onNavigate('memory_architect');
          onClose();
        },
      },
      {
        id: 'nav_mfg',
        group: 'Navigation',
        title: 'Manufacturing & Fabs',
        subtitle: `${state.productionLines.length} wafer fabrication lines`,
        badge: 'Alt+7',
        icon: Factory,
        keywords: 'manufacturing fabs wafers yield lines production',
        onSelect: () => {
          onNavigate('manufacturing');
          onClose();
        },
      },
      {
        id: 'nav_testing',
        group: 'Navigation',
        title: 'Product Testing & Diagnostics',
        subtitle: `${state.chips.length} taped-out silicon designs`,
        badge: 'Alt+8',
        icon: Gauge,
        keywords: 'testing benchmarks diagnostics compare radar',
        onSelect: () => {
          onNavigate('testing');
          onClose();
        },
      },
      {
        id: 'nav_infra',
        group: 'Navigation',
        title: 'Infrastructure & Facilities',
        subtitle: `${state.facilities.length} online · ${state.constructionQueue.length} building`,
        badge: 'Alt+9',
        icon: Layers,
        keywords: 'infrastructure build facility power refinery osat lab',
        onSelect: () => {
          onNavigate('infrastructure');
          onClose();
        },
      },
      {
        id: 'nav_finances',
        group: 'Navigation',
        title: 'Finances & Workforce',
        subtitle: `Treasury ${Math.round(state.credits).toLocaleString()} CR`,
        badge: 'Alt+0',
        icon: Landmark,
        keywords: 'finances credits payroll staff workforce economy',
        onSelect: () => {
          onNavigate('finances');
          onClose();
        },
      },

      // Quick Actions
      {
        id: 'act_pause',
        group: 'Actions',
        title: state.speed === 0 ? 'Resume Simulation (1×)' : 'Pause Simulation',
        subtitle: 'Toggle real-time simulation clock',
        badge: 'Space',
        icon: state.speed === 0 ? Play : Pause,
        keywords: 'pause resume stop start speed time',
        onSelect: () => {
          onSetSpeed(state.speed === 0 ? 1 : 0);
          onClose();
        },
      },
      {
        id: 'act_speed10',
        group: 'Actions',
        title: 'Set Speed to 10× (Max)',
        subtitle: 'Fast-forward multi-year fabrication and R&D',
        badge: '4',
        icon: FastForward,
        keywords: 'speed fast 10x accelerate',
        onSelect: () => {
          onSetSpeed(10);
          onClose();
        },
      },
      {
        id: 'act_quicksave',
        group: 'Actions',
        title: 'Quick Save to Slot 1',
        subtitle: 'Immediately write current campaign to IndexedDB',
        badge: 'Ctrl+S',
        icon: Save,
        keywords: 'save quicksave backup slot',
        onSelect: () => {
          onQuickSave();
          onClose();
        },
      },
      {
        id: 'act_savemodal',
        group: 'Actions',
        title: 'Open Save / Load & JSON Export',
        subtitle: 'Manage 4 manual slots, autosaves, and save files',
        icon: Save,
        keywords: 'load export import save slots reset',
        onSelect: () => {
          onClose();
          onOpenSaveModal();
        },
      },
      {
        id: 'act_settings',
        group: 'Actions',
        title: 'Settings & Auto-Pause Rules',
        subtitle: 'Configure pause triggers, UI density, and shortcuts',
        badge: '?',
        icon: Settings,
        keywords: 'settings preferences autopause density shortcuts',
        onSelect: () => {
          onClose();
          onOpenSettings();
        },
      },
      {
        id: 'act_physics',
        group: 'Actions',
        title: 'Physics Model Documentation',
        subtitle: 'Inspect exact Murphy yield, thermal, and power equations',
        icon: BookOpen,
        keywords: 'physics equations docs math formulas murphy thermal',
        onSelect: () => {
          onClose();
          onOpenPhysicsRef();
        },
      },
    ];

    // Chips
    for (const chip of state.chips) {
      items.push({
        id: `chip_test_${chip.id}`,
        group: 'Chips',
        title: `${chip.name}`,
        subtitle: `${chip.kind.toUpperCase()} · ${chip.status} · Y${String(chip.createdYear).padStart(4, '0')} — Open in Product Testing`,
        badge: chip.kind.toUpperCase(),
        icon: chip.kind === 'cpu' ? Cpu : chip.kind === 'gpu' ? Microchip : HardDrive,
        keywords: `${chip.name} ${chip.kind} ${chip.processNodeId} test benchmark`,
        onSelect: () => {
          onInspectChip(chip.id);
          onClose();
        },
      });
      items.push({
        id: `chip_clone_${chip.id}`,
        group: 'Chips',
        title: `Clone ${chip.name} to Architect`,
        subtitle: `Load blueprint into ${chip.kind.toUpperCase()} Architect as next revision`,
        badge: 'Clone',
        icon: chip.kind === 'cpu' ? Cpu : chip.kind === 'gpu' ? Microchip : HardDrive,
        keywords: `clone edit revise ${chip.name} ${chip.kind}`,
        onSelect: () => {
          onCloneChip(chip);
          onClose();
        },
      });
    }

    // Facilities
    for (const fac of state.facilities) {
      items.push({
        id: `fac_${fac.id}`,
        group: 'Facilities',
        title: fac.name,
        subtitle: `Level ${fac.level} · ${fac.kind.replace('_', ' ')} · ${fac.monthlyUpkeepCR} CR/mo`,
        badge: `L${fac.level}`,
        icon: Factory,
        keywords: `${fac.name} ${fac.kind} facility upgrade`,
        onSelect: () => {
          onNavigate(fac.kind === 'fab' ? 'manufacturing' : 'infrastructure');
          onClose();
        },
      });
    }

    return items;
  }, [
    state,
    onNavigate,
    onClose,
    onSetSpeed,
    onQuickSave,
    onOpenSaveModal,
    onOpenSettings,
    onOpenPhysicsRef,
    onInspectChip,
    onCloneChip,
  ]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return allItems.slice(0, 14);
    }
    const tokens = q.split(/\s+/).filter(Boolean);
    const matches = allItems.filter((item) => {
      const hay = `${item.title} ${item.subtitle} ${item.keywords}`.toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });

    // Search across all 592 technologies dynamically when query has >= 2 chars
    if (q.length >= 2) {
      const unlockedSet = new Set(state.unlockedTechIds);
      const activeSet = new Set(state.activeResearch.map((r) => r.techId));
      const techMatches: PaletteItem[] = [];
      for (const tech of TECH_TREE) {
        if (techMatches.length >= 16) break;
        const laneLabel = TECH_LANE_MAP[tech.lane]?.shortLabel ?? tech.lane;
        const hay = `${tech.name} ${tech.id} ${laneLabel} ${tech.summary} tier ${tech.tier}`.toLowerCase();
        if (tokens.every((t) => hay.includes(t))) {
          const isUnlocked = unlockedSet.has(tech.id);
          const isActive = activeSet.has(tech.id);
          const check = !isUnlocked && !isActive ? canResearchTech(state, tech.id) : { ok: false };
          techMatches.push({
            id: `tech_${tech.id}`,
            group: 'Technologies',
            title: tech.name,
            subtitle: `T${tech.tier} ${laneLabel} · ${tech.rpCost.toLocaleString()} RP · ${
              isUnlocked
                ? 'Unlocked'
                : isActive
                  ? 'Researching'
                  : check.ok
                    ? 'Available — Enter to Locate'
                    : 'Locked — Enter to Locate in Tree'
            }`,
            badge: isUnlocked ? 'Done' : isActive ? 'Active' : check.ok ? 'Ready' : `T${tech.tier}`,
            icon: GitBranch,
            keywords: hay,
            onSelect: () => {
              onJumpToTech(tech.id);
              onClose();
            },
          });
          if (check.ok) {
            techMatches.push({
              id: `tech_start_${tech.id}`,
              group: 'Technologies',
              title: `Start Research: ${tech.name}`,
              subtitle: `Immediately begin researching (${tech.rpCost.toLocaleString()} RP)`,
              badge: 'Start',
              icon: FlaskConical,
              keywords: `start research ${hay}`,
              onSelect: () => {
                onStartResearch(tech.id);
                onClose();
              },
            });
          }
        }
      }
      return [...matches.slice(0, 10), ...techMatches];
    }

    return matches.slice(0, 20);
  }, [query, allItems, state, onJumpToTech, onStartResearch, onClose]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => (filtered.length > 0 ? (i + 1) % filtered.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) =>
          filtered.length > 0 ? (i - 1 + filtered.length) % filtered.length : 0
        );
      } else if (e.key === 'Enter' && filtered[activeIdx]) {
        e.preventDefault();
        filtered[activeIdx].onSelect();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filtered, activeIdx, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center pt-[10vh] px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Global Command Palette"
    >
      <div
        className="w-full max-w-2xl bg-[#101521] border border-[#2C3B55] rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 h-12 border-b border-[#1E293B] bg-[#0A0E16]">
          <Search className="w-4 h-4 text-[#06B6D4] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search views, 592 technologies, chips, fabs, or commands...`}
            className="flex-1 bg-transparent text-sm text-[#E8EEF7] placeholder:text-[#64748B] focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-[#64748B] hover:text-[#E8EEF7] cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="font-mono text-[10px] text-[#64748B] border border-[#1E293B] rounded px-1.5 py-0.5">
            ESC
          </span>
        </div>

        <div className="max-h-[58vh] overflow-y-auto divide-y divide-[#1E293B]/60">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#64748B]">
              No views, technologies, chips, or actions match “{query}”.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon;
              const selected = idx === activeIdx;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setActiveIdx(idx)}
                  onClick={item.onSelect}
                  className={`w-full px-4 py-2.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                    selected ? 'bg-[#161D2D]' : 'hover:bg-[#161D2D]/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        selected ? 'text-[#22D3EE]' : 'text-[#64748B]'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-[#E8EEF7] truncate">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-[#8C9BB2] truncate">{item.subtitle}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[10px] text-[#64748B]">{item.group}</span>
                    {item.badge && (
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#0A0E16] border border-[#1E293B] text-[#CBD5E1]">
                        {item.badge}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="px-4 py-2 bg-[#0A0E16] border-t border-[#1E293B] flex items-center justify-between text-[11px] text-[#64748B] font-mono">
          <span>↑↓ Navigate · Enter Execute · Esc Close</span>
          <span>{TECH_TREE.length} Tech Nodes Indexed</span>
        </div>
      </div>
    </div>
  );
};
