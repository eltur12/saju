/**
 * Run: npx tsx diagnose_persisted_diversity.ts
 * Analyzes persistedDailyModel directly for May 2026 (31 days).
 */
import { FortuneAggregator, type DailyFortune } from "./src/engines/aggregator.js";
import type { SajuEngineProfile } from "./src/engines/sajuEngine.js";
import { type ZiweiProfile, SAMPLE_ZIWEI_PROFILE } from "./src/engines/ziweiEngine.js";
import { type AstroProfile, SAMPLE_ASTRO_PROFILE } from "./src/engines/astroEngine.js";

const SAJU: SajuEngineProfile = {
  day_stem: "甲", month_stem: "己", hour_branch: "子",
  day_branch: "寅", month_branch: "未", year_branch: "戌",
  special_stars: [], dayun_stem: "甲", dayun_branch: "寅",
};
const ZIWEI: ZiweiProfile = {
  ...SAMPLE_ZIWEI_PROFILE,
  year_sihua_palaces: { "化祿": "官祿", "化權": "財帛", "化科": "遷移", "化忌": "兄弟" },
  current_dahan: "官祿", dahan_stars: [],
};
const ASTRO: AstroProfile = {
  ...SAMPLE_ASTRO_PROFILE,
  planet_houses: { ...SAMPLE_ASTRO_PROFILE.planet_houses, "Saturn": 12 },
};

const agg = new FortuneAggregator(SAJU, ZIWEI, ASTRO, undefined, new Date(1998, 0, 22));
agg.prewarmBaseline(new Date(2026, 4, 1));

const allDays: DailyFortune[] = [];
for (let d = 1; d <= 31; d++) {
  allDays.push(agg.getDailyFortune(new Date(2026, 4, d)));
}

const N = allDays.length;

// ── TASK 1: flowType distribution ──────────────────────────────────────────
const flowTypeCounts: Record<string, number> = {};
for (const f of allDays) {
  const ft = f.persisted?.summary?.flowType ?? "MISSING";
  flowTypeCounts[ft] = (flowTypeCounts[ft] ?? 0) + 1;
}
const flowTypeRows = Object.entries(flowTypeCounts)
  .sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `  ${k}: ${v}일 (${((v/N)*100).toFixed(0)}%)`);

// ── TASK 2: topStates frequency ─────────────────────────────────────────────
const stateFreq: Record<string, { count: number; strengths: number[] }> = {};
for (const f of allDays) {
  for (const st of f.persisted?.topStates ?? []) {
    if (!stateFreq[st.key]) { stateFreq[st.key] = { count: 0, strengths: [] }; }
    stateFreq[st.key].count++;
    stateFreq[st.key].strengths.push(st.strength);
  }
}
const stateRows = Object.entries(stateFreq)
  .sort((a, b) => b[1].count - a[1].count)
  .map(([k, v]) => {
    const avg = v.strengths.reduce((a, b) => a + b, 0) / v.strengths.length;
    return `  ${k}: ${v.count}일, avg strength=${avg.toFixed(3)}`;
  });

// ── TASK 3: topEvents frequency + source breakdown ──────────────────────────
const eventFreq: Record<string, { count: number; sources: Record<string, number>; impacts: number[] }> = {};
for (const f of allDays) {
  for (const ev of f.persisted?.topEvents ?? []) {
    if (!eventFreq[ev.key]) { eventFreq[ev.key] = { count: 0, sources: {}, impacts: [] }; }
    eventFreq[ev.key].count++;
    eventFreq[ev.key].sources[ev.source] = (eventFreq[ev.key].sources[ev.source] ?? 0) + 1;
    eventFreq[ev.key].impacts.push(ev.impact);
  }
}
const eventRows = Object.entries(eventFreq)
  .sort((a, b) => b[1].count - a[1].count)
  .slice(0, 20)
  .map(([k, v]) => {
    const avgImp = v.impacts.reduce((a, b) => a + b, 0) / v.impacts.length;
    const srcStr = Object.entries(v.sources).map(([s, c]) => `${s}:${c}`).join(",");
    return `  ${k}: ${v.count}일 [${srcStr}] avgImpact=${avgImp.toFixed(2)}`;
  });

// ── TASK 4: Diversity metrics ───────────────────────────────────────────────
// Unique flowTypes per day count
const uniqueFlowTypes = Object.keys(flowTypeCounts).length;
// Days with flowType !== "flow.neutral"
const nonNeutralDays = allDays.filter(f => f.persisted?.summary?.flowType !== "flow.neutral").length;

// topStates slot count per day (how many unique states each day)
const statesPerDay = allDays.map(f => f.persisted?.topStates?.length ?? 0);
const avgStatesPerDay = statesPerDay.reduce((a, b) => a + b, 0) / N;
const minStatesPerDay = Math.min(...statesPerDay);
const maxStatesPerDay = Math.max(...statesPerDay);

