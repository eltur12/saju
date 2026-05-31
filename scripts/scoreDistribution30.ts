/**
 * 30일 원본 점수 분포 확인
 * Usage: npx tsx scripts/scoreDistribution30.ts
 *
 * 출력:
 *   1. 30일 × 10명 원본 점수 표
 *   2. 프로필별 요약 (avg/min/max/range/stddev)
 *   3. 추가 분석 (range/고점·저점/상관/협소구간/변동성)
 *   4. CSV
 */
import { calculateSajuProfile } from "../src/utils/sajuCalculator";
import { buildZiweiProfile }    from "../src/utils/ziweiCalculator";
import { buildAstroProfile }    from "../src/utils/astroCalculator";
import { FortuneAggregator }    from "../src/engines/aggregator";
import { DEFAULT_ZIWEI_FLAGS }  from "../src/engines/ziweiEngine";
import { DEFAULT_SAJU_FLAGS }   from "../src/engines/sajuEngine";
import type { DailyFortune }    from "../src/engines/aggregator";

// ── 프로필 (이전 실험과 동일) ─────────────────────────────────────────────────
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

// 최근 30일: 2026-05-02 ~ 2026-05-31
const END   = new Date(2026, 4, 31);   // 2026-05-31
const START = new Date(END);
START.setDate(END.getDate() - 29);     // 30일

const N_DAYS = 30;

// ── 유틸 ─────────────────────────────────────────────────────────────────────
function r1(v: number) { return Math.round(v * 10) / 10; }
function avg(a: number[]) { return a.reduce((s,x)=>s+x,0)/a.length; }
function stdev(a: number[]) {
  const m = avg(a);
  return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/a.length);
}
function corrPearson(a: number[], b: number[]): number {
  const ma = avg(a), mb = avg(b);
  const num = a.reduce((s,x,i)=>s+(x-ma)*(b[i]-mb),0);
  const den = Math.sqrt(a.reduce((s,x)=>s+(x-ma)**2,0)*b.reduce((s,x)=>s+(x-mb)**2,0));
  return den === 0 ? 1 : num/den;
}
function dateStr(d: Date): string {
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `2026-${m}-${day}`;
}
function pad(s: string|number, w: number) { return String(s).padStart(w); }

// ── 빌드 ─────────────────────────────────────────────────────────────────────
async function buildProfile(p: typeof PROFILES[0]) {
  const { birth: b, gender } = p;
  return {
    label:        p.label,
    sajuProfile:  calculateSajuProfile(b.year, b.month, b.day, b.hour, gender, undefined, b.minute),
    ziweiProfile: buildZiweiProfile(b.year, b.month, b.day, b.hour, 2026, gender==="M"),
    astroProfile: await buildAstroProfile(b.year, b.month, b.day, b.hour, undefined, undefined, b.minute),
    birthDate:    new Date(b.year, b.month-1, b.day),
  };
}

