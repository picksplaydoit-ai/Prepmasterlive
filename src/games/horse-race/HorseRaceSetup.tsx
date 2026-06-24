import React, { useState, useEffect } from "react";
import { HorseRaceConfig, HorseRaceTeam } from "./horseRaceTypes";
import { ArrowLeft, Play, Settings, Users, BookOpen, Layers, Zap } from "lucide-react";

interface HorseRaceSetupProps {
  onBack: () => void;
  onLaunchGame: (config: HorseRaceConfig, bankTitle: string, questions: any[]) => void;
}

const DEFAULT_TEAMS_DATA = [
  { id: "team_1", name: "Equipo Azul", color: "bg-blue-600", accentColor: "#2563eb", icon: "🔵" },
  { id: "team_2", name: "Equipo Rojo", color: "bg-red-600", accentColor: "#dc2626", icon: "🔴" },
  { id: "team_3", name: "Equipo Verde", color: "bg-green-600", accentColor: "#16a34a", icon: "🟢" },
  { id: "team_4", name: "Equipo Amarillo", color: "bg-yellow-500", accentColor: "#eab308", icon: "🟡" },
  { id: "team_5", name: "Equipo Morado", color: "bg-purple-600", accentColor: "#9333ea", icon: "🟣" },
  { id: "team_6", name: "Equipo Naranja", color: "bg-orange-500", accentColor: "#f97316", icon: "🟠" },
  { id: "team_7", name: "Equipo Rosa", color: "bg-pink-500", accentColor: "#ec4899", icon: "🌸" },
  { id: "team_8", name: "Equipo Marrón", color: "bg-amber-800", accentColor: "#78350f", icon: "🟤" },
];

