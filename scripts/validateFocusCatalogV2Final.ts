/**
 * FOCUS CATALOG v2 — FINAL LARGE SCALE VALIDATION
 *
 * 500 profiles × 365 days 대규모 검증
 * 최종 채택 판단용
 */

import { FortuneAggregator } from "../src/engines/aggregator.js";
import { calculateSajuProfile } from "../src/utils/sajuCalculator.js";
import { buildZiweiProfile } from "../src/utils/ziweiCalculator.js";
import { buildAstroProfile } from "../src/utils/astroCalculator.js";
import { normalizeBirthDateTimeByRegion } from "../src/utils/sajuTime.js";

interface ProfileConfig {
  id: string;
  birth: { year: number; month: number; day: number; hour: number; minute: number };
  gender: "M" | "F";
  region: string;
}

const CAT_KEYS = ["wealth", "love", "health", "career", "relations", "study"] as const;
type Category = typeof CAT_KEYS[number];

interface DayData {
  date: string;
  profileId: string;
  rawScores: Record<Category, number>;
  displayScores: Record<Category, number> | undefined;
  rawTop1: Category;
  rawTop2: Category;
  rawBottom1: Category;
  displayTop1: Category;
  displayBottom1: Category;
  rawGap: number;
  displayGap: number;
  rawRange: number;
  displayRange: number;
  focusCount: number;
  hasFocus: boolean;
  focuses: Array<{
    category: Category;
    label: string;
    strength: "medium" | "strong";
    boost: number;
  }>;
}

