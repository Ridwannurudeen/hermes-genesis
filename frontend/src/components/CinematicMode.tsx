import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { api } from '../api';
import type { Character, WorldEvent } from '../types';
import { EVENT_TYPE_ICONS } from '../types';
import { useVoiceNarration } from '../hooks/useVoiceNarration';
import WorldMap from './WorldMap';

interface Props {
  worldId: string;
  worldName: string;
  currentDay: number;
  geography: { regions: any[]; connections: any[] };
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
  const eventQueueRef = useRef<WorldEvent[]>([]);
  const displayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(true);

  const { speak } = useVoiceNarration(true);

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

  // Process event queue one at a time with 4s display
  const processQueue = useCallback(() => {
    if (!activeRef.current) return;
    if (eventQueueRef.current.length === 0) {
      setDisplayedEvent(null);
      return;
    }
    const next = eventQueueRef.current.shift()!;
    setDisplayedEvent(next);

    // Narrate the event
    const text = next.narrative || next.title;
    if (text) speak(text);

    displayTimerRef.current = setTimeout(() => {
      if (!activeRef.current) return;
      setDisplayedEvent(null);
      // Small gap before next card
      displayTimerRef.current = setTimeout(() => {
        processQueue();
      }, 500);
    }, 4000);
  }, [speak]);

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

      // Process queue, then after all events displayed, move to next day
      processQueue();

      // Wait enough time for all events to display (4.5s per event) plus buffer
      const waitMs = dayEvents.length * 4500 + 1000;
      displayTimerRef.current = setTimeout(() => {
        dayIndex++;
        playNextDay();
      }, waitMs);
    };

    // Start replay after brief intro pause
    const startTimer = setTimeout(playNextDay, 1500);
    return () => {
      clearTimeout(startTimer);
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
                className="text-5xl mb-4"
              >
                {eventIcon}
              </motion.div>

              {/* Event title */}
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="text-3xl md:text-4xl font-bold text-white leading-tight"
                style={{
                  textShadow:
                    '0 2px 20px rgba(0,0,0,0.8), 0 4px 40px rgba(0,0,0,0.6)',
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
                  className="mt-4 text-lg text-white/60 italic max-w-xl mx-auto"
                  style={{
                    textShadow: '0 2px 12px rgba(0,0,0,0.9)',
                  }}
                >
                  {displayedEvent.narrative.length > 160
                    ? displayedEvent.narrative.slice(0, 160) + '...'
                    : displayedEvent.narrative}
                </motion.p>
              )}

              {/* Event type label */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.4 }}
                className="mt-6"
              >
                <span
                  className="inline-block px-3 py-1 text-xs uppercase tracking-widest rounded-full bg-white/10 text-white/50 backdrop-blur-sm"
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
