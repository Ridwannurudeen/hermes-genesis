import { useState, useMemo } from 'react';
import { Search, Filter, Swords, Skull, Handshake, Sparkles } from 'lucide-react';
import type { WorldEvent, Faction, Character } from '../types';
import { EVENT_TYPE_ICONS } from '../types';
import EventCard from './EventCard';

interface Props {
  events: WorldEvent[];
  factions: Faction[];
  characters: Character[];
}

export default function EventTimeline({ events, factions, characters }: Props) {
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [factionFilter, setFactionFilter] = useState<string>('all');
  const [charFilter, setCharFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Build lookups
  const eventMap = useMemo(() => {
    const m: Record<string, WorldEvent> = {};
    events.forEach((e) => { m[e.id] = e; });
    return m;
  }, [events]);

  const charMap = useMemo(() => {
    const m: Record<string, Character> = {};
    characters.forEach((c) => { m[c.id] = c; });
    return m;
  }, [characters]);

  const eventTypes = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => set.add(e.type));
    return Array.from(set).sort();
  }, [events]);

  // Characters who appear in events (for filter dropdown)
  const eventActors = useMemo(() => {
    const ids = new Set<string>();
    events.forEach((e) => e.actors.forEach((a) => ids.add(a)));
    return characters.filter((c) => ids.has(c.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [events, characters]);

  const filtered = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return events.filter((e) => {
      if (typeFilter !== 'all' && e.type !== typeFilter) return false;
      if (factionFilter !== 'all' && !e.factions_involved.includes(factionFilter)) return false;
      if (charFilter !== 'all' && !e.actors.includes(charFilter)) return false;
      if (query && !e.title.toLowerCase().includes(query) && !(e.narrative || '').toLowerCase().includes(query)) return false;
      return true;
    });
  }, [events, typeFilter, factionFilter, charFilter, searchQuery]);

  // Group by day (descending)
  const groupedByDay = useMemo(() => {
    const map: Record<number, WorldEvent[]> = {};
    filtered.forEach((e) => {
      if (!map[e.day]) map[e.day] = [];
      map[e.day].push(e);
    });
    return Object.entries(map)
      .map(([day, evts]) => ({ day: Number(day), events: evts }))
      .sort((a, b) => b.day - a.day);
  }, [filtered]);

  // Event type breakdown for summary
  const typeBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((e) => {
      counts[e.type] = (counts[e.type] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [filtered]);

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">
          No events yet. Simulate some days to generate events.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* ── Search + Filters Bar ──────────────────────────── */}
      <div className="glass rounded-xl p-4 mb-6">
        {/* Search input */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events by title or narrative..."
            className="glass-input w-full rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none transition-all"
          />
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-gray-500">
            <Filter className="w-3.5 h-3.5" />
            <span className="text-xs uppercase tracking-wider">Filters</span>
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="glass-input rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none transition-all"
          >
            <option value="all">All Types</option>
            {eventTypes.map((t) => (
              <option key={t} value={t}>
                {EVENT_TYPE_ICONS[t] || ''} {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          <select
            value={factionFilter}
            onChange={(e) => setFactionFilter(e.target.value)}
            className="glass-input rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none transition-all"
          >
            <option value="all">All Factions</option>
            {factions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>

          <select
            value={charFilter}
            onChange={(e) => setCharFilter(e.target.value)}
            className="glass-input rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none transition-all"
          >
            <option value="all">All Characters</option>
            {eventActors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Active filter clear */}
          {(typeFilter !== 'all' || factionFilter !== 'all' || charFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setTypeFilter('all');
                setFactionFilter('all');
                setCharFilter('all');
                setSearchQuery('');
              }}
              className="text-xs text-genesis-400 hover:text-genesis-300 transition-colors"
            >
              Clear all
            </button>
          )}

          <span className="text-xs text-gray-500 ml-auto font-mono">
            {filtered.length} / {events.length} events
          </span>
        </div>
      </div>

      {/* ── Event Type Summary Bar ────────────────────────── */}
      {typeBreakdown.length > 0 && (
        <div className="flex items-center gap-3 mb-6 overflow-x-auto pb-1">
          {typeBreakdown.map(([type, count]) => (
            <button
              key={type}
              onClick={() => setTypeFilter(typeFilter === type ? 'all' : type)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-all ${
                typeFilter === type
                  ? 'bg-genesis-600/15 border-genesis-500/30 text-genesis-400'
                  : 'bg-white/[0.03] border-white/[0.08] text-gray-400 hover:border-white/[0.15] hover:bg-white/[0.06]'
              }`}
            >
              <span>{EVENT_TYPE_ICONS[type] || ''}</span>
              <span>{type.replace(/_/g, ' ')}</span>
              <span className="text-gray-500">{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Timeline ─────────────────────────────────────── */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[23px] top-0 bottom-0 w-px bg-white/[0.06]" />

        <div className="space-y-8">
          {groupedByDay.map(({ day, events: dayEvents }) => (
            <div key={day} className="relative">
              {/* Day marker — sticky header */}
              <div className="flex items-center gap-3 mb-4 sticky top-[73px] z-20 py-1">
                <div className="w-12 h-12 rounded-full bg-gray-950/80 border-2 border-genesis-500/50 flex items-center justify-center flex-shrink-0 z-10 shadow-lg shadow-genesis-500/10">
                  <span className="text-sm font-bold text-genesis-400">
                    {day}
                  </span>
                </div>
                <div className="glass px-3 py-1 rounded-lg">
                  <p className="text-sm font-semibold text-gray-300">
                    Day {day}
                  </p>
                  <p className="text-xs text-gray-500">
                    {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Events for this day */}
              <div className="pl-[60px] space-y-3">
                {dayEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    factions={factions}
                    characters={characters}
                    eventMap={eventMap}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* No results */}
        {groupedByDay.length === 0 && (
          <div className="flex items-center justify-center h-32">
            <p className="text-gray-500 text-sm">No events match your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
