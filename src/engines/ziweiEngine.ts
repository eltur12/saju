/**
 * 자미두수(紫微斗數) 분석 엔진
 */
import type { ScoreMap } from "./sajuEngine";
import { EARTHLY_BRANCHES } from "./sajuEngine";

// ──────────────────────────────────────────────
// 상수 테이블
// ──────────────────────────────────────────────

/** 주성 강약(廟旺得平陷) 보정값 */
const BRIGHTNESS_SCORE: Record<string, number> = {
  "廟": 8, "旺": 6, "得": 4, "利": 2, "平": 0, "不": -3, "陷": -8,
};

/** 활성화 궁별 기본 보정값 */
const PALACE_ACTIVATION: Record<string, number> = {
  "命宮": 12, "財帛": 10, "官祿": 10, "夫妻": 8, "交友": 7,
  "福德": 6,  "遷移": 5,  "田宅": 4,  "父母": 6, "子女": 3,
  "兄弟": 2,  "疾厄": -3,
};

/** 사화(四化) 활성화 보정 */
const SIHUA_ACTIVE: Record<string, number> = {
  "化祿": 10, "化權": 8, "化科": 8, "化忌": -12,
};

/** 사화 패시브 보정 (매일) */
const SIHUA_PASSIVE: Record<string, number> = {
  "化祿": 3, "化權": 2, "化科": 2, "化忌": -5,
};

/** 길성(吉星) 보정 */
const LUCKY_STARS: Record<string, number> = {
  "祿存": 5, "左輔": 4, "右弼": 4, "文昌": 4, "文曲": 4,
  "天魁": 4, "天鉞": 4, "天馬": 4,
};

/** 살성(煞星) 보정 */
const UNLUCKY_STARS: Record<string, number> = {
  "擎羊": -6, "陀羅": -5, "火星": -5, "鈴星": -4,
  "地空": -6, "地劫": -6, "大耗": -4,
};

/** 궁별 도메인 가중치 */
const PALACE_WEIGHT: Record<string, ScoreMap> = {
  "命宮":  { overall:1.0, wealth:0.5, love:0.5, health:0.5, career:0.5,  relations:0.5, study:0.4 },
  "兄弟":  { overall:0.3, wealth:0.3, love:0.5, health:0.3, career:0.3,  relations:0.6, study:0.3 },
  "夫妻":  { overall:0.5, wealth:0.3, love:1.2, health:0.3, career:0.3,  relations:0.5, study:0.2 },
  "子女":  { overall:0.5, wealth:0.5, love:0.5, health:0.5, career:0.5,  relations:0.4, study:0.6 },
  "財帛":  { overall:0.5, wealth:1.5, love:0.3, health:0.3, career:0.5,  relations:0.3, study:0.2 },
  "疾厄":  { overall:0.5, wealth:0.3, love:0.3, health:1.5, career:0.3,  relations:0.3, study:0.3 },
  "遷移":  { overall:0.5, wealth:0.5, love:0.5, health:0.5, career:0.8,  relations:0.5, study:0.4 },
  "交友":  { overall:0.5, wealth:0.3, love:0.8, health:0.3, career:0.5,  relations:1.2, study:0.3 },
  "官祿":  { overall:0.5, wealth:0.5, love:0.3, health:0.3, career:1.5,  relations:0.4, study:0.5 },
  "田宅":  { overall:0.5, wealth:0.8, love:0.3, health:0.5, career:0.3,  relations:0.3, study:0.2 },
  "福德":  { overall:0.8, wealth:0.5, love:0.5, health:0.8, career:0.3,  relations:0.4, study:0.5 },
  "父母":  { overall:0.3, wealth:0.3, love:0.3, health:0.5, career:0.5,  relations:0.5, study:0.90 },
};

const DEFAULT_WEIGHT: ScoreMap = { overall:0.5, wealth:0.5, love:0.5, health:0.5, career:0.5, relations:0.5, study:0.5 };

// ──────────────────────────────────────────────
// 실험 플래그
// ──────────────────────────────────────────────

export interface ZiweiExperimentFlags {
  /** 명궁 기본점수 + 부처궁 패시브 페널티 적용 여부 */
  USE_NATAL_ZIWEI:       boolean;
  /** 원국·유년 사화 패시브 적용 여부 */
  USE_SIHUA_PASSIVE:     boolean;
  /** 활성 궁 사화 강화 보정 적용 여부 */
  USE_SIHUA_ACTIVE:      boolean;
  /** 대한(大限) 적용 여부 */
  USE_DAEHAN:            boolean;
  /** 유월(流月) 가중치 (기본 0.4) */
  MONTHLY_PALACE_WEIGHT: number;
}

