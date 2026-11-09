import { positive, nonnegative, normalizeSolutionSpec, ppmFromDose, solveDoseMlForTargetPpm } from "../solutions";
import type { PpsNutrient, PpmMap, SolutionSpec, NormalizedSolution } from "../solutions";
export { normalizeSolutionSpec, ppmFromDose, solveDoseMlForTargetPpm } from "../solutions";
export type { PpsNutrient, PpmMap, SolutionSpec, NormalizedSolution } from "../solutions";

// Target ppm increase levels per day for pps
export type PpsLevel = "low" | "medium" | "very_high";

const PPS_TARGETS_PER_DAY: Record<PpsLevel, PpmMap> = {
  low: {
    NO3: 0.5,
    PO4: 0.05,
    K: 0.665,
    Mg: 0.05,
    Fe: 0.025,
  },
  medium: {
    NO3: 1.0,
    PO4: 0.1,
    K: 1.33,
    Mg: 0.1,
    Fe: 0.05,
  },
  very_high: {
    NO3: 2.0,
    PO4: 0.2,
    K: 2.66,
    Mg: 0.2,
    Fe: 0.10,
  },
};

export const solveMlPerDoseFromAnchor = (input: {
  tankGallons: number; normalized: NormalizedSolution; targetPpmPerDose: number; anchor: PpsNutrient;
}): number => solveDoseMlForTargetPpm({ tankGallons: input.tankGallons, normalized: input.normalized, targetPpm: input.targetPpmPerDose, nutrient: input.anchor });

export type PpsPlan = {
  macroMlPerDose: number;
  microMlPerDose: number;
  dosesPerWeek: number; // probably 7
  daysOfWeek: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  impliedMacroPpm: PpmMap | undefined;
  impliedMicroPpm: PpmMap | undefined;
};

export const buildPpsPlan = (input: {
  tankGallons: number; ppsLevel: PpsLevel; macroSolution: SolutionSpec; microSolution: SolutionSpec; dosesPerWeek: number;
}): PpsPlan => {
  positive(input.tankGallons, "tankGallons");
  if (!Number.isInteger(input.dosesPerWeek) || input.dosesPerWeek < 1 || input.dosesPerWeek > 7) throw new Error("dosesPerWeek must be an integer 1..7");
  if (!Object.prototype.hasOwnProperty.call(PPS_TARGETS_PER_DAY, input.ppsLevel)) throw new Error("Unknown preset level");
  const targets = PPS_TARGETS_PER_DAY[input.ppsLevel];
  if (!targets) throw new Error("Unknown PPS level");
  const dose = (spec: SolutionSpec, anchor: PpsNutrient) => {
    if (spec.kind === "manual_ml_per_10g") return {
      ml: positive(positive(spec.mlPer10Gallons, "mlPer10Gallons") * (input.tankGallons / 10), "doseMl"), ppm: undefined,
    };
    const normalized = normalizeSolutionSpec(spec);
    const ml = solveMlPerDoseFromAnchor({ tankGallons: input.tankGallons, normalized,
      targetPpmPerDose: (targets[anchor] ?? 0) * 7 / input.dosesPerWeek, anchor });
    return { ml, ppm: ppmFromDose({ tankGallons: input.tankGallons, normalized, doseMl: ml }) };
  };
  const macro = dose(input.macroSolution, "NO3");
  const micro = dose(input.microSolution, "Fe");
  return {
    macroMlPerDose: macro.ml, microMlPerDose: micro.ml,
    dosesPerWeek: input.dosesPerWeek,
    daysOfWeek: Array.from({ length: input.dosesPerWeek }, (_, i) => Math.floor(i * 7 / input.dosesPerWeek)),
    impliedMacroPpm: macro.ppm, impliedMicroPpm: micro.ppm,
  };
};
