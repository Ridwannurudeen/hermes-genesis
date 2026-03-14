import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Download, Loader2, Check, Sparkles } from 'lucide-react';
import { api } from '../api';

interface Props {
  worldId: string;
  worldName: string;
  onClose: () => void;
}

export default function SessionPrepModal({ worldId, worldName, onClose }: Props) {
  const [plan, setPlan] = useState<string | null>(null);
  const [currentDay, setCurrentDay] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.generateSessionPrep(worldId);
        if (!cancelled) {
          setPlan(res.session_plan);
          setCurrentDay(res.current_day);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to generate session plan');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [worldId]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleCopy = useCallback(async () => {
    if (!plan) return;
    try {
      await navigator.clipboard.writeText(plan);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API may fail in some contexts
    }
  }, [plan]);

  const slugName = worldName.toLowerCase().replace(/\s+/g, '-');

  const handleDownload = useCallback(() => {
    if (!plan) return;
    const content = `# Session Prep — ${worldName}\n\n*Day ${currentDay} — Tonight's Session*\n\n${plan}`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slugName}-session-day${currentDay}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [plan, worldName, currentDay, slugName]);

  /** Detect if a line is inside a "Read-Aloud" section */
  function isReadAloudSection(headerText: string): boolean {
    const lower = headerText.toLowerCase();
    return lower.includes('read-aloud') || lower.includes('read aloud');
  }

  /** Render markdown-ish text with styled headers and read-aloud sections */
  function renderContent(text: string) {
    const lines = text.split('\n');
    const elements: JSX.Element[] = [];
    let inReadAloud = false;
    let readAloudLines: string[] = [];

    const flushReadAloud = () => {
      if (readAloudLines.length > 0) {
        elements.push(
          <div
            key={`ra-${elements.length}`}
            className="bg-amber-950/20 border-l-4 border-amber-600 pl-5 pr-4 py-4 my-3 rounded-r-lg"
          >
            {readAloudLines.map((rl, j) => {
              if (rl.trim() === '') {
                return <div key={j} className="h-2" />;
              }
              return (
                <p key={j} className="text-amber-200/90 italic leading-relaxed">
                  {renderInlineFormatting(rl)}
                </p>
              );
            })}
          </div>
        );
        readAloudLines = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // H2 headers
      if (line.startsWith('## ')) {
        flushReadAloud();
        const headerText = line.slice(3);
        inReadAloud = isReadAloudSection(headerText);
        elements.push(
          <h2 key={i} className="text-xl font-bold text-amber-400 mt-8 mb-3 first:mt-0 border-b border-amber-900/40 pb-2">
            {headerText}
          </h2>
        );
        continue;
      }

      // H3 headers
      if (line.startsWith('### ')) {
        flushReadAloud();
        inReadAloud = false;
        elements.push(
          <h3 key={i} className="text-lg font-semibold text-amber-500 mt-5 mb-1">
            {line.slice(4)}
          </h3>
        );
        continue;
      }

      // H1 headers
      if (line.startsWith('# ')) {
        flushReadAloud();
        inReadAloud = false;
        elements.push(
          <h1 key={i} className="text-2xl font-bold text-amber-300 mt-8 mb-3 first:mt-0 border-b border-amber-900/40 pb-2">
            {line.slice(2)}
          </h1>
        );
        continue;
      }

      // If we're in a read-aloud section, collect lines for special rendering
      if (inReadAloud) {
        // Stop read-aloud if we hit another major section marker
        if (/^\*\*[^*]+\*\*$/.test(line.trim())) {
          flushReadAloud();
          inReadAloud = false;
          elements.push(
            <p key={i} className="text-lg font-semibold text-amber-400 mt-5 mb-1">
              {line.trim().replace(/\*\*/g, '')}
            </p>
          );
          continue;
        }
        readAloudLines.push(line);
        continue;
      }

      // Bold lines
      if (/^\*\*[^*]+\*\*$/.test(line.trim())) {
        elements.push(
          <p key={i} className="text-lg font-semibold text-amber-400 mt-5 mb-1">
            {line.trim().replace(/\*\*/g, '')}
          </p>
        );
        continue;
      }

      // Horizontal rule
      if (/^---+$/.test(line.trim())) {
        elements.push(<hr key={i} className="border-amber-900/30 my-4" />);
        continue;
      }

      // Bullet points
      if (line.trimStart().startsWith('- ') || line.trimStart().startsWith('* ')) {
        const indent = line.length - line.trimStart().length;
        elements.push(
          <p key={i} className="text-gray-300 leading-relaxed" style={{ paddingLeft: `${indent * 4 + 16}px` }}>
            <span className="text-amber-600 mr-2">&bull;</span>
            {renderInlineFormatting(line.trimStart().slice(2))}
          </p>
        );
        continue;
      }

      // Numbered list
      const numberedMatch = line.trimStart().match(/^(\d+)\.\s+(.+)/);
      if (numberedMatch) {
        const indent = line.length - line.trimStart().length;
        elements.push(
          <p key={i} className="text-gray-300 leading-relaxed" style={{ paddingLeft: `${indent * 4 + 16}px` }}>
            <span className="text-amber-600 mr-2 font-medium">{numberedMatch[1]}.</span>
            {renderInlineFormatting(numberedMatch[2])}
          </p>
        );
        continue;
      }

      // GM notes in [brackets]
      if (line.trim().startsWith('[') && line.trim().endsWith(']')) {
        elements.push(
          <p key={i} className="text-gray-500 italic text-sm leading-relaxed pl-4 border-l-2 border-gray-700 my-1">
            {line.trim()}
          </p>
        );
        continue;
      }

      // Empty line
      if (line.trim() === '') {
        elements.push(<div key={i} className="h-2" />);
        continue;
      }

      // Quoted read-aloud text (lines starting with > or wrapped in quotes)
      if (line.trimStart().startsWith('>')) {
        elements.push(
          <div key={i} className="bg-amber-950/20 border-l-4 border-amber-600 pl-4 py-1 my-1 rounded-r">
            <p className="text-amber-200/90 italic leading-relaxed">
              {renderInlineFormatting(line.trimStart().slice(1).trim())}
            </p>
          </div>
        );
        continue;
      }

      // Regular text
      elements.push(
        <p key={i} className="text-gray-300 leading-relaxed">
          {renderInlineFormatting(line)}
        </p>
      );
    }

    flushReadAloud();
    return elements;
  }

  /** Handle inline bold/italic formatting */
  function renderInlineFormatting(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <span key={i} className="font-semibold text-gray-100">{part.slice(2, -2)}</span>;
      }
      return part;
    });
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.97 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-950 border border-amber-800/30 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl shadow-amber-900/10"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-amber-900/20 shrink-0 bg-gradient-to-r from-gray-950 via-amber-950/10 to-gray-950">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-900/20 border border-amber-800/30">
                <Sparkles className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-amber-200">
                  Session Prep &mdash; {worldName}
                </h2>
                {!loading && plan && (
                  <p className="text-sm text-amber-700">Day {currentDay} &middot; Tonight's 3-hour session</p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors rounded-lg hover:bg-white/[0.06]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            {loading && (
              <div className="flex flex-col items-center justify-center py-24 gap-5">
                <div className="relative">
                  <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
                </div>
                <p className="text-amber-600 text-sm font-medium">The Game Master is preparing tonight's session...</p>
                <p className="text-gray-600 text-xs">Crafting encounters, NPCs, and plot twists</p>
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <p className="text-red-400 text-sm">{error}</p>
                <button
                  onClick={onClose}
                  className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
                >
                  Close
                </button>
              </div>
            )}

            {plan && (
              <div className="text-[15px]">
                {renderContent(plan)}
              </div>
            )}
          </div>

          {/* Footer */}
          {plan && (
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-amber-900/20 shrink-0 bg-gradient-to-r from-gray-950 via-amber-950/10 to-gray-950">
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-4 py-2 text-sm text-amber-300 bg-amber-900/20 hover:bg-amber-900/30 border border-amber-800/30 rounded-lg transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 text-sm text-amber-300 bg-amber-900/20 hover:bg-amber-900/30 border border-amber-800/30 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Download .md
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
