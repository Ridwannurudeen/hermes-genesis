import { useEffect, useState } from 'react';
import { authHeaders } from '../api';

type CeremonyData = {
  closing: {
    era_id: string | null;
    name: string | null;
    summary: string;
    dominant_factions: string[];
    art_style: string;
  } | null;
  new: {
    era_id: string;
    name: string;
    premise: string;
    art_style: string;
    dominant_factions: string[];
    start_year: number;
  };
  language: {
    phonology_notes: string;
    phonological_rules: { from_sound: string; to_sound: string; context: string }[];
    morphology: {
      plural_marker?: string;
      honorific_prefix?: string;
      place_name_suffix?: string;
      diminutive?: string;
      notes?: string;
    };
    lex_delta: { en: string; old: string; new: string }[];
    sample_text: string;
    inscriptions: { in_world_text: string; translation: string; context: string }[];
  };
};

type Props = {
  eraId: string | null;
  onClose: () => void;
};

/** Style-keyword → CSS gradient. Cheap deterministic banner art so we don't
 *  burn an image-API call at every era transition. */
function bannerGradient(artStyle: string): string {
  const s = artStyle.toLowerCase();
  // Editorial palette only — single-accent moods using night/ink/gilt/crimson/moss.
  // Each mood is a 3-stop gradient on the editorial scale; all "warm" defaults
  // anchor on night-950 with gilt or moss midtones.
  if (/charcoal|smoke|ash|cinder|sepia/.test(s)) return 'from-night-950 via-gilt-600/30 to-night-950';
  if (/parchment|ink|vellum|manuscript/.test(s)) return 'from-night-900 via-gilt-500/25 to-night-900';
  if (/woodcut|engraving/.test(s)) return 'from-night-950 via-ink-700/40 to-night-950';
  if (/celestial|astral|moon|star|night/.test(s)) return 'from-night-950 via-vellum-400/15 to-night-950';
  if (/blood|crimson|war/.test(s)) return 'from-night-950 via-crimson-500/25 to-night-950';
  if (/verdant|forest|leaf|moss/.test(s)) return 'from-night-950 via-moss-500/25 to-night-950';
  if (/salt|sea|ocean|wave/.test(s)) return 'from-night-950 via-vellum-300/15 to-night-950';
  return 'from-night-950 via-gilt-500/20 to-night-950';
}

