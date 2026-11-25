import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight,
  Crosshair,
  FlaskConical,
  Maximize2,
  Search,
  X,
  XCircle,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  getAggregatedTechModifiers,
  getTechNode,
  TECH_CANVAS_HEIGHT,
  TECH_CANVAS_WIDTH,
  TECH_COL_STEP,
  TECH_ERAS,
  TECH_LANES,
  TECH_LANE_MAP,
  TECH_NODE_H,
  TECH_NODE_W,
  TECH_START_X,
  TECH_TREE,
} from '../engine/catalog';
import { canResearchTech } from '../engine/simulation';
import type { GameState, TechLaneId, TechNode } from '../engine/types';

interface TechTreeViewProps {
  state: GameState;
  onStartResearch: (techId: string) => void;
  onCancelResearch: (techId: string) => void;
  focusTechId?: string | null;
  onFocusConsumed?: () => void;
}

type StatusFilter = 'all' | 'available' | 'unlocked' | 'locked';
type NodeStatus = 'unlocked' | 'researching' | 'available' | 'locked';

interface TechEdge {
  key: string;
  from: TechNode;
  to: TechNode;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const MIN_ZOOM = 0.22;
const MAX_ZOOM = 1.35;
const CULL_PADDING = 380;
const MINIMAP_W = 264;
const MINIMAP_H = 98;

const STATIC_NODE_MAP = new Map<string, TechNode>(TECH_TREE.map((t) => [t.id, t]));

const STATIC_EDGES: TechEdge[] = (() => {
  const edges: TechEdge[] = [];
  for (const node of TECH_TREE) {
    for (const preId of node.prerequisites) {
      const pre = STATIC_NODE_MAP.get(preId);
      if (!pre) continue;
      const x1 = pre.x + TECH_NODE_W;
      const y1 = pre.y + TECH_NODE_H / 2;
      const x2 = node.x;
      const y2 = node.y + TECH_NODE_H / 2;
      edges.push({
        key: `${pre.id}_${node.id}`,
        from: pre,
        to: node,
        x1,
        y1,
        x2,
        y2,
        minX: Math.min(x1, x2),
        maxX: Math.max(x1, x2),
        minY: Math.min(y1, y2),
        maxY: Math.max(y1, y2),
      });
    }
  }
  return edges;
})();

const DEPENDENTS_MAP: Map<string, TechNode[]> = (() => {
  const map = new Map<string, TechNode[]>();
  for (const node of TECH_TREE) {
    for (const preId of node.prerequisites) {
      const list = map.get(preId);
      if (list) list.push(node);
      else map.set(preId, [node]);
    }
  }
  return map;
})();

function getEraForTier(tier: number) {
  return TECH_ERAS.find((e) => tier >= e.startTier && tier <= e.endTier) ?? TECH_ERAS[0];
}

export const TechTreeView: React.FC<TechTreeViewProps> = ({
  state,
  onStartResearch,
  onCancelResearch,
  focusTechId,
  onFocusConsumed,
}) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const minimapRef = useRef<SVGSVGElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 1120, height: 760 });
  const [zoom, setZoom] = useState(0.72);
  const [pan, setPan] = useState({ x: 24, y: 16 });
  const [dragging, setDragging] = useState(false);
  const [minimapDragging, setMinimapDragging] = useState(false);
  const dragOrigin = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const [selectedId, setSelectedId] = useState<string>(TECH_TREE[0].id);
  const [filterLane, setFilterLane] = useState<'all' | TechLaneId>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  // Measure viewport cleanly via ResizeObserver for accurate 60 FPS culling & camera centering
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => {
      setViewportSize({
        width: Math.max(320, el.clientWidth),
        height: Math.max(240, el.clientHeight),
      });
    };
    update();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // O(1) lookup structures for 592+ node status evaluation
  const unlockedSet = useMemo(() => new Set(state.unlockedTechIds), [state.unlockedTechIds]);
  const activeMap = useMemo(
    () => new Map(state.activeResearch.map((r) => [r.techId, r])),
    [state.activeResearch]
  );

  const nodeStatusMap = useMemo(() => {
    const map = new Map<string, NodeStatus>();
    for (const node of TECH_TREE) {
      if (unlockedSet.has(node.id)) {
        map.set(node.id, 'unlocked');
      } else if (activeMap.has(node.id)) {
        map.set(node.id, 'researching');
      } else if (node.prerequisites.every((p) => unlockedSet.has(p))) {
        map.set(node.id, 'available');
      } else {
        map.set(node.id, 'locked');
      }
    }
    return map;
  }, [unlockedSet, activeMap]);

  const laneCounts = useMemo(() => {
    const counts: Record<TechLaneId, { total: number; unlocked: number }> = {
      fabrication: { total: 0, unlocked: 0 },
      lithography: { total: 0, unlocked: 0 },
      transistors: { total: 0, unlocked: 0 },
      cpu: { total: 0, unlocked: 0 },
      gpu: { total: 0, unlocked: 0 },
      memory: { total: 0, unlocked: 0 },
      packaging: { total: 0, unlocked: 0 },
    };
    for (const node of TECH_TREE) {
      counts[node.lane].total += 1;
      if (unlockedSet.has(node.id)) counts[node.lane].unlocked += 1;
    }
    return counts;
  }, [unlockedSet]);

  const techMods = useMemo(
    () => getAggregatedTechModifiers(state.unlockedTechIds),
    [state.unlockedTechIds]
  );

  const selectedNode: TechNode = STATIC_NODE_MAP.get(selectedId) ?? TECH_TREE[0];
  const selectedStatus: NodeStatus = nodeStatusMap.get(selectedNode.id) ?? 'locked';
  const selectedCheck = canResearchTech(state, selectedNode.id);
  const activeProj = activeMap.get(selectedNode.id);
  const estDays = Math.ceil(selectedNode.rpCost / Math.max(0.5, state.telemetry.rpPerDay));
  const selectedLaneMeta = TECH_LANE_MAP[selectedNode.lane];
  const selectedEra = getEraForTier(selectedNode.tier);
  const leadsToNodes = DEPENDENTS_MAP.get(selectedNode.id) ?? [];

  const focusOnNode = useCallback(
    (node: TechNode, targetZoom?: number) => {
      const z = targetZoom ?? Math.max(zoom, 0.72);
      setZoom(z);
      const cx = node.x + TECH_NODE_W / 2;
      const cy = node.y + TECH_NODE_H / 2;
      setPan({
        x: Math.round(viewportSize.width / 2 - cx * z),
        y: Math.round(viewportSize.height / 2 - cy * z),
      });
      setSelectedId(node.id);
    },
    [zoom, viewportSize.width, viewportSize.height]
  );

  // Jump directly to a specific tech node when navigated from Command Palette or Architect hints
  useEffect(() => {
    if (!focusTechId) return;
    const target = STATIC_NODE_MAP.get(focusTechId);
    if (target) {
      setFilterLane('all');
      setStatusFilter('all');
      focusOnNode(target, 0.85);
    }
    onFocusConsumed?.();
  }, [focusTechId, focusOnNode, onFocusConsumed]);

  const focusOnLane = useCallback(
    (laneId: 'all' | TechLaneId) => {
      setFilterLane(laneId);
      if (laneId === 'all') return;
      const laneMeta = TECH_LANE_MAP[laneId];
      // Jump vertically to the selected lane while keeping current horizontal tier position
      const targetWorldY = laneMeta.headerY + 130;
      setPan((prev) => ({
        x: prev.x,
        y: Math.round(viewportSize.height * 0.42 - targetWorldY * zoom),
      }));
    },
    [viewportSize.height, zoom]
  );

  const jumpToNextAvailable = useCallback(() => {
    const candidate = TECH_TREE.find((n) => {
      if (filterLane !== 'all' && n.lane !== filterLane) return false;
      return nodeStatusMap.get(n.id) === 'available';
    });
    if (candidate) {
      focusOnNode(candidate, Math.max(zoom, 0.76));
    }
  }, [filterLane, nodeStatusMap, focusOnNode, zoom]);

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results: TechNode[] = [];
    for (const node of TECH_TREE) {
      if (
        node.name.toLowerCase().includes(q) ||
        node.summary.toLowerCase().includes(q) ||
        node.unlocksSummary.some((u) => u.toLowerCase().includes(q)) ||
        TECH_LANE_MAP[node.lane].shortLabel.toLowerCase().includes(q)
      ) {
        results.push(node);
        if (results.length >= 12) break;
      }
    }
    return results;
  }, [searchQuery]);

  // World-space visible bounding rect for 60 FPS culling
  const visibleWorldBounds = useMemo(() => {
    const minX = -pan.x / zoom - CULL_PADDING;
    const minY = -pan.y / zoom - CULL_PADDING;
    const maxX = (-pan.x + viewportSize.width) / zoom + CULL_PADDING;
    const maxY = (-pan.y + viewportSize.height) / zoom + CULL_PADDING;
    return { minX, minY, maxX, maxY };
  }, [pan.x, pan.y, zoom, viewportSize.width, viewportSize.height]);

  const nodeMatchesFilter = useCallback(
    (node: TechNode): boolean => {
      if (filterLane !== 'all' && node.lane !== filterLane) return false;
      if (statusFilter === 'all') return true;
      const st = nodeStatusMap.get(node.id) ?? 'locked';
      if (statusFilter === 'available') return st === 'available' || st === 'researching';
      if (statusFilter === 'unlocked') return st === 'unlocked';
      return st === 'locked';
    },
    [filterLane, statusFilter, nodeStatusMap]
  );

  const visibleNodes = useMemo(() => {
    const { minX, minY, maxX, maxY } = visibleWorldBounds;
    return TECH_TREE.filter(
      (n) =>
        n.x + TECH_NODE_W >= minX &&
        n.x <= maxX &&
        n.y + TECH_NODE_H >= minY &&
        n.y <= maxY
    );
  }, [visibleWorldBounds]);

  const visibleEdges = useMemo(() => {
    const { minX, minY, maxX, maxY } = visibleWorldBounds;
    return STATIC_EDGES.filter(
      (e) => e.maxX >= minX && e.minX <= maxX && e.maxY >= minY && e.minY <= maxY
    );
  }, [visibleWorldBounds]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, input, [data-minimap="true"]')) return;
    setSearchOpen(false);
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

  const handleMouseUp = () => {
    setDragging(false);
    setMinimapDragging(false);
  };

  // Zoom anchored smoothly around cursor position
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = viewportRef.current;
    const factor = e.deltaY < 0 ? 1.1 : 0.91;
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number((zoom * factor).toFixed(3))));
    if (nextZoom === zoom) return;

    if (el) {
      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const worldX = (cursorX - pan.x) / zoom;
      const worldY = (cursorY - pan.y) / zoom;
      setPan({
        x: Math.round(cursorX - worldX * nextZoom),
        y: Math.round(cursorY - worldY * nextZoom),
      });
    }
    setZoom(nextZoom);
  };

  const zoomByButton = (delta: number) => {
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number((zoom + delta).toFixed(2))));
    const centerX = viewportSize.width / 2;
    const centerY = viewportSize.height / 2;
    const worldX = (centerX - pan.x) / zoom;
    const worldY = (centerY - pan.y) / zoom;
    setPan({
      x: Math.round(centerX - worldX * nextZoom),
      y: Math.round(centerY - worldY * nextZoom),
    });
    setZoom(nextZoom);
  };

  const resetView = () => {
    setZoom(0.72);
    setPan({ x: 24, y: 16 });
  };

  const panFromMinimapEvent = useCallback(
    (clientX: number, clientY: number) => {
      const svg = minimapRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const rx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const ry = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      const worldX = rx * TECH_CANVAS_WIDTH;
      const worldY = ry * TECH_CANVAS_HEIGHT;
      setPan({
        x: Math.round(viewportSize.width / 2 - worldX * zoom),
        y: Math.round(viewportSize.height / 2 - worldY * zoom),
      });
    },
    [viewportSize.width, viewportSize.height, zoom]
  );

  // Minimap viewport indicator box (in world coordinates scaled to minimap)
  const miniRect = useMemo(() => {
    const scaleX = MINIMAP_W / TECH_CANVAS_WIDTH;
    const scaleY = MINIMAP_H / TECH_CANVAS_HEIGHT;
    const wx = -pan.x / zoom;
    const wy = -pan.y / zoom;
    const ww = viewportSize.width / zoom;
    const wh = viewportSize.height / zoom;
    return {
      x: Math.max(0, Math.min(MINIMAP_W - 6, wx * scaleX)),
      y: Math.max(0, Math.min(MINIMAP_H - 6, wy * scaleY)),
      w: Math.max(8, Math.min(MINIMAP_W, ww * scaleX)),
      h: Math.max(6, Math.min(MINIMAP_H, wh * scaleY)),
    };
  }, [pan.x, pan.y, zoom, viewportSize.width, viewportSize.height]);

  return (
    <div className="h-[calc(100vh-52px)] flex flex-col bg-[#07090E]">
      {/* Top Toolbar: Title, Search, Status Filters, Zoom Controls */}
      <div className="px-4 py-2.5 bg-[#0B0F17] border-b border-[#1F2A3D] space-y-2 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-sm font-bold text-[#E8EEF7] tracking-tight">
                Technology Tree ·{' '}
                <span className="font-mono tabular-nums text-[#22D3EE]">
                  {state.unlockedTechIds.length} / {TECH_TREE.length}
                </span>{' '}
                Unlocked
              </h1>
              <p className="text-[11px] text-[#8C9BB2]">
                7 Lanes × 26 Tiers · Viewport-culled sandbox · Drag to pan · Scroll to zoom
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Instant Search with Camera Focus Jump */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setSearchOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchMatches.length > 0) {
                    focusOnNode(searchMatches[0], Math.max(zoom, 0.78));
                    setSearchOpen(false);
                  } else if (e.key === 'Escape') {
                    setSearchOpen(false);
                  }
                }}
                placeholder={`Search ${TECH_TREE.length} technologies...`}
                className="h-8 pl-8 pr-7 w-60 rounded-md bg-[#111622] border border-[#1F2A3D] focus:border-[#06B6D4] focus:outline-none text-xs text-[#E8EEF7] placeholder:text-[#64748B]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchOpen(false);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#E8EEF7] cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {searchOpen && searchQuery.trim().length > 0 && (
                <div className="absolute right-0 mt-1 w-80 max-h-80 overflow-y-auto bg-[#0B0F17] border border-[#2C3B55] rounded-md shadow-2xl z-50 divide-y divide-[#1F2A3D]">
                  {searchMatches.length === 0 ? (
                    <div className="px-3 py-2.5 text-xs text-[#8C9BB2]">
                      No matching technology found.
                    </div>
                  ) : (
                    searchMatches.map((m) => {
                      const st = nodeStatusMap.get(m.id) ?? 'locked';
                      const lm = TECH_LANE_MAP[m.lane];
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            focusOnNode(m, Math.max(zoom, 0.78));
                            setSearchOpen(false);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-[#171E2E] flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-[#E8EEF7] truncate">
                              {m.name}
                            </div>
                            <div className="text-[10px] font-mono text-[#8C9BB2] truncate">
                              <span style={{ color: lm.accent }}>{lm.shortLabel}</span> · T{m.tier} ·{' '}
                              {m.rpCost.toLocaleString()} RP
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-mono shrink-0 ${
                              st === 'unlocked'
                                ? 'text-emerald-400'
                                : st === 'researching'
                                  ? 'text-[#22D3EE]'
                                  : st === 'available'
                                    ? 'text-[#FBBF24]'
                                    : 'text-[#64748B]'
                            }`}
                          >
                            {st}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Status Filter */}
            <div className="flex items-center bg-[#111622] border border-[#1F2A3D] rounded-md p-0.5">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'available', label: 'Available' },
                  { id: 'unlocked', label: 'Unlocked' },
                  { id: 'locked', label: 'Locked' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStatusFilter(item.id)}
                  className={`px-2 py-1 text-[11px] rounded-[4px] whitespace-nowrap cursor-pointer ${
                    statusFilter === item.id
                      ? 'bg-[#171E2E] text-[#E8EEF7]'
                      : 'text-[#8C9BB2] hover:text-[#E8EEF7]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Jump to Next Available */}
            <button
              type="button"
              onClick={jumpToNextAvailable}
              className="h-8 px-2.5 rounded-md bg-[#111622] hover:bg-[#171E2E] border border-[#2C3B55] text-[11px] font-medium text-[#FBBF24] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              title="Pan camera to next available research node"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Next Available</span>
            </button>

            {/* Zoom Controls */}
            <div className="flex items-center bg-[#111622] border border-[#1F2A3D] rounded-md p-0.5">
              <button
                type="button"
                onClick={() => zoomByButton(-0.12)}
                className="h-7 w-7 flex items-center justify-center text-[#8C9BB2] hover:text-[#E8EEF7] cursor-pointer"
                title="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 text-xs font-mono tabular-nums text-[#E8EEF7] w-11 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => zoomByButton(0.12)}
                className="h-7 w-7 flex items-center justify-center text-[#8C9BB2] hover:text-[#E8EEF7] cursor-pointer"
                title="Zoom in"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={resetView}
                className="h-7 w-7 flex items-center justify-center text-[#8C9BB2] hover:text-[#E8EEF7] cursor-pointer"
                title="Reset camera to Era I"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* 7 Engineering Lane Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => focusOnLane('all')}
            className={`px-2.5 py-1 text-[11px] rounded border transition-colors whitespace-nowrap cursor-pointer ${
              filterLane === 'all'
                ? 'bg-[#171E2E] border-[#2C3B55] text-[#E8EEF7] font-medium'
                : 'bg-[#0E131D] border-[#1F2A3D] text-[#8C9BB2] hover:text-[#E8EEF7]'
            }`}
          >
            All 7 Lanes ({state.unlockedTechIds.length}/{TECH_TREE.length})
          </button>
          {TECH_LANES.map((lane) => {
            const c = laneCounts[lane.id];
            const active = filterLane === lane.id;
            return (
              <button
                key={lane.id}
                type="button"
                onClick={() => focusOnLane(lane.id)}
                className={`px-2.5 py-1 text-[11px] rounded border transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#171E2E] border-[#2C3B55] text-[#E8EEF7] font-medium'
                    : 'bg-[#0E131D] border-[#1F2A3D] text-[#8C9BB2] hover:text-[#E8EEF7]'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-[2px] shrink-0"
                  style={{ backgroundColor: lane.accent }}
                />
                <span>{lane.shortLabel}</span>
                <span className="font-mono tabular-nums text-[10px] text-[#64748B]">
                  {c.unlocked}/{c.total}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split: Viewport-Culled Sandbox Canvas + Right Inspector Drawer */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div
          ref={viewportRef}
          className={`flex-1 relative overflow-hidden bg-[#07090E] select-none ${
            dragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* Subtle calibration dot grid */}
          <div
            className="absolute inset-0 pointer-events-none opacity-25"
            style={{
              backgroundImage: 'radial-gradient(#2C3B55 1px, transparent 1px)',
              backgroundSize: `${Math.max(12, Math.round(32 * zoom))}px ${Math.max(
                12,
                Math.round(32 * zoom)
              )}px`,
              backgroundPosition: `${pan.x}px ${pan.y}px`,
            }}
          />

          {/* Transformed World Plane */}
          <div
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
              transformOrigin: '0 0',
              width: TECH_CANVAS_WIDTH,
              height: TECH_CANVAS_HEIGHT,
              position: 'relative',
              willChange: 'transform',
            }}
          >
            {/* 8 Top Era Banners + Subtle Column Dividers */}
            {TECH_ERAS.map((era) => {
              const xStart = TECH_START_X + (era.startTier - 1) * TECH_COL_STEP - 12;
              const width = (era.endTier - era.startTier + 1) * TECH_COL_STEP - 24;
              if (xStart + width < visibleWorldBounds.minX || xStart > visibleWorldBounds.maxX) {
                return null;
              }
              return (
                <React.Fragment key={era.id}>
                  <div
                    style={{
                      left: xStart,
                      top: 10,
                      width,
                      borderColor: `${era.accent}44`,
                    }}
                    className="absolute h-11 rounded-md bg-[#0B0F17]/90 border px-3 flex items-center justify-between pointer-events-none"
                  >
                    <span
                      style={{ color: era.accent }}
                      className="text-xs font-mono font-semibold tracking-wider"
                    >
                      {era.label}
                    </span>
                    <span className="text-[11px] font-mono text-[#8C9BB2]">
                      Tiers {era.startTier}–{era.endTier} · {era.subtitle}
                    </span>
                  </div>
                  <div
                    style={{
                      left: xStart - 6,
                      top: 60,
                      height: TECH_CANVAS_HEIGHT - 80,
                    }}
                    className="absolute w-px bg-[#1F2A3D]/45 pointer-events-none"
                  />
                </React.Fragment>
              );
            })}

            {/* 7 Lane Header Ribbons */}
            {TECH_LANES.map((lane) => {
              const bandHeight = lane.rowYs.length * 84 + 34;
              if (
                lane.headerY + bandHeight < visibleWorldBounds.minY ||
                lane.headerY > visibleWorldBounds.maxY
              ) {
                return null;
              }
              const laneDimmed = filterLane !== 'all' && filterLane !== lane.id;
              return (
                <div
                  key={lane.id}
                  style={{
                    top: lane.headerY,
                    left: 16,
                    width: TECH_CANVAS_WIDTH - 32,
                    height: bandHeight,
                    opacity: laneDimmed ? 0.28 : 1,
                  }}
                  className="absolute rounded-lg border border-[#1F2A3D]/55 bg-[#0B0F17]/35 pointer-events-none"
                >
                  <div
                    style={{ color: lane.accent }}
                    className="px-3 pt-1.5 text-[11px] font-mono font-semibold tracking-wider flex items-center justify-between"
                  >
                    <span>{lane.label}</span>
                    <span className="text-[#64748B]">
                      {laneCounts[lane.id].unlocked} / {laneCounts[lane.id].total} UNLOCKED
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Viewport-Culled SVG Dependency Curves */}
            <svg
              width={TECH_CANVAS_WIDTH}
              height={TECH_CANVAS_HEIGHT}
              className="absolute inset-0 pointer-events-none"
              aria-hidden="true"
            >
              {visibleEdges.map((edge) => {
                const midX = (edge.x1 + edge.x2) / 2;
                const bothUnlocked =
                  unlockedSet.has(edge.from.id) && unlockedSet.has(edge.to.id);
                const isSelectedEdge =
                  selectedNode.id === edge.to.id || selectedNode.id === edge.from.id;
                const edgeMatches =
                  nodeMatchesFilter(edge.from) || nodeMatchesFilter(edge.to);

                return (
                  <path
                    key={edge.key}
                    d={`M ${edge.x1} ${edge.y1} C ${midX} ${edge.y1}, ${midX} ${edge.y2}, ${edge.x2} ${edge.y2}`}
                    fill="none"
                    stroke={
                      isSelectedEdge
                        ? '#D97706'
                        : bothUnlocked
                          ? '#06B6D4'
                          : '#26334A'
                    }
                    strokeWidth={isSelectedEdge ? 2.5 : bothUnlocked ? 1.8 : 1.35}
                    opacity={isSelectedEdge ? 1 : edgeMatches ? 0.85 : 0.14}
                  />
                );
              })}
            </svg>

            {/* Viewport-Culled Technology Node Cards */}
            {visibleNodes.map((node) => {
              const status = nodeStatusMap.get(node.id) ?? 'locked';
              const isSelected = selectedNode.id === node.id;
              const matches = nodeMatchesFilter(node);
              const proj = activeMap.get(node.id);
              const pct = proj ? Math.min(100, (proj.progressRp / proj.totalRp) * 100) : 0;
              const laneAccent = TECH_LANE_MAP[node.lane].accent;

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
                    width: TECH_NODE_W,
                    height: TECH_NODE_H,
                    opacity: matches || isSelected ? 1 : 0.2,
                  }}
                  className={`absolute rounded-md border px-2.5 py-1.5 text-left flex flex-col justify-between transition-colors cursor-pointer ${bgClass} ${borderClass} ${
                    isSelected ? 'ring-2 ring-[#06B6D4] ring-offset-1 ring-offset-[#07090E]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 text-[10px] font-mono tabular-nums">
                    <span style={{ color: laneAccent }} className="truncate">
                      T{node.tier} · {TECH_LANE_MAP[node.lane].shortLabel}
                    </span>
                    <span className={`${statusColor} shrink-0`}>{statusLabel}</span>
                  </div>
                  <div className="text-[12px] font-semibold text-[#E8EEF7] leading-tight truncate">
                    {node.name}
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[10px] font-mono tabular-nums text-[#8C9BB2]">
                    <span>{node.rpCost.toLocaleString()} RP</span>
                    {proj ? (
                      <div className="w-16 h-1 bg-[#171E2E] rounded overflow-hidden">
                        <div className="h-full bg-[#06B6D4]" style={{ width: `${pct}%` }} />
                      </div>
                    ) : (
                      <span className="truncate text-[#64748B] max-w-[115px]">
                        {node.unlocksSummary[0] ?? ''}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Interactive Corner Minimap (All 592 Nodes + Live Camera Box) */}
          <div
            data-minimap="true"
            className="absolute bottom-3 right-3 bg-[#0B0F17]/95 border border-[#2C3B55] rounded-md p-2 shadow-2xl z-20"
          >
            <div className="flex items-center justify-between text-[10px] font-mono text-[#8C9BB2] mb-1">
              <span>OVERVIEW MAP</span>
              <span className="tabular-nums text-[#64748B]">
                {visibleNodes.length}/{TECH_TREE.length} culled
              </span>
            </div>
            <svg
              ref={minimapRef}
              width={MINIMAP_W}
              height={MINIMAP_H}
              className="block rounded bg-[#07090E] border border-[#1F2A3D] cursor-crosshair"
              onMouseDown={(e) => {
                e.stopPropagation();
                setMinimapDragging(true);
                panFromMinimapEvent(e.clientX, e.clientY);
              }}
              onMouseMove={(e) => {
                if (!minimapDragging) return;
                e.stopPropagation();
                panFromMinimapEvent(e.clientX, e.clientY);
              }}
              onMouseUp={(e) => {
                e.stopPropagation();
                setMinimapDragging(false);
              }}
              onMouseLeave={() => setMinimapDragging(false)}
            >
              {TECH_TREE.map((node) => {
                const st = nodeStatusMap.get(node.id);
                const mx = (node.x / TECH_CANVAS_WIDTH) * MINIMAP_W;
                const my = (node.y / TECH_CANVAS_HEIGHT) * MINIMAP_H;
                const fill =
                  node.id === selectedNode.id
                    ? '#FFFFFF'
                    : st === 'unlocked'
                      ? '#10B981'
                      : st === 'researching'
                        ? '#06B6D4'
                        : st === 'available'
                          ? '#F59E0B'
                          : '#334155';
                return (
                  <rect
                    key={node.id}
                    x={mx}
                    y={my}
                    width={node.id === selectedNode.id ? 4 : 2.6}
                    height={node.id === selectedNode.id ? 3 : 1.9}
                    fill={fill}
                    opacity={filterLane === 'all' || node.lane === filterLane ? 0.95 : 0.25}
                  />
                );
              })}
              <rect
                x={miniRect.x}
                y={miniRect.y}
                width={miniRect.w}
                height={miniRect.h}
                fill="#06B6D4"
                fillOpacity={0.14}
                stroke="#22D3EE"
                strokeWidth={1.2}
              />
            </svg>
          </div>
        </div>

        {/* Right Inspector Drawer */}
        <aside className="w-[344px] shrink-0 bg-[#0B0F17] border-l border-[#1F2A3D] p-5 overflow-y-auto space-y-4">
          <div className="space-y-1.5 border-b border-[#1F2A3D] pb-3.5">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span style={{ color: selectedLaneMeta.accent }}>
                {selectedLaneMeta.shortLabel} · Tier {selectedNode.tier}
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
            <div className="text-[10px] font-mono text-[#64748B] tracking-wider">
              {selectedEra.label} ({selectedEra.subtitle})
            </div>
            <h2 className="text-base font-bold text-[#E8EEF7] leading-snug">{selectedNode.name}</h2>
            <p className="text-xs text-[#8C9BB2] leading-relaxed">{selectedNode.summary}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums bg-[#111622] border border-[#1F2A3D] rounded p-3">
            <div>
              <div className="text-[#64748B] font-sans text-[11px]">Research Cost</div>
              <div className="text-[#E8EEF7] font-semibold">
                {selectedNode.rpCost.toLocaleString()} RP
              </div>
            </div>
            <div>
              <div className="text-[#64748B] font-sans text-[11px]">Est. Duration</div>
              <div className="text-[#22D3EE] font-semibold">~{estDays.toLocaleString()} days</div>
            </div>
          </div>

          {/* Unlocks & Modifiers */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold text-[#8C9BB2]">Engineering Effects &amp; Unlocks</h3>
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

          {/* Action CTA */}
          <div className="pt-1">
            {selectedStatus === 'unlocked' ? (
              <div className="p-2.5 rounded bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-400 font-medium">
                Technology active across your engineering empire.
              </div>
            ) : activeProj ? (
              <div className="space-y-2.5">
                <div className="flex justify-between text-xs font-mono tabular-nums text-[#22D3EE]">
                  <span>In Progress</span>
                  <span>
                    {Math.round(activeProj.progressRp).toLocaleString()} /{' '}
                    {activeProj.totalRp.toLocaleString()} RP
                  </span>
                </div>
                <div className="h-2 bg-[#171E2E] rounded overflow-hidden">
                  <div
                    className="h-full bg-[#06B6D4]"
                    style={{
                      width: `${Math.min(100, (activeProj.progressRp / activeProj.totalRp) * 100)}%`,
                    }}
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

          {/* Prerequisites */}
          <div className="space-y-1.5 pt-2 border-t border-[#1F2A3D]">
            <h3 className="text-xs font-semibold text-[#8C9BB2]">Prerequisites</h3>
            {selectedNode.prerequisites.length === 0 ? (
              <div className="text-xs text-[#64748B]">None — foundational Year 0001 branch</div>
            ) : (
              <div className="space-y-1">
                {selectedNode.prerequisites.map((preId) => {
                  const pre = getTechNode(preId);
                  const met = unlockedSet.has(preId);
                  return (
                    <button
                      key={preId}
                      type="button"
                      onClick={() => pre && focusOnNode(pre)}
                      className="w-full px-2.5 py-1.5 rounded bg-[#111622] border border-[#1F2A3D] hover:border-[#2C3B55] flex items-center justify-between gap-2 text-xs cursor-pointer"
                    >
                      <span className="text-[#E8EEF7] truncate">{pre?.name ?? preId}</span>
                      <span className={`font-mono shrink-0 ${met ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {met ? 'Done' : 'Needed'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Leads To (Downstream Dependents) */}
          {leadsToNodes.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-[#1F2A3D]">
              <h3 className="text-xs font-semibold text-[#8C9BB2]">
                Leads To ({leadsToNodes.length})
              </h3>
              <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
                {leadsToNodes.map((dep) => (
                  <button
                    key={dep.id}
                    type="button"
                    onClick={() => focusOnNode(dep)}
                    className="w-full px-2.5 py-1.5 rounded bg-[#111622] border border-[#1F2A3D] hover:border-[#2C3B55] flex items-center justify-between gap-2 text-xs cursor-pointer"
                  >
                    <span className="text-[#CBD5E1] truncate">{dep.name}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Live Cumulative Empire R&D Modifiers */}
          <div className="space-y-2 pt-2 border-t border-[#1F2A3D]">
            <h3 className="text-xs font-semibold text-[#8C9BB2]">
              Active Cumulative R&amp;D Modifiers
            </h3>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] font-mono tabular-nums bg-[#111622] border border-[#1F2A3D] rounded p-3">
              <div className="flex justify-between">
                <span className="text-[#64748B] font-sans">Logic Dens</span>
                <span className="text-[#E8EEF7]">{techMods.logicDensityMult.toFixed(2)}×</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B] font-sans">SRAM Dens</span>
                <span className="text-[#E8EEF7]">{techMods.sramDensityMult.toFixed(2)}×</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B] font-sans">Defect D0</span>
                <span className="text-emerald-400">{techMods.defectReductionMult.toFixed(2)}×</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B] font-sans">Leakage</span>
                <span className="text-emerald-400">{techMods.leakageReductionMult.toFixed(2)}×</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B] font-sans">CPU IPC</span>
                <span className="text-[#38BDF8]">{techMods.ipcBonusMult.toFixed(2)}×</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B] font-sans">GPU Comp</span>
                <span className="text-[#F59E0B]">{techMods.gpuComputeMult.toFixed(2)}×</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B] font-sans">Mem BW</span>
                <span className="text-[#14B8A6]">{techMods.memoryBandwidthMult.toFixed(2)}×</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B] font-sans">Cooling</span>
                <span className="text-[#10B981]">{techMods.coolingEfficiencyMult.toFixed(2)}×</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B] font-sans">Fab Wafers</span>
                <span className="text-[#22D3EE]">{techMods.fabThroughputMult.toFixed(2)}×</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B] font-sans">Lab RP</span>
                <span className="text-[#22D3EE]">{techMods.rpGenerationMult.toFixed(2)}×</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B] font-sans">PCIe / Slots</span>
                <span className="text-[#E8EEF7]">
                  G{techMods.maxPcieGen} · {techMods.maxParallelResearch}S
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B] font-sans">Wafer Dia</span>
                <span className="text-[#E8EEF7]">{techMods.waferDiameterMm} mm</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
