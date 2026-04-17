import type { DailyFortune } from "./aggregator";
import type { ScoreMap } from "./sajuEngine";

const SEGMENTS: Array<{ startHour: number; endHour: number; bias: number }> = [
  { startHour:  0, endHour:  6, bias: 0 },
  { startHour:  6, endHour: 10, bias: 0 },
  { startHour: 10, endHour: 14, bias: 0 },
  { startHour: 14, endHour: 18, bias: 0 },
  { startHour: 18, endHour: 22, bias: 0 },
  { startHour: 22, endHour: 24, bias: 0 },
];

// segment index: 0=0~6, 1=6~10, 2=10~14, 3=14~18, 4=18~22, 5=22~24
const PATTERN_BIAS: Record<string, number[]> = {
  focus_day:    [ 0,  0, +3, +2,  0, -1],
  social_day:   [-1,  0,  0, +1, +3,  0],
  recovery_day: [+1,  0, -2,  0,  0, +2],
  balanced_day: [ 0,  0,  0,  0,  0,  0],
};

type DomainKey = keyof Omit<ScoreMap, "overall">;
const DOMAIN_KEYS: DomainKey[] = ["wealth", "love", "health", "career", "relations", "study"];

/** Task 8: 시간대 십성 → 활성 카테고리 매핑 */
const TENGOD_ACTIVE_DOMAIN: Record<string, DomainKey> = {
  "재성": "wealth",
  "관성": "career",
  "식상": "love",
  "인성": "study",
  "비겁": "relations",
};

function dominantDomain(scores: DailyFortune["scores"]): DomainKey {
  return DOMAIN_KEYS.reduce((best, k) => scores[k] > scores[best] ? k : best, DOMAIN_KEYS[0]);
}

function selectPattern(scores: DailyFortune["scores"]): string {
  const dom = dominantDomain(scores);
  if (dom === "career" || dom === "wealth") return "focus_day";
  if (dom === "love"   || dom === "relations") return "social_day";
  if (scores.health < 50) return "recovery_day";
  return "balanced_day";
}

function computeAdjustedBiases(scores: DailyFortune["scores"]): number[] {
  const overall = scores.overall;
  const domainScores = DOMAIN_KEYS.map(k => scores[k]);
  const maxDomain = Math.max(...domainScores);
  const minDomain = Math.min(...domainScores);
  const variance = maxDomain - minDomain;

  const isHighDay  = overall >= 70;
  const isLowDay   = overall <= 45;
  const isVolatile = variance >= 20;
  const isStable   = !isVolatile;

  const biases = SEGMENTS.map(s => s.bias);

  if (isHighDay) {
    biases[2] += 2; biases[3] += 2;
    biases[0] -= 1; biases[5] -= 1;
  }

  if (isLowDay) {
    biases[2] -= 2; biases[3] -= 2;
    biases[4] += 1; biases[5] += 1;
  }

  if (isVolatile) {
    let bestIdx = 0, worstIdx = 0;
    for (let i = 1; i < biases.length; i++) {
      if (biases[i] > biases[bestIdx]) bestIdx = i;
      if (biases[i] < biases[worstIdx]) worstIdx = i;
    }
    biases[bestIdx]  += 2;
    biases[worstIdx] -= 2;
  }

  if (isStable) {
    for (let i = 0; i < biases.length; i++) {
      biases[i] = Math.trunc(biases[i] * 0.7);
    }
  }

  // pattern bias
  const pattern = selectPattern(scores);
  const pBias = PATTERN_BIAS[pattern];
  for (let i = 0; i < biases.length; i++) {
    biases[i] += pBias[i];
  }

  return biases;
}

// v3.1: element per segment
const SEGMENT_ELEMENT = ["水", "木", "火", "土", "金", "水"] as const;

const ELEMENT_GENERATES: Record<string, string> = {
  "木": "火", "火": "土", "土": "金", "金": "水", "水": "木",
};
const ELEMENT_CONTROLS: Record<string, string> = {
  "木": "土", "土": "水", "水": "火", "火": "金", "金": "木",
};

function computeElementBias(
  segElem: string,
  userElements: { strong: string[]; weak: string[] } | undefined,
): number {
  if (!userElements) return 0;
  if (userElements.weak.includes(segElem))   return +2;
  if (userElements.strong.includes(segElem)) return -1;
  return 0;
}

