import type { AiInterpretationRequestV2 } from "../ai/v2/types";
import {
  DAILY_INTERPRETATION_SYSTEM_PROMPT,
  DAILY_INTERPRETATION_FEW_SHOTS,
  BATCH_INTERPRETATION_SYSTEM_PROMPT,
  BATCH_INTERPRETATION_FEW_SHOTS,
} from "../ai/prompt";
import { OPENAI_API_KEY, OPENAI_MODEL } from "../ai/openaiConfig";

export interface AiInterpretationResult {
  content: string;
  usage: { input: number; output: number; total: number } | null;
}

export async function generateDailyInterpretationFull(
  request: AiInterpretationRequestV2,
): Promise<AiInterpretationResult> {
  console.log(`[AI] 요청 시작 date=${request.date} score=${request.overall} model=${OPENAI_MODEL}`);
  console.log(`[AI] V2 payload: topEvents=${request.topEvents.length}, topStates=${request.topStates.length}, categoryHighlights=${Object.keys(request.categoryHighlights).join(",")}`);

  const scores = request.scores as Record<string, number>;
  const sortedCategories = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const topCategory    = sortedCategories[0][0];
  const bottomCategory = sortedCategories[sortedCategories.length - 1][0];

  const userPayload = {
    overall:         request.overall,
    topCategory,
    bottomCategory,
    focus:           request.focus,
    topStates:       request.topStates,
  };

  const payloadJson = JSON.stringify(userPayload);
  console.log(`[AI] payload 크기=${payloadJson.length}자`);
  console.log(`[AI] 요청 데이터:\n${JSON.stringify(request, null, 2)}`);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: DAILY_INTERPRETATION_SYSTEM_PROMPT },
        ...DAILY_INTERPRETATION_FEW_SHOTS,
        { role: "user",   content: payloadJson },
      ],
    }),
  });

  console.log(`[AI] 응답 status=${response.status}`);

  if (!response.ok) {
    const body = await response.text().catch(() => "(응답 없음)");
    console.error(`[AI] 오류 body=${body}`);
    throw new Error(`OpenAI API ${response.status}: ${body}`);
  }

  const json = await response.json() as {
    choices: Array<{ message: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };

  const content = json.choices[0].message.content;
  const raw     = json.usage;
  const usage   = raw
    ? { input: raw.prompt_tokens, output: raw.completion_tokens, total: raw.total_tokens }
    : null;

  if (usage) {
    console.log(`[AI] 토큰 input=${usage.input} output=${usage.output} total=${usage.total}`);
  }
  console.log(`[AI] 응답 내용:\n${content}`);

  return { content, usage };
}

export async function generateDailyInterpretation(request: AiInterpretationRequestV2): Promise<string> {
  const { content } = await generateDailyInterpretationFull(request);
  return content;
}

// ── Batch 해석 (선생성) ──────────────────────────────────────────────────────

export interface AiBatchDayPayload {
  date: string;
  overall: number;
  topCategory: string;
  bottomCategory: string;
  focus: unknown[];
  topStates: unknown[];
}

export interface AiBatchDayResult {
  date: string;
  framing: string;
  focusPoint: string;
  bestArea: string;
  worstArea: string;
  summary: string;
}

export interface AiBatchResult {
  days: AiBatchDayResult[];
}

export async function generateBatchInterpretation(
  days: AiBatchDayPayload[],
): Promise<AiBatchResult> {
  console.log(`[AI-BATCH] 요청 시작 days=${days.length} (${days.map(d => d.date).join(", ")})`);

  const payload = JSON.stringify({ days });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: BATCH_INTERPRETATION_SYSTEM_PROMPT },
        ...BATCH_INTERPRETATION_FEW_SHOTS,
        { role: "user",   content: payload },
      ],
    }),
  });

  console.log(`[AI-BATCH] 응답 status=${response.status}`);

  if (!response.ok) {
    const body = await response.text().catch(() => "(응답 없음)");
    throw new Error(`OpenAI API ${response.status}: ${body}`);
  }

  const json = await response.json() as {
    choices: Array<{ message: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };

  const raw = json.choices[0].message.content;
  const clean = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

  if (json.usage) {
    const u = json.usage;
    console.log(`[AI-BATCH] 토큰 input=${u.prompt_tokens} output=${u.completion_tokens} total=${u.total_tokens}`);
  }
  console.log(`[AI-BATCH] 응답:\n${clean}`);

  const parsed = JSON.parse(clean) as { days: unknown[] };

  // ── 응답 검증 ──────────────────────────────────────────────────────────────
  if (!Array.isArray(parsed.days)) {
    throw new Error("[AI-BATCH] 응답 형식 오류: days가 배열이 아님");
  }

  const validInputDates = new Set(days.map(d => d.date));
  const seenDates = new Set<string>();
  const validDays: AiBatchDayResult[] = [];

  for (const item of parsed.days) {
    if (!item || typeof item !== "object") {
      console.warn("[AI-BATCH] item이 객체 아님 — 무시");
      continue;
    }
    const it = item as Record<string, unknown>;

    // date 검증
    if (typeof it.date !== "string" || it.date === "") {
      console.warn("[AI-BATCH] date 누락 또는 빈 문자열 — 무시");
      continue;
    }
    if (!validInputDates.has(it.date)) {
      console.warn(`[AI-BATCH] 입력에 없는 date 응답: ${it.date} — 무시`);
      continue;
    }

    // 필드 타입 검증
    if (
      typeof it.focusPoint !== "string" ||
      typeof it.bestArea   !== "string" ||
      typeof it.worstArea  !== "string" ||
      typeof it.summary    !== "string"
    ) {
      console.warn(`[AI-BATCH] ${it.date} 필드 타입 오류 — 무시`);
      continue;
    }

    // summary 빈 문자열 제외
    if (it.summary === "") {
      console.warn(`[AI-BATCH] ${it.date} summary 빈 문자열 — 저장 제외`);
      continue;
    }

    const framing = typeof it.framing === "string" ? it.framing : "";

    // 중복 date 처리
    if (seenDates.has(it.date)) {
      console.warn(`[AI-BATCH] ${it.date} 중복 응답 — 마지막 유효 응답으로 교체`);
      const idx = validDays.findIndex(d => d.date === it.date);
      if (idx !== -1) {
        validDays[idx] = { date: it.date, framing, focusPoint: it.focusPoint, bestArea: it.bestArea, worstArea: it.worstArea, summary: it.summary };
      }
      continue;
    }

    seenDates.add(it.date);
    validDays.push({ date: it.date, framing, focusPoint: it.focusPoint, bestArea: it.bestArea, worstArea: it.worstArea, summary: it.summary });
  }

  console.log(`[AI-BATCH] 검증 완료 — 입력=${days.length}개, 유효=${validDays.length}개`);
  return { days: validDays };
}
