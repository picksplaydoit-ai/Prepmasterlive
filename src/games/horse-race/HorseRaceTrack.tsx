import React from "react";
import { HorseRaceTeam, HorseRacePlayer } from "./horseRaceTypes";
import { motion, AnimatePresence } from "motion/react";
import { Trophy, Shield, Zap } from "lucide-react";

interface HorseRaceTrackProps {
  teams: HorseRaceTeam[];
  players: HorseRacePlayer[];
  gameMode: "team_average" | "first_correct" | "all_vs_all";
  maxDistance: number;
  highlightedIds?: string[]; // IDs that advanced this turn for shake/dust effect
}

export default function HorseRaceTrack({
  teams,
  players,
  gameMode,
  maxDistance,
  highlightedIds = []
}: HorseRaceTrackProps) {
  // If Mode is all_vs_all, we display each player's individual horse. Otherwise, team horses.
  const isIndividual = gameMode === "all_vs_all";

  const lanes = isIndividual
    ? players.map((p) => ({
        id: p.id,
        name: p.name,
        colorClass: "bg-amber-600",
        colorHex: "#d97706",
        icon: "🐎",
        position: p.horsePosition || 0,
        avatarId: p.avatarId,
        shieldActive: p.shieldActive,
        sprintActive: (p.sprintMultiplier || 1) > 1,
      }))
    : teams.map((t) => ({
        id: t.id,
        name: t.name,
        colorClass: t.color,
        colorHex: t.color.includes("blue")
          ? "#2563eb"
          : t.color.includes("red")
          ? "#dc2626"
          : t.color.includes("green")
          ? "#16a34a"
          : t.color.includes("yellow")
          ? "#ca8a04"
          : "#94a3b8",
        icon: t.icon || "🐎",
        position: t.horsePosition,
        avatarId: null,
        shieldActive: t.shieldActive,
        sprintActive: (t.sprintMultiplier || 1) > 1,
      }));

  return (
    <div className="bg-slate-900 border-4 border-slate-750 p-6 rounded-3xl shadow-2xl relative select-none overflow-hidden" id="horse-race-track-board">
      {/* Background stadium details */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 to-slate-900 opacity-60 pointer-events-none"></div>

      <div className="relative flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
        <h4 className="text-white font-black font-sans text-xl uppercase tracking-wider flex items-center gap-2">
          <span>🏁</span> Pista de Carreras de PrepMaster Live
        </h4>
        <div className="text-slate-400 font-mono text-xs font-bold bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
          Distancia de Meta: {maxDistance} casillas
        </div>
      </div>

      <div className="space-y-4 relative z-10">
        {lanes.map((lane, index) => {
          const isWinner = lane.position >= maxDistance;
          const isAdvancing = highlightedIds.includes(lane.id);
          const percentage = Math.min(100, (lane.position / maxDistance) * 100);

          return (
            <div
              key={lane.id}
              className="relative bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 flex flex-col md:flex-row md:items-center gap-4 transition-all duration-300 hover:bg-slate-950/70"
            >
              {/* Lane Info Header */}
              <div className="w-full md:w-44 flex items-center gap-3 shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${lane.colorClass} shadow-md`}>
                  {lane.icon}
                </div>
                <div className="truncate">
                  <p className="text-white font-bold text-sm truncate font-sans">
                    {lane.name}
                  </p>
                  <p className="text-slate-500 font-mono text-[10px] uppercase font-bold">
                    Línea {index + 1} • Casilla {lane.position}
                  </p>
                </div>
                {/* Active power-ups indicators */}
                <div className="flex items-center gap-1 ml-auto">
                  {lane.shieldActive && (
                    <span className="text-blue-400" title="Escudo Activo">
                      <Shield className="w-4 h-4 fill-blue-500/10" />
                    </span>
                  )}
                  {lane.sprintActive && (
                    <span className="text-amber-400 animate-pulse" title="Sprint Activo">
                      <Zap className="w-4 h-4 fill-amber-500/20" />
                    </span>
                  )}
                </div>
              </div>

              {/* Lane Rail Track */}
              <div className="flex-1 bg-slate-800/50 rounded-xl h-10 border border-slate-750 relative overflow-hidden flex items-center">
                {/* Visual checkered pattern lines on track */}
                <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-r from-transparent to-slate-950/40 border-l border-dashed border-slate-700 flex flex-col justify-between opacity-50">
                  <div className="h-2 bg-white"></div>
                  <div className="h-2 bg-slate-900"></div>
                  <div className="h-2 bg-white"></div>
                  <div className="h-2 bg-slate-900"></div>
                </div>

                {/* Progress highlight lane trail */}
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-600/10 to-amber-500/20 transition-all duration-1000 ease-out"
                  style={{ width: `${percentage}%` }}
                ></div>

                {/* Grid slots (every 5 steps) */}
                <div className="absolute inset-0 flex justify-between px-4 pointer-events-none opacity-20">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-full w-px bg-slate-500 border-dashed"></div>
                  ))}
                </div>

                {/* The animated horse entity */}
                <div
                  className="absolute transition-all duration-1000 ease-out flex items-center"
                  style={{
                    left: `calc(${percentage}% - 12px)`,
                    transform: "translateY(-50%)",
                    top: "50%"
                  }}
                >
                  <AnimatePresence>
                    <motion.div
                      animate={
                        isWinner
                          ? {
                              scale: [1, 1.3, 1, 1.3, 1],
                              rotate: [0, 10, -10, 10, 0],
                              transition: { repeat: Infinity, duration: 1.5 }
                            }
                          : isAdvancing
                          ? {
                              x: [0, -15, 10, 0],
                              rotate: [0, -15, 15, 0],
                              scale: [1, 1.25, 1.1, 1],
                              transition: { duration: 0.8 }
                            }
                          : {
                              y: [0, -2, 2, 0],
                              transition: { repeat: Infinity, duration: 1 + Math.random() }
                            }
                      }
                      className="relative z-20 flex flex-col items-center cursor-pointer"
                    >
                      {/* Dust cloud if advancing */}
                      {isAdvancing && (
                        <motion.span
                          initial={{ opacity: 0.8, scale: 0.3, x: -10 }}
                          animate={{ opacity: 0, scale: 1.5, x: -30 }}
                          transition={{ duration: 0.7 }}
                          className="absolute text-slate-400 text-lg left-0 pointer-events-none"
                        >
                          💨
                        </motion.span>
                      )}

                      {/* Horse Icon / Avatar */}
                      <span className="text-3xl select-none filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.6)]">
                        {lane.icon === "🔵" || lane.icon === "🔴" || lane.icon === "🟢" || lane.icon === "🟡" || lane.icon === "🟣" || lane.icon === "🟠" || lane.icon === "🌸" || lane.icon === "🟤"
                          ? "🐎"
                          : lane.icon}
                      </span>

                      {/* Micro label */}
                      <span
                        className={`absolute -top-5 text-[9px] font-black font-sans px-1 rounded shadow-sm whitespace-nowrap text-white ${lane.colorClass}`}
                      >
                        {lane.name.split(" ")[1] || lane.name.substring(0, 5)}
                      </span>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              {/* Finish state badge */}
              <div className="w-16 shrink-0 flex items-center justify-center">
                {isWinner ? (
                  <span className="bg-amber-500 text-slate-950 p-1.5 rounded-lg font-black text-xs font-mono animate-bounce flex items-center gap-1 shadow-md shadow-amber-500/20">
                    <Trophy className="w-3.5 h-3.5 fill-current" /> META
                  </span>
                ) : (
                  <span className="text-slate-600 font-mono text-xs font-bold">
                    {maxDistance - lane.position} rest.
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
