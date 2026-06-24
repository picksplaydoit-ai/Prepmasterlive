export interface HeadbanzWord {
  id: string;
  concept: string;
  category: string;
  difficulty: "facil" | "medio" | "dificil";
  hint?: string;
}

export interface HeadbanzConfig {
  bankId: string;
  teamsEnabled: boolean;
  teamCount: number;
  timePerTurn: number; // in seconds
  roundsCount: number;
  pointsPerCorrect: number;
  showHints: boolean;
  gameMode: "classic" | "teams" | "duel" | "who_am_i";
}
