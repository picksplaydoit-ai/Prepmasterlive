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
// PICTIONARY DATABASE OPERATIONS (Prepmaster 2.3.0)
// ==========================================

function loadPictionaryBanks(): any[] {
  try {
    const banks = db.prepare("SELECT * FROM pictionary_word_banks ORDER BY createdAt DESC").all() as any[];
    return banks.map((bank) => {
      const words = db.prepare("SELECT * FROM pictionary_words WHERE bankId = ?").all(bank.id) as any[];
      return {
        id: bank.id,
        name: bank.name,
        description: bank.description || "",
        topic: bank.topic || "",
        createdAt: bank.createdAt,
        updatedAt: bank.updatedAt,
        words: words.map(w => ({
          id: w.id,
          bankId: w.bankId,
          word: w.word,
          category: w.category || "",
          difficulty: w.difficulty || "Media",
          hint: w.hint || "",
          createdAt: w.createdAt
        }))
      };
    });
  } catch (error) {
    console.error("[SQLite] Error cargando bancos de Pictionary:", error);
    return [];
  }
}

const savePictionaryBankTrans = db.transaction((bank: any) => {
  db.prepare(`
    INSERT OR REPLACE INTO pictionary_word_banks (id, name, description, topic, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    bank.id,
    bank.name,
    bank.description || "",
    bank.topic || "",
    bank.createdAt,
    bank.updatedAt
  );

  db.prepare("DELETE FROM pictionary_words WHERE bankId = ?").run(bank.id);

  const insertWord = db.prepare(`
    INSERT INTO pictionary_words (id, bankId, word, category, difficulty, hint, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const w of (bank.words || [])) {
    insertWord.run(
      w.id || Math.random().toString(36).substring(2, 11),
      bank.id,
      w.word,
      w.category || "",
      w.difficulty || "Media",
      w.hint || "",
      w.createdAt || new Date().toISOString()
    );
  }
});

function savePictionaryBank(bank: any): void {
  try {
    savePictionaryBankTrans(bank);
    console.log(`[SQLite] Guardado banco Pictionary ID ${bank.id} con ${bank.words?.length || 0} palabras.`);
  } catch (error) {
    console.error("[SQLite] Error guardando banco Pictionary:", error);
    throw error;
  }
}

function deletePictionaryBank(id: string): void {
  try {
    const deleteTrans = db.transaction(() => {
      db.prepare("DELETE FROM pictionary_word_banks WHERE id = ?").run(id);
      db.prepare("DELETE FROM pictionary_words WHERE bankId = ?").run(id);
    });
    deleteTrans();
    console.log(`[SQLite] Eliminado banco Pictionary ID ${id} y sus palabras.`);
  } catch (error) {
    console.error("[SQLite] Error eliminando banco Pictionary:", error);
  }
}

function duplicatePictionaryBank(originalId: string): any {
  try {
    const bank = db.prepare("SELECT * FROM pictionary_word_banks WHERE id = ?").get(originalId) as any;
    if (!bank) return null;
    const words = db.prepare("SELECT * FROM pictionary_words WHERE bankId = ?").all(originalId) as any[];

    const newId = Math.random().toString(36).substring(2, 11);
    const newBank = {
      id: newId,
      name: `${bank.name} (Copia)`,
      description: bank.description || "",
      topic: bank.topic || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      words: words.map(w => ({
        id: Math.random().toString(36).substring(2, 11),
        bankId: newId,
        word: w.word,
        category: w.category || "",
        difficulty: w.difficulty || "Media",
        hint: w.hint || "",
        createdAt: new Date().toISOString()
      }))
    };

    savePictionaryBank(newBank);
    return newBank;
  } catch (error) {
    console.error("[SQLite] Error duplicando banco Pictionary:", error);
    return null;
  }
}

function loadPictionaryHistory(): any[] {
  try {
    const rows = db.prepare("SELECT * FROM pictionary_history ORDER BY date DESC").all() as any[];
    return rows.map((r) => ({
      id: r.id,
      date: r.date,
      bankName: r.bankName,
      config: JSON.parse(r.config),
      teamScores: JSON.parse(r.teamScores),
      wordsDetailed: JSON.parse(r.wordsDetailed)
    }));
  } catch (error) {
    console.error("[SQLite] Error cargando historial de Pictionary:", error);
    return [];
  }
}

function savePictionaryHistory(item: any): void {
  try {
    const insert = db.prepare(`
      INSERT INTO pictionary_history (id, date, bankName, config, teamScores, wordsDetailed)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insert.run(
      item.id || Math.random().toString(36).substring(2, 11),
      item.date || new Date().toISOString(),
      item.bankName,
      JSON.stringify(item.config),
      JSON.stringify(item.teamScores),
      JSON.stringify(item.wordsDetailed)
    );
    console.log(`[SQLite] Registro de partida Pictionary guardado en historial.`);
  } catch (error) {
    console.error("[SQLite] Error guardando historial Pictionary:", error);
  }
}

function loadHorseRaceHistory(): any[] {
  try {
    const rows = db.prepare("SELECT * FROM horse_race_history ORDER BY date DESC").all() as any[];
    return rows.map((r) => ({
      id: r.id,
      date: r.date,
      bankTitle: r.bankTitle,
      config: JSON.parse(r.config),
      results: JSON.parse(r.results),
      playedQuestions: JSON.parse(r.playedQuestions)
    }));
  } catch (error) {
    console.error("[SQLite] Error cargando historial de Carrera de Caballos:", error);
    return [];
  }
}

function saveHorseRaceHistory(item: any): void {
  try {
    const insert = db.prepare(`
      INSERT INTO horse_race_history (id, date, bankTitle, config, results, playedQuestions)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insert.run(
      item.id || Math.random().toString(36).substring(2, 11),
      item.date || new Date().toISOString(),
      item.bankTitle,
      JSON.stringify(item.config),
      JSON.stringify(item.results),
      JSON.stringify(item.playedQuestions)
    );
    console.log(`[SQLite] Registro de partida Carrera de Caballos guardado en historial.`);
  } catch (error) {
    console.error("[SQLite] Error guardando historial Carrera de Caballos:", error);
  }
}

// ==========================================
// HEADBANZ SQLITE HELPERS & SEEDING (Prepmaster 2.5.0)
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
seedHeadbanzDefaultBanks();

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
      INSERT OR REPLACE INTO game_history (id, questionnaire, date, players, answers, scores, topicSummary, game_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertHistory.run(
      `game_${pin}_${Date.now()}`,
      questionnaireJSON,
      new Date().toISOString(),
      playersJSON,
      answersJSON,
      scoresJSON,
      JSON.stringify(finalTopicSummary),
      (session as any).gameType || "quiz_live"
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
// PICTIONARY REST ENDPOINTS (Prepmaster 2.3.0)
// ==========================================

// List Pictionary word banks
app.get("/api/pictionary/banks", (req, res) => {
  const banks = loadPictionaryBanks();
  res.json(banks);
});

// Save (create or update) Pictionary word bank
app.post("/api/pictionary/banks", express.json(), (req, res) => {
  try {
    const bank = req.body;
    if (!bank.id) {
      bank.id = Math.random().toString(36).substring(2, 11);
    }
    if (!bank.createdAt) {
      bank.createdAt = new Date().toISOString();
    }
    bank.updatedAt = new Date().toISOString();
    
    savePictionaryBank(bank);
    res.json({ success: true, bank });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete Pictionary word bank
app.delete("/api/pictionary/banks/:id", (req, res) => {
  try {
    deletePictionaryBank(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Duplicate Pictionary word bank
app.post("/api/pictionary/banks/:id/duplicate", (req, res) => {
  try {
    const duplicated = duplicatePictionaryBank(req.params.id);
    if (!duplicated) {
      return res.status(404).json({ success: false, error: "Banco original no encontrado" });
    }
    res.json({ success: true, bank: duplicated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// List Pictionary history
app.get("/api/pictionary/history", (req, res) => {
  const history = loadPictionaryHistory();
  res.json(history);
});

// Save Pictionary game history
app.post("/api/pictionary/history", express.json(), (req, res) => {
  try {
    const item = req.body;
    if (!item.id) {
      item.id = Math.random().toString(36).substring(2, 11);
    }
    if (!item.date) {
      item.date = new Date().toISOString();
    }
    savePictionaryHistory(item);
    res.json({ success: true, item });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// List universal buzzer history
app.get("/api/buzzer/history", (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM buzzer_history ORDER BY timestamp DESC").all();
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get universal buzzer computed stats and rankings
app.get("/api/buzzer/stats", (req, res) => {
  try {
    const fastestAllTime = db.prepare(`
      SELECT playerName, teamName, gameMode, reactionTime, date
      FROM buzzer_history
      WHERE reactionTime > 0.01
      ORDER BY reactionTime ASC
      LIMIT 1
    `).get();

    const bestReflexesTeam = db.prepare(`
      SELECT teamName, AVG(reactionTime) as avgTime
      FROM buzzer_history
      WHERE teamName IS NOT NULL AND teamName != '' AND reactionTime > 0.01
      GROUP BY teamName
      ORDER BY avgTime ASC
      LIMIT 1
    `).get();

    const overallAvg = db.prepare(`
      SELECT AVG(reactionTime) as avgTime
      FROM buzzer_history
      WHERE reactionTime > 0.01
    `).get() as any;

    const lastSession = db.prepare(`
      SELECT gameMode, timestamp
      FROM buzzer_history
      ORDER BY timestamp DESC
      LIMIT 1
    `).get() as any;

    let fastestLastSession = null;
    if (lastSession) {
      // Find the fastest in that same timestamp cluster/run (within last 1 minute)
      fastestLastSession = db.prepare(`
        SELECT playerName, teamName, reactionTime
        FROM buzzer_history
        WHERE timestamp >= ? - 60000 AND timestamp <= ? + 60000 AND reactionTime > 0.01
        ORDER BY reactionTime ASC
        LIMIT 1
      `).get(lastSession.timestamp, lastSession.timestamp);
    }

    res.json({
      fastestAllTime: fastestAllTime || null,
      bestReflexesTeam: bestReflexesTeam || null,
      overallAvg: overallAvg ? overallAvg.avgTime : null,
      fastestLastSession: fastestLastSession || null
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// List Horse Race history
app.get("/api/horse-race/history", (req, res) => {
  const history = loadHorseRaceHistory();
  res.json(history);
});

// Save Horse Race game history
app.post("/api/horse-race/history", express.json(), (req, res) => {
  try {
    const item = req.body;
    if (!item.id) {
      item.id = Math.random().toString(36).substring(2, 11);
    }
    if (!item.date) {
      item.date = new Date().toISOString();
    }
    saveHorseRaceHistory(item);
    res.json({ success: true, item });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// HEADBANZ REST API ENDPOINTS (Prepmaster 2.5.0)
// ==========================================

// Get all Headbanz word banks
app.get("/api/headbanz/banks", (req, res) => {
  try {
    const banks = loadHeadbanzBanks();
    res.json(banks);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create/Update Headbanz word bank
app.post("/api/headbanz/banks", express.json(), (req, res) => {
  try {
    const bank = req.body;
    if (!bank.id) {
      bank.id = Math.random().toString(36).substring(2, 11);
    }
    if (!bank.createdAt) {
      bank.createdAt = new Date().toISOString();
    }
    saveHeadbanzBank(bank);
    res.json({ success: true, bank });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete Headbanz word bank
app.delete("/api/headbanz/banks/:id", (req, res) => {
  try {
    const { id } = req.params;
    deleteHeadbanzBank(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Duplicate Headbanz word bank
app.post("/api/headbanz/banks/:id/duplicate", (req, res) => {
  try {
    const { id } = req.params;
    const banks = loadHeadbanzBanks();
    const source = banks.find((b: any) => b.id === id);
    if (!source) {
      return res.status(404).json({ success: false, message: "Banco no encontrado." });
    }

    const copy = {
      id: Math.random().toString(36).substring(2, 11),
      name: `${source.name} (Copia)`,
      description: source.description || "",
      createdAt: new Date().toISOString(),
      words: (source.words || []).map((w: any) => ({
        id: Math.random().toString(36).substring(2, 11),
        concept: w.concept,
        category: w.category,
        difficulty: w.difficulty,
        hint: w.hint
      }))
    };

    saveHeadbanzBank(copy);
    res.json({ success: true, bank: copy });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// List Questionnaires
app.get("/api/questionnaires", (req, res) => {
  let questionnaires = loadQuestionnaires();
  const { game_type } = req.query;
  if (game_type) {
    questionnaires = questionnaires.filter(q => q.game_type === game_type);
  }
  res.json(questionnaires);
});

// Dynamic template downloader API - Prepmaster 2.1.0
app.get("/api/templates/:filename", (req, res) => {
  const { filename } = req.params;
  
  if (filename.startsWith("quiz_live_template")) {
    if (filename.endsWith(".txt")) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.send(`Pregunta: ¿Cuál es la fórmula química del agua?
A) H2
B) CO2
C) H2O
D) O2
Respuesta: C
Tiempo: 20
Puntos: 1000
Tema: Química

Pregunta: ¿Qué planeta es conocido como el Planeta Rojo?
A) Tierra
B) Marte
C) Júpiter
D) Saturno
Respuesta: B
Tiempo: 30
Puntos: 800
Tema: Astronomía`);
    } else {
      const rows = [
        {
          "Pregunta": "¿Cuál es la fórmula química del agua?",
          "Opción A": "H2",
          "Opción B": "CO2",
          "Opción C": "H2O",
          "Opción D": "O2",
          "Respuesta Correcta": "C",
          "Tiempo (segundos)": 20,
          "Puntos": 1000,
          "Tema": "Química"
        },
        {
          "Pregunta": "¿Qué planeta es conocido como el Planeta Rojo?",
          "Opción A": "Tierra",
          "Opción B": "Marte",
          "Opción C": "Júpiter",
          "Opción D": "Saturno",
          "Respuesta Correcta": "B",
          "Tiempo (segundos)": 30,
          "Puntos": 800,
          "Tema": "Astronomía"
        }
      ];
      if (filename.endsWith(".csv")) {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        return res.send(Papa.unparse(rows));
      } else {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Quiz Live");
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        return res.send(buf);
      }
    }
  }

  if (filename.startsWith("exam_mode_template")) {
    if (filename.endsWith(".txt")) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.send(`Tipo: Opción múltiple
Pregunta: ¿Cuál es el pH neutro del agua destilada?
A) 5
B) 7
C) 9
D) 14
Respuesta: B
Puntos: 2
Tema: Química
Retroalimentación: El pH neutro es exactamente 7.

Tipo: Verdadero/Falso
Pregunta: El sol es una estrella de tipo espectral G2V.
Respuesta: Verdadero
Puntos: 1
Tema: Astronomía
Retroalimentación: Sí, el Sol es una enana amarilla.

Tipo: Respuesta corta
Pregunta: ¿Qué gas de efecto invernadero liberan las vacas?
Respuesta: Metano
Alternativas: metano b, ch4, gas metano
Puntos: 3
Tema: Ecología
Retroalimentación: Las vacas liberan gas metano debido a la fermentación entérica.`);
    } else {
      const rows = [
        {
          "Tipo": "Opción múltiple",
          "Pregunta": "¿Cuál es el pH neutro del agua destilada?",
          "Opción A": "5",
          "Opción B": "7",
          "Opción C": "9",
          "Opción D": "14",
          "Respuesta": "B",
          "Alternativas (separadas por coma)": "",
          "Puntos": 2,
          "Tema": "Química",
          "Retroalimentación": "El pH neutro es exactamente 7."
        },
        {
          "Tipo": "Verdadero/Falso",
          "Pregunta": "El sol es una estrella de tipo espectral G2V.",
          "Opción A": "",
          "Opción B": "",
          "Opción C": "",
          "Opción D": "",
          "Respuesta": "Verdadero",
          "Alternativas (separadas por coma)": "",
          "Puntos": 1,
          "Tema": "Astronomía",
          "Retroalimentación": "Sí, el Sol es una enana amarilla."
        },
        {
          "Tipo": "Respuesta corta",
          "Pregunta": "¿Qué gas de efecto invernadero liberan las vacas?",
          "Opción A": "",
          "Opción B": "",
          "Opción C": "",
          "Opción D": "",
          "Respuesta": "Metano",
          "Alternativas (separadas por coma)": "metano b, ch4, gas metano",
          "Puntos": 3,
          "Tema": "Ecología",
          "Retroalimentación": "Las vacas liberan gas metano debido a la fermentación entérica."
        }
      ];
      if (filename.endsWith(".csv")) {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        return res.send(Papa.unparse(rows));
      } else {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Modo Examen");
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        return res.send(buf);
      }
    }
  }

  if (filename.startsWith("mexicanos_template")) {
    if (filename.endsWith(".txt")) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.send(`Pregunta: Menciona cosas que llevas a la playa
Respuesta: Toalla|45|toallas, sabana playera
Respuesta: Bloqueador solar|30|bloqueador, protector, protector solar
Respuesta: Traje de baño|15|bañador, short
Respuesta: Lentes de sol|10|gafas, lentes, gafas de sol
Tema: General
Ronda: 1

Pregunta: Algo que haces antes de dormir
Respuesta: Lavarse los dientes|40|cepillarse, lavarme los dientes
Respuesta: Apagar la luz|25|apagar la lampara, oscurecer
Respuesta: Ponerse la pijama|20|cambiarse de ropa, vestir pijama
Respuesta: Revisar el celular|15|mirar el movil, chatear
Tema: Hábitos
Ronda: 2`);
    } else {
      const rows = [
        {
          "Pregunta": "Menciona cosas que llevas a la playa",
          "Respuesta 1": "Toalla|45|toallas, sabana playera",
          "Respuesta 2": "Bloqueador solar|30|bloqueador, protector solar",
          "Respuesta 3": "Traje de baño|15|bañador, short",
          "Respuesta 4": "Lentes de sol|10|gafas de sol",
          "Respuesta 5": "",
          "Respuesta 6": "",
          "Respuesta 7": "",
          "Respuesta 8": "",
          "Respuesta 9": "",
          "Respuesta 10": "",
          "Tema": "General",
          "Ronda": 1
        },
        {
          "Pregunta": "Algo que haces antes de dormir",
          "Respuesta 1": "Lavarse los dientes|40|cepillarse",
          "Respuesta 2": "Apagar la luz|25|oscurecer, apagar lampara",
          "Respuesta 3": "Ponerse la pijama|20|cambiarse ropa",
          "Respuesta 4": "Revisar el celular|15|mirar movil",
          "Respuesta 5": "",
          "Respuesta 6": "",
          "Respuesta 7": "",
          "Respuesta 8": "",
          "Respuesta 9": "",
          "Respuesta 10": "",
          "Tema": "Hábitos",
          "Ronda": 2
        }
      ];
      if (filename.endsWith(".csv")) {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        return res.send(Papa.unparse(rows));
      } else {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "100 Estudiantes");
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        return res.send(buf);
      }
    }
  }

  if (filename.startsWith("jeopardy_template")) {
    if (filename.endsWith(".txt")) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.send(`Categoria: Química

Valor: 200
Pregunta: ¿Cuál es la fórmula química del agua?
Respuesta: H2O
Pista: Está compuesta por hidrógeno y oxígeno.

Valor: 400
Pregunta: ¿Qué gas es indispensable para la respiración humana?
Respuesta: Oxígeno
Pista: O2

Categoria: Historia

Valor: 200
Pregunta: ¿En qué año se descubrió América?
Respuesta: 1492
Pista: Siglo XV.

Valor: 400
Pregunta: ¿Quién fue el primer presidente de México?
Respuesta: Guadalupe Victoria
Pista: Su nombre real era José Miguel Fernández y Félix.`);
    } else {
      const rows = [
        {
          "Categoria": "Química",
          "Valor": 200,
          "Pregunta": "¿Cuál es la fórmula química del agua?",
          "Respuesta": "H2O",
          "Pista": "Está compuesta por hidrógeno y oxígeno."
        },
        {
          "Categoria": "Química",
          "Valor": 400,
          "Pregunta": "¿Qué gas es indispensable para la respiración humana?",
          "Respuesta": "Oxígeno",
          "Pista": "O2"
        },
        {
          "Categoria": "Historia",
          "Valor": 200,
          "Pregunta": "¿En qué año se descubrió América?",
          "Respuesta": "1492",
          "Pista": "Siglo XV"
        },
        {
          "Categoria": "Historia",
          "Valor": 400,
          "Pregunta": "¿Quién fue el primer presidente de México?",
          "Respuesta": "Guadalupe Victoria",
          "Pista": "Su nombre real era José Miguel Fernández y Félix."
        }
      ];
      if (filename.endsWith(".csv")) {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        return res.send(Papa.unparse(rows));
      } else {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Jeopardy");
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        return res.send(buf);
      }
    }
  }

  return res.status(404).send("Plantilla no encontrada");
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
      teams: session.teams || [],
      examProgress: (session as any).examProgress || {},
      examEvents: (session as any).examEvents || [],
      timeLimitMinutes: (session as any).timeLimitMinutes || null
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
// Endpoint: Parse mass-imported questions from files (TXT, CSV, XLSX, DOCX)
app.post("/api/parse-file", async (req, res) => {
  try {
    const { fileName, base64Data, game_type } = req.body;
    if (!fileName || !base64Data) {
      return res.status(400).json({ success: false, error: "Faltan parámetros: se requiere fileName y base64Data." });
    }

    const type = game_type || "quiz_live";
    const buffer = Buffer.from(base64Data, "base64");
    const ext = fileName.split(".").pop()?.toLowerCase();

    let textContent = "";
    let questionsList: any[] = [];

    const sanitize = (val: any): string => {
      if (val === undefined || val === null) return "";
      return String(val).replace(/<[^>]*>/g, "").trim();
    };

    if (ext === "txt" || ext === "docx") {
      if (ext === "txt") {
        textContent = buffer.toString("utf-8");
      } else {
        const result = await mammoth.extractRawText({ buffer });
        textContent = result.value;
      }
      
      if (type === "quiz_live") {
        questionsList = parseTextAndDocxQuestions(textContent, sanitize);
      } else if (type === "exam_mode") {
        questionsList = parseExamQuestionsText(textContent, sanitize);
      } else if (type === "mexicanos") {
        questionsList = parseMexicanosQuestionsText(textContent, sanitize);
      } else if (type === "jeopardy") {
        questionsList = parseJeopardyQuestionsText(textContent, sanitize);
      }
    } else if (ext === "csv" || ext === "xlsx" || ext === "xls") {
      let rows: any[][] = [];
      if (ext === "csv") {
        const csvText = buffer.toString("utf-8");
        const parseResult = Papa.parse(csvText, { skipEmptyLines: true });
        rows = parseResult.data as any[][];
      } else {
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      }

      if (type === "quiz_live") {
        questionsList = parseSpreadsheetRows(rows, sanitize);
      } else if (type === "exam_mode") {
        questionsList = parseExamSpreadsheet(rows, sanitize);
      } else if (type === "mexicanos") {
        questionsList = parseMexicanosSpreadsheet(rows, sanitize);
      } else if (type === "jeopardy") {
        questionsList = parseJeopardySpreadsheet(rows, sanitize);
      }
    } else {
      return res.status(400).json({ success: false, error: "Formato de archivo no soportado. Debe ser TXT, CSV, XLSX o DOCX." });
    }

    return res.json({ success: true, questions: questionsList });
  } catch (err: any) {
    console.error("Error interpretando archivo:", err);
    return res.status(500).json({ success: false, error: err.message || "Error interno al interpretar el archivo." });
  }
});

// Endpoint: Parse mass-imported questions from pasted text
app.post("/api/parse-pasted-text", express.json({ limit: "15mb" }), async (req, res) => {
  try {
    const { text, game_type } = req.body;
    if (text === undefined || text === null) {
      return res.status(400).json({ success: false, error: "Falta el parámetro 'text'." });
    }

    const type = game_type || "quiz_live";
    const sanitize = (val: any): string => {
      if (val === undefined || val === null) return "";
      return String(val).replace(/<[^>]*>/g, "").trim();
    };

    let questionsList: any[] = [];
    if (type === "quiz_live") {
      questionsList = smartParsePastedText(text, sanitize);
    } else if (type === "exam_mode") {
      questionsList = parseExamQuestionsText(text, sanitize);
    } else if (type === "mexicanos") {
      questionsList = parseMexicanosQuestionsText(text, sanitize);
    } else if (type === "jeopardy") {
      questionsList = parseJeopardyQuestionsText(text, sanitize);
    }

    return res.json({ success: true, questions: questionsList });
  } catch (err: any) {
    console.error("Error al interpretar texto pegado:", err);
    return res.status(500).json({ success: false, error: err.message || "Error interno al interpretar el texto." });
  }
});

// Smart parser for pasted teacher text with fallback and advanced matching
function smartParsePastedText(text: string, sanitize: (val: any) => string): any[] {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n").map(l => l.trim());
  const questions: any[] = [];
  
  let current: {
    textLines: string[];
    options: string[];
    correctOptionRaw: string;
    timeLimit?: number;
    points?: number;
    topic?: string;
  } = { textLines: [], options: [], correctOptionRaw: "" };

  const pushCurrent = () => {
    const questionText = current.textLines.join(" ").trim();
    const actualOptions = current.options.filter(o => o !== undefined && o !== null);
    
    // Ignore completely empty blocks
    if (!questionText && actualOptions.length === 0) {
      return;
    }
    
    const errors: string[] = [];
    if (!questionText) {
      errors.push("Enunciado de pregunta vacío.");
    }
    
    // Check options count
    const nonAmpleOptions = actualOptions.map(o => o.trim()).filter(Boolean);
    if (nonAmpleOptions.length < 2) {
      errors.push("Debe ingresar al menos 2 opciones de respuesta.");
    }

    // Check duplicate options
    const uniqueOptions = new Set(nonAmpleOptions.map(o => o.toLowerCase()));
    if (uniqueOptions.size < nonAmpleOptions.length) {
      errors.push("Se detectaron opciones de respuesta duplicadas.");
    }
    
    let correctOptionIndex = -1;
    const correctOptionRaw = current.correctOptionRaw.trim();
    if (correctOptionRaw) {
      if (/^[A-D]$/i.test(correctOptionRaw)) {
        correctOptionIndex = correctOptionRaw.toUpperCase().charCodeAt(0) - 65;
      } else {
        const matchIdx = current.options.findIndex(o => o && o.toLowerCase() === correctOptionRaw.toLowerCase());
        if (matchIdx !== -1) {
          correctOptionIndex = matchIdx;
        } else {
          const parsedInt = parseInt(correctOptionRaw, 10);
          if (!isNaN(parsedInt) && parsedInt >= 1 && parsedInt <= 4) {
            correctOptionIndex = parsedInt - 1;
          }
        }
      }
    } else {
      errors.push("Respuesta correcta inexistente.");
    }
    
    if (correctOptionIndex === -1 || correctOptionIndex >= 4 || current.options[correctOptionIndex] === undefined || !current.options[correctOptionIndex].trim()) {
      errors.push(`La respuesta correcta indicada (“${correctOptionRaw || 'ninguna'}”) no coincide con ninguna opción válida.`);
    }

    const finalOptions = ["", "", "", ""];
    for (let i = 0; i < 4; i++) {
      if (current.options[i] !== undefined) {
        finalOptions[i] = current.options[i];
      }
    }

    questions.push({
      text: questionText,
      options: finalOptions,
      correctOption: correctOptionIndex,
      timeLimit: current.timeLimit ?? 30,
      points: current.points ?? 1000,
      topic: current.topic ?? "General",
      isValid: errors.length === 0,
      error: errors.length > 0 ? errors.join(" ") : undefined
    });

    current = { textLines: [], options: [], correctOptionRaw: "" };
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) {
      if (current.textLines.length > 0 && (current.options.length > 0 || current.correctOptionRaw)) {
        pushCurrent();
      }
      continue;
    }

    const isExplicitPreguntaHeader = /^pregunta[\s.:-]+/i.test(line) || line.toLowerCase() === "pregunta:";
    const numberedPrefixMatch = line.match(/^(\d+)[\s).:\]-]+(.*)$/);
    const startsWithNumber = !!numberedPrefixMatch;
    const hasOptionsOrAnswer = current.options.length > 0 || !!current.correctOptionRaw;
    
    if (isExplicitPreguntaHeader || (hasOptionsOrAnswer && startsWithNumber)) {
      pushCurrent();
      if (isExplicitPreguntaHeader) {
        const payload = line.replace(/^pregunta[\s.:-]+/i, "").trim();
        if (payload) {
          current.textLines.push(sanitize(payload));
        }
        continue;
      }
    }

    // Match option: A) CO2 or A. CO2
    const optionMatch = line.match(/^\s*([A-Da-d])[\s).:\]-]+(.*)$/);
    if (optionMatch) {
      const letter = optionMatch[1].toUpperCase();
      const optionVal = sanitize(optionMatch[2]);
      const idx = letter.charCodeAt(0) - 65;
      current.options[idx] = optionVal;
      continue;
    }

    // Match metadata fields
    const answerMatch = line.match(/^(?:Respuesta|Correcta|Ans|Answer|Respuesta correcta|Solución)[\s.:-]+(.*)$/i);
    if (answerMatch) {
      current.correctOptionRaw = sanitize(answerMatch[1]);
      continue;
    }

    const timerMatch = line.match(/^(?:Tiempo|Time|Límite)[\s.:-]+(\d+)/i);
    if (timerMatch) {
      current.timeLimit = parseInt(timerMatch[1], 10);
      continue;
    }

    const pointsMatch = line.match(/^(?:Puntos|Points|Valor)[\s.:-]+(\d+)/i);
    if (pointsMatch) {
      current.points = parseInt(pointsMatch[1], 10);
      continue;
    }

    const topicMatch = line.match(/^(?:Tema|Topic|Category|Categoría|Materia|Eje)[\s.:-]+(.*)$/i);
    if (topicMatch) {
      current.topic = sanitize(topicMatch[1]);
      continue;
    }

    // Accumulate question description text
    if (current.options.length === 0 && !current.correctOptionRaw) {
      let cleanLine = line;
      if (startsWithNumber && numberedPrefixMatch) {
        cleanLine = numberedPrefixMatch[2];
      }
      if (cleanLine) {
        current.textLines.push(sanitize(cleanLine));
      }
    }
  }

  pushCurrent();
  return questions;
}

function parseExamQuestionsText(text: string, sanitize: (val: any) => string): any[] {
  const normalized = text.replace(/\r\n/g, "\n");
  const blocks = normalized.split(/\n\s*\n+/);
  const result: any[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const lines = trimmed.split("\n").map(l => l.trim()).filter(Boolean);
    let type: 'multiple_choice' | 'true_false' | 'short_answer' = 'multiple_choice';
    let questionText = "";
    const options: string[] = ["", "", "", ""];
    let correctOption = 0;
    let correctShortAnswer = "";
    let feedback = "";
    let points = 1;
    let topic = "General";
    let alternatives: string[] = [];

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.startsWith("tipo:")) {
        const t = sanitize(line.slice(5)).toLowerCase();
        if (t.includes("verdadero") || t.includes("falso") || t.includes("t/f") || t.includes("tf")) {
          type = 'true_false';
          options[0] = "Verdadero";
          options[1] = "Falso";
        } else if (t.includes("corta") || t.includes("breve") || t.includes("short")) {
          type = 'short_answer';
        }
      } else if (lower.startsWith("pregunta:")) {
        questionText = sanitize(line.slice(9));
      } else if (lower.match(/^\s*([a-d])[\s).:\]-]+(.*)$/i) && type === 'multiple_choice') {
        const optionMatch = line.match(/^\s*([a-d])[\s).:\]-]+(.*)$/i);
        if (optionMatch) {
          const letter = optionMatch[1].toUpperCase();
          const optionVal = sanitize(optionMatch[2]);
          const idx = letter.charCodeAt(0) - 65;
          options[idx] = optionVal;
        }
      } else if (lower.startsWith("respuesta:")) {
        const respVal = sanitize(line.slice(10));
        if (type === 'multiple_choice') {
          if (/^[A-D]$/i.test(respVal)) {
            correctOption = respVal.toUpperCase().charCodeAt(0) - 65;
          } else {
            const index = options.findIndex(o => o.toLowerCase() === respVal.toLowerCase());
            if (index !== -1) correctOption = index;
          }
        } else if (type === 'true_false') {
          const isTrue = respVal.toLowerCase().startsWith("v") || respVal.toLowerCase().startsWith("t") || respVal.toLowerCase() === "verdadero" || respVal.toLowerCase() === "true" || respVal === "0";
          correctOption = isTrue ? 0 : 1;
        } else {
          correctShortAnswer = respVal;
          options[0] = respVal;
          correctOption = 0;
        }
      } else if (lower.startsWith("alternativas:")) {
        const altRow = sanitize(line.slice(13));
        alternatives = altRow.split(",").map(a => a.trim()).filter(Boolean);
      } else if (lower.startsWith("retroalimentacion:") || lower.startsWith("retroalimentación:") || lower.startsWith("feedback:") || lower.startsWith("explicacion:") || lower.startsWith("explicación:")) {
        const idxColon = line.indexOf(":");
        feedback = sanitize(line.slice(idxColon + 1));
      } else if (lower.startsWith("puntos:")) {
        points = parseInt(line.slice(7).trim(), 10) || 1;
      } else if (lower.startsWith("tema:") || lower.startsWith("topic:")) {
        topic = sanitize(line.slice(5));
      }
    }

    if (!questionText) continue;

    result.push({
      id: "q_item_" + Math.random().toString(36).substr(2, 9),
      text: questionText,
      options,
      correctOption,
      timeLimit: 20,
      points,
      topic,
      type,
      feedback,
      correctShortAnswer,
      alternatives,
      isValid: true
    });
  }
  return result;
}

function parseExamSpreadsheet(rows: any[][], sanitize: (val: any) => string): any[] {
  const result: any[] = [];
  if (rows.length < 2) return [];
  
  const headers = rows[0].map(h => String(h).trim().toLowerCase());
  const idxTipo = headers.findIndex(h => h.includes("tipo"));
  const idxPregunta = headers.findIndex(h => h.includes("pregunta") || h.includes("enunciado"));
  const idxA = headers.findIndex(h => h.includes("opción a") || h.includes("opcion a"));
  const idxB = headers.findIndex(h => h.includes("opción b") || h.includes("opcion b"));
  const idxC = headers.findIndex(h => h.includes("opción c") || h.includes("opcion c"));
  const idxD = headers.findIndex(h => h.includes("opción d") || h.includes("opcion d"));
  const idxRespuesta = headers.findIndex(h => h.includes("respuesta") || h.includes("correcta"));
  const idxAlts = headers.findIndex(h => h.includes("alternativa") || h.includes("alts"));
  const idxPuntos = headers.findIndex(h => h.includes("puntos") || h.includes("pts"));
  const idxTema = headers.findIndex(h => h.includes("tema") || h.includes("topic"));
  const idxFeedback = headers.findIndex(h => h.includes("retro") || h.includes("feedback") || h.includes("explicacion") || h.includes("explicación"));

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || !row[idxPregunta]) continue;
    
    const tipoRaw = idxTipo !== -1 ? sanitize(row[idxTipo]).toLowerCase() : "";
    let type: 'multiple_choice' | 'true_false' | 'short_answer' = 'multiple_choice';
    if (tipoRaw.includes("verdadero") || tipoRaw.includes("falso") || tipoRaw.includes("t/f") || tipoRaw.includes("tf")) {
      type = 'true_false';
    } else if (tipoRaw.includes("corta") || tipoRaw.includes("breve") || tipoRaw.includes("short") || tipoRaw.includes("escribir")) {
      type = 'short_answer';
    }

    const text = sanitize(row[idxPregunta]);
    if (!text) continue;

    const optA = idxA !== -1 ? sanitize(row[idxA]) : "";
    const optB = idxB !== -1 ? sanitize(row[idxB]) : "";
    const optC = idxC !== -1 ? sanitize(row[idxC]) : "";
    const optD = idxD !== -1 ? sanitize(row[idxD]) : "";

    const finalOptions = [optA, optB, optC, optD];
    
    const respRaw = idxRespuesta !== -1 ? sanitize(row[idxRespuesta]) : "";
    let correctOption = 0;
    let correctShortAnswer = "";
    
    if (type === 'multiple_choice') {
      if (/^[A-D]$/i.test(respRaw)) {
        correctOption = respRaw.toUpperCase().charCodeAt(0) - 65;
      } else {
        const foundIdx = finalOptions.findIndex(o => o && o.toLowerCase() === respRaw.toLowerCase());
        if (foundIdx !== -1) correctOption = foundIdx;
      }
    } else if (type === 'true_false') {
      const isTrue = respRaw.toLowerCase().startsWith("v") || respRaw.toLowerCase().startsWith("t") || respRaw.toLowerCase() === "verdadero" || respRaw.toLowerCase() === "true" || respRaw === "0";
      correctOption = isTrue ? 0 : 1;
      finalOptions[0] = "Verdadero";
      finalOptions[1] = "Falso";
      finalOptions[2] = "";
      finalOptions[3] = "";
    } else {
      correctShortAnswer = respRaw;
      finalOptions[0] = respRaw;
      finalOptions[1] = "";
      finalOptions[2] = "";
      finalOptions[3] = "";
      correctOption = 0;
    }

    const points = idxPuntos !== -1 ? parseInt(row[idxPuntos], 10) || 1 : 1;
    const topic = idxTema !== -1 ? sanitize(row[idxTema]) : "General";
    const feedback = idxFeedback !== -1 ? sanitize(row[idxFeedback]) : "";
    const altsStr = idxAlts !== -1 ? sanitize(row[idxAlts]) : "";
    const alternatives = altsStr.split(",").map(t => t.trim()).filter(Boolean);

    result.push({
      id: "q_item_" + Math.random().toString(36).substr(2, 9),
      text,
      options: finalOptions,
      correctOption,
      timeLimit: 20,
      points,
      topic,
      type,
      feedback,
      correctShortAnswer,
      alternatives,
      isValid: true
    });
  }
  return result;
}

function parseMexicanosQuestionsText(text: string, sanitize: (val: any) => string): any[] {
  const normalized = text.replace(/\r\n/g, "\n");
  const blocks = normalized.split(/\n\s*\n+/);
  const result: any[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const lines = trimmed.split("\n").map(l => l.trim()).filter(Boolean);
    let questionText = "";
    const options: string[] = [];
    let topic = "General";
    let round = 1;

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.startsWith("pregunta:")) {
        questionText = sanitize(line.slice(9));
      } else if (lower.startsWith("respuesta:")) {
        options.push(sanitize(line.slice(10)));
      } else if (lower.startsWith("tema:") || lower.startsWith("topic:")) {
        topic = sanitize(line.slice(5));
      } else if (lower.startsWith("ronda:") || lower.startsWith("round:")) {
        const rIdx = line.indexOf(":");
        round = parseInt(line.slice(rIdx + 1).trim(), 10) || 1;
      }
    }

    if (!questionText || options.length === 0) continue;

    result.push({
      id: "q_item_" + Math.random().toString(36).substr(2, 9),
      text: questionText,
      options,
      correctOption: 0,
      timeLimit: 20,
      topic,
      round,
      isValid: true
    });
  }
  return result;
}

function parseMexicanosSpreadsheet(rows: any[][], sanitize: (val: any) => string): any[] {
  const result: any[] = [];
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => String(h).trim().toLowerCase());
  const idxPregunta = headers.findIndex(h => h.includes("pregunta"));
  const idxTema = headers.findIndex(h => h.includes("tema") || h.includes("topic"));
  const idxRonda = headers.findIndex(h => h.includes("ronda") || h.includes("round"));
  
  const respIndices: number[] = [];
  for (let c = 0; c < headers.length; c++) {
    if (headers[c].includes("respuesta") || headers[c].startsWith("resp")) {
      respIndices.push(c);
    }
  }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || !row[idxPregunta]) continue;

    const text = sanitize(row[idxPregunta]);
    if (!text) continue;

    const options: string[] = [];
    respIndices.forEach(idx => {
      if (row[idx]) {
        options.push(sanitize(row[idx]));
      }
    });

    if (options.length === 0) continue;

    const topic = idxTema !== -1 ? sanitize(row[idxTema]) : "General";
    const round = idxRonda !== -1 ? parseInt(row[idxRonda], 10) || 1 : 1;

    result.push({
      id: "q_item_" + Math.random().toString(36).substr(2, 9),
      text,
      options,
      correctOption: 0,
      timeLimit: 20,
      topic,
      round,
      isValid: true
    });
  }
  return result;
}

function parseJeopardyQuestionsText(text: string, sanitize: (val: any) => string): any[] {
  const normalized = text.replace(/\r\n/g, "\n");
  const blocks = normalized.split(/\n\s*\n+/);
  const result: any[] = [];
  let currentCategory = "General";

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const lines = trimmed.split("\n").map(l => l.trim()).filter(Boolean);
    
    if (lines.length === 1 && lines[0].toLowerCase().startsWith("categoria:")) {
      currentCategory = sanitize(lines[0].slice(10));
      continue;
    }

    let val = 200;
    let questionText = "";
    let answerText = "";
    let hintText = "";

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.startsWith("categoria:") || lower.startsWith("categoría:")) {
        currentCategory = sanitize(line.slice(10));
      } else if (lower.startsWith("valor:")) {
        val = parseInt(line.slice(6).trim(), 10) || 200;
      } else if (lower.startsWith("pregunta:")) {
        questionText = sanitize(line.slice(9));
      } else if (lower.startsWith("respuesta:")) {
        answerText = sanitize(line.slice(10));
      } else if (lower.startsWith("pista:")) {
        hintText = sanitize(line.slice(6));
      }
    }

    if (!questionText && !answerText) continue;

    result.push({
      id: "q_item_" + Math.random().toString(36).substr(2, 9),
      text: questionText,
      options: [answerText, "", "", ""],
      correctOption: 0,
      timeLimit: 20,
      topic: currentCategory,
      points: val,
      value: val,
      hint: hintText,
      isValid: true
    });
  }
  return result;
}

function parseJeopardySpreadsheet(rows: any[][], sanitize: (val: any) => string): any[] {
  const result: any[] = [];
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => String(h).trim().toLowerCase());
  const idxCat = headers.findIndex(h => h.includes("categor") || h.includes("topic"));
  const idxVal = headers.findIndex(h => h.includes("valor") || h.includes("puntos") || h.includes("value") || h.includes("pts"));
  const idxPregunta = headers.findIndex(h => h.includes("pregunta") || h.includes("clue") || h.includes("q"));
  const idxRespuesta = headers.findIndex(h => h.includes("respuesta") || h.includes("ans") || h.includes("answer"));
  const idxPista = headers.findIndex(h => h.includes("pista") || h.includes("hint"));

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || !row[idxPregunta]) continue;

    const text = sanitize(row[idxPregunta]);
    if (!text) continue;

    const category = idxCat !== -1 ? sanitize(row[idxCat]) : "General";
    const val = idxVal !== -1 ? parseInt(row[idxVal], 10) || 200 : 200;
    const answer = idxRespuesta !== -1 ? sanitize(row[idxRespuesta]) : "";
    const hint = idxPista !== -1 ? sanitize(row[idxPista]) : "";

    result.push({
      id: "q_item_" + Math.random().toString(36).substr(2, 9),
      text,
      options: [answer, "", "", ""],
      correctOption: 0,
      timeLimit: 20,
      topic: category,
      points: val,
      value: val,
      hint,
      isValid: true
    });
  }
  return result;
}

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

// Global active Pictionary rooms storage
const pictionarySessions: Record<string, any> = {};

// Global active Horse Race rooms storage
const horseRaceSessions: Record<string, any> = {};

// Global active Headbanz rooms storage
const headbanzSessions: Record<string, any> = {};

// Global active Conecta 4 rooms storage
const conecta4Sessions: Record<string, any> = {};

// Global active Buzzer rooms storage
interface ServerBuzzerPress {
  playerId: string;
  playerName: string;
  teamId: string | null;
  teamName: string | null;
  gameMode: string;
  timestamp: number;
  position: number;
  reactionTime: number;
}

interface ServerBuzzerSession {
  pin: string;
  startTime: number;
  isOpen: boolean;
  presses: ServerBuzzerPress[];
  pressedPlayers: Set<string>;
}

const buzzerSessions: Record<string, ServerBuzzerSession> = {};

// Real-time server timers control
function clearRoomInterval(pin: string): void {
  if (timerIntervals[pin]) {
    clearInterval(timerIntervals[pin]);
    delete timerIntervals[pin];
  }
}

// Websocket Events
io.on("connection", (socket: Socket) => {
  // ==========================================
  // PICTIONARY SOCKET.IO ACTIONS (Prepmaster 2.3.0)
  // ==========================================

  socket.on("pictionary:create-room", ({ pin, config, bankName }: { pin: string; config: any; bankName: string }) => {
    socket.join(`game:${pin}`);
    socket.join(`host:${pin}`);
    
    pictionarySessions[pin] = {
      pin,
      bankName,
      config,
      players: {}, // socketId -> Player
      scores: {},  // teamId -> score
      wordsDetailed: [], // detailed records of words used
      status: "lobby",
      currentWord: null,
      currentDrawer: null,
      currentTeamIndex: 0,
      currentTeamId: null,
      drawerIndexMap: {}, // teamId -> player drawing index
      roundNumber: 1,
      totalWordsCount: config.totalWords || 5,
      wordsUsed: []
    };

    io.to(`game:${pin}`).emit("pictionary:room-created", {
      pin,
      config,
      bankName,
      status: "lobby"
    });
  });

  socket.on("pictionary:join-team", ({ pin, name, avatarId, teamId, playerId }: { pin: string; name: string; avatarId?: string; teamId: string; playerId?: string }) => {
    socket.join(`game:${pin}`);
    
    let session = pictionarySessions[pin];
    if (!session) {
      socket.emit("pictionary:error", { message: "Sesión de Pictionary no encontrada" });
      return;
    }

    const pId = playerId || socket.id;
    const player = {
      id: socket.id,
      playerId: pId,
      name,
      avatarId: avatarId || "cult_mariachi",
      teamId,
      isDrawer: false
    };

    session.players[socket.id] = player;

    // Send success to player
    socket.emit("pictionary:join-success", {
      player,
      pin,
      config: session.config,
      bankName: session.bankName,
      status: session.status
    });

    // Notify all in room
    io.to(`game:${pin}`).emit("pictionary:player-list", {
      players: Object.values(session.players)
    });
  });

  socket.on("pictionary:set-team-size", ({ pin, teamId, size }: { pin: string; teamId: string; size: number }) => {
    const session = pictionarySessions[pin];
    if (!session) return;

    const team = session.config.teams.find((t: any) => t.id === teamId);
    if (team) {
      team.declaredMembers = size;
    }

    io.to(`game:${pin}`).emit("pictionary:team-sizes-updated", {
      teams: session.config.teams
    });
  });

  socket.on("pictionary:start-game", ({ pin, words }: { pin: string; words: any[] }) => {
    const session = pictionarySessions[pin];
    if (!session) return;

    session.status = "playing";
    session.wordsPool = words;
    session.currentWordIndex = 0;
    session.scores = {};
    session.config.teams.forEach((t: any) => {
      session.scores[t.id] = 0;
    });

    io.to(`game:${pin}`).emit("pictionary:game-started", {
      status: "playing",
      scores: session.scores,
      teams: session.config.teams
    });
  });

  socket.on("pictionary:drawing-start", ({ pin, x, y, color, size }: any) => {
    socket.to(`game:${pin}`).emit("pictionary:drawing-start", { x, y, color, size, senderId: socket.id });
  });

  socket.on("pictionary:drawing-update", ({ pin, x, y }: any) => {
    socket.to(`game:${pin}`).emit("pictionary:drawing-update", { x, y, senderId: socket.id });
  });

  socket.on("pictionary:drawing-clear", ({ pin }: any) => {
    io.to(`game:${pin}`).emit("pictionary:drawing-clear");
  });

  socket.on("pictionary:correct", ({ pin, wordResult }: { pin: string; wordResult: any }) => {
    const session = pictionarySessions[pin];
    if (!session) return;

    const teamId = wordResult.teamId;
    const points = wordResult.pointsEarned || 1;
    session.scores[teamId] = (session.scores[teamId] || 0) + points;
    session.wordsDetailed.push(wordResult);

    io.to(`game:${pin}`).emit("pictionary:round-outcome", {
      outcome: "correct",
      scores: session.scores,
      wordResult
    });
  });

  socket.on("pictionary:skip", ({ pin, wordResult }: { pin: string; wordResult: any }) => {
    const session = pictionarySessions[pin];
    if (!session) return;

    session.wordsDetailed.push(wordResult);

    io.to(`game:${pin}`).emit("pictionary:round-outcome", {
      outcome: "skipped",
      scores: session.scores,
      wordResult
    });
  });

  socket.on("pictionary:show-hint", ({ pin, hint }: { pin: string; hint: string }) => {
    io.to(`game:${pin}`).emit("pictionary:hint-shown", { hint });
  });

  socket.on("pictionary:next-turn", ({ pin, turnState }: { pin: string; turnState: any }) => {
    const session = pictionarySessions[pin];
    if (!session) return;

    // Update player drawer statuses
    Object.values(session.players).forEach((p: any) => {
      p.isDrawer = (p.name === turnState.drawerName && p.teamId === turnState.teamId);
    });

    io.to(`game:${pin}`).emit("pictionary:turn-updated", {
      turnState,
      players: Object.values(session.players)
    });
  });

  socket.on("pictionary:end-game", ({ pin, finalResult }: { pin: string; finalResult: any }) => {
    const session = pictionarySessions[pin];
    if (!session) return;

    session.status = "ended";
    savePictionaryHistory(finalResult);

    io.to(`game:${pin}`).emit("pictionary:game-ended", {
      finalResult
    });
    
    setTimeout(() => {
      delete pictionarySessions[pin];
    }, 10 * 60 * 1000);
  });

  // ==========================================
  // HORSE RACE SOCKET.IO ACTIONS (Prepmaster v2.4.0)
  // ==========================================

  socket.on("horse:create-room", ({ pin, config, bankTitle, questions }: { pin: string; config: any; bankTitle: string; questions: any[] }) => {
    socket.join(`game:${pin}`);
    socket.join(`host:${pin}`);
    
    horseRaceSessions[pin] = {
      pin,
      config,
      bankTitle,
      questions,
      players: {},
      teams: config.teams || [],
      turnState: {
        questionIndex: 0,
        activeQuestion: null,
        timer: 0,
        totalQuestions: questions.length,
        answeredCount: 0,
        showAnswers: false,
      },
      answersReceived: {}
    };

    io.to(`game:${pin}`).emit("horse:room-created", {
      pin,
      config,
      teams: config.teams
    });
  });

  socket.on("horse:join", ({ pin, name, avatarId, teamId, playerId }: { pin: string; name: string; avatarId?: string; teamId: string; playerId?: string }) => {
    const session = horseRaceSessions[pin];
    if (!session) {
      socket.emit("horse:error", { message: "Sesión de Carrera de Caballos no encontrada" });
      return;
    }
    
    socket.join(`game:${pin}`);
    const actualPlayerId = playerId || socket.id;
    
    session.players[socket.id] = {
      id: socket.id,
      playerId: actualPlayerId,
      name,
      avatarId: avatarId || "cult_mariachi",
      teamId,
      score: 0,
      horsePosition: 0,
    };

    // Update members count per team if it is team mode
    if (session.config.gameMode !== "all_vs_all") {
      session.teams = session.teams.map((t: any) => {
        const count = Object.values(session.players).filter((p: any) => p.teamId === t.id).length;
        return { ...t, membersCount: count };
      });
    }

    socket.emit("horse:join-success", {
      player: session.players[socket.id],
      pin,
      config: session.config,
      teams: session.teams
    });

    io.to(`game:${pin}`).emit("horse:player-list", {
      players: Object.values(session.players),
      teams: session.teams
    });
  });

  socket.on("horse:start-game", ({ pin }: { pin: string }) => {
    const session = horseRaceSessions[pin];
    if (!session) return;

    session.turnState.questionIndex = 0;
    const firstQ = session.questions[0];
    if (firstQ) {
      session.turnState.activeQuestion = {
        text: firstQ.text,
        options: firstQ.options,
        difficulty: firstQ.difficulty || "medio",
      };
      session.turnState.timer = firstQ.timeLimit || 20;
    }
    session.turnState.showAnswers = false;
    session.turnState.answeredCount = 0;
    session.answersReceived = {};

    io.to(`game:${pin}`).emit("horse:game-started", {
      turnState: session.turnState,
      teams: session.teams,
      players: Object.values(session.players)
    });
  });

  socket.on("horse:submit-answer", ({ pin, optionIndex }: { pin: string; optionIndex: number }) => {
    const session = horseRaceSessions[pin];
    if (!session) return;
    const player = session.players[socket.id];
    if (!player) return;

    session.answersReceived[player.playerId || socket.id] = optionIndex;
    session.turnState.answeredCount = Object.keys(session.answersReceived).length;

    io.to(`game:${pin}`).emit("horse:answer-received", {
      answeredCount: session.turnState.answeredCount,
      playerId: player.playerId || socket.id
    });
  });

  socket.on("horse:powerup", ({ pin, powerUpType, targetTeamId, targetPlayerId }: any) => {
    const session = horseRaceSessions[pin];
    if (!session) return;

    io.to(`game:${pin}`).emit("horse:powerup-triggered", {
      powerUpType,
      targetTeamId,
      targetPlayerId,
      senderSocketId: socket.id
    });
  });

  socket.on("horse:advance", ({ pin, teams, players }: { pin: string; teams?: any[]; players?: any[] }) => {
    const session = horseRaceSessions[pin];
    if (!session) return;

    if (teams) session.teams = teams;
    if (players) {
      players.forEach((p: any) => {
        const found = Object.values(session.players).find((sp: any) => sp.playerId === p.playerId || sp.id === p.id) as any;
        if (found) {
          found.horsePosition = p.horsePosition;
          found.score = p.score;
        }
      });
    }

    io.to(`game:${pin}`).emit("horse:positions-updated", {
      teams: session.teams,
      players: Object.values(session.players)
    });
  });

  socket.on("horse:timer-tick", ({ pin, timer }: { pin: string; timer: number }) => {
    const session = horseRaceSessions[pin];
    if (!session) return;
    session.turnState.timer = timer;
    io.to(`game:${pin}`).emit("horse:timer-updated", { timer });
  });

  socket.on("horse:show-answers", ({ pin, answers }: { pin: string; answers: any }) => {
    const session = horseRaceSessions[pin];
    if (!session) return;
    session.turnState.showAnswers = true;
    io.to(`game:${pin}`).emit("horse:answers-shown", { answers });
  });

  socket.on("horse:next-question", ({ pin }: { pin: string }) => {
    const session = horseRaceSessions[pin];
    if (!session) return;

    const nextIndex = session.turnState.questionIndex + 1;
    if (nextIndex >= session.questions.length) {
      io.to(`game:${pin}`).emit("horse:game-over-preview");
      return;
    }

    session.turnState.questionIndex = nextIndex;
    const q = session.questions[nextIndex];
    if (q) {
      session.turnState.activeQuestion = {
        text: q.text,
        options: q.options,
        difficulty: q.difficulty || "medio",
      };
      session.turnState.timer = q.timeLimit || 20;
    }
    session.turnState.showAnswers = false;
    session.turnState.answeredCount = 0;
    session.answersReceived = {};

    io.to(`game:${pin}`).emit("horse:turn-updated", {
      turnState: session.turnState,
      teams: session.teams
    });
  });

  socket.on("horse:end-game", ({ pin, finalResult }: { pin: string; finalResult: any }) => {
    const session = horseRaceSessions[pin];
    if (!session) return;

    session.status = "ended";
    saveHorseRaceHistory(finalResult);

    io.to(`game:${pin}`).emit("horse:game-ended", {
      finalResult
    });

    setTimeout(() => {
      delete horseRaceSessions[pin];
    }, 10 * 60 * 1000);
  });

  // Generic educational game message forwarding
  socket.on("game:host-message", (data: any) => {
    const { pin, event, ...payload } = data;
    
    // Support Prepmaster Live 2.1.3: Store exam status & questions on starting
    if (event === "exam:start") {
      const session = activeSessions[pin];
      if (session) {
        (session as any).examQuestions = payload.questions || [];
        (session as any).examStarted = true;
        (session as any).examStatus = "ongoing";
        (session as any).timeLimitMinutes = payload.timeLimitMinutes || null;
        (session as any).examStartTime = Date.now();
        if (!(session as any).examProgress) {
          (session as any).examProgress = {};
        }
      }
    } else if (event === "exam:ended") {
      const session = activeSessions[pin];
      if (session) {
        (session as any).examStatus = "completed";
      }
    }
    
    io.to(`game:${pin}`).emit(event, payload);
  });
  
  socket.on("game:player-message", (data: any) => {
    const { pin, event, ...payload } = data;
    
    // Support Prepmaster Live 2.1.3: Save student progress & solutions on backend in real-time
    if (event === "exam:player-progress" && pin) {
      const session = activeSessions[pin];
      if (session) {
        if (!(session as any).examProgress) {
          (session as any).examProgress = {};
        }
        
        const studentPlayerId = payload.playerId || payload.socketId || socket.id;
        const solvedCount = payload.solvedCount || 0;
        const correctCount = payload.correctCount || 0;
        const incorrectCount = payload.incorrectCount || 0;
        const completed = !!payload.completed;
        const timeTakenSeconds = payload.timeTakenSeconds || 0;
        const answers = payload.answers || {};
        
        let status = "En progreso";
        if (completed) {
          status = "Terminado";
        } else if (solvedCount === 0) {
          status = "Pendiente";
        }
        
        const totalQs = session.questions ? session.questions.length : (payload.totalQuestions || 0);
        const percentage = totalQs > 0 ? Math.round((correctCount / totalQs) * 100) : 0;
        
        (session as any).examProgress[studentPlayerId] = {
          playerId: studentPlayerId,
          socketId: socket.id,
          name: payload.name || (session.players[socket.id] ? session.players[socket.id].name : "Alumno"),
          solvedCount,
          correctCount,
          incorrectCount,
          percentage,
          completed,
          timeTakenSeconds,
          status,
          answers,
          autoSubmitted: !!payload.autoSubmitted,
          lastUpdated: Date.now()
        };

        const playerObj = Object.values(session.players).find(p => p.playerId === studentPlayerId) || session.players[socket.id];
        if (playerObj) {
          playerObj.score = percentage;
          playerObj.answeredThisQuestion = completed;
        }

        io.to(`host:${pin}`).emit(event, { 
          ...payload, 
          socketId: socket.id,
          playerId: studentPlayerId,
          status,
          percentage,
          autoSubmitted: !!payload.autoSubmitted
        });
        return;
      }
    } else if (event === "exam:register-event" && pin) {
      const session = activeSessions[pin];
      if (session) {
        if (!(session as any).examProgress) {
          (session as any).examProgress = {};
        }
        if (!(session as any).examEvents) {
          (session as any).examEvents = [];
        }
        
        const studentPlayerId = payload.playerId || payload.socketId || socket.id;
        const studentName = payload.name || (session.players[socket.id] ? session.players[socket.id].name : "Alumno");
        const eventType = payload.eventType; // "Cambio de pestaña", "Pérdida de foco", "Recarga o cierre"
        const description = payload.description || "";
        const currentQuestionIndex = payload.currentQuestionIndex ?? -1;
        
        let reactivoLabel = "N/A";
        if (currentQuestionIndex !== -1) {
          reactivoLabel = `Reactivo ${currentQuestionIndex + 1}`;
        }
        
        if (!(session as any).examProgress[studentPlayerId]) {
          (session as any).examProgress[studentPlayerId] = {
            playerId: studentPlayerId,
            socketId: socket.id,
            name: studentName,
            solvedCount: 0,
            correctCount: 0,
            incorrectCount: 0,
            percentage: 0,
            completed: false,
            timeTakenSeconds: 0,
            status: "En progreso",
            answers: {},
            lastUpdated: Date.now()
          };
        }
        
        const prog = (session as any).examProgress[studentPlayerId];
        prog.tabChangeCount = (prog.tabChangeCount || 0) + 1;
        prog.lastEventName = eventType;
        prog.lastEventTime = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        prog.examStatus = prog.status || "En progreso";
        
        const newEvent = {
          alumno: studentName,
          playerId: studentPlayerId,
          evento: eventType,
          descripcion: description,
          fechaHora: new Date().toLocaleDateString('es-MX') + " " + prog.lastEventTime,
          reactivoActual: reactivoLabel,
          examStatus: prog.status || "En progreso"
        };
        
        (session as any).examEvents.push(newEvent);
        
        // Send to host in real-time
        io.to(`host:${pin}`).emit("exam:event-registered", {
          playerId: studentPlayerId,
          progress: prog,
          newEvent
        });
      }
      return;
    }
    
    io.to(`host:${pin}`).emit(event, { ...payload, socketId: socket.id });
  });

  // Host initializes a session
  socket.on("host:create-session", ({ questionnaireId, gameMode, teams, gameType }: { questionnaireId: string; gameMode?: 'individual' | 'teams'; teams?: Team[]; gameType?: string }) => {
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
    (session as any).gameType = gameType || "quiz_live";

    activeSessions[pin] = session;
    socket.join(`game:${pin}`);
    socket.join(`host:${pin}`);

    socket.emit("session:created", {
      pin,
      title: quiz.title,
      questionsCount: quiz.questions.length,
      players: [],
      gameMode: session.gameMode,
      teams: session.teams,
      gameType: (session as any).gameType
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
      const pictionarySession = pictionarySessions[pin];
      if (pictionarySession) {
        socket.emit("player:join-success", {
          player: {
            id: socket.id,
            playerId: playerId || socket.id,
            name: name,
            avatarId: avatarId || "cult_mariachi",
            score: 0,
            answeredThisQuestion: false,
            streak: 0,
          },
          pin,
          title: "Pictionary Educativo",
          gameMode: "teams",
          gameType: "pictionary",
          teams: pictionarySession.config.teams
        });
        return;
      }
      const horseSession = horseRaceSessions[pin];
      if (horseSession) {
        socket.emit("player:join-success", {
          player: {
            id: socket.id,
            playerId: playerId || socket.id,
            name: name,
            avatarId: avatarId || "cult_mariachi",
            score: 0,
            answeredThisQuestion: false,
            streak: 0,
          },
          pin,
          title: "Carrera de Caballos",
          gameMode: horseSession.config.gameMode === "all_vs_all" ? "individual" : "teams",
          gameType: "horse-race",
          teams: horseSession.teams
        });
        return;
      }
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

      let examState: any = null;
      const isExamMode = (session as any).gameType === "exam_mode" || (session as any).examStarted;
      if (isExamMode) {
        const resolvedPlayerId2 = existingPlayer.playerId || existingPlayer.id || "random_player";
        
        (session as any).examEvents = (session as any).examEvents || [];
        (session as any).examProgress = (session as any).examProgress || {};
        
        if (!(session as any).examProgress[resolvedPlayerId2]) {
          (session as any).examProgress[resolvedPlayerId2] = {
            playerId: resolvedPlayerId2,
            socketId: socket.id,
            name: existingPlayer.name,
            solvedCount: 0,
            correctCount: 0,
            incorrectCount: 0,
            percentage: 0,
            completed: false,
            timeTakenSeconds: 0,
            status: "En progreso",
            answers: {},
            lastUpdated: Date.now()
          };
        }
        
        const prog = (session as any).examProgress[resolvedPlayerId2];
        prog.reconnectCount = (prog.reconnectCount || 0) + 1;
        prog.lastEventName = "Reconexión";
        prog.lastEventTime = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        prog.examStatus = prog.status || "En progreso";
        
        const newEvent = {
          alumno: existingPlayer.name,
          playerId: resolvedPlayerId2,
          evento: "Reconexión",
          descripcion: "El alumno volvió a conectarse al servidor tras una desconexión o recarga.",
          fechaHora: new Date().toLocaleDateString('es-MX') + " " + prog.lastEventTime,
          reactivoActual: "N/A",
          examStatus: prog.status || "En progreso"
        };
        
        (session as any).examEvents.push(newEvent);
        
        io.to(`host:${pin}`).emit("exam:event-registered", {
          playerId: resolvedPlayerId2,
          progress: prog,
          newEvent
        });

        const pProgress = (session as any).examProgress[resolvedPlayerId2];
        if (pProgress) {
          existingPlayer.score = pProgress.percentage || 0;
          existingPlayer.answeredThisQuestion = pProgress.completed || false;
        }
        examState = {
          examQuestions: (session as any).examQuestions || session.questions || [],
          examAnswers: pProgress ? pProgress.answers : {},
          examCompleted: pProgress ? pProgress.completed : false,
          examTimeStart: pProgress ? Date.now() - (pProgress.timeTakenSeconds * 1000) : ((session as any).examStartTime || Date.now()),
          timeLimitMinutes: (session as any).timeLimitMinutes || null,
          solvedCount: pProgress ? pProgress.solvedCount : 0,
          correctCount: pProgress ? pProgress.correctCount : 0,
          incorrectCount: pProgress ? pProgress.incorrectCount : 0,
          percentage: pProgress ? pProgress.percentage : 0,
          timeTakenSeconds: pProgress ? pProgress.timeTakenSeconds : 0,
          status: pProgress ? pProgress.status : "Pendiente",
          autoSubmitted: pProgress ? !!pProgress.autoSubmitted : false
        };
      }

      socket.emit("player:join-success", { 
        player: existingPlayer, 
        pin, 
        title: session.title,
        status: session.status,
        currentQuestionIndex: session.currentQuestionIndex,
        reconnected: true,
        gameMode: session.gameMode || "individual",
        teams: session.teams || [],
        gameType: (session as any).gameType || "quiz_live",
        examState
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

    // If it's a new player but the game is already in progress, deny access (except for Exam Mode)
    if (session.status !== "lobby" && (session as any).gameType !== "exam_mode" && !(session as any).examStarted) {
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

    let examState: any = null;
    const isExamMode = (session as any).gameType === "exam_mode" || (session as any).examStarted;
    if (isExamMode) {
      const pProgress = (session as any).examProgress ? (session as any).examProgress[resolvedPlayerId] : null;
      if (pProgress) {
        player.score = pProgress.percentage || 0;
        player.answeredThisQuestion = pProgress.completed || false;
      }
      examState = {
        examQuestions: (session as any).examQuestions || session.questions || [],
        examAnswers: pProgress ? pProgress.answers : {},
        examCompleted: pProgress ? pProgress.completed : false,
        examTimeStart: pProgress ? Date.now() - (pProgress.timeTakenSeconds * 1000) : ((session as any).examStartTime || Date.now()),
        timeLimitMinutes: (session as any).timeLimitMinutes || null,
        solvedCount: pProgress ? pProgress.solvedCount : 0,
        correctCount: pProgress ? pProgress.correctCount : 0,
        incorrectCount: pProgress ? pProgress.incorrectCount : 0,
        percentage: pProgress ? pProgress.percentage : 0,
        timeTakenSeconds: pProgress ? pProgress.timeTakenSeconds : 0,
        status: pProgress ? pProgress.status : "Pendiente",
        autoSubmitted: pProgress ? !!pProgress.autoSubmitted : false
      };
    }

    socket.emit("player:join-success", { 
      player, 
      pin, 
      title: session.title,
      gameMode: session.gameMode || "individual",
      teams: session.teams || [],
      gameType: (session as any).gameType || "quiz_live",
      examState
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

  // ==========================================
  // HEADBANZ SOCKET.IO ACTIONS (Prepmaster 2.5.0)
  // ==========================================

  socket.on("headbanz:create-room", ({ pin, config, bankName, words }) => {
    socket.join(`game:${pin}`);
    socket.join(`host:${pin}`);
    
    headbanzSessions[pin] = {
      pin,
      bankName,
      config,
      words: words || [],
      players: {},
      currentPlayerIndex: -1,
      currentRound: 1,
      timer: config.timePerTurn || 60,
      status: "lobby",
      conceptsLog: []
    };

    emitHeadbanzState(pin);
  });

  socket.on("headbanz:join", ({ pin, name, avatarId, teamId, playerId }) => {
    socket.join(`game:${pin}`);
    const session = headbanzSessions[pin];
    if (!session) {
      socket.emit("headbanz:error", { message: "La sala no existe." });
      return;
    }

    session.players[socket.id] = {
      id: socket.id,
      playerId: playerId || socket.id,
      name,
      avatarId: avatarId || "cult_mariachi",
      teamId: teamId || "",
      score: 0,
      isReady: true,
      currentWord: undefined,
      currentCategory: undefined,
      currentHint: undefined,
      hintShown: false
    };

    emitHeadbanzState(pin);
  });

  socket.on("headbanz:start", ({ pin }) => {
    const session = headbanzSessions[pin];
    if (!session) return;

    session.status = "playing";
    session.currentRound = 1;
    session.currentPlayerIndex = 0;
    
    assignHeadbanzWords(session);
    startHeadbanzTimer(pin);
    emitHeadbanzState(pin);
  });

  socket.on("headbanz:hint", ({ pin }) => {
    const session = headbanzSessions[pin];
    if (!session) return;

    const playersList = Object.values(session.players);
    if (session.currentPlayerIndex >= 0 && session.currentPlayerIndex < playersList.length) {
      const activePlayer = playersList[session.currentPlayerIndex] as any;
      if (activePlayer) {
        activePlayer.hintShown = true;
        io.to(`game:${pin}`).emit("headbanz:sound", { type: "hint" });
        emitHeadbanzState(pin);
      }
    }
  });

  socket.on("headbanz:correct", ({ pin }) => {
    const session = headbanzSessions[pin];
    if (!session) return;

    const playersList = Object.values(session.players);
    if (session.currentPlayerIndex >= 0 && session.currentPlayerIndex < playersList.length) {
      const activePlayer = playersList[session.currentPlayerIndex] as any;
      if (activePlayer && activePlayer.currentWord) {
        let points = session.config.pointsPerCorrect || 1;
        const wordObj = session.words.find((w: any) => w.concept === activePlayer.currentWord);
        const difficulty = wordObj ? wordObj.difficulty : "medio";
        if (difficulty === "facil") points = 1;
        else if (difficulty === "medio") points = 2;
        else if (difficulty === "dificil") points = 3;

        activePlayer.score += points;
        
        session.conceptsLog.push({
          player: activePlayer.name,
          teamId: activePlayer.teamId,
          concept: activePlayer.currentWord,
          difficulty,
          result: "correcto",
          points,
          timeTaken: session.config.timePerTurn - session.timer
        });

        io.to(`game:${pin}`).emit("headbanz:sound", { type: "correct" });

        const availableWords = session.words.filter((w: any) => 
          !Object.values(session.players).some((p: any) => p.currentWord === w.concept)
        );
        if (availableWords.length > 0) {
          const newWord = availableWords[Math.floor(Math.random() * availableWords.length)];
          activePlayer.currentWord = newWord.concept;
          activePlayer.currentCategory = newWord.category;
          activePlayer.currentHint = newWord.hint;
          activePlayer.hintShown = false;
        } else {
          advanceToNextPlayer(pin);
          return;
        }

        emitHeadbanzState(pin);
      }
    }
  });

  socket.on("headbanz:skip", ({ pin }) => {
    const session = headbanzSessions[pin];
    if (!session) return;

    const playersList = Object.values(session.players);
    if (session.currentPlayerIndex >= 0 && session.currentPlayerIndex < playersList.length) {
      const activePlayer = playersList[session.currentPlayerIndex] as any;
      if (activePlayer && activePlayer.currentWord) {
        const wordObj = session.words.find((w: any) => w.concept === activePlayer.currentWord);
        const difficulty = wordObj ? wordObj.difficulty : "medio";

        session.conceptsLog.push({
          player: activePlayer.name,
          teamId: activePlayer.teamId,
          concept: activePlayer.currentWord,
          difficulty,
          result: "saltado",
          points: 0,
          timeTaken: session.config.timePerTurn - session.timer
        });

        io.to(`game:${pin}`).emit("headbanz:sound", { type: "incorrect" });

        const availableWords = session.words.filter((w: any) => 
          !Object.values(session.players).some((p: any) => p.currentWord === w.concept)
        );
        if (availableWords.length > 0) {
          const newWord = availableWords[Math.floor(Math.random() * availableWords.length)];
          activePlayer.currentWord = newWord.concept;
          activePlayer.currentCategory = newWord.category;
          activePlayer.currentHint = newWord.hint;
          activePlayer.hintShown = false;
        } else {
          advanceToNextPlayer(pin);
          return;
        }

        emitHeadbanzState(pin);
      }
    }
  });

  socket.on("headbanz:end", ({ pin }) => {
    const session = headbanzSessions[pin];
    if (!session) return;

    endHeadbanzGame(pin);
  });

  socket.on("headbanz:feedback", ({ pin, feedback }: { pin: string; feedback: "yes" | "no" | "maybe" | "close" }) => {
    io.to(`game:${pin}`).emit("headbanz:feedback-received", { feedback, senderId: socket.id });
  });

  // ==========================================
  // UNIVERSAL BUZZER SOCKET.IO ACTIONS (Prepmaster 2.6.0)
  // ==========================================

  socket.on("buzzer:start", ({ pin, gameMode }: { pin: string; gameMode: string }) => {
    buzzerSessions[pin] = {
      pin,
      startTime: Date.now(),
      isOpen: true,
      presses: [],
      pressedPlayers: new Set<string>()
    };
    io.to(`game:${pin}`).emit("buzzer:started", { pin, gameMode });
    io.to(`host:${pin}`).emit("buzzer:started", { pin, gameMode });
    io.to(`game:${pin}`).emit("buzzer:sound", { type: "start" });
    io.to(`host:${pin}`).emit("buzzer:sound", { type: "start" });
  });

  socket.on("buzzer:press", ({ pin, playerId, playerName, teamId, teamName, gameMode }) => {
    const session = buzzerSessions[pin];
    if (!session || !session.isOpen) return;

    if (session.pressedPlayers.has(playerId)) return;
    session.pressedPlayers.add(playerId);

    const now = Date.now();
    const reactionTime = (now - session.startTime) / 1000;
    const position = session.presses.length + 1;

    const press: ServerBuzzerPress = {
      playerId,
      playerName,
      teamId: teamId || null,
      teamName: teamName || null,
      gameMode,
      timestamp: now,
      position,
      reactionTime
    };

    session.presses.push(press);

    // Save to SQLite buzzer_history
    try {
      const uuid = Math.random().toString(36).substring(2) + Date.now();
      const insert = db.prepare(`
        INSERT INTO buzzer_history (id, playerId, playerName, teamId, teamName, gameMode, timestamp, position, reactionTime, date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insert.run(
        uuid,
        playerId,
        playerName,
        teamId || null,
        teamName || null,
        gameMode,
        now,
        position,
        reactionTime,
        new Date().toISOString()
      );
    } catch (e) {
      console.error("Error saving buzzer to SQLite:", e);
    }

    io.to(`host:${pin}`).emit("buzzer:results", { pin, presses: session.presses });
    socket.emit("buzzer:pressed-ack", { position, reactionTime });

    if (position === 1) {
      io.to(`host:${pin}`).emit("buzzer:sound", { type: "victory" });
      io.to(`game:${pin}`).emit("buzzer:sound", { type: "victory" });
    }
  });

  socket.on("buzzer:close", ({ pin }: { pin: string }) => {
    const session = buzzerSessions[pin];
    if (session) {
      session.isOpen = false;
    }
    io.to(`game:${pin}`).emit("buzzer:closed", { pin });
    io.to(`host:${pin}`).emit("buzzer:closed", { pin });
    io.to(`game:${pin}`).emit("buzzer:sound", { type: "close" });
    io.to(`host:${pin}`).emit("buzzer:sound", { type: "close" });
  });

  socket.on("buzzer:reset", ({ pin }: { pin: string }) => {
    if (buzzerSessions[pin]) {
      delete buzzerSessions[pin];
    }
    io.to(`game:${pin}`).emit("buzzer:resetted", { pin });
    io.to(`host:${pin}`).emit("buzzer:resetted", { pin });
  });

  // ==========================================
  // CONECTA 4 EDUCATIVO SOCKET.IO ACTIONS (Prepmaster 2.5.0)
  // ==========================================

  socket.on("c4:create-room", ({ pin, config, questions }) => {
    socket.join(`game:${pin}`);
    socket.join(`host:${pin}`);
    conecta4Sessions[pin] = {
      pin,
      config,
      board: Array(6).fill(null).map(() => Array(7).fill(null)),
      blockedColumns: {},
      powers: {
        red: { shield: 1, double: 1, swap: 1 },
        blue: { shield: 1, double: 1, swap: 1 }
      },
      whosTurn: null,
      status: "lobby",
      currentQuestionIndex: 0,
      timer: config.timeLimit || 20,
      scores: { red: 0, blue: 0 },
      answersReceived: {},
      players: {},
      lastMove: null,
      winnerLine: null,
      history: [],
      questionsLog: [],
      doubleTokenActive: false,
      gameWinner: null,
      questions: questions || []
    };
    emitConecta4State(pin);
  });

  socket.on("c4:join", ({ pin, name, avatarId, teamId, playerId }) => {
    socket.join(`game:${pin}`);
    const session = conecta4Sessions[pin];
    if (!session) {
      socket.emit("c4:error", { message: "La sala de Conecta 4 no existe." });
      return;
    }
    const finalPlayerId = playerId || socket.id;

    // Decide team dynamically for duel if not specified
    let assignedTeam = teamId;
    if (session.config.gameMode === "duel") {
      const activePlayers = Object.values(session.players);
      const bluePlayers = activePlayers.filter((p: any) => p.teamId === "blue");
      const redPlayers = activePlayers.filter((p: any) => p.teamId === "red");
      if (bluePlayers.length <= redPlayers.length) {
        assignedTeam = "blue";
      } else {
        assignedTeam = "red";
      }
    } else if (session.config.gameMode === "prof_vs_aula") {
      assignedTeam = "blue"; // Students are Blue (Aula)
    }

    session.players[socket.id] = {
      id: socket.id,
      playerId: finalPlayerId,
      name,
      avatarId: avatarId || "cult_mariachi",
      teamId: assignedTeam || "blue",
      score: 0,
      streak: 0,
      answeredThisQuestion: false,
      lastAnswerIndex: -1,
      lastAnswerTime: 0,
      isLastCorrect: false,
      pointsEarned: 0
    };

    emitConecta4State(pin);
  });

  socket.on("c4:start-game", ({ pin }) => {
    const session = conecta4Sessions[pin];
    if (!session) return;
    session.status = "question";
    session.currentQuestionIndex = 0;
    const question = session.questions[0];
    session.timer = question ? question.timeLimit : session.config.timeLimit;
    session.answersReceived = {};
    Object.values(session.players).forEach((p: any) => {
      p.answeredThisQuestion = false;
      p.lastAnswerIndex = -1;
    });
    emitConecta4State(pin);
    io.to(`game:${pin}`).emit("c4:sound", { type: "start_turn" });
  });

  socket.on("c4:submit-answer", ({ pin, optionIndex, timeTaken }) => {
    const session = conecta4Sessions[pin];
    if (!session) return;
    const player = session.players[socket.id];
    if (!player) return;

    const question = session.questions[session.currentQuestionIndex];
    const isCorrect = question ? optionIndex === question.correctOption : false;

    player.answeredThisQuestion = true;
    player.lastAnswerIndex = optionIndex;
    player.lastAnswerTime = timeTaken;
    player.isLastCorrect = isCorrect;

    session.answersReceived[player.playerId || socket.id] = {
      optionIndex,
      timeTaken,
      isCorrect
    };

    emitConecta4State(pin);
  });

  socket.on("c4:timer-tick", ({ pin, timer }) => {
    const session = conecta4Sessions[pin];
    if (!session) return;
    session.timer = timer;
    if (timer <= 3 && timer > 0) {
      io.to(`game:${pin}`).emit("c4:sound", { type: "countdown" });
    }
    emitConecta4State(pin);
  });

  socket.on("c4:show-answers", ({ pin }) => {
    const session = conecta4Sessions[pin];
    if (!session) return;
    session.status = "reveal";
    
    // Determine winner of the turn
    const question = session.questions[session.currentQuestionIndex];
    let turnWinner: "red" | "blue" | null = null;
    
    const playersArr = Object.values(session.players) as any[];
    
    const blueAnswers = playersArr.filter(p => p.teamId === "blue");
    const redAnswers = playersArr.filter(p => p.teamId === "red");

    const correctBlue = blueAnswers.filter(p => p.isLastCorrect && p.answeredThisQuestion);
    const correctRed = redAnswers.filter(p => p.isLastCorrect && p.answeredThisQuestion);

    const precisionBlue = blueAnswers.length > 0 ? (correctBlue.length / blueAnswers.length) * 100 : 0;
    const precisionRed = redAnswers.length > 0 ? (correctRed.length / redAnswers.length) * 100 : 0;

    if (session.config.gameMode === "duel") {
      // Direct comparison
      const bluePlayer = blueAnswers[0];
      const redPlayer = redAnswers[0];

      const blueCorrect = bluePlayer && bluePlayer.isLastCorrect && bluePlayer.answeredThisQuestion;
      const redCorrect = redPlayer && redPlayer.isLastCorrect && redPlayer.answeredThisQuestion;

      if (blueCorrect && !redCorrect) {
        turnWinner = "blue";
      } else if (!blueCorrect && redCorrect) {
        turnWinner = "red";
      } else if (blueCorrect && redCorrect) {
        // Both correct, who was faster?
        if (bluePlayer.lastAnswerTime <= redPlayer.lastAnswerTime) {
          turnWinner = "blue";
        } else {
          turnWinner = "red";
        }
      }
    } else if (session.config.gameMode === "teams") {
      // Team average precision comparison
      if (precisionBlue > precisionRed) {
        turnWinner = "blue";
      } else if (precisionRed > precisionBlue) {
        turnWinner = "red";
      } else if (precisionBlue === precisionRed && precisionBlue > 0) {
        // Tie in precision, break tie with average response time of correct responders
        const avgTimeBlue = correctBlue.reduce((sum, p) => sum + p.lastAnswerTime, 0) / (correctBlue.length || 1);
        const avgTimeRed = correctRed.reduce((sum, p) => sum + p.lastAnswerTime, 0) / (correctRed.length || 1);
        if (avgTimeBlue <= avgTimeRed) {
          turnWinner = "blue";
        } else {
          turnWinner = "red";
        }
      }
    } else if (session.config.gameMode === "prof_vs_aula") {
      // Aula vs Profesor
      // Aula wins turn if their accuracy >= 50% (or at least 1 correct if low count)
      const threshold = 50;
      if (blueAnswers.length === 0) {
        turnWinner = "red";
      } else if (precisionBlue >= threshold) {
        turnWinner = "blue";
      } else {
        turnWinner = "red";
      }
    }

    session.whosTurn = turnWinner;

    // Log the question
    if (question) {
      const winnerName = turnWinner === "blue" ? (session.config.gameMode === "prof_vs_aula" ? "Aula" : "Azul") : turnWinner === "red" ? (session.config.gameMode === "prof_vs_aula" ? "Profesor" : "Rojo") : "Nadie";
      session.questionsLog.push({
        question: question.text,
        correctOptionText: question.options[question.correctOption] || "",
        winner: winnerName,
        precisionBlue: Math.round(precisionBlue),
        precisionRed: Math.round(precisionRed)
      });
    }

    if (turnWinner) {
      session.status = "drop";
      io.to(`game:${pin}`).emit("c4:sound", { type: "correct" });
    } else {
      // No turn winner, wait 4 seconds then advance to next question
      setTimeout(() => {
        const s = conecta4Sessions[pin];
        if (s && s.status === "reveal") {
          advanceToNextQuestion(pin);
        }
      }, 4000);
      io.to(`game:${pin}`).emit("c4:sound", { type: "incorrect" });
    }

    emitConecta4State(pin);
  });

  socket.on("c4:next-question", ({ pin }) => {
    advanceToNextQuestion(pin);
  });

  socket.on("c4:drop-token", ({ pin, col }) => {
    const session = conecta4Sessions[pin];
    if (!session) return;
    if (session.status !== "drop") return;
    if (!session.whosTurn) return;

    // Check if column is blocked
    if (session.blockedColumns[col] > 0) {
      socket.emit("c4:error", { message: "Esta columna está bloqueada este turno." });
      return;
    }

    // Find available row (drop to bottom)
    let targetRow = -1;
    for (let r = 5; r >= 0; r--) {
      if (session.board[r][col] === null) {
        targetRow = r;
        break;
      }
    }

    if (targetRow === -1) {
      socket.emit("c4:error", { message: "Esta columna está llena." });
      return;
    }

    const playerColor = session.whosTurn;
    session.board[targetRow][col] = playerColor;
    session.lastMove = { row: targetRow, col, player: playerColor };

    // Register movement in history
    const playerLabel = playerColor === "blue" ? (session.config.gameMode === "prof_vs_aula" ? "Aula 🔵" : "Azul 🔵") : (session.config.gameMode === "prof_vs_aula" ? "Profesor 🔴" : "Rojo 🔴");
    const nowTime = new Date().toLocaleTimeString("es-MX", { hour12: false });
    session.history.push({
      turn: session.history.length + 1,
      player: playerLabel,
      column: col,
      row: targetRow,
      time: nowTime
    });

    io.to(`game:${pin}`).emit("c4:sound", { type: "drop" });

    // Decrement blocked columns
    Object.keys(session.blockedColumns).forEach((k) => {
      const c = Number(k);
      if (session.blockedColumns[c] > 0) {
        session.blockedColumns[c]--;
      }
    });

    // Check win condition
    const winCheck = checkConnect4Win(session.board);
    if (winCheck.winner) {
      session.winnerLine = winCheck.line;
      session.scores[winCheck.winner]++;
      session.status = "ended";
      session.gameWinner = winCheck.winner;
      io.to(`game:${pin}`).emit("c4:sound", { type: "line" });
      setTimeout(() => {
        io.to(`game:${pin}`).emit("c4:sound", { type: "victory" });
      }, 1000);
      saveConecta4HistoryToDB(session);
    } else {
      // Check board full (draw)
      const isFull = session.board[0].every((cell: any) => cell !== null);
      if (isFull) {
        session.status = "ended";
        session.gameWinner = null;
        saveConecta4HistoryToDB(session);
      } else {
        if (session.doubleTokenActive) {
          session.doubleTokenActive = false;
        } else {
          advanceToNextQuestion(pin);
        }
      }
    }

    emitConecta4State(pin);
  });

  socket.on("c4:use-power", ({ pin, team, power, column, fromCol, fromRow, toCol }) => {
    const session = conecta4Sessions[pin];
    if (!session) return;
    if (!session.config.specialPowersEnabled) return;

    if (power === "shield") {
      if (session.powers[team].shield > 0 && typeof column === "number") {
        session.powers[team].shield--;
        session.blockedColumns[column] = 2; // block for next turn
        io.to(`game:${pin}`).emit("c4:sound", { type: "countdown" });
      }
    } else if (power === "double") {
      if (session.powers[team].double > 0) {
        session.powers[team].double--;
        session.doubleTokenActive = true;
        io.to(`game:${pin}`).emit("c4:sound", { type: "countdown" });
      }
    } else if (power === "swap") {
      if (session.powers[team].swap > 0 && typeof fromCol === "number" && typeof fromRow === "number" && typeof toCol === "number") {
        if (session.board[fromRow][fromCol] === team) {
          session.powers[team].swap--;
          session.board[fromRow][fromCol] = null;
          
          for (let r = fromRow; r > 0; r--) {
            session.board[r][fromCol] = session.board[r - 1][fromCol];
          }
          session.board[0][fromCol] = null;

          let targetRow = -1;
          for (let r = 5; r >= 0; r--) {
            if (session.board[r][toCol] === null) {
              targetRow = r;
              break;
            }
          }
          if (targetRow !== -1) {
            session.board[targetRow][toCol] = team;
            session.lastMove = { row: targetRow, col: toCol, player: team };
            io.to(`game:${pin}`).emit("c4:sound", { type: "drop" });
          }

          const winCheck = checkConnect4Win(session.board);
          if (winCheck.winner) {
            session.winnerLine = winCheck.line;
            session.scores[winCheck.winner]++;
            session.status = "ended";
            session.gameWinner = winCheck.winner;
            io.to(`game:${pin}`).emit("c4:sound", { type: "line" });
            setTimeout(() => {
              io.to(`game:${pin}`).emit("c4:sound", { type: "victory" });
            }, 1000);
            saveConecta4HistoryToDB(session);
          }
        }
      }
    }
    emitConecta4State(pin);
  });

  socket.on("c4:reset-board", ({ pin }) => {
    const session = conecta4Sessions[pin];
    if (!session) return;
    session.board = Array(6).fill(null).map(() => Array(7).fill(null));
    session.blockedColumns = {};
    session.winnerLine = null;
    session.lastMove = null;
    session.doubleTokenActive = false;
    session.gameWinner = null;
    session.status = "question";
    
    session.powers = {
      red: { shield: 1, double: 1, swap: 1 },
      blue: { shield: 1, double: 1, swap: 1 }
    };

    advanceToNextQuestion(pin);
    emitConecta4State(pin);
  });

  socket.on("c4:end-game", ({ pin }) => {
    const session = conecta4Sessions[pin];
    if (!session) return;
    session.status = "ended";
    emitConecta4State(pin);
  });

  // CLEANUP ON DISCONNECT
  socket.on("disconnect", () => {
    // Clean up Conecta 4 players
    Object.keys(conecta4Sessions).forEach((pin) => {
      const session = conecta4Sessions[pin];
      if (session && session.players[socket.id]) {
        delete session.players[socket.id];
        emitConecta4State(pin);
      }
    });

    // Clean up Pictionary players
    Object.keys(pictionarySessions).forEach((pin) => {
      const session = pictionarySessions[pin];
      if (session && session.players[socket.id]) {
        delete session.players[socket.id];
        io.to(`game:${pin}`).emit("pictionary:player-list", {
          players: Object.values(session.players)
        });
      }
    });

    // Clean up Horse Race players
    Object.keys(horseRaceSessions).forEach((pin) => {
      const session = horseRaceSessions[pin];
      if (session && session.players[socket.id]) {
        delete session.players[socket.id];
        io.to(`game:${pin}`).emit("horse:player-list", {
          players: Object.values(session.players),
          teams: session.teams
        });
      }
    });

    // Clean up Headbanz players
    Object.keys(headbanzSessions).forEach((pin) => {
      const session = headbanzSessions[pin];
      if (session && session.players[socket.id]) {
        delete session.players[socket.id];
        emitHeadbanzState(pin);
      }
    });

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

          const isExamMode = (session as any).gameType === "exam_mode" || (session as any).examStarted;
          if (isExamMode) {
            const playerObj = session.players[socket.id];
            if (playerObj) {
              const studentPlayerId = playerObj.playerId || playerObj.id || socket.id;
              
              (session as any).examEvents = (session as any).examEvents || [];
              (session as any).examProgress = (session as any).examProgress || {};
              
              if (!(session as any).examProgress[studentPlayerId]) {
                (session as any).examProgress[studentPlayerId] = {
                  playerId: studentPlayerId,
                  socketId: socket.id,
                  name: playerObj.name,
                  solvedCount: 0,
                  correctCount: 0,
                  incorrectCount: 0,
                  percentage: 0,
                  completed: false,
                  timeTakenSeconds: 0,
                  status: "En progreso",
                  answers: {},
                  lastUpdated: Date.now()
                };
              }
              
              const prog = (session as any).examProgress[studentPlayerId];
              prog.disconnectCount = (prog.disconnectCount || 0) + 1;
              prog.lastEventName = "Desconexión";
              prog.lastEventTime = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              prog.examStatus = prog.status || "En progreso";
              
              const newEvent = {
                alumno: playerObj.name,
                playerId: studentPlayerId,
                evento: "Desconexión",
                descripcion: "El alumno perdió conexión o cerró el navegador.",
                fechaHora: new Date().toLocaleDateString('es-MX') + " " + prog.lastEventTime,
                reactivoActual: "N/A",
                examStatus: prog.status || "En progreso"
              };
              
              (session as any).examEvents.push(newEvent);
              
              // Broadcast to Host
              io.to(`host:${pin}`).emit("exam:event-registered", {
                playerId: studentPlayerId,
                progress: prog,
                newEvent
              });
            }
          }
        }
      }
    });
  });
});

// ==========================================
// HEADBANZ CORE LOGIC HELPERS (Prepmaster 2.5.0)
// ==========================================

function assignHeadbanzWords(session: any) {
  const words = [...session.words];
  if (words.length === 0) return;

  Object.values(session.players).forEach((player: any) => {
    const randomIndex = Math.floor(Math.random() * words.length);
    const w = words[randomIndex] || words[0];
    player.currentWord = w.concept;
    player.currentCategory = w.category;
    player.currentHint = w.hint;
    player.hintShown = false;
  });
}

function startHeadbanzTimer(pin: string) {
  clearRoomInterval(pin);
  const session = headbanzSessions[pin];
  if (!session) return;

  session.timer = session.config.timePerTurn || 60;
  io.to(`game:${pin}`).emit("headbanz:sound", { type: "start_turn" });

  timerIntervals[pin] = setInterval(() => {
    const s = headbanzSessions[pin];
    if (!s) {
      clearRoomInterval(pin);
      return;
    }

    if (s.status !== "playing") {
      clearRoomInterval(pin);
      return;
    }

    s.timer--;

    // Automatic Hint at 50% time
    if (s.config.showHints && s.timer === Math.floor((s.config.timePerTurn || 60) / 2)) {
      const playersList = Object.values(s.players);
      if (s.currentPlayerIndex >= 0 && s.currentPlayerIndex < playersList.length) {
        const activePlayer = playersList[s.currentPlayerIndex] as any;
        if (activePlayer && !activePlayer.hintShown) {
          activePlayer.hintShown = true;
          io.to(`game:${pin}`).emit("headbanz:sound", { type: "hint" });
        }
      }
    }

    if (s.timer <= 0) {
      clearRoomInterval(pin);
      io.to(`game:${pin}`).emit("headbanz:sound", { type: "end_round" });
      
      // Auto-log active word as timeout
      const playersList = Object.values(s.players);
      if (s.currentPlayerIndex >= 0 && s.currentPlayerIndex < playersList.length) {
        const activePlayer = playersList[s.currentPlayerIndex] as any;
        if (activePlayer && activePlayer.currentWord) {
          const wordObj = s.words.find((w: any) => w.concept === activePlayer.currentWord);
          s.conceptsLog.push({
            player: activePlayer.name,
            teamId: activePlayer.teamId,
            concept: activePlayer.currentWord,
            difficulty: wordObj ? wordObj.difficulty : "medio",
            result: "tiempo",
            points: 0,
            timeTaken: s.config.timePerTurn
          });
        }
      }

      advanceToNextPlayer(pin);
    } else {
      emitHeadbanzState(pin);
    }
  }, 1000);
}

function advanceToNextPlayer(pin: string) {
  const session = headbanzSessions[pin];
  if (!session) return;

  const playersList = Object.values(session.players);
  if (playersList.length === 0) {
    endHeadbanzGame(pin);
    return;
  }

  session.currentPlayerIndex++;
  if (session.currentPlayerIndex >= playersList.length) {
    session.currentPlayerIndex = 0;
    session.currentRound++;
  }

  if (session.currentRound > (session.config.roundsCount || 3)) {
    endHeadbanzGame(pin);
  } else {
    const nextPlayer = playersList[session.currentPlayerIndex] as any;
    if (nextPlayer) {
      const availableWords = session.words.filter((w: any) => 
        !Object.values(session.players).some((p: any) => p.currentWord === w.concept)
      );
      const w = availableWords.length > 0 
        ? availableWords[Math.floor(Math.random() * availableWords.length)]
        : session.words[Math.floor(Math.random() * session.words.length)];
      if (w) {
        nextPlayer.currentWord = w.concept;
        nextPlayer.currentCategory = w.category;
        nextPlayer.currentHint = w.hint;
        nextPlayer.hintShown = false;
      }
    }
    
    startHeadbanzTimer(pin);
    emitHeadbanzState(pin);
  }
}

function endHeadbanzGame(pin: string) {
  clearRoomInterval(pin);
  const session = headbanzSessions[pin];
  if (!session) return;

  session.status = "ended";
  session.timer = 0;

  // Save to history SQLite
  saveHeadbanzHistory({
    date: new Date().toISOString(),
    bankName: session.bankName,
    config: session.config,
    playerScores: Object.values(session.players).map((p: any) => ({
      name: p.name,
      teamId: p.teamId,
      score: p.score
    })),
    conceptsLog: session.conceptsLog
  });

  emitHeadbanzState(pin);
}

function emitHeadbanzState(pin: string) {
  const session = headbanzSessions[pin];
  if (!session) return;

  // Send full state to host
  io.to(`host:${pin}`).emit("headbanz:state", session);

  // Send state to each player, hiding their own active word & hint
  const playerSockets = Object.keys(session.players);
  playerSockets.forEach((socketId) => {
    const playerSpecificSession = JSON.parse(JSON.stringify(session));
    const currentPlayer = playerSpecificSession.players[socketId];
    if (currentPlayer) {
      currentPlayer.currentWord = undefined;
      currentPlayer.currentHint = undefined;
    }
    io.to(socketId).emit("headbanz:state", playerSpecificSession);
  });
}

// ==========================================
// CONECTA 4 CORE HELPERS
// ==========================================

function checkConnect4Win(board: (string | null)[][]): { winner: "red" | "blue" | null; line: [number, number][] | null } {
  const rows = 6;
  const cols = 7;
  const directions = [
    { r: 0, c: 1 },  // horizontal
    { r: 1, c: 0 },  // vertical
    { r: 1, c: 1 },  // diagonal down-right
    { r: 1, c: -1 } // diagonal up-right
  ];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const color = board[r][c];
      if (!color) continue;

      for (const { r: dr, c: dc } of directions) {
        const line: [number, number][] = [[r, c]];
        let nr = r + dr;
        let nc = c + dc;
        
        while (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc] === color) {
          line.push([nr, nc]);
          if (line.length === 4) {
            return { winner: color as "red" | "blue", line };
          }
          nr += dr;
          nc += dc;
        }
      }
    }
  }
  return { winner: null, line: null };
}

function advanceToNextQuestion(pin: string) {
  const session = conecta4Sessions[pin];
  if (!session) return;
  
  session.currentQuestionIndex++;
  if (session.currentQuestionIndex >= session.questions.length) {
    session.currentQuestionIndex = 0;
  }
  
  const question = session.questions[session.currentQuestionIndex];
  session.timer = question ? question.timeLimit : session.config.timeLimit;
  session.status = "question";
  session.answersReceived = {};
  session.whosTurn = null;
  session.doubleTokenActive = false;
  
  Object.values(session.players).forEach((p: any) => {
    p.answeredThisQuestion = false;
    p.lastAnswerIndex = -1;
  });

  io.to(`game:${pin}`).emit("c4:sound", { type: "start_turn" });
}

function saveConecta4HistoryToDB(session: any) {
  try {
    saveHeadbanzHistory({
      id: Math.random().toString(36).substring(2, 11),
      date: new Date().toISOString(),
      bankName: session.questionsLog[0]?.question || "Conecta 4",
      config: session.config,
      playerScores: session.scores,
      conceptsLog: session.history
    });
  } catch (err) {
    console.error("Error logging Conecta 4 History:", err);
  }
}

function emitConecta4State(pin: string) {
  const session = conecta4Sessions[pin];
  if (!session) return;
  io.to(`game:${pin}`).emit("c4:state", session);
}

// Configure Vite or Serve SPA Dist files
async function startServer() {
  const isDevVite = process.env.NODE_ENV !== "production" && process.env.IS_ELECTRON !== "true";
  if (isDevVite) {
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