// v3.2: ten god from (dayMasterElem, segmentElem)
function getTenGodName(dayMasterElem: string, segElem: string): string {
  if (dayMasterElem === segElem)                        return "비겁";
  if (ELEMENT_GENERATES[dayMasterElem] === segElem)     return "식상";
  if (ELEMENT_CONTROLS[dayMasterElem] === segElem)      return "재성";
  if (ELEMENT_CONTROLS[segElem] === dayMasterElem)      return "관성";
  return "인성";
}

function computeTenGodBias(tenGod: string, startHour: number): number {
  const isDaytime = startHour >= 6 && startHour < 18;
  switch (tenGod) {
    case "재성": return +2;
    case "관성": return +1;
    case "식상": return isDaytime ? +2 : 0;
    case "인성": return isDaytime ? 0 : +1;
    case "비겁": return 0;
    default:     return 0;
  }
}

// v3.3-lite: branch relation bias
const SEGMENT_BRANCH = ["子", "卯", "午", "酉", "亥", "子"] as const;

const BRANCH_CLASH: [string, string][] = [
  ["子","午"], ["丑","未"], ["寅","申"], ["卯","酉"],
  ["辰","戌"], ["巳","亥"],
];
const BRANCH_HARM: [string, string][] = [
  ["子","未"], ["丑","午"], ["寅","巳"], ["卯","辰"],
  ["申","亥"], ["酉","戌"],
];
const BRANCH_HARMONY: [string, string][] = [
  ["子","丑"], ["寅","亥"], ["卯","戌"], ["辰","酉"],
  ["巳","申"], ["午","未"],
];

function branchRelation(a: string, b: string): "clash" | "harm" | "harmony" | "none" {
  if (BRANCH_CLASH.some(([x, y]) => (x === a && y === b) || (x === b && y === a)))   return "clash";
  if (BRANCH_HARM.some(([x, y]) => (x === a && y === b) || (x === b && y === a)))    return "harm";
  if (BRANCH_HARMONY.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) return "harmony";
  return "none";
}

function computeBranchRelationBias(
  segBranch: string,
  dayBranch?: string,
  monthBranch?: string,
): number {
  const rel = dayBranch ? branchRelation(segBranch, dayBranch)
    : monthBranch ? branchRelation(segBranch, monthBranch)
    : "none";
  if (rel === "clash")   return -2;
  if (rel === "harmony") return +1;
  if (rel === "harm")    return -1;
  return 0;
}

// v3.4: daily element mood (deterministic hash of date)
const ELEMENTS_ORDER = ["木", "火", "土", "金", "水"] as const;

function dateHash(date: string): number {
  let h = 0;
  for (let i = 0; i < date.length; i++) {
    h = (h * 31 + date.charCodeAt(i)) >>> 0;
  }
  return h;
}

function computeDailyElementMood(date: string): Record<string, number> {
  let hash = 0;
  for (let i = 0; i < date.length; i++) {
    hash = (hash * 31 + date.charCodeAt(i)) | 0;
  }
  const mood: Record<string, number> = {};
  ELEMENTS_ORDER.forEach((el, i) => {
    const val = ((hash + i * 31) % 3) - 1;
    mood[el] = val;
  });
  return mood;
}

// v3.5: day polarity bias per segment
function computeDayPolarityBias(overall: number, startHour: number): number {
  const isDay   = startHour >= 6 && startHour < 18;
  if (overall >= 70) return isDay ? +1 : -1;
  if (overall <= 45) return isDay ? -1 : +1;
  return 0;
}

// v3.6: ziwei daily bias (small global offset from date hash)
function computeZiweiDailyBias(date: string): number {
  const h = dateHash(date);
  return ((h % 3) + 3) % 3 - 1; // -1, 0, or +1
}

// v3.7: astro mood bias per segment
type AstroMode = "fire" | "water" | "air" | "earth";

function computeAstroMode(date: string): AstroMode {
  const modes: AstroMode[] = ["fire", "water", "air", "earth"];
  return modes[dateHash(date.split("-").reverse().join("")) % 4];
}

function computeAstroMoodBias(mode: AstroMode, startHour: number): number {
  const isDay    = startHour >= 6 && startHour < 18;
  const isMidDay = startHour >= 10 && startHour < 18;
  switch (mode) {
    case "fire":  return isDay ? +1 : 0;
    case "water": return isDay ? 0 : +1;
    case "air":   return isMidDay ? +1 : 0;
    case "earth": return +1;
    default:      return 0;
  }
}

