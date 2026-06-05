/**
 * 사주(四柱八字) 분석 엔진
 */

export type ScoreMap = {
  overall: number;
  wealth: number;
  love: number;
  health: number;
  career: number;
  relations: number;
  study: number;
};

function zeroScore(): ScoreMap {
  return { overall: 0, wealth: 0, love: 0, health: 0, career: 0, relations: 0, study: 0 };
}

function baseScore(): ScoreMap {
  return { overall: 60, wealth: 60, love: 60, health: 60, career: 60, relations: 61, study: 60 };
}

function addScore(a: ScoreMap, b: Partial<ScoreMap>, weight = 1.0): ScoreMap {
  const keys = Object.keys(a) as (keyof ScoreMap)[];
  const result = { ...a };
  keys.forEach(k => { result[k] += Math.round((b[k] ?? 0) * weight); });
  return result;
}

function uniformScore(v: number): ScoreMap {
  return { overall: v, wealth: v, love: v, health: v, career: v, relations: v, study: v };
}

export const HEAVENLY_STEMS = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
export const EARTHLY_BRANCHES = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];

export const STEM_ELEMENT: Record<string, string> = {
  "甲":"木","乙":"木","丙":"火","丁":"火","戊":"土","己":"土","庚":"金","辛":"金","壬":"水","癸":"水",
};

export const BRANCH_ELEMENT: Record<string, string> = {
  "子":"水","丑":"土","寅":"木","卯":"木","辰":"土","巳":"火","午":"火","未":"土","申":"金","酉":"金","戌":"土","亥":"水",
};

const TEN_GOD_MAP: Record<string, string> = {
  "木_木_true":"比肩","木_木_false":"劫財","木_火_true":"食神","木_火_false":"傷官","木_土_true":"偏財","木_土_false":"正財","木_金_true":"偏官","木_金_false":"正官","木_水_true":"偏印","木_水_false":"正印",
  "火_火_true":"比肩","火_火_false":"劫財","火_土_true":"食神","火_土_false":"傷官","火_金_true":"偏財","火_金_false":"正財","火_水_true":"偏官","火_水_false":"正官","火_木_true":"偏印","火_木_false":"正印",
  "土_土_true":"比肩","土_土_false":"劫財","土_金_true":"食神","土_金_false":"傷官","土_水_true":"偏財","土_水_false":"正財","土_木_true":"偏官","土_木_false":"正官","土_火_true":"偏印","土_火_false":"正印",
  "金_金_true":"比肩","金_金_false":"劫財","金_水_true":"食神","金_水_false":"傷官","金_木_true":"偏財","金_木_false":"正財","金_火_true":"偏官","金_火_false":"正官","金_土_true":"偏印","金_土_false":"正印",
  "水_水_true":"比肩","水_水_false":"劫財","水_木_true":"食神","水_木_false":"傷官","水_火_true":"偏財","水_火_false":"正財","水_土_true":"偏官","水_土_false":"正官","水_金_true":"偏印","水_金_false":"正印",
};

// FIX 1: overall 제거 — 병합 시 사용되지 않는 dead field
type DomainInfluence = Omit<ScoreMap, 'overall'>;

// 십성별 영역 차등 보정값 (규칙서 STEP 6 기반)
const TEN_GOD_INFLUENCE: Record<string, DomainInfluence> = {
  "比肩": { wealth:0,   love:0,   health:2,  career:0,   relations:0,  study:0  },
  "劫財": { wealth:-8,  love:-4,  health:0,  career:-3,  relations:-5, study:-2 },
  "食神": { wealth:10,  love:5,   health:10, career:6,   relations:11, study:8  },
  "傷官": { wealth:-3,  love:-4,  health:0,  career:3,   relations:-1, study:6  },
  "偏財": { wealth:8,   love:3,   health:2,  career:6,   relations:5,  study:3  },
  "正財": { wealth:12,  love:3,   health:4,  career:8,   relations:5,  study:3  },
  "偏官": { wealth:-5,  love:-5,  health:-8, career:-5,  relations:-7, study:-3 },
  "正官": { wealth:5,   love:2,   health:4,  career:10,  relations:6,  study:3  },
  "偏印": { wealth:0,   love:6,   health:3,  career:5,   relations:6,  study:2  },
  "正印": { wealth:5,   love:3,   health:7,  career:10,  relations:5,  study:4  },
};

