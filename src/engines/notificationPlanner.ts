import type { DailyFortune } from "./aggregator";

export type NotificationType = "DAILY" | "FLOW" | "LOW" | "POINT";
export type MessageLevel = "L1" | "L2" | "L3";

// v1.1: extended fields
export interface DaySummary {
  avg: number;
  maxScore: number;
  maxHour: number;
  minScore: number;
  minHour: number;
}

export interface NotificationSettings {
  dailyEnabled: boolean;
  flowEnabled:  boolean;
  lowEnabled:   boolean;
  allowNight:   boolean;   // if false, remove non-DAILY notifications with hour < 7 or >= 22
  dailyTime:    string;    // "HH:MM" — override DAILY trigger time
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
  flowIndex?: number;      // FLOW only: 0=first, 1=second (for variation offset)
  pointHigh?: boolean;     // POINT only: true = avg >= 60 (highlight best), false = highlight worst
}

type Segment = NonNullable<DailyFortune["timeSegments"]>[number];

const FLOW_RISE_THRESHOLD = 5;
const LOW_DROP_THRESHOLD  = 5;

type ScoreBand = "GOLD" | "MINT" | "GRAY" | "RED";

function scoreBand(score: number): ScoreBand {
  if (score >= 75) return "GOLD";
  if (score >= 65) return "MINT";
  if (score >= 55) return "GRAY";
  return "RED";
}

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

function requiredGap(a: NotificationType, b: NotificationType): number {
  return a === "DAILY" || b === "DAILY" ? 1 : 3;
}

function intervalOk(a: PlannedNotification, b: PlannedNotification): boolean {
  const gap = hoursApart(a.triggerTime, b.triggerTime);
  return gap > 0 && gap >= requiredGap(a.type, b.type);
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

  // 1) DAILY — analyze full day, trigger = first segment startHour - 30min, min 07:00
  if (segments.length > 0) {
    const first = segments[0];
    const rawTrigger = makeTime(date, first.startHour, -30);
    const minTrigger = makeTime(date, 7);
    bucket.push({
      type: "DAILY",
      triggerTime: rawTrigger < minTrigger ? minTrigger : rawTrigger,
      score: first.score,
      tags:  first.tags,
      daySummary: computeDaySummary(segments),
    });
  }

  // Candidate range: only segments starting between 08:00 and 21:59
  const candidates = segments.filter(s => s.startHour >= 8 && s.startHour < 22);

  // 2) FLOW — band transition into MINT or GOLD (delta >= threshold, band must change)
  const flowCandidates: Array<{ seg: Segment; delta: number }> = [];
  for (let i = 1; i < segments.length; i++) {
    if (segments[i].startHour < 8 || segments[i].startHour >= 22) continue;
    const delta    = segments[i].score - segments[i - 1].score;
    const prevBand = scoreBand(segments[i - 1].score);
    const nextBand = scoreBand(segments[i].score);
    if (
      delta >= FLOW_RISE_THRESHOLD &&
      prevBand !== nextBand &&
      (nextBand === "MINT" || nextBand === "GOLD")
    ) {
      flowCandidates.push({ seg: segments[i], delta });
    }
  }
  flowCandidates.sort((a, b) => b.delta - a.delta);

  let flowCount = 0;
  for (const { seg, delta } of flowCandidates) {
    if (flowCount >= 2) break;
    bucket.push({
      type: "FLOW",
      triggerTime: makeTime(date, seg.startHour),
      score: seg.score,
      delta,
      tags:  seg.tags,
      flowIndex: flowCount,
    });
    flowCount++;
  }

  // 3) LOW — band transition into RED (drop >= threshold, band must change); fires 1h early
  let lowCount = 0;
  if (flowCount < 2) {
    for (let i = 1; i < segments.length; i++) {
      if (segments[i].startHour < 8 || segments[i].startHour >= 22) continue;
      const drop     = segments[i - 1].score - segments[i].score;
      const prevBand = scoreBand(segments[i - 1].score);
      const nextBand = scoreBand(segments[i].score);
      if (drop >= LOW_DROP_THRESHOLD && prevBand !== nextBand && nextBand === "RED") {
        bucket.push({
          type: "LOW",
          triggerTime: makeTime(date, segments[i].startHour - 1),
          score: segments[i].score,
          tags:  segments[i].tags,
          isRecovery: true,
          duration: segments[i].endHour - segments[i].startHour,
        });
        lowCount++;
        break; // max 1
      }
    }
  }

  // 4) POINT — fallback when no FLOW and no LOW
  if (flowCount === 0 && lowCount === 0 && candidates.length > 0) {
    const daySummary = computeDaySummary(segments);
    const high = daySummary.avg >= 60;
    const pointSeg = high
      ? candidates.reduce((a, b) => b.score > a.score ? b : a)
      : candidates.reduce((a, b) => b.score < a.score ? b : a);
    bucket.push({
      type: "POINT",
      triggerTime: makeTime(date, pointSeg.startHour),
      score: pointSeg.score,
      tags:  pointSeg.tags,
      pointHigh: high,
    });
  }

  // 4) Sort by time, then enforce min 3h interval
  bucket.sort((a, b) => a.triggerTime.getTime() - b.triggerTime.getTime());

  const result: PlannedNotification[] = [];
  for (const n of bucket) {
    if (result.every(e => intervalOk(e, n))) {
      result.push(n);
    }
  }

  return result;
}

