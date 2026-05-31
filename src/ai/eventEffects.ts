/**
 * AI_EVENT_EFFECTS
 *
 * Canonical key → array of Korean experience-description sentences.
 * These sentences describe how the event is felt subjectively by the user.
 * Used as input context to the AI daily interpretation request.
 *
 * Writing rules:
 *   - 체감형: how the user actually feels, not what the event means
 *   - Format: ~할 수 있음 / ~지기 쉬움 / ~처럼 느껴질 수 있음
 *   - No coaching, no explanations, no fortune-telling (기회/행운/성장/성공 forbidden)
 *   - Length: ~15–30 characters per sentence
 *   - 3 sentences per key
 *
 * For astro.aspect.* keys (dynamic), use getAstroEventEffects().
 */

// ── Static effects dictionary ──────────────────────────────────────────────────

export const AI_EVENT_EFFECTS: Record<string, string[]> = {

  // ── saju · ten god ──────────────────────────────────────────────────────────
  "saju.tenGod.siksin": [
    "하고 싶은 말이 자연스럽게 나올 수 있음",
    "먹거나 즐기는 것에 평소보다 마음이 끌리기 쉬움",
    "아이디어가 가볍게 떠오르는 느낌이 들 수 있음",
  ],
  "saju.tenGod.jeongin": [
    "누군가의 말이 평소보다 귀에 잘 들어올 수 있음",
    "새로운 것을 받아들이는 데 거부감이 적어질 수 있음",
    "조용히 혼자 집중하고 싶어지는 순간이 생길 수 있음",
  ],
  "saju.tenGod.sanggwan": [
    "평소보다 말이 많아지고 표현이 직접적으로 나올 수 있음",
    "기존 방식이 답답하게 느껴질 수 있음",
    "감정이 표현으로 바로 나오기 쉬움",
  ],
  "saju.tenGod.jeonggwan": [
    "해야 할 것들이 평소보다 선명하게 보이기 시작할 수 있음",
    "남의 시선이나 평가를 자꾸 돌아보게 될 수 있음",
    "원칙에서 벗어나는 것이 불편하게 느껴질 수 있음",
  ],
  "saju.tenGod.pyeonggwan": [
    "외부 압박이나 경쟁감이 예민하게 느껴질 수 있음",
    "쉬지 못하고 계속 움직이고 싶어질 수 있음",
    "긴장이 올라오면서 집중이 되기 쉬움",
  ],
  "saju.tenGod.pyeongjae": [
    "빠르게 움직이고 싶은 충동이 생길 수 있음",
    "여러 방향에 동시에 관심이 쏠리기 쉬움",
    "현실적인 이득에 감각이 예민해질 수 있음",
  ],
  "saju.tenGod.jeongjae": [
    "눈에 보이는 결과에 더 집중하고 싶어질 수 있음",
    "꼼꼼하게 챙기고 싶은 욕구가 자연스럽게 생길 수 있음",
    "소소하게 쌓이는 것에서 만족감을 느끼기 쉬움",
  ],
  "saju.tenGod.bigyeon": [
    "혼자 해결하고 싶은 마음이 강해질 수 있음",
    "비슷한 처지의 사람에게 동질감이 느껴지는 순간이 있을 수 있음",
    "내 방식대로 하고 싶은 고집이 생기기 쉬움",
  ],
  "saju.tenGod.geobjae": [
    "충동적으로 결정하고 싶은 순간이 생기기 쉬움",
    "경쟁적인 상황에서 감정이 쉽게 올라올 수 있음",
    "지출이나 소비 욕구가 평소보다 커질 수 있음",
  ],
  "saju.tenGod.pyeongin": [
    "머릿속 생각이 혼자서 계속 이어질 수 있음",
    "이유 없이 혼자 있고 싶어질 수 있음",
    "직관적인 감각이 평소보다 예민하게 올 수 있음",
  ],

  // ── saju · branch relation ───────────────────────────────────────────────────
  "saju.branch.clash": [
    "하던 방식이 갑자기 막히는 느낌이 들 수 있음",
    "선택을 빨리 해야 할 것 같은 압박이 올 수 있음",
    "익숙하던 것이 낯설어지는 느낌이 올 수 있음",
  ],
  "saju.branch.sixHarmony": [
    "주변 사람이 자연스럽게 마음에 들어올 수 있음",
    "대화가 편하게 이어지는 느낌이 들 수 있음",
    "함께하는 것이 혼자보다 편하게 느껴질 수 있음",
  ],
  "saju.branch.trine": [
    "하고 있는 일이 리듬을 타는 느낌이 들 수 있음",
    "에너지가 한 방향으로 모이는 것처럼 느껴질 수 있음",
    "흐름이 자연스럽게 맞아 들어가는 느낌이 올 수 있음",
  ],
  "saju.branch.directionalHarmony": [
    "같은 방향을 보는 사람들이 더 눈에 들어오기 쉬움",
    "집단의 흐름에 맞춰 움직이고 싶어질 수 있음",
    "혼자보다 함께일 때 힘이 더 나는 느낌이 들 수 있음",
  ],
  "saju.branch.halfTrine": [
    "조금씩 앞으로 나아가는 느낌이 생길 수 있음",
    "애쓰지 않아도 자연히 이어지는 흐름이 올 수 있음",
    "작은 것이 쌓이면서 모양이 잡히는 느낌이 들 수 있음",
  ],
  "saju.branch.penalty": [
    "내가 틀린 것은 아닐까 하는 감각이 올 수 있음",
    "예상보다 작은 일에서 에너지가 빠지는 느낌이 들 수 있음",
    "누군가의 기준이 마음에 걸리는 순간이 생길 수 있음",
  ],
  "saju.branch.triplePenalty": [
    "여러 방향에서 압박이 동시에 느껴질 수 있음",
    "어느 쪽도 선택하기 어려운 상황이 만들어질 수 있음",
    "평소보다 결정하는 데 힘이 더 들 수 있음",
  ],
  "saju.branch.harm": [
    "상대의 의도를 자꾸 추측하게 될 수 있음",
    "작은 반응이 오래 마음에 남을 수 있음",
    "이유 없이 자꾸 생각나는 사람이 생길 수 있음",
  ],
  "saju.branch.hostility": [
    "이미 지나간 일이 다시 떠오를 수 있음",
    "감정이 쉽게 정리되지 않을 수 있음",
    "마음이 한곳에 오래 머물 수 있음",
  ],
  "saju.branch.spiritDoor": [
    "이유 없이 불안하거나 이상한 감각이 올 수 있음",
    "현실보다 내면의 감각에 집중되기 쉬움",
    "뚜렷하지 않은 생각이 머릿속을 맴돌 수 있음",
  ],
  "saju.branch.selfPenalty": [
    "스스로에게 더 까다로워지는 느낌이 들 수 있음",
    "반복적인 고민이나 내면의 갈등이 느껴질 수 있음",
    "내 결정이 못마땅하게 느껴지기 쉬움",
  ],

  // ── saju · special star ──────────────────────────────────────────────────────
  "saju.star.doHwa": [
    "사람들 시선이 나에게 머무는 느낌이 들 수 있음",
    "표현하고 싶은 욕구가 평소보다 강해질 수 있음",
    "주변 분위기에 더 민감하게 반응하기 쉬움",
  ],
  "saju.star.yeokMa": [
    "한곳에 있는 것이 답답하게 느껴질 수 있음",
    "어디론가 이동하고 싶은 충동이 올 수 있음",
    "오래 한 자리에 있으면 몸이 먼저 불편해지기 쉬움",
  ],
  "saju.star.baekHo": [
    "감정이나 말이 평소보다 날카롭게 나올 수 있음",
    "강한 자극에 더 예민하게 반응하기 쉬움",
    "몸이나 감각이 긴장 상태로 있을 수 있음",
  ],
  "saju.star.hwaGae": [
    "혼자 있고 싶은 마음이 자연스럽게 올 수 있음",
    "깊고 조용한 것에 끌리는 느낌이 들 수 있음",
    "사람 많은 상황이 평소보다 부담스럽게 느껴질 수 있음",
  ],
  "saju.star.geobSal": [
    "예상치 못한 것에 긴장이 올라오기 쉬움",
    "무언가 잃을 것 같은 불안감이 배경에 은근히 깔릴 수 있음",
    "평소보다 조심스러운 태도가 나오기 쉬움",
  ],
  "saju.star.cheonDeok": [
    "주변에서 도움의 손길이 가볍게 느껴질 수 있음",
    "예상치 못한 곳에서 배려를 받는 느낌이 올 수 있음",
    "마음이 한결 가볍게 느껴지는 순간이 있을 수 있음",
  ],
  "saju.star.wolDeok": [
    "애쓴 것이 조용히 알아봐 지는 느낌이 들 수 있음",
    "든든한 기분이 배경처럼 깔리는 느낌이 올 수 있음",
    "평소보다 마음이 편안하게 가라앉을 수 있음",
  ],

  // ── saju · ohaeng ────────────────────────────────────────────────────────────
  "saju.ohaeng.clash": [
    "평소보다 에너지 소모가 빠르게 느껴질 수 있음",
    "힘을 쓴 만큼 돌아오지 않는 느낌이 들 수 있음",
    "몸이나 마음이 쉽게 피로해지는 느낌이 올 수 있음",
  ],

  // ── ziwei · palace ───────────────────────────────────────────────────────────
  "ziwei.palace.life": [
    "내 행동과 감각이 평소보다 나답게 느껴질 수 있음",
    "자신의 방향이 더 선명하게 잡히는 느낌이 들 수 있음",
    "남과 다른 내 방식이 더 강하게 고집될 수 있음",
  ],
  "ziwei.palace.siblings": [
    "비슷한 처지의 사람이 더 눈에 들어오기 쉬움",
    "혼자가 아니라는 느낌에서 힘이 나는 순간이 생길 수 있음",
    "동료나 친구가 자꾸 떠오르거나 연락하고 싶어질 수 있음",
  ],
  "ziwei.palace.spouse": [
    "가까운 사람의 사소한 반응이 더 크게 와닿는 느낌이 들 수 있음",
    "상대와 보조를 맞추려는 마음이 자연스럽게 생길 수 있음",
    "단둘이 있는 시간이 평소보다 더 의미 있게 느껴질 수 있음",
  ],
  "ziwei.palace.children": [
    "뭔가 가볍게 즐기고 싶은 마음이 올 수 있음",
    "재미있는 것에 눈이 먼저 가기 쉬움",
    "진지한 분위기보다 유쾌하고 가벼운 것이 더 맞게 느껴질 수 있음",
  ],
  "ziwei.palace.wealth": [
    "지출이나 수입의 흐름을 자꾸 들여다보게 될 수 있음",
    "눈에 보이는 실익에 집중하고 싶은 마음이 강해질 수 있음",
    "현실적인 손익 계산이 머릿속을 자꾸 맴돌 수 있음",
  ],
  "ziwei.palace.health": [
    "몸의 반응이 평소보다 빠르게 감지될 수 있음",
    "작은 불편함도 평소보다 눈에 띄게 느껴질 수 있음",
    "피로가 쌓이는 속도가 평소와 다르게 느껴질 수 있음",
  ],
  "ziwei.palace.travel": [
    "낯선 공간이나 분위기가 자연스럽게 마음을 끌 수 있음",
    "새로운 환경에 적응하는 것이 평소보다 가볍게 느껴질 수 있음",
    "일상을 벗어난 상황에서 오히려 편안함이 느껴질 수 있음",
  ],
  "ziwei.palace.friends": [
    "오랫동안 연락이 뜸했던 사람이 자꾸 생각날 수 있음",
    "사람들 사이에 있을 때 에너지가 올라오는 느낌이 들 수 있음",
    "새로운 인연이 자연스럽게 이어지기 쉬운 흐름이 올 수 있음",
  ],
  "ziwei.palace.career": [
    "일이나 역할에서 인정받고 싶은 마음이 더 강해질 수 있음",
    "내가 한 것이 어떻게 보이는지 자꾸 확인하게 될 수 있음",
    "성과가 눈에 보이지 않으면 초조해지기 쉬움",
  ],
  "ziwei.palace.property": [
    "내가 있는 공간의 상태가 기분에 더 영향을 줄 수 있음",
    "주변을 정리하거나 가지런히 하고 싶은 욕구가 생길 수 있음",
    "생활 환경의 작은 변화가 예민하게 잡힐 수 있음",
  ],
  "ziwei.palace.spirit": [
    "지금 하는 것이 즐거운지 자연스럽게 돌아보게 될 수 있음",
    "바쁜 중에도 잠깐 숨을 고르고 싶은 감각이 올 수 있음",
    "소소한 것에서 충분하다는 느낌이 찾아올 수 있음",
  ],
  "ziwei.palace.parents": [
    "윗사람의 말이나 태도가 평소보다 더 크게 와닿을 수 있음",
    "과거에 익힌 방식이나 오래된 틀이 먼저 보이기 쉬움",
    "누군가에게 기대거나 조언을 구하고 싶은 마음이 올 수 있음",
  ],
};

