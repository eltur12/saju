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
    "조용히 집중하고 싶은 마음이 올라올 수 있음",
  ],
  "saju.tenGod.sanggwan": [
    "평소보다 말이 많아지고 표현이 직접적으로 나올 수 있음",
    "기존 방식이 답답하게 느껴질 수 있음",
    "감정이 표현으로 바로 나오기 쉬움",
  ],
  "saju.tenGod.jeonggwan": [
    "해야 할 것들이 더 선명하게 의식될 수 있음",
    "남의 시선이나 평가가 평소보다 신경 쓰이기 쉬움",
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
    "꼼꼼하게 챙기고 싶은 마음이 올라올 수 있음",
    "소소하게 쌓이는 것에서 만족감을 느끼기 쉬움",
  ],
  "saju.tenGod.bigyeon": [
    "혼자 해결하고 싶은 마음이 강해질 수 있음",
    "비슷한 처지의 사람에게 연대감이 올라올 수 있음",
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
    "평소와 다른 흐름에 어색함이 느껴질 수 있음",
    "갑자기 결정을 강요받는 느낌이 들 수 있음",
    "익숙한 루틴이 흐트러지는 느낌이 올 수 있음",
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
    "부드럽게 맞아 들어가는 흐름이 느껴질 수 있음",
    "작은 연결이 쌓이는 느낌이 올 수 있음",
  ],
  "saju.branch.penalty": [
    "규칙이나 기대에 맞추는 것이 어색하게 느껴질 수 있음",
    "작은 어긋남이 신경 쓰이기 쉬움",
    "관계에서 불편한 순간이 반복되는 느낌이 들 수 있음",
  ],
  "saju.branch.triplePenalty": [
    "여러 방향에서 압박이 동시에 느껴질 수 있음",
    "한 가지를 정하기가 평소보다 어렵게 느껴질 수 있음",
    "의사결정과 행동에서 예상치 못한 마찰이 생기기 쉬움",
  ],
  "saju.branch.harm": [
    "아무 이유 없이 관계가 어색해지는 느낌이 올 수 있음",
    "관계에서 사소한 오해가 생기거나 엇갈림이 느껴질 수 있음",
    "기대와 다른 반응에 당황스러움이 느껴질 수 있음",
  ],
  "saju.branch.hostility": [
    "가까운 사람과 미묘하게 어긋나는 느낌이 들 수 있음",
    "서로 맞지 않는다는 감각이 의식될 수 있음",
    "관계에서 거리를 두고 싶어질 수 있음",
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
    "새로운 자극에 쉽게 끌리기 쉬움",
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
    "무언가 잃을 것 같은 느낌이 의식될 수 있음",
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
    "무언가 자꾸 어긋나는 느낌이 드는 날일 수 있음",
    "몸이나 마음이 쉽게 피로해지는 느낌이 올 수 있음",
  ],

  // ── ziwei · palace ───────────────────────────────────────────────────────────
  "ziwei.palace.life": [
    "내가 어떤 사람인지 선명하게 의식될 수 있음",
    "스스로에 대한 감각이 평소보다 뚜렷해질 수 있음",
    "내 방식이 더 강하게 고집될 수 있음",
  ],
  "ziwei.palace.siblings": [
    "비슷한 상황의 사람이 더 눈에 들어오기 쉬움",
    "함께 움직이고 싶은 마음이 올라올 수 있음",
    "주변 동료나 친구의 존재가 의식될 수 있음",
  ],
  "ziwei.palace.spouse": [
    "가까운 사람의 말과 행동이 더 민감하게 느껴질 수 있음",
    "1:1 관계에서 기대가 올라오기 쉬움",
    "파트너와의 거리감이 평소보다 의식될 수 있음",
  ],
  "ziwei.palace.children": [
    "뭔가 가볍게 즐기고 싶은 마음이 올 수 있음",
    "재미있는 것에 눈이 먼저 가기 쉬움",
    "진지함보다 가벼운 분위기가 더 편하게 느껴질 수 있음",
  ],
  "ziwei.palace.wealth": [
    "현실적인 계산이 자주 머릿속에 떠오를 수 있음",
    "돈이나 자원의 흐름이 더 신경 쓰이기 쉬움",
    "눈에 보이는 것에 집중하고 싶은 마음이 올 수 있음",
  ],
  "ziwei.palace.health": [
    "몸의 반응이 평소보다 예민하게 느껴질 수 있음",
    "피로감이 더 빨리 올라오는 느낌이 들 수 있음",
    "컨디션 변화가 신경 쓰이기 쉬움",
  ],
  "ziwei.palace.travel": [
    "현재 자리가 답답하게 느껴질 수 있음",
    "어딘가 다른 곳으로 가고 싶은 충동이 올 수 있음",
    "낯선 환경에 마음이 가볍게 끌릴 수 있음",
  ],
  "ziwei.palace.friends": [
    "사람들이 있는 자리가 자연스럽게 끌릴 수 있음",
    "아는 사람이 생각나거나 연락하고 싶어질 수 있음",
    "혼자보다 함께 있고 싶은 마음이 올라올 수 있음",
  ],
  "ziwei.palace.career": [
    "일이나 역할에서 인정받고 싶은 마음이 올 수 있음",
    "잘 보이고 싶다는 의식이 생기기 쉬움",
    "내 성과가 눈에 밟히는 느낌이 들 수 있음",
  ],
  "ziwei.palace.property": [
    "안정적인 공간이나 기반이 더 의식될 수 있음",
    "내 자리나 거처가 신경 쓰이기 쉬움",
    "주변을 정돈하고 싶은 마음이 올라올 수 있음",
  ],
  "ziwei.palace.spirit": [
    "무언가 즐기고 싶다는 마음이 자연스럽게 올 수 있음",
    "여유를 찾고 싶은 감각이 의식될 수 있음",
    "작은 것에서 만족감을 느끼기 쉬움",
  ],
  "ziwei.palace.parents": [
    "윗사람의 말이나 조언이 더 의미 있게 들릴 수 있음",
    "과거나 전통적인 방식이 떠오르기 쉬움",
    "기댈 대상이 있는 것이 안심되는 느낌이 올 수 있음",
  ],
};

