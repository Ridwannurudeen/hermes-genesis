import { Link } from 'react-router-dom';
import Masthead from '../components/Masthead';

/* Editorial 404. Personality matters more than utility here — the page is
 * proof that even the broken paths got design attention. Reads as a
 * canon-keeper's verdict. */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-page text-page">
      <Masthead />
      <main className="max-w-3xl mx-auto px-6 py-32">
        <div className="eyebrow text-gilt-500 mb-6">verdict 404</div>
        <h1 className="font-display text-display text-heading tracking-[-0.035em] leading-[1.02] mb-8">
          This article has not been <span className="italic text-gilt-500">canonized.</span>
        </h1>
        <div className="font-ui text-body-lg text-sub leading-relaxed space-y-4 max-w-2xl">
          <p>
            Either the canon-keeper rejected the seed for inconsistency with prior
            history, or the path you followed pointed at a page that was never written.
            The autonomous wiki only writes what it deems pivotal — much is left
            unrecorded by design.
          </p>
          <p>
            Try the chronicle. Or watch the canon being written, live, in the pressroom.
          </p>
        </div>
        <div className="mt-10 flex items-center gap-6 flex-wrap">
          <Link
            to="/chronicle"
            className="inline-flex items-center gap-2 px-5 h-11 rounded-md bg-gilt-500 hover:bg-gilt-400 text-night-950 font-ui font-semibold text-body transition-colors"
          >
            Read the canon
          </Link>
          <Link
            to="/control"
            className="font-mono text-eyebrow uppercase tracking-eyebrow text-dim hover:text-heading transition-colors"
          >
            control room →
          </Link>
          <Link
            to="/"
            className="font-mono text-eyebrow uppercase tracking-eyebrow text-faint hover:text-heading transition-colors"
          >
            home
          </Link>
        </div>
      </main>
    </div>
  );
}
