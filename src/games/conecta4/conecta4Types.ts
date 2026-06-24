import { Question, Player } from "../../types";
import * as XLSX from "xlsx";

export interface Conecta4Config {
  questionnaireId: string;
  gameMode: "duel" | "teams" | "prof_vs_aula";
  specialPowersEnabled: boolean;
  timeLimit: number; // in seconds
  roundsCount: number; // e.g. best of 3
}

export interface Conecta4Move {
  turn: number;
  player: string;
  column: number;
  row: number;
  time: string; // hh:mm:ss format
}

export interface Conecta4QuestionLog {
  question: string;
  correctOptionText: string;
  winner: string; // "Rojo" | "Azul" | "Profesor" | "Aula" | "Nadie"
  precisionRed: number; // %
  precisionBlue: number; // %
}

export interface Conecta4SessionState {
  pin: string;
  config: Conecta4Config;
  board: (string | null)[][]; // 6 rows x 7 cols
  blockedColumns: Record<number, number>; // colIndex -> turns remaining
  powers: {
    red: { shield: number; double: number; swap: number };
    blue: { shield: number; double: number; swap: number };
  };
  whosTurn: "red" | "blue" | null;
  status: "lobby" | "question" | "reveal" | "drop" | "ended";
  currentQuestionIndex: number;
  timer: number;
  scores: { red: number; blue: number };
  answersReceived: Record<string, { optionIndex: number; timeTaken: number; isCorrect: boolean }>;
  players: Record<string, Player>;
  lastMove: { row: number; col: number; player: string } | null;
  winnerLine: [number, number][] | null;
  history: Conecta4Move[];
  questionsLog: Conecta4QuestionLog[];
  doubleTokenActive: boolean;
  gameWinner: "red" | "blue" | null;
}

export function exportConecta4ToExcel(session: Conecta4SessionState) {
  const totalMoves = session.history.length;
  const avgPrecisionRed = session.questionsLog.reduce((acc, q) => acc + q.precisionRed, 0) / (session.questionsLog.length || 1);
  const avgPrecisionBlue = session.questionsLog.reduce((acc, q) => acc + q.precisionBlue, 0) / (session.questionsLog.length || 1);

  const summaryData = [
    { Campo: "Módulo", Valor: "Conecta 4 Educativo 🔵🔴" },
    { Campo: "Fecha de Juego", Valor: new Date().toLocaleString() },
    { Campo: "Modo de Juego", Valor: session.config.gameMode === "duel" ? "Duelo Individual" : session.config.gameMode === "teams" ? "Equipos" : "Profesor vs Aula" },
    { Campo: "Ganador de la Partida", Valor: session.gameWinner === "red" ? (session.config.gameMode === "prof_vs_aula" ? "Profesor 🔴" : "Rojo 🔴") : session.gameWinner === "blue" ? (session.config.gameMode === "prof_vs_aula" ? "Aula 🔵" : "Azul 🔵") : "Empate" },
    { Campo: "Marcador (Azul - Rojo)", Valor: `${session.scores.blue} - ${session.scores.red}` },
    { Campo: "Total de Movimientos", Valor: totalMoves },
    { Campo: "Precisión Promedio Equipo Azul / Alumnos", Valor: `${Math.round(avgPrecisionBlue)}%` },
    { Campo: "Precisión Promedio Equipo Rojo / Profesor", Valor: `${Math.round(avgPrecisionRed)}%` }
  ];

  const questionsData = session.questionsLog.map((q, idx) => ({
    "Número": idx + 1,
    "Reactivo": q.question,
    "Respuesta Correcta": q.correctOptionText,
    "Ganador del Turno": q.winner,
    "Precisión Azul (%)": q.precisionBlue,
    "Precisión Rojo (%)": q.precisionRed
  }));

  const movesData = session.history.map((m) => ({
    "Turno": m.turn,
    "Jugador/Color": m.player,
    "Columna": m.column + 1,
    "Fila": 6 - m.row,
    "Hora": m.time
  }));

  const wb = XLSX.utils.book_new();

  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  const wsQuestions = XLSX.utils.json_to_sheet(questionsData);
  const wsMoves = XLSX.utils.json_to_sheet(movesData);

  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen");
  XLSX.utils.book_append_sheet(wb, wsQuestions, "Preguntas");
  XLSX.utils.book_append_sheet(wb, wsMoves, "Movimientos");

  XLSX.writeFile(wb, `Reporte_Conecta4_${session.pin}_${new Date().toISOString().split('T')[0]}.xlsx`);
}
