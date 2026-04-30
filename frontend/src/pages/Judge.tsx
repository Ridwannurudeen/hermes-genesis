import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  Gauge,
  GitBranch,
  Headphones,
  Image as ImageIcon,
  Radio,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  auth,
  chronicle,
  type ArticleSummary,
  type AuthStatus,
  type ChronicleStats,
} from '../api';

function fmt(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const PIPELINE = [
  { label: 'canon decision', model: 'Hermes-4-70B', icon: Brain },
  { label: 'long-form prose', model: 'Kimi-K2.6', icon: BookOpen },
  { label: 'anti-slop critic', model: 'Hermes-4-70B', icon: ShieldCheck },
  { label: 'fact-check critic', model: 'Hermes-4-70B', icon: CheckCircle2 },
  { label: 'cross-linker', model: 'Hermes-4-70B', icon: GitBranch },
  { label: 'image chapter', model: 'FLUX', icon: ImageIcon },
  { label: 'audio chapter', model: 'ElevenLabs / OpenAI', icon: Headphones },
];

function MetricBand({ stats }: { stats: ChronicleStats | null }) {
  const cells = [
    { label: 'articles', value: fmt(stats?.article_count), icon: BookOpen },
    { label: 'words', value: fmt(stats?.total_words), icon: Gauge },
    { label: 'eras', value: fmt(stats?.era_count), icon: Sparkles },
    { label: 'languages', value: fmt(stats?.linguistic_eras), icon: Radio },
    { label: 'contributors', value: fmt(stats?.contributor_count), icon: Users },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-slate-800/70 border border-slate-800 rounded-md overflow-hidden">
      {cells.map(({ label, value, icon: Icon }) => (
        <div key={label} className="bg-slate-950/70 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-3xl font-semibold tracking-tight text-slate-50">{value}</div>
              <div className="text-[11px] uppercase tracking-widest text-slate-500 mt-1">{label}</div>
            </div>
            <Icon className="w-5 h-5 text-amber-400/80" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ArticleStrip({ articles }: { articles: ArticleSummary[] }) {
  if (!articles.length) {
    return (
      <div className="border border-subtle rounded-md px-4 py-10 text-center text-dim">
        No canon articles available yet.
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-5 gap-3">
      {articles.map((article) => (
        <Link
          key={article.slug}
          to={`/chronicle/${article.slug}`}
          className="group border border-slate-800 rounded-md overflow-hidden bg-slate-950/55 hover:border-amber-700/70 transition-colors"
        >
          {article.illustration_url ? (
            <img
              src={article.illustration_url}
              alt=""
              loading="lazy"
              className="w-full aspect-[4/3] object-cover bg-slate-900"
            />
          ) : (
            <div className="aspect-[4/3] bg-slate-900/70 flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-slate-700" />
            </div>
          )}
          <div className="p-3">
            <div className="text-sm font-serif text-slate-100 leading-tight line-clamp-2 group-hover:text-amber-200">
              {article.title}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-500">
              <span>{article.kind}</span>
              <span>{article.word_count}w</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function ProofGrid({ status }: { status: AuthStatus | null }) {
  const rows = [
    ['main track', 'creative autonomous world engine'],
    ['kimi track', 'Kimi-K2.6 long-form article writer'],
    ['agent surface', '17 MCP tools and 9 skills'],
    ['operations', status?.auth_required ? 'admin sessions and usage telemetry' : 'local dev mode'],
  ];

  return (
    <div className="grid md:grid-cols-4 gap-px bg-slate-800/70 border border-slate-800 rounded-md overflow-hidden">
      {rows.map(([label, value]) => (
        <div key={label} className="bg-slate-950/65 px-4 py-4">
          <div className="text-[11px] uppercase tracking-widest text-slate-500">{label}</div>
          <div className="mt-1 text-sm text-slate-200 leading-snug">{value}</div>
        </div>
      ))}
    </div>
  );
}

export default function Judge() {
  const [stats, setStats] = useState<ChronicleStats | null>(null);
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      chronicle.stats(),
      chronicle.listArticles({ limit: 5 }),
      auth.status(),
    ])
      .then(([nextStats, nextArticles, nextStatus]) => {
        setStats(nextStats);
        setArticles(nextArticles.items);
        setStatus(nextStatus);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const activePipeline = useMemo(
    () => PIPELINE.map((stage, index) => ({ ...stage, active: index < 5 })),
    []
  );

  return (
    <main className="min-h-screen bg-page text-slate-100">
      <header className="border-b border-subtle bg-slate-950/80">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <div>
              <div className="font-display font-semibold tracking-wide">Judge Mode</div>
              <div className="text-xs text-slate-500">Hermes Genesis / Chroniclon</div>
            </div>
          </div>
          <nav className="flex items-center gap-2 text-sm">
            <Link to="/control" className="px-3 py-2 rounded-md text-slate-300 hover:bg-slate-800">
              Control
            </Link>
            <Link to="/demo" className="px-3 py-2 rounded-md text-slate-300 hover:bg-slate-800">
              Demo
            </Link>
            <Link to="/chronicle" className="px-3 py-2 rounded-md text-slate-300 hover:bg-slate-800">
              Chronicle
            </Link>
            <Link
              to="/regen"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-amber-500 text-slate-950 font-semibold"
            >
              Regen
              <ArrowRight className="w-4 h-4" />
            </Link>
          </nav>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-amber-300 mb-3">
              autonomous creative agent
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight text-slate-50 max-w-4xl">
              Living worlds that turn simulated history into canon, art, audio, and playable lore.
            </h1>
          </div>
          <div className="border border-slate-800 rounded-md bg-slate-950/55 p-4">
            <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-3">submission proof</div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Kimi eligibility</span>
                <span className="text-emerald-300">present</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Nous agent fit</span>
                <span className="text-emerald-300">present</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Admin auth</span>
                <span className={status?.auth_required ? 'text-emerald-300' : 'text-amber-300'}>
                  {status?.auth_required ? 'enabled' : 'dev mode'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <MetricBand stats={stats} />
        <ProofGrid status={status} />

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-xl font-semibold">Pipeline</h2>
            <Link to="/control" className="text-sm text-amber-300 hover:text-amber-200">
              Open live control room
            </Link>
          </div>
          <div className="grid md:grid-cols-7 gap-2">
            {activePipeline.map(({ label, model, icon: Icon, active }) => (
              <div
                key={label}
                className={`border rounded-md p-3 min-h-[116px] ${
                  active
                    ? 'border-emerald-800/70 bg-emerald-950/15'
                    : 'border-slate-800 bg-slate-950/50'
                }`}
              >
                <Icon className={active ? 'w-5 h-5 text-emerald-300' : 'w-5 h-5 text-slate-600'} />
                <div className="mt-3 text-sm text-slate-100 leading-tight">{label}</div>
                <div className="mt-1 text-[11px] uppercase tracking-wider text-slate-500">{model}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-xl font-semibold">Latest Canon</h2>
            <Link to="/chronicle" className="text-sm text-amber-300 hover:text-amber-200">
              Open archive
            </Link>
          </div>
          <ArticleStrip articles={articles} />
        </div>

        {error ? (
          <div className="border border-red-900/70 bg-red-950/30 text-red-200 rounded-md px-4 py-3 text-sm">
            {error}
          </div>
        ) : null}
      </section>
    </main>
  );
}
