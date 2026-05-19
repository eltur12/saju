/**
 * Persisted Daily Model Mapper
 *
 * Converts a computed DailyFortune into a key-only PersistedDailyModel.
 * No display labels are stored — all text is resolved at render time via dictionary.
 *
 * Canonical key namespaces (English-only, no Han/Hangul/symbols):
 *   saju.tenGod.<slug>         e.g. "saju.tenGod.siksin"
 *   saju.branch.<slug>         e.g. "saju.branch.clash"
 *   saju.star.<slug>           e.g. "saju.star.doHwa"
 *   saju.ohaeng.clash
 *   ziwei.palace.<slug>        e.g. "ziwei.palace.career"
 *   astro.aspect.<planet>.<aspect>  e.g. "astro.aspect.sun.trine"
 *   state.<atomKey>            e.g. "state.executionFlow"
 *   flow.<type>                e.g. "flow.highExecution"
 *   unknown.<safe>             fallback for unrecognized raw keys
 */

import type { DailyFortune } from "./aggregator";
import type { ScoreMap } from "./sajuEngine";
import { STATE_TO_CAT, type StateAtomKey } from "./stateAtomLayer";

// ── Public types ───────────────────────────────────────────────────────────────

export interface PersistedEventChip {
  key:      string;
  source:   "saju" | "ziwei" | "astro";
  impact:   number;   // unsigned accumulated weight from atom attribution; 0 = unavailable
  polarity: "positive" | "negative" | "neutral";
}

export interface PersistedState {
  key:          string;   // "state.<atomKey>"
  polarity:     "positive" | "negative" | "mixed";
  strength:     number;   // 0–1 normalized from atom value
  sourceEvents: string[]; // canonical event keys that fed this state
}

export interface CategoryHighlight {
  topStates: string[];  // state keys sorted by contribution to this category
  topEvents: string[];  // event keys sorted by impact on this category
}

export interface PersistedSummary {
  flowType: string;  // canonical flow key
}

export const PERSISTED_SCHEMA_V = 1 as const;

export interface PersistedDailyModel {
  _v:                 typeof PERSISTED_SCHEMA_V;
  topEvents:          PersistedEventChip[];
  topStates:          PersistedState[];
  categoryHighlights: Partial<Record<keyof ScoreMap, CategoryHighlight>>;
  summary:            PersistedSummary;
}

// ── Canonical key lookup tables ────────────────────────────────────────────────

/** 十神 (Chinese) → romanized slug */
const TEN_GOD_KEY: Record<string, string> = {
  "食神": "siksin",
  "正印": "jeongin",
  "傷官": "sanggwan",
  "正官": "jeonggwan",
  "偏官": "pyeonggwan",
  "偏財": "pyeongjae",
  "正財": "jeongjae",
  "比肩": "bigyeon",
  "劫財": "geobjae",
  "偏印": "pyeongin",
};

/** 지지 관계 (Korean) → English slug */
const BRANCH_KEY: Record<string, string> = {
  "충":  "clash",
  "육합": "sixHarmony",
  "삼합": "trine",
  "방합": "directionalHarmony",
  "반합": "halfTrine",
  "형":  "penalty",
  "삼형": "triplePenalty",
  "해":  "harm",
  "원진": "hostility",
  "귀문": "spiritDoor",
  "복음": "selfPenalty",
};

/** 특별성 / 귀인살 (Korean) → English slug */
const STAR_KEY: Record<string, string> = {
  "도화살":   "doHwa",
  "역마살":   "yeokMa",
  "백호살":   "baekHo",
  "화개살":   "hwaGae",
  "겁살":     "geobSal",
  "천덕귀인": "cheonDeok",
  "월덕귀인": "wolDeok",
};

/** 자미두수 궁 Korean label (produced by reasonLayer's PALACE_KR) → English slug */
const PALACE_KR_EN: Record<string, string> = {
  "명궁":  "life",
  "형제궁": "siblings",
  "부처궁": "spouse",
  "자녀궁": "children",
  "재백궁": "wealth",
  "질액궁": "health",
  "천이궁": "travel",
  "교우궁": "friends",
  "관록궁": "career",
  "전택궁": "property",
  "복덕궁": "spirit",
  "부모궁": "parents",
};

