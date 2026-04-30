import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import CommandPalette from './CommandPalette';
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
  { to: '/glossary',  label: 'glossary' },
  { to: '/control',   label: 'control' },
  { to: '/judge',     label: 'judge' },
  { to: '/demo',      label: 'demo' },
];

export default function Masthead() {
  const { pathname } = useLocation();
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    auth.status().then(setAuthStatus).catch(() => setAuthStatus(null));
  }, []);

  // Close the mobile nav when route changes.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Global ⌘K / Ctrl+K shortcut. `/` also opens unless the user is already
  // typing in an input/textarea — matches NYT and most editorial sites.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((p) => !p);
      } else if (e.key === '/' && !inField) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
    <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    <header className="sticky top-0 z-30 backdrop-blur-md bg-paper-50/85 dark:bg-night-950/85 border-b border-subtle">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4 sm:gap-8">
        {/* Wordmark */}
        <Link to="/" className="flex items-baseline gap-3 group" aria-label="Chroniclon home">
          <span className="font-display text-h3 font-semibold text-heading tracking-[-0.02em] leading-none">
            Chroniclon
          </span>
          <span className="hidden md:inline eyebrow text-faint group-hover:text-dim transition-colors">
            built on Hermes Genesis
          </span>
        </Link>

        {/* Nav — hidden below md; mobile uses hamburger drawer below. */}
        <nav className="hidden md:flex flex-1 items-center gap-5 lg:gap-6">
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

        {/* Right rail — search, admin link if session, theme, github */}
        <div className="ml-auto md:ml-0 flex items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Search the canon"
            className="hidden lg:flex items-center gap-2 px-2.5 h-7 rounded border border-subtle bg-surface/60 hover:bg-surface text-faint hover:text-sub font-mono text-eyebrow uppercase tracking-eyebrow transition-colors"
          >
            <span>search</span>
            <kbd className="font-mono text-[10px] tracking-normal text-faint border border-subtle rounded px-1 py-0">⌘K</kbd>
          </button>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Search"
            className="lg:hidden text-faint hover:text-sub font-mono text-eyebrow uppercase tracking-eyebrow"
          >
            search
          </button>
          {authStatus?.admin && (
            <Link
              to="/admin"
              className="hidden sm:inline font-mono text-eyebrow uppercase tracking-eyebrow text-gilt-500 hover:text-gilt-600 dark:hover:text-gilt-400 transition-colors"
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
            className="hidden sm:inline text-faint hover:text-sub transition-colors text-eyebrow font-mono uppercase tracking-eyebrow"
          >
            github
          </a>
          {/* Mobile menu toggle — three hairlines, editorial not SaaS. */}
          <button
            type="button"
            onClick={() => setMobileNavOpen((o) => !o)}
            aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileNavOpen}
            className="md:hidden flex flex-col justify-center gap-[3px] w-7 h-7 -mr-1 text-faint hover:text-sub"
          >
            <span aria-hidden className={`block h-px w-5 bg-current transition-transform ${mobileNavOpen ? 'translate-y-[4px] rotate-45' : ''}`} />
            <span aria-hidden className={`block h-px w-5 bg-current transition-opacity ${mobileNavOpen ? 'opacity-0' : ''}`} />
            <span aria-hidden className={`block h-px w-5 bg-current transition-transform ${mobileNavOpen ? '-translate-y-[4px] -rotate-45' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile drawer — slides down beneath the masthead, paper bg. */}
      {mobileNavOpen && (
        <div className="md:hidden border-t border-subtle bg-paper-50/95 dark:bg-night-950/95 backdrop-blur">
          <nav className="max-w-6xl mx-auto px-4 py-3 flex flex-col">
            {NAV.map((item) => {
              const active =
                item.to === '/chronicle'
                  ? pathname.startsWith('/chronicle')
                  : pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`py-3 border-b border-subtle/60 last:border-b-0 font-mono text-eyebrow uppercase tracking-eyebrow ${
                    active ? 'text-heading' : 'text-faint'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            {authStatus?.admin && (
              <Link
                to="/admin"
                className="py-3 border-t border-subtle font-mono text-eyebrow uppercase tracking-eyebrow text-gilt-500"
              >
                admin
              </Link>
            )}
            <a
              href="https://github.com/Ridwannurudeen/hermes-genesis"
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 border-t border-subtle font-mono text-eyebrow uppercase tracking-eyebrow text-faint"
            >
              github
            </a>
          </nav>
        </div>
      )}
    </header>
    </>
  );
}
