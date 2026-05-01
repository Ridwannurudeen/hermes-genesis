import { Composition } from 'remotion';
import { Demo } from './Demo';
import { FPS, WIDTH, HEIGHT, TOTAL_DURATION } from './lib/tokens';
import './lib/fonts';

/**
 * Composition registry. One 90-second piece for now. If we ship cuts
 * (45-second teaser, 30-second X clip, vertical 9:16 mobile cut), they
 * register here too.
 */
export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="Demo"
        component={Demo}
        durationInFrames={TOTAL_DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