// ── Message System v1.4 ──────────────────────────────────────────────────────

// Deterministic variant picker — score-based so same day = same wording
function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

// Connector pools split by notification type (~2/3 usage frequency)
const CONNECTORS_DAILY = ["그래서", "이 흐름에서는"];
const CONNECTORS_FLOW  = ["그래서", "이 흐름에서는", "이 타이밍에는"];
const CONNECTORS_LOW   = ["그래서", "이 흐름에서는"];

function joinWithConnector(a: string, b: string, seed: number, pool: string[]): string {
  if (!a || !b) return a || b;
  if (Math.abs(seed) % 3 === 0) return `${a} ${b}`;
  const conn = pick(pool, seed + 1);
  return `${a} ${conn} ${b}`;
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
  "집중": "필요하다면 중요한 일을 이 시간에 맞춰보는 것도 괜찮아요",
  "추진": "필요하다면 미뤄뒀던 일을 가볍게 시작해봐도 좋아요",
  "정리": "할 일 목록이나 공간을 가볍게 정리해보는 것도 좋아요",
  "무난": "평소 하던 대로 가볍게 이어가면 충분해요",
  "신중": "큰 결정이나 새로운 시작은 조금 뒤로 미뤄도 괜찮아요",
  "유지": "필요하다면 지금 하던 일을 가볍게 이어가도 좋아요",
  "휴식": "짧은 산책이나 스트레칭만으로도 도움이 될 수 있어요",
  "주의": "중요한 약속이나 계약은 오늘보다 다른 날이 더 나을 수 있어요",
};

const TYPE_TITLE: Record<NotificationType, string[]> = {
  DAILY: ["오늘 하루 흐름을 미리 살펴봐요", "하루 흐름이 어떤지 살짝 봤어요", "오늘 하루가 어떻게 흘러갈지 봤어요"],
  FLOW:  ["흐름이 올라오기 시작하는 시간이에요", "흐름이 달라지는 타이밍이에요", "좋은 흐름이 시작될 것 같아요"],
  LOW:   ["잠시 뒤 흐름이 달라질 수 있어요", "흐름이 바뀌기 전, 미리 준비해봐요", "준비해두면 좋은 시간이에요"],
  POINT: ["지금 이 시간을 살짝 챙겨봐요", "오늘 흐름에서 눈에 띄는 구간이에요", "잠깐 이 시간을 체크해봐요"],
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
  "조금 조심스럽게 흐를 수 있는 날이에요",
  "무리하지 않고 속도를 조절하는 편이 맞는 날이에요",
  "에너지를 아끼며 가는 편이 좋은 흐름이에요",
];

function dailyFlowLine(avg: number, seed: number): string {
  if (avg >= 65) return pick(DAILY_HIGH, seed);
  if (avg >= 55) return pick(DAILY_MID, seed);
  return pick(DAILY_LOW, seed);
}

// ── DAILY day-level interpretation and action (daySummary-based) ─────────────

const DAILY_INTERP_HIGH: string[] = [
  "오늘 에너지가 좋은 만큼 하고 싶은 일을 시도해볼 수 있어요",
  "흐름이 받쳐주는 날이라 원하는 걸 진행해보기 좋아요",
  "좋은 흐름을 잘 활용해볼 수 있는 날이에요",
];
const DAILY_INTERP_MID: string[] = [
  "큰 기복 없이 하루를 안정적으로 이어갈 수 있어요",
  "고른 흐름 속에서 계획한 일을 차분히 진행하기 좋아요",
  "무리 없이 꾸준하게 이어가기 좋은 날이에요",
];
const DAILY_INTERP_LOW: string[] = [
  "오늘은 속도보다 여유를 두는 편이 더 맞을 수 있어요",
  "흐름이 낮게 흐르는 날인 만큼 에너지를 아끼며 가도 괜찮아요",
  "무리보다는 천천히 이어가는 게 자연스러운 날이에요",
];

