/**
 * Time Segment Layer — v4 (phase-redistribution model)
 *
 * Replaces the legacy "overall + static bias" approach with a state-atom
 * redistribution model.  Six named phases each have an affinity for each
 * state atom; the daily atom values are redistributed across phases to
 * produce per-segment deltas.
 *
 * Score formula (per phase i):
 *   rawScore[i] = overall
 *                + phaseStateDelta[i]   (stateAtom × affinity, clamped ±8)
 *                + catRefDelta[i]       (phase-relevant category vs overall)
 *                + legacyBias[i]        (element/branch, ≤±2)
 */
import type { DailyFortune } from "./aggregator";
import type { ScoreMap } from "./sajuEngine";
import type { StateAtomDebug, StateAtomKey } from "./stateAtomLayer";

// ── Phase definitions ──────────────────────────────────────────────────────────

const PHASES = [
  { startHour:  0, endHour:  5, name: "회복" },
  { startHour:  5, endHour:  9, name: "기동" },
  { startHour:  9, endHour: 13, name: "집중" },
  { startHour: 13, endHour: 17, name: "지속" },
  { startHour: 17, endHour: 21, name: "감정/관계" },
  { startHour: 21, endHour: 24, name: "정리" },
] as const;

type DomainKey = keyof Omit<ScoreMap, "overall">;

// ── State atom → phase affinity ────────────────────────────────────────────────
// Index 0..5 maps to PHASES: 회복, 기동, 집중, 지속, 감정/관계, 정리

const SEGMENT_STATE_AFFINITY: Record<StateAtomKey, readonly number[]> = {
  //                          회복  기동  집중  지속  감정  정리
  stability:          [ +2,  +1,   0,  +1,  +1,  +1],
  tension:            [ -2,  -1,  -1,   0,  -2,  -1],
  recovery:           [ +3,  -1,   0,  +1,   0,  +2],
  focus:              [ -1,   0,  +3,  +1,   0,  +1],
  emotionalAmplitude: [  0,   0,  -1,   0,  +3,  -1],
  socialFatigue:      [  0,  -1,  -1,  -1,  -3,   0],
  executionFlow:      [ -1,  +1,  +2,  +2,   0,   0],
  energySustain:      [  0,  +2,  +1,  +1,   0,  +1],
  organization:       [  0,  +1,  +2,  +1,   0,  +3],
  impulsiveness:      [ -1,   0,  -1,  -1,  +1,  -2],
};

const PHASE_STATE_NORMALIZER = 3.0;
const PHASE_STATE_CAP        = 8;
// Clamp applied only within timeSegment calculations.
// stateAtomLayer values are uncapped (max ~13-16) and dominate when used raw.
const ATOM_VAL_CAP = 5;

// ── Phase → reference category domains ────────────────────────────────────────

const PHASE_CAT_REF: DomainKey[][] = [
  ["health"],                  // 회복
  ["career", "wealth"],        // 기동
  ["study",  "career"],        // 집중
  ["career", "wealth"],        // 지속
  ["love",   "relations"],     // 감정/관계
  ["study",  "health"],        // 정리
];

const CAT_REF_WEIGHT = 0.20;

// ── Legacy element/branch bias (scaled down) ───────────────────────────────────

const SEGMENT_ELEMENT = ["水", "木", "火", "土", "金", "水"] as const;
const SEGMENT_BRANCH  = ["子", "卯", "午", "酉", "亥", "子"] as const;

const BRANCH_CLASH:   [string, string][] = [
  ["子","午"],["丑","未"],["寅","申"],["卯","酉"],["辰","戌"],["巳","亥"],
];
const BRANCH_HARMONY: [string, string][] = [
  ["子","丑"],["寅","亥"],["卯","戌"],["辰","酉"],["巳","申"],["午","未"],
];
const BRANCH_HARM:    [string, string][] = [
  ["子","未"],["丑","午"],["寅","巳"],["卯","辰"],["申","亥"],["酉","戌"],
];

function branchRel(a: string, b: string): "clash" | "harmony" | "harm" | "none" {
  if (BRANCH_CLASH.some(([x,y])   => (x===a&&y===b)||(x===b&&y===a))) return "clash";
  if (BRANCH_HARMONY.some(([x,y]) => (x===a&&y===b)||(x===b&&y===a))) return "harmony";
  if (BRANCH_HARM.some(([x,y])    => (x===a&&y===b)||(x===b&&y===a))) return "harm";
  return "none";
}

