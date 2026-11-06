export type PpsNutrient = "NO3" | "PO4" | "K" | "Mg" | "Fe" | "Cu" | "Mn" | "Zn" | "S";
export type PpmMap = Partial<Record<PpsNutrient, number>>;

export type SolutionSpec =
  | {
      kind: "ppm_per_reference_dose"; // If the users ferts specify ppm per dose.
      referenceTankGallons: number;
      referenceDoseMl: number;
      ppmAtReference: PpmMap;       
    }
  | {
      kind: "manual_ml_per_10g"; // If the users ferts dont specify ppm per dose.
      mlPer10Gallons: number; 
    };

export type NormalizedSolution = { ppmPer10g: PpmMap; }; // ppm from 1 mL in 10 gallons


export const positive = (value: number, name: string): number => {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be finite and positive`);
  return value;
};
export const nonnegative = (value: number, name: string): number => {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be finite and nonnegative`);
  return value;
};
export const validatePpm = (map: PpmMap): void => {
  for (const [key, value] of Object.entries(map)) {
    if (!["NO3", "PO4", "K", "Mg", "Fe", "Cu", "Mn", "Zn", "S"].includes(key)) throw new Error(`Unknown nutrient ${key}`);
    if (value !== undefined) nonnegative(value, key);
  }
};
export const normalizeSolutionSpec = (spec: SolutionSpec): NormalizedSolution => {
  if (spec.kind === "ppm_per_reference_dose") {
    positive(spec.referenceTankGallons, "referenceTankGallons");
    positive(spec.referenceDoseMl, "referenceDoseMl");

    validatePpm(spec.ppmAtReference);
    const ppmPer10g: PpmMap = {};
    // The same dose is more concentrated in 10 gallons than in a larger reference tank.
    const volumeScale = spec.referenceTankGallons / 10;
    const doseScale = 1 / spec.referenceDoseMl;

    for (const [nutrient, ppm] of Object.entries(spec.ppmAtReference)) {
      const n = nutrient as PpsNutrient;
      if (ppm === undefined) continue;
      ppmPer10g[n] = nonnegative(ppm * volumeScale * doseScale, "normalized ppm");
    }
    return { ppmPer10g };
  }

  if (spec.kind === "manual_ml_per_10g") {
    positive(spec.mlPer10Gallons, "mlPer10Gallons");
    throw new Error("Manual dose has unknown nutrient composition");
  }

  throw new Error("Unknown SolutionSpec kind");
};

export const ppmFromDose = (input: {
  tankGallons: number;
  normalized: NormalizedSolution;
  doseMl: number;
}): PpmMap => {
  positive(input.tankGallons, "tankGallons");
  nonnegative(input.doseMl, "doseMl");

  validatePpm(input.normalized.ppmPer10g);
  const out: PpmMap = {};
  const tankScale = 10 / input.tankGallons;

  for (const [k, ppmPer10g] of Object.entries(input.normalized.ppmPer10g)) {
    const n = k as PpsNutrient;
    if (ppmPer10g === undefined) continue;
    out[n] = nonnegative(ppmPer10g * input.doseMl * tankScale, "implied ppm");
  }
  return out;
};

// Inverse: dose mL needed to hit target ppm for one nutrient
export const solveDoseMlForTargetPpm = (input: {
  tankGallons: number;
  normalized: NormalizedSolution;
  targetPpm: number;
  nutrient: PpsNutrient;
}): number => {
  positive(input.tankGallons, "tankGallons");
  nonnegative(input.targetPpm, "targetPpm");

  validatePpm(input.normalized.ppmPer10g);
  const ppmPer10g = input.normalized.ppmPer10g[input.nutrient];
  if (!Object.prototype.hasOwnProperty.call(input.normalized.ppmPer10g, input.nutrient) || ppmPer10g === undefined || ppmPer10g <= 0) {
    throw new Error(`No ppm data for nutrient ${input.nutrient}`);
  }

  return nonnegative(input.targetPpm * (input.tankGallons / 10) / ppmPer10g, "doseMl");
};

