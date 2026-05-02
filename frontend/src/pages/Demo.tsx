import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Masthead from '../components/Masthead';
import { streamRegen, type RegenEvent } from '../lib/streamRegen';

/* The judges' seed: a tested, evocative one-liner that produces consistently
 * good canon. If you change this, run it 3× to confirm the canon flow stays
 * dense and interesting. */
const DEMO_SEED = 'A world where the moon is sentient and writes letters to the queen.';
const DEMO_DAYS = 3;

type Phase = 'idle' | 'world' | 'era' | 'simulating' | 'canonizing' | 'done' | 'error';

const PHASE_LABELS: Record<Phase, string> = {
  idle: 'Press start',
  world: '1. Generating geography, factions, characters',
  era: '2. Naming the era, drifting the language',
  simulating: '3. Simulating days of history',
  canonizing: '4. Hermes deciding canon · Kimi writing articles',
  done: 'Civilization ready',
  error: 'Demo hit a snag',
};

export default function Demo() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState<string>('');
  const [worldName, setWorldName] = useState<string | null>(null);
  const [stats, setStats] = useState<{ regions: number; factions: number; characters: number } | null>(null);
  const [eraName, setEraName] = useState<string | null>(null);
  const [lexicon, setLexicon] = useState<[string, string][]>([]);
  const [daysCompleted, setDaysCompleted] = useState(0);
  const [articles, setArticles] = useState<
    { slug: string; title: string; kind: string; voice: string; word_count: number; writer_label?: string }[]
  >([]);
  const [completion, setCompletion] = useState<{ world_id: string; articles_written: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const startedRef = useRef(false);

  const start = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    setPhase('world');
    setProgress('seeding the void…');
    abortRef.current = streamRegen(DEMO_SEED, DEMO_DAYS, 'kimi', (ev: RegenEvent) => {
      if (ev.t === 'progress') {
        setProgress(ev.detail || ev.stage);
        if (ev.stage === 'simulating') setPhase('simulating');
        else if (ev.stage === 'canonizing') setPhase('canonizing');
      } else if (ev.t === 'world_ready') {
        setWorldName(ev.name);
        setStats({ regions: ev.regions, factions: ev.factions, characters: ev.characters });
        setPhase('era');
      } else if (ev.t === 'era_opened') {
        setEraName(ev.name);
      } else if (ev.t === 'linguistic_drift') {
        setLexicon(ev.lexicon);
      } else if (ev.t === 'day_complete') {
        setDaysCompleted(ev.day);
      } else if (ev.t === 'article_canonized') {
        setArticles((prev) => [
          ...prev,
          {
            slug: ev.slug,
            title: ev.title,
            kind: ev.kind,
            voice: ev.voice,
            word_count: ev.word_count,
            writer_label: ev.writer_label,
          },
        ]);
        setPhase('canonizing');
      } else if (ev.t === 'complete') {
        setCompletion({ world_id: ev.world_id, articles_written: ev.articles_written });
        setPhase('done');
      } else if (ev.t === 'error') {
        setError(ev.message);
        setPhase('error');
      }
    });
  }, []);

  // Auto-start ONLY when ?auto=1 is present (e.g. linked from Judge mode).
  // Default behaviour requires an explicit click — every visitor was burning a
  // real Kimi+Nous canon flow on mount before this. Cleanup still aborts any
  // in-flight stream on unmount.
  const auto = searchParams.get('auto') === '1';
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(start, 250);
    return () => {
      clearTimeout(t);
      abortRef.current?.();
    };
  }, [auto, start]);
  useEffect(() => () => { abortRef.current?.(); }, []);

  const phaseOrder: Phase[] = ['world', 'era', 'simulating', 'canonizing', 'done'];
  const phaseIndex = phaseOrder.indexOf(phase);

  return (
    <div className="min-h-screen bg-page text-page">
      <Masthead />
      <div className="border-b border-subtle">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-baseline gap-6">
          <span className="eyebrow text-faint">live demo</span>
          <h1 className="font-display text-h3 text-heading tracking-[-0.015em]">
            Hermes <span className="text-gilt-500">+</span> Kimi build a civilization in front of you
          </h1>
          <div className="ml-auto eyebrow text-faint hidden md:block">
            seed · <span className="font-mono text-dim normal-case tracking-normal">"{DEMO_SEED.slice(0, 48)}…"</span>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {/* Idle: explicit start CTA. Auto-start only via ?auto=1. */}
        {phase === 'idle' && (
          <section className="border border-subtle rounded p-8 bg-surface">
            <div className="grid md:grid-cols-[1fr_auto] gap-6 items-center">
              <div>
                <div className="eyebrow text-gilt-500 mb-2 flex items-center gap-2">
                  <span className="live-dot" />
                  one-click demo · ~30 seconds
                </div>
                <h2 className="font-display text-h2 text-heading tracking-[-0.02em] mb-2">
                  Watch Hermes <span className="italic text-gilt-500">+</span> Kimi build a civilization.
                </h2>
                <p className="font-ui text-body text-sub leading-relaxed">
                  Press start. The agent will chart geography, breathe in factions, simulate three days of
                  history, then canonize the most pivotal moments into Kimi-written articles —
                  live, in front of you.
                </p>
                <div className="font-mono text-micro text-faint mt-3 tabular-nums">
                  seed · "{DEMO_SEED}"
                </div>
              </div>
              <button
                onClick={start}
                className="self-stretch md:self-auto px-6 h-12 rounded-md bg-gilt-500 hover:bg-gilt-400 text-night-950 font-ui font-semibold text-body-lg whitespace-nowrap transition-colors"
              >
                start the demo →
              </button>
            </div>
          </section>
        )}

        {/* Phase ladder — agentic pipeline at a glance, editorial register. */}
        {phase !== 'idle' && (
        <section>
          <ol className="grid grid-cols-1 md:grid-cols-5 gap-px bg-subtle border border-subtle rounded overflow-hidden mb-6">
            {phaseOrder.map((p, i) => {
              const reached = phaseIndex >= i || phase === 'done';
              const active = phase === p && phase !== 'done';
              return (
                <li
                  key={p}
                  className={`bg-page px-4 py-3 transition-colors ${
 active
 ? 'bg-gilt-500/10'
 : reached
 ? 'bg-moss-500/5'
 : ''
 }`}
                >
                  <div className="eyebrow text-faint mb-1.5 flex items-center gap-1.5">
                    {reached && !active && (
                      <span className="text-moss-500" aria-hidden>✓</span>
                    )}
                    {active && <span className="live-dot" />}
                    step {i + 1}
                  </div>
                  <div
                    className={`font-ui text-body-sm leading-tight ${
 active ? 'text-heading' : reached ? 'text-sub' : 'text-faint'
 }`}
                  >
                    {PHASE_LABELS[p]}
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <div>
              <div className="eyebrow text-faint">
                {phase === 'done' ? 'complete' : phase === 'error' ? 'error' : 'in progress'}
              </div>
              <h2 className="font-display text-h1 text-heading tracking-[-0.025em] mt-1">
                {worldName || 'unnamed civilization'}
              </h2>
              {eraName && (
                <div className="font-mono text-micro text-gilt-500 mt-1 tabular-nums">
                  era · {eraName}
                </div>
              )}
            </div>
            {phase === 'done' && completion && (
              <div className="flex items-center gap-5">
                <button
                  onClick={() => nav('/control')}
                  className="font-mono text-eyebrow uppercase tracking-eyebrow text-dim hover:text-heading transition-colors"
                >
                  control room →
                </button>
                <button
                  onClick={() => nav('/chronicle')}
                  className="inline-flex items-center gap-2 px-5 h-10 rounded-md bg-gilt-500 hover:bg-gilt-400 text-night-950 font-ui font-semibold text-body transition-colors"
                >
                  read the canon
                </button>
              </div>
            )}
          </div>

          <div className="font-ui text-body text-dim italic mt-3">
            {progress || PHASE_LABELS[phase]}
          </div>
        </section>
        )}

        {stats && (
          <section className="grid grid-cols-3 gap-px bg-subtle border border-subtle rounded overflow-hidden">
            {[
              { label: 'regions', value: stats.regions },
              { label: 'factions', value: stats.factions },
              { label: 'characters', value: stats.characters },
            ].map((c) => (
              <div key={c.label} className="bg-page px-4 py-5 text-center">
                <div className="font-mono text-h2 text-heading tabular-nums">{c.value}</div>
                <div className="eyebrow text-faint mt-1">{c.label}</div>
              </div>
            ))}
          </section>
        )}

        {lexicon.length > 0 && (
          <section className="border border-subtle rounded p-5">
            <div className="eyebrow text-faint mb-3">lexicon — the era's tongue</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 font-mono text-body-sm">
              {lexicon.slice(0, 16).map(([en, lo]) => (
                <div key={en} className="flex items-baseline justify-between gap-2">
                  <span className="text-faint">{en}</span>
                  <span className="text-gilt-500">{lo}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {articles.length > 0 && (
          <section>
            <div className="eyebrow text-faint mb-3">
              articles canonized · Hermes decided + Kimi wrote
            </div>
            <div className="border-y border-subtle divide-y divide-subtle">
              {articles.map((a) => (
                <button
                  key={a.slug}
                  onClick={() => nav(`/chronicle/${a.slug}`)}
                  className="w-full text-left px-1 py-3 hover:bg-hover transition-colors group"
                >
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <div className="font-display text-h4 text-heading group-hover:text-gilt-500 transition-colors">
                      {a.title}
                    </div>
                    {a.writer_label && (
                      <span
                        className={`font-mono text-eyebrow uppercase tracking-eyebrow px-1.5 py-0.5 rounded border ${
 /kimi/i.test(a.writer_label)
 ? 'border-gilt-500/40 text-gilt-500'
 : 'border-vellum-400/40 text-vellum-300'
 }`}
                      >
                        {a.writer_label}
                      </span>
                    )}
                  </div>
                  <div className="eyebrow text-faint mt-1 normal-case tracking-[0.06em]">
                    {a.kind} · {a.voice} ·{' '}
                    <span className="font-mono tabular-nums">{a.word_count.toLocaleString()} words</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {daysCompleted > 0 && phase !== 'done' && (
          <div className="font-mono text-body-sm text-dim tabular-nums">
            <span className="text-heading">{daysCompleted}</span> / {DEMO_DAYS} days simulated
          </div>
        )}

        {error && (
          <div className="border border-crimson-500/40 bg-crimson-500/10 rounded p-4">
            <div className="eyebrow text-crimson-400 mb-2">demo paused</div>
            {/^HTTP 429/.test(error) ? (
              <div className="font-ui text-body text-sub">
                You've hit the per-minute demo rate limit. Wait ~60 seconds, then
                try again — or skip the live demo and{' '}
                <button
                  type="button"
                  onClick={() => nav('/chronicle')}
                  className="text-gilt-500 underline underline-offset-4 hover:text-gilt-600 dark:hover:text-gilt-400"
                >
                  read the existing canon
                </button>{' '}
                while you wait.
              </div>
            ) : (
              <div className="font-ui text-body text-sub">
                {error} — refresh to retry, or{' '}
                <button
                  type="button"
                  onClick={() => nav('/chronicle')}
                  className="text-gilt-500 underline underline-offset-4 hover:text-gilt-600 dark:hover:text-gilt-400"
                >
                  read the existing canon
                </button>
                .
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
