type Nutrient = "NO3";
type Compound = "KNO3";

const FRACTION_BY_MASS: Record<Compound, Record<Nutrient, number>> = {
  KNO3: { NO3: 0.613 },
}

const c: Compound = "KNO3";
const n: Nutrient = "NO3";

console.log("ok");
console.log(c, n, FRACTION_BY_MASS);
