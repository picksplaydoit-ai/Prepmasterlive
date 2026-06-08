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
const SQLITE_FILE = path.join(process.cwd(), "prepmaster.db");

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
        XLSX.utils.book_append_sheet(wb, ws, "100 Mexicanos");
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

// Real-time server timers control
function clearRoomInterval(pin: string): void {
  if (timerIntervals[pin]) {
    clearInterval(timerIntervals[pin]);
    delete timerIntervals[pin];
  }
}

// Websocket Events
io.on("connection", (socket: Socket) => {
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
        const resolvedPlayerId2 = existingPlayer.playerId || existingPlayer.id;
        const pProgress = (session as any).examProgress ? (session as any).examProgress[resolvedPlayerId2] : null;
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
