import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe,
  Zap,
  Dna,
  Loader2,
  Trash2,
  Calendar,
  Brain,
  Swords,
  BookOpen,
  Github,
  ExternalLink,
  Wifi,
  WifiOff,
  ArrowRight,
  Sparkles,
  Map,
  Users,
  Scroll,
  Music,
  Eye,
  Crown,
} from 'lucide-react';
import { api } from '../api';
import ThemeToggle from '../components/ThemeToggle';
import type { WorldSummary } from '../types';

/* ── Constants ── */

const PLACEHOLDER_SEEDS = [
  'A dying fantasy kingdom where magic is fading and old gods demand sacrifice...',
  'Post-apocalyptic wasteland where three rival warlords fight over the last water source...',
  'Cyberpunk megacity where corporate AIs wage invisible wars through human proxies...',
  'Ancient Rome at the height of its power, but a prophecy foretells its fall...',
  'A generation ship where factions have forgotten they are in space...',
  'Norse mythology brought to life — Ragnarok approaches and the gods scheme...',
];

const STAGE_MAP: Record<string, string> = {
  geography: 'Charting geography and climate...',
  geography_done: 'Terrain mapped!',
  factions: 'Breathing life into factions...',
  factions_done: 'Factions established!',
  characters: 'Forging characters with unique genomes...',
  characters_done: 'Characters born!',
  assembling: 'Binding the atlas...',
  prophecies: 'The oracle speaks...',
  complete: 'World is alive!',
};

/* ── Tag inference ── */

function inferTag(seed: string): string {
  const s = seed.toLowerCase();
  if (/cyber|neon|corp|hack|ai\b|android|robot/.test(s)) return 'Cyberpunk';
  if (/space|ship|galact|planet|star|orbit|asteroid/.test(s)) return 'Sci-Fi';
  if (/apocalyp|wasteland|survive|ruin|collapse/.test(s)) return 'Post-Apocalyptic';
  if (/myth|god|norse|greek|olymp|ragnarok|zeus/.test(s)) return 'Mythology';
  if (/rome|empire|caesar|medieval|knight|king|queen|throne|castle/.test(s)) return 'Historical';
  if (/horror|undead|demon|curse|dark|shadow|blood/.test(s)) return 'Dark Fantasy';
  return 'Fantasy';
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return '';
  }
}

/* ── Sticky header ── */

function Header({ connected }: { connected: boolean }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-subtle">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-genesis-400" />
          <span className="font-display font-bold text-heading text-sm tracking-wide">
            HERMES GENESIS
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5" title={connected ? 'API connected' : 'API disconnected'}>
            {connected ? (
              <Wifi className="w-3.5 h-3.5 text-genesis-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-red-400" />
            )}
            <span className={`text-[11px] ${connected ? 'text-genesis-400' : 'text-red-400'}`}>
              {connected ? 'Online' : 'Offline'}
            </span>
          </div>
          <ThemeToggle />
          <a
            href="https://github.com/Ridwannurudeen/hermes-genesis"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg text-dim hover:text-heading hover:bg-hover transition-colors"
            aria-label="GitHub repository"
          >
            <Github className="w-4 h-4" />
          </a>
        </div>
      </div>
    </header>
  );
}

/* ── Footer ── */

function Footer() {
  return (
    <footer className="border-t border-subtle mt-40">
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 sm:grid-cols-3 gap-8">
        <div>
          <h4 className="text-sm font-semibold text-sub uppercase tracking-wider mb-3">
            Project
          </h4>
          <ul className="space-y-2">
            <li>
              <a
                href="https://github.com/Ridwannurudeen/hermes-genesis"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-dim hover:text-genesis-400 transition-colors flex items-center gap-1.5"
              >
                <Github className="w-3.5 h-3.5" />
                Repository
              </a>
            </li>
            <li>
              <a
                href="https://github.com/Ridwannurudeen/hermes-genesis#readme"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-dim hover:text-genesis-400 transition-colors flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Documentation
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-sub uppercase tracking-wider mb-3">
            Powered By
          </h4>
          <ul className="space-y-2">
            <li>
              <a
                href="https://nousresearch.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-dim hover:text-genesis-400 transition-colors flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Nous Research
              </a>
            </li>
            <li>
              <span className="text-sm text-faint">
                Hermes-4-70B
              </span>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-sub uppercase tracking-wider mb-3">
            Community
          </h4>
          <ul className="space-y-2">
            <li>
              <a
                href="https://discord.gg/nousresearch"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-dim hover:text-genesis-400 transition-colors flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Discord
              </a>
            </li>
            <li>
              <a
                href="https://x.com/NousResearch"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-dim hover:text-genesis-400 transition-colors flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                @NousResearch
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-subtle py-6 text-center">
        <p className="text-xs text-faint">
          Hermes Genesis &middot; Autonomous Living World Engine &middot; NousResearch Hackathon 2026
        </p>
      </div>
    </footer>
  );
}

