import type {
  World,
  WorldSummary,
  Faction,
  Character,
  WorldEvent,
  EvolutionEntry,
  FactionSnapshot,
  Prophecy,
  MapData,
} from './types';

const BASE = '';

// Optional API key injected at build time. Backend gates POST/DELETE on this.
// Wire VITE_GENESIS_API_KEY in the build env (same value as GENESIS_API_KEY on
// the backend). When unset, we send no header — fine for read-only browsing.
const API_KEY: string = (import.meta.env.VITE_GENESIS_API_KEY as string | undefined) ?? '';

function withAuth(options?: RequestInit): RequestInit {
  const next: RequestInit = { ...(options ?? {}), credentials: 'same-origin' };
  if (!API_KEY) return next;
  const method = (next.method || 'GET').toUpperCase();
  // Reads (GET) don't need the key; only mutating routes do.
  if (method === 'GET') return next;
  const headers = new Headers(next.headers || {});
  headers.set('X-API-Key', API_KEY);
  return { ...next, headers };
}

export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, withAuth(options));
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// SSE Streaming helpers
type SSEHandler = {
  onProgress?: (data: { stage: string; detail?: string }) => void;
  onEvent?: (eventType: string, data: WorldEvent) => void;
  onComplete?: (data: { id: string }) => void;
  onError?: (error: Error) => void;
};

export function authHeaders(method: string = 'POST'): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_KEY && method.toUpperCase() !== 'GET') h['X-API-Key'] = API_KEY;
  return h;
}

export type AuthStatus = {
  auth_required: boolean;
  admin: boolean;
  session_ttl_seconds: number;
};

export type UsageEndpointRow = {
  requests: number;
  failures: number;
  estimated_model_units: number;
  avg_ms: number;
  last_status: number | null;
};

export type UsageDayRow = {
  requests: number;
  failures: number;
  estimated_model_units: number;
};

export type UsageSnapshot = {
  started_at: string;
  updated_at: string | null;
  total_requests: number;
  total_failures: number;
  estimated_model_units: number;
  by_endpoint: Record<string, UsageEndpointRow>;
  by_day: Record<string, UsageDayRow>;
};

export const auth = {
  status: () => fetchJson<AuthStatus>('/api/auth/status'),

  login: (apiKey: string) =>
    fetchJson<{ admin: boolean; session_ttl_seconds: number }>('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey }),
    }),

  logout: () =>
    fetchJson<{ admin: boolean }>('/api/auth/logout', {
      method: 'POST',
    }),

  usage: () => fetchJson<UsageSnapshot>('/api/admin/usage'),
};

