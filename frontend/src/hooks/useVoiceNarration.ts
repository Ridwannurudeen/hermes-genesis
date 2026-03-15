import { useCallback, useEffect, useRef, useState } from 'react';

export type NarrationState = 'idle' | 'speaking' | 'paused';

export function useVoiceNarration(enabled: boolean) {
  const queueRef = useRef<string[]>([]);
  const speakingRef = useRef(false);
  const [narrationState, setNarrationState] = useState<NarrationState>('idle');

  const processQueue = useCallback(() => {
    if (speakingRef.current || queueRef.current.length === 0) return;
    if (!window.speechSynthesis) return;

    speakingRef.current = true;
    setNarrationState('speaking');
    const text = queueRef.current.shift()!;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 0.95;
    utterance.volume = 0.8;

    const voices = speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => v.name.includes('Google UK English Male')) ||
      voices.find((v) => v.name.includes('Daniel')) ||
      voices.find((v) => v.lang.startsWith('en') && v.name.toLowerCase().includes('male')) ||
      voices.find((v) => v.lang.startsWith('en'));
    if (preferred) utterance.voice = preferred;

    utterance.onend = () => {
      speakingRef.current = false;
      if (queueRef.current.length > 0) {
        processQueue();
      } else {
        setNarrationState('idle');
      }
    };
    utterance.onerror = () => {
      speakingRef.current = false;
      if (queueRef.current.length > 0) {
        processQueue();
      } else {
        setNarrationState('idle');
      }
    };

    speechSynthesis.speak(utterance);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!enabled || !window.speechSynthesis) return;
      queueRef.current.push(text);
      processQueue();
    },
    [enabled, processQueue],
  );

  const pause = useCallback(() => {
    if (!window.speechSynthesis) return;
    if (speechSynthesis.speaking && !speechSynthesis.paused) {
      speechSynthesis.pause();
      setNarrationState('paused');
    }
  }, []);

  const resume = useCallback(() => {
    if (!window.speechSynthesis) return;
    if (speechSynthesis.paused) {
      speechSynthesis.resume();
      setNarrationState('speaking');
    }
  }, []);

  const stop = useCallback(() => {
    if (!window.speechSynthesis) return;
    speechSynthesis.cancel();
    queueRef.current = [];
    speakingRef.current = false;
    setNarrationState('idle');
  }, []);

  // Stop everything when disabled
  useEffect(() => {
    if (!enabled) {
      stop();
    }
  }, [enabled, stop]);

  // Cleanup on unmount — force cancel with retry for Chrome bug
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        speechSynthesis.cancel();
        queueRef.current = [];
        speakingRef.current = false;
        // Chrome workaround: cancel again after a tick
        setTimeout(() => {
          speechSynthesis.cancel();
        }, 50);
      }
    };
  }, []);

  return { speak, pause, resume, stop, narrationState };
}
