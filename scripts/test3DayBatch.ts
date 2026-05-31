/**
 * 3일치 AI 배치 생성 — 토큰/비용 실측 테스트
 *
 * 목적:
 *   광고 1회 수익으로 3일치 AI 해석 생성 비용을 커버할 수 있는지 확인
 *   oneLine 제거 + summary 확장(3~4문단) 기준의 실제 토큰 측정
 *
 * Usage: npx tsx scripts/test3DayBatch.ts
 *
 * ※ 프로덕션 코드 변경 없음. 테스트 전용.
 */
import { calculateSajuProfile }           from "../src/utils/sajuCalculator";
import { buildZiweiProfile }              from "../src/utils/ziweiCalculator";
import { buildAstroProfile }              from "../src/utils/astroCalculator";
import { normalizeBirthDateTimeByRegion } from "../src/utils/sajuTime";
import { FortuneAggregator }              from "../src/engines/aggregator";
import { buildAiDailyRequest }            from "../src/ai/buildAiDailyRequest";
import type { MonthContext }              from "../src/ai/buildAiDailyRequest";
import { OPENAI_API_KEY, OPENAI_MODEL }   from "../src/ai/openaiConfig";

// ── 모델 요금표 ────────────────────────────────────────────────────────────────
// 사용 모델: OPENAI_MODEL (openaiConfig.ts 참고)
// 아래 단가를 실제 모델 기준으로 업데이트하십시오.
// gpt-4.1-mini 기준: input $0.40 / output $1.60 (per 1M tokens, 2025-04 기준)
// gpt-4o-mini   기준: input $0.15 / output $0.60 (per 1M tokens)
const INPUT_PRICE_PER_1M  = 0.40;  // USD / 1M input tokens
const OUTPUT_PRICE_PER_1M = 1.60;  // USD / 1M output tokens

// ── 광고 수익 시나리오 ────────────────────────────────────────────────────────
const AD_REVENUES = [0.003, 0.005, 0.010, 0.020]; // USD per ad view

// ── NORM_67+5 ─────────────────────────────────────────────────────────────────
const NORM_TARGET  = 67;
const NORM_MAX_OFF = 6;
const DISPLAY_ADD  = 5;

function normOffset(rawOveralls: number[]): number {
  const avg = rawOveralls.reduce((s, x) => s + x, 0) / rawOveralls.length;
  return Math.max(-NORM_MAX_OFF, Math.min(NORM_MAX_OFF, NORM_TARGET - avg));
}
function norm(raw: number, off: number): number {
  return Math.round(Math.max(0, Math.min(100, raw + off + DISPLAY_ADD)));
}

