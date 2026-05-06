/**
 * Career dominance investigation — no code changes
 * Profile B (77% top) and Profile C (58% top), May 2026
 * Run: npx tsx diagnose_career.ts
 */
import {
  buildSajuEngineFromProfile, type SajuEngineProfile,
  STEM_ELEMENT, BRANCH_ELEMENT,
  HEAVENLY_STEMS, EARTHLY_BRANCHES,
} from "./src/engines/sajuEngine.js";
import { buildZiweiEngineFromProfile, type ZiweiProfile, SAMPLE_ZIWEI_PROFILE } from "./src/engines/ziweiEngine.js";
import { buildAstroEngineFromProfile, type AstroProfile, SAMPLE_ASTRO_PROFILE } from "./src/engines/astroEngine.js";
import { computeStateAtoms } from "./src/engines/stateAtomLayer.js";

// ── Profiles ──────────────────────────────────────────────────────────────────
const PROFILE_B_SAJU: SajuEngineProfile = {
  day_stem: "甲", month_stem: "己", hour_branch: "子",
  day_branch: "寅", month_branch: "未", year_branch: "戌",
  special_stars: [], dayun_stem: "甲", dayun_branch: "寅",
};
const PROFILE_B_ZIWEI: ZiweiProfile = {
  ...SAMPLE_ZIWEI_PROFILE,
  year_sihua_palaces: { "化祿": "官祿", "化權": "財帛", "化科": "遷移", "化忌": "兄弟" },
  current_dahan: "官祿", dahan_stars: [],
};
const PROFILE_B_ASTRO: AstroProfile = {
  ...SAMPLE_ASTRO_PROFILE,
  planet_houses: { ...SAMPLE_ASTRO_PROFILE.planet_houses, "Saturn": 12 },
};

const PROFILE_C_SAJU: SajuEngineProfile = {
  day_stem: "丙", month_stem: "甲", hour_branch: "亥",
  day_branch: "寅", month_branch: "午", year_branch: "戌",
  special_stars: ["천덕귀인"], dayun_stem: "甲", dayun_branch: "寅",
};
const PROFILE_C_ZIWEI: ZiweiProfile = {
  ...SAMPLE_ZIWEI_PROFILE,
  year_sihua_palaces: { "化祿": "命宮", "化權": "財帛", "化科": "官祿", "化忌": "兄弟" },
  current_dahan: "財帛", dahan_stars: ["天府"],
};
const PROFILE_C_ASTRO: AstroProfile = {
  ...SAMPLE_ASTRO_PROFILE,
  planet_houses: { ...SAMPLE_ASTRO_PROFILE.planet_houses, "Saturn": 10 },
};

// ── Merge constants ───────────────────────────────────────────────────────────
const BASE = 60;
const DOMAIN_WEIGHTS = {
  wealth:    { saju:0.50, ziwei:0.35, astro:0.15 },
  love:      { saju:0.40, ziwei:0.35, astro:0.25 },
  health:    { saju:0.55, ziwei:0.25, astro:0.20 },
  career:    { saju:0.50, ziwei:0.30, astro:0.20 },
  relations: { saju:0.45, ziwei:0.30, astro:0.25 },
  study:     { saju:0.45, ziwei:0.25, astro:0.30 },
} as const;
const DAILY_SENSITIVITY: Record<string, number> = {
  love:1.25, relations:1.10, health:1.00, wealth:1.10, study:1.08, career:1.00,
};
const COMPRESSION = 0.75;

type Cat = "wealth" | "love" | "health" | "career" | "relations" | "study";
const CATS: Cat[] = ["wealth","love","health","career","relations","study"];

function softScale(v: number): number {
  if (v > 85) return 85 + (v-85)*0.5;
  if (v < 15) return 15 - (15-v)*0.5;
  return v;
}

