/**
 * signalLayer 검증 — 5일 샘플 상세 + 10일 request 요약
 * Usage: npx tsx scripts/testSignalLayer.ts
 *
 * P1: 1998-01-22 12:10 부산 남자 — 2026-05
 */
import { calculateSajuProfile }           from "../src/utils/sajuCalculator";
import { buildZiweiProfile }              from "../src/utils/ziweiCalculator";
import { buildAstroProfile }              from "../src/utils/astroCalculator";
import { normalizeBirthDateTimeByRegion } from "../src/utils/sajuTime";
import { FortuneAggregator }              from "../src/engines/aggregator";
import { buildAiDailyRequest }            from "../src/ai/buildAiDailyRequest";
import type { MonthContext }              from "../src/ai/buildAiDailyRequest";

// ── NORM_67+5 ─────────────────────────────────────────────────────────────────
const NORM_TARGET  = 67;
const NORM_MAX_OFF = 6;
const DISPLAY_ADD  = 5;

function applyNorm(rawScores: number[]): number[] {
  const avg = rawScores.reduce((s, x) => s + x, 0) / rawScores.length;
  const off = Math.max(-NORM_MAX_OFF, Math.min(NORM_MAX_OFF, NORM_TARGET - avg));
  return rawScores.map(r => Math.round(Math.max(0, Math.min(100, r + off + DISPLAY_ADD))));
}

