import React, { useEffect, useState } from "react";
import { 
  BookOpen, Plus, Search, FileText, Calendar, User, Trash2, 
  Edit2, Eye, X, Download, Lock, CheckCircle, Lightbulb, AlertCircle,
  Maximize2, Minimize2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../lib/api.js";
import { User as UserType, PoliceDocument, MilitaryRank } from "../types.js";
import ConfirmModal from "./ConfirmModal.js";

interface DocumentsPanelProps {
  viewer: UserType;
}

export default function DocumentsPanel({ viewer }: DocumentsPanelProps) {
  const [documents, setDocuments] = useState<PoliceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Custom permissions checker
  const [hierarchyConfigs, setHierarchyConfigs] = useState<any[]>([]);
  const [hasWriteAccess, setHasWriteAccess] = useState(false);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  // Active document tab section
  const [activeSection, setActiveSection] = useState<"standard" | "instrutores" | "aman">("standard");
  const [allSubCargos, setAllSubCargos] = useState<any[]>([]);

  // Drawer / View state
  const [selectedDoc, setSelectedDoc] = useState<PoliceDocument | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docCategory, setDocCategory] = useState<string>("");
  const [docContent, setDocContent] = useState("");
  const [docAttachment, setDocAttachment] = useState("");
  const [docSection, setDocSection] = useState<"standard" | "instrutores" | "aman">("standard");
  const [docAllowedRanks, setDocAllowedRanks] = useState<string[]>([]);
  const [docAllowedSubCargos, setDocAllowedSubCargos] = useState<string[]>([]);
  const [docInstructorTag, setDocInstructorTag] = useState("");

  // Edit states
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editDocTitle, setEditDocTitle] = useState("");
  const [editDocCategory, setEditDocCategory] = useState<string>("");
  const [editDocContent, setEditDocContent] = useState("");
  const [editDocAttachment, setEditDocAttachment] = useState("");
  const [editDocSection, setEditDocSection] = useState<"standard" | "instrutores" | "aman">("standard");
  const [editDocAllowedRanks, setEditDocAllowedRanks] = useState<string[]>([]);
  const [editDocAllowedSubCargos, setEditDocAllowedSubCargos] = useState<string[]>([]);
  const [editDocInstructorTag, setEditDocInstructorTag] = useState("");

  // Dynamic document categories states
  const [categories, setCategories] = useState<string[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);

  // Upload states
  const [uploadingAdd, setUploadingAdd] = useState(false);
  const [uploadingEdit, setUploadingEdit] = useState(false);

  // Deletion Confirmation Modal State
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const docsList = await api.getDocuments();
      setDocuments(docsList || []);

      // Load hierarchy configs to assert write access
      const hierarchy = await api.getHierarchy();
      setHierarchyConfigs(hierarchy || []);

      // Load sub-cargos list
      try {
        const subCargosList = await api.getSubCargos();
        setAllSubCargos(subCargosList || []);
      } catch (scErr) {
        console.warn("Erro ao obter subcargos no painel de documentos:", scErr);
      }

      const userConfig = hierarchy.find((rc: any) => rc.rank === viewer.role);
      const canManage = viewer.role === MilitaryRank.ADMSUPREMO || !!userConfig?.permissions?.canManageDocs;
      setHasWriteAccess(canManage);

      // Load dynamic document categories
      try {
        const cats = await api.getDocumentCategories();
        const activeCats = cats || [];
        setCategories(activeCats);
        if (activeCats.length > 0) {
          setSelectedCategory(prev => {
            if (!prev || prev === "all" || !activeCats.includes(prev)) {
              return activeCats[0];
            }
            return prev;
          });
          setDocCategory(prev => {
            if (!prev || prev === "manual" || !activeCats.includes(prev)) {
              return activeCats[0];
            }
            return prev;
          });
          setEditDocCategory(prev => {
            if (!prev || prev === "manual" || !activeCats.includes(prev)) {
              return activeCats[0];
            }
            return prev;
          });
        }
      } catch (catErr: any) {
        console.warn("Falha ao obter categorias de documentos:", catErr.message);
      }

    } catch (err: any) {
      setError(err.message || "Erro ao carregar repositório de documentos.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      alert("Operação bloqueada: Apenas arquivos no formato PDF tático são aceitos para materiais oficiais.");
      return;
    }

    if (isEdit) {
      setUploadingEdit(true);
    } else {
      setUploadingAdd(true);
    }

    const formData = new FormData();
    formData.append("pdf", file);

    try {
      const token = localStorage.getItem("fmb_token");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/upload", {
        method: "POST",
        headers,
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro de transferência com o servidor.");
      }

      const data = await res.json();
      if (isEdit) {
        setEditDocAttachment(data.url);
      } else {
        setDocAttachment(data.url);
      }
      alert("Arquivo PDF adicionado e linkado com absoluto sucesso!");
    } catch (err: any) {
      alert(err.message || "Fracasso ao carregar PDF para o QG.");
    } finally {
      if (isEdit) {
        setUploadingEdit(false);
      } else {
        setUploadingAdd(false);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle || !docContent) {
      alert("Preencha o título e o conteúdo do documento.");
      return;
    }

    try {
      await api.createDocument(
        docTitle, 
        docCategory, 
        docContent, 
        docAttachment,
        docSection,
        docAllowedRanks,
        docAllowedSubCargos,
        docInstructorTag
      );
      setShowAddModal(false);
      setDocTitle("");
      setDocContent("");
      setDocAttachment("");
      setDocSection("standard");
      setDocAllowedRanks([]);
      setDocAllowedSubCargos([]);
      setDocInstructorTag("");
      loadData();
    } catch (err: any) {
      alert(err.message || "Erro ao publicar material.");
    }
  };

  const handleStartEdit = (doc: PoliceDocument) => {
    setEditingDocId(doc.id);
    setEditDocTitle(doc.title);
    setEditDocCategory(doc.category);
    setEditDocContent(doc.content);
    setEditDocAttachment(doc.attachmentUrl || "");
    setEditDocSection(doc.section || "standard");
    setEditDocAllowedRanks(doc.allowedRanks || []);
    setEditDocAllowedSubCargos(doc.allowedSubCargos || []);
    setEditDocInstructorTag(doc.instructorTag || "");
    // Close reader drawer if active to avoid confusion
    setSelectedDoc(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDocTitle || !editDocContent || !editingDocId) {
      alert("Título e conteúdo são essenciais.");
      return;
    }

    try {
      await api.updateDocument(
        editingDocId, 
        editDocTitle, 
        editDocCategory, 
        editDocContent, 
        editDocAttachment,
        editDocSection,
        editDocAllowedRanks,
        editDocAllowedSubCargos,
        editDocInstructorTag
      );
      setEditingDocId(null);
      loadData();
    } catch (err: any) {
      alert(err.message || "Erro ao gravar retificação.");
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await api.deleteDocument(confirmDeleteId);
      if (selectedDoc?.id === confirmDeleteId) {
        setSelectedDoc(null);
      }
      loadData();
    } catch (err: any) {
      alert(err.message || "Falha ao apagar documento.");
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setAddingCategory(true);
    try {
      await api.addDocumentCategory(newCategoryName.trim());
      const updatedCats = await api.getDocumentCategories();
      setCategories(updatedCats || []);
      setNewCategoryName("");
      alert("Categoria de documento adicionada com sucesso!");
    } catch (err: any) {
      alert(err.message || "Erro ao adicionar categoria.");
    } finally {
      setAddingCategory(false);
    }
  };

  const handleDeleteCategory = async (catToDelete: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir a categoria "${getCategoryLabel(catToDelete)}"? Todos os documentos vinculados a ela serão movidos para "Outros".`)) {
      return;
    }
    try {
      await api.deleteDocumentCategory(catToDelete);
      const updatedCats = await api.getDocumentCategories();
      const activeCats = updatedCats || [];
      setCategories(activeCats);
      const docsList = await api.getDocuments();
      setDocuments(docsList || []);
      
      if (activeCats.length > 0) {
        setSelectedCategory(activeCats[0]);
        setDocCategory(activeCats[0]);
      } else {
        setSelectedCategory("");
        setDocCategory("");
      }
      alert("Categoria excluída com sucesso!");
    } catch (err: any) {
      alert(err.message || "Erro ao excluir categoria.");
    }
  };

  const allCategories = categories;

  // Filter logic
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          doc.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          doc.authorNick.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Category matches
    const matchesCategory = !selectedCategory || doc.category === selectedCategory;

    // Matches Section (standard, instrutores, aman)
    const docSection = doc.section || "standard";
    const matchesSection = docSection === activeSection;

    // View Permissions:
    const isSupremo = viewer.role === MilitaryRank.ADMSUPREMO;
    const isAuthor = doc.authorNick === viewer.habboNick;
    
    const hasRankRestriction = doc.allowedRanks && doc.allowedRanks.length > 0;
    const hasSubCargoRestriction = doc.allowedSubCargos && doc.allowedSubCargos.length > 0;
    
    let allowedByPermission = true;
    if (hasRankRestriction || hasSubCargoRestriction) {
      allowedByPermission = false;
      
      if (hasRankRestriction && doc.allowedRanks?.includes(viewer.role)) {
        allowedByPermission = true;
      }
      
      if (hasSubCargoRestriction && viewer.subCargos && viewer.subCargos.some(sc => doc.allowedSubCargos?.includes(sc))) {
        allowedByPermission = true;
      }
    }

    const matchesPermission = isSupremo || isAuthor || allowedByPermission;

    return matchesSearch && matchesCategory && matchesSection && matchesPermission;
  });

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case "manual": return "Manual de Doutrina";
      case "aula": return "Script de Aula / PDF";
      case "roteiro": return "Roteiro Operacional";
      case "diretriz": return "Diretrizes Oficiais";
      default: return cat;
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "manual": return "border-blue-500/30 text-blue-400 bg-blue-950/20";
      case "aula": return "border-green-500/30 text-green-400 bg-green-950/20";
      case "roteiro": return "border-amber-500/30 text-amber-400 bg-amber-950/20";
      case "diretriz": return "border-red-500/30 text-red-400 bg-red-950/20";
      default: return "border-gray-500/30 text-gray-400 bg-gray-950/20";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-fmb-army/20">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-5 h-5 text-fmb-gold" />
          <h3 className="font-display font-bold text-lg text-white uppercase tracking-tight">Biblioteca Confidencial de Documentos</h3>
        </div>

        {hasWriteAccess && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowCategoryModal(true)}
              className="bg-fmb-black hover:bg-fmb-slate border border-fmb-army/40 text-fmb-gold px-3 py-1.5 rounded font-mono text-[10px] uppercase tracking-wider font-bold flex items-center space-x-1 cursor-pointer transition-colors"
              id="manage-categories-btn"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Criar Categorias</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-fmb-army hover:bg-fmb-olive border border-fmb-gold/40 text-white px-3 py-1.5 rounded font-mono text-[10px] uppercase tracking-wider font-bold flex items-center space-x-1 cursor-pointer transition-colors"
              id="publish-doc-btn"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Postar Manual / Aula</span>
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT TWO-THIRDS: MAIN SEARCH & DOCS LIST */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* SEÇÕES DO ACERVO DE DOCUMENTOS (Removido Instrutores/AMAN para a aba própria) */}
          <div className="bg-fmb-black/40 border border-fmb-army/30 rounded p-3 mb-1">
            <h3 className="font-display font-black text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>📂</span> Acervo de Documentos Gerais
            </h3>
            <p className="text-[9px] font-mono text-gray-400 mt-1">
              Manuais gerais de instrução, condutas regulamentares e decretos do exército. Documentos para Instrutores e AMAN foram migrados para a aba exclusiva de Instrutores.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {/* Search Input */}
            <div className="relative w-full">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Pesquisar manuais, apostilas de aula, scripts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-fmb-black border border-fmb-army/30 rounded py-1.5 pl-10 pr-4 text-white text-xs outline-none focus:border-fmb-gold font-mono"
              />
            </div>

            {/* Category Pages Tabs */}
            <div className="flex flex-wrap gap-1.5 border-b border-fmb-army/10 pb-3" id="documents-category-tabs">
              {allCategories.length === 0 ? (
                <span className="text-[10px] text-gray-500 font-bold uppercase py-1">Nenhuma categoria operacional cadastrada</span>
              ) : (
                allCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded font-mono text-[9px] uppercase tracking-wider font-bold transition-all border cursor-pointer ${
                      selectedCategory === cat
                        ? "bg-fmb-army border-fmb-gold text-white shadow-md font-extrabold"
                        : "bg-fmb-black/40 text-gray-400 border-fmb-army/20 hover:text-white"
                    }`}
                  >
                    {getCategoryLabel(cat)}
                  </button>
                ))
              )}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-10 font-mono text-gray-500 text-xs">Descortinando arquivos da inteligência...</div>
          ) : filteredDocuments.length === 0 ? (
            <div className="border border-fmb-army/20 p-8 rounded text-center text-xs font-mono text-gray-500">
              Nenhum compêndio ou manual militar localizado para os filtros informados.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDocuments.map(doc => (
                <div 
                  key={doc.id}
                  className={`p-4 bg-fmb-slate/20 border rounded-lg transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    selectedDoc?.id === doc.id ? "border-fmb-gold bg-fmb-slate/45" : "border-fmb-army/20 hover:border-fmb-army/55"
                  }`}
                >
                  <div className="flex items-start space-x-3 text-left">
                    <div className="p-2.5 bg-fmb-black rounded border border-fmb-army/35 text-fmb-gold mt-0.5 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>

                    <div className="font-mono leading-tight">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[8.5px] px-1.5 py-0.5 border rounded uppercase font-bold ${getCategoryColor(doc.category)}`}>
                          {getCategoryLabel(doc.category)}
                        </span>
                        {doc.instructorTag && (
                          <span className="text-[8.5px] px-1.5 py-0.5 border border-fmb-gold text-fmb-gold bg-fmb-gold/10 rounded uppercase font-extrabold">
                            TAG: {doc.instructorTag}
                          </span>
                        )}
                        <span className="text-[9px] text-gray-500">
                          {new Date(doc.createdAt).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <span className="text-white text-xs block font-bold mt-1.5">{doc.title}</span>
                      <p className="text-[10px] text-gray-400 mt-1 line-clamp-2">{doc.content}</p>
                      
                      <span className="text-[8.5px] text-fmb-gold/80 block mt-2">
                        PUBLICADO POR: <strong className="text-white">@{doc.authorNick}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Core display actions */}
                  <div className="flex items-center space-x-2 self-end sm:self-center shrink-0">
                    <button
                      onClick={() => setSelectedDoc(doc)}
                      className="px-2.5 py-1.5 bg-fmb-army hover:bg-fmb-olive border border-fmb-gold/30 text-white rounded font-mono text-[9px] uppercase font-bold flex items-center space-x-1 transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Estudar</span>
                    </button>

                    {(viewer.habboNick === doc.authorNick || hasWriteAccess) && (
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleStartEdit(doc)}
                          className="p-1.5 border border-blue-900/30 bg-blue-950/10 hover:bg-blue-950 text-blue-300 rounded"
                          title="Editar Material"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="p-1.5 border border-red-900/30 bg-red-950/10 hover:bg-red-950 text-red-300 rounded"
                          title="Remover Material"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* RIGHT ONE-THIRD: DETAILED DOCUMENT CONTENT (studying drawer) */}
        <div className="space-y-4">
          <div className="p-4 bg-fmb-black/60 border border-fmb-army/30 rounded-lg text-left">
            <h4 className="font-display font-extrabold text-xs text-white uppercase tracking-wider mb-2 border-b border-fmb-army/10 pb-1.5">
              INFORMAÇÕES ACADÊMICAS
            </h4>
            <p className="text-[10px] font-mono text-gray-400 leading-normal">
              A disciplina de comandos FMB exige que todos os Recrutas e Cabos leiam assiduamente as aulas, mantendo postura impecável de escrita no Habbo original.
            </p>
          </div>

          <AnimatePresence mode="wait">
            {selectedDoc ? (
              <motion.div
                key={selectedDoc.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="bg-fmb-black border border-fmb-gold/40 rounded-lg p-5 space-y-4 shadow-xl text-left font-mono"
              >
                <div className="flex justify-between items-start border-b border-fmb-army/25 pb-3">
                  <div>
                    <span className={`text-[8px] px-2 py-0.5 border rounded uppercase font-bold ${getCategoryColor(selectedDoc.category)}`}>
                      {getCategoryLabel(selectedDoc.category)}
                    </span>
                    <h3 className="font-display font-extrabold text-sm text-white mt-2 leading-tight uppercase">
                      {selectedDoc.title}
                    </h3>
                  </div>
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <button 
                      onClick={() => setIsFullscreen(true)}
                      className="text-gray-400 hover:text-fmb-gold p-1 transition-colors"
                      title="Estudar em Tela Cheia"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setSelectedDoc(null)}
                      className="text-gray-400 hover:text-white p-1 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setIsFullscreen(true)}
                  className="w-full py-1.5 bg-fmb-army/20 hover:bg-fmb-army/45 border border-fmb-gold/30 hover:border-fmb-gold/60 text-fmb-gold rounded text-[10px] uppercase font-bold flex items-center justify-center space-x-1.5 transition-all"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Ler em Tela Cheia</span>
                </button>

                <div className="text-[11px] text-gray-300 leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto pr-1 border-t border-fmb-army/10 pt-3">
                  {selectedDoc.content}
                </div>

                {selectedDoc.attachmentUrl && (
                  <div className="p-3 bg-fmb-slate/30 border border-fmb-army/20 rounded flex items-center justify-between text-[10px]">
                    <span className="truncate max-w-[150px] text-gray-400">PDF: {selectedDoc.attachmentUrl}</span>
                    <a 
                      href={selectedDoc.attachmentUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-fmb-gold font-bold hover:underline flex items-center space-x-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Ver Anexo</span>
                    </a>
                  </div>
                )}

                <div className="pt-3 border-t border-fmb-army/15 text-[9px] text-gray-500 flex justify-between">
                  <span>Autor: @{selectedDoc.authorNick}</span>
                  <span>{new Date(selectedDoc.createdAt).toLocaleString("pt-BR")}</span>
                </div>
              </motion.div>
            ) : (
              <div className="border border-dashed border-fmb-army/20 p-8 rounded-lg text-center text-xs font-mono text-gray-500 py-16">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-20 text-fmb-gold" />
                <span>Selecione um manual ao lado para abrir o leitor confidencial.</span>
              </div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* CREATE DOCS MODAL */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-fmb-black border border-fmb-gold/40 text-white rounded-lg shadow-2xl p-6 relative"
            >
              <button 
                onClick={() => setShowAddModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-6">
                <BookOpen className="w-10 h-10 text-fmb-gold mx-auto mb-2" />
                <h3 className="font-display font-extrabold text-lg text-white uppercase">Publicar Documento Diplomático</h3>
                <p className="text-[10px] font-mono text-gray-400">DECRETAR MANUAL DE DOUTRINA OU SLIDES DE AULA</p>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4 font-mono text-xs text-left">
                <div>
                  <label className="text-[10px] text-fmb-gold block uppercase mb-1">Título do Documento</label>
                  <input
                    type="text"
                    placeholder="Ex: Manual de Conduta Policial e Continências"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    className="w-full bg-fmb-slate border border-fmb-army/30 py-2 px-3 rounded text-white outline-none focus:border-fmb-gold"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-fmb-gold block uppercase mb-1">Categoria</label>
                    <select
                      value={docCategory}
                      onChange={(e) => setDocCategory(e.target.value)}
                      className="w-full bg-fmb-slate border border-fmb-army/30 py-2 px-3 rounded text-white outline-none cursor-pointer font-mono text-[11px]"
                    >
                      {allCategories.map(cat => (
                        <option key={cat} value={cat}>
                          {getCategoryLabel(cat)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-fmb-gold block uppercase mb-1">Anexo Acadêmico (Link ou PDF)</label>
                    <input
                      type="text"
                      placeholder="https://drive.google.com/... ou faça upload"
                      value={docAttachment}
                      onChange={(e) => setDocAttachment(e.target.value)}
                      className="w-full bg-fmb-slate border border-fmb-army/30 py-2 px-3 rounded text-white outline-none focus:border-fmb-gold"
                    />
                  </div>
                </div>

                <div className="border border-dashed border-fmb-army/40 p-3 rounded bg-fmb-black/50 text-center relative hover:bg-fmb-black/80 transition-all cursor-pointer">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => handleFileUpload(e, false)}
                    className="absolute inset-x-0 inset-y-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={uploadingAdd}
                  />
                  <div className="flex items-center justify-center space-x-2 text-[10px] font-mono">
                    {uploadingAdd ? (
                      <div className="flex items-center space-x-1.5 text-fmb-gold">
                        <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Transmitindo arquivo PDF confidencial...</span>
                      </div>
                    ) : (
                      <div className="text-gray-300 hover:text-fmb-gold transition-colors flex items-center space-x-2">
                        <Download className="w-3.5 h-3.5 text-fmb-gold shrink-0 rotate-180" />
                        <span>Fazer Upload / Arrastar PDF do Manual</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* SEÇÃO, TAG DO INSTRUTOR E PERMISSÕES DINÂMICAS */}
                <div className="border border-fmb-army/30 rounded p-3 bg-fmb-black/50 space-y-3">
                  <span className="text-[10px] text-fmb-gold font-bold uppercase tracking-wider block border-b border-fmb-army/10 pb-1">
                    ⚙️ Seção, TAG e Permissões Confidenciais
                  </span>

                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="text-[9px] text-gray-400 block uppercase mb-1">TAG do Instrutor (Máx 3 caracteres)</label>
                      <input
                        type="text"
                        placeholder="Ex: INF, CAV, INS"
                        maxLength={3}
                        value={docInstructorTag}
                        onChange={(e) => setDocInstructorTag(e.target.value.toUpperCase())}
                        className="w-full bg-fmb-slate border border-fmb-army/30 py-1.5 px-2.5 rounded text-white outline-none focus:border-fmb-gold text-[10px] uppercase font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {/* Allowed Ranks Checkboxes */}
                    <div>
                      <label className="text-[9px] text-gray-400 block uppercase mb-1">Limitar por Patentes (Opcional)</label>
                      <div className="bg-fmb-slate border border-fmb-army/30 rounded p-2 max-h-[110px] overflow-y-auto space-y-1.5">
                        {hierarchyConfigs.map(config => {
                          const isChecked = docAllowedRanks.includes(config.rank);
                          return (
                            <label key={config.rank} className="flex items-center space-x-2 text-[9px] cursor-pointer text-gray-300 hover:text-white">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setDocAllowedRanks(docAllowedRanks.filter(r => r !== config.rank));
                                  } else {
                                    setDocAllowedRanks([...docAllowedRanks, config.rank]);
                                  }
                                }}
                                className="rounded bg-fmb-black border-fmb-army/40 text-fmb-gold focus:ring-0"
                              />
                              <span className="truncate">{config.label}</span>
                            </label>
                          );
                        })}
                      </div>
                      <span className="text-[8px] text-gray-500 mt-1 block">Se nenhuma for marcada, todos podem ver.</span>
                    </div>

                    {/* Allowed SubCargos Checkboxes */}
                    <div>
                      <label className="text-[9px] text-gray-400 block uppercase mb-1">Limitar por Subcargos (Opcional)</label>
                      <div className="bg-fmb-slate border border-fmb-army/30 rounded p-2 max-h-[110px] overflow-y-auto space-y-1.5">
                        {allSubCargos.length === 0 ? (
                          <span className="text-[8px] text-gray-500 italic block">Nenhum subcargo criado ainda</span>
                        ) : (
                          allSubCargos.map(sc => {
                            const isChecked = docAllowedSubCargos.includes(sc.id);
                            return (
                              <label key={sc.id} className="flex items-center space-x-2 text-[9px] cursor-pointer text-gray-300 hover:text-white">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setDocAllowedSubCargos(docAllowedSubCargos.filter(id => id !== sc.id));
                                    } else {
                                      setDocAllowedSubCargos([...docAllowedSubCargos, sc.id]);
                                    }
                                  }}
                                  className="rounded bg-fmb-black border-fmb-army/40 text-fmb-gold focus:ring-0"
                                />
                                <span className="truncate">{sc.label}</span>
                              </label>
                            );
                          })
                        )}
                      </div>
                      <span className="text-[8px] text-gray-500 mt-1 block">Se nenhuma for marcada, todos podem ver.</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-fmb-gold block uppercase mb-1">Corpo do Artigo / Texto Completo de Instruções</label>
                  <textarea
                    placeholder="Digite cada instrução detalhadamente. Insira exemplos práticos de como se portar e de como usar os scripts em salas de aula policia..."
                    value={docContent}
                    onChange={(e) => setDocContent(e.target.value)}
                    rows={8}
                    className="w-full bg-fmb-slate border border-fmb-army/30 py-2 px-3 rounded text-white outline-none resize-none focus:border-fmb-gold leading-relaxed"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-fmb-army hover:bg-fmb-olive border border-fmb-gold/55 py-2.5 rounded font-bold text-xs uppercase tracking-wider text-white"
                >
                  Registrar Documento no Acervo
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT DOCS MODAL */}
      <AnimatePresence>
        {editingDocId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-fmb-black border border-fmb-gold/40 text-white rounded-lg shadow-2xl p-6 relative"
            >
              <button 
                onClick={() => setEditingDocId(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-6">
                <BookOpen className="w-10 h-10 text-fmb-gold mx-auto mb-2" />
                <h3 className="font-display font-extrabold text-lg text-white uppercase">Retificar Documento</h3>
                <p className="text-[10px] font-mono text-gray-400">AJUSTAR DIRETRIZES OU SCRIPTS ACADÊMICOS</p>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4 font-mono text-xs text-left">
                <div>
                  <label className="text-[10px] text-fmb-gold block uppercase mb-1">Título do Documento</label>
                  <input
                    type="text"
                    value={editDocTitle}
                    onChange={(e) => setEditDocTitle(e.target.value)}
                    className="w-full bg-fmb-slate border border-fmb-army/30 py-2 px-3 rounded text-white outline-none focus:border-fmb-gold"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-fmb-gold block uppercase mb-1">Categoria</label>
                    <select
                      value={editDocCategory}
                      onChange={(e) => setEditDocCategory(e.target.value)}
                      className="w-full bg-fmb-slate border border-fmb-army/30 py-2 px-3 rounded text-white outline-none cursor-pointer font-mono text-[11px]"
                    >
                      {allCategories.map(cat => (
                        <option key={cat} value={cat}>
                          {getCategoryLabel(cat)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-fmb-gold block uppercase mb-1">Anexo Acadêmico (Link ou PDF)</label>
                    <input
                      type="text"
                      value={editDocAttachment}
                      onChange={(e) => setEditDocAttachment(e.target.value)}
                      className="w-full bg-fmb-slate border border-fmb-army/30 py-2 px-3 rounded text-white outline-none focus:border-fmb-gold"
                    />
                  </div>
                </div>

                <div className="border border-dashed border-fmb-army/40 p-3 rounded bg-fmb-black/50 text-center relative hover:bg-fmb-black/80 transition-all cursor-pointer">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => handleFileUpload(e, true)}
                    className="absolute inset-x-0 inset-y-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={uploadingEdit}
                  />
                  <div className="flex items-center justify-center space-x-2 text-[10px] font-mono">
                    {uploadingEdit ? (
                      <div className="flex items-center space-x-1.5 text-fmb-gold">
                        <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Sincronizando novo PDF no QG...</span>
                      </div>
                    ) : (
                      <div className="text-gray-300 hover:text-fmb-gold transition-colors flex items-center space-x-2">
                        <Download className="w-3.5 h-3.5 text-fmb-gold shrink-0 rotate-180" />
                        <span>Fazer Upload / Arrastar Novo PDF para Retificação</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* EDIT SEÇÃO, TAG DO INSTRUTOR E PERMISSÕES DINÂMICAS */}
                <div className="border border-fmb-army/30 rounded p-3 bg-fmb-black/50 space-y-3">
                  <span className="text-[10px] text-fmb-gold font-bold uppercase tracking-wider block border-b border-fmb-army/10 pb-1">
                    ⚙️ Seção, TAG e Permissões Confidenciais
                  </span>

                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="text-[9px] text-gray-400 block uppercase mb-1">TAG do Instrutor (Máx 3 caracteres)</label>
                      <input
                        type="text"
                        placeholder="Ex: INF, CAV, INS"
                        maxLength={3}
                        value={editDocInstructorTag}
                        onChange={(e) => setEditDocInstructorTag(e.target.value.toUpperCase())}
                        className="w-full bg-fmb-slate border border-fmb-army/30 py-1.5 px-2.5 rounded text-white outline-none focus:border-fmb-gold text-[10px] uppercase font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {/* Allowed Ranks Checkboxes */}
                    <div>
                      <label className="text-[9px] text-gray-400 block uppercase mb-1">Limitar por Patentes (Opcional)</label>
                      <div className="bg-fmb-slate border border-fmb-army/30 rounded p-2 max-h-[110px] overflow-y-auto space-y-1.5">
                        {hierarchyConfigs.map(config => {
                          const isChecked = editDocAllowedRanks.includes(config.rank);
                          return (
                            <label key={config.rank} className="flex items-center space-x-2 text-[9px] cursor-pointer text-gray-300 hover:text-white">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setEditDocAllowedRanks(editDocAllowedRanks.filter(r => r !== config.rank));
                                  } else {
                                    setEditDocAllowedRanks([...editDocAllowedRanks, config.rank]);
                                  }
                                }}
                                className="rounded bg-fmb-black border-fmb-army/40 text-fmb-gold focus:ring-0"
                              />
                              <span className="truncate">{config.label}</span>
                            </label>
                          );
                        })}
                      </div>
                      <span className="text-[8px] text-gray-500 mt-1 block">Se nenhuma for marcada, todos podem ver.</span>
                    </div>

                    {/* Allowed SubCargos Checkboxes */}
                    <div>
                      <label className="text-[9px] text-gray-400 block uppercase mb-1">Limitar por Subcargos (Opcional)</label>
                      <div className="bg-fmb-slate border border-fmb-army/30 rounded p-2 max-h-[110px] overflow-y-auto space-y-1.5">
                        {allSubCargos.length === 0 ? (
                          <span className="text-[8px] text-gray-500 italic block">Nenhum subcargo criado ainda</span>
                        ) : (
                          allSubCargos.map(sc => {
                            const isChecked = editDocAllowedSubCargos.includes(sc.id);
                            return (
                              <label key={sc.id} className="flex items-center space-x-2 text-[9px] cursor-pointer text-gray-300 hover:text-white">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setEditDocAllowedSubCargos(editDocAllowedSubCargos.filter(id => id !== sc.id));
                                    } else {
                                      setEditDocAllowedSubCargos([...editDocAllowedSubCargos, sc.id]);
                                    }
                                  }}
                                  className="rounded bg-fmb-black border-fmb-army/40 text-fmb-gold focus:ring-0"
                                />
                                <span className="truncate">{sc.label}</span>
                              </label>
                            );
                          })
                        )}
                      </div>
                      <span className="text-[8px] text-gray-500 mt-1 block">Se nenhuma for marcada, todos podem ver.</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-fmb-gold block uppercase mb-1">Artigo / Texto Integrado</label>
                  <textarea
                    value={editDocContent}
                    onChange={(e) => setEditDocContent(e.target.value)}
                    rows={8}
                    className="w-full bg-fmb-slate border border-fmb-army/30 py-2 px-3 rounded text-white outline-none resize-none focus:border-fmb-gold leading-relaxed"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-fmb-army hover:bg-fmb-olive border border-fmb-gold/55 py-2.5 rounded font-bold text-xs uppercase tracking-wider text-white"
                >
                  Salvar Alterações Decididas
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={confirmDeleteId !== null}
        title="Confirmar Baixa de Manual"
        message="Atenção Militar: Confirmar exclusão definitiva deste manual/material de aula? Essa ação é imediata e irreversível e será reportada nos registros do QG."
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />

      {/* CATEGORIES MANAGEMENT MODAL */}
      <AnimatePresence>
        {showCategoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-fmb-black border border-fmb-gold/40 text-white rounded-lg shadow-2xl p-6 relative font-mono text-xs"
            >
              <button 
                onClick={() => setShowCategoryModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-6">
                <BookOpen className="w-10 h-10 text-fmb-gold mx-auto mb-2" />
                <h3 className="font-display font-extrabold text-base text-white uppercase">Gerenciar Categorias</h3>
                <p className="text-[10px] text-gray-400">CRIAR E SECCIONAR CATEGORIAS DA INTELIGÊNCIA</p>
              </div>

              {/* Form to add category */}
              <form onSubmit={handleAddCategory} className="space-y-3 mb-6">
                <div>
                  <label className="text-[10px] text-fmb-gold block uppercase mb-1">Nova Categoria</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ex: Treinamentos, Legislação"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="flex-1 bg-fmb-slate border border-fmb-army/30 py-1.5 px-3 rounded text-white outline-none focus:border-fmb-gold"
                      required
                    />
                    <button
                      type="submit"
                      disabled={addingCategory}
                      className="bg-fmb-army hover:bg-fmb-olive border border-fmb-gold/40 text-white px-4 py-1.5 rounded font-bold uppercase text-[10px] tracking-wider transition-colors shrink-0 cursor-pointer"
                    >
                      {addingCategory ? "Criando..." : "Criar"}
                    </button>
                  </div>
                </div>
              </form>

              {/* List of current categories */}
              <div className="space-y-2">
                <h4 className="text-[10px] text-fmb-gold uppercase font-bold border-b border-fmb-army/20 pb-1 mb-2">Categorias Ativas</h4>
                <div className="max-h-[220px] overflow-y-auto space-y-1.5 pr-1" id="category-list-scroll">
                  {allCategories.map(cat => {
                    return (
                      <div 
                        key={cat}
                        className="flex items-center justify-between p-2 bg-fmb-slate/20 border border-fmb-army/10 rounded"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          <span className="text-[11px] font-bold text-gray-200">{getCategoryLabel(cat)}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteCategory(cat)}
                          className="p-1 text-red-400 hover:text-red-300 hover:bg-red-950/20 rounded transition-colors cursor-pointer"
                          title="Deletar Categoria"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FULLSCREEN READING MODE */}
      <AnimatePresence>
        {isFullscreen && selectedDoc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-fmb-black/98 overflow-y-auto flex flex-col font-mono"
          >
            {/* Top Bar */}
            <div className="border-b border-fmb-army/30 bg-fmb-black/90 backdrop-blur sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-3 text-left">
                <div className="p-2 bg-fmb-slate/40 border border-fmb-gold/30 rounded text-fmb-gold shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[9px] px-2 py-0.5 border rounded uppercase font-bold ${getCategoryColor(selectedDoc.category)}`}>
                      {getCategoryLabel(selectedDoc.category)}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      Publicado por @{selectedDoc.authorNick} em {new Date(selectedDoc.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <h2 className="font-display font-black text-xs sm:text-sm text-white uppercase tracking-wide mt-1">
                    {selectedDoc.title}
                  </h2>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                {selectedDoc.attachmentUrl && (
                  <a 
                    href={selectedDoc.attachmentUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-fmb-army hover:bg-fmb-olive border border-fmb-gold/30 text-white rounded text-[10px] uppercase font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Ver PDF Original</span>
                  </a>
                )}
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="px-3 py-1.5 bg-fmb-slate hover:bg-fmb-slate/80 border border-fmb-army/30 text-gray-300 hover:text-white rounded text-[10px] uppercase font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
                  title="Sair da Tela Cheia"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Fechar</span>
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 md:py-16 flex flex-col justify-between">
              <div className="space-y-6 text-left">
                <div className="border-b border-fmb-army/15 pb-4 mb-6">
                  <h1 className="font-display font-black text-xl sm:text-2xl md:text-3xl text-fmb-gold uppercase tracking-tight leading-tight">
                    {selectedDoc.title}
                  </h1>
                </div>

                <div className="text-xs sm:text-sm md:text-base text-gray-200 leading-relaxed whitespace-pre-wrap select-text selection:bg-fmb-gold selection:text-black">
                  {selectedDoc.content}
                </div>
              </div>

              <div className="mt-16 pt-6 border-t border-fmb-army/20 flex flex-col sm:flex-row items-center justify-between text-[10px] text-gray-500 gap-4">
                <span>AUTORIDADE EMISSORA: @{selectedDoc.authorNick}</span>
                <span>FMB DOUTRINA POLICIAL MILITAR — ACERVO CONFIDENCIAL</span>
                <span>EMISSÃO: {new Date(selectedDoc.createdAt).toLocaleString("pt-BR")}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
