type PpsNutrient = "NO3" | "PO4" | "K" | "Mg" | "Fe" | "Cu" | "Mn" | "Zn";
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

//Helpers
const gallonsToLiters = (gallons: number): number => gallons * 3.78541;
const litersToGallons = (liters: number): number => liters / 3.78541;
const ppmToMg = (ppm: number, liters: number): number => ppm * liters;
const mgToPpm = (mg: number, liters: number): number => mg / liters;

const normalizeSolutionSpec = (spec: SolutionSpec): NormalizedSolution => {
  if (spec.kind === "ppm_per_reference_dose") {
    const factor = 10 / litersToGallons(gallonsToLiters(spec.referenceTankGallons) * (spec.referenceDoseMl / 1000));
    const ppmPer10g: PpmMap = {};
    for (const nutrient in spec.ppmAtReference) {
      const n = nutrient as PpsNutrient;
      ppmPer10g[n] = (spec.ppmAtReference[n] || 0) * factor;
    }
    return { ppmPer10g };
  } else if (spec.kind === "manual_ml_per_10g") {
    // Without ppm data, we can't normalize to ppm per 10g
    return { ppmPer10g: {} };
  } else {
    throw new Error("Unknown SolutionSpec kind");
  }
};
