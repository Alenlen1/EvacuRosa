import type { TravelMode } from "../algorithms/astar/access";
export interface RouteRequestBody {
  travelMode?: TravelMode;
  start: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
}
