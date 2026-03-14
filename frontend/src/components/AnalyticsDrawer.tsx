import { useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, ChevronRight, Shield, Users, Dna, TrendingUp, BarChart3 } from 'lucide-react';
import type { Faction, Character, EvolutionEntry, FactionSnapshot } from '../types';

const FactionDashboard = lazy(() => import('./FactionDashboard'));
const CharacterList = lazy(() => import('./CharacterList'));
const EvolutionView = lazy(() => import('./EvolutionView'));
const FactionPowerChart = lazy(() => import('./FactionPowerChart'));

interface Props {
  open: boolean;
  onClose: () => void;
  factions: Faction[];
  characters: Character[];
  evolution: EvolutionEntry[];
  factionTimeline: FactionSnapshot[];
  worldId: string;
}

type SectionKey = 'factions' | 'characters' | 'evolution' | 'power';

const SECTIONS: { key: SectionKey; label: string; icon: typeof Shield }[] = [
  { key: 'factions', label: 'Factions', icon: Shield },
  { key: 'characters', label: 'Characters', icon: Users },
  { key: 'evolution', label: 'Genome Evolution', icon: Dna },
  { key: 'power', label: 'Power Timeline', icon: TrendingUp },
];

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-800 rounded-lg ${className || ''}`} />;
}

export default function AnalyticsDrawer({
  open,
  onClose,
  factions,
  characters,
  evolution,
  factionTimeline,
  worldId,
}: Props) {
  const [expanded, setExpanded] = useState<SectionKey | null>('factions');

  const toggleSection = (key: SectionKey) => {
    setExpanded((prev) => (prev === key ? null : key));
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/30 z-40"
            onClick={onClose}
          />

          {/* Drawer panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 h-full z-50 flex flex-col bg-gray-950 border-l border-gray-800"
            style={{ width: 380 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 flex-shrink-0">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4.5 h-4.5 text-genesis-400" />
                <h2 className="text-sm font-semibold text-gray-200">Analytics</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Accordion sections */}
            <div className="flex-1 overflow-y-auto">
              {SECTIONS.map((section) => {
                const isExpanded = expanded === section.key;
                return (
                  <div key={section.key} className="border-b border-gray-800/60">
                    {/* Section header */}
                    <button
                      onClick={() => toggleSection(section.key)}
                      className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-900/50 transition-colors"
                    >
                      <section.icon className={`w-4 h-4 flex-shrink-0 ${isExpanded ? 'text-genesis-400' : 'text-gray-500'}`} />
                      <span className={`text-sm font-medium flex-1 ${isExpanded ? 'text-gray-200' : 'text-gray-400'}`}>
                        {section.label}
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                      )}
                    </button>

                    {/* Section content */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4">
                            {section.key === 'factions' && (
                              <Suspense fallback={<SkeletonBlock className="h-48" />}>
                                <FactionDashboard factions={factions} characters={characters} />
                              </Suspense>
                            )}
                            {section.key === 'characters' && (
                              <Suspense fallback={<SkeletonBlock className="h-48" />}>
                                <CharacterList characters={characters} factions={factions} worldId={worldId} />
                              </Suspense>
                            )}
                            {section.key === 'evolution' && (
                              <Suspense fallback={<SkeletonBlock className="h-48" />}>
                                <EvolutionView data={evolution} />
                              </Suspense>
                            )}
                            {section.key === 'power' && (
                              <Suspense fallback={<SkeletonBlock className="h-48" />}>
                                <FactionPowerChart snapshots={factionTimeline} factions={factions} />
                              </Suspense>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
