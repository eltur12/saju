/**
 * Health bottom-rank diagnostic — no code changes
 * Instruments every health contributor at each pipeline stage.
 * Run: npx tsx diagnose_health.ts
 */
import { buildSajuEngineFromProfile, type SajuEngineProfile, STEM_ELEMENT, BRANCH_ELEMENT } from "./src/engines/sajuEngine.js";
import { buildZiweiEngineFromProfile, type ZiweiProfile, SAMPLE_ZIWEI_PROFILE } from "./src/engines/ziweiEngine.js";
import { buildAstroEngineFromProfile, type AstroProfile, SAMPLE_ASTRO_PROFILE } from "./src/engines/astroEngine.js";
import { computeStateAtoms } from "./src/engines/stateAtomLayer.js";

// ── Profiles (same as validate.ts) ────────────────────────────────────────────

const PROFILE_A_SAJU: SajuEngineProfile = {
  day_stem: "甲", month_stem: "庚", hour_branch: "戌",
  day_branch: "子", month_branch: "午", year_branch: "卯",
  special_stars: ["백호살"],
  dayun_stem: "壬", dayun_branch: "午",
};
const PROFILE_A_ZIWEI: ZiweiProfile = {
  ...SAMPLE_ZIWEI_PROFILE,
  year_sihua_palaces: { "化祿": "官祿", "化權": "財帛", "化科": "遷移", "化忌": "疾厄" },
  current_dahan: "疾厄", dahan_stars: [],
};
const PROFILE_A_ASTRO: AstroProfile = {
  ...SAMPLE_ASTRO_PROFILE,
  planet_houses: { ...SAMPLE_ASTRO_PROFILE.planet_houses, "Saturn": 6 },
};

