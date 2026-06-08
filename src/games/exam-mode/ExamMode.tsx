import { useState, useEffect } from "react";
import { 
  Users, Award, ClipboardCheck, ArrowRight, Download, Volume2, VolumeX, BarChart3, HelpCircle, Trophy, RefreshCw, LogOut, Home, Play
} from "lucide-react";
import { socket } from "../../lib/socket";
import { Questionnaire, Question, Player, Team } from "../../types";
import { playGameSound, getSoundsEnabled, setSoundsEnabled } from "../../lib/sound";
import * as XLSX from "xlsx";

interface ExamModeProps {
  quiz: Questionnaire;
  pin: string;
  players: Player[];
  teams: Team[];
  onBackToMenu: () => void;
}

interface StudentExamProgress {
  socketId: string;
  name: string;
  solvedCount: number;
  correctCount: number;
  incorrectCount: number;
  percentage: number;
  completed: boolean;
  timeTakenSeconds: number;
}

export default function ExamMode({ quiz, pin, players, teams, onBackToMenu }: ExamModeProps) {
  // Map of student socket id to their detailed exam progress
  const [examProgress, setExamProgress] = useState<Record<string, StudentExamProgress>>({});
  const [soundActive, setSoundActive] = useState(getSoundsEnabled());
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [examStarted, setExamStarted] = useState(false);
  const [examStatus, setExamStatus] = useState<'lobby' | 'ongoing' | 'completed'>('lobby');

  // Increment timer every second for active exam
  useEffect(() => {
    if (examStatus !== 'ongoing') return;
    const interval = setInterval(() => {
      setTimerElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [examStatus]);

  // Sync initial players list from lobby
  useEffect(() => {
    const progress: Record<string, StudentExamProgress> = {};
    players.forEach(p => {
      progress[p.id] = {
        socketId: p.id,
        name: p.name,
        solvedCount: 0,
        correctCount: 0,
        incorrectCount: 0,
        percentage: 0,
        completed: false,
        timeTakenSeconds: 0
      };
    });
    setExamProgress(progress);
  }, [players]);

  // Listen to live student progress updates or completions via socket.io
  useEffect(() => {
    // Student sent answers updates back to host as part of local asynchrony
    const handleProgressUpdate = (data: { socketId: string; solvedCount: number; correctCount: number; incorrectCount: number; completed: boolean; timeTakenSeconds: number }) => {
      const student = examProgress[data.socketId];
      if (!student) return;

      const totalQs = quiz.questions.length;
      const percentage = totalQs > 0 ? Math.round((data.correctCount / totalQs) * 100) : 0;

      setExamProgress(prev => ({
        ...prev,
        [data.socketId]: {
          ...prev[data.socketId],
          solvedCount: data.solvedCount,
          correctCount: data.correctCount,
          incorrectCount: data.incorrectCount,
          percentage,
          completed: data.completed,
          timeTakenSeconds: data.timeTakenSeconds
        }
      }));

      // Play neat blip sound on completion
      if (data.completed && !student.completed) {
        playGameSound("correcta");
      }
    };

    socket.on("exam:player-progress", handleProgressUpdate);
    return () => {
      socket.off("exam:player-progress", handleProgressUpdate);
    };
  }, [examProgress, quiz]);

  const handleStartExam = () => {
    setExamStatus('ongoing');
    setExamStarted(true);
    playGameSound("inicio");

    // Tell all connected clients to start in exam mode
    socket.emit("game:host-message", {
      pin,
      event: "exam:start",
      totalQuestions: quiz.questions.length,
      questions: quiz.questions
    });
  };

  const handleEndExam = () => {
    setExamStatus('completed');
    playGameSound("finalizacion");

    // Notify clients that answers are closed
    socket.emit("game:host-message", {
      pin,
      event: "exam:ended"
    });
  };

  const handleToggleSound = () => {
    setSoundsEnabled(!soundActive);
    setSoundActive(!soundActive);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const downloadXLSXReport = () => {
    const list = Object.values(examProgress) as StudentExamProgress[];
    
    // Prepare standard grid row schema
    const rows = list.map((student, idx) => ({
      "No.": idx + 1,
      "Nombre de Alumno": student.name,
      "Reactivos Resueltos": student.solvedCount,
      "Aciertos (Correctas)": student.correctCount,
      "Errores (Incorrectas)": student.incorrectCount,
      "Calificación (%)": `${student.percentage}%`,
      "Tiempo de Resolución": `${student.timeTakenSeconds}s`,
      "Estado": student.completed ? "Completado" : "Pendiente"
    }));

    // Generate sheet & workbook
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modo Examen");

    // Trigger local offline download
    const fileName = `Reporte_Examen_PIN_${pin}_${quiz.title.replace(/\s+/g, "_")}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const totalRegistered = Object.keys(examProgress).length;
  const totalCompleted = (Object.values(examProgress) as StudentExamProgress[]).filter(p => p.completed).length;

  if (examStatus === 'lobby') {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl" id="exam-lobby-screen">
        <div className="space-y-1 text-left">
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-150 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full inline-block">
            📝 Modo Examen Lobby
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 font-sans">{quiz.title}</h2>
          <p className="text-xs text-slate-500 font-medium">Asigna resolver de forma asíncrona y descarga reportes detallados en Excel.</p>
        </div>

        {/* Lobby parameters overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          
          <div className="border border-slate-200 bg-slate-50/50 p-5 rounded-2xl space-y-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-450 font-mono">Resumen de Evaluación</h3>
            <ul className="space-y-2 text-xs text-slate-650 font-semibold list-disc list-inside">
              <li>{quiz.questions.length} Reactivos cargados en la base.</li>
              <li>Calificación autoprocesada en tiempo real.</li>
              <li>Sin podio ni ranking de competencia (Reduce ansiedad escolar).</li>
              <li>Tiempo libre por reactivo adaptativo.</li>
            </ul>
          </div>

          <div className="border border-slate-200 bg-slate-50/50 p-5 rounded-2xl flex flex-col justify-between">
            <div className="space-y-1">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-450 font-mono">Alumnos Listos en Lobby</h4>
              <p className="text-3xl font-black text-slate-900 font-mono">{totalRegistered}</p>
            </div>

            <p className="text-[10px] text-slate-400 font-semibold italic mt-2">Diles a tus alumnos que ingresen con el PIN en sus teléfonos.</p>
          </div>

        </div>

        {/* Interactive action toolbar */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-200">
          <button
            onClick={onBackToMenu}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold rounded-xl transition-all cursor-pointer border border-slate-200"
          >
            Volver
          </button>

          <button
            onClick={handleStartExam}
            disabled={totalRegistered === 0}
            className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-40 text-white font-sans font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <Play size={14} className="fill-white" />
            <span>Iniciar Examen</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl" id="exam-ongoing-screen">
      
      {/* Upper core indicators and actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-purple-50 text-purple-700 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-purple-150">
              {examStatus === 'completed' ? "✓ Examen Concluido" : "⚡ Examen Aplicándose"}
            </span>
            <span className="text-xs text-slate-450 font-mono">
              PIN Sala: <strong className="text-indigo-650 font-black">{pin}</strong>
            </span>
          </div>
          <h2 className="text-md sm:text-lg font-black text-slate-900 font-sans truncate max-w-sm">
            {quiz.title} • {formatTimer(timerElapsed)}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          
          <button
            onClick={handleToggleSound}
            className="p-2.5 bg-slate-50 hover:bg-slate-200 border border-slate-200 text-slate-600 rounded-xl cursor-pointer"
            title={soundActive ? "Silenciar" : "Sonar"}
          >
            {soundActive ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>

          {examStatus === 'ongoing' ? (
            <button
              onClick={handleEndExam}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-slate-950 font-sans font-black text-xs rounded-xl cursor-pointer"
            >
              Concluir y Cerrar Examen
            </button>
          ) : (
            <>
              <button
                onClick={downloadXLSXReport}
                className="px-4.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-slate-950 font-sans font-black text-xs rounded-xl cursor-pointer flex items-center gap-1.5"
              >
                <Download size={14} />
                <span>Exportar Reporte Excel</span>
              </button>

              <button
                onClick={onBackToMenu}
                className="px-4.5 py-2 bg-slate-850 hover:bg-slate-900 border border-slate-700 text-white font-sans font-bold text-xs rounded-xl cursor-pointer"
              >
                Volver
              </button>
            </>
          )}

        </div>
      </div>

      {/* Stats bar summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-150 rounded-2xl text-center">
        <div>
          <p className="text-[10px] font-black uppercase text-slate-400 font-mono">Inscritos</p>
          <p className="text-xl font-bold font-mono text-slate-800">{totalRegistered}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase text-slate-400 font-mono">Completados</p>
          <p className="text-xl font-bold font-mono text-emerald-650">{totalCompleted}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase text-slate-400 font-mono">Pendientes</p>
          <p className="text-xl font-bold font-mono text-amber-650">{totalRegistered - totalCompleted}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase text-slate-400 font-mono">Reactivos Examen</p>
          <p className="text-xl font-bold font-mono text-indigo-650">{quiz.questions.length}</p>
        </div>
      </div>

      {/* Classroom Progress Lists details */}
      <div className="space-y-3">
        <h3 className="text-xs font-black tracking-widest text-slate-450 uppercase font-mono text-left">Progreso de Alumnado</h3>
        
        {Object.keys(examProgress).length === 0 ? (
          <div className="border border-dashed border-slate-200 py-12 text-center text-slate-400 text-xs font-semibold rounded-2xl bg-white space-y-1">
            <p>Aún no hay respuestas registradas.</p>
            <p className="opacity-60 text-[10px]">Los alumnos deben responder desde el pad móvil.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3" id="exam-classroom-progress">
            {(Object.values(examProgress) as StudentExamProgress[]).map(p => (
              <div 
                key={p.socketId}
                className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all ${
                  p.completed 
                    ? "bg-emerald-50/50 border-emerald-250 text-emerald-900" 
                    : "bg-white border-slate-200"
                }`}
              >
                <div className="space-y-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-800 leading-none">{p.name}</span>
                    {p.completed && (
                      <span className="bg-emerald-500 text-slate-950 text-[8px] font-black px-2 py-0.5 rounded-full uppercase scale-90">
                        Completado
                      </span>
                    )}
                  </div>
                  <p className="text-[10.5px] text-slate-450 font-bold">
                    Resueltas: {p.solvedCount} de {quiz.questions.length} • Aciertos: <span className="text-emerald-700">{p.correctCount}</span> • Errores: <span className="text-rose-500">{p.incorrectCount}</span>
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-lg font-black font-mono text-slate-800 leading-tight">
                    {p.percentage}%
                  </p>
                  <p className="text-[9px] text-slate-400 tracking-tight leading-none font-mono mt-1">
                    {p.timeTakenSeconds} segundos
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
