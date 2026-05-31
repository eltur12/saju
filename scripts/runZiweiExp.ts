/**
 * Ziwei 4-way 구조 실험 — standalone tsx 실행
 * Usage: npx tsx scripts/runZiweiExp.ts
 */
import { FortuneAggregator, type DailyFortune } from "../src/engines/aggregator";
import { calculateSajuProfile } from "../src/utils/sajuCalculator";
import { buildZiweiProfile } from "../src/utils/ziweiCalculator";
import { buildAstroProfile } from "../src/utils/astroCalculator";
import {
  DEFAULT_ZIWEI_FLAGS,
  EXPERIMENT_ZIWEI_FLAGS,
  EXPERIMENT_ZIWEI_FLAGS_0,
  EXPERIMENT_ZIWEI_FLAGS_01,
  type ZiweiExperimentFlags,
} from "../src/engines/ziweiEngine";

// ── 테스트 프로필 (1990-03-15, 午시, 남성) ─────────────────────────────────
const BIRTH = { year: 1990, month: 3, day: 15, hour: 12, minute: 0 };
const GENDER = "M" as const;

const sajuProfile = calculateSajuProfile(
  BIRTH.year, BIRTH.month, BIRTH.day, BIRTH.hour, GENDER, undefined, BIRTH.minute,
);
const ziweiProfile = buildZiweiProfile(
  BIRTH.year, BIRTH.month, BIRTH.day, BIRTH.hour, 2026, GENDER === "M",
);
const astroProfile = await buildAstroProfile(
  BIRTH.year, BIRTH.month, BIRTH.day, BIRTH.hour, undefined, undefined, BIRTH.minute,
);
const birthDate = new Date(BIRTH.year, BIRTH.month - 1, BIRTH.day);

// 3개월 창: 2026-04 ~ 2026-06
const MONTHS = [
  { year: 2026, month: 4 },
  { year: 2026, month: 5 },
  { year: 2026, month: 6 },
];

function runMonths(flags: ZiweiExperimentFlags): DailyFortune[] {
  const agg = new FortuneAggregator(sajuProfile, ziweiProfile, astroProfile, undefined, birthDate, true);
  const all: DailyFortune[] = [];
  for (const { year, month } of MONTHS) {
    all.push(...agg.getMonthlyFortune(year, month, flags).daily_fortunes);
  }
  return all;
}

const CAT_KEYS = ["wealth", "love", "health", "career", "relations", "study"] as const;

function r1(v: number) { return Math.round(v * 10) / 10; }

function buildStats(days: DailyFortune[]) {
  const overallVals = days.map(d => d.scores.overall);
  const n = overallVals.length;
  const oAvg = overallVals.reduce((a, b) => a + b, 0) / n;
  const oVar = overallVals.reduce((a, v) => a + (v - oAvg) ** 2, 0) / n;

  const categories: Record<string, { avg: number; stddev: number }> = {};
  for (const cat of CAT_KEYS) {
    const vals = days.map(d => d.scores[cat]);
    const avg  = vals.reduce((a, b) => a + b, 0) / n;
    const vari = vals.reduce((a, v) => a + (v - avg) ** 2, 0) / n;
    categories[cat] = { avg: r1(avg), stddev: r1(Math.sqrt(vari)) };
  }

  let total = 0, ziweiCnt = 0;
  const labelMap: Record<string, number> = {};
  for (const day of days) {
    for (const ev of day.persisted?.topEvents ?? []) {
      total++;
      if (ev.key.startsWith("ziwei.")) ziweiCnt++;
      labelMap[ev.key] = (labelMap[ev.key] ?? 0) + 1;
    }
  }

  const topLabels = Object.entries(labelMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15) as [string, number][];

  return {
    overall: { avg: r1(oAvg), min: Math.min(...overallVals), max: Math.max(...overallVals), stddev: r1(Math.sqrt(oVar)) },
    categories,
    ziweiRatio: total > 0 ? r1(ziweiCnt / total * 100) : 0,
    topLabels,
  };
}

// ── 실행 ──────────────────────────────────────────────────────────────────────
console.log("=== Ziwei 4-way 구조 실험 ===");
console.log(`프로필: ${BIRTH.year}-${BIRTH.month.toString().padStart(2,"0")}-${BIRTH.day.toString().padStart(2,"0")} ${BIRTH.hour}시 ${GENDER}`);
console.log(`기간: ${MONTHS.map(m => `${m.year}-${String(m.month).padStart(2,"0")}`).join(" / ")}\n`);