/** Category → whitelisted palace keys (subset of ziwei.palace.*) */
const ZIWEI_CAT_WHITELIST: Partial<Record<string, string[]>> = {
  wealth:    ["ziwei.palace.wealth",  "ziwei.palace.property"],
  love:      ["ziwei.palace.spouse"],
  health:    ["ziwei.palace.health"],
  career:    ["ziwei.palace.career",  "ziwei.palace.life"],
  relations: ["ziwei.palace.friends", "ziwei.palace.siblings"],
  study:     ["ziwei.palace.spirit",  "ziwei.palace.parents"],
};

/** Capped signed catImpact injected for whitelisted palace candidates. */
const PALACE_CAT_IMPACT = 1.5;

/** Planet English name → lowercase slug */
const PLANET_SLUG: Record<string, string> = {
  "Sun":      "sun",
  "Moon":     "moon",
  "Mercury":  "mercury",
  "Venus":    "venus",
  "Mars":     "mars",
  "Jupiter":  "jupiter",
  "Saturn":   "saturn",
  "Uranus":   "uranus",
  "Neptune":  "neptune",
  "Pluto":    "pluto",
  "NorthNode":"northNode",
  "Chiron":   "chiron",
};

/** Aspect symbol → English slug */
const ASPECT_SLUG: Record<string, string> = {
  "△": "trine",
  "□": "square",
  "☌": "conjunction",
  "☍": "opposition",
  "⚹": "sextile",
  "⚻": "quincunx",
  "∠": "semisquare",
};

// Sorted longest-first to avoid prefix ambiguity (NorthNode before North)
const PLANET_ORDER = Object.keys(PLANET_SLUG).sort((a, b) => b.length - a.length);

// reasonLayer fallback chip keys that carry no real event identity — skip in topEvents
const FALLBACK_CHIP_KEYS = new Set(["자미 흐름", "사주 기운", "행성 흐름"]);

// ── Key conversion helpers ─────────────────────────────────────────────────────

