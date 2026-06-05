/**
 * CATEGORY DOMINANCE AUDIT
 *
 * 목표: "왜 맨날 학습/직업만 높지?"가 실제 편향인지 UI 착시인지 검증
 *
 * 규모: 1000 Profiles × 365 Days = 365,000 Samples
 *
 * 중요: 실제 엔진 코드만 사용, 시뮬레이션/역산 금지
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

interface ProfileData {
  profileId: string;
  categorySums: Record<Category, number>;
  categoryMeans: Record<Category, number>;
  categoryMedians: Record<Category, number>;
  categoryMins: Record<Category, number>;
  categoryMaxs: Record<Category, number>;
  categoryStdDevs: Record<Category, number>;
  top1Counts: Record<Category, number>;
  top1Gaps: number[];
  nonTop1Gaps: number[];
  studyTop1Days: Array<{ date: string; gap: number }>;
  focusCounts: Record<Category, number>;
  recent30Top1: Category[];
  recent30Gaps: number[];
}

function generateProfiles(): ProfileConfig[] {
  const profiles: ProfileConfig[] = [];
  const regions = ["seoul", "busan", "gwangju", "daegu", "incheon"];

  for (let i = 0; i < 999; i++) {
    const year = 1975 + Math.floor(Math.random() * 30);
    const month = 1 + Math.floor(Math.random() * 12);
    const day = 1 + Math.floor(Math.random() * 28);
    const hour = Math.floor(Math.random() * 24);
    const minute = [0, 15, 30, 45][Math.floor(Math.random() * 4)];
    const gender = Math.random() < 0.5 ? "M" : "F";
    const region = regions[Math.floor(Math.random() * regions.length)];

    profiles.push({
      id: `p${String(i + 1).padStart(4, "0")}`,
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

async function main() {
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("CATEGORY DOMINANCE AUDIT");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");
  console.log("목표: \"왜 맨날 학습/직업만 높지?\"가 실제 편향인지 UI 착시인지 검증");
  console.log("규모: 1000 Profiles × 365 Days = 365,000 Samples");
  console.log("");
  console.log("─".repeat(80));
  console.log("");

  const profiles = generateProfiles();
  const profileDataList: ProfileData[] = [];

  console.log("데이터 생성 중...");
  console.log(`Profiles: ${profiles.length}, Days: 365`);
  console.log("");

  const globalCategorySums: Record<Category, number> = {
    wealth: 0, love: 0, health: 0, career: 0, relations: 0, study: 0,
  };

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

    const categorySums: Record<Category, number> = {
      wealth: 0, love: 0, health: 0, career: 0, relations: 0, study: 0,
    };
    const categoryScoreArrays: Record<Category, number[]> = {
      wealth: [], love: [], health: [], career: [], relations: [], study: [],
    };
    const top1Counts: Record<Category, number> = {
      wealth: 0, love: 0, health: 0, career: 0, relations: 0, study: 0,
    };
    const focusCounts: Record<Category, number> = {
      wealth: 0, love: 0, health: 0, career: 0, relations: 0, study: 0,
    };

    const studyTop1Days: Array<{ date: string; gap: number }> = [];
    const top1Gaps: number[] = [];
    const nonTop1Gaps: number[] = [];
    const recent30Top1: Category[] = [];
    const recent30Gaps: number[] = [];

    for (let dayOffset = 0; dayOffset < 365; dayOffset++) {
      const date = new Date(2026, 0, 1 + dayOffset);
      const fortune = agg.getDailyFortune(date);

      const scores = fortune.persisted?.displayScores ?? fortune.scores;

      for (const cat of CAT_KEYS) {
        categorySums[cat] += scores[cat];
        categoryScoreArrays[cat].push(scores[cat]);
        globalCategorySums[cat] += scores[cat];
      }

      const sorted = CAT_KEYS.slice().sort((a, b) => scores[b] - scores[a]);
      const top1 = sorted[0];
      const top2 = sorted[1];
      const gap = scores[top1] - scores[top2];

      top1Counts[top1]++;

      if (top1 === "study") {
        studyTop1Days.push({ date: fortune.date, gap });
        top1Gaps.push(gap);
      } else {
        nonTop1Gaps.push(gap);
      }

      // Recent 30 days
      if (dayOffset >= 365 - 30) {
        recent30Top1.push(top1);
        recent30Gaps.push(gap);
      }

      // Focus
      const focusArray = fortune.persisted?.focus ?? [];
      for (const f of focusArray) {
        focusCounts[f.category]++;
      }
    }

    const categoryMeans: Record<Category, number> = {} as any;
    const categoryMedians: Record<Category, number> = {} as any;
    const categoryMins: Record<Category, number> = {} as any;
    const categoryMaxs: Record<Category, number> = {} as any;
    const categoryStdDevs: Record<Category, number> = {} as any;

    for (const cat of CAT_KEYS) {
      categoryMeans[cat] = categorySums[cat] / 365;
      categoryMedians[cat] = median(categoryScoreArrays[cat]);
      categoryMins[cat] = Math.min(...categoryScoreArrays[cat]);
      categoryMaxs[cat] = Math.max(...categoryScoreArrays[cat]);
      categoryStdDevs[cat] = stdDev(categoryScoreArrays[cat]);
    }

    profileDataList.push({
      profileId: pConfig.id,
      categorySums,
      categoryMeans,
      categoryMedians,
      categoryMins,
      categoryMaxs,
      categoryStdDevs,
      top1Counts,
      top1Gaps,
      nonTop1Gaps,
      studyTop1Days,
      focusCounts,
      recent30Top1,
      recent30Gaps,
    });
  }

  console.log(`Total: ${profiles.length} profiles`);
  console.log("");

  // PART 1: 전역 카테고리 점수 총량
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("PART 1. 전역 카테고리 점수 총량");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const totalSum = CAT_KEYS.reduce((sum, cat) => sum + globalCategorySums[cat], 0);

  const globalRatios: Array<{ cat: Category; ratio: number }> = CAT_KEYS.map(cat => ({
    cat,
    ratio: (globalCategorySums[cat] / totalSum) * 100,
  })).sort((a, b) => b.ratio - a.ratio);

  console.log("전체 점수 합 기준 비율:");
  console.log("─".repeat(80));
  for (const { cat, ratio } of globalRatios) {
    const allMeans = profileDataList.map(p => p.categoryMeans[cat]);
    console.log(`  ${cat.padEnd(10)} ${ratio.toFixed(2)}% (Mean: ${mean(allMeans).toFixed(2)})`);
  }
  console.log("");

  const maxRatio = globalRatios[0].ratio;
  const minRatio = globalRatios[5].ratio;
  const ratioDiff = maxRatio - minRatio;

  console.log(`최고 비율: ${globalRatios[0].cat} (${maxRatio.toFixed(2)}%)`);
  console.log(`최저 비율: ${globalRatios[5].cat} (${minRatio.toFixed(2)}%)`);
  console.log(`차이: ${ratioDiff.toFixed(2)}%`);
  console.log("");

  let part1Verdict = "";
  if (ratioDiff < 2) {
    part1Verdict = "매우 균형";
  } else if (ratioDiff < 4) {
    part1Verdict = "양호";
  } else if (ratioDiff < 6) {
    part1Verdict = "주의";
  } else {
    part1Verdict = "구조 편향";
  }

  console.log(`판정: ${part1Verdict}`);
  console.log("");

  // PART 2: 사용자 프로필 점수 총량
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("PART 2. 사용자 프로필 점수 총량 (1998-01-22 12:10 부산 남성)");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const userProfile = profileDataList.find(p => p.profileId === "user")!;

  const userTotalSum = CAT_KEYS.reduce((sum, cat) => sum + userProfile.categorySums[cat], 0);

  const userRatios: Array<{ cat: Category; ratio: number }> = CAT_KEYS.map(cat => ({
    cat,
    ratio: (userProfile.categorySums[cat] / userTotalSum) * 100,
  })).sort((a, b) => b.ratio - a.ratio);

  console.log("카테고리별 통계:");
  console.log("─".repeat(80));
  for (const cat of CAT_KEYS) {
    console.log(`${cat}:`);
    console.log(`  Mean: ${userProfile.categoryMeans[cat].toFixed(2)}`);
    console.log(`  Median: ${userProfile.categoryMedians[cat].toFixed(2)}`);
    console.log(`  Min: ${userProfile.categoryMins[cat]}, Max: ${userProfile.categoryMaxs[cat]}`);
    console.log(`  StdDev: ${userProfile.categoryStdDevs[cat].toFixed(2)}`);
    console.log("");
  }

  console.log("점수 총합 기준 비율:");
  console.log("─".repeat(80));
  for (const { cat, ratio } of userRatios) {
    console.log(`  ${cat.padEnd(10)} ${ratio.toFixed(2)}%`);
  }
  console.log("");

  // PART 3: Dominance Gap
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("PART 3. Dominance Gap (사용자 프로필)");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const sortedByMean = CAT_KEYS.slice().sort((a, b) => userProfile.categoryMeans[b] - userProfile.categoryMeans[a]);

  console.log("Mean 기준 순위:");
  console.log("─".repeat(80));
  for (let i = 0; i < sortedByMean.length; i++) {
    const cat = sortedByMean[i];
    console.log(`  ${i + 1}위: ${cat.padEnd(10)} Mean ${userProfile.categoryMeans[cat].toFixed(2)}`);
  }
  console.log("");

  const top1Mean = userProfile.categoryMeans[sortedByMean[0]];
  const bottom1Mean = userProfile.categoryMeans[sortedByMean[5]];
  const dominanceGap = top1Mean - bottom1Mean;

  console.log(`1위 Mean: ${top1Mean.toFixed(2)} (${sortedByMean[0]})`);
  console.log(`6위 Mean: ${bottom1Mean.toFixed(2)} (${sortedByMean[5]})`);
  console.log(`Gap: ${dominanceGap.toFixed(2)}`);
  console.log("");

  let part3Verdict = "";
  if (dominanceGap < 2) {
    part3Verdict = "사실상 균형";
  } else if (dominanceGap < 4) {
    part3Verdict = "약한 성향";
  } else if (dominanceGap < 6) {
    part3Verdict = "뚜렷한 성향";
  } else {
    part3Verdict = "구조적 편향";
  }

  console.log(`판정: ${part3Verdict}`);
  console.log("");

  // PART 4: Top1 착시 감사
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("PART 4. Top1 착시 감사 (사용자 프로필)");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  console.log(`Study Top1인 날: ${userProfile.studyTop1Days.length}일`);
  console.log("");

  const gapBins = [
    { min: 0, max: 1, label: "0~1" },
    { min: 1, max: 2, label: "1~2" },
    { min: 2, max: 3, label: "2~3" },
    { min: 3, max: 5, label: "3~5" },
    { min: 5, max: 999, label: "5+" },
  ];

  console.log("Top1 - Top2 Gap 분포 (Study Top1일):");
  console.log("─".repeat(80));
  for (const bin of gapBins) {
    const count = userProfile.top1Gaps.filter(g => g >= bin.min && g < bin.max).length;
    const pct = (count / userProfile.top1Gaps.length) * 100;
    console.log(`  ${bin.label}: ${count}일 (${pct.toFixed(1)}%)`);
  }
  console.log("");

  const avgStudyTop1Gap = mean(userProfile.top1Gaps);
  const avgNonStudyTop1Gap = mean(userProfile.nonTop1Gaps);

  console.log(`Study Top1일의 평균 Gap: ${avgStudyTop1Gap.toFixed(2)}`);
  console.log(`Study Top1이 아닌 날의 평균 Gap: ${avgNonStudyTop1Gap.toFixed(2)}`);
  console.log("");

  const gapLt2Count = userProfile.top1Gaps.filter(g => g < 2).length;
  const gapLt2Pct = (gapLt2Count / userProfile.top1Gaps.length) * 100;
  const gap5PlusCount = userProfile.top1Gaps.filter(g => g >= 5).length;
  const gap5PlusPct = (gap5PlusCount / userProfile.top1Gaps.length) * 100;

  console.log(`Gap < 2: ${gapLt2Pct.toFixed(1)}%`);
  console.log(`Gap ≥ 5: ${gap5PlusPct.toFixed(1)}%`);
  console.log("");

  let part4Verdict = "";
  if (gapLt2Pct >= 70) {
    part4Verdict = "Top1 착시 가능성 높음";
  } else if (gap5PlusPct >= 30) {
    part4Verdict = "실제 Study 우세";
  } else {
    part4Verdict = "혼합 (착시 + 실제 우세)";
  }

  console.log(`판정: ${part4Verdict}`);
  console.log("");

  // PART 5: 월간 체감 다양성 감사
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("PART 5. 월간 체감 다양성 감사 (사용자 프로필)");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  console.log("Focus 발생 카테고리:");
  console.log("─".repeat(80));
  const totalFocus = CAT_KEYS.reduce((sum, cat) => sum + userProfile.focusCounts[cat], 0);
  for (const cat of CAT_KEYS) {
    const count = userProfile.focusCounts[cat];
    const pct = totalFocus > 0 ? (count / totalFocus) * 100 : 0;
    console.log(`  ${cat.padEnd(10)} ${count}일 (${pct.toFixed(1)}%)`);
  }
  console.log("");

  console.log("최근 30일 Top1 분포:");
  console.log("─".repeat(80));
  const recent30Counts: Record<Category, number> = {
    wealth: 0, love: 0, health: 0, career: 0, relations: 0, study: 0,
  };
  for (const cat of userProfile.recent30Top1) {
    recent30Counts[cat]++;
  }
  for (const cat of CAT_KEYS) {
    const count = recent30Counts[cat];
    const pct = (count / 30) * 100;
    console.log(`  ${cat.padEnd(10)} ${count}일 (${pct.toFixed(1)}%)`);
  }
  console.log("");

  const avgRecent30Gap = mean(userProfile.recent30Gaps);
  console.log(`최근 30일 Top1-Top2 평균 Gap: ${avgRecent30Gap.toFixed(2)}`);
  console.log("");

  const uniqueTop1Count = Object.values(recent30Counts).filter(c => c > 0).length;
  const studyRecent30 = recent30Counts.study;
  const studyRecent30Pct = (studyRecent30 / 30) * 100;

  let part5Verdict = "";
  if (studyRecent30Pct >= 70 && avgRecent30Gap < 2) {
    part5Verdict = "매일 비슷하게 느낄 가능성 높음 (Study 과점 + 근소 차이)";
  } else if (studyRecent30Pct >= 70) {
    part5Verdict = "Study 과점이나 차이는 뚜렷함";
  } else if (avgRecent30Gap < 2) {
    part5Verdict = "다양하나 차이가 근소함";
  } else {
    part5Verdict = "다양하고 차이도 뚜렷함";
  }

  console.log(`판정: ${part5Verdict}`);
  console.log("");

  // PART 6: 최종 결론
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("PART 6. 최종 결론");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  console.log("사용자가 느끼는 \"왜 맨날 학습/직업만 높지?\"는:");
  console.log("─".repeat(80));
  console.log("");

  // 판정 로직
  let finalVerdict = "";
  let explanation = "";
  let engineFix = false;
  let uiFix = false;

  const isActualBias = dominanceGap >= 4;
  const isTop1Illusion = gapLt2Pct >= 50;
  const isStudyDominant = userRatios[0].cat === "study" && userRatios[0].ratio >= 18;

  if (isActualBias && isTop1Illusion) {
    finalVerdict = "C. 실제 편향 + UI 착시";
    explanation = `Study Mean ${userProfile.categoryMeans.study.toFixed(2)}로 1위이며, Top1 Gap의 ${gapLt2Pct.toFixed(1)}%가 2점 미만으로 근소 차이. 실제로도 높지만 Top1 표시가 차이를 과장.`;
    engineFix = false; // 개인 특성
    uiFix = true;
  } else if (isActualBias) {
    finalVerdict = "A. 실제 점수 편향";
    explanation = `Study Mean ${userProfile.categoryMeans.study.toFixed(2)}로 ${dominanceGap.toFixed(2)}점 차이. Top1 Gap 평균 ${avgStudyTop1Gap.toFixed(2)}로 실제 우세.`;
    engineFix = false; // 개인 특성
    uiFix = false;
  } else if (isTop1Illusion) {
    finalVerdict = "B. Top1 표시 방식의 착시";
    explanation = `Study Mean은 ${userProfile.categoryMeans.study.toFixed(2)}로 근소 차이이나, Top1 Gap의 ${gapLt2Pct.toFixed(1)}%가 2점 미만. Top1 표시가 차이를 과장.`;
    engineFix = false;
    uiFix = true;
  } else {
    finalVerdict = "C. 실제 편향 + UI 착시";
    explanation = `복합적 요인. Study Mean ${userProfile.categoryMeans.study.toFixed(2)}, Top1 ${(userProfile.top1Counts.study / 365 * 100).toFixed(1)}%, Gap ${avgStudyTop1Gap.toFixed(2)}.`;
    engineFix = false;
    uiFix = true;
  }

  console.log(`판정: ${finalVerdict}`);
  console.log("");
  console.log(`설명: ${explanation}`);
  console.log("");

  console.log("수치 근거:");
  console.log("─".repeat(80));
  console.log(`  1. 점수 총합 비율: Study ${userRatios.find(r => r.cat === "study")?.ratio.toFixed(2)}% (1위: ${userRatios[0].cat} ${userRatios[0].ratio.toFixed(2)}%)`);
  console.log(`  2. Mean 기준 Gap: ${dominanceGap.toFixed(2)}점 (1위 ${sortedByMean[0]} vs 6위 ${sortedByMean[5]})`);
  console.log(`  3. Study Top1 비율: ${(userProfile.top1Counts.study / 365 * 100).toFixed(1)}%`);
  console.log(`  4. Study Top1 평균 Gap: ${avgStudyTop1Gap.toFixed(2)}점`);
  console.log(`  5. Gap < 2 비율: ${gapLt2Pct.toFixed(1)}% (착시 가능성)`);
  console.log(`  6. 최근 30일 Study Top1: ${studyRecent30Pct.toFixed(1)}%`);
  console.log(`  7. 최근 30일 평균 Gap: ${avgRecent30Gap.toFixed(2)}점`);
  console.log("");

  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("최종 출력");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  console.log("1. 전역 카테고리 점수 비율:");
  for (const { cat, ratio } of globalRatios) {
    console.log(`   ${cat.padEnd(10)} ${ratio.toFixed(2)}%`);
  }
  console.log("");

  console.log("2. 사용자 카테고리 점수 비율:");
  for (const { cat, ratio } of userRatios) {
    console.log(`   ${cat.padEnd(10)} ${ratio.toFixed(2)}%`);
  }
  console.log("");

  console.log(`3. Dominance Gap: ${dominanceGap.toFixed(2)}점 (${part3Verdict})`);
  console.log("");

  console.log(`4. Study Top1 Gap 분석: ${part4Verdict}`);
  console.log(`   Gap < 2: ${gapLt2Pct.toFixed(1)}%`);
  console.log(`   Gap ≥ 5: ${gap5PlusPct.toFixed(1)}%`);
  console.log("");

  console.log(`5. 월간 체감 다양성: ${part5Verdict}`);
  console.log("");

  console.log(`6. 최종 판정: ${finalVerdict}`);
  console.log("");

  console.log(`7. 엔진 수정 필요 여부: ${engineFix ? "✓ 필요" : "✗ 불필요 (개인 특성)"}`);
  console.log("");

  console.log(`8. UI 수정 필요 여부: ${uiFix ? "✓ 필요" : "✗ 불필요"}`);
  console.log("");

  console.log("9. 추천 대응 방안:");
  if (uiFix) {
    console.log("   - Top1 뱃지 표시 조건 강화 (Gap ≥ 3 이상일 때만)");
    console.log("   - 점수 차이를 시각적으로 표현 (바 차트 길이 차이)");
    console.log("   - \"근소한 차이\" 표시 추가 (Gap < 2일 때)");
    console.log("   - 6개 카테고리를 모두 표시하여 균형 인식 개선");
  } else {
    console.log("   - 현재 UI 유지 (착시 없음)");
  }
  console.log("");

  console.log("10. 최종 결론:");
  console.log(`    ${finalVerdict}`);
  console.log(`    ${explanation}`);
  console.log("");

  console.log("════════════════════════════════════════════════════════════════════════════════");
}

main();
