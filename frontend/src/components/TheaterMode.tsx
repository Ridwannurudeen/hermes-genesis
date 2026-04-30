import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Play, Pause, SkipForward, SkipBack } from 'lucide-react';
import type { WorldEvent, Character, Faction } from '../types';
import { EVENT_TYPE_ICONS } from '../types';
import { api } from '../api';
import { useAmbientSound } from '../hooks/useAmbientSound';

interface Props {
  events: WorldEvent[];
  characters: Character[];
  factions: Faction[];
  factionMap: Record<string, { name: string; color: string }>;
  currentDay: number;
  ambientEnabled?: boolean;
  worldSeed?: string;
}

/* ── Scene backgrounds per event type ────────────────────────── */
const SCENE_CONFIG: Record<string, { bg: string; accent: string; emoji: string; label: string; floor: string }> = {
  military_conflict: {
    bg: 'radial-gradient(ellipse at 50% 20%, #3b1111 0%, #1a0505 50%, #0a0202 100%)',
    accent: '#ef4444',
    emoji: '\u2694\uFE0F',
    label: 'The Battlefield',
    floor: 'linear-gradient(to top, rgba(120,20,20,0.25) 0%, rgba(60,10,10,0.08) 40%, transparent 100%)',
  },
  betrayal: {
    bg: 'radial-gradient(ellipse at 50% 20%, #1e1133 0%, #0d0820 50%, #050310 100%)',
    accent: '#a855f7',
    emoji: '\uD83D\uDDE1\uFE0F',
    label: 'The Shadow Court',
    floor: 'linear-gradient(to top, rgba(80,20,120,0.2) 0%, rgba(40,10,60,0.06) 40%, transparent 100%)',
  },
  political_intrigue: {
    bg: 'radial-gradient(ellipse at 50% 20%, #1a1a2e 0%, #0d0d1a 50%, #06060d 100%)',
    accent: '#6366f1',
    emoji: '\uD83C\uDFAD',
    label: 'The Throne Room',
    floor: 'linear-gradient(to top, rgba(50,50,120,0.2) 0%, rgba(25,25,60,0.06) 40%, transparent 100%)',
  },
  alliance: {
    bg: 'radial-gradient(ellipse at 50% 20%, #1a2e1a 0%, #0d1a0d 50%, #060d06 100%)',
    accent: '#22c55e',
    emoji: '\uD83E\uDD1D',
    label: 'The Great Hall',
    floor: 'linear-gradient(to top, rgba(20,120,50,0.2) 0%, rgba(10,60,25,0.06) 40%, transparent 100%)',
  },
  discovery: {
    bg: 'radial-gradient(ellipse at 50% 20%, #0d1a2e 0%, #060d1a 50%, #03060d 100%)',
    accent: '#3b82f6',
    emoji: '\uD83D\uDD0D',
    label: 'The Observatory',
    floor: 'linear-gradient(to top, rgba(20,60,140,0.2) 0%, rgba(10,30,70,0.06) 40%, transparent 100%)',
  },
  succession: {
    bg: 'radial-gradient(ellipse at 50% 20%, #2e2a0d 0%, #1a180a 50%, #0d0c05 100%)',
    accent: '#f59e0b',
    emoji: '\uD83D\uDC51',
    label: 'The Coronation',
    floor: 'linear-gradient(to top, rgba(140,120,20,0.25) 0%, rgba(70,60,10,0.08) 40%, transparent 100%)',
  },
  cultural_shift: {
    bg: 'radial-gradient(ellipse at 50% 20%, #0d2e2e 0%, #0a1a1a 50%, #050d0d 100%)',
    accent: '#06b6d4',
    emoji: '\uD83C\uDF0A',
    label: 'The Forum',
    floor: 'linear-gradient(to top, rgba(6,120,140,0.2) 0%, rgba(3,60,70,0.06) 40%, transparent 100%)',
  },
  natural_disaster: {
    bg: 'radial-gradient(ellipse at 50% 20%, #2e1a0d 0%, #1a0d05 50%, #0d0602 100%)',
    accent: '#f97316',
    emoji: '\uD83C\uDF0B',
    label: 'The Cataclysm',
    floor: 'linear-gradient(to top, rgba(140,80,10,0.25) 0%, rgba(70,40,5,0.08) 40%, transparent 100%)',
  },
  death: {
    bg: 'radial-gradient(ellipse at 50% 20%, #111111 0%, #080808 50%, #030303 100%)',
    accent: '#6b7280',
    emoji: '\uD83D\uDC80',
    label: 'The Memorial',
    floor: 'linear-gradient(to top, rgba(40,40,40,0.3) 0%, rgba(20,20,20,0.1) 40%, transparent 100%)',
  },
  birth: {
    bg: 'radial-gradient(ellipse at 50% 20%, #1a1a0d 0%, #141405 50%, #0a0a02 100%)',
    accent: '#eab308',
    emoji: '\u2728',
    label: 'The Dawn',
    floor: 'linear-gradient(to top, rgba(140,130,20,0.2) 0%, rgba(70,65,10,0.06) 40%, transparent 100%)',
  },
  divine_intervention: {
    bg: 'radial-gradient(ellipse at 50% 20%, #1a0d2e 0%, #0d051a 50%, #06020d 100%)',
    accent: '#d946ef',
    emoji: '\u26A1',
    label: 'The Sanctum',
    floor: 'linear-gradient(to top, rgba(120,30,160,0.25) 0%, rgba(60,15,80,0.08) 40%, transparent 100%)',
  },
  agent_intervention: {
    bg: 'radial-gradient(ellipse at 50% 20%, #0d1a2e 0%, #050d1a 50%, #02060d 100%)',
    accent: '#06b6d4',
    emoji: '\uD83E\uDDE0',
    label: 'The Unseen Hand',
    floor: 'linear-gradient(to top, rgba(6,120,140,0.2) 0%, rgba(3,60,70,0.06) 40%, transparent 100%)',
  },
  prophecy_fulfilled: {
    bg: 'radial-gradient(ellipse at 50% 20%, #2e1a2e 0%, #1a0d1a 50%, #0d050d 100%)',
    accent: '#f59e0b',
    emoji: '\uD83D\uDD2E',
    label: 'The Prophecy',
    floor: 'linear-gradient(to top, rgba(140,100,10,0.3) 0%, rgba(70,50,5,0.1) 40%, transparent 100%)',
  },
};

