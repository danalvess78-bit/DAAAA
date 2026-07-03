import React, { useState, useEffect } from "react";
import { 
  ClipboardCheck, Clock, Trash2, Search, FileImage, 
  Upload, HelpCircle, Check, AlertTriangle, Image as ImageIcon, 
  Eye, X, ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../lib/api.js";
import { User, RecruitLesson, MilitaryRank, getRankOrder } from "../types.js";
import ConfirmModal from "./ConfirmModal.js";

interface RecruitLessonsPanelProps {
  user: User;
}

export default function RecruitLessonsPanel({ user }: RecruitLessonsPanelProps) {
  const [lessons, setLessons] = useState<RecruitLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [studentNick, setStudentNick] = useState("");
  const [lessonCategory, setLessonCategory] = useState("Curso de Formação de Soldados (CFS)");
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [status, setStatus] = useState<"Aprovado" | "Reprovado">("Aprovado");
  const [notes, setNotes] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Filter/Search states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"Todos" | "Aprovado" | "Reprovado">("Todos");

  // Deletion modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  // Enlarged image viewer (Lightbox) state
  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);

  const fetchLessons = async () => {
    setLoading(true);
    try {
      const data = await api.getRecruitLessons();
      setLessons(data);
    } catch (err: any) {
      setError(err.message || "Erro ao obter relatórios de aulas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLessons();
    const loadCategories = async () => {
      try {
        const catList = await api.getTrainingCategories();
        // Filter categories so only those with minRank <= user.role are visible
        const allowedCategories = (catList || []).filter((c: any) => {
          const minRankVal = typeof c === 'string' ? MilitaryRank.SOLDADO : (c.minRank || MilitaryRank.SOLDADO);
          return getRankOrder(user.role) >= getRankOrder(minRankVal);
        });
        const catNames = allowedCategories.map((c: any) => typeof c === 'string' ? c : c.name);
        const merged = Array.from(new Set(["Curso de Formação de Soldados (CFS)", ...catNames]));
        setAvailableCategories(merged);
        setLessonCategory(merged[0]);
      } catch (err) {
        console.warn("Erro ao obter categorias de treinamento para relatórios de aula:", err);
        setAvailableCategories(["Curso de Formação de Soldados (CFS)"]);
      }
    };
    loadCategories();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setUploadProgress("Enviando arquivo ao servidor...");

    try {
      const resp = await api.uploadPrintImage(file);
      setScreenshotUrl(resp.url);
      setUploadProgress("Upload concluído com sucesso!");
      setTimeout(() => setUploadProgress(null), 3000);
    } catch (err: any) {
      alert("Erro ao realizar upload da imagem: " + err.message);
      setUploadProgress(null);
    } finally {
      setUploadingImage(false);
    }
  };

  const handlePostLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentNick.trim()) {
      alert("Por favor escreva o nick do recruta de forma precisa.");
      return;
    }

    try {
      await api.createRecruitLesson({
        studentNick: studentNick.trim(),
        category: lessonCategory,
        status,
        notes: notes.trim(),
        screenshotUrl
      });

      // Clean form fields
      setStudentNick("");
      setNotes("");
      setScreenshotUrl("");
      alert(`Relatório registrado com sucesso para os recrutas descritos!`);
      fetchLessons();
    } catch (err: any) {
      alert("Error ao salvar aula: " + err.message);
    }
  };

  const triggerDeleteConfirm = (lessonId: string) => {
    setSelectedLessonId(lessonId);
    setModalOpen(true);
  };

  const executeDeleteLesson = async () => {
    if (!selectedLessonId) return;
    try {
      await api.deleteRecruitLesson(selectedLessonId);
      setLessons(prev => prev.filter(l => l.id !== selectedLessonId));
    } catch (err: any) {
      alert("Falha ao excluir registro de aula: " + err.message);
    } finally {
      setModalOpen(false);
      setSelectedLessonId(null);
    }
  };

  const filteredLessons = lessons.filter(lesson => {
    const matchSearch = 
      lesson.studentNick.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lesson.instructorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lesson.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchStatus = 
      statusFilter === "Todos" || 
      lesson.status === statusFilter;

    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6 font-mono">
      {/* Title block */}
      <div className="pb-3 border-b border-fmb-army/20 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        <div>
          <h2 className="font-display font-black text-lg text-white uppercase tracking-wider flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-fmb-gold" />
            <span>POSTAR AULAS & ATAS MILITARES</span>
          </h2>
          <p className="text-[10px] text-gray-500 mt-1">
            Registro formal de cursos, formações elementares e condutas ministradas para novos soldados alistados no QG.
          </p>
        </div>
        <div className="text-[10px] bg-fmb-slate text-fmb-gold uppercase px-2.5 py-1 border border-fmb-army/20 font-bold shrink-0 self-start md:self-center">
          INSTRUTOR ATIVO: @{user.habboNick}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* RIGHT COLUMN - NEW REPORT FORM */}
        <div className="lg:col-span-5 bg-fmb-slate/40 border border-fmb-army/30 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-fmb-army/10">
            <ClipboardCheck className="w-4.5 h-4.5 text-fmb-gold" />
            <h3 className="text-xs uppercase font-bold text-white tracking-wider">Novo Relatório Militar</h3>
          </div>

          <form onSubmit={handlePostLesson} className="space-y-4 text-xs">
            {/* Recruit Nick */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-gray-400 block font-bold">
                Nicks de Alunos / Recrutas (separe por vírgula):
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-fmb-gold">@</span>
                <input
                  type="text"
                  required
                  placeholder="Ex: Recruta1, Recruta2, Recruta3"
                  value={studentNick}
                  onChange={(e) => setStudentNick(e.target.value)}
                  className="w-full bg-fmb-black/80 border border-fmb-army/40 focus:border-fmb-gold text-white font-mono text-xs rounded px-3 py-2 pl-7 placeholder-gray-600 outline-none transition-colors"
                />
              </div>
            </div>

            {/* Category / Class Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-gray-400 block font-bold">
                Curso / Aula Ministrada:
              </label>
              <select
                value={lessonCategory}
                onChange={(e) => setLessonCategory(e.target.value)}
                className="w-full bg-fmb-black/80 border border-fmb-army/40 focus:border-fmb-gold text-white font-mono text-xs rounded px-3 py-2 outline-none transition-colors cursor-pointer"
              >
                {availableCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                {availableCategories.length === 0 && (
                  <option value="Curso de Formação de Soldados (CFS)">Curso de Formação de Soldados (CFS)</option>
                )}
              </select>
            </div>

            {/* Approval status */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-gray-400 block font-bold">
                Resultado Final da Instrução:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus("Aprovado")}
                  className={`py-2 rounded font-mono font-bold uppercase transition-all tracking-wider text-[10px] border flex items-center justify-center space-x-1 ${
                    status === "Aprovado"
                      ? "bg-green-950/40 text-green-400 border-green-500/50 shadow-inner"
                      : "bg-fmb-black/40 text-gray-500 border-fmb-army/20 hover:border-fmb-army/50"
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Aprovado</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatus("Reprovado")}
                  className={`py-2 rounded font-mono font-bold uppercase transition-all tracking-wider text-[10px] border flex items-center justify-center space-x-1 ${
                    status === "Reprovado"
                      ? "bg-red-950/40 text-red-400 border-red-500/50 shadow-inner"
                      : "bg-fmb-black/40 text-gray-500 border-fmb-army/20 hover:border-fmb-army/50"
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Reprovado</span>
                </button>
              </div>
            </div>

            {/* Image Print Upload / URL Input */}
            <div className="space-y-1.5 p-3.5 bg-fmb-black/60 border border-fmb-army/25 rounded">
              <label className="text-[11px] uppercase tracking-wider text-fmb-gold block font-bold flex items-center gap-1.5">
                <FileImage className="w-4 h-4" />
                <span>Comprovante Visual (Print do Teste/Aula)</span>
              </label>
              <p className="text-[9px] text-gray-500 leading-tight">
                Selecione um arquivo de captura (print) de sua instrução diretamente de seu computador/celular.
              </p>

              {/* Direct image file upload picker */}
              <div className="pt-2">
                <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-fmb-army/30 hover:border-fmb-gold/40 rounded cursor-pointer transition-all bg-fmb-black/40 hover:bg-fmb-slate/30 group">
                  <Upload className="w-5 h-5 text-fmb-gold/60 group-hover:text-fmb-gold transition-colors mb-1.5" />
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider text-center">
                    {uploadingImage ? "Enviando fita ao servidor..." : "Anexar print do teste"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={uploadingImage}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Image feedback preview or URL */}
              <div className="pt-2">
                <p className="text-[10px] text-gray-400 font-bold mb-1">Ou digite o link da imagem:</p>
                <input
                  type="url"
                  placeholder="https://i.imgur.com/exemplo.png"
                  value={screenshotUrl}
                  onChange={(e) => setScreenshotUrl(e.target.value)}
                  className="w-full bg-fmb-black border border-fmb-army/45 text-white font-mono text-[10px] rounded px-2.5 py-1.5 placeholder-gray-700 outline-none focus:border-fmb-gold"
                />
              </div>

              {uploadProgress && (
                <div className="pt-2 text-[9px] text-fmb-gold animate-pulse text-center">
                  💡 {uploadProgress}
                </div>
              )}

              {screenshotUrl && (
                <div className="mt-3 relative p-1.5 bg-fmb-slate/60 border border-fmb-gold/25 rounded flex items-center gap-3">
                  <div className="relative w-12 h-12 bg-fmb-black rounded overflow-hidden flex items-center justify-center border border-fmb-army/30 shrink-0">
                    <img src={screenshotUrl} alt="Anexo do teste" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0 pr-6">
                    <p className="text-[8px] uppercase font-mono font-bold text-green-400">✅ Print Selecionado</p>
                    <span className="text-[8px] text-gray-500 font-mono block truncate">{screenshotUrl}</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setScreenshotUrl("")}
                    className="absolute right-1.5 top-1.5 text-gray-500 hover:text-red-400 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Extra notes */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-gray-400 block font-bold">
                Observações Adicionais / Histórico do Teste:
              </label>
              <textarea
                rows={3}
                placeholder="Descreva detalhes como comportamento, pontuação total no percurso tático etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-fmb-black/80 border border-fmb-army/40 focus:border-fmb-gold text-white font-mono text-xs rounded px-3 py-2 placeholder-gray-600 outline-none resize-none transition-colors"
              />
            </div>

            {/* Action button */}
            <button
              type="submit"
              className="w-full bg-fmb-army hover:bg-fmb-olive text-white border border-fmb-gold/40 text-[10px] font-bold uppercase py-2.5 rounded tracking-widest cursor-pointer shadow-lg hover:shadow-xl transition-all"
            >
              SALVAR RELATÓRIO DE AULA 📂
            </button>
          </form>
        </div>

        {/* LEFT COLUMN - CHRONOLOGICAL LOGS & HISTORY */}
        <div className="lg:col-span-7 space-y-4">
          {/* Controls bar */}
          <div className="bg-fmb-slate/40 border border-fmb-army/30 rounded-lg p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-2 text-gray-500 w-4 h-4" />
              <input
                type="text"
                placeholder="Filtrar por nome de Recruta ou Instrutor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-fmb-black/70 border border-fmb-army/40 focus:border-fmb-gold text-white font-mono text-xs rounded pl-8.5 pr-3 py-1.5 placeholder-gray-600 outline-none"
              />
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <span className="text-[10px] uppercase font-bold text-gray-400">Resultado:</span>
              <div className="flex border border-fmb-army/30 rounded p-0.5 bg-fmb-black/40">
                {(["Todos", "Aprovado", "Reprovado"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setStatusFilter(v)}
                    className={`px-2.5 py-0.5 rounded text-[9px] font-bold uppercase transition-all ${
                      statusFilter === v 
                        ? "bg-fmb-army text-white" 
                        : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Lessons list display */}
          <div className="space-y-3.5 max-h-[560px] overflow-y-auto pr-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <span className="w-7 h-7 border-4 border-fmb-gold border-t-transparent animate-spin rounded-full inline-block" />
                <p className="text-[10px] text-gray-500 font-mono uppercase">Carregando livro de relatórios escolares FMB...</p>
              </div>
            ) : filteredLessons.length === 0 ? (
              <div className="text-center p-12 border border-dashed border-fmb-army/20 rounded bg-fmb-slate/20">
                <ClipboardCheck className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                <p className="text-[11px] text-gray-400 uppercase font-black">Nenhuma aula registrada localizada</p>
                <p className="text-[9px] text-gray-600 font-mono mt-1">Insira os primeiros nicks de recrutas do lado esquerdo para salvar relatórios.</p>
              </div>
            ) : (
              <AnimatePresence>
                {filteredLessons.map((lesson) => (
                  <motion.div
                    key={lesson.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-fmb-black/75 border border-fmb-army/30 hover:border-fmb-army/50 rounded p-4 relative transition-colors space-y-3"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 border-b border-fmb-army/10 pb-2.5">
                      <div>
                        {/* Student Nick */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-white hover:text-fmb-gold cursor-pointer">
                            Recruta: @{lesson.studentNick}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase inline-flex items-center space-x-1 border ${
                            lesson.status === "Aprovado"
                              ? "bg-green-950/45 text-green-400 border-green-800/40"
                              : "bg-red-950/45 text-red-400 border-red-800/40"
                          }`}>
                            <span>{lesson.status}</span>
                          </span>
                        </div>
                        <p className="text-[10px] text-fmb-gold font-bold mt-1 uppercase">
                          {lesson.category}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right text-[9px] text-gray-500 font-mono leading-normal">
                          <p>Data: {new Date(lesson.createdAt).toLocaleDateString("pt-BR")}</p>
                          <p>Hora: {new Date(lesson.createdAt).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        {/* Trash Button */}
                        <button
                          onClick={() => triggerDeleteConfirm(lesson.id)}
                          className="p-1 px-1.5 bg-fmb-slate border border-fmb-army/15 rounded text-gray-500 hover:text-red-500 transition-colors hover:border-red-500/20"
                          title="Remover este relatório"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Middle Section: Screenshot Print & Observations */}
                    <div className="flex flex-col sm:flex-row gap-4 items-start">
                      {lesson.screenshotUrl ? (
                        <div className="relative group overflow-hidden w-full sm:w-28 h-20 rounded bg-fmb-slate border border-fmb-army/20 shrink-0 select-none">
                          <img 
                            src={lesson.screenshotUrl} 
                            alt={`Print @${lesson.studentNick}`}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105" 
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <button
                              onClick={() => setActiveLightboxImage(lesson.screenshotUrl || null)}
                              className="p-1 rounded bg-fmb-gold hover:bg-white text-fmb-black transition-colors"
                              title="Ampliar captura"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full sm:w-28 h-20 rounded bg-fmb-slate/20 border border-fmb-army/10 flex flex-col items-center justify-center shrink-0 p-2 text-center text-gray-600 select-none">
                          <HelpCircle className="w-4 h-4 mb-1" />
                          <span className="text-[7.5px] uppercase leading-tight font-bold">Sem cap. de tela</span>
                        </div>
                      )}

                      <div className="flex-1 space-y-2">
                        {/* Instructor */}
                        <p className="text-[10px] text-gray-400 font-bold">
                          Instrutor Responsável: <span className="text-white">@{lesson.instructorName}</span>
                        </p>
                        
                        {/* Observations / notes */}
                        {lesson.notes ? (
                          <p className="text-[10px] text-gray-400 italic bg-fmb-slate/30 border-l border-fmb-gold/30 p-2 rounded leading-relaxed">
                            "{lesson.notes}"
                          </p>
                        ) : (
                          <p className="text-[9.5px] text-gray-600 italic">No observações inseridas.</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal to Delete Lesson report */}
      <ConfirmModal
        isOpen={modalOpen}
        title="Deseja mesmo remover a aula?"
        message="Atenção instrutor: deletar esta ficha de instrução militar irá apagar permanentemente este relatório dos registros de aulas FMB. Deseja prosseguir?"
        confirmLabel="Sim, deletar"
        isDanger={true}
        onConfirm={executeDeleteLesson}
        onCancel={() => { setModalOpen(false); setSelectedLessonId(null); }}
      />

      {/* Image Lightbox View Overlay Modal */}
      {activeLightboxImage && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4 font-mono">
          <div className="absolute top-4 right-4 flex items-center space-x-3 z-10">
            <a 
              href={activeLightboxImage} 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-fmb-slate text-[10px] uppercase font-bold text-fmb-gold border border-fmb-army/20 hover:bg-fmb-army hover:text-white transition-all cursor-pointer"
            >
              <span>link original</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={() => setActiveLightboxImage(null)}
              className="p-1 px-2.5 rounded bg-fmb-gold hover:bg-white text-fmb-black text-[11px] font-bold uppercase transition-colors cursor-pointer"
            >
              fechar
            </button>
          </div>

          <div className="w-full max-w-4xl max-h-[80vh] overflow-auto flex items-center justify-center p-2">
            <img 
              src={activeLightboxImage} 
              alt="Ampliação do comprovante"
              className="max-h-[75vh] max-w-full rounded border border-fmb-gold shadow-2xl object-contain bg-fmb-black"
              referrerPolicy="no-referrer"
            />
          </div>
          <p className="text-[10px] text-gray-500 mt-2 text-center">
            Pressione Esc ou clique em fechar no canto superior direito para retornar ao Command Center.
          </p>
        </div>
      )}
    </div>
  );
}
