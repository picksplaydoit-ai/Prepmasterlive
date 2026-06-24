import React, { useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import { Send, Users, Shield, Zap, RefreshCw, Layers, Trophy, Clock } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Conecta4SessionState } from "./conecta4Types";

interface Conecta4StudentProps {
  socket: Socket;
  pin: string;
  playerName: string;
  playerId: string;
}

export default function Conecta4Student({ 
  socket, 
  pin, 
  playerName, 
  playerId 
}: Conecta4StudentProps) {
  const [session, setSession] = useState<Conecta4SessionState | null>(null);
  const [hasJoined, setHasJoined] = useState<boolean>(false);
  const [selectedTeam, setSelectedTeam] = useState<"blue" | "red">("blue");
  
  // Answering states
  const [answeredIndex, setAnsweredIndex] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    // Join Conecta 4 room automatically or let them pick bando
    socket.on("c4:state", (updatedSession: Conecta4SessionState) => {
      setSession(updatedSession);
      const playerObj = updatedSession.players[socket.id || ""];
      if (playerObj) {
        setHasJoined(true);
      }
    });

    socket.on("c4:error", ({ message }: { message: string }) => {
      setErrorMsg(message);
      setTimeout(() => setErrorMsg(""), 3500);
    });

    // Request state on boot
    socket.emit("c4:join", { pin, name: playerName, teamId: selectedTeam, playerId });

    return () => {
      socket.off("c4:state");
      socket.off("c4:error");
    };
  }, [pin]);

  // Track question starts for measuring response speed (crucial tie-breaker!)
  useEffect(() => {
    if (session?.status === "question") {
      setAnsweredIndex(null);
      setStartTime(Date.now());
    }
  }, [session?.status, session?.currentQuestionIndex]);

  const handleJoinLobby = (team: "blue" | "red") => {
    setSelectedTeam(team);
    socket.emit("c4:join", { pin, name: playerName, teamId: team, playerId });
  };

  const handleSubmitAnswer = (optionIdx: number) => {
    if (answeredIndex !== null || session?.status !== "question") return;
    
    const timeTaken = (Date.now() - startTime) / 1000;
    setAnsweredIndex(optionIdx);
    socket.emit("c4:submit-answer", { pin, optionIndex: optionIdx, timeTaken });
  };

  const handleDropToken = (colIndex: number) => {
    if (session?.status !== "drop") return;
    socket.emit("c4:drop-token", { pin, col: colIndex });
  };

  const handleActivatePower = (powerType: "shield" | "double") => {
    if (!session) return;
    const playerTeam = session.players[socket.id || ""]?.teamId as "red" | "blue";
    if (!playerTeam) return;

    if (powerType === "shield") {
      // Find a safe/default column or ask (simplifying to a default active col or target first empty)
      socket.emit("c4:use-power", { pin, team: playerTeam, power: "shield", column: 3 });
    } else if (powerType === "double") {
      socket.emit("c4:use-power", { pin, team: playerTeam, power: "double" });
    }
  };

  if (!session) {
    return (
      <div className="bg-slate-950 min-h-screen text-white flex items-center justify-center font-sans p-6">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Conectando al servidor Conecta 4...</p>
        </div>
      </div>
    );
  }

  const currentPlayer = session.players[socket.id || ""];
  const isProfVsAula = session.config.gameMode === "prof_vs_aula";

  // Pre-join state (e.g. choose color team if mode is "teams")
  if (!hasJoined && session.config.gameMode === "teams") {
    return (
      <div className="bg-slate-950 min-h-screen text-white font-sans flex flex-col justify-center p-6 space-y-6" id="c4-student-team-selection">
        <div className="text-center space-y-2">
          <span className="text-3xl">👥</span>
          <h2 className="text-xl font-black">Selecciona tu Bando Académico</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Elige bando de estudio. Responderán juntos para ganar el turno de tiro.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => handleJoinLobby("blue")}
            className="p-6 bg-blue-600/10 border-2 border-blue-500/40 rounded-2xl flex flex-col items-center justify-center text-center space-y-2 active:scale-95 transition"
            id="join-team-blue-btn"
          >
            <span className="text-blue-400 text-3xl">🔵</span>
            <span className="font-bold text-xs">Equipo Azul</span>
          </button>
          
          <button
            onClick={() => handleJoinLobby("red")}
            className="p-6 bg-red-600/10 border-2 border-red-500/40 rounded-2xl flex flex-col items-center justify-center text-center space-y-2 active:scale-95 transition"
            id="join-team-red-btn"
          >
            <span className="text-red-400 text-3xl">🔴</span>
            <span className="font-bold text-xs">Equipo Rojo</span>
          </button>
        </div>
      </div>
    );
  }

  const playerTeam = currentPlayer?.teamId || "blue";
  const isMyTurnToDrop = session.status === "drop" && session.whosTurn === playerTeam;
  const currentQuestion = session.questions[session.currentQuestionIndex];

  return (
    <div className="bg-slate-950 min-h-screen text-white font-sans flex flex-col justify-between" id="conecta4-student-interface">
      {/* Header */}
      <header className={`border-b border-slate-900 bg-slate-900/40 p-4 flex items-center justify-between ${
        playerTeam === "blue" ? "border-b-blue-600/30" : "border-b-red-600/30"
      }`}>
        <div className="flex items-center gap-2.5">
          <span className="text-lg">{playerTeam === "blue" ? "🔵" : "🔴"}</span>
          <div>
            <h1 className="text-xs font-black tracking-tight">{playerName}</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {isProfVsAula 
                ? "Bando Aula de Alumnos" 
                : playerTeam === "blue" ? "Bando Azul 🔵" : "Bando Rojo 🔴"
              }
            </p>
          </div>
        </div>

        <div className="bg-slate-950/80 px-2.5 py-1 rounded-full text-[10px] font-mono border border-slate-850">
          PIN: {pin}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col justify-center p-6 space-y-6">
        
        {/* Error overlay alert */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div 
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className="bg-red-500/95 text-white text-xs font-bold py-3 px-4 rounded-xl shadow-lg text-center"
              id="c4-error-toast"
            >
              {errorMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* LOBBY WAITING STATE */}
        {session.status === "lobby" && (
          <div className="text-center space-y-4 py-8" id="c4-student-lobby">
            <div className="w-12 h-12 bg-indigo-600/10 rounded-full flex items-center justify-center mx-auto text-indigo-400 animate-pulse">
              <Users size={24} />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-bold">¡Unido a la partida con éxito!</h2>
              <p className="text-[11px] text-slate-400 px-4">
                El Profesor iniciará la partida de Conecta 4 en la pantalla cuando todos estén conectados.
              </p>
            </div>
          </div>
        )}

        {/* ACTIVE QUESTION STATE */}
        {session.status === "question" && currentQuestion && (
          <div className="space-y-5" id="c4-student-question">
            {/* Question title */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] uppercase font-mono font-black text-slate-500">
                <span>Reactivo en curso</span>
                <span className="flex items-center gap-1"><Clock size={11} /> {session.timer}s</span>
              </div>
              <h2 className="text-sm font-bold text-slate-200 leading-normal">
                {currentQuestion.text}
              </h2>
            </div>

            {/* Answer buttons (Touch target at least 44px - py-3.5) */}
            <div className="grid grid-cols-1 gap-2.5">
              {currentQuestion.options.map((option: string, idx: number) => {
                const isSelected = answeredIndex === idx;
                return (
                  <button
                    key={idx}
                    disabled={answeredIndex !== null}
                    onClick={() => handleSubmitAnswer(idx)}
                    className={`w-full py-3.5 px-4 rounded-xl text-xs font-bold text-left flex items-center gap-3 transition-all ${
                      isSelected
                        ? "bg-indigo-600 border-2 border-indigo-500 text-white shadow-md shadow-indigo-600/10"
                        : answeredIndex !== null
                          ? "bg-slate-900/30 border border-slate-850 text-slate-600 cursor-not-allowed"
                          : "bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 active:scale-98 cursor-pointer"
                    }`}
                    id={`c4-option-${idx}-btn`}
                  >
                    <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-[9px] font-black ${
                      isSelected ? "bg-indigo-500 text-white" : "bg-slate-800 text-slate-400"
                    }`}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="flex-1 pr-2 leading-tight">{option}</span>
                  </button>
                );
              })}
            </div>

            {answeredIndex !== null && (
              <p className="text-[10px] text-slate-500 text-center animate-pulse">
                Respuesta registrada. Esperando a los demás compañeros...
              </p>
            )}
          </div>
        )}

        {/* REVEAL STATE */}
        {session.status === "reveal" && currentQuestion && (
          <div className="text-center space-y-5 py-6" id="c4-student-reveal">
            {answeredIndex !== null ? (
              answeredIndex === currentQuestion.correctOption ? (
                <div className="space-y-2">
                  <span className="text-3xl block animate-bounce">🎉</span>
                  <h3 className="text-emerald-400 font-black text-sm">¡Excelente! Tu respuesta es Correcta</h3>
                  <p className="text-[10px] text-slate-400 leading-relaxed px-4">
                    Aportaste precisión a tu bando para tratar de ganar el turno de colocación.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="text-3xl block">❌</span>
                  <h3 className="text-red-400 font-black text-sm">Respuesta Incorrecta</h3>
                  <p className="text-[10px] text-slate-400 leading-relaxed px-4">
                    La opción correcta era: <strong className="text-emerald-400 font-bold">{currentQuestion.options[currentQuestion.correctOption]}</strong>
                  </p>
                </div>
              )
            ) : (
              <div className="space-y-2">
                <span className="text-3xl block">⏳</span>
                <h3 className="text-yellow-400 font-black text-sm">Se agotó el tiempo</h3>
                <p className="text-[10px] text-slate-400">No registraste respuesta en este turno.</p>
              </div>
            )}
          </div>
        )}

        {/* DROP TOKEN COLUMN SELECTION STATE */}
        {session.status === "drop" && (
          <div className="space-y-6 text-center" id="c4-student-drop">
            
            {isMyTurnToDrop ? (
              <div className="space-y-5">
                <div className="space-y-1">
                  <span className="text-3xl block animate-bounce">🎯</span>
                  <h2 className="text-sm font-black text-emerald-400">¡Tu bando ganó el tiro en el tablero!</h2>
                  <p className="text-[11px] text-slate-400 leading-relaxed px-4">
                    Selecciona una columna para dejar caer la ficha. Coordínate para armar 4 en línea.
                  </p>
                </div>

                {/* Big tactical drop buttons (at least 44px height for safe mobile touch targets) */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {[0, 1, 2, 3, 4, 5, 6].map((col) => {
                    const isBlocked = session.blockedColumns[col] > 0;
                    return (
                      <button
                        key={col}
                        disabled={isBlocked}
                        onClick={() => handleDropToken(col)}
                        className={`py-3 px-4 rounded-xl text-xs font-black border flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer ${
                          isBlocked
                            ? "bg-slate-900/30 border-slate-850 text-slate-600 cursor-not-allowed"
                            : "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/10"
                        }`}
                        id={`c4-drop-col-${col}-btn`}
                      >
                        {isBlocked ? (
                          <>
                            <Shield size={12} className="text-emerald-500" />
                            <span>Col {col + 1} Bloq</span>
                          </>
                        ) : (
                          <span>Columna {col + 1}</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Optional powers triggering if enabled */}
                {session.config.specialPowersEnabled && (
                  <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl space-y-3 mt-4 text-left">
                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">
                      Tus Comodines de Bando (1 uso por partida)
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleActivatePower("shield")}
                        disabled={session.powers[playerTeam]?.shield === 0}
                        className="p-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition"
                      >
                        <Shield size={12} className="text-emerald-500" />
                        <span>Escudo (x{session.powers[playerTeam]?.shield})</span>
                      </button>
                      <button
                        onClick={() => handleActivatePower("double")}
                        disabled={session.powers[playerTeam]?.double === 0}
                        className="p-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition"
                      >
                        <Zap size={12} className="text-amber-500" />
                        <span>Doble (x{session.powers[playerTeam]?.double})</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 py-8">
                <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-400">
                  <Clock size={24} />
                </div>
                <div className="space-y-1">
                  <h2 className="text-sm font-bold">Turno de colocación del rival</h2>
                  <p className="text-[11px] text-slate-400 leading-relaxed px-4">
                    {session.whosTurn === "blue" 
                      ? "El bando Azul está decidiendo su movimiento." 
                      : "El bando Rojo está decidiendo su movimiento."
                    }
                  </p>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ENDED STATE */}
        {session.status === "ended" && (
          <div className="text-center space-y-4 py-8 animate-pulse" id="c4-student-ended">
            <Trophy size={48} className="text-yellow-400 mx-auto" />
            <div className="space-y-1">
              <h2 className="text-sm font-black">Partida Finalizada</h2>
              <p className="text-[10px] text-slate-400">
                Mira el tablero principal de la clase para ver el puntaje final y quién obtuvo la victoria absoluta.
              </p>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-[9px] text-slate-600 font-mono select-none">
        MÓDULO ESTUDIANTE — PREPMASTER LIVE
      </footer>
    </div>
  );
}
