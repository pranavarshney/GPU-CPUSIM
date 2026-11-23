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
} from 'lucide-react';
import type { GameState, MainSection } from '../engine/types';

interface SidebarProps {
  activeSection: MainSection;
  state: GameState;
  onSelectSection: (section: MainSection) => void;
  onOpenPhysicsRef: () => void;
}

interface NavItem {
  id: MainSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: (state: GameState) => number | null;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Company Overview', icon: Activity },
  {
    id: 'research',
    label: 'Research',
    icon: FlaskConical,
    count: (s) => (s.activeResearch.length > 0 ? s.activeResearch.length : null),
  },
  { id: 'cpu_architect', label: 'CPU Architect', icon: Cpu },
  { id: 'gpu_architect', label: 'GPU Architect', icon: Microchip },
  { id: 'memory_architect', label: 'Memory & Storage', icon: HardDrive },
  {
    id: 'manufacturing',
    label: 'Manufacturing',
    icon: Factory,
    count: (s) => s.productionLines.filter((l) => l.chipId !== null).length,
  },
  { id: 'testing', label: 'Product Testing', icon: Gauge },
  {
    id: 'infrastructure',
    label: 'Infrastructure',
    icon: Layers,
    count: (s) => (s.constructionQueue.length > 0 ? s.constructionQueue.length : null),
  },
  { id: 'finances', label: 'Finances', icon: Landmark },
  { id: 'tech_tree', label: 'Technology Tree', icon: GitBranch },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  state,
  onSelectSection,
  onOpenPhysicsRef,
}) => {
  return (
    <aside className="w-[232px] shrink-0 bg-[#0B0F17] border-r border-[#1F2A3D] flex flex-col justify-between select-none">
      <div>
        {/* Brand Title (single clean wordmark) */}
        <div className="h-[52px] px-4 flex items-center border-b border-[#1F2A3D]">
          <span className="font-display text-sm font-bold tracking-tight text-[#E8EEF7] whitespace-nowrap">
            Semiconductor Empire
          </span>
        </div>

        {/* 9 Main Navigation Sections */}
        <nav className="p-2.5 space-y-0.5" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            const badgeCount = item.count ? item.count(state) : null;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSection(item.id)}
                className={`w-full h-9 px-3 rounded-md flex items-center justify-between text-left text-[13px] font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#171E2E] text-[#E8EEF7] border border-[#2C3B55]'
                    : 'text-[#8C9BB2] hover:text-[#E8EEF7] hover:bg-[#111622] border border-transparent'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      active ? 'text-[#06B6D4]' : 'text-[#64748B]'
                    }`}
                  />
                  <span className="truncate whitespace-nowrap">{item.label}</span>
                </span>
                {badgeCount !== null && (
                  <span className="font-mono tabular-nums text-xs text-[#8C9BB2]">
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Engineering Summary & Physics Reference */}
      <div className="p-3 border-t border-[#1F2A3D] space-y-2.5">
        <div className="text-xs text-[#8C9BB2] space-y-1">
          <div className="flex items-center justify-between">
            <span>Compute Index</span>
            <span className="font-mono tabular-nums text-[#E8EEF7]">
              {state.civilizationComputeIndex.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Technologies</span>
            <span className="font-mono tabular-nums text-[#E8EEF7]">
              {state.unlockedTechIds.length}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Tape-Out Queue</span>
            <span className="font-mono tabular-nums text-[#E8EEF7]">
              {state.tapeOutQueue.length}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenPhysicsRef}
          className="w-full h-8 px-2.5 rounded-md bg-[#111622] hover:bg-[#171E2E] border border-[#1F2A3D] text-xs font-medium text-[#8C9BB2] hover:text-[#E8EEF7] flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5 text-[#D97706]" />
          <span>Physics Model Docs</span>
        </button>
      </div>
    </aside>
  );
};
