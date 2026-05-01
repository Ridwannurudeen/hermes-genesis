import { useState } from 'react';
import { chronicle } from '../api';

type Status = 'idle' | 'submitting' | 'subscribed' | 'already_subscribed' | 'error';

/**
 * Follow-the-canon subscribe form. Lives in editorial colophon strips
 * (Landing footer, Chronicle index footer). Single-line composition:
 * eyebrow + email input + button, with inline status replacing the form
 * once submitted. No double opt-in, no marketing pop-up.
 */
export default function SubscribeForm({ source }: { source?: string }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus('error');
      setErrorMsg('Enter a valid email.');
      return;
    }
    setStatus('submitting');
    setErrorMsg(null);
    try {
      const res = await chronicle.subscribe(trimmed, source);
      setStatus(res.status);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'subscribe failed');
    }
  };

  if (status === 'subscribed' || status === 'already_subscribed') {
    return (
      <div className="font-display text-body-lg text-heading">
        ✦{' '}
        {status === 'subscribed'
          ? 'You are on the masthead.'
          : 'You are already on the masthead.'}{' '}
        <span className="text-faint italic">
          New articles will land in your inbox as the canon publishes.
        </span>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <label
        htmlFor="follow-canon-email"
        className="eyebrow text-faint block"
      >
        follow the canon
      </label>
      <div className="flex items-stretch gap-2 max-w-md">
        <input
          id="follow-canon-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === 'error') setStatus('idle');
          }}
          className="flex-1 bg-surface border border-subtle rounded-md px-3 py-2 text-body text-input placeholder:text-faint/70 focus:outline-none focus:border-gilt-500 font-ui"
        />
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="px-4 rounded-md bg-gilt-500 hover:bg-gilt-400 text-night-950 text-body font-ui font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'submitting' ? 'subscribing…' : 'subscribe'}
        </button>
      </div>
      <div className="font-mono text-eyebrow uppercase tracking-eyebrow text-faint">
        {errorMsg ? (
          <span className="text-crimson-500">{errorMsg}</span>
        ) : (
          <>no spam · unsubscribe in any email · ~1 dispatch per era</>
        )}
      </div>
    </form>
  );
}
