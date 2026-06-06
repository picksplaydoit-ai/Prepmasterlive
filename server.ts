import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import path from "path";
import fs from "fs";
import os from "os";
import QRCode from "qrcode";
import { createServer as createViteServer } from "vite";
import { Question, Questionnaire, Player, GameSession, PlayerAnswersCount, Team } from "./src/types";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import mammoth from "mammoth";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

import Database from "better-sqlite3";

const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "db.json");
const SQLITE_FILE = path.join(process.cwd(), "prepmaster.db");

// Initialize SQLite Database
const db = new Database(SQLITE_FILE);

db.exec(`
  CREATE TABLE IF NOT EXISTS questionnaires (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    questions TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS game_history (
    id TEXT PRIMARY KEY,
    questionnaire TEXT NOT NULL,
    date TEXT NOT NULL,
    players TEXT NOT NULL,
    answers TEXT NOT NULL,
    scores TEXT NOT NULL,
    topicSummary TEXT NOT NULL
  );
`);

// Auto-migrate from any existing db.json to ensure no data loss
function migrateFromJSON(): void {
  try {
    const checkCount = db.prepare("SELECT COUNT(*) as count FROM questionnaires").get() as { count: number };
    if (checkCount && checkCount.count === 0 && fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      const list: Questionnaire[] = JSON.parse(data);
      const insert = db.prepare(`
        INSERT INTO questionnaires (id, title, description, questions, createdAt)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const quiz of list) {
        insert.run(
          quiz.id,
          quiz.title,
          quiz.description || "",
          JSON.stringify(quiz.questions),
          quiz.createdAt
        );
      }
      console.log(`[SQLite] Migrados con éxito ${list.length} cuestionarios desde db.json`);
    }
  } catch (err) {
    console.error("[SQLite] Error en migración automática:", err);
  }
}
migrateFromJSON();

app.use(express.json());

// Load questionnaires from SQLite
function loadQuestionnaires(): Questionnaire[] {
  try {
    const rows = db.prepare("SELECT * FROM questionnaires ORDER BY createdAt DESC").all() as any[];
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description || "",
      questions: JSON.parse(r.questions),
      createdAt: r.createdAt
    }));
  } catch (error) {
    console.error("[SQLite] Error cargando cuestionarios:", error);
    return [];
  }
}

// Save questionnaire to SQLite
function saveOneQuestionnaire(quiz: Questionnaire): void {
  try {
    const insertOrReplace = db.prepare(`
      INSERT OR REPLACE INTO questionnaires (id, title, description, questions, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertOrReplace.run(
      quiz.id,
      quiz.title,
      quiz.description || "",
      JSON.stringify(quiz.questions),
      quiz.createdAt
    );
    console.log(`[SQLite] Guardado cuestionario ID ${quiz.id}`);
  } catch (error) {
    console.error("[SQLite] Error guardando cuestionario:", error);
  }
}

// Delete questionnaire from SQLite
function deleteQuestionnaireFromDb(id: string): void {
  try {
    db.prepare("DELETE FROM questionnaires WHERE id = ?").run(id);
    console.log(`[SQLite] Eliminado cuestionario ID ${id}`);
  } catch (error) {
    console.error("[SQLite] Error eliminando cuestionario:", error);
  }
}

function getTeamRankingsAndStats(session: GameSession) {
  if (session.gameMode !== "teams" || !session.teams || session.teams.length === 0) {
    return null;
  }

  // Initialize team summaries
  const teamMap: Record<string, {
    id: string;
    name: string;
    color: string;
    icon: string;
    score: number;
    playerCount: number;
    totalAnswers: number;
    correctAnswers: number;
    totalReactionTime: number;
    reactionTimeCount: number;
  }> = {};

  session.teams.forEach(t => {
    teamMap[t.id] = {
      id: t.id,
      name: t.name,
      color: t.color,
      icon: t.icon,
      score: 0,
      playerCount: 0,
      totalAnswers: 0,
      correctAnswers: 0,
      totalReactionTime: 0,
      reactionTimeCount: 0
    };
  });

  // Compile individual player scores into teams
  const players = Object.values(session.players);
  players.forEach(p => {
    if (p.teamId && teamMap[p.teamId]) {
      teamMap[p.teamId].score += p.score;
      teamMap[p.teamId].playerCount++;
    }
  });

  // Compile answer history for stats
  const logs = session.answersHistory || [];
  logs.forEach(log => {
    // Find player to get their team
    const player = players.find(pl => (pl.playerId || pl.id) === log.playerId) || Object.values(session.players).find(pl => pl.id === log.playerId);
    if (player && player.teamId && teamMap[player.teamId]) {
      const t = teamMap[player.teamId];
      t.totalAnswers++;
      if (log.isCorrect) {
        t.correctAnswers++;
      }
      if (log.reactionTime > 0) {
        t.totalReactionTime += log.reactionTime;
        t.reactionTimeCount++;
      }
    }
  });

  const teamList = Object.values(teamMap);

  // Compute stats
  let maxPointsTeam = teamList[0] || null;
  let fastestTeam = teamList[0] || null;
  let bestAccuracyTeam = teamList[0] || null;

  let minAvgTime = Infinity;
  let maxAccuracy = -1;

  teamList.forEach(t => {
    // 1. Max points
    if (!maxPointsTeam || t.score > maxPointsTeam.score) {
      maxPointsTeam = t;
    }

    // 2. Fastest (min average response time)
    const avgTime = t.reactionTimeCount > 0 ? (t.totalReactionTime / t.reactionTimeCount) : Infinity;
    if (avgTime < minAvgTime) {
      minAvgTime = avgTime;
      fastestTeam = t;
    }

    // 3. Best accuracy
    const accuracy = t.totalAnswers > 0 ? (t.correctAnswers / t.totalAnswers) : 0;
    if (accuracy > maxAccuracy) {
      maxAccuracy = accuracy;
      bestAccuracyTeam = t;
    }
  });

  // Sort teams by score descending for ranking
  const sortedTeams = [...teamList].sort((a, b) => b.score - a.score);

  return {
    rankings: sortedTeams,
    stats: {
      maxPointsTeam: maxPointsTeam ? { id: maxPointsTeam.id, name: maxPointsTeam.name, icon: maxPointsTeam.icon, color: maxPointsTeam.color, score: maxPointsTeam.score } : null,
      fastestTeam: fastestTeam && minAvgTime !== Infinity ? { id: fastestTeam.id, name: fastestTeam.name, icon: fastestTeam.icon, color: fastestTeam.color, avgTimeMs: minAvgTime } : (teamList[0] ? { id: teamList[0].id, name: teamList[0].name, icon: teamList[0].icon, color: teamList[0].color } : null),
      bestAccuracyTeam: bestAccuracyTeam && bestAccuracyTeam.totalAnswers > 0 ? { id: bestAccuracyTeam.id, name: bestAccuracyTeam.name, icon: bestAccuracyTeam.icon, color: bestAccuracyTeam.color, accuracy: maxAccuracy * 100 } : (teamList[0] ? { id: teamList[0].id, name: teamList[0].name, icon: teamList[0].icon, color: teamList[0].color } : null)
    }
  };
}

// Save active game history to SQLite
function saveGameSessionHistory(session: GameSession): void {
  try {
    const pin = session.pin;
    const qid = session.questionnaireId;
    const logs = session.answersHistory || [];
    
    // Compute topic summary
    const topicSummary: Record<string, {
      topic: string;
      totalQuestions: number;
      correctAnswersCount: number;
      incorrectAnswersCount: number;
      unansweredCount: number;
      answersList: { questionText: string; correctRate: number }[];
    }> = {};

    // First collect all questions
    session.questions.forEach((q, qidx) => {
      const topic = q.topic ? q.topic.trim() : "General";
      if (!topicSummary[topic]) {
        topicSummary[topic] = {
          topic,
          totalQuestions: 0,
          correctAnswersCount: 0,
          incorrectAnswersCount: 0,
          unansweredCount: 0,
          answersList: []
        };
      }
      topicSummary[topic].totalQuestions++;
    });

    logs.forEach((log) => {
      const q = session.questions[log.questionIndex];
      if (!q) return;
      const topic = q.topic ? q.topic.trim() : "General";
      const sum = topicSummary[topic];
      if (sum) {
        if (log.optionIndex === -1) {
          sum.unansweredCount++;
        } else if (log.isCorrect) {
          sum.correctAnswersCount++;
        } else {
          sum.incorrectAnswersCount++;
        }
      }
    });

    // Determine correct rate per question
    session.questions.forEach((q, qidx) => {
      const topic = q.topic ? q.topic.trim() : "General";
      const sum = topicSummary[topic];
      if (sum) {
        const questionLogs = logs.filter(l => l.questionIndex === qidx);
        const correctCount = questionLogs.filter(l => l.isCorrect).length;
        const totalCount = questionLogs.length;
        const correctRate = totalCount > 0 ? (correctCount / totalCount) : 0;
        sum.answersList.push({
          questionText: q.text,
          correctRate
        });
      }
    });

    const finalTopicSummary = Object.values(topicSummary).map((sum) => {
      // Find hardest question of this topic: lowest correctRate
      let hardestQuestion = "Ninguna";
      let minRate = 1.1;
      sum.answersList.forEach((al) => {
        if (al.correctRate < minRate) {
          minRate = al.correctRate;
          hardestQuestion = al.questionText;
        }
      });
      
      const totalAnswers = sum.correctAnswersCount + sum.incorrectAnswersCount + sum.unansweredCount;
      const accuracyPercentage = totalAnswers > 0 ? Math.round((sum.correctAnswersCount / totalAnswers) * 100) : 0;

      return {
        topic: sum.topic,
        totalQuestions: sum.totalQuestions,
        correctAnswersCount: sum.correctAnswersCount,
        incorrectAnswersCount: sum.incorrectAnswersCount,
        unansweredCount: sum.unansweredCount,
        accuracyPercentage,
        hardestQuestion
      };
    });

    const questionnaireJSON = JSON.stringify({
      id: qid,
      title: session.title,
      questions: session.questions,
      gameMode: session.gameMode || "individual",
      teams: session.teams || []
    });

    const playersJSON = JSON.stringify(Object.values(session.players));
    const answersJSON = JSON.stringify(logs);
    
    const sortedPlayers = Object.values(session.players).sort((a, b) => b.score - a.score);
    const scoresJSON = JSON.stringify(sortedPlayers);

    const insertHistory = db.prepare(`
      INSERT OR REPLACE INTO game_history (id, questionnaire, date, players, answers, scores, topicSummary)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertHistory.run(
      `game_${pin}_${Date.now()}`,
      questionnaireJSON,
      new Date().toISOString(),
      playersJSON,
      answersJSON,
      scoresJSON,
      JSON.stringify(finalTopicSummary)
    );

    console.log(`[SQLite] Historial guardado para partida PIN ${pin}`);
  } catch (err) {
    console.error("[SQLite] Error guardando historial de partida:", err);
  }
}

// Get candidate local IPs
function getLocalIPs(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  for (const name of Object.keys(interfaces)) {
    const netList = interfaces[name];
    if (netList) {
      for (const net of netList) {
        // Skip internal/loopback and non-IPv4 addresses
        if (net.family === "IPv4" && !net.internal) {
          addresses.push(net.address);
        }
      }
    }
  }
  // Fallback to localhost if no interfaces found
  if (addresses.length === 0) {
    addresses.push("localhost");
  }
  return addresses;
}

// Active game sessions managed in memory
const activeSessions: Record<string, GameSession> = {};

// Active timer intervals mapping: RoomPin -> NodeJS.Timeout
const timerIntervals: Record<string, NodeJS.Timeout> = {};

// Helper: Calculate standard Prepmaster Live points: up to 1000 points based on velocity, 0 if incorrect.
// Formula: Math.round(1000 * (1 - ((t / T) / 2))) donde t es tiempo de respuesta, T es tiempo limite
function calculatePoints(timeTakenMs: number, limitSeconds: number): number {
  const limitMs = limitSeconds * 1000;
  const ratio = Math.min(Math.max(timeTakenMs / limitMs, 0), 1);
  return Math.round(1000 * (1 - ratio / 2));
}

// Helper: generate game room statistics
function getOptionDistribution(session: GameSession): PlayerAnswersCount {
  const stats = { option0: 0, option1: 0, option2: 0, option3: 0 };
  const currentQ = session.questions[session.currentQuestionIndex];
  if (!currentQ) return stats;

  Object.values(session.players).forEach((p) => {
    if (p.answeredThisQuestion) {
      if (p.lastAnswerIndex === 0) stats.option0++;
      if (p.lastAnswerIndex === 1) stats.option1++;
      if (p.lastAnswerIndex === 2) stats.option2++;
      if (p.lastAnswerIndex === 3) stats.option3++;
    }
  });

  return stats;
}

// REST APIs
app.get("/api/ip", async (req, res) => {
  const ips = getLocalIPs();
  const preferredIP = ips[0];
  const webPort = PORT;
  
  // Combine platform configuration if available
  const appUrl = process.env.APP_URL || `http://${preferredIP}:${webPort}`;
  const localUrl = `http://${preferredIP}:${webPort}`;
  
  try {
    const qrCodeLocal = await QRCode.toDataURL(localUrl);
    const qrCodeApp = process.env.APP_URL ? await QRCode.toDataURL(process.env.APP_URL) : qrCodeLocal;
    
    res.json({
      ips,
      preferredIP,
      localUrl,
      appUrl,
      qrLocal: qrCodeLocal,
      qrApp: qrCodeApp,
    });
  } catch (err) {
    res.status(500).json({ error: "No se pudo generar el código QR" });
  }
});

// List Questionnaires
app.get("/api/questionnaires", (req, res) => {
  const questionnaires = loadQuestionnaires();
  // Return summarized info (no full question arrays needed for initial listing, but we send it)
  res.json(questionnaires);
});

// Create/Update Questionnaire
app.post("/api/questionnaires", (req, res) => {
  const quiz: Questionnaire = req.body;
  if (!quiz.title || !Array.isArray(quiz.questions)) {
    return res.status(400).json({ error: "Datos del cuestionario inválidos" });
  }

  // Set ID and timestamps if not present
  if (!quiz.id) {
    quiz.id = "q_" + Date.now();
  }
  quiz.createdAt = quiz.createdAt || new Date().toISOString();

  saveOneQuestionnaire(quiz);
  res.json({ success: true, questionnaire: quiz });
});

// Delete Questionnaire
app.delete("/api/questionnaires/:id", (req, res) => {
  const { id } = req.params;
  deleteQuestionnaireFromDb(id);
  res.json({ success: true });
});

// Export game session achievements as CSV
app.get("/api/export/:pin", (req, res) => {
  const { pin } = req.params;
  const session = activeSessions[pin];
  if (!session) {
    return res.status(404).send("Partida no encontrada");
  }

  const sortedPlayers = Object.values(session.players).sort((a, b) => b.score - a.score);
  
  let csv = "Rango,Nombre,Avatar,Equipo,Puntuacion,Racha Maxima\n";
  sortedPlayers.forEach((p, idx) => {
    const avatarName = p.avatarId || "cult_mariachi";
    const teamName = p.teamId && session.teams
      ? (session.teams.find(t => t.id === p.teamId)?.name || "")
      : "Individual";
    csv += `${idx + 1},"${p.name.replace(/"/g, '""')}","${avatarName}","${teamName.replace(/"/g, '""')}",${p.score},${p.streak}\n`;
  });

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=resultados_partida_${pin}.csv`);
  res.send(csv);
});

// Endpoint to fetch finalized/live game session results with detailed histories
app.get("/api/session-results/:pin", (req, res) => {
  const { pin } = req.params;
  const session = activeSessions[pin];
  
  if (session) {
    res.json({
      title: session.title,
      questions: session.questions,
      players: Object.values(session.players),
      answersHistory: session.answersHistory || [],
      gameMode: session.gameMode || "individual",
      teams: session.teams || []
    });
    return;
  }

  // Fallback to SQLite DB
  try {
    const row = db.prepare("SELECT * FROM game_history WHERE id LIKE ? ORDER BY date DESC LIMIT 1").get(`game_${pin}_%`) as any;
    if (row) {
      const q = JSON.parse(row.questionnaire);
      res.json({
        title: q.title,
        questions: q.questions,
        players: JSON.parse(row.players),
        answersHistory: JSON.parse(row.answers),
        date: row.date,
        topicSummary: JSON.parse(row.topicSummary),
        gameMode: q.gameMode || "individual",
        teams: q.teams || []
      });
      return;
    }
  } catch (err) {
    console.error("[SQLite] Error recuperando historial:", err);
  }

  res.status(404).json({ error: "La partida con PIN " + pin + " no fue encontrada o no guardó registros" });
});

// Endpoint: Parse mass-imported questions from files (TXT, CSV, XLSX, DOCX)
app.post("/api/parse-file", async (req, res) => {
  try {
    const { fileName, base64Data } = req.body;
    if (!fileName || !base64Data) {
      return res.status(400).json({ success: false, error: "Faltan parámetros: se requiere fileName y base64Data." });
    }

    const buffer = Buffer.from(base64Data, "base64");
    const ext = fileName.split(".").pop()?.toLowerCase();

    let textContent = "";
    let questionsList: any[] = [];

    const sanitize = (val: any): string => {
      if (val === undefined || val === null) return "";
      return String(val).replace(/<[^>]*>/g, "").trim();
    };

    if (ext === "txt") {
      textContent = buffer.toString("utf-8");
      questionsList = parseTextAndDocxQuestions(textContent, sanitize);
    } else if (ext === "docx") {
      const result = await mammoth.extractRawText({ buffer });
      textContent = result.value;
      questionsList = parseTextAndDocxQuestions(textContent, sanitize);
    } else if (ext === "csv") {
      const csvText = buffer.toString("utf-8");
      const parseResult = Papa.parse(csvText, { skipEmptyLines: true });
      questionsList = parseSpreadsheetRows(parseResult.data as any[][], sanitize);
    } else if (ext === "xlsx" || ext === "xls") {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      questionsList = parseSpreadsheetRows(rows, sanitize);
    } else {
      return res.status(400).json({ success: false, error: "Formato de archivo no soportado. Debe ser TXT, CSV, XLSX o DOCX." });
    }

    return res.json({ success: true, questions: questionsList });
  } catch (err: any) {
    console.error("Error interpretando archivo:", err);
    return res.status(500).json({ success: false, error: err.message || "Error interno al interpretar el archivo." });
  }
});

// Helper for parsing word formats & text files
function parseTextAndDocxQuestions(text: string, sanitize: (val: any) => string): any[] {
  const normalized = text.replace(/\r\n/g, "\n");
  const blocks = normalized.split(/\n\s*\n+/);
  const result: any[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const lines = trimmed.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    let questionText = "";
    const options: string[] = [];
    let correctOptionRaw = "";
    let timeLimit: number | undefined;
    let points: number | undefined;
    let topic: string | undefined;

    let readingQuestionText = false;

    for (const line of lines) {
      if (line.toLowerCase() === "pregunta:") {
        readingQuestionText = true;
        continue;
      }

      // Option format match: e.g. A) B. C)
      const optionMatch = line.match(/^\s*([A-Da-d])[\s).:\]-]+(.*)$/);
      if (optionMatch) {
        readingQuestionText = false;
        const letter = optionMatch[1].toUpperCase();
        const optionVal = sanitize(optionMatch[2]);
        const index = letter.charCodeAt(0) - 65;
        options[index] = optionVal;
        continue;
      }

      // Solution match: e.g. Respuesta: C
      const answerMatch = line.match(/^(?:Respuesta|Correcta|Ans|Answer)[\s.:-]+(.*)$/i);
      if (answerMatch) {
        readingQuestionText = false;
        correctOptionRaw = sanitize(answerMatch[1]);
        continue;
      }

      // Time match: e.g. Tiempo: 30
      const timerMatch = line.match(/^(?:Tiempo|Time)[\s.:-]+(\d+)/i);
      if (timerMatch) {
        readingQuestionText = false;
        timeLimit = parseInt(timerMatch[1], 10);
        continue;
      }

      // Points match: e.g. Puntos: 1000
      const pointsMatch = line.match(/^(?:Puntos|Points)[\s.:-]+(\d+)/i);
      if (pointsMatch) {
        readingQuestionText = false;
        points = parseInt(pointsMatch[1], 10);
        continue;
      }

      // Topic/Tema match: e.g. Tema: Geografía
      const topicMatch = line.match(/^(?:Tema|Topic|Category|Materia)[\s.:-]+(.*)$/i);
      if (topicMatch) {
        readingQuestionText = false;
        topic = sanitize(topicMatch[1]);
        continue;
      }

      if (readingQuestionText) {
        questionText = questionText ? questionText + " " + sanitize(line) : sanitize(line);
      } else if (!questionText && options.length === 0) {
        questionText = sanitize(line);
      }
    }

    const actualOptions = options.filter(o => o !== undefined && o !== null);
    const errors: string[] = [];

    if (!questionText.trim()) {
      errors.push("No se detectó el enunciado de la pregunta.");
    }
    if (actualOptions.length < 2) {
      errors.push("La pregunta debe tener al menos 2 opciones.");
    }

    let correctOptionIndex = -1;
    if (correctOptionRaw) {
      if (/^[A-D]$/i.test(correctOptionRaw)) {
        correctOptionIndex = correctOptionRaw.toUpperCase().charCodeAt(0) - 65;
      } else {
        const matchIdx = options.findIndex(o => o && o.toLowerCase() === correctOptionRaw.toLowerCase());
        if (matchIdx !== -1) {
          correctOptionIndex = matchIdx;
        } else {
          const parsedInt = parseInt(correctOptionRaw, 10);
          if (!isNaN(parsedInt) && parsedInt >= 1 && parsedInt <= 4) {
            correctOptionIndex = parsedInt - 1;
          }
        }
      }
    }

    if (correctOptionIndex === -1 || correctOptionIndex >= 4 || options[correctOptionIndex] === undefined) {
      errors.push(`La respuesta correcta indicada (“${correctOptionRaw || 'ninguna'}”) no coincide con ninguna opción válida (A, B, C o D).`);
    }

    const finalOptions = ["", "", "", ""];
    for (let i = 0; i < 4; i++) {
      if (options[i] !== undefined) {
        finalOptions[i] = options[i];
      }
    }

    result.push({
      text: questionText,
      options: finalOptions,
      correctOption: correctOptionIndex,
      timeLimit: timeLimit ?? 30,
      points: points ?? 1000,
      topic: topic ?? "General",
      isValid: errors.length === 0,
      error: errors.length > 0 ? errors.join(" ") : undefined
    });
  }

  return result;
}

// Helper for parsing Excel sheets & CSV grid arrays
function parseSpreadsheetRows(rows: any[][], sanitize: (val: any) => string): any[] {
  if (!rows || rows.length === 0) return [];

  const result: any[] = [];
  const stringifiedRows = rows.map(r => 
    Array.isArray(r) ? r.map(c => c !== undefined && c !== null ? String(c).trim() : "") : []
  ).filter(r => r.length > 0);

  if (stringifiedRows.length === 0) return [];

  const firstRow = stringifiedRows[0];
  let isHeader = false;
  
  let colPregunta = -1;
  let colOpcionA = -1;
  let colOpcionB = -1;
  let colOpcionC = -1;
  let colOpcionD = -1;
  let colRespuesta = -1;
  let colTiempo = -1;
  let colPuntos = -1;
  let colTema = -1;

  firstRow.forEach((cell, idx) => {
    const c = cell.toLowerCase();
    if (c.includes("pregunta") || c.includes("question") || c === "enunciado" || c === "texto") {
      colPregunta = idx;
      isHeader = true;
    } else if (c.includes("opcion_a") || c === "opcion a" || c === "option a" || c === "a" || c.includes("opción a")) {
      colOpcionA = idx;
      isHeader = true;
    } else if (c.includes("opcion_b") || c === "opcion b" || c === "option b" || c === "b" || c.includes("opción b")) {
      colOpcionB = idx;
      isHeader = true;
    } else if (c.includes("opcion_c") || c === "opcion c" || c === "option c" || c === "c" || c.includes("opción c")) {
      colOpcionC = idx;
      isHeader = true;
    } else if (c.includes("opcion_d") || c === "opcion d" || c === "option d" || c === "d" || c.includes("opción d")) {
      colOpcionD = idx;
      isHeader = true;
    } else if (c.includes("respuesta") || c.includes("correct") || c.includes("answer") || c === "solucion" || c === "ans") {
      colRespuesta = idx;
      isHeader = true;
    } else if (c.includes("tiempo") || c.includes("time") || c === "segundos") {
      colTiempo = idx;
      isHeader = true;
    } else if (c.includes("puntos") || c.includes("points") || c === "score") {
      colPuntos = idx;
      isHeader = true;
    } else if (c.includes("tema") || c.includes("topic") || c.includes("category") || c === "materia") {
      colTema = idx;
      isHeader = true;
    }
  });

  // Use positional columns if keyword headers are absent
  if (!isHeader || colPregunta === -1 || colOpcionA === -1 || colOpcionB === -1) {
    colPregunta = 0;
    colOpcionA = 1;
    colOpcionB = 2;
    colOpcionC = 3;
    colOpcionD = 4;
    colRespuesta = 5;
    colTiempo = 6;
    colPuntos = 7;
    colTema = 8;
  }

  const startIndex = isHeader ? 1 : 0;

  for (let i = startIndex; i < stringifiedRows.length; i++) {
    const row = stringifiedRows[i];
    if (row.length === 0 || !row[colPregunta]) continue;

    const questionText = sanitize(row[colPregunta]);
    
    const rawOptions = [
      colOpcionA < row.length ? sanitize(row[colOpcionA]) : "",
      colOpcionB < row.length ? sanitize(row[colOpcionB]) : "",
      colOpcionC < row.length ? sanitize(row[colOpcionC]) : "",
      colOpcionD < row.length ? sanitize(row[colOpcionD]) : ""
    ];

    const actualOptions = rawOptions.filter(Boolean);
    const rawAns = colRespuesta < row.length ? sanitize(row[colRespuesta]).trim() : "";
    const rawTime = colTiempo !== -1 && colTiempo < row.length && row[colTiempo] ? parseInt(row[colTiempo], 10) : undefined;
    const rawPoints = colPuntos !== -1 && colPuntos < row.length && row[colPuntos] ? parseInt(row[colPuntos], 10) : undefined;
    const rawTopic = colTema !== -1 && colTema < row.length && row[colTema] ? sanitize(row[colTema]) : "General";

    const errors: string[] = [];

    if (!questionText) {
      errors.push("No se detectó el enunciado de la pregunta.");
    }
    if (actualOptions.length < 2) {
      errors.push("La pregunta debe tener al menos 2 opciones de respuesta.");
    }

    let correctOptionIndex = -1;
    if (rawAns) {
      if (/^[A-D]$/i.test(rawAns)) {
        correctOptionIndex = rawAns.toUpperCase().charCodeAt(0) - 65;
      } else {
        const idx = rawOptions.findIndex(o => o && o.toLowerCase() === rawAns.toLowerCase());
        if (idx !== -1) {
          correctOptionIndex = idx;
        } else {
          const parsedInt = parseInt(rawAns, 10);
          if (!isNaN(parsedInt) && parsedInt >= 1 && parsedInt <= 4) {
            correctOptionIndex = parsedInt - 1;
          }
        }
      }
    }

    if (correctOptionIndex === -1 || correctOptionIndex >= 4 || !rawOptions[correctOptionIndex]) {
      errors.push(`La respuesta correcta indicada (“${rawAns || 'ninguna'}”) no coincide con ninguna opción válida (A, B, C o D).`);
    }

    result.push({
      text: questionText,
      options: rawOptions,
      correctOption: correctOptionIndex,
      timeLimit: isNaN(rawTime || NaN) ? 30 : rawTime!,
      points: isNaN(rawPoints || NaN) ? 1000 : rawPoints!,
      topic: rawTopic || "General",
      isValid: errors.length === 0,
      error: errors.length > 0 ? errors.join(" ") : undefined
    });
  }

  return result;
}

// Real-time server timers control
function clearRoomInterval(pin: string): void {
  if (timerIntervals[pin]) {
    clearInterval(timerIntervals[pin]);
    delete timerIntervals[pin];
  }
}

// Websocket Events
io.on("connection", (socket: Socket) => {
  // Host initializes a session
  socket.on("host:create-session", ({ questionnaireId, gameMode, teams }: { questionnaireId: string; gameMode?: 'individual' | 'teams'; teams?: Team[] }) => {
    const list = loadQuestionnaires();
    const quiz = list.find((q) => q.id === questionnaireId);
    if (!quiz) {
      socket.emit("host:error", { message: "Cuestionario no encontrado" });
      return;
    }

    // Generate a secure 4 digit PIN
    let pin = "";
    do {
      pin = Math.floor(1000 + Math.random() * 9000).toString();
    } while (activeSessions[pin]);

    const session: GameSession = {
      pin,
      questionnaireId,
      title: quiz.title,
      status: "lobby",
      questions: quiz.questions,
      currentQuestionIndex: -1,
      timer: 0,
      players: {},
      questionStartedAt: 0,
      gameMode: gameMode || "individual",
      teams: teams || []
    };

    activeSessions[pin] = session;
    socket.join(`game:${pin}`);
    socket.join(`host:${pin}`);

    socket.emit("session:created", {
      pin,
      title: quiz.title,
      questionsCount: quiz.questions.length,
      players: [],
      gameMode: session.gameMode,
      teams: session.teams
    });
  });

  // Host starts the game: transitions to countdown
  socket.on("host:start-game", ({ pin }: { pin: string }) => {
    const session = activeSessions[pin];
    if (!session) return;

    clearRoomInterval(pin);
    session.status = "countdown";
    session.currentQuestionIndex = 0;
    session.timer = 5; // countdown of 5s before first question

    io.to(`game:${pin}`).emit("game:status-update", {
      status: "countdown",
      currentQuestionIndex: 0,
      timer: 5,
    });

    timerIntervals[pin] = setInterval(() => {
      session.timer--;
      if (session.timer <= 0) {
        clearRoomInterval(pin);
        triggerQuestionActive(pin);
      } else {
        io.to(`game:${pin}`).emit("countdown:tick", { timer: session.timer });
      }
    }, 1000);
  });

  // Helper inside timers to initiate a question
  function triggerQuestionActive(pin: string): void {
    const session = activeSessions[pin];
    if (!session) return;

    clearRoomInterval(pin);
    session.status = "question";
    
    // Reset players answered state for this question
    Object.values(session.players).forEach((p) => {
      p.answeredThisQuestion = false;
      p.lastAnswerIndex = -1;
      p.pointsEarned = 0;
    });

    const question = session.questions[session.currentQuestionIndex];
    if (!question) return;

    session.timer = question.timeLimit;
    session.questionStartedAt = Date.now();

    // Broadcast active question to students but WITHOUT indicating the correct option
    io.to(`game:${pin}`).emit("question:active", {
      status: "question",
      currentIndex: session.currentQuestionIndex,
      totalQuestions: session.questions.length,
      text: question.text,
      options: question.options,
      timeLimit: question.timeLimit,
      timer: question.timeLimit,
      totalPlayersCount: Object.keys(session.players).length,
      answeredCount: 0,
    });

    timerIntervals[pin] = setInterval(() => {
      session.timer--;
      
      // Update timer countdown for both host and players
      io.to(`game:${pin}`).emit("question:tick", {
        timer: session.timer,
        answeredCount: Object.values(session.players).filter(p => p.answeredThisQuestion).length
      });

      if (session.timer <= 0) {
        clearRoomInterval(pin);
        revealAnswerAndResults(pin);
      }
    }, 1000);
  }

  // Socket action to skip/reveal answer early
  socket.on("host:skip-question", ({ pin }: { pin: string }) => {
    const session = activeSessions[pin];
    if (!session) return;
    clearRoomInterval(pin);
    revealAnswerAndResults(pin);
  });

  // Reveal results and statistics
  function revealAnswerAndResults(pin: string): void {
    const session = activeSessions[pin];
    if (!session) return;

    session.status = "reveal";
    const question = session.questions[session.currentQuestionIndex];
    if (!question) return;

    if (!session.answersHistory) {
      session.answersHistory = [];
    }
    Object.values(session.players).forEach((player) => {
      const alreadyLogged = session.answersHistory?.some(
        l => l.questionIndex === session.currentQuestionIndex && l.playerId === (player.playerId || player.id)
      );
      if (!alreadyLogged) {
        session.answersHistory?.push({
          playerId: player.playerId || player.id,
          playerName: player.name,
          questionIndex: session.currentQuestionIndex,
          optionIndex: -1,
          isCorrect: false,
          pointsEarned: 0,
          reactionTime: 0
        });
      }
    });

    // Build statistics
    const stats = getOptionDistribution(session);

    // Notify host with stats and correct answer
    io.to(`host:${pin}`).emit("question:revealed", {
      status: "reveal",
      correctOption: question.correctOption,
      stats,
      players: Object.values(session.players)
    });

    // Notify each player specifically with personalized results
    Object.values(session.players).forEach((player) => {
      io.to(player.id).emit("player:question-result", {
        isCorrect: player.isLastCorrect && player.answeredThisQuestion,
        correctOption: question.correctOption,
        pointsEarned: player.pointsEarned,
        totalScore: player.score,
        streak: player.streak,
        answeredThisQuestion: player.answeredThisQuestion
      });
    });
  }

  // Host triggers leaderboard view
  socket.on("host:show-leaderboard", ({ pin }: { pin: string }) => {
    const session = activeSessions[pin];
    if (!session) return;

    session.status = "leaderboard";
    const sortedPlayers = Object.values(session.players)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // top 5

    const teamData = getTeamRankingsAndStats(session);

    io.to(`game:${pin}`).emit("game:status-update", {
      status: "leaderboard",
      leaderboard: sortedPlayers,
      teamRankings: teamData ? teamData.rankings : undefined,
      teamStats: teamData ? teamData.stats : undefined,
      gameMode: session.gameMode,
      teams: session.teams
    });
  });

  // Host requests to transition to next question (or end game)
  socket.on("host:next-question", ({ pin }: { pin: string }) => {
    const session = activeSessions[pin];
    if (!session) return;

    if (session.currentQuestionIndex + 1 < session.questions.length) {
      session.currentQuestionIndex++;
      session.status = "countdown";
      session.timer = 5;

      io.to(`game:${pin}`).emit("game:status-update", {
        status: "countdown",
        currentQuestionIndex: session.currentQuestionIndex,
        timer: 5,
      });

      timerIntervals[pin] = setInterval(() => {
        session.timer--;
        if (session.timer <= 0) {
          clearRoomInterval(pin);
          triggerQuestionActive(pin);
        } else {
          io.to(`game:${pin}`).emit("countdown:tick", { timer: session.timer });
        }
      }, 1000);
    } else {
      // No more questions! End game!
      session.status = "ended";
      saveGameSessionHistory(session);
      const sortedPlayers = Object.values(session.players).sort((a, b) => b.score - a.score);
      const teamData = getTeamRankingsAndStats(session);
      
      io.to(`game:${pin}`).emit("game:status-update", {
        status: "ended",
        podium: sortedPlayers,
        teamRankings: teamData ? teamData.rankings : undefined,
        teamStats: teamData ? teamData.stats : undefined,
        gameMode: session.gameMode,
        teams: session.teams
      });
    }
  });

  // Host restarts or ends the lobby completely
  socket.on("host:end-game", ({ pin }: { pin: string }) => {
    const session = activeSessions[pin];
    if (!session) return;
    clearRoomInterval(pin);
    session.status = "ended";
    saveGameSessionHistory(session);
    const sortedPlayers = Object.values(session.players).sort((a, b) => b.score - a.score);
    const teamData = getTeamRankingsAndStats(session);

    io.to(`game:${pin}`).emit("game:status-update", {
      status: "ended",
      podium: sortedPlayers,
      teamRankings: teamData ? teamData.rankings : undefined,
      teamStats: teamData ? teamData.stats : undefined,
      gameMode: session.gameMode,
      teams: session.teams
    });
  });

  // STUDENT CLIENT JOIN ROOM
  socket.on("player:join", ({ pin, name, playerId, avatarId, teamId }: { pin: string; name: string; playerId?: string; avatarId?: string; teamId?: string }) => {
    const session = activeSessions[pin];
    if (!session) {
      socket.emit("player:join-error", { message: "La partida con este PIN no existe o se ha cerrado." });
      return;
    }

    // Try finding if this is a reconnecting player
    let existingPlayerKey = "";
    let existingPlayer: Player | null = null;

    if (playerId) {
      const foundKey = Object.keys(session.players).find(k => session.players[k].playerId === playerId);
      if (foundKey) {
        existingPlayerKey = foundKey;
        existingPlayer = session.players[foundKey];
      }
    }

    // Fallback search by exact name if no playerId was matched but we have disconnected state
    if (!existingPlayer) {
      const foundKey = Object.keys(session.players).find(k => session.players[k].name.toLowerCase() === name.toLowerCase());
      if (foundKey) {
        existingPlayerKey = foundKey;
        existingPlayer = session.players[foundKey];
      }
    }

    // Reconnection Match Found! Let's restore client status
    if (existingPlayer) {
      // Re-assign the active socket id. Remove old key from registry, insert under new socket.id
      delete session.players[existingPlayerKey];
      
      existingPlayer.id = socket.id;
      if (playerId) {
        existingPlayer.playerId = playerId;
      }
      if (avatarId) {
        existingPlayer.avatarId = avatarId;
      }
      if (teamId) {
        existingPlayer.teamId = teamId;
      }
      
      session.players[socket.id] = existingPlayer;

      socket.join(`game:${pin}`);

      socket.emit("player:join-success", { 
        player: existingPlayer, 
        pin, 
        title: session.title,
        status: session.status,
        currentQuestionIndex: session.currentQuestionIndex,
        reconnected: true,
        gameMode: session.gameMode || "individual",
        teams: session.teams || []
      });

      // Synchronize player with current game stage
      if (session.status === "question") {
        const question = session.questions[session.currentQuestionIndex];
        socket.emit("question:active", {
          status: "question",
          currentIndex: session.currentQuestionIndex,
          totalQuestions: session.questions.length,
          text: question.text,
          options: question.options,
          timeLimit: question.timeLimit,
          timer: session.timer,
          totalPlayersCount: Object.keys(session.players).length,
          answeredCount: Object.values(session.players).filter((p) => p.answeredThisQuestion).length,
          alreadyAnswered: existingPlayer.answeredThisQuestion
        });
      } else if (session.status === "reveal") {
        const question = session.questions[session.currentQuestionIndex];
        socket.emit("player:question-result", {
          isCorrect: existingPlayer.isLastCorrect && existingPlayer.answeredThisQuestion,
          correctOption: question.correctOption,
          pointsEarned: existingPlayer.pointsEarned,
          totalScore: existingPlayer.score,
          streak: existingPlayer.streak,
          answeredThisQuestion: existingPlayer.answeredThisQuestion,
          reconnected: true
        });
      } else {
        // Send state update
        socket.emit("game:status-update", {
          status: session.status,
          timer: session.timer,
        });
      }

      // Notify host and other clients about active list
      io.to(`host:${pin}`).emit("player:joined-list", {
        players: Object.values(session.players)
      });
      io.to(`game:${pin}`).emit("player:joined-list", {
        players: Object.values(session.players)
      });
      io.to(`game:${pin}`).emit("player:list-update", {
        count: Object.keys(session.players).length
      });
      return;
    }

    // If it's a new player but the game is already in progress, deny access
    if (session.status !== "lobby") {
      socket.emit("player:join-error", { message: "La partida ya ha comenzado y no puedes unirte como nuevo participante." });
      return;
    }

    // Check duplicate name
    const nameExists = Object.values(session.players).some(
      (p) => p.name.toLowerCase() === name.toLowerCase()
    );
    if (nameExists) {
      socket.emit("player:join-error", { message: "Este nombre ya está en uso en esta sala." });
      return;
    }

    const resolvedPlayerId = playerId || "p_" + Math.random().toString(36).substring(2, 11);
    
    // Valid categories catalog check
    const validAvatars = [
      "cult_mariachi", "cult_charro", "cult_catrina", "cult_luchador_enm", "cult_taco", "cult_pinata",
      "jal_agave", "jal_torta_ahogada", "jal_jarrito", "jal_estadio", "jal_trompo_pastor", "jal_barril_tequila",
      "anim_ajolote", "anim_jaguar", "anim_aguila", "anim_zorro", "anim_tlacuache", "anim_colibri",
      "stem_robot", "stem_atomo", "stem_matraz", "stem_cohete", "stem_microscopio", "stem_adn",
      "prof_cientifico", "prof_cientifica", "prof_docente", "prof_abogado", "prof_medica", "prof_ingeniera",
      "dep_futbolista", "dep_boxeador", "dep_luchador", "dep_corredor", "dep_ciclista", "dep_pesista"
    ];
    let finalAvatar = avatarId;
    if (!finalAvatar || !validAvatars.includes(finalAvatar)) {
      finalAvatar = validAvatars[Math.floor(Math.random() * validAvatars.length)];
    }

    const player: Player = {
      id: socket.id,
      playerId: resolvedPlayerId,
      name,
      score: 0,
      streak: 0,
      answeredThisQuestion: false,
      lastAnswerIndex: -1,
      lastAnswerTime: 0,
      isLastCorrect: false,
      pointsEarned: 0,
      avatarId: finalAvatar,
      teamId: teamId || undefined
    };

    session.players[socket.id] = player;
    socket.join(`game:${pin}`);

    socket.emit("player:join-success", { 
      player, 
      pin, 
      title: session.title,
      gameMode: session.gameMode || "individual",
      teams: session.teams || []
    });
    
    // Notify host & other students
    io.to(`host:${pin}`).emit("player:joined-list", {
      players: Object.values(session.players)
    });
    io.to(`game:${pin}`).emit("player:joined-list", {
      players: Object.values(session.players)
    });
    io.to(`game:${pin}`).emit("player:list-update", {
      count: Object.keys(session.players).length
    });
  });

  // STUDENT SUBMITS ANSWER
  socket.on("player:submit-answer", ({ pin, optionIndex }: { pin: string; optionIndex: number }) => {
    const session = activeSessions[pin];
    if (!session || session.status !== "question") return;

    const player = session.players[socket.id];
    if (!player || player.answeredThisQuestion) return;

    player.answeredThisQuestion = true;
    player.lastAnswerIndex = optionIndex;
    
    const reactionTime = Date.now() - session.questionStartedAt;
    player.lastAnswerTime = reactionTime;

    const currentQ = session.questions[session.currentQuestionIndex];
    const isCorrect = optionIndex === currentQ.correctOption;

    if (isCorrect) {
      const earned = calculatePoints(reactionTime, currentQ.timeLimit);
      player.score += earned;
      player.streak += 1;
      player.pointsEarned = earned;
      player.isLastCorrect = true;
    } else {
      player.streak = 0;
      player.pointsEarned = 0;
      player.isLastCorrect = false;
    }

    if (!session.answersHistory) {
      session.answersHistory = [];
    }
    const alreadyExists = session.answersHistory.some(
      l => l.questionIndex === session.currentQuestionIndex && l.playerId === (player.playerId || player.id)
    );
    if (!alreadyExists) {
      session.answersHistory.push({
        playerId: player.playerId || player.id,
        playerName: player.name,
        questionIndex: session.currentQuestionIndex,
        optionIndex,
        isCorrect,
        pointsEarned: player.pointsEarned,
        reactionTime
      });
    }

    // Notify player that answer was locked
    socket.emit("player:answer-received", {
      optionIndex,
      pointsEarned: player.pointsEarned,
      isLastCorrect: player.isLastCorrect
    });

    const totalInGame = Object.keys(session.players).length;
    const answeredCount = Object.values(session.players).filter((p) => p.answeredThisQuestion).length;

    // Notify host of the new answer count
    io.to(`host:${pin}`).emit("player:answered-count", {
      answeredCount,
      totalInGame
    });

    // If everyone in the room has answered, reveal answers early!
    if (answeredCount >= totalInGame) {
      clearRoomInterval(pin);
      revealAnswerAndResults(pin);
    }
  });

  // CLEANUP ON DISCONNECT
  socket.on("disconnect", () => {
    // Find player in sessions and notify hosts
    Object.keys(activeSessions).forEach((pin) => {
      const session = activeSessions[pin];
      if (session.players[socket.id]) {
        // We keep the player in the registry so they don't lose points,
        // but wait, if it's during the lobby, we might want to let them drop out.
        if (session.status === "lobby") {
          delete session.players[socket.id];
          io.to(`host:${pin}`).emit("player:joined-list", {
            players: Object.values(session.players)
          });
          io.to(`game:${pin}`).emit("player:joined-list", {
            players: Object.values(session.players)
          });
          io.to(`game:${pin}`).emit("player:list-update", {
            count: Object.keys(session.players).length
          });
        } else {
          // Flag them or let host know
          io.to(`host:${pin}`).emit("player:disconnected", { id: socket.id });
        }
      }
    });
  });
});

// Configure Vite or Serve SPA Dist files
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Prepmaster Live local iniciado en puerto ${PORT}`);
    console.log(`Las URL locales estarán disponibles a través de la API`);
  });
}

startServer();
