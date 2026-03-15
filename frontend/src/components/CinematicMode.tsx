import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { api } from '../api';
import type { Character, WorldEvent, Geography } from '../types';
import { EVENT_TYPE_ICONS } from '../types';
import { useVoiceNarration } from '../hooks/useVoiceNarration';
import { useAmbientSound } from '../hooks/useAmbientSound';
import WorldMap from './WorldMap';

/** CSS gradient fallbacks per event type — shown while AI image loads or when unavailable */
const SCENE_GRADIENTS: Record<string, string> = {
  military_conflict: 'radial-gradient(ellipse at 30% 40%, #7f1d1d 0%, #450a0a 40%, #1a0505 100%)',
  betrayal: 'radial-gradient(ellipse at 50% 60%, #3b0764 0%, #1e1b4b 40%, #0a0a0a 100%)',
  alliance: 'radial-gradient(ellipse at 60% 30%, #854d0e 0%, #713f12 30%, #1a1505 100%)',
  succession: 'radial-gradient(ellipse at 50% 20%, #a16207 0%, #78350f 40%, #1a1005 100%)',
  political_intrigue: 'radial-gradient(ellipse at 40% 50%, #1e3a5f 0%, #0f172a 50%, #020617 100%)',
  cultural_shift: 'radial-gradient(ellipse at 50% 50%, #164e63 0%, #134e4a 40%, #042f2e 100%)',
  natural_disaster: 'radial-gradient(ellipse at 50% 70%, #9a3412 0%, #7c2d12 30%, #1c1917 100%)',
  death: 'radial-gradient(ellipse at 50% 50%, #1f2937 0%, #111827 40%, #030712 100%)',
  birth: 'radial-gradient(ellipse at 50% 30%, #fbbf24 0%, #b45309 30%, #1a1005 100%)',
  divine_intervention: 'radial-gradient(ellipse at 50% 20%, #7c3aed 0%, #4338ca 30%, #0f0a1e 100%)',
  discovery: 'radial-gradient(ellipse at 60% 40%, #0d9488 0%, #115e59 40%, #042f2e 100%)',
  agent_intervention: 'radial-gradient(ellipse at 50% 50%, #6366f1 0%, #312e81 40%, #0a0a2e 100%)',
  prophecy_fulfilled: 'radial-gradient(ellipse at 50% 40%, #a855f7 0%, #6b21a8 30%, #1e1b4b 100%)',
};

interface Props {
  worldId: string;
  worldName: string;
  currentDay: number;
  geography: Geography;
  factionMap: Record<string, { name: string; color: string }>;
  characters: Character[];
  events: WorldEvent[];
  onClose: () => void;
  onNewEvents: (events: WorldEvent[]) => void;
  mode?: 'live' | 'replay';
}

