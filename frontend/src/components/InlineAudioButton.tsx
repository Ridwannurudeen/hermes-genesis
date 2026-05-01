import { useEffect, useRef, useState } from 'react';

/**
 * Tiny inline audio play/pause button for article rows. One global <audio>
 * element via a module-level ref + event channel so playing one row pauses
 * any other. Stops if the user navigates away.
 *
 * Why module-level: lightweight pubsub. A React Context would force every
 * row to re-render on every state change; a custom event bus avoids that.
 */
const PLAY_EVENT = 'chroniclon:audio-play';

let activeSrc: string | null = null;
let audioEl: HTMLAudioElement | null = null;

function getAudioEl(): HTMLAudioElement {
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.preload = 'none';
  }
  return audioEl;
}

export default function InlineAudioButton({ src, label }: { src: string; label?: string }) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const errorRef = useRef(false);

  useEffect(() => {
    const onOtherPlay = (e: Event) => {
      const ev = e as CustomEvent<{ src: string }>;
      if (ev.detail.src !== src) setPlaying(false);
    };
    window.addEventListener(PLAY_EVENT, onOtherPlay);

    const a = getAudioEl();
    const onEnded = () => {
      if (activeSrc === src) {
        setPlaying(false);
        activeSrc = null;
      }
    };
    const onPause = () => {
      if (activeSrc === src) setPlaying(false);
    };
    a.addEventListener('ended', onEnded);
    a.addEventListener('pause', onPause);
    return () => {
      window.removeEventListener(PLAY_EVENT, onOtherPlay);
      a.removeEventListener('ended', onEnded);
      a.removeEventListener('pause', onPause);
    };
  }, [src]);

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const a = getAudioEl();
    if (playing) {
      a.pause();
      setPlaying(false);
      return;
    }
    if (a.src !== window.location.origin + src && a.src !== src) {
      a.src = src;
    }
    setLoading(true);
    activeSrc = src;
    window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: { src } }));
    a.play()
      .then(() => {
        setPlaying(true);
        errorRef.current = false;
      })
      .catch(() => {
        errorRef.current = true;
        setPlaying(false);
      })
      .finally(() => setLoading(false));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={playing ? `Pause ${label || 'narration'}` : `Play ${label || 'narration'}`}
      title={playing ? 'Pause narration' : 'Play narration'}
      className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-gilt-500/60 bg-gilt-500/10 hover:bg-gilt-500/25 text-gilt-500 hover:text-gilt-600 dark:hover:text-gilt-400 transition-colors shrink-0"
    >
      {loading ? (
        // 3-dot loading
        <span className="block w-1 h-1 rounded-full bg-gilt-500 animate-pulse" />
      ) : playing ? (
        // Pause: two vertical bars
        <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" aria-hidden>
          <rect x="1" y="1" width="2" height="6" />
          <rect x="5" y="1" width="2" height="6" />
        </svg>
      ) : (
        // Play: triangle
        <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" aria-hidden>
          <path d="M2 1 L7 4 L2 7 Z" />
        </svg>
      )}
    </button>
  );
}
