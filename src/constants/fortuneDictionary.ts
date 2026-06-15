/**
 * Fortune UI Dictionary
 *
 * Resolves canonical persisted keys → display labels, icons, and tone metadata.
 * Persisted layer stores keys only. All UI text lives here.
 *
 * Key namespaces covered:
 *   saju.tenGod.*     saju.branch.*    saju.star.*    saju.ohaeng.*
 *   ziwei.palace.*
 *   astro.aspect.<planet>.<aspect>   (dynamic — computed from sub-maps)
 *   state.*           flow.*
 *   unknown.*         (safe fallback)
 */

import { STATE_LABELS as V2_STATE_LABELS } from "../ai/v2/stateDictionary";

// ── Types ──────────────────────────────────────────────────────────────────────

export type Tone    = "positive" | "negative" | "neutral";
/** Direction of a state change: activated (+) or suppressed (−). */
export type Polarity = "positive" | "negative";

export interface EventMeta {
  icon:     string;  // logical icon identifier resolved by UI icon system
  tone:     Tone;
  priority: number;  // 1 = high, 2 = medium, 3 = low
}

export interface StateMeta {
  icon:     string;
  tone:     Tone;
  priority: number;
}

// ── EVENT_LABELS ───────────────────────────────────────────────────────────────

export const EVENT_LABELS: Record<string, string> = {

  // ── saju · ten god ──────────────────────────────────────────────────────────
  "saju.tenGod.siksin":     "식신 흐름",
  "saju.tenGod.jeongin":    "정인 흐름",
  "saju.tenGod.sanggwan":   "상관 흐름",
  "saju.tenGod.jeonggwan":  "정관 흐름",
  "saju.tenGod.pyeonggwan": "편관 흐름",
  "saju.tenGod.pyeongjae":  "편재 흐름",
  "saju.tenGod.jeongjae":   "정재 흐름",
  "saju.tenGod.bigyeon":    "비견 흐름",
  "saju.tenGod.geobjae":    "겁재 흐름",
  "saju.tenGod.pyeongin":   "편인 흐름",

  // ── saju · branch relation ───────────────────────────────────────────────────
  "saju.branch.clash":               "충돌 흐름",
  "saju.branch.sixHarmony":          "육합 흐름",
  "saju.branch.trine":               "삼합 흐름",
  "saju.branch.directionalHarmony":  "방합 흐름",
  "saju.branch.halfTrine":           "반합 흐름",
  "saju.branch.penalty":             "형살 흐름",
  "saju.branch.triplePenalty":       "삼형 흐름",
  "saju.branch.harm":                "해살 흐름",
  "saju.branch.hostility":           "원진 흐름",
  "saju.branch.spiritDoor":          "귀문 흐름",
  "saju.branch.selfPenalty":         "복음 흐름",

  // ── saju · special star ──────────────────────────────────────────────────────
  "saju.star.doHwa":     "도화 활성",
  "saju.star.yeokMa":    "역마 활성",
  "saju.star.baekHo":    "백호 활성",
  "saju.star.hwaGae":    "화개 활성",
  "saju.star.geobSal":   "겁살 활성",
  "saju.star.cheonDeok": "천덕귀인 활성",
  "saju.star.wolDeok":   "월덕귀인 활성",

  // ── saju · twelve state (십이운성) ────────────────────────────────────────────
  "saju.twelveState.jangSaeng": "장생 기운",
  "saju.twelveState.mokYok":    "목욕 기운",
  "saju.twelveState.gwanDae":   "관대 기운",
  // TODO: 엔진(persistedDailyMapper TWELVE_STATE_KEY)은 "건록"을 geonRok으로 emit한다.
  //       imGwan(임관)은 같은 단계의 다른 명칭으로, 실제로는 발생하지 않음 — 명칭 통일 검토 필요.
  "saju.twelveState.imGwan":    "임관 기운",
  "saju.twelveState.geonRok":   "건록 기운",
  "saju.twelveState.jeWang":    "제왕 기운",
  "saju.twelveState.soe":       "쇠 기운",
  "saju.twelveState.byeong":    "병 기운",
  "saju.twelveState.sa":        "사 기운",
  "saju.twelveState.myo":       "묘 기운",
  "saju.twelveState.jeol":      "절 기운",
  "saju.twelveState.tae":       "태 기운",
  "saju.twelveState.yang":      "양 기운",

  // ── saju · ohaeng ────────────────────────────────────────────────────────────
  "saju.ohaeng.clash": "오행 충돌",

  // ── ziwei · palace ───────────────────────────────────────────────────────────
  "ziwei.palace.life":     "명궁 활성",
  "ziwei.palace.siblings": "형제궁 활성",
  "ziwei.palace.spouse":   "부처궁 활성",
  "ziwei.palace.children": "자녀궁 활성",
  "ziwei.palace.wealth":   "재백궁 활성",
  "ziwei.palace.health":   "질액궁 활성",
  "ziwei.palace.travel":   "천이궁 활성",
  "ziwei.palace.friends":  "교우궁 활성",
  "ziwei.palace.career":   "관록궁 활성",
  "ziwei.palace.property": "전택궁 활성",
  "ziwei.palace.spirit":   "복덕궁 활성",
  "ziwei.palace.parents":  "부모궁 활성",

  // ── ziwei · transform (사화 四化) ────────────────────────────────────────────
  "ziwei.transform.huaLu":   "화록",
  "ziwei.transform.huaQuan": "화권",
  "ziwei.transform.huaKe":   "화과",
  "ziwei.transform.huaJi":   "화기",

  // astro.aspect.* → resolved dynamically by resolveAstroLabel()
};

// ── Astro aspect: dynamic label generation ────────────────────────────────────

const ASTRO_PLANET_KR: Readonly<Record<string, string>> = {
  sun:       "태양",
  moon:      "달",
  mercury:   "수성",
  venus:     "금성",
  mars:      "화성",
  jupiter:   "목성",
  saturn:    "토성",
  uranus:    "천왕성",
  neptune:   "해왕성",
  pluto:     "명왕성",
  northNode: "북교점",
  chiron:    "카이런",
};

const ASTRO_ASPECT_KR: Readonly<Record<string, string>> = {
  trine:       "조화각",
  square:      "충돌각",
  conjunction: "합",
  opposition:  "대립각",
  sextile:     "육분각",
  quincunx:    "불일치각",
  semisquare:  "반충돌각",
  semisextile: "반육분각",
};

/** Resolve "astro.aspect.<planet>.<aspect>" → Korean label. Returns null for unrecognized keys. */
function resolveAstroLabel(key: string): string | null {
  // key: "astro.aspect.sun.trine"
  const parts = key.split(".");
  if (parts.length !== 4 || parts[0] !== "astro" || parts[1] !== "aspect") return null;
  const planetKr = ASTRO_PLANET_KR[parts[2]];
  const aspectKr = ASTRO_ASPECT_KR[parts[3]];
  if (!planetKr || !aspectKr) return null;
  return `${planetKr} ${aspectKr}`;
}

// ── STATE_LABELS ───────────────────────────────────────────────────────────────
// 단일 출처: V2 상태 33종은 ai/v2/stateDictionary를 참조한다 (라벨 수정은 그쪽에서).
// 여기서는 "state." prefix만 부여하고, V2에 없는 V1 전용 레거시 5종만 직접 유지한다.

export const STATE_LABELS: Record<string, string> = {
  // V2 상태 33종 — ai/v2/stateDictionary 단일 출처 (수정 금지, 원본에서 수정)
  ...Object.fromEntries(
    Object.entries(V2_STATE_LABELS).map(([k, v]) => [`state.${k}`, v])
  ),
  // V1 전용 레거시 상태 (V2 체계에 없음 — 구버전 persisted/EVENT_INFO 호환용)
  "state.tension":       "긴장 흐름 증가",
  "state.recovery":      "회복 흐름 강화",
  "state.socialFatigue": "사회 피로 증가",
  "state.organization":  "정리 흐름 강화",
  "state.impulsiveness": "충동 흐름 활성",
};

// ── FLOW_LABELS ────────────────────────────────────────────────────────────────

export const FLOW_LABELS: Record<string, string> = {
  "flow.highExecution":  "실행 흐름 우세",
  "flow.recoveryDay":    "회복 흐름 중심",
  "flow.focusBoost":     "집중 강화",
  "flow.stableFlow":     "안정 흐름 유지",
  "flow.emotionalSwing": "감정 흐름 변동",
  "flow.socialDrain":    "관계 에너지 소모",
  "flow.tensionSpike":   "긴장 급증",
  "flow.lowEnergy":      "에너지 저하",
  "flow.impulsive":      "충동 흐름 우세",
  "flow.blocked":        "흐름 억제",
  "flow.neutral":        "중립 흐름",
  // 표시 전용 flow (EVENT_INFO relatedFlows에서 참조 — classifyFlowType은 산출하지 않음)
  "flow.newBeginning":   "새 시작 흐름",
  "flow.introspection":  "내면 정리 흐름",
};

// ── EVENT_META ─────────────────────────────────────────────────────────────────

export const EVENT_META: Record<string, EventMeta> = {

  // saju · ten god
  "saju.tenGod.siksin":     { icon: "leaf",      tone: "positive", priority: 2 },
  "saju.tenGod.jeongin":    { icon: "book",      tone: "positive", priority: 2 },
  "saju.tenGod.jeonggwan":  { icon: "shield",    tone: "positive", priority: 2 },
  "saju.tenGod.pyeongjae":  { icon: "coin",      tone: "positive", priority: 2 },
  "saju.tenGod.jeongjae":   { icon: "coin",      tone: "positive", priority: 2 },
  "saju.tenGod.pyeongin":   { icon: "eye",       tone: "neutral",  priority: 3 },
  "saju.tenGod.bigyeon":    { icon: "person",    tone: "neutral",  priority: 3 },
  "saju.tenGod.sanggwan":   { icon: "spark",     tone: "neutral",  priority: 2 },
  "saju.tenGod.pyeonggwan": { icon: "bolt",      tone: "negative", priority: 1 },
  "saju.tenGod.geobjae":    { icon: "warning",   tone: "negative", priority: 1 },

  // saju · branch — harmonious
  "saju.branch.sixHarmony":          { icon: "circle",   tone: "positive", priority: 2 },
  "saju.branch.trine":               { icon: "triangle", tone: "positive", priority: 2 },
  "saju.branch.directionalHarmony":  { icon: "arrow",    tone: "positive", priority: 3 },
  "saju.branch.halfTrine":           { icon: "triangle", tone: "positive", priority: 3 },
  "saju.branch.selfPenalty":         { icon: "loop",     tone: "neutral",  priority: 3 },
  // saju · branch — tense
  "saju.branch.clash":         { icon: "bolt",    tone: "negative", priority: 1 },
  "saju.branch.penalty":       { icon: "warning", tone: "negative", priority: 1 },
  "saju.branch.triplePenalty": { icon: "warning", tone: "negative", priority: 1 },
  "saju.branch.harm":          { icon: "minus",   tone: "negative", priority: 2 },
  "saju.branch.hostility":     { icon: "minus",   tone: "negative", priority: 2 },
  "saju.branch.spiritDoor":    { icon: "eye",     tone: "neutral",  priority: 2 },

  // saju · star
  "saju.star.doHwa":     { icon: "flower",  tone: "positive", priority: 2 },
  "saju.star.yeokMa":    { icon: "horse",   tone: "neutral",  priority: 2 },
  "saju.star.baekHo":    { icon: "tiger",   tone: "negative", priority: 1 },
  "saju.star.hwaGae":    { icon: "cloud",   tone: "neutral",  priority: 3 },
  "saju.star.geobSal":   { icon: "shield",  tone: "negative", priority: 1 },
  "saju.star.cheonDeok": { icon: "star",    tone: "positive", priority: 2 },
  "saju.star.wolDeok":   { icon: "star",    tone: "positive", priority: 2 },

  // saju · twelve state (십이운성)
  "saju.twelveState.jangSaeng": { icon: "sprout",   tone: "positive", priority: 2 },
  "saju.twelveState.mokYok":    { icon: "droplet",  tone: "neutral",  priority: 3 },
  "saju.twelveState.gwanDae":   { icon: "crown",    tone: "positive", priority: 2 },
  "saju.twelveState.imGwan":    { icon: "shield",   tone: "positive", priority: 2 },
  "saju.twelveState.geonRok":   { icon: "shield",   tone: "positive", priority: 2 },
  "saju.twelveState.jeWang":    { icon: "star",     tone: "positive", priority: 1 },
  "saju.twelveState.soe":       { icon: "minus",    tone: "neutral",  priority: 3 },
  "saju.twelveState.byeong":    { icon: "warning",  tone: "negative", priority: 2 },
  "saju.twelveState.sa":        { icon: "cross",    tone: "negative", priority: 2 },
  "saju.twelveState.myo":       { icon: "circle",   tone: "neutral",  priority: 3 },
  "saju.twelveState.jeol":      { icon: "minus",    tone: "negative", priority: 2 },
  "saju.twelveState.tae":       { icon: "dot",      tone: "neutral",  priority: 3 },
  "saju.twelveState.yang":      { icon: "sprout",   tone: "positive", priority: 3 },

  // saju · ohaeng
  "saju.ohaeng.clash": { icon: "bolt", tone: "negative", priority: 1 },

  // ziwei · palace
  "ziwei.palace.life":     { icon: "compass",   tone: "neutral",  priority: 2 },
  "ziwei.palace.siblings": { icon: "people",    tone: "neutral",  priority: 3 },
  "ziwei.palace.spouse":   { icon: "heart",     tone: "neutral",  priority: 2 },
  "ziwei.palace.children": { icon: "child",     tone: "neutral",  priority: 3 },
  "ziwei.palace.wealth":   { icon: "coin",      tone: "neutral",  priority: 2 },
  "ziwei.palace.health":   { icon: "leaf",      tone: "neutral",  priority: 1 },
  "ziwei.palace.travel":   { icon: "arrow",     tone: "neutral",  priority: 2 },
  "ziwei.palace.friends":  { icon: "people",    tone: "neutral",  priority: 2 },
  "ziwei.palace.career":   { icon: "briefcase", tone: "neutral",  priority: 2 },
  "ziwei.palace.property": { icon: "home",      tone: "neutral",  priority: 3 },
  "ziwei.palace.spirit":   { icon: "cloud",     tone: "positive", priority: 3 },
  "ziwei.palace.parents":  { icon: "people",    tone: "neutral",  priority: 3 },

  // astro.aspect.* → resolved dynamically by resolveAstroMeta()
};

// Astro aspect meta — tone derived from aspect type, priority from planet significance
const TENSE_ASPECTS  = new Set(["square", "opposition", "quincunx", "semisquare"]);
const EASY_ASPECTS   = new Set(["trine", "sextile", "conjunction"]);
const HIGH_PRIORITY_PLANETS = new Set(["sun", "moon", "saturn", "mars"]);