// ── TEN_GOD_INFLUENCE table (copied for analysis) ─────────────────────────────
const TG_CAREER: Record<string, number> = {
  "比肩":0,"劫財":-3,"食神":6,"傷官":3,"偏財":6,"正財":8,"偏官":-5,"正官":10,"偏印":5,"正印":10,
};
const TG_HEALTH: Record<string, number> = {
  "比肩":0,"劫財":-2,"食神":10,"傷官":-2,"偏財":2,"正財":4,"偏官":-8,"正官":4,"偏印":3,"正印":7,
};
const TG_ALL: Record<string, Record<Cat,number>> = {
  "比肩": {wealth:0,  love:0,  health:0,  career:0,  relations:0,  study:0},
  "劫財": {wealth:-8, love:-4, health:-2, career:-3, relations:-5, study:-2},
  "食神": {wealth:10, love:5,  health:10, career:6,  relations:11, study:8},
  "傷官": {wealth:-3, love:-4, health:-2, career:3,  relations:-1, study:6},
  "偏財": {wealth:8,  love:3,  health:2,  career:6,  relations:5,  study:3},
  "正財": {wealth:12, love:3,  health:4,  career:8,  relations:5,  study:3},
  "偏官": {wealth:-5, love:-5, health:-8, career:-5, relations:-7, study:-3},
  "正官": {wealth:5,  love:2,  health:4,  career:10, relations:6,  study:3},
  "偏印": {wealth:0,  love:6,  health:3,  career:5,  relations:6,  study:2},
  "正印": {wealth:5,  love:3,  health:7,  career:10, relations:5,  study:4},
};

function tgCareerAdvantage(tg: string): number {
  if (!TG_ALL[tg]) return 0;
  const row = TG_ALL[tg];
  const others: Cat[] = ["wealth","love","health","relations","study"];
  const otherAvg = others.reduce((s,c) => s + row[c], 0) / others.length;
  return row.career - otherAvg;
}

// ── Run analysis ──────────────────────────────────────────────────────────────

