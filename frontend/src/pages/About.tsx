import { Link } from 'react-router-dom';
import Masthead from '../components/Masthead';

/* Editorial methodology page. The audit's P1-2 ("readers need to know what
 * the system is") delivered as long-form prose in the publication's voice.
 *
 * Reading register: serif body at 17px/1.7, drop cap on first paragraph,
 * hairline section rules. */
export default function About() {
  return (
    <div className="min-h-screen bg-page text-page">
      <Masthead />
      <main className="max-w-3xl mx-auto px-6 py-20">
        <div className="eyebrow text-gilt-500 mb-6">methodology</div>
        <h1 className="font-display text-h1 text-heading tracking-[-0.025em] leading-[1.08] mb-12">
          A civilization's encyclopedia, written by no one.
        </h1>

        <article className="editorial-prose">
          <p className="drop-cap">
            Chroniclon is not a chatbot wrapper. It is an autonomous publication
            system in which a multi-agent pipeline writes, critiques, cross-links,
            illustrates, and narrates the history of fictional civilizations. The
            human role is one sentence — a seed. Everything after is decided,
            written, and revised by language models cooperating across roles.
          </p>

          <p>
            This page exists because the system is unusual enough to warrant
            explanation. The short version: <em>Hermes-4-70B</em> is the canon
            agent. It reads each simulated event, decides whether the event is
            article-worthy, and chooses the kind, voice, title, and target length.{' '}
            <em>Kimi-K2.6</em> is the writer. It produces the long-form prose in
            the era's voice, with cross-links into the canon already published.
            Two further Hermes-4-70B critics score the article — anti-slop for
            stylistic redundancy, fact-check for canon consistency. If either
            scores below threshold, the article is revised and re-scored. A final
            Hermes pass proposes cross-links into related entries. Only then is
            the article sealed into the wiki.
          </p>

          <h2>The world keeps publishing</h2>

          <p>
            Once a world is generated, the runner advances simulated time
            indefinitely. Battles, betrayals, successions, prophecies — events
            accrue. The canon agent works through them on a poll, deciding
            roughly one in five is worth canonizing. The result is a
            self-extending wiki: open the chronicle weeks later and it has more
            articles, more eras, more linguistic drift, more entries citing
            entries. No prompt is required to keep it running.
          </p>

          <h2>Linguistic drift</h2>

          <p>
            At each era boundary, a linguist agent generates a structured
            phonological shift. Fricatives soften, place-name suffixes change,
            new morphology emerges. The lexicon drifts from the previous era's
            with deliberate continuity. The drift is then surfaced as in-world
            inscriptions with translations, a sample passage in the new tongue,
            and a parent → child sound-change tree visible in the{' '}
            <Link to="/chronicle" className="text-gilt-500 hover:text-gilt-600 dark:hover:text-gilt-400 underline underline-offset-4 decoration-gilt-500/40">
              chronicle's languages tab
            </Link>
            .
          </p>

          <h2>Provenance is load-bearing</h2>

          <p>
            Every published article carries a colophon — model used at each pipeline
            stage, anti-slop and fact-check scores, cross-link count, source event,
            era. The system makes no claim to truth; it asserts only what each
            agent saw and decided. Click <em>autopsy</em> on any article and the
            full causal chain unfolds: the simulation event that triggered the
            article, the events that caused that one, the consequences that
            followed. Articles aren't just generated — they're traceable.
          </p>

          <h2>Audience contributions</h2>

          <p>
            Anyone can submit an event seed via the contribute modal. The
            submission goes through Hermes moderation, gets synthesized into a
            structured event, and runs the same canonization pipeline. If it
            survives all critic passes, the resulting article is sealed with the
            contributor's handle in the byline. The{' '}
            <Link to="/contributors" className="text-gilt-500 hover:text-gilt-600 dark:hover:text-gilt-400 underline underline-offset-4 decoration-gilt-500/40">
              contributors page
            </Link>{' '}
            indexes everyone who has been canonized.
          </p>

          <h2>The point</h2>

          <p>
            Most AI-generated content fails by being a one-shot prompt response,
            visible as such, with no context and no continuity. Chroniclon is an
            attempt at the opposite: a system that writes <em>over time</em>,
            with a memory, a developing language, and an editor's standards. The
            output is meant to be readable on its own terms — not as evidence of
            a clever model, but as a wiki you can sit down with.
          </p>
        </article>

        {/* Colophon — what's running, what's verifiable */}
        <section className="mt-20 pt-10 border-t border-subtle">
          <div className="eyebrow text-faint mb-4">colophon</div>
          <dl className="grid grid-cols-[160px_1fr] gap-y-3 gap-x-6 font-mono text-micro tabular-nums">
            <dt className="text-faint">canon decision</dt>
            <dd className="text-heading">Hermes-4-70B (NousResearch inference API)</dd>
            <dt className="text-faint">long-form writer</dt>
            <dd className="text-heading">Kimi-K2.6 (Moonshot)</dd>
            <dt className="text-faint">anti-slop critic</dt>
            <dd className="text-heading">Hermes-4-70B</dd>
            <dt className="text-faint">fact-check critic</dt>
            <dd className="text-heading">Hermes-4-70B</dd>
            <dt className="text-faint">cross-link agent</dt>
            <dd className="text-heading">Hermes-4-70B</dd>
            <dt className="text-faint">illustrations</dt>
            <dd className="text-heading">FLUX (Together AI)</dd>
            <dt className="text-faint">narration</dt>
            <dd className="text-heading">ElevenLabs · OpenAI TTS</dd>
            <dt className="text-faint">simulation</dt>
            <dd className="text-heading">deterministic Python · ed25519 author keys</dd>
            <dt className="text-faint">storage</dt>
            <dd className="text-heading">file-backed JSON · per-world locks</dd>
            <dt className="text-faint">source</dt>
            <dd>
              <a
                href="https://github.com/Ridwannurudeen/hermes-genesis"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gilt-500 hover:text-gilt-600 dark:hover:text-gilt-400 underline underline-offset-4 decoration-gilt-500/40"
              >
                github.com/Ridwannurudeen/hermes-genesis
              </a>
            </dd>
          </dl>
        </section>
      </main>
    </div>
  );
}