function streamSSE(url: string, body: Record<string, unknown>, handlers: SSEHandler): () => void {
  const controller = new AbortController();

  fetch(`${BASE}${url}`, {
    method: 'POST',
    headers: authHeaders('POST'),
    body: JSON.stringify(body),
    signal: controller.signal,
    credentials: 'same-origin',
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      if (!response.body) {
        handlers.onError?.(new Error('Empty response body'));
        return;
      }
      const reader = response.body.getReader();
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
              else if (currentEvent === 'error') handlers.onError?.(new Error(data.message || 'Stream error'));
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
    numRegions = 4,
    numFactions = 3,
    numCharacters = 8
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
    fetchJson<MapData>(`/api/worlds/${id}/map`),

  getFactions: (id: string) =>
    fetchJson<Faction[]>(`/api/worlds/${id}/factions`),

  getCharacters: (id: string) =>
    fetchJson<Character[]>(`/api/worlds/${id}/characters`),

  getCharacter: (id: string, charId: string) =>
    fetchJson<Character>(`/api/worlds/${id}/characters/${charId}`),

  getEvents: async (
    id: string,
    day?: number,
    limit?: number,
    offset?: number,
    order: 'asc' | 'desc' = 'desc',
  ) => {
    const params = new URLSearchParams();
    if (day !== undefined) params.set('day', String(day));
    if (limit !== undefined) params.set('limit', String(limit));
    if (offset !== undefined) params.set('offset', String(offset));
    if (order !== 'desc') params.set('order', order);
    const qs = params.toString();
    const res = await fetchJson<{ events: WorldEvent[]; total: number }>(
      `/api/worlds/${id}/events${qs ? `?${qs}` : ''}`
    );
    return res;
  },

  /** Fetch up to 1500 events in chronological order — plenty for the
   * cinematic /watch replay (each event displays for ~7 s, so 1500 events
   * is several hours of playback). Capping the page count keeps the payload
   * under ~3 MB even on the longest worlds. */
  getAllEventsAsc: async (id: string): Promise<WorldEvent[]> => {
    const PAGE = 500;
    const MAX_EVENTS = 1500;
    const out: WorldEvent[] = [];
    let offset = 0;
    while (out.length < MAX_EVENTS) {
      const params = new URLSearchParams({
        limit: String(PAGE),
        offset: String(offset),
        order: 'asc',
      });
      const res = await fetchJson<{ events: WorldEvent[]; total: number }>(
        `/api/worlds/${id}/events?${params}`
      );
      out.push(...res.events);
      if (res.events.length < PAGE) break;
      offset += PAGE;
    }
    return out.slice(0, MAX_EVENTS);
  },

  exportWorld: async (id: string) => {
    const res = await fetch(`${BASE}/api/worlds/${id}/export`, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('Export failed');
    const text = await res.text();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="(.+)"/);
    const filename = match ? match[1] : 'world-export.md';
    return { text, filename };
  },

  getEvolution: (id: string) =>
    fetchJson<EvolutionEntry[]>(`/api/worlds/${id}/evolution`),

  getProphecies: (id: string) =>
    fetchJson<Prophecy[]>(`/api/worlds/${id}/prophecies`),

  getFactionTimeline: (id: string) =>
    fetchJson<FactionSnapshot[]>(`/api/worlds/${id}/faction-timeline`),

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

  generateChronicle: (id: string) =>
    fetchJson<{ chronicle: string; world_name: string; current_day: number }>(
      `/api/worlds/${id}/chronicle`,
      { method: 'POST' }
    ),

  generateCampaignKit: (id: string) =>
    fetchJson<{ campaign_kit: string; world_name: string; current_day: number }>(
      `/api/worlds/${id}/campaign-kit`,
      { method: 'POST' }
    ),

  generateSessionPrep: (id: string) =>
    fetchJson<{ session_plan: string; world_name: string; current_day: number }>(
      `/api/worlds/${id}/session-prep`,
      { method: 'POST' }
    ),

  intervene: (id: string, command: string) =>
    fetchJson<{ event: WorldEvent; effects_applied: Record<string, unknown> }>(
      `/api/worlds/${id}/intervene`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      }
    ),

  getCouncil: (id: string) =>
    fetchJson<{
      topic: string;
      statements: Array<{
        faction_id: string;
        leader_name: string;
        stance: string;
        statement: string;
        emotion: string;
      }>;
      conclusion: string;
    }>(`/api/worlds/${id}/council`, { method: 'POST' }),

  chatWithCharacter: (worldId: string, charId: string, message: string) =>
    fetchJson<{ reply: string; character_name: string; character_id: string }>(
      `/api/worlds/${worldId}/characters/${charId}/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      }
    ),

  startAgent: (id: string, interval = 120) =>
    fetchJson<{ started: boolean; world_id: string; interval: number }>(
      `/api/worlds/${id}/agent/start?interval=${interval}`,
      { method: 'POST' }
    ),

  stopAgent: (id: string) =>
    fetchJson<{ stopped: boolean; world_id: string }>(
      `/api/worlds/${id}/agent/stop`,
      { method: 'POST' }
    ),

  getAgentStatus: (id: string) =>
    fetchJson<{ running: boolean; world_id: string; log_count: number }>(
      `/api/worlds/${id}/agent/status`
    ),

  getAgentLogs: (id: string) =>
    fetchJson<Array<{
      timestamp: string;
      day: number;
      reasoning: string;
      decision: string;
      action: string;
      intervention_command: string | null;
      focus_faction: string | null;
      focus_character: string | null;
      narrative_arc: string;
      urgency: string;
      events_generated: number;
      event_titles: string[];
    }>>(`/api/worlds/${id}/agent/logs`),

  deleteWorld: (id: string) =>
    fetchJson<{ deleted: boolean }>(`/api/worlds/${id}`, {
      method: 'DELETE',
    }),

  generateScene: (eventType: string, title: string) =>
    fetchJson<{ image: string | null; cached: boolean; enabled: boolean }>(
      '/api/scene-image',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: eventType, title }),
      }
    ),

  sceneStatus: () =>
    fetchJson<{ enabled: boolean }>('/api/scene-image/status'),

  createWorldStream: (
    seed: string,
    handlers: SSEHandler,
    numRegions = 4,
    numFactions = 3,
    numCharacters = 8
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

// =============================================================================
// Chroniclon — civilizational canon engine
// =============================================================================

export type ChronicleStats = {
  article_count: number;
  total_words: number;
  era_count: number;
  current_era: string | null;
  linguistic_eras: number;
  contributor_count: number;
  subscriber_count?: number;
  last_canon_write?: string | null;
};

export type ArticleKind =
  | 'event' | 'person' | 'faction' | 'place'
  | 'language' | 'concept' | 'artifact' | 'prophecy';

export type VoiceTone =
  | 'scholarly' | 'diary' | 'newspaper' | 'scripture' | 'court';

export type ArticleSummary = {
  article_id: string;
  slug: string;
  title: string;
  kind: ArticleKind;
  era_id: string;
  in_world_year: number;
  voice: VoiceTone;
  word_count: number;
  contributor: string | null;
  audio_url: string | null;
  illustration_url?: string | null;
  anti_slop_score?: number | null;
  fact_check_score?: number | null;
  updated_at: string;
};

export type Article = ArticleSummary & {
  body_md: string;
  backlinks: string[];
  inbound: string[];
  sources_cited: string[];
  illustration_url: string | null;
  audio_url: string | null;
  anti_slop_score: number | null;
  fact_check_score: number | null;
  critic_passes: number;
  written_year: number | null;
  created_at: string;
};

export type EraSummary = {
  era_id: string;
  name: string;
  ordinal: number;
  start_year: number;
  end_year: number | null;
  summary: string;
  art_style: string;
  dominant_factions: string[];
  article_count?: number;
};

export const chronicle = {
  stats: () => fetchJson<ChronicleStats>('/api/chronicle/stats'),

  listArticles: (params: { era_id?: string; kind?: ArticleKind; limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.era_id) qs.set('era_id', params.era_id);
    if (params.kind) qs.set('kind', params.kind);
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    if (params.offset !== undefined) qs.set('offset', String(params.offset));
    const q = qs.toString();
    return fetchJson<{ items: ArticleSummary[] }>(
      `/api/chronicle/articles${q ? `?${q}` : ''}`
    );
  },

  getArticle: (slug: string) => fetchJson<Article>(`/api/chronicle/articles/${slug}`),

  search: (q: string, limit: number = 20) => {
    const qs = new URLSearchParams({ q, limit: String(limit) });
    return fetchJson<{
      items: { slug: string; title: string; kind: ArticleKind; in_world_year: number; voice: string; snippet: string }[];
      query: string;
    }>(`/api/chronicle/search?${qs.toString()}`);
  },

  subscribe: (email: string, source?: string) =>
    fetchJson<{ status: 'subscribed' | 'already_subscribed'; unsubscribe_token: string }>(
      '/api/chronicle/subscribe',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source }),
      },
    ),

  listEras: () => fetchJson<{ items: EraSummary[] }>('/api/chronicle/eras'),

  lexicon: () =>
    fetchJson<{
      items: {
        era_id: string;
        era_name: string;
        in_world_year: number;
        parent_era: string | null;
        phonology_notes: string;
        phonological_rules?: { from_sound: string; to_sound: string; context: string }[];
        morphology?: {
          plural_marker?: string;
          honorific_prefix?: string;
          place_name_suffix?: string;
          diminutive?: string;
          notes?: string;
        };
        sample_lexicon: Record<string, string>;
        sample_text: string;
        inscriptions?: { in_world_text: string; translation: string; context: string }[];
      }[];
    }>('/api/chronicle/lexicon'),

  submit: (contributor_handle: string, seed_text: string) =>
    fetchJson<{
      submission_id: string;
      status: 'canonized' | 'rejected' | 'approved_but_skipped' | string;
      reason?: string;
      contributor?: string;
      article?: {
        slug: string;
        title: string;
        kind: string;
        voice: string;
        word_count: number;
      };
    }>('/api/chronicle/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contributor_handle, seed_text }),
    }),
};
