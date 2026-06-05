/**
 * VARIANCE & INTEREST AUDIT
 *
 * 목표: 사용자가 실제로 재미를 느낄 정도의 변동성이 존재하는가
 *
 * 검증:
 * 1. 한 달 안에서 점수가 적당히 움직이는가
 * 2. 하루 안에서 카테고리 차이가 적당히 보이는가
 * 3. Focus 발생일이 실제로 특별하게 보이는가
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
  overall: number;
  categoryScores: Record<Category, number>;
  hasFocus: boolean;
  focusStrength?: "medium" | "strong";
  categoryRange: number;
  categoryStdDev: number;
}

interface ProfileVariance {
  profileId: string;
  overallMean: number;
  overallMedian: number;
  overallStdDev: number;
  yearlyMax: number;
  yearlyMin: number;
  yearlyRange: number;
  avgDayToDayDiff: number;
  avgCategoryRange: number;
  avgCategoryStdDev: number;
  days: DayData[];
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

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length === 0) return 0;
  const m = mean(arr);
  const variance = arr.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

function categoryStdDev(scores: Record<Category, number>): number {
  const values = CAT_KEYS.map(k => scores[k]);
  return stdDev(values);
}

function categoryRange(scores: Record<Category, number>): number {
  const values = CAT_KEYS.map(k => scores[k]);
  return Math.max(...values) - Math.min(...values);
}

async function main() {
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("VARIANCE & INTEREST AUDIT");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");
  console.log("목표: 사용자가 실제로 재미를 느낄 정도의 변동성이 존재하는가");
  console.log("");

  const profiles = generateProfiles();
  const profileVariances: ProfileVariance[] = [];

  console.log("데이터 생성 중...");
  console.log(`Profiles: ${profiles.length}, Days: 365`);
  console.log("");

  for (let pIdx = 0; pIdx < profiles.length; pIdx++) {
    const pConfig = profiles[pIdx];

    if ((pIdx + 1) % 100 === 0 || pConfig.id === "user") {
      console.log(`  ${pConfig.id}: Analyzing...`);
    }

    const nb = normalizeBirthDateTimeByRegion({ ...pConfig.birth, regionId: pConfig.region });
    const saju = calculateSajuProfile(nb.year, nb.month, nb.day, nb.hour, pConfig.gender, undefined, nb.minute);
    const ziwei = buildZiweiProfile(nb.year, nb.month, nb.day, nb.hour, 2026, pConfig.gender === "M");
    const astro = await buildAstroProfile(nb.year, nb.month, nb.day, nb.hour, undefined, undefined, nb.minute);
    const bd = new Date(pConfig.birth.year, pConfig.birth.month - 1, pConfig.birth.day);
    const agg = new FortuneAggregator(saju, ziwei, astro, undefined, bd, false);

    const days: DayData[] = [];

    for (let dayOffset = 0; dayOffset < 365; dayOffset++) {
      const date = new Date(2026, 0, 1 + dayOffset);
      const fortune = agg.getDailyFortune(date);

      const scores = fortune.persisted?.displayScores ?? fortune.scores;
      const hasFocus = (fortune.persisted?.focus?.length ?? 0) > 0;
      const focusStrength = fortune.persisted?.focus?.[0]?.strength;

      days.push({
        date: fortune.date,
        overall: scores.overall ?? 0,
        categoryScores: {
          wealth: scores.wealth,
          love: scores.love,
          health: scores.health,
          career: scores.career,
          relations: scores.relations,
          study: scores.study,
        },
        hasFocus,
        focusStrength,
        categoryRange: categoryRange(scores),
        categoryStdDev: categoryStdDev(scores),
      });
    }

    const overalls = days.map(d => d.overall);
    const overallMean = mean(overalls);
    const overallMedian = median(overalls);
    const overallStdDev = stdDev(overalls);
    const yearlyMax = Math.max(...overalls);
    const yearlyMin = Math.min(...overalls);
    const yearlyRange = yearlyMax - yearlyMin;

    const dayToDayDiffs: number[] = [];
    for (let i = 1; i < days.length; i++) {
      dayToDayDiffs.push(Math.abs(days[i].overall - days[i - 1].overall));
    }
    const avgDayToDayDiff = mean(dayToDayDiffs);

    const avgCategoryRange = mean(days.map(d => d.categoryRange));
    const avgCategoryStdDev = mean(days.map(d => d.categoryStdDev));

    profileVariances.push({
      profileId: pConfig.id,
      overallMean,
      overallMedian,
      overallStdDev,
      yearlyMax,
      yearlyMin,
      yearlyRange,
      avgDayToDayDiff,
      avgCategoryRange,
      avgCategoryStdDev,
      days,
    });
  }

  console.log(`Total: ${profileVariances.length} profiles`);
  console.log("");

  // PART A: 일간 변동성 (세로축)
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("PART A. 일간 변동성 (세로축)");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const allStdDevs = profileVariances.map(p => p.overallStdDev);
  const allRanges = profileVariances.map(p => p.yearlyRange);

  console.log("전체 통계:");
  console.log("─".repeat(80));
  console.log(`Mean StdDev: ${mean(allStdDevs).toFixed(2)}`);
  console.log(`Median StdDev: ${median(allStdDevs).toFixed(2)}`);
  console.log("");
  console.log(`Mean Range: ${mean(allRanges).toFixed(2)}`);
  console.log(`Median Range: ${median(allRanges).toFixed(2)}`);
  console.log(`P90 Range: ${percentile(allRanges, 90).toFixed(2)}`);
  console.log(`P95 Range: ${percentile(allRanges, 95).toFixed(2)}`);
  console.log("");

  console.log("Range 분포:");
  console.log("─".repeat(80));
  const rangeBins = [
    { min: 0, max: 10, label: "0~10" },
    { min: 10, max: 20, label: "10~20" },
    { min: 20, max: 30, label: "20~30" },
    { min: 30, max: 40, label: "30~40" },
    { min: 40, max: 999, label: "40+" },
  ];
  for (const bin of rangeBins) {
    const count = allRanges.filter(r => r >= bin.min && r < bin.max).length;
    const pct = (count / allRanges.length) * 100;
    console.log(`  ${bin.label}: ${count} profiles (${pct.toFixed(1)}%)`);
  }
  console.log("");

  console.log("StdDev 분포:");
  console.log("─".repeat(80));
  const stdDevBins = [
    { min: 0, max: 3, label: "0~3" },
    { min: 3, max: 5, label: "3~5" },
    { min: 5, max: 8, label: "5~8" },
    { min: 8, max: 999, label: "8+" },
  ];
  for (const bin of stdDevBins) {
    const count = allStdDevs.filter(s => s >= bin.min && s < bin.max).length;
    const pct = (count / allStdDevs.length) * 100;
    console.log(`  ${bin.label}: ${count} profiles (${pct.toFixed(1)}%)`);
  }
  console.log("");

  // PART B: 일간 변화량
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("PART B. 일간 변화량 (Day-to-Day Diff)");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const allDayToDayDiffs = profileVariances.map(p => p.avgDayToDayDiff);

  console.log("전체 통계:");
  console.log("─".repeat(80));
  console.log(`Mean Diff: ${mean(allDayToDayDiffs).toFixed(2)}`);
  console.log(`Median Diff: ${median(allDayToDayDiffs).toFixed(2)}`);
  console.log(`P90 Diff: ${percentile(allDayToDayDiffs, 90).toFixed(2)}`);
  console.log(`P95 Diff: ${percentile(allDayToDayDiffs, 95).toFixed(2)}`);
  console.log("");

  // 모든 day-to-day diff를 모아서 분포
  const allDiffs: number[] = [];
  for (const pv of profileVariances) {
    for (let i = 1; i < pv.days.length; i++) {
      allDiffs.push(Math.abs(pv.days[i].overall - pv.days[i - 1].overall));
    }
  }

  console.log("Diff 분포 (전체 샘플):");
  console.log("─".repeat(80));
  const diffBins = [
    { min: 0, max: 2, label: "0~2" },
    { min: 2, max: 5, label: "3~5" },
    { min: 5, max: 10, label: "6~10" },
    { min: 10, max: 999, label: "11+" },
  ];
  for (const bin of diffBins) {
    const count = allDiffs.filter(d => d >= bin.min && d < bin.max).length;
    const pct = (count / allDiffs.length) * 100;
    console.log(`  ${bin.label}: ${count} samples (${pct.toFixed(1)}%)`);
  }
  console.log("");

  // PART C: 하루 내 카테고리 분포
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("PART C. 하루 내 카테고리 분포 (Category Range)");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const allCategoryRanges = profileVariances.map(p => p.avgCategoryRange);

  console.log("전체 통계:");
  console.log("─".repeat(80));
  console.log(`Mean Range: ${mean(allCategoryRanges).toFixed(2)}`);
  console.log(`Median Range: ${median(allCategoryRanges).toFixed(2)}`);
  console.log(`P90 Range: ${percentile(allCategoryRanges, 90).toFixed(2)}`);
  console.log(`P95 Range: ${percentile(allCategoryRanges, 95).toFixed(2)}`);
  console.log("");

  // 모든 day별 category range 분포
  const allDayCategoryRanges: number[] = [];
  for (const pv of profileVariances) {
    for (const day of pv.days) {
      allDayCategoryRanges.push(day.categoryRange);
    }
  }

  console.log("Category Range 분포 (전체 샘플):");
  console.log("─".repeat(80));
  const catRangeBins = [
    { min: 0, max: 4, label: "0~4" },
    { min: 4, max: 9, label: "5~9" },
    { min: 9, max: 14, label: "10~14" },
    { min: 14, max: 19, label: "15~19" },
    { min: 19, max: 999, label: "20+" },
  ];
  for (const bin of catRangeBins) {
    const count = allDayCategoryRanges.filter(r => r >= bin.min && r < bin.max).length;
    const pct = (count / allDayCategoryRanges.length) * 100;
    console.log(`  ${bin.label}: ${count} samples (${pct.toFixed(1)}%)`);
  }
  console.log("");

  // PART D: 하루 내 카테고리 StdDev
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("PART D. 하루 내 카테고리 StdDev");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const allCategoryStdDevs = profileVariances.map(p => p.avgCategoryStdDev);

  console.log("전체 통계:");
  console.log("─".repeat(80));
  console.log(`Mean StdDev: ${mean(allCategoryStdDevs).toFixed(2)}`);
  console.log(`Median StdDev: ${median(allCategoryStdDevs).toFixed(2)}`);
  console.log(`P90 StdDev: ${percentile(allCategoryStdDevs, 90).toFixed(2)}`);
  console.log(`P95 StdDev: ${percentile(allCategoryStdDevs, 95).toFixed(2)}`);
  console.log("");

  // PART E: Focus 효과 검증
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("PART E. Focus 효과 검증");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const noFocusDays: DayData[] = [];
  const mediumFocusDays: DayData[] = [];
  const strongFocusDays: DayData[] = [];

  for (const pv of profileVariances) {
    for (const day of pv.days) {
      if (!day.hasFocus) {
        noFocusDays.push(day);
      } else if (day.focusStrength === "medium") {
        mediumFocusDays.push(day);
      } else if (day.focusStrength === "strong") {
        strongFocusDays.push(day);
      }
    }
  }

  console.log("No Focus:");
  console.log("─".repeat(80));
  console.log(`  Count: ${noFocusDays.length}`);
  console.log(`  Avg Category Range: ${mean(noFocusDays.map(d => d.categoryRange)).toFixed(2)}`);
  console.log(`  Avg Category StdDev: ${mean(noFocusDays.map(d => d.categoryStdDev)).toFixed(2)}`);
  console.log("");

  console.log("Focus Medium:");
  console.log("─".repeat(80));
  console.log(`  Count: ${mediumFocusDays.length}`);
  console.log(`  Avg Category Range: ${mean(mediumFocusDays.map(d => d.categoryRange)).toFixed(2)}`);
  console.log(`  Avg Category StdDev: ${mean(mediumFocusDays.map(d => d.categoryStdDev)).toFixed(2)}`);
  console.log("");

  console.log("Focus Strong:");
  console.log("─".repeat(80));
  console.log(`  Count: ${strongFocusDays.length}`);
  console.log(`  Avg Category Range: ${mean(strongFocusDays.map(d => d.categoryRange)).toFixed(2)}`);
  console.log(`  Avg Category StdDev: ${mean(strongFocusDays.map(d => d.categoryStdDev)).toFixed(2)}`);
  console.log("");

  const noFocusRange = mean(noFocusDays.map(d => d.categoryRange));
  const mediumFocusRange = mean(mediumFocusDays.map(d => d.categoryRange));
  const strongFocusRange = mean(strongFocusDays.map(d => d.categoryRange));

  console.log("Focus 효과:");
  console.log("─".repeat(80));
  console.log(`  Medium vs No Focus: ${mediumFocusRange > noFocusRange ? "확대" : "축소"} (${(mediumFocusRange - noFocusRange).toFixed(2)})`);
  console.log(`  Strong vs No Focus: ${strongFocusRange > noFocusRange ? "확대" : "축소"} (${(strongFocusRange - noFocusRange).toFixed(2)})`);
  console.log("");

  // PART F: 사용자 프로필 상세
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("PART F. 사용자 프로필 상세 (1998-01-22 12:10 부산 남성)");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const userProfile = profileVariances.find(p => p.profileId === "user")!;

  console.log("Overall 통계:");
  console.log("─".repeat(80));
  console.log(`  Mean: ${userProfile.overallMean.toFixed(2)}`);
  console.log(`  Median: ${userProfile.overallMedian.toFixed(2)}`);
  console.log(`  StdDev: ${userProfile.overallStdDev.toFixed(2)}`);
  console.log(`  Yearly Max: ${userProfile.yearlyMax.toFixed(2)}`);
  console.log(`  Yearly Min: ${userProfile.yearlyMin.toFixed(2)}`);
  console.log(`  Yearly Range: ${userProfile.yearlyRange.toFixed(2)}`);
  console.log("");

  console.log("변동성:");
  console.log("─".repeat(80));
  console.log(`  Day-to-Day Diff 평균: ${userProfile.avgDayToDayDiff.toFixed(2)}`);
  console.log(`  Category Range 평균: ${userProfile.avgCategoryRange.toFixed(2)}`);
  console.log(`  Category StdDev 평균: ${userProfile.avgCategoryStdDev.toFixed(2)}`);
  console.log("");

  // PART G: 사용자 프로필 카테고리 분석
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("PART G. 사용자 프로필 카테고리 분석");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const studyTop1Days: DayData[] = [];
  const studyNotTop1Days: DayData[] = [];
  const loveTop1Days: DayData[] = [];
  const healthTop1Days: DayData[] = [];
  const wealthTop1Days: DayData[] = [];

  for (const day of userProfile.days) {
    const sorted = CAT_KEYS.slice().sort((a, b) => day.categoryScores[b] - day.categoryScores[a]);
    const top1 = sorted[0];
    const top1Score = day.categoryScores[top1];
    const top2Score = day.categoryScores[sorted[1]];
    const gap = top1Score - top2Score;

    if (top1 === "study") {
      studyTop1Days.push(day);
    } else {
      studyNotTop1Days.push(day);
    }

    if (top1 === "love") loveTop1Days.push(day);
    if (top1 === "health") healthTop1Days.push(day);
    if (top1 === "wealth") wealthTop1Days.push(day);
  }

  console.log("Study Top1인 날:");
  console.log("─".repeat(80));
  console.log(`  Count: ${studyTop1Days.length}`);
  const studyTop1Gaps: number[] = [];
  for (const day of studyTop1Days) {
    const sorted = CAT_KEYS.slice().sort((a, b) => day.categoryScores[b] - day.categoryScores[a]);
    studyTop1Gaps.push(day.categoryScores[sorted[0]] - day.categoryScores[sorted[1]]);
  }
  console.log(`  평균 Gap: ${mean(studyTop1Gaps).toFixed(2)}`);
  console.log(`  평균 Range: ${mean(studyTop1Days.map(d => d.categoryRange)).toFixed(2)}`);
  console.log("");

  console.log("Study Top1이 아닌 날:");
  console.log("─".repeat(80));
  console.log(`  Count: ${studyNotTop1Days.length}`);
  const studyNotTop1Gaps: number[] = [];
  for (const day of studyNotTop1Days) {
    const sorted = CAT_KEYS.slice().sort((a, b) => day.categoryScores[b] - day.categoryScores[a]);
    studyNotTop1Gaps.push(day.categoryScores[sorted[0]] - day.categoryScores[sorted[1]]);
  }
  console.log(`  평균 Gap: ${mean(studyNotTop1Gaps).toFixed(2)}`);
  console.log(`  평균 Range: ${mean(studyNotTop1Days.map(d => d.categoryRange)).toFixed(2)}`);
  console.log("");

  console.log("Love Top1인 날:");
  console.log("─".repeat(80));
  console.log(`  Count: ${loveTop1Days.length}`);
  const loveTop1Gaps: number[] = [];
  for (const day of loveTop1Days) {
    const sorted = CAT_KEYS.slice().sort((a, b) => day.categoryScores[b] - day.categoryScores[a]);
    loveTop1Gaps.push(day.categoryScores[sorted[0]] - day.categoryScores[sorted[1]]);
  }
  console.log(`  평균 Gap: ${mean(loveTop1Gaps).toFixed(2)}`);
  console.log(`  평균 Range: ${mean(loveTop1Days.map(d => d.categoryRange)).toFixed(2)}`);
  console.log("");

  console.log("Health Top1인 날:");
  console.log("─".repeat(80));
  console.log(`  Count: ${healthTop1Days.length}`);
  const healthTop1Gaps: number[] = [];
  for (const day of healthTop1Days) {
    const sorted = CAT_KEYS.slice().sort((a, b) => day.categoryScores[b] - day.categoryScores[a]);
    healthTop1Gaps.push(day.categoryScores[sorted[0]] - day.categoryScores[sorted[1]]);
  }
  console.log(`  평균 Gap: ${mean(healthTop1Gaps).toFixed(2)}`);
  console.log(`  평균 Range: ${mean(healthTop1Days.map(d => d.categoryRange)).toFixed(2)}`);
  console.log("");

  console.log("Wealth Top1인 날:");
  console.log("─".repeat(80));
  console.log(`  Count: ${wealthTop1Days.length}`);
  const wealthTop1Gaps: number[] = [];
  for (const day of wealthTop1Days) {
    const sorted = CAT_KEYS.slice().sort((a, b) => day.categoryScores[b] - day.categoryScores[a]);
    wealthTop1Gaps.push(day.categoryScores[sorted[0]] - day.categoryScores[sorted[1]]);
  }
  console.log(`  평균 Gap: ${mean(wealthTop1Gaps).toFixed(2)}`);
  console.log(`  평균 Range: ${mean(wealthTop1Days.map(d => d.categoryRange)).toFixed(2)}`);
  console.log("");

  // PART H: 특별한 날 검증
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("PART H. 특별한 날 검증 (사용자 프로필)");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const sortedByOverall = userProfile.days.slice().sort((a, b) => b.overall - a.overall);

  console.log("상위 20일:");
  console.log("─".repeat(80));
  for (let i = 0; i < 20; i++) {
    const day = sortedByOverall[i];
    const sorted = CAT_KEYS.slice().sort((a, b) => day.categoryScores[b] - day.categoryScores[a]);
    const topCat = sorted[0];
    const bottomCat = sorted[5];
    console.log(`${i + 1}. ${day.date}`);
    console.log(`   Overall: ${day.overall.toFixed(1)}, Top: ${topCat} (${day.categoryScores[topCat].toFixed(0)}), Bottom: ${bottomCat} (${day.categoryScores[bottomCat].toFixed(0)})`);
    console.log(`   Category Range: ${day.categoryRange.toFixed(1)}, Focus: ${day.hasFocus ? day.focusStrength : "No"}`);
  }
  console.log("");

  console.log("하위 20일:");
  console.log("─".repeat(80));
  for (let i = 0; i < 20; i++) {
    const day = sortedByOverall[sortedByOverall.length - 1 - i];
    const sorted = CAT_KEYS.slice().sort((a, b) => day.categoryScores[b] - day.categoryScores[a]);
    const topCat = sorted[0];
    const bottomCat = sorted[5];
    console.log(`${i + 1}. ${day.date}`);
    console.log(`   Overall: ${day.overall.toFixed(1)}, Top: ${topCat} (${day.categoryScores[topCat].toFixed(0)}), Bottom: ${bottomCat} (${day.categoryScores[bottomCat].toFixed(0)})`);
    console.log(`   Category Range: ${day.categoryRange.toFixed(1)}, Focus: ${day.hasFocus ? day.focusStrength : "No"}`);
  }
  console.log("");

  // PART I: 최종 판정
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("PART I. 최종 판정");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  // 1. 한 달 안에서 점수 변화가 충분한가?
  const avgRange = mean(allRanges);
  const avgStdDev = mean(allStdDevs);
  const avgDayDiff = mean(allDayToDayDiffs);

  console.log("1. 한 달 안에서 점수 변화가 충분한가?");
  console.log("─".repeat(80));
  console.log(`  평균 Range: ${avgRange.toFixed(2)} (기준: 20+ 이상적, 15+ 양호, 10- 부족)`);
  console.log(`  평균 StdDev: ${avgStdDev.toFixed(2)} (기준: 5+ 이상적, 3+ 양호, 3- 부족)`);
  console.log(`  평균 Day-to-Day Diff: ${avgDayDiff.toFixed(2)} (기준: 3+ 이상적, 2+ 양호, 2- 부족)`);

  let monthlyVerdict = "";
  if (avgRange >= 20 && avgStdDev >= 5 && avgDayDiff >= 3) {
    monthlyVerdict = "매우 충분 ✓";
  } else if (avgRange >= 15 && avgStdDev >= 3 && avgDayDiff >= 2) {
    monthlyVerdict = "충분 ✓";
  } else if (avgRange >= 10 && avgStdDev >= 2 && avgDayDiff >= 1.5) {
    monthlyVerdict = "보통";
  } else {
    monthlyVerdict = "부족 ✗";
  }
  console.log(`  판정: ${monthlyVerdict}`);
  console.log("");

  // 2. 하루 안에서 카테고리 차이가 충분한가?
  const avgCatRange = mean(allCategoryRanges);
  const avgCatStdDev = mean(allCategoryStdDevs);

  console.log("2. 하루 안에서 카테고리 차이가 충분한가?");
  console.log("─".repeat(80));
  console.log(`  평균 Category Range: ${avgCatRange.toFixed(2)} (기준: 10+ 이상적, 7+ 양호, 5- 부족)`);
  console.log(`  평균 Category StdDev: ${avgCatStdDev.toFixed(2)} (기준: 4+ 이상적, 3+ 양호, 2- 부족)`);

  let dailyVerdict = "";
  if (avgCatRange >= 10 && avgCatStdDev >= 4) {
    dailyVerdict = "매우 충분 ✓";
  } else if (avgCatRange >= 7 && avgCatStdDev >= 3) {
    dailyVerdict = "충분 ✓";
  } else if (avgCatRange >= 5 && avgCatStdDev >= 2) {
    dailyVerdict = "보통";
  } else {
    dailyVerdict = "부족 ✗";
  }
  console.log(`  판정: ${dailyVerdict}`);
  console.log("");

  // 3. Focus가 실제 특별함을 만드는가?
  const focusRangeIncrease = mediumFocusRange - noFocusRange;
  const focusStrongRangeIncrease = strongFocusRange - noFocusRange;

  console.log("3. Focus가 실제 특별함을 만드는가?");
  console.log("─".repeat(80));
  console.log(`  Medium Focus 증가: ${focusRangeIncrease.toFixed(2)} (기준: 2+ 이상적, 1+ 양호, 1- 부족)`);
  console.log(`  Strong Focus 증가: ${focusStrongRangeIncrease.toFixed(2)} (기준: 3+ 이상적, 2+ 양호, 1- 부족)`);

  let focusVerdict = "";
  if (focusRangeIncrease >= 2 && focusStrongRangeIncrease >= 3) {
    focusVerdict = "매우 효과적 ✓";
  } else if (focusRangeIncrease >= 1 && focusStrongRangeIncrease >= 2) {
    focusVerdict = "효과적 ✓";
  } else if (focusRangeIncrease >= 0.5 && focusStrongRangeIncrease >= 1) {
    focusVerdict = "보통";
  } else {
    focusVerdict = "효과 미미 ✗";
  }
  console.log(`  판정: ${focusVerdict}`);
  console.log("");

  // 4. 사용자 프로필이 지나치게 평평한가?
  console.log("4. 사용자 프로필이 지나치게 평평한가?");
  console.log("─".repeat(80));
  console.log(`  User Range: ${userProfile.yearlyRange.toFixed(2)} (전체 평균: ${avgRange.toFixed(2)})`);
  console.log(`  User StdDev: ${userProfile.overallStdDev.toFixed(2)} (전체 평균: ${avgStdDev.toFixed(2)})`);
  console.log(`  User Category Range: ${userProfile.avgCategoryRange.toFixed(2)} (전체 평균: ${avgCatRange.toFixed(2)})`);

  const userVsAvgRange = userProfile.yearlyRange / avgRange;
  const userVsAvgStdDev = userProfile.overallStdDev / avgStdDev;

  let userFlatVerdict = "";
  if (userVsAvgRange < 0.7 && userVsAvgStdDev < 0.7) {
    userFlatVerdict = "매우 평평함 ✗";
  } else if (userVsAvgRange < 0.85 && userVsAvgStdDev < 0.85) {
    userFlatVerdict = "다소 평평함";
  } else {
    userFlatVerdict = "정상 ✓";
  }
  console.log(`  판정: ${userFlatVerdict}`);
  console.log("");

  // 5. 사용자 프로필이 지나치게 요동치는가?
  console.log("5. 사용자 프로필이 지나치게 요동치는가?");
  console.log("─".repeat(80));
  console.log(`  User Day-to-Day Diff: ${userProfile.avgDayToDayDiff.toFixed(2)} (전체 평균: ${avgDayDiff.toFixed(2)})`);

  const userVsAvgDiff = userProfile.avgDayToDayDiff / avgDayDiff;

  let userVolatileVerdict = "";
  if (userVsAvgDiff > 1.5) {
    userVolatileVerdict = "과도한 변동 ✗";
  } else if (userVsAvgDiff > 1.2) {
    userVolatileVerdict = "다소 높은 변동";
  } else {
    userVolatileVerdict = "정상 ✓";
  }
  console.log(`  판정: ${userVolatileVerdict}`);
  console.log("");

  // 6. 엔진이 재미있는가?
  console.log("6. 엔진이 재미있는가?");
  console.log("─".repeat(80));
  console.log(`  월간 변동: ${monthlyVerdict}`);
  console.log(`  일간 차이: ${dailyVerdict}`);
  console.log(`  Focus 효과: ${focusVerdict}`);
  console.log(`  사용자 평평도: ${userFlatVerdict}`);
  console.log(`  사용자 요동: ${userVolatileVerdict}`);
  console.log("");

  let finalGrade = "";
  let finalExplanation = "";

  const verdicts = [monthlyVerdict, dailyVerdict, focusVerdict, userFlatVerdict, userVolatileVerdict];
  const veryGoodCount = verdicts.filter(v => v.includes("매우")).length;
  const goodCount = verdicts.filter(v => v.includes("✓")).length;
  const badCount = verdicts.filter(v => v.includes("✗")).length;

  if (goodCount >= 4 && badCount === 0 && veryGoodCount >= 2) {
    finalGrade = "A. 매우 건강하고 재미있음";
    finalExplanation = "월간 변동, 일간 차이, Focus 효과 모두 이상적. 사용자 프로필도 정상 범위.";
  } else if (goodCount >= 4 && badCount === 0) {
    finalGrade = "B. 건강함";
    finalExplanation = "대부분 지표가 양호. 재미와 안정성의 균형이 잘 잡혀 있음.";
  } else if (goodCount >= 3 && badCount <= 1) {
    finalGrade = "C. 다소 평평함";
    finalExplanation = "일부 지표가 보통 수준. 재미 요소를 강화할 여지가 있음.";
  } else {
    finalGrade = "D. 심심함";
    finalExplanation = "변동성이 부족하거나 밸런스가 무너져 있음. 개선 필요.";
  }

  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("최종 등급");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");
  console.log(`등급: ${finalGrade}`);
  console.log("");
  console.log(`설명: ${finalExplanation}`);
  console.log("");
  console.log("════════════════════════════════════════════════════════════════════════════════");
}

main();
