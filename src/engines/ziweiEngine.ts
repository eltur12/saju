/**
 * 자미두수(紫微斗數) 분석 엔진
 */
import type { ScoreMap } from "./sajuEngine";

const STAR_STRENGTH: Record<string, number> = {
  "紫微":10,"天機":10,"太陽":-5,"武曲":-5,"天同":0,"廉貞":-5,
  "天府":10,"太陰":-5,"貪狼":-5,"巨門":5,"天相":10,"天梁":10,"七殺":5,"破軍":10,
};

const SIHUA_EFFECTS: Record<string, ScoreMap> = {
  "化祿":{"overall":12,"wealth":15,"love":8,"health":5,"career":10},
  "化權":{"overall":10,"wealth":5,"love":3,"health":5,"career":15},
  "化科":{"overall":8,"wealth":3,"love":5,"health":5,"career":10},
  "化忌":{"overall":-10,"wealth":-8,"love":-8,"health":-5,"career":-10},
};

const PALACE_WEIGHT: Record<string, ScoreMap> = {
  "命宮":{"overall":1.0,"wealth":0.5,"love":0.5,"health":0.5,"career":0.5},
  "兄弟":{"overall":0.3,"wealth":0.3,"love":0.5,"health":0.3,"career":0.3},
  "夫妻":{"overall":0.5,"wealth":0.3,"love":1.2,"health":0.3,"career":0.3},
  "子女":{"overall":0.5,"wealth":0.5,"love":0.5,"health":0.5,"career":0.5},
  "財帛":{"overall":0.5,"wealth":1.5,"love":0.3,"health":0.3,"career":0.5},
  "疾厄":{"overall":0.5,"wealth":0.3,"love":0.3,"health":1.5,"career":0.3},
  "遷移":{"overall":0.5,"wealth":0.5,"love":0.5,"health":0.5,"career":0.8},
  "交友":{"overall":0.5,"wealth":0.3,"love":0.8,"health":0.3,"career":0.5},
  "官祿":{"overall":0.5,"wealth":0.5,"love":0.3,"health":0.3,"career":1.5},
  "田宅":{"overall":0.5,"wealth":0.8,"love":0.3,"health":0.5,"career":0.3},
  "福德":{"overall":0.8,"wealth":0.5,"love":0.5,"health":0.8,"career":0.3},
  "父母":{"overall":0.3,"wealth":0.3,"love":0.3,"health":0.5,"career":0.5},
};

const LUCKY_STARS: Record<string, number> = {
  "祿存":5,"左輔":4,"右弼":4,"文昌":3,"文曲":3,"天魁":5,"天鉞":5,"天馬":4,
};
const UNLUCKY_STARS: Record<string, number> = {
  "擎羊":-7,"陀羅":-5,"火星":-5,"鈴星":-5,"地空":-6,"地劫":-6,
};

export interface PalaceData {
  main_stars: string[];
  lucky_stars: string[];
  unlucky_stars: string[];
}

export interface ZiweiProfile {
  palaces: Record<string, PalaceData>;
  sihua: Record<string, { palace: string; star: string }>;
  current_dahan: string;
  dahan_stars: string[];
}

export class ZiweiEngine {
  private palaces: Record<string, PalaceData>;
  private sihua: Record<string, { palace: string; star: string }>;
  private current_dahan: string;
  private dahan_stars: string[];

  constructor(p: ZiweiProfile) {
    this.palaces = p.palaces;
    this.sihua = p.sihua;
    this.current_dahan = p.current_dahan;
    this.dahan_stars = p.dahan_stars;
  }

  private palaceScore(palaceName: string): ScoreMap {
    const base: ScoreMap = { overall: 0, wealth: 0, love: 0, health: 0, career: 0 };
    const palace = this.palaces[palaceName] ?? {};
    const weight = PALACE_WEIGHT[palaceName] ?? { overall: 0.5, wealth: 0.5, love: 0.5, health: 0.5, career: 0.5 };

    for (const star of palace.main_stars ?? []) {
      const strength = STAR_STRENGTH[star] ?? 0;
      (Object.keys(base) as (keyof ScoreMap)[]).forEach(k => {
        base[k] += Math.trunc(strength * weight[k]);
      });
    }
    for (const star of palace.lucky_stars ?? []) {
      const bonus = LUCKY_STARS[star] ?? 3;
      (Object.keys(base) as (keyof ScoreMap)[]).forEach(k => {
        base[k] += Math.trunc(bonus * weight[k]);
      });
    }
    for (const star of palace.unlucky_stars ?? []) {
      const penalty = UNLUCKY_STARS[star] ?? -3;
      (Object.keys(base) as (keyof ScoreMap)[]).forEach(k => {
        base[k] += Math.trunc(penalty * weight[k]);
      });
    }
    return base;
  }

