import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { EvolutionEntry } from '../types';
import { GENOME_TRAITS, TRAIT_COLORS } from '../types';

interface Props {
  data: EvolutionEntry[];
}

export default function EvolutionView({ data }: Props) {
  const [hiddenTraits, setHiddenTraits] = useState<Set<string>>(new Set());

  const toggleTrait = (trait: string) => {
    setHiddenTraits((prev) => {
      const next = new Set(prev);
      if (next.has(trait)) {
        next.delete(trait);
      } else {
        next.add(trait);
      }
      return next;
    });
  };

  const chartData = useMemo(() => {
    return data.map((entry) => ({
      generation: entry.generation,
      count: entry.count,
      courage: entry.courage,
      cunning: entry.cunning,
      loyalty: entry.loyalty,
      ambition: entry.ambition,
      empathy: entry.empathy,
      resilience: entry.resilience,
    }));
  }, [data]);

  if (data.length <= 1) {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-4">
        <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
          <svg
            className="w-8 h-8 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
            />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-1">
            Not enough data yet
          </p>
          <p className="text-gray-600 text-sm">
            Simulate more days to see how genome traits evolve across
            generations
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Trait toggles */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="text-xs text-gray-500 uppercase tracking-wider mr-2 font-medium">
          Traits
        </span>
        {GENOME_TRAITS.map((trait) => {
          const hidden = hiddenTraits.has(trait);
          return (
            <button
              key={trait}
              onClick={() => toggleTrait(trait)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                hidden
                  ? 'bg-white/[0.03] text-gray-600 border border-white/[0.06]'
                  : 'border text-gray-200'
              }`}
              style={
                !hidden
                  ? {
                      borderColor: `${TRAIT_COLORS[trait]}60`,
                      backgroundColor: `${TRAIT_COLORS[trait]}15`,
                    }
                  : undefined
              }
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  backgroundColor: hidden
                    ? '#543d1c'
                    : TRAIT_COLORS[trait],
                }}
              />
              <span className="capitalize">{trait}</span>
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
        <ResponsiveContainer width="100%" height={420}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a1f14" />
            <XAxis
              dataKey="generation"
              label={{
                value: 'Generation',
                position: 'insideBottom',
                offset: -5,
                fill: '#6b7280',
                fontSize: 12,
              }}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              stroke="#3d2c12"
            />
            <YAxis
              yAxisId="traits"
              domain={[0, 1]}
              label={{
                value: 'Trait Value',
                angle: -90,
                position: 'insideLeft',
                offset: 10,
                fill: '#6b7280',
                fontSize: 12,
              }}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              stroke="#3d2c12"
            />
            <YAxis
              yAxisId="count"
              orientation="right"
              label={{
                value: 'Population',
                angle: 90,
                position: 'insideRight',
                offset: 10,
                fill: '#6b7280',
                fontSize: 12,
              }}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              stroke="#3d2c12"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e1810',
                border: '1px solid #3d2c12',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ color: '#d1d5db', fontWeight: 'bold' }}
              itemStyle={{ padding: '2px 0' }}
              formatter={(value: number, name: string) => {
                if (name === 'count') return [value, 'Population'];
                return [value.toFixed(3), name.charAt(0).toUpperCase() + name.slice(1)];
              }}
              labelFormatter={(label) => `Generation ${label}`}
            />
            <Legend
              wrapperStyle={{ paddingTop: 10 }}
              formatter={(value: string) =>
                value === 'count'
                  ? 'Population'
                  : value.charAt(0).toUpperCase() + value.slice(1)
              }
            />

            {/* Trait lines */}
            {GENOME_TRAITS.map((trait) => (
              <Line
                key={trait}
                yAxisId="traits"
                type="monotone"
                dataKey={trait}
                stroke={TRAIT_COLORS[trait]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                hide={hiddenTraits.has(trait)}
              />
            ))}

            {/* Population count on secondary axis */}
            <Line
              yAxisId="count"
              type="monotone"
              dataKey="count"
              stroke="#6b7280"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary stats */}
      {data.length > 0 && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mt-6">
          {GENOME_TRAITS.map((trait) => {
            const latest = data[data.length - 1];
            const first = data[0];
            const diff = latest[trait] - first[trait];
            return (
              <div
                key={trait}
                className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 text-center"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full mx-auto mb-1.5"
                  style={{ backgroundColor: TRAIT_COLORS[trait] }}
                />
                <p className="text-xs text-gray-500 capitalize mb-0.5">
                  {trait}
                </p>
                <p className="text-lg font-mono font-bold text-gray-200">
                  {latest[trait].toFixed(2)}
                </p>
                <p
                  className={`text-xs font-mono ${
                    diff > 0
                      ? 'text-green-400'
                      : diff < 0
                      ? 'text-red-400'
                      : 'text-gray-500'
                  }`}
                >
                  {diff > 0 ? '+' : ''}
                  {diff.toFixed(3)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
