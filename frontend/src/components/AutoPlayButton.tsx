import { motion } from 'framer-motion';
import { Play, Pause } from 'lucide-react';

interface Props {
  active: boolean;
  onToggle: () => void;
  disabled: boolean;
}

export default function AutoPlayButton({ active, onToggle, disabled }: Props) {
  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      onClick={onToggle}
      disabled={disabled}
      className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm rounded-lg transition-all ${
 active
 ? 'bg-genesis-600/20 border border-genesis-500/50 text-genesis-400 shadow-[0_0_15px_rgba(201,168,76,0.15)]'
 : 'bg-white/[0.04] border border-subtle text-sub hover:text-heading hover:border-white/[0.15]'
 } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {active ? (
        <>
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-genesis-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-genesis-500" />
          </span>
          <span>LIVE</span>
          <Pause className="w-3.5 h-3.5" />
        </>
      ) : (
        <>
          <Play className="w-3.5 h-3.5" />
          <span>Auto-play</span>
        </>
      )}
    </motion.button>
  );
}
