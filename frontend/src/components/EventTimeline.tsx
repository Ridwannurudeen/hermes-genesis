import { useState, useMemo } from 'react';
import { Filter } from 'lucide-react';
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

  const eventTypes = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => set.add(e.type));
    return Array.from(set).sort();
  }, [events]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (typeFilter !== 'all' && e.type !== typeFilter) return false;
      if (
        factionFilter !== 'all' &&
        !e.factions_involved.includes(factionFilter)
      )
        return false;
      return true;
    });
  }, [events, typeFilter, factionFilter]);

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
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-1.5 text-gray-500">
          <Filter className="w-4 h-4" />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-genesis-600"
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
          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-genesis-600"
        >
          <option value="all">All Factions</option>
          {factions.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>

        <span className="text-sm text-gray-500 ml-auto">
          {filtered.length} events
        </span>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[23px] top-0 bottom-0 w-px bg-gray-800" />

        <div className="space-y-8">
          {groupedByDay.map(({ day, events: dayEvents }) => (
            <div key={day} className="relative">
              {/* Day marker */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gray-900 border-2 border-genesis-600 flex items-center justify-center flex-shrink-0 z-10">
                  <span className="text-sm font-bold text-genesis-400">
                    {day}
                  </span>
                </div>
                <div>
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
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
