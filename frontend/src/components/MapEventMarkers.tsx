import { useState, useEffect, useRef } from 'react';
import type { WorldEvent } from '../types';

interface Marker {
  id: string;
  type: string;
  x: number;
  y: number;
}

const EVENT_MARKER_CONFIG: Record<string, { icon: string; color: string }> = {
  death: { icon: '\uD83D\uDC80', color: '#ef4444' },
  military_conflict: { icon: '\u2694\uFE0F', color: '#f59e0b' },
  alliance: { icon: '\uD83E\uDD1D', color: '#22c55e' },
  betrayal: { icon: '\uD83D\uDDE1\uFE0F', color: '#a855f7' },
  political_intrigue: { icon: '\uD83C\uDFAD', color: '#8b5cf6' },
  succession: { icon: '\uD83D\uDC51', color: '#fbbf24' },
  birth: { icon: '\u2728', color: '#60a5fa' },
  natural_disaster: { icon: '\uD83C\uDF0B', color: '#f97316' },
  discovery: { icon: '\uD83D\uDD0D', color: '#06b6d4' },
  cultural_shift: { icon: '\uD83C\uDF0A', color: '#14b8a6' },
};

interface Props {
  events: WorldEvent[];
  regionPositions: Record<string, { x: number; y: number }>;
}

export default function MapEventMarkers({ events, regionPositions }: Props) {
  const [markers, setMarkers] = useState<Marker[]>([]);
  const prevCountRef = useRef(events.length);
  const timerRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const prevCount = prevCountRef.current;
    if (events.length <= prevCount) {
      prevCountRef.current = events.length;
      return;
    }

    // Get new events
    const newEvents = events.slice(prevCount);
    prevCountRef.current = events.length;

    const newMarkers: Marker[] = [];
    for (const evt of newEvents) {
      const regionId = evt.regions_affected?.[0];
      const pos = regionId ? regionPositions[regionId] : null;
      if (!pos) continue;

      const marker: Marker = {
        id: evt.id,
        type: evt.type,
        x: pos.x,
        y: pos.y,
      };
      newMarkers.push(marker);

      // Auto-remove after 3.5 seconds
      const timer = setTimeout(() => {
        setMarkers((prev) => prev.filter((m) => m.id !== evt.id));
        timerRefs.current.delete(evt.id);
      }, 3500);
      timerRefs.current.set(evt.id, timer);
    }

    if (newMarkers.length > 0) {
      setMarkers((prev) => [...prev, ...newMarkers]);
    }

    return () => {
      // Don't clear timers on re-render, only on unmount
    };
  }, [events, regionPositions]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      timerRefs.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return (
    <g className="event-markers">
      {markers.map((marker) => {
        const config = EVENT_MARKER_CONFIG[marker.type] || { icon: '\u26A0\uFE0F', color: '#6b7280' };
        return (
          <g key={marker.id}>
            {/* Pulsing ring */}
            <circle
              cx={marker.x}
              cy={marker.y - 30}
              r={16}
              fill={config.color}
              fillOpacity={0.25}
              stroke={config.color}
              strokeWidth={1.5}
              strokeOpacity={0.6}
            >
              <animate
                attributeName="r"
                values="16;24;16"
                dur="1.5s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="fill-opacity"
                values="0.25;0.08;0.25"
                dur="1.5s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="stroke-opacity"
                values="0.6;0.2;0.6"
                dur="1.5s"
                repeatCount="indefinite"
              />
            </circle>
            {/* Icon */}
            <text
              x={marker.x}
              y={marker.y - 28}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="18"
              style={{ pointerEvents: 'none' }}
            >
              {config.icon}
            </text>
            {/* Fade-in animation using CSS opacity */}
            <circle
              cx={marker.x}
              cy={marker.y - 30}
              r={22}
              fill="none"
              stroke={config.color}
              strokeWidth={2}
              strokeOpacity={0}
            >
              <animate
                attributeName="r"
                values="10;30"
                dur="0.5s"
                fill="freeze"
              />
              <animate
                attributeName="stroke-opacity"
                values="0.8;0"
                dur="0.5s"
                fill="freeze"
              />
            </circle>
          </g>
        );
      })}
    </g>
  );
}
