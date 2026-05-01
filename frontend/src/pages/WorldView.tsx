import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Map, Network, ScrollText, TrendingUp,
  BookOpen, Zap, Swords, Brain, Scroll, Download,
  Play, Sparkles, History, Theater, BarChart3,
  Music, Music2, MoreHorizontal,
} from 'lucide-react';
import { api } from '../api';
import type {
  World,
  Faction,
  Character,
  WorldEvent,
  EvolutionEntry,
  FactionSnapshot,
  Prophecy,
  MapData,
} from '../types';
import SimulateButton from '../components/SimulateButton';
import AutoPlayButton from '../components/AutoPlayButton';
import ThemeToggle from '../components/ThemeToggle';
import VoiceNarrationButton from '../components/VoiceNarrationButton';
import CharacterDetail from '../components/CharacterDetail';
import ProphecyPanel from '../components/ProphecyPanel';
import { useVoiceNarration } from '../hooks/useVoiceNarration';
import { useAmbientSound } from '../hooks/useAmbientSound';

// Lazy-loaded view mode components
const WorldMap = lazy(() => import('../components/WorldMap'));
const TheaterMode = lazy(() => import('../components/TheaterMode'));
const RelationshipGraph = lazy(() => import('../components/RelationshipGraph'));
const EventTimeline = lazy(() => import('../components/EventTimeline'));

// Analytics drawer (replaces inline analytics)
const AnalyticsDrawer = lazy(() => import('../components/AnalyticsDrawer'));

// Lazy-loaded heavy components (modals, overlays)
const CinematicMode = lazy(() => import('../components/CinematicMode'));
const ChronicleModal = lazy(() => import('../components/ChronicleModal'));
const CampaignKitModal = lazy(() => import('../components/CampaignKitModal'));
const SessionPrepModal = lazy(() => import('../components/SessionPrepModal'));
const GodModePanel = lazy(() => import('../components/GodModePanel'));
const CouncilModal = lazy(() => import('../components/CouncilModal'));
const AutonomousAgentPanel = lazy(() => import('../components/AutonomousAgentPanel'));

/* ── View Modes ─────────────────────────────────────────────── */
type ViewMode = 'theater' | 'map' | 'network' | 'chronicle';

const VIEW_MODES: { key: ViewMode; label: string; icon: typeof Map; desc: string }[] = [
  { key: 'theater', label: 'Theater', icon: Theater, desc: 'Dramatic stage view' },
  { key: 'map', label: 'Map', icon: Map, desc: 'Territory control' },
  { key: 'network', label: 'Network', icon: Network, desc: 'Relationships' },
  { key: 'chronicle', label: 'Chronicle', icon: ScrollText, desc: 'Event timeline' },
];


/* ── Narrator framing — adds dramatic intros & pacing to speech ── */
const NARRATOR_INTROS: Record<string, string[]> = {
  military_conflict: [
    'The drums of war echo across the land.',
    'Steel clashes against steel as battle erupts.',
    'War has come, and none shall be spared.',
  ],
  betrayal: [
    'A dagger in the dark... trust is shattered.',
    'Treachery unfolds behind closed doors.',
    'In the halls of power, loyalty proves a fragile thing.',
  ],
  political_intrigue: [
    'Whispers in the court carry poison and promise.',
    'The game of power shifts once more.',
    'Behind every smile, a calculation.',
  ],
  alliance: [
    'Hands are clasped in solemn accord.',
    'Old enemies find common cause.',
    'A new bond is forged in the fires of necessity.',
  ],
  succession: [
    'The throne changes hands.',
    'A new era dawns with the rise of a new ruler.',
    'Power passes, as it always does.',
  ],
  discovery: [
    'Something long hidden comes to light.',
    'The world reveals another of its secrets.',
    'Knowledge, once buried, resurfaces.',
  ],
  cultural_shift: [
    'The tides of belief and custom begin to turn.',
    'A people transforms before the world\'s eyes.',
    'Change ripples through the hearts of many.',
  ],
  natural_disaster: [
    'The earth itself cries out in fury.',
    'Nature reminds all who truly rules this world.',
    'Devastation sweeps across the land without mercy.',
  ],
  death: [
    'A light is extinguished... the world grows darker.',
    'Death comes for all, even the mighty.',
    'And so, a chapter ends.',
  ],
  birth: [
    'New life stirs... a spark of possibility.',
    'The world welcomes a new soul.',
    'From nothing, something remarkable emerges.',
  ],
  divine_intervention: [
    'The hand of the divine reaches into mortal affairs.',
    'From beyond the veil, a force intervenes.',
    'The gods have spoken.',
  ],
  agent_intervention: [
    'An unseen hand reshapes the course of events.',
    'The World Master acts with purpose.',
    'Forces beyond mortal understanding are at work.',
  ],
  prophecy_fulfilled: [
    'What was foretold... has come to pass.',
    'The prophecy is fulfilled at last.',
    'Destiny, it seems, is not so easily denied.',
  ],
};

