import React from 'react';
import {
  Activity,
  BookOpen,
  Cpu,
  Factory,
  FlaskConical,
  Gauge,
  GitBranch,
  HardDrive,
  Landmark,
  Layers,
  Microchip,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import { getMaxParallelResearch, TECH_ERAS, TECH_TREE } from '../engine/catalog';
import type { GameState, MainSection } from '../engine/types';

interface SidebarProps {
  activeSection: MainSection;
  state: GameState;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  onSelectSection: (section: MainSection) => void;
  onOpenPhysicsRef: () => void;
}

interface NavItem {
  id: MainSection;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut: string;
  badge?: (state: GameState) => { text: string; tone?: 'cyan' | 'amber' | 'muted' } | null;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Command',
    items: [
      {
        id: 'overview',
        label: 'Company Overview',
        shortLabel: 'Overview',
        icon: Activity,
        shortcut: 'Alt+1',
      },
    ],
  },
  {
    title: 'R&D',
    items: [
      {
        id: 'research',
        label: 'Research & Labs',
        shortLabel: 'Research',
        icon: FlaskConical,
        shortcut: 'Alt+2',
        badge: (s) => {
          const maxSlots = getMaxParallelResearch(s.unlockedTechIds);
          const active = s.activeResearch.length;
          return {
            text: `${active}/${maxSlots}`,
            tone: active === 0 ? 'amber' : 'cyan',
          };
        },
      },
      {
        id: 'tech_tree',
        label: 'Technology Tree',
        shortLabel: 'Tech Tree',
        icon: GitBranch,
        shortcut: 'Alt+3',
        badge: (s) => ({
          text: `${s.unlockedTechIds.length}`,
          tone: 'muted',
        }),
      },
    ],
  },
  {
    title: 'Silicon Design',
    items: [
      {
        id: 'cpu_architect',
        label: 'CPU Architect',
        shortLabel: 'CPU',
        icon: Cpu,
        shortcut: 'Alt+4',
      },
      {
        id: 'gpu_architect',
        label: 'GPU Architect',
        shortLabel: 'GPU',
        icon: Microchip,
        shortcut: 'Alt+5',
      },
      {
        id: 'memory_architect',
        label: 'Memory & Storage',
        shortLabel: 'Memory',
        icon: HardDrive,
        shortcut: 'Alt+6',
      },
    ],
  },
  {
    title: 'Foundry & Ops',
    items: [
      {
        id: 'manufacturing',
        label: 'Manufacturing',
        shortLabel: 'Fabs',
        icon: Factory,
        shortcut: 'Alt+7',
        badge: (s) => {
          const active = s.productionLines.filter((l) => l.chipId !== null).length;
          const total = s.productionLines.length;
          const throttled = s.productionLines.some(
            (l) => l.chipId !== null && l.statusNote !== 'Nominal'
          );
          return {
            text: `${active}/${total}`,
            tone: throttled || active < total ? 'amber' : 'muted',
          };
        },
      },
      {
        id: 'testing',
        label: 'Product Testing',
        shortLabel: 'Testing',
        icon: Gauge,
        shortcut: 'Alt+8',
        badge: (s) =>
          s.tapeOutQueue.length > 0 ? { text: `+${s.tapeOutQueue.length}`, tone: 'amber' } : null,
      },
      {
        id: 'infrastructure',
        label: 'Infrastructure',
        shortLabel: 'Infra',
        icon: Layers,
        shortcut: 'Alt+9',
        badge: (s) =>
          s.constructionQueue.length > 0
            ? { text: `${s.constructionQueue.length}`, tone: 'cyan' }
            : null,
      },
      {
        id: 'finances',
        label: 'Finances',
        shortLabel: 'Finances',
        icon: Landmark,
        shortcut: 'Alt+0',
        badge: (s) => (s.credits < 0 ? { text: 'DEBT', tone: 'amber' } : null),
      },
    ],
  },
];

