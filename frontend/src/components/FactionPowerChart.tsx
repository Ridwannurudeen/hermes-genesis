import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { FactionSnapshot, Faction } from '../types';

interface Props {
  snapshots: FactionSnapshot[];
  factions: Faction[];
}

type Metric = 'territory_count' | 'population' | 'morale';

const METRICS: { key: Metric; label: string }[] = [
  { key: 'territory_count', label: 'Territory' },
  { key: 'population', label: 'Population' },
  { key: 'morale', label: 'Morale' },
];

export default function FactionPowerChart({ snapshots, factions }: Props) {
  const [metric, setMetric] = useState<Metric>('territory_count');

  const factionMap = useMemo(() => {
    const map: Record<string, Faction> = {};
    factions.forEach((f) => {
      map[f.id] = f;
    });
    return map;
  }, [factions]);

  // Pivot data: group by day, one entry per day with faction values as keys
  const chartData = useMemo(() => {
    const byDay: Record<number, Record<string, number>> = {};
    for (const snap of snapshots) {
      if (!byDay[snap.day]) {
        byDay[snap.day] = { day: snap.day };
      }
      const fName = factionMap[snap.faction_id]?.name || snap.faction_id;
      byDay[snap.day][fName] = snap[metric];
    }
    return Object.values(byDay).sort(
      (a, b) => (a.day as number) - (b.day as number)
    );
  }, [snapshots, factionMap, metric]);

  const factionNames = useMemo(
    () => factions.map((f) => ({ name: f.name, color: f.color })),
    [factions]
  );

  if (snapshots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <p className="text-lg font-medium">No timeline data yet</p>
        <p className="text-sm mt-1">
          Simulate some days to see faction power trends
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Metric toggles */}
      <div className="flex gap-2 mb-6">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              metric === m.key
                ? 'bg-genesis-600/20 border border-genesis-500/50 text-genesis-400'
                : 'bg-white/[0.03] border border-white/[0.06] text-gray-500 hover:text-gray-300 hover:border-white/[0.12]'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="day"
              stroke="#6b7280"
              tick={{ fontSize: 12 }}
              label={{
                value: 'Day',
                position: 'insideBottom',
                offset: -5,
                fill: '#6b7280',
              }}
            />
            <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#111827',
                border: '1px solid #374151',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ color: '#9ca3af' }}
            />
            <Legend
              formatter={(value: string) => (
                <span style={{ color: '#d1d5db', fontSize: '12px' }}>
                  {value}
                </span>
              )}
            />
            {factionNames.map((f) => (
              <Area
                key={f.name}
                type="monotone"
                dataKey={f.name}
                stackId="1"
                stroke={f.color}
                fill={f.color}
                fillOpacity={0.3}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
