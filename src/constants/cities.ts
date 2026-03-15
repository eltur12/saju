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