function computeFlowType(displayScores: number[]): string {
  const n = displayScores.length;
  if (n < 2) return "안정형";
  const first10 = displayScores.slice(0, Math.min(10, n));
  const last10  = displayScores.slice(Math.max(0, n - 10));
  const avg10   = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
  const trend   = avg10(last10) - avg10(first10);
  if (trend >= 6)  return "상승형";
  if (trend <= -6) return "하강형";
  const goldCount = displayScores.filter(s => s >= 85).length;
  if (goldCount / n >= 0.15) return "집중형";
  const mean = displayScores.reduce((s, x) => s + x, 0) / n;
  const std  = Math.sqrt(displayScores.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
  if (std < 7) return "안정형";
  return "변화형";
}

// ── 프로필 ─────────────────────────────────────────────────────────────────────
const BIRTH = { year: 1998, month: 1, day: 22, hour: 12, minute: 10 };
const GENDER = "M" as const;
const REGION = "busan";
const TEST_YEAR = 2026, TEST_MONTH = 5;

const line = "══════════════════════════════════════════════════════════════════";
const dash = "──────────────────────────────────────────────────────────────────";

async function main() {
  const nb = normalizeBirthDateTimeByRegion({
    year: BIRTH.year, month: BIRTH.month, day: BIRTH.day,
    hour: BIRTH.hour, minute: BIRTH.minute, regionId: REGION,
  });

  const saju  = calculateSajuProfile(nb.year, nb.month, nb.day, nb.hour, GENDER, undefined, nb.minute);
  const ziwei = buildZiweiProfile(nb.year, nb.month, nb.day, nb.hour, TEST_YEAR, true);
  const astro = await buildAstroProfile(nb.year, nb.month, nb.day, nb.hour, undefined, undefined, nb.minute);
  const birthDate = new Date(BIRTH.year, BIRTH.month - 1, BIRTH.day);

  const agg = new FortuneAggregator(saju, ziwei, astro, undefined, birthDate, true);
  const res = agg.getMonthlyFortune(TEST_YEAR, TEST_MONTH);

  const rawScores  = res.daily_fortunes.map(f => f.scores.overall as number);
  const dispScores = applyNorm(rawScores);

  const monthCtx: MonthContext = {
    displayScores: dispScores,
    flowType: computeFlowType(dispScores),
    palace:   res.monthly_palace,
  };

  // dispScores를 fortune 객체에 주입 (buildAiDailyRequest가 fortune.scores.overall을 씀)
  const fortunes = res.daily_fortunes.map((f, i) => ({
    ...f,
    scores: { ...f.scores, overall: dispScores[i] },
  }));

  console.log(`\n=== signalLayer 검증 — ${TEST_YEAR}-${String(TEST_MONTH).padStart(2,"0")} ===`);
  console.log(`프로필: ${BIRTH.year}M 부산  |  활성궁: ${monthCtx.palace}  |  흐름: ${monthCtx.flowType}`);
  console.log(`display 평균: ${Math.round(dispScores.reduce((s,x)=>s+x,0)/dispScores.length)}  |  범위: ${Math.min(...dispScores)} ~ ${Math.max(...dispScores)}\n`);

  // ── 항목 1: 5일 상세 샘플 ──────────────────────────────────────────────────
  console.log(line);
  console.log("항목 1: 5일 상세 샘플 (전체 signalLayer 필드 확인)");
  console.log(line);

  // 의미 있는 날 선택: 최고, 최저, 상승, 하강, 피크/밸리
  const maxScore = Math.max(...dispScores);
  const minScore = Math.min(...dispScores);
  const maxIdx   = dispScores.indexOf(maxScore);
  const minIdx   = dispScores.indexOf(minScore);

  // 상승이 큰 날 찾기
  let riseIdx = -1, maxRise = 0;
  for (let i = 1; i < dispScores.length; i++) {
    const d = dispScores[i] - dispScores[i-1];
    if (d > maxRise) { maxRise = d; riseIdx = i; }
  }
  // 하락이 큰 날 찾기
  let dropIdx = -1, maxDrop = 0;
  for (let i = 1; i < dispScores.length; i++) {
    const d = dispScores[i-1] - dispScores[i];
    if (d > maxDrop) { maxDrop = d; dropIdx = i; }
  }
  // 15일 (월 중간)
  const midIdx = 14;

  const sampleIdxs = [...new Set([maxIdx, minIdx, riseIdx, dropIdx, midIdx])].slice(0, 5);

  for (const idx of sampleIdxs) {
    const fortune = fortunes[idx];
    const req     = buildAiDailyRequest(fortune, monthCtx);
    const sl      = req.signalLayer!;
    const prev    = idx > 0 ? dispScores[idx - 1] : undefined;
    const next    = idx < dispScores.length - 1 ? dispScores[idx + 1] : undefined;

    console.log(`\n  날짜: ${fortune.date}  (day ${idx + 1})`);
    console.log(`  score: ${dispScores[idx]}  |  prev: ${prev ?? "-"}  |  next: ${next ?? "-"}`);
    console.log(`  monthlyFlowType: ${sl.monthlyFlowType ?? "-"}`);
    console.log(`  monthlyPalace:   ${sl.monthlyPalace?.label ?? "-"}`);

    const mp = sl.monthPosition!;
    console.log(`  monthPosition:`);
    console.log(`    rank ${mp.rank}/${mp.totalDays}  percentile ${mp.percentile}%`);
    console.log(`    isMonthlyHigh=${mp.isMonthlyHigh}  isMonthlyLow=${mp.isMonthlyLow}`);
    console.log(`    isTop10%=${mp.isTop10Percent}  isBottom10%=${mp.isBottom10Percent}`);

    const dc = sl.dailyCompare!;
    console.log(`  dailyCompare:`);
    console.log(`    prevDiff=${dc.prevDiff ?? "-"}  nextDiff=${dc.nextDiff ?? "-"}`);
    console.log(`    isRiseFromPrev=${dc.isRiseFromPrev}  isDropFromPrev=${dc.isDropFromPrev}`);
    console.log(`    isRiseToNext=${dc.isRiseToNext}  isDropToNext=${dc.isDropToNext}`);
    console.log(`    isPeak=${dc.isPeak}  isValley=${dc.isValley}`);
  }

  // ── 항목 2: 10일 request 요약 ─────────────────────────────────────────────
  console.log(`\n${line}`);
  console.log("항목 2: 10일 AI request 요약 (1~10일)");
  console.log(`${"날짜".padEnd(12)} ${"점수".padStart(5)} ${"rank".padStart(5)} ${"pct".padStart(4)} ${"high".padStart(4)} ${"low".padStart(4)} ${"top10".padStart(6)} ${"bot10".padStart(6)} ${"rise<".padStart(6)} ${"drop<".padStart(6)} ${"rise>".padStart(6)} ${"drop>".padStart(6)} ${"peak".padStart(5)} ${"val".padStart(4)}`);
  console.log(dash);
  console.log(line);

  for (let i = 0; i < Math.min(10, fortunes.length); i++) {
    const fortune = fortunes[i];
    const req = buildAiDailyRequest(fortune, monthCtx);
    const sl  = req.signalLayer!;
    const mp  = sl.monthPosition!;
    const dc  = sl.dailyCompare!;

    const tf = (v: boolean) => v ? "Y" : "-";
    console.log(
      `${fortune.date.padEnd(12)} ${String(dispScores[i]).padStart(5)} ${String(mp.rank).padStart(5)}` +
      ` ${String(mp.percentile).padStart(4)}%` +
      ` ${tf(mp.isMonthlyHigh).padStart(4)} ${tf(mp.isMonthlyLow).padStart(4)}` +
      ` ${tf(mp.isTop10Percent).padStart(6)} ${tf(mp.isBottom10Percent).padStart(6)}` +
      ` ${tf(dc.isRiseFromPrev).padStart(6)} ${tf(dc.isDropFromPrev).padStart(6)}` +
      ` ${tf(dc.isRiseToNext).padStart(6)} ${tf(dc.isDropToNext).padStart(6)}` +
      ` ${tf(dc.isPeak).padStart(5)} ${tf(dc.isValley).padStart(4)}`
    );
  }

  // ── 항목 3: 규칙 준수 확인 ────────────────────────────────────────────────
  console.log(`\n${line}`);
  console.log("항목 3: 규칙 준수 체크 (전월 31일 전체)");
  console.log(line);

  let flowTypeMentioned = 0;
  let palaceCentral     = 0;
  const signalCounts = { rise: 0, drop: 0, peak: 0, valley: 0, monthlyHigh: 0, monthlyLow: 0, top10: 0, bot10: 0 };

  for (let i = 0; i < fortunes.length; i++) {
    const req = buildAiDailyRequest(fortunes[i], monthCtx);
    const sl  = req.signalLayer!;
    const mp  = sl.monthPosition!;
    const dc  = sl.dailyCompare!;

    // dailyCompare 신호가 있는데 flowType도 있는 경우 — 규칙1 위반 감지 용도
    const hasDailySignal = dc.isRiseFromPrev || dc.isDropFromPrev || dc.isRiseToNext || dc.isDropToNext || dc.isPeak || dc.isValley;
    if (sl.monthlyFlowType && !hasDailySignal && !mp.isMonthlyHigh && !mp.isMonthlyLow && !mp.isTop10Percent && !mp.isBottom10Percent) {
      flowTypeMentioned++; // flowType이 노출될 수 있는 날 (특별 위치 아님, dailyCompare 없음)
    }

    if (dc.isRiseFromPrev) signalCounts.rise++;
    if (dc.isDropFromPrev) signalCounts.drop++;
    if (dc.isPeak)         signalCounts.peak++;
    if (dc.isValley)       signalCounts.valley++;
    if (mp.isMonthlyHigh)  signalCounts.monthlyHigh++;
    if (mp.isMonthlyLow)   signalCounts.monthlyLow++;
    if (mp.isTop10Percent)  signalCounts.top10++;
    if (mp.isBottom10Percent) signalCounts.bot10++;
  }

  const T = fortunes.length;
  console.log(`\n  월 흐름 타입: ${monthCtx.flowType}  |  활성궁: ${monthCtx.palace}`);
  console.log(`\n  신호 발생 일수 (${T}일 중):`);
  console.log(`    상승(prevDiff≥10):   ${signalCounts.rise}일  (${Math.round(signalCounts.rise/T*100)}%)`);
  console.log(`    하락(prevDiff≤-10):  ${signalCounts.drop}일  (${Math.round(signalCounts.drop/T*100)}%)`);
  console.log(`    피크(isPeak):         ${signalCounts.peak}일`);
  console.log(`    밸리(isValley):       ${signalCounts.valley}일`);
  console.log(`    월 최고점:            ${signalCounts.monthlyHigh}일`);
  console.log(`    월 최저점:            ${signalCounts.monthlyLow}일`);
  console.log(`    상위 10%:             ${signalCounts.top10}일  (${Math.round(signalCounts.top10/T*100)}%)`);
  console.log(`    하위 10%:             ${signalCounts.bot10}일  (${Math.round(signalCounts.bot10/T*100)}%)`);

  const specialPositionDays = fortunes.filter((_, i) => {
    const req = buildAiDailyRequest(fortunes[i], monthCtx);
    const mp  = req.signalLayer!.monthPosition!;
    return mp.isMonthlyHigh || mp.isMonthlyLow || mp.isTop10Percent || mp.isBottom10Percent;
  }).length;

  console.log(`\n  [규칙 확인]`);
  console.log(`  monthlyFlowType 언급 가능 일수 (특별위치): ${specialPositionDays}일/${T}일`);
  console.log(`  monthlyFlowType 단독 노출 위험 일수: ${flowTypeMentioned}일 (dailyCompare 없음 + 특별위치 아님)`);
  console.log(`  → 이 날들은 prompt 규칙상 flowType 미언급 대상`);

  console.log("\n✅ 완료");
}

main().catch(console.error);
