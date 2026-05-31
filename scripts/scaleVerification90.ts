/**
 * 점수 스케일 검증 — 90일 × 10명 전체 분포
 * Usage: npx tsx scripts/scaleVerification90.ts
 */
import { calculateSajuProfile } from "../src/utils/sajuCalculator";
import { buildZiweiProfile }    from "../src/utils/ziweiCalculator";
import { buildAstroProfile }    from "../src/utils/astroCalculator";
import { FortuneAggregator }    from "../src/engines/aggregator";
import { DEFAULT_ZIWEI_FLAGS }  from "../src/engines/ziweiEngine";
import { DEFAULT_SAJU_FLAGS }   from "../src/engines/sajuEngine";
import type { DailyFortune }    from "../src/engines/aggregator";

const PROFILES = [
  { id:1,  label:"P01 (1962M)", birth:{year:1962,month:2, day:14,hour:6, minute:0}, gender:"M" as const },
  { id:2,  label:"P02 (1970F)", birth:{year:1970,month:4, day:3, hour:14,minute:0}, gender:"F" as const },
  { id:3,  label:"P03 (1975M)", birth:{year:1975,month:6, day:20,hour:10,minute:0}, gender:"M" as const },
  { id:4,  label:"P04 (1983F)", birth:{year:1983,month:12,day:5, hour:22,minute:0}, gender:"F" as const },
  { id:5,  label:"P05 (1988M)", birth:{year:1988,month:9, day:9, hour:8, minute:0}, gender:"M" as const },
  { id:6,  label:"P06 (1993F)", birth:{year:1993,month:3, day:15,hour:4, minute:0}, gender:"F" as const },
  { id:7,  label:"P07 (1997M)", birth:{year:1997,month:7, day:7, hour:12,minute:0}, gender:"M" as const },
  { id:8,  label:"P08 (2001F)", birth:{year:2001,month:10,day:31,hour:18,minute:0}, gender:"F" as const },
  { id:9,  label:"P09 (1971F)", birth:{year:1971,month:9, day:1, hour:20,minute:0}, gender:"F" as const },
  { id:10, label:"P10 (2005M)", birth:{year:2005,month:8, day:18,hour:16,minute:0}, gender:"M" as const },
];

// 최근 90일: 2026-03-02 ~ 2026-05-30
const END   = new Date(2026, 4, 30);
const START = new Date(END);
START.setDate(END.getDate() - 89);
const N_DAYS = 90;

function r1(v: number) { return Math.round(v * 10) / 10; }
function r2(v: number) { return Math.round(v * 100) / 100; }
function avg(a: number[]) { return a.reduce((s,x)=>s+x,0)/a.length; }
function stdev(a: number[]) {
  const m = avg(a);
  return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/a.length);
}
function pct(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo));
}
function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function pad(s: string|number, w: number) { return String(s).padStart(w); }
function pct2str(n: number, total: number) { return `${Math.round(n/total*100)}%`; }

async function buildProfile(p: typeof PROFILES[0]) {
  const b = p.birth;
  return {
    label:        p.label,
    sajuProfile:  calculateSajuProfile(b.year, b.month, b.day, b.hour, p.gender, undefined, b.minute),
    ziweiProfile: buildZiweiProfile(b.year, b.month, b.day, b.hour, 2026, p.gender==="M"),
    astroProfile: await buildAstroProfile(b.year, b.month, b.day, b.hour, undefined, undefined, b.minute),
    birthDate:    new Date(b.year, b.month-1, b.day),
  };
}