async function main() {
  console.log("프로필 빌드 중...");
  const pds = await Promise.all(PROFILES.map(buildProfile));
  console.log("완료\n");

  // ── 점수 수집 ─────────────────────────────────────────────────────────────
  // matrix[day][profile] = overall score
  const matrix: number[][] = [];
  const dates: string[]    = [];

  for (let i = 0; i < N_DAYS; i++) {
    const d = new Date(START);
    d.setDate(START.getDate() + i);
    dates.push(dateStr(d));
    const row: number[] = [];
    for (const pd of pds) {
      const agg = new FortuneAggregator(
        pd.sajuProfile, pd.ziweiProfile, pd.astroProfile,
        undefined, pd.birthDate, true,
      );
      const fortune: DailyFortune = agg.getDailyFortune(d, DEFAULT_ZIWEI_FLAGS, DEFAULT_SAJU_FLAGS);
      row.push(fortune.scores.overall);
    }
    matrix.push(row);
  }

  // ── 프로필별 시계열 ────────────────────────────────────────────────────────
  const series: number[][] = PROFILES.map((_,pi) => matrix.map(row => row[pi]));

  // ── 표 1: 원본 점수 분포 ──────────────────────────────────────────────────
  console.log("══════════════════════════════════════════════════════════════════════════════════");
  console.log("표 1: 30일 × 10명 원본 overall 점수");
  console.log("══════════════════════════════════════════════════════════════════════════════════\n");

  // 헤더
  const header = "Date      " + PROFILES.map(p => pad(p.label,5)).join("  ");
  console.log(header);
  console.log("─".repeat(header.length));

  for (let i = 0; i < N_DAYS; i++) {
    const cells = matrix[i].map(v => pad(v,5)).join("  ");
    console.log(`${dates[i]}  ${cells}`);
  }

  // ── 표 2: 프로필별 요약 ───────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════════════════");
  console.log("표 2: 프로필별 요약 통계");
  console.log("══════════════════════════════════════════════════════════════════════════════════\n");

  console.log(`${"".padEnd(6)} ${"avg".padStart(6)} ${"min".padStart(5)} ${"max".padStart(5)} ${"range".padStart(7)} ${"stddev".padStart(8)}`);
  console.log("─".repeat(44));

  const summaries = series.map((s, pi) => {
    const mn  = Math.min(...s);
    const mx  = Math.max(...s);
    const rng = mx - mn;
    const av  = r1(avg(s));
    const sd  = r1(stdev(s));
    return { label: PROFILES[pi].label, avg: av, min: mn, max: mx, range: rng, std: sd };
  });

  for (const s of summaries) {
    console.log(`${s.label.padEnd(6)} ${pad(s.avg,6)} ${pad(s.min,5)} ${pad(s.max,5)} ${pad(s.range,7)} ${pad(s.std,8)}`);
  }

  // ── 분석 1: range 순위 ─────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════════════════");
  console.log("분석 1: max - min 범위 (30일 전체)");
  console.log("══════════════════════════════════════════════════════════════════════════════════\n");

  const byRange = [...summaries].sort((a,b) => b.range - a.range);
  for (const s of byRange) {
    const bar = "█".repeat(Math.round(s.range / 2));
    console.log(`${s.label}  range = ${pad(s.range, 2)}  ${bar}`);
  }

  // ── 분석 2: 고점 / 저점 날짜 ──────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════════════════");
  console.log("분석 2: 가장 높은 날 / 가장 낮은 날 (프로필별)");
  console.log("══════════════════════════════════════════════════════════════════════════════════\n");

  console.log(`${"".padEnd(6)} ${"고점날".padEnd(12)} ${"점수".padStart(4)}  ${"저점날".padEnd(12)} ${"점수".padStart(4)}`);
  console.log("─".repeat(44));

  for (let pi = 0; pi < N; pi++) {
    const s = series[pi];
    const maxIdx = s.indexOf(Math.max(...s));
    const minIdx = s.indexOf(Math.min(...s));
    console.log(
      `${PROFILES[pi].label.padEnd(6)} ` +
      `${dates[maxIdx].padEnd(12)} ${pad(s[maxIdx],4)}  ` +
      `${dates[minIdx].padEnd(12)} ${pad(s[minIdx],4)}`
    );
  }

  // ── 분석 3: 곡선 모양 비교 (상관계수) ─────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════════════════");
  console.log("분석 3: 곡선 모양 유사도 — Pearson 상관 행렬");
  console.log("══════════════════════════════════════════════════════════════════════════════════\n");
  console.log("  (1.0 = 완전 동일 궤적, 0.0 = 무관, -1.0 = 역방향)\n");

  // 헤더
  process.stdout.write("       ");
  for (const p of PROFILES) process.stdout.write(pad(p.label,6));
  console.log();
  console.log("  " + "─".repeat(6*N+5));

  for (let i = 0; i < N; i++) {
    process.stdout.write(`  ${PROFILES[i].label} `);
    for (let j = 0; j < N; j++) {
      const r = i === j ? 1.0 : corrPearson(series[i], series[j]);
      process.stdout.write(pad(r.toFixed(2),6));
    }
    console.log();
  }

  // 평균 상관계수 (자기 제외)
  let sumCorr = 0, cnt = 0;
  for (let i = 0; i < N; i++) for (let j = i+1; j < N; j++) {
    sumCorr += corrPearson(series[i], series[j]); cnt++;
  }
  console.log(`\n  평균 쌍별 상관계수: ${r1(sumCorr/cnt)}`);
  console.log("  (> 0.7 이면 '패턴은 공유, 평균만 다름' / < 0.3 이면 실질적 독립)");

  // ── 분석 4: 협소 구간 확인 ────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════════════════");
  console.log("분석 4: 협소 구간 탐지 (30일 range ≤ 15 또는 stddev ≤ 4.5)");
  console.log("══════════════════════════════════════════════════════════════════════════════════\n");

  let anyNarrow = false;
  for (const s of summaries) {
    const narrow = s.range <= 15 || s.std <= 4.5;
    const rangeFlag = s.range <= 15 ? "⚠ range 협소" : "";
    const stdFlag   = s.std   <= 4.5 ? "⚠ std 협소" : "";
    if (narrow) {
      anyNarrow = true;
      console.log(`  ${s.label}  range=${s.range}  std=${s.std}  ${rangeFlag} ${stdFlag}`);
      // 어떤 구간에 갇혀있는지
      const lo = Math.floor(s.min / 5) * 5;
      const hi = Math.ceil(s.max / 5) * 5;
      console.log(`    → 실제 분포 구간: ${lo}~${hi}`);
    }
  }
  if (!anyNarrow) console.log("  협소 구간 프로필 없음 (모두 range > 15, std > 4.5)");

  // ── 분석 5: 변동성 순위 ───────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════════════════");
  console.log("분석 5: 변동성 순위 (stddev 기준)");
  console.log("══════════════════════════════════════════════════════════════════════════════════\n");

  const byStd = [...summaries].sort((a,b) => b.std - a.std);

  console.log("  변동성 큰 TOP 3:");
  for (const s of byStd.slice(0,3)) {
    const bar = "█".repeat(Math.round(s.std));
    console.log(`    ${s.label}  std=${s.std}  range=${s.range}  avg=${s.avg}  ${bar}`);
  }
  console.log();
  console.log("  변동성 작은 TOP 3:");
  for (const s of byStd.slice(-3).reverse()) {
    const bar = "░".repeat(Math.round(s.std));
    console.log(`    ${s.label}  std=${s.std}  range=${s.range}  avg=${s.avg}  ${bar}`);
  }

  // 원인 힌트: avg와 std의 관계 (평균이 낮으면 ceiling에 막혀 변동 적을 수 있음)
  console.log("\n  avg vs std 상관 (낮은 avg → 낮은 범위 가능성):");
  const avgVals = summaries.map(s => s.avg);
  const stdVals = summaries.map(s => s.std);
  const avgStdCorr = r1(corrPearson(avgVals, stdVals));
  console.log(`    avg↔std 상관계수: ${avgStdCorr}  (양수 = 고점수자가 더 변동 큼)`);

  // ── CSV 출력 ───────────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════════════════");
  console.log("CSV");
  console.log("══════════════════════════════════════════════════════════════════════════════════\n");

  const csvHeader = ["Date", ...PROFILES.map(p => p.label)].join(",");
  console.log(csvHeader);
  for (let i = 0; i < N_DAYS; i++) {
    console.log([dates[i], ...matrix[i]].join(","));
  }

  console.log("\n✅ 완료");
}

main().catch(console.error);
