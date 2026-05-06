/**
 * Diagnostic: Profile A health-bottom 94% root cause analysis
 * Read-only — no production code modified.
 */
import { buildSajuEngineFromProfile, STEM_ELEMENT, HEAVENLY_STEMS, EARTHLY_BRANCHES, BRANCH_ELEMENT } from "./src/engines/sajuEngine.js";
import type { SajuEngineProfile, ScoreMap } from "./src/engines/sajuEngine.js";

const PROFILE_A: SajuEngineProfile = {
  day_stem:"甲", month_stem:"庚", hour_branch:"戌", day_branch:"子",
  month_branch:"午", year_branch:"卯", special_stars:["백호살"],
  dayun_stem:"壬", dayun_branch:"午",
};

const engine = buildSajuEngineFromProfile(PROFILE_A);

const CATS: (keyof ScoreMap)[] = ["wealth","love","health","career","relations","study"];

// ----- May 2026 full run -----
const days = Array.from({length:31}, (_,i) => {
  const date = new Date(2026,4,i+1);
  const r = engine.calculate(date);
  const s = r.scores;
  const sorted = [...CATS].sort((a,b) => s[b]-s[a]);
  return {
    date: `May ${i+1}`,
    scores: s,
    rank: sorted,
    bottom: sorted[sorted.length-1],
    factors: r.factors,
  };
});

const healthBottom = days.filter(d => d.bottom === "health");
const nonBottom    = days.filter(d => d.bottom !== "health");

console.log("=== Profile A: Health Bottom Analysis ===\n");
console.log(`Health is bottom on ${healthBottom.length}/31 days (${Math.round(healthBottom.length/31*100)}%)\n`);

// ----- 1. Persistent baseline (same every day) -----
// Use May 4 (己卯) as clean day: no stem clash, no ohaeng penalty
const may4 = days[3];
console.log("--- 1. Persistent component snapshot (May 4, 己卯) ---");
console.log(`  Day scores: ${JSON.stringify(may4.scores)}`);
console.log(`  Rank: ${may4.rank.join(" > ")}`);
console.log(`  Bottom: ${may4.bottom}\n`);

// ----- 2. Non-bottom health days analysis -----
console.log("--- 2. Days health escaped bottom ---");
if (nonBottom.length === 0) {
  console.log("  NONE — health is bottom every single day.");
} else {
  for (const d of nonBottom) {
    const br = d.factors.day_branch_relation_types as string[];
    const mbr = d.factors.month_branch_relation_types as string[];
    console.log(`  ${d.date} (${d.factors.target_stem}${d.factors.target_branch}): bottom=${d.bottom}, health=${d.scores.health}, career=${d.scores.career}, branch_rels=[${br.join(",")}]`);
  }
}
console.log();

// ----- 3. Contribution breakdown: persistent vs daily -----
// Separate persistent from acute by comparing clean days vs heavy days

// Key days
const testDays: {label:string, idx:number}[] = [
  {label:"May 1 (丙子) — sub-zero?",   idx:0},
  {label:"May 4 (己卯) — best branch",  idx:3},
  {label:"May 7 (壬午) — dayun match",  idx:6},
  {label:"May 10 (乙酉) — worst branch",idx:9},
  {label:"May 11 (丙戌) — good branch", idx:10},
  {label:"May 25 (庚子) — dual clash",  idx:24},
  {label:"May 27 (壬寅) — samhap",      idx:26},
  {label:"May 28 (癸卯) — no penalty",  idx:27},
];

console.log("--- 3. Health vs career per notable day ---");
console.log("  Day                         | H   | C   | Rel  | BranchRel(day)   | MonthBr | Ohaeng | StemClash");
for (const {label, idx} of testDays) {
  const d = days[idx];
  const f = d.factors;
  const br = (f.day_branch_relation_types as string[]).join(",") || "—";
  const mbr= (f.month_branch_relation_types as string[]).join(",") || "—";
  const oh = (f.ohaeng_clash_stem || f.ohaeng_clash_branch) ? `stem:${f.ohaeng_clash_stem} br:${f.ohaeng_clash_branch}` : "none";
  console.log(`  ${label.padEnd(30)}| ${d.scores.health.toString().padEnd(4)}| ${d.scores.career.toString().padEnd(4)}| ${d.bottom.padEnd(9)}| ${br.padEnd(18)}| ${mbr.padEnd(8)}| ${oh.padEnd(14)}|`);
}
console.log();

