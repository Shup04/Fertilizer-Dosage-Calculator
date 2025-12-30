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


// Example
const c: Compound = "KNO3";
const n: Nutrient = "NO3";
const tankSizeGallons = 26;
const targetPpmIncrease = 5;

// convert tank size to metric
const tankSizeLiters = gallonsToLiters(tankSizeGallons);

// get the mg of compound needed to increase nutrient ppm by desired amount
const mgCompoundNeeded = compoundMgNeededForPpm(tankSizeLiters, targetPpmIncrease, c, n);
const mlDose = doseMlFromMgAndConcentration(mgCompoundNeeded, 80) // assuming you add 40g to 500ml

const mixture: StockRecipe = {compound: c, grams: 40, finalVolumeMl: 500};
const testStock: Stock = makeStock(mixture); // Standard mix for KNO3

console.log('To increase ' + n + ' by ' + targetPpmIncrease + ' ppm in a ' + tankSizeGallons + 'g tank, you need ' + mgCompoundNeeded.toFixed(2) + ' mg of ' + c + '.');
console.log('To add ' + mgCompoundNeeded.toFixed(2) + ' mg of ' + c + ', you need to dose ' + mlDose.toFixed(2) + ' ml of solution.');
console.log('---Stock solution Example ---');
console.log(testStock);

