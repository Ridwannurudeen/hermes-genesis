import { loadFont as loadDisplay } from '@remotion/google-fonts/SourceSerif4';
import { loadFont as loadUi } from '@remotion/google-fonts/Inter';
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';

// Force-loaded so the renderer doesn't paint with fallback fonts on the
// first few frames. Each loadFont returns a CSS string we don't need to
// hold onto — the side effect is what matters.
//
// The site uses Geist for UI; Geist isn't in @remotion/google-fonts.
// Inter is the closest editorial-grade equivalent and what Vercel used
// before switching to Geist. The visual difference is imperceptible at
// the small sizes we use it (eyebrow + meta strips).
loadDisplay();
loadUi();
loadMono();