function analyzeProfile(
  name: string,
  saju: SajuEngineProfile,
  ziwei: ZiweiProfile,
  astro: AstroProfile,
) {
  const birthDate = new Date(1998,0,22);
  const sajuEng  = buildSajuEngineFromProfile(saju);
  const ziweiEng = buildZiweiEngineFromProfile(ziwei);
  const astroEng = buildAstroEngineFromProfile(astro);

  type DayRow = {
    date: string;
    // raw engine outputs
    saju_career:  number; saju_avg5: number;    // avg of other 5
    ziwei_career: number; ziwei_avg5: number;
    astro_career: number; astro_avg5: number;
    // pre-compression scores
    pre_career: number; pre_avg5: number;
    // post-compression
    comp_career: number; comp_avg5: number;
    // state atom
    atom_career: number;
    // final
    final_career: number; final_avg5: number;
    is_top: boolean;
    // factors
    ten_god: string;
    day_rels: string[];
    month_rels: string[];
    clash_stem: boolean;
    clash_branch: boolean;
    active_aspects: string[];
    // isolated contributions
    tg_career_adv: number;   // career advantage from daily TG vs other cats
    ziwei_career_direct: number; // career from ziwei (weighted)
    atom_career_net: number;
  };

  const rows: DayRow[] = [];

  for (let d = 1; d <= 31; d++) {
    const date = new Date(2026,4,d);
    const sajuR  = sajuEng.calculate(date);
    const ziweiR = ziweiEng.calculate(date);
    const astroR = astroEng.calculate(date, birthDate);

    const stateR = computeStateAtoms({
      ten_god_of_day:       sajuR.factors.ten_god_of_day as string|undefined,
      active_stars:         [],
      day_branch_relation_types:   (sajuR.factors.day_branch_relation_types   as string[]) ?? [],
      month_branch_relation_types: (sajuR.factors.month_branch_relation_types as string[]) ?? [],
      ohaeng_clash_stem:    (sajuR.factors.ohaeng_clash_stem  as boolean) ?? false,
      ohaeng_clash_branch:  (sajuR.factors.ohaeng_clash_branch as boolean) ?? false,
      active_transit_aspects: (astroR.factors.active_transit_aspects as string[]) ?? [],
    });

    // merge for all cats
    const pre: Record<Cat,number> = {} as Record<Cat,number>;
    for (const cat of CATS) {
      const w = DOMAIN_WEIGHTS[cat];
      const s = sajuR.scores[cat] ?? BASE;
      const z = ziweiR.scores[cat] ?? 0;
      const a = astroR.scores[cat] ?? 0;
      const zCap = Math.max(-30,Math.min(30,z));
      const aCap = Math.max(-25,Math.min(25,a));
      const sSoft = softScale(Math.max(0,Math.min(100,s)));
      const zSoft = softScale(Math.max(0,Math.min(100,BASE+zCap)));
      const aSoft = softScale(Math.max(0,Math.min(100,BASE+aCap)));
      const delta = (sSoft-BASE)*w.saju + (zSoft-BASE)*w.ziwei + (aSoft-BASE)*w.astro;
      const clamped = Math.max(-12,delta);
      const sens = DAILY_SENSITIVITY[cat] ?? 1.0;
      pre[cat] = Math.max(0,Math.min(100, BASE + clamped*sens));
    }

    const catAvg = CATS.reduce((s,c) => s+pre[c],0)/6;
    const comp: Record<Cat,number> = {} as Record<Cat,number>;
    for (const cat of CATS) {
      comp[cat] = Math.max(0,Math.min(100, catAvg + (pre[cat]-catAvg)*COMPRESSION));
    }

    const final: Record<Cat,number> = {} as Record<Cat,number>;
    for (const cat of CATS) {
      const d2 = stateR.categoryDeltas[cat] ?? 0;
      final[cat] = Math.round(Math.max(0,Math.min(100, comp[cat]+d2)));
    }

    const sorted = [...CATS].sort((a,b) => final[b]-final[a]);
    const isTop  = sorted[0] === "career";

    const others: Cat[] = ["wealth","love","health","relations","study"];
    const saAvg5 = others.reduce((s,c) => s + sajuR.scores[c],0)/5;
    const zwAvg5 = others.reduce((s,c) => s + ziweiR.scores[c],0)/5;
    const asAvg5 = others.reduce((s,c) => s + astroR.scores[c],0)/5;
    const prAvg5 = others.reduce((s,c) => s + pre[c],0)/5;
    const coAvg5 = others.reduce((s,c) => s + comp[c],0)/5;
    const fnAvg5 = others.reduce((s,c) => s + final[c],0)/5;

    const tg = (sajuR.factors.ten_god_of_day as string) ?? "?";

    // isolated ziwei career contribution (weighted delta)
    const zCareerRaw = ziweiR.scores.career ?? 0;
    const zCareerCap = Math.max(-30,Math.min(30,zCareerRaw));
    const zCareerSoft = softScale(Math.max(0,Math.min(100,BASE+zCareerCap)));
    const zCareerDelta = (zCareerSoft-BASE)*DOMAIN_WEIGHTS.career.ziwei;
    const zOther5 = others.map(c => {
      const zr = ziweiR.scores[c] ?? 0;
      const zc = Math.max(-30,Math.min(30,zr));
      const zs = softScale(Math.max(0,Math.min(100,BASE+zc)));
      return (zs-BASE)*DOMAIN_WEIGHTS[c].ziwei;
    });
    const zOther5Avg = zOther5.reduce((a,b)=>a+b,0)/5;

    rows.push({
      date: `05/${String(d).padStart(2,"0")}`,
      saju_career:  sajuR.scores.career ?? 0,
      saju_avg5: saAvg5,
      ziwei_career: ziweiR.scores.career ?? 0,
      ziwei_avg5: zwAvg5,
      astro_career: astroR.scores.career ?? 0,
      astro_avg5: asAvg5,
      pre_career: pre.career,
      pre_avg5: prAvg5,
      comp_career: comp.career,
      comp_avg5: coAvg5,
      atom_career: stateR.categoryDeltas.career ?? 0,
      final_career: final.career,
      final_avg5: fnAvg5,
      is_top: isTop,
      ten_god: tg,
      day_rels:   (sajuR.factors.day_branch_relation_types   as string[]) ?? [],
      month_rels: (sajuR.factors.month_branch_relation_types as string[]) ?? [],
      clash_stem:   (sajuR.factors.ohaeng_clash_stem   as boolean) ?? false,
      clash_branch: (sajuR.factors.ohaeng_clash_branch as boolean) ?? false,
      active_aspects: (astroR.factors.active_transit_aspects as string[]) ?? [],
      tg_career_adv: tgCareerAdvantage(tg),
      ziwei_career_direct: zCareerDelta - zOther5Avg,
      atom_career_net: stateR.categoryDeltas.career ?? 0,
    });
  }

  // ── Reporting ───────────────────────────────────────────────────────────────
  console.log(`\n${"=".repeat(68)}`);
  console.log(`Profile ${name}`);
  console.log("=".repeat(68));

  const topDays  = rows.filter(r => r.is_top);
  const nonTopDays = rows.filter(r => !r.is_top);
  console.log(`\nCareer top: ${topDays.length}/31 (${Math.round(topDays.length/31*100)}%)`);

  // [1] Contributor ranking — avg career advantage over other-5 avg per source
  const avg = (arr: number[]) => arr.reduce((a,b)=>a+b,0)/arr.length;

  const sajuCareerAdv  = avg(rows.map(r => r.saju_career - r.saju_avg5));
  const ziweiCareerAdv = avg(rows.map(r => r.ziwei_career - r.ziwei_avg5));
  const astroCareerAdv = avg(rows.map(r => r.astro_career - r.astro_avg5));
  const preCareerAdv   = avg(rows.map(r => r.pre_career - r.pre_avg5));
  const compCareerAdv  = avg(rows.map(r => r.comp_career - r.comp_avg5));
  const atomCareerAdv  = avg(rows.map(r => r.atom_career));
  const finalCareerAdv = avg(rows.map(r => r.final_career - r.final_avg5));

  console.log("\n[1] Career advantage over other-5 avg at each pipeline stage:");
  console.log(`    saju engine:      career - avg5 = ${sajuCareerAdv.toFixed(2)}`);
  console.log(`    ziwei engine:     career - avg5 = ${ziweiCareerAdv.toFixed(2)}`);
  console.log(`    astro engine:     career - avg5 = ${astroCareerAdv.toFixed(2)}`);
  console.log(`    pre-compression:  career - avg5 = ${preCareerAdv.toFixed(2)}`);
  console.log(`    post-compression: career - avg5 = ${compCareerAdv.toFixed(2)}`);
  console.log(`    state atom Δ career avg:         ${atomCareerAdv.toFixed(2)}`);
  console.log(`    FINAL career advantage:          ${finalCareerAdv.toFixed(2)}`);

  // [2] TEN_GOD breakdown
  console.log("\n[2] TEN_GOD_INFLUENCE — career advantage over other-cat avg:");
  const tgCounts: Record<string, number[]> = {};
  for (const r of rows) {
    if (!tgCounts[r.ten_god]) tgCounts[r.ten_god] = [];
    tgCounts[r.ten_god].push(r.tg_career_adv);
  }
  for (const [tg, advs] of Object.entries(tgCounts).sort((a,b)=> avg(b[1])-avg(a[1]))) {
    const a = avg(advs);
    const careerVal = TG_CAREER[tg] ?? 0;
    const healthVal = TG_HEALTH[tg] ?? 0;
    console.log(`    ${tg.padEnd(4)} n=${advs.length}  career_inf=${String(careerVal).padStart(3)}  health_inf=${String(healthVal).padStart(3)}  career_adv_over_avg5=${a.toFixed(2)}`);
  }

  // Persistent advantage: natal month TG
  const natalMonthTG_career = saju.month_stem ? (TG_CAREER[getTenGod(saju.day_stem, saju.month_stem)] ?? 0) : 0;
  const natalMonthTG_health = saju.month_stem ? (TG_HEALTH[getTenGod(saju.day_stem, saju.month_stem)] ?? 0) : 0;
  const natalTGName = getTenGod(saju.day_stem, saju.month_stem);
  console.log(`\n    Natal month TG (${saju.month_stem} for ${saju.day_stem} = ${natalTGName}):`);
  console.log(`      career=${natalMonthTG_career} × 0.53 weight = ${(natalMonthTG_career*0.53).toFixed(1)} pts/day (persistent)`);
  console.log(`      health=${natalMonthTG_health} × 0.53 weight = ${(natalMonthTG_health*0.53).toFixed(1)} pts/day`);

  const dayunStemTG = getTenGod(saju.day_stem, saju.dayun_stem);
  const dayunBranchTG = getTenGod(saju.day_stem, BRANCH_ELEMENT[saju.dayun_branch] ?? "");
  const dayunCareer = (TG_CAREER[dayunStemTG] ?? 0)*0.40 + (TG_CAREER[dayunBranchTG] ?? 0)*0.27;
  const dayunHealth = (TG_HEALTH[dayunStemTG] ?? 0)*0.40 + (TG_HEALTH[dayunBranchTG] ?? 0)*0.27;
  console.log(`    Dayun TG (${saju.dayun_stem}=${dayunStemTG} + ${saju.dayun_branch}=${dayunBranchTG}):`);
  console.log(`      career=${dayunCareer.toFixed(1)} pts/day (persistent)`);
  console.log(`      health=${dayunHealth.toFixed(1)} pts/day`);

  // [3] Branch relation contribution
  const branchCareerAdv = avg(rows.map(r => {
    const allRels = [...r.day_rels, ...r.month_rels];
    // rough estimate: positive rels (삼합/육합/방합/복음) boost career less (0.8×) vs health (1.0×)
    return allRels.filter(x => ["삼합","육합","방합","복음","반합"].includes(x)).length * 0.2;
  }));
  const negRelCareerProtection = avg(rows.map(r => {
    const allRels = [...r.day_rels, ...r.month_rels];
    // negative rels hit career at 0.8× weight — less than health (1.0×) and love (1.2×)
    return allRels.filter(x => ["충","형","삼형","원진","귀문","해"].includes(x)).length;
  }));

  console.log(`\n[3] Branch relation career profile:`);
  const dayRelTypes   = rows.flatMap(r => r.day_rels);
  const monthRelTypes = rows.flatMap(r => r.month_rels);
  const allRelTypes   = [...dayRelTypes, ...monthRelTypes];
  const relCounts: Record<string,number> = {};
  for (const t of allRelTypes) relCounts[t] = (relCounts[t]??0)+1;
  const negRels = ["충","형","삼형","원진","귀문","해"];
  const posRels = ["삼합","육합","방합","복음","반합"];
  const negFreq = negRels.reduce((s,t) => s+(relCounts[t]??0),0);
  const posFreq = posRels.reduce((s,t) => s+(relCounts[t]??0),0);
  console.log(`    Negative rel instances (month): ${negFreq}  Positive: ${posFreq}`);
  console.log(`    career BRANCH_REL_CAT_W = 0.8 (vs health 1.0, love 1.2)`);
  console.log(`    → career absorbs LESS of negative branch signal than health/love`);
  console.log(`    → estimated career advantage from branch asymmetry: ~${(negFreq*(-12)*(-0.2)/31).toFixed(2)} pts/day`);

  // [4] State atom contribution
  console.log(`\n[4] State atom career Δ analysis:`);
  console.log(`    avg career Δ from state atoms: ${atomCareerAdv.toFixed(2)}`);
  const posAtomDays = rows.filter(r => r.atom_career > 0);
  const negAtomDays = rows.filter(r => r.atom_career < 0);
  const neuAtomDays = rows.filter(r => r.atom_career === 0);
  console.log(`    days career atom > 0: ${posAtomDays.length}  = 0: ${neuAtomDays.length}  < 0: ${negAtomDays.length}`);
  // state atom career pathway atoms
  console.log(`    Career atom pathway: executionFlow(1.0) + organization(0.6) + focus(0.6) + stability(0.3)`);
  console.log(`      → career benefits from 4 different positive atoms (highest path count)`);

  // [5] Structural vs valid-profile: neutral days analysis
  console.log(`\n[5] Career dominance on neutral vs event days:`);
  const neutralDays = rows.filter(r =>
    r.day_rels.length === 0 &&
    r.month_rels.length === 0 &&
    !r.clash_stem && !r.clash_branch &&
    r.active_aspects.length === 0
  );
  const eventDays = rows.filter(r =>
    r.day_rels.length > 0 || r.month_rels.length > 0 ||
    r.clash_stem || r.clash_branch || r.active_aspects.length > 0
  );
  console.log(`    Neutral days (no branch rels, no clash, no active aspects): ${neutralDays.length}/31`);
  console.log(`    Event days: ${eventDays.length}/31`);
  if (neutralDays.length > 0) {
    const neutralTopCareer = neutralDays.filter(r => r.is_top).length;
    const neutralCareerAdv = avg(neutralDays.map(r => r.final_career - r.final_avg5));
    console.log(`    Neutral days career top: ${neutralTopCareer}/${neutralDays.length} (${Math.round(neutralTopCareer/neutralDays.length*100)}%)`);
    console.log(`    Neutral days career advantage over avg5: ${neutralCareerAdv.toFixed(2)}`);
  }
  if (eventDays.length > 0) {
    const eventTopCareer = eventDays.filter(r => r.is_top).length;
    const eventCareerAdv = avg(eventDays.map(r => r.final_career - r.final_avg5));
    console.log(`    Event days career top: ${eventTopCareer}/${eventDays.length} (${Math.round(eventTopCareer/eventDays.length*100)}%)`);
    console.log(`    Event days career advantage over avg5: ${eventCareerAdv.toFixed(2)}`);
  }

  // [6] Non-career category movement
  console.log(`\n[6] Non-career category movement (final score std dev):`);
  for (const cat of CATS) {
    const vals = rows.map(r => r.final_career === r.final_career ? (final_cat(r, cat, rows)) : 0);
  }
  // recompute properly
  const catVals: Record<Cat, number[]> = {} as Record<Cat, number[]>;
  for (const cat of CATS) catVals[cat] = [];
  // need actual final scores — rerun quickly
  const sajuEng2  = buildSajuEngineFromProfile(saju);
  const ziweiEng2 = buildZiweiEngineFromProfile(ziwei);
  const astroEng2 = buildAstroEngineFromProfile(astro);
  for (let d = 1; d <= 31; d++) {
    const date = new Date(2026,4,d);
    const sR = sajuEng2.calculate(date);
    const zR = ziweiEng2.calculate(date);
    const aR = astroEng2.calculate(date, birthDate);
    const stR = computeStateAtoms({
      ten_god_of_day: sR.factors.ten_god_of_day as string|undefined,
      active_stars: [],
      day_branch_relation_types:   (sR.factors.day_branch_relation_types as string[]) ?? [],
      month_branch_relation_types: (sR.factors.month_branch_relation_types as string[]) ?? [],
      ohaeng_clash_stem:   (sR.factors.ohaeng_clash_stem  as boolean) ?? false,
      ohaeng_clash_branch: (sR.factors.ohaeng_clash_branch as boolean) ?? false,
      active_transit_aspects: (aR.factors.active_transit_aspects as string[]) ?? [],
    });
    const preL: Record<Cat,number> = {} as Record<Cat,number>;
    for (const cat of CATS) {
      const w = DOMAIN_WEIGHTS[cat];
      const s = sR.scores[cat] ?? BASE;
      const z = zR.scores[cat] ?? 0;
      const a = aR.scores[cat] ?? 0;
      const zC = Math.max(-30,Math.min(30,z));
      const aC = Math.max(-25,Math.min(25,a));
      const sS = softScale(Math.max(0,Math.min(100,s)));
      const zS = softScale(Math.max(0,Math.min(100,BASE+zC)));
      const aS = softScale(Math.max(0,Math.min(100,BASE+aC)));
      const del = (sS-BASE)*w.saju+(zS-BASE)*w.ziwei+(aS-BASE)*w.astro;
      const cl = Math.max(-12,del);
      preL[cat] = Math.max(0,Math.min(100,BASE+cl*(DAILY_SENSITIVITY[cat]??1.0)));
    }
    const cA2 = CATS.reduce((s,c)=>s+preL[c],0)/6;
    for (const cat of CATS) {
      const comp2 = Math.max(0,Math.min(100,cA2+(preL[cat]-cA2)*COMPRESSION));
      const delta2 = stR.categoryDeltas[cat] ?? 0;
      catVals[cat].push(Math.round(Math.max(0,Math.min(100,comp2+delta2))));
    }
  }
  for (const cat of CATS) {
    const vals2 = catVals[cat];
    const mean = avg(vals2);
    const std = Math.sqrt(vals2.reduce((s,v)=>s+(v-mean)**2,0)/vals2.length);
    const range = Math.max(...vals2)-Math.min(...vals2);
    console.log(`    ${cat.padEnd(10)} avg=${mean.toFixed(1)}  std=${std.toFixed(1)}  range=${range}`);
  }

  // [7] Does dominance persist on negative transit days?
  const negTransitDays = rows.filter(r => r.active_aspects.length > 0);
  console.log(`\n[7] Career dominance on active-transit days:`);
  console.log(`    Days with active aspects (orb<2°): ${negTransitDays.length}/31`);
  if (negTransitDays.length > 0) {
    const nTTopCareer = negTransitDays.filter(r => r.is_top).length;
    console.log(`    Career top on those days: ${nTTopCareer}/${negTransitDays.length}`);
    for (const r of negTransitDays) {
      console.log(`      ${r.date}  career_top=${r.is_top}  career_adv=${(r.final_career-r.final_avg5).toFixed(1)}  aspects: ${r.active_aspects.join("; ")}`);
    }
  }

  // Summary of persistent vs event-driven contributions
  console.log(`\n[SUMMARY] Structural analysis:`);
  const persistentBoost = (natalMonthTG_career*0.53 + dayunCareer);
  const persistentHealthDelta = (natalMonthTG_health*0.53 + dayunHealth);
  console.log(`    Persistent daily career boost (natal TG + dayun): ${persistentBoost.toFixed(2)} pts/day`);
  console.log(`    Persistent daily health (same source):            ${persistentHealthDelta.toFixed(2)} pts/day`);
  console.log(`    Structural career - health advantage:             ${(persistentBoost-persistentHealthDelta).toFixed(2)} pts/day`);
}