const DAILY_ACTION_HIGH: string[] = [
  "오늘 하고 싶은 일을 가볍게 시도해봐도 괜찮아요",
  "필요하다면 중요한 일을 오늘 안에 가볍게 처리해봐도 좋아요",
  "오늘 흐름을 믿고 가볍게 움직여봐도 좋아요",
];
const DAILY_ACTION_MID: string[] = [
  "평소 흐름대로 가볍게 이어가면 충분해요",
  "필요한 일을 하나씩 가볍게 챙겨보는 것도 좋아요",
  "오늘은 무리하지 않고 차분히 이어가봐요",
];
const DAILY_ACTION_LOW: string[] = [
  "오늘은 큰 결정이나 중요한 시작보다 쉬어가는 날로 삼아도 좋아요",
  "필요한 일이 있다면 최소한으로만 가볍게 챙겨봐도 괜찮아요",
  "오늘은 내 페이스대로 천천히 이어가는 것만으로 충분해요",
];

function dailyInterpLine(avg: number, seed: number): string {
  if (avg >= 65) return pick(DAILY_INTERP_HIGH, seed);
  if (avg >= 55) return pick(DAILY_INTERP_MID, seed);
  return pick(DAILY_INTERP_LOW, seed);
}

function dailyActionLine(avg: number, seed: number): string {
  if (avg >= 65) return pick(DAILY_ACTION_HIGH, seed);
  if (avg >= 55) return pick(DAILY_ACTION_MID, seed);
  return pick(DAILY_ACTION_LOW, seed);
}

// ── FLOW variants ────────────────────────────────────────────────────────────

const FLOW_LEAD: string[] = [
  "이제 흐름이 조금씩 살아나는 시간이에요",
  "지금부터 흐름이 올라오기 시작하는 구간이에요",
  "흐름이 비교적 좋아지는 시간대예요",
];
const FLOW_INTERP: string[] = [
  "집중이 비교적 잘 이어질 수 있어요",
  "에너지가 모이는 흐름이라 움직임이 자연스러울 수 있어요",
  "이 타이밍에 맞춰 중요한 일을 이어가보면 좋아요",
];
const FLOW_ACTION: string[] = [
  "필요하다면 중요한 일을 이 시간에 맞춰보는 것도 괜찮아요",
  "미뤄뒀던 일을 가볍게 시작해봐도 좋은 흐름이에요",
  "이 시간을 활용해 집중이 필요한 일을 가볍게 처리해봐요",
];

// ── LOW variants (pre-drop preparatory) ──────────────────────────────────────

const LOW_LEAD: string[] = [
  "한 시간 뒤에는 흐름이 조금 가라앉을 수 있어요",
  "조금 뒤에는 속도를 낮추는 흐름으로 이어질 수 있어요",
  "잠시 뒤 에너지가 내려올 수 있는 구간이 다가오고 있어요",
];
const LOW_BUFFER: string[] = [
  "지금은 비교적 여유가 있는 구간이에요",
  "지금 미리 정리해두면 더 편안할 수 있어요",
  "지금 가볍게 마무리해두면 이후가 훨씬 편해요",
];
const LOW_ACTION: string[] = [
  "필요한 일이 있다면 지금 가볍게 정리해두는 것도 괜찮아요",
  "중요한 일이 있다면 조금 미리 챙겨두는 것도 좋아요",
  "여유가 있는 지금, 가볍게 마무리해두면 좋아요",
];

// ── POINT variants ────────────────────────────────────────────────────────────

const POINT_LEAD_HIGH: string[] = [
  "오늘은 전체적으로 흐름이 안정적인 편이에요",
  "오늘 하루 흐름이 고른 편이에요",
  "전반적으로 큰 굴곡 없이 이어지는 흐름이에요",
];
const POINT_HIGHLIGHT_HIGH: string[] = [
  "그중에서도 이 시간대가 조금 더 잘 맞을 수 있어요",
  "특히 이 구간에서 에너지가 비교적 잘 모이는 편이에요",
  "이 시간대를 잘 활용해보는 것도 좋아요",
];
const POINT_LEAD_LOW: string[] = [
  "오늘은 조금 속도를 조절하는 게 더 맞는 흐름이에요",
  "오늘은 전반적으로 차분하게 이어가는 게 자연스러운 날이에요",
  "흐름이 조용한 날인 만큼 무리하지 않는 게 좋아요",
];
const POINT_HIGHLIGHT_LOW: string[] = [
  "이 시간대에는 무리하지 않는 게 좋아요",
  "이 구간에서 특히 속도를 낮추면 더 편안할 수 있어요",
  "가볍게 쉬어가거나 천천히 이어가봐요",
];

