import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authHeaders, chronicle, type ChronicleStats } from '../api';

/**
 * Canon Control Room
 *
 * Live, model-by-model pipeline view of Chroniclon canonization. Subscribes to
 * /api/chronicle/control/stream (SSE) and renders each pipeline's phases as
 * they fire. The visible point: this is a real multi-agent system —
 * Hermes-4-70B decides + critiques + cross-links, Kimi-K2.6 writes the prose,
 * ElevenLabs/OpenAI ships audio.
 */

type Phase =
  | 'decision_started'
  | 'decision_complete'
  | 'skipped'
  | 'writing_started'
  | 'writing_complete'
  | 'antislop_complete'
  | 'factcheck_complete'
  | 'revision_started'
  | 'crosslinks_complete'
  | 'published'
  | 'audio_started'
  | 'audio_complete'
  | 'audio_failed'
  | 'image_started'
  | 'image_complete'
  | 'image_failed';

type PhaseEvent = {
  ts: string;
  phase: Phase;
  pipeline_id: string;
  model?: string;
  stage?: string;
  event_title?: string;
  event_type?: string;
  era_name?: string;
  in_world_year?: number;
  decision?: { kind?: string; voice?: string; title?: string; word_count_target?: number };
  title?: string;
  voice?: string;
  kind?: string;
  word_count?: number;
  word_count_target?: number;
  score?: number;
  top_fix?: string;
  fourth_wall_breaks?: number;
  verdict?: string;
  contradictions?: number;
  links_proposed?: number;
  reason_slop?: boolean;
  reason_fact?: boolean;
  slug?: string;
  archetype?: string;
  audio_url?: string;
  anti_slop_score?: number | null;
  fact_check_score?: number | null;
  critic_passes?: number;
  reasoning?: string;
  error?: string;
  url?: string;        // image URL on image_complete
  byte_size?: number;
};

type StageState = 'pending' | 'active' | 'done' | 'failed';

type Stage = {
  key: string;            // canonical stage key
  label: string;          // visible name
  model: string;          // model badge
  state: StageState;
  detail?: string;        // small text below the stage
};

const STAGE_ORDER: { key: string; label: string; defaultModel: string }[] = [
  { key: 'decision', label: 'canon decision', defaultModel: 'Hermes-4-70B' },
  { key: 'writing', label: 'long-form prose', defaultModel: 'Kimi-K2.6' },
  { key: 'antislop', label: 'anti-slop critic', defaultModel: 'Hermes-4-70B' },
  { key: 'factcheck', label: 'fact-check critic', defaultModel: 'Hermes-4-70B' },
  { key: 'crosslink', label: 'cross-linker', defaultModel: 'Hermes-4-70B' },
  { key: 'image', label: 'hero image', defaultModel: 'FLUX' },
  { key: 'audio', label: 'audio chapter', defaultModel: 'ElevenLabs / OpenAI' },
];

type Pipeline = {
  id: string;
  startedAt: string;
  eventTitle: string;
  eventType?: string;
  eraName?: string;
  inWorldYear?: number;
  title?: string;
  voice?: string;
  kind?: string;
  wordCountTarget?: number;
  wordCount?: number;
  stages: Record<string, Stage>;
  status: 'running' | 'published' | 'skipped';
  publishedSlug?: string;
  antiSlopScore?: number;
  factCheckScore?: number;
  audioArchetype?: string;
  audioUrl?: string;
  imageUrl?: string;
  skippedReason?: string;
};

function emptyStages(): Record<string, Stage> {
  const out: Record<string, Stage> = {};
  for (const s of STAGE_ORDER) {
    out[s.key] = { key: s.key, label: s.label, model: s.defaultModel, state: 'pending' };
  }
  return out;
}

