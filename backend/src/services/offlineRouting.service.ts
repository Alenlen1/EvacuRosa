import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { loadRoadGraphData } from "./road.service";
import {
  getActiveFloodReports,
  roadStatusOverridesForReports,
} from "./flood.service";
import {
  getActiveFireIncidents,
  fireStatusOverridesForIncidents,
} from "./fire.service";
import {
  getVerifiedRoadImpacts,
  earthquakeStatusOverridesForImpacts,
  earthquakeImpactByRoadId,
} from "./earthquake.service";
import { getAllCenters } from "./evacuation.service";
import { getSupabase } from "../database/supabase";
import { OFFLINE_FORMAT, type OfflineSnapshot } from "../algorithms/offline";
import type { RoadStatus } from "../algorithms/astar/edge";

let graphResponse: { version: string; json: string; gzip: Buffer } | null =
  null;
export function getOfflineGraphResponse() {
  if (!graphResponse) {
    const data = loadRoadGraphData();
    const version = createHash("sha256")
      .update(JSON.stringify(data))
      .digest("hex");
    const json = JSON.stringify({ version, data });
    graphResponse = { version, json, gzip: gzipSync(json) };
  }
  return graphResponse;
}

// Capture complete public routing inputs. Any failed source aborts the sync,
// preserving the user's previous complete snapshot instead of inventing safety.
export async function getOfflineSnapshot(): Promise<OfflineSnapshot> {
  const updatedAt = new Date().toISOString();
  const [floodReports, fireIncidents, impacts, centers] = await Promise.all([
    getActiveFloodReports(),
    getActiveFireIncidents(),
    getVerifiedRoadImpacts(),
    getAllCenters(),
  ]);
  const statusOverrides = new Map<string, RoadStatus>();
  for (const source of [
    roadStatusOverridesForReports(floodReports),
    fireStatusOverridesForIncidents(fireIncidents),
    earthquakeStatusOverridesForImpacts(impacts),
  ]) {
    for (const [id, status] of source) {
      if (status === "BLOCKED" || statusOverrides.get(id) !== "BLOCKED")
        statusOverrides.set(id, status);
    }
  }
  return {
    formatVersion: OFFLINE_FORMAT,
    graphVersion: getOfflineGraphResponse().version,
    updatedAt,
    hazardsAvailable: !!getSupabase(),
    centers,
    floodReports,
    fireIncidents,
    statusOverrides: [...statusOverrides],
    earthquakeImpacts: [...earthquakeImpactByRoadId(impacts)],
  };
}
