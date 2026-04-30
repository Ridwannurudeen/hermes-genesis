import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Masthead from '../components/Masthead';
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
    <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-subtle border border-subtle rounded overflow-hidden">
      {cells.map(({ label, value, icon: Icon }) => (
        <div key={label} className="bg-page px-4 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-mono text-h2 text-heading tabular-nums">{value}</div>
              <div className="eyebrow text-faint mt-1">{label}</div>
            </div>
            <Icon className="w-5 h-5 text-gilt-500/80" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ArticleStrip({ articles }: { articles: ArticleSummary[] }) {
  if (!articles.length) {
    return (
      <div className="border border-subtle rounded px-4 py-10 text-center font-ui text-body text-dim italic">
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
          className="group border border-subtle rounded overflow-hidden bg-surface hover:border-gilt-500/40 transition-colors"
        >
          {article.illustration_url ? (
            <img
              src={article.illustration_url}
              alt=""
              loading="lazy"
              className="w-full aspect-[4/3] object-cover bg-elevated"
            />
          ) : (
            <div className="aspect-[4/3] bg-elevated flex items-center justify-center">
              <BookOpen className="w-7 h-7 text-faint" />
            </div>
          )}
          <div className="p-3">
            <div className="font-display text-body-lg text-heading leading-tight line-clamp-2 group-hover:text-gilt-500 transition-colors">
              {article.title}
            </div>
            <div className="mt-2 flex items-center justify-between eyebrow text-faint">
              <span>{article.kind}</span>
              <span className="font-mono tabular-nums normal-case tracking-normal">
                {article.word_count}w
              </span>
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
    <div className="grid md:grid-cols-4 gap-px bg-subtle border border-subtle rounded overflow-hidden">
      {rows.map(([label, value]) => (
        <div key={label} className="bg-page px-4 py-5">
          <div className="eyebrow text-faint">{label}</div>
          <div className="mt-1.5 font-ui text-body text-sub leading-snug">{value}</div>
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
    <main className="min-h-screen bg-page text-page">
      <Masthead />
      <div className="border-b border-subtle">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-baseline gap-5">
          <span className="eyebrow text-faint">curated</span>
          <h1 className="font-display text-h3 text-heading tracking-[-0.015em]">
            Judge Mode
          </h1>
          <span className="eyebrow text-faint hidden md:inline">
            agentic pipeline · provenance · proof
          </span>
          <Link
            to="/regen"
            className="ml-auto inline-flex items-center gap-2 font-mono text-eyebrow uppercase tracking-eyebrow text-gilt-500 hover:text-gilt-600 dark:hover:text-gilt-400 transition-colors"
          >
            regen <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <section className="max-w-7xl mx-auto px-6 py-10 space-y-10">
        <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
          <div>
            <div className="eyebrow text-gilt-500 mb-4">autonomous creative agent</div>
            <h1 className="font-display text-display text-heading tracking-[-0.035em] leading-[1.02] max-w-4xl">
              Living worlds that turn simulated history into{' '}
              <span className="italic text-gilt-500">canon</span>, art, audio, and playable lore.
            </h1>
          </div>
          <div className="border border-subtle rounded p-5 bg-surface">
            <div className="eyebrow text-faint mb-3">submission proof</div>
            <dl className="grid grid-cols-[1fr_auto] gap-y-2 gap-x-4 font-mono text-micro tabular-nums">
              <dt className="text-dim">Kimi eligibility</dt>
              <dd className="text-moss-500">present</dd>
              <dt className="text-dim">Nous agent fit</dt>
              <dd className="text-moss-500">present</dd>
              <dt className="text-dim">Admin auth</dt>
              <dd className={status?.auth_required ? 'text-moss-500' : 'text-gilt-500'}>
                {status?.auth_required ? 'enabled' : 'dev mode'}
              </dd>
            </dl>
          </div>
        </div>

        <MetricBand stats={stats} />
        <ProofGrid status={status} />

        <div>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-display text-h2 text-heading tracking-[-0.02em]">Pipeline</h2>
            <Link
              to="/control"
              className="font-mono text-eyebrow uppercase tracking-eyebrow text-gilt-500 hover:text-gilt-600 dark:hover:text-gilt-400 transition-colors"
            >
              open live control room →
            </Link>
          </div>
          <div className="grid md:grid-cols-7 gap-px bg-subtle border border-subtle rounded overflow-hidden">
            {activePipeline.map(({ label, model, icon: Icon, active }) => (
              <div
                key={label}
                className={`bg-page p-4 min-h-[120px] transition-colors ${
                  active ? 'bg-gilt-500/8' : ''
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-gilt-500' : 'text-faint'}`} />
                <div className="mt-3 font-ui text-body-sm text-heading leading-tight">{label}</div>
                <div className="mt-1 font-mono text-eyebrow uppercase tracking-eyebrow text-faint">
                  {model}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-display text-h2 text-heading tracking-[-0.02em]">Latest canon</h2>
            <Link
              to="/chronicle"
              className="font-mono text-eyebrow uppercase tracking-eyebrow text-gilt-500 hover:text-gilt-600 dark:hover:text-gilt-400 transition-colors"
            >
              open archive →
            </Link>
          </div>
          <ArticleStrip articles={articles} />
        </div>

        {error ? (
          <div className="border border-crimson-500/30 bg-crimson-500/10 text-crimson-500 rounded px-4 py-3 font-ui text-body">
            {error}
          </div>
        ) : null}
      </section>
    </main>
  );
}
