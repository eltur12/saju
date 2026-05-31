/**
 * 개인 기준선 정규화 실험
 * Usage: npx tsx scripts/verifyNormalized60.ts
 *
 * 비교:
 *   A. DEFAULT        — 현재 profileBaselineLayer 그대로
 *   B. NORMALIZED_60  — offset = clamp(60 - profileAvg90, -6, +6)
 *   C. NORM_SOFT      — offset = clamp((60 - profileAvg90) * 0.75, -6, +6)
 *
 * raw 점수(DEFAULT engine 출력)는 건드리지 않음.
 * 표시 점수만 offset 후처리.
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

const END   = new Date(2026, 4, 30);
const START = new Date(END);
START.setDate(END.getDate() - 89);
const N_DAYS    = 90;
const TARGET    = 60;
const MAX_OFFSET = 6;

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

// ── 빌드 ─────────────────────────────────────────────────────────────────────
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

// ── 오프셋 적용 ───────────────────────────────────────────────────────────────
function applyOffset(raw: number[], strength: number): number[] {
  const profileAvg = avg(raw);
  const offset = clamp((TARGET - profileAvg) * strength, -MAX_OFFSET, MAX_OFFSET);
  return raw.map(v => Math.round(clamp(v + offset, 0, 100)));
}

// ── 통계 ─────────────────────────────────────────────────────────────────────
interface Stats {
  avg: number; std: number; min: number; max: number;
  p5: number; p50: number; p95: number;
  b75p: number; b6574: number; b5564: number; b54m: number;
  range: number; offset: number;
}
function calcStats(s: number[], offset = 0): Stats {
  const ss = [...s].sort((a,b)=>a-b);
  return {
    avg:   r1(avg(s)), std: r1(stdev(s)),
    min:   ss[0], max: ss[ss.length-1], range: ss[ss.length-1]-ss[0],
    p5:    pct(ss,5), p50: pct(ss,50), p95: pct(ss,95),
    b75p:  Math.round(s.filter(v=>v>=75).length/s.length*100),
    b6574: Math.round(s.filter(v=>v>=65&&v<75).length/s.length*100),
    b5564: Math.round(s.filter(v=>v>=55&&v<65).length/s.length*100),
    b54m:  Math.round(s.filter(v=>v<55).length/s.length*100),
    offset,
  };
}

async function main() {
  console.log("=== 개인 기준선 정규화 실험 ===");
  console.log("A=DEFAULT  B=NORMALIZED_60 (strength=1.0)  C=NORM_SOFT (strength=0.75)");
  console.log(`maxOffset=±${MAX_OFFSET}  target=${TARGET}  기간: 2026-03-02~2026-05-30 (90일)\n`);

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

  // ── 세 모드 계산 ──────────────────────────────────────────────────────────
  const normSeries:   number[][] = rawSeries.map(s => applyOffset(s, 1.0));
  const softSeries:   number[][] = rawSeries.map(s => applyOffset(s, 0.75));

  // 오프셋 값 기록
  const offsets = rawSeries.map((s, pi) => {
    const pa = avg(s);
    return {
      label:   PROFILES[pi].label,
      rawAvg:  r1(pa),
      offNorm: r1(clamp((TARGET - pa) * 1.0, -MAX_OFFSET, MAX_OFFSET)),
      offSoft: r1(clamp((TARGET - pa) * 0.75, -MAX_OFFSET, MAX_OFFSET)),
    };
  });

  // 통계 계산
  const defStats  = rawSeries.map((s,i)  => calcStats(s, 0));
  const normStats = normSeries.map((s,i) => calcStats(s, offsets[i].offNorm));
  const softStats = softSeries.map((s,i) => calcStats(s, offsets[i].offSoft));

  const defAll  = rawSeries.flat();
  const normAll = normSeries.flat();
  const softAll = softSeries.flat();

  // ── 출력: 적용 오프셋 ──────────────────────────────────────────────────────
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log("적용 오프셋 (rawAvg → offset)");
  console.log("══════════════════════════════════════════════════════════════════════\n");
  console.log(`${"".padEnd(14)} ${"rawAvg".padStart(8)} ${"B offset".padStart(10)} ${"C offset".padStart(10)}`);
  console.log("─".repeat(46));
  for (const o of offsets) {
    const bBar = o.offNorm >= 0 ? "▲".repeat(Math.round(o.offNorm)) : "▼".repeat(Math.round(-o.offNorm));
    const cBar = o.offSoft >= 0 ? "▲".repeat(Math.round(o.offSoft)) : "▼".repeat(Math.round(-o.offSoft));
    console.log(
      `${o.label.padEnd(14)} ${pad(o.rawAvg,8)} ` +
      `${`${sign(o.offNorm)}${o.offNorm}`.padStart(10)} ` +
      `${`${sign(o.offSoft)}${o.offSoft}`.padStart(10)}  ${bBar} / ${cBar}`
    );
  }

  // ── 출력 1: 전체 분포 ──────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("출력 1: 전체 분포 (900건)");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  function globalStats(a: number[]) {
    const ss = [...a].sort((a,b)=>a-b);
    return {
      avg: r1(avg(a)), std: r1(stdev(a)),
      min: ss[0], max: ss[ss.length-1],
      p5: pct(ss,5), p50: pct(ss,50), p95: pct(ss,95),
    };
  }
  const gDef  = globalStats(defAll);
  const gNorm = globalStats(normAll);
  const gSoft = globalStats(softAll);

  const gKeys = ["avg","std","min","max","p5","p50","p95"] as const;
  console.log(`${"".padEnd(8)} ${"DEFAULT".padStart(9)} ${"NORM_60".padStart(9)} ${"NORM_SOFT".padStart(10)}   ${"B변화".padStart(6)} ${"C변화".padStart(6)}`);
  console.log("─".repeat(54));
  for (const k of gKeys) {
    const d = gDef[k], b = gNorm[k], c = gSoft[k];
    const db = r1((b as number)-(d as number)), dc = r1((c as number)-(d as number));
    console.log(
      `${k.padEnd(8)} ${pad(d,9)} ${pad(b,9)} ${pad(c,10)}   ` +
      `${`${sign(db)}${db}`.padStart(6)} ${`${sign(dc)}${dc}`.padStart(6)}`
    );
  }
  const defSpan  = gDef.p95-gDef.p5;
  const normSpan = gNorm.p95-gNorm.p5;
  const softSpan = gSoft.p95-gSoft.p5;
  console.log(`\n  p5~p95 범위: DEFAULT=${defSpan}  NORM_60=${normSpan}  NORM_SOFT=${softSpan}`);

  const defIS  = r1(stdev(defStats.map(s=>s.avg)));
  const normIS = r1(stdev(normStats.map(s=>s.avg)));
  const softIS = r1(stdev(softStats.map(s=>s.avg)));
  console.log(`  inter-user std:  DEFAULT=${defIS}  NORM_60=${normIS}  NORM_SOFT=${softIS}`);

  // ── 출력 2: 프로필별 분포 ─────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("출력 2: 프로필별 avg / std / range / p5 / p95");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log(`${"".padEnd(14)}  ${"── DEFAULT ──".padEnd(28)}  ${"── NORM_60 ──".padEnd(28)}  ${"── NORM_SOFT ──".padEnd(28)}`);
  console.log(`${"".padEnd(14)}  ${"avg".padStart(5)} ${"std".padStart(5)} ${"rng".padStart(4)} ${"p5-p95".padStart(8)}  ${"avg".padStart(5)} ${"std".padStart(5)} ${"rng".padStart(4)} ${"p5-p95".padStart(8)}  ${"avg".padStart(5)} ${"std".padStart(5)} ${"rng".padStart(4)} ${"p5-p95".padStart(8)}`);
  console.log("─".repeat(100));
  for (let i = 0; i < N; i++) {
    const d = defStats[i], b = normStats[i], c = softStats[i];
    const inRangeD = d.avg >= 58 && d.avg <= 62 ? "✓" : " ";
    const inRangeB = b.avg >= 58 && b.avg <= 62 ? "✓" : " ";
    const inRangeC = c.avg >= 58 && c.avg <= 62 ? "✓" : " ";
    console.log(
      `${PROFILES[i].label.padEnd(14)}  ` +
      `${pad(d.avg,5)} ${pad(d.std,5)} ${pad(d.range,4)} ${`${d.p5}-${d.p95}`.padStart(8)}${inRangeD}  ` +
      `${pad(b.avg,5)} ${pad(b.std,5)} ${pad(b.range,4)} ${`${b.p5}-${b.p95}`.padStart(8)}${inRangeB}  ` +
      `${pad(c.avg,5)} ${pad(c.std,5)} ${pad(c.range,4)} ${`${c.p5}-${c.p95}`.padStart(8)}${inRangeC}`
    );
  }
  // 58~62 수렴 카운트
  const defCnt  = defStats.filter(s=>s.avg>=58&&s.avg<=62).length;
  const normCnt = normStats.filter(s=>s.avg>=58&&s.avg<=62).length;
  const softCnt = softStats.filter(s=>s.avg>=58&&s.avg<=62).length;
  console.log(`\n  58~62 범위 내: DEFAULT=${defCnt}/${N}  NORM_60=${normCnt}/${N}  NORM_SOFT=${softCnt}/${N}`);

  // ── 출력 3: 배지 분포 ─────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("출력 3: 배지 분포 (전체 900건)");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  function badgeDist(a: number[], t: number) {
    return {
      b75p:  pctStr(a.filter(v=>v>=75).length, t),
      b6574: pctStr(a.filter(v=>v>=65&&v<75).length, t),
      b5564: pctStr(a.filter(v=>v>=55&&v<65).length, t),
      b54m:  pctStr(a.filter(v=>v<55).length, t),
      b40s:  a.filter(v=>v>=40&&v<50).length,
      b80p:  a.filter(v=>v>=80).length,
      b90p:  a.filter(v=>v>=90).length,
    };
  }
  const T = defAll.length;
  const dB = badgeDist(defAll, T), bB = badgeDist(normAll, T), cB = badgeDist(softAll, T);

  console.log(`${"".padEnd(22)} ${"DEFAULT".padStart(9)} ${"NORM_60".padStart(9)} ${"NORM_SOFT".padStart(10)}`);
  console.log("─".repeat(54));
  for (const [label, dk, bk, ck] of [
    ["75+ (아주 좋은 날)",  dB.b75p, bB.b75p, cB.b75p],
    ["65~74 (좋은 날)",    dB.b6574, bB.b6574, cB.b6574],
    ["55~64 (보통)",       dB.b5564, bB.b5564, cB.b5564],
    ["54이하 (힘든 날)",   dB.b54m, bB.b54m, cB.b54m],
  ] as [string, string, string, string][]) {
    console.log(`  ${label.padEnd(20)} ${dk.padStart(9)} ${bk.padStart(9)} ${ck.padStart(10)}`);
  }
  console.log(`\n  극단값 (건수):`);
  console.log(`  ${"".padEnd(14)} ${"DEFAULT".padStart(9)} ${"NORM_60".padStart(9)} ${"NORM_SOFT".padStart(10)}`);
  console.log(`  ${"40~49점".padEnd(14)} ${pad(dB.b40s,9)} ${pad(bB.b40s,9)} ${pad(cB.b40s,10)}`);
  console.log(`  ${"80점 이상".padEnd(14)} ${pad(dB.b80p,9)} ${pad(bB.b80p,9)} ${pad(cB.b80p,10)}`);
  console.log(`  ${"90점 이상".padEnd(14)} ${pad(dB.b90p,9)} ${pad(bB.b90p,9)} ${pad(cB.b90p,10)}`);

  // ── 출력 4: P06 / P09 집중 ────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("출력 4: P06 / P09 집중 분석");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  for (const idx of [5, 8]) { // P06=5, P09=8
    const d = defStats[idx], b = normStats[idx], c = softStats[idx];
    const p = PROFILES[idx];
    console.log(`  ${p.label}  (rawAvg=${offsets[idx].rawAvg}  B offset=${sign(offsets[idx].offNorm)}${offsets[idx].offNorm}  C offset=${sign(offsets[idx].offSoft)}${offsets[idx].offSoft})`);
    console.log(`  ${"".padEnd(10)} ${"DEFAULT".padStart(9)} ${"NORM_60".padStart(9)} ${"NORM_SOFT".padStart(10)}  ${"B변화".padStart(6)} ${"C변화".padStart(6)}`);
    console.log("  " + "─".repeat(58));
    for (const [k, dv, bv, cv] of [
      ["avg",   d.avg,   b.avg,   c.avg],
      ["std",   d.std,   b.std,   c.std],
      ["range", d.range, b.range, c.range],
      ["p5",    d.p5,    b.p5,    c.p5],
      ["p95",   d.p95,   b.p95,   c.p95],
      ["54이하%", d.b54m,  b.b54m,  c.b54m],
    ] as [string,number,number,number][]) {
      const db = r1(bv-dv), dc = r1(cv-dv);
      const unit = k === "54이하%" ? "pp" : "";
      console.log(
        `  ${k.padEnd(10)} ${pad(dv,9)} ${pad(bv,9)} ${pad(cv,10)}  ` +
        `${`${sign(db)}${db}${unit}`.padStart(6)} ${`${sign(dc)}${dc}${unit}`.padStart(6)}`
      );
    }
    console.log();
  }

  // ── 출력 5: 극단값 유지 확인 ─────────────────────────────────────────────
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log("출력 5: 극단값 유지 확인");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  // 전체 min/max
  const allModes = [
    { label: "DEFAULT",   raw: defAll },
    { label: "NORM_60",   raw: normAll },
    { label: "NORM_SOFT", raw: softAll },
  ];
  for (const m of allModes) {
    const ms = [...m.raw].sort((a,b)=>a-b);
    console.log(`  ${m.label.padEnd(12)} min=${ms[0]}  max=${ms[ms.length-1]}  ` +
      `40대=${m.raw.filter(v=>v>=40&&v<50).length}건  ` +
      `80대=${m.raw.filter(v=>v>=80&&v<90).length}건  ` +
      `90대=${m.raw.filter(v=>v>=90).length}건`
    );
  }

  // 프로필별 min/max 비교
  console.log("\n  프로필별 min/max 비교:");
  console.log(`  ${"".padEnd(14)} ${"D:min-max".padStart(10)} ${"B:min-max".padStart(10)} ${"C:min-max".padStart(10)}`);
  console.log("  " + "─".repeat(48));
  for (let i = 0; i < N; i++) {
    const d = defStats[i], b = normStats[i], c = softStats[i];
    console.log(
      `  ${PROFILES[i].label.padEnd(14)} ` +
      `${`${d.min}-${d.max}`.padStart(10)} ` +
      `${`${b.min}-${b.max}`.padStart(10)} ` +
      `${`${c.min}-${c.max}`.padStart(10)}`
    );
  }

  // ── 종합 요약 & 판단 ─────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("종합 요약 & 판단 기준 대조");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  // 판단 항목
  const checks = [
    {
      item:  "전체 평균 58~62",
      def:   gDef.avg >= 58 && gDef.avg <= 62,
      norm:  gNorm.avg >= 58 && gNorm.avg <= 62,
      soft:  gSoft.avg >= 58 && gSoft.avg <= 62,
      vals:  [gDef.avg, gNorm.avg, gSoft.avg],
    },
    {
      item:  "inter-user std 감소",
      def:   true,
      norm:  normIS < defIS,
      soft:  softIS < defIS,
      vals:  [defIS, normIS, softIS],
    },
    {
      item:  `58~62 수렴 ≥7/${N}`,
      def:   defCnt >= 7,
      norm:  normCnt >= 7,
      soft:  softCnt >= 7,
      vals:  [defCnt, normCnt, softCnt],
    },
    {
      item:  "p5~p95 ≥28점",
      def:   defSpan >= 28,
      norm:  normSpan >= 28,
      soft:  softSpan >= 28,
      vals:  [defSpan, normSpan, softSpan],
    },
    {
      item:  "전체 std ≥8 (변동성 유지)",
      def:   gDef.std >= 8,
      norm:  gNorm.std >= 8,
      soft:  gSoft.std >= 8,
      vals:  [gDef.std, gNorm.std, gSoft.std],
    },
    {
      item:  "40대 존재 (극단 유지)",
      def:   dB.b40s > 0,
      norm:  bB.b40s > 0,
      soft:  cB.b40s > 0,
      vals:  [dB.b40s, bB.b40s, cB.b40s],
    },
    {
      item:  "80점 이상 존재",
      def:   dB.b80p > 0,
      norm:  bB.b80p > 0,
      soft:  cB.b80p > 0,
      vals:  [dB.b80p, bB.b80p, cB.b80p],
    },
    {
      item:  "P06 54이하 <40%",
      def:   defStats[5].b54m < 40,
      norm:  normStats[5].b54m < 40,
      soft:  softStats[5].b54m < 40,
      vals:  [defStats[5].b54m, normStats[5].b54m, softStats[5].b54m],
    },
  ];

  console.log(`${"판단 항목".padEnd(26)} ${"DEFAULT".padStart(9)} ${"NORM_60".padStart(9)} ${"NORM_SOFT".padStart(10)}`);
  console.log("─".repeat(58));
  for (const c of checks) {
    const fmt = (ok: boolean, v: number|string) => `${ok?"✅":"❌"} ${String(v).padStart(5)}`;
    console.log(
      `${c.item.padEnd(26)} ` +
      `${fmt(c.def,  c.vals[0])}.padEnd(9) ` +
      `${fmt(c.norm, c.vals[1])}.padEnd(9) ` +
      `${fmt(c.soft, c.vals[2])}`
    );
  }

  // 통과 점수
  const scoreD = checks.filter(c=>c.def).length;
  const scoreB = checks.filter(c=>c.norm).length;
  const scoreC = checks.filter(c=>c.soft).length;
  console.log(`\n  통과 항목: DEFAULT=${scoreD}/${checks.length}  NORM_60=${scoreB}/${checks.length}  NORM_SOFT=${scoreC}/${checks.length}`);

  console.log("\n  수치 요약:");
  console.log(`  ${"".padEnd(20)} ${"DEFAULT".padStart(9)} ${"NORM_60".padStart(9)} ${"NORM_SOFT".padStart(10)}`);
  console.log(`  ${"전체 avg".padEnd(20)} ${pad(gDef.avg,9)} ${pad(gNorm.avg,9)} ${pad(gSoft.avg,10)}`);
  console.log(`  ${"전체 std".padEnd(20)} ${pad(gDef.std,9)} ${pad(gNorm.std,9)} ${pad(gSoft.std,10)}`);
  console.log(`  ${"inter-user std".padEnd(20)} ${pad(defIS,9)} ${pad(normIS,9)} ${pad(softIS,10)}`);
  console.log(`  ${"p5~p95 범위".padEnd(20)} ${pad(defSpan,9)} ${pad(normSpan,9)} ${pad(softSpan,10)}`);
  console.log(`  ${"58~62 수렴".padEnd(20)} ${pad(defCnt+"/"+N,9)} ${pad(normCnt+"/"+N,9)} ${pad(softCnt+"/"+N,10)}`);
  console.log(`  ${"P06 54이하%".padEnd(20)} ${pad(defStats[5].b54m+"%",9)} ${pad(normStats[5].b54m+"%",9)} ${pad(softStats[5].b54m+"%",10)}`);
  console.log(`  ${"P09 54이하%".padEnd(20)} ${pad(defStats[8].b54m+"%",9)} ${pad(normStats[8].b54m+"%",9)} ${pad(softStats[8].b54m+"%",10)}`);

  console.log("\n✅ 분석 완료");
}

main().catch(console.error);