// helper: get final value for a cat from a row (workaround for closure)
function final_cat(r: any, cat: Cat, rows: any[]): number { return 0; }

// TEN_GOD_MAP logic (simplified for stem→TG derivation)
const STEM_EL: Record<string,string> = {
  "甲":"木","乙":"木","丙":"火","丁":"火","戊":"土","己":"土","庚":"金","辛":"金","壬":"水","癸":"水",
};
const HS = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
const TGM: Record<string,string> = {
  "木_木_true":"比肩","木_木_false":"劫財","木_火_true":"食神","木_火_false":"傷官","木_土_true":"偏財","木_土_false":"正財","木_金_true":"偏官","木_金_false":"正官","木_水_true":"偏印","木_水_false":"正印",
  "火_火_true":"比肩","火_火_false":"劫財","火_土_true":"食神","火_土_false":"傷官","火_金_true":"偏財","火_金_false":"正財","火_水_true":"偏官","火_水_false":"正官","火_木_true":"偏印","火_木_false":"正印",
  "土_土_true":"比肩","土_土_false":"劫財","土_金_true":"食神","土_金_false":"傷官","土_水_true":"偏財","土_水_false":"正財","土_木_true":"偏官","土_木_false":"正官","土_火_true":"偏印","土_火_false":"正印",
  "金_金_true":"比肩","金_金_false":"劫財","金_水_true":"食神","金_水_false":"傷官","金_木_true":"偏財","金_木_false":"正財","金_火_true":"偏官","金_火_false":"正官","金_土_true":"偏印","金_土_false":"正印",
  "水_水_true":"比肩","水_水_false":"劫財","水_木_true":"食神","水_木_false":"傷官","水_火_true":"偏財","水_火_false":"正財","水_土_true":"偏官","水_土_false":"正官","水_金_true":"偏印","水_金_false":"正印",
};
const BE: Record<string,string> = {
  "子":"水","丑":"土","寅":"木","卯":"木","辰":"土","巳":"火","午":"火","未":"土","申":"金","酉":"金","戌":"土","亥":"水",
};
function getTenGod(dayStem: string, targetStemOrEl: string): string {
  const dayEl = STEM_EL[dayStem] ?? dayStem;
  const dayIdx = HS.indexOf(dayStem);
  const dayYang = dayIdx % 2 === 0;
  const targetEl = STEM_EL[targetStemOrEl] ?? BE[targetStemOrEl] ?? targetStemOrEl;
  const tIdx = HS.indexOf(targetStemOrEl);
  const sameYang = tIdx >= 0 ? dayYang === (tIdx%2===0) : dayYang;
  return TGM[`${dayEl}_${targetEl}_${sameYang}`] ?? "?";
}

