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
import dns from "dns";

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

const isElectronEnv = process.env.IS_ELECTRON === "true" || !!process.env.PREPMASTER_DB_PATH;
let SQLITE_FILE = path.join(process.cwd(), "prepmaster.db");

if (process.env.PREPMASTER_DB_PATH) {
  SQLITE_FILE = process.env.PREPMASTER_DB_PATH;
} else if (isElectronEnv) {
  const appDataPath = process.env.APPDATA || 
    (process.platform === 'darwin' ? path.join(process.env.HOME || '', 'Library/Application Support') : path.join(process.env.HOME || '', '.config'));
  const userDir = path.join(appDataPath, "PrepmasterLive");
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  SQLITE_FILE = path.join(userDir, "prepmaster.db");
}

// Initialize SQLite Database
const db = new Database(SQLITE_FILE);

db.exec(`
  CREATE TABLE IF NOT EXISTS questionnaires (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    questions TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    game_type TEXT DEFAULT 'quiz_live'
  );

  CREATE TABLE IF NOT EXISTS game_history (
    id TEXT PRIMARY KEY,
    questionnaire TEXT NOT NULL,
    date TEXT NOT NULL,
    players TEXT NOT NULL,
    answers TEXT NOT NULL,
    scores TEXT NOT NULL,
    topicSummary TEXT NOT NULL,
    game_type TEXT DEFAULT 'quiz_live'
  );

  CREATE TABLE IF NOT EXISTS pictionary_word_banks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    topic TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pictionary_words (
    id TEXT PRIMARY KEY,
    bankId TEXT NOT NULL,
    word TEXT NOT NULL,
    category TEXT,
    difficulty TEXT,
    hint TEXT,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pictionary_history (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    bankName TEXT NOT NULL,
    config TEXT NOT NULL,
    teamScores TEXT NOT NULL,
    wordsDetailed TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS horse_race_history (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    bankTitle TEXT NOT NULL,
    config TEXT NOT NULL,
    results TEXT NOT NULL,
    playedQuestions TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS headbanz_word_banks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS headbanz_words (
    id TEXT PRIMARY KEY,
    bankId TEXT NOT NULL,
    concept TEXT NOT NULL,
    category TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    hint TEXT
  );

  CREATE TABLE IF NOT EXISTS headbanz_history (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    bankName TEXT NOT NULL,
    config TEXT NOT NULL,
    playerScores TEXT NOT NULL,
    conceptsLog TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS buzzer_history (
    id TEXT PRIMARY KEY,
    playerId TEXT NOT NULL,
    playerName TEXT NOT NULL,
    teamId TEXT,
    teamName TEXT,
    gameMode TEXT,
    timestamp INTEGER NOT NULL,
    position INTEGER NOT NULL,
    reactionTime REAL NOT NULL,
    date TEXT NOT NULL
  );
`);

try {
  db.exec("ALTER TABLE questionnaires ADD COLUMN game_type TEXT DEFAULT 'quiz_live'");
} catch (e) {
  // Safe to ignore if column already exists
}

try {
  // Fix any null or empty game_type to keep the data consistent
  db.exec("UPDATE questionnaires SET game_type = 'quiz_live' WHERE game_type IS NULL OR game_type = ''");
} catch (e) {
  console.error("Error setting game_type defaults:", e);
}

try {
  db.exec("ALTER TABLE game_history ADD COLUMN game_type TEXT DEFAULT 'quiz_live'");
} catch (e) {
  // Safe to ignore if column already exists
}

try {
  db.exec("ALTER TABLE game_history ADD COLUMN examProgress TEXT");
} catch (e) {}

try {
  db.exec("ALTER TABLE game_history ADD COLUMN examEvents TEXT");
} catch (e) {}

