import type { DailyFortune } from "../engines/aggregator";
import { safeResolveLabel, FLOW_LABELS, STATE_LABELS } from "../constants/fortuneDictionary";
import { getEventEffects } from "./eventEffects";
import type { AiDailyRequest } from "./types";

// ── Constants ──────────────────────────────────────────────────────────────────

const MAX_TOP_EVENTS = 5;
const MAX_TOP_STATES = 5;

const CATEGORY_LABELS: Record<string, string> = {
  wealth:    "재물",
  love:      "애정",
  health:    "건강",
  career:    "직업",
  relations: "관계",
  study:     "학습",
};
// timeSegments index mapping (6 phases: 0=00-05, 1=05-09, 2=09-13, 3=13-17, 4=17-21, 5=21-24)
const MORNING_INDICES   = [1, 2]; // 05-13 → 오전
const AFTERNOON_INDICES = [3, 4]; // 13-21 → 오후
const EVENING_INDEX     = 5;      // 21-24 → 저녁

// ── Helpers ────────────────────────────────────────────────────────────────────

function strengthToScale(s: number): number {
  // PersistedState.strength is 0–1; AI request wants 1–5
  if (s >= 0.8) return 5;
  if (s >= 0.6) return 4;
  if (s >= 0.4) return 3;
  if (s >= 0.2) return 2;
  return 1;
}

function avgScore(segments: NonNullable<DailyFortune["timeSegments"]>, indices: number[]): number {
  const valid = indices
    .map(i => segments[i])
    .filter(Boolean)
    .map(s => s.score);
  if (valid.length === 0) return 0;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

/**
 * Find the state keys most relevant to a segment, based on sourceEvents overlap
 * with the segment's topEvents.
 * - Match: up to 2 intersecting states
 * - No match (fallback): top 1 global state only, to reduce identical-across-segments output
 */
function dominantStatesForSegment(
  segmentTopEvents: string[],
  topStates: NonNullable<DailyFortune["persisted"]>["topStates"],
): string[] {
  if (topStates.length === 0) return [];

  const toLabel = (st: (typeof topStates)[number]) =>
    STATE_LABELS[st.key] ?? safeResolveLabel(st.key);

  // States whose sourceEvents intersect with this segment's topEvents
  if (segmentTopEvents.length > 0) {
    const intersecting = topStates.filter(st =>
      st.sourceEvents.some(e => segmentTopEvents.includes(e))
    );
    if (intersecting.length > 0) {
      return intersecting.slice(0, 2).map(toLabel);
    }
  }

  // Fallback: 1 global top state (avoids identical 2-state output across all segments)
  return topStates.slice(0, 1).map(toLabel);
}

// ── Main function ──────────────────────────────────────────────────────────────

/**
 * Convert a DailyFortune into an AiDailyRequest for the AI interpretation API.
 * Never throws — missing optional fields produce safe empty defaults.
 */
export function buildAiDailyRequest(fortune: DailyFortune): AiDailyRequest {
  const persisted = fortune.persisted;

  // ── flowType ──────────────────────────────────────────────────────────────
  const flowKey   = persisted?.summary?.flowType ?? "flow.neutral";
  const flowLabel = FLOW_LABELS[flowKey] ?? safeResolveLabel(flowKey);

  // ── topEvents ─────────────────────────────────────────────────────────────
  const topEvents = (persisted?.topEvents ?? [])
    .slice(0, MAX_TOP_EVENTS)
    .map(chip => ({
      label:   safeResolveLabel(chip.key),
      effects: getEventEffects(chip.key),
    }));

  // ── topStates ─────────────────────────────────────────────────────────────
  const topStates = (persisted?.topStates ?? [])
    .slice(0, MAX_TOP_STATES)
    .map(st => ({
      label:    STATE_LABELS[st.key] ?? safeResolveLabel(st.key),
      strength: strengthToScale(st.strength),
    }));

  // ── categoryHighlights ────────────────────────────────────────────────────
  const catHighlightsMap = persisted?.categoryHighlights ?? {};
  const categoryHighlights = (Object.keys(catHighlightsMap) as (keyof typeof catHighlightsMap)[])
    .map(cat => ({
      label: CATEGORY_LABELS[cat] ?? cat,
      score: fortune.scores[cat] ?? 0,
    }))
    .filter(c => c.score > 0);

  // ── timeFlow ──────────────────────────────────────────────────────────────
  const segments = fortune.timeSegments ?? [];
  const persistedTopStates = persisted?.topStates ?? [];

  const getSegmentTopEvents = (indices: number[]): string[] =>
    indices.flatMap(i => segments[i]?.topEvents ?? []);

  const morningTopEvents   = getSegmentTopEvents(MORNING_INDICES);
  const afternoonTopEvents = getSegmentTopEvents(AFTERNOON_INDICES);
  const eveningTopEvents   = segments[EVENING_INDEX]?.topEvents ?? [];

  const timeFlow: AiDailyRequest["timeFlow"] = [
    {
      label:          "오전",
      score:          avgScore(segments, MORNING_INDICES),
      dominantStates: dominantStatesForSegment(morningTopEvents, persistedTopStates),
    },
    {
      label:          "오후",
      score:          avgScore(segments, AFTERNOON_INDICES),
      dominantStates: dominantStatesForSegment(afternoonTopEvents, persistedTopStates),
    },
    {
      label:          "저녁",
      score:          segments[EVENING_INDEX]?.score ?? 0,
      dominantStates: dominantStatesForSegment(eveningTopEvents, persistedTopStates),
    },
  ];

  return {
    date: fortune.date,
    flowType: { key: flowKey, label: flowLabel },
    topEvents,
    topStates,
    categoryHighlights,
    timeFlow,
  };
}
