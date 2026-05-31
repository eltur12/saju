/**
 * NORM targetAvg 후보 비교 — NORM_65 / NORM_67 / NORM_70
 * Usage: npx tsx scripts/compareNormTargets.ts
 *
 * 대상: 30개 프로필 × 180일 = 5,400건 (후보별)
 * 출력: 채팅에는 요약만, 상세는 scripts/output/ 에 파일로 저장
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { calculateSajuProfile } from "../src/utils/sajuCalculator";
import { buildZiweiProfile }    from "../src/utils/ziweiCalculator";
import { buildAstroProfile }    from "../src/utils/astroCalculator";
import { FortuneAggregator }    from "../src/engines/aggregator";
import { DEFAULT_ZIWEI_FLAGS }  from "../src/engines/ziweiEngine";
import { DEFAULT_SAJU_FLAGS }   from "../src/engines/sajuEngine";
import type { DailyFortune }    from "../src/engines/aggregator";

// ── 30개 프로필 ───────────────────────────────────────────────────────────────
const PROFILES = [
  { id:1,  label:"P01 (1958M 寅月)", birth:{year:1958,month:1, day:15,hour:6 }, gender:"M" as const },
  { id:2,  label:"P02 (1961F 卯月)", birth:{year:1961,month:3, day:22,hour:14}, gender:"F" as const },
  { id:3,  label:"P03 (1965M 午月)", birth:{year:1965,month:6, day:8, hour:22}, gender:"M" as const },
  { id:4,  label:"P04 (1968F 酉月)", birth:{year:1968,month:9, day:14,hour:3 }, gender:"F" as const },
  { id:5,  label:"P05 (1972M 亥月)", birth:{year:1972,month:11,day:30,hour:10}, gender:"M" as const },
  { id:6,  label:"P06 (1975F 寅月)", birth:{year:1975,month:2, day:17,hour:18}, gender:"F" as const },
  { id:7,  label:"P07 (1978M 未月)", birth:{year:1978,month:7, day:4, hour:0 }, gender:"M" as const },
  { id:8,  label:"P08 (1981F 辰月)", birth:{year:1981,month:4, day:25,hour:8 }, gender:"F" as const },
  { id:9,  label:"P09 (1984M 子月)", birth:{year:1984,month:12,day:11,hour:16}, gender:"M" as const },
  { id:10, label:"P10 (1987F 巳月)", birth:{year:1987,month:5, day:19,hour:2 }, gender:"F" as const },
  { id:11, label:"P11 (1990M 申月)", birth:{year:1990,month:8, day:7, hour:20}, gender:"M" as const },
  { id:12, label:"P12 (1993F 丑月)", birth:{year:1993,month:1, day:23,hour:12}, gender:"F" as const },
  { id:13, label:"P13 (1996M 戌月)", birth:{year:1996,month:10,day:15,hour:4 }, gender:"M" as const },
  { id:14, label:"P14 (1999F 卯月)", birth:{year:1999,month:3, day:9, hour:22}, gender:"F" as const },
  { id:15, label:"P15 (2002M 未月)", birth:{year:2002,month:7, day:28,hour:14}, gender:"M" as const },
  { id:16, label:"P16 (2005F 亥月)", birth:{year:2005,month:11,day:1, hour:6 }, gender:"F" as const },
  { id:17, label:"P17 (1960M 辰月)", birth:{year:1960,month:4, day:16,hour:9 }, gender:"M" as const },
  { id:18, label:"P18 (1967F 申月)", birth:{year:1967,month:8, day:22,hour:17}, gender:"F" as const },
  { id:19, label:"P19 (1974M 子月)", birth:{year:1974,month:12,day:5, hour:23}, gender:"M" as const },
  { id:20, label:"P20 (1980F 寅月)", birth:{year:1980,month:2, day:28,hour:11}, gender:"F" as const },
  { id:21, label:"P21 (1985M 酉月)", birth:{year:1985,month:9, day:13,hour:7 }, gender:"M" as const },
  { id:22, label:"P22 (1991F 午月)", birth:{year:1991,month:6, day:19,hour:15}, gender:"F" as const },
  { id:23, label:"P23 (1997M 卯月)", birth:{year:1997,month:4, day:3, hour:1 }, gender:"M" as const },
  { id:24, label:"P24 (2000F 丑月)", birth:{year:2000,month:1, day:20,hour:19}, gender:"F" as const },
  { id:25, label:"P25 (1963M 戌月)", birth:{year:1963,month:10,day:31,hour:13}, gender:"M" as const },
  { id:26, label:"P26 (1971F 巳月)", birth:{year:1971,month:5, day:8, hour:5 }, gender:"F" as const },
  { id:27, label:"P27 (1979M 未月)", birth:{year:1979,month:7, day:16,hour:21}, gender:"M" as const },
  { id:28, label:"P28 (1988F 亥月)", birth:{year:1988,month:11,day:4, hour:9 }, gender:"F" as const },
  { id:29, label:"P29 (1995M 卯月)", birth:{year:1995,month:3, day:26,hour:3 }, gender:"M" as const },
  { id:30, label:"P30 (2003F 申月)", birth:{year:2003,month:8, day:12,hour:17}, gender:"F" as const },
];
const N = PROFILES.length; // 30

const END    = new Date(2026, 4, 31);
const START  = new Date(END);
START.setDate(END.getDate() - 179);
const N_DAYS = 180;

const TARGETS    = [65, 67, 70] as const;
const MAX_OFFSET = 6;

// 배지 기준 (안 A: 55이하/56~69/70~79/80+)
function badge(s: number) {
  if (s >= 80) return "아주좋음";
  if (s >= 70) return "좋음";
  if (s >= 56) return "보통";
  return "주의";
}

// ── 유틸 ─────────────────────────────────────────────────────────────────────
function r1(v: number) { return Math.round(v * 10) / 10; }
function r2(v: number) { return Math.round(v * 100) / 100; }
function avgFn(a: number[]) { return a.reduce((s,x)=>s+x,0)/a.length; }
function stdevFn(a: number[]) {
  const m = avgFn(a);
  return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/a.length);
}
function pct(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return r1(sorted[lo] + (sorted[hi]-sorted[lo])*(idx-lo));
}
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function pad(s: string|number, w: number) { return String(s).padStart(w); }
function pctStr(n: number, t: number) { return `${Math.round(n/t*100)}%`; }
function sign(v: number) { return v > 0 ? "+" : ""; }
function dateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

async function buildProfile(p: typeof PROFILES[0]) {
  const b = p.birth;
  return {
    label:        p.label,
    sajuProfile:  calculateSajuProfile(b.year, b.month, b.day, b.hour, p.gender),
    ziweiProfile: buildZiweiProfile(b.year, b.month, b.day, b.hour, 2026, p.gender==="M"),
    astroProfile: await buildAstroProfile(b.year, b.month, b.day, b.hour),
    birthDate:    new Date(b.year, b.month-1, b.day),
  };
}

// ── 전체 통계 ─────────────────────────────────────────────────────────────────
interface GlobalStats {
  avg: number; std: number; min: number; max: number;
  p1: number; p5: number; p25: number; p50: number;
  p75: number; p95: number; p99: number;
  b80p: number; b7079: number; b5669: number; b55m: number;
  b90p: number; b40s: number; b80cnt: number; b55cnt: number;
}
function globalStats(scores: number[]): GlobalStats {
  const ss = [...scores].sort((a,b)=>a-b);
  const T = scores.length;
  return {
    avg: r1(avgFn(scores)), std: r1(stdevFn(scores)),
    min: ss[0], max: ss[T-1],
    p1: pct(ss,1), p5: pct(ss,5), p25: pct(ss,25),
    p50: pct(ss,50), p75: pct(ss,75), p95: pct(ss,95), p99: pct(ss,99),
    b80p:  Math.round(scores.filter(v=>v>=80).length/T*100),
    b7079: Math.round(scores.filter(v=>v>=70&&v<80).length/T*100),
    b5669: Math.round(scores.filter(v=>v>=56&&v<70).length/T*100),
    b55m:  Math.round(scores.filter(v=>v<=55).length/T*100),
    b90p:  scores.filter(v=>v>=90).length,
    b40s:  scores.filter(v=>v>=40&&v<50).length,
    b80cnt: scores.filter(v=>v>=80).length,
    b55cnt: scores.filter(v=>v<=55).length,
  };
}

// ── 프로필 통계 ───────────────────────────────────────────────────────────────
interface ProfileStats {
  label: string; avg: number; std: number;
  min: number; max: number; range: number;
  p5: number; p95: number; offset: number;
  b80p: number; b55m: number;
}
function profileStats(s: number[], label: string, offset: number): ProfileStats {
  const ss = [...s].sort((a,b)=>a-b);
  const n = s.length;
  return {
    label, offset,
    avg: r1(avgFn(s)), std: r1(stdevFn(s)),
    min: ss[0], max: ss[n-1], range: ss[n-1]-ss[0],
    p5: pct(ss,5), p95: pct(ss,95),
    b80p:  Math.round(s.filter(v=>v>=80).length/n*100),
    b55m:  Math.round(s.filter(v=>v<=55).length/n*100),
  };
}

async function main() {
  const OUT = path.join("scripts", "output");

  console.log("=== NORM targetAvg 후보 비교 ===");
  console.log("대상: 30개 프로필 × 180일 = 5,400건/후보");
  console.log("배지 기준 (안 A): 80+ / 70~79 / 56~69 / 55이하\n");

  // ── 1. 프로필 빌드 ─────────────────────────────────────────────────────────
  console.log(`프로필 빌드 중 (${N}명)...`);
  const pds = await Promise.all(PROFILES.map(buildProfile));
  console.log("완료. raw 점수 수집 중...\n");

  // ── 2. raw 점수 수집 ───────────────────────────────────────────────────────
  const rawSeries: number[][] = [];
  const dates: string[] = [];
  if (dates.length === 0) {
    for (let i=0;i<N_DAYS;i++){
      const d=new Date(START); d.setDate(START.getDate()+i); dates.push(dateStr(d));
    }
  }

  for (let pi=0; pi<N; pi++) {
    const pd = pds[pi];
    const agg = new FortuneAggregator(
      pd.sajuProfile, pd.ziweiProfile, pd.astroProfile,
      undefined, pd.birthDate, true,
    );
    const raw: number[] = [];
    for (let i=0; i<N_DAYS; i++) {
      const d = new Date(START); d.setDate(START.getDate()+i);
      const f: DailyFortune = agg.getDailyFortune(d, DEFAULT_ZIWEI_FLAGS, DEFAULT_SAJU_FLAGS);
      raw.push(f.scores.overall);
    }
    rawSeries.push(raw);
    if ((pi+1) % 10 === 0) console.log(`  ${pi+1}/${N} 완료`);
  }
  console.log("raw 수집 완료\n");

  // ── 3. 3후보 계산 ─────────────────────────────────────────────────────────
  const results = TARGETS.map(target => {
    const offsets = rawSeries.map(s => r1(clamp(target - avgFn(s), -MAX_OFFSET, MAX_OFFSET)));
    const normSeries = rawSeries.map((s,i) =>
      s.map(v => Math.round(clamp(v + offsets[i], 0, 100)))
    );
    const allScores = normSeries.flat();
    const gs = globalStats(allScores);
    const ps = normSeries.map((s,i) => profileStats(s, PROFILES[i].label, offsets[i]));
    return { target, offsets, normSeries, allScores, gs, ps };
  });

  // ── 4. CSV 저장 ────────────────────────────────────────────────────────────
  // 4a. 상세 점수 CSV (date, profile, raw, norm65, norm67, norm70)
  const csvHeader = ["date","profile","raw","norm65","norm67","norm70"].join(",");
  const csvRows: string[] = [csvHeader];
  for (let pi=0; pi<N; pi++) {
    for (let di=0; di<N_DAYS; di++) {
      csvRows.push([
        dates[di],
        PROFILES[pi].label,
        rawSeries[pi][di],
        results[0].normSeries[pi][di],
        results[1].normSeries[pi][di],
        results[2].normSeries[pi][di],
      ].join(","));
    }
  }
  fs.writeFileSync(path.join(OUT,"norm_detail.csv"), csvRows.join("\n"), "utf8");

  // 4b. 프로필별 요약 CSV
  const pCsvHeader = ["profile","rawAvg","off65","off67","off70",
    "avg65","avg67","avg70","std65","std67","std70",
    "range65","range67","range70"].join(",");
  const pCsvRows: string[] = [pCsvHeader];
  for (let pi=0; pi<N; pi++) {
    const raw = rawSeries[pi];
    pCsvRows.push([
      PROFILES[pi].label,
      r1(avgFn(raw)),
      results[0].offsets[pi], results[1].offsets[pi], results[2].offsets[pi],
      results[0].ps[pi].avg,  results[1].ps[pi].avg,  results[2].ps[pi].avg,
      results[0].ps[pi].std,  results[1].ps[pi].std,  results[2].ps[pi].std,
      results[0].ps[pi].range,results[1].ps[pi].range,results[2].ps[pi].range,
    ].join(","));
  }
  fs.writeFileSync(path.join(OUT,"norm_profile_summary.csv"), pCsvRows.join("\n"), "utf8");

  // ── 5. MD 상세 리포트 ─────────────────────────────────────────────────────
  const md: string[] = [];
  md.push("# NORM targetAvg 후보 비교 상세 리포트\n");
  md.push(`대상: ${N}개 프로필 × ${N_DAYS}일 = ${N*N_DAYS}건/후보  `);
  md.push(`배지 기준: 80+ / 70~79 / 56~69 / 55이하\n`);

  // 전체 분포
  md.push("## 1. 전체 분포\n");
  const distKeys: (keyof GlobalStats)[] = ["avg","std","min","p1","p5","p25","p50","p75","p95","p99","max"];
  md.push(`| 지표 | NORM_65 | NORM_67 | NORM_70 |`);
  md.push(`|------|---------|---------|---------|`);
  for (const k of distKeys) {
    md.push(`| ${k} | ${results[0].gs[k]} | ${results[1].gs[k]} | ${results[2].gs[k]} |`);
  }
  md.push("");

  // 배지 분포
  md.push("## 2. 배지 분포\n");
  md.push(`| 배지 | NORM_65 | NORM_67 | NORM_70 |`);
  md.push(`|------|---------|---------|---------|`);
  md.push(`| 80+ 아주좋음 | ${results[0].gs.b80p}% | ${results[1].gs.b80p}% | ${results[2].gs.b80p}% |`);
  md.push(`| 70~79 좋음 | ${results[0].gs.b7079}% | ${results[1].gs.b7079}% | ${results[2].gs.b7079}% |`);
  md.push(`| 56~69 보통 | ${results[0].gs.b5669}% | ${results[1].gs.b5669}% | ${results[2].gs.b5669}% |`);
  md.push(`| 55이하 주의 | ${results[0].gs.b55m}% | ${results[1].gs.b55m}% | ${results[2].gs.b55m}% |`);
  md.push("");

  // 프로필별 상세
  md.push("## 3. 프로필별 avg/std/range (3후보 비교)\n");
  md.push("| 프로필 | rawAvg | off65 | avg65 | off67 | avg67 | off70 | avg70 | std | range |");
  md.push("|--------|--------|-------|-------|-------|-------|-------|-------|-----|-------|");
  for (let pi=0; pi<N; pi++) {
    const raw = r1(avgFn(rawSeries[pi]));
    const [a,b,c] = results.map(r=>r.ps[pi]);
    md.push(`| ${PROFILES[pi].label} | ${raw} | ${sign(a.offset)}${a.offset} | ${a.avg} | ${sign(b.offset)}${b.offset} | ${b.avg} | ${sign(c.offset)}${c.offset} | ${c.avg} | ${a.std} | ${a.range} |`);
  }
  md.push("");

  fs.writeFileSync(path.join(OUT,"norm_report.md"), md.join("\n"), "utf8");

  // ── 6. 채팅 요약 출력 ─────────────────────────────────────────────────────
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log("요약 1: 전체 분포");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const gLabels: Array<[string, keyof GlobalStats]> = [
    ["avg",  "avg"],  ["std",  "std"],
    ["min",  "min"],  ["p5",   "p5"],
    ["p25",  "p25"],  ["p50",  "p50"],
    ["p75",  "p75"],  ["p95",  "p95"],
    ["max",  "max"],
  ];
  console.log(`${"".padEnd(8)} ${"NORM_65".padStart(9)} ${"NORM_67".padStart(9)} ${"NORM_70".padStart(9)}`);
  console.log("─".repeat(40));
  for (const [label, key] of gLabels) {
    const vals = results.map(r => r.gs[key]);
    console.log(`${label.padEnd(8)} ${vals.map(v=>pad(v,9)).join(" ")}`);
  }
  const spans = results.map(r => r.gs.p95 - r.gs.p5);
  console.log(`\n  p5~p95 범위: ${spans.map((s,i)=>`NORM_${TARGETS[i]}=${s}`).join("  ")}`);

  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("요약 2: 배지 분포");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log(`${"배지".padEnd(20)} ${"NORM_65".padStart(9)} ${"NORM_67".padStart(9)} ${"NORM_70".padStart(9)}`);
  console.log("─".repeat(50));
  for (const [label, k] of [
    ["80+ 아주좋음",  "b80p"],
    ["70~79 좋음",    "b7079"],
    ["56~69 보통",    "b5669"],
    ["55이하 주의",   "b55m"],
  ] as [string, keyof GlobalStats][]) {
    const vals = results.map(r => r.gs[k]);
    const bars = vals.map(v => "█".repeat(Math.round((v as number)/2)));
    console.log(`${label.padEnd(20)} ${vals.map(v=>pad(v+"%",9)).join(" ")}  ${bars.join(" / ")}`);
  }

  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("요약 3: 프로필 평균 분포");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  for (const res of results) {
    const avgs = res.ps.map(p=>p.avg);
    const ss = [...avgs].sort((a,b)=>a-b);
    const interStd = r1(stdevFn(avgs));
    const cnt6367 = avgs.filter(v=>v>=63&&v<=67).length;
    const cnt6569 = avgs.filter(v=>v>=65&&v<=69).length;
    const cnt6872 = avgs.filter(v=>v>=68&&v<=72).length;
    const cntLt60 = avgs.filter(v=>v<60).length;
    const cntGt72 = avgs.filter(v=>v>72).length;
    console.log(`  NORM_${res.target}:  inter-std=${interStd}  avg-range=[${ss[0]}~${ss[ss.length-1]}]`);
    console.log(`    63~67: ${cnt6367}명  65~69: ${cnt6569}명  68~72: ${cnt6872}명  <60: ${cntLt60}명  >72: ${cntGt72}명`);
  }

  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("요약 4: 변동성 유지");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log(`${"".padEnd(16)} ${"NORM_65".padStart(9)} ${"NORM_67".padStart(9)} ${"NORM_70".padStart(9)}`);
  console.log("─".repeat(48));
  for (const res of results) {
    // 비교를 위해 한 row씩 출력 안 하고 아래에서 통합
    void res;
  }
  const varRows: Array<[string, (r: typeof results[0])=>string|number]> = [
    ["range 평균",   r => r1(avgFn(r.ps.map(p=>p.range)))],
    ["range 최소",   r => Math.min(...r.ps.map(p=>p.range))],
    ["range 최대",   r => Math.max(...r.ps.map(p=>p.range))],
    ["std 평균",     r => r1(avgFn(r.ps.map(p=>p.std)))],
    ["std 최소",     r => Math.min(...r.ps.map(p=>p.std))],
    ["std 최대",     r => Math.max(...r.ps.map(p=>p.std))],
    ["range<25 수",  r => r.ps.filter(p=>p.range<25).length],
    ["std<5 수",     r => r.ps.filter(p=>p.std<5).length],
  ];
  for (const [label, fn] of varRows) {
    const vals = results.map(r => fn(r));
    console.log(`${label.padEnd(16)} ${vals.map(v=>pad(v,9)).join(" ")}`);
  }

  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("요약 5: 극단값");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log(`${"".padEnd(16)} ${"NORM_65".padStart(9)} ${"NORM_67".padStart(9)} ${"NORM_70".padStart(9)}`);
  console.log("─".repeat(48));
  for (const [label, k] of [
    ["90이상 건수", "b90p"], ["40대 건수", "b40s"],
    ["80이상 건수", "b80cnt"], ["55이하 건수", "b55cnt"],
  ] as [string, keyof GlobalStats][]) {
    const vals = results.map(r => r.gs[k]);
    console.log(`${label.padEnd(16)} ${vals.map(v=>pad(v,9)).join(" ")}`);
  }

  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("요약 6: 이상 프로필 탐지");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const anomalyChecks: Array<[string, (p: ProfileStats)=>boolean]> = [
    ["avg < 60",          p => p.avg < 60],
    ["avg > 72",          p => p.avg > 72],
    ["range < 25",        p => p.range < 25],
    ["std < 5",           p => p.std < 5],
    ["80+ 비율 > 20%",    p => p.b80p > 20],
    ["주의 비율 > 30%",   p => p.b55m > 30],
    ["주의 비율 < 3%",    p => p.b55m < 3],
  ];

  console.log(`${"조건".padEnd(20)} ${"NORM_65".padStart(9)} ${"NORM_67".padStart(9)} ${"NORM_70".padStart(9)}`);
  console.log("─".repeat(52));
  for (const [label, fn] of anomalyChecks) {
    const counts = results.map(r => r.ps.filter(fn).length);
    const flags  = counts.map(c => c > 0 ? `⚠${c}명` : "✅");
    console.log(`${label.padEnd(20)} ${flags.map(f=>f.padStart(9)).join(" ")}`);
  }

  // 이상 프로필 목록 (NORM_67 기준)
  console.log("\n  NORM_67 이상 프로필 상세:");
  const r67 = results[1];
  for (const [label, fn] of anomalyChecks) {
    const flagged = r67.ps.filter(fn);
    if (flagged.length > 0) {
      console.log(`    ${label}: ${flagged.map(p=>p.label).join(", ")}`);
    }
  }

  // ── 7. 판단 기준 종합 ─────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("요약 7: 판단 기준 체크");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const T = N * N_DAYS;
  const checks: Array<[string, (r: typeof results[0])=>boolean]> = [
    ["보통이 과도하지 않음 (≤60%)",  r => r.gs.b5669 <= 60],
    ["좋음이 흔하지 않음 (≤30%)",   r => r.gs.b7079 <= 30],
    ["주의가 사라지지 않음 (≥5%)",  r => r.gs.b55m >= 5],
    ["아주좋음 희소하지만 존재 (5~15%)", r => r.gs.b80p >= 5 && r.gs.b80p <= 15],
    ["inter-user std ≤ 2",          r => r1(stdevFn(r.ps.map(p=>p.avg))) <= 2],
    ["range 평균 ≥ 28",             r => r1(avgFn(r.ps.map(p=>p.range))) >= 28],
    ["std 평균 ≥ 7",                r => r1(avgFn(r.ps.map(p=>p.std))) >= 7],
    ["avg < 60 프로필 없음",         r => r.ps.filter(p=>p.avg<60).length === 0],
    ["avg > 72 프로필 ≤ 5",         r => r.ps.filter(p=>p.avg>72).length <= 5],
    ["90이상 존재",                  r => r.gs.b90p > 0],
  ];

  console.log(`${"판단 항목".padEnd(28)} ${"NORM_65".padStart(9)} ${"NORM_67".padStart(9)} ${"NORM_70".padStart(9)}`);
  console.log("─".repeat(58));
  for (const [label, fn] of checks) {
    const vals = results.map(r => fn(r) ? "✅" : "❌");
    console.log(`${label.padEnd(28)} ${vals.map(v=>v.padStart(9)).join(" ")}`);
  }
  const scores = results.map(r => checks.filter(([,fn])=>fn(r)).length);
  console.log(`\n  총점 (${checks.length}점 만점): NORM_65=${scores[0]}  NORM_67=${scores[1]}  NORM_70=${scores[2]}`);

  const best = scores.indexOf(Math.max(...scores));
  console.log(`  최고점: NORM_${TARGETS[best]}`);

  // 파일 저장 확인
  console.log(`\n상세 파일 저장:`);
  console.log(`  ${path.join(OUT,"norm_detail.csv")}  (${N*N_DAYS*4}행)`);
  console.log(`  ${path.join(OUT,"norm_profile_summary.csv")}  (${N}행)`);
  console.log(`  ${path.join(OUT,"norm_report.md")}`);
  console.log("\n✅ 완료");
}

main().catch(console.error);
