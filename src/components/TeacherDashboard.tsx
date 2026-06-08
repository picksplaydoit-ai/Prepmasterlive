import React, { useState, useEffect } from "react";
import { 
  Play, Plus, Edit3, Trash2, Users, QrCode, Clipboard, 
  Trophy, Award, RefreshCw, BarChart2, CheckCircle, Zap,
  ChevronRight, VolumeX, Download, LogOut, ArrowRight, Clock, HelpCircle,
  Tv, ListPlus, FileSpreadsheet, TrendingDown, Calendar
} from "lucide-react";
import { socket } from "../lib/socket";
import { Questionnaire, Player, GameSession, PlayerAnswersCount, Team } from "../types";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { AvatarRenderer, getAvatarById } from "./AvatarCatalog";
import Mexicanos from "../games/100-mexicanos/Mexicanos";
import JeopardyGame from "../games/jeopardy/JeopardyGame";
import ExamMode from "../games/exam-mode/ExamMode";
import NetworkDiagnostic from "./NetworkDiagnostic";
import QRCode from "qrcode";

interface TeacherDashboardProps {
  onCreateNew: () => void;
  onEdit: (quiz: Questionnaire) => void;
  onImport: (gameType?: 'quiz_live' | 'exam_mode' | 'mexicanos' | 'jeopardy') => void;
}

interface ConnectionInfo {
  ips: string[];
  preferredIP: string;
  localUrl: string;
  appUrl: string;
  qrLocal: string;
  qrApp: string;
}

interface NetworkInfo {
  localIp: string;
  port: number;
  localUrl: string;
}

