import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Region, Connection, Character, WorldEvent } from '../types';
import RegionDetail from './RegionDetail';
import MapEventMarkers from './MapEventMarkers';

interface Props {
  geography: { regions: Region[]; connections: Connection[] };
  factionMap: Record<string, { name: string; color: string }>;
  characters: Character[];
  events: WorldEvent[];
  currentDay: number;
}

const SVG_SIZE = 1000;
const REGION_RADIUS = 38;
const RESOURCE_COLORS: Record<string, string> = {
  iron: '#94a3b8',
  gold: '#fbbf24',
  wood: '#a3e635',
  food: '#fb923c',
  stone: '#9ca3af',
  mana: '#c084fc',
  crystal: '#67e8f9',
  water: '#60a5fa',
  oil: '#1e293b',
  herbs: '#4ade80',
};

function getRegionColor(
  region: Region,
  factionMap: Record<string, { name: string; color: string }>
): string {
  if (region.controlled_by && factionMap[region.controlled_by]) {
    return factionMap[region.controlled_by].color;
  }
  return '#6b7280';
}

function scaleCoord(val: number): number {
  // Scale from [0,1] to padding-safe area of SVG
  return 80 + val * (SVG_SIZE - 160);
}

export default function WorldMap({
  geography,
  factionMap,
  characters,
  events,
  currentDay,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: SVG_SIZE, h: SVG_SIZE });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, vx: 0, vy: 0 });

  const { regions, connections } = geography;

  // Build region position map
  const regionPositions = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {};
    regions.forEach((r) => {
      map[r.id] = { x: scaleCoord(r.x), y: scaleCoord(r.y) };
    });
    return map;
  }, [regions]);

  // Check if regions are too clustered and apply D3-like repulsion
  const adjustedPositions = useMemo(() => {
    const positions = { ...regionPositions };
    const ids = Object.keys(positions);

    // Simple repulsion pass (avoid d3 dependency for this since we have coordinates)
    for (let iter = 0; iter < 50; iter++) {
      let moved = false;
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = positions[ids[i]];
          const b = positions[ids[j]];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = REGION_RADIUS * 3.5;
          if (dist < minDist && dist > 0) {
            const force = (minDist - dist) / 2;
            const nx = dx / dist;
            const ny = dy / dist;
            positions[ids[i]] = {
              x: Math.max(60, Math.min(SVG_SIZE - 60, a.x - nx * force)),
              y: Math.max(60, Math.min(SVG_SIZE - 60, a.y - ny * force)),
            };
            positions[ids[j]] = {
              x: Math.max(60, Math.min(SVG_SIZE - 60, b.x + nx * force)),
              y: Math.max(60, Math.min(SVG_SIZE - 60, b.y + ny * force)),
            };
            moved = true;
          }
        }
      }
      if (!moved) break;
    }
    return positions;
  }, [regionPositions]);

  // Recent event regions (glow effect)
  const recentEventRegions = useMemo(() => {
    const recent = events.filter(
      (e) => e.day >= currentDay - 1 && e.day <= currentDay
    );
    const regionIds = new Set<string>();
    recent.forEach((e) =>
      e.regions_affected.forEach((r) => regionIds.add(r))
    );
    return regionIds;
  }, [events, currentDay]);

  // Pan handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      setDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY, vx: viewBox.x, vy: viewBox.y });
    },
    [viewBox]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const scaleX = viewBox.w / rect.width;
      const scaleY = viewBox.h / rect.height;
      const dx = (e.clientX - dragStart.x) * scaleX;
      const dy = (e.clientY - dragStart.y) * scaleY;
      setViewBox((prev) => ({
        ...prev,
        x: dragStart.vx - dx,
        y: dragStart.vy - dy,
      }));
    },
    [dragging, dragStart, viewBox.w, viewBox.h]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  // Zoom handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    setViewBox((prev) => {
      const newW = Math.max(200, Math.min(SVG_SIZE * 2, prev.w * factor));
      const newH = Math.max(200, Math.min(SVG_SIZE * 2, prev.h * factor));
      const cx = prev.x + prev.w / 2;
      const cy = prev.y + prev.h / 2;
      return {
        x: cx - newW / 2,
        y: cy - newH / 2,
        w: newW,
        h: newH,
      };
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => e.preventDefault();
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const handleRegionClick = useCallback(
    (region: Region) => {
      setSelectedRegion((prev) => (prev?.id === region.id ? null : region));
    },
    []
  );

  const regionCharacters = useMemo(() => {
    if (!selectedRegion) return [];
    return characters.filter((c) => c.location === selectedRegion.id);
  }, [selectedRegion, characters]);

  return (
    <div className="flex gap-4">
      <div className="flex-1">
        <div
          ref={containerRef}
          className="relative bg-gray-900 rounded-xl border border-gray-800 overflow-hidden"
          style={{ cursor: dragging ? 'grabbing' : 'grab' }}
        >
          {/* Subtle grid background */}
          <svg
            ref={svgRef}
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
            className="w-full"
            style={{ height: '600px' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            <defs>
              {/* Grid pattern */}
              <pattern
                id="grid"
                width="50"
                height="50"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 50 0 L 0 0 0 50"
                  fill="none"
                  stroke="#1f2937"
                  strokeWidth="0.5"
                />
              </pattern>
              {/* Glow filter */}
              <filter id="glow">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              {/* Region drop shadow */}
              <filter id="regionShadow">
                <feDropShadow
                  dx="0"
                  dy="2"
                  stdDeviation="3"
                  floodColor="#000"
                  floodOpacity="0.5"
                />
              </filter>
            </defs>

            {/* Grid background */}
            <rect
              x={viewBox.x - 100}
              y={viewBox.y - 100}
              width={viewBox.w + 200}
              height={viewBox.h + 200}
              fill="url(#grid)"
            />

            {/* Connections */}
            {connections.map((conn, i) => {
              const from = adjustedPositions[conn.from_region];
              const to = adjustedPositions[conn.to_region];
              if (!from || !to) return null;
              const isContested = conn.control === 'contested';
              return (
                <line
                  key={`conn-${i}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="#374151"
                  strokeWidth="2"
                  strokeDasharray={isContested ? '8 4' : 'none'}
                  opacity={0.6}
                />
              );
            })}

            {/* Region nodes */}
            {regions.map((region) => {
              const pos = adjustedPositions[region.id];
              if (!pos) return null;
              const color = getRegionColor(region, factionMap);
              const isSelected = selectedRegion?.id === region.id;
              const isRecent = recentEventRegions.has(region.id);

              return (
                <g
                  key={region.id}
                  onClick={() => handleRegionClick(region)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Glow for recent events */}
                  {isRecent && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={REGION_RADIUS + 12}
                      fill="none"
                      stroke={color}
                      strokeWidth="2"
                      opacity={0.4}
                      className="animate-pulse"
                    />
                  )}

                  {/* Selection ring */}
                  {isSelected && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={REGION_RADIUS + 6}
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="2.5"
                      strokeDasharray="6 3"
                    />
                  )}

                  {/* Region circle */}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={REGION_RADIUS}
                    fill={color}
                    fillOpacity={0.2}
                    stroke={color}
                    strokeWidth={isSelected ? 3 : 2}
                    filter="url(#regionShadow)"
                  />

                  {/* Inner highlight */}
                  <circle
                    cx={pos.x}
                    cy={pos.y - 8}
                    r={REGION_RADIUS * 0.55}
                    fill={color}
                    fillOpacity={0.08}
                  />

                  {/* Region type icon in center */}
                  <text
                    x={pos.x}
                    y={pos.y + 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="14"
                    fill={color}
                    fontWeight="bold"
                    opacity={0.7}
                  >
                    {region.type === 'mountain'
                      ? '\u25B2'
                      : region.type === 'forest'
                      ? '\u2663'
                      : region.type === 'desert'
                      ? '\u2600'
                      : region.type === 'coast'
                      ? '\u223C'
                      : region.type === 'plains'
                      ? '\u2261'
                      : region.type === 'swamp'
                      ? '\u2248'
                      : '\u25CF'}
                  </text>

                  {/* Resource dots */}
                  {region.resources.slice(0, 4).map((res, ri) => {
                    const angle =
                      ((ri - (region.resources.length - 1) / 2) * Math.PI) / 6 -
                      Math.PI / 2;
                    const rx = pos.x + Math.cos(angle) * (REGION_RADIUS + 16);
                    const ry = pos.y + Math.sin(angle) * (REGION_RADIUS + 16);
                    return (
                      <circle
                        key={`res-${ri}`}
                        cx={rx}
                        cy={ry}
                        r={4}
                        fill={RESOURCE_COLORS[res.toLowerCase()] || '#6b7280'}
                        opacity={0.8}
                      />
                    );
                  })}

                  {/* Region name */}
                  <text
                    x={pos.x}
                    y={pos.y + REGION_RADIUS + 18}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#d1d5db"
                    fontWeight="600"
                  >
                    {region.name}
                  </text>
                </g>
              );
            })}

            {/* Event markers overlay */}
            <MapEventMarkers
              events={events}
              regionPositions={adjustedPositions}
            />
          </svg>

          {/* Zoom controls */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-1">
            <button
              onClick={() =>
                setViewBox((prev) => {
                  const f = 0.8;
                  const newW = Math.max(200, prev.w * f);
                  const newH = Math.max(200, prev.h * f);
                  return {
                    x: prev.x + (prev.w - newW) / 2,
                    y: prev.y + (prev.h - newH) / 2,
                    w: newW,
                    h: newH,
                  };
                })
              }
              className="w-8 h-8 bg-gray-800 border border-gray-700 rounded text-gray-300 hover:bg-gray-700 flex items-center justify-center text-lg"
            >
              +
            </button>
            <button
              onClick={() =>
                setViewBox((prev) => {
                  const f = 1.2;
                  const newW = Math.min(SVG_SIZE * 2, prev.w * f);
                  const newH = Math.min(SVG_SIZE * 2, prev.h * f);
                  return {
                    x: prev.x + (prev.w - newW) / 2,
                    y: prev.y + (prev.h - newH) / 2,
                    w: newW,
                    h: newH,
                  };
                })
              }
              className="w-8 h-8 bg-gray-800 border border-gray-700 rounded text-gray-300 hover:bg-gray-700 flex items-center justify-center text-lg"
            >
              -
            </button>
            <button
              onClick={() =>
                setViewBox({ x: 0, y: 0, w: SVG_SIZE, h: SVG_SIZE })
              }
              className="w-8 h-8 bg-gray-800 border border-gray-700 rounded text-gray-300 hover:bg-gray-700 flex items-center justify-center text-xs"
            >
              R
            </button>
          </div>

          {/* Legend */}
          <div className="absolute top-4 left-4 bg-gray-900/90 backdrop-blur-sm border border-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">
              Factions
            </p>
            <div className="space-y-1.5">
              {Object.entries(factionMap).map(([fid, f]) => (
                <div key={fid} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: f.color }}
                  />
                  <span className="text-xs text-gray-300">{f.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Region detail panel */}
      <AnimatePresence>
        {selectedRegion && (
          <motion.div
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 50, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-80 flex-shrink-0"
          >
            <RegionDetail
              region={selectedRegion}
              factionMap={factionMap}
              characters={regionCharacters}
              onClose={() => setSelectedRegion(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
