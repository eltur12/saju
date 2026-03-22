/**
 * 사주(四柱八字) 분석 엔진
 */

export type ScoreMap = { overall: number; wealth: number; love: number; health: number; career: number };

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

const TEN_GOD_INFLUENCE: Record<string, ScoreMap> = {
  "比肩":{"overall":0,"wealth":-5,"love":0,"health":5,"career":0},
  "劫財":{"overall":0,"wealth":-8,"love":-3,"health":3,"career":0},
  "食神":{"overall":5,"wealth":5,"love":5,"health":8,"career":5},
  "傷官":{"overall":5,"wealth":3,"love":-5,"health":0,"career":10},
  "偏財":{"overall":8,"wealth":10,"love":5,"health":0,"career":5},
  "正財":{"overall":8,"wealth":12,"love":3,"health":0,"career":8},
  "偏官":{"overall":-3,"wealth":0,"love":-5,"health":-5,"career":-3},
  "正官":{"overall":5,"wealth":0,"love":3,"health":0,"career":10},
  "偏印":{"overall":0,"wealth":-3,"love":-3,"health":5,"career":3},
  "正印":{"overall":5,"wealth":0,"love":0,"health":8,"career":5},
};

const SPECIAL_STARS: Record<string, ScoreMap> = {
  "천덕귀인":{"overall":10,"wealth":8,"love":5,"health":8,"career":8},
  "월덕귀인":{"overall":8,"wealth":10,"love":5,"health":5,"career":5},
  "도화살":{"overall":0,"wealth":0,"love":15,"health":0,"career":-3},
  "역마살":{"overall":3,"wealth":5,"love":-3,"health":-3,"career":8},
  "화개살":{"overall":0,"wealth":-3,"love":-5,"health":5,"career":3},
  "겁살":{"overall":-5,"wealth":-8,"love":-5,"health":-5,"career":-5},
  "백호살":{"overall":-5,"wealth":0,"love":-3,"health":-8,"career":-3},
};

const BRANCH_CONFLICTS: Record<string, [string,string][]> = {
  "害":[["子","未"],["丑","午"],["寅","巳"],["卯","辰"],["申","亥"],["酉","戌"]],
  "沖":[["子","午"],["丑","未"],["寅","申"],["卯","酉"],["辰","戌"],["巳","亥"]],
  "刑":[["子","卯"],["丑","戌"],["寅","巳"],["未","丑"],["申","寅"],["酉","卯"]],
};

const CONFLICT_PENALTY: Record<string, ScoreMap> = {
  "害":{"overall":-5,"wealth":-3,"love":-5,"health":-8,"career":-3},
  "沖":{"overall":-8,"wealth":-5,"love":-8,"health":-5,"career":-8},
  "刑":{"overall":-5,"wealth":-3,"love":-3,"health":-8,"career":-5},
};

const STEM_CLASH: [string,string][] = [
  ["甲","庚"],["乙","辛"],["丙","壬"],["丁","癸"],["戊","甲"],["己","乙"],
  ["庚","丙"],["辛","丁"],["壬","戊"],["癸","己"],
];
const STEM_CLASH_PENALTY: ScoreMap = {"overall":-8,"wealth":-5,"love":-5,"health":-3,"career":-8};

