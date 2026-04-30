/**
 * "흐름을 만든 요소" 카드용 원인 텍스트 생성기
 *
 * 각 엔진이 이미 반환하는 .factors 값만 사용 — 점수 계산 로직은 건드리지 않는다.
 */

export interface ScoreContribution {
  key:   string;
  value: number;  // signed: positive = boosts avg of 6 domains, negative = drags
}

export interface ReasonChip {
  key:      string;
  polarity: "positive" | "negative" | "neutral";
}

export interface ReasonSource {
  key:       string;    // UI에 표시할 출처 용어 (e.g. "편관", "관록궁", "수성 흐름")
  text:      string;    // 한 문장 설명
  polarity?: "positive" | "negative" | "neutral";
  weight?:   number;    // absolute contribution value (for debugging / sorting)
  chips?:    ReasonChip[];  // top-3 influence chips, sorted by abs(value) DESC
}

export interface ReasonSources {
  saju:  ReasonSource;
  ziwei: ReasonSource;
  astro: ReasonSource;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function topContrib(contribs: ScoreContribution[]): ScoreContribution | null {
  if (contribs.length === 0) return null;
  return contribs.reduce((best, c) => {
    const absBest = Math.abs(best.value);
    const absC    = Math.abs(c.value);
    if (absC > absBest) return c;
    if (absC === absBest && c.value > best.value) return c; // positive wins tie
    return best;
  });
}

function contribsToChips(
  contribs:  ScoreContribution[],
  keyMapper: (rawKey: string) => string | null,
): ReasonChip[] {
  const result: ReasonChip[] = [];
  const sorted = [...contribs].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  for (const c of sorted) {
    if (result.length >= 3) break;
    const displayKey = keyMapper(c.key);
    if (!displayKey) continue;
    if (result.some(x => x.key === displayKey)) continue; // deduplicate by display key
    result.push({
      key:      displayKey,
      polarity: c.value > 0 ? "positive" : c.value < 0 ? "negative" : "neutral",
    });
  }
  return result;
}

// ── 사주 ──────────────────────────────────────────────────────────────────────

const SAJU_KEY_KR: Record<string, string> = {
  "傷官": "상관", "偏財": "편재", "正財": "정재", "食神": "식신",
  "正官": "정관", "偏官": "편관", "正印": "정인", "偏印": "편인",
  "比肩": "비견", "劫財": "겁재",
};

const SAJU_KEYWORDS: Record<string, string> = {
  "傷官": "표현 · 창의",
  "偏財": "기회 · 변화",
  "正財": "재정 · 관리",
  "食神": "여유 · 안정",
  "正官": "책임 · 균형",
  "偏官": "집중 · 판단",
  "正印": "배움 · 정리",
  "偏印": "사고 · 내면",
  "比肩": "자기주도 · 추진",
  "劫財": "변화 · 소비",
};

const SAJU_KEYWORDS_NEG: Record<string, string> = {
  "傷官": "표현 · 마찰",
  "偏財": "변수 · 불안정",
  "正財": "재정 · 부담",
  "食神": "무기력 · 저하",
  "正官": "압박 · 책임",
  "偏官": "긴장 · 부담",
  "正印": "과도한 생각",
  "偏印": "고립 · 위축",
  "比肩": "충돌 · 경쟁",
  "劫財": "손실 · 갈등",
};

// ── 자미두수 ──────────────────────────────────────────────────────────────────

// Keys match orrery PALACE_NAMES exactly: only '命宮' carries the '宮' suffix;
// all others are short-form ('兄弟', '夫妻', '官祿', ...).
const PALACE_KR: Record<string, string> = {
  "命宮": "명궁",   "兄弟": "형제궁", "夫妻": "부처궁",
  "子女": "자녀궁", "財帛": "재백궁", "疾厄": "질액궁",
  "遷移": "천이궁", "交友": "교우궁", "官祿": "관록궁",
  "田宅": "전택궁", "福德": "복덕궁", "父母": "부모궁",
};

const PALACE_KEYWORDS: Record<string, string> = {
  "命宮": "방향 · 의지",
  "兄弟": "관계 · 교류",
  "夫妻": "감정 · 인연",
  "子女": "표현 · 창의",
  "財帛": "재물 · 기회",
  "疾厄": "컨디션 · 관리",
  "遷移": "변화 · 이동",
  "交友": "협력 · 관계",
  "官祿": "판단 · 일",
  "田宅": "안정 · 기반",
  "福德": "여유 · 감정",
  "父母": "기준 · 관계",
};

const PALACE_KEYWORDS_NEG: Record<string, string> = {
  "命宮": "혼란 · 흔들림",
  "兄弟": "관계 · 어긋남",
  "夫妻": "감정 · 불안정",
  "子女": "표현 · 답답함",
  "財帛": "재물 · 정체",
  "疾厄": "피로 · 저하",
  "遷移": "변수 · 불안정",
  "交友": "협력 · 어긋남",
  "官祿": "부담 · 압박",
  "田宅": "불안 · 흔들림",
  "福德": "우울 · 무거움",
  "父母": "갈등 · 부담",
};

// ── 별자리 ────────────────────────────────────────────────────────────────────

const PLANET_KR: Record<string, string> = {
  "Sun": "태양", "Moon": "달", "Mercury": "수성",
  "Venus": "금성", "Mars": "화성", "Jupiter": "목성", "Saturn": "토성",
  "Chiron": "카이런",
};

// aspect symbol → easy / tense / neutral
const ASPECT_NATURE: Record<string, "easy" | "tense" | "neutral"> = {
  "☌": "neutral", "☍": "tense", "△": "easy",
  "□": "tense",   "⚹": "easy",  "⚻": "tense", "∠": "tense",
};

const PLANET_KEYWORDS: Record<string, string> = {
  "Sun": "자기표현 · 방향",
  "Moon": "감정 · 컨디션",
  "Mercury": "생각 · 소통",
  "Venus": "관계 · 감정",
  "Mars": "추진력 · 긴장",
  "Jupiter": "확장 · 기회",
  "Saturn": "책임 · 압박",
  "Chiron": "민감 · 회복",
};

/**
 * Parse "Sun △ natal Moon (orb 0.8°)" → human-readable Korean text.
 * Format is produced by AstroEngine.calcTransitAspects().
 */
function parseTransitAspect(aspectStr: string): ReasonSource {
  const parts = aspectStr.split(" ");
  const rawTp  = parts[0] ?? "";
  const symbol = parts[1] ?? "";

  const tp = PLANET_KR[rawTp] ?? rawTp;
  const effect = PLANET_KEYWORDS[rawTp] ?? "에너지";
  const nature = ASPECT_NATURE[symbol];
  const key = tp;

  return {
    key,
    text: effect,
    polarity:
        nature === "easy"
            ? "positive"
            : nature === "tense"
                ? "negative"
                : "neutral",
  };
}

// ── 메인 export ───────────────────────────────────────────────────────────────

export function buildReasonSources(
  sajuFactors:    Record<string, unknown>,
  ziweiFactors:   Record<string, unknown>,
  astroFactors:   Record<string, unknown>,
  sajuContribs?:  ScoreContribution[],
  ziweiContribs?: ScoreContribution[],
  astroContribs?: ScoreContribution[],
): ReasonSources {

  // ── 사주 ──────────────────────────────
  let sajuSource: ReasonSource = {
    key:  "사주 기운",
    text: "사주 기운이 오늘 흐름을 형성하고 있어요",
    polarity: "neutral",
  };

  // Pick the highest-abs contribution whose key maps to a displayable Korean name.
  // Branches (子, 丑, …) are excluded here — they have no SAJU_KEY_KR entry.
  const topSaju = [...(sajuContribs ?? [])]
    .filter(c => !!SAJU_KEY_KR[c.key])
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0] ?? null;
  if (topSaju) {
    const pol: "positive" | "negative" | "neutral" =
      topSaju.value > 0 ? "positive" : topSaju.value < 0 ? "negative" : "neutral";
    sajuSource = {
      key:      SAJU_KEY_KR[topSaju.key],
      text:     pol === "positive"
                  ? (SAJU_KEYWORDS[topSaju.key]     ?? "사주 기운이 오늘 흐름을 형성하고 있어요")
                : pol === "negative"
                  ? (SAJU_KEYWORDS_NEG[topSaju.key] ?? "사주 흐름에서 에너지 소모가 있는 날이에요")
                  : "사주 기운이 오늘 흐름을 형성하고 있어요",
      polarity: pol,
      weight:   Math.abs(topSaju.value),
    };
  } else {
    // No contributions or all keys unmapped → factor-based neutral fallback
    const tenGod = (sajuFactors.ten_god_of_day as string)
                || (sajuFactors.ten_god_of_month as string)
                || "";
    sajuSource = {
      key:      SAJU_KEY_KR[tenGod] ?? "사주 기운",
      text:     SAJU_KEYWORDS[tenGod] ?? "사주 기운이 오늘 흐름을 형성하고 있어요",
      polarity: "neutral",
    };
  }
  {
    const chips = contribsToChips(sajuContribs ?? [], k => SAJU_KEY_KR[k] ?? null);
    sajuSource.chips = chips.length > 0
      ? chips
      : [{ key: sajuSource.key, polarity: sajuSource.polarity ?? "neutral" }];
  }