function getActiveEra(unlockedTechIds: string[]) {
  if (unlockedTechIds.length === 0) return TECH_ERAS[0];
  const unlockedSet = new Set(unlockedTechIds);
  let maxTier = 1;
  for (const node of TECH_TREE) {
    if (unlockedSet.has(node.id) && node.tier > maxTier) {
      maxTier = node.tier;
    }
  }
  return TECH_ERAS.find((e) => maxTier >= e.startTier && maxTier <= e.endTier) ?? TECH_ERAS[0];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  state,
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile,
  onSelectSection,
  onOpenPhysicsRef,
}) => {
  const activeEra = getActiveEra(state.unlockedTechIds);
  const techPct = Math.min(100, (state.unlockedTechIds.length / Math.max(1, TECH_TREE.length)) * 100);

  const renderContent = (isCompact: boolean) => (
    <div className="h-full flex flex-col justify-between bg-[#0A0E16] border-r border-[#1E293B] select-none">
      <div className="min-h-0 flex-1 flex flex-col">
        {/* Brand Header */}
        <div
          className={`h-[52px] shrink-0 flex items-center border-b border-[#1E293B] ${
            isCompact ? 'justify-center px-2' : 'justify-between px-3.5'
          }`}
        >
          {!isCompact && (
            <div className="min-w-0">
              <div className="font-display text-sm font-bold tracking-tight text-[#E8EEF7] truncate">
                Semiconductor Empire
              </div>
              <div className="text-[10px] font-mono text-[#64748B] truncate">
                {activeEra.label} · {activeEra.subtitle}
              </div>
            </div>
          )}

          {/* Desktop collapse button */}
          <button
            type="button"
            onClick={onToggleCollapse}
            title={isCompact ? 'Expand navigation rail' : 'Collapse navigation rail'}
            aria-label={isCompact ? 'Expand navigation rail' : 'Collapse navigation rail'}
            className="hidden lg:flex h-7 w-7 rounded bg-[#101521] hover:bg-[#161D2D] border border-[#1E293B] text-[#8C9BB2] hover:text-[#E8EEF7] items-center justify-center shrink-0 cursor-pointer"
          >
            {isCompact ? (
              <PanelLeftOpen className="w-3.5 h-3.5" />
            ) : (
              <PanelLeftClose className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Mobile close button */}
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            className="lg:hidden h-7 w-7 rounded bg-[#101521] border border-[#1E293B] text-[#8C9BB2] hover:text-[#E8EEF7] flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Grouped Navigation */}
        <nav
          className="flex-1 overflow-y-auto px-2 py-2.5 space-y-3"
          aria-label="Primary navigation"
        >
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="space-y-0.5">
              {!isCompact ? (
                <div className="px-2.5 pb-1 text-[10px] font-mono tracking-wider uppercase text-[#64748B]">
                  {group.title}
                </div>
              ) : (
                <div className="mx-2 my-1.5 h-px bg-[#1E293B]" aria-hidden="true" />
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                const badge = item.badge ? item.badge(state) : null;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={
                      isCompact
                        ? `${item.label} (${item.shortcut})${badge ? ` · ${badge.text}` : ''}`
                        : `${item.label} (${item.shortcut})`
                    }
                    onClick={() => {
                      onSelectSection(item.id);
                      onCloseMobile();
                    }}
                    className={`w-full h-9 rounded-md flex items-center transition-colors cursor-pointer ${
                      isCompact ? 'justify-center px-0 relative' : 'justify-between px-2.5'
                    } ${
                      active
                        ? 'bg-[#161D2D] text-[#E8EEF7] border border-[#2C3B55]'
                        : 'text-[#8C9BB2] hover:text-[#E8EEF7] hover:bg-[#101521] border border-transparent'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          active ? 'text-[#06B6D4]' : 'text-[#64748B]'
                        }`}
                      />
                      {!isCompact && (
                        <span className="text-[13px] font-medium truncate whitespace-nowrap">
                          {item.label}
                        </span>
                      )}
                    </span>

                    {!isCompact && badge && (
                      <span
                        className={`font-mono tabular-nums text-[11px] shrink-0 ${
                          badge.tone === 'cyan'
                            ? 'text-[#22D3EE]'
                            : badge.tone === 'amber'
                              ? 'text-amber-400'
                              : 'text-[#64748B]'
                        }`}
                      >
                        {badge.text}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Footer Telemetry & Physics Model Reference */}
      <div className={`border-t border-[#1E293B] shrink-0 ${isCompact ? 'p-2' : 'p-3 space-y-2.5'}`}>
        {!isCompact && (
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-[#8C9BB2]">
              <span>Compute Index</span>
              <span className="font-mono tabular-nums text-[#E8EEF7]">
                {state.civilizationComputeIndex.toLocaleString()}
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[#8C9BB2]">
                <span>Tech Mastery</span>
                <span className="font-mono tabular-nums text-[#E8EEF7]">
                  {state.unlockedTechIds.length} / {TECH_TREE.length}
                </span>
              </div>
              <div className="h-1 bg-[#06080D] rounded overflow-hidden">
                <div className="h-full bg-[#06B6D4]" style={{ width: `${techPct}%` }} />
              </div>
            </div>
            {state.tapeOutQueue.length > 0 && (
              <div className="flex items-center justify-between text-[#8C9BB2]">
                <span>Tape-Out Queue</span>
                <span className="font-mono tabular-nums text-amber-400">
                  {state.tapeOutQueue.length} active
                </span>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            onOpenPhysicsRef();
            onCloseMobile();
          }}
          title="Physics Model Documentation"
          className={`w-full h-8 rounded-md bg-[#101521] hover:bg-[#161D2D] border border-[#1E293B] text-xs font-medium text-[#8C9BB2] hover:text-[#E8EEF7] flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
            isCompact ? 'px-0' : 'px-2.5'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
          {!isCompact && <span>Physics Model Docs</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Rail */}
      <aside
        className={`hidden lg:block shrink-0 h-full transition-[width] duration-150 ${
          collapsed ? 'w-[64px]' : 'w-[232px]'
        }`}
      >
        {renderContent(collapsed)}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-black/70 flex"
          onClick={onCloseMobile}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation drawer"
        >
          <aside className="w-[248px] h-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {renderContent(false)}
          </aside>
        </div>
      )}
    </>
  );
};
