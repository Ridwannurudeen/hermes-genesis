import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Power, Loader2, AlertTriangle, Clock, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { api } from '../api';
import { EVENT_TYPE_ICONS } from '../types';

interface ConsequenceEvent {
  title: string;
  type: string;
}

interface Consequences {
  events: ConsequenceEvent[];
  territory_changes: Record<string, string>;
  morale_changes: Record<string, number>;
}

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
  consequences?: Consequences;
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to toggle agent');
      setTimeout(() => setError(null), 4000);
    } finally {
      setLoading(false);
    }
  }, [running, worldId, interval]);

  const formatTime = (ts: string) => {
    try {
      // Backend emits +00:00 ISO strings; don't append Z
      const d = new Date(ts.endsWith('Z') || ts.includes('+') ? ts : ts + 'Z');
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return ts;
    }
  };

  const [expandedConsequences, setExpandedConsequences] = useState<Record<number, boolean>>({});

  const toggleConsequences = (index: number) => {
    setExpandedConsequences((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const reversedLogs = [...logs].reverse();

  return (
    <div
      className={`bg-white/[0.02] backdrop-blur-sm rounded-xl overflow-hidden transition-all duration-500 ${
        running
          ? 'border-2 border-genesis-500/40 shadow-lg shadow-genesis-500/10'
          : 'border border-white/[0.06]'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Brain icon with pulsing ring when active */}
            <div className="relative">
              <div
                className={`p-2.5 rounded-xl transition-all duration-500 ${
                  running
                    ? 'bg-genesis-500/10 border border-genesis-500/30'
                    : 'bg-white/[0.04] border border-white/[0.08]'
                }`}
              >
                <Brain
                  className={`w-6 h-6 ${
                    running ? 'text-genesis-400' : 'text-gray-500'
                  }`}
                />
              </div>
              {running && (
                <motion.div
                  className="absolute inset-0 rounded-xl border-2 border-genesis-400/50"
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
                  <span className="text-genesis-400">WORLD MASTER ACTIVE</span>
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
                        ? 'bg-genesis-500/15 text-genesis-400 border border-genesis-500/30'
                        : 'text-gray-500 hover:text-gray-300 border border-white/[0.08] hover:border-white/[0.15]'
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
                  : 'bg-genesis-500/10 border border-genesis-500/30 text-genesis-400 hover:bg-genesis-500/20 hover:shadow-lg hover:shadow-genesis-500/10'
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
            className="mt-3 h-0.5 bg-gradient-to-r from-genesis-500/0 via-genesis-500/60 to-genesis-500/0 rounded-full origin-left"
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
          <div className="divide-y divide-white/[0.04]">
            {reversedLogs.map((log, i) => {
              const actionBadge = ACTION_BADGES[log.action] || ACTION_BADGES.simulate;
              return (
                <motion.div
                  key={`${log.timestamp}-${i}`}
                  initial={i === 0 ? { opacity: 0, y: -10 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 text-sm transition-colors hover:bg-white/[0.03] ${
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
                    <p className="text-genesis-400/80 text-xs mb-1">
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
                    <p className="text-genesis-300/70 text-xs mb-1">
                      <span className="text-gray-500 font-medium">Arc:</span>{' '}
                      {log.narrative_arc}
                    </p>
                  )}

                  {/* Intervention success/failure indicator */}
                  {log.action === 'intervene' && (
                    <div className="flex items-center gap-1.5 mt-2">
                      {log.events_generated > 0 ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400/80 text-xs font-medium">
                            Intervention succeeded — {log.events_generated} event{log.events_generated !== 1 ? 's' : ''} generated
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-amber-400/80 text-xs font-medium">
                            No events resulted from this intervention
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Intent → Action → Consequence strip */}
                  {(log.reasoning || log.decision || (log.event_titles && log.event_titles.length > 0)) && (
                    <div className="mt-2.5 flex items-center gap-1.5 flex-wrap text-[11px]">
                      {log.reasoning && (
                        <span className="px-2 py-0.5 rounded bg-genesis-800/60 text-gray-400 border border-gray-700/50 max-w-[200px] truncate" title={log.reasoning}>
                          Intent: {log.reasoning.split('.')[0]}
                        </span>
                      )}
                      {log.reasoning && (log.action || log.decision) && (
                        <ArrowRight className="w-3 h-3 text-gray-600 flex-shrink-0" />
                      )}
                      {log.action && (
                        <span className={`px-2 py-0.5 rounded border font-medium ${
                          log.action === 'intervene' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                          log.action === 'focus' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                          'bg-genesis-800/60 text-gray-400 border-gray-700/50'
                        }`}>
                          {log.action === 'intervene' ? 'Intervened' : log.action === 'focus' ? 'Focused' : 'Simulated'}
                        </span>
                      )}
                      {log.action && log.event_titles && log.event_titles.length > 0 && (
                        <ArrowRight className="w-3 h-3 text-gray-600 flex-shrink-0" />
                      )}
                      {log.event_titles && log.event_titles.length > 0 && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          {log.event_titles.length} event{log.event_titles.length !== 1 ? 's' : ''} resulted
                        </span>
                      )}
                    </div>
                  )}

                  {/* Event titles */}
                  {log.event_titles && log.event_titles.length > 0 && (
                    <div className="mt-2 pl-2 border-l border-genesis-800">
                      {log.event_titles.map((title, j) => (
                        <p key={j} className="text-amber-400/60 text-xs">
                          {title}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Consequences section */}
                  {log.consequences && log.consequences.events && log.consequences.events.length > 0 && (
                    <div className="mt-2">
                      <button
                        onClick={() => toggleConsequences(i)}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        {expandedConsequences[i] ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                        <span className="font-medium">
                          Results: {log.consequences.events.length} event{log.consequences.events.length !== 1 ? 's' : ''} triggered
                        </span>
                      </button>

                      <AnimatePresence>
                        {expandedConsequences[i] && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-1.5 pl-2 border-l border-genesis-500/30 space-y-1">
                              {log.consequences.events.map((ce, k) => (
                                <p key={k} className="text-xs text-gray-400">
                                  <span className="mr-1">{EVENT_TYPE_ICONS[ce.type] || '\u26A0\uFE0F'}</span>
                                  {ce.title}
                                </p>
                              ))}

                              {/* Territory changes from consequences */}
                              {log.consequences.territory_changes && Object.keys(log.consequences.territory_changes).length > 0 && (
                                <div className="mt-1 pt-1 border-t border-genesis-800/50">
                                  <span className="text-[10px] text-gray-600 uppercase tracking-wider font-medium">Territory</span>
                                  {Object.entries(log.consequences.territory_changes).map(([region, owner]) => (
                                    <p key={region} className="text-xs text-gray-500">
                                      {region} &rarr; {owner}
                                    </p>
                                  ))}
                                </div>
                              )}

                              {/* Morale changes from consequences */}
                              {log.consequences.morale_changes && Object.keys(log.consequences.morale_changes).length > 0 && (
                                <div className="mt-1 pt-1 border-t border-genesis-800/50">
                                  <span className="text-[10px] text-gray-600 uppercase tracking-wider font-medium">Morale</span>
                                  {Object.entries(log.consequences.morale_changes).map(([fid, change]) => (
                                    <p
                                      key={fid}
                                      className={`text-xs ${change > 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}
                                    >
                                      {fid}: {change > 0 ? '+' : ''}{change}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
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
