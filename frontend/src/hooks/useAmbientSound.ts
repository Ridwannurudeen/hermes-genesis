import { useCallback, useEffect, useRef } from 'react';

/* ── Theme detection from world seed ── */

type ThemeKey = 'cyberpunk' | 'scifi' | 'horror' | 'mythology' | 'medieval' | 'postapoc' | 'default';

interface ThemeModifier {
  freqMultiplier: number;    // shift all frequencies up/down
  preferOsc: OscillatorType; // override base oscillator tendency
  filterShift: number;       // add/subtract from filter cutoff
  noiseBoost: number;        // add to noise level
  lfoShift: number;          // add to LFO rate
  gainMultiplier: number;
}

const THEME_MODIFIERS: Record<ThemeKey, ThemeModifier> = {
  cyberpunk:  { freqMultiplier: 1.3,  preferOsc: 'sawtooth',  filterShift: 200,  noiseBoost: 0.06, lfoShift: 0.5, gainMultiplier: 1.1 },
  scifi:     { freqMultiplier: 1.2,  preferOsc: 'triangle',  filterShift: 300,  noiseBoost: 0.03, lfoShift: 0.3, gainMultiplier: 1.0 },
  horror:    { freqMultiplier: 0.7,  preferOsc: 'sawtooth',  filterShift: -200, noiseBoost: 0.1,  lfoShift: -0.2, gainMultiplier: 1.2 },
  mythology: { freqMultiplier: 1.0,  preferOsc: 'sine',      filterShift: 100,  noiseBoost: 0.02, lfoShift: 0.0, gainMultiplier: 1.0 },
  medieval:  { freqMultiplier: 0.85, preferOsc: 'triangle',  filterShift: -100, noiseBoost: 0.02, lfoShift: -0.1, gainMultiplier: 1.0 },
  postapoc:  { freqMultiplier: 0.8,  preferOsc: 'sawtooth',  filterShift: -150, noiseBoost: 0.12, lfoShift: 0.8, gainMultiplier: 1.15 },
  default:   { freqMultiplier: 1.0,  preferOsc: 'sine',      filterShift: 0,    noiseBoost: 0,    lfoShift: 0, gainMultiplier: 1.0 },
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

/* ── Sound profiles per event type ── */

interface SoundProfile {
  baseFreq: number;
  oscType: OscillatorType;
  secondOscType?: OscillatorType;
  secondInterval?: number;
  detune?: number;
  filterType: BiquadFilterType;
  filterFreq: number;
  lfoRate: number;
  lfoDepth: number;
  noiseLevel: number;
  gain: number;
}

const PROFILES: Record<string, SoundProfile> = {
  military_conflict: {
    baseFreq: 73, oscType: 'sawtooth', filterType: 'lowpass', filterFreq: 400,
    lfoRate: 4, lfoDepth: 0.3, noiseLevel: 0.15, gain: 0.12,
  },
  betrayal: {
    baseFreq: 78, oscType: 'triangle', filterType: 'lowpass', filterFreq: 600,
    lfoRate: 0.5, lfoDepth: 0.2, noiseLevel: 0.08, gain: 0.10,
  },
  political_intrigue: {
    baseFreq: 131, oscType: 'sine', secondOscType: 'triangle', secondInterval: 1.189,
    filterType: 'bandpass', filterFreq: 800, lfoRate: 1.5, lfoDepth: 0.25, noiseLevel: 0.06, gain: 0.09,
  },
  alliance: {
    baseFreq: 196, oscType: 'sine', filterType: 'lowpass', filterFreq: 2000,
    lfoRate: 0.3, lfoDepth: 0.15, noiseLevel: 0.03, gain: 0.08,
  },
  succession: {
    baseFreq: 262, oscType: 'sine', secondOscType: 'sine', secondInterval: 1.5,
    filterType: 'lowpass', filterFreq: 1500, lfoRate: 0.4, lfoDepth: 0.15, noiseLevel: 0.04, gain: 0.08,
  },
  discovery: {
    baseFreq: 330, oscType: 'sine', filterType: 'highpass', filterFreq: 300,
    lfoRate: 2, lfoDepth: 0.2, noiseLevel: 0.05, gain: 0.07,
  },
  cultural_shift: {
    baseFreq: 220, oscType: 'triangle', filterType: 'lowpass', filterFreq: 1200,
    lfoRate: 1, lfoDepth: 0.2, noiseLevel: 0.04, gain: 0.08,
  },
  natural_disaster: {
    baseFreq: 55, oscType: 'sawtooth', filterType: 'lowpass', filterFreq: 300,
    lfoRate: 6, lfoDepth: 0.4, noiseLevel: 0.25, gain: 0.14,
  },
  death: {
    baseFreq: 65, oscType: 'sine', filterType: 'lowpass', filterFreq: 500,
    lfoRate: 0.2, lfoDepth: 0.1, noiseLevel: 0.06, gain: 0.08,
  },
  birth: {
    baseFreq: 523, oscType: 'sine', filterType: 'highpass', filterFreq: 400,
    lfoRate: 0.8, lfoDepth: 0.15, noiseLevel: 0.02, gain: 0.06,
  },
  divine_intervention: {
    baseFreq: 392, oscType: 'sine', secondOscType: 'sine', detune: 8,
    filterType: 'lowpass', filterFreq: 3000, lfoRate: 0.5, lfoDepth: 0.2, noiseLevel: 0.05, gain: 0.07,
  },
  agent_intervention: {
    baseFreq: 185, oscType: 'triangle', filterType: 'bandpass', filterFreq: 1000,
    lfoRate: 1.2, lfoDepth: 0.25, noiseLevel: 0.07, gain: 0.08,
  },
  prophecy_fulfilled: {
    baseFreq: 294, oscType: 'sine', secondOscType: 'sine', secondInterval: 1.5,
    filterType: 'lowpass', filterFreq: 2500, lfoRate: 0.6, lfoDepth: 0.18, noiseLevel: 0.04, gain: 0.07,
  },
};

const DEFAULT_PROFILE: SoundProfile = {
  baseFreq: 150, oscType: 'sine', filterType: 'lowpass', filterFreq: 1000,
  lfoRate: 0.5, lfoDepth: 0.15, noiseLevel: 0.04, gain: 0.07,
};

function applyTheme(profile: SoundProfile, mod: ThemeModifier): SoundProfile {
  return {
    ...profile,
    baseFreq: profile.baseFreq * mod.freqMultiplier,
    oscType: mod.preferOsc !== 'sine' ? mod.preferOsc : profile.oscType,
    filterFreq: Math.max(100, profile.filterFreq + mod.filterShift),
    noiseLevel: Math.min(0.4, profile.noiseLevel + mod.noiseBoost),
    lfoRate: Math.max(0.1, profile.lfoRate + mod.lfoShift),
    gain: profile.gain * mod.gainMultiplier,
  };
}

const FADE_IN = 1.5;
const FADE_OUT = 1.5;

interface ActiveSound {
  osc1: OscillatorNode;
  osc2?: OscillatorNode;
  noiseSource?: AudioBufferSourceNode;
  noiseGain: GainNode;
  masterGain: GainNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
  filter: BiquadFilterNode;
}

export function useAmbientSound(enabled: boolean, worldSeed: string = '') {
  const ctxRef = useRef<AudioContext | null>(null);
  const activeRef = useRef<ActiveSound | null>(null);
  const currentTypeRef = useRef<string | null>(null);
  const volumeRef = useRef(0.5);
  const mountedRef = useRef(true);
  const themeRef = useRef<ThemeKey>('default');

  // Detect theme from seed once
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

  const createNoiseBuffer = useCallback((ctx: AudioContext): AudioBuffer => {
    const size = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }, []);

  const fadeOut = useCallback((sound: ActiveSound, duration: number) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    sound.masterGain.gain.cancelScheduledValues(now);
    sound.masterGain.gain.setValueAtTime(sound.masterGain.gain.value, now);
    sound.masterGain.gain.linearRampToValueAtTime(0, now + duration);

    setTimeout(() => {
      try { sound.osc1.stop(); } catch { /* already stopped */ }
      try { sound.osc2?.stop(); } catch { /* already stopped */ }
      try { sound.lfo.stop(); } catch { /* already stopped */ }
      try { sound.noiseSource?.stop(); } catch { /* already stopped */ }
      try { sound.osc1.disconnect(); } catch { /* ok */ }
      try { sound.osc2?.disconnect(); } catch { /* ok */ }
      try { sound.lfo.disconnect(); } catch { /* ok */ }
      try { sound.noiseSource?.disconnect(); } catch { /* ok */ }
      try { sound.noiseGain.disconnect(); } catch { /* ok */ }
      try { sound.masterGain.disconnect(); } catch { /* ok */ }
      try { sound.lfoGain.disconnect(); } catch { /* ok */ }
      try { sound.filter.disconnect(); } catch { /* ok */ }
    }, (duration + 0.1) * 1000);
  }, []);

  const play = useCallback((eventType: string) => {
    if (!enabled || !mountedRef.current) return;
    if (currentTypeRef.current === eventType && activeRef.current) return;

    const ctx = getContext();
    const baseProfile = PROFILES[eventType] || DEFAULT_PROFILE;
    const themeMod = THEME_MODIFIERS[themeRef.current];
    const profile = applyTheme(baseProfile, themeMod);

    // Fade out current sound
    if (activeRef.current) {
      fadeOut(activeRef.current, FADE_OUT);
      activeRef.current = null;
    }

    const now = ctx.currentTime;

    // Master gain
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(profile.gain * volumeRef.current, now + FADE_IN);

    // Filter
    const filter = ctx.createBiquadFilter();
    filter.type = profile.filterType;
    filter.frequency.setValueAtTime(profile.filterFreq, now);
    filter.Q.setValueAtTime(1, now);

    // LFO
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(profile.lfoRate, now);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(profile.lfoDepth * profile.gain * volumeRef.current, now);
    lfo.connect(lfoGain);
    lfoGain.connect(masterGain.gain);
    lfo.start(now);

    // Oscillator 1
    const osc1 = ctx.createOscillator();
    osc1.type = profile.oscType;
    osc1.frequency.setValueAtTime(profile.baseFreq, now);
    osc1.connect(filter);

    // Oscillator 2 (optional chord/detune layer)
    let osc2: OscillatorNode | undefined;
    if (baseProfile.secondOscType) {
      osc2 = ctx.createOscillator();
      osc2.type = baseProfile.secondOscType;
      if (baseProfile.secondInterval) {
        osc2.frequency.setValueAtTime(profile.baseFreq * baseProfile.secondInterval, now);
      } else {
        osc2.frequency.setValueAtTime(profile.baseFreq, now);
        if (baseProfile.detune) osc2.detune.setValueAtTime(baseProfile.detune, now);
      }
      const osc2Gain = ctx.createGain();
      osc2Gain.gain.setValueAtTime(0.6, now);
      osc2.connect(osc2Gain);
      osc2Gain.connect(filter);
      osc2.start(now);
    }

    // Noise layer
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(profile.noiseLevel * volumeRef.current, now);
    let noiseSource: AudioBufferSourceNode | undefined;
    if (profile.noiseLevel > 0) {
      const noiseBuffer = createNoiseBuffer(ctx);
      noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;
      noiseSource.connect(noiseGain);
      noiseGain.connect(filter);
      noiseSource.start(now);
    }

    // Connect
    filter.connect(masterGain);
    masterGain.connect(ctx.destination);
    osc1.start(now);

    const sound: ActiveSound = {
      osc1, osc2, noiseSource, noiseGain, masterGain, lfo, lfoGain, filter,
    };
    activeRef.current = sound;
    currentTypeRef.current = eventType;
  }, [enabled, getContext, fadeOut, createNoiseBuffer]);

  const stop = useCallback(() => {
    if (activeRef.current) {
      fadeOut(activeRef.current, 1);
      activeRef.current = null;
      currentTypeRef.current = null;
    }
  }, [fadeOut]);

  const setVolume = useCallback((vol: number) => {
    volumeRef.current = Math.max(0, Math.min(1, vol));
    if (activeRef.current && ctxRef.current) {
      const now = ctxRef.current.currentTime;
      const baseProfile = PROFILES[currentTypeRef.current || ''] || DEFAULT_PROFILE;
      const profile = applyTheme(baseProfile, THEME_MODIFIERS[themeRef.current]);
      activeRef.current.masterGain.gain.cancelScheduledValues(now);
      activeRef.current.masterGain.gain.setValueAtTime(
        activeRef.current.masterGain.gain.value, now
      );
      activeRef.current.masterGain.gain.linearRampToValueAtTime(
        profile.gain * volumeRef.current, now + 0.3
      );
    }
  }, []);

  useEffect(() => {
    if (!enabled) stop();
  }, [enabled, stop]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const sound = activeRef.current;
      if (sound) {
        try { sound.masterGain.gain.cancelScheduledValues(0); } catch { /* ok */ }
        try { sound.masterGain.gain.setValueAtTime(0, 0); } catch { /* ok */ }
        try { sound.osc1.stop(); } catch { /* ok */ }
        try { sound.osc2?.stop(); } catch { /* ok */ }
        try { sound.lfo.stop(); } catch { /* ok */ }
        try { sound.noiseSource?.stop(); } catch { /* ok */ }
        try { sound.masterGain.disconnect(); } catch { /* ok */ }
        try { sound.filter.disconnect(); } catch { /* ok */ }
        try { sound.lfoGain.disconnect(); } catch { /* ok */ }
        try { sound.noiseGain.disconnect(); } catch { /* ok */ }
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
