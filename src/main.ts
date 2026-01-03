type Nutrient = "NO3" | "PO4" | "K" | "Fe" ;
type Compound = "KNO3" | "KH2PO4" | "K2SO4";

const FRACTION_BY_MASS: Record<Compound, Partial<Record<Nutrient, number>>> = {
  KNO3: { NO3: 0.613, K: 0.387 },
  KH2PO4: { PO4: 0.698, K: 0.287 },
  K2SO4: { K: 0.449 },
}

type StockRecipe = {
  compound: Compound;
  grams: number;
  finalVolumeMl: number;
}

type Stock = {
  recipe: StockRecipe;
  nutrientMgPerMl: Partial<Record<Nutrient, number>>;
}

const makeStock = (recipe: StockRecipe): Stock => {
  if (recipe.grams <=0 ) throw new Error("Grams must be positive");
  if (recipe.finalVolumeMl <=0 ) throw new Error("Final volume must be positive");
  if (recipe.compound === undefined) throw new Error("Compound must be defined");
  const mgCompoundPerMl = (recipe.grams * 1000) / recipe.finalVolumeMl; // convert grams to mg/ml

  const fractions = FRACTION_BY_MASS[recipe.compound];
  const nutrientMgPerMl: Partial<Record<Nutrient, number>> = {};

  for (const n in fractions) {
    const f = fractions[n as Nutrient];
    if (f == null) continue;
    nutrientMgPerMl[n as Nutrient] = mgCompoundPerMl * f;
  }
 
  return {recipe, nutrientMgPerMl};
}

// Simple conversion helpers
const gallonsToLiters = (gallons: number): number => gallons * 3.78541;
const litersToGallons = (liters: number): number => liters / 3.78541;
const ppmToMg = (ppm: number, liters: number): number => ppm * liters;
const mgToPpm = (mg: number, liters: number): number => mg / liters;

const getFraction = (c: Compound, n: Nutrient): number => {
  const f = FRACTION_BY_MASS[c][n];
  if (f === undefined) {
    throw new Error(c + " does not provide " + n);
  }
  return f;
}

const nutrientMgNeeded = (tankLiters: number, targetPpmIncrease: number): number => {
  if (tankLiters <=0 ) throw new Error("Tank size must be positive");
  if (targetPpmIncrease <=0 ) throw new Error("Target ppm increase must be positive");
  return tankLiters * targetPpmIncrease;
}

// mg of compound needed to increase nutrient by target ppm in tank of given size
const compoundMgNeededForPpm = (tankLiters: number, targetPpmIncrease: number, c: Compound, n: Nutrient): number => {
  if (tankLiters <=0 ) throw new Error("Tank size must be positive");
  if (targetPpmIncrease <=0 ) throw new Error("Target ppm increase must be positive");
  const mgNutrient = nutrientMgNeeded(tankLiters, targetPpmIncrease);
  const f = getFraction(c, n);
  return mgNutrient / f; // mg compound needed
}

// ml of solution needed to provide given mg of compound, given concentration in mg/ml
const doseMlFromMgAndConcentration = (mgNeeded: number, mgPerMl: number): number => {
  if (mgPerMl <=0 ) throw new Error("Concentration must be positive");
  if (mgNeeded <=0 ) throw new Error("Mass must be positive");
  return mgNeeded / mgPerMl;
}

// to get concentration in mg/ml of a solution given grams of compound dissolved in volume in ml
const mgCompoundPerMl = (gramsInSolution: number, volumeMl: number): number => {
  if (volumeMl <=0 ) throw new Error("Volume must be positive");
  if (gramsInSolution <=0 ) throw new Error("Mass must be positive");
  return (gramsInSolution * 1000) / volumeMl; // convert grams to mg
}

const nutrientMgFromCompoundMg = (c: Compound, n: Nutrient, mgCompound: number): number => {
  const f = getFraction(c, n);
  return mgCompound * f;
}

// Example -------------------------------------------------------------

// user gives tank size, stock recipes, and target nutrient ppm increase
// system computes stock nutrient levels per ml
// system calculates mg of nutrient needed to reach desired ppm increase.
// system computes dose ml needed to dose desired mg of nutrients.

// user data from initial setup
const tankSizeGallons = 26;
const tankSizeLiters = gallonsToLiters(tankSizeGallons);
const c: Compound = "KNO3";
const n: Nutrient = "NO3";
const targetsPpm: Partial<Record<Nutrient, number>> = { NO3: 2, PO4: 3, K: 10} // this will be a user input
const stockRecipe: StockRecipe = {
  compound: c,
  grams: 40,
  finalVolumeMl: 500,
};

// get nutrient concentration in users stock.
const stock = makeStock(stockRecipe);

// get target levels into a more usable form, if user doesnt input, set desired increase to 0.
const no3Ppm = targetsPpm.NO3 ?? 0;
const po4Ppm = targetsPpm.PO4 ?? 0;
const kPpm = targetsPpm.K ?? 0;

// get mg of nutrient needed to increase ppm by desired level
const mgKNO3Needed = 
  no3Ppm === 0
    ? 0 
    : nutrientMgNeeded(tankSizeLiters, no3Ppm) / getFraction("KNO3", "NO3");


const mgKH2PO4Needed =
  po4Ppm === 0
    ? 0
    : nutrientMgNeeded(tankSizeLiters, po4Ppm) / getFraction("KH2PO4", "PO4");

// calculate K Coming from other compounds
const mgKAlready = nutrientMgFromCompoundMg("KNO3", "K", mgKNO3Needed) + nutrientMgFromCompoundMg("KH2PO4", "K", mgKH2PO4Needed);
const mgKTarget = kPpm === 0 ? 0 : nutrientMgNeeded(tankSizeLiters, kPpm);
const mgKDeficit = Math.max(0, mgKTarget - mgKAlready);

const mgK2SO4Needed = 
  mgKDeficit === 0
    ? 0
    : mgKDeficit / getFraction("K2SO4", "K");

console.log("KNO3 mg needed: " + mgKNO3Needed.toFixed(2));
console.log("KH2PO4 mg needed: " + mgKH2PO4Needed.toFixed(2));
console.log("K2SO4 mg needed: " + mgK2SO4Needed.toFixed(2));
