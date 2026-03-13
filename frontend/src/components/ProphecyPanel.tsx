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
        className="flex items-center gap-2 px-3 py-2 bg-gray-900/90 backdrop-blur border border-purple-900/50 rounded-lg text-purple-400 hover:text-purple-300 transition-colors"
      >
        <Eye className="w-4 h-4" />
        <span className="text-sm">Prophecies</span>
        {fulfilledCount > 0 && (
          <span className="bg-amber-500 text-black text-xs font-bold px-1.5 py-0.5 rounded-full">
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
            className="mt-2 w-80 bg-gray-950/95 backdrop-blur border border-purple-900/30 rounded-xl overflow-hidden"
          >
            <div className="p-3 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-purple-400 flex items-center gap-2">
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
                      ? 'border-amber-500/50 bg-amber-950/20'
                      : 'border-gray-800 bg-gray-900/50'
                  }`}
                >
                  <p className={`text-sm italic leading-relaxed ${
                    p.fulfilled ? 'text-amber-300' : 'text-gray-400'
                  }`}>
                    "{p.text}"
                  </p>
                  {p.fulfilled && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-amber-500">
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