/* ── Stagger animation variants ── */

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};

/* ── World card ── */

function WorldCard({
  world,
  onDelete,
  deletingId,
  onClick,
}: {
  world: WorldSummary;
  onDelete: (e: React.MouseEvent, id: string) => void;
  deletingId: string | null;
  onClick: () => void;
}) {
  const tag = inferTag(world.seed);
  const timestamp = world.created_at ? formatTime(world.created_at) : '';

  return (
    <motion.div
      variants={scaleIn}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={onClick}
      className="relative glass rounded-2xl p-5 cursor-pointer group overflow-hidden"
    >
      {/* Gradient accent at top */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-genesis-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Delete button */}
      <button
        onClick={(e) => onDelete(e, world.id)}
        disabled={deletingId === world.id}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-faint hover:text-red-400 hover:bg-hover opacity-0 group-hover:opacity-100 transition-all z-10"
        aria-label="Delete world"
      >
        {deletingId === world.id ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
      </button>

      {/* Content */}
      <h3 className="text-lg font-bold text-heading mb-1 pr-8 font-display">
        {world.name}
      </h3>
      <p className="text-dim text-sm mb-4 line-clamp-2 italic leading-relaxed">
        &ldquo;{world.seed}&rdquo;
      </p>

      {/* Meta row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-dim">
          {timestamp && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {timestamp}
            </span>
          )}
          <span className="flex items-center gap-1">
            Day {world.current_day}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-genesis-950/80 text-genesis-400 border border-genesis-800/50 text-[10px] font-medium uppercase tracking-wider">
            #{tag}
          </span>
        </div>

        {/* Explore button */}
        <span className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-700 text-dim group-hover:border-genesis-600 group-hover:bg-genesis-600 group-hover:text-white transition-all duration-200">
          Explore
          <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </motion.div>
  );
}

/* ── Main Landing ── */

export default function Landing() {
  const navigate = useNavigate();
  const [seed, setSeed] = useState('');
  const [loading, setLoading] = useState(false);
  const [stageMessage, setStageMessage] = useState('');
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);
  const abortRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    api
      .listWorlds()
      .then((w) => {
        setWorlds(w);
        setConnected(true);
      })
      .catch(() => setConnected(false));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % PLACEHOLDER_SEEDS.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.();
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    const trimmed = seed.trim();
    if (!trimmed) return;
    setLoading(true);
    setStageMessage('Weaving the fabric of reality...');
    setError(null);
    try {
      await new Promise<void>((resolve, reject) => {
        abortRef.current = api.createWorldStream(trimmed, {
          onProgress: (data) => {
            const msg = STAGE_MAP[data.stage] || data.detail || 'Working...';
            setStageMessage(msg);
          },
          onComplete: (data) => {
            navigate(`/world/${data.id}`);
            resolve();
          },
          onError: (err) => reject(err),
        });
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create world');
      setLoading(false);
    }
  }, [seed, navigate]);

  const handleDelete = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setDeletingId(id);
      try {
        await api.deleteWorld(id);
        setWorlds((prev) => prev.filter((w) => w.id !== id));
      } catch {
        // ignore
      } finally {
        setDeletingId(null);
      }
    },
    []
  );

  return (
    <div className="min-h-screen bg-page relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-animated opacity-15 pointer-events-none" />

      {/* Radial glow behind hero */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(201,168,76,0.09) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      <Header connected={connected} />

      {/* ── Chroniclon banner ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="relative z-20 max-w-5xl mx-auto px-6 mt-24"
      >
        <button
          onClick={() => navigate('/chronicle')}
          className="group w-full block text-left"
        >
          <div className="relative overflow-hidden rounded-xl border border-amber-700/40 bg-gradient-to-r from-amber-950/40 via-slate-900/60 to-slate-950/40 hover:border-amber-500/60 transition-colors">
            <div
              className="absolute inset-0 opacity-30 pointer-events-none"
              style={{
                background:
                  'radial-gradient(800px 200px at 80% 50%, rgba(251,191,36,0.18), transparent 60%)',
              }}
            />
            <div className="relative px-5 py-4 sm:px-6 sm:py-5 flex flex-wrap items-center gap-x-6 gap-y-3">
              <span className="text-[10px] uppercase tracking-[0.2em] text-amber-300/80 font-mono">
                new · chroniclon
              </span>
              <span className="font-serif text-base sm:text-lg text-slate-100 leading-snug">
                A wikipedia for a world that doesn't exist —{' '}
                <span className="text-amber-300/90">written autonomously</span>.
              </span>
              <span className="text-xs text-slate-500 hidden sm:inline">
                Hermes Agent + Kimi K2.6
              </span>
              <span className="ml-auto inline-flex items-center gap-1.5 text-amber-200/90 text-sm group-hover:text-amber-100">
                browse the canon <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </button>
      </motion.div>

      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-12 pb-16">
        {/* ── Hero ── */}
        <motion.section
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="text-center mb-28"
        >
          <motion.h1
            variants={fadeUp}
            className="text-shimmer text-6xl sm:text-7xl lg:text-8xl font-black tracking-tight font-display mb-6"
          >
            HERMES GENESIS
          </motion.h1>

          <motion.div variants={fadeUp} className="overflow-hidden mb-3">
            <motion.p
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="text-xl sm:text-2xl text-sub font-light"
            >
              Describe a world.{' '}
              <span className="text-genesis-400 font-normal">Watch it live.</span>{' '}
              <span className="text-dim">Watch it die.</span>
            </motion.p>
          </motion.div>

          <motion.p
            variants={fadeUp}
            className="text-sm text-dim max-w-xl mx-auto leading-relaxed mb-6"
          >
            An autonomous living world engine powered by{' '}
            <span className="text-sub">Hermes-4-70B</span>. AI agents govern
            civilizations, fulfill prophecies, and write history — no human input
            required.
          </motion.p>

          {/* Powered by badge */}
          <motion.div variants={fadeUp} className="flex items-center justify-center gap-3 mb-4">
            <a
              href="https://nousresearch.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-genesis-950/80 border border-genesis-700/30 hover:border-genesis-500/50 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-genesis-400" />
              <span className="text-xs font-medium text-genesis-body">Powered by</span>
              <span className="text-xs font-bold text-genesis-title">Hermes-4-70B</span>
              <span className="text-[10px] text-genesis-500">by Nous Research</span>
            </a>
          </motion.div>

          {/* Tech stack line */}
          <motion.div variants={fadeUp} className="flex items-center justify-center gap-2 flex-wrap mb-8">
            {['Genetic Simulation', 'Causal Event Engine', 'Autonomous AI Agents', 'Voice & Ambient Audio', 'Cinematic Mode'].map((tag, i) => (
              <span key={tag} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-genesis-800 text-xs">·</span>}
                <span className="text-[11px] text-genesis-500 tracking-wide">{tag}</span>
              </span>
            ))}
          </motion.div>

          {/* Quick create input */}
          <motion.div variants={fadeUp} className="max-w-xl mx-auto">
            <div className="flex gap-2">
              <input
                type="text"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder={PLACEHOLDER_SEEDS[placeholderIdx]}
                disabled={loading}
                className="flex-1 glass-input rounded-xl px-4 py-3 text-input text-sm placeholder-faint focus:outline-none focus:ring-2 focus:ring-genesis-500/40 disabled:opacity-50 font-light truncate"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleGenerate();
                }}
                aria-label="World seed description"
              />
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleGenerate}
                disabled={loading || !seed.trim()}
                className="shrink-0 px-5 py-3 bg-genesis-600 hover:bg-genesis-500 disabled:bg-genesis-900 disabled:text-genesis-700 text-white font-semibold text-sm rounded-xl transition-colors flex items-center gap-2 btn-glow disabled:shadow-none"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Globe className="w-4 h-4" />
                )}
                {loading ? stageMessage.split('...')[0] + '...' : 'Generate'}
              </motion.button>
            </div>
            <AnimatePresence mode="wait">
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="text-red-400 text-sm mt-2 text-center"
                  role="alert"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.section>

        {/* ── How It Works ── */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={stagger}
          className="mb-32"
        >
          <motion.div variants={fadeUp} className="text-center mb-12">
            <h2 className="text-2xl font-bold text-heading font-display mb-2">
              How It Works
            </h2>
            <p className="text-sm text-dim">
              From a single sentence to a living, breathing civilization.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                icon: BookOpen,
                title: 'Describe',
                text: 'Write a seed — any premise, any genre. A dying empire, a cyberpunk megacity, Norse Ragnarok. One sentence is all it takes.',
              },
              {
                step: '02',
                icon: Globe,
                title: 'Generate',
                text: 'Hermes builds an entire world: regions with terrain, factions with ideology, characters with genetic codes — all interconnected.',
              },
              {
                step: '03',
                icon: Swords,
                title: 'Simulate',
                text: 'Hit play and watch history unfold. Wars erupt, alliances shift, leaders fall, prophecies fulfill. Every event has consequences.',
              },
            ].map((item) => (
              <motion.div
                key={item.step}
                variants={scaleIn}
                className="glass rounded-2xl p-6 text-center relative overflow-hidden group"
              >
                <span className="absolute top-4 right-4 text-genesis-800/40 font-display text-4xl font-black">
                  {item.step}
                </span>
                <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gradient-to-br from-genesis-400/20 to-genesis-600/20 border border-genesis-400/20 flex items-center justify-center">
                  <item.icon className="w-6 h-6 text-genesis-400" />
                </div>
                <h3 className="text-lg font-bold text-genesis-title font-display mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-genesis-body leading-relaxed">
                  {item.text}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── Recent Worlds ── */}
        <AnimatePresence>
          {worlds.length > 0 && (
            <motion.section
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-50px' }}
              variants={stagger}
              className="mb-32"
            >
              <motion.div variants={fadeUp} className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-heading font-display">
                  Recent Worlds
                </h2>
                <span className="text-xs text-faint uppercase tracking-wider">
                  {worlds.length} world{worlds.length !== 1 ? 's' : ''}
                </span>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {worlds.map((w) => (
                  <WorldCard
                    key={w.id}
                    world={w}
                    onDelete={handleDelete}
                    deletingId={deletingId}
                    onClick={() => navigate(`/world/${w.id}`)}
                  />
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* ── What Genesis Creates ── */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={stagger}
          className="mb-32"
        >
          <motion.div variants={fadeUp} className="text-center mb-12">
            <h2 className="text-2xl font-bold text-heading font-display mb-2">
              One Sentence Creates All of This
            </h2>
            <p className="text-sm text-dim max-w-lg mx-auto">
              Every system is interconnected. One event changes everything.
            </p>
          </motion.div>

          {/* What gets generated */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {[
              { icon: Map, label: 'Regions', detail: '5+ with terrain, resources & borders', color: 'text-green-400' },
              { icon: Users, label: 'Factions', detail: 'Ideology, morale, territory & armies', color: 'text-blue-400' },
              { icon: Crown, label: 'Characters', detail: '12+ with genetics, roles & lineage', color: 'text-genesis-400' },
              { icon: Swords, label: 'Events', detail: 'Wars, alliances, betrayals, births', color: 'text-red-400' },
              { icon: Scroll, label: 'Prophecies', detail: 'Planted and fulfilled dynamically', color: 'text-purple-400' },
              { icon: Music, label: 'Soundtrack', detail: 'Reactive ambient music per event', color: 'text-cyan-400' },
            ].map((item) => (
              <motion.div
                key={item.label}
                variants={scaleIn}
                className="glass rounded-xl p-4 text-center group"
              >
                <item.icon className={`w-7 h-7 mx-auto mb-2 ${item.color} opacity-80`} />
                <p className="text-sm font-bold text-genesis-title font-display">{item.label}</p>
                <p className="text-[11px] text-genesis-400 mt-1 leading-snug">{item.detail}</p>
              </motion.div>
            ))}
          </div>

          {/* Core capabilities — no duplication */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { icon: Swords, title: 'Causal Events', desc: 'Every event has consequences. Betrayals trigger wars, wars cause successions, alliances reshape borders.', accent: 'from-amber-700 to-orange-800' },
              { icon: Dna, title: 'Genetic Evolution', desc: 'Characters reproduce, mutate, and die. Traits shift across generations through crossover and natural selection.', accent: 'from-genesis-500 to-genesis-700' },
              { icon: Zap, title: 'God Mode', desc: 'Intervene as a deity. Command storms, forge alliances, or reshape reality with natural language.', accent: 'from-yellow-600 to-amber-700' },
              { icon: Eye, title: 'Cinematic Mode', desc: 'AI-generated scene art, voice narration, and reactive ambient music — fully autonomous.', accent: 'from-genesis-400 to-genesis-600' },
              { icon: Brain, title: 'Autonomous Agent', desc: 'A World Master AI governs the simulation — observing, deciding, intervening without human input.', accent: 'from-amber-600 to-yellow-800' },
              { icon: BookOpen, title: 'Chronicle Export', desc: 'Export your world\'s history as epic lore, campaign kits, or session prep for tabletop RPGs.', accent: 'from-genesis-300 to-genesis-500' },
            ].map((item) => (
              <motion.div
                key={item.title}
                variants={scaleIn}
                className="glass rounded-xl p-4 border border-genesis-800/30"
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${item.accent} p-[1px] shrink-0`}>
                    <div className="w-full h-full rounded-lg bg-genesis-950/80 flex items-center justify-center">
                      <item.icon className="w-4 h-4 text-genesis-title" />
                    </div>
                  </div>
                  <h4 className="text-sm font-bold text-genesis-title font-display">{item.title}</h4>
                </div>
                <p className="text-[12px] text-genesis-body leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── Use Cases ── */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={stagger}
          className="mb-32"
        >
          <motion.div variants={fadeUp} className="text-center mb-12">
            <h2 className="text-2xl font-bold text-heading font-display mb-2">
              Built For
            </h2>
            <p className="text-sm text-dim">
              Whether you create worlds for fun or for work.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                title: 'Tabletop RPG',
                text: 'Generate campaign settings, lore, and NPCs in seconds. Export chronicles as session prep. Your next D&D campaign starts here.',
              },
              {
                title: 'Writers & Worldbuilders',
                text: 'Build rich, consistent worlds with emergent history. Let the simulation surprise you with plot twists you\'d never write yourself.',
              },
              {
                title: 'Game Developers',
                text: 'Prototype narrative systems and faction dynamics. Test how political AI behaves when left to govern itself.',
              },
              {
                title: 'AI Research & Education',
                text: 'Explore emergent behavior, causal reasoning, and multi-agent simulation. A sandbox for studying how LLMs model complex systems.',
              },
            ].map((item) => (
              <motion.div
                key={item.title}
                variants={scaleIn}
                className="glass rounded-2xl p-5 group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-2 rounded-full bg-genesis-400 shrink-0" />
                  <div>
                    <h3 className="text-base font-bold text-genesis-title font-display mb-1">
                      {item.title}
                    </h3>
                    <p className="text-sm text-genesis-body leading-relaxed">
                      {item.text}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── CTA — scroll back to top ── */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={stagger}
          className="max-w-2xl mx-auto mb-32 text-center"
        >
          <motion.div variants={fadeUp}>
            <h2 className="text-2xl font-bold text-heading font-display mb-2">
              Ready to Create?
            </h2>
            <p className="text-sm text-dim mb-6">
              Describe any world. Genesis will do the rest.
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="inline-flex items-center gap-2 px-8 py-4 bg-genesis-600 hover:bg-genesis-500 text-white font-semibold text-lg rounded-2xl transition-colors btn-glow"
            >
              <Globe className="w-5 h-5" />
              Generate World
            </motion.button>
          </motion.div>
        </motion.section>
      </main>

      <Footer />
    </div>
  );
}
