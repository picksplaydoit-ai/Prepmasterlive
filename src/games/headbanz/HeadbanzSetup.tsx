import React, { useState, useEffect } from "react";
import { Play, BookOpen, Clock, RefreshCw, Star, HelpCircle, Users, Layers, Award } from "lucide-react";
import { HeadbanzConfig, HeadbanzWord } from "./headbanzTypes";
import HeadbanzWordBank from "./HeadbanzWordBank";

interface HeadbanzSetupProps {
  onBack: () => void;
  onLaunchGame: (config: HeadbanzConfig, bankTitle: string, words: HeadbanzWord[]) => void;
}

export default function HeadbanzSetup({ onBack, onLaunchGame }: HeadbanzSetupProps) {
  const [banks, setBanks] = useState<any[]>([]);
  const [selectedBank, setSelectedBank] = useState<any | null>(null);
  const [showBankManager, setShowBankManager] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Config State
  const [gameMode, setGameMode] = useState<"classic" | "teams" | "duel" | "who_am_i">("classic");
  const [timePerTurn, setTimePerTurn] = useState<number>(60);
  const [roundsCount, setRoundsCount] = useState<number>(3);
  const [pointsPerCorrect, setPointsPerCorrect] = useState<number>(1);
  const [showHints, setShowHints] = useState<boolean>(true);
  const [teamsEnabled, setTeamsEnabled] = useState<boolean>(false);
  const [teamCount, setTeamCount] = useState<number>(2);

  useEffect(() => {
    fetchBanks();
  }, []);

  const fetchBanks = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/headbanz/banks");
      const data = await res.json();
      setBanks(data);
      if (data.length > 0) {
        setSelectedBank(data[0]);
      }
    } catch (err) {
      console.error("Error loading banks in setup:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLaunch = () => {
    if (!selectedBank) {
      alert("Por favor, selecciona un banco de palabras.");
      return;
    }
    if (selectedBank.words.length === 0) {
      alert("El banco seleccionado no tiene conceptos. Agrega algunos antes de jugar.");
      return;
    }

    const config: HeadbanzConfig = {
      bankId: selectedBank.id,
      teamsEnabled: teamsEnabled || gameMode === "teams" || gameMode === "duel",
      teamCount: gameMode === "duel" ? 2 : teamCount,
      timePerTurn,
      roundsCount,
      pointsPerCorrect,
      showHints,
      gameMode
    };

    onLaunchGame(config, selectedBank.name, selectedBank.words);
  };

  if (showBankManager) {
    return (
      <HeadbanzWordBank
        onBack={() => {
          setShowBankManager(false);
          fetchBanks();
        }}
      />
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen p-6 sm:p-8" id="headbanz-setup-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-slate-900 font-sans tracking-tight flex items-center gap-2">
              👑 Headbanz Educativo
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm font-medium">
              Configura e inicia la dinámica colaborativa presencial utilizando celulares y proyector.
            </p>
          </div>
          <button
            onClick={onBack}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition shadow-xs self-start sm:self-auto"
            id="setup-back-btn"
          >
            Volver al Panel
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="setup-body-grid">
          
          {/* Left panel: Bank selection */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-pink-600" />
                  Banco de Palabras
                </h2>
                <button
                  onClick={() => setShowBankManager(true)}
                  className="text-xs font-black text-pink-600 hover:text-pink-700 bg-pink-50 hover:bg-pink-100 px-3 py-1.5 rounded-lg border border-pink-100 transition"
                  id="manage-banks-shortcut"
                >
                  Administrar Bancos
                </button>
              </div>

              {loading ? (
                <div className="py-8 text-center text-slate-400 font-medium text-xs">
                  Cargando colecciones académicas...
                </div>
              ) : banks.length === 0 ? (
                <div className="py-8 text-center text-slate-500 font-medium text-xs border border-dashed border-slate-200 rounded-xl bg-slate-50">
                  No hay bancos disponibles. Haz clic en "Administrar Bancos" para sembrar o crear colecciones.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="banks-selector-list">
                  {banks.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBank(b)}
                      className={`p-4 rounded-xl border cursor-pointer transition text-left space-y-1.5 relative flex flex-col justify-between ${
                        selectedBank?.id === b.id
                          ? "border-pink-500 bg-pink-50/40 ring-1 ring-pink-500"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm truncate leading-tight">
                          {b.name}
                        </h3>
                        <p className="text-[10px] text-slate-500 line-clamp-2 mt-1">
                          {b.description || "Sin descripción adicional."}
                        </p>
                      </div>
                      <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border self-start mt-2 ${
                        selectedBank?.id === b.id ? "bg-pink-100 text-pink-700 border-pink-200" : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}>
                        {b.words?.length || 0} palabras
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Config Mode Selection */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Users className="w-4 h-4 text-pink-600" />
                Modo de Juego
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="modes-grid">
                <div
                  onClick={() => {
                    setGameMode("classic");
                    setTeamsEnabled(false);
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition text-left space-y-1.5 ${
                    gameMode === "classic" ? "border-pink-500 bg-pink-50/40" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <h4 className="font-bold text-slate-900 text-sm">Modo Clásico</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Uno por uno. El alumno activo adivina mientras todo el grupo responde "Sí", "No" o "A veces".
                  </p>
                </div>

                <div
                  onClick={() => {
                    setGameMode("teams");
                    setTeamsEnabled(true);
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition text-left space-y-1.5 ${
                    gameMode === "teams" ? "border-pink-500 bg-pink-50/40" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <h4 className="font-bold text-slate-900 text-sm">Modo Equipos</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Los alumnos se integran en escuadras. Los integrantes cooperan para guiar a su jugador activo.
                  </p>
                </div>

                <div
                  onClick={() => {
                    setGameMode("duel");
                    setTeamsEnabled(true);
                    setTeamCount(2);
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition text-left space-y-1.5 ${
                    gameMode === "duel" ? "border-pink-500 bg-pink-50/40" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <h4 className="font-bold text-slate-900 text-sm">Modo Duelo</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Equipo contra equipo en un enfrentamiento dinámico directo por turnos alternados.
                  </p>
                </div>

                <div
                  onClick={() => {
                    setGameMode("who_am_i");
                    setTeamsEnabled(false);
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition text-left space-y-1.5 ${
                    gameMode === "who_am_i" ? "border-pink-500 bg-pink-50/40" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    🎯 "¿Quién Soy?"
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Especial interdisciplinario: Científicos, personajes históricos y conceptos para vinculaciones transversales de asignaturas.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel: Game options & Launch button */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-5">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-pink-600" />
                Ajustes de Turno y Rondas
              </h2>

              <div className="space-y-4">
                {/* Tiempo por Turno */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Tiempo por Turno
                    </span>
                    <span className="text-xs font-black text-pink-600 bg-pink-50 px-2 py-0.5 rounded-md border border-pink-100 font-mono">
                      {timePerTurn} Segundos
                    </span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={120}
                    step={10}
                    value={timePerTurn}
                    onChange={(e) => setTimePerTurn(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-pink-600"
                  />
                </div>

                {/* Número de Rondas */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                      <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                      Rondas Totales
                    </span>
                    <span className="text-xs font-black text-pink-600 bg-pink-50 px-2 py-0.5 rounded-md border border-pink-100 font-mono">
                      {roundsCount} Rondas
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={roundsCount}
                    onChange={(e) => setRoundsCount(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-pink-600"
                  />
                </div>

                {/* Mostrar Pistas */}
                <div className="flex items-center justify-between py-2 border-t border-b border-slate-100">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                      Pistas de Concepto
                    </span>
                    <p className="text-[10px] text-slate-400">Mostrar automáticamente a mitad de tiempo</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showHints}
                      onChange={(e) => setShowHints(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-pink-600"></div>
                  </label>
                </div>

                {/* Equipos config if enabled */}
                {teamsEnabled && gameMode !== "duel" && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-600">Número de Equipos</span>
                      <span className="text-xs font-black text-pink-600 font-mono">{teamCount} Equipos</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[2, 3, 4, 5].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setTeamCount(num)}
                          className={`py-1 rounded-lg text-xs font-bold border transition ${
                            teamCount === num
                              ? "bg-pink-50 border-pink-500 text-pink-700"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Launch Button */}
            <button
              onClick={handleLaunch}
              className="w-full bg-pink-600 hover:bg-pink-700 text-white font-black py-4 px-6 rounded-2xl transition shadow-lg hover:shadow-xl flex items-center justify-center gap-2 text-base"
              id="launch-headbanz-game"
            >
              <Play className="w-5 h-5 fill-current" />
              Lanzar Sala de Espera
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
