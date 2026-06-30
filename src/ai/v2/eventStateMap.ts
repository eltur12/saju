/**
 * EventStateMap — canonical event key → V2 state impacts
 *
 * 값 단위: 정수 -5 ~ +5
 *  - 절댓값 = 해당 state에 대한 신호 강도
 *  - 부호   = 방향 (양수 = state 활성, 음수 = state 억제)
 *
 * 누적 방식: impact(event.impact) × coeff → weighted sum → strength 0~1 정규화
 *
 * 커버 범위:
 *  saju.tenGod.* (10)
 *  saju.branch.* (11)
 *  saju.ohaeng.clash (1)
 *  ziwei.palace.* (12)
 *  astro.aspect.{mercury|moon|sun|venus|mars|jupiter|saturn|chiron}.{trine|sextile|square|opposition|conjunction|semisquare|quincunx} (52)
 */

import type { V2StateKey } from "./types";

export type StateImpact = Partial<Record<V2StateKey, number>>;
export type EventStateMapType = Record<string, StateImpact>;

export const EVENT_STATE_MAP: EventStateMapType = {

  // ── Saju tenGod ────────────────────────────────────────────────────────────

  "saju.tenGod.bigyeon":    { initiative: 2, persistence: 2, stability: 1, boundaries: 2 },
  "saju.tenGod.geobjae":    { urgency: 3, restlessness: 2, innerConflict: 2, adaptation: 1 },
  "saju.tenGod.siksin":     { expression: 2, creativity: 2, optimism: 2, energySustain: 2, connection: 1 },
  "saju.tenGod.sanggwan":   { expression: 3, creativity: 3, articulation: 2, urgency: 1, innerConflict: 1 },
  "saju.tenGod.pyeongjae":  { adaptation: 2, executionFlow: 2, restlessness: 1, decision: 1, optimism: 1 },
  "saju.tenGod.jeongjae":   { stability: 2, persistence: 2, securityNeed: 2, decision: 1, energySustain: 1 },
  "saju.tenGod.pyeonggwan": { initiative: 2, urgency: 2, executionFlow: 2, decision: 2, innerConflict: 1 },
  "saju.tenGod.jeonggwan":  { stability: 2, persistence: 2, decision: 2, recognition: 1, clarity: 1 },
  "saju.tenGod.pyeongin":   { reflection: 2, curiosity: 2, insight: 2, focus: 1 },
  "saju.tenGod.jeongin":    { clarity: 3, reflection: 2, insight: 2, focus: 2, energySustain: 1 },

  // ── Saju branch ────────────────────────────────────────────────────────────

  "saju.branch.sixHarmony":         { connection: 3, stability: 2, charm: 1, optimism: 1 },
  "saju.branch.halfTrine":          { connection: 2, adaptation: 1, stability: 1 },
  "saju.branch.trine":              { connection: 3, stability: 2, executionFlow: 1, optimism: 1, energySustain: 1 },
  "saju.branch.directionalHarmony": { executionFlow: 2, focus: 1, persistence: 1 },
  "saju.branch.clash":              { urgency: 3, innerConflict: 2, restlessness: 2, stability: -2 },
  "saju.branch.harm":               { distance: 2, boundaries: 1, sensitivity: 1 },
  "saju.branch.penalty":            { innerConflict: 2, boundaries: 2, urgency: 1 },
  "saju.branch.triplePenalty":      { urgency: 3, innerConflict: 3, fatigueLoad: 2, stability: -2 },
  "saju.branch.hostility":          { distance: 3, misalignment: 2, sensitivity: 1 },
  "saju.branch.spiritDoor":         { sensitivity: 3, emotionalAmplitude: 2, insight: 1, innerConflict: 1 },
  "saju.branch.selfPenalty":        { reflection: 2, innerConflict: 2, boundaries: 1 },

  // ── Saju ohaeng ────────────────────────────────────────────────────────────

  "saju.ohaeng.clash": { urgency: 2, innerConflict: 2, fatigueLoad: 1 },

  // ── Ziwei palaces ──────────────────────────────────────────────────────────

  "ziwei.palace.life":     { clarity: 2, initiative: 2, decision: 1, energySustain: 1 },
  "ziwei.palace.career":   { executionFlow: 2, persistence: 2, recognition: 1, energySustain: 1 },
  "ziwei.palace.wealth":   { securityNeed: 2, executionFlow: 1, decision: 1 },
  "ziwei.palace.spouse":   { connection: 2, longing: 2, emotionalAmplitude: 1 },
  "ziwei.palace.property": { stability: 2, securityNeed: 2, protectiveness: 1 },
  "ziwei.palace.health":   { needForRest: 2, fatigueLoad: 1, sensitivity: 1 },
  "ziwei.palace.friends":  { connection: 2, expression: 1, articulation: 1 },
  "ziwei.palace.children": { creativity: 2, expression: 2, charm: 1 },
  "ziwei.palace.spirit":   { reflection: 2, optimism: 2, curiosity: 1 },
  "ziwei.palace.siblings": { connection: 2, boundaries: 1 },
  "ziwei.palace.travel":   { restlessness: 2, adaptation: 2, initiative: 1 },
  "ziwei.palace.parents":  { reflection: 1, stability: 1, boundaries: 2 },

  // ── Astro: Mercury ─────────────────────────────────────────────────────────

  "astro.aspect.mercury.trine":       { clarity: 3, articulation: 2, focus: 1 },
  "astro.aspect.mercury.sextile":     { articulation: 2, clarity: 1, connection: 1 },
  "astro.aspect.mercury.square":      { confusion: 2, misalignment: 1 },
  "astro.aspect.mercury.opposition":  { confusion: 2, misalignment: 2 },
  "astro.aspect.mercury.conjunction": { focus: 2, articulation: 2, clarity: 1 },
  "astro.aspect.mercury.semisquare":  { confusion: 1, misalignment: 1 },
  "astro.aspect.mercury.quincunx":    { confusion: 2, misalignment: 1 },

  // ── Astro: Moon ────────────────────────────────────────────────────────────

  "astro.aspect.moon.trine":       { emotionalAmplitude: 2, stability: 2, connection: 1 },
  "astro.aspect.moon.sextile":     { connection: 2, emotionalAmplitude: 1, optimism: 1 },
  "astro.aspect.moon.square":      { sensitivity: 3, emotionalAmplitude: 2, innerConflict: 1 },
  "astro.aspect.moon.opposition":  { emotionalAmplitude: 3, innerConflict: 2, sensitivity: 1 },
  "astro.aspect.moon.conjunction": { emotionalAmplitude: 2, sensitivity: 1 },
  "astro.aspect.moon.semisquare":  { sensitivity: 2, emotionalAmplitude: 1 },
  "astro.aspect.moon.quincunx":    { sensitivity: 2, misalignment: 1 },

  // ── Astro: Sun ─────────────────────────────────────────────────────────────

  "astro.aspect.sun.trine":       { optimism: 2, initiative: 2, recognition: 1, energySustain: 2 },
  "astro.aspect.sun.sextile":     { recognition: 2, optimism: 1, initiative: 1 },
  "astro.aspect.sun.square":      { urgency: 2, innerConflict: 2 },
  "astro.aspect.sun.opposition":  { innerConflict: 2, urgency: 1 },
  "astro.aspect.sun.conjunction": { initiative: 2, recognition: 1, optimism: 1 },
  "astro.aspect.sun.semisquare":  { urgency: 1, innerConflict: 1 },
  "astro.aspect.sun.quincunx":    { misalignment: 1, innerConflict: 1 },

  // ── Astro: Venus ───────────────────────────────────────────────────────────

  "astro.aspect.venus.trine":       { connection: 3, charm: 2, longing: 1 },
  "astro.aspect.venus.sextile":     { connection: 2, charm: 1 },
  "astro.aspect.venus.square":      { misalignment: 2, sensitivity: 2, distance: 1 },
  "astro.aspect.venus.opposition":  { distance: 3, misalignment: 2 },
  "astro.aspect.venus.conjunction": { connection: 2, charm: 2, emotionalAmplitude: 1 },
  "astro.aspect.venus.semisquare":  { sensitivity: 1, misalignment: 1 },
  "astro.aspect.venus.quincunx":    { misalignment: 2, distance: 1 },

  // ── Astro: Mars ────────────────────────────────────────────────────────────

  "astro.aspect.mars.trine":       { executionFlow: 3, initiative: 2, persistence: 1 },
  "astro.aspect.mars.sextile":     { executionFlow: 2, initiative: 1 },
  "astro.aspect.mars.square":      { urgency: 3, restlessness: 2, innerConflict: 1 },
  "astro.aspect.mars.opposition":  { urgency: 3, innerConflict: 2 },
  "astro.aspect.mars.conjunction": { initiative: 3, executionFlow: 2, urgency: 1 },
  "astro.aspect.mars.semisquare":  { restlessness: 1, urgency: 1 },
  "astro.aspect.mars.quincunx":    { restlessness: 1, misalignment: 1 },

  // ── Astro: Jupiter ─────────────────────────────────────────────────────────

  "astro.aspect.jupiter.trine":       { optimism: 3, adaptation: 2, executionFlow: 1, energySustain: 2 },
  "astro.aspect.jupiter.sextile":     { optimism: 2, adaptation: 1 },
  "astro.aspect.jupiter.square":      { restlessness: 2, confusion: 1 },
  "astro.aspect.jupiter.opposition":  { misalignment: 2, restlessness: 1 },
  "astro.aspect.jupiter.conjunction": { optimism: 3, adaptation: 2 },
  "astro.aspect.jupiter.semisquare":  { restlessness: 1 },
  "astro.aspect.jupiter.quincunx":    { restlessness: 1, misalignment: 1 },

  // ── Astro: Saturn ──────────────────────────────────────────────────────────

  "astro.aspect.saturn.trine":       { persistence: 3, stability: 2, clarity: 1 },
  "astro.aspect.saturn.sextile":     { persistence: 2, stability: 1 },
  "astro.aspect.saturn.square":      { fatigueLoad: 3, innerConflict: 2, boundaries: 1 },
  "astro.aspect.saturn.opposition":  { innerConflict: 3, fatigueLoad: 2 },
  "astro.aspect.saturn.conjunction": { persistence: 2, boundaries: 2, fatigueLoad: 1 },
  "astro.aspect.saturn.semisquare":  { fatigueLoad: 1, boundaries: 1 },
  "astro.aspect.saturn.quincunx":    { innerConflict: 1, fatigueLoad: 1 },

  // ── Astro: Chiron ──────────────────────────────────────────────────────────

  "astro.aspect.chiron.trine":       { reflection: 2, protectiveness: 2, sensitivity: 1 },
  "astro.aspect.chiron.sextile":     { reflection: 2, connection: 1 },
  "astro.aspect.chiron.square":      { sensitivity: 3, innerConflict: 2 },
  "astro.aspect.chiron.opposition":  { innerConflict: 2, sensitivity: 2 },
  "astro.aspect.chiron.conjunction": { reflection: 2, sensitivity: 2, needForRest: 1 },
  "astro.aspect.chiron.semisquare":  { sensitivity: 2 },
  "astro.aspect.chiron.quincunx":    { sensitivity: 1, misalignment: 1 },

  // ── Saju Special Stars ─────────────────────────────────────────────────────

  "saju.star.doHwa":    { charm: 3, expression: 2, recognition: 2, connection: 1 },
  "saju.star.cheonDeok":{ stability: 2, connection: 2, protectiveness: 1 },
  "saju.star.wolDeok":  { stability: 2, connection: 2, securityNeed: 1 },

  // ── Saju 12운성 (7) ────────────────────────────────────────────────────────

  "saju.twelveState.jangSaeng": { initiative: 2, optimism: 2, energySustain: 2, curiosity: 1 },
  "saju.twelveState.mokYok":    { sensitivity: 2, emotionalAmplitude: 2, charm: 1 },
  "saju.twelveState.gwanDae":   { initiative: 2, executionFlow: 2, recognition: 1, persistence: 1 },
  "saju.twelveState.geonRok":   { stability: 3, persistence: 2, energySustain: 2, securityNeed: 1 },
  "saju.twelveState.jeWang":    { executionFlow: 3, initiative: 3, recognition: 2, optimism: 1 },
  "saju.twelveState.tae":       { reflection: 2, curiosity: 2, insight: 1 },
  "saju.twelveState.yang":      { persistence: 2, stability: 2, reflection: 1, protectiveness: 1 },
};

/** 매핑 커버리지 확인용 — 알려진 모든 canonical key 집합 */
export const KNOWN_EVENT_KEYS = new Set<string>(Object.keys(EVENT_STATE_MAP));
