import { useCallback, useEffect, useRef } from 'react';

/* ═══════════════════════════════════════════════════════════════════
   Melodic Ambient Sound Engine

   Plays musical phrases (arpeggios, chord pads, melodic motifs)
   that emotionally match each event type. Uses Web Audio API to
   synthesize layered sounds: a pad (sustained chord), an arpeggio
   (plucked notes cycling through a scale), and a sub-bass drone.
   ═══════════════════════════════════════════════════════════════════ */

/* ── Theme detection from world seed ── */

type ThemeKey = 'cyberpunk' | 'scifi' | 'horror' | 'mythology' | 'medieval' | 'postapoc' | 'default';

interface ThemeModifier {
  octaveShift: number;       // shift melody up/down octaves
  tempo: number;             // BPM multiplier
  reverbWet: number;         // how much reverb (0-1)
  brightness: number;        // filter cutoff multiplier
  padType: OscillatorType;
  arpType: OscillatorType;
}

const THEME_MODIFIERS: Record<ThemeKey, ThemeModifier> = {
  cyberpunk:  { octaveShift: 1,  tempo: 1.3,  reverbWet: 0.4, brightness: 1.4, padType: 'sawtooth', arpType: 'square' },
  scifi:     { octaveShift: 1,  tempo: 1.1,  reverbWet: 0.6, brightness: 1.3, padType: 'triangle', arpType: 'sine' },
  horror:    { octaveShift: -1, tempo: 0.7,  reverbWet: 0.7, brightness: 0.6, padType: 'sawtooth', arpType: 'triangle' },
  mythology: { octaveShift: 0,  tempo: 0.9,  reverbWet: 0.5, brightness: 1.0, padType: 'sine',     arpType: 'triangle' },
  medieval:  { octaveShift: 0,  tempo: 0.85, reverbWet: 0.5, brightness: 0.9, padType: 'triangle', arpType: 'sine' },
  postapoc:  { octaveShift: -1, tempo: 0.8,  reverbWet: 0.6, brightness: 0.7, padType: 'sawtooth', arpType: 'triangle' },
  default:   { octaveShift: 0,  tempo: 1.0,  reverbWet: 0.5, brightness: 1.0, padType: 'sine',     arpType: 'triangle' },
};

function detectTheme(seed: string): ThemeKey {
  const s = seed.toLowerCase();
  if (/cyber|neon|corp|hack|ai\b|android|robot|digital|synth/.test(s)) return 'cyberpunk';
  if (/space|ship|galact|planet|star|orbit|asteroid|colony/.test(s)) return 'scifi';
  if (/horror|undead|demon|curse|dark|shadow|blood|eldritch|lovecraft|cthulhu/.test(s)) return 'horror';
  if (/myth|god|norse|greek|olymp|ragnarok|zeus|odin|pantheon|divine/.test(s)) return 'mythology';
  if (/apocalyp|wasteland|survive|ruin|collapse|fallout|bunker/.test(s)) return 'postapoc';
  if (/rome|empire|caesar|medieval|knight|king|queen|throne|castle|sword|kingdom/.test(s)) return 'medieval';
  return 'default';
}

/* ── Musical note helpers ── */

// Concert pitch A4 = 440Hz. Convert MIDI note to frequency.
function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Named notes as MIDI values (octave 4)
const C4 = 60, D4 = 62, Eb4 = 63, E4 = 64, F4 = 65, G4 = 67, Ab4 = 68, A4 = 69, Bb4 = 70, B4 = 71;
const C5 = 72, D5 = 74, E5 = 76, G5 = 79;

/* ── Melodic profiles per event type ──
   Each profile defines:
   - chord: MIDI notes for the sustained pad (played together)
   - arpNotes: MIDI notes for the arpeggio (played in sequence, looping)
   - arpSpeed: seconds per note in arpeggio
   - bassMidi: sub-bass root note
   - mood: affects dynamics (gain envelope shape)
*/

