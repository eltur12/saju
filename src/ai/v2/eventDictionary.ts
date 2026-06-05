/**
 * Event Dictionary — Canonical Event Key → 사용자 체감 Label
 *
 * AI는 key가 아닌 label을 해석에 사용합니다.
 * key는 엔진 내부 식별자이며, label은 사용자가 이해할 수 있는 체감 표현입니다.
 */

export const EVENT_LABELS: Record<string, string> = {

  // ── Saju tenGod (10) ──────────────────────────────────────────────────────

  "saju.tenGod.bigyeon":    "동료 의식",
  "saju.tenGod.geobjae":    "변화 욕구",
  "saju.tenGod.siksin":     "여유와 생산성",
  "saju.tenGod.sanggwan":   "창의적 표현",
  "saju.tenGod.pyeongjae":  "기회 포착",
  "saju.tenGod.jeongjae":   "안정과 축적",
  "saju.tenGod.pyeonggwan": "추진력",
  "saju.tenGod.jeonggwan":  "기준과 책임",
  "saju.tenGod.pyeongin":   "탐구 의식",
  "saju.tenGod.jeongin":    "배움과 정리",

  // ── Saju branch (11) ──────────────────────────────────────────────────────

  "saju.branch.sixHarmony":         "자연스러운 연결",
  "saju.branch.halfTrine":          "협력 기반",
  "saju.branch.trine":              "조화로운 흐름",
  "saju.branch.directionalHarmony": "방향성 일치",
  "saju.branch.clash":              "충돌과 전환",
  "saju.branch.harm":               "섬세한 불편",
  "saju.branch.penalty":            "내적 저항",
  "saju.branch.triplePenalty":      "강한 압박",
  "saju.branch.hostility":          "거리와 견제",
  "saju.branch.spiritDoor":         "감각의 확장",
  "saju.branch.selfPenalty":        "자기 성찰 압박",

  // ── Saju ohaeng (1) ───────────────────────────────────────────────────────

  "saju.ohaeng.clash": "오행 충돌",

  // ── Ziwei palaces (12) ────────────────────────────────────────────────────

  "ziwei.palace.life":     "자기 기준 강화",
  "ziwei.palace.career":   "업무 집중도",
  "ziwei.palace.wealth":   "실익 의식",
  "ziwei.palace.spouse":   "친밀 욕구",
  "ziwei.palace.property": "안정 기반 강화",
  "ziwei.palace.health":   "휴식 필요 신호",
  "ziwei.palace.friends":  "사람과의 연결",
  "ziwei.palace.children": "창작 욕구",
  "ziwei.palace.spirit":   "내면 탐색",
  "ziwei.palace.siblings": "동등한 관계",
  "ziwei.palace.travel":   "이동과 변화",
  "ziwei.palace.parents":  "기준 돌아봄",

  // ── Astro: Mercury (7) ────────────────────────────────────────────────────

  "astro.aspect.mercury.trine":       "명쾌한 사고",
  "astro.aspect.mercury.sextile":     "원활한 소통",
  "astro.aspect.mercury.square":      "사고 혼선",
  "astro.aspect.mercury.opposition":  "의견 충돌",
  "astro.aspect.mercury.conjunction": "정보 집중",
  "astro.aspect.mercury.semisquare":  "미세한 혼선",
  "astro.aspect.mercury.quincunx":    "이해 불일치",

  // ── Astro: Moon (7) ───────────────────────────────────────────────────────

  "astro.aspect.moon.trine":       "감정 안정",
  "astro.aspect.moon.sextile":     "정서적 연결",
  "astro.aspect.moon.square":      "감정 요동",
  "astro.aspect.moon.opposition":  "기분 양극",
  "astro.aspect.moon.conjunction": "감정 증폭",
  "astro.aspect.moon.semisquare":  "미세한 예민",
  "astro.aspect.moon.quincunx":    "감정 불일치",

  // ── Astro: Sun (7) ────────────────────────────────────────────────────────

  "astro.aspect.sun.trine":       "자연스러운 자신감",
  "astro.aspect.sun.sextile":     "긍정적 인정",
  "astro.aspect.sun.square":      "자존감 압박",
  "astro.aspect.sun.opposition":  "자기 갈등",
  "astro.aspect.sun.conjunction": "자기 강화",
  "astro.aspect.sun.semisquare":  "미세한 긴장",
  "astro.aspect.sun.quincunx":    "자아 불일치",

  // ── Astro: Venus (7) ──────────────────────────────────────────────────────

  "astro.aspect.venus.trine":       "자연스러운 호감",
  "astro.aspect.venus.sextile":     "부드러운 관계",
  "astro.aspect.venus.square":      "관계 긴장",
  "astro.aspect.venus.opposition":  "거리감 증가",
  "astro.aspect.venus.conjunction": "관계 집중",
  "astro.aspect.venus.semisquare":  "미세한 어색함",
  "astro.aspect.venus.quincunx":    "감정 불균형",

  // ── Astro: Mars (7) ───────────────────────────────────────────────────────

  "astro.aspect.mars.trine":       "자연스러운 추진",
  "astro.aspect.mars.sextile":     "활력 증가",
  "astro.aspect.mars.square":      "조급함과 마찰",
  "astro.aspect.mars.opposition":  "대립과 충동",
  "astro.aspect.mars.conjunction": "강한 행동력",
  "astro.aspect.mars.semisquare":  "미세한 조급함",
  "astro.aspect.mars.quincunx":    "행동 불일치",

  // ── Astro: Jupiter (7) ────────────────────────────────────────────────────

  "astro.aspect.jupiter.trine":       "확장감과 기회",
  "astro.aspect.jupiter.sextile":     "낙관적 전망",
  "astro.aspect.jupiter.square":      "과한 기대",
  "astro.aspect.jupiter.opposition":  "방향 분산",
  "astro.aspect.jupiter.conjunction": "긍정적 확장",
  "astro.aspect.jupiter.semisquare":  "미세한 들뜸",
  "astro.aspect.jupiter.quincunx":    "기대 불일치",

  // ── Astro: Saturn (7) ─────────────────────────────────────────────────────

  "astro.aspect.saturn.trine":       "견고한 집중",
  "astro.aspect.saturn.sextile":     "차근한 진행",
  "astro.aspect.saturn.square":      "부담과 제약",
  "astro.aspect.saturn.opposition":  "책임감 압박",
  "astro.aspect.saturn.conjunction": "경계와 한계",
  "astro.aspect.saturn.semisquare":  "미세한 부담",
  "astro.aspect.saturn.quincunx":    "책임 불일치",

  // ── Astro: Chiron (7) ─────────────────────────────────────────────────────

  "astro.aspect.chiron.trine":       "치유적 돌봄",
  "astro.aspect.chiron.sextile":     "공감 연결",
  "astro.aspect.chiron.square":      "상처 예민",
  "astro.aspect.chiron.opposition":  "취약함 노출",
  "astro.aspect.chiron.conjunction": "깊은 성찰",
  "astro.aspect.chiron.semisquare":  "미세한 예민",
  "astro.aspect.chiron.quincunx":    "취약 불일치",

  // ── Saju Special Stars (3) ────────────────────────────────────────────────

  "saju.star.doHwa":     "표현력과 매력",
  "saju.star.cheonDeok": "자연스러운 도움",
  "saju.star.wolDeok":   "순조로운 흐름",

  // ── Saju 12운성 (7) ────────────────────────────────────────────────────────

  "saju.twelveState.jangSaeng": "새로운 시작 에너지",
  "saju.twelveState.mokYok":    "감각적 민감함",
  "saju.twelveState.gwanDae":   "성장과 확장",
  "saju.twelveState.geonRok":   "안정된 기반",
  "saju.twelveState.jeWang":    "절정의 기운",
  "saju.twelveState.tae":       "내면 형성",
  "saju.twelveState.yang":      "성숙과 결실",
};

// 검증: 총 96개 이벤트 (86 + 3 special stars + 7 twelve states)
const actualCount = Object.keys(EVENT_LABELS).length;
console.log(`[EVENT_LABELS] Defined ${actualCount} event labels`);
