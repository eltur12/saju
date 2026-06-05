/**
 * Event → Category Direct Mapping
 *
 * EventStateMap과 별개로, 각 event가 category score에 직접 기여하는 매핑
 * baseCategoryScore + eventCategoryDelta * strength
 *
 * 가중치 단위: ±0.1 ~ ±1.0 범위
 * - 강한 positive: +0.8 ~ +1.0
 * - 중간 positive: +0.4 ~ +0.7
 * - 약한 positive: +0.1 ~ +0.3
 * - 약한 negative: -0.1 ~ -0.3
 * - 중간 negative: -0.4 ~ -0.7
 * - 강한 negative: -0.8 ~ -1.0
 */

import type { CategoryKey } from "./types";

export type EventCategoryImpact = Partial<Record<CategoryKey, number>>;
export type EventCategoryMapType = Record<string, EventCategoryImpact>;

export const EVENT_CATEGORY_MAP: EventCategoryMapType = {

  // ── Saju tenGod (10) ───────────────────────────────────────────────────────

  "saju.tenGod.bigyeon": {
    wealth:    0.6,
    career:    0.5,
    relations: 0.4,
  },

  "saju.tenGod.geobjae": {
    wealth:    0.7,
    career:    0.4,
    health:    -0.3,
  },

  "saju.tenGod.siksin": {
    health:    0.7,
    love:      0.4,
    relations: 0.6,
  },

  "saju.tenGod.sanggwan": {
    career:    0.6,
    study:     0.6,
    health:    -0.2,
  },

  "saju.tenGod.pyeongjae": {
    wealth:    0.8,
    career:    0.5,
  },

  "saju.tenGod.jeongjae": {
    wealth:    1.0,
    health:    0.6,
  },

  "saju.tenGod.pyeonggwan": {
    career:    0.9,
    wealth:    0.4,
    relations: 0.4,
  },

  "saju.tenGod.jeonggwan": {
    career:    1.0,
    study:     0.4,
    relations: 0.3,
  },

  "saju.tenGod.pyeongin": {
    study:     0.9,
    career:    0.3,
    health:    0.3,
  },

  "saju.tenGod.jeongin": {
    study:     1.0,
    health:    0.5,
  },

  // ── Saju branch relations (11) ─────────────────────────────────────────────

  "saju.branch.sixHarmony": {
    love:      1.0,
    relations: 1.0,
    health:    0.65,
  },

  "saju.branch.halfTrine": {
    relations: 0.7,
    career:    0.3,
    love:      0.4,
    health:    0.3,
  },

  "saju.branch.trine": {
    wealth:    0.7,
    love:      0.6,
    relations: 0.9,
    health:    0.6,
  },

  "saju.branch.directionalHarmony": {
    career:    0.7,
    wealth:    0.5,
    relations: 0.4,
  },

  "saju.branch.clash": {
    health:    -0.65,
    love:      -0.5,
    relations: -0.5,
  },

  "saju.branch.harm": {
    relations: -0.9,
    love:      -0.7,
    health:    -0.4,
  },

  "saju.branch.penalty": {
    health:    -0.6,
    relations: -0.5,
    study:     -0.3,
    love:      -0.3,
  },

  "saju.branch.triplePenalty": {
    health:    -1.0,
    career:    -0.5,
    relations: -0.4,
    study:     -0.3,
  },

  "saju.branch.hostility": {
    relations: -1.0,
    love:      -0.8,
  },

  "saju.branch.spiritDoor": {
    study:     0.6,
    health:    -0.3,
    relations: -0.3,
  },

  "saju.branch.selfPenalty": {
    health:    -0.5,
    study:     0.3,
    relations: -0.3,
  },

  // ── Saju ohaeng (1) ────────────────────────────────────────────────────────

  "saju.ohaeng.clash": {
    health:    -0.7,
    career:    -0.4,
    relations: -0.3,
    study:     -0.3,
  },

  // ── Ziwei palaces (12) ─────────────────────────────────────────────────────

  "ziwei.palace.life": {
    career:    0.5,
    health:    0.75,
    study:     0.4,
  },

  "ziwei.palace.career": {
    career:    0.75,
    wealth:    0.5,
  },

  "ziwei.palace.wealth": {
    wealth:    1.0,
    career:    0.3,
    health:    0.3,
  },

  "ziwei.palace.spouse": {
    love:      1.3,
    relations: 0.4,
  },

  "ziwei.palace.property": {
    wealth:    0.8,
    health:    0.5,
  },

  "ziwei.palace.health": {
    health:    0.9,
    love:      0.3,
    career:    0.3,
  },

  "ziwei.palace.friends": {
    relations: 1.0,
    love:      0.3,
  },

  "ziwei.palace.children": {
    love:      0.6,
    relations: 0.6,
  },

  "ziwei.palace.spirit": {
    study:     0.6,
    health:    0.55,
  },

  "ziwei.palace.siblings": {
    relations: 0.8,
    love:      0.3,
    health:    0.2,
  },

  "ziwei.palace.travel": {
    career:    0.4,
    relations: 0.3,
    health:    -0.2,
    study:     -0.2,
  },

  "ziwei.palace.parents": {
    health:    0.3,
    study:     0.3,
    relations: 0.3,
  },

  // ── Astro: Mercury (7) ─────────────────────────────────────────────────────

  "astro.aspect.mercury.trine": {
    study:     0.8,
    career:    0.5,
    relations: 0.5,
  },

  "astro.aspect.mercury.sextile": {
    study:     0.7,
    relations: 0.6,
    career:    0.4,
  },

  "astro.aspect.mercury.square": {
    study:     -0.6,
    career:    -0.4,
  },

  "astro.aspect.mercury.opposition": {
    study:     -0.7,
    relations: -0.5,
  },

  "astro.aspect.mercury.conjunction": {
    study:     0.7,
    career:    0.5,
  },

  "astro.aspect.mercury.semisquare": {
    study:     -0.3,
    relations: -0.2,
    career:    -0.2,
  },

  "astro.aspect.mercury.quincunx": {
    study:     -0.4,
    career:    -0.3,
  },

  // ── Astro: Moon (7) ────────────────────────────────────────────────────────

  "astro.aspect.moon.trine": {
    love:      0.7,
    health:    0.7,
    relations: 0.6,
  },

  "astro.aspect.moon.sextile": {
    love:      0.5,
    relations: 0.6,
    health:    0.3,
  },

  "astro.aspect.moon.square": {
    love:      -0.5,
    health:    -0.6,
  },

  "astro.aspect.moon.opposition": {
    love:      -0.7,
    health:    -0.6,
  },

  "astro.aspect.moon.conjunction": {
    love:      0.6,
    health:    0.4,
    relations: 0.4,
  },

  "astro.aspect.moon.semisquare": {
    love:      -0.3,
    health:    -0.3,
    relations: -0.2,
  },

  "astro.aspect.moon.quincunx": {
    love:      -0.4,
    health:    -0.4,
  },

  // ── Astro: Sun (7) ─────────────────────────────────────────────────────────

  "astro.aspect.sun.trine": {
    career:    0.8,
    health:    0.8,
    wealth:    0.5,
  },

  "astro.aspect.sun.sextile": {
    career:    0.6,
    health:    0.6,
    relations: 0.3,
  },

  "astro.aspect.sun.square": {
    career:    -0.5,
    health:    -0.6,
  },

  "astro.aspect.sun.opposition": {
    career:    -0.6,
    health:    -0.5,
  },

  "astro.aspect.sun.conjunction": {
    career:    0.7,
    health:    0.5,
  },

  "astro.aspect.sun.semisquare": {
    health:    -0.3,
    career:    -0.2,
    relations: -0.2,
  },

  "astro.aspect.sun.quincunx": {
    career:    -0.4,
    health:    -0.4,
  },

  // ── Astro: Venus (7) ───────────────────────────────────────────────────────

  "astro.aspect.venus.trine": {
    love:      1.0,
    relations: 0.8,
    wealth:    0.4,
  },

  "astro.aspect.venus.sextile": {
    love:      0.7,
    relations: 0.6,
    health:    0.3,
  },

  "astro.aspect.venus.square": {
    love:      -0.8,
    relations: -0.6,
  },

  "astro.aspect.venus.opposition": {
    love:      -0.9,
    relations: -0.7,
  },

  "astro.aspect.venus.conjunction": {
    love:      0.8,
    relations: 0.6,
  },

  "astro.aspect.venus.semisquare": {
    love:      -0.4,
    relations: -0.3,
    health:    -0.2,
  },

  "astro.aspect.venus.quincunx": {
    love:      -0.5,
    relations: -0.4,
  },

  // ── Astro: Mars (7) ────────────────────────────────────────────────────────

  "astro.aspect.mars.trine": {
    career:    0.9,
    wealth:    0.6,
    health:    0.5,
  },

  "astro.aspect.mars.sextile": {
    career:    0.6,
    wealth:    0.4,
    health:    0.3,
  },

  "astro.aspect.mars.square": {
    career:    -0.4,
    health:    -0.7,
    relations: -0.5,
  },

  "astro.aspect.mars.opposition": {
    health:    -0.8,
    relations: -0.6,
  },

  "astro.aspect.mars.conjunction": {
    career:    0.7,
    health:    0.4,
  },

  "astro.aspect.mars.semisquare": {
    health:    -0.4,
    relations: -0.3,
    career:    -0.2,
  },

  "astro.aspect.mars.quincunx": {
    career:    -0.3,
    health:    -0.4,
  },

  // ── Astro: Jupiter (7) ─────────────────────────────────────────────────────

  "astro.aspect.jupiter.trine": {
    wealth:    0.9,
    career:    0.7,
    health:    0.7,
    study:     0.6,
  },

  "astro.aspect.jupiter.sextile": {
    wealth:    0.6,
    career:    0.5,
    relations: 0.3,
    health:    0.3,
  },

  "astro.aspect.jupiter.square": {
    wealth:    -0.4,
    health:    -0.2,
    career:    -0.2,
  },

  "astro.aspect.jupiter.opposition": {
    wealth:    -0.5,
    career:    -0.3,
  },

  "astro.aspect.jupiter.conjunction": {
    wealth:    0.8,
    career:    0.6,
  },

  "astro.aspect.jupiter.semisquare": {
    wealth:    -0.2,
    career:    -0.1,
  },

  "astro.aspect.jupiter.quincunx": {
    wealth:    -0.3,
    relations: -0.2,
  },

  // ── Astro: Saturn (7) ──────────────────────────────────────────────────────

  "astro.aspect.saturn.trine": {
    career:    0.7,
    study:     0.7,
    health:    0.4,
  },

  "astro.aspect.saturn.sextile": {
    career:    0.5,
    study:     0.4,
    health:    0.3,
  },

  "astro.aspect.saturn.square": {
    health:    -0.9,
    career:    -0.5,
  },

  "astro.aspect.saturn.opposition": {
    health:    -0.8,
    career:    -0.6,
  },

  "astro.aspect.saturn.conjunction": {
    career:    0.4,
    health:    -0.3,
  },

  "astro.aspect.saturn.semisquare": {
    health:    -0.4,
    career:    -0.3,
    relations: -0.2,
  },

  "astro.aspect.saturn.quincunx": {
    health:    -0.5,
    career:    -0.3,
  },

  // ── Astro: Chiron (7) ──────────────────────────────────────────────────────

  "astro.aspect.chiron.trine": {
    health:    0.6,
    study:     0.4,
  },

  "astro.aspect.chiron.sextile": {
    health:    0.4,
    relations: 0.3,
    love:      0.2,
  },

  "astro.aspect.chiron.square": {
    health:    -0.7,
    relations: -0.3,
    love:      -0.3,
  },

  "astro.aspect.chiron.opposition": {
    health:    -0.6,
    relations: -0.3,
  },

  "astro.aspect.chiron.conjunction": {
    health:    0.3,
    study:     0.2,
  },

  "astro.aspect.chiron.semisquare": {
    health:    -0.3,
    relations: -0.2,
  },

  "astro.aspect.chiron.quincunx": {
    health:    -0.4,
    study:     -0.2,
  },

  // ── Saju Special Stars (신살) ────────────────────────────────────────────

  "saju.star.doHwa": {
    love:      0.7,
    relations: 0.5,
  },

  "saju.star.cheonDeok": {
    love:      0.4,
    health:    0.5,
    relations: 0.4,
  },

  "saju.star.wolDeok": {
    love:      0.5,
    health:    0.5,
    relations: 0.4,
  },

  // ── Saju 12운성 (Twelve States) ──────────────────────────────────────────

  "saju.twelveState.jangSaeng": {
    health:    0.6,
  },

  "saju.twelveState.geonRok": {
    health:    0.6,
  },

  "saju.twelveState.jeWang": {
    health:    0.7,
  },

  "saju.twelveState.yang": {
    health:    0.5,
    relations: 0.3,
  },

  "saju.twelveState.gwanDae": {
    career:    0.5,
    study:     0.4,
  },

  "saju.twelveState.mokYok": {
    love:      0.4,
    relations: 0.3,
  },

  "saju.twelveState.tae": {
    study:     0.3,
    career:    0.3,
  },
};

// 검증
const totalEvents = Object.keys(EVENT_CATEGORY_MAP).length;
console.log(`[EVENT_CATEGORY_MAP] Defined ${totalEvents} event → category mappings`);
