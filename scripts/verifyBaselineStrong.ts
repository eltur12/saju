/**
 * profileBaselineLayer 강화 1차 실험
 * Usage: npx tsx scripts/verifyBaselineStrong.ts
 *
 * 비교: DEFAULT_BASELINE_CONFIG vs STRONG_BASELINE_CONFIG
 * 대상: 기존 10개 프로필 × 최근 90일 (2026-03-02 ~ 2026-05-30)
 */
import { calculateSajuProfile }  from "../src/utils/sajuCalculator";
import { buildZiweiProfile }     from "../src/utils/ziweiCalculator";
import { buildAstroProfile }     from "../src/utils/astroCalculator";
import { FortuneAggregator }     from "../src/engines/aggregator";
import { DEFAULT_ZIWEI_FLAGS }   from "../src/engines/ziweiEngine";
import { DEFAULT_SAJU_FLAGS }    from "../src/engines/sajuEngine";
import {
  DEFAULT_BASELINE_CONFIG,
  STRONG_BASELINE_CONFIG,
} from "../src/engines/profileBaselineLayer";
import type { DailyFortune }     from "../src/engines/aggregator";

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
const N_DAYS = 90;

function r1(v: number) { return Math.round(v * 10) / 10; }
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
function pad(s: string|number, w: number) { return String(s).padStart(w); }
function pctStr(n: number, total: number) { return `${Math.round(n/total*100)}%`; }
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

function runDays(pd: Awaited<ReturnType<typeof buildProfile>>, useStrong: boolean): number[] {
  const cfg = useStrong ? STRONG_BASELINE_CONFIG : DEFAULT_BASELINE_CONFIG;
  const agg = new FortuneAggregator(
    pd.sajuProfile, pd.ziweiProfile, pd.astroProfile,
    undefined, pd.birthDate, true, cfg,
  );
  const scores: number[] = [];
  for (let i = 0; i < N_DAYS; i++) {
    const d = new Date(START);
    d.setDate(START.getDate() + i);
    const f: DailyFortune = agg.getDailyFortune(d, DEFAULT_ZIWEI_FLAGS, DEFAULT_SAJU_FLAGS);
    scores.push(f.scores.overall);
  }
  return scores;
}

function profileStats(s: number[]) {
  const ss = [...s].sort((a,b)=>a-b);
  const n = ss.length;
  return {
    avg:   r1(avg(s)),
    min:   ss[0],
    max:   ss[n-1],
    range: ss[n-1]-ss[0],
    std:   r1(stdev(s)),
    p5:    pct(ss,5),
    p95:   pct(ss,95),
    b75p:  Math.round(s.filter(v=>v>=75).length/n*100),
    b6574: Math.round(s.filter(v=>v>=65&&v<75).length/n*100),
    b5564: Math.round(s.filter(v=>v>=55&&v<65).length/n*100),
    b54m:  Math.round(s.filter(v=>v<55).length/n*100),
    b54mN: s.filter(v=>v<55).length,
  };
}