function applyDistributionConstraint(scores: number[]): number[] {
  const result = [...scores];

  // spread groups of 3+ identical scores
  const countMap = new Map<number, number[]>();
  for (let i = 0; i < result.length; i++) {
    const s = result[i];
    if (!countMap.has(s)) { countMap.set(s, []); }
    countMap.get(s)!.push(i);
  }
  for (const [, indices] of countMap) {
    if (indices.length >= 3) {
      for (let j = 1; j < indices.length; j++) {
        const delta = j % 2 === 0 ? +1 : -1;
        result[indices[j]] = Math.max(0, Math.min(100, result[indices[j]] + delta));
      }
    }
  }

  // ensure max - min >= 6 only when raw spread is below threshold
  const maxVal = Math.max(...result);
  const minVal = Math.min(...result);
  if (maxVal - minVal < 6) {
    const gap     = 6 - (maxVal - minVal);
    const boost   = Math.ceil(gap / 2);
    const reduce  = gap - boost;
    const maxIdx  = result.indexOf(maxVal);
    const minIdx  = result.indexOf(minVal);
    result[maxIdx] = Math.min(100, result[maxIdx] + boost);
    result[minIdx] = Math.max(0,   result[minIdx] - reduce);
  }

  return result;
}

function scoreTags(score: number): string[] {
  if (score >= 75) return ["집중", "추진"];
  if (score >= 60) return ["정리", "무난"];
  if (score >= 45) return ["신중", "유지"];
  return ["휴식", "주의"];
}

export function generateTimeSegments(
  dailyFortune: DailyFortune,
  userElements?: { strong: string[]; weak: string[] },
  dayMaster?: string,
  dayBranch?: string,
  monthBranch?: string,
): NonNullable<DailyFortune["timeSegments"]> {
  const base = dailyFortune.scores.overall;
  const adjustedBiases = computeAdjustedBiases(dailyFortune.scores);

  const dailyMood  = computeDailyElementMood(dailyFortune.date);
  const ziweiDelta = computeZiweiDailyBias(dailyFortune.date);
  const astroMode  = computeAstroMode(dailyFortune.date);

  const rawScores = SEGMENTS.map(({ startHour }, idx) => {
    const segElem   = SEGMENT_ELEMENT[idx];
    const segBranch = SEGMENT_BRANCH[idx];

    let   elemBias       = computeElementBias(segElem, userElements);
    let   tenGodBias     = dayMaster
      ? computeTenGodBias(getTenGodName(dayMaster, segElem), startHour)
      : 0;
    const branchBias     = computeBranchRelationBias(segBranch, dayBranch, monthBranch);
    if (elemBias < 0 && tenGodBias > 0 && branchBias === 0) {
      tenGodBias = Math.min(tenGodBias + 1, 2);
    }
    const moodBias       = dailyMood[segElem] ?? 0;
    const polarityBias   = computeDayPolarityBias(base, startHour);
    const astroBias      = computeAstroMoodBias(astroMode, startHour);

    if (elemBias > 1) {
      let positiveSum = 0;
      if (elemBias    > 0) positiveSum += elemBias;
      if (tenGodBias  > 0) positiveSum += tenGodBias;
      if (branchBias  > 0) positiveSum += branchBias;
      if (moodBias    > 0) positiveSum += moodBias;
      if (polarityBias > 0) positiveSum += polarityBias;
      if (ziweiDelta  > 0) positiveSum += ziweiDelta;
      if (astroBias   > 0) positiveSum += astroBias;
      if (positiveSum <= elemBias) {
        elemBias = 1;
      }
    }

    // Task 8: 시간대 활성 카테고리 보너스 (+2~+4)
    const segTenGod       = dayMaster ? getTenGodName(dayMaster, segElem) : "";
    const activeDomain    = TENGOD_ACTIVE_DOMAIN[segTenGod];
    const activeDomScore  = activeDomain ? dailyFortune.scores[activeDomain] : 0;
    const activeCatBonus  = activeDomain
      ? (activeDomScore >= 70 ? 4 : activeDomScore >= 60 ? 3 : 2)
      : 0;

    const total = base
      + adjustedBiases[idx]
      + elemBias
      + tenGodBias
      + branchBias
      + moodBias
      + polarityBias
      + ziweiDelta
      + astroBias
      + activeCatBonus;

    return Math.max(0, Math.min(100, total));
  });

  const constrained = applyDistributionConstraint(rawScores);

  return SEGMENTS.map(({ startHour, endHour }, idx) => ({
    startHour,
    endHour,
    score: constrained[idx],
    tags:  scoreTags(constrained[idx]),
  }));
}