export const DEFAULT_ZIWEI_FLAGS: ZiweiExperimentFlags = {
  USE_NATAL_ZIWEI:       true,
  USE_SIHUA_PASSIVE:     true,
  USE_SIHUA_ACTIVE:      true,
  USE_DAEHAN:            true,
  MONTHLY_PALACE_WEIGHT: 0.4,
};

export const EXPERIMENT_ZIWEI_FLAGS: ZiweiExperimentFlags = {
  USE_NATAL_ZIWEI:       false,
  USE_SIHUA_PASSIVE:     false,
  USE_SIHUA_ACTIVE:      false,
  USE_DAEHAN:            false,
  MONTHLY_PALACE_WEIGHT: 0.2,
};

/** 일 활성 궁만 남김 (monthly_palace 완전 제거) */
export const EXPERIMENT_ZIWEI_FLAGS_0: ZiweiExperimentFlags = {
  USE_NATAL_ZIWEI:       false,
  USE_SIHUA_PASSIVE:     false,
  USE_SIHUA_ACTIVE:      false,
  USE_DAEHAN:            false,
  MONTHLY_PALACE_WEIGHT: 0,
};

/** 일 활성 궁 + monthly_palace 약 반영 */
export const EXPERIMENT_ZIWEI_FLAGS_01: ZiweiExperimentFlags = {
  USE_NATAL_ZIWEI:       false,
  USE_SIHUA_PASSIVE:     false,
  USE_SIHUA_ACTIVE:      false,
  USE_DAEHAN:            false,
  MONTHLY_PALACE_WEIGHT: 0.1,
};

// ──────────────────────────────────────────────
// 인터페이스
// ──────────────────────────────────────────────

export interface PalaceData {
  main_stars: string[];
  lucky_stars: string[];
  unlucky_stars: string[];
  branch: string;
  star_strengths: Record<string, string>;  // 별 이름 → 廟旺得平陷
}

export interface ZiweiProfile {
  palaces: Record<string, PalaceData>;
  sihua: Record<string, { palace: string; star: string }>;
  current_dahan: string;
  dahan_stars: string[];
  /** 유월(流月): 월별 활성 궁 이름 [0=1월 .. 11=12월] */
  monthly_palaces: string[];
  /** 유년 사화(流年四化): 化祿·化權·化科·化忌 → 궁 이름 */
  year_sihua_palaces: Record<string, string>;
}

// ──────────────────────────────────────────────
// 유틸
// ──────────────────────────────────────────────

function zeroScore(): ScoreMap {
  return { overall:0, wealth:0, love:0, health:0, career:0, relations:0, study:0 };
}

function addWeighted(scores: ScoreMap, value: number, weight: ScoreMap): ScoreMap {
  const result = { ...scores };
  const keys = Object.keys(result) as (keyof ScoreMap)[];
  keys.forEach(k => { result[k] += Math.trunc(value * weight[k]); });
  return result;
}

function addUniform(scores: ScoreMap, value: number): ScoreMap {
  const result = { ...scores };
  const keys = Object.keys(result) as (keyof ScoreMap)[];
  keys.forEach(k => { result[k] += value; });
  return result;
}

/** 오늘 날짜의 일진 지지를 구한다 (1900-01-01 = 亥(11) — orrery 기준) */
function dateToEarthlyBranch(d: Date): string {
  const base = new Date(1900, 0, 1);
  const delta = Math.floor((d.getTime() - base.getTime()) / 86400000);
  const branchIdx = ((delta + 11) % 12 + 12) % 12;
  return EARTHLY_BRANCHES[branchIdx];
}

// ──────────────────────────────────────────────
// 엔진
// ──────────────────────────────────────────────

const _DOMAIN6_ZW = ["wealth", "love", "health", "career", "relations", "study"] as const;
function _avgDelta6Zw(after: ScoreMap, before: ScoreMap): number {
  return _DOMAIN6_ZW.reduce((s, c) => s + (after[c] - before[c]), 0) / 6;
}

export class ZiweiEngine {
  private palaces: Record<string, PalaceData>;
  private sihua: Record<string, { palace: string; star: string }>;
  private current_dahan: string;
  private dahan_stars: string[];
  private monthly_palaces: string[];
  private year_sihua_palaces: Record<string, string>;

