/**
 * 배지 기준 3안 비교 — NORM_65 점수 재사용
 * Usage: npx tsx scripts/compareBadgeSchemes.ts
 */
import { calculateSajuProfile } from "../src/utils/sajuCalculator";
import { buildZiweiProfile }    from "../src/utils/ziweiCalculator";
import { buildAstroProfile }    from "../src/utils/astroCalculator";
import { FortuneAggregator }    from "../src/engines/aggregator";
import { DEFAULT_ZIWEI_FLAGS }  from "../src/engines/ziweiEngine";
import { DEFAULT_SAJU_FLAGS }   from "../src/engines/sajuEngine";
import type { DailyFortune }    from "../src/engines/aggregator";

const PROFILES = [
  { id:1,  label:"P01", birth:{year:1962,month:2, day:14,hour:6, minute:0}, gender:"M" as const },
  { id:2,  label:"P02", birth:{year:1970,month:4, day:3, hour:14,minute:0}, gender:"F" as const },
  { id:3,  label:"P03", birth:{year:1975,month:6, day:20,hour:10,minute:0}, gender:"M" as const },
  { id:4,  label:"P04", birth:{year:1983,month:12,day:5, hour:22,minute:0}, gender:"F" as const },
  { id:5,  label:"P05", birth:{year:1988,month:9, day:9, hour:8, minute:0}, gender:"M" as const },
  { id:6,  label:"P06", birth:{year:1993,month:3, day:15,hour:4, minute:0}, gender:"F" as const },
  { id:7,  label:"P07", birth:{year:1997,month:7, day:7, hour:12,minute:0}, gender:"M" as const },
  { id:8,  label:"P08", birth:{year:2001,month:10,day:31,hour:18,minute:0}, gender:"F" as const },
  { id:9,  label:"P09", birth:{year:1971,month:9, day:1, hour:20,minute:0}, gender:"F" as const },
  { id:10, label:"P10", birth:{year:2005,month:8, day:18,hour:16,minute:0}, gender:"M" as const },
];
const N = PROFILES.length;

const END   = new Date(2026, 4, 31);
const START = new Date(END);
START.setDate(END.getDate() - 179);
const N_DAYS    = 180;
const TARGET    = 65;
const MAX_OFFSET = 6;