const DEFAULT_SCENE = {
  bg: 'radial-gradient(ellipse at 50% 20%, #111827 0%, #0a0f1a 50%, #050810 100%)',
  accent: '#9ca3af',
  emoji: '\u2728',
  label: 'The Stage',
  floor: 'linear-gradient(to top, rgba(100,100,120,0.1) 0%, rgba(50,50,60,0.03) 40%, transparent 100%)',
};

function getScene(eventType?: string) {
  if (!eventType) return DEFAULT_SCENE;
  return SCENE_CONFIG[eventType] || DEFAULT_SCENE;
}

/* ── Conflict-aware position calculator ──────────────────────── */
function computePositions(
  chars: Character[],
  activeIds: Set<string>,
  currentEvent: WorldEvent | null,
  factionMap: Record<string, { name: string; color: string }>,
): Record<string, { x: number; y: number; scale: number; depth: number }> {
  const positions: Record<string, { x: number; y: number; scale: number; depth: number }> = {};

  const activeChars = chars.filter((c) => activeIds.has(c.id));
  const inactiveChars = chars.filter((c) => !activeIds.has(c.id));

  // Conflict events: split actors by faction (left vs right)
  const isConflict = currentEvent && ['military_conflict', 'betrayal', 'political_intrigue'].includes(currentEvent.type);
  const involvedFactions = currentEvent?.factions_involved || [];

  if (isConflict && involvedFactions.length >= 2 && activeChars.length >= 2) {
    // Group active chars by faction
    const leftFaction = involvedFactions[0];
    const rightFaction = involvedFactions[1];
    const leftChars = activeChars.filter((c) => c.faction_id === leftFaction);
    const rightChars = activeChars.filter((c) => c.faction_id === rightFaction);
    const centerChars = activeChars.filter((c) => c.faction_id !== leftFaction && c.faction_id !== rightFaction);

    leftChars.forEach((c, i) => {
      const y = 40 + (i - (leftChars.length - 1) / 2) * 12;
      positions[c.id] = { x: 25, y: Math.max(25, Math.min(75, y)), scale: 1.2, depth: 1 };
    });
    rightChars.forEach((c, i) => {
      const y = 40 + (i - (rightChars.length - 1) / 2) * 12;
      positions[c.id] = { x: 75, y: Math.max(25, Math.min(75, y)), scale: 1.2, depth: 1 };
    });
    centerChars.forEach((c, i) => {
      positions[c.id] = { x: 50, y: 35 + i * 10, scale: 1.1, depth: 0.8 };
    });
  } else {
    // Non-conflict: cluster active chars at center stage
    activeChars.forEach((c, i) => {
      const total = activeChars.length;
      const spread = Math.min(18, 50 / Math.max(total, 1));
      const x = 50 + (i - (total - 1) / 2) * spread;
      positions[c.id] = {
        x: Math.max(15, Math.min(85, x)),
        y: 42,
        scale: 1.25,
        depth: 1,
      };
    });
  }

  // Inactive characters: faction clusters along edges with depth
  const inactivePerFaction: Record<string, Character[]> = {};
  inactiveChars.forEach((c) => {
    if (!inactivePerFaction[c.faction_id]) inactivePerFaction[c.faction_id] = [];
    inactivePerFaction[c.faction_id].push(c);
  });

  const inactiveFactionIds = Object.keys(inactivePerFaction);
  inactiveFactionIds.forEach((fid, fi) => {
    const group = inactivePerFaction[fid];
    const isLeft = fi % 2 === 0;
    const baseX = isLeft ? 6 + (fi / 2) * 10 : 94 - (Math.floor(fi / 2)) * 10;
    group.forEach((c, ci) => {
      const y = 20 + (ci / Math.max(group.length - 1, 1)) * 60;
      // Back row characters are smaller (depth effect)
      const depthScale = 0.6 + (ci % 3) * 0.1;
      positions[c.id] = {
        x: Math.max(3, Math.min(97, baseX + (ci % 2) * 3)),
        y: Math.max(15, Math.min(85, y)),
        scale: depthScale,
        depth: 0.4 + (ci % 3) * 0.15,
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
  ambientEnabled = false,
  worldSeed = '',
}: Props) {
  const [eventIndex, setEventIndex] = useState<number | null>(
    events.length > 0 ? events.length - 1 : null,
  );
  const [autoPlay, setAutoPlay] = useState(false);
  const [curtainOpen, setCurtainOpen] = useState(false);
  const [showSpeechBubble, setShowSpeechBubble] = useState(false);
  const [sceneImage, setSceneImage] = useState<string | null>(null);
  const [sceneLoading, setSceneLoading] = useState(false);
  const autoPlayRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sceneCacheRef = useRef<Map<string, string>>(new Map());

  const { play: playAmbient, stop: stopAmbient } = useAmbientSound(ambientEnabled, worldSeed);

  const aliveChars = useMemo(
    () => characters.filter((c) => c.alive).slice(0, 30),
    [characters],
  );

  const currentEvent = eventIndex !== null ? events[eventIndex] : null;
  const scene = getScene(currentEvent?.type);

  // Active character IDs for current event
  const activeCharIds = useMemo(() => {
    if (!currentEvent) return new Set<string>();
    return new Set(currentEvent.actors || []);
  }, [currentEvent]);

  // Character lookup
  const charMap = useMemo(() => {
    const m: Record<string, Character> = {};
    characters.forEach((c) => { m[c.id] = c; });
    return m;
  }, [characters]);

  // Fetch scene image when event changes
  useEffect(() => {
    if (!currentEvent) {
      setSceneImage(null);
      return;
    }
    const cacheKey = `${currentEvent.type}:${currentEvent.title}`;
    const cached = sceneCacheRef.current.get(cacheKey);
    if (cached) {
      setSceneImage(cached);
      return;
    }
    setSceneLoading(true);
    setSceneImage(null);
    api
      .generateScene(currentEvent.type, currentEvent.title)
      .then((res) => {
        if (res.image) {
          const dataUrl = `data:image/jpeg;base64,${res.image}`;
          sceneCacheRef.current.set(cacheKey, dataUrl);
          setSceneImage(dataUrl);
        }
      })
      .catch(() => {})
      .finally(() => setSceneLoading(false));

    // Pre-fetch next event image
    const nextIdx = eventIndex !== null ? eventIndex + 1 : null;
    if (nextIdx !== null && nextIdx < events.length) {
      const nextEvent = events[nextIdx];
      const nextKey = `${nextEvent.type}:${nextEvent.title}`;
      if (!sceneCacheRef.current.has(nextKey)) {
        api.generateScene(nextEvent.type, nextEvent.title).then((res) => {
          if (res.image) {
            sceneCacheRef.current.set(nextKey, `data:image/jpeg;base64,${res.image}`);
          }
        }).catch(() => {});
      }
    }
  }, [currentEvent?.id]);

  // Ambient sound — crossfade on event type change
  useEffect(() => {
    if (currentEvent) {
      playAmbient(currentEvent.type);
    } else {
      stopAmbient();
    }
  }, [currentEvent?.id, playAmbient, stopAmbient]);

  // Lead actor for speech bubble (first actor in event)
  const leadActor = useMemo(() => {
    if (!currentEvent || !currentEvent.actors.length) return null;
    return charMap[currentEvent.actors[0]] || null;
  }, [currentEvent, charMap]);

  // Character positions (conflict-aware)
  const positions = useMemo(
    () => computePositions(aliveChars, activeCharIds, currentEvent, factionMap),
    [aliveChars, activeCharIds, currentEvent, factionMap],
  );

  const charFactionColor = useCallback(
    (factionId: string) => factionMap[factionId]?.color || '#6b7280',
    [factionMap],
  );

  // Curtain open animation on mount
  useEffect(() => {
    const t = setTimeout(() => setCurtainOpen(true), 300);
    return () => clearTimeout(t);
  }, []);

  // Speech bubble timing — show 1s after event changes, hide after 3s
  useEffect(() => {
    if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
    setShowSpeechBubble(false);
    if (!currentEvent || !currentEvent.narrative) return;

    speechTimerRef.current = setTimeout(() => {
      setShowSpeechBubble(true);
      speechTimerRef.current = setTimeout(() => {
        setShowSpeechBubble(false);
      }, 4000);
    }, 800);

    return () => {
      if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
    };
  }, [currentEvent?.id]);

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
      timerRef.current = setTimeout(tick, 6000);
    };

    timerRef.current = setTimeout(tick, 6000);
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

  const goFirst = useCallback(() => setEventIndex(events.length > 0 ? 0 : null), [events.length]);
  const goLast = useCallback(() => setEventIndex(events.length > 0 ? events.length - 1 : null), [events.length]);

  const eventIcon = currentEvent
    ? EVENT_TYPE_ICONS[currentEvent.type] || '\u2728'
    : '\u2728';

  // Progress percentage for scrubber
  const progress = events.length > 0 && eventIndex !== null
    ? ((eventIndex + 1) / events.length) * 100
    : 0;

  if (aliveChars.length === 0) {
    return (
      <div className="bg-ink-900 rounded-xl border border-ink-800 flex items-center justify-center h-[650px]">
        <p className="text-ink-500">No living characters to display</p>
      </div>
    );
  }

  return (
    <div className="relative select-none">
      {/* ── Stage Container with 2.5D Perspective ────────── */}
      <div
        className="relative rounded-xl overflow-hidden"
        style={{ height: 650, perspective: '1200px' }}
      >
        {/* ── Curtain Overlay ──────────────────────────────── */}
        <div className="absolute inset-0 z-40 pointer-events-none flex">
          {/* Left curtain */}
          <motion.div
            initial={{ x: 0 }}
            animate={{ x: curtainOpen ? '-100%' : 0 }}
            transition={{ duration: 1.8, ease: [0.65, 0, 0.35, 1] }}
            className="w-1/2 h-full"
            style={{
              background: 'linear-gradient(135deg, #1a0505 0%, #3b0a0a 30%, #2a0808 50%, #1a0505 100%)',
              boxShadow: 'inset -20px 0 60px rgba(0,0,0,0.5)',
            }}
          >
            {/* Curtain folds */}
            <div className="h-full w-full" style={{
              background: 'repeating-linear-gradient(90deg, transparent 0px, transparent 30px, rgba(0,0,0,0.15) 30px, rgba(0,0,0,0.15) 32px, transparent 32px, transparent 60px)',
            }} />
          </motion.div>
          {/* Right curtain */}
          <motion.div
            initial={{ x: 0 }}
            animate={{ x: curtainOpen ? '100%' : 0 }}
            transition={{ duration: 1.8, ease: [0.65, 0, 0.35, 1] }}
            className="w-1/2 h-full"
            style={{
              background: 'linear-gradient(225deg, #1a0505 0%, #3b0a0a 30%, #2a0808 50%, #1a0505 100%)',
              boxShadow: 'inset 20px 0 60px rgba(0,0,0,0.5)',
            }}
          >
            <div className="h-full w-full" style={{
              background: 'repeating-linear-gradient(90deg, transparent 0px, transparent 30px, rgba(0,0,0,0.15) 30px, rgba(0,0,0,0.15) 32px, transparent 32px, transparent 60px)',
            }} />
          </motion.div>
          {/* Curtain rod */}
          <div className="absolute top-0 left-0 right-0 h-3 z-50" style={{
            background: 'linear-gradient(to bottom, #2a1a0a 0%, #1a0f05 50%, #0d0803 100%)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
          }} />
        </div>

        {/* ── Stage Background (with perspective tilt) ─────── */}
        <div
          className="absolute inset-0"
          style={{
            background: scene.bg,
            transition: 'background 1.5s ease',
          }}
        >
          {/* AI scene image background */}
          <AnimatePresence>
            {sceneImage && (
              <motion.img
                key={sceneImage}
                src={sceneImage}
                alt=""
                initial={{ opacity: 0, scale: 1.0 }}
                animate={{ opacity: 0.35, scale: 1.06 }}
                exit={{ opacity: 0 }}
                transition={{
                  opacity: { duration: 1.2 },
                  scale: { duration: 12, ease: 'linear' },
                }}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
          </AnimatePresence>
          {/* Dark overlay for readability when image is present */}
          {sceneImage && (
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.3) 100%)',
              }}
            />
          )}
          {/* Scene loading indicator */}
          {sceneLoading && (
            <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-genesis-400 animate-pulse" />
              <span className="text-[10px] text-white/20 uppercase tracking-widest">Generating scene...</span>
            </div>
          )}

          {/* Atmospheric particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: 1.5 + (i % 4),
                  height: 1.5 + (i % 4),
                  backgroundColor: scene.accent,
                  opacity: 0.08 + (i % 6) * 0.03,
                  left: `${(i * 37 + 13) % 100}%`,
                  top: `${(i * 53 + 7) % 100}%`,
                  animation: `theater-particle ${5 + (i % 5) * 2}s ease-in-out infinite`,
                  animationDelay: `${i * 0.4}s`,
                }}
              />
            ))}
          </div>

          {/* 2.5D Stage floor with perspective */}
          <div
            className="absolute bottom-0 left-0 right-0 pointer-events-none"
            style={{
              height: '45%',
              background: scene.floor,
              transition: 'background 1.5s ease',
              transformOrigin: 'bottom center',
              transform: 'perspective(800px) rotateX(8deg)',
            }}
          />

          {/* Floor grid lines for depth */}
          <div
            className="absolute bottom-0 left-0 right-0 pointer-events-none overflow-hidden"
            style={{
              height: '40%',
              transformOrigin: 'bottom center',
              transform: 'perspective(800px) rotateX(8deg)',
              opacity: 0.04,
            }}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="absolute left-0 right-0"
                style={{
                  bottom: `${i * 14}%`,
                  height: 1,
                  backgroundColor: scene.accent,
                }}
              />
            ))}
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={`v-${i}`}
                className="absolute top-0 bottom-0"
                style={{
                  left: `${8 + i * 8}%`,
                  width: 1,
                  backgroundColor: scene.accent,
                }}
              />
            ))}
          </div>

          {/* Vignette */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at 50% 40%, transparent 35%, rgba(0,0,0,0.7) 100%)',
            }}
          />

          {/* Stage arch / proscenium frame */}
          <div className="absolute inset-0 pointer-events-none" style={{
            borderLeft: '3px solid rgba(42,26,10,0.4)',
            borderRight: '3px solid rgba(42,26,10,0.4)',
            borderBottom: '3px solid rgba(42,26,10,0.3)',
            boxShadow: 'inset 0 0 80px rgba(0,0,0,0.4)',
          }} />
        </div>

        {/* Scene label */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={scene.label}
              initial={{ opacity: 0, y: -15, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.7 }}
              className="text-center"
            >
              <span
                className="text-xs uppercase tracking-[0.3em] font-medium px-5 py-2 rounded-full border backdrop-blur-md"
                style={{
                  color: scene.accent,
                  borderColor: `${scene.accent}25`,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  boxShadow: `0 0 30px rgba(${hexToRgb(scene.accent)},0.1)`,
                }}
              >
                {scene.emoji} {scene.label}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Day indicator */}
        <div className="absolute top-5 right-6 z-10 text-right">
          <p className="text-[10px] text-white/25 uppercase tracking-widest">Day</p>
          <p className="text-xl font-mono font-bold text-white/40">
            {currentEvent?.day || currentDay}
          </p>
        </div>

        {/* ── Stage Spotlights ─────────────────────────────── */}
        <AnimatePresence>
          {currentEvent && activeCharIds.size > 0 && (
            <>
              {/* Top-down spotlight cone */}
              <motion.div
                key={`spotlight-${currentEvent.id}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="absolute inset-0 pointer-events-none z-[5]"
                style={{
                  background: `radial-gradient(ellipse at 50% 30%, rgba(${hexToRgb(scene.accent)},0.06) 0%, transparent 50%)`,
                }}
              />
            </>
          )}
        </AnimatePresence>

        {/* ── Character Sprites ────────────────────────────── */}
        <div className="absolute inset-0 z-10">
          <AnimatePresence>
            {aliveChars.map((char) => {
              const pos = positions[char.id];
              if (!pos) return null;
              const isActive = activeCharIds.has(char.id);
              const color = charFactionColor(char.faction_id);
              const rgb = hexToRgb(color);
              const baseSize = 42 + char.fitness * 22;
              const size = Math.round(baseSize * pos.depth);
              const isLeadActor = leadActor?.id === char.id;

              return (
                <motion.div
                  key={char.id}
                  layout
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{
                    opacity: isActive ? 1 : (currentEvent ? 0.15 : 0.6),
                    scale: pos.scale,
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 100,
                    damping: 22,
                    mass: 0.9,
                  }}
                  className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2"
                  style={{ zIndex: isActive ? 20 : Math.round(pos.depth * 10) }}
                >
                  {/* Spotlight glow */}
                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.3 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute rounded-full"
                      style={{
                        width: size * 4,
                        height: size * 4,
                        top: `calc(50% - ${size * 2}px)`,
                        left: `calc(50% - ${size * 2}px)`,
                        background: `radial-gradient(circle, rgba(${rgb},0.2) 0%, rgba(${rgb},0.06) 35%, transparent 65%)`,
                      }}
                    />
                  )}

                  {/* Floor shadow */}
                  {isActive && (
                    <div
                      className="absolute rounded-full"
                      style={{
                        width: size * 1.5,
                        height: size * 0.3,
                        bottom: -(size * 0.25),
                        left: `calc(50% - ${size * 0.75}px)`,
                        background: `radial-gradient(ellipse, rgba(0,0,0,0.4) 0%, transparent 70%)`,
                      }}
                    />
                  )}

                  {/* Speech bubble for lead actor */}
                  {isLeadActor && showSpeechBubble && currentEvent?.narrative && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -5, scale: 0.9 }}
                      className="absolute bottom-full mb-3 z-30"
                      style={{ width: 220 }}
                    >
                      <div
                        className="relative rounded-lg px-3 py-2 text-[11px] text-white/80 leading-relaxed italic backdrop-blur-md"
                        style={{
                          backgroundColor: 'rgba(0,0,0,0.7)',
                          border: `1px solid rgba(${rgb},0.25)`,
                        }}
                      >
                        &ldquo;{currentEvent.narrative.length > 120
                          ? currentEvent.narrative.slice(0, 120) + '...'
                          : currentEvent.narrative}&rdquo;
                        {/* Speech bubble tail */}
                        <div
                          className="absolute left-1/2 -translate-x-1/2 -bottom-2"
                          style={{
                            width: 0,
                            height: 0,
                            borderLeft: '6px solid transparent',
                            borderRight: '6px solid transparent',
                            borderTop: '8px solid rgba(0,0,0,0.7)',
                          }}
                        />
                      </div>
                    </motion.div>
                  )}

                  {/* Character circle */}
                  <motion.div
                    animate={isActive ? {
                      boxShadow: [
                        `0 0 15px rgba(${rgb},0.3), 0 0 30px rgba(${rgb},0.15)`,
                        `0 0 25px rgba(${rgb},0.5), 0 0 50px rgba(${rgb},0.25)`,
                        `0 0 15px rgba(${rgb},0.3), 0 0 30px rgba(${rgb},0.15)`,
                      ],
                    } : {}}
                    transition={isActive ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}}
                    className="rounded-full flex items-center justify-center font-bold text-white relative"
                    style={{
                      width: size,
                      height: size,
                      backgroundColor: `rgba(${rgb},0.2)`,
                      border: `${isActive ? 2.5 : 1.5}px solid ${color}`,
                      fontSize: Math.max(10, size * 0.35),
                    }}
                  >
                    {char.name.charAt(0)}

                    {/* Breathing ring when idle */}
                    {!currentEvent && (
                      <div
                        className="absolute inset-0 rounded-full"
                        style={{
                          border: `1px solid rgba(${rgb},0.25)`,
                          animation: 'theater-breathe 3.5s ease-in-out infinite',
                          animationDelay: `${(char.name.charCodeAt(0) % 5) * 0.7}s`,
                        }}
                      />
                    )}
                  </motion.div>

                  {/* Name label */}
                  <span
                    className="mt-1 font-medium whitespace-nowrap max-w-[80px] truncate"
                    style={{
                      fontSize: Math.max(8, 10 * pos.depth),
                      color: isActive ? color : 'rgba(255,255,255,0.3)',
                      textShadow: isActive ? `0 0 10px rgba(${rgb},0.5), 0 2px 4px rgba(0,0,0,0.8)` : '0 1px 2px rgba(0,0,0,0.5)',
                      transition: 'color 0.5s, text-shadow 0.5s',
                    }}
                  >
                    {char.name}
                  </span>

                  {/* Role + faction tag for active characters */}
                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center mt-0.5"
                    >
                      <span
                        className="text-[8px] uppercase tracking-wider"
                        style={{ color: `rgba(${rgb},0.55)` }}
                      >
                        {char.role}
                      </span>
                      <span
                        className="text-[7px] mt-0.5 px-1.5 py-0.5 rounded-full border"
                        style={{
                          color: `rgba(${rgb},0.5)`,
                          borderColor: `rgba(${rgb},0.2)`,
                          backgroundColor: `rgba(${rgb},0.05)`,
                        }}
                      >
                        {factionMap[char.faction_id]?.name || ''}
                      </span>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* ── Event Title Card (top) ──────────────────────── */}
        <AnimatePresence mode="wait">
          {currentEvent && (
            <motion.div
              key={`title-${currentEvent.id}`}
              initial={{ opacity: 0, scale: 0.85, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="absolute top-16 left-1/2 -translate-x-1/2 z-20 text-center"
            >
              <div className="text-4xl mb-1">{eventIcon}</div>
              <h3
                className="text-xl font-bold max-w-lg"
                style={{
                  color: scene.accent,
                  textShadow: `0 0 20px rgba(${hexToRgb(scene.accent)},0.4), 0 2px 8px rgba(0,0,0,0.8)`,
                }}
              >
                {currentEvent.title}
              </h3>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="text-[10px] uppercase tracking-widest text-white/30">
                  {currentEvent.type.replace(/_/g, ' ')}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Narrative Box (bottom) ──────────────────────── */}
        <AnimatePresence mode="wait">
          {currentEvent && currentEvent.narrative && (
            <motion.div
              key={`narr-${currentEvent.id}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 w-full max-w-2xl px-6"
            >
              <div
                className="rounded-xl px-6 py-4 backdrop-blur-md border"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.55)',
                  borderColor: `rgba(${hexToRgb(scene.accent)},0.15)`,
                  boxShadow: `0 0 40px rgba(0,0,0,0.4), 0 0 20px rgba(${hexToRgb(scene.accent)},0.05)`,
                }}
              >
                <p className="text-sm text-white/65 leading-relaxed italic text-center">
                  {currentEvent.narrative.length > 280
                    ? currentEvent.narrative.slice(0, 280) + '...'
                    : currentEvent.narrative}
                </p>

                {/* Faction tags */}
                {currentEvent.factions_involved.length > 0 && (
                  <div className="flex justify-center gap-2 mt-3">
                    {currentEvent.factions_involved.map((fid) => {
                      const f = factionMap[fid];
                      if (!f) return null;
                      return (
                        <span
                          key={fid}
                          className="text-[10px] px-2 py-0.5 rounded-full border font-medium"
                          style={{
                            color: f.color,
                            borderColor: `${f.color}30`,
                            backgroundColor: `${f.color}0a`,
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
        {events.length === 0 && curtainOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="absolute inset-0 flex items-center justify-center z-10"
          >
            <div className="text-center">
              <p className="text-4xl mb-3">{'\uD83C\uDFAD'}</p>
              <p className="text-white/35 text-sm">
                The stage awaits. Simulate days to begin the drama.
              </p>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Controls Bar ─────────────────────────────────── */}
      <div className="mt-3 px-2">
        {/* Event scrubber / progress bar */}
        {events.length > 0 && (
          <div className="mb-3">
            <div className="relative h-1 bg-ink-800 rounded-full overflow-hidden">
              <motion.div
                className="absolute top-0 left-0 h-full rounded-full"
                style={{ backgroundColor: scene.accent }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          {/* Event navigation */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={goFirst}
              disabled={eventIndex === null || eventIndex <= 0}
              className="p-1.5 rounded-lg bg-ink-900 border border-ink-800 text-vellum-400 hover:text-white hover:border-ink-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="First event"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={goPrev}
              disabled={eventIndex === null || eventIndex <= 0}
              className="p-2 rounded-lg bg-ink-900 border border-ink-800 text-vellum-400 hover:text-white hover:border-ink-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={() => setAutoPlay((p) => !p)}
              disabled={events.length === 0}
              className={`p-2 rounded-lg border transition-colors ${
 autoPlay
 ? 'bg-genesis-600/20 border-genesis-500/40 text-genesis-400'
 : 'bg-ink-900 border-ink-800 text-vellum-400 hover:text-white hover:border-ink-600'
 } disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              {autoPlay ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>

            <button
              onClick={goNext}
              disabled={eventIndex === null || eventIndex >= events.length - 1}
              className="p-2 rounded-lg bg-ink-900 border border-ink-800 text-vellum-400 hover:text-white hover:border-ink-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={goLast}
              disabled={eventIndex === null || eventIndex >= events.length - 1}
              className="p-1.5 rounded-lg bg-ink-900 border border-ink-800 text-vellum-400 hover:text-white hover:border-ink-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Latest event"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Event counter */}
          <div className="text-xs text-ink-500 font-mono">
            {eventIndex !== null ? (
              <span>
                Event <span className="text-vellum-300">{eventIndex + 1}</span> / {events.length}
              </span>
            ) : (
              <span>{events.length} events</span>
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
                <span className="text-[10px] text-ink-500">{f.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CSS Animations ───────────────────────────────── */}
      <style>{`
        @keyframes theater-particle {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.08; }
          25% { transform: translateY(-25px) translateX(12px); opacity: 0.15; }
          50% { transform: translateY(-15px) translateX(-8px); opacity: 0.12; }
          75% { transform: translateY(-35px) translateX(18px); opacity: 0.08; }
        }
        @keyframes theater-breathe {
          0%, 100% { transform: scale(1); opacity: 0.25; }
          50% { transform: scale(1.18); opacity: 0.08; }
        }
      `}</style>
    </div>
  );
}
