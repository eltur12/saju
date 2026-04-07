import type { DailyFortune } from "./aggregator";

export type NotificationType = "DAILY" | "FLOW" | "LOW";
export type MessageLevel = "L1" | "L2" | "L3";

// v1.1: extended fields
export interface DaySummary {
  avg: number;
  maxScore: number;
  maxHour: number;
  minScore: number;
  minHour: number;
}

export interface PlannedNotification {
  type: NotificationType;
  triggerTime: Date;
  score: number;
  delta?: number;          // score change vs previous segment (FLOW)
  tags: string[];
  daySummary?: DaySummary; // DAILY only
  isRecovery?: boolean;    // LOW only
  duration?: number;       // segment duration in hours (LOW only)
}

type Segment = NonNullable<DailyFortune["timeSegments"]>[number];

const FLOW_RISE_THRESHOLD = 8;

function parseDate(date: string): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number);
  return [y, m, d];
}

function makeTime(date: string, hour: number, minuteOffset = 0): Date {
  const [y, m, d] = parseDate(date);
  const t = new Date(y, m - 1, d, hour, 0, 0, 0);
  t.setMinutes(t.getMinutes() + minuteOffset);
  return t;
}

function hoursApart(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 3_600_000;
}

function tooClose(candidate: Date, existing: PlannedNotification[]): boolean {
  return existing.some(p => hoursApart(p.triggerTime, candidate) < 3);
}

// v1.1: compute day summary from all segments
function computeDaySummary(segments: Segment[]): DaySummary {
  const scores = segments.map(s => s.score);
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const maxSeg = segments.reduce((a, b) => b.score > a.score ? b : a);
  const minSeg = segments.reduce((a, b) => b.score < a.score ? b : a);
  return {
    avg,
    maxScore: maxSeg.score,
    maxHour:  maxSeg.startHour,
    minScore: minSeg.score,
    minHour:  minSeg.startHour,
  };
}

// ── Planner ─────────────────────────────────────────────────────────────────

export function planNotifications(
  fortune: DailyFortune,
  date: string,
): PlannedNotification[] {
  const segments: Segment[] = fortune.timeSegments ?? [];
  const bucket: PlannedNotification[] = [];

  // 1) DAILY — analyze full day, trigger = first segment startHour - 30min
  if (segments.length > 0) {
    const first = segments[0];
    bucket.push({
      type: "DAILY",
      triggerTime: makeTime(date, first.startHour, -30),
      score: first.score,
      tags:  first.tags,
      daySummary: computeDaySummary(segments),
    });
  }

  // 2) FLOW — rising transitions: next.score - current.score >= threshold
  const flowCandidates: Array<{ seg: Segment; delta: number }> = [];
  for (let i = 1; i < segments.length; i++) {
    const delta = segments[i].score - segments[i - 1].score;
    if (delta >= FLOW_RISE_THRESHOLD) {
      flowCandidates.push({ seg: segments[i], delta });
    }
  }
  // sort by delta desc (sharpest rises first)
  flowCandidates.sort((a, b) => b.delta - a.delta);

  let flowCount = 0;
  for (const { seg, delta } of flowCandidates) {
    if (flowCount >= 2) break;
    const t = makeTime(date, seg.startHour);
    if (tooClose(t, bucket)) continue;
    bucket.push({
      type: "FLOW",
      triggerTime: t,
      score: seg.score,
      delta,
      tags:  seg.tags,
    });
    flowCount++;
  }

  // 3) LOW — score < 45, marked as recovery phase
  const lowSegs = segments
    .filter(s => s.score < 45)
    .sort((a, b) => a.score - b.score);

  for (const seg of lowSegs) {
    const t = makeTime(date, seg.startHour);
    if (tooClose(t, bucket)) continue;
    bucket.push({
      type: "LOW",
      triggerTime: t,
      score: seg.score,
      tags:  seg.tags,
      isRecovery: true,
      duration: seg.endHour - seg.startHour,
    });
    break; // max 1
  }

  // 4) GLOBAL — sort by time, enforce max 3 + min 3h interval
  bucket.sort((a, b) => a.triggerTime.getTime() - b.triggerTime.getTime());

  const result: PlannedNotification[] = [];
  for (const n of bucket) {
    if (result.length >= 3) break;
    const last = result[result.length - 1];
    if (!last || hoursApart(last.triggerTime, n.triggerTime) >= 3) {
      result.push(n);
    }
  }

  return result;
}

