import { motion } from 'framer-motion';
import { Users, MapPin, Heart, Swords } from 'lucide-react';
import type { Faction, Character } from '../types';

interface Props {
  faction: Faction;
  leader: Character | undefined;
}

const RESOURCE_KEYS = ['military', 'economy', 'technology', 'influence'];

function ResourceBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs text-gray-500 capitalize">{label}</span>
        <span className="text-xs text-gray-400 font-mono">
          {Math.round(clamped * 100)}
        </span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clamped * 100}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function FactionCard({ faction, leader }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.3 }}
      className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-colors"
    >
      {/* Color accent bar */}
      <div className="h-1.5" style={{ backgroundColor: faction.color }} />

      <div className="p-5">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: faction.color }}
            />
            <h3 className="text-lg font-bold text-gray-100">{faction.name}</h3>
          </div>
          <p className="text-sm text-gray-500 italic">{faction.ideology}</p>
        </div>

        {/* Resource bars */}
        <div className="space-y-2.5 mb-5">
          {RESOURCE_KEYS.map((key) => (
            <ResourceBar
              key={key}
              label={key}
              value={faction.resources[key] ?? 0}
              color={faction.color}
            />
          ))}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="text-center bg-gray-800/50 rounded-lg p-2.5">
            <MapPin className="w-3.5 h-3.5 text-gray-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-gray-200">
              {faction.territory.length}
            </p>
            <p className="text-xs text-gray-500">Territories</p>
          </div>
          <div className="text-center bg-gray-800/50 rounded-lg p-2.5">
            <Users className="w-3.5 h-3.5 text-gray-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-gray-200">
              {faction.population}
            </p>
            <p className="text-xs text-gray-500">Population</p>
          </div>
          <div className="text-center bg-gray-800/50 rounded-lg p-2.5">
            <Heart className="w-3.5 h-3.5 text-gray-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-gray-200">
              {Math.round(faction.morale * 100)}%
            </p>
            <p className="text-xs text-gray-500">Morale</p>
          </div>
        </div>

        {/* Leader */}
        {leader && (
          <div className="mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1 font-medium">
              Leader
            </p>
            <div className="flex items-center gap-2">
              <Swords className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-sm text-gray-200 font-medium">
                {leader.name}
              </span>
              <span className="text-xs text-gray-500 capitalize">
                ({leader.role})
              </span>
            </div>
          </div>
        )}

        {/* Alliances & Enemies */}
        <div className="space-y-3 mb-4">
          {faction.alliances.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 font-medium">
                Alliances
              </p>
              <div className="flex flex-wrap gap-1.5">
                {faction.alliances.map((a, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-green-900/30 border border-green-800/40 text-green-400 rounded text-xs"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
          {faction.enemies.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 font-medium">
                Enemies
              </p>
              <div className="flex flex-wrap gap-1.5">
                {faction.enemies.map((e, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-red-900/30 border border-red-800/40 text-red-400 rounded text-xs"
                  >
                    {e}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Traits */}
        {faction.traits.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {faction.traits.map((t, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-gray-800 text-gray-400 rounded text-xs capitalize"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
