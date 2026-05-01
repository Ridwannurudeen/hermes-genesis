import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, GitBranch, Loader2, Play, Radio, ShieldCheck } from 'lucide-react';
import InlineAudioButton from '../components/InlineAudioButton';
import LexiconPreview from '../components/LexiconPreview';
import Masthead from '../components/Masthead';
import SubscribeForm from '../components/SubscribeForm';
import WireTicker from '../components/WireTicker';
import { api, chronicle, type ArticleSummary, type ChronicleStats } from '../api';
import type { WorldSummary } from '../types';

/* Editorial-AI landing page.
 *
 * Replaces the Awwwards-y framer + glass + gradient hero with:
 *  - publication masthead (Masthead component)
 *  - editorial display headline with one gilt-accented word
 *  - signature display-xl live article counter (number-flash on poll)
 *  - "How it publishes" three-step provenance strip
 *  - latest canon — top 5 articles as editorial list rows (NOT a card grid)
 *  - public worlds — hairline-divided list, day count in mono
 *  - sandbox seed input, restrained (no glow, no framer)
 *
 * Constraints:
 *  - No framer-motion, no `glass`, no `card-glow`, no `bg-gradient-animated`.
 *  - All numbers tabular-nums + mono.
 *  - No `rounded-2xl+` on cards.
 *  - Max one signature moment (the live article counter).
 *  - Editorial copy register — no emoji icons in chrome.
 */

const PLACEHOLDERS = [
  'A world where the moon is sentient and writes letters to the queen.',
  'An island that remembers everything anyone has ever done on it.',
  'A civilization that worships extinct languages.',
  'A city built on the bones of a sleeping titan.',
  'Norse mythology brought to life — Ragnarok approaches and the gods scheme.',
];

const STAGE_MAP: Record<string, string> = {
  geography: 'charting geography',
  geography_done: 'terrain mapped',
  factions: 'breathing life into factions',
  factions_done: 'factions established',
  characters: 'forging characters',
  characters_done: 'characters born',
  assembling: 'binding the atlas',
  prophecies: 'the oracle speaks',
  complete: 'world is alive',
};

function fmtN(n: number | null | undefined): string {
  // Em-dash placeholder while stats are loading. Showing literal "0" on first
  // paint reads as "no canon" — the exact opposite of the pitch.
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString();
}

function ago(iso: string | undefined | null): string {
  if (!iso) return '';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  } catch {
    return '';
  }
}

/* ── Signature moment: live article counter with number-flash on poll ── */
function ArticleCounter({ stats }: { stats: ChronicleStats | null }) {
  const [flash, setFlash] = useState(false);
  const lastRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stats) return;
    if (lastRef.current !== null && stats.article_count !== lastRef.current) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 1200);
      return () => clearTimeout(t);
    }
    lastRef.current = stats.article_count;
  }, [stats]);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-3 flex-wrap">
        <span
          className={`font-mono text-display sm:text-display-xl text-heading tabular-nums leading-none transition-colors ${
 flash ? 'animate-numberFlash' : ''
 }`}
          aria-live="polite"
          aria-atomic="true"
        >
          {fmtN(stats?.article_count)}
        </span>
        <span className="eyebrow text-faint pb-2">articles canonized</span>
      </div>
      <div className="flex items-baseline gap-x-4 gap-y-1 flex-wrap font-mono text-micro text-dim tabular-nums">
        <span>
          <span className="text-heading">{fmtN(stats?.total_words)}</span> words
        </span>
        <span>
          <span className="text-heading">{fmtN(stats?.era_count)}</span> eras
        </span>
        <span>
          <span className="text-heading">{fmtN(stats?.linguistic_eras)}</span> tongues
        </span>
        <span>
          <span className="text-heading">{fmtN(stats?.contributor_count)}</span> contributors
        </span>
      </div>
    </div>
  );
}

