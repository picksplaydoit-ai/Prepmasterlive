import { useState, useEffect } from "react";
import { 
  Users, AlertCircle, Play, Heart, Award, RefreshCw, Volume2, VolumeX, Flame, Zap, ArrowRight, Home
} from "lucide-react";
import { socket } from "../../lib/socket";
import { Questionnaire, Question, Team, Player } from "../../types";
import { playGameSound, getSoundsEnabled, setSoundsEnabled } from "../../lib/sound";
import TeacherBuzzerPanel from "../../components/TeacherBuzzerPanel";
import { BuzzerPress } from "../../core/BuzzerEngine";

interface MexicanosProps {
  quiz: Questionnaire;
  pin: string;
  players: Player[];
  teams: Team[];
  onBackToMenu: () => void;
}

interface SurveyAnswer {
  text: string;
  points: number;
  revealed: boolean;
}

export default function Mexicanos({ quiz, pin, players, teams, onBackToMenu }: MexicanosProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [surveyAnswers, setSurveyAnswers] = useState<SurveyAnswer[]>([]);
  const [strikes, setStrikes] = useState(0);
  const [teamScores, setTeamScores] = useState<Record<string, number>>({});
  const [activeTeamId, setActiveTeamId] = useState<string>("");
  const [buzzedPlayer, setBuzzedPlayer] = useState<{ name: string; teamName?: string; teamColor?: string; playerId?: string } | null>(null);
  const [disabledWinners, setDisabledWinners] = useState<string[]>([]);
  
  const [soundActive, setSoundActive] = useState(getSoundsEnabled());
  const [animateStrike, setAnimateStrike] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  // Initialize team scores
  useEffect(() => {
    const scores: Record<string, number> = {};
    teams.forEach(t => {
      scores[t.id] = 0;
    });
    setTeamScores(scores);
    if (teams.length > 0) {
      setActiveTeamId(teams[0].id);
    }
    // Play start game sound !
    playGameSound("inicio");
  }, [teams]);

  // Load question and construct survey answers
  useEffect(() => {
    if (currentQuestionIndex >= quiz.questions.length) {
      setGameOver(true);
      playGameSound("ganador");
      return;
    }

    const currentQ = quiz.questions[currentQuestionIndex];
    setStrikes(0);
    setBuzzedPlayer(null);
    setDisabledWinners([]);
    socket.emit("buzzer:reset", { pin });

    // Let's parse custom ChatGPT format if possible or fall back to standard options
    // Format can be text like: "Aflatoxina|40" or just standard choice "CO2"
    let parsed: SurveyAnswer[] = [];
    currentQ.options.forEach((opt, idx) => {
      if (!opt || !opt.trim()) return;
      if (opt.includes("|")) {
        const [text, pts] = opt.split("|");
        parsed.push({
          text: text.trim(),
          points: parseInt(pts, 10) || 10,
          revealed: false
        });
      } else {
        // Fallback points: option 1 has 40, option 2 has 25, option 3 has 15, option 4 has 10
        const pts = [45, 30, 15, 10][idx] || 5;
        parsed.push({
          text: opt.trim(),
          points: pts,
          revealed: false
        });
      }
    });

    // Sort by points descending to mirror standard Family Feud grid
    parsed.sort((a, b) => b.points - a.points);
    setSurveyAnswers(parsed);

    // Broadcast current question text to students
    socket.emit("game:host-message", {
      pin,
      event: "mexicanos:question",
      questionText: currentQ.text,
      answersCount: parsed.length
    });
  }, [currentQuestionIndex, quiz, pin]);

  const handleSelectWinner = (press: BuzzerPress) => {
    const pTeam = teams.find(t => t.id === press.teamId);
    if (press.teamId) {
      setActiveTeamId(press.teamId);
    }
    setBuzzedPlayer({
      name: press.playerName,
      teamName: pTeam?.name || press.teamName || "Sin Equipo",
      teamColor: pTeam?.color || "#64748b",
      playerId: press.playerId
    });
    playGameSound("seleccionar_casilla");
  };

  const handleRevealAnswer = (index: number) => {
    if (surveyAnswers[index].revealed) return;
    
    playGameSound("descubrir_respuesta");
    const updated = [...surveyAnswers];
    updated[index].revealed = true;
    setSurveyAnswers(updated);

    // Sum points to active team score
    if (activeTeamId) {
      setTeamScores(prev => ({
        ...prev,
        [activeTeamId]: prev[activeTeamId] + surveyAnswers[index].points
      }));
    }

    // Check if all answers revealed
    const allRevealed = updated.every(a => a.revealed);
    if (allRevealed) {
      // Small congratulatory sound
      setTimeout(() => {
        playGameSound("aplausos");
      }, 500);
    }
  };

  const handleStrike = () => {
    if (strikes >= 3) return;
    
    playGameSound("error");
    setStrikes(prev => prev + 1);
    setAnimateStrike(true);
    setTimeout(() => {
      setAnimateStrike(false);
    }, 1200);

    // If limits of strikes reached, let's turn over to next team
    if (strikes + 1 >= 3) {
      // Swap team index automatically
      if (teams.length > 1) {
        const currentIdx = teams.findIndex(t => t.id === activeTeamId);
        const nextIdx = (currentIdx + 1) % teams.length;
        setActiveTeamId(teams[nextIdx].id);
      }
    }
  };

  const handleNextQuestion = () => {
    // Clear buzzed state on client side
    socket.emit("game:host-message", {
      pin,
      event: "mexicanos:clear-buzz"
    });
    setCurrentQuestionIndex(prev => prev + 1);
  };

  const handleToggleSound = () => {
    setSoundsEnabled(!soundActive);
    setSoundActive(!soundActive);
  };

  const handleResetBuzzer = () => {
    setBuzzedPlayer(null);
    socket.emit("game:host-message", {
      pin,
      event: "mexicanos:clear-buzz"
    });
  };

  // Find dominating winning team
  const getWinningTeam = () => {
    let winningTeam: Team | null = null;
    let maxScore = -1;
    teams.forEach(t => {
      const score = teamScores[t.id] || 0;
      if (score > maxScore) {
        maxScore = score;
        winningTeam = t;
      }
    });
    return winningTeam;
  };

  if (gameOver) {
    const winner = getWinningTeam();
    return (
      <div className="bg-slate-900 text-white min-h-[500px] border border-slate-800 rounded-3xl p-8 text-center space-y-8 shadow-2xl relative overflow-hidden" id="mexicanos-end-screen">
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500" />
        
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto text-4xl animate-bounce">
            🏆
          </div>
          <h2 className="text-3xl font-black uppercase tracking-wider font-sans text-amber-400">FIN DE LA PARTIDA</h2>
          <p className="text-sm text-slate-400 font-sans">
            Se completaron todos los reactivos de {quiz.title}.
          </p>
        </div>

        {/* Live Podium Standings */}
        <div className="max-w-md mx-auto space-y-3 pt-4">
          <h3 className="text-xs font-black tracking-widest text-slate-450 uppercase font-mono">Tabla de Posiciones</h3>
          <div className="space-y-2">
            {teams.map((t, idx) => {
              const score = teamScores[t.id] || 0;
              const isWinner = winner && winner.id === t.id;
              return (
                <div 
                  key={t.id}
                  className={`flex items-center justify-between p-4 rounded-xl border ${
                    isWinner 
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-100" 
                      : "bg-slate-800/40 border-slate-700/60 text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-md font-black">{idx + 1}°</span>
                    <span className="text-xl" style={{ textShadow: "0 2px 4px rgba(0,0,0,0.3)" }}>{t.icon}</span>
                    <span className="font-bold text-sm tracking-wide">{t.name}</span>
                    {isWinner && <span className="text-[10px] bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full font-black animate-pulse uppercase">Ganador</span>}
                  </div>
                  <span className="font-black text-md font-mono">{score} pts</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-6 max-w-xs mx-auto">
          <button
            onClick={onBackToMenu}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-sans font-black text-sm py-3.5 px-6 rounded-2xl shadow-xl hover:shadow-orange-950/20 active:transform active:scale-[0.98] transition-all cursor-pointer"
          >
            <Home size={18} />
            <span>Volver a Inicio</span>
          </button>
        </div>
      </div>
    );
  }

  const currentQ = quiz.questions[currentQuestionIndex];

  return (
    <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden" id="mexicanos-board-screen">
      
      {/* 3 Strikes Strike overlay animation */}
      {animateStrike && (
        <div className="absolute inset-0 bg-rose-950/90 flex flex-col items-center justify-center z-50 space-y-4 animate-fade-in" id="strike-overlay">
          <div className="text-rose-500 font-extrabold text-[120px] tracking-widest uppercase font-mono animate-scale-up select-none flex gap-6">
            {Array.from({ length: strikes }).map((_, i) => (
              <span key={i} className="animate-bounce">❌</span>
            ))}
          </div>
          <p className="text-white text-md font-black uppercase tracking-wider font-sans">ERROR / RESPUESTA INCORRECTA</p>
        </div>
      )}

      {/* Grid background header and sound toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md">
              🧑‍🎓 100 Estudiantes Dijeron
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Reactivo {currentQuestionIndex + 1} de {quiz.questions.length}
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white font-sans max-w-xl">
            {currentQ.text}
          </h2>
        </div>

        <div className="flex items-center gap-2 self-start">
          <button
            onClick={handleToggleSound}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all cursor-pointer border border-slate-700"
            title={soundActive ? "Silenciar Sonidos" : "Habilitar Sonidos"}
          >
            {soundActive ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          
          <button
            onClick={onBackToMenu}
            className="px-4 py-2 bg-slate-800 hover:bg-rose-950 border border-slate-700 hover:border-rose-800 hover:text-rose-200 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Salir
          </button>
        </div>
      </div>

      {/* Main view layout: Left column options board, Right column score metadata */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Family Feud board column: 5 options max */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-indigo-950/30 border border-indigo-900/60 p-4 rounded-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3" id="feud-survey-grid">
              {surveyAnswers.map((answer, index) => (
                <button
                  key={index}
                  onClick={() => handleRevealAnswer(index)}
                  disabled={answer.revealed}
                  className={`min-h-[70px] relative rounded-xl border flex items-center justify-between px-5 py-3 transition-all cursor-pointer ${
                    answer.revealed
                      ? "bg-slate-800 border-indigo-500 font-semibold"
                      : "bg-slate-900 border-indigo-950/80 hover:bg-indigo-900/40 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {/* Left option number or value index */}
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-[11px] font-bold font-mono text-indigo-400 flex items-center justify-center border border-slate-700">
                      {index + 1}
                    </span>
                    <span className={`text-xs font-sans tracking-wide ${answer.revealed ? "text-white font-extrabold" : "italic text-slate-500 font-medium"}`}>
                      {answer.revealed ? answer.text : "••••••••••••••••"}
                    </span>
                  </div>

                  {/* Right score indicator */}
                  <div className={`px-2.5 py-1 rounded-md text-xs font-mono font-black border ${
                    answer.revealed 
                      ? "bg-indigo-500 text-white border-indigo-400" 
                      : "bg-slate-800 text-slate-500 border-slate-700"
                  }`}>
                    {answer.revealed ? answer.points : "??"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Quick interactive host action triggers */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-800/20 p-4 rounded-xl border border-slate-800">
            <div className="flex gap-2">
              <button
                onClick={handleStrike}
                disabled={strikes >= 3}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-slate-950 font-sans font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <AlertCircle size={15} />
                <span>Registrar Strike (❌)</span>
              </button>

              <button
                onClick={handleResetBuzzer}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 text-slate-300 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm transition-all hover:scale-102"
              >
                Resetear Buzzer
              </button>
            </div>

            <button
              onClick={handleNextQuestion}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-sans font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <span>{currentQuestionIndex + 1 === quiz.questions.length ? "Finalizar" : "Siguiente pregunta"}</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>

        {/* Right Admin controls and teams scores */}
        <div className="lg:col-span-4 space-y-5">
          
          {/* Universal Buzzer Panel */}
          <TeacherBuzzerPanel
            pin={pin}
            gameMode="mexicanos"
            onSelectWinner={handleSelectWinner}
            disabledWinners={disabledWinners}
          />

          {/* Active Buzzer details / current responder */}
          {buzzedPlayer && (
            <div className="bg-gradient-to-br from-indigo-950/40 to-slate-950 border border-indigo-500/30 p-5 rounded-2xl text-center space-y-3 shadow-md animate-fade-in">
              <span className="text-2xl block animate-bounce">🎙️</span>
              <p className="text-[10px] font-mono font-black text-indigo-400 uppercase tracking-wider">Responder actual</p>
              <div>
                <p className="text-md font-black text-white">{buzzedPlayer.name}</p>
                {buzzedPlayer.teamName && (
                  <p className="text-[10px] font-bold px-3 py-0.5 rounded-full inline-block uppercase text-slate-950 mt-1" style={{ backgroundColor: buzzedPlayer.teamColor }}>
                    {buzzedPlayer.teamName}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  if (buzzedPlayer.playerId) {
                    setDisabledWinners(prev => [...prev, buzzedPlayer.playerId!]);
                  }
                  setBuzzedPlayer(null);
                  playGameSound("error");
                }}
                className="w-full text-center text-[10px] bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 font-bold p-2 rounded-lg border border-rose-900/30 cursor-pointer transition-all hover:scale-102"
              >
                No respondió / Falló (Habilitar siguiente)
              </button>
            </div>
          )}

          {/* Current Game Strikes block */}
          <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-2xl text-center space-y-2">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-450 font-mono">Strikes Acumulados</h4>
            <div className="flex items-center justify-center gap-3 text-4xl py-1 select-none">
              <span className={strikes >= 1 ? "text-rose-500 animate-bounce" : "text-slate-800 opacity-20"}>❌</span>
              <span className={strikes >= 2 ? "text-rose-500 animate-bounce" : "text-slate-800 opacity-20"}>❌</span>
              <span className={strikes >= 3 ? "text-rose-500 animate-bounce" : "text-slate-800 opacity-20"}>❌</span>
            </div>
          </div>

          {/* Teams selector & points layout */}
          <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-2xl space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-450 font-mono">Equipos en Competencia</h4>
            <div className="space-y-2">
              {teams.map((t) => {
                const isActive = t.id === activeTeamId;
                const score = teamScores[t.id] || 0;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTeamId(t.id)}
                    className={`w-full text-left p-3 rounded-xl border flex items-center justify-between transition-colors cursor-pointer ${
                      isActive
                        ? "bg-indigo-600/20 border-indigo-500 text-indigo-100 font-extrabold"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800/30"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl" style={{ textShadow: "0 2px 4px rgba(0,0,0,0.3)" }}>{t.icon}</span>
                      <div className="text-left">
                        <p className={`text-xs font-bold leading-none ${isActive ? "text-white" : "text-slate-350"}`}>{t.name}</p>
                        <p className="text-[9.5px] text-slate-500 mt-1 uppercase font-mono">
                          {isActive ? "👉 En Turno" : "En Espera"}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-black text-white">{score}</span>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
