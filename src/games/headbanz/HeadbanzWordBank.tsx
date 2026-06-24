import React, { useState, useEffect } from "react";
import { Plus, Trash, Copy, Edit2, Check, ArrowLeft, BookOpen, Layers, HelpCircle, Save } from "lucide-react";
import { HeadbanzWord } from "./headbanzTypes";

interface HeadbanzBank {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  words: HeadbanzWord[];
}

interface HeadbanzWordBankProps {
  onBack: () => void;
  onSelectBank?: (bank: HeadbanzBank) => void;
  selectionMode?: boolean;
}

export default function HeadbanzWordBank({ onBack, onSelectBank, selectionMode = false }: HeadbanzWordBankProps) {
  const [banks, setBanks] = useState<HeadbanzBank[]>([]);
  const [selectedBank, setSelectedBank] = useState<HeadbanzBank | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [editingBankName, setEditingBankName] = useState<string>("");
  const [editingBankDesc, setEditingBankDesc] = useState<string>("");
  const [words, setWords] = useState<HeadbanzWord[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Word form inputs
  const [newConcept, setNewConcept] = useState<string>("");
  const [newCategory, setNewCategory] = useState<string>("");
  const [newDifficulty, setNewDifficulty] = useState<"facil" | "medio" | "dificil">("medio");
  const [newHint, setNewHint] = useState<string>("");
  const [editingWordId, setEditingWordId] = useState<string | null>(null);

  useEffect(() => {
    fetchBanks();
  }, []);

  const fetchBanks = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/headbanz/banks");
      const data = await res.json();
      setBanks(data);
    } catch (err) {
      console.error("Error fetching headbanz banks:", err);
      setError("No se pudieron cargar los bancos de palabras.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBank = async () => {
    const newBank: Partial<HeadbanzBank> = {
      id: Math.random().toString(36).substring(2, 11),
      name: "Nuevo Banco de Palabras 🧠",
      description: "Colección de conceptos para adivinar.",
      createdAt: new Date().toISOString(),
      words: []
    };

    try {
      const res = await fetch("/api/headbanz/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBank)
      });
      if (res.ok) {
        await fetchBanks();
        const created = await res.json();
        handleEditBank(created.bank);
      }
    } catch (err) {
      setError("Error al crear el banco de palabras.");
    }
  };

  const handleEditBank = (bank: HeadbanzBank) => {
    setSelectedBank(bank);
    setEditingBankName(bank.name);
    setEditingBankDesc(bank.description || "");
    setWords(bank.words || []);
    clearWordForm();
  };

  const handleDuplicateBank = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/headbanz/banks/${id}/duplicate`, {
        method: "POST"
      });
      if (res.ok) {
        fetchBanks();
      }
    } catch (err) {
      setError("No se pudo duplicar el banco de palabras.");
    }
  };

  const handleDeleteBank = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("¿Estás seguro de eliminar este banco de palabras?")) return;
    try {
      const res = await fetch(`/api/headbanz/banks/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchBanks();
      }
    } catch (err) {
      setError("No se pudo eliminar el banco.");
    }
  };

  const handleSaveBankDetails = async () => {
    if (!selectedBank) return;
    const updated = {
      ...selectedBank,
      name: editingBankName,
      description: editingBankDesc,
      words: words
    };

    try {
      const res = await fetch("/api/headbanz/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        setSelectedBank(null);
        fetchBanks();
      }
    } catch (err) {
      setError("No se pudieron guardar los cambios.");
    }
  };

  const handleAddOrUpdateWord = () => {
    if (!newConcept.trim()) {
      alert("El concepto es obligatorio");
      return;
    }

    if (editingWordId) {
      // Update
      setWords(prev => prev.map(w => w.id === editingWordId ? {
        ...w,
        concept: newConcept.trim(),
        category: newCategory.trim() || "General",
        difficulty: newDifficulty,
        hint: newHint.trim()
      } : w));
    } else {
      // Create new
      const newWord: HeadbanzWord = {
        id: Math.random().toString(36).substring(2, 11),
        concept: newConcept.trim(),
        category: newCategory.trim() || "General",
        difficulty: newDifficulty,
        hint: newHint.trim()
      };
      setWords(prev => [...prev, newWord]);
    }
    clearWordForm();
  };

  const handleEditWord = (w: HeadbanzWord) => {
    setEditingWordId(w.id);
    setNewConcept(w.concept);
    setNewCategory(w.category);
    setNewDifficulty(w.difficulty);
    setNewHint(w.hint || "");
  };

  const handleDeleteWord = (id: string) => {
    setWords(prev => prev.filter(w => w.id !== id));
  };

  const clearWordForm = () => {
    setEditingWordId(null);
    setNewConcept("");
    setNewCategory("");
    setNewDifficulty("medio");
    setNewHint("");
  };

  return (
    <div className="bg-slate-50 min-h-screen p-6 sm:p-8" id="headbanz-bank-manager">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition shadow-xs"
              title="Volver"
              id="back-btn"
            >
              <ArrowLeft className="w-5 h-5 text-slate-700" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-900 font-sans tracking-tight">
                {selectedBank ? "Editar Banco de Palabras" : "Bancos de Palabras 🧠"}
              </h1>
              <p className="text-slate-500 text-xs">
                {selectedBank ? "Personaliza tus conceptos y pistas para el aula" : "Administra las colecciones independientes de conceptos académicos"}
              </p>
            </div>
          </div>

          {!selectedBank && (
            <button
              onClick={handleCreateBank}
              className="flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white font-bold py-2.5 px-4 rounded-xl transition shadow-md hover:shadow-lg text-sm self-start sm:self-auto"
              id="create-bank-btn"
            >
              <Plus className="w-4 h-4" />
              Nuevo Banco
            </button>
          )}
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border-l-4 border-rose-500 text-rose-700 rounded-r-xl text-sm font-sans shadow-xs" id="bank-error">
            {error}
          </div>
        )}

        {selectedBank ? (
          /* Editor View */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="bank-editor-layout">
            
            {/* Left Panel: Bank Info & Word Adder */}
            <div className="space-y-6 lg:col-span-1">
              <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider font-mono">Detalles del Banco</h2>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Nombre</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500 transition font-medium"
                      value={editingBankName}
                      onChange={(e) => setEditingBankName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Descripción</label>
                    <textarea
                      rows={2}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500 transition font-medium"
                      value={editingBankDesc}
                      onChange={(e) => setEditingBankDesc(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider font-mono">
                  {editingWordId ? "Editar Concepto" : "Agregar Concepto"}
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Concepto / Palabra Secreta</label>
                    <input
                      type="text"
                      placeholder="Ej. Fotosíntesis"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500 transition font-medium"
                      value={newConcept}
                      onChange={(e) => setNewConcept(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Categoría</label>
                    <input
                      type="text"
                      placeholder="Ej. Procesos Químicos"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500 transition font-medium"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Dificultad</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["facil", "medio", "dificil"] as const).map((diff) => (
                        <button
                          key={diff}
                          type="button"
                          onClick={() => setNewDifficulty(diff)}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition uppercase ${
                            newDifficulty === diff
                              ? "bg-pink-50 border-pink-500 text-pink-700 shadow-xs"
                              : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {diff}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Pista (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ej. Ocurre en los cloroplastos"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500 transition font-medium"
                      value={newHint}
                      onChange={(e) => setNewHint(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleAddOrUpdateWord}
                      className="flex-1 bg-pink-600 hover:bg-pink-700 text-white font-bold py-2 rounded-xl transition text-sm shadow-xs flex items-center justify-center gap-1.5"
                    >
                      {editingWordId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      {editingWordId ? "Actualizar" : "Agregar"}
                    </button>
                    {editingWordId && (
                      <button
                        type="button"
                        onClick={clearWordForm}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-3 rounded-xl transition text-sm"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel: Concept List & Action Bar */}
            <div className="space-y-6 lg:col-span-2 flex flex-col h-[calc(100vh-220px)] lg:h-auto min-h-[450px]">
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col flex-1 overflow-hidden">
                <div className="p-4 border-b border-slate-150 flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider font-mono">
                    Conceptos Cargados ({words.length})
                  </h3>
                  <button
                    onClick={handleSaveBankDetails}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded-lg transition text-xs shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Guardar Cambios
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-slate-100" id="concepts-scrollable">
                  {words.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full p-8 text-slate-400 text-center">
                      <Layers className="w-10 h-10 mb-2 stroke-1" />
                      <p className="text-sm font-medium">Aún no hay conceptos en este banco.</p>
                      <p className="text-xs">Usa el panel de la izquierda para agregar tu primer concepto.</p>
                    </div>
                  ) : (
                    words.map((w, index) => (
                      <div key={w.id || index} className="p-3 sm:p-4 hover:bg-slate-50 transition flex items-center justify-between gap-4">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm font-sans truncate">{w.concept}</span>
                            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                              {w.category}
                            </span>
                            <span className={`text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded-full border ${
                              w.difficulty === "facil"
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                : w.difficulty === "dificil"
                                ? "bg-rose-50 border-rose-200 text-rose-700"
                                : "bg-amber-50 border-amber-200 text-amber-700"
                            }`}>
                              {w.difficulty}
                            </span>
                          </div>
                          {w.hint && (
                            <p className="text-xs text-slate-500 font-medium truncate">
                              <span className="font-bold text-slate-400">Pista:</span> {w.hint}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleEditWord(w)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition"
                            title="Editar concepto"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteWord(w.id)}
                            className="p-1.5 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-slate-400 transition"
                            title="Eliminar concepto"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

          </div>
        ) : (
          /* List View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="banks-grid">
            {loading ? (
              <div className="col-span-full py-12 text-center text-slate-400 font-sans" id="loading-spinner">
                Cargando colecciones de Headbanz...
              </div>
            ) : banks.length === 0 ? (
              <div className="col-span-full py-16 text-center text-slate-400 font-sans bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col items-center justify-center">
                <BookOpen className="w-12 h-12 mb-3 stroke-1 text-slate-300" />
                <p className="font-bold text-slate-800">No hay colecciones de conceptos</p>
                <p className="text-xs max-w-sm mt-1">Crea tu primer banco de palabras o conceptos académicos para jugar con tus alumnos.</p>
                <button
                  onClick={handleCreateBank}
                  className="mt-4 bg-pink-600 hover:bg-pink-700 text-white text-xs font-black px-4 py-2 rounded-xl transition"
                >
                  Crear Banco
                </button>
              </div>
            ) : (
              banks.map((bank) => (
                <div
                  key={bank.id}
                  onClick={() => selectionMode && onSelectBank ? onSelectBank(bank) : handleEditBank(bank)}
                  className={`bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition text-left cursor-pointer relative group flex flex-col justify-between min-h-[160px] ${
                    selectionMode ? "ring-2 ring-transparent hover:ring-pink-500" : ""
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-black text-slate-900 text-base font-sans tracking-tight leading-tight truncate group-hover:text-pink-600 transition">
                        {bank.name}
                      </h3>
                      <span className="bg-pink-50 text-pink-700 text-[10px] font-black font-mono px-2 py-0.5 rounded-full border border-pink-200 shrink-0">
                        {bank.words?.length || 0} palabras
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium line-clamp-2">
                      {bank.description || "Sin descripción proporcionada."}
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-4">
                    <span className="text-[9px] font-mono font-bold text-slate-400">
                      Creado: {new Date(bank.createdAt).toLocaleDateString()}
                    </span>

                    {!selectionMode && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => handleDuplicateBank(bank.id, e)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition"
                          title="Duplicar Colección"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteBank(bank.id, e)}
                          className="p-1.5 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-slate-400 transition"
                          title="Eliminar Colección"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
}
