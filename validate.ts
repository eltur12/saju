/**
 * 30-day × 3-profile validation — compression factor 0.75
 * Run: npx tsx validate.ts
 */
import { FortuneAggregator } from "./src/engines/aggregator.js";
import type { SajuEngineProfile } from "./src/engines/sajuEngine.js";
import type { ZiweiProfile }     from "./src/engines/ziweiEngine.js";
import type { AstroProfile }     from "./src/engines/astroEngine.js";
import { SAMPLE_ZIWEI_PROFILE }  from "./src/engines/ziweiEngine.js";
import { SAMPLE_ASTRO_PROFILE }  from "./src/engines/astroEngine.js";

// ── Profiles ──────────────────────────────────────────────────────────────────

// A: Stress — 偏官 month stem, 子午충 (month-day branch), 백호살
//    甲 day (Wood yang) | 庚 month → 偏官 | day_branch=子, month_branch=午 (충)
const PROFILE_A_SAJU: SajuEngineProfile = {
  day_stem:     "甲",  // Wood, yang
  month_stem:   "庚",  // Metal yang → 偏官 for 甲
  hour_branch:  "戌",
  day_branch:   "子",  // Water
  month_branch: "午",  // Fire — 子午 충 (permanent monthly ambient)
  year_branch:  "卯",  // Wood
  special_stars: ["백호살"],
  dayun_stem:   "壬",  // Water yang → 偏印 (mild positive)
  dayun_branch: "午",  // Fire — reinforces 子午충
};

// A ziwei: year_sihua 化忌→疾厄 (health -2.5/day), current dahan=夫妻 (love palace)
const PROFILE_A_ZIWEI: ZiweiProfile = {
  ...SAMPLE_ZIWEI_PROFILE,
  year_sihua_palaces: { "化祿": "官祿", "化權": "財帛", "化科": "遷移", "化忌": "疾厄" },
  current_dahan: "疾厄",  // worse: dahan on 疾厄 → health -5
  dahan_stars: [],
};

// A astro: Saturn house 6 (health aff 1.5), 2026 constant -6 health, -3 career
const PROFILE_A_ASTRO: AstroProfile = {
  ...SAMPLE_ASTRO_PROFILE,
  planet_houses: {
    ...SAMPLE_ASTRO_PROFILE.planet_houses,
    "Saturn": 6,  // house 6 health weight 1.5 — maximum health drag
  },
};

// B: Neutral — 正財 month stem, 寅午戌 삼합 (partial), no special stars
//    甲 day (Wood yang) | 己 month → 正財 | day_branch=寅, month_branch=未, year_branch=戌
const PROFILE_B_SAJU: SajuEngineProfile = {
  day_stem:     "甲",  // Wood, yang
  month_stem:   "己",  // Earth yin → 正財 for 甲 (甲 yang, 己 yin → diff polarity → 正財)
  hour_branch:  "子",
  day_branch:   "寅",  // Wood
  month_branch: "未",  // Earth — mild (no 충 with natal)
  year_branch:  "戌",  // Earth
  special_stars: [],
  dayun_stem:   "甲",  // 比肩 — neutral
  dayun_branch: "寅",  // neutral
};

// B ziwei: neutral — no 化忌 on 疾厄, dahan on 官祿
const PROFILE_B_ZIWEI: ZiweiProfile = {
  ...SAMPLE_ZIWEI_PROFILE,
  year_sihua_palaces: { "化祿": "官祿", "化權": "財帛", "化科": "遷移", "化忌": "兄弟" },
  current_dahan: "官祿",
  dahan_stars: [],
};

// B astro: Saturn house 12 (low health weight 0.3), mild natal aspects
const PROFILE_B_ASTRO: AstroProfile = {
  ...SAMPLE_ASTRO_PROFILE,
  planet_houses: {
    ...SAMPLE_ASTRO_PROFILE.planet_houses,
    "Saturn": 12,
  },
};

// C: Positive — 偏印 month stem (positive for 丙), 寅午戌 삼합 in chart, 천덕귀인
//    丙 day (Fire yang) | 甲 month → 偏印 | day_branch=寅, month_branch=午 (삼합 base)
const PROFILE_C_SAJU: SajuEngineProfile = {
  day_stem:     "丙",  // Fire, yang
  month_stem:   "甲",  // Wood yang → 偏印 for 丙 (火_木_true = 偏印)
  hour_branch:  "亥",
  day_branch:   "寅",  // Wood — 寅午戌 삼합 (fire) base
  month_branch: "午",  // Fire — 삼합 complement
  year_branch:  "戌",  // Earth — 삼합 complement
  special_stars: ["천덕귀인"],
  dayun_stem:   "甲",  // Wood → 偏印 for 丙 (positive)
  dayun_branch: "寅",  // Wood — harmony
};