/** Produce a safe ASCII slug from an unrecognized raw string. */
function toSafeSlug(raw: string): string {
  const slug = raw.replace(/[^\w]/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
  return slug || "other";
}

/**
 * Parse a planet-transit compound string (e.g. "Sun△", "NorthNode□")
 * into its canonical "astro.aspect.<planet>.<aspect>" key.
 * Returns null if the string does not match any known planet+aspect pair.
 */
function parseTransitKey(raw: string): string | null {
  for (const planet of PLANET_ORDER) {
    if (!raw.startsWith(planet)) continue;
    const symbol    = raw.slice(planet.length);
    const aspectKey = ASPECT_SLUG[symbol];
    if (!aspectKey) continue;
    return `astro.aspect.${PLANET_SLUG[planet]}.${aspectKey}`;
  }
  return null;
}

type EventSource = "saju" | "ziwei" | "astro";

/**
 * Convert a raw activeEvent string (unprefixed, from stateAtomDebug.activeEvents)
 * to a canonical { key, source } pair.
 */
function rawToCanonical(raw: string): { key: string; source: EventSource } {
  // Ten-god (Chinese)
  const tenGodKey = TEN_GOD_KEY[raw];
  if (tenGodKey) return { key: `saju.tenGod.${tenGodKey}`, source: "saju" };

  // Branch relation (Korean)
  const branchKey = BRANCH_KEY[raw];
  if (branchKey) return { key: `saju.branch.${branchKey}`, source: "saju" };

  // Special star / noble person (Korean)
  const starKey = STAR_KEY[raw];
  if (starKey) return { key: `saju.star.${starKey}`, source: "saju" };

  // Ohaeng clash (Korean literal)
  if (raw === "오행극") return { key: "saju.ohaeng.clash", source: "saju" };

  // Planet transit compound: "Sun△", "NorthNode□", etc.
  const transitKey = parseTransitKey(raw);
  if (transitKey) return { key: transitKey, source: "astro" };

  // Unknown — safe fallback, never throws
  return { key: `unknown.${toSafeSlug(raw)}`, source: "saju" };
}

/**
 * Convert a prefixed atom-source string (from StateAtomEntry.sources)
 * to a canonical event key.
 *
 * Source string formats produced by stateAtomLayer:
 *   "십신:<Chinese>"    → saju.tenGod.*
 *   "지지:<Korean>"     → saju.branch.*
 *   "월지지:<Korean>"   → saju.branch.*  (same canonical key; weight is internal)
 *   "살:<Korean>"       → saju.star.*
 *   "행성:<Planet><Sym>"→ astro.aspect.*
 *   "오행극"            → saju.ohaeng.clash
 */
function sourceToCanonical(src: string): string {
  if (src.startsWith("십신:")) {
    const k = TEN_GOD_KEY[src.slice(3)];
    return k ? `saju.tenGod.${k}` : `unknown.${toSafeSlug(src.slice(3))}`;
  }
  if (src.startsWith("지지:")) {
    const k = BRANCH_KEY[src.slice(3)];
    return k ? `saju.branch.${k}` : `unknown.${toSafeSlug(src.slice(3))}`;
  }
  if (src.startsWith("월지지:")) {
    const k = BRANCH_KEY[src.slice(4)];
    return k ? `saju.branch.${k}` : `unknown.${toSafeSlug(src.slice(4))}`;
  }
  if (src.startsWith("살:")) {
    const k = STAR_KEY[src.slice(2)];
    return k ? `saju.star.${k}` : `unknown.${toSafeSlug(src.slice(2))}`;
  }
  if (src.startsWith("행성:")) {
    const transitKey = parseTransitKey(src.slice(3));
    return transitKey ?? `unknown.${toSafeSlug(src.slice(3))}`;
  }
  if (src === "오행극") return "saju.ohaeng.clash";
  return `unknown.${toSafeSlug(src)}`;
}

// ── State atom metadata (read-only mirror of stateAtomLayer constants) ─────────

const STATE_POLARITY: Record<string, "positive" | "negative" | "mixed"> = {
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


// ── Flow type classifier ────────────────────────────────────────────────────────

const FLOW_THRESHOLD = 2;
const FLOW_DOMINANCE = 0.8;

function classifyFlowType(topAtoms: ReadonlyArray<{ key: string; value: number }>): string {
  const top    = topAtoms[0];
  const second = topAtoms[1];
  if (!top || Math.abs(top.value) < 1) return "flow.neutral";
  if (second && Math.abs(top.value) - Math.abs(second.value) < FLOW_DOMINANCE) return "flow.neutral";
  const { key: k, value: v } = top;

  if (k === "executionFlow"      && v >  FLOW_THRESHOLD)  return "flow.highExecution";
  if (k === "recovery"           && v >  1)               return "flow.recoveryDay";
  if (k === "focus"              && v >  1)               return "flow.focusBoost";
  if (k === "stability"          && v >  FLOW_THRESHOLD)  return "flow.stableFlow";
  if (k === "emotionalAmplitude" && Math.abs(v) > 1.5)    return "flow.emotionalSwing";
  if (k === "socialFatigue"      && v >  1)               return "flow.socialDrain";
  if (k === "tension"            && v >  FLOW_THRESHOLD)  return "flow.tensionSpike";
  if (k === "energySustain"      && v < -1)               return "flow.lowEnergy";
  if (k === "impulsiveness"      && Math.abs(v) > 1.5)    return "flow.impulsive";
  if (v < 0)                                              return "flow.blocked";
  return "flow.neutral";
}

// ── Main mapper ────────────────────────────────────────────────────────────────

const MAX_ATOM_VALUE = 6;
const MAX_TOP_EVENTS = 8;
const MAX_TOP_STATES = 5;
const MAX_CAT_STATES = 3;
const MAX_CAT_EVENTS = 3;

export function buildPersistedDailyModel(fortune: DailyFortune): PersistedDailyModel {
  const atomDebug = fortune.stateAtomDebug;
  const reasons   = fortune.reasonSources;

  if (!atomDebug || !reasons) {
    return { _v: PERSISTED_SCHEMA_V, topEvents: [], topStates: [], categoryHighlights: {}, summary: { flowType: "flow.neutral" } };
  }

  const atomKeys = Object.keys(atomDebug.atoms) as StateAtomKey[];

  // ── Step 1: Accumulate per-event impact from atom source attribution ──────
  const evImpact = new Map<string, number>();  // raw unprefixed string → unsigned sum
  const evSigned = new Map<string, number>();  // raw unprefixed string → signed sum

  for (const atomKey of atomKeys) {
    const entry = atomDebug.atoms[atomKey];
    if (entry.value === 0 || entry.sources.length === 0) continue;
    const perSrc = entry.value / entry.sources.length;

    for (const src of entry.sources) {
      // Strip prefix to recover the original activeEvent string used as map key
      let raw = src;
      if      (src.startsWith("십신:"))   raw = src.slice(3);
      else if (src.startsWith("지지:"))   raw = src.slice(3);
      else if (src.startsWith("월지지:")) raw = src.slice(4);
      else if (src.startsWith("살:"))     raw = src.slice(2);
      else if (src.startsWith("행성:"))   raw = src.slice(3);

      evImpact.set(raw, (evImpact.get(raw) ?? 0) + Math.abs(perSrc));
      evSigned.set(raw, (evSigned.get(raw) ?? 0) + perSrc);
    }
  }

  // ── Step 2: topEvents ─────────────────────────────────────────────────────
  const seenKeys  = new Set<string>();
  const allEvents: PersistedEventChip[] = [];

  // Saju + astro events from stateAtomLayer (activeEvents is already deduplicated)
  for (const raw of atomDebug.activeEvents) {
    const { key, source } = rawToCanonical(raw);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const signed = evSigned.get(raw) ?? 0;
    allEvents.push({
      key,
      source,
      impact:   +((evImpact.get(raw) ?? 0).toFixed(2)),
      polarity: signed > 0 ? "positive" : signed < 0 ? "negative" : "neutral",
    });
  }

  // Ziwei events from reasonSources.ziwei.chips (skip fallback placeholder chips)
  for (const chip of reasons.ziwei.chips ?? []) {
    if (FALLBACK_CHIP_KEYS.has(chip.key)) continue;
    const palaceSlug = PALACE_KR_EN[chip.key];
    const key = palaceSlug ? `ziwei.palace.${palaceSlug}` : `unknown.${toSafeSlug(chip.key)}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    allEvents.push({
      key,
      source:   "ziwei",
      impact:   +(reasons.ziwei.weight ?? 0),
      polarity: chip.polarity,
    });
  }

  const topEvents = allEvents
    .filter(e => !e.key.startsWith("unknown."))
    .sort((a, b) => b.impact - a.impact)
    .slice(0, MAX_TOP_EVENTS);

  // ── Step 3: topStates ─────────────────────────────────────────────────────
  const allStates: PersistedState[] = [];

  for (const atomKey of atomKeys) {
    const entry = atomDebug.atoms[atomKey];
    if (entry.value === 0) continue;

    const sourceEvents = [...new Set(entry.sources)].map(sourceToCanonical).filter(k => !k.startsWith("unknown."));

    allStates.push({
      key:          `state.${atomKey}`,
      polarity:     STATE_POLARITY[atomKey] ?? "mixed",
      strength:     +Math.min(1, Math.abs(entry.value) / MAX_ATOM_VALUE).toFixed(3),
      sourceEvents,
    });
  }

  const topStates = allStates
    .sort((a, b) => b.strength - a.strength)
    .slice(0, MAX_TOP_STATES);

  // ── Step 4: categoryHighlights ────────────────────────────────────────────
  const DOM_CATS = ["wealth", "love", "health", "career", "relations", "study"] as const;
  const categoryHighlights: Partial<Record<keyof ScoreMap, CategoryHighlight>> = {};

  for (const cat of DOM_CATS) {
    // ── 4a: topStates (unchanged) ─────────────────────────────────────────
    const catStateEntries: Array<{ stateKey: string; atomKey: string; contribution: number }> = [];

    for (const atomKey of atomKeys) {
      const entry = atomDebug.atoms[atomKey];
      if (entry.value === 0) continue;
      const coeff = STATE_TO_CAT[atomKey]?.[cat] ?? 0;
      if (coeff === 0) continue;
      catStateEntries.push({
        stateKey:     `state.${atomKey}`,
        atomKey,
        contribution: Math.abs(entry.value * coeff),
      });
    }

    catStateEntries.sort((a, b) => b.contribution - a.contribution);
    const topCatStates = catStateEntries.slice(0, MAX_CAT_STATES);
    if (topCatStates.length === 0) continue;

    // ── 4b: topEvents — score-direction-aware selection ───────────────────
    // Use |catImpact| for magnitude (how much does this event affect this category)
    // Use global chip polarity (from topEvents / evSigned) for directional sorting.
    // This avoids double-negation artifacts where e.g. a clash contributes positively
    // to tension (negative atom) which then flips catImpact sign for health.
    const catEventImpact = new Map<string, number>();

    for (const atomKey of atomKeys) {
      const entry = atomDebug.atoms[atomKey];
      if (entry.value === 0 || entry.sources.length === 0) continue;
      const coeff = STATE_TO_CAT[atomKey]?.[cat] ?? 0;
      if (coeff === 0) continue;

      const perSrc = (entry.value * coeff) / entry.sources.length;
      for (const src of entry.sources) {
        const evKey = sourceToCanonical(src);
        catEventImpact.set(evKey, (catEventImpact.get(evKey) ?? 0) + perSrc);
      }
    }

    // ── 4b-ziwei: inject whitelisted palace chips as additional candidates ──
    const palaceWhitelist = ZIWEI_CAT_WHITELIST[cat];
    if (palaceWhitelist && reasons?.ziwei.chips) {
      for (const chip of reasons.ziwei.chips) {
        if (FALLBACK_CHIP_KEYS.has(chip.key)) continue;
        const palaceSlug = PALACE_KR_EN[chip.key];
        if (!palaceSlug) continue;
        const palaceKey = `ziwei.palace.${palaceSlug}`;
        if (!palaceWhitelist.includes(palaceKey)) continue;
        const signed = chip.polarity === "negative"
          ? -PALACE_CAT_IMPACT
          : chip.polarity === "positive"
            ? PALACE_CAT_IMPACT
            : PALACE_CAT_IMPACT * 0.3;
        catEventImpact.set(palaceKey, (catEventImpact.get(palaceKey) ?? 0) + signed);
      }
    }

    // Build global polarity lookup from already-computed topEvents
    const globalPolarityMap = new Map<string, "positive" | "negative" | "neutral">();
    for (const ev of topEvents) globalPolarityMap.set(ev.key, ev.polarity);

    type Cand = { key: string; absImpact: number; polarity: "positive" | "negative" | "neutral" };

    const allCandidates: Cand[] = [...catEventImpact.entries()]
      .filter(([key]) => !key.startsWith("unknown."))
      .map(([key, catImpact]) => ({
        key,
        absImpact: Math.abs(catImpact),
        polarity: globalPolarityMap.get(key)
          ?? (catImpact > 0.01 ? "positive" : catImpact < -0.01 ? "negative" : "neutral"),
      }))
      .filter(e => e.absImpact >= 0.3);

    // Separate atom-sourced events from palace chips.
    // Palace chips always fill at most 1 trailing slot so atom chips are never crowded out.
    const atomCands   = allCandidates.filter(e => !e.key.startsWith("ziwei."));
    const palaceCands = allCandidates.filter(e => e.key.startsWith("ziwei."));

    const pickDirectionAware = (pool: Cand[], score: number, n: number): string[] => {
      if (n <= 0 || pool.length === 0) return [];
      if (score >= 65) {
        const pos  = pool.filter(e => e.polarity !== "negative").sort((a, b) => b.absImpact - a.absImpact);
        const rest = pool.filter(e => e.polarity === "negative").sort((a, b) => b.absImpact - a.absImpact);
        return [...pos, ...rest].slice(0, n).map(e => e.key);
      } else if (score <= 55) {
        const neg  = pool.filter(e => e.polarity !== "positive").sort((a, b) => b.absImpact - a.absImpact);
        const rest = pool.filter(e => e.polarity === "positive").sort((a, b) => b.absImpact - a.absImpact);
        return [...neg, ...rest].slice(0, n).map(e => e.key);
      }
      return pool.sort((a, b) => b.absImpact - a.absImpact).slice(0, n).map(e => e.key);
    };

    const catScore = fortune.scores[cat] as number;

    // Filter palace candidates by score direction before slot allocation.
    // High score (>=65): negative palace excluded.
    // Low score (<=55):  positive palace excluded.
    // Middle (56~64):    all palaces allowed.
    const directedPalaceCands = palaceCands.filter(e => {
      if (catScore >= 65) return e.polarity !== "negative";
      if (catScore <= 55) return e.polarity !== "positive";
      return true;
    });

    // Atoms take priority (up to 2 slots).
    // Palace fills 1 trailing slot only when:
    //   (a) direction-filtered palace candidates exist, AND
    //   (b) at least 1 atom chip was selected (palace-only prevention).
    const hasPalace  = directedPalaceCands.length > 0;
    const atomSlots  = hasPalace ? MAX_CAT_EVENTS - 1 : MAX_CAT_EVENTS;
    const atomSelected   = pickDirectionAware(atomCands, catScore, atomSlots);
    const palaceSelected = hasPalace && atomSelected.length > 0
      ? pickDirectionAware(directedPalaceCands, catScore, 1)
      : [];
    const selected = [...atomSelected, ...palaceSelected];

    categoryHighlights[cat] = {
      topStates: topCatStates.map(s => s.stateKey),
      topEvents: selected,
    };
  }

  // ── Step 5: flowType ──────────────────────────────────────────────────────
  const flowType = classifyFlowType(atomDebug.topAtoms);

  return { _v: PERSISTED_SCHEMA_V, topEvents, topStates, categoryHighlights, summary: { flowType } };
}
