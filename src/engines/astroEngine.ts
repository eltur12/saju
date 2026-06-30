/**
 * 서양 점성술(Western Astrology) 분석 엔진
 * 트랜짓: Moshier 에페메리스 실계산
 */
import type { ScoreMap } from "./sajuEngine";
import { calcPlanet, julday } from "../lib/orrery/ephemeris/index";

/** swisseph body number 매핑 */
const TRANSIT_PLANET_BODIES: Record<string, number> = {
  "Sun": 0, "Moon": 1, "Mercury": 2, "Venus": 3,
  "Mars": 4, "Jupiter": 5, "Saturn": 6,
};

const ASPECTS: Record<string, { angle: number; orb: number; type: string; nature: string }> = {
  "☌": { angle:0,   orb:8, type:"major",  nature:"neutral" },
  "☍": { angle:180, orb:8, type:"major",  nature:"tense"   },
  "□": { angle:90,  orb:6, type:"major",  nature:"tense"   },
  "△": { angle:120, orb:6, type:"major",  nature:"easy"    },
  "⚹": { angle:60,  orb:4, type:"major",  nature:"easy"    },
  "⚻": { angle:150, orb:3, type:"minor",  nature:"tense"   },
  "∠": { angle:45,  orb:2, type:"minor",  nature:"tense"   },
};

/**
 * 어스펙트 강도 산출 — 규칙서 구간별 값
 * 합(☌): 0~1°→10, 1~3°→7, 3~6°→5, 6°+→3
 * 삼각(△): 0~1°→8, 1~3°→6, 3~6°→4
 * 스퀘어(□): 0~1°→-8, 1~3°→-6, 3~6°→-4
 * 육분(⚹): 1~3°→4
 * 퀸컨스(⚻): 1~3°→-3
 */
function aspectStrength(symbol: string, orb: number): number {
  switch (symbol) {
    case "☌":
      if (orb <= 1) return 10;
      if (orb <= 3) return 7;
      if (orb <= 6) return 5;
      return 3;
    case "△":
      if (orb <= 1) return 8;
      if (orb <= 3) return 6;
      return 4;
    case "□":
      if (orb <= 1) return -8;
      if (orb <= 3) return -6;
      return -4;
    case "⚹":
      return orb <= 3 ? 4 : 2;
    case "⚻":
      return orb <= 3 ? -3 : -2;
    case "∠":
      return orb <= 2 ? -3 : -2;
    case "☍":
      if (orb <= 3) return -8;
      return -5;
    default:
      return 0;
  }
}

/**
 * 행성별 도메인 친화도
 */
const PLANET_AFFINITY: Record<string, ScoreMap> = {
  "Sun":      { overall:1.0, wealth:0.7, love:0.5, health:0.8, career:1.0,  relations:0.6, study:0.7 },
  "Moon":     { overall:0.8, wealth:0.5, love:1.2, health:1.0, career:0.5,  relations:0.7, study:0.4 },
  "Mercury":  { overall:0.7, wealth:0.7, love:0.5, health:0.5, career:0.8,  relations:1.0, study:0.8 },
  "Venus":    { overall:0.8, wealth:0.8, love:1.5, health:0.7, career:0.6,  relations:1.0, study:0.4 },
  "Mars":     { overall:0.8, wealth:0.7, love:0.7, health:0.8, career:1.0,  relations:0.5, study:0.5 },
  "Jupiter":  { overall:1.0, wealth:1.2, love:0.8, health:0.8, career:1.0,  relations:0.8, study:1.0 },
  "Saturn":   { overall:0.7, wealth:0.7, love:0.5, health:0.7, career:0.8,  relations:0.5, study:0.8 },
  "Uranus":   { overall:0.6, wealth:0.6, love:0.5, health:0.5, career:0.7,  relations:0.5, study:0.8 },
  "Neptune":  { overall:0.5, wealth:0.4, love:0.8, health:0.5, career:0.4,  relations:0.5, study:0.6 },
  "Pluto":    { overall:0.5, wealth:0.6, love:0.5, health:0.6, career:0.6,  relations:0.4, study:0.4 },
  "NorthNode":{ overall:0.6, wealth:0.5, love:0.6, health:0.4, career:0.7,  relations:0.6, study:0.7 },
  "Chiron":   { overall:0.5, wealth:0.3, love:0.7, health:0.8, career:0.4,  relations:0.5, study:0.6 },
};

