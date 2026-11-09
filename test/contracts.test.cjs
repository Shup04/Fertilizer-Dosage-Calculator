const { it } = require('node:test');
const assert = require('node:assert/strict');
const printed=[]; const originalLog=console.log;
let api;
try { console.log=(...args)=>printed.push(args); api=require('../src/index.ts'); }
finally { console.log=originalLog; }
const close = (a, b) => assert.ok(Math.abs(a-b) < 1e-9, `${a} != ${b}`);
const manual = {kind:'manual_ml_per_10g',mlPer10Gallons:2};
const label = (ppmAtReference) => ({kind:'ppm_per_reference_dose',referenceTankGallons:10,referenceDoseMl:1,ppmAtReference});
const base = {tankGallons:20,macroSolution:label({NO3:2,K:1}),microSolution:label({Fe:0.1})};
const stocks = Object.fromEntries(['KNO3','KH2PO4','K2SO4'].map(compound=>[compound,{compound,grams:10,finalVolumeMl:100}]));
it('all imports are silent',()=>assert.deepEqual(printed,[]));
it('stock arithmetic accounts for K overlap with independently chosen exact masses',()=>{
 // 100 L: 6.13 ppm NO3 = 613 mg = 1000 mg KNO3;
 // 1.396 ppm PO4 = 139.6 mg = 200 mg KH2PO4. K = 387 + 57.4.
 const plan=api.buildStockPlan({tankLiters:100,targetsPpm:{NO3:6.13,PO4:1.396,K:8.934},stocks});
 close(plan.compoundMg.KNO3,1000); close(plan.compoundMg.KH2PO4,200);
 close(plan.potassiumAlreadyMg,444.4); close(plan.compoundMg.K2SO4,1000);
 close(plan.doseMl.KNO3,10); close(plan.doseMl.KH2PO4,2); close(plan.doseMl.K2SO4,10);
});
it('excess potassium means zero extra K2SO4 and scaling stocks halves volumes',()=>{
 const input={tankLiters:100,targetsPpm:{NO3:6.13,PO4:1.396,K:1},stocks};
 const a=api.buildStockPlan(input); close(a.compoundMg.K2SO4,0);
 const b=api.buildStockPlan({...input,stocks:Object.fromEntries(Object.entries(stocks).map(([c,s])=>[c,{...s,grams:20}]))});
 close(b.doseMl.KNO3,5); close(b.doseMl.KH2PO4,1); close(b.doseMl.K2SO4,0);
 const c=api.buildStockPlan({...input,tankLiters:200}); close(c.doseMl.KNO3,20);
});
for (const count of [1,2,3,4,5,6,7]) it(`PPS ${count} doses preserve weekly NO3/Fe totals`,()=>{
 const p=api.buildPpsPlan({...base,ppsLevel:'medium',dosesPerWeek:count});
 close(p.impliedMacroPpm.NO3*count,7);close(p.impliedMicroPpm.Fe*count,0.35);
 assert.equal(p.daysOfWeek.length,count);assert.equal(new Set(p.daysOfWeek).size,count);
});
it('PPS manual volume is per event, unknown composition remains unknown, mixed modes work',()=>{
 const p=api.buildPpsPlan({...base,ppsLevel:'medium',dosesPerWeek:3,macroSolution:manual});
 close(p.macroMlPerDose,4);assert.equal(p.impliedMacroPpm,undefined);close(p.impliedMicroPpm.Fe,0.35/3);
 assert.throws(()=>api.normalizeSolutionSpec(manual),/unknown nutrient/);
});
it('EI manual dosing scales tank, sorts events and orders same-day macro before micro',()=>{
 const schedule={macroDays:[5,1,3],microDays:[6,1,2],waterChangeDay:0};
 const p=api.buildEiPlan({...base,level:'standard',macroSolution:manual,microSolution:{...manual,mlPer10Gallons:1},schedule});
 close(p.macroMlPerDose,4);close(p.microMlPerDose,2);
 assert.deepEqual(p.events.map(e=>[e.dayOfWeek,e.kind]),[[1,'macro'],[1,'micro'],[2,'micro'],[3,'macro'],[5,'macro'],[6,'micro']]);
 assert.equal(p.impliedMacroPpmPerDose,undefined);assert.equal(p.impliedMicroPpmPerDose,undefined);
 p.schedule.macroDays.push(0);assert.deepEqual(schedule.macroDays,[5,1,3]);
});
for(const v of [NaN,Infinity,-Infinity,0,-1]) it(`rejects invalid positive inputs ${v}`,()=>{
 assert.throws(()=>api.buildEiPlan({...base,tankGallons:v,level:'standard'}));
 assert.throws(()=>api.buildPpsPlan({...base,tankGallons:v,ppsLevel:'medium',dosesPerWeek:7}));
 assert.throws(()=>api.normalizeSolutionSpec({...label({NO3:1}),referenceTankGallons:v}));
 assert.throws(()=>api.normalizeSolutionSpec({...label({NO3:1}),referenceDoseMl:v}));
 for(const method of ['buildEiPlan','buildPpsPlan']) assert.throws(()=>api[method]({...base,level:'standard',ppsLevel:'medium',dosesPerWeek:7,macroSolution:{...manual,mlPer10Gallons:v}}));
 assert.throws(()=>api.buildStockPlan({tankLiters:100,targetsPpm:{K:1},stocks:{...stocks,KNO3:{...stocks.KNO3,grams:v}}}));
 assert.throws(()=>api.buildStockPlan({tankLiters:100,targetsPpm:{K:1},stocks:{...stocks,KNO3:{...stocks.KNO3,finalVolumeMl:v}}}));
});
for(const v of [NaN,Infinity,-Infinity,-1]) it(`rejects invalid nutrient/dose ${v}`,()=>{
 assert.throws(()=>api.normalizeSolutionSpec(label({NO3:v})));
 assert.throws(()=>api.ppmFromDose({tankGallons:10,normalized:{ppmPer10g:{NO3:1}},doseMl:v}));
 assert.throws(()=>api.solveDoseMlForTargetPpm({tankGallons:10,normalized:{ppmPer10g:{NO3:1}},targetPpm:v,nutrient:'NO3'}));
 assert.throws(()=>api.buildStockPlan({tankLiters:100,targetsPpm:{K:v},stocks}));
});
it('rejects invalid counts, days, duplicate days, levels, and absent anchor',()=>{
 for(const n of [0,-1,1.5,8,NaN,Infinity]) assert.throws(()=>api.buildPpsPlan({...base,ppsLevel:'medium',dosesPerWeek:n}));
 for(const days of [[],[1,1],[-1],[7],[0.5],[NaN],[Infinity]]) assert.throws(()=>api.buildEiPlan({...base,level:'standard',schedule:{macroDays:days,microDays:[2],waterChangeDay:0}}));
 for(const day of [-1,7,NaN,Infinity,0.5]) assert.throws(()=>api.buildEiPlan({...base,level:'standard',schedule:{macroDays:[1],microDays:[2],waterChangeDay:day}}));
 assert.throws(()=>api.buildEiPlan({...base,level:'invalid'}));
 assert.throws(()=>api.buildPpsPlan({...base,ppsLevel:'invalid',dosesPerWeek:7}));
 assert.throws(()=>api.buildPpsPlan({...base,ppsLevel:'medium',dosesPerWeek:7,macroSolution:label({K:1})}));
});
it('zero nutrient requests are allowed and overflow is rejected',()=>{
 const p=api.buildStockPlan({tankLiters:100,targetsPpm:{NO3:0,K:0},stocks});assert.deepEqual(p.doseMl,{KNO3:0,KH2PO4:0,K2SO4:0});
 assert.throws(()=>api.normalizeSolutionSpec({...label({NO3:Number.MAX_VALUE}),referenceTankGallons:Number.MAX_VALUE}));
 assert.throws(()=>api.buildEiPlan({...base,tankGallons:Number.MAX_VALUE,level:'standard',macroSolution:{...manual,mlPer10Gallons:Number.MAX_VALUE}}));
});

it('prototype property names are not supported preset levels with manual bottles',()=>{
 for(const level of ['constructor','toString','__proto__']) {
  const input={...base,macroSolution:manual,microSolution:manual};
  assert.throws(()=>api.buildPpsPlan({...input,ppsLevel:level,dosesPerWeek:3}),/Unknown/);
  assert.throws(()=>api.buildEiPlan({...input,level}),/Unknown/);
 }
});
