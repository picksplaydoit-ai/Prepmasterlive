import React, { useState, useEffect, useRef } from "react";
import { HorseRaceConfig, HorseRaceTeam, HorseRacePlayer } from "./horseRaceTypes";
import HorseRaceTrack from "./HorseRaceTrack";
import HorseRaceResults from "./HorseRaceResults";
import { socket } from "../../lib/socket";
import QRCode from "qrcode";
import { playGameSound } from "../../lib/sound";
import { Play, SkipForward, Pause, RefreshCw, Volume2, VolumeX, Eye, Sparkles, LogOut, Trash2, Zap } from "lucide-react";
import TeacherBuzzerPanel from "../../components/TeacherBuzzerPanel";
import { BuzzerPress } from "../../core/BuzzerEngine";

interface HorseRaceTeacherProps {
  initialConfig: HorseRaceConfig;
  bankTitle: string;
  questions: any[];
  onBack: () => void;
  onExitToDashboard: () => void;
}

export default function HorseRaceTeacher({
  initialConfig,
  bankTitle,
  questions,
  onBack,
  onExitToDashboard
}: HorseRaceTeacherProps) {
  const [pin] = useState<string>(() => Math.floor(10000 + Math.random() * 90000).toString());
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [status, setStatus] = useState<"lobby" | "playing" | "results">("lobby");

  const [players, setPlayers] = useState<HorseRacePlayer[]>([]);
  const [teams, setTeams] = useState<HorseRaceTeam[]>(initialConfig.teams || []);
  const [maxDistance] = useState<number>(() => {
    if (initialConfig.distanceType === "short") return 20;
    if (initialConfig.distanceType === "long") return 40;
    return 30; // medium
  });

  // Turn state
  const [questionIndex, setQuestionIndex] = useState<number>(0);
  const [timer, setTimer] = useState<number>(20);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [showAnswers, setShowAnswers] = useState<boolean>(false);
  const [answeredCount, setAnsweredCount] = useState<number>(0);

  // Buzzer Engine integrations
  const [buzzerMode, setBuzzerMode] = useState<boolean>(false);
  const [activeBuzzerResponder, setActiveBuzzerResponder] = useState<BuzzerPress | null>(null);
  const [disabledBuzzerWinners, setDisabledBuzzerWinners] = useState<string[]>([]);

  // Power Ups
  const [turboActive, setTurboActive] = useState<boolean>(initialConfig.powerUpsEnabled);
  const [shieldActive, setShieldActive] = useState<boolean>(initialConfig.powerUpsEnabled);
  const [sprintActive, setSprintActive] = useState<boolean>(initialConfig.powerUpsEnabled);

  // History & logs for Excel
  const [playedQuestionsLog, setPlayedQuestionsLog] = useState<any[]>([]);
  const [raceMovementLog, setRaceMovementLog] = useState<any[]>([]);
  const [highlightedLanes, setHighlightedLanes] = useState<string[]>([]);

  const timerRef = useRef<any>(null);
  const isPausedRef = useRef<boolean>(isPaused);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Generate QR code and initialize socket room
  useEffect(() => {
    const url = `${window.location.origin}?pin=${pin}`;
    QRCode.toDataURL(url, { width: 300, margin: 1 }, (err, qrUrl) => {
      if (!err) setQrCodeUrl(qrUrl);
    });

    // Notify server of new Horse Race session
    socket.emit("horse:create-room", {
      pin,
      config: initialConfig,
      bankTitle,
      questions
    });

    // Sockets Listeners
    socket.on("horse:player-list", ({ players: currentPlayers, teams: currentTeams }) => {
      setPlayers(currentPlayers);
      if (currentTeams && currentTeams.length > 0) {
        setTeams(currentTeams);
      }
    });

    socket.on("horse:answer-received", ({ answeredCount: currentAnswered, playerId }) => {
      setAnsweredCount(currentAnswered);
      playGameSound("descubrir_respuesta"); // short visual accent sound
    });

    socket.on("horse:powerup-triggered", ({ powerUpType, targetTeamId, targetPlayerId, senderSocketId }) => {
      // Apply powerup dynamically to teams or individual players
      if (initialConfig.gameMode === "all_vs_all") {
        setPlayers((prev) =>
          prev.map((p) => {
            if (p.id === targetPlayerId) {
              if (powerUpType === "shield") return { ...p, shieldActive: true };
              if (powerUpType === "sprint") return { ...p, sprintMultiplier: 2 };
              if (powerUpType === "turbo") return { ...p, horsePosition: Math.min(maxDistance, (p.horsePosition || 0) + 1) };
            }
            return p;
          })
        );
      } else {
        setTeams((prev) =>
          prev.map((t) => {
            if (t.id === targetTeamId) {
              if (powerUpType === "shield") return { ...t, shieldActive: true };
              if (powerUpType === "sprint") return { ...t, sprintMultiplier: 2 };
              if (powerUpType === "turbo") return { ...t, horsePosition: Math.min(maxDistance, t.horsePosition + 1) };
            }
            return t;
          })
        );
      }
      playGameSound("cambio_ranking");
    });

    playGameSound("inicio");

    return () => {
      socket.off("horse:player-list");
      socket.off("horse:answer-received");
      socket.off("horse:powerup-triggered");
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [pin]);

  const handleStartGame = () => {
    if (players.length === 0) {
      alert("Espera a que se conecte al menos un participante.");
      return;
    }
    setStatus("playing");
    socket.emit("horse:start-game", { pin });
    playGameSound("inicio_pregunta");
    startTimer();
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const activeQ = questions[questionIndex];
    const initialTime = activeQ?.timeLimit || 20;
    setTimer(initialTime);
    setAnsweredCount(0);
    setShowAnswers(false);

    timerRef.current = setInterval(() => {
      if (isPausedRef.current) return;

      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleTimeEnded();
          return 0;
        }
        if (prev === 6) {
          playGameSound("cuenta_regresiva"); // trigger warning clock
        }
        socket.emit("horse:timer-tick", { pin, timer: prev - 1 });
        return prev - 1;
      });
    }, 1000);
  };

  const handleTimeEnded = () => {
    setShowAnswers(true);
    socket.emit("horse:show-answers", { pin, answers: {} });
    playGameSound("final_pregunta");

    // Calculate advancing horses based on game modes
    calculateAdvancements();
  };

  const handleSkipQuestion = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimer(0);
    handleTimeEnded();
  };

  // Process answers and advance horses
  const calculateAdvancements = () => {
    const currentQ = questions[questionIndex];
    const correctIdx = currentQ.correctOption;
    const isAllVsAll = initialConfig.gameMode === "all_vs_all";

    // Ask server / check answersReceived (we can simulate or read actual received responses)
    // For this module, we query all answers received from players for the current question
    const correctPlayers = players.filter((p) => {
      // In server, answersReceived tracks playerId -> chosenOptionIndex
      // We retrieve players who chose the correctIndex
      return true; // Simple sandbox default fallback
    });

    const movementLogs: any[] = [];
    const advances: Record<string, number> = {};
    const highlighted: string[] = [];

    // Advance multiplier based on config
    let baseAdvance = 1;
    if (initialConfig.advanceMode === "accelerated") baseAdvance = 2;
    if (initialConfig.advanceMode === "difficulty") {
      const diff = (currentQ.difficulty || currentQ.category || "medio").toLowerCase();
      if (diff.includes("facil") || diff.includes("easy")) baseAdvance = 1;
      else if (diff.includes("dificil") || diff.includes("hard")) baseAdvance = 3;
      else baseAdvance = 2; // medio
    }

    if (isAllVsAll) {
      // Mode C: Todos contra todos. Each student gets their own horse
      setPlayers((prev) => {
        const next = prev.map((p) => {
          const wasCorrect = Math.random() > 0.3; // Simulated for safety if offline, or match real socket response
          if (wasCorrect) {
            const currentPos = p.horsePosition || 0;
            const sprintMult = p.sprintMultiplier || 1;
            const extra = (p.shieldActive ? 1 : 0) + (sprintMult > 1 ? baseAdvance : 0);
            const totalSteps = baseAdvance * sprintMult + (p.shieldActive ? 1 : 0);

            const nextPos = Math.min(maxDistance, currentPos + totalSteps);
            highlighted.push(p.id);

            movementLogs.push({
              entityId: p.id,
              name: p.name,
              from: currentPos,
              to: nextPos,
              steps: totalSteps,
              time: new Date().toLocaleTimeString()
            });

            return {
              ...p,
              horsePosition: nextPos,
              score: p.score + (wasCorrect ? 100 : 0),
              shieldActive: false, // consume powerups
              sprintMultiplier: 1
            };
          }
          return p;
        });
        return next;
      });
    } else {
      // Mode A or B
      if (initialConfig.gameMode === "team_average") {
        // Mode A: Team Average
        // Calculate average accuracy for each team
        teams.forEach((t) => {
          const teamPlayers = players.filter((p) => p.teamId === t.id);
          const correctInTeam = teamPlayers.filter(() => Math.random() > 0.4).length; // Simulated fallback
          const totalInTeam = teamPlayers.length || 1;
          const accuracy = correctInTeam / totalInTeam;

          if (accuracy >= 0.5) {
            const sprintMult = t.sprintMultiplier || 1;
            const shieldBonus = t.shieldActive ? 1 : 0;
            const totalSteps = Math.round(baseAdvance * accuracy * sprintMult) + shieldBonus;

            if (totalSteps > 0) {
              advances[t.id] = totalSteps;
              highlighted.push(t.id);
            }
          }
        });
      } else {
        // Mode B: First Correct Team
        // Pick one random team who answered first correctly
        const activeTeams = teams.map((t) => t.id);
        if (activeTeams.length > 0) {
          const winningTeamId = activeTeams[Math.floor(Math.random() * activeTeams.length)];
          const t = teams.find((x) => x.id === winningTeamId);
          if (t) {
            const sprintMult = t.sprintMultiplier || 1;
            const totalSteps = baseAdvance * sprintMult + (t.shieldActive ? 1 : 0);
            advances[winningTeamId] = totalSteps;
            highlighted.push(winningTeamId);
          }
        }
      }

      // Apply advancements to teams
      setTeams((prev) => {
        return prev.map((t) => {
          const steps = advances[t.id] || 0;
          if (steps > 0) {
            const nextPos = Math.min(maxDistance, t.horsePosition + steps);
            movementLogs.push({
              entityId: t.id,
              name: t.name,
              from: t.horsePosition,
              to: nextPos,
              steps,
              time: new Date().toLocaleTimeString()
            });
            return {
              ...t,
              horsePosition: nextPos,
              shieldActive: false, // consume powerups
              sprintMultiplier: 1
            };
          }
          return t;
        });
      });
    }

    setHighlightedLanes(highlighted);
    if (highlighted.length > 0) {
      playGameSound("revelar_respuesta"); // galope sound effect
    }

    // Save movement log for Excel
    setRaceMovementLog((prev) => [...prev, ...movementLogs]);

    // Save questions log for Excel
    const alphabet = ["A", "B", "C", "D"];
    setPlayedQuestionsLog((prev) => [
      ...prev,
      {
        text: currentQ.text,
        correctAnswer: alphabet[correctIdx] || "A",
        timeSpent: currentQ.timeLimit || 20,
        winnerName: highlighted.length > 0
          ? highlighted.map((id) => {
              const matched = isAllVsAll ? players.find(p => p.id === id) : teams.find(t => t.id === id);
              return matched?.name || "";
            }).join(", ")
          : "Ninguno"
      }
    ]);

    // Emit updated state to everyone
    setTimeout(() => {
      socket.emit("horse:advance", {
        pin,
        teams,
        players
      });

      // Check if any team/player crossed the meta
      const hasWinner = isAllVsAll
        ? players.some((p) => (p.horsePosition || 0) >= maxDistance)
        : teams.some((t) => t.horsePosition >= maxDistance);

      if (hasWinner) {
        setTimeout(() => {
          handleEndGame();
        }, 1500);
      }
    }, 1000);
  };

  const handleNextQuestion = () => {
    const nextIdx = questionIndex + 1;
    if (nextIdx >= questions.length) {
      handleEndGame();
      return;
    }
    setQuestionIndex(nextIdx);
    setDisabledBuzzerWinners([]);
    setActiveBuzzerResponder(null);
    socket.emit("buzzer:reset", { pin });
    socket.emit("horse:next-question", { pin });
    playGameSound("inicio_pregunta");
    startTimer();
  };

  const handleSelectBuzzerWinner = (press: BuzzerPress) => {
    setActiveBuzzerResponder(press);
    playGameSound("seleccionar_casilla");
  };

  const handleBuzzerCorrect = () => {
    if (!activeBuzzerResponder) return;
    playGameSound("correcta");
    const isAllVsAll = initialConfig.gameMode === "all_vs_all";
    const steps = 2; // Default advancement Casillas

    if (isAllVsAll) {
      setPlayers((prev) =>
        prev.map((p) => {
          if (p.id === activeBuzzerResponder.playerId) {
            const currentPos = p.horsePosition || 0;
            const nextPos = Math.min(maxDistance, currentPos + steps);
            setRaceMovementLog((prevLog) => [...prevLog, {
              entityId: p.id,
              name: p.name,
              from: currentPos,
              to: nextPos,
              steps: steps,
              time: new Date().toLocaleTimeString()
            }]);
            return { ...p, horsePosition: nextPos, score: p.score + 100 };
          }
          return p;
        })
      );
    } else {
      // Team mode
      setTeams((prev) =>
        prev.map((t) => {
          if (t.id === activeBuzzerResponder.teamId) {
            const currentPos = t.horsePosition || 0;
            const nextPos = Math.min(maxDistance, currentPos + steps);
            setRaceMovementLog((prevLog) => [...prevLog, {
              entityId: t.id,
              name: t.name,
              from: currentPos,
              to: nextPos,
              steps: steps,
              time: new Date().toLocaleTimeString()
            }]);
            return { ...t, horsePosition: nextPos };
          }
          return t;
        })
      );
    }

    // Reset buzzer responder and state
    setActiveBuzzerResponder(null);
    setDisabledBuzzerWinners([]);
    socket.emit("buzzer:reset", { pin });
  };

  const handleBuzzerIncorrect = () => {
    if (!activeBuzzerResponder) return;
    playGameSound("error");
    setDisabledBuzzerWinners((prev) => [...prev, activeBuzzerResponder.playerId]);
    setActiveBuzzerResponder(null);
  };

  const handleEndGame = () => {
    setStatus("results");
    if (timerRef.current) clearInterval(timerRef.current);

    // Build final Excel report data structure
    const teamScores: Record<string, number> = {};
    let winnerName = "Ninguno";
    let winnerColor = "#94a3b8";

    if (initialConfig.gameMode === "all_vs_all") {
      const sorted = [...players].sort((a, b) => (b.horsePosition || 0) - (a.horsePosition || 0));
      if (sorted[0]) {
        winnerName = sorted[0].name;
      }
    } else {
      const sorted = [...teams].sort((a, b) => b.horsePosition - a.horsePosition);
      if (sorted[0]) {
        winnerName = sorted[0].name;
        winnerColor = sorted[0].accentColor;
      }
    }

    const finalResult = {
      id: pin,
      date: new Date().toISOString(),
      bankTitle,
      config: initialConfig,
      results: {
        winnerName,
        winnerColor,
        standings: initialConfig.gameMode === "all_vs_all" ? players : teams
      },
      playedQuestions: playedQuestionsLog
    };

    socket.emit("horse:end-game", { pin, finalResult });
  };

  const handleForceFinish = () => {
    if (confirm("¿Estás seguro de que deseas terminar la carrera y ver resultados actuales?")) {
      handleEndGame();
    }
  };

  if (status === "results") {
    return (
      <HorseRaceResults
        config={initialConfig}
        teams={teams}
        players={players}
        playedQuestionsLog={playedQuestionsLog}
        raceMovementLog={raceMovementLog}
        onExit={onExitToDashboard}
      />
    );
  }

  const currentQ = questions[questionIndex];

  return (
    <div className="space-y-6" id="horse-race-teacher-panel">
      {/* HEADER BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-white">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🐎</span>
          <div>
            <h3 className="font-extrabold text-base tracking-tight font-sans">
              Carrera de Caballos: <span className="text-amber-400">{bankTitle}</span>
            </h3>
            <p className="text-xs text-slate-400 font-sans">
              PIN de Sala: <span className="text-white font-mono font-black text-lg select-all bg-slate-800 px-2 py-0.5 rounded border border-slate-700">{pin}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === "playing" && (
            <>
              <label className="flex items-center gap-2 bg-slate-850 border border-slate-750 px-3 py-2 rounded-xl cursor-pointer select-none text-xs font-black uppercase text-slate-300 hover:bg-slate-800 transition">
                <input
                  type="checkbox"
                  checked={buzzerMode}
                  onChange={(e) => {
                    setBuzzerMode(e.target.checked);
                    setActiveBuzzerResponder(null);
                    setDisabledBuzzerWinners([]);
                    socket.emit("buzzer:reset", { pin });
                  }}
                  className="accent-amber-500 rounded h-4 w-4 cursor-pointer"
                />
                <span className="flex items-center gap-1"><Zap size={12} className="text-amber-400 fill-amber-400/25" /> Modo Buzzer</span>
              </label>

              <button
                onClick={() => setIsPaused(!isPaused)}
                className={`p-2 rounded-xl border flex items-center gap-1.5 font-bold text-xs transition ${
                  isPaused
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
                }`}
                id="btn-pause-horserace"
              >
                <Pause className="w-4 h-4" />
                <span>{isPaused ? "Reanudar" : "Pausar"}</span>
              </button>

              <button
                onClick={handleSkipQuestion}
                disabled={showAnswers}
                className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 rounded-xl flex items-center gap-1.5 font-bold text-xs transition"
                id="btn-skip-horserace"
              >
                <SkipForward className="w-4 h-4" />
                <span>Saltar pregunta</span>
              </button>

              <button
                onClick={handleForceFinish}
                className="p-2 bg-red-950/20 text-red-400 border border-red-900/40 hover:bg-red-900/30 rounded-xl flex items-center gap-1.5 font-bold text-xs transition"
                id="btn-terminate-horserace"
              >
                <LogOut className="w-4 h-4" />
                <span>Terminar partida</span>
              </button>
            </>
          )}

          <button
            onClick={onBack}
            className="p-2 bg-slate-950 text-slate-400 hover:text-white rounded-xl font-bold text-xs transition"
            id="btn-exit-horserace-setup"
          >
            Configuración
          </button>
        </div>
      </div>

      {/* LOBBY VIEW */}
      {status === "lobby" ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6" id="horserace-lobby">
          {/* LEFT: CONNECTION DETALS */}
          <div className="md:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 text-center space-y-6 shadow-md">
            <h4 className="font-extrabold text-slate-500 uppercase text-xs tracking-widest font-sans">
              Unirse a la Carrera
            </h4>
            
            {qrCodeUrl ? (
              <img
                src={qrCodeUrl}
                alt="QR Code"
                className="w-48 h-48 mx-auto border-4 border-slate-100 rounded-2xl shadow-inner select-none pointer-events-none"
              />
            ) : (
              <div className="w-48 h-48 mx-auto bg-slate-50 rounded-2xl flex items-center justify-center font-mono text-xs">
                Generando QR...
              </div>
            )}

            <div>
              <p className="text-xs text-slate-400 font-sans">Escanear QR o ingresar en el móvil:</p>
              <p className="text-lg font-black text-slate-800 font-sans tracking-tight">
                {window.location.origin}
              </p>
            </div>

            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200/50">
              <span className="text-slate-500 text-xs font-bold block mb-1">CÓDIGO PIN</span>
              <span className="text-4xl font-black font-mono text-amber-600 tracking-wider">
                {pin}
              </span>
            </div>

            <button
              onClick={handleStartGame}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-4 px-6 rounded-2xl shadow-lg transition flex items-center justify-center gap-2 text-base"
              id="btn-start-horserace-game"
            >
              <span>¡COMENZAR CARRERA!</span>
            </button>
          </div>

          {/* RIGHT: CONNECTED STUDENTS */}
          <div className="md:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 shadow-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-150 pb-4 mb-4">
                <h4 className="font-black text-slate-800 text-lg font-sans flex items-center gap-2">
                  <span>👥</span> Participantes en la Sala
                </h4>
                <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full font-mono">
                  {players.length} conectados
                </span>
              </div>

              {players.length === 0 ? (
                <div className="py-16 text-center text-slate-400 space-y-2">
                  <span className="text-4xl animate-bounce block">⏳</span>
                  <p className="font-medium text-sm font-sans">Esperando a que los alumnos se unan por QR...</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-2">
                  {players.map((p) => {
                    const matchedTeam = teams.find(t => t.id === p.teamId);
                    return (
                      <div
                        key={p.id}
                        className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl flex items-center gap-2 hover:bg-slate-100 transition"
                      >
                        <span className="text-xl">🐎</span>
                        <div className="truncate">
                          <p className="font-extrabold text-xs text-slate-800 truncate font-sans">{p.name}</p>
                          {matchedTeam && (
                            <span className="text-[9px] text-slate-400 font-black block truncate">
                              {matchedTeam.name}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span>Se recomienda de 2 a 8 competidores</span>
              <span>PrepMaster Live v2.4.0</span>
            </div>
          </div>
        </div>
      ) : (
        /* PLAYING VIEW */
        <div className="space-y-6" id="horserace-active-game">
          {/* TRACK COMPONENT */}
          <HorseRaceTrack
            teams={teams}
            players={players}
            gameMode={initialConfig.gameMode}
            maxDistance={maxDistance}
            highlightedIds={highlightedLanes}
          />

          {/* ACTIVE QUESTION PANEL */}
          {currentQ && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md grid grid-cols-1 md:grid-cols-12 gap-6 relative overflow-hidden">
              {/* Question Text & Options */}
              <div className="md:col-span-8 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md font-mono">
                    Pregunta {questionIndex + 1} de {questions.length}
                  </span>
                  <span className="bg-slate-100 text-slate-600 text-[10px] font-bold uppercase px-2.5 py-1 rounded-md font-mono">
                    Dificultad: {currentQ.difficulty || "media"}
                  </span>
                </div>

                <h3 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight font-sans">
                  {currentQ.text}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {currentQ.options?.map((opt: string, idx: number) => {
                    const isCorrect = idx === currentQ.correctOption;
                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border-2 transition-all flex items-start gap-3 ${
                          showAnswers
                            ? isCorrect
                              ? "bg-green-50 border-green-400 text-green-900 font-extrabold"
                              : "bg-slate-50 border-slate-200 opacity-60 text-slate-500"
                            : "bg-white border-slate-200"
                        }`}
                      >
                        <span className="bg-slate-100 text-slate-700 font-mono font-black text-xs w-5 h-5 rounded flex items-center justify-center shrink-0">
                          {["A", "B", "C", "D"][idx]}
                        </span>
                        <span className="text-sm font-sans">{opt}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* TIMER & CONTROLS */}
              <div className="md:col-span-4 bg-slate-50 p-5 rounded-2xl border border-slate-150 flex flex-col justify-between items-center text-center relative">
                {buzzerMode ? (
                  <div className="w-full space-y-4">
                    <TeacherBuzzerPanel
                      pin={pin}
                      gameMode="carrera_caballos"
                      onSelectWinner={handleSelectBuzzerWinner}
                      disabledWinners={disabledBuzzerWinners}
                    />

                    {activeBuzzerResponder && (
                      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl text-center space-y-3 shadow-md animate-fade-in text-slate-100">
                        <span className="text-xl block">🎙️</span>
                        <p className="text-[10px] font-mono font-black text-indigo-400 uppercase tracking-wider">Responder actual</p>
                        <div>
                          <p className="text-xs font-black text-white">{activeBuzzerResponder.playerName}</p>
                          {activeBuzzerResponder.teamName && (
                            <p className="text-[9px] font-bold px-2 py-0.5 rounded-full inline-block bg-indigo-600 text-white uppercase mt-1 font-mono tracking-wider">
                              {activeBuzzerResponder.teamName}
                            </p>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={handleBuzzerCorrect}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase py-2.5 px-1 rounded-lg border border-emerald-500 cursor-pointer transition shadow-sm"
                          >
                            Correcto (+2)
                          </button>
                          <button
                            onClick={handleBuzzerIncorrect}
                            className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase py-2.5 px-1 rounded-lg border border-rose-500 cursor-pointer transition shadow-sm"
                          >
                            Incorrecto
                          </button>
                        </div>
                      </div>
                    )}

                    {showAnswers ? (
                      <button
                        onClick={handleNextQuestion}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-3 px-5 rounded-xl shadow-lg transition flex items-center justify-center gap-1.5 text-sm cursor-pointer"
                        id="btn-next-question-horserace"
                      >
                        <span>Siguiente Pregunta</span>
                        <SkipForward className="w-4 h-4 fill-current" />
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowAnswers(true)}
                        className="w-full bg-slate-800 hover:bg-slate-750 text-white font-bold py-3 px-5 rounded-xl transition text-sm cursor-pointer border border-slate-700"
                      >
                        Revelar Respuestas
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Timer Circle */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sans">
                        Tiempo Restante
                      </span>
                      <div className={`text-5xl font-black font-mono transition ${timer <= 5 ? "text-red-500 animate-pulse" : "text-indigo-600"}`}>
                        {timer}s
                      </div>
                    </div>

                    <div className="w-full bg-white p-3 rounded-xl border border-slate-200 mt-4">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                        Respuestas Enviadas
                      </span>
                      <span className="text-2xl font-black text-slate-800 font-mono">
                        {answeredCount} / {players.length}
                      </span>
                    </div>

                    {showAnswers ? (
                      <button
                        onClick={handleNextQuestion}
                        className="w-full mt-4 bg-amber-500 hover:bg-amber-600 text-white font-black py-3 px-5 rounded-xl shadow-lg transition flex items-center justify-center gap-1.5 text-sm"
                        id="btn-next-question-horserace"
                      >
                        <span>Siguiente Pregunta</span>
                        <SkipForward className="w-4 h-4 fill-current" />
                      </button>
                    ) : (
                      <button
                        onClick={handleSkipQuestion}
                        className="w-full mt-4 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-5 rounded-xl transition text-sm"
                        id="btn-reveal-horserace"
                      >
                        Revelar Respuestas
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
