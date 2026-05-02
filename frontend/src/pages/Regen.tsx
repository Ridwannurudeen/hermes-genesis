import { useCallback, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, Play, Square } from 'lucide-react';
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

function ProviderToggle({
  provider,
  setProvider,
}: {
  provider: RegenProvider;
  setProvider: (provider: RegenProvider) => void;
}) {
  return (
    <div className="flex bg-surface border border-subtle rounded overflow-hidden text-caption">
      <button
        type="button"
        onClick={() => setProvider('kimi')}
        className={`px-3 py-1.5 ${provider === 'kimi' ? 'bg-gilt-500 text-night-950 font-semibold' : 'text-dim hover:text-heading'}`}
        title="Moonshot Kimi K2.6 - long-form prose, long context"
      >
        Kimi K2.6
      </button>
      <button
        type="button"
        onClick={() => setProvider('nous')}
        className={`px-3 py-1.5 border-l border-subtle ${provider === 'nous' ? 'bg-gilt-500 text-night-950 font-semibold' : 'text-dim hover:text-heading'}`}
        title="Nous Hermes-4-70B - structured decisions and faster drafts"
      >
        Hermes-4
      </button>
    </div>
  );
}

function RunLedger() {
  const rows = [
    ['world_ready', 'regions, factions, characters'],
    ['era_opened', 'the first historical frame'],
    ['linguistic_drift', 'phonology and sample lexicon'],
    ['day_complete', 'simulated events with causal pressure'],
    ['article_canonized', 'article with model provenance'],
  ];

  return (
    <aside className="border border-subtle rounded-md bg-surface/50 overflow-hidden">
      <div className="px-5 py-4 border-b border-subtle">
        <div className="eyebrow text-faint">run ledger</div>
        <div className="font-display text-h3 text-heading mt-1">What a successful run leaves behind</div>
      </div>
      <div className="divide-y divide-subtle">
        {rows.map(([label, body], index) => (
          <div key={label} className="grid grid-cols-[auto_1fr] gap-4 px-5 py-4">
            <span className="font-mono text-micro text-gilt-500 tabular-nums">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div>
              <div className="font-mono text-caption text-heading">{label}</div>
              <div className="font-ui text-body-sm text-sub mt-1">{body}</div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

export default function Regen() {
  const nav = useNavigate();
  const [seed, setSeed] = useState('');
  const [days, setDays] = useState(5);
  const [provider, setProvider] = useState<RegenProvider>('kimi');
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState('');
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
    setProgress('seeding the void...');
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
    <div className="min-h-screen bg-page text-page overflow-x-hidden">
      <Masthead />
      <div className="border-b border-subtle">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-baseline gap-5">
          <span className="eyebrow text-faint">live</span>
          <h1 className="font-display text-h3 text-heading tracking-[-0.015em]">Regen</h1>
          <span className="eyebrow text-faint hidden md:inline">
            one seed to starter canon
          </span>
          <Link
            to="/control"
            className="ml-auto hidden sm:inline-flex items-center gap-1 font-mono text-eyebrow uppercase tracking-eyebrow text-gilt-500 hover:text-gilt-600 dark:hover:text-gilt-400 transition-colors"
          >
            control room <ArrowRight className="inline w-3 h-3" />
          </Link>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {!running && !done && (
          <section className="grid lg:grid-cols-[1.05fr_0.95fr] gap-10 items-start">
            <div className="min-w-0 max-w-[21rem] sm:max-w-2xl lg:max-w-none">
              <div className="eyebrow text-gilt-500 mb-4">fresh civilization</div>
              <h2 className="font-display text-h2 sm:text-h1 text-heading tracking-normal leading-tight mb-5 break-words">
                Give the canon desk one strange sentence.
              </h2>
              <p className="font-ui text-body-lg text-sub leading-relaxed mb-8 max-w-2xl">
                Regen creates a new world, opens an era, mutates a lexicon, simulates history,
                and canonizes the first entries in one run.
              </p>

              <div className="eyebrow text-faint mb-2">seed</div>
              <textarea
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                rows={5}
                maxLength={600}
                placeholder="One sentence. Strange is good."
                className="w-full bg-surface border border-subtle rounded-md px-4 py-4 text-h4 text-heading placeholder:text-faint/70 focus:outline-none focus:border-gilt-500/50 font-body resize-none"
              />
              <div className="grid sm:grid-cols-2 gap-2 mt-3">
                {PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setSeed(p)}
                    className="text-left text-body-sm text-sub hover:text-heading italic px-3 py-2 rounded bg-surface/60 hover:bg-hover border border-subtle transition-colors"
                  >
                    "{p}"
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-4 mt-6 flex-wrap">
                <label className="font-ui text-body-sm text-faint">
                  days
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={days}
                    onChange={(e) => setDays(Math.max(1, Math.min(12, Number(e.target.value) || 5)))}
                    className="ml-2 w-16 bg-surface border border-subtle rounded px-2 py-1 text-body-sm text-heading"
                  />
                </label>
                <label className="font-ui text-body-sm text-faint flex items-center gap-2">
                  writer
                  <ProviderToggle provider={provider} setProvider={setProvider} />
                </label>
                <button
                  onClick={start}
                  disabled={!seed.trim()}
                  className="inline-flex items-center gap-2 px-5 h-10 rounded-md bg-gilt-500 hover:bg-gilt-400 text-night-950 text-body-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  start regen
                </button>
              </div>
            </div>

            <RunLedger />
          </section>
        )}

        {(running || done) && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div className="min-w-0">
                <div className="eyebrow text-faint">
                  {done ? 'complete' : 'in progress'}
                </div>
                <div className="font-display text-h2 sm:text-h1 text-heading tracking-normal mt-1 break-words">
                  {worldName || 'unnamed civilization'}
                </div>
                {eraName && <div className="font-ui text-body text-gilt-500 mt-1">era: {eraName}</div>}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => nav('/control')}
                  className="text-gilt-500 hover:text-gilt-600 dark:hover:text-gilt-400 text-body-sm border border-gilt-500/40 hover:border-gilt-500/60 rounded px-3 py-1.5"
                  title="Live agentic pipeline view"
                >
                  control room
                </button>
                {running ? (
                  <button onClick={cancel} className="inline-flex items-center gap-2 text-faint hover:text-crimson-400 text-body-sm">
                    <Square className="w-3 h-3" />
                    cancel
                  </button>
                ) : completion ? (
                  <div className="flex items-center gap-2">
                    {articles[0] && (
                      <button
                        onClick={() => nav(`/chronicle/${articles[0].slug}`)}
                        className="px-4 py-2 rounded-md bg-gilt-500 hover:bg-gilt-400 text-night-950 text-body-sm font-semibold"
                      >
                        read the article
                      </button>
                    )}
                    <button
                      onClick={() => nav('/chronicle')}
                      className="px-4 py-2 rounded-md border border-gilt-500/60 hover:border-gilt-500 text-gilt-500 text-body-sm font-semibold"
                    >
                      browse the canon
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-3 text-body-sm text-dim italic">
              {running && <Loader2 className="w-4 h-4 animate-spin text-gilt-500" />}
              <span>{progress}</span>
              <span
                className={`font-mono text-eyebrow uppercase tracking-eyebrow px-1.5 py-0.5 rounded border not-italic ${
                  provider === 'kimi'
                    ? 'border-gilt-400/60 text-gilt-400 bg-gilt-500/10'
                    : 'border-gilt-500/60 text-gilt-400 bg-gilt-600/30'
                }`}
              >
                writer - {provider === 'kimi' ? 'Kimi-K2.6' : 'Hermes-4-70B'}
              </span>
            </div>

            {stats && (
              <div className="grid grid-cols-3 gap-px bg-elevated/40 border border-subtle rounded-md overflow-hidden">
                {[
                  { label: 'regions', value: stats.regions },
                  { label: 'factions', value: stats.factions },
                  { label: 'characters', value: stats.characters },
                ].map((c) => (
                  <div key={c.label} className="bg-surface/60 px-4 py-4 text-center">
                    <div className="font-mono text-h2 font-semibold text-heading tabular-nums">{c.value}</div>
                    <div className="eyebrow text-faint mt-1">{c.label}</div>
                  </div>
                ))}
              </div>
            )}

            {lexicon.length > 0 && (
              <div className="border border-subtle rounded-md p-4">
                <div className="eyebrow text-faint mb-3">lexicon</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 font-mono text-caption">
                  {lexicon.map(([en, lo]) => (
                    <div key={en} className="flex items-baseline justify-between gap-3">
                      <span className="text-faint">{en}</span>
                      <span className="text-gilt-500">{lo}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {daysCompleted > 0 && (
              <div className="font-ui text-body-sm text-faint">
                <span className="text-sub font-mono">{daysCompleted}</span> days of history simulated.
              </div>
            )}

            {done && articles.length === 0 && completion && (
              <div className="border border-crimson-500/40 bg-crimson-500/10 rounded-md p-4">
                <div className="eyebrow text-crimson-400 mb-2">no articles canonized</div>
                <div className="font-ui text-body-sm text-sub">
                  Both providers rate-limited during this run. The world spawned and simulated, but the writer couldn't produce any articles — try again in a minute.
                </div>
              </div>
            )}

            {articles.length > 0 && (
              <div>
                <div className="eyebrow text-faint mb-3">articles canonized</div>
                <div className="border border-subtle rounded-md overflow-hidden">
                  {articles.map((a) => (
                    <button
                      key={a.slug}
                      onClick={() => nav(`/chronicle/${a.slug}`)}
                      className="w-full text-left px-4 py-3 border-b border-subtle last:border-b-0 hover:bg-hover transition-colors"
                    >
                      <div className="flex items-baseline justify-between gap-3 flex-wrap">
                        <div className="font-display text-h4 text-heading">{a.title}</div>
                        {a.writer_label && (
                          <span
                            className={`font-mono text-eyebrow uppercase tracking-eyebrow px-1.5 py-0.5 rounded border ${
                              /kimi/i.test(a.writer_label)
                                ? 'border-gilt-400/60 text-gilt-400 bg-gilt-500/10'
                                : 'border-gilt-500/60 text-gilt-400 bg-gilt-600/30'
                            }`}
                          >
                            {a.writer_label}
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-micro text-faint mt-1">
                        {a.kind} - {a.voice} - {a.word_count.toLocaleString()} words
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <div className="text-crimson-500 text-body-sm">{error}</div>}
          </section>
        )}
      </main>
    </div>
  );
}
