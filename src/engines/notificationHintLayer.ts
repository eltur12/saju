import type { DailyFortune } from "./aggregator";

type NotificationHint = NonNullable<DailyFortune["notificationHints"]>[number];

function bestWindowLabel(tags: string[]): string {
  if (tags.includes("집중")) return "지금 집중하면 잘 풀려요";
  if (tags.includes("추진")) return "지금 밀어붙이기 좋아요";
  if (tags.includes("정리")) return "지금 정리하기 좋아요";
  return "지금 중요한 일 하기 좋아요";
}

function cautionWindowLabel(tags: string[]): string {
  if (tags.includes("휴식")) return "지금은 쉬어가는 게 좋아요";
  if (tags.includes("주의")) return "지금은 무리하지 마세요";
  if (tags.includes("신중")) return "지금은 결정 미루는 게 좋아요";
  return "지금은 무리하지 않는 게 좋아요";
}

export function generateNotificationHints(
  dailyFortune: DailyFortune,
): DailyFortune["notificationHints"] {
  const segments = dailyFortune.timeSegments;
  if (!segments || segments.length === 0) return [];

  const hints: NotificationHint[] = [];

  // A. best_window
  const best = segments.reduce((a, b) => (b.score > a.score ? b : a));
  hints.push({
    type: "best_window",
    hour: best.startHour,
    score: best.score,
    label: bestWindowLabel(best.tags),
  });

  // B. caution_window (only if score < 50)
  const worst = segments.reduce((a, b) => (b.score < a.score ? b : a));
  if (worst.score < 50) {
    hints.push({
      type: "caution_window",
      hour: worst.startHour,
      score: worst.score,
      label: cautionWindowLabel(worst.tags),
    });
  }

  // C. next_rise (first segment where score rises >= 5 vs previous)
  if (hints.length < 3) {
    for (let i = 1; i < segments.length; i++) {
      if (segments[i].score - segments[i - 1].score >= 5) {
        hints.push({
          type: "next_rise",
          hour: segments[i].startHour,
          score: segments[i].score,
          label: "흐름이 좋아지는 시간",
        });
        break;
      }
    }
  }

  return hints.slice(0, 3);
}
