import type { DailyFortune } from "./aggregator";

export type NotificationType = "DAILY" | "EVENT" | "STATE";

export interface NotificationSettings {
  dailyEnabled:      boolean;
  eventStateEnabled: boolean;
  dailyTime:         string;  // "HH:MM"
}

export interface PlannedNotification {
  type:        NotificationType;
  triggerTime: Date;
  score:       number;
  delta?:      number;    // EVENT: signed score change (+rise / -drop)
  stateHigh?:  boolean;   // STATE: true=HIGH (≥75), false=LOW (≤54)
  rangeMin?:   number;    // DAILY
  rangeMax?:   number;    // DAILY
}

type Segment = NonNullable<DailyFortune["timeSegments"]>[number];

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Planner ──────────────────────────────────────────────────────────────────

export function planNotifications(
  fortune: DailyFortune,
  date: string,
): PlannedNotification[] {
  const segments: Segment[] = fortune.timeSegments ?? [];
  if (segments.length === 0) return [];

  // validSegs: daytime segments for range/event/state logic
  const validSegs = segments.filter(s => s.startHour >= 9);

  const scoreSet  = validSegs.length > 0 ? validSegs : segments;
  const rangeMin  = Math.min(...scoreSet.map(s => s.score));
  const rangeMax  = Math.max(...scoreSet.map(s => s.score));

  const result: PlannedNotification[] = [];

  // DAILY — trigger before first segment, minimum 07:00
  const first      = segments[0];
  const rawTrigger = makeTime(date, first.startHour, -30);
  const minTrigger = makeTime(date, 7);
  result.push({
    type: "DAILY",
    triggerTime: rawTrigger < minTrigger ? minTrigger : rawTrigger,
    score: Math.round((rangeMin + rangeMax) / 2),
    rangeMin,
    rangeMax,
  });

  if (validSegs.length < 2) return result;

  const dailyRange = rangeMax - rangeMin;

  if (dailyRange >= 12) {
    // EVENT mode: top 2 transitions by |delta| into validSeg startHours
    const transitions: Array<{ seg: Segment; delta: number }> = [];
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].startHour < 9) continue;
      if (i === 0) continue;
      const delta = segments[i].score - segments[i - 1].score;
      transitions.push({ seg: segments[i], delta });
    }
    transitions.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    const usedHours = new Set<number>();
    let count = 0;
    for (const { seg, delta } of transitions) {
      if (count >= 2) break;
      if (usedHours.has(seg.startHour)) continue;
      usedHours.add(seg.startHour);
      result.push({
        type: "EVENT",
        triggerTime: makeTime(date, seg.startHour),
        score: seg.score,
        delta,
      });
      count++;
    }
  } else {
    // STATE mode: max ≥ 75 → HIGH, min ≤ 54 → LOW, otherwise NORMAL (no notification)
    if (rangeMax >= 75) {
      const best = validSegs.reduce((a, b) => b.score > a.score ? b : a);
      result.push({
        type: "STATE",
        triggerTime: makeTime(date, best.startHour),
        score: best.score,
        stateHigh: true,
      });
    } else if (rangeMin <= 54) {
      const worst = validSegs.reduce((a, b) => b.score < a.score ? b : a);
      result.push({
        type: "STATE",
        triggerTime: makeTime(date, worst.startHour),
        score: worst.score,
        stateHigh: false,
      });
    }
  }

  result.sort((a, b) => a.triggerTime.getTime() - b.triggerTime.getTime());
  return result;
}

// ── Message generation ────────────────────────────────────────────────────────

// greeting variations for DAILY — selected by date seed
const DAILY_GREETINGS = [
  "좋은 하루 보내세요!",
  "오늘도 좋은 하루 되세요!",
  "오늘 하루도 잘 보내세요",
  "편안한 하루 보내세요",
  "오늘도 편안하게 보내세요",
  "가벼운 하루 보내세요",
  "오늘도 힘내세요!",
  "좋은 하루 되길 바랄게요",
  "오늘 하루도 화이팅이에요!",
  "따뜻한 하루 보내세요",
  "오늘도 좋은 일 가득하세요",
  "오늘 하루도 무사히 보내세요",
  "오늘도 기분 좋은 하루 되세요",
  "좋은 하루 시작해봐요!",
  "오늘도 좋은 하루 함께해요",
  "오늘 하루도 잘 풀리길 바랄게요",
  "오늘도 웃는 하루 되세요 :)",
  "편안한 하루 되셨으면 좋겠어요",
  "오늘도 좋은 흐름 이어가세요",
  "오늘 하루도 천천히 보내세요",
  "오늘 하루도 응원할게요",
  "오늘도 좋은 하루 보내고 가세요!",
  "기분 좋은 하루 보내세요!",
  "오늘도 가볍게 시작해봐요",
  "오늘 하루도 잘 지나가길 바랄게요",
  "오늘도 좋은 하루 보내세요 :)",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateNotificationMessage(
  n: PlannedNotification,
  date: string,
): { title: string; body: string } {
  if (n.type === "DAILY") {
    const greeting = pick(DAILY_GREETINGS);
    return {
      title: formatMonthDay(date),
      body:  `${n.rangeMin ?? 0}~${n.rangeMax ?? 0} · ${greeting}`,
    };
  }

  if (n.type === "EVENT") {
    const d    = n.delta ?? 0;
    const sign = d >= 0 ? `↑ +${d}` : `↓ ${d}`;
    return { title: "흐름 변화", body: sign };
  }

  // STATE
  return n.stateHigh
    ? { title: "좋은 흐름 시작", body: `· ${n.score}` }
    : { title: "낮은 흐름 시작", body: `· ${n.score}` };
}

function formatMonthDay(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}월 ${Number(day)}일`;
}

// ── Settings filter ───────────────────────────────────────────────────────────

export function applyNotificationSettings(
  notifications: PlannedNotification[],
  settings: NotificationSettings,
  date: string,
): PlannedNotification[] {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm]  = settings.dailyTime.split(":").map(Number);

  let result = notifications.map(n => {
    if (n.type !== "DAILY") return n;
    return { ...n, triggerTime: new Date(y, m - 1, d, hh, mm, 0, 0) };
  });

  if (!settings.dailyEnabled)      result = result.filter(n => n.type !== "DAILY");
  if (!settings.eventStateEnabled) result = result.filter(n => n.type !== "EVENT" && n.type !== "STATE");

  result.sort((a, b) => a.triggerTime.getTime() - b.triggerTime.getTime());
  return result;
}