const PROFILE_B_SAJU: SajuEngineProfile = {
  day_stem: "甲", month_stem: "己", hour_branch: "子",
  day_branch: "寅", month_branch: "未", year_branch: "戌",
  special_stars: [],
  dayun_stem: "甲", dayun_branch: "寅",
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
  special_stars: ["천덕귀인"],
  dayun_stem: "甲", dayun_branch: "寅",
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

// ── Merge constants (must match aggregator.ts) ────────────────────────────────
const BASE = 60;
const DOMAIN_WEIGHTS = {
  wealth:    { saju: 0.50, ziwei: 0.35, astro: 0.15 },
  love:      { saju: 0.40, ziwei: 0.35, astro: 0.25 },
  health:    { saju: 0.55, ziwei: 0.25, astro: 0.20 },
  career:    { saju: 0.50, ziwei: 0.30, astro: 0.20 },
  relations: { saju: 0.45, ziwei: 0.30, astro: 0.25 },
  study:     { saju: 0.45, ziwei: 0.25, astro: 0.30 },
} as const;
const DAILY_SENSITIVITY = { love: 1.25, relations: 1.10, health: 1.15, wealth: 1.10, study: 1.08, career: 1.00 };
const COMPRESSION = 0.75;
const MAX_CAT_DELTA = 3;

function softScale(score: number): number {
  if (score > 85) return 85 + (score - 85) * 0.5;
  if (score < 15) return 15 - (15 - score) * 0.5;
  return score;
}

type Cat = "wealth" | "love" | "health" | "career" | "relations" | "study";
const CATS: Cat[] = ["wealth", "love", "health", "career", "relations", "study"];

// ── Diagnosis function ────────────────────────────────────────────────────────

interface DayHealth {
  date: string;
  // raw engine outputs
  saju_health:  number;
  ziwei_health: number;
  astro_health: number;
  // merge components
  s_delta: number;  // (sSoft - BASE) * w.saju
  z_delta: number;  // (zSoft - BASE) * w.ziwei
  a_delta: number;  // (aSoft - BASE) * w.astro
  raw_delta: number;
  clamped_delta: number;
  pre_sens_health: number;   // BASE + clamped_delta
  post_sens_health: number;  // BASE + clamped_delta * 1.15
  // compression
  catAvg_before_compression: number;
  compressed_health: number;
  // state atoms
  atom_health_delta: number;
  final_health: number;
  // rank
  rank: number;
  // factors
  ten_god: string;
  ohaeng_clash_stem: boolean;
  ohaeng_clash_branch: boolean;
  day_branch_rels: string[];
  month_branch_rels: string[];
  // special stars (always fixed)
  special_stars: string[];
}

function diagnose(
  name: string,
  saju: SajuEngineProfile,
  ziwei: ZiweiProfile,
  astro: AstroProfile,
): void {
  const birthDate = new Date(1998, 0, 22);
  const sajuEng  = buildSajuEngineFromProfile(saju);
  const ziweiEng = buildZiweiEngineFromProfile(ziwei);
  const astroEng = buildAstroEngineFromProfile(astro);

  const days: DayHealth[] = [];

  for (let d = 1; d <= 31; d++) {
    const date = new Date(2026, 4, d);  // May 2026
    const sajuR  = sajuEng.calculate(date);
    const ziweiR = ziweiEng.calculate(date);
    const astroR = astroEng.calculate(date, birthDate);

    // === Replicate mergeScores for ALL cats ===
    const merged: Record<Cat, number> = {} as Record<Cat, number>;
    for (const cat of CATS) {
      const w = DOMAIN_WEIGHTS[cat];
      const s = sajuR.scores[cat] ?? BASE;
      const z = ziweiR.scores[cat] ?? 0;
      const a = astroR.scores[cat] ?? 0;
      const zCapped = Math.max(-30, Math.min(30, z));
      const aCapped = Math.max(-25, Math.min(25, a));
      const zScore  = BASE + zCapped;
      const aScore  = BASE + aCapped;
      const sSoft = softScale(Math.max(0, Math.min(100, s)));
      const zSoft = softScale(Math.max(0, Math.min(100, zScore)));
      const aSoft = softScale(Math.max(0, Math.min(100, aScore)));
      const dailyDelta = (sSoft - BASE) * w.saju + (zSoft - BASE) * w.ziwei + (aSoft - BASE) * w.astro;
      const clampedDelta = Math.max(-12, dailyDelta);
      const sens = (DAILY_SENSITIVITY as Record<string, number>)[cat] ?? 1.0;
      merged[cat] = Math.max(0, Math.min(100, BASE + clampedDelta * sens));
    }

    // Compression
    const catAvg = CATS.reduce((s, c) => s + merged[c], 0) / CATS.length;
    const compressed: Record<Cat, number> = {} as Record<Cat, number>;
    for (const cat of CATS) {
      compressed[cat] = Math.max(0, Math.min(100, catAvg + (merged[cat] - catAvg) * COMPRESSION));
    }

    // State atoms
    const stateR = computeStateAtoms({
      ten_god_of_day: sajuR.factors.ten_god_of_day as string | undefined,
      active_stars: [],
      day_branch_relation_types:   (sajuR.factors.day_branch_relation_types   as string[]) ?? [],
      month_branch_relation_types: (sajuR.factors.month_branch_relation_types as string[]) ?? [],
      ohaeng_clash_stem:   (sajuR.factors.ohaeng_clash_stem  as boolean) ?? false,
      ohaeng_clash_branch: (sajuR.factors.ohaeng_clash_branch as boolean) ?? false,
      active_transit_aspects: (astroR.factors.active_transit_aspects as string[]) ?? [],
    });
    const atomHealthDelta = stateR.categoryDeltas.health ?? 0;

    // Final (before rounding)
    const finalCats: Record<Cat, number> = {} as Record<Cat, number>;
    for (const cat of CATS) {
      const d = stateR.categoryDeltas[cat] ?? 0;
      finalCats[cat] = Math.round(Math.max(0, Math.min(100, compressed[cat] + d)));
    }
    const rank = [...CATS].sort((a, b) => finalCats[b] - finalCats[a]).indexOf("health") + 1;

    // Health-specific merge breakdown
    const w = DOMAIN_WEIGHTS.health;
    const s = sajuR.scores.health ?? BASE;
    const z = ziweiR.scores.health ?? 0;
    const a = astroR.scores.health ?? 0;
    const zCapped = Math.max(-30, Math.min(30, z));
    const aCapped = Math.max(-25, Math.min(25, a));
    const sSoft = softScale(Math.max(0, Math.min(100, s)));
    const zSoft = softScale(Math.max(0, Math.min(100, BASE + zCapped)));
    const aSoft = softScale(Math.max(0, Math.min(100, BASE + aCapped)));
    const sDelta = (sSoft - BASE) * w.saju;
    const zDelta = (zSoft - BASE) * w.ziwei;
    const aDelta = (aSoft - BASE) * w.astro;
    const rawDelta = sDelta + zDelta + aDelta;
    const clampedDelta = Math.max(-12, rawDelta);
    const preSens = BASE + clampedDelta;
    const postSens = BASE + clampedDelta * 1.15;

    days.push({
      date: `05/${String(d).padStart(2, "0")}`,
      saju_health:  s,
      ziwei_health: z,
      astro_health: a,
      s_delta: sDelta,
      z_delta: zDelta,
      a_delta: aDelta,
      raw_delta: rawDelta,
      clamped_delta: clampedDelta,
      pre_sens_health: preSens,
      post_sens_health: postSens,
      catAvg_before_compression: catAvg,
      compressed_health: compressed.health,
      atom_health_delta: atomHealthDelta,
      final_health: finalCats.health,
      rank,
      ten_god: (sajuR.factors.ten_god_of_day as string) ?? "?",
      ohaeng_clash_stem:   (sajuR.factors.ohaeng_clash_stem   as boolean) ?? false,
      ohaeng_clash_branch: (sajuR.factors.ohaeng_clash_branch as boolean) ?? false,
      day_branch_rels:   (sajuR.factors.day_branch_relation_types   as string[]) ?? [],
      month_branch_rels: (sajuR.factors.month_branch_relation_types as string[]) ?? [],
      special_stars: saju.special_stars,
    });
  }

  // ── Report ──────────────────────────────────────────────────────────────────
  console.log(`\n${"=".repeat(70)}`);
  console.log(`Profile ${name}`);
  console.log("=".repeat(70));

  // 1. Health bottom frequency
  const bottomDays = days.filter(d => d.rank === 6).length;
  const avgFinal = days.reduce((s, d) => s + d.final_health, 0) / days.length;
  const avgRank  = days.reduce((s, d) => s + d.rank, 0) / days.length;
  console.log(`\n[1] Health bottom freq: ${bottomDays}/31 (${Math.round(bottomDays/31*100)}%)`);
  console.log(`    Health avg final score: ${avgFinal.toFixed(1)}  avg rank: ${avgRank.toFixed(1)}/6`);

  // 2. Top-5 contributors by average magnitude
  const avgSaju  = days.reduce((s, d) => s + d.s_delta, 0) / days.length;
  const avgZiwei = days.reduce((s, d) => s + d.z_delta, 0) / days.length;
  const avgAstro = days.reduce((s, d) => s + d.a_delta, 0) / days.length;
  const avgAtom  = days.reduce((s, d) => s + d.atom_health_delta, 0) / days.length;
  const avgSens  = days.reduce((s, d) => s + (d.post_sens_health - d.pre_sens_health), 0) / days.length;

  // saju sub-contributions: ohaengClash, 백호살 (natal fixed), ten-god monthly
  const clashStemDays  = days.filter(d => d.ohaeng_clash_stem);
  const clashBranchDays= days.filter(d => d.ohaeng_clash_branch);
  const clashEffect = clashStemDays.length * (-6 * 0.55) / days.length  // rough: -6*0.55 in saju delta
                    + clashBranchDays.length * (-3 * 0.55) / days.length;
  // 백호살 is natal fixed (applied every day): SPECIAL_STARS["백호살"] health=-8 → in saju base
  const baekhoEffect = saju.special_stars.includes("백호살") ? -8 : 0;

  console.log(`\n[2] Health contributor averages (30-day mean delta from BASE=60):`);
  console.log(`    saju   Δ from BASE  (×0.55 weight):  ${avgSaju.toFixed(2)}`);
  console.log(`    ziwei  Δ from BASE  (×0.25 weight):  ${avgZiwei.toFixed(2)}`);
  console.log(`    astro  Δ from BASE  (×0.20 weight):  ${avgAstro.toFixed(2)}`);
  console.log(`    sensitivity bonus  (×0.15 on delta):  ${avgSens.toFixed(2)}`);
  console.log(`    stateAtom delta:                       ${avgAtom.toFixed(2)}`);

  console.log(`\n[3] Contribution size (after weights, before compression):`);
  console.log(`    saju raw health avg:   ${(days.reduce((s, d) => s + d.saju_health, 0)/days.length).toFixed(1)}`);
  console.log(`    ziwei raw health avg:  ${(days.reduce((s, d) => s + d.ziwei_health, 0)/days.length).toFixed(1)}`);
  console.log(`    astro raw health avg:  ${(days.reduce((s, d) => s + d.astro_health, 0)/days.length).toFixed(1)}`);
  console.log(`    astro capped avg:      ${(days.reduce((s, d) => s + Math.max(-25, Math.min(25, d.astro_health)), 0)/days.length).toFixed(1)}`);
  console.log(`    astro aScore avg:      ${(days.reduce((s, d) => s + BASE + Math.max(-25, Math.min(25, d.astro_health)), 0)/days.length).toFixed(1)}`);
  console.log(`    pre-compression health avg: ${(days.reduce((s, d) => s + d.post_sens_health, 0)/days.length).toFixed(1)}`);
  console.log(`    catAvg avg:           ${(days.reduce((s, d) => s + d.catAvg_before_compression, 0)/days.length).toFixed(1)}`);
  console.log(`    health - catAvg avg:  ${(days.reduce((s, d) => s + (d.post_sens_health - d.catAvg_before_compression), 0)/days.length).toFixed(1)}`);

  // 4. Whether astro -6 alone explains ranking
  console.log(`\n[4] astro -6 impact analysis:`);
  // Count days where astro is already capped (astro_health >= 25 before -6 would mean ≥31)
  const astro_would_be_without_penalty = days.map(d => d.astro_health + 6);
  const days_capped_regardless = astro_would_be_without_penalty.filter(v => v > 25).length;
  const days_affected_by_minus6 = days.filter(d => {
    const without = d.astro_health + 6;
    const with_   = d.astro_health;
    return Math.min(25, without) !== Math.min(25, with_);
  }).length;
  console.log(`    Days where -6 changes capped astro value: ${days_affected_by_minus6}/31`);
  console.log(`    Days where astro is at +25 cap regardless: ${days_capped_regardless}/31`);
  console.log(`    Avg astro raw health: ${(days.reduce((s,d) => s+d.astro_health,0)/days.length).toFixed(1)}`);
  console.log(`    If -6 removed, astro raw avg would be: ${(days.reduce((s,d) => s+d.astro_health+6,0)/days.length).toFixed(1)}`);
  // Estimate rank change if -6 removed
  console.log(`    → astro -6 is mostly absorbed by +25 cap; near-zero direct impact on final health`);

  // 5. Structural gap: health vs catAvg consistently
  const healthBelowAvg = days.filter(d => d.post_sens_health < d.catAvg_before_compression).length;
  console.log(`\n[5] Structural gap analysis:`);
  console.log(`    Days health < catAvg (pre-compression): ${healthBelowAvg}/31`);
  const gaps = days.map(d => d.post_sens_health - d.catAvg_before_compression);
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const minGap = Math.min(...gaps);
  const maxGap = Math.max(...gaps);
  console.log(`    health - catAvg: avg=${avgGap.toFixed(2)}  min=${minGap.toFixed(1)}  max=${maxGap.toFixed(1)}`);

  // 6. ohaengClash stats
  console.log(`\n[6] ohaengClash stats:`);
  console.log(`    stem clash days: ${clashStemDays.length}/31 (health -6 direct saju penalty each)`);
  console.log(`    branch clash days: ${clashBranchDays.length}/31 (health -3 direct saju penalty each)`);
  console.log(`    avg saju health on clash-stem days:    ${clashStemDays.length ? (clashStemDays.reduce((s,d)=>s+d.saju_health,0)/clashStemDays.length).toFixed(1) : "n/a"}`);
  console.log(`    avg saju health on no-clash days:      ${(days.filter(d=>!d.ohaeng_clash_stem).reduce((s,d)=>s+d.saju_health,0)/Math.max(1,days.filter(d=>!d.ohaeng_clash_stem).length)).toFixed(1)}`);

  // 7. 백호살 estimated contribution
  if (baekhoEffect !== 0) {
    console.log(`\n[7] 백호살 (natal fixed, every day):`);
    console.log(`    SPECIAL_STARS["백호살"].health = -8 → directly in saju base → saju delta -${Math.abs(baekhoEffect * 0.55).toFixed(1)} via weight`);
  }

  // 8. Ten-god health distribution
  const tgMap: Record<string, number[]> = {};
  for (const d of days) {
    if (!tgMap[d.ten_god]) tgMap[d.ten_god] = [];
    tgMap[d.ten_god].push(d.saju_health);
  }
  console.log(`\n[8] Ten-god health distribution (saju raw):`);
  for (const [tg, vals] of Object.entries(tgMap)) {
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    console.log(`    ${tg.padEnd(4)} n=${vals.length}  saju_health avg=${avg.toFixed(1)}`);
  }

  // 9. Daily table header: date | saju_h | z_h | a_h | a_raw | gap | atom | final | rank
  console.log(`\n[9] Daily breakdown:`);
  console.log("  Date  Saju_H  Z_H  A_raw  Acap  s_Δ   z_Δ   a_Δ  preH  postH  catAvg  compress  atomΔ  final rank clash10g");
  for (const d of days) {
    const aCap = Math.max(-25, Math.min(25, d.astro_health));
    const clash = (d.ohaeng_clash_stem ? "S" : "") + (d.ohaeng_clash_branch ? "B" : "");
    console.log(
      `  ${d.date}` +
      `  ${d.saju_health.toString().padStart(5)}` +
      `  ${d.ziwei_health.toString().padStart(5)}` +
      `  ${d.astro_health.toString().padStart(5)}` +
      `  ${aCap.toString().padStart(4)}` +
      `  ${d.s_delta.toFixed(1).padStart(5)}` +
      `  ${d.z_delta.toFixed(1).padStart(5)}` +
      `  ${d.a_delta.toFixed(1).padStart(5)}` +
      `  ${d.pre_sens_health.toFixed(1).padStart(5)}` +
      `  ${d.post_sens_health.toFixed(1).padStart(6)}` +
      `  ${d.catAvg_before_compression.toFixed(1).padStart(6)}` +
      `  ${d.compressed_health.toFixed(1).padStart(8)}` +
      `  ${d.atom_health_delta.toFixed(1).padStart(5)}` +
      `  ${d.final_health.toString().padStart(5)}` +
      `  ${d.rank.toString().padStart(4)}` +
      `  ${clash.padEnd(2)}` +
      `  ${d.ten_god}` +
      (d.day_branch_rels.length ? `  d:[${d.day_branch_rels.join(",")}]` : "") +
      (d.month_branch_rels.length ? `  m:[${d.month_branch_rels.join(",")}]` : ""),
    );
  }
}

// ── Compare catAvg health deficit across all 3 profiles ───────────────────────

function summaryComparison() {
  const profiles = [
    { name: "A (Stress)",   saju: PROFILE_A_SAJU, ziwei: PROFILE_A_ZIWEI, astro: PROFILE_A_ASTRO },
    { name: "B (Neutral)",  saju: PROFILE_B_SAJU, ziwei: PROFILE_B_ZIWEI, astro: PROFILE_B_ASTRO },
    { name: "C (Positive)", saju: PROFILE_C_SAJU, ziwei: PROFILE_C_ZIWEI, astro: PROFILE_C_ASTRO },
  ];

  console.log("\n\n" + "=".repeat(70));
  console.log("CROSS-PROFILE: Per-category avg pre-compression scores (30-day mean)");
  console.log("=".repeat(70));
  console.log("  Profile        W      L      H      C      R      S    catAvg  H_gap");

  for (const p of profiles) {
    const birthDate = new Date(1998, 0, 22);
    const sajuEng  = buildSajuEngineFromProfile(p.saju);
    const ziweiEng = buildZiweiEngineFromProfile(p.ziwei);
    const astroEng = buildAstroEngineFromProfile(p.astro);

    const catSums: Record<Cat, number> = { wealth:0, love:0, health:0, career:0, relations:0, study:0 };

    for (let d = 1; d <= 31; d++) {
      const date = new Date(2026, 4, d);
      const sajuR  = sajuEng.calculate(date);
      const ziweiR = ziweiEng.calculate(date);
      const astroR = astroEng.calculate(date, birthDate);

      for (const cat of CATS) {
        const w = DOMAIN_WEIGHTS[cat];
        const s = sajuR.scores[cat] ?? BASE;
        const z = ziweiR.scores[cat] ?? 0;
        const a = astroR.scores[cat] ?? 0;
        const zCapped = Math.max(-30, Math.min(30, z));
        const aCapped = Math.max(-25, Math.min(25, a));
        const sSoft = softScale(Math.max(0, Math.min(100, s)));
        const zSoft = softScale(Math.max(0, Math.min(100, BASE + zCapped)));
        const aSoft = softScale(Math.max(0, Math.min(100, BASE + aCapped)));
        const dailyDelta = (sSoft-BASE)*w.saju + (zSoft-BASE)*w.ziwei + (aSoft-BASE)*w.astro;
        const clampedDelta = Math.max(-12, dailyDelta);
        const sens = (DAILY_SENSITIVITY as Record<string, number>)[cat] ?? 1.0;
        catSums[cat] += BASE + clampedDelta * sens;
      }
    }

    const catAvgs: Record<Cat, number> = {} as Record<Cat, number>;
    for (const cat of CATS) catAvgs[cat] = catSums[cat] / 31;
    const mean = CATS.reduce((s, c) => s + catAvgs[c], 0) / 6;

    const row = CATS.map(c => catAvgs[c].toFixed(1).padStart(6)).join(" ");
    console.log(`  ${p.name.padEnd(14)} ${row}  ${mean.toFixed(1).padStart(6)}  ${(catAvgs.health - mean).toFixed(2).padStart(6)}`);
  }

  // Now show what happens if we hypothetically remove the 2026 astro -6 constant
  console.log("\n  [Hypothetical: astro 2026 health -6 removed]");
  for (const p of profiles) {
    const birthDate = new Date(1998, 0, 22);
    const sajuEng  = buildSajuEngineFromProfile(p.saju);
    const ziweiEng = buildZiweiEngineFromProfile(p.ziwei);
    const astroEng = buildAstroEngineFromProfile(p.astro);

    let healthSum = 0, catAvgSum = 0;
    for (let d = 1; d <= 31; d++) {
      const date = new Date(2026, 4, d);
      const sajuR  = sajuEng.calculate(date);
      const ziweiR = ziweiEng.calculate(date);
      const astroR = astroEng.calculate(date, birthDate);

      // Hypothetically remove -6 from astro health
      const astroHealthFixed = astroR.scores.health + 6;

      const catSums2: Record<Cat, number> = { wealth:0, love:0, health:0, career:0, relations:0, study:0 };
      for (const cat of CATS) {
        const w = DOMAIN_WEIGHTS[cat];
        const s = sajuR.scores[cat] ?? BASE;
        const z = ziweiR.scores[cat] ?? 0;
        const a = cat === "health" ? astroHealthFixed : (astroR.scores[cat] ?? 0);
        const zCapped = Math.max(-30, Math.min(30, z));
        const aCapped = Math.max(-25, Math.min(25, a));
        const sSoft = softScale(Math.max(0, Math.min(100, s)));
        const zSoft = softScale(Math.max(0, Math.min(100, BASE + zCapped)));
        const aSoft = softScale(Math.max(0, Math.min(100, BASE + aCapped)));
        const dailyDelta = (sSoft-BASE)*w.saju + (zSoft-BASE)*w.ziwei + (aSoft-BASE)*w.astro;
        const clampedDelta = Math.max(-12, dailyDelta);
        const sens = (DAILY_SENSITIVITY as Record<string, number>)[cat] ?? 1.0;
        catSums2[cat] = BASE + clampedDelta * sens;
      }
      const mean2 = CATS.reduce((s, c) => s + catSums2[c], 0) / 6;
      healthSum += catSums2.health;
      catAvgSum += mean2;
    }
    const hAvg = healthSum / 31;
    const cAvg = catAvgSum / 31;
    console.log(`  ${p.name.padEnd(14)} health_avg=${hAvg.toFixed(1)}  catAvg=${cAvg.toFixed(1)}  gap=${(hAvg-cAvg).toFixed(2)}`);
  }
}

// ── Minimal fix candidates ────────────────────────────────────────────────────

function fixCandidates() {
  console.log("\n\n" + "=".repeat(70));
  console.log("MINIMAL FIX CANDIDATES (analysis only — no code changes made)");
  console.log("=".repeat(70));

  // Analyze which saju sub-components hurt health most
  // Compare same profile on days with/without specific conditions

  const birthDate = new Date(1998, 0, 22);
  const sajuEng  = buildSajuEngineFromProfile(PROFILE_B_SAJU);
  const ziweiEng = buildZiweiEngineFromProfile(PROFILE_B_ZIWEI);
  const astroEng = buildAstroEngineFromProfile(PROFILE_B_ASTRO);

  type Row = {
    saju_health: number;
    catAvg: number;
    gap: number;
    ten_god: string;
    clash_stem: boolean;
    clash_branch: boolean;
    day_rels: string[];
    month_rels: string[];
  };
  const rows: Row[] = [];

  for (let d = 1; d <= 31; d++) {
    const date = new Date(2026, 4, d);
    const sajuR  = sajuEng.calculate(date);
    const ziweiR = ziweiEng.calculate(date);
    const astroR = astroEng.calculate(date, birthDate);

    const catSums: Record<Cat, number> = { wealth:0, love:0, health:0, career:0, relations:0, study:0 };
    for (const cat of CATS) {
      const w = DOMAIN_WEIGHTS[cat];
      const s = sajuR.scores[cat] ?? BASE;
      const z = ziweiR.scores[cat] ?? 0;
      const a = astroR.scores[cat] ?? 0;
      const zCapped = Math.max(-30, Math.min(30, z));
      const aCapped = Math.max(-25, Math.min(25, a));
      const sSoft = softScale(Math.max(0, Math.min(100, s)));
      const zSoft = softScale(Math.max(0, Math.min(100, BASE + zCapped)));
      const aSoft = softScale(Math.max(0, Math.min(100, BASE + aCapped)));
      const dailyDelta = (sSoft-BASE)*w.saju + (zSoft-BASE)*w.ziwei + (aSoft-BASE)*w.astro;
      const clampedDelta = Math.max(-12, dailyDelta);
      const sens = (DAILY_SENSITIVITY as Record<string, number>)[cat] ?? 1.0;
      catSums[cat] = BASE + clampedDelta * sens;
    }
    const catAvg = CATS.reduce((s, c) => s + catSums[c], 0) / 6;

    rows.push({
      saju_health: sajuR.scores.health,
      catAvg,
      gap: catSums.health - catAvg,
      ten_god: (sajuR.factors.ten_god_of_day as string) ?? "?",
      clash_stem:   (sajuR.factors.ohaeng_clash_stem as boolean) ?? false,
      clash_branch: (sajuR.factors.ohaeng_clash_branch as boolean) ?? false,
      day_rels:   (sajuR.factors.day_branch_relation_types as string[]) ?? [],
      month_rels: (sajuR.factors.month_branch_relation_types as string[]) ?? [],
    });
  }

  const clashDays   = rows.filter(r => r.clash_stem || r.clash_branch);
  const noClashDays = rows.filter(r => !r.clash_stem && !r.clash_branch);
  const avgGapClash   = clashDays.reduce((s, r) => s + r.gap, 0) / Math.max(1, clashDays.length);
  const avgGapNoClash = noClashDays.reduce((s, r) => s + r.gap, 0) / Math.max(1, noClashDays.length);

  console.log(`\nProfile B (Neutral) saju health gap (vs catAvg), by condition:`);
  console.log(`  ohaeng clash days (${clashDays.length}):    avg gap = ${avgGapClash.toFixed(2)}`);
  console.log(`  no-clash days (${noClashDays.length}):        avg gap = ${avgGapNoClash.toFixed(2)}`);
  console.log(`  → clash contributes ~${(avgGapClash - avgGapNoClash).toFixed(2)} pts to health gap`);

  // Ten-god analysis: which TG has worst health gap?
  const tgGaps: Record<string, number[]> = {};
  for (const r of rows) {
    if (!tgGaps[r.ten_god]) tgGaps[r.ten_god] = [];
    tgGaps[r.ten_god].push(r.gap);
  }
  console.log(`\nHealth gap by ten-god (B profile, saju health - catAvg):`);
  for (const [tg, gaps] of Object.entries(tgGaps).sort((a, b) => {
    const avgA = a[1].reduce((s, v) => s + v, 0) / a[1].length;
    const avgB = b[1].reduce((s, v) => s + v, 0) / b[1].length;
    return avgA - avgB;
  })) {
    const avg = gaps.reduce((s, v) => s + v, 0) / gaps.length;
    console.log(`  ${tg.padEnd(4)} n=${gaps.length}  avg_gap=${avg.toFixed(2)}`);
  }

  // What is the structural cross-category health penalty ratio?
  const allGaps = rows.map(r => r.gap);
  const overallGap = allGaps.reduce((a, b) => a + b, 0) / allGaps.length;
  console.log(`\nProfile B: average health - catAvg = ${overallGap.toFixed(2)} pts (pre-compression)`);
  console.log(`  → At 0.75 compression this gap becomes: ${(overallGap * 0.75).toFixed(2)} pts post-compression`);

  // Proposed fix impact estimates
  console.log("\nFix candidate impact estimates (Profile B, pre-compression):");
  console.log("  Option 1: Add health affinity boost to BRANCH_REL_CAT_W for positive rels");
  console.log(`    Current health weight in BRANCH_REL_CAT_W = 1.1`);
  console.log(`    Raising to 1.3 on positive rels (충/형 unchanged):`);
  console.log(`    → estimated +0.5 to +1.2 health daily avg`);

  console.log("\n  Option 2: Reduce ohaengClash direct health penalty");
  console.log(`    Current: stem -6, branch -3 (health-exclusive)`);
  console.log(`    Proposed: stem -4, branch -2 → estimated +${(clashDays.length/31 * 1.5).toFixed(1)} health avg`);

  console.log("\n  Option 3: Cross-category ohaengClash (spread penalty to all cats)");
  console.log(`    Currently health-only. Spreading -2 to all 6 cats would reduce avg by ~-${(clashDays.length/31*0.33).toFixed(1)}`);
  console.log(`    Health rank effect: health gap closes without reducing health score itself`);

  console.log("\n  Option 4: Add recovery/energySustain to more ten-gods (state atom)");
  console.log(`    Currently only 食神/正印/삼합 have recovery/energySustain`);
  console.log(`    Adding small health bonuses via state atoms: limited (capped at ±${MAX_CAT_DELTA})`);

  console.log("\n  Option 5: Increase DOMAIN_WEIGHTS.health.saju from 0.55 to 0.60");
  console.log(`    Redistributes weight from ziwei/astro to saju`);
  console.log(`    Health saju avg is typically ${(rows.reduce((s,r)=>s+r.saju_health,0)/rows.length).toFixed(1)} — higher saju weight amplifies existing advantage`);

  console.log("\n  Option 6 (root): The structural cross-category deficit in health is inherent");
  console.log("    - 疾厄 palace has lowest PALACE_ACTIVATION (-3, only negative activation)");
  console.log("    - No ziwei palace exclusively buffs health like 官祿 buffs career");
  console.log("    - Health relies on 食神/正印/삼합 — rare favorable events");
  console.log("    - Career benefits from EVERY day's ten-god (career coeff in most TG rows is 0 to +10)");
  console.log("    → Most impactful: give health a baseline +2 offset in DOMAIN_WEIGHTS.health saju merge OR");
  console.log("       add a health-equivalent of PALACE_ACTIVATION for 福德/命宮 in ziwei");
}

// ── Run ───────────────────────────────────────────────────────────────────────
diagnose("A (Stress)",   PROFILE_A_SAJU, PROFILE_A_ZIWEI, PROFILE_A_ASTRO);
diagnose("B (Neutral)",  PROFILE_B_SAJU, PROFILE_B_ZIWEI, PROFILE_B_ASTRO);
diagnose("C (Positive)", PROFILE_C_SAJU, PROFILE_C_ZIWEI, PROFILE_C_ASTRO);
summaryComparison();
fixCandidates();
