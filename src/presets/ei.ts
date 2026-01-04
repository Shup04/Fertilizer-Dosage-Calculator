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

type DoseEvent = {dayOfWeek: number; kind: "macro" | "micro"; ml: number};

type EiLevel = "standard";

// placeholder numbers for now
const EI_TARGETS_PER_DOSE: Record<EiLevel, { macro: PpmMap; micro: PpmMap }> = {
  standard: {
    macro: { NO3: 6.87202044, PO4: 1.535401313, K: 4.0113204 }, // placeholder
    micro: { Fe: 0.266177692, Cu: 0.002430364, Mn: 0.04860728, Zn: 0.009721456 },                // placeholder
  },
};

type EiPlan = {
  level: EiLevel;
  schedule: EiSchedule;

  macroMlPerDose: number;
  microMlPerDose: number;

  events: { dayOfWeek: number; kind: "macro" | "micro"; ml: number }[];

  impliedMacroPpmPerDose: PpmMap | undefined;
  impliedMicroPpmPerDose: PpmMap | undefined;
};

const DEFAULT_EI_SCHEDULE: EiSchedule = {
  macroDays: [1, 3, 5], // Mon Wed Fri
  microDays: [2, 4, 6], // Tue Thu Sat
  waterChangeDay: 0,    // Sun
};

const buildEiEvents = (input: {
  schedule: EiSchedule;
  macroMlPerDose: number;
  microMlPerDose: number;
}): { dayOfWeek: number; kind: "macro" | "micro"; ml: number }[] => {
  const events: { dayOfWeek: number; kind: "macro" | "micro"; ml: number }[] = [];

  for (const d of input.schedule.macroDays) {
    events.push({ dayOfWeek: d, kind: "macro", ml: input.macroMlPerDose });
  }
  for (const d of input.schedule.microDays) {
    events.push({ dayOfWeek: d, kind: "micro", ml: input.microMlPerDose });
  }

  events.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  return events;
};

const ppmFromDose = (input: {
  tankGallons: number;
  normalized: NormalizedSolution;
  doseMl: number;
}): PpmMap => {
  if (input.tankGallons <= 0) throw new Error("tankGallons must be positive");
  if (input.doseMl < 0) throw new Error("doseMl must be >= 0");

  const out: PpmMap = {};
  const tankScale = 10 / input.tankGallons;

  for (const k in input.normalized.ppmPer10g) {
    const n = k as PpsNutrient;
    const ppmPer10g = input.normalized.ppmPer10g[n];
    if (ppmPer10g === undefined) continue;
    out[n] = ppmPer10g * input.doseMl * tankScale;
  }
  return out;
};

// Inverse: dose mL needed to hit target ppm for one nutrient
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

  return input.targetPpm * (input.tankGallons / 10) / ppmPer10g;
};

