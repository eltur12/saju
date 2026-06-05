import type { DailyFortune } from "../engines/aggregator";
import type { AiInterpretationRequest, AiEvent, AiCategoryHighlight, AiTimeHighlights, AiSignalLayer } from "./types";
import { getEventLabel } from "./eventLabels";
import { safeResolveLabel } from "../constants/fortuneDictionary";

const SIGNIFICANT_DIFF = 10;

export interface MonthContext {
  /** 해당 월 전체 display score 배열 (index 0 = 1일) */
  displayScores: number[];
  flowType: string;
  palace:   string;
}

function buildSignalLayer(
  todayScore: number,
  dayIdx:     number,
  ctx:        MonthContext,
): AiSignalLayer {
  const scores   = ctx.displayScores;
  const n        = scores.length;
  const prevScore = dayIdx > 0       ? scores[dayIdx - 1] : undefined;
  const nextScore = dayIdx < n - 1   ? scores[dayIdx + 1] : undefined;

  // ── monthPosition ────────────────────────────────────────────────────────────
  const maxScore  = Math.max(...scores);
  const minScore  = Math.min(...scores);
  const rank      = scores.filter(s => s > todayScore).length + 1;
  const percentile = Math.round(scores.filter(s => s < todayScore).length / n * 100);
  const monthPosition: AiSignalLayer["monthPosition"] = {
    rank,
    totalDays:         n,
    percentile,
    isMonthlyHigh:     todayScore === maxScore,
    isMonthlyLow:      todayScore === minScore,
    isTop10Percent:    percentile >= 90,
    isBottom10Percent: percentile <= 10,
  };

  // ── dailyCompare ──────────────────────────────────────────────────────────────
  const prevDiff = prevScore !== undefined ? todayScore - prevScore : undefined;
  const nextDiff = nextScore !== undefined ? nextScore - todayScore  : undefined;

  const isRiseFromPrev  = prevDiff !== undefined && prevDiff >= SIGNIFICANT_DIFF;
  const isDropFromPrev  = prevDiff !== undefined && prevDiff <= -SIGNIFICANT_DIFF;
  const isRiseToNext    = nextDiff !== undefined && nextDiff >= SIGNIFICANT_DIFF;
  const isDropToNext    = nextDiff !== undefined && nextDiff <= -SIGNIFICANT_DIFF;

  const isPeak = prevScore !== undefined && nextScore !== undefined
    && prevScore < todayScore && todayScore > nextScore
    && (prevDiff! >= SIGNIFICANT_DIFF || nextDiff! <= -SIGNIFICANT_DIFF);
  const isValley = prevScore !== undefined && nextScore !== undefined
    && prevScore > todayScore && todayScore < nextScore
    && (prevDiff! <= -SIGNIFICANT_DIFF || nextDiff! >= SIGNIFICANT_DIFF);

  const dailyCompare: AiSignalLayer["dailyCompare"] = {
    ...(prevDiff !== undefined ? { prevDiff } : {}),
    ...(nextDiff !== undefined ? { nextDiff } : {}),
    isRiseFromPrev,
    isDropFromPrev,
    isRiseToNext,
    isDropToNext,
    isPeak,
    isValley,
  };

  const signal: AiSignalLayer = {
    ...(ctx.palace     ? { monthlyPalace: { label: ctx.palace } }                                                       : {}),
    ...(ctx.flowType   ? { monthlyFlowType: ctx.flowType as AiSignalLayer["monthlyFlowType"] } : {}),
    monthPosition,
    dailyCompare,
  };

  return signal;
}

const CAT_KEYS = ["wealth", "love", "health", "career", "relations", "study"] as const;
type CatKey = typeof CAT_KEYS[number];

function toAiEvent(chip: { key: string; impact: number; polarity: string }): AiEvent {
  const ev: AiEvent = { label: getEventLabel(chip.key) };
  if (chip.impact) ev.impact = chip.impact;
  if (chip.polarity !== "neutral") ev.polarity = chip.polarity as AiEvent["polarity"];
  return ev;
}

/**
 * Convert a DailyFortune into an AiInterpretationRequest for the AI interpretation API.
 * Pass monthCtx to include signalLayer (position & daily-compare signals).
 * Never throws — missing optional fields produce safe empty defaults.
 */
