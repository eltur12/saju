/**
 * PROFILE DOMINANCE FINAL AUDIT
 *
 * 사용자 프로필 Study 63% 현상이
 * 엔진 편향인지 개인 특성인지 최종 판정
 */

import { FortuneAggregator } from "../src/engines/aggregator.js";
import { calculateSajuProfile } from "../src/utils/sajuCalculator.js";
import { buildZiweiProfile } from "../src/utils/ziweiCalculator.js";
import { buildAstroProfile } from "../src/utils/astroCalculator.js";
import { normalizeBirthDateTimeByRegion } from "../src/utils/sajuTime.js";
import { EVENT_CATEGORY_MAP } from "../src/ai/v2/eventCategoryMap.js";

interface ProfileConfig {
  id: string;
  birth: { year: number; month: number; day: number; hour: number; minute: number };
  gender: "M" | "F";
  region: string;
}

const CAT_KEYS = ["wealth", "love", "health", "career", "relations", "study"] as const;
type Category = typeof CAT_KEYS[number];

interface ProfileDominance {
  profileId: string;
  dominantCat: Category;
  top1Pct: number;
  top2Cat: Category;
  top2Pct: number;
  gap: number;
  top1Mean: number;
  top2Mean: number;
  meanGap: number;
  top1Median: number;
  categoryMeans: Record<Category, number>;
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

async function main() {
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("PROFILE DOMINANCE FINAL AUDIT");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const profiles = generateProfiles();
  const profileDominances: ProfileDominance[] = [];

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

    const top1Counts: Record<Category, number> = {
      wealth: 0, love: 0, health: 0, career: 0, relations: 0, study: 0,
    };

    const categoryScores: Record<Category, number[]> = {
      wealth: [], love: [], health: [], career: [], relations: [], study: [],
    };

    for (let dayOffset = 0; dayOffset < 365; dayOffset++) {
      const date = new Date(2026, 0, 1 + dayOffset);
      const fortune = agg.getDailyFortune(date);

      const scores = fortune.persisted?.displayScores ?? fortune.scores;

      const sorted = CAT_KEYS.slice().sort((a, b) => scores[b] - scores[a]);
      top1Counts[sorted[0]]++;

      for (const cat of CAT_KEYS) {
        categoryScores[cat].push(scores[cat]);
      }
    }

    const sortedCats = CAT_KEYS.slice().sort((a, b) => top1Counts[b] - top1Counts[a]);
    const dominantCat = sortedCats[0];
    const top2Cat = sortedCats[1];

    const top1Pct = (top1Counts[dominantCat] / 365) * 100;
    const top2Pct = (top1Counts[top2Cat] / 365) * 100;

    const categoryMeans: Record<Category, number> = {} as any;
    for (const cat of CAT_KEYS) {
      categoryMeans[cat] = categoryScores[cat].reduce((a, b) => a + b, 0) / categoryScores[cat].length;
    }

    const top1Mean = categoryMeans[dominantCat];
    const top2Mean = categoryMeans[top2Cat];
    const top1Median = median(categoryScores[dominantCat]);

    profileDominances.push({
      profileId: pConfig.id,
      dominantCat,
      top1Pct,
      top2Cat,
      top2Pct,
      gap: top1Pct - top2Pct,
      top1Mean,
      top2Mean,
      meanGap: top1Mean - top2Mean,
      top1Median,
      categoryMeans,
    });
  }

  console.log(`Total: ${profileDominances.length} profiles`);
  console.log("");

  // PART A: Top1 Dominance 분포
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("PART A. Top1 Dominance 분포");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const sorted = profileDominances.slice().sort((a, b) => b.top1Pct - a.top1Pct);

  console.log("TOP20 (Top1% DESC):");
  console.log("─".repeat(80));
  for (let i = 0; i < Math.min(20, sorted.length); i++) {
    const p = sorted[i];
    console.log(`${i + 1}. ${p.profileId}`);
    console.log(`   Dominant: ${p.dominantCat} (${p.top1Pct.toFixed(1)}%)`);
    console.log(`   Top2: ${p.top2Cat} (${p.top2Pct.toFixed(1)}%)`);
    console.log(`   Gap: ${p.gap.toFixed(1)}%p`);
    console.log(`   Top1 Mean: ${p.top1Mean.toFixed(1)}, Top2 Mean: ${p.top2Mean.toFixed(1)}, Mean Gap: ${p.meanGap.toFixed(1)}`);
    console.log(`   Top1 Median: ${p.top1Median.toFixed(1)}`);
    console.log("");
  }

