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

// Terrain type to symbol mapping with larger, bolder icons
const TERRAIN_ICONS: Record<string, string> = {
  mountain: '\u26F0',
  forest: '\u{1F332}',
  desert: '\u{1F3DC}',
  coast: '\u{1F30A}',
  plains: '\u{1F33E}',
  swamp: '\u{1F9DF}',
  tundra: '\u2744',
  volcanic: '\u{1F30B}',
  jungle: '\u{1F334}',
  lake: '\u{1F4A7}',
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
  return 80 + val * (SVG_SIZE - 160);
}

/** Convert hex color to RGB components */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

/** Blend two hex colors */
function blendColors(c1: string, c2: string, ratio = 0.5): string {
  const a = hexToRgb(c1);
  const b = hexToRgb(c2);
  const r = Math.round(a.r * (1 - ratio) + b.r * ratio);
  const g = Math.round(a.g * (1 - ratio) + b.g * ratio);
  const bl = Math.round(a.b * (1 - ratio) + b.b * ratio);
  return `rgb(${r},${g},${bl})`;
}

/** Generate deterministic "stars" for the background */
function generateStars(count: number, seed: number): Array<{ x: number; y: number; r: number; o: number }> {
  const stars: Array<{ x: number; y: number; r: number; o: number }> = [];
  let s = seed;
  const next = () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
  for (let i = 0; i < count; i++) {
    stars.push({
      x: next() * (SVG_SIZE + 400) - 200,
      y: next() * (SVG_SIZE + 400) - 200,
      r: 0.3 + next() * 1.5,
      o: 0.1 + next() * 0.5,
    });
  }
  return stars;
}