function narratorFrame(eventType: string, rawText: string): string {
  const intros = NARRATOR_INTROS[eventType];
  if (!intros) return rawText;
  const intro = intros[Math.floor(Math.random() * intros.length)];
  return `${intro} ... ${rawText}`;
}

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-white/[0.06] rounded-lg ${className || ''}`} />
  );
}

export default function WorldView() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const autoCinematic = searchParams.get('cinematic') === '1';
  const [world, setWorld] = useState<World | null>(null);
  const [factions, setFactions] = useState<Faction[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [events, setEvents] = useState<WorldEvent[]>([]);
  const [evolution, setEvolution] = useState<EvolutionEntry[]>([]);
  const [factionTimeline, setFactionTimeline] = useState<FactionSnapshot[]>([]);
  const [prophecies, setProphecies] = useState<Prophecy[]>([]);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('theater');
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [graphSelectedChar, setGraphSelectedChar] = useState<Character | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [autoPlay, setAutoPlay] = useState(false);
  const [showChronicle, setShowChronicle] = useState(false);
  const [godMode, setGodMode] = useState(false);
  const [showCouncil, setShowCouncil] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [ambientEnabled, setAmbientEnabled] = useState(false);
  const [showAgent, setShowAgent] = useState(false);
  const [showCampaignKit, setShowCampaignKit] = useState(false);
  const [showCinematic, setShowCinematic] = useState(false);
  const [showReplay, setShowReplay] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const cinematicAutoOpenedRef = useRef(false);
  const toolsRef = useRef<HTMLDivElement>(null);

  // Close the tools menu on outside click + Escape.
  useEffect(() => {
    if (!toolsOpen) return;
    const onClick = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setToolsOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [toolsOpen]);
  const [showSessionPrep, setShowSessionPrep] = useState(false);
  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoPlayActiveRef = useRef(false);
  const prevEventCountRef = useRef(0);

  // ?cinematic=1 in the URL auto-opens CinematicMode once world data + map are
  // loaded. Used by Landing's "Watch the canon being written" entry point so
  // judges can hit the cinematic playback in one click from the front door.
  useEffect(() => {
    if (!autoCinematic || cinematicAutoOpenedRef.current) return;
    if (world && mapData && !showCinematic) {
      cinematicAutoOpenedRef.current = true;
      setShowCinematic(true);
    }
  }, [autoCinematic, world, mapData, showCinematic]);

  const factionMap = useMemo(() => {
    const m: Record<string, Faction> = {};
    factions.forEach((f) => { m[f.id] = f; });
    return m;
  }, [factions]);

  const { speak, pause, resume, stop, narrationState } = useVoiceNarration(voiceEnabled);
  const { play: playAmbient } = useAmbientSound(ambientEnabled, world?.seed || '');

  // Voice narration + ambient sound: react to new events
  useEffect(() => {
    if (events.length <= prevEventCountRef.current) {
      prevEventCountRef.current = events.length;
      return;
    }
    const newEvents = events.slice(prevEventCountRef.current);
    for (const ev of newEvents) {
      // Ambient sound — play event-typed soundscape
      if (ambientEnabled) playAmbient(ev.type);

      // Voice narration — dramatic framing
      if (voiceEnabled) {
        const raw = ev.narrative || ev.title;
        if (raw) speak(narratorFrame(ev.type, raw));
      }
    }
    prevEventCountRef.current = events.length;
  }, [events.length, voiceEnabled, ambientEnabled, speak, playAmbient]);

  // Track whether deferred data has been fetched
  const deferredFetchedRef = useRef(false);

  const fetchEssential = useCallback(async () => {
    if (!id) return;
    try {
      const [w, m, f, c, evRes] = await Promise.all([
        api.getWorld(id),
        api.getMap(id),
        api.getFactions(id),
        api.getCharacters(id),
        api.getEvents(id, undefined, 100, 0),
      ]);
      setWorld(w);
      setMapData(m);
      setFactions(f);
      setCharacters(c);
      setEvents([...evRes.events].reverse());
    } catch {
      // keep stale data visible
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchDeferred = useCallback(async () => {
    if (!id) return;
    try {
      const [ev, timeline, proph] = await Promise.all([
        api.getEvolution(id),
        api.getFactionTimeline(id),
        api.getProphecies(id),
      ]);
      setEvolution(ev);
      setFactionTimeline(timeline);
      setProphecies(proph);
      deferredFetchedRef.current = true;
    } catch {
      // keep stale data
    }
  }, [id]);

  const fetchAll = useCallback(async () => {
    await fetchEssential();
    if (deferredFetchedRef.current) {
      fetchDeferred();
    }
  }, [fetchEssential, fetchDeferred]);

  useEffect(() => {
    fetchEssential();
  }, [fetchEssential]);

  // Fetch deferred data when analytics drawer or map (prophecies) is opened
  useEffect(() => {
    if ((analyticsOpen || viewMode === 'map') && !deferredFetchedRef.current) {
      fetchDeferred();
    }
  }, [analyticsOpen, viewMode, fetchDeferred]);

  const handleSimulate = useCallback(
    async (days: number) => {
      if (!id) return;
      setSimulating(true);
      try {
        await new Promise<void>((resolve, reject) => {
          api.simulateStream(id, days, {
            onEvent: (type, data) => {
              if (type === 'sim_event') {
                setEvents((prev) => [...prev, data]);
              }
            },
            onComplete: async () => {
              await fetchAll();
              resolve();
            },
            onError: (err) => reject(err),
          });
        });
      } catch {
        await fetchAll();
      } finally {
        setSimulating(false);
      }
    },
    [id, fetchAll]
  );

  // Auto-play sync
  useEffect(() => {
    autoPlayActiveRef.current = autoPlay;
  }, [autoPlay]);

  useEffect(() => {
    if (!autoPlay || !id || simulating) return;

    const tick = async () => {
      if (!autoPlayActiveRef.current) return;
      setSimulating(true);
      try {
        await api.simulate(id, 1);
        await fetchAll();
      } catch {
        setAutoPlay(false);
      } finally {
        setSimulating(false);
        if (autoPlayActiveRef.current) {
          autoPlayTimerRef.current = setTimeout(tick, 8000);
        }
      }
    };

    tick();

    return () => {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
    };
  }, [autoPlay, id, fetchAll]);

  const toggleAutoPlay = useCallback(() => {
    setAutoPlay((prev) => {
      if (!prev) setViewMode('map');
      return !prev;
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-page p-6">
        <div className="max-w-7xl mx-auto">
          <SkeletonBlock className="h-10 w-64 mb-6" />
          <SkeletonBlock className="h-8 w-96 mb-8" />
          <div className="flex gap-2 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonBlock key={i} className="h-12 w-32" />
            ))}
          </div>
          <SkeletonBlock className="h-[500px] w-full" />
        </div>
      </div>
    );
  }

  if (!world) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="text-center">
          <p className="text-sub text-lg mb-4">World not found</p>
          <Link to="/" className="text-gilt-500 hover:text-genesis-body transition-colors">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="border-b border-gilt-400/10 bg-page/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-dim hover:text-gilt-500 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-heading">{world.name}</h1>
                <p className="text-dim text-sm italic">&ldquo;{world.seed}&rdquo;</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-dim uppercase tracking-wider">Day</p>
                <p className="text-2xl font-mono font-bold text-gilt-500">{world.current_day}</p>
              </div>
              <VoiceNarrationButton active={voiceEnabled} narrationState={narrationState} onToggle={() => setVoiceEnabled((p) => !p)} onPause={pause} onResume={resume} onStop={stop} disabled={loading} />
              <button onClick={() => setAmbientEnabled((p) => !p)} title={ambientEnabled ? 'Disable Ambient Sound' : 'Enable Ambient Sound'} aria-label={ambientEnabled ? 'Disable Ambient Sound' : 'Enable Ambient Sound'} disabled={loading}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
 ambientEnabled ? 'text-moss-500 bg-moss-500/10 border border-moss-500/30' : 'text-sub hover:text-moss-500 hover:bg-hover'
 }`}>
                {ambientEnabled ? <Music2 className="w-4 h-4" /> : <Music className="w-4 h-4" />}
                <span className="hidden sm:inline">{ambientEnabled ? 'Ambient' : 'Ambient'}</span>
              </button>
              <button onClick={() => setShowCinematic(true)} title="Cinematic Mode (Live)" aria-label="Cinematic Mode (Live)" className="p-2 text-sub hover:text-gilt-500 hover:bg-hover rounded-lg transition-all">
                <Play className="w-5 h-5" />
              </button>
              {/* Tools overflow — secondary actions moved into a dropdown to
               * cut the 14-button density. Primary actions (cinematic,
               * voice/ambient, theme, autoplay, simulate) stay visible. */}
              <div ref={toolsRef} className="relative">
                <button
                  onClick={() => setToolsOpen((p) => !p)}
                  title="More tools"
                  aria-label="More tools"
                  aria-expanded={toolsOpen}
                  className={`p-2 rounded-lg transition-all ${
                    toolsOpen ? 'text-gilt-500 bg-gilt-500/10 border border-gilt-500/30' : 'text-sub hover:text-gilt-500 hover:bg-hover'
                  }`}
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
                {toolsOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-1 w-56 bg-page border border-subtle rounded-md shadow-2xl py-1 z-40"
                  >
                    <button role="menuitem" onClick={() => { setShowAgent((p) => !p); setToolsOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-sub hover:bg-hover hover:text-heading text-left transition-colors">
                      <Brain className="w-4 h-4 shrink-0" /> {showAgent ? 'Hide agent' : 'World master agent'}
                    </button>
                    <button role="menuitem" onClick={() => { setGodMode((p) => !p); setToolsOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-sub hover:bg-hover hover:text-heading text-left transition-colors">
                      <Zap className="w-4 h-4 shrink-0" /> {godMode ? 'Disable god mode' : 'God mode'}
                    </button>
                    <button role="menuitem" onClick={() => { setShowCouncil(true); setToolsOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-sub hover:bg-hover hover:text-heading text-left transition-colors">
                      <Swords className="w-4 h-4 shrink-0" /> Faction council
                    </button>
                    <button role="menuitem" onClick={() => { setShowChronicle(true); setToolsOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-sub hover:bg-hover hover:text-heading text-left transition-colors">
                      <BookOpen className="w-4 h-4 shrink-0" /> Generate chronicle
                    </button>
                    <button role="menuitem" onClick={() => { setShowReplay(true); setToolsOpen(false); }} disabled={events.length === 0} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-sub hover:bg-hover hover:text-heading text-left transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                      <History className="w-4 h-4 shrink-0" /> Replay history
                    </button>
                    <button role="menuitem" onClick={() => { setShowSessionPrep(true); setToolsOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-sub hover:bg-hover hover:text-heading text-left transition-colors">
                      <Sparkles className="w-4 h-4 shrink-0" /> Session prep
                    </button>
                    <button role="menuitem" onClick={() => { setShowCampaignKit(true); setToolsOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-sub hover:bg-hover hover:text-heading text-left transition-colors">
                      <Scroll className="w-4 h-4 shrink-0" /> Campaign kit (TTRPG)
                    </button>
                    <div className="border-t border-subtle my-1" />
                    <button
                      role="menuitem"
                      onClick={async () => {
                        setToolsOpen(false);
                        if (!id) return;
                        try {
                          const { text, filename } = await api.exportWorld(id);
                          const blob = new Blob([text], { type: 'text/markdown' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = filename;
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch { /* ignore */ }
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-sub hover:bg-hover hover:text-heading text-left transition-colors"
                    >
                      <Download className="w-4 h-4 shrink-0" /> Download world (markdown)
                    </button>
                  </div>
                )}
              </div>
              <ThemeToggle />
              <AutoPlayButton active={autoPlay} onToggle={toggleAutoPlay} disabled={loading} />
              <SimulateButton onSimulate={handleSimulate} loading={simulating || autoPlay} />
            </div>
          </div>
        </div>
      </div>

      {/* ── View Mode Selector ─────────────────────────────── */}
      <div className="border-b border-gilt-400/10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-1 py-1">
            {VIEW_MODES.map((vm) => {
              const isActive = viewMode === vm.key;
              return (
                <button
                  key={vm.key}
                  onClick={() => setViewMode(vm.key)}
                  className={`group flex items-center gap-2.5 px-5 py-3 text-sm font-medium rounded-lg transition-all ${
 isActive
 ? 'bg-gilt-600/15 text-gilt-500 border border-gilt-500/30'
 : 'text-dim hover:text-heading hover:bg-white/[0.04] border border-transparent'
 }`}
                >
                  <vm.icon className={`w-4.5 h-4.5 ${isActive ? 'text-gilt-500' : 'text-faint group-hover:text-sub'}`} />
                  <div className="text-left">
                    <div className="flex items-center gap-1.5">
                      {vm.label}
                      {vm.key === 'network' && characters.length > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-moss-500/15 text-moss-400 border border-moss-500/30">
                          {characters.filter(c => c.alive).length}
                        </span>
                      )}
                    </div>
                    <div className={`text-[10px] ${isActive ? 'text-gilt-500/70' : 'text-faint'}`}>
                      {vm.desc}
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Analytics toggle */}
            <div className="ml-auto">
              <button
                onClick={() => setAnalyticsOpen((p) => !p)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-lg transition-all ${
 analyticsOpen
 ? 'text-gilt-500 bg-gilt-600/10 border border-gilt-500/20'
 : 'text-dim hover:text-heading border border-subtle hover:border-subtle hover:bg-white/[0.04]'
 }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Analytics
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Autonomous Agent Panel ─────────────────────────── */}
      <AnimatePresence>
        {showAgent && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}
            className="max-w-7xl mx-auto px-6 pt-4">
            <Suspense fallback={<div className="flex items-center justify-center h-32"><div className="text-sub">Loading agent...</div></div>}>
              <AutonomousAgentPanel worldId={world.id} onRefresh={fetchAll} />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main View Content ──────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={viewMode}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {/* Theater Mode */}
            {viewMode === 'theater' && (
              <Suspense fallback={<SkeletonBlock className="h-[600px]" />}>
                <TheaterMode
                  events={events}
                  characters={characters}
                  factions={factions}
                  factionMap={mapData?.factions || {}}
                  currentDay={world.current_day}
                  ambientEnabled={ambientEnabled}
                  worldSeed={world.seed}
                />
              </Suspense>
            )}

            {/* Map Mode */}
            {viewMode === 'map' && mapData && (
              <div className="relative">
                <Suspense fallback={<SkeletonBlock className="h-[600px]" />}>
                  <WorldMap
                    geography={mapData.geography}
                    factionMap={mapData.factions}
                    characters={characters}
                    events={events}
                    currentDay={world.current_day}
                  />
                </Suspense>
                <ProphecyPanel prophecies={prophecies} />
              </div>
            )}

            {/* Network Mode */}
            {viewMode === 'network' && (
              <div>
                <Suspense fallback={<div className="flex items-center justify-center h-[600px]"><div className="text-sub">Loading relationship graph...</div></div>}>
                  <RelationshipGraph
                    characters={characters}
                    factions={factions}
                    onSelectCharacter={setGraphSelectedChar}
                  />
                </Suspense>
                <AnimatePresence>
                  {graphSelectedChar && (
                    <CharacterDetail
                      character={graphSelectedChar}
                      faction={factionMap[graphSelectedChar.faction_id]}
                      allCharacters={characters}
                      worldId={world.id}
                      onClose={() => setGraphSelectedChar(null)}
                    />
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Chronicle Mode */}
            {viewMode === 'chronicle' && (
              <Suspense fallback={<SkeletonBlock className="h-64" />}>
                <EventTimeline
                  events={events}
                  factions={factions}
                  characters={characters}
                />
              </Suspense>
            )}
          </motion.div>
        </AnimatePresence>

      </div>

      {/* ── God Mode Panel (fixed bottom bar) ────────────── */}
      <AnimatePresence>
        {godMode && (
          <motion.div
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 80 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed bottom-0 left-0 right-0 z-40 px-6 pb-4 pt-2"
          >
            <div className="max-w-4xl mx-auto">
              <Suspense fallback={<div className="text-sub p-4">Loading god mode...</div>}>
                <GodModePanel
                  worldId={world.id}
                  onIntervention={(event) => {
                    setEvents((prev) => [...prev, event]);
                    fetchAll();
                  }}
                />
              </Suspense>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Analytics Drawer (right sidebar) ──────────────── */}
      <Suspense fallback={null}>
        <AnalyticsDrawer
          open={analyticsOpen}
          onClose={() => setAnalyticsOpen(false)}
          factions={factions}
          characters={characters}
          evolution={evolution}
          factionTimeline={factionTimeline}
          worldId={world.id}
        />
      </Suspense>

      {/* ── Modals (unchanged) ─────────────────────────────── */}
      {showChronicle && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"><div className="text-white/60">Loading...</div></div>}>
          <ChronicleModal worldId={world.id} worldName={world.name} onClose={() => setShowChronicle(false)} />
        </Suspense>
      )}
      {showCouncil && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"><div className="text-white/60">Loading...</div></div>}>
          <CouncilModal worldId={world.id} factions={factions} onClose={() => setShowCouncil(false)} />
        </Suspense>
      )}
      {showCampaignKit && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"><div className="text-white/60">Loading...</div></div>}>
          <CampaignKitModal worldId={world.id} worldName={world.name} onClose={() => setShowCampaignKit(false)} />
        </Suspense>
      )}
      {showSessionPrep && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"><div className="text-white/60">Loading...</div></div>}>
          <SessionPrepModal worldId={world.id} worldName={world.name} onClose={() => setShowSessionPrep(false)} />
        </Suspense>
      )}
      {showCinematic && mapData && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black"><div className="text-white/60">Entering cinematic mode...</div></div>}>
          <CinematicMode
            worldId={world.id} worldName={world.name} worldSeed={world.seed} currentDay={world.current_day}
            geography={mapData.geography} factionMap={mapData.factions} characters={characters} events={events}
            onClose={() => setShowCinematic(false)}
            onNewEvents={(newEvents) => { setEvents((prev) => [...prev, ...newEvents]); fetchAll(); }}
            mode="live"
          />
        </Suspense>
      )}
      {showReplay && mapData && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black"><div className="text-white/60">Entering replay mode...</div></div>}>
          <CinematicMode
            worldId={world.id} worldName={world.name} worldSeed={world.seed} currentDay={world.current_day}
            geography={mapData.geography} factionMap={mapData.factions} characters={characters} events={events}
            onClose={() => setShowReplay(false)} onNewEvents={() => {}}
            mode="replay"
          />
        </Suspense>
      )}
    </div>
  );
}
