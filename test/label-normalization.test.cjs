const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const pps = require("../src/presets/pps.ts");
const ei = require("../src/presets/ei.ts");

function assertClose(actual, expected) {
  assert.ok(
    Math.abs(actual - expected) < 1e-12,
    `expected ${expected}, received ${actual}`,
  );
}

function assertPpm(actual, expected) {
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort());
  for (const nutrient of Object.keys(expected)) {
    assertClose(actual[nutrient], expected[nutrient]);
  }
}

const presets = [
  {
    name: "PPS",
    ...pps,
    solveDose: (tankGallons, normalized, targetPpm, nutrient) =>
      pps.solveMlPerDoseFromAnchor({
        tankGallons, normalized, targetPpmPerDose: targetPpm, anchor: nutrient,
      }),
  },
  {
    name: "EI",
    ...ei,
    solveDose: (tankGallons, normalized, targetPpm, nutrient) =>
      ei.solveDoseMlForTargetPpm({
        tankGallons, normalized, targetPpm, nutrient,
      }),
  },
];

// Each normalized map is hand-calculated from label ppm * gallons / (10 * mL).
// Check these independent values, not just mutually inverse helper functions.
const labels = [
  { gallons: 10, ml: 2, expected: { NO3: 2, PO4: 0.25, Fe: 0.1, K: 0 } },
  { gallons: 20, ml: 2, expected: { NO3: 4, PO4: 0.5, Fe: 0.2, K: 0 } },
  { gallons: 5, ml: 4, expected: { NO3: 0.5, PO4: 0.0625, Fe: 0.025, K: 0 } },
  { gallons: 37.5, ml: 1.5, expected: { NO3: 10, PO4: 1.25, Fe: 0.5, K: 0 } },
];

for (const preset of presets) {
  describe(`${preset.name} label normalization`, () => {
    for (const label of labels) {
      const spec = {
        kind: "ppm_per_reference_dose",
        referenceTankGallons: label.gallons,
        referenceDoseMl: label.ml,
        ppmAtReference: { NO3: 4, PO4: 0.5, Fe: 0.2, K: 0 },
      };

      it(`normalizes ${label.ml} mL in ${label.gallons} gallons to 1 mL in 10 gallons`, () => {
        const normalized = preset.normalizeSolutionSpec(spec);
        assertPpm(normalized.ppmPer10g, label.expected);
        assertPpm(spec.ppmAtReference, { NO3: 4, PO4: 0.5, Fe: 0.2, K: 0 });
      });

      it(`reproduces the label at ${label.ml} mL in ${label.gallons} gallons`, () => {
        const normalized = preset.normalizeSolutionSpec(spec);
        assertPpm(preset.ppmFromDose({
          tankGallons: label.gallons,
          normalized,
          doseMl: label.ml,
        }), spec.ppmAtReference);
      });

      it(`solves the original ${label.ml} mL dose for both anchors in ${label.gallons} gallons`, () => {
        const normalized = preset.normalizeSolutionSpec(spec);
        assertClose(preset.solveDose(label.gallons, normalized, 4, "NO3"), label.ml);
        assertClose(preset.solveDose(label.gallons, normalized, 0.2, "Fe"), label.ml);
      });
    }

    it("scales concentration inversely with tank size and linearly with dose", () => {
      const normalized = preset.normalizeSolutionSpec({
        kind: "ppm_per_reference_dose",
        referenceTankGallons: 20,
        referenceDoseMl: 2,
        ppmAtReference: { NO3: 4, PO4: 0.5 },
      });

      assertPpm(preset.ppmFromDose({ tankGallons: 40, normalized, doseMl: 2 }), { NO3: 2, PO4: 0.25 });
      assertPpm(preset.ppmFromDose({ tankGallons: 10, normalized, doseMl: 2 }), { NO3: 8, PO4: 1 });
      assertPpm(preset.ppmFromDose({ tankGallons: 20, normalized, doseMl: 4 }), { NO3: 8, PO4: 1 });
      assertPpm(preset.ppmFromDose({ tankGallons: 40, normalized, doseMl: 4 }), { NO3: 4, PO4: 0.5 });
      assertClose(preset.solveDose(40, normalized, 4, "NO3"), 4);
      assertClose(preset.solveDose(10, normalized, 4, "NO3"), 1);
    });
  });
}

const macroSolution = {
  kind: "ppm_per_reference_dose",
  referenceTankGallons: 20,
  referenceDoseMl: 2,
  ppmAtReference: { NO3: 4, PO4: 0.5, K: 2 },
};
const microSolution = {
  kind: "ppm_per_reference_dose",
  referenceTankGallons: 20,
  referenceDoseMl: 2,
  ppmAtReference: { Fe: 0.2, Mn: 0.04 },
};

it("PPS plans use the corrected macro and micro doses in a different tank", () => {
  const plan = pps.buildPpsPlan({
    tankGallons: 40,
    ppsLevel: "medium",
    macroSolution,
    microSolution,
    dosesPerWeek: 7,
  });

  // In 40 gallons each mL adds 1 ppm NO3 or 0.05 ppm Fe.
  assertClose(plan.macroMlPerDose, 1);
  assertClose(plan.microMlPerDose, 1);
  assertPpm(plan.impliedMacroPpm, { NO3: 1, PO4: 0.125, K: 0.5 });
  assertPpm(plan.impliedMicroPpm, { Fe: 0.05, Mn: 0.01 });
});

it("EI plans use the corrected macro and micro doses in a different tank", () => {
  const plan = ei.buildEiPlan({
    tankGallons: 40,
    level: "standard",
    macroSolution,
    microSolution,
  });

  // Apply the existing EI anchor constants to the independently known label strength.
  assertClose(plan.macroMlPerDose, 6.87202044);
  assertClose(plan.microMlPerDose, 5.32355384);
  assertPpm(plan.impliedMacroPpmPerDose, { NO3: 6.87202044, PO4: 0.859002555, K: 3.43601022 });
  assertPpm(plan.impliedMicroPpmPerDose, { Fe: 0.266177692, Mn: 0.0532355384 });
});