function applyEvent(pipelines: Pipeline[], ev: PhaseEvent): Pipeline[] {
  const idx = pipelines.findIndex((p) => p.id === ev.pipeline_id);
  let pipeline: Pipeline =
    idx >= 0
      ? { ...pipelines[idx], stages: { ...pipelines[idx].stages } }
      : {
          id: ev.pipeline_id,
          startedAt: ev.ts,
          eventTitle: ev.event_title || '(unknown event)',
          eventType: ev.event_type,
          eraName: ev.era_name,
          inWorldYear: ev.in_world_year,
          stages: emptyStages(),
          status: 'running',
        };

  const setStage = (key: string, patch: Partial<Stage>) => {
    pipeline.stages[key] = { ...pipeline.stages[key], ...patch };
  };

  switch (ev.phase) {
    case 'decision_started':
      pipeline.eventTitle = ev.event_title || pipeline.eventTitle;
      pipeline.eventType = ev.event_type ?? pipeline.eventType;
      pipeline.eraName = ev.era_name ?? pipeline.eraName;
      pipeline.inWorldYear = ev.in_world_year ?? pipeline.inWorldYear;
      setStage('decision', { state: 'active', model: ev.model || 'Hermes-4-70B', detail: 'reasoning…' });
      break;
    case 'decision_complete': {
      const d = ev.decision || {};
      pipeline.title = d.title ?? pipeline.title;
      pipeline.voice = d.voice ?? pipeline.voice;
      pipeline.kind = d.kind ?? pipeline.kind;
      pipeline.wordCountTarget = d.word_count_target ?? pipeline.wordCountTarget;
      setStage('decision', {
        state: 'done',
        detail: `canonize · ${d.kind ?? '?'} · ${d.voice ?? '?'} · ~${d.word_count_target ?? '?'}w`,
      });
      break;
    }
    case 'skipped':
      pipeline.status = 'skipped';
      pipeline.skippedReason = ev.reasoning;
      setStage('decision', { state: 'done', detail: `skipped — ${ev.reasoning ?? 'not pivotal'}` });
      // Mark remaining stages as never-ran by leaving them pending; UI fades them.
      break;
    case 'writing_started':
      pipeline.title = ev.title ?? pipeline.title;
      pipeline.voice = ev.voice ?? pipeline.voice;
      pipeline.kind = ev.kind ?? pipeline.kind;
      pipeline.wordCountTarget = ev.word_count_target ?? pipeline.wordCountTarget;
      setStage('writing', {
        state: 'active',
        model: ev.model || 'Kimi-K2.6',
        detail: `writing ${ev.word_count_target ?? '?'} words…`,
      });
      break;
    case 'writing_complete':
      pipeline.wordCount = ev.word_count;
      setStage('writing', {
        state: 'done',
        model: ev.model || pipeline.stages.writing.model,
        detail: `${ev.word_count ?? '?'} words · ${ev.voice ?? pipeline.voice ?? '?'}`,
      });
      break;
    case 'antislop_complete':
      setStage('antislop', {
        state: 'done',
        detail: `score ${formatScore(ev.score)} · fourth-wall breaks: ${ev.fourth_wall_breaks ?? 0}`,
      });
      pipeline.antiSlopScore = ev.score;
      break;
    case 'factcheck_complete':
      setStage('factcheck', {
        state: 'done',
        detail: `score ${formatScore(ev.score)} · ${ev.verdict ?? 'approve'} · contradictions: ${ev.contradictions ?? 0}`,
      });
      pipeline.factCheckScore = ev.score;
      break;
    case 'revision_started':
      // Revision retargets the writing stage.
      setStage('writing', {
        state: 'active',
        detail: `revising — ${ev.reason_slop ? 'slop' : ''}${ev.reason_slop && ev.reason_fact ? ' + ' : ''}${ev.reason_fact ? 'fact' : ''}`,
      });
      break;
    case 'crosslinks_complete':
      setStage('crosslink', {
        state: 'done',
        detail: `${ev.links_proposed ?? 0} link${ev.links_proposed === 1 ? '' : 's'} inserted`,
      });
      break;
    case 'published':
      pipeline.status = 'published';
      pipeline.publishedSlug = ev.slug;
      pipeline.title = ev.title ?? pipeline.title;
      pipeline.voice = ev.voice ?? pipeline.voice;
      pipeline.kind = ev.kind ?? pipeline.kind;
      pipeline.wordCount = ev.word_count ?? pipeline.wordCount;
      pipeline.antiSlopScore = ev.anti_slop_score ?? pipeline.antiSlopScore;
      pipeline.factCheckScore = ev.fact_check_score ?? pipeline.factCheckScore;
      break;
    case 'audio_started':
      setStage('audio', { state: 'active', model: ev.model || 'ElevenLabs / OpenAI', detail: 'rendering…' });
      break;
    case 'audio_complete':
      pipeline.audioArchetype = ev.archetype;
      pipeline.audioUrl = ev.audio_url;
      setStage('audio', {
        state: 'done',
        detail: `${ev.archetype ?? 'narrator'} voice · ready`,
      });
      break;
    case 'audio_failed':
      setStage('audio', { state: 'failed', detail: ev.error ?? 'render failed' });
      break;
    case 'image_started':
      setStage('image', { state: 'active', model: ev.model || 'FLUX', detail: 'rendering…' });
      break;
    case 'image_complete':
      pipeline.imageUrl = ev.url;
      setStage('image', {
        state: 'done',
        detail: ev.byte_size ? `${Math.round(ev.byte_size / 1024)} KB · ready` : 'ready',
      });
      break;
    case 'image_failed':
      setStage('image', { state: 'failed', detail: ev.error ?? 'render failed' });
      break;
  }

  if (idx >= 0) {
    const next = pipelines.slice();
    next[idx] = pipeline;
    return next;
  }
  return [pipeline, ...pipelines];
}

