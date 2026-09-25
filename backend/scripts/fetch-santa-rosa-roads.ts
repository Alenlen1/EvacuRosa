import { writeFileSync } from "node:fs";
import path from "node:path";

// Must match frontend/src/lib/mapBounds.ts — update both if the boundary changes.
const BOUNDS = { south: 14.27, west: 121.05, north: 14.36, east: 121.15 };

const HIGHWAY_TYPES = [
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "unclassified",
  "residential",
  "motorway_link",
  "trunk_link",
  "primary_link",
  "secondary_link",
  "tertiary_link",
  "service", "living_street", "pedestrian", "footway", "path", "cycleway", "steps", "track",
];

/**
 * Tried in order. The main FOSSGIS instance is first because it's always
 * current, but it's also the busiest and regularly returns 504/429 under
 * load. The mirrors below have far looser (or no) rate limits.
 *
 * Caveat worth knowing: the private.coffee mirror (formerly
 * kumi.systems) has been observed serving snapshots months out of date.
 * For a road-network geometry pull that's an acceptable trade — street
 * layouts barely change month to month — but don't reuse this mirror list
 * for anything where freshness actually matters.
 */
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

/** Public Overpass instances reject or throttle requests with a generic
 * or missing User-Agent, so this must stay meaningful and identifiable. */
const USER_AGENT =
  "EvacuRosa/1.0 (capstone project, Santa Rosa City PH; replace with a real contact email before production use)";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Walks the mirror list, retrying each with backoff. Overpass failures are
 * usually transient overload (504/429), not anything wrong with the query,
 * so a plain "try again later" would just push the same coin-flip onto the
 * user repeatedly.
 */
async function fetchFromOverpass(query: string): Promise<OverpassResponse> {
  const ATTEMPTS_PER_MIRROR = 2;
  let lastError = "";

  for (const url of OVERPASS_MIRRORS) {
    const host = new URL(url).host;
    for (let attempt = 1; attempt <= ATTEMPTS_PER_MIRROR; attempt++) {
      try {
        console.log(`  trying ${host} (attempt ${attempt}/${ATTEMPTS_PER_MIRROR})...`);
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain",
            "User-Agent": USER_AGENT,
          },
          body: query,
          signal: AbortSignal.timeout(240_000),
        });

        if (response.ok) {
          console.log(`  got a response from ${host}.`);
          return (await response.json()) as OverpassResponse;
        }

        lastError = `${host} returned ${response.status} ${response.statusText}`;
        console.log(`  ${lastError}`);

        // 504/429/503 are "busy, come back later" — worth a backoff before
        // retrying. Anything else is unlikely to fix itself, so move on to
        // the next mirror immediately.
        const transient = [429, 502, 503, 504].includes(response.status);
        if (!transient) break;
        if (attempt < ATTEMPTS_PER_MIRROR) {
          const waitMs = attempt * 15_000;
          console.log(`  waiting ${waitMs / 1000}s before retrying...`);
          await sleep(waitMs);
        }
      } catch (err) {
        lastError = `${host}: ${err instanceof Error ? err.message : String(err)}`;
        console.log(`  ${lastError}`);
        if (attempt < ATTEMPTS_PER_MIRROR) await sleep(attempt * 15_000);
      }
    }
  }

  throw new Error(
    `All Overpass mirrors failed. Last error: ${lastError}\n` +
      "The public servers are shared and free, so this happens. Wait a few " +
      "minutes and run the command again — the data itself is fine, the " +
      "servers are just busy."
  );
}

interface OverpassNode {
  type: "node";
  id: number;
  lat: number;
  lon: number;
}

interface OverpassWay {
  type: "way";
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
}

type OverpassElement = OverpassNode | OverpassWay;

interface OverpassResponse {
  elements: OverpassElement[];
}

interface OutNode {
  id: string;
  latitude: number;
  longitude: number;
}

interface OutEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  roadId: string;
  roadName: string;
  distanceMeters: number;
  status: "OPEN";
  condition: "GOOD";
  oneway?: boolean;
  osmTags: Record<string, string>;
}

