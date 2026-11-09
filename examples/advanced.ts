import { gallonsToLiters, compoundMgNeededForPpm, nutrientMgFromCompoundMg, nutrientMgNeeded, getFraction, mgCompoundPerMl, doseMlFromMgAndConcentration } from "../src/presets/advanced";
import type { Compound, Nutrient, StockRecipe } from "../src/presets/advanced";

// user gives tank size, stock recipes, and target nutrient ppm increase
// system computes stock nutrient levels per ml
// system calculates mg of nutrient needed to reach desired ppm increase.
// system computes dose ml needed to dose desired mg of nutrients.

// user data from initial setup
const tankSizeGallons = 26;
const tankSizeLiters = gallonsToLiters(tankSizeGallons);

const c1: Compound = "KNO3";
const c2: Compound = "KH2PO4";
const c3: Compound = "K2SO4";

const targetsPpm: Partial<Record<Nutrient, number>> = { NO3: 5, PO4: 1, K: 20} // this will be a user input

const stockRecipeKNO3: StockRecipe = {
  compound: c1,
  grams: 40,
  finalVolumeMl: 500,
};

const stockRecipeKH2PO4: StockRecipe = {
  compound: c2,
  grams: 15,
  finalVolumeMl: 500,
};

const stockRecipeK2SO4: StockRecipe = {
  compound: c3,
  grams: 55,
  finalVolumeMl: 500,
};

// get target levels into a more usable form, if user doesnt input, set desired increase to 0.
const no3Ppm = targetsPpm.NO3 ?? 0;
const po4Ppm = targetsPpm.PO4 ?? 0;
const kPpm = targetsPpm.K ?? 0;

// get mg of nutrient needed to increase ppm by desired level
const mgKNO3Needed = no3Ppm === 0 ? 0 : compoundMgNeededForPpm(tankSizeLiters, no3Ppm, "KNO3", "NO3");


const mgKH2PO4Needed = po4Ppm === 0 ? 0 : compoundMgNeededForPpm(tankSizeLiters, po4Ppm, "KH2PO4", "PO4");

// calculate K Coming from other compounds
const mgKAlready = nutrientMgFromCompoundMg("KNO3", "K", mgKNO3Needed) + nutrientMgFromCompoundMg("KH2PO4", "K", mgKH2PO4Needed);
const mgKTarget = kPpm === 0 ? 0 : nutrientMgNeeded(tankSizeLiters, kPpm);
const mgKDeficit = Math.max(0, mgKTarget - mgKAlready);

const mgK2SO4Needed = mgKDeficit === 0 ? 0 : mgKDeficit / getFraction("K2SO4", "K");

console.log("KNO3 mg needed: " + mgKNO3Needed.toFixed(2));
console.log("KH2PO4 mg needed: " + mgKH2PO4Needed.toFixed(2));
console.log("K2SO4 mg needed: " + mgK2SO4Needed.toFixed(2));

console.log("Dosing " + mgKNO3Needed.toFixed(2) + " mg of KNO3, and " + mgKH2PO4Needed.toFixed(2) + " mg of KH2PO4 will dose " + mgKAlready.toFixed(2) + " mg of K. Meaning you only need to dose " + mgKDeficit.toFixed(2) + " mg of K more to reach your target of " + mgKTarget.toFixed(2) + " mg of K.");

const KNO3Concentration = mgCompoundPerMl(stockRecipeKNO3.grams, stockRecipeKNO3.finalVolumeMl);
const KH2PO4Concentration = mgCompoundPerMl(stockRecipeKH2PO4.grams, stockRecipeKH2PO4.finalVolumeMl);
const K2SO4Concentration = mgCompoundPerMl(stockRecipeK2SO4.grams, stockRecipeK2SO4.finalVolumeMl);

// compute ml dose from stock solutions
const doseMlKNO3 = doseMlFromMgAndConcentration(mgKNO3Needed, KNO3Concentration);
const doseMlKH2PO4 = doseMlFromMgAndConcentration(mgKH2PO4Needed, KH2PO4Concentration);
const doseMlK2SO4 = doseMlFromMgAndConcentration(mgK2SO4Needed, K2SO4Concentration);
console.log("Dose " + doseMlKNO3.toFixed(2) + " ml of KNO3 stock solution.");
console.log("Dose " + doseMlKH2PO4.toFixed(2) + " ml of KH2PO4 stock solution.");
console.log("Dose " + doseMlK2SO4.toFixed(2) + " ml of K2SO4 stock solution.");
// End Example ----------------------------------------------------------
