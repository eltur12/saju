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
  "집중": ["집중이 잘 되는 시간이에요", "몰입하기 괜찮은 구간이에요", "흐름이 한곳으로 모이는 느낌이에요"],
  "추진": ["움직이기 좋은 타이밍이에요", "속도를 내기 괜찮아요"],
  "정리": ["정리하기 좋은 시간이에요", "차분히 정돈하기 좋아요"],
  "무난": ["부담 없이 지나가기 쉬운 시간이에요", "잔잔하게 이어가기 좋아요"],
  "신중": ["조금 천천히 보는 게 좋아요", "결정은 서두르지 않는 게 맞아요"],
  "유지": ["지금 흐름 유지해도 괜찮아요", "변화 없이 이어가도 좋아요"],
  "휴식": ["잠깐 쉬어가기 좋은 타이밍이에요", "여유를 가져도 괜찮아요", "힘을 빼도 괜찮은 구간이에요"],
  "주의": ["무리하지 않는 게 좋아요", "조금 조심해서 움직이면 좋아요"],
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
  "집중": "중요한 일을 이 시간에 맞춰보세요",
  "추진": "미뤄둔 일을 지금 시작해보세요",
  "정리": "할 일을 가볍게 정리해보세요",
  "무난": "평소처럼 이어가면 충분해요",
  "신중": "큰 결정은 잠시 미뤄도 괜찮아요",
  "유지": "지금 하던 흐름을 유지해보세요",
  "휴식": "잠깐 쉬어가도 괜찮아요",
  "주의": "중요한 일은 다른 시간에 해보세요",
};

const TYPE_TITLE: Record<NotificationType, string[]> = {
  DAILY: ["오늘 흐름 한번 볼까요", "오늘 컨디션 체크해볼까요", "오늘 흐름 살짝 볼까요"],
  FLOW:  ["지금 타이밍 괜찮아요", "지금 움직여도 좋아요", "지금 흐름 좋아요"],
  LOW:   ["조금 쉬어가도 좋아요", "잠깐 속도 줄여볼까요", "지금은 무리하지 말아요"],
  POINT: ["이 시간 한번 볼까요", "지금 구간 괜찮아요", "지금 흐름 체크해볼까요"],
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
  "오늘은 흐름이 잘 맞는 편이에요",
  "비교적 움직임이 잘 받쳐주는 흐름이에요",
  "에너지가 좋은 편이에요",
  "오늘은 비교적 흐름이 가벼운 편이에요",
  "움직임이 자연스럽게 맞아떨어질 수 있어요",
];
const DAILY_MID: string[] = [
  "오늘은 무난하게 이어가기 괜찮아요",
  "큰 기복 없이 지나가기 쉬운 흐름이에요",
  "전체적으로 차분하게 움직일 수 있어요",
  "크게 신경 쓰지 않아도 괜찮은 흐름이에요",
  "잔잔하게 이어가기 편한 하루예요",
];
const DAILY_LOW: string[] = [
  "오늘은 속도를 조금 조절하는 게 더 편할 수 있어요",
  "무리하지 않는 쪽이 더 잘 맞을 수 있어요",
  "에너지를 아껴가는 게 필요한 흐름이에요",
  "속도를 줄이면 더 안정적으로 갈 수 있어요",
  "지금은 부담을 줄이는 게 더 나을 수 있어요",
];

function dailyFlowLine(avg: number, seed: number): string {
  if (avg >= 65) return pick(DAILY_HIGH, seed);
  if (avg >= 55) return pick(DAILY_MID, seed);
  return pick(DAILY_LOW, seed);
}

// ── DAILY day-level interpretation and action (daySummary-based) ─────────────

const DAILY_INTERP_HIGH: string[] = [
  "하고 싶은 일을 시도해보기 괜찮은 날이에요",
  "계획한 일을 가볍게 밀어붙여도 잘 맞을 수 있어요",
  "움직임을 가져가면 흐름이 따라올 수 있어요",
  "생각했던 일을 가볍게 풀어보기 괜찮은 날이에요",
  "움직임을 가져가면 결과도 자연스럽게 따라올 수 있어요",
];
const DAILY_INTERP_MID: string[] = [
  "무리하지 않으면 편안하게 이어갈 수 있어요",
  "계획한 일을 하나씩 진행하기 괜찮은 날이에요",
  "속도를 유지하며 이어가면 잘 맞을 수 있어요",
  "속도를 유지하면서 가볍게 이어가면 부담이 적어요",
  "크게 욕심내지 않으면 편하게 지나갈 수 있어요",
];
const DAILY_INTERP_LOW: string[] = [
  "지금은 속도를 내기보다 여유를 두는 게 더 편할 수 있어요",
  "큰 결정보다는 상황을 지켜보는 쪽이 맞을 수 있어요",
  "조금 천천히 이어가는 편이 자연스러워요",
  "지금은 흐름을 따라가기보다 맞추는 쪽이 더 편할 수 있어요",
  "조금 여유를 두는 게 결과적으로 더 나을 수 있어요",
];

