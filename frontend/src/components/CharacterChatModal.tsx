import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2 } from 'lucide-react';
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
          className="w-1.5 h-1.5 bg-gray-400 rounded-full"
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
          className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
            <div className="flex items-center gap-3">
              {faction && (
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: faction.color }}
                />
              )}
              <div>
                <h2 className="text-lg font-bold text-gray-100">
                  {character.name}
                </h2>
                <p className="text-xs text-gray-500 capitalize">
                  {character.role}
                  {faction ? ` \u00B7 ${faction.name}` : ''}
                  {' \u00B7 '}{character.location}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {initialLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="w-6 h-6 text-genesis-400 animate-spin" />
                <p className="text-sm text-gray-500">
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
                          ? 'bg-genesis-900/40 border border-genesis-800/30 text-gray-200'
                          : 'bg-gray-800/70 border border-gray-700/30 text-gray-300'
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
                    <div className="bg-gray-800/70 border border-gray-700/30 rounded-xl px-4 py-2.5">
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
          <div className="px-5 py-4 border-t border-gray-800 shrink-0">
            <div className="flex items-center gap-3">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Say something to ${character.name}...`}
                disabled={loading || initialLoading}
                className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-genesis-600 disabled:opacity-50 transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={loading || initialLoading || !input.trim()}
                className="p-2.5 bg-genesis-600 hover:bg-genesis-500 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-xl transition-colors shrink-0"
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
