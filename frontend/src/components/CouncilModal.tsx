import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Swords, Loader2 } from 'lucide-react';
import { api } from '../api';
import type { Faction } from '../types';

interface CouncilStatement {
  faction_id: string;
  leader_name: string;
  stance: string;
  statement: string;
  emotion: string;
}

interface CouncilData {
  topic: string;
  statements: CouncilStatement[];
  conclusion: string;
}

interface Props {
  worldId: string;
  factions: Faction[];
  onClose: () => void;
}

const STANCE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  supportive: { bg: 'bg-moss-500/20', text: 'text-moss-400', border: 'border-moss-500/40' },
  opposed: { bg: 'bg-crimson-500/20', text: 'text-crimson-400', border: 'border-crimson-500/40' },
  neutral: { bg: 'bg-ink-500/20', text: 'text-vellum-400', border: 'border-ink-500/40' },
  cautious: { bg: 'bg-gilt-500/20', text: 'text-gilt-400', border: 'border-gilt-500/40' },
};

const EMOTION_LABELS: Record<string, string> = {
  angry: 'Seething with rage',
  fearful: 'Voice trembling',
  triumphant: 'Beaming with pride',
  calculating: 'Eyes narrowing',
  desperate: 'Barely holding composure',
  hopeful: 'A glimmer in their eyes',
  defiant: 'Standing firm',
};

export default function CouncilModal({ worldId, factions, onClose }: Props) {
  const [data, setData] = useState<CouncilData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const factionColorMap: Record<string, string> = {};
  factions.forEach((f) => {
    factionColorMap[f.id] = f.color;
  });

  const factionNameMap: Record<string, string> = {};
  factions.forEach((f) => {
    factionNameMap[f.id] = f.name;
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getCouncil(worldId);
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to convene the council');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [worldId]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="bg-page/95 backdrop-blur-xl border border-subtle rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl shadow-black/50"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-subtle shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gilt-500/10 rounded-lg border border-gilt-500/30">
                <Swords className="w-5 h-5 text-gilt-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-heading">Faction Council</h2>
                {data && (
                  <p className="text-sm text-dim italic">{data.topic}</p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-dim hover:text-sub transition-colors rounded-lg hover:bg-hover"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {loading && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-8 h-8 text-gilt-400 animate-spin" />
                <p className="text-sub text-sm">The council is convening...</p>
                <p className="text-faint text-xs">Leaders are gathering their thoughts</p>
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <p className="text-crimson-400 text-sm">{error}</p>
                <button
                  onClick={onClose}
                  className="text-sm text-sub hover:text-heading transition-colors"
                >
                  Close
                </button>
              </div>
            )}

            {data && (
              <div className="space-y-4">
                {data.statements.map((stmt, idx) => {
                  const fColor = factionColorMap[stmt.faction_id] || '#6b7280';
                  const fName = factionNameMap[stmt.faction_id] || 'Unknown Faction';
                  const stanceStyle = STANCE_COLORS[stmt.stance] || STANCE_COLORS.neutral;
                  const emotionLabel = EMOTION_LABELS[stmt.emotion] || stmt.emotion;

                  return (
                    <motion.div
                      key={`${stmt.faction_id}-${idx}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.3, duration: 0.4, ease: 'easeOut' }}
                      className="relative bg-white/[0.03] rounded-xl p-5 border border-subtle"
                      style={{ borderLeftWidth: '4px', borderLeftColor: fColor }}
                    >
                      {/* Leader header */}
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <span className="text-base font-bold text-heading">
                            {stmt.leader_name}
                          </span>
                          <span className="text-sm text-dim ml-2">
                            of {fName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs px-2.5 py-0.5 rounded-full border ${stanceStyle.bg} ${stanceStyle.text} ${stanceStyle.border}`}
                          >
                            {stmt.stance}
                          </span>
                        </div>
                      </div>

                      {/* Emotion tag */}
                      <p className="text-xs text-faint italic mb-2">
                        {emotionLabel}
                      </p>

                      {/* Statement */}
                      <p className="text-sub text-[15px] leading-relaxed">
                        &ldquo;{stmt.statement}&rdquo;
                      </p>
                    </motion.div>
                  );
                })}

                {/* Conclusion */}
                {data.conclusion && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: data.statements.length * 0.3 + 0.2,
                      duration: 0.4,
                    }}
                    className="mt-6 p-4 bg-white/[0.03] border border-subtle rounded-xl text-center"
                  >
                    <p className="text-sm text-dim uppercase tracking-wider mb-1">
                      Council Verdict
                    </p>
                    <p className="text-sub italic">{data.conclusion}</p>
                  </motion.div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {data && (
            <div className="flex items-center justify-end px-6 py-4 border-t border-subtle shrink-0">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-sub hover:text-heading transition-colors"
              >
                Dismiss Council
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