  // ── 자미두수 ──────────────────────────
  let ziweiSource: ReasonSource = {
    key:      "자미 흐름",
    text:     "자미두수 흐름이 오늘 운세에 영향을 줬어요",
    polarity: "neutral",
  };

  const topZiwei = topContrib(ziweiContribs ?? []);
  if (topZiwei && PALACE_KR[topZiwei.key]) {
    const pol: "positive" | "negative" | "neutral" =
      topZiwei.value > 0 ? "positive" : topZiwei.value < 0 ? "negative" : "neutral";
    ziweiSource = {
      key:      PALACE_KR[topZiwei.key],
      text:     pol === "positive"
                  ? (PALACE_KEYWORDS[topZiwei.key]     ?? ziweiSource.text)
                : pol === "negative"
                  ? (PALACE_KEYWORDS_NEG[topZiwei.key] ?? ziweiSource.text)
                  : "자미두수 흐름이 오늘 운세에 영향을 줬어요",
      polarity: pol,
      weight:   Math.abs(topZiwei.value),
    };
  } else {
    // fallback: representative-factor logic
    const activePalace = ziweiFactors.active_palace as string | null;
    const sihuaSummary = ziweiFactors.sihua_summary as Record<string, string> | undefined;

    if (activePalace && PALACE_KR[activePalace]) {
      ziweiSource = {
        key:      PALACE_KR[activePalace],
        text:     PALACE_KEYWORDS[activePalace] ?? ziweiSource.text,
        polarity: "neutral",
      };
    } else if (sihuaSummary) {
      for (const sihua of ["化祿", "化科", "化權"]) {
        const palace = sihuaSummary[sihua];
        if (palace && PALACE_KR[palace]) {
          ziweiSource = {
            key:      PALACE_KR[palace],
            text:     PALACE_KEYWORDS[palace] ?? ziweiSource.text,
            polarity: "neutral",
          };
          break;
        }
      }
    }
  }
  {
    const chips = contribsToChips(ziweiContribs ?? [], k => PALACE_KR[k] ?? null);
    ziweiSource.chips = chips.length > 0
      ? chips
      : [{ key: ziweiSource.key, polarity: ziweiSource.polarity ?? "neutral" }];
  }

