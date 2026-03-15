import { useMemo } from 'react';
import type { Faction, Character } from '../types';
import FactionCard from './FactionCard';

interface Props {
  factions: Faction[];
  characters: Character[];
}

export default function FactionDashboard({ factions, characters }: Props) {
  const leaderMap = useMemo(() => {
    const map: Record<string, Character> = {};
    characters.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [characters]);

  if (factions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-dim">No factions found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {factions.map((faction) => (
        <FactionCard
          key={faction.id}
          faction={faction}
          leader={leaderMap[faction.leader_id]}
        />
      ))}
    </div>
  );
}
