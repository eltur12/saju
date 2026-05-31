/**
 * Per-driver semantic keywords for AI interpretation.
 * Keyed by canonical event key (e.g. "saju.tenGod.jeonggwan").
 * All keywords are felt-experience expressions, not abstract concepts.
 * getDriverKeywords() is the single public entry point.
 */

// ── Saju: tenGod ─────────────────────────────────────────────────────────────

const TENGOD_POS: Record<string, string[]> = {
  "saju.tenGod.sanggwan":   ["말하고 싶은 충동", "감정 표현", "아이디어 발산"],
  "saju.tenGod.pyeongjae":  ["기회 포착", "실익 의식", "현실 변수 감지"],
  "saju.tenGod.jeongjae":   ["손익 감각", "지출 관리", "실용 판단"],
  "saju.tenGod.siksin":     ["느긋한 흐름", "긴장 완화", "편안한 진행"],
  "saju.tenGod.jeonggwan":  ["일의 진도", "성과 의식", "결정 타이밍"],
  "saju.tenGod.pyeonggwan": ["압박 속 집중", "빠른 결단", "강한 실행력"],
  "saju.tenGod.jeongin":    ["이해 흡수", "정보 정리", "논리 명료함"],
  "saju.tenGod.pyeongin":   ["혼자 생각하는 흐름", "내면 몰입", "직관적 관찰"],
  "saju.tenGod.bigyeon":    ["자기 주도", "독립 행동", "주도감"],
  "saju.tenGod.geobjae":    ["즉흥 결정", "변동 수용", "충동적 전환"],
};

const TENGOD_NEG: Record<string, string[]> = {
  "saju.tenGod.sanggwan":   ["말실수 리스크", "감정 충돌", "표현 과잉"],
  "saju.tenGod.pyeongjae":  ["계획 흔들림", "예상 밖 변수", "불안정한 기회"],
  "saju.tenGod.jeongjae":   ["재정 압박", "지출 부담", "아끼는 감각"],
  "saju.tenGod.siksin":     ["의욕 저하", "몸이 무거운 느낌", "동력 꺼짐"],
  "saju.tenGod.jeonggwan":  ["완수 부담", "눈치 의식", "책임의 무게"],
  "saju.tenGod.pyeonggwan": ["심리적 압박", "긴장 지속", "과부하 리스크"],
  "saju.tenGod.jeongin":    ["생각 과부하", "결론 안 남", "머릿속 정체"],
  "saju.tenGod.pyeongin":   ["혼자인 느낌", "연결 단절감", "물러서는 감각"],
  "saju.tenGod.bigyeon":    ["의견 충돌", "고집 부딪힘", "경쟁 의식"],
  "saju.tenGod.geobjae":    ["예상 밖 지출", "빠져나가는 감각", "내적 갈등"],
};

// ── Saju: branch ─────────────────────────────────────────────────────────────

const BRANCH_KEYWORDS: Record<string, string[]> = {
  "saju.branch.clash":              ["강한 마찰감", "급격한 변동", "긴장 고조"],
  "saju.branch.sixHarmony":         ["맞아떨어지는 감각", "부드러운 연결", "협력감"],
  "saju.branch.trine":              ["막힘 없는 흐름", "편안한 진행", "힘 모아짐"],
  "saju.branch.directionalHarmony": ["목적 의식", "방향 감각 선명", "집중 지속"],
  "saju.branch.halfTrine":          ["약한 연결감", "부드러운 보조"],
  "saju.branch.penalty":            ["어긋나는 느낌", "신경 쓰이는 마찰", "미묘한 불편"],
  "saju.branch.triplePenalty":      ["반복되는 마찰", "해소 안 되는 긴장", "갈등 누적"],
  "saju.branch.harm":               ["엇갈리는 타이밍", "작은 손해 체감", "어긋남"],
  "saju.branch.hostility":          ["강한 대립감", "신경 날카로움", "마찰 고조"],
  "saju.branch.spiritDoor":         ["갑작스러운 직감", "예상 밖 아이디어", "예민한 감지"],
  "saju.branch.selfPenalty":        ["자기 소진", "내면 갈등", "스스로 힘들게 함"],
};

// ── Saju: star ───────────────────────────────────────────────────────────────

const STAR_KEYWORDS: Record<string, string[]> = {
  "saju.star.doHwa":     ["눈에 띄는 감각", "감정 표현 욕구", "호감 받는 흐름"],
  "saju.star.yeokMa":    ["움직이고 싶은 충동", "제자리 답답함", "이동 욕구"],
  "saju.star.baekHo":    ["날카로운 집중", "강한 결단력", "예민한 반응"],
  "saju.star.hwaGae":    ["감각적 몰입", "미적 감수성", "상상력 상승"],
  "saju.star.geobSal":   ["에너지 빠지는 느낌", "의욕 꺼짐", "물러서고 싶음"],
  "saju.star.cheonDeok": ["뜻밖의 도움", "도움 받는 감각", "편안한 흐름"],
  "saju.star.wolDeok":   ["따뜻한 관계 감각", "배려 받는 느낌", "부드러운 연결"],
};

// ── Saju: ohaeng ─────────────────────────────────────────────────────────────

const OHAENG_KEYWORDS: Record<string, string[]> = {
  "saju.ohaeng.clash": ["강한 에너지 마찰", "소모감", "충돌 후 피로"],
};

// ── Ziwei: palace ─────────────────────────────────────────────────────────────

