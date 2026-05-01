import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

/**
 * /watch — top-level entry point to the cinematic playback surface.
 *
 * Resolves the most-active public world (highest current_day) and redirects
 * to /world/{id}?cinematic=1, which auto-opens CinematicMode. Falls back to
 * sending the visitor to /chronicle if no public worlds exist yet — the
 * cinematic mode needs a real world to play against.
 *
 * Lives at /watch so the masthead has one-word access to the project's
 * most spectacular surface. Judges will not find it otherwise.
 */
export default function Watch() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    api
      .listWorlds()
      .then((worlds) => {
        if (cancelled) return;
        if (worlds.length === 0) {
          navigate('/chronicle', { replace: true });
          return;
        }
        const liveliest = worlds.reduce((a, b) =>
          a.current_day >= b.current_day ? a : b,
        );
        navigate(`/world/${liveliest.id}?cinematic=1`, { replace: true });
      })
      .catch(() => {
        if (!cancelled) navigate('/chronicle', { replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-page text-page flex items-center justify-center">
      <div className="text-center">
        <div className="font-mono text-eyebrow uppercase tracking-eyebrow text-faint mb-3">
          opening cinematic mode
        </div>
        <div className="font-display text-h2 text-heading italic">
          finding the liveliest world…
        </div>
      </div>
    </div>
  );
}