function resolveAstroMeta(key: string): EventMeta | null {
  const parts = key.split(".");
  if (parts.length !== 4 || parts[0] !== "astro" || parts[1] !== "aspect") return null;
  const [, , planet, aspect] = parts;
  if (!ASTRO_PLANET_KR[planet] || !ASTRO_ASPECT_KR[aspect]) return null;
  const tone: Tone = TENSE_ASPECTS.has(aspect) ? "negative"
                   : EASY_ASPECTS.has(aspect)  ? "positive"
                   : "neutral";
  return {
    icon:     "planet",
    tone,
    priority: HIGH_PRIORITY_PLANETS.has(planet) ? 1 : 2,
  };
}

// ── STATE_META ─────────────────────────────────────────────────────────────────

export const STATE_META: Record<string, StateMeta> = {
  "state.stability":          { icon: "anchor",  tone: "positive", priority: 1 },
  "state.tension":            { icon: "bolt",    tone: "negative", priority: 1 },
  "state.recovery":           { icon: "leaf",    tone: "positive", priority: 1 },
  "state.focus":              { icon: "eye",     tone: "positive", priority: 2 },
  "state.emotionalAmplitude": { icon: "wave",    tone: "neutral",  priority: 2 },
  "state.socialFatigue":      { icon: "minus",   tone: "negative", priority: 2 },
  "state.executionFlow":      { icon: "arrow",   tone: "positive", priority: 1 },
  "state.energySustain":      { icon: "battery", tone: "positive", priority: 2 },
  "state.organization":       { icon: "grid",    tone: "positive", priority: 2 },
  "state.impulsiveness":      { icon: "spark",   tone: "neutral",  priority: 2 },
};

// ── safeResolveLabel ───────────────────────────────────────────────────────────

/**
 * Resolve a canonical persisted key to a display label.
 *
 * Resolution order:
 *   1. EVENT_LABELS  — static saju / ziwei keys
 *   2. STATE_LABELS  — state.* keys
 *   3. FLOW_LABELS   — flow.* keys
 *   4. astro.aspect.* — dynamic generation from planet + aspect sub-maps
 *   5. unknown.*     — strip prefix, humanize slug
 *   6. raw key       — final fallback, never throws
 */
export function safeResolveLabel(key: string): string {
  const label = EVENT_LABELS[key] ?? STATE_LABELS[key] ?? FLOW_LABELS[key];
  if (label) return label;

  const astroLabel = resolveAstroLabel(key);
  if (astroLabel) return astroLabel;

  if (key.startsWith("unknown.")) {
    const slug = key.slice(8).replace(/_/g, " ").trim();
    return slug || key;
  }

  return key;
}

// ── safeResolveMeta ────────────────────────────────────────────────────────────

const META_FALLBACK: EventMeta = { icon: "dot", tone: "neutral", priority: 3 };

/**
 * Resolve a canonical persisted key to EventMeta or StateMeta.
 * Returns a neutral fallback if not found — never throws.
 */
export function safeResolveMeta(key: string): EventMeta | StateMeta {
  return EVENT_META[key] ?? STATE_META[key] ?? resolveAstroMeta(key) ?? META_FALLBACK;
}

// ── EventInfo ──────────────────────────────────────────────────────────────────

export interface EventInfo {
  /** Display name of the element itself. */
  title:               string;
  /** One-line description of what this element represents. */
  shortDescription:    string;
  /** Expanded explanation without fortune-telling language. */
  detailedDescription?: string;
  /** Situations where this element commonly appears. */
  commonPatterns?:     string[];
  /** States this event activates (+) or suppresses (−) — keys resolved via STATE_LABELS in UI. */
  relatedStates?:      Array<{ key: string; polarity: Polarity }>;
  /** Flow keys that frequently co-occur with this element. */
  relatedFlows?:       string[];
}

// ── EVENT_INFO ─────────────────────────────────────────────────────────────────

