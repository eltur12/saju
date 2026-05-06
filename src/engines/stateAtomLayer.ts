/**
 * State Atom Layer
 * event/signal → state atom → category delta
 *
 * Additive layer sitting between engine merge and final post-processing.
 * Does NOT replace existing direct category scoring.
 * Each state atom accumulates from multiple daily events and converts
 * to small, clamped category deltas.
 */
import type { ScoreMap } from "./sajuEngine";

// ── Types ────────────────────────────────────────────────────────────────────

export type StateAtomKey =
  | "stability"
  | "tension"
  | "recovery"
  | "focus"
  | "emotionalAmplitude"
  | "socialFatigue"
  | "executionFlow"
  | "energySustain"
  | "organization"
  | "impulsiveness";

export interface StateAtomEntry {
  value: number;
  sources: string[];
  polarity: "positive" | "negative" | "mixed";
}

export interface StateAtomDebug {
  atoms: Record<StateAtomKey, StateAtomEntry>;
  topAtoms: Array<{ key: StateAtomKey; value: number }>;
  activeEvents: string[];
  categoryImpact: Partial<Record<keyof ScoreMap, number>>;
}

export interface StateAtomResult {
  categoryDeltas: Partial<Record<keyof ScoreMap, number>>;
  debug: StateAtomDebug;
}

