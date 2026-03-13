import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Power, Loader2, AlertTriangle } from 'lucide-react';
import { api } from '../api';

interface AgentLog {
  timestamp: string;
  day: number;
  reasoning?: string;
  decision?: string;
  narrative_arc?: string;
  urgency?: string;
  events_generated?: number;
  event_titles?: string[];
}

interface Props {
  worldId: string;
  onRefresh: () => void;
}

const URGENCY_COLORS: Record<string, string> = {
  low: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  high: 'bg-red-500/10 text-red-400 border-red-500/20',
};

export default function AutonomousPanel({ worldId, onRefresh }: Props) {
  const [active, setActive] = useState(false);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll status on mount
  useEffect(() => {
    api.getAgentStatus(worldId).then((s) => {
      setActive(s.running);
      if (s.log_count > 0) {
        api.getAgentLogs(worldId).then(setLogs).catch(() => {});
      }
    }).catch(() => {});
  }, [worldId]);

  // Poll logs every 10 seconds when active
  useEffect(() => {
    if (!active) {
      if (logPollRef.current) {
        clearInterval(logPollRef.current);
        logPollRef.current = null;
      }
      return;
    }

    const poll = () => {
      api.getAgentLogs(worldId).then(setLogs).catch(() => {});
    };
    poll(); // immediate
    logPollRef.current = setInterval(poll, 10000);

    return () => {
      if (logPollRef.current) {
        clearInterval(logPollRef.current);
        logPollRef.current = null;
      }
    };
  }, [active, worldId]);

  // Refresh parent data every 30 seconds when active
  useEffect(() => {
    if (!active) {
      if (refreshPollRef.current) {
        clearInterval(refreshPollRef.current);
        refreshPollRef.current = null;
      }
      return;
    }

    refreshPollRef.current = setInterval(onRefresh, 30000);

    return () => {
      if (refreshPollRef.current) {
        clearInterval(refreshPollRef.current);
        refreshPollRef.current = null;
      }
    };
  }, [active, onRefresh]);

  const handleToggle = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (active) {
        await api.stopAgent(worldId);
        setActive(false);
      } else {
        await api.startAgent(worldId);
        setActive(true);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to toggle agent');
      setTimeout(() => setError(null), 4000);
    } finally {
      setLoading(false);
    }
  }, [active, worldId]);

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts + 'Z');
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return ts;
    }
  };

  const reversedLogs = [...logs].reverse();

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      {/* Header + Toggle */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${active ? 'bg-green-500/10 border border-green-500/30' : 'bg-gray-800 border border-gray-700'}`}>
              <Brain className={`w-5 h-5 ${active ? 'text-green-400 animate-pulse' : 'text-gray-500'}`} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-200">
                {active ? 'AGENT ACTIVE' : 'World Agent'}
              </h3>
              <p className="text-xs text-gray-500">
                {active ? 'The world lives on its own' : 'Autonomous narrative intelligence'}
              </p>
            </div>
          </div>

          <button
            onClick={handleToggle}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
              active
                ? 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20'
                : 'bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Power className="w-4 h-4" />
            )}
            {active ? 'Stop Agent' : 'Awaken the World Agent'}
          </button>
        </div>

        {/* Active indicator bar */}
        {active && (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            className="mt-3 h-0.5 bg-gradient-to-r from-green-500/0 via-green-500/60 to-green-500/0 rounded-full origin-left"
          />
        )}

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3"
            >
              <div className="flex items-center gap-2 text-red-400 text-xs bg-red-950/50 border border-red-500/20 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                {error}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Log Feed */}
      <div className="max-h-[400px] overflow-y-auto">
        {reversedLogs.length === 0 ? (
          <div className="p-6 text-center text-gray-600 text-sm">
            {active ? 'Waiting for first agent cycle...' : 'Start the agent to see its reasoning here.'}
          </div>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {reversedLogs.map((log, i) => (
              <div
                key={`${log.timestamp}-${i}`}
                className={`p-4 text-sm transition-colors hover:bg-gray-800/30 ${
                  log.urgency === 'high' ? 'border-l-2 border-l-red-500/50' : ''
                }`}
              >
                {/* Header row */}
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-gray-600 text-xs font-mono">
                    {formatTime(log.timestamp)}
                  </span>
                  <span className="text-gray-700">|</span>
                  <span className="text-gray-500 text-xs">Day {log.day}</span>
                  {log.urgency && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full border ${
                        URGENCY_COLORS[log.urgency] || URGENCY_COLORS.medium
                      }`}
                    >
                      {log.urgency.toUpperCase()}
                    </span>
                  )}
                  {log.events_generated !== undefined && (
                    <span className="text-gray-600 text-xs">
                      {log.events_generated} event{log.events_generated !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Reasoning */}
                {log.reasoning && (
                  <p className="text-gray-300 text-xs leading-relaxed mb-1.5">
                    {log.reasoning}
                  </p>
                )}

                {/* Decision */}
                {log.decision && (
                  <p className="text-green-400/80 text-xs mb-1">
                    Decision: {log.decision}
                  </p>
                )}

                {/* Narrative arc */}
                {log.narrative_arc && (
                  <p className="text-purple-400/80 text-xs mb-1">
                    Arc: {log.narrative_arc}
                  </p>
                )}

                {/* Event titles */}
                {log.event_titles && log.event_titles.length > 0 && (
                  <div className="mt-1.5">
                    {log.event_titles.map((title, j) => (
                      <p key={j} className="text-amber-400/70 text-xs">
                        - {title}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