  // ── 별자리 ────────────────────────────
  let astroSource: ReasonSource = {
    key:      "행성 흐름",
    text:     "행성 흐름이 오늘 에너지에 영향을 줬어요",
    polarity: "neutral",
  };

  const topAstro = topContrib(astroContribs ?? []);
  if (topAstro) {
    if (topAstro.key === "venus_retrograde_transit") {
      astroSource = {
        key:      "금성 역행",
        text:     "금성 역행이 감정과 관계 흐름에 자극을 주고 있어요",
        polarity: "negative",
        weight:   Math.abs(topAstro.value),
      };
    } else {
      const parsed = parseTransitAspect(topAstro.key);
      astroSource = { ...parsed, weight: Math.abs(topAstro.value) };
    }
  } else {
    // fallback: representative-factor logic
    const transitAspects = (astroFactors.active_transit_aspects as string[]) ?? [];
    if (transitAspects.length > 0) {
      astroSource = parseTransitAspect(transitAspects[0]);
    } else if (astroFactors.venus_retrograde_transit) {
      astroSource = {
        key:      "금성 역행",
        text:     "금성 역행이 감정과 관계 흐름에 자극을 주고 있어요",
        polarity: "negative",
      };
    }
  }

  {
    const chips = contribsToChips(astroContribs ?? [], k => {
      if (k === "venus_retrograde_transit") return "금성 역행";
      const planet = k.split(" ")[0];
      const kr = PLANET_KR[planet];
      return kr ?? null;
    });
    astroSource.chips = chips.length > 0
      ? chips
      : [{ key: astroSource.key, polarity: astroSource.polarity ?? "neutral" }];
  }

  return { saju: sajuSource, ziwei: ziweiSource, astro: astroSource };
}
