import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Zap, Dna, Loader2, Trash2, Calendar, Sparkles } from 'lucide-react';
import { api } from '../api';
import type { WorldSummary } from '../types';

const PLACEHOLDER_SEEDS = [
  'A dying fantasy kingdom where magic is fading...',
  'Post-apocalyptic wasteland with three rival settlements...',
  'Cyberpunk megacity with corporate warfare...',
  'Ancient civilization at the peak of its power...',
  'Space colony on a hostile planet...',
];

const STAGE_MESSAGES = [
  'Weaving the fabric of reality...',
  'Shaping geography and climate...',
  'Breathing life into factions...',
  'Forging characters with unique genomes...',
  'Establishing alliances and rivalries...',
  'Writing the opening chapter...',
];

const features = [
  {
    icon: Globe,
    title: 'Generate',
    description:
      'Describe any world concept and watch it materialize with regions, factions, and characters — each with unique genetic traits.',
  },
  {
    icon: Zap,
    title: 'Simulate',
    description:
      'Advance time day by day. Wars erupt, alliances form, leaders fall. Every event emerges from character motivations and faction dynamics.',
  },
  {
    icon: Dna,
    title: 'Evolve',
    description:
      'Characters reproduce, mutate, and die. Track how courage, cunning, loyalty, and other traits shift across generations.',
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const [seed, setSeed] = useState('');
  const [loading, setLoading] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    api.listWorlds().then(setWorlds).catch(() => {});
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % PLACEHOLDER_SEEDS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setStageIdx((i) => (i + 1) % STAGE_MESSAGES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [loading]);

  const handleGenerate = useCallback(async () => {
    const trimmed = seed.trim();
    if (!trimmed) return;
    setLoading(true);
    setStageIdx(0);
    setError(null);
    try {
      const result = await api.createWorld(trimmed);
      navigate(`/world/${result.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create world');
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
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-animated opacity-20 pointer-events-none" />
      <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 max-w-5xl mx-auto px-6 py-16"
      >
        {/* Hero */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-center mb-16"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Sparkles className="w-8 h-8 text-genesis-400" />
            <h1 className="text-6xl font-black tracking-tight bg-gradient-to-r from-genesis-400 via-emerald-300 to-genesis-500 bg-clip-text text-transparent">
              HERMES GENESIS
            </h1>
            <Sparkles className="w-8 h-8 text-genesis-400" />
          </div>
          <p className="text-xl text-gray-400 font-light">
            Describe a world. Watch it live.
          </p>
        </motion.div>

        {/* Seed Input */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="max-w-2xl mx-auto mb-16"
        >
          <div className="relative">
            <textarea
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder={PLACEHOLDER_SEEDS[placeholderIdx]}
              rows={4}
              disabled={loading}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-5 py-4 text-gray-100 text-lg placeholder-gray-600 focus:outline-none focus:border-genesis-500 focus:ring-1 focus:ring-genesis-500/50 resize-none transition-colors disabled:opacity-50"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate();
              }}
            />
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="text-red-400 text-sm mt-2 text-center"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleGenerate}
            disabled={loading || !seed.trim()}
            className="mt-4 w-full py-4 bg-genesis-600 hover:bg-genesis-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold text-lg rounded-xl transition-colors flex items-center justify-center gap-3"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{STAGE_MESSAGES[stageIdx]}</span>
              </>
            ) : (
              <>
                <Globe className="w-5 h-5" />
                Generate World
              </>
            )}
          </motion.button>

          <p className="text-gray-600 text-sm text-center mt-2">
            Press Ctrl+Enter to generate
          </p>
        </motion.div>

        {/* Feature Cards */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20"
        >
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 + i * 0.1 }}
              className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-genesis-700 transition-colors group"
            >
              <feature.icon className="w-10 h-10 text-genesis-400 mb-4 group-hover:text-genesis-300 transition-colors" />
              <h3 className="text-lg font-bold text-gray-100 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Recent Worlds */}
        {worlds.length > 0 && (
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.6 }}
          >
            <h2 className="text-2xl font-bold text-gray-100 mb-6">
              Recent Worlds
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {worlds.map((w) => (
                <motion.div
                  key={w.id}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => navigate(`/world/${w.id}`)}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-5 cursor-pointer hover:border-genesis-700 transition-colors group relative"
                >
                  <button
                    onClick={(e) => handleDelete(e, w.id)}
                    disabled={deletingId === w.id}
                    className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-gray-800 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    {deletingId === w.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                  <h3 className="text-lg font-semibold text-gray-100 mb-1 pr-8">
                    {w.name}
                  </h3>
                  <p className="text-gray-500 text-sm mb-3 line-clamp-2 italic">
                    &ldquo;{w.seed}&rdquo;
                  </p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Day {w.current_day}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        w.status === 'active'
                          ? 'bg-genesis-900/50 text-genesis-400'
                          : 'bg-gray-800 text-gray-500'
                      }`}
                    >
                      {w.status}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
