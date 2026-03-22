/**
 * 사주 계산 — @orrery/core pillars 기반 (정확한 절기/입춘 기준)
 */
import { calculateSaju as orreryCalcSaju } from '../lib/orrery/saju';
import type { SajuEngineProfile } from '../engines/sajuEngine';

/** 현재 나이에 해당하는 대운 찾기 — orrery DaewoonItem.age 필드 사용 */
function findCurrentDaewoon(
  daewoon: { ganzi: string; age: number }[],
  birthYear: number,
): { stem: string; branch: string } {
  const currentAge = new Date().getFullYear() - birthYear;

  let current = daewoon[0];
  for (const dw of daewoon) {
    if (dw.age <= currentAge) current = dw;
    else break;
  }
  return { stem: current.ganzi[0], branch: current.ganzi[1] };
}

/** orrery SpecialSals + 각 주의 12신살 → 특별신살 문자열 배열 */
function mapSpecialSals(
  sals: { baekho: boolean; dohwa: number[]; cheonduk: number[]; wolduk: number[] },
  sinsalNames: string[],
): string[] {
  const result: string[] = [];
  if (sals.baekho)          result.push('백호살');
  if (sals.dohwa.length)    result.push('도화살');
  if (sals.cheonduk.length) result.push('천덕귀인');
  if (sals.wolduk.length)   result.push('월덕귀인');
  // 12신살에서 겁살·역마살·화개살 탐색 (orrery는 한자 반환: 劫殺·驛馬·華蓋)
  if (sinsalNames.some(s => s === '劫殺')) result.push('겁살');
  if (sinsalNames.some(s => s === '驛馬')) result.push('역마살');
  if (sinsalNames.some(s => s === '華蓋')) result.push('화개살');
  return result;
}

export function calculateSajuProfile(
  birthYear:  number,
  birthMonth: number,
  birthDay:   number,
  birthHour?: number,
  gender: 'M' | 'F' = 'M',
): SajuEngineProfile {
  const hour   = birthHour ?? 12;
  const result = orreryCalcSaju({
    year: birthYear, month: birthMonth, day: birthDay,
    hour, minute: 0, gender,
  });

  // pillars 순서: [시주(0), 일주(1), 월주(2), 년주(3)]
  const [hp, dp, mp, yp] = result.pillars;

  const { stem: dayunStem, branch: dayunBranch } =
    findCurrentDaewoon(result.daewoon, birthYear);

  return {
    day_stem:      dp.pillar.stem,
    month_stem:    mp.pillar.stem,
    year_stem:     yp.pillar.stem,
    hour_branch:   hp.pillar.branch,
    day_branch:    dp.pillar.branch,
    month_branch:  mp.pillar.branch,
    year_branch:   yp.pillar.branch,
    special_stars: mapSpecialSals(result.specialSals, result.pillars.map(p => p.sinsal)),
    dayun_stem:    dayunStem,
    dayun_branch:  dayunBranch,
  };
}