/** 특별성 점수 테이블 — 점수 계산에는 미사용 (1차 분리 완료), profileSpecialStars 메타데이터용으로만 보존 */
const SPECIAL_STARS: Record<string, ScoreMap> = {
  "천덕귀인": { overall:10, wealth:8,  love:5,  health:8,  career:8,  relations:6,  study:5  },
  "월덕귀인": { overall:8,  wealth:10, love:5,  health:5,  career:5,  relations:5,  study:4  },
  "도화살":   { overall:0,  wealth:0,  love:15, health:0,  career:-3, relations:5,  study:0  },
  "역마살":   { overall:3,  wealth:5,  love:-3, health:-3, career:8,  relations:3,  study:2  },
  "화개살":   { overall:0,  wealth:-3, love:-5, health:5,  career:3,  relations:-3, study:5  },
  "겁살":     { overall:-5, wealth:-8, love:-5, health:-5, career:-5, relations:-5, study:-3 },
  "백호살":   { overall:-5, wealth:0,  love:-3, health:-5, career:-3, relations:-5, study:-2 },
};

/** 도화살 지지 */
const DOHWA_BRANCHES = ["子", "午", "卯", "酉"];

/** 12운성 매핑 테이블 */
function getTwelveStatesMapping(dayStem: string) {
  const stemToBranchStart: Record<string, number> = {
    "甲": 10, "乙": 5, "丙": 2, "丁": 8, "戊": 2, "己": 8, "庚": 4, "辛": 11, "壬": 7, "癸": 2,
  };
  const branches = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
  const start = stemToBranchStart[dayStem];
  return {
    "장생": branches[(start + 0) % 12],
    "목욕": branches[(start + 1) % 12],
    "관대": branches[(start + 2) % 12],
    "건록": branches[(start + 3) % 12],
    "제왕": branches[(start + 4) % 12],
    "쇠":   branches[(start + 5) % 12],
    "병":   branches[(start + 6) % 12],
    "사":   branches[(start + 7) % 12],
    "묘":   branches[(start + 8) % 12],
    "절":   branches[(start + 9) % 12],
    "태":   branches[(start + 10) % 12],
    "양":   branches[(start + 11) % 12],
  };
}

/** 특별성 → AI 전달용 메타데이터 매핑 */
const SPECIAL_STARS_META: Record<string, { key: string; polarity: "positive" | "negative" | "mixed" }> = {
  "천덕귀인": { key: "saju.star.cheonDeok", polarity: "positive" },
  "월덕귀인": { key: "saju.star.wolDeok",   polarity: "positive" },
  "도화살":   { key: "saju.star.doHwa",     polarity: "mixed"    },
  "역마살":   { key: "saju.star.yeokMa",    polarity: "mixed"    },
  "화개살":   { key: "saju.star.hwaGae",    polarity: "mixed"    },
  "겁살":     { key: "saju.star.geobSal",   polarity: "negative" },
  "백호살":   { key: "saju.star.baekHo",    polarity: "negative" },
};

/** AI Request에 전달되는 특별성 프로필 정보 */
export interface SpecialStarInfo {
  key:      string;
  label:    string;
  polarity: "positive" | "negative" | "mixed";
}

// ──────────────────────────────────────────────
// 지지 관계 테이블
// ──────────────────────────────────────────────

/** 충(沖) 쌍 */
const CHONG_PAIRS: [string, string][] = [
  ["子","午"],["丑","未"],["寅","申"],["卯","酉"],["辰","戌"],["巳","亥"],
];

/** 해(害) 쌍 */
const HAE_PAIRS: [string, string][] = [
  ["子","未"],["丑","午"],["寅","巳"],["卯","辰"],["申","亥"],["酉","戌"],
];

/** 삼형(三刑) 완전한 세트 */
const SAMHYEONG_SETS: string[][] = [
  ["丑","戌","未"],
  ["寅","巳","申"],
];

/** 육합(六合) 쌍 */
const YUKHAP_PAIRS: [string, string][] = [
  ["子","丑"],["寅","亥"],["卯","戌"],["辰","酉"],["巳","申"],["午","未"],
];

/** 삼합(三合) 완전한 세트 */
const SAMHAP_SETS: string[][] = [
  ["申","子","辰"],
  ["亥","卯","未"],
  ["寅","午","戌"],
  ["巳","酉","丑"],
];

/** 방합(方合) 완전한 세트 */
const BANGHAP_SETS: string[][] = [
  ["寅","卯","辰"],
  ["巳","午","未"],
  ["申","酉","戌"],
  ["亥","子","丑"],
];

/** 원진(怨嗔) 쌍 */
const WONJIN_PAIRS: [string, string][] = [
  ["子","未"],["丑","午"],["寅","酉"],["卯","申"],["辰","亥"],["巳","戌"],
];

