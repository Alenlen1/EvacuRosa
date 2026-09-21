import type { FuzzyMemberships, RiskLevel } from "./types";

export interface FuzzyRule {
  id: string;
  description: string;
  /** Firing strength for this rule given the current memberships — the
   * min() across every antecedent clause, per standard Mamdani inference. */
  strength: (m: FuzzyMemberships) => number;
  outputLevel: RiskLevel;
}

/**
 * Rules 1-4 are the spec's own worked examples (section 36). R5-R10 extend
 * coverage to distance and the not-yet-populated earthquake input. R11-R15
 * are baseline, single-factor rules — without them, a mid-range value on
 * one input with an unremarkable value everywhere else could fail to fire
 * ANY rule and silently fall back to "no elevated risk", which is wrong:
 * MODERATE flood should read as at least moderately risky even next to an
 * otherwise-fine road, not disappear because no combination rule matched
 * it exactly. Combination rules (R1, R7, R8, R10) still layer on top to
 * push risk higher when factors compound.
 */
export const fuzzyRules: FuzzyRule[] = [
  {
    id: "R1",
    description: "IF flood is HIGH AND road condition is POOR THEN risk is VERY_HIGH",
    strength: (m) => Math.min(m.flood.HIGH, m.roadCondition.POOR),
    outputLevel: "VERY_HIGH",
  },
  {
    id: "R2",
    description: "IF flood is LOW AND fire is NONE AND road condition is GOOD THEN risk is LOW",
    strength: (m) => Math.min(m.flood.LOW, m.fire.NONE, m.roadCondition.GOOD),
    outputLevel: "LOW",
  },
  {
    id: "R3",
    description: "IF fire is HIGH AND hazard exposure is HIGH THEN risk is VERY_HIGH",
    strength: (m) => Math.min(m.fire.HIGH, m.hazardExposure.HIGH),
    outputLevel: "VERY_HIGH",
  },
  {
    id: "R4",
    description: "IF flood is NONE AND fire is NONE AND road condition is GOOD THEN risk is VERY_LOW",
    strength: (m) => Math.min(m.flood.NONE, m.fire.NONE, m.roadCondition.GOOD),
    outputLevel: "VERY_LOW",
  },
  {
    id: "R5",
    description: "IF flood is SEVERE THEN risk is VERY_HIGH",
    strength: (m) => m.flood.SEVERE,
    outputLevel: "VERY_HIGH",
  },
  {
    id: "R6",
    description: "IF flood is MODERATE AND road condition is FAIR THEN risk is MODERATE",
    strength: (m) => Math.min(m.flood.MODERATE, m.roadCondition.FAIR),
    outputLevel: "MODERATE",
  },
  {
    id: "R7",
    description: "IF distance is FAR AND flood is MODERATE THEN risk is HIGH",
    strength: (m) => Math.min(m.distance.FAR, m.flood.MODERATE),
    outputLevel: "HIGH",
  },
  {
    id: "R8",
    description: "IF earthquake impact is HIGH AND road condition is POOR THEN risk is VERY_HIGH",
    strength: (m) => Math.min(m.earthquake.HIGH, m.roadCondition.POOR),
    outputLevel: "VERY_HIGH",
  },
  {
    id: "R9",
    description:
      "IF flood is NONE AND fire is NONE AND earthquake is NONE AND road condition is FAIR THEN risk is LOW",
    strength: (m) => Math.min(m.flood.NONE, m.fire.NONE, m.earthquake.NONE, m.roadCondition.FAIR),
    outputLevel: "LOW",
  },
  {
    id: "R10",
    description: "IF road condition is POOR AND distance is NEAR THEN risk is MODERATE",
    strength: (m) => Math.min(m.roadCondition.POOR, m.distance.NEAR),
    outputLevel: "MODERATE",
  },
  {
    id: "R11",
    description: "IF flood is LOW THEN risk is at least LOW",
    strength: (m) => m.flood.LOW,
    outputLevel: "LOW",
  },
  {
    id: "R12",
    description: "IF flood is MODERATE THEN risk is at least MODERATE",
    strength: (m) => m.flood.MODERATE,
    outputLevel: "MODERATE",
  },
  {
    id: "R13",
    description: "IF flood is HIGH THEN risk is at least HIGH",
    strength: (m) => m.flood.HIGH,
    outputLevel: "HIGH",
  },
  {
    id: "R14",
    description: "IF road condition is POOR THEN risk is at least MODERATE",
    strength: (m) => m.roadCondition.POOR,
    outputLevel: "MODERATE",
  },
  {
    id: "R15",
    description: "IF road condition is FAIR THEN risk is at least LOW",
    strength: (m) => m.roadCondition.FAIR,
    outputLevel: "LOW",
  },
  {
    id: "R16",
    description: "IF earthquake impact is LOW THEN risk is at least LOW",
    strength: (m) => m.earthquake.LOW,
    outputLevel: "LOW",
  },
  {
    id: "R17",
    description: "IF earthquake impact is MODERATE THEN risk is at least MODERATE",
    strength: (m) => m.earthquake.MODERATE,
    outputLevel: "MODERATE",
  },
  {
    id: "R18",
    description: "IF earthquake impact is HIGH THEN risk is at least HIGH",
    strength: (m) => m.earthquake.HIGH,
    outputLevel: "HIGH",
  },
];
