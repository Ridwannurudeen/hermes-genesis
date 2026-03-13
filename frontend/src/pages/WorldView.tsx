import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Map, Shield, Users, ScrollText, Dna, TrendingUp, LayoutGrid, Network, BookOpen, Zap, Swords } from 'lucide-react';
import { api } from '../api';
import type {
  World,
  Faction,
  Character,
  WorldEvent,
  EvolutionEntry,
  FactionSnapshot,
  Prophecy,
} from '../types';
import WorldMap from '../components/WorldMap';
import FactionDashboard from '../components/FactionDashboard';
import CharacterList from '../components/CharacterList';
import EventTimeline from '../components/EventTimeline';
import EvolutionView from '../components/EvolutionView';
import FactionPowerChart from '../components/FactionPowerChart';
import SimulateButton from '../components/SimulateButton';
import AutoPlayButton from '../components/AutoPlayButton';
import VoiceNarrationButton from '../components/VoiceNarrationButton';
import RelationshipGraph from '../components/RelationshipGraph';
import CharacterDetail from '../components/CharacterDetail';
import ChronicleModal from '../components/ChronicleModal';
import GodModePanel from '../components/GodModePanel';
import CouncilModal from '../components/CouncilModal';
import ProphecyPanel from '../components/ProphecyPanel';
import { useVoiceNarration } from '../hooks/useVoiceNarration';

type TabKey = 'map' | 'factions' | 'characters' | 'events' | 'evolution' | 'power';

