import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Volume2, VolumeX, Eye, Monitor } from "lucide-react";
import TeacherDashboard from "./components/TeacherDashboard";
import QuestionnaireEditor from "./components/QuestionnaireEditor";
import StudentInterface from "./components/StudentInterface";
import ReactivosImporter from "./components/ReactivosImporter";
import { Questionnaire } from "./types";
import { getSoundsEnabled, setSoundsEnabled } from "./lib/sound";
import { safeStorage } from "./lib/safeStorage";

function isTeacherEnvironment() {
  const isElectron = navigator.userAgent.toLowerCase().includes('electron') || 
                     // @ts-ignore
                     window.electronAPI?.isElectron || false;
  
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return isElectron || isLocalhost;
}

function AppContent() {
  const [soundsEnabled, setSoundsEnabledState] = useState(getSoundsEnabled());
  const [highContrast, setHighContrast] = useState<boolean>(() => safeStorage.getItem("highContrast") === "true");
  const [projectorMode, setProjectorMode] = useState<boolean>(() => safeStorage.getItem("projectorMode") === "true");
  
  const [quizView, setQuizView] = useState<'dashboard' | 'editor' | 'importer'>('dashboard');
  const [editingQuiz, setEditingQuiz] = useState<Questionnaire | null>(null);
  const [importerGameType, setImporterGameType] = useState<'quiz_live' | 'exam_mode' | 'family_feud' | 'jeopardy'>('quiz_live');

  return (
    <div 
      className={`min-h-screen bg-slate-50 font-sans antialiased text-slate-900 flex flex-col justify-between ${
        highContrast ? "high-contrast" : ""
      } ${projectorMode ? "projector-mode" : ""}`} 
      id="app-container"
    >
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-50 py-4 px-4 sm:px-8 flex items-center justify-between shadow-sm lg:gap-1" id="app-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-md">
            P
          </div>
          <div>
            <h1 className="text-md sm:text-lg font-extrabold tracking-tight text-slate-900 font-sans">
              Prepmaster <span className="text-indigo-600">Live</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-mono tracking-wider uppercase font-bold">
              Servidor Escolar Offline
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 justify-end">
          <button
            onClick={() => {
              const nextState = !soundsEnabled;
              setSoundsEnabled(nextState);
              setSoundsEnabledState(nextState);
            }}
            className={`flex items-center gap-1.5 text-xs font-black py-2 px-3 sm:px-3.5 rounded-xl transition-all border cursor-pointer shadow-xs ${
              soundsEnabled
                ? "bg-emerald-50 border-emerald-150 text-emerald-700 hover:bg-emerald-100"
                : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
            }`}
            id="global-sounds-toggler"
            title={soundsEnabled ? "Sonidos Activados" : "Sonidos Silenciados"}
          >
            {soundsEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            <span className="hidden sm:inline">{soundsEnabled ? "🔊 Sonidos" : "🔇 Silenciar"}</span>
          </button>
          <button
            onClick={() => {
              const nextVal = !highContrast;
              setHighContrast(nextVal);
              safeStorage.setItem("highContrast", nextVal.toString());
            }}
            className={`flex items-center gap-1.5 text-xs font-black py-2 px-3 sm:px-3.5 rounded-xl transition-all border cursor-pointer shadow-xs ${
              highContrast
                ? "bg-blue-600 border-blue-750 text-white"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
            id="accessibility-contrast-toggler"
            title="Saturación / Contraste accesible"
          >
            <Eye size={14} />
            <span className="hidden sm:inline">{highContrast ? "👁️ Alto Contraste On" : "👁️ Alto Contraste"}</span>
          </button>
          <button
            onClick={() => {
              const nextVal = !projectorMode;
              setProjectorMode(nextVal);
              safeStorage.setItem("projectorMode", nextVal.toString());
            }}
            className={`flex items-center gap-1.5 text-xs font-black py-2 px-3 sm:px-3.5 rounded-xl transition-all border cursor-pointer shadow-xs ${
              projectorMode
                ? "bg-violet-600 border-violet-750 text-white"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
            id="accessibility-projector-toggler"
            title="Optimizar para proyección y baja luminosidad"
          >
            <Monitor size={14} />
            <span className="hidden sm:inline">{projectorMode ? "📽️ Modo Proyector On" : "📽️ Modo Proyector"}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 py-8 px-4 sm:px-8 max-w-7xl mx-auto w-full flex flex-col justify-center" id="app-workspace">
        <Routes>
          <Route path="/" element={<Navigate to="/teacher" />} />
          <Route path="/teacher" element={
            <div className="w-full flex-1 animate-fade-in" id="teacher-workspace-container">
              <TeacherGate>
                {quizView === 'dashboard' ? (
                  <TeacherDashboard 
                    onCreateNew={() => {
                      setEditingQuiz(null);
                      setQuizView('editor');
                    }}
                    onEdit={(quiz) => {
                      setEditingQuiz(quiz);
                      setQuizView('editor');
                    }}
                    onImport={(gameType?: 'quiz_live' | 'exam_mode' | 'family_feud' | 'jeopardy') => {
                      if (gameType) {
                        setImporterGameType(gameType);
                      }
                      setQuizView('importer');
                    }}
                  />
                ) : quizView === 'editor' ? (
                  <QuestionnaireEditor 
                    editingQuiz={editingQuiz}
                    onBack={() => setQuizView('dashboard')}
                    onSaved={() => {
                      setQuizView('dashboard');
                    }}
                  />
                ) : (
                  <ReactivosImporter 
                    initialGameType={importerGameType}
                    onBack={() => setQuizView('dashboard')}
                    onSaved={() => {
                      setQuizView('dashboard');
                    }}
                  />
                )}
              </TeacherGate>
            </div>
          } />
          <Route path="/join" element={
            <div className="w-full flex-1 flex flex-col justify-center py-4 animate-fade-in" id="student-workspace-container">
              <StudentRoute />
            </div>
          } />
          <Route path="*" element={<Navigate to="/teacher" />} />
        </Routes>
      </main>

      <footer className="py-4 text-center border-t border-slate-200 bg-white" id="app-footer-bar">
        <p className="text-[10px] text-slate-400 font-mono">
          Prepmaster Live para Escuelas — Red local WiFi offline • Diseñado para la inclusión educativa
        </p>
      </footer>
    </div>
  );
}

function AutoRouter() {
  const navigate = useNavigate();
  
  useEffect(() => {
    if (isTeacherEnvironment()) {
      navigate("/teacher", { replace: true });
    } else {
      navigate("/join", { replace: true });
    }
  }, [navigate]);

  return null;
}

function TeacherGate({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!isTeacherEnvironment()) {
      navigate("/join", { replace: true });
    }
  }, [navigate]);

  if (!isTeacherEnvironment()) {
    return null;
  }

  return <>{children}</>;
}

function StudentRoute() {
  const location = useLocation();
  const [urlPin, setUrlPin] = useState<string>("");
  const [urlGame, setUrlGame] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const pinParam = params.get("pin");
    const gameParam = params.get("game");
    if (pinParam) {
      setUrlPin(pinParam);
    }
    if (gameParam) {
      setUrlGame(gameParam);
    }
  }, [location]);

  return <StudentInterface initialPin={urlPin} initialGame={urlGame} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
