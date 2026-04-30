import { authHeaders } from '../api';

export type RegenEvent =
  | { t: 'progress'; stage: string; detail?: string }
  | {
      t: 'world_ready';
      world_id: string;
      name: string;
      regions: number;
      factions: number;
      characters: number;
    }
  | { t: 'era_opened'; era_id: string; name: string }
  | { t: 'linguistic_drift'; era_id: string; lexicon: [string, string][] }
  | { t: 'day_complete'; day: number; new_events_count: number }
  | {
      t: 'article_canonized';
      slug: string;
      title: string;
      kind: string;
      voice: string;
      word_count: number;
      writer?: string;
      writer_label?: string;
    }
  | {
      t: 'complete';
      world_id: string;
      world_name: string;
      era_id: string;
      articles_written: number;
    }
  | { t: 'error'; message: string };

export type RegenProvider = 'kimi' | 'nous';

/** Subscribe to a chroniclon /regen/stream SSE feed. Returns an abort fn. */
export function streamRegen(
  seed: string,
  days: number,
  provider: RegenProvider,
  onEvent: (e: RegenEvent) => void,
): () => void {
  const ctrl = new AbortController();
  fetch('/api/chronicle/regen/stream', {
    method: 'POST',
    headers: authHeaders('POST'),
    body: JSON.stringify({ seed, days, provider }),
    signal: ctrl.signal,
  })
    .then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      if (!r.body) return;
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let cur = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('event:')) cur = line.slice(6).trim();
          else if (line.startsWith('data:')) {
            const raw = line.slice(5).trim();
            if (!raw || cur === 'ping') continue;
            try {
              const data = JSON.parse(raw);
              if (cur === 'progress') onEvent({ t: 'progress', ...data });
              else if (cur === 'world_ready') onEvent({ t: 'world_ready', ...data });
              else if (cur === 'era_opened') onEvent({ t: 'era_opened', ...data });
              else if (cur === 'linguistic_drift') onEvent({ t: 'linguistic_drift', ...data });
              else if (cur === 'day_complete')
                onEvent({
                  t: 'day_complete',
                  day: data.day,
                  new_events_count: (data.new_events ?? []).length,
                });
              else if (cur === 'article_canonized') onEvent({ t: 'article_canonized', ...data });
              else if (cur === 'complete') onEvent({ t: 'complete', ...data });
              else if (cur === 'error')
                onEvent({ t: 'error', message: data.message ?? 'stream error' });
            } catch {
              /* skip parse errors */
            }
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') onEvent({ t: 'error', message: err.message ?? 'stream failed' });
    });
  return () => ctrl.abort();
}
