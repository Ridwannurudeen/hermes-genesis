import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';
import type { WorldEvent, Character, Faction } from '../types';
import { EVENT_TYPE_ICONS } from '../types';

interface Props {
  events: WorldEvent[];
  characters: Character[];
  factions: Faction[];
  factionMap: Record<string, { name: string; color: string }>;
  currentDay: number;
}

/* ── Scene backgrounds per event type ────────────────────────── */
const SCENE_CONFIG: Record<string, { bg: string; accent: string; emoji: string; label: string }> = {
  military_conflict: {
    bg: 'radial-gradient(ellipse at 50% 30%, #3b1111 0%, #1a0505 50%, #0a0202 100%)',
    accent: '#ef4444',
    emoji: '\u2694\uFE0F',
    label: 'The Battlefield',
  },
  betrayal: {
    bg: 'radial-gradient(ellipse at 50% 30%, #1e1133 0%, #0d0820 50%, #050310 100%)',
    accent: '#a855f7',
    emoji: '\uD83D\uDDE1\uFE0F',
    label: 'The Shadow Court',
  },
  political_intrigue: {
    bg: 'radial-gradient(ellipse at 50% 30%, #1a1a2e 0%, #0d0d1a 50%, #06060d 100%)',
    accent: '#6366f1',
    emoji: '\uD83C\uDFAD',
    label: 'The Throne Room',
  },
  alliance: {
    bg: 'radial-gradient(ellipse at 50% 30%, #1a2e1a 0%, #0d1a0d 50%, #060d06 100%)',
    accent: '#22c55e',
    emoji: '\uD83E\uDD1D',
    label: 'The Great Hall',
  },
  discovery: {
    bg: 'radial-gradient(ellipse at 50% 30%, #0d1a2e 0%, #060d1a 50%, #03060d 100%)',
    accent: '#3b82f6',
    emoji: '\uD83D\uDD0D',
    label: 'The Observatory',
  },
  succession: {
    bg: 'radial-gradient(ellipse at 50% 30%, #2e2a0d 0%, #1a180a 50%, #0d0c05 100%)',
    accent: '#f59e0b',
    emoji: '\uD83D\uDC51',
    label: 'The Coronation',
  },
  cultural_shift: {
    bg: 'radial-gradient(ellipse at 50% 30%, #0d2e2e 0%, #0a1a1a 50%, #050d0d 100%)',
    accent: '#06b6d4',
    emoji: '\uD83C\uDF0A',
    label: 'The Forum',
  },
  natural_disaster: {
    bg: 'radial-gradient(ellipse at 50% 30%, #2e1a0d 0%, #1a0d05 50%, #0d0602 100%)',
    accent: '#f97316',
    emoji: '\uD83C\uDF0B',
    label: 'The Cataclysm',
  },
  death: {
    bg: 'radial-gradient(ellipse at 50% 30%, #111111 0%, #080808 50%, #030303 100%)',
    accent: '#6b7280',
    emoji: '\uD83D\uDC80',
    label: 'The Memorial',
  },
  birth: {
    bg: 'radial-gradient(ellipse at 50% 30%, #1a1a0d 0%, #141405 50%, #0a0a02 100%)',
    accent: '#eab308',
    emoji: '\u2728',
    label: 'The Dawn',
  },
  divine_intervention: {
    bg: 'radial-gradient(ellipse at 50% 30%, #1a0d2e 0%, #0d051a 50%, #06020d 100%)',
    accent: '#d946ef',
    emoji: '\u26A1',
    label: 'The Sanctum',
  },
  agent_intervention: {
    bg: 'radial-gradient(ellipse at 50% 30%, #0d1a2e 0%, #050d1a 50%, #02060d 100%)',
    accent: '#06b6d4',
    emoji: '\uD83E\uDDE0',
    label: 'The Unseen Hand',
  },
  prophecy_fulfilled: {
    bg: 'radial-gradient(ellipse at 50% 30%, #2e1a2e 0%, #1a0d1a 50%, #0d050d 100%)',
    accent: '#f59e0b',
    emoji: '\uD83D\uDD2E',
    label: 'The Prophecy',
  },
};

const DEFAULT_SCENE = {
  bg: 'radial-gradient(ellipse at 50% 30%, #111827 0%, #0a0f1a 50%, #050810 100%)',
  accent: '#9ca3af',
  emoji: '\u2728',
  label: 'The Stage',
};

