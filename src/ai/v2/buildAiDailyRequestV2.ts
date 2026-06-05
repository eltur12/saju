/**
 * buildAiDailyRequestV2 — DailyFortune → AiInterpretationRequestV2
 */

import type { DailyFortune } from "../../engines/aggregator";
import type { MonthContext }  from "../buildAiDailyRequest";
import {
  V2_STATE_KEYS, STATE_META,
  type V2StateKey, type CategoryKey,
  type AiInterpretationRequestV2,
  type V2StateDebugEntry, type V2CatDriverDebug, type V2BuildDebug,
} from "./types";
import { EVENT_STATE_MAP, KNOWN_EVENT_KEYS } from "./eventStateMap";
import { STATE_LABELS } from "./stateDictionary";
import { EVENT_LABELS } from "./eventDictionary";
import { safeResolveLabel } from "../../constants/fortuneDictionary";

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * tanh 정규화 기준 스케일.
 * strength = tanh(|rawAcc| / STATE_NORM_SCALE)
 * rawAcc ≈ scale → strength ≈ 0.76, rawAcc ≈ 2×scale → strength ≈ 0.96
 * 10으로 설정 시 impact=2~3 이벤트 1개 기여 ≈ 0.3~0.5, 대형 이벤트(14+) ≈ 0.90~0.99
 */
export const STATE_NORM_SCALE = 10;

const MAX_TOP_EVENTS   = 6;   // major + minor, background 제외
const MAX_TOP_STATES   = 8;
const MAX_CAT_DRIVERS  = 3;
const SIGNIFICANT_DIFF = 10;
const MIN_DRIVER_RAW   = 0.1; // driver 선정 최소 |rawAcc|

const CAT_KEYS: readonly CategoryKey[] = ["wealth", "love", "health", "career", "relations", "study"];

// ── Category → relevant V2 states (우선순위 순) ───────────────────────────────

