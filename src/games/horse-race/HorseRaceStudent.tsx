import React, { useState, useEffect } from "react";
import { HorseRaceConfig, HorseRaceTeam, HorseRacePlayer } from "./horseRaceTypes";
import { Socket } from "socket.io-client";
import { Check, X, Shield, Zap, Sparkles } from "lucide-react";
import { playGameSound } from "../../lib/sound";

interface HorseRaceStudentProps {
  socket: any; // Socket.io Client
  pin: string;
}

export default function HorseRaceStudent({ socket, pin }: HorseRaceStudentProps) {
  const [player, setPlayer] = useState<any>(null);
  const [config, setConfig] = useState<HorseRaceConfig | null>(null);
  const [teams, setTeams] = useState<HorseRaceTeam[]>([]);
  const [status, setStatus] = useState<"team_select" | "lobby" | "playing" | "results">("lobby");

  const [activeQuestion, setActiveQuestion] = useState<any>(null);
  const [timer, setTimer] = useState<number>(20);
  const [answeredIndex, setAnsweredIndex] = useState<number | null>(null);
  const [showAnswers, setShowAnswers] = useState<boolean>(false);

  // Power Ups
  const [powerUpsUsed, setPowerUpsUsed] = useState<Record<string, boolean>>({
    turbo: false,
    shield: false,
    sprint: false,
  });

  useEffect(() => {
    // Join as a horse race player or fetch configuration
    socket.emit("horse:join", {
      pin,
      name: localStorage.getItem("prepmaster_name") || "Estudiante",
      avatarId: localStorage.getItem("prepmaster_avatar_id") || "cult_mariachi",
      teamId: localStorage.getItem("prepmaster_team_id") || "",
      playerId: localStorage.getItem("prepmaster_player_id") || ""
    });

    socket.on("horse:join-success", ({ player: joinedPlayer, config: activeConfig, teams: activeTeams }) => {
      setPlayer(joinedPlayer);
      setConfig(activeConfig);
      setTeams(activeTeams);
      
      if (activeConfig.gameMode !== "all_vs_all" && !joinedPlayer.teamId) {
        setStatus("team_select");
      } else {
        setStatus("lobby");
      }
    });

    socket.on("horse:player-list", ({ teams: activeTeams }) => {
      if (activeTeams) setTeams(activeTeams);
    });

    socket.on("horse:game-started", ({ turnState, teams: activeTeams }) => {
      setStatus("playing");
      setTeams(activeTeams);
      setActiveQuestion(turnState.activeQuestion);
      setTimer(turnState.timer);
      setAnsweredIndex(null);
      setShowAnswers(false);
    });

    socket.on("horse:timer-updated", ({ timer: currentTimer }) => {
      setTimer(currentTimer);
    });

    socket.on("horse:answers-shown", () => {
      setShowAnswers(true);
    });

    socket.on("horse:turn-updated", ({ turnState }) => {
      setActiveQuestion(turnState.activeQuestion);
      setTimer(turnState.timer);
      setAnsweredIndex(null);
      setShowAnswers(false);
    });

    socket.on("horse:positions-updated", ({ teams: activeTeams, players: currentPlayers }) => {
      if (activeTeams) setTeams(activeTeams);
      // Find our current player to see new positions
      const us = currentPlayers.find((p: any) => p.id === socket.id);
      if (us) setPlayer(us);
    });

    socket.on("horse:game-ended", () => {
      setStatus("results");
    });

    return () => {
      socket.off("horse:join-success");
      socket.off("horse:player-list");
      socket.off("horse:game-started");
      socket.off("horse:timer-updated");
      socket.off("horse:answers-shown");
      socket.off("horse:turn-updated");
      socket.off("horse:positions-updated");
      socket.off("horse:game-ended");
    };
  }, [pin]);

  const handleSelectTeam = (teamId: string) => {
    localStorage.setItem("prepmaster_team_id", teamId);
    socket.emit("horse:join", {
      pin,
      name: localStorage.getItem("prepmaster_name") || "Estudiante",
      avatarId: localStorage.getItem("prepmaster_avatar_id") || "cult_mariachi",
      teamId,
      playerId: localStorage.getItem("prepmaster_player_id") || ""
    });
    setStatus("lobby");
    playGameSound("descubrir_respuesta");
  };

  const handleSubmitAnswer = (idx: number) => {
    if (answeredIndex !== null || showAnswers) return;
    setAnsweredIndex(idx);
    socket.emit("horse:submit-answer", { pin, optionIndex: idx });
    playGameSound("correcto");
  };

  const handleUsePowerUp = (type: "turbo" | "shield" | "sprint") => {
    if (powerUpsUsed[type] || !config) return;
    setPowerUpsUsed((prev) => ({ ...prev, [type]: true }));

    // Send powerup activation event
    socket.emit("horse:powerup", {
      pin,
      powerUpType: type,
      targetTeamId: player?.teamId,
      targetPlayerId: player?.id
    });

    playGameSound("cambio_ranking");
  };

  if (!player || !config) {
    return (
      <div className="p-8 text-center text-slate-500 font-sans" id="student-loading">
        <span className="text-4xl animate-spin block mb-3">🔄</span>
        Conectando con la pista de caballos...
      </div>
    );
  }

  // 1. TEAM SELECTION
  if (status === "team_select") {
    return (
      <div className="max-w-md mx-auto bg-white p-6 rounded-3xl shadow-xl border border-slate-200 select-none space-y-6" id="student-team-select">
        <div className="text-center">
          <span className="text-4xl">🐎</span>
          <h3 className="text-2xl font-black text-slate-800 font-sans mt-2">Selecciona tu Equipo</h3>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Únete a uno de los caballos para competir en equipo.
          </p>
        </div>

        <div className="space-y-3">
          {teams.map((t) => (
            <button
              key={t.id}
              onClick={() => handleSelectTeam(t.id)}
              className="w-full p-4 bg-slate-50 border-2 border-slate-200 hover:border-amber-400 rounded-2xl flex items-center justify-between text-left transition transform active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{t.icon}</span>
                <span className="font-extrabold text-slate-700 font-sans">{t.name}</span>
              </div>
              <span className="bg-slate-200 text-slate-600 text-xs font-black px-2.5 py-1 rounded-full font-mono">
                {t.membersCount || 0} alumnos
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // 2. LOBBY STATE
  if (status === "lobby") {
    const matchedTeam = teams.find(t => t.id === player.teamId);
    return (
      <div className="max-w-md mx-auto bg-white p-6 rounded-3xl shadow-xl border border-slate-200 text-center space-y-6" id="student-lobby">
        <div className="p-4 bg-amber-500 text-white rounded-2xl inline-block shadow-md">
          <span className="text-4xl">🐎</span>
        </div>
        <div className="space-y-1">
          <h3 className="text-2xl font-black text-slate-800 font-sans">¡Te has unido con éxito!</h3>
          <p className="text-sm text-slate-500 font-sans">
            Preparando tus herraduras para el gran galope.
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl text-left space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest font-sans">Tus datos</p>
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-slate-800 font-sans">{player.name}</span>
            {matchedTeam && (
              <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full font-sans">
                {matchedTeam.icon} {matchedTeam.name}
              </span>
            )}
          </div>
        </div>

        <div className="py-2 text-xs text-amber-600 font-sans font-bold animate-pulse">
          ⏳ Esperando a que el profesor inicie la carrera...
        </div>
      </div>
    );
  }

  // 3. PLAYING STATE
  if (status === "playing") {
    const alphabetical = ["A", "B", "C", "D"];

    return (
      <div className="max-w-md mx-auto space-y-4" id="student-playing">
        {/* TIMER BAR */}
        <div className="bg-slate-900 text-white p-3.5 rounded-2xl flex items-center justify-between font-mono text-sm border border-slate-800 shadow-md">
          <span className="font-sans font-bold text-slate-300">⏳ TIEMPO RESTANTE</span>
          <span className={`font-black text-lg ${timer <= 5 ? "text-red-500 animate-pulse" : "text-amber-400"}`}>
            {timer}s
          </span>
        </div>

        {activeQuestion ? (
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-md space-y-4">
            <h4 className="font-extrabold text-slate-800 text-base leading-tight font-sans">
              {activeQuestion.text}
            </h4>

            {/* Answer Options tactile buttons */}
            <div className="space-y-2.5 pt-2">
              {activeQuestion.options?.map((opt: string, idx: number) => {
                const isSelected = answeredIndex === idx;

                return (
                  <button
                    key={idx}
                    disabled={answeredIndex !== null || showAnswers}
                    onClick={() => handleSubmitAnswer(idx)}
                    className={`w-full p-4 rounded-2xl border-2 text-left flex items-start gap-3 transition-all transform active:scale-[0.98] ${
                      isSelected
                        ? "bg-amber-500 border-amber-600 text-white font-black"
                        : "bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700 font-semibold"
                    }`}
                  >
                    <span className={`w-6 h-6 rounded font-mono font-black text-xs flex items-center justify-center shrink-0 ${
                      isSelected ? "bg-amber-600 text-white" : "bg-white text-slate-600 border border-slate-200"
                    }`}>
                      {alphabetical[idx]}
                    </span>
                    <span className="text-sm font-sans">{opt}</span>
                  </button>
                );
              })}
            </div>

            {answeredIndex !== null && !showAnswers && (
              <div className="bg-indigo-50 border border-indigo-150 p-4 rounded-xl text-center text-indigo-800 text-xs font-bold font-sans animate-pulse">
                👍 Respuesta enviada. ¡Esperando la revelación oficial!
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-md text-center text-slate-400 font-sans">
            Preparando la siguiente pregunta...
          </div>
        )}

        {/* POWER UPS TACTILE BUTTONS */}
        {config.powerUpsEnabled && (
          <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-md space-y-3">
            <h5 className="font-black text-xs text-slate-500 uppercase tracking-wider font-sans text-center">
              ⚡ TUS POWER-UPS (Pruébalos para impulsar el caballo)
            </h5>
            <div className="grid grid-cols-3 gap-2">
              <button
                disabled={powerUpsUsed.turbo}
                onClick={() => handleUsePowerUp("turbo")}
                className="p-3 bg-slate-50 hover:bg-amber-50 border border-slate-200 disabled:opacity-40 disabled:hover:bg-slate-50 rounded-xl flex flex-col items-center justify-center text-center transition"
              >
                <Sparkles className="w-5 h-5 text-amber-500 mb-1" />
                <span className="font-extrabold text-[10px] text-slate-700 font-sans">Turbo (+1)</span>
              </button>

              <button
                disabled={powerUpsUsed.shield}
                onClick={() => handleUsePowerUp("shield")}
                className="p-3 bg-slate-50 hover:bg-blue-50 border border-slate-200 disabled:opacity-40 disabled:hover:bg-slate-50 rounded-xl flex flex-col items-center justify-center text-center transition"
              >
                <Shield className="w-5 h-5 text-blue-500 mb-1" />
                <span className="font-extrabold text-[10px] text-slate-700 font-sans">Escudo</span>
              </button>

              <button
                disabled={powerUpsUsed.sprint}
                onClick={() => handleUsePowerUp("sprint")}
                className="p-3 bg-slate-50 hover:bg-purple-50 border border-slate-200 disabled:opacity-40 disabled:hover:bg-slate-50 rounded-xl flex flex-col items-center justify-center text-center transition"
              >
                <Zap className="w-5 h-5 text-purple-500 mb-1" />
                <span className="font-extrabold text-[10px] text-slate-700 font-sans">Sprint (x2)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 4. RESULTS STATE
  if (status === "results") {
    return (
      <div className="max-w-md mx-auto bg-slate-900 border-2 border-amber-500 text-white p-6 rounded-3xl shadow-xl text-center space-y-6" id="student-results">
        <span className="text-5xl animate-bounce block">🏆</span>
        <div className="space-y-1">
          <h3 className="text-2xl font-black text-amber-400 font-sans">¡Carrera Finalizada!</h3>
          <p className="text-xs text-slate-400 font-sans">
            Mira la pantalla del proyector para ver el podio final completo.
          </p>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="w-full bg-slate-800 hover:bg-slate-700 text-white font-extrabold py-3.5 px-6 rounded-2xl border border-slate-700 transition"
        >
          Unirse a Otra Partida
        </button>
      </div>
    );
  }

  return null;
}