/* ── How-it-publishes — three-step editorial provenance strip ── */
function ProvenanceStrip() {
  const steps = [
    {
      eyebrow: 'step one',
      label: 'canon decision',
      model: 'Hermes-4-70B',
      body: 'For each event, an agent decides if it is article-worthy and chooses kind, voice, title, and length.',
    },
    {
      eyebrow: 'step two',
      label: 'long-form prose',
      model: 'Kimi-K2.6',
      body: 'The article is written in the era’s voice, with cross-links into the canon already published.',
    },
    {
      eyebrow: 'step three',
      label: 'anti-slop · fact-check',
      model: 'Hermes-4-70B',
      body: 'Two critic passes score the article; if either fails, it is revised and re-scored before sealing.',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-subtle border border-subtle rounded-md overflow-hidden">
      {steps.map((s) => (
        <div key={s.label} className="bg-page p-6">
          <div className="eyebrow text-faint mb-2">{s.eyebrow}</div>
          <div className="font-display text-h4 text-heading mb-1">{s.label}</div>
          <div className="font-mono text-micro text-gilt-500 mb-4 tabular-nums">{s.model}</div>
          <p className="font-ui text-body text-sub leading-relaxed">{s.body}</p>
        </div>
      ))}
    </div>
  );
}

function DemoSpine() {
  const stages = [
    {
      title: 'Control Room',
      label: 'Hermes decides',
      body: 'Live canonization shows the agent choosing, writing, scoring, revising, linking, rendering, and narrating.',
      to: '/control',
      icon: ShieldCheck,
    },
    {
      title: 'Article Proof',
      label: 'Kimi writes',
      body: 'Open any entry and inspect writer, voice, critic scores, source events, media, and cross-links.',
      to: '/chronicle',
      icon: BookOpen,
    },
    {
      title: 'Language Drift',
      label: 'eras mutate',
      body: 'The lexicon changes as the civilization ages, turning a toy world into a durable fictional archive.',
      to: '/chronicle',
      icon: Radio,
    },
    {
      title: 'Fresh Regen',
      label: 'one sentence',
      body: 'A new seed produces a starter civilization, language sample, and first canon entries without a script.',
      to: '/regen',
      icon: GitBranch,
    },
  ];

  return (
    <section className="pb-24">
      <div className="grid lg:grid-cols-[0.75fr_1.25fr] gap-8 lg:gap-12 items-start">
        <div className="min-w-0">
          <div className="eyebrow text-gilt-500 mb-3">submission spine</div>
          <h2 className="font-display text-h2 sm:text-h1 text-heading tracking-normal leading-tight max-w-[21rem] sm:max-w-none break-words">
            The agent pipeline is the product.
          </h2>
          <p className="mt-4 font-ui text-body-lg text-sub leading-relaxed">
            Hermes decides, Kimi writes, Hermes critiques, and the archive keeps linking itself.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-px bg-subtle border border-subtle rounded-md overflow-hidden min-w-0">
          {stages.map(({ title, label, body, to, icon: Icon }) => (
            <Link key={title} to={to} className="group bg-page p-5 min-h-[180px] hover:bg-hover transition-colors min-w-0">
              <div className="flex items-start justify-between gap-4 mb-5">
                <Icon className="w-5 h-5 text-gilt-500" />
                <span className="eyebrow text-faint group-hover:text-dim">{label}</span>
              </div>
              <h3 className="font-display text-h3 text-heading group-hover:text-gilt-500 transition-colors mb-2">
                {title}
              </h3>
              <p className="font-ui text-body text-sub leading-relaxed">{body}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Audio/illustration + critic-score markers ── */
function MediaBadges({ a }: { a: ArticleSummary }) {
  const hasMedia = a.audio_url || a.illustration_url;
  const hasScores = a.anti_slop_score != null || a.fact_check_score != null;
  if (!hasMedia && !hasScores) return null;
  return (
    <span className="flex items-center gap-1.5 shrink-0">
      {a.illustration_url && (
        <span
          title="illustrated"
          className="font-mono text-eyebrow uppercase tracking-eyebrow text-gilt-500 border border-gilt-500/40 rounded px-1.5 py-0.5"
        >
          art
        </span>
      )}
      {a.audio_url && (
        <InlineAudioButton src={a.audio_url} label={a.title} />
      )}
      {hasScores && (
        <span
          title={`anti-slop ${a.anti_slop_score?.toFixed(2) ?? '—'} · fact-check ${a.fact_check_score?.toFixed(2) ?? '—'}`}
          className="font-mono text-eyebrow uppercase tracking-eyebrow text-moss-500 tabular-nums"
        >
          {a.anti_slop_score != null ? a.anti_slop_score.toFixed(2) : '—'}
          /
          {a.fact_check_score != null ? a.fact_check_score.toFixed(2) : '—'}
        </span>
      )}
    </span>
  );
}

/* ── Latest canon — magazine layout: featured illustrated lead + list rows
 * with thumbs and media badges. Replaces the old text-only row treatment
 * which buried 159/200 illustrated articles + 1/200 audio articles in
 * undifferentiated text. ── */
function LatestCanon({ articles }: { articles: ArticleSummary[] }) {
  const navigate = useNavigate();
  if (articles.length === 0) return null;

  // Lead: prefer the most-illustrated, audio-bearing recent article.
  const lead =
    articles.find((a) => a.audio_url && a.illustration_url) ||
    articles.find((a) => a.illustration_url) ||
    articles[0];
  const rest = articles.filter((a) => a.article_id !== lead.article_id).slice(0, 6);

  return (
    <div className="space-y-10">
      {/* Featured lead — big illustration, eyebrow, headline, dek */}
      <button
        onClick={() => navigate(`/chronicle/${lead.slug}`)}
        className="block w-full text-left group"
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-8 lg:gap-10 items-start">
          <div className="aspect-[4/3] lg:aspect-[3/2] rounded overflow-hidden border border-subtle bg-elevated">
            {lead.illustration_url ? (
              <img
                src={lead.illustration_url}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700"
              />
            ) : (
              <div className="w-full h-full grid place-items-center font-display text-h2 text-faint italic">
                {lead.kind}
              </div>
            )}
          </div>
          <div>
            <div className="eyebrow text-gilt-500 mb-3 flex items-center gap-3 flex-wrap">
              <span>featured · {lead.kind}</span>
              <span className="text-faint/60">·</span>
              <span className="text-faint">year {lead.in_world_year}</span>
              <MediaBadges a={lead} />
            </div>
            <h3 className="font-display text-h1 text-heading group-hover:text-gilt-500 transition-colors leading-[1.1] tracking-[-0.025em] mb-4">
              {lead.title}
            </h3>
            <div className="font-mono text-micro text-dim tabular-nums">
              {lead.word_count.toLocaleString()} words · {Math.max(1, Math.ceil(lead.word_count / 240))} min read
              {lead.contributor && (
                <>
                  {' · '}
                  <span className="text-moss-500">via @{lead.contributor}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </button>

      {/* Rest of latest — thumb + title + meta */}
      {rest.length > 0 && (
        <div className="border-t border-subtle divide-y divide-subtle">
          {rest.map((a) => (
            <button
              key={a.article_id}
              onClick={() => navigate(`/chronicle/${a.slug}`)}
              className="w-full text-left flex gap-4 items-stretch py-4 hover:bg-hover transition-colors group"
            >
              {a.illustration_url ? (
                <img
                  src={a.illustration_url}
                  alt=""
                  loading="lazy"
                  className="w-20 h-14 sm:w-28 sm:h-20 rounded shrink-0 object-cover border border-subtle bg-elevated"
                />
              ) : (
                <div className="w-20 h-14 sm:w-28 sm:h-20 rounded shrink-0 border border-subtle bg-elevated/40 hidden sm:block" />
              )}
              <div className="flex-1 min-w-0">
                <div className="eyebrow text-faint mb-1 flex items-center gap-2 flex-wrap">
                  <span>{a.kind}</span>
                  <span className="text-faint/60">·</span>
                  <span>year {a.in_world_year}</span>
                  <MediaBadges a={a} />
                </div>
                <div className="font-display text-h4 text-heading group-hover:text-gilt-500 transition-colors leading-tight">
                  {a.title}
                </div>
              </div>
              <span className="font-mono text-micro text-dim tabular-nums shrink-0 self-start hidden sm:inline">
                {a.word_count.toLocaleString()} words
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Worlds list — hairline-divided rows, NOT a card grid ── */
function WorldsList({
  worlds,
  onDelete,
  deletingId,
}: {
  worlds: WorldSummary[];
  onDelete: (e: React.MouseEvent, id: string) => void;
  deletingId: string | null;
}) {
  const navigate = useNavigate();
  if (worlds.length === 0) {
    return (
      <div className="font-ui text-body text-dim italic py-6">
        No public worlds yet. Use the sandbox below to build one.
      </div>
    );
  }
  return (
    <div className="border-y border-subtle divide-y divide-subtle">
      {worlds.map((w) => (
        <div
          key={w.id}
          className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto] gap-x-5 gap-y-1 items-baseline py-4 group"
        >
          <button
            onClick={() => navigate(`/world/${w.id}`)}
            className="text-left flex items-baseline gap-4 min-w-0"
          >
            <span className="font-display text-h4 text-heading group-hover:text-gilt-500 transition-colors truncate">
              {w.name}
            </span>
            <span className="font-ui text-body-sm text-dim italic truncate hidden md:inline">
              "{w.seed}"
            </span>
          </button>
          <span className="font-mono text-micro text-dim tabular-nums col-span-2 sm:col-auto">
            day {w.current_day} · {ago(w.created_at)}
          </span>
          <div className="flex items-center gap-3 col-span-2 sm:col-auto">
            <button
              onClick={() => navigate(`/world/${w.id}?cinematic=1`)}
              aria-label={`Watch ${w.name} cinematic`}
              className="inline-flex items-center gap-1.5 font-mono text-eyebrow uppercase tracking-eyebrow text-gilt-500 hover:text-gilt-600 dark:hover:text-gilt-400 transition-colors"
            >
              <Play className="w-3 h-3 fill-current" />
              watch
            </button>
            <button
              onClick={(e) => onDelete(e, w.id)}
              disabled={deletingId === w.id}
              aria-label={`Delete ${w.name}`}
              className="font-mono text-eyebrow uppercase tracking-eyebrow text-faint hover:text-crimson-500 transition-colors disabled:opacity-40"
            >
              {deletingId === w.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'delete'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main Landing ── */
export default function Landing() {
  const navigate = useNavigate();
  const [seed, setSeed] = useState('');
  const [loading, setLoading] = useState(false);
  const [stageMessage, setStageMessage] = useState('');
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [stats, setStats] = useState<ChronicleStats | null>(null);
  const [latest, setLatest] = useState<ArticleSummary[]>([]);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  // Bootstrap data + poll stats every 30s for the live counter signature.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      Promise.all([
        api.listWorlds().catch(() => [] as WorldSummary[]),
        chronicle.stats().catch(() => null),
        chronicle.listArticles({ limit: 100 }).catch(() => ({ items: [] as ArticleSummary[] })),
      ]).then(([w, s, a]) => {
        if (cancelled) return;
        setWorlds(w);
        setStats(s);
        // Curate Latest canon — quality + diversity, not just recency:
        //   1. Quality score = critic pass + media presence + audio bonus
        //   2. Diversify: greedily pick across kinds + lead-character so
        //      Lyor Inkwell doesn't dominate every row when the world has
        //      stalled into one storyline
        const items = a.items ?? [];
        const score = (x: ArticleSummary) => {
          const slop = x.anti_slop_score ?? 0.5;
          const fact = x.fact_check_score ?? 0.5;
          const media = (x.illustration_url ? 0.15 : 0) + (x.audio_url ? 0.25 : 0);
          return slop * 0.4 + fact * 0.4 + media + 0.2;
        };
        // Approximate "lead subject" from title — pick the longest capitalized
        // word that isn't a stop word. Imperfect but sufficient for diversity.
        const STOP = new Set(['The', 'And', 'Of', 'A', 'An', 'In', 'On']);
        const leadSubject = (title: string): string => {
          const tokens = title.split(/[\s:·,.]+/).filter(Boolean);
          for (const t of tokens) {
            const clean = t.replace(/[^A-Za-z]/g, '');
            if (clean.length >= 4 && /^[A-Z]/.test(clean) && !STOP.has(clean)) {
              return clean.toLowerCase();
            }
          }
          return tokens[0]?.toLowerCase() ?? '';
        };
        // Slug-dedupe (defense in depth — list endpoint already dedupes).
        const seenSlugs = new Set<string>();
        const dedup = items.filter((x) => (seenSlugs.has(x.slug) ? false : seenSlugs.add(x.slug)));
        // Sort by quality score, then greedy-pick to diversify subject + kind.
        const sorted = [...dedup].sort((a, b) => score(b) - score(a));
        const seenSubjects = new Map<string, number>();
        const seenKinds = new Map<string, number>();
        const picked: ArticleSummary[] = [];
        for (const x of sorted) {
          const subj = leadSubject(x.title);
          if ((seenSubjects.get(subj) ?? 0) >= 2) continue;       // ≤2 per subject
          if ((seenKinds.get(x.kind) ?? 0) >= 3) continue;        // ≤3 per kind
          picked.push(x);
          seenSubjects.set(subj, (seenSubjects.get(subj) ?? 0) + 1);
          seenKinds.set(x.kind, (seenKinds.get(x.kind) ?? 0) + 1);
          if (picked.length >= 7) break;
        }
        // If diversity gates left us short, fall back to top-by-score.
        if (picked.length < 7) {
          for (const x of sorted) {
            if (picked.includes(x)) continue;
            picked.push(x);
            if (picked.length >= 7) break;
          }
        }
        setLatest(picked);
      });
    };
    load();
    const t = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setPlaceholderIdx((i) => (i + 1) % PLACEHOLDERS.length), 4000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => () => abortRef.current?.(), []);

  const handleGenerate = useCallback(async () => {
    const trimmed = seed.trim();
    if (!trimmed) return;
    setLoading(true);
    setStageMessage('seeding the void');
    setError(null);
    try {
      await new Promise<void>((resolve, reject) => {
        abortRef.current = api.createWorldStream(trimmed, {
          onProgress: (data) => {
            const msg = STAGE_MAP[data.stage] || data.detail || 'working';
            setStageMessage(msg);
          },
          onComplete: (data) => {
            navigate(`/world/${data.id}`);
            resolve();
          },
          onError: (err) => reject(err),
        });
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'generation failed');
      setLoading(false);
    }
  }, [seed, navigate]);

  const handleDelete = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setDeletingId(id);
      try {
        await api.deleteWorld(id);
        setWorlds((prev) => prev.filter((w) => w.id !== id));
      } catch {
        /* ignore */
      } finally {
        setDeletingId(null);
      }
    },
    [],
  );

  const placeholder = useMemo(() => PLACEHOLDERS[placeholderIdx], [placeholderIdx]);

  // Most-active world for the cinematic launcher. Picked by current_day so
  // the user lands inside a world with real history to play back.
  const cinematicTargetId = useMemo(() => {
    if (worlds.length === 0) return null;
    return worlds.reduce((a, b) => (a.current_day >= b.current_day ? a : b)).id;
  }, [worlds]);

  return (
    <div className="min-h-screen bg-page text-page overflow-x-hidden">
      <Masthead />
      <WireTicker />

      <main className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* ── Hero ─────────────────────────────────────────────────── */}
        <section className="pt-12 sm:pt-20 pb-16 sm:pb-20 grid lg:grid-cols-[1.25fr_0.75fr] gap-10 lg:gap-16 items-end">
          <div className="min-w-0">
            <div className="eyebrow text-gilt-500 mb-6 flex items-center gap-2">
              <span className="live-dot" />
              live · written autonomously
            </div>
            <h1 className="font-display text-[38px] sm:text-display lg:text-display-xl text-heading leading-[1.02] sm:leading-[0.98] tracking-normal mb-8 max-w-[21rem] sm:max-w-5xl break-words">
              A civilization that publishes its own <span className="italic text-gilt-500">canon.</span>
            </h1>
            <p className="font-ui text-body-lg text-sub leading-relaxed max-w-[21rem] sm:max-w-xl mb-8">
              One sentence in. A self-writing encyclopedia out. Hermes-4-70B decides what becomes canon. Kimi-K2.6 writes it.
              Hermes critics score it. The civilization keeps publishing after you leave.
            </p>
            <div className="flex items-center gap-6 flex-wrap">
              <Link
                to="/chronicle"
                className="inline-flex items-center gap-2 px-5 h-11 rounded-md bg-gilt-500 hover:bg-gilt-400 text-night-950 font-ui font-semibold text-body transition-colors"
              >
                Read the canon
                <ArrowRight className="w-4 h-4" />
              </Link>
              {cinematicTargetId && (
                <Link
                  to={`/world/${cinematicTargetId}?cinematic=1`}
                  className="inline-flex items-center gap-2 px-5 h-11 rounded-md border border-gilt-500/60 hover:border-gilt-500 hover:bg-gilt-500/10 text-heading font-ui font-semibold text-body transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Watch the canon desk
                </Link>
              )}
              <Link
                to="/regen"
                className="font-ui text-body text-sub hover:text-heading underline underline-offset-4 decoration-gilt-500/40 hover:decoration-gilt-500"
              >
                run a fresh civilization
              </Link>
              <Link
                to="/control"
                className="font-mono text-eyebrow uppercase tracking-eyebrow text-dim hover:text-heading transition-colors"
              >
                control room →
              </Link>
            </div>
          </div>

          {/* Signature moment — live counter */}
          <div className="lg:border-l border-subtle lg:pl-10 pt-8 lg:pt-0 border-t lg:border-t-0 min-w-0">
            <ArticleCounter stats={stats} />
          </div>
        </section>

        {/* ── Submission spine — agent-pipeline framing ─────────────── */}
        <DemoSpine />

        {/* ── Lexicon preview — surfaces the conlang differentiator ─── */}
        <LexiconPreview />

        {/* ── Latest canon — lead with the content, NYT-style ──────── */}
        {latest.length > 0 && (
          <section className="pb-24">
            <div className="flex items-baseline justify-between mb-8 pb-3 border-b border-subtle">
              <h2 className="font-display text-h2 text-heading tracking-[-0.02em]">
                Latest canon
              </h2>
              <Link
                to="/chronicle"
                className="font-mono text-eyebrow uppercase tracking-eyebrow text-dim hover:text-heading transition-colors"
              >
                full archive →
              </Link>
            </div>
            <LatestCanon articles={latest} />
          </section>
        )}

        {/* ── Worlds — hairline-divided list ───────────────────────── */}
        {worlds.length > 0 && (
          <section className="pb-24">
            <div className="flex items-baseline justify-between mb-6 pb-3 border-b border-subtle">
              <h2 className="font-display text-h2 text-heading tracking-[-0.02em]">
                Public worlds
              </h2>
              <span className="font-mono text-eyebrow uppercase tracking-eyebrow text-faint tabular-nums">
                {worlds.length} listed
              </span>
            </div>
            <WorldsList worlds={worlds} onDelete={handleDelete} deletingId={deletingId} />
          </section>
        )}

        {/* ── How it publishes ─────────────────────────────────────── */}
        <section className="pb-24">
          <div className="flex items-baseline justify-between mb-6 pb-3 border-b border-subtle">
            <h2 className="font-display text-h2 text-heading tracking-[-0.02em]">
              How it publishes
            </h2>
            <span className="eyebrow text-faint">three agents · two models</span>
          </div>
          <ProvenanceStrip />
        </section>

        {/* ── Sandbox: build a fresh world ─────────────────────────── */}
        <section className="pb-24">
          <div className="flex items-baseline justify-between mb-3 pb-3 border-b border-subtle">
            <h2 className="font-display text-h2 text-heading tracking-[-0.02em]">
              Build your own
            </h2>
            <span className="eyebrow text-faint">hermes genesis · sandbox</span>
          </div>
          <p className="font-ui text-body text-sub max-w-2xl mb-6 mt-4">
            Skip the wiki and generate a fresh living world from a single sentence. The agent will
            chart geography, breathe in factions, forge characters with genomes, and write the first prophecies.
          </p>
          <div className="border border-subtle rounded-md bg-surface p-1.5 flex gap-1.5 max-w-3xl">
            <input
              type="text"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder={placeholder}
              disabled={loading}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              aria-label="World seed"
              className="flex-1 bg-transparent px-3 h-10 font-ui text-body text-input placeholder-faint focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={handleGenerate}
              disabled={loading || !seed.trim()}
              className="shrink-0 px-5 h-10 rounded bg-gilt-500 hover:bg-gilt-400 disabled:bg-faint disabled:text-page text-night-950 font-ui font-semibold text-body transition-colors flex items-center gap-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {loading ? stageMessage : 'generate'}
            </button>
          </div>
          {error && (
            <p className="font-mono text-micro text-crimson-500 mt-3" role="alert">
              {error}
            </p>
          )}
        </section>
      </main>

      {/* ── Subscribe band — follow the canon ────────────────────── */}
      <section className="border-t border-subtle bg-surface/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-end">
          <div>
            <h2 className="font-display text-h2 text-heading tracking-[-0.02em] mb-2">
              Follow the canon.
            </h2>
            <p className="font-ui text-body-lg text-sub max-w-2xl leading-relaxed">
              When the simulation crowns a new era or a contributor seeds an article that survives the canon-keeper, we'll send a single dispatch.
              No marketing, no recap newsletter — just the new entries.
            </p>
          </div>
          <SubscribeForm source="landing" />
        </div>
      </section>

      {/* ── Footer — restrained editorial colophon ───────────────── */}
      <footer className="border-t border-subtle">
        <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            <div className="eyebrow text-faint mb-2">colophon</div>
            <p className="font-ui text-body-sm text-sub leading-relaxed">
              Chroniclon is built on Hermes Genesis — a research artefact for the
              NousResearch Hermes Agent Hackathon, 2026.
            </p>
          </div>
          <div>
            <div className="eyebrow text-faint mb-2">models</div>
            <ul className="space-y-1 font-mono text-micro text-sub tabular-nums">
              <li>Hermes-4-70B · canon decision &amp; critics</li>
              <li>Kimi-K2.6 · long-form prose</li>
              <li>FLUX · article illustrations</li>
              <li>ElevenLabs / OpenAI · narration</li>
            </ul>
          </div>
          <div>
            <div className="eyebrow text-faint mb-2">links</div>
            <ul className="space-y-1 font-ui text-body-sm">
              <li>
                <Link
                  to="/about"
                  className="text-sub hover:text-heading underline underline-offset-4 decoration-gilt-500/40 hover:decoration-gilt-500"
                >
                  methodology
                </Link>
              </li>
              <li>
                <Link
                  to="/contributors"
                  className="text-sub hover:text-heading underline underline-offset-4 decoration-gilt-500/40 hover:decoration-gilt-500"
                >
                  contributors
                </Link>
              </li>
              <li>
                <Link
                  to="/judge"
                  className="text-sub hover:text-heading underline underline-offset-4 decoration-gilt-500/40 hover:decoration-gilt-500"
                >
                  for judges
                </Link>
              </li>
              <li>
                <a
                  href="/api/chronicle/rss.xml"
                  className="text-sub hover:text-heading underline underline-offset-4 decoration-gilt-500/40 hover:decoration-gilt-500"
                >
                  RSS feed
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/Ridwannurudeen/hermes-genesis"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sub hover:text-heading underline underline-offset-4 decoration-gilt-500/40 hover:decoration-gilt-500"
                >
                  source
                </a>
              </li>
              <li>
                <a
                  href="https://nousresearch.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sub hover:text-heading underline underline-offset-4 decoration-gilt-500/40 hover:decoration-gilt-500"
                >
                  Nous Research
                </a>
              </li>
              <li>
                <a
                  href="https://moonshot.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sub hover:text-heading underline underline-offset-4 decoration-gilt-500/40 hover:decoration-gilt-500"
                >
                  Moonshot AI
                </a>
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
