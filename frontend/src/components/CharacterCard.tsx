import { motion } from 'framer-motion';
import { Skull, Activity } from 'lucide-react';
import type { Character, Faction } from '../types';
import { MiniGenomeBars } from './GenomeRadar';

interface Props {
  character: Character;
  faction: Faction | undefined;
  onClick: () => void;
}

export default function CharacterCard({ character, faction, onClick }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
      className="bg-gray-900 border border-gray-800 rounded-xl p-4 cursor-pointer hover:border-gray-700 transition-colors"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`font-semibold truncate ${
                character.alive ? 'text-gray-100' : 'text-gray-500 line-through'
              }`}
            >
              {character.name}
            </span>
            {!character.alive && (
              <Skull className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-gray-800 text-gray-400 rounded text-xs capitalize">
              {character.role}
            </span>
          </div>
        </div>
      </div>

      {/* Faction + Age row */}
      <div className="flex items-center gap-3 mb-3 text-xs text-gray-500">
        {faction && (
          <span className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: faction.color }}
            />
            {faction.name}
          </span>
        )}
        <span>Age {character.age}</span>
      </div>

      {/* Mini genome bars */}
      <div className="mb-3">
        <MiniGenomeBars genome={character.genome} />
      </div>

      {/* Fitness */}
      <div className="flex items-center gap-2">
        <Activity className="w-3 h-3 text-genesis-500" />
        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-genesis-500"
            style={{ width: `${Math.max(2, character.fitness * 100)}%` }}
          />
        </div>
        <span className="text-xs text-gray-400 font-mono">
          {(character.fitness * 100).toFixed(0)}
        </span>
      </div>
    </motion.div>
  );
}
