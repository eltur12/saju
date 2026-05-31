export interface AiEvent {
  label:    string;
  impact?:  number;
  polarity?: "positive" | "negative";
}

export interface AiCategoryHighlight {
  label:     "wealth" | "love" | "health" | "career" | "relations" | "study";
  score:     number;
  topEvents: string[];
}

export interface AiTimeHighlights {
  significant: boolean;
  best?:    { hour: number };
  caution?: { hour: number };
  rise?:    { fromHour: number; toHour: number; delta: number };
  drop?:    { fromHour: number; toHour: number; delta: number };
}

export interface AiSignalLayer {
  /** 이번 달 활성 궁 — "이번 달 배경"으로만 참고 */
  monthlyPalace?: {
    label: string;
  };

  /** 이번 달 흐름 타입 — 특별 위치(최고/최저/상위10%/하위10%) 때만 참고 */
  monthlyFlowType?: "안정형" | "변화형" | "상승형" | "하강형" | "집중형";

  /** 이번 달 내 위치 */
  monthPosition?: {
    rank:              number;
    totalDays:         number;
    percentile:        number;
    isMonthlyHigh:     boolean;
    isMonthlyLow:      boolean;
    isTop10Percent:    boolean;
    isBottom10Percent: boolean;
  };

  /** 전날/다음날 대비 — SIGNIFICANT_DIFF=10 기준 */
  dailyCompare?: {
    prevDiff?: number;
    nextDiff?: number;
    isRiseFromPrev:  boolean;
    isDropFromPrev:  boolean;
    isRiseToNext:    boolean;
    isDropToNext:    boolean;
    isPeak:          boolean;
    isValley:        boolean;
  };
}

export interface AiInterpretationRequest {
  date?:    string;
  overall:  number;
  flowType?: string;

  scores: {
    wealth:    number;
    love:      number;
    health:    number;
    career:    number;
    relations: number;
    study:     number;
  };

  majorEvents:      AiEvent[];
  minorEvents:      AiEvent[];
  backgroundEvents: AiEvent[];

  categoryHighlights: AiCategoryHighlight[];

  timeHighlights?: AiTimeHighlights;

  /** 월 활성 궁 — 30일 고정 배경 컨텍스트 (topEvents에서 분리) */
  monthlyPalace?: { key: string; label: string };

  /** 출생 특별성 — 점수 미반영, AI 배경 정보 전용 */
  profileSpecialStars?: Array<{
    key:      string;
    label:    string;
    polarity: "positive" | "negative" | "mixed";
  }>;

  /** 오늘의 위치감 — AI 보조 참고 정보 (점수 계산과 무관) */
  signalLayer?: AiSignalLayer;
}