export const EVENT_INFO: Record<string, EventInfo> = {

  // ── saju · ten god ──────────────────────────────────────────────────────────
  "saju.tenGod.siksin": {
    title:               "식신",
    shortDescription:    "안정된 표현·창작 흐름과 연결되는 요소예요.",
    detailedDescription: "자신이 가진 것을 자연스럽게 표현하거나 발휘하는 흐름과 함께 나타나는 편이에요. 에너지가 충분히 쌓인 상태에서 외부로 흘러나오는 느낌의 흐름이에요.",
    commonPatterns: ["창작·표현 활동이 잘 되는 시기", "식욕·감각이 예민해지는 흐름", "여유로운 자기표현 욕구"],
    relatedStates: [
      { key: "state.recovery",      polarity: "positive" },
      { key: "state.energySustain", polarity: "positive" },
      { key: "state.stability",     polarity: "positive" },
    ],
    relatedFlows: ["flow.recoveryDay", "flow.stableFlow"],
  },
  "saju.tenGod.jeongin": {
    title:               "정인",
    shortDescription:    "학습·보호·안정 흐름과 연결되는 요소예요.",
    detailedDescription: "배우거나 받아들이는 흐름이 자연스럽게 열리는 시기와 함께 나타나는 편이에요. 외부의 지지나 도움이 연결되는 흐름과도 겹치기도 해요.",
    commonPatterns: ["학습·공부 집중이 잘 되는 시기", "자격·인증 관련 흐름", "안정적인 지원 관계"],
    relatedStates: [
      { key: "state.recovery",  polarity: "positive" },
      { key: "state.stability", polarity: "positive" },
      { key: "state.focus",     polarity: "positive" },
    ],
    relatedFlows: ["flow.focusBoost", "flow.stableFlow"],
  },
  "saju.tenGod.pyeonggwan": {
    title:               "편관",
    shortDescription:    "긴장·압박·실행 흐름이 동시에 올라오는 요소예요.",
    detailedDescription: "외부 압력이나 경쟁 요소가 자극으로 작용하는 흐름과 함께 나타나요. 방향이 명확할 때는 집중된 실행력으로 전환되기도 하지만, 방향이 불분명하면 긴장감으로 남기도 해요.",
    commonPatterns: ["외부 압박·경쟁 상황", "결단이 필요한 순간", "실행 동력이 강해지는 흐름"],
    relatedStates: [
      { key: "state.tension",       polarity: "positive" },
      { key: "state.executionFlow", polarity: "positive" },
    ],
    relatedFlows: ["flow.tensionSpike", "flow.highExecution"],
  },
  "saju.tenGod.sanggwan": {
    title:               "상관",
    shortDescription:    "표현·창의 에너지가 강하게 올라오는 요소예요.",
    detailedDescription: "자신의 생각이나 감정을 밖으로 드러내고 싶은 흐름이 커지는 시기와 함께 나타나는 편이에요. 집중력이 올라오는 반면, 감정 진폭도 함께 커지는 경향이 있어요. 꼭 갈등이나 마찰만을 의미하는 건 아니고, 표현 욕구 자체가 활성화되는 에너지로 나타나기도 해요.",
    commonPatterns: ["창의적 아이디어나 표현 욕구가 활발해지는 시기", "감정이 예민해지거나 마찰이 생기기 쉬운 흐름", "집중력이 높아지는 동시에 충동적 반응이 생기기도 함"],
    relatedStates: [
      { key: "state.focus",              polarity: "positive" },
      { key: "state.emotionalAmplitude", polarity: "positive" },
      { key: "state.stability",          polarity: "negative" },
    ],
    relatedFlows: ["flow.focusBoost", "flow.emotionalSwing"],
  },
  "saju.tenGod.geobjae": {
    title:               "겁재",
    shortDescription:    "긴장감과 충동 흐름이 함께 올라오는 요소예요.",
    detailedDescription: "강한 긴장 에너지와 충동적인 행동 욕구가 동시에 활성화되는 흐름과 함께 나타나는 편이에요. 경쟁이나 갈등 상황에서 빠르게 반응하는 에너지가 강해지는 시기예요. 이 에너지가 잘 조절되면 집중력으로 전환되기도 하지만, 무리하게 소모될 경우 손실이나 낭비로 이어지기도 해요.",
    commonPatterns: ["경쟁·갈등 상황에서 반응이 빨라지는 흐름", "충동적 결정이나 에너지 낭비가 생기기 쉬운 시기", "예상치 못한 지출이나 손실 흐름과 겹치기도 함"],
    relatedStates: [
      { key: "state.tension",       polarity: "positive" },
      { key: "state.impulsiveness", polarity: "positive" },
    ],
    relatedFlows: ["flow.tensionSpike", "flow.impulsive"],
  },
  "saju.tenGod.jeonggwan": {
    title:               "정관",
    shortDescription:    "안정·책임·체계 흐름과 연결되는 요소예요.",
    detailedDescription: "규칙이나 체계를 따르는 흐름이 강해지고, 안정감이 올라오는 시기와 함께 나타나는 편이에요. 책임감이나 사회적 역할 의식이 강조되는 흐름이에요. 꼭 직업이나 직위와만 연결되는 건 아니고, 일상에서 루틴이나 규칙이 잘 작동하는 흐름으로 나타나기도 해요.",
    commonPatterns: ["체계·규칙이 잘 작동하는 시기", "책임·역할에 집중하는 흐름", "조직이나 관계에서 안정이 유지되는 편"],
    relatedStates: [
      { key: "state.stability",    polarity: "positive" },
      { key: "state.organization", polarity: "positive" },
      { key: "state.focus",        polarity: "positive" },
    ],
    relatedFlows: ["flow.stableFlow", "flow.focusBoost"],
  },
  "saju.tenGod.pyeongjae": {
    title:               "편재",
    shortDescription:    "기회·변화 흐름과 함께 실행 에너지가 올라오는 요소예요.",
    detailedDescription: "정해진 패턴보다 유동적인 상황에서 에너지가 활성화되는 흐름이에요. 새로운 기회나 변화 요소가 생기는 시기와 함께 나타나는 편이에요. 꼭 금전적 수입만을 의미하는 건 아니고, 상황의 유연성이나 다양한 가능성이 열리는 흐름으로 나타나기도 해요.",
    commonPatterns: ["유동적인 기회나 변화 흐름이 생기는 시기", "실행력과 에너지 지속성이 올라오는 편", "새로운 루트나 방식이 등장하는 흐름"],
    relatedStates: [
      { key: "state.executionFlow", polarity: "positive" },
      { key: "state.energySustain", polarity: "positive" },
    ],
    relatedFlows: ["flow.highExecution", "flow.stableFlow"],
  },
  "saju.tenGod.jeongjae": {
    title:               "정재",
    shortDescription:    "꾸준한 유지·관리 에너지와 연결되는 요소예요.",
    detailedDescription: "안정적으로 유지하고 관리하는 흐름이 강해지는 시기와 함께 나타나는 편이에요. 급격한 변화보다는 현재 상태를 잘 다듬고 지키는 에너지예요. 재정적 안정뿐 아니라, 일상의 루틴이나 관계를 꾸준히 이어가는 흐름으로 나타나기도 해요.",
    commonPatterns: ["현재 상태를 안정적으로 유지하는 흐름", "수입·관리·정리 등 꾸준한 활동이 잘 되는 시기", "급변보다 지속과 유지가 강조되는 편"],
    relatedStates: [
      { key: "state.stability",    polarity: "positive" },
      { key: "state.organization", polarity: "positive" },
    ],
    relatedFlows: ["flow.stableFlow"],
  },
  "saju.tenGod.bigyeon": {
    title:               "비견",
    shortDescription:    "자기 주도성과 안정 에너지가 활성화되는 요소예요.",
    detailedDescription: "스스로 주도하거나 독자적으로 움직이는 흐름이 강해지는 시기와 함께 나타나는 편이에요. 협력보다 자기 중심으로 에너지가 모이는 흐름이에요. 다른 십신에 비해 단독 작용은 약하지만, 자기 의지를 밀고 나가거나 독립적으로 행동하는 에너지로 나타나기도 해요.",
    commonPatterns: ["독립적으로 행동하려는 흐름이 강해지는 시기", "자기 주장이나 의지가 표면에 드러나는 편", "경쟁 의식이 생기거나 자존감이 올라오는 흐름"],
    relatedStates: [
      { key: "state.stability", polarity: "positive" },
    ],
    relatedFlows: ["flow.stableFlow"],
  },
  "saju.tenGod.pyeongin": {
    title:               "편인",
    shortDescription:    "내면 집중과 감정 진폭이 함께 올라오는 요소예요.",
    detailedDescription: "사고와 내면 탐구 에너지가 강해지는 흐름이에요. 집중력이 생기지만, 그 방향이 외부보다 내면으로 향하는 경향이 있어요. 직관이나 사고력이 예민해지는 시기와 함께 나타나는 편이에요. 꼭 고립이나 우울만을 의미하는 건 아니고, 깊게 생각하거나 혼자만의 시간이 필요해지는 흐름으로 나타나기도 해요.",
    commonPatterns: ["내면적 사고·분석이 활발해지는 시기", "외부보다 내면에 에너지가 집중되는 흐름", "직관이 예민해지거나 감정 진폭이 커지기도 함"],
    relatedStates: [
      { key: "state.focus",              polarity: "positive" },
      { key: "state.emotionalAmplitude", polarity: "positive" },
    ],
    relatedFlows: ["flow.focusBoost", "flow.emotionalSwing"],
  },

  // ── saju · branch ────────────────────────────────────────────────────────────
  "saju.branch.clash": {
    title:               "지지 충",
    shortDescription:    "대립·충돌·변화 에너지가 활성화되는 흐름이에요.",
    detailedDescription: "두 에너지가 서로 맞부딪히는 구조로, 안정보다는 변화나 조정이 일어나기 쉬운 흐름이에요. 마찰이 생기기도 하지만, 막혀 있던 흐름이 풀리는 계기가 되기도 해요.",
    commonPatterns: ["갈등·마찰 상황", "기존 구조의 변동", "에너지 방향 전환"],
    relatedStates: [
      { key: "state.tension",           polarity: "positive" },
      { key: "state.socialFatigue",     polarity: "positive" },
      { key: "state.emotionalAmplitude", polarity: "positive" },
    ],
    relatedFlows: ["flow.tensionSpike", "flow.blocked"],
  },
  "saju.branch.trine": {
    title:               "삼합",
    shortDescription:    "세 에너지가 모여 안정된 흐름을 만드는 구조예요.",
    detailedDescription: "서로 다른 에너지가 하나의 방향으로 정렬되는 흐름이에요. 자연스럽게 힘이 모이는 느낌이 나며, 지속성이 있는 흐름과 함께 나타나는 경향이 있어요.",
    commonPatterns: ["흐름이 일관되게 유지되는 시기", "지속 가능한 추진력", "여러 조건이 맞아떨어지는 상황"],
    relatedStates: [
      { key: "state.stability",     polarity: "positive" },
      { key: "state.energySustain", polarity: "positive" },
      { key: "state.executionFlow", polarity: "positive" },
    ],
    relatedFlows: ["flow.stableFlow", "flow.highExecution"],
  },
  "saju.branch.sixHarmony": {
    title:               "육합",
    shortDescription:    "두 에너지가 자연스럽게 합쳐지는 안정적인 흐름이에요.",
    detailedDescription: "서로 다른 두 에너지가 부드럽게 연결되는 구조로, 긴장이 완화되고 안정감이 올라오는 흐름이에요. 관계나 상황의 마찰이 줄어드는 시기와 함께 나타나는 편이에요. 꼭 외부 관계에서만 나타나는 건 아니고, 내면의 갈등이 잦아들거나 흐름이 부드러워지는 형태로 나타나기도 해요.",
    commonPatterns: ["관계·상황에서 마찰이 줄어드는 흐름", "긴장이 완화되고 안정감이 올라오는 시기", "감정 소모가 적어지고 회복력이 강해지는 편"],
    relatedStates: [
      { key: "state.stability",          polarity: "positive" },
      { key: "state.recovery",           polarity: "positive" },
      { key: "state.emotionalAmplitude", polarity: "negative" },
    ],
    relatedFlows: ["flow.stableFlow", "flow.recoveryDay"],
  },
  "saju.branch.penalty": {
    title:               "지지 형",
    shortDescription:    "잠재적 긴장이 내부적으로 누적되는 지지 관계예요.",
    detailedDescription: "충(沖)처럼 직접적인 충돌이 아니라, 내부적으로 긴장이 쌓이는 구조예요. 안정감이 흔들리면서 불편함이 누적되는 흐름과 함께 나타나는 편이에요. 겉으로는 크게 드러나지 않지만, 관계나 상황에서 서서히 마찰이 쌓이는 시기와 겹치기도 해요.",
    commonPatterns: ["겉으로 드러나지 않는 긴장이 누적되는 시기", "안정감이 약해지면서 불편한 상황이 지속되는 편", "관계나 상황에서 서서히 마찰이 쌓이는 흐름"],
    relatedStates: [
      { key: "state.tension",   polarity: "positive" },
      { key: "state.stability", polarity: "negative" },
    ],
    relatedFlows: ["flow.tensionSpike", "flow.blocked"],
  },
  "saju.branch.hostility": {
    title:               "원진",
    shortDescription:    "서로 맞지 않는 에너지가 만나 관계 피로가 쌓이는 흐름이에요.",
    detailedDescription: "원진(怨嗔)은 서로 어긋나는 성질의 에너지가 만나는 구조예요. 관계에서 설명하기 어려운 불편함이나 피로감이 누적되는 흐름과 함께 나타나는 편이에요. 직접적인 갈등이 아니더라도, 왠지 맞지 않는 느낌이나 어긋남이 반복되는 상황과 겹치기도 해요.",
    commonPatterns: ["설명하기 어려운 관계 피로나 불편함", "감정 소모가 누적되는 시기", "맞지 않는 에너지끼리 만나는 상황"],
    relatedStates: [
      { key: "state.socialFatigue",      polarity: "positive" },
      { key: "state.emotionalAmplitude", polarity: "positive" },
    ],
    relatedFlows: ["flow.socialDrain", "flow.emotionalSwing"],
  },
  "saju.branch.spiritDoor": {
    title:               "귀문",
    shortDescription:    "감정이 예민하고 내면 에너지가 증폭되는 흐름이에요.",
    detailedDescription: "귀문관살(鬼門關殺)은 내면을 향하는 예민한 에너지와 연결되는 요소예요. 감정 진폭이 커지고 직관이 예민해지는 시기와 함께 나타나는 편이에요. 꼭 부정적인 의미만은 아니고, 직관이 선명해지거나 감수성이 깊어지는 흐름으로 나타나기도 해요. 외부보다 내면에서 에너지가 증폭되는 특성이 있어요.",
    commonPatterns: ["감정이나 직관이 예민해지는 시기", "내면의 에너지가 증폭되거나 생각이 많아지는 흐름", "관계 에너지 소모와 함께 나타나기도 함"],
    relatedStates: [
      { key: "state.emotionalAmplitude", polarity: "positive" },
      { key: "state.socialFatigue",      polarity: "positive" },
    ],
    relatedFlows: ["flow.emotionalSwing", "flow.socialDrain"],
  },

  // ── saju · special star ──────────────────────────────────────────────────────
  "saju.star.doHwa": {
    title:               "도화살",
    shortDescription:    "감성·매력·관계 흐름과 연결되는 요소예요.",
    detailedDescription: "인상이나 감수성이 표면에 드러나는 흐름과 자주 함께 나타나요. 대인 관계에서 활기가 생기거나, 감정이 더 예민하게 반응하는 시기와 겹치기도 해요.",
    commonPatterns: ["대인관계가 활발해지는 시기", "감정·감수성 민감도 증가", "표현 욕구가 커지는 흐름"],
    relatedStates: [
      { key: "state.emotionalAmplitude", polarity: "positive" },
      { key: "state.impulsiveness",      polarity: "positive" },
      { key: "state.socialFatigue",      polarity: "positive" },
    ],
    relatedFlows: ["flow.emotionalSwing", "flow.socialDrain"],
  },
  "saju.star.yeokMa": {
    title:               "역마살",
    shortDescription:    "이동·변화 흐름과 연결되는 요소예요.",
    detailedDescription: "활동성이 커지거나, 환경·상황의 변화가 생기는 흐름과 함께 나타나는 경향이 있어요. 꼭 실제 이동만 의미하는 건 아니고, 생활 흐름 자체가 달라지는 시기와 겹치기도 해요.",
    commonPatterns: ["이직·이사·출장 같은 이동 상황", "새로운 루틴·환경 변화", "기존 패턴에서 벗어나는 흐름"],
    relatedStates: [
      { key: "state.executionFlow", polarity: "positive" },
      { key: "state.impulsiveness", polarity: "positive" },
      { key: "state.stability",     polarity: "negative" },
    ],
    relatedFlows: ["flow.highExecution", "flow.tensionSpike"],
  },
  "saju.star.baekHo": {
    title:               "백호살",
    shortDescription:    "긴장감이 높아지는 흐름과 연결되는 요소예요.",
    detailedDescription: "예상치 못한 변수나 갑작스러운 변화가 생기는 흐름과 자주 함께 나타나요. 에너지 소모가 급격하게 일어나는 시기와 겹치기도 해요.",
    commonPatterns: ["갑작스러운 변수 발생", "신체·에너지 흐름의 급변", "빠른 결정이 필요한 상황"],
    relatedStates: [
      { key: "state.tension",       polarity: "positive" },
      { key: "state.recovery",      polarity: "negative" },
      { key: "state.energySustain", polarity: "negative" },
    ],
    relatedFlows: ["flow.tensionSpike", "flow.lowEnergy"],
  },
  "saju.star.geobSal": {
    title:               "겁살",
    shortDescription:    "외부 변수나 예상치 못한 상황과 연결되는 요소예요.",
    detailedDescription: "겁살(劫殺)은 갑작스러운 외부 변수나 예측하기 어려운 상황이 생기는 흐름과 함께 나타나는 편이에요. 긴장감이 올라오면서 안정감이 흔들리는 시기와 겹치기도 해요. 꼭 실제 위험이나 사건만을 의미하는 건 아니고, 계획 변경이나 예상 밖의 상황이 생기는 흐름으로 나타나기도 해요.",
    commonPatterns: ["계획 변경이나 예상 밖 상황이 생기기 쉬운 시기", "외부 자극이나 충격으로 긴장감이 올라오는 흐름", "안정감이 흔들리는 시기와 함께 나타나는 편"],
    relatedStates: [
      { key: "state.tension",   polarity: "positive" },
      { key: "state.stability", polarity: "negative" },
    ],
    relatedFlows: ["flow.tensionSpike", "flow.blocked"],
  },
  "saju.star.cheonDeok": {
    title:               "천덕귀인",
    shortDescription:    "안정과 회복을 지원하는 긍정적 흐름과 연결되는 요소예요.",
    detailedDescription: "천덕귀인(天德貴人)은 하늘의 덕 에너지가 활성화되는 길신이에요. 어려운 상황에서 도움이나 보호가 연결되는 흐름과 함께 나타나는 편이에요. 안정감이 올라오고 회복력이 강해지는 시기와 겹치기도 해요. 꼭 외부에서 누군가가 직접 도와주는 것만을 의미하는 건 아니고, 상황이 자연스럽게 풀리거나 흐름이 부드러워지는 형태로 나타나기도 해요.",
    commonPatterns: ["어려운 상황이 자연스럽게 해소되는 흐름", "안정감이 올라오고 회복력이 강해지는 시기", "도움이나 지지가 연결되는 상황"],
    relatedStates: [
      { key: "state.stability", polarity: "positive" },
      { key: "state.recovery",  polarity: "positive" },
    ],
    relatedFlows: ["flow.stableFlow", "flow.recoveryDay"],
  },

  // ── saju · ohaeng ────────────────────────────────────────────────────────────
  "saju.ohaeng.clash": {
    title:               "오행 충돌",
    shortDescription:    "서로 극하는 오행 에너지가 동시에 작용하는 흐름이에요.",
    detailedDescription: "사주와 운세의 오행 에너지가 서로 극(剋)하는 구조로 만나는 날이에요. 긴장감이 올라오면서 에너지 지속성이 약해지는 흐름과 함께 나타나는 편이에요. 천간 또는 지지 중 하나 이상에서 발생할 수 있고, 에너지가 분산되거나 소모가 생기기 쉬운 흐름이에요. 지지 충과는 별개로 오행 차원에서 작용하는 긴장 요소예요.",
    commonPatterns: ["에너지 소모가 빨라지거나 집중이 흩어지는 시기", "긴장감이 올라오는 흐름", "체력이나 에너지 지속성이 약해지기 쉬운 편"],
    relatedStates: [
      { key: "state.tension",       polarity: "positive" },
      { key: "state.energySustain", polarity: "negative" },
    ],
    relatedFlows: ["flow.tensionSpike", "flow.lowEnergy"],
  },

  // ── ziwei · palace ───────────────────────────────────────────────────────────
  "ziwei.palace.career": {
    title:               "관록궁",
    shortDescription:    "직업·사회적 역할 흐름과 연결되는 자리예요.",
    detailedDescription: "자미두수에서 직업·일·사회적 위치와 관련된 에너지가 모이는 궁이에요. 이 궁이 활성화될 때는 일 관련 흐름에서 변화나 집중이 생기기 쉬운 시기예요.",
    commonPatterns: ["직업·커리어 관련 흐름 활성", "조직·역할 변화 가능성", "사회적 평가·인정 흐름"],
    relatedStates: [
      { key: "state.executionFlow", polarity: "positive" },
      { key: "state.focus",         polarity: "positive" },
      { key: "state.organization",  polarity: "positive" },
    ],
    relatedFlows: ["flow.highExecution", "flow.focusBoost"],
  },

  // ── ziwei · transform (사화 四化) ────────────────────────────────────────────
  "ziwei.transform.huaQuan": {
    title:               "화권",
    shortDescription:    "권위·주도성 흐름을 강화하는 변화성 요소예요.",
    detailedDescription: "자미두수의 사화 중 하나로, 권위·자기주도·결정력과 관련된 에너지를 끌어올리는 경향이 있어요. 주도적으로 움직이는 흐름이 활성화될 때 함께 나타나기도 해요.",
    commonPatterns: ["주도적 역할이 강조되는 시기", "결정·책임 흐름 활성", "권위·신뢰 관련 상황"],
    relatedStates: [
      { key: "state.executionFlow", polarity: "positive" },
      { key: "state.focus",         polarity: "positive" },
      { key: "state.organization",  polarity: "positive" },
    ],
    relatedFlows: ["flow.highExecution", "flow.focusBoost"],
  },
  "ziwei.transform.huaLu": {
    title:               "화록",
    shortDescription:    "순조로움과 풍요 흐름을 강화하는 변화성 요소예요.",
    detailedDescription: "자미두수의 사화 중 하나로, 순조로운 진행·기회·풍요와 관련된 에너지를 끌어올리는 경향이 있어요. 일이 매끄럽게 풀리거나 관계가 부드러워지는 흐름이 활성화될 때 함께 나타나기도 해요.",
    commonPatterns: ["진행이 매끄러워지는 시기", "기회·이득 관련 상황", "관계가 부드러워지는 흐름"],
    relatedStates: [
      { key: "state.stability",     polarity: "positive" },
      { key: "state.energySustain", polarity: "positive" },
    ],
    relatedFlows: ["flow.stableFlow"],
  },
  "ziwei.transform.huaKe": {
    title:               "화과",
    shortDescription:    "인정과 명예 흐름을 강화하는 변화성 요소예요.",
    detailedDescription: "자미두수의 사화 중 하나로, 인정·평판·배움과 관련된 에너지를 끌어올리는 경향이 있어요. 노력이 드러나거나 어려운 일이 부드럽게 풀리는 흐름이 활성화될 때 함께 나타나기도 해요.",
    commonPatterns: ["노력이 인정받는 시기", "배움·평가 관련 상황", "막힌 일이 부드럽게 풀리는 흐름"],
    relatedStates: [
      { key: "state.focus",        polarity: "positive" },
      { key: "state.organization", polarity: "positive" },
    ],
    relatedFlows: ["flow.focusBoost"],
  },
  "ziwei.transform.huaJi": {
    title:               "화기",
    shortDescription:    "얽힘과 막힘 신호를 주는 변화성 요소예요.",
    detailedDescription: "자미두수의 사화 중 하나로, 일이 얽히거나 판단이 흐려지기 쉬운 에너지와 관련돼요. 위험 신호라기보다, 서두르지 않고 한 번 더 확인하면 좋은 시기를 알려주는 요소예요.",
    commonPatterns: ["계획이 어긋나기 쉬운 시기", "판단을 한 번 더 확인하면 좋은 흐름", "마음이 한 곳에 매이기 쉬운 상황"],
    relatedStates: [
      { key: "state.tension",            polarity: "positive" },
      { key: "state.emotionalAmplitude", polarity: "positive" },
    ],
    relatedFlows: ["flow.blocked"],
  },

  // ── astro · aspect ───────────────────────────────────────────────────────────
  "astro.aspect.sun.trine": {
    title:               "태양 조화각",
    shortDescription:    "태양 에너지가 부드럽게 연결되는 행성 흐름이에요.",
    detailedDescription: "자신감·활력·정체성과 관련된 태양 에너지가 다른 천체와 조화롭게 연결되는 시기예요. 흐름이 순조롭게 진행되는 느낌과 함께 나타나는 경향이 있어요.",
    commonPatterns: ["자신감이 자연스럽게 올라오는 시기", "진행 중인 일이 순조로운 흐름", "외부 환경이 협력적인 느낌"],
    relatedStates: [
      { key: "state.stability",     polarity: "positive" },
      { key: "state.energySustain", polarity: "positive" },
    ],
    relatedFlows: ["flow.stableFlow", "flow.highExecution"],
  },
  "astro.aspect.moon.square": {
    title:               "달 충돌각",
    shortDescription:    "감정·본능 에너지가 긴장 상태로 활성화되는 흐름이에요.",
    detailedDescription: "달의 감정·직관 에너지가 다른 천체와 마찰 구조로 만나는 시기예요. 감정 반응이 예상보다 강하거나, 내면과 외부 상황이 불일치하는 느낌이 생기기도 해요.",
    commonPatterns: ["감정 반응이 커지는 시기", "내면 상태와 외부 상황의 불일치", "직관이 예민해지는 흐름"],
    relatedStates: [
      { key: "state.emotionalAmplitude", polarity: "positive" },
      { key: "state.socialFatigue",      polarity: "positive" },
      { key: "state.stability",          polarity: "negative" },
    ],
    relatedFlows: ["flow.emotionalSwing", "flow.tensionSpike"],
  },

  // ── ziwei · palace (remaining) ──────────────────────────────────────────────
  "ziwei.palace.life": {
    title:               "명궁",
    shortDescription:    "자미두수에서 자기 자신과 삶의 방향을 담는 중심 궁이에요.",
    detailedDescription: "명궁(命宮)은 자미두수 열두 궁 중 가장 중심이 되는 자리로, 개인의 성향·체질·삶의 기본 흐름과 관련된 에너지가 집중되는 곳이에요. 이 궁이 활성화될 때는 자기 자신에 대한 인식이나 방향감이 강해지는 흐름이 생기기도 해요.",
    commonPatterns: ["자기 인식이나 방향성이 명확해지는 시기", "핵심 성향이나 체질이 드러나는 흐름", "삶의 주체성이 강조되는 상황"],
    relatedStates: [
      { key: "state.focus",         polarity: "positive" },
      { key: "state.executionFlow", polarity: "positive" },
      { key: "state.organization",  polarity: "positive" },
    ],
    relatedFlows: ["flow.focusBoost", "flow.highExecution"],
  },
  "ziwei.palace.siblings": {
    title:               "형제궁",
    shortDescription:    "형제·자매 및 가까운 동료 관계 에너지와 연결되는 궁이에요.",
    detailedDescription: "형제궁(兄弟宮)은 형제자매뿐 아니라 가까운 동료나 비슷한 위치의 인간관계 흐름을 담당해요. 이 궁이 활성화될 때는 주변 가까운 사람들과의 관계에서 변화나 긴장이 생기기 쉬운 흐름이에요.",
    commonPatterns: ["형제·동료 관계의 변화 흐름", "가까운 인간관계에서 마찰이 생기기 쉬운 시기", "협력이나 경쟁 의식이 강해지는 상황"],
    relatedStates: [
      { key: "state.socialFatigue",      polarity: "positive" },
      { key: "state.emotionalAmplitude", polarity: "positive" },
    ],
    relatedFlows: ["flow.socialDrain", "flow.emotionalSwing"],
  },
  "ziwei.palace.spouse": {
    title:               "부처궁",
    shortDescription:    "파트너·배우자 관계 에너지가 집중되는 궁이에요.",
    detailedDescription: "부처궁(夫妻宮)은 연애·결혼·파트너십 관련 에너지와 연결되는 자리예요. 이 궁이 활성화될 때는 파트너 관계에서 변화나 감정 흐름이 두드러지는 시기예요. 꼭 연인 관계에만 국한되지 않고, 밀접한 1:1 관계 전반의 흐름으로 나타나기도 해요.",
    commonPatterns: ["파트너 관계에서 변화나 감정 흐름이 활발해지는 시기", "관계에서 감정 진폭이 커지는 흐름", "연애·결혼 관련 흐름 활성화"],
    relatedStates: [
      { key: "state.emotionalAmplitude", polarity: "positive" },
      { key: "state.socialFatigue",      polarity: "positive" },
      { key: "state.stability",          polarity: "negative" },
    ],
    relatedFlows: ["flow.emotionalSwing", "flow.socialDrain"],
  },
  "ziwei.palace.children": {
    title:               "자녀궁",
    shortDescription:    "자녀·창의 에너지, 미래 지향적 흐름과 연결되는 궁이에요.",
    detailedDescription: "자녀궁(子女宮)은 자녀뿐 아니라 창작·표현·다음 세대로 이어지는 에너지를 담당해요. 이 궁이 활성화될 때는 창의적 표현이나 새로운 무언가를 만들어내려는 흐름이 강해지기도 해요.",
    commonPatterns: ["창의·표현 에너지가 활발해지는 시기", "자녀 관련 흐름 활성", "새로운 것을 만들거나 시작하려는 욕구가 강해지는 편"],
    relatedStates: [
      { key: "state.emotionalAmplitude", polarity: "positive" },
      { key: "state.energySustain",      polarity: "positive" },
      { key: "state.executionFlow",      polarity: "positive" },
    ],
    relatedFlows: ["flow.emotionalSwing", "flow.highExecution"],
  },
  "ziwei.palace.wealth": {
    title:               "재백궁",
    shortDescription:    "재물·수입·경제적 흐름과 연결되는 궁이에요.",
    detailedDescription: "재백궁(財帛宮)은 금전·수입·재산 관련 에너지가 집중되는 자리예요. 이 궁이 활성화될 때는 경제적 흐름에서 변화나 집중이 생기기 쉬운 시기예요. 꼭 금전적 이익만을 의미하지 않고, 자원 관리나 물질적 상황 전반의 흐름을 나타내기도 해요.",
    commonPatterns: ["재물·수입 관련 흐름 활성", "경제적 결정이나 계획이 필요한 시기", "자원 관리·지출 흐름의 변화"],
    relatedStates: [
      { key: "state.executionFlow", polarity: "positive" },
      { key: "state.organization",  polarity: "positive" },
      { key: "state.stability",     polarity: "positive" },
    ],
    relatedFlows: ["flow.highExecution", "flow.stableFlow"],
  },
  "ziwei.palace.health": {
    title:               "질액궁",
    shortDescription:    "건강·신체 에너지, 체력 흐름과 연결되는 궁이에요.",
    detailedDescription: "질액궁(疾厄宮)은 건강·신체·에너지 흐름을 담당하는 자리예요. 이 궁이 활성화될 때는 신체 에너지 흐름에서 변화가 생기기 쉬운 시기예요. 꼭 질병을 의미하는 건 아니고, 체력 소모나 회복 흐름의 변화로 나타나기도 해요.",
    commonPatterns: ["체력·건강 흐름에 변화가 생기는 시기", "에너지 소모나 회복 흐름이 두드러지는 편", "신체 리듬 조정이 필요한 흐름"],
    relatedStates: [
      { key: "state.energySustain", polarity: "negative" },
      { key: "state.recovery",      polarity: "negative" },
      { key: "state.tension",       polarity: "positive" },
    ],
    relatedFlows: ["flow.recoveryDay", "flow.lowEnergy"],
  },
  "ziwei.palace.travel": {
    title:               "천이궁",
    shortDescription:    "이동·변화·외부 환경과의 관계를 담는 궁이에요.",
    detailedDescription: "천이궁(遷移宮)은 이동·여행·환경 변화, 외부 세계와의 접촉 흐름을 담당해요. 이 궁이 활성화될 때는 생활 환경의 변화나 이동 흐름이 강해지는 시기예요. 실제 물리적 이동뿐 아니라, 사회적 활동 범위가 넓어지거나 외부 자극이 늘어나는 흐름으로도 나타나기도 해요.",
    commonPatterns: ["이동·출장·여행 흐름 활성", "환경 변화나 새로운 장소와의 접촉", "활동 반경이 넓어지는 시기"],
    relatedStates: [
      { key: "state.executionFlow", polarity: "positive" },
      { key: "state.impulsiveness", polarity: "positive" },
      { key: "state.stability",     polarity: "negative" },
    ],
    relatedFlows: ["flow.highExecution", "flow.tensionSpike"],
  },
  "ziwei.palace.friends": {
    title:               "교우궁",
    shortDescription:    "친구·사회적 인맥 흐름과 연결되는 궁이에요.",
    detailedDescription: "교우궁(交友宮)은 친구·사회적 관계·부하 직원 관련 에너지를 담당해요. 이 궁이 활성화될 때는 사회적 인간관계에서 변화나 소모가 생기기 쉬운 흐름이에요. 새로운 인연이 생기거나, 기존 인간관계에서 에너지 흐름이 달라지는 시기와 겹치기도 해요.",
    commonPatterns: ["사회적 인간관계의 변화 흐름", "새로운 인연이나 모임 활성화", "관계 에너지 소모가 커지는 시기"],
    relatedStates: [
      { key: "state.socialFatigue",      polarity: "positive" },
      { key: "state.emotionalAmplitude", polarity: "positive" },
    ],
    relatedFlows: ["flow.socialDrain", "flow.emotionalSwing"],
  },
  "ziwei.palace.property": {
    title:               "전택궁",
    shortDescription:    "부동산·주거·가정 환경 흐름과 연결되는 궁이에요.",
    detailedDescription: "전택궁(田宅宮)은 부동산·주거 환경·가정 내 공간과 관련된 에너지를 담당해요. 이 궁이 활성화될 때는 주거나 재산 관련 흐름에서 변화가 생기기 쉬운 시기예요.",
    commonPatterns: ["주거·부동산 관련 흐름 활성", "가정 환경 변화나 정리 흐름", "공간·환경과 관련된 결정이 필요한 상황"],
    relatedStates: [
      { key: "state.stability",    polarity: "positive" },
      { key: "state.organization", polarity: "positive" },
    ],
    relatedFlows: ["flow.stableFlow"],
  },
  "ziwei.palace.spirit": {
    title:               "복덕궁",
    shortDescription:    "내면의 여유·행복감·정신 에너지와 연결되는 궁이에요.",
    detailedDescription: "복덕궁(福德宮)은 내면의 행복감·정신적 여유·삶의 질과 관련된 에너지를 담당해요. 이 궁이 활성화될 때는 정신적 안정이나 감정적 만족감이 올라오는 흐름이 생기기도 해요. 꼭 물질적 풍요가 아닌, 내면에서 느끼는 여유와 평온함의 흐름을 나타내는 편이에요.",
    commonPatterns: ["내면 여유와 안정감이 올라오는 시기", "감정적 만족이나 행복감이 강해지는 흐름", "정신적 에너지가 회복되는 편"],
    relatedStates: [
      { key: "state.recovery",           polarity: "positive" },
      { key: "state.stability",          polarity: "positive" },
      { key: "state.emotionalAmplitude", polarity: "positive" },
    ],
    relatedFlows: ["flow.recoveryDay", "flow.stableFlow"],
  },
  "ziwei.palace.parents": {
    title:               "부모궁",
    shortDescription:    "부모·윗어른·권위 관계 에너지와 연결되는 궁이에요.",
    detailedDescription: "부모궁(父母宮)은 부모·상사·권위자 등 나보다 윗 위치에 있는 사람과의 관계 흐름을 담당해요. 이 궁이 활성화될 때는 권위 관계에서 변화나 긴장이 생기기 쉬운 흐름이에요. 꼭 실제 부모 관계에만 국한되지 않고, 지도·의존·보호 관계 전반에 나타나기도 해요.",
    commonPatterns: ["부모·상사와의 관계 변화 흐름", "권위 관계에서 긴장이나 감정이 올라오는 시기", "도움이나 의존 흐름이 강해지거나 흔들리는 편"],
    relatedStates: [
      { key: "state.socialFatigue",      polarity: "positive" },
      { key: "state.tension",            polarity: "positive" },
      { key: "state.emotionalAmplitude", polarity: "positive" },
    ],
    relatedFlows: ["flow.socialDrain", "flow.emotionalSwing"],
  },

  // ── saju · branch (remaining) ────────────────────────────────────────────────
  "saju.branch.directionalHarmony": {
    title:               "방합",
    shortDescription:    "같은 방향의 세 지지가 모여 큰 흐름을 만드는 구조예요.",
    detailedDescription: "방합(方合)은 동서남북 방위를 공유하는 세 지지가 함께 나타나는 구조예요. 삼합처럼 강한 결집은 아니지만, 같은 방향의 에너지가 서서히 모이는 지속적인 흐름이에요. 인묘진(동방), 사오미(남방), 신유술(서방), 해자축(북방) 중 하나에 해당해요.",
    commonPatterns: ["에너지가 서서히 한 방향으로 집중되는 시기", "지속적이고 안정적인 추진 흐름", "큰 변화보다 꾸준한 진행이 강조되는 편"],
    relatedStates: [
      { key: "state.stability",     polarity: "positive" },
      { key: "state.energySustain", polarity: "positive" },
      { key: "state.executionFlow", polarity: "positive" },
    ],
    relatedFlows: ["flow.stableFlow", "flow.highExecution"],
  },
  "saju.branch.halfTrine": {
    title:               "반합",
    shortDescription:    "삼합의 절반만 형성된 부분적인 합 구조예요.",
    detailedDescription: "반합(半合)은 삼합을 이루는 세 지지 중 두 개만 만나 부분적인 합 흐름이 생기는 구조예요. 완전한 삼합보다는 에너지 결집이 약하지만, 안정적인 흐름이 부분적으로 활성화되는 편이에요.",
    commonPatterns: ["부분적인 안정 흐름이 형성되는 시기", "에너지가 어느 정도 모이는 흐름", "완전한 결집보다는 일부 조건이 맞는 상황"],
    relatedStates: [
      { key: "state.stability",     polarity: "positive" },
      { key: "state.executionFlow", polarity: "positive" },
    ],
    relatedFlows: ["flow.stableFlow"],
  },
  "saju.branch.triplePenalty": {
    title:               "삼형",
    shortDescription:    "세 지지가 서로 형 관계를 이루는 복합 긴장 구조예요.",
    detailedDescription: "삼형(三刑)은 세 지지가 서로 형(刑) 관계로 맞물리는 구조로, 단일 형보다 긴장의 강도가 높아요. 인사신(寅巳申) 또는 축술미(丑戌未)가 대표적인 조합이에요. 안정감이 크게 흔들리고 관계나 상황에서 마찰이 누적되기 쉬운 흐름이에요.",
    commonPatterns: ["긴장이 복합적으로 누적되는 시기", "관계·상황에서 복잡한 마찰이 생기기 쉬운 흐름", "안정감이 크게 흔들리는 편"],
    relatedStates: [
      { key: "state.tension",       polarity: "positive" },
      { key: "state.stability",     polarity: "negative" },
      { key: "state.socialFatigue", polarity: "positive" },
    ],
    relatedFlows: ["flow.tensionSpike", "flow.blocked"],
  },
  "saju.branch.harm": {
    title:               "해살",
    shortDescription:    "서로를 서서히 약화시키는 지지 관계예요.",
    detailedDescription: "해(害)는 충처럼 직접적인 충돌이 아니라, 두 지지가 서로의 에너지를 서서히 약화시키는 구조예요. 에너지가 소모되거나 지속성이 약해지는 흐름과 함께 나타나는 편이에요. 관계에서 명확하게 드러나지 않는 방해 요소가 생기는 느낌의 흐름이에요.",
    commonPatterns: ["에너지 지속성이 약해지거나 소모가 생기는 시기", "관계에서 보이지 않는 방해 흐름", "진행 중인 일이 잘 안 풀리는 느낌"],
    relatedStates: [
      { key: "state.tension",       polarity: "positive" },
      { key: "state.socialFatigue", polarity: "positive" },
      { key: "state.energySustain", polarity: "negative" },
    ],
    relatedFlows: ["flow.blocked", "flow.socialDrain"],
  },
  "saju.branch.selfPenalty": {
    title:               "복음",
    shortDescription:    "같은 지지가 반복되어 내부 에너지가 정체되는 구조예요.",
    detailedDescription: "복음(伏吟)은 동일한 지지가 사주와 운세 기둥에 중복되는 구조예요. 같은 에너지가 반복되면서 흐름이 정체되거나, 비슷한 상황이 반복되는 패턴이 생기기도 해요. 긴장이 내부에 쌓이는 방식이라, 외부보다는 내면에서 소모가 생기는 흐름이에요.",
    commonPatterns: ["비슷한 상황이나 감정이 반복되는 흐름", "내부 에너지가 정체되거나 소모되는 시기", "변화를 만들기 어려운 흐름"],
    relatedStates: [
      { key: "state.tension",            polarity: "positive" },
      { key: "state.impulsiveness",      polarity: "positive" },
      { key: "state.emotionalAmplitude", polarity: "positive" },
    ],
    relatedFlows: ["flow.tensionSpike", "flow.emotionalSwing"],
  },

  // ── saju · star (remaining) ──────────────────────────────────────────────────
  "saju.star.hwaGae": {
    title:               "화개살",
    shortDescription:    "예술·영성·내면 집중 흐름과 연결되는 요소예요.",
    detailedDescription: "화개살(華蓋殺)은 예술적 감수성이나 영적 집중 에너지와 함께 나타나는 요소예요. 혼자 집중하거나 내면으로 향하는 흐름이 활성화되는 시기와 겹치기도 해요. 꼭 고독이나 우울을 의미하는 건 아니고, 깊이 있는 창작이나 사색이 잘 되는 흐름으로 나타나기도 해요.",
    commonPatterns: ["혼자 집중하거나 내면으로 향하는 흐름", "예술·창작·사색 에너지 활성", "사회적 활동보다 독립적인 활동이 잘 되는 시기"],
    relatedStates: [
      { key: "state.focus",              polarity: "positive" },
      { key: "state.emotionalAmplitude", polarity: "positive" },
      { key: "state.socialFatigue",      polarity: "positive" },
    ],
    relatedFlows: ["flow.focusBoost", "flow.socialDrain"],
  },
  "saju.star.wolDeok": {
    title:               "월덕귀인",
    shortDescription:    "안정과 보호 흐름을 지원하는 길신 에너지예요.",
    detailedDescription: "월덕귀인(月德貴人)은 천덕귀인과 유사한 길신으로, 어려운 상황에서 흐름이 부드럽게 풀리거나 지지가 연결되는 에너지예요. 안정감이 올라오고 회복력이 강해지는 시기와 겹치기도 해요. 월(月) 기반의 덕 에너지라, 일상적인 흐름 속에서 자연스럽게 작용하는 편이에요.",
    commonPatterns: ["어려운 상황이 부드럽게 해소되는 흐름", "일상에서 작은 도움이나 지지가 연결되는 시기", "안정감과 회복력이 올라오는 편"],
    relatedStates: [
      { key: "state.stability", polarity: "positive" },
      { key: "state.recovery",  polarity: "positive" },
    ],
    relatedFlows: ["flow.stableFlow", "flow.recoveryDay"],
  },

  // ── saju · twelve state (십이운성) ────────────────────────────────────────────
  "saju.twelveState.jangSaeng": {
    title:               "장생",
    shortDescription:    "새로운 시작과 성장 에너지가 펼쳐지는 흐름이에요.",
    detailedDescription: "장생(長生)은 십이운성 중 생명이 처음 태어나는 단계로, 새로운 일을 시작하거나 성장 에너지가 올라오는 시기와 겹쳐요. 희망적이고 활력 있는 흐름이 느껴지는 편이에요.",
    commonPatterns: ["새로운 시작이 순조롭게 진행되는 흐름", "성장과 발전 에너지가 느껴지는 시기", "희망적이고 긍정적인 기운"],
    relatedStates: [
      { key: "state.optimism", polarity: "positive" },
      { key: "state.initiative", polarity: "positive" },
    ],
    relatedFlows: ["flow.newBeginning"],
  },
  "saju.twelveState.jeWang": {
    title:               "제왕",
    shortDescription:    "에너지가 절정에 이르는 강력한 흐름이에요.",
    detailedDescription: "제왕(帝旺)은 십이운성 중 에너지가 가장 강력한 절정 단계예요. 추진력이 최고조에 달하고 성취감이 느껴지는 시기와 겹쳐요. 다만 과도한 에너지로 피로감이 동반될 수도 있어요.",
    commonPatterns: ["추진력과 성취 에너지가 최고조인 시기", "자신감과 리더십이 두드러지는 흐름", "에너지 소모가 클 수 있음"],
    relatedStates: [
      { key: "state.executionFlow", polarity: "positive" },
      { key: "state.initiative", polarity: "positive" },
    ],
    relatedFlows: ["flow.highExecution"],
  },
  "saju.twelveState.tae": {
    title:               "태",
    shortDescription:    "내면 형성과 준비 에너지가 쌓이는 흐름이에요.",
    detailedDescription: "태(胎)는 십이운성 중 생명이 잉태되는 단계로, 표면적으로는 조용하지만 내면에서 준비와 구상이 이루어지는 시기예요. 성찰과 계획에 유리한 편이에요.",
    commonPatterns: ["표면적으로는 조용하지만 내면 준비가 진행되는 시기", "성찰과 구상에 집중하기 좋은 흐름", "새로운 가능성을 탐색하는 편"],
    relatedStates: [
      { key: "state.reflection", polarity: "positive" },
      { key: "state.insight", polarity: "positive" },
    ],
    relatedFlows: ["flow.introspection"],
  },
  "saju.twelveState.mokYok": {
    title:               "목욕",
    shortDescription:    "감정이 들뜨고 새로움에 끌리는 흐름이에요.",
    detailedDescription: "목욕(沐浴)은 십이운성 중 갓 태어난 생명이 씻기며 다듬어지는 단계로, 감정이 들뜨거나 새로운 것에 마음이 끌리는 시기와 겹쳐요. 매력과 표현력이 살아나지만, 마음이 자주 바뀌는 변덕스러움이 동반될 수도 있어요.",
    commonPatterns: ["새로움에 끌리고 호기심이 커지는 시기", "매력과 표현력이 살아나는 흐름", "감정 기복이나 변덕이 생길 수 있음"],
    relatedStates: [
      { key: "state.emotionalAmplitude", polarity: "positive" },
      { key: "state.impulsiveness",      polarity: "positive" },
    ],
    relatedFlows: ["flow.emotionalSwing"],
  },
  "saju.twelveState.gwanDae": {
    title:               "관대",
    shortDescription:    "역할을 갖추고 인정받기 시작하는 흐름이에요.",
    detailedDescription: "관대(冠帶)는 십이운성 중 성인의 옷을 갖춰 입는 단계로, 책임과 역할이 분명해지고 의욕이 올라오는 시기와 겹쳐요. 추진력이 좋아지는 반면 격식과 절차에 다소 얽매일 수 있어요.",
    commonPatterns: ["역할과 책임이 분명해지는 시기", "의욕과 자신감이 올라오는 흐름", "격식·절차가 중요해지는 편"],
    relatedStates: [
      { key: "state.executionFlow", polarity: "positive" },
      { key: "state.organization",  polarity: "positive" },
    ],
    relatedFlows: ["flow.highExecution"],
  },
  "saju.twelveState.geonRok": {
    title:               "건록",
    shortDescription:    "안정된 실행력으로 본격적으로 움직이는 흐름이에요.",
    detailedDescription: "건록(建祿)은 십이운성 중 자리를 잡고 녹(祿)을 받는 단계로, 실행력이 안정되고 노력의 결과가 차곡차곡 쌓이는 시기와 겹쳐요. 무리한 확장보다 꾸준한 진행에 유리한 편이에요.",
    commonPatterns: ["하던 일이 안정적으로 진행되는 시기", "노력의 결과가 쌓이는 흐름", "꾸준함이 힘을 발휘하는 편"],
    relatedStates: [
      { key: "state.executionFlow", polarity: "positive" },
      { key: "state.stability",     polarity: "positive" },
    ],
    relatedFlows: ["flow.highExecution", "flow.stableFlow"],
  },
  "saju.twelveState.yang": {
    title:               "양",
    shortDescription:    "차분히 길러지고 회복되는 흐름이에요.",
    detailedDescription: "양(養)은 십이운성 중 생명이 보살핌 속에 자라나는 단계로, 무리하지 않고 회복하며 다음을 준비하는 시기와 겹쳐요. 완만하고 안정적인 기운이라 재충전에 유리한 편이에요.",
    commonPatterns: ["회복과 재충전에 좋은 시기", "완만하고 안정적인 흐름", "다음 단계를 준비하는 편"],
    relatedStates: [
      { key: "state.recovery",  polarity: "positive" },
      { key: "state.stability", polarity: "positive" },
    ],
    relatedFlows: ["flow.recoveryDay", "flow.stableFlow"],
  },

  // ── astro · aspect — sun ─────────────────────────────────────────────────────
  "astro.aspect.sun.conjunction": {
    title:               "태양 합",
    shortDescription:    "태양 에너지가 다른 천체와 강하게 합쳐지는 행성 흐름이에요.",
    detailedDescription: "합(conjunction)은 두 천체가 같은 위치에서 에너지를 합치는 구조예요. 태양의 정체성·활력·의지 에너지가 해당 천체의 성질과 합쳐지면서 증폭되는 흐름이에요. 어떤 천체와 합이 이루어지느냐에 따라 방향이 달라지지만, 전반적으로 자기표현이나 추진력이 강해지는 편이에요.",
    commonPatterns: ["자기 정체성이나 의지가 강하게 활성화되는 시기", "추진력이나 활력이 한 방향으로 모이는 흐름", "자기표현 욕구가 두드러지는 편"],
    relatedStates: [
      { key: "state.executionFlow", polarity: "positive" },
      { key: "state.energySustain", polarity: "positive" },
    ],
    relatedFlows: ["flow.highExecution"],
  },
  "astro.aspect.sun.sextile": {
    title:               "태양 육분각",
    shortDescription:    "태양 에너지가 부드럽게 지원받는 행성 흐름이에요.",
    detailedDescription: "육분각(sextile)은 60도 간격의 조화로운 각도로, 에너지 흐름이 원활하게 연결되는 구조예요. 태양의 활력·자신감·정체성 에너지가 자연스럽게 지원받는 시기와 함께 나타나는 편이에요.",
    commonPatterns: ["자신감과 활력이 부드럽게 올라오는 시기", "진행 중인 일에서 작은 기회가 생기는 흐름", "에너지가 안정적으로 유지되는 편"],
    relatedStates: [
      { key: "state.stability",     polarity: "positive" },
      { key: "state.energySustain", polarity: "positive" },
    ],
    relatedFlows: ["flow.stableFlow"],
  },
  "astro.aspect.sun.square": {
    title:               "태양 충돌각",
    shortDescription:    "태양 에너지가 긴장 구조로 활성화되는 행성 흐름이에요.",
    detailedDescription: "충돌각(square)은 90도 긴장 각도로, 에너지가 서로 마찰하면서 강하게 활성화되는 구조예요. 태양의 정체성·의지 에너지가 긴장 상태로 자극받는 시기예요. 어려움이나 도전이 생기지만, 강한 실행 동력으로 전환되기도 해요.",
    commonPatterns: ["자기 의지나 정체성이 도전받는 느낌의 흐름", "마찰이나 충돌이 실행 동력으로 전환되기도 하는 시기", "긴장감이 높아지는 편"],
    relatedStates: [
      { key: "state.tension",       polarity: "positive" },
      { key: "state.executionFlow", polarity: "positive" },
    ],
    relatedFlows: ["flow.tensionSpike", "flow.highExecution"],
  },
  "astro.aspect.sun.opposition": {
    title:               "태양 대립각",
    shortDescription:    "태양 에너지가 반대 에너지와 마주하는 긴장 구조예요.",
    detailedDescription: "대립각(opposition)은 180도 정반대 각도로, 두 에너지가 서로 마주하면서 긴장이 생기는 구조예요. 태양의 정체성·의지 에너지와 반대 천체 에너지 사이에서 균형을 찾아야 하는 흐름이에요. 자신과 외부 세계 사이에서 인식이 선명해지는 시기이기도 해요.",
    commonPatterns: ["자신과 외부 간의 인식 차이가 두드러지는 흐름", "관계 속에서 자기 의지를 표현하려는 욕구가 올라오는 시기", "균형이 필요한 긴장 상황"],
    relatedStates: [
      { key: "state.tension",       polarity: "positive" },
      { key: "state.socialFatigue", polarity: "positive" },
      { key: "state.stability",     polarity: "negative" },
    ],
    relatedFlows: ["flow.tensionSpike", "flow.socialDrain"],
  },
  "astro.aspect.sun.quincunx": {
    title:               "태양 불일치각",
    shortDescription:    "태양 에너지와 다른 천체 사이에 어색한 조정이 필요한 구조예요.",
    detailedDescription: "불일치각(quincunx, 150도)은 두 에너지가 서로 맞지 않아 지속적인 조정이 필요한 구조예요. 태양의 정체성·활력 에너지가 어색하게 맞물리는 흐름이에요. 큰 충돌은 아니지만, 방향을 계속 수정해야 하는 불편함이 생기는 편이에요.",
    commonPatterns: ["방향 조정이 반복적으로 필요한 흐름", "에너지가 분산되거나 집중이 어색한 시기", "명확하지 않은 불편함이 생기는 편"],
    relatedStates: [
      { key: "state.tension",      polarity: "positive" },
      { key: "state.organization", polarity: "positive" },
    ],
    relatedFlows: ["flow.tensionSpike"],
  },
  "astro.aspect.sun.semisextile": {
    title:               "태양 반육분각",
    shortDescription:    "태양 에너지에 미세한 영향이 작용하는 행성 흐름이에요.",
    detailedDescription: "반육분각(semisextile, 30도)은 두 천체 사이의 작은 각도로, 에너지의 영향이 미세하게 작용하는 구조예요. 태양의 정체성·활력 에너지에 작은 자극이 생기는 흐름이에요. 단독으로 강한 영향을 주지는 않지만, 다른 행성 흐름과 함께 나타날 때 보조적으로 작용하는 편이에요.",
    commonPatterns: ["작고 미세한 자극이나 기회가 생기는 흐름", "에너지 변화가 크지 않고 점진적인 편", "다른 흐름과 함께 나타나는 보조적 요소"],
    relatedStates: [
      { key: "state.focus",     polarity: "positive" },
      { key: "state.stability", polarity: "positive" },
    ],
    relatedFlows: ["flow.neutral"],
  },

  // ── astro · aspect — moon ─────────────────────────────────────────────────────
  "astro.aspect.moon.conjunction": {
    title:               "달 합",
    shortDescription:    "감정·본능 에너지가 다른 천체와 강하게 합쳐지는 구조예요.",
    detailedDescription: "달의 감정·직관·본능 에너지가 다른 천체와 하나로 합쳐지면서 증폭되는 흐름이에요. 감정적 반응이 강해지고, 내면의 직관이 예민해지는 시기와 함께 나타나는 편이에요.",
    commonPatterns: ["감정 반응이 강하게 활성화되는 시기", "직관이 예민해지는 흐름", "내면 에너지가 크게 올라오는 편"],
    relatedStates: [
      { key: "state.emotionalAmplitude", polarity: "positive" },
      { key: "state.recovery",           polarity: "positive" },
    ],
    relatedFlows: ["flow.emotionalSwing", "flow.recoveryDay"],
  },
  "astro.aspect.moon.sextile": {
    title:               "달 육분각",
    shortDescription:    "감정·본능 에너지가 부드럽게 지원받는 행성 흐름이에요.",
    detailedDescription: "달의 감정·직관 에너지가 60도 조화각을 통해 부드럽게 흐르는 시기예요. 감정 기복이 줄어들고 내면이 안정되는 흐름이에요.",
    commonPatterns: ["감정이 안정되고 편안해지는 흐름", "내면 안정이 올라오는 시기", "관계에서 자연스러운 교류가 잘 되는 편"],
    relatedStates: [
      { key: "state.recovery",  polarity: "positive" },
      { key: "state.stability", polarity: "positive" },
    ],
    relatedFlows: ["flow.recoveryDay", "flow.stableFlow"],
  },
  "astro.aspect.moon.trine": {
    title:               "달 조화각",
    shortDescription:    "감정·본능 에너지가 자연스럽게 흐르는 조화로운 구조예요.",
    detailedDescription: "달의 감정·직관 에너지가 120도 조화각을 통해 원활하게 흐르는 흐름이에요. 감정 기복이 줄고 내면 안정이 올라오는 시기예요. 본능적 판단이 자연스럽게 잘 작동하는 편이에요.",
    commonPatterns: ["감정이 안정적으로 흐르는 시기", "직관적 판단이 잘 작동하는 흐름", "내면 회복이 자연스럽게 이루어지는 편"],
    relatedStates: [
      { key: "state.recovery",           polarity: "positive" },
      { key: "state.stability",          polarity: "positive" },
      { key: "state.emotionalAmplitude", polarity: "negative" },
    ],
    relatedFlows: ["flow.recoveryDay", "flow.stableFlow"],
  },
  "astro.aspect.moon.opposition": {
    title:               "달 대립각",
    shortDescription:    "감정·본능 에너지가 반대 에너지와 마주하는 긴장 구조예요.",
    detailedDescription: "달의 감정·직관 에너지가 180도 대립각을 통해 반대 천체와 긴장 상태로 마주하는 흐름이에요. 내면과 외부 상황 사이에서 불일치감이 생기기도 하고, 감정 반응이 예상보다 크게 올라오는 시기예요.",
    commonPatterns: ["내면과 외부 상황이 어긋나는 느낌", "감정 반응이 크게 올라오는 시기", "관계에서 감정 소모가 생기기 쉬운 흐름"],
    relatedStates: [
      { key: "state.emotionalAmplitude", polarity: "positive" },
      { key: "state.socialFatigue",      polarity: "positive" },
    ],
    relatedFlows: ["flow.emotionalSwing", "flow.socialDrain"],
  },
  "astro.aspect.moon.quincunx": {
    title:               "달 불일치각",
    shortDescription:    "감정 흐름에 어색한 조정이 필요한 구조예요.",
    detailedDescription: "달의 감정·직관 에너지가 150도 불일치각을 통해 어색하게 맞물리는 흐름이에요. 감정이 명확하게 표현되지 않고, 내면에서 지속적으로 조정이 필요한 불편함이 생기는 편이에요.",
    commonPatterns: ["감정 처리가 어색하거나 조정이 반복적으로 필요한 흐름", "내면의 불편함이 명확하지 않은 시기", "감정 기복이 불규칙하게 나타나는 편"],
    relatedStates: [
      { key: "state.emotionalAmplitude", polarity: "positive" },
      { key: "state.tension",            polarity: "positive" },
    ],
    relatedFlows: ["flow.emotionalSwing"],
  },
  "astro.aspect.moon.semisextile": {
    title:               "달 반육분각",
    shortDescription:    "감정 에너지에 미세한 영향이 작용하는 행성 흐름이에요.",
    detailedDescription: "달의 감정·직관 에너지에 30도의 작은 각도로 영향이 작용하는 구조예요. 에너지 변화는 크지 않지만, 내면의 감각이 미세하게 자극받는 흐름이에요.",
    commonPatterns: ["감정에 미세한 자극이 작용하는 시기", "직관이 살짝 예민해지는 흐름", "큰 변화는 없지만 내면에 약한 영향이 생기는 편"],
    relatedStates: [
      { key: "state.emotionalAmplitude", polarity: "positive" },
      { key: "state.focus",              polarity: "positive" },
    ],
    relatedFlows: ["flow.neutral"],
  },

  // ── astro · aspect — mercury ──────────────────────────────────────────────────
  "astro.aspect.mercury.conjunction": {
    title:               "수성 합",
    shortDescription:    "사고·소통 에너지가 다른 천체와 강하게 합쳐지는 구조예요.",
    detailedDescription: "수성의 사고·소통·정보 처리 에너지가 다른 천체와 합쳐지면서 증폭되는 흐름이에요. 사고력이나 정보 처리 속도가 강해지는 시기와 함께 나타나는 편이에요.",
    commonPatterns: ["사고력이나 아이디어가 활발해지는 시기", "소통·정보 처리 에너지가 집중되는 흐름", "분석이나 계획이 잘 되는 편"],
    relatedStates: [
      { key: "state.focus",         polarity: "positive" },
      { key: "state.executionFlow", polarity: "positive" },
    ],
    relatedFlows: ["flow.focusBoost", "flow.highExecution"],
  },
  "astro.aspect.mercury.sextile": {
    title:               "수성 육분각",
    shortDescription:    "사고·소통 에너지가 부드럽게 지원받는 행성 흐름이에요.",
    detailedDescription: "수성의 사고·소통 에너지가 60도 조화각을 통해 부드럽게 흐르는 시기예요. 정보 교환이나 의사소통이 자연스럽게 잘 되는 흐름이에요.",
    commonPatterns: ["소통이 원활하게 이루어지는 시기", "학습이나 정보 처리가 부드럽게 흐르는 흐름", "집중력이 안정적으로 유지되는 편"],
    relatedStates: [
      { key: "state.focus",        polarity: "positive" },
      { key: "state.organization", polarity: "positive" },
    ],
    relatedFlows: ["flow.focusBoost"],
  },
  "astro.aspect.mercury.square": {
    title:               "수성 충돌각",
    shortDescription:    "사고·소통 에너지가 긴장 구조로 활성화되는 흐름이에요.",
    detailedDescription: "수성의 사고·소통 에너지가 90도 긴장각을 통해 마찰 상태로 활성화되는 시기예요. 의사소통에서 오해나 마찰이 생기거나, 정보 처리가 복잡해지는 흐름과 함께 나타나는 편이에요.",
    commonPatterns: ["의사소통에서 마찰이나 오해가 생기기 쉬운 시기", "정보 처리가 복잡해지는 흐름", "사고가 산만해지거나 집중이 어려워지는 편"],
    relatedStates: [
      { key: "state.tension",       polarity: "positive" },
      { key: "state.socialFatigue", polarity: "positive" },
    ],
    relatedFlows: ["flow.tensionSpike", "flow.socialDrain"],
  },
  "astro.aspect.mercury.trine": {
    title:               "수성 조화각",
    shortDescription:    "사고·소통 에너지가 자연스럽게 흐르는 조화로운 구조예요.",
    detailedDescription: "수성의 사고·소통 에너지가 120도 조화각을 통해 원활하게 흐르는 흐름이에요. 생각이 명확하게 정리되고, 소통이 자연스럽게 잘 이루어지는 시기예요.",
    commonPatterns: ["생각이 명확하게 정리되는 시기", "소통과 정보 교환이 원활한 흐름", "학습·계획·분석이 잘 되는 편"],
    relatedStates: [
      { key: "state.focus",        polarity: "positive" },
      { key: "state.organization", polarity: "positive" },
      { key: "state.stability",    polarity: "positive" },
    ],
    relatedFlows: ["flow.focusBoost", "flow.stableFlow"],
  },
  "astro.aspect.mercury.opposition": {
    title:               "수성 대립각",
    shortDescription:    "사고·소통 에너지가 반대 에너지와 마주하는 긴장 구조예요.",
    detailedDescription: "수성의 사고·소통 에너지가 180도 대립각을 통해 반대 천체와 마주하는 흐름이에요. 서로 다른 의견이나 정보가 충돌하는 상황이 생기기도 하고, 소통에서 긴장이 올라오는 시기예요.",
    commonPatterns: ["서로 다른 의견이나 생각이 충돌하는 흐름", "소통에서 긴장이나 마찰이 생기는 시기", "관계에서 의견 차이가 부각되는 편"],
    relatedStates: [
      { key: "state.tension",       polarity: "positive" },
      { key: "state.socialFatigue", polarity: "positive" },
    ],
    relatedFlows: ["flow.tensionSpike", "flow.socialDrain"],
  },
  "astro.aspect.mercury.quincunx": {
    title:               "수성 불일치각",
    shortDescription:    "사고·소통에 어색한 조정이 필요한 구조예요.",
    detailedDescription: "수성의 사고·소통 에너지가 150도 불일치각을 통해 어색하게 맞물리는 흐름이에요. 생각의 방향이 반복적으로 조정되거나, 소통에서 미묘한 불일치가 생기는 시기예요.",
    commonPatterns: ["생각이나 소통 방향이 반복적으로 수정되는 흐름", "명확하지 않은 불일치감이 생기는 시기", "정보 처리가 어색하게 연결되는 편"],
    relatedStates: [
      { key: "state.tension", polarity: "positive" },
      { key: "state.focus",   polarity: "positive" },
    ],
    relatedFlows: ["flow.tensionSpike"],
  },
  "astro.aspect.mercury.semisextile": {
    title:               "수성 반육분각",
    shortDescription:    "사고·소통 에너지에 미세한 영향이 작용하는 행성 흐름이에요.",
    detailedDescription: "수성의 사고·소통 에너지에 30도 각도로 작은 영향이 작용하는 구조예요. 단독으로는 강한 영향을 주지 않지만, 다른 행성 흐름과 함께 나타날 때 사고나 소통을 미세하게 자극하는 편이에요.",
    commonPatterns: ["사고·소통에 작은 자극이 생기는 흐름", "큰 변화는 없지만 집중이 살짝 높아지는 편", "보조적인 수준의 사고 활성"],
    relatedStates: [
      { key: "state.focus", polarity: "positive" },
    ],
    relatedFlows: ["flow.neutral"],
  },

  // ── astro · aspect — venus ────────────────────────────────────────────────────
  "astro.aspect.venus.conjunction": {
    title:               "금성 합",
    shortDescription:    "관계·가치 에너지가 다른 천체와 강하게 합쳐지는 구조예요.",
    detailedDescription: "금성의 관계·미·가치 에너지가 다른 천체와 합쳐지면서 증폭되는 흐름이에요. 감정이나 관계 에너지가 강하게 활성화되는 시기와 함께 나타나는 편이에요.",
    commonPatterns: ["관계·감정 에너지가 강하게 활성화되는 시기", "미적 감수성이나 가치 판단이 예민해지는 흐름", "대인관계 흐름이 두드러지는 편"],
    relatedStates: [
      { key: "state.emotionalAmplitude", polarity: "positive" },
      { key: "state.socialFatigue",      polarity: "positive" },
    ],
    relatedFlows: ["flow.emotionalSwing"],
  },
  "astro.aspect.venus.sextile": {
    title:               "금성 육분각",
    shortDescription:    "관계·가치 에너지가 부드럽게 지원받는 행성 흐름이에요.",
    detailedDescription: "금성의 관계·미·가치 에너지가 60도 조화각을 통해 부드럽게 흐르는 시기예요. 관계에서 긴장이 줄어들고 편안한 흐름이 생기는 편이에요.",
    commonPatterns: ["관계에서 편안함이나 안정감이 올라오는 시기", "감정 소모가 줄어드는 흐름", "가치 판단이 자연스럽게 이루어지는 편"],
    relatedStates: [
      { key: "state.stability", polarity: "positive" },
      { key: "state.recovery",  polarity: "positive" },
    ],
    relatedFlows: ["flow.stableFlow", "flow.recoveryDay"],
  },
  "astro.aspect.venus.square": {
    title:               "금성 충돌각",
    shortDescription:    "관계·가치 에너지가 긴장 구조로 활성화되는 흐름이에요.",
    detailedDescription: "금성의 관계·가치 에너지가 90도 긴장각을 통해 마찰 상태로 활성화되는 시기예요. 관계에서 가치관 차이나 감정적 긴장이 생기기 쉬운 흐름이에요.",
    commonPatterns: ["관계에서 가치관 차이나 마찰이 생기기 쉬운 시기", "감정 기복이 올라오는 흐름", "관계 에너지 소모가 생기는 편"],
    relatedStates: [
      { key: "state.tension",            polarity: "positive" },
      { key: "state.socialFatigue",      polarity: "positive" },
      { key: "state.emotionalAmplitude", polarity: "positive" },
    ],
    relatedFlows: ["flow.tensionSpike", "flow.socialDrain"],
  },
  "astro.aspect.venus.trine": {
    title:               "금성 조화각",
    shortDescription:    "관계·가치 에너지가 자연스럽게 흐르는 조화로운 구조예요.",
    detailedDescription: "금성의 관계·미·가치 에너지가 120도 조화각을 통해 원활하게 흐르는 흐름이에요. 관계에서 자연스러운 편안함이 생기고, 감정 기복이 줄어드는 시기예요.",
    commonPatterns: ["관계가 자연스럽게 안정되는 시기", "감정 소모가 적어지는 흐름", "편안한 인간관계 흐름이 이어지는 편"],
    relatedStates: [
      { key: "state.stability",     polarity: "positive" },
      { key: "state.recovery",      polarity: "positive" },
      { key: "state.socialFatigue", polarity: "negative" },
    ],
    relatedFlows: ["flow.stableFlow", "flow.recoveryDay"],
  },
  "astro.aspect.venus.opposition": {
    title:               "금성 대립각",
    shortDescription:    "관계·가치 에너지가 반대 에너지와 마주하는 긴장 구조예요.",
    detailedDescription: "금성의 관계·가치 에너지가 180도 대립각을 통해 반대 천체와 마주하는 흐름이에요. 관계에서 끌림과 긴장이 동시에 생기거나, 가치관 충돌이 표면으로 드러나는 시기예요.",
    commonPatterns: ["관계에서 끌림과 갈등이 동시에 올라오는 흐름", "가치관 차이가 부각되는 시기", "감정 진폭이 커지는 편"],
    relatedStates: [
      { key: "state.emotionalAmplitude", polarity: "positive" },
      { key: "state.socialFatigue",      polarity: "positive" },
    ],
    relatedFlows: ["flow.emotionalSwing", "flow.socialDrain"],
  },
  "astro.aspect.venus.quincunx": {
    title:               "금성 불일치각",
    shortDescription:    "관계·가치 흐름에 어색한 조정이 필요한 구조예요.",
    detailedDescription: "금성의 관계·가치 에너지가 150도 불일치각을 통해 어색하게 맞물리는 흐름이에요. 관계에서 명확하지 않은 불일치감이 생기거나, 감정 처리가 반복적으로 조정되는 시기예요.",
    commonPatterns: ["관계에서 미묘한 불일치감이 반복되는 흐름", "감정 처리가 어색한 시기", "관계 에너지 소모가 서서히 생기는 편"],
    relatedStates: [
      { key: "state.socialFatigue", polarity: "positive" },
      { key: "state.tension",       polarity: "positive" },
    ],
    relatedFlows: ["flow.socialDrain"],
  },
  "astro.aspect.venus.semisextile": {
    title:               "금성 반육분각",
    shortDescription:    "관계·가치 에너지에 미세한 영향이 작용하는 행성 흐름이에요.",
    detailedDescription: "금성의 관계·가치 에너지에 30도 각도로 작은 영향이 작용하는 구조예요. 관계나 감정에 큰 변화는 없지만, 미세한 자극이 작용하는 흐름이에요.",
    commonPatterns: ["관계·감정에 작은 자극이 생기는 흐름", "큰 변화는 없지만 안정감이 살짝 올라오는 편", "보조적인 수준의 관계 흐름"],
    relatedStates: [
      { key: "state.recovery",  polarity: "positive" },
      { key: "state.stability", polarity: "positive" },
    ],
    relatedFlows: ["flow.neutral"],
  },

  // ── astro · aspect — mars ─────────────────────────────────────────────────────
  "astro.aspect.mars.conjunction": {
    title:               "화성 합",
    shortDescription:    "행동·추진 에너지가 다른 천체와 강하게 합쳐지는 구조예요.",
    detailedDescription: "화성의 행동·추진·경쟁 에너지가 다른 천체와 합쳐지면서 증폭되는 흐름이에요. 실행력과 충동적 에너지가 동시에 강해지는 시기예요.",
    commonPatterns: ["실행력이나 추진 에너지가 강하게 활성화되는 시기", "충동적 행동 욕구가 올라오는 흐름", "에너지 지속성이 강해지는 편"],
    relatedStates: [
      { key: "state.executionFlow", polarity: "positive" },
      { key: "state.impulsiveness", polarity: "positive" },
      { key: "state.energySustain", polarity: "positive" },
    ],
    relatedFlows: ["flow.highExecution", "flow.impulsive"],
  },
  "astro.aspect.mars.sextile": {
    title:               "화성 육분각",
    shortDescription:    "행동·추진 에너지가 부드럽게 지원받는 행성 흐름이에요.",
    detailedDescription: "화성의 행동·추진 에너지가 60도 조화각을 통해 부드럽게 흐르는 시기예요. 실행력이 자연스럽게 올라오고, 에너지 소모가 효율적으로 이루어지는 흐름이에요.",
    commonPatterns: ["실행력이 자연스럽게 올라오는 시기", "에너지가 효율적으로 흐르는 편", "행동 욕구가 적절하게 활성화되는 흐름"],
    relatedStates: [
      { key: "state.executionFlow", polarity: "positive" },
      { key: "state.energySustain", polarity: "positive" },
    ],
    relatedFlows: ["flow.highExecution"],
  },
  "astro.aspect.mars.square": {
    title:               "화성 충돌각",
    shortDescription:    "행동·추진 에너지가 강한 긴장 구조로 활성화되는 흐름이에요.",
    detailedDescription: "화성의 행동·추진 에너지가 90도 긴장각을 통해 마찰 상태로 강하게 활성화되는 시기예요. 충동적 반응이나 갈등이 생기기 쉬운 흐름이에요.",
    commonPatterns: ["충동적 행동이나 갈등이 생기기 쉬운 시기", "긴장감이 높아지고 마찰이 생기는 흐름", "안정감이 흔들리는 편"],
    relatedStates: [
      { key: "state.tension",       polarity: "positive" },
      { key: "state.impulsiveness", polarity: "positive" },
      { key: "state.stability",     polarity: "negative" },
    ],
    relatedFlows: ["flow.tensionSpike", "flow.impulsive"],
  },
  "astro.aspect.mars.trine": {
    title:               "화성 조화각",
    shortDescription:    "행동·추진 에너지가 자연스럽게 흐르는 조화로운 구조예요.",
    detailedDescription: "화성의 행동·추진 에너지가 120도 조화각을 통해 원활하게 흐르는 흐름이에요. 실행력이 안정적으로 유지되면서 에너지 지속성이 올라오는 시기예요.",
    commonPatterns: ["실행력이 안정적으로 유지되는 시기", "에너지가 효율적으로 소모되는 흐름", "추진력과 안정감이 함께 올라오는 편"],
    relatedStates: [
      { key: "state.executionFlow", polarity: "positive" },
      { key: "state.energySustain", polarity: "positive" },
      { key: "state.stability",     polarity: "positive" },
    ],
    relatedFlows: ["flow.highExecution", "flow.stableFlow"],
  },
  "astro.aspect.mars.opposition": {
    title:               "화성 대립각",
    shortDescription:    "행동·추진 에너지가 반대 에너지와 마주하는 긴장 구조예요.",
    detailedDescription: "화성의 행동·추진 에너지가 180도 대립각을 통해 반대 천체와 마주하는 흐름이에요. 갈등이나 경쟁 상황에서 에너지가 강하게 활성화되는 시기예요.",
    commonPatterns: ["갈등이나 경쟁 상황에서 에너지가 강하게 올라오는 시기", "충동적 반응이나 마찰이 생기기 쉬운 흐름", "관계 에너지 소모가 생기는 편"],
    relatedStates: [
      { key: "state.tension",       polarity: "positive" },
      { key: "state.impulsiveness", polarity: "positive" },
      { key: "state.socialFatigue", polarity: "positive" },
    ],
    relatedFlows: ["flow.tensionSpike", "flow.impulsive"],
  },
  "astro.aspect.mars.quincunx": {
    title:               "화성 불일치각",
    shortDescription:    "행동·추진에 어색한 조정이 필요한 구조예요.",
    detailedDescription: "화성의 행동·추진 에너지가 150도 불일치각을 통해 어색하게 맞물리는 흐름이에요. 에너지가 원하는 방향으로 잘 작동하지 않거나, 실행 방향이 반복적으로 수정되는 시기예요.",
    commonPatterns: ["실행 방향이 반복적으로 수정되는 흐름", "에너지가 분산되거나 충동적으로 소모되는 시기", "명확하지 않은 방해 요소가 생기는 편"],
    relatedStates: [
      { key: "state.tension",       polarity: "positive" },
      { key: "state.impulsiveness", polarity: "positive" },
    ],
    relatedFlows: ["flow.tensionSpike"],
  },
  "astro.aspect.mars.semisextile": {
    title:               "화성 반육분각",
    shortDescription:    "행동·추진 에너지에 미세한 영향이 작용하는 행성 흐름이에요.",
    detailedDescription: "화성의 행동·추진 에너지에 30도 각도로 작은 영향이 작용하는 구조예요. 단독으로는 강한 영향이 없지만, 다른 화성 흐름과 함께 나타날 때 보조적으로 실행 에너지를 자극하는 편이에요.",
    commonPatterns: ["실행력에 작은 자극이 생기는 흐름", "큰 변화는 없지만 행동 욕구가 살짝 활성화되는 편", "보조적인 수준의 추진 에너지"],
    relatedStates: [
      { key: "state.executionFlow", polarity: "positive" },
    ],
    relatedFlows: ["flow.neutral"],
  },

  // ── astro · aspect — jupiter ──────────────────────────────────────────────────
  "astro.aspect.jupiter.conjunction": {
    title:               "목성 합",
    shortDescription:    "확장·기회 에너지가 다른 천체와 강하게 합쳐지는 구조예요.",
    detailedDescription: "목성의 확장·기회·낙관 에너지가 다른 천체와 합쳐지면서 증폭되는 흐름이에요. 에너지와 의지가 확장되는 시기와 함께 나타나는 편이에요.",
    commonPatterns: ["에너지와 기회가 확장되는 시기", "낙관적인 흐름이 강해지는 편", "다양한 가능성이 열리는 흐름"],
    relatedStates: [
      { key: "state.energySustain", polarity: "positive" },
      { key: "state.executionFlow", polarity: "positive" },
      { key: "state.stability",     polarity: "positive" },
    ],
    relatedFlows: ["flow.highExecution", "flow.stableFlow"],
  },
  "astro.aspect.jupiter.sextile": {
    title:               "목성 육분각",
    shortDescription:    "확장·기회 에너지가 부드럽게 지원받는 행성 흐름이에요.",
    detailedDescription: "목성의 확장·기회 에너지가 60도 조화각을 통해 부드럽게 흐르는 시기예요. 작은 기회나 지원이 자연스럽게 연결되는 흐름이에요.",
    commonPatterns: ["작은 기회나 지원이 자연스럽게 생기는 시기", "에너지가 안정적으로 확장되는 흐름", "낙관적 흐름이 부드럽게 유지되는 편"],
    relatedStates: [
      { key: "state.stability",     polarity: "positive" },
      { key: "state.energySustain", polarity: "positive" },
    ],
    relatedFlows: ["flow.stableFlow"],
  },
  "astro.aspect.jupiter.square": {
    title:               "목성 충돌각",
    shortDescription:    "확장 에너지가 과도하게 활성화되는 긴장 구조예요.",
    detailedDescription: "목성의 확장·낙관 에너지가 90도 긴장각을 통해 과도하게 활성화되는 흐름이에요. 지나친 낙관이나 과잉 행동이 생기기 쉬운 시기예요.",
    commonPatterns: ["지나친 낙관이나 과잉 소비가 생기기 쉬운 시기", "충동적 확장 욕구가 올라오는 흐름", "실행이 방향 없이 활성화되는 편"],
    relatedStates: [
      { key: "state.impulsiveness", polarity: "positive" },
      { key: "state.tension",       polarity: "positive" },
    ],
    relatedFlows: ["flow.impulsive", "flow.tensionSpike"],
  },
  "astro.aspect.jupiter.trine": {
    title:               "목성 조화각",
    shortDescription:    "확장·기회 에너지가 자연스럽게 흐르는 조화로운 구조예요.",
    detailedDescription: "목성의 확장·기회·낙관 에너지가 120도 조화각을 통해 원활하게 흐르는 흐름이에요. 에너지가 안정적으로 확장되고, 기회가 자연스럽게 연결되는 시기예요.",
    commonPatterns: ["기회와 에너지가 자연스럽게 연결되는 시기", "낙관적이고 안정적인 흐름", "실행력과 에너지 지속성이 함께 올라오는 편"],
    relatedStates: [
      { key: "state.stability",     polarity: "positive" },
      { key: "state.energySustain", polarity: "positive" },
      { key: "state.executionFlow", polarity: "positive" },
    ],
    relatedFlows: ["flow.stableFlow", "flow.highExecution"],
  },
  "astro.aspect.jupiter.opposition": {
    title:               "목성 대립각",
    shortDescription:    "확장 에너지와 제한 에너지가 마주하는 긴장 구조예요.",
    detailedDescription: "목성의 확장 에너지가 180도 대립각을 통해 반대 천체와 마주하는 흐름이에요. 확장하려는 욕구와 현실적 제약이 충돌하는 시기예요.",
    commonPatterns: ["확장 욕구와 현실적 한계가 충돌하는 흐름", "지나친 낙관이 현실 인식과 부딪히는 시기", "균형이 필요한 긴장 상황"],
    relatedStates: [
      { key: "state.tension",       polarity: "positive" },
      { key: "state.impulsiveness", polarity: "positive" },
    ],
    relatedFlows: ["flow.tensionSpike"],
  },
  "astro.aspect.jupiter.quincunx": {
    title:               "목성 불일치각",
    shortDescription:    "확장 흐름에 어색한 조정이 필요한 구조예요.",
    detailedDescription: "목성의 확장·기회 에너지가 150도 불일치각을 통해 어색하게 맞물리는 흐름이에요. 기회가 생기지만 방향이 맞지 않아 반복적인 조정이 필요한 시기예요.",
    commonPatterns: ["기회가 생기지만 방향이 어색하게 연결되는 흐름", "낙관적 흐름이 현실과 불일치하는 시기", "반복적인 방향 조정이 필요한 편"],
    relatedStates: [
      { key: "state.tension", polarity: "positive" },
      { key: "state.focus",   polarity: "positive" },
    ],
    relatedFlows: ["flow.tensionSpike"],
  },
  "astro.aspect.jupiter.semisextile": {
    title:               "목성 반육분각",
    shortDescription:    "확장·기회 에너지에 미세한 영향이 작용하는 행성 흐름이에요.",
    detailedDescription: "목성의 확장·기회 에너지에 30도 각도로 작은 영향이 작용하는 구조예요. 단독으로는 강한 확장이 없지만, 전반적인 흐름에서 작은 낙관 요소가 보조적으로 작용하는 편이에요.",
    commonPatterns: ["작은 낙관적 요소가 생기는 흐름", "에너지가 미세하게 확장되는 편", "보조적인 수준의 기회 흐름"],
    relatedStates: [
      { key: "state.stability", polarity: "positive" },
    ],
    relatedFlows: ["flow.neutral"],
  },

  // ── astro · aspect — saturn ───────────────────────────────────────────────────
  "astro.aspect.saturn.conjunction": {
    title:               "토성 합",
    shortDescription:    "규율·제한 에너지가 다른 천체와 강하게 합쳐지는 구조예요.",
    detailedDescription: "토성의 규율·제한·책임 에너지가 다른 천체와 합쳐지면서 강하게 활성화되는 흐름이에요. 집중력과 조직화는 올라오지만, 에너지 소모가 크고 긴장감이 함께 생기는 시기예요.",
    commonPatterns: ["책임·의무 흐름이 강하게 올라오는 시기", "집중력이 강해지지만 에너지 부담이 생기는 흐름", "조직화나 구조 설정이 강조되는 편"],
    relatedStates: [
      { key: "state.focus",         polarity: "positive" },
      { key: "state.organization",  polarity: "positive" },
      { key: "state.tension",       polarity: "positive" },
      { key: "state.energySustain", polarity: "negative" },
    ],
    relatedFlows: ["flow.focusBoost", "flow.tensionSpike"],
  },
  "astro.aspect.saturn.sextile": {
    title:               "토성 육분각",
    shortDescription:    "규율·구조 에너지가 부드럽게 지원받는 행성 흐름이에요.",
    detailedDescription: "토성의 규율·구조 에너지가 60도 조화각을 통해 부드럽게 흐르는 시기예요. 안정적이고 체계적인 흐름이 자연스럽게 올라오는 편이에요.",
    commonPatterns: ["체계·루틴이 자연스럽게 유지되는 시기", "안정적인 구조 흐름이 지속되는 편", "책임 흐름이 부드럽게 작동하는 편"],
    relatedStates: [
      { key: "state.stability",    polarity: "positive" },
      { key: "state.organization", polarity: "positive" },
    ],
    relatedFlows: ["flow.stableFlow"],
  },
  "astro.aspect.saturn.square": {
    title:               "토성 충돌각",
    shortDescription:    "규율·제한 에너지가 강한 긴장 구조로 활성화되는 흐름이에요.",
    detailedDescription: "토성의 규율·제한 에너지가 90도 긴장각을 통해 강하게 마찰하는 시기예요. 제약이나 장애물이 생기고, 에너지 흐름이 억제되는 흐름이에요.",
    commonPatterns: ["제약이나 장애물이 생기는 시기", "진행 중인 일이 막히거나 지연되는 흐름", "긴장감이 높아지면서 안정감이 흔들리는 편"],
    relatedStates: [
      { key: "state.tension",       polarity: "positive" },
      { key: "state.stability",     polarity: "negative" },
      { key: "state.executionFlow", polarity: "negative" },
    ],
    relatedFlows: ["flow.tensionSpike", "flow.blocked"],
  },
  "astro.aspect.saturn.trine": {
    title:               "토성 조화각",
    shortDescription:    "규율·구조 에너지가 자연스럽게 흐르는 안정적 구조예요.",
    detailedDescription: "토성의 규율·구조 에너지가 120도 조화각을 통해 원활하게 흐르는 흐름이에요. 인내와 체계적 노력이 자연스럽게 결과로 이어지는 시기예요.",
    commonPatterns: ["체계적인 노력이 안정적으로 진행되는 시기", "규칙·루틴이 효율적으로 작동하는 흐름", "집중력과 안정감이 함께 유지되는 편"],
    relatedStates: [
      { key: "state.stability",    polarity: "positive" },
      { key: "state.organization", polarity: "positive" },
      { key: "state.focus",        polarity: "positive" },
    ],
    relatedFlows: ["flow.stableFlow", "flow.focusBoost"],
  },
  "astro.aspect.saturn.opposition": {
    title:               "토성 대립각",
    shortDescription:    "규율·제한 에너지가 반대 에너지와 마주하는 긴장 구조예요.",
    detailedDescription: "토성의 제한·책임 에너지가 180도 대립각을 통해 반대 천체와 마주하는 흐름이에요. 자유와 제약 사이에서 긴장이 크게 올라오는 시기예요.",
    commonPatterns: ["자유와 제약 사이에서 긴장이 올라오는 시기", "관계나 상황에서 부담이 커지는 흐름", "안정감이 크게 흔들리는 편"],
    relatedStates: [
      { key: "state.tension",       polarity: "positive" },
      { key: "state.socialFatigue", polarity: "positive" },
      { key: "state.stability",     polarity: "negative" },
    ],
    relatedFlows: ["flow.tensionSpike", "flow.blocked"],
  },
  "astro.aspect.saturn.quincunx": {
    title:               "토성 불일치각",
    shortDescription:    "규율·구조 흐름에 어색한 조정이 필요한 구조예요.",
    detailedDescription: "토성의 제한·구조 에너지가 150도 불일치각을 통해 어색하게 맞물리는 흐름이에요. 규율이나 구조가 반복적으로 맞지 않아 지속적인 수정이 필요한 시기예요.",
    commonPatterns: ["체계나 규칙이 반복적으로 수정되는 흐름", "제약이 명확하지 않은 방식으로 작용하는 시기", "조직화가 어색하게 진행되는 편"],
    relatedStates: [
      { key: "state.tension",      polarity: "positive" },
      { key: "state.organization", polarity: "positive" },
    ],
    relatedFlows: ["flow.tensionSpike"],
  },
  "astro.aspect.saturn.semisextile": {
    title:               "토성 반육분각",
    shortDescription:    "규율·구조 에너지에 미세한 영향이 작용하는 행성 흐름이에요.",
    detailedDescription: "토성의 규율·구조 에너지에 30도 각도로 작은 영향이 작용하는 구조예요. 일상의 체계나 집중에 작은 자극이 생기는 흐름이에요.",
    commonPatterns: ["체계·집중에 작은 자극이 생기는 흐름", "규율 흐름이 미세하게 강화되는 편", "보조적인 수준의 구조 활성"],
    relatedStates: [
      { key: "state.focus",        polarity: "positive" },
      { key: "state.organization", polarity: "positive" },
    ],
    relatedFlows: ["flow.neutral"],
  },

  // ── astro · aspect — semisquare (45°) ────────────────────────────────────────
  "astro.aspect.sun.semisquare": {
    title:               "태양 반충돌각",
    shortDescription:    "태양 에너지가 살짝 걸리는 구조의 행성 흐름이에요.",
    detailedDescription: "반충돌각(semisquare, 45도)은 두 천체 에너지가 완전한 충돌은 아니지만 미묘한 마찰이 생기는 구조예요. 태양의 정체성·활력 에너지가 다른 천체와 리듬이 살짝 어긋나는 흐름과 함께 나타나는 편이에요. 꼭 큰 충돌을 의미하는 건 아니고, 에너지가 완전히 자연스럽게 흐르지 않아 약한 조정이 필요한 정도의 흐름이에요.",
    commonPatterns: ["에너지 리듬이 살짝 어긋나는 시기", "자신감이나 활력에 약한 마찰이 생기는 흐름", "흐름이 완전히 자연스럽지 않은 편"],
    relatedStates: [
      { key: "state.tension", polarity: "positive" },
    ],
    relatedFlows: ["flow.neutral"],
  },
  "astro.aspect.moon.semisquare": {
    title:               "달 반충돌각",
    shortDescription:    "감정 에너지가 살짝 걸리는 구조의 행성 흐름이에요.",
    detailedDescription: "달의 감정·직관 에너지가 45도 반충돌각을 통해 미묘한 마찰 구조로 만나는 흐름이에요. 감정이 완전히 편안하게 흐르지 않고 조금씩 걸리는 느낌이 생기는 시기와 함께 나타나는 편이에요. 큰 감정 기복이 아니라, 내면 리듬이 살짝 어긋나는 정도의 흐름이에요.",
    commonPatterns: ["감정 리듬이 살짝 어긋나는 시기", "내면에서 작은 마찰이 반복되는 흐름", "불편함이 명확하지 않고 조금씩 걸리는 편"],
    relatedStates: [
      { key: "state.emotionalAmplitude", polarity: "positive" },
      { key: "state.tension",            polarity: "positive" },
    ],
    relatedFlows: ["flow.neutral"],
  },
  "astro.aspect.mercury.semisquare": {
    title:               "수성 반충돌각",
    shortDescription:    "사고·소통 에너지가 살짝 걸리는 구조의 행성 흐름이에요.",
    detailedDescription: "수성의 사고·소통 에너지가 45도 반충돌각을 통해 미묘한 마찰 구조로 만나는 흐름이에요. 생각이나 소통이 완전히 자연스럽게 흐르지 않고 조금씩 걸리는 시기와 함께 나타나는 편이에요. 큰 오해나 갈등이 아니라, 리듬이 살짝 맞지 않는 정도의 흐름이에요.",
    commonPatterns: ["생각이나 소통 리듬이 살짝 어긋나는 시기", "정보 처리가 완전히 매끄럽지 않은 흐름", "작은 마찰이 반복적으로 생기는 편"],
    relatedStates: [
      { key: "state.tension", polarity: "positive" },
    ],
    relatedFlows: ["flow.neutral"],
  },
  "astro.aspect.venus.semisquare": {
    title:               "금성 반충돌각",
    shortDescription:    "관계·가치 에너지가 살짝 걸리는 구조의 행성 흐름이에요.",
    detailedDescription: "금성의 관계·가치 에너지가 45도 반충돌각을 통해 미묘한 마찰 구조로 만나는 흐름이에요. 관계나 감정 흐름이 완전히 부드럽지 않고 조금씩 걸리는 느낌이 생기는 시기와 함께 나타나는 편이에요. 큰 갈등이 아니라, 관계 리듬이 살짝 어긋나는 정도의 흐름이에요.",
    commonPatterns: ["관계 리듬이 살짝 어긋나는 시기", "감정 흐름이 완전히 자연스럽지 않은 편", "작은 관계 마찰이 조금씩 생기는 흐름"],
    relatedStates: [
      { key: "state.tension",       polarity: "positive" },
      { key: "state.socialFatigue", polarity: "positive" },
    ],
    relatedFlows: ["flow.neutral"],
  },
  "astro.aspect.mars.semisquare": {
    title:               "화성 반충돌각",
    shortDescription:    "행동·추진 에너지가 살짝 걸리는 구조의 행성 흐름이에요.",
    detailedDescription: "화성의 행동·추진 에너지가 45도 반충돌각을 통해 미묘한 마찰 구조로 만나는 흐름이에요. 실행하려는 에너지가 완전히 자연스럽게 흐르지 않고 조금씩 걸리는 시기와 함께 나타나는 편이에요. 큰 충돌이 아니라, 추진 리듬이 살짝 어긋나면서 충동적 반응이 작게 올라오는 흐름이에요.",
    commonPatterns: ["실행 리듬이 살짝 어긋나는 시기", "행동 욕구가 완전히 매끄럽게 흐르지 않는 흐름", "작은 충동적 반응이 생기기 쉬운 편"],
    relatedStates: [
      { key: "state.tension",       polarity: "positive" },
      { key: "state.impulsiveness", polarity: "positive" },
    ],
    relatedFlows: ["flow.neutral"],
  },
  "astro.aspect.jupiter.semisquare": {
    title:               "목성 반충돌각",
    shortDescription:    "확장 에너지가 살짝 걸리는 구조의 행성 흐름이에요.",
    detailedDescription: "목성의 확장·기회 에너지가 45도 반충돌각을 통해 미묘한 마찰 구조로 만나는 흐름이에요. 흐름이 확장되려는 방향이 완전히 자연스럽게 이어지지 않고 조금씩 걸리는 시기와 함께 나타나는 편이에요. 큰 저항은 아니고, 낙관적 에너지가 살짝 어긋나는 정도의 흐름이에요.",
    commonPatterns: ["확장 흐름이 살짝 걸리는 시기", "기회 연결이 완전히 자연스럽지 않은 흐름", "에너지가 리듬 없이 약하게 활성화되는 편"],
    relatedStates: [
      { key: "state.tension", polarity: "positive" },
    ],
    relatedFlows: ["flow.neutral"],
  },
  "astro.aspect.saturn.semisquare": {
    title:               "토성 반충돌각",
    shortDescription:    "규율·구조 에너지가 살짝 걸리는 구조의 행성 흐름이에요.",
    detailedDescription: "토성의 규율·제한 에너지가 45도 반충돌각을 통해 미묘한 마찰 구조로 만나는 흐름이에요. 체계나 규칙이 완전히 자연스럽게 작동하지 않고 조금씩 걸리는 시기와 함께 나타나는 편이에요. 큰 제약이 아니라, 구조 흐름이 살짝 어긋나면서 조정이 필요한 정도의 흐름이에요.",
    commonPatterns: ["체계·규칙이 완전히 매끄럽게 작동하지 않는 시기", "구조 흐름이 살짝 어긋나는 흐름", "작은 제약이나 조정이 반복되는 편"],
    relatedStates: [
      { key: "state.tension",      polarity: "positive" },
      { key: "state.organization", polarity: "positive" },
    ],
    relatedFlows: ["flow.neutral"],
  },
};

// ── safeResolveInfo ────────────────────────────────────────────────────────────

/**
 * Resolve a canonical key to EventInfo.
 * Returns null if no definition exists — caller decides fallback rendering.
 */
export function safeResolveInfo(key: string): EventInfo | null {
  return EVENT_INFO[key] ?? null;
}

/**
 * Check if a key is registered in any dictionary (EVENT_LABELS, STATE_LABELS, FLOW_LABELS, or astro).
 * Returns true only if the key has a valid label definition.
 *
 * Use this for filtering UI elements to prevent exposing raw internal keys.
 */
export function isKeyRegistered(key: string): boolean {
  // Check dictionaries
  if (EVENT_LABELS[key]) return true;
  if (STATE_LABELS[key]) return true;
  if (FLOW_LABELS[key]) return true;

  // Check astro labels
  const astroLabel = resolveAstroLabel(key);
  if (astroLabel && astroLabel !== key) return true;

  return false;
}
