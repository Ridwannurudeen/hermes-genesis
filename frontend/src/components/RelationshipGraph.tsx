import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
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

/* Each toggle covers a *category* — the keys list the underlying relation types
 * it groups. Clicking a toggle hides every link whose type is in that group. */
type RelCategory = {
  id: string;
  label: string;
  color: string;
  types: string[];
};

const REL_CATEGORIES: RelCategory[] = [
  { id: 'hostile', label: 'Enemy / Rival', color: '#ef4444', types: ['enemy', 'rival'] },
  { id: 'ally', label: 'Ally / Friend', color: '#22c55e', types: ['ally', 'friend'] },
  { id: 'love', label: 'Love / Family', color: '#ec4899', types: ['love', 'family'] },
  { id: 'mentor', label: 'Mentor / Protege', color: '#9ca3af', types: ['mentor', 'protege'] },
];

const TYPE_TO_CATEGORY: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const c of REL_CATEGORIES) for (const t of c.types) m[t] = c.id;
  return m;
})();

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
  const prevLinkKeysRef = useRef<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [factionFilter, setFactionFilter] = useState<string>('all');
  const [activeCats, setActiveCats] = useState<Set<string>>(
    () => new Set(REL_CATEGORIES.map((c) => c.id)),
  );

  const toggleCategory = useCallback((id: string) => {
    setActiveCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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

    /* build links – deduplicate bidirectional + apply category toggles */
    const seen = new Set<string>();
    const allLinkKeys = new Set<string>();
    const links: SimLink[] = [];

    aliveChars.forEach((c) => {
      c.relationships.forEach((rel) => {
        if (!aliveIds.has(rel.target_id)) return;
        const key = linkKey(c.id, rel.target_id);
        if (seen.has(key)) return;
        seen.add(key);
        const t = (rel.type || '').toLowerCase();
        const catId = TYPE_TO_CATEGORY[t];
        // Track every edge for diffing pulse animation, even if hidden.
        allLinkKeys.add(key);
        if (catId && !activeCats.has(catId)) return;
        links.push({
          source: c.id,
          target: rel.target_id,
          type: rel.type,
          intensity: rel.intensity,
        });
      });
    });

    /* Detect newly-arrived edges since last render (for pulse animation). */
    const newKeys = new Set<string>();
    for (const k of allLinkKeys) if (!prevLinkKeysRef.current.has(k)) newKeys.add(k);
    prevLinkKeysRef.current = allLinkKeys;

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

    /* Pulse newly-arrived edges so the live demo *feels* alive. */
    linkSelection
      .filter((d) => {
        const src = typeof d.source === 'object' ? (d.source as SimNode).id : String(d.source);
        const tgt = typeof d.target === 'object' ? (d.target as SimNode).id : String(d.target);
        return newKeys.has(linkKey(src, tgt));
      })
      .attr('stroke-opacity', 1)
      .attr('stroke-width', (d) => d.intensity * 6 + 1)
      .transition()
      .duration(2200)
      .ease(d3.easeCubicOut)
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d) => d.intensity * 3);

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
  }, [aliveChars, factionColorMap, handleNodeClick, activeCats]);

  /* Analytics: degree centrality + most-hostile faction. Computed off the
   * full alive-character set, not the toggled-link view. */
  const analytics = useMemo(() => {
    const aliveIds = new Set(aliveChars.map((c) => c.id));
    const degree: Record<string, number> = {};
    // Faction → count of (enemy or rival) edges incident to its members.
    const hostileByFaction: Record<string, number> = {};
    const seen = new Set<string>();
    for (const c of aliveChars) {
      degree[c.id] = degree[c.id] || 0;
      for (const rel of c.relationships) {
        if (!aliveIds.has(rel.target_id)) continue;
        const k = linkKey(c.id, rel.target_id);
        if (seen.has(k)) continue;
        seen.add(k);
        degree[c.id] = (degree[c.id] || 0) + 1;
        degree[rel.target_id] = (degree[rel.target_id] || 0) + 1;
        const t = (rel.type || '').toLowerCase();
        if (t === 'enemy' || t === 'rival') {
          hostileByFaction[c.faction_id] = (hostileByFaction[c.faction_id] || 0) + 1;
          // Also credit the target's faction
          const tgt = aliveChars.find((x) => x.id === rel.target_id);
          if (tgt) {
            hostileByFaction[tgt.faction_id] = (hostileByFaction[tgt.faction_id] || 0) + 1;
          }
        }
      }
    }
    const topCharacters = aliveChars
      .map((c) => ({ char: c, degree: degree[c.id] || 0 }))
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 3);
    const dangerousFactionEntry = Object.entries(hostileByFaction).sort((a, b) => b[1] - a[1])[0];
    const dangerousFaction = dangerousFactionEntry
      ? {
          faction: factions.find((f) => f.id === dangerousFactionEntry[0]),
          hostileEdges: dangerousFactionEntry[1],
        }
      : null;
    return { topCharacters, dangerousFaction };
  }, [aliveChars, factions]);

  /* ── empty state ──────────────────────────────────────────── */
  if (aliveChars.length === 0) {
    return (
      <div className="bg-white/[0.03] rounded-xl border border-subtle flex items-center justify-center h-[600px]">
        <p className="text-dim">No living characters to display</p>
      </div>
    );
  }

  return (
    <div>
      {/* Search + Filter bar */}
      <div className="flex items-center gap-3 mb-3">
        <div className="relative flex-1 max-w-xs">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              // Highlight matching node in graph
              const q = e.target.value.toLowerCase().trim();
              if (!svgRef.current || !q) {
                d3.select(svgRef.current).selectAll('circle').attr('opacity', 1);
                d3.select(svgRef.current).selectAll('.labels text').attr('opacity', 1);
                return;
              }
              d3.select(svgRef.current).selectAll<SVGCircleElement, SimNode>('.nodes circle')
                .attr('opacity', (d) => d.name.toLowerCase().includes(q) ? 1 : 0.12);
              d3.select(svgRef.current).selectAll<SVGTextElement, SimNode>('.labels text')
                .attr('opacity', (d) => d.name.toLowerCase().includes(q) ? 1 : 0.12);
            }}
            placeholder="Search characters..."
            className="w-full glass-input rounded-lg pl-3 pr-3 py-2 text-sm text-input placeholder-faint focus:outline-none transition-all"
          />
        </div>

        <select
          value={factionFilter}
          onChange={(e) => {
            setFactionFilter(e.target.value);
            const fid = e.target.value;
            if (!svgRef.current) return;
            if (fid === 'all') {
              d3.select(svgRef.current).selectAll('circle').attr('opacity', 1);
              d3.select(svgRef.current).selectAll('.labels text').attr('opacity', 1);
              d3.select(svgRef.current).selectAll('.links line').attr('opacity', 1);
              return;
            }
            d3.select(svgRef.current).selectAll<SVGCircleElement, SimNode>('.nodes circle')
              .attr('opacity', (d) => d.factionId === fid ? 1 : 0.1);
            d3.select(svgRef.current).selectAll<SVGTextElement, SimNode>('.labels text')
              .attr('opacity', (d) => d.factionId === fid ? 1 : 0.1);
          }}
          className="glass-input rounded-lg px-3 py-2 text-sm text-sub focus:outline-none transition-all"
        >
          <option value="all">All Factions</option>
          {factions.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>

        <span className="text-xs text-dim font-mono">
          {aliveChars.length} characters
        </span>
      </div>

      <div className="bg-white/[0.03] rounded-xl border border-subtle relative">
        <svg
          ref={svgRef}
          className="w-full"
          style={{ height: 600 }}
        />

        {/* Relation-type toggles (replaces static legend) */}
        <div className="absolute bottom-4 left-4 glass rounded-lg px-4 py-3">
          <p className="text-xs text-dim uppercase tracking-wider mb-2 font-medium">
            Filter by relation
          </p>
          <div className="flex flex-wrap gap-2">
            {REL_CATEGORIES.map((cat) => {
              const active = activeCats.has(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className="text-xs px-2.5 py-1 rounded-full border transition-all flex items-center gap-1.5"
                  style={{
                    borderColor: active ? cat.color : 'rgba(148, 163, 184, 0.2)',
                    backgroundColor: active ? `${cat.color}22` : 'transparent',
                    color: active ? cat.color : '#64748b',
                  }}
                  aria-pressed={active}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: cat.color, opacity: active ? 1 : 0.4 }}
                  />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Centrality + danger callouts */}
        {(analytics.topCharacters.length > 0 || analytics.dangerousFaction) && (
          <div className="absolute top-4 right-4 glass rounded-lg px-4 py-3 max-w-xs">
            {analytics.topCharacters[0] && analytics.topCharacters[0].degree > 0 && (
              <div className="mb-2">
                <p className="text-[10px] text-dim uppercase tracking-widest mb-1">Most central</p>
                <div className="text-sm text-sub">
                  <span className="text-amber-300 font-medium">
                    {analytics.topCharacters[0].char.name}
                  </span>{' '}
                  <span className="text-dim">· {analytics.topCharacters[0].degree} ties</span>
                </div>
                {analytics.topCharacters.slice(1).map((t) =>
                  t.degree > 0 ? (
                    <div key={t.char.id} className="text-xs text-dim mt-0.5">
                      {t.char.name} <span className="text-faint">· {t.degree}</span>
                    </div>
                  ) : null,
                )}
              </div>
            )}
            {analytics.dangerousFaction?.faction && (
              <div>
                <p className="text-[10px] text-dim uppercase tracking-widest mb-1">
                  Most dangerous faction
                </p>
                <div className="text-sm">
                  <span
                    className="font-medium"
                    style={{ color: analytics.dangerousFaction.faction.color }}
                  >
                    {analytics.dangerousFaction.faction.name}
                  </span>{' '}
                  <span className="text-dim">
                    · {analytics.dangerousFaction.hostileEdges} hostile ties
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
