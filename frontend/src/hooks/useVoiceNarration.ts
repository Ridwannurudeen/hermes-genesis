import { useCallback, useEffect, useRef } from 'react';

export function useVoiceNarration(enabled: boolean) {
  const queueRef = useRef<string[]>([]);
  const speakingRef = useRef(false);

  const processQueue = useCallback(() => {
    if (speakingRef.current || queueRef.current.length === 0) return;
    if (!window.speechSynthesis) return;

    speakingRef.current = true;
    const text = queueRef.current.shift()!;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;   // slightly slower for drama
    utterance.pitch = 0.95; // slightly deeper
    utterance.volume = 0.8;

    // Try to pick a good English voice
    const voices = speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => v.name.includes('Google UK English Male')) ||
      voices.find((v) => v.name.includes('Daniel')) ||
      voices.find((v) => v.lang.startsWith('en') && v.name.toLowerCase().includes('male')) ||
      voices.find((v) => v.lang.startsWith('en'));
    if (preferred) utterance.voice = preferred;

    utterance.onend = () => {
      speakingRef.current = false;
      processQueue();
    };
    utterance.onerror = () => {
      speakingRef.current = false;
      processQueue();
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

  // Stop everything when disabled
  useEffect(() => {
    if (!enabled) {
      speechSynthesis?.cancel();
      queueRef.current = [];
      speakingRef.current = false;
    }
  }, [enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      speechSynthesis?.cancel();
    };
  }, []);

  return { speak };
}
