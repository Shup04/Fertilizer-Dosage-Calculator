type Nutrient = "NO3" | "PO4" | "K" | "Fe" ;
type Compound = "KNO3" | "KH2PO4" | "K2SO4";

const FRACTION_BY_MASS: Record<Compound, Partial<Record<Nutrient, number>>> = {
  KNO3: { NO3: 0.613, K: 0.387 },
  KH2PO4: { PO4: 0.698, K: 0.287 },
  K2SO4: { K: 0.449 },
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
const mgNutrientPerMl = (mgCompoundNeeded: number, MgPerMl: number): number => {
  if (MgPerMl <=0 ) throw new Error("Concentration must be positive");
  if (mgCompoundNeeded <=0 ) throw new Error("Mass must be positive");
  return mgCompoundNeeded / MgPerMl;
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
const mlDose = mgNutrientPerMl(mgCompoundNeeded, 80) // assuming you add 40g to 500ml

console.log('To increase ' + n + ' by ' + targetPpmIncrease + ' ppm in a ' + tankSizeGallons + 'g tank, you need ' + mgCompoundNeeded.toFixed(2) + ' mg of ' + c + '.');
console.log('To add ' + mgCompoundNeeded.toFixed(2) + ' mg of ' + c + ', you need to dose ' + mlDose.toFixed(2) + ' ml of solution.');
