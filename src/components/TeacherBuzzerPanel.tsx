import React from "react";
import { Zap, Lock, RefreshCw, Trophy, Users, ShieldAlert } from "lucide-react";
import { useBuzzer, BuzzerPress } from "../core/BuzzerEngine";

interface TeacherBuzzerPanelProps {
  pin: string;
  gameMode: string;
  onSelectWinner?: (press: BuzzerPress) => void;
  disabledWinners?: string[]; // list of playerIds that already answered and failed in this round
}

export default function TeacherBuzzerPanel({
  pin,
  gameMode,
  onSelectWinner,
  disabledWinners = []
}: TeacherBuzzerPanelProps) {
  const {
    isOpen,
    presses,
    startBuzzer,
    closeBuzzer,
    resetBuzzer
  } = useBuzzer(pin, gameMode);

  const getTeamColor = (teamId: string | null) => {
    if (!teamId) return "bg-slate-700";
    if (teamId === "blue") return "bg-blue-600";
    if (teamId === "red") return "bg-red-600";
    if (teamId === "green") return "bg-emerald-600";
    if (teamId === "yellow") return "bg-amber-500";
    return "bg-indigo-600";
  };

  const getPositionMedal = (position: number) => {
    if (position === 1) return "🥇";
    if (position === 2) return "🥈";
    if (position === 3) return "🥉";
    return `[${position}º]`;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6" id="teacher-buzzer-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl animate-pulse">
            <Zap size={20} className="fill-amber-500/20" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-100 font-sans">
              Control de Buzzer Universal
            </h3>
            <p className="text-xs text-slate-400 font-sans">
              Prepmaster Live v2.6.0 — Respuesta Rápida
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOpen ? (
            <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase font-mono px-2.5 py-1 rounded-lg flex items-center gap-1.5 animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
              Abierto
            </span>
          ) : (
            <span className="bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[10px] font-bold uppercase font-mono px-2.5 py-1 rounded-lg flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400"></span>
              Cerrado
            </span>
          )}
        </div>
      </div>

      {/* Main Buttons */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={startBuzzer}
          disabled={isOpen}
          className={`py-3.5 px-4 rounded-xl font-sans font-black text-xs uppercase flex flex-col items-center justify-center gap-2 transition-all border shadow-sm ${
            isOpen
              ? "bg-slate-800/25 text-slate-600 border-slate-850 cursor-not-allowed"
              : "bg-gradient-to-br from-amber-500 to-orange-500 text-slate-950 border-amber-400 hover:scale-102 hover:shadow-amber-500/10 cursor-pointer"
          }`}
          id="btn-buzzer-start"
        >
          <Zap size={16} />
          <span>Abrir Buzzer</span>
        </button>

        <button
          onClick={closeBuzzer}
          disabled={!isOpen}
          className={`py-3.5 px-4 rounded-xl font-sans font-black text-xs uppercase flex flex-col items-center justify-center gap-2 transition-all border shadow-sm ${
            !isOpen
              ? "bg-slate-800/25 text-slate-600 border-slate-850 cursor-not-allowed"
              : "bg-rose-600 text-white border-rose-500 hover:bg-rose-700 hover:scale-102 cursor-pointer"
          }`}
          id="btn-buzzer-close"
        >
          <Lock size={16} />
          <span>Bloquear</span>
        </button>

        <button
          onClick={resetBuzzer}
          className="py-3.5 px-4 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 text-slate-300 rounded-xl font-sans font-black text-xs uppercase flex flex-col items-center justify-center gap-2 transition-all hover:scale-102 cursor-pointer shadow-sm"
          id="btn-buzzer-reset"
        >
          <RefreshCw size={16} />
          <span>Reiniciar</span>
        </button>
      </div>

      {/* Results / List */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-450 font-mono flex items-center gap-1.5">
          <Users size={12} />
          Cola de Pulsaciones ({presses.length})
        </h4>

        {presses.length === 0 ? (
          <div className="bg-slate-950 border border-slate-850/50 p-6 rounded-2xl text-center space-y-1.5">
            <p className="text-xs text-slate-400 font-sans italic">
              {isOpen ? "¡Esperando pulsaciones en tiempo real!" : "Buzzer inactivo. Ábrelo para que los alumnos participen."}
            </p>
            {isOpen && (
              <p className="text-[9px] text-slate-500 uppercase tracking-widest font-mono animate-pulse">
                Escuchando dispositivos móviles...
              </p>
            )}
          </div>
        ) : (
          <div className="bg-slate-950 border border-slate-850/70 rounded-2xl divide-y divide-slate-850 max-h-[220px] overflow-y-auto custom-scrollbar">
            {presses.map((press) => {
              const isDisabled = disabledWinners.includes(press.playerId);
              return (
                <div
                  key={press.playerId}
                  className={`p-3.5 flex items-center justify-between gap-3 transition-colors ${
                    press.position === 1 ? "bg-amber-500/5" : ""
                  } ${isDisabled ? "opacity-40" : ""}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg font-black select-none">
                      {getPositionMedal(press.position)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-100 truncate">
                        {press.playerName}
                      </p>
                      {press.teamName && (
                        <span
                          className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-full text-white uppercase font-mono tracking-wider ${getTeamColor(
                            press.teamId
                          )} mt-1`}
                        >
                          {press.teamName}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs font-black text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                      +{press.reactionTime.toFixed(3)}s
                    </span>

                    {onSelectWinner && (
                      <button
                        onClick={() => onSelectWinner(press)}
                        disabled={isDisabled}
                        className={`text-[10px] font-black font-sans uppercase px-3 py-1.5 rounded-lg border transition-all ${
                          isDisabled
                            ? "bg-slate-800 border-slate-850 text-slate-500 cursor-not-allowed"
                            : "bg-indigo-600 hover:bg-indigo-700 border-indigo-500 text-white cursor-pointer hover:scale-103"
                        }`}
                      >
                        {isDisabled ? "Falló" : "Habilitar"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