const PALACE_POS: Record<string, string[]> = {
  "ziwei.palace.life":     ["자기 의지", "오늘의 목적 의식", "주도감"],
  "ziwei.palace.siblings": ["주변과의 교류", "사람과의 접촉", "연결감"],
  "ziwei.palace.spouse":   ["친밀감", "감정 표현 욕구", "관계 온도 상승"],
  "ziwei.palace.children": ["표현 욕구", "아이디어 발산", "창의적 에너지"],
  "ziwei.palace.wealth":   ["실익 감각", "기회 포착", "손익 의식"],
  "ziwei.palace.health":   ["신체 리듬 안정", "회복감", "컨디션 여유"],
  "ziwei.palace.travel":   ["이동 욕구", "새 환경 끌림", "변화 수용"],
  "ziwei.palace.friends":  ["협력 감각", "연대감", "사람과의 온도"],
  "ziwei.palace.career":   ["일의 진도", "업무 집중", "결과 의식"],
  "ziwei.palace.property": ["안정감", "자리 잡힌 느낌", "기반 의식"],
  "ziwei.palace.spirit":   ["내면 여유", "감정 안정", "쉬는 느낌"],
  "ziwei.palace.parents":  ["판단 기준 선명함", "규범 의식", "기준 감각"],
};

const PALACE_NEG: Record<string, string[]> = {
  "ziwei.palace.life":     ["방향 감각 흔들림", "뭘 해야 할지 모르는 느낌", "의욕 저하"],
  "ziwei.palace.siblings": ["주변과의 어긋남", "연결 단절", "불편한 교류"],
  "ziwei.palace.spouse":   ["감정 소통 어긋남", "거리감", "감정 온도 변화"],
  "ziwei.palace.children": ["표현이 막히는 느낌", "창의 정체", "답답함"],
  "ziwei.palace.wealth":   ["기회가 안 보이는 느낌", "재정 정체", "수익 막힘"],
  "ziwei.palace.health":   ["신체 피로", "컨디션 저하", "무기력"],
  "ziwei.palace.travel":   ["예상 밖 변수", "계획 흔들림", "불안정한 이동"],
  "ziwei.palace.friends":  ["협력 어긋남", "기대 배신감", "연대 약화"],
  "ziwei.palace.career":   ["업무 압박", "성과 부담", "일이 안 풀리는 감각"],
  "ziwei.palace.property": ["기반이 흔들리는 느낌", "자리 불안정", "안전감 저하"],
  "ziwei.palace.spirit":   ["마음 무거움", "감정 침체", "기분 저하"],
  "ziwei.palace.parents":  ["기준 충돌", "눈치 의식", "평가 부담"],
};

// ── Astro: planet × polarity ──────────────────────────────────────────────────

const PLANET_EASY: Record<string, string[]> = {
  "Sun":     ["자기 존재감", "하고 싶은 것 선명함", "주도감"],
  "Moon":    ["감정 편안함", "신체 리듬 안정", "감정 수용"],
  "Mercury": ["말이 잘 풀리는 감각", "논리 정리", "대화 연결"],
  "Venus":   ["호감 받는 감각", "관계 온도 상승", "감정 교류"],
  "Mars":    ["실행 욕구", "빠른 행동", "에너지 상승"],
  "Jupiter": ["기회 포착", "낙관적 에너지", "시야 넓어지는 느낌"],
  "Saturn":  ["집중 지속", "계획 정리", "결과 내는 감각"],
  "Chiron":  ["회복 에너지", "공감 능력 상승", "부드러운 감수성"],
};

const PLANET_HARD: Record<string, string[]> = {
  "Sun":     ["시선 의식", "드러남의 부담", "자기주장 마찰"],
  "Moon":    ["감정 변화", "신체 예민", "기분 영향 받기 쉬움"],
  "Mercury": ["말이 꼬이는 감각", "오해 리스크", "생각 정리 안 됨"],
  "Venus":   ["관계 온도 변화", "감정 어긋남", "호감 불안정"],
  "Mars":    ["조급한 행동", "충동적 반응", "마찰 유발"],
  "Jupiter": ["과욕", "집중 분산", "산만함"],
  "Saturn":  ["짓누르는 책임감", "진도 안 나가는 느낌", "제약 의식"],
  "Chiron":  ["상처 자극", "감각 예민", "자기 비판"],
};

// ── Public API ─────────────────────────────────────────────────────────────────

export function getDriverKeywords(key: string, polarity: -1 | 0 | 1): string[] {
  if (key.startsWith("saju.tenGod.")) {
    const dict = polarity === -1 ? TENGOD_NEG : TENGOD_POS;
    return dict[key] ?? [];
  }

  if (key.startsWith("saju.branch.")) {
    return BRANCH_KEYWORDS[key] ?? [];
  }

  if (key.startsWith("saju.star.")) {
    return STAR_KEYWORDS[key] ?? [];
  }

  if (key === "saju.ohaeng.clash") {
    return OHAENG_KEYWORDS[key] ?? [];
  }

  if (key.startsWith("ziwei.palace.")) {
    const dict = polarity === -1 ? PALACE_NEG : PALACE_POS;
    return dict[key] ?? [];
  }

  // astro aspect: "astro.aspect.<Planet>.<aspectType>"
  if (key.startsWith("astro.aspect.")) {
    const parts = key.split(".");
    const planet = parts[2];
    if (!planet) return [];
    const planetKey = planet.charAt(0).toUpperCase() + planet.slice(1);
    const dict = polarity === -1 ? PLANET_HARD : PLANET_EASY;
    return dict[planetKey] ?? [];
  }

  return [];
}
