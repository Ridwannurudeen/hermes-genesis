import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { chronicle } from '../api';

type Props = {
  open: boolean;
  onClose: () => void;
};

type ContributeResult = {
  status: 'canonized' | 'rejected' | 'approved_but_skipped' | string;
  reason?: string;
  article?: { slug: string; title: string; kind: string; voice: string; word_count: number };
  contributor?: string;
};

const STORAGE_HANDLE = 'chroniclon.contributor_handle';

export default function ContributeModal({ open, onClose }: Props) {
  const nav = useNavigate();
  const [handle, setHandle] = useState('');
  const [seed, setSeed] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ContributeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setHandle(localStorage.getItem(STORAGE_HANDLE) || '');
      setSeed('');
      setResult(null);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    setError(null);
    const s = seed.trim();
    if (!s) {
      setError('Write something for the canon to consider.');
      return;
    }
    if (s.length > 600) {
      setError('Keep it under 600 characters — the canon prefers brevity.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await chronicle.submit(handle.trim() || 'anonymous', s);
      localStorage.setItem(STORAGE_HANDLE, handle.trim());
      setResult({
        status: res.status,
        reason: res.reason,
        article: res.article,
        contributor: res.contributor,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const remaining = 600 - seed.length;
  const overLimit = remaining < 0;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-surface border border-subtle rounded-lg shadow-2xl"
      >
        <div className="px-6 py-4 border-b border-subtle flex items-baseline justify-between">
          <div>
            <div className="font-serif text-xl text-heading">Contribute to the canon</div>
            <div className="text-xs text-faint mt-0.5">
              Write an event. The canon agent decides if it joins history.
            </div>
          </div>
          <button onClick={onClose} className="text-faint hover:text-heading text-sm">
            close
          </button>
        </div>

        {result ? (
          <div className="px-6 py-8 text-center">
            {result.status === 'canonized' && result.article ? (
              <>
                <div className="text-moss-500 font-serif text-xl">
                  ✦ canonized
                </div>
                <div className="text-sub mt-2">
                  Hermes accepted, Kimi wrote{' '}
                  <span className="font-serif italic">"{result.article.title}"</span>
                </div>
                <div className="text-faint text-sm mt-1">
                  {result.article.word_count.toLocaleString()} words · {result.article.voice}{' '}
                  · credited to{' '}
                  <span className="text-moss-500">@{result.contributor || handle.trim() || 'anonymous'}</span>
                </div>
                <div className="flex items-center justify-center gap-3 mt-6">
                  <button
                    onClick={() => {
                      onClose();
                      if (result.article) nav(`/chronicle/${result.article.slug}`);
                    }}
                    className="px-4 py-2 rounded bg-gilt-500 hover:bg-gilt-400 text-night-950 text-sm"
                  >
                    read it →
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded bg-elevated hover:bg-elevated text-sub text-sm"
                  >
                    done
                  </button>
                </div>
              </>
            ) : result.status === 'rejected' ? (
              <>
                <div className="text-crimson-500 font-serif text-xl">declined by the canon</div>
                <div className="text-dim text-sm mt-3 italic">
                  {result.reason || 'The canon-keeper found this seed inconsistent with the world.'}
                </div>
                <button
                  onClick={() => setResult(null)}
                  className="mt-6 px-4 py-2 rounded bg-elevated hover:bg-elevated text-heading text-sm"
                >
                  try again
                </button>
              </>
            ) : (
              <>
                <div className="text-gilt-500 font-serif text-xl">approved but unwritten</div>
                <div className="text-dim text-sm mt-3">
                  {result.reason ||
                    'Hermes accepted the seed but declined to canonize it as an article right now.'}
                </div>
                <button
                  onClick={onClose}
                  className="mt-6 px-4 py-2 rounded bg-elevated hover:bg-elevated text-heading text-sm"
                >
                  done
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-faint">Your handle</label>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32))}
                placeholder="optional — leave blank for anonymous"
                className="mt-1 w-full bg-page border border-subtle rounded px-3 py-2 text-sm text-heading placeholder:text-faint/70 focus:outline-none focus:border-gilt-500"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-faint">Event seed</label>
              <textarea
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                rows={5}
                placeholder='e.g. "A meteor lands in the eastern desert and the lunar correspondence ceases for forty days."'
                className="mt-1 w-full bg-page border border-subtle rounded px-3 py-2 text-sm text-heading placeholder:text-faint/70 focus:outline-none focus:border-gilt-500 resize-none font-serif leading-relaxed"
              />
              <div className={`text-[11px] mt-1 ${overLimit ? 'text-crimson-500' : 'text-faint/70'}`}>
                {remaining} characters remaining
              </div>
            </div>
            {error && <div className="text-crimson-500 text-sm">{error}</div>}
            <div className="flex items-center justify-between pt-2">
              <div className="text-[11px] text-faint/70">
                The canon agent rejects slop, contradictions, and out-of-world content.
              </div>
              <button
                onClick={submit}
                disabled={submitting || overLimit}
                className="px-4 py-2 rounded bg-gilt-500 hover:bg-gilt-400 text-night-950 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'submitting…' : 'submit to canon'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
