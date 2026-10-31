import { RoadGraph } from "./astar/graph";
import type { GraphEdge, RoadStatus } from "./astar/edge";
import type { FloodReport } from "../types/flood";
import { floodStatusOverrides } from "../types/floodScope";
import { pointOnEdge } from "./floodSections";
import type { EarthquakeRoadImpact } from "../types/earthquake";
import { earthquakeStatusOverridesForImpacts } from "../types/earthquakeScope";

interface Part {
  id: string;
  start: number;
  end: number;
}
const cached = new WeakMap<
  RoadGraph,
  { key: string; graph: RoadGraph; parts: Map<string, Part[]> }
>();

/** Split at precise flood/debris boundaries, preserving access rules and leaving
 * the shared road graph untouched. Also used by the offline worker. */
export function prepareFloodRouting(
  base: RoadGraph,
  reports: FloodReport[],
  sourceOverrides: [string, RoadStatus][],
  impacts: EarthquakeRoadImpact[] = [],
) {
  const ranges = [...reports, ...impacts].flatMap(
    (report) => report.edgeRanges ?? [],
  );
  if (!ranges.length) {
    cached.delete(base);
    const overrides = new Map(sourceOverrides);
    for (const [id, status] of earthquakeStatusOverridesForImpacts(impacts))
      overrides.set(id, status);
    return { graph: base, reports, impacts, overrides };
  }
  const key = JSON.stringify(ranges);
  let partition = cached.get(base);
  if (!partition || partition.key !== key) {
    // Release the previous full partition before constructing its replacement.
    // Otherwise a flood edit temporarily retains three indexed road graphs.
    cached.delete(base);
    partition = undefined;
    const cuts = new Map<string, Set<number>>();
    for (const range of ranges) {
      if (
        !Number.isFinite(range.startFraction) ||
        !Number.isFinite(range.endFraction) ||
        range.startFraction < 0 ||
        range.endFraction > 1 ||
        range.startFraction >= range.endFraction
      )
        throw new Error("Invalid saved hazard section. Refresh hazard data.");
      const values = cuts.get(range.edgeId) ?? new Set([0, 1]);
      values.add(range.startFraction);
      values.add(range.endFraction);
      cuts.set(range.edgeId, values);
    }
    const data = base.getData();
    const nodes = [...data.nodes];
    const edges: GraphEdge[] = [];
    const parts = new Map<string, Part[]>();
    for (const edge of data.edges) {
      const values = cuts.get(edge.id);
      if (!values) {
        edges.push(edge);
        continue;
      }
      const sorted = [...values].sort((a, b) => a - b);
      const ids = sorted.map((fraction) => {
        if (fraction === 0) return edge.fromNodeId;
        if (fraction === 1) return edge.toNodeId;
        const id = `flood-node:${edge.id}:${fraction}`;
        nodes.push({ id, ...pointOnEdge(base, edge, fraction) });
        return id;
      });
      const children: Part[] = [];
      for (let index = 0; index < sorted.length - 1; index++) {
        const id = `${edge.id}:flood:${index}`;
        edges.push({
          ...edge,
          id,
          fromNodeId: ids[index],
          toNodeId: ids[index + 1],
          distanceMeters:
            edge.distanceMeters * (sorted[index + 1] - sorted[index]),
        });
        children.push({ id, start: sorted[index], end: sorted[index + 1] });
      }
      parts.set(edge.id, children);
    }
    if ([...cuts.keys()].some((id) => !parts.has(id)))
      throw new Error(
        "Saved hazard section does not match this road network. Refresh offline data.",
      );
    partition = { key, graph: new RoadGraph({ nodes, edges }), parts };
    cached.set(base, partition);
  }
  const parts = partition.parts;
  const expand = <T extends FloodReport | EarthquakeRoadImpact>(
    report: T,
  ): T => {
    if (report.edgeRanges != null)
      return {
        ...report,
        edgeRanges: null,
        affectedEdgeIds: report.edgeRanges.flatMap((range) =>
          (parts.get(range.edgeId) ?? [])
            .filter(
              (part) =>
                part.end > range.startFraction + 1e-10 &&
                part.start < range.endFraction - 1e-10,
            )
            .map((part) => part.id),
        ),
      };
    return report.affectedEdgeIds == null
      ? report
      : {
          ...report,
          affectedEdgeIds: report.affectedEdgeIds.flatMap(
            (id) => parts.get(id)?.map((part) => part.id) ?? [id],
          ),
        };
  };
  const expanded = reports.map(expand);
  const expandedImpacts = impacts.map(expand);
  const overrides = new Map<string, RoadStatus>();
  const merge = (id: string, status: RoadStatus) => {
    if (status === "BLOCKED" || overrides.get(id) !== "BLOCKED")
      overrides.set(id, status);
  };
  for (const [id, status] of sourceOverrides) {
    const children = id.startsWith("edge:")
      ? parts.get(id.slice(5))
      : undefined;
    if (children)
      for (const child of children) merge(`edge:${child.id}`, status);
    else merge(id, status);
  }
  for (const [id, status] of floodStatusOverrides(expanded)) merge(id, status);
  for (const [id, status] of earthquakeStatusOverridesForImpacts(
    expandedImpacts,
  ))
    merge(id, status);
  return {
    graph: partition.graph,
    reports: expanded,
    impacts: expandedImpacts,
    overrides,
  };
}