/** 귀문관살(鬼門關殺) 쌍 */
const GWIMUN_PAIRS: [string, string][] = [
  ["子","酉"],["丑","午"],["寅","未"],["卯","申"],["辰","亥"],["巳","戌"],
];

// 천간 충 쌍
const STEM_CLASH_PAIRS: [string, string][] = [
  ["甲","庚"],["乙","辛"],["丙","壬"],["丁","癸"],["戊","甲"],["己","乙"],
  ["庚","丙"],["辛","丁"],["壬","戊"],["癸","己"],
];

// ──────────────────────────────────────────────
// 지지 관계 계산 유틸
// ──────────────────────────────────────────────

function isPair(a: string, b: string, pairs: [string, string][]): boolean {
  return pairs.some(([p1, p2]) => (a === p1 && b === p2) || (a === p2 && b === p1));
}

interface BranchRelation { type: string; value: number }

/**
 * targetBranch 와 chartBranches(4기둥 지지) 간의 모든 관계를 계산한다.
 * 충이 합을 깨는 우선순위 처리 포함.
 * 해·원진·귀문 동시 합산 최대 -15 상한.
 */
function getBranchRelations(targetBranch: string, chartBranches: string[]): BranchRelation[] {
  const relations: BranchRelation[] = [];

  // 복음(伏吟): 같은 글자
  for (const cb of chartBranches) {
    if (targetBranch === cb) relations.push({ type: "복음", value: 10 });
  }

  // 충(沖)
  for (const cb of chartBranches) {
    if (isPair(targetBranch, cb, CHONG_PAIRS)) relations.push({ type: "충", value: -12 });
  }

  // 해(害)
  for (const cb of chartBranches) {
    if (isPair(targetBranch, cb, HAE_PAIRS)) relations.push({ type: "해", value: -6 });
  }

  // 형(刑) / 삼형(三刑)
  for (const set of SAMHYEONG_SETS) {
    if (set.includes(targetBranch)) {
      const others = set.filter(b => b !== targetBranch);
      const matchCount = others.filter(b => chartBranches.includes(b)).length;
      if (matchCount === 2) {
        relations.push({ type: "삼형", value: -10 });
      } else if (matchCount === 1) {
        relations.push({ type: "형", value: -8 });
      }
    }
  }
  // 子卯 형
  for (const cb of chartBranches) {
    if (isPair(targetBranch, cb, [["子","卯"]])) relations.push({ type: "형", value: -8 });
  }

  // 원진(怨嗔)
  for (const cb of chartBranches) {
    if (isPair(targetBranch, cb, WONJIN_PAIRS)) relations.push({ type: "원진", value: -5 });
  }

  // 귀문관살(鬼門關殺)
  for (const cb of chartBranches) {
    if (isPair(targetBranch, cb, GWIMUN_PAIRS)) relations.push({ type: "귀문", value: -4 });
  }

  // 육합(六合)
  for (const cb of chartBranches) {
    if (isPair(targetBranch, cb, YUKHAP_PAIRS)) relations.push({ type: "육합", value: 8 });
  }

  // 삼합(三合) / 반합(半合)
  for (const set of SAMHAP_SETS) {
    if (set.includes(targetBranch)) {
      const others = set.filter(b => b !== targetBranch);
      const matchCount = others.filter(b => chartBranches.includes(b)).length;
      if (matchCount === 2) {
        relations.push({ type: "삼합", value: 12 });
      } else if (matchCount === 1) {
        relations.push({ type: "반합", value: 4 });
      }
    }
  }

  // 방합(方合) 완성
  for (const set of BANGHAP_SETS) {
    if (set.includes(targetBranch)) {
      const others = set.filter(b => b !== targetBranch);
      if (others.every(b => chartBranches.includes(b))) {
        relations.push({ type: "방합", value: 10 });
      }
    }
  }

  // 충이 합을 깨는 우선순위 처리
  const hasChong = relations.some(r => r.type === "충");
  let filtered = hasChong
    ? relations.filter(r => ["충","해","형","삼형","원진","귀문"].includes(r.type))
    : relations;

  // 해·원진·귀문 동시 합산 상한 -15
  const negRelTypes = ["해","원진","귀문"];
  const negRels = filtered.filter(r => negRelTypes.includes(r.type));
  const negSum = negRels.reduce((s, r) => s + r.value, 0);
  if (negSum < -15) {
    // 합산이 -15 초과 시, 해당 항목들을 비율로 줄임
    const factor = -15 / negSum;
    filtered = filtered.map(r => negRelTypes.includes(r.type) ? { ...r, value: Math.trunc(r.value * factor) } : r);
  }

  return filtered;
}

