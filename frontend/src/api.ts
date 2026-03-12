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

// SSE Streaming helpers
type SSEHandler = {
  onProgress?: (data: any) => void;
  onEvent?: (eventType: string, data: any) => void;
  onComplete?: (data: any) => void;
  onError?: (error: Error) => void;
};

function streamSSE(url: string, body: any, handlers: SSEHandler): () => void {
  const controller = new AbortController();

  fetch(`${BASE}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            try {
              const raw = line.slice(5).trim();
              if (!raw) continue;
              const data = JSON.parse(raw);
              if (currentEvent === 'progress') handlers.onProgress?.(data);
              else if (currentEvent === 'complete') handlers.onComplete?.(data);
              else if (currentEvent === 'ping') {
                /* skip */
              } else handlers.onEvent?.(currentEvent, data);
            } catch {
              /* skip parse errors */
            }
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') handlers.onError?.(err);
    });

  return () => controller.abort();
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

  createWorldStream: (
    seed: string,
    handlers: SSEHandler,
    numRegions = 6,
    numFactions = 4,
    numCharacters = 15
  ) =>
    streamSSE(
      '/api/worlds/stream',
      {
        seed,
        num_regions: numRegions,
        num_factions: numFactions,
        num_characters: numCharacters,
      },
      handlers
    ),

  simulateStream: (id: string, days: number, handlers: SSEHandler) =>
    streamSSE(`/api/worlds/${id}/simulate/stream?days=${days}`, {}, handlers),
};
