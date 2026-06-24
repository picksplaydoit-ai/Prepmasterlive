import React from "react";
import { Award, Download, RefreshCw, Trophy, Users, Clock, ThumbsUp, Activity } from "lucide-react";
import * as XLSX from "xlsx";

interface PlayerScore {
  name: string;
  teamId: string;
  score: number;
}

interface ConceptLog {
  player: string;
  teamId: string;
  concept: string;
  difficulty: string;
  result: "correcto" | "saltado" | "tiempo";
  points: number;
  timeTaken: number;
}

interface HeadbanzResultsProps {
  bankTitle: string;
  config: any;
  players: any[];
  conceptsLog: ConceptLog[];
  onRestart: () => void;
}

export default function HeadbanzResults({ bankTitle, config, players, conceptsLog, onRestart }: HeadbanzResultsProps) {
  // Sort players by score
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  // Group team scores if teams are active
  const teamScores: Record<string, number> = {};
  if (config.teamsEnabled) {
    players.forEach(p => {
      if (p.teamId) {
        teamScores[p.teamId] = (teamScores[p.teamId] || 0) + p.score;
      }
    });
  }

  // Stats calculation
  const totalCorrect = conceptsLog.filter(c => c.result === "correcto").length;
  const totalSkips = conceptsLog.filter(c => c.result === "saltado").length;
  const totalTimeouts = conceptsLog.filter(c => c.result === "tiempo").length;
  const avgTime = conceptsLog.length > 0
    ? (conceptsLog.reduce((acc, curr) => acc + curr.timeTaken, 0) / conceptsLog.length).toFixed(1)
    : "0";

  const exportToExcel = async () => {
    try {
      // 1. Sheet Resumen: Alumno, Equipo, Puntos
      const resumenData = sortedPlayers.map(p => ({
        "Alumno": p.name,
        "Equipo": p.teamId || "Sin Equipo",
        "Puntos": p.score
      }));

      // 2. Sheet Conceptos: Palabra, Dificultad, Resultado
      const conceptosData = conceptsLog.map(c => ({
        "Palabra / Concepto": c.concept,
        "Dificultad": c.difficulty.toUpperCase(),
        "Resultado": c.result === "correcto" ? "CORRECTO" : c.result === "saltado" ? "SALTADO" : "TIEMPO EXTREMO",
        "Adivinado por": c.player,
        "Equipo": c.teamId || "Sin Equipo",
        "Puntos Otorgados": c.points,
        "Tiempo Empleado (seg)": c.timeTaken
      }));

      const wb = XLSX.utils.book_new();
      
      const wsResumen = XLSX.utils.json_to_sheet(resumenData);
      XLSX.utils.book_append_sheet(wb, wsResumen, "Hoja Resumen");

      const wsConceptos = XLSX.utils.json_to_sheet(conceptosData);
      XLSX.utils.book_append_sheet(wb, wsConceptos, "Hoja Conceptos");

      // Fetch and append universal buzzer statistics
      try {
        const response = await fetch("/api/buzzer/history");
        if (response.ok) {
          const buzzerHistory = await response.json();
          if (Array.isArray(buzzerHistory) && buzzerHistory.length > 0) {
            const buzzerSheetData = buzzerHistory.map((b: any) => ({
              "Alumno": b.playerName,
              "Equipo": b.teamName || "Individual",
              "Juego": b.gameMode || "General",
              "Posición": b.position,
              "Tiempo": b.reactionTime ? `${(b.reactionTime / 1000).toFixed(3)} s` : "N/A",
              "Fecha": b.date || new Date(b.timestamp).toLocaleDateString()
            }));
            const wsBuzzer = XLSX.utils.json_to_sheet(buzzerSheetData);
            XLSX.utils.book_append_sheet(wb, wsBuzzer, "Estadísticas Buzzer");
          }
        }
      } catch (err) {
        console.warn("Could not load buzzer history for Excel report:", err);
      }

      // Generate filename based on bank title
      const safeTitle = bankTitle.toLowerCase().replace(/[^a-z0-9]/g, "_");
      XLSX.writeFile(wb, `reporte_headbanz_${safeTitle}.xlsx`);
    } catch (err) {
      console.error("Error exporting headbanz excel:", err);
      alert("Error al generar el reporte Excel.");
    }
  };

  return (
    <div className="bg-slate-900 min-h-screen text-white p-6 sm:p-8 flex flex-col justify-between" id="headbanz-results-screen">
      <div className="max-w-4xl mx-auto w-full space-y-8 my-auto">
        
        {/* Banner */}
        <div className="text-center space-y-2">
          <span className="bg-pink-500/10 text-pink-300 border border-pink-500/30 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full inline-block">
            🏆 Partida Finalizada
          </span>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight font-sans text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-amber-300">
            RESULTADOS HEADBANZ
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm font-medium">
            Colección: <span className="text-white font-bold">{bankTitle}</span>
          </p>
        </div>

        {/* Stats Bento Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="results-stats-bento">
          <div className="bg-slate-800/60 border border-slate-700/60 p-4 rounded-2xl text-center space-y-1">
            <Trophy className="w-5 h-5 text-amber-400 mx-auto" />
            <p className="text-2xl font-black font-mono text-amber-400">{totalCorrect}</p>
            <p className="text-[10px] font-black uppercase text-slate-400">Aciertos</p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/60 p-4 rounded-2xl text-center space-y-1">
            <Activity className="w-5 h-5 text-pink-400 mx-auto" />
            <p className="text-2xl font-black font-mono text-pink-400">{totalSkips}</p>
            <p className="text-[10px] font-black uppercase text-slate-400">Saltados</p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/60 p-4 rounded-2xl text-center space-y-1">
            <Clock className="w-5 h-5 text-cyan-400 mx-auto" />
            <p className="text-2xl font-black font-mono text-cyan-400">{avgTime}s</p>
            <p className="text-[10px] font-black uppercase text-slate-400">Tiempo Promedio</p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/60 p-4 rounded-2xl text-center space-y-1">
            <Users className="w-5 h-5 text-indigo-400 mx-auto" />
            <p className="text-2xl font-black font-mono text-indigo-400">{players.length}</p>
            <p className="text-[10px] font-black uppercase text-slate-400">Alumnos</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="results-lists-grid">
          {/* Champion / Leaderboard Panel */}
          <div className="bg-slate-800/40 border border-slate-700/50 p-5 rounded-2xl space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
              Ranking de Alumnos
            </h3>

            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
              {sortedPlayers.map((p, idx) => (
                <div
                  key={p.id || idx}
                  className={`flex items-center justify-between p-3 rounded-xl border ${
                    idx === 0
                      ? "bg-amber-500/10 border-amber-500/30"
                      : idx === 1
                      ? "bg-slate-300/10 border-slate-300/20"
                      : "bg-slate-800/25 border-slate-800/40"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black ${
                      idx === 0 ? "bg-amber-500 text-slate-900" : "bg-slate-700 text-slate-300"
                    }`}>
                      {idx + 1}
                    </span>
                    <span className="font-bold text-sm truncate">{p.name}</span>
                    {p.teamId && (
                      <span className="text-[9px] font-mono font-bold bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full border border-slate-600 truncate">
                        {p.teamId}
                      </span>
                    )}
                  </div>
                  <span className="font-black text-sm font-mono text-pink-400">
                    {p.score} pts
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Concepts Log History */}
          <div className="bg-slate-800/40 border border-slate-700/50 p-5 rounded-2xl space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
              Conceptos Jugados ({conceptsLog.length})
            </h3>

            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
              {conceptsLog.length === 0 ? (
                <p className="text-slate-500 text-xs text-center py-8">No se jugaron conceptos.</p>
              ) : (
                [...conceptsLog].reverse().map((c, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 bg-slate-800/25 border border-slate-800/40 rounded-xl"
                  >
                    <div className="space-y-0.5 text-left min-w-0">
                      <p className="font-bold text-slate-200 text-xs truncate">{c.concept}</p>
                      <p className="text-[10px] text-slate-500 font-medium">
                        Por: <span className="text-slate-400 font-bold">{c.player}</span> ({c.difficulty})
                      </p>
                    </div>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0 ${
                      c.result === "correcto"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                    }`}>
                      {c.result}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4" id="results-action-buttons">
          <button
            onClick={exportToExcel}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 px-6 rounded-xl transition shadow-md hover:shadow-lg text-sm"
          >
            <Download className="w-4 h-4" />
            Descargar Reporte Excel
          </button>
          
          <button
            onClick={onRestart}
            className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-black py-3 px-6 rounded-xl border border-slate-700 transition text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Iniciar Nueva Partida
          </button>
        </div>

      </div>
    </div>
  );
}
