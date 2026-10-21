// Offline benchmark: no network, database or credentials required.
const { performance } = require("node:perf_hooks");
const { createHash } = require("node:crypto");
const {
  loadRoadGraph,
  loadRoadGraphData,
} = require("../dist/services/road.service");
const {
  calculateRoute,
  createRouteCalculator,
} = require("../dist/algorithms/routing");
const assert = require("node:assert/strict");
const graph = loadRoadGraph(),
  data = loadRoadGraphData();
const modes = ["walking", "biking", "motorcycle", "car"];
const points = [
  { latitude: 14.330359, longitude: 121.110451 },
  { latitude: 14.31427, longitude: 121.112691 },
  { latitude: 14.311917, longitude: 121.104778 },
  { latitude: 14.295, longitude: 121.105 },
];
let started = performance.now();
const nearest = [];
for (let i = 0; i < 100; i++)
  for (const mode of modes) {
    const point = points[i % points.length];
    nearest.push(
      graph.nearestAccessibleNode(point.latitude, point.longitude, mode)?.id ??
        null,
    );
  }
const snapMs = performance.now() - started;
const snapshot = {
  statusOverrides: [],
  floodReports: [],
  fireIncidents: [],
  earthquakeImpacts: [],
};
started = performance.now();
const routes = [];
for (const mode of modes)
  for (const destination of points.slice(1))
    routes.push(calculateRoute(graph, points[0], destination, mode, snapshot));
const routeMs = performance.now() - started;
started = performance.now();
const calculate = createRouteCalculator(graph, snapshot),
  sharedRoutes = [];
for (const mode of modes)
  for (const destination of points.slice(1))
    sharedRoutes.push(calculate(points[0], destination, mode));
assert.deepEqual(
  sharedRoutes,
  routes,
  "Candidate reuse must preserve every route and risk result",
);
const sharedRouteMs = performance.now() - started;
global.gc?.();
const steady = process.memoryUsage();
// Exercise repeated exact flood-section edits without retaining old calculators.
let maximumHeap = 0;
let maximumRss = 0;
for (let i = 0; i < 12; i++) {
  const edge = data.edges[100 + i];
  calculateRoute(graph, points[0], points[1], "walking", {
    ...snapshot,
    floodReports: [
      {
        id: "benchmark-flood",
        roadId: edge.roadId,
        edgeRanges: [{ edgeId: edge.id, startFraction: 0.2, endFraction: 0.8 }],
        severity: "HIGH",
        roadImpassable: true,
        status: "ACTIVE",
        reportedAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
    ],
  });
  global.gc?.();
  maximumHeap = Math.max(maximumHeap, process.memoryUsage().heapUsed);
  maximumRss = Math.max(maximumRss, process.memoryUsage().rss);
}
const hash = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
console.log(
  JSON.stringify(
    {
      nodes: data.nodes.length,
      forwardEdges: data.edges.length,
      snapQueries: nearest.length,
      snapMs,
      routeQueries: routes.length,
      routeMs,
      sharedRouteMs,
      steadyHeapMiB: steady.heapUsed / 1048576,
      steadyRssMiB: steady.rss / 1048576,
      floodEditMaxHeapMiB: maximumHeap / 1048576,
    floodEditMaxRssMiB: maximumRss / 1048576,
      nearestHash: hash(nearest),
      routesHash: hash(routes),
    },
    null,
    2,
  ),
);