const BRANCH_COMBO: [string,string][] = [
  ["子","丑"],["寅","亥"],["卯","戌"],["辰","酉"],["巳","申"],["午","未"],
];
const COMBO_BONUS: ScoreMap = {"overall":5,"wealth":5,"love":8,"health":3,"career":5};

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

  constructor(p: SajuEngineProfile) {
    this.day_stem = p.day_stem;
    this.month_stem = p.month_stem;
    this.hour_branch = p.hour_branch;
    this.day_branch = p.day_branch;
    this.month_branch = p.month_branch;
    this.year_branch = p.year_branch;
    this.special_stars = p.special_stars;
    this.dayun_stem = p.dayun_stem;
    this.dayun_branch = p.dayun_branch;
    this.year_stem = p.year_stem ?? "";
    this.day_element = STEM_ELEMENT[p.day_stem];
    this.is_yang = HEAVENLY_STEMS.indexOf(p.day_stem) % 2 === 0;
  }

  private getTenGod(stemOrElement: string): string | undefined {
    const element = STEM_ELEMENT[stemOrElement] ?? stemOrElement;
    const key = `${this.day_element}_${element}_${this.is_yang}`;
    return TEN_GOD_MAP[key];
  }

  private baseScores(): ScoreMap {
    return { overall: 50, wealth: 50, love: 50, health: 50, career: 50 };
  }

  private applyTenGod(scores: ScoreMap, stem: string, weight = 1.0): ScoreMap {
    const tenGod = this.getTenGod(stem);
    if (tenGod && TEN_GOD_INFLUENCE[tenGod]) {
      const inf = TEN_GOD_INFLUENCE[tenGod];
      (Object.keys(scores) as (keyof ScoreMap)[]).forEach(k => {
        scores[k] += Math.trunc(inf[k] * weight);
      });
    }
    return scores;
  }

  private applySpecialStars(scores: ScoreMap): ScoreMap {
    for (const star of this.special_stars) {
      if (SPECIAL_STARS[star]) {
        const inf = SPECIAL_STARS[star];
        (Object.keys(scores) as (keyof ScoreMap)[]).forEach(k => {
          scores[k] += inf[k];
        });
      }
    }
    return scores;
  }

  private applyDayun(scores: ScoreMap): ScoreMap {
    scores = this.applyTenGod(scores, this.dayun_stem, 0.6);
    const branchElem = BRANCH_ELEMENT[this.dayun_branch];
    if (branchElem) {
      const key = `${this.day_element}_${branchElem}_${this.is_yang}`;
      const tenGod = TEN_GOD_MAP[key];
      if (tenGod && TEN_GOD_INFLUENCE[tenGod]) {
        const inf = TEN_GOD_INFLUENCE[tenGod];
        (Object.keys(scores) as (keyof ScoreMap)[]).forEach(k => {
          scores[k] += Math.trunc(inf[k] * 0.4);
        });
      }
    }
    return scores;
  }

  private applyBranchConflicts(scores: ScoreMap, targetBranch: string): ScoreMap {
    const chartBranches = [this.day_branch, this.month_branch, this.year_branch, this.hour_branch];
    for (const [conflictType, pairs] of Object.entries(BRANCH_CONFLICTS)) {
      for (const [b1, b2] of pairs) {
        if ((targetBranch === b1 && chartBranches.includes(b2)) ||
            (targetBranch === b2 && chartBranches.includes(b1))) {
          const penalty = CONFLICT_PENALTY[conflictType];
          (Object.keys(scores) as (keyof ScoreMap)[]).forEach(k => {
            scores[k] += penalty[k];
          });
        }
      }
    }
    return scores;
  }

  private applyBranchCombos(scores: ScoreMap, targetBranch: string): ScoreMap {
    const chartBranches = [this.day_branch, this.month_branch, this.year_branch, this.hour_branch];
    for (const [b1, b2] of BRANCH_COMBO) {
      if ((targetBranch === b1 && chartBranches.includes(b2)) ||
          (targetBranch === b2 && chartBranches.includes(b1))) {
        (Object.keys(scores) as (keyof ScoreMap)[]).forEach(k => {
          scores[k] += COMBO_BONUS[k];
        });
      }
    }
    return scores;
  }

  private applyStemClash(scores: ScoreMap, targetStem: string): ScoreMap {
    const chartStems = [this.day_stem, this.month_stem, this.year_stem];
    for (const [s1, s2] of STEM_CLASH) {
      if ((targetStem === s1 && chartStems.includes(s2)) ||
          (targetStem === s2 && chartStems.includes(s1))) {
        (Object.keys(scores) as (keyof ScoreMap)[]).forEach(k => {
          scores[k] += STEM_CLASH_PENALTY[k];
        });
      }
    }
    return scores;
  }

  /** 절기(節氣) 기준 월주(月柱) 계산 */
  private dateToMonthPillar(date: Date): [string, string] {
    // 절기 시작 근사값: [달력월(1-12), 일, 지지인덱스]
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
    // 기본값: 子月 (대설 전 12월 초 또는 1월 소한 전)
    let branchIdx = 0;
    for (let i = JIEQI.length - 1; i >= 0; i--) {
      const [jm, jd, bIdx] = JIEQI[i];
      if (m > jm || (m === jm && d >= jd)) { branchIdx = bIdx; break; }
    }
    // 사주 년도는 입춘(2/4) 기준으로 바뀜
    const year = date.getFullYear();
    const sajuYear = (m === 1 || (m === 2 && d < 4)) ? year - 1 : year;
    const yearStemIdx = ((sajuYear - 1900) % 10 + 10) % 10;
    // 寅月(branchIdx=2) 시작 천간: 甲己→丙(2), 乙庚→戊(4), 丙辛→庚(6), 丁壬→壬(8), 戊癸→甲(0)
    const yinStartStem = ((yearStemIdx % 5) * 2 + 2) % 10;
    const stemIdx = (yinStartStem + ((branchIdx - 2 + 12) % 12)) % 10;
    return [HEAVENLY_STEMS[stemIdx], EARTHLY_BRANCHES[branchIdx]];
  }

  calculate(targetDate: Date): { scores: ScoreMap; factors: Record<string, unknown> } {
    const [targetStem, targetBranch] = this.dateToStemBranch(targetDate);
    // 현재 월주 — 절기(節氣) 기준으로 계산
    const [monthStem, monthBranch] = this.dateToMonthPillar(targetDate);
    let scores = this.baseScores();
    scores = this.applyTenGod(scores, this.month_stem, 0.8); // 출생 월주
    scores = this.applyTenGod(scores, monthStem, 0.7);       // 현재 월주 (월별 변화 핵심)
    scores = this.applySpecialStars(scores);
    scores = this.applyDayun(scores);
    scores = this.applyBranchConflicts(scores, targetBranch);
    scores = this.applyBranchConflicts(scores, monthBranch);  // 현재 월 지지 충·해·형
    scores = this.applyBranchCombos(scores, targetBranch);
    scores = this.applyBranchCombos(scores, monthBranch);     // 현재 월 지지 합
    scores = this.applyStemClash(scores, targetStem);
    scores = this.applyStemClash(scores, monthStem);          // 현재 월 천간 충
    scores = this.applyTenGod(scores, targetStem, 0.5);

    (Object.keys(scores) as (keyof ScoreMap)[]).forEach(k => {
      scores[k] = Math.max(20, Math.min(100, scores[k]));
    });

    return {
      scores,
      factors: {
        day_stem: this.day_stem,
        target_stem: targetStem,
        target_branch: targetBranch,
        month_stem: monthStem,
        month_branch: monthBranch,
        dayun: `${this.dayun_stem}${this.dayun_branch}`,
        ten_god_of_month: this.getTenGod(this.month_stem),
        ten_god_of_target_month: this.getTenGod(monthStem),
        ten_god_of_day: this.getTenGod(targetStem),
        active_stars: this.special_stars,
      },
    };
  }

  dateToStemBranch(d: Date): [string, string] {
    const base = new Date(1900, 0, 1);
    const delta = Math.floor((d.getTime() - base.getTime()) / 86400000);
    const stemIdx = ((delta % 10) + 10) % 10;
    const branchIdx = ((delta % 12) + 12) % 12;
    return [HEAVENLY_STEMS[stemIdx], EARTHLY_BRANCHES[branchIdx]];
  }
}

export function buildSajuEngineFromProfile(profile: SajuEngineProfile): SajuEngine {
  return new SajuEngine(profile);
}