/** Task 3: 지지 관계 카테고리별 가중치 */
const BRANCH_REL_CAT_W: Record<string, number> = {
  love: 1.2, relations: 1.2, health: 0.85, wealth: 1.0, study: 0.9, career: 0.8,
};

function applyBranchRelationsToScore(scores: ScoreMap, targetBranch: string, chartBranches: string[]): ScoreMap {
  const rels = getBranchRelations(targetBranch, chartBranches);
  let result = { ...scores };
  for (const rel of rels) {
    const weighted: Partial<ScoreMap> = { overall: rel.value };
    (["wealth", "love", "health", "career", "relations", "study"] as (keyof ScoreMap)[])
      .forEach(c => {
        const w = (c === "relations" && rel.value < 0) ? 0.9 : (BRANCH_REL_CAT_W[c as string] ?? 1.0);
        weighted[c] = Math.round(rel.value * w);
      });
    result = addScore(result, weighted);
  }
  return result;
}

// ──────────────────────────────────────────────
// 인터페이스 & 클래스
// ──────────────────────────────────────────────

export interface SajuEngineProfile {
  day_stem: string;
  month_stem: string;
  hour_branch: string;
  day_branch: string;
  month_branch: string;
  year_branch: string;
  special_stars: string[];
  dayun_stem: string;
  dayun_branch: string;
  year_stem?: string;
  /**
   * 인종법(引從法) 규칙 — 십성별로 개별 타입 지정 가능
   * 예: { "正財": "jeoljong", "正官": "byeongjong" }
   * jeoljong = 절종(絶從): 효과 반전 + 금전 추가 -5
   * byeongjong = 병종(病從): 효과 50% 감쇄
   */
  injong_rules?: Record<string, "jeoljong" | "byeongjong">;
}

const _DOMAIN6_SAJU = ["wealth", "love", "health", "career", "relations", "study"] as const;
function _avgDelta6(after: ScoreMap, before: ScoreMap): number {
  return _DOMAIN6_SAJU.reduce((s, c) => s + (after[c] - before[c]), 0) / 6;
}

export class SajuEngine {
  private day_stem: string;
  private month_stem: string;
  private hour_branch: string;
  private day_branch: string;
  private month_branch: string;
  private year_branch: string;
  private special_stars: string[];
  private dayun_stem: string;
  private dayun_branch: string;
  private year_stem: string;
  private day_element: string;
  private is_yang: boolean;
  private injong_rules: Record<string, "jeoljong" | "byeongjong">;
  private natal_fixed_penalty: ScoreMap;

  constructor(p: SajuEngineProfile) {
    this.day_stem     = p.day_stem;
    this.month_stem   = p.month_stem;
    this.hour_branch  = p.hour_branch;
    this.day_branch   = p.day_branch;
    this.month_branch = p.month_branch;
    this.year_branch  = p.year_branch;
    this.special_stars = p.special_stars;
    this.dayun_stem   = p.dayun_stem;
    this.dayun_branch = p.dayun_branch;
    this.year_stem    = p.year_stem ?? "";
    this.day_element  = STEM_ELEMENT[p.day_stem];
    this.is_yang      = HEAVENLY_STEMS.indexOf(p.day_stem) % 2 === 0;
    this.injong_rules = p.injong_rules ?? {};
    this.natal_fixed_penalty = this.computeNatalFixedPenalty();
  }

  /** 사주 원국 내 지지 간 고정 충돌 패널티 (30% 적용) */
  private computeNatalFixedPenalty(): ScoreMap {
    const branches = [this.hour_branch, this.day_branch, this.month_branch, this.year_branch];
    const penalty = zeroScore();
    const negTypes = ["충","해","형","삼형","원진","귀문"];
    for (let i = 0; i < branches.length; i++) {
      // 각 기둥 지지를 나머지 세 기둥에 대해 체크
      const others = branches.filter((_, idx) => idx !== i);
      const rels = getBranchRelations(branches[i], others);
      for (const rel of rels) {
        if (negTypes.includes(rel.type)) {
          const keys = Object.keys(penalty) as (keyof ScoreMap)[];
          keys.forEach(k => { penalty[k] += Math.trunc(rel.value * 0.3); });
        }
      }
    }
    // 중복 계산(i→j 와 j→i 모두 카운트됨)이므로 2로 나눔
    const keys = Object.keys(penalty) as (keyof ScoreMap)[];
    keys.forEach(k => { penalty[k] = Math.trunc(penalty[k] / 2); });
    return penalty;
  }

