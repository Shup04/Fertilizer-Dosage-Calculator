type PpsNutrient = "NO3" | "PO4" | "K" | "Mg" | "Fe" | "Cu" | "Mn" | "Zn" | "S";
type PpmMap = Partial<Record<PpsNutrient, number>>;

type SolutionSpec =
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

type NormalizedSolution = { ppmPer10g: PpmMap; }; // normalized to per 10 gallons

type EiSchedule = {
  macroDays: number[]; // [1,3,5]
  microDays: number[]; // [2,4,6]
  waterChangeDay: number; // 0
};

//Helpers
const gallonsToLiters = (gallons: number): number => gallons * 3.78541;
const litersToGallons = (liters: number): number => liters / 3.78541;
const ppmToMg = (ppm: number, liters: number): number => ppm * liters;
const mgToPpm = (mg: number, liters: number): number => mg / liters;

const normalizeSolutionSpec = (spec: SolutionSpec): NormalizedSolution => {
  if (spec.kind === "ppm_per_reference_dose") {
    if (spec.referenceTankGallons <= 0) throw new Error("referenceTankGallons must be positive");
    if (spec.referenceDoseMl <= 0) throw new Error("referenceDoseMl must be positive");

    const ppmPer10g: PpmMap = {};
    const volumeScale = 10 / spec.referenceTankGallons;
    const doseScale = 1 / spec.referenceDoseMl;

    for (const nutrient in spec.ppmAtReference) {
      const n = nutrient as PpsNutrient;
      const ppm = spec.ppmAtReference[n];
      if (ppm === undefined) continue;
      ppmPer10g[n] = ppm * volumeScale * doseScale;
    }
    return { ppmPer10g };
  }

  if (spec.kind === "manual_ml_per_10g") {
    return { ppmPer10g: {} };
  }

  throw new Error("Unknown SolutionSpec kind");
};