export default function HorseRaceSetup({ onBack, onLaunchGame }: HorseRaceSetupProps) {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string>("");
  const [selectedQuiz, setSelectedQuiz] = useState<any | null>(null);

  // Filters for questions inside the quiz
  const [topics, setTopics] = useState<string[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>("Todos");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("Todos");

  // Game Settings
  const [totalQuestions, setTotalQuestions] = useState<number>(10);
  const [customQuestionsCount, setCustomQuestionsCount] = useState<string>("15");
  const [useCustomCount, setUseCustomCount] = useState<boolean>(false);

  const [teamCount, setTeamCount] = useState<number>(4);
  const [distanceType, setDistanceType] = useState<"short" | "medium" | "long">("medium");
  const [advanceMode, setAdvanceMode] = useState<"classic" | "accelerated" | "difficulty">("classic");
  const [powerUpsEnabled, setPowerUpsEnabled] = useState<boolean>(true);
  const [gameMode, setGameMode] = useState<"team_average" | "first_correct" | "all_vs_all">("team_average");

  const [loading, setLoading] = useState<boolean>(true);

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

  useEffect(() => {
    if (!selectedQuizId) {
      setSelectedQuiz(null);
      return;
    }
    const q = quizzes.find((x) => x.id === selectedQuizId);
    if (q) {
      setSelectedQuiz(q);
      // Collect unique topics
      const foundTopics = new Set<string>();
      if (q.questions) {
        q.questions.forEach((question: any) => {
          if (question.topic) foundTopics.add(question.topic);
        });
      }
      setTopics(Array.from(foundTopics));
      setSelectedTopic("Todos");
    }
  }, [selectedQuizId, quizzes]);

  const handleStartGame = () => {
    if (!selectedQuiz) {
      alert("Por favor selecciona un banco de preguntas.");
      return;
    }

    let filteredQuestions = [...(selectedQuiz.questions || [])];

    // Filter by topic
    if (selectedTopic !== "Todos") {
      filteredQuestions = filteredQuestions.filter((q) => q.topic === selectedTopic);
    }

    // Filter by difficulty (facil, medio, dificil)
    if (selectedDifficulty !== "Todos") {
      filteredQuestions = filteredQuestions.filter((q) => {
        const diff = (q.difficulty || q.category || "medio").toLowerCase();
        if (selectedDifficulty === "Fácil") return diff.includes("facil") || diff.includes("easy");
        if (selectedDifficulty === "Media") return diff.includes("medio") || diff.includes("medium");
        if (selectedDifficulty === "Difícil") return diff.includes("dificil") || diff.includes("hard");
        return true;
      });
    }

    if (filteredQuestions.length === 0) {
      alert("No hay preguntas que coincidan con los filtros seleccionados.");
      return;
    }

    // Limit by totalQuestions count
    const countToUse = useCustomCount ? parseInt(customQuestionsCount) || 10 : totalQuestions;
    const finalQuestions = filteredQuestions.slice(0, countToUse);

    // Prepare teams based on selection (or empty if all_vs_all)
    const teams: HorseRaceTeam[] = [];
    if (gameMode !== "all_vs_all") {
      for (let i = 0; i < teamCount; i++) {
        const ref = DEFAULT_TEAMS_DATA[i] || DEFAULT_TEAMS_DATA[0];
        teams.push({
          id: ref.id,
          name: ref.name,
          color: ref.color,
          icon: ref.icon,
          horsePosition: 0,
          membersCount: 0,
          shieldActive: false,
          sprintMultiplier: 1
        });
      }
    }

    const config: HorseRaceConfig = {
      bankId: selectedQuizId,
      totalQuestions: finalQuestions.length,
      teamCount: gameMode === "all_vs_all" ? 0 : teamCount,
      distanceType,
      advanceMode,
      powerUpsEnabled,
      gameMode,
      teams: teams
    };

    onLaunchGame(config, selectedQuiz.title, finalQuestions);
  };

  return (
    <div className="max-w-4xl mx-auto bg-white p-6 md:p-8 rounded-2xl shadow-xl border border-slate-100" id="horse-race-setup-panel">
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium transition"
          id="btn-back"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Regresar</span>
        </button>
        <div className="text-right">
          <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest font-mono">
            Especial de Carreras
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <div className="p-4 bg-amber-500 text-white rounded-2xl shadow-lg">
          <span className="text-4xl">🐎</span>
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight font-sans">
            Configurar Carrera de Caballos
          </h2>
          <p className="text-slate-500 font-sans text-sm mt-0.5">
            Impulsa el aprendizaje y la competencia divertida en tiempo real.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500 font-sans">
          Cargando bancos de preguntas...
        </div>
      ) : (
        <div className="space-y-8 select-none">
          {/* BANCO DE PREGUNTAS */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 font-sans">
              <BookOpen className="w-5 h-5 text-amber-500" />
              1. Seleccionar Banco de Preguntas (Reactivos de Quiz Live)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 font-sans">Banco</label>
                <select
                  value={selectedQuizId}
                  onChange={(e) => setSelectedQuizId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
                  id="select-quiz-bank"
                >
                  {quizzes.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title} ({q.questions?.length || 0} preguntas)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 font-sans">Filtro de Dificultad</label>
                <select
                  value={selectedDifficulty}
                  onChange={(e) => setSelectedDifficulty(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-amber-500 outline-none transition"
                  id="select-difficulty"
                >
                  <option value="Todos">Todas las Dificultades</option>
                  <option value="Fácil">Fácil</option>
                  <option value="Media">Media</option>
                  <option value="Difícil">Difícil</option>
                </select>
              </div>
            </div>

            {topics.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 font-sans">Filtrar por Tema específico</label>
                <select
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-amber-500 outline-none transition"
                  id="select-topic"
                >
                  <option value="Todos">Todos los Temas ({selectedQuiz?.questions?.length || 0} reactivos)</option>
                  {topics.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* PARÁMETROS DE LA CARRERA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CONFIGURACIÓN BÁSICA */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-5">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 font-sans">
                <Settings className="w-5 h-5 text-amber-500" />
                2. Configurar Carrera
              </h3>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-3 font-sans">
                  Número de Preguntas de la carrera
                </label>
                <div className="grid grid-cols-5 gap-2 mb-3">
                  {[10, 20, 30, 40].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => {
                        setTotalQuestions(num);
                        setUseCustomCount(false);
                      }}
                      className={`py-2 rounded-xl text-center font-bold font-mono transition ${
                        totalQuestions === num && !useCustomCount
                          ? "bg-amber-500 text-white shadow-md shadow-amber-200"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setUseCustomCount(true)}
                    className={`py-2 rounded-xl text-center font-bold text-sm transition ${
                      useCustomCount
                        ? "bg-amber-500 text-white shadow-md shadow-amber-200"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Otro
                  </button>
                </div>
                {useCustomCount && (
                  <input
                    type="number"
                    value={customQuestionsCount}
                    onChange={(e) => setCustomQuestionsCount(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 font-mono font-bold focus:ring-2 focus:ring-amber-500 outline-none transition"
                    placeholder="Cantidad de preguntas"
                    id="input-custom-questions-count"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-3 font-sans">
                  Distancia de Pista (Meta)
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { type: "short", label: "Corta", desc: "20 casillas" },
                    { type: "medium", label: "Media", desc: "30 casillas" },
                    { type: "long", label: "Larga", desc: "40 casillas" },
                  ].map((d) => (
                    <button
                      key={d.type}
                      type="button"
                      onClick={() => setDistanceType(d.type as any)}
                      className={`flex flex-col items-center p-3 rounded-xl border transition ${
                        distanceType === d.type
                          ? "bg-amber-50 border-amber-400 text-amber-900 shadow-sm"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <span className="font-bold text-sm font-sans">{d.label}</span>
                      <span className="text-[10px] text-slate-400 font-sans mt-0.5">{d.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 font-sans">
                  Avance por Respuesta Correcta
                </label>
                <select
                  value={advanceMode}
                  onChange={(e) => setAdvanceMode(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-amber-500 outline-none transition"
                  id="select-advance-mode"
                >
                  <option value="classic">Modo Clásico (Acierto = +1 casilla)</option>
                  <option value="accelerated">Modo Acelerado (Acierto = +2 casillas)</option>
                  <option value="difficulty">Modo Dificultad (Fácil = +1, Media = +2, Difícil = +3)</option>
                </select>
              </div>
            </div>

            {/* MODALIDAD Y EQUIPOS */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-5">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 font-sans">
                <Users className="w-5 h-5 text-amber-500" />
                3. Equipos y Modalidad de Juego
              </h3>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-3 font-sans">
                  Modalidad de Carrera
                </label>
                <div className="space-y-3">
                  {[
                    { id: "team_average", label: "Promedio del Equipo (Modo A)", desc: "El avance del caballo se calcula con el rendimiento promedio de los integrantes." },
                    { id: "first_correct", label: "Primer Equipo Correcto (Modo B)", desc: "Avanza el caballo del primer equipo que conteste correctamente la pregunta." },
                    { id: "all_vs_all", label: "Todos contra todos (Modo C)", desc: "Cada alumno tiene su propio caballo en la pista. Competencia individual." },
                  ].map((m) => (
                    <div
                      key={m.id}
                      onClick={() => setGameMode(m.id as any)}
                      className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                        gameMode === m.id
                          ? "bg-amber-5 border-amber-300 shadow-sm"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        checked={gameMode === m.id}
                        onChange={() => {}}
                        className="mt-1 accent-amber-500"
                      />
                      <div>
                        <p className="font-bold text-slate-800 text-sm font-sans">{m.label}</p>
                        <p className="text-xs text-slate-400 font-sans mt-0.5">{m.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {gameMode !== "all_vs_all" && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-3 font-sans flex items-center justify-between">
                    <span>Número de Equipos / Caballos</span>
                    <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-xs">
                      {teamCount} Caballos
                    </span>
                  </label>
                  <input
                    type="range"
                    min="2"
                    max="8"
                    value={teamCount}
                    onChange={(e) => setTeamCount(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <div className="flex justify-between text-slate-400 font-mono text-[10px] mt-1 px-1">
                    <span>2 Equipos</span>
                    <span>5 Equipos</span>
                    <span>8 Equipos</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm font-sans">Power-Ups Activos</h4>
                    <p className="text-xs text-slate-400 font-sans">Turbo, Escudos y Sprints en la carrera</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPowerUpsEnabled(!powerUpsEnabled)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 focus:outline-none ${
                    powerUpsEnabled ? "bg-amber-500 justify-end" : "bg-slate-300 justify-start"
                  }`}
                >
                  <div className="bg-white w-4 h-4 rounded-full shadow-md transform duration-300"></div>
                </button>
              </div>
            </div>
          </div>

          {/* BOTÓN INICIAR */}
          <div className="pt-4">
            <button
              onClick={handleStartGame}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black font-sans text-lg py-4 px-6 rounded-2xl shadow-xl hover:shadow-amber-200 transform active:scale-[0.98] transition flex items-center justify-center gap-3"
              id="btn-launch-horserace"
            >
              <Play className="w-6 h-6 fill-current" />
              <span>INICIAR PISTA Y LOBBY DE CABALLOS</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
