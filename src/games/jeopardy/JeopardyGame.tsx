import { useState, useEffect } from "react";
import { 
  Users, Award, Volume2, VolumeX, Grid, CheckCircle2, AlertCircle, Play, Sparkles, ArrowRight, Home
} from "lucide-react";
import { socket } from "../../lib/socket";
import { Questionnaire, Question, Team, Player } from "../../types";
import { playGameSound, getSoundsEnabled, setSoundsEnabled } from "../../lib/sound";

interface JeopardyGameProps {
  quiz: Questionnaire;
  pin: string;
  players: Player[];
  teams: Team[];
  onBackToMenu: () => void;
}

interface JeopardyCell {
  category: string;
  value: number;
  question: Question;
  used: boolean;
  isDailyDouble: boolean;
}

export default function JeopardyGame({ quiz, pin, players, teams, onBackToMenu }: JeopardyGameProps) {
  const [board, setBoard] = useState<Record<string, JeopardyCell[]>>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [teamScores, setTeamScores] = useState<Record<string, number>>({});
  const [activeTeamId, setActiveTeamId] = useState<string>("");
  
  const [selectedCell, setSelectedCell] = useState<{ category: string; index: number; cell: JeopardyCell } | null>(null);
  const [revealMode, setRevealMode] = useState<'value' | 'question' | 'answer' | 'daily_double_intro'>('value');
  const [subtractionEnabled, setSubtractionEnabled] = useState(true);
  const [dailyDoubleEnabled, setDailyDoubleEnabled] = useState(true);
  const [finalJeopardyEnabled, setFinalJeopardyEnabled] = useState(true);
  
  const [soundActive, setSoundActive] = useState(getSoundsEnabled());
  const [showFinalJeopardy, setShowFinalJeopardy] = useState(false);
  const [finalJeopardyWagers, setFinalJeopardyWagers] = useState<Record<string, number>>({});
  const [finalJeopardyAnswerRevealed, setFinalJeopardyAnswerRevealed] = useState(false);
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
    playGameSound("inicio");
  }, [teams]);

  // Construct board grid dynamically from topics or group sequentially
  useEffect(() => {
    // Collect all topics
    let groupMap: Record<string, Question[]> = {};
    quiz.questions.forEach(q => {
      const topic = q.topic?.trim() || "General";
      if (!groupMap[topic]) {
        groupMap[topic] = [];
      }
      groupMap[topic].push(q);
    });

    let catList = Object.keys(groupMap).filter(c => groupMap[c].length > 0);
    
    // If we only have 1 category or none, divide sequentially into topics
    if (catList.length <= 1) {
      groupMap = {
        "Categoría A": [],
        "Categoría B": [],
        "Categoría C": [],
        "Categoría D": []
      };
      catList = Object.keys(groupMap);
      quiz.questions.forEach((q, idx) => {
        const cat = catList[idx % catList.length];
        groupMap[cat].push(q);
      });
    }

    // Limit to max 5 columns to fit on screen beautifully
    const finalCats = catList.slice(0, 5);
    setCategories(finalCats);

    const initialBoard: Record<string, JeopardyCell[]> = {};
    
    // Randomly select one coordinate for Daily Double if enabled
    const randCol = Math.floor(Math.random() * finalCats.length);
    const randRow = Math.floor(Math.random() * 5); // 200, 400, 600, 800, 1000

    finalCats.forEach((cat, colIdx) => {
      const questionsList = groupMap[cat];
      const values = [200, 400, 600, 800, 1000];
      
      initialBoard[cat] = values.map((val, rowIdx) => {
        // Fallback to random question if too few questions in category
        const qIndex = rowIdx % questionsList.length;
        const q = questionsList[qIndex] || quiz.questions[idxFallback(rowIdx, quiz.questions.length)];
        
        return {
          category: cat,
          value: val,
          question: q,
          used: false,
          isDailyDouble: dailyDoubleEnabled && colIdx === randCol && rowIdx === randRow
        };
      });
    });

    setBoard(initialBoard);

    // Notify clients of the Jeopardy start
    socket.emit("game:host-message", {
      pin,
      event: "jeopardy:start",
      categories: finalCats
    });
  }, [quiz, pin, dailyDoubleEnabled]);

  const idxFallback = (idx: number, len: number) => {
    if (len === 0) return 0;
    return idx % len;
  };

  const handleCellClick = (cat: string, index: number, cell: JeopardyCell) => {
    if (cell.used) return;
    playGameSound("seleccionar_casilla");

    setSelectedCell({ category: cat, index, cell });
    
    if (cell.isDailyDouble) {
      setRevealMode('daily_double_intro');
      playGameSound("daily_double");
    } else {
      setRevealMode('question');
    }

    // Broadcast current Jeopardy screen
    socket.emit("game:host-message", {
      pin,
      event: "jeopardy:question-show",
      category: cat,
      value: cell.value,
      questionText: cell.question.text
    });
  };

  const handleDismissDailyDoubleIntro = () => {
    setRevealMode('question');
  };

  const handleRevealAnswer = () => {
    setRevealMode('answer');
    playGameSound("descubrir_respuesta");
  };

  const handleCloseActiveCell = (addPoints: 'add' | 'subtract' | 'none') => {
    if (!selectedCell) return;

    const { category, index, cell } = selectedCell;

    // Apply scores
    if (activeTeamId) {
      if (addPoints === 'add') {
        setTeamScores(prev => ({
          ...prev,
          [activeTeamId]: prev[activeTeamId] + cell.value
        }));
        playGameSound("correcta");
      } else if (addPoints === 'subtract' && subtractionEnabled) {
        setTeamScores(prev => ({
          ...prev,
          [activeTeamId]: prev[activeTeamId] - cell.value
        }));
        playGameSound("incorrecta");
      }
    }

    // Mark cell as used
    const updatedCol = [...board[category]];
    updatedCol[index] = { ...cell, used: true };
    setBoard(prev => ({
      ...prev,
      [category]: updatedCol
    }));

    setSelectedCell(null);
    setRevealMode('value');

    // Notify student clients
    socket.emit("game:host-message", {
      pin,
      event: "jeopardy:cell-cleared",
      category,
      index
    });

    // Automatically check if board is completed -> trigger Final Jeopardy
    let allUsed = true;
    categories.forEach(cat => {
      if (board[cat]?.some(cell => !cell.used)) {
        allUsed = false;
      }
    });

    if (allUsed) {
      if (finalJeopardyEnabled) {
        setShowFinalJeopardy(true);
        playGameSound("final_jeopardy");
      } else {
        setGameOver(true);
      }
    }
  };

  const handleSkipToFinalJeopardy = () => {
    setShowFinalJeopardy(true);
    playGameSound("final_jeopardy");
  };

  const handleTriggerFinalJeopardy = () => {
    setRevealMode('question');
    // Set up default wagers if empty
    const wagers: Record<string, number> = {};
    teams.forEach(t => {
      wagers[t.id] = Math.max(0, Math.min(teamScores[t.id] || 0, 500));
    });
    setFinalJeopardyWagers(wagers);
  };

  const handleToggleSound = () => {
    setSoundsEnabled(!soundActive);
    setSoundActive(!soundActive);
  };

  const handleSaveFinalResults = () => {
    setGameOver(true);
    playGameSound("ganador");
  };

  const getWinner = () => {
    let winningTeam: Team | null = null;
    let maxScore = -99999;
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
    const winner = getWinner();
    return (
      <div className="bg-slate-900 border border-slate-800 text-white min-h-[500px] rounded-3xl p-8 text-center space-y-8 shadow-2xl relative overflow-hidden" id="jeopardy-end-screen">
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-cyan-500 via-indigo-500 to-amber-500" />
        
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-20 h-20 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto text-4xl animate-bounce">
            🧠
          </div>
          <h2 className="text-3xl font-black uppercase tracking-wider font-sans text-indigo-400">BOARD COMPLETED</h2>
          <p className="text-sm text-slate-400 font-sans">
            ¡Felicitaciones! Se completaron los reactivos de {quiz.title} en modo Jeopardy.
          </p>
        </div>

        {/* Podium stand */}
        <div className="max-w-md mx-auto space-y-3 pt-4">
          <h3 className="text-xs font-black tracking-widest text-slate-450 uppercase font-mono">Tabla de Equipos</h3>
          <div className="space-y-2">
            {teams.map((t, idx) => {
              const score = teamScores[t.id] || 0;
              const isWinner = winner && winner.id === t.id;
              return (
                <div 
                  key={t.id}
                  className={`flex items-center justify-between p-4 rounded-xl border ${
                    isWinner 
                      ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-100 animate-pulse" 
                      : "bg-slate-800/40 border-slate-700/60 text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-md font-black">{idx + 1}°</span>
                    <span className="text-xl">{t.icon}</span>
                    <span className="font-bold text-sm tracking-wide">{t.name}</span>
                    {isWinner && <span className="text-[10px] bg-indigo-500 text-white px-2 py-0.5 rounded-full font-black uppercase ml-2">Campeón</span>}
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
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 text-white font-sans font-black text-sm py-4 px-6 rounded-2xl shadow-xl transition-all cursor-pointer"
          >
            <Home size={18} />
            <span>Volver a Inicio</span>
          </button>
        </div>
      </div>
    );
  }

  // Render active Question / Answer overlay inside Jeopardy Cells
  if (selectedCell) {
    const { category, cell } = selectedCell;
    const isDD = cell.isDailyDouble && revealMode === 'daily_double_intro';

    return (
      <div className="bg-slate-900 border border-indigo-950 text-white min-h-[500px] rounded-3xl p-8 flex flex-col justify-between shadow-2xl relative" id="jeopardy-active-cell-view">
        <div className="absolute top-0 inset-x-0 h-1 bg-indigo-500" />
        
        {isDD ? (
          /* Daily Double Intro Mode */
          <div className="flex-1 flex flex-col items-center justify-center space-y-6 text-center py-10 animate-fade-in">
            <span className="text-5xl animate-bounce">🔥</span>
            <h3 className="text-4xl font-extrabold uppercase tracking-widest text-amber-400 font-sans">DAILY DOUBLE!</h3>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed font-sans">
              ¡Celda especial multiplicadora de puntaje! Selecciona el equipo para apostar hasta todo su saldo acumulado.
            </p>
            <button
              onClick={handleDismissDailyDoubleIntro}
              className="px-6 py-3 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-md uppercase tracking-wider hover:bg-amber-600 transition-all cursor-pointer"
            >
              Ver pregunta
            </button>
          </div>
        ) : (
          /* Standard Question / Answer board display */
          <>
            <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
              <div>
                <span className="bg-indigo-600/30 text-indigo-400 text-[10px] font-black tracking-wider uppercase px-2.5 py-0.5 rounded-md mr-2">
                  {category}
                </span>
                <span className="text-amber-400 font-mono font-black text-sm">
                  {cell.value} PTS
                </span>
              </div>

              <span className="text-xs text-slate-500 font-sans italic">
                En Turno: {teams.find(t => t.id === activeTeamId)?.name || "Nadie"}
              </span>
            </div>

            {/* Middle Question core payload */}
            <div className="flex-1 flex flex-col items-center justify-center py-8 text-center max-w-2xl mx-auto space-y-6">
              <p className="text-xl sm:text-2xl font-bold leading-normal font-sans text-slate-100">
                {cell.question.text}
              </p>

              {revealMode === 'answer' && (
                <div className="bg-emerald-900/10 border border-emerald-500/20 p-5 rounded-2xl w-full max-w-md animate-fade-in">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-400 font-mono mb-2">RESPUESTA CORRECTA</h4>
                  <p className="text-lg font-black text-white font-sans">
                    {/* If standard question, correctOption indexes options */}
                    {cell.question.options[cell.question.correctOption] || cell.question.options[0] || "H2O"}
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Actions for points adjustment */}
            <div className="border-t border-slate-800 pt-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex gap-2">
                {revealMode !== 'answer' ? (
                  <button
                    onClick={handleRevealAnswer}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-sans font-black text-xs rounded-xl cursor-pointer"
                  >
                    Revelar solución
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleCloseActiveCell('add')}
                      className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-slate-950 font-sans font-black text-xs rounded-xl cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle2 size={15} />
                      <span>¡Correcto! Acceder Puntos</span>
                    </button>

                    <button
                      onClick={() => handleCloseActiveCell('subtract')}
                      className="px-5 py-3 bg-rose-600 hover:bg-rose-700 text-slate-950 font-sans font-black text-xs rounded-xl cursor-pointer flex items-center gap-1.5"
                    >
                      <AlertCircle size={15} />
                      <span>Incorrecto ({subtractionEnabled ? "Resta" : "No Resta"})</span>
                    </button>
                  </>
                )}
              </div>

              <button
                onClick={() => handleCloseActiveCell('none')}
                className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cerrar sin puntaje
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // Show Final Jeopardy Setup UI
  if (showFinalJeopardy) {
    const finalQ = quiz.questions[0]; // Take first question or generate fallback
    return (
      <div className="bg-slate-900 border border-slate-800 text-white min-h-[500px] rounded-3xl p-8 flex flex-col justify-between shadow-2xl relative" id="final-jeopardy-screen">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 to-rose-600" />
        
        <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
          <span className="bg-amber-500 text-slate-900 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md">
            🔥 FINAL JEOPARDY
          </span>
          <span className="text-xs text-slate-400 font-mono">Apuestas Finales</span>
        </div>

        {revealMode === 'value' ? (
          /* Setup and Wagering phase */
          <div className="flex-1 py-6 space-y-6 max-w-sm mx-auto">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-white">Ingresa la Apuesta de los Equipos</h3>
              <p className="text-[10px] text-slate-500">Cada equipo puede apostar de 0 a su puntaje máximo acumulado.</p>
            </div>

            <div className="space-y-2">
              {teams.map(t => {
                const currentScore = teamScores[t.id] || 0;
                const value = finalJeopardyWagers[t.id] || 0;
                return (
                  <div key={t.id} className="bg-slate-800/40 p-3 rounded-xl border border-slate-700 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-350">{t.icon} {t.name}</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={Math.max(0, currentScore)}
                        value={value}
                        onChange={(e) => setFinalJeopardyWagers({
                          ...finalJeopardyWagers,
                          [t.id]: Math.min(Math.max(0, parseInt(e.target.value, 10) || 0), Math.max(0, currentScore))
                        })}
                        className="bg-slate-950 border border-slate-700 w-24 text-right rounded-lg p-1 text-xs font-mono font-bold text-amber-400"
                      />
                      <span className="text-[10px] text-slate-500">/ {currentScore}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleTriggerFinalJeopardy}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-sans font-black text-sm rounded-xl cursor-pointer"
            >
              Comenzar Final Jeopardy
            </button>
          </div>
        ) : (
          /* Final question projection phase */
          <div className="flex-1 flex flex-col justify-between py-6">
            <div className="max-w-2xl mx-auto text-center space-y-6">
              <p className="text-xl sm:text-2xl font-bold leading-relaxed text-salte-100 font-sans">
                {finalQ?.text || "¿Cuál es el principal gas de efecto invernadero en la corteza terrestre?"}
              </p>

              {finalJeopardyAnswerRevealed && (
                <div className="bg-gradient-to-r from-indigo-950/20 to-slate-900 border border-indigo-500/20 p-5 rounded-2xl w-full max-w-md mx-auto">
                  <h4 className="text-[10.5px] font-black uppercase tracking-widest text-indigo-400 font-mono mb-2">RESPUESTA CORRECTA</h4>
                  <p className="text-lg font-black text-white font-sans">
                    {finalQ?.options[finalQ.correctOption] || "Dióxido de Carbono"}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-4 pt-6 max-w-lg mx-auto">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-450 font-mono text-center">Registrar Acertantes</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {teams.map(t => {
                  const bet = finalJeopardyWagers[t.id] || 0;
                  return (
                    <div key={t.id} className="bg-slate-800 p-2.5 rounded-xl border border-slate-700 flex flex-col items-center justify-between gap-2.5 text-center">
                      <span className="text-xs font-bold leading-none">{t.icon} {t.name}</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setTeamScores(prev => ({ ...prev, [t.id]: prev[t.id] + bet }));
                            setFinalJeopardyWagers({ ...finalJeopardyWagers, [t.id]: 0 }); // reset bet to log done
                          }}
                          disabled={bet === 0}
                          className="px-2 py-1.5 bg-emerald-600/30 text-emerald-300 disabled:opacity-20 text-[10px] font-bold rounded-lg cursor-pointer hover:bg-emerald-600/50"
                        >
                          Acertó
                        </button>
                        <button
                          onClick={() => {
                            setTeamScores(prev => ({ ...prev, [t.id]: prev[t.id] - bet }));
                            setFinalJeopardyWagers({ ...finalJeopardyWagers, [t.id]: 0 });
                          }}
                          disabled={bet === 0}
                          className="px-2 py-1.5 bg-rose-600/30 text-rose-300 disabled:opacity-20 text-[10px] font-bold rounded-lg cursor-pointer hover:bg-rose-600/50"
                        >
                          Falló
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-center gap-3 pt-4 border-t border-slate-800">
                {!finalJeopardyAnswerRevealed && (
                  <button
                    onClick={() => {
                      setFinalJeopardyAnswerRevealed(true);
                      playGameSound("descubrir_respuesta");
                    }}
                    className="px-5 py-2.5 bg-indigo-600 text-white font-black text-xs rounded-xl"
                  >
                    Revelar Respuesta
                  </button>
                )}
                
                <button
                  onClick={handleSaveFinalResults}
                  className="px-5 py-2.5 bg-amber-500 text-slate-950 font-black text-xs rounded-xl"
                >
                  Finalizar Partida
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-950 border border-slate-800 p-6 sm:p-8 rounded-3xl text-white space-y-6 shadow-2xl relative" id="jeopardy-main-screen">
      
      {/* Dynamic top menu header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md">
              🧠 Jeopardy Live Board
            </span>
            <span className="text-xs text-slate-400 font-mono">
              PREPMASTER LIVE v2.0.0
            </span>
          </div>
          <h2 className="text-xl font-black text-white font-sans max-w-sm truncate">
            {quiz.title}
          </h2>
        </div>

        {/* Global Sound Toggles and Settings */}
        <div className="flex flex-wrap items-center gap-2">
          
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 bg-slate-900 border border-slate-800 py-2 px-3 rounded-xl select-none">
            <input
              type="checkbox"
              checked={subtractionEnabled}
              onChange={(e) => setSubtractionEnabled(e.target.checked)}
              className="accent-indigo-500"
            />
            <span>Restar por error</span>
          </label>

          <button
            onClick={handleToggleSound}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl transition-all cursor-pointer"
            title={soundActive ? "Silenciar" : "Sonar"}
          >
            {soundActive ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>

          <button
            onClick={onBackToMenu}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
          >
            Salir al Panel
          </button>
        </div>
      </div>

      {/* Grid columns header board layout */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3" id="jeopardy-grid-stage">
        {categories.map(cat => {
          const cells = board[cat] || [];
          return (
            <div key={cat} className="space-y-3 flex flex-col">
              {/* Category label header */}
              <div className="bg-indigo-950/40 border border-indigo-900/40 p-3 rounded-xl text-center min-h-[50px] flex items-center justify-center">
                <span className="text-[11px] font-black uppercase tracking-wider font-sans text-indigo-400 leading-tight">
                  {cat}
                </span>
              </div>

              {/* Progressive value cells */}
              <div className="space-y-2 flex-grow flex flex-col justify-between">
                {cells.map((cell, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleCellClick(cat, idx, cell)}
                    disabled={cell.used}
                    className={`h-[70px] w-full rounded-xl border flex flex-col items-center justify-center font-mono font-black text-lg transition-all cursor-pointer relative overflow-hidden group ${
                      cell.used
                        ? "bg-slate-900/20 border-slate-900 text-slate-800 line-through opacity-25"
                        : "bg-slate-900 border-indigo-950 text-amber-500 hover:border-indigo-500 hover:bg-indigo-950/20 active:transform active:scale-95 shadow-sm"
                    }`}
                  >
                    {cell.used ? (
                      "✓"
                    ) : (
                      <>
                        <span className="group-hover:scale-105 transition-transform">{cell.value}</span>
                        {cell.isDailyDouble && (
                          <span className="absolute top-1 right-1 text-[8px] bg-amber-500 text-slate-950 font-sans font-black px-1.5 rounded-full uppercase tracking-wider animate-pulse">
                            DD
                          </span>
                        )}
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Live Scores panels & explicit actions */}
      <div className="border-t border-slate-800 pt-5 flex flex-wrap items-center justify-between gap-5">
        
        {/* Teams point display list */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-450 font-mono">Puntajes:</span>
          {teams.map(t => {
            const isActive = t.id === activeTeamId;
            const score = teamScores[t.id] || 0;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTeamId(t.id)}
                className={`flex items-center gap-2 py-2 px-3.5 rounded-xl border transition-colors cursor-pointer ${
                  isActive 
                    ? "bg-indigo-600/30 border-indigo-500 text-indigo-200 font-extrabold" 
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-900/60"
                }`}
              >
                <span className="text-sm">{t.icon}</span>
                <span className="text-xs font-semibold">{t.name}</span>
                <span className="font-mono font-black text-xs ml-1 text-white">{score} pts</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={handleSkipToFinalJeopardy}
          className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 font-sans font-black text-xs rounded-xl cursor-pointer flex items-center gap-1.5 shadow-md hover:scale-101 active:scale-99 transition-all"
        >
          <Sparkles size={14} className="fill-slate-950" />
          <span>Saltar a Final Jeopardy</span>
        </button>
      </div>

    </div>
  );
}
