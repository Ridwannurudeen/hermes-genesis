import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, ChevronDown, Loader2 } from 'lucide-react';

interface Props {
  onSimulate: (days: number) => Promise<void>;
  loading: boolean;
}

const OPTIONS = [
  { label: 'Advance 1 Day', days: 1 },
  { label: 'Advance 5 Days', days: 5 },
  { label: 'Advance 10 Days', days: 10 },
];

export default function SimulateButton({ onSimulate, loading }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(e.target as Node)
    ) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  const handlePrimary = () => {
    if (loading) return;
    onSimulate(OPTIONS[selected].days);
  };

  const handleOption = (idx: number) => {
    setSelected(idx);
    setOpen(false);
    if (!loading) {
      onSimulate(OPTIONS[idx].days);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex">
        {/* Main button */}
        <motion.button
          whileHover={loading ? {} : { scale: 1.02 }}
          whileTap={loading ? {} : { scale: 0.98 }}
          onClick={handlePrimary}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-genesis-600 hover:bg-genesis-500 disabled:bg-genesis-800 disabled:text-genesis-500 text-white font-medium text-sm rounded-l-lg transition-colors"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          <span>{loading ? 'Simulating...' : OPTIONS[selected].label}</span>
        </motion.button>

        {/* Dropdown toggle */}
        <button
          onClick={() => setOpen(!open)}
          disabled={loading}
          className="px-2 py-2.5 bg-genesis-700 hover:bg-genesis-600 disabled:bg-genesis-900 text-white rounded-r-lg border-l border-genesis-500/30 transition-colors"
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {/* Dropdown menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1 bg-page/95 backdrop-blur-xl border border-genesis-300/10 rounded-lg shadow-xl overflow-hidden z-20 min-w-[180px]"
          >
            {OPTIONS.map((opt, idx) => (
              <button
                key={opt.days}
                onClick={() => handleOption(idx)}
                className={`w-full px-4 py-2.5 text-sm text-left transition-colors flex items-center gap-2 ${
                  idx === selected
                    ? 'bg-genesis-900/50 text-genesis-400'
                    : 'text-sub hover:bg-hover'
                }`}
              >
                <Play className="w-3 h-3" />
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
