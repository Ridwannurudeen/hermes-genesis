import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Download, Loader2, Check } from 'lucide-react';
import { api } from '../api';

interface Props {
  worldId: string;
  worldName: string;
  onClose: () => void;
}

export default function ChronicleModal({ worldId, worldName, onClose }: Props) {
  const [chronicle, setChronicle] = useState<string | null>(null);
  const [currentDay, setCurrentDay] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.generateChronicle(worldId);
        if (!cancelled) {
          setChronicle(res.chronicle);
          setCurrentDay(res.current_day);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to generate chronicle');
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
    if (!chronicle) return;
    try {
      await navigator.clipboard.writeText(chronicle);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API may fail in some contexts
    }
  }, [chronicle]);

  const handleDownload = useCallback(() => {
    if (!chronicle) return;
    const blob = new Blob(
      [`# Chronicle of ${worldName}\n\n*Day ${currentDay}*\n\n${chronicle}`],
      { type: 'text/markdown' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${worldName.toLowerCase().replace(/\s+/g, '-')}-chronicle-day-${currentDay}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [chronicle, worldName, currentDay]);

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
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
            <div>
              <h2 className="text-xl font-bold text-gray-100">{worldName}</h2>
              {!loading && chronicle && (
                <p className="text-sm text-gray-500">Chronicle of Day {currentDay}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {loading && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-8 h-8 text-genesis-400 animate-spin" />
                <p className="text-gray-400 text-sm">The chronicler is writing...</p>
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

            {chronicle && (
              <div className="text-gray-300 leading-relaxed whitespace-pre-wrap text-[15px]">
                {chronicle}
              </div>
            )}
          </div>

          {/* Footer */}
          {chronicle && (
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800 shrink-0">
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
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
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Download .md
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
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
