import { useEffect, useMemo, useState } from 'react';
import Masthead from '../components/Masthead';
import { chronicle } from '../api';

type LinguisticEra = {
  era_id: string;
  era_name: string;
  in_world_year: number;
  phonology_notes: string;
  sample_lexicon: Record<string, string>;
  sample_text: string;
  inscriptions?: { in_world_text: string; translation: string; context: string }[];
};

type GlossaryEntry = {
  english: string;
  forms: { era_id: string; era_name: string; in_world_year: number; word: string }[];
};

export default function Glossary() {
  const [eras, setEras] = useState<LinguisticEra[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    chronicle
      .lexicon()
      .then((r) => setEras(r.items as LinguisticEra[]))
      .catch((e) => setError(e instanceof Error ? e.message : 'failed to load'));
  }, []);

  // Merge per-era sample_lexicon dicts into a global glossary keyed by English
  // term. Each English word can have multiple constructed forms across eras —
  // surface them all so the reader sees how the language drifted.
  const entries = useMemo<GlossaryEntry[]>(() => {
    const byEnglish = new Map<string, GlossaryEntry>();
    for (const era of eras) {
      for (const [en, word] of Object.entries(era.sample_lexicon || {})) {
        const key = en.toLowerCase();
        const existing = byEnglish.get(key);
        const form = {
          era_id: era.era_id,
          era_name: era.era_name,
          in_world_year: era.in_world_year,
          word,
        };
        if (existing) {
          // Avoid dupes — same era + same word.
          if (!existing.forms.some((f) => f.era_id === era.era_id && f.word === word)) {
            existing.forms.push(form);
          }
        } else {
          byEnglish.set(key, { english: en, forms: [form] });
        }
      }
    }
    const list = Array.from(byEnglish.values());
    list.sort((a, b) => a.english.localeCompare(b.english));
    for (const e of list) e.forms.sort((a, b) => a.in_world_year - b.in_world_year);
    return list;
  }, [eras]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.english.toLowerCase().includes(q) ||
        e.forms.some((f) => f.word.toLowerCase().includes(q)),
    );
  }, [entries, search]);

  const grouped = useMemo(() => {
    const out = new Map<string, GlossaryEntry[]>();
    for (const e of filtered) {
      const letter = (e.english[0] || '#').toUpperCase();
      const bucket = /[A-Z]/.test(letter) ? letter : '#';
      const arr = out.get(bucket) ?? [];
      arr.push(e);
      out.set(bucket, arr);
    }
    return Array.from(out.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div className="min-h-screen bg-page text-page">
      <Masthead />
      <div className="border-b border-subtle">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <span className="eyebrow text-faint">reference</span>
          <h1 className="font-display text-h1 text-heading tracking-[-0.025em] mt-2">
            Glossary
          </h1>
          <p className="font-display text-body-lg text-sub mt-3 max-w-2xl">
            Every English term that has been canonized into the constructed tongues of the canon, sorted alphabetically. Each entry traces the word's drift across linguistic eras.
          </p>
          <div className="mt-5 flex items-center gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="search glossary…"
              className="bg-surface border border-subtle rounded-md px-3 py-1.5 text-body text-input placeholder:text-faint focus:outline-none focus:border-gilt-500 w-72 font-ui"
            />
            <span className="font-mono text-eyebrow uppercase tracking-eyebrow text-faint tabular-nums">
              {filtered.length} terms · {eras.length} eras
            </span>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {error ? (
          <div className="text-crimson-500 text-body-sm">{error}</div>
        ) : entries.length === 0 ? (
          <div className="text-faint italic font-display text-body-lg">
            The lexicon hasn't been canonized yet. Run a regen to seed the first linguistic era.
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-faint italic font-display text-body-lg">
            No glossary entries match "{search}".
          </div>
        ) : (
          <div className="space-y-12">
            {grouped.map(([letter, items]) => (
              <section key={letter}>
                <div className="flex items-baseline gap-4 mb-4 pb-2 border-b border-subtle">
                  <h2 className="font-display text-h2 text-heading">{letter}</h2>
                  <span className="font-mono text-eyebrow uppercase tracking-eyebrow text-faint tabular-nums">
                    {items.length} {items.length === 1 ? 'term' : 'terms'}
                  </span>
                </div>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5">
                  {items.map((e) => (
                    <div key={e.english} className="flex items-baseline gap-4">
                      <dt className="font-display text-h4 text-heading shrink-0 min-w-[6rem]">
                        {e.english}
                      </dt>
                      <dd className="flex-1">
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {e.forms.map((f, i) => (
                            <span
                              key={`${f.era_id}-${i}`}
                              className="font-mono text-body-sm tabular-nums"
                            >
                              <span className="text-gilt-500">{f.word}</span>
                              <span className="text-faint ml-2">
                                · {f.era_name} · y{f.in_world_year}
                              </span>
                            </span>
                          ))}
                        </div>
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
