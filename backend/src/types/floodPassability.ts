import type { FloodSeverity } from "./flood";

export function isFloodImpassable(severity: FloodSeverity): boolean {
  return severity === "HIGH" || severity === "SEVERE";
}

export function isFloodSeverity(value: unknown): value is FloodSeverity {
  return (
    typeof value === "string" &&
    ["NONE", "LOW", "MODERATE", "HIGH", "SEVERE"].includes(value)
  );
}