  /**
   * 십성 계산 — 천간(stem)이면 음양을 직접 비교, 오행명이면 day stem is_yang 그대로 사용
   * 偏(편) 계열 = 같은 음양(_true), 正(정) 계열 = 다른 음양(_false)
   */
  private getTenGod(stemOrElement: string): string | undefined {
    const element = STEM_ELEMENT[stemOrElement] ?? stemOrElement;
    const stemIdx = HEAVENLY_STEMS.indexOf(stemOrElement);
    let sameYang: boolean;
    if (stemIdx >= 0) {
      // 천간인 경우: day stem과 target stem 음양을 직접 비교
      const targetIsYang = stemIdx % 2 === 0;
      sameYang = this.is_yang === targetIsYang;
    } else {
      // 오행명만 전달된 경우(지지 오행 등): day stem is_yang 그대로 사용
      sameYang = this.is_yang;
    }
    const key = `${this.day_element}_${element}_${sameYang}`;
    return TEN_GOD_MAP[key];
  }

  /** 십성 영향 적용 (인종법 처리 포함) */
  private applyTenGod(scores: ScoreMap, stem: string, weight = 1.0): ScoreMap {
    const tenGod = this.getTenGod(stem);
    if (!tenGod || !TEN_GOD_INFLUENCE[tenGod]) return scores;

    let inf = { ...TEN_GOD_INFLUENCE[tenGod] };

    // 인종법 처리 — 십성별 개별 타입 적용
    const injongType = this.injong_rules[tenGod];
    if (injongType === "jeoljong") {
      // 절종: 보정값 반전 + 금전 추가 -5
      const keys = Object.keys(inf) as (keyof DomainInfluence)[];
      keys.forEach(k => { inf[k] = -inf[k]; });
      inf.wealth -= 5;
    } else if (injongType === "byeongjong") {
      // 병종: 50% 감쇄
      const keys = Object.keys(inf) as (keyof DomainInfluence)[];
      keys.forEach(k => { inf[k] = Math.trunc(inf[k] * 0.5); });
    }

    return addScore(scores, inf, weight);
  }

  private applySpecialStars(scores: ScoreMap): ScoreMap {
    let result = { ...scores };
    for (const star of this.special_stars) {
      if (SPECIAL_STARS[star]) {
        result = addScore(result, SPECIAL_STARS[star]);
      }
    }
    return result;
  }

  private applyDayun(scores: ScoreMap): ScoreMap {
    let result = this.applyTenGod(scores, this.dayun_stem, 0.40);
    const branchElem = BRANCH_ELEMENT[this.dayun_branch];
    if (branchElem) {
      const key = `${this.day_element}_${branchElem}_${this.is_yang}`;
      const tenGod = TEN_GOD_MAP[key];
      if (tenGod && TEN_GOD_INFLUENCE[tenGod]) {
        result = addScore(result, TEN_GOD_INFLUENCE[tenGod], 0.27);
      }
    }
    return result;
  }

  /** 대운-일진 상호작용 보정 (STEP 5) */
  private applyDayunInteraction(scores: ScoreMap, targetStem: string, targetBranch: string): ScoreMap {
    let result = { ...scores };

    // 대운 천간 = 일진 천간: 해당 십성 효과 ×2
    if (this.dayun_stem === targetStem) {
      const tenGod = this.getTenGod(targetStem);
      if (tenGod && TEN_GOD_INFLUENCE[tenGod]) {
        result = addScore(result, TEN_GOD_INFLUENCE[tenGod], 0.5); // 0.5 추가 = 기존 대비 비례 보정
      }
    }

    // 대운 지지 = 일진 지지: 해당 지지 관계 효과 ×2
    if (this.dayun_branch === targetBranch) {
      result = addScore(result, uniformScore(7)); // 복음(+10) 2배 → 추가 +7 (TG 스케일 비례 보정)
    }

    // 대운 천간과 일진 천간이 충
    if (STEM_CLASH_PAIRS.some(([s1, s2]) =>
        (this.dayun_stem === s1 && targetStem === s2) ||
        (this.dayun_stem === s2 && targetStem === s1))) {
      result = addScore(result, uniformScore(-10));
    }

    // 대운 지지와 일진 지지가 충
    if (isPair(this.dayun_branch, targetBranch, CHONG_PAIRS)) {
      result = addScore(result, uniformScore(-10));
    }

    // 대운과 일진 지지가 합
    if (isPair(this.dayun_branch, targetBranch, YUKHAP_PAIRS)) {
      result = addScore(result, uniformScore(7));
    }

    return result;
  }

