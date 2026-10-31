import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { EarthquakeRoadImpact } from "@/services/api";

vi.mock("@/components/LanguageProvider", () => ({
  useLanguage: () => ({ t: (text: string) => text }),
}));

vi.mock("react-leaflet", () => ({
  Circle: ({ children }: { children: ReactNode }) =>
    createElement("div", { "data-event": true }, children),
  Polyline: ({ children }: { children: ReactNode }) =>
    createElement("div", { "data-road": true }, children),
  Tooltip: ({ children }: { children: ReactNode }) =>
    createElement("span", null, children),
}));
import { EarthquakeLayer } from "./EarthquakeLayer";

const impact: EarthquakeRoadImpact = {
  id: "standalone-impact",
  earthquakeEventId: null,
  roadId: "road-1",
  impactLevel: "HIGH",
  confirmedBlocked: true,
  notes: "Fallen debris",
  affectedSegments: [
    [
      { latitude: 14.31, longitude: 121.1 },
      { latitude: 14.311, longitude: 121.1 },
    ],
  ],
};

describe("public earthquake map visibility", () => {
  it("shows a verified debris footprint without requiring an earthquake event", () => {
    const html = renderToStaticMarkup(
      createElement(EarthquakeLayer, {
        events: [],
        roadImpacts: [
          {
            ...impact,
            impactArea: { latitude: 14.31, longitude: 121.1, radiusMeters: 25 },
          },
        ],
      }),
    );
    expect(html).toContain("Reported debris area");
    expect(html).toContain("25");
    expect(html).toContain('data-road="true"');
  });
  it("renders a standalone blocked road even when no earthquake events exist", () => {
    const html = renderToStaticMarkup(
      createElement(EarthquakeLayer, { events: [], roadImpacts: [impact] }),
    );
    expect(html).toContain('data-road="true"');
    expect(html).toContain("Earthquake road impact");
    expect(html).toContain("Road blocked");
    expect(html).toContain("Fallen debris");
    expect(html).not.toContain('data-event="true"');
  });
  it("shows damage without claiming the road is blocked unless confirmed", () => {
    const html = renderToStaticMarkup(
      createElement(EarthquakeLayer, {
        events: [],
        roadImpacts: [{ ...impact, confirmedBlocked: false }],
      }),
    );
    expect(html).toContain("No confirmed road blockage");
    expect(html).not.toContain("Road blocked");
  });
});
