import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Masthead from '../components/Masthead';
import { fetchJson } from '../api';

type ContributorRow = { handle: string; canonized_count: number };
type ContributorsResp = { items: ContributorRow[]; total: number };

export default function Contributors() {
  const [data, setData] = useState<ContributorsResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<ContributorsResp>('/api/chronicle/contributors')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div className="min-h-screen bg-page text-page">
      <Masthead />
      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="eyebrow text-gilt-500 mb-4">audience</div>
        <h1 className="font-display text-h1 text-heading tracking-[-0.025em] leading-[1.08] mb-3">
          Contributors to the canon.
        </h1>
        <p className="font-ui text-body-lg text-sub leading-relaxed max-w-2xl mb-12">
          Anyone can submit an event seed. If Hermes accepts it and Kimi's draft
          survives both critic passes, the resulting article is sealed into the
          wiki with a byline. These are the handles whose contributions made it
          through.
        </p>

        {error && (
          <div className="border border-crimson-500/30 bg-crimson-500/10 text-crimson-500 rounded px-4 py-3 font-ui text-body">
            {error}
          </div>
        )}

        {!error && !data && (
          <div className="font-ui text-body text-dim italic">unfurling the seal…</div>
        )}

        {data && data.items.length === 0 && (
          <div className="border border-subtle rounded p-10 text-center">
            <div className="eyebrow text-faint mb-2">no canonized contributions yet</div>
            <p className="font-ui text-body text-sub">
              The canon is currently autonomous. Submit a seed via the{' '}
              <Link
                to="/chronicle"
                className="text-gilt-500 hover:text-gilt-600 dark:hover:text-gilt-400 underline underline-offset-4 decoration-gilt-500/40"
              >
                chronicle's contribute panel
              </Link>{' '}
              to see your handle here.
            </p>
          </div>
        )}

        {data && data.items.length > 0 && (
          <div className="border-y border-subtle divide-y divide-subtle">
            {data.items.map((row, i) => (
              <div
                key={row.handle}
                className="grid grid-cols-[40px_1fr_auto] gap-4 items-baseline px-1 py-4"
              >
                <span className="font-mono text-micro text-faint tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span
                  className={`font-mono text-body ${
 i === 0 ? 'text-gilt-500' : 'text-heading'
 }`}
                >
                  @{row.handle}
                </span>
                <span className="font-mono text-micro text-dim tabular-nums">
                  {row.canonized_count} canonized
                </span>
              </div>
            ))}
          </div>
        )}

        {data && data.items.length > 0 && (
          <div className="mt-10 font-mono text-micro text-faint tabular-nums">
            {data.total} contributor{data.total === 1 ? '' : 's'} total
          </div>
        )}

        <div className="mt-16 pt-8 border-t border-subtle">
          <Link
            to="/chronicle"
            className="font-mono text-eyebrow uppercase tracking-eyebrow text-gilt-500 hover:text-gilt-600 dark:hover:text-gilt-400 transition-colors"
          >
            ← back to the chronicle
          </Link>
        </div>
      </main>
    </div>
  );
}