  constructor(p: ZiweiProfile) {
    this.palaces            = p.palaces;
    this.sihua              = p.sihua;
    this.current_dahan      = p.current_dahan;
    this.dahan_stars        = p.dahan_stars;
    this.monthly_palaces    = p.monthly_palaces;
    this.year_sihua_palaces = p.year_sihua_palaces;
  }

  /** 궁의 주성 강약 보정 합산 */
  private palaceBrightnessScore(palace: PalaceData): number {
    let score = 0;
    for (const star of palace.main_stars) {
      const brightness = palace.star_strengths[star];
      if (brightness) score += BRIGHTNESS_SCORE[brightness] ?? 0;
    }
    return score;
  }

  /** 궁의 기본 점수 (주성+길성+살성) */
  private palaceScore(palaceName: string): ScoreMap {
    const base = zeroScore();
    const palace = this.palaces[palaceName];
    if (!palace) return base;
    const weight = PALACE_WEIGHT[palaceName] ?? DEFAULT_WEIGHT;

    // 주성 강약
    const brightnessVal = this.palaceBrightnessScore(palace);
    const scores = addWeighted(base, brightnessVal, weight);

    // 길성
    let result = scores;
    for (const star of palace.lucky_stars) {
      const bonus = LUCKY_STARS[star] ?? 3;
      result = addWeighted(result, bonus, weight);
    }

    // 살성
    for (const star of palace.unlucky_stars) {
      const penalty = UNLUCKY_STARS[star] ?? -3;
      result = addWeighted(result, penalty, weight);
    }

    return result;
  }

  /**
   * 궁 가중치를 패시브용으로 변환 — 각 도메인 값을 1.0으로 상한 적용
   * 관록궁(career 1.5 등) 같은 고가중 궁의 패시브 과대 증폭을 방지
   */
  private passiveWeight(palaceName: string): ScoreMap {
    const raw = PALACE_WEIGHT[palaceName] ?? DEFAULT_WEIGHT;
    const keys = Object.keys(raw) as (keyof ScoreMap)[];
    const capped = { ...raw };
    keys.forEach(k => { capped[k] = Math.min(raw[k], 1.0); });
    return capped;
  }

  /** 원국 사화 패시브 적용 */
  private applySihuaPassive(scores: ScoreMap): ScoreMap {
    let result = { ...scores };
    for (const [sihuaType, passive] of Object.entries(SIHUA_PASSIVE)) {
      const palace = this.sihua[sihuaType]?.palace;
      if (palace) {
        result = addWeighted(result, passive, this.passiveWeight(palace));
      }
    }
    return result;
  }

  /** 유년 사화 패시브 적용 (원국의 0.5배) */
  private applyYearSihuaPassive(scores: ScoreMap): ScoreMap {
    let result = { ...scores };
    for (const [sihuaType, passive] of Object.entries(SIHUA_PASSIVE)) {
      const palace = this.year_sihua_palaces[sihuaType];
      if (palace) {
        result = addWeighted(result, Math.trunc(passive * 0.5), this.passiveWeight(palace));
      }
    }
    return result;
  }

  /** 활성화된 궁의 사화 보정 (활성 시 강화) */
  private applySihuaActive(scores: ScoreMap, activePalaceName: string): ScoreMap {
    let result = { ...scores };
    const weight = PALACE_WEIGHT[activePalaceName] ?? DEFAULT_WEIGHT;

    // 원국 사화
    for (const [sihuaType, activeVal] of Object.entries(SIHUA_ACTIVE)) {
      if (this.sihua[sihuaType]?.palace === activePalaceName) {
        result = addWeighted(result, activeVal, weight);
      }
    }
    // 유년 사화
    for (const [sihuaType, activeVal] of Object.entries(SIHUA_ACTIVE)) {
      if (this.year_sihua_palaces[sihuaType] === activePalaceName) {
        result = addWeighted(result, Math.trunc(activeVal * 0.5), weight);
      }
    }
    return result;
  }

