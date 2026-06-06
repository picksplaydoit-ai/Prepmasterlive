import React, { useState, useEffect } from "react";
import { Plus, Trash2, Save, ArrowLeft, Clock, Check, AlertCircle } from "lucide-react";
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
  const [questions, setQuestions] = useState<Question[]>([
    { ...DEFAULT_QUESTION, id: "q_temp_1" }
  ]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingQuiz) {
      setTitle(editingQuiz.title);
      setDescription(editingQuiz.description);
      setQuestions(editingQuiz.questions.length > 0 ? editingQuiz.questions : [{ ...DEFAULT_QUESTION, id: "q_temp_1" }]);
    } else {
      setTitle("");
      setDescription("");
      setQuestions([{ ...DEFAULT_QUESTION, id: "q_temp_1" }]);
    }
  }, [editingQuiz]);

  const handleAddQuestion = () => {
    const newQ: Question = {
      id: "q_temp_" + Date.now(),
      text: "",
      options: ["", "", "", ""],
      correctOption: 0,
      timeLimit: 20
    };
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

  const handleSave = async () => {
    setError(null);

    if (!title.trim()) {
      setError("Por favor ingresa un título para el cuestionario.");
      return;
    }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) {
        setError(`La pregunta #${i + 1} no tiene texto preguntado.`);
        return;
      }
      for (let oIdx = 0; oIdx < 4; oIdx++) {
        if (!q.options[oIdx].trim()) {
          setError(`La pregunta #${i + 1} tiene vacía la opción número ${oIdx + 1}.`);
          return;
        }
      }
    }

    setSaving(true);
    const updatedQuiz: Questionnaire = {
      id: editingQuiz?.id || "",
      title,
      description,
      questions: questions.map((q) => ({
        ...q,
        id: q.id.startsWith("q_temp_") ? "q_item_" + Math.random().toString(36).substr(2, 9) : q.id
      })),
      createdAt: editingQuiz?.createdAt || new Date().toISOString()
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
      setError("No se pudo conectar con el servidor local.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 sm:p-8 bg-white text-slate-800 rounded-3xl shadow-xl border border-slate-200" id="quiz-editor-root">
      
      {/* Header operations */}
      <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors duration-150 py-2 px-3 rounded-lg hover:bg-slate-50 cursor-pointer text-xs font-bold"
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
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold font-sans tracking-wide py-2.5 px-5 rounded-xl shadow-md transition-transform active:scale-[0.98] disabled:opacity-50 cursor-pointer text-xs sm:text-sm"
          id="btn-editor-save"
        >
          <Save size={16} />
          <span>{saving ? "Guardando..." : "Guardar"}</span>
        </button>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-800 animate-shake" id="editor-error-banner">
          <AlertCircle className="shrink-0 mt-0.5 text-rose-500" size={18} />
          <span className="text-sm font-sans font-semibold">{error}</span>
        </div>
      )}

      {/* Basic Quiz Info wrapper */}
      <div className="space-y-4 mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-200/80" id="quiz-basic-section">
        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">Título del Cuestionario</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. Ciencias Naturales — El Cuerpo Humano"
            className="w-full bg-white border border-slate-250 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-slate-800 font-bold outline-none transition-colors shadow-sm"
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
            className="w-full bg-white border border-slate-250 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-slate-700 outline-none transition-colors resize-none shadow-sm font-medium"
            id="input-quiz-desc"
          />
        </div>
      </div>

      {/* Questions Stack */}
      <div className="space-y-8" id="questions-list-section">
        <div className="flex justify-between items-center border-b border-slate-200 pb-2">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-400">Banco de Preguntas</h3>
          <span className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-100 font-bold">{questions.length} preguntas en total</span>
        </div>
        
        {questions.map((q, qIdx) => (
          <div key={q.id || qIdx} className="bg-slate-50/50 border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-5 relative shadow-sm" id={`question-card-${qIdx}`}>
            <div className="flex items-center justify-between">
              <span className="bg-white text-indigo-700 font-bold text-xs px-3.5 py-1 rounded-full border border-slate-200 shadow-sm">
                Pregunta #{qIdx + 1}
              </span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                  <Clock className="text-amber-500" size={15} />
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
                  className="text-rose-600 hover:text-rose-700 bg-white hover:bg-rose-50 p-2 rounded-xl transition-colors border border-slate-200 cursor-pointer shadow-sm"
                  title="Eliminar pregunta"
                  id={`btn-delete-q-${qIdx}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            {/* Question title textfield */}
            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">Enunciado o Pregunta</label>
              <input
                type="text"
                value={q.text}
                onChange={(e) => handleQuestionTextChange(qIdx, e.target.value)}
                placeholder="Escribe la consulta evaluativa aquí..."
                className="w-full bg-white border border-slate-250 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-slate-800 font-bold outline-none transition-colors shadow-sm"
                id={`input-q-text-${qIdx}`}
              />
            </div>

            {/* Answer select deck in grid */}
            <div className="space-y-2">
              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-2">Alternativas e Indicar Correcta (Rellenar las 4 obligatoriamente)</label>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Option 0 - Rose */}
                <div className={`p-2 rounded-xl border transition-all ${q.correctOption === 0 ? "bg-rose-50/50 border-rose-500 shadow-sm" : "bg-white border-slate-200"}`} id={`option-container-${qIdx}-0`}>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCorrectOptionChange(qIdx, 0)}
                      className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${q.correctOption === 0 ? "bg-rose-500 text-white" : "bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-400"}`}
                      id={`btn-correct-${qIdx}-0`}
                    >
                      {q.correctOption === 0 ? <Check size={14} className="stroke-[3]" /> : <span className="text-xs font-mono font-bold">▲</span>}
                    </button>
                    <input
                      type="text"
                      value={q.options[0]}
                      onChange={(e) => handleOptionChange(qIdx, 0, e.target.value)}
                      placeholder="Respuesta alternativa A (Roja)..."
                      className="w-full bg-transparent text-xs text-slate-800 font-bold border-0 outline-none py-1 placeholder-slate-400"
                      id={`input-option-${qIdx}-0`}
                    />
                  </div>
                </div>

                {/* Option 1 - Blue */}
                <div className={`p-2 rounded-xl border transition-all ${q.correctOption === 1 ? "bg-blue-50/50 border-blue-500 shadow-sm" : "bg-white border-slate-200"}`} id={`option-container-${qIdx}-1`}>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCorrectOptionChange(qIdx, 1)}
                      className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${q.correctOption === 1 ? "bg-blue-500 text-white" : "bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-400"}`}
                      id={`btn-correct-${qIdx}-1`}
                    >
                      {q.correctOption === 1 ? <Check size={14} className="stroke-[3]" /> : <span className="text-xs font-mono font-bold">◆</span>}
                    </button>
                    <input
                      type="text"
                      value={q.options[1]}
                      onChange={(e) => handleOptionChange(qIdx, 1, e.target.value)}
                      placeholder="Respuesta alternativa B (Azul)..."
                      className="w-full bg-transparent text-xs text-slate-800 font-bold border-0 outline-none py-1 placeholder-slate-400"
                      id={`input-option-${qIdx}-1`}
                    />
                  </div>
                </div>

                {/* Option 2 - Amber */}
                <div className={`p-2 rounded-xl border transition-all ${q.correctOption === 2 ? "bg-amber-50/50 border-amber-500 shadow-sm" : "bg-white border-slate-200"}`} id={`option-container-${qIdx}-2`}>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCorrectOptionChange(qIdx, 2)}
                      className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${q.correctOption === 2 ? "bg-amber-500 text-white" : "bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-400"}`}
                      id={`btn-correct-${qIdx}-2`}
                    >
                      {q.correctOption === 2 ? <Check size={14} className="stroke-[3]" /> : <span className="text-xs font-mono font-bold">●</span>}
                    </button>
                    <input
                      type="text"
                      value={q.options[2]}
                      onChange={(e) => handleOptionChange(qIdx, 2, e.target.value)}
                      placeholder="Respuesta alternativa C (Amarilla)..."
                      className="w-full bg-transparent text-xs text-slate-800 font-bold border-0 outline-none py-1 placeholder-slate-400"
                      id={`input-option-${qIdx}-2`}
                    />
                  </div>
                </div>

                {/* Option 3 - Emerald */}
                <div className={`p-2 rounded-xl border transition-all ${q.correctOption === 3 ? "bg-emerald-50/50 border-emerald-500 shadow-sm" : "bg-white border-slate-200"}`} id={`option-container-${qIdx}-3`}>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCorrectOptionChange(qIdx, 3)}
                      className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${q.correctOption === 3 ? "bg-emerald-500 text-white" : "bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-400"}`}
                      id={`btn-correct-${qIdx}-3`}
                    >
                      {q.correctOption === 3 ? <Check size={14} className="stroke-[3]" /> : <span className="text-xs font-mono font-bold">■</span>}
                    </button>
                    <input
                      type="text"
                      value={q.options[3]}
                      onChange={(e) => handleOptionChange(qIdx, 3, e.target.value)}
                      placeholder="Respuesta alternativa D (Verde)..."
                      className="w-full bg-transparent text-xs text-slate-800 font-bold border-0 outline-none py-1 placeholder-slate-400"
                      id={`input-option-${qIdx}-3`}
                    />
                  </div>
                </div>

              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 border-t border-slate-100 pt-6 flex justify-center">
        <button
          onClick={handleAddQuestion}
          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-indigo-700 py-3.5 px-6 rounded-2xl font-bold border border-slate-200 transition-all hover:shadow-sm cursor-pointer text-xs"
          id="btn-add-question"
        >
          <Plus size={18} />
          <span>Añadir Pregunta</span>
        </button>
      </div>

    </div>
  );
}
