import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts';
import type { Genome } from '../types';
import { GENOME_TRAITS, TRAIT_COLORS } from '../types';

interface Props {
  genome: Genome;
  fillColor?: string;
  size?: number;
}

export default function GenomeRadar({
  genome,
  fillColor = '#22d3ee',
  size = 250,
}: Props) {
  const data = GENOME_TRAITS.map((trait) => ({
    trait: trait.charAt(0).toUpperCase() + trait.slice(1),
    value: genome[trait],
    fullMark: 1,
  }));

  return (
    <ResponsiveContainer width="100%" height={size}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
        <PolarGrid stroke="#374151" />
        <PolarAngleAxis
          dataKey="trait"
          tick={{ fill: '#9ca3af', fontSize: 11 }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 1]}
          tick={{ fill: '#6b7280', fontSize: 9 }}
          tickCount={5}
        />
        <Radar
          name="Genome"
          dataKey="value"
          stroke={fillColor}
          fill={fillColor}
          fillOpacity={0.25}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function MiniGenomeBars({ genome }: { genome: Genome }) {
  return (
    <div className="space-y-1">
      {GENOME_TRAITS.map((trait) => (
        <div key={trait} className="flex items-center gap-1.5">
          <span className="text-[9px] text-gray-500 w-3 uppercase font-mono">
            {trait[0]}
          </span>
          <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max(2, genome[trait] * 100)}%`,
                backgroundColor: TRAIT_COLORS[trait],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
