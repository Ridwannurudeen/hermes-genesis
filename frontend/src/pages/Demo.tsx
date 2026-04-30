import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

  // Auto-start on mount: judges land here and the demo immediately runs.
  useEffect(() => {
    const t = setTimeout(start, 250);
    return () => {
      clearTimeout(t);
      abortRef.current?.();
    };
  }, [start]);

  const phaseOrder: Phase[] = ['world', 'era', 'simulating', 'canonizing', 'done'];
  const phaseIndex = phaseOrder.indexOf(phase);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <header className="border-b border-slate-800/80">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-6">
          <button onClick={() => nav('/')} className="text-slate-400 hover:text-slate-200 text-sm">
            ← home
          </button>
          <h1 className="font-serif text-2xl text-slate-100">Live demo</h1>
          <div className="text-xs text-slate-500 hidden md:block">
            one click — Hermes + Kimi build a civilization in front of you
          </div>
          <div className="ml-auto text-xs text-slate-600 italic">
            seed: <span className="text-slate-400">"{DEMO_SEED.slice(0, 50)}…"</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {/* Phase ladder — judges follow the agentic pipeline at a glance. */}
        <section>
          <ol className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-6">
            {phaseOrder.map((p, i) => {
              const reached = phaseIndex >= i || phase === 'done';
              const active = phase === p && phase !== 'done';
              return (
                <li
                  key={p}
                  className={`px-3 py-2 rounded-md border text-xs leading-tight transition-colors ${
                    active
                      ? 'border-amber-500/60 bg-amber-900/20 text-amber-100'
                      : reached
                      ? 'border-emerald-700/40 bg-emerald-900/10 text-emerald-200'
                      : 'border-slate-800/60 bg-slate-900/40 text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {reached && !active && <span aria-hidden>✓</span>}
                    {active && <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
                    <span>{PHASE_LABELS[p]}</span>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-slate-500">
                {phase === 'done' ? 'complete' : phase === 'error' ? 'error' : 'in progress'}
              </div>
              <div className="font-serif text-3xl text-slate-100 mt-1">
                {worldName || 'unnamed civilization'}
              </div>
              {eraName && <div className="text-amber-300 text-sm mt-1">era · {eraName}</div>}
            </div>
            {phase === 'done' && completion && (
              <div className="flex gap-3">
                <button
                  onClick={() => nav('/control')}
                  className="text-amber-300 hover:text-amber-200 text-sm border border-amber-700/40 hover:border-amber-500/60 rounded px-3 py-1.5"
                >
                  control room →
                </button>
                <button
                  onClick={() => nav('/chronicle')}
                  className="px-4 py-2 rounded-md bg-amber-700/80 hover:bg-amber-600 text-slate-100 text-sm"
                >
                  open the canon →
                </button>
              </div>
            )}
          </div>

          <div className="text-sm text-slate-400 italic mt-2">{progress || PHASE_LABELS[phase]}</div>
        </section>

        {stats && (
          <section className="grid grid-cols-3 gap-px bg-slate-800/40 border border-slate-700/60 rounded-md overflow-hidden">
            {[
              { label: 'regions', value: stats.regions },
              { label: 'factions', value: stats.factions },
              { label: 'characters', value: stats.characters },
            ].map((c) => (
              <div key={c.label} className="bg-slate-900/60 px-4 py-4 text-center">
                <div className="text-2xl font-semibold text-slate-100">{c.value}</div>
                <div className="text-[11px] uppercase tracking-widest text-slate-500 mt-0.5">{c.label}</div>
              </div>
            ))}
          </section>
        )}

        {lexicon.length > 0 && (
          <section className="border border-slate-800/60 rounded-md p-4">
            <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-2">lexicon — the era's tongue</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-sm font-mono">
              {lexicon.slice(0, 16).map(([en, lo]) => (
                <div key={en} className="flex items-baseline justify-between">
                  <span className="text-slate-500">{en}</span>
                  <span className="text-amber-300">{lo}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {articles.length > 0 && (
          <section>
            <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-2">
              articles canonized — Hermes decided + Kimi wrote
            </div>
            <div className="border border-slate-800/60 rounded-md overflow-hidden">
              {articles.map((a) => (
                <button
                  key={a.slug}
                  onClick={() => nav(`/chronicle/${a.slug}`)}
                  className="w-full text-left px-4 py-3 border-b border-slate-800/60 last:border-b-0 hover:bg-slate-800/30 transition-colors"
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
          </section>
        )}

        {daysCompleted > 0 && phase !== 'done' && (
          <div className="text-sm text-slate-500">
            <span className="text-slate-300 font-mono">{daysCompleted}</span> /{' '}
            {DEMO_DAYS} days simulated
          </div>
        )}

        {error && (
          <div className="text-rose-400 text-sm border border-rose-900/60 bg-rose-950/40 rounded-md p-4">
            {error} — try refreshing.
          </div>
        )}
      </main>
    </div>
  );
}