// ── Astro aspect effects (dynamic) ────────────────────────────────────────────

const ASTRO_PLANET_EFFECTS: Record<string, string[]> = {
  sun:       ["나 자신이 선명하게 드러나고 싶어질 수 있음",       "인정받고 싶다는 감각이 평소보다 강해질 수 있음"],
  moon:      ["기분의 변화가 민감하게 느껴질 수 있음",           "감정이 빠르게 올라오거나 내려가기 쉬움"],
  mercury:   ["생각이 말보다 빠르게 돌아가는 느낌이 들 수 있음", "이야기하거나 정리하고 싶은 충동이 생기기 쉬움"],
  venus:     ["아름답거나 편안한 것에 시선이 머물 수 있음",      "사람과 가까워지고 싶은 마음이 올라올 수 있음"],
  mars:      ["몸이 먼저 움직이고 싶어지는 느낌이 들 수 있음",  "무언가 빠르게 처리하고 싶은 충동이 생기기 쉬움"],
  jupiter:   ["크게 생각하거나 기대가 높아지는 느낌이 올 수 있음", "평소보다 낙관적인 감각이 자연스럽게 올 수 있음"],
  saturn:    ["해야 할 것들이 무겁게 의식될 수 있음",           "실수하지 않으려는 긴장감이 배경에 깔릴 수 있음"],
  uranus:    ["예상과 다른 흐름에 당황스러움이 올 수 있음",      "평소 방식이 갑자기 맞지 않는 느낌이 들 수 있음"],
  neptune:   ["현실과 상상 사이에서 흐릿한 느낌이 올 수 있음",  "이유 없이 감성적이거나 몽롱한 상태가 될 수 있음"],
  pluto:     ["무언가를 끝내거나 바꾸고 싶은 충동이 올 수 있음", "깊은 감정이나 집착이 의식될 수 있음"],
  northNode: ["익숙하지 않은 방향이 신경 쓰이기 쉬움",          "지금과 다른 방식으로 살고 싶다는 감각이 올 수 있음"],
  chiron:    ["오래된 불편함이 가볍게 건드려지는 느낌이 올 수 있음", "약한 부분이 의식되면서 불편함이 생길 수 있음"],
};

const ASTRO_ASPECT_MODIFIER: Record<string, string> = {
  trine:       "전체적으로 부드럽고 자연스러운 흐름으로 느껴질 수 있음",
  conjunction: "그 에너지가 한곳에 집중되는 느낌이 강해질 수 있음",
  sextile:     "가볍게 열리는 느낌이 배경처럼 깔릴 수 있음",
  opposition:  "반대 방향에서 당기는 느낌으로 균형이 필요해질 수 있음",
  square:      "마찰감이 올라오면서 긴장이 생기기 쉬움",
  quincunx:    "두 방향이 동시에 당기는 어색함이 느껴질 수 있음",
  semisquare:  "가벼운 긴장이 지속적으로 쌓이는 느낌이 들 수 있음",
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