interface MelodicProfile {
  chord: number[];         // pad chord (MIDI notes)
  arpNotes: number[];      // arpeggio sequence
  arpSpeed: number;        // seconds per arp note
  bassMidi: number;        // sub-bass note
  padGain: number;         // pad volume
  arpGain: number;         // arp volume
  bassGain: number;        // bass volume
  filterFreq: number;      // master filter cutoff
  ascending: boolean;      // arp direction feel
}

const PROFILES: Record<string, MelodicProfile> = {
  // WAR — dark minor, heavy, marching arp
  military_conflict: {
    chord: [C4, Eb4, G4, C5],
    arpNotes: [C4, Eb4, G4, C5, G4, Eb4],
    arpSpeed: 0.2, bassMidi: 36, padGain: 0.06, arpGain: 0.05, bassGain: 0.07,
    filterFreq: 800, ascending: false,
  },
  // BETRAYAL — diminished, unsettling chromatic creep
  betrayal: {
    chord: [B4 - 12, D4, F4, Ab4],
    arpNotes: [B4 - 12, D4, F4, Ab4, F4, D4, B4 - 12],
    arpSpeed: 0.35, bassMidi: 35, padGain: 0.05, arpGain: 0.04, bassGain: 0.05,
    filterFreq: 600, ascending: false,
  },
  // INTRIGUE — jazzy minor 7th, tiptoeing arp
  political_intrigue: {
    chord: [D4, F4, A4, C5],
    arpNotes: [D4, F4, A4, C5, A4, F4],
    arpSpeed: 0.28, bassMidi: 38, padGain: 0.05, arpGain: 0.045, bassGain: 0.04,
    filterFreq: 1200, ascending: true,
  },
  // ALLIANCE — warm major, open fifths, gentle arp
  alliance: {
    chord: [G4 - 12, B4 - 12, D4, G4],
    arpNotes: [G4 - 12, B4 - 12, D4, G4, D5, G4, D4],
    arpSpeed: 0.4, bassMidi: 43, padGain: 0.06, arpGain: 0.04, bassGain: 0.04,
    filterFreq: 2000, ascending: true,
  },
  // SUCCESSION — regal, triumphant, fanfare-like
  succession: {
    chord: [C4, E4, G4, C5],
    arpNotes: [C4, E4, G4, C5, E5, C5, G4, E4],
    arpSpeed: 0.22, bassMidi: 36, padGain: 0.06, arpGain: 0.05, bassGain: 0.05,
    filterFreq: 2500, ascending: true,
  },
  // DISCOVERY — bright, wonder, pentatonic ascent
  discovery: {
    chord: [C4, E4, G4, B4],
    arpNotes: [C4, D4, E4, G4, A4, C5, D5, E5],
    arpSpeed: 0.18, bassMidi: 36, padGain: 0.05, arpGain: 0.05, bassGain: 0.04,
    filterFreq: 3000, ascending: true,
  },
  // CULTURAL — modal, world-music feel, mixolydian
  cultural_shift: {
    chord: [D4, F4 + 1, A4, C5],
    arpNotes: [D4, E4, F4 + 1, A4, B4 - 1, A4, F4 + 1, E4],
    arpSpeed: 0.3, bassMidi: 38, padGain: 0.05, arpGain: 0.04, bassGain: 0.04,
    filterFreq: 1500, ascending: true,
  },
  // DISASTER — rumbling, atonal, chaotic
  natural_disaster: {
    chord: [C4 - 12, Eb4 - 12, F4 - 12 + 1, A4 - 12],
    arpNotes: [C4, Eb4, F4 + 1, C4, Eb4 - 12, C4 - 12],
    arpSpeed: 0.15, bassMidi: 28, padGain: 0.07, arpGain: 0.04, bassGain: 0.09,
    filterFreq: 500, ascending: false,
  },
  // DEATH — somber, slow, descending minor
  death: {
    chord: [A4 - 12, C4, E4, A4],
    arpNotes: [A4, E4, C4, A4 - 12, E4 - 12],
    arpSpeed: 0.5, bassMidi: 33, padGain: 0.05, arpGain: 0.03, bassGain: 0.05,
    filterFreq: 700, ascending: false,
  },
  // BIRTH — delicate, high, music-box feel
  birth: {
    chord: [C5, E5, G5, C5 + 12],
    arpNotes: [C5, E5, G5, C5 + 12, G5, E5, C5],
    arpSpeed: 0.25, bassMidi: 48, padGain: 0.04, arpGain: 0.05, bassGain: 0.03,
    filterFreq: 4000, ascending: true,
  },
  // DIVINE — ethereal, sus chords, shimmering
  divine_intervention: {
    chord: [C4, F4, G4, C5],
    arpNotes: [C5, G4, F4, C4, F4, G4, C5, G5],
    arpSpeed: 0.35, bassMidi: 36, padGain: 0.06, arpGain: 0.04, bassGain: 0.04,
    filterFreq: 3500, ascending: true,
  },
  // AGENT — mysterious, whole-tone scale
  agent_intervention: {
    chord: [C4, E4, Ab4 - 1, Bb4],
    arpNotes: [C4, D4, E4, F4 + 1, Ab4, Bb4, C5],
    arpSpeed: 0.22, bassMidi: 36, padGain: 0.05, arpGain: 0.045, bassGain: 0.04,
    filterFreq: 1800, ascending: true,
  },
  // PROPHECY — mystical, open 5ths, slow reveal
  prophecy_fulfilled: {
    chord: [D4, A4, D5, A4 + 12],
    arpNotes: [D4, A4, D5, F4 + 1, A4, D5, A4 + 12],
    arpSpeed: 0.4, bassMidi: 38, padGain: 0.06, arpGain: 0.04, bassGain: 0.05,
    filterFreq: 2200, ascending: true,
  },
};

