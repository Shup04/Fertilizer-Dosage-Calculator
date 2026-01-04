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

// Target ppm increase levels per day for pps
type PpsLevel = "low" | "medium" | "very_high";

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

// We know the ppm increase per 1 ml per 10 gallons.
// So based on if the user wants a low, medium, or high dosing, we need to find out the ml dose per day from the reccomended levels.
// first we need to find the ppm per 1ml of the anchor nutrients for macro and micro.
// Then we can calculate ml dose needed according to this:
// dosePpm/1Ml = targetPpm/doseMl
// thus doseMl = targetPpm / dosePpm

const solveMlPerDoseFromAnchor = (input: {
  tankGallons: number;
  normalized: NormalizedSolution;
  targetPpmPerDose: number; // for anchor nutrient
  anchor: PpsNutrient;
}): number => {
  // doseMl = targetPpm * (tankGallons / 10) / ppmPer1MlPer10g[anchor]
  // validate map has anchor value
  // return computed dose
  if (input.tankGallons <=0) throw new Error("Tank size must be positive.");
  if (input.targetPpmPerDose <=0) throw new Error("Target ppm increase must be positive.");
  const ppmPer10g = input.normalized.ppmPer10g[input.anchor];
  if (ppmPer10g === undefined || ppmPer10g <=0) {
    throw new Error(`Normalized solution does not provide ppm data for anchor nutrient ${input.anchor}`);
  }
  const doseMl = (PPS_TARGETS_PER_DAY.medium[input.anchor]! / ppmPer10g);
  return doseMl;
};

const impliedPpmFromDose = (input: {
  tankGallons: number;
  normalized: NormalizedSolution;
doseMl: number;
}): PpmMap => {
  if (input.tankGallons <=0) throw new Error("Tank size must be positive.");
  if (input.doseMl <=0) throw new Error("Dose ml must be positive.");
  const ppmMap: PpmMap = {};
  for (const nutrient in input.normalized.ppmPer10g) {
    const n = nutrient as PpsNutrient;
    const ppmPer10g = input.normalized.ppmPer10g[n];
    if (ppmPer10g !== undefined) {
      ppmMap[n] = ppmPer10g * (input.doseMl / 1);
    }
  }
  return ppmMap;
}

type PpsPlan = {
  macroMlPerDose: number;
  microMlPerDose: number;
  dosesPerWeek: number; // probably 7
  daysOfWeek: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  impliedMacroPpm?: PpmMap;
  impliedMicroPpm?: PpmMap;
};

const buildPpsPlan = (input: {
  tankGallons: number;
  ppsLevel: PpsLevel;
  macroSolution: SolutionSpec;
  microSolution: SolutionSpec;
  dosesPerWeek: number;
}): PpsPlan => {
  // Normalize solutions
  const normalizedMacro = normalizeSolutionSpec(input.macroSolution);
  const normalizedMicro = normalizeSolutionSpec(input.microSolution);

  const macroDoseMl = solveMlPerDoseFromAnchor({
    tankGallons: input.tankGallons,
    normalized: normalizedMacro,
    targetPpmPerDose: PPS_TARGETS_PER_DAY[input.ppsLevel]["NO3"]!,
    anchor: "NO3",
  });
  const microDoseMl = solveMlPerDoseFromAnchor({
    tankGallons: input.tankGallons,
    normalized: normalizedMicro,
    targetPpmPerDose: PPS_TARGETS_PER_DAY[input.ppsLevel]["Fe"]!,
    anchor: "Fe",
  });
  const impliedMacroPpm = impliedPpmFromDose({
    tankGallons: input.tankGallons,
    normalized: normalizedMacro,
    doseMl: macroDoseMl,
  });
  const impliedMicroPpm = impliedPpmFromDose({
    tankGallons: input.tankGallons,
    normalized: normalizedMicro,
    doseMl: microDoseMl,
  });
  return {
    macroMlPerDose: macroDoseMl,
    microMlPerDose: microDoseMl,
    dosesPerWeek: input.dosesPerWeek,
    daysOfWeek: Array.from({ length: input.dosesPerWeek }, (_, i) => Math.floor((i * 7) / input.dosesPerWeek)),
    impliedMacroPpm,
    impliedMicroPpm,
  };
}


