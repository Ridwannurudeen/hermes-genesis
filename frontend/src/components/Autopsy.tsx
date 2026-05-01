import { useEffect, useState } from 'react';
import { authHeaders } from '../api';

type Actor = { id: string; name?: string; role?: string; alive?: boolean };
type FactionRef = { id: string; name?: string; color?: string; ideology?: string };

type AutopsyData =
  | { linked: false; article_slug: string; reason?: string }
  | {
      linked: true;
      article_slug: string;
      world_id: string;
      world_name: string;
      source_event: {
        id: string;
        day: number;
        type: string;
        title: string;
        narrative: string;
        actors: Actor[];
        factions: FactionRef[];
        regions_affected: string[];
        agent_triggered: boolean;
        user_triggered: boolean;
        prophecy_id: string | null;
      };
      ancestors: { id: string; day: number; type: string; title: string; narrative: string }[];
      direct_descendants: { id: string; day: number; type: string; title: string; narrative: string }[];
      follow_ups: {
        id: string;
        day: number;
        type: string;
        title: string;
        shared_actors: string[];
        shared_factions: string[];
      }[];
      outcome: {
        territory_changes: Record<string, string>;
        casualties: Record<string, number>;
        morale_changes: Record<string, number>;
        character_effects: { char_id: string; effect: string; value: number | string | boolean }[];
      };
      related_articles: { slug: string; title: string; in_world_year: number; kind: string }[];
    };

type Props = {
  slug: string | null;
  onClose: () => void;
  onOpenArticle?: (slug: string) => void;
};