export function buildAiDailyRequest(fortune: DailyFortune, monthCtx?: MonthContext): AiInterpretationRequest {
  const persisted = fortune.persisted;
  const scores    = fortune.scores;

  // ── events ────────────────────────────────────────────────────────────────
  // saju.star.* 활성화됨 — unknown만 제외
  const topEvents = (persisted?.topEvents ?? []).filter(c =>
    !c.key.startsWith("unknown.")
  );
  const majorEvents:      AiEvent[] = topEvents.slice(0, 3).map(toAiEvent);
  const minorEvents:      AiEvent[] = topEvents.slice(3, 6).map(toAiEvent);
  const backgroundEvents: AiEvent[] = topEvents.slice(6, 8).map(toAiEvent);

  // ── scores ────────────────────────────────────────────────────────────────
  const catScore: Record<CatKey, number> = {
    wealth:    scores.wealth    ?? 0,
    love:      scores.love      ?? 0,
    health:    scores.health    ?? 0,
    career:    scores.career    ?? 0,
    relations: scores.relations ?? 0,
    study:     scores.study     ?? 0,
  };

  // ── categoryHighlights: top-2 + bottom-1 ─────────────────────────────────
  const catMap = persisted?.categoryHighlights ?? {};
  const allCats: AiCategoryHighlight[] = CAT_KEYS
    .filter(k => catScore[k] > 0 && catMap[k])
    .map(k => ({
      label:     k,
      score:     catScore[k],
      topEvents: (catMap[k]?.topEvents ?? []).filter(e => !e.startsWith("unknown.")).map(getEventLabel),
    }))
    .sort((a, b) => b.score - a.score);

  const selectedCats: AiCategoryHighlight[] = [];
  const seen = new Set<string>();
  for (const cat of allCats.slice(0, 2)) { selectedCats.push(cat); seen.add(cat.label); }
  const bottom = allCats[allCats.length - 1];
  if (bottom && !seen.has(bottom.label)) selectedCats.push(bottom);

  // ── timeHighlights ────────────────────────────────────────────────────────
  const tss   = fortune.timeSegmentSummary;
  const hints = fortune.notificationHints ?? [];
  let timeHighlights: AiTimeHighlights | undefined;

  if (tss) {
    const hasRise   = (tss.rise?.delta ?? 0) >= 12;
    const hasDrop   = (tss.drop?.delta ?? 0) >= 12;
    const hasWide   = (tss.best.score - tss.worst.score) >= 25;
    const hasCaution = hints.some(h => h.type === "caution_window");
    const significant = hasRise || hasDrop || hasWide || hasCaution;

    const cautionHint = hints.find(h => h.type === "caution_window");

    timeHighlights = {
      significant,
      best:    { hour: tss.best.startHour },
      caution: { hour: cautionHint?.hour ?? tss.worst.startHour },
      ...(tss.rise ? { rise: { fromHour: tss.rise.fromHour, toHour: tss.rise.toHour, delta: tss.rise.delta } } : {}),
      ...(tss.drop ? { drop: { fromHour: tss.drop.fromHour, toHour: tss.drop.toHour, delta: tss.drop.delta } } : {}),
    };
  }

  // ── monthlyPalace ─────────────────────────────────────────────────────────
  const mp = persisted?.monthlyPalace;
  const monthlyPalace = mp
    ? { key: mp.key, label: getEventLabel(mp.key) }
    : undefined;

  const profileSpecialStars = fortune.profileSpecialStars?.length
    ? fortune.profileSpecialStars
    : undefined;

  // ── signalLayer ───────────────────────────────────────────────────────────
  let signalLayer: AiSignalLayer | undefined;
  if (monthCtx && fortune.date) {
    const dayIdx = parseInt(fortune.date.slice(8, 10), 10) - 1;
    if (dayIdx >= 0 && dayIdx < monthCtx.displayScores.length) {
      signalLayer = buildSignalLayer(scores.overall ?? 0, dayIdx, monthCtx);
    }
  }

  // ── focus ─────────────────────────────────────────────────────────────────
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
        category:     f.category as "wealth" | "love" | "health" | "career" | "relations" | "study",
        label:        f.label,
        strength:     f.strength,
        sourceKeys:   f.sourceKeys || [],
        sourceLabels,
      };
    });

  // ── dailyHighlight ────────────────────────────────────────────────────────
  const dailyHighlight = persisted?.dailyHighlight
    ? {
        category:  persisted.dailyHighlight.category as "wealth" | "love" | "health" | "career" | "relations" | "study",
        direction: persisted.dailyHighlight.direction,
        strength:  persisted.dailyHighlight.strength,
      }
    : undefined;

  return {
    date:     fortune.date,
    overall:  scores.overall ?? 0,
    flowType: persisted?.summary?.flowType,
    scores:   catScore,
    majorEvents,
    minorEvents,
    backgroundEvents,
    categoryHighlights: selectedCats,
    timeHighlights,
    monthlyPalace,
    profileSpecialStars,
    signalLayer,
    focus,
    dailyHighlight,
  };
}
