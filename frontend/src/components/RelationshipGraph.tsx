import { useRef, useEffect, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import type { Character, Faction } from '../types';

interface Props {
  characters: Character[];
  factions: Faction[];
  onSelectCharacter: (char: Character) => void;
}

/* ── relationship type colours ──────────────────────────────── */
const REL_COLORS: Record<string, string> = {
  enemy: '#ef4444',
  rival: '#ef4444',
  ally: '#22c55e',
  friend: '#22c55e',
  love: '#ec4899',
  family: '#ec4899',
  mentor: '#9ca3af',
  protege: '#9ca3af',
};

const LEGEND_ENTRIES: { label: string; color: string }[] = [
  { label: 'Enemy / Rival', color: '#ef4444' },
  { label: 'Ally / Friend', color: '#22c55e' },
  { label: 'Love / Family', color: '#ec4899' },
  { label: 'Mentor / Protege', color: '#9ca3af' },
];

/* ── D3 simulation types ────────────────────────────────────── */
interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  factionId: string;
  fitness: number;
  color: string;
  radius: number;
  character: Character;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  type: string;
  intensity: number;
}

function relColor(type: string): string {
  return REL_COLORS[type.toLowerCase()] || '#6b7280';
}

export default function RelationshipGraph({
  characters,
  factions,
  onSelectCharacter,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const simRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);

  /* faction id → colour lookup */
  const factionColorMap = useMemo(() => {
    const m: Record<string, string> = {};
    factions.forEach((f) => {
      m[f.id] = f.color;
    });
    return m;
  }, [factions]);

  /* alive characters only → build nodes */
  const aliveChars = useMemo(
    () => characters.filter((c) => c.alive),
    [characters],
  );

  /* build link key for dedup */
  const linkKey = (a: string, b: string) =>
    a < b ? `${a}::${b}` : `${b}::${a}`;

  /* stable click handler */
  const handleNodeClick = useCallback(
    (char: Character) => {
      onSelectCharacter(char);
    },
    [onSelectCharacter],
  );

  /* ── D3 setup effect ──────────────────────────────────────── */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    /* clear previous render */
    const root = d3.select(svg);
    root.selectAll('*').remove();

    /* build nodes */
    const aliveIds = new Set(aliveChars.map((c) => c.id));
    const nodes: SimNode[] = aliveChars.map((c) => ({
      id: c.id,
      name: c.name,
      factionId: c.faction_id,
      fitness: c.fitness,
      color: factionColorMap[c.faction_id] || '#6b7280',
      radius: 10 + c.fitness * 15, // 10-25 range
      character: c,
    }));

    /* build links – deduplicate bidirectional */
    const seen = new Set<string>();
    const links: SimLink[] = [];

    aliveChars.forEach((c) => {
      c.relationships.forEach((rel) => {
        if (!aliveIds.has(rel.target_id)) return;
        const key = linkKey(c.id, rel.target_id);
        if (seen.has(key)) return;
        seen.add(key);
        links.push({
          source: c.id,
          target: rel.target_id,
          type: rel.type,
          intensity: rel.intensity,
        });
      });
    });

    if (nodes.length === 0) return;

    /* get actual SVG dimensions */
    const rect = svg.getBoundingClientRect();
    const width = rect.width || 800;
    const height = rect.height || 600;

    /* defs: filters */
    const defs = root.append('defs');
    const glow = defs.append('filter').attr('id', 'node-glow');
    glow
      .append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'blur');
    glow
      .append('feComposite')
      .attr('in', 'SourceGraphic')
      .attr('in2', 'blur')
      .attr('operator', 'over');

    /* groups */
    const linkGroup = root.append('g').attr('class', 'links');
    const nodeGroup = root.append('g').attr('class', 'nodes');
    const labelGroup = root.append('g').attr('class', 'labels');

    /* draw links */
    const linkSelection = linkGroup
      .selectAll<SVGLineElement, SimLink>('line')
      .data(links)
      .join('line')
      .attr('stroke', (d) => relColor(d.type))
      .attr('stroke-width', (d) => d.intensity * 3)
      .attr('stroke-dasharray', (d) => (d.intensity < 0.5 ? '4 3' : 'none'))
      .attr('stroke-opacity', 0.6);

    /* draw nodes */
    const nodeSelection = nodeGroup
      .selectAll<SVGCircleElement, SimNode>('circle')
      .data(nodes, (d) => d.id)
      .join('circle')
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => d.color)
      .attr('fill-opacity', 0.25)
      .attr('stroke', (d) => d.color)
      .attr('stroke-width', 2)
      .attr('cursor', 'pointer')
      .attr('filter', 'url(#node-glow)');

    /* draw labels */
    const labelSelection = labelGroup
      .selectAll<SVGTextElement, SimNode>('text')
      .data(nodes, (d) => d.id)
      .join('text')
      .text((d) => d.name)
      .attr('font-size', 11)
      .attr('fill', '#9ca3af')
      .attr('text-anchor', 'middle')
      .attr('pointer-events', 'none')
      .attr('dy', (d) => d.radius + 14);

    /* hover interaction */
    const connectedNodeIds = (nodeId: string): Set<string> => {
      const s = new Set<string>();
      links.forEach((l) => {
        const src = typeof l.source === 'object' ? (l.source as SimNode).id : String(l.source);
        const tgt = typeof l.target === 'object' ? (l.target as SimNode).id : String(l.target);
        if (src === nodeId) s.add(tgt);
        if (tgt === nodeId) s.add(src);
      });
      return s;
    };

    nodeSelection
      .on('mouseenter', function (_event, d) {
        const connected = connectedNodeIds(d.id);
        connected.add(d.id);

        nodeSelection.attr('opacity', (n) =>
          connected.has(n.id) ? 1 : 0.15,
        );
        linkSelection.attr('opacity', (l) => {
          const src = typeof l.source === 'object' ? (l.source as SimNode).id : String(l.source);
          const tgt = typeof l.target === 'object' ? (l.target as SimNode).id : String(l.target);
          return src === d.id || tgt === d.id ? 1 : 0.08;
        });
        labelSelection.attr('opacity', (n) =>
          connected.has(n.id) ? 1 : 0.15,
        );

        /* enlarge hovered node */
        d3.select(this).attr('r', d.radius + 4);
      })
      .on('mouseleave', function (_event, d) {
        nodeSelection.attr('opacity', 1);
        linkSelection.attr('opacity', 1);
        labelSelection.attr('opacity', 1);
        d3.select(this).attr('r', d.radius);
      })
      .on('click', (_event, d) => {
        handleNodeClick(d.character);
      });

    /* drag behaviour */
    const drag = d3
      .drag<SVGCircleElement, SimNode>()
      .on('start', (event, d) => {
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    nodeSelection.call(drag);

    /* force simulation */
    const sim = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(100),
      )
      .force('charge', d3.forceManyBody<SimNode>().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force(
        'collide',
        d3.forceCollide<SimNode>().radius((d) => d.radius + 5),
      )
      .on('tick', () => {
        linkSelection
          .attr('x1', (d) => (d.source as SimNode).x!)
          .attr('y1', (d) => (d.source as SimNode).y!)
          .attr('x2', (d) => (d.target as SimNode).x!)
          .attr('y2', (d) => (d.target as SimNode).y!);

        nodeSelection.attr('cx', (d) => d.x!).attr('cy', (d) => d.y!);

        labelSelection.attr('x', (d) => d.x!).attr('y', (d) => d.y!);
      });

    simRef.current = sim;

    /* cleanup */
    return () => {
      sim.stop();
      simRef.current = null;
    };
  }, [aliveChars, factionColorMap, handleNodeClick]);

  /* ── empty state ──────────────────────────────────────────── */
  if (aliveChars.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 flex items-center justify-center h-[600px]">
        <p className="text-gray-500">No living characters to display</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 relative">
      <svg
        ref={svgRef}
        className="w-full"
        style={{ height: 600 }}
      />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-gray-950/90 backdrop-blur-sm border border-gray-800 rounded-lg px-4 py-3">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">
          Relationships
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {LEGEND_ENTRIES.map((entry) => (
            <div key={entry.label} className="flex items-center gap-2">
              <div
                className="w-6 h-0.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-gray-400">{entry.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
