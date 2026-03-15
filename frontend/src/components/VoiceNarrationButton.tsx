import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Pause, Play, Square } from 'lucide-react';
import type { NarrationState } from '../hooks/useVoiceNarration';

interface Props {
  active: boolean;
  narrationState: NarrationState;
  onToggle: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  disabled: boolean;
}

export default function VoiceNarrationButton({
  active,
  narrationState,
  onToggle,
  onPause,
  onResume,
  onStop,
  disabled,
}: Props) {
  return (
    <div className="flex items-center gap-1">
      {/* Main toggle */}
      <motion.button
        whileHover={disabled ? {} : { scale: 1.02 }}
        whileTap={disabled ? {} : { scale: 0.98 }}
        onClick={onToggle}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-2.5 font-medium text-sm rounded-lg transition-all ${
          active
            ? 'bg-genesis-600/20 border border-genesis-500/50 text-genesis-400 shadow-[0_0_15px_rgba(201,168,76,0.15)]'
            : 'bg-white/[0.04] border border-subtle text-sub hover:text-heading hover:border-white/[0.15]'
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {active ? (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={`absolute inline-flex h-full w-full rounded-full bg-genesis-400 ${
                  narrationState === 'speaking' ? 'animate-ping opacity-75' : 'opacity-40'
                }`}
              />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-genesis-500" />
            </span>
            <span className="hidden sm:inline">
              {narrationState === 'speaking' ? 'VOICE' : narrationState === 'paused' ? 'PAUSED' : 'VOICE'}
            </span>
            <VolumeX className="w-3.5 h-3.5" />
          </>
        ) : (
          <>
            <Volume2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Narrate</span>
          </>
        )}
      </motion.button>

      {/* Pause / Resume / Stop controls — only visible when narration is active */}
      <AnimatePresence>
        {active && (narrationState === 'speaking' || narrationState === 'paused') && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-1 overflow-hidden"
          >
            {/* Pause / Resume */}
            <button
              onClick={narrationState === 'paused' ? onResume : onPause}
              title={narrationState === 'paused' ? 'Resume narration' : 'Pause narration'}
              className="p-2 rounded-lg text-genesis-400 hover:bg-genesis-500/15 transition-all"
            >
              {narrationState === 'paused' ? (
                <Play className="w-4 h-4" />
              ) : (
                <Pause className="w-4 h-4" />
              )}
            </button>

            {/* Stop */}
            <button
              onClick={onStop}
              title="Stop narration"
              className="p-2 rounded-lg text-red-400 hover:bg-red-500/15 transition-all"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
