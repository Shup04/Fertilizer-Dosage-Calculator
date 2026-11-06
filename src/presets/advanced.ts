import { positive, nonnegative } from "../solutions";
export type TargetsPpm = Partial<Record<Nutrient, number>>; // per dose
export type PresetOutput = {
  targetsPerDosePpm: TargetsPpm;
  dosesPerWeek: number;
  daysOfWeek: number[]; // 0..6 or similar
  note?: string;
};

export type Nutrient = "NO3" | "PO4" | "K" | "Fe" ;
export type Compound = "KNO3" | "KH2PO4" | "K2SO4";

const FRACTION_BY_MASS: Record<Compound, Partial<Record<Nutrient, number>>> = {
  KNO3: { NO3: 0.613, K: 0.387 },
  KH2PO4: { PO4: 0.698, K: 0.287 },
  K2SO4: { K: 0.449 },
}

export type StockRecipe = {
  compound: Compound;
  grams: number;
  finalVolumeMl: number;
}

// Simple conversion helpers
export const gallonsToLiters = (gallons: number): number => positive(positive(gallons, "gallons") * 3.78541, "liters");
export const litersToGallons = (liters: number): number => positive(positive(liters, "liters") / 3.78541, "gallons");
export const ppmToMg = (ppm: number, liters: number): number => nonnegative(nonnegative(ppm, "ppm") * positive(liters, "liters"), "mg");
export const mgToPpm = (mg: number, liters: number): number => nonnegative(nonnegative(mg, "mg") / positive(liters, "liters"), "ppm");

export const getFraction = (c: Compound, n: Nutrient): number => {
  const f = FRACTION_BY_MASS[c][n];
  if (f === undefined) {
    throw new Error(c + " does not provide " + n);
  }
  return f;
}

export const nutrientMgNeeded = (tankLiters: number, targetPpmIncrease: number): number => {
  positive(tankLiters, "tankLiters");
  positive(targetPpmIncrease, "targetPpmIncrease");
  return tankLiters * targetPpmIncrease;
}

// mg of compound needed to increase nutrient by target ppm in tank of given size
export const compoundMgNeededForPpm = (tankLiters: number, targetPpmIncrease: number, c: Compound, n: Nutrient): number => {
  positive(tankLiters, "tankLiters");
  positive(targetPpmIncrease, "targetPpmIncrease");
  const mgNutrient = nutrientMgNeeded(tankLiters, targetPpmIncrease);
  const f = getFraction(c, n);
  return mgNutrient / f; // mg compound needed
}

// ml of solution needed to provide given mg of compound, given concentration in mg/ml
export const doseMlFromMgAndConcentration = (mgNeeded: number, mgPerMl: number): number => {
  positive(mgPerMl, "mgPerMl");
  nonnegative(mgNeeded, "mgNeeded");
  return mgNeeded / mgPerMl;
}

// to get concentration in mg/ml of a solution given grams of compound dissolved in volume in ml
export const mgCompoundPerMl = (gramsInSolution: number, volumeMl: number): number => {
  positive(volumeMl, "volumeMl");
  positive(gramsInSolution, "gramsInSolution");
  return (gramsInSolution * 1000) / volumeMl; // convert grams to mg
}

export const nutrientMgFromCompoundMg = (c: Compound, n: Nutrient, mgCompound: number): number => {
  const f = getFraction(c, n);
  return nonnegative(nonnegative(mgCompound, "mgCompound") * f, "nutrientMg");
}


export const buildStockPlan = (input: {
  tankLiters: number;
  targetsPpm: Partial<Record<"NO3" | "PO4" | "K", number>>;
  stocks: Record<Compound, StockRecipe>;
}): { compoundMg: Record<Compound, number>; doseMl: Record<Compound, number>; potassiumAlreadyMg: number } => {
  positive(input.tankLiters, "tankLiters");
  for (const [key, value] of Object.entries(input.targetsPpm)) {
    if (!["NO3", "PO4", "K"].includes(key)) throw new Error(`Unsupported stock target ${key}`);
    nonnegative(value, key);
  }
  const mass = (n: "NO3" | "PO4", c: Compound) => {
    const target = input.targetsPpm[n] ?? 0;
    return target === 0 ? 0 : compoundMgNeededForPpm(input.tankLiters, target, c, n);
  };
  const kno3 = mass("NO3", "KNO3"), kh2po4 = mass("PO4", "KH2PO4");
  const potassiumAlreadyMg = nutrientMgFromCompoundMg("KNO3", "K", kno3) + nutrientMgFromCompoundMg("KH2PO4", "K", kh2po4);
  const deficit = Math.max(0, (input.targetsPpm.K ?? 0) * input.tankLiters - potassiumAlreadyMg);
  const compoundMg = { KNO3: kno3, KH2PO4: kh2po4, K2SO4: deficit / getFraction("K2SO4", "K") };
  const doseMl = { KNO3: 0, KH2PO4: 0, K2SO4: 0 };
  for (const c of ["KNO3", "KH2PO4", "K2SO4"] as const) {
    const stock = input.stocks[c];
    if (stock.compound !== c) throw new Error(`Stock must contain ${c}`);
    nonnegative(compoundMg[c], "compoundMg");
    doseMl[c] = nonnegative(doseMlFromMgAndConcentration(compoundMg[c], mgCompoundPerMl(stock.grams, stock.finalVolumeMl)), "doseMl");
  }
  return { compoundMg, doseMl, potassiumAlreadyMg };
};