  /** 천간 충 적용 */
  private applyStemClash(scores: ScoreMap, targetStem: string): ScoreMap {
    const chartStems = [this.day_stem, this.month_stem, this.year_stem];
    let result = { ...scores };
    for (const [s1, s2] of STEM_CLASH_PAIRS) {
      if ((targetStem === s1 && chartStems.includes(s2)) ||
          (targetStem === s2 && chartStems.includes(s1))) {
        result = addScore(result, uniformScore(-8));
      }
    }
    return result;
  }

  /** FIX 3: 도메인별 전체 충(沖) 패널티 합산 (스칼라) */
  private computeClashPenalty(
    targetStem: string, targetBranch: string,
    monthStem: string, monthBranch: string,
    chartBranches: string[],
  ): number {
    let penalty = 0;
    const chartStems = [this.day_stem, this.month_stem, this.year_stem];

    // 일진 지지 충
    for (const rel of getBranchRelations(targetBranch, chartBranches)) {
      if (rel.type === "충") {
        penalty += rel.value;
      }
    }
    // 월 지지 충
    for (const rel of getBranchRelations(monthBranch, chartBranches)) {
      if (rel.type === "충") {
        penalty += rel.value;
      }
    }
    // 일진 천간 충
    for (const [s1, s2] of STEM_CLASH_PAIRS) {
      if ((targetStem === s1 && chartStems.includes(s2)) ||
          (targetStem === s2 && chartStems.includes(s1))) {
        penalty -= 8;
      }
    }
    // 월 천간 충
    for (const [s1, s2] of STEM_CLASH_PAIRS) {
      if ((monthStem === s1 && chartStems.includes(s2)) ||
          (monthStem === s2 && chartStems.includes(s1))) {
        penalty -= 8;
      }
    }
    // 대운-일진 천간 충
    if (STEM_CLASH_PAIRS.some(([s1, s2]) =>
        (this.dayun_stem === s1 && targetStem === s2) ||
        (this.dayun_stem === s2 && targetStem === s1))) {
      penalty -= 10;
    }
    // 대운-일진 지지 충
    if (isPair(this.dayun_branch, targetBranch, CHONG_PAIRS)) {
      penalty -= 10;
    }

    return penalty;
  }

  /** 절기(節氣) 기준 월주(月柱) 계산 */
  private dateToMonthPillar(date: Date): [string, string] {
    const JIEQI: [number, number, number][] = [
      [1,  6,  1],  // 소한 → 丑月
      [2,  4,  2],  // 입춘 → 寅月
      [3,  6,  3],  // 경칩 → 卯月
      [4,  5,  4],  // 청명 → 辰月
      [5,  6,  5],  // 입하 → 巳月
      [6,  6,  6],  // 망종 → 午月
      [7,  7,  7],  // 소서 → 未月
      [8,  7,  8],  // 입추 → 申月
      [9,  8,  9],  // 백로 → 酉月
      [10, 8, 10],  // 한로 → 戌月
      [11, 7, 11],  // 입동 → 亥月
      [12, 7,  0],  // 대설 → 子月
    ];
    const m = date.getMonth() + 1;
    const d = date.getDate();
    let branchIdx = 0;
    for (let i = JIEQI.length - 1; i >= 0; i--) {
      const [jm, jd, bIdx] = JIEQI[i];
      if (m > jm || (m === jm && d >= jd)) { branchIdx = bIdx; break; }
    }
    const year = date.getFullYear();
    const sajuYear = (m === 1 || (m === 2 && d < 4)) ? year - 1 : year;
    const yearStemIdx = ((sajuYear - 1900) % 10 + 10) % 10;
    const yinStartStem = ((yearStemIdx % 5) * 2 + 2) % 10;
    const stemIdx = (yinStartStem + ((branchIdx - 2 + 12) % 12)) % 10;
    return [HEAVENLY_STEMS[stemIdx], EARTHLY_BRANCHES[branchIdx]];
  }