function computeLegacyBias(
  phaseIdx:     number,
  userElements?: { strong: string[]; weak: string[] },
  dayBranch?:   string,
  monthBranch?: string,
): number {
  const segElem   = SEGMENT_ELEMENT[phaseIdx];
  const segBranch = SEGMENT_BRANCH[phaseIdx];
  const LEGACY_SCALE = 0.5;

  let elem = 0;
  if (userElements) {
    if      (userElements.weak.includes(segElem))   elem = +2;
    else if (userElements.strong.includes(segElem)) elem = -1;
  }

  let branch = 0;
  const refBranch = dayBranch ?? monthBranch;
  if (refBranch) {
    const rel = branchRel(segBranch, refBranch);
    if      (rel === "clash")   branch = -2;
    else if (rel === "harmony") branch = +1;
    else if (rel === "harm")    branch = -1;
  }

  return (elem + branch) * LEGACY_SCALE;
}

// ── Source → canonical key conversion ─────────────────────────────────────────

const TEN_GOD_SLUG: Record<string, string> = {
  "食神": "siksin", "正印": "jeongin", "傷官": "sanggwan",
  "正官": "jeonggwan", "偏官": "pyeonggwan", "偏財": "pyeongjae",
  "正財": "jeongjae", "比肩": "bigyeon", "劫財": "geobjae", "偏印": "pyeongin",
};
const BRANCH_SLUG: Record<string, string> = {
  "충": "clash", "육합": "sixHarmony", "삼합": "trine",
  "방합": "directionalHarmony", "반합": "halfTrine",
  "형": "penalty", "삼형": "triplePenalty",
  "해": "harm", "원진": "hostility", "귀문": "spiritDoor", "복음": "selfPenalty",
};
const STAR_SLUG: Record<string, string> = {
  "도화살": "doHwa", "역마살": "yeokMa", "백호살": "baekHo",
  "화개살": "hwaGae", "겁살": "geobSal", "천덕귀인": "cheonDeok", "월덕귀인": "wolDeok",
};
const ASPECT_SLUG: Record<string, string> = {
  "△": "trine", "□": "square", "☌": "conjunction",
  "☍": "opposition", "⚹": "sextile", "⚻": "quincunx", "∠": "semisquare",
};
const PLANET_SLUG: Record<string, string> = {
  "Sun": "sun", "Moon": "moon", "Mercury": "mercury", "Venus": "venus",
  "Mars": "mars", "Jupiter": "jupiter", "Saturn": "saturn",
  "Uranus": "uranus", "Neptune": "neptune", "Pluto": "pluto",
  "NorthNode": "northNode", "Chiron": "chiron",
};
const PLANET_ORDER = Object.keys(PLANET_SLUG).sort((a, b) => b.length - a.length);

function sourceToCanonicalKey(source: string): string | null {
  if (source.startsWith("십신:")) {
    const slug = TEN_GOD_SLUG[source.slice(3)];
    return slug ? `saju.tenGod.${slug}` : null;
  }
  if (source.startsWith("살:")) {
    const slug = STAR_SLUG[source.slice(2)];
    return slug ? `saju.star.${slug}` : null;
  }
  if (source.startsWith("지지:") || source.startsWith("월지지:")) {
    const rel  = source.startsWith("지지:") ? source.slice(3) : source.slice(4);
    const slug = BRANCH_SLUG[rel];
    return slug ? `saju.branch.${slug}` : null;
  }
  if (source === "오행극") return "saju.ohaeng.clash";
  if (source.startsWith("행성:")) {
    const rest   = source.slice(3);
    const planet = PLANET_ORDER.find(p => rest.startsWith(p));
    if (!planet) return null;
    const symbol = rest.slice(planet.length);
    const pslug  = PLANET_SLUG[planet];
    const aslug  = ASPECT_SLUG[symbol];
    return (pslug && aslug) ? `astro.aspect.${pslug}.${aslug}` : null;
  }
  return null;
}

// ── Top events for a phase (by atom×affinity contribution magnitude) ───────────

const ALL_ATOM_KEYS: StateAtomKey[] = [
  "stability", "tension", "recovery", "focus", "emotionalAmplitude",
  "socialFatigue", "executionFlow", "energySustain", "organization", "impulsiveness",
];

