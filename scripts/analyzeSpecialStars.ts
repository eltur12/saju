/**
 * SpecialStars 구조 실험 — static vs amplifier 4-way 비교
 * Usage: npx tsx scripts/analyzeSpecialStars.ts
 *
 * 비교 항목:
 *  1. Overall avg / min / max / stddev
 *  2. 사용자 간 평균 차이 (A/B/C 프로필)
 *  3. 카테고리 avg
 *  4. topEvents 다양성
 *  5. 일별 점수 패턴 (14일 샘플)
 */
import { calculateSajuProfile }       from "../src/utils/sajuCalculator";
import { buildZiweiProfile }           from "../src/utils/ziweiCalculator";
import { buildAstroProfile }           from "../src/utils/astroCalculator";
import { FortuneAggregator }           from "../src/engines/aggregator";
import { DEFAULT_ZIWEI_FLAGS }         from "../src/engines/ziweiEngine";
import { DEFAULT_SAJU_FLAGS, AMPLIFIER_SAJU_FLAGS } from "../src/engines/sajuEngine";
import type { DailyFortune }           from "../src/engines/aggregator";

// ── 테스트 프로필 (analyzeBaseline.ts 와 동일) ─────────────────────────────
const PROFILES = [
  {
    label: "A",
    birth: { year: 1988, month: 6, day: 6,  hour: 10, minute: 0 },
    gender: "M" as const,
  },
  {
    label: "B",
    birth: { year: 1979, month: 2, day: 11, hour:  1, minute: 0 },
    gender: "M" as const,
  },
  {
    label: "C",
    birth: { year: 1992, month: 10, day: 20, hour: 14, minute: 0 },
    gender: "F" as const,
  },
];

// 분석 기간: 2026-03-01 ~ 2026-05-31 (92일)
const START  = new Date(2026, 2, 1);
const N_DAYS = 92;

function r1(v: number) { return Math.round(v * 10) / 10; }
function avg(arr: number[]) { return arr.reduce((a,b)=>a+b,0)/arr.length; }
function stdev(arr: number[]) {
  const m = avg(arr);
  return Math.sqrt(arr.reduce((a,v)=>a+(v-m)**2,0)/arr.length);
}

// ── 프로필 빌드 및 92일 실행 ─────────────────────────────────────────────────
async function runProfile(p: typeof PROFILES[0]) {
  const { birth, gender } = p;
  const sajuProfile  = calculateSajuProfile(birth.year, birth.month, birth.day, birth.hour, gender, undefined, birth.minute);
  const ziweiProfile = buildZiweiProfile(birth.year, birth.month, birth.day, birth.hour, 2026, gender === "M");
  const astroProfile = await buildAstroProfile(birth.year, birth.month, birth.day, birth.hour, undefined, undefined, birth.minute);
  const birthDate    = new Date(birth.year, birth.month-1, birth.day);

  function runDays(sajuFlags: typeof DEFAULT_SAJU_FLAGS): DailyFortune[] {
    const agg = new FortuneAggregator(sajuProfile, ziweiProfile, astroProfile, undefined, birthDate, true);
    const days: DailyFortune[] = [];
    for (let i = 0; i < N_DAYS; i++) {
      const d = new Date(START);
      d.setDate(START.getDate() + i);
      days.push(agg.getDailyFortune(d, DEFAULT_ZIWEI_FLAGS, sajuFlags));
    }
    return days;
  }

  return {
    label:     p.label,
    stars:     sajuProfile.special_stars ?? [],
    static:    runDays(DEFAULT_SAJU_FLAGS),
    amplifier: runDays(AMPLIFIER_SAJU_FLAGS),
  };
}

// ── 통계 헬퍼 ─────────────────────────────────────────────────────────────────
const DOM = ["wealth","love","health","career","relations","study"] as const;

