export interface Question {
  id: string;
  text: string;
  options: string[]; // Exactly 4 options
  correctOption: number; // 0-based index: 0, 1, 2, 3
  timeLimit: number; // in seconds (e.g., 20)
  topic?: string;
  points?: number;
  origin?: 'manual' | 'txt' | 'csv' | 'xlsx' | 'docx';
  createdAt?: string;
}

export interface Questionnaire {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  createdAt: string;
}

export interface Player {
  id: string; // Socket.id
  playerId?: string; // Persistent ID for automatic reconnection
  name: string;
  score: number;
  streak: number;
  answeredThisQuestion: boolean;
  lastAnswerIndex: number;
  lastAnswerTime: number; // ms taken to answer
  isLastCorrect: boolean;
  pointsEarned: number;
  avatarId?: string; // Identifier for their customized tropicalized avatar
}

export interface PlayerAnswerLog {
  playerId: string;
  playerName: string;
  questionIndex: number;
  optionIndex: number; // -1 if unanswered
  isCorrect: boolean;
  pointsEarned: number;
  reactionTime: number; // in ms
}

export interface PlayerAnswersCount {
  option0: number;
  option1: number;
  option2: number;
  option3: number;
}

export interface GameSession {
  pin: string; // Dynamic code to enter the room
  questionnaireId: string;
  title: string;
  status: 'lobby' | 'countdown' | 'question' | 'reveal' | 'leaderboard' | 'ended';
  questions: Question[];
  currentQuestionIndex: number;
  timer: number; // countdown
  players: Record<string, Player>;
  questionStartedAt: number; // timestamp in ms
  answersHistory?: PlayerAnswerLog[];
}

export interface GameResultRow {
  playerName: string;
  score: number;
  streak: number;
  answeredCount: number;
  correctAnswersCount: number;
}