function getScene(eventType?: string) {
  if (!eventType) return DEFAULT_SCENE;
  return SCENE_CONFIG[eventType] || DEFAULT_SCENE;
}

/* ── Character position calculator ───────────────────────────── */
function computePositions(
  chars: Character[],
  activeIds: Set<string>,
  factions: Faction[],
): Record<string, { x: number; y: number; scale: number }> {
  const positions: Record<string, { x: number; y: number; scale: number }> = {};

  // Group characters by faction
  const factionGroups: Record<string, Character[]> = {};
  chars.forEach((c) => {
    if (!factionGroups[c.faction_id]) factionGroups[c.faction_id] = [];
    factionGroups[c.faction_id].push(c);
  });

  const factionIds = Object.keys(factionGroups);
  const activeChars = chars.filter((c) => activeIds.has(c.id));
  const inactiveChars = chars.filter((c) => !activeIds.has(c.id));

  // Active characters: center stage, spaced evenly
  activeChars.forEach((c, i) => {
    const total = activeChars.length;
    const spread = Math.min(60, 80 / Math.max(total, 1));
    const centerX = 50;
    const x = centerX + (i - (total - 1) / 2) * spread / (total > 1 ? 1 : 1);
    positions[c.id] = {
      x: Math.max(10, Math.min(90, x)),
      y: 50,
      scale: 1.2,
    };
  });

  // Inactive characters: arranged in arcs by faction along the edges
  const inactivePerFaction: Record<string, Character[]> = {};
  inactiveChars.forEach((c) => {
    if (!inactivePerFaction[c.faction_id]) inactivePerFaction[c.faction_id] = [];
    inactivePerFaction[c.faction_id].push(c);
  });

  const inactiveFactionIds = Object.keys(inactivePerFaction);
  inactiveFactionIds.forEach((fid, fi) => {
    const group = inactivePerFaction[fid];
    // Distribute faction groups around the stage edges
    const isLeft = fi % 2 === 0;
    const baseX = isLeft ? 8 + (fi / 2) * 12 : 92 - (Math.floor(fi / 2)) * 12;
    group.forEach((c, ci) => {
      const y = 25 + (ci / Math.max(group.length - 1, 1)) * 55;
      positions[c.id] = {
        x: Math.max(5, Math.min(95, baseX)),
        y: Math.max(15, Math.min(85, y)),
        scale: 0.8,
      };
    });
  });

  return positions;
}

/* ── hex to RGB helper ───────────────────────────────────────── */
function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `${r},${g},${b}`;
}

