import React, { useState, useEffect } from "react";
import { ArrowLeft, Play, Settings, Shield, Zap, RefreshCw, Layers, Users, BookOpen, Clock } from "lucide-react";
import { Questionnaire } from "../../types";
import { Conecta4Config } from "./conecta4Types";

interface Conecta4SetupProps {
  onBack: () => void;
  onLaunch: (config: Conecta4Config, questionnaireTitle: string, questions: any[]) => void;
}

export default function Conecta4Setup({ onBack, onLaunch }: Conecta4SetupProps) {
  const [quizzes, setQuizzes] = useState<Questionnaire[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  // Settings
  const [gameMode, setGameMode] = useState<"duel" | "teams" | "prof_vs_aula">("teams");
  const [specialPowersEnabled, setSpecialPowersEnabled] = useState<boolean>(true);
  const [timeLimit, setTimeLimit] = useState<number>(20);
  const [roundsCount, setRoundsCount] = useState<number>(3); // best of 3

  useEffect(() => {
    fetch("/api/questionnaires")
      .then((res) => res.json())
      .then((data) => {
        setQuizzes(data || []);
        if (data && data.length > 0) {
          setSelectedQuizId(data[0].id);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading questionnaires:", err);
        setLoading(false);
      });
  }, []);

  const handleLaunch = () => {
    const quiz = quizzes.find((q) => q.id === selectedQuizId);
    if (!quiz) return;

    const config: Conecta4Config = {
      questionnaireId: quiz.id,
      gameMode,
      specialPowersEnabled,
      timeLimit,
      roundsCount
    };

    onLaunch(config, quiz.title, quiz.questions);
  };

  return (
    <div className="bg-slate-950 min-h-screen text-white font-sans flex flex-col justify-between" id="conecta4-setup-view">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-800 rounded-xl transition text-slate-400 hover:text-white"
            id="c4-setup-back-btn"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
              🔵 Conecta 4 Educativo 🔴
            </h1>
            <p className="text-xs text-slate-400">Configuración de la partida académica</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto w-full px-6 py-8 flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Left Side: Game Mode & Rules */}
        <div className="space-y-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
              <Layers size={16} /> Modo de Juego
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {/* Duelo Individual */}
              <button
                onClick={() => setGameMode("duel")}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  gameMode === "duel" 
                    ? "bg-indigo-600/20 border-indigo-500 shadow-lg shadow-indigo-500/5 text-white" 
                    : "bg-slate-900/30 border-slate-800 text-slate-300 hover:border-slate-700"
                }`}
                id="c4-mode-duel-btn"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm">⚔️ Duelo Individual</span>
                  {gameMode === "duel" && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  2 alumnos se enfrentan directamente. Cada uno controla un color de ficha (Azul o Rojo).
                </p>
              </button>

              {/* Equipos */}
              <button
                onClick={() => setGameMode("teams")}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  gameMode === "teams" 
                    ? "bg-indigo-600/20 border-indigo-500 shadow-lg shadow-indigo-500/5 text-white" 
                    : "bg-slate-900/30 border-slate-800 text-slate-300 hover:border-slate-700"
                }`}
                id="c4-mode-teams-btn"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm">👥 Equipos (Azul vs Rojo)</span>
                  {gameMode === "teams" && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Toda la clase se divide en Equipo Azul y Equipo Rojo. El equipo con mayor precisión obtiene el turno para colocar.
                </p>
              </button>

              {/* Profesor vs Aula */}
              <button
                onClick={() => setGameMode("prof_vs_aula")}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  gameMode === "prof_vs_aula" 
                    ? "bg-indigo-600/20 border-indigo-500 shadow-lg shadow-indigo-500/5 text-white" 
                    : "bg-slate-900/30 border-slate-800 text-slate-300 hover:border-slate-700"
                }`}
                id="c4-mode-prof-btn"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm">👨‍🏫 Profesor vs Aula</span>
                  {gameMode === "prof_vs_aula" && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Toda la clase (Aula) une fuerzas contra el docente. Si el aula responde correctamente, ganan el turno; de lo contrario, juega el docente.
                </p>
              </button>
            </div>
          </div>

          {/* Special Powers Toggle */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                <Zap size={16} /> Ayudas Especiales (Poderes)
              </h2>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={specialPowersEnabled}
                  onChange={(e) => setSpecialPowersEnabled(e.target.checked)}
                  className="sr-only peer"
                  id="c4-powers-toggle"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white"></div>
              </label>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Permite a cada bando usar un comodín especial por partida para cambiar la estrategia en el tablero:
            </p>
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800 flex flex-col items-center text-center">
                <Shield size={16} className="text-emerald-500 mb-1" />
                <span className="text-[10px] font-bold">🛡️ Bloqueo</span>
                <span className="text-[8px] text-slate-500">Bloquea columna</span>
              </div>
              <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800 flex flex-col items-center text-center">
                <Zap size={16} className="text-amber-500 mb-1" />
                <span className="text-[10px] font-bold">⚡ Doble Ficha</span>
                <span className="text-[8px] text-slate-500">2 tiros seguidos</span>
              </div>
              <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800 flex flex-col items-center text-center">
                <RefreshCw size={16} className="text-sky-500 mb-1" />
                <span className="text-[10px] font-bold">🔄 Mover</span>
                <span className="text-[8px] text-slate-500">Mueve ficha propia</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Bank Selection & Launcher */}
        <div className="space-y-6">
          {/* Questionnaire Selection */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
              <BookOpen size={16} /> Banco de Preguntas
            </h2>
            {loading ? (
              <div className="h-24 flex items-center justify-center text-xs text-slate-500">
                Cargando bancos de preguntas de SQLite...
              </div>
            ) : quizzes.length === 0 ? (
              <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-2xl text-center">
                <p className="text-xs text-red-400">No se encontraron cuestionarios disponibles en la base de datos.</p>
                <p className="text-[10px] text-slate-500 mt-1">Crea un cuestionario en el panel principal primero.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="text-xs text-slate-400 block font-bold">Seleccionar Cuestionario:</label>
                <select
                  value={selectedQuizId}
                  onChange={(e) => setSelectedQuizId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                  id="c4-quiz-select"
                >
                  {quizzes.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title} ({q.questions ? q.questions.length : 0} reactivos)
                    </option>
                  ))}
                </select>

                {/* Selected quiz details */}
                {(() => {
                  const q = quizzes.find((x) => x.id === selectedQuizId);
                  if (!q) return null;
                  return (
                    <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-850 space-y-1">
                      <p className="text-[11px] text-indigo-300 font-bold">{q.title}</p>
                      <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                        {q.description || "Sin descripción proporcionada."}
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Time & Rounds Config */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
              <Clock size={16} /> Tiempos y Rondas
            </h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-slate-400">Límite por pregunta:</span>
                  <span className="text-indigo-400">{timeLimit} segundos</span>
                </div>
                <input 
                  type="range" 
                  min="10" 
                  max="60" 
                  step="5"
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Number(e.target.value))}
                  className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  id="c4-time-limit-slider"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-slate-400">Puntaje ganador de ronda:</span>
                  <span className="text-indigo-400">Alineación Conecta 4</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-normal">
                  El primer jugador/equipo que conecte cuatro fichas seguidas (horizontal, vertical o diagonal) ganará la ronda.
                </p>
              </div>
            </div>
          </div>

          {/* Play Trigger */}
          <button
            onClick={handleLaunch}
            disabled={!selectedQuizId}
            className={`w-full py-4 text-white font-sans font-black text-sm rounded-2xl shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
              selectedQuizId 
                ? "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/10 active:scale-98" 
                : "bg-slate-800 text-slate-500 cursor-not-allowed"
            }`}
            id="c4-launch-game-btn"
          >
            <Play size={16} fill="white" />
            <span>Crear Sala de Conecta 4</span>
          </button>
        </div>
      </main>

      {/* Footer credits / clean empty container to respect architectural honesty */}
      <footer className="py-4 text-center text-[10px] text-slate-600 font-mono select-none">
        MÓDULO DE ESTRATEGIA ACADÉMICA COOPERATIVA
      </footer>
    </div>
  );
}