const TABS: { key: TabKey; label: string; icon: typeof Map }[] = [
  { key: 'map', label: 'Map', icon: Map },
  { key: 'factions', label: 'Factions', icon: Shield },
  { key: 'characters', label: 'Characters', icon: Users },
  { key: 'events', label: 'Events', icon: ScrollText },
  { key: 'evolution', label: 'Evolution', icon: Dna },
  { key: 'power', label: 'Power', icon: TrendingUp },
];

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-gray-800 rounded-lg ${className || ''}`}
    />
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
  const [tab, setTab] = useState<TabKey>('map');
  const [charView, setCharView] = useState<'grid' | 'graph'>('grid');
  const [graphSelectedChar, setGraphSelectedChar] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [mapData, setMapData] = useState<{
    geography: { regions: any[]; connections: any[] };
    factions: Record<string, { name: string; color: string }>;
  } | null>(null);
  const [autoPlay, setAutoPlay] = useState(false);
  const [showChronicle, setShowChronicle] = useState(false);
  const [godMode, setGodMode] = useState(false);
  const [showCouncil, setShowCouncil] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoPlayActiveRef = useRef(false);
  const prevEventCountRef = useRef(0);

  const factionMap = useMemo(() => {
    const m: Record<string, Faction> = {};
    factions.forEach((f) => { m[f.id] = f; });
    return m;
  }, [factions]);

  const { speak } = useVoiceNarration(voiceEnabled);

  // Voice narration: speak new events from any source (simulate, auto-play, god mode)
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

  const fetchAll = useCallback(async () => {
    if (!id) return;
    try {
      const [w, m, f, c, e, ev, timeline, proph] = await Promise.all([
        api.getWorld(id),
        api.getMap(id),
        api.getFactions(id),
        api.getCharacters(id),
        api.getEvents(id),
        api.getEvolution(id),
        api.getFactionTimeline(id),
        api.getProphecies(id),
      ]);
      setWorld(w);
      setMapData(m);
      setFactions(f);
      setCharacters(c);
      setEvents(e);
      setEvolution(ev);
      setFactionTimeline(timeline);
      setProphecies(proph);
    } catch {
      // keep stale data visible
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

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
        // fallback: fetch all data anyway
        await fetchAll();
      } finally {
        setSimulating(false);
      }
    },
    [id, fetchAll]
  );

  // Keep ref in sync
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
        // Schedule next tick if still active
        if (autoPlayActiveRef.current) {
          autoPlayTimerRef.current = setTimeout(tick, 8000);
        }
      }
    };

    // Start first tick immediately
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
      if (!prev) {
        setTab('map'); // Switch to map to see markers
      }
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
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <SkeletonBlock key={i} className="h-10 w-28" />
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
          <Link
            to="/"
            className="text-genesis-400 hover:text-genesis-300 transition-colors"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="text-gray-500 hover:text-gray-300 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-100">
                  {world.name}
                </h1>
                <p className="text-gray-500 text-sm italic">
                  &ldquo;{world.seed}&rdquo;
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  Day
                </p>
                <p className="text-2xl font-mono font-bold text-genesis-400">
                  {world.current_day}
                </p>
              </div>
              <VoiceNarrationButton
                active={voiceEnabled}
                onToggle={() => setVoiceEnabled((prev) => !prev)}
                disabled={loading}
              />
              <button
                onClick={() => setGodMode((prev) => !prev)}
                title="God Mode"
                className={`p-2 rounded-lg transition-colors ${
                  godMode
                    ? 'text-amber-400 bg-amber-500/10 border border-amber-500/30'
                    : 'text-gray-400 hover:text-amber-400 hover:bg-gray-800'
                }`}
              >
                <Zap className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowCouncil(true)}
                title="Faction Council"
                className="p-2 text-gray-400 hover:text-amber-400 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <Swords className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowChronicle(true)}
                title="Generate Chronicle"
                className="p-2 text-gray-400 hover:text-genesis-400 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <BookOpen className="w-5 h-5" />
              </button>
              <AutoPlayButton
                active={autoPlay}
                onToggle={toggleAutoPlay}
                disabled={loading}
              />
              <SimulateButton
                onSimulate={handleSimulate}
                loading={simulating || autoPlay}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-genesis-500 text-genesis-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {tab === 'map' && mapData && (
              <div className="relative">
                <WorldMap
                  geography={mapData.geography}
                  factionMap={mapData.factions}
                  characters={characters}
                  events={events}
                  currentDay={world.current_day}
                />
                <ProphecyPanel prophecies={prophecies} />
                {godMode && (
                  <GodModePanel
                    worldId={world.id}
                    onIntervention={(event) => {
                      setEvents((prev) => [...prev, event]);
                      fetchAll();
                    }}
                  />
                )}
              </div>
            )}
            {tab === 'factions' && (
              <FactionDashboard
                factions={factions}
                characters={characters}
              />
            )}
            {tab === 'characters' && (
              <div>
                {/* Grid / Graph toggle */}
                <div className="flex items-center gap-1 mb-4">
                  <button
                    onClick={() => setCharView('grid')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      charView === 'grid'
                        ? 'bg-gray-800 border-genesis-600 text-genesis-400'
                        : 'border-gray-800 text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                    Grid
                  </button>
                  <button
                    onClick={() => setCharView('graph')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      charView === 'graph'
                        ? 'bg-gray-800 border-genesis-600 text-genesis-400'
                        : 'border-gray-800 text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <Network className="w-4 h-4" />
                    Relationships
                  </button>
                </div>

                {charView === 'grid' ? (
                  <CharacterList
                    characters={characters}
                    factions={factions}
                    worldId={world.id}
                  />
                ) : (
                  <RelationshipGraph
                    characters={characters}
                    factions={factions}
                    onSelectCharacter={setGraphSelectedChar}
                  />
                )}

                {/* Character detail modal for graph view */}
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
            {tab === 'events' && (
              <EventTimeline
                events={events}
                factions={factions}
                characters={characters}
              />
            )}
            {tab === 'evolution' && <EvolutionView data={evolution} />}
            {tab === 'power' && (
              <FactionPowerChart
                snapshots={factionTimeline}
                factions={factions}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Chronicle Modal */}
      {showChronicle && (
        <ChronicleModal
          worldId={world.id}
          worldName={world.name}
          onClose={() => setShowChronicle(false)}
        />
      )}

      {/* Council Modal */}
      {showCouncil && (
        <CouncilModal
          worldId={world.id}
          factions={factions}
          onClose={() => setShowCouncil(false)}
        />
      )}
    </div>
  );
}
