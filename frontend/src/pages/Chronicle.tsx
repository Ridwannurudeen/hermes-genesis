import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Autopsy from '../components/Autopsy';
import ContributeModal from '../components/ContributeModal';
import EraCeremony from '../components/EraCeremony';
import LanguageTree from '../components/LanguageTree';
import Masthead from '../components/Masthead';
import {
  chronicle,
  type Article,
  type ArticleKind,
  type ArticleSummary,
  type ChronicleStats,
  type EraSummary,
} from '../api';

const KIND_LABELS: Record<ArticleKind, string> = {
  event: 'Events',
  person: 'People',
  faction: 'Factions',
  place: 'Places',
  language: 'Languages',
  concept: 'Concepts',
  artifact: 'Artifacts',
  prophecy: 'Prophecies',
};

const VOICE_BADGE: Record<string, string> = {
  scholarly: 'bg-ink-700/40 text-vellum-200',
  diary: 'bg-gilt-600/30 text-gilt-400',
  newspaper: 'bg-ink-700/30 text-vellum-200',
  scripture: 'bg-gilt-600/30 text-gilt-400',
  court: 'bg-crimson-500/30 text-crimson-400',
};

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function StatsBanner({ stats }: { stats: ChronicleStats | null }) {
  const cells = [
    { label: 'articles', value: stats ? fmt(stats.article_count) : '—' },
    { label: 'words', value: stats ? fmt(stats.total_words) : '—' },
    { label: 'eras', value: stats ? fmt(stats.era_count) : '—' },
    { label: 'languages', value: stats ? fmt(stats.linguistic_eras) : '—' },
    { label: 'contributors', value: stats ? fmt(stats.contributor_count) : '—' },
  ];
  return (
    <div className="grid grid-cols-5 gap-px bg-ink-800/40 border border-ink-700/60 rounded-md overflow-hidden">
      {cells.map((c) => (
        <div key={c.label} className="bg-ink-900/60 px-4 py-3 text-center">
          <div className="text-2xl font-semibold tracking-tight text-vellum-100">{c.value}</div>
          <div className="text-[11px] uppercase tracking-widest text-ink-500 mt-0.5">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

function EraNav({
  eras,
  active,
  onSelect,
  onCeremony,
}: {
  eras: EraSummary[];
  active: string | null;
  onSelect: (id: string | null) => void;
  onCeremony: (eraId: string) => void;
}) {
  return (
    <aside className="text-sm">
      <div className="text-[11px] uppercase tracking-widest text-ink-500 mb-2">Eras</div>
      <button
        onClick={() => onSelect(null)}
        className={`block w-full text-left px-3 py-2 rounded ${
          active === null ? 'bg-ink-700/50 text-vellum-100' : 'text-vellum-400 hover:bg-ink-800/40'
        }`}
      >
        All eras
      </button>
      {eras.map((e) => (
        <div
          key={e.era_id}
          className={`group relative mt-0.5 rounded ${
            active === e.era_id ? 'bg-ink-700/50' : 'hover:bg-ink-800/40'
          }`}
        >
          <button
            onClick={() => onSelect(e.era_id)}
            className={`block w-full text-left px-3 py-2 ${
              active === e.era_id ? 'text-vellum-100' : 'text-vellum-400'
            }`}
          >
            <div className="font-medium pr-8">{e.name}</div>
            <div className="text-[11px] text-ink-500">
              year {e.start_year}
              {e.end_year ? `–${e.end_year}` : '+'}
            </div>
          </button>
          <button
            type="button"
            onClick={(ev) => {
              ev.stopPropagation();
              onCeremony(e.era_id);
            }}
            title="View the era's transition ceremony"
            aria-label={`View ${e.name} transition ceremony`}
            className="absolute top-2 right-2 text-gilt-500/60 hover:text-gilt-400 opacity-0 group-hover:opacity-100 transition-opacity text-base"
          >
            ✦
          </button>
        </div>
      ))}
    </aside>
  );
}

function ArticleListRow({ a, onOpen }: { a: ArticleSummary; onOpen: (slug: string) => void }) {
  return (
    <button
      onClick={() => onOpen(a.slug)}
      className="w-full text-left px-4 py-4 border-b border-subtle hover:bg-hover transition-colors flex gap-4 group"
    >
      {a.illustration_url ? (
        <img
          src={a.illustration_url}
          alt=""
          loading="lazy"
          className="w-24 h-16 rounded shrink-0 object-cover border border-subtle bg-elevated"
        />
      ) : (
        <div className="w-24 h-16 rounded shrink-0 border border-subtle bg-elevated/40" />
      )}
      <div className="flex-1 min-w-0">
        <div className="eyebrow text-faint mb-1 flex items-center gap-3">
          <span>{a.kind}</span>
          <span className="text-faint/60">·</span>
          <span>{a.voice}</span>
          {a.contributor ? (
            <>
              <span className="text-faint/60">·</span>
              <span className="text-moss-500 normal-case tracking-normal font-mono">@{a.contributor}</span>
            </>
          ) : null}
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-display text-h4 text-heading group-hover:text-gilt-500 transition-colors leading-tight flex items-center gap-2 truncate">
            <span className="truncate">{a.title}</span>
            {a.audio_url ? (
              <span
                title="audio narration available"
                className="inline-flex items-center font-mono text-eyebrow uppercase tracking-eyebrow text-gilt-500 border border-gilt-500/40 rounded px-1.5 py-0.5 shrink-0"
              >
                audio
              </span>
            ) : null}
          </div>
          <div className="shrink-0 font-mono text-micro text-faint tabular-nums">
            year {a.in_world_year} · {a.word_count.toLocaleString()} words
          </div>
        </div>
      </div>
    </button>
  );
}

function renderBody(md: string, onLink: (slug: string) => void): JSX.Element[] {
  // Editorial prose register — paragraphs default to .editorial-prose styles
  // via the wrapping container. The first paragraph gets .drop-cap. Headers
  // and blockquotes also styled via the prose container; we only emit
  // semantic elements here.
  const blocks = md.split(/\n{2,}/);
  let firstParagraphSeen = false;
  return blocks.map((block, i) => {
    const trimmed = block.trim();
    if (!trimmed) return <div key={i} />;
    const headerMatch = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const text = headerMatch[2];
      if (level === 1) return <h2 key={i}>{renderInline(text, onLink)}</h2>;
      if (level === 2) return <h2 key={i}>{renderInline(text, onLink)}</h2>;
      return <h3 key={i}>{renderInline(text, onLink)}</h3>;
    }
    if (trimmed.startsWith('> ')) {
      return (
        <blockquote key={i}>
          {renderInline(trimmed.slice(2), onLink)}
        </blockquote>
      );
    }
    const isFirst = !firstParagraphSeen;
    if (isFirst) firstParagraphSeen = true;
    return (
      <p key={i} className={isFirst ? 'drop-cap' : undefined}>
        {renderInline(trimmed, onLink)}
      </p>
    );
  });
}

function renderInline(text: string, onLink: (slug: string) => void): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  // Crosslinks first
  const re = /\[\[([a-z0-9\-]+)\]\]/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) parts.push(text.slice(lastIdx, m.index));
    const slug = m[1];
    parts.push(
      <button
        key={key++}
        onClick={() => onLink(slug)}
        className="text-gilt-400 hover:text-gilt-400 underline underline-offset-2 decoration-dotted"
      >
        {slug.replace(/-/g, ' ')}
      </button>
    );
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  // Then bold inside text fragments
  return parts.flatMap((p) => {
    if (typeof p !== 'string') return [p];
    const out: (string | JSX.Element)[] = [];
    const br = /\*\*([^*]+)\*\*/g;
    let li = 0;
    let bm: RegExpExecArray | null;
    while ((bm = br.exec(p)) !== null) {
      if (bm.index > li) out.push(p.slice(li, bm.index));
      out.push(<strong key={key++} className="text-vellum-100">{bm[1]}</strong>);
      li = bm.index + bm[0].length;
    }
    if (li < p.length) out.push(p.slice(li));
    return out;
  });
}

export default function Chronicle() {
  const { slug } = useParams<{ slug?: string }>();
  const nav = useNavigate();

  const [stats, setStats] = useState<ChronicleStats | null>(null);
  const [eras, setEras] = useState<EraSummary[]>([]);
  const [activeEra, setActiveEra] = useState<string | null>(null);
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [article, setArticle] = useState<Article | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [contributeOpen, setContributeOpen] = useState(false);
  const [ceremonyEra, setCeremonyEra] = useState<string | null>(null);
  const [autopsySlug, setAutopsySlug] = useState<string | null>(null);
  const [view, setView] = useState<'articles' | 'languages'>('articles');
  const [linguistic, setLinguistic] = useState<
    { era_id: string; era_name: string; in_world_year: number; parent_era: string | null; phonology_notes: string; sample_lexicon: Record<string, string>; sample_text: string }[]
  >([]);

  useEffect(() => {
    if (view === 'languages') {
      chronicle.lexicon().then((r) => setLinguistic(r.items)).catch(() => setLinguistic([]));
    }
  }, [view]);

  // Stats poll — drives the live-counter feel during the autonomous run
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const s = await chronicle.stats();
        if (!stop) setStats(s);
      } catch { /* ignore */ }
    };
    tick();
    const id = setInterval(tick, 8_000);
    return () => { stop = true; clearInterval(id); };
  }, []);

  useEffect(() => {
    chronicle.listEras().then((r) => setEras(r.items)).catch(() => setEras([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    chronicle
      .listArticles({ era_id: activeEra || undefined, limit: 200 })
      .then((r) => setArticles(r.items))
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, [activeEra]);

  useEffect(() => {
    if (!slug) {
      setArticle(null);
      return;
    }
    chronicle.getArticle(slug).then(setArticle).catch(() => setArticle(null));
  }, [slug]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter((a) => a.title.toLowerCase().includes(q) || a.kind.includes(q));
  }, [articles, search]);

  return (
    <div className="min-h-screen bg-night-950 text-vellum-200">
      <ContributeModal open={contributeOpen} onClose={() => setContributeOpen(false)} />
      {ceremonyEra && <EraCeremony eraId={ceremonyEra} onClose={() => setCeremonyEra(null)} />}
      {autopsySlug && (
        <Autopsy
          slug={autopsySlug}
          onClose={() => setAutopsySlug(null)}
          onOpenArticle={(s) => nav(`/chronicle/${s}`)}
        />
      )}
      <Masthead />
      <div className="border-b border-subtle bg-page/85 backdrop-blur sticky top-14 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-baseline gap-6">
          <span className="eyebrow text-faint">archive</span>
          <h1 className="font-display text-h2 text-heading tracking-[-0.02em]">
            Chroniclon
          </h1>
          <div className="eyebrow text-faint hidden md:block">
            a wikipedia for a world that doesn't exist
          </div>
          <div className="ml-auto flex items-center gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="search articles…"
              className="bg-surface border border-subtle rounded-md px-3 py-1.5 text-body text-input placeholder:text-faint focus:outline-none focus:border-gilt-500 w-64 font-ui"
            />
            <button
              onClick={() => setContributeOpen(true)}
              className="font-mono text-eyebrow uppercase tracking-eyebrow text-gilt-500 hover:text-gilt-400 transition-colors"
            >
              + contribute
            </button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 pb-4">
          <StatsBanner stats={stats} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-12 gap-8">
        <div className="col-span-12 md:col-span-3">
          <EraNav eras={eras} active={activeEra} onSelect={setActiveEra} onCeremony={setCeremonyEra} />
          <div className="mt-8 text-sm">
            <div className="text-[11px] uppercase tracking-widest text-ink-500 mb-2">Browse by kind</div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(KIND_LABELS) as ArticleKind[]).map((k) => (
                <span key={k} className="text-[11px] px-2 py-0.5 rounded bg-ink-800/60 text-vellum-400">
                  {KIND_LABELS[k]}
                </span>
              ))}
            </div>
          </div>
        </div>

        <main className="col-span-12 md:col-span-9">
          <div className="mb-6 flex items-center gap-1 text-body">
            <button
              onClick={() => setView('articles')}
              className={`font-mono text-eyebrow uppercase tracking-eyebrow px-3 py-1.5 rounded transition-colors ${
                view === 'articles' ? 'bg-surface text-heading' : 'text-faint hover:text-sub'
              }`}
            >
              articles
            </button>
            <button
              onClick={() => setView('languages')}
              className={`font-mono text-eyebrow uppercase tracking-eyebrow px-3 py-1.5 rounded transition-colors ${
                view === 'languages' ? 'bg-surface text-heading' : 'text-faint hover:text-sub'
              }`}
            >
              languages
            </button>
          </div>
          {view === 'languages' ? (
            <LanguageTree data={linguistic} />
          ) : article ? (
            <article>
              <button
                onClick={() => nav('/chronicle')}
                className="font-mono text-eyebrow uppercase tracking-eyebrow text-faint hover:text-heading transition-colors mb-6"
              >
                ← all articles
              </button>

              {/* Editorial header — eyebrow over headline, meta strip below */}
              <div className="eyebrow text-faint mb-3 flex items-center gap-3 flex-wrap">
                <span>{article.kind}</span>
                <span className="text-faint/60">·</span>
                <span>{article.voice}</span>
                <span className="text-faint/60">·</span>
                <span>year {article.in_world_year}</span>
                {article.contributor ? (
                  <>
                    <span className="text-faint/60">·</span>
                    <span className="text-moss-500 normal-case tracking-normal font-mono">via @{article.contributor}</span>
                  </>
                ) : null}
              </div>
              <h1 className="font-display text-h1 text-heading tracking-[-0.025em] leading-[1.08] mb-4">
                {article.title}
              </h1>
              <div className="flex items-baseline justify-between gap-3 mb-8 pb-4 border-b border-subtle">
                <span className="font-mono text-micro text-dim tabular-nums">
                  {article.word_count.toLocaleString()} words
                  {article.anti_slop_score !== undefined && article.anti_slop_score !== null
                    ? ` · anti-slop ${article.anti_slop_score.toFixed(2)}`
                    : ''}
                  {article.fact_check_score !== undefined && article.fact_check_score !== null
                    ? ` · fact-check ${article.fact_check_score.toFixed(2)}`
                    : ''}
                </span>
                <button
                  type="button"
                  onClick={() => setAutopsySlug(article.slug)}
                  title="Trace this article back to the simulation event"
                  className="font-mono text-eyebrow uppercase tracking-eyebrow text-gilt-500 hover:text-gilt-400 transition-colors"
                >
                  ✦ autopsy
                </button>
              </div>

              {article.illustration_url && (
                <figure className="mb-8">
                  <img
                    src={article.illustration_url}
                    alt={article.title}
                    loading="lazy"
                    className="w-full rounded border border-subtle"
                  />
                  <figcaption className="eyebrow text-faint mt-2 text-center">
                    {article.kind} · era {article.era_id}
                  </figcaption>
                </figure>
              )}

              {article.audio_url && (
                <div className="mb-8 px-4 py-3 border border-subtle rounded bg-surface">
                  <div className="eyebrow text-gilt-500 mb-2">narration</div>
                  <audio controls preload="none" src={article.audio_url} className="w-full" />
                </div>
              )}

              {/* Body — editorial prose register, drop cap on first paragraph */}
              <div className="editorial-prose">
                {renderBody(article.body_md, (s) => nav(`/chronicle/${s}`))}
              </div>

              {/* Colophon — publication imprint at the bottom of the article */}
              <section className="mt-16 pt-8 border-t border-subtle">
                <div className="eyebrow text-faint mb-4">colophon</div>
                <dl className="grid grid-cols-[120px_1fr] gap-y-2 gap-x-6 font-mono text-micro tabular-nums">
                  <dt className="text-faint">canon decision</dt>
                  <dd className="text-heading">Hermes-4-70B</dd>
                  <dt className="text-faint">writer</dt>
                  <dd className="text-heading">
                    {article.word_count > 0 ? 'Kimi-K2.6' : 'Hermes-4-70B'} ·{' '}
                    {article.word_count.toLocaleString()} words
                  </dd>
                  <dt className="text-faint">anti-slop</dt>
                  <dd className="text-heading">
                    {article.anti_slop_score !== undefined && article.anti_slop_score !== null
                      ? article.anti_slop_score.toFixed(2)
                      : '—'}
                  </dd>
                  <dt className="text-faint">fact-check</dt>
                  <dd className="text-heading">
                    {article.fact_check_score !== undefined && article.fact_check_score !== null
                      ? article.fact_check_score.toFixed(2)
                      : '—'}
                  </dd>
                  <dt className="text-faint">cross-links</dt>
                  <dd className="text-heading">{article.backlinks?.length ?? 0}</dd>
                  <dt className="text-faint">era</dt>
                  <dd className="text-heading">{article.era_id}</dd>
                  {article.contributor && (
                    <>
                      <dt className="text-faint">contributor</dt>
                      <dd className="text-moss-500">@{article.contributor}</dd>
                    </>
                  )}
                </dl>
              </section>

              {article.inbound.length > 0 && (
                <section className="mt-10 pt-6 border-t border-subtle">
                  <div className="eyebrow text-faint mb-3">cited by</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {article.inbound.map((s) => (
                      <button
                        key={s}
                        onClick={() => nav(`/chronicle/${s}`)}
                        className="font-display text-body-lg text-sub hover:text-gilt-500 transition-colors underline underline-offset-4 decoration-gilt-500/30 hover:decoration-gilt-500"
                      >
                        {s.replace(/-/g, ' ')}
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </article>
          ) : (
            <section>
              <div className="eyebrow text-faint mb-4 flex items-baseline gap-3">
                <span className="font-display text-h3 text-heading normal-case tracking-[-0.015em] mr-2">
                  {activeEra ? eras.find((e) => e.era_id === activeEra)?.name : 'All eras'}
                </span>
                <span className="tabular-nums">
                  {filtered.length} article{filtered.length === 1 ? '' : 's'}
                </span>
              </div>
              {loading ? (
                <div className="font-ui text-body text-dim italic">loading the canon…</div>
              ) : filtered.length === 0 ? (
                <div className="font-ui text-body text-dim py-12 text-center italic">
                  No articles yet. The autonomous run hasn't reached this era.
                </div>
              ) : (
                <div className="border border-subtle rounded overflow-hidden">
                  {filtered.map((a) => (
                    <ArticleListRow key={a.article_id} a={a} onOpen={(s) => nav(`/chronicle/${s}`)} />
                  ))}
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