export function generateNotificationMessage(
  notification: PlannedNotification,
  level: MessageLevel,
): { title: string; body: string } {
  const seed       = notification.score + (notification.delta ?? 0);
  // FLOW: offset seed by flowIndex to avoid same title/lead on same day
  const flowOffset = notification.type === "FLOW" ? (notification.flowIndex ?? 0) : 0;
  const title      = pick(TYPE_TITLE[notification.type], seed + flowOffset);
  const tag        = pickTag(notification.tags);

  const state  = tagState(tag, seed) || `${notification.score}점 구간이에요`;
  const interp = TAG_INTERP[tag]  ?? "";
  const action = TAG_ACTION[tag]  ?? "";

  // DAILY — use daySummary-based interp/action, not first-segment tag
  if (notification.type === "DAILY" && notification.daySummary) {
    const { avg } = notification.daySummary;
    const flowLine   = dailyFlowLine(avg, seed);
    const dayInterp  = dailyInterpLine(avg, seed);
    const dayAction  = dailyActionLine(avg, seed);
    if (level === "L1") return { title, body: flowLine };
    const l2 = joinWithConnector(flowLine, dayInterp, seed, CONNECTORS_DAILY);
    if (level === "L2") return { title, body: l2 };
    return { title, body: `${l2} ${dayAction}` };
  }

  // FLOW
  if (notification.type === "FLOW") {
    const flowLead   = pick(FLOW_LEAD,   seed + flowOffset);
    const flowInterp = pick(FLOW_INTERP, seed + flowOffset);
    const flowAction = pick(FLOW_ACTION, seed + flowOffset);
    if (level === "L1") return { title, body: flowLead };
    const l2 = joinWithConnector(flowLead, flowInterp, seed, CONNECTORS_FLOW);
    if (level === "L2") return { title, body: l2 };
    return { title, body: `${l2} ${flowAction}` };
  }

  // LOW
  if (notification.type === "LOW") {
    const lowLead   = pick(LOW_LEAD,   seed);
    const lowBuffer = pick(LOW_BUFFER, seed);
    const lowAction = pick(LOW_ACTION, seed);
    if (level === "L1") return { title, body: lowLead };
    const l2 = joinWithConnector(lowLead, lowBuffer, seed, CONNECTORS_LOW);
    if (level === "L2") return { title, body: l2 };
    return { title, body: `${l2} ${lowAction}` };
  }

  // POINT
  if (notification.type === "POINT") {
    const high         = notification.pointHigh ?? true;
    const pointLead    = pick(high ? POINT_LEAD_HIGH      : POINT_LEAD_LOW,      seed);
    const pointHLight  = pick(high ? POINT_HIGHLIGHT_HIGH : POINT_HIGHLIGHT_LOW, seed);
    const pointAction  = pick(high ? FLOW_ACTION : LOW_ACTION, seed);
    if (level === "L1") return { title, body: pointLead };
    const connPool = high ? CONNECTORS_FLOW : CONNECTORS_LOW;
    const l2 = joinWithConnector(pointLead, pointHLight, seed, connPool);
    if (level === "L2") return { title, body: l2 };
    return { title, body: `${l2} ${pointAction}` };
  }

  // default
  if (level === "L1") return { title, body: state };
  const l2 = joinWithConnector(state, interp, seed, CONNECTORS_DAILY);
  if (level === "L2") return { title, body: l2 };
  return { title, body: action ? `${l2} ${action}` : l2 };
}

// ── Settings filter ──────────────────────────────────────────────────────────

export function applyNotificationSettings(
  notifications: PlannedNotification[],
  settings: NotificationSettings,
  date: string,
): PlannedNotification[] {
  const [y, m, d] = date.split("-").map(Number);

  // 1) Override DAILY triggerTime
  const [hh, mm] = settings.dailyTime.split(":").map(Number);
  let result = notifications.map(n => {
    if (n.type !== "DAILY") return n;
    return { ...n, triggerTime: new Date(y, m - 1, d, hh, mm, 0, 0) };
  });

  // 2) Type filter
  if (!settings.dailyEnabled) result = result.filter(n => n.type !== "DAILY");
  if (!settings.flowEnabled)  result = result.filter(n => n.type !== "FLOW");
  if (!settings.lowEnabled)   result = result.filter(n => n.type !== "LOW");
  if (!settings.flowEnabled && !settings.lowEnabled) {
    result = result.filter(n => n.type !== "POINT");
  }

  // 3) Night filter (skip DAILY)
  if (!settings.allowNight) {
    result = result.filter(n => {
      if (n.type === "DAILY") return true;
      const h = n.triggerTime.getHours();
      return h >= 7 && h < 22;
    });
  }

  // 4) Sort then enforce 3h interval (priority: earlier = higher)
  result.sort((a, b) => a.triggerTime.getTime() - b.triggerTime.getTime());
  const filtered: PlannedNotification[] = [];
  for (const n of result) {
    if (filtered.every(e => intervalOk(e, n))) {
      filtered.push(n);
    }
  }

  return filtered;
}
