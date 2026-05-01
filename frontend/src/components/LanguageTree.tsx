import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';

export type PhonologicalRule = {
  from_sound: string;
  to_sound: string;
  context: string;
};

export type Morphology = {
  plural_marker?: string;
  honorific_prefix?: string;
  place_name_suffix?: string;
  diminutive?: string;
  notes?: string;
};

export type Inscription = {
  in_world_text: string;
  translation: string;
  context: string;
};

type LinguisticEraSummary = {
  era_id: string;
  era_name: string;
  in_world_year: number;
  parent_era: string | null;
  phonology_notes: string;
  phonological_rules?: PhonologicalRule[];
  morphology?: Morphology;
  sample_lexicon: Record<string, string>;
  sample_text: string;
  inscriptions?: Inscription[];
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
        .attr('fill', '#8A7860')
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
              phonological_rules: [],
              morphology: {},
              sample_lexicon: {},
              sample_text: '',
              inscriptions: [],
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
      .attr('stroke', '#8A7860')
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
        (selectedId ?? hoverId) === d.data.era.era_id ? '#D4A85F' : '#2A2014'
      )
      .attr('stroke', '#D4A85F')
      .attr('stroke-width', 1.5);

    nodeGroup
      .append('text')
      .attr('dy', '0.32em')
      .attr('x', 12)
      .attr('text-anchor', 'start')
      .attr('fill', '#CDB890')
      .attr('font-family', 'serif')
      .attr('font-size', 13)
      .text((d) => d.data.era.era_name);

    nodeGroup
      .append('text')
      .attr('dy', '1.6em')
      .attr('x', 12)
      .attr('text-anchor', 'start')
      .attr('fill', '#8A7860')
      .attr('font-size', 10)
      .text((d) => `year ${d.data.era.in_world_year}`);
  }, [data, tree, width, height, hoverId, selectedId]);

  const lexEntries = useMemo(() => {
    if (!selected) return [];
    return Object.entries(selected.sample_lexicon).slice(0, 18);
  }, [selected]);

  const morphEntries = useMemo(() => {
    if (!selected?.morphology) return [];
    const m = selected.morphology;
    const rows: Array<[string, string]> = [];
    if (m.plural_marker) rows.push(['plural', m.plural_marker]);
    if (m.honorific_prefix) rows.push(['honorific', m.honorific_prefix]);
    if (m.place_name_suffix) rows.push(['place-name', m.place_name_suffix]);
    if (m.diminutive) rows.push(['diminutive', m.diminutive]);
    return rows;
  }, [selected]);

  return (
    <div ref={ref} className="w-full">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-ink-500">Linguistic family tree</div>
          <div className="text-xs text-ink-600 mt-0.5">
            {data.length} era{data.length === 1 ? '' : 's'} · click any node for lexicon
          </div>
        </div>
      </div>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-8 bg-night-950/60 border border-ink-800/60 rounded-md overflow-hidden">
          <svg ref={svgRef} width={width} height={height} />
        </div>
        <div className="col-span-12 lg:col-span-4 bg-night-950/60 border border-ink-800/60 rounded-md p-4 min-h-[260px]">
          {selected ? (
            <div>
              <div className="font-display text-lg text-vellum-100">{selected.era_name}</div>
              <div className="text-[11px] text-ink-500 mb-3">year {selected.in_world_year}</div>
              {selected.phonology_notes && (
                <div className="text-sm text-vellum-300 italic mb-3 leading-relaxed">
                  {selected.phonology_notes}
                </div>
              )}
              {lexEntries.length > 0 && (
                <div className="mb-3">
                  <div className="text-[11px] uppercase tracking-widest text-ink-500 mb-1">Lexicon</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm font-mono">
                    {lexEntries.map(([en, lo]) => (
                      <div key={en} className="flex items-baseline justify-between">
                        <span className="text-ink-500">{en}</span>
                        <span className="text-gilt-400">{lo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(selected.phonological_rules?.length ?? 0) > 0 && (
                <div className="mb-3">
                  <div className="text-[11px] uppercase tracking-widest text-ink-500 mb-1">Sound shifts</div>
                  <div className="space-y-1 text-sm font-mono">
                    {selected.phonological_rules!.map((r, i) => (
                      <div key={i} className="flex items-baseline gap-2">
                        <span className="text-vellum-400">{r.from_sound}</span>
                        <span className="text-gilt-400">→</span>
                        <span className="text-gilt-400">{r.to_sound}</span>
                        {r.context && (
                          <span className="text-ink-600 text-xs italic ml-auto">{r.context}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {morphEntries.length > 0 && (
                <div className="mb-3">
                  <div className="text-[11px] uppercase tracking-widest text-ink-500 mb-1">Morphology</div>
                  <div className="text-sm space-y-1">
                    {morphEntries.map(([k, v]) => (
                      <div key={k} className="flex items-baseline gap-2">
                        <span className="text-ink-500 w-20 flex-shrink-0">{k}</span>
                        <span className="text-vellum-300">{v}</span>
                      </div>
                    ))}
                    {selected.morphology?.notes && (
                      <div className="text-xs text-ink-500 italic mt-1">{selected.morphology.notes}</div>
                    )}
                  </div>
                </div>
              )}
              {selected.sample_text && (
                <div className="mb-3">
                  <div className="text-[11px] uppercase tracking-widest text-ink-500 mb-1">Sample</div>
                  <div className="text-sm text-vellum-300 italic leading-relaxed font-body">
                    “{selected.sample_text}”
                  </div>
                </div>
              )}
              {(selected.inscriptions?.length ?? 0) > 0 && (
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-ink-500 mb-1">Inscriptions</div>
                  <div className="space-y-3">
                    {selected.inscriptions!.map((ins, i) => (
                      <div key={i} className="border-l-2 border-gilt-600/60 pl-2">
                        <div className="text-sm text-gilt-400 font-body italic">
                          “{ins.in_world_text}”
                        </div>
                        <div className="text-xs text-vellum-400 mt-0.5">{ins.translation}</div>
                        {ins.context && (
                          <div className="text-[10px] uppercase tracking-widest text-ink-600 mt-0.5">
                            {ins.context}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-ink-500 text-sm">
              Click an era node to inspect its lexicon, sound shifts, morphology, and in-world inscriptions.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
