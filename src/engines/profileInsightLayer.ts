import { calculateSaju } from '../lib/orrery/saju';
import { calculateSajuProfile } from '../utils/sajuCalculator';
import { computeElementDistribution } from './sajuBalanceLayer';
import { createChart } from '../lib/orrery/ziwei';
import { buildAstroProfile } from '../utils/astroCalculator';
import { lonToSign, ZODIAC_KO } from '../lib/orrery/natal';
import { STEM_ELEMENT, BRANCH_ELEMENT, HEAVENLY_STEMS } from './sajuEngine';
import { JIJANGGAN } from '../lib/orrery/constants';
import type { SajuUser } from '../api/fortuneApi';

const HOUR_LABELS: Record<number, string> = {
  0: "자시 (23~01시)",  2: "축시 (01~03시)",  4: "인시 (03~05시)",
  6: "묘시 (05~07시)",  8: "진시 (07~09시)", 10: "사시 (09~11시)",
  12: "오시 (11~13시)", 14: "미시 (13~15시)", 16: "신시 (15~17시)",
  18: "유시 (17~19시)", 20: "술시 (19~21시)", 22: "해시 (21~23시)",
};

const ELEMENT_KO: Record<string, string> = {
  "木": "목", "火": "화", "土": "토", "金": "금", "水": "수",
};

const TEN_GOD_KO: Record<string, string> = {
  "比肩": "비견", "劫財": "겁재", "食神": "식신", "傷官": "상관",
  "偏財": "편재", "正財": "정재", "偏官": "편관", "正官": "정관",
  "偏印": "편인", "正印": "정인", "本元": "일간",
};

type ElementCountKey = "wood" | "fire" | "earth" | "metal" | "water";

const ELEMENT_COUNT_KEY: Record<string, ElementCountKey> = {
  "木": "wood",
  "火": "fire",
  "土": "earth",
  "金": "metal",
  "水": "water",
};

function computeElementCounts(pillars: ReturnType<typeof calculateSaju>["pillars"]): Record<ElementCountKey, number> {
  const counts: Record<ElementCountKey, number> = {
    wood: 0,
    fire: 0,
    earth: 0,
    metal: 0,
    water: 0,
  };

  const addElement = (element?: string) => {
    const key = element ? ELEMENT_COUNT_KEY[element] : undefined;
    if (key) counts[key] += 1;
  };

  for (const pd of pillars) {
    const stem = pd.pillar.stem;
    const branch = pd.pillar.branch;

    addElement(STEM_ELEMENT[stem]);
    addElement(BRANCH_ELEMENT[branch]);

    const hiddenStems = (JIJANGGAN[branch] ?? "").replace(/ /g, "").split("").filter(Boolean);
    for (const hiddenStem of hiddenStems) {
      addElement(STEM_ELEMENT[hiddenStem]);
    }
  }

  return counts;
}

export interface ProfilePillar {
  ganzi: string;
  stem: string;
  branch: string;
  stemTenGod: string;
  branchTenGod: string;
  hiddenStems: string[];
}

export interface ProfileInsight {
  input: {
    birthYear: number;
    birthMonth: number;
    birthDay: number;
    birthHour?: number;
    birthTimeLabel: string;
    gender: "M" | "F";
    birthTimeUnknown: boolean;
  };
  saju: {
    pillars: {
      year:  ProfilePillar;
      month: ProfilePillar;
      day:   ProfilePillar;
      hour:  ProfilePillar;
    };
    dayMaster: string;
    dayMasterElement: string;
    dayMasterYinYang: "+" | "-";
    specialStars: string[];
    seasonElement: string;
  };
  elements: {
    wood:  number;
    fire:  number;
    earth: number;
    metal: number;
    water: number;
  };
  elementCounts: {
    wood:  number;
    fire:  number;
    earth: number;
    metal: number;
    water: number;
  };
  ziwei: {
    mingGongBranch: string;
    wuXingJu: string;
    mingGongStars: Array<{ name: string; brightness?: string; siHua?: string }>;
  };
  astrology: {
    sunSign:         string;
    moonSign:        string;
    mercurySign:     string;
    venusSign:       string;
    marsSign:        string;
    jupiterSign:     string;
    saturnSign:      string;
    venusRetrograde: boolean;
  };
}

