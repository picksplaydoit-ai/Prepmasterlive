import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Play, FileText, ArrowLeft, Copy, Save, Sparkles, Upload } from "lucide-react";
import { PictionaryWordBank as BankType, PictionaryWord } from "./pictionaryTypes";

interface PictionaryWordBankProps {
  onBack: () => void;
  onSelectBankForGame?: (bank: BankType) => void;
}

export default function PictionaryWordBank({ onBack, onSelectBankForGame }: PictionaryWordBankProps) {
  const [banks, setBanks] = useState<BankType[]>([]);
  const [activeBank, setActiveBank] = useState<BankType | null>(null);
  const [isEditingBank, setIsEditingBank] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Form states for creating/editing a bank
  const [bankName, setBankName] = useState("");
  const [bankDesc, setBankDesc] = useState("");
  const [bankTopic, setBankTopic] = useState("");

  // Input states for individual words
  const [newWord, setNewWord] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newDifficulty, setNewDifficulty] = useState<"Fácil" | "Media" | "Difícil">("Media");
  const [newHint, setNewHint] = useState("");
  const [editingWordId, setEditingWordId] = useState<string | null>(null);

  // Paste / Bulk Import state
  const [bulkText, setBulkText] = useState("");
  const [showBulkImport, setShowBulkImport] = useState(false);

  // Fetch word banks on load
  const fetchBanks = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/pictionary/banks");
      if (res.ok) {
        const data = await res.json();
        setBanks(data);
      }
    } catch (err) {
      console.error("Error fetching Pictionary word banks:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBanks();
  }, []);

  const handleCreateNewBank = () => {
    setActiveBank({
      id: "",
      name: "Nuevo Banco de Palabras",
      description: "",
      topic: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      words: [],
    });
    setBankName("Nuevo Banco de Palabras");
    setBankDesc("");
    setBankTopic("General");
    setIsEditingBank(true);
    setBulkText("");
    setShowBulkImport(false);
  };

  const handleEditBankMeta = (bank: BankType) => {
    setActiveBank(bank);
    setBankName(bank.name);
    setBankDesc(bank.description || "");
    setBankTopic(bank.topic || "");
    setIsEditingBank(true);
    setBulkText("");
    setShowBulkImport(false);
  };

  const handleSaveBank = async () => {
    if (!activeBank) return;
    if (!bankName.trim()) {
      alert("Introduce un nombre para el banco.");
      return;
    }

    const payload: BankType = {
      ...activeBank,
      name: bankName,
      description: bankDesc,
      topic: bankTopic,
      words: activeBank.words,
    };

    setIsLoading(true);
    try {
      const res = await fetch("/api/pictionary/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await fetchBanks();
        setIsEditingBank(false);
        setActiveBank(null);
      }
    } catch (err) {
      console.error("Error saving bank:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBank = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("¿Seguro que deseas eliminar este banco de palabras? Esta operación es irreversible.")) return;

    try {
      const res = await fetch(`/api/pictionary/banks/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchBanks();
      }
    } catch (err) {
      console.error("Error deleting bank:", err);
    }
  };

  const handleDuplicateBank = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/pictionary/banks/${id}/duplicate`, { method: "POST" });
      if (res.ok) {
        fetchBanks();
      }
    } catch (err) {
      console.error("Error duplicating bank:", err);
    }
  };

  // ----- Word operations inside active bank -----
  const handleAddOrUpdateWord = () => {
    if (!activeBank || !newWord.trim()) return;

    let updatedWords: PictionaryWord[] = [];

    if (editingWordId) {
      // Edit
      updatedWords = activeBank.words.map((w) =>
        w.id === editingWordId
          ? {
              ...w,
              word: newWord.trim(),
              category: newCategory.trim(),
              difficulty: newDifficulty,
              hint: newHint.trim(),
            }
          : w
      );
      setEditingWordId(null);
    } else {
      // Create new
      const entry: PictionaryWord = {
        id: Math.random().toString(36).substring(2, 11),
        bankId: activeBank.id,
        word: newWord.trim(),
        category: newCategory.trim(),
        difficulty: newDifficulty,
        hint: newHint.trim(),
        createdAt: new Date().toISOString(),
      };
      updatedWords = [...activeBank.words, entry];
    }

    setActiveBank({
      ...activeBank,
      words: updatedWords,
    });

    // Clear word input states
    setNewWord("");
    setNewCategory("");
    setNewDifficulty("Media");
    setNewHint("");
  };

  const handleStartEditWord = (w: PictionaryWord) => {
    setEditingWordId(w.id);
    setNewWord(w.word);
    setNewCategory(w.category || "");
    setNewDifficulty(w.difficulty);
    setNewHint(w.hint || "");
  };

  const handleDeleteWord = (wordId: string) => {
    if (!activeBank) return;
    setActiveBank({
      ...activeBank,
      words: activeBank.words.filter((w) => w.id !== wordId),
    });
  };

  // ----- Bulk import parser -----
  const handleBulkImport = () => {
    if (!activeBank || !bulkText.trim()) return;

    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    const parsedWords: PictionaryWord[] = [];

    let currentWord: any = null;
    const isRichFormat = lines.some((l) => l.toLowerCase().startsWith("palabra:"));

    if (isRichFormat) {
      for (const line of lines) {
        if (line.toLowerCase().startsWith("palabra:")) {
          if (currentWord) parsedWords.push(currentWord);
          currentWord = {
            id: Math.random().toString(36).substring(2, 11),
            bankId: activeBank.id,
            word: line.substring(line.indexOf(":") + 1).trim(),
            category: "",
            difficulty: "Media",
            hint: "",
            createdAt: new Date().toISOString(),
          };
        } else if (currentWord && line.toLowerCase().startsWith("categoría:")) {
          currentWord.category = line.substring(line.indexOf(":") + 1).trim();
        } else if (currentWord && line.toLowerCase().startsWith("categoria:")) {
          currentWord.category = line.substring(line.indexOf(":") + 1).trim();
        } else if (currentWord && line.toLowerCase().startsWith("dificultad:")) {
          const diff = line.substring(line.indexOf(":") + 1).trim();
          if (["Fácil", "Media", "Difícil"].map((d) => d.toLowerCase()).includes(diff.toLowerCase())) {
            currentWord.difficulty = (diff.charAt(0).toUpperCase() + diff.slice(1).toLowerCase()) as any;
          }
        } else if (currentWord && line.toLowerCase().startsWith("pista:")) {
          currentWord.hint = line.substring(line.indexOf(":") + 1).trim();
        }
      }
      if (currentWord) parsedWords.push(currentWord);
    } else {
      // Simplificado / Comas
      for (const line of lines) {
        if (line.includes(",")) {
          const parts = line.split(",").map((p) => p.trim());
          parsedWords.push({
            id: Math.random().toString(36).substring(2, 11),
            bankId: activeBank.id,
            word: parts[0],
            category: parts[1] || "",
            difficulty: "Media",
            hint: parts[2] || "",
            createdAt: new Date().toISOString(),
          });
        } else {
          parsedWords.push({
            id: Math.random().toString(36).substring(2, 11),
            bankId: activeBank.id,
            word: line,
            category: "",
            difficulty: "Media",
            hint: "",
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    setActiveBank({
      ...activeBank,
      words: [...activeBank.words, ...parsedWords],
    });

    setBulkText("");
    setShowBulkImport(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setBulkText(text);
        setShowBulkImport(true);
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // Reset
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6 bg-slate-50 border border-slate-200 rounded-3xl shadow-sm" id="pictionary-word-bank-manager">
      {/* Top action row */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4 select-none">
        <button
          onClick={isEditingBank ? () => setIsEditingBank(false) : onBack}
          className="flex items-center gap-1 text-xs font-black text-slate-700 hover:text-indigo-600 bg-white hover:bg-indigo-50 border border-slate-200 px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-xs"
        >
          <ArrowLeft size={14} />
          <span>{isEditingBank ? "Volver" : "Menú Anterior"}</span>
        </button>

        <h2 className="text-xl font-black text-slate-900 tracking-tight font-sans">
          {isEditingBank ? `Editando: ${bankName}` : "🎨 Pictionary Word Banks"}
        </h2>

        {!isEditingBank && (
          <button
            onClick={handleCreateNewBank}
            className="flex items-center gap-1.5 text-xs font-black bg-indigo-600 border border-indigo-750 text-white hover:bg-indigo-700 px-4 py-2.5 rounded-xl cursor-pointer shadow-sm transition-all"
          >
            <Plus size={14} />
            <span>Crear Banco</span>
          </button>
        )}
      </div>

      {isLoading && (
        <div className="p-12 text-center text-slate-500 font-mono text-sm animate-pulse">
          ⏳ Procesando base de datos SQLite...
        </div>
      )}

      {/* Main content - Catalog view */}
      {!isEditingBank && !isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="word-banks-list-catalog">
          {banks.length === 0 ? (
            <div className="col-span-full py-16 bg-white border border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center text-center p-6">
              <span className="text-3xl mb-3">📦</span>
              <p className="text-sm font-black text-slate-800">No hay bancos de palabras creados todavía.</p>
              <p className="text-slate-400 text-xs mt-1">Crea uno manualmente o importa palabras y empieza la diversión.</p>
              <button
                onClick={handleCreateNewBank}
                className="mt-4 text-xs font-black bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 px-4 py-2 rounded-xl"
              >
                + Crear Primer Banco
              </button>
            </div>
          ) : (
            banks.map((bank) => (
              <div
                key={bank.id}
                onClick={() => onSelectBankForGame ? onSelectBankForGame(bank) : handleEditBankMeta(bank)}
                className={`bg-white border p-5 rounded-2xl flex flex-col justify-between transition-all relative group cursor-pointer ${
                  onSelectBankForGame 
                    ? "border-emerald-150 hover:border-emerald-500 shadow-md hover:-translate-y-0.5" 
                    : "border-slate-200 hover:border-indigo-500 shadow-xs hover:shadow-md"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono font-black tracking-wider text-indigo-600 bg-indigo-55/40 border border-indigo-150 px-2 py-0.5 rounded-md">
                      📝 {bank.topic || "General"}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-400">
                      📅 {new Date(bank.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h4 className="text-md font-black text-slate-950 font-sans">{bank.name}</h4>
                  <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed">
                    {bank.description || "Sin descripción proporcionada."}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">
                    🏷️ <strong>{bank.words?.length || 0}</strong> palabras
                  </span>

                  <div className="flex items-center gap-1.5">
                    {onSelectBankForGame && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectBankForGame(bank);
                        }}
                        className="p-1 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Play size={10} />
                        <span>Usar</span>
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditBankMeta(bank);
                      }}
                      className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                      title="Editar banco"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={(e) => handleDuplicateBank(bank.id, e)}
                      className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                      title="Duplicar banco"
                    >
                      <Copy size={12} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteBank(bank.id, e)}
                      className="p-1.5 hover:bg-red-50 text-red-600 border border-transparent hover:border-red-200 rounded-lg transition-colors cursor-pointer"
                      title="Eliminar banco"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Editing Word Bank Form */}
      {isEditingBank && activeBank && (
        <div className="space-y-6" id="word-bank-form-editor">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-5 rounded-2xl border border-slate-200">
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider">Nombre del Banco</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Ej. Anatomía Biológica, Conceptos Física"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-indigo-600"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider">Temática / Categoría</label>
              <input
                type="text"
                value={bankTopic}
                onChange={(e) => setBankTopic(e.target.value)}
                placeholder="Ej. Medicina, Mecánica"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-indigo-600"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider">Descripción del Banco</label>
              <input
                type="text"
                value={bankDesc}
                onChange={(e) => setBankDesc(e.target.value)}
                placeholder="Detalla de qué trata esta recopilación"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-indigo-600"
              />
            </div>
          </div>

          {/* Words sub-editor */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                🏷️ Palabras ({activeBank.words.length})
              </h3>

              <div className="flex items-center gap-2">
                {/* Real File Upload */}
                <label className="flex items-center gap-1 text-[11px] font-mono font-black text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 px-3 py-1.5 rounded-lg cursor-pointer transition-all">
                  <Upload size={12} />
                  <span>Subir .TXT / .CSV</span>
                  <input
                    type="file"
                    accept=".txt,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={() => setShowBulkImport(!showBulkImport)}
                  className="flex items-center gap-1 text-[11px] font-mono font-black text-indigo-700 bg-indigo-50 border border-indigo-150 hover:bg-indigo-100 px-3 py-1.5 rounded-lg cursor-pointer transition-all"
                >
                  <Sparkles size={11} />
                  <span>Pegar Lista</span>
                </button>
              </div>
            </div>

            {/* Bulk Text Import Pane */}
            {showBulkImport && (
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-3">
                <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">
                  Ingresa palabras, cada una en una línea nueva. Elige entre simplificado o enriquecido:
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px] text-slate-400 font-mono">
                  <div>
                    <span className="font-bold text-slate-600 block">Formato Simplificado:</span>
                    <pre className="bg-white p-2 border border-slate-150 rounded mt-1 overflow-auto max-h-24">
{`Fotosíntesis
Mitosis
Enlace covalente`}
                    </pre>
                  </div>
                  <div>
                    <span className="font-bold text-slate-600 block">Formato Enriquecido:</span>
                    <pre className="bg-white p-2 border border-slate-150 rounded mt-1 overflow-auto max-h-24">
{`Palabra: pH
Categoría: Química
Dificultad: Media
Pista: Medida de acidez`}
                    </pre>
                  </div>
                </div>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  rows={5}
                  placeholder={`Palabra: Fotosíntesis\nCategoría: Biología\nDificultad: Media\nPista: Proceso de las plantas`}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:outline-indigo-600"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowBulkImport(false)}
                    className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg font-black text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleBulkImport}
                    className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-lg font-black text-xs cursor-pointer hover:bg-indigo-700 transition"
                  >
                    Procesar Palabras
                  </button>
                </div>
              </div>
            )}

            {/* Word Incremental input form */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end p-4 border border-dashed border-slate-200 bg-slate-50/50 rounded-2xl">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Palabra / Concepto</span>
                <input
                  type="text"
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  placeholder="Ej. Fotosíntesis"
                  className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-lg text-xs font-bold text-slate-900 focus:outline-indigo-600"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Categoría específica</span>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Ej. Biología Celular"
                  className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-lg text-xs font-bold text-slate-900 focus:outline-indigo-600"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Dificultad</span>
                <select
                  value={newDifficulty}
                  onChange={(e) => setNewDifficulty(e.target.value as any)}
                  className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-lg text-xs font-bold text-slate-900 focus:outline-indigo-600"
                >
                  <option value="Fácil">🟢 Fácil (+1)</option>
                  <option value="Media">🟡 Media (+2)</option>
                  <option value="Difícil">🔴 Difícil (+3)</option>
                </select>
              </div>

              <div className="space-y-1 sm:col-span-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Pista (Aparece en pantalla)</span>
                <input
                  type="text"
                  value={newHint}
                  onChange={(e) => setNewHint(e.target.value)}
                  placeholder="Ej. Proceso por el cual las plantas producen energía"
                  className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-lg text-xs font-bold text-slate-900 focus:outline-indigo-600"
                />
              </div>

              <button
                onClick={handleAddOrUpdateWord}
                className="py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                <Plus size={13} />
                <span>{editingWordId ? "Guardar Cambios" : "Agregar Palabra"}</span>
              </button>
            </div>

            {/* List of active words of this bank */}
            <div className="border border-slate-100 rounded-xl max-h-80 overflow-y-auto">
              {activeBank.words.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-mono text-xs select-none">
                  Aún no has agregado palabras. Utiliza los campos de arriba para empezar.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {activeBank.words.map((w, idx) => (
                    <div key={w.id} className="flex flex-wrap items-center justify-between p-3.5 hover:bg-slate-50/50 transition-colors gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-mono font-bold text-slate-400 w-5">#{idx + 1}</span>
                        <div>
                          <h5 className="text-xs font-black text-slate-950 font-sans flex items-center gap-2">
                            {w.word}
                            {w.category && (
                              <span className="bg-slate-150 text-slate-600 text-[9px] px-1.5 py-0.2 rounded uppercase font-bold font-mono">
                                {w.category}
                              </span>
                            )}
                          </h5>
                          {w.hint && (
                            <span className="text-[10px] font-mono text-slate-400">💡 Pista: {w.hint}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border font-mono ${
                          w.difficulty === "Fácil" ? "bg-emerald-50 border-emerald-150 text-emerald-600" :
                          w.difficulty === "Media" ? "bg-amber-50 border-amber-150 text-amber-700" :
                          "bg-red-55 border-red-150 text-red-600"
                        }`}>
                          {w.difficulty}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleStartEditWord(w)}
                            className="p-1 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 text-indigo-600 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            onClick={() => handleDeleteWord(w.id)}
                            className="p-1 hover:bg-red-50 border border-transparent hover:border-red-150 text-red-600 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Save bar */}
          <div className="flex items-center justify-end gap-3 select-none">
            <button
              onClick={() => setIsEditingBank(false)}
              className="px-4 py-2 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 font-black text-xs rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveBank}
              className="flex items-center gap-1 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl cursor-pointer shadow-md transition-all border border-indigo-750"
            >
              <Save size={13} />
              <span>Guardar en SQLite</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
