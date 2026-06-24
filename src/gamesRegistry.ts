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
    id: "mexicanos",
    name: "100 Estudiantes Dijeron",
    description: "Adivina las respuestas más comunes dadas por estudiantes en encuestas colectivas estudiantiles con timbre interactivo.",
    icon: "🧑‍🎓",
    color: "bg-amber-500",
    accentColor: "#F59E0B",
    borderClass: "border-amber-150 hover:border-amber-500",
    route: "mexicanos",
    enabled: true,
    category: "Colaborativo",
    duration: "10-15 min",
    players: "2+ Equipos o Individual",
    features: ["🛎️ Buzzer Timbre", "💥 Tablero Oculto", "❌ Límite de 3 Errores"]
  },
  {
    id: "pictionary",
    name: "Pictionary Educativo",
    description: "Dibuja conceptos académicos en tiempo real y haz que tu equipo los adivine antes de que termine el tiempo.",
    icon: "🎨",
    color: "bg-emerald-600",
    accentColor: "#10b981",
    borderClass: "border-emerald-150 hover:border-emerald-500",
    route: "pictionary",
    enabled: true,
    category: "Creatividad",
    duration: "10-25 min",
    players: "2+ Equipos",
    features: ["✍️ Dibujo en Vivo", "💡 Vocabulario Clave", "🧑‍🎨 Colaboración Rápida"]
  },
  {
    id: "horse_race",
    name: "Carrera de Caballos",
    description: "Responde correctamente para impulsar tu caballo y llegar primero a la meta.",
    icon: "🐎",
    color: "bg-amber-600",
    accentColor: "#d97706",
    borderClass: "border-amber-150 hover:border-amber-500",
    route: "horse_race",
    enabled: true,
    category: "Competencia",
    duration: "10-20 min",
    players: "2-8 Equipos o Todos Contra Todos",
    features: ["🏁 Competencia en Vivo", "🏎️ Velocidad y Estrategia", "⚡ Power-Ups de Ventaja"]
  },
  {
    id: "headbanz",
    name: "🧠 Headbanz Educativo",
    description: "Adivina el concepto oculto haciendo preguntas inteligentes.",
    icon: "👑",
    color: "bg-pink-600",
    accentColor: "#db2777",
    borderClass: "border-pink-150 hover:border-pink-500",
    route: "headbanz",
    enabled: true,
    category: "Colaborativo",
    duration: "8-12 min",
    players: "3+ Alumnos",
    features: ["⏰ Tiempo Límite", "🗣️ Pistas de Aula", "🎯 Tópicos Académicos"]
  },
  {
    id: "conecta_4",
    name: "Conecta 4 Educativo",
    description: "Responde preguntas para colocar tus fichas y alinear cuatro seguidas bloqueando al adversario.",
    icon: "🔵",
    color: "bg-blue-600",
    accentColor: "#2563EB",
    borderClass: "border-blue-150 hover:border-blue-500",
    route: "conecta_4",
    enabled: true,
    category: "Estrategia",
    duration: "10-20 min",
    players: "2 Jugadores/Equipos",
    features: ["🧩 Desafío Clásico", "🎯 Bloqueo de Posiciones", "🔥 Turnos de Estrategia"]
  }
];
