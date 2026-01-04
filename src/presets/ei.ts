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

const solveDoseMlForTargetPpm = (input: {
  tankGallons: number;
  normalized: NormalizedSolution;
  targetPpm: number;
  nutrient: PpsNutrient;
}): number => {
  if (input.tankGallons <= 0) throw new Error("tankGallons must be positive");
  if (input.targetPpm < 0) throw new Error("targetPpm must be >= 0");

  const ppmPer10g = input.normalized.ppmPer10g[input.nutrient];
  if (ppmPer10g === undefined || ppmPer10g <= 0) {
    throw new Error(`No ppm data for nutrient ${input.nutrient}`);
  }

  // targetPpm = ppmPer10g * doseMl * (10 / tankGallons)
  // doseMl = targetPpm * (tankGallons / 10) / ppmPer10g
  return input.targetPpm * (input.tankGallons / 10) / ppmPer10g;
};

const DEFAULT_EI_SCHEDULE: EiSchedule = {
  macroDays: [1, 3, 5],
  microDays: [2, 4, 6],
  waterChangeDay: 0,
}

type DoseEvent = {dayOfWeek: number; kind: "macro" | "micro"; ml: number};

const buildEiEvents = (input: {
  schedule: EiSchedule;
  macroMlPerDose: number;
  microMlPerDose: number;
}): DoseEvent[] => {
  const events: DoseEvent[] = [];

  for (const d of input.schedule.macroDays) events.push({ dayOfWeek: d, kind: "macro", ml: input.macroMlPerDose });
  for (const d of input.schedule.microDays) events.push({ dayOfWeek: d, kind: "micro", ml: input.microMlPerDose });

  // sort by day for nicer output
  events.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  return events;
};

type EiLevel = "standard";

// placeholder numbers for now
const EI_PER_DOSE_TARGETS: Record<EiLevel, { macro: PpmMap; micro: PpmMap }> = {
  standard: {
    macro: { NO3: 5, PO4: 0.5, K: 5 }, // example only
    micro: { Fe: 0.1 },                // example only
  },
};