function phaseTopEvents(
  debug:     StateAtomDebug,
  phaseIdx:  number,
  maxEvents  = 2,
): string[] {
  const canonMap = new Map<string, number>();

  for (const atomKey of ALL_ATOM_KEYS) {
    const atom     = debug.atoms[atomKey];
    if (atom.value === 0 || atom.sources.length === 0) continue;
    const affinity = SEGMENT_STATE_AFFINITY[atomKey][phaseIdx];
    if (affinity === 0) continue;
    const clampedVal = Math.max(-ATOM_VAL_CAP, Math.min(ATOM_VAL_CAP, atom.value));
    const magnitude = Math.abs(clampedVal * affinity);
    for (const src of atom.sources) {
      const key = sourceToCanonicalKey(src);
      if (!key) continue;
      if (magnitude > (canonMap.get(key) ?? 0)) canonMap.set(key, magnitude);
    }
  }

  return [...canonMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxEvents)
    .map(([k]) => k);
}

// ── Score tags ─────────────────────────────────────────────────────────────────

function scoreTags(score: number): string[] {
  if (score >= 75) return ["집중", "추진"];
  if (score >= 60) return ["정리", "무난"];
  if (score >= 45) return ["신중", "유지"];
  return ["휴식", "주의"];
}

// ── Minimum spread enforcement ─────────────────────────────────────────────────

function applyDistributionConstraint(scores: number[]): number[] {
  const result = [...scores];

  // spread groups of 3+ identical scores
  const countMap = new Map<number, number[]>();
  for (let i = 0; i < result.length; i++) {
    const s = result[i];
    if (!countMap.has(s)) countMap.set(s, []);
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

  // ensure max − min ≥ 8
  const maxVal = Math.max(...result);
  const minVal = Math.min(...result);
  if (maxVal - minVal < 8) {
    const gap    = 8 - (maxVal - minVal);
    const boost  = Math.ceil(gap / 2);
    const reduce = gap - boost;
    result[result.indexOf(maxVal)] = Math.min(100, maxVal + boost);
    result[result.indexOf(minVal)] = Math.max(0,   minVal - reduce);
  }

  return result;
}

// ── Main export ────────────────────────────────────────────────────────────────

export function generateTimeSegments(
  dailyFortune:  DailyFortune,
  stateAtomDebug: StateAtomDebug,
  userElements?:  { strong: string[]; weak: string[] },
  dayBranch?:    string,
  monthBranch?:  string,
): NonNullable<DailyFortune["timeSegments"]> {
  const overall = dailyFortune.scores.overall;
  const scores  = dailyFortune.scores;

  const rawScores = PHASES.map(({ }, phaseIdx) => {
    // 1. Phase state delta: state atoms redistributed via affinity table
    //    Raw atom values are clamped to ±ATOM_VAL_CAP before use.
    //    stateAtomLayer values are uncapped; tension/emotionalAmplitude can reach 13-16
    //    and would otherwise dominate all phase scoring.
    let atomSum = 0;
    for (const atomKey of ALL_ATOM_KEYS) {
      const atomVal = Math.max(-ATOM_VAL_CAP, Math.min(ATOM_VAL_CAP,
        stateAtomDebug.atoms[atomKey].value,
      ));
      if (atomVal === 0) continue;
      atomSum += atomVal * SEGMENT_STATE_AFFINITY[atomKey][phaseIdx];
    }
    const phaseStateDelta = Math.max(-PHASE_STATE_CAP, Math.min(+PHASE_STATE_CAP,
      atomSum / PHASE_STATE_NORMALIZER,
    ));

    // 2. Category reference delta: phase-relevant domains vs overall
    const refCats    = PHASE_CAT_REF[phaseIdx];
    const catRefAvg  = refCats.reduce((s, c) => s + scores[c], 0) / refCats.length;
    const catRefDelta = (catRefAvg - overall) * CAT_REF_WEIGHT;

    // 3. Legacy element/branch bias (small, preserved for natal context)
    const legacy = computeLegacyBias(phaseIdx, userElements, dayBranch, monthBranch);

    return Math.max(0, Math.min(100, overall + phaseStateDelta + catRefDelta + legacy));
  });

  const constrained = applyDistributionConstraint(rawScores);

  return PHASES.map(({ startHour, endHour }, phaseIdx) => ({
    startHour,
    endHour,
    score:     Math.round(constrained[phaseIdx]),
    tags:      scoreTags(constrained[phaseIdx]),
    topEvents: phaseTopEvents(stateAtomDebug, phaseIdx),
  }));
}
