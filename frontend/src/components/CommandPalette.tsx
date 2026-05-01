import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { chronicle } from '../api';

type SearchHit = {
  slug: string;
  title: string;
  kind: string;
  in_world_year: number;
  voice: string;
  snippet: string;
};

type Suggestion =
  | { kind: 'route'; label: string; subtitle: string; path: string }
  | { kind: 'article'; label: string; subtitle: string; slug: string; snippet: string };

const STATIC_ROUTES: Array<{ label: string; subtitle: string; path: string }> = [
  { label: 'Chroniclon archive', subtitle: 'all canonized articles', path: '/chronicle' },
  { label: 'Worlds', subtitle: 'browse civilizations', path: '/' },
  { label: 'Regen', subtitle: 'generate from a single sentence', path: '/regen' },
  { label: 'Demo', subtitle: 'two-minute live tour', path: '/demo' },
  { label: 'Control room', subtitle: 'live agent pipeline', path: '/control' },
  { label: 'Judge view', subtitle: 'metrics + proofs', path: '/judge' },
  { label: 'Glossary', subtitle: 'constructed-language lexicon', path: '/glossary' },
  { label: 'About', subtitle: 'methodology + colophon', path: '/about' },
  { label: 'Contributors', subtitle: 'humans + agents on the masthead', path: '/contributors' },
];

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [trending, setTrending] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setHits([]);
      setActive(0);
      // Focus on next tick after the modal mounts.
      setTimeout(() => inputRef.current?.focus(), 0);
      // Lazy-load trending on first open.
      if (trending.length === 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).fetch('/api/chronicle/articles?limit=6').then((r: Response) => r.ok ? r.json() : { items: [] }).then((data: { items: SearchHit[] }) => {
          setTrending((data.items ?? []).slice(0, 5));
        }).catch(() => {});
      }
    }
  }, [open, trending.length]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setHits([]);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const t = setTimeout(() => {
      chronicle
        .search(q, 12)
        .then((r) => {
          if (!cancelled) setHits(r.items);
        })
        .catch(() => {
          if (!cancelled) setHits([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 140);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const suggestions = useMemo<Suggestion[]>(() => {
    const q = query.trim().toLowerCase();
    const articles: Suggestion[] = hits.map((h) => ({
      kind: 'article' as const,
      label: h.title,
      subtitle: `${h.kind} · year ${h.in_world_year}`,
      slug: h.slug,
      snippet: h.snippet,
    }));
    const routes: Suggestion[] = STATIC_ROUTES.filter((r) =>
      q ? r.label.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q) : true,
    ).map((r) => ({ kind: 'route' as const, ...r }));
    return [...articles, ...routes];
  }, [hits, query]);

  useEffect(() => {
    if (active >= suggestions.length) setActive(0);
  }, [suggestions, active]);

  const choose = (s: Suggestion) => {
    onClose();
    if (s.kind === 'route') nav(s.path);
    else nav(`/chronicle/${s.slug}`);
  };

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] bg-night-950/80 backdrop-blur-sm flex items-start justify-center pt-[12vh] px-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-page border border-subtle rounded-lg shadow-2xl overflow-hidden"
      >
        <div className="flex items-baseline gap-3 px-4 py-3 border-b border-subtle">
          <span className="font-mono text-eyebrow uppercase tracking-eyebrow text-faint">search</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(suggestions.length - 1, a + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (suggestions[active]) choose(suggestions[active]);
              }
            }}
            placeholder="search the canon — articles, sections, routes…"
            className="flex-1 bg-transparent text-prose font-display text-heading placeholder:text-faint/70 focus:outline-none"
          />
          <span className="font-mono text-eyebrow uppercase tracking-eyebrow text-faint hidden sm:inline">
            esc
          </span>
        </div>
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {!query.trim() ? (
            <div className="px-4 py-6 text-body-sm text-faint space-y-5">
              {trending.length > 0 && (
                <div>
                  <div className="eyebrow text-faint mb-2">latest from the canon</div>
                  <ul className="space-y-1">
                    {trending.map((h) => (
                      <li key={h.slug}>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            nav(`/chronicle/${h.slug}`);
                          }}
                          className="w-full text-left px-3 py-2 rounded font-ui text-sub hover:bg-surface/60"
                        >
                          <span className="font-display text-body-lg text-heading">{h.title}</span>
                          <span className="text-faint ml-2">— year {h.in_world_year}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <div className="eyebrow text-faint mb-2">jump to</div>
                <ul className="space-y-1">
                  {STATIC_ROUTES.slice(0, 6).map((r) => (
                    <li key={r.path}>
                      <button
                        type="button"
                        onClick={() => choose({ kind: 'route', ...r })}
                        className="w-full text-left px-3 py-2 rounded font-ui text-sub hover:bg-surface/60"
                      >
                        <span className="font-display text-body-lg">{r.label}</span>
                        <span className="text-faint ml-2">— {r.subtitle}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : loading && hits.length === 0 ? (
            <div className="px-4 py-6 text-body-sm text-faint italic">searching the canon…</div>
          ) : suggestions.length === 0 ? (
            <div className="px-4 py-6 text-body-sm text-faint italic">
              no canon matches "{query}"
            </div>
          ) : (
            <ul>
              {suggestions.map((s, i) => (
                <li key={s.kind === 'route' ? s.path : s.slug}>
                  <button
                    type="button"
                    onClick={() => choose(s)}
                    onMouseEnter={() => setActive(i)}
                    className={`w-full text-left px-4 py-3 ${
                      active === i ? 'bg-surface' : 'hover:bg-surface/60'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-display text-body-lg text-heading truncate">
                        {s.label}
                      </span>
                      <span className="font-mono text-eyebrow uppercase tracking-eyebrow text-faint shrink-0">
                        {s.kind === 'route' ? 'page' : 'article'}
                      </span>
                    </div>
                    <div className="text-body-sm text-faint mt-0.5 truncate">{s.subtitle}</div>
                    {s.kind === 'article' && s.snippet && (
                      <div className="text-body-sm text-dim italic mt-1 line-clamp-2">
                        {s.snippet}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-subtle px-4 py-2 flex items-center gap-4 font-mono text-eyebrow uppercase tracking-eyebrow text-faint">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
          <span className="ml-auto">{suggestions.length} results</span>
        </div>
      </div>
    </div>
  );
}
