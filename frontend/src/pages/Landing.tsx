import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import Masthead from '../components/Masthead';
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
  if (n === null || n === undefined || Number.isNaN(n)) return '0';
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

/* ── Latest canon — top N articles as editorial list rows ── */
function LatestCanon({ articles }: { articles: ArticleSummary[] }) {
  const navigate = useNavigate();
  return (
    <div className="border-y border-subtle divide-y divide-subtle">
      {articles.map((a) => (
        <button
          key={a.slug}
          onClick={() => navigate(`/chronicle/${a.slug}`)}
          className="w-full text-left grid grid-cols-[1fr_auto] sm:grid-cols-[auto_1fr_auto] gap-x-6 gap-y-1 items-baseline px-1 py-4 hover:bg-hover transition-colors group"
        >
          <span className="eyebrow text-faint w-20 hidden sm:inline">{a.kind}</span>
          <span className="font-display text-h4 text-heading group-hover:text-gilt-500 transition-colors col-span-1 sm:col-auto">
            <span className="eyebrow text-faint mr-2 sm:hidden">{a.kind}</span>
            {a.title}
          </span>
          <span className="font-mono text-micro text-dim tabular-nums col-span-2 sm:col-auto">
            year {a.in_world_year} · {a.word_count.toLocaleString()} words
          </span>
        </button>
      ))}
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
          <button
            onClick={(e) => onDelete(e, w.id)}
            disabled={deletingId === w.id}
            aria-label={`Delete ${w.name}`}
            className="font-mono text-eyebrow uppercase tracking-eyebrow text-faint hover:text-crimson-500 transition-colors disabled:opacity-40"
          >
            {deletingId === w.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'delete'}
          </button>
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
        chronicle.listArticles({ limit: 30 }).catch(() => ({ items: [] as ArticleSummary[] })),
      ]).then(([w, s, a]) => {
        if (cancelled) return;
        setWorlds(w);
        setStats(s);
        // Curate: prefer articles that already have audio or illustration (full
        // multimedia showcase) so the front door shows the strongest examples.
        // Fall back to recency order if not enough media-rich articles.
        const items = a.items ?? [];
        const featured = items.filter((x) => x.audio_url || x.illustration_url).slice(0, 5);
        const fallback = items.filter((x) => !featured.includes(x)).slice(0, 5 - featured.length);
        setLatest([...featured, ...fallback]);
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

  return (
    <div className="min-h-screen bg-page text-page">
      <Masthead />
      <WireTicker />

      <main className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* ── Hero ─────────────────────────────────────────────────── */}
        <section className="pt-12 sm:pt-20 pb-16 sm:pb-24 grid lg:grid-cols-[1.4fr_1fr] gap-10 lg:gap-16 items-end">
          <div>
            <div className="eyebrow text-gilt-500 mb-6 flex items-center gap-2">
              <span className="live-dot" />
              live · written autonomously
            </div>
            <h1 className="font-display text-display sm:text-display-xl text-heading leading-[0.96] tracking-[-0.04em] mb-8">
              A wikipedia for a world that <span className="italic text-gilt-500">doesn’t exist.</span>
            </h1>
            <p className="font-ui text-body-lg text-sub leading-relaxed max-w-xl mb-8">
              One sentence in. A self-writing encyclopedia out — long-form articles, era-by-era linguistic drift,
              illustrations, narration. Hermes-4-70B decides what becomes canon. Kimi-K2.6 writes it.
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
          <div className="lg:border-l border-subtle lg:pl-10 pt-8 lg:pt-0 border-t lg:border-t-0">
            <ArticleCounter stats={stats} />
          </div>
        </section>

        {/* ── How it publishes ─────────────────────────────────────── */}
        <section className="pb-24">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="font-display text-h2 text-heading tracking-[-0.02em]">
              How it publishes
            </h2>
            <span className="eyebrow text-faint">three agents · two models</span>
          </div>
          <ProvenanceStrip />
        </section>

        {/* ── Latest canon ─────────────────────────────────────────── */}
        {latest.length > 0 && (
          <section className="pb-24">
            <div className="flex items-baseline justify-between mb-6">
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

        {/* ── Sandbox: build a fresh world ─────────────────────────── */}
        <section className="pb-24">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-h2 text-heading tracking-[-0.02em]">
              Sandbox
            </h2>
            <span className="eyebrow text-faint">hermes genesis</span>
          </div>
          <p className="font-ui text-body text-sub max-w-2xl mb-6">
            Skip the wiki and just generate a fresh living world from a single sentence. The agent will
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

        {/* ── Worlds — hairline-divided list ───────────────────────── */}
        {worlds.length > 0 && (
          <section className="pb-32">
            <div className="flex items-baseline justify-between mb-3">
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
      </main>

      {/* ── Footer — restrained editorial colophon ───────────────── */}
      <footer className="border-t border-subtle">
        <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8">
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
