import { safeResolveLabel } from "../constants/fortuneDictionary";

/**
 * Maps canonical event keys to natural-language labels for AI interpretation.
 * Labels are short noun phrases — not sentences, not analysis.
 * Fallback: safeResolveLabel() for unmapped keys.
 */
const AI_EVENT_LABELS: Record<string, string> = {
  // ── Ziwei palaces ────────────────────────────────────────────────────────
  "ziwei.palace.life":     "자기 리듬과 중심",
  "ziwei.palace.career":   "일과 역할",
  "ziwei.palace.wealth":   "현실 판단과 실속",
  "ziwei.palace.spouse":   "가까운 사람과의 관계",
  "ziwei.palace.property": "생활 공간과 안정감",
  "ziwei.palace.health":   "몸과 컨디션",
  "ziwei.palace.friends":  "주변 사람들과의 교류",
  "ziwei.palace.children": "표현력과 즐거움",
  "ziwei.palace.spirit":   "내면과 여유",
  "ziwei.palace.siblings": "가까운 관계와 교류",
  "ziwei.palace.travel":   "이동과 변화",
  "ziwei.palace.parents":  "기준과 관계",

  // ── Saju tenGod ──────────────────────────────────────────────────────────
  "saju.tenGod.jeonggwan":  "책임감과 기준",
  "saju.tenGod.pyeonggwan": "추진력과 압박",
  "saju.tenGod.jeongin":    "배움과 이해",
  "saju.tenGod.pyeongin":   "몰입과 사색",
  "saju.tenGod.siksin":     "표현과 여유",
  "saju.tenGod.sanggwan":   "표현과 속도",
  "saju.tenGod.jeongjae":   "현실 판단과 실속",
  "saju.tenGod.pyeongjae":  "기회와 움직임",
  "saju.tenGod.bigyeon":    "주도성과 자기 리듬",
  "saju.tenGod.geobjae":    "경쟁과 돌파",

  // ── Saju branch ──────────────────────────────────────────────────────────
  "saju.branch.sixHarmony":         "사람과 상황의 조화",
  "saju.branch.halfTrine":          "맞물리는 기회",
  "saju.branch.trine":              "협력과 연결",
  "saju.branch.directionalHarmony": "방향과 집중",
  "saju.branch.clash":              "충돌과 변화",
  "saju.branch.harm":               "어색함과 거리감",
  "saju.branch.penalty":            "압박과 답답함",
  "saju.branch.triplePenalty":      "반복되는 마찰",
  "saju.branch.hostility":          "긴장과 경계",
  "saju.branch.spiritDoor":         "예민함과 직감",
  "saju.branch.selfPenalty":        "내면의 마찰",

  // ── Saju star ────────────────────────────────────────────────────────────
  "saju.star.doHwa":     "표현력과 매력",
  "saju.star.hwaGae":    "몰입과 정리",
  "saju.star.yeokMa":    "이동과 변화",
  "saju.star.baekHo":    "날카로움과 결단",
  "saju.star.geobSal":   "소진과 물러남",
  "saju.star.cheonDeok": "예상치 못한 도움",
  "saju.star.wolDeok":   "따뜻한 관계",

  // ── Saju ohaeng ──────────────────────────────────────────────────────────
  "saju.ohaeng.clash": "기운의 충돌",

  // ── Astro: Mercury ───────────────────────────────────────────────────────
  "astro.aspect.mercury.trine":      "생각 정리와 소통",
  "astro.aspect.mercury.sextile":    "대화와 판단",
  "astro.aspect.mercury.square":     "생각의 충돌",
  "astro.aspect.mercury.opposition": "생각의 대립",
  "astro.aspect.mercury.conjunction":"말과 생각의 집중",
  "astro.aspect.mercury.semisquare": "말과 판단의 걸림",
  "astro.aspect.mercury.quincunx":   "말과 생각의 어긋남",
  "astro.aspect.mercury.semisextile":"미묘한 소통",

  // ── Astro: Moon ──────────────────────────────────────────────────────────
  "astro.aspect.moon.trine":      "감정 안정과 편안함",
  "astro.aspect.moon.sextile":    "감정과 관계의 연결",
  "astro.aspect.moon.square":     "감정 기복과 예민함",
  "astro.aspect.moon.opposition": "감정의 충돌",
  "astro.aspect.moon.conjunction":"감정의 집중",
  "astro.aspect.moon.semisquare": "작은 감정 자극",
  "astro.aspect.moon.quincunx":   "감정과 상황의 어긋남",
  "astro.aspect.moon.semisextile":"미묘한 감정의 연결",

  // ── Astro: Sun ───────────────────────────────────────────────────────────
  "astro.aspect.sun.trine":      "자신감과 방향감",
  "astro.aspect.sun.sextile":    "자기표현의 기회",
  "astro.aspect.sun.square":     "자기표현의 긴장",
  "astro.aspect.sun.opposition": "자아와 외부의 긴장",
  "astro.aspect.sun.conjunction":"자기 집중",
  "astro.aspect.sun.semisquare": "자기표현의 걸림",
  "astro.aspect.sun.quincunx":   "자기표현의 어긋남",

  // ── Astro: Venus ─────────────────────────────────────────────────────────
  "astro.aspect.venus.trine":      "관계와 호감",
  "astro.aspect.venus.sextile":    "관계와 감정의 연결",
  "astro.aspect.venus.square":     "관계의 긴장",
  "astro.aspect.venus.opposition": "관계의 충돌",
  "astro.aspect.venus.conjunction":"감정과 관계의 집중",
  "astro.aspect.venus.semisquare": "관계의 작은 걸림",
  "astro.aspect.venus.quincunx":   "관계의 어긋남",

  // ── Astro: Mars ──────────────────────────────────────────────────────────
  "astro.aspect.mars.trine":      "실행력과 추진",
  "astro.aspect.mars.sextile":    "행동과 기회",
  "astro.aspect.mars.square":     "조급함과 충돌",
  "astro.aspect.mars.opposition": "행동의 충돌",
  "astro.aspect.mars.conjunction":"강한 행동 충동",
  "astro.aspect.mars.semisquare": "작은 조급함",
  "astro.aspect.mars.quincunx":   "행동의 어긋남",

  // ── Astro: Jupiter ───────────────────────────────────────────────────────
  "astro.aspect.jupiter.trine":      "확장과 기회",
  "astro.aspect.jupiter.sextile":    "기회와 성장",
  "astro.aspect.jupiter.square":     "과욕과 산만함",
  "astro.aspect.jupiter.opposition": "균형의 흔들림",
  "astro.aspect.jupiter.conjunction":"낙관과 확장",
  "astro.aspect.jupiter.semisquare": "기회의 작은 걸림",

  // ── Astro: Saturn ────────────────────────────────────────────────────────
  "astro.aspect.saturn.trine":      "책임감과 안정감",
  "astro.aspect.saturn.sextile":    "구조와 성취",
  "astro.aspect.saturn.square":     "부담과 압박",
  "astro.aspect.saturn.opposition": "제약과 긴장",
  "astro.aspect.saturn.conjunction":"무게와 집중",
  "astro.aspect.saturn.semisquare": "작은 제약",

  // ── Astro: Chiron ────────────────────────────────────────────────────────
  "astro.aspect.chiron.trine":      "회복과 감수성",
  "astro.aspect.chiron.sextile":    "치유와 연결",
  "astro.aspect.chiron.square":     "민감함과 자극",
  "astro.aspect.chiron.opposition": "상처와 인식",
  "astro.aspect.chiron.conjunction":"치유의 집중",
  "astro.aspect.chiron.semisquare": "작은 민감함",

  // ── Saju Special Stars (duplicates removed) ──────────────────────────────
  // Already defined above

  // ── Saju 12운성 ──────────────────────────────────────────────────────────
  "saju.twelveState.jangSaeng": "새로운 시작 에너지",
  "saju.twelveState.mokYok":    "감각적 민감함",
  "saju.twelveState.gwanDae":   "성장과 확장",
  "saju.twelveState.geonRok":   "안정된 기반",
  "saju.twelveState.jeWang":    "절정의 기운",
  "saju.twelveState.tae":       "내면 형성",
  "saju.twelveState.yang":      "성숙과 결실",
};

export function getEventLabel(key: string): string {
  return AI_EVENT_LABELS[key] ?? safeResolveLabel(key);
}
