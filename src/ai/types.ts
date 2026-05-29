export interface AiDailyRequest {
  date: string;

  flowType: {
    key:   string;
    label: string;
  };

  topEvents: Array<{
    label:   string;
    effects: string[];
  }>;

  topStates: Array<{
    label:    string;
    strength: number; // 1~5
  }>;

  categoryHighlights: Array<{
    label: string;
    score: number;
  }>;

  timeFlow: Array<{
    label:          "오전" | "오후" | "저녁";
    score:          number;
    dominantStates: string[];
  }>;
}

export interface AiDailyResponse {
  title:    string;
  subtitle: string;
  summary:  string;
  timeFlow: {
    morning:   string;
    afternoon: string;
    evening:   string;
  };
  oneLine: string;
}
