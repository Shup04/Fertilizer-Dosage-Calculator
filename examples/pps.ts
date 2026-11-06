import { buildPpsPlan, ppmFromDose, normalizeSolutionSpec } from "../src/presets/pps";
import type { SolutionSpec } from "../src/presets/pps";

const tankGallons = 10;

// Example “label” data:
// “When dosing 2 mL into 10 gallons, you add these ppm”
const macroSolution: SolutionSpec = {
  kind: "ppm_per_reference_dose",
  referenceTankGallons: tankGallons,
  referenceDoseMl: 2,
  ppmAtReference: {
    NO3: 2.242293966,
    PO4: 0.249380468,
    K: 2.657750354,
    Mg: 0.218823675,
    S: 0.767019389,
  },
};

const microSolution: SolutionSpec = {
  kind: "ppm_per_reference_dose",
  referenceTankGallons: tankGallons,
  referenceDoseMl: 2,
  ppmAtReference: {
    Fe: 0.076186628,
    Mn: 0.021767608,
    Zn: 0.004353522,
    Cu: 0.001088380,
  },
};

const plan = buildPpsPlan({
  tankGallons,
  ppsLevel: "medium",
  macroSolution,
  microSolution,
  dosesPerWeek: 7,
});

console.log("---- PPS Test Plan ----");
console.log("Tank (g):", tankGallons);
console.log("Macro mL per dose:", plan.macroMlPerDose.toFixed(3));
console.log("Micro mL per dose:", plan.microMlPerDose.toFixed(3));
console.log("Days of week:", plan.daysOfWeek);
console.log("Implied Macro ppm per dose:", plan.impliedMacroPpm);
console.log("Implied Micro ppm per dose:", plan.impliedMicroPpm);

const expectedDose = ppmFromDose({tankGallons: tankGallons, normalized: normalizeSolutionSpec(macroSolution), doseMl: 2});
console.log("Recomputed Macro ppm from dose:", expectedDose);

