import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';

type LinguisticEraSummary = {
  era_id: string;
  era_name: string;
  in_world_year: number;
  parent_era: string | null;
  phonology_notes: string;
  sample_lexicon: Record<string, string>;
  sample_text: string;
};

type Props = {
  data: LinguisticEraSummary[];
  height?: number;
};

type TreeNode = {
  era: LinguisticEraSummary;
  children: TreeNode[];
};

function buildTree(data: LinguisticEraSummary[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  data.forEach((e) => byId.set(e.era_id, { era: e, children: [] }));
  const roots: TreeNode[] = [];
  data.forEach((e) => {
    const n = byId.get(e.era_id)!;
    if (e.parent_era && byId.has(e.parent_era)) {
      byId.get(e.parent_era)!.children.push(n);
    } else {
      roots.push(n);
    }
  });
  return roots;
}

export default function LanguageTree({ data, height = 520 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(900);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(Math.max(360, e.contentRect.width));
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const tree = useMemo(() => buildTree(data), [data]);
  const selected = useMemo(
    () => data.find((d) => d.era_id === (selectedId ?? hoverId)) ?? null,
    [data, selectedId, hoverId]
  );

  // Lay out: hierarchical tree if there are roots; otherwise spread linearly
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    if (data.length === 0) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#475569')
        .attr('font-size', 14)
        .text('Linguistic eras will appear as the canon advances.');
      return;
    }

    const margin = { top: 40, right: 32, bottom: 40, left: 32 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Build a synthetic root if multiple roots, so d3.hierarchy works
    const root: TreeNode =
      tree.length === 1
        ? tree[0]
        : {
            era: {
              era_id: '__root__',
              era_name: 'languages',
              in_world_year: -1,
              parent_era: null,
              phonology_notes: '',
              sample_lexicon: {},
              sample_text: '',
            },
            children: tree,
          };

    const hierarchy = d3.hierarchy(root, (d) => d.children);
    const layout = d3.tree<TreeNode>().size([h, w * 0.85]);
    const positioned = layout(hierarchy);

    // Edges
    const linkGen = d3
      .linkHorizontal<d3.HierarchyPointLink<TreeNode>, d3.HierarchyPointNode<TreeNode>>()
      .x((d) => d.y)
      .y((d) => d.x);

    g.append('g')
      .attr('fill', 'none')
      .attr('stroke', '#475569')
      .attr('stroke-opacity', 0.45)
      .attr('stroke-width', 1.2)
      .selectAll('path')
      .data(positioned.links())
      .join('path')
      .attr('d', linkGen as unknown as (d: d3.HierarchyPointLink<TreeNode>) => string);

    // Nodes
    const nodeGroup = g
      .append('g')
      .selectAll('g')
      .data(positioned.descendants().filter((d) => d.data.era.era_id !== '__root__'))
      .join('g')
      .attr('transform', (d) => `translate(${d.y},${d.x})`)
      .style('cursor', 'pointer')
      .on('mouseenter', (_e, d) => setHoverId(d.data.era.era_id))
      .on('mouseleave', () => setHoverId(null))
      .on('click', (_e, d) => setSelectedId((s) => (s === d.data.era.era_id ? null : d.data.era.era_id)));

    nodeGroup
      .append('circle')
      .attr('r', 7)
      .attr('fill', (d) =>
        (selectedId ?? hoverId) === d.data.era.era_id ? '#fbbf24' : '#1e293b'
      )
      .attr('stroke', '#fbbf24')
      .attr('stroke-width', 1.5);

    nodeGroup
      .append('text')
      .attr('dy', '0.32em')
      .attr('x', 12)
      .attr('text-anchor', 'start')
      .attr('fill', '#cbd5e1')
      .attr('font-family', 'serif')
      .attr('font-size', 13)
      .text((d) => d.data.era.era_name);

    nodeGroup
      .append('text')
      .attr('dy', '1.6em')
      .attr('x', 12)
      .attr('text-anchor', 'start')
      .attr('fill', '#64748b')
      .attr('font-size', 10)
      .text((d) => `year ${d.data.era.in_world_year}`);
  }, [data, tree, width, height, hoverId, selectedId]);

  const lexEntries = useMemo(() => {
    if (!selected) return [];
    return Object.entries(selected.sample_lexicon).slice(0, 18);
  }, [selected]);

  return (
    <div ref={ref} className="w-full">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-slate-500">Linguistic family tree</div>
          <div className="text-xs text-slate-600 mt-0.5">
            {data.length} era{data.length === 1 ? '' : 's'} · click any node for lexicon
          </div>
        </div>
      </div>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-8 bg-slate-950/60 border border-slate-800/60 rounded-md overflow-hidden">
          <svg ref={svgRef} width={width} height={height} />
        </div>
        <div className="col-span-12 lg:col-span-4 bg-slate-950/60 border border-slate-800/60 rounded-md p-4 min-h-[260px]">
          {selected ? (
            <div>
              <div className="font-serif text-lg text-slate-100">{selected.era_name}</div>
              <div className="text-[11px] text-slate-500 mb-3">year {selected.in_world_year}</div>
              {selected.phonology_notes && (
                <div className="text-sm text-slate-300 italic mb-3 leading-relaxed">
                  {selected.phonology_notes}
                </div>
              )}
              {lexEntries.length > 0 && (
                <div className="mb-3">
                  <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-1">Lexicon</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm font-mono">
                    {lexEntries.map(([en, lo]) => (
                      <div key={en} className="flex items-baseline justify-between">
                        <span className="text-slate-500">{en}</span>
                        <span className="text-amber-300">{lo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selected.sample_text && (
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-1">Sample</div>
                  <div className="text-sm text-slate-300 italic leading-relaxed font-serif">
                    “{selected.sample_text}”
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-slate-500 text-sm">
              Click an era node to inspect its lexicon and a sample of its prose.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