// C ziwei: positive — 化祿 on 命宮, dahan on 財帛, no 化忌 on health
const PROFILE_C_ZIWEI: ZiweiProfile = {
  ...SAMPLE_ZIWEI_PROFILE,
  year_sihua_palaces: { "化祿": "命宮", "化權": "財帛", "化科": "官祿", "化忌": "兄弟" },
  current_dahan: "財帛",
  dahan_stars: ["天府"],
};

// C astro: Saturn house 10 (career, low health weight), positive natal
const PROFILE_C_ASTRO: AstroProfile = {
  ...SAMPLE_ASTRO_PROFILE,
  planet_houses: {
    ...SAMPLE_ASTRO_PROFILE.planet_houses,
    "Saturn": 10,
  },
};

// ── Run 30-day simulation ─────────────────────────────────────────────────────

const YEAR  = 2026;
const MONTH = 5;  // May — 31 days

type CatKey = "wealth" | "love" | "health" | "career" | "relations" | "study";
const CATS: CatKey[] = ["wealth", "love", "health", "career", "relations", "study"];

interface ProfileResult {
  name: string;
  days: { date: string; scores: Record<CatKey, number>; overall: number }[];
}

function runProfile(
  name: string,
  saju: SajuEngineProfile,
  ziwei: ZiweiProfile,
  astro: AstroProfile,
): ProfileResult {
  const birthDate = new Date(1998, 0, 22);
  const agg = new FortuneAggregator(saju, ziwei, astro, undefined, birthDate, false);
  const monthly = agg.getMonthlyFortune(YEAR, MONTH);
  return {
    name,
    days: monthly.daily_fortunes.map(d => ({
      date: d.date,
      scores: {
        wealth:    d.scores.wealth,
        love:      d.scores.love,
        health:    d.scores.health,
        career:    d.scores.career,
        relations: d.scores.relations,
        study:     d.scores.study,
      },
      overall: d.scores.overall,
    })),
  };
}