const DEFAULT_AFFINITY: ScoreMap = { overall:0.5, wealth:0.5, love:0.5, health:0.5, career:0.5, relations:0.5, study:0.5 };

/**
 * 하우스별 도메인 가중치
 * 1: 전반·건강  2: 금전  3: 소통·공부  4: 가정·안정
 * 5: 연애·창의·공부  6: 건강·직장  7: 연애·대인관계
 * 8: 변화·재물  9: 공부·철학  10: 직장·명예
 * 11: 인맥·목표  12: 건강(숨겨진)·고립
 */
const HOUSE_WEIGHT: Record<number, ScoreMap> = {
  1:  { overall:1.0, wealth:0.5, love:0.5, health:0.8, career:0.7, relations:0.5, study:0.4 },
  2:  { overall:0.5, wealth:1.5, love:0.3, health:0.3, career:0.5, relations:0.3, study:0.2 },
  3:  { overall:0.5, wealth:0.5, love:0.5, health:0.3, career:0.7, relations:0.7, study:1.0 },
  4:  { overall:0.5, wealth:0.7, love:0.7, health:0.5, career:0.3, relations:0.5, study:0.3 },
  5:  { overall:0.5, wealth:0.5, love:1.2, health:0.5, career:0.5, relations:0.5, study:0.8 },
  6:  { overall:0.5, wealth:0.5, love:0.3, health:1.5, career:0.7, relations:0.4, study:0.4 },
  7:  { overall:0.5, wealth:0.5, love:1.5, health:0.3, career:0.5, relations:1.2, study:0.3 },
  8:  { overall:0.5, wealth:0.8, love:0.5, health:0.5, career:0.3, relations:0.4, study:0.3 },
  9:  { overall:0.7, wealth:0.5, love:0.3, health:0.3, career:0.9, relations:0.4, study:1.0 },
  10: { overall:0.7, wealth:0.8, love:0.3, health:0.3, career:1.5, relations:0.5, study:0.5 },
  11: { overall:0.7, wealth:0.5, love:0.8, health:0.3, career:0.8, relations:1.2, study:0.5 },
  12: { overall:0.2, wealth:-0.2, love:-0.2, health:0.3, career:-0.3, relations:-0.2, study:0.2 },
};

export interface NatalPlanet { lon: number; house: number }
export interface NatalAspect { p1: string; p2: string; aspect: string; orb: number }

export interface AstroProfile {
  natal_planets: Record<string, NatalPlanet>;
  natal_aspects: NatalAspect[];
  planet_houses: Record<string, number>;
  /** 금성 역행 기간 여부 */
  venus_retrograde?: boolean;
}

function zeroScore(): ScoreMap {
  return { overall:0, wealth:0, love:0, health:0, career:0, relations:0, study:0 };
}

export class AstrologyEngine {
  private natal_planets: Record<string, NatalPlanet>;
  private natal_aspects: NatalAspect[];
  private planet_houses: Record<string, number>;
  private venus_retrograde: boolean;

  constructor(p: AstroProfile) {
    this.natal_planets    = p.natal_planets;
    this.natal_aspects    = p.natal_aspects;
    this.planet_houses    = p.planet_houses;
    this.venus_retrograde = p.venus_retrograde ?? false;
  }

