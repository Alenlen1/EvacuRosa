import { OfflineRoutingEngine } from "./engine";
import type { OfflinePackage } from "../../../../backend/src/algorithms/offline";
import type { TravelMode } from "../travelTime";
import type { LatLng } from "../../../../backend/src/algorithms/routing";

let engine: OfflineRoutingEngine | null = null;
self.onmessage = (
  event: MessageEvent<{
    id: number;
    package?: OfflinePackage;
    start: LatLng;
    destination: LatLng | null;
    travelMode: TravelMode;
  }>,
) => {
  const { id, package: data, start, destination, travelMode } = event.data;
  try {
    if (data) {
      engine = new OfflineRoutingEngine(data);
      self.postMessage({ id, ready: true });
      return;
    }
    if (!engine) throw new Error("Offline routing data has not been loaded.");
    self.postMessage({
      id,
      ...engine.calculate(start, destination, travelMode),
    });
  } catch (error) {
    self.postMessage({
      id,
      error:
        error instanceof Error
          ? error.message
          : "Offline route calculation failed.",
    });
  }
};
