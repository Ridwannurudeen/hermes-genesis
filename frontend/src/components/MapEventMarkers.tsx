import { useState, useEffect, useRef } from 'react';
import type { WorldEvent } from '../types';

interface Marker {
  id: string;
  type: string;
  x: number;
  y: number;
  timestamp: number;
}

const EVENT_MARKER_CONFIG: Record<string, { icon: string; color: string }> = {
  death: { icon: '\uD83D\uDC80', color: '#ef4444' },
  military_conflict: { icon: '\u2694\uFE0F', color: '#f59e0b' },
  alliance: { icon: '\uD83E\uDD1D', color: '#22c55e' },
  betrayal: { icon: '\uD83D\uDDE1\uFE0F', color: '#a855f7' },
  political_intrigue: { icon: '\uD83C\uDFAD', color: '#8b5cf6' },
  succession: { icon: '\uD83D\uDC51', color: '#D4A85F' },
  birth: { icon: '\u2728', color: '#60a5fa' },
  natural_disaster: { icon: '\uD83C\uDF0B', color: '#f97316' },
  discovery: { icon: '\uD83D\uDD0D', color: '#06b6d4' },
  cultural_shift: { icon: '\uD83C\uDF0A', color: '#14b8a6' },
};

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `${r},${g},${b}`;
}

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
        timestamp: Date.now(),
      };
      newMarkers.push(marker);

      const timer = setTimeout(() => {
        setMarkers((prev) => prev.filter((m) => m.id !== evt.id));
        timerRefs.current.delete(evt.id);
      }, 4500);
      timerRefs.current.set(evt.id, timer);
    }

    if (newMarkers.length > 0) {
      setMarkers((prev) => [...prev, ...newMarkers]);
    }
  }, [events, regionPositions]);

  useEffect(() => {
    return () => {
      timerRefs.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return (
    <g className="event-markers">
      <defs>
        {/* Blood splatter filter for death events — simplified glow */}
        <filter id="evt-blood-splatter" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Spark glow filter */}
        <filter id="evt-spark-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Dramatic glow for event icons */}
        <filter id="evt-icon-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {markers.map((marker) => {
        const config = EVENT_MARKER_CONFIG[marker.type] || { icon: '\u26A0\uFE0F', color: '#6b7280' };
        const rgb = hexToRgb(config.color);
        const isDeath = marker.type === 'death';
        const isMilitary = marker.type === 'military_conflict';

        return (
          <g key={marker.id}>
            {/* ===== SHOCKWAVE RING (all events) ===== */}
            {/* Outer expanding shockwave */}
            <circle
              cx={marker.x}
              cy={marker.y - 30}
              r={10}
              fill="none"
              stroke={config.color}
              strokeWidth={3}
              strokeOpacity={0}
            >
              <animate
                attributeName="r"
                values="8;55"
                dur="1.2s"
                fill="freeze"
              />
              <animate
                attributeName="stroke-opacity"
                values="0.7;0"
                dur="1.2s"
                fill="freeze"
              />
              <animate
                attributeName="stroke-width"
                values="3;0.5"
                dur="1.2s"
                fill="freeze"
              />
            </circle>

            {/* Inner shockwave (delayed) */}
            <circle
              cx={marker.x}
              cy={marker.y - 30}
              r={8}
              fill="none"
              stroke={config.color}
              strokeWidth={2}
              strokeOpacity={0}
            >
              <animate
                attributeName="r"
                values="6;40"
                dur="1s"
                begin="0.2s"
                fill="freeze"
              />
              <animate
                attributeName="stroke-opacity"
                values="0.5;0"
                dur="1s"
                begin="0.2s"
                fill="freeze"
              />
            </circle>

            {/* ===== DEATH EVENT: BLOOD SPLATTER ===== */}
            {isDeath && (
              <>
                {/* Expanding blood ring */}
                <circle
                  cx={marker.x}
                  cy={marker.y - 30}
                  r={8}
                  fill={`rgba(${rgb},0.3)`}
                  filter="url(#evt-blood-splatter)"
                >
                  <animate
                    attributeName="r"
                    values="4;35"
                    dur="0.8s"
                    fill="freeze"
                  />
                  <animate
                    attributeName="fill-opacity"
                    values="0.5;0"
                    dur="1.5s"
                    fill="freeze"
                  />
                </circle>

                {/* Blood drip particles */}
                {[0, 60, 120, 200, 280, 330].map((angle, ai) => {
                  const rad = (angle * Math.PI) / 180;
                  return (
                    <circle
                      key={`blood-${ai}`}
                      cx={marker.x}
                      cy={marker.y - 30}
                      r={2}
                      fill="#dc2626"
                      opacity={0}
                    >
                      <animate
                        attributeName="cx"
                        values={`${marker.x};${marker.x + Math.cos(rad) * (15 + ai * 3)}`}
                        dur="0.6s"
                        begin={`${ai * 0.05}s`}
                        fill="freeze"
                      />
                      <animate
                        attributeName="cy"
                        values={`${marker.y - 30};${marker.y - 30 + Math.sin(rad) * (15 + ai * 3)}`}
                        dur="0.6s"
                        begin={`${ai * 0.05}s`}
                        fill="freeze"
                      />
                      <animate
                        attributeName="opacity"
                        values="0;0.8;0"
                        dur="1s"
                        begin={`${ai * 0.05}s`}
                        fill="freeze"
                      />
                      <animate
                        attributeName="r"
                        values="2;1"
                        dur="1s"
                        begin={`${ai * 0.05}s`}
                        fill="freeze"
                      />
                    </circle>
                  );
                })}
              </>
            )}

            {/* ===== MILITARY CONFLICT: CROSSED SWORDS + SPARKS ===== */}
            {isMilitary && (
              <>
                {/* Crossed sword lines */}
                <g filter="url(#evt-spark-glow)">
                  <line
                    x1={marker.x - 14}
                    y1={marker.y - 44}
                    x2={marker.x + 14}
                    y2={marker.y - 16}
                    stroke="#D4A85F"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    opacity={0}
                  >
                    <animate
                      attributeName="opacity"
                      values="0;0.9;0.9;0"
                      dur="3s"
                      fill="freeze"
                    />
                  </line>
                  <line
                    x1={marker.x + 14}
                    y1={marker.y - 44}
                    x2={marker.x - 14}
                    y2={marker.y - 16}
                    stroke="#D4A85F"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    opacity={0}
                  >
                    <animate
                      attributeName="opacity"
                      values="0;0.9;0.9;0"
                      dur="3s"
                      fill="freeze"
                    />
                  </line>
                </g>

                {/* Spark particles flying outward from clash point */}
                {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, si) => {
                  const rad = (angle * Math.PI) / 180;
                  const dist = 12 + (si % 3) * 6;
                  return (
                    <g key={`spark-${si}`}>
                      {/* Spark dot */}
                      <circle
                        cx={marker.x}
                        cy={marker.y - 30}
                        r={1.5}
                        fill={si % 2 === 0 ? '#D4A85F' : '#FBF5E8'}
                        opacity={0}
                        filter="url(#evt-spark-glow)"
                      >
                        <animate
                          attributeName="cx"
                          values={`${marker.x};${marker.x + Math.cos(rad) * dist}`}
                          dur="0.5s"
                          begin={`${0.1 + si * 0.04}s`}
                          fill="freeze"
                        />
                        <animate
                          attributeName="cy"
                          values={`${marker.y - 30};${marker.y - 30 + Math.sin(rad) * dist}`}
                          dur="0.5s"
                          begin={`${0.1 + si * 0.04}s`}
                          fill="freeze"
                        />
                        <animate
                          attributeName="opacity"
                          values="0;1;0"
                          dur="0.7s"
                          begin={`${0.1 + si * 0.04}s`}
                          fill="freeze"
                        />
                        <animate
                          attributeName="r"
                          values="2;0.5"
                          dur="0.7s"
                          begin={`${0.1 + si * 0.04}s`}
                          fill="freeze"
                        />
                      </circle>

                      {/* Spark trail line */}
                      <line
                        x1={marker.x}
                        y1={marker.y - 30}
                        x2={marker.x}
                        y2={marker.y - 30}
                        stroke={si % 2 === 0 ? '#D4A85F' : '#FBF5E8'}
                        strokeWidth="1"
                        strokeLinecap="round"
                        opacity={0}
                      >
                        <animate
                          attributeName="x2"
                          values={`${marker.x};${marker.x + Math.cos(rad) * dist * 0.7}`}
                          dur="0.4s"
                          begin={`${0.1 + si * 0.04}s`}
                          fill="freeze"
                        />
                        <animate
                          attributeName="y2"
                          values={`${marker.y - 30};${marker.y - 30 + Math.sin(rad) * dist * 0.7}`}
                          dur="0.4s"
                          begin={`${0.1 + si * 0.04}s`}
                          fill="freeze"
                        />
                        <animate
                          attributeName="opacity"
                          values="0;0.8;0"
                          dur="0.5s"
                          begin={`${0.1 + si * 0.04}s`}
                          fill="freeze"
                        />
                      </line>
                    </g>
                  );
                })}

                {/* Clash flash at center */}
                <circle
                  cx={marker.x}
                  cy={marker.y - 30}
                  r={3}
                  fill="#fef3c7"
                  opacity={0}
                  filter="url(#evt-spark-glow)"
                >
                  <animate
                    attributeName="r"
                    values="2;12;4"
                    dur="0.4s"
                    fill="freeze"
                  />
                  <animate
                    attributeName="opacity"
                    values="0;0.9;0"
                    dur="0.5s"
                    fill="freeze"
                  />
                </circle>
              </>
            )}

            {/* ===== MAIN PULSING AURA ===== */}
            <circle
              cx={marker.x}
              cy={marker.y - 30}
              r={16}
              fill={`rgba(${rgb},0.2)`}
              stroke={config.color}
              strokeWidth={1.5}
              strokeOpacity={0.5}
            >
              <animate
                attributeName="r"
                values="16;24;16"
                dur="1.8s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="fill-opacity"
                values="0.2;0.05;0.2"
                dur="1.8s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="stroke-opacity"
                values="0.5;0.15;0.5"
                dur="1.8s"
                repeatCount="indefinite"
              />
            </circle>

            {/* Inner bright core */}
            <circle
              cx={marker.x}
              cy={marker.y - 30}
              r={8}
              fill={`rgba(${rgb},0.3)`}
            >
              <animate
                attributeName="r"
                values="8;11;8"
                dur="1.8s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="fill-opacity"
                values="0.3;0.12;0.3"
                dur="1.8s"
                repeatCount="indefinite"
              />
            </circle>

            {/* Icon with glow */}
            <text
              x={marker.x}
              y={marker.y - 28}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="20"
              style={{ pointerEvents: 'none' }}
              filter="url(#evt-icon-glow)"
            >
              {config.icon}
            </text>

            {/* ===== AMBIENT PARTICLES (all event types) ===== */}
            {[0, 72, 144, 216, 288].map((angle, pi) => {
              const rad = (angle * Math.PI) / 180;
              const floatDist = 18 + pi * 3;
              return (
                <circle
                  key={`particle-${pi}`}
                  cx={marker.x}
                  cy={marker.y - 30}
                  r={1}
                  fill={config.color}
                  opacity={0}
                >
                  <animate
                    attributeName="cx"
                    values={`${marker.x + Math.cos(rad) * 5};${marker.x + Math.cos(rad) * floatDist}`}
                    dur="3s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="cy"
                    values={`${marker.y - 30 + Math.sin(rad) * 5};${marker.y - 30 + Math.sin(rad) * floatDist - 8}`}
                    dur="3s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0;0.6;0"
                    dur="3s"
                    repeatCount="indefinite"
                    begin={`${pi * 0.3}s`}
                  />
                  <animate
                    attributeName="r"
                    values="1.2;0.3"
                    dur="3s"
                    repeatCount="indefinite"
                  />
                </circle>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}
