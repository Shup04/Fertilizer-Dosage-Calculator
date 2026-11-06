import { positive, nonnegative, normalizeSolutionSpec, ppmFromDose, solveDoseMlForTargetPpm } from "../solutions";
import type { PpsNutrient, PpmMap, SolutionSpec, NormalizedSolution } from "../solutions";
export { normalizeSolutionSpec, ppmFromDose, solveDoseMlForTargetPpm } from "../solutions";
export type { PpsNutrient, PpmMap, SolutionSpec, NormalizedSolution } from "../solutions";

export type EiSchedule = {
  macroDays: number[]; // [1,3,5]
  microDays: number[]; // [2,4,6]
  waterChangeDay: number; // 0
};

export type DoseEvent = {dayOfWeek: number; kind: "macro" | "micro"; ml: number};

export type EiLevel = "standard";

// placeholder numbers for now
const EI_TARGETS_PER_DOSE: Record<EiLevel, { macro: PpmMap; micro: PpmMap }> = {
  standard: {
    macro: { NO3: 6.87202044, PO4: 1.535401313, K: 4.0113204 }, // placeholder
    micro: { Fe: 0.266177692, Cu: 0.002430364, Mn: 0.04860728, Zn: 0.009721456 },                // placeholder
  },
};

export type EiPlan = {
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

export const buildEiPlan = (input: {
  tankGallons: number;
  level: EiLevel;
  macroSolution: SolutionSpec;
  microSolution: SolutionSpec;
  schedule?: EiSchedule;
}): EiPlan => {
  positive(input.tankGallons, "tankGallons");

  const source = input.schedule ?? DEFAULT_EI_SCHEDULE;
  const schedule = { macroDays: [...source.macroDays], microDays: [...source.microDays], waterChangeDay: source.waterChangeDay };
  const day = (d: number) => { if (!Number.isInteger(d) || d < 0 || d > 6) throw new Error("Schedule days must be integers 0..6"); };
  day(schedule.waterChangeDay);
  for (const days of [schedule.macroDays, schedule.microDays]) {
    if (days.length < 1 || days.length > 7 || new Set(days).size !== days.length) throw new Error("Each schedule requires 1..7 unique days");
    days.forEach(day);
  }
  const targets = EI_TARGETS_PER_DOSE[input.level];
  if (!targets) throw new Error("Unknown EI level");

  // --- Macro dose ---
  let macroMlPerDose: number;
  let impliedMacroPpmPerDose: PpmMap | undefined;

  if (input.macroSolution.kind === "manual_ml_per_10g") {
    // user says “dose X mL per 10g per dose”
    macroMlPerDose = positive(positive(input.macroSolution.mlPer10Gallons, "mlPer10Gallons") * (input.tankGallons / 10), "doseMl");
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
    microMlPerDose = positive(positive(input.microSolution.mlPer10Gallons, "mlPer10Gallons") * (input.tankGallons / 10), "doseMl");
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
