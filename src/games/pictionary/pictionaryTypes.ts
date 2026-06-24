export interface PictionaryWordBank {
  id: string;
  name: string;
  description: string;
  topic: string;
  createdAt: string;
  updatedAt: string;
  words: PictionaryWord[];
}

export interface PictionaryWord {
  id: string;
  bankId: string;
  word: string;
  category: string;
  difficulty: "Fácil" | "Media" | "Difícil";
  hint: string;
  createdAt: string;
}

export interface PictionaryTeam {
  id: string;
  name: string;
  color: string;
  icon: string;
  declaredMembers: number;
}

export interface PictionaryConfig {
  bankId: string;
  totalWords: number | "all";
  timeLimit: number;
  teams: PictionaryTeam[];
  revealHints: "none" | "auto" | "manual"; // none, auto: after 30s, manual
  pointsSystem: "simple" | "difficulty"; // simple (+1) or difficulty (+1, +2, +3)
}

export interface PictionaryRoundResult {
  word: string;
  category: string;
  difficulty: string;
  teamId: string;
  teamName: string;
  drawerName: string;
  outcome: "correct" | "skipped" | "timeout";
  timeUsed: number;
  hintUsed: boolean;
  pointsEarned: number;
}

export interface PictionaryHistory {
  id: string;
  date: string;
  bankName: string;
  config: PictionaryConfig;
  teamScores: Record<string, number>; // teamId -> score
  wordsDetailed: PictionaryRoundResult[];
}
