import { useEffect, useState } from 'react';
import { authHeaders } from '../api';

type ProvenanceData =
  | { linked: false }
  | {
      linked: true;
      world_id: string;
      world_name: string;
      source_event: { id: string; day: number; type: string; title: string };
      ancestors: { id: string; day: number; type: string; title: string }[];
    };

type RawAutopsy =
  | { linked: false; article_slug: string; reason?: string }
  | {
      linked: true;
      article_slug: string;
      world_id: string;
      world_name: string;
      source_event: { id: string; day: number; type: string; title: string };
      ancestors: { id: string; day: number; type: string; title: string }[];
    };

type Props = {
  slug: string;
  onOpenAutopsy: () => void;
};

/**
 * Provenance sidebar — surfaces the simulation source-event of a canonized
 * article inline in the right rail. Click "full causal trace" to open the
 * original Autopsy modal for the heavier data (descendants, outcome, etc.).
 *
 * The autopsy endpoint is the single source of truth for "where did this
 * article come from in the sim?" — surfacing it visibly is what turns
 * Chroniclon from a wiki into a publication of record.
 */
export default function Provenance({ slug, onOpenAutopsy }: Props) {
  const [data, setData] = useState<ProvenanceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    fetch(`/api/chronicle/autopsy/${slug}`, {
      headers: authHeaders('GET'),
      credentials: 'same-origin',
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as RawAutopsy;
      })
      .then((j) => {
        if (cancelled) return;
        if (!j.linked) {
          setData({ linked: false });
        } else {
          setData({
            linked: true,
            world_id: j.world_id,
            world_name: j.world_name,
            source_event: j.source_event,
            ancestors: (j.ancestors || []).slice(0, 3),
          });
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'failed to load');
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return null;
  }
  if (!data) {
    return (
      <div>
        <div className="eyebrow text-faint mb-2">provenance</div>
        <div className="skeleton h-3 w-32 mb-2" />
        <div className="skeleton h-3 w-44" />
      </div>
    );
  }
  if (!data.linked) {
    return (
      <div>
        <div className="eyebrow text-faint mb-2">provenance</div>
        <div className="text-body-sm text-faint italic">
          older than the autopsy index — no causal trace available.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="eyebrow text-faint mb-3">provenance</div>
      <div className="border-l-2 border-gilt-500/50 pl-3">
        <div className="font-mono text-eyebrow uppercase tracking-eyebrow text-faint">
          source event · day {data.source_event.day}
        </div>
        <div className="font-display text-body-lg text-heading mt-1 leading-tight">
          {data.source_event.title}
        </div>
        <div className="font-mono text-eyebrow uppercase tracking-eyebrow text-gilt-500 mt-1">
          {data.source_event.type}
        </div>
      </div>
      {data.ancestors.length > 0 && (
        <div className="mt-5">
          <div className="eyebrow text-faint mb-2">causal chain</div>
          <ol className="border-l border-subtle pl-3 space-y-2.5">
            {data.ancestors.map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute -left-[7px] top-1.5 w-2 h-2 rounded-full bg-gilt-500/70" />
                <div className="font-mono text-eyebrow uppercase tracking-eyebrow text-faint">
                  day {a.day}
                </div>
                <div className="text-body-sm text-sub leading-snug">{a.title}</div>
              </li>
            ))}
          </ol>
        </div>
      )}
      <button
        type="button"
        onClick={onOpenAutopsy}
        className="mt-5 font-mono text-eyebrow uppercase tracking-eyebrow text-gilt-500 hover:text-gilt-600 dark:hover:text-gilt-400 transition-colors"
      >
        ✦ full causal trace
      </button>
    </div>
  );
}
