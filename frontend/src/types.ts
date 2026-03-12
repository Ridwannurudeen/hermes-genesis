export interface Genome {
  courage: number;
  cunning: number;
  loyalty: number;
  ambition: number;
  empathy: number;
  resilience: number;
}

export interface PointOfInterest {
  name: string;
  type: string;
  significance: string;
}

export interface Region {
  id: string;
  name: string;
  type: string;
  climate: string;
  resources: string[];
  controlled_by: string | null;
  neighbors: string[];
  points_of_interest: PointOfInterest[];
  x: number;
  y: number;
  description: string;
}

export interface Connection {
  from_region: string;
  to_region: string;
  type: string;
  control: string;
}

export interface Geography {
  regions: Region[];
  connections: Connection[];
}

export interface Faction {
  id: string;
  name: string;
  ideology: string;
  color: string;
  leader_id: string;
  territory: string[];
  resources: Record<string, number>;
  alliances: string[];
  enemies: string[];
  population: number;
  morale: number;
  traits: string[];
  description: string;
}

export interface Relationship {
  target_id: string;
  type: string;
  intensity: number;
}

export interface Lineage {
  parent_ids: string[];
  generation: number;
  mutations: string[];
}

export interface Character {
  id: string;
  name: string;
  faction_id: string;
  role: string;
  age: number;
  alive: boolean;
  location: string;
  backstory: string;
  goals: string[];
  relationships: Relationship[];
  genome: Genome;
  lineage: Lineage;
  fitness: number;
}

export interface CharacterEffect {
  char_id: string;
  effect: string;
  value: number | boolean | string;
}

export interface EventOutcome {
  territory_changes: Record<string, string>;
  casualties: Record<string, number>;
  morale_changes: Record<string, number>;
  resource_changes: Record<string, Record<string, number>>;
  character_effects: CharacterEffect[];
}

export interface WorldEvent {
  id: string;
  day: number;
  type: string;
  title: string;
  description: string;
  actors: string[];
  factions_involved: string[];
  regions_affected: string[];
  outcome: EventOutcome;
  narrative: string;
}

export interface World {
  id: string;
  name: string;
  seed: string;
  theme: string;
  created_at: string;
  current_day: number;
  geography: Geography;
  factions: Faction[];
  characters: Character[];
  events: WorldEvent[];
  status: string;
}

export interface WorldSummary {
  id: string;
  name: string;
  seed: string;
  theme: string;
  current_day: number;
  status: string;
  created_at: string;
}

export interface EvolutionEntry {
  generation: number;
  count: number;
  courage: number;
  cunning: number;
  loyalty: number;
  ambition: number;
  empathy: number;
  resilience: number;
}

export const GENOME_TRAITS = [
  'courage',
  'cunning',
  'loyalty',
  'ambition',
  'empathy',
  'resilience',
] as const;

export const TRAIT_COLORS: Record<string, string> = {
  courage: '#ef4444',
  cunning: '#a855f7',
  loyalty: '#3b82f6',
  ambition: '#f59e0b',
  empathy: '#ec4899',
  resilience: '#22c55e',
};

export const EVENT_TYPE_ICONS: Record<string, string> = {
  military_conflict: '\u2694\uFE0F',
  political_intrigue: '\uD83C\uDFAD',
  betrayal: '\uD83D\uDDE1\uFE0F',
  alliance: '\uD83E\uDD1D',
  discovery: '\uD83D\uDD0D',
  succession: '\uD83D\uDC51',
  cultural_shift: '\uD83C\uDF0A',
  natural_disaster: '\uD83C\uDF0B',
  death: '\uD83D\uDC80',
  birth: '\u2728',
};
