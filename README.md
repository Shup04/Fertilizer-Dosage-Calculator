# Fertilizer Dosage Calculator

A bounded TypeScript calculation library for aquarium fertilizer additions: custom stocks, PPS schedules and EI schedules. It separates nutrient targets, bottle composition, tank size and dosing frequency. No GUI, catalog service or credentials are required.

The preset targets are **project placeholders, not dosing recommendations**. EI constants and the historical examples were tuned to example PlantGuy label values; their provenance and suitability for other tanks have not been validated. PPS levels are inherited project constants, not independently validated requirements. This library calculates additions; it does not model starting concentrations, uptake, substrate effects or nutrient removal.

## Install, check and build

Use Node.js 18 or newer and npm. The lockfile pins TypeScript 5.9.3 and tsx 4.21.0.

```sh
npm ci
npm test
npm run typecheck
npm run build
node --require tsx/cjs examples/advanced.ts
node --require tsx/cjs examples/pps.ts
node --require tsx/cjs examples/ei.ts
```

`npm run build` writes CommonJS JavaScript and declarations to `dist/`. Importing the library is silent; executable examples live separately in [examples](examples). No binary or dependencies are needed from another checkout. The source entrypoint is [src/index.ts](src/index.ts).

```js
const { buildPpsPlan } = require('./dist');
const plan = buildPpsPlan({
  tankGallons: 20,
  ppsLevel: 'medium',
  dosesPerWeek: 3,
  macroSolution: { kind: 'manual_ml_per_10g', mlPer10Gallons: 2 },
  microSolution: { kind: 'manual_ml_per_10g', mlPer10Gallons: 1 },
});
// 4 mL macro and 2 mL micro on days [0, 2, 4].
// impliedMacroPpm and impliedMicroPpm are undefined: composition is unknown.
```

These numbers are synthetic usage examples, not prescriptions.

## Supported contracts

| API | Inputs | Outputs |
| --- | --- | --- |
| `buildStockPlan` | Positive `tankLiters`, nonnegative `targetsPpm` for NO3/PO4/K, and `stocks` keyed by KNO3/KH2PO4/K2SO4. Each stock has matching `compound`, positive `grams` and `finalVolumeMl`. | `compoundMg`, `doseMl`, and `potassiumAlreadyMg` supplied by nitrate/phosphate compounds. All three recipes are required, even when a calculated dose is zero. |
| `buildPpsPlan` | Positive `tankGallons`, `ppsLevel` low/medium/very_high, macro/micro solutions, integer `dosesPerWeek` 1–7. | mL per dose, days (Sunday=0 through Saturday=6), and implied ppm per dose when known. |
| `buildEiPlan` | Positive `tankGallons`, `level: 'standard'`, macro/micro solutions and optional schedule. | mL per dose, ordered events, copied schedule and implied ppm per dose when known. |
| `normalizeSolutionSpec` | A composition-bearing reference label. | ppm supplied by 1 mL in 10 US gallons. Manual-only input throws because composition is unknown. |
| `ppmFromDose`, `solveDoseMlForTargetPpm`, `solveMlPerDoseFromAnchor` | Positive tank size, normalized composition, nonnegative dose or target and an anchor nutrient for solving. | Implied ppm or solved mL. An absent/zero-strength anchor throws. |

All numeric inputs must be finite. Tank/stock/reference volumes, stock mass and manual bottle doses must be positive. Nutrient concentrations, requested increases and calculated zero doses may be zero. Invalid counts, unsupported levels, invalid days, negative nutrients and nonfinite results throw errors, including results from the directly exported stock helpers. TypeScript exports include solution, plan, schedule and stock types.

Composition-bearing labels use:

```text
{ kind: 'ppm_per_reference_dose', referenceTankGallons, referenceDoseMl, ppmAtReference }
normalized ppm = label ppm × (reference gallons / 10) / reference dose mL
```

A synthetic label of 2 mL in 20 gallons adding 4 ppm normalizes to 4 ppm per 1 mL in 10 gallons. Applying 2 mL in 20 gallons reproduces 4 ppm; in 40 gallons it supplies 2 ppm.

Supported label nutrients are NO3, PO4, K, Mg, Fe, Cu, Mn, Zn and S. Omitted nutrients remain omitted. Only own enumerable properties in nutrient maps count as supplied values; inherited properties are ignored and cannot supply an anchor. Both planners solve NO3 as the macro anchor and Fe as the micro anchor; other nutrients follow the bottle ratio rather than independently meeting every target.

Manual solutions use `{ kind: 'manual_ml_per_10g', mlPer10Gallons }`. PPS and EI scale this **per-event** volume by tank size only. They do not multiply a manual dose by `7 / dosesPerWeek`, infer a composition or preserve a manual weekly total when frequency changes. Macro and micro modes may be mixed.

PPS composition-bearing doses scale daily anchor targets by `7 / dosesPerWeek`: medium therefore adds 7 ppm NO3 and 0.35 ppm Fe per week. Days are `floor(i × 7 / dosesPerWeek)`.

EI defaults to macro Monday/Wednesday/Friday, micro Tuesday/Thursday/Saturday and a Sunday water-change day. Each macro/micro day list must contain 1–7 distinct integers from 0 to 6. Same-day macro and micro events are permitted, with macro first. Water-change day is metadata; no water replacement is calculated.

The stock solver uses ppm = mg/L and US gallons × 3.78541 = liters. Rounded mass fractions are KNO3 (NO3 .613, K .387), KH2PO4 (PO4 .698, K .287), K2SO4 (K .449). It subtracts potassium already supplied by nitrate/phosphate before solving K2SO4. If those additions exceed the K target, extra K2SO4 is zero; the excess potassium cannot be removed by this calculation. Fe is not supported by the three-compound stock solver.

## Verification

54 synthetic tests cover the 28 original label-normalization regressions plus silent imports, independently calculated compound masses and K overlap, zero extra K2SO4, stock/tank scaling, PPS weekly totals at all seven frequencies, mixed manual/known composition, EI ordering, schedule ownership and invalid numeric/schedule inputs. Typecheck, declaration build and all three separate examples were run locally. These checks validate arithmetic and contracts, not the biological suitability of targets or manufacturer label claims.
