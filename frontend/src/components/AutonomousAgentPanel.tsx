import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Power, Loader2, AlertTriangle, Clock } from 'lucide-react';
import { api } from '../api';

interface AgentLog {
  timestamp: string;
  day: number;
  reasoning: string;
  decision: string;
  action: string;
  intervention_command: string | null;
  focus_faction: string | null;
  focus_character: string | null;
  narrative_arc: string;
  urgency: string;
  events_generated: number;
  event_titles: string[];
}

interface Props {
  worldId: string;
  onRefresh: () => void;
}

const URGENCY_COLORS: Record<string, string> = {
  low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  high: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const ACTION_BADGES: Record<string, { label: string; className: string }> = {
  simulate: {
    label: 'SIMULATE',
    className: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  },
  intervene: {
    label: 'INTERVENE',
    className: 'bg-red-500/15 text-red-400 border-red-500/30',
  },
  focus: {
    label: 'FOCUS',
    className: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  },
};

const INTERVAL_OPTIONS = [
  { label: '1 min', value: 60 },
  { label: '2 min', value: 120 },
  { label: '5 min', value: 300 },
];

export default function AutonomousAgentPanel({ worldId, onRefresh }: Props) {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interval, setInterval_] = useState(120);
  const statusPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll status + logs every 5 seconds when panel is visible
  useEffect(() => {
    const poll = async () => {
      try {
        const status = await api.getAgentStatus(worldId);
        setRunning(status.running);
        if (status.log_count > 0) {
          const agentLogs = await api.getAgentLogs(worldId);
          setLogs(agentLogs);
        }
      } catch {
        // silently ignore poll errors
      }
    };

    poll(); // immediate
    statusPollRef.current = globalThis.setInterval(poll, 5000);

    return () => {
      if (statusPollRef.current) {
        clearInterval(statusPollRef.current);
        statusPollRef.current = null;
      }
    };
  }, [worldId]);

  // Auto-refresh world data every 30 seconds when agent is active
  useEffect(() => {
    if (!running) {
      if (refreshPollRef.current) {
        clearInterval(refreshPollRef.current);
        refreshPollRef.current = null;
      }
      return;
    }

    refreshPollRef.current = globalThis.setInterval(onRefresh, 30000);

    return () => {
      if (refreshPollRef.current) {
        clearInterval(refreshPollRef.current);
        refreshPollRef.current = null;
      }
    };
  }, [running, onRefresh]);

  const handleToggle = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (running) {
        await api.stopAgent(worldId);
        setRunning(false);
      } else {
        await api.startAgent(worldId, interval);
        setRunning(true);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to toggle agent');
      setTimeout(() => setError(null), 4000);
    } finally {
      setLoading(false);
    }
  }, [running, worldId, interval]);

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts + 'Z');
      return d.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return ts;
    }
  };

  const reversedLogs = [...logs].reverse();

  return (
    <div
      className={`bg-gray-950 rounded-xl overflow-hidden transition-all duration-500 ${
        running
          ? 'border-2 border-cyan-500/40 shadow-lg shadow-cyan-500/10'
          : 'border border-gray-800'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Brain icon with pulsing ring when active */}
            <div className="relative">
              <div
                className={`p-2.5 rounded-xl transition-all duration-500 ${
                  running
                    ? 'bg-cyan-500/10 border border-cyan-500/30'
                    : 'bg-gray-800/80 border border-gray-700'
                }`}
              >
                <Brain
                  className={`w-6 h-6 ${
                    running ? 'text-cyan-400' : 'text-gray-500'
                  }`}
                />
              </div>
              {running && (
                <motion.div
                  className="absolute inset-0 rounded-xl border-2 border-cyan-400/50"
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.5, 0, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wide">
                {running ? (
                  <span className="text-cyan-400">WORLD MASTER ACTIVE</span>
                ) : (
                  <span className="text-gray-300">World Master Agent</span>
                )}
              </h3>
              <p className="text-xs text-gray-500">
                {running
                  ? 'Autonomous narrative intelligence is governing this world'
                  : 'Activate to let AI govern this world autonomously'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Interval selector (only when not running) */}
            {!running && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gray-500" />
                {INTERVAL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setInterval_(opt.value)}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      interval === opt.value
                        ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                        : 'text-gray-500 hover:text-gray-300 border border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {/* Toggle button */}
            <button
              onClick={handleToggle}
              disabled={loading}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
                running
                  ? 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20'
                  : 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:shadow-lg hover:shadow-cyan-500/10'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Power className="w-4 h-4" />
              )}
              {running ? 'DEACTIVATE' : 'ACTIVATE WORLD MASTER'}
            </button>
          </div>
        </div>

        {/* Active gradient bar */}
        {running && (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            className="mt-3 h-0.5 bg-gradient-to-r from-cyan-500/0 via-cyan-500/60 to-cyan-500/0 rounded-full origin-left"
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

      {/* Activity Log */}
      <div className="max-h-[420px] overflow-y-auto">
        {reversedLogs.length === 0 ? (
          <div className="p-8 text-center">
            <Brain className="w-8 h-8 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-600 text-sm">
              {running
                ? 'Waiting for first agent cycle...'
                : 'Activate the World Master to see its reasoning and decisions here.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/40">
            {reversedLogs.map((log, i) => {
              const actionBadge = ACTION_BADGES[log.action] || ACTION_BADGES.simulate;
              return (
                <motion.div
                  key={`${log.timestamp}-${i}`}
                  initial={i === 0 ? { opacity: 0, y: -10 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 text-sm transition-colors hover:bg-gray-900/50 ${
                    log.action === 'intervene'
                      ? 'border-l-2 border-l-red-500/60'
                      : log.action === 'focus'
                      ? 'border-l-2 border-l-blue-500/50'
                      : log.urgency === 'high'
                      ? 'border-l-2 border-l-amber-500/40'
                      : log.urgency === 'low'
                      ? 'border-l-2 border-l-emerald-500/30'
                      : ''
                  }`}
                >
                  {/* Header row */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-gray-600 text-xs font-mono">
                      {formatTime(log.timestamp)}
                    </span>
                    <span className="text-gray-800">|</span>
                    <span className="text-gray-500 text-xs font-medium">
                      Day {log.day}
                    </span>

                    {/* Action badge */}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider ${actionBadge.className}`}
                    >
                      {actionBadge.label}
                    </span>

                    {/* Urgency badge */}
                    {log.urgency && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold uppercase tracking-wider ${
                          URGENCY_COLORS[log.urgency] || URGENCY_COLORS.medium
                        }`}
                      >
                        {log.urgency}
                      </span>
                    )}

                    {log.events_generated !== undefined && (
                      <span className="text-gray-600 text-xs ml-auto">
                        {log.events_generated} event
                        {log.events_generated !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Reasoning */}
                  {log.reasoning && (
                    <p className="text-gray-300 text-xs leading-relaxed mb-2">
                      {log.reasoning}
                    </p>
                  )}

                  {/* Decision */}
                  {log.decision && (
                    <p className="text-cyan-400/80 text-xs mb-1">
                      <span className="text-gray-500 font-medium">Decision:</span>{' '}
                      {log.decision}
                    </p>
                  )}

                  {/* Intervention command (only for intervene actions) */}
                  {log.action === 'intervene' && log.intervention_command && (
                    <p className="text-red-400/70 text-xs mb-1">
                      <span className="text-gray-500 font-medium">Command:</span>{' '}
                      <span className="italic">{log.intervention_command}</span>
                    </p>
                  )}

                  {/* Focus target (only for focus actions) */}
                  {log.action === 'focus' && (log.focus_faction || log.focus_character) && (
                    <p className="text-blue-400/70 text-xs mb-1">
                      <span className="text-gray-500 font-medium">Focus:</span>{' '}
                      {log.focus_faction && (
                        <span>Faction: {log.focus_faction}</span>
                      )}
                      {log.focus_faction && log.focus_character && ' / '}
                      {log.focus_character && (
                        <span>Character: {log.focus_character}</span>
                      )}
                    </p>
                  )}

                  {/* Narrative arc */}
                  {log.narrative_arc && (
                    <p className="text-purple-400/70 text-xs mb-1">
                      <span className="text-gray-500 font-medium">Arc:</span>{' '}
                      {log.narrative_arc}
                    </p>
                  )}

                  {/* Event titles */}
                  {log.event_titles && log.event_titles.length > 0 && (
                    <div className="mt-2 pl-2 border-l border-gray-800">
                      {log.event_titles.map((title, j) => (
                        <p key={j} className="text-amber-400/60 text-xs">
                          {title}
                        </p>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