const buildEiPlan = (input: {
  tankGallons: number;
  level: EiLevel;
  macroSolution: SolutionSpec;
  microSolution: SolutionSpec;
  schedule?: EiSchedule;
}): EiPlan => {
  if (input.tankGallons <= 0) throw new Error("Tank size must be positive");

  const schedule = input.schedule ?? DEFAULT_EI_SCHEDULE;
  const targets = EI_TARGETS_PER_DOSE[input.level];

  // --- Macro dose ---
  let macroMlPerDose: number;
  let impliedMacroPpmPerDose: PpmMap | undefined;

  if (input.macroSolution.kind === "manual_ml_per_10g") {
    // user says “dose X mL per 10g per dose”
    macroMlPerDose = input.macroSolution.mlPer10Gallons * (input.tankGallons / 10);
  } else {
    const normalizedMacro = normalizeSolutionSpec(input.macroSolution);
    const macroAnchorTarget = targets.macro.NO3 ?? 0;
    if (macroAnchorTarget <= 0) throw new Error("EI macro target NO3 must be > 0 for anchor solving.");

    macroMlPerDose = solveDoseMlForTargetPpm({
      tankGallons: input.tankGallons,
      normalized: normalizedMacro,
      targetPpm: macroAnchorTarget,
      nutrient: "NO3",
    });

    impliedMacroPpmPerDose = ppmFromDose({
      tankGallons: input.tankGallons,
      normalized: normalizedMacro,
      doseMl: macroMlPerDose,
    });
  }

  // --- Micro dose ---
  let microMlPerDose: number;
  let impliedMicroPpmPerDose: PpmMap | undefined;

  if (input.microSolution.kind === "manual_ml_per_10g") {
    microMlPerDose = input.microSolution.mlPer10Gallons * (input.tankGallons / 10);
  } else {
    const normalizedMicro = normalizeSolutionSpec(input.microSolution);
    const microAnchorTarget = targets.micro.Fe ?? 0;
    if (microAnchorTarget <= 0) throw new Error("EI micro target Fe must be > 0 for anchor solving.");

    microMlPerDose = solveDoseMlForTargetPpm({
      tankGallons: input.tankGallons,
      normalized: normalizedMicro,
      targetPpm: microAnchorTarget,
      nutrient: "Fe",
    });

    impliedMicroPpmPerDose = ppmFromDose({
      tankGallons: input.tankGallons,
      normalized: normalizedMicro,
      doseMl: microMlPerDose,
    });
  }

  const events = buildEiEvents({
    schedule,
    macroMlPerDose,
    microMlPerDose,
  });

  return {
    level: input.level,
    schedule,
    macroMlPerDose,
    microMlPerDose,
    events,
    impliedMacroPpmPerDose,
    impliedMicroPpmPerDose,
  };
};
//
// -------------------- Quick EI Test Case --------------------

// 1) Tank
const tankGallons = 10;

// 2) Example “label” data (same style as your PPS test):
// “When dosing 2 mL into 10 gallons, you add these ppm”
const macroSolution: SolutionSpec = {
  kind: "ppm_per_reference_dose",
  referenceTankGallons: 10,
  referenceDoseMl: 2,
  ppmAtReference: {
    NO3: 6.87202044,
    PO4: 1.535401313,
    K: 4.0113204,
  },
};

const microSolution: SolutionSpec = {
  kind: "ppm_per_reference_dose",
  referenceTankGallons: 10,
  referenceDoseMl: 2,
  ppmAtReference: {
    Fe: 0.266177692,
    Mn: 0.04860728,
    Zn: 0.009721456,
    Cu: 0.002430364,
  },
};

// 3) Build EI plan (uses your placeholder EI targets per dose)
const plan = buildEiPlan({
  tankGallons,
  level: "standard",
  macroSolution,
  microSolution,
  // schedule: DEFAULT_EI_SCHEDULE, // optional
});

// 4) Print results
console.log("---- EI Test Plan ----");
console.log("Tank (g):", tankGallons);
console.log("Macro mL per dose:", plan.macroMlPerDose.toFixed(3));
console.log("Micro mL per dose:", plan.microMlPerDose.toFixed(3));
console.log("Schedule:", plan.schedule);
console.log("Events:", plan.events);

console.log("Implied Macro ppm per dose:", plan.impliedMacroPpmPerDose);
console.log("Implied Micro ppm per dose:", plan.impliedMicroPpmPerDose);

// 5) Sanity checks: what does 2 mL do in 10g according to your normalization?
const normalizedMacro = normalizeSolutionSpec(macroSolution);
const normalizedMicro = normalizeSolutionSpec(microSolution);

console.log("--- Sanity check: 2 mL into 10g ---");
console.log("Macro ppm from 2 mL:", ppmFromDose({ tankGallons: 10, normalized: normalizedMacro, doseMl: 2 }));
console.log("Micro ppm from 2 mL:", ppmFromDose({ tankGallons: 10, normalized: normalizedMicro, doseMl: 2 }));
