/**
 * 서양 점성술(Western Astrology) 분석 엔진
 * 트랜짓: Moshier 에페메리스 실계산 (선형 근사 제거)
 */
import type { ScoreMap } from "./sajuEngine";
import { calcPlanet, julday } from "../lib/orrery/ephemeris/index";

/** swisseph body number 매핑 */
const TRANSIT_PLANET_BODIES: Record<string, number> = {
  "Sun": 0, "Moon": 1, "Mercury": 2, "Venus": 3,
  "Mars": 4, "Jupiter": 5, "Saturn": 6,
};

const ASPECTS: Record<string, { angle: number; orb: number; type: string; nature: string }> = {
  "☌":{"angle":0,"orb":8,"type":"major","nature":"neutral"},
  "☍":{"angle":180,"orb":8,"type":"major","nature":"tense"},
  "□":{"angle":90,"orb":6,"type":"major","nature":"tense"},
  "△":{"angle":120,"orb":6,"type":"major","nature":"easy"},
  "⚹":{"angle":60,"orb":4,"type":"major","nature":"easy"},
  "⚻":{"angle":150,"orb":3,"type":"minor","nature":"tense"},
  "∠":{"angle":45,"orb":2,"type":"minor","nature":"tense"},
};

const ASPECT_INFLUENCE: Record<string, Record<string, ScoreMap>> = {
  "easy":{
    "☌":{"overall":8,"wealth":6,"love":8,"health":5,"career":8},
    "△":{"overall":10,"wealth":8,"love":10,"health":7,"career":8},
    "⚹":{"overall":6,"wealth":6,"love":6,"health":5,"career":6},
  },
  "tense":{
    "☍":{"overall":-8,"wealth":-6,"love":-8,"health":-5,"career":-8},
    "□":{"overall":-7,"wealth":-5,"love":-6,"health":-5,"career":-7},
    "⚻":{"overall":-4,"wealth":-3,"love":-4,"health":-3,"career":-4},
    "∠":{"overall":-3,"wealth":-2,"love":-3,"health":-2,"career":-3},
  },
  "neutral":{
    "☌":{"overall":5,"wealth":4,"love":5,"health":3,"career":5},
  },
};

const PLANET_AFFINITY: Record<string, ScoreMap> = {
  "Sun":{"overall":1.0,"wealth":0.7,"love":0.5,"health":0.8,"career":1.0},
  "Moon":{"overall":0.8,"wealth":0.5,"love":1.2,"health":1.0,"career":0.5},
  "Mercury":{"overall":0.7,"wealth":0.7,"love":0.5,"health":0.5,"career":0.8},
  "Venus":{"overall":0.8,"wealth":0.8,"love":1.5,"health":0.7,"career":0.6},
  "Mars":{"overall":0.8,"wealth":0.7,"love":0.7,"health":0.8,"career":1.0},
  "Jupiter":{"overall":1.0,"wealth":1.2,"love":0.8,"health":0.8,"career":1.0},
  "Saturn":{"overall":0.7,"wealth":0.7,"love":0.5,"health":0.7,"career":0.8},
  "Uranus":{"overall":0.6,"wealth":0.6,"love":0.5,"health":0.5,"career":0.7},
  "Neptune":{"overall":0.5,"wealth":0.4,"love":0.8,"health":0.5,"career":0.4},
  "Pluto":{"overall":0.5,"wealth":0.6,"love":0.5,"health":0.6,"career":0.6},
  "NorthNode":{"overall":0.6,"wealth":0.5,"love":0.6,"health":0.4,"career":0.7},
};

const HOUSE_WEIGHT: Record<number, ScoreMap> = {
  1:{"overall":1.0,"wealth":0.5,"love":0.5,"health":0.8,"career":0.7},
  2:{"overall":0.5,"wealth":1.5,"love":0.3,"health":0.3,"career":0.5},
  3:{"overall":0.5,"wealth":0.5,"love":0.5,"health":0.3,"career":0.7},
  4:{"overall":0.5,"wealth":0.7,"love":0.7,"health":0.5,"career":0.3},
  5:{"overall":0.5,"wealth":0.5,"love":1.2,"health":0.5,"career":0.5},
  6:{"overall":0.5,"wealth":0.5,"love":0.3,"health":1.5,"career":0.7},
  7:{"overall":0.5,"wealth":0.5,"love":1.5,"health":0.3,"career":0.5},
  8:{"overall":0.5,"wealth":0.8,"love":0.5,"health":0.5,"career":0.3},
  9:{"overall":0.7,"wealth":0.5,"love":0.3,"health":0.3,"career":0.7},
  10:{"overall":0.7,"wealth":0.8,"love":0.3,"health":0.3,"career":1.5},
  11:{"overall":0.7,"wealth":0.5,"love":0.8,"health":0.3,"career":0.8},
  12:{"overall":0.2,"wealth":-0.2,"love":-0.2,"health":0.3,"career":-0.3},
};

export interface NatalPlanet { lon: number; house: number }
export interface NatalAspect { p1: string; p2: string; aspect: string; orb: number }

export interface AstroProfile {
  natal_planets: Record<string, NatalPlanet>;
  natal_aspects: NatalAspect[];
  planet_houses: Record<string, number>;
}

export class AstrologyEngine {
  private natal_planets: Record<string, NatalPlanet>;
  private natal_aspects: NatalAspect[];
  private planet_houses: Record<string, number>;

  constructor(p: AstroProfile) {
    this.natal_planets = p.natal_planets;
    this.natal_aspects = p.natal_aspects;
    this.planet_houses = p.planet_houses;
  }

