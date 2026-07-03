import React, { useEffect, useState } from "react";
import { 
  Search, Plus, FileText, Lock, Unlock, ExternalLink, Edit2, Trash2, 
  Maximize2, Minimize2, Filter, FolderPlus, HelpCircle
} from "lucide-react";
import { motion } from "motion/react";
import { api } from "../lib/api.js";
import { User, PoliceDocument, SubCargo, MilitaryRank, getRankOrder } from "../types.js";

interface InstructorsPanelProps {
  viewer: User;
}

export default function InstructorsPanel({ viewer }: InstructorsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active sub-tab section: "instrutores", "aman" or "esao"
  const [activeSection, setActiveSection] = useState<"instrutores" | "aman" | "esao">("instrutores");
  
  // Data lists
  const [documents, setDocuments] = useState<PoliceDocument[]>([]);
  const [allSubCargos, setAllSubCargos] = useState<SubCargo[]>([]);
  const [categories, setCategories] = useState<{ name: string; minRank?: string | null }[]>([]);
  const [hierarchyConfigs, setHierarchyConfigs] = useState<any[]>([]);
  const [newCategoryMinRank, setNewCategoryMinRank] = useState<string>("");

  // Permissions check based on viewer's subCargos
  const [hasInstrutorAccess, setHasInstrutorAccess] = useState(false);
  const [hasAmanAccess, setHasAmanAccess] = useState(false);
  const [hasEsaoAccess, setHasEsaoAccess] = useState(false);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  // Drawer / View document state
  const [selectedDoc, setSelectedDoc] = useState<PoliceDocument | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Categories Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);

  // Document Modal state
  const [showDocModal, setShowDocModal] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  
  // Doc fields
  const [docTitle, setDocTitle] = useState("");
  const [docCategory, setDocCategory] = useState("");
  const [docContent, setDocContent] = useState("");
  const [docAttachment, setDocAttachment] = useState("");
  const [docAllowedRanks, setDocAllowedRanks] = useState<string[]>([]);
  const [docAllowedSubCargos, setDocAllowedSubCargos] = useState<string[]>([]);
  const [docInstructorTag, setDocInstructorTag] = useState("");
  const [savingDoc, setSavingDoc] = useState(false);

  const canUserViewCategory = (minRank: string | null | undefined) => {
    if (!minRank) return true;
    const isSupremo = viewer.role === MilitaryRank.ADMSUPREMO;
    if (isSupremo) return true;
    return getRankOrder(viewer.role) >= getRankOrder(minRank as MilitaryRank);
  };

  // Load initial check and all subcargos
  const initializePermissions = async () => {
    try {
      setLoading(true);
      const scs = await api.getSubCargos();
      setAllSubCargos(scs || []);

      const ranks = await api.getHierarchy();
      setHierarchyConfigs(ranks || []);

      // Get custom permissions config
      let customPerms: any = { instrutoresViewAllowed: [], amanViewAllowed: [] };
      try {
        customPerms = await api.getCustomPermissions();
      } catch (e) {
        console.warn("Erro ao obter customPermissions no InstructorsPanel", e);
      }

      const instAllowed = customPerms.instrutoresViewAllowed || [];
      const amanAllowedByConfig = customPerms.amanViewAllowed || [];

      // Determine subcargo access
      // Is Supremo?
      const isSupremo = viewer.role === "Administrador Supremo";

      // Determine Instrutores access
      let hasInstrutor = isSupremo;
      if (instAllowed.length > 0) {
        hasInstrutor = isSupremo || instAllowed.includes(viewer.role) || (viewer.subCargos || []).some((scId: string) => instAllowed.includes(scId));
      } else {
        hasInstrutor = isSupremo || (viewer.subCargos || []).some((scId: string) => {
          const scObj = scs.find(x => x.id === scId);
          return scId.toLowerCase().includes("instrutor") || scObj?.label.toLowerCase().includes("instrutor") || scObj?.label.toLowerCase().includes("instructor");
        });
      }

      // Determine AMAN access
      let hasAman = isSupremo;
      if (amanAllowedByConfig.length > 0) {
        hasAman = isSupremo || amanAllowedByConfig.includes(viewer.role) || (viewer.subCargos || []).some((scId: string) => amanAllowedByConfig.includes(scId));
      } else {
        hasAman = isSupremo || (viewer.subCargos || []).some((scId: string) => {
          const scObj = scs.find(x => x.id === scId);
          return scId.toLowerCase().includes("aman") || scObj?.label.toLowerCase().includes("aman");
        });
      }

      // Determine EsAO access
      let hasEsao = isSupremo;
      hasEsao = isSupremo || (viewer.subCargos || []).some((scId: string) => {
        const scObj = scs.find(x => x.id === scId);
        return scId.toLowerCase().includes("esao") || scObj?.label.toLowerCase().includes("esao");
      });

      setHasInstrutorAccess(!!hasInstrutor);
      setHasAmanAccess(!!hasAman);
      setHasEsaoAccess(!!hasEsao);

      // Set default selected sub-tab
      if (hasInstrutor) {
        setActiveSection("instrutores");
      } else if (hasAman) {
        setActiveSection("aman");
      } else if (hasEsao) {
        setActiveSection("esao");
      }
    } catch (err: any) {
      setError(err.message || "Erro de inicialização.");
    } finally {
      setLoading(false);
    }
  };

  // Load section-specific data (categories and documents)
  const loadSectionData = async () => {
    try {
      // 1. Load Categories
      let cats: { name: string; minRank?: string | null }[] = [];
      if (activeSection === "instrutores") {
        cats = await api.getInstructorCategories();
      } else if (activeSection === "aman") {
        cats = await api.getAmanCategories();
      } else if (activeSection === "esao") {
        cats = await api.getEsaoCategories();
      }
      setCategories(cats || []);

      // 2. Load Documents
      const docs = await api.getDocuments();
      setDocuments(docs || []);
    } catch (err: any) {
      console.error("Erro ao carregar dados da seção:", err);
    }
  };

  useEffect(() => {
    initializePermissions();
  }, [viewer]);

  useEffect(() => {
    if (!loading && (hasInstrutorAccess || hasAmanAccess || hasEsaoAccess)) {
      loadSectionData();
    }
  }, [activeSection, loading, hasInstrutorAccess, hasAmanAccess, hasEsaoAccess]);

  const handleOpenAddModal = () => {
    setEditingDocId(null);
    setDocTitle("");
    setDocCategory(categories[0]?.name || "");
    setDocContent("");
    setDocAttachment("");
    setDocAllowedRanks([]);
    setDocAllowedSubCargos([]);
    setDocInstructorTag("");
    setShowDocModal(true);
  };

  const handleOpenEditModal = (doc: PoliceDocument) => {
    setEditingDocId(doc.id);
    setDocTitle(doc.title);
    setDocCategory(doc.category);
    setDocContent(doc.content);
    setDocAttachment(doc.attachmentUrl || "");
    setDocAllowedRanks(doc.allowedRanks || []);
    setDocAllowedSubCargos(doc.allowedSubCargos || []);
    setDocInstructorTag(doc.instructorTag || "");
    setShowDocModal(true);
  };

  const handleSaveDocument = async () => {
    if (!docTitle.trim() || !docCategory || !docContent.trim()) {
      alert("Título, categoria e o conteúdo são de preenchimento obrigatório.");
      return;
    }

    if (docAttachment.trim() && !docAttachment.toLowerCase().endsWith(".pdf")) {
      alert("Aviso oficial: Somente arquivos PDF são aceitos como anexos de instrução no QG FMB.");
      return;
    }

    if (docInstructorTag && docInstructorTag.length > 3) {
      alert("A TAG de instrução deve conter no máximo 3 caracteres.");
      return;
    }

    setSavingDoc(true);
    try {
      if (editingDocId) {
        await api.updateDocument(
          editingDocId,
          docTitle.trim(),
          docCategory,
          docContent.trim(),
          docAttachment.trim() || undefined,
          activeSection,
          docAllowedRanks,
          docAllowedSubCargos,
          docInstructorTag.toUpperCase() || undefined
        );
      } else {
        await api.createDocument(
          docTitle.trim(),
          docCategory,
          docContent.trim(),
          docAttachment.trim() || undefined,
          activeSection,
          docAllowedRanks,
          docAllowedSubCargos,
          docInstructorTag.toUpperCase() || undefined
        );
      }

      setShowDocModal(false);
      loadSectionData();
    } catch (err: any) {
      alert("Falha ao salvar material de instrução: " + err.message);
    } finally {
      setSavingDoc(false);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (!confirm("Confirmar a exclusão permanente deste manual de instrução?")) return;
    try {
      await api.deleteDocument(id);
      loadSectionData();
      if (selectedDoc?.id === id) {
        setSelectedDoc(null);
      }
    } catch (err: any) {
      alert("Erro ao excluir: " + err.message);
    }
  };

  const handleAddCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      alert("Preencha o nome da nova subcategoria.");
      return;
    }
    setAddingCategory(true);
    try {
      let updatedCats: { name: string; minRank?: string | null }[] = [];
      const rankParam = newCategoryMinRank || undefined;
      if (activeSection === "instrutores") {
        updatedCats = await api.addInstructorCategory(trimmed, rankParam);
      } else if (activeSection === "aman") {
        updatedCats = await api.addAmanCategory(trimmed, rankParam);
      } else if (activeSection === "esao") {
        updatedCats = await api.addEsaoCategory(trimmed, rankParam);
      }
      setCategories(updatedCats);
      setDocCategory(trimmed);
      setNewCategoryName("");
      setNewCategoryMinRank("");
      setShowCategoryModal(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAddingCategory(false);
    }
  };

  const handleDeleteCategory = async (catName: string) => {
    if (!confirm(`Deseja mesmo remover a subcategoria "${catName}"?`)) return;
    try {
      let updatedCats: { name: string; minRank?: string | null }[] = [];
      if (activeSection === "instrutores") {
        updatedCats = await api.deleteInstructorCategory(catName);
      } else if (activeSection === "aman") {
        updatedCats = await api.deleteAmanCategory(catName);
      } else if (activeSection === "esao") {
        updatedCats = await api.deleteEsaoCategory(catName);
      }
      setCategories(updatedCats);
      if (selectedCategory === catName) {
        setSelectedCategory("");
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <span className="inline-block animate-spin border-4 border-fmb-gold border-t-transparent w-8 h-8 rounded-full" />
        <p className="text-xs font-mono text-gray-400">CARREGANDO ARQUIVO DE INSTRUÇÕES E AMAN...</p>
      </div>
    );
  }

  // Deny access if they don't have either subcargo and aren't Supremo
  if (!hasInstrutorAccess && !hasAmanAccess && !hasEsaoAccess) {
    return (
      <div className="max-w-md mx-auto my-12 bg-fmb-slate/40 border border-red-500/30 rounded-lg p-6 text-center leading-tight">
        <Lock className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="font-display font-black text-lg text-white mb-2 uppercase tracking-wide">Acesso Confidencial Reservado</h3>
        <p className="text-xs font-mono text-gray-400 leading-normal">
          Esta ala militar do QG Força Militar Brasileira é de acesso exclusivo para integrantes do Corpo de <strong className="text-fmb-gold">Instrutores</strong>, Cadetes da <strong className="text-amber-400">AMAN</strong> ou Oficiais da <strong className="text-emerald-400">EsAO</strong>.
        </p>
        <div className="mt-4 p-3 bg-fmb-black rounded border border-fmb-army/20 text-left">
          <p className="text-[10px] font-mono text-gray-400 leading-relaxed">
            • <strong className="text-white">Instrutores:</strong> Licenciados para ministrar e gerir manuais e apostilas.
            <br />
            • <strong className="text-white">AMAN:</strong> Acesso restrito a cadetes e oficiais em curso avançado.
            <br />
            • <strong className="text-white">EsAO:</strong> Escola de Aperfeiçoamento de Oficiais, acesso restrito para detentores do respectivo cargo.
          </p>
        </div>
        <p className="text-[9px] font-mono text-gray-500 mt-4 uppercase">
          Consulte o Alto Comando para requisição de seu respectivo Subcargo Militar.
        </p>
      </div>
    );
  }

  // Filter documents based on active sub-tab, search, and category
  const filteredDocs = documents.filter(doc => {
    // 1. Section match
    if (doc.section !== activeSection) return false;

    // 1.5 Category visibility check
    const catObj = categories.find(c => c.name === doc.category);
    if (catObj && !canUserViewCategory(catObj.minRank)) {
      return false;
    }

    // 2. Search match
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const titleMatch = doc.title.toLowerCase().includes(term);
      const contentMatch = doc.content.toLowerCase().includes(term);
      const categoryMatch = doc.category.toLowerCase().includes(term);
      const authorMatch = doc.authorNick.toLowerCase().includes(term);
      const tagMatch = doc.instructorTag?.toLowerCase().includes(term);
      if (!titleMatch && !contentMatch && !categoryMatch && !authorMatch && !tagMatch) return false;
    }

    // 3. Category match
    if (selectedCategory && doc.category !== selectedCategory) return false;

    // 4. Permissions check (only view if user's rank is allowed, or user has allowed subcargo, or doc permissions lists are empty)
    const isSupremo = viewer.role === "Administrador Supremo";
    if (isSupremo) return true;

    // Rank filter
    if (doc.allowedRanks && doc.allowedRanks.length > 0) {
      if (!doc.allowedRanks.includes(viewer.role)) {
        return false;
      }
    }

    // Subcargo filter
    if (doc.allowedSubCargos && doc.allowedSubCargos.length > 0) {
      const hasAllowedSubCargo = viewer.subCargos?.some(scId => doc.allowedSubCargos?.includes(scId));
      if (!hasAllowedSubCargo) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* SECTION SELECTOR / TAB HEADER */}
      <div className="flex bg-fmb-black/40 border border-fmb-army/30 rounded p-1 gap-1 flex-wrap md:flex-nowrap">
        
        {/* TAB 1: INSTRUTORES */}
        {hasInstrutorAccess && (
          <button
            onClick={() => {
              setActiveSection("instrutores");
              setSelectedCategory("");
            }}
            className={`flex-1 py-2.5 rounded text-center font-mono text-[10px] uppercase font-extrabold transition-all duration-250 flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSection === "instrutores"
                ? "bg-fmb-gold text-fmb-black shadow-md border border-fmb-gold"
                : "text-gray-400 hover:text-white hover:bg-fmb-slate/20"
            }`}
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>Área de Instrutores</span>
          </button>
        )}

        {/* TAB 2: AMAN */}
        {hasAmanAccess && (
          <button
            onClick={() => {
              setActiveSection("aman");
              setSelectedCategory("");
            }}
            className={`flex-1 py-2.5 rounded text-center font-mono text-[10px] uppercase font-extrabold transition-all duration-250 flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSection === "aman"
                ? "bg-fmb-gold text-fmb-black shadow-md border border-fmb-gold"
                : "text-gray-400 hover:text-white hover:bg-fmb-slate/20"
            }`}
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>Área Militar AMAN</span>
          </button>
        )}

        {/* TAB 3: EsAO */}
        {hasEsaoAccess && (
          <button
            onClick={() => {
              setActiveSection("esao");
              setSelectedCategory("");
            }}
            className={`flex-1 py-2.5 rounded text-center font-mono text-[10px] uppercase font-extrabold transition-all duration-250 flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSection === "esao"
                ? "bg-fmb-gold text-fmb-black shadow-md border border-fmb-gold"
                : "text-gray-400 hover:text-white hover:bg-fmb-slate/20"
            }`}
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>Área Militar EsAO</span>
          </button>
        )}

      </div>

      {/* INNER VIEW CONTENT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT TWO-THIRDS: MAIN SEARCH & DOCS LIST */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Section banner */}
          <div className="bg-fmb-black/40 border border-fmb-army/30 rounded p-4 flex justify-between items-center">
            <div className="leading-tight">
              <h3 className="font-display font-black text-sm text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>📘</span> {activeSection === "instrutores" ? "Acervo de Manuais de Instrução" : activeSection === "aman" ? "Doutrinas Acadêmicas AMAN" : "Acervo e Instruções Oficiais EsAO"}
              </h3>
              <p className="text-[9px] font-mono text-gray-400 mt-1">
                {activeSection === "instrutores" 
                  ? "Instruções exclusivas do corpo de instrutores do QG FMB. Subcategorias gerenciáveis independentemente."
                  : activeSection === "aman"
                    ? "Apostilas avançadas de cadetes e oficiais da Academia Militar das Agulhas Negras."
                    : "Manuais de Aperfeiçoamento e Instruções Oficiais Avançadas da Escola de Aperfeiçoamento de Oficiais."}
              </p>
            </div>
            
            <button
              onClick={handleOpenAddModal}
              className="bg-fmb-gold text-fmb-black hover:bg-white transition-all px-3 py-1.5 rounded font-mono text-[9px] font-black uppercase tracking-widest flex items-center gap-1 cursor-pointer shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Documento</span>
            </button>
          </div>

          {/* Search filter row */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Pesquisar por título, autor, conteúdo ou TAG..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-fmb-black border border-fmb-army/30 rounded py-1.5 pl-10 pr-4 text-white text-xs outline-none focus:border-fmb-gold font-mono"
              />
            </div>

            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory("")}
                className="bg-fmb-slate/50 hover:bg-fmb-slate border border-fmb-army/20 text-gray-400 hover:text-white px-3 py-1.5 rounded font-mono text-[9px] uppercase tracking-wider cursor-pointer"
              >
                Limpar Filtro ({selectedCategory})
              </button>
            )}
          </div>

          {/* Documents Grid / list */}
          {filteredDocs.length === 0 ? (
            <div className="p-8 border border-fmb-army/20 bg-fmb-black/30 rounded-lg text-center font-mono">
              <FileText className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-400 uppercase tracking-wider">Nenhum manual confidencial localizado nesta seção.</p>
              <p className="text-[9px] text-gray-500 mt-1 leading-normal">Crie novas subcategorias ou publique o primeiro arquivo de instrução no botão superior.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDocs.map(doc => {
                const isSelected = selectedDoc?.id === doc.id;
                return (
                  <div
                    key={doc.id}
                    onClick={() => {
                      setSelectedDoc(doc);
                      setIsFullscreen(false);
                    }}
                    className={`p-4 border rounded-lg transition-all text-left flex flex-col justify-between cursor-pointer leading-tight relative overflow-hidden ${
                      isSelected 
                        ? "bg-fmb-gold/5 border-fmb-gold/60 ring-1 ring-fmb-gold/40" 
                        : "bg-fmb-black/40 border-fmb-army/30 hover:border-fmb-gold/45"
                    }`}
                  >
                    {doc.instructorTag && (
                      <span className="absolute top-0 right-0 bg-fmb-gold text-fmb-black font-mono font-black text-[8px] px-2 py-0.5 rounded-bl uppercase tracking-widest shadow">
                        TAG {doc.instructorTag}
                      </span>
                    )}

                    <div>
                      <div className="flex items-center space-x-1.5 mb-1.5">
                        <span className="text-[9px] bg-fmb-slate border border-fmb-army/20 px-1.5 py-0.5 rounded text-fmb-gold font-mono uppercase tracking-widest">
                          {doc.category}
                        </span>
                        {doc.attachmentUrl && (
                          <span className="text-[8px] font-mono text-green-400 bg-green-950/20 border border-green-500/20 px-1 rounded uppercase">
                            📎 PDF Anexo
                          </span>
                        )}
                      </div>

                      <h4 className="font-display font-black text-sm text-white line-clamp-1 group-hover:text-fmb-gold">
                        {doc.title}
                      </h4>
                      <p className="text-[10px] font-mono text-gray-400 line-clamp-3 mt-2 leading-relaxed">
                        {doc.content}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-fmb-army/10 pt-2.5 mt-3">
                      <span className="text-[8px] font-mono text-gray-500 uppercase">
                        Por: @{doc.authorNick}
                      </span>
                      <span className="text-[8px] font-mono text-gray-500">
                        {new Date(doc.createdAt).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* RIGHT ONE-THIRD: DETAILED DOCUMENT VIEWER & CATEGORIES LIST */}
        <div className="space-y-4">
          
          {/* MINHA TAG DE INSTRUTOR */}
          {hasInstrutorAccess && activeSection === "instrutores" && (
            <div className="bg-fmb-black/40 border border-fmb-army/30 p-4 rounded-lg text-left">
              <div className="border-b border-fmb-army/20 pb-2 mb-3 flex items-center justify-between">
                <h4 className="font-display font-extrabold text-xs text-fmb-gold uppercase tracking-wider flex items-center gap-1.5">
                  <span>🏷️</span> Minha TAG de Instrutor
                </h4>
                {viewer.instructorTag ? (
                  <span className="text-[9px] bg-fmb-gold text-fmb-black font-black font-mono px-1.5 py-0.5 rounded">
                    ATIVO: {viewer.instructorTag}
                  </span>
                ) : (
                  <span className="text-[8px] bg-red-950/20 text-red-400 border border-red-500/30 font-mono px-1.5 py-0.5 rounded uppercase">
                    SEM TAG
                  </span>
                )}
              </div>
              
              <div className="space-y-3 leading-tight">
                <p className="text-[9px] font-mono text-gray-400">
                  Defina sua TAG de 3 caracteres. Ela será usada em perfis e assinaturas de treinamentos.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={3}
                    placeholder="Ex: INF"
                    defaultValue={viewer.instructorTag || ""}
                    id="instructor-tag-input"
                    className="flex-1 bg-fmb-black border border-fmb-army/30 rounded px-2 py-1 text-center font-mono text-xs text-white outline-none focus:border-fmb-gold"
                  />
                  <button
                    onClick={async () => {
                      const input = document.getElementById("instructor-tag-input") as HTMLInputElement;
                      const val = input?.value?.trim() || "";
                      if (val && val.length > 3) {
                        alert("A TAG deve possuir no máximo 3 caracteres.");
                        return;
                      }
                      try {
                        const updated = await api.saveInstructorTag(val);
                        viewer.instructorTag = val || undefined;
                        alert("Sua TAG de instrutor foi registrada com sucesso!");
                        window.location.reload();
                      } catch (e: any) {
                        alert("Erro ao salvar TAG: " + e.message);
                      }
                    }}
                    className="bg-fmb-gold text-fmb-black hover:bg-white font-mono text-[9px] uppercase font-black px-3 py-1.5 rounded cursor-pointer transition-colors"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* SUBCATEGORIAS DO ACERVO */}
          <div className="bg-fmb-black/40 border border-fmb-army/30 p-4 rounded-lg text-left">
            <div className="flex items-center justify-between border-b border-fmb-army/20 pb-2 mb-3">
              <h4 className="font-display font-extrabold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>📁</span> Subcategorias ({categories.filter(cat => canUserViewCategory(cat.minRank)).length})
              </h4>
              <button
                onClick={() => setShowCategoryModal(true)}
                className="text-fmb-gold hover:text-white transition-colors"
                title="Criar Nova Subcategoria"
              >
                <FolderPlus className="w-4 h-4" />
              </button>
            </div>

            {categories.filter(cat => canUserViewCategory(cat.minRank)).length === 0 ? (
              <p className="text-[10px] font-mono text-gray-500 py-3 text-center italic">
                Nenhuma subcategoria criada.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                {categories.filter(cat => canUserViewCategory(cat.minRank)).map(cat => {
                  const isSelected = selectedCategory === cat.name;
                  return (
                    <div 
                      key={cat.name} 
                      className={`flex items-center justify-between p-1.5 rounded font-mono text-[10px] transition-all cursor-pointer ${
                        isSelected 
                          ? "bg-fmb-gold text-fmb-black font-bold" 
                          : "bg-fmb-black/60 border border-fmb-army/15 text-gray-300 hover:text-white hover:bg-fmb-slate/40"
                      }`}
                      onClick={() => setSelectedCategory(isSelected ? "" : cat.name)}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="truncate">{cat.name}</span>
                        {cat.minRank && (
                          <span className={`text-[8px] font-sans border px-1 rounded whitespace-nowrap ${
                            isSelected ? "border-fmb-black text-fmb-black" : "border-fmb-gold text-fmb-gold bg-fmb-gold/10"
                          }`}>
                            Min: {cat.minRank}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCategory(cat.name);
                        }}
                        className={`hover:text-red-400 p-0.5 transition-colors ${
                          isSelected ? "text-fmb-black hover:text-red-700" : "text-gray-500"
                        }`}
                        title="Remover Categoria"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ACTIVE SELECTED DOCUMENT READER */}
          {selectedDoc ? (
            <div className={`bg-fmb-slate/40 border border-fmb-gold/40 p-5 rounded-lg text-left flex flex-col justify-between relative shadow-lg ${
              isFullscreen ? "fixed inset-4 z-50 bg-fmb-black border-2 border-fmb-gold m-0 h-[calc(100vh-32px)]" : ""
            }`}>
              {/* Controls */}
              <div className="flex items-center justify-between border-b border-fmb-army/20 pb-2 mb-4">
                <span className="text-[9px] font-mono text-fmb-gold uppercase tracking-widest font-bold">
                  Leitor Confidencial Militar
                </span>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="text-gray-400 hover:text-white p-1"
                    title={isFullscreen ? "Minimizar" : "Tela Cheia"}
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleOpenEditModal(selectedDoc)}
                    className="text-gray-400 hover:text-white p-1"
                    title="Editar Manual"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteDocument(selectedDoc.id)}
                    className="text-red-400 hover:text-red-300 p-1"
                    title="Excluir Manual"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Title & metadata */}
              <div className="space-y-1.5 leading-tight mb-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[8px] bg-fmb-black text-fmb-gold border border-fmb-army/20 px-2 py-0.5 rounded font-mono uppercase tracking-widest">
                    {selectedDoc.category}
                  </span>
                  {selectedDoc.instructorTag && (
                    <span className="text-[8px] bg-fmb-gold text-fmb-black font-mono font-black px-1.5 rounded">
                      TAG {selectedDoc.instructorTag}
                    </span>
                  )}
                </div>
                <h3 className="font-display font-black text-lg text-white">
                  {selectedDoc.title}
                </h3>
                <p className="text-[9px] font-mono text-gray-500 uppercase">
                  Por: @{selectedDoc.authorNick} • {new Date(selectedDoc.createdAt).toLocaleString("pt-BR")}
                </p>
              </div>

              {/* Content box */}
              <div className={`bg-fmb-black/60 border border-fmb-army/20 p-4 rounded font-mono text-xs text-gray-300 overflow-y-auto leading-relaxed ${
                isFullscreen ? "h-[calc(100vh-250px)]" : "max-h-[280px]"
              }`}>
                {selectedDoc.content}
              </div>

              {/* PDF download/open attachment */}
              {selectedDoc.attachmentUrl ? (
                <div className="mt-4 pt-3 border-t border-fmb-army/20 flex items-center justify-between">
                  <span className="text-[9px] font-mono text-gray-400 flex items-center">
                    📎 Arquivo PDF Oficial acoplado
                  </span>
                  <a
                    href={selectedDoc.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-green-600 hover:bg-green-500 text-white font-mono text-[9px] uppercase tracking-widest font-black px-3 py-1.5 rounded flex items-center gap-1 shadow transition-all cursor-pointer"
                    referrerPolicy="no-referrer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Visualizar PDF</span>
                  </a>
                </div>
              ) : (
                <p className="text-[9px] font-mono text-gray-500 mt-4 text-center italic">
                  Sem PDF anexo. Leitura exclusivamente textual.
                </p>
              )}

            </div>
          ) : (
            <div className="bg-fmb-black/20 border border-fmb-army/20 p-8 rounded-lg text-center font-mono leading-tight">
              <FileText className="w-10 h-10 text-gray-700 mx-auto mb-2" />
              <p className="text-xs text-gray-400 uppercase tracking-wider">Leitor Confidencial Vazio</p>
              <p className="text-[9px] text-gray-500 mt-1 leading-normal">Selecione qualquer manual de instrução do acervo para expandir seus conteúdos confidenciais.</p>
            </div>
          )}

        </div>

      </div>

      {/* MODAL: ADD / EDIT CATEGORY */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm bg-fmb-black border border-fmb-army/45 p-6 rounded-lg leading-tight"
          >
            <h3 className="font-display font-black text-sm text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span>FolderPlus</span> Nova Subcategoria de {activeSection === "instrutores" ? "Instrutor" : activeSection === "aman" ? "AMAN" : "EsAO"}
            </h3>
            <p className="text-[10px] font-mono text-gray-400 mb-4 leading-normal text-left">
              Crie uma pasta de subcategoria exclusiva para separar os documentos da área {activeSection.toUpperCase()}.
            </p>

            <div className="space-y-3 text-left">
              <label className="text-[9px] font-mono text-gray-500 block uppercase font-bold">Nome da Subcategoria</label>
              <input
                type="text"
                placeholder="Ex: Táticas de Campo"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="w-full bg-fmb-slate border border-fmb-army/30 rounded p-2 text-xs text-white outline-none font-mono focus:border-fmb-gold"
              />
            </div>

            <div className="space-y-3 text-left mt-3">
              <label className="text-[9px] font-mono text-gray-500 block uppercase font-bold">Patente Mínima para Visualizar (Opcional)</label>
              <select
                value={newCategoryMinRank}
                onChange={(e) => setNewCategoryMinRank(e.target.value)}
                className="w-full bg-fmb-slate border border-fmb-army/30 rounded p-2 text-xs text-white outline-none font-mono cursor-pointer focus:border-fmb-gold"
              >
                <option value="">Nenhuma (Qualquer um com acesso à aba)</option>
                {hierarchyConfigs.map(hc => (
                  <option key={hc.rank} value={hc.rank}>{hc.label}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setNewCategoryMinRank("");
                }}
                className="flex-1 border border-fmb-army/30 text-gray-400 hover:text-white py-1.5 rounded font-mono text-[10px] uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddCategory}
                disabled={addingCategory}
                className="flex-1 bg-fmb-gold text-fmb-black hover:bg-white font-mono text-[10px] uppercase font-black py-1.5 rounded cursor-pointer disabled:opacity-50"
              >
                {addingCategory ? "Criando..." : "Criar Pasta"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT DOCUMENT */}
      {showDocModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-full max-w-lg bg-fmb-black border border-fmb-army/45 p-6 rounded-lg leading-tight my-8 text-left"
          >
            <h3 className="font-display font-black text-md text-white uppercase tracking-wider mb-4 border-b border-fmb-army/20 pb-2 flex items-center justify-between">
              <span>{editingDocId ? "📝 Editar Manual de Instrução" : "📂 Publicar Novo Manual"}</span>
              <span className="text-[9px] font-mono text-fmb-gold bg-fmb-gold/10 border border-fmb-gold/20 px-2 py-0.5 rounded uppercase">
                Seção: {activeSection.toUpperCase()}
              </span>
            </h3>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              
              <div>
                <label className="text-[9px] text-gray-400 block uppercase mb-1 font-bold">Título do Documento</label>
                <input
                  type="text"
                  placeholder="Ex: Procedimentos de Abordagem Tática FMB"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full bg-fmb-slate border border-fmb-army/30 rounded p-2 text-xs text-white outline-none font-mono focus:border-fmb-gold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] text-gray-400 block uppercase mb-1 font-bold">Subcategoria / Pasta</label>
                  <select
                    value={docCategory}
                    onChange={(e) => setDocCategory(e.target.value)}
                    className="w-full bg-fmb-slate border border-fmb-army/30 rounded p-2 text-xs text-white outline-none font-mono cursor-pointer"
                  >
                    {categories.map(cat => (
                      <option key={cat.name} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] text-gray-400 block uppercase mb-1 font-bold">TAG do Instrutor (Máx 3 caracteres)</label>
                  <input
                    type="text"
                    placeholder="Ex: INF, CAV"
                    maxLength={3}
                    value={docInstructorTag}
                    onChange={(e) => setDocInstructorTag(e.target.value.toUpperCase())}
                    className="w-full bg-fmb-slate border border-fmb-army/30 rounded p-2 text-xs text-white outline-none font-mono focus:border-fmb-gold uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] text-gray-400 block uppercase mb-1 font-bold">Conteúdo do Manual (Linguagem Textual)</label>
                <textarea
                  placeholder="Digite aqui todo o texto ou instruções regulamentares..."
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  rows={8}
                  className="w-full bg-fmb-slate border border-fmb-army/30 rounded p-2.5 text-xs text-white outline-none font-mono focus:border-fmb-gold resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[9px] text-gray-400 block uppercase font-bold flex items-center gap-1">
                    <span>📎 URL do Anexo PDF Oficial</span>
                    <HelpCircle className="w-3 h-3 text-fmb-gold cursor-help" title="Apenas arquivos terminando com .pdf são aceitos." />
                  </label>
                  <span className="text-[8px] font-mono text-fmb-gold uppercase">Restrição: SOMENTE PDF</span>
                </div>
                <input
                  type="text"
                  placeholder="Ex: https://exemplo.com/apostila.pdf"
                  value={docAttachment}
                  onChange={(e) => setDocAttachment(e.target.value)}
                  className="w-full bg-fmb-slate border border-fmb-army/30 rounded p-2 text-xs text-white outline-none font-mono focus:border-fmb-gold"
                />
              </div>

              {/* RESTRICTIONS AND PERMISSIONS */}
              <div className="border border-fmb-army/20 bg-fmb-black/30 p-3 rounded space-y-2">
                <span className="text-[9px] text-fmb-gold font-bold uppercase block tracking-wider">🔒 Configurações de Acesso e Patentes</span>
                
                <div>
                  <label className="text-[9px] text-gray-500 block uppercase mb-1">Limitar Leitura por Patentes (Opcional)</label>
                  <div className="bg-fmb-slate border border-fmb-army/25 rounded p-2 max-h-[100px] overflow-y-auto space-y-1.5">
                    {hierarchyConfigs.map(hc => {
                      const isChecked = docAllowedRanks.includes(hc.rank);
                      return (
                        <label key={hc.rank} className="flex items-center space-x-2 text-[9px] cursor-pointer text-gray-300 hover:text-white">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setDocAllowedRanks(docAllowedRanks.filter(r => r !== hc.rank));
                              } else {
                                setDocAllowedRanks([...docAllowedRanks, hc.rank]);
                              }
                            }}
                            className="rounded bg-fmb-black border-fmb-army/35 text-fmb-gold focus:ring-0"
                          />
                          <span>{hc.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

            </div>

            <div className="flex gap-3 mt-6 border-t border-fmb-army/10 pt-4">
              <button
                onClick={() => setShowDocModal(false)}
                className="flex-1 border border-fmb-army/30 text-gray-400 hover:text-white py-2 rounded font-mono text-[10px] uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveDocument}
                disabled={savingDoc}
                className="flex-1 bg-fmb-gold text-fmb-black hover:bg-white font-mono text-[10px] uppercase font-black py-2 rounded cursor-pointer disabled:opacity-50"
              >
                {savingDoc ? "Salvando..." : "Salvar Manual"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
