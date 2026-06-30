/**
 * Profile A: aggregated score breakdown vs saju-only
 * Checks love-stabilizer flip effect.
 */
import { FortuneAggregator } from "./src/engines/aggregator.js";
import type { SajuEngineProfile } from "./src/engines/sajuEngine.js";
import { buildSajuEngineFromProfile } from "./src/engines/sajuEngine.js";
import type { ScoreMap } from "./src/engines/sajuEngine.js";
import { SAMPLE_ZIWEI_PROFILE, type ZiweiProfile } from "./src/engines/ziweiEngine.js";
import { SAMPLE_ASTRO_PROFILE, type AstroProfile } from "./src/engines/astroEngine.js";

const PROFILE_A_SAJU: SajuEngineProfile = {
  day_stem:"甲", month_stem:"庚", hour_branch:"戌", day_branch:"子",
  month_branch:"午", year_branch:"卯", special_stars:["백호살"],
  dayun_stem:"壬", dayun_branch:"午",
};
const ZA: ZiweiProfile = { ...SAMPLE_ZIWEI_PROFILE, year_sihua_palaces:{"化祿":"官祿","化權":"財帛","化科":"遷移","化忌":"疾厄"}, current_dahan:"疾厄", dahan_stars:[] };
const AA: AstroProfile = { ...SAMPLE_ASTRO_PROFILE, planet_houses:{...SAMPLE_ASTRO_PROFILE.planet_houses, Saturn:6} };

const sajuEngine = buildSajuEngineFromProfile(PROFILE_A_SAJU);
const agg = new FortuneAggregator(PROFILE_A_SAJU, ZA, AA, undefined, new Date(1998,0,22));

const CATS: (keyof ScoreMap)[] = ["wealth","love","health","career","relations","study"];

const days = Array.from({length:31}, (_,i) => {
  const date = new Date(2026,4,i+1);
  const saju = sajuEngine.calculate(date);
  const full = agg.getDailyFortune(date);
  const sajuScores = saju.scores;
  const aggScores  = full.scores;

  const sajuSorted = [...CATS].sort((a,b) => sajuScores[b]-sajuScores[a]);
  const aggSorted  = [...CATS].sort((a,b) => aggScores[b]-aggScores[a]);

  return {
    day: i+1,
    stemBranch: `${saju.factors.target_stem}${saju.factors.target_branch}`,
    sajuBottom: sajuSorted[sajuSorted.length-1],
    aggBottom:  aggSorted[aggSorted.length-1],
    sajuH: sajuScores.health,
    aggH:  aggScores.health,
    sajuL: sajuScores.love,
    aggL:  aggScores.love,
    sajuC: sajuScores.career,
    aggC:  aggScores.career,
    flipped: sajuSorted[sajuSorted.length-1] !== aggSorted[aggSorted.length-1],
  };
});

console.log("=== Profile A: Saju vs Aggregated bottom comparison ===\n");

// bottom counts
let sajuHealthBot = 0, aggHealthBot = 0, loveFlipCount = 0;
for (const d of days) {
  if (d.sajuBottom === "health") sajuHealthBot++;
  if (d.aggBottom  === "health") aggHealthBot++;
  if (d.sajuBottom !== "health" && d.aggBottom === "health") loveFlipCount++;
}
console.log(`Saju-only health bottom: ${sajuHealthBot}/31 (${Math.round(sajuHealthBot/31*100)}%)`);
console.log(`Aggregated health bottom: ${aggHealthBot}/31 (${Math.round(aggHealthBot/31*100)}%)`);
console.log(`Love→Health flip (love boosted past health): ${loveFlipCount} days\n`);

// Show flipped days
console.log("--- Flip days (saju says love-bottom, agg says health-bottom) ---");
console.log("  Day     | saju_H | agg_H | saju_L | agg_L | saju_C | agg_C");
for (const d of days) {
  if (d.sajuBottom !== "health" && d.aggBottom === "health") {
    console.log(`  May ${String(d.day).padEnd(2)} ${d.stemBranch} | ${String(d.sajuH).padEnd(6)} | ${String(d.aggH).padEnd(5)} | ${String(d.sajuL).padEnd(6)} | ${String(d.aggL).padEnd(5)} | ${String(d.sajuC).padEnd(6)} | ${d.aggC}`);
  }
}
console.log();

// Show non-health-bottom days in agg
console.log("--- Days when aggregated bottom is NOT health ---");
for (const d of days) {
  if (d.aggBottom !== "health") {
    console.log(`  May ${d.day} ${d.stemBranch}: agg_bottom=${d.aggBottom} H=${d.aggH} L=${d.aggL} C=${d.aggC}`);
  }
}
console.log();

// Persistent component: what ziwei疾厄 adds to health
console.log("--- ZA ziwei profile: current_dahan=疾厄 (health direct dahan penalty -5) ---");
console.log("  Profile A ziwei dahan=疾厄 → dahanScores applied × 0.45, then direct -5 health bonus for 疾厄");
console.log("  This is a PERSISTENT health reduction from ziwei every day.\n");

// Average score comparison
console.log("--- Average May 2026 scores ---");
const SCATS: (keyof ScoreMap)[] = ["wealth","love","health","career","relations","study"];
for (const c of SCATS) {
  const sajuAvg = Math.round(days.reduce((s,d) => s+d.sajuH*(c==="health"?1:0) + (c==="love"?d.sajuL:0) + (c==="career"?d.sajuC:0), 0)/31*10)/10;
  const aggAvg  = days.reduce((s,d) => s + (d.aggH*(c==="health"?1:0) + (c==="love"?d.aggL:0) + (c==="career"?d.aggC:0)), 0)/31;
}
// Easier approach: per category averages
const sajuAvgs: Record<string,number> = {};
const aggAvgs:  Record<string,number> = {};
for (const cat of SCATS) {
  const sajuVals = days.map(d => (d as any)[`saju${cat[0].toUpperCase()+cat.slice(1)}`] ?? 0);
  const aggVals  = days.map(d => (d as any)[`agg${cat[0].toUpperCase()+cat.slice(1)}`]  ?? 0);
  // Direct from agg
}
// Recompute cleanly
const catMap: Record<string, {sajuKey: keyof typeof days[0], aggKey: keyof typeof days[0]}> = {
  health: {sajuKey:"sajuH", aggKey:"aggH"},
  love:   {sajuKey:"sajuL", aggKey:"aggL"},
  career: {sajuKey:"sajuC", aggKey:"aggC"},
};
for (const [cat, keys] of Object.entries(catMap)) {
  const sa = Math.round(days.reduce((s,d) => s + (d[keys.sajuKey] as number), 0)/31*10)/10;
  const aa = Math.round(days.reduce((s,d) => s + (d[keys.aggKey]  as number), 0)/31*10)/10;
  console.log(`  ${cat.padEnd(8)}: saju_avg=${sa}, agg_avg=${aa}`);
}
