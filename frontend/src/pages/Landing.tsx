import { useState, useEffect, useCallback } from 'react';
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
  Command,
  Sparkles,
} from 'lucide-react';
import { api } from '../api';
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
  geography: 'Shaping geography and climate...',
  geography_done: 'Terrain mapped!',
  factions: 'Breathing life into factions...',
  factions_done: 'Factions established!',
  characters: 'Forging characters with unique genomes...',
  characters_done: 'Characters born!',
  assembling: 'Assembling the world...',
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

/* ── Bento feature data ── */

const FEATURES = [
  {
    icon: Globe,
    title: 'Genesis',
    description:
      'Describe any world in natural language. Watch it materialize with regions, factions, and characters — each carrying a unique genetic code that shapes their destiny.',
    size: 'large' as const,
    accent: 'from-genesis-400 to-violet-500',
  },
  {
    icon: Swords,
    title: 'Causal Events',
    description:
      'Every event has consequences. Betrayals trigger wars, wars cause successions, alliances reshape borders.',
    size: 'medium' as const,
    accent: 'from-amber-400 to-orange-500',
  },
  {
    icon: Dna,
    title: 'Evolve',
    description:
      'Characters reproduce, mutate, and die. Traits shift across generations through genetic crossover and natural selection.',
    size: 'medium' as const,
    accent: 'from-violet-400 to-purple-500',
  },
  {
    icon: Brain,
    title: 'Autonomous AI',
    description:
      'An autonomous World Master agent governs your world — triggering interventions, fulfilling prophecies, and weaving narrative arcs without human input.',
    size: 'large' as const,
    accent: 'from-cyan-400 to-blue-500',
  },
  {
    icon: Zap,
    title: 'God Mode',
    description:
      'Intervene as a deity. Command storms, forge alliances, or let the AI handle everything.',
    size: 'small' as const,
    accent: 'from-yellow-400 to-amber-500',
  },
  {
    icon: BookOpen,
    title: 'Chronicle',
    description:
      'Export your world\'s history as an epic narrative you can read and share.',
    size: 'small' as const,
    accent: 'from-rose-400 to-pink-500',
  },
];

/* ── Sticky header ── */

function Header({ connected }: { connected: boolean }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-genesis-400" />
          <span className="font-display font-bold text-white/90 text-sm tracking-wide">
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
          <a
            href="https://github.com/Ridwannurudeen/hermes-genesis"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
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
    <footer className="border-t border-white/5 mt-32">
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 sm:grid-cols-3 gap-8">
        <div>
          <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Project
          </h4>
          <ul className="space-y-2">
            <li>
              <a
                href="https://github.com/Ridwannurudeen/hermes-genesis"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 hover:text-genesis-400 transition-colors flex items-center gap-1.5"
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
                className="text-sm text-gray-500 hover:text-genesis-400 transition-colors flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Documentation
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Powered By
          </h4>
          <ul className="space-y-2">
            <li>
              <a
                href="https://nousresearch.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 hover:text-genesis-400 transition-colors flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Nous Research
              </a>
            </li>
            <li>
              <span className="text-sm text-gray-600">
                Hermes-4-70B
              </span>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Community
          </h4>
          <ul className="space-y-2">
            <li>
              <a
                href="https://discord.gg/nousresearch"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 hover:text-genesis-400 transition-colors flex items-center gap-1.5"
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
                className="text-sm text-gray-500 hover:text-genesis-400 transition-colors flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                @NousResearch
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5 py-6 text-center">
        <p className="text-xs text-gray-600">
          Hermes Genesis &middot; Autonomous Living World Engine &middot; NousResearch Hackathon 2026
        </p>
      </div>
    </footer>
  );
}

/* ── Stagger animation variants ── */

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

/* ── Bento feature card ── */