export default function Autopsy({ slug, onClose, onOpenArticle }: Props) {
  const [data, setData] = useState<AutopsyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setData(null);
    setError(null);
    fetch(`/api/chronicle/autopsy/${slug}`, {
      headers: authHeaders('GET'),
      credentials: 'same-origin',
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: AutopsyData) => setData(j))
      .catch((e) => setError(e.message ?? 'failed to load'));
  }, [slug]);

  if (!slug) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-start justify-center p-4 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl my-8 bg-page border border-subtle rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-baseline justify-between border-b border-subtle/80 px-6 py-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-gilt-500/70">
              civilization autopsy
            </div>
            <div className="font-display text-xl text-heading mt-0.5">why this happened</div>
          </div>
          <button onClick={onClose} className="text-faint hover:text-heading text-sm">
            close
          </button>
        </header>

        <div className="p-6 space-y-6">
          {error && (
            <div className="text-crimson-500 text-sm border border-crimson-500/30 bg-crimson-500/10 rounded-md p-4">
              {error}
            </div>
          )}

          {!error && !data && (
            <div className="text-faint italic animate-pulse">tracing causation…</div>
          )}

          {data && !data.linked && (
            <div className="text-dim text-sm">
              No causal trace available — this article is older than the autopsy index. Newly canonized
              articles include the source event and its causal lineage.
            </div>
          )}

          {data && data.linked && (
            <>
              <section>
                <div className="text-[11px] uppercase tracking-widest text-faint mb-1">
                  source event · day {data.source_event.day} · {data.source_event.type}
                </div>
                <div className="font-display text-lg text-heading">{data.source_event.title}</div>
                {data.source_event.narrative && (
                  <div className="text-sm text-dim italic mt-1 leading-relaxed">
                    {data.source_event.narrative}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {data.source_event.user_triggered && (
                    <span className="px-2 py-0.5 rounded border border-moss-500/60 text-moss-500">
                      user-triggered
                    </span>
                  )}
                  {data.source_event.agent_triggered && (
                    <span className="px-2 py-0.5 rounded border border-gilt-500/60 text-gilt-400">
                      agent-triggered
                    </span>
                  )}
                  {data.source_event.prophecy_id && (
                    <span className="px-2 py-0.5 rounded border border-gilt-400/60 text-gilt-400">
                      fulfilled prophecy
                    </span>
                  )}
                </div>
              </section>

              {(data.source_event.actors.length > 0 || data.source_event.factions.length > 0) && (
                <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {data.source_event.actors.length > 0 && (
                    <div>
                      <div className="text-[11px] uppercase tracking-widest text-faint mb-1">cast</div>
                      <ul className="text-sm space-y-0.5">
                        {data.source_event.actors.map((a) => (
                          <li key={a.id} className="text-sub">
                            {a.name || a.id}
                            {a.role && <span className="text-faint ml-1">· {a.role}</span>}
                            {a.alive === false && (
                              <span className="text-crimson-500 ml-1 text-xs">(deceased)</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {data.source_event.factions.length > 0 && (
                    <div>
                      <div className="text-[11px] uppercase tracking-widest text-faint mb-1">factions</div>
                      <ul className="text-sm space-y-0.5">
                        {data.source_event.factions.map((f) => (
                          <li key={f.id} className="text-sub flex items-center gap-2">
                            {f.color && (
                              <span
                                className="inline-block w-2 h-2 rounded-full"
                                style={{ backgroundColor: f.color }}
                              />
                            )}
                            <span>{f.name || f.id}</span>
                            {f.ideology && <span className="text-faint text-xs">· {f.ideology}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}

              {data.ancestors.length > 0 && (
                <section>
                  <div className="text-[11px] uppercase tracking-widest text-faint mb-2">
                    causal chain — what led here
                  </div>
                  <ol className="border-l border-subtle/60 pl-4 space-y-3">
                    {data.ancestors.map((a) => (
                      <li key={a.id} className="relative">
                        <span className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-gilt-500" />
                        <div className="text-sm text-sub">
                          <span className="text-faint text-xs">day {a.day} · {a.type}</span>
                          <div className="font-display text-heading">{a.title}</div>
                          {a.narrative && <div className="text-xs text-faint mt-0.5">{a.narrative}</div>}
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {(Object.keys(data.outcome.territory_changes).length > 0 ||
                Object.keys(data.outcome.casualties).length > 0 ||
                Object.keys(data.outcome.morale_changes).length > 0) && (
                <section>
                  <div className="text-[11px] uppercase tracking-widest text-faint mb-2">
                    what changed
                  </div>
                  <div className="text-sm space-y-1">
                    {Object.entries(data.outcome.territory_changes).map(([fname, rid]) => (
                      <div key={`t-${fname}-${rid}`} className="text-sub">
                        <span className="text-faint">territory · </span>
                        {fname} took region <span className="font-mono text-gilt-400">{rid}</span>
                      </div>
                    ))}
                    {Object.entries(data.outcome.casualties).map(([fid, n]) => (
                      <div key={`c-${fid}`} className="text-sub">
                        <span className="text-faint">casualties · </span>
                        <span className="font-mono text-crimson-500">{n.toLocaleString()}</span> for {fid}
                      </div>
                    ))}
                    {Object.entries(data.outcome.morale_changes).map(([fid, n]) => (
                      <div key={`m-${fid}`} className="text-sub">
                        <span className="text-faint">morale · </span>
                        <span className={`font-mono ${n >= 0 ? 'text-moss-500' : 'text-crimson-500'}`}>
                          {n >= 0 ? '+' : ''}{n}
                        </span>{' '}
                        for {fid}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {(data.direct_descendants.length > 0 || data.follow_ups.length > 0) && (
                <section>
                  <div className="text-[11px] uppercase tracking-widest text-faint mb-2">
                    aftermath
                  </div>
                  {data.direct_descendants.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs text-faint mb-1">directly caused</div>
                      <ul className="text-sm space-y-1">
                        {data.direct_descendants.map((d) => (
                          <li key={d.id} className="text-sub">
                            <span className="text-faint text-xs">day {d.day} · {d.type}</span>
                            <div className="font-display text-heading">{d.title}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {data.follow_ups.length > 0 && (
                    <div>
                      <div className="text-xs text-faint mb-1">later events sharing actors / factions</div>
                      <ul className="text-sm space-y-1">
                        {data.follow_ups.map((f) => (
                          <li key={f.id} className="text-sub">
                            <span className="text-faint text-xs">day {f.day} · {f.type}</span>
                            <div className="font-display text-heading">{f.title}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}

              {data.related_articles.length > 0 && (
                <section>
                  <div className="text-[11px] uppercase tracking-widest text-faint mb-2">
                    related canon (same actors)
                  </div>
                  <ul className="text-sm space-y-1">
                    {data.related_articles.map((r) => (
                      <li key={r.slug}>
                        <button
                          onClick={() => {
                            onOpenArticle?.(r.slug);
                            onClose();
                          }}
                          className="text-gilt-500 hover:text-gilt-600 dark:hover:text-gilt-400 text-left"
                        >
                          {r.title}
                          <span className="text-faint text-xs ml-2">· {r.kind} · year {r.in_world_year}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
