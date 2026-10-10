import "leaflet";
declare module "leaflet" {
  interface MapOptions {
    rotate?: boolean;
    bearing?: number;
    rotateControl?: boolean;
    touchRotate?: boolean;
    shiftKeyRotate?: boolean;
  }
  interface Map {
    setBearing(degrees: number): void;
    getBearing(): number;
  }
}
