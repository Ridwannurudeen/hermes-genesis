import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Masthead from '../components/Masthead';
import {
  Activity,
  BarChart3,
  KeyRound,
  LogOut,
  RefreshCw,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';
import { auth, type AuthStatus, type UsageEndpointRow, type UsageSnapshot } from '../api';

function fmt(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return 'never';
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function statCells(usage: UsageSnapshot | null) {
  return [
    { label: 'requests', value: fmt(usage?.total_requests), icon: Activity },
    { label: 'failures', value: fmt(usage?.total_failures), icon: ShieldX },
    { label: 'model units', value: fmt(usage?.estimated_model_units), icon: BarChart3 },
    { label: 'updated', value: formatDate(usage?.updated_at), icon: RefreshCw },
  ];
}

function EndpointTable({ usage }: { usage: UsageSnapshot | null }) {
  const rows = useMemo(() => {
    const entries = Object.entries(usage?.by_endpoint ?? {}) as [string, UsageEndpointRow][];
    return entries.sort((a, b) => b[1].requests - a[1].requests).slice(0, 12);
  }, [usage]);

  // Max requests for sparkline-style bar normalization.
  const max = rows[0]?.[1]?.requests ?? 0;

  if (!rows.length) {
    return (
      <div className="border border-subtle rounded px-4 py-10 text-center font-ui text-body text-dim italic">
        No usage events recorded yet.
      </div>
    );
  }

  return (
    <div className="border-y border-subtle">
      <div className="grid grid-cols-[minmax(0,1fr)_140px_80px_80px_100px_80px] eyebrow text-faint border-b border-subtle">
        <div className="px-3 py-2.5">endpoint</div>
        <div className="px-3 py-2.5">load</div>
        <div className="px-3 py-2.5 text-right">requests</div>
        <div className="px-3 py-2.5 text-right">failures</div>
        <div className="px-3 py-2.5 text-right">model units</div>
        <div className="px-3 py-2.5 text-right">avg ms</div>
      </div>
      <div className="divide-y divide-subtle">
        {rows.map(([endpoint, row]) => {
          const failureRate = row.requests > 0 ? row.failures / row.requests : 0;
          const tone = failureRate > 0.05 ? 'text-crimson-500' : 'text-heading';
          const widthPct = max > 0 ? Math.max(2, (row.requests / max) * 100) : 0;
          return (
            <div
              key={endpoint}
              className="grid grid-cols-[minmax(0,1fr)_140px_80px_80px_100px_80px] items-center font-ui text-body-sm hover:bg-hover transition-colors"
            >
              <div className="px-3 py-2.5 font-mono text-micro text-sub truncate">{endpoint}</div>
              {/* Inline sparkline-bar — proportion of total request volume */}
              <div className="px-3 py-2.5">
                <div className="h-1.5 bg-elevated rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-gilt-500/70"
                    style={{ width: `${widthPct}%` }}
                    aria-hidden
                  />
                </div>
              </div>
              <div className="px-3 py-2.5 text-right font-mono tabular-nums text-heading">
                {fmt(row.requests)}
              </div>
              <div className={`px-3 py-2.5 text-right font-mono tabular-nums ${tone}`}>
                {fmt(row.failures)}
              </div>
              <div className="px-3 py-2.5 text-right font-mono tabular-nums text-sub">
                {fmt(row.estimated_model_units)}
              </div>
              <div className="px-3 py-2.5 text-right font-mono tabular-nums text-dim">
                {Math.round(row.avg_ms)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Admin() {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const nextStatus = await auth.status();
    setStatus(nextStatus);
    if (nextStatus.admin) {
      setUsage(await auth.usage());
    } else {
      setUsage(null);
    }
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  async function login(ev: FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await auth.login(apiKey);
      setApiKey('');
      await load();
    } catch (err) {
      setError('Admin key rejected.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    setError(null);
    try {
      await auth.logout();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const cells = statCells(usage);
  const admin = status?.admin === true;

  return (
    <main className="min-h-screen bg-page text-page">
      <Masthead />
      <div className="border-b border-subtle">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-baseline gap-5">
          <span className="eyebrow text-faint">internal</span>
          <h1 className="font-display text-h3 text-heading tracking-[-0.015em]">
            Admin
          </h1>
          <span className="eyebrow text-faint hidden sm:inline">
            {status?.auth_required ? (admin ? '· session active' : '· locked') : '· auth disabled'}
          </span>
          {admin && (
            <button
              type="button"
              onClick={logout}
              disabled={busy}
              className="ml-auto inline-flex items-center gap-2 font-mono text-eyebrow uppercase tracking-eyebrow text-dim hover:text-heading disabled:opacity-50 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              logout
            </button>
          )}
        </div>
      </div>

      <section className="max-w-7xl mx-auto px-6 py-10 space-y-10">
        {!admin ? (
          <form onSubmit={login} className="max-w-xl border border-subtle rounded p-6 bg-surface">
            <label className="eyebrow text-faint mb-2 block" htmlFor="admin-key">
              genesis api key
            </label>
            <div className="flex gap-2">
              <input
                id="admin-key"
                type="password"
                value={apiKey}
                onChange={(ev) => setApiKey(ev.target.value)}
                className="flex-1 bg-page border border-subtle rounded-md px-3 py-2 font-mono text-body-sm text-input outline-none focus:border-gilt-500"
                autoComplete="current-password"
              />
              <button
                type="submit"
                disabled={busy || !apiKey}
                className="inline-flex items-center gap-2 px-4 h-10 rounded-md bg-gilt-500 hover:bg-gilt-400 text-night-950 font-ui font-semibold text-body disabled:opacity-50 transition-colors"
              >
                <KeyRound className="w-4 h-4" />
                Login
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-subtle border border-subtle rounded overflow-hidden">
              {cells.map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-page px-4 py-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-mono text-h2 text-heading tabular-nums">{value}</div>
                      <div className="eyebrow text-faint mt-1">{label}</div>
                    </div>
                    <Icon className="w-5 h-5 text-gilt-500/80" />
                  </div>
                </div>
              ))}
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="font-display text-h2 text-heading tracking-[-0.02em]">Usage</h2>
                <button
                  type="button"
                  onClick={() => load().catch((err) => setError(err instanceof Error ? err.message : String(err)))}
                  className="inline-flex items-center gap-2 font-mono text-eyebrow uppercase tracking-eyebrow text-dim hover:text-heading transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  refresh
                </button>
              </div>
              <EndpointTable usage={usage} />
            </div>
          </>
        )}

        {error ? (
          <div className="border border-crimson-500/30 bg-crimson-500/10 text-crimson-500 rounded px-4 py-3 font-ui text-body">
            {error}
          </div>
        ) : null}
      </section>
    </main>
  );
}