const STARS = generateStars(200, 42);

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

  // Check if regions are too clustered and apply repulsion
  const adjustedPositions = useMemo(() => {
    const positions = { ...regionPositions };
    const ids = Object.keys(positions);

    for (let iter = 0; iter < 15; iter++) {
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

  // Build faction -> region mapping for territory zones
  const factionTerritoryZones = useMemo(() => {
    const zones: Record<string, Array<{ x: number; y: number }>> = {};
    regions.forEach((r) => {
      if (r.controlled_by) {
        if (!zones[r.controlled_by]) zones[r.controlled_by] = [];
        const pos = adjustedPositions[r.id];
        if (pos) zones[r.controlled_by].push(pos);
      }
    });
    return zones;
  }, [regions, adjustedPositions]);

  // Unique filter IDs for each faction color
  const factionColorIds = useMemo(() => {
    const ids: Record<string, string> = {};
    Object.entries(factionMap).forEach(([fid, f]) => {
      ids[fid] = `glow-${fid.replace(/[^a-zA-Z0-9]/g, '')}`;
    });
    return ids;
  }, [factionMap]);

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

  // Compute connection info with faction colors
  const connectionData = useMemo(() => {
    return connections.map((conn) => {
      const from = adjustedPositions[conn.from_region];
      const to = adjustedPositions[conn.to_region];
      if (!from || !to) return null;

      const fromRegion = regions.find((r) => r.id === conn.from_region);
      const toRegion = regions.find((r) => r.id === conn.to_region);
      const fromColor = fromRegion ? getRegionColor(fromRegion, factionMap) : '#374151';
      const toColor = toRegion ? getRegionColor(toRegion, factionMap) : '#374151';
      const isContested = conn.control === 'contested';

      return { conn, from, to, fromColor, toColor, isContested };
    }).filter(Boolean) as Array<{
      conn: Connection;
      from: { x: number; y: number };
      to: { x: number; y: number };
      fromColor: string;
      toColor: string;
      isContested: boolean;
    }>;
  }, [connections, adjustedPositions, regions, factionMap]);

  // Population strength per region (based on faction data)
  const regionStrength = useMemo(() => {
    const strength: Record<string, number> = {};
    regions.forEach((r) => {
      // Use resource count as proxy for strength (0-1 range)
      const s = Math.min(1, (r.resources.length + 1) / 6);
      strength[r.id] = s;
    });
    return strength;
  }, [regions]);

  return (
    <div className="flex gap-4">
      <div className="flex-1">
        <div
          ref={containerRef}
          className="relative rounded-xl overflow-hidden"
          style={{
            cursor: dragging ? 'grabbing' : 'grab',
            background: 'radial-gradient(ellipse at center, #0f1729 0%, #070b14 60%, #020408 100%)',
            boxShadow: 'inset 0 0 100px rgba(0,0,0,0.8)',
          }}
        >
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
              {/* ===== ATMOSPHERIC BACKGROUND ===== */}
              {/* Dark cosmic void gradient */}
              <radialGradient id="bg-void" cx="50%" cy="50%" r="70%">
                <stop offset="0%" stopColor="#0f1729" />
                <stop offset="40%" stopColor="#0a1020" />
                <stop offset="70%" stopColor="#060c18" />
                <stop offset="100%" stopColor="#020408" />
              </radialGradient>

              {/* Parchment texture overlay */}
              <filter id="parchment-noise" x="0%" y="0%" width="100%" height="100%">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.65"
                  numOctaves="3"
                  stitchTiles="stitch"
                  result="noise"
                />
                <feColorMatrix
                  in="noise"
                  type="saturate"
                  values="0"
                  result="grayNoise"
                />
                <feComponentTransfer in="grayNoise" result="dimNoise">
                  <feFuncA type="linear" slope="0.04" />
                </feComponentTransfer>
                <feBlend in="SourceGraphic" in2="dimNoise" mode="overlay" />
              </filter>

              {/* ===== FOG / MIST EFFECT ===== */}
              <filter id="fog" x="-20%" y="-20%" width="140%" height="140%">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.012"
                  numOctaves="4"
                  seed="7"
                  result="fogNoise"
                />
                <feColorMatrix
                  in="fogNoise"
                  type="saturate"
                  values="0"
                  result="grayFog"
                />
                <feComponentTransfer in="grayFog" result="alphaFog">
                  <feFuncA type="linear" slope="0.15" intercept="-0.02" />
                </feComponentTransfer>
                <feFlood floodColor="#1a2744" floodOpacity="1" result="fogColor" />
                <feComposite in="fogColor" in2="alphaFog" operator="in" result="tintedFog" />
                <feGaussianBlur in="tintedFog" stdDeviation="20" result="blurredFog" />
              </filter>

              {/* Second fog layer for more depth */}
              <filter id="fog2" x="-20%" y="-20%" width="140%" height="140%">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.008"
                  numOctaves="3"
                  seed="42"
                  result="fogNoise2"
                />
                <feColorMatrix
                  in="fogNoise2"
                  type="saturate"
                  values="0"
                  result="grayFog2"
                />
                <feComponentTransfer in="grayFog2" result="alphaFog2">
                  <feFuncA type="linear" slope="0.08" intercept="0" />
                </feComponentTransfer>
                <feFlood floodColor="#0d1b2a" floodOpacity="1" result="fogColor2" />
                <feComposite in="fogColor2" in2="alphaFog2" operator="in" result="tintedFog2" />
                <feGaussianBlur in="tintedFog2" stdDeviation="35" result="blurredFog2" />
              </filter>

              {/* ===== VIGNETTE OVERLAY ===== */}
              <radialGradient id="vignette" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor="transparent" />
                <stop offset="60%" stopColor="transparent" />
                <stop offset="100%" stopColor="#020408" stopOpacity="0.85" />
              </radialGradient>

              {/* ===== NODE FILTERS ===== */}
              {/* Per-faction glow filters */}
              {Object.entries(factionMap).map(([fid, f]) => (
                <filter key={fid} id={factionColorIds[fid]} x="-80%" y="-80%" width="260%" height="260%">
                  <feFlood floodColor={f.color} floodOpacity="0.6" result="glowColor" />
                  <feComposite in="glowColor" in2="SourceAlpha" operator="in" result="coloredShape" />
                  <feGaussianBlur in="coloredShape" stdDeviation="8" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              ))}

              {/* Neutral glow for uncontrolled regions */}
              <filter id="glow-neutral" x="-80%" y="-80%" width="260%" height="260%">
                <feFlood floodColor="#6b7280" floodOpacity="0.4" result="glowColor" />
                <feComposite in="glowColor" in2="SourceAlpha" operator="in" result="coloredShape" />
                <feGaussianBlur in="coloredShape" stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Region drop shadow */}
              <filter id="regionShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow
                  dx="0"
                  dy="3"
                  stdDeviation="5"
                  floodColor="#000"
                  floodOpacity="0.7"
                />
              </filter>

              {/* Per-faction radial gradients for region fill */}
              {Object.entries(factionMap).map(([fid, f]) => {
                const rgb = hexToRgb(f.color);
                return (
                  <radialGradient key={`rg-${fid}`} id={`region-fill-${fid.replace(/[^a-zA-Z0-9]/g, '')}`} cx="40%" cy="35%" r="65%">
                    <stop offset="0%" stopColor={`rgba(${rgb.r},${rgb.g},${rgb.b},0.45)`} />
                    <stop offset="50%" stopColor={`rgba(${rgb.r},${rgb.g},${rgb.b},0.2)`} />
                    <stop offset="100%" stopColor={`rgba(${rgb.r},${rgb.g},${rgb.b},0.05)`} />
                  </radialGradient>
                );
              })}

              <radialGradient id="region-fill-neutral" cx="40%" cy="35%" r="65%">
                <stop offset="0%" stopColor="rgba(107,114,128,0.35)" />
                <stop offset="50%" stopColor="rgba(107,114,128,0.15)" />
                <stop offset="100%" stopColor="rgba(107,114,128,0.03)" />
              </radialGradient>

              {/* Animated connection dash pattern */}
              <style>{`
                @keyframes dash-flow {
                  to { stroke-dashoffset: -24; }
                }
                @keyframes contested-pulse {
                  0%, 100% { stroke-opacity: 0.3; }
                  50% { stroke-opacity: 0.8; }
                }
                @keyframes star-twinkle {
                  0%, 100% { opacity: var(--star-o); }
                  50% { opacity: 0.05; }
                }
                @keyframes territory-breathe {
                  0%, 100% { opacity: 0.08; }
                  50% { opacity: 0.14; }
                }
                @keyframes event-glow-pulse {
                  0%, 100% { r: ${REGION_RADIUS + 14}; opacity: 0.3; }
                  50% { r: ${REGION_RADIUS + 20}; opacity: 0.6; }
                }
                @keyframes selection-rotate {
                  to { stroke-dashoffset: -18; }
                }
                .conn-line {
                  animation: dash-flow 2s linear infinite;
                }
                .contested-line {
                  animation: contested-pulse 1.2s ease-in-out infinite;
                }
                .territory-zone {
                  animation: territory-breathe 6s ease-in-out infinite;
                }
                .selection-ring {
                  animation: selection-rotate 1.5s linear infinite;
                }
              `}</style>

              {/* Connection gradient definitions */}
              {connectionData.map((cd, i) => (
                <linearGradient
                  key={`conn-grad-${i}`}
                  id={`conn-grad-${i}`}
                  x1={cd.from.x}
                  y1={cd.from.y}
                  x2={cd.to.x}
                  y2={cd.to.y}
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor={cd.isContested ? '#ef4444' : cd.fromColor} stopOpacity="0.6" />
                  <stop offset="50%" stopColor={cd.isContested ? '#dc2626' : blendColors(cd.fromColor, cd.toColor)} stopOpacity="0.4" />
                  <stop offset="100%" stopColor={cd.isContested ? '#ef4444' : cd.toColor} stopOpacity="0.6" />
                </linearGradient>
              ))}
            </defs>

            {/* ===== LAYER 0: COSMIC VOID BACKGROUND ===== */}
            <rect
              x={viewBox.x - 200}
              y={viewBox.y - 200}
              width={viewBox.w + 400}
              height={viewBox.h + 400}
              fill="url(#bg-void)"
            />

            {/* ===== LAYER 1: STARS / PARTICLES ===== */}
            <g opacity={0.8}>
              {STARS.map((star, i) => (
                <circle
                  key={`star-${i}`}
                  cx={star.x}
                  cy={star.y}
                  r={star.r}
                  fill="#c8d6e5"
                  opacity={star.o}
                >
                  {i % 5 === 0 && (
                    <animate
                      attributeName="opacity"
                      values={`${star.o};${star.o * 0.2};${star.o}`}
                      dur={`${3 + (i % 4) * 1.5}s`}
                      repeatCount="indefinite"
                    />
                  )}
                </circle>
              ))}
            </g>

            {/* ===== LAYER 2: FOG / MIST ===== */}
            <rect
              x={viewBox.x - 200}
              y={viewBox.y - 200}
              width={viewBox.w + 400}
              height={viewBox.h + 400}
              fill="transparent"
              filter="url(#fog)"
              opacity={0.7}
            />
            <rect
              x={viewBox.x - 200}
              y={viewBox.y - 200}
              width={viewBox.w + 400}
              height={viewBox.h + 400}
              fill="transparent"
              filter="url(#fog2)"
              opacity={0.5}
            />

            {/* ===== LAYER 3: TERRITORY SHADING (Voronoi-like zones) ===== */}
            <g>
              {Object.entries(factionTerritoryZones).map(([fid, positions]) => {
                const color = factionMap[fid]?.color || '#6b7280';
                const rgb = hexToRgb(color);
                return positions.map((pos, i) => (
                  <g key={`tz-${fid}-${i}`}>
                    {/* Large translucent territory blob */}
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={REGION_RADIUS * 3.2}
                      fill={`rgba(${rgb.r},${rgb.g},${rgb.b},0.06)`}
                      className="territory-zone"
                    />
                    {/* Slightly smaller, slightly more opaque inner zone */}
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={REGION_RADIUS * 2.2}
                      fill={`rgba(${rgb.r},${rgb.g},${rgb.b},0.08)`}
                      className="territory-zone"
                      style={{ animationDelay: `${i * 0.8}s` }}
                    />
                  </g>
                ));
              })}
            </g>

            {/* ===== LAYER 4: CONNECTION LINES (animated trade routes) ===== */}
            <g>
              {connectionData.map((cd, i) => (
                <g key={`conn-${i}`}>
                  {/* Glow under the connection line */}
                  <line
                    x1={cd.from.x}
                    y1={cd.from.y}
                    x2={cd.to.x}
                    y2={cd.to.y}
                    stroke={cd.isContested ? '#ef4444' : blendColors(cd.fromColor, cd.toColor)}
                    strokeWidth="6"
                    strokeOpacity={0.08}
                    strokeLinecap="round"
                  />
                  {/* Main connection line */}
                  <line
                    x1={cd.from.x}
                    y1={cd.from.y}
                    x2={cd.to.x}
                    y2={cd.to.y}
                    stroke={`url(#conn-grad-${i})`}
                    strokeWidth={cd.isContested ? 2.5 : 1.8}
                    strokeDasharray={cd.isContested ? '6 4' : '8 16'}
                    strokeLinecap="round"
                    className={cd.isContested ? 'contested-line' : 'conn-line'}
                  />
                </g>
              ))}
            </g>

            {/* ===== LAYER 5: REGION NODES ===== */}
            {regions.map((region) => {
              const pos = adjustedPositions[region.id];
              if (!pos) return null;
              const color = getRegionColor(region, factionMap);
              const rgb = hexToRgb(color);
              const isSelected = selectedRegion?.id === region.id;
              const isRecent = recentEventRegions.has(region.id);
              const fid = region.controlled_by;
              const glowFilterId = fid && factionColorIds[fid] ? factionColorIds[fid] : 'glow-neutral';
              const fillGradientId = fid ? `region-fill-${fid.replace(/[^a-zA-Z0-9]/g, '')}` : 'region-fill-neutral';
              const strength = regionStrength[region.id] || 0.3;

              return (
                <g
                  key={region.id}
                  onClick={() => handleRegionClick(region)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Ambient outer glow (always visible, faction-colored) */}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={REGION_RADIUS + 10}
                    fill={`rgba(${rgb.r},${rgb.g},${rgb.b},0.08)`}
                    stroke="none"
                  />

                  {/* Pulsing glow for recent events */}
                  {isRecent && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={REGION_RADIUS + 14}
                      fill="none"
                      stroke={color}
                      strokeWidth="2.5"
                      opacity={0.5}
                    >
                      <animate
                        attributeName="r"
                        values={`${REGION_RADIUS + 14};${REGION_RADIUS + 22};${REGION_RADIUS + 14}`}
                        dur="2s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0.5;0.15;0.5"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}

                  {/* Selection ring (animated dashed) */}
                  {isSelected && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={REGION_RADIUS + 7}
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="2"
                      strokeDasharray="6 3"
                      className="selection-ring"
                      opacity={0.9}
                    />
                  )}

                  {/* Strength ring: outer ring proportional to control strength */}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={REGION_RADIUS + 2}
                    fill="none"
                    stroke={color}
                    strokeWidth={1 + strength * 3}
                    strokeOpacity={0.25 + strength * 0.3}
                  />

                  {/* Main region circle with radial gradient fill */}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={REGION_RADIUS}
                    fill={`url(#${fillGradientId})`}
                    stroke={color}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    strokeOpacity={0.8}
                    filter={`url(#${glowFilterId})`}
                  />

                  {/* Inner specular highlight */}
                  <ellipse
                    cx={pos.x - 5}
                    cy={pos.y - 10}
                    rx={REGION_RADIUS * 0.45}
                    ry={REGION_RADIUS * 0.3}
                    fill={color}
                    fillOpacity={0.06}
                  />

                  {/* Terrain type icon (large and prominent) */}
                  <text
                    x={pos.x}
                    y={pos.y + 1}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="22"
                    opacity={0.85}
                    style={{ pointerEvents: 'none' }}
                  >
                    {TERRAIN_ICONS[region.type] || '\u25CF'}
                  </text>

                  {/* Population indicator dots around the ring */}
                  {Array.from({ length: Math.max(2, Math.round(strength * 8)) }).map((_, di) => {
                    const totalDots = Math.max(2, Math.round(strength * 8));
                    const angle = (di / totalDots) * Math.PI * 2 - Math.PI / 2;
                    const dotX = pos.x + Math.cos(angle) * (REGION_RADIUS + 2);
                    const dotY = pos.y + Math.sin(angle) * (REGION_RADIUS + 2);
                    return (
                      <circle
                        key={`pop-${di}`}
                        cx={dotX}
                        cy={dotY}
                        r={1.2}
                        fill={color}
                        opacity={0.6}
                      />
                    );
                  })}

                  {/* Resource dots */}
                  {region.resources.slice(0, 4).map((res, ri) => {
                    const angle =
                      ((ri - (Math.min(region.resources.length, 4) - 1) / 2) * Math.PI) / 6 -
                      Math.PI / 2;
                    const rx = pos.x + Math.cos(angle) * (REGION_RADIUS + 18);
                    const ry = pos.y + Math.sin(angle) * (REGION_RADIUS + 18);
                    const resColor = RESOURCE_COLORS[res.toLowerCase()] || '#6b7280';
                    return (
                      <g key={`res-${ri}`}>
                        {/* Resource glow */}
                        <circle
                          cx={rx}
                          cy={ry}
                          r={6}
                          fill={resColor}
                          opacity={0.12}
                        />
                        {/* Resource dot */}
                        <circle
                          cx={rx}
                          cy={ry}
                          r={3.5}
                          fill={resColor}
                          opacity={0.85}
                          stroke={resColor}
                          strokeWidth={0.5}
                          strokeOpacity={0.4}
                        />
                      </g>
                    );
                  })}

                  {/* Region name with drop shadow */}
                  <text
                    x={pos.x}
                    y={pos.y + REGION_RADIUS + 20}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#0a0a0a"
                    fontWeight="600"
                    style={{ pointerEvents: 'none' }}
                  >
                    {region.name}
                  </text>
                  <text
                    x={pos.x}
                    y={pos.y + REGION_RADIUS + 20}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#e2e8f0"
                    fontWeight="600"
                    style={{ pointerEvents: 'none' }}
                  >
                    {region.name}
                  </text>
                </g>
              );
            })}

            {/* ===== LAYER 6: EVENT MARKERS ===== */}
            <MapEventMarkers
              events={events}
              regionPositions={adjustedPositions}
            />

            {/* ===== LAYER 7: VIGNETTE OVERLAY ===== */}
            <rect
              x={viewBox.x - 200}
              y={viewBox.y - 200}
              width={viewBox.w + 400}
              height={viewBox.h + 400}
              fill="url(#vignette)"
              style={{ pointerEvents: 'none' }}
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
              className="w-8 h-8 bg-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded text-gray-300 hover:bg-gray-700/80 hover:border-gray-500/50 flex items-center justify-center text-lg transition-all"
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
              className="w-8 h-8 bg-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded text-gray-300 hover:bg-gray-700/80 hover:border-gray-500/50 flex items-center justify-center text-lg transition-all"
            >
              -
            </button>
            <button
              onClick={() =>
                setViewBox({ x: 0, y: 0, w: SVG_SIZE, h: SVG_SIZE })
              }
              className="w-8 h-8 bg-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded text-gray-300 hover:bg-gray-700/80 hover:border-gray-500/50 flex items-center justify-center text-xs transition-all"
            >
              R
            </button>
          </div>

          {/* Legend */}
          <div className="absolute top-4 left-4 bg-[#1a1410]/80 backdrop-blur-md border border-gray-700/30 rounded-lg p-3 shadow-2xl">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-semibold">
              Factions
            </p>
            <div className="space-y-1.5">
              {Object.entries(factionMap).map(([fid, f]) => (
                <div key={fid} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full shadow-lg"
                    style={{
                      backgroundColor: f.color,
                      boxShadow: `0 0 6px ${f.color}60`,
                    }}
                  />
                  <span className="text-xs text-gray-300 font-medium">{f.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Map title watermark */}
          <div className="absolute bottom-4 left-4 text-gray-600/30 text-[10px] uppercase tracking-[0.3em] font-light select-none">
            Genesis World Map
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