  calculate(targetDate: Date, flags: SajuExperimentFlags = DEFAULT_SAJU_FLAGS): { scores: ScoreMap; factors: Record<string, unknown>; contributions: { key: string; value: number }[] } {
    const [targetStem, targetBranch] = this.dateToStemBranch(targetDate);
    const [monthStem, monthBranch] = this.dateToMonthPillar(targetDate);
    const chartBranches = [this.day_branch, this.month_branch, this.year_branch, this.hour_branch];

    let scores = baseScore();

    // 원국 내 고정 패널티 (매일 자동 적용)
    if (!flags.SKIP_NATAL_PENALTY) scores = addScore(scores, this.natal_fixed_penalty);

    // 출생 월주 천간 (0.53) — 정적: 프로필마다 고정
    if (!flags.SKIP_BIRTH_MONTH_TG) scores = this.applyTenGod(scores, this.month_stem, 0.53);
    // 현재 월주 천간 (0.47) — 동적: 모든 유저 공통
    const _bMonthTg = { ...scores };
    scores = this.applyTenGod(scores, monthStem, 0.47);
    const _cMonthTg = { key: this.getTenGod(monthStem) ?? "", value: _avgDelta6(scores, _bMonthTg) };
    // 특별성 — static 모드이고 skip 플래그 없을 때만 직접 가산
    if (flags.SPECIAL_STARS_MODE === "static" && !flags.SKIP_SPECIAL_STARS) {
      scores = this.applySpecialStars(scores);
    }
    // 대운 고정 영향 — 정적: 대운 기간 내 매일 동일
    if (!flags.SKIP_DAYUN) scores = this.applyDayun(scores);
    // 현재 일진 지지 관계
    const _bBranch = { ...scores };
    scores = applyBranchRelationsToScore(scores, targetBranch, chartBranches);
    const _cBranch = { key: targetBranch, value: _avgDelta6(scores, _bBranch) };
    // 현재 월 지지 관계
    scores = applyBranchRelationsToScore(scores, monthBranch, chartBranches);
    // 천간 충
    scores = this.applyStemClash(scores, targetStem);
    scores = this.applyStemClash(scores, monthStem);
    // 대운-일진 상호작용
    scores = this.applyDayunInteraction(scores, targetStem, targetBranch);
    // FIX 3: 전체 충 패널티 상한 -20 적용
    {
      const totalClash = this.computeClashPenalty(targetStem, targetBranch, monthStem, monthBranch, chartBranches);
      const clashAdj = Math.max(totalClash, -20) - totalClash;
      if (clashAdj !== 0) {
        const ck = Object.keys(scores) as (keyof ScoreMap)[];
        ck.forEach(k => { scores[k] += clashAdj; });
      }
    }
    // 일진 천간 십성 (0.33)
    const _bDayTg = { ...scores };
    scores = this.applyTenGod(scores, targetStem, 0.33);
    const _cDayTg = { key: this.getTenGod(targetStem) ?? "", value: _avgDelta6(scores, _bDayTg) };

    // 일간 오행 극 건강 패널티
    const ELEMENT_克: Record<string, string> = {
      "木": "土", "土": "水", "水": "火", "火": "金", "金": "木",
    };
    const targetStemElement   = STEM_ELEMENT[targetStem];
    const targetBranchElement = BRANCH_ELEMENT[targetBranch];
    const ohaengClashStem     = !!(targetStemElement   && ELEMENT_克[targetStemElement]   === this.day_element);
    const ohaengClashBranch   = !!(targetBranchElement && ELEMENT_克[targetBranchElement] === this.day_element);
    // 천간 오행이 일간을 극하면 -6
    if (ohaengClashStem)   scores.health -= 6;
    // 지지 오행도 일간을 극하면 추가 -3 (천간·지지 동시 극이면 오행 압박 가중)
    if (ohaengClashBranch) scores.health -= 3;

    // 지지 관계 타입 목록 (state atom layer에서 사용)
    const dayBranchRelTypes   = getBranchRelations(targetBranch, chartBranches).map(r => r.type);
    const monthBranchRelTypes = getBranchRelations(monthBranch,  chartBranches).map(r => r.type);
    const branchRelTypes      = [...dayBranchRelTypes, ...monthBranchRelTypes];

    const keys = Object.keys(scores) as (keyof ScoreMap)[];
    keys.forEach(k => { scores[k] = Math.max(0, Math.min(100, scores[k])); });

    const profileSpecialStars: SpecialStarInfo[] = this.special_stars
      .map(star => {
        const meta = SPECIAL_STARS_META[star];
        return meta
          ? { key: meta.key, label: star, polarity: meta.polarity }
          : { key: `saju.star.${star}`, label: star, polarity: "mixed" as const };
      });

    // 12운성 체크
    const twelveStatesMapping = getTwelveStatesMapping(this.day_stem);
    let twelve_state: string | null = null;
    for (const [stateName, stateBranch] of Object.entries(twelveStatesMapping)) {
      if (targetBranch === stateBranch) {
        // 긍정/중립 7개만 활성화
        if (["장생", "건록", "제왕", "양", "관대", "목욕", "태"].includes(stateName)) {
          twelve_state = stateName;
          break;
        }
      }
    }

    // 도화살 체크
    const hasDoHwa = [this.day_branch, this.month_branch].some(b => DOHWA_BRANCHES.includes(b));
    const doHwa_active = hasDoHwa && DOHWA_BRANCHES.includes(targetBranch);

    return {
      scores,
      factors: {
        day_stem:                 this.day_stem,
        target_stem:              targetStem,
        target_branch:            targetBranch,
        month_stem:               monthStem,
        month_branch:             monthBranch,
        dayun:                    `${this.dayun_stem}${this.dayun_branch}`,
        ten_god_of_month:         this.getTenGod(this.month_stem),
        ten_god_of_target_month:  this.getTenGod(monthStem),
        ten_god_of_day:           this.getTenGod(targetStem),
        active_stars:             this.special_stars,
        natal_fixed_penalty:      this.natal_fixed_penalty.overall,
        branch_relation_types:        branchRelTypes,
        day_branch_relation_types:    dayBranchRelTypes,
        month_branch_relation_types:  monthBranchRelTypes,
        ohaeng_clash_stem:        ohaengClashStem,
        ohaeng_clash_branch:      ohaengClashBranch,
        profile_special_stars:    profileSpecialStars,
        twelve_state:             twelve_state,
        doHwa_active:             doHwa_active,
      },
      contributions: [_cDayTg, _cMonthTg, _cBranch].filter(c => c.key !== ""),
    };
  }

