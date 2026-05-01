import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { chronicle } from '../api';

/**
 * Lexicon preview — Landing-page mini section that surfaces the conlang
 * differentiator on the front door. Picks three English terms whose forms
 * change across the most eras (i.e. the most drift-evident), renders them
 * as Era → Era → Era trails with arrows, and links to the full /glossary.
 *
 * Why this is here: the constructed-language depth is our strongest
 * differentiator vs AI Town / Hidden Door / Dungeon. Burying it under ⌘K
 * means judges won't see it. A 60-second skim of Landing must communicate
 * "this world has a real linguistic system, not vibes."
 */

type LexiconEra = {
  era_id: string;
  era_name: string;
  in_world_year: number;
  sample_lexicon: Record<string, string>;
};

type Trail = {
  english: string;
  forms: { era_name: string; word: string; in_world_year: number }[];
};

export default function LexiconPreview() {
  const [eras, setEras] = useState<LexiconEra[]>([]);

  useEffect(() => {
    chronicle
      .lexicon()
      .then((r) => setEras((r.items as LexiconEra[]) ?? []))
      .catch(() => setEras([]));
  }, []);

  const trails = useMemo<Trail[]>(() => {
    if (eras.length === 0) return [];
    // Sort eras chronologically so the trail reads left-to-right earliest → latest
    const sorted = [...eras].sort((a, b) => a.in_world_year - b.in_world_year);
    const byEnglish = new Map<string, Trail>();
    for (const era of sorted) {
      for (const [en, word] of Object.entries(era.sample_lexicon || {})) {
        const key = en.toLowerCase();
        const trail = byEnglish.get(key) ?? { english: en, forms: [] };
        // Skip if this era already contributed (defensive)
        if (!trail.forms.some((f) => f.era_name === era.era_name)) {
          trail.forms.push({ era_name: era.era_name, word, in_world_year: era.in_world_year });
        }
        byEnglish.set(key, trail);
      }
    }
    // Pick the three most-drifted — most distinct forms across eras.
    const candidates = Array.from(byEnglish.values()).filter((t) => t.forms.length >= 2);
    candidates.sort((a, b) => {
      const distinctA = new Set(a.forms.map((f) => f.word)).size;
      const distinctB = new Set(b.forms.map((f) => f.word)).size;
      if (distinctB !== distinctA) return distinctB - distinctA;
      return b.forms.length - a.forms.length;
    });
    return candidates.slice(0, 3).map((t) => ({
      ...t,
      forms: t.forms.slice(0, 3),
    }));
  }, [eras]);

  if (trails.length === 0) return null;

  return (
    <section className="pb-24">
      <div className="flex items-baseline justify-between mb-8 pb-3 border-b border-subtle">
        <div>
          <div className="eyebrow text-faint mb-1">lexicon · {eras.length} living tongues</div>
          <h2 className="font-display text-h2 text-heading tracking-[-0.02em]">
            The language drifts as the world ages.
          </h2>
        </div>
        <Link
          to="/glossary"
          className="font-mono text-eyebrow uppercase tracking-eyebrow text-dim hover:text-heading transition-colors shrink-0"
        >
          full glossary →
        </Link>
      </div>

      <dl className="space-y-5">
        {trails.map((t) => (
          <div
            key={t.english}
            className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-4 sm:gap-8 items-baseline pb-4 border-b border-subtle/60 last:border-b-0"
          >
            <dt className="font-display text-h3 text-heading tracking-[-0.012em]">{t.english}</dt>
            <dd className="flex items-baseline gap-x-5 gap-y-2 flex-wrap">
              {t.forms.map((f, i) => (
                <span key={`${f.era_name}-${i}`} className="flex items-baseline gap-3">
                  {i > 0 && (
                    <span aria-hidden className="font-mono text-body text-gilt-500/80">
                      →
                    </span>
                  )}
                  <span className="font-mono text-body-lg text-gilt-500 tabular-nums">
                    {f.word}
                  </span>
                  <span className="font-mono text-eyebrow uppercase tracking-eyebrow text-faint tabular-nums">
                    {f.era_name} · y{f.in_world_year}
                  </span>
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