  /** 대한(大限) 적용 */
  private applyDahan(scores: ScoreMap): ScoreMap {
    const dahanScores = this.palaceScore(this.current_dahan);
    const keys = Object.keys(scores) as (keyof ScoreMap)[];
    let result = { ...scores };
    keys.forEach(k => { result[k] += Math.trunc((dahanScores[k] ?? 0) * 0.45); });

    // 대한 궁별 도메인 직접 보정
    switch (this.current_dahan) {
      case "財帛": result.wealth += 5; break;
      case "官祿": result.career += 3; break;
      case "命宮": result = addUniform(result, 5); break;
      case "疾厄": result.health -= 3; break;
      case "夫妻": {
        result.love += 5;
        // 부처궁 살성 있으면 연애 추가 -6
        const fuqi = this.palaces["夫妻"];
        if (fuqi && fuqi.unlucky_stars.length > 0) result.love -= 6;
        break;
      }
      default: {
        // 기타 궁 해당 영역 +2
        const weight = PALACE_WEIGHT[this.current_dahan];
        if (weight) {
          const maxDomain = (Object.keys(weight) as (keyof ScoreMap)[])
            .filter(k => k !== "overall")
            .reduce((best, k) => weight[k] > weight[best] ? k : best, "career" as keyof ScoreMap);
          result[maxDomain] += 2;
        }
        break;
      }
    }

    // 대한 주성 강약
    const dahanWeight = PALACE_WEIGHT[this.current_dahan] ?? DEFAULT_WEIGHT;
    const dahanPalace = this.palaces[this.current_dahan];
    if (dahanPalace) {
      for (const star of this.dahan_stars) {
        const brightness = dahanPalace.star_strengths[star];
        if (brightness) {
          result = addWeighted(result, Math.trunc((BRIGHTNESS_SCORE[brightness] ?? 0) * 0.3), dahanWeight);
        }
      }
    }
    return result;
  }

  calculate(targetDate: Date, flags: ZiweiExperimentFlags = DEFAULT_ZIWEI_FLAGS): { scores: ScoreMap; factors: Record<string, unknown>; contributions: { key: string; value: number }[] } {
    const scores = zeroScore();
    const todayBranch = dateToEarthlyBranch(targetDate);

    let result = { ...scores };
    const keys = Object.keys(result) as (keyof ScoreMap)[];

    // 명궁 기본 점수
    if (flags.USE_NATAL_ZIWEI) {
      const mingScores = this.palaceScore("命宮");
      keys.forEach(k => { result[k] += mingScores[k] ?? 0; });
    }

    // 사화 패시브 (매일 배경 효과)
    if (flags.USE_SIHUA_PASSIVE) {
      result = this.applySihuaPassive(result);
      result = this.applyYearSihuaPassive(result);
    }

    // 부처궁 살성 패시브 연애 페널티
    if (flags.USE_NATAL_ZIWEI) {
      const fuqi = this.palaces["夫妻"];
      if (fuqi && fuqi.unlucky_stars.length > 0) {
        result.love -= 3;
      }
    }

    // 대한 적용
    if (flags.USE_DAEHAN) {
      result = this.applyDahan(result);
    }

    // ── 오늘 일진 지지 기반 활성 궁 판단 ──
    let activePalaceName = "";
    for (const [palaceName, palace] of Object.entries(this.palaces)) {
      if (palace.branch === todayBranch) {
        activePalaceName = palaceName;
        break;
      }
    }

    const _bActivePalace = { ...result };
    if (activePalaceName) {
      // 활성화 궁 기본 보정 — 균등(uniform) 적용 (규칙서 "직장 직접 상승" 등은 단순 flat값)
      const activationBase = PALACE_ACTIVATION[activePalaceName] ?? 0;
      result = addUniform(result, activationBase);

      // 활성화 궁 주성 강약 — 가중치 상한 1.0
      const cappedWeight = this.passiveWeight(activePalaceName);
      const brightness = this.palaceBrightnessScore(this.palaces[activePalaceName]);
      result = addWeighted(result, brightness, cappedWeight);

      // 활성화 궁 살성 — 가중치 상한 1.0
      for (const star of this.palaces[activePalaceName].unlucky_stars) {
        const penalty = UNLUCKY_STARS[star] ?? -3;
        result = addWeighted(result, penalty, cappedWeight);
      }

      // 활성화 궁 길성 — 공궁(주성 없음)이면 길성 효과 제외 (활성화 base만 적용)
      const isGonggung = this.palaces[activePalaceName].main_stars.length === 0;
      if (!isGonggung) {
        for (const star of this.palaces[activePalaceName].lucky_stars) {
          const bonus = LUCKY_STARS[star] ?? 3;
          result = addWeighted(result, bonus, cappedWeight);
        }
      }

      // 사화 활성화 보정
      if (flags.USE_SIHUA_ACTIVE) {
        result = this.applySihuaActive(result, activePalaceName);
      }

      // 천마(天馬)가 관록궁에 있으면 직장 +4 (단, 공궁이면 절반만)
      if (activePalaceName === "官祿" && this.palaces["官祿"]?.lucky_stars.includes("天馬")) {
        result.career += isGonggung ? 2 : 4;
      }
    }

    const _cActivePalace = activePalaceName
      ? { key: activePalaceName, value: _avgDelta6Zw(result, _bActivePalace) }
      : null;

    // 유월(流月): 달력 월 기준 활성 궁
    const _bMonthly = { ...result };
    const monthlyPalace = this.monthly_palaces[targetDate.getMonth()] ?? "命宮";
    const monthlyScores = this.palaceScore(monthlyPalace);
    keys.forEach(k => { result[k] += Math.trunc((monthlyScores[k] ?? 0) * flags.MONTHLY_PALACE_WEIGHT); });
    const _cMonthly = { key: monthlyPalace, value: _avgDelta6Zw(result, _bMonthly) };

    return {
      scores: result,
      factors: {
        current_dahan:     this.current_dahan,
        dahan_stars:       this.dahan_stars,
        sihua_summary:     Object.fromEntries(Object.entries(this.sihua).map(([k, v]) => [k, v.palace])),
        monthly_palace:    monthlyPalace,
        today_branch:      todayBranch,
        active_palace:     activePalaceName || null,
      },
      contributions: [_cActivePalace, _cMonthly].filter(Boolean) as { key: string; value: number }[],
    };
  }
}