  dateToStemBranch(d: Date): [string, string] {
    const base = new Date(1900, 0, 1);
    const delta = Math.floor((d.getTime() - base.getTime()) / 86400000);
    // 1900-01-01 = 乙亥(1, 11) — orrery 1996-02-04 辛未(7,7) 기준 역산
    const stemIdx   = ((delta + 1)  % 10 + 10) % 10;
    const branchIdx = ((delta + 11) % 12 + 12) % 12;
    return [HEAVENLY_STEMS[stemIdx], EARTHLY_BRANCHES[branchIdx]];
  }
}

export function buildSajuEngineFromProfile(profile: SajuEngineProfile): SajuEngine {
  return new SajuEngine(profile);
}

// ── 사주 실험 플래그 ──────────────────────────────────────────────────────────
export interface SajuExperimentFlags {
  /**
   * "static"    : 현행 — 매일 SPECIAL_STARS 점수를 직접 가산 (기본값)
   * "amplifier" : 실험 — 특별성을 점수 상수 대신 state atom 배율로만 작용
   */
  SPECIAL_STARS_MODE: "static" | "amplifier";

  /**
   * 정적 기준선 분리 실험 — true 시 해당 정적 요소를 계산에서 제외.
   * 기본값 false (현행 유지). 요소별 독립 on/off 가능.
   */
  SKIP_NATAL_PENALTY?:   boolean;  // 원국 내 지지 충돌 패널티
  SKIP_BIRTH_MONTH_TG?:  boolean;  // 출생월 천간 TG (0.53)
  SKIP_SPECIAL_STARS?:   boolean;  // 특별성 직접 점수 (static 모드에서만)
  SKIP_DAYUN?:           boolean;  // 대운 TG 고정 영향
}

/** 현행 기본 플래그 — 특별성 점수 분리(1차) 적용됨 */
export const DEFAULT_SAJU_FLAGS: SajuExperimentFlags = {
  SPECIAL_STARS_MODE: "static",
  SKIP_SPECIAL_STARS:  true,   // 특별성 직접 점수 제거 (profileSpecialStars 메타데이터로 이동)
};

/** 구 동작 플래그 — 비교 실험 전용, 프로덕션 미사용 */
export const LEGACY_SAJU_FLAGS: SajuExperimentFlags = {
  SPECIAL_STARS_MODE: "static",
  SKIP_SPECIAL_STARS:  false,
};

export const AMPLIFIER_SAJU_FLAGS: SajuExperimentFlags = {
  SPECIAL_STARS_MODE: "amplifier",
  SKIP_SPECIAL_STARS:  true,
};

/** 4가지 정적 요소 전부 제외 — 동적 일진 신호만 유지 */
export const DYNAMIC_ONLY_SAJU_FLAGS: SajuExperimentFlags = {
  SPECIAL_STARS_MODE: "static",
  SKIP_NATAL_PENALTY:  true,
  SKIP_BIRTH_MONTH_TG: true,
  SKIP_SPECIAL_STARS:  true,
  SKIP_DAYUN:          true,
};
