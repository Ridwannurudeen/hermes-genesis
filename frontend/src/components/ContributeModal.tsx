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
        className="w-full max-w-xl bg-slate-900 border border-slate-700/60 rounded-lg shadow-2xl"
      >
        <div className="px-6 py-4 border-b border-slate-800 flex items-baseline justify-between">
          <div>
            <div className="font-serif text-xl text-slate-100">Contribute to the canon</div>
            <div className="text-xs text-slate-500 mt-0.5">
              Write an event. The canon agent decides if it joins history.
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-sm">
            close
          </button>
        </div>

        {result ? (
          <div className="px-6 py-8 text-center">
            {result.status === 'canonized' && result.article ? (
              <>
                <div className="text-emerald-300 font-serif text-xl">
                  ✦ canonized
                </div>
                <div className="text-slate-300 mt-2">
                  Hermes accepted, Kimi wrote{' '}
                  <span className="font-serif italic">"{result.article.title}"</span>
                </div>
                <div className="text-slate-500 text-sm mt-1">
                  {result.article.word_count.toLocaleString()} words · {result.article.voice}{' '}
                  · credited to{' '}
                  <span className="text-emerald-300">@{result.contributor || handle.trim() || 'anonymous'}</span>
                </div>
                <div className="flex items-center justify-center gap-3 mt-6">
                  <button
                    onClick={() => {
                      onClose();
                      if (result.article) nav(`/chronicle/${result.article.slug}`);
                    }}
                    className="px-4 py-2 rounded bg-amber-700/80 hover:bg-amber-600 text-slate-100 text-sm"
                  >
                    read it →
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm"
                  >
                    done
                  </button>
                </div>
              </>
            ) : result.status === 'rejected' ? (
              <>
                <div className="text-rose-300 font-serif text-xl">declined by the canon</div>
                <div className="text-slate-400 text-sm mt-3 italic">
                  {result.reason || 'The canon-keeper found this seed inconsistent with the world.'}
                </div>
                <button
                  onClick={() => setResult(null)}
                  className="mt-6 px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm"
                >
                  try again
                </button>
              </>
            ) : (
              <>
                <div className="text-amber-300 font-serif text-xl">approved but unwritten</div>
                <div className="text-slate-400 text-sm mt-3">
                  {result.reason ||
                    'Hermes accepted the seed but declined to canonize it as an article right now.'}
                </div>
                <button
                  onClick={onClose}
                  className="mt-6 px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm"
                >
                  done
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-slate-500">Your handle</label>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32))}
                placeholder="optional — leave blank for anonymous"
                className="mt-1 w-full bg-slate-950 border border-slate-700/60 rounded px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-600/50"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-slate-500">Event seed</label>
              <textarea
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                rows={5}
                placeholder='e.g. "A meteor lands in the eastern desert and the lunar correspondence ceases for forty days."'
                className="mt-1 w-full bg-slate-950 border border-slate-700/60 rounded px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-600/50 resize-none font-serif leading-relaxed"
              />
              <div className={`text-[11px] mt-1 ${overLimit ? 'text-rose-400' : 'text-slate-600'}`}>
                {remaining} characters remaining
              </div>
            </div>
            {error && <div className="text-rose-400 text-sm">{error}</div>}
            <div className="flex items-center justify-between pt-2">
              <div className="text-[11px] text-slate-600">
                The canon agent rejects slop, contradictions, and out-of-world content.
              </div>
              <button
                onClick={submit}
                disabled={submitting || overLimit}
                className="px-4 py-2 rounded bg-amber-700/80 hover:bg-amber-600 text-slate-100 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