const DAILY_ACTION_HIGH: string[] = [
  "오늘은 하고 싶은 일을 가볍게 시도해도 괜찮아요",
  "중요한 일은 오늘 맞춰보는 것도 좋아요",
  "가볍게 움직이기 시작해도 잘 맞을 수 있어요",
  "시작이 필요한 일은 오늘 가볍게 건드려봐도 좋아요",
  "조금 미뤄둔 일에 손을 대보기 좋은 타이밍이에요",
];
const DAILY_ACTION_MID: string[] = [
  "평소 흐름대로 이어가면 충분해요",
  "해야 할 일을 차분히 정리해보세요",
  "무리하지 않는 선에서 이어가보세요",
  "오늘은 기존 하던 일 위주로 이어가도 충분해요",
  "조금씩 정리하는 느낌으로 보내도 좋아요",
];
const DAILY_ACTION_LOW: string[] = [
  "중요한 결정은 잠시 미뤄도 괜찮아요",
  "필요한 일만 가볍게 챙겨도 충분해요",
  "내 페이스를 유지하는 게 더 좋아요",
  "오늘은 꼭 필요한 일만 가볍게 챙겨도 괜찮아요",
  "휴식 위주로 흐름을 가져가는 것도 좋아요",
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
  "지금부터 흐름이 조금씩 좋아질 수 있어요",
  "이제 움직이기 괜찮은 타이밍이에요",
  "지금은 흐름이 가볍게 올라오는 구간이에요",
  "지금부터 흐름이 점점 나아질 수 있어요",
  "이 시간대부터 조금 수월해질 수 있어요",
];
const FLOW_INTERP: string[] = [
  "집중이 비교적 잘 이어질 수 있어요",
  "움직임이 자연스럽게 이어질 수 있어요",
  "일 진행이 수월할 수 있어요",
  "일이 비교적 자연스럽게 풀릴 수 있어요",
  "집중 흐름이 이어지기 쉬운 구간이에요",
];
const FLOW_ACTION: string[] = [
  "중요한 일은 지금 맞춰보는 것도 괜찮아요",
  "미뤄둔 일을 가볍게 시작해도 좋아요",
  "집중이 필요한 일을 지금 해보세요",
  "집중이 필요한 일은 이 시간에 맞춰보세요",
  "중요한 작업을 가볍게 시작해도 좋아요",
];

// ── LOW variants (pre-drop preparatory) ──────────────────────────────────────

const LOW_LEAD: string[] = [
  "조금 뒤 흐름이 느려질 수 있어요",
  "곧 속도를 줄이는 게 맞는 구간이 올 수 있어요",
  "이후에는 여유를 두는 게 더 편할 수 있어요",
  "이후에는 흐름이 조금 느려질 수 있어요",
  "조금 지나면 여유를 두는 게 맞을 수 있어요",
];
const LOW_BUFFER: string[] = [
  "지금은 아직 여유가 있는 편이에요",
  "지금 정리해두면 이후가 더 편해질 수 있어요",
  "지금 가볍게 마무리하기 좋은 타이밍이에요",
  "지금은 아직 정리할 여유가 있는 시간이에요",
  "지금 미리 챙겨두면 훨씬 수월해질 수 있어요",
];
const LOW_ACTION: string[] = [
  "필요한 일은 지금 미리 정리해도 좋아요",
  "중요한 일은 조금 앞당겨 처리해보는 것도 좋아요",
  "가볍게 마무리해두면 부담이 줄어들 수 있어요",
  "지금 할 수 있는 일은 미리 가볍게 끝내보세요",
  "부담이 되는 일은 지금 조금 줄여도 좋아요",
];

// ── POINT variants ────────────────────────────────────────────────────────────

const POINT_LEAD_HIGH: string[] = [
  "오늘은 비교적 흐름이 가벼운 편이에요",
  "전체적으로 무난하게 이어질 수 있어요",
  "큰 무리 없이 움직이기 괜찮은 날이에요",
  "오늘은 부담 없이 이어가기 좋은 흐름이에요",
  "편안하게 움직일 수 있는 구간이에요",
];
const POINT_HIGHLIGHT_HIGH: string[] = [
  "특히 이 시간대가 더 잘 맞을 수 있어요",
  "이 구간에서 흐름이 조금 더 살아날 수 있어요",
  "지금 타이밍을 활용해보는 것도 좋아요",
  "이 시간대에 움직이면 더 수월할 수 있어요",
  "지금 흐름을 가볍게 이어가보세요",
];
const POINT_LEAD_LOW: string[] = [
  "오늘은 속도를 조금 줄이는 게 편할 수 있어요",
  "전체적으로 여유를 두는 게 더 맞을 수 있어요",
  "무리하지 않고 가볍게 가는 게 좋아요",
  "오늘은 템포를 낮추는 쪽이 더 편할 수 있어요",
  "지금은 여유를 두고 움직이는 게 좋아요",
];
const POINT_HIGHLIGHT_LOW: string[] = [
  "이 시간대에는 조금 쉬어가도 괜찮아요",
  "지금은 속도를 낮추는 게 더 편할 수 있어요",
  "가볍게 템포를 줄여보는 것도 좋아요",
  "이 구간에서는 무리하지 않는 게 좋아요",
  "잠깐 흐름을 정리해보는 것도 괜찮아요",
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