// Auto-migrate from any existing db.json to ensure no data loss
function migrateFromJSON(): void {
  try {
    const checkCount = db.prepare("SELECT COUNT(*) as count FROM questionnaires").get() as { count: number };
    if (checkCount && checkCount.count === 0 && fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      const list: Questionnaire[] = JSON.parse(data);
      const insert = db.prepare(`
        INSERT INTO questionnaires (id, title, description, questions, createdAt, game_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const quiz of list) {
        insert.run(
          quiz.id,
          quiz.title,
          quiz.description || "",
          JSON.stringify(quiz.questions),
          quiz.createdAt,
          quiz.game_type || "quiz_live"
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
      createdAt: r.createdAt,
      game_type: r.game_type || "quiz_live"
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
      INSERT OR REPLACE INTO questionnaires (id, title, description, questions, createdAt, game_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertOrReplace.run(
      quiz.id,
      quiz.title,
      quiz.description || "",
      JSON.stringify(quiz.questions),
      quiz.createdAt,
      quiz.game_type || "quiz_live"
    );
    console.log(`[SQLite] Guardado cuestionario ID ${quiz.id} con tipo ${quiz.game_type || "quiz_live"}`);
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

// ==========================================
// ==========================================

function loadHeadbanzBanks(): any[] {
  try {
    const banks = db.prepare("SELECT * FROM headbanz_word_banks ORDER BY createdAt DESC").all() as any[];
    return banks.map((bank: any) => {
      const words = db.prepare("SELECT * FROM headbanz_words WHERE bankId = ?").all(bank.id);
      return {
        ...bank,
        words
      };
    });
  } catch (err) {
    console.error("[SQLite] Error cargando bancos de Headbanz:", err);
    return [];
  }
}

function saveHeadbanzBank(bank: any): void {
  try {
    const insertBank = db.prepare(`
      INSERT INTO headbanz_word_banks (id, name, description, createdAt)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description
    `);
    
    insertBank.run(
      bank.id,
      bank.name,
      bank.description || "",
      bank.createdAt || new Date().toISOString()
    );

    // Delete existing words and insert new ones
    db.prepare("DELETE FROM headbanz_words WHERE bankId = ?").run(bank.id);

    const insertWord = db.prepare(`
      INSERT INTO headbanz_words (id, bankId, concept, category, difficulty, hint)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    if (bank.words && Array.isArray(bank.words)) {
      bank.words.forEach((w: any) => {
        insertWord.run(
          w.id || Math.random().toString(36).substring(2, 11),
          bank.id,
          w.concept,
          w.category || "General",
          w.difficulty || "medio",
          w.hint || ""
        );
      });
    }
    console.log(`[SQLite] Banco de Headbanz '${bank.name}' guardado correctamente.`);
  } catch (err) {
    console.error("[SQLite] Error guardando banco de Headbanz:", err);
  }
}

function deleteHeadbanzBank(id: string): void {
  try {
    db.prepare("DELETE FROM headbanz_word_banks WHERE id = ?").run(id);
    db.prepare("DELETE FROM headbanz_words WHERE bankId = ?").run(id);
    console.log(`[SQLite] Banco de Headbanz '${id}' eliminado.`);
  } catch (err) {
    console.error("[SQLite] Error eliminando banco de Headbanz:", err);
  }
}

function saveHeadbanzHistory(item: any): void {
  try {
    const insert = db.prepare(`
      INSERT INTO headbanz_history (id, date, bankName, config, playerScores, conceptsLog)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insert.run(
      item.id || Math.random().toString(36).substring(2, 11),
      item.date || new Date().toISOString(),
      item.bankName,
      JSON.stringify(item.config),
      JSON.stringify(item.playerScores),
      JSON.stringify(item.conceptsLog)
    );
    console.log(`[SQLite] Historial de Headbanz guardado correctamente.`);
  } catch (err) {
    console.error("[SQLite] Error guardando historial de Headbanz:", err);
  }
}

function seedHeadbanzDefaultBanks(): void {
  try {
    const count = db.prepare("SELECT COUNT(*) as cnt FROM headbanz_word_banks").get() as { cnt: number };
    if (count.cnt > 0) return;

    console.log("[SQLite] Sembrando banco predeterminado Ciencias Biológicas para Headbanz...");
    const bankId = "seed_biology_1";
    
    db.prepare(`
      INSERT INTO headbanz_word_banks (id, name, description, createdAt)
      VALUES (?, ?, ?, ?)
    `).run(
      bankId,
      "Ciencias Biológicas 🌿",
      "Procesos, células, genética y orgánulos fundamentales de la biología de nivel preparatoria.",
      new Date().toISOString()
    );

    const insertWord = db.prepare(`
      INSERT INTO headbanz_words (id, bankId, concept, category, difficulty, hint)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const seedWords = [
      { id: "sb1", concept: "Fotosíntesis", category: "Procesos", difficulty: "medio", hint: "Convierte luz solar en glucosa." },
      { id: "sb2", concept: "Mitosis", category: "Procesos", difficulty: "medio", hint: "División celular que genera células hijas idénticas." },
      { id: "sb3", concept: "Mitocondria", category: "Orgánulos", difficulty: "medio", hint: "La central energética de la célula." },
      { id: "sb4", concept: "ADN", category: "Genética", difficulty: "facil", hint: "Contiene las instrucciones genéticas de la vida." },
      { id: "sb5", concept: "Cloroplasto", category: "Orgánulos", difficulty: "medio", hint: "Orgánulo donde ocurre la fotosíntesis." },
      { id: "sb6", concept: "Enzima", category: "Bioquímica", difficulty: "dificil", hint: "Proteína que actúa como catalizador biológico." },
      { id: "sb7", concept: "Neurona", category: "Células", difficulty: "facil", hint: "Célula especializada en transmitir impulsos nerviosos." },
      { id: "sb8", concept: "Glóbulo Rojo", category: "Células", difficulty: "facil", hint: "Transporta oxígeno en la sangre." }
    ];

    seedWords.forEach(w => {
      insertWord.run(w.id, bankId, w.concept, w.category, w.difficulty, w.hint);
    });

    console.log("[SQLite] Sembrado completado de Ciencias Biológicas.");
  } catch (err) {
    console.error("[SQLite] Error sembrando base de datos de Headbanz:", err);
  }
}

// Run DB seeding

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

    const examProgressJSON = JSON.stringify((session as any).examProgress || {});
    const examEventsJSON = JSON.stringify((session as any).examEvents || []);

    const insertHistory = db.prepare(`
      INSERT OR REPLACE INTO game_history (id, questionnaire, date, players, answers, scores, topicSummary, game_type, examProgress, examEvents)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertHistory.run(
      `game_${pin}_${Date.now()}`,
      questionnaireJSON,
      new Date().toISOString(),
      playersJSON,
      answersJSON,
      scoresJSON,
      JSON.stringify(finalTopicSummary),
      (session as any).gameType || "quiz_live",
      examProgressJSON,
      examEventsJSON
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
app.get("/api/electron/status", (req, res) => {
  res.json({
    isElectron: isElectronEnv,
    dbPath: SQLITE_FILE,
    backupsDir: path.join(path.dirname(SQLITE_FILE), "respaldos")
  });
});

app.post("/api/electron/open-folder", (req, res) => {
  try {
    const dir = path.dirname(SQLITE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const platform = process.platform;
    const { exec } = require("child_process");
    if (platform === "win32") {
      exec(`explorer "${dir}"`);
    } else if (platform === "darwin") {
      exec(`open "${dir}"`);
    } else {
      exec(`xdg-open "${dir}"`);
    }
    res.json({ success: true, dir });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/electron/backup", (req, res) => {
  try {
    const parentDir = path.dirname(SQLITE_FILE);
    const backupsDir = path.join(parentDir, "respaldos");
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const backupName = `prepmaster_respaldo_${timestamp}.db`;
    const backupPath = path.join(backupsDir, backupName);

    // Copy DB file
    fs.copyFileSync(SQLITE_FILE, backupPath);

    // Open backup folder in UI
    const platform = process.platform;
    const { exec } = require("child_process");
    if (platform === "win32") {
      exec(`explorer "${backupsDir}"`);
    } else if (platform === "darwin") {
      exec(`open "${backupsDir}"`);
    } else {
      exec(`xdg-open "${backupsDir}"`);
    }

    res.json({ success: true, backupPath, backupName });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

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

// Network info API returning localIp, port, and localUrl (Prepmaster Live 2.1.2)
app.get("/api/network-info", (req, res) => {
  const ips = getLocalIPs().filter(ip => ip !== "localhost" && ip !== "127.0.0.1");
  const localIp = ips[0] || "";
  const port = PORT || 3000;
  const localUrl = localIp ? `http://${localIp}:${port}` : "";
  res.json({
    localIp,
    port,
    localUrl
  });
});

// Network Diagnostic API for Prepmaster 2.0.1
app.get("/api/network-diagnostic", async (req, res) => {
  const interfaces = os.networkInterfaces();
  let activeInterfaceName = "No detectada";
  let networkType = "Local (Wi-Fi o Ethernet)";
  
  // Find the first active non-loopback IPv4 interface name
  for (const name of Object.keys(interfaces)) {
    const netList = interfaces[name];
    if (netList) {
      for (const net of netList) {
        if (net.family === "IPv4" && !net.internal) {
          activeInterfaceName = name; // e.g. "Wi-Fi", "Ethernet", "en0", "wlan0"
          if (name.toLowerCase().includes("wi-fi") || name.toLowerCase().includes("wlan") || name.toLowerCase().includes("wireless") || name.toLowerCase().includes("wireles")) {
            networkType = "Wi-Fi inalámbrica";
          } else if (name.toLowerCase().includes("ethernet") || name.toLowerCase().includes("eth")) {
            networkType = "Ethernet cableada";
          }
          break;
        }
      }
    }
  }

  const ips = getLocalIPs();
  const preferredIP = ips[0];
  const webPort = PORT;
  const localUrl = `http://${preferredIP}:${webPort}`;
  const appUrl = process.env.APP_URL || localUrl;

  // Check internet lookup
  let internetConnected = false;
  try {
    await new Promise<void>((resolve) => {
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }, 1500);

      dns.lookup("google.com", (err) => {
        clearTimeout(timer);
        if (!resolved) {
          resolved = true;
          if (!err) {
            internetConnected = true;
          }
          resolve();
        }
      });
    });
  } catch (e) {
    internetConnected = false;
  }

  // Count connected sockets in socket.io
  const deviceCount = io.sockets.sockets.size;

  let qrLocal = "";
  let qrApp = "";
  try {
    qrLocal = await QRCode.toDataURL(localUrl);
    qrApp = process.env.APP_URL ? await QRCode.toDataURL(process.env.APP_URL) : qrLocal;
  } catch (err) {
    console.error("Error generating QR code in diagnostic", err);
  }

  res.json({
    networkName: `${networkType} (${activeInterfaceName})`,
    preferredIP,
    port: webPort,
    serverStatus: "online",
    deviceCount,
    internetConnected,
    localUrl,
    appUrl,
    qrLocal,
    qrApp
  });
});

