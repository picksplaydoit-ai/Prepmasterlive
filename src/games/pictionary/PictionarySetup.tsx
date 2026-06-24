import { useState, useEffect } from "react";
import { Play, Sparkles, Plus, Trash2, ArrowLeft, Users } from "lucide-react";
import { PictionaryWordBank, PictionaryConfig, PictionaryTeam } from "./pictionaryTypes";
import PictionaryWordBankComp from "./PictionaryWordBank";

interface PictionarySetupProps {
  onBack: () => void;
  onLaunchGame: (config: PictionaryConfig, selectedBank: PictionaryWordBank) => void;
}

export default function PictionarySetup({ onBack, onLaunchGame }: PictionarySetupProps) {
  const [banks, setBanks] = useState<PictionaryWordBank[]>([]);
  const [selectedBank, setSelectedBank] = useState<PictionaryWordBank | null>(null);
  const [isManagingBanks, setIsManagingBanks] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Configuration parameter states
  const [totalWordsType, setTotalWordsType] = useState<"5" | "10" | "15" | "20" | "custom">("10");
  const [customWordsCount, setCustomWordsCount] = useState(10);
  
  const [timeLimitType, setTimeLimitType] = useState<"30" | "45" | "60" | "90" | "120" | "custom">("60");
  const [customTimeLimit, setCustomTimeLimit] = useState(60);

  const [teamCount, setTeamCount] = useState(2);
  const [revealHints, setRevealHints] = useState<"none" | "auto" | "manual">("auto");
  const [pointsSystem, setPointsSystem] = useState<"simple" | "difficulty">("simple");

  // Detailed team structures state
  const [teams, setTeams] = useState<PictionaryTeam[]>([]);

  // Presets
  const colors = [
    { name: "Azul", value: "#2563eb" },
    { name: "Rojo", value: "#dc2626" },
    { name: "Verde", value: "#16a34a" },
    { name: "Amarillo", value: "#eab308" },
    { name: "Morado", value: "#8b5cf6" },
    { name: "Naranja", value: "#f97316" },
    { name: "Rosa", value: "#ec4899" },
    { name: "Celeste", value: "#06b6d4" },
  ];

  const emojis = ["🦊", "🐼", "🐯", "🦅", "🦁", "🦉", "🦈", "🦕", "🤖", "🚀", "🍕", "🎮"];

  // Default team roster builder
  const generateDefaultTeams = (count: number) => {
    const list: PictionaryTeam[] = [];
    const teamNames = [
      "Equipo Azul", "Equipo Rojo", "Equipo Verde", "Equipo Amarillo", 
      "Equipo Morado", "Equipo Naranja", "Equipo Rosa", "Equipo Celeste"
    ];
    for (let i = 0; i < count; i++) {
      list.push({
        id: `team_${i + 1}`,
        name: teamNames[i] || `Equipo ${i + 1}`,
        color: colors[i % colors.length].value,
        icon: emojis[i % emojis.length],
        declaredMembers: 3, // default
      });
    }
    return list;
  };

  const fetchBanks = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/pictionary/banks");
      if (res.ok) {
        const data = await res.json();
        setBanks(data);
        if (data.length > 0 && !selectedBank) {
          setSelectedBank(data[0]);
        }
      }
    } catch (e) {
      console.error("Error loading banks in setup", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBanks();
  }, []);

  // Sync teams length with count
  useEffect(() => {
    setTeams(generateDefaultTeams(teamCount));
  }, [teamCount]);

  const handleTeamPropChange = (index: number, field: keyof PictionaryTeam, value: any) => {
    setTeams(prev => prev.map((t, idx) => idx === index ? { ...t, [field]: value } : t));
  };

  const validateAndSubmit = () => {
    if (!selectedBank) {
      alert("Por favor selecciona un banco de palabras de Pictionary para comenzar.");
      return;
    }
    if (selectedBank.words.length === 0) {
      alert("El banco seleccionado no tiene palabras. Añade algunas conceptos primero.");
      return;
    }

    const finalWordsCount = totalWordsType === "custom" ? customWordsCount : parseInt(totalWordsType);
    const finalTimer = timeLimitType === "custom" ? customTimeLimit : parseInt(timeLimitType);

    if (finalWordsCount <= 0) {
      alert("Por favor introduce una cantidad válida para el número de palabras.");
      return;
    }
    if (finalTimer < 10) {
      alert("El tiempo mínimo recomendable por palabra es de 10 segundos.");
      return;
    }

    // Build the configuration package
    const config: PictionaryConfig = {
      bankId: selectedBank.id,
      totalWords: finalWordsCount,
      timeLimit: finalTimer,
      teams,
      revealHints,
      pointsSystem,
    };

    onLaunchGame(config, selectedBank);
  };

  if (isManagingBanks) {
    return (
      <PictionaryWordBankComp
        onBack={() => {
          setIsManagingBanks(false);
          fetchBanks();
        }}
        onSelectBankForGame={(bank) => {
          setSelectedBank(bank);
          setIsManagingBanks(false);
        }}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6 bg-white border border-slate-200 rounded-3xl shadow-sm" id="pictionary-setup-flow">
      {/* Top action row */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 select-none">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-black text-slate-700 hover:text-indigo-600 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl transition-all cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Volver al Catálogo</span>
        </button>

        <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-1.5 font-sans">
          <span>🎨</span> Configurar Pictionary Educativo
        </h2>

        <button
          onClick={() => setIsManagingBanks(true)}
          className="text-xs font-black bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3.5 py-2 rounded-xl cursor-pointer"
        >
          🗂️ Administrar Bancos
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left configurations: bank, words, and timers */}
        <div className="md:col-span-2 space-y-5">
          {/* Card A: Selected Word Bank */}
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-3">
            <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-wider block">UNIDAD DE TRABAJO</span>
            
            {isLoading ? (
              <span className="text-xs text-slate-500 font-mono">Buscando en base de datos...</span>
            ) : banks.length === 0 ? (
              <div className="bg-red-50/50 border border-red-150 p-4 rounded-xl text-center space-y-2">
                <p className="text-xs font-black text-red-600">Por el momento no cuentas con bancos de palabras.</p>
                <button
                  onClick={() => setIsManagingBanks(true)}
                  className="bg-red-600 font-bold hover:bg-red-700 text-white text-[11px] px-3.5 py-1.5 rounded-lg cursor-pointer"
                >
                  Crear un banco de palabras nuevo +
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">Selecciona el banco de palabras:</label>
                <select
                  value={selectedBank?.id || ""}
                  onChange={(e) => {
                    const found = banks.find(b => b.id === e.target.value);
                    if (found) setSelectedBank(found);
                  }}
                  className="w-full p-2.5 bg-white border border-slate-250 rounded-xl text-xs font-bold font-sans cursor-pointer focus:outline-indigo-600"
                >
                  {banks.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.words.length} palabras, Tema: {b.topic || "Sin definir"})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Card B: Game Parameters */}
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-5">
            <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-wider block">MEDIDORES DE PARTIDA</span>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Words Qty */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 block">Total de palabras en la partida:</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {(["5", "10", "15", "20"] as const).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setTotalWordsType(q)}
                      className={`py-2 text-xs font-black rounded-lg cursor-pointer transition-all border ${
                        totalWordsType === q
                          ? "bg-slate-850 border-slate-900 text-white shadow-xs"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setTotalWordsType("custom")}
                    className={`py-2 text-xs font-black rounded-lg cursor-pointer transition-all border ${
                      totalWordsType === "custom"
                        ? "bg-slate-850 border-slate-900 text-white shadow-xs"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    ✏️
                  </button>
                </div>
                {totalWordsType === "custom" && (
                  <input
                    type="number"
                    min={2}
                    max={100}
                    value={customWordsCount}
                    onChange={(e) => setCustomWordsCount(Math.max(2, parseInt(e.target.value) || 2))}
                    className="w-full mt-2 p-2 bg-white border border-slate-250 rounded-lg text-xs font-bold"
                    placeholder="Cantidad personalizada"
                  />
                )}
              </div>

              {/* Timer Qty */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 block">Tiempo por palabra:</label>
                <div className="grid grid-cols-6 gap-1.5">
                  {(["30", "45", "60", "90", "120"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTimeLimitType(t)}
                      className={`py-2 text-xs font-black rounded-lg cursor-pointer transition-all border ${
                        timeLimitType === t
                          ? "bg-slate-850 border-slate-900 text-white shadow-xs"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {t}s
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setTimeLimitType("custom")}
                    className={`py-2 text-xs font-black rounded-lg cursor-pointer transition-all border ${
                      timeLimitType === "custom"
                        ? "bg-slate-850 border-slate-900 text-white shadow-xs"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    ✏️
                  </button>
                </div>
                {timeLimitType === "custom" && (
                  <input
                    type="number"
                    min={10}
                    max={600}
                    value={customTimeLimit}
                    onChange={(e) => setCustomTimeLimit(Math.max(10, parseInt(e.target.value) || 10))}
                    className="w-full mt-2 p-2 bg-white border border-slate-250 rounded-lg text-xs font-bold"
                    placeholder="Segundos (Ej: 150)"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Card C: Game configuration flags */}
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
            <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-wider block">OPCIONES AVANZADAS</span>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Show Hints configuration */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 block">Visualización de pistas opcionales:</label>
                <select
                  value={revealHints}
                  onChange={(e) => setRevealHints(e.target.value as any)}
                  className="w-full p-2 bg-white border border-slate-250 rounded-lg text-xs font-bold cursor-pointer"
                >
                  <option value="none">❌ Sin pistas</option>
                  <option value="auto">⏱️ Mostrar automáticamente tras 30 segundos</option>
                  <option value="manual">🧑‍🏫 Mostrar manualmente por el profesor</option>
                </select>
              </div>

              {/* Points calculation system */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 block">Sistema de puntuaciones:</label>
                <select
                  value={pointsSystem}
                  onChange={(e) => setPointsSystem(e.target.value as any)}
                  className="w-full p-2 bg-white border border-slate-250 rounded-lg text-xs font-bold cursor-pointer"
                >
                  <option value="simple">🌟 Puntuación simple (+1 por acierto)</option>
                  <option value="difficulty">🧠 Puntuación por dificultad (Fácil: +1, Media: +2, Difícil: +3)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right configuration: Teams */}
        <div className="space-y-5 flex flex-col justify-between">
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl flex-1 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-wider">ROLANDO EQUIPOS</span>
              
              <div className="flex items-center gap-1">
                <span className="text-xs font-mono font-bold text-slate-400">N° de equipos:</span>
                <select
                  value={teamCount}
                  onChange={(e) => setTeamCount(parseInt(e.target.value))}
                  className="p-1 px-1.5 bg-white border border-slate-250 rounded-md text-xs font-black cursor-pointer"
                >
                  {[2, 3, 4, 5, 6, 7, 8].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Teams setup list */}
            <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
              {teams.map((team, idx) => (
                <div key={team.id} className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col gap-2 relative">
                  <div className="flex items-center gap-2">
                    {/* Emoji Select spinner */}
                    <select
                      value={team.icon}
                      onChange={(e) => handleTeamPropChange(idx, "icon", e.target.value)}
                      className="text-lg bg-slate-50 border-transparent rounded hover:bg-slate-100 cursor-pointer p-0.5"
                    >
                      {emojis.map(emoji => (
                        <option key={emoji} value={emoji}>{emoji}</option>
                      ))}
                    </select>

                    <input
                      type="text"
                      value={team.name}
                      onChange={(e) => handleTeamPropChange(idx, "name", e.target.value)}
                      className="text-xs font-black border-b border-transparent hover:border-slate-350 focus:border-indigo-600 focus:outline-none flex-1 py-0.5"
                      placeholder="Nombre del equipo"
                    />

                    {/* Color picker */}
                    <div className="relative">
                      <select
                        value={team.color}
                        onChange={(e) => handleTeamPropChange(idx, "color", e.target.value)}
                        className="text-xs border border-slate-200 rounded px-1 text-slate-600 bg-slate-50 font-bold cursor-pointer py-0.5"
                      >
                        {colors.map(col => (
                          <option key={col.value} value={col.value}>{col.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono mt-1 pt-1.5 border-t border-slate-50">
                    <span className="flex items-center gap-1 font-bold">
                      <Users size={11} />
                      Integrantes estimados:
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={team.declaredMembers}
                      onChange={(e) => handleTeamPropChange(idx, "declaredMembers", Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-12 text-right border-b border-transparent hover:border-slate-250 focus:border-indigo-600 font-black text-slate-900"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Launch room button */}
          <button
            onClick={validateAndSubmit}
            className="w-full py-4 text-sm font-black bg-emerald-600 border border-emerald-750 text-white cursor-pointer hover:bg-emerald-700 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 uppercase tracking-wide select-none"
          >
            <Play size={16} fill="currentColor" />
            <span>Iniciar Sala de Pictionary</span>
          </button>
        </div>
      </div>
    </div>
  );
}
