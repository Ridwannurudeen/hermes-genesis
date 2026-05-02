import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Masthead from '../components/Masthead';
import { api } from '../api';
import type { WorldSummary } from '../types';

/**
 * /watch — entry point to the cinematic playback surface.
 *
 * Shows every public world as a card. Click → /world/{id}?cinematic=1
 * which opens CinematicMode against that world. Previously this route
 * auto-redirected to the longest-running world (Lunar Epistles), which
 * hid the other public worlds and made the cinematic load happen on the
 * masthead transition (1611 days of events to fetch). Now the picker
 * lands instantly and the heavy cinematic load is gated behind a click.
 */
export default function Watch() {
  const [worlds, setWorlds] = useState<WorldSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .listWorlds()
      .then((items) => {
        if (cancelled) return;
        // Sort by current_day desc — most-active world up top by default.
        items.sort((a, b) => (b.current_day ?? 0) - (a.current_day ?? 0));
        setWorlds(items);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-page text-page">
      <Masthead />

      <div className="border-b border-subtle">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-baseline gap-5">
          <span className="eyebrow text-faint">cinematic mode</span>
          <h1 className="font-display text-h3 text-heading tracking-[-0.015em]">Watch</h1>
          <span className="eyebrow text-faint hidden md:inline">
            full-screen mood-themed playback against any public world
          </span>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h2 className="font-display text-display text-heading tracking-[-0.025em] leading-[1.05] max-w-3xl">
            Pick a world. Watch it <span className="italic text-gilt-500">tell its own history.</span>
          </h2>
          <p className="font-ui text-body text-sub mt-4 max-w-2xl">
            Each public world plays back as a cinematic stream — events surface in their own
            mood theme, character voices narrate, era transitions ripple through. Pick one to
            open it.
          </p>
        </div>

        {error && (
          <div className="border border-crimson-500/40 bg-crimson-500/10 rounded-md p-4 mb-6">
            <div className="eyebrow text-crimson-400 mb-2">couldn't load worlds</div>
            <div className="font-mono text-micro text-sub">{error}</div>
          </div>
        )}

        {worlds === null && !error ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="border border-subtle rounded-md bg-elevated/40 p-6 min-h-[260px]"
              >
                <div className="skeleton h-3 w-24 mb-4" />
                <div className="skeleton h-7 w-3/4 mb-3" />
                <div className="skeleton h-4 w-full mb-2" />
                <div className="skeleton h-4 w-5/6" />
              </div>
            ))}
          </div>
        ) : worlds && worlds.length === 0 ? (
          <div className="border border-subtle rounded-md p-10 text-center">
            <div className="eyebrow text-faint mb-3">no public worlds yet</div>
            <div className="font-display text-h3 text-heading mb-4">
              Start one in <Link to="/regen" className="text-gilt-500 underline underline-offset-4">/regen</Link>.
            </div>
            <p className="font-ui text-body text-sub max-w-md mx-auto">
              Type one sentence into /regen, watch the canon spawn the world, then come back here
              to play it back.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {worlds!.map((w) => (
              <Link
                key={w.id}
                to={`/world/${w.id}?cinematic=1`}
                className="border border-subtle hover:border-gilt-500/60 rounded-md bg-elevated/40 hover:bg-elevated p-6 min-h-[260px] flex flex-col group transition-colors"
              >
                <div className="eyebrow text-faint mb-4 flex items-center gap-3 flex-wrap">
                  <span>world</span>
                  <span className="text-faint/60">·</span>
                  <span>{w.theme || 'autonomous'}</span>
                  <span className="text-faint/60">·</span>
                  <span className="font-mono tabular-nums normal-case tracking-normal">
                    day {w.current_day.toLocaleString()}
                  </span>
                </div>
                <div className="font-display text-h2 text-heading group-hover:text-gilt-500 transition-colors leading-[1.1] tracking-[-0.022em] mb-3">
                  {w.name}
                </div>
                <div className="font-ui text-body-sm text-sub italic line-clamp-3 mb-6">
                  {w.seed || '—'}
                </div>
                <div className="mt-auto flex items-center justify-between">
                  <span
                    className={`font-mono text-eyebrow uppercase tracking-eyebrow px-1.5 py-0.5 rounded border ${
                      w.status === 'live'
                        ? 'border-moss-500/60 text-moss-500 bg-moss-500/10'
                        : 'border-subtle text-faint'
                    }`}
                  >
                    {w.status || 'public'}
                  </span>
                  <span className="font-mono text-eyebrow uppercase tracking-eyebrow text-gilt-500 group-hover:text-gilt-600 dark:group-hover:text-gilt-400">
                    open cinematic →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
