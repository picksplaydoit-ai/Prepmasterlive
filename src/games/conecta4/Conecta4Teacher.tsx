import React, { useEffect, useState, useRef } from "react";
import { Socket } from "socket.io-client";
import { Play, RotateCcw, AlertTriangle, Users, Clock, Shield, Zap, RefreshCw, Trophy, ChevronDown, ListChecks, Star } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Conecta4SessionState } from "./conecta4Types";
import { exportConecta4ToExcel } from "./conecta4Types";
import { playGameSound } from "../../lib/sound";

interface Conecta4TeacherProps {
  socket: Socket;
  pin: string;
  config: any;
  questionnaireTitle: string;
  questions: any[];
  onExit: () => void;
  onGameEnd: (finalSession: Conecta4SessionState) => void;
}

export default function Conecta4Teacher({ 
  socket, 
  pin, 
  config, 
  questionnaireTitle, 
  questions, 
  onExit,
  onGameEnd
}: Conecta4TeacherProps) {
  const [session, setSession] = useState<Conecta4SessionState | null>(null);
  const [localTimer, setLocalTimer] = useState<number>(config.timeLimit || 20);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize socket listeners
  useEffect(() => {
    // Create the room
    socket.emit("c4:create-room", { pin, config, questions });

    socket.on("c4:state", (updatedSession: Conecta4SessionState) => {
      setSession(updatedSession);
      setLocalTimer(updatedSession.timer);
    });

    socket.on("c4:sound", ({ type }: { type: string }) => {
      // Play appropriate sound effects
      if (type === "start_turn") {
        playGameSound("conecta4_ganar_turno"); // fallback to appropriate
      } else if (type === "drop") {
        playGameSound("conecta4_ficha");
      } else if (type === "line") {
        playGameSound("conecta4_linea");
      } else if (type === "victory") {
        playGameSound("conecta4_victoria");
      } else if (type === "correct") {
        playGameSound("correct");
      } else if (type === "incorrect") {
        playGameSound("incorrect");
      } else if (type === "countdown") {
        playGameSound("countdown_tick");
      }
    });

    return () => {
      socket.off("c4:state");
      socket.off("c4:sound");
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [pin]);

  // Handle server-synchronized timer ticks
  useEffect(() => {
    if (!session || session.status !== "question") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setLocalTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          // Auto trigger reveal on time out
          socket.emit("c4:show-answers", { pin });
          return 0;
        }
        socket.emit("c4:timer-tick", { pin, timer: prev - 1 });
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session?.status, session?.currentQuestionIndex]);

  if (!session) {
    return (
      <div className="bg-slate-950 min-h-screen flex items-center justify-center text-white font-sans" id="c4-loading-state">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-400 font-bold">Iniciando sala Conecta 4...</p>
        </div>
      </div>
    );
  }

  // Handy helpers
  const startActiveGame = () => {
    socket.emit("c4:start-game", { pin });
  };

  const forceRevealAnswers = () => {
    socket.emit("c4:show-answers", { pin });
  };

  const handleManualDrop = (colIndex: number) => {
    if (session.status !== "drop") return;
    socket.emit("c4:drop-token", { pin, col: colIndex });
  };

  const handleResetBoard = () => {
    socket.emit("c4:reset-board", { pin });
  };

  const handleForceEnd = () => {
    onGameEnd(session);
  };

  const isCellInWinningLine = (r: number, c: number) => {
    if (!session.winnerLine) return false;
    return session.winnerLine.some(([wr, wc]) => wr === r && wc === c);
  };

  // Calculations
  const activePlayers = Object.values(session.players) as any[];
  const totalConnected = activePlayers.length;
  const answeredCount = activePlayers.filter((p) => p.answeredThisQuestion).length;

  const currentQuestion = session.questions[session.currentQuestionIndex];

  return (
    <div className="bg-slate-950 min-h-screen text-white font-sans flex flex-col justify-between overflow-hidden" id="conecta4-teacher-console">
      {/* Upper Status / Controls */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600/10 border border-indigo-500/30 px-4 py-2 rounded-2xl">
            <span className="text-[9px] font-black uppercase text-indigo-400 tracking-wider">SALA PIN</span>
            <p className="text-xl font-black text-indigo-300 font-mono leading-none tracking-wider">{pin}</p>
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight leading-tight">🔵 Conecta 4 Educativo 🔴</h1>
            <p className="text-xs text-slate-400">Banco: <span className="text-slate-200 font-bold">{questionnaireTitle}</span></p>
          </div>
        </div>

        {/* Real-time score indicator */}
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] text-blue-400 uppercase font-black block">Azul / Aula</span>
              <span className="text-2xl font-black text-blue-400 font-mono">{session.scores.blue}</span>
            </div>
            <div className="w-1.5 h-8 bg-blue-600 rounded-full" />
          </div>

          <div className="flex items-center gap-3">
            <div className="w-1.5 h-8 bg-red-600 rounded-full" />
            <div className="text-left">
              <span className="text-[10px] text-red-400 uppercase font-black block">Rojo / Profesor</span>
              <span className="text-2xl font-black text-red-400 font-mono">{session.scores.red}</span>
            </div>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => exportConecta4ToExcel(session)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            id="c4-export-session-btn"
          >
            <AlertTriangle size={14} />
            <span>Exportar</span>
          </button>
          <button
            onClick={handleForceEnd}
            className="px-4 py-2 bg-red-600/20 border border-red-500/20 text-red-300 rounded-xl text-xs font-bold transition hover:bg-red-600 hover:text-white cursor-pointer"
            id="c4-end-session-btn"
          >
            Finalizar Juego
          </button>
        </div>
      </header>

      {/* Main Board & Question Panel */}
      <div className="flex-1 max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        
        {/* Left: 7x6 Connect 4 Board (Col span 7) */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center space-y-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative">
            
            {/* Top Indicator / Column Selectors for teacher override drops */}
            <div className="grid grid-cols-7 gap-3 mb-4 text-center">
              {[0, 1, 2, 3, 4, 5, 6].map((col) => {
                const isBlocked = session.blockedColumns[col] > 0;
                return (
                  <button
                    key={col}
                    onClick={() => handleManualDrop(col)}
                    disabled={session.status !== "drop" || isBlocked}
                    className={`p-1.5 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                      session.status === "drop" && !isBlocked
                        ? "bg-slate-950 border-indigo-500 hover:border-indigo-400 text-indigo-400 active:scale-95"
                        : "bg-slate-950/30 border-slate-850 text-slate-600 cursor-not-allowed"
                    }`}
                    title={isBlocked ? "Bloqueado" : "Ficha aquí"}
                  >
                    {isBlocked ? (
                      <Shield size={12} className="text-emerald-500" />
                    ) : (
                      <ChevronDown size={14} className={session.status === "drop" ? "animate-bounce text-indigo-400" : ""} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Board Grid */}
            <div className="bg-blue-900/10 border-2 border-blue-600/30 rounded-2xl p-4 grid grid-cols-7 gap-3 shadow-inner relative">
              {/* Special Shield overlays on columns */}
              <div className="absolute inset-0 grid grid-cols-7 gap-3 p-4 pointer-events-none">
                {[0, 1, 2, 3, 4, 5, 6].map((col) => {
                  const isBlocked = session.blockedColumns[col] > 0;
                  return (
                    <div key={col} className={`h-full w-full rounded-xl transition-all ${isBlocked ? "bg-emerald-500/10 border-2 border-dashed border-emerald-500/40 flex items-center justify-center backdrop-blur-xs" : ""}`}>
                      {isBlocked && (
                        <div className="bg-emerald-950 border border-emerald-500/30 p-1.5 rounded-full text-emerald-400">
                          <Shield size={16} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Grid Cells */}
              {session.board.map((rowArr, rowIndex) =>
                rowArr.map((cell, colIndex) => {
                  const isWinningCell = isCellInWinningLine(rowIndex, colIndex);
                  return (
                    <div 
                      key={`${rowIndex}-${colIndex}`} 
                      className="aspect-square rounded-full bg-slate-950 shadow-inner flex items-center justify-center relative overflow-hidden"
                    >
                      {cell && (
                        <motion.div
                          initial={{ y: -250, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 120, damping: 14 }}
                          className={`w-11/12 h-11/12 rounded-full shadow-lg ${
                            cell === "blue" 
                              ? "bg-gradient-to-br from-blue-400 to-blue-600 shadow-blue-500/30" 
                              : "bg-gradient-to-br from-red-400 to-red-600 shadow-red-500/30"
                          } ${isWinningCell ? "animate-pulse border-4 border-white shadow-xl scale-105" : ""}`}
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Active Round Status overlay */}
            <AnimatePresence>
              {session.status === "ended" && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-slate-950/90 rounded-3xl flex flex-col items-center justify-center p-6 text-center space-y-4 backdrop-blur-sm z-35"
                >
                  <Trophy size={48} className="text-yellow-400 animate-bounce" />
                  <div className="space-y-1">
                    <h3 className="text-xl font-black">
                      {session.gameWinner 
                        ? `¡Ganador: ${session.gameWinner === "blue" ? "Equipo Azul / Aula 🔵" : "Equipo Rojo / Profesor 🔴"}!`
                        : "¡Partida terminada en Empate!"
                      }
                    </h3>
                    <p className="text-xs text-slate-400">El juego ha finalizado. Puedes jugar otra ronda o descargar el reporte.</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleResetBoard}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-md shadow-indigo-600/15 cursor-pointer"
                    >
                      <RotateCcw size={14} />
                      <span>Jugar Otra Ronda</span>
                    </button>
                    <button
                      onClick={handleForceEnd}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Ver Resultados
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Special powers indicator if enabled */}
          {config.specialPowersEnabled && (
            <div className="w-full max-w-lg bg-slate-900/40 border border-slate-850 p-3.5 rounded-2xl flex justify-around text-xs select-none">
              <div className="flex items-center gap-1.5">
                <span className="text-blue-400 font-bold">Poderes Azul:</span>
                <span className="px-2 py-0.5 bg-slate-800 rounded font-mono text-[10px]" title="Escudo 🛡️">🛡️ {session.powers.blue.shield}</span>
                <span className="px-2 py-0.5 bg-slate-800 rounded font-mono text-[10px]" title="Doble Tiro ⚡">⚡ {session.powers.blue.double}</span>
                <span className="px-2 py-0.5 bg-slate-800 rounded font-mono text-[10px]" title="Intercambio 🔄">🔄 {session.powers.blue.swap}</span>
              </div>
              <div className="w-[1px] bg-slate-800" />
              <div className="flex items-center gap-1.5">
                <span className="text-red-400 font-bold">Poderes Rojo:</span>
                <span className="px-2 py-0.5 bg-slate-800 rounded font-mono text-[10px]" title="Escudo 🛡️">🛡️ {session.powers.red.shield}</span>
                <span className="px-2 py-0.5 bg-slate-800 rounded font-mono text-[10px]" title="Doble Tiro ⚡">⚡ {session.powers.red.double}</span>
                <span className="px-2 py-0.5 bg-slate-800 rounded font-mono text-[10px]" title="Intercambio 🔄">🔄 {session.powers.red.swap}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Question, Timer, & Results panel (Col span 5) */}
        <div className="lg:col-span-5 h-full flex flex-col justify-between space-y-6">
          
          {/* Main Game flow card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex-1 flex flex-col justify-between space-y-6 shadow-2xl relative overflow-hidden">
            
            {/* Lobby state */}
            {session.status === "lobby" && (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 py-12" id="c4-lobby-panel">
                <div className="w-16 h-16 rounded-full bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 animate-pulse">
                  <Users size={32} />
                </div>
                <div className="space-y-1">
                  <h3 className="font-black text-lg">Esperando Conexión de Teléfonos...</h3>
                  <p className="text-xs text-slate-400 leading-relaxed px-6">
                    Pide a los alumnos escanear el código QR o ingresar el PIN de sala <span className="text-indigo-400 font-bold font-mono text-sm">{pin}</span> para unirse a sus bandos.
                  </p>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-850 w-full text-center">
                  <span className="text-3xl font-black font-mono text-indigo-400 block">{totalConnected}</span>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mt-1">
                    Alumnos en la sala
                  </span>
                </div>

                <button
                  onClick={startActiveGame}
                  disabled={totalConnected === 0 && config.gameMode !== "prof_vs_aula"}
                  className={`w-full py-3.5 rounded-xl font-black text-sm shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    totalConnected > 0 || config.gameMode === "prof_vs_aula"
                      ? "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/10 active:scale-98 text-white"
                      : "bg-slate-800 text-slate-500 cursor-not-allowed"
                  }`}
                  id="c4-start-active-btn"
                >
                  <Play size={16} fill="white" />
                  <span>Comenzar Batalla de Conecta 4</span>
                </button>
              </div>
            )}

            {/* Question state */}
            {session.status === "question" && currentQuestion && (
              <div className="flex-1 flex flex-col justify-between space-y-6" id="c4-question-panel">
                {/* Timer and answering stats */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-indigo-400" />
                    <span className="text-xs font-mono font-bold text-slate-300">
                      Tiempo: <strong className={`${localTimer <= 5 ? "text-red-400 animate-pulse" : "text-white"}`}>{localTimer}s</strong>
                    </span>
                  </div>
                  <div className="bg-slate-950 border border-slate-850 px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5">
                    <Users size={12} className="text-indigo-400" />
                    <span className="font-bold text-slate-400">
                      Respuestas: <strong className="text-white">{answeredCount} / {totalConnected || 1}</strong>
                    </span>
                  </div>
                </div>

                {/* Question body */}
                <div className="space-y-3">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest font-mono">
                    Reactivo {session.currentQuestionIndex + 1} de {session.questions.length}
                  </span>
                  <h2 className="text-base font-black leading-snug tracking-tight">
                    {currentQuestion.text}
                  </h2>
                </div>

                {/* Options hidden or blurred until reveal */}
                <div className="grid grid-cols-1 gap-2.5">
                  {currentQuestion.options.map((option: string, idx: number) => (
                    <div 
                      key={idx}
                      className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl text-xs font-bold text-slate-400 flex items-center gap-2"
                    >
                      <span className="w-5 h-5 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] uppercase">{String.fromCharCode(65 + idx)}</span>
                      <span>{option}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={forceRevealAnswers}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-sans font-black text-xs rounded-xl shadow-lg transition active:scale-98 cursor-pointer"
                  id="c4-reveal-answers-btn"
                >
                  Revelar Respuestas y Definir Turno
                </button>
              </div>
            )}

            {/* Reveal answers & Turn Winner state */}
            {session.status === "reveal" && currentQuestion && (
              <div className="flex-1 flex flex-col justify-between space-y-6" id="c4-reveal-panel">
                <div className="text-center space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
                    Definiendo el Turno de Colocación
                  </span>
                  <h3 className="text-lg font-black tracking-tight text-white">
                    {session.whosTurn 
                      ? `¡Turno Ganado por: ${session.whosTurn === "blue" ? "AZUL / AULA 🔵" : "ROJO / PROFESOR 🔴"}!`
                      : "¡Nadie ganó el turno! Empate técnico"
                    }
                  </h3>
                </div>

                {/* Question with highlighted correct answer */}
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-300 border-l-2 border-indigo-500 pl-3 leading-relaxed">
                    {currentQuestion.text}
                  </h2>

                  <div className="grid grid-cols-1 gap-2">
                    {currentQuestion.options.map((option: string, idx: number) => {
                      const isCorrect = idx === currentQuestion.correctOption;
                      return (
                        <div 
                          key={idx}
                          className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between border ${
                            isCorrect 
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                              : "bg-slate-950/40 border-slate-850 text-slate-500"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] ${isCorrect ? "bg-emerald-500 text-slate-950" : "bg-slate-800"}`}>
                              {String.fromCharCode(65 + idx)}
                            </span>
                            <span>{option}</span>
                          </div>
                          {isCorrect && <span className="text-[10px] font-bold text-emerald-400">CORRECTA</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action CTA */}
                {session.whosTurn ? (
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850 text-center space-y-2">
                    <p className="text-xs text-slate-300 font-bold">
                      {session.whosTurn === "blue" ? "🔵 Equipo Azul tiene el tiro." : "🔴 Equipo Rojo tiene el tiro."}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Deben seleccionar qué columna presionar en su celular para colocar la ficha.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-red-400 bg-red-950/20 border border-red-900/30 p-3 rounded-xl text-center">
                    Avanzando automáticamente al siguiente reactivo...
                  </p>
                )}
              </div>
            )}

            {/* Drop Turn Wait state */}
            {session.status === "drop" && (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 py-8" id="c4-drop-panel">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center border animate-bounce ${
                  session.whosTurn === "blue"
                    ? "bg-blue-600/10 border-blue-500/20 text-blue-400"
                    : "bg-red-600/10 border-red-500/20 text-red-400"
                }`}>
                  <ChevronDown size={32} />
                </div>
                
                <div className="space-y-1">
                  <h3 className="font-black text-lg">
                    {session.whosTurn === "blue" ? "¡Turno del Equipo Azul! 🔵" : "¡Turno del Equipo Rojo! 🔴"}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed px-6">
                    {session.whosTurn === "blue"
                      ? "Los alumnos de la clase están eligiendo la columna óptima en su teléfono."
                      : "El Profesor o alumnos del equipo rojo deben presionar la columna de tiro en el tablero superior."
                    }
                  </p>
                </div>

                {/* Double active power alert */}
                {session.doubleTokenActive && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-[10px] font-bold flex items-center gap-1.5">
                    <Zap size={14} className="animate-pulse" />
                    <span>¡TIRO DOBLE ACTIVO! El bando puede tirar otra ficha consecutiva.</span>
                  </div>
                )}

                <p className="text-[10px] text-slate-500 leading-normal italic">
                  *Nota: Como Profesor, también puedes dar clic en las flechas superiores en el tablero para realizar un override o tiro manual de emergencia.
                </p>
              </div>
            )}

          </div>

          {/* Quick Active Student list */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 max-h-40 overflow-y-auto shadow-xl">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2 font-mono">
              Alumnos Conectados ({totalConnected})
            </span>
            {totalConnected === 0 ? (
              <p className="text-xs text-slate-600 italic">No hay alumnos conectados.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {activePlayers.map((player: any) => (
                  <div 
                    key={player.id}
                    className="bg-slate-950 border border-slate-850 px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${player.teamId === "blue" ? "bg-blue-500" : "bg-red-500"}`} />
                    <span>{player.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Footer */}
      <footer className="py-4 text-center text-[10px] text-slate-600 font-mono select-none">
        MODALIDAD CONECTA 4 ACADÉMICO — PREPMASTER LIVE
      </footer>
    </div>
  );
}
