// Offline coverage audit. Uses the same graph, access rules, endpoint matching,
// fuzzy weighting and A* as routing; never contacts Supabase or changes roads.
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { performance } = require("node:perf_hooks");
const {
  loadRoadGraph,
  loadRoadGraphData,
} = require("../dist/services/road.service");
const { createRouteCalculator } = require("../dist/algorithms/routing");
const { isInsideSantaRosa } = require("../dist/geography/santaRosa");
const { TRAVEL_MODES } = require("../dist/algorithms/astar/access");

const output = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, "../../.runtime/road-network-audit");
const maxRoads = Number(process.argv[3] ?? Infinity);
if (!(maxRoads > 0)) throw new Error("Optional road limit must be positive.");
fs.mkdirSync(output, { recursive: true });
const graph = loadRoadGraph();
const data = loadRoadGraphData();
const nodes = graph.allNodes();
const cityNodes = new Set(
  nodes
    .filter((n) => isInsideSantaRosa(n.latitude, n.longitude))
    .map((n) => n.id),
);
const hub = { latitude: 14.31896, longitude: 121.11207 };
const snapshot = {
  statusOverrides: [],
  floodReports: [],
  fireIncidents: [],
  earthquakeImpacts: [],
};
const calculate = createRouteCalculator(graph, snapshot);
const started = performance.now();
const roads = new Map();
const problems = [];
const nodeIds = new Set(nodes.map((n) => n.id));
const edgeIds = new Set();
for (const edge of data.edges) {
  if (edgeIds.has(edge.id)) problems.push(`Duplicate edge ID: ${edge.id}`);
  edgeIds.add(edge.id);
  if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) {
    problems.push(`Missing endpoint: ${edge.id}`);
    continue;
  }
  if (!Number.isFinite(edge.distanceMeters) || edge.distanceMeters < 0)
    problems.push(`Invalid length: ${edge.id}`);
  const from = graph.getNode(edge.fromNodeId),
    to = graph.getNode(edge.toNodeId);
  const point = {
    latitude: (from.latitude + to.latitude) / 2,
    longitude: (from.longitude + to.longitude) / 2,
  };
  if (
    !cityNodes.has(from.id) &&
    !cityNodes.has(to.id) &&
    !isInsideSantaRosa(point.latitude, point.longitude)
  )
    continue;
  const segments = roads.get(edge.roadId) ?? [];
  segments.push(edge);
  roads.set(edge.roadId, segments);
}
const visit = (adjacency, root) => {
  const seen = new Set([root]),
    queue = [root];
  for (let i = 0; i < queue.length; i++)
    for (const id of adjacency.get(queue[i]) ?? []) {
      if (seen.has(id)) continue;
      seen.add(id);
      queue.push(id);
    }
  return seen;
};
const csv = (values) =>
  values.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",");