function stats(vals: number[]): { avg: number; std: number; min: number; max: number } {
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const std = Math.sqrt(vals.reduce((s, v) => s + (v - avg) ** 2, 0) / vals.length);
  return { avg, std, min: Math.min(...vals), max: Math.max(...vals) };
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log("\n=== Compression 0.75 — 30-day × 3-profile validation ===\n");

const profiles = [
  runProfile("A (Stress)",   PROFILE_A_SAJU, PROFILE_A_ZIWEI, PROFILE_A_ASTRO),
  runProfile("B (Neutral)",  PROFILE_B_SAJU, PROFILE_B_ZIWEI, PROFILE_B_ASTRO),
  runProfile("C (Positive)", PROFILE_C_SAJU, PROFILE_C_ZIWEI, PROFILE_C_ASTRO),
];

// 1. Category std / range per profile
console.log("─── [1] Category Std / Range ───────────────────────────────────");
for (const p of profiles) {
  console.log(`\nProfile ${p.name}`);
  const header = "  Cat       Avg    Std    Min    Max  Range";
  console.log(header);
  for (const cat of CATS) {
    const vals = p.days.map(d => d.scores[cat]);
    const s = stats(vals);
    const range = s.max - s.min;
    console.log(
      `  ${cat.padEnd(10)} ${s.avg.toFixed(1).padStart(5)} ${s.std.toFixed(1).padStart(5)} ${s.min.toString().padStart(5)} ${s.max.toString().padStart(5)} ${range.toString().padStart(5)}`,
    );
  }
  const overallVals = p.days.map(d => d.overall);
  const os = stats(overallVals);
  console.log(`  ${"overall".padEnd(10)} ${os.avg.toFixed(1).padStart(5)} ${os.std.toFixed(1).padStart(5)} ${os.min.toString().padStart(5)} ${os.max.toString().padStart(5)} ${(os.max - os.min).toString().padStart(5)}`);
}

// 2. Top/bottom distribution across all days
console.log("\n─── [2] Top / Bottom Distribution (rank share %) ───────────────");
for (const p of profiles) {
  const topCount:    Record<string, number> = {};
  const bottomCount: Record<string, number> = {};
  for (const cat of CATS) { topCount[cat] = 0; bottomCount[cat] = 0; }
  for (const d of p.days) {
    const sorted = [...CATS].sort((a, b) => d.scores[b] - d.scores[a]);
    const top = sorted[0];
    const bot = sorted[sorted.length - 1];
    topCount[top]++;
    bottomCount[bot]++;
  }
  const n = p.days.length;
  const topPct    = CATS.map(c => `${c}:${((topCount[c]/n)*100).toFixed(0)}%`).join("  ");
  const botPct    = CATS.map(c => `${c}:${((bottomCount[c]/n)*100).toFixed(0)}%`).join("  ");
  console.log(`Profile ${p.name}`);
  console.log(`  TOP:    ${topPct}`);
  console.log(`  BOTTOM: ${botPct}`);
}

// 3. Health bottom frequency
console.log("\n─── [3] Health Bottom Frequency ────────────────────────────────");
for (const p of profiles) {
  let healthBottom = 0;
  const n = p.days.length;
  for (const d of p.days) {
    const sorted = [...CATS].sort((a, b) => d.scores[b] - d.scores[a]);
    if (sorted[sorted.length - 1] === "health") healthBottom++;
  }
  const healthVals = p.days.map(d => d.scores.health);
  const hs = stats(healthVals);
  console.log(
    `Profile ${p.name}: health bottom ${healthBottom}/${n} (${((healthBottom/n)*100).toFixed(0)}%)` +
    `  avg=${hs.avg.toFixed(1)}  std=${hs.std.toFixed(1)}  range=${hs.min}–${hs.max}`,
  );
}

// 4. Relations bottom frequency
console.log("\n─── [4] Relations Bottom Frequency ─────────────────────────────");
for (const p of profiles) {
  let relBottom = 0;
  const n = p.days.length;
  for (const d of p.days) {
    const sorted = [...CATS].sort((a, b) => d.scores[b] - d.scores[a]);
    if (sorted[sorted.length - 1] === "relations") relBottom++;
  }
  const relVals = p.days.map(d => d.scores.relations);
  const rs = stats(relVals);
  console.log(
    `Profile ${p.name}: relations bottom ${relBottom}/${n} (${((relBottom/n)*100).toFixed(0)}%)` +
    `  avg=${rs.avg.toFixed(1)}  std=${rs.std.toFixed(1)}  range=${rs.min}–${rs.max}`,
  );
}

// 5. Study / Career dominance check
console.log("\n─── [5] Study / Career Top Dominance ───────────────────────────");
for (const p of profiles) {
  let studyTop = 0, careerTop = 0;
  const n = p.days.length;
  for (const d of p.days) {
    const sorted = [...CATS].sort((a, b) => d.scores[b] - d.scores[a]);
    if (sorted[0] === "study")  studyTop++;
    if (sorted[0] === "career") careerTop++;
  }
  console.log(
    `Profile ${p.name}: study top ${studyTop}/${n} (${((studyTop/n)*100).toFixed(0)}%)` +
    `   career top ${careerTop}/${n} (${((careerTop/n)*100).toFixed(0)}%)`,
  );
}

// 6. Overall avg / std
console.log("\n─── [6] Overall Avg / Std ───────────────────────────────────────");
for (const p of profiles) {
  const s = stats(p.days.map(d => d.overall));
  console.log(
    `Profile ${p.name}: overall avg=${s.avg.toFixed(1)}  std=${s.std.toFixed(1)}  min=${s.min}  max=${s.max}`,
  );
}

// 7. Outlier check — any category reaching >80 or <40 on final rounded score
console.log("\n─── [7] Outlier Check (cat > 80 or < 40) ───────────────────────");
let anyOutlier = false;
for (const p of profiles) {
  const highs: string[] = [];
  const lows:  string[] = [];
  for (const d of p.days) {
    for (const cat of CATS) {
      const v = d.scores[cat];
      if (v > 80) highs.push(`${d.date} ${cat}=${v}`);
      if (v < 40) lows.push( `${d.date} ${cat}=${v}`);
    }
  }
  if (highs.length || lows.length) {
    anyOutlier = true;
    console.log(`Profile ${p.name}:`);
    if (highs.length) console.log(`  HIGH (>80): ${highs.join(", ")}`);
    if (lows.length)  console.log(`  LOW  (<40): ${lows.join(", ")}`);
  }
}
if (!anyOutlier) console.log("No outliers detected across all profiles.");

// Bonus: daily table for Profile A (stress)
console.log("\n─── [Bonus] Profile A daily scores (May 2026) ──────────────────");
const pa = profiles[0];
console.log("  Date       W   L   H   C   R   S   Ov  Bot");
for (const d of pa.days) {
  const sorted = [...CATS].sort((a, b) => d.scores[b] - d.scores[a]);
  const bot = sorted[sorted.length - 1][0].toUpperCase();
  console.log(
    `  ${d.date}  ${d.scores.wealth.toString().padStart(3)} ${d.scores.love.toString().padStart(3)} ` +
    `${d.scores.health.toString().padStart(3)} ${d.scores.career.toString().padStart(3)} ` +
    `${d.scores.relations.toString().padStart(3)} ${d.scores.study.toString().padStart(3)} ` +
    `${d.overall.toString().padStart(3)}  ${bot}`,
  );
}

console.log("\n=== Validation complete ===\n");