export default function EraCeremony({ eraId, onClose }: Props) {
  const [data, setData] = useState<CeremonyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'closing' | 'reveal'>('closing');

  useEffect(() => {
    if (!eraId) return;
    setData(null);
    setError(null);
    setPhase('closing');
    fetch(`/api/chronicle/era-transition/${eraId}`, {
      headers: authHeaders('GET'),
      credentials: 'same-origin',
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: CeremonyData) => setData(j))
      .catch((e) => setError(e.message ?? 'failed to load'));
  }, [eraId]);

  // After 1.4s of "closing" phase, fade into "reveal" so judges see two beats:
  // (1) the era ending, (2) the new era unfurling.
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(() => setPhase('reveal'), 1400);
    return () => clearTimeout(t);
  }, [data]);

  if (!eraId) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-faint hover:text-heading text-sm"
          aria-label="Close ceremony"
        >
          esc · close
        </button>

        {error && (
          <div className="text-crimson-500 text-sm border border-crimson-500/30 bg-crimson-500/10 rounded-md p-4">
            {error}
          </div>
        )}

        {!error && !data && (
          <div className="text-dim text-center font-serif italic animate-pulse">
            unfurling the seal…
          </div>
        )}

        {data && phase === 'closing' && data.closing && (
          <div className="text-center animate-[fadeIn_700ms_ease-out]">
            <div className="text-[11px] uppercase tracking-[0.4em] text-faint mb-3">
              an era closes
            </div>
            <div className="font-serif text-4xl text-heading mb-4">{data.closing.name}</div>
            {data.closing.summary && (
              <div className="text-dim italic max-w-xl mx-auto leading-relaxed">
                {data.closing.summary}
              </div>
            )}
          </div>
        )}

        {data && phase === 'reveal' && (
          <div className="space-y-6 animate-[fadeIn_900ms_ease-out]">
            {/* Banner */}
            <div
              className={`relative overflow-hidden rounded-xl border border-gilt-500/40 px-8 py-12 bg-gradient-to-br ${bannerGradient(
                data.new.art_style,
              )}`}
            >
              <div className="absolute inset-0 opacity-20" aria-hidden>
                <svg viewBox="0 0 600 200" className="w-full h-full">
                  <defs>
                    <pattern id="seal" width="60" height="60" patternUnits="userSpaceOnUse">
                      <circle cx="30" cy="30" r="22" fill="none" stroke="#fbbf24" strokeWidth="0.5" />
                      <circle cx="30" cy="30" r="14" fill="none" stroke="#fbbf24" strokeWidth="0.5" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#seal)" />
                </svg>
              </div>
              <div className="relative text-center">
                <div className="text-[11px] uppercase tracking-[0.4em] text-gilt-500/70 mb-2">
                  a new era begins · year {data.new.start_year}
                </div>
                <div className="font-serif text-5xl text-vellum-50 drop-shadow">{data.new.name}</div>
                {data.new.art_style && (
                  <div className="text-xs text-gilt-400/60 italic mt-3 max-w-xl mx-auto">
                    {data.new.art_style}
                  </div>
                )}
              </div>
            </div>

            {data.new.premise && (
              <div className="text-sub italic font-serif leading-relaxed text-center max-w-2xl mx-auto">
                {data.new.premise}
              </div>
            )}

            {/* Linguistic delta */}
            {(data.language.phonological_rules.length > 0 || data.language.lex_delta.length > 0) && (
              <div className="border border-subtle rounded-md p-4 bg-night-950/60">
                <div className="text-[11px] uppercase tracking-widest text-faint mb-3">
                  the tongue shifts
                </div>
                {data.language.phonology_notes && (
                  <div className="text-sm text-sub italic mb-3">{data.language.phonology_notes}</div>
                )}
                {data.language.phonological_rules.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mb-3 text-sm font-mono">
                    {data.language.phonological_rules.map((r, i) => (
                      <div key={i} className="flex items-baseline gap-2">
                        <span className="text-faint">{r.from_sound}</span>
                        <span className="text-gilt-500">→</span>
                        <span className="text-gilt-400">{r.to_sound}</span>
                        {r.context && (
                          <span className="text-faint/70 text-xs italic ml-auto">{r.context}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {data.language.lex_delta.length > 0 && (
                  <>
                    <div className="text-[11px] uppercase tracking-widest text-faint mb-1 mt-3">
                      lexicon drift
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm font-mono">
                      {data.language.lex_delta.map((d) => (
                        <div key={d.en} className="flex items-baseline gap-2">
                          <span className="text-faint w-20">{d.en}</span>
                          {d.old ? (
                            <>
                              <span className="text-faint/70 line-through">{d.old}</span>
                              <span className="text-gilt-500">→</span>
                              <span className="text-gilt-400">{d.new}</span>
                            </>
                          ) : (
                            <span className="text-gilt-400">{d.new}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {data.language.sample_text && (
              <div className="border-l-2 border-gilt-500/40 pl-4 max-w-2xl mx-auto">
                <div className="text-[11px] uppercase tracking-widest text-faint mb-1">
                  sample of the new tongue
                </div>
                <div className="text-sub italic font-serif leading-relaxed">
                  “{data.language.sample_text}”
                </div>
              </div>
            )}

            {data.language.inscriptions.length > 0 && (
              <div className="border border-subtle rounded-md p-4 bg-night-950/60">
                <div className="text-[11px] uppercase tracking-widest text-faint mb-2">
                  inscriptions of the new era
                </div>
                <div className="space-y-3">
                  {data.language.inscriptions.map((ins, i) => (
                    <div key={i} className="border-l-2 border-gilt-500/40 pl-3">
                      <div className="text-sm text-gilt-400 font-serif italic">
                        “{ins.in_world_text}”
                      </div>
                      <div className="text-xs text-dim mt-0.5">{ins.translation}</div>
                      {ins.context && (
                        <div className="text-[10px] uppercase tracking-widest text-faint/70 mt-0.5">
                          {ins.context}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-center pt-2">
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-md border border-gilt-500/40 hover:border-gilt-400 text-gilt-500 hover:text-gilt-400 text-sm"
              >
                close the seal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
