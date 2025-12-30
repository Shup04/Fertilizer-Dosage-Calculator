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

const compoundMgNeededForPpm = (tankLiters: number, targetPpmIncrease: number, c: Compound, n: Nutrient): number => {
  if (tankLiters <=0 ) throw new Error("Tank size must be positive");
  if (targetPpmIncrease <=0 ) throw new Error("Target ppm increase must be positive");
  const mgNutrient = nutrientMgNeeded(tankLiters, targetPpmIncrease);
  const f = getFraction(c, n);
  return mgNutrient / f; // mg compound needed
}

const c: Compound = "KNO3";
const n: Nutrient = "NO3";
const f = getFraction(c, n);

console.log(c + " provides " + f + " of " + n + " by mass.");

const mgCompound = compoundMgNeededForPpm(100, 10, "KNO3", "NO3");

console.log("To increase " + n + " by 10 ppm in a 100 liter tank, you need to add " + mgCompound.toFixed(2) + " mg of " + c + ".");