  // PART B: Dominance Histogram
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("PART B. Dominance Histogram");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const bins = [
    { min: 0, max: 20, label: "0~20%" },
    { min: 20, max: 30, label: "20~30%" },
    { min: 30, max: 40, label: "30~40%" },
    { min: 40, max: 50, label: "40~50%" },
    { min: 50, max: 60, label: "50~60%" },
    { min: 60, max: 70, label: "60~70%" },
    { min: 70, max: 80, label: "70~80%" },
    { min: 80, max: 100, label: "80%+" },
  ];

  for (const bin of bins) {
    const count = profileDominances.filter(p => p.top1Pct >= bin.min && p.top1Pct < bin.max).length;
    const pct = (count / profileDominances.length) * 100;
    console.log(`${bin.label}: ${count} profiles (${pct.toFixed(1)}%)`);
  }
  console.log("");

  // PART C: 극단 프로필 감사
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("PART C. 극단 프로필 감사 (Top1 ≥ 60%)");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const extremes = profileDominances.filter(p => p.top1Pct >= 60).sort((a, b) => b.top1Pct - a.top1Pct);

  console.log(`극단 프로필 수: ${extremes.length} / ${profileDominances.length} (${((extremes.length / profileDominances.length) * 100).toFixed(1)}%)`);
  console.log("");

  for (const p of extremes) {
    console.log(`${p.profileId}:`);
    console.log(`  Dominant: ${p.dominantCat} (${p.top1Pct.toFixed(1)}%)`);
    console.log(`  Top2: ${p.top2Cat} (${p.top2Pct.toFixed(1)}%)`);
    console.log(`  Top1 Mean: ${p.top1Mean.toFixed(1)}, Top2 Mean: ${p.top2Mean.toFixed(1)}, Gap: ${p.meanGap.toFixed(1)}`);
    console.log(`  Category Means: W=${p.categoryMeans.wealth.toFixed(1)} L=${p.categoryMeans.love.toFixed(1)} H=${p.categoryMeans.health.toFixed(1)} C=${p.categoryMeans.career.toFixed(1)} R=${p.categoryMeans.relations.toFixed(1)} S=${p.categoryMeans.study.toFixed(1)}`);
    console.log("");
  }

  // PART D: 사용자 프로필 상세
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("PART D. 사용자 프로필 상세 (1998-01-22 12:10 부산 남성)");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const userProfile = profileDominances.find(p => p.profileId === "user")!;

  // 사용자 프로필 상세 데이터 재수집
  const userConfig = profiles.find(p => p.id === "user")!;
  const nb = normalizeBirthDateTimeByRegion({ ...userConfig.birth, regionId: userConfig.region });
  const saju = calculateSajuProfile(nb.year, nb.month, nb.day, nb.hour, userConfig.gender, undefined, nb.minute);
  const ziwei = buildZiweiProfile(nb.year, nb.month, nb.day, nb.hour, 2026, true);
  const astro = await buildAstroProfile(nb.year, nb.month, nb.day, nb.hour, undefined, undefined, nb.minute);
  const bd = new Date(1998, 0, 22);
  const agg = new FortuneAggregator(saju, ziwei, astro, undefined, bd, false);

  const userCategoryScores: Record<Category, number[]> = {
    wealth: [], love: [], health: [], career: [], relations: [], study: [],
  };

  const userTop1Counts: Record<Category, number> = {
    wealth: 0, love: 0, health: 0, career: 0, relations: 0, study: 0,
  };

  const userBottom1Counts: Record<Category, number> = {
    wealth: 0, love: 0, health: 0, career: 0, relations: 0, study: 0,
  };

  for (let dayOffset = 0; dayOffset < 365; dayOffset++) {
    const date = new Date(2026, 0, 1 + dayOffset);
    const fortune = agg.getDailyFortune(date);
    const scores = fortune.persisted?.displayScores ?? fortune.scores;

    const sorted = CAT_KEYS.slice().sort((a, b) => scores[b] - scores[a]);
    userTop1Counts[sorted[0]]++;
    userBottom1Counts[sorted[5]]++;

    for (const cat of CAT_KEYS) {
      userCategoryScores[cat].push(scores[cat]);
    }
  }

  // 전역 평균 계산
  const globalMeans: Record<Category, number> = {} as any;
  for (const cat of CAT_KEYS) {
    const allScores: number[] = [];
    for (const p of profileDominances) {
      allScores.push(p.categoryMeans[cat]);
    }
    globalMeans[cat] = allScores.reduce((a, b) => a + b, 0) / allScores.length;
  }

