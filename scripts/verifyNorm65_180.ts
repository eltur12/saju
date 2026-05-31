/**
 * 점수 기준선 + 배지 기준 개편 실험 — 180일 검증
 * Usage: npx tsx scripts/verifyNorm65_180.ts
 *
 * 비교:
 *   A. DEFAULT      — 현재 engine 출력 그대로 (배지 기준: 기존 75/65/55)
 *   B. NORM_65      — displayScore = rawScore + clamp(65 - profileAvg, -6, +6)
 *                     배지 기준: 신규 80/70/51
 *
 * 엔진 원천 점수 건드리지 않음. 후처리 오프셋만 적용.
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
const N = PROFILES.length;

// 최근 180일
const END   = new Date(2026, 4, 31);
const START = new Date(END);
START.setDate(END.getDate() - 179);
const N_DAYS = 180;

// NORM_65 파라미터
const TARGET     = 65;
const MAX_OFFSET = 6;

// 배지 기준 (구/신)
function badgeOld(s: number) {
  if (s >= 75) return "대길";
  if (s >= 65) return "길";
  if (s >= 55) return "보통";
  return "주의";
}
function badgeNew(s: number) {
  if (s >= 80) return "아주좋음";
  if (s >= 70) return "좋음";
  if (s >= 51) return "보통";
  return "주의";
}

// ── 유틸 ─────────────────────────────────────────────────────────────────────
function r1(v: number) { return Math.round(v * 10) / 10; }
function avg(a: number[]) { return a.reduce((s,x)=>s+x,0)/a.length; }
function stdev(a: number[]) {
  const m = avg(a);
  return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/a.length);
}
function pct(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return Math.round(sorted[lo] + (sorted[hi]-sorted[lo])*(idx-lo));
}
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function pad(s: string|number, w: number) { return String(s).padStart(w); }
function pctStr(n: number, t: number) { return `${Math.round(n/t*100)}%`; }
function sign(v: number) { return v > 0 ? "+" : ""; }

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

interface PStats {
  avg: number; std: number; min: number; max: number; range: number;
  p5: number; p50: number; p95: number; p1: number; p99: number;
  b80p: number; b7079: number; b5169: number; b50m: number;
  // 구 기준 배지
  oldB75p: number; oldB6574: number; oldB5564: number; oldB54m: number;
  offset: number;
}
function calcStats(s: number[], offset = 0): PStats {
  const ss = [...s].sort((a,b)=>a-b);
  const n = s.length;
  return {
    avg: r1(avg(s)), std: r1(stdev(s)),
    min: ss[0], max: ss[n-1], range: ss[n-1]-ss[0],
    p1: pct(ss,1), p5: pct(ss,5), p50: pct(ss,50), p95: pct(ss,95), p99: pct(ss,99),
    // 신 배지 기준
    b80p:  Math.round(s.filter(v=>v>=80).length/n*100),
    b7079: Math.round(s.filter(v=>v>=70&&v<80).length/n*100),
    b5169: Math.round(s.filter(v=>v>=51&&v<70).length/n*100),
    b50m:  Math.round(s.filter(v=>v<=50).length/n*100),
    // 구 배지 기준
    oldB75p:  Math.round(s.filter(v=>v>=75).length/n*100),
    oldB6574: Math.round(s.filter(v=>v>=65&&v<75).length/n*100),
    oldB5564: Math.round(s.filter(v=>v>=55&&v<65).length/n*100),
    oldB54m:  Math.round(s.filter(v=>v<55).length/n*100),
    offset,
  };
}

async function main() {
  console.log("=== 점수 기준선 + 배지 기준 개편 실험 ===");
  console.log("A=DEFAULT  B=NORM_65 (target=65, maxOffset=±6)");
  console.log("배지 기준 신규: 80+ 아주좋음 / 70~79 좋음 / 51~69 보통 / ≤50 주의");
  console.log(`기간: ${N_DAYS}일 (10명 × ${N_DAYS}일 = ${N*N_DAYS}건)\n`);

  console.log("프로필 빌드 중...");
  const pds = await Promise.all(PROFILES.map(buildProfile));
  console.log("완료\n");

  // ── raw 점수 수집 ─────────────────────────────────────────────────────────
  const rawSeries: number[][] = [];
  for (const pd of pds) {
    const agg = new FortuneAggregator(
      pd.sajuProfile, pd.ziweiProfile, pd.astroProfile,
      undefined, pd.birthDate, true,
    );
    const scores: number[] = [];
    for (let i = 0; i < N_DAYS; i++) {
      const d = new Date(START);
      d.setDate(START.getDate() + i);
      const f: DailyFortune = agg.getDailyFortune(d, DEFAULT_ZIWEI_FLAGS, DEFAULT_SAJU_FLAGS);
      scores.push(f.scores.overall);
    }
    rawSeries.push(scores);
  }

  // ── NORM_65 오프셋 계산 ──────────────────────────────────────────────────
  const offsets = rawSeries.map(s => {
    const pa = avg(s);
    return r1(clamp(TARGET - pa, -MAX_OFFSET, MAX_OFFSET));
  });
  const normSeries = rawSeries.map((s,i) =>
    s.map(v => Math.round(clamp(v + offsets[i], 0, 100)))
  );

  const defAll  = rawSeries.flat();
  const normAll = normSeries.flat();
  const T = defAll.length; // 1800

  const defPStats  = rawSeries.map(s  => calcStats(s));
  const normPStats = normSeries.map((s,i) => calcStats(s, offsets[i]));

  // ── 오프셋 테이블 ──────────────────────────────────────────────────────────
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log("적용 오프셋");
  console.log("══════════════════════════════════════════════════════════════════════\n");
  console.log(`${"".padEnd(14)} ${"rawAvg".padStart(8)} ${"offset".padStart(8)}  방향`);
  console.log("─".repeat(40));
  for (let i = 0; i < N; i++) {
    const o = offsets[i];
    const bar = o > 0 ? "▲".repeat(Math.round(o)) : o < 0 ? "▼".repeat(Math.round(-o)) : "─";
    console.log(`${PROFILES[i].label.padEnd(14)} ${pad(r1(avg(rawSeries[i])),8)} ${`${sign(o)}${o}`.padStart(8)}  ${bar}`);
  }

  // ── 출력 1: 전체 분포 ──────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log(`출력 1: 전체 분포 (${T}건)`);
  console.log("══════════════════════════════════════════════════════════════════════\n");

  function gstats(a: number[]) {
    const ss = [...a].sort((a,b)=>a-b);
    return {
      avg: r1(avg(a)), std: r1(stdev(a)),
      min: ss[0], max: ss[ss.length-1],
      p1: pct(ss,1), p5: pct(ss,5), p50: pct(ss,50), p95: pct(ss,95), p99: pct(ss,99),
    };
  }
  const gd = gstats(defAll), gn = gstats(normAll);

  const gKeys = ["avg","std","min","p1","p5","p50","p95","p99","max"] as const;
  console.log(`${"".padEnd(8)} ${"DEFAULT".padStart(9)} ${"NORM_65".padStart(9)} ${"변화".padStart(7)}`);
  console.log("─".repeat(38));
  for (const k of gKeys) {
    const d = gd[k], n = gn[k];
    const delta = r1((n as number)-(d as number));
    console.log(`${k.padEnd(8)} ${pad(d,9)} ${pad(n,9)} ${`${sign(delta)}${delta}`.padStart(7)}`);
  }
  const defSpan  = gd.p95-gd.p5, normSpan = gn.p95-gn.p5;
  const defIS  = r1(stdev(defPStats.map(s=>s.avg)));
  const normIS = r1(stdev(normPStats.map(s=>s.avg)));
  console.log(`\n  p5~p95 범위: DEFAULT=${defSpan}  NORM_65=${normSpan}  변화=${sign(normSpan-defSpan)}${normSpan-defSpan}`);
  console.log(`  inter-user std: DEFAULT=${defIS}  NORM_65=${normIS}  변화=${sign(r1(normIS-defIS))}${r1(normIS-defIS)}`);

  // ── 출력 2: 프로필별 분포 ─────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("출력 2: 프로필별 분포");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log(`${"".padEnd(14)} ${"D avg".padStart(6)} ${"N avg".padStart(6)} ${"D std".padStart(6)} ${"N std".padStart(6)} ${"D rng".padStart(6)} ${"N rng".padStart(6)} ${"D p5-95".padStart(8)} ${"N p5-95".padStart(8)}  63~67✓`);
  console.log("─".repeat(88));
  for (let i = 0; i < N; i++) {
    const d = defPStats[i], n = normPStats[i];
    const inRangeD = d.avg >= 63 && d.avg <= 67 ? "✓" : " ";
    const inRangeN = n.avg >= 63 && n.avg <= 67 ? "✓" : " ";
    console.log(
      `${PROFILES[i].label.padEnd(14)} ${pad(d.avg,6)} ${pad(n.avg,6)} ` +
      `${pad(d.std,6)} ${pad(n.std,6)} ` +
      `${pad(d.range,6)} ${pad(n.range,6)} ` +
      `${`${d.p5}-${d.p95}`.padStart(8)} ${`${n.p5}-${n.p95}`.padStart(8)}  ${inRangeD}→${inRangeN}`
    );
  }
  const defInRange  = defPStats.filter(s=>s.avg>=63&&s.avg<=67).length;
  const normInRange = normPStats.filter(s=>s.avg>=63&&s.avg<=67).length;
  console.log(`\n  63~67 범위 수렴: DEFAULT=${defInRange}/${N}  NORM_65=${normInRange}/${N}`);

  // ── 출력 3: 신 배지 분포 ──────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("출력 3: 신 배지 분포 (80+/70~79/51~69/≤50)");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const nb80  = normAll.filter(v=>v>=80).length;
  const nb7079= normAll.filter(v=>v>=70&&v<80).length;
  const nb5169= normAll.filter(v=>v>=51&&v<70).length;
  const nb50m = normAll.filter(v=>v<=50).length;
  const db80  = defAll.filter(v=>v>=80).length;
  const db7079= defAll.filter(v=>v>=70&&v<80).length;
  const db5169= defAll.filter(v=>v>=51&&v<70).length;
  const db50m = defAll.filter(v=>v<=50).length;

  console.log(`${"".padEnd(26)} ${"DEFAULT".padStart(9)} ${"NORM_65".padStart(9)}`);
  console.log("─".repeat(46));
  for (const [label, dv, nv] of [
    ["80+ (아주 좋음)",  db80,   nb80],
    ["70~79 (좋음)",     db7079, nb7079],
    ["51~69 (보통)",     db5169, nb5169],
    ["50이하 (주의)",    db50m,  nb50m],
  ] as [string,number,number][]) {
    const dBar = "█".repeat(Math.round(dv/T*40));
    const nBar = "░".repeat(Math.round(nv/T*40));
    console.log(`  ${label.padEnd(24)} ${pctStr(dv,T).padStart(9)} ${pctStr(nv,T).padStart(9)}  D:${dBar}`);
    console.log(`  ${"".padEnd(24)} ${"".padStart(9)} ${"".padStart(9)}  N:${nBar}`);
  }

  // ── 출력 4: 구/신 배지 분포 비교 ─────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("출력 4: 구 기준(DEFAULT) vs 신 기준(NORM_65) 배지 분포 비교");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log("  [구 기준 75/65/55 — DEFAULT raw]");
  console.log(`  75+        ${pctStr(db80+db7079+defAll.filter(v=>v>=65&&v<75).length, T).padStart(6)}  ` +
    `(75+: ${pctStr(defAll.filter(v=>v>=75).length, T)}  65~74: ${pctStr(defAll.filter(v=>v>=65&&v<75).length, T)})`);
  console.log(`  55~74      ${pctStr(defAll.filter(v=>v>=55&&v<75).length, T).padStart(6)}`);
  console.log(`  54이하     ${pctStr(defAll.filter(v=>v<55).length, T).padStart(6)}`);

  console.log("\n  [신 기준 80/70/51 — NORM_65]");
  console.log(`  80+        ${pctStr(nb80, T).padStart(6)}  (${nb80}건)`);
  console.log(`  70~79      ${pctStr(nb7079, T).padStart(6)}  (${nb7079}건)`);
  console.log(`  51~69      ${pctStr(nb5169, T).padStart(6)}  (${nb5169}건)`);
  console.log(`  50이하     ${pctStr(nb50m, T).padStart(6)}  (${nb50m}건)`);

  // ── 출력 5: P06/P09 집중 ──────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("출력 5: P06 / P09 집중 분석 (63~66 목표)");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  for (const idx of [5, 8]) {
    const d = defPStats[idx], n = normPStats[idx];
    const p = PROFILES[idx];
    console.log(`  ${p.label}  offset=${sign(offsets[idx])}${offsets[idx]}`);
    for (const [k, dv, nv] of [
      ["avg",    d.avg,   n.avg],
      ["std",    d.std,   n.std],
      ["range",  d.range, n.range],
      ["p5",     d.p5,    n.p5],
      ["p95",    d.p95,   n.p95],
      ["50이하%", d.b50m,  n.b50m],
    ] as [string,number,number][]) {
      const delta = r1(nv-dv);
      const unit = k === "50이하%" ? "pp" : "";
      console.log(`    ${k.padEnd(10)} DEFAULT=${pad(dv,6)}  NORM_65=${pad(nv,6)}  ${sign(delta)}${delta}${unit}`);
    }
    console.log();
  }

  // ── 출력 6: 고평균 프로필 확인 ────────────────────────────────────────────
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log("출력 6: 고평균 프로필 확인 (P01/P04)");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  for (const idx of [0, 3]) {
    const d = defPStats[idx], n = normPStats[idx];
    console.log(`  ${PROFILES[idx].label}  offset=${sign(offsets[idx])}${offsets[idx]}`);
    console.log(`    avg:    DEFAULT=${d.avg} → NORM_65=${n.avg}  (${sign(r1(n.avg-d.avg))}${r1(n.avg-d.avg)})`);
    console.log(`    80+%:   DEFAULT=${d.oldB75p}% (구75+) → NORM_65=${n.b80p}% (신80+)`);
    console.log(`    70~79%: NORM_65=${n.b7079}%`);
    console.log(`    range:  ${d.range} → ${n.range}  std: ${d.std} → ${n.std}`);
    console.log();
  }

  // ── 출력 7: 90점대 존재 여부 ─────────────────────────────────────────────
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log("출력 7: 90점대 존재 여부 + 상위 20개");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const allRecords: Array<{score:number; pi:number}> = [];
  for (let i=0;i<N;i++) normSeries[i].forEach(s=>allRecords.push({score:s,pi:i}));
  const topRecords = [...allRecords].sort((a,b)=>b.score-a.score).slice(0,20);

  console.log(`  90+ 건수: DEFAULT=${defAll.filter(v=>v>=90).length}건  NORM_65=${normAll.filter(v=>v>=90).length}건`);
  console.log(`  80+ 건수: DEFAULT=${defAll.filter(v=>v>=80).length}건  NORM_65=${normAll.filter(v=>v>=80).length}건`);
  console.log();
  console.log("  NORM_65 상위 20개:");
  console.log(`  ${"순위".padEnd(5)} ${"점수".padStart(4)}  프로필`);
  console.log("  " + "─".repeat(30));
  topRecords.forEach((r,i)=>{
    console.log(`  ${String(i+1).padEnd(5)} ${pad(r.score,4)}  ${PROFILES[r.pi].label}`);
  });

  // ── 출력 8: 점수 표현력 ───────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("출력 8: 점수 표현력 분석");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const n6075 = normAll.filter(v=>v>=60&&v<=75).length;
  const compRatio = Math.round(n6075/T*100);

  console.log(`  1. 90점 이상: DEFAULT=${defAll.filter(v=>v>=90).length}건  NORM_65=${normAll.filter(v=>v>=90).length}건`);
  console.log(`  2. 40점대:   DEFAULT=${defAll.filter(v=>v>=40&&v<50).length}건  NORM_65=${normAll.filter(v=>v>=40&&v<50).length}건`);
  console.log(`  3. p5~p95:   DEFAULT=${defSpan}점  NORM_65=${normSpan}점`);
  console.log(`  4. 60~75 집중도: ${compRatio}%  (${n6075}건/${T}건)  ${compRatio>55?"⚠ 다소 집중":"✅ 적절"}`);
  console.log(`  5. min/max:  DEFAULT=${gd.min}~${gd.max}  NORM_65=${gn.min}~${gn.max}`);
  console.log(`  6. 80대:     DEFAULT=${defAll.filter(v=>v>=80&&v<90).length}건  NORM_65=${normAll.filter(v=>v>=80&&v<90).length}건`);

  // ── 프로필별 신 배지 분포 ─────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("프로필별 신 배지 분포 (NORM_65 기준)");
  console.log("══════════════════════════════════════════════════════════════════════\n");
  console.log(`${"".padEnd(14)}  ${"80+(아주좋음)".padStart(12)} ${"70~79(좋음)".padStart(12)} ${"51~69(보통)".padStart(12)} ${"≤50(주의)".padStart(10)}`);
  console.log("─".repeat(64));
  for (let i=0;i<N;i++) {
    const n = normPStats[i];
    console.log(
      `${PROFILES[i].label.padEnd(14)}  ` +
      `${pad(n.b80p+"%",12)} ${pad(n.b7079+"%",12)} ${pad(n.b5169+"%",12)} ${pad(n.b50m+"%",10)}`
    );
  }

  // ── 종합 요약 ─────────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("종합 요약");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const checks = [
    ["전체 평균 63~67",      gd.avg>=63&&gd.avg<=67,  gn.avg>=63&&gn.avg<=67,  `${gd.avg} → ${gn.avg}`],
    ["inter-user std 감소", true,                       normIS < defIS,          `${defIS} → ${normIS}`],
    ["63~67 수렴 ≥7",        defInRange >= 7,           normInRange >= 7,         `${defInRange} → ${normInRange}`],
    ["std ≥8 유지",          gd.std >= 8,               gn.std >= 8,             `${gd.std} → ${gn.std}`],
    ["p5~p95 ≥28점",        defSpan >= 28,              normSpan >= 28,           `${defSpan} → ${normSpan}`],
    ["80+ 5%이상",           defAll.filter(v=>v>=80).length/T>=0.05, normAll.filter(v=>v>=80).length/T>=0.05, `${pctStr(defAll.filter(v=>v>=80).length,T)} → ${pctStr(normAll.filter(v=>v>=80).length,T)}`],
    ["50이하 15%이하",        defAll.filter(v=>v<=50).length/T<=0.15, normAll.filter(v=>v<=50).length/T<=0.15, `${pctStr(defAll.filter(v=>v<=50).length,T)} → ${pctStr(normAll.filter(v=>v<=50).length,T)}`],
    ["P06 50이하 <30%",      defPStats[5].b50m < 30,    normPStats[5].b50m < 30,  `${defPStats[5].b50m}% → ${normPStats[5].b50m}%`],
  ] as [string, boolean, boolean, string][];

  console.log(`${"항목".padEnd(26)} ${"DEFAULT".padStart(9)} ${"NORM_65".padStart(9)}  수치`);
  console.log("─".repeat(70));
  for (const [label, dOk, nOk, vals] of checks) {
    console.log(`${label.padEnd(26)} ${(dOk?"✅":"❌").padStart(9)} ${(nOk?"✅":"❌").padStart(9)}  ${vals}`);
  }
  const scoreD = checks.filter(c=>c[1]).length;
  const scoreN = checks.filter(c=>c[2]).length;
  console.log(`\n  통과: DEFAULT=${scoreD}/${checks.length}  NORM_65=${scoreN}/${checks.length}`);

  console.log("\n✅ 분석 완료");
}

main().catch(console.error);