// topEvents slot count per day
const eventsPerDay = allDays.map(f => f.persisted?.topEvents?.length ?? 0);
const avgEventsPerDay = eventsPerDay.reduce((a, b) => a + b, 0) / N;
const minEventsPerDay = Math.min(...eventsPerDay);
const maxEventsPerDay = Math.max(...eventsPerDay);

// Unique state keys across all days
const uniqueStateKeys = Object.keys(stateFreq).length;
// Unique event keys across all days
const uniqueEventKeys = Object.keys(eventFreq).length;

// State that appears most often
const topStateName = Object.entries(stateFreq).sort((a,b) => b[1].count - a[1].count)[0];
const topEventName = Object.entries(eventFreq).sort((a,b) => b[1].count - a[1].count)[0];

// ── TASK 5: Score range and overall distribution ────────────────────────────
const overallScores = allDays.map(f => f.scores.overall);
const overallMin = Math.min(...overallScores);
const overallMax = Math.max(...overallScores);
const overallAvg = overallScores.reduce((a, b) => a + b, 0) / N;

// Category score ranges
const categories = ["wealth", "love", "health", "career", "relations", "study"] as const;
const catStats = categories.map(cat => {
  const vals = allDays.map(f => f.scores[cat] ?? 0);
  return {
    cat,
    min: Math.min(...vals),
    max: Math.max(...vals),
    avg: (vals.reduce((a, b) => a + b, 0) / N).toFixed(1),
    range: Math.max(...vals) - Math.min(...vals),
  };
});

// flowType per day list
const flowTypePerDay = allDays.map(f => ({
  date: f.date,
  flowType: f.persisted?.summary?.flowType ?? "MISSING",
  overall: f.scores.overall,
  topStatesCount: f.persisted?.topStates?.length ?? 0,
  topEventsCount: f.persisted?.topEvents?.length ?? 0,
  topState0: f.persisted?.topStates?.[0]?.key ?? "-",
  topEvent0: f.persisted?.topEvents?.[0]?.key ?? "-",
}));

// ── OUTPUT ──────────────────────────────────────────────────────────────────
console.log("═══════════════════════════════════════════════════════");
console.log(" PERSISTED DIVERSITY ANALYSIS — 2026-05 (31 days)");
console.log("═══════════════════════════════════════════════════════");

console.log("\n[TASK 1] flowType distribution");
console.log(flowTypeRows.join("\n"));
console.log(`  → 총 ${uniqueFlowTypes}종류, flow.neutral 이외: ${nonNeutralDays}일`);

console.log("\n[TASK 2] topStates 등장 빈도 (상위 15개)");
console.log(stateRows.slice(0, 15).join("\n"));
console.log(`  → 전체 고유 state key: ${uniqueStateKeys}종`);
console.log(`  → 일당 평균 state수: ${avgStatesPerDay.toFixed(1)} (min=${minStatesPerDay}, max=${maxStatesPerDay})`);

console.log("\n[TASK 3] topEvents 등장 빈도 (상위 20개)");
console.log(eventRows.join("\n"));
console.log(`  → 전체 고유 event key: ${uniqueEventKeys}종`);
console.log(`  → 일당 평균 event수: ${avgEventsPerDay.toFixed(1)} (min=${minEventsPerDay}, max=${maxEventsPerDay})`);

console.log("\n[TASK 4] Diversity 수치 요약");
console.log(`  flowType 다양성: ${uniqueFlowTypes}종 / flow.neutral 점유율 ${((flowTypeCounts["flow.neutral"]??0)/N*100).toFixed(0)}%`);
console.log(`  최다 state: "${topStateName[0]}" (${topStateName[1].count}일 중 등장)`);
console.log(`  최다 event: "${topEventName[0]}" (${topEventName[1].count}일 중 등장)`);
console.log(`  overall 점수 범위: ${overallMin}–${overallMax} (avg=${overallAvg.toFixed(1)})`);
console.log("\n  카테고리별 점수 범위:");
for (const s of catStats) {
  console.log(`    ${s.cat}: ${s.min}–${s.max} (range=${s.range}, avg=${s.avg})`);
}

console.log("\n[TASK 5] 일별 상세 (flowType + overall + top state/event)");
for (const r of flowTypePerDay) {
  console.log(
    `  ${r.date}  ft=${r.flowType.padEnd(20)} overall=${String(r.overall).padStart(3)}` +
    `  states=${r.topStatesCount}  events=${r.topEventsCount}` +
    `  state[0]=${r.topState0}  event[0]=${r.topEvent0}`
  );
}

console.log("\n═══════════════════════════════════════════════════════");
