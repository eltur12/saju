import type { AiInterpretationRequest } from "../ai/types";
import { DAILY_INTERPRETATION_PROMPT } from "../ai/prompt";
import { OPENAI_API_KEY, OPENAI_MODEL } from "../ai/openaiConfig";

export interface AiInterpretationResult {
  content: string;
  usage: { input: number; output: number; total: number } | null;
}

export async function generateDailyInterpretationFull(
  request: AiInterpretationRequest,
): Promise<AiInterpretationResult> {
  console.log(`[AI] 요청 시작 date=${request.date} score=${request.overall} model=${OPENAI_MODEL}`);

  const payloadJson = JSON.stringify(request, null, 2);
  console.log(`[AI] payload 크기=${payloadJson.length}자`);
  console.log(`[AI] 요청 데이터:\n${payloadJson}`);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: DAILY_INTERPRETATION_PROMPT },
        { role: "user",   content: `DATA\n${payloadJson}` },
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

export async function generateDailyInterpretation(request: AiInterpretationRequest): Promise<string> {
  const { content } = await generateDailyInterpretationFull(request);
  return content;
}
