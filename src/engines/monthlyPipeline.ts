/**
 * Monthly Pipeline
 *
 * 월 전체(30-31일) raw categoryScores를 수집하고
 * Monthly Stats를 생성한 후
 * 각 날짜별 dailyHighlight를 계산한다.
 *
 * 중요:
 * - raw categoryScores만 사용
 * - displayScores/focus는 Stats 계산에 사용 금지
 * - Engine V2 점수 계산 수정 금지
 */

import type { FortuneAggregator } from "./aggregator";
import type { PersistedDailyModel } from "./persistedDailyMapper";
import { buildPersistedDailyModel } from "./persistedDailyMapper";
import { generateMonthlyCategoryStats, buildDailyHighlight, type MonthlyCategoryStats } from "./dailyHighlight";
import type { ScoreMap } from "./sajuEngine";

/**
 * generateMonthlyModels
 *
 * 해당 월의 모든 날짜에 대해 PersistedDailyModel을 생성한다.
 *
 * @param aggregator - FortuneAggregator 인스턴스
 * @param year - 연도
 * @param month - 월 (1-12)
 * @returns PersistedDailyModel 배열 (날짜 순서)
 *
 * 순서:
 * 1. 해당 월 전체 raw categoryScores 수집
 * 2. generateMonthlyCategoryStats() 호출
 * 3. 각 날짜별 기본 PersistedDailyModel 생성
 * 4. 각 날짜별 buildDailyHighlight() 호출
 * 5. dailyHighlight를 PersistedDailyModel에 추가
 */
export function generateMonthlyModels(
  aggregator: FortuneAggregator,
  year: number,
  month: number,
): PersistedDailyModel[] {
  // Step 1: 해당 월의 날짜 수 계산
  const daysInMonth = new Date(year, month, 0).getDate();

  // Step 2: 해당 월 전체 raw categoryScores 수집
  const dailyRawScores: ScoreMap[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const fortune = aggregator.getDailyFortune(date);

    // IMPORTANT: raw categoryScores만 사용
    dailyRawScores.push(fortune.scores);
  }

  // Step 3: Monthly Stats 생성
  const period = `${year}-${String(month).padStart(2, "0")}`;
  const monthlyStats = generateMonthlyCategoryStats(dailyRawScores, period);

  // Step 4: 각 날짜별 PersistedDailyModel 생성 + dailyHighlight 추가
  const models: PersistedDailyModel[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const fortune = aggregator.getDailyFortune(date);

    // dailyHighlight 생성 및 fortune 객체에 추가
    const dailyHighlight = buildDailyHighlight(fortune.scores, monthlyStats);
    fortune.dailyHighlight = dailyHighlight;

    // PersistedDailyModel 생성 (fortune.dailyHighlight 포함)
    const model = buildPersistedDailyModel(fortune);

    // fortune.persisted에도 설정 (buildAiDailyRequestV2가 참조)
    fortune.persisted = model;

    models.push(model);
  }

  return models;
}

/**
 * generateSingleDayModel
 *
 * 단일 날짜에 대해 PersistedDailyModel을 생성한다.
 * monthlyStats를 외부에서 전달받는다.
 *
 * @param aggregator - FortuneAggregator 인스턴스
 * @param date - 날짜
 * @param monthlyStats - 해당 월의 Monthly Stats
 * @returns PersistedDailyModel
 *
 * 용도:
 * - 월 전체 생성 후 특정 날짜만 재생성
 * - monthlyStats가 이미 있는 경우
 */
export function generateSingleDayModel(
  aggregator: FortuneAggregator,
  date: Date,
  monthlyStats: MonthlyCategoryStats,
): PersistedDailyModel {
  const fortune = aggregator.getDailyFortune(date);

  // dailyHighlight 생성 및 fortune 객체에 추가
  const dailyHighlight = buildDailyHighlight(fortune.scores, monthlyStats);
  fortune.dailyHighlight = dailyHighlight;

  // PersistedDailyModel 생성 (fortune.dailyHighlight 포함)
  const model = buildPersistedDailyModel(fortune);

  // fortune.persisted에도 설정 (buildAiDailyRequestV2가 참조)
  fortune.persisted = model;

  return model;
}