  private natalBaseScores(): ScoreMap {
    const scores: ScoreMap = { overall: 0, wealth: 0, love: 0, health: 0, career: 0 };

    for (const asp of this.natal_aspects) {
      const aspData = ASPECTS[asp.aspect];
      if (!aspData) continue;
      const strength = Math.max(0.2, 1.0 - (asp.orb / aspData.orb) * 0.8);
      const affinity = PLANET_AFFINITY[asp.p1] ?? { overall: 0.5, wealth: 0.5, love: 0.5, health: 0.5, career: 0.5 };
      const influenceMap = ASPECT_INFLUENCE[aspData.nature]?.[asp.aspect] ?? {};
      (Object.keys(scores) as (keyof ScoreMap)[]).forEach(k => {
        scores[k] += Math.trunc((influenceMap[k] ?? 0) * strength * affinity[k]);
      });
    }

    for (const [planet, house] of Object.entries(this.planet_houses)) {
      const hw = HOUSE_WEIGHT[house] ?? { overall: 0.5, wealth: 0.5, love: 0.5, health: 0.5, career: 0.5 };
      const affinity = PLANET_AFFINITY[planet] ?? { overall: 0.5, wealth: 0.5, love: 0.5, health: 0.5, career: 0.5 };
      (Object.keys(scores) as (keyof ScoreMap)[]).forEach(k => {
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

    for (const [planet, bodyNum] of Object.entries(TRANSIT_PLANET_BODIES)) {
      const pos = calcPlanet(jd, bodyNum);
      transitPositions[planet] = Math.round(pos.longitude * 10) / 10;
      const transitLon = pos.longitude;

      for (const [natalPlanet, natalData] of Object.entries(this.natal_planets)) {
        let diff = Math.abs(transitLon - natalData.lon) % 360;
        if (diff > 180) diff = 360 - diff;

        for (const [aspSymbol, aspData] of Object.entries(ASPECTS)) {
          const actualOrb = Math.abs(diff - aspData.angle);
          if (actualOrb <= aspData.orb) {
            activeAspects.push({ transit_planet: planet, natal_planet: natalPlanet, aspect: aspSymbol, orb: actualOrb, nature: aspData.nature });
          }
        }
      }
    }
    return { activeAspects, transitPositions };
  }

  calculate(targetDate: Date, _birthDate?: Date): { scores: ScoreMap; factors: Record<string, unknown> } {
    const scores = this.natalBaseScores();
    const { activeAspects, transitPositions } = this.calcTransitAspects(targetDate);
    const activeSummary: string[] = [];

    for (const asp of activeAspects) {
      const aspData = ASPECTS[asp.aspect];
      if (!aspData) continue;
      const strength = Math.max(0.2, 1.0 - (asp.orb / aspData.orb) * 0.8);
      const affinity = PLANET_AFFINITY[asp.transit_planet] ?? { overall: 0.5, wealth: 0.5, love: 0.5, health: 0.5, career: 0.5 };
      const influenceMap = ASPECT_INFLUENCE[asp.nature]?.[asp.aspect] ?? {};
      (Object.keys(scores) as (keyof ScoreMap)[]).forEach(k => {
        scores[k] += Math.trunc((influenceMap[k] ?? 0) * strength * affinity[k] * 0.5);
      });
      if (asp.orb < 2.0) {
        activeSummary.push(`${asp.transit_planet} ${asp.aspect} natal ${asp.natal_planet} (orb ${asp.orb.toFixed(1)}°)`);
      }
    }

    return {
      scores,
      factors: {
        active_transit_aspects: activeSummary.slice(0, 5),
        total_transit_aspects: activeAspects.length,
        natal_aspect_count: this.natal_aspects.length,
        transit_positions: transitPositions,
      },
    };
  }
}

export const SAMPLE_ASTRO_PROFILE: AstroProfile = {
  natal_planets: {
    "Sun":{"lon":301.88,"house":10},"Moon":{"lon":226.40,"house":7},
    "Mercury":{"lon":282.73,"house":9},"Venus":{"lon":292.77,"house":9},
    "Mars":{"lon":327.43,"house":11},"Jupiter":{"lon":326.88,"house":11},
    "Saturn":{"lon":14.73,"house":12},"Uranus":{"lon":308.32,"house":11},
    "Neptune":{"lon":299.73,"house":10},"Pluto":{"lon":247.40,"house":8},
    "NorthNode":{"lon":162.60,"house":5},
  },
  natal_aspects: [
    {"p1":"Mercury","p2":"NorthNode","aspect":"△","orb":0.1},
    {"p1":"Mars","p2":"Jupiter","aspect":"☌","orb":0.5},
    {"p1":"Moon","p2":"Chiron","aspect":"☌","orb":0.9},
    {"p1":"Uranus","p2":"Pluto","aspect":"⚹","orb":0.9},
    {"p1":"Mercury","p2":"Saturn","aspect":"□","orb":2.0},
    {"p1":"Sun","p2":"Neptune","aspect":"☌","orb":2.1},
    {"p1":"Moon","p2":"Mercury","aspect":"⚹","orb":3.7},
    {"p1":"Sun","p2":"Uranus","aspect":"☌","orb":6.4},
    {"p1":"Venus","p2":"Neptune","aspect":"☌","orb":7.0},
  ],
  planet_houses: {
    "Sun":10,"Moon":7,"Mercury":9,"Venus":9,"Mars":11,"Jupiter":11,
    "Saturn":12,"Uranus":11,"Neptune":10,"Pluto":8,"NorthNode":5,
  },
};

export function buildAstroEngineFromProfile(profile: AstroProfile): AstrologyEngine {
  return new AstrologyEngine(profile);
}
