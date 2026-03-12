import type {
  World,
  WorldSummary,
  Faction,
  Character,
  WorldEvent,
  EvolutionEntry,
} from './types';

const BASE = '';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, options);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  listWorlds: () => fetchJson<WorldSummary[]>('/api/worlds'),

  createWorld: (
    seed: string,
    numRegions = 6,
    numFactions = 4,
    numCharacters = 15
  ) =>
    fetchJson<{ id: string; name: string; status: string }>('/api/worlds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seed,
        num_regions: numRegions,
        num_factions: numFactions,
        num_characters: numCharacters,
      }),
    }),

  getWorld: (id: string) => fetchJson<World>(`/api/worlds/${id}`),

  getMap: (id: string) =>
    fetchJson<{
      geography: { regions: any[]; connections: any[] };
      factions: Record<string, { name: string; color: string }>;
    }>(`/api/worlds/${id}/map`),

  getFactions: (id: string) =>
    fetchJson<Faction[]>(`/api/worlds/${id}/factions`),

  getCharacters: (id: string) =>
    fetchJson<Character[]>(`/api/worlds/${id}/characters`),

  getCharacter: (id: string, charId: string) =>
    fetchJson<Character>(`/api/worlds/${id}/characters/${charId}`),

  getEvents: (id: string, day?: number) =>
    fetchJson<WorldEvent[]>(
      `/api/worlds/${id}/events${day !== undefined ? `?day=${day}` : ''}`
    ),

  getEvolution: (id: string) =>
    fetchJson<EvolutionEntry[]>(`/api/worlds/${id}/evolution`),

  simulate: (id: string, days = 1) =>
    fetchJson<{
      world_id: string;
      days_simulated: number;
      current_day: number;
      events: WorldEvent[];
    }>(`/api/worlds/${id}/simulate?days=${days}`, { method: 'POST' }),

  simulateQuick: (id: string, days = 1) =>
    fetchJson<{
      world_id: string;
      days_simulated: number;
      current_day: number;
      events: WorldEvent[];
    }>(`/api/worlds/${id}/simulate/quick?days=${days}`, { method: 'POST' }),

  deleteWorld: (id: string) =>
    fetchJson<{ deleted: boolean }>(`/api/worlds/${id}`, {
      method: 'DELETE',
    }),
};