// ── Run ───────────────────────────────────────────────────────────────────────
analyzeProfile("B (Neutral/甲日,己月,官祿大限)", PROFILE_B_SAJU, PROFILE_B_ZIWEI, PROFILE_B_ASTRO);
analyzeProfile("C (Positive/丙日,甲月,財帛大限)", PROFILE_C_SAJU, PROFILE_C_ZIWEI, PROFILE_C_ASTRO);

// ── Cross-profile TG career advantage table ───────────────────────────────────
console.log("\n\n" + "=".repeat(68));
console.log("TEN_GOD_INFLUENCE: career advantage over avg-of-other-5");
console.log("=".repeat(68));
const tgList = ["比肩","劫財","食神","傷官","偏財","正財","偏官","正官","偏印","正印"];
for (const tg of tgList) {
  const row = TG_ALL[tg];
  const others: Cat[] = ["wealth","love","health","relations","study"];
  const oAvg = others.reduce((s,c)=>s+row[c],0)/5;
  const adv  = row.career - oAvg;
  const bar  = adv > 0 ? "█".repeat(Math.round(adv/0.5)) : "░".repeat(Math.round(-adv/0.5));
  console.log(`  ${tg.padEnd(4)} career=${String(row.career).padStart(3)}  avg5=${oAvg.toFixed(1).padStart(5)}  adv=${adv.toFixed(1).padStart(5)}  ${adv>0?"▲":"▼"} ${bar}`);
}
const allAdv = tgList.map(tg => {
  const row = TG_ALL[tg];
  const others: Cat[] = ["wealth","love","health","relations","study"];
  return row.career - others.reduce((s,c)=>s+row[c],0)/5;
});
console.log(`  Mean career adv over avg5: ${(allAdv.reduce((a,b)=>a+b,0)/allAdv.length).toFixed(2)}`);
console.log(`  Days career adv > 0: ${allAdv.filter(v=>v>0).length}/10`);
console.log(`  Days career adv < 0: ${allAdv.filter(v<0).length}/10`);
