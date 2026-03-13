import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Flame, Brain, Link2 } from 'lucide-react';
import type { WorldEvent, Faction, Character } from '../types';
import { EVENT_TYPE_ICONS } from '../types';

interface Props {
  event: WorldEvent;
  factions: Faction[];
  characters: Character[];
  eventMap?: Record<string, WorldEvent>;
}

export default function EventCard({ event, factions, characters, eventMap }: Props) {
  const [expanded, setExpanded] = useState(false);

  const factionMap: Record<string, Faction> = {};
  factions.forEach((f) => {
    factionMap[f.id] = f;
  });

  const charMap: Record<string, Character> = {};
  characters.forEach((c) => {
    charMap[c.id] = c;
  });

  const icon = EVENT_TYPE_ICONS[event.type] || '\u26A0\uFE0F';
  const hasOutcomeDetails =
    Object.keys(event.outcome.territory_changes).length > 0 ||
    Object.keys(event.outcome.casualties).length > 0 ||
    Object.keys(event.outcome.morale_changes).length > 0 ||
    event.outcome.character_effects.length > 0;

  const isAgentTriggered = event.agent_triggered;
  const hasCausedBy = event.caused_by && event.caused_by.length > 0;
  const isProphecyFulfilled =
    (event.prophecy_id && event.prophecy_id.length > 0) ||
    event.type === 'prophecy_fulfilled';

  const parentEvent = hasCausedBy && eventMap ? eventMap[event.caused_by] : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className={`relative rounded-xl p-4 transition-colors ${
        event.type === 'death' && event.obituary
          ? 'bg-red-950/30 border border-red-900/40 hover:border-red-800/50'
          : 'bg-gray-900 border border-gray-800 hover:border-gray-700'
      } ${hasCausedBy ? 'border-l-2 border-l-amber-500/50' : ''}`}
    >
      {/* Agent Intervention Badge - top right */}
      {isAgentTriggered && (
        <div className="absolute top-2 right-2 z-10">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <Brain className="w-3 h-3" />
            World Master
          </span>
        </div>
      )}

      {/* Prophecy Fulfilled Badge - top right, offset below agent badge if both present */}
      {isProphecyFulfilled && (
        <div className={`absolute ${isAgentTriggered ? 'top-8' : 'top-2'} right-2 z-10`}>
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40"
            style={{ boxShadow: '0 0 12px rgba(245, 158, 11, 0.25), 0 0 4px rgba(245, 158, 11, 0.15)' }}
          >
            {'\uD83D\uDD2E'} Prophecy Fulfilled
          </span>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-start gap-3">
        <span className="text-xl mt-0.5 flex-shrink-0">{icon}</span>
        <div className={`flex-1 min-w-0 ${isAgentTriggered || isProphecyFulfilled ? 'pr-28' : ''}`}>
          {/* Caused-By Link */}
          {hasCausedBy && (
            <div className="flex items-center gap-1 mb-1">
              <Link2 className="w-3 h-3 text-amber-400/60 flex-shrink-0" />
              <span className="text-[11px] text-amber-400/60 italic truncate">
                Triggered by: {parentEvent ? parentEvent.title : event.caused_by}
              </span>
            </div>
          )}

          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-semibold text-gray-100">
              {event.title}
            </h4>
            <span className="text-xs text-gray-600 uppercase tracking-wider flex-shrink-0 whitespace-nowrap">
              {event.type.replace(/_/g, ' ')}
            </span>
          </div>

          {/* Narrative */}
          {event.narrative && (
            <p className="text-sm text-gray-400 mt-2 leading-relaxed">
              {event.narrative}
            </p>
          )}

          {/* Memorial obituary */}
          {event.type === 'death' && event.obituary && (
            <div className="mt-3 p-3 bg-red-950/20 border border-red-900/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">
                  In Memoriam
                </span>
              </div>
              <p className="text-sm text-gray-300 italic leading-relaxed">
                {event.obituary}
              </p>
            </div>
          )}

          {/* Actors */}
          {event.actors.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {event.actors.map((actorId, i) => {
                const actor = charMap[actorId];
                return (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-gray-800 text-gray-300 rounded text-xs"
                  >
                    {actor ? actor.name : actorId}
                  </span>
                );
              })}
            </div>
          )}

          {/* Faction badges */}
          {event.factions_involved.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {event.factions_involved.map((fid, i) => {
                const f = factionMap[fid];
                return (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded text-xs font-medium border"
                    style={{
                      color: f?.color || '#9ca3af',
                      borderColor: f?.color
                        ? `${f.color}40`
                        : '#374151',
                      backgroundColor: f?.color
                        ? `${f.color}15`
                        : '#1f2937',
                    }}
                  >
                    {f?.name || fid}
                  </span>
                );
              })}
            </div>
          )}

          {/* Expandable outcome details */}
          {hasOutcomeDetails && (
            <div className="mt-3">
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                {expanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
                Outcome details
              </button>

              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 space-y-2 text-xs">
                      {/* Territory changes */}
                      {Object.keys(event.outcome.territory_changes).length >
                        0 && (
                        <div>
                          <span className="text-gray-500 uppercase tracking-wider font-medium">
                            Territory Changes
                          </span>
                          <div className="mt-1 space-y-0.5">
                            {Object.entries(
                              event.outcome.territory_changes
                            ).map(([region, newOwner]) => (
                              <p key={region} className="text-gray-400">
                                {region} &rarr;{' '}
                                {factionMap[newOwner]?.name || newOwner}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Casualties */}
                      {Object.keys(event.outcome.casualties).length > 0 && (
                        <div>
                          <span className="text-gray-500 uppercase tracking-wider font-medium">
                            Casualties
                          </span>
                          <div className="mt-1 space-y-0.5">
                            {Object.entries(event.outcome.casualties).map(
                              ([fid, count]) => (
                                <p key={fid} className="text-red-400">
                                  {factionMap[fid]?.name || fid}: {count}
                                </p>
                              )
                            )}
                          </div>
                        </div>
                      )}

                      {/* Morale changes */}
                      {Object.keys(event.outcome.morale_changes).length >
                        0 && (
                        <div>
                          <span className="text-gray-500 uppercase tracking-wider font-medium">
                            Morale Changes
                          </span>
                          <div className="mt-1 space-y-0.5">
                            {Object.entries(
                              event.outcome.morale_changes
                            ).map(([fid, change]) => (
                              <p
                                key={fid}
                                className={
                                  change > 0
                                    ? 'text-green-400'
                                    : 'text-red-400'
                                }
                              >
                                {factionMap[fid]?.name || fid}:{' '}
                                {change > 0 ? '+' : ''}
                                {Math.round(change * 100)}%
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Character effects */}
                      {event.outcome.character_effects.length > 0 && (
                        <div>
                          <span className="text-gray-500 uppercase tracking-wider font-medium">
                            Character Effects
                          </span>
                          <div className="mt-1 space-y-0.5">
                            {event.outcome.character_effects.map((ce, i) => {
                              const ch = charMap[ce.char_id];
                              return (
                                <p key={i} className="text-gray-400">
                                  {ch ? ch.name : ce.char_id}: {ce.effect}{' '}
                                  ({String(ce.value)})
                                </p>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