// ── Message System v1.3 ──────────────────────────────────────────────────────

// Deterministic variant picker — score-based so same day = same wording
function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

// ── Tag tables (descriptive base) ───────────────────────────────────────────

const TAG_STATE: Record<string, string[]> = {
  "집중": ["집중이 잘 되는 시간대예요", "집중하기 좋은 흐름이 보여요", "에너지가 모이는 시간대예요"],
  "추진": ["추진력이 올라오는 시간이에요", "밀어붙이기 좋은 흐름이에요", "실행으로 옮기기 좋은 때예요"],
  "정리": ["정리하기 좋은 흐름이에요", "차분히 정돈할 수 있는 시간이에요", "복잡한 것을 풀어내기 좋아 보여요"],
  "무난": ["큰 무리 없이 흘러가는 시간이에요", "평온한 흐름이 이어지는 시간이에요", "잔잔하게 이어지는 흐름이에요"],
  "신중": ["신중하게 움직이면 좋은 시간이에요", "조금 천천히 살펴보면 좋아 보여요", "서두르지 않는 게 자연스러운 흐름이에요"],
  "유지": ["현 상태를 유지하는 게 자연스러운 흐름이에요", "안정을 지키기 좋은 시간이에요", "변화보다 안정이 맞는 흐름이에요"],
  "휴식": ["조금 쉬어가도 좋은 시간이에요", "잠깐 여유를 가져도 좋은 흐름이에요", "쉬어가기 좋아 보이는 시간이에요"],
  "주의": ["무리하지 않는 게 좋을 것 같아요", "조심스럽게 이어가면 좋아 보여요", "천천히 움직이는 편이 나을 수 있어요"],
};

const TAG_INTERP: Record<string, string> = {
  "집중": "에너지가 한곳으로 모이는 타이밍이에요",
  "추진": "결정한 일을 실행으로 옮기기 좋아요",
  "정리": "복잡한 것들을 차분히 정돈해볼 수 있어요",
  "무난": "평온한 흐름 속에서 일상을 이어가기 좋아요",
  "신중": "서두르기보다 천천히 살펴보는 게 도움이 될 수 있어요",
  "유지": "변화보다는 안정이 더 맞는 타이밍일 수 있어요",
  "휴식": "몸과 마음을 돌보는 시간이 필요할 수 있어요",
  "주의": "예상치 못한 변수가 생길 수도 있어요",
};

const TAG_ACTION: Record<string, string> = {
  "집중": "중요한 일을 이 시간에 맞춰보는 것도 좋을 것 같아요",
  "추진": "미뤄뒀던 일을 조금씩 시작해보는 건 어떨까요",
  "정리": "할 일 목록이나 공간을 가볍게 정리해보는 것도 좋아요",
  "무난": "평소 하던 대로 가볍게 이어가면 충분해요",
  "신중": "큰 결정이나 새로운 시작은 조금 뒤로 미뤄도 괜찮아요",
  "유지": "지금 하던 일을 묵묵히 이어가는 게 좋을 것 같아요",
  "휴식": "짧은 산책이나 스트레칭만으로도 도움이 될 수 있어요",
  "주의": "중요한 약속이나 계약은 오늘보다 다른 날이 더 나을 수 있어요",
};

const TYPE_TITLE: Record<NotificationType, string[]> = {
  DAILY: ["오늘 하루 흐름을 미리 살펴봐요", "하루 흐름이 어떤지 살짝 봤어요", "오늘 하루가 어떻게 흘러갈지 봤어요"],
  FLOW:  ["흐름이 올라오기 시작하는 시간이에요", "흐름이 달라지는 타이밍이에요", "좋은 흐름이 시작될 것 같아요"],
  LOW:   ["잠깐 쉬어가도 괜찮은 시간이에요", "조금 여유를 가져도 좋은 흐름이에요", "속도를 낮춰도 괜찮은 시간이에요"],
};

function pickTag(tags: string[]): string {
  return tags.find(t => TAG_STATE[t]) ?? tags[0] ?? "";
}

function tagState(tag: string, seed: number): string {
  const pool = TAG_STATE[tag];
  if (!pool) return "";
  return pick(pool, seed);
}

// ── DAILY variants (qualitative, 3 tones) ───────────────────────────────────

