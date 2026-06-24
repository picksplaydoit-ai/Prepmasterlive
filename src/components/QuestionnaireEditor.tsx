import React, { useState, useEffect } from "react";
import { Plus, Trash2, Save, ArrowLeft, Clock, Check, AlertCircle, HelpCircle } from "lucide-react";
import { Question, Questionnaire } from "../types";

interface QuestionnaireEditorProps {
  editingQuiz: Questionnaire | null;
  onBack: () => void;
  onSaved: () => void;
}

const DEFAULT_QUESTION: Question = {
  id: "",
  text: "",
  options: ["", "", "", ""],
  correctOption: 0,
  timeLimit: 20
};

export default function QuestionnaireEditor({ editingQuiz, onBack, onSaved }: QuestionnaireEditorProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [gameType, setGameType] = useState<'quiz_live' | 'exam_mode' | 'mexicanos' | 'jeopardy'>("quiz_live");
  const [questions, setQuestions] = useState<Question[]>([
    { ...DEFAULT_QUESTION, id: "q_temp_1" }
  ]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingQuiz) {
      setTitle(editingQuiz.title);
      setDescription(editingQuiz.description || "");
      setGameType(editingQuiz.game_type || "quiz_live");
      setQuestions(editingQuiz.questions.length > 0 ? editingQuiz.questions : [{ ...DEFAULT_QUESTION, id: "q_temp_1" }]);
    } else {
      setTitle("");
      setDescription("");
      setGameType("quiz_live");
      setQuestions([{ ...DEFAULT_QUESTION, id: "q_temp_1" }]);
    }
  }, [editingQuiz]);

  // Handle Game Type Change – automatically fill appropriate presets
  const handleGameTypeChange = (newType: 'quiz_live' | 'exam_mode' | 'mexicanos' | 'jeopardy') => {
    setGameType(newType);
    setError(null);
    
    // Auto convert existing questions to fit of new presets if empty
    const updatedQs = questions.map(q => {
      if (newType === 'quiz_live') {
        return {
          ...q,
          options: q.options.length >= 4 ? q.options.slice(0, 4) : ["", "", "", ""],
          correctOption: typeof q.correctOption === 'number' ? q.correctOption : 0,
          type: undefined
        };
      } else if (newType === 'exam_mode') {
        return {
          ...q,
          type: q.type || 'multiple_choice',
          feedback: q.feedback || "",
          alternatives: q.alternatives || [],
          correctShortAnswer: q.correctShortAnswer || ""
        };
      } else if (newType === 'mexicanos') {
        const mxOpts = q.options.length > 0 && q.options[0].includes("|") 
          ? q.options 
          : ["Respuesta A|40", "Respuesta B|25", "Respuesta C|15"];
        return {
          ...q,
          options: mxOpts,
          round: q.round || 1
        };
      } else if (newType === 'jeopardy') {
        return {
          ...q,
          topic: q.topic || "Miscelánea",
          points: q.points || 200,
          value: q.points || 200,
          options: [q.options[0] || "", "", "", ""],
          correctOption: 0,
          hint: q.hint || ""
        };
      }
      return q;
    });
    setQuestions(updatedQs);
  };

  const handleAddQuestion = () => {
    let newQ: Question = {
      id: "q_temp_" + Date.now(),
      text: "",
      options: ["", "", "", ""],
      correctOption: 0,
      timeLimit: 20
    };

    if (gameType === 'exam_mode') {
      newQ.type = 'multiple_choice';
      newQ.feedback = "";
      newQ.correctShortAnswer = "";
      newQ.alternatives = [];
    } else if (gameType === 'mexicanos') {
      newQ.options = ["Respuesta 1|40|", "Respuesta 2|25|", "Respuesta 3|15|"];
      newQ.round = 1;
    } else if (gameType === 'jeopardy') {
      newQ.topic = "General";
      newQ.points = 200;
      newQ.value = 200;
      newQ.options = ["", "", "", ""];
      newQ.correctOption = 0;
      newQ.hint = "";
    }

    setQuestions([...questions, newQ]);
  };

  const handleRemoveQuestion = (index: number) => {
    if (questions.length <= 1) {
      setError("El cuestionario debe tener al menos una pregunta.");
      return;
    }
    const copy = [...questions];
    copy.splice(index, 1);
    setQuestions(copy);
  };

  const handleQuestionTextChange = (index: number, text: string) => {
    const copy = [...questions];
    copy[index].text = text;
    setQuestions(copy);
  };

  const handleOptionChange = (qIdx: number, oIdx: number, val: string) => {
    const copy = [...questions];
    copy[qIdx].options[oIdx] = val;
    setQuestions(copy);
  };

  const handleCorrectOptionChange = (qIdx: number, oIdx: number) => {
    const copy = [...questions];
    copy[qIdx].correctOption = oIdx;
    setQuestions(copy);
  };

  const handleTimeLimitChange = (qIdx: number, limit: number) => {
    const copy = [...questions];
    copy[qIdx].timeLimit = limit;
    setQuestions(copy);
  };

  // Exam mode changes helper
  const handleExamTypeChange = (qIdx: number, type: 'multiple_choice' | 'true_false' | 'short_answer') => {
    const copy = [...questions];
    copy[qIdx].type = type;
    if (type === 'true_false') {
      copy[qIdx].options = ["Verdadero", "Falso", "", ""];
      copy[qIdx].correctOption = 0;
    } else if (type === 'multiple_choice') {
      copy[qIdx].options = ["", "", "", ""];
      copy[qIdx].correctOption = 0;
    } else {
      copy[qIdx].options = ["", "", "", ""];
      copy[qIdx].correctOption = 0;
    }
    setQuestions(copy);
  };

  const handleExamFeedbackChange = (qIdx: number, feedback: string) => {
    const copy = [...questions];
    copy[qIdx].feedback = feedback;
    setQuestions(copy);
  };

  const handleExamShortAnswerChange = (qIdx: number, ans: string) => {
    const copy = [...questions];
    copy[qIdx].correctShortAnswer = ans;
    // Set correctOption 0 and options[0] just to sync with older schema
    copy[qIdx].options[0] = ans;
    copy[qIdx].correctOption = 0;
    setQuestions(copy);
  };

  const handleExamAlternativesChange = (qIdx: number, altsStr: string) => {
    const copy = [...questions];
    copy[qIdx].alternatives = altsStr.split(",").map(s => s.trim()).filter(Boolean);
    setQuestions(copy);
  };

  // 100 Mexicanos Dijeron helpers
  const parseMexicanosAnswers = (options: string[]) => {
    const parsed = options.map(opt => {
      if (!opt) return { text: "", points: 10, synonyms: "" };
      if (opt.includes("|")) {
        const parts = opt.split("|");
        return {
          text: parts[0]?.trim() || "",
          points: parseInt(parts[1], 10) || 10,
          synonyms: parts[2]?.trim() || ""
        };
      }
      return { text: opt.trim(), points: 10, synonyms: "" };
    });
    return parsed;
  };

  const handleMexicanosAnswerChange = (qIdx: number, ansIdx: number, field: 'text' | 'points' | 'synonyms', val: any) => {
    const copy = [...questions];
    const list = parseMexicanosAnswers(copy[qIdx].options || []);
    
    // Ensure slot exists
    while (list.length <= ansIdx) {
      list.push({ text: "", points: 10, synonyms: "" });
    }

    if (field === 'text') list[ansIdx].text = val;
    if (field === 'points') list[ansIdx].points = parseInt(val, 10) || 0;
    if (field === 'synonyms') list[ansIdx].synonyms = val;

    copy[qIdx].options = list.map(item => `${item.text}|${item.points}|${item.synonyms}`);
    setQuestions(copy);
  };

  const handleAddMexicanosAnswer = (qIdx: number) => {
    const copy = [...questions];
    const list = parseMexicanosAnswers(copy[qIdx].options || []);
    list.push({ text: "", points: 10, synonyms: "" });
    copy[qIdx].options = list.map(item => `${item.text}|${item.points}|${item.synonyms}`);
    setQuestions(copy);
  };

  const handleRemoveMexicanosAnswer = (qIdx: number, ansIdx: number) => {
    const copy = [...questions];
    const list = parseMexicanosAnswers(copy[qIdx].options || []);
    if (list.length <= 3) {
      setError("100 Estudiantes requiere al menos 3 respuestas.");
      return;
    }
    list.splice(ansIdx, 1);
    copy[qIdx].options = list.map(item => `${item.text}|${item.points}|${item.synonyms}`);
    setQuestions(copy);
  };

  // Jeopardy helpers
  const handleJeopardyFieldChange = (qIdx: number, field: 'category' | 'value' | 'answer' | 'hint', val: any) => {
    const copy = [...questions];
    if (field === 'category') {
      copy[qIdx].topic = val;
      copy[qIdx].category = val;
    } else if (field === 'value') {
      copy[qIdx].points = parseInt(val, 10) || 200;
      copy[qIdx].value = parseInt(val, 10) || 200;
    } else if (field === 'answer') {
      copy[qIdx].options[0] = val;
      copy[qIdx].correctOption = 0;
    } else if (field === 'hint') {
      copy[qIdx].hint = val;
    }
    setQuestions(copy);
  };

  const handleSave = async () => {
    setError(null);

    if (!title.trim()) {
      setError("Por favor ingresa un título para el cuestionario.");
      return;
    }

    // Comprehensive validations per game type
    if (gameType === "quiz_live") {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.text.trim()) {
          setError(`La pregunta #${i + 1} no tiene texto preguntado.`);
          return;
        }
        for (let oIdx = 0; oIdx < 4; oIdx++) {
          if (!q.options[oIdx] || !q.options[oIdx].trim()) {
            setError(`La pregunta #${i + 1} tiene vacía la opción número ${oIdx + 1}.`);
            return;
          }
        }
      }
    } else if (gameType === "exam_mode") {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.text.trim()) {
          setError(`El reactivo #${i + 1} no tiene enunciado.`);
          return;
        }
        const qType = q.type || 'multiple_choice';
        if (qType === 'multiple_choice') {
          for (let oIdx = 0; oIdx < 4; oIdx++) {
            if (!q.options[oIdx] || !q.options[oIdx].trim()) {
              setError(`El reactivo #${i + 1} (Opción Múltiple) tiene vacía la opción de respuesta #${oIdx + 1}.`);
              return;
            }
          }
        } else if (qType === 'short_answer') {
          if (!q.correctShortAnswer || !q.correctShortAnswer.trim()) {
            setError(`El reactivo #${i + 1} (Respuesta Corta) requiere especificar una respuesta correcta principal.`);
            return;
          }
        }
      }
    } else if (gameType === "mexicanos") {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.text.trim()) {
          setError(`La encuesta de 100 Estudiantes #${i + 1} no tiene pregunta.`);
          return;
        }
        const list = parseMexicanosAnswers(q.options || []);
        if (list.length < 3) {
          setError(`La encuesta de 100 Estudiantes #${i + 1} debe contener como mínimo 3 respuestas válidas.`);
          return;
        }
        if (list.length > 10) {
          setError(`La encuesta de 100 Estudiantes #${i + 1} debe contener como máximo 10 respuestas.`);
          return;
        }
        for (let ansIdx = 0; ansIdx < list.length; ansIdx++) {
          if (!list[ansIdx].text.trim()) {
            setError(`La respuesta #${ansIdx + 1} de la encuesta #${i + 1} no puede estar vacía.`);
            return;
          }
          if (list[ansIdx].points <= 0 || isNaN(list[ansIdx].points)) {
            setError(`La respuesta #${ansIdx + 1} de la encuesta #${i + 1} debe tener puntos mayores que cero.`);
            return;
          }
        }
      }
    } else if (gameType === "jeopardy") {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.topic || !q.topic.trim()) {
          setError(`La pista de Jeopardy #${i + 1} requiere especificar una Categoría.`);
          return;
        }
        if (!q.text.trim()) {
          setError(`La pista de Jeopardy #${i + 1} requiere un enunciado de Pregunta.`);
          return;
        }
        if (!q.options[0] || !q.options[0].trim()) {
          setError(`La pista de Jeopardy #${i + 1} requiere especificar la Respuesta.`);
          return;
        }
      }
    }

    setSaving(true);
    const updatedQuiz: Questionnaire = {
      id: editingQuiz?.id || "",
      title,
      description,
      questions: questions.map((q) => {
        let preparedOptions = [...q.options];
        if (gameType === 'quiz_live') {
          preparedOptions = q.options.slice(0, 4);
        } else if (gameType === 'jeopardy') {
          preparedOptions = [q.options[0] || "", "", "", ""];
        }
        
        return {
          ...q,
          id: q.id.startsWith("q_temp_") ? "q_item_" + Math.random().toString(36).substr(2, 9) : q.id,
          options: preparedOptions,
          points: q.points || (gameType === 'jeopardy' ? q.value : 1000)
        };
      }),
      createdAt: editingQuiz?.createdAt || new Date().toISOString(),
      game_type: gameType
    };

    try {
      const response = await fetch("/api/questionnaires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedQuiz)
      });

      if (response.ok) {
        onSaved();
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Ocurrió un error al guardar.");
      }
    } catch (err) {
      setError("No se pudo conectar con el servidor local para guardar el cuestionario.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 sm:p-8 bg-white text-slate-800 rounded-3xl shadow-xl border border-slate-200" id="quiz-editor-root">
      
      {/* Header operations */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 border-b border-slate-100 pb-5 gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors duration-150 py-2 px-3 rounded-lg hover:bg-slate-50 cursor-pointer text-xs font-bold self-start md:self-auto"
          id="btn-editor-back"
        >
          <ArrowLeft size={16} />
          <span>Volver al Panel</span>
        </button>
        <h2 className="text-xl sm:text-2xl font-extrabold font-sans text-slate-900" id="editor-title-header">
          {editingQuiz ? "Editar Cuestionario" : "Crear Cuestionario"}
        </h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold font-sans tracking-wide py-2.5 px-5 rounded-xl shadow-md transition-transform active:scale-[0.98] disabled:opacity-50 cursor-pointer text-xs sm:text-sm self-end md:self-auto"
          id="btn-editor-save"
        >
          <Save size={16} />
          <span>{saving ? "Guardando..." : "Guardar Banco"}</span>
        </button>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-800 animate-shake" id="editor-error-banner">
          <AlertCircle className="shrink-0 mt-0.5 text-rose-500" size={18} />
          <span className="text-sm font-sans font-semibold">{error}</span>
        </div>
      )}

      {/* Select Banco mode */}
      <div className="mb-6 bg-indigo-50 border border-indigo-100 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h4 className="text-sm font-bold text-slate-800">Tipo de Banco Independiente</h4>
          <p className="text-xs text-slate-500 mt-0.5">Define adónde pertenecerá este set de preguntas y su formato específico.</p>
        </div>
        <select
          value={gameType}
          onChange={(e) => handleGameTypeChange(e.target.value as any)}
          className="bg-white border border-indigo-200 text-slate-800 font-extrabold text-xs px-4 py-2.5 rounded-xl outline-none cursor-pointer shadow-xs focus:ring-2 focus:ring-indigo-400 w-full md:w-auto"
          id="select-editor-game-type"
        >
          <option value="quiz_live">Quiz Live 🎯</option>
          <option value="exam_mode">Modo Examen 📝</option>
          <option value="mexicanos">100 Estudiantes Dijeron 🧑‍🎓</option>
          <option value="jeopardy">Jeopardy 🏆</option>
        </select>
      </div>

      {/* Basic Quiz Info wrapper */}
      <div className="space-y-4 mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-200/80" id="quiz-basic-section">
        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">Título del Cuestionario</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. Ciencias Naturales — El Cuerpo Humano"
            className="w-full bg-white border border-slate-250 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-slate-800 font-bold outline-none transition-colors shadow-sm text-sm"
            id="input-quiz-title"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">Descripción o Temario (opcional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej. Unidad didáctica del aparato locomotor y los órganos principales."
            rows={2}
            className="w-full bg-white border border-slate-250 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-slate-700 outline-none transition-colors resize-none shadow-sm font-medium text-xs sm:text-sm"
            id="input-quiz-desc"
          />
        </div>
      </div>

      {/* Questions Stack */}
      <div className="space-y-8" id="questions-list-section">
        <div className="flex justify-between items-center border-b border-slate-200 pb-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Preguntas del Banco</h3>
          <span className="text-xs bg-indigo-55 bg-slate-100 text-slate-700 px-3 py-1 rounded-full border border-slate-200 font-bold">{questions.length} reactivos</span>
        </div>
        
        {questions.map((q, qIdx) => {
          // Mexicanos Answers parsed locally as state representation
          const mxAnswers = gameType === 'mexicanos' ? parseMexicanosAnswers(q.options || []) : [];
          
          return (
            <div key={q.id || qIdx} className="bg-slate-50/50 border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-5 relative shadow-sm" id={`question-card-${qIdx}`}>
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <span className="bg-white text-indigo-700 font-extrabold text-xs px-3.5 py-1 rounded-full border border-slate-200 shadow-xs">
                  Reactivo #{qIdx + 1}
                </span>
                
                <div className="flex items-center gap-3">
                  {/* Topic descriptor for Live / Exams */}
                  {gameType !== 'jeopardy' && (
                    <input
                      type="text"
                      placeholder="Tema..."
                      value={q.topic || ""}
                      onChange={(e) => {
                        const copy = [...questions];
                        copy[qIdx].topic = e.target.value;
                        setQuestions(copy);
                      }}
                      className="bg-white text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none font-bold w-24 sm:w-32 focus:border-indigo-400"
                    />
                  )}

                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
                    <Clock className="text-amber-500 shrink-0" size={15} />
                    <select
                      value={q.timeLimit}
                      onChange={(e) => handleTimeLimitChange(qIdx, Number(e.target.value))}
                      className="bg-transparent text-xs text-slate-700 outline-none font-bold cursor-pointer font-sans"
                      id={`select-time-${qIdx}`}
                    >
                      <option value="5">5 seg</option>
                      <option value="10">10 seg</option>
                      <option value="15">15 seg</option>
                      <option value="20">20 seg</option>
                      <option value="30">30 seg</option>
                      <option value="60">60 seg</option>
                    </select>
                  </div>
                  
                  <button
                    onClick={() => handleRemoveQuestion(qIdx)}
                    className="text-rose-600 hover:text-rose-700 bg-white hover:bg-rose-50 p-2 rounded-xl transition-colors border border-slate-200 cursor-pointer shadow-xs"
                    title="Eliminar pregunta"
                    id={`btn-delete-q-${qIdx}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Form rendering according to select bank type */}
              
              {/* === QUIZ LIVE === */}
              {gameType === 'quiz_live' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">Enunciado o Pregunta</label>
                    <input
                      type="text"
                      value={q.text}
                      onChange={(e) => handleQuestionTextChange(qIdx, e.target.value)}
                      placeholder="Escribe la consulta evaluativa aquí..."
                      className="w-full bg-white border border-slate-250 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-slate-800 font-bold outline-none transition-colors shadow-sm text-xs sm:text-sm"
                      id={`input-q-text-${qIdx}`}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-2">Alternativas e Indicar Correcta (Rellenar las 4 obligatoriamente)</label>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Option 0 */}
                      <div className={`p-2 rounded-xl border transition-all ${q.correctOption === 0 ? "bg-rose-50/50 border-rose-500 shadow-sm" : "bg-white border-slate-200"}`}>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCorrectOptionChange(qIdx, 0)}
                            className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${q.correctOption === 0 ? "bg-rose-500 text-white" : "bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-400"}`}
                          >
                            {q.correctOption === 0 ? <Check size={14} className="stroke-[3]" /> : <span className="text-xs font-mono font-bold">▲</span>}
                          </button>
                          <input
                            type="text"
                            value={q.options[0]}
                            onChange={(e) => handleOptionChange(qIdx, 0, e.target.value)}
                            placeholder="Respuesta alternativa A (Roja)..."
                            className="w-full bg-transparent text-xs text-slate-800 font-bold border-0 outline-none py-1 placeholder-slate-400"
                          />
                        </div>
                      </div>

                      {/* Option 1 */}
                      <div className={`p-2 rounded-xl border transition-all ${q.correctOption === 1 ? "bg-blue-50/50 border-blue-500 shadow-sm" : "bg-white border-slate-200"}`}>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCorrectOptionChange(qIdx, 1)}
                            className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${q.correctOption === 1 ? "bg-blue-500 text-white" : "bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-400"}`}
                          >
                            {q.correctOption === 1 ? <Check size={14} className="stroke-[3]" /> : <span className="text-xs font-mono font-bold">◆</span>}
                          </button>
                          <input
                            type="text"
                            value={q.options[1]}
                            onChange={(e) => handleOptionChange(qIdx, 1, e.target.value)}
                            placeholder="Respuesta alternativa B (Azul)..."
                            className="w-full bg-transparent text-xs text-slate-800 font-bold border-0 outline-none py-1 placeholder-slate-400"
                          />
                        </div>
                      </div>

                      {/* Option 2 */}
                      <div className={`p-2 rounded-xl border transition-all ${q.correctOption === 2 ? "bg-amber-50/50 border-amber-500 shadow-sm" : "bg-white border-slate-200"}`}>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCorrectOptionChange(qIdx, 2)}
                            className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${q.correctOption === 2 ? "bg-amber-500 text-white" : "bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-400"}`}
                          >
                            {q.correctOption === 2 ? <Check size={14} className="stroke-[3]" /> : <span className="text-xs font-mono font-bold">●</span>}
                          </button>
                          <input
                            type="text"
                            value={q.options[2]}
                            onChange={(e) => handleOptionChange(qIdx, 2, e.target.value)}
                            placeholder="Respuesta alternativa C (Amarilla)..."
                            className="w-full bg-transparent text-xs text-slate-800 font-bold border-0 outline-none py-1 placeholder-slate-400"
                          />
                        </div>
                      </div>

                      {/* Option 3 */}
                      <div className={`p-2 rounded-xl border transition-all ${q.correctOption === 3 ? "bg-emerald-50/50 border-emerald-500 shadow-sm" : "bg-white border-slate-200"}`}>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCorrectOptionChange(qIdx, 3)}
                            className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${q.correctOption === 3 ? "bg-emerald-500 text-white" : "bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-400"}`}
                          >
                            {q.correctOption === 3 ? <Check size={14} className="stroke-[3]" /> : <span className="text-xs font-mono font-bold">■</span>}
                          </button>
                          <input
                            type="text"
                            value={q.options[3]}
                            onChange={(e) => handleOptionChange(qIdx, 3, e.target.value)}
                            placeholder="Respuesta alternativa D (Verde)..."
                            className="w-full bg-transparent text-xs text-slate-800 font-bold border-0 outline-none py-1 placeholder-slate-400"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* === MODO EXAMEN === */}
              {gameType === 'exam_mode' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">Tipo de Reactivo</label>
                      <select
                        value={q.type || 'multiple_choice'}
                        onChange={(e) => handleExamTypeChange(qIdx, e.target.value as any)}
                        className="w-full bg-white border border-slate-200 text-xs font-bold px-3 py-2.5 rounded-xl outline-none"
                      >
                        <option value="multiple_choice">Opción Múltiple (4 alternativas)</option>
                        <option value="true_false">Verdadero / Falso</option>
                        <option value="short_answer">Respuesta Corta</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">Puntos del Reactivo</label>
                      <input
                        type="number"
                        min="1"
                        value={q.points || 1}
                        onChange={(e) => {
                          const copy = [...questions];
                          copy[qIdx].points = parseInt(e.target.value, 10) || 1;
                          setQuestions(copy);
                        }}
                        className="w-full bg-white border border-slate-200 text-xs font-bold px-3 py-2.5 rounded-xl outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">Pregunta o Enunciado</label>
                    <input
                      type="text"
                      value={q.text}
                      onChange={(e) => handleQuestionTextChange(qIdx, e.target.value)}
                      placeholder="Mencione el enunciado de evaluación..."
                      className="w-full bg-white border border-slate-250 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-slate-800 font-bold outline-none text-xs sm:text-sm"
                    />
                  </div>

                  {/* Multiple Choice specific sub-fields */}
                  {(q.type === 'multiple_choice' || !q.type) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className={`p-2 rounded-xl border transition-all ${q.correctOption === oIdx ? "bg-emerald-50/50 border-emerald-500" : "bg-white border-slate-200"}`}>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCorrectOptionChange(qIdx, oIdx)}
                              className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${q.correctOption === oIdx ? "bg-emerald-500 text-white" : "bg-slate-150 hover:bg-slate-200 text-slate-400"}`}
                            >
                              {q.correctOption === oIdx ? <Check size={14} /> : <span className="text-[10px] font-bold font-mono">{oIdx + 1}</span>}
                            </button>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => handleOptionChange(qIdx, oIdx, e.target.value)}
                              placeholder={`Escribe la opción ${oIdx + 1}...`}
                              className="w-full bg-transparent text-xs text-slate-800 font-bold outline-none py-1"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* True False specific */}
                  {q.type === 'true_false' && (
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => handleCorrectOptionChange(qIdx, 0)}
                        className={`flex-1 py-3 border rounded-xl text-xs font-bold transition-all ${q.correctOption === 0 ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-slate-250 hover:bg-slate-50 text-slate-700"}`}
                      >
                        Verdadero (Correcto)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCorrectOptionChange(qIdx, 1)}
                        className={`flex-1 py-3 border rounded-xl text-xs font-bold transition-all ${q.correctOption === 1 ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-slate-250 hover:bg-slate-50 text-slate-700"}`}
                      >
                        Falso (Correcto)
                      </button>
                    </div>
                  )}

                  {/* Short Answer specific */}
                  {q.type === 'short_answer' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">Respuesta Correcta Sugerida</label>
                          <input
                            type="text"
                            value={q.correctShortAnswer || ""}
                            onChange={(e) => handleExamShortAnswerChange(qIdx, e.target.value)}
                            placeholder="Ej. Metano"
                            className="w-full bg-white border border-slate-200 text-xs font-bold px-3 py-2 rounded-xl outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">Alternativas aceptadas (separadas por comas)</label>
                          <input
                            type="text"
                            value={q.alternatives?.join(", ") || ""}
                            onChange={(e) => handleExamAlternativesChange(qIdx, e.target.value)}
                            placeholder="Ej. metano, ch4, gas metano"
                            className="w-full bg-white border border-slate-200 text-xs font-bold px-3 py-2 rounded-xl outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Feedback field */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">Retroalimentación / Explicación del Reactivo (Opcional)</label>
                    <input
                      type="text"
                      value={q.feedback || ""}
                      onChange={(e) => handleExamFeedbackChange(qIdx, e.target.value)}
                      placeholder="Muestra esta explicación al estudiante cuando responda de forma incorrecta para incentivar el aprendizaje."
                      className="w-full bg-white border border-slate-250 rounded-xl px-4 py-2 text-slate-750 font-medium outline-none text-xs"
                    />
                  </div>
                </div>
              )}

              {/* === 100 ESTUDIANTES DIJERON === */}
              {gameType === 'mexicanos' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">Pregunta o Planteamiento</label>
                      <input
                        type="text"
                        value={q.text}
                        onChange={(e) => handleQuestionTextChange(qIdx, e.target.value)}
                        placeholder="Menciona cosas que llevas a la playa..."
                        className="w-full bg-white border border-slate-250 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-slate-800 font-bold outline-none text-xs sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">Ronda Activa</label>
                      <select
                        value={q.round || 1}
                        onChange={(e) => {
                          const copy = [...questions];
                          copy[qIdx].round = parseInt(e.target.value, 10) || 1;
                          setQuestions(copy);
                        }}
                        className="w-full bg-white border border-slate-250 rounded-xl px-4 py-2.5 text-xs font-bold outline-none cursor-pointer"
                      >
                        <option value="1">Ronda 1 (Puntos sencillos)</option>
                        <option value="2">Ronda 2 (Puntos duplicados)</option>
                        <option value="3">Ronda 3 (Puntos triplicados)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500">Respuestas del Tablero (Mínimo 3, Máximo 10)</label>
                      {mxAnswers.length < 10 && (
                        <button
                          type="button"
                          onClick={() => handleAddMexicanosAnswer(qIdx)}
                          className="text-[10px] text-indigo-700 font-extrabold hover:underline"
                        >
                          + Añadir Respuesta
                        </button>
                      )}
                    </div>

                    <div className="space-y-2.5">
                      {mxAnswers.map((ans, aIdx) => (
                        <div key={aIdx} className="bg-white border border-slate-200 p-3 rounded-xl flex flex-col sm:flex-row items-center gap-3">
                          <span className="text-xs font-extrabold text-slate-400 font-mono">#{aIdx + 1}</span>
                          <input
                            type="text"
                            placeholder="Respuesta visible en tablero (Ej. Toalla)"
                            value={ans.text}
                            onChange={(e) => handleMexicanosAnswerChange(qIdx, aIdx, 'text', e.target.value)}
                            className="bg-transparent text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1 flex-1 w-full"
                          />
                          <input
                            type="number"
                            placeholder="Puntos"
                            value={ans.points}
                            onChange={(e) => handleMexicanosAnswerChange(qIdx, aIdx, 'points', e.target.value)}
                            className="bg-slate-50 text-xs font-mono font-bold outline-none rounded border border-slate-200 text-center w-20 py-1"
                          />
                          <input
                            type="text"
                            placeholder="Sinónimos/Alternativas separados por comas (Ej. toallas, sabana playera)"
                            value={ans.synonyms}
                            onChange={(e) => handleMexicanosAnswerChange(qIdx, aIdx, 'synonyms', e.target.value)}
                            className="bg-transparent text-[11px] outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1 flex-1 w-full text-slate-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveMexicanosAnswer(qIdx, aIdx)}
                            className="text-rose-500 hover:text-rose-600 disabled:opacity-20 self-end sm:self-auto cursor-pointer"
                            disabled={mxAnswers.length <= 3}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* === JEOPARDY === */}
              {gameType === 'jeopardy' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">Categoría (Topic)</label>
                      <input
                        type="text"
                        value={q.topic || ""}
                        onChange={(e) => handleJeopardyFieldChange(qIdx, 'category', e.target.value)}
                        placeholder="Ej. Geografía, Historia, Química..."
                        className="w-full bg-white border border-slate-250 focus:border-indigo-500 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">Valor (Puntos)</label>
                      <select
                        value={q.points || 200}
                        onChange={(e) => handleJeopardyFieldChange(qIdx, 'value', e.target.value)}
                        className="w-full bg-white border border-slate-250 rounded-xl px-4 py-2 text-xs font-bold outline-none cursor-pointer"
                      >
                        <option value="200">200 puntos</option>
                        <option value="400">400 puntos</option>
                        <option value="600">600 puntos</option>
                        <option value="800">800 puntos</option>
                        <option value="1000">1000 puntos</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">Pista opcional (Para ver antes de la pregunta)</label>
                      <input
                        type="text"
                        value={q.hint || ""}
                        onChange={(e) => handleJeopardyFieldChange(qIdx, 'hint', e.target.value)}
                        placeholder="Ej. Es una molécula formada por hidrógeno y oxígeno."
                        className="w-full bg-white border border-slate-250 rounded-xl px-4 py-2 text-xs outline-none font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">Clue / Pregunta</label>
                      <input
                        type="text"
                        value={q.text}
                        onChange={(e) => handleQuestionTextChange(qIdx, e.target.value)}
                        placeholder="Ej. ¿Cuál es el principal gas de efecto invernadero?"
                        className="w-full bg-white border border-slate-250 focus:border-indigo-500 rounded-xl px-4 py-2 text-xs sm:text-sn outline-none font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">Respuesta</label>
                      <input
                        type="text"
                        value={q.options[0] || ""}
                        onChange={(e) => handleJeopardyFieldChange(qIdx, 'answer', e.target.value)}
                        placeholder="Ej. Dióxido de carbono"
                        className="w-full bg-white border border-slate-250 focus:border-indigo-500 rounded-xl px-4 py-2 text-xs sm:text-sn outline-none font-bold text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 border-t border-slate-100 pt-6 flex justify-center">
        <button
          onClick={handleAddQuestion}
          className="flex items-center gap-2 bg-slate-150 hover:bg-slate-200 text-indigo-705 text-indigo-600 py-3.5 px-6 rounded-2xl font-bold border border-slate-200 transition-all hover:shadow-xs cursor-pointer text-xs"
          id="btn-add-question"
        >
          <Plus size={18} />
          <span>Añadir Reactivo</span>
        </button>
      </div>

    </div>
  );
}