// ==========================================

// ==========================================
// SOCKET.IO CORE (Recovered basic routing)
// ==========================================
io.on("connection", (socket) => {
  // Join a room based on PIN
  socket.on("player:join", (data) => {
    if (data && data.pin) {
      socket.join('game:' + data.pin);
      socket.to('game:' + data.pin).emit("player:joined-list", data);
      socket.emit("player:join-success", data);
    }
  });

  socket.on("host:create-session", (data) => {
    if (data && data.pin) {
      socket.join('game:' + data.pin);
    }
  });

  // Generic broadcaster for host to students
  const hostEvents = [
    "host:start-game", "host:next-question", "host:skip-question", 
    "host:end-game", "host:show-leaderboard", "game:host-message",
    "jeopardy:start", "jeopardy:question-show", "jeopardy:cell-cleared",
    "exam:start", "exam:ended", "game:status-update", "countdown:tick",
    "question:active", "question:tick"
  ];
  
  hostEvents.forEach(evt => {
    socket.on(evt, (data) => {
      if (data && data.pin) {
        socket.to('game:' + data.pin).emit(evt, data);
      }
    });
  });

  // Generic broadcaster for students to host
  const playerEvents = [
    "player:submit-answer", "player:answer-received", "player:question-result",
    "buzzer:press", "game:player-message", "player:leave"
  ];

  playerEvents.forEach(evt => {
    socket.on(evt, (data) => {
      if (data && data.pin) {
        // Send to host (we assume everyone in room gets it, and host filters it)
        io.to('game:' + data.pin).emit(evt, data);
      }
    });
  });

  // Buzzer logic
  const buzzerEvents = ["buzzer:start", "buzzer:close", "buzzer:reset"];
  buzzerEvents.forEach(evt => {
    socket.on(evt, (data) => {
      if (data && data.pin) {
        io.to('game:' + data.pin).emit(evt.replace("buzzer:", "buzzer:") + (evt === "buzzer:start" ? "ted" : evt === "buzzer:reset" ? "ted" : "d"), data); // just basic mapping or broadcast
      }
    });
  });

  socket.on("buzzer:reset", (data) => {
     if (data && data.pin) {
        io.to('game:' + data.pin).emit("buzzer:resetted", data);
     }
  });
  socket.on("buzzer:start", (data) => {
     if (data && data.pin) {
        io.to('game:' + data.pin).emit("buzzer:started", data);
     }
  });
  socket.on("buzzer:close", (data) => {
     if (data && data.pin) {
        io.to('game:' + data.pin).emit("buzzer:closed", data);
     }
  });

  socket.on("disconnect", () => {
    // Handle disconnects generically if needed
  });
});

async function startViteAndListen() {
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const HOST = '0.0.0.0';
  
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = typeof __dirname !== 'undefined' ? __dirname : path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, HOST, () => {
    console.log(`Servidor Prepmaster corriendo en http://${HOST}:${PORT}`);
  });
}

startViteAndListen().catch(console.error);