  private applySihua(scores: ScoreMap): ScoreMap {
    const sihuaTypes = ["化祿", "化權", "化科", "化忌"] as const;
    for (const sihuaType of sihuaTypes) {
      const palace = this.sihua[sihuaType]?.palace;
      if (palace) {
        const weight = PALACE_WEIGHT[palace] ?? { overall: 0.5, wealth: 0.5, love: 0.5, health: 0.5, career: 0.5 };
        const effect = SIHUA_EFFECTS[sihuaType];
        (Object.keys(scores) as (keyof ScoreMap)[]).forEach(k => {
          scores[k] += Math.trunc(effect[k] * weight[k]);
        });
      }
    }
    return scores;
  }

  private applyDahan(scores: ScoreMap): ScoreMap {
    const dahanScores = this.palaceScore(this.current_dahan);
    (Object.keys(scores) as (keyof ScoreMap)[]).forEach(k => {
      scores[k] += Math.trunc((dahanScores[k] ?? 0) * 0.7);
    });
    const weight = PALACE_WEIGHT[this.current_dahan] ?? { overall: 0.5, wealth: 0.5, love: 0.5, health: 0.5, career: 0.5 };
    for (const star of this.dahan_stars) {
      const strength = STAR_STRENGTH[star] ?? 0;
      (Object.keys(scores) as (keyof ScoreMap)[]).forEach(k => {
        scores[k] += Math.trunc(strength * weight[k] * 0.3);
      });
    }
    return scores;
  }

  calculate(targetDate: Date): { scores: ScoreMap; factors: Record<string, unknown> } {
    const scores: ScoreMap = { overall: 0, wealth: 0, love: 0, health: 0, career: 0 };
    const mingScores = this.palaceScore("命宮");
    (Object.keys(scores) as (keyof ScoreMap)[]).forEach(k => {
      scores[k] += mingScores[k] ?? 0;
    });

    this.applySihua(scores);
    this.applyDahan(scores);

    const PALACE_ORDER = ["命宮","兄弟","夫妻","子女","財帛","疾厄","遷移","交友","官祿","田宅","福德","父母"];
    const monthlyPalace = PALACE_ORDER[targetDate.getMonth()];
    const monthlyScores = this.palaceScore(monthlyPalace);
    (Object.keys(scores) as (keyof ScoreMap)[]).forEach(k => {
      scores[k] += Math.trunc((monthlyScores[k] ?? 0) * 0.4);
    });

    return {
      scores,
      factors: {
        current_dahan: this.current_dahan,
        dahan_stars: this.dahan_stars,
        sihua_summary: Object.fromEntries(Object.entries(this.sihua).map(([k, v]) => [k, v.palace])),
        monthly_palace: monthlyPalace,
      },
    };
  }
}

export const SAMPLE_ZIWEI_PROFILE: ZiweiProfile = {
  palaces: {
    "命宮":{"main_stars":["天相"],"lucky_stars":[],"unlucky_stars":["擎羊"]},
    "兄弟":{"main_stars":["巨門"],"lucky_stars":["祿存"],"unlucky_stars":[]},
    "夫妻":{"main_stars":["廉貞","貪狼"],"lucky_stars":[],"unlucky_stars":["地空","地劫","陀羅"]},
    "子女":{"main_stars":["太陰"],"lucky_stars":["文昌"],"unlucky_stars":["鈴星"]},
    "財帛":{"main_stars":["天府"],"lucky_stars":["左輔"],"unlucky_stars":[]},
    "疾厄":{"main_stars":[],"lucky_stars":[],"unlucky_stars":[]},
    "遷移":{"main_stars":["紫微","破軍"],"lucky_stars":[],"unlucky_stars":[]},
    "交友":{"main_stars":["天機"],"lucky_stars":[],"unlucky_stars":[]},
    "官祿":{"main_stars":[],"lucky_stars":["右弼","天魁","天馬"],"unlucky_stars":[]},
    "田宅":{"main_stars":["太陽"],"lucky_stars":["文曲"],"unlucky_stars":[]},
    "福德":{"main_stars":["武曲","七殺"],"lucky_stars":["天鉞"],"unlucky_stars":["火星"]},
    "父母":{"main_stars":["天同","天梁"],"lucky_stars":[],"unlucky_stars":[]},
  },
  sihua: {
    "化祿":{"palace":"子女","star":"太陰"},
    "化權":{"palace":"父母","star":"天同"},
    "化科":{"palace":"交友","star":"天機"},
    "化忌":{"palace":"兄弟","star":"巨門"},
  },
  current_dahan: "夫妻",
  dahan_stars: ["廉貞","貪狼"],
};

export function buildZiweiEngineFromProfile(profile: ZiweiProfile): ZiweiEngine {
  return new ZiweiEngine(profile);
}
