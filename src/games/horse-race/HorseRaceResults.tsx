import React, { useEffect } from "react";
import { HorseRaceConfig, HorseRaceTeam, HorseRacePlayer } from "./horseRaceTypes";
import { Trophy, Download, LogOut, Medal } from "lucide-react";
import * as XLSX from "xlsx";

interface HorseRaceResultsProps {
  config: HorseRaceConfig;
  teams: HorseRaceTeam[];
  players: HorseRacePlayer[];
  playedQuestionsLog: any[]; // questions with correct answer, time and winner
  raceMovementLog: any[]; // logs of horse movements
  onExit: () => void;
}

export default function HorseRaceResults({
  config,
  teams,
  players,
  playedQuestionsLog,
  raceMovementLog,
  onExit
}: HorseRaceResultsProps) {
  const isIndividual = config.gameMode === "all_vs_all";

  // Calculate standings
  const standings = isIndividual
    ? [...players].sort((a, b) => (b.horsePosition || 0) - (a.horsePosition || 0))
    : [...teams].sort((a, b) => b.horsePosition - a.horsePosition);

  // Trigger celebration effects / sounds
  useEffect(() => {
    // Standard celebratory sound if active
    try {
      const audio = new Audio("/assets/sounds/victory.mp3");
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch (e) {}
  }, []);

  const handleExportExcel = async () => {
    try {
      // HOJA 1: RESUMEN
      const sheet1Data = standings.map((item, index) => {
        if (isIndividual) {
          const playerItem = item as HorseRacePlayer;
          const totalAnswers = playedQuestionsLog.length;
          // Calculate correct answers for this player
          const correctCount = raceMovementLog.filter(m => m.entityId === playerItem.id && m.steps > 0).length;
          const errorCount = totalAnswers - correctCount;

          return {
            "Jugador": playerItem.name,
            "Posición Final": index + 1,
            "Casilla Alcanzada": playerItem.horsePosition || 0,
            "Aciertos": correctCount,
            "Errores": Math.max(0, errorCount)
          };
        } else {
          const teamItem = item as HorseRaceTeam;
          const totalAnswers = playedQuestionsLog.length;
          // Calculate correct answers where this team earned steps
          const correctCount = raceMovementLog.filter(m => m.entityId === teamItem.id && m.steps > 0).length;
          const errorCount = totalAnswers - correctCount;

          return {
            "Equipo": teamItem.name,
            "Integrantes": teamItem.membersCount || 0,
            "Posición Final": index + 1,
            "Casilla Alcanzada": teamItem.horsePosition,
            "Aciertos": correctCount,
            "Errores": Math.max(0, errorCount)
          };
        }
      });

      // HOJA 2: PREGUNTAS
      const sheet2Data = playedQuestionsLog.map((q, idx) => {
        return {
          "Número": idx + 1,
          "Pregunta": q.text,
          "Respuesta Correcta": q.correctAnswer,
          "Tiempo de Respuesta (s)": q.timeSpent || 20,
          "Ganador de la Ronda": q.winnerName || "Ninguno (Nadie acertó)"
        };
      });

      // HOJA 3: CARRERA (Movimiento detallado)
      const sheet3Data = raceMovementLog.map((m, idx) => {
        return {
          "Movimiento": idx + 1,
          "Equipo / Jugador": m.name,
          "Casilla Inicial": m.from,
          "Casilla Final": m.to,
          "Pasos Avanzados": m.steps,
          "Hora": m.time || new Date().toLocaleTimeString()
        };
      });

      // Compile Workbook using XLSX
      const wb = XLSX.utils.book_new();
      const wsResumen = XLSX.utils.json_to_sheet(sheet1Data);
      const wsPreguntas = XLSX.utils.json_to_sheet(sheet2Data);
      const wsCarrera = XLSX.utils.json_to_sheet(sheet3Data);

      XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");
      XLSX.utils.book_append_sheet(wb, wsPreguntas, "Preguntas");
      XLSX.utils.book_append_sheet(wb, wsCarrera, "Carrera");

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

      XLSX.writeFile(wb, `Reporte_Carrera_Caballos_${Date.now()}.xlsx`);
    } catch (e) {
      console.error("Error generating Excel report:", e);
      alert("Ocurrió un error al intentar exportar el reporte a Excel.");
    }
  };

  const firstPlace = standings[0];
  const secondPlace = standings[1];
  const thirdPlace = standings[2];

  return (
    <div className="max-w-4xl mx-auto bg-slate-950 text-white p-6 md:p-10 rounded-3xl shadow-2xl border-4 border-amber-500/30 relative select-none overflow-hidden" id="horse-race-results-panel">
      {/* Confetti overlay background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 25 }).map((_, i) => {
          const left = Math.random() * 100;
          const delay = Math.random() * 4;
          const size = Math.random() * 8 + 4;
          const color = ["#eab308", "#3b82f6", "#ef4444", "#10b981", "#ec4899"][Math.floor(Math.random() * 5)];
          return (
            <div
              key={i}
              className="absolute rounded-full animate-bounce"
              style={{
                left: `${left}%`,
                top: `-20px`,
                width: `${size}px`,
                height: `${size}px`,
                backgroundColor: color,
                animationDuration: `${3 + Math.random() * 3}s`,
                animationDelay: `${delay}s`,
                opacity: 0.8
              }}
            ></div>
          );
        })}
      </div>

      <div className="relative z-10 text-center mb-8">
        <Trophy className="w-20 h-20 text-amber-400 mx-auto animate-bounce mb-3 filter drop-shadow-[0_8px_16px_rgba(234,179,8,0.3)]" />
        <h2 className="text-4xl font-black font-sans uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500">
          ¡CARRERA TERMINADA!
        </h2>
        <p className="text-slate-400 text-sm font-sans mt-1">
          Resultados finales del Gran Derbi Educativo v2.4.0
        </p>
      </div>

      {/* PODIUM VISUAL */}
      <div className="grid grid-cols-3 items-end gap-2 md:gap-4 max-w-lg mx-auto mb-10 pt-6">
        {/* 2nd Place */}
        {secondPlace ? (
          <div className="flex flex-col items-center">
            <div className="text-center mb-2">
              <span className="text-3xl">🥈</span>
              <p className="font-extrabold text-sm text-slate-300 truncate w-24 font-sans mt-1">
                {secondPlace.name}
              </p>
            </div>
            <div className="bg-slate-800/80 border border-slate-700 w-full h-24 rounded-t-xl flex flex-col justify-center items-center shadow-lg relative">
              <span className="text-slate-400 font-black text-2xl font-mono">2</span>
              <span className="text-[10px] text-slate-500 font-bold uppercase font-sans">Subcampeón</span>
            </div>
          </div>
        ) : (
          <div className="h-24"></div>
        )}

        {/* 1st Place */}
        {firstPlace ? (
          <div className="flex flex-col items-center">
            <div className="text-center mb-2">
              <span className="text-4xl filter drop-shadow-[0_4px_8px_rgba(234,179,8,0.5)]">👑</span>
              <p className="font-black text-base text-yellow-400 truncate w-28 font-sans mt-1">
                {firstPlace.name}
              </p>
            </div>
            <div className="bg-gradient-to-b from-amber-550 to-amber-600 border-2 border-amber-400 w-full h-36 rounded-t-2xl flex flex-col justify-center items-center shadow-2xl relative shadow-amber-500/10">
              <span className="text-slate-950 font-black text-4xl font-mono">1</span>
              <span className="text-[10px] text-slate-900 font-extrabold uppercase font-sans">Campeón</span>
            </div>
          </div>
        ) : (
          <div className="h-36"></div>
        )}

        {/* 3rd Place */}
        {thirdPlace ? (
          <div className="flex flex-col items-center">
            <div className="text-center mb-2">
              <span className="text-2xl">🥉</span>
              <p className="font-bold text-xs text-amber-700 truncate w-20 font-sans mt-1">
                {thirdPlace.name}
              </p>
            </div>
            <div className="bg-slate-850/80 border border-slate-750 w-full h-20 rounded-t-lg flex flex-col justify-center items-center shadow-md relative">
              <span className="text-amber-800 font-black text-xl font-mono">3</span>
              <span className="text-[10px] text-slate-500 font-bold uppercase font-sans">Tercer lugar</span>
            </div>
          </div>
        ) : (
          <div className="h-20"></div>
        )}
      </div>

      {/* FULL LEADERBOARD TABLE */}
      <div className="bg-slate-900 border border-slate-850 rounded-2xl p-5 mb-8">
        <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5 font-sans">
          <Medal className="w-4 h-4 text-amber-400" /> Clasificación Final Completa
        </h3>
        <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
          {standings.map((item, idx) => {
            const isWinner = idx === 0;
            return (
              <div
                key={item.id}
                className={`flex items-center justify-between p-3 rounded-xl border ${
                  isWinner
                    ? "bg-amber-950/30 border-amber-500/50"
                    : "bg-slate-950/50 border-slate-850"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-slate-500 w-5 text-right">{idx + 1}.</span>
                  <span className="text-lg">
                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "🐎"}
                  </span>
                  <span className={`font-sans font-bold ${isWinner ? "text-amber-300" : "text-slate-200"}`}>
                    {item.name}
                  </span>
                </div>
                <div className="text-right flex items-center gap-2">
                  <span className="text-slate-500 font-mono text-xs">Casilla</span>
                  <span className="font-mono font-black text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    {isIndividual ? (item as HorseRacePlayer).horsePosition : (item as HorseRaceTeam).horsePosition}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ACTIONS BOTTOM BUTTONS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={handleExportExcel}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold font-sans text-sm py-4 px-6 rounded-xl shadow-lg shadow-emerald-900/10 active:scale-[0.98] transition flex items-center justify-center gap-2"
          id="btn-download-horserace-excel"
        >
          <Download className="w-5 h-5" />
          <span>DESCARGAR REPORTE EXCEL (3 HOJAS)</span>
        </button>

        <button
          onClick={onExit}
          className="bg-slate-800 hover:bg-slate-700 text-white font-bold font-sans text-sm py-4 px-6 rounded-xl border border-slate-700 active:scale-[0.98] transition flex items-center justify-center gap-2"
          id="btn-exit-horserace"
        >
          <LogOut className="w-5 h-5 text-slate-400" />
          <span>VOLVER AL PANEL GENERAL</span>
        </button>
      </div>
    </div>
  );
}
