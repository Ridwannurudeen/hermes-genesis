import { motion } from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';

interface Props {
  active: boolean;
  onToggle: () => void;
  disabled: boolean;
}

export default function VoiceNarrationButton({ active, onToggle, disabled }: Props) {
  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      onClick={onToggle}
      disabled={disabled}
      className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm rounded-lg transition-all ${
        active
          ? 'bg-violet-600/20 border border-violet-500/50 text-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.15)]'
          : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-300 hover:border-gray-600'
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {active ? (
        <>
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-500" />
          </span>
          <span>VOICE</span>
          <VolumeX className="w-3.5 h-3.5" />
        </>
      ) : (
        <>
          <Volume2 className="w-3.5 h-3.5" />
          <span>Narrate</span>
        </>
      )}
    </motion.button>
  );
}
