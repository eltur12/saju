/**
 * CONVERGENCE REMOVAL A/B TEST
 *
 * 목표: "카테고리 평균 기준 편차 압축" 보정이 현재도 필요한지 검증
 *
 * 검증:
 * A = WITH_CONVERGENCE (현재 엔진, 0.75 압축)
 * B = NO_CONVERGENCE (실험 엔진, 압축 제거)
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

interface TestResult {
  profileId: string;

  // A: WITH_CONVERGENCE
  a_overall_mean: number;
  a_overall_stddev: number;
  a_overall_range: number;
  a_category_means: Record<Category, number>;
  a_category_range_mean: number;
  a_category_stddev_mean: number;
  a_top1_counts: Record<Category, number>;
  a_bottom1_counts: Record<Category, number>;

  // B: NO_CONVERGENCE
  b_overall_mean: number;
  b_overall_stddev: number;
  b_overall_range: number;
  b_category_means: Record<Category, number>;
  b_category_range_mean: number;
  b_category_stddev_mean: number;
  b_top1_counts: Record<Category, number>;
  b_bottom1_counts: Record<Category, number>;
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

// NOTE: 이 테스트는 FortuneAggregator의 mergeScores 메서드를
// 직접 수정하지 않고 결과를 비교하기 위해
// A = 현재 aggregator 사용
// B = 수렴 제거 시뮬레이션 (결과에서 역산)
// 방식으로 진행합니다.
//
// 실제 구현 시에는 aggregator.ts의 line 202-205를 주석 처리하면 됩니다.

async function main() {
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("CONVERGENCE REMOVAL A/B TEST");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");
  console.log("주의: 이 테스트는 개념 검증용입니다.");
  console.log("실제 수렴 제거 효과를 측정하려면 aggregator.ts line 202-205를 수정해야 합니다.");
  console.log("");
  console.log("현재 수렴 보정:");
  console.log("  const catAvg = domainCats.reduce((s, c) => s + (merged[c] as number), 0) / domainCats.length;");
  console.log("  for (const c of domainCats) {");
  console.log("    merged[c] = Math.max(0, Math.min(100, catAvg + (merged[c] - catAvg) * 0.75));");
  console.log("  }");
  console.log("");
  console.log("수렴 제거 시뮬레이션:");
  console.log("  압축 계수 0.75를 역산하여 원본 분산 추정");
  console.log("");
  console.log("─".repeat(80));
  console.log("");

  const profiles = generateProfiles();
  const results: TestResult[] = [];

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

    // A: WITH_CONVERGENCE (현재 엔진)
    const a_overalls: number[] = [];
    const a_categoryRanges: number[] = [];
    const a_categoryStdDevs: number[] = [];
    const a_categorySums: Record<Category, number> = {
      wealth: 0, love: 0, health: 0, career: 0, relations: 0, study: 0,
    };
    const a_top1Counts: Record<Category, number> = {
      wealth: 0, love: 0, health: 0, career: 0, relations: 0, study: 0,
    };
    const a_bottom1Counts: Record<Category, number> = {
      wealth: 0, love: 0, health: 0, career: 0, relations: 0, study: 0,
    };

    // B: NO_CONVERGENCE (시뮬레이션 - 압축 역산)
    const b_overalls: number[] = [];
    const b_categoryRanges: number[] = [];
    const b_categoryStdDevs: number[] = [];
    const b_categorySums: Record<Category, number> = {
      wealth: 0, love: 0, health: 0, career: 0, relations: 0, study: 0,
    };
    const b_top1Counts: Record<Category, number> = {
      wealth: 0, love: 0, health: 0, career: 0, relations: 0, study: 0,
    };
    const b_bottom1Counts: Record<Category, number> = {
      wealth: 0, love: 0, health: 0, career: 0, relations: 0, study: 0,
    };

    for (let dayOffset = 0; dayOffset < 365; dayOffset++) {
      const date = new Date(2026, 0, 1 + dayOffset);
      const fortune = agg.getDailyFortune(date);

      // A: 현재 점수 (displayScores 우선)
      const a_scores = fortune.persisted?.displayScores ?? fortune.scores;

      a_overalls.push(a_scores.overall ?? 0);
      a_categoryRanges.push(categoryRange(a_scores));
      a_categoryStdDevs.push(categoryStdDev(a_scores));

      for (const cat of CAT_KEYS) {
        a_categorySums[cat] += a_scores[cat];
      }

      const a_sorted = CAT_KEYS.slice().sort((a, b) => a_scores[b] - a_scores[a]);
      a_top1Counts[a_sorted[0]]++;
      a_bottom1Counts[a_sorted[5]]++;

      // B: 수렴 제거 시뮬레이션
      // 압축 공식: compressed = avg + (original - avg) * 0.75
      // 역산: original = avg + (compressed - avg) / 0.75
      const a_catAvg = CAT_KEYS.reduce((s, c) => s + a_scores[c], 0) / CAT_KEYS.length;

      const b_scores: Record<Category, number> = {} as any;
      for (const cat of CAT_KEYS) {
        // 역산하여 원본 분산 추정
        const compressed = a_scores[cat];
        const original = a_catAvg + (compressed - a_catAvg) / 0.75;
        b_scores[cat] = Math.max(0, Math.min(100, Math.round(original)));
      }

      const b_overall = CAT_KEYS.reduce((s, c) => s + b_scores[c], 0) / CAT_KEYS.length;
      b_overalls.push(b_overall);
      b_categoryRanges.push(categoryRange(b_scores));
      b_categoryStdDevs.push(categoryStdDev(b_scores));

      for (const cat of CAT_KEYS) {
        b_categorySums[cat] += b_scores[cat];
      }

      const b_sorted = CAT_KEYS.slice().sort((a, b) => b_scores[b] - b_scores[a]);
      b_top1Counts[b_sorted[0]]++;
      b_bottom1Counts[b_sorted[5]]++;
    }

    const a_category_means: Record<Category, number> = {} as any;
    const b_category_means: Record<Category, number> = {} as any;
    for (const cat of CAT_KEYS) {
      a_category_means[cat] = a_categorySums[cat] / 365;
      b_category_means[cat] = b_categorySums[cat] / 365;
    }

    results.push({
      profileId: pConfig.id,

      a_overall_mean: mean(a_overalls),
      a_overall_stddev: stdDev(a_overalls),
      a_overall_range: Math.max(...a_overalls) - Math.min(...a_overalls),
      a_category_means,
      a_category_range_mean: mean(a_categoryRanges),
      a_category_stddev_mean: mean(a_categoryStdDevs),
      a_top1_counts: a_top1Counts,
      a_bottom1_counts: a_bottom1Counts,

      b_overall_mean: mean(b_overalls),
      b_overall_stddev: stdDev(b_overalls),
      b_overall_range: Math.max(...b_overalls) - Math.min(...b_overalls),
      b_category_means,
      b_category_range_mean: mean(b_categoryRanges),
      b_category_stddev_mean: mean(b_categoryStdDevs),
      b_top1_counts: b_top1Counts,
      b_bottom1_counts: b_bottom1Counts,
    });
  }

  console.log(`Total: ${results.length} profiles`);
  console.log("");

  // PART A: Overall 분포 비교
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("PART A. Overall 분포 비교");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const a_overall_means = results.map(r => r.a_overall_mean);
  const b_overall_means = results.map(r => r.b_overall_mean);
  const a_overall_ranges = results.map(r => r.a_overall_range);
  const b_overall_ranges = results.map(r => r.b_overall_range);
  const a_overall_stddevs = results.map(r => r.a_overall_stddev);
  const b_overall_stddevs = results.map(r => r.b_overall_stddev);

  console.log("A (WITH_CONVERGENCE):");
  console.log("─".repeat(80));
  console.log(`  Mean: ${mean(a_overall_means).toFixed(2)}`);
  console.log(`  Median: ${median(a_overall_means).toFixed(2)}`);
  console.log(`  P90: ${percentile(a_overall_means, 90).toFixed(2)}`);
  console.log(`  P95: ${percentile(a_overall_means, 95).toFixed(2)}`);
  console.log(`  Range Mean: ${mean(a_overall_ranges).toFixed(2)}`);
  console.log(`  StdDev Mean: ${mean(a_overall_stddevs).toFixed(2)}`);
  console.log("");

  console.log("B (NO_CONVERGENCE):");
  console.log("─".repeat(80));
  console.log(`  Mean: ${mean(b_overall_means).toFixed(2)}`);
  console.log(`  Median: ${median(b_overall_means).toFixed(2)}`);
  console.log(`  P90: ${percentile(b_overall_means, 90).toFixed(2)}`);
  console.log(`  P95: ${percentile(b_overall_means, 95).toFixed(2)}`);
  console.log(`  Range Mean: ${mean(b_overall_ranges).toFixed(2)}`);
  console.log(`  StdDev Mean: ${mean(b_overall_stddevs).toFixed(2)}`);
  console.log("");

  console.log("차이:");
  console.log("─".repeat(80));
  console.log(`  Mean: ${(mean(b_overall_means) - mean(a_overall_means)).toFixed(2)}`);
  console.log(`  Range Mean: ${(mean(b_overall_ranges) - mean(a_overall_ranges)).toFixed(2)}`);
  console.log(`  StdDev Mean: ${(mean(b_overall_stddevs) - mean(a_overall_stddevs)).toFixed(2)}`);
  console.log("");

  // PART B: Category Mean 비교
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("PART B. Category Mean 비교");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  for (const cat of CAT_KEYS) {
    const a_cat_means = results.map(r => r.a_category_means[cat]);
    const b_cat_means = results.map(r => r.b_category_means[cat]);

    const a_mean = mean(a_cat_means);
    const b_mean = mean(b_cat_means);
    const diff = b_mean - a_mean;

    console.log(`${cat}:`);
    console.log(`  A Mean: ${a_mean.toFixed(2)}`);
    console.log(`  B Mean: ${b_mean.toFixed(2)}`);
    console.log(`  차이: ${diff >= 0 ? "+" : ""}${diff.toFixed(2)}`);
    console.log("");
  }

  // PART C: Category Range
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("PART C. Category Range");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const a_cat_ranges = results.map(r => r.a_category_range_mean);
  const b_cat_ranges = results.map(r => r.b_category_range_mean);

  console.log("A (WITH_CONVERGENCE):");
  console.log("─".repeat(80));
  console.log(`  Mean: ${mean(a_cat_ranges).toFixed(2)}`);
  console.log(`  Median: ${median(a_cat_ranges).toFixed(2)}`);
  console.log(`  P90: ${percentile(a_cat_ranges, 90).toFixed(2)}`);
  console.log(`  P95: ${percentile(a_cat_ranges, 95).toFixed(2)}`);
  console.log("");

  console.log("B (NO_CONVERGENCE):");
  console.log("─".repeat(80));
  console.log(`  Mean: ${mean(b_cat_ranges).toFixed(2)}`);
  console.log(`  Median: ${median(b_cat_ranges).toFixed(2)}`);
  console.log(`  P90: ${percentile(b_cat_ranges, 90).toFixed(2)}`);
  console.log(`  P95: ${percentile(b_cat_ranges, 95).toFixed(2)}`);
  console.log("");

  const range_increase_pct = ((mean(b_cat_ranges) - mean(a_cat_ranges)) / mean(a_cat_ranges)) * 100;
  console.log(`증가율: ${range_increase_pct >= 0 ? "+" : ""}${range_increase_pct.toFixed(1)}%`);
  console.log("");

  // PART D: Category StdDev
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("PART D. Category StdDev");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const a_cat_stddevs = results.map(r => r.a_category_stddev_mean);
  const b_cat_stddevs = results.map(r => r.b_category_stddev_mean);

  console.log("A (WITH_CONVERGENCE):");
  console.log("─".repeat(80));
  console.log(`  Mean: ${mean(a_cat_stddevs).toFixed(2)}`);
  console.log(`  Median: ${median(a_cat_stddevs).toFixed(2)}`);
  console.log(`  P90: ${percentile(a_cat_stddevs, 90).toFixed(2)}`);
  console.log(`  P95: ${percentile(a_cat_stddevs, 95).toFixed(2)}`);
  console.log("");

  console.log("B (NO_CONVERGENCE):");
  console.log("─".repeat(80));
  console.log(`  Mean: ${mean(b_cat_stddevs).toFixed(2)}`);
  console.log(`  Median: ${median(b_cat_stddevs).toFixed(2)}`);
  console.log(`  P90: ${percentile(b_cat_stddevs, 90).toFixed(2)}`);
  console.log(`  P95: ${percentile(b_cat_stddevs, 95).toFixed(2)}`);
  console.log("");

  const stddev_increase_pct = ((mean(b_cat_stddevs) - mean(a_cat_stddevs)) / mean(a_cat_stddevs)) * 100;
  console.log(`증가율: ${stddev_increase_pct >= 0 ? "+" : ""}${stddev_increase_pct.toFixed(1)}%`);
  console.log(`기존: ${mean(a_cat_stddevs).toFixed(2)} → 수렴 제거: ${mean(b_cat_stddevs).toFixed(2)}`);
  console.log("");

  // PART E: Top1 분포
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("PART E. Top1 분포");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const a_global_top1: Record<Category, number> = {
    wealth: 0, love: 0, health: 0, career: 0, relations: 0, study: 0,
  };
  const b_global_top1: Record<Category, number> = {
    wealth: 0, love: 0, health: 0, career: 0, relations: 0, study: 0,
  };
  const a_global_bottom1: Record<Category, number> = {
    wealth: 0, love: 0, health: 0, career: 0, relations: 0, study: 0,
  };
  const b_global_bottom1: Record<Category, number> = {
    wealth: 0, love: 0, health: 0, career: 0, relations: 0, study: 0,
  };

  for (const r of results) {
    for (const cat of CAT_KEYS) {
      a_global_top1[cat] += r.a_top1_counts[cat];
      b_global_top1[cat] += r.b_top1_counts[cat];
      a_global_bottom1[cat] += r.a_bottom1_counts[cat];
      b_global_bottom1[cat] += r.b_bottom1_counts[cat];
    }
  }

  const totalDays = results.length * 365;

  console.log("Top1 비율:");
  console.log("─".repeat(80));
  for (const cat of CAT_KEYS) {
    const a_pct = (a_global_top1[cat] / totalDays) * 100;
    const b_pct = (b_global_top1[cat] / totalDays) * 100;
    const diff = b_pct - a_pct;
    console.log(`${cat}: A=${a_pct.toFixed(1)}% → B=${b_pct.toFixed(1)}% (${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%p)`);
  }
  console.log("");

  console.log("Bottom1 비율:");
  console.log("─".repeat(80));
  for (const cat of CAT_KEYS) {
    const a_pct = (a_global_bottom1[cat] / totalDays) * 100;
    const b_pct = (b_global_bottom1[cat] / totalDays) * 100;
    const diff = b_pct - a_pct;
    console.log(`${cat}: A=${a_pct.toFixed(1)}% → B=${b_pct.toFixed(1)}% (${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%p)`);
  }
  console.log("");

  // PART G: 사용자 프로필
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("PART G. 사용자 프로필 (1998-01-22 12:10 부산 남성)");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const userResult = results.find(r => r.profileId === "user")!;

  console.log("A (WITH_CONVERGENCE):");
  console.log("─".repeat(80));
  console.log(`  Study Top1: ${((userResult.a_top1_counts.study / 365) * 100).toFixed(1)}%`);
  console.log(`  Love Top1: ${((userResult.a_top1_counts.love / 365) * 100).toFixed(1)}%`);
  console.log(`  Health Top1: ${((userResult.a_top1_counts.health / 365) * 100).toFixed(1)}%`);
  console.log(`  Category Range: ${userResult.a_category_range_mean.toFixed(2)}`);
  console.log(`  Category StdDev: ${userResult.a_category_stddev_mean.toFixed(2)}`);
  console.log(`  Overall Range: ${userResult.a_overall_range.toFixed(2)}`);
  console.log("");

  console.log("B (NO_CONVERGENCE):");
  console.log("─".repeat(80));
  console.log(`  Study Top1: ${((userResult.b_top1_counts.study / 365) * 100).toFixed(1)}%`);
  console.log(`  Love Top1: ${((userResult.b_top1_counts.love / 365) * 100).toFixed(1)}%`);
  console.log(`  Health Top1: ${((userResult.b_top1_counts.health / 365) * 100).toFixed(1)}%`);
  console.log(`  Category Range: ${userResult.b_category_range_mean.toFixed(2)}`);
  console.log(`  Category StdDev: ${userResult.b_category_stddev_mean.toFixed(2)}`);
  console.log(`  Overall Range: ${userResult.b_overall_range.toFixed(2)}`);
  console.log("");

  // PART H: 품질 판정
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("PART H. 품질 판정");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const stddev_increase = ((mean(b_cat_stddevs) - mean(a_cat_stddevs)) / mean(a_cat_stddevs)) * 100;
  const range_increase = ((mean(b_cat_ranges) - mean(a_cat_ranges)) / mean(a_cat_ranges)) * 100;

  const max_cat_mean_diff = Math.max(...CAT_KEYS.map(cat => {
    const a_mean = mean(results.map(r => r.a_category_means[cat]));
    const b_mean = mean(results.map(r => r.b_category_means[cat]));
    return Math.abs(b_mean - a_mean);
  }));

  const study_top1_diff = ((b_global_top1.study / totalDays) - (a_global_top1.study / totalDays)) * 100;
  const health_bottom1_diff = ((b_global_bottom1.health / totalDays) - (a_global_bottom1.health / totalDays)) * 100;

  console.log("성공 조건 검증:");
  console.log("─".repeat(80));
  console.log("");

  console.log("1. Category StdDev +15% 이상 증가");
  console.log(`   실제: ${stddev_increase >= 0 ? "+" : ""}${stddev_increase.toFixed(1)}%`);
  console.log(`   판정: ${stddev_increase >= 15 ? "✓ PASS" : "✗ FAIL"}`);
  console.log("");

  console.log("2. Category Range +15% 이상 증가");
  console.log(`   실제: ${range_increase >= 0 ? "+" : ""}${range_increase.toFixed(1)}%`);
  console.log(`   판정: ${range_increase >= 15 ? "✓ PASS" : "✗ FAIL"}`);
  console.log("");

  console.log("3. Category Mean 왜곡 1.5점 이하");
  console.log(`   최대: ${max_cat_mean_diff.toFixed(2)}점`);
  console.log(`   판정: ${max_cat_mean_diff <= 1.5 ? "✓ PASS" : "✗ FAIL"}`);
  console.log("");

  console.log("4. Study 과점 증가 5%p 이하");
  console.log(`   실제: ${study_top1_diff >= 0 ? "+" : ""}${study_top1_diff.toFixed(1)}%p`);
  console.log(`   판정: ${Math.abs(study_top1_diff) <= 5 ? "✓ PASS" : "✗ FAIL"}`);
  console.log("");

  console.log("5. Health Bottom1 악화 5%p 이하");
  console.log(`   실제: ${health_bottom1_diff >= 0 ? "+" : ""}${health_bottom1_diff.toFixed(1)}%p`);
  console.log(`   판정: ${Math.abs(health_bottom1_diff) <= 5 ? "✓ PASS" : "✗ FAIL"}`);
  console.log("");

  const p95_range = percentile(b_cat_ranges, 95);
  console.log("6. P95 폭주 없음 (< 12.0)");
  console.log(`   P95 Range: ${p95_range.toFixed(2)}`);
  console.log(`   판정: ${p95_range < 12.0 ? "✓ PASS" : "✗ FAIL"}`);
  console.log("");

  // 최종 결론
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("최종 결론");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");

  const checks = [
    stddev_increase >= 15,
    range_increase >= 15,
    max_cat_mean_diff <= 1.5,
    Math.abs(study_top1_diff) <= 5,
    Math.abs(health_bottom1_diff) <= 5,
    p95_range < 12.0,
  ];

  const passCount = checks.filter(c => c).length;

  let verdict = "";
  let explanation = "";

  if (passCount >= 5) {
    verdict = "B. 수렴 제거 권장";
    explanation = "Category 차이가 충분히 증가하고, 밸런스 악화가 없음. 재미 증가 효과 기대.";
  } else if (passCount >= 4) {
    verdict = "C. 수렴 강도 축소 (0.75 → 0.85)";
    explanation = "일부 지표 미달. 수렴을 완전 제거하는 대신 강도를 줄이는 것을 권장.";
  } else {
    verdict = "A. 수렴 유지";
    explanation = "수렴 제거 시 밸런스 악화 우려. 현재 보정 유지 필요.";
  }

  console.log(`판정: ${verdict}`);
  console.log("");
  console.log(`설명: ${explanation}`);
  console.log("");

  console.log("근거:");
  console.log(`  - Category StdDev 증가: ${stddev_increase.toFixed(1)}% (목표 15%+)`);
  console.log(`  - Category Range 증가: ${range_increase.toFixed(1)}% (목표 15%+)`);
  console.log(`  - Category Mean 왜곡: ${max_cat_mean_diff.toFixed(2)}점 (허용 1.5점)`);
  console.log(`  - Study 과점 변화: ${study_top1_diff >= 0 ? "+" : ""}${study_top1_diff.toFixed(1)}%p (허용 ±5%p)`);
  console.log(`  - Health Bottom1 변화: ${health_bottom1_diff >= 0 ? "+" : ""}${health_bottom1_diff.toFixed(1)}%p (허용 ±5%p)`);
  console.log(`  - P95 Range: ${p95_range.toFixed(2)} (허용 < 12.0)`);
  console.log("");

  console.log("PASS: ${passCount}/6");
  console.log("");

  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log("");
  console.log("주의: 이 결과는 시뮬레이션입니다.");
  console.log("실제 수렴 제거 효과를 확인하려면:");
  console.log("  1. src/engines/aggregator.ts line 202-205 주석 처리");
  console.log("  2. 이 스크립트를 다시 실행하여 A/B 비교");
  console.log("  3. 검증 후 채택 여부 결정");
  console.log("");
  console.log("════════════════════════════════════════════════════════════════════════════════");
}

main();
