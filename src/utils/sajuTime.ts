/**
 * 출생지 경도 기반 진태양시(眞太陽時) 보정 유틸리티
 *
 * KST(UTC+9) 기준 시각을 해당 지역의 경도로 보정한다.
 * 기준 경선: 동경 135도 (= KST 0분 보정 기준)
 * 보정식: correctionMinutes = round((longitude - 135) * 4)
 *
 * 예) 서울(126.978도) → round((126.978 - 135) * 4) = round(-32.09) = -32분
 */
import { BIRTH_REGIONS, getBirthRegionById } from '../constants/cities';

export { BIRTH_REGIONS };

export type NormalizeBirthDateTimeInput = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  regionId?: string;
};

export type NormalizedBirthDateTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  correctionMinutes: number;
  regionId: string;
};

/**
 * 출생 날짜+시각을 출생지 경도로 보정해 반환.
 * 자정 경계를 넘는 경우 날짜도 자동으로 이동한다.
 */
export function normalizeBirthDateTimeByRegion(
  input: NormalizeBirthDateTimeInput,
): NormalizedBirthDateTime {
  const regionId = input.regionId ?? 'seoul';
  const region   = getBirthRegionById(regionId);

  const correctionMinutes = Math.round((region.longitude - 135) * 4);

  // 로컬 Date 생성 — UTC 변환 없이 지역 시각 그대로 사용
  const date = new Date(input.year, input.month - 1, input.day, input.hour, input.minute);
  date.setMinutes(date.getMinutes() + correctionMinutes);

  return {
    year:   date.getFullYear(),
    month:  date.getMonth() + 1,
    day:    date.getDate(),
    hour:   date.getHours(),
    minute: date.getMinutes(),
    correctionMinutes,
    regionId: region.id,
  };
}
