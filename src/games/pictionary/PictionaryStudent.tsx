import React, { useState, useEffect } from "react";
import { Users, Smile, Trophy, Play, CheckCircle2, AlertCircle, HelpCircle } from "lucide-react";
import PictionaryCanvas from "./PictionaryCanvas";
import { PictionaryConfig, PictionaryTeam, PictionaryWord } from "./pictionaryTypes";
import { safeStorage } from "../../lib/safeStorage";

interface PictionaryStudentProps {
  socket: any;
  pin: string;
}

export default function PictionaryStudent({ socket, pin }: PictionaryStudentProps) {
  const [player, setPlayer] = useState<any>(null);
  const [config, setConfig] = useState<PictionaryConfig | null>(null);
  const [bankName, setBankName] = useState("");
  const [status, setStatus] = useState("lobby"); // lobby, playing, ended

  // Team configurations
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [nickname, setNickname] = useState("");
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [declaredSize, setDeclaredSize] = useState(3);
  const [isJoined, setIsJoined] = useState(false);

  // Active game play states
  const [turnState, setTurnState] = useState<any>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [playersList, setPlayersList] = useState<any[]>([]);
  const [revealedHint, setRevealedHint] = useState("");
  const [finalResult, setFinalResult] = useState<any>(null);

  // Student guessed flags list
  const [hasGuessedFlag, setHasGuessedFlag] = useState(false);

  const avatars = ["🎒", "🎓", "🎨", "✏️", "🧬", "🧪", "🦖", "🦊", "🐯", "🐼", "🦅", "🦈", "🤖", "🚀", "🍕", "🎮"];

  // Canvas mirror callbacks
  const [strokeStartCallback, setStrokeStartCallback] = useState<any>(null);
  const [strokeUpdateCallback, setStrokeUpdateCallback] = useState<any>(null);
  const [clearCallback, setClearCallback] = useState<any>(null);

  const canvasExternalActions = {
    subscribeToStrokeStart: (cb: any) => setStrokeStartCallback(() => cb),
    subscribeToStrokeUpdate: (cb: any) => setStrokeUpdateCallback(() => cb),
    subscribeToClear: (cb: any) => setClearCallback(() => cb),
  };

  // Re-sync socket messages
  useEffect(() => {
    // Read previous credentials if any
    const savedName = safeStorage.getItem("prepmaster_pictionary_name") || "";
    if (savedName) setNickname(savedName);

    // Initial query on details
    socket.emit("pictionary:join-team", { pin, name: "_query_", teamId: "_spectator_" });

    socket.on("pictionary:join-success", (data: any) => {
      // If we are actually joining (not just querying status)
      if (data.player.name !== "_query_") {
        setPlayer(data.player);
        setIsJoined(true);
      }
      setConfig(data.config);
      setBankName(data.bankName);
      setStatus(data.status);
    });

    socket.on("pictionary:player-list", (data: { players: any[] }) => {
      setPlayersList(data.players);
    });

    socket.on("pictionary:team-sizes-updated", (data: { teams: PictionaryTeam[] }) => {
      setConfig((prev: any) => prev ? { ...prev, teams: data.teams } : null);
    });

    socket.on("pictionary:game-started", (data: any) => {
      setStatus("playing");
      setScores(data.scores);
    });

    socket.on("pictionary:turn-updated", (data: any) => {
      setTurnState(data.turnState);
      setPlayersList(data.players);
      setRevealedHint("");
      setHasGuessedFlag(false);
      // Clear the canvas upon new turn automatically
      if (clearCallback) {
        clearCallback();
      }
    });

    socket.on("pictionary:hint-shown", (data: { hint: string }) => {
      setRevealedHint(data.hint);
    });

    socket.on("pictionary:round-outcome", (data: any) => {
      setScores(data.scores);
    });

    // Mirror events from drawer to spectator canvas
    socket.on("pictionary:drawing-start", (data: any) => {
      if (strokeStartCallback) strokeStartCallback(data);
    });

    socket.on("pictionary:drawing-update", (data: any) => {
      if (strokeUpdateCallback) strokeUpdateCallback(data);
    });

    socket.on("pictionary:drawing-clear", () => {
      if (clearCallback) clearCallback();
    });

    socket.on("pictionary:game-ended", (data: any) => {
      setStatus("ended");
      setFinalResult(data.finalResult);
    });

    // Reconnection or error catcher
    socket.on("pictionary:error", (data: { message: string }) => {
      alert(data.message);
    });

    return () => {
      socket.off("pictionary:join-success");
      socket.off("pictionary:player-list");
      socket.off("pictionary:team-sizes-updated");
      socket.off("pictionary:game-started");
      socket.off("pictionary:turn-updated");
      socket.off("pictionary:hint-shown");
      socket.off("pictionary:round-outcome");
      socket.off("pictionary:drawing-start");
      socket.off("pictionary:drawing-update");
      socket.off("pictionary:drawing-clear");
      socket.off("pictionary:game-ended");
      socket.off("pictionary:error");
    };
  }, [pin, strokeStartCallback, strokeUpdateCallback, clearCallback]);

  // Handle local join submission
  const handleJoinPictionary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      alert("Por favor escribe tu nombre");
      return;
    }
    if (!selectedTeamId) {
      alert("Por favor selecciona un equipo");
      return;
    }

    safeStorage.setItem("prepmaster_pictionary_name", nickname.trim());

    // Send register payload
    socket.emit("pictionary:join-team", {
      pin,
      name: nickname.trim(),
      avatarId: avatars[avatarIndex],
      teamId: selectedTeamId,
      playerId: socket.id
    });

    // Update declared members size for that team
    socket.emit("pictionary:set-team-size", {
      pin,
      teamId: selectedTeamId,
      size: declaredSize
    });
  };

  // Drawer Stroke broadcast triggers
  const handleStrokeStart = (coords: any) => {
    socket.emit("pictionary:drawing-start", { pin, ...coords });
  };

  const handleStrokeUpdate = (coords: any) => {
    socket.emit("pictionary:drawing-update", { pin, ...coords });
  };

  const handleClear = () => {
    socket.emit("pictionary:drawing-clear", { pin });
  };

  // Student buzz "Creo saber la respuesta!"
  const handleBuzzerClick = () => {
    if (hasGuessedFlag) return;
    setHasGuessedFlag(true);

    // Broadcast a custom student message to host
    socket.emit("game:player-message", {
      pin,
      event: "pictionary:student-guess-alert",
      studentName: player.name,
      teamName: config?.teams.find(t => t.id === player.teamId)?.name || ""
    });
  };

  // Check state helper
  const isMyTurnToDraw = turnState && player && turnState.teamId === player.teamId && turnState.drawerName === player.name;
  const originalTeam = config?.teams.find(t => t.id === player?.teamId);

  // Render 1: Enter Name and Choose Team Form (Lobby state for non-joined)
  if (!isJoined) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white border border-slate-200 rounded-3xl shadow-lg space-y-6" id="pictionary-join-lobby">
        <div className="text-center space-y-1">
          <span className="text-4xl">🎨</span>
          <h3 className="text-xl font-black text-slate-900 tracking-tight font-sans">Unirse a Pictionary Educativo</h3>
          <p className="text-slate-400 text-xs font-mono font-bold uppercase tracking-wider">PIN de la sala: {pin}</p>
        </div>

        <form onSubmit={handleJoinPictionary} className="space-y-5 select-none">
          {/* A) Write Nickname */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">A) Escribe tu Nombre o Apodo</label>
            <input
              type="text"
              required
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Ej. Sofía, Juan, Carlos"
              maxLength={15}
              className="w-full p-2.5 bg-slate-50 border border-slate-250 rounded-xl text-sm font-bold text-slate-900 focus:outline-indigo-600 focus:bg-white"
            />
          </div>

          {/* B) Avatar Spinner */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest block">B) Selecciona tu Avatar</label>
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-3 rounded-xl justify-between">
              <span className="text-4xl bg-white p-2 rounded-xl border border-slate-150 shadow-inner w-14 h-14 flex items-center justify-center select-none">
                {avatars[avatarIndex]}
              </span>
              <div className="grid grid-cols-6 gap-1 flex-1 pl-2">
                {avatars.slice(0, 12).map((av, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAvatarIndex(idx)}
                    className={`text-xl p-1 rounded-lg hover:scale-110 active:scale-95 transition-transform ${
                      avatarIndex === idx ? "bg-indigo-50 border border-indigo-250" : "bg-transparent border border-transparent"
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* C) Select Team */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">C) Elige tu Equipo de Trabajo</label>
            <div className="grid grid-cols-2 gap-2" id="join-team-cards-grid">
              {config?.teams.map((t) => {
                const teamPlayersCount = playersList.filter(p => p.teamId === t.id).length;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setSelectedTeamId(t.id);
                      setDeclaredSize(t.declaredMembers || 3);
                    }}
                    className={`p-3.5 border rounded-2xl flex flex-col items-center gap-1.5 transition-all text-center ${
                      selectedTeamId === t.id
                        ? "border-indigo-600 ring-2 ring-indigo-100 bg-indigo-50/20"
                        : "border-slate-200 hover:border-slate-350 bg-white"
                    }`}
                  >
                    <span className="text-2xl">{t.icon}</span>
                    <span className="text-xs font-black text-slate-900 leading-tight">{t.name}</span>
                    <span className="text-[9px] font-mono font-extrabold px-2 py-0.5 rounded-full uppercase" style={{ color: t.color, backgroundColor: `${t.color}15` }}>
                      👥 {teamPlayersCount} conectados
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* D) Classmates size selection */}
          {selectedTeamId && (
            <div className="space-y-1.5 bg-indigo-50/30 p-4 border border-indigo-150 rounded-2xl animate-fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  <Users size={12} />
                  D) ¿Cuántos integran tu equipo?
                </span>
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={declaredSize}
                  onChange={(e) => setDeclaredSize(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-12 text-center p-1 font-black bg-white border border-slate-250 rounded-lg text-slate-900 focus:outline-indigo-600 text-xs"
                />
              </div>
              <p className="text-[9px] text-slate-400 font-medium leading-relaxed mt-1">
                La cantidad declarada se utiliza para organizar los turnos rotatorios de dibujo.
              </p>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md transition-all select-none cursor-pointer uppercase tracking-wider border border-indigo-750"
          >
            🚀 Entrar a la Partida
          </button>
        </form>
      </div>
    );
  }

  // Render 2: Lobby Ready status
  if (status === "lobby") {
    const classmates = playersList.filter(p => p.teamId === player.teamId);
    const estimated = originalTeam?.declaredMembers || 3;
    const isUnderCapacity = classmates.length < estimated;

    return (
      <div className="max-w-md mx-auto p-6 bg-white border border-slate-200 rounded-3xl shadow-lg space-y-6 text-center animate-fade-in" id="student-pictionary-ready-panel">
        <div className="space-y-1 select-none">
          <span className="text-5xl inline-block animate-bounce">{player.avatarId}</span>
          <h4 className="text-md font-black text-slate-900 font-sans">¡Conectado como {player.name}!</h4>
          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-mono font-extrabold px-3 py-1 rounded-full border shadow-sm" style={{ color: originalTeam?.color, borderColor: originalTeam?.color, backgroundColor: `${originalTeam?.color}08` }}>
            <span>{originalTeam?.icon}</span>
            <span>{originalTeam?.name}</span>
          </span>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-3">
          <h5 className="text-xs font-black text-slate-800 flex items-center justify-between">
            <span>👥 Compañeros de equipo conectados:</span>
            <span className="text-xs font-mono text-slate-600 font-black">{classmates.length} / {estimated}</span>
          </h5>

          <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto pr-1">
            {classmates.map((p) => (
              <div key={p.id} className="flex items-center gap-2 py-2">
                <span>{p.avatarId}</span>
                <span className="text-xs font-bold text-slate-700">{p.name} {p.id === socket.id && <strong className="text-indigo-600 font-mono">(Tú)</strong>}</span>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-200 flex items-center gap-2">
            {isUnderCapacity ? (
              <>
                <AlertCircle size={14} className="text-amber-500 shrink-0" />
                <p className="text-[10px] text-amber-700 leading-normal font-sans font-semibold">
                  Faltan compañeros por unirse ({classmates.length} de {estimated}). Dile al profesor cuando estén listos.
                </p>
              </>
            ) : (
              <>
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <p className="text-[10px] text-emerald-800 leading-normal font-sans font-semibold">
                  ¡Equipo completo! Esperando a que el profesor inicie el juego en la pantalla principal.
                </p>
              </>
            )}
          </div>
        </div>

        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider animate-pulse font-mono block">
          📺 El profesor iniciará la partida...
        </span>
      </div>
    );
  }

  // Render 3: Game Ended
  if (status === "ended") {
    return (
      <div className="max-w-md mx-auto p-6 bg-white border border-slate-200 rounded-3xl shadow-lg space-y-6 text-center animate-fade-in" id="student-pictionary-podium-panel">
        <span className="text-5xl">🏆</span>
        <h4 className="text-lg font-black text-slate-900 font-sans">¡Partida de Pictionary Terminada!</h4>
        
        <div className="space-y-2 bg-slate-50 border border-slate-200 p-5 rounded-2xl text-left">
          <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-widest block pb-1 border-b border-slate-200 mb-2">TABLÓN GENERAL</span>
          {config?.teams.map((t) => (
            <div key={t.id} className="flex items-center justify-between py-1.5 text-xs">
              <span className="font-bold text-slate-800 flex items-center gap-1">
                <span>{t.icon}</span>
                <span>{t.name}</span>
              </span>
              <span className="font-black text-slate-950 font-mono text-sm">{scores[t.id] || 0} pts</span>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-slate-400 font-bold font-mono">
          ¡Excelente participación! Consulta la proyección del profesor para ver los resultados detallados y el podio escolar.
        </p>
      </div>
    );
  }

  // Render 4: Active Drawing Phase
  if (status === "playing") {
    if (!turnState) {
      return (
        <div className="p-12 text-center text-slate-500 font-mono text-xs animate-pulse">
          ⏳ Sincronizando estado de turnos educativos...
        </div>
      );
    }

    const currentTurnTeam = config?.teams.find(t => t.id === turnState.teamId);

    return (
      <div className="space-y-4 max-w-lg mx-auto p-3" id="student-pictionary-playing-screen">
        {/* Turn indicator info */}
        <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-between shadow-md select-none border border-slate-800">
          <div className="space-y-1">
            <span className="text-[9px] uppercase font-mono bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-0.5 rounded-full font-black">
              Ronda {turnState.roundNumber} / Palabra {turnState.wordIndex + 1}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-lg">{currentTurnTeam?.icon}</span>
              <h5 className="text-xs font-black" style={{ color: currentTurnTeam?.color }}>{currentTurnTeam?.name}</h5>
            </div>
            <p className="text-[10px] text-slate-400">
              Dibujante en turno: <strong>{turnState.drawerName}</strong>
            </p>
          </div>

          <div className="text-center bg-slate-800 border border-slate-700/80 p-2 py-1 rounded-xl min-w-16">
            <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block pb-0.5">Tiempo</span>
            <span className="text-lg font-black font-mono leading-none tracking-tight text-amber-400">{turnState.timer}s</span>
          </div>
        </div>

        {/* DRAWER VIEW */}
        {isMyTurnToDraw ? (
          <div className="bg-white border border-slate-200 p-4 rounded-3xl space-y-3 shadow-md animate-fade-in" id="drawer-active-panel">
            <div className="bg-indigo-600 text-white p-4 rounded-2xl text-center space-y-1 border border-indigo-750 shadow-inner select-none">
              <span className="text-[9px] uppercase tracking-widest font-extrabold text-indigo-200 block">TU PALABRA SECRETA</span>
              <h3 className="text-2xl font-black font-sans tracking-tight">{turnState.word}</h3>
              <div className="flex items-center justify-center gap-2 pt-1">
                {turnState.category && (
                  <span className="bg-white/15 text-[9px] px-2 py-0.5 rounded uppercase font-black font-mono">
                    🏷️ {turnState.category}
                  </span>
                )}
                <span className="bg-white/15 text-[9px] px-2 py-0.5 rounded uppercase font-black font-mono">
                  🧠 Dificultad: {turnState.difficulty}
                </span>
              </div>
            </div>

            {/* Hint shown if active or after 30s */}
            {revealedHint ? (
              <div className="p-3 bg-amber-50 border border-amber-200 font-sans font-bold rounded-xl flex items-center gap-2 select-none">
                <HelpCircle size={14} className="text-amber-500 shrink-0" />
                <p className="text-xs text-amber-800">💡 Pista revelada: {revealedHint}</p>
              </div>
            ) : turnState.hint ? (
              <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl select-none text-[10px] font-mono text-slate-400 text-center">
                El profesor compartirá una pista si es necesario.
              </div>
            ) : null}

            {/* DRAWING CANVAS */}
            <PictionaryCanvas
              isWritable={true}
              onStrokeStart={handleStrokeStart}
              onStrokeUpdate={handleStrokeUpdate}
              onClear={handleClear}
            />
          </div>
        ) : (
          /* SPECTATOR / OTHER GUESSERS VIEW */
          <div className="bg-white border border-slate-200 p-4 rounded-3xl space-y-4 shadow-md animate-fade-in" id="spectator-active-panel">
            {/* Companion Header */}
            <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl text-center space-y-1 select-none">
              <span className="text-3xl animate-pulse inline-block select-none">✏️</span>
              <h4 className="text-xs font-black text-slate-800 leading-normal uppercase tracking-wider">
                {turnState.drawerName} está dibujando ahora...
              </h4>
              <p className="text-[10px] text-slate-400 font-sans">
                ¡Adivina la respuesta en voz alta! El profesor la registrará en la pantalla principal.
              </p>
            </div>

            {/* SPECTATING CANVAS MIRROR */}
            <PictionaryCanvas
              isWritable={false}
              externalActions={canvasExternalActions}
            />

            {/* Optional guess buzzer to raise teacher alert */}
            <div className="pt-2">
              <button
                onClick={handleBuzzerClick}
                disabled={hasGuessedFlag}
                className={`w-full py-4 rounded-xl cursor-pointer font-black text-xs uppercase tracking-wide transition-all border flex items-center justify-center gap-1.5 shadow-sm ${
                  hasGuessedFlag
                    ? "bg-slate-100 border-slate-250 text-slate-400 cursor-not-allowed"
                    : "bg-indigo-600 border-indigo-750 hover:bg-indigo-700 text-white"
                }`}
              >
                <span>🛎️</span>
                <span>{hasGuessedFlag ? "¡Alerta enviada correctamente!" : "¡Creo saber la respuesta!"}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