const DEFAULT_PROFILE: MelodicProfile = {
  chord: [C4, E4, G4, C5],
  arpNotes: [C4, E4, G4, C5, G4, E4],
  arpSpeed: 0.3, bassMidi: 36, padGain: 0.05, arpGain: 0.04, bassGain: 0.04,
  filterFreq: 1500, ascending: true,
};

const FADE_IN = 2.0;
const FADE_OUT = 2.0;

interface ActiveSound {
  nodes: AudioNode[];       // all nodes to disconnect on cleanup
  oscillators: OscillatorNode[];  // all oscillators to stop
  bufferSources: AudioBufferSourceNode[];
  masterGain: GainNode;
  arpInterval: number;      // setInterval ID for arpeggio
}

export function useAmbientSound(enabled: boolean, worldSeed: string = '') {
  const ctxRef = useRef<AudioContext | null>(null);
  const activeRef = useRef<ActiveSound | null>(null);
  const currentTypeRef = useRef<string | null>(null);
  const volumeRef = useRef(0.5);
  const mountedRef = useRef(true);
  const themeRef = useRef<ThemeKey>('default');

  useEffect(() => {
    themeRef.current = worldSeed ? detectTheme(worldSeed) : 'default';
  }, [worldSeed]);

  const getContext = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  /* ── Create a simple convolution reverb (impulse response) ── */
  const createReverb = useCallback((ctx: AudioContext, wet: number): ConvolverNode => {
    const convolver = ctx.createConvolver();
    const rate = ctx.sampleRate;
    const length = rate * 2.5; // 2.5s reverb tail
    const impulse = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        // Exponential decay with some diffusion
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5) * wet;
      }
    }
    convolver.buffer = impulse;
    return convolver;
  }, []);

  const cleanupSound = useCallback((sound: ActiveSound, fadeDuration: number) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;

    // Clear arpeggio interval
    clearInterval(sound.arpInterval);

    // Fade out master
    sound.masterGain.gain.cancelScheduledValues(now);
    sound.masterGain.gain.setValueAtTime(sound.masterGain.gain.value, now);
    sound.masterGain.gain.linearRampToValueAtTime(0, now + fadeDuration);

    setTimeout(() => {
      for (const osc of sound.oscillators) {
        try { osc.stop(); } catch { /* ok */ }
      }
      for (const src of sound.bufferSources) {
        try { src.stop(); } catch { /* ok */ }
      }
      for (const node of sound.nodes) {
        try { node.disconnect(); } catch { /* ok */ }
      }
    }, (fadeDuration + 0.2) * 1000);
  }, []);

  const play = useCallback((eventType: string) => {
    if (!enabled || !mountedRef.current) return;
    if (currentTypeRef.current === eventType && activeRef.current) return;

    const ctx = getContext();
    const profile = PROFILES[eventType] || DEFAULT_PROFILE;
    const theme = THEME_MODIFIERS[themeRef.current];
    const vol = volumeRef.current;
    const now = ctx.currentTime;

    // Fade out previous
    if (activeRef.current) {
      cleanupSound(activeRef.current, FADE_OUT);
      activeRef.current = null;
    }

    const allNodes: AudioNode[] = [];
    const allOscs: OscillatorNode[] = [];
    const allBuffers: AudioBufferSourceNode[] = [];

    // ── Master chain: filter → reverb → dry/wet mix → master gain → destination ──
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(1, now + FADE_IN);
    masterGain.connect(ctx.destination);
    allNodes.push(masterGain);

    // Master filter (brightness)
    const masterFilter = ctx.createBiquadFilter();
    masterFilter.type = 'lowpass';
    masterFilter.frequency.setValueAtTime(profile.filterFreq * theme.brightness, now);
    masterFilter.Q.setValueAtTime(0.7, now);
    allNodes.push(masterFilter);

    // Reverb send
    const reverb = createReverb(ctx, theme.reverbWet);
    const dryGain = ctx.createGain();
    dryGain.gain.setValueAtTime(0.6, now);
    const wetGain = ctx.createGain();
    wetGain.gain.setValueAtTime(0.4, now);
    masterFilter.connect(dryGain);
    masterFilter.connect(reverb);
    reverb.connect(wetGain);
    dryGain.connect(masterGain);
    wetGain.connect(masterGain);
    allNodes.push(reverb, dryGain, wetGain);

    const octaveShift = theme.octaveShift * 12;

    // ── LAYER 1: Pad (sustained chord) ──
    const padGainNode = ctx.createGain();
    padGainNode.gain.setValueAtTime(profile.padGain * vol, now);
    padGainNode.connect(masterFilter);
    allNodes.push(padGainNode);

    for (const midi of profile.chord) {
      const freq = midiToFreq(midi + octaveShift);
      const osc = ctx.createOscillator();
      osc.type = theme.padType;
      osc.frequency.setValueAtTime(freq, now);
      // Slight detune for warmth
      osc.detune.setValueAtTime((Math.random() - 0.5) * 8, now);
      osc.connect(padGainNode);
      osc.start(now);
      allOscs.push(osc);
      allNodes.push(osc);
    }

    // ── LAYER 2: Sub-bass drone ──
    const bassGainNode = ctx.createGain();
    bassGainNode.gain.setValueAtTime(profile.bassGain * vol, now);
    bassGainNode.connect(masterFilter);
    allNodes.push(bassGainNode);

    const bassOsc = ctx.createOscillator();
    bassOsc.type = 'sine';
    bassOsc.frequency.setValueAtTime(midiToFreq(profile.bassMidi), now);
    bassOsc.connect(bassGainNode);
    bassOsc.start(now);
    allOscs.push(bassOsc);
    allNodes.push(bassOsc);

    // Subtle bass LFO for movement
    const bassLfo = ctx.createOscillator();
    bassLfo.type = 'sine';
    bassLfo.frequency.setValueAtTime(0.15, now);
    const bassLfoGain = ctx.createGain();
    bassLfoGain.gain.setValueAtTime(profile.bassGain * vol * 0.3, now);
    bassLfo.connect(bassLfoGain);
    bassLfoGain.connect(bassGainNode.gain);
    bassLfo.start(now);
    allOscs.push(bassLfo);
    allNodes.push(bassLfo, bassLfoGain);

    // ── LAYER 3: Arpeggio (melodic plucked notes) ──
    const arpSpeed = profile.arpSpeed / theme.tempo;
    let arpIndex = 0;

    const playArpNote = () => {
      if (!mountedRef.current || !ctxRef.current) return;
      const c = ctxRef.current;
      const t = c.currentTime;
      const midi = profile.arpNotes[arpIndex % profile.arpNotes.length] + octaveShift;
      const freq = midiToFreq(midi);

      // Create a plucked-string-like envelope
      const noteGain = c.createGain();
      noteGain.gain.setValueAtTime(profile.arpGain * vol, t);
      noteGain.gain.exponentialRampToValueAtTime(0.001, t + arpSpeed * 2.5);
      noteGain.connect(masterFilter);
      allNodes.push(noteGain);

      const osc = c.createOscillator();
      osc.type = theme.arpType;
      osc.frequency.setValueAtTime(freq, t);
      osc.connect(noteGain);
      osc.start(t);
      osc.stop(t + arpSpeed * 3);
      allNodes.push(osc);

      // Optional harmonics layer for richness
      if (Math.random() > 0.5) {
        const harm = c.createOscillator();
        harm.type = 'sine';
        harm.frequency.setValueAtTime(freq * 2, t);
        const harmGain = c.createGain();
        harmGain.gain.setValueAtTime(profile.arpGain * vol * 0.2, t);
        harmGain.gain.exponentialRampToValueAtTime(0.001, t + arpSpeed * 1.5);
        harm.connect(harmGain);
        harmGain.connect(masterFilter);
        harm.start(t);
        harm.stop(t + arpSpeed * 2);
        allNodes.push(harm, harmGain);
      }

      arpIndex++;
    };

    // Start arpeggio — play first note immediately, then interval
    playArpNote();
    const arpIntervalId = window.setInterval(playArpNote, arpSpeed * 1000);

    const sound: ActiveSound = {
      nodes: allNodes,
      oscillators: allOscs,
      bufferSources: allBuffers,
      masterGain,
      arpInterval: arpIntervalId,
    };
    activeRef.current = sound;
    currentTypeRef.current = eventType;
  }, [enabled, getContext, cleanupSound, createReverb]);

  const stop = useCallback(() => {
    if (activeRef.current) {
      cleanupSound(activeRef.current, 1);
      activeRef.current = null;
      currentTypeRef.current = null;
    }
  }, [cleanupSound]);

  const setVolume = useCallback((vol: number) => {
    volumeRef.current = Math.max(0, Math.min(1, vol));
  }, []);

  useEffect(() => {
    if (!enabled) stop();
  }, [enabled, stop]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (activeRef.current) {
        clearInterval(activeRef.current.arpInterval);
        for (const osc of activeRef.current.oscillators) {
          try { osc.stop(); } catch { /* ok */ }
        }
        for (const src of activeRef.current.bufferSources) {
          try { src.stop(); } catch { /* ok */ }
        }
        for (const node of activeRef.current.nodes) {
          try { node.disconnect(); } catch { /* ok */ }
        }
        activeRef.current = null;
      }
      if (ctxRef.current) {
        ctxRef.current.close();
        ctxRef.current = null;
      }
      currentTypeRef.current = null;
    };
  }, []);

  return { play, stop, setVolume };
}
