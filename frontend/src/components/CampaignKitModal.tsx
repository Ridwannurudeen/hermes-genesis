import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Download, Loader2, Check, Scroll, FileText } from 'lucide-react';
import { api } from '../api';

interface Props {
  worldId: string;
  worldName: string;
  onClose: () => void;
}

export default function CampaignKitModal({ worldId, worldName, onClose }: Props) {
  const [kit, setKit] = useState<string | null>(null);
  const [currentDay, setCurrentDay] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.generateCampaignKit(worldId);
        if (!cancelled) {
          setKit(res.campaign_kit);
          setCurrentDay(res.current_day);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to generate campaign kit');
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
    if (!kit) return;
    try {
      await navigator.clipboard.writeText(kit);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API may fail in some contexts
    }
  }, [kit]);

  const slugName = worldName.toLowerCase().replace(/\s+/g, '-');

  const handleDownloadMd = useCallback(() => {
    if (!kit) return;
    const content = `# Campaign Kit — ${worldName}\n\n*Generated at Day ${currentDay}*\n\n${kit}`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slugName}-campaign-kit.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [kit, worldName, currentDay, slugName]);

  const handleDownloadTxt = useCallback(() => {
    if (!kit) return;
    const content = `Campaign Kit — ${worldName}\nGenerated at Day ${currentDay}\n${'='.repeat(50)}\n\n${kit}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slugName}-campaign-kit.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [kit, worldName, currentDay, slugName]);

  /** Render markdown-ish text with styled headers */
  function renderContent(text: string) {
    return text.split('\n').map((line, i) => {
      // H1
      if (line.startsWith('# ')) {
        return (
          <h1 key={i} className="text-2xl font-bold text-amber-300 mt-8 mb-3 first:mt-0 border-b border-amber-900/40 pb-2">
            {line.slice(2)}
          </h1>
        );
      }
      // H2
      if (line.startsWith('## ')) {
        return (
          <h2 key={i} className="text-xl font-bold text-amber-400 mt-6 mb-2">
            {line.slice(3)}
          </h2>
        );
      }
      // H3
      if (line.startsWith('### ')) {
        return (
          <h3 key={i} className="text-lg font-semibold text-amber-500 mt-4 mb-1">
            {line.slice(4)}
          </h3>
        );
      }
      // Bold lines (often section headers from LLM output like **Section Name**)
      if (/^\*\*[^*]+\*\*$/.test(line.trim())) {
        return (
          <p key={i} className="text-lg font-semibold text-amber-400 mt-5 mb-1">
            {line.trim().replace(/\*\*/g, '')}
          </p>
        );
      }
      // Horizontal rule
      if (/^---+$/.test(line.trim())) {
        return <hr key={i} className="border-amber-900/30 my-4" />;
      }
      // Bullet points
      if (line.trimStart().startsWith('- ') || line.trimStart().startsWith('* ')) {
        const indent = line.length - line.trimStart().length;
        return (
          <p key={i} className="text-gray-300 leading-relaxed" style={{ paddingLeft: `${indent * 4 + 16}px` }}>
            <span className="text-amber-600 mr-2">&bull;</span>
            {renderInlineFormatting(line.trimStart().slice(2))}
          </p>
        );
      }
      // Numbered list
      const numberedMatch = line.trimStart().match(/^(\d+)\.\s+(.+)/);
      if (numberedMatch) {
        const indent = line.length - line.trimStart().length;
        return (
          <p key={i} className="text-gray-300 leading-relaxed" style={{ paddingLeft: `${indent * 4 + 16}px` }}>
            <span className="text-amber-600 mr-2 font-medium">{numberedMatch[1]}.</span>
            {renderInlineFormatting(numberedMatch[2])}
          </p>
        );
      }
      // Empty line
      if (line.trim() === '') {
        return <div key={i} className="h-2" />;
      }
      // Regular text
      return (
        <p key={i} className="text-gray-300 leading-relaxed">
          {renderInlineFormatting(line)}
        </p>
      );
    });
  }

  /** Handle inline bold/italic formatting */
  function renderInlineFormatting(text: string) {
    // Replace **bold** with styled spans
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
          className="bg-gray-950 border border-amber-900/30 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl shadow-amber-900/10"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-amber-900/20 shrink-0 bg-gradient-to-r from-gray-950 via-amber-950/10 to-gray-950">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-900/20 border border-amber-800/30">
                <Scroll className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-amber-200">
                  Campaign Kit &mdash; {worldName}
                </h2>
                {!loading && kit && (
                  <p className="text-sm text-amber-700">Day {currentDay} &middot; Ready-to-play TTRPG content</p>
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
                  <span className="absolute -top-1 -right-1 text-lg">&#127922;</span>
                </div>
                <p className="text-amber-600 text-sm font-medium">Forging your campaign kit...</p>
                <p className="text-gray-600 text-xs">Crafting NPCs, plot hooks, and encounter tables</p>
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

            {kit && (
              <div className="text-[15px]">
                {renderContent(kit)}
              </div>
            )}
          </div>

          {/* Footer */}
          {kit && (
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
                onClick={handleDownloadMd}
                className="flex items-center gap-2 px-4 py-2 text-sm text-amber-300 bg-amber-900/20 hover:bg-amber-900/30 border border-amber-800/30 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Download .md
              </button>
              <button
                onClick={handleDownloadTxt}
                className="flex items-center gap-2 px-4 py-2 text-sm text-amber-300 bg-amber-900/20 hover:bg-amber-900/30 border border-amber-800/30 rounded-lg transition-colors"
              >
                <FileText className="w-4 h-4" />
                Download .txt
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
