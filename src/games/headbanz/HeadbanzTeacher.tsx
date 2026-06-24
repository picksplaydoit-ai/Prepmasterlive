import React, { useState, useEffect } from "react";
import { Users, Clock, Play, HelpCircle, AlertCircle, ArrowRight, Volume2, VolumeX, CheckCircle, XCircle, SkipForward, Ban, Sparkles } from "lucide-react";
import QRCode from "qrcode";
import TeacherBuzzerPanel from "../../components/TeacherBuzzerPanel";

interface HeadbanzTeacherProps {
  socket: any;
  pin: string;
  config: any;
  bankTitle: string;
  words: any[];
  onGameEnded: (players: any[], conceptsLog: any[]) => void;
}

export default function HeadbanzTeacher({ socket, pin, config, bankTitle, words, onGameEnded }: HeadbanzTeacherProps) {
  const [gameState, setGameState] = useState<any>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [recentFeedbacks, setRecentFeedbacks] = useState<any[]>([]);

  // Generate QR for connecting local clients
  useEffect(() => {
    const studentUrl = `${window.location.origin}/student?pin=${pin}`;
    QRCode.toDataURL(studentUrl, { margin: 2, scale: 5 })
      .then((url) => setQrCodeUrl(url))
      .catch((err) => console.error("Error generating QR:", err));
  }, [pin]);

  // Handle socket.io state synchronizations
  useEffect(() => {
    if (!socket) return;

    // Listen to headbanz:state updates
    socket.on("headbanz:state", (state: any) => {
      setGameState(state);
      if (state.status === "ended") {
        onGameEnded(Object.values(state.players), state.conceptsLog || []);
      }
    });

    // Listen to sound triggers from server
    socket.on("headbanz:sound", ({ type }: { type: string }) => {
      if (soundEnabled) {
        playSynthSound(type);
      }
    });

    // Listen to real-time peer feedback
    socket.on("headbanz:feedback-received", ({ feedback, senderId }: any) => {
      const senderPlayer = gameState?.players[senderId];
      const senderName = senderPlayer ? senderPlayer.name : "Un compañero";
      
      const newFeedback = {
        id: Math.random().toString(),
        senderName,
        feedback,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
      
      setRecentFeedbacks(prev => [newFeedback, ...prev].slice(0, 15));
    });

    return () => {
      socket.off("headbanz:state");
      socket.off("headbanz:sound");
      socket.off("headbanz:feedback-received");
    };
  }, [socket, soundEnabled, gameState]);

  // Clean Web Audio Synth for classroom feedback
  const playSynthSound = (type: string) => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      if (type === "correct") {
        // Triumphant double ping
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc2.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 0.45);
        osc2.stop(ctx.currentTime + 0.45);
      } else if (type === "incorrect" || type === "skip") {
        // Flat double buzz
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        osc.connect(ctx.destination);
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === "hint") {
        // High pleasant ding
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
        osc.start();
        osc.stop(ctx.currentTime + 0.65);
      } else if (type === "start_turn") {
        // Upward pleasant sweep
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(330, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.45);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } else if (type === "end_round") {
        // Deep alert
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "triangle";
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.6);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
      }
    } catch (e) {
      console.warn("Synth audio play failed:", e);
    }
  };

  const handleStartGame = () => {
    socket.emit("headbanz:start", { pin });
  };

  const handleCorrect = () => {
    socket.emit("headbanz:correct", { pin });
  };

  const handleSkip = () => {
    socket.emit("headbanz:skip", { pin });
  };

  const handleHint = () => {
    socket.emit("headbanz:hint", { pin });
  };

  const handleEndGame = () => {
    if (confirm("¿Deseas finalizar la partida de Headbanz de inmediato?")) {
      socket.emit("headbanz:end", { pin });
    }
  };

  if (!gameState) {
    return (
      <div className="bg-slate-900 min-h-screen text-white flex items-center justify-center font-sans">
        <p className="text-sm font-bold text-slate-400">Estableciendo canal de transmisión con el aula...</p>
      </div>
    );
  }

  const playersList = Object.values(gameState.players || {});
  const activePlayer = gameState.currentPlayerIndex >= 0 && gameState.currentPlayerIndex < playersList.length
    ? (playersList[gameState.currentPlayerIndex] as any)
    : null;

  return (
    <div className="bg-slate-950 min-h-screen text-white flex flex-col justify-between font-sans relative overflow-hidden" id="headbanz-teacher-view">
      
      {/* Top Banner */}
      <div className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <span className="text-xl sm:text-2xl">👑</span>
          <div>
            <h1 className="text-sm sm:text-base font-black tracking-tight text-white uppercase">
              Headbanz Educativo — {bankTitle}
            </h1>
            <p className="text-[10px] text-slate-500 font-mono">MODO: {config.gameMode?.toUpperCase()}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg border transition ${
              soundEnabled ? "border-slate-800 bg-slate-900 text-pink-400" : "border-slate-900 bg-slate-950 text-slate-600"
            }`}
            title="Audio de aula local"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          
          <button
            onClick={handleEndGame}
            className="bg-rose-950 hover:bg-rose-900 border border-rose-900 text-rose-300 text-xs font-black px-3 py-2 rounded-lg transition"
            id="end-game-btn"
          >
            Finalizar Partida
          </button>
        </div>
      </div>

      {gameState.status === "lobby" ? (
        /* LOBBY VIEW */
        <div className="flex-1 max-w-5xl mx-auto w-full grid grid-cols-1 md:grid-cols-12 gap-6 p-6 items-center" id="lobby-grid">
          
          {/* Connection QR Instructions */}
          <div className="md:col-span-5 bg-slate-900/40 border border-slate-900 p-6 rounded-3xl text-center space-y-4 shadow-xl">
            <h3 className="text-sm font-black text-pink-400 uppercase tracking-wider font-mono">
              Ingreso al Headbanz
            </h3>

            {qrCodeUrl ? (
              <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48 mx-auto border-4 border-white rounded-2xl shadow-md" />
            ) : (
              <div className="w-48 h-48 bg-slate-800 rounded-2xl mx-auto animate-pulse flex items-center justify-center text-slate-500 text-xs">
                Generando QR local...
              </div>
            )}

            <div className="space-y-1">
              <p className="text-base font-black font-sans text-white">PIN: {pin}</p>
              <p className="text-[11px] text-slate-500 font-medium">
                Escanea el QR local o escribe el PIN desde cualquier navegador móvil.
              </p>
            </div>
          </div>

          {/* Lobby Student Lists */}
          <div className="md:col-span-7 bg-slate-900/40 border border-slate-900 p-6 rounded-3xl h-[400px] flex flex-col justify-between shadow-xl">
            <div className="space-y-4 overflow-hidden flex flex-col flex-1">
              <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                <span className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-pink-400" />
                  Alumnos Listos ({playersList.length})
                </span>
              </div>

              <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 pr-1" id="lobby-connected-students">
                {playersList.length === 0 ? (
                  <p className="col-span-full text-slate-500 text-xs text-center my-auto">Esperando alumnos...</p>
                ) : (
                  playersList.map((p: any, idx) => (
                    <div
                      key={p.id || idx}
                      className="p-2.5 bg-slate-950/50 border border-slate-850 rounded-xl text-left truncate flex items-center gap-2"
                    >
                      <span className="text-sm">👑</span>
                      <div className="truncate min-w-0">
                        <p className="font-bold text-white text-xs truncate leading-tight">{p.name}</p>
                        {p.teamId && (
                          <span className="text-[8px] font-mono font-bold text-pink-400 uppercase tracking-widest">{p.teamId}</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={handleStartGame}
              disabled={playersList.length === 0}
              className={`w-full font-black py-4 rounded-xl transition shadow-lg text-sm flex items-center justify-center gap-2 ${
                playersList.length === 0
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-pink-600 hover:bg-pink-700 text-white hover:shadow-xl"
              }`}
              id="start-headbanz-lobby-btn"
            >
              <Play className="w-4 h-4 fill-current" />
              Comenzar Dinámica ({playersList.length} listos)
            </button>
          </div>

        </div>
      ) : (
        /* PLAYING VIEW */
        <div className="flex-1 max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 overflow-hidden" id="playing-grid">
          
          {/* Active Player Status (Proyector/Canvas) */}
          <div className="lg:col-span-8 space-y-6 flex flex-col justify-between">
            <div className="bg-slate-900/30 border border-slate-900 p-6 rounded-3xl text-center space-y-6 shadow-xl flex-1 flex flex-col justify-center">
              
              <div className="space-y-1">
                <span className="bg-pink-500/15 text-pink-300 border border-pink-500/30 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full inline-block">
                  Adivino Activo — Turno {gameState.currentPlayerIndex + 1} de {playersList.length} (Ronda {gameState.currentRound}/{config.roundsCount})
                </span>
                {activePlayer ? (
                  <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-pink-200 tracking-tight">
                    {activePlayer.name}
                  </h2>
                ) : (
                  <h2 className="text-2xl font-black text-slate-400">Cargando siguiente adivino...</h2>
                )}
              </div>

              {/* Big Word Hidden Box */}
              {activePlayer && activePlayer.currentWord ? (
                <div className="space-y-4">
                  <div className="bg-slate-950/60 border-2 border-dashed border-pink-500/30 max-w-md mx-auto p-8 rounded-3xl shadow-inner space-y-3">
                    <span className="text-[10px] font-black font-mono tracking-widest text-slate-500 uppercase">
                      CONCEPTO REAL (DUEÑO NO LO VE)
                    </span>
                    <h3 className="text-4xl sm:text-5xl font-black tracking-tight text-pink-400 font-sans uppercase">
                      {activePlayer.currentWord}
                    </h3>
                    <p className="text-xs text-slate-300 font-mono bg-slate-900 px-3 py-1 rounded-full inline-block border border-slate-800">
                      Categoría: {activePlayer.currentCategory || "General"}
                    </p>
                  </div>

                  {activePlayer.hintShown && activePlayer.currentHint && (
                    <div className="bg-amber-500/10 border border-amber-500/20 max-w-md mx-auto p-4 rounded-2xl text-left space-y-1">
                      <span className="text-[9px] font-black font-mono text-amber-400 uppercase tracking-wider flex items-center gap-1">
                        <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                        Pista Revelada
                      </span>
                      <p className="text-xs text-slate-300 font-medium italic">"{activePlayer.currentHint}"</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">Fin del turno o sin conceptos asignados.</p>
              )}

              {/* Large Timer Sweep */}
              <div className="space-y-2 max-w-sm mx-auto w-full">
                <div className="flex justify-between items-center text-xs text-slate-400 font-bold">
                  <span>Tiempo Restante</span>
                  <span className="font-mono text-pink-400 font-black">{gameState.timer}s</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-850">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      gameState.timer < 15 ? "bg-rose-500 animate-pulse" : "bg-pink-600"
                    }`}
                    style={{ width: `${(gameState.timer / (config.timePerTurn || 60)) * 100}%` }}
                  ></div>
                </div>
              </div>

            </div>

            {/* Teacher Action Controls */}
            <div className="bg-slate-900/30 border border-slate-900 p-5 rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-3 shadow-xl">
              <button
                onClick={handleCorrect}
                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 px-4 rounded-xl transition shadow-md"
                id="correct-concept-btn"
              >
                <CheckCircle className="w-4 h-4" />
                Correcto
              </button>

              <button
                onClick={handleSkip}
                className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-black py-3 px-4 rounded-xl transition"
                id="skip-concept-btn"
              >
                <SkipForward className="w-4 h-4" />
                Saltar concepto
              </button>

              <button
                onClick={handleHint}
                disabled={activePlayer?.hintShown}
                className={`flex items-center justify-center gap-2 font-black py-3 px-4 rounded-xl transition ${
                  activePlayer?.hintShown
                    ? "bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-850"
                    : "bg-amber-600 hover:bg-amber-700 text-white"
                }`}
                id="show-hint-btn"
              >
                <HelpCircle className="w-4 h-4" />
                Mostrar Pista
              </button>

              <button
                onClick={() => socket.emit("headbanz:correct", { pin })} // triggers auto advance or similar
                className="flex items-center justify-center gap-2 bg-slate-950 hover:bg-slate-900 text-slate-300 font-black py-3 px-4 rounded-xl border border-slate-850 transition text-xs"
              >
                Siguiente Jugador
              </button>
            </div>
          </div>

          {/* Connected Classroom list / live peer feedback feeds */}
          <div className="lg:col-span-4 space-y-4 flex flex-col justify-between h-[500px] lg:h-auto">
            {/* Real-time Quick Buzzer utility */}
            <TeacherBuzzerPanel pin={pin} gameMode="headbanz" />

            {/* Live voting feed */}
            <div className="bg-slate-900/30 border border-slate-900 p-5 rounded-3xl flex-1 flex flex-col overflow-hidden shadow-xl">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono border-b border-slate-900 pb-2 mb-3">
                💬 Respuestas de Compañeros en Vivo
              </h3>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1" id="peer-feedback-feed">
                {recentFeedbacks.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-600 text-xs text-center p-4">
                    Compañeros verán botones rápidos en sus teléfonos para dar feedback del concepto secreto en tiempo real.
                  </div>
                ) : (
                  recentFeedbacks.map((f) => (
                    <div key={f.id} className="p-2.5 bg-slate-950/40 border border-slate-900 rounded-xl flex items-center justify-between text-xs">
                      <div className="truncate min-w-0 pr-2">
                        <span className="font-bold text-slate-300 truncate block">{f.senderName}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{f.time}</span>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full font-bold uppercase text-[9px] border ${
                        f.feedback === "yes"
                          ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-400"
                          : f.feedback === "no"
                          ? "bg-rose-500/15 border-rose-500/35 text-rose-400"
                          : f.feedback === "close"
                          ? "bg-sky-500/15 border-sky-500/35 text-sky-400"
                          : "bg-amber-500/15 border-amber-500/35 text-amber-400"
                      }`}>
                        {f.feedback === "yes" ? "🟢 Sí" : f.feedback === "no" ? "🔴 No" : f.feedback === "close" ? "🔵 Cerca" : "🟡 A veces"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Connected players list & scoreboards */}
            <div className="bg-slate-900/30 border border-slate-900 p-5 rounded-3xl h-[200px] flex flex-col overflow-hidden shadow-xl">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono border-b border-slate-900 pb-2 mb-2">
                👥 Alumnos e Historial de Aciertos
              </h3>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1" id="scores-playing-view">
                {playersList.map((p: any, idx) => (
                  <div
                    key={p.id || idx}
                    className={`p-2 rounded-xl flex items-center justify-between border ${
                      p.name === activePlayer?.name
                        ? "bg-pink-500/10 border-pink-500/25 text-pink-300 font-bold"
                        : "bg-slate-950/20 border-slate-900 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs">👑</span>
                      <span className="text-xs truncate">{p.name}</span>
                    </div>
                    <span className="text-xs font-black font-mono text-pink-400">
                      {p.score || 0} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