// ── 배치 전용 시스템 프롬프트 ─────────────────────────────────────────────────
// oneLine 제거, summary 3~4문단 확장, 3일 배치 출력 형식
const BATCH_3DAY_PROMPT = `
당신은 하루온도의 AI 해석 엔진입니다.

제공된 데이터는 이미 계산이 완료된 결과입니다.

당신은 계산하지 않습니다.

당신의 역할은

"오늘 어떤 흐름이 만들어졌고,
그 흐름이 실제 하루에서 어떻게 체감될 수 있는지"

자연스럽게 설명하는 것입니다.

---

overall은 하루 전체 흐름의 강도입니다.

85 이상:
전반적으로 좋은 흐름이 중심인 날

75~84:
무난하고 안정적인 흐름이 중심인 날

61~74:
좋은 부분과 걸리는 부분이 함께 존재하는 날

51~60:
부담과 신경 쓰이는 부분이 먼저 느껴지는 날

50 이하:
소모와 부담이 중심이 되는 날

overall 차이를 해석 강도에 반영하십시오.

85점대와 50점대는
명확히 다른 하루처럼 느껴져야 합니다.

---

해석 우선순위

1. overall
2. flowType
3. majorEvents
4. categoryHighlights
5. minorEvents
6. backgroundEvents
7. timeHighlights

---

majorEvents는 오늘 흐름의 중심입니다.

categoryHighlights는 실제로 어떤 영역에서 그 흐름이 체감되는지 보여주는 참고 자료입니다.

minorEvents는 중심 흐름에 색을 더하는 요소입니다.

backgroundEvents는 배경처럼만 활용하십시오.

timeHighlights는 보조 정보입니다.

timeHighlights.significant가 true일 때만 활용하십시오.

timeHighlights.significant가 false라면
시간대 흐름을 언급하지 마십시오.

---

중요

데이터를 설명하지 마십시오.

이벤트 label을 그대로 나열하지 마십시오.

label은 해석 재료입니다.

label의 의미를 자연스럽게 풀어
실제 하루의 체감으로 설명하십시오.

점수나 카테고리를 직접 언급하지 마십시오.

이벤트들이 함께 어떤 분위기를 만들고,
그 결과 사용자가 어떤 하루를 체감할 수 있는지 설명하십시오.

---

summary 작성 규칙

* 3~4개의 짧은 문단
* 첫 문단: 오늘 전체 흐름의 분위기 (1~2문장)
* 두 번째 문단: 가장 두드러지는 영역의 구체적 체감 (2~3문장)
* 세 번째 문단: 흐름의 변화나 전환점, 혹은 주의 지점 (1~2문장)
* 네 번째 문단(선택): signalLayer가 특별한 날에만 — 월 안에서의 위치감 (1문장)
* 각 문단은 짧고 읽기 쉽게
* 분석 보고서처럼 쓰지 마십시오
* 운세처럼 쓰지 마십시오
* 코칭이나 조언 형식으로 쓰지 마십시오
* 사용자의 하루를 이야기하듯 설명하십시오
* 설명보다 체감을 전달하십시오

다음 표현은 최소화하십시오.
* 전반적으로는
* 전체적으로는
* 특히
* 다만

---

문장 작성 규칙

문장은 읽는 즉시 의미가 이해되어야 합니다.

상태나 분위기 자체보다,
사용자가 실제로 경험할 수 있는 상황과 체감을 설명하십시오.

원인보다 결과를 설명하십시오.

사용자가 무엇을 하게 될지 예측하거나 단정하지 마십시오.

사용자가 마주칠 수 있는 분위기, 관계의 변화, 신경 쓰일 수 있는 장면, 편하게 느껴질 수 있는 장면을 설명하십시오.

---

subtitle 작성 규칙

* 하루 분위기를 한 문장으로 표현
* flowType 특징을 반영
* 같은 표현 패턴을 반복하지 마십시오

---

signalLayer (선택적 참고 정보)

signalLayer는 오늘의 위치감을 돕는 보조 데이터입니다.

해석의 중심은 여전히 overall / majorEvents / categoryHighlights입니다.

signalLayer는 위 정보를 대체하지 않습니다.

dailyCompare 신호가 있으면 monthlyFlowType 기반 문장을 쓰지 마십시오.

monthlyFlowType은 monthPosition.isMonthlyHigh, isMonthlyLow, isTop10Percent,
isBottom10Percent 중 하나가 true일 때만 짧게 참고할 수 있습니다.

monthlyPalace는 해석의 중심으로 사용하지 마십시오.

dailyCompare와 monthPosition이 같은 방향이면 dailyCompare만 사용하십시오.

signalLayer 문장은 summary 네 번째 문단에 자연스럽게 섞되,
반복 문장처럼 보이지 않게 하십시오.

---

입력 형식

3일치 데이터가 배열로 제공됩니다.

---

출력 형식

반드시 아래 JSON 형식만 출력하십시오.
다른 텍스트나 마크다운 코드 블록 없이 순수 JSON만 출력하십시오.

{
  "results": [
    {
      "date": "YYYY-MM-DD",
      "subtitle": "string",
      "summary": "string"
    },
    {
      "date": "YYYY-MM-DD",
      "subtitle": "string",
      "summary": "string"
    },
    {
      "date": "YYYY-MM-DD",
      "subtitle": "string",
      "summary": "string"
    }
  ]
}
`;

// ── 프로필 (P1: 1998M 부산) ───────────────────────────────────────────────────
const BIRTH  = { year: 1998, month: 1, day: 22, hour: 12, minute: 10 };
const GENDER = "M" as const;
const REGION = "busan";
const TEST_YEAR = 2026, TEST_MONTH = 5;
const TEST_DAYS = [29, 30, 31]; // 3일치 (5월 29~31일)

