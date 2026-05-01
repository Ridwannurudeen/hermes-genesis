import { loadFont as loadDisplay } from '@remotion/google-fonts/SourceSerif4';
import { loadFont as loadGeist } from '@remotion/google-fonts/Geist';
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';

// Force-loaded so the renderer doesn't paint with fallback fonts on the
// first few frames. Each loadFont returns a CSS string we don't need to
// hold onto — the side effect is what matters.
loadDisplay();
loadGeist();
loadMono();