// ── Astro aspect effects (dynamic) ────────────────────────────────────────────

const ASTRO_PLANET_EFFECTS: Record<string, string[]> = {
  sun:       ["나 자신이 선명하게 드러나고 싶어질 수 있음",              "오늘 내가 한 것이 다른 사람 눈에 닿기를 바라는 느낌이 들 수 있음"],
  moon:      ["기분의 변화가 민감하게 느껴질 수 있음",                  "사소한 한마디에 기분이 확 달라지기 쉬움"],
  mercury:   ["생각이 말보다 빠르게 돌아가는 느낌이 들 수 있음",        "생각을 누군가에게 나눠야 속이 풀리는 느낌이 들 수 있음"],
  venus:     ["아름답거나 편안한 것에 시선이 머물 수 있음",             "사람의 온기가 자연스럽게 당겨지는 느낌이 들 수 있음"],
  mars:      ["몸이 먼저 움직이고 싶어지는 느낌이 들 수 있음",         "조금만 늦어져도 기다리는 것이 유독 힘들게 느껴질 수 있음"],
  jupiter:   ["크게 생각하거나 기대가 높아지는 느낌이 올 수 있음",      "평소보다 낙관적인 감각이 자연스럽게 올 수 있음"],
  saturn:    ["할 일 목록이 어깨에 얹히는 것처럼 무겁게 느껴질 수 있음", "실수하지 않으려는 긴장감이 배경에 깔릴 수 있음"],
  uranus:    ["예상과 다른 흐름에 당황스러움이 올 수 있음",             "평소 방식이 갑자기 맞지 않는 느낌이 들 수 있음"],
  neptune:   ["현실과 상상 사이에서 흐릿한 느낌이 올 수 있음",         "이유 없이 감성적이거나 몽롱한 상태가 될 수 있음"],
  pluto:     ["지금의 상태를 그냥 두기 어렵다는 감각이 올 수 있음",     "그간 덮어두었던 감정이 조용히 건드려질 수 있음"],
  northNode: ["익숙하지 않은 방향이 자꾸 눈에 밟힐 수 있음",           "지금과 다른 방식으로 살고 싶다는 감각이 올 수 있음"],
  chiron:    ["오래된 불편함이 가볍게 건드려지는 느낌이 올 수 있음",    "평소보다 자신의 취약한 부분에 눈이 가기 쉬움"],
};