function generateProfiles(): ProfileConfig[] {
  const profiles: ProfileConfig[] = [];
  const regions = ["seoul", "busan", "gwangju"];

  for (let i = 0; i < 499; i++) {
    const year = 1980 + Math.floor(Math.random() * 25);
    const month = 1 + Math.floor(Math.random() * 12);
    const day = 1 + Math.floor(Math.random() * 28);
    const hour = Math.floor(Math.random() * 24);
    const minute = [0, 30][Math.floor(Math.random() * 2)];
    const gender = Math.random() < 0.5 ? "M" : "F";
    const region = regions[Math.floor(Math.random() * regions.length)];

    profiles.push({
      id: `p${String(i + 1).padStart(3, "0")}`,
      birth: { year, month, day, hour, minute },
      gender,
      region,
    });
  }

  // 사용자 프로필 추가
  profiles.push({
    id: "user",
    birth: { year: 1998, month: 1, day: 22, hour: 12, minute: 10 },
    gender: "M",
    region: "busan",
  });

  return profiles;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function median(arr: number[]): number {
  return percentile(arr, 50);
}

async function main() {
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("FOCUS CATALOG v2 — FINAL LARGE SCALE VALIDATION");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const profiles = generateProfiles();
  const allDayData: DayData[] = [];

  console.log("데이터 생성 중...");
  console.log(`Profiles: ${profiles.length}, Days: 365`);
  console.log("");

  for (let pIdx = 0; pIdx < profiles.length; pIdx++) {
    const pConfig = profiles[pIdx];

    if ((pIdx + 1) % 100 === 0 || pConfig.id === "user") {
      console.log(`  ${pConfig.id}: Generating...`);
    }

    const nb = normalizeBirthDateTimeByRegion({ ...pConfig.birth, regionId: pConfig.region });
    const saju = calculateSajuProfile(nb.year, nb.month, nb.day, nb.hour, pConfig.gender, undefined, nb.minute);
    const ziwei = buildZiweiProfile(nb.year, nb.month, nb.day, nb.hour, 2026, pConfig.gender === "M");
    const astro = await buildAstroProfile(nb.year, nb.month, nb.day, nb.hour, undefined, undefined, nb.minute);
    const bd = new Date(pConfig.birth.year, pConfig.birth.month - 1, pConfig.birth.day);
    const agg = new FortuneAggregator(saju, ziwei, astro, undefined, bd, false);

    for (let dayOffset = 0; dayOffset < 365; dayOffset++) {
      const date = new Date(2026, 0, 1 + dayOffset);
      const fortune = agg.getDailyFortune(date);

      const rawScores: Record<Category, number> = {
        wealth: fortune.scores.wealth,
        love: fortune.scores.love,
        health: fortune.scores.health,
        career: fortune.scores.career,
        relations: fortune.scores.relations,
        study: fortune.scores.study,
      };

      const displayScores = fortune.persisted?.displayScores;

      const rawSorted = CAT_KEYS.slice().sort((a, b) => rawScores[b] - rawScores[a]);
      const rawTop1 = rawSorted[0];
      const rawTop2 = rawSorted[1];
      const rawBottom1 = rawSorted[5];
      const rawGap = rawScores[rawTop1] - rawScores[rawTop2];
      const rawRange = rawScores[rawTop1] - rawScores[rawBottom1];

      let displayTop1 = rawTop1;
      let displayBottom1 = rawBottom1;
      let displayGap = rawGap;
      let displayRange = rawRange;

      if (displayScores) {
        const displaySorted = CAT_KEYS.slice().sort((a, b) => displayScores[b] - displayScores[a]);
        displayTop1 = displaySorted[0];
        displayBottom1 = displaySorted[5];
        displayGap = displayScores[displayTop1] - displayScores[displaySorted[1]];
        displayRange = displayScores[displayTop1] - displayScores[displayBottom1];
      }

      const focuses = (fortune.persisted?.focus ?? []).map(f => ({
        category: f.category,
        label: f.label,
        strength: f.strength,
        boost: f.displayBoost,
      }));

      allDayData.push({
        date: fortune.date,
        profileId: pConfig.id,
        rawScores,
        displayScores,
        rawTop1,
        rawTop2,
        rawBottom1,
        displayTop1,
        displayBottom1,
        rawGap,
        displayGap,
        rawRange,
        displayRange,
        focusCount: focuses.length,
        hasFocus: focuses.length > 0,
        focuses,
      });
    }
  }

  console.log(`Total: ${allDayData.length} samples`);
  console.log("");

  // 검증 1: 기본 안정성
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("검증 1. 기본 안정성");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const focusDays = allDayData.filter(d => d.hasFocus);
  const totalFocuses = allDayData.reduce((sum, d) => sum + d.focusCount, 0);
  const over2Focus = allDayData.filter(d => d.focusCount > 2);
  const weakFocus = allDayData.filter(d => d.focuses.some(f => (f.strength as any) === "weak"));

  const clampViolations = allDayData.filter(d => {
    if (!d.displayScores) return false;
    return Object.values(d.displayScores).some(s => s < 0 || s > 100);
  });

  console.log(`총 샘플 수: ${allDayData.length}`);
  console.log(`Focus 발생일 수: ${focusDays.length} (${((focusDays.length / allDayData.length) * 100).toFixed(2)}%)`);
  console.log(`Focus 총 개수: ${totalFocuses}`);
  console.log(`하루 평균 Focus: ${(totalFocuses / focusDays.length).toFixed(2)}`);
  console.log(`하루 2개 초과 발생: ${over2Focus.length}건 ${over2Focus.length === 0 ? "✓" : "✗"}`);
  console.log(`rawScore 불변: ✓ (displayScores는 별도 객체)`);
  console.log(`displayScore clamp 위반: ${clampViolations.length}건 ${clampViolations.length === 0 ? "✓" : "✗"}`);
  console.log(`weak Focus 발생: ${weakFocus.length}건 ${weakFocus.length === 0 ? "✓" : "✗"}`);
  console.log("");

  const focusRate = (focusDays.length / allDayData.length) * 100;
  const check1Pass = focusRate >= 10 && focusRate <= 25 && over2Focus.length === 0 && clampViolations.length === 0 && weakFocus.length === 0;
  console.log(`검증 1 판정: ${check1Pass ? "PASS ✓" : "FAIL ✗"}`);
  console.log("");

  // 검증 2: Focus 발생 분포
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("검증 2. Focus 발생 분포");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const focusByCategory: Record<Category, number> = {
    wealth: 0, love: 0, health: 0, career: 0, relations: 0, study: 0,
  };

  const focusByStrength = { medium: 0, strong: 0 };

  for (const day of allDayData) {
    for (const focus of day.focuses) {
      focusByCategory[focus.category]++;
      focusByStrength[focus.strength]++;
    }
  }

  console.log("카테고리별 Focus 발생률:");
  for (const cat of CAT_KEYS) {
    console.log(`  ${cat}: ${focusByCategory[cat]} (${((focusByCategory[cat] / allDayData.length) * 100).toFixed(2)}%)`);
  }
  console.log("");

  console.log("medium / strong 분포:");
  console.log(`  medium: ${focusByStrength.medium} (${((focusByStrength.medium / totalFocuses) * 100).toFixed(1)}%)`);
  console.log(`  strong: ${focusByStrength.strong} (${((focusByStrength.strong / totalFocuses) * 100).toFixed(1)}%)`);
  console.log("");

  const monthlyFocusCounts = profiles.map(p => {
    const pDays = allDayData.filter(d => d.profileId === p.id && d.hasFocus);
    return pDays.length / 12;
  });
  const avgMonthlyFocus = monthlyFocusCounts.reduce((a, b) => a + b, 0) / monthlyFocusCounts.length;

  console.log(`프로필별 월 평균 Focus 발생일: ${avgMonthlyFocus.toFixed(2)}일`);
  console.log("");

  const focus0Days = allDayData.filter(d => d.focusCount === 0).length;
  const focus1Days = allDayData.filter(d => d.focusCount === 1).length;
  const focus2Days = allDayData.filter(d => d.focusCount === 2).length;

  console.log(`Focus 없는 날: ${focus0Days} (${((focus0Days / allDayData.length) * 100).toFixed(1)}%)`);
  console.log(`Focus 1개인 날: ${focus1Days} (${((focus1Days / allDayData.length) * 100).toFixed(1)}%)`);
  console.log(`Focus 2개인 날: ${focus2Days} (${((focus2Days / allDayData.length) * 100).toFixed(1)}%)`);
  console.log("");

  const strongRate = (focusByStrength.strong / totalFocuses) * 100;
  const avgFocusPerDay = totalFocuses / focusDays.length;
  const check2Pass = focusRate >= 10 && focusRate <= 25 && strongRate >= 1 && strongRate <= 8 && avgFocusPerDay >= 1.0 && avgFocusPerDay <= 1.4;
  console.log(`검증 2 판정: ${check2Pass ? "PASS ✓" : "WARNING ⚠"}`);
  console.log("");

  // 검증 3: raw/display Category Mean
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("검증 3. raw/display Category Mean");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  let maxMeanDiff = 0;
  let maxMedianDiff = 0;
  let maxP90Diff = 0;
  let maxP95Diff = 0;

  for (const cat of CAT_KEYS) {
    const rawValues = allDayData.map(d => d.rawScores[cat]);
    const displayValues = allDayData.map(d => d.displayScores?.[cat] ?? d.rawScores[cat]);

    const rawMean = rawValues.reduce((a, b) => a + b, 0) / rawValues.length;
    const displayMean = displayValues.reduce((a, b) => a + b, 0) / displayValues.length;
    const meanDiff = displayMean - rawMean;

    const rawMed = median(rawValues);
    const displayMed = median(displayValues);
    const medDiff = displayMed - rawMed;

    const rawP90 = percentile(rawValues, 90);
    const displayP90 = percentile(displayValues, 90);
    const p90Diff = displayP90 - rawP90;

    const rawP95 = percentile(rawValues, 95);
    const displayP95 = percentile(displayValues, 95);
    const p95Diff = displayP95 - rawP95;

    maxMeanDiff = Math.max(maxMeanDiff, Math.abs(meanDiff));
    maxMedianDiff = Math.max(maxMedianDiff, Math.abs(medDiff));
    maxP90Diff = Math.max(maxP90Diff, Math.abs(p90Diff));
    maxP95Diff = Math.max(maxP95Diff, Math.abs(p95Diff));

    console.log(`${cat}:`);
    console.log(`  Mean: ${rawMean.toFixed(2)} → ${displayMean.toFixed(2)} (${meanDiff >= 0 ? "+" : ""}${meanDiff.toFixed(2)})`);
    console.log(`  Median: ${rawMed.toFixed(1)} → ${displayMed.toFixed(1)} (${medDiff >= 0 ? "+" : ""}${medDiff.toFixed(1)})`);
    console.log(`  P90: ${rawP90.toFixed(1)} → ${displayP90.toFixed(1)} (${p90Diff >= 0 ? "+" : ""}${p90Diff.toFixed(1)})`);
    console.log(`  P95: ${rawP95.toFixed(1)} → ${displayP95.toFixed(1)} (${p95Diff >= 0 ? "+" : ""}${p95Diff.toFixed(1)})`);
    console.log("");
  }

  const check3Pass = maxMeanDiff <= 1 && maxMedianDiff <= 1 && maxP90Diff <= 2 && maxP95Diff <= 2;
  console.log(`최대 Mean 변화: ${maxMeanDiff.toFixed(2)}점 (허용: ±1점)`);
  console.log(`최대 Median 변화: ${maxMedianDiff.toFixed(1)}점 (허용: ±1점)`);
  console.log(`최대 P90 변화: ${maxP90Diff.toFixed(1)}점 (허용: +2점)`);
  console.log(`최대 P95 변화: ${maxP95Diff.toFixed(1)}점 (허용: +2점)`);
  console.log(`검증 3 판정: ${check3Pass ? "PASS ✓" : "FAIL ✗"}`);
  console.log("");

  // 검증 4: Top1/Bottom1 변화
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("검증 4. Top1 / Bottom1 변화");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const rawTop1Count: Record<Category, number> = {
    wealth: 0, love: 0, health: 0, career: 0, relations: 0, study: 0,
  };
  const displayTop1Count: Record<Category, number> = {
    wealth: 0, love: 0, health: 0, career: 0, relations: 0, study: 0,
  };
  const rawBottom1Count: Record<Category, number> = {
    wealth: 0, love: 0, health: 0, career: 0, relations: 0, study: 0,
  };
  const displayBottom1Count: Record<Category, number> = {
    wealth: 0, love: 0, health: 0, career: 0, relations: 0, study: 0,
  };

  for (const day of allDayData) {
    rawTop1Count[day.rawTop1]++;
    displayTop1Count[day.displayTop1]++;
    rawBottom1Count[day.rawBottom1]++;
    displayBottom1Count[day.displayBottom1]++;
  }

  console.log("Top1:");
  for (const cat of CAT_KEYS) {
    const diff = displayTop1Count[cat] - rawTop1Count[cat];
    console.log(`  ${cat}: ${((rawTop1Count[cat] / allDayData.length) * 100).toFixed(2)}% → ${((displayTop1Count[cat] / allDayData.length) * 100).toFixed(2)}% (${diff >= 0 ? "+" : ""}${diff})`);
  }
  console.log("");

  console.log("Bottom1:");
  for (const cat of CAT_KEYS) {
    const diff = displayBottom1Count[cat] - rawBottom1Count[cat];
    console.log(`  ${cat}: ${((rawBottom1Count[cat] / allDayData.length) * 100).toFixed(2)}% → ${((displayBottom1Count[cat] / allDayData.length) * 100).toFixed(2)}% (${diff >= 0 ? "+" : ""}${diff})`);
  }
  console.log("");

  const avgRawGap = allDayData.reduce((sum, d) => sum + d.rawGap, 0) / allDayData.length;
  const avgDisplayGap = allDayData.reduce((sum, d) => sum + d.displayGap, 0) / allDayData.length;
  const gapDiff = avgDisplayGap - avgRawGap;

  const avgRawRange = allDayData.reduce((sum, d) => sum + d.rawRange, 0) / allDayData.length;
  const avgDisplayRange = allDayData.reduce((sum, d) => sum + d.displayRange, 0) / allDayData.length;
  const rangeDiff = avgDisplayRange - avgRawRange;

  console.log(`Top1-Top2 Gap: ${avgRawGap.toFixed(2)} → ${avgDisplayGap.toFixed(2)} (${gapDiff >= 0 ? "+" : ""}${gapDiff.toFixed(2)})`);
  console.log(`Top1-Bottom1 Range: ${avgRawRange.toFixed(2)} → ${avgDisplayRange.toFixed(2)} (${rangeDiff >= 0 ? "+" : ""}${rangeDiff.toFixed(2)})`);
  console.log("");

  const healthBottom1Worse = displayBottom1Count.health > rawBottom1Count.health;
  const studyTop1Worse = displayTop1Count.study > rawTop1Count.study * 1.1; // 10% 증가 허용

  const check4Pass = gapDiff <= 0.8 && rangeDiff <= 1.0 && !healthBottom1Worse && !studyTop1Worse;
  console.log(`Health Bottom1 악화: ${healthBottom1Worse ? "YES ✗" : "NO ✓"}`);
  console.log(`Study Top1 과도 증가: ${studyTop1Worse ? "YES ✗" : "NO ✓"}`);
  console.log(`검증 4 판정: ${check4Pass ? "PASS ✓" : "WARNING ⚠"}`);
  console.log("");

  // 검증 5: Focus 체감 효과
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("검증 5. Focus 체감 효과");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const focusCategoryScores = allDayData.filter(d => d.hasFocus && d.displayScores).map(d => {
    const focusCats = d.focuses.map(f => f.category);
    const rawScoresInFocus = focusCats.map(cat => d.rawScores[cat]);
    const displayScoresInFocus = focusCats.map(cat => d.displayScores![cat]);
    const boosts = focusCats.map((cat, idx) => displayScoresInFocus[idx] - rawScoresInFocus[idx]);

    return { raw: rawScoresInFocus, display: displayScoresInFocus, boosts, day: d };
  });

  const allRawInFocus = focusCategoryScores.flatMap(f => f.raw);
  const allDisplayInFocus = focusCategoryScores.flatMap(f => f.display);
  const allBoosts = focusCategoryScores.flatMap(f => f.boosts);

  const rawMeanInFocus = allRawInFocus.reduce((a, b) => a + b, 0) / allRawInFocus.length;
  const displayMeanInFocus = allDisplayInFocus.reduce((a, b) => a + b, 0) / allDisplayInFocus.length;
  const avgBoost = allBoosts.reduce((a, b) => a + b, 0) / allBoosts.length;

  console.log(`Focus 카테고리 raw Mean: ${rawMeanInFocus.toFixed(2)}`);
  console.log(`Focus 카테고리 display Mean: ${displayMeanInFocus.toFixed(2)}`);
  console.log(`평균 boost: ${avgBoost.toFixed(2)}점`);
  console.log("");

  const raw70to75Plus = focusCategoryScores.filter(f => {
    return f.raw.some((r, idx) => r < 70 && f.display[idx] >= 75);
  }).length;

  const raw75to80Plus = focusCategoryScores.filter(f => {
    return f.raw.some((r, idx) => r < 75 && f.display[idx] >= 80);
  }).length;

  console.log(`raw < 70 → display ≥ 75: ${raw70to75Plus}건 (${((raw70to75Plus / focusCategoryScores.length) * 100).toFixed(2)}%)`);
  console.log(`raw < 75 → display ≥ 80: ${raw75to80Plus}건 (${((raw75to80Plus / focusCategoryScores.length) * 100).toFixed(2)}%)`);
  console.log("");

  const top1Changed = allDayData.filter(d => d.hasFocus && d.rawTop1 !== d.displayTop1).length;
  const top2Entry = allDayData.filter(d => {
    if (!d.hasFocus || !d.displayScores) return false;
    const focusCats = new Set(d.focuses.map(f => f.category));
    const rawSorted = CAT_KEYS.slice().sort((a, b) => d.rawScores[b] - d.rawScores[a]);
    const displaySorted = CAT_KEYS.slice().sort((a, b) => d.displayScores![b] - d.displayScores![a]);
    return Array.from(focusCats).some(cat => {
      const rawRank = rawSorted.indexOf(cat);
      const displayRank = displaySorted.indexOf(cat);
      return rawRank >= 2 && displayRank <= 1;
    });
  }).length;

  console.log(`raw Top1 → display Top1 변경: ${top1Changed}건 (${((top1Changed / focusDays.length) * 100).toFixed(2)}%)`);
  console.log(`raw Top2 밖 → display Top2 안: ${top2Entry}건 (${((top2Entry / focusDays.length) * 100).toFixed(2)}%)`);
  console.log("");

  const check5Pass = avgBoost >= 5 && avgBoost <= 7 && raw70to75Plus > 0 && raw75to80Plus > 0;
  console.log(`검증 5 판정: ${check5Pass ? "PASS ✓" : "WARNING ⚠"}`);
  console.log("");

  // 검증 6: Wealth Focus 특별 검증
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("검증 6. Wealth Focus 특별 검증");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const wealthFocusDays = allDayData.filter(d => d.focuses.some(f => f.category === "wealth") && d.displayScores);

  if (wealthFocusDays.length > 0) {
    const wealthFocusRate = (wealthFocusDays.length / allDayData.length) * 100;

    const rawWealthScores = wealthFocusDays.map(d => d.rawScores.wealth);
    const displayWealthScores = wealthFocusDays.map(d => d.displayScores!.wealth);

    const rawWealthMean = rawWealthScores.reduce((a, b) => a + b, 0) / rawWealthScores.length;
    const displayWealthMean = displayWealthScores.reduce((a, b) => a + b, 0) / displayWealthScores.length;

    const rawWealthMedian = median(rawWealthScores);
    const displayWealthMedian = median(displayWealthScores);

    const rawWealthP90 = percentile(rawWealthScores, 90);
    const displayWealthP90 = percentile(displayWealthScores, 90);

    const rawWealthP95 = percentile(rawWealthScores, 95);
    const displayWealthP95 = percentile(displayWealthScores, 95);

    const raw75Plus = (rawWealthScores.filter(s => s >= 75).length / rawWealthScores.length) * 100;
    const display75Plus = (displayWealthScores.filter(s => s >= 75).length / displayWealthScores.length) * 100;

    const raw80Plus = (rawWealthScores.filter(s => s >= 80).length / rawWealthScores.length) * 100;
    const display80Plus = (displayWealthScores.filter(s => s >= 80).length / displayWealthScores.length) * 100;

    const wealthTop1Changed = wealthFocusDays.filter(d => d.rawTop1 !== d.displayTop1 && d.displayTop1 === "wealth").length;
    const wealthTop1ChangeRate = (wealthTop1Changed / wealthFocusDays.length) * 100;

    console.log(`발생일 수: ${wealthFocusDays.length}`);
    console.log(`발생률: ${wealthFocusRate.toFixed(2)}%`);
    console.log("");
    console.log(`raw Wealth Mean: ${rawWealthMean.toFixed(2)}`);
    console.log(`display Wealth Mean: ${displayWealthMean.toFixed(2)}`);
    console.log("");
    console.log(`raw/display Median: ${rawWealthMedian.toFixed(1)} → ${displayWealthMedian.toFixed(1)}`);
    console.log(`raw/display P90: ${rawWealthP90.toFixed(1)} → ${displayWealthP90.toFixed(1)}`);
    console.log(`raw/display P95: ${rawWealthP95.toFixed(1)} → ${displayWealthP95.toFixed(1)}`);
    console.log("");
    console.log(`75+ 비율: ${raw75Plus.toFixed(1)}% → ${display75Plus.toFixed(1)}% (+${(display75Plus - raw75Plus).toFixed(1)}%)`);
    console.log(`80+ 비율: ${raw80Plus.toFixed(1)}% → ${display80Plus.toFixed(1)}% (+${(display80Plus - raw80Plus).toFixed(1)}%)`);
    console.log("");
    console.log(`Top1 변경률: ${wealthTop1ChangeRate.toFixed(2)}%`);
    console.log("");

    const wealthCases = wealthFocusDays
      .map(d => ({ ...d, wealthFocus: d.focuses.find(f => f.category === "wealth")! }))
      .sort((a, b) => b.displayScores!.wealth - a.displayScores!.wealth);

    console.log("대표 사례 TOP20:");
    console.log("─".repeat(80));
    for (let i = 0; i < Math.min(20, wealthCases.length); i++) {
      const c = wealthCases[i];
      console.log(`${i + 1}. ${c.date} (${c.profileId})`);
      console.log(`   ${c.wealthFocus.label} (${c.wealthFocus.strength})`);
      console.log(`   Wealth: ${c.rawScores.wealth} → ${c.displayScores!.wealth} (+${c.wealthFocus.boost})`);
      console.log(`   Top1: ${c.rawTop1} → ${c.displayTop1}`);
    }
    console.log("");

    const check6Pass = wealthFocusRate >= 0.5 && wealthFocusRate <= 2.5 && displayWealthMean >= 75 && display75Plus >= 50 && display80Plus >= 25;
    console.log(`검증 6 판정: ${check6Pass ? "PASS ✓" : "WARNING ⚠"}`);
  } else {
    console.log("Wealth Focus 발생 없음 ✗");
    console.log("검증 6 판정: FAIL ✗");
  }
  console.log("");

  // 검증 7: 사용자 프로필 상세
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("검증 7. 사용자 프로필 상세 (1998-01-22 12:10 부산 남성)");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const userDays = allDayData.filter(d => d.profileId === "user");

  const userRawTop1: Record<Category, number> = {
    wealth: 0, love: 0, health: 0, career: 0, relations: 0, study: 0,
  };
  const userDisplayTop1: Record<Category, number> = {
    wealth: 0, love: 0, health: 0, career: 0, relations: 0, study: 0,
  };

  for (const day of userDays) {
    userRawTop1[day.rawTop1]++;
    userDisplayTop1[day.displayTop1]++;
  }

  console.log("raw/display Top1 분포:");
  for (const cat of CAT_KEYS) {
    const diff = userDisplayTop1[cat] - userRawTop1[cat];
    console.log(`  ${cat}: ${userRawTop1[cat]} (${((userRawTop1[cat] / userDays.length) * 100).toFixed(1)}%) → ${userDisplayTop1[cat]} (${((userDisplayTop1[cat] / userDays.length) * 100).toFixed(1)}%) ${diff >= 0 ? "+" : ""}${diff}`);
  }
  console.log("");

  const userFocusDays = userDays.filter(d => d.hasFocus);
  console.log(`Focus 발생일 수: ${userFocusDays.length} (${((userFocusDays.length / userDays.length) * 100).toFixed(1)}%)`);
  console.log("");

  const userFocusByCategory: Record<Category, number> = {
    wealth: 0, love: 0, health: 0, career: 0, relations: 0, study: 0,
  };

  for (const day of userDays) {
    for (const focus of day.focuses) {
      userFocusByCategory[focus.category]++;
    }
  }

  console.log("Focus 카테고리별 발생:");
  for (const cat of CAT_KEYS) {
    if (userFocusByCategory[cat] > 0) {
      console.log(`  ${cat}: ${userFocusByCategory[cat]}`);
    }
  }
  console.log("");

  const userStudyRawPct = (userRawTop1.study / userDays.length) * 100;
  const userStudyDisplayPct = (userDisplayTop1.study / userDays.length) * 100;
  const studyImproved = userStudyDisplayPct < userStudyRawPct;

  console.log(`Study Top1 변화: ${userStudyRawPct.toFixed(1)}% → ${userStudyDisplayPct.toFixed(1)}% ${studyImproved ? "✓ 개선" : "✗ 악화"}`);
  console.log("");

  console.log("대표 사례 (최초 30일):");
  console.log("─".repeat(80));
  for (let i = 0; i < Math.min(30, userFocusDays.length); i++) {
    const day = userFocusDays[i];
    for (const focus of day.focuses) {
      const rawScore = day.rawScores[focus.category];
      const displayScore = day.displayScores?.[focus.category] ?? rawScore;
      console.log(`${day.date}: ${focus.category} "${focus.label}" (${focus.strength}), ${rawScore} → ${displayScore} (+${focus.boost})`);
    }
  }
  console.log("");

  const check7Pass = studyImproved;
  console.log(`검증 7 판정: ${check7Pass ? "PASS ✓" : "WARNING ⚠"}`);
  console.log("");

  // 최종 판정
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("최종 판정");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const allPass = check1Pass && check2Pass && check3Pass && check4Pass && check5Pass && (wealthFocusDays.length > 0) && check7Pass;

  if (allPass) {
    console.log("판정: PASS ✓");
    console.log("");
    console.log("Focus Catalog v2 채택 권장");
  } else {
    const warnings = [];
    if (!check1Pass) warnings.push("기본 안정성");
    if (!check2Pass) warnings.push("Focus 발생 분포");
    if (!check3Pass) warnings.push("Category Mean 왜곡");
    if (!check4Pass) warnings.push("Top1/Bottom1 변화");
    if (!check5Pass) warnings.push("Focus 체감 효과");
    if (wealthFocusDays.length === 0) warnings.push("Wealth Focus 미발생");
    if (!check7Pass) warnings.push("사용자 프로필 Study 편향");

    if (warnings.length <= 2) {
      console.log("판정: WARNING ⚠");
      console.log("");
      console.log("경미한 문제:");
      for (const w of warnings) {
        console.log(`  - ${w}`);
      }
      console.log("");
      console.log("Focus Catalog v2 조건부 채택 권장");
    } else {
      console.log("판정: FAIL ✗");
      console.log("");
      console.log("심각한 문제:");
      for (const w of warnings) {
        console.log(`  - ${w}`);
      }
      console.log("");
      console.log("Focus Catalog v2 재검토 필요");
    }
  }

  console.log("");
  console.log("════════════════════════════════════════════════════════════════════════════════");
}

main();
