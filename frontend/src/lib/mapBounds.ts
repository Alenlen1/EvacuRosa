/** Published Santa Rosa barangay boundary shared with server validation. */
import { santaRosaBounds } from "../../../backend/src/geography/santaRosa";
export { isInsideSantaRosa } from "../../../backend/src/geography/santaRosa";
export const SANTA_ROSA_CITY_CENTER: [number, number] = [14.3146, 121.1137];
export const SANTA_ROSA_CITY_BOUNDS = santaRosaBounds;
export const SANTA_ROSA_CITY_DEFAULT_ZOOM = 13;
export const PUBLIC_MAP_MIN_ZOOM = 16;
