const STORAGE_KEY = 'haruondo_rewarded_status';

type StatusMap = Record<string, boolean>;

function loadMap(): StatusMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StatusMap) : {};
  } catch {
    return {};
  }
}

function saveMap(map: StatusMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/** undefined = 이력 없음, false = 배치 캐시됨(광고 필요), true = 보상 완료 */
export function getRewardedStatus(date: string): boolean | undefined {
  const map = loadMap();
  return date in map ? map[date] : undefined;
}

/** 광고 보상 완료 → true 저장 */
export function markRewarded(date: string): void {
  const map = loadMap();
  map[date] = true;
  saveMap(map);
}

/**
 * 배치 API 완료 후 호출.
 * selectedDate → true, 나머지 캐시된 날짜 중 이력 없는 것 → false
 */
export function markAfterBatch(selectedDate: string, allCachedDates: string[]): void {
  const map = loadMap();
  map[selectedDate] = true;
  for (const d of allCachedDates) {
    if (d !== selectedDate && !(d in map)) {
      map[d] = false;
    }
  }
  saveMap(map);
}