export default function TeacherDashboard({ onCreateNew, onEdit, onImport }: TeacherDashboardProps) {
  const [quizzes, setQuizzes] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bankCounts, setBankCounts] = useState<{
    quiz_live: number;
    exam_mode: number;
    mexicanos: number;
    jeopardy: number;
  }>({ quiz_live: 0, exam_mode: 0, mexicanos: 0, jeopardy: 0 });
  
  // Connection details retrieved from server
  const [connInfo, setConnInfo] = useState<ConnectionInfo | null>(null);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);

  // Active game states
  const [activePin, setActivePin] = useState<string | null>(null);
  const [gameTitle, setGameTitle] = useState("");
  const [gameStatus, setGameStatus] = useState<GameSession["status"] | null>(null);
  
  const [playersList, setPlayersList] = useState<Player[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(-1);
  const [totalQuestionsCount, setTotalQuestionsCount] = useState(0);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [countdownTimer, setCountdownTimer] = useState(5);

  // Stats revealed info
  const [revealData, setRevealData] = useState<{
    correctOption: number;
    stats: { option0: number; option1: number; option2: number; option3: number };
    players?: Player[];
  } | null>(null);

  // Leaderboard data
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);

  // Team states
  const [activeGameMode, setActiveGameMode] = useState<'individual' | 'teams'>('individual');
  const [activeTeams, setActiveTeams] = useState<Team[]>([]);
  const [teamRankings, setTeamRankings] = useState<any[]>([]);
  const [teamStats, setTeamStats] = useState<any | null>(null);

  // Modal configuration states
  const [hostingQuizId, setHostingQuizId] = useState<string | null>(null);
  const [setupGameMode, setSetupGameMode] = useState<'individual' | 'teams'>('individual');
  const [setupTeams, setSetupTeams] = useState<Team[]>([
    { id: "team_agaves", name: "Agaves", icon: "🌱", color: "#10b981" },
    { id: "team_mariachis", name: "Mariachis", icon: "🎺", color: "#f59e0b" },
    { id: "team_tortas", name: "Tortas Ahogadas", icon: "🥖", color: "#f97316" }
  ]);

  // Platform multi-game modes (2.0.0)
  const [activeGameType, setActiveGameType] = useState<'quiz_live' | 'mexicanos' | 'jeopardy' | 'exam'>('quiz_live');
  const [hostingGameType, setHostingGameType] = useState<'quiz_live' | 'mexicanos' | 'jeopardy' | 'exam'>('quiz_live');
  const [selectedDashboardGame, setSelectedDashboardGame] = useState<'quiz_live' | 'mexicanos' | 'jeopardy' | 'exam' | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<Questionnaire | null>(null);

  // Podium (Final stand)
  const [podium, setPodium] = useState<Player[]>([]);

  // Clipboard utility
  const [copied, setCopied] = useState(false);

  // Dynamic Session QR URL state (2.1.2)
  const [sessionQrUrl, setSessionQrUrl] = useState<string>("");
  const [joinUrlUsed, setJoinUrlUsed] = useState<string>("");
  const [isIpDetected, setIsIpDetected] = useState<boolean>(true);
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    if (activePin && activeGameType) {
      let url = "";
      if (networkInfo && networkInfo.localIp) {
        url = `http://${networkInfo.localIp}:${networkInfo.port}/join?pin=${activePin}&game=${activeGameType}`;
        setIsIpDetected(true);
      } else {
        const host = window.location.hostname;
        if (host && host !== "localhost" && host !== "127.0.0.1") {
          url = `${window.location.origin}/join?pin=${activePin}&game=${activeGameType}`;
          setIsIpDetected(true);
        } else {
          setIsIpDetected(false);
          url = `http://[REVISA_CONEXION_WIFI]:3000/join?pin=${activePin}&game=${activeGameType}`;
        }
      }
      setJoinUrlUsed(url);

      QRCode.toDataURL(url, { width: 405, margin: 1 }, (err, qrUrl) => {
        if (!err) {
          setSessionQrUrl(qrUrl);
        }
      });
    }
  }, [activePin, activeGameType, networkInfo]);

  // New states for match results and export metrics
  const [gameResultsData, setGameResultsData] = useState<any | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [resultsError, setResultsError] = useState<string | null>(null);

  // Fetch detailed results when a game completes
  useEffect(() => {
    if (gameStatus === "ended" && activePin) {
      setLoadingResults(true);
      setResultsError(null);
      fetch(`/api/session-results/${activePin}`)
        .then((res) => {
          if (!res.ok) throw new Error("No se pudieron cargar los detalles de la partida.");
          return res.json();
        })
        .then((data) => {
          setGameResultsData(data);
          setLoadingResults(false);
        })
        .catch((err) => {
          console.error("Error al cargar resultados de la partida:", err);
          setResultsError(err.message);
          setLoadingResults(false);
        });
    } else if (gameStatus !== "ended") {
      setGameResultsData(null);
    }
  }, [gameStatus, activePin]);

  // Load quizzes and connection details on mount
  useEffect(() => {
    fetchQuizzes();
    fetchConnectionInfo();
    fetchBankCounts();
  }, [activePin, selectedDashboardGame]);

  const fetchBankCounts = async () => {
    try {
      const res = await fetch("/api/questionnaires");
      if (res.ok) {
        const data = await res.json();
        const counts = { quiz_live: 0, exam_mode: 0, mexicanos: 0, jeopardy: 0 };
        data.forEach((q: any) => {
          const type = q.game_type || "quiz_live";
          if (type in counts) {
            counts[type as keyof typeof counts]++;
          }
        });
        setBankCounts(counts);
      }
    } catch (e) {
      console.error("Error fetching bank counts:", e);
    }
  };

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      let queryParam = "";
      if (selectedDashboardGame === "quiz_live") queryParam = "?game_type=quiz_live";
      else if (selectedDashboardGame === "mexicanos") queryParam = "?game_type=mexicanos";
      else if (selectedDashboardGame === "jeopardy") queryParam = "?game_type=jeopardy";
      else if (selectedDashboardGame === "exam") queryParam = "?game_type=exam_mode";

      const res = await fetch(`/api/questionnaires${queryParam}`);
      if (res.ok) {
        const data = await res.json();
        setQuizzes(data);
      } else {
        setError("Error al cargar los cuestionarios.");
      }
    } catch (err) {
      setError("No se pudo conectar con el servidor local para obtener cuestionarios.");
    } finally {
      setLoading(false);
    }
  };

  const fetchConnectionInfo = async () => {
    try {
      const res = await fetch("/api/ip");
      if (res.ok) {
        const data = await res.json();
        setConnInfo(data);
      }
    } catch (err) {
      console.error("Error al obtener la información de IP local:", err);
    }
    try {
      const res = await fetch("/api/network-info");
      if (res.ok) {
        const data = await res.json();
        setNetworkInfo(data);
      }
    } catch (err) {
      console.error("Error al obtener /api/network-info:", err);
    }
  };

  const handleDeleteQuiz = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("¿Seguro que deseas eliminar este cuestionario? Se perderán todos sus datos.")) {
      return;
    }

    try {
      const res = await fetch(`/api/questionnaires/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchQuizzes();
      } else {
        alert("Ocurrió un error al eliminar.");
      }
    } catch (err) {
      alert("Error de conexión al eliminar.");
    }
  };

  // Connect to Game Sockets on Launch
  const handleHostGame = (quizId: string) => {
    const targetQuiz = quizzes.find(q => q.id === quizId);
    if (!targetQuiz) return;

    setHostingQuizId(quizId);
    setSetupGameMode("individual");
    setSetupTeams([
      { id: "team_agaves", name: "Agaves", icon: "🌱", color: "#10b981" },
      { id: "team_mariachis", name: "Mariachis", icon: "🎺", color: "#f59e0b" },
      { id: "team_tortas", name: "Tortas Ahogadas", icon: "🥖", color: "#f97316" }
    ]);
  };

  const commitHostGame = () => {
    if (!hostingQuizId) return;
    const targetQuiz = quizzes.find(q => q.id === hostingQuizId);
    if (!targetQuiz) return;

    setGameTitle(targetQuiz.title);
    setTotalQuestionsCount(targetQuiz.questions.length);
    setActiveQuiz(targetQuiz);
    setPlayersList([]);
    setRevealData(null);
    setLeaderboard([]);
    setPodium([]);
    
    // Request server to construct game room session
    socket.emit("host:create-session", { 
      questionnaireId: hostingQuizId,
      gameMode: setupGameMode,
      teams: setupGameMode === "teams" ? setupTeams : [],
      gameType: hostingGameType
    });

    setHostingQuizId(null);
  };

  const handleAddSetupTeam = (preset?: { name: string; icon: string; color: string }) => {
    if (setupTeams.length >= 8) return;
    const newId = `setup_team_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newTeam: Team = preset ? {
      id: newId,
      name: preset.name,
      icon: preset.icon,
      color: preset.color
    } : {
      id: newId,
      name: `Equipo ${setupTeams.length + 1}`,
      icon: "🤖",
      color: "#4f46e5"
    };
    setSetupTeams([...setupTeams, newTeam]);
  };

  const handleUpdateSetupTeam = (id: string, updates: Partial<Team>) => {
    setSetupTeams(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const handleRemoveSetupTeam = (id: string) => {
    if (setupTeams.length <= 2) return;
    setSetupTeams(prev => prev.filter(t => t.id !== id));
  };

  // Socket listener setup
  useEffect(() => {
    socket.on("session:created", (data: { 
      pin: string; 
      title: string; 
      questionsCount: number; 
      players: Player[]; 
      gameMode?: 'individual' | 'teams'; 
      teams?: Team[];
      gameType?: any;
      questionnaireId?: string;
    }) => {
      setActivePin(data.pin);
      setGameTitle(data.title);
      setTotalQuestionsCount(data.questionsCount);
      setGameStatus("lobby");
      setPlayersList(data.players || []);
      setActiveGameMode(data.gameMode || "individual");
      setActiveTeams(data.teams || []);
      setTeamRankings([]);
      setTeamStats(null);
      if (data.gameType) {
        setActiveGameType(data.gameType);
      }
      
      // Resolve activeQuiz reference
      const found = quizzes.find(q => q.id === data.questionnaireId || q.title === data.title);
      if (found) {
        setActiveQuiz(found);
      }
    });

    socket.on("player:joined-list", (data: { players: Player[] }) => {
      setPlayersList(data.players);
    });

    socket.on("player:list-update", (data: { count: number }) => {
      // Just double assurance of synchronization
    });

    socket.on("countdown:tick", (data: { timer: number }) => {
      setGameStatus("countdown");
      setCountdownTimer(data.timer);
    });

    // Active Question ticks
    socket.on("question:active", (data: any) => {
      setGameStatus("question");
      setCurrentQuestionIdx(data.currentIndex);
      setTimerRemaining(data.timeLimit);
      setAnsweredCount(0);
      setRevealData(null);
    });

    socket.on("question:tick", (data: { timer: number; answeredCount: number }) => {
      setTimerRemaining(data.timer);
      setAnsweredCount(data.answeredCount);
    });

    socket.on("player:answered-count", (data: { answeredCount: number; totalInGame: number }) => {
      setAnsweredCount(data.answeredCount);
    });

    // Question Reveal Correct option and stats
    socket.on("question:revealed", (data: { status: string; correctOption: number; stats: PlayerAnswersCount; players: Player[] }) => {
      setGameStatus("reveal");
      setRevealData({
        correctOption: data.correctOption,
        stats: data.stats,
        players: data.players
      });
      // Synchronize in-memory scores too
      setPlayersList(data.players);
    });

    // Generic game state updates (lobby/reveals/leaderboards)
    socket.on("game:status-update", (data: any) => {
      if (data.gameMode !== undefined) {
        setActiveGameMode(data.gameMode);
      }
      if (data.teams !== undefined) {
        setActiveTeams(data.teams);
      }
      if (data.teamRankings !== undefined) {
        setTeamRankings(data.teamRankings);
      }
      if (data.teamStats !== undefined) {
        setTeamStats(data.teamStats);
      }

      if (data.status === "countdown") {
        setGameStatus("countdown");
        setCountdownTimer(data.timer);
        if (data.currentQuestionIndex !== undefined) {
          setCurrentQuestionIdx(data.currentQuestionIndex);
        }
      }
      if (data.status === "leaderboard") {
        setGameStatus("leaderboard");
        setLeaderboard(data.leaderboard);
      }
      if (data.status === "ended") {
        setGameStatus("ended");
        setPodium(data.podium);
      }
    });

    return () => {
      socket.off("session:created");
      socket.off("player:joined-list");
      socket.off("player:list-update");
      socket.off("countdown:tick");
      socket.off("question:active");
      socket.off("question:tick");
      socket.off("player:answered-count");
      socket.off("question:revealed");
      socket.off("game:status-update");
    };
  }, []);

  const handleStartGame = () => {
    if (!activePin) return;
    socket.emit("host:start-game", { pin: activePin });
  };

  const handleSkipQuestion = () => {
    if (!activePin) return;
    socket.emit("host:skip-question", { pin: activePin });
  };

  const handleShowLeaderboard = () => {
    if (!activePin) return;
    socket.emit("host:show-leaderboard", { pin: activePin });
  };

  const handleNextQuestion = () => {
    if (!activePin) return;
    socket.emit("host:next-question", { pin: activePin });
  };

  const handleCancelGame = () => {
    if (!window.confirm("¿Seguro que deseas salir? Se perderá la partida actual.")) {
      return;
    }
    if (activePin) {
      socket.emit("host:end-game", { pin: activePin });
    }
    setActivePin(null);
    setGameStatus(null);
    setCurrentQuestionIdx(-1);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportExcel = () => {
    if (!gameResultsData) return;
    try {
      const title = gameResultsData.title || "Partida";
      const dateStr = new Date(gameResultsData.date || new Date().toISOString()).toLocaleDateString("es-ES");

      // 1. Resultados Sheet Data
      const sheet1Data = gameResultsData.players.map((p: any, idx: number) => {
        const studentLogs = gameResultsData.answersHistory.filter((l: any) => l.playerId === (p.playerId || p.id));
        const aciertos = studentLogs.filter((l: any) => l.isCorrect).length;
        const sinResponder = studentLogs.filter((l: any) => l.optionIndex === -1).length;
        const errores = studentLogs.length - aciertos - sinResponder;

        const totalAnsweredWithTime = studentLogs.filter((l: any) => l.optionIndex !== -1);
        const avgResponseTimeMs = totalAnsweredWithTime.length > 0 
          ? totalAnsweredWithTime.reduce((sum: number, l: any) => sum + l.reactionTime, 0) / totalAnsweredWithTime.length 
          : 0;
        const avgResponseTimeSec = (avgResponseTimeMs / 1000).toFixed(2);

        const accuracyPct = studentLogs.length > 0 ? Math.round((aciertos / studentLogs.length) * 100) : 0;

        const teamName = p.teamId && gameResultsData.teams
          ? (gameResultsData.teams.find((t: any) => t.id === p.teamId)?.name || "")
          : "Individual";

        return {
          "Lugar": idx + 1,
          "Nombre del alumno": p.name,
          "Avatar": p.avatarId ? getAvatarById(p.avatarId).name : "Estándar",
          "Equipo": teamName,
          "Puntaje total": p.score,
          "Aciertos": aciertos,
          "Errores": errores,
          "Sin responder": sinResponder,
          "Porcentaje de aciertos": `${accuracyPct}%`,
          "Tiempo promedio de respuesta": `${avgResponseTimeSec} s`,
          "Racha máxima": p.streak || 0,
          "Fecha": dateStr,
          "Nombre del cuestionario": title
        };
      });

      // 2. Detalle por pregunta Sheet Data
      const sheet2Data: any[] = [];
      gameResultsData.questions.forEach((q: any, qIdx: number) => {
        const questionLogs = gameResultsData.answersHistory.filter((l: any) => l.questionIndex === qIdx);
        const alphabet = ["A", "B", "C", "D"];
        const correctLetter = alphabet[q.correctOption] || "N/A";

        gameResultsData.players.forEach((p: any) => {
          const log = questionLogs.find((l: any) => l.playerId === (p.playerId || p.id));
          
          let resAlumno = "Sin responder";
          let statusStr = "Sin responder";
          let puntos = 0;
          let tRespuesta = "N/A";

          if (log) {
            if (log.optionIndex !== -1) {
              resAlumno = alphabet[log.optionIndex] || "N/A";
              statusStr = log.isCorrect ? "Correcta" : "Incorrecta";
              puntos = log.pointsEarned || 0;
              tRespuesta = `${(log.reactionTime / 1000).toFixed(2)} s`;
            }
          }

          const teamName = p.teamId && gameResultsData.teams
            ? (gameResultsData.teams.find((t: any) => t.id === p.teamId)?.name || "")
            : "Individual";

          sheet2Data.push({
            "Número de pregunta": qIdx + 1,
            "Pregunta": q.text,
            "Tema": q.topic || "General",
            "Respuesta correcta": correctLetter,
            "Alumno": p.name,
            "Equipo": teamName,
            "Respuesta del alumno": resAlumno,
            "Correcta / Incorrecta / Sin responder": statusStr,
            "Puntos obtenidos": puntos,
            "Tiempo de respuesta": tRespuesta
          });
        });
      });

      // 3. Resumen por tema Sheet Data
      const topicSummaryObj: Record<string, {
        topic: string;
        totalQuestions: number;
        correctGrupales: number;
        erroresGrupales: number;
        totalGrupales: number;
        questionsList: { text: string; correctRate: number }[];
      }> = {};

      gameResultsData.questions.forEach((q: any, qIdx: number) => {
        const topic = q.topic ? q.topic.trim() : "General";
        if (!topicSummaryObj[topic]) {
          topicSummaryObj[topic] = {
            topic,
            totalQuestions: 0,
            correctGrupales: 0,
            erroresGrupales: 0,
            totalGrupales: 0,
            questionsList: []
          };
        }
        topicSummaryObj[topic].totalQuestions++;
        
        const qLogs = gameResultsData.answersHistory.filter((l: any) => l.questionIndex === qIdx);
        const qCorrect = qLogs.filter((l: any) => l.isCorrect).length;
        const qTotal = qLogs.length;
        const qRate = qTotal > 0 ? (qCorrect / qTotal) : 0;
        
        topicSummaryObj[topic].questionsList.push({
          text: q.text,
          correctRate: qRate
        });
      });

      gameResultsData.answersHistory.forEach((log: any) => {
        const q = gameResultsData.questions[log.questionIndex];
        if (!q) return;
        const topic = q.topic ? q.topic.trim() : "General";
        const summ = topicSummaryObj[topic];
        if (summ) {
          summ.totalGrupales++;
          if (log.isCorrect) {
            summ.correctGrupales++;
          } else if (log.optionIndex !== -1) {
            summ.erroresGrupales++;
          }
        }
      });

      const sheet3Data = Object.values(topicSummaryObj).map((summ) => {
        let hardestQText = "Ninguna";
        let minRate = 1.1;
        summ.questionsList.forEach((qitem) => {
          if (qitem.correctRate < minRate) {
            minRate = qitem.correctRate;
            hardestQText = qitem.text;
          }
        });

        const gpAccuracy = summ.totalGrupales > 0 ? Math.round((summ.correctGrupales / summ.totalGrupales) * 100) : 0;

        return {
          "Tema": summ.topic,
          "Total de preguntas": summ.totalQuestions,
          "Aciertos grupales": summ.correctGrupales,
          "Errores grupales": summ.erroresGrupales,
          "Porcentaje de aciertos grupal": `${gpAccuracy}%`,
          "Pregunta más difícil del tema": hardestQText
        };
      });

      const wsResultados = XLSX.utils.json_to_sheet(sheet1Data);
      const wsDetalles = XLSX.utils.json_to_sheet(sheet2Data);
      const wsTemas = XLSX.utils.json_to_sheet(sheet3Data);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsResultados, "Resultados");
      XLSX.utils.book_append_sheet(wb, wsDetalles, "Detalle por pregunta");
      XLSX.utils.book_append_sheet(wb, wsTemas, "Resumen por tema");

      XLSX.writeFile(wb, `resultados_${title.toLowerCase().replace(/[^a-z0-9]/g, "_")}.xlsx`);
    } catch (e) {
      console.error("Error al exportar a Excel:", e);
    }
  };

  const handleExportCSV = () => {
    if (!gameResultsData) return;
    try {
      const title = gameResultsData.title || "Partida";
      const dateStr = new Date(gameResultsData.date || new Date().toISOString()).toLocaleDateString("es-ES");

      // 1. resultados.csv
      const csv1Data = gameResultsData.players.map((p: any, idx: number) => {
        const studentLogs = gameResultsData.answersHistory.filter((l: any) => l.playerId === (p.playerId || p.id));
        const aciertos = studentLogs.filter((l: any) => l.isCorrect).length;
        const sinResponder = studentLogs.filter((l: any) => l.optionIndex === -1).length;
        const errores = studentLogs.length - aciertos - sinResponder;

        const totalAnsweredWithTime = studentLogs.filter((l: any) => l.optionIndex !== -1);
        const avgResponseTimeMs = totalAnsweredWithTime.length > 0 
          ? totalAnsweredWithTime.reduce((sum: number, l: any) => sum + l.reactionTime, 0) / totalAnsweredWithTime.length 
          : 0;
        const avgResponseTimeSec = (avgResponseTimeMs / 1000).toFixed(2);

        const accuracyPct = studentLogs.length > 0 ? Math.round((aciertos / studentLogs.length) * 100) : 0;

        return {
          "Lugar": idx + 1,
          "Nombre del alumno": p.name,
          "Avatar": p.avatarId ? getAvatarById(p.avatarId).name : "Estándar",
          "Puntaje total": p.score,
          "Aciertos": aciertos,
          "Errores": errores,
          "Sin responder": sinResponder,
          "Porcentaje de aciertos": `${accuracyPct}%`,
          "Tiempo promedio de respuesta": `${avgResponseTimeSec} s`,
          "Racha máxima": p.streak || 0,
          "Fecha": dateStr,
          "Nombre del cuestionario": title
        };
      });

      const csvContent1 = Papa.unparse(csv1Data);
      triggerCSVDownload(csvContent1, `resultados_${title.toLowerCase().replace(/[^a-z0-9]/g, "_")}.csv`);

      // 2. detalle_por_pregunta.csv
      const csv2Data: any[] = [];
      gameResultsData.questions.forEach((q: any, qIdx: number) => {
        const questionLogs = gameResultsData.answersHistory.filter((l: any) => l.questionIndex === qIdx);
        const alphabet = ["A", "B", "C", "D"];
        const correctLetter = alphabet[q.correctOption] || "N/A";

        gameResultsData.players.forEach((p: any) => {
          const log = questionLogs.find((l: any) => l.playerId === (p.playerId || p.id));
          
          let resAlumno = "Sin responder";
          let statusStr = "Sin responder";
          let puntos = 0;
          let tRespuesta = "N/A";

          if (log) {
            if (log.optionIndex !== -1) {
              resAlumno = alphabet[log.optionIndex] || "N/A";
              statusStr = log.isCorrect ? "Correcta" : "Incorrecta";
              puntos = log.pointsEarned || 0;
              tRespuesta = `${(log.reactionTime / 1000).toFixed(2)} s`;
            }
          }

          csv2Data.push({
            "Número de pregunta": qIdx + 1,
            "Pregunta": q.text,
            "Tema": q.topic || "General",
            "Respuesta correcta": correctLetter,
            "Alumno": p.name,
            "Respuesta del alumno": resAlumno,
            "Correcta / Incorrecta / Sin responder": statusStr,
            "Puntos obtenidos": puntos,
            "Tiempo de respuesta": tRespuesta
          });
        });
      });

      const csvContent2 = Papa.unparse(csv2Data);
      triggerCSVDownload(csvContent2, `detalle_por_pregunta_${title.toLowerCase().replace(/[^a-z0-9]/g, "_")}.csv`);

      // 3. resumen_por_tema.csv
      const topicSummaryObj: Record<string, {
        topic: string;
        totalQuestions: number;
        correctGrupales: number;
        erroresGrupales: number;
        totalGrupales: number;
        questionsList: { text: string; correctRate: number }[];
      }> = {};

      gameResultsData.questions.forEach((q: any, qIdx: number) => {
        const topic = q.topic ? q.topic.trim() : "General";
        if (!topicSummaryObj[topic]) {
          topicSummaryObj[topic] = {
            topic,
            totalQuestions: 0,
            correctGrupales: 0,
            erroresGrupales: 0,
            totalGrupales: 0,
            questionsList: []
          };
        }
        topicSummaryObj[topic].totalQuestions++;
        
        const qLogs = gameResultsData.answersHistory.filter((l: any) => l.questionIndex === qIdx);
        const qCorrect = qLogs.filter((l: any) => l.isCorrect).length;
        const qTotal = qLogs.length;
        const qRate = qTotal > 0 ? (qCorrect / qTotal) : 0;
        
        topicSummaryObj[topic].questionsList.push({
          text: q.text,
          correctRate: qRate
        });
      });

      gameResultsData.answersHistory.forEach((log: any) => {
        const q = gameResultsData.questions[log.questionIndex];
        if (!q) return;
        const topic = q.topic ? q.topic.trim() : "General";
        const summ = topicSummaryObj[topic];
        if (summ) {
          summ.totalGrupales++;
          if (log.isCorrect) {
            summ.correctGrupales++;
          } else if (log.optionIndex !== -1) {
            summ.erroresGrupales++;
          }
        }
      });

      const csv3Data = Object.values(topicSummaryObj).map((summ) => {
        let hardestQText = "Ninguna";
        let minRate = 1.1;
        summ.questionsList.forEach((qitem) => {
          if (qitem.correctRate < minRate) {
            minRate = qitem.correctRate;
            hardestQText = qitem.text;
          }
        });

        const gpAccuracy = summ.totalGrupales > 0 ? Math.round((summ.correctGrupales / summ.totalGrupales) * 100) : 0;

        return {
          "Tema": summ.topic,
          "Total de preguntas": summ.totalQuestions,
          "Aciertos grupales": summ.correctGrupales,
          "Errores grupales": summ.erroresGrupales,
          "Porcentaje de aciertos grupal": `${gpAccuracy}%`,
          "Pregunta más difícil del tema": hardestQText
        };
      });

      const csvContent3 = Papa.unparse(csv3Data);
      triggerCSVDownload(csvContent3, `resumen_por_tema_${title.toLowerCase().replace(/[^a-z0-9]/g, "_")}.csv`);

    } catch (e) {
      console.error("Error al exportar a CSV:", e);
    }
  };

  const triggerCSVDownload = (content: string, filename: string) => {
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // If a game is active, render the dedicated Game Console
  if (activePin && gameStatus) {
    const resolvedActiveQuiz = activeQuiz || quizzes.find(q => q.title === gameTitle) || quizzes[0];

    if (activeGameType === "mexicanos") {
      return (
        <Mexicanos 
          quiz={resolvedActiveQuiz} 
          pin={activePin} 
          players={playersList} 
          teams={activeTeams} 
          onBackToMenu={() => {
            if (window.confirm("¿Seguro que deseas concluir esta partida de 100 Mexicanos Dijeron?")) {
              socket.emit("host:end-game", { pin: activePin });
              setActivePin(null);
              setGameStatus(null);
            }
          }} 
        />
      );
    }

    if (activeGameType === "jeopardy") {
      return (
        <JeopardyGame 
          quiz={resolvedActiveQuiz} 
          pin={activePin} 
          players={playersList} 
          teams={activeTeams} 
          onBackToMenu={() => {
            if (window.confirm("¿Seguro que deseas concluir esta partida de Jeopardy?")) {
              socket.emit("host:end-game", { pin: activePin });
              setActivePin(null);
              setGameStatus(null);
            }
          }} 
        />
      );
    }

    if (activeGameType === "exam") {
      return (
        <ExamMode 
          quiz={resolvedActiveQuiz} 
          pin={activePin} 
          players={playersList} 
          teams={activeTeams} 
          connInfo={connInfo}
          onBackToMenu={() => {
            if (window.confirm("¿Seguro que deseas concluir esta sesión de examen individual?")) {
              socket.emit("host:end-game", { pin: activePin });
              setActivePin(null);
              setGameStatus(null);
            }
          }} 
        />
      );
    }

    const isLobby = gameStatus === "lobby";
    const isCountdown = gameStatus === "countdown";
    const isQuestion = gameStatus === "question";
    const isReveal = gameStatus === "reveal";
    const isLeaderboard = gameStatus === "leaderboard";
    const isEnded = gameStatus === "ended";

    // Grab current question safely
    const currentQuiz = quizzes.find(q => q.id === quizzes.find(item => item.title === gameTitle)?.id);
    const questionsAndAnswers = currentQuiz?.questions || [];
    const activeQuestion = questionsAndAnswers[currentQuestionIdx];

    let avgAccuracy = 0;
    let topStudent = { name: "Ninguno", score: 0 };
    let hardestQuestionText = "Ninguna";
    let lowestTopicName = "General";
    let lowestTopicPct = 0;

    if (gameResultsData) {
      const totalLogs = gameResultsData.answersHistory?.length || 0;
      const correctCount = gameResultsData.answersHistory?.filter((l: any) => l.isCorrect).length || 0;
      avgAccuracy = totalLogs > 0 ? Math.round((correctCount / totalLogs) * 100) : 0;

      topStudent = gameResultsData.players?.reduce(
        (max: any, p: any) => p.score > max.score ? p : max,
        gameResultsData.players[0] || { name: "Ninguno", score: 0 }
      );

      let lowestCorrectRate = 1.1;
      if (gameResultsData.questions && gameResultsData.questions.length > 0) {
        gameResultsData.questions.forEach((q: any, idx: number) => {
          const qLogs = gameResultsData.answersHistory?.filter((l: any) => l.questionIndex === idx) || [];
          const qCorrect = qLogs.filter((l: any) => l.isCorrect).length;
          const qTotal = qLogs.length;
          const qRate = qTotal > 0 ? (qCorrect / qTotal) : 0;
          if (qRate < lowestCorrectRate) {
            lowestCorrectRate = qRate;
            hardestQuestionText = q.text;
          }
        });
      }
      if (hardestQuestionText === "Ninguna" || lowestCorrectRate > 1.0) {
        hardestQuestionText = "Ninguna";
      }

      let lowestTopicAccuracy = 1.1;
      const topicStats: Record<string, { correct: number; total: number }> = {};
      gameResultsData.answersHistory?.forEach((log: any) => {
        const question = gameResultsData.questions[log.questionIndex];
        const topic = question?.topic ? question.topic.trim() : "General";
        if (!topicStats[topic]) {
          topicStats[topic] = { correct: 0, total: 0 };
        }
        topicStats[topic].total++;
        if (log.isCorrect) {
          topicStats[topic].correct++;
        }
      });

      Object.entries(topicStats).forEach(([topic, stats]) => {
        const accuracy = stats.total > 0 ? (stats.correct / stats.total) : 0;
        if (accuracy < lowestTopicAccuracy) {
          lowestTopicAccuracy = accuracy;
          lowestTopicName = topic;
        }
      });
      lowestTopicPct = lowestTopicAccuracy <= 1.0 ? Math.round(lowestTopicAccuracy * 100) : 0;
    }

    return (
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row rounded-3xl bg-slate-100 border border-slate-200 shadow-2xl overflow-hidden min-h-[620px]" id="teacher-live-console">
        
        {/* Main interactive area */}
        <div className="flex-1 flex flex-col p-6 sm:p-8 justify-between" id="console-main-canvas">
          
          {/* Active Title bar */}
          <div className="flex justify-between items-end mb-8" id="active-title-bar">
            <div className="space-y-1">
              <p className="text-xs font-bold tracking-widest text-indigo-600 uppercase">
                {isLobby ? "Lobby de Espera" : `Sesión Activa — Pregunta ${currentQuestionIdx + 1}/${totalQuestionsCount}`}
              </p>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800 italic">
                {isLobby ? "Esperando la llegada de los estudiantes..." : (activeQuestion?.text || gameTitle)}
              </h1>
            </div>

            {isQuestion && (
              <div className="text-right shrink-0">
                <span className="block text-4xl font-mono font-bold text-indigo-600">
                  {answeredCount}/{playersList.length}
                </span>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-tighter block">
                  Respuestas de Alumnos
                </span>
              </div>
            )}
          </div>

          {/* Core Interactive Screen States */}

          {/* 1. LOBBY STATE */}
          {isLobby && (
            <div className="flex-1 flex flex-col justify-center space-y-6 animate-fade-in" id="lobby-state-canvas">
              
              {/* Instructions and Screen Splitting for classroom projection */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                
                {/* Left Area: Instructions & connected students list */}
                <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
                  
                  {/* Instructions card */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
                    <div className="space-y-1">
                      <span className="bg-indigo-50 border border-indigo-150 text-indigo-700 text-[10px] uppercase font-black tracking-widest px-2.5 py-0.5 rounded-full inline-block">
                        📶 WIFI LOCAL • SIN INTERNET MUNDIAL
                      </span>
                      <h3 className="text-md font-black text-slate-800 flex items-center gap-2">
                        <span>¿Cómo unirse a la partida?</span>
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 leading-normal font-medium">
                      Conecta tu celular a la misma red WiFi que el profesor. Escanea el código QR de la derecha para entrar de forma directa, o copia la dirección y escribe el PIN.
                    </p>
                    
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between text-xs font-mono">
                      <div>
                        <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Dirección Local:</span>
                        <span className="font-bold text-indigo-700 truncate block select-all" id="lobby-local-dir-text">
                          {networkInfo?.localUrl || connInfo?.appUrl || `${window.location.origin}`}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          const url = networkInfo?.localUrl || connInfo?.appUrl || `${window.location.origin}`;
                          navigator.clipboard.writeText(url);
                          setCopiedUrl(true);
                          setTimeout(() => setCopiedUrl(false), 2000);
                        }}
                        className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-lg transition-all"
                        id="lobby-local-dir-copy-btn"
                      >
                        {copiedUrl ? "¡Listo!" : "Copiar"}
                      </button>
                    </div>
                  </div>

                  {/* Connected Students Directory */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-5 flex-1 flex flex-col justify-between shadow-xs min-h-[180px]">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-3">
                      <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
                        Alumnos listos en sala ({playersList.length})
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
                        <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">Esperando</span>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto max-h-[160px] pr-1">
                      {playersList.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center py-6 text-slate-400 space-y-1.5">
                          <Users size={24} className="text-slate-350 animate-bounce" />
                          <p className="text-xs font-bold text-slate-500">¿Listos para competir?</p>
                          <p className="text-[10px] text-slate-400 font-mono">Los nombres aparecerán conforme se unan.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {playersList.map((player) => (
                            <div 
                              key={player.id}
                              className="bg-indigo-50/30 border border-indigo-100/50 py-1.5 px-2.5 rounded-xl flex items-center gap-2 animate-fade-in shadow-xs transition-transform hover:scale-[1.01]"
                            >
                              <AvatarRenderer id={player.avatarId} size={24} className="shrink-0 bg-white p-0.5 rounded-full border border-slate-200" />
                              <span className="text-xs font-bold text-slate-700 truncate" title={player.name}>{player.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* Right Area: Giant PIN and Dynamic QR projection helper */}
                <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
                  
                  {/* Giant PIN code block */}
                  <div className="bg-white border-2 border-indigo-200 rounded-3xl p-5 text-center flex flex-col items-center justify-center shadow-xs" id="giant-pin-container-live">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 mb-1">
                      PIN DE PARTIDA
                    </span>
                    <div className="text-[54px] sm:text-[72px] font-black font-mono tracking-widest text-indigo-950 leading-none py-1 selection:bg-indigo-100">
                      {activePin}
                    </div>
                    <button
                      onClick={() => {
                        if (activePin) {
                          navigator.clipboard.writeText(activePin);
                          setCopiedPin(true);
                          setTimeout(() => setCopiedPin(false), 2000);
                        }
                      }}
                      className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-xs"
                    >
                      <Clipboard size={10} />
                      <span>{copiedPin ? "¡PIN Copiado!" : "Copiar PIN"}</span>
                    </button>
                  </div>

                  {/* Helpful QR code block */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-5 flex flex-col items-center space-y-3 shadow-xs" id="smart-qr-preview-live">
                    <div className="text-center space-y-0.5">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Escanea y entra directo</h4>
                      <p className="text-[10px] text-slate-400 font-sans leading-normal">
                        No necesitas escribir el PIN si usas el QR.
                      </p>
                    </div>

                    <div className="bg-white border border-slate-150 rounded-xl p-1.5 flex flex-col items-center justify-center aspect-square shadow-sm max-w-[150px] max-h-[150px]">
                      {sessionQrUrl ? (
                        <img
                          src={sessionQrUrl}
                          alt="Lector de código"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-[130px] h-[130px] flex items-center justify-center bg-slate-50 border border-slate-100 rounded text-slate-400 font-bold text-xs animate-pulse">
                          Cargando QR...
                        </div>
                      )}
                    </div>

                    <div className="text-center space-y-1.5 w-full">
                      <p className="text-[9px] font-mono text-indigo-700 bg-indigo-50/50 border border-indigo-100/60 py-1 px-2 rounded-lg select-all tracking-tight truncate max-w-full" id="lobby-qr-url-text">
                        {joinUrlUsed}
                      </p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(joinUrlUsed);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 transition-all font-sans font-bold px-2.5 py-1 rounded-lg text-[10px] cursor-pointer shadow-xs"
                        id="lobby-qr-url-copy-btn"
                      >
                        <Clipboard size={10} />
                        <span>{copied ? "¡Copiado!" : "Copiar enlace"}</span>
                      </button>

                      {!isIpDetected && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-850 rounded-xl p-3 text-[10.5px] font-bold text-center mt-3 leading-normal animate-pulse" id="lobby-wifi-warning-banner">
                          ⚠️ No se detectó IP local. Revisa tu conexión WiFi.
                        </div>
                      )}
                    </div>
                  </div>

                </div>

              </div>

            </div>
          )}

          {/* 2. COUNTDOWN STATE */}
          {isCountdown && (
            <div className="flex-1 flex flex-col items-center justify-center py-10 space-y-6" id="countdown-state-canvas">
              <span className="text-xs font-bold tracking-widest text-indigo-600 uppercase bg-indigo-50 px-3 py-1 rounded-full border border-indigo-150">Preparen sus teléfonos</span>
              <div className="w-24 h-24 rounded-full bg-indigo-600 text-white flex items-center justify-center text-5xl font-black font-mono shadow-xl border border-indigo-400/40 relative">
                <span className="animate-pulse">{countdownTimer}</span>
              </div>
              <div className="text-center max-w-sm bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
                <p className="text-[10px] text-slate-400 font-bold uppercase font-mono tracking-wider">Pregunta {currentQuestionIdx + 1} de {totalQuestionsCount}</p>
                <p className="text-sm font-bold text-slate-800 italic leading-snug">"{questionsAndAnswers[currentQuestionIdx]?.text}"</p>
              </div>
            </div>
          )}

          {/* 3. ACTIVE QUESTION RUNNING */}
          {isQuestion && activeQuestion && (
            <div className="flex-1 flex flex-col justify-between space-y-6" id="active-question-state-canvas">
              
              {/* Central clock visual indicator */}
              <div className="flex items-center justify-around bg-white p-4 rounded-xl border border-slate-200 shadow-sm gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                    <Clock size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest font-mono block">Segundos restantes</span>
                    <span className="text-2xl font-mono font-black text-slate-800">{timerRemaining} s</span>
                  </div>
                </div>

                <div className="h-8 w-[1px] bg-slate-200"></div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                    <Users size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest font-mono block">Total de respuestas</span>
                    <span className="text-2xl font-mono font-black text-slate-800">{answeredCount}/{playersList.length}</span>
                  </div>
                </div>
              </div>

              {/* Multi-option visual geometric balance block */}
              <div className="grid grid-cols-2 gap-4">
                {activeQuestion.options.map((option, idx) => {
                  let badgeColor = "";
                  let ringColor = "";
                  let shape = "";
                  if (idx === 0) { badgeColor = "bg-rose-500"; ringColor = "ring-rose-600/20"; shape = "▲"; }
                  if (idx === 1) { badgeColor = "bg-blue-500"; ringColor = "ring-blue-600/20"; shape = "◆"; }
                  if (idx === 2) { badgeColor = "bg-amber-500"; ringColor = "ring-amber-600/20"; shape = "●"; }
                  if (idx === 3) { badgeColor = "bg-emerald-500"; ringColor = "ring-emerald-600/20"; shape = "■"; }

                  return (
                    <div 
                      key={idx}
                      className={`relative ${badgeColor} rounded-2xl p-5 flex flex-col justify-between shadow-md ring-1 ${ringColor} text-white min-h-[120px]`}
                      id={`preview-option-${idx}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center font-bold text-white text-md">
                          {shape}
                        </div>
                        <span className="text-white/75 font-mono text-[10px] font-bold">OPCIÓN {String.fromCharCode(65 + idx)}</span>
                      </div>
                      <p className="text-lg sm:text-xl font-extrabold text-white mt-3 truncate">{option}</p>
                    </div>
                  );
                })}
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Progreso de Aula</span>
                <span className="text-xs font-extrabold text-slate-600">PREGUNTA {currentQuestionIdx + 1} DE {totalQuestionsCount}</span>
              </div>
            </div>
          )}

          {/* 4. REVEAL ANSWER STATS */}
          {isReveal && activeQuestion && revealData && (
            <div className="flex-1 flex flex-col justify-between space-y-6 animate-fade-in" id="reveal-state-canvas">
              
              {/* Correct notification bar */}
              <div className="bg-emerald-50 border border-emerald-150 p-4 rounded-2xl flex items-center gap-4 shadow-sm">
                <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                  <CheckCircle size={22} />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase font-mono tracking-widest block">Respuesta Correcta de la Pregunta</span>
                  <p className="text-sm font-bold text-slate-800">
                    Opcion {String.fromCharCode(65 + revealData.correctOption)}: {activeQuestion.options[revealData.correctOption]}
                  </p>
                </div>
              </div>

              {/* Graphic report chart */}
              <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
                <h4 className="text-xs uppercase font-extrabold text-slate-400 tracking-wider">Porcentajes de Conteo Local</h4>
                
                <div className="space-y-3.5">
                  {[
                    { val: revealData.stats.option0, title: activeQuestion.options[0], color: "bg-rose-500", shape: "▲" },
                    { val: revealData.stats.option1, title: activeQuestion.options[1], color: "bg-blue-500", shape: "◆" },
                    { val: revealData.stats.option2, title: activeQuestion.options[2], color: "bg-amber-500", shape: "●" },
                    { val: revealData.stats.option3, title: activeQuestion.options[3], color: "bg-emerald-500", shape: "■" }
                  ].map((item, idx) => {
                    const totalAnswers = (revealData.stats.option0 + revealData.stats.option1 + revealData.stats.option2 + revealData.stats.option3) || 1;
                    const pct = Math.round((item.val / totalAnswers) * 100);
                    const isRight = idx === revealData.correctOption;

                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                          <span className="flex items-center gap-1.5 truncate max-w-[280px]">
                            <span className="text-slate-400 font-mono">{item.shape}</span>
                            <span className="truncate">{item.title}</span>
                            {isRight && <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] px-1.5 rounded uppercase font-extrabold shrink-0">Ganadora</span>}
                          </span>
                          <span className="font-mono text-slate-500 flex-shrink-0">{item.val} votos ({pct}%)</span>
                        </div>
                        
                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
                          <div 
                            className={`h-full ${item.color} rounded-full transition-all duration-500`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Foot stats line */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center text-xs font-bold text-slate-500 font-mono">
                Presiona "Ver Tabla de Posiciones" para actualizar el score de pantalla.
              </div>
            </div>
          )}

          {/* 5. LEADERBOARD VIEW */}
          {isLeaderboard && (
            <div className="flex-1 flex flex-col justify-between space-y-6 animate-fade-in" id="leaderboard-state-canvas">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl mx-auto">
                
                {/* Individual Leaderboard */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="text-center space-y-1 pb-2 border-b border-slate-100">
                    <Trophy className="text-amber-500 mx-auto" size={30} />
                    <h3 className="text-lg font-bold text-slate-900 font-sans">Tabla de Posiciones</h3>
                    <p className="text-xs text-slate-400">Puntaje acumulado general de los participantes</p>
                  </div>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {leaderboard.length === 0 ? (
                      <div className="text-slate-400 text-center py-6 text-xs font-sans">Sin puntuaciones registradas aún.</div>
                    ) : (
                      leaderboard.slice(0, 5).map((p, idx) => {
                        const teamLabel = p.teamId && activeTeams.find(t => t.id === p.teamId)
                          ? ` [${activeTeams.find(t => t.id === p.teamId)?.icon} ${activeTeams.find(t => t.id === p.teamId)?.name}]`
                          : "";
                        return (
                          <div 
                            key={p.id}
                            className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg border border-slate-150"
                          >
                            <div className="flex items-center gap-3">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-bold text-[10px] ${
                                idx === 0 ? "bg-amber-400 text-slate-900" :
                                idx === 1 ? "bg-slate-300 text-slate-900" :
                                idx === 2 ? "bg-amber-700 text-white" : "bg-slate-200 text-slate-600"
                              }`}>
                                {idx + 1}
                              </span>
                              <AvatarRenderer id={p.avatarId} size={24} className="shrink-0 bg-white p-0.5 rounded-full border border-slate-200 shadow-xs" />
                              <div>
                                <span className="text-xs font-extrabold text-slate-800">{p.name}</span>
                                {teamLabel && <span className="text-[9px] font-bold text-indigo-600 font-sans block leading-none">{teamLabel}</span>}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {p.streak > 1 && (
                                <span className="bg-orange-50 text-orange-600 border border-orange-200 text-[9px] font-mono px-2 py-0.5 rounded-full uppercase font-extrabold">
                                  🔥 racha {p.streak}
                                </span>
                              )}
                              <span className="text-xs font-mono font-extrabold text-indigo-600">{p.score} pts</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Team Leaderboard (Conditional) */}
                {activeGameMode === "teams" ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                    <div className="text-center space-y-1 pb-2 border-b border-slate-100">
                      <Users className="text-indigo-600 mx-auto" size={30} />
                      <h3 className="text-lg font-bold text-slate-900 font-sans">Tabla de Equipos</h3>
                      <p className="text-xs text-slate-400">Puntaje combinado acumulado por equipos</p>
                    </div>

                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {teamRankings.length === 0 ? (
                        <div className="text-slate-400 text-center py-6 text-xs font-sans">Cargando puntuaciones de equipos...</div>
                      ) : (
                        teamRankings.map((t, idx) => (
                          <div 
                            key={t.id}
                            className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg border border-slate-150"
                            style={{ borderLeftWidth: "4px", borderLeftColor: t.color }}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-bold text-[10px] ${
                                idx === 0 ? "bg-amber-400 text-slate-900" :
                                idx === 1 ? "bg-slate-300 text-slate-900" :
                                idx === 2 ? "bg-amber-700 text-white" : "bg-slate-200 text-slate-600"
                              }`}>
                                {idx + 1}
                              </span>
                              <span className="text-lg leading-none">{t.icon}</span>
                              <div>
                                <span className="text-xs font-extrabold text-slate-800">{t.name}</span>
                                <span className="text-[9px] font-semibold text-slate-400 block">{t.playerCount} integrantes</span>
                              </div>
                            </div>

                            <span className="text-xs font-mono font-extrabold text-indigo-600">{t.score} pts</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/40 border border-dashed border-slate-200 rounded-2xl p-6 flex flex-col justify-center items-center text-center space-y-2">
                    <Users className="text-slate-300" size={32} />
                    <h4 className="text-sm font-bold text-slate-500 font-sans">Modo Individual Activo</h4>
                    <p className="text-xs text-slate-400 max-w-xs font-sans">Esta partida se juega de manera individual. No hay puntajes de equipos.</p>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* 6. PODIUM ENDED STATE */}
          {isEnded && (
            <div className="flex-1 flex flex-col space-y-6 overflow-y-auto pr-1" id="ended-state-canvas">
              <div className="text-center space-y-1">
                <Award className="text-indigo-600 mx-auto animate-bounce" size={40} />
                <h3 className="text-2xl font-black text-slate-900 uppercase">¡Competencia Terminada!</h3>
                <p className="text-xs text-slate-500 font-medium">Estadísticas docentes y podio de alumnos</p>
              </div>

              {/* Triple Podium Castle tower visuals */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start pt-2 pb-2 max-w-4xl mx-auto w-full">
                {/* Individual Podium */}
                <div className="flex flex-col items-center space-y-3">
                  {activeGameMode === "teams" && (
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Podio Individual</h4>
                  )}
                  <div className="flex items-end justify-center gap-4 sm:gap-6 max-w-xs mx-auto w-full min-h-[140px]" id="podium-castle">
                    
                    {/* 2nd Place */}
                    {podium[1] && (
                      <div className="flex flex-col items-center flex-1 shrink-0">
                        <AvatarRenderer id={podium[1].avatarId || "cult_mariachi"} size={44} className="mb-1 rounded-full shadow border-2 border-slate-300 bg-white" />
                        <div className="text-center mb-1 max-w-[85px] truncate">
                          <span className="text-xs font-bold text-slate-700 block truncate leading-none">{podium[1].name}</span>
                          <span className="text-[10px] text-slate-400 font-mono font-bold">{podium[1].score} pts</span>
                        </div>
                        <div className="w-full bg-slate-200 border-t-2 border-slate-300 rounded-t-xl h-16 flex items-center justify-center">
                          <span className="text-lg font-black text-slate-500">2</span>
                        </div>
                      </div>
                    )}

                    {/* 1st Place */}
                    {podium[0] && (
                      <div className="flex flex-col items-center flex-1 shrink-0 scale-105">
                        <span className="text-amber-500 text-sm mb-1 leading-none">👑</span>
                        <AvatarRenderer id={podium[0].avatarId || "cult_mariachi"} size={52} className="mb-1 rounded-full shadow-md border-2 border-amber-400 bg-white" />
                        <div className="text-center mb-1 max-w-[95px] truncate">
                          <span className="text-xs font-black text-indigo-700 block truncate leading-none">{podium[0].name}</span>
                          <span className="text-[10px] text-amber-600 font-mono font-bold">{podium[0].score} pts</span>
                        </div>
                        <div className="w-full bg-amber-50/60 border-t-2 border-amber-400 rounded-t-xl h-24 flex items-center justify-center relative shadow-sm">
                          <span className="text-xl font-black text-amber-500">1</span>
                        </div>
                      </div>
                    )}

                    {/* 3rd Place */}
                    {podium[2] && (
                      <div className="flex flex-col items-center flex-1 shrink-0">
                        <AvatarRenderer id={podium[2].avatarId || "cult_mariachi"} size={40} className="mb-1 rounded-full shadow border-2 border-slate-300 bg-white" />
                        <div className="text-center mb-1 max-w-[85px] truncate">
                          <span className="text-xs font-bold text-slate-700 block truncate leading-none">{podium[2].name}</span>
                          <span className="text-[10px] text-slate-400 font-mono font-bold">{podium[2].score} pts</span>
                        </div>
                        <div className="w-full bg-slate-250 border-t-2 border-slate-355 rounded-t-xl h-12 flex items-center justify-center">
                          <span className="text-base font-bold text-slate-400">3</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Team Podium */}
                {activeGameMode === "teams" && teamRankings && (
                  <div className="flex flex-col items-center space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-650">Podio de Equipos</h4>
                    <div className="flex items-end justify-center gap-4 sm:gap-6 max-w-xs mx-auto w-full min-h-[140px]" id="podium-teams-castle">
                      
                      {/* 2nd Place Team */}
                      {teamRankings[1] && (
                        <div className="flex flex-col items-center flex-1 shrink-0">
                          <span className="text-2xl leading-none mb-1">{teamRankings[1].icon}</span>
                          <div className="text-center mb-1 max-w-[85px] truncate">
                            <span className="text-xs font-bold text-slate-700 block truncate leading-none">{teamRankings[1].name}</span>
                            <span className="text-[10px] text-slate-400 font-mono font-bold">{teamRankings[1].score} pts</span>
                          </div>
                          <div className="w-full bg-slate-200 border-t-2 border-slate-300 rounded-t-xl h-16 flex items-center justify-center">
                            <span className="text-sm font-black text-slate-500">🥈</span>
                          </div>
                        </div>
                      )}

                      {/* 1st Place Team */}
                      {teamRankings[0] && (
                        <div className="flex flex-col items-center flex-1 shrink-0 scale-105">
                          <span className="text-amber-500 text-sm mb-1 leading-none">👑</span>
                          <span className="text-3xl leading-none mb-1">{teamRankings[0].icon}</span>
                          <div className="text-center mb-1 max-w-[95px] truncate">
                            <span className="text-xs font-black text-indigo-700 block truncate leading-none">{teamRankings[0].name}</span>
                            <span className="text-[10px] text-amber-600 font-mono font-bold">{teamRankings[0].score} pts</span>
                          </div>
                          <div className="w-full bg-amber-50/60 border-t-2 border-amber-400 rounded-t-xl h-24 flex items-center justify-center relative shadow-sm">
                            <span className="text-sm font-black text-indigo-500">🥇</span>
                          </div>
                        </div>
                      )}

                      {/* 3rd Place Team */}
                      {teamRankings[2] && (
                        <div className="flex flex-col items-center flex-1 shrink-0">
                          <span className="text-2xl leading-none mb-1">{teamRankings[2].icon}</span>
                          <div className="text-center mb-1 max-w-[85px] truncate">
                            <span className="text-xs font-bold text-slate-700 block truncate leading-none">{teamRankings[2].name}</span>
                            <span className="text-[10px] text-slate-400 font-mono font-bold">{teamRankings[2].score} pts</span>
                          </div>
                          <div className="w-full bg-slate-250 border-t-2 border-slate-355 rounded-t-xl h-12 flex items-center justify-center">
                            <span className="text-sm font-bold text-slate-400">🥉</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* INSTRUCTOR REPORT MODULE AND METRIC CARDS */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4 shadow-inner" id="docente-reporte-modulo">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
                    <BarChart2 size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest leading-none">Módulo de Reporte del Profesor</h4>
                    <p className="text-[10px] text-slate-500 font-medium font-sans mt-0.5">Análisis automático del rendimiento grupal</p>
                  </div>
                </div>

                {loadingResults ? (
                  <div className="flex flex-col items-center justify-center py-6 space-y-2">
                    <RefreshCw size={20} className="text-indigo-600 animate-spin" />
                    <span className="text-xs font-bold text-slate-500 font-mono animate-pulse">Analizando respuestas...</span>
                  </div>
                ) : resultsError ? (
                  <div className="text-center py-2 text-xs font-bold text-rose-500 font-mono">
                    ⚠️ Error al cargar métricas: {resultsError}
                  </div>
                ) : !gameResultsData ? (
                  <div className="text-center py-2 text-xs font-bold text-slate-400 font-mono">
                    Cargando reporte de partida...
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Grid of 4 Cards */}
                    <div className="grid grid-cols-2 gap-3" id="kpi-metric-cards">
                      
                      {/* CARD 1: Promedio grupal */}
                      <div className="bg-white p-3 rounded-xl border border-slate-150 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center gap-1 text-indigo-600 mb-1">
                          <CheckCircle size={13} />
                          <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Promedio Grupal</span>
                        </div>
                        <div>
                          <span className="text-lg font-bold text-slate-800 font-mono">{avgAccuracy}%</span>
                          <span className="text-[9px] text-slate-500 block font-medium mt-0.5">aciertos totales</span>
                        </div>
                      </div>

                      {/* CARD 2: Alumno Destacado */}
                      <div className="bg-white p-3 rounded-xl border border-slate-150 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center gap-1 text-amber-500 mb-1">
                          <Trophy size={13} />
                          <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Mejor Alumno</span>
                        </div>
                        <div>
                          <span className="text-xs font-black text-slate-800 truncate block">{topStudent.name}</span>
                          <span className="text-[9px] text-slate-500 block font-mono font-bold mt-0.5">{topStudent.score} pts</span>
                        </div>
                      </div>

                      {/* CARD 3: Pregunta Más Difícil */}
                      <div className="bg-white p-3 rounded-xl border border-slate-150 shadow-sm flex flex-col justify-between col-span-2">
                        <div className="flex items-center gap-1 text-rose-500 mb-1">
                          <TrendingDown size={13} />
                          <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 font-sans">Pregunta más difícil del test</span>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-800 leading-tight line-clamp-2">{hardestQuestionText}</p>
                          <span className="text-[8px] text-rose-500 font-mono font-bold block mt-1">baja efectividad</span>
                        </div>
                      </div>

                      {/* CARD 4: Tema con Menor Desempeño */}
                      <div className="bg-white p-3 rounded-xl border border-slate-150 shadow-sm flex flex-col justify-between col-span-2">
                        <div className="flex items-center gap-1 text-slate-600 mb-1">
                          <HelpCircle size={13} className="text-orange-500" />
                          <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Tema menor desempeño</span>
                        </div>
                        <div className="flex justify-between items-end">
                          <div className="max-w-[140px] truncate">
                            <span className="text-[11px] font-black text-slate-800 uppercase block truncate">{lowestTopicName}</span>
                            <span className="text-[8px] text-slate-400 font-medium block">necesita repaso</span>
                          </div>
                          <span className="text-[9px] font-extrabold bg-orange-50 text-orange-600 border border-orange-250 px-2 py-0.5 rounded-md font-mono shrink-0">{lowestTopicPct}% acierto</span>
                        </div>
                      </div>

                    </div>

                    {/* CARTAS DE ESTADÍSTICAS POR EQUIPO (Conditional) */}
                    {activeGameMode === "teams" && teamStats && (
                      <div className="border-t border-slate-200 pt-4 mt-4 space-y-3">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 font-sans flex items-center gap-1">
                          <Users size={11} />
                          <span>Métricas y Logros por Equipos</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" id="team-stats-cards">
                          
                          {/* CARD 5: Equipo con más puntos */}
                          <div className="bg-white p-3 rounded-xl border border-slate-150 shadow-sm flex flex-col justify-between">
                            <div className="flex items-center gap-1 text-amber-500 mb-1">
                              <Trophy size={13} />
                              <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Equipo Más Puntos</span>
                            </div>
                            <div>
                              <span className="text-xs font-black text-slate-800 flex items-center gap-1">
                                <span className="text-sm">{teamStats.maxPointsTeam?.icon}</span>
                                <span className="truncate">{teamStats.maxPointsTeam?.name || "N/A"}</span>
                              </span>
                              <span className="text-[9px] text-amber-700 block font-mono font-bold mt-0.5">
                                {teamStats.maxPointsTeam?.score ?? 0} pts totales
                              </span>
                            </div>
                          </div>

                          {/* CARD 6: Equipo más rápido */}
                          <div className="bg-white p-3 rounded-xl border border-slate-150 shadow-sm flex flex-col justify-between">
                            <div className="flex items-center gap-1 text-indigo-500 mb-1">
                              <Zap size={13} />
                              <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Equipo Más Rápido</span>
                            </div>
                            <div>
                              <span className="text-xs font-black text-slate-800 flex items-center gap-1">
                                <span className="text-sm">{teamStats.fastestTeam?.icon}</span>
                                <span className="truncate">{teamStats.fastestTeam?.name || "N/A"}</span>
                              </span>
                              <span className="text-[9px] text-slate-500 block font-mono mt-0.5">
                                {teamStats.fastestTeam?.avgTimeMs ? `${(teamStats.fastestTeam.avgTimeMs / 1000).toFixed(2)} s prom.` : "Sistemas N/A"}
                              </span>
                            </div>
                          </div>

                          {/* CARD 7: Equipo con mejor puntería */}
                          <div className="bg-white p-3 rounded-xl border border-slate-150 shadow-sm flex flex-col justify-between">
                            <div className="flex items-center gap-1 text-emerald-500 mb-1">
                              <CheckCircle size={13} />
                              <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Mejor Puntería %</span>
                            </div>
                            <div>
                              <span className="text-xs font-black text-slate-800 flex items-center gap-1">
                                <span className="text-sm">{teamStats.bestAccuracyTeam?.icon}</span>
                                <span className="truncate">{teamStats.bestAccuracyTeam?.name || "N/A"}</span>
                              </span>
                              <span className="text-[9px] text-emerald-600 block font-mono font-bold mt-0.5">
                                {teamStats.bestAccuracyTeam?.accuracy ? `${Math.round(teamStats.bestAccuracyTeam.accuracy)}% efectividad` : "0% efectividad"}
                              </span>
                            </div>
                          </div>

                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            </div>
          )}

          {/* Core Screen bottom actions */}
          <div className="pt-6 border-t border-slate-200 mt-6" id="panel-actions-wrapper">
            {isLobby && (
              <button
                onClick={handleStartGame}
                disabled={playersList.length === 0}
                className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-sm tracking-wide shadow-md hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5"
                id="btn-lobby-go"
              >
                <Play size={15} />
                <span>Iniciar Cuestionario en Aula</span>
              </button>
            )}

            {isQuestion && (
              <button
                onClick={handleSkipQuestion}
                className="w-full py-3 bg-white text-rose-500 border border-rose-250 rounded-xl font-bold text-xs tracking-widest uppercase hover:bg-rose-50 cursor-pointer"
                id="btn-skip-active"
              >
                Saltar esta pregunta
              </button>
            )}

            {isReveal && (
              <button
                onClick={handleShowLeaderboard}
                className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-sm tracking-wide shadow-md hover:bg-slate-800 cursor-pointer"
                id="btn-reveal-go"
              >
                Ver Tabla de Posiciones
              </button>
            )}

            {isLeaderboard && (
              <button
                onClick={handleNextQuestion}
                className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-sm tracking-wide shadow-md hover:bg-indigo-700 cursor-pointer"
                id="btn-next-question-go"
              >
                {currentQuestionIdx + 1 < totalQuestionsCount ? "Siguiente Pregunta" : "Ver Resultados Finales"}
              </button>
            )}

            {isEnded && (
              <div className="space-y-3" id="ended-actions-wrapper">
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl space-y-2">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block text-center">Exportar Resultados Docente</span>
                  
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={handleExportExcel}
                      disabled={loadingResults || !gameResultsData}
                      className="py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-extrabold text-[10px] uppercase tracking-wider shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                      id="btn-export-excel-complex"
                    >
                      <FileSpreadsheet size={13} />
                      <span>Excel (.xlsx)</span>
                    </button>

                    <button
                      onClick={handleExportCSV}
                      disabled={loadingResults || !gameResultsData}
                      className="py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-extrabold text-[10px] uppercase tracking-wider shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                      id="btn-export-csv-complex"
                    >
                      <Download size={13} />
                      <span>CSV (.csv)</span>
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleCancelGame}
                  className="w-full py-3.5 bg-white text-slate-800 border border-slate-300 rounded-xl font-bold text-xs tracking-wide uppercase hover:bg-slate-50 cursor-pointer flex items-center justify-center gap-1.5"
                  id="btn-finish-ended"
                >
                  <LogOut size={13} className="text-slate-500" />
                  <span>Cerrar sesión de juego</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Local Access Sidebar */}
        <div className="w-full md:w-80 bg-white border-l border-slate-200 p-6 flex flex-col justify-between shadow-xl" id="console-sidebar">
          <div className="space-y-6">
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Acceso de Alumno</h2>
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center aspect-square mb-4 shadow-inner">
                {connInfo?.qrApp ? (
                  <img
                    src={connInfo.qrApp}
                    alt="Lector de código"
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <svg width="120" height="120" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-400 animate-pulse">
                    <path d="M10 10h30v30h-30zM60 10h30v30h-30zM10 60h30v30h-30zM60 60h10v10h-10zM80 60h10v10h-10zM70 70h10v10h-10zM60 80h10v10h-10zM80 80h10v10h-10z"/>
                  </svg>
                )}
              </div>
              <div className="text-center space-y-1">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Conectarse usando:</p>
                <p className="text-sm font-mono font-bold text-indigo-700 bg-indigo-50 py-1.5 px-3 rounded-lg border border-indigo-100 select-all tracking-tight truncate">
                  {connInfo?.preferredIP || "192.168.1.15"}
                </p>
                <p className="text-[10px] text-slate-400 font-semibold font-mono">Código PIN: <span className="text-indigo-600 font-bold">{activePin}</span></p>
              </div>
            </div>

            {/* Quick rankings status panel */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Jugadores Conectados</h3>
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                {playersList.length === 0 ? (
                  <span className="text-[11px] font-bold text-slate-400 italic block py-4 text-center">Nadie se ha unido todavía</span>
                ) : (
                  playersList.slice(0, 4).map((pl, plIdx) => (
                    <div 
                      key={pl.id}
                      className="flex justify-between items-center p-2 bg-slate-50 rounded-lg border border-slate-100"
                    >
                      <div className="flex items-center gap-2 max-w-[130px] truncate">
                        <span className="text-[10px] font-bold text-slate-400">0{plIdx + 1}</span>
                        <span className="text-xs font-extrabold text-slate-700 truncate">{pl.name}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-indigo-600 shrink-0">{pl.score} pts</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100">
            <button 
              onClick={handleCancelGame}
              className="w-full py-2.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl font-bold text-xs uppercase hover:bg-rose-100 cursor-pointer text-center"
            >
              Cancelar Partida
            </button>
          </div>
        </div>

      </div>
    );
  }

  // STANDARD LOBBY PANEL / QUIZZES MANAGER
  if (!selectedDashboardGame) {
    return (
      <div className="space-y-6" id="prepmaster-live-platform-dashboard">
        
        {/* Beautiful Geometric Balance Header */}
        <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl text-left relative overflow-hidden shadow-xl" id="platform-banner">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-650/11 rounded-full blur-3xl -mr-10 -mt-10"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -ml-10 -mb-10"></div>

          <div className="space-y-1.5 relative z-10">
            <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full inline-block">
              ★ Prepmaster v2.0.0
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-white font-sans tracking-tight">PREPMASTER LIVE</h1>
            <p className="text-slate-400 text-xs sm:text-sm max-w-xl">
              Bienvenido al centro interactivo de gamificación local. Transforma tus reactivos en emocionantes juegos interactivos multilaterales sin dependencias de internet.
            </p>
          </div>
        </div>

        {/* 4 Interactive Modular Games Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="platform-games-grid">
          
          {/* Card 1: Quiz Live */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 flex flex-col justify-between hover:border-indigo-500 hover:shadow-lg transition-all duration-150 relative group">
            <div className="space-y-3">
              <div className="w-12 h-12 bg-indigo-50 border border-indigo-150 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl shadow-xs">
                🎯
              </div>
              <h3 className="text-lg font-black text-slate-800 font-sans">Quiz Live</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-sans">
                El clásico juego de opción múltiple con tiempo límite y tabla de posiciones. Perfecto para revivir la competitividad sana y repasar conceptos de forma colectiva.
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedDashboardGame("quiz_live");
                setHostingGameType("quiz_live");
              }}
              className="mt-6 w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>Crear Juego</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {/* Card 2: 100 Mexicanos Dijeron */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 flex flex-col justify-between hover:border-amber-500 hover:shadow-lg transition-all duration-150 relative group">
            <div className="space-y-3">
              <div className="w-12 h-12 bg-amber-50 border border-amber-150 text-amber-600 rounded-2xl flex items-center justify-center text-2xl shadow-xs">
                🇲🇽
              </div>
              <h3 className="text-lg font-black text-slate-800 font-sans">100 Mexicanos Dijeron</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-sans">
                Adivina las respuestas más comunes de encuestas colectivas. Permite configurar equipos, buzzer (timbre) interactivo, acumulación de puntos y límite de 3 errores.
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedDashboardGame("mexicanos");
                setHostingGameType("mexicanos");
              }}
              className="mt-6 w-full py-3 bg-amber-600 hover:bg-amber-700 text-slate-950 font-black text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>Crear Juego</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {/* Card 3: Jeopardy */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 flex flex-col justify-between hover:border-indigo-600 hover:shadow-lg transition-all duration-150 relative group">
            <div className="space-y-3">
              <div className="w-12 h-12 bg-indigo-50 border border-indigo-150 text-indigo-700 rounded-2xl flex items-center justify-center text-2xl shadow-xs">
                🧠
              </div>
              <h3 className="text-lg font-black text-slate-800 font-sans">Jeopardy</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-sans">
                Explora un gran tablero modular dividido por puntajes y categorías. Los equipos piden desafíos de 200 a 1000 puntos y marcan sus logros en tiempo real.
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedDashboardGame("jeopardy");
                setHostingGameType("jeopardy");
              }}
              className="mt-6 w-full py-3 bg-indigo-650 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>Crear Juego</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {/* Card 4: Modo Examen */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 flex flex-col justify-between hover:border-emerald-600 hover:shadow-lg transition-all duration-150 relative group">
            <div className="space-y-3">
              <div className="w-12 h-12 bg-emerald-50 border border-emerald-150 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl shadow-xs">
                📝
              </div>
              <h3 className="text-lg font-black text-slate-800 font-sans">Modo Examen</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-sans">
                Sin ranking, sin podio y a tiempo libre. Evalúa de forma silenciosa e individual. Descarga planillas interactivas automatizadas directo en Microsoft Excel.
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedDashboardGame("exam");
                setHostingGameType("exam");
              }}
              className="mt-6 w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>Crear Juego</span>
              <ArrowRight size={13} />
            </button>
          </div>

        </div>

        {/* Bancos de Juegos Independientes */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-4 shadow-sm" id="questionnaire-banks-summary">
          <div className="border-b border-slate-150 pb-3">
            <h3 className="text-sm font-black text-slate-800 font-sans flex items-center gap-2">
              📂 Bancos de Juegos Independientes
            </h3>
            <p className="text-[11px] text-slate-400 font-sans tracking-wide">
              Cada modo cuenta con su propia plantilla, formato y base separada de reactivos. Haz clic para administrar su banco.
            </p>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
            <button 
              onClick={() => {
                setSelectedDashboardGame("quiz_live");
                setHostingGameType("quiz_live");
              }}
              className="bg-indigo-50/55 border border-indigo-100 hover:border-indigo-400 p-4 rounded-2xl text-center cursor-pointer transition-all hover:shadow-md"
            >
              <div className="text-xl">🎯</div>
              <p className="text-xs font-black text-indigo-950 mt-1.5 leading-none">Quiz Live</p>
              <span className="text-[10px] text-indigo-700 font-mono font-semibold mt-2 inline-block bg-indigo-100/70 px-2 py-0.5 rounded-full">{bankCounts.quiz_live} cuestionarios</span>
            </button>

            <button 
              onClick={() => {
                setSelectedDashboardGame("exam");
                setHostingGameType("exam");
              }}
              className="bg-emerald-50/55 border border-emerald-100 hover:border-emerald-400 p-4 rounded-2xl text-center cursor-pointer transition-all hover:shadow-md"
            >
              <div className="text-xl">📝</div>
              <p className="text-xs font-black text-emerald-950 mt-1.5 leading-none">Modo Examen</p>
              <span className="text-[10px] text-emerald-700 font-mono font-semibold mt-2 inline-block bg-emerald-100/70 px-2 py-0.5 rounded-full">{bankCounts.exam_mode} cuestionarios</span>
            </button>

            <button 
              onClick={() => {
                setSelectedDashboardGame("mexicanos");
                setHostingGameType("mexicanos");
              }}
              className="bg-amber-50/55 border border-amber-100 hover:border-amber-400 p-4 rounded-2xl text-center cursor-pointer transition-all hover:shadow-md"
            >
              <div className="text-xl">🇲🇽</div>
              <p className="text-xs font-black text-amber-950 mt-1.5 leading-none">100 Mexicanos</p>
              <span className="text-[10px] text-amber-700 font-mono font-semibold mt-2 inline-block bg-amber-100/70 px-2 py-0.5 rounded-full">{bankCounts.mexicanos} cuestionarios</span>
            </button>

            <button 
              onClick={() => {
                setSelectedDashboardGame("jeopardy");
                setHostingGameType("jeopardy");
              }}
              className="bg-indigo-50/30 border border-indigo-150/50 hover:border-indigo-400 p-4 rounded-2xl text-center cursor-pointer transition-all hover:shadow-md"
            >
              <div className="text-xl">🏆</div>
              <p className="text-xs font-black text-indigo-950 mt-1.5 leading-none">Jeopardy</p>
              <span className="text-[10px] text-indigo-650 font-mono font-semibold mt-2 inline-block bg-slate-200 px-2 py-0.5 rounded-full">{bankCounts.jeopardy} cuestionarios</span>
            </button>
          </div>
        </div>

        {/* Network and connectivity diagnostics section */}
        <NetworkDiagnostic />

        {/* Persistent server IP footer */}
        {connInfo && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 border border-indigo-150 rounded-lg flex items-center justify-center text-indigo-600">
                <Users size={20} />
              </div>
              <div className="text-left">
                <span className="text-[9px] text-slate-400 font-mono uppercase font-bold block">IP de Red del Servidor</span>
                <span className="text-xs font-bold text-slate-700 font-mono">{connInfo.preferredIP}</span>
              </div>
            </div>

            <div className="text-center sm:text-right">
              <span className="text-[10px] text-slate-400 block font-sans">Los alumnos se conectan en su celular usando la URL:</span>
              <span className="text-xs font-bold text-indigo-600 font-mono select-all bg-indigo-50 py-1 px-2.5 rounded border border-indigo-100">{connInfo.appUrl}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  const getDashboardGameName = () => {
    if (selectedDashboardGame === "quiz_live") return "Quiz Live";
    if (selectedDashboardGame === "mexicanos") return "100 Mexicanos Dijeron";
    if (selectedDashboardGame === "jeopardy") return "Jeopardy";
    if (selectedDashboardGame === "exam") return "Modo Examen";
    return "";
  };

  return (
    <div className="space-y-6" id="teacher-dashboard-panel">
      
      {/* Visual top hero banner with Back button */}
      <div className="bg-white border border-slate-200 p-6 sm:p-8 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-md shadow-slate-150/50">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-indigo-650 font-mono text-xs uppercase font-extrabold tracking-widest">
            <Tv size={14} className="animate-pulse" />
            <span>Paso 2: Modo {getDashboardGameName()}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Cuestionarios Coincidentes</h2>
          <p className="text-slate-500 text-xs sm:text-sm max-w-xl">
            Selecciona un cuestionario para inicializar tu sesión de <strong>{getDashboardGameName()}</strong> en el salón de clase.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 shrink-0 w-full md:w-auto">
          <button
            onClick={() => setSelectedDashboardGame(null)}
            className="flex items-center justify-center gap-2 bg-slate-150 text-slate-750 hover:bg-slate-200 font-sans font-extrabold px-5 py-3 rounded-xl shadow-xs transition-all text-xs cursor-pointer border border-slate-200"
          >
            <span>« Menú de Actividades</span>
          </button>

          <button
            onClick={() => {
              const mappedType = selectedDashboardGame === "exam" ? "exam_mode" : selectedDashboardGame;
              onImport(mappedType || "quiz_live");
            }}
            className="flex items-center justify-center gap-2 bg-slate-50 border border-slate-200 text-slate-750 hover:bg-slate-100 font-sans font-bold px-5 py-3 rounded-xl shadow-sm transition-all text-xs cursor-pointer"
            id="btn-import-quiz"
          >
            <ListPlus size={16} />
            <span>Importar</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs sm:text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Grid of Quizzes */}
      {loading ? (
        <div className="text-slate-500 text-center py-20 flex flex-col items-center gap-2">
          <RefreshCw size={24} className="animate-spin text-indigo-600" />
          <p className="text-sm font-sans font-bold">Buscando cuestionarios guardados...</p>
        </div>
      ) : quizzes.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-3xl border border-slate-200 text-slate-500 space-y-4 shadow-sm">
          <HelpCircle size={40} className="mx-auto text-slate-300" />
          <div>
            <h4 className="font-bold text-slate-800">No hay cuestionarios listos</h4>
            <p className="text-xs text-slate-500 mt-1">Crea tu primer cuestionario de aula utilizando el botón de arriba.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="group bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-500/75 p-6 rounded-2xl flex flex-col justify-between gap-5 transition-all duration-150 shadow-sm"
              id={`quiz-card-${quiz.id}`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  {quiz.questions && (
                    <span className="bg-indigo-50 text-indigo-700 text-[10px] px-2.5 py-1 rounded-full font-sans font-extrabold uppercase border border-indigo-100">
                      Preguntas: {quiz.questions.length}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 font-mono">
                    {quiz.createdAt ? new Date(quiz.createdAt).toLocaleDateString() : ""}
                  </span>
                </div>

                <h3 className="text-md sm:text-lg font-bold text-slate-900 font-sans tracking-tight leading-snug">
                  {quiz.title}
                </h3>
                
                {quiz.description && (
                  <p className="text-xs sm:text-sm text-slate-500 line-clamp-2 leading-relaxed">
                    {quiz.description}
                  </p>
                )}
              </div>

              {/* Card Actions */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onEdit(quiz)}
                    className="flex items-center gap-1 text-slate-600 hover:text-indigo-600 bg-slate-50 p-2 rounded-lg text-xs font-semibold hover:bg-indigo-50 transition-colors border border-slate-200 cursor-pointer"
                    title="Editar cuestionario"
                    id={`btn-edit-quiz-${quiz.id}`}
                  >
                    <Edit3 size={13} />
                    <span>Editar</span>
                  </button>
                  
                  <button
                    onClick={(e) => handleDeleteQuiz(quiz.id, e)}
                    className="flex items-center gap-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 bg-slate-50 p-2 rounded-lg text-xs border border-slate-200 cursor-pointer"
                    title="Eliminar cuestionario"
                    id={`btn-delete-quiz-${quiz.id}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <button
                  onClick={() => handleHostGame(quiz.id)}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold font-sans text-xs shadow-sm transition-transform active:scale-[0.98] cursor-pointer"
                  id={`btn-host-quiz-${quiz.id}`}
                >
                  <Play size={12} className="fill-white text-white" />
                  <span>Lanzar Partida</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Connection Info footer box for teachers */}
      {connInfo && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 border border-indigo-150 rounded-lg flex items-center justify-center text-indigo-600">
              <Users size={20} />
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-mono uppercase font-bold block">IP de Red del Servidor</span>
              <span className="text-xs font-bold text-slate-700 font-mono">{connInfo.preferredIP}</span>
            </div>
          </div>

          <div className="text-center sm:text-right">
            <span className="text-[10px] text-slate-400 block font-sans">Los alumnos se conectan en su celular usando la URL:</span>
            <span className="text-xs font-bold text-indigo-600 font-mono select-all bg-indigo-50 py-1 px-2.5 rounded border border-indigo-100">{connInfo.appUrl}</span>
          </div>
        </div>
      )}

      {/* ----------------- GAME CONFIGURATION MODAL (Setup Game Mode & Teams) ----------------- */}
      {hostingQuizId && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto" id="game-setup-modal">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-up">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50 shrink-0">
              <h3 className="text-xl font-extrabold text-slate-900 font-sans">Configuración de Partida</h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">Elige el modo en que participarán los alumnos en esta partida colaborativa.</p>
            </div>

            {/* Content Core Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Selector de Modo */}
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 block font-sans">Modo de Juego</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Modo Individual Card */}
                  <div 
                    onClick={() => setSetupGameMode("individual")}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex gap-4 items-center ${
                      setupGameMode === "individual" 
                        ? "border-indigo-600 bg-indigo-50/50 shadow-sm" 
                        : "border-slate-200 hover:border-slate-350 bg-white"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                      <Trophy size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-800">Modo Individual</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Cada alumno compite por su propia cuenta para lograr puntaje individual.</p>
                    </div>
                  </div>

                  {/* Modo Equipos Card */}
                  <div 
                    onClick={() => setSetupGameMode("teams")}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex gap-4 items-center ${
                      setupGameMode === "teams" 
                        ? "border-indigo-600 bg-indigo-50/50 shadow-sm" 
                        : "border-slate-200 hover:border-slate-355 bg-white"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                      <Users size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-800">Modo por Equipos</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Los alumnos se unen a equipos. Los puntajes se acumulan por escuadras cooperativas.</p>
                    </div>
                  </div>

                </div>
              </div>

              {/* Seccion de Configuracion de Equipos */}
              {setupGameMode === "teams" && (
                <div className="space-y-4 animate-fade-in pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 block font-sans">Configura tus Equipos ({setupTeams.length}/8)</h4>
                      <p className="text-[10px] text-slate-500 font-medium">Crea entre 2 y 8 equipos para la partida colaborativa.</p>
                    </div>

                    <button
                      onClick={() => handleAddSetupTeam()}
                      disabled={setupTeams.length >= 8}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold leading-none cursor-pointer"
                    >
                      + Agregar Equipo
                    </button>
                  </div>

                  {/* List of current Teams */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1">
                    {setupTeams.map((team) => (
                      <div 
                        key={team.id}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2.5 shadow-xs relative group"
                      >
                        {/* Drag and Color representation */}
                        <div 
                          className="w-3.5 h-3.5 rounded-full shrink-0 border border-slate-300"
                          style={{ backgroundColor: team.color }}
                        />

                        {/* Icon field */}
                        <input 
                          type="text" 
                          maxLength={2}
                          value={team.icon}
                          onChange={(e) => handleUpdateSetupTeam(team.id, { icon: e.target.value })}
                          className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-center text-sm font-bold shadow-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          title="Ícono / Emoji"
                        />

                        {/* Name field */}
                        <input 
                          type="text" 
                          maxLength={25}
                          value={team.name}
                          onChange={(e) => handleUpdateSetupTeam(team.id, { name: e.target.value })}
                          className="flex-1 min-w-0 bg-white border border-slate-200 px-2 py-1.5 text-xs font-bold rounded-lg shadow-xs text-slate-700 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          placeholder="Nombre del equipo..."
                        />

                        {/* Color Picker HTML5 */}
                        <input 
                          type="color" 
                          value={team.color}
                          onChange={(e) => handleUpdateSetupTeam(team.id, { color: e.target.value })}
                          className="w-8 h-8 rounded cursor-pointer border border-slate-200 shrink-0 p-0"
                          title="Elegir Color"
                        />

                        {/* Delete helper btn */}
                        <button
                          onClick={() => handleRemoveSetupTeam(team.id)}
                          disabled={setupTeams.length <= 2}
                          className="text-rose-500 hover:text-rose-600 hover:bg-rose-55 p-1.5 rounded-lg disabled:opacity-30 cursor-pointer shrink-0"
                          title="Eliminar Equipo"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Quick Addition Section with Presets */}
                  <div className="space-y-2 pt-2">
                    <span className="text-[10px] font-bold text-slate-400 font-sans tracking-wide block">EQUIPOS PREDEFINIDOS (Presiona para agregar rápido)</span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { name: "Agaves", icon: "🌱", color: "#10b981" },
                        { name: "Mariachis", icon: "🎺", color: "#f59e0b" },
                        { name: "Tortas Ahogadas", icon: "🥖", color: "#f97316" },
                        { name: "Leones", icon: "🦁", color: "#ef4444" },
                        { name: "Águilas", icon: "🦅", color: "#3b82f6" },
                        { name: "Robots", icon: "🤖", color: "#6366f1" },
                        { name: "Científicos", icon: "⚗️", color: "#a855f7" },
                        { name: "Astronautas", icon: "🚀", color: "#06b6d4" }
                      ].map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => {
                            if (setupTeams.length >= 8) return;
                            if (setupTeams.some(t => t.name.toLowerCase() === preset.name.toLowerCase())) return;
                            handleAddSetupTeam(preset);
                          }}
                          disabled={setupTeams.length >= 8 || setupTeams.some(t => t.name.toLowerCase() === preset.name.toLowerCase())}
                          className="px-2 py-1 bg-white hover:bg-indigo-50 border border-slate-200 text-slate-600 hover:text-indigo-600 disabled:opacity-40 font-ans text-[10px] font-bold rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                        >
                          <span>{preset.icon}</span>
                          <span>{preset.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              )}

            </div>

            {/* Footer buttons */}
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setHostingQuizId(null)}
                className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancelar
              </button>
              
              <button
                type="button"
                onClick={commitHostGame}
                disabled={setupGameMode === "teams" && (setupTeams.length < 2 || setupTeams.length > 8)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-100 cursor-pointer"
              >
                Lanzar Cuestionario
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