function buildQuery(): string {
  const wayFilter = HIGHWAY_TYPES.map(
    (t) =>
      `way["highway"="${t}"](${BOUNDS.south},${BOUNDS.west},${BOUNDS.north},${BOUNDS.east});`
  ).join("\n  ");
  return `[out:json][timeout:180];\n(\n  ${wayFilter}\n);\nout body;\n>;\nout skel qt;\n`;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * An OSM bbox extract always contains disconnected fragments: roads clipped
 * at the boundary, isolated service loops, mapping gaps. If a user's GPS
 * snapped onto one of those, every route request from them would fail with
 * "no route found" for reasons that look like a bug. Keeping only the
 * largest connected component avoids that — at the cost of dropping some
 * genuinely-mapped but unreachable-from-the-main-network roads, which is
 * the right trade for a routing graph.
 */
function largestConnectedComponent(
  nodes: Map<string, OutNode>,
  edges: OutEdge[]
): { nodes: Map<string, OutNode>; edges: OutEdge[]; droppedNodes: number; components: number } {
  const adjacency = new Map<string, string[]>();
  for (const id of nodes.keys()) adjacency.set(id, []);
  for (const e of edges) {
    adjacency.get(e.fromNodeId)?.push(e.toNodeId);
    adjacency.get(e.toNodeId)?.push(e.fromNodeId);
  }

  const seen = new Set<string>();
  let best = new Set<string>();
  let components = 0;

  for (const start of nodes.keys()) {
    if (seen.has(start)) continue;
    components += 1;
    const component = new Set<string>();
    const stack = [start];
    seen.add(start);
    while (stack.length > 0) {
      const current = stack.pop() as string;
      component.add(current);
      for (const next of adjacency.get(current) ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    if (component.size > best.size) best = component;
  }

  const keptNodes = new Map<string, OutNode>();
  for (const id of best) {
    const node = nodes.get(id);
    if (node) keptNodes.set(id, node);
  }
  const keptEdges = edges.filter(
    (e) => best.has(e.fromNodeId) && best.has(e.toNodeId)
  );

  return {
    nodes: keptNodes,
    edges: keptEdges,
    droppedNodes: nodes.size - keptNodes.size,
    components,
  };
}

async function main() {
  console.log("Querying Overpass API for Santa Rosa City roads...");
  console.log(
    "This hits a free, donation-funded public server and can take 30-90s — please don't run it repeatedly in a loop."
  );

  const data = await fetchFromOverpass(buildQuery());

  const nodesById = new Map<number, OverpassNode>();
  const ways: OverpassWay[] = [];
  for (const el of data.elements) {
    if (el.type === "node") nodesById.set(el.id, el);
    if (el.type === "way") ways.push(el);
  }

  if (ways.length === 0) {
    throw new Error(
      "Overpass returned no ways. Check the BOUNDS constant and that the query wasn't rate-limited."
    );
  }

  const graphNodes = new Map<string, OutNode>();
  const graphEdges: OutEdge[] = [];
  let edgeCounter = 0;
  let skippedZeroLength = 0;

  for (const way of ways) {
    const roadName = way.tags?.name ?? way.tags?.highway ?? "unnamed road";
    // Preserve original way direction and tags for per-mode access checks.
    const oneway = way.tags?.oneway === "yes" || way.tags?.oneway === "1";

    for (let i = 0; i < way.nodes.length - 1; i++) {
      const fromNode = nodesById.get(way.nodes[i]);
      const toNode = nodesById.get(way.nodes[i + 1]);
      if (!fromNode || !toNode) continue;
      if (fromNode.id === toNode.id) continue;

      const distanceMeters = Math.round(
        haversineMeters(fromNode.lat, fromNode.lon, toNode.lat, toNode.lon)
      );
      // Zero-length segments (duplicate coordinates in the source data)
      // add nothing and can only confuse cost calculations.
      if (distanceMeters === 0) {
        skippedZeroLength += 1;
        continue;
      }

      const fromKey = `N${fromNode.id}`;
      const toKey = `N${toNode.id}`;
      graphNodes.set(fromKey, {
        id: fromKey,
        latitude: fromNode.lat,
        longitude: fromNode.lon,
      });
      graphNodes.set(toKey, {
        id: toKey,
        latitude: toNode.lat,
        longitude: toNode.lon,
      });

      edgeCounter += 1;
      graphEdges.push({
        id: `E${edgeCounter}`,
        fromNodeId: fromKey,
        toNodeId: toKey,
        roadId: `W${way.id}`,
        roadName,
        osmTags: way.tags ?? {},
        distanceMeters,
        status: "OPEN",
        // OSM has no reliable pavement-condition tag, so everything starts
        // GOOD. CDRRMO downgrades specific roads via the admin workflow —
        // never guess a worse condition than is actually reported.
        condition: "GOOD",
        ...(oneway ? { oneway: true } : {}),
      });
    }
  }

  console.log(
    `Parsed ${graphNodes.size} nodes and ${graphEdges.length} edges from ${ways.length} ways.`
  );
  if (skippedZeroLength > 0) {
    console.log(`Skipped ${skippedZeroLength} zero-length segment(s).`);
  }

  const pruned = largestConnectedComponent(graphNodes, graphEdges);
  console.log(
    `Found ${pruned.components} connected component(s); keeping the largest ` +
      `(${pruned.nodes.size} nodes, ${pruned.edges.length} edges), dropping ${pruned.droppedNodes} unreachable node(s).`
  );

  const output = {
    _meta: {
      source: "OpenStreetMap via Overpass API",
      accessRulesVersion: 1,
      fetchedAt: new Date().toISOString(),
      attribution: "© OpenStreetMap contributors, https://www.openstreetmap.org/copyright",
      bounds: BOUNDS,
      note:
        "Generated automatically — every edge starts OPEN/GOOD. Road status and condition updates come from the CDRRMO admin workflow, not this script. Only the largest connected component is kept, so isolated fragments clipped by the bounding box are excluded.",
      onewayNote:
        "Original OSM way direction and access tags are preserved. The router enforces access and one-way rules per travel mode. Turn-restriction relations are not included.",
    },
    nodes: [...pruned.nodes.values()],
    edges: pruned.edges,
  };

  const outPath = path.join(__dirname, "..", "src", "data", "santaRosaRoadGraph.json");
  writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`\nWrote ${outPath}`);
  console.log(
    "The backend picks this up automatically on restart — no code change needed."
  );
  console.log(
    "\nAccess and one-way rules are enforced per travel mode. Restart the backend to load this snapshot."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
