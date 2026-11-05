import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type {
  EarthquakeRectangleArea,
  EarthquakeRoadImpact,
} from "@/services/api";

vi.mock("@/components/LanguageProvider", () => ({
  useLanguage: () => ({ t: (text: string) => text }),
}));

vi.mock("react-leaflet", () => ({
  Circle: ({ children }: { children: ReactNode }) =>
    createElement("div", { "data-event": true }, children),
  Polygon: ({
    children,
    positions,
  }: {
    children: ReactNode;
    positions: [number, number][];
  }) =>
    createElement(
      "div",
      { "data-polygon": true, "data-positions": JSON.stringify(positions) },
      children,
    ),
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
  it("shows an area-only footprint and notes without drawing road restrictions", () => {
    const html = renderToStaticMarkup(
      createElement(EarthquakeLayer, {
        events: [],
        roadImpacts: [
          {
            ...impact,
            roadId: null,
            confirmedBlocked: false,
            impactArea: {
              shape: "rectangle",
              latitude: 14.31,
              longitude: 121.1,
              widthMeters: 30,
              heightMeters: 50,
              rotationDegrees: 45,
            },
          },
        ],
      }),
    );
    expect(html).toContain('data-polygon="true"');
    expect(html).toContain("Earthquake area report");
    expect(html).toContain("No road routing change");
    expect(html).toContain("Fallen debris");
    expect(html).not.toContain('data-road="true"');
    expect(html).not.toContain("Road blocked");
  });
  it("shows a saved rectangular debris footprint and its blocked road", () => {
    const html = renderToStaticMarkup(
      createElement(EarthquakeLayer, {
        events: [],
        roadImpacts: [
          {
            ...impact,
            impactArea: {
              shape: "rectangle",
              latitude: 14.31,
              longitude: 121.1,
              widthMeters: 30,
              heightMeters: 50,
            },
          },
        ],
      }),
    );
    expect(html).toContain('data-polygon="true"');
    expect(html).toContain('data-road="true"');
    expect(html).toContain("Road blocked");
    expect(html).not.toContain('data-event="true"');
  });
  it("keeps the saved rotation when displaying a debris rectangle", () => {
    const area: EarthquakeRectangleArea = {
      shape: "rectangle",
      latitude: 14.31,
      longitude: 121.1,
      widthMeters: 30,
      heightMeters: 50,
    };
    const displayedCorners = (rotationDegrees?: number): [number, number][] => {
      const html = renderToStaticMarkup(
        createElement(EarthquakeLayer, {
          events: [],
          roadImpacts: [
            {
              ...impact,
              impactArea: {
                ...area,
                ...(rotationDegrees === undefined ? {} : { rotationDegrees }),
              },
            },
          ],
        }),
      );
      return JSON.parse(html.match(/data-positions="([^"]+)"/)![1]);
    };
    const legacy = displayedCorners();
    expect(legacy).toEqual(displayedCorners(0));
    expect(legacy).toHaveLength(4);
    const rotated = displayedCorners(90);
    const span = (corners: [number, number][], axis: number) =>
      Math.max(...corners.map((corner) => corner[axis])) -
      Math.min(...corners.map((corner) => corner[axis]));
    // A quarter-turn swaps the north/south and east/west side lengths.
    expect(span(rotated, 0) / span(legacy, 0)).toBeCloseTo(30 / 50, 5);
    expect(span(rotated, 1) / span(legacy, 1)).toBeCloseTo(50 / 30, 5);
    const diagonal = displayedCorners(45);
    expect(diagonal[0][0]).not.toBeCloseTo(diagonal[1][0], 6);
    expect(diagonal[0][1]).not.toBeCloseTo(diagonal[1][1], 6);
  });
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