export const SAMPLE_ZIWEI_PROFILE: ZiweiProfile = {
  palaces: {
    "命宮":  { main_stars:["天相"],         lucky_stars:[],               unlucky_stars:["擎羊"], branch:"寅", star_strengths:{"天相":"廟"} },
    "兄弟":  { main_stars:["巨門"],         lucky_stars:["祿存"],         unlucky_stars:[],       branch:"卯", star_strengths:{"巨門":"旺"} },
    "夫妻":  { main_stars:["廉貞","貪狼"],  lucky_stars:[],               unlucky_stars:["地空","地劫","陀羅"], branch:"辰", star_strengths:{"廉貞":"陷","貪狼":"平"} },
    "子女":  { main_stars:["太陰"],         lucky_stars:["文昌"],         unlucky_stars:["鈴星"], branch:"巳", star_strengths:{"太陰":"陷"} },
    "財帛":  { main_stars:["天府"],         lucky_stars:["左輔"],         unlucky_stars:[],       branch:"午", star_strengths:{"天府":"廟"} },
    "疾厄":  { main_stars:[],               lucky_stars:[],               unlucky_stars:[],       branch:"未", star_strengths:{} },
    "遷移":  { main_stars:["紫微","破軍"],  lucky_stars:[],               unlucky_stars:[],       branch:"申", star_strengths:{"紫微":"得","破軍":"廟"} },
    "交友":  { main_stars:["天機"],         lucky_stars:[],               unlucky_stars:[],       branch:"酉", star_strengths:{"天機":"陷"} },
    "官祿":  { main_stars:[],               lucky_stars:["右弼","天魁","天馬"], unlucky_stars:[],  branch:"戌", star_strengths:{} },
    "田宅":  { main_stars:["太陽"],         lucky_stars:["文曲"],         unlucky_stars:[],       branch:"亥", star_strengths:{"太陽":"陷"} },
    "福德":  { main_stars:["武曲","七殺"],  lucky_stars:["天鉞"],         unlucky_stars:["火星"], branch:"子", star_strengths:{"武曲":"廟","七殺":"旺"} },
    "父母":  { main_stars:["天同","天梁"],  lucky_stars:[],               unlucky_stars:[],       branch:"丑", star_strengths:{"天同":"廟","天梁":"旺"} },
  },
  sihua: {
    "化祿":{"palace":"子女","star":"太陰"},
    "化權":{"palace":"父母","star":"天同"},
    "化科":{"palace":"交友","star":"天機"},
    "化忌":{"palace":"兄弟","star":"巨門"},
  },
  current_dahan: "夫妻",
  dahan_stars: ["廉貞","貪狼"],
  monthly_palaces: ["命宮","兄弟","夫妻","子女","財帛","疾厄","遷移","交友","官祿","田宅","福德","父母"],
  year_sihua_palaces: { "化祿":"官祿", "化權":"財帛", "化科":"遷移", "化忌":"疾厄" },
};

export function buildZiweiEngineFromProfile(profile: ZiweiProfile): ZiweiEngine {
  return new ZiweiEngine(profile);
}