export const V2_CAT_STATES: Record<CategoryKey, readonly V2StateKey[]> = {
  wealth:    ["executionFlow", "securityNeed", "persistence", "decision", "stability", "adaptation", "optimism"],
  love:      ["connection", "longing", "emotionalAmplitude", "sensitivity", "charm", "distance", "misalignment"],
  health:    ["energySustain", "needForRest", "fatigueLoad", "stability", "restlessness", "sensitivity"],
  career:    ["executionFlow", "focus", "persistence", "initiative", "decision", "urgency", "clarity", "recognition"],
  relations: ["connection", "distance", "misalignment", "boundaries", "expression", "articulation", "charm"],
  study:     ["focus", "clarity", "curiosity", "reflection", "insight", "confusion"],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * rawAcc 부호와 STATE_META.defaultPolarity를 합산해 최종 polarity 결정.
 *  - rawAcc > 0: state가 자연 방향으로 활성 → defaultPolarity 그대로
 *  - rawAcc < 0: state가 억제됨 → positive↔negative 반전 (positive 상태 억제 = negative 체감)
 *  - mixed는 항상 mixed 유지
 */
function computePolarity(
  rawAcc: number,
  defaultPol: "positive" | "negative" | "mixed",
): "positive" | "negative" | "mixed" {
  if (Math.abs(rawAcc) < 0.01 || defaultPol === "mixed") return "mixed";
  if (rawAcc > 0) return defaultPol;
  return defaultPol === "positive" ? "negative" : "positive";
}

/**
 * driver의 polarity 방향이 category score 방향과 일치하는지 확인.
 * catScore > catAvg + 3 → 양호, 양성 driver가 자연스럽다.
 * catScore < catAvg - 3 → 부진, 음성 driver가 자연스럽다.
 * 그 사이는 중립 → 모두 align=true.
 */
function alignsWithScore(
  finalPolarity: "positive" | "negative" | "mixed",
  catScore: number,
  catAvg: number,
): boolean {
  const ZONE = 3;
  const diff = catScore - catAvg;
  if (Math.abs(diff) < ZONE) return true;
  if (diff > 0) return finalPolarity === "positive" || finalPolarity === "mixed";
  return finalPolarity === "negative" || finalPolarity === "mixed";
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface V2BuildResult {
  request:      AiInterpretationRequestV2;
  unmappedKeys: string[];
  debug:        V2BuildDebug;
}

/**
 * 실험용 파라미터 — baseline 동작을 변경하지 않는 optional override
 */
export interface V2ExperimentParams {
  /** EventStateMap의 특정 항목을 대체/추가. 없는 키는 global map 사용 */
  eventStateMapOverride?: Record<string, import("./eventStateMap").StateImpact>;
  /**
   * 카테고리별 driver 선정 시 특정 state의 rawAcc 가중치.
   * 값 < 1 이면 해당 state가 driver 경쟁에서 불리해짐.
   * e.g. { career: { urgency: 0.7 } }
   */
  catStateWeights?: Partial<Record<CategoryKey, Partial<Record<V2StateKey, number>>>>;
}

export function buildAiDailyRequestV2(
  fortune:   DailyFortune,
  monthCtx?: MonthContext,
  exp?:      V2ExperimentParams,
): V2BuildResult {
  const persisted = fortune.persisted;
  const scores    = fortune.scores;

  // ── 1. topEvents ─────────────────────────────────────────────────────────
  // saju.star.* 활성화됨 — unknown만 제외
  const foregroundEvents = (persisted?.topEvents ?? [])
    .filter(e => !e.key.startsWith("unknown."))
    .slice(0, MAX_TOP_EVENTS);

  const topEvents: AiInterpretationRequestV2["topEvents"] = foregroundEvents.map(e => ({
    key:      e.key,
    label:    EVENT_LABELS[e.key] ?? e.key,
    impact:   +e.impact.toFixed(2),
    polarity: e.polarity as "positive" | "negative" | "mixed",
  }));

  const unmappedKeys = foregroundEvents.map(e => e.key).filter(k => !KNOWN_EVENT_KEYS.has(k));

  // ── 2. State accumulation ─────────────────────────────────────────────────
  const accRaw: Partial<Record<V2StateKey, number>> = {};

  const activeEventMap = exp?.eventStateMapOverride
    ? { ...EVENT_STATE_MAP, ...exp.eventStateMapOverride }
    : EVENT_STATE_MAP;

  for (const ev of foregroundEvents) {
    const stateImpact = activeEventMap[ev.key];
    if (!stateImpact) continue;
    for (const [sk, coeff] of Object.entries(stateImpact) as [V2StateKey, number][]) {
      accRaw[sk] = (accRaw[sk] ?? 0) + ev.impact * coeff;
    }
  }

  // ── 3. topStates — tanh 정규화, STATE_META polarity ───────────────────────
  const allStatesSorted: Array<{ key: V2StateKey; raw: number }> = V2_STATE_KEYS
    .map(k => ({ key: k, raw: accRaw[k] ?? 0 }))
    .filter(s => Math.abs(s.raw) > 0.01)
    .sort((a, b) => Math.abs(b.raw) - Math.abs(a.raw));

  const topStates: AiInterpretationRequestV2["topStates"] = allStatesSorted
    .slice(0, MAX_TOP_STATES)
    .map(({ key, raw }) => ({
      key,
      label:    STATE_LABELS[key],
      strength: +Math.tanh(Math.abs(raw) / STATE_NORM_SCALE).toFixed(3),
      polarity: computePolarity(raw, STATE_META[key].defaultPolarity),
    }));

  // rawAcc 빠른 조회용
  const rawAccMap = new Map<V2StateKey, number>(allStatesSorted.map(s => [s.key, s.raw]));

  // ── 4. scores ─────────────────────────────────────────────────────────────
  const catScore = {} as Record<CategoryKey, number>;
  for (const cat of CAT_KEYS) catScore[cat] = (scores[cat] as number) ?? 0;

  const catAvgScore = CAT_KEYS.reduce((s, c) => s + catScore[c], 0) / CAT_KEYS.length;

  // ── 5. categoryHighlights — 카테고리별 실제 기여 state 기준 ────────────────
  //
  // V2_CAT_STATES[cat]에 속하는 state 중 rawAcc가 큰 것을 driver로 선정.
  // "실제 기여" = event → EventStateMap → state → V2_CAT_STATES[cat] 경로를 통해
  // 누적된 rawAcc. 카테고리별로 관련 state만 필터링하므로 전역 topStates에
  // 없는 state라도 해당 카테고리에 기여했다면 driver가 될 수 있다.

  const categoryHighlights = {} as Record<CategoryKey, { score: number; drivers: V2StateKey[] }>;
  for (const cat of CAT_KEYS) {
    const weights = exp?.catStateWeights?.[cat] ?? {};
    const drivers = V2_CAT_STATES[cat]
      .filter(k => Math.abs(rawAccMap.get(k) ?? 0) >= MIN_DRIVER_RAW)
      .sort((a, b) => {
        const wa = weights[a] ?? 1;
        const wb = weights[b] ?? 1;
        return Math.abs(rawAccMap.get(b) ?? 0) * wb - Math.abs(rawAccMap.get(a) ?? 0) * wa;
      })
      .slice(0, MAX_CAT_DRIVERS);

    categoryHighlights[cat] = { score: catScore[cat], drivers };
  }

  // ── 6. monthlyPosition + dailyCompare ─────────────────────────────────────
  let monthlyPosition: AiInterpretationRequestV2["monthlyPosition"];
  let dailyCompare:    AiInterpretationRequestV2["dailyCompare"];

  if (monthCtx && fortune.date) {
    const dayIdx = parseInt(fortune.date.slice(8, 10), 10) - 1;
    const s = monthCtx.displayScores;
    const n = s.length;
    const todayScore = scores.overall as number;

    if (dayIdx >= 0 && dayIdx < n) {
      const maxScore   = Math.max(...s);
      const minScore   = Math.min(...s);
      const rank       = s.filter(v => v > todayScore).length + 1;
      const percentile = Math.round(s.filter(v => v < todayScore).length / n * 100);
      const prevScore  = dayIdx > 0     ? s[dayIdx - 1] : undefined;
      const nextScore  = dayIdx < n - 1 ? s[dayIdx + 1] : undefined;
      const prevDiff   = prevScore !== undefined ? todayScore - prevScore : 0;
      const nextDiff   = nextScore !== undefined ? nextScore  - todayScore : 0;

      const isRiseFromPrev = prevScore !== undefined && prevDiff >= SIGNIFICANT_DIFF;
      const isDropFromPrev = prevScore !== undefined && prevDiff <= -SIGNIFICANT_DIFF;
      const isRiseToNext   = nextScore !== undefined && nextDiff >= SIGNIFICANT_DIFF;
      const isDropToNext   = nextScore !== undefined && nextDiff <= -SIGNIFICANT_DIFF;
      const isPeak = prevScore !== undefined && nextScore !== undefined
        && prevScore < todayScore && todayScore > nextScore
        && (prevDiff >= SIGNIFICANT_DIFF || nextDiff <= -SIGNIFICANT_DIFF);
      const isValley = prevScore !== undefined && nextScore !== undefined
        && prevScore > todayScore && todayScore < nextScore
        && (prevDiff <= -SIGNIFICANT_DIFF || nextDiff >= SIGNIFICANT_DIFF);

      const posFlags: string[] = [];
      if (todayScore === maxScore) posFlags.push("monthlyHigh");
      if (todayScore === minScore) posFlags.push("monthlyLow");
      if (percentile >= 90)        posFlags.push("top10");
      if (percentile <= 10)        posFlags.push("bottom10");
      if (isPeak)                  posFlags.push("peak");
      if (isValley)                posFlags.push("valley");

      monthlyPosition = { rank, totalDays: n, percentile, flags: posFlags };

      const dcFlags: string[] = [];
      if (isRiseFromPrev) dcFlags.push("riseFromPrev");
      if (isDropFromPrev) dcFlags.push("dropFromPrev");
      if (isRiseToNext)   dcFlags.push("riseToNext");
      if (isDropToNext)   dcFlags.push("dropToNext");
      if (isPeak)         dcFlags.push("peak");
      if (isValley)       dcFlags.push("valley");

      dailyCompare = { prevDiff, nextDiff, flags: dcFlags };
    }
  }

  // ── 7. keyMoment ──────────────────────────────────────────────────────────
  const tss   = fortune.timeSegmentSummary;
  const hints = fortune.notificationHints ?? [];
  let keyMoment: AiInterpretationRequestV2["keyMoment"];

  if (tss) {
    const hasRise    = (tss.rise?.delta ?? 0) >= 12;
    const hasDrop    = (tss.drop?.delta ?? 0) >= 12;
    const hasWide    = (tss.best.score - tss.worst.score) >= 25;
    const hasCaution = hints.some(h => h.type === "caution_window");

    if (hasRise || hasDrop || hasWide || hasCaution) {
      if (hasRise && tss.rise) {
        keyMoment = { type: "rise", hour: tss.rise.fromHour, delta: tss.rise.delta };
      } else if (hasDrop && tss.drop) {
        keyMoment = { type: "drop", hour: tss.drop.fromHour, delta: tss.drop.delta };
      } else if (tss.best) {
        keyMoment = { type: "peak", hour: tss.best.startHour };
      } else {
        const ch = hints.find(h => h.type === "caution_window");
        if (ch) keyMoment = { type: "caution", hour: ch.hour };
      }
    }
  }

  // ── 8. Debug ──────────────────────────────────────────────────────────────
  const stateAccumulation: V2StateDebugEntry[] = allStatesSorted.map(({ key, raw }) => ({
    key,
    rawAcc:             +raw.toFixed(3),
    normalizedStrength: +Math.tanh(Math.abs(raw) / STATE_NORM_SCALE).toFixed(3),
    defaultPolarity:    STATE_META[key].defaultPolarity,
    finalPolarity:      computePolarity(raw, STATE_META[key].defaultPolarity),
  }));

  const catDriverDetails = {} as Record<CategoryKey, V2CatDriverDebug[]>;
  for (const cat of CAT_KEYS) {
    const entries: V2CatDriverDebug[] = V2_CAT_STATES[cat]
      .map(k => {
        const raw = rawAccMap.get(k) ?? 0;
        const fp  = computePolarity(raw, STATE_META[k].defaultPolarity);
        return {
          state:      k,
          catContrib: +raw.toFixed(3),
          polarity:   fp,
          aligns:     alignsWithScore(fp, catScore[cat], catAvgScore),
        };
      })
      .filter(e => Math.abs(e.catContrib) >= MIN_DRIVER_RAW)
      .sort((a, b) => Math.abs(b.catContrib) - Math.abs(a.catContrib));

    catDriverDetails[cat] = entries;
  }

  const debug: V2BuildDebug = {
    scale: STATE_NORM_SCALE,
    stateAccumulation,
    catAvgScore: +catAvgScore.toFixed(1),
    catDriverDetails,
  };

  // ── 9. focus ──────────────────────────────────────────────────────────────
  const focus = persisted?.focus
    ?.filter(f => f.category !== "overall")
    .map(f => {
      // sourceLabels: resolve 성공한 label만 포함 (unknown.* 제외)
      const sourceLabels = (f.sourceKeys || [])
        .filter(key => !key.startsWith("unknown."))
        .map(key => {
          const label = safeResolveLabel(key);
          // resolve 실패 시 (label === key) 제외
          return label !== key ? label : null;
        })
        .filter((label): label is string => label !== null);

      return {
        category:     f.category as CategoryKey,
        label:        f.label,
        strength:     f.strength,
        sourceKeys:   f.sourceKeys || [],
        sourceLabels,
      };
    });

  // ── 10. dailyHighlight ────────────────────────────────────────────────────
  const dailyHighlight = persisted?.dailyHighlight
    ? {
        category:  persisted.dailyHighlight.category as CategoryKey,
        direction: persisted.dailyHighlight.direction,
        strength:  persisted.dailyHighlight.strength,
      }
    : undefined;

  // ── 11. Assemble ──────────────────────────────────────────────────────────
  const request: AiInterpretationRequestV2 = {
    date:               fortune.date,
    overall:            scores.overall as number,
    scores:             catScore,
    topEvents,
    topStates,
    categoryHighlights,
    ...(monthlyPosition ? { monthlyPosition } : {}),
    ...(dailyCompare    ? { dailyCompare }    : {}),
    ...(keyMoment       ? { keyMoment }       : {}),
    ...(focus           ? { focus }           : {}),
    ...(dailyHighlight  ? { dailyHighlight }  : {}),
  };

  // ── 12. Log ───────────────────────────────────────────────────────────────
  console.log(`[buildAiDailyRequestV2] ${fortune.date}: focus=${focus ? focus.length : 0}, dailyHighlight=${dailyHighlight ? 'exists' : 'null'}`);

  return { request, unmappedKeys, debug };
}