function formatScore(s?: number | null): string {
  if (s === undefined || s === null || Number.isNaN(s)) return '—';
  return s.toFixed(2);
}

function modelBadge(model: string): string {
  if (/kimi/i.test(model)) return 'bg-violet-900/40 text-violet-200 border-violet-700/60';
  if (/eleven|openai|tts/i.test(model)) return 'bg-emerald-900/40 text-emerald-200 border-emerald-700/60';
  if (/flux/i.test(model)) return 'bg-cyan-900/40 text-cyan-200 border-cyan-700/60';
  return 'bg-amber-900/40 text-amber-200 border-amber-700/60';
}

function stateGlyph(state: StageState): string {
  if (state === 'done') return '✓';
  if (state === 'active') return '⟳';
  if (state === 'failed') return '✗';
  return '○';
}

function stateColor(state: StageState): string {
  if (state === 'done') return 'text-emerald-300';
  if (state === 'active') return 'text-amber-300 animate-pulse';
  if (state === 'failed') return 'text-rose-300';
  return 'text-slate-600';
}

export default function Control() {
  const nav = useNavigate();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stats, setStats] = useState<ChronicleStats | null>(null);
  const [connected, setConnected] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Hydrate from backlog so the page is alive before SSE connects.
  useEffect(() => {
    let stop = false;
    fetch('/api/chronicle/control/backlog?limit=80', { headers: authHeaders('GET') })
      .then((r) => r.json())
      .then((data: { items: PhaseEvent[] }) => {
        if (stop) return;
        // Replay in chronological order (backlog is already chronological).
        const next = data.items.reduce<Pipeline[]>((acc, ev) => applyEvent(acc, ev), []);
        setPipelines(next);
      })
      .catch(() => { /* ignore — SSE will still populate */ });
    return () => { stop = true; };
  }, []);

  // Subscribe to live SSE.
  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        const resp = await fetch('/api/chronicle/control/stream', {
          method: 'GET',
          headers: { ...authHeaders('GET'), Accept: 'text/event-stream' },
          signal: controller.signal,
        });
        if (!resp.ok || !resp.body) {
          setConnected(false);
          return;
        }
        setConnected(true);
        const reader = resp.body.getReader();
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
              if (cur === 'ping') continue;
              const raw = line.slice(5).trim();
              if (!raw) continue;
              try {
                const data: PhaseEvent = JSON.parse(raw);
                setPipelines((cur) => applyEvent(cur, data));
              } catch { /* skip parse errors */ }
            }
          }
        }
      } catch {
        // AbortError or transient; component cleanup handles unmount.
      } finally {
        setConnected(false);
      }
    })();

    return () => { controller.abort(); };
  }, []);

  // Stats poll for the header.
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try { const s = await chronicle.stats(); if (!stop) setStats(s); } catch { /* ignore */ }
    };
    tick();
    const id = setInterval(tick, 8000);
    return () => { stop = true; clearInterval(id); };
  }, []);

  const active = useMemo(() => pipelines.filter((p) => p.status === 'running').slice(0, 4), [pipelines]);
  const recent = useMemo(
    () => pipelines.filter((p) => p.status === 'published').slice(0, 8),
    [pipelines],
  );
  const skipped = useMemo(
    () => pipelines.filter((p) => p.status === 'skipped').slice(0, 4),
    [pipelines],
  );
  // When no live pipeline is running, surface the most recently completed one
  // with all stages shown — keeps the demo hero non-empty and gives judges a
  // full agentic-pipeline view at all times.
  const showcase = active.length === 0 ? recent[0] : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <header className="border-b border-slate-800/80 sticky top-0 z-10 bg-slate-950/85 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-6 flex-wrap">
          <button onClick={() => nav('/chronicle')} className="text-slate-400 hover:text-slate-200 text-sm">
            ← chronicle
          </button>
          <div>
            <h1 className="font-serif text-2xl text-slate-100 leading-tight">Canon Control Room</h1>
            <p className="text-xs text-slate-500">live agentic pipeline · Hermes-4-70B + Kimi-K2.6</p>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <span className="flex items-center gap-2 text-xs text-slate-400">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              {connected ? 'live' : 'reconnecting…'}
            </span>
            {stats && (
              <span className="text-xs text-slate-500 font-mono">
                {stats.article_count} articles · {stats.total_words.toLocaleString()} words · {stats.era_count} eras
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-10">
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-[11px] uppercase tracking-widest text-slate-500">
              {active.length > 0 ? 'Active pipelines' : showcase ? 'Last canonization' : 'Active pipelines'}
            </h2>
            <span className="text-[11px] text-slate-600 font-mono">
              {active.length > 0
                ? `${active.length} running`
                : showcase
                ? 'replay'
                : 'idle'}
            </span>
          </div>

          {active.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {active.map((p) => (
                <PipelineCard key={p.id} p={p} />
              ))}
            </div>
          ) : showcase ? (
            <PipelineCard p={showcase} />
          ) : (
            <div className="border border-dashed border-slate-800 rounded-md px-6 py-10 text-center text-slate-500 text-sm">
              The runner is idle. New simulation events will surface here as they enter the canon pipeline.
            </div>
          )}
        </section>

        {recent.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-[11px] uppercase tracking-widest text-slate-500">Recently published</h2>
              <span className="text-[11px] text-slate-600 font-mono">{recent.length} shown</span>
            </div>
            <div className="border border-slate-800/60 rounded-md overflow-hidden">
              {recent.map((p) => (
                <button
                  key={p.id}
                  onClick={() => p.publishedSlug && nav(`/chronicle/${p.publishedSlug}`)}
                  className="w-full text-left px-4 py-3 border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <span className="font-serif text-base text-slate-100">{p.title || p.eventTitle}</span>
                    <span className="text-[11px] text-slate-500 font-mono">y. {p.inWorldYear ?? '?'}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500">
                    <span className={`px-1.5 py-0.5 rounded border ${modelBadge(p.stages.writing.model)}`}>
                      {p.stages.writing.model}
                    </span>
                    <span>{p.kind ?? '—'}</span>
                    <span className="text-slate-700">·</span>
                    <span>{p.voice ?? '—'}</span>
                    <span className="text-slate-700">·</span>
                    <span>{p.wordCount?.toLocaleString() ?? '?'} words</span>
                    <span className="text-slate-700">·</span>
                    <span>slop {formatScore(p.antiSlopScore)}</span>
                    <span className="text-slate-700">·</span>
                    <span>fact {formatScore(p.factCheckScore)}</span>
                    <span className="ml-auto inline-flex gap-1.5">
                      {p.imageUrl && (
                        <span className="inline-flex items-center text-cyan-300 text-[10px] uppercase tracking-widest border border-cyan-700/50 rounded px-1.5 py-0.5">
                          image
                        </span>
                      )}
                      {p.audioUrl && (
                        <span className="inline-flex items-center text-emerald-400 text-[10px] uppercase tracking-widest border border-emerald-700/50 rounded px-1.5 py-0.5">
                          audio · {p.audioArchetype ?? 'narrator'}
                        </span>
                      )}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {skipped.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-[11px] uppercase tracking-widest text-slate-500">Skipped (filler / not pivotal)</h2>
              <span className="text-[11px] text-slate-600 font-mono">{skipped.length} shown</span>
            </div>
            <div className="space-y-1.5 text-sm">
              {skipped.map((p) => (
                <div key={p.id} className="px-3 py-2 rounded bg-slate-900/40 border border-slate-800/60">
                  <span className="text-slate-300">{p.eventTitle}</span>
                  <span className="text-slate-600"> — </span>
                  <span className="text-slate-500 italic">{p.skippedReason || 'no reason given'}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function PipelineCard({ p }: { p: Pipeline }) {
  return (
    <div className="border border-slate-800/60 rounded-md p-5 bg-slate-900/30">
      <div className="flex items-baseline justify-between gap-3 mb-1 flex-wrap">
        <span className="text-[11px] uppercase tracking-widest text-amber-400/80">event</span>
        <span className="text-[11px] text-slate-500 font-mono">{p.eraName ?? '—'} · y. {p.inWorldYear ?? '?'}</span>
      </div>
      <h3 className="font-serif text-xl text-slate-100 leading-tight mb-1">{p.eventTitle}</h3>
      {p.title && p.title !== p.eventTitle && (
        <p className="text-sm text-amber-200/80 italic mb-2">→ {p.title}</p>
      )}
      <div className="mt-4 space-y-2">
        {STAGE_ORDER.map(({ key }) => {
          const s = p.stages[key];
          return (
            <div
              key={key}
              className={`flex items-center gap-3 text-sm ${s.state === 'pending' && p.status !== 'running' ? 'opacity-40' : ''}`}
            >
              <span className={`w-5 text-center font-mono ${stateColor(s.state)}`}>
                {stateGlyph(s.state)}
              </span>
              <span className={`text-[11px] uppercase tracking-wider px-2 py-0.5 rounded border ${modelBadge(s.model)}`}>
                {s.model}
              </span>
              <span className="text-slate-300">{s.label}</span>
              <span className="text-slate-500 ml-auto text-right text-[12px]">{s.detail ?? ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
