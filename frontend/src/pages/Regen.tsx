import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Masthead from '../components/Masthead';
import { authHeaders } from '../api';

const PROMPTS = [
  'A world where the moon is sentient and writes letters to the queen.',
  'An island that remembers everything anyone has ever done on it.',
  'A civilization that worships extinct languages.',
  'A city built on the bones of a sleeping titan.',
];

type RegenEvent =
  | { t: 'progress'; stage: string; detail?: string }
  | { t: 'world_ready'; world_id: string; name: string; regions: number; factions: number; characters: number }
  | { t: 'era_opened'; era_id: string; name: string }
  | { t: 'linguistic_drift'; era_id: string; lexicon: [string, string][] }
  | { t: 'day_complete'; day: number; new_events_count: number }
  | { t: 'article_canonized'; slug: string; title: string; kind: string; voice: string; word_count: number; writer?: string; writer_label?: string }
  | { t: 'complete'; world_id: string; world_name: string; era_id: string; articles_written: number }
  | { t: 'error'; message: string };

type RegenProvider = 'kimi' | 'nous';

function streamRegen(
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
    credentials: 'same-origin',
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
                onEvent({ t: 'day_complete', day: data.day, new_events_count: (data.new_events ?? []).length });
              else if (cur === 'article_canonized') onEvent({ t: 'article_canonized', ...data });
              else if (cur === 'complete') onEvent({ t: 'complete', ...data });
              else if (cur === 'error') onEvent({ t: 'error', message: data.message ?? 'stream error' });
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

export default function Regen() {
  const nav = useNavigate();
  const [seed, setSeed] = useState('');
  const [days, setDays] = useState(5);
  const [provider, setProvider] = useState<RegenProvider>('kimi');
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [worldName, setWorldName] = useState<string | null>(null);
  const [stats, setStats] = useState<{ regions: number; factions: number; characters: number } | null>(null);
  const [eraName, setEraName] = useState<string | null>(null);
  const [lexicon, setLexicon] = useState<[string, string][]>([]);
  const [daysCompleted, setDaysCompleted] = useState(0);
  const [articles, setArticles] = useState<{ slug: string; title: string; kind: string; voice: string; word_count: number; writer_label?: string }[]>([]);
  const [completion, setCompletion] = useState<{ world_id: string; articles_written: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const start = useCallback(() => {
    const s = seed.trim();
    if (!s) return;
    setRunning(true);
    setDone(false);
    setProgress('seeding the void…');
    setWorldName(null);
    setStats(null);
    setEraName(null);
    setLexicon([]);
    setDaysCompleted(0);
    setArticles([]);
    setCompletion(null);
    setError(null);

    abortRef.current = streamRegen(s, days, provider, (ev) => {
      if (ev.t === 'progress') setProgress(ev.detail || ev.stage);
      else if (ev.t === 'world_ready') {
        setWorldName(ev.name);
        setStats({ regions: ev.regions, factions: ev.factions, characters: ev.characters });
      } else if (ev.t === 'era_opened') setEraName(ev.name);
      else if (ev.t === 'linguistic_drift') setLexicon(ev.lexicon);
      else if (ev.t === 'day_complete') setDaysCompleted(ev.day);
      else if (ev.t === 'article_canonized')
        setArticles((prev) => [
          ...prev,
          { slug: ev.slug, title: ev.title, kind: ev.kind, voice: ev.voice, word_count: ev.word_count, writer_label: ev.writer_label },
        ]);
      else if (ev.t === 'complete') {
        setCompletion({ world_id: ev.world_id, articles_written: ev.articles_written });
        setRunning(false);
        setDone(true);
      } else if (ev.t === 'error') {
        setError(ev.message);
        setRunning(false);
      }
    });
  }, [seed, days, provider]);

  const cancel = useCallback(() => {
    abortRef.current?.();
    abortRef.current = null;
    setRunning(false);
  }, []);

  return (
    <div className="min-h-screen bg-page text-page">
      <Masthead />
      <div className="border-b border-subtle">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-baseline gap-5">
          <span className="eyebrow text-faint">live</span>
          <h1 className="font-display text-h3 text-heading tracking-[-0.015em]">Regen</h1>
          <span className="eyebrow text-faint hidden md:inline">
            generate a fresh civilization from a single sentence
          </span>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {!running && !done && (
          <section>
            <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-2">Seed</div>
            <textarea
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              rows={3}
              maxLength={600}
              placeholder="One sentence. Strange is good."
              className="w-full bg-slate-900 border border-slate-700/60 rounded-md px-4 py-3 text-base text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-600/50 font-serif resize-none"
            />
            <div className="flex flex-wrap gap-2 mt-3">
              {PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => setSeed(p)}
                  className="text-xs text-slate-500 hover:text-slate-200 italic px-2 py-1 rounded bg-slate-900/60 hover:bg-slate-800/60"
                >
                  “{p.length > 60 ? `${p.slice(0, 60)}…` : p}”
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-6 flex-wrap">
              <label className="text-sm text-slate-500">
                days
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={days}
                  onChange={(e) => setDays(Math.max(1, Math.min(12, Number(e.target.value) || 5)))}
                  className="ml-2 w-16 bg-slate-900 border border-slate-700/60 rounded px-2 py-1 text-sm text-slate-200"
                />
              </label>
              <label className="text-sm text-slate-500 flex items-center gap-2">
                writer
                <div className="flex bg-slate-900 border border-slate-700/60 rounded overflow-hidden text-xs">
                  <button
                    type="button"
                    onClick={() => setProvider('kimi')}
                    className={`px-3 py-1 ${provider === 'kimi' ? 'bg-amber-700/70 text-slate-50' : 'text-slate-400 hover:text-slate-200'}`}
                    title="Moonshot Kimi K2.6 — long-form prose, 256K context"
                  >
                    Kimi K2.6
                  </button>
                  <button
                    type="button"
                    onClick={() => setProvider('nous')}
                    className={`px-3 py-1 border-l border-slate-700/60 ${provider === 'nous' ? 'bg-amber-700/70 text-slate-50' : 'text-slate-400 hover:text-slate-200'}`}
                    title="Nous Hermes-4-70B — faster, structured"
                  >
                    Hermes-4
                  </button>
                </div>
              </label>
              <button
                onClick={start}
                disabled={!seed.trim()}
                className="px-5 py-2 rounded-md bg-amber-700/80 hover:bg-amber-600 text-slate-100 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                regenerate the world
              </button>
            </div>
          </section>
        )}

        {(running || done) && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-slate-500">
                  {done ? 'complete' : 'in progress'}
                </div>
                <div className="font-serif text-2xl text-slate-100 mt-0.5">{worldName || 'unnamed civilization'}</div>
                {eraName && <div className="text-sm text-amber-300 mt-0.5">era: {eraName}</div>}
              </div>
              <div className="flex items-center gap-3">
                {(running || completion) && (
                  <button
                    onClick={() => nav('/control')}
                    className="text-amber-300 hover:text-amber-200 text-sm border border-amber-700/40 hover:border-amber-500/60 rounded px-3 py-1.5"
                    title="Live agentic pipeline view"
                  >
                    control room →
                  </button>
                )}
                {running ? (
                  <button onClick={cancel} className="text-slate-500 hover:text-rose-300 text-sm">
                    cancel
                  </button>
                ) : completion ? (
                  <button
                    onClick={() => nav('/chronicle')}
                    className="px-4 py-2 rounded-md bg-amber-700/80 hover:bg-amber-600 text-slate-100 text-sm"
                  >
                    open the canon →
                  </button>
                ) : null}
              </div>
            </div>

            <div className="text-sm text-slate-400 italic flex items-center gap-2">
              <span>{progress}</span>
              {(running || done) && (
                <span
                  className={`text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                    provider === 'kimi'
                      ? 'border-violet-700/60 text-violet-200 bg-violet-900/30'
                      : 'border-amber-700/60 text-amber-200 bg-amber-900/30'
                  }`}
                >
                  writer · {provider === 'kimi' ? 'Kimi-K2.6' : 'Hermes-4-70B'}
                </span>
              )}
            </div>

            {stats && (
              <div className="grid grid-cols-3 gap-px bg-slate-800/40 border border-slate-700/60 rounded-md overflow-hidden">
                {[
                  { label: 'regions', value: stats.regions },
                  { label: 'factions', value: stats.factions },
                  { label: 'characters', value: stats.characters },
                ].map((c) => (
                  <div key={c.label} className="bg-slate-900/60 px-4 py-3 text-center">
                    <div className="text-xl font-semibold text-slate-100">{c.value}</div>
                    <div className="text-[11px] uppercase tracking-widest text-slate-500 mt-0.5">{c.label}</div>
                  </div>
                ))}
              </div>
            )}

            {lexicon.length > 0 && (
              <div className="border border-slate-800/60 rounded-md p-4">
                <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-2">lexicon</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-sm font-mono">
                  {lexicon.map(([en, lo]) => (
                    <div key={en} className="flex items-baseline justify-between">
                      <span className="text-slate-500">{en}</span>
                      <span className="text-amber-300">{lo}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {daysCompleted > 0 && (
              <div className="text-sm text-slate-500">
                <span className="text-slate-300 font-mono">{daysCompleted}</span> days of history simulated.
              </div>
            )}

            {articles.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-2">articles canonized</div>
                <div className="border border-slate-800/60 rounded-md overflow-hidden">
                  {articles.map((a) => (
                    <button
                      key={a.slug}
                      onClick={() => nav(`/chronicle/${a.slug}`)}
                      className="w-full text-left px-4 py-3 border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="flex items-baseline justify-between gap-3 flex-wrap">
                        <div className="font-serif text-base text-slate-100">{a.title}</div>
                        {a.writer_label && (
                          <span
                            className={`text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                              /kimi/i.test(a.writer_label)
                                ? 'border-violet-700/60 text-violet-200 bg-violet-900/30'
                                : 'border-amber-700/60 text-amber-200 bg-amber-900/30'
                            }`}
                          >
                            {a.writer_label}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {a.kind} · {a.voice} · {a.word_count.toLocaleString()} words
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <div className="text-rose-400 text-sm">{error}</div>}
          </section>
        )}
      </main>
    </div>
  );
}