const ASTRO_ASPECT_MODIFIER: Record<string, string> = {
  trine:       "전체적으로 부드럽고 자연스러운 흐름으로 느껴질 수 있음",
  conjunction: "그 에너지가 한곳에 집중되는 느낌이 강해질 수 있음",
  sextile:     "가볍게 열리는 느낌이 배경처럼 깔릴 수 있음",
  opposition:  "반대 방향에서 당기는 느낌으로 균형이 필요해질 수 있음",
  square:      "마찰감이 올라오면서 긴장이 생기기 쉬움",
  quincunx:    "좋으면서도 불편한 감각이 함께 올 수 있음",
  semisquare:  "자꾸 눈이 가는 대상이 생기기 쉬움",
  semisextile: "약하지만 부드러운 연결감이 배경에 있는 느낌이 올 수 있음",
};

/**
 * Returns effect sentences for a dynamic astro.aspect.* key.
 * Returns [] for unrecognized keys.
 */
export function getAstroEventEffects(key: string): string[] {
  // key format: "astro.aspect.<planet>.<aspect>"
  const parts = key.split(".");
  if (parts.length !== 4 || parts[0] !== "astro" || parts[1] !== "aspect") return [];
  const planetEffects = ASTRO_PLANET_EFFECTS[parts[2]];
  const aspectModifier = ASTRO_ASPECT_MODIFIER[parts[3]];
  if (!planetEffects || !aspectModifier) return [];
  return [...planetEffects, aspectModifier];
}

/**
 * Resolve effects for any canonical event key.
 * Returns [] when key is unknown (no throws).
 */
export function getEventEffects(key: string): string[] {
  if (key.startsWith("astro.aspect.")) return getAstroEventEffects(key);
  return AI_EVENT_EFFECTS[key] ?? [];
}