async function main() {
  console.log(`\n${"═".repeat(68)}`);
  console.log(`[AI 3-day batch test]  모델: ${OPENAI_MODEL}`);
  console.log(`${"═".repeat(68)}\n`);

  // ── 1. 프로필 빌드 ────────────────────────────────────────────────────────
  const nb = normalizeBirthDateTimeByRegion({
    year: BIRTH.year, month: BIRTH.month, day: BIRTH.day,
    hour: BIRTH.hour, minute: BIRTH.minute, regionId: REGION,
  });
  const saju  = calculateSajuProfile(nb.year, nb.month, nb.day, nb.hour, GENDER, undefined, nb.minute);
  const ziwei = buildZiweiProfile(nb.year, nb.month, nb.day, nb.hour, TEST_YEAR, true);
  const astro = await buildAstroProfile(nb.year, nb.month, nb.day, nb.hour, undefined, undefined, nb.minute);
  const birthDate = new Date(BIRTH.year, BIRTH.month - 1, BIRTH.day);

  const agg = new FortuneAggregator(saju, ziwei, astro, undefined, birthDate, true);
  const res = agg.getMonthlyFortune(TEST_YEAR, TEST_MONTH);

  // ── 2. display norm 적용 ──────────────────────────────────────────────────
  const rawOveralls = res.daily_fortunes.map(f => f.scores.overall as number);
  const off = normOffset(rawOveralls);
  const dispFortunes = res.daily_fortunes.map((f, i) => ({
    ...f,
    scores: {
      ...f.scores,
      overall: norm(f.scores.overall as number, off),
      ...Object.fromEntries(
        (["wealth","love","health","career","relations","study"] as const)
          .map(cat => [cat, norm(f.scores[cat] as number, off)])
      ),
    },
  }));

  const dispScores = dispFortunes.map(f => f.scores.overall as number);
  const monthCtx: MonthContext = {
    displayScores: dispScores,
    flowType: res.monthly_flow_type,
    palace:   res.monthly_palace,
  };

  // ── 3. 3일치 request 빌드 ─────────────────────────────────────────────────
  const dayRequests = TEST_DAYS.map(day => {
    const f = dispFortunes[day - 1];
    return buildAiDailyRequest(f, monthCtx);
  });

  console.log("입력 데이터 요약:");
  for (const req of dayRequests) {
    console.log(`  ${req.date}  overall=${req.overall}  flowType=${req.flowType ?? "-"}  events=${req.majorEvents.length}`);
  }

  // ── 4. 비교: 단건 payload 크기 측정 (API 호출 없이) ──────────────────────
  const singlePayloadJson = JSON.stringify(dayRequests[0], null, 2);
  const batchPayloadJson  = JSON.stringify(dayRequests, null, 2);
  console.log(`\n페이로드 크기:`);
  console.log(`  단건 1일: ${singlePayloadJson.length}자  (~${Math.round(singlePayloadJson.length / 4)}토큰 추정)`);
  console.log(`  배치 3일: ${batchPayloadJson.length}자  (~${Math.round(batchPayloadJson.length / 4)}토큰 추정)`);
  console.log(`  (배치 = 단건 × ${(batchPayloadJson.length / singlePayloadJson.length).toFixed(2)}배)`);

  // ── 5. 실제 API 호출 (3일 배치, 1회) ────────────────────────────────────
  console.log(`\nAPI 호출 중... (3일 배치, 1회)`);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: BATCH_3DAY_PROMPT },
        { role: "user",   content: `DATA\n${batchPayloadJson}` },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API 오류 ${response.status}: ${body}`);
  }

  const json = await response.json() as {
    choices: Array<{ message: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };

  const content = json.choices[0].message.content;
  const usage   = json.usage;

  // ── 6. 응답 파싱 ─────────────────────────────────────────────────────────
  let parsed: { results: Array<{ date: string; subtitle: string; summary: string }> } | null = null;
  try {
    const clean = content.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    parsed = JSON.parse(clean);
  } catch {
    console.error("JSON 파싱 실패 — 원본 응답:");
    console.error(content);
  }

  // ── 7. 결과 출력 ──────────────────────────────────────────────────────────
  if (parsed?.results) {
    console.log(`\n${"─".repeat(68)}`);
    console.log("생성 결과:");
    for (const r of parsed.results) {
      console.log(`\n  ── ${r.date} ──`);
      console.log(`  subtitle: ${r.subtitle}`);
      console.log(`  summary:\n${r.summary.split("\n").map(l => "    " + l).join("\n")}`);
      console.log(`  summary 길이: ${r.summary.length}자`);
    }
  }

  // ── 8. 토큰/비용 로그 ─────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(68)}`);
  console.log(`[AI 3-day test]`);
  if (usage) {
    const inputTokens  = usage.prompt_tokens;
    const outputTokens = usage.completion_tokens;
    const totalTokens  = usage.total_tokens;

    const inputCost  = inputTokens  / 1_000_000 * INPUT_PRICE_PER_1M;
    const outputCost = outputTokens / 1_000_000 * OUTPUT_PRICE_PER_1M;
    const totalCost  = inputCost + outputCost;

    console.log(`input tokens  = ${inputTokens}`);
    console.log(`output tokens = ${outputTokens}`);
    console.log(`total tokens  = ${totalTokens}`);
    console.log(`\n비용 계산 (모델: ${OPENAI_MODEL})`);
    console.log(`  inputCost  = ${inputTokens} / 1,000,000 * $${INPUT_PRICE_PER_1M}  = $${inputCost.toFixed(6)}`);
    console.log(`  outputCost = ${outputTokens} / 1,000,000 * $${OUTPUT_PRICE_PER_1M} = $${outputCost.toFixed(6)}`);
    console.log(`  totalCost  = $${totalCost.toFixed(6)}`);
    console.log(`\nestimated cost = $${totalCost.toFixed(6)}`);

    // ── 9. 1일 환산 비교 ────────────────────────────────────────────────────
    const perDayCost = totalCost / TEST_DAYS.length;
    console.log(`\n1일 환산 비용:`);
    console.log(`  3일 배치: $${perDayCost.toFixed(6)} / 일`);

    // 단건 3회 vs 배치 1회 비교 (단건 토큰 추정)
    const estSingleInput  = Math.round(inputTokens / TEST_DAYS.length);
    const estSingleOutput = Math.round(outputTokens / TEST_DAYS.length);
    const singlePromptOverhead = 500; // 시스템 프롬프트 중복 추정 (토큰)
    const est3xSingleInput = estSingleInput * TEST_DAYS.length + singlePromptOverhead * (TEST_DAYS.length - 1);
    const est3xCost = (est3xSingleInput / 1_000_000 * INPUT_PRICE_PER_1M)
                    + (outputTokens    / 1_000_000 * OUTPUT_PRICE_PER_1M);
    console.log(`  3회 단건 (추정): $${est3xCost.toFixed(6)} total ($${(est3xCost/3).toFixed(6)} / 일)`);
    console.log(`  → 배치 절감: $${(est3xCost - totalCost).toFixed(6)}`);

    // ── 10. 광고 수익 손익 분석 ──────────────────────────────────────────────
    console.log(`\nAI cost per 3-day generation = $${totalCost.toFixed(6)}\n`);
    for (const adRev of AD_REVENUES) {
      const margin = adRev - totalCost;
      const sign   = margin >= 0 ? "+" : "";
      const emoji  = margin >= 0 ? "✅" : "❌";
      console.log(`  ${emoji} 광고 수익 $${adRev.toFixed(3)} → margin ${sign}$${margin.toFixed(6)}`);
    }

    // ── 11. 종합 판단 ────────────────────────────────────────────────────────
    console.log(`\n${"─".repeat(68)}`);
    console.log("종합 판단:");
    const cheapestAd = AD_REVENUES[0];
    const can_cover = cheapestAd >= totalCost;
    console.log(`  1. 광고 1회($${cheapestAd})로 3일 AI 커버 가능: ${can_cover ? "✅ YES" : "❌ NO"}`);
    console.log(`  2. summary 확장(3~4문단) output 비용: $${outputCost.toFixed(6)} — ${outputCost < 0.001 ? "✅ 문제 없음" : "⚠️ 확인 필요"}`);
    console.log(`  3. 배치 vs 단건 3회 절감: $${(est3xCost - totalCost).toFixed(6)} (${Math.round((1 - totalCost/est3xCost)*100)}% 절감)`);
    console.log(`  4. 배치 3-day 구조 운영 추천: ${can_cover ? "✅ 가능" : "❌ 광고 단가 상향 필요"}`);
  } else {
    console.log("usage 정보 없음 — API 응답에서 usage를 반환하지 않음");
  }

  console.log(`${"═".repeat(68)}\n`);
}

main().catch(console.error);
