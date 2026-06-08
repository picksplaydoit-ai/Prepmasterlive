import { useState, useEffect } from "react";
import { Gamepad2, Tv, Users, ArrowLeft, GraduationCap, Laptop, Phone } from "lucide-react";
import TeacherDashboard from "./components/TeacherDashboard";
import QuestionnaireEditor from "./components/QuestionnaireEditor";
import StudentInterface from "./components/StudentInterface";
import ReactivosImporter from "./components/ReactivosImporter";
import { Questionnaire } from "./types";

export default function App() {
  // Screen views: 'home' | 'teacher' | 'student'
  const [role, setRole] = useState<'home' | 'teacher' | 'student'>('home');
  
  // Teacher-specific routing state
  const [quizView, setQuizView] = useState<'dashboard' | 'editor' | 'importer'>('dashboard');
  const [editingQuiz, setEditingQuiz] = useState<Questionnaire | null>(null);
  const [importerGameType, setImporterGameType] = useState<'quiz_live' | 'exam_mode' | 'mexicanos' | 'jeopardy'>('quiz_live');

  // URL-driven dynamic entry
  const [urlPin, setUrlPin] = useState<string>("");
  const [urlGame, setUrlGame] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pinParam = params.get("pin");
    const gameParam = params.get("game");
    if (pinParam) {
      setUrlPin(pinParam);
      if (gameParam) {
        setUrlGame(gameParam);
      }
      setRole('student');
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 font-sans antialiased text-slate-800 flex flex-col justify-between" id="app-container">
      
      {/* Dynamic top bar */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-50 py-4 px-4 sm:px-8 flex items-center justify-between shadow-sm" id="app-header">
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

        {/* Home navigation breadcrumbs */}
        {role !== 'home' && (
          <button
            onClick={() => {
              setRole('home');
              setQuizView('dashboard');
            }}
            className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-white hover:bg-indigo-600 bg-indigo-50 border border-indigo-150 py-2 px-4 rounded-xl transition-all cursor-pointer shadow-sm"
            id="btn-nav-home"
          >
            <ArrowLeft size={14} />
            <span>Volver a Inicio</span>
          </button>
        )}
      </header>

      {/* Main Container Workspace */}
      <main className="flex-1 py-8 px-4 sm:px-8 max-w-7xl mx-auto w-full flex flex-col justify-center" id="app-workspace">
        
        {/* HOMEPAGE ROLE GATE */}
        {role === 'home' && (
          <div className="max-w-3xl mx-auto text-center space-y-12 py-6" id="home-portal-view">
            <div className="space-y-4">
              <span className="bg-indigo-50 text-indigo-600 border border-indigo-200/60 text-xs px-4 py-2 rounded-full font-extrabold font-sans tracking-wide uppercase shadow-sm">
                ⚙️ Offline-First & Red Local
              </span>
              <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 font-sans tracking-tight leading-tight">
                El aula conectada, <br />
                <span className="text-indigo-600 italic">
                  sin depender de internet.
                </span>
              </h2>
              <p className="text-sm sm:text-md text-slate-500 max-w-xl mx-auto leading-relaxed">
                Herramienta interactiva de cuestionarios para escuelas con baja o nula conectividad. La PC del profesor funciona como el servidor maestro local y los alumnos juegan desde sus celulares.
              </p>
            </div>

            {/* Selector Blocks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto text-left">
              
              {/* Teacher Gate card */}
              <button
                onClick={() => setRole('teacher')}
                className="group bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-500 p-8 rounded-2xl space-y-5 text-left transition-all duration-200 hover:shadow-xl shadow-lg shadow-slate-150/50 active:transform active:scale-[0.99] cursor-pointer"
                id="btn-role-teacher"
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-sm">
                  <Tv size={24} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    Pantalla del Profesor
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-sans">
                    Crea cuestionarios, proyecta el PIN e inicia partidas locales con visualización de preguntas y podio final interactivo.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-600 group-hover:underline">
                  <Laptop size={14} />
                  <span>Proyectar Pantalla de Aula</span>
                </div>
              </button>

              {/* Student Gate card */}
              <button
                onClick={() => setRole('student')}
                className="group bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-500 p-8 rounded-2xl space-y-5 text-left transition-all duration-200 hover:shadow-xl shadow-lg shadow-slate-150/50 active:transform active:scale-[0.99] cursor-pointer"
                id="btn-role-student"
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-sm">
                  <Gamepad2 size={24} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    Ingresar como Alumno
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-sans">
                    Únete a una partida activa escribiendo el PIN indicado por tu docente para responder opciones de colores velozmente.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-700 group-hover:underline">
                  <Phone size={14} />
                  <span>Jugar desde mi Celular</span>
                </div>
              </button>
            </div>

            {/* Quick school connection reminder */}
            <div className="text-xs text-slate-400 max-w-sm mx-auto flex items-center justify-center gap-2 font-mono bg-white py-2 px-4 rounded-xl border border-slate-200 inline-flex shadow-sm">
              <GraduationCap size={16} className="text-slate-500" />
              <span>Instrucciones: Conéctense todos al mismo Router Wifi</span>
            </div>
          </div>
        )}

        {/* TEACHER DASHBOARD ACTIVE CONSOLE */}
        {role === 'teacher' && (
          <div className="w-full flex-1 animate-fade-in" id="teacher-workspace-container">
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
                onImport={(gameType?: 'quiz_live' | 'exam_mode' | 'mexicanos' | 'jeopardy') => {
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
          </div>
        )}

        {/* STUDENT CLIENT MOBILE PAD */}
        {role === 'student' && (
          <div className="w-full flex-1 flex flex-col justify-center py-4 animate-fade-in" id="student-workspace-container">
            <StudentInterface initialPin={urlPin} initialGame={urlGame} />
          </div>
        )}
      </main>

      {/* Aesthetic human label credits at the very bottom */}
      <footer className="py-4 text-center border-t border-slate-200 bg-white" id="app-footer-bar">
        <p className="text-[10px] text-slate-400 font-mono">
          Prepmaster Live para Escuelas — Red local WiFi offline • Diseñado para la inclusión educativa
        </p>
      </footer>
    </div>
  );
}
