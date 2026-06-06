import React, { useState, useEffect } from "react";
import { 
  Check, X, Trophy, RefreshCw, AlertCircle, 
  Gamepad2, Sparkles, Zap, Award, Smile, Users
} from "lucide-react";
import { socket } from "../lib/socket";
import { Player, Team } from "../types";
import { AvatarRenderer, AVATAR_LIST, AVATAR_CATEGORIES, getAvatarById } from "./AvatarCatalog";

export default function StudentInterface() {
  const [pin, setPin] = useState(() => localStorage.getItem("prepmaster_pin") || "");
  const [name, setName] = useState(() => localStorage.getItem("prepmaster_name") || "");
  const [selectedAvatarId, setSelectedAvatarId] = useState(() => localStorage.getItem("prepmaster_avatar_id") || "cult_mariachi");
  const [activeCategory, setActiveCategory] = useState("Todos");
  
  // Team selection states
  const [roomGameMode, setRoomGameMode] = useState<'individual' | 'teams'>('individual');
  const [roomTeams, setRoomTeams] = useState<Team[]>([]);
  const [playersInSession, setPlayersInSession] = useState<Player[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(() => localStorage.getItem("prepmaster_team_id") || null);
  
  const [joined, setJoined] = useState(false);
  const [joinedPin, setJoinedPin] = useState("");
  const [roomTitle, setRoomTitle] = useState("");
  
  const [playerInfo, setPlayerInfo] = useState<Player | null>(null);
  const [currentStatus, setCurrentStatus] = useState<
    'lobby' | 'countdown' | 'question' | 'reveal' | 'leaderboard' | 'ended'
  >("lobby");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isConnected, setIsConnected] = useState(socket.connected);

  // Active question details for student view
  const [activeQuestion, setActiveQuestion] = useState<{
    currentIndex: number;
    totalQuestions: number;
    text: string;
    options: string[];
    timeLimit: number;
    timer: number;
  } | null>(null);

  // Answer status
  const [answeredIndex, setAnsweredIndex] = useState<number | null>(null);
  const [questionResult, setQuestionResult] = useState<{
    isCorrect: boolean;
    correctOption: number;
    pointsEarned: number;
    totalScore: number;
    streak: number;
    answeredThisQuestion: boolean;
  } | null>(null);

  // Countdown timer local representation
  const [countdownTimer, setCountdownTimer] = useState(5);

  // Track socket connection status
  useEffect(() => {
    const handleConnect = () => {
      setIsConnected(true);
      // Trigger automatic reconnection if we are disconnected middle-game
      const storedPin = localStorage.getItem("prepmaster_pin");
      const storedName = localStorage.getItem("prepmaster_name");
      const storedPlayerId = localStorage.getItem("prepmaster_player_id");
      const storedAvatarId = localStorage.getItem("prepmaster_avatar_id");
      const storedTeamId = localStorage.getItem("prepmaster_team_id");

      if (storedPin && storedName) {
        setSubmitting(true);
        socket.emit("player:join", {
          pin: storedPin,
          name: storedName,
          playerId: storedPlayerId || undefined,
          avatarId: storedAvatarId || undefined,
          teamId: storedTeamId || undefined
        });
      }
    };
    const handleDisconnect = () => {
      setIsConnected(false);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    // Initial mount auto-join
    const storedPin = localStorage.getItem("prepmaster_pin");
    const storedName = localStorage.getItem("prepmaster_name");
    const storedPlayerId = localStorage.getItem("prepmaster_player_id");
    const storedAvatarId = localStorage.getItem("prepmaster_avatar_id");
    const storedTeamId = localStorage.getItem("prepmaster_team_id");
    if (storedPin && storedName && !joined) {
      setSubmitting(true);
      socket.emit("player:join", {
        pin: storedPin,
        name: storedName,
        playerId: storedPlayerId || undefined,
        avatarId: storedAvatarId || undefined,
        teamId: storedTeamId || undefined
      });
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, [joined]);

  // Set up socket listeners for student activities
  useEffect(() => {
    socket.on("player:join-success", (data: { 
      player: Player; 
      pin: string; 
      title: string; 
      status?: any; 
      currentQuestionIndex?: number; 
      reconnected?: boolean;
      gameMode?: 'individual' | 'teams';
      teams?: Team[];
    }) => {
      setJoined(true);
      setJoinedPin(data.pin);
      setRoomTitle(data.title);
      setPlayerInfo(data.player);
      setRoomGameMode(data.gameMode || "individual");
      setRoomTeams(data.teams || []);
      
      if (data.status) {
        setCurrentStatus(data.status);
      } else {
        setCurrentStatus("lobby");
      }
      
      setError(null);
      setSubmitting(false);

      // Persist credentials
      localStorage.setItem("prepmaster_pin", data.pin);
      localStorage.setItem("prepmaster_name", data.player.name);
      if (data.player.playerId) {
        localStorage.setItem("prepmaster_player_id", data.player.playerId);
      }
      if (data.player.avatarId) {
        localStorage.setItem("prepmaster_avatar_id", data.player.avatarId);
        setSelectedAvatarId(data.player.avatarId);
      }
      if (data.player.teamId) {
        localStorage.setItem("prepmaster_team_id", data.player.teamId);
      }
    });

    socket.on("player:joined-list", (data: { players: Player[] }) => {
      setPlayersInSession(data.players || []);
    });

    socket.on("player:join-error", (data: { message: string }) => {
      setError(data.message);
      setSubmitting(false);
      
      // If we got join error on active rejoin, clear invalid credentials gently
      if (localStorage.getItem("prepmaster_pin")) {
        localStorage.removeItem("prepmaster_pin");
        localStorage.removeItem("prepmaster_name");
        localStorage.removeItem("prepmaster_player_id");
        setJoined(false);
      }
    });

    socket.on("game:status-update", (data: any) => {
      if (data.status === "countdown") {
        setCurrentStatus("countdown");
        setCountdownTimer(data.timer);
        // Clear active question and answers
        setActiveQuestion(null);
        setAnsweredIndex(null);
        setQuestionResult(null);
      }
      if (data.status === "leaderboard") {
        setCurrentStatus("leaderboard");
      }
      if (data.status === "ended") {
        setCurrentStatus("ended");
        setQuestionResult(null);
        setActiveQuestion(null);
      }
    });

    socket.on("countdown:tick", (data: { timer: number }) => {
      setCountdownTimer(data.timer);
    });

    socket.on("question:active", (data: any) => {
      setCurrentStatus("question");
      setAnsweredIndex(data.alreadyAnswered ? data.lastAnswerIndex ?? 0 : null);
      setQuestionResult(null);
      setActiveQuestion({
        currentIndex: data.currentIndex,
        totalQuestions: data.totalQuestions,
        text: data.text,
        options: data.options,
        timeLimit: data.timeLimit,
        timer: data.timer,
      });
    });

    socket.on("question:tick", (data: { timer: number }) => {
      if (activeQuestion) {
        setActiveQuestion((prev) => prev ? { ...prev, timer: data.timer } : null);
      }
    });

    socket.on("player:answer-received", (data: { optionIndex: number; pointsEarned: number; isLastCorrect: boolean }) => {
      setAnsweredIndex(data.optionIndex);
    });

    socket.on("player:question-result", (data: any) => {
      setCurrentStatus("reveal");
      setQuestionResult({
        isCorrect: data.isCorrect,
        correctOption: data.correctOption,
        pointsEarned: data.pointsEarned,
        totalScore: data.totalScore,
        streak: data.streak,
        answeredThisQuestion: data.answeredThisQuestion
      });
      
      // Update local player state
      if (playerInfo) {
        setPlayerInfo((prev) => prev ? {
          ...prev,
          score: data.totalScore,
          streak: data.streak
        } : null);
      }
    });

    return () => {
      socket.off("player:join-success");
      socket.off("player:joined-list");
      socket.off("player:join-error");
      socket.off("game:status-update");
      socket.off("countdown:tick");
      socket.off("question:active");
      socket.off("question:tick");
      socket.off("player:answer-received");
      socket.off("player:question-result");
    };
  }, [activeQuestion, playerInfo]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!pin.trim()) {
      setError("Por favor ingresa un PIN de partida");
      return;
    }
    if (!name.trim()) {
      setError("Por favor ingresa tu nombre o apodo");
      return;
    }

    // Persist local avatar
    localStorage.setItem("prepmaster_avatar_id", selectedAvatarId);

    setSubmitting(true);
    socket.emit("player:join", { 
      pin: pin.trim(), 
      name: name.trim(), 
      avatarId: selectedAvatarId 
    });
  };

  const handleLeave = () => {
    if (joinedPin) {
      socket.emit("player:leave", { pin: joinedPin });
    }
    localStorage.removeItem("prepmaster_pin");
    localStorage.removeItem("prepmaster_name");
    localStorage.removeItem("prepmaster_player_id");
    localStorage.removeItem("prepmaster_team_id");
    setSelectedTeamId(null);
    setJoined(false);
    setJoinedPin("");
    setRoomTitle("");
    setPlayerInfo(null);
    setCurrentStatus("lobby");
    setSubmitting(false);
    setAnsweredIndex(null);
    setQuestionResult(null);
    setActiveQuestion(null);
  };

  const handleSubmitAnswer = (optionIdx: number) => {
    if (answeredIndex !== null || !joinedPin) return;
    socket.emit("player:submit-answer", { pin: joinedPin, optionIndex: optionIdx });
    setAnsweredIndex(optionIdx);
  };

  // 1. LOGIN / ROOM ENTRY SCREEN
  if (!joined) {
    return (
      <div className="max-w-md mx-auto p-6 sm:p-8 bg-white border border-slate-200 rounded-3xl shadow-xl space-y-6 text-slate-800 animate-fade-in" id="student-login-card">
        <div className="text-center space-y-2">
          <Gamepad2 className="text-indigo-600 mx-auto w-12 h-12" />
          <h2 className="text-2xl font-extrabold tracking-tight font-sans text-slate-900">Entrar a la Partida</h2>
          <p className="text-xs text-slate-500">Pídele al profesor el código QR o el PIN de la sala local.</p>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-800" id="login-error-box">
            <AlertCircle className="shrink-0 mt-0.5 text-rose-500" size={16} />
            <span className="text-xs font-sans font-semibold">{error}</span>
          </div>
        )}

        {submitting && (
          <div className="flex items-center gap-2.5 justify-center bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 text-indigo-800" id="login-connecting-box">
            <RefreshCw className="animate-spin text-indigo-500 shrink-0" size={16} />
            <span className="text-xs font-sans font-bold">Intentando conectar con servidor local...</span>
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-4" id="form-student-join">
          <div>
            <label className="block text-[10px] uppercase font-sans font-extrabold tracking-wider text-slate-500 mb-1">
              Código PIN de Partida
            </label>
            <input
              type="text"
              pattern="[0-9]*"
              inputMode="numeric"
              maxLength={6}
              placeholder="Ej. 1234"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-3 text-center text-xl font-bold tracking-widest text-indigo-700 outline-none transition-colors"
              id="student-pin-input"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-sans font-extrabold tracking-wider text-slate-500 mb-1">
              Tu Nombre o Apodo
            </label>
            <input
              type="text"
              maxLength={15}
              placeholder="Ej. Mateo_G"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-3 text-center text-md font-sans text-slate-800 font-bold outline-none transition-colors placeholder-slate-400"
              id="student-name-input"
            />
          </div>

          {/* Avatar Selector Section */}
          <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-2xl p-4" id="avatar-selector-section">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-sans font-extrabold tracking-wider text-slate-550 block">
                Elige tu Avatar Mexicano 🇲🇽
              </span>
              <button
                type="button"
                onClick={() => {
                  const randomAv = AVATAR_LIST[Math.floor(Math.random() * AVATAR_LIST.length)];
                  setSelectedAvatarId(randomAv.id);
                }}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded-lg shadow-inner hover:scale-102 transition-all cursor-pointer"
              >
                🔀 Aleatorio
              </button>
            </div>

            {/* Active Preview */}
            <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-slate-150 shadow-sm animate-fade-in">
              <AvatarRenderer id={selectedAvatarId} size={48} className="ring-3 ring-indigo-500/10 shadow-sm shrink-0" />
              <div className="text-left font-sans">
                <p className="text-xs font-black text-slate-800 leading-tight">{getAvatarById(selectedAvatarId).name}</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{getAvatarById(selectedAvatarId).category}</p>
              </div>
            </div>

            {/* Category tabs */}
            <div className="flex gap-1 overflow-x-auto pb-1 select-none scrollbar-none" id="avatar-category-tabs">
              {["Todos", ...AVATAR_CATEGORIES].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`text-[9px] font-extrabold tracking-tight px-2.5 py-1 rounded-lg border whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    activeCategory === cat
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm font-black"
                      : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700 font-bold"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Avatars Grid */}
            <div className="grid grid-cols-5 gap-2 max-h-[140px] overflow-y-auto p-1 border border-slate-200 rounded-xl bg-white shadow-inner">
              {AVATAR_LIST.filter(
                (av) => activeCategory === "Todos" || av.category === activeCategory
              ).map((av) => {
                const isSelected = selectedAvatarId === av.id;
                return (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => setSelectedAvatarId(av.id)}
                    className={`relative p-1.5 rounded-xl flex items-center justify-center border-2 transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                      isSelected
                        ? "bg-indigo-50/50 border-indigo-600 ring-2 ring-indigo-600/15"
                        : "bg-slate-50/50 border-slate-100 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                    title={av.name}
                  >
                    {av.render(28)}
                    {isSelected && (
                      <span className="absolute -top-1 -right-1 bg-indigo-600 text-white rounded-full p-0.5 shadow-md">
                        <Check size={8} strokeWidth={4} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-sans font-extrabold py-3.5 px-6 rounded-xl shadow-md transition-transform active:scale-[0.98] disabled:opacity-50 text-sm tracking-wide cursor-pointer"
            id="student-submit-join"
          >
            {submitting ? "Verificando..." : "¡Unirse a Jugar!"}
          </button>
        </form>
      </div>
    );
  }

  // TEAM SELECTION INTERCEPTOR
  if (joined && roomGameMode === "teams" && !playerInfo?.teamId) {
    return (
      <div className="max-w-xl mx-auto p-6 sm:p-8 bg-white border border-slate-200 rounded-3xl shadow-xl space-y-6 text-slate-800 animate-fade-in" id="student-team-selection">
        <div className="text-center space-y-2">
          <Users className="text-indigo-650 mx-auto w-12 h-12" />
          <h2 className="text-2xl font-extrabold tracking-tight font-sans text-slate-900">Selecciona tu equipo</h2>
          <p className="text-xs text-slate-500">Esta partida se juega en Modo Equipos. Elige tu escuadra cooperativa para unerte:</p>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-800" id="team-error-box">
            <AlertCircle className="shrink-0 mt-0.5 text-rose-550" size={16} />
            <span className="text-xs font-sans font-semibold">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {roomTeams.map((team) => {
            const teamMembers = playersInSession.filter(p => p.teamId === team.id);
            const isSelected = selectedTeamId === team.id;
            
            return (
              <div
                key={team.id}
                onClick={() => setSelectedTeamId(team.id)}
                className="p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between h-36 relative select-none"
                style={{ 
                  borderColor: isSelected ? team.color : '#e2e8f0',
                  backgroundColor: isSelected ? `${team.color}10` : '#f8fafc'
                }}
              >
                {/* Icon and Name */}
                <div className="flex items-center gap-3">
                  <span className="text-3xl" role="img" aria-label={team.name}>
                    {team.icon}
                  </span>
                  <div>
                    <h3 className="font-sans font-black text-slate-900 text-sm leading-tight">{team.name}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: team.color }} />
                      <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 font-mono">
                        Color Activo
                      </span>
                    </div>
                  </div>
                </div>

                {/* Member count indicator */}
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-[10px] font-bold text-slate-500 font-sans uppercase">
                    Integrantes
                  </span>
                  <span className="text-xs font-black text-slate-800 px-2.5 py-0.5 bg-white border border-slate-200 rounded-full shadow-xs">
                    {teamMembers.length} {teamMembers.length === 1 ? 'alumno' : 'alumnos'}
                  </span>
                </div>

                {/* Selected visual Checkmark */}
                {isSelected && (
                  <div 
                    className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center text-white shadow-xs"
                    style={{ backgroundColor: team.color }}
                  >
                    <Check size={12} strokeWidth={3} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            if (!selectedTeamId) {
              setError("Por favor selecciona un equipo de la lista");
              return;
            }
            setError(null);
            setSubmitting(true);
            
            // Persist the selected team locally
            localStorage.setItem("prepmaster_team_id", selectedTeamId);
            
            // Re-join with teamId so server updates our player entry
            socket.emit("player:join", {
              pin: joinedPin,
              name: playerInfo?.name || name,
              playerId: playerInfo?.playerId || localStorage.getItem("prepmaster_player_id") || undefined,
              avatarId: playerInfo?.avatarId || selectedAvatarId,
              teamId: selectedTeamId
            });
          }}
          disabled={!selectedTeamId}
          className="w-full text-white font-sans font-extrabold py-3.5 px-6 rounded-xl shadow-md transition-transform active:scale-[0.98] disabled:opacity-50 text-sm tracking-wide cursor-pointer text-center font-sans font-bold"
          style={{ backgroundColor: selectedTeamId ? roomTeams.find(t => t.id === selectedTeamId)?.color : '#94a3b8' }}
        >
          {submitting ? "Confirmando Equipo..." : "Confirmar y Entrar a la Partida"}
        </button>
      </div>
    );
  }

  // Define nested content view depending on game status
  let gameView: React.ReactNode = null;

  // 2. STUDENT LOBBY (WAITING IN SADDLE)
  if (currentStatus === "lobby") {
    gameView = (
      <div className="bg-white border border-slate-200 rounded-3xl p-6 text-center space-y-6 shadow-xl" id="student-waiting-lobby">
        <div className="space-y-2">
          <Smile className="text-indigo-600 mx-auto w-12 h-12 animate-bounce" />
          <h3 className="text-xl font-extrabold text-slate-900 font-sans">¡Ya estás conectado!</h3>
          <p className="text-xs text-slate-500 font-sans font-bold">PIN de Sala: <span className="font-mono font-bold text-indigo-600">{joinedPin}</span></p>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col items-center justify-center space-y-2">
          <AvatarRenderer id={playerInfo?.avatarId || selectedAvatarId} size={72} className="ring-4 ring-indigo-500/10 shadow-md bg-white p-1" />
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold font-sans block">Tu Apodo en Sala</span>
            <span className="text-lg font-bold text-slate-800 font-sans tracking-wide block">{name}</span>
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full mt-1.5 inline-block">
              Avatar: {getAvatarById(playerInfo?.avatarId || selectedAvatarId).name}
            </span>
          </div>
        </div>

        <div className="py-4 space-y-2">
          <p className="text-xs text-slate-500 font-bold font-sans tracking-wide">Esperando que el docente inicie el juego...</p>
          <div className="flex justify-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-bounce"></span>
          </div>
        </div>
      </div>
    );
  }

  // 3. STUDENT COUNTDOWN PRE-QUESTION PULLS
  else if (currentStatus === "countdown") {
    gameView = (
      <div className="bg-white border border-slate-200 rounded-3xl p-6 text-center space-y-6 shadow-xl" id="student-prepare-countdown">
        <Sparkles className="text-amber-500 mx-auto animate-pulse" size={40} />
        <div className="space-y-1">
          <h3 className="text-2xl font-extrabold font-sans text-indigo-600 tracking-wide">Mira la Pizarra</h3>
          <p className="text-xs text-slate-500 font-medium font-sans">La pregunta se mostrará de inmediato.</p>
        </div>

        <div className="text-5xl font-black text-slate-800 font-mono py-2">
          {countdownTimer}
        </div>
      </div>
    );
  }

  // 4. STUDENT ACTIVE QUESTION SELECTION CANVAS
  else if (currentStatus === "question" && activeQuestion) {
    const alreadyAnswered = answeredIndex !== null;

    if (alreadyAnswered) {
      gameView = (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 text-center space-y-6 shadow-xl" id="student-option-locked">
          <div className="py-8 space-y-3">
            <div className="w-12 h-12 bg-indigo-50 border border-indigo-150 rounded-full flex items-center justify-center mx-auto text-indigo-600 animate-spin">
              <RefreshCw size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 font-sans">¡Respuesta registrada!</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-sans">
              Elegiste una opción. Espera a que termine el tiempo del reloj para ver los resultados correctos.
            </p>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between text-[11px] text-slate-500 font-bold font-sans">
            <span>PREGUNTA {activeQuestion.currentIndex + 1} DE {activeQuestion.totalQuestions}</span>
            <span className="font-mono text-indigo-600">{activeQuestion.timer} segundos restantes</span>
          </div>
        </div>
      );
    } else {
      gameView = (
        <div className="space-y-4 text-slate-850" id="student-select-panel font-sans">
          
          {/* Dynamic header summary */}
          <div className="flex justify-between items-center bg-white border border-slate-200 p-3 rounded-2xl text-xs text-slate-650 font-bold shadow-sm">
            <div className="flex items-center gap-2">
              <AvatarRenderer id={playerInfo?.avatarId || selectedAvatarId} size={28} className="bg-slate-50 border border-slate-200" />
              <span className="text-slate-800 font-sans">{name} (Puntaje: {playerInfo?.score || 0} pts)</span>
            </div>
            <span className="font-mono font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-150 px-2.5 py-0.5 rounded-full">
              {activeQuestion.timer} seg
            </span>
          </div>

          {/* Small preview text of question in case layout is complex */}
          <div className="bg-white/80 border border-slate-200/80 p-4 rounded-xl text-center shadow-sm">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider font-mono">Pregunta en Curso</p>
            <p className="text-sm font-bold font-sans text-slate-800 italic mt-0.5">{activeQuestion.text}</p>
          </div>

          {/* Answer Button Deck Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="option-buttons-deck">
            {activeQuestion.options.map((option, idx) => {
              let colorProps = "";
              let shape = "";
              if (idx === 0) { colorProps = "bg-rose-500 hover:bg-rose-600 text-white ring-rose-600/20"; shape = "▲"; }
              if (idx === 1) { colorProps = "bg-blue-500 hover:bg-blue-600 text-white ring-blue-600/20"; shape = "◆"; }
              if (idx === 2) { colorProps = "bg-amber-500 hover:bg-amber-600 text-white ring-amber-600/20"; shape = "●"; }
              if (idx === 3) { colorProps = "bg-emerald-500 hover:bg-emerald-600 text-white ring-emerald-600/20"; shape = "■"; }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSubmitAnswer(idx)}
                  className={`py-5 px-4 rounded-2xl flex items-center gap-3 ring-1 shadow-md hover:scale-[1.01] active:transform active:scale-[0.99] transition-all text-left text-white font-sans cursor-pointer ${colorProps}`}
                  id={`student-submit-btn-${idx}`}
                >
                  <span className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center font-bold text-md font-mono shrink-0">
                    {shape}
                  </span>
                  <span className="font-extrabold text-sm leading-snug truncate">{option}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }
  }

  // 5. STUDENT PORTAL REVEAL SCORE FEEDBACK
  else if (currentStatus === "reveal" && questionResult) {
    const { isCorrect, pointsEarned, totalScore, streak, answeredThisQuestion } = questionResult;

    if (!answeredThisQuestion) {
      gameView = (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 text-center space-y-6 text-slate-800 shadow-xl font-sans" id="student-no-answer">
          <AlertCircle className="text-amber-500 mx-auto" size={44} />
          <div className="space-y-1">
            <h3 className="text-xl font-bold font-sans text-amber-500">¡Se acabó el tiempo!</h3>
            <p className="text-xs text-slate-500">No enviaste una respuesta antes de que finalizara el cronómetro.</p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 font-bold block">Tu Puntuación General</span>
            <span className="text-2xl font-black text-slate-700 block">{totalScore} pts</span>
          </div>
        </div>
      );
    } else {
      gameView = (
        <div className={`p-6 sm:p-8 rounded-3xl border text-center space-y-6 shadow-xl transition-all ${
          isCorrect 
            ? "bg-emerald-50 border-emerald-250 text-emerald-800" 
            : "bg-rose-50 border-rose-250 text-rose-800"
        } animate-fade-in`} id="student-reveal-feedback">
          
          <div className="space-y-2">
            {isCorrect ? (
              <>
                <div className="w-14 h-14 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
                  <Check size={28} className="stroke-[3]" />
                </div>
                <h3 className="text-2xl font-extrabold font-sans uppercase break-words">¡Correcto!</h3>
                <p className="text-xl font-black font-mono">+{pointsEarned} Puntos</p>
              </>
            ) : (
              <>
                <div className="w-14 h-14 bg-rose-500 text-white rounded-full flex items-center justify-center mx-auto shadow-md animate-shake">
                  <X size={28} className="stroke-[3]" />
                </div>
                <h3 className="text-2xl font-extrabold font-sans uppercase">¡Incorrecto!</h3>
                <p className="text-xs text-slate-500 font-semibold font-sans">¡Ánimo, puedes remontar en el próximo desafío!</p>
              </>
            )}
          </div>

          {/* Player Streak visual indicator */}
          {isCorrect && streak > 1 && (
            <div className="bg-orange-50 border border-orange-250 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-orange-600 animate-pulse">
              <Zap size={16} className="fill-orange-500 stroke-orange-600" />
              <span>Racha de {streak} correctas consecutivas 🔥</span>
            </div>
          )}

          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-inner">
            <span className="text-[10px] text-slate-400 font-bold block">Tu Puntuación Acumulada</span>
            <span className="text-2xl font-black text-slate-800 font-mono">{totalScore} pts</span>
          </div>

          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-sans font-bold">
            Mira la pizarra del profesor para ver el podio
          </p>
        </div>
      );
    }
  }

  // 6. STUDENT PORTAL INTERMEDIATE BOARD Wait
  else if (currentStatus === "leaderboard") {
    gameView = (
      <div className="bg-white border border-slate-200 rounded-3xl p-6 text-center space-y-6 text-slate-800 shadow-xl" id="student-leaderboard-wait">
        <Trophy className="text-amber-500 mx-auto animate-bounce" size={44} />
        
        <div className="space-y-1">
          <h3 className="text-xl font-extrabold text-slate-900 font-sans">Tabla de Posiciones</h3>
          <p className="text-xs text-slate-400 font-medium font-sans">
            Mira la pantalla del profesor en el aula para ver el ranking oficial.
          </p>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 font-sans">
          <span className="text-[10px] text-slate-400 font-bold block">Tu Puntuación de Juego</span>
          <span className="text-xl font-bold text-indigo-700 font-mono">{playerInfo?.score || 0} pts</span>
        </div>
      </div>
    );
  }

  // 7. STUDENT PORTAL ENDED / VICTORY OVERVIEW
  else if (currentStatus === "ended") {
    gameView = (
      <div className="bg-white border border-slate-200 rounded-3xl p-6 text-center space-y-6 text-slate-800 shadow-xl" id="student-game-over-wait">
        <Award className="text-indigo-600 mx-auto" size={44} />
        
        <div className="space-y-1 font-sans">
          <h3 className="text-2xl font-black text-slate-900 uppercase">¡Actividad Concluida!</h3>
          <p className="text-xs text-slate-500 leading-normal">
            Terminaron todas las preguntas del juego local. Mira el podio del profesor.
          </p>
        </div>

        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Total Obtenido</span>
          <span className="text-3xl font-black font-mono text-indigo-700 block">{playerInfo?.score || 0} pts</span>
          <span className="text-xs text-slate-500 block font-sans font-bold">¡Bien hecho! Gracias por jugar 🌟</span>
        </div>
      </div>
    );
  }

  // Fallback loading state during socket handshakes
  else {
    gameView = (
      <div className="text-center py-20 bg-white border border-slate-100 rounded-3xl shadow-md text-slate-500 text-sm font-sans">
        <RefreshCw className="animate-spin mx-auto text-indigo-600 mb-2" size={24} />
        <span className="font-bold">Sincronizando con el docente...</span>
      </div>
    );
  }

  // Unified persistent frame for connected active student layout
  return (
    <div className="max-w-lg mx-auto space-y-4 font-sans px-4 sm:px-0" id="student-portal-housing">
      {/* Dynamic Network Connectivity Bar */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-between shadow-lg" id="student-hud-header">
        <div className="flex items-center gap-3">
          <div className="relative flex h-3.5 w-3.5 shrink-0">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isConnected ? "bg-emerald-400" : "bg-amber-400"}`}></span>
            <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${isConnected ? "bg-emerald-500" : "bg-amber-500"}`}></span>
          </div>
          <div className="text-left">
            <p className="text-xs font-black tracking-wide text-white leading-tight">
              {isConnected ? "Conectado al Servidor Local" : "Falta Conexión local..."}
            </p>
            <p className="text-[9px] text-slate-400 font-bold uppercase truncate max-w-[130px] sm:max-w-xs">{roomTitle || "Prepmaster Live"}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {joinedPin && (
            <span className="text-[10px] bg-slate-800 border border-slate-750 font-bold px-2 py-0.5 rounded text-indigo-300 font-mono">PIN: {joinedPin}</span>
          )}
          <button
            onClick={handleLeave}
            className="text-[10px] uppercase font-black tracking-wider text-rose-300 hover:text-white bg-rose-950/45 hover:bg-rose-750 py-1.5 px-3 rounded-xl transition-all cursor-pointer border border-rose-900/40"
            id="student-exit-room-trigger"
          >
            Salir
          </button>
        </div>
      </div>

      {gameView}
    </div>
  );
}
