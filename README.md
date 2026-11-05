# Fertilizer Dosage Calculator

A TypeScript experiment in turning aquarium fertilizer information into explicit quantities: how much dry compound or stock solution supplies a requested nutrient increase, and how a bottle's label can become a PPS or EI dosing schedule.

The central idea is to keep **nutrient targets, fertilizer composition, tank volume and schedule** separate. A nutrient target is not a bottle dose. A compound may supply more than one nutrient, and a premixed bottle fixes the ratio between them. The calculator makes those relationships visible instead of treating every nutrient as an independent addition.

This repository currently contains three executable calculation examples, not a finished app or published library. PPS and EI label normalization is covered by regression tests; the preset targets and remaining calculation paths still have the validation limits described below.

## How the idea developed

The history records a short progression from December 29, 2025 to January 4, 2026:

- Initial work converted desired ppm increases into compound masses, then added stock-solution concentrations and millilitre doses.
- The next important change accounted for potassium already supplied by potassium nitrate and monopotassium phosphate. This is why the advanced example calculates a remaining potassium deficit before adding potassium sulfate.
- The January 4 commit `549447b` explains the split into presets: EI and PPS were considered more common than individually specified doses. The original calculation became `advanced.ts`.
- The final commit, `41534d5`, describes the EI example as tuned to PlantGuy fertilizers. The code still labels its EI target constants as placeholders.

Together, the source and history suggest a calculation core that could accommodate both custom stock recipes and familiar preset routines. There is no evidence here of a completed user interface, product integration or general validation of the nutrient targets.

## The three calculation paths

| File | Inputs and role | Current output |
| --- | --- | --- |
| [advanced.ts](src/presets/advanced.ts) | Tank volume, desired NO3/PO4/K increases and individual stock recipes | Milligrams of each compound and millilitres of each stock solution |
| [pps.ts](src/presets/pps.ts) | Macro/micro bottle label data, intensity level and doses per week | Macro/micro dose volumes, suggested days and all implied nutrient additions |
| [ei.ts](src/presets/ei.ts) | Macro/micro label data or manual bottle doses, plus a schedule | Dose volumes, ordered macro/micro events and implied nutrient additions when composition is known |
| [simple.ts](src/presets/simple.ts) | Reserved file | Empty; no implemented behavior |

### Custom stock solutions: account for overlapping nutrients

`advanced.ts` supports `KNO3`, `KH2PO4` and `K2SO4`, with a table of nutrient mass fractions. It first solves nitrate and phosphate requirements, then subtracts the potassium supplied by those compounds from the potassium target. Only a positive remainder is assigned to `K2SO4`.

The calculation uses ppm as mg/L and converts US gallons with `gallons × 3.78541`. Its main relationships are:

```text
nutrient mass (mg) = target increase (mg/L) × tank volume (L)
compound mass (mg) = nutrient mass / nutrient fraction of the compound
stock concentration (mg/mL) = compound mass in the bottle (g) × 1000 / final volume (mL)
stock dose (mL) = required compound mass / stock concentration
```

The embedded example uses a 26-gallon tank and three separately prepared stocks. These are example inputs, not recommended targets. If nitrate and phosphate additions already supply more potassium than requested, the code sets the extra potassium sulfate dose to zero; it cannot remove the excess already contributed by the other compounds.

### Commercial bottles: solve an anchor, expose the other nutrients

PPS and EI accept a `ppm_per_reference_dose` description: a reference tank size, a reference millilitre dose and the resulting nutrient increases. They normalize that label into nutrient ppm from **1 mL in 10 gallons**.

Both planners use nitrate (`NO3`) as the macro anchor and iron (`Fe`) as the micro anchor. Once the anchor determines the bottle dose, every other nutrient follows the bottle's fixed composition. Returning the *implied* phosphate, potassium and trace additions is therefore part of the design: these planners do not independently solve every target in their tables.

PPS defines `low`, `medium` and `very_high` daily target tables. It multiplies the daily anchor targets by `7 / dosesPerWeek`, preserving their nominal weekly total when the number of doses changes. Suggested days use `floor(i × 7 / dosesPerWeek)`; this is a discrete schedule, not a tank-uptake model.