async function main() {
  console.log("=== profileBaselineLayer 강화 1차 실험 ===");
  console.log("비교: DEFAULT vs STRONG (floorThr 58→62, strengthLo 0.35→0.50, minDays 7→4, maxAdjLo 5→6)");
  console.log(`기간: 2026-03-02 ~ 2026-05-30 (90일)\n`);

  console.log("프로필 빌드 중...");
  const pds = await Promise.all(PROFILES.map(buildProfile));
  console.log("완료\n");

  const defSeries: number[][] = [];
  const strSeries: number[][] = [];
  for (const pd of pds) {
    defSeries.push(runDays(pd, false));
    strSeries.push(runDays(pd, true));
  }

  const defAll = defSeries.flat();
  const strAll = strSeries.flat();
  const defAllSorted = [...defAll].sort((a,b)=>a-b);
  const strAllSorted = [...strAll].sort((a,b)=>a-b);
  const T = defAll.length; // 900

  // ── 전체 분포 비교 ─────────────────────────────────────────────────────────
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log("전체 분포 비교 (10명 × 90일 = 900건)");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const defG = { avg: r1(avg(defAll)), std: r1(stdev(defAll)), min: defAllSorted[0], max: defAllSorted[T-1],
    p5: pct(defAllSorted,5), p95: pct(defAllSorted,95), p50: pct(defAllSorted,50) };
  const strG = { avg: r1(avg(strAll)), std: r1(stdev(strAll)), min: strAllSorted[0], max: strAllSorted[T-1],
    p5: pct(strAllSorted,5), p95: pct(strAllSorted,95), p50: pct(strAllSorted,50) };

  const cols = ["avg","std","min","max","p5","p50","p95"] as const;
  console.log(`${"".padEnd(10)} ${"DEFAULT".padStart(10)} ${"STRONG".padStart(10)} ${"변화".padStart(8)}`);
  console.log("─".repeat(42));
  for (const k of cols) {
    const d = defG[k], s = strG[k];
    const delta = r1((s as number)-(d as number));
    console.log(`${k.padEnd(10)} ${pad(d,10)} ${pad(s,10)} ${`${sign(delta)}${delta}`.padStart(8)}`);
  }
  const defP5P95 = defG.p95-defG.p5, strP5P95 = strG.p95-strG.p5;
  console.log(`\n  p5~p95 범위: DEFAULT=${defP5P95}점  STRONG=${strP5P95}점  변화=${sign(strP5P95-defP5P95)}${strP5P95-defP5P95}`);

  // ── inter-user std ─────────────────────────────────────────────────────────
  const defInterStd = r1(stdev(defSeries.map(s=>r1(avg(s)))));
  const strInterStd = r1(stdev(strSeries.map(s=>r1(avg(s)))));
  console.log(`\n  inter-user std: DEFAULT=${defInterStd}  STRONG=${strInterStd}  변화=${sign(strInterStd-defInterStd)}${r1(strInterStd-defInterStd)}`);

  // ── 프로필별 분포 ──────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("프로필별 분포 (avg / min / max / range / std / p5 / p95)");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const defStats = defSeries.map(profileStats);
  const strStats = strSeries.map(profileStats);

  console.log(`${"".padEnd(14)} ${"DEFAULT avg±std".padEnd(16)} ${"STRONG avg±std".padEnd(16)} ${"avg변화".padStart(8)} ${"std변화".padStart(8)} ${"range D".padStart(8)} ${"range S".padStart(8)}`);
  console.log("─".repeat(82));
  for (let i = 0; i < N; i++) {
    const d = defStats[i], s = strStats[i];
    const da = r1(s.avg-d.avg), ds = r1(s.std-d.std);
    console.log(
      `${PROFILES[i].label.padEnd(14)} ` +
      `${`${d.avg}±${d.std}`.padEnd(16)} ` +
      `${`${s.avg}±${s.std}`.padEnd(16)} ` +
      `${`${sign(da)}${da}`.padStart(8)} ` +
      `${`${sign(ds)}${ds}`.padStart(8)} ` +
      `${pad(d.range,8)} ${pad(s.range,8)}`
    );
  }

  // ── 배지 분포 ──────────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("프로필별 배지 분포 변화");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log(`${"".padEnd(14)}  ${"─── DEFAULT ───".padEnd(32)} ${"─── STRONG ───".padEnd(32)}`);
  console.log(`${"".padEnd(14)}  ${"75+".padStart(5)} ${"65~74".padStart(7)} ${"55~64".padStart(7)} ${"54↓".padStart(6)}    ${"75+".padStart(5)} ${"65~74".padStart(7)} ${"55~64".padStart(7)} ${"54↓".padStart(6)}`);
  console.log("─".repeat(82));
  for (let i = 0; i < N; i++) {
    const d = defStats[i], s = strStats[i];
    const d54chg = s.b54m - d.b54m;
    const flag = d54chg < -5 ? " ✅" : d54chg > 5 ? " ⚠" : "";
    console.log(
      `${PROFILES[i].label.padEnd(14)}  ` +
      `${pad(d.b75p+"%",5)} ${pad(d.b6574+"%",7)} ${pad(d.b5564+"%",7)} ${pad(d.b54m+"%",6)}    ` +
      `${pad(s.b75p+"%",5)} ${pad(s.b6574+"%",7)} ${pad(s.b5564+"%",7)} ${pad(s.b54m+"%",6)}${flag}`
    );
  }

  // 전체 배지 분포
  console.log("\n  전체 배지 분포:");
  const dBadge = {
    b75p:  pctStr(defAll.filter(v=>v>=75).length, T),
    b6574: pctStr(defAll.filter(v=>v>=65&&v<75).length, T),
    b5564: pctStr(defAll.filter(v=>v>=55&&v<65).length, T),
    b54m:  pctStr(defAll.filter(v=>v<55).length, T),
  };
  const sBadge = {
    b75p:  pctStr(strAll.filter(v=>v>=75).length, T),
    b6574: pctStr(strAll.filter(v=>v>=65&&v<75).length, T),
    b5564: pctStr(strAll.filter(v=>v>=55&&v<65).length, T),
    b54m:  pctStr(strAll.filter(v=>v<55).length, T),
  };
  console.log(`  ${"".padEnd(22)} ${"DEFAULT".padStart(8)} ${"STRONG".padStart(8)}`);
  console.log(`  ${"75+ (아주 좋은 날)".padEnd(22)} ${dBadge.b75p.padStart(8)} ${sBadge.b75p.padStart(8)}`);
  console.log(`  ${"65~74 (좋은 날)".padEnd(22)} ${dBadge.b6574.padStart(8)} ${sBadge.b6574.padStart(8)}`);
  console.log(`  ${"55~64 (보통)".padEnd(22)} ${dBadge.b5564.padStart(8)} ${sBadge.b5564.padStart(8)}`);
  console.log(`  ${"54이하 (힘든 날)".padEnd(22)} ${dBadge.b54m.padStart(8)} ${sBadge.b54m.padStart(8)}`);

  // ── P06, P09 집중 분석 ─────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("P06 / P09 집중 분석 (54이하 비율 변화)");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  for (const idx of [5, 8]) { // P06=index5, P09=index8
    const d = defStats[idx], s = strStats[idx];
    const p = PROFILES[idx];
    console.log(`  ${p.label}`);
    console.log(`    avg:   DEFAULT=${d.avg}  STRONG=${s.avg}  변화=${sign(r1(s.avg-d.avg))}${r1(s.avg-d.avg)}`);
    console.log(`    std:   DEFAULT=${d.std}  STRONG=${s.std}  변화=${sign(r1(s.std-d.std))}${r1(s.std-d.std)}`);
    console.log(`    range: DEFAULT=${d.range}  STRONG=${s.range}`);
    console.log(`    p5:    DEFAULT=${d.p5}   STRONG=${s.p5}`);
    console.log(`    p95:   DEFAULT=${d.p95}  STRONG=${s.p95}`);
    console.log(`    54이하: DEFAULT=${d.b54m}%  STRONG=${s.b54m}%  변화=${sign(s.b54m-d.b54m)}${s.b54m-d.b54m}pp`);
    console.log();
  }

  // ── 75+ 비율 변화 ──────────────────────────────────────────────────────────
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log("75+ 비율 변화 (전 프로필)");
  console.log("══════════════════════════════════════════════════════════════════════\n");
  for (let i = 0; i < N; i++) {
    const d = defStats[i], s = strStats[i];
    const chg = s.b75p - d.b75p;
    const flag = chg > 3 ? " ⚠ 상승" : chg < -3 ? " ✅ 유지/감소" : "";
    console.log(`  ${PROFILES[i].label.padEnd(14)} DEFAULT=${pad(d.b75p+"%",5)}  STRONG=${pad(s.b75p+"%",5)}  변화=${sign(chg)}${chg}pp${flag}`);
  }

  // ── range/std 유지 확인 ────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("range / stddev 유지 확인");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log(`  ${"".padEnd(14)} ${"D-range".padStart(8)} ${"S-range".padStart(8)} ${"Δrange".padStart(7)}  ${"D-std".padStart(6)} ${"S-std".padStart(6)} ${"Δstd".padStart(6)}`);
  console.log("  " + "─".repeat(60));
  for (let i = 0; i < N; i++) {
    const d = defStats[i], s = strStats[i];
    const dr = s.range-d.range, ds = r1(s.std-d.std);
    const flag = Math.abs(ds) > 1 ? " ⚠" : "";
    console.log(
      `  ${PROFILES[i].label.padEnd(14)} ${pad(d.range,8)} ${pad(s.range,8)} ${`${sign(dr)}${dr}`.padStart(7)}  ` +
      `${pad(d.std,6)} ${pad(s.std,6)} ${`${sign(ds)}${ds}`.padStart(6)}${flag}`
    );
  }

  // ── 프로필 평균 수렴 확인 ────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("프로필별 avg 수렴 결과 (목표: 58~64)");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  let defInRange = 0, strInRange = 0;
  for (let i = 0; i < N; i++) {
    const d = defStats[i], s = strStats[i];
    const dIn = d.avg >= 58 && d.avg <= 64;
    const sIn = s.avg >= 58 && s.avg <= 64;
    if (dIn) defInRange++;
    if (sIn) strInRange++;
    const flag = !dIn && sIn ? " ✅ 범위 진입" : dIn && sIn ? " ✅ 유지" : dIn && !sIn ? " ⚠ 범위 이탈" : "";
    console.log(`  ${PROFILES[i].label.padEnd(14)} DEFAULT=${pad(d.avg,5)}${dIn?" ✓":" ✗"}  STRONG=${pad(s.avg,5)}${sIn?" ✓":" ✗"}${flag}`);
  }
  console.log(`\n  58~64 범위 내 프로필 수: DEFAULT=${defInRange}/${N}  STRONG=${strInRange}/${N}`);

  // ── 종합 요약 ─────────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("종합 요약");
  console.log("══════════════════════════════════════════════════════════════════════\n");
  console.log(`  전체 avg:      DEFAULT=${defG.avg} → STRONG=${strG.avg}  (${sign(r1(strG.avg-defG.avg))}${r1(strG.avg-defG.avg)})`);
  console.log(`  전체 std:      DEFAULT=${defG.std} → STRONG=${strG.std}`);
  console.log(`  inter-user std: DEFAULT=${defInterStd} → STRONG=${strInterStd}  (${sign(r1(strInterStd-defInterStd))}${r1(strInterStd-defInterStd)})`);
  console.log(`  p5~p95 범위:   DEFAULT=${defP5P95}점 → STRONG=${strP5P95}점`);
  console.log(`  58~64 수렴:    DEFAULT=${defInRange}/${N} → STRONG=${strInRange}/${N}`);

  console.log("\n✅ 분석 완료");
}

main().catch(console.error);
