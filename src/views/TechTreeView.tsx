import React, { useMemo, useRef, useState } from 'react';
import { FlaskConical, Maximize2, XCircle, ZoomIn, ZoomOut } from 'lucide-react';
import { getTechNode, TECH_TREE } from '../engine/catalog';
import { canResearchTech } from '../engine/simulation';
import type { GameState, TechCategory, TechNode } from '../engine/types';

interface TechTreeViewProps {
  state: GameState;
  onStartResearch: (techId: string) => void;
  onCancelResearch: (techId: string) => void;
}

const NODE_W = 204;
const NODE_H = 66;

const CATEGORY_COLORS: Record<TechCategory, { accent: string; label: string }> = {
  fabrication: { accent: '#06B6D4', label: 'Fabrication' },
  cpu: { accent: '#38BDF8', label: 'CPU Tech' },
  gpu: { accent: '#F59E0B', label: 'GPU Tech' },
  support: { accent: '#10B981', label: 'Supporting' },
  frontier: { accent: '#D97706', label: 'Frontier' },
};

export const TechTreeView: React.FC<TechTreeViewProps> = ({
  state,
  onStartResearch,
  onCancelResearch,
}) => {
  const [zoom, setZoom] = useState(0.78);
  const [pan, setPan] = useState({ x: 30, y: 20 });
  const [dragging, setDragging] = useState(false);
  const dragOrigin = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [selectedId, setSelectedId] = useState<string>(TECH_TREE[0].id);
  const [filterCat, setFilterCat] = useState<'all' | TechCategory>('all');

  const nodeMap = useMemo(() => new Map(TECH_TREE.map((t) => [t.id, t])), []);
  const selectedNode: TechNode = nodeMap.get(selectedId) ?? TECH_TREE[0];

  const getNodeStatus = (node: TechNode): 'unlocked' | 'researching' | 'available' | 'locked' => {
    if (state.unlockedTechIds.includes(node.id)) return 'unlocked';
    if (state.activeResearch.some((r) => r.techId === node.id)) return 'researching';
    if (node.prerequisites.every((p) => state.unlockedTechIds.includes(p))) return 'available';
    return 'locked';
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setDragging(true);
    dragOrigin.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setPan({
      x: dragOrigin.current.panX + (e.clientX - dragOrigin.current.x),
      y: dragOrigin.current.panY + (e.clientY - dragOrigin.current.y),
    });
  };

  const handleMouseUp = () => setDragging(false);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setZoom((z) => Math.max(0.38, Math.min(1.35, Number((z + delta).toFixed(2)))));
  };

  const resetView = () => {
    setZoom(0.78);
    setPan({ x: 30, y: 20 });
  };

  const selectedStatus = getNodeStatus(selectedNode);
  const selectedCheck = canResearchTech(state, selectedNode.id);
  const activeProj = state.activeResearch.find((r) => r.techId === selectedNode.id);
  const estDays = Math.ceil(selectedNode.rpCost / Math.max(0.5, state.telemetry.rpPerDay));

  return (
    <div className="h-[calc(100vh-52px)] flex flex-col bg-[#07090E]">
      {/* Toolbar */}
      <div className="px-5 py-3 bg-[#0B0F17] border-b border-[#1F2A3D] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-base font-bold text-[#E8EEF7]">
            Technology Tree ({state.unlockedTechIds.length} / {TECH_TREE.length} Unlocked)
          </h1>
          <p className="text-xs text-[#8C9BB2]">
            Drag to pan · Scroll to zoom · Click any node to inspect physical unlocks &amp; prerequisites
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-[#111622] border border-[#1F2A3D] rounded-md p-0.5">
            {(['all', 'fabrication', 'cpu', 'gpu', 'support', 'frontier'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCat(cat)}
                className={`px-2.5 py-1 text-xs rounded-[4px] whitespace-nowrap cursor-pointer ${
                  filterCat === cat
                    ? 'bg-[#171E2E] text-[#E8EEF7]'
                    : 'text-[#8C9BB2] hover:text-[#E8EEF7]'
                }`}
              >
                {cat === 'all' ? 'All' : CATEGORY_COLORS[cat].label}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-[#111622] border border-[#1F2A3D] rounded-md p-0.5">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.38, Number((z - 0.12).toFixed(2))))}
              className="h-7 w-7 flex items-center justify-center text-[#8C9BB2] hover:text-[#E8EEF7] cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-xs font-mono tabular-nums text-[#E8EEF7]">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.35, Number((z + 0.12).toFixed(2))))}
              className="h-7 w-7 flex items-center justify-center text-[#8C9BB2] hover:text-[#E8EEF7] cursor-pointer"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={resetView}
              className="h-7 w-7 flex items-center justify-center text-[#8C9BB2] hover:text-[#E8EEF7] cursor-pointer"
              title="Reset view"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Split: Zoomable Canvas + Right Inspector Drawer */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Interactive Pan & Zoom Viewport */}
        <div
          className={`flex-1 relative overflow-hidden bg-[#07090E] ${
            dragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* Subtle calibration grid background */}
          <div
            className="absolute inset-0 pointer-events-none opacity-25"
            style={{
              backgroundImage:
                'radial-gradient(#2C3B55 1px, transparent 1px)',
              backgroundSize: `${Math.round(28 * zoom)}px ${Math.round(28 * zoom)}px`,
              backgroundPosition: `${pan.x}px ${pan.y}px`,
            }}
          />

          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              width: 3100,
              height: 1080,
              position: 'relative',
            }}
          >
            {/* Lane Labels */}
            {[
              { y: 42, label: 'FABRICATION & LITHOGRAPHY', color: '#06B6D4' },
              { y: 312, label: 'CPU ARCHITECTURES & ISA', color: '#38BDF8' },
              { y: 552, label: 'GPU & GRAPHICS MEMORY', color: '#F59E0B' },
              { y: 792, label: 'SUPPORTING PACKAGING, RAM & COOLING', color: '#10B981' },
            ].map((lane) => (
              <div
                key={lane.label}
                style={{ top: lane.y, left: 24, color: lane.color }}
                className="absolute text-[11px] font-mono tracking-wider opacity-70 pointer-events-none select-none"
              >
                {lane.label}
              </div>
            ))}
            <div
              style={{ top: 42, left: 2480, color: '#D97706' }}
              className="absolute text-[11px] font-mono tracking-wider opacity-85 pointer-events-none select-none"
            >
              POST-ANGSTROM FRONTIER PARADIGMS
            </div>

            {/* SVG Dependency Curves */}
            <svg
              width={3100}
              height={1080}
              className="absolute inset-0 pointer-events-none"
              aria-hidden="true"
            >
              {TECH_TREE.map((node) =>
                node.prerequisites.map((preId) => {
                  const pre = nodeMap.get(preId);
                  if (!pre) return null;
                  const x1 = pre.x + NODE_W;
                  const y1 = pre.y + NODE_H / 2;
                  const x2 = node.x;
                  const y2 = node.y + NODE_H / 2;
                  const midX = (x1 + x2) / 2;
                  const bothUnlocked =
                    state.unlockedTechIds.includes(pre.id) &&
                    state.unlockedTechIds.includes(node.id);
                  const isSelectedEdge =
                    selectedNode.id === node.id || selectedNode.id === pre.id;
                  const dimmed =
                    filterCat !== 'all' &&
                    node.category !== filterCat &&
                    pre.category !== filterCat;

                  return (
                    <path
                      key={`${pre.id}_${node.id}`}
                      d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                      fill="none"
                      stroke={
                        bothUnlocked
                          ? '#06B6D4'
                          : isSelectedEdge
                            ? '#D97706'
                            : '#26334A'
                      }
                      strokeWidth={isSelectedEdge ? 2.4 : 1.6}
                      opacity={dimmed ? 0.18 : 0.9}
                    />
                  );
                })
              )}
            </svg>

            {/* Technology Nodes */}
            {TECH_TREE.map((node) => {
              const status = getNodeStatus(node);
              const isSelected = selectedNode.id === node.id;
              const dimmed = filterCat !== 'all' && node.category !== filterCat;
              const proj = state.activeResearch.find((r) => r.techId === node.id);
              const pct = proj ? Math.min(100, (proj.progressRp / proj.totalRp) * 100) : 0;

              let borderClass = 'border-[#1F2A3D]';
              let bgClass = 'bg-[#0B0F17]';
              let statusLabel = 'Locked';
              let statusColor = 'text-[#64748B]';

              if (status === 'unlocked') {
                borderClass = 'border-emerald-500/60';
                bgClass = 'bg-[#0E1E22]';
                statusLabel = 'Unlocked';
                statusColor = 'text-emerald-400';
              } else if (status === 'researching') {
                borderClass = 'border-[#06B6D4]';
                bgClass = 'bg-[#0E2430]';
                statusLabel = `${pct.toFixed(0)}%`;
                statusColor = 'text-[#22D3EE]';
              } else if (status === 'available') {
                borderClass = 'border-[#2C3B55] hover:border-[#06B6D4]';
                bgClass = 'bg-[#111622]';
                statusLabel = 'Available';
                statusColor = 'text-[#FBBF24]';
              }

              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setSelectedId(node.id)}
                  style={{
                    left: node.x,
                    top: node.y,
                    width: NODE_W,
                    height: NODE_H,
                    opacity: dimmed ? 0.25 : 1,
                  }}
                  className={`absolute rounded-md border px-3 py-2 text-left flex flex-col justify-between transition-colors cursor-pointer ${bgClass} ${borderClass} ${
                    isSelected ? 'ring-2 ring-[#06B6D4] ring-offset-1 ring-offset-[#07090E]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 text-[10px] font-mono tabular-nums">
                    <span style={{ color: CATEGORY_COLORS[node.category].accent }}>
                      T{node.tier} · {CATEGORY_COLORS[node.category].label}
                    </span>
                    <span className={statusColor}>{statusLabel}</span>
                  </div>
                  <div className="text-xs font-semibold text-[#E8EEF7] leading-tight truncate">
                    {node.name}
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-[#8C9BB2]">
                    <span>{node.rpCost.toLocaleString()} RP</span>
                    {proj && (
                      <div className="w-16 h-1 bg-[#171E2E] rounded overflow-hidden">
                        <div className="h-full bg-[#06B6D4]" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Inspector Drawer */}
        <aside className="w-[330px] shrink-0 bg-[#0B0F17] border-l border-[#1F2A3D] p-5 overflow-y-auto space-y-4">
          <div className="space-y-1 border-b border-[#1F2A3D] pb-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span style={{ color: CATEGORY_COLORS[selectedNode.category].accent }}>
                {CATEGORY_COLORS[selectedNode.category].label} · Tier {selectedNode.tier}
              </span>
              <span
                className={
                  selectedStatus === 'unlocked'
                    ? 'text-emerald-400'
                    : selectedStatus === 'researching'
                      ? 'text-[#22D3EE]'
                      : selectedStatus === 'available'
                        ? 'text-[#FBBF24]'
                        : 'text-[#64748B]'
                }
              >
                {selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)}
              </span>
            </div>
            <h2 className="text-base font-bold text-[#E8EEF7]">{selectedNode.name}</h2>
            <p className="text-xs text-[#8C9BB2] leading-relaxed">{selectedNode.summary}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums bg-[#111622] border border-[#1F2A3D] rounded p-3">
            <div>
              <div className="text-[#64748B] font-sans">Research Cost</div>
              <div className="text-[#E8EEF7] font-semibold">
                {selectedNode.rpCost.toLocaleString()} RP
              </div>
            </div>
            <div>
              <div className="text-[#64748B] font-sans">Est. Duration</div>
              <div className="text-[#22D3EE] font-semibold">~{estDays} days</div>
            </div>
          </div>

          {/* Unlocks */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold text-[#8C9BB2]">Engineering Capabilities Unlocked</h3>
            <ul className="space-y-1 text-xs text-[#E8EEF7]">
              {selectedNode.unlocksSummary.map((u) => (
                <li key={u} className="leading-snug">
                  · {u}
                </li>
              ))}
            </ul>
          </div>

          {/* Physical Constraint Warning */}
          {selectedNode.constraintWarning && (
            <div className="p-3 rounded bg-amber-950/35 border border-amber-500/40 text-xs text-amber-200 space-y-0.5">
              <div className="font-semibold">New Engineering Constraint</div>
              <p className="leading-relaxed opacity-90">{selectedNode.constraintWarning}</p>
            </div>
          )}

          {/* Prerequisites */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold text-[#8C9BB2]">Prerequisites</h3>
            {selectedNode.prerequisites.length === 0 ? (
              <div className="text-xs text-[#64748B]">None — foundational Year 0001 branch</div>
            ) : (
              <div className="space-y-1">
                {selectedNode.prerequisites.map((preId) => {
                  const pre = getTechNode(preId);
                  const met = state.unlockedTechIds.includes(preId);
                  return (
                    <button
                      key={preId}
                      type="button"
                      onClick={() => setSelectedId(preId)}
                      className="w-full px-2.5 py-1.5 rounded bg-[#111622] border border-[#1F2A3D] hover:border-[#2C3B55] flex items-center justify-between text-xs cursor-pointer"
                    >
                      <span className="text-[#E8EEF7] truncate">{pre?.name ?? preId}</span>
                      <span className={`font-mono ${met ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {met ? 'Done' : 'Needed'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action */}
          <div className="pt-2 border-t border-[#1F2A3D]">
            {selectedStatus === 'unlocked' ? (
              <div className="text-xs text-emerald-400 font-medium">
                ● Technology active across your company.
              </div>
            ) : activeProj ? (
              <div className="space-y-2.5">
                <div className="flex justify-between text-xs font-mono tabular-nums text-[#22D3EE]">
                  <span>In Progress</span>
                  <span>
                    {Math.round(activeProj.progressRp)} / {activeProj.totalRp} RP
                  </span>
                </div>
                <div className="h-2 bg-[#171E2E] rounded overflow-hidden">
                  <div
                    className="h-full bg-[#06B6D4]"
                    style={{ width: `${Math.min(100, (activeProj.progressRp / activeProj.totalRp) * 100)}%` }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onCancelResearch(selectedNode.id)}
                  className="w-full h-9 rounded bg-rose-950/50 hover:bg-rose-900/50 border border-rose-500/40 text-xs font-medium text-rose-200 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Cancel Research</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={!selectedCheck.ok}
                  onClick={() => onStartResearch(selectedNode.id)}
                  className="w-full h-9 rounded bg-[#06B6D4] hover:bg-[#22D3EE] disabled:opacity-40 text-[#07090E] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>Start Research</span>
                </button>
                {!selectedCheck.ok && selectedCheck.reason && (
                  <p className="text-[11px] text-[#8C9BB2] text-center">{selectedCheck.reason}</p>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
