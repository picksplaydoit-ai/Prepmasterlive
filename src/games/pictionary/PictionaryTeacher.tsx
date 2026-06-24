import { useState, useEffect, useRef } from "react";
import { Play, Pause, FastForward, HelpCircle, StopCircle, Check, Award, QrCode, Volume2, VolumeX, Eye, Sparkles } from "lucide-react";
import QRCode from "qrcode";
import PictionaryCanvas from "./PictionaryCanvas";
import { PictionaryConfig, PictionaryTeam, PictionaryWord, PictionaryHistory } from "./pictionaryTypes";
import { playGameSound } from "../../lib/sound";
import TeacherBuzzerPanel from "../../components/TeacherBuzzerPanel";

interface PictionaryTeacherProps {
  socket: any;
  pin: string;
  config: PictionaryConfig;
  selectedBank: any;
  onEndGame: () => void;
}

export default function PictionaryTeacher({
  socket,
  pin,
  config: initialConfig,
  selectedBank,
  onEndGame,
}: PictionaryTeacherProps) {
  const [config, setConfig] = useState<PictionaryConfig>(initialConfig);
  const [status, setStatus] = useState<"lobby" | "playing" | "ended">("lobby");
  
  // Connection QR
  const [qrUrl, setQrUrl] = useState<string>("");

  // Game state trackers
  const [scores, setScores] = useState<Record<string, number>>({});
  const [playersList, setPlayersList] = useState<any[]>([]);
  const [turnState, setTurnState] = useState<any>(null);
  const [isPaused, setIsPaused] = useState(false);
  
  // Hint revealed flags
  const [revealedHint, setRevealedHint] = useState("");

  // History details for end-game report
  const [playedWordsLog, setPlayedWordsLog] = useState<any[]>([]); // list of {word, category, outcome: 'correct'|'skipped'|'timeout', teamName, points}

  // Live student buzzers toast alerts
  const [buzzers, setBuzzers] = useState<any[]>([]);

  // Sound enabled
  const [soundActive, setSoundActive] = useState(true);

  // Canvas spectator mirroring ref
  const [strokeStartCallback, setStrokeStartCallback] = useState<any>(null);
  const [strokeUpdateCallback, setStrokeUpdateCallback] = useState<any>(null);
  const [clearCallback, setClearCallback] = useState<any>(null);

  const canvasExternalActions = {
    subscribeToStrokeStart: (cb: any) => setStrokeStartCallback(() => cb),
    subscribeToStrokeUpdate: (cb: any) => setStrokeUpdateCallback(() => cb),
    subscribeToClear: (cb: any) => setClearCallback(() => cb),
  };

  // Build the Join QR Code on mount
  useEffect(() => {
    const buildQr = async () => {
      try {
        const urlAddress = `${window.location.origin}/join?pin=${pin}&game=pictionary`;
        const qrSvg = await QRCode.toDataURL(urlAddress, { width: 140, margin: 1 });
        setQrUrl(qrSvg);
      } catch (err) {
        console.error("Error drawing qr code in teacher dashboard:", err);
      }
    };
    buildQr();
  }, [pin]);

  // Hook up server Room Sync & drawing mirroring
  useEffect(() => {
    socket.on("pictionary:player-list", (data: { players: any[] }) => {
      setPlayersList(data.players);
    });

    socket.on("pictionary:team-sizes-updated", (data: { teams: PictionaryTeam[] }) => {
      setConfig((prev: any) => prev ? { ...prev, teams: data.teams } : null);
    });

    socket.on("pictionary:game-started", (data: any) => {
      setStatus("playing");
      setScores(data.scores);
      if (soundActive) playGameSound("inicio");
    });

    socket.on("pictionary:turn-updated", (data: any) => {
      setTurnState(data.turnState);
      setPlayersList(data.players);
      setRevealedHint("");
      setIsPaused(false);
      
      if (soundActive) {
        playGameSound("inicio");
      }

      // Automatically wipe canvas clean on each new turn
      if (clearCallback) {
        clearCallback();
      }
    });

    socket.on("pictionary:hint-shown", (data: { hint: string }) => {
      setRevealedHint(data.hint);
    });

    socket.on("pictionary:round-outcome", (data: any) => {
      setScores(data.scores);
      setPlayedWordsLog(prev => [...prev, data.playedWordInfo]);
      
      if (soundActive) {
        if (data.playedWordInfo.outcome === "correct") {
          playGameSound("correcta");
        } else {
          playGameSound("incorrecta");
        }
      }
    });

    socket.on("pictionary:timer-tick", (data: { timer: number }) => {
      setTurnState((prev: any) => prev ? { ...prev, timer: data.timer } : null);
      
      // Last 5 seconds countdown warnings
      if (data.timer > 0 && data.timer <= 5 && soundActive) {
        playGameSound("cuenta_regresiva");
      }
    });

    // Mirroring drawing strokes on teacher projection board
    socket.on("pictionary:drawing-start", (data: any) => {
      if (strokeStartCallback) strokeStartCallback(data);
    });

    socket.on("pictionary:drawing-update", (data: any) => {
      if (strokeUpdateCallback) strokeUpdateCallback(data);
    });

    socket.on("pictionary:drawing-clear", () => {
      if (clearCallback) clearCallback();
    });

    // Listen to student guess alerts ("I think I know!")
    socket.on("game:player-message", (data: any) => {
      if (data.event === "pictionary:student-guess-alert") {
        if (soundActive) {
          playGameSound("revelar_respuesta"); // spark sound
        }

        const newAlert = {
          id: Date.now() + Math.random().toString(),
          studentName: data.studentName,
          teamName: data.teamName,
        };

        setBuzzers((prev) => [...prev, newAlert]);
        
        // Auto remove alert after 4 seconds
        setTimeout(() => {
          setBuzzers((prev) => prev.filter((b) => b.id !== newAlert.id));
        }, 4000);
      }
    });

    socket.on("pictionary:game-ended", (data: any) => {
      setStatus("ended");
      if (soundActive) playGameSound("podio");
      
      // Attempt to automatically persist this to SQL via REST
      persistGameToSQLite(data.finalResult);
    });

    socket.on("pictionary:error", (data: { message: string }) => {
      alert(data.message);
    });

    return () => {
      socket.off("pictionary:player-list");
      socket.off("pictionary:team-sizes-updated");
      socket.off("pictionary:game-started");
      socket.off("pictionary:turn-updated");
      socket.off("pictionary:hint-shown");
      socket.off("pictionary:round-outcome");
      socket.off("pictionary:timer-tick");
      socket.off("pictionary:drawing-start");
      socket.off("pictionary:drawing-update");
      socket.off("pictionary:drawing-clear");
      socket.off("pictionary:game-ended");
      socket.off("pictionary:error");
    };
  }, [strokeStartCallback, strokeUpdateCallback, clearCallback, soundActive]);

  // REST SQL persistence
  const persistGameToSQLite = async (result: any) => {
    try {
      await fetch("/api/pictionary/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin,
          config,
          scores: result.scores,
          winnerTeamId: result.winnerTeamId,
          winnerTeamName: result.winnerTeamName,
          playedWordsLog,
          createdAt: new Date().toISOString()
        })
      });
    } catch (e) {
      console.error("Error registering results in SQL:", e);
    }
  };

  // Primary action buttons from the teacher
  const handleStartGame = () => {
    socket.emit("pictionary:start-game", { pin });
  };

  const handleMarkCorrect = () => {
    socket.emit("pictionary:score-word", { pin, outcome: "correct" });
  };

  const handleSkipWord = () => {
    socket.emit("pictionary:score-word", { pin, outcome: "skipped" });
  };

  const handleTriggerHint = () => {
    socket.emit("pictionary:reveal-hint", { pin });
  };

  const handleToggleTimer = () => {
    socket.emit("pictionary:toggle-timer", { pin });
    setIsPaused(!isPaused);
  };

  const handleForceEnd = () => {
    if (confirm("¿Estás seguro que deseas finalizar la partida ahora? Se mostrarán los resultados acumulados hasta el momento.")) {
      socket.emit("pictionary:end-game", { pin });
    }
  };

  // Excel Excel report exporter
  const handleExportExcelReport = () => {
    if (playedWordsLog.length === 0) {
      alert("Aún no se han jugado palabras en esta partida.");
      return;
    }

    // Redirect to download endpoint
    const statsPayload = {
      pin,
      bankName: selectedBank.name,
      config,
      scores,
      playedWordsLog,
    };
    
    // Save locally
    const blob = new Blob([JSON.stringify(statsPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte_pictionary_${pin}.json`;
    a.click();
    
    alert("¡Reporte de juego descargado! Petición de exportación Excel completada offline en formato JSON.");
  };

  // Sorted teams helper
  const sortedTeams = [...config.teams].sort((a,b) => (scores[b.id] || 0) - (scores[a.id] || 0));
  const activeDrawerName = turnState?.drawerName || "Sin asignar";
  const activeTeam = config.teams.find(t => t.id === turnState?.teamId);

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6" id="pictionary-teacher-projection">
      
      {/* Floating sound toggles & notifications */}
      <div className="flex flex-wrap items-center justify-between bg-white border border-slate-200 p-4 rounded-3xl shadow-xs select-none">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center text-white text-md font-black">
            P
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900 leading-normal font-sans">Panel de Proyección Docente</h4>
            <span className="text-[10px] font-mono text-slate-400 font-extrabold uppercase tracking-wide">
              Módulo: 🎨 Pictionary Educativo (PIN: {pin})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sound Toggle */}
          <button
            onClick={() => setSoundActive(!soundActive)}
            className={`p-2.5 rounded-xl cursor-pointer border transition-colors ${
              soundActive
                ? "bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100"
                : "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
            }`}
            title="Activar/Desactivar Sonidos"
          >
            {soundActive ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>

          <button
            onClick={onEndGame}
            className="text-xs font-black bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 px-3.5 py-2 rounded-xl cursor-pointer"
          >
            🗑️ Cancelar Sala
          </button>
        </div>
      </div>

      {/* Floating student buzz alerts stack */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-xs pointer-events-none">
        {buzzers.map((b) => (
          <div key={b.id} className="bg-indigo-900/95 backdrop-blur-md text-white border border-indigo-700/50 p-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-fade-in pointer-events-auto">
            <span className="text-2xl shrink-0 animate-bounce">🛎️</span>
            <div>
              <p className="text-xs font-black">{b.studentName}</p>
              <p className="text-[10px] text-indigo-300 font-medium">¡Cree saber la respuesta en el {b.teamName}!</p>
            </div>
          </div>
        ))}
      </div>

      {/* LOBBY PHASE */}
      {status === "lobby" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="teacher-lobby-view">
          {/* Left panel: connection details */}
          <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-950 flex flex-col items-center text-center justify-between space-y-4">
            <div className="space-y-1">
              <span className="text-3xl">📱</span>
              <h4 className="text-md font-black font-sans">Escanear para Unirse</h4>
              <p className="text-xs text-slate-400">Escanea con tu celular o tablet para unirte y elegir equipo</p>
            </div>

            {qrUrl ? (
              <div className="bg-white p-3 rounded-2xl shadow-inner border border-slate-200">
                <img src={qrUrl} alt="Join QR Code" className="w-36 h-36 mx-auto select-none" />
              </div>
            ) : (
              <span className="text-xs font-mono text-slate-500">Generando QR...</span>
            )}

            <div className="bg-slate-800 p-3 rounded-xl border border-slate-705 w-full">
              <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 block">PIN de la sala local</span>
              <span className="text-3xl font-black font-mono tracking-wider text-amber-400">{pin}</span>
            </div>
          </div>

          {/* Center and right: Team lobbies */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h5 className="text-sm font-black text-slate-950 font-sans uppercase">
                👥 Equipos Declarados ({config.teams.length})
              </h5>
              <div className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
                <span className="text-xs font-mono font-bold text-slate-500">
                  {playersList.length} estudiantes conectados
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {config.teams.map((t) => {
                const teamPlayers = playersList.filter((p) => p.teamId === t.id);
                const estimated = t.declaredMembers || 3;
                return (
                  <div key={t.id} className="bg-white border border-slate-200 p-4 rounded-2xl space-y-3 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl">{t.icon}</span>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ backgroundColor: `${t.color}15`, color: t.color }}>
                          Capacidad: {teamPlayers.length} / {estimated}
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-slate-900 font-sans">{t.name}</h4>
                    </div>

                    <div className="divide-y divide-slate-100 max-h-24 overflow-y-auto pt-1 pr-1 border-t border-slate-50">
                      {teamPlayers.length === 0 ? (
                        <p className="text-[10.5px] font-semibold text-slate-400 py-1.5 italic font-mono">Esperando alumnos...</p>
                      ) : (
                        teamPlayers.map((p) => (
                          <div key={p.id} className="text-xs font-bold text-slate-700 py-1 flex items-center gap-1.5">
                            <span>{p.avatarId}</span>
                            <span>{p.name}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleStartGame}
              disabled={playersList.length === 0}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 border border-emerald-750 text-white font-black text-sm uppercase tracking-wider rounded-2xl shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <Play size={15} fill="currentColor" />
              <span>Iniciar Partida de Pictionary ({selectedBank.words.length} palabras disponibles)</span>
            </button>
          </div>
        </div>
      )}

      {/* ACTIVE PLAYING SCREEN */}
      {status === "playing" && turnState && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" id="teacher-projection-live">
          {/* Main Visual Board - Big Canvas (3/4 grid width) */}
          <div className="lg:col-span-3 space-y-4">
            
            {/* Primary Word Banner */}
            <div className="bg-slate-900 border border-slate-950 text-white rounded-3xl p-5 shadow-lg flex items-center justify-between gap-4 select-none">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-slate-800 text-slate-350 border border-slate-700 px-3 py-0.5 rounded-full uppercase font-mono font-extrabold font-black">
                    Ronda {turnState.roundNumber} / Palabra {turnState.wordIndex + 1}
                  </span>
                  
                  {activeTeam && (
                    <span className="text-[10px] inline-flex items-center gap-1 uppercase font-mono font-black" style={{ color: activeTeam.color }}>
                      <span>{activeTeam.icon}</span>
                      <span>{activeTeam.name}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl text-amber-400">🔑</span>
                  <h3 className="text-3xl font-black font-sans leading-none tracking-tight">
                    {turnState.word}
                  </h3>
                </div>

                <p className="text-[10.5px] text-slate-400 font-bold">
                  Dibujando de forma remota: <span className="text-indigo-400 font-extrabold">{activeDrawerName}</span>
                </p>
              </div>

              {/* High Contrast Digital Timer */}
              <div className="bg-slate-850 p-4 border border-slate-700 rounded-2xl text-center min-w-28 shadow-inner">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-extrabold">Contador</span>
                <span className={`text-4xl font-mono leading-none font-black tracking-tight block ${
                  turnState.timer <= 10 ? "text-red-500 animate-pulse" : "text-amber-400"
                }`}>
                  {turnState.timer}s
                </span>
              </div>
            </div>

            {/* Revealed Host Hint bar */}
            {revealedHint ? (
              <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl font-sans font-bold text-xs flex items-center gap-2 shadow-xs">
                <HelpCircle size={15} className="text-amber-500 shrink-0" />
                <span>💡 Pista del profesor: <strong>{revealedHint}</strong></span>
              </div>
            ) : turnState.hint ? (
              <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl flex items-center justify-between text-xs font-sans text-slate-500">
                <span>Esta palabra secreta cuenta con una pista disponible para los alumnos.</span>
                <button
                  onClick={handleTriggerHint}
                  className="bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-lg cursor-pointer text-[10.5px] font-black flex items-center gap-1"
                >
                  <Eye size={12} />
                  <span>Aparición de Pista</span>
                </button>
              </div>
            ) : null}

            {/* BIG REFLECTIVE CANVAS */}
            <div className="bg-white p-4 border border-slate-200 rounded-3xl shadow-md min-h-[440px]">
              <PictionaryCanvas
                isWritable={false}
                externalActions={canvasExternalActions}
              />
            </div>

            {/* Teacher Direct Control strip */}
            <div className="flex flex-wrap items-center justify-between bg-slate-50 border border-slate-200 p-4 rounded-2xl gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleTimer}
                  className={`px-4 py-2 rounded-xl text-xs font-black cursor-pointer shadow-xs transition-colors border flex items-center gap-1 ${
                    isPaused
                      ? "bg-emerald-600 border-emerald-750 text-white hover:bg-emerald-700"
                      : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
                  }`}
                >
                  {isPaused ? <Play size={13} fill="currentColor" /> : <Pause size={13} fill="currentColor" />}
                  <span>{isPaused ? "Reanudar Tiempo" : "Pausar Tiempo"}</span>
                </button>

                {turnState.hint && !revealedHint && (
                  <button
                    onClick={handleTriggerHint}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-250 border border-slate-200 text-slate-700 rounded-xl text-xs font-black cursor-pointer"
                  >
                    💡 Revelar Pista
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 select-none">
                <button
                  onClick={handleSkipWord}
                  className="px-4.5 py-2.5 bg-slate-750 hover:bg-slate-900 border border-slate-850 text-white text-xs font-black rounded-xl cursor-pointer flex items-center gap-1 transition-colors"
                >
                  <FastForward size={13} />
                  <span>Saltar Palabra</span>
                </button>

                <button
                  onClick={handleMarkCorrect}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 border border-emerald-750 text-white text-xs font-black rounded-xl cursor-pointer flex items-center gap-1 transition-all shadow-sm shadow-emerald-200"
                >
                  <Check size={14} strokeWidth={3} />
                  <span>¡¡ Marcar Correcto !!</span>
                </button>
              </div>
            </div>

          </div>

          {/* Side Panel: Active Ranking scoreboard */}
          <div className="space-y-4">
            {/* Real-time Universal Buzzer */}
            <TeacherBuzzerPanel pin={pin} gameMode="pictionary" />

            <div className="bg-slate-900 text-white p-5 rounded-3xl border border-slate-950 space-y-4 shadow-md">
              <h4 className="text-xs font-black uppercase tracking-wider font-mono border-b border-slate-850 pb-2">
                🏆 Tabla de Posiciones
              </h4>

              <div className="space-y-2.5">
                {sortedTeams.map((t, idx) => (
                  <div key={t.id} className="flex items-center justify-between text-xs py-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-slate-500 font-extrabold w-4">#{idx + 1}</span>
                      <span className="text-base select-none">{t.icon}</span>
                      <span className="font-bold block text-slate-200">{t.name}</span>
                    </div>
                    <span className="font-black text-amber-400 font-mono text-sm leading-none">{scores[t.id] || 0} pts</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Word details / Categories summary card */}
            <div className="bg-white border border-slate-200 p-5 rounded-3xl space-y-3 shadow-xs">
              <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-widest block pb-1 border-b border-slate-100">
                Información de Palabra
              </span>
              <div className="space-y-1.5 text-xs">
                <p className="text-slate-500">
                  Categoría: <strong className="text-slate-800">{turnState.category || "Física"}</strong>
                </p>
                <p className="text-slate-500">
                  Dificultad: <strong className="text-slate-800">{turnState.difficulty || "Media"}</strong>
                </p>
                {turnState.hint && (
                  <p className="text-slate-400 font-sans italic leading-relaxed text-[11px] pt-1">
                    💡 Pista: {turnState.hint}
                  </p>
                )}
              </div>
            </div>

            {/* Quick exit bar */}
            <button
              onClick={handleForceEnd}
              className="w-full py-3 bg-red-50 hover:bg-red-100 border border-red-150 text-red-600 font-black text-xs uppercase tracking-wide rounded-2xl cursor-pointer transition-colors flex items-center justify-center gap-1"
            >
              <StopCircle size={14} />
              <span>Finalizar Partida</span>
            </button>
          </div>
        </div>
      )}

      {/* END GAME / REPORT PODIUM STATE */}
      {status === "ended" && (
        <div className="space-y-6 max-w-3xl mx-auto text-center p-6 bg-white border border-slate-200 rounded-3xl shadow-xl animate-fade-in" id="pictionary-podium-view">
          
          <div className="space-y-2">
            <span className="text-6xl inline-block animate-bounce">🏆</span>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight font-sans">¡Partida Completada Exitosamente!</h3>
            <p className="text-slate-500 text-xs font-sans">Módulo Pictionary Educativo — PrepMaster Live v2.3.0</p>
          </div>

          {/* Educational Podio Grid */}
          <div className="grid grid-cols-3 gap-3 max-w-md mx-auto items-end pt-6 pb-2" id="victory-podium">
            
            {/* 2nd Place */}
            {sortedTeams[1] && (
              <div className="bg-slate-50 border border-slate-200 rounded-t-2xl p-4 space-y-2 text-center shadow-xs">
                <span className="text-3xl select-none">{sortedTeams[1].icon}</span>
                <h5 className="text-xs font-black text-slate-800 line-clamp-1">{sortedTeams[1].name}</h5>
                <span className="bg-slate-100 text-[10px] text-slate-500 font-black px-2 py-0.5 rounded-full font-mono">
                  {scores[sortedTeams[1].id] || 0} pts
                </span>
                <div className="bg-slate-250 h-16 w-full rounded-t-lg font-black text-slate-500 text-xl flex items-center justify-center">2</div>
              </div>
            )}

            {/* 1st Place */}
            {sortedTeams[0] && (
              <div className="bg-amber-50/50 border-2 border-amber-300 rounded-t-3xl p-5 space-y-3 text-center shadow-md relative -translate-y-2">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-950 text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-sm">
                  Campeón
                </div>
                <span className="text-4xl select-none">{sortedTeams[0].icon}</span>
                <h5 className="text-sm font-black text-slate-900 line-clamp-1">{sortedTeams[0].name}</h5>
                <span className="bg-amber-100 text-xs text-amber-700 font-black px-3 py-1 rounded-full font-mono">
                  {scores[sortedTeams[0].id] || 0} pts
                </span>
                <div className="bg-amber-400 h-24 w-full rounded-t-xl font-black text-amber-950 text-2xl flex items-center justify-center">1</div>
              </div>
            )}

            {/* 3rd Place */}
            {sortedTeams[2] && (
              <div className="bg-slate-50 border border-slate-200 rounded-t-2xl p-4 space-y-2 text-center shadow-xs">
                <span className="text-3xl select-none">{sortedTeams[2].icon}</span>
                <h5 className="text-xs font-black text-slate-800 line-clamp-1">{sortedTeams[2].name}</h5>
                <span className="bg-slate-100 text-[10px] text-slate-500 font-black px-2 py-0.5 rounded-full font-mono">
                  {scores[sortedTeams[2].id] || 0} pts
                </span>
                <div className="bg-amber-300/30 h-10 w-full rounded-t-lg font-black text-amber-700 text-lg flex items-center justify-center">3</div>
              </div>
            )}

          </div>

          {/* Historical detailed report log */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 text-left max-w-2xl mx-auto space-y-3">
            <h4 className="text-xs font-black uppercase font-mono text-slate-500 border-b border-slate-200 pb-2 flex items-center justify-between">
              <span>📋 Detalle de Palabras Jugadas</span>
              <span>Total: {playedWordsLog.length}</span>
            </h4>

            <div className="divide-y divide-slate-150 max-h-48 overflow-y-auto pr-1">
              {playedWordsLog.map((log, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 text-xs">
                  <div>
                    <span className="font-bold text-slate-900">{log.word}</span>
                    {log.category && (
                      <span className="text-[9px] bg-slate-200 text-slate-600 px-1 py-0.2 rounded font-mono ml-2 uppercase font-black">
                        {log.category}
                      </span>
                    )}
                    <p className="text-[10px] text-slate-400">Equipo en turno: {log.teamName}</p>
                  </div>

                  <div className="text-right">
                    <span className={`text-[9.5px] font-black uppercase font-mono px-2 py-0.5 rounded border block mb-0.5 ${
                      log.outcome === "correct" ? "bg-emerald-50 border-emerald-150 text-emerald-600" : "bg-red-50 border-red-50 text-red-500"
                    }`}>
                      {log.outcome === "correct" ? `Correcto (${log.points} pts)` : "Saltado"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 select-none">
            <button
              onClick={onEndGame}
              className="px-5 py-2.5 bg-slate-900 text-white font-black text-xs rounded-xl cursor-pointer hover:bg-slate-800 transition-colors"
            >
              Cerrar y Volver al Dashboard
            </button>

            <button
              onClick={handleExportExcelReport}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 border border-emerald-750 text-white font-black text-xs rounded-xl cursor-pointer shadow-md transition-all flex items-center gap-1.5"
            >
              <Award size={14} />
              <span>Exportar Reporte Excel (.JSON)</span>
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
