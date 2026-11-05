import type { Request, Response } from "express";
import { loadRoadGraph } from "../services/road.service";
import { isInsideSantaRosa, HAZARD_CITY_ERROR } from "../geography/santaRosa";
import { isSantaRosaRoad } from "../services/hazardScope.service";
import { selectFloodSection } from "../algorithms/floodSections";
import {
  isImpactArea,
  selectEarthquakeArea,
} from "../algorithms/earthquakeArea";

export function getEarthquakeArea(req: Request, res: Response) {
  const rectangular = req.query.shape === "rectangle";
  if (
    req.query.shape !== undefined &&
    req.query.shape !== "circle" &&
    !rectangular
  ) {
    res.status(400).json({ error: "Choose a supported debris area shape." });
    return;
  }
  const values = [
    req.query.lat,
    req.query.lng,
    ...(rectangular ? [req.query.width, req.query.height] : [req.query.radius]),
  ];
  if (values.some((value) => typeof value !== "string" || !value.trim())) {
    res
      .status(400)
      .json({ error: "Provide a location and valid debris area dimensions." });
    return;
  }
  const [latitude, longitude, size, heightMeters] = values.map(Number);
  const area = rectangular
    ? {
        shape: "rectangle" as const,
        latitude,
        longitude,
        widthMeters: size,
        heightMeters,
      }
    : { latitude, longitude, radiusMeters: size };
  if (!isImpactArea(area) || !isInsideSantaRosa(latitude, longitude)) {
    res.status(400).json({
      error:
        "Select a location inside Santa Rosa. Rectangle sides must be 5–500 metres; legacy circle radii must be 5–250 metres.",
    });
    return;
  }
  const graph = loadRoadGraph();
  res.json({
    roads: selectEarthquakeArea(graph, area, (id) =>
      isSantaRosaRoad(graph, id),
    ),
  });
}

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
    !roadId.trim() ||
    roadId.length > 128 ||
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
  if (
    [req.query.lat, req.query.lng].some(
      (value) => typeof value !== "string" || !value.trim(),
    )
  ) {
    res
      .status(400)
      .json({ error: "Provide numeric lat and lng query parameters." });
    return;
  }
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const rawLimit = req.query.limit;
  const limit =
    rawLimit === undefined
      ? 5
      : typeof rawLimit === "string"
        ? Number(rawLimit)
        : NaN;

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    res.status(400).json({
      error: "Query params lat and lng are required and must be numbers.",
    });
    return;
  }

  if (
    (rawLimit !== undefined &&
      (typeof rawLimit !== "string" || !/^\d+$/.test(rawLimit))) ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 10
  ) {
    res
      .status(400)
      .json({ error: "limit must be an integer between 1 and 10." });
    return;
  }
  if (req.query.scope !== undefined && req.query.scope !== "santa-rosa") {
    res.status(400).json({ error: "scope must be santa-rosa when provided." });
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
    limit,
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
