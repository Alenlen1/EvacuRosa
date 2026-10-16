import type { Request, Response } from "express";
import { loadRoadGraph } from "../services/road.service";
import { isInsideSantaRosa, HAZARD_CITY_ERROR } from "../geography/santaRosa";
import { isSantaRosaRoad } from "../services/hazardScope.service";
import { selectFloodSection } from "../algorithms/floodSections";

export function getRoadSection(req: Request, res: Response) {
  const { roadId } = req.query;
  const coords = [
    req.query.startLat,
    req.query.startLng,
    req.query.endLat,
    req.query.endLng,
  ];
  if (
    typeof roadId !== "string" ||
    coords.some(
      (value) =>
        typeof value !== "string" ||
        !value.trim() ||
        !Number.isFinite(Number(value)),
    )
  ) {
    res.status(400).json({
      error: "A road ID and valid start/end coordinates are required.",
    });
    return;
  }
  const [startLat, startLng, endLat, endLng] = coords.map(Number);
  if (
    !isInsideSantaRosa(startLat, startLng) ||
    !isInsideSantaRosa(endLat, endLng)
  ) {
    res.status(400).json({ error: HAZARD_CITY_ERROR });
    return;
  }
  const graph = loadRoadGraph();
  if (!isSantaRosaRoad(graph, roadId)) {
    res.status(400).json({ error: "Select a mapped Santa Rosa road." });
    return;
  }
  try {
    res.json(
      selectFloodSection(
        graph,
        roadId,
        { latitude: startLat, longitude: startLng },
        { latitude: endLat, longitude: endLng },
        (candidate) => isSantaRosaRoad(graph, candidate),
      ),
    );
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Invalid road section.",
    });
  }
}

export function getNearestRoads(req: Request, res: Response) {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const limit = req.query.limit ? Number(req.query.limit) : 5;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({
      error: "Query params lat and lng are required and must be numbers.",
    });
    return;
  }

  const cityOnly = req.query.scope === "santa-rosa";
  if (cityOnly && !isInsideSantaRosa(lat, lng)) {
    res.status(400).json({ error: HAZARD_CITY_ERROR });
    return;
  }
  const graph = loadRoadGraph();
  const roads = graph.nearestRoads(
    lat,
    lng,
    Number.isFinite(limit) ? limit : 5,
    cityOnly ? (roadId) => isSantaRosaRoad(graph, roadId) : undefined,
  );
  res.json({
    roads: cityOnly
      ? roads
          .filter((road) => road.distanceMeters <= 250)
          .map((road) => ({
            ...road,
            affectedSegments: graph
              .edgesByRoadId(road.roadId)
              .flatMap((edge) => {
                const from = graph.getNode(edge.fromNodeId),
                  to = graph.getNode(edge.toNodeId);
                return from && to
                  ? [
                      [
                        { latitude: from.latitude, longitude: from.longitude },
                        { latitude: to.latitude, longitude: to.longitude },
                      ],
                    ]
                  : [];
              }),
          }))
      : roads,
  });
}
