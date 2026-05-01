import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2, Dna, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../api';
import type { Character, Faction } from '../types';

interface ChatMessage {
  role: 'user' | 'character';
  text: string;
}

interface Props {
  worldId: string;
  character: Character;
  faction?: Faction;
  onClose: () => void;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 bg-vellum-400 rounded-full"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
  );
}

const TRAIT_LABELS: Record<string, [string, string]> = {
  courage: ['Bold', 'Cautious'],
  cunning: ['Shrewd', 'Naive'],
  loyalty: ['Devoted', 'Mercenary'],
  ambition: ['Ruthless', 'Content'],
  empathy: ['Gentle', 'Cold'],
  resilience: ['Iron', 'Fragile'],
};

const TRAIT_COLORS: Record<string, string> = {
  courage: 'bg-crimson-500',
  cunning: 'bg-gilt-500',
  loyalty: 'bg-ink-500',
  ambition: 'bg-gilt-500',
  empathy: 'bg-moss-500',
  resilience: 'bg-ink-500',
};

function GenomeBar({ trait, value }: { trait: string; value: number }) {
  const [high, low] = TRAIT_LABELS[trait] || ['High', 'Low'];
  const label = value > 0.6 ? high : value < 0.4 ? low : trait.charAt(0).toUpperCase() + trait.slice(1);
  const color = TRAIT_COLORS[trait] || 'bg-ink-500';

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-dim w-14 text-right truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value * 100}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`h-full ${color} rounded-full`}
          style={{ opacity: 0.4 + value * 0.6 }}
        />
      </div>
      <span className="text-[10px] text-faint w-6">{(value * 100).toFixed(0)}</span>
    </div>
  );
}

export default function CharacterChatModal({
  worldId,
  character,
  faction,
  onClose,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showProfile, setShowProfile] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  // Auto-introduce on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.chatWithCharacter(
          worldId,
          character.id,
          'Introduce yourself briefly.'
        );
        if (!cancelled) {
          setMessages([{ role: 'character', text: res.reply }]);
        }
      } catch {
        if (!cancelled) {
          setMessages([
            {
              role: 'character',
              text: `*${character.name} regards you silently, waiting...*`,
            },
          ]);
        }
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [worldId, character.id, character.name]);

  // Focus input after initial load
  useEffect(() => {
    if (!initialLoading) {
      inputRef.current?.focus();
    }
  }, [initialLoading]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setLoading(true);

    try {
      const res = await api.chatWithCharacter(worldId, character.id, trimmed);
      setMessages((prev) => [...prev, { role: 'character', text: res.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'character',
          text: `*${character.name} falls silent, unable to respond...*`,
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, worldId, character.id, character.name]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.97 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="bg-page/95 backdrop-blur-xl border border-subtle rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl shadow-black/50"
        >
          {/* Header */}
          <div className="shrink-0 border-b border-subtle">
            {/* Top bar with faction color accent */}
            <div
              className="h-1 w-full opacity-60"
              style={{ background: `linear-gradient(90deg, transparent, ${faction?.color || '#22d3ee'}, transparent)` }}
            />
            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shrink-0"
                  style={{
                    backgroundColor: `${faction?.color || '#22d3ee'}20`,
                    color: faction?.color || '#22d3ee',
                  }}
                >
                  {character.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-heading">
                    {character.name}
                  </h2>
                  <p className="text-xs text-dim capitalize">
                    {character.role}
                    {faction ? ` \u00B7 ${faction.name}` : ''}
                    {' \u00B7 '}{character.location}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowProfile((p) => !p)}
                  className="p-1.5 text-dim hover:text-sub transition-colors rounded-lg hover:bg-hover"
                  title={showProfile ? 'Hide profile' : 'Show profile'}
                >
                  {showProfile ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 text-dim hover:text-sub transition-colors rounded-lg hover:bg-hover"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Collapsible genome profile */}
            <AnimatePresence>
              {showProfile && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-3 space-y-2">
                    {/* Genome bars */}
                    <div className="flex items-center gap-1.5 mb-1">
                      <Dna className="w-3 h-3 text-gilt-500" />
                      <span className="text-[10px] text-gilt-500 uppercase tracking-wider font-medium">Genome</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {(['courage', 'cunning', 'loyalty', 'ambition', 'empathy', 'resilience'] as const).map((trait) => (
                        <GenomeBar
                          key={trait}
                          trait={trait}
                          value={character.genome?.[trait] ?? 0.5}
                        />
                      ))}
                    </div>
                    {/* Backstory */}
                    {character.backstory && (
                      <p className="text-[11px] text-dim italic leading-relaxed line-clamp-2 mt-1">
                        &ldquo;{character.backstory}&rdquo;
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {initialLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="w-6 h-6 text-gilt-500 animate-spin" />
                <p className="text-sm text-dim">
                  {character.name} is gathering their thoughts...
                </p>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${
 msg.role === 'user' ? 'justify-end' : 'justify-start'
 }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-xl px-4 py-2.5 ${
 msg.role === 'user'
 ? 'bg-ink-900/40 border border-ink-800/30 text-heading'
 : 'bg-white/[0.04] border border-subtle text-sub'
 }`}
                    >
                      {msg.role === 'character' && (
                        <p
                          className="text-xs font-medium mb-1"
                          style={{ color: faction?.color || '#22d3ee' }}
                        >
                          {character.name}
                        </p>
                      )}
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.text}
                      </p>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-white/[0.04] border border-subtle rounded-xl px-4 py-2.5">
                      <p
                        className="text-xs font-medium mb-1"
                        style={{ color: faction?.color || '#22d3ee' }}
                      >
                        {character.name}
                      </p>
                      <TypingIndicator />
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input area */}
          <div className="px-5 py-4 border-t border-subtle shrink-0">
            <div className="flex items-center gap-3">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Say something to ${character.name}...`}
                disabled={loading || initialLoading}
                className="flex-1 bg-surface border border-subtle focus:border-gilt-500/60 transition-colors rounded-xl px-4 py-2.5 text-sm text-input placeholder-faint focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={loading || initialLoading || !input.trim()}
                className="p-2.5 bg-gilt-600 hover:bg-gilt-500 disabled:bg-white/[0.04] disabled:text-faint text-white rounded-xl transition-colors shrink-0"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
