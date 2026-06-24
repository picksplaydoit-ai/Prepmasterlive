import { useState, useEffect } from "react";
import { 
  Users, Award, ClipboardCheck, ArrowRight, Download, Volume2, VolumeX, BarChart3, HelpCircle, Trophy, RefreshCw, LogOut, Home, Play, Copy, Laptop
} from "lucide-react";
import { socket } from "../../lib/socket";
import { Questionnaire, Question, Player, Team } from "../../types";
import { playGameSound, getSoundsEnabled, setSoundsEnabled } from "../../lib/sound";
import * as XLSX from "xlsx";
import QRCode from "qrcode";

interface ConnectionInfo {
  ips: string[];
  preferredIP: string;
  localUrl: string;
  appUrl: string;
  qrLocal: string;
  qrApp: string;
}

interface ExamModeProps {
  quiz: Questionnaire;
  pin: string;
  players: Player[];
  teams: Team[];
  onBackToMenu: () => void;
  connInfo?: ConnectionInfo | null;
}

interface StudentExamProgress {
  playerId?: string;
  socketId: string;
  name: string;
  solvedCount: number;
  correctCount: number;
  incorrectCount: number;
  percentage: number;
  completed: boolean;
  timeTakenSeconds: number;
  answers?: Record<number, number>;
  status?: string;
  autoSubmitted?: boolean;
  tabChangeCount?: number;
  disconnectCount?: number;
  reconnectCount?: number;
  lastEventName?: string;
  lastEventTime?: string;
}

