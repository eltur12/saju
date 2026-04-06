import type { DailyFortune } from "./aggregator";
import type { ScoreMap } from "./sajuEngine";

const SEGMENTS: Array<{ startHour: number; endHour: number; bias: number }> = [
  { startHour:  0, endHour:  6, bias: -4 },
  { startHour:  6, endHour: 10, bias: +1 },
  { startHour: 10, endHour: 14, bias: +4 },
  { startHour: 14, endHour: 18, bias: +2 },
  { startHour: 18, endHour: 22, bias:  0 },
  { startHour: 22, endHour: 24, bias: -2 },
];

// segment index: 0=0~6, 1=6~10, 2=10~14, 3=14~18, 4=18~22, 5=22~24
const PATTERN_BIAS: Record<string, number[]> = {
  focus_day:    [ 0,  0, +3, +2,  0, -1],
  social_day:   [-1,  0,  0, +1, +3,  0],
  recovery_day: [+1,  0, -2,  0,  0, +2],
  balanced_day: [ 0,  0,  0,  0,  0,  0],
};

type DomainKey = keyof Omit<ScoreMap, "overall">;
const DOMAIN_KEYS: DomainKey[] = ["wealth", "love", "health", "career", "relations", "study"];

function dominantDomain(scores: DailyFortune["scores"]): DomainKey {
  return DOMAIN_KEYS.reduce((best, k) => scores[k] > scores[best] ? k : best, DOMAIN_KEYS[0]);
}

function selectPattern(scores: DailyFortune["scores"]): string {
  const dom = dominantDomain(scores);
  if (dom === "career" || dom === "wealth") return "focus_day";
  if (dom === "love"   || dom === "relations") return "social_day";
  if (scores.health < 50) return "recovery_day";
  return "balanced_day";
}

function computeAdjustedBiases(scores: DailyFortune["scores"]): number[] {
  const overall = scores.overall;
  const domainScores = DOMAIN_KEYS.map(k => scores[k]);
  const maxDomain = Math.max(...domainScores);
  const minDomain = Math.min(...domainScores);
  const variance = maxDomain - minDomain;

  const isHighDay  = overall >= 70;
  const isLowDay   = overall <= 45;
  const isVolatile = variance >= 20;
  const isStable   = !isVolatile;

  const biases = SEGMENTS.map(s => s.bias);

  if (isHighDay) {
    biases[2] += 2; biases[3] += 2;
    biases[0] -= 1; biases[5] -= 1;
  }

  if (isLowDay) {
    biases[2] -= 2; biases[3] -= 2;
    biases[4] += 1; biases[5] += 1;
  }

  if (isVolatile) {
    let bestIdx = 0, worstIdx = 0;
    for (let i = 1; i < biases.length; i++) {
      if (biases[i] > biases[bestIdx]) bestIdx = i;
      if (biases[i] < biases[worstIdx]) worstIdx = i;
    }
    biases[bestIdx]  += 2;
    biases[worstIdx] -= 2;
  }

  if (isStable) {
    for (let i = 0; i < biases.length; i++) {
      biases[i] = Math.trunc(biases[i] * 0.7);
    }
  }

  // pattern bias
  const pattern = selectPattern(scores);
  const pBias = PATTERN_BIAS[pattern];
  for (let i = 0; i < biases.length; i++) {
    biases[i] += pBias[i];
  }

  return biases;
}

function scoreTags(score: number): string[] {
  if (score >= 75) return ["집중", "추진"];
  if (score >= 60) return ["정리", "무난"];
  if (score >= 45) return ["신중", "유지"];
  return ["휴식", "주의"];
}

export function generateTimeSegments(
  dailyFortune: DailyFortune,
): NonNullable<DailyFortune["timeSegments"]> {
  const base = dailyFortune.scores.overall;
  const adjustedBiases = computeAdjustedBiases(dailyFortune.scores);

  return SEGMENTS.map(({ startHour, endHour }, idx) => {
    const score = Math.max(0, Math.min(100, base + adjustedBiases[idx]));
    return { startHour, endHour, score, tags: scoreTags(score) };
  });
}
