import { fuzzify } from "./membershipFunctions";
import { fuzzyRules } from "./fuzzyRules";
import { defuzzify, RISK_LEVEL_SCORE } from "./defuzzification";
import type { FuzzyRiskInput, RiskLevel } from "./types";

export interface FiredRule {
  id: string;
  description: string;
  strength: number;
}

export interface FuzzyRiskResult {
  riskScore: number; // 0-4, exactly matches one of the five RiskLevel anchors
  riskLevel: RiskLevel;
  firedRules: FiredRule[]; // for the eventual "why this route" explanation
}

/** The actual inference process: fuzzify inputs, evaluate every rule's
 * firing strength (Mamdani min-composition), defuzzify via max-membership.
 * This is real inference, not a lookup table or if/else chain — the rule
 * table and membership shapes are what a domain expert would tune, not
 * this function. */
export function evaluateRoadRisk(input: FuzzyRiskInput): FuzzyRiskResult {
  const memberships = fuzzify(input);

  const activations = fuzzyRules
    .map((rule) => ({
      id: rule.id,
      description: rule.description,
      outputLevel: rule.outputLevel,
      strength: rule.strength(memberships),
    }))
    .filter((a) => a.strength > 0);

  const riskLevel = defuzzify(activations);
  const riskScore = RISK_LEVEL_SCORE[riskLevel];

  return {
    riskScore,
    riskLevel,
    firedRules: activations
      .map(({ id, description, strength }) => ({ id, description, strength }))
      .sort((a, b) => b.strength - a.strength),
  };
}

export function severityToNumeric(
  severity: "NONE" | "LOW" | "MODERATE" | "HIGH" | "SEVERE"
): number {
  return { NONE: 0, LOW: 1, MODERATE: 2, HIGH: 3, SEVERE: 4 }[severity];
}