export default function TheaterMode({
  events,
  characters,
  factions,
  factionMap,
  currentDay,
}: Props) {
  const [eventIndex, setEventIndex] = useState<number | null>(
    events.length > 0 ? events.length - 1 : null,
  );
  const [autoPlay, setAutoPlay] = useState(false);
  const autoPlayRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const aliveChars = useMemo(
    () => characters.filter((c) => c.alive).slice(0, 30), // cap for performance
    [characters],
  );

  const currentEvent = eventIndex !== null ? events[eventIndex] : null;
  const scene = getScene(currentEvent?.type);

  // Active character IDs for current event
  const activeCharIds = useMemo(() => {
    if (!currentEvent) return new Set<string>();
    return new Set(currentEvent.actors || []);
  }, [currentEvent]);

  // Character positions
  const positions = useMemo(
    () => computePositions(aliveChars, activeCharIds, factions),
    [aliveChars, activeCharIds, factions],
  );

  // Build faction color lookup
  const charFactionColor = useCallback(
    (factionId: string) => factionMap[factionId]?.color || '#6b7280',
    [factionMap],
  );

  // Auto-play logic
  useEffect(() => {
    autoPlayRef.current = autoPlay;
  }, [autoPlay]);

  useEffect(() => {
    if (!autoPlay || events.length === 0) return;

    const tick = () => {
      if (!autoPlayRef.current) return;
      setEventIndex((prev) => {
        if (prev === null) return 0;
        const next = prev + 1;
        if (next >= events.length) {
          setAutoPlay(false);
          return prev;
        }
        return next;
      });
      timerRef.current = setTimeout(tick, 5000);
    };

    timerRef.current = setTimeout(tick, 5000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [autoPlay, events.length]);

  const goNext = useCallback(() => {
    setEventIndex((prev) => {
      if (prev === null) return events.length > 0 ? 0 : null;
      return Math.min(prev + 1, events.length - 1);
    });
  }, [events.length]);

  const goPrev = useCallback(() => {
    setEventIndex((prev) => {
      if (prev === null) return null;
      return Math.max(prev - 1, 0);
    });
  }, []);

  const eventIcon = currentEvent
    ? EVENT_TYPE_ICONS[currentEvent.type] || '\u2728'
    : '\u2728';

  if (aliveChars.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 flex items-center justify-center h-[600px]">
        <p className="text-gray-500">No living characters to display</p>
      </div>
    );
  }

  return (
    <div className="relative select-none">
      {/* ── Stage Area ───────────────────────────────────────── */}
      <div
        className="relative rounded-xl overflow-hidden"
        style={{
          height: 600,
          background: scene.bg,
          transition: 'background 1.5s ease',
        }}
      >
        {/* Atmospheric particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: 2 + (i % 3),
                height: 2 + (i % 3),
                backgroundColor: scene.accent,
                opacity: 0.1 + (i % 5) * 0.04,
                left: `${(i * 37 + 13) % 100}%`,
                top: `${(i * 53 + 7) % 100}%`,
                animation: `float-particle ${6 + (i % 4) * 2}s ease-in-out infinite`,
                animationDelay: `${i * 0.3}s`,
              }}
            />
          ))}
        </div>

        {/* Stage floor gradient */}
        <div
          className="absolute bottom-0 left-0 right-0 pointer-events-none"
          style={{
            height: '40%',
            background: `linear-gradient(to top, rgba(${hexToRgb(scene.accent)},0.06) 0%, transparent 100%)`,
            transition: 'background 1.5s ease',
          }}
        />

        {/* Vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)',
          }}
        />

        {/* Scene label */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={scene.label}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <span
                className="text-xs uppercase tracking-[0.3em] font-medium px-4 py-1.5 rounded-full border backdrop-blur-sm"
                style={{
                  color: scene.accent,
                  borderColor: `${scene.accent}30`,
                  backgroundColor: `rgba(0,0,0,0.4)`,
                }}
              >
                {scene.emoji} {scene.label}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Day indicator */}
        <div className="absolute top-4 right-5 z-10 text-right">
          <p className="text-[10px] text-white/30 uppercase tracking-widest">Day</p>
          <p className="text-lg font-mono font-bold text-white/50">
            {currentEvent?.day || currentDay}
          </p>
        </div>

        {/* ── Character Sprites ────────────────────────────── */}
        <div className="absolute inset-0">
          <AnimatePresence>
            {aliveChars.map((char) => {
              const pos = positions[char.id];
              if (!pos) return null;
              const isActive = activeCharIds.has(char.id);
              const color = charFactionColor(char.faction_id);
              const rgb = hexToRgb(color);
              const size = Math.round(40 + char.fitness * 20);

              return (
                <motion.div
                  key={char.id}
                  layout
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{
                    opacity: isActive ? 1 : (currentEvent ? 0.2 : 0.7),
                    scale: pos.scale,
                    x: `calc(${pos.x}vw * 0.65 + 5%)`,
                    y: `calc(${pos.y}% - ${size / 2}px)`,
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 120,
                    damping: 20,
                    mass: 0.8,
                  }}
                  className="absolute flex flex-col items-center"
                  style={{ zIndex: isActive ? 20 : 10 }}
                >
                  {/* Spotlight glow for active characters */}
                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute rounded-full"
                      style={{
                        width: size * 3,
                        height: size * 3,
                        top: -(size),
                        left: -(size),
                        background: `radial-gradient(circle, rgba(${rgb},0.15) 0%, rgba(${rgb},0.05) 40%, transparent 70%)`,
                      }}
                    />
                  )}

                  {/* Character circle */}
                  <div
                    className="rounded-full flex items-center justify-center font-bold text-white relative"
                    style={{
                      width: size,
                      height: size,
                      backgroundColor: `rgba(${rgb},0.2)`,
                      border: `2px solid ${color}`,
                      boxShadow: isActive
                        ? `0 0 20px rgba(${rgb},0.4), 0 0 40px rgba(${rgb},0.2)`
                        : `0 0 8px rgba(${rgb},0.15)`,
                      fontSize: size * 0.35,
                      transition: 'box-shadow 0.5s ease',
                    }}
                  >
                    {char.name.charAt(0)}

                    {/* Breathing animation ring */}
                    {!currentEvent && (
                      <div
                        className="absolute inset-0 rounded-full"
                        style={{
                          border: `1px solid rgba(${rgb},0.3)`,
                          animation: 'breathe 3s ease-in-out infinite',
                          animationDelay: `${(char.name.charCodeAt(0) % 5) * 0.6}s`,
                        }}
                      />
                    )}
                  </div>

                  {/* Name label */}
                  <span
                    className="mt-1 text-[10px] font-medium whitespace-nowrap max-w-[80px] truncate"
                    style={{
                      color: isActive ? color : 'rgba(255,255,255,0.4)',
                      textShadow: isActive
                        ? `0 0 8px rgba(${rgb},0.5)`
                        : 'none',
                      transition: 'color 0.5s, text-shadow 0.5s',
                    }}
                  >
                    {char.name}
                  </span>

                  {/* Role tag for active characters */}
                  {isActive && (
                    <motion.span
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[8px] uppercase tracking-wider mt-0.5"
                      style={{ color: `rgba(${rgb},0.6)` }}
                    >
                      {char.role}
                    </motion.span>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* ── Event Narrative Overlay ─────────────────────── */}
        <AnimatePresence mode="wait">
          {currentEvent && (
            <motion.div
              key={currentEvent.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 w-full max-w-2xl px-6"
            >
              <div
                className="rounded-xl px-6 py-4 backdrop-blur-md border"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  borderColor: `rgba(${hexToRgb(scene.accent)},0.2)`,
                }}
              >
                {/* Event icon + title */}
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{eventIcon}</span>
                  <h3
                    className="text-lg font-bold"
                    style={{ color: scene.accent }}
                  >
                    {currentEvent.title}
                  </h3>
                </div>

                {/* Narrative text */}
                {currentEvent.narrative && (
                  <p className="text-sm text-white/70 leading-relaxed italic">
                    {currentEvent.narrative.length > 250
                      ? currentEvent.narrative.slice(0, 250) + '...'
                      : currentEvent.narrative}
                  </p>
                )}

                {/* Factions involved */}
                {currentEvent.factions_involved.length > 0 && (
                  <div className="flex gap-2 mt-3">
                    {currentEvent.factions_involved.map((fid) => {
                      const f = factionMap[fid];
                      if (!f) return null;
                      return (
                        <span
                          key={fid}
                          className="text-[10px] px-2 py-0.5 rounded-full border font-medium"
                          style={{
                            color: f.color,
                            borderColor: `${f.color}40`,
                            backgroundColor: `${f.color}10`,
                          }}
                        >
                          {f.name}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── No Events State ────────────────────────────── */}
        {events.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-center">
              <p className="text-3xl mb-2">{'\uD83C\uDFAD'}</p>
              <p className="text-white/40 text-sm">
                The stage awaits. Simulate days to begin the drama.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Controls Bar ─────────────────────────────────── */}
      <div className="flex items-center justify-between mt-3 px-2">
        {/* Event navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            disabled={eventIndex === null || eventIndex <= 0}
            className="p-2 rounded-lg bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            onClick={() => setAutoPlay((p) => !p)}
            disabled={events.length === 0}
            className={`p-2 rounded-lg border transition-colors ${
              autoPlay
                ? 'bg-genesis-600/20 border-genesis-500/40 text-genesis-400'
                : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white hover:border-gray-600'
            } disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            {autoPlay ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={goNext}
            disabled={eventIndex === null || eventIndex >= events.length - 1}
            className="p-2 rounded-lg bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Event counter */}
        <div className="text-xs text-gray-500 font-mono">
          {eventIndex !== null ? (
            <>
              Event {eventIndex + 1} / {events.length}
            </>
          ) : (
            <>{events.length} events</>
          )}
        </div>

        {/* Faction legend */}
        <div className="flex items-center gap-3">
          {factions.slice(0, 6).map((f) => (
            <div key={f.id} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  backgroundColor: f.color,
                  boxShadow: `0 0 4px ${f.color}40`,
                }}
              />
              <span className="text-[10px] text-gray-500">{f.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── CSS Animations ───────────────────────────────── */}
      <style>{`
        @keyframes float-particle {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.1; }
          25% { transform: translateY(-20px) translateX(10px); opacity: 0.2; }
          50% { transform: translateY(-10px) translateX(-5px); opacity: 0.15; }
          75% { transform: translateY(-30px) translateX(15px); opacity: 0.1; }
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.15); opacity: 0.1; }
        }
      `}</style>
    </div>
  );
}