export default function CinematicMode({
  worldId,
  worldName,
  currentDay,
  geography,
  factionMap,
  characters,
  events,
  onClose,
  onNewEvents,
  mode = 'live',
}: Props) {
  const [day, setDay] = useState(mode === 'replay' ? 0 : currentDay);
  const [displayedEvent, setDisplayedEvent] = useState<WorldEvent | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [replayProgress, setReplayProgress] = useState(0);
  const [replayTotal, setReplayTotal] = useState(0);
  const [replayDone, setReplayDone] = useState(false);
  const [sceneImage, setSceneImage] = useState<string | null>(null);
  const [sceneLoading, setSceneLoading] = useState(false);
  const eventQueueRef = useRef<WorldEvent[]>([]);
  const displayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(true);
  const sceneCache = useRef<Map<string, string>>(new Map());
  const onQueueDrainRef = useRef<(() => void) | null>(null);

  const { speak } = useVoiceNarration(true);
  const { play: playAmbient } = useAmbientSound(true);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (displayTimerRef.current) clearTimeout(displayTimerRef.current);
    };
  }, []);

  // Fetch scene image for an event — returns the data URL or null
  const fetchSceneImage = useCallback(async (evt: WorldEvent): Promise<string | null> => {
    const cacheKey = `${evt.type}:${evt.title}`;
    const cached = sceneCache.current.get(cacheKey);
    if (cached) {
      setSceneImage(cached);
      return cached;
    }
    setSceneLoading(true);
    try {
      const res = await api.generateScene(evt.type, evt.title);
      if (res.image && activeRef.current) {
        const dataUrl = `data:image/jpeg;base64,${res.image}`;
        sceneCache.current.set(cacheKey, dataUrl);
        setSceneImage(dataUrl);
        return dataUrl;
      }
    } catch (err) {
      console.warn('[CinematicMode] Scene image failed:', evt.type, evt.title, err);
    } finally {
      if (activeRef.current) setSceneLoading(false);
    }
    return null;
  }, []);

  // Pre-fetch the next image in the queue while current event is displaying
  const prefetchNext = useCallback(() => {
    const peek = eventQueueRef.current[0];
    if (!peek) return;
    const cacheKey = `${peek.type}:${peek.title}`;
    if (sceneCache.current.has(cacheKey)) return;
    // Fire and forget — result goes into sceneCache for instant use later
    api.generateScene(peek.type, peek.title).then((res) => {
      if (res.image) {
        sceneCache.current.set(cacheKey, `data:image/jpeg;base64,${res.image}`);
      }
    }).catch(() => {});
  }, []);

  // Process event queue one at a time — waits for image before starting display timer
  const processQueue = useCallback(async () => {
    if (!activeRef.current) return;
    if (eventQueueRef.current.length === 0) {
      setDisplayedEvent(null);
      setSceneImage(null);
      // Signal queue drained (used by replay mode to advance days)
      const cb = onQueueDrainRef.current;
      onQueueDrainRef.current = null;
      cb?.();
      return;
    }
    const next = eventQueueRef.current.shift()!;
    setDisplayedEvent(next);
    playAmbient(next.type);
    setSceneImage(null);

    // Wait for image (with 10s timeout so we don't hang forever)
    const imagePromise = fetchSceneImage(next);
    const timeoutPromise = new Promise<null>((r) => setTimeout(() => r(null), 10000));
    await Promise.race([imagePromise, timeoutPromise]);

    if (!activeRef.current) return;

    // Pre-fetch the NEXT image while this one is being displayed
    prefetchNext();

    // Narrate the event (after image loads so they appear together)
    const text = next.narrative || next.title;
    if (text) speak(text);

    // NOW start the 7s display timer — image is already visible
    displayTimerRef.current = setTimeout(() => {
      if (!activeRef.current) return;
      setDisplayedEvent(null);
      setSceneImage(null);
      // Small gap before next card
      displayTimerRef.current = setTimeout(() => {
        processQueue();
      }, 800);
    }, 7000);
  }, [speak, playAmbient, fetchSceneImage, prefetchNext]);

  // REPLAY MODE: play through all past events
  useEffect(() => {
    if (mode !== 'replay' || events.length === 0) return;

    // Group events by day
    const byDay = new Map<number, WorldEvent[]>();
    for (const ev of events) {
      const d = ev.day || 0;
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d)!.push(ev);
    }
    const sortedDays = [...byDay.keys()].sort((a, b) => a - b);
    setReplayTotal(events.length);

    let eventIndex = 0;
    let dayIndex = 0;

    const playNextDay = () => {
      if (!activeRef.current || dayIndex >= sortedDays.length) {
        setReplayDone(true);
        return;
      }
      const currentDayNum = sortedDays[dayIndex];
      const dayEvents = byDay.get(currentDayNum) || [];
      setDay(currentDayNum);

      // Queue all events for this day
      eventQueueRef.current.push(...dayEvents);
      eventIndex += dayEvents.length;
      setReplayProgress(eventIndex);

      // When all events for this day are done, advance to next day
      onQueueDrainRef.current = () => {
        dayIndex++;
        playNextDay();
      };

      processQueue();
    };

    // Start replay after brief intro pause
    const startTimer = setTimeout(playNextDay, 1500);
    return () => {
      clearTimeout(startTimer);
      onQueueDrainRef.current = null;
      if (displayTimerRef.current) clearTimeout(displayTimerRef.current);
    };
  }, [mode, events, processQueue]);

  // LIVE MODE: Auto-simulation with 10-second interval
  useEffect(() => {
    if (mode !== 'live') return;

    const tick = async () => {
      if (!activeRef.current || simulating) return;
      setSimulating(true);
      try {
        const result = await api.simulate(worldId, 1);
        if (!activeRef.current) return;
        setDay(result.current_day);
        onNewEvents(result.events);

        // Queue new events for display
        if (result.events.length > 0) {
          eventQueueRef.current.push(...result.events);
          // If not already displaying, start processing
          if (!displayTimerRef.current || eventQueueRef.current.length === result.events.length) {
            processQueue();
          }
        }
      } catch {
        // Silently continue — next tick will retry
      } finally {
        setSimulating(false);
      }
    };

    const interval = setInterval(tick, 10000);
    // Run first tick after a short delay
    const initialTimer = setTimeout(tick, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(initialTimer);
    };
  }, [mode, worldId, onNewEvents, processQueue, simulating]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const eventIcon = displayedEvent
    ? EVENT_TYPE_ICONS[displayedEvent.type] || '\u2728'
    : '';

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Fullscreen map */}
      <div className="absolute inset-0">
        <div className="w-full h-full [&>div]:h-full [&>div>div]:h-full [&_svg]:!h-full [&>div]:flex-col [&>div>div:last-child]:hidden">
          <WorldMap
            geography={geography}
            factionMap={factionMap}
            characters={characters}
            events={events}
            currentDay={day}
          />
        </div>
      </div>

      {/* Atmospheric vignette edges */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.7) 100%)',
        }}
      />

      {/* Top edge blur */}
      <div className="absolute top-0 left-0 right-0 h-24 pointer-events-none bg-gradient-to-b from-black/60 to-transparent backdrop-blur-[1px]" />

      {/* Bottom edge blur */}
      <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none bg-gradient-to-t from-black/60 to-transparent backdrop-blur-[1px]" />

      {/* World name watermark — top left */}
      <div className="absolute top-6 left-6 z-10">
        <p className="text-xl font-bold text-white/40 tracking-wider uppercase">
          {worldName}
        </p>
      </div>

      {/* Day counter — top right */}
      <div className="absolute top-6 right-16 z-10 text-right">
        <p className="text-xs text-white/40 uppercase tracking-widest">Day</p>
        <p className="text-3xl font-mono font-bold text-white/70">{day}</p>
      </div>

      {/* Close button — top right corner */}
      <button
        onClick={onClose}
        className="absolute top-5 right-5 z-20 p-2 text-white/50 hover:text-white transition-opacity rounded-lg hover:bg-white/10"
        title="Exit Cinematic Mode"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Scene image background — fullscreen behind event card */}
      <AnimatePresence>
        {displayedEvent && (
          <motion.div
            key={`scene-${displayedEvent.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 z-[5]"
          >
            {/* CSS gradient fallback (always present) */}
            <div
              className="absolute inset-0"
              style={{
                background: SCENE_GRADIENTS[displayedEvent.type] ||
                  'radial-gradient(ellipse at 50% 50%, #1a1a2e 0%, #0a0a0a 100%)',
                opacity: sceneImage ? 0.3 : 0.85,
                transition: 'opacity 1s ease',
              }}
            />
            {/* AI-generated scene image with Ken Burns cinematic zoom */}
            {sceneImage && (
              <motion.img
                src={sceneImage}
                alt=""
                initial={{ opacity: 0, scale: 1.0 }}
                animate={{ opacity: 0.95, scale: 1.08 }}
                exit={{ opacity: 0 }}
                transition={{
                  opacity: { duration: 0.8 },
                  scale: { duration: 7, ease: 'linear' },
                }}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            {/* Dark overlay for text readability — lighter to let images show */}
            <div
              className="absolute inset-0"
              style={{
                background: sceneImage
                  ? 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 35%, rgba(0,0,0,0.15) 100%)'
                  : 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.3) 100%)',
              }}
            />
            {/* Scene loading indicator */}
            {sceneLoading && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-genesis-400 animate-pulse" />
                <span className="text-[10px] text-white/20 uppercase tracking-widest">Generating scene...</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Event title card — centered */}
      <AnimatePresence mode="wait">
        {displayedEvent && (
          <motion.div
            key={displayedEvent.id}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
          >
            <div className="text-center max-w-3xl px-8">
              {/* Event type emoji */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="text-6xl mb-6 drop-shadow-2xl"
              >
                {eventIcon}
              </motion.div>

              {/* Event title */}
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="text-4xl md:text-5xl font-bold text-white leading-tight"
                style={{
                  textShadow:
                    '0 2px 20px rgba(0,0,0,0.9), 0 4px 40px rgba(0,0,0,0.7), 0 0 80px rgba(0,0,0,0.5)',
                }}
              >
                {displayedEvent.title}
              </motion.h2>

              {/* Event narrative snippet */}
              {displayedEvent.narrative && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.6 }}
                  className="mt-6 text-xl text-white/70 italic max-w-2xl mx-auto leading-relaxed"
                  style={{
                    textShadow: '0 2px 16px rgba(0,0,0,0.95), 0 0 40px rgba(0,0,0,0.5)',
                  }}
                >
                  {displayedEvent.narrative.length > 200
                    ? displayedEvent.narrative.slice(0, 200) + '...'
                    : displayedEvent.narrative}
                </motion.p>
              )}

              {/* Event type label */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.4 }}
                className="mt-8"
              >
                <span
                  className="inline-block px-4 py-1.5 text-xs uppercase tracking-[0.2em] rounded-full bg-white/10 text-white/60 backdrop-blur-md border border-white/10"
                >
                  {displayedEvent.type.replace(/_/g, ' ')}
                </span>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mode indicator — bottom center */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
        {mode === 'replay' ? (
          <>
            <span className="relative flex h-3 w-3">
              <span className={`absolute inline-flex h-full w-full rounded-full ${replayDone ? 'bg-green-500' : 'bg-amber-500 animate-ping'} opacity-75`} />
              <span className={`relative inline-flex rounded-full h-3 w-3 ${replayDone ? 'bg-green-600' : 'bg-amber-600'}`} />
            </span>
            <span className="text-xs uppercase tracking-widest text-white/50 font-medium">
              {replayDone ? 'Replay Complete' : `Replay ${replayProgress}/${replayTotal}`}
            </span>
          </>
        ) : (
          <>
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
            </span>
            <span className="text-xs uppercase tracking-widest text-white/50 font-medium">
              Live
            </span>
          </>
        )}
      </div>

      {/* Simulating indicator */}
      <AnimatePresence>
        {simulating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-6 right-6 z-10 flex items-center gap-2"
          >
            <div className="w-2 h-2 rounded-full bg-genesis-400 animate-pulse" />
            <span className="text-xs text-white/30">Simulating...</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