  private natalBaseScores(): ScoreMap {
    const scores = zeroScore();

    // 출생 어스펙트
    for (const asp of this.natal_aspects) {
      const aspData = ASPECTS[asp.aspect];
      if (!aspData) continue;
      const strength = aspectStrength(asp.aspect, asp.orb);
      const affinity = PLANET_AFFINITY[asp.p1] ?? DEFAULT_AFFINITY;
      const keys = Object.keys(scores) as (keyof ScoreMap)[];
      keys.forEach(k => {
        scores[k] += Math.trunc(strength * affinity[k]);
      });
    }

    // 행성 하우스 위치
    for (const [planet, house] of Object.entries(this.planet_houses)) {
      const hw = HOUSE_WEIGHT[house] ?? DEFAULT_AFFINITY;
      const affinity = PLANET_AFFINITY[planet] ?? DEFAULT_AFFINITY;
      const keys = Object.keys(scores) as (keyof ScoreMap)[];
      keys.forEach(k => {
        scores[k] += Math.trunc(5 * hw[k] * affinity[k]);
      });
    }

    return scores;
  }

  /** targetDate(KST 날짜) → Julian Day (정오 KST = 03:00 UT) */
  private dateToJD(date: Date): number {
    return julday(date.getFullYear(), date.getMonth() + 1, date.getDate(), 3.0);
  }

  private calcTransitAspects(targetDate: Date) {
    const jd = this.dateToJD(targetDate);
    const activeAspects: { transit_planet: string; natal_planet: string; aspect: string; orb: number; nature: string }[] = [];
    const transitPositions: Record<string, number> = {};
    let transitVenusRetrograde = false;

    for (const [planet, bodyNum] of Object.entries(TRANSIT_PLANET_BODIES)) {
      const pos = calcPlanet(jd, bodyNum);
      transitPositions[planet] = Math.round(pos.longitude * 10) / 10;
      const transitLon = pos.longitude;
      if (planet === 'Venus') transitVenusRetrograde = pos.longitudeSpeed < 0;

      for (const [natalPlanet, natalData] of Object.entries(this.natal_planets)) {
        let diff = Math.abs(transitLon - natalData.lon) % 360;
        if (diff > 180) diff = 360 - diff;

        for (const [aspSymbol, aspData] of Object.entries(ASPECTS)) {
          const actualOrb = Math.abs(diff - aspData.angle);
          if (actualOrb <= aspData.orb) {
            activeAspects.push({
              transit_planet: planet,
              natal_planet:   natalPlanet,
              aspect:         aspSymbol,
              orb:            actualOrb,
              nature:         aspData.nature,
            });
          }
        }
      }
    }
    return { activeAspects, transitPositions, transitVenusRetrograde };
  }

  calculate(targetDate: Date, _birthDate?: Date): { scores: ScoreMap; factors: Record<string, unknown>; contributions: { key: string; value: number }[] } {
    const scores = this.natalBaseScores();
    const { activeAspects, transitPositions, transitVenusRetrograde } = this.calcTransitAspects(targetDate);
    const activeSummary: string[] = [];
    const _aspContribs: { key: string; value: number }[] = [];
    const _D6 = ["wealth", "love", "health", "career", "relations", "study"] as const;

    for (const asp of activeAspects) {
      const strength = aspectStrength(asp.aspect, asp.orb);
      const affinity = PLANET_AFFINITY[asp.transit_planet] ?? DEFAULT_AFFINITY;
      const delta6 = _D6.reduce((s, k) => s + Math.trunc(strength * affinity[k] * 0.5), 0) / 6;
      _aspContribs.push({
        key:   `${asp.transit_planet} ${asp.aspect} natal ${asp.natal_planet} (orb ${asp.orb.toFixed(1)}°)`,
        value: delta6,
      });
      const keys = Object.keys(scores) as (keyof ScoreMap)[];
      keys.forEach(k => {
        scores[k] += Math.trunc(strength * affinity[k] * 0.5);
      });
      if (asp.orb < 2.0) {
        activeSummary.push(`${asp.transit_planet} ${asp.aspect} natal ${asp.natal_planet} (orb ${asp.orb.toFixed(1)}°)`);
      }
    }

    // 출생 금성 역행: 연애·금전 -5 (평생 적용)
    if (this.venus_retrograde) {
      scores.love   -= 5;
      scores.wealth -= 5;
    }

    // 트랜짓 금성 역행: 연애 -5, 금전 -3
    if (transitVenusRetrograde) {
      scores.love   -= 5;
      scores.wealth -= 3;
      _aspContribs.push({ key: "venus_retrograde_transit", value: (-5 + -3) / 6 });
    }

    // 연도별 트랜짓 고정 보정 (토성·목성 장기 트랜짓)
    const y = targetDate.getFullYear();
    const m = targetDate.getMonth() + 1;
    if (y === 2026) {
      // 토성 트랜짓 건강·직장 페널티 (2026 전체)
      scores.health -= 6;
      scores.career -= 3;
      // 목성 트랜짓 재물 보너스 (2026 상반기)
      if (m <= 6) scores.wealth += 3;
    }

    return {
      scores,
      factors: {
        active_transit_aspects:    activeSummary.slice(0, 5),
        total_transit_aspects:     activeAspects.length,
        natal_aspect_count:        this.natal_aspects.length,
        transit_positions:         transitPositions,
        venus_retrograde_natal:    this.venus_retrograde,
        venus_retrograde_transit:  transitVenusRetrograde,
      },
      contributions: _aspContribs,
    };
  }
}

