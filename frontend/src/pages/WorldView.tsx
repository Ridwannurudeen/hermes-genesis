import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Map, Network, ScrollText, TrendingUp,
  BookOpen, Zap, Swords, Brain, Scroll, Download,
  Play, Sparkles, History, Theater, BarChart3,
  Music, Music2,
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
import VoiceNarrationButton from '../components/VoiceNarrationButton';
import CharacterDetail from '../components/CharacterDetail';
import ProphecyPanel from '../components/ProphecyPanel';
import { useVoiceNarration } from '../hooks/useVoiceNarration';

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


function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-white/[0.06] rounded-lg ${className || ''}`} />
  );
}

export default function WorldView() {
  const { id } = useParams<{ id: string }>();
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
  const [showSessionPrep, setShowSessionPrep] = useState(false);
  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoPlayActiveRef = useRef(false);
  const prevEventCountRef = useRef(0);

  const factionMap = useMemo(() => {
    const m: Record<string, Faction> = {};
    factions.forEach((f) => { m[f.id] = f; });
    return m;
  }, [factions]);

  const { speak } = useVoiceNarration(voiceEnabled);

  // Voice narration: speak new events
  useEffect(() => {
    if (!voiceEnabled || events.length <= prevEventCountRef.current) {
      prevEventCountRef.current = events.length;
      return;
    }
    const newEvents = events.slice(prevEventCountRef.current);
    for (const ev of newEvents) {
      const text = ev.narrative || ev.title;
      if (text) speak(text);
    }
    prevEventCountRef.current = events.length;
  }, [events.length, voiceEnabled, speak]);

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
  }, [autoPlay, id]);

  const toggleAutoPlay = useCallback(() => {
    setAutoPlay((prev) => {
      if (!prev) setViewMode('map');
      return !prev;
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 p-6">
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
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-4">World not found</p>
          <Link to="/" className="text-genesis-400 hover:text-genesis-300 transition-colors">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="border-b border-white/[0.06] bg-gray-950/60 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-gray-500 hover:text-genesis-400 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-100">{world.name}</h1>
                <p className="text-gray-500 text-sm italic">&ldquo;{world.seed}&rdquo;</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Day</p>
                <p className="text-2xl font-mono font-bold text-genesis-400">{world.current_day}</p>
              </div>
              <VoiceNarrationButton active={voiceEnabled} onToggle={() => setVoiceEnabled((p) => !p)} disabled={loading} />
              <button onClick={() => setAmbientEnabled((p) => !p)} title={ambientEnabled ? 'Disable Ambient Sound' : 'Enable Ambient Sound'} disabled={loading}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  ambientEnabled ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30' : 'text-gray-400 hover:text-emerald-400 hover:bg-white/[0.06]'
                }`}>
                {ambientEnabled ? <Music2 className="w-4 h-4" /> : <Music className="w-4 h-4" />}
                <span className="hidden sm:inline">{ambientEnabled ? 'Ambient' : 'Ambient'}</span>
              </button>
              <button onClick={() => setShowAgent((p) => !p)} title="World Master Agent"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  showAgent ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/30' : 'text-gray-400 hover:text-cyan-400 hover:bg-white/[0.06]'
                }`}>
                <Brain className="w-5 h-5" />
                <span className="hidden sm:inline">Agent</span>
              </button>
              <button onClick={() => setGodMode((p) => !p)} title="God Mode"
                className={`p-2 rounded-lg transition-all ${
                  godMode ? 'text-amber-400 bg-amber-500/10 border border-amber-500/30' : 'text-gray-400 hover:text-amber-400 hover:bg-white/[0.06]'
                }`}>
                <Zap className="w-5 h-5" />
              </button>
              <button onClick={() => setShowCouncil(true)} title="Faction Council" className="p-2 text-gray-400 hover:text-amber-400 hover:bg-white/[0.06] rounded-lg transition-all">
                <Swords className="w-5 h-5" />
              </button>
              <button onClick={() => setShowChronicle(true)} title="Generate Chronicle" className="p-2 text-gray-400 hover:text-genesis-400 hover:bg-white/[0.06] rounded-lg transition-all">
                <BookOpen className="w-5 h-5" />
              </button>
              <button onClick={() => setShowCinematic(true)} title="Cinematic Mode (Live)" className="p-2 text-gray-400 hover:text-rose-400 hover:bg-white/[0.06] rounded-lg transition-all">
                <Play className="w-5 h-5" />
              </button>
              <button onClick={() => setShowReplay(true)} title="Replay History" disabled={events.length === 0}
                className="p-2 text-gray-400 hover:text-amber-400 hover:bg-white/[0.06] rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                <History className="w-5 h-5" />
              </button>
              <button onClick={() => setShowSessionPrep(true)} title="Session Prep" className="p-2 text-gray-400 hover:text-amber-400 hover:bg-white/[0.06] rounded-lg transition-all">
                <Sparkles className="w-5 h-5" />
              </button>
              <button onClick={() => setShowCampaignKit(true)} title="Campaign Kit (TTRPG)" className="p-2 text-gray-400 hover:text-amber-400 hover:bg-white/[0.06] rounded-lg transition-all">
                <Scroll className="w-5 h-5" />
              </button>
              <button
                onClick={async () => {
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
                title="Download World (Markdown)"
                className="p-2 text-gray-400 hover:text-emerald-400 hover:bg-white/[0.06] rounded-lg transition-all"
              >
                <Download className="w-5 h-5" />
              </button>
              <AutoPlayButton active={autoPlay} onToggle={toggleAutoPlay} disabled={loading} />
              <SimulateButton onSimulate={handleSimulate} loading={simulating || autoPlay} />
            </div>
          </div>
        </div>
      </div>

      {/* ── View Mode Selector ─────────────────────────────── */}
      <div className="border-b border-white/[0.06]">
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
                      ? 'bg-genesis-600/15 text-genesis-400 border border-genesis-500/30'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] border border-transparent'
                  }`}
                >
                  <vm.icon className={`w-4.5 h-4.5 ${isActive ? 'text-genesis-400' : 'text-gray-600 group-hover:text-gray-400'}`} />
                  <div className="text-left">
                    <div className="flex items-center gap-1.5">
                      {vm.label}
                      {vm.key === 'network' && characters.length > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-green-500/15 text-green-400 border border-green-500/30">
                          {characters.filter(c => c.alive).length}
                        </span>
                      )}
                    </div>
                    <div className={`text-[10px] ${isActive ? 'text-genesis-500/70' : 'text-gray-600'}`}>
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
                    ? 'text-genesis-400 bg-genesis-600/10 border border-genesis-500/20'
                    : 'text-gray-500 hover:text-gray-300 border border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.04]'
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
            <Suspense fallback={<div className="flex items-center justify-center h-32"><div className="text-gray-400">Loading agent...</div></div>}>
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
                {godMode && (
                  <Suspense fallback={<div className="text-gray-400 p-4">Loading god mode...</div>}>
                    <GodModePanel
                      worldId={world.id}
                      onIntervention={(event) => {
                        setEvents((prev) => [...prev, event]);
                        fetchAll();
                      }}
                    />
                  </Suspense>
                )}
              </div>
            )}

            {/* Network Mode */}
            {viewMode === 'network' && (
              <div>
                <Suspense fallback={<div className="flex items-center justify-center h-[600px]"><div className="text-gray-400">Loading relationship graph...</div></div>}>
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
            worldId={world.id} worldName={world.name} currentDay={world.current_day}
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
            worldId={world.id} worldName={world.name} currentDay={world.current_day}
            geography={mapData.geography} factionMap={mapData.factions} characters={characters} events={events}
            onClose={() => setShowReplay(false)} onNewEvents={() => {}}
            mode="replay"
          />
        </Suspense>
      )}
    </div>
  );
}
