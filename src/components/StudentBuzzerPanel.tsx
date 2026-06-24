import React from "react";
import { Zap, CheckCircle, Lock } from "lucide-react";
import { motion } from "motion/react";

interface StudentBuzzerPanelProps {
  isOpen: boolean;
  buzzed: boolean;
  myPosition: number | null;
  myReactionTime: number | null;
  onPress: () => void;
}

export default function StudentBuzzerPanel({
  isOpen,
  buzzed,
  myPosition,
  myReactionTime,
  onPress
}: StudentBuzzerPanelProps) {
  const handlePress = () => {
    if (buzzed || !isOpen) return;

    // Haptic tactile feedback if available
    if ("vibrate" in navigator) {
      try {
        navigator.vibrate(80);
      } catch (e) {}
    }

    onPress();
  };

  const getPositionSuffix = (pos: number) => {
    if (pos === 1) return "🥇 PRIMER LUGAR";
    if (pos === 2) return "🥈 SEGUNDO LUGAR";
    if (pos === 3) return "🥉 TERCER LUGAR";
    return `[${pos}º en llegar]`;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-6 max-w-sm mx-auto" id="student-buzzer-panel">
      <div className="space-y-1">
        <span className="inline-flex items-center gap-1.5 bg-amber-500 text-slate-950 font-black text-[10px] px-3 py-1 rounded-full uppercase font-mono shadow-sm animate-pulse">
          <Zap size={10} className="fill-slate-950" />
          Buzzer de Respuesta Rápida
        </span>
        <p className="text-[11px] text-slate-400 font-sans">
          {isOpen ? "¡SÉ EL MÁS RÁPIDO DE LA CLASE!" : "ESPERANDO ACTIVACIÓN"}
        </p>
      </div>

      <div className="min-h-[120px] flex flex-col items-center justify-center p-4 bg-slate-950/65 rounded-2xl border border-slate-850">
        {!isOpen && !buzzed ? (
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-300">
              El profesor aún no ha abierto el buzzer
            </p>
            <p className="text-[10px] text-slate-500 font-sans uppercase tracking-widest animate-pulse">
              Mantente atento...
            </p>
          </div>
        ) : buzzed ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="space-y-2.5"
          >
            <div className="inline-flex p-2 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
              <CheckCircle size={28} />
            </div>
            <div>
              <p className="text-md font-extrabold text-white">
                Respuesta registrada
              </p>
              {myReactionTime !== null && (
                <p className="text-xs text-slate-400 font-sans mt-0.5">
                  Tiempo de reacción:{" "}
                  <span className="font-mono text-amber-400 font-black">
                    {myReactionTime.toFixed(3)}s
                  </span>
                </p>
              )}
              {myPosition !== null && (
                <div className="mt-2.5">
                  <span className="inline-block bg-indigo-650/30 text-indigo-300 border border-indigo-500/20 text-[10px] font-black px-3 py-1 rounded-full font-mono uppercase tracking-wider">
                    {getPositionSuffix(myPosition)}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-black text-amber-300 uppercase tracking-wide animate-pulse">
              ⚡ ¡BUZZER ABIERTO! ⚡
            </p>
            <p className="text-[10px] text-slate-400 font-sans">
              Presiona el botón gigante ahora mismo
            </p>
          </div>
        )}
      </div>

      {/* Large Tactical Button */}
      <div className="relative py-4 flex justify-center">
        <motion.button
          whileTap={{ scale: 0.9 }}
          disabled={!isOpen || buzzed}
          onClick={handlePress}
          className={`relative w-48 h-48 rounded-full flex flex-col items-center justify-center select-none shadow-2xl transition-all ${
            !isOpen || buzzed
              ? "bg-slate-800 border-4 border-slate-850 text-slate-500 opacity-40 cursor-not-allowed"
              : "bg-gradient-to-tr from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-400 text-white border-4 border-slate-800 active:shadow-none cursor-pointer scale-102"
          }`}
          style={{ touchAction: "manipulation" }}
          id="btn-student-buzzer-tactile"
        >
          {/* Inner pulse shadow animation */}
          {isOpen && !buzzed && (
            <div className="absolute inset-0 rounded-full bg-red-500/25 animate-ping -z-10" />
          )}

          {!isOpen || buzzed ? (
            <Lock size={36} className="text-slate-500" />
          ) : (
            <Zap size={44} className="fill-amber-400 text-amber-400 animate-bounce" />
          )}

          <span className="text-sm font-sans font-black uppercase mt-2.5 tracking-widest">
            {buzzed ? "Bloqueado" : "PRESIONAR"}
          </span>
        </motion.button>
      </div>
    </div>
  );
}