const configs = [
  { name: "DEFAULT  (현행: natal+sihua+월0.4)", flags: DEFAULT_ZIWEI_FLAGS },
  { name: "EXP_0    (일활성만: 월0.0)",          flags: EXPERIMENT_ZIWEI_FLAGS_0 },
  { name: "EXP_01   (일활성+월0.1)",             flags: EXPERIMENT_ZIWEI_FLAGS_01 },
  { name: "EXP_02   (일활성+월0.2)",             flags: EXPERIMENT_ZIWEI_FLAGS },
] as const;

const results = configs.map(c => ({ ...c, stats: buildStats(runMonths(c.flags)) }));

// ── Overall 비교 ──────────────────────────────────────────────────────────────
console.log("┌─ Overall ──────────────────────────────────────────────────────────");
const hdr = "설정".padEnd(40) + ["avg","stddev","min","max"].map(k => k.padStart(7)).join("");
console.log("│ " + hdr);
console.log("│ " + "─".repeat(68));
for (const r of results) {
  const line = r.name.padEnd(40)
    + String(r.stats.overall.avg).padStart(7)
    + String(r.stats.overall.stddev).padStart(7)
    + String(r.stats.overall.min).padStart(7)
    + String(r.stats.overall.max).padStart(7);
  console.log("│ " + line);
}
console.log("└" + "─".repeat(70));

// ── ziwei 비중 ─────────────────────────────────────────────────────────────────
console.log("\n── ziwei 비중(%) ────────────────────────────");
for (const r of results) {
  console.log(`  ${r.name.padEnd(40)} ${r.stats.ziweiRatio}%`);
}

// ── Category stddev 비교 (분산이 핵심) ────────────────────────────────────────
console.log("\n── 카테고리 avg / stddev ─────────────────────────────────────────────");
const catHdr = "카테고리".padEnd(12) + results.map(r => r.name.slice(0,8).padStart(15)).join("");
console.log("  " + catHdr);
for (const cat of CAT_KEYS) {
  const row = cat.padEnd(12) + results.map(r => {
    const cv = r.stats.categories[cat];
    return `${cv.avg}/${cv.stddev}`.padStart(15);
  }).join("");
  console.log("  " + row);
}

// ── 상위 topEvent label 반복성 비교 ──────────────────────────────────────────
console.log("\n── 상위 15 label 출현 횟수 ───────────────────────────────────────────");
console.log("  " + "label".padEnd(35) + results.map(r => r.name.slice(0,8).padStart(8)).join(""));
const allLabels = new Set<string>();
for (const r of results) r.stats.topLabels.forEach(([k]) => allLabels.add(k));
const sortedLabels = Array.from(allLabels).sort((a, b) => {
  const da = results[0].stats.topLabels.find(([k]) => k === a)?.[1] ?? 0;
  const db = results[0].stats.topLabels.find(([k]) => k === b)?.[1] ?? 0;
  return db - da;
}).slice(0, 15);

for (const label of sortedLabels) {
  const row = label.padEnd(35) + results.map(r => {
    const cnt = r.stats.topLabels.find(([k]) => k === label)?.[1] ?? 0;
    return String(cnt).padStart(8);
  }).join("");
  console.log("  " + row);
}

// ── 일별 점수 변동 패턴 (처음 14일) ────────────────────────────────────────
console.log("\n── 2026-05 점수 일별 패턴 (처음 14일) ───────────────────────────────");
const daySamples: DailyFortune[][] = configs.map(c =>
  runMonths(c.flags).filter(d => d.date?.startsWith("2026-05")).slice(0, 14)
);
const dateList = daySamples[0].map(d => d.date?.slice(5) ?? "?");
console.log("  " + "날짜  ".padEnd(8) + configs.map(c => c.name.slice(0,8).padStart(8)).join(""));
for (let i = 0; i < dateList.length; i++) {
  const row = dateList[i].padEnd(8) + daySamples.map(ds => String(ds[i]?.scores.overall ?? "-").padStart(8)).join("");
  console.log("  " + row);
}

console.log("\n✅ 실험 완료");
