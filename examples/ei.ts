import { buildEiPlan, ppmFromDose, normalizeSolutionSpec } from "../src/presets/ei";
import type { SolutionSpec } from "../src/presets/ei";

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