EI has one `standard` target profile and defaults to macro doses on Monday/Wednesday/Friday, micro doses on Tuesday/Thursday/Saturday and a Sunday water-change day. Macro and micro events are sorted by day. The water-change day is metadata: the code does not calculate replacement-water quantities or simulate nutrient removal.

### Labels without nutrient composition

The `manual_ml_per_10g` input represents a bottle whose usable information is a volume recommendation rather than ppm data. EI scales that dose by tank size and leaves the implied nutrient map undefined, rather than inventing a composition.

PPS declares the same input type, but its plan builder still attempts anchor solving against an empty nutrient map and throws. That path is unfinished.

## Label normalization and current limits

Both `normalizeSolutionSpec` implementations use `referenceTankGallons / 10` to convert a label to the “1 mL in 10 gallons” basis:

```text
normalized ppm = label ppm × (reference gallons / 10) / reference dose mL
```

A synthetic label saying “2 mL in 20 gallons adds 4 ppm” normalizes to 4 ppm per 1 mL in 10 gallons. Applying the original 2 mL dose in 20 gallons reproduces 4 ppm, and solving for 4 ppm returns 2 mL. In a 40-gallon tank, the same 2 mL adds 2 ppm and reaching 4 ppm requires 4 mL. These synthetic values check arithmetic; they are not fertilizer prescriptions.

The regression suite asserts independent normalized values, label round-trips, macro/micro anchor doses and tank-size scaling for both presets. It covers 5-, 10-, 20- and 37.5-gallon label references, as well as both planners with a 20-gallon label applied to a 40-gallon tank. The original inverse-volume formula fails these non-ten-gallon cases.

Other boundaries are explicit in the source:

- The examples execute at file scope and print results, including when imported. PPS and EI export calculation helpers for regression testing, but there is no stable public API, CLI input parser, UI or persistence layer.
- The printed “test” and “sanity check” sections are still illustrative. `npm test` runs asserted PPS/EI label-normalization tests; it does not validate the advanced stock calculation or every planner input.
- Preset target values are project constants, not established universal requirements. EI's final example matches its target table to its example bottle data.
- These are calculations of additions. They do not measure starting concentrations, plant consumption, substrate effects or changes between doses.

## Running checks and examples

Use Node.js compatible with the lockfile's tools; the recorded `tsx` and esbuild packages require Node 18 or newer. The lockfile records TypeScript 5.9.3 and `tsx` 4.21.0.

From the repository root, a fresh dependency setup is:

```sh
npm ci
```

Run the regression suite and TypeScript checks:

```sh
npm test
npm run typecheck
```

Then run whichever example you want to inspect:

```sh
./node_modules/.bin/tsx src/presets/advanced.ts
./node_modules/.bin/tsx src/presets/pps.ts
./node_modules/.bin/tsx src/presets/ei.ts
```

These commands use the hardcoded inputs near the bottom of each source file and print to the console. They do not accept tank settings as command-line arguments or require credentials, a server or a database. The repository tracks `node_modules`, including platform-specific binaries; do not assume that copy works on another OS. `npm ci` reconstructs dependencies from the lockfile and can change that tracked directory.

## Definition of done

The original calculation experiment can be complete without becoming a full aquarium application. A bounded finish would be:

- [x] Correct normalization in both preset paths and assert independent label round-trips for ten-gallon and non-ten-gallon references, including the synthetic 2 mL / 20 gallon / 4 ppm case and scaling to a different tank size.
- [ ] Verify the advanced stock calculation against hand-calculated compound masses and concentrations, including potassium already supplied by `KNO3` and `KH2PO4` and the case where no extra `K2SO4` is needed.
- [ ] Finish the declared PPS manual-dose path or explicitly remove it from the supported inputs. Verify PPS weekly scaling and EI macro/micro scheduling, with defined behavior for invalid dose counts and schedule values.
- [ ] Identify the source and intended scope of each preset target and label example; distinguish supplier-specific settings from general presets, and demonstrate which nutrient is the anchor and what the other implied additions become.
- [ ] Leave one reproducible, asserted example for each supported calculation path and document the supported input/output contract. A small callable module or clearly scoped executable examples is sufficient; a GUI and an expanded fertilizer catalog are separate projects.
