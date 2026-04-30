import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Sparkles, Check } from 'lucide-react';
import type { Prophecy } from '../types';

interface Props {
  prophecies: Prophecy[];
}

export default function ProphecyPanel({ prophecies }: Props) {
  const [expanded, setExpanded] = useState(false);
  const fulfilledCount = prophecies.filter(p => p.fulfilled).length;

  if (prophecies.length === 0) return null;

  return (
    <div className="absolute top-4 right-4 z-20">
      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] backdrop-blur-xl border border-genesis-400/30 rounded-lg text-genesis-400 hover:text-genesis-300 hover:bg-hover transition-all"
      >
        <Eye className="w-4 h-4" />
        <span className="text-sm">Prophecies</span>
        {fulfilledCount > 0 && (
          <span className="bg-gilt-500 text-black text-xs font-bold px-1.5 py-0.5 rounded-full">
            {fulfilledCount}
          </span>
        )}
      </button>

      {/* Panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="mt-2 w-72 sm:w-80 bg-page/90 backdrop-blur-xl border border-genesis-400/20 rounded-xl overflow-hidden shadow-xl shadow-genesis-900/10"
          >
            <div className="p-3 border-b border-subtle">
              <h3 className="text-sm font-semibold text-genesis-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Oracle's Prophecies
              </h3>
            </div>
            <div className="max-h-64 overflow-y-auto p-2 space-y-2">
              {prophecies.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`p-3 rounded-lg border ${
                    p.fulfilled
                      ? 'border-gilt-500/50 bg-gilt-600/20'
                      : 'border-subtle bg-white/[0.03]'
                  }`}
                >
                  <p className={`text-sm italic leading-relaxed ${
                    p.fulfilled ? 'text-gilt-400' : 'text-sub'
                  }`}>
                    "{p.text}"
                  </p>
                  {p.fulfilled && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-gilt-500">
                      <Check className="w-3 h-3" />
                      Fulfilled on Day {p.fulfilled_day}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
