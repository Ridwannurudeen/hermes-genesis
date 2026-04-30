import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { chronicle, type ArticleSummary } from '../api';

/* Wire-service ticker — the live signature moment on Landing.
 *
 * Polls /api/chronicle/articles?limit=15 every 30s, marquees the titles
 * left-to-right with a thin live-dot prefix and a year stamp. Edge-fade
 * mask. Pauses on hover. Reduced-motion drops the animation entirely.
 *
 * The point: prove the system is autonomously publishing. Showing recent
 * titles with timestamps is more credible than asserting "live" in copy.
 */
export default function WireTicker() {
  const [articles, setArticles] = useState<ArticleSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      chronicle
        .listArticles({ limit: 15 })
        .then((r) => {
          if (!cancelled) setArticles(r.items ?? []);
        })
        .catch(() => {
          /* keep last-known on transient failure */
        });
    };
    load();
    const t = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (articles.length === 0) return null;

  // Duplicate the list so the marquee loops seamlessly via translate -50%.
  const items = [...articles, ...articles];

  return (
    <div
      className="border-b border-subtle bg-page/60 marquee-mask overflow-hidden"
      aria-label="Recent canonized articles"
      role="marquee"
    >
      <div className="max-w-7xl mx-auto px-6 py-2 flex items-center gap-6">
        <div className="flex items-center gap-2 shrink-0">
          <span className="live-dot" aria-hidden />
          <span className="font-mono text-eyebrow uppercase tracking-eyebrow text-gilt-500">
            wire
          </span>
        </div>
        <div className="relative flex-1 overflow-hidden">
          <div
            className="flex items-center gap-8 whitespace-nowrap animate-marquee group-hover:[animation-play-state:paused] hover:[animation-play-state:paused]"
            style={{ width: 'max-content' }}
          >
            {items.map((a, i) => (
              <Link
                key={`${a.slug}-${i}`}
                to={`/chronicle/${a.slug}`}
                className="flex items-baseline gap-3 group"
              >
                <span className="font-mono text-eyebrow uppercase tracking-eyebrow text-faint shrink-0">
                  year {a.in_world_year}
                </span>
                <span className="font-display text-body-sm text-sub group-hover:text-gilt-500 transition-colors">
                  {a.title}
                </span>
                <span className="text-faint/60">·</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
