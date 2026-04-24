/**
 * 할일 / 요약 생성기
 */
import type { ScoreMap } from "./sajuEngine";

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

const TODO_POOL: Record<string, string[]> = {
  wealth_high:   ["재무 점검","투자 검토","지출 정리","수입 확인","계획 점검","자금 점검","재정 정리","투자 점검","지출 관리","흐름 점검","재무 확인","자금 정리","재정 확인","예산 점검","수입 점검"],
  wealth_low:    ["지출 줄이기","소비 자제","결정 보류","투자 미루기","금전 점검","소비 줄이기","지출 관리","지출 점검","투자 보류","지출 절제","소비 절제","금전 확인","예산 줄이기","거래 보류","자금 관리"],
  love_high:     ["연락하기","마음 표현","약속 잡기","대화 나누기","관계 확장","연락 이어가기","표현 해보기","만남 시도","대화 이어가기","관계 넓히기","안부 묻기","마음 전하기","대화 열기","약속 제안","호감 표현"],
  love_low:      ["감정 조절","대화 자제","결정 미루기","거리 두기","말 조심","표현 줄이기","연락 줄이기","감정 정리","말 아끼기","관계 조심","오해 피하기","속마음 정리","답장 늦추기","감정 쉬기","대화 쉬기"],
  health_high:   ["운동하기","스트레칭","식단 관리","수면 유지","몸 점검","가벼운 운동","몸 풀기","건강 관리","컨디션 유지","체력 관리","산책하기","호흡 정리","자세 점검","루틴 유지","활동 늘리기"],
  health_low:    ["휴식하기","과로 금지","무리 금지","수면 확보","컨디션 체크","휴식 우선","몸 쉬기","피로 관리","과로 피하기","몸 챙기기","일찍 쉬기","자극 줄이기","수분 챙기기","잠 보충","활동 줄이기"],
  career_high:   ["업무 집중","도전 시작","기획 진행","아이디어 정리","미팅 진행","업무 몰입","일 진행","기획 정리","업무 추진","일 정리","제안하기","자료 정리","집중 작업","업무 점검","일정 정리"],
  career_low:    ["속도 조절","결정 보류","충돌 회피","발언 주의","계획 유지","속도 낮추기","결정 미루기","갈등 피하기","말 주의","일 유지","무리 줄이기","보고 점검","일정 조절","실수 확인","작업 정리"],
  relations_high:["연락하기","관계 확장","대화 나누기","약속 잡기","네트워킹","연결 만들기","친구 연락","모임 참여","소통 늘리기","관계 넓히기","안부 묻기","대화 열기","도움 주기","인사하기","만남 제안"],
  relations_low: ["갈등 피하기","말 조심","거리 두기","논쟁 피하기","관계 조심","연락 줄이기","충돌 회피","비교 자제","감정 정리","조용히 지내기","대화 줄이기","오해 피하기","반응 늦추기","감정 쉬기","말 아끼기"],
  study_high:    ["학습 시작","공부하기","강의 듣기","독서하기","정리하기","기록하기","아이디어 정리","배움 확장","집중 학습","공부 몰입","노트 정리","복습하기","개념 정리","자료 읽기","계획 세우기"],
  study_low:     ["공부 줄이기","집중 유지","계획 미루기","부담 줄이기","가볍게 보기","정리 위주","무리 금지","속도 조절","학습 조절","쉬어가기","복습만 하기","자료 정리","분량 줄이기","가볍게 복습","집중 쉬기"],
  overall_high:  ["목표 점검","도전 시도","연락하기","계획 정리","기회 활용","목표 확인","도전 해보기","연결 만들기","계획 점검","기회 잡기","일정 정리","시작하기","흐름 타기","가볍게 실행","우선순위 정리"],
  overall_low:   ["휴식 우선","속도 줄이기","혼자 집중","무리 금지","현상 유지","휴식하기","속도 낮추기","혼자 시간","과로 피하기","유지하기","일정 줄이기","쉬어가기","부담 줄이기","천천히 하기","에너지 아끼기"],
};

