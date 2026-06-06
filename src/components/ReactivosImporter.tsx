import React, { useState, useEffect } from "react";
import { 
  Plus, Trash2, Edit3, Save, ArrowLeft, Clock, Check, 
  AlertCircle, UploadCloud, FileText, CheckCircle2, 
  Trash, X, RefreshCw, Sparkles, FileSpreadsheet, ListPlus, HelpCircle
} from "lucide-react";
import { Question, Questionnaire } from "../types";
import * as XLSX from "xlsx";
import Papa from "papaparse";

interface ReactivosImporterProps {
  onBack: () => void;
  onSaved: () => void;
}

interface TempQuestion {
  localId: string;
  text: string;
  options: string[];
  correctOption: number;
  timeLimit: number;
  points: number;
  topic: string;
  error?: string;
  isValid: boolean;
}

export default function ReactivosImporter({ onBack, onSaved }: ReactivosImporterProps) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Download official templates offline
  const downloadXLSXTemplate = () => {
    const headers = [
      "pregunta", 
      "opcion_a", 
      "opcion_b", 
      "opcion_c", 
      "opcion_d", 
      "respuesta", 
      "tiempo", 
      "puntos", 
      "tema"
    ];
    
    const rows = [
      [
        "¿De qué color es el residuo tóxico reactivo en la industria?", 
        "Rosa", 
        "Celeste", 
        "Amarillo", 
        "Verde", 
        "C", 
        30, 
        1000, 
        "Seguridad industrial"
      ],
      [
        "¿Cuál de las siguientes es una fuente de energía renovable?", 
        "Carbón Coque", 
        "Petróleo crudo", 
        "Gas licuado de petróleo o natural", 
        "Energía solar fotovoltaica", 
        "D", 
        20, 
        800, 
        "Desarrollo sustentable"
      ],
      [
        "¿Cuál es el resultado de resolver 15 * 6?", 
        "80", 
        "90", 
        "105", 
        "75", 
        "B", 
        45, 
        1000, 
        "Matemáticas"
      ],
      [
        "¿Qué Ley física fundamental establece que a toda fuerza de acción le corresponde una de reacción opuesta?", 
        "Primera ley de movimiento de Newton", 
        "Segunda ley de proporcionalidad", 
        "Tercera ley de correspondencia mecánica", 
        "Ley de gravedad clásica", 
        "C", 
        30, 
        1200, 
        "Física"
      ],
      [
        "¿Cuál de las siguientes fórmulas químicas representa correctamente la molécula inorgánica del agua?", 
        "CO2", 
        "H2O", 
        "NaCl", 
        "O2", 
        "B", 
        30, 
        1000, 
        "Química"
      ]
    ];

    const data = [headers, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reactivos");
    
    const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla_reactivos_prepmaster.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadCSVTemplate = () => {
    const headers = [
      "pregunta", 
      "opcion_a", 
      "opcion_b", 
      "opcion_c", 
      "opcion_d", 
      "respuesta", 
      "tiempo", 
      "puntos", 
      "tema"
    ];
    const rows = [
      [
        "¿De qué color es el residuo tóxico reactivo en la industria?", 
        "Rosa", 
        "Celeste", 
        "Amarillo", 
        "Verde", 
        "C", 
        "30", 
        "1000", 
        "Seguridad industrial"
      ],
      [
        "¿Cuál de las siguientes es una fuente de energía renovable?", 
        "Carbón Coque", 
        "Petróleo crudo", 
        "Gas licuado de petróleo o natural", 
        "Energía solar fotovoltaica", 
        "D", 
        "20", 
        "800", 
        "Desarrollo sustentable"
      ],
      [
        "¿Cuál es el resultado de resolver 15 * 6?", 
        "80", 
        "90", 
        "105", 
        "75", 
        "B", 
        "45", 
        "1000", 
        "Matemáticas"
      ],
      [
        "¿Qué Ley física fundamental establece que a toda fuerza de acción le corresponde una de reacción opuesta?", 
        "Primera ley de movimiento de Newton", 
        "Segunda ley de proporcionalidad", 
        "Tercera ley de correspondencia mecánica", 
        "Ley de gravedad clásica", 
        "C", 
        "30", 
        "1200", 
        "Física"
      ],
      [
        "¿Cuál de las siguientes fórmulas químicas representa correctamente la molécula inorgánica del agua?", 
        "CO2", 
        "H2O", 
        "NaCl", 
        "O2", 
        "B", 
        "30", 
        "1000", 
        "Química"
      ]
    ];
    
    const csvContent = Papa.unparse({
      fields: headers,
      data: rows
    });
    
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla_reactivos_prepmaster.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadTXTTemplate = () => {
    const content = `Pregunta:
¿Cuál de las siguientes fórmulas químicas representa correctamente la molécula inorgánica del agua?
A) CO2
B) H2O
C) NaCl
D) O2
Respuesta: B
Tiempo: 30
Puntos: 1000
Tema: Química

Pregunta:
¿Cuál es el resultado de resolver 15 * 6?
A) 80
B) 90
C) 105
D) 75
Respuesta: B
Tiempo: 45
Puntos: 1000
Tema: Matemáticas

Pregunta:
¿Cuál de las siguientes es una fuente de energía renovable?
A) Carbón Coque
B) Petróleo crudo
C) Gas licuado de petróleo o natural
D) Energía solar fotovoltaica
Respuesta: D
Tiempo: 20
Puntos: 800
Tema: Desarrollo sustentable

Pregunta:
¿De qué color es el residuo tóxico reactivo en la industria?
A) Rosa
B) Celeste
C) Amarillo
D) Verde
Respuesta: C
Tiempo: 30
Puntos: 1000
Tema: Seguridad industrial

Pregunta:
¿Qué Ley física fundamental establece que a toda fuerza de acción le corresponde una de reacción opuesta?
A) Primera ley de movimiento de Newton
B) Segunda ley de proporcionalidad
C) Tercera ley de correspondencia mecánica
D) Ley de gravedad clásica
Respuesta: C
Tiempo: 30
Puntos: 1200
Tema: Física`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla_reactivos_prepmaster.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<'file' | 'pasted'>('file');
  const [pastedText, setPastedText] = useState("");

  const handleLoadSample = () => {
    setPastedText(`¿Cuál es la fórmula del agua?
A) CO2
B) H2O
C) NaCl
D) O2
Respuesta: B
Tiempo: 30
Puntos: 1000
Tema: Química

Pregunta:
¿Qué estudia la toxicología de alimentos?
A) Nutrición
B) Efectos nocivos de sustancias químicas
C) Microbiología
D) Gastronomía
Respuesta: B
Tiempo: 30
Puntos: 1000
Tema: Toxicología

1. ¿De qué color es el residuo tóxico reactivo en la industria?
A) Rosa
B) Celeste
C) Amarillo
D) Verde
Respuesta: C
Tiempo: 20
Puntos: 800
Tema: Seguridad industrial`);
  };

  const handleClearPastedText = () => {
    setPastedText("");
    setQuestions([]);
    setUploadError(null);
  };

  const handleAnalyzePastedText = async () => {
    setUploadError(null);
    setQuestions([]);
    if (!pastedText.trim()) {
      setUploadError("Por favor ingresa un fragmento de texto para analizar.");
      return;
    }

    setParsing(true);
    try {
      const response = await fetch("/api/parse-pasted-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pastedText })
      });

      if (response.ok) {
        const resData = await response.json();
        if (resData.success && resData.questions) {
          const mapped: TempQuestion[] = resData.questions.map((q: any, index: number) => ({
            ...q,
            localId: `tq_${Date.now()}_${index}`
          }));
          setQuestions(mapped);
          if (mapped.length === 0) {
            setUploadError("No se pudieron identificar reactivos en el texto ingresado. Compara el texto con el ejemplo para asegurar formato compatible.");
          }
        } else {
          setUploadError(resData.error || "Ocurrió un error interpretando el texto pegado.");
        }
      } else {
        const errBody = await response.json();
        setUploadError(errBody.error || "Error del servidor al procesar el texto.");
      }
    } catch (err) {
      setUploadError("No se pudo conectar al endpoint de parseo de texto.");
    } finally {
      setParsing(false);
    }
  };

  // List of parsed questions
  const [questions, setQuestions] = useState<TempQuestion[]>([]);
  
  // Quiz save targets: 'new' | 'existing'
  const [saveMode, setSaveMode] = useState<'new' | 'existing'>('new');
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [existingQuizzes, setExistingQuizzes] = useState<Questionnaire[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState("");

  // Quiz save operation state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Editable state (if editing a specific question in preview)
  const [editingLocalId, setEditingLocalId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    text: string;
    options: string[];
    correctOption: number;
    timeLimit: number;
    points: number;
    topic: string;
  } | null>(null);

  // Fetch list of quizzes on mount to populate existing quiz dropdown
  useEffect(() => {
    fetchExistingQuizzes();
  }, []);

  const fetchExistingQuizzes = async () => {
    try {
      const res = await fetch("/api/questionnaires");
      if (res.ok) {
        const data = await res.json();
        setExistingQuizzes(data);
        if (data.length > 0) {
          setSelectedQuizId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Error al obtener cuestionarios para dropdown:", err);
    }
  };

  // Drag-and-drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Convert File to Base64 in order to send securely to parser backend
  const processFile = async (selectedFile: File) => {
    setUploadError(null);
    setQuestions([]);
    
    // Limits max size to 5 MB (5 * 1024 * 1024 bytes)
    if (selectedFile.size > 5 * 1024 * 1024) {
      setUploadError("El tamaño máximo permitido es 5 MB. Tu archivo excede este límite.");
      return;
    }

    const validExtensions = ["txt", "csv", "xlsx", "xls", "docx"];
    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    if (!ext || !validExtensions.includes(ext)) {
      setUploadError("Formato de archivo no soportado. Sube un archivo TXT, CSV, XLSX o DOCX.");
      return;
    }

    setFile(selectedFile);
    setParsing(true);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (!event.target || !event.target.result) {
          setUploadError("No se pudo leer el archivo local.");
          setParsing(false);
          return;
        }

        const arrayBuffer = event.target.result as ArrayBuffer;
        // Convert to base64
        const uint8 = new Uint8Array(arrayBuffer);
        let binaryStr = "";
        const len = uint8.length;
        // Batch conversions for speed
        const chunkSize = 65536;
        for (let i = 0; i < len; i += chunkSize) {
          const chunk = uint8.subarray(i, i + chunkSize);
          binaryStr += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const base64Data = btoa(binaryStr);

        // Call backend processing endpoint
        const response = await fetch("/api/parse-file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: selectedFile.name,
            base64Data
          })
        });

        if (response.ok) {
          const resData = await response.json();
          if (resData.success && resData.questions) {
            // Map questions with localId for layout state key synchronization
            const mapped: TempQuestion[] = resData.questions.map((q: any, index: number) => ({
              ...q,
              localId: `tq_${Date.now()}_${index}`
            }));
            setQuestions(mapped);
          } else {
            setUploadError(resData.error || "Ocurrió un error interpretando el archivo.");
          }
        } else {
          const errBody = await response.json();
          setUploadError(errBody.error || "Error del servidor al procesar el archivo.");
        }
        setParsing(false);
      };

      reader.onerror = () => {
        setUploadError("Ocurrió un error leyendo el archivo.");
        setParsing(false);
      };

      reader.readAsArrayBuffer(selectedFile);
    } catch (err) {
      setUploadError("No se pudo conectar al endpoint de parseo.");
      setParsing(false);
    }
  };

  // Delete a parsed question
  const handleDeleteParsedQuestion = (localId: string) => {
    setQuestions(questions.filter(q => q.localId !== localId));
    if (editingLocalId === localId) {
      setEditingLocalId(null);
      setEditForm(null);
    }
  };

  // Toggle Edit status for specific item
  const handleStartEdit = (q: TempQuestion) => {
    setEditingLocalId(q.localId);
    setEditForm({
      text: q.text,
      options: [...q.options],
      correctOption: q.correctOption,
      timeLimit: q.timeLimit,
      points: q.points,
      topic: q.topic
    });
  };

  const handleCancelEdit = () => {
    setEditingLocalId(null);
    setEditForm(null);
  };

  // In-place dynamic validation of edited questions
  const handleSaveEdit = (localId: string) => {
    if (!editForm) return;

    const errors: string[] = [];
    const textVal = editForm.text.trim();
    if (!textVal) {
      errors.push("El enunciado de la pregunta no puede estar vacío.");
    }

    // Count non-empty options
    const nonAmpleOptions = editForm.options.map(o => o.trim()).filter(Boolean);
    if (nonAmpleOptions.length < 2) {
      errors.push("Debe ingresar al menos 2 opciones de respuestas válidas.");
    }

    const correctIdx = editForm.correctOption;
    if (correctIdx === -1 || correctIdx >= 4 || !editForm.options[correctIdx]?.trim()) {
      errors.push("La opción correcta indicada debe apuntar a una opción con contenido.");
    }

    const updated: TempQuestion = {
      localId,
      text: textVal,
      options: editForm.options.map(o => o.trim()),
      correctOption: correctIdx,
      timeLimit: editForm.timeLimit || 30,
      points: editForm.points || 1000,
      topic: editForm.topic.trim() || "General",
      isValid: errors.length === 0,
      error: errors.length > 0 ? errors.join(" ") : undefined
    };

    setQuestions(questions.map(q => q.localId === localId ? updated : q));
    setEditingLocalId(null);
    setEditForm(null);
  };

  const handleFieldChange = (key: string, value: any) => {
    if (!editForm) return;
    setEditForm({
      ...editForm,
      [key]: value
    });
  };

  const handleOptionFieldChange = (idx: number, value: string) => {
    if (!editForm) return;
    const newOptions = [...editForm.options];
    newOptions[idx] = value;
    setEditForm({
      ...editForm,
      options: newOptions
    });
  };

  // Discard file and reset
  const handleClearFile = () => {
    setFile(null);
    setQuestions([]);
    setUploadError(null);
    setEditingLocalId(null);
    setEditForm(null);
  };

  // Final Action: Save questions into SQLite (as New or Appended)
  const handleFinalSave = async () => {
    setSaveError(null);

    // Confirm we actually have questions is validated
    if (questions.length === 0) {
      setSaveError("No hay preguntas detectadas para importar. Por favor sube un archivo válido.");
      return;
    }

    // Filter valid list
    const validQuestions = questions.filter(q => q.isValid);
    if (validQuestions.length === 0) {
      setSaveError("Ninguna de las preguntas detectadas es completamente válida. Corrige los errores o elimina los reactivos incorrectos.");
      return;
    }

    setSaving(true);

    try {
      let targetQuizId = "";
      let finalTitle = "";
      let finalDesc = "";
      let finalQuestionsList: Question[] = [];
      let createdAtStr = new Date().toISOString();

      if (saveMode === "new") {
        if (!newTitle.trim()) {
          setSaveError("Por favor ingresa un título para el nuevo cuestionario.");
          setSaving(false);
          return;
        }
        targetQuizId = "q_" + Date.now();
        finalTitle = newTitle.trim();
        finalDesc = newDesc.trim();
        
        let fileExtStr: 'manual' | 'txt' | 'csv' | 'xlsx' | 'docx' | 'pasted_text' = "manual";
        if (file) {
          const ext = file.name.split(".").pop()?.toLowerCase();
          if (ext === "xlsx" || ext === "xls") fileExtStr = "xlsx";
          else if (ext === "csv") fileExtStr = "csv";
          else if (ext === "docx") fileExtStr = "docx";
          else if (ext === "txt") fileExtStr = "txt";
        } else if (activeTab === "pasted") {
          fileExtStr = "pasted_text";
        }

        // Convert TempQuestion back to Question schema
        finalQuestionsList = validQuestions.map((vq) => ({
          id: `q_item_${Math.random().toString(36).substring(2, 11)}`,
          text: vq.text,
          options: vq.options,
          correctOption: vq.correctOption,
          timeLimit: vq.timeLimit,
          topic: vq.topic || "General",
          points: vq.points || 1000,
          origin: fileExtStr,
          createdAt: new Date().toISOString()
        }));
      } else {
        // Appending to existing
        if (!selectedQuizId) {
          setSaveError("Por favor selecciona un cuestionario existente de la lista.");
          setSaving(false);
          return;
        }

        const existing = existingQuizzes.find(item => item.id === selectedQuizId);
        if (!existing) {
          setSaveError("El cuestionario seleccionado ya no existe en la base de datos.");
          setSaving(false);
          return;
        }

        targetQuizId = existing.id;
        finalTitle = existing.title;
        finalDesc = existing.description || "";
        createdAtStr = existing.createdAt || new Date().toISOString();

        let fileExtStr: 'manual' | 'txt' | 'csv' | 'xlsx' | 'docx' | 'pasted_text' = "manual";
        if (file) {
          const ext = file.name.split(".").pop()?.toLowerCase();
          if (ext === "xlsx" || ext === "xls") fileExtStr = "xlsx";
          else if (ext === "csv") fileExtStr = "csv";
          else if (ext === "docx") fileExtStr = "docx";
          else if (ext === "txt") fileExtStr = "txt";
        } else if (activeTab === "pasted") {
          fileExtStr = "pasted_text";
        }

        // Convert existing and add the new ones
        const currentQuestions: Question[] = existing.questions || [];
        const addedQuestions: Question[] = validQuestions.map((vq) => ({
          id: `q_item_${Math.random().toString(36).substring(2, 11)}`,
          text: vq.text,
          options: vq.options,
          correctOption: vq.correctOption,
          timeLimit: vq.timeLimit,
          topic: vq.topic || "General",
          points: vq.points || 1000,
          origin: fileExtStr,
          createdAt: new Date().toISOString()
        }));

        finalQuestionsList = [...currentQuestions, ...addedQuestions];
      }

      // Send to server to write to SQLite
      const response = await fetch("/api/questionnaires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: targetQuizId,
          title: finalTitle,
          description: finalDesc,
          questions: finalQuestionsList,
          createdAt: createdAtStr
        })
      });

      if (response.ok) {
        onSaved();
      } else {
        const errBody = await response.json();
        setSaveError(errBody.error || "Ocurrió un error al guardar los cuestionarios en SQLite.");
      }
    } catch (err) {
      setSaveError("Fallo de red al conectar al servidor local.");
    } finally {
      setSaving(false);
    }
  };

  const totalCount = questions.length;
  const validCount = questions.filter(q => q.isValid).length;
  const errorCount = totalCount - validCount;
  const errorRatio = totalCount > 0 ? (errorCount / totalCount) : 0;
  const isErrorRatioExceeded = errorRatio > 0.30;
  const isPerfect = totalCount > 0 && errorCount === 0;

  // Group counts of valid questions by topic
  const topicsCount: Record<string, number> = {};
  questions.forEach((q) => {
    if (q.isValid) {
      const t = q.topic ? q.topic.trim() : "General";
      topicsCount[t] = (topicsCount[t] || 0) + 1;
    }
  });

  return (
    <div className="max-w-4xl mx-auto p-6 sm:p-8 bg-white text-slate-800 rounded-3xl shadow-xl border border-slate-200 font-sans" id="importer-component">
      
      {/* Header operations */}
      <div className="flex items-center justify-between mb-8 border-b border-slate-150 pb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors py-2 px-3 rounded-lg hover:bg-slate-50 cursor-pointer text-xs font-bold"
          id="btn-import-back"
        >
          <ArrowLeft size={16} />
          <span>Volver al Panel</span>
        </button>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-950 font-sans flex items-center gap-2">
          <ListPlus className="text-indigo-600" size={24} />
          <span>Importar Reactivos</span>
        </h2>
        <div className="w-[100px] hidden sm:block"></div>
      </div>

      {uploadError && (
        <div className="mb-6 flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-800" id="importer-error-banner">
          <AlertCircle className="shrink-0 text-rose-500 mt-0.5" size={18} />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide">Error en Carga de Archivo</p>
            <p className="text-xs font-semibold leading-relaxed mt-1">{uploadError}</p>
          </div>
        </div>
      )}

      {saveError && (
        <div className="mb-6 flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-800 animate-shake" id="importer-save-error-banner">
          <AlertCircle className="shrink-0 text-rose-500 mt-0.5" size={18} />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide font-sans">Error al Procesar Importación</p>
            <p className="text-xs font-semibold mt-1 font-sans">{saveError}</p>
          </div>
        </div>
      )}

      {/* Target Tabs Selection for Importer Source */}
      {!file && questions.length === 0 && !parsing && (
        <div className="flex border-b border-slate-200 mb-6 gap-2" id="importer-tabs">
          <button
            type="button"
            onClick={() => setActiveTab("file")}
            className={`pb-3 px-4 text-xs sm:text-sm font-black transition-all cursor-pointer border-b-2 flex items-center gap-2 ${
              activeTab === "file"
                ? "border-indigo-600 text-indigo-700 font-extrabold text-slate-900"
                : "border-transparent text-slate-450 hover:text-slate-600 font-bold"
            }`}
          >
            <UploadCloud size={16} />
            <span>Subir archivo</span>
          </button>
          
          <button
            type="button"
            onClick={() => setActiveTab("pasted")}
            className={`pb-3 px-4 text-xs sm:text-sm font-black transition-all cursor-pointer border-b-2 flex items-center gap-2 ${
              activeTab === "pasted"
                ? "border-indigo-600 text-indigo-700 font-extrabold text-slate-900"
                : "border-transparent text-slate-450 hover:text-slate-600 font-bold"
            }`}
            id="tab-paste-text"
          >
            <FileText size={16} />
            <span>Pegar texto</span>
          </button>
        </div>
      )}

      {/* 1. UPLOAD DECK OR PASTE TEXT CONTAINER */}
      {!file && questions.length === 0 && !parsing && (
        activeTab === "file" ? (
          <div className="space-y-6 animate-fade-in" id="upload-deck">
            {/* Visual Guide Header & Template Download Options */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 text-left shadow-sm" id="visual-guide-section">
              <h3 className="text-sm font-black uppercase tracking-wider text-indigo-700 flex items-center gap-1.5 font-sans">
                <HelpCircle size={18} />
                <span>¿Cómo preparar tus reactivos?</span>
              </h3>
              
              <ul className="space-y-2.5 text-xs font-semibold text-slate-650 list-disc list-inside leading-relaxed font-sans">
                <li>Usa una pregunta por fila en Excel o CSV.</li>
                <li>Marca la respuesta correcta únicamente con la letra <strong className="text-indigo-600 font-bold">A, B, C o D</strong>.</li>
                <li>Si dejas el campo de tiempo vacío, se usará el valor predeterminado de <strong className="text-slate-900 font-bold">30 segundos</strong>.</li>
                <li>Si dejas el campo de puntos vacío, se acumularán <strong className="text-slate-950 font-bold">1000 puntos</strong> estándar.</li>
                <li>El tema ingresado ayuda a categorizar tus reactivos y generar estadísticas de aprendizaje después.</li>
              </ul>
              
              <div className="pt-3.5 border-t border-slate-200 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <button 
                  onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-sans font-bold text-xs px-4.5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
                  id="btn-download-templates-master"
                >
                  <FileSpreadsheet size={15} />
                  <span>Descargar plantillas de ejemplo</span>
                </button>
                
                {showTemplateMenu && (
                  <div className="flex flex-wrap gap-2 animate-fade-in" id="templates-download-menu">
                    <button 
                      onClick={downloadXLSXTemplate}
                      className="flex items-center gap-1.5 bg-white border border-slate-250 hover:border-emerald-500 hover:text-emerald-700 font-sans font-bold text-xs px-3 py-2 rounded-lg shadow-sm transition-all cursor-pointer"
                    >
                      <FileSpreadsheet size={14} className="text-emerald-600" />
                      <span>Excel (.xlsx)</span>
                    </button>
                    <button 
                      onClick={downloadCSVTemplate}
                      className="flex items-center gap-1.5 bg-white border border-slate-250 hover:border-teal-500 hover:text-teal-700 font-sans font-bold text-xs px-3 py-2 rounded-lg shadow-sm transition-all cursor-pointer"
                    >
                      <FileSpreadsheet size={14} className="text-teal-600" />
                      <span>Ejemplo CSV (.csv)</span>
                    </button>
                    <button 
                      onClick={downloadTXTTemplate}
                      className="flex items-center gap-1.5 bg-white border border-slate-250 hover:border-indigo-500 hover:text-indigo-700 font-sans font-bold text-xs px-3 py-2 rounded-lg shadow-sm transition-all cursor-pointer"
                    >
                      <FileText size={14} className="text-indigo-600" />
                      <span>Plantilla TXT (.txt)</span>
                    </button>
                  </div>
                )}

                {!showTemplateMenu && (
                  <span className="text-[11px] text-slate-400 font-medium font-sans">Soporta archivos TXT, CSV, Excel (XLSX) y Word (DOCX)</span>
                )}
              </div>
            </div>

            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all flex flex-col items-center justify-center gap-4 ${
                dragActive 
                  ? "border-indigo-500 bg-indigo-50/50" 
                  : "border-slate-300 hover:border-indigo-400 bg-white"
              }`}
              id="drag-and-drop-deck"
              onClick={() => document.getElementById("file-loader-input")?.click()}
            >
              <input
                id="file-loader-input"
                type="file"
                onChange={handleFileInput}
                accept=".txt,.csv,.xlsx,.xls,.docx"
                className="hidden"
              />
              
              <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner relative">
                {parsing ? (
                  <RefreshCw className="animate-spin" size={32} />
                ) : (
                  <UploadCloud size={32} />
                )}
              </div>

              <div className="space-y-1">
                <p className="text-sm font-extrabold text-slate-800">
                  {parsing ? "Analizando reactivos..." : "Arrastra tu archivo aquí o haz clic para buscar"}
                </p>
                <p className="text-xs text-slate-400 font-sans">
                  Acepta .TXT, .CSV, .XLSX, y .DOCX (Límite 5 MB)
                </p>
              </div>
            </div>

            {/* Quick Format Reference Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="border border-slate-200 bg-white p-5 rounded-2xl space-y-3 shadow-sm">
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-bold uppercase font-mono">Formato TXT / DOCX Directo</span>
                <pre className="text-[10.5px] text-slate-600 font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-150 overflow-x-auto select-all leading-normal">
  {`¿Cuál es la fórmula del agua?
A) CO2
B) H2O
C) NaCl
D) O2
Respuesta: B`}
                </pre>
              </div>

              <div className="border border-slate-200 bg-white p-5 rounded-2xl space-y-3 shadow-sm">
                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-bold uppercase font-mono">Formato Excel XLSX / CSV</span>
                <p className="text-xs text-slate-500 font-medium leading-relaxed font-sans">
                  La primera fila debe contener nombres de columnas o use la estructura de 9 columnas en este orden secuencial:
                </p>
                <p className="text-[11px] font-bold font-mono text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-150 tracking-tight">
                  pregunta, opcion_a, opcion_b, opcion_c, opcion_d, respuesta, tiempo, puntos, tema
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in animate-duration-300" id="paste-text-section">
            <div className="text-left space-y-1">
              <h3 className="text-sm font-black uppercase tracking-wider text-indigo-700 flex items-center gap-1.5 font-sans">
                <FileText size={18} />
                <span>Pega aquí tus reactivos</span>
              </h3>
              <p className="text-xs text-slate-500 font-semibold font-sans">
                Copia y pega preguntas directamente desde ChatGPT, Word, PDF, Google Docs o cualquier texto. El sistema estructurará el cuestionario automáticamente.
              </p>
            </div>

            <div className="relative">
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Pega tu texto aquí...&#10;&#10;Ejemplo completo:&#10;Pregunta:&#10;¿Cuál es la fórmula del agua?&#10;A) CO2&#10;B) H2O&#10;C) NaCl&#10;D) O2&#10;Respuesta: B&#10;Tiempo: 30&#10;Puntos: 1000&#10;Tema: Química&#10;&#10;O formato simplificado:&#10;¿Cuál es la fórmula del agua?&#10;A) CO2&#10;B) H2O&#10;C) NaCl&#10;D) O2&#10;Respuesta: B"
                className="w-full min-h-[300px] bg-slate-50 border border-slate-350 focus:border-indigo-500 focus:bg-white rounded-2xl p-5 text-xs font-mono font-semibold text-slate-850 outline-none transition-all placeholder:text-slate-400"
                maxLength={500000}
                id="textarea-pasted-reactivos"
              />
              
              <div className="absolute bottom-4 right-4 bg-slate-900/80 backdrop-blur-xs text-[10px] font-bold text-slate-200 font-mono px-2.5 py-1 rounded-md border border-slate-700/50">
                {pastedText.length.toLocaleString()} caracteres
              </div>
            </div>

            {/* Micro layout for quick triggers */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-200">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleLoadSample}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-slate-200"
                  id="btn-load-pasted-sample"
                >
                  <Sparkles size={13} className="text-amber-500 fill-amber-500" />
                  <span>Cargar ejemplo</span>
                </button>
                
                <button
                  type="button"
                  onClick={handleClearPastedText}
                  disabled={!pastedText}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 disabled:opacity-40 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-slate-200"
                  id="btn-clear-pasted-text"
                >
                  <Trash2 size={13} />
                  <span>Limpiar texto</span>
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleAnalyzePastedText}
                  disabled={parsing || !pastedText.trim()}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-extrabold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                  id="btn-analyze-pasted-text"
                >
                  {parsing ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <Sparkles size={13} />
                  )}
                  <span>Analizar texto</span>
                </button>
              </div>
            </div>
          </div>
        )
      )}

      {/* 2. PROGRESS / ANALYZING STATE */}
      {parsing && (
        <div className="py-20 text-center space-y-4" id="processing-loader">
          <RefreshCw className="animate-spin text-indigo-600 mx-auto" size={36} />
          <div className="space-y-1">
            <h4 className="text-sm font-extrabold text-slate-800">Analizando estructura de preguntas...</h4>
            <p className="text-xs text-slate-400 font-mono">Sanitizando cadenas de texto y extrayendo claves</p>
          </div>
        </div>
      )}

      {/* 3. PREVIEW & MANUALLY EDIT SCREEN */}
      {(file || questions.length > 0) && !parsing && (
        <div className="space-y-8" id="preview-and-configuration">
          
          {/* File header metrics bar */}
          <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-slate-950/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-800 text-indigo-400 rounded-xl flex items-center justify-center shrink-0 border border-slate-700">
                {file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls") || file.name.endsWith(".csv")) ? (
                  <FileSpreadsheet size={20} />
                ) : (
                  <FileText size={20} />
                )}
              </div>
              <div className="text-left font-sans flex-1 min-w-0">
                <h4 className="text-xs font-black truncate max-w-[200px] sm:max-w-xs">
                  {file ? file.name : "Reactivos Pegados Directamente"}
                </h4>
                <p className="text-[10px] text-slate-400 font-mono">
                  {file ? `${(file.size / 1024).toFixed(1)} KB • Lector Offline` : `${pastedText.length.toLocaleString()} caracteres • Parser Inteligente`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/50 border border-emerald-900/40 px-2.5 py-1 rounded-lg">
                Válidas: {validCount}
              </span>
              {errorCount > 0 && (
                <span className="text-[10px] font-bold text-rose-400 bg-rose-950/50 border border-rose-900/40 px-2.5 py-1 rounded-lg">
                  Con Error: {errorCount}
                </span>
              )}
              <button
                onClick={handleClearFile}
                className="text-slate-400 hover:text-white hover:bg-slate-800 p-2 rounded-xl transition-all cursor-pointer"
                title="Subir un archivo diferente"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Advanced Visual Validation Metrics */}
          <div className="space-y-4" id="advanced-visual-validation">
            {/* 1. Perfect state banner */}
            {isPerfect && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl p-5 text-sm font-semibold flex items-start gap-3 text-left shadow-sm" id="perfect-import-success">
                <CheckCircle2 size={20} className="text-emerald-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-extrabold text-emerald-800 uppercase tracking-wider text-xs">¡Estructura de reactivos impecable!</p>
                  <p className="text-emerald-700 leading-relaxed font-sans">
                    El 100% de las preguntas detectadas ({totalCount}) son totalmente válidas y están listas para guardarse en el banco escolar de preguntas local.
                  </p>
                </div>
              </div>
            )}

            {/* 2. Warning state if more than 30% have error */}
            {isErrorRatioExceeded && (
              <div className="bg-rose-50 border border-rose-200 text-rose-950 rounded-2xl p-5 text-sm font-medium flex items-start gap-3 text-left shadow-sm" id="error-exceeded-warning">
                <AlertCircle size={20} className="text-rose-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-extrabold text-rose-900 uppercase tracking-wide text-xs">Advertencia de alta tasa de error detectada ({Math.round(errorRatio * 100)}%)</p>
                  <p className="text-rose-700 leading-relaxed font-sans text-xs">
                    ¡Cuidado! Más del 30% de tus reactivos contienen inconsistencias o formatos incompatibles. 
                    Te sugerimos verificar el formato de las opciones o las respuestas correctas usando el panel de edición rápida de cada fila.
                  </p>
                </div>
              </div>
            )}

            {/* 3. Global brief review bar with topic breakdown badges */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col gap-4 text-left shadow-sm" id="quick-metrics-status">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <span className="text-xs font-bold text-slate-700 font-sans">Total de preguntas detectadas: <strong className="text-indigo-600 font-black font-mono text-sm">{totalCount}</strong></span>
                <span className="text-xs font-semibold text-slate-500 font-sans">
                  {errorCount > 0 ? (
                    <span>Se detectaron <strong className="text-rose-600 font-mono font-bold">{errorCount}</strong> con errores para revisión.</span>
                  ) : (
                    <span className="text-emerald-600">Todos los reactivos listos para guardarse.</span>
                  )}
                </span>
              </div>

              {/* Counts of detect topics visually */}
              {Object.keys(topicsCount).length > 0 && (
                <div className="pt-3 border-t border-slate-200 space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-sans">Ejes / Materias Identificadas</span>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(topicsCount).map(([topic, count]) => (
                      <div key={topic} className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 font-sans font-bold text-[10.5px] px-3 py-1.5 rounded-full border border-indigo-150 shadow-sm leading-none">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                        <span className="font-semibold">{topic}:</span>
                        <span className="font-black font-mono">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* EDIT FORM (IN-PLACE CONDITIONAL POPUP) */}
          {editingLocalId && editForm && (
            <div className="bg-indigo-50/50 border-2 border-indigo-200 rounded-3xl p-6 space-y-5 animate-fade-in" id="manual-edit-overlay">
              <div className="flex justify-between items-center border-b border-indigo-150 pb-3">
                <h4 className="text-sm font-black text-indigo-900 uppercase tracking-wide font-sans">Modificar reactivo antes de importar</h4>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-slate-400 hover:text-indigo-900"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wide text-indigo-700 mb-1">Enunciado / Pregunta</label>
                  <input
                    type="text"
                    value={editForm.text}
                    onChange={(e) => handleFieldChange("text", e.target.value)}
                    className="w-full bg-white border border-indigo-200 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {editForm.options.map((option, idx) => (
                    <div key={idx} className="space-y-1">
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">
                        Opción {String.fromCharCode(65 + idx)}
                      </label>
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => handleOptionFieldChange(idx, e.target.value)}
                        placeholder={`Respuesta alternativa ${idx + 1}`}
                        className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-slate-700 font-semibold"
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
                  <div className="sm:col-span-1">
                    <label className="block text-[10px] uppercase font-bold tracking-wide text-slate-400 mb-1">Opción Correcta</label>
                    <select
                      value={editForm.correctOption}
                      onChange={(e) => handleFieldChange("correctOption", Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 p-2 rounded-xl text-xs font-sans font-bold select-all outline-none cursor-pointer"
                    >
                      <option value="-1">Seleccionar...</option>
                      <option value="0">Opción A</option>
                      <option value="1">Opción B</option>
                      <option value="2">Opción C</option>
                      <option value="3">Opción D</option>
                    </select>
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-[10px] uppercase font-bold tracking-wide text-slate-400 mb-1">Tiempo (seg)</label>
                    <input
                      type="number"
                      min="5"
                      max="120"
                      value={editForm.timeLimit}
                      onChange={(e) => handleFieldChange("timeLimit", Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 p-2 rounded-xl text-xs font-mono font-bold outline-none"
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-[10px] uppercase font-bold tracking-wide text-slate-400 mb-1">Puntos</label>
                    <input
                      type="number"
                      value={editForm.points}
                      onChange={(e) => handleFieldChange("points", Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 p-2 rounded-xl text-xs font-mono font-bold outline-none"
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-[10px] uppercase font-bold tracking-wide text-slate-400 mb-1">Tema / Eje</label>
                    <input
                      type="text"
                      value={editForm.topic}
                      onChange={(e) => handleFieldChange("topic", e.target.value)}
                      placeholder="General"
                      className="w-full bg-white border border-slate-200 p-2 rounded-xl text-xs font-bold font-sans outline-none text-slate-700"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-indigo-150">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveEdit(editingLocalId!)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold font-sans flex items-center gap-1"
                >
                  <Save size={13} />
                  <span>Guardar Reactivo</span>
                </button>
              </div>
            </div>
          )}

          {/* QUESTIONS LIST PREVIEW STACK */}
          <div className="space-y-4" id="questions-preview-stack">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Banco de Reactivos Encontrados ({totalCount})</h3>

            <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
              {questions.map((q, qIndex) => {
                const isEditing = editingLocalId === q.localId;
                
                return (
                  <div
                    key={q.localId}
                    className={`border rounded-2xl p-4 sm:p-5 transition-all text-left ${
                      isEditing ? "ring-2 ring-indigo-500 bg-indigo-50/20" :
                      !q.isValid ? "border-rose-200 bg-rose-50/20 shadow-sm" : "border-slate-250 bg-white hover:bg-slate-50 shadow-sm"
                    }`}
                    id={`preview-question-card-${qIndex}`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 px-2.5 py-0.5 rounded-full font-bold">
                            Pregunta #{qIndex + 1}
                          </span>

                          <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold font-mono">
                            {q.timeLimit} s
                          </span>

                          <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold font-mono">
                            {q.points} pts
                          </span>

                          <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-500 px-2 py-0.5 rounded font-bold uppercase tracking-wider font-mono truncate max-w-[120px]">
                            {q.topic}
                          </span>

                          {!q.isValid && (
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded flex items-center gap-1 shrink-0">
                              <AlertCircle size={10} />
                              Requiere corrección
                            </span>
                          )}
                        </div>

                        <p className="text-xs sm:text-sm font-bold text-slate-900 leading-normal font-sans pt-1.5 break-words">
                          {q.text}
                        </p>

                        {/* List options preview */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-2.5">
                          {q.options.map((option, oIdx) => {
                            const isCorrect = oIdx === q.correctOption;
                            if (!option && !isCorrect) return null;
                            
                            return (
                              <div
                                key={oIdx}
                                className={`text-[11px] py-1 px-2.5 rounded-lg flex items-center justify-between border ${
                                  isCorrect 
                                    ? "bg-emerald-50 border-emerald-250 text-emerald-800 font-bold" 
                                    : "bg-slate-50 border-slate-150 text-slate-500"
                                }`}
                              >
                                <span className="truncate max-w-[200px] font-sans">
                                  <strong>{String.fromCharCode(65 + oIdx)})</strong> {option || "(sin opción)"}
                                </span>
                                {isCorrect && <Check size={11} className="stroke-[3.5] text-emerald-600 shrink-0 ml-1" />}
                              </div>
                            );
                          })}
                        </div>

                        {q.error && (
                          <div className="mt-3.5 bg-rose-50 border border-rose-150 p-2.5 rounded-xl text-[10.5px] font-semibold text-rose-700 flex items-start gap-1.5 leading-snug">
                            <AlertCircle size={13} className="shrink-0 mt-0.5 text-rose-500" />
                            <span className="font-sans">{q.error}</span>
                          </div>
                        )}
                      </div>

                      {/* Manual controls side bar */}
                      <div className="flex items-center gap-1 shrink-0 ml-2" id="preview-row-triggers">
                        <button
                          onClick={() => handleStartEdit(q)}
                          className="p-2 bg-slate-50 hover:bg-indigo-50 text-slate-650 hover:text-indigo-600 rounded-lg border border-slate-200 transition-all cursor-pointer shadow-sm"
                          title="Modificar contenido"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteParsedQuestion(q.localId)}
                          className="p-2 bg-slate-50 hover:bg-rose-50 text-rose-600 hover:text-rose-700 rounded-lg border border-slate-200 transition-all cursor-pointer shadow-sm"
                          title="Descartar este reactivo"
                        >
                          <Trash size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. DESTINATION SAVE CONFIG DECK */}
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 text-left" id="destination-saving-config-deck">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-2">Destino de la Importación</h3>

            <div className="flex flex-col sm:flex-row gap-6">
              <label className="flex items-center gap-2.5 text-xs font-bold text-slate-800 cursor-pointer select-none">
                <input
                  type="radio"
                  name="importMode"
                  checked={saveMode === "new"}
                  onChange={() => setSaveMode("new")}
                  className="w-4 h-4 text-indigo-600 border-slate-350 focus:ring-indigo-500"
                />
                <span className="font-sans">Crear un cuestionario NUEVO</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs font-bold text-slate-800 cursor-pointer select-none">
                <input
                  type="radio"
                  name="importMode"
                  checked={saveMode === "existing"}
                  onChange={() => setSaveMode("existing")}
                  disabled={existingQuizzes.length === 0}
                  className="w-4 h-4 text-indigo-600 border-slate-350 focus:ring-indigo-500 disabled:opacity-50"
                />
                <span className="font-sans">Anexar a un cuestionario EXISTENTE</span>
              </label>
            </div>

            {saveMode === "new" ? (
              <div className="space-y-4 animate-fade-in" id="box-new-quiz-form">
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">Nombre del nuevo cuestionario</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ej. Cuestionario de Geografía o Evaluación de Ciencias"
                    className="w-full bg-white border border-slate-250 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-slate-800 font-bold outline-none shadow-sm"
                    id="import-new-title-input"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">Descripción de aula (opcional)</label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Ej. Evaluativo importado de materiales de Word o listas docentes"
                    rows={2}
                    className="w-full bg-white border border-slate-250 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-slate-700 outline-none resize-none shadow-sm font-medium"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2 animate-fade-in" id="box-existing-quiz-form">
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">Seleccione el cuestionario destino</label>
                <select
                  value={selectedQuizId}
                  onChange={(e) => setSelectedQuizId(e.target.value)}
                  className="w-full bg-white border border-slate-250 p-3 rounded-xl text-xs font-sans font-bold shadow-sm outline-none cursor-pointer"
                  id="import-existing-selector"
                >
                  {existingQuizzes.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title} ({q.questions ? q.questions.length : 0} preguntas actuales)
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 font-medium pt-1 font-sans">
                  Las preguntas válidas detectadas se agregarán al final de las preguntas actuales de este cuestionario en SQLite.
                </p>
              </div>
            )}

            {/* Final Action deck buttons */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-200 mt-6" id="save-deck-trigger">
              <span className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider hidden md:inline">
                Se importarán {validCount} reactivos válidos
              </span>
              
              <div className="flex gap-3 justify-end w-full md:w-auto">
                <button
                  onClick={onBack}
                  className="px-5 py-3 bg-white border border-slate-250 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold font-sans cursor-pointer"
                >
                  Cancelar importación
                </button>
                <button
                  onClick={handleFinalSave}
                  disabled={saving || validCount === 0}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl text-xs sm:text-sm font-sans shadow-md hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  id="btn-confirm-import-save"
                >
                  <Sparkles size={14} className="fill-white" />
                  <span>{saving ? "Registrando SQLite..." : "Guardar e Importar preguntas"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