const csvPath = path.join(output, "roads.csv");
fs.writeFileSync(
  csvPath,
  csv([
    "mode",
    "roadId",
    "name",
    "citySegments",
    "allowedDirectedSegments",
    "hubConnectivity",
    "latitude",
    "longitude",
    "toHubFound",
    "fromHubFound",
    "toHubWarnings",
    "fromHubWarnings",
  ]) + "\n",
);
const summary = {
  generatedAt: new Date().toISOString(),
  source: data._meta,
  graphSha256: createHash("sha256").update(JSON.stringify(data)).digest("hex"),
  scope:
    "All saved road segments checked for connectivity and access. One midpoint on a permitted segment per city road is routed to and from a fixed central reference in each permitted mode. Baseline without live hazards; not every possible origin/destination pair or physical road access.",
  hub,
  graphNodes: nodes.length,
  cityNodes: cityNodes.size,
  graphSegments: data.edges.length,
  graphRoads: new Set(data.edges.map((edge) => edge.roadId)).size,
  cityRoads: roads.size,
  testedRoadsPerMode: Math.min(maxRoads, roads.size),
  graphProblems: problems,
  modes: {},
};
const failures = [];
for (const mode of TRAVEL_MODES) {
  const permits = (edge) =>
    edge.status !== "BLOCKED" &&
    (!edge.allowedModes || edge.allowedModes.includes(mode));
  const outgoing = new Map(nodes.map((n) => [n.id, []]));
  const incoming = new Map(nodes.map((n) => [n.id, []]));
  for (const node of nodes)
    for (const edge of graph.neighbors(node.id))
      if (permits(edge)) {
        outgoing.get(edge.fromNodeId).push(edge.toNodeId);
        incoming.get(edge.toNodeId).push(edge.fromNodeId);
      }
  const root = graph.nearestAccessibleNode(hub.latitude, hub.longitude, mode);
  if (!root) throw new Error(`Reference point inaccessible for ${mode}`);
  const fromHub = visit(outgoing, root.id),
    toHub = visit(incoming, root.id);
  const activeCity = nodes.filter(
    (n) =>
      cityNodes.has(n.id) &&
      (outgoing.get(n.id).length || incoming.get(n.id).length),
  );
  const result = {
    accessibleCityNodes: activeCity.length,
    cityNodesCanReachHub: activeCity.filter((n) => toHub.has(n.id)).length,
    cityNodesReachableFromHub: activeCity.filter((n) => fromHub.has(n.id))
      .length,
    restrictedRoads: 0,
    routeQueries: 0,
    routesFound: 0,
    routesNotFound: 0,
    roadsRoutableBothWays: 0,
    roadsRoutableOneWay: 0,
    roadsNotRoutableEitherWay: 0,
  };
  let checked = 0;
  for (const [roadId, segments] of roads) {
    if (checked++ >= maxRoads) break;
    const allowed = segments
      .flatMap((edge) => [
        graph.neighbors(edge.fromNodeId).find((e) => e.id === edge.id),
        graph.neighbors(edge.toNodeId).find((e) => e.id === `${edge.id}-r`),
      ])
      .filter((edge) => edge && permits(edge));
    if (!allowed.length) {
      result.restrictedRoads++;
      fs.appendFileSync(
        csvPath,
        csv([
          mode,
          roadId,
          segments[0].roadName,
          segments.length,
          0,
          "RESTRICTED",
        ]) + "\n",
      );
      continue;
    }
    const reachableFrom = allowed.some((edge) => fromHub.has(edge.fromNodeId));
    const reachesHub = allowed.some((edge) => toHub.has(edge.toNodeId));
    const connectivity =
      reachableFrom && reachesHub
        ? "BOTH"
        : reachableFrom
          ? "FROM_HUB_ONLY"
          : reachesHub
            ? "TO_HUB_ONLY"
            : "DISCONNECTED";
    const edge = allowed[Math.floor(allowed.length / 2)];
    const a = graph.getNode(edge.fromNodeId),
      b = graph.getNode(edge.toNodeId);
    const point = {
      latitude: (a.latitude + b.latitude) / 2,
      longitude: (a.longitude + b.longitude) / 2,
    };
    const outbound = calculate(point, hub, mode),
      inbound = calculate(hub, point, mode);
    for (const route of [outbound, inbound]) {
      result.routeQueries++;
      route.found ? result.routesFound++ : result.routesNotFound++;
    }
    if (outbound.found && inbound.found) result.roadsRoutableBothWays++;
    else if (outbound.found || inbound.found) result.roadsRoutableOneWay++;
    else result.roadsNotRoutableEitherWay++;
    fs.appendFileSync(
      csvPath,
      csv([
        mode,
        roadId,
        segments[0].roadName,
        segments.length,
        allowed.length,
        connectivity,
        point.latitude,
        point.longitude,
        outbound.found,
        inbound.found,
        outbound.warnings.join(" | "),
        inbound.warnings.join(" | "),
      ]) + "\n",
    );
    if (!outbound.found || !inbound.found)
      failures.push({
        mode,
        roadId,
        name: segments[0].roadName,
        point,
        connectivity,
        toHubFound: outbound.found,
        fromHubFound: inbound.found,
        osm: `https://www.openstreetmap.org/way/${roadId.replace(/^W/, "")}`,
      });
    if (checked % 500 === 0)
      console.log(
        `[${mode}] ${checked}/${Math.min(roads.size, maxRoads)} roads; ${result.routesNotFound} failed route checks; ${Math.round((performance.now() - started) / 1000)} s elapsed`,
      );
  }
  summary.modes[mode] = result;
  fs.writeFileSync(
    path.join(output, "summary.json"),
    JSON.stringify(summary, null, 2),
  );
  fs.writeFileSync(
    path.join(output, "failures.json"),
    JSON.stringify(failures, null, 2),
  );
  console.log(`${mode}: ${JSON.stringify(result)}`);
}
summary.durationSeconds = Math.round((performance.now() - started) / 1000);
fs.writeFileSync(
  path.join(output, "summary.json"),
  JSON.stringify(summary, null, 2),
);
console.log(`Audit saved in ${output}; graph problems: ${problems.length}`);
if (problems.length) process.exitCode = 1;