  console.log("Category별 상세:");
  console.log("─".repeat(80));
  for (const cat of CAT_KEYS) {
    const scores = userCategoryScores[cat];
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const med = median(scores);
    const p75 = percentile(scores, 75);
    const p90 = percentile(scores, 90);
    const p95 = percentile(scores, 95);
    const top1Pct = (userTop1Counts[cat] / 365) * 100;
    const bottom1Pct = (userBottom1Counts[cat] / 365) * 100;
    const globalDiff = mean - globalMeans[cat];

    console.log(`${cat}:`);
    console.log(`  Mean: ${mean.toFixed(2)} (전역 대비 ${globalDiff >= 0 ? "+" : ""}${globalDiff.toFixed(2)})`);
    console.log(`  Median: ${med.toFixed(1)}`);
    console.log(`  P75: ${p75.toFixed(1)}, P90: ${p90.toFixed(1)}, P95: ${p95.toFixed(1)}`);
    console.log(`  Top1: ${top1Pct.toFixed(1)}%, Bottom1: ${bottom1Pct.toFixed(1)}%`);
    console.log("");
  }

  // PART E: Study 과점 원인 분석
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("PART E. Study 과점 원인 분석 (사용자 프로필)");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const studyEventSupply = new Map<string, { count: number; totalSupply: number }>();

  for (let dayOffset = 0; dayOffset < 365; dayOffset++) {
    const date = new Date(2026, 0, 1 + dayOffset);
    const fortune = agg.getDailyFortune(date);
    const events = fortune.persisted?.topEvents ?? [];

    for (const event of events) {
      const catMap = EVENT_CATEGORY_MAP[event.key];
      if (!catMap || !catMap.study) continue;

      const existing = studyEventSupply.get(event.key) || { count: 0, totalSupply: 0 };
      studyEventSupply.set(event.key, {
        count: existing.count + 1,
        totalSupply: existing.totalSupply + catMap.study,
      });
    }
  }

  const studyEvents = Array.from(studyEventSupply.entries())
    .map(([key, stat]) => ({
      key,
      coverage: (stat.count / 365) * 100,
      avgSupply: stat.totalSupply / stat.count,
      contribution: stat.totalSupply,
    }))
    .sort((a, b) => b.contribution - a.contribution);

  console.log("Study 공급 이벤트 TOP20:");
  console.log("─".repeat(80));
  for (let i = 0; i < Math.min(20, studyEvents.length); i++) {
    const e = studyEvents[i];
    console.log(`${i + 1}. ${e.key}`);
    console.log(`   Coverage: ${e.coverage.toFixed(1)}%`);
    console.log(`   Average Supply: ${e.avgSupply.toFixed(2)}`);
    console.log(`   Contribution: ${e.contribution.toFixed(1)}`);
    console.log("");
  }

  // PART F: 점수 차이 검증
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("PART F. 점수 차이 검증 (사용자 프로필)");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const studyScores = userCategoryScores.study;
  const studyMean = studyScores.reduce((a, b) => a + b, 0) / studyScores.length;
  const studyMedian = median(studyScores);
  const studyP90 = percentile(studyScores, 90);
  const studyP95 = percentile(studyScores, 95);

  const secondCat = userProfile.top2Cat;
  const secondScores = userCategoryScores[secondCat];
  const secondMean = secondScores.reduce((a, b) => a + b, 0) / secondScores.length;
  const secondMedian = median(secondScores);
  const secondP90 = percentile(secondScores, 90);
  const secondP95 = percentile(secondScores, 95);

  console.log(`1위 카테고리: study`);
  console.log(`  Mean: ${studyMean.toFixed(2)}`);
  console.log(`  Median: ${studyMedian.toFixed(1)}`);
  console.log(`  P90: ${studyP90.toFixed(1)}`);
  console.log(`  P95: ${studyP95.toFixed(1)}`);
  console.log("");

  console.log(`2위 카테고리: ${secondCat}`);
  console.log(`  Mean: ${secondMean.toFixed(2)}`);
  console.log(`  Median: ${secondMedian.toFixed(1)}`);
  console.log(`  P90: ${secondP90.toFixed(1)}`);
  console.log(`  P95: ${secondP95.toFixed(1)}`);
  console.log("");

  console.log(`Gap:`);
  console.log(`  Mean: ${(studyMean - secondMean).toFixed(2)}`);
  console.log(`  Median: ${(studyMedian - secondMedian).toFixed(1)}`);
  console.log(`  P90: ${(studyP90 - secondP90).toFixed(1)}`);
  console.log(`  P95: ${(studyP95 - secondP95).toFixed(1)}`);
  console.log("");

  // PART G: 전역 비교
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("PART G. 전역 비교");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const allMeanGaps = profileDominances.map(p => p.meanGap).sort((a, b) => a - b);
  const avgMeanGap = allMeanGaps.reduce((a, b) => a + b, 0) / allMeanGaps.length;
  const medianMeanGap = median(allMeanGaps);
  const p90MeanGap = percentile(allMeanGaps, 90);
  const maxMeanGap = Math.max(...allMeanGaps);

