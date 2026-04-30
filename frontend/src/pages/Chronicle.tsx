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
  scholarly: 'bg-slate-700/40 text-slate-200',
  diary: 'bg-amber-700/30 text-amber-200',
  newspaper: 'bg-blue-700/30 text-blue-200',
  scripture: 'bg-violet-700/30 text-violet-200',
  court: 'bg-rose-700/30 text-rose-200',
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
    <div className="grid grid-cols-5 gap-px bg-slate-800/40 border border-slate-700/60 rounded-md overflow-hidden">
      {cells.map((c) => (
        <div key={c.label} className="bg-slate-900/60 px-4 py-3 text-center">
          <div className="text-2xl font-semibold tracking-tight text-slate-100">{c.value}</div>
          <div className="text-[11px] uppercase tracking-widest text-slate-500 mt-0.5">{c.label}</div>
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
      <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-2">Eras</div>
      <button
        onClick={() => onSelect(null)}
        className={`block w-full text-left px-3 py-2 rounded ${
          active === null ? 'bg-slate-700/50 text-slate-100' : 'text-slate-400 hover:bg-slate-800/40'
        }`}
      >
        All eras
      </button>
      {eras.map((e) => (
        <div
          key={e.era_id}
          className={`group relative mt-0.5 rounded ${
            active === e.era_id ? 'bg-slate-700/50' : 'hover:bg-slate-800/40'
          }`}
        >
          <button
            onClick={() => onSelect(e.era_id)}
            className={`block w-full text-left px-3 py-2 ${
              active === e.era_id ? 'text-slate-100' : 'text-slate-400'
            }`}
          >
            <div className="font-medium pr-8">{e.name}</div>
            <div className="text-[11px] text-slate-500">
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
            className="absolute top-2 right-2 text-amber-500/60 hover:text-amber-300 opacity-0 group-hover:opacity-100 transition-opacity text-base"
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
      className="w-full text-left px-4 py-3 border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors flex gap-3"
    >
      {a.illustration_url ? (
        <img
          src={a.illustration_url}
          alt=""
          loading="lazy"
          className="w-20 h-14 rounded shrink-0 object-cover border border-slate-800/80 bg-slate-900"
        />
      ) : (
        <div className="w-20 h-14 rounded shrink-0 border border-slate-800/80 bg-slate-900/40" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-serif text-lg text-slate-100 leading-tight flex items-center gap-2 truncate">
            <span className="truncate">{a.title}</span>
            {a.audio_url ? (
              <span
                title="audio narration available"
                className="inline-flex items-center text-amber-400/90 text-[10px] uppercase tracking-widest border border-amber-700/50 rounded px-1.5 py-0.5 shrink-0"
              >
                audio
              </span>
            ) : null}
          </div>
          <div className="shrink-0 text-[11px] text-slate-500 font-mono">y. {a.in_world_year}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <span className="text-[11px] uppercase tracking-wider text-slate-500">{a.kind}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${VOICE_BADGE[a.voice] ?? 'bg-slate-700/40 text-slate-300'}`}>
            {a.voice}
          </span>
          <span className="text-[11px] text-slate-500">{a.word_count.toLocaleString()} words</span>
          {a.contributor ? (
            <span className="text-[11px] text-emerald-400">via @{a.contributor}</span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function renderBody(md: string, onLink: (slug: string) => void): JSX.Element[] {
  // Light markdown → React. Handles: # / ## / ### headers, [[slug]] crosslinks, **bold**, blank-line paragraphs.
  const blocks = md.split(/\n{2,}/);
  return blocks.map((block, i) => {
    const trimmed = block.trim();
    if (!trimmed) return <div key={i} />;
    const headerMatch = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const text = headerMatch[2];
      const cls =
        level === 1
          ? 'text-3xl font-serif text-slate-50 mt-2 mb-4'
          : level === 2
          ? 'text-xl font-serif text-slate-100 mt-6 mb-2'
          : 'text-lg font-serif text-slate-200 mt-4 mb-2';
      return <h2 key={i} className={cls}>{renderInline(text, onLink)}</h2>;
    }
    if (trimmed.startsWith('> ')) {
      return (
        <blockquote key={i} className="border-l-2 border-amber-700/50 pl-4 py-1 my-3 text-slate-300 italic">
          {renderInline(trimmed.slice(2), onLink)}
        </blockquote>
      );
    }
    return (
      <p key={i} className="text-slate-300 leading-relaxed my-3">
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
        className="text-amber-300 hover:text-amber-200 underline underline-offset-2 decoration-dotted"
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
      out.push(<strong key={key++} className="text-slate-100">{bm[1]}</strong>);
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
    <div className="min-h-screen bg-slate-950 text-slate-200">
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
            <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-2">Browse by kind</div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(KIND_LABELS) as ArticleKind[]).map((k) => (
                <span key={k} className="text-[11px] px-2 py-0.5 rounded bg-slate-800/60 text-slate-400">
                  {KIND_LABELS[k]}
                </span>
              ))}
            </div>
          </div>
        </div>

        <main className="col-span-12 md:col-span-9">
          <div className="mb-4 flex items-center gap-2 text-sm">
            <button
              onClick={() => setView('articles')}
              className={`px-3 py-1.5 rounded ${
                view === 'articles' ? 'bg-slate-700/50 text-slate-100' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Articles
            </button>
            <button
              onClick={() => setView('languages')}
              className={`px-3 py-1.5 rounded ${
                view === 'languages' ? 'bg-slate-700/50 text-slate-100' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Languages
            </button>
          </div>
          {view === 'languages' ? (
            <LanguageTree data={linguistic} />
          ) : article ? (
            <article className="prose-chronicle">
              <button
                onClick={() => nav('/chronicle')}
                className="text-slate-500 text-sm mb-3 hover:text-slate-300"
              >
                ← all articles
              </button>
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <span className="text-[11px] uppercase tracking-wider text-slate-500">{article.kind}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${VOICE_BADGE[article.voice] ?? ''}`}>
                  {article.voice}
                </span>
                <span className="text-[11px] text-slate-500">year {article.in_world_year}</span>
                <span className="text-[11px] text-slate-500">{article.word_count.toLocaleString()} words</span>
                {article.contributor ? (
                  <span className="text-[11px] text-emerald-400">via @{article.contributor}</span>
                ) : null}
                <button
                  type="button"
                  onClick={() => setAutopsySlug(article.slug)}
                  title="Trace this article back to the simulation event"
                  className="ml-auto text-[11px] uppercase tracking-widest text-amber-300/80 hover:text-amber-200 border border-amber-700/40 hover:border-amber-500/60 rounded px-2 py-1"
                >
                  ✦ autopsy
                </button>
              </div>
              {article.illustration_url && (
                <figure className="mb-6 -mx-2">
                  <img
                    src={article.illustration_url}
                    alt={article.title}
                    loading="lazy"
                    className="w-full rounded-md border border-slate-800/60 shadow-lg"
                  />
                  <figcaption className="text-[11px] uppercase tracking-widest text-slate-500 mt-2 text-center">
                    {article.kind} · era {article.era_id}
                  </figcaption>
                </figure>
              )}
              {article.audio_url && (
                <div className="mb-6 px-4 py-3 rounded border border-amber-800/40 bg-amber-950/20">
                  <div className="text-[11px] uppercase tracking-widest text-amber-400/80 mb-2">narration</div>
                  <audio controls preload="none" src={article.audio_url} className="w-full" />
                </div>
              )}
              <div className="font-serif">{renderBody(article.body_md, (s) => nav(`/chronicle/${s}`))}</div>
              {article.inbound.length > 0 && (
                <section className="mt-10 pt-6 border-t border-slate-800">
                  <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-2">Cited by</div>
                  <div className="flex flex-wrap gap-2">
                    {article.inbound.map((s) => (
                      <button
                        key={s}
                        onClick={() => nav(`/chronicle/${s}`)}
                        className="text-amber-300 hover:text-amber-200 text-sm underline underline-offset-2"
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
              <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-3">
                {activeEra ? eras.find((e) => e.era_id === activeEra)?.name : 'All eras'} · {filtered.length} article{filtered.length === 1 ? '' : 's'}
              </div>
              {loading ? (
                <div className="text-slate-500 text-sm">loading the canon…</div>
              ) : filtered.length === 0 ? (
                <div className="text-slate-500 text-sm py-12 text-center">
                  No articles yet. The autonomous run hasn't reached this era.
                </div>
              ) : (
                <div className="border border-slate-800/60 rounded-md overflow-hidden">
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