export default function ExamMode({ quiz, pin, players, teams, onBackToMenu, connInfo }: ExamModeProps) {
  // Map of student socket id to their detailed exam progress
  const [examProgress, setExamProgress] = useState<Record<string, StudentExamProgress>>({});
  const [examEventsList, setExamEventsList] = useState<any[]>([]);
  const [soundActive, setSoundActive] = useState(getSoundsEnabled());
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [examDurationLimit, setExamDurationLimit] = useState<number | null>(null);
  const [isCustomTimeLimit, setIsCustomTimeLimit] = useState<boolean>(false);
  const [customMinutes, setCustomMinutes] = useState<string>("");
  
  // Direct Join states (2.1.2)
  const [networkInfo, setNetworkInfo] = useState<{ localIp: string; port: number; localUrl: string } | null>(null);
  const [joinUrlUsed, setJoinUrlUsed] = useState<string>("");
  const [isIpDetected, setIsIpDetected] = useState<boolean>(true);
  const [sessionQrUrl, setSessionQrUrl] = useState<string>("");
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    fetch("/api/network-info")
      .then(res => {
        if (res.ok) return res.json();
        throw new Error("Network API failed");
      })
      .then(data => {
        setNetworkInfo(data);
      })
      .catch(err => {
        console.error("Error fetching network-info in exam mode:", err);
      });
  }, []);

  useEffect(() => {
    const host = window.location.hostname;
    const isPrivateIp = host.startsWith("192.168.") || host.startsWith("10.") || host.startsWith("172.") || host.startsWith("169.254.");
    const isLocalhost = host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");
    const isCloudEnv = !isLocalhost && !isPrivateIp;

    let url = "";
    if (isCloudEnv) {
      url = `${window.location.origin}/join?pin=${pin}&game=exam_mode`;
      setIsIpDetected(true);
    } else if (networkInfo && networkInfo.localIp) {
      url = `http://${networkInfo.localIp}:${networkInfo.port}/join?pin=${pin}&game=exam_mode`;
      setIsIpDetected(true);
    } else {
      if (host && host !== "localhost" && host !== "127.0.0.1") {
        url = `${window.location.origin}/join?pin=${pin}&game=exam_mode`;
        setIsIpDetected(true);
      } else {
        setIsIpDetected(false);
        url = `http://[REVISA_CONEXION_WIFI]:3000/join?pin=${pin}&game=exam_mode`;
      }
    }
    setJoinUrlUsed(url);

    QRCode.toDataURL(url, { width: 405, margin: 1 }, (err, qrUrl) => {
      if (!err) {
        setSessionQrUrl(qrUrl);
      }
    });
  }, [pin, networkInfo]);

  const [examStarted, setExamStarted] = useState(false);
  const [examStatus, setExamStatus] = useState<'lobby' | 'ongoing' | 'completed'>('lobby');

  // Increment timer every second for active exam
  useEffect(() => {
    if (examStatus !== 'ongoing') return;
    const interval = setInterval(() => {
      setTimerElapsed(prev => {
        const nextVal = prev + 1;
        if (examDurationLimit && nextVal >= examDurationLimit * 60) {
          clearInterval(interval);
          handleEndExam();
          return examDurationLimit * 60;
        }
        return nextVal;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [examStatus, examDurationLimit]);

  // Rehydrate exist progress on mount
  useEffect(() => {
    fetch(`/api/session-results/${pin}`)
      .then(res => {
        if (res.ok) return res.json();
        throw new Error("Failed to fetch session progress");
      })
      .then(data => {
        if (data) {
          if (data.timeLimitMinutes) {
            setExamDurationLimit(data.timeLimitMinutes);
          }
          if (data.examEvents) {
            setExamEventsList(data.examEvents);
          }
          if (data.examProgress) {
            setExamProgress(prev => {
              const nextProgress = { ...prev };
              // Copy loaded progress from server
              Object.keys(data.examProgress).forEach(pId => {
                const item = data.examProgress[pId];
                nextProgress[pId] = {
                  playerId: pId,
                  socketId: item.socketId || "",
                  name: item.name || "Alumno",
                  solvedCount: item.solvedCount || 0,
                  correctCount: item.correctCount || 0,
                  incorrectCount: item.incorrectCount || 0,
                  percentage: item.percentage || 0,
                  completed: item.completed || false,
                  timeTakenSeconds: item.timeTakenSeconds || 0,
                  answers: item.answers,
                  status: item.status || "Pendiente",
                  autoSubmitted: item.autoSubmitted || false,
                  tabChangeCount: item.tabChangeCount || 0,
                  disconnectCount: item.disconnectCount || 0,
                  reconnectCount: item.reconnectCount || 0,
                  lastEventName: item.lastEventName || "",
                  lastEventTime: item.lastEventTime || ""
                };
              });
              // Ensure any live players in lobby are also represented
              players.forEach(p => {
                const idToUse = p.playerId || p.id;
                if (!nextProgress[idToUse]) {
                  nextProgress[idToUse] = {
                    playerId: idToUse,
                    socketId: p.id,
                    name: p.name,
                    solvedCount: 0,
                    correctCount: 0,
                    incorrectCount: 0,
                    percentage: 0,
                    completed: false,
                    timeTakenSeconds: 0,
                    status: "Pendiente"
                  };
                }
              });
              return nextProgress;
            });
          }
        }
      })
      .catch(err => {
        console.error("Error fetching session results on mount:", err);
      });
  }, [pin]);

  // Sync initial players list from lobby, preserving existing progress
  useEffect(() => {
    setExamProgress(prev => {
      const nextProgress = { ...prev };
      players.forEach(p => {
        const idToUse = p.playerId || p.id;
        if (!nextProgress[idToUse]) {
          nextProgress[idToUse] = {
            playerId: idToUse,
            socketId: p.id,
            name: p.name,
            solvedCount: 0,
            correctCount: 0,
            incorrectCount: 0,
            percentage: 0,
            completed: false,
            timeTakenSeconds: 0,
            status: "Pendiente"
          };
        } else {
          // preserve progress, just keep newest socketId updated
          nextProgress[idToUse].socketId = p.id;
          nextProgress[idToUse].name = p.name; // preserve latest renamed if any
        }
      });
      return nextProgress;
    });
  }, [players]);

  // Listen to live student progress updates or completions via socket.io
  useEffect(() => {
    // Student sent answers updates back to host as part of local asynchrony
    const handleProgressUpdate = (data: { 
      socketId: string; 
      playerId?: string; 
      name?: string; 
      solvedCount: number; 
      correctCount: number; 
      incorrectCount: number; 
      completed: boolean; 
      timeTakenSeconds: number;
      answers?: any;
    }) => {
      const idToUse = data.playerId || data.socketId;
      
      setExamProgress(prev => {
        const student = prev[idToUse];
        const prevCompleted = student ? student.completed : false;

        const totalQs = quiz.questions.length;
        const percentage = totalQs > 0 ? Math.round((data.correctCount / totalQs) * 100) : 0;

        let solvedStatus = "En progreso";
        if (data.completed) {
          solvedStatus = "Terminado";
        } else if (data.solvedCount === 0) {
          solvedStatus = "Pendiente";
        }

        const nextProgress = {
          ...prev,
          [idToUse]: {
            playerId: idToUse,
            socketId: data.socketId,
            name: data.name || (student ? student.name : "Alumno"),
            solvedCount: data.solvedCount,
            correctCount: data.correctCount,
            incorrectCount: data.incorrectCount,
            percentage,
            completed: data.completed,
            timeTakenSeconds: data.timeTakenSeconds,
            answers: data.answers || (student ? student.answers : {}),
            status: solvedStatus,
            autoSubmitted: (data as any).autoSubmitted || false
          }
        };

        // Play neat blip sound on completion
        if (data.completed && !prevCompleted) {
          playGameSound("correcta");
        }

        return nextProgress;
      });
    };

    socket.on("exam:player-progress", handleProgressUpdate);

    const handleEventRegistered = (data: {
      playerId: string;
      progress: any;
      newEvent: any;
    }) => {
      setExamProgress(prev => {
        const idToUse = data.playerId;
        const existingRec = prev[idToUse];
        return {
          ...prev,
          [idToUse]: {
            ...existingRec,
            ...data.progress,
            playerId: idToUse
          }
        };
      });
      if (data.newEvent) {
        setExamEventsList(prev => {
          const duplicate = prev.some(
            ev => ev.playerId === data.newEvent.playerId && 
                  ev.evento === data.newEvent.evento && 
                  ev.fechaHora === data.newEvent.fechaHora
          );
          if (duplicate) return prev;
          return [...prev, data.newEvent];
        });
      }
    };

    socket.on("exam:event-registered", handleEventRegistered);

    return () => {
      socket.off("exam:player-progress", handleProgressUpdate);
      socket.off("exam:event-registered", handleEventRegistered);
    };
  }, [quiz]);

  function handleStartExam() {
    setExamStatus('ongoing');
    setExamStarted(true);
    playGameSound("inicio");

    // Tell all connected clients to start in exam mode
    socket.emit("game:host-message", {
      pin,
      event: "exam:start",
      totalQuestions: quiz.questions.length,
      questions: quiz.questions,
      timeLimitMinutes: examDurationLimit
    });
  }

  function handleEndExam() {
    setExamStatus('completed');
    playGameSound("finalizacion");

    // Notify clients that answers are closed
    socket.emit("game:host-message", {
      pin,
      event: "exam:ended"
    });
  }

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
    const rows = list.map((student, idx) => {
      let currentStatus = "Pendiente";
      if (student.completed || student.status === "Terminado") {
        currentStatus = "Terminado";
      } else if (student.solvedCount > 0 || student.status === "En progreso") {
        currentStatus = "En progreso";
      }

      // Determine "Estado por tiempo"
      let estadoPorTiempo = "Pendiente";
      if (student.completed || student.status === "Terminado") {
        estadoPorTiempo = student.autoSubmitted ? "Autoentregado por tiempo agotado" : "Entregado";
      } else if (student.solvedCount > 0 || student.status === "En progreso") {
        estadoPorTiempo = "En progreso";
      }

      const infoLimite = examDurationLimit ? `${examDurationLimit} minutos` : "Sin límite";

      return {
        "No.": idx + 1,
        "Nombre de Alumno": student.name,
        "Reactivos Resueltos": student.solvedCount,
        "Aciertos (Correctas)": student.correctCount,
        "Errores (Incorrectas)": student.incorrectCount,
        "Calificación (%)": `${student.percentage}%`,
        "Tiempo de Resolución": `${student.timeTakenSeconds}s`,
        "Estado": currentStatus,
        "Tiempo límite del examen": infoLimite,
        "Tiempo usado": `${student.timeTakenSeconds}s`,
        "Estado por tiempo": estadoPorTiempo
      };
    });

    // Generate sheet & workbook
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modo Examen");

    // Add events sheet
    const eventsRows = examEventsList.map((ev, idx) => ({
      "No.": idx + 1,
      "Alumno": ev.alumno || ev.name,
      "PlayerId": ev.playerId,
      "Evento": ev.evento,
      "Descripción": ev.descripcion || ev.description,
      "Fecha y hora": ev.fechaHora || ev.timestamp,
      "Reactivo actual": ev.reactivoActual || ev.currentQuestion || "N/A",
      "Estado del examen": ev.examStatus || ev.status || "En progreso"
    }));
    const wsEvents = XLSX.utils.json_to_sheet(eventsRows);
    XLSX.utils.book_append_sheet(wb, wsEvents, "Eventos de examen");

    // Trigger local offline download
    const fileName = `Reporte_Examen_PIN_${pin}_${quiz.title.replace(/\s+/g, "_")}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const totalRegistered = Object.keys(examProgress).length;
  const totalCompleted = (Object.values(examProgress) as StudentExamProgress[]).filter(p => p.completed).length;
  const totalEnProgreso = (Object.values(examProgress) as StudentExamProgress[]).filter(p => !p.completed && p.solvedCount > 0).length;
  const totalPendientes = (Object.values(examProgress) as StudentExamProgress[]).filter(p => !p.completed && p.solvedCount === 0).length;

  if (examStatus === 'lobby') {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl max-w-5xl mx-auto text-slate-800 animate-fade-in" id="exam-lobby-screen">
        
        {/* Header section with Metadata */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="space-y-1.5 text-left">
            <span className="bg-indigo-150 text-indigo-850 border border-indigo-250 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full inline-block">
              📝 Modo Examen Activo
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 font-sans tracking-tight">{quiz.title}</h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 font-semibold items-center">
              <span className="flex items-center gap-1"><ClipboardCheck size={14} className="text-slate-450" /> {quiz.questions.length} Reactivos</span>
              <span className="h-1 w-1 bg-slate-300 rounded-full" />
              <span>Calificación autoevaluada</span>
              <span className="h-1 w-1 bg-slate-300 rounded-full" />
              <span>Progreso silencioso individual</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToMenu}
              className="px-4 py-2 hover:bg-slate-200 bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-bold rounded-xl transition-all border border-slate-200 cursor-pointer shadow-xs"
            >
              Volver
            </button>
            <button
              onClick={handleStartExam}
              disabled={players.length === 0}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:from-indigo-300 disabled:to-indigo-300 disabled:opacity-50 text-white font-sans font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md hover:shadow-indigo-500/10 transition-all cursor-pointer"
            >
              <Play size={14} className="fill-white" />
              <span>Iniciar Examen ({players.length})</span>
            </button>
          </div>
        </div>

        {/* Central visual screen split: Left instructions/players, Right QR & Giant PIN */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Instructions and Student List (Take 7 spans) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Instruction banner */}
            <div className="bg-indigo-600 border border-indigo-750 text-white rounded-2xl p-5 shadow-inner relative overflow-hidden" id="exam-instructions-promo">
              <div className="relative z-10 space-y-2">
                <h4 className="text-md font-extrabold tracking-tight">¿Cómo entrar al Examen?</h4>
                <p className="text-xs text-indigo-100 font-medium leading-relaxed">
                  Escanea el código QR de la derecha con tu teléfono para acceder directamente sin escribir códigos, o abre la URL local en tu navegador e ingresa el PIN de partida.
                </p>
                <div className="pt-1.5 flex flex-wrap gap-2 items-center text-[10px] font-mono text-indigo-100">
                  <span className="bg-indigo-800/60 border border-indigo-700/55 px-2.5 py-1 rounded-lg">1. Escanear / Entrar</span>
                  <span className="font-extrabold text-indigo-300">&rarr;</span>
                  <span className="bg-indigo-800/60 border border-indigo-700/55 px-2.5 py-1 rounded-lg">2. Nombre y Avatar</span>
                  <span className="font-extrabold text-indigo-300">&rarr;</span>
                  <span className="bg-indigo-800/60 border border-indigo-700/55 px-2.5 py-1 rounded-lg">3. ¡Comenzar!</span>
                </div>
              </div>
              <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-20 pointer-events-none scale-150">
                <Laptop size={120} className="text-white" />
              </div>
            </div>

            {/* Configuration card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs text-left" id="exam-config-block">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <ClipboardCheck className="text-indigo-600" size={18} />
                <h3 className="text-sm font-black text-slate-800 tracking-tight">Configuración de Tiempo Límite</h3>
              </div>
              
              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide block">Tiempo límite del examen</label>
                
                {/* Quick select buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { label: "Sin límite", value: null },
                    { label: "10 min", value: 10 },
                    { label: "15 min", value: 15 },
                    { label: "20 min", value: 20 },
                    { label: "30 min", value: 30 },
                    { label: "45 min", value: 45 },
                    { label: "60 min", value: 60 }
                  ].map((opt) => {
                    const isSelected = examDurationLimit === opt.value && !isCustomTimeLimit;
                    return (
                      <button
                        key={opt.label || 'sin-limite'}
                        type="button"
                        onClick={() => {
                          setExamDurationLimit(opt.value);
                          setIsCustomTimeLimit(false);
                          setCustomMinutes("");
                        }}
                        className={`px-2 py-1.5 rounded-lg border text-[11px] font-extrabold transition-all text-center cursor-pointer ${
                          isSelected
                            ? "bg-indigo-600 border-indigo-600 text-white"
                            : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomTimeLimit(true);
                      setExamDurationLimit(25); // Default custom
                      setCustomMinutes("25");
                    }}
                    className={`px-2 py-1.5 rounded-lg border text-[11px] font-extrabold transition-all text-center cursor-pointer col-span-1 ${
                      isCustomTimeLimit
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                    }`}
                  >
                    Personalizado...
                  </button>
                </div>
                
                {/* Custom input */}
                {isCustomTimeLimit && (
                  <div className="flex items-center gap-2 pt-1 animate-fade-in">
                    <input
                      type="number"
                      min="1"
                      max="480"
                      value={customMinutes}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomMinutes(val);
                        const mins = parseInt(val, 10);
                        if (!isNaN(mins) && mins > 0) {
                          setExamDurationLimit(mins);
                        } else {
                          setExamDurationLimit(null);
                        }
                      }}
                      placeholder="Minutos"
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 font-sans font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 w-28 bg-white"
                    />
                    <span className="text-xs text-slate-500 font-semibold font-sans">minutos</span>
                  </div>
                )}
              </div>
            </div>

            {/* Registered players directory */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs" id="players-directory-block">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="text-indigo-600" size={18} />
                  <h3 className="text-sm font-black text-slate-800 tracking-tight">Alumnos Unidos</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] font-mono font-bold text-slate-500">
                    {players.length} conectados
                  </span>
                </div>
              </div>

              {players.length === 0 ? (
                <div className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 space-y-2">
                  <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mx-auto text-indigo-500 font-black animate-pulse">
                    ?
                  </div>
                  <h4 className="text-xs font-bold text-slate-700">Esperando participantes...</h4>
                  <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
                    Los alumnos irán apareciendo en tiempo real aquí conforme escaneen el QR o coloquen el PIN.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {players.map((p) => (
                    <div 
                      key={p.id}
                      className="flex items-center gap-2 bg-indigo-50/40 hover:bg-indigo-50 hover:scale-[1.02] border border-indigo-150/45 px-2.5 py-2 rounded-xl transition-all shadow-xs"
                    >
                      <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center font-mono">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-[11px] font-bold tracking-tight text-slate-700 truncate block">
                        {p.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Right Column: QR and Giant PIN projection helper (Take 5 spans) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Giant PIN section */}
            <div className="bg-white border-2 border-indigo-200 rounded-2xl p-5 text-center flex flex-col items-center justify-center shadow-xs" id="giant-pin-container">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 mb-1">
                PIN DE PARTIDA
              </span>
              <div className="text-[54px] sm:text-[72px] font-black font-mono tracking-widest text-indigo-900 leading-none py-1 selection:bg-indigo-100">
                {pin}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(pin);
                  setCopiedPin(true);
                  setTimeout(() => setCopiedPin(false), 2000);
                }}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-xs"
              >
                <Copy size={10} />
                <span>{copiedPin ? "¡Copiado!" : "Copiar PIN"}</span>
              </button>
            </div>

            {/* Smart QR direct entry */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col items-center space-y-3.5 shadow-xs" id="qr-promo-block">
              <div className="text-center space-y-1">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Escanea y entra directo</h4>
                <p className="text-[10px] text-slate-450 font-sans tracking-wide leading-normal">
                  No necesitas escribir el PIN si usas el QR.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-2 flex flex-col items-center justify-center aspect-square shadow-sm max-w-[170px] max-h-[170px]">
                {sessionQrUrl ? (
                  <img
                    src={sessionQrUrl}
                    alt="Lector de código"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-[150px] h-[150px] flex items-center justify-center bg-slate-50 border border-slate-100 rounded text-slate-400 font-bold text-xs animate-pulse">
                    Generando QR...
                  </div>
                )}
              </div>

              <div className="text-center space-y-2 w-full">
                <p className="text-[9px] font-mono text-indigo-700 bg-indigo-50/50 border border-indigo-100/60 py-1 px-2.5 rounded-lg select-all tracking-tight truncate max-w-full" id="exam-qr-url-text">
                  {joinUrlUsed}
                </p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(joinUrlUsed);
                    setCopiedUrl(true);
                    setTimeout(() => setCopiedUrl(false), 2000);
                  }}
                  className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 font-sans font-bold px-2.5 py-1 rounded-lg transition-all text-[10px] cursor-pointer"
                  id="exam-qr-url-copy-btn"
                >
                  <Copy size={10} />
                  <span>{copiedUrl ? "¡Copiado!" : "Copiar enlace"}</span>
                </button>

                {!isIpDetected && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-850 rounded-xl p-3 text-[10.5px] font-bold text-center mt-3 leading-normal" id="exam-wifi-warning-banner">
                    ⚠️ No se detectó IP local. Revisa tu conexión WiFi.
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>

      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl" id="exam-ongoing-screen">
      
      {/* Upper core indicators and actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1 text-left">
          <div className="flex items-center gap-2">
            <span className="bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-indigo-150">
              {examStatus === 'completed' ? "✓ Examen Concluido" : "⚡ Examen Aplicándose"}
            </span>
            <span className="text-xs text-slate-450 font-mono">
              PIN Sala: <strong className="text-indigo-650 font-black">{pin}</strong>
            </span>
          </div>
          <h2 className="text-md sm:text-lg font-black text-slate-900 font-sans truncate max-w-sm">
            {quiz.title}
          </h2>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-500 items-center">
            <span>Límite: <strong className="text-indigo-600">{examDurationLimit ? `${examDurationLimit} min` : "Sin límite"}</strong></span>
            {examDurationLimit && (
              <>
                <span className="h-1.5 w-1.5 bg-slate-300 rounded-full" />
                <span>Tiempo Restante: <strong className={examDurationLimit * 60 - timerElapsed <= 60 ? "text-rose-605 animate-pulse font-black" : examDurationLimit * 60 - timerElapsed <= 300 ? "text-amber-605 font-black" : "text-emerald-650 font-bold"}>{examStatus === 'completed' ? "00:00" : formatTimer(Math.max(0, examDurationLimit * 60 - timerElapsed))}</strong></span>
              </>
            )}
            {!examDurationLimit && (
              <>
                <span className="h-1.5 w-1.5 bg-slate-300 rounded-full" />
                <span>Tiempo Transcurrido: <strong className="text-slate-700">{formatTimer(timerElapsed)}</strong></span>
              </>
            )}
          </div>
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
          <p className="text-[10px] font-black uppercase text-emerald-600 font-mono">Terminados (✓)</p>
          <p className="text-xl font-bold font-mono text-emerald-650">{totalCompleted}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase text-indigo-600 font-mono">En Progreso (⚡)</p>
          <p className="text-xl font-bold font-mono text-indigo-650">{totalEnProgreso}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase text-amber-600 font-mono">Pendientes (⏱️)</p>
          <p className="text-xl font-bold font-mono text-amber-650">{totalPendientes}</p>
        </div>
      </div>

      {/* Alertas de integridad del examen */}
      <div className="space-y-3 bg-slate-50 border border-slate-200 p-5 sm:p-6 rounded-2xl">
        <h3 className="text-sm font-black tracking-wider text-rose-700 uppercase font-sans text-left flex items-center gap-2">
          <span>⚠️ Alertas de Integridad del Examen</span>
        </h3>
        <p className="text-xs text-slate-500 font-semibold text-left font-sans leading-normal">
          Se registran cambios de pestaña, pérdida de foco y desconexiones del alumno durante la aplicación.
        </p>

        {Object.keys(examProgress).length === 0 ? (
          <div className="border border-dashed border-slate-200 py-6 text-center text-slate-400 text-xs font-semibold rounded-xl bg-white">
            <p>Monitoreo inactivo. No hay alumnos rindiendo examen.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3" id="exam-integrity-alerts">
            {(Object.values(examProgress) as StudentExamProgress[]).map(p => {
              const tabChanges = p.tabChangeCount || 0;
              const disconnects = p.disconnectCount || 0;
              const totalEvents = tabChanges + disconnects;
              
              let badgeColor = "bg-emerald-55 text-emerald-800 border-emerald-200";
              let badgeText = "Verde: Seguro";
              if (totalEvents === 1) {
                badgeColor = "bg-amber-55 text-amber-800 border-amber-200";
                badgeText = "Amarillo: 1 Advertencia";
              } else if (totalEvents >= 2) {
                badgeColor = "bg-rose-55 text-rose-850 border-rose-200";
                badgeText = `Rojo: ${totalEvents} Alertas`;
              }
              
              return (
                <div 
                  key={p.playerId || p.socketId}
                  className="p-4 rounded-xl border flex flex-col justify-between gap-3 bg-white border-slate-200 shadow-3xs text-left"
                >
                  <div className="flex justify-between items-start gap-2 border-b border-slate-100 pb-2">
                    <div className="space-y-0.5">
                      <span className="font-extrabold text-xs text-slate-900">{p.name}</span>
                      <p className="text-[10px] text-slate-400 font-mono">ID: {p.playerId || "N/A"}</p>
                    </div>
                    <span className={`text-[10px] border px-2 py-0.5 rounded-full font-black uppercase tracking-tight ${badgeColor}`}>
                      {badgeText}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-sans">
                    <div className="space-y-0.5 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                      <span className="text-slate-450 font-bold block text-[10px]">Cambios de Pestaña:</span>
                      <strong className={`font-mono text-xs ${tabChanges > 0 ? "text-rose-600 font-black" : "text-slate-700"}`}>
                        {tabChanges}
                      </strong>
                    </div>

                    <div className="space-y-0.5 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                      <span className="text-slate-455 font-bold block text-[10px]">Desconexiones:</span>
                      <strong className={`font-mono text-xs ${disconnects > 0 ? "text-rose-600 font-black" : "text-slate-700"}`}>
                        {disconnects}
                      </strong>
                    </div>
                  </div>

                  {p.lastEventName ? (
                    <div className="text-[10.5px] border-t border-slate-50 pt-2 flex flex-col gap-0.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-450 font-semibold">Último Evento:</span>
                        <span className="text-slate-450 font-mono">{p.lastEventTime || "N/A"}</span>
                      </div>
                      <strong className="text-rose-700 uppercase font-black tracking-tight font-sans text-xs">
                        {p.lastEventName}
                      </strong>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 font-semibold italic text-center pt-1 border-t border-slate-50">
                      Sin eventos de fuga o desconexión.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
                key={p.playerId || p.socketId}
                className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all shadow-2xs ${
                  p.completed 
                    ? "bg-emerald-50/40 border-emerald-200 text-slate-900" 
                    : "bg-white border-slate-200"
                }`}
              >
                <div className="space-y-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-800 leading-none">{p.name}</span>
                    {p.completed ? (
                      <span className="bg-emerald-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full uppercase font-mono">
                        {p.autoSubmitted ? "Autoentregado" : "Terminado"}
                      </span>
                    ) : p.solvedCount > 0 ? (
                      <span className="bg-indigo-100 border border-indigo-200 text-indigo-850 text-[9px] font-black px-2 py-0.5 rounded-full uppercase font-mono">
                        En progreso
                      </span>
                    ) : (
                      <span className="bg-amber-100 border border-amber-200 text-amber-850 text-[9px] font-black px-2 py-0.5 rounded-full uppercase font-mono">
                        Pendiente
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
