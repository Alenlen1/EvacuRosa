import type { RiskLevel } from "./types";

export const RISK_LEVEL_SCORE: Record<RiskLevel, number> = {
  VERY_LOW: 0,
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  VERY_HIGH: 4,
};

const LEVEL_ORDER: RiskLevel[] = ["VERY_LOW", "LOW", "MODERATE", "HIGH", "VERY_HIGH"];

export interface RuleActivation {
  outputLevel: RiskLevel;
  strength: number;
}

/**
 * Max-membership defuzzification: the output level is whichever fired rule
 * has the strongest support, not a weighted average across every rule that
 * fired. This is a deliberate choice, not the simplest option: this rule
 * base has both general single-factor rules ("flood is HIGH -> HIGH") and
 * more specific combination rules that subsume them ("flood is HIGH AND
 * road is POOR -> VERY_HIGH"). Both necessarily co-fire at similar
 * strength whenever the specific case applies, so a weighted average would
 * systematically pull a clear VERY_HIGH case back toward HIGH — exactly
 * backwards for a hazard router that should err toward the more severe
 * reading. Ties are broken toward the MORE severe level for the same
 * reason this project never claims a route is "100% safe".
 */
export function defuzzify(activations: RuleActivation[]): RiskLevel {
  const firing = activations.filter((a) => a.strength > 1e-9);
  if (firing.length === 0) return "VERY_LOW";

  let bestLevel: RiskLevel = "VERY_LOW";
  let bestStrength = -1;

  for (const { outputLevel, strength } of firing) {
    const isBetter =
      strength > bestStrength + 1e-9 ||
      (Math.abs(strength - bestStrength) <= 1e-9 &&
        LEVEL_ORDER.indexOf(outputLevel) > LEVEL_ORDER.indexOf(bestLevel));
    if (isBetter) {
      bestLevel = outputLevel;
      bestStrength = strength;
    }
  }

  return bestLevel;
}
