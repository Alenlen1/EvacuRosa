import type { EarthquakeProvider, RawEarthquakeEvent } from "./earthquakeProvider";

/**
 * PHIVOLCS is the spec's preferred source, but as of this writing it has
 * no stable public JSON/REST API — only an HTML bulletin page, which would
 * mean scraping (fragile, against the page's intent, and easy to silently
 * break). The spec's own wording — "Prefer PHIVOLCS where technically
 * available" — permits a fallback when it isn't. USGS's public FDSN Event
 * API is free, documented, and does cover Philippine seismicity, so it's
 * used here as the actual "technically available" authoritative source.
 * If PHIVOLCS ever exposes a real API, swap the implementation this class
 * provides — nothing else in the codebase needs to change.
 */
export class UsgsEarthquakeProvider implements EarthquakeProvider {
  // Roughly Luzon + Laguna de Bay region, generous enough to catch events
  // that could plausibly matter to Santa Rosa without pulling all of PH.
  private static readonly BOUNDS = {
    minLatitude: 12.5,
    maxLatitude: 19.5,
    minLongitude: 119.0,
    maxLongitude: 123.5,
  };

  async fetchRecentEarthquakes(): Promise<RawEarthquakeEvent[]> {
    const { minLatitude, maxLatitude, minLongitude, maxLongitude } =
      UsgsEarthquakeProvider.BOUNDS;
    const url = new URL("https://earthquake.usgs.gov/fdsnws/event/1/query");
    url.searchParams.set("format", "geojson");
    url.searchParams.set("starttime", daysAgoIso(30));
    url.searchParams.set("minlatitude", String(minLatitude));
    url.searchParams.set("maxlatitude", String(maxLatitude));
    url.searchParams.set("minlongitude", String(minLongitude));
    url.searchParams.set("maxlongitude", String(maxLongitude));
    url.searchParams.set("minmagnitude", "2.5");
    url.searchParams.set("orderby", "time");

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`USGS request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      features: {
        id: string;
        geometry: { coordinates: [number, number, number] };
        properties: { mag: number; time: number };
      }[];
    };

    return data.features.map((f) => ({
      externalEventId: `usgs-${f.id}`,
      longitude: f.geometry.coordinates[0],
      latitude: f.geometry.coordinates[1],
      depthKm: f.geometry.coordinates[2] ?? null,
      magnitude: f.properties.mag,
      occurredAt: new Date(f.properties.time).toISOString(),
      source: "USGS",
    }));
  }
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}