function avg(a: number[]) { return a.reduce((s,x)=>s+x,0)/a.length; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function pad(s: string|number, w: number) { return String(s).padStart(w); }
function r1(v: number) { return Math.round(v * 10) / 10; }

async function buildProfile(p: typeof PROFILES[0]) {
  const b = p.birth;
  return {
    sajuProfile:  calculateSajuProfile(b.year, b.month, b.day, b.hour, p.gender, undefined, b.minute),
    ziweiProfile: buildZiweiProfile(b.year, b.month, b.day, b.hour, 2026, p.gender==="M"),
    astroProfile: await buildAstroProfile(b.year, b.month, b.day, b.hour, undefined, undefined, b.minute),
    birthDate:    new Date(b.year, b.month-1, b.day),
    label:        p.label,
  };
}

// 배지 분류 함수
function badgeA(s: number) {
  if (s >= 80) return "80+ (아주좋음)";
  if (s >= 70) return "70~79 (좋음)";
  if (s >= 56) return "56~69 (보통)";
  return "55이하 (주의)";
}
function badgeB(s: number) {
  if (s >= 80) return "80+ (아주좋음)";
  if (s >= 70) return "70~79 (좋음)";
  if (s >= 51) return "51~69 (보통)";
  return "50이하 (주의)";
}
function badgeC(s: number) {
  if (s >= 80) return "80+ (아주좋음)";
  if (s >= 65) return "65~79 (좋음)";
  if (s >= 56) return "56~64 (보통)";
  return "55이하 (주의)";
}

type BadgeFn = (s: number) => string;

function distribution(scores: number[], fn: BadgeFn) {
  const cnt: Record<string, number> = {};
  for (const s of scores) {
    const b = fn(s);
    cnt[b] = (cnt[b] ?? 0) + 1;
  }
  return cnt;
}

function printDist(
  label: string,
  buckets: string[],
  dist: Record<string, number>,
  total: number,
) {
  console.log(`  ${label}`);
  for (const b of buckets) {
    const n = dist[b] ?? 0;
    const pct = Math.round(n / total * 100);
    const bar = "█".repeat(Math.round(pct / 2));
    console.log(`    ${b.padEnd(20)} ${String(pct+"%").padStart(5)}  (${String(n).padStart(4)}건)  ${bar}`);
  }
}

async function main() {
  console.log("=== 배지 기준 3안 비교 — NORM_65 기준 ===");
  console.log("안 A: 55이하 / 56~69 / 70~79 / 80+");
  console.log("안 B: 50이하 / 51~69 / 70~79 / 80+  ← 현재 적용 중");
  console.log("안 C: 55이하 / 56~64 / 65~79 / 80+");
  console.log(`기간: ${N_DAYS}일 × ${N}명 = ${N_DAYS*N}건\n`);

  console.log("점수 계산 중...");
  const pds = await Promise.all(PROFILES.map(buildProfile));

  const normAll: number[] = [];
  const normByProfile: number[][] = Array.from({length: N}, () => []);

  for (let pi = 0; pi < N; pi++) {
    const pd = pds[pi];
    const agg = new FortuneAggregator(
      pd.sajuProfile, pd.ziweiProfile, pd.astroProfile,
      undefined, pd.birthDate, true,
    );
    const raw: number[] = [];
    for (let i = 0; i < N_DAYS; i++) {
      const d = new Date(START);
      d.setDate(START.getDate() + i);
      const f: DailyFortune = agg.getDailyFortune(d, DEFAULT_ZIWEI_FLAGS, DEFAULT_SAJU_FLAGS);
      raw.push(f.scores.overall);
    }
    const rawAvg = avg(raw);
    const offset = clamp(TARGET - rawAvg, -MAX_OFFSET, MAX_OFFSET);
    const norm   = raw.map(v => Math.round(clamp(v + offset, 0, 100)));
    normByProfile[pi] = norm;
    normAll.push(...norm);
  }
  console.log("완료\n");

  const T = normAll.length; // 1800

  // ── 전체 배지 분포 ─────────────────────────────────────────────────────────
  const dA = distribution(normAll, badgeA);
  const dB = distribution(normAll, badgeB);
  const dC = distribution(normAll, badgeC);

  const bucketsA = ["80+ (아주좋음)", "70~79 (좋음)", "56~69 (보통)", "55이하 (주의)"];
  const bucketsB = ["80+ (아주좋음)", "70~79 (좋음)", "51~69 (보통)", "50이하 (주의)"];
  const bucketsC = ["80+ (아주좋음)", "65~79 (좋음)", "56~64 (보통)", "55이하 (주의)"];

  console.log("══════════════════════════════════════════════════════════════════════");
  console.log("전체 배지 분포 비교 (1800건)");
  console.log("══════════════════════════════════════════════════════════════════════\n");
  printDist("안 A  (55이하 / 56~69 / 70~79 / 80+)", bucketsA, dA, T);
  console.log();
  printDist("안 B  (50이하 / 51~69 / 70~79 / 80+)  ← 현재", bucketsB, dB, T);
  console.log();
  printDist("안 C  (55이하 / 56~64 / 65~79 / 80+)", bucketsC, dC, T);

  // ── 3안 수치 비교표 ────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("3안 비율 비교표");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log(`${"".padEnd(22)}  ${"안 A".padStart(6)}  ${"안 B".padStart(6)}  ${"안 C".padStart(6)}`);
  console.log("─".repeat(42));

  // 공통 구간
  const n80p  = normAll.filter(v=>v>=80).length;
  const n7079 = normAll.filter(v=>v>=70&&v<80).length;
  const n6579 = normAll.filter(v=>v>=65&&v<80).length;
  const n6569 = normAll.filter(v=>v>=65&&v<70).length;
  const n5669 = normAll.filter(v=>v>=56&&v<70).length;
  const n5664 = normAll.filter(v=>v>=56&&v<65).length;
  const n5169 = normAll.filter(v=>v>=51&&v<70).length;
  const n55m  = normAll.filter(v=>v<=55).length;
  const n50m  = normAll.filter(v=>v<=50).length;

  const p = (n: number) => `${Math.round(n/T*100)}%`;
  console.log(`  ${"80+ (아주좋음)".padEnd(20)}  ${p(n80p).padStart(6)}  ${p(n80p).padStart(6)}  ${p(n80p).padStart(6)}`);
  console.log(`  ${"65~79 (C좋음)".padEnd(20)}  ${"—".padStart(6)}  ${"—".padStart(6)}  ${p(n6579).padStart(6)}`);
  console.log(`  ${"70~79 (A/B좋음)".padEnd(20)}  ${p(n7079).padStart(6)}  ${p(n7079).padStart(6)}  ${"—".padStart(6)}`);
  console.log(`  ${"56~69 (A보통)".padEnd(20)}  ${p(n5669).padStart(6)}  ${"—".padStart(6)}  ${"—".padStart(6)}`);
  console.log(`  ${"51~69 (B보통)".padEnd(20)}  ${"—".padStart(6)}  ${p(n5169).padStart(6)}  ${"—".padStart(6)}`);
  console.log(`  ${"56~64 (C보통)".padEnd(20)}  ${"—".padStart(6)}  ${"—".padStart(6)}  ${p(n5664).padStart(6)}`);
  console.log(`  ${"55이하 (A/C주의)".padEnd(20)}  ${p(n55m).padStart(6)}  ${"—".padStart(6)}  ${p(n55m).padStart(6)}`);
  console.log(`  ${"50이하 (B주의)".padEnd(20)}  ${"—".padStart(6)}  ${p(n50m).padStart(6)}  ${"—".padStart(6)}`);

  // ── 프로필별 3안 비교 ─────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("프로필별 3안 배지 분포");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  for (const [schemeLabel, fn, buckets] of [
    ["안 A (55이하/56~69/70~79/80+)", badgeA, bucketsA],
    ["안 B (50이하/51~69/70~79/80+)", badgeB, bucketsB],
    ["안 C (55이하/56~64/65~79/80+)", badgeC, bucketsC],
  ] as [string, BadgeFn, string[]][]) {
    console.log(`  ${schemeLabel}`);
    console.log(`  ${"".padEnd(10)}  ${"아주좋음".padStart(8)}  ${"좋음".padStart(8)}  ${"보통".padStart(8)}  ${"주의".padStart(8)}`);
    console.log("  " + "─".repeat(50));
    for (let pi = 0; pi < N; pi++) {
      const s = normByProfile[pi];
      const n = s.length;
      const d = distribution(s, fn);
      const vals = buckets.map(b => `${Math.round((d[b]??0)/n*100)}%`);
      console.log(`  ${PROFILES[pi].label.padEnd(10)}  ${vals.map(v=>v.padStart(8)).join("  ")}`);
    }
    console.log();
  }

  // ── 추천 ───────────────────────────────────────────────────────────────────
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log("분석 & 추천");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  // 각 안의 4개 구간 비율
  const ratioA = [n80p, n7079, n5669, n55m].map(n => r1(n/T*100));
  const ratioB = [n80p, n7079, n5169, n50m].map(n => r1(n/T*100));
  const ratioC = [n80p, n6579, n5664, n55m].map(n => r1(n/T*100));

  // 이상적 분포에서의 편차 계산
  // 목표: 아주좋음 5~15%, 좋음 20~30%, 보통 50~65%, 주의 5~15%
  function score4dist(ratios: number[]) {
    const [excellent, good, normal, caution] = ratios;
    let s = 0;
    if (excellent >= 5 && excellent <= 15) s += 2; else if (excellent < 5) s += 0; else s += 1;
    if (good >= 20 && good <= 30) s += 2; else s += 1;
    if (normal >= 50 && normal <= 65) s += 2; else s += 1;
    if (caution >= 5 && caution <= 15) s += 2; else if (caution < 5) s += 0; else s += 1;
    return s;
  }
  const sA = score4dist(ratioA), sB = score4dist(ratioB), sC = score4dist(ratioC);

  console.log(`  목표 비율: 아주좋음 5~15%  /  좋음 20~30%  /  보통 50~65%  /  주의 5~15%\n`);
  console.log(`  ${"".padEnd(8)}  ${"아주좋음".padStart(8)}  ${"좋음".padStart(8)}  ${"보통".padStart(8)}  ${"주의".padStart(8)}  ${"평가점".padStart(6)}`);
  console.log("  " + "─".repeat(58));

  const inRange = (v: number, lo: number, hi: number) => v >= lo && v <= hi ? "✅" : v < lo ? "⬇" : "⬆";
  for (const [label, ratios, score] of [
    ["안 A", ratioA, sA],
    ["안 B (현재)", ratioB, sB],
    ["안 C", ratioC, sC],
  ] as [string, number[], number][]) {
    const [e, g, n, c] = ratios;
    const marks = [inRange(e,5,15), inRange(g,20,30), inRange(n,50,65), inRange(c,5,15)];
    console.log(
      `  ${label.padEnd(8)}  ` +
      `${(e+"%").padStart(8)}${marks[0]}  ` +
      `${(g+"%").padStart(8)}${marks[1]}  ` +
      `${(n+"%").padStart(8)}${marks[2]}  ` +
      `${(c+"%").padStart(8)}${marks[3]}  ` +
      `${score}/8`
    );
  }

  console.log();
  const bestScore = Math.max(sA, sB, sC);
  const bestLabel = sA === bestScore && sA >= sB && sA >= sC ? "안 A"
    : sB === bestScore && sB >= sA && sB >= sC ? "안 B"
    : "안 C";

  console.log(`  추천: ${bestLabel}`);
  console.log();
  console.log("  각 안 특성:");
  console.log(`  안 A: '주의'가 ${ratioA[3]}%로 적당. '보통' 구간이 56~69로 좁아 분명한 구분.`);
  console.log(`  안 B: '주의'가 ${ratioB[3]}%로 매우 적음. '보통' 구간이 51~69로 넓어 포용적.`);
  console.log(`  안 C: '좋음' 구간이 65~79로 매우 넓어 ${ratioC[1]}%. '보통'이 ${ratioC[2]}%로 협소.`);

  console.log("\n✅ 완료");
}

main().catch(console.error);