const DONT_POOL: Record<string, string[]> = {
  wealth:   ["충동 소비","큰 지출","성급한 투자","금전 거래","무리한 결제","지출 방심","대출 판단","보증 서기","수익 과신","무리한 계약","과한 투자","지출 확대","재정 과신","위험 감수","계획 무시"],
  love:     ["감정 폭발","충동 연락","오해 키우기","말 실수","관계 압박","답장 재촉","서운함 표출","관계 단정","감정 과속","상대 압박","과한 기대","성급한 고백","표현 과다","감정 과열","관계 밀어붙이기"],
  health:   ["과로하기","밤샘하기","피로 방치","무리한 운동","몸 무시","수면 부족","회복 무시","과한 활동","식사 거르기","자극 늘리기","운동 과속","컨디션 과신","휴식 생략","과한 일정","몸 혹사"],
  career:   ["성급한 시작","충돌하기","발언 실수","확인 생략","무리한 일정","독단 진행","일 벌리기","보고 누락","감정 대응","일정 과다","과한 자신감","속도 과신","무리한 확장","판단 과속","준비 부족"],
  relations:["논쟁하기","비교하기","험담하기","오해 키우기","감정 대응","말 실수","반응 과열","거리 무시","과한 개입","무리한 약속","친근감 과신","말 앞서기","감정 개입","관계 과속","상대 부담 주기"],
  study:    ["무리한 학습","벼락치기","분량 욕심","복잡한 계획","집중 강요","수면 포기","기초 생략","과제 미루기","자료 과다","계획 과다","욕심 과다","속도 과속","복습 생략","이해 생략","정리 부족"],
  overall:  ["무리하기","과로하기","큰 결정","일정 과다","감정 소모","성급한 결정","휴식 생략","자기 압박","속도 욕심","과한 확신","일 벌리기","판단 과속","여유 부족","감정 과열","과한 추진"],
};

const TEN_GOD_TODOS: Record<string, { do: string; dont: string }> = {
  "傷官": { do: "창작 정리",    dont: "말 조심" },
  "偏財": { do: "기회 탐색",    dont: "지출 자제" },
  "正財": { do: "재정 점검",    dont: "충동 소비" },
  "食神": { do: "여유 갖기",    dont: "과식 주의" },
  "正官": { do: "원칙 지키기",  dont: "무리한 판단" },
  "偏官": { do: "속도 조절",    dont: "위험한 도전" },
  "正印": { do: "배움 정리",    dont: "성급한 결정" },
  "偏印": { do: "생각 정리",    dont: "과한 교류" },
  "比肩": { do: "혼자 집중",    dont: "경쟁 자제" },
  "劫財": { do: "지출 점검",    dont: "큰 거래" },
};

// 자연스러운 한국어로 factor 설명
const FACTOR_LABELS: Record<string, string> = {
  "傷官": "생각이 잘 풀리는",
  "偏財": "기회를 살피기 좋은",
  "正財": "재정을 점검하기 좋은",
  "食神": "여유를 두기 좋은",
  "正官": "차분히 책임을 챙기는",
  "偏官": "속도 조절이 필요한",
  "正印": "배움과 정리에 좋은",
  "偏印": "생각을 가다듬기 좋은",
  "比肩": "혼자 집중하기 좋은",
  "劫財": "지출을 살피기 좋은",
  "化祿": "흐름이 가벼운",
  "化權": "움직임이 또렷한",
  "化科": "생각이 정리되는",
  "化忌": "조금 신중한",
};

// 따뜻하고 자연스러운 말투의 요약 템플릿
const SUMMARY_TEMPLATES: Record<string, string[]> = {
  "대길": [
    "{factor} 날이에요. 오늘은 가볍게 움직여도 괜찮아요.",
    "{factor} 날이에요. 하고 싶던 일을 시도해보기 좋아요.",
    "{factor} 날이에요. 오늘 흐름을 잘 활용해봐도 좋아요.",
  ],
  "길": [
    "{factor} 날이에요. 계획한 일을 차분히 진행하기 괜찮아요.",
    "{factor} 날이에요. 무리하지 않으면 잘 맞을 수 있어요.",
    "{factor} 날이에요. 오늘은 안정적으로 움직이기 좋아요.",
  ],
  "보통": [
    "{factor} 날이에요. 평소 흐름대로 보내도 충분해요.",
    "{factor} 날이에요. 큰 무리 없이 차분히 가면 좋아요.",
    "{factor} 날이에요. 오늘은 가볍게 정리하며 보내보세요.",
  ],
  "주의": [
    "{factor} 날이에요. 오늘은 속도를 조금 낮춰도 괜찮아요.",
    "{factor} 날이에요. 큰 결정은 잠시 미뤄도 좋아요.",
    "{factor} 날이에요. 무리하지 않고 천천히 가는 게 맞아요.",
  ],
};