  const userMeanGap = userProfile.meanGap;
  const userPercentile = (allMeanGaps.filter(g => g < userMeanGap).length / allMeanGaps.length) * 100;

  console.log(`전체 프로필 Top1-Top2 Mean Gap:`);
  console.log(`  평균: ${avgMeanGap.toFixed(2)}`);
  console.log(`  Median: ${medianMeanGap.toFixed(2)}`);
  console.log(`  P90: ${p90MeanGap.toFixed(2)}`);
  console.log(`  최대: ${maxMeanGap.toFixed(2)}`);
  console.log("");

  console.log(`사용자 위치:`);
  console.log(`  Mean Gap: ${userMeanGap.toFixed(2)}`);
  console.log(`  Percentile: 상위 ${(100 - userPercentile).toFixed(1)}% (500명 중 ${Math.ceil((100 - userPercentile) / 100 * 500)}위)`);
  console.log("");

  // PART H: 개인 특성 판정
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("PART H. 개인 특성 판정");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const over60Count = profileDominances.filter(p => p.top1Pct >= 60).length;
  const over60Pct = (over60Count / profileDominances.length) * 100;

  console.log(`1. Top1 60% 이상 프로필: ${over60Count} / ${profileDominances.length} (${over60Pct.toFixed(1)}%)`);
  console.log("");

  const studyDominanceCount = profileDominances.filter(p => p.dominantCat === "study" && p.top1Pct >= 60).length;
  console.log(`2. Study Dominance (≥60%): ${studyDominanceCount}명`);
  console.log("");

  const isExtreme = userProfile.top1Pct >= 60;
  console.log(`3. 사용자 프로필 극단 사례: ${isExtreme ? "YES" : "NO"}`);
  console.log(`   (Top1 ${userProfile.top1Pct.toFixed(1)}%, 기준 60%)`);
  console.log("");

  const isScoreDriven = userMeanGap >= 2.0;
  console.log(`4. Study 63%의 원인:`);
  console.log(`   Mean Gap: ${userMeanGap.toFixed(2)}점 (${isScoreDriven ? "≥2.0" : "<2.0"})`);
  console.log(`   판정: ${isScoreDriven ? "점수 차이 때문" : "동률 환경에서의 잦은 승리"}`);
  console.log("");

  let range = "";
  if (userProfile.top1Pct < 40) {
    range = "정상 범위";
  } else if (userProfile.top1Pct < 60) {
    range = "주의 범위";
  } else {
    range = "극단 범위";
  }

  console.log(`5. 사용자 프로필 분류: ${range}`);
  console.log(`   (Top1 ${userProfile.top1Pct.toFixed(1)}%)`);
  console.log("");

  // 최종 판정
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("최종 판정");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  let verdict = "";
  let explanation = "";

  if (over60Pct > 30) {
    verdict = "A. 엔진 편향";
    explanation = `전체 프로필의 ${over60Pct.toFixed(1)}%가 Top1 60% 이상으로 엔진 구조 문제`;
  } else if (userProfile.top1Pct >= 70) {
    verdict = "D. 극단적 개인 특성";
    explanation = `Top1 ${userProfile.top1Pct.toFixed(1)}%, Mean Gap ${userMeanGap.toFixed(2)}점으로 극단 사례`;
  } else if (userProfile.top1Pct >= 60) {
    verdict = "C. 강한 개인 특성";
    explanation = `Top1 ${userProfile.top1Pct.toFixed(1)}%, 전체 ${over60Pct.toFixed(1)}% 중 하나로 강한 편향`;
  } else {
    verdict = "B. 약한 개인 특성";
    explanation = `Top1 ${userProfile.top1Pct.toFixed(1)}%로 정상~주의 범위`;
  }

  console.log(`판정: ${verdict}`);
  console.log("");
  console.log(`설명:`);
  console.log(`  ${explanation}`);
  console.log("");

  console.log(`근거:`);
  console.log(`  - Top1 비율: ${userProfile.top1Pct.toFixed(1)}% (study)`);
  console.log(`  - Top1-Top2 Mean Gap: ${userMeanGap.toFixed(2)}점`);
  console.log(`  - Median Gap: ${(studyMedian - secondMedian).toFixed(1)}점`);
  console.log(`  - P90 Gap: ${(studyP90 - secondP90).toFixed(1)}점`);
  console.log(`  - P95 Gap: ${(studyP95 - secondP95).toFixed(1)}점`);
  console.log(`  - 전역 비교: 상위 ${(100 - userPercentile).toFixed(1)}%`);
  console.log(`  - 극단 프로필 비율: ${over60Pct.toFixed(1)}%`);
  console.log("");

  console.log("════════════════════════════════════════════════════════════════════════════════");
}

main();