export interface StateAtomInput {
  ten_god_of_day?:        string;
  active_stars:           string[];
  branch_relation_types:  string[];
  ohaeng_clash_stem:      boolean;
  ohaeng_clash_branch:    boolean;
  active_transit_aspects: string[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const ATOM_POLARITY: Record<StateAtomKey, "positive" | "negative" | "mixed"> = {
  stability:          "positive",
  tension:            "negative",
  recovery:           "positive",
  focus:              "positive",
  emotionalAmplitude: "mixed",
  socialFatigue:      "negative",
  executionFlow:      "positive",
  energySustain:      "positive",
  organization:       "positive",
  impulsiveness:      "mixed",
};

const ALL_ATOM_KEYS: StateAtomKey[] = [
  "stability", "tension", "recovery", "focus", "emotionalAmplitude",
  "socialFatigue", "executionFlow", "energySustain", "organization", "impulsiveness",
];

/** State → category coefficients (spec values). */
const STATE_TO_CAT: Record<StateAtomKey, Partial<Record<keyof ScoreMap, number>>> = {
  stability:          { health:  0.8, love:  0.4, relations:  0.5, career:  0.3 },
  tension:            { health: -0.8, love: -0.3, relations: -0.4, career: -0.2 },
  recovery:           { health:  1.0, study: 0.25, career:   0.25 },
  focus:              { study:   1.0, career: 0.6 },
  emotionalAmplitude: { love:    0.5, relations: -0.25, health: -0.2 },
  socialFatigue:      { relations: -0.9, love: -0.4, health: -0.3 },
  executionFlow:      { career:  1.0, wealth: 0.4, study:   0.3 },
  energySustain:      { health:  0.7, career: 0.4, study:   0.3 },
  organization:       { study:   0.7, career: 0.6, wealth:  0.4 },
  impulsiveness:      { wealth: -0.6, love:   0.2, relations: -0.3, health: -0.2 },
};

/** Maximum ±delta the state layer may contribute per category. */
const MAX_CAT_DELTA = 3;

// ── Event → State mappings ────────────────────────────────────────────────────

type AtomDelta = Partial<Record<StateAtomKey, number>>;

/** 십신(十神) → state atoms */
const TEN_GOD_TO_STATE: Record<string, AtomDelta> = {
  "食神": { recovery: 2, energySustain: 2, stability: 1 },
  "正印": { recovery: 2, stability: 2, focus: 1 },
  "傷官": { focus: 2, emotionalAmplitude: 1, impulsiveness: 1, stability: -1 },
  "正官": { stability: 2, organization: 1, focus: 1 },
  "偏官": { tension: 2, executionFlow: 2 },
  "偏財": { executionFlow: 1, energySustain: 1 },
  "正財": { stability: 1, organization: 1 },
  "比肩": { stability: 1 },
  "劫財": { tension: 2, impulsiveness: 2 },
  "偏印": { focus: 1, emotionalAmplitude: 1 },
};

/** 특별성(특수살) → state atoms (natal fixed, applied as daily baseline) */
const STAR_TO_STATE: Record<string, AtomDelta> = {
  "도화살":   { emotionalAmplitude: 3, socialFatigue: 1, impulsiveness: 1 },
  "역마살":   { executionFlow: 2, energySustain: -1, stability: -1 },
  "백호살":   { tension: 3, recovery: -3, energySustain: -2 },
  "화개살":   { focus: 2, stability: 1 },
  "겁살":     { tension: 2, stability: -2 },
  "천덕귀인": { stability: 2, recovery: 1 },
  "월덕귀인": { stability: 2, energySustain: 1 },
};

/** 지지관계(地支關係) → state atoms */
const BRANCH_REL_TO_STATE: Record<string, AtomDelta> = {
  "충":  { tension: 3, stability: -2, recovery: -1, socialFatigue: 1 },
  "육합": { stability: 2, recovery: 1, emotionalAmplitude: -1 },
  "삼합": { stability: 3, recovery: 1, executionFlow: 1, emotionalAmplitude: -1 },
  "방합": { stability: 2, executionFlow: 1 },
  "반합": { stability: 1, recovery: 1 },
  "형":  { tension: 2, stability: -2 },
  "삼형": { tension: 3, stability: -3 },
  "해":  { tension: 1, socialFatigue: 1 },
  "원진": { socialFatigue: 2, emotionalAmplitude: 1 },
  "귀문": { emotionalAmplitude: 2, socialFatigue: 1 },
  "복음": { stability: 1 },
};

/** 오행극(五行剋) → state atoms */
const OHAENG_CLASH_STATE: AtomDelta = {
  tension: 2, recovery: -2, energySustain: -1,
};

/** 행성 어스펙트 → state atoms */
const HARD_ASPECTS = new Set(["□", "☍", "⚻", "∠"]);
const EASY_ASPECTS = new Set(["△", "⚹", "☌"]);

const PLANET_ASPECT_TO_STATE: Record<string, { easy: AtomDelta; hard: AtomDelta }> = {
  "Mercury": {
    easy: { focus: 2, organization: 2, executionFlow: 1 },
    hard: { focus: -2, organization: -2, socialFatigue: 1 },
  },
  "Moon": {
    easy: { emotionalAmplitude: 1, stability: 1 },
    hard: { emotionalAmplitude: 3, stability: -2, socialFatigue: 2 },
  },
  "Venus": {
    easy: { emotionalAmplitude: 1, stability: 1, socialFatigue: -1 },
    hard: { emotionalAmplitude: 2, impulsiveness: 1, socialFatigue: 1 },
  },
  "Mars": {
    easy: { executionFlow: 2, energySustain: 1 },
    hard: { tension: 3, impulsiveness: 2, energySustain: -1 },
  },
  "Jupiter": {
    easy: { energySustain: 2, executionFlow: 1, stability: 1 },
    hard: { impulsiveness: 2, tension: 1 },
  },
  "Saturn": {
    easy: { organization: 2, stability: 1 },
    hard: { tension: 2, recovery: -2, executionFlow: -1 },
  },
  "Sun": {
    easy: { stability: 1, energySustain: 1 },
    hard: { tension: 1, stability: -1 },
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function initAtoms(): Record<StateAtomKey, StateAtomEntry> {
  const result = {} as Record<StateAtomKey, StateAtomEntry>;
  for (const k of ALL_ATOM_KEYS) {
    result[k] = { value: 0, sources: [], polarity: ATOM_POLARITY[k] };
  }
  return result;
}

function applyDelta(
  atoms: Record<StateAtomKey, StateAtomEntry>,
  delta: AtomDelta,
  source: string,
): void {
  for (const [k, v] of Object.entries(delta) as [StateAtomKey, number][]) {
    if (v === 0) continue;
    atoms[k].value += v;
    atoms[k].sources.push(source);
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computeStateAtoms(input: StateAtomInput): StateAtomResult {
  const atoms   = initAtoms();
  const events: string[] = [];

  // 1. Ten god of day
  if (input.ten_god_of_day) {
    const delta = TEN_GOD_TO_STATE[input.ten_god_of_day];
    if (delta) {
      applyDelta(atoms, delta, `십신:${input.ten_god_of_day}`);
      events.push(input.ten_god_of_day);
    }
  }

  // 2. Natal special stars — scaled down (0.3×) because these are permanent daily signals.
  //    Full weight would create a constant category bias that violates "no dominant category" spec.
  const NATAL_STAR_SCALE = 0.3;
  for (const star of input.active_stars) {
    const delta = STAR_TO_STATE[star];
    if (delta) {
      const scaledDelta: AtomDelta = {};
      for (const [k, v] of Object.entries(delta) as [StateAtomKey, number][]) {
        scaledDelta[k] = v * NATAL_STAR_SCALE;
      }
      applyDelta(atoms, scaledDelta, `살:${star}`);
      events.push(star);
    }
  }

  // 3. Branch relations (day + month, accumulated freely — clamp handles extremes)
  for (const relType of input.branch_relation_types) {
    const delta = BRANCH_REL_TO_STATE[relType];
    if (delta) {
      applyDelta(atoms, delta, `지지:${relType}`);
      events.push(relType);
    }
  }

  // 4. Ohaeng clash (stem and/or branch)
  if (input.ohaeng_clash_stem || input.ohaeng_clash_branch) {
    applyDelta(atoms, OHAENG_CLASH_STATE, "오행극");
    events.push("오행극");
  }

  // 5. Astro transit aspects — parse "Moon △ natal Sun (orb 0.5°)" format
  for (const asp of input.active_transit_aspects) {
    const parts = asp.split(" ");
    if (parts.length < 2) continue;
    const planet = parts[0];
    const symbol = parts[1];
    const nature = HARD_ASPECTS.has(symbol) ? "hard" : EASY_ASPECTS.has(symbol) ? "easy" : null;
    if (!nature) continue;
    const mapping = PLANET_ASPECT_TO_STATE[planet];
    if (!mapping) continue;
    applyDelta(atoms, mapping[nature], `행성:${planet}${symbol}`);
    events.push(`${planet}${symbol}`);
  }

  // 6. Compute raw category deltas from accumulated atom values
  const domCats = ["wealth", "love", "health", "career", "relations", "study"] as const;
  const rawDeltas: Partial<Record<keyof ScoreMap, number>> = {};
  for (const cat of domCats) {
    let delta = 0;
    for (const atomKey of ALL_ATOM_KEYS) {
      const coeff = (STATE_TO_CAT[atomKey] as Record<string, number>)[cat] ?? 0;
      if (coeff !== 0) delta += atoms[atomKey].value * coeff;
    }
    rawDeltas[cat] = delta;
  }

  // 7. Clamp per-category to ±MAX_CAT_DELTA
  const categoryDeltas: Partial<Record<keyof ScoreMap, number>> = {};
  for (const cat of domCats) {
    categoryDeltas[cat] = Math.max(-MAX_CAT_DELTA, Math.min(MAX_CAT_DELTA, rawDeltas[cat] ?? 0));
  }

  // 8. Debug: top 3 atoms by absolute value
  const topAtoms = ALL_ATOM_KEYS
    .filter(k => atoms[k].value !== 0)
    .sort((a, b) => Math.abs(atoms[b].value) - Math.abs(atoms[a].value))
    .slice(0, 3)
    .map(k => ({ key: k, value: atoms[k].value }));

  return {
    categoryDeltas,
    debug: {
      atoms,
      topAtoms,
      activeEvents: [...new Set(events)],
      categoryImpact: categoryDeltas,
    },
  };
}
