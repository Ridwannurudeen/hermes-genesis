import { useState, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Filter, Search } from 'lucide-react';
import type { Character, Faction } from '../types';
import CharacterCard from './CharacterCard';
import CharacterDetail from './CharacterDetail';

interface Props {
  characters: Character[];
  factions: Faction[];
  worldId: string;
}

export default function CharacterList({
  characters,
  factions,
}: Props) {
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [factionFilter, setFactionFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [aliveFilter, setAliveFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const factionMap = useMemo(() => {
    const map: Record<string, Faction> = {};
    factions.forEach((f) => {
      map[f.id] = f;
    });
    return map;
  }, [factions]);

  const roles = useMemo(() => {
    const set = new Set<string>();
    characters.forEach((c) => set.add(c.role));
    return Array.from(set).sort();
  }, [characters]);

  const filtered = useMemo(() => {
    return characters.filter((c) => {
      if (factionFilter !== 'all' && c.faction_id !== factionFilter) return false;
      if (roleFilter !== 'all' && c.role !== roleFilter) return false;
      if (aliveFilter === 'alive' && !c.alive) return false;
      if (aliveFilter === 'dead' && c.alive) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [characters, factionFilter, roleFilter, aliveFilter, search]);

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search characters..."
            className="bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-genesis-600 w-56"
          />
        </div>

        <div className="flex items-center gap-1.5 text-gray-500">
          <Filter className="w-4 h-4" />
        </div>

        <select
          value={factionFilter}
          onChange={(e) => setFactionFilter(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-genesis-600"
        >
          <option value="all">All Factions</option>
          {factions.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-genesis-600"
        >
          <option value="all">All Roles</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <select
          value={aliveFilter}
          onChange={(e) => setAliveFilter(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-genesis-600"
        >
          <option value="all">All Status</option>
          <option value="alive">Alive</option>
          <option value="dead">Dead</option>
        </select>

        <span className="text-sm text-gray-500 ml-auto">
          {filtered.length} of {characters.length} characters
        </span>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-500">No characters match the filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((c) => (
            <CharacterCard
              key={c.id}
              character={c}
              faction={factionMap[c.faction_id]}
              onClick={() => setSelectedChar(c)}
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedChar && (
          <CharacterDetail
            character={selectedChar}
            faction={factionMap[selectedChar.faction_id]}
            allCharacters={characters}
            onClose={() => setSelectedChar(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
