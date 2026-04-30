import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { auth, type AuthStatus } from '../api';

/* Editorial publication masthead — used on every route.
 *
 * Pattern: display-serif wordmark + hairline rule + small-caps mono nav.
 * Replaces the previous Sparkles/Wifi/GitHub strip.
 *
 * Visibility rule: admin link only renders when the user has an admin
 * session cookie (session-based, not the SPA deploy token).
 */

const NAV: Array<{ to: string; label: string }> = [
  { to: '/chronicle', label: 'chronicle' },
  { to: '/control',   label: 'control' },
  { to: '/judge',     label: 'judge' },
  { to: '/demo',      label: 'demo' },
];

export default function Masthead() {
  const { pathname } = useLocation();
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);

  useEffect(() => {
    auth.status().then(setAuthStatus).catch(() => setAuthStatus(null));
  }, []);

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-paper-50/85 dark:bg-night-950/85 border-b border-subtle">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-8">
        {/* Wordmark */}
        <Link to="/" className="flex items-baseline gap-3 group" aria-label="Chroniclon home">
          <span className="font-display text-h3 font-semibold text-heading tracking-[-0.02em] leading-none">
            Chroniclon
          </span>
          <span className="hidden sm:inline eyebrow text-faint group-hover:text-dim transition-colors">
            built on Hermes Genesis
          </span>
        </Link>

        {/* Nav — small-caps mono, low contrast, gilt underline on active */}
        <nav className="flex-1 flex items-center gap-6">
          {NAV.map((item) => {
            const active =
              item.to === '/chronicle'
                ? pathname.startsWith('/chronicle')
                : pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`font-mono text-eyebrow uppercase tracking-eyebrow transition-colors relative
                  ${active ? 'text-heading' : 'text-faint hover:text-sub'}`}
              >
                {item.label}
                {active && (
                  <span
                    aria-hidden
                    className="absolute -bottom-[15px] left-0 right-0 h-[1.5px] bg-gilt-500"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right rail — admin link if session, theme, github */}
        <div className="flex items-center gap-4">
          {authStatus?.admin && (
            <Link
              to="/admin"
              className="font-mono text-eyebrow uppercase tracking-eyebrow text-gilt-500 hover:text-gilt-400 transition-colors"
            >
              admin
            </Link>
          )}
          <ThemeToggle />
          <a
            href="https://github.com/Ridwannurudeen/hermes-genesis"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Source on GitHub"
            className="text-faint hover:text-sub transition-colors text-eyebrow font-mono uppercase tracking-eyebrow"
          >
            github
          </a>
        </div>
      </div>
    </header>
  );
}
