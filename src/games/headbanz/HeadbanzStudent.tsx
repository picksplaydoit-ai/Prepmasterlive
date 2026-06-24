import React, { useState, useEffect } from "react";
import { Users, Clock, ThumbsUp, HelpCircle, EyeOff, CheckCircle, Flame, Star, Send } from "lucide-react";

interface HeadbanzStudentProps {
  socket: any;
  pin: string;
  playerName: string;
  playerId: string;
}

export default function HeadbanzStudent({ socket, pin, playerName, playerId }: HeadbanzStudentProps) {
  const [gameState, setGameState] = useState<any>(null);
  const [lastActionTime, setLastActionTime] = useState<number>(0);
  const [feedbackSent, setFeedbackSent] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;

    // Join room channel
    socket.emit("headbanz:join", { pin, name: playerName, playerId });

    // Listen to live Headbanz state updates
    socket.on("headbanz:state", (state: any) => {
      setGameState(state);
    });

    return () => {
      socket.off("headbanz:state");
    };
  }, [socket, pin, playerName, playerId]);

  // Handle Quick Feedback Voting
  const handleSendFeedback = (type: "yes" | "no" | "sometimes" | "close") => {
    const now = Date.now();
    if (now - lastActionTime < 1000) return; // Debounce 1s

    socket.emit("headbanz:feedback", {
      pin,
      feedback: type
    });

    setFeedbackSent(type);
    setLastActionTime(now);

    setTimeout(() => {
      setFeedbackSent(null);
    }, 1500);
  };

  if (!gameState) {
    return (
      <div className="bg-slate-900 min-h-screen text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <Users className="w-12 h-12 text-pink-500 animate-pulse mb-3" />
        <h2 className="text-lg font-black uppercase tracking-wider">Conectando...</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">Ingresando a la sala de Headbanz en el aula local.</p>
      </div>
    );
  }

  const playersList = Object.values(gameState.players || {});
  const activePlayer = gameState.currentPlayerIndex >= 0 && gameState.currentPlayerIndex < playersList.length
    ? (playersList[gameState.currentPlayerIndex] as any)
    : null;

  const isMyTurn = activePlayer && activePlayer.name === playerName;

  return (
    <div className="bg-slate-950 min-h-screen text-white flex flex-col justify-between font-sans" id="headbanz-student-panel">
      
      {/* Top Header */}
      <div className="bg-slate-900 border-b border-slate-850 px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-lg">👑</span>
          <div>
            <h3 className="text-xs font-black tracking-tight text-white uppercase truncate">
              {gameState.bankName || "Headbanz Educativo"}
            </h3>
            <p className="text-[9px] text-slate-400 font-medium">PIN: {pin} — {playerName}</p>
          </div>
        </div>

        {gameState.status === "playing" && (
          <div className="bg-pink-950/40 text-pink-400 border border-pink-900 px-2.5 py-1 rounded-full text-[10px] font-mono font-black animate-pulse">
            {gameState.timer}s
          </div>
        )}
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col justify-center px-4 py-6 max-w-md mx-auto w-full">
        
        {gameState.status === "lobby" ? (
          /* LOBBY WAITING SCREEN */
          <div className="text-center space-y-6" id="student-lobby-view">
            <div className="w-20 h-20 bg-pink-500/10 border border-pink-500/30 rounded-3xl flex items-center justify-center mx-auto shadow-md">
              <Flame className="w-10 h-10 text-pink-500 animate-bounce" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-pink-200">
                ¡SALA DE ESPERA!
              </h1>
              <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto">
                Estás conectado como <span className="text-pink-400 font-bold">{playerName}</span>. El profesor iniciará el juego cuando todos estén listos.
              </p>
            </div>

            <div className="bg-slate-900/50 border border-slate-850 p-4 rounded-2xl max-w-xs mx-auto text-left space-y-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 font-mono">Consejo de Juego</p>
              <p className="text-xs text-slate-300 leading-normal font-medium">
                Cuando sea tu turno, te saldrá un aviso. ¡No leas la palabra! Tus compañeros te darán pistas respondiendo tus preguntas de sí/no.
              </p>
            </div>
          </div>
        ) : gameState.status === "playing" ? (
          /* ACTIVE GAMEPLAY SCREEN */
          isMyTurn ? (
            /* ACTIVE GUESSER INTERFACE (Word is HIDDEN) */
            <div className="text-center space-y-6" id="student-guesser-view">
              
              <div className="bg-rose-950/30 border-2 border-dashed border-rose-500/40 p-6 rounded-3xl space-y-4 shadow-xl">
                <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-center mx-auto">
                  <EyeOff className="w-6 h-6 text-rose-500" />
                </div>
                
                <div className="space-y-1">
                  <h2 className="text-base font-black text-rose-400 uppercase tracking-widest font-mono">
                    🚫 PALABRA OCULTA SOBRE TU CABEZA
                  </h2>
                  <p className="text-xs text-slate-300 font-medium">
                    No mires la pantalla del proyector. Haz preguntas inteligentes de "Sí" o "No" a tus compañeros para adivinar tu palabra.
                  </p>
                </div>
              </div>

              {/* Suggestions */}
              <div className="bg-slate-900/50 border border-slate-850 p-5 rounded-2xl text-left space-y-3 shadow-md">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-pink-400" />
                  Preguntas sugeridas:
                </h4>
                <ul className="space-y-2 text-xs text-slate-300 font-medium">
                  <li className="flex items-start gap-1.5 leading-normal">
                    <span className="text-pink-400">•</span>
                    "¿Soy un ser vivo o un proceso inanimado?"
                  </li>
                  <li className="flex items-start gap-1.5 leading-normal">
                    <span className="text-pink-400">•</span>
                    "¿Ocurro dentro de la célula?"
                  </li>
                  <li className="flex items-start gap-1.5 leading-normal">
                    <span className="text-pink-400">•</span>
                    "¿Tengo alguna función en la fotosíntesis?"
                  </li>
                </ul>
              </div>

            </div>
          ) : (
            /* CLASSEMATE INTERFACE (Can see the active word + gets vote buttons) */
            <div className="space-y-6 text-center" id="student-peer-view">
              
              {/* Secret concept display for peers */}
              {activePlayer && activePlayer.currentWord ? (
                <div className="bg-indigo-950/30 border border-indigo-900 p-6 rounded-3xl space-y-3 shadow-xl">
                  <span className="text-[10px] font-black font-mono tracking-widest text-indigo-400 uppercase">
                    CONCEPTO SECRETO DE {activePlayer.name?.toUpperCase()}
                  </span>
                  
                  <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-indigo-300 tracking-tight uppercase">
                    {activePlayer.currentWord}
                  </h2>

                  <p className="text-[11px] text-indigo-300 font-mono bg-indigo-900/30 border border-indigo-900/50 px-3 py-1 rounded-full inline-block">
                    Categoría: {activePlayer.currentCategory || "General"}
                  </p>
                </div>
              ) : (
                <p className="text-slate-500 text-xs">Cargando concepto activo...</p>
              )}

              {/* Peer Feedback Vote Controls */}
              <div className="bg-slate-900/50 border border-slate-850 p-5 rounded-2xl space-y-4 shadow-md">
                <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-wider font-mono">
                  Guía a tu compañero
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleSendFeedback("yes")}
                    className={`py-3.5 rounded-xl font-bold text-xs transition border flex items-center justify-center gap-1.5 ${
                      feedbackSent === "yes"
                        ? "bg-emerald-600 border-emerald-500 text-white shadow-lg scale-95"
                        : "bg-slate-950 border-slate-850 text-emerald-400 hover:bg-slate-900"
                    }`}
                  >
                    🟢 SÍ
                  </button>

                  <button
                    onClick={() => handleSendFeedback("no")}
                    className={`py-3.5 rounded-xl font-bold text-xs transition border flex items-center justify-center gap-1.5 ${
                      feedbackSent === "no"
                        ? "bg-rose-600 border-rose-500 text-white shadow-lg scale-95"
                        : "bg-slate-950 border-slate-850 text-rose-400 hover:bg-slate-900"
                    }`}
                  >
                    🔴 NO
                  </button>

                  <button
                    onClick={() => handleSendFeedback("sometimes")}
                    className={`py-3.5 rounded-xl font-bold text-xs transition border flex items-center justify-center gap-1.5 ${
                      feedbackSent === "sometimes"
                        ? "bg-amber-600 border-amber-500 text-white shadow-lg scale-95"
                        : "bg-slate-950 border-slate-850 text-amber-400 hover:bg-slate-900"
                    }`}
                  >
                    🟡 A VECES
                  </button>

                  <button
                    onClick={() => handleSendFeedback("close")}
                    className={`py-3.5 rounded-xl font-bold text-xs transition border flex items-center justify-center gap-1.5 ${
                      feedbackSent === "close"
                        ? "bg-sky-600 border-sky-500 text-white shadow-lg scale-95"
                        : "bg-slate-950 border-slate-850 text-sky-400 hover:bg-slate-900"
                    }`}
                  >
                    🔵 CERCA
                  </button>
                </div>
              </div>

            </div>
          )
        ) : (
          /* ENDED SCREEN */
          <div className="text-center space-y-4" id="student-ended-view">
            <TrophyIcon />
            <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-pink-400">
              ¡PARTIDA CONCLUIDA!
            </h2>
            <p className="text-xs text-slate-400 font-medium">
              Mira la pantalla del profesor para conocer el podio académico final y descargar el reporte de Excel.
            </p>
          </div>
        )}

      </div>

      {/* Footer */}
      <div className="bg-slate-900/40 border-t border-slate-900 px-4 py-3 text-center text-[10px] text-slate-500 font-mono">
        PREPMASTER LIVE v2.5.0 — CONECTIVIDAD LOCAL
      </div>

    </div>
  );
}

function TrophyIcon() {
  return (
    <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto shadow-md">
      <Star className="w-8 h-8 text-amber-400 animate-spin" style={{ animationDuration: "12s" }} />
    </div>
  );
}