const DAILY_HIGH: string[] = [
  "전체적으로 흐름이 좋은 날이에요",
  "오늘은 흐름이 좋아 보이는 날이에요",
  "좋은 흐름이 이어지는 하루예요",
];
const DAILY_MID: string[] = [
  "완만한 흐름이 이어지는 날이에요",
  "큰 굴곡 없이 흘러가는 날로 보여요",
  "안정적인 흐름의 하루예요",
];
const DAILY_LOW: string[] = [
  "무리하지 않는 편이 좋은 날이에요",
  "조금 조심스러운 흐름으로 보여요",
  "차분하게 이어가면 좋은 날이에요",
];

function dailyFlowLine(avg: number, seed: number): string {
  if (avg >= 65) return pick(DAILY_HIGH, seed);
  if (avg >= 50) return pick(DAILY_MID, seed);
  return pick(DAILY_LOW, seed);
}

// ── FLOW variants (temporal cues + intensity) ────────────────────────────────

const FLOW_FAST: string[] = [
  "지금 빠르게 흐름이 올라오는 구간이에요",
  "이제 흐름이 빠르게 상승하는 시간이에요",
  "막 흐름이 크게 올라오려는 구간이에요",
];
const FLOW_SLOW: string[] = [
  "지금 조금씩 흐름이 좋아지는 구간이에요",
  "이제 흐름이 조금씩 살아나는 시간이에요",
  "막 흐름이 올라오기 시작하는 구간이에요",
];

function flowDeltaLine(delta: number, seed: number): string {
  return delta >= 15 ? pick(FLOW_FAST, seed) : pick(FLOW_SLOW, seed);
}

// ── LOW variants (reassurance structure) ────────────────────────────────────

const LOW_SHORT: string[] = [
  "잠깐 느려질 수 있지만 곧 지나가요",
  "잠깐 흐름이 처질 수 있지만 길지 않아요",
  "잠시 에너지가 내려올 수 있지만 금방 회복돼요",
];
const LOW_LONG: string[] = [
  "잠깐 느려질 수 있지만 자연스러운 흐름이에요",
  "잠시 속도가 줄어드는 구간이에요, 무리하지 않아도 괜찮아요",
  "잠깐 쉬어가도 좋은 흐름이에요",
];

function lowDurationLine(duration: number | undefined, seed: number): string {
  return duration !== undefined && duration < 3
    ? pick(LOW_SHORT, seed)
    : pick(LOW_LONG, seed);
}

export function generateNotificationMessage(
  notification: PlannedNotification,
  level: MessageLevel,
): { title: string; body: string } {
  const seed  = notification.score + (notification.delta ?? 0);
  const title = pick(TYPE_TITLE[notification.type], seed);
  const tag   = pickTag(notification.tags);

  const state  = tagState(tag, seed) || `${notification.score}점 구간이에요`;
  const interp = TAG_INTERP[tag]  ?? "";
  const action = TAG_ACTION[tag]  ?? "";

  // DAILY
  if (notification.type === "DAILY" && notification.daySummary) {
    const flowLine = dailyFlowLine(notification.daySummary.avg, seed);
    if (level === "L1") return { title, body: flowLine };
    if (level === "L2") return { title, body: [flowLine, state].filter(Boolean).join(" ") };
    return { title, body: [flowLine, state, action].filter(Boolean).join(" ") };
  }

  // FLOW
  if (notification.type === "FLOW" && notification.delta !== undefined) {
    const deltaLine = flowDeltaLine(notification.delta, seed);
    if (level === "L1") return { title, body: deltaLine };
    if (level === "L2") return { title, body: [deltaLine, state].filter(Boolean).join(" ") };
    return { title, body: [deltaLine, state, action].filter(Boolean).join(" ") };
  }

  // LOW
  if (notification.isRecovery) {
    const durationLine  = lowDurationLine(notification.duration, seed);
    const recoveryState = "지금은 에너지를 충전하면 좋은 시간이에요";
    if (level === "L1") return { title, body: durationLine };
    if (level === "L2") return { title, body: [durationLine, recoveryState].filter(Boolean).join(" ") };
    return { title, body: [durationLine, recoveryState, action].filter(Boolean).join(" ") };
  }

  // default
  if (level === "L1") return { title, body: state };
  if (level === "L2") return { title, body: [state, interp].filter(Boolean).join(" ") };
  return { title, body: [state, interp, action].filter(Boolean).join(" ") };
}