function FeatureCard({
  feature,
}: {
  feature: (typeof FEATURES)[number];
}) {
  const Icon = feature.icon;
  const sizeClasses =
    feature.size === 'large'
      ? 'md:col-span-2'
      : feature.size === 'small'
        ? 'md:col-span-1'
        : 'md:col-span-1';

  return (
    <motion.div
      variants={scaleIn}
      className={`${sizeClasses} card-glow glass rounded-2xl p-6 group cursor-default`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${feature.accent} p-[1px]`}
        >
          <div className="w-full h-full rounded-xl bg-gray-950/80 flex items-center justify-center">
            <Icon className="w-5 h-5 text-white icon-aura" />
          </div>
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-white mb-1 font-display">
            {feature.title}
          </h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            {feature.description}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

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
        className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all z-10"
        aria-label="Delete world"
      >
        {deletingId === world.id ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
      </button>

      {/* Content */}
      <h3 className="text-lg font-bold text-white mb-1 pr-8 font-display">
        {world.name}
      </h3>
      <p className="text-gray-500 text-sm mb-4 line-clamp-2 italic leading-relaxed">
        &ldquo;{world.seed}&rdquo;
      </p>

      {/* Meta row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-gray-500">
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
        <span className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-700 text-gray-500 group-hover:border-genesis-600 group-hover:bg-genesis-600 group-hover:text-white transition-all duration-200">
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

  const handleGenerate = useCallback(async () => {
    const trimmed = seed.trim();
    if (!trimmed) return;
    setLoading(true);
    setStageMessage('Weaving the fabric of reality...');
    setError(null);
    try {
      await new Promise<void>((resolve, reject) => {
        api.createWorldStream(trimmed, {
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
    <div className="min-h-screen bg-gray-950 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-animated opacity-15 pointer-events-none" />

      {/* Radial glow behind hero */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(167,139,250,0.08) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      <Header connected={connected} />

      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-28 pb-12">
        {/* ── Hero ── */}
        <motion.section
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="text-center mb-20"
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
              className="text-xl sm:text-2xl text-gray-300 font-light"
            >
              Describe a world.{' '}
              <span className="text-genesis-400 font-normal">Watch it live.</span>{' '}
              <span className="text-gray-500">Watch it die.</span>
            </motion.p>
          </motion.div>

          <motion.p
            variants={fadeUp}
            className="text-sm text-gray-500 max-w-xl mx-auto leading-relaxed"
          >
            An autonomous living world engine powered by{' '}
            <span className="text-gray-400">Hermes-4-70B</span>. AI agents govern
            civilizations, fulfill prophecies, and write history — no human input
            required.
          </motion.p>
        </motion.section>

        {/* ── Seed Input ── */}
        <motion.section
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="max-w-2xl mx-auto mb-24"
        >
          <motion.div variants={fadeUp}>
            <textarea
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder={PLACEHOLDER_SEEDS[placeholderIdx]}
              rows={4}
              disabled={loading}
              className="w-full glass-input rounded-2xl px-6 py-5 text-gray-100 text-lg placeholder-gray-600 focus:outline-none resize-none disabled:opacity-50 font-light"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate();
              }}
              aria-label="World seed description"
            />
          </motion.div>

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

          <motion.div variants={fadeUp} className="mt-4">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGenerate}
              disabled={loading || !seed.trim()}
              className="w-full py-4 bg-genesis-600 hover:bg-genesis-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold text-lg rounded-2xl transition-colors flex items-center justify-center gap-3 btn-glow disabled:shadow-none"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{stageMessage}</span>
                </>
              ) : (
                <>
                  <Globe className="w-5 h-5" />
                  Generate World
                </>
              )}
            </motion.button>

            <p className="text-gray-600 text-xs text-center mt-3 flex items-center justify-center gap-1.5">
              <Command className="w-3 h-3" />
              <span>Ctrl + Enter to generate</span>
            </p>
          </motion.div>
        </motion.section>

        {/* ── Bento Feature Grid ── */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={stagger}
          className="mb-24"
        >
          <motion.div variants={fadeUp} className="text-center mb-10">
            <h2 className="text-2xl font-bold text-white font-display mb-2">
              Built for Living Worlds
            </h2>
            <p className="text-sm text-gray-500">
              Every system is interconnected. One event changes everything.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {FEATURES.map((feature) => (
              <FeatureCard key={feature.title} feature={feature} />
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
            >
              <motion.div variants={fadeUp} className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white font-display">
                  Recent Worlds
                </h2>
                <span className="text-xs text-gray-600 uppercase tracking-wider">
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
      </main>

      <Footer />
    </div>
  );
}
