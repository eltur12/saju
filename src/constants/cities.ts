export interface KoreanCity {
  name: string;
  lat: number;
  lon: number;
}

export const KOREAN_CITIES: KoreanCity[] = [
  { name: "서울",   lat: 37.5665, lon: 126.9780 },
  { name: "인천",   lat: 37.4563, lon: 126.7052 },
  { name: "수원",   lat: 37.2636, lon: 127.0286 },
  { name: "춘천",   lat: 37.8813, lon: 127.7298 },
  { name: "강릉",   lat: 37.7519, lon: 128.8761 },
  { name: "청주",   lat: 36.6424, lon: 127.4890 },
  { name: "대전",   lat: 36.3504, lon: 127.3845 },
  { name: "전주",   lat: 35.8242, lon: 127.1480 },
  { name: "광주",   lat: 35.1595, lon: 126.8526 },
  { name: "대구",   lat: 35.8714, lon: 128.6014 },
  { name: "울산",   lat: 35.5384, lon: 129.3114 },
  { name: "포항",   lat: 36.0190, lon: 129.3435 },
  { name: "창원",   lat: 35.2280, lon: 128.6811 },
  { name: "부산",   lat: 35.1796, lon: 129.0756 },
  { name: "제주",   lat: 33.4996, lon: 126.5312 },
];

export function getCityByName(name: string): KoreanCity {
  return KOREAN_CITIES.find(c => c.name === name) ?? KOREAN_CITIES[0];
}

// ── Birth region list — used for solar-time correction in Saju calculation ──

export interface BirthRegion {
  id: string;
  name: string;
  longitude: number;
}

export const BIRTH_REGIONS: BirthRegion[] = [
  { id: "seoul",   name: "서울",   longitude: 126.9780 },
  { id: "incheon", name: "인천",   longitude: 126.7052 },
  { id: "suwon",   name: "수원",   longitude: 127.0286 },
  { id: "daejeon", name: "대전",   longitude: 127.3845 },
  { id: "gwangju", name: "광주",   longitude: 126.8526 },
  { id: "jeonju",  name: "전주",   longitude: 127.1480 },
  { id: "daegu",   name: "대구",   longitude: 128.6014 },
  { id: "busan",   name: "부산",   longitude: 129.0756 },
  { id: "ulsan",   name: "울산",   longitude: 129.3114 },
  { id: "pohang",  name: "포항",   longitude: 129.3435 },
  { id: "jeju",    name: "제주",   longitude: 126.5312 },
];

export function getBirthRegionById(id: string): BirthRegion {
  return BIRTH_REGIONS.find(r => r.id === id) ?? BIRTH_REGIONS[0];
}
