export interface HorseRaceConfig {
  bankId: string;
  totalQuestions: number;
  teamCount: number;
  distanceType: "short" | "medium" | "long"; // 20, 30, 40 slots
  advanceMode: "classic" | "accelerated" | "difficulty"; // +1, +2, or difficulty-based
  powerUpsEnabled: boolean;
  gameMode: "team_average" | "first_correct" | "all_vs_all"; // MODO A, B, C
  teams?: HorseRaceTeam[];
}

export interface HorseRaceTeam {
  id: string;
  name: string;
  color: string;
  icon: string;
  horsePosition: number; // current cell (0 to maxDistance)
  membersCount: number;
  shieldActive: boolean; // protective powerup shield
  sprintMultiplier: number; // multiplier for next advance (e.g. 2 for Sprint)
}

export interface HorseRacePlayer {
  id: string; // socket.id
  playerId: string; // persistent student player ID
  name: string;
  avatarId: string;
  teamId: string; // empty if all_vs_all or not selected
  score: number;
  horsePosition?: number; // used for all_vs_all mode
  shieldActive?: boolean;
  sprintMultiplier?: number;
}

export interface HorseRaceQuestion {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  difficulty: "facil" | "medio" | "dificil";
}

export interface HorseRaceTurnState {
  questionIndex: number;
  activeQuestion: {
    text: string;
    options: string[];
    difficulty: "facil" | "medio" | "dificil";
  } | null;
  timer: number;
  totalQuestions: number;
  answeredCount: number;
  showAnswers: boolean;
}

export interface HorseRaceHistory {
  id: string;
  date: string;
  config: HorseRaceConfig;
  teamScores: Record<string, number>;
  winnerName: string;
  winnerColor: string;
  wordsDetailed: any[];
}
