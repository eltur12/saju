import { FortuneAggregator } from "./src/engines/aggregator.js";
import type { SajuEngineProfile } from "./src/engines/sajuEngine.js";
import { buildZiweiEngineFromProfile, type ZiweiProfile, SAMPLE_ZIWEI_PROFILE } from "./src/engines/ziweiEngine.js";
import { buildAstroEngineFromProfile, type AstroProfile, SAMPLE_ASTRO_PROFILE } from "./src/engines/astroEngine.js";

const PROFILE_A_SAJU: SajuEngineProfile = {
  day_stem:"甲", month_stem:"庚", hour_branch:"戌", day_branch:"子",
  month_branch:"午", year_branch:"卯", special_stars:["백호살"],
  dayun_stem:"壬", dayun_branch:"午",
};
const PROFILE_B_SAJU: SajuEngineProfile = {
  day_stem:"甲", month_stem:"己", hour_branch:"子", day_branch:"寅",
  month_branch:"未", year_branch:"戌", special_stars:[],
  dayun_stem:"甲", dayun_branch:"寅",
};
const PROFILE_C_SAJU: SajuEngineProfile = {
  day_stem:"丙", month_stem:"甲", hour_branch:"亥", day_branch:"寅",
  month_branch:"午", year_branch:"戌", special_stars:["천덕귀인"],
  dayun_stem:"甲", dayun_branch:"寅",
};

const ZA: ZiweiProfile = { ...SAMPLE_ZIWEI_PROFILE, year_sihua_palaces:{"化祿":"官祿","化權":"財帛","化科":"遷移","化忌":"疾厄"}, current_dahan:"疾厄", dahan_stars:[] };
const ZB: ZiweiProfile = { ...SAMPLE_ZIWEI_PROFILE, year_sihua_palaces:{"化祿":"官祿","化權":"財帛","化科":"遷移","化忌":"兄弟"}, current_dahan:"官祿", dahan_stars:[] };
const ZC: ZiweiProfile = { ...SAMPLE_ZIWEI_PROFILE, year_sihua_palaces:{"化祿":"命宮","化權":"財帛","化科":"官祿","化忌":"兄弟"}, current_dahan:"財帛", dahan_stars:["天府"] };

const AA: AstroProfile = { ...SAMPLE_ASTRO_PROFILE, planet_houses:{...SAMPLE_ASTRO_PROFILE.planet_houses, Saturn:6} };
const AB: AstroProfile = { ...SAMPLE_ASTRO_PROFILE, planet_houses:{...SAMPLE_ASTRO_PROFILE.planet_houses, Saturn:12} };
const AC: AstroProfile = { ...SAMPLE_ASTRO_PROFILE, planet_houses:{...SAMPLE_ASTRO_PROFILE.planet_houses, Saturn:10} };

type Cat = "wealth"|"love"|"health"|"career"|"relations"|"study";
const CATS: Cat[] = ["wealth","love","health","career","relations","study"];
const birth = new Date(1998,0,22);

function run(saju: SajuEngineProfile, ziwei: ZiweiProfile, astro: AstroProfile) {
  const agg = new FortuneAggregator(saju, ziwei, astro, undefined, birth);
  const days = Array.from({length:31},(_,i) => agg.getDailyFortune(new Date(2026,4,i+1)));
  const N = days.length;
  let healthBot=0, relsBot=0, careerTop=0, spreadSum=0;
  for (const d of days) {
    const s = d.scores;
    const sorted = [...CATS].sort((a,b) => s[b]-s[a]);
    if (sorted[sorted.length-1]==="health") healthBot++;
    if (sorted[sorted.length-1]==="relations") relsBot++;
    if (sorted[0]==="career") careerTop++;
    spreadSum += s[sorted[0]] - s[sorted[sorted.length-1]];
  }
  return {
    healthBot: healthBot/N,
    relsBot:   relsBot/N,
    careerTop: careerTop/N,
    spread:    spreadSum/N,
  };
}

const rA = run(PROFILE_A_SAJU, ZA, AA);
const rB = run(PROFILE_B_SAJU, ZB, AB);
const rC = run(PROFILE_C_SAJU, ZC, AC);

const maxHBot    = Math.max(rA.healthBot, rB.healthBot, rC.healthBot);
const maxRBot    = Math.max(rA.relsBot,   rB.relsBot,   rC.relsBot);
const maxCTop    = Math.max(rA.careerTop, rB.careerTop, rC.careerTop);
const avgSpread  = (rA.spread + rB.spread + rC.spread) / 3;

const p = (v:number) => `${Math.round(v*100)}%`;
const gate = (pass:boolean, label:string) => `${pass?"PASS":"FAIL"}  ${label}`;

console.log("── Gate Check ─────────────────────────────────────────");
console.log(`  Health bot   A:${p(rA.healthBot)} B:${p(rB.healthBot)} C:${p(rC.healthBot)}   worst:${p(maxHBot)}`);
console.log(`  Relations bot A:${p(rA.relsBot)} B:${p(rB.relsBot)} C:${p(rC.relsBot)}    worst:${p(maxRBot)}`);
console.log(`  Career top   A:${p(rA.careerTop)} B:${p(rB.careerTop)} C:${p(rC.careerTop)}   worst:${p(maxCTop)}`);
console.log(`  Avg spread   A:${rA.spread.toFixed(1)} B:${rB.spread.toFixed(1)} C:${rC.spread.toFixed(1)}      avg:${avgSpread.toFixed(1)}`);
console.log("────────────────────────────────────────────────────────");
console.log(`  ${gate(maxHBot    < 0.65, `Health bottom < 65%   (${p(maxHBot)})`  )}`);
console.log(`  ${gate(maxRBot    < 0.30, `Relations bottom < 30% (${p(maxRBot)})`  )}`);
console.log(`  ${gate(maxCTop    < 0.65, `Career top < 65%       (${p(maxCTop)})`  )}`);
console.log(`  ${gate(avgSpread  > 8,    `Avg spread > 8         (${avgSpread.toFixed(1)})`    )}`);
const passed = [maxHBot<0.65, maxRBot<0.30, maxCTop<0.65, avgSpread>8].filter(Boolean).length;
console.log(`────────────────────────────────────────────────────────`);
console.log(`  Gates: ${passed}/4`);