async function main() {
  console.log("프로필 빌드 중...");
  const pds = await Promise.all(PROFILES.map(buildProfile));
  console.log("완료\n");

  // ── 전체 수집 ─────────────────────────────────────────────────────────────
  // allScores: 900개 (10명 × 90일)
  // perProfile[pi]: 90개
  // records: { score, date, label } for extreme analysis
  const allScores: number[] = [];
  const perProfile: number[][] = PROFILES.map(() => []);
  const records: Array<{ score: number; date: string; profile: string }> = [];

  for (let i = 0; i < N_DAYS; i++) {
    const d = new Date(START);
    d.setDate(START.getDate() + i);
    const ds = dateStr(d);
    for (let pi = 0; pi < PROFILES.length; pi++) {
      const pd = pds[pi];
      const agg = new FortuneAggregator(
        pd.sajuProfile, pd.ziweiProfile, pd.astroProfile,
        undefined, pd.birthDate, true,
      );
      const fortune: DailyFortune = agg.getDailyFortune(d, DEFAULT_ZIWEI_FLAGS, DEFAULT_SAJU_FLAGS);
      const s = fortune.scores.overall;
      allScores.push(s);
      perProfile[pi].push(s);
      records.push({ score: s, date: ds, profile: PROFILES[pi].label });
    }
  }

  const sorted = [...allScores].sort((a,b) => a-b);
  const total  = sorted.length; // 900

  // ── 출력 1: 전체 분포 ──────────────────────────────────────────────────────
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log("출력 1: 전체 점수 분포 (10명 × 90일 = 900 데이터포인트)");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const stats = {
    min:    sorted[0],
    max:    sorted[total-1],
    avg:    r1(avg(allScores)),
    stddev: r1(stdev(allScores)),
    p1:     pct(sorted,1),
    p5:     pct(sorted,5),
    p10:    pct(sorted,10),
    p25:    pct(sorted,25),
    p50:    pct(sorted,50),
    p75:    pct(sorted,75),
    p90:    pct(sorted,90),
    p95:    pct(sorted,95),
    p99:    pct(sorted,99),
  };

  const rows: [string, number][] = [
    ["min",     stats.min],
    ["p1",      stats.p1],
    ["p5",      stats.p5],
    ["p10",     stats.p10],
    ["p25",     stats.p25],
    ["p50(median)", stats.p50],
    ["p75",     stats.p75],
    ["p90",     stats.p90],
    ["p95",     stats.p95],
    ["p99",     stats.p99],
    ["max",     stats.max],
    ["",        0],
    ["avg",     stats.avg],
    ["stddev",  stats.stddev],
  ];
  for (const [label, val] of rows) {
    if (label === "") { console.log(); continue; }
    const bar = label.startsWith("p") || label==="min"||label==="max"
      ? " " + "█".repeat(Math.max(0, Math.round((val-40)/2))) : "";
    console.log(`  ${label.padEnd(14)} = ${pad(val,4)}${bar}`);
  }

  // IQR
  const iqr = stats.p75 - stats.p25;
  const p5p95span = stats.p95 - stats.p5;
  console.log(`\n  IQR (p25~p75)   = ${iqr}점`);
  console.log(`  p5~p95 범위     = ${p5p95span}점  (${stats.p5} ~ ${stats.p95})`);

  // ── 출력 2: 프로필별 분포 ─────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("출력 2: 프로필별 분포 (90일)");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log(`${"".padEnd(14)} ${"avg".padStart(5)} ${"min".padStart(4)} ${"max".padStart(4)} ${"range".padStart(6)} ${"std".padStart(5)} ${"p5".padStart(4)} ${"p95".padStart(4)}`);
  console.log("─".repeat(56));

  const profileSummaries = perProfile.map((s, pi) => {
    const ss = [...s].sort((a,b)=>a-b);
    return {
      label:  PROFILES[pi].label,
      avg:    r1(avg(s)),
      min:    ss[0],
      max:    ss[ss.length-1],
      range:  ss[ss.length-1] - ss[0],
      std:    r1(stdev(s)),
      p5:     pct(ss,5),
      p95:    pct(ss,95),
    };
  });

  for (const s of profileSummaries) {
    const rangeBar = "█".repeat(Math.round(s.range/3));
    console.log(
      `${s.label.padEnd(14)} ${pad(s.avg,5)} ${pad(s.min,4)} ${pad(s.max,4)} ${pad(s.range,6)} ${pad(s.std,5)} ${pad(s.p5,4)} ${pad(s.p95,4)}  ${rangeBar}`
    );
  }

  // ── 출력 3: 배지 분포 ─────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("출력 3: 배지 구간 분포 (전체 900건)");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const b75p = allScores.filter(v => v >= 75).length;
  const b6574 = allScores.filter(v => v >= 65 && v < 75).length;
  const b5564 = allScores.filter(v => v >= 55 && v < 65).length;
  const b54m  = allScores.filter(v => v < 55).length;

  const badgeRows: [string, number][] = [
    ["75+ (아주 좋은 날)",  b75p],
    ["65~74 (좋은 날)",     b6574],
    ["55~64 (보통)",        b5564],
    ["54이하 (힘든 날)",    b54m],
  ];
  for (const [label, cnt] of badgeRows) {
    const pctStr = pct2str(cnt, total);
    const bar    = "█".repeat(Math.round(cnt/total*40));
    console.log(`  ${label.padEnd(20)} ${pctStr.padStart(5)}  (${cnt}건)  ${bar}`);
  }

  // 프로필별 배지 분포
  console.log("\n  프로필별 배지 분포:");
  console.log(`  ${"".padEnd(14)} ${"75+".padStart(6)} ${"65~74".padStart(7)} ${"55~64".padStart(7)} ${"54↓".padStart(6)}`);
  console.log("  " + "─".repeat(46));
  for (let pi = 0; pi < PROFILES.length; pi++) {
    const s = perProfile[pi];
    const n = s.length;
    const p75 = pct2str(s.filter(v=>v>=75).length, n);
    const p65 = pct2str(s.filter(v=>v>=65&&v<75).length, n);
    const p55 = pct2str(s.filter(v=>v>=55&&v<65).length, n);
    const p54 = pct2str(s.filter(v=>v<55).length, n);
    console.log(`  ${PROFILES[pi].label.padEnd(14)} ${p75.padStart(6)} ${p65.padStart(7)} ${p55.padStart(7)} ${p54.padStart(6)}`);
  }

  // ── 출력 4: 극단값 분석 ───────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("출력 4: 극단값 분석 (상위 10 / 하위 10)");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const sortedRecords = [...records].sort((a,b) => b.score - a.score);

  console.log("  상위 10개:");
  console.log(`  ${"순위".padEnd(4)} ${"점수".padStart(4)}  ${"날짜".padEnd(12)} 프로필`);
  console.log("  " + "─".repeat(40));
  for (const [i, r] of sortedRecords.slice(0,10).entries()) {
    console.log(`  ${String(i+1).padEnd(4)} ${pad(r.score,4)}  ${r.date.padEnd(12)} ${r.profile}`);
  }

  console.log("\n  하위 10개:");
  console.log(`  ${"순위".padEnd(4)} ${"점수".padStart(4)}  ${"날짜".padEnd(12)} 프로필`);
  console.log("  " + "─".repeat(40));
  for (const [i, r] of sortedRecords.slice(-10).reverse().entries()) {
    console.log(`  ${String(i+1).padEnd(4)} ${pad(r.score,4)}  ${r.date.padEnd(12)} ${r.profile}`);
  }

  // ── 출력 5: 압축 여부 분석 ────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("출력 5: 점수 압축 여부 분석");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const cnt90p   = allScores.filter(v => v >= 90).length;
  const cnt40s   = allScores.filter(v => v >= 40 && v < 50).length;
  const cnt5075  = allScores.filter(v => v >= 50 && v <= 75).length;
  const freqPeak = allScores.filter(v => v >= 55 && v <= 70).length;

  console.log(`  1. 90점 이상 존재 여부`);
  console.log(`     → ${cnt90p}건 / 900건  (${pct2str(cnt90p,total)})`);
  console.log(`     판정: ${cnt90p > 0 ? "✅ 존재함" : "❌ 90점 이상 없음"}`);

  console.log(`\n  2. 40점대 존재 여부`);
  console.log(`     → ${cnt40s}건 / 900건  (${pct2str(cnt40s,total)})`);
  console.log(`     판정: ${cnt40s > 0 ? "✅ 존재함" : "❌ 40점대 없음"}`);

  console.log(`\n  3. p5~p95 범위 (목표: 35점 이상)`);
  console.log(`     → ${stats.p5} ~ ${stats.p95}  범위 ${p5p95span}점`);
  console.log(`     판정: ${p5p95span >= 35 ? "✅ 충분" : p5p95span >= 25 ? "⚠ 보통" : "❌ 협소"}`);

  const compRatio = r2(freqPeak / total * 100);
  console.log(`\n  4. 50~75 구간 과집중 여부`);
  console.log(`     50~75 구간 비율: ${pct2str(cnt5075,total)}  (${cnt5075}건)`);
  console.log(`     55~70 핵심 구간: ${compRatio}%  (${freqPeak}건)`);
  console.log(`     판정: ${compRatio > 60 ? "⚠ 55~70에 과집중" : compRatio > 45 ? "◇ 다소 집중" : "✅ 적절한 분산"}`);

  const highDay  = allScores.filter(v => v >= 75).length;
  const lowDay   = allScores.filter(v => v < 50).length;
  const sepRatio = r2((highDay + lowDay) / total * 100);
  console.log(`\n  5. 좋은 날 / 나쁜 날 체감 구분`);
  console.log(`     75+ (좋음)  : ${pct2str(highDay,total)}`);
  console.log(`     50미만 (힘듦): ${pct2str(lowDay,total)}`);
  console.log(`     극단값 합계 : ${sepRatio}%`);
  console.log(`     판정: ${sepRatio >= 20 ? "✅ 체감 가능" : sepRatio >= 10 ? "⚠ 약한 구분" : "❌ 체감 어려움"}`);

  // ── 최종 결론 ─────────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("최종 결론");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  // 판단 기준
  const healthy = p5p95span >= 35 && cnt90p > 0 && cnt40s > 0;
  const fullRange = stats.min <= 45 && stats.max >= 85;
  const expressive = r2(freqPeak/total*100) < 60;
  const compressionIssue = p5p95span < 30 || r2(freqPeak/total*100) > 65;
  const baselineOk = stats.avg >= 56 && stats.avg <= 64 && p5p95span >= 30;

  console.log(`  Q1. 현재 점수 스케일은 건강한가?`);
  console.log(`      min=${stats.min} / max=${stats.max} / avg=${stats.avg} / std=${stats.stddev}`);
  console.log(`      → ${healthy ? "✅ 건강함" : "⚠ 개선 필요"}`);

  console.log(`\n  Q2. 40~90 범위를 충분히 활용하는가?`);
  console.log(`      실제 범위: ${stats.min} ~ ${stats.max}  (이론 범위 40~90 = 50점)`);
  console.log(`      활용도: ${r2((stats.max-stats.min)/50*100)}%`);
  console.log(`      → ${fullRange ? "✅ 충분히 활용" : "⚠ 일부 구간 미활용"}`);

  console.log(`\n  Q3. 점수 표현력이 부족한가?`);
  console.log(`      p5~p95 = ${p5p95span}점  /  55~70 집중도 = ${compRatio}%`);
  console.log(`      → ${expressive ? "✅ 표현력 충분" : "⚠ 중간 구간 과집중으로 표현력 제한"}`);

  console.log(`\n  Q4. clamp/compression/stabilizer 수정이 baseline 보정보다 우선인가?`);
  console.log(`      → ${compressionIssue ? "⚠ 압축 문제 있음 — 구조 수정 우선 권장" : "✅ 현재 구조 수용 가능 — baseline 조정 진행 가능"}`);

  console.log(`\n  Q5. 현재 상태에서 평균 60 기준 baseline 조정을 적용해도 되는가?`);
  console.log(`      현재 전체 avg = ${stats.avg}  (목표 60)`);
  console.log(`      p5~p95 = ${p5p95span}점`);
  console.log(`      → ${baselineOk ? "✅ baseline 조정 적합한 상태" : `⚠ avg=${stats.avg} (목표 60 대비 ${r1(stats.avg-60)}점 오차) / p5~p95 ${p5p95span}점 먼저 확인 필요`}`);

  console.log("\n✅ 분석 완료");
}

main().catch(console.error);
