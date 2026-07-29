export interface GameModule {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  accentColor: string;
  borderClass: string;
  route: string;
  enabled: boolean;
  category: "Evaluación" | "Trivia" | "Estrategia" | "Creatividad" | "Colaborativo" | "Competencia";
  duration: string;
  players: string;
  features: string[];
}

export const GAMES_REGISTRY: GameModule[] = [
  {
    id: "quiz_live",
    name: "Quiz Live",
    description: "Cuestionario de respuesta rápida estilo trivia con temporizador y puntuación progresiva por tiempo.",
    icon: "🎯",
    color: "bg-indigo-600",
    accentColor: "#2563EB",
    borderClass: "border-indigo-150 hover:border-indigo-500",
    route: "quiz_live",
    enabled: true,
    category: "Trivia",
    duration: "5-10 min",
    players: "1+ Alumnos",
    features: ["⚡ Tiempo Real", "📈 Ranking Dinámico", "👥 Individual/Equipos"]
  },
  {
    id: "exam_mode",
    name: "Modo Examen",
    description: "Evaluación silenciosa académica a ritmo individual. Sin ranking inmediato ni presión de tiempo para responder. Genera reportes en Excel.",
    icon: "📝",
    color: "bg-violet-600",
    accentColor: "#7C3AED",
    borderClass: "border-violet-150 hover:border-violet-500",
    route: "exam",
    enabled: true,
    category: "Evaluación",
    duration: "15-40 min",
    players: "1+ Alumnos",
    features: ["🏫 Ambiente Académico", "📊 Reporte Detallado", "🔁 Conexión Resiliente"]
  },
  {
    id: "jeopardy",
    name: "Jeopardy",
    description: "Clásico tablero de preguntas y respuestas divididas por categorías temáticas con apuestas de puntuación.",
    icon: "🧠",
    color: "bg-indigo-700",
    accentColor: "#4F46E5",
    borderClass: "border-blue-150 hover:border-blue-500",
    route: "jeopardy",
    enabled: true,
    category: "Estrategia",
    duration: "10-20 min",
    players: "2+ Equipos",
    features: ["📚 Categorías", "👥 Equipos", "⚡ Tiempo Real"]
  },
  {
    id: "family_feud",
    name: "100 Estudiantes Dijeron",
    description: "Adivina las respuestas más comunes dadas por estudiantes en encuestas colectivas estudiantiles con timbre interactivo.",
    icon: "🧑‍🎓",
    color: "bg-amber-500",
    accentColor: "#F59E0B",
    borderClass: "border-amber-150 hover:border-amber-500",
    route: "family_feud",
    enabled: true,
    category: "Colaborativo",
    duration: "10-15 min",
    players: "2+ Equipos o Individual",
    features: ["🛎️ Buzzer Timbre", "💥 Tablero Oculto", "❌ Límite de 3 Errores"]
  }
];