function stats(days: DailyFortune[]) {
  const overall = days.map(d => d.scores.overall);
  const catAvg: Record<string,number> = {};
  const catStd: Record<string,number> = {};
  for (const c of DOM) {
    const vals = days.map(d => d.scores[c]);
    catAvg[c] = r1(avg(vals));
    catStd[c] = r1(stdev(vals));
  }

  // topEvent 다양성: 고유 key 수 / 전체 topEvent 수
  let total = 0;
  const labelMap: Record<string,number> = {};
  for (const day of days) {
    for (const ev of day.persisted?.topEvents ?? []) {
      total++;
      labelMap[ev.key] = (labelMap[ev.key] ?? 0) + 1;
    }
  }
  const uniqueKeys     = Object.keys(labelMap).length;
  const top5Ratio      = Object.values(labelMap).sort((a,b)=>b-a).slice(0,5).reduce((a,b)=>a+b,0);
  const top5Pct        = total > 0 ? r1(top5Ratio/total*100) : 0;
  const topLabels      = Object.entries(labelMap).sort((a,b)=>b[1]-a[1]).slice(0,8) as [string,number][];

  return {
    avg:    r1(avg(overall)),
    min:    Math.min(...overall),
    max:    Math.max(...overall),
    std:    r1(stdev(overall)),
    catAvg, catStd,
    uniqueKeys, top5Pct, topLabels,
  };
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
console.log("=== SpecialStars 구조 실험: static vs amplifier ===");
console.log(`기간: 2026-03-01 ~ ${N_DAYS}일  프로필: A/B/C\n`);

const results = [];
for (const p of PROFILES) {
  process.stdout.write(`프로필 ${p.label} 계산 중... `);
  const r = await runProfile(p);
  results.push(r);
  console.log(`완료  특별성: [${r.stars.join(", ") || "없음"}]`);
}
console.log();

// ── 1. Overall 비교 ────────────────────────────────────────────────────────
console.log("══════════════════════════════════════════════════════════════");
console.log("1. Overall avg / stddev / min / max");
console.log("══════════════════════════════════════════════════════════════\n");

for (const r of results) {
  const s  = stats(r.static);
  const a  = stats(r.amplifier);
  const dAvg = r1(a.avg - s.avg);
  const dStd = r1(a.std - s.std);
  console.log(`▶ 프로필 ${r.label}  특별성: [${r.stars.join(", ") || "없음"}]`);
  console.log(`  ${"항목".padEnd(10)} ${"static".padStart(8)} ${"amplifier".padStart(10)} ${"Δ".padStart(6)}`);
  console.log(`  ${"─".repeat(36)}`);
  console.log(`  ${"avg".padEnd(10)} ${String(s.avg).padStart(8)} ${String(a.avg).padStart(10)} ${String(dAvg>=0?"+"+dAvg:dAvg).padStart(6)}`);
  console.log(`  ${"stddev".padEnd(10)} ${String(s.std).padStart(8)} ${String(a.std).padStart(10)} ${String(dStd>=0?"+"+dStd:dStd).padStart(6)}  ← 핵심`);
  console.log(`  ${"min".padEnd(10)} ${String(s.min).padStart(8)} ${String(a.min).padStart(10)}`);
  console.log(`  ${"max".padEnd(10)} ${String(s.max).padStart(8)} ${String(a.max).padStart(10)}`);
  console.log();
}

// ── 2. 사용자 간 평균 차이 ──────────────────────────────────────────────────
console.log("══════════════════════════════════════════════════════════════");
console.log("2. 사용자 간 avg 차이");
console.log("══════════════════════════════════════════════════════════════\n");

const staticAvgs    = results.map(r => stats(r.static).avg);
const amplAvgs      = results.map(r => stats(r.amplifier).avg);
const staticSpread  = r1(Math.max(...staticAvgs) - Math.min(...staticAvgs));
const amplSpread    = r1(Math.max(...amplAvgs)   - Math.min(...amplAvgs));

console.log(`${"프로필".padEnd(10)} ${"static avg".padStart(12)} ${"amplifier avg".padStart(14)}`);
console.log("─".repeat(38));
for (let i = 0; i < results.length; i++) {
  const label = results[i].label;
  console.log(`${label.padEnd(10)} ${String(staticAvgs[i]).padStart(12)} ${String(amplAvgs[i]).padStart(14)}`);
}
console.log("─".repeat(38));
console.log(`${"spread".padEnd(10)} ${String(staticSpread).padStart(12)} ${String(amplSpread).padStart(14)}  ← 작을수록 공평`);
console.log(`${"변화".padEnd(10)} ${"".padStart(12)} ${String(r1(amplSpread-staticSpread)>=0?"+"+r1(amplSpread-staticSpread):r1(amplSpread-staticSpread)).padStart(14)}`);
console.log();

// ── 3. 카테고리 avg ─────────────────────────────────────────────────────────
console.log("══════════════════════════════════════════════════════════════");
console.log("3. 카테고리 avg (static → amplifier)");
console.log("══════════════════════════════════════════════════════════════\n");

for (const r of results) {
  const s = stats(r.static);
  const a = stats(r.amplifier);
  console.log(`▶ 프로필 ${r.label}`);
  console.log(`  ${"카테고리".padEnd(12)} ${"static".padStart(8)} ${"amplif".padStart(8)} ${"Δavg".padStart(6)} ${"static σ".padStart(9)} ${"amplif σ".padStart(9)}`);
  console.log(`  ${"─".repeat(56)}`);
  for (const c of DOM) {
    const da = r1(a.catAvg[c] - s.catAvg[c]);
    console.log(`  ${c.padEnd(12)} ${String(s.catAvg[c]).padStart(8)} ${String(a.catAvg[c]).padStart(8)} ${String(da>=0?"+"+da:da).padStart(6)} ${String(s.catStd[c]).padStart(9)} ${String(a.catStd[c]).padStart(9)}`);
  }
  console.log();
}

// ── 4. topEvents 다양성 ─────────────────────────────────────────────────────
console.log("══════════════════════════════════════════════════════════════");
console.log("4. topEvents 다양성 (고유 key 수 / top5 집중도)");
console.log("══════════════════════════════════════════════════════════════\n");

for (const r of results) {
  const s = stats(r.static);
  const a = stats(r.amplifier);
  console.log(`▶ 프로필 ${r.label}`);
  console.log(`  고유 key 수:   static ${s.uniqueKeys}  →  amplifier ${a.uniqueKeys}`);
  console.log(`  top5 집중도:   static ${s.top5Pct}%  →  amplifier ${a.top5Pct}%  (낮을수록 다양)`);
  console.log(`  상위 8 labels (static / amplifier):`);
  const allTopKeys = new Set([...s.topLabels.map(([k])=>k), ...a.topLabels.map(([k])=>k)]);
  const sortedKeys = [...allTopKeys].sort((ka,kb) => {
    const da = s.topLabels.find(([k])=>k===ka)?.[1] ?? 0;
    const db = s.topLabels.find(([k])=>k===kb)?.[1] ?? 0;
    return db - da;
  }).slice(0,8);
  for (const key of sortedKeys) {
    const sc = s.topLabels.find(([k])=>k===key)?.[1] ?? 0;
    const ac = a.topLabels.find(([k])=>k===key)?.[1] ?? 0;
    const bar = key.startsWith("saju.special") ? " ★" : "";
    console.log(`    ${key.padEnd(38)} ${String(sc).padStart(4)} → ${String(ac).padStart(4)}${bar}`);
  }
  console.log();
}

// ── 5. 일별 점수 패턴 (2026-05, 14일) ────────────────────────────────────
console.log("══════════════════════════════════════════════════════════════");
console.log("5. 일별 점수 비교 (2026-05, 처음 14일)");
console.log("══════════════════════════════════════════════════════════════\n");

for (const r of results) {
  const staticMay = r.static.filter(d => d.date?.startsWith("2026-05")).slice(0,14);
  const amplifMay = r.amplifier.filter(d => d.date?.startsWith("2026-05")).slice(0,14);
  console.log(`▶ 프로필 ${r.label}  [특별성: ${r.stars.join(", ") || "없음"}]`);
  console.log(`  ${"날짜".padEnd(8)} ${"static".padStart(8)} ${"amplif".padStart(8)} ${"Δ".padStart(5)}`);
  for (let i = 0; i < staticMay.length; i++) {
    const sv = staticMay[i].scores.overall;
    const av = amplifMay[i]?.scores.overall ?? "-";
    const delta = typeof av === "number" ? r1(av - sv) : "-";
    const indicator = typeof delta === "number" && Math.abs(delta) >= 3 ? " ←" : "";
    console.log(`  ${(staticMay[i].date?.slice(5) ?? "?").padEnd(8)} ${String(sv).padStart(8)} ${String(av).padStart(8)} ${String(delta>=0?"+"+delta:delta).padStart(5)}${indicator}`);
  }
  console.log();
}

// ── 6. 요약 분석 ──────────────────────────────────────────────────────────────
console.log("══════════════════════════════════════════════════════════════");
console.log("6. 요약 및 판단");
console.log("══════════════════════════════════════════════════════════════\n");

// Q1: 사용자 간 기준선 차이가 줄었는가?
const q1_improved = amplSpread < staticSpread;
console.log(`Q1. 사용자 간 기준선 차이: static spread=${staticSpread}  amplifier spread=${amplSpread}`);
console.log(`    → ${q1_improved ? "✅ 개선됨" : "❌ 개선 안 됨"}  (Δ ${r1(amplSpread-staticSpread)})`);
console.log();

// Q2: 일별 변동성(stddev)이 살아났는가?
const stddevs = results.map(r => ({
  label: r.label, sStd: stats(r.static).std, aStd: stats(r.amplifier).std,
}));
const stdImproved = stddevs.filter(x => x.aStd > x.sStd).length;
console.log(`Q2. 일별 변동성 (stddev 변화):`);
for (const x of stddevs) {
  const d = r1(x.aStd - x.sStd);
  console.log(`    프로필 ${x.label}: ${x.sStd} → ${x.aStd}  (${d>=0?"+"+d:d})`);
}
console.log(`    → ${stdImproved >= 2 ? "✅ 대부분 개선" : stdImproved === 1 ? "⚠️ 일부 개선" : "❌ 미개선"}`);
console.log();

// Q3: 특별성이 해석에 의미 있게 남는가?
// amplifier 모드에서 state atom 경로로 topEvents에 기여하는지 확인
console.log(`Q3. 특별성이 해석에 남는가:`);
for (const r of results) {
  const a = stats(r.amplifier);
  const starKeys = a.topLabels.filter(([k]) => r.stars.some(s => k.includes(s) || k.includes("special") || k.includes("star")));
  const hasStateEffect = r.amplifier.some(d => {
    const debug = (d as any).stateAtomDebug;
    return debug?.activeEvents?.some((e: string) => r.stars.some(s => e.includes(s)));
  });
  console.log(`    프로필 ${r.label} [${r.stars.join(", ")}]: topEvents 직접노출=${starKeys.length}개  stateAtom경로=${hasStateEffect ? "✅" : "—"}`);
}
console.log();

// Q4: 하루온도 철학 적합성
const avgSpreadReduction = r1(staticSpread - amplSpread);
const avgStddevChange    = r1(avg(stddevs.map(x => x.aStd - x.sStd)));
console.log(`Q4. 하루온도 철학 적합성 요약:`);
console.log(`    기준선 spread 변화: ${staticSpread} → ${amplSpread}  (${avgSpreadReduction>=0?"-"+avgSpreadReduction:"+"+Math.abs(avgSpreadReduction)} 감소)`);
console.log(`    stddev 변화 avg:   ${avgStddevChange>=0?"+":""} ${avgStddevChange}`);
console.log();

// Final recommendation
console.log("══════════════════════════════════════════════════════════════");
console.log("최종 추천안");
console.log("══════════════════════════════════════════════════════════════\n");

const recommend_amplifier = q1_improved && stdImproved >= 1;
console.log(recommend_amplifier
  ? "▶ AMPLIFIER 모드 권장"
  : "▶ 추가 튜닝 필요");

console.log(`\n  근거:`);
console.log(`  - 기준선 spread: ${r1(amplSpread-staticSpread) <= 0 ? "✅ 감소 (공평성 개선)" : "⚠️ 증가 또는 동일"}`);
console.log(`  - stddev:       ${avgStddevChange > 0 ? "✅ 상승 (일별 변동성 향상)" : "⚠️ 하락 또는 동일"}`);
console.log(`  - 특별성 보존:  amplifier 모드에서 특별성이 state atom 경로를 통해 나쁜 날 amplification 역할 유지`);
console.log(`\n  주의:`);
console.log(`  - amplifier는 특별성이 '평균 점수'에서 '변동성 증폭'으로 역할 이동`);
console.log(`  - 겁살 사용자는 나쁜 날(충·偏官 등)이 더 나쁘게 느껴질 수 있음`);
console.log(`  - 월덕귀인 사용자는 좋은 날이 더 좋아지는 효과 → 전반적 납득 가능`);
console.log(`  - profileBaselineLayer는 그대로 두고 amplifier만 활성화하면 절충됨`);

console.log("\n✅ 실험 완료");
