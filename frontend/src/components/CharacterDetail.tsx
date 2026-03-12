import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Skull,
  Activity,
  Target,
  Users,
  GitBranch,
  Dna,
  MessageCircle,
} from 'lucide-react';
import type { Character, Faction } from '../types';
import { TRAIT_COLORS } from '../types';
import GenomeRadar from './GenomeRadar';
import CharacterChatModal from './CharacterChatModal';

interface Props {
  character: Character;
  faction: Faction | undefined;
  allCharacters: Character[];
  worldId: string;
  onClose: () => void;
}

function RelationshipBadge({
  type,
  intensity,
}: {
  type: string;
  intensity: number;
}) {
  const bgColor =
    type === 'enemy' || type === 'rival'
      ? 'bg-red-900/30 border-red-800/40 text-red-400'
      : type === 'ally' || type === 'friend'
      ? 'bg-green-900/30 border-green-800/40 text-green-400'
      : type === 'love' || type === 'family'
      ? 'bg-pink-900/30 border-pink-800/40 text-pink-400'
      : 'bg-gray-800 border-gray-700 text-gray-400';

  return (
    <span
      className={`px-2 py-0.5 border rounded text-xs capitalize ${bgColor}`}
    >
      {type} ({Math.round(intensity * 100)}%)
    </span>
  );
}

export default function CharacterDetail({
  character,
  faction,
  allCharacters,
  worldId,
  onClose,
}: Props) {
  const [showChat, setShowChat] = useState(false);

  const charMap: Record<string, Character> = {};
  allCharacters.forEach((c) => {
    charMap[c.id] = c;
  });

  const parents = character.lineage.parent_ids
    .map((pid) => charMap[pid])
    .filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-5 flex items-start justify-between z-10">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2
                className={`text-2xl font-bold ${
                  character.alive
                    ? 'text-gray-100'
                    : 'text-gray-500 line-through'
                }`}
              >
                {character.name}
              </h2>
              {!character.alive && <Skull className="w-5 h-5 text-red-500" />}
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="px-2.5 py-0.5 bg-gray-800 text-gray-400 rounded capitalize">
                {character.role}
              </span>
              {faction && (
                <span className="flex items-center gap-1.5 text-gray-400">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: faction.color }}
                  />
                  {faction.name}
                </span>
              )}
              <span className="text-gray-500">Age {character.age}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {character.alive && (
              <button
                onClick={() => setShowChat(true)}
                title={`Chat with ${character.name}`}
                className="p-1.5 text-gray-500 hover:text-genesis-400 transition-colors rounded-lg hover:bg-gray-800"
              >
                <MessageCircle className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* Genome Radar */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <Dna className="w-4 h-4 text-genesis-400" />
              Genome
            </h3>
            <div className="bg-gray-800/40 rounded-xl p-4">
              <GenomeRadar
                genome={character.genome}
                fillColor={faction?.color || '#22d3ee'}
                size={260}
              />
            </div>
          </div>

          {/* Fitness */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <Activity className="w-4 h-4 text-genesis-400" />
              Fitness Score
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.max(2, character.fitness * 100)}%`,
                  }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-genesis-600 to-genesis-400"
                />
              </div>
              <span className="text-lg font-mono font-bold text-genesis-400">
                {(character.fitness * 100).toFixed(1)}
              </span>
            </div>
          </div>

          {/* Backstory */}
          {character.backstory && (
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-2">
                Backstory
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed bg-gray-800/40 rounded-lg p-4 italic">
                {character.backstory}
              </p>
            </div>
          )}

          {/* Goals */}
          {character.goals.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-400" />
                Goals
              </h3>
              <ul className="space-y-1.5">
                {character.goals.map((goal, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-gray-400"
                  >
                    <span className="text-amber-500 mt-0.5">-</span>
                    {goal}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Relationships */}
          {character.relationships.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                Relationships
              </h3>
              <div className="space-y-2">
                {character.relationships.map((rel, i) => {
                  const target = charMap[rel.target_id];
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-gray-800/40 rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-200">
                          {target ? target.name : rel.target_id}
                        </span>
                        <RelationshipBadge
                          type={rel.type}
                          intensity={rel.intensity}
                        />
                      </div>
                      <div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${rel.intensity * 100}%`,
                            backgroundColor:
                              rel.type === 'enemy' || rel.type === 'rival'
                                ? '#ef4444'
                                : rel.type === 'ally' || rel.type === 'friend'
                                ? '#22c55e'
                                : rel.type === 'love' || rel.type === 'family'
                                ? '#ec4899'
                                : '#6b7280',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Lineage */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-purple-400" />
              Lineage
            </h3>
            <div className="bg-gray-800/40 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 uppercase tracking-wider w-20">
                  Generation
                </span>
                <span className="text-sm text-gray-200 font-mono">
                  {character.lineage.generation}
                </span>
              </div>
              {parents.length > 0 && (
                <div className="flex items-start gap-3">
                  <span className="text-xs text-gray-500 uppercase tracking-wider w-20 pt-0.5">
                    Parents
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {parents.map((p) => (
                      <span
                        key={p.id}
                        className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs"
                      >
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {character.lineage.mutations.length > 0 && (
                <div className="flex items-start gap-3">
                  <span className="text-xs text-gray-500 uppercase tracking-wider w-20 pt-0.5">
                    Mutations
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {character.lineage.mutations.map((m, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-purple-900/30 border border-purple-800/40 text-purple-400 rounded text-xs capitalize"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Chat Modal */}
      {showChat && (
        <CharacterChatModal
          worldId={worldId}
          character={character}
          faction={faction}
          onClose={() => setShowChat(false)}
        />
      )}
    </motion.div>
  );
}
