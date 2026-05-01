import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Loader2 } from 'lucide-react';
import { api } from '../api';
import type { WorldEvent } from '../types';

interface Props {
  worldId: string;
  onIntervention: (event: WorldEvent) => void;
}

export default function GodModePanel({ worldId, onIntervention }: Props) {
  const [command, setCommand] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ title: string; narrative: string } | null>(null);
  const [recentCommands, setRecentCommands] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resultTimer.current) clearTimeout(resultTimer.current);
    };
  }, []);

  const handleSubmit = async () => {
    const trimmed = command.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await api.intervene(worldId, trimmed);

      // Update recent commands (keep last 3)
      setRecentCommands((prev) => {
        const next = [trimmed, ...prev.filter((c) => c !== trimmed)];
        return next.slice(0, 3);
      });

      // Show result notification
      setResult({
        title: res.event.title,
        narrative: res.event.narrative,
      });

      // Auto-dismiss after 5 seconds
      if (resultTimer.current) clearTimeout(resultTimer.current);
      resultTimer.current = setTimeout(() => setResult(null), 5000);

      // Notify parent
      onIntervention(res.event);
      setCommand('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Divine intervention failed');
      setTimeout(() => setError(null), 4000);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleSubmit();
    }
  };

  return (
    <div className="relative mt-4">
      {/* Result notification */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="absolute bottom-full left-0 right-0 mb-3 px-4"
          >
            <div className="bg-page/90 backdrop-blur-xl border border-gilt-500/30 rounded-lg p-4 shadow-lg shadow-gilt-600/20">
              <p className="text-gilt-400 font-bold text-sm mb-1">
                {'\u26A1'} {result.title}
              </p>
              <p className="text-sub text-sm leading-relaxed">
                {result.narrative}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error notification */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-full left-0 right-0 mb-3 px-4"
          >
            <div className="bg-crimson-600/90 border border-crimson-500/30 rounded-lg p-3">
              <p className="text-crimson-400 text-sm">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main panel */}
      <div className="bg-surface border border-subtle border-t border-gilt-500/30 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Command your world..."
              disabled={loading}
              className="w-full bg-surface border border-subtle focus:border-gilt-500/60 transition-colors rounded-lg px-4 py-2.5 text-input placeholder-dim text-sm
 focus:outline-none focus:ring-2 focus:ring-gilt-500/40 focus:border-gilt-500/50
 disabled:opacity-50 disabled:cursor-not-allowed
 duration-200"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading || !command.trim()}
            className="flex items-center justify-center w-10 h-10 rounded-lg
 bg-gilt-500/20 border border-gilt-500/30 text-gilt-400
 hover:bg-gilt-500/30 hover:text-gilt-600 dark:hover:text-gilt-400
 disabled:opacity-40 disabled:cursor-not-allowed
 transition-all duration-200"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Zap className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Recent commands chips */}
        {recentCommands.length > 0 && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-faint text-xs">Recent:</span>
            {recentCommands.map((cmd) => (
              <button
                key={cmd}
                onClick={() => setCommand(cmd)}
                disabled={loading}
                className="text-xs px-2 py-0.5 rounded-full bg-white/[0.04] border border-subtle text-sub
 hover:text-gilt-600 dark:hover:text-gilt-400 hover:border-gilt-500/30 transition-colors
 disabled:opacity-50 disabled:cursor-not-allowed truncate max-w-[200px]"
              >
                {cmd}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