/** 1998-01-22 12:10 Seoul (남) 검증된 원국 — Swiss Ephemeris 대조 완료 */
export const SAMPLE_ASTRO_PROFILE: AstroProfile = {
  natal_planets: {
    "Sun":      { lon:301.89, house:10 }, "Moon":     { lon:226.32, house:7  },
    "Mercury":  { lon:282.74, house:9  }, "Venus":    { lon:292.77, house:9  },
    "Mars":     { lon:327.43, house:11 }, "Jupiter":  { lon:326.90, house:11 },
    "Saturn":   { lon:14.74,  house:12 }, "Uranus":   { lon:308.32, house:11 },
    "Neptune":  { lon:299.74, house:10 }, "Pluto":    { lon:247.41, house:8  },
    "Chiron":   { lon:227.36, house:7  }, "NorthNode":{ lon:162.61, house:5  },
  },
  natal_aspects: [
    { p1:"Mercury",  p2:"NorthNode", aspect:"△", orb:0.1 },
    { p1:"Mars",     p2:"Jupiter",   aspect:"☌", orb:0.5 },
    { p1:"Uranus",   p2:"Pluto",     aspect:"⚹", orb:0.9 },
    { p1:"Moon",     p2:"Chiron",    aspect:"☌", orb:1.0 },
    { p1:"Mercury",  p2:"Saturn",    aspect:"□", orb:2.0 },
    { p1:"Sun",      p2:"Neptune",   aspect:"☌", orb:2.1 },
    { p1:"Moon",     p2:"Mercury",   aspect:"⚹", orb:3.6 },
    { p1:"Venus",    p2:"Chiron",    aspect:"⚹", orb:5.4 },
    { p1:"Sun",      p2:"Pluto",     aspect:"⚹", orb:5.5 },
    { p1:"Sun",      p2:"Uranus",    aspect:"☌", orb:6.4 },
    { p1:"Venus",    p2:"Neptune",   aspect:"☌", orb:7.0 },
    { p1:"Saturn",   p2:"Pluto",     aspect:"△", orb:7.3 },
  ],
  planet_houses: {
    "Sun":10, "Moon":7, "Mercury":9, "Venus":9, "Mars":11, "Jupiter":11,
    "Saturn":12, "Uranus":11, "Neptune":10, "Pluto":8, "Chiron":7, "NorthNode":5,
  },
  venus_retrograde: true,
};

export function buildAstroEngineFromProfile(profile: AstroProfile): AstrologyEngine {
  return new AstrologyEngine(profile);
}
