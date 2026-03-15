/**
 * NatalChart (orrery) → AstroProfile (astroEngine) 변환
 */
import { calculateNatal } from '../lib/orrery/natal';
import type { NatalChart } from '../lib/orrery/types';
import type { AstroProfile } from '../engines/astroEngine';

const ASPECT_TYPE_TO_SYMBOL: Record<string, string> = {
  conjunction: '☌',
  opposition:  '☍',
  square:      '□',
  trine:       '△',
  sextile:     '⚹',
};

export function natalChartToAstroProfile(chart: NatalChart): AstroProfile {
  const natal_planets: AstroProfile['natal_planets'] = {};
  const planet_houses: AstroProfile['planet_houses'] = {};

  for (const planet of chart.planets) {
    if (planet.id === 'SouthNode') continue;
    natal_planets[planet.id] = { lon: planet.longitude, house: planet.house ?? 1 };
    planet_houses[planet.id] = planet.house ?? 1;
  }

  const natal_aspects: AstroProfile['natal_aspects'] = chart.aspects
    .filter(asp => asp.planet1 !== 'SouthNode' && asp.planet2 !== 'SouthNode')
    .map(asp => ({
      p1:     asp.planet1,
      p2:     asp.planet2,
      aspect: ASPECT_TYPE_TO_SYMBOL[asp.type] ?? '☌',
      orb:    asp.orb,
    }));

  return { natal_planets, natal_aspects, planet_houses };
}

export async function buildAstroProfile(
  birthYear: number, birthMonth: number, birthDay: number,
  birthHour?: number, latitude?: number, longitude?: number,
): Promise<AstroProfile> {
  const chart = await calculateNatal({
    year:        birthYear,
    month:       birthMonth,
    day:         birthDay,
    hour:        birthHour ?? 12,
    minute:      0,
    gender:      'M',
    unknownTime: birthHour === undefined,
    latitude,
    longitude,
  });
  return natalChartToAstroProfile(chart);
}