export async function buildProfileInsight(user: SajuUser): Promise<ProfileInsight> {
  const birthTimeUnknown = user.birth_hour === undefined;
  const hour = user.birth_hour ?? 12;
  const birthTimeLabel = birthTimeUnknown ? "모름" : (HOUR_LABELS[hour] ?? `${hour}시`);
  const isMale = user.gender === "M";

  const sajuResult = calculateSaju({
    year: user.birth_year, month: user.birth_month, day: user.birth_day,
    hour, minute: 0, gender: user.gender,
    unknownTime: birthTimeUnknown,
  });

  // pillars: [시주(0), 일주(1), 월주(2), 년주(3)]
  const [hp, dp, mp, yp] = sajuResult.pillars;

  const toPillar = (pd: typeof hp): ProfilePillar => {
    const branch = pd.pillar.branch;
    const hiddenStems = (JIJANGGAN[branch] ?? "").replace(/ /g, "").split("").filter(Boolean);
    return {
      ganzi:        pd.pillar.ganzi,
      stem:         pd.pillar.stem,
      branch,
      stemTenGod:   TEN_GOD_KO[pd.stemSipsin]   ?? pd.stemSipsin,
      branchTenGod: TEN_GOD_KO[pd.branchSipsin]  ?? pd.branchSipsin,
      hiddenStems,
    };
  };

  const sajuProfile = calculateSajuProfile(
      user.birth_year, user.birth_month, user.birth_day,
      user.birth_hour, user.gender, user.injong_rules,
  );

  const dist = computeElementDistribution(sajuProfile);
  const elements = {
    wood:  Math.round((dist["木"] ?? 0) * 100),
    fire:  Math.round((dist["火"] ?? 0) * 100),
    earth: Math.round((dist["土"] ?? 0) * 100),
    metal: Math.round((dist["金"] ?? 0) * 100),
    water: Math.round((dist["水"] ?? 0) * 100),
  };

  const elementCounts = computeElementCounts(sajuResult.pillars);

  const dayMaster = dp.pillar.stem;
  const dayMasterElement = ELEMENT_KO[STEM_ELEMENT[dayMaster] ?? ""] ?? "";
  const stemIdx = HEAVENLY_STEMS.indexOf(dayMaster);
  const dayMasterYinYang: "+" | "-" = stemIdx % 2 === 0 ? "+" : "-";
  const seasonElement = ELEMENT_KO[STEM_ELEMENT[sajuProfile.month_stem] ?? ""] ?? "";

  const ziweiChart = createChart(
      user.birth_year, user.birth_month, user.birth_day, hour, 0, isMale,
  );
  const mingGongBranch = ziweiChart.mingGongZhi;
  const wuXingJu = ziweiChart.wuXingJu.name;
  const mingGongStars = (ziweiChart.palaces["命宮"]?.stars ?? []).map(s => ({
    name:       s.name,
    brightness: s.brightness || undefined,
    siHua:      s.siHua     || undefined,
  }));

  const astroProfile = await buildAstroProfile(
      user.birth_year, user.birth_month, user.birth_day,
      user.birth_hour, undefined, undefined, user.birth_minute,
  );

  const getSign = (id: string): string => {
    const p = astroProfile.natal_planets[id];
    if (!p) return "–";
    return ZODIAC_KO[lonToSign(p.lon)] ?? "–";
  };

  return {
    input: {
      birthYear:       user.birth_year,
      birthMonth:      user.birth_month,
      birthDay:        user.birth_day,
      birthHour:       user.birth_hour,
      birthTimeLabel,
      gender:          user.gender,
      birthTimeUnknown,
    },
    saju: {
      pillars: {
        year:  toPillar(yp),
        month: toPillar(mp),
        day:   toPillar(dp),
        hour:  toPillar(hp),
      },
      dayMaster,
      dayMasterElement,
      dayMasterYinYang,
      specialStars:  sajuProfile.special_stars,
      seasonElement,
    },
    elements,
    elementCounts,
    ziwei: { mingGongBranch, wuXingJu, mingGongStars },
    astrology: {
      sunSign:         getSign("Sun"),
      moonSign:        getSign("Moon"),
      mercurySign:     getSign("Mercury"),
      venusSign:       getSign("Venus"),
      marsSign:        getSign("Mars"),
      jupiterSign:     getSign("Jupiter"),
      saturnSign:      getSign("Saturn"),
      venusRetrograde: astroProfile.venus_retrograde ?? false,
    },
  };
}
