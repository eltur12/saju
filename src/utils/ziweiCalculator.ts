/**
 * ZiweiChart (orrery) → ZiweiProfile (ziweiEngine) 변환
 */
import { createChart, calculateLiunian } from '../lib/orrery/ziwei';
import type { ZiweiChart } from '../lib/orrery/types';
import type { ZiweiProfile } from '../engines/ziweiEngine';

const MAIN_STAR_NAMES = new Set([
  '紫微','天機','太陽','武曲','天同','廉貞',
  '天府','太陰','貪狼','巨門','天相','天梁','七殺','破軍',
]);
const LUCKY_STAR_NAMES = new Set([
  '祿存','左輔','右弼','文昌','文曲','天魁','天鉞','天馬',
]);
const UNLUCKY_STAR_NAMES = new Set([
  '擎羊','陀羅','火星','鈴星','地空','地劫',
]);

export function ziweiChartToProfile(chart: ZiweiChart, currentYear: number): ZiweiProfile {
  const palaces: ZiweiProfile['palaces'] = {};
  const sihua: ZiweiProfile['sihua'] = {};

  for (const [palaceName, palace] of Object.entries(chart.palaces)) {
    const main_stars: string[] = [];
    const lucky_stars: string[] = [];
    const unlucky_stars: string[] = [];

    for (const star of palace.stars) {
      if (MAIN_STAR_NAMES.has(star.name))        main_stars.push(star.name);
      else if (LUCKY_STAR_NAMES.has(star.name))   lucky_stars.push(star.name);
      else if (UNLUCKY_STAR_NAMES.has(star.name)) unlucky_stars.push(star.name);

      if (star.siHua) {
        sihua[star.siHua] = { palace: palaceName, star: star.name };
      }
    }

    palaces[palaceName] = { main_stars, lucky_stars, unlucky_stars };
  }

  // 현재 대한 궁 이름
  const liunian = calculateLiunian(chart, currentYear);
  const current_dahan = liunian.daxianPalaceName;

  // 대한 궁의 주성 목록
  const dahanPalace = chart.palaces[current_dahan];
  const dahan_stars = dahanPalace
    ? dahanPalace.stars.filter(s => MAIN_STAR_NAMES.has(s.name)).map(s => s.name)
    : [];

  // 유월(流月): 각 달의 활성 궁 이름 [0=1월 .. 11=12월]
  const monthly_palaces = liunian.liuyue.map(ly => ly.natalPalaceName);

  // 유년 사화(流年四化): 化祿·化權·化科·化忌 → 궁 이름
  const year_sihua_palaces = liunian.siHuaPalaces ?? {};

  return { palaces, sihua, current_dahan, dahan_stars, monthly_palaces, year_sihua_palaces };
}

export function buildZiweiProfile(
  birthYear: number, birthMonth: number, birthDay: number,
  birthHour: number, currentYear: number, isMale: boolean,
): ZiweiProfile {
  const chart = createChart(birthYear, birthMonth, birthDay, birthHour, 0, isMale);
  return ziweiChartToProfile(chart, currentYear);
}