function sample<T>(arr: T[], n: number, rng: () => number): T[] {
  const copy = [...arr];
  const result: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(rng() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

export function generateTodos(scores: ScoreMap, sajuFactors: Record<string, unknown>, _badge: string, date?: Date): { do_list: string[]; dont_list: string[] } {
  const w = scores.wealth    ?? 65;
  const l = scores.love      ?? 65;
  const h = scores.health    ?? 65;
  const c = scores.career    ?? 65;
  const r = scores.relations ?? 65;
  const s = scores.study     ?? 65;
  const o = scores.overall   ?? 65;

  let doPool: string[] = [];
  let dontPool: string[] = [];

  doPool = doPool.concat(TODO_POOL[w >= 65 ? "wealth_high"    : "wealth_low"]);
  doPool = doPool.concat(TODO_POOL[l >= 65 ? "love_high"      : "love_low"]);
  doPool = doPool.concat(TODO_POOL[h >= 65 ? "health_high"    : "health_low"]);
  doPool = doPool.concat(TODO_POOL[c >= 65 ? "career_high"    : "career_low"]);
  doPool = doPool.concat(TODO_POOL[r >= 65 ? "relations_high" : "relations_low"]);
  doPool = doPool.concat(TODO_POOL[s >= 65 ? "study_high"     : "study_low"]);
  doPool = doPool.concat(TODO_POOL[o >= 65 ? "overall_high"   : "overall_low"]);

  if (w < 65) dontPool = dontPool.concat(DONT_POOL.wealth);
  if (l < 65) dontPool = dontPool.concat(DONT_POOL.love);
  if (h < 65) dontPool = dontPool.concat(DONT_POOL.health);
  if (c < 65) dontPool = dontPool.concat(DONT_POOL.career);
  if (r < 65) dontPool = dontPool.concat(DONT_POOL.relations);
  if (s < 65) dontPool = dontPool.concat(DONT_POOL.study);
  if (o < 65) dontPool = dontPool.concat(DONT_POOL.overall);
  if (dontPool.length === 0) {
    dontPool = ["무리하기","과로하기","성급한 결정","일정 과다","휴식 생략"];
  }

  // ten_god_of_day 우선 (날짜마다 달라짐)
  const tenGod = (sajuFactors.ten_god_of_day as string) || (sajuFactors.ten_god_of_month as string);
  if (tenGod && TEN_GOD_TODOS[tenGod]) {
    doPool.unshift(TEN_GOD_TODOS[tenGod].do);
    dontPool.unshift(TEN_GOD_TODOS[tenGod].dont);
  }

  doPool   = [...new Map(doPool.map(x => [x, x])).values()];
  dontPool = [...new Map(dontPool.map(x => [x, x])).values()];

  const dateNum = date
    ? date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()
    : 0;
  const seedVal = Math.abs(Object.values(scores).reduce((a, b) => a + b, 0) + dateNum) % 233280;
  const rng = seededRandom(seedVal);

  return {
    do_list:   sample(doPool, Math.min(3, doPool.length), rng),
    dont_list: sample(dontPool, Math.min(3, dontPool.length), rng),
  };
}

export function generateSummary(scores: ScoreMap, sajuFactors: Record<string, unknown>, _ziweiFactors: Record<string, unknown>): string {
  const overall = scores.overall ?? 65;
  const badge = overall >= 80 ? "대길" : overall >= 65 ? "길" : overall >= 52 ? "보통" : "주의";

  // ten_god_of_day 우선 참조 (날짜마다 달라짐)
  const tenGod = (sajuFactors.ten_god_of_day as string) || (sajuFactors.ten_god_of_month as string) || "";

  let factor = "";
  if (FACTOR_LABELS[tenGod]) {
    factor = FACTOR_LABELS[tenGod];
  } else if ((sajuFactors.active_stars as string[])?.length > 0) {
    factor = `특별한 기운이 감도는`;
  } else {
    factor = `오늘의 에너지가 흐르는`;
  }

  const templates = SUMMARY_TEMPLATES[badge] ?? SUMMARY_TEMPLATES["보통"];
  // overall 점수를 시드에 포함해 같은 factor+badge도 점수에 따라 다른 문장 선택
  const seedVal = Math.abs(Math.round(overall) + (tenGod + badge).split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % templates.length;
  return templates[seedVal].replace("{factor}", factor);
}