// ----- 4. Rank distribution -----
console.log("--- 4. Category bottom-rank frequency (31 days) ---");
const bottomCount: Partial<Record<keyof ScoreMap, number>> = {};
for (const d of days) {
  bottomCount[d.bottom] = (bottomCount[d.bottom] ?? 0) + 1;
}
for (const cat of CATS) {
  const n = bottomCount[cat] ?? 0;
  console.log(`  ${cat.padEnd(10)}: ${n} days (${Math.round(n/31*100)}%)`);
}
console.log();

// ----- 5. Average scores across month -----
console.log("--- 5. Average daily scores (May 2026) ---");
const avgs: Partial<Record<keyof ScoreMap,number>> = {};
for (const cat of CATS) {
  avgs[cat] = Math.round(days.reduce((s,d) => s + d.scores[cat], 0) / 31 * 10) / 10;
}
for (const cat of CATS) {
  console.log(`  ${cat.padEnd(10)}: ${avgs[cat]}`);
}
console.log();

// ----- 6. Persistent penalty decomposition (manual for Profile A) -----
// Compute what each fixed component contributes to health vs career
console.log("--- 6. Persistent health deficit vs career (fixed daily) ---");
// We can infer from the engine: test with a neutral day (no branch rel, no clash day)
// Use 壬戌 which has: positive branch (+19 health), no stem clash, TG偏印(small), no ohaeng
const may23 = days[22]; // May 23 = 戊戌 (day 23)
const may11 = days[10]; // May 11 = 丙戌
const may7  = days[6];  // May 7 = 壬午

console.log(`  May 11 (丙戌): H=${may11.scores.health} C=${may11.scores.career}  gap=${may11.scores.health - may11.scores.career}`);
console.log(`  May 23 (戊戌): H=${may23.scores.health} C=${may23.scores.career}  gap=${may23.scores.health - may23.scores.career}`);
console.log(`  May 27 (壬寅): H=${days[26].scores.health} C=${days[26].scores.career}  gap=${days[26].scores.health - days[26].scores.career}`);
console.log(`  May 28 (癸卯): H=${days[27].scores.health} C=${days[27].scores.career}  gap=${days[27].scores.health - days[27].scores.career}`);
console.log();

// Among the "best" branch days, is health ever above career?
console.log("--- 7. Best health days: is health above career? ---");
const sorted = [...days].sort((a,b) => b.scores.health - a.scores.health);
for (const d of sorted.slice(0,8)) {
  const aboveCareer = d.scores.health > d.scores.career ? "YES" : "no";
  const br = (d.factors.day_branch_relation_types as string[]).join(",") || "—";
  console.log(`  ${d.date} ${d.factors.target_stem}${d.factors.target_branch}: H=${d.scores.health} C=${d.scores.career} W=${d.scores.wealth} Rel=${d.scores.relations} aboveCareer=${aboveCareer} [${br}]`);
}
console.log();

// ----- 8. Month branch contribution -----
console.log("--- 8. Month branch (巳月) vs natal 戌 — fixed every day ---");
const mbr0 = days[0].factors.month_branch_relation_types as string[];
console.log(`  Month branch rel types: [${mbr0.join(",")}]  (same every day in May)`);
console.log(`  These fire against natal 戌(hour_branch) → 원진+귀문`);
console.log();

// ----- 9. Special star + birth-month TG analysis -----
console.log("--- 9. Natal fixed components (백호살 + 偏官 birth-month) ---");
console.log("  백호살 health=-8, career=-3  →  Δ(H-C) = -5 per day");
console.log("  偏官 birth-month (庚×0.53):  health=round(-8×0.53)=-4, career=round(-5×0.53)=-3 → Δ(H-C)=-1 per day");
console.log("  Combined natal H vs C disadvantage: -6 pts/day");
console.log("  BRANCH_REL_CAT_W.health 0.85 reduces ACUTE branch penalty but cannot offset natal disadvantage.");
