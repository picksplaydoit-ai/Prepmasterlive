import React from "react";
import { Trophy, Home, Download, RotateCcw, ListChecks, HelpCircle, Star, ArrowRight } from "lucide-react";
import { Conecta4SessionState } from "./conecta4Types";
import { exportConecta4ToExcel } from "./conecta4Types";

interface Conecta4ResultsProps {
  session: Conecta4SessionState;
  onRestart: () => void;
  onExit: () => void;
}

export default function Conecta4Results({ session, onRestart, onExit }: Conecta4ResultsProps) {
  const winner = session.gameWinner;
  const isDraw = winner === null;
  const isProfVsAula = session.config.gameMode === "prof_vs_aula";

  // Calculate some fun stats
  const totalMoves = session.history.length;
  const avgPrecisionBlue = session.questionsLog.reduce((acc, q) => acc + q.precisionBlue, 0) / (session.questionsLog.length || 1);
  const avgPrecisionRed = session.questionsLog.reduce((acc, q) => acc + q.precisionRed, 0) / (session.questionsLog.length || 1);

  // Winner string
  const winnerLabel = isDraw 
    ? "¡Empate en el Tablero!" 
    : winner === "blue" 
      ? (isProfVsAula ? "¡El Aula de Alumnos ha Ganado! 🔵" : "¡Equipo Azul ha Ganado! 🔵")
      : (isProfVsAula ? "¡El Profesor ha Ganado! 🔴" : "¡Equipo Rojo ha Ganado! 🔴");

  return (
    <div className="bg-slate-950 min-h-screen text-white font-sans flex flex-col justify-between" id="conecta4-results-view">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-black tracking-tight flex items-center gap-2 select-none">
          🏆 Resultados Conecta 4 Educativo
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportConecta4ToExcel(session)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-600/10 cursor-pointer"
            id="c4-results-export-btn"
          >
            <Download size={14} />
            <span>Descargar Reporte Excel</span>
          </button>
          <button
            onClick={onExit}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            id="c4-results-exit-btn"
          >
            <Home size={14} />
            <span>Salir</span>
          </button>
        </div>
      </header>

      {/* Main Results Container */}
      <main className="max-w-6xl mx-auto w-full px-6 py-8 flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left column: Victory Card & Overall Scores */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 text-center space-y-6 flex flex-col items-center justify-center relative overflow-hidden">
            {/* Background glowing aura */}
            <div className={`absolute -top-16 w-48 h-48 rounded-full filter blur-3xl opacity-20 ${winner === "blue" ? "bg-blue-500" : winner === "red" ? "bg-red-500" : "bg-slate-500"}`} />
            
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${winner === "blue" ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : winner === "red" ? "bg-red-600/20 text-red-400 border border-red-500/30" : "bg-slate-800 text-slate-400"} shadow-xl`}>
              <Trophy size={40} className="animate-bounce" />
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Resultado de la Partida
              </span>
              <h2 className="text-2xl font-black tracking-tight leading-tight px-2">
                {winnerLabel}
              </h2>
            </div>

            {/* Scoreboard */}
            <div className="w-full grid grid-cols-2 gap-4 pt-4 border-t border-slate-800/80">
              <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-2xl text-center">
                <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">
                  {isProfVsAula ? "Aula" : "Equipo Azul"}
                </span>
                <p className="text-4xl font-black text-blue-400 mt-1">{session.scores.blue}</p>
              </div>
              <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-2xl text-center">
                <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">
                  {isProfVsAula ? "Profesor" : "Equipo Rojo"}
                </span>
                <p className="text-4xl font-black text-red-400 mt-1">{session.scores.red}</p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="w-full text-left space-y-2.5 bg-slate-950/30 p-3.5 rounded-2xl border border-slate-850">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Total movimientos:</span>
                <span className="font-bold text-slate-200">{totalMoves} tiros</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Precisión promedio Azul:</span>
                <span className="font-bold text-blue-400">{Math.round(avgPrecisionBlue)}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Precisión promedio Rojo:</span>
                <span className="font-bold text-red-400">{Math.round(avgPrecisionRed)}%</span>
              </div>
            </div>

            {/* Action buttons */}
            <button
              onClick={onRestart}
              className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 active:scale-98 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
              id="c4-results-restart-btn"
            >
              <RotateCcw size={14} />
              <span>Jugar Otra Ronda</span>
            </button>
          </div>
        </div>

        {/* Right column: Move History and Questions log */}
        <div className="lg:col-span-2 space-y-6">
          {/* Questions Log Card */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <ListChecks size={16} className="text-indigo-400" /> Historial de Preguntas Respondidas
            </h3>
            
            {session.questionsLog.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No se registraron preguntas en esta partida.</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {session.questionsLog.map((log, index) => (
                  <div key={index} className="bg-slate-950/40 border border-slate-850 p-3 rounded-2xl space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-bold text-indigo-400 uppercase font-mono">Pregunta {index + 1}</span>
                        <h4 className="text-xs font-bold leading-relaxed">{log.question}</h4>
                      </div>
                      <div className={`shrink-0 px-2.5 py-1 rounded-full text-[9px] font-bold ${
                        log.winner === "Azul" || log.winner === "Aula"
                          ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          : log.winner === "Rojo" || log.winner === "Profesor"
                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                            : "bg-slate-800 text-slate-400"
                      }`}>
                        Ganador: {log.winner}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1.5 border-t border-slate-900">
                      <p>
                        Rpta. Correcta: <span className="text-emerald-400 font-bold">{log.correctOptionText}</span>
                      </p>
                      <div className="flex gap-4">
                        <span>Precisión Azul: <strong className="text-blue-400">{log.precisionBlue}%</strong></span>
                        <span>Precisión Rojo: <strong className="text-red-400">{log.precisionRed}%</strong></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detailed Movements Log Card */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Star size={16} className="text-indigo-400" /> Registro de Movimientos en el Tablero
            </h3>

            {session.history.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No se realizaron movimientos en el tablero.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500">
                      <th className="pb-2 font-black uppercase text-[10px]">Tiro</th>
                      <th className="pb-2 font-black uppercase text-[10px]">Jugador / Bando</th>
                      <th className="pb-2 font-black uppercase text-[10px]">Columna</th>
                      <th className="pb-2 font-black uppercase text-[10px]">Fila</th>
                      <th className="pb-2 font-black uppercase text-[10px]">Hora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900">
                    {session.history.map((move, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/10 transition">
                        <td className="py-2.5 font-bold font-mono text-slate-400">#{move.turn}</td>
                        <td className="py-2.5 font-bold flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${move.player.includes("Azul") || move.player.includes("Aula") ? "bg-blue-500 shadow-sm shadow-blue-500/50" : "bg-red-500 shadow-sm shadow-red-500/50"}`} />
                          <span>{move.player}</span>
                        </td>
                        <td className="py-2.5 text-slate-300">Columna {move.column + 1}</td>
                        <td className="py-2.5 text-slate-300">Fila {6 - move.row}</td>
                        <td className="py-2.5 font-mono text-[10px] text-slate-500">{move.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-[10px] text-slate-600 font-mono select-none">
        CONECTA 4 ACADÉMICO — PREPMASTER LIVE
      </footer>
    </div>
  );
}
