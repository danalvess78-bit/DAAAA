import React, { useEffect, useState } from "react";
import { 
  Settings, KeyRound, AlertTriangle, UserMinus, ShieldAlert, Logs, 
  Trash2, UserX, UserCheck, Star, RefreshCw, Terminal, CheckCircle2,
  Users, Shield, Trophy, LayoutGrid, Award, BookOpen, Clock, Lock,
  Download, UploadCloud, FileJson, Pencil, X, Sliders
} from "lucide-react";
import { motion } from "motion/react";
import { api } from "../lib/api.js";
import { User, MilitaryRank, SystemLog, SubCargo, getRankOrder, RankPermissions } from "../types.js";
import ConfirmModal from "./ConfirmModal.js";

interface AdminPanelProps {
  viewer: User;
  militarsList: User[];
  onRefreshDashboard: () => void;
}

export default function AdminPanel({ viewer, militarsList, onRefreshDashboard }: AdminPanelProps) {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // States to authorize delegant administrators
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [loadingAdminPerm, setLoadingAdminPerm] = useState(true);

  // States for search filter
  const [searchTerm, setSearchTerm] = useState("");

  // Filtered military lists based on search
  const filteredMilitars = searchTerm.trim()
    ? militarsList.filter(m => 
        m.habboNick.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        m.role.toLowerCase().includes(searchTerm.toLowerCase().trim())
      )
    : militarsList;

  // States for password reset
  const [selectedMilitarNick, setSelectedMilitarNick] = useState("");
  const [newPass, setNewPass] = useState("");
  const [passSuccess, setPassSuccess] = useState<string | null>(null);
  const [passError, setPassError] = useState<string | null>(null);

  // States for direct role update (mudar cargo sem promover)
  const [directRoleTargetNick, setDirectRoleTargetNick] = useState("");
  const [directRoleNewRank, setDirectRoleNewRank] = useState("");
  const [directRoleSuccess, setDirectRoleSuccess] = useState<string | null>(null);
  const [directRoleError, setDirectRoleError] = useState<string | null>(null);
  const [directRoleUpdating, setDirectRoleUpdating] = useState(false);

  // States for ban / suspension
  const [actionTargetNick, setActionTargetNick] = useState("");
  const [actionReason, setActionReason] = useState("");
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // States for Hall of Fame
  const [hallMilitarNick, setHallMilitarNick] = useState("");
  const [hallInstructorNick, setHallInstructorNick] = useState("");
  const [hallDestaqueNick, setHallDestaqueNick] = useState("");
  const [hallSuccess, setHallSuccess] = useState<string | null>(null);

  // States for dynamic training and document categories management
  const [categoriesList, setCategoriesList] = useState<any[]>([]); // stores [{ name: string, minRank: MilitaryRank }]
  const [docCategoriesList, setDocCategoriesList] = useState<string[]>([]);
  const [categoryTab, setCategoryTab] = useState<"instrucoes" | "documentos">("instrucoes");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryAbbrev, setNewCategoryAbbrev] = useState("");
  const [newCategoryFullName, setNewCategoryFullName] = useState("");
  const [newCategoryMinRank, setNewCategoryMinRank] = useState<string>("SOLDADO");
  const [editingCategory, setEditingCategory] = useState<{ type: "training" | "document"; oldName: string; name: string; minRank?: string } | null>(null);
  const [deletingCategoryItem, setDeletingCategoryItem] = useState<{ name: string; type: "instrucoes" | "documentos" } | null>(null);
  const [categorySuccess, setCategorySuccess] = useState<string | null>(null);

  // States for hierarchy editor
  const [hierarchyList, setHierarchyList] = useState<any[]>([]);
  const [selectedRankToEdit, setSelectedRankToEdit] = useState<string>("");
  const [editRankLabel, setEditRankLabel] = useState("");
  const [editRankDesc, setEditRankDesc] = useState("");
  const [editRankPermissions, setEditRankPermissions] = useState<any>({
    canEnlist: false,
    canPromote: false,
    canTrain: false,
    canManageDocs: false,
    canManageCategories: false,
    canManageMissions: false,
    canAdminSystem: false,
    canViewInstrucoes: false,
    canViewOperacoes: false,
    canViewPostarAulas: false,
    canViewBaterPonto: false,
    canEnterService: false
  });
  const [hierarchySuccess, setHierarchySuccess] = useState<string | null>(null);
  const [isCreatingRank, setIsCreatingRank] = useState(false);
  const [newRankId, setNewRankId] = useState("");

  // Supabase Connection status
  const [supabaseStatus, setSupabaseStatus] = useState<{ 
    configured: boolean, 
    synced: boolean, 
    status: string, 
    lastError?: string | null,
    dbUpdatedAt?: string | null,
    url?: string | null,
    maskedKey?: string | null,
    logs?: Array<{ timestamp: string; type: "info" | "success" | "warn" | "error"; message: string }>
  } | null>(null);
  const [showSqlGuide, setShowSqlGuide] = useState(false);
  const [syncingSupabaseForce, setSyncingSupabaseForce] = useState(false);
  const [syncForceResult, setSyncForceResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchSupabaseStatus = async () => {
    try {
      const res = await fetch("/api/admin/supabase-status", {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("fmb_token") || ""}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSupabaseStatus(data);
      }
    } catch (err) {
      console.warn("Erro ao ler status do Supabase:", err);
    }
  };

  const handleForceSync = async () => {
    setSyncingSupabaseForce(true);
    setSyncForceResult(null);
    try {
      const res = await fetch("/api/admin/supabase-sync-force", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("fmb_token") || ""}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        if (data.success) {
          setSyncForceResult({ success: true, message: "Sincronização imediata gravada com sucesso no Supabase!" });
        } else {
          setSyncForceResult({ success: false, message: `Erro na gravação remota: ${data.lastError || 'Tabela ou bucket inacessível'}` });
        }
        setSupabaseStatus(data);
      } else {
        setSyncForceResult({ success: false, message: data.error || "Rejeição mútua ao intermediar sincronização direta." });
      }
    } catch (err: any) {
      setSyncForceResult({ success: false, message: "Erro de conectividade física: " + err.message });
    } finally {
      setSyncingSupabaseForce(false);
    }
  };

  // States for pending enlistments in Administration
  const [pendingEnlistments, setPendingEnlistments] = useState<any[]>([]);
  const [enlisting, setEnlisting] = useState(false);
  const [enlistSuccess, setEnlistSuccess] = useState<string | null>(null);
  const [enlistError, setEnlistError] = useState<string | null>(null);

  // --- LOCAL BACKUP & RESTORICAL CONTROL STATES ---
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);
  const [selectedBackupJson, setSelectedBackupJson] = useState<any | null>(null);
  const [backupFileName, setBackupFileName] = useState<string | null>(null);

  // --- ADMINISTRATION SUBCATEGORY TABS & SUB-CARGOS SYSTEM STATES ---
  const [adminTab, setAdminTab] = useState<"membros" | "hierarquia_subcargos" | "categorias" | "sistema">("membros");
  const [subCargosList, setSubCargosList] = useState<SubCargo[]>([]);
  const [loadingSubCargos, setLoadingSubCargos] = useState(false);
  const [newSubCargoId, setNewSubCargoId] = useState("");
  const [newSubCargoLabel, setNewSubCargoLabel] = useState("");
  const [newSubCargoDesc, setNewSubCargoDesc] = useState("");
  const [newSubCargoMinRank, setNewSubCargoMinRank] = useState<string>("SOLDADO");
  const [editingSubCargo, setEditingSubCargo] = useState<SubCargo | null>(null);
  const [subCargoPermissions, setSubCargoPermissions] = useState<RankPermissions>({
    canEnlist: false,
    canPromote: false,
    canTrain: false,
    canManageDocs: false,
    canManageCategories: false,
    canManageMissions: false,
    canAdminSystem: false,
    canViewInstrucoes: false,
    canViewOperacoes: false,
    canViewPostarAulas: false,
    canViewBaterPonto: false,
    canEnterService: true,
    canWarn: false
  });
  
  // Update permissions state when editing changes
  React.useEffect(() => {
    if (editingSubCargo) {
      setSubCargoPermissions(editingSubCargo.permissions || {
        canEnlist: false,
        canPromote: false,
        canTrain: false,
        canManageDocs: false,
        canManageCategories: false,
        canManageMissions: false,
        canAdminSystem: false,
        canViewInstrucoes: false,
        canViewOperacoes: false,
        canViewPostarAulas: false,
        canViewBaterPonto: false,
        canEnterService: true,
        canWarn: false
      });
    } else {
      setSubCargoPermissions({
        canEnlist: false,
        canPromote: false,
        canTrain: false,
        canManageDocs: false,
        canManageCategories: false,
        canManageMissions: false,
        canAdminSystem: false,
        canViewInstrucoes: false,
        canViewOperacoes: false,
        canViewPostarAulas: false,
        canViewBaterPonto: false,
        canEnterService: true,
        canWarn: false
      });
    }
  }, [editingSubCargo]);

  const [subCargoSuccess, setSubCargoSuccess] = useState<string | null>(null);
  const [subCargoError, setSubCargoError] = useState<string | null>(null);

  // States for Assigning SubCargo to Users
  const [assignTargetNick, setAssignTargetNick] = useState("");
  const [assignSelectedSubCargoId, setAssignSelectedSubCargoId] = useState("");
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assigningSub, setAssigningSub] = useState(false);

  // States for Custom Tab Permissions
  const [instrutoresAllowed, setInstrutoresAllowed] = useState<string[]>([]);
  const [amanAllowed, setAmanAllowed] = useState<string[]>([]);
  const [cdmAllowed, setCdmAllowed] = useState<string[]>([]);
  const [savingTabPerms, setSavingTabPerms] = useState(false);
  const [tabPermSuccess, setTabPermSuccess] = useState<string | null>(null);
  const [tabPermError, setTabPermError] = useState<string | null>(null);

  const fetchCustomTabPermissions = async () => {
    try {
      const data = await api.getCustomPermissions();
      setInstrutoresAllowed(data.instrutoresViewAllowed || []);
      setAmanAllowed(data.amanViewAllowed || []);
      setCdmAllowed(data.cdmViewAllowed || []);
    } catch (e) {
      console.warn("Erro ao obter permissões customizadas de abas:", e);
    }
  };

  const handleSaveTabPermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTabPerms(true);
    setTabPermSuccess(null);
    setTabPermError(null);
    try {
      await api.updateCustomPermissions({
        instrutoresViewAllowed: instrutoresAllowed,
        amanViewAllowed: amanAllowed,
        cdmViewAllowed: cdmAllowed
      });
      setTabPermSuccess("Permissões de acesso das abas exclusivas salvas e decretadas no QG com absoluto sucesso!");
      setTimeout(() => setTabPermSuccess(null), 4000);
    } catch (err: any) {
      setTabPermError(err.message || "Erro ao salvar permissões de abas.");
    } finally {
      setSavingTabPerms(false);
    }
  };

  const handleDownloadBackup = async () => {
    setBackupLoading(true);
    setBackupError(null);
    setBackupSuccess(null);
    try {
      const data = await api.downloadBackup();
      const stringified = JSON.stringify(data, null, 2);
      const blob = new Blob([stringified], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const currentDate = new Date().toISOString().substring(0, 10);
      a.href = url;
      a.download = `backup_fmb_militar_${currentDate}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupSuccess("Arquivo de backup gerado e descarregado com êxito! Guarde-o em segurança.");
    } catch (err: any) {
      setBackupError(err.message || "Erro ao fazer download do arquivo de backup.");
    } finally {
      setBackupLoading(false);
    }
  };

  const handleBackupFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBackupError(null);
    setBackupSuccess(null);
    setSelectedBackupJson(null);
    setBackupFileName(null);
    
    const file = e.target.files?.[0];
    if (!file) return;

    setBackupFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json || typeof json !== "object") {
          throw new Error("Formato inválido. O arquivo precisa conter um objeto JSON válido.");
        }
        if (!json.users || !json.passwords || !json.rankConfigs) {
          throw new Error("Arquivo corrompido / impróprio. Faltam tabelas essenciais (como 'users' ou 'passwords').");
        }
        setSelectedBackupJson(json);
      } catch (err: any) {
        setBackupError("Erro ao ler JSON: " + err.message);
        setSelectedBackupJson(null);
      }
    };
    reader.onerror = () => {
      setBackupError("Não foi possível ler o arquivo de backup selecionado.");
    };
    reader.readAsText(file);
  };

  const handleConfirmRestoreBackup = async () => {
    if (!selectedBackupJson) return;
    if (!window.confirm("ATENÇÃO SOLDADO! Você está prestes a SUBSTITUIR todos os dados de militares, pontos, níveis, logs e missões no QG! Esta operação é IRREVERSÍVEL. Tem certeza que deseja dar continuidade?")) {
      return;
    }
    setBackupLoading(true);
    setBackupError(null);
    setBackupSuccess(null);
    try {
      const result = await api.restoreBackup(selectedBackupJson);
      setBackupSuccess(result.message || "Banco de dados militar restaurado com sucesso tático absoluto!");
      setSelectedBackupJson(null);
      setBackupFileName(null);
      onRefreshDashboard();
      fetchSupabaseStatus();
    } catch (err: any) {
      setBackupError(err.message || "Falha ao restaurar backup no servidor.");
    } finally {
      setBackupLoading(false);
    }
  };

  const fetchEnlistmentRequests = async () => {
    try {
      const data = await api.getEnlistmentRequests();
      setPendingEnlistments(data || []);
    } catch (e) {
      console.warn("Nenhum pedido de alistamento pendente.");
      setPendingEnlistments([]);
    }
  };

  const handleApproveEnlistment = async (id: string, nick: string) => {
    setEnlisting(true);
    setEnlistError(null);
    setEnlistSuccess(null);
    try {
      await api.approveEnlistmentRequest(id);
      setEnlistSuccess(`Alistamento de @${nick} aprovado com sucesso!`);
      fetchEnlistmentRequests();
      onRefreshDashboard();
    } catch (err: any) {
      setEnlistError(err.message || "Erro ao aprovar alistamento.");
    } finally {
      setEnlisting(false);
    }
  };

  const handleRejectEnlistment = async (id: string, nick: string) => {
    setEnlisting(true);
    setEnlistError(null);
    setEnlistSuccess(null);
    try {
      await api.rejectEnlistmentRequest(id);
      setEnlistSuccess(`Pedido de @${nick} recusado com sucesso.`);
      fetchEnlistmentRequests();
      onRefreshDashboard();
    } catch (err: any) {
      setEnlistError(err.message || "Erro ao recusar alistamento.");
    } finally {
      setEnlisting(false);
    }
  };

  const fetchAuditLogs = async () => {
    setLoadingLogs(true);
    try {
      const audit = await api.getLogs();
      setLogs(audit || []);
    } catch (e) {
      console.warn("Sem acesso aos logs do Alto Comando.");
    } finally {
      setLoadingLogs(false);
    }
  };

  const loadDestaqueSelections = async () => {
    try {
      const data = await api.getDestaques();
      if (data.militaryOfTheMonth) setHallMilitarNick(data.militaryOfTheMonth.habboNick);
      if (data.instructorOfTheMonth) setHallInstructorNick(data.instructorOfTheMonth.habboNick);
      if (data.destaqueOperacional) setHallDestaqueNick(data.destaqueOperacional.habboNick);
    } catch (e) {
      console.warn("Erro ao obter destaques iniciais.");
    }
  };

  const fetchHierarchy = async () => {
    try {
      const data = await api.getHierarchy();
      setHierarchyList(data || []);
      if (data.length > 0) {
        // Preset with the first element's attributes
        handleSelectRank(data[0]);
      }
    } catch (e) {
      console.warn("Erro ao obter a árvore de hierarquias.");
    }
  };

  const handleSelectRank = (config: any) => {
    setIsCreatingRank(false);
    setSelectedRankToEdit(config.rank);
    setEditRankLabel(config.label);
    setEditRankDesc(config.description);
    setEditRankPermissions(config.permissions || {
      canEnlist: false,
      canPromote: false,
      canTrain: false,
      canManageDocs: false,
      canManageCategories: false,
      canManageMissions: false,
      canAdminSystem: false,
      canViewInstrucoes: false,
      canViewOperacoes: false,
      canViewPostarAulas: false,
      canViewBaterPonto: false,
      canEnterService: true
    });
  };

  const handleCreateRankClick = () => {
    setIsCreatingRank(true);
    setSelectedRankToEdit("");
    setNewRankId("");
    setEditRankLabel("");
    setEditRankDesc("");
    setEditRankPermissions({
      canEnlist: false,
      canPromote: false,
      canTrain: false,
      canManageDocs: false,
      canManageCategories: false,
      canManageMissions: false,
      canAdminSystem: false,
      canViewInstrucoes: false,
      canViewOperacoes: false,
      canViewPostarAulas: false,
      canViewBaterPonto: false,
      canEnterService: true
    });
  };

  const handleDeleteRankConfig = async () => {
    if (!selectedRankToEdit) return;
    if (selectedRankToEdit === "SOLDADO" || selectedRankToEdit === "ADMSUPREMO" || selectedRankToEdit === "Administrador Supremo") {
      alert("Este cargo é nativo da corporação e não pode ser removido.");
      return;
    }
    if (!window.confirm(`ATENÇÃO MÁXIMA: Tem certeza absoluta de que deseja excluir o cargo "${editRankLabel}" do sistema?`)) {
      return;
    }
    try {
      await api.deleteHierarchy(selectedRankToEdit);
      setHierarchySuccess(`O cargo "${editRankLabel}" foi removido com sucesso.`);
      setSelectedRankToEdit("");
      setEditRankLabel("");
      setEditRankDesc("");
      const data = await api.getHierarchy();
      setHierarchyList(data || []);
      fetchAuditLogs();
      onRefreshDashboard();
    } catch (err: any) {
      alert(err.message || "Erro ao excluir cargo decretado.");
    }
  };

  const handleSaveRankConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const rankId = isCreatingRank ? newRankId.toUpperCase().trim().replace(/[^A-Z0-9_]/g, "_") : selectedRankToEdit;
    if (!rankId) {
      alert("Informe o ID de identificação única do cargo.");
      return;
    }
    setHierarchySuccess(null);
    try {
      await api.updateHierarchy(rankId, editRankLabel, editRankDesc, editRankPermissions);
      setHierarchySuccess(isCreatingRank ? `Novo cargo decretado com sucesso: ${editRankLabel}` : `Parâmetros de cargo ajustados para "${editRankLabel}"!`);
      setIsCreatingRank(false);
      setSelectedRankToEdit(rankId);
      const data = await api.getHierarchy();
      setHierarchyList(data || []);
      fetchAuditLogs();
      onRefreshDashboard();
    } catch (err: any) {
      alert(err.message || "Erro ao gravar recalibração de cargo.");
    }
  };

  const fetchCategories = async () => {
    try {
      const list = await api.getTrainingCategories();
      setCategoriesList(list || []);
      const docList = await api.getDocumentCategories();
      setDocCategoriesList(docList || []);
    } catch (err) {
      console.warn("Erro ao obter categorias no painel de controle.");
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCategorySuccess(null);
    try {
      if (categoryTab === "instrucoes") {
        if (!newCategoryAbbrev.trim() || !newCategoryFullName.trim()) {
          alert("Insira a abreviação e o nome do curso.");
          return;
        }
        const formattedName = `[${newCategoryAbbrev.trim().toUpperCase()}] ${newCategoryFullName.trim()}`;
        const updated = await api.addTrainingCategory(formattedName, newCategoryMinRank);
        setCategoriesList(updated || []);
        setCategorySuccess("Categoria de instrução registrada com sucesso!");
        setNewCategoryAbbrev("");
        setNewCategoryFullName("");
      } else {
        if (!newCategoryName.trim()) return;
        const updated = await api.addDocumentCategory(newCategoryName.trim());
        setDocCategoriesList(updated || []);
        setCategorySuccess("Categoria de documento registrada com sucesso!");
        setNewCategoryName("");
      }
      setTimeout(() => setCategorySuccess(null), 4000);
      fetchAuditLogs();
    } catch (err: any) {
      alert(err.message || "Erro ao adicionar categoria.");
    }
  };

  const handleDeleteCategory = (cat: string) => {
    setDeletingCategoryItem({ name: cat, type: categoryTab });
  };

  const executeDeleteCategory = async () => {
    if (!deletingCategoryItem) return;
    const { name, type } = deletingCategoryItem;
    setCategorySuccess(null);
    try {
      if (type === "instrucoes") {
        const updated = await api.deleteTrainingCategory(name);
        setCategoriesList(updated || []);
        setCategorySuccess("Categoria de instrução descredenciada.");
      } else {
        const updated = await api.deleteDocumentCategory(name);
        setDocCategoriesList(updated || []);
        setCategorySuccess("Categoria de documento descredenciada.");
      }
      setDeletingCategoryItem(null);
      setTimeout(() => setCategorySuccess(null), 4000);
      fetchAuditLogs();
    } catch (err: any) {
      alert(err.message || "Erro ao remover categoria.");
    }
  };

  const handleStartEditCategory = (cat: any) => {
    if (categoryTab === "instrucoes") {
      setEditingCategory({
        type: "training",
        oldName: cat.name,
        name: cat.name,
        minRank: cat.minRank
      });
    } else {
      setEditingCategory({
        type: "document",
        oldName: cat,
        name: cat
      });
    }
  };

  const handleSaveEditCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editingCategory.name.trim()) return;
    setCategorySuccess(null);
    try {
      if (editingCategory.type === "training") {
        const updated = await api.updateTrainingCategory(editingCategory.oldName, editingCategory.name.trim(), editingCategory.minRank);
        setCategoriesList(updated || []);
        setCategorySuccess("Categoria de instrução atualizada com sucesso!");
      } else {
        const updated = await api.updateDocumentCategory(editingCategory.oldName, editingCategory.name.trim());
        setDocCategoriesList(updated || []);
        setCategorySuccess("Categoria de documento atualizada com sucesso!");
      }
      setEditingCategory(null);
      setTimeout(() => setCategorySuccess(null), 4000);
      fetchAuditLogs();
    } catch (err: any) {
      alert(err.message || "Erro ao atualizar categoria.");
    }
  };
  const handlePermissionToggle = (key: string) => {
    setEditRankPermissions((prev: any) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const fetchSubCargos = async () => {
    setLoadingSubCargos(true);
    setSubCargoError(null);
    try {
      const data = await api.getSubCargos();
      setSubCargosList(data || []);
    } catch (err: any) {
      setSubCargoError("Erro ao carregar subcargos: " + err.message);
    } finally {
      setLoadingSubCargos(false);
    }
  };

  const handleCreateSubCargo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubCargoSuccess(null);
    setSubCargoError(null);
    if (!newSubCargoId || !newSubCargoLabel) {
      setSubCargoError("ID e Nome do subcargo são obrigatórios.");
      return;
    }
    try {
      const updated = await api.createSubCargo(
        newSubCargoId,
        newSubCargoLabel,
        newSubCargoDesc,
        newSubCargoMinRank,
        subCargoPermissions
      );
      setSubCargosList(updated || []);
      setNewSubCargoId("");
      setNewSubCargoLabel("");
      setNewSubCargoDesc("");
      setNewSubCargoMinRank("SOLDADO");
      setSubCargoPermissions({
        canEnlist: false,
        canPromote: false,
        canTrain: false,
        canManageDocs: false,
        canManageCategories: false,
        canManageMissions: false,
        canAdminSystem: false,
        canViewInstrucoes: false,
        canViewOperacoes: false,
        canViewPostarAulas: false,
        canViewBaterPonto: false,
        canEnterService: true,
        canWarn: false
      });
      setSubCargoSuccess("Subcargo militar criado com sucesso!");
      onRefreshDashboard();
    } catch (err: any) {
      setSubCargoError(err.message || "Erro ao criar subcargo.");
    }
  };

  const handleEditSubCargo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubCargo) return;
    setSubCargoSuccess(null);
    setSubCargoError(null);
    try {
      const updated = await api.updateSubCargo(
        editingSubCargo.id,
        editingSubCargo.label,
        editingSubCargo.description,
        editingSubCargo.minRank,
        subCargoPermissions
      );
      setSubCargosList(updated || []);
      setEditingSubCargo(null);
      setSubCargoSuccess("Subcargo militar atualizado com sucesso!");
      onRefreshDashboard();
    } catch (err: any) {
      setSubCargoError(err.message || "Erro ao atualizar subcargo.");
    }
  };

  const handleDeleteSubCargo = async (id: string) => {
    if (!window.confirm("Deseja realmente excluir este subcargo permanentemente do sistema?")) return;
    setSubCargoSuccess(null);
    setSubCargoError(null);
    try {
      const updated = await api.deleteSubCargo(id);
      setSubCargosList(updated || []);
      setSubCargoSuccess("Subcargo militar excluído com sucesso!");
      onRefreshDashboard();
    } catch (err: any) {
      setSubCargoError(err.message || "Erro ao excluir subcargo.");
    }
  };

  const handleAssignSubCargo = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssignSuccess(null);
    setAssignError(null);
    if (!assignTargetNick || !assignSelectedSubCargoId) {
      setAssignError("Selecione um militar e um subcargo.");
      return;
    }
    setAssigningSub(true);
    try {
      const targetUser = militarsList.find(m => m.habboNick.trim().toLowerCase() === assignTargetNick.trim().toLowerCase());
      if (!targetUser) {
        throw new Error(`Militar @${assignTargetNick} não encontrado.`);
      }
      await api.assignSubCargo(targetUser.id, assignSelectedSubCargoId);
      setAssignSuccess(`Subcargo atribuído com sucesso para @${targetUser.habboNick}!`);
      setAssignTargetNick("");
      onRefreshDashboard();
    } catch (err: any) {
      setAssignError(err.message || "Erro ao atribuir subcargo.");
    } finally {
      setAssigningSub(false);
    }
  };

  const handleRemoveSubCargo = async (userId: string, subCargoId: string) => {
    if (!window.confirm("Deseja realmente remover este subcargo deste militar?")) return;
    setAssignSuccess(null);
    setAssignError(null);
    try {
      await api.removeSubCargo(userId, subCargoId);
      setAssignSuccess("Subcargo militar removido do militar com sucesso!");
      onRefreshDashboard();
    } catch (err: any) {
      setAssignError(err.message || "Erro ao remover subcargo.");
    }
  };

  useEffect(() => {
    const checkAdminPermission = async () => {
      try {
        const hierarchy = await api.getHierarchy();
        const userConfig = hierarchy.find((rc: any) => rc.rank === viewer.role);
        const canAdmin = viewer.role === MilitaryRank.ADMSUPREMO || viewer.role === MilitaryRank.COMANDANTE_GERAL || !!userConfig?.permissions?.canAdminSystem;
        setIsAdminUser(canAdmin);
      } catch (err) {
        console.warn("Erro ao obter hierarquias de comandos:", err);
        setIsAdminUser(viewer.role === MilitaryRank.ADMSUPREMO);
      } finally {
        setLoadingAdminPerm(false);
      }
    };

    checkAdminPermission();
    fetchAuditLogs();
    loadDestaqueSelections();
    fetchHierarchy();
    fetchCategories();
    fetchEnlistmentRequests();
    fetchSupabaseStatus();
    fetchSubCargos();
    fetchCustomTabPermissions();
  }, []);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMilitarNick || !newPass) return;
    
    setPassSuccess(null);
    setPassError(null);
    try {
      const targetUser = militarsList.find(m => m.habboNick.trim().toLowerCase() === selectedMilitarNick.trim().toLowerCase());
      if (!targetUser) {
        throw new Error(`Militar com o nick @${selectedMilitarNick} não foi encontrado.`);
      }
      await api.resetPassword(targetUser.id, newPass);
      setPassSuccess(`Acesso restaurado! Nova senha configurada para @${targetUser.habboNick}.`);
      setNewPass("");
      setSelectedMilitarNick("");
      fetchAuditLogs();
    } catch (err: any) {
      setPassError(err.message || "Erro ao tentar trocar senha.");
    }
  };

  const handleDirectRoleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directRoleTargetNick || !directRoleNewRank) {
      setDirectRoleError("Preencha o nick do militar e o novo cargo.");
      return;
    }
    setDirectRoleUpdating(true);
    setDirectRoleSuccess(null);
    setDirectRoleError(null);
    try {
      const targetUser = militarsList.find(m => m.habboNick.trim().toLowerCase() === directRoleTargetNick.trim().toLowerCase());
      if (!targetUser) {
        throw new Error(`Militar com o nick @${directRoleTargetNick} não foi encontrado.`);
      }
      await api.updateMilitarRoleDirectly(targetUser.id, directRoleNewRank);
      setDirectRoleSuccess(`Cargo de @${targetUser.habboNick} atualizado diretamente com sucesso!`);
      setDirectRoleTargetNick("");
      setDirectRoleNewRank("");
      fetchAuditLogs();
      onRefreshDashboard();
    } catch (err: any) {
      setDirectRoleError(err.message || "Erro ao alterar o cargo diretamente.");
    } finally {
      setDirectRoleUpdating(false);
    }
  };

  const handleBanSubmit = async () => {
    if (!actionTargetNick || !actionReason) return;
    setActionSuccess(null);
    setActionError(null);
    try {
      const target = militarsList.find(m => m.habboNick.trim().toLowerCase() === actionTargetNick.trim().toLowerCase());
      if (!target) {
        throw new Error(`Militar com o nick @${actionTargetNick} não foi encontrado.`);
      }
      await api.banMilitar(target.id, actionReason);
      setActionSuccess(`Militar @${target.habboNick} foi BANIDO sob os termos do Alto Comando.`);
      setActionReason("");
      setActionTargetNick("");
      fetchAuditLogs();
      onRefreshDashboard();
    } catch (err: any) {
      setActionError(err.message || "Ação inválida.");
    }
  };

  const handleSuspendSubmit = async () => {
    if (!actionTargetNick || !actionReason) return;
    setActionSuccess(null);
    setActionError(null);
    try {
      const target = militarsList.find(m => m.habboNick.trim().toLowerCase() === actionTargetNick.trim().toLowerCase());
      if (!target) {
        throw new Error(`Militar com o nick @${actionTargetNick} não foi encontrado.`);
      }
      await api.suspendMilitar(target.id, actionReason);
      setActionSuccess(`Militar @${target.habboNick} foi SUSPENSO.`);
      setActionReason("");
      setActionTargetNick("");
      fetchAuditLogs();
      onRefreshDashboard();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleReactivateSubmit = async () => {
    if (!actionTargetNick) return;
    setActionSuccess(null);
    setActionError(null);
    try {
      const target = militarsList.find(m => m.habboNick.trim().toLowerCase() === actionTargetNick.trim().toLowerCase());
      if (!target) {
        throw new Error(`Militar com o nick @${actionTargetNick} não foi encontrado.`);
      }
      await api.reactivateMilitar(target.id);
      setActionSuccess(`Conta do militar @${target.habboNick} foi REATIVADA.`);
      setActionTargetNick("");
      fetchAuditLogs();
      onRefreshDashboard();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleDeleteSubmit = () => {
    if (!actionTargetNick) return;
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    setShowDeleteConfirm(false);
    if (!actionTargetNick) return;
    setActionSuccess(null);
    setActionError(null);
    try {
      const target = militarsList.find(m => m.habboNick.trim().toLowerCase() === actionTargetNick.trim().toLowerCase());
      if (!target) {
        throw new Error(`Militar com o nick @${actionTargetNick} não foi encontrado.`);
      }
      await api.deleteMilitar(target.id);
      setActionSuccess(`Militar expulso e deletado eternamente do sistema.`);
      setActionTargetNick("");
      fetchAuditLogs();
      onRefreshDashboard();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleDestaquesSave = async () => {
    setHallSuccess(null);
    try {
      let mId = "";
      let instId = "";
      let destId = "";
      
      if (hallMilitarNick.trim()) {
        const m = militarsList.find(x => x.habboNick.trim().toLowerCase() === hallMilitarNick.trim().toLowerCase());
        if (!m) throw new Error(`Militar do Mês "${hallMilitarNick}" não encontrado.`);
        mId = m.id;
      }
      
      if (hallInstructorNick.trim()) {
        const inst = militarsList.find(x => x.habboNick.trim().toLowerCase() === hallInstructorNick.trim().toLowerCase());
        if (!inst) throw new Error(`Instrutor do Mês "${hallInstructorNick}" não encontrado.`);
        instId = inst.id;
      }
      
      if (hallDestaqueNick.trim()) {
        const dest = militarsList.find(x => x.habboNick.trim().toLowerCase() === hallDestaqueNick.trim().toLowerCase());
        if (!dest) throw new Error(`Destaque Operacional "${hallDestaqueNick}" não encontrado.`);
        destId = dest.id;
      }
      
      await api.updateDestaques(mId, instId, destId);
      setHallSuccess("Quadro de Destaques e Medalhas do Hall da Fama atualizados com sucesso!");
      fetchAuditLogs();
      onRefreshDashboard();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loadingAdminPerm) {
    return <div className="text-center py-10 font-mono text-gray-500 text-xs">Avaliando credenciais do militar...</div>;
  }

  if (!isAdminUser) {
    return (
      <div className="p-8 border border-red-500/20 bg-red-950/10 rounded-lg text-center font-mono space-y-4">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto animate-bounce" />
        <h4 className="text-white uppercase font-bold text-base">Acesso Negado: Célula de Comando Suprema</h4>
        <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
          Sua patente militar de <span className="text-fmb-gold font-bold">{viewer.role}</span> não confere credenciais para alterar configurações centrais do sistema, redefinir acessos, ou analisar as folhas secretas de log.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 pb-3 border-b border-fmb-army/20">
        <Settings className="w-5 h-5 text-fmb-gold" />
        <h3 className="font-display font-bold text-lg text-white uppercase tracking-tight">Administração & Controle Supremo</h3>
      </div>

      {/* ABAS DE SUB-CATEGORIAS DA ADMINISTRAÇÃO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 border-b border-fmb-army/20 pb-4">
        <button
          onClick={() => setAdminTab("membros")}
          className={`flex items-center space-x-3 p-3 rounded-lg border text-left transition-all cursor-pointer ${
            adminTab === "membros"
              ? "bg-fmb-army/30 border-fmb-gold text-white font-bold shadow-md"
              : "bg-fmb-black/40 border-fmb-army/20 text-gray-400 hover:bg-fmb-slate/20 hover:text-white"
          }`}
        >
          <Users className={`w-5 h-5 shrink-0 ${adminTab === "membros" ? "text-fmb-gold" : "text-gray-500"}`} />
          <div className="font-mono text-xs leading-tight">
            <p className="font-bold uppercase tracking-wider">Gestão de Militares</p>
            <span className="text-[9px] opacity-80 block mt-0.5">Alistamentos, Senhas, Patentes & Sanções</span>
          </div>
        </button>

        <button
          onClick={() => setAdminTab("hierarquia_subcargos")}
          className={`flex items-center space-x-3 p-3 rounded-lg border text-left transition-all cursor-pointer ${
            adminTab === "hierarquia_subcargos"
              ? "bg-fmb-army/30 border-fmb-gold text-white font-bold shadow-md"
              : "bg-fmb-black/40 border-fmb-army/20 text-gray-400 hover:bg-fmb-slate/20 hover:text-white"
          }`}
        >
          <Shield className={`w-5 h-5 shrink-0 ${adminTab === "hierarquia_subcargos" ? "text-fmb-gold" : "text-gray-500"}`} />
          <div className="font-mono text-xs leading-tight">
            <p className="font-bold uppercase tracking-wider">Hierarquia & Subcargos</p>
            <span className="text-[9px] opacity-80 block mt-0.5">Permissões de Cargos & Subcargos</span>
          </div>
        </button>

        <button
          onClick={() => setAdminTab("categorias")}
          className={`flex items-center space-x-3 p-3 rounded-lg border text-left transition-all cursor-pointer ${
            adminTab === "categorias"
              ? "bg-fmb-army/30 border-fmb-gold text-white font-bold shadow-md"
              : "bg-fmb-black/40 border-fmb-army/20 text-gray-400 hover:bg-fmb-slate/20 hover:text-white"
          }`}
        >
          <BookOpen className={`w-5 h-5 shrink-0 ${adminTab === "categorias" ? "text-fmb-gold" : "text-gray-500"}`} />
          <div className="font-mono text-xs leading-tight">
            <p className="font-bold uppercase tracking-wider">Categorias do Sistema</p>
            <span className="text-[9px] opacity-80 block mt-0.5">Customizar Instruções, Treinos & Manuais</span>
          </div>
        </button>

        <button
          onClick={() => setAdminTab("sistema")}
          className={`flex items-center space-x-3 p-3 rounded-lg border text-left transition-all cursor-pointer ${
            adminTab === "sistema"
              ? "bg-fmb-army/30 border-fmb-gold text-white font-bold shadow-md"
              : "bg-fmb-black/40 border-fmb-army/20 text-gray-400 hover:bg-fmb-slate/20 hover:text-white"
          }`}
        >
          <Terminal className={`w-5 h-5 shrink-0 ${adminTab === "sistema" ? "text-fmb-gold" : "text-gray-500"}`} />
          <div className="font-mono text-xs leading-tight">
            <p className="font-bold uppercase tracking-wider">Backup & Sincronização</p>
            <span className="text-[9px] opacity-80 block mt-0.5">Banco de Dados, Backup JSON & Auditoria</span>
          </div>
        </button>
      </div>

      {adminTab === "sistema" && (
        <>
          {/* SUPABASE DEPLOYMENT STATUS WARNING BANNER */}
          {supabaseStatus && (
        <div className="space-y-3">
          <div className={`p-4 border font-mono rounded-lg relative flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-left ${
            supabaseStatus.status === "connected" && !supabaseStatus.lastError
              ? "bg-green-950/20 border-green-500/30 text-green-300"
              : "bg-red-950/20 border-red-500/30 text-red-300"
          }`}>
            <div className="flex items-start space-x-3">
              <span className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${
                supabaseStatus.status === "connected" && !supabaseStatus.lastError ? "bg-green-500 animate-pulse" : "bg-red-500"
              }`} />
              <div>
                <p className="font-bold uppercase tracking-wider text-[11px]">
                  {supabaseStatus.status === "connected" && !supabaseStatus.lastError 
                    ? "● BANCO DE DADOS SUPABASE CLOUD: ATIVO & SINCRONIZADO" 
                    : "⚠ ERRO NA GRAVAÇÃO DO SUPABASE (DADOS EXCLUSIVOS NA CACHE LOCAL)"}
                </p>
                <p className="text-[10px] opacity-85 mt-0.5 leading-relaxed">
                  {supabaseStatus.status === "connected" && !supabaseStatus.lastError
                    ? `Status: Sincronização redundante e persistente ativa no Supabase via fmb_state. ÚLTIMA ATUALIZAÇÃO LOCAL: ${supabaseStatus.dbUpdatedAt ? new Date(supabaseStatus.dbUpdatedAt).toLocaleString('pt-BR') : 'Sem registro'}.`
                    : `As alterações militares estão salvas temporariamente na memória do servidor (Cache Local), mas serão excluídas no próximo reinício caso a gravação no Supabase continue falhando.`}
                </p>
                {supabaseStatus.lastError && (
                  <div className="mt-2.5 p-2 bg-black/40 border border-red-500/25 rounded text-[10px] text-red-400 font-mono break-all max-w-2xl">
                    <span className="font-bold uppercase block text-red-500 mb-0.5">RAZÃO DETALHADA DO SISTEMA:</span>
                    {supabaseStatus.lastError}
                    <div className="mt-1 text-[9px] text-red-300/80 leading-tight">
                      {supabaseStatus.lastError.toLowerCase().includes("fetch failed") ? (
                        <span className="text-amber-400 font-semibold block mt-1 leading-relaxed">
                          ⚠️ ALERTA DE CONEXÃO FÍSICA / PROJETO PAUSADO:
                          <br />O servidor não pôde fazer contato físico ou DNS com o Supabase. Isso geralmente ocorre por dois motivos principais:
                          <br />• <strong className="text-white underline">PROJETO PAUSADO:</strong> Se o seu projeto gratuito no Supabase ficou inativo por alguns dias, ele é pausado automaticamente pelo Supabase. Vá ao painel do Supabase, clique em <strong className="text-white font-mono">"Restore" / "Resume Project"</strong> e aguarde 1 minuto antes de tentar novamente.
                          <br />• <strong className="text-white underline">URL OU CHAVE INCORRETAS:</strong> Verifique as variáveis de ambiente no menu de configurações (Settings) do AI Studio. Certifique-se de que não há espaços extras ou caracteres copiados incorretamente.
                        </span>
                      ) : (
                        <>
                          Geralmente isso ocorre porque a tabela <code className="bg-red-950 px-1 border border-red-500/20 rounded font-bold">fmb_state</code> não foi criada no banco de dados do Supabase ou está protegida por Row Level Security (RLS) sem políticas de acesso configuradas.
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 shrink-0 self-end md:self-center w-full md:w-auto">
              <button 
                type="button"
                disabled={syncingSupabaseForce}
                onClick={handleForceSync}
                className={`px-3 py-1.5 text-[9px] border rounded transition-colors uppercase font-bold inline-flex items-center justify-center space-x-1 cursor-pointer ${
                  syncingSupabaseForce 
                    ? "bg-gray-500/20 border-gray-500/30 text-gray-400 cursor-not-allowed" 
                    : "bg-fmb-gold/20 hover:bg-fmb-gold/30 border-fmb-gold/50 text-fmb-gold"
                }`}
              >
                <span>{syncingSupabaseForce ? "Salvando..." : "Salvar no Supabase Agora"}</span>
              </button>
              <button 
                type="button"
                onClick={() => setShowSqlGuide(!showSqlGuide)}
                className="px-3 py-1.5 text-[9px] bg-fmb-army/30 hover:bg-fmb-army/50 border border-fmb-gold/30 text-white rounded transition-colors uppercase font-bold inline-flex items-center justify-center space-x-1 cursor-pointer"
              >
                <span>{showSqlGuide ? "Ocultar SQL" : "Como corrigir com SQL"}</span>
              </button>
              <button 
                type="button"
                onClick={fetchSupabaseStatus}
                className="px-3 py-1.5 text-[9px] bg-white/10 hover:bg-white/20 text-white rounded transition-colors uppercase font-bold inline-flex items-center justify-center space-x-1 cursor-pointer font-bold"
              >
                <span>Verificar Conexão</span>
              </button>
            </div>
          </div>

          {/* SUPABASE LIVE CONSOLE LOGS */}
          <div className="bg-fmb-black/90 border border-fmb-army/20 rounded-lg p-3 font-mono text-[10px] space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-fmb-army/10 pb-1.5 gap-1 select-none">
              <span className="text-fmb-gold font-bold uppercase tracking-wider text-[9px] flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${supabaseStatus.status === "connected" && !supabaseStatus.lastError ? "bg-green-400 animate-pulse" : "bg-red-400 animate-pulse"}`} />
                Histórico Operacional de Sincronização Supabase
              </span>
              <span className="text-[8.5px] text-gray-400">
                <strong>Host:</strong> <span className="text-gray-300 font-bold font-mono">{supabaseStatus.url || "Desconfigurado"}</span> | <strong>Chave:</strong> <span className="text-gray-300 font-mono font-bold">{supabaseStatus.maskedKey || "Inexistente"}</span>
              </span>
            </div>
            
            <div className="max-h-[140px] overflow-y-auto space-y-1.5 scrollbar-thin text-left pr-1">
              {supabaseStatus.logs && supabaseStatus.logs.length > 0 ? (
                supabaseStatus.logs.map((log, index) => {
                  let badgeColor = "text-blue-400 bg-blue-990/40 border-blue-500/20";
                  if (log.type === "success") badgeColor = "text-green-400 bg-green-950/40 border-green-500/20";
                  if (log.type === "warn") badgeColor = "text-amber-400 bg-amber-950/40 border-amber-500/20";
                  if (log.type === "error") badgeColor = "text-red-400 bg-red-950/40 border-red-500/20";
                  
                  return (
                    <div key={index} className="flex items-start space-x-2 border-b border-fmb-army/5 pb-1">
                      <span className="text-gray-500 shrink-0">
                        [{new Date(log.timestamp).toLocaleTimeString('pt-BR')}]
                      </span>
                      <span className={`px-1 rounded text-[8px] border font-bold capitalize shrink-0 ${badgeColor}`}>
                        {log.type}
                      </span>
                      <span className="text-gray-300 break-all leading-relaxed">
                        {log.message}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="text-gray-500 italic py-2 text-center">Nenhum log operacional registrado no canal Supabase.</div>
              )}
            </div>
          </div>

          {syncForceResult && (
            <div className={`p-3 text-[11px] font-mono rounded border flex items-center justify-between gap-2 text-left animate-fade-in ${
              syncForceResult.success 
                ? "bg-green-950/30 border-green-500/40 text-green-400" 
                : "bg-red-950/30 border-red-500/40 text-red-400"
            }`}>
              <div className="flex-1">
                <span className="font-bold mr-1.5">{syncForceResult.success ? "✓ SINC-OK:" : "⚠ SINC-ERRO:"}</span>
                {syncForceResult.message}
              </div>
              <button 
                type="button"
                onClick={() => setSyncForceResult(null)}
                className="text-[9px] uppercase font-bold text-white/70 hover:text-white px-1.5 py-0.5 bg-white/10 hover:bg-white/20 rounded transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          )}

          {showSqlGuide && (
            <div className="bg-fmb-slate/95 border border-fmb-gold/30 rounded-lg p-4 font-mono text-xs text-left text-gray-300 space-y-3 shadow-2xl animate-fade-in">
              <div className="border-b border-fmb-gold/20 pb-2">
                <h4 className="font-display font-bold uppercase text-[11px] text-fmb-gold tracking-wider">
                  Guia de Correção Absoluta de Persistência no Supabase
                </h4>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Execute o comando SQL abaixo no console de scripts SQL do seu painel do Supabase para criar a estrutura e liberar as permissões necessárias:
                </p>
              </div>

              <div className="bg-fmb-black/95 border border-fmb-army/45 p-3 rounded font-mono text-[10px] text-green-300 relative select-all leading-relaxed whitespace-pre font-semibold max-h-[350px] overflow-y-auto">
{`-- 1. TABELA PRINCIPAL DE ESTADO COMPACTADO (REDUNDÂNCIA GERAL)
CREATE TABLE IF NOT EXISTS fmb_state (
  id bigint PRIMARY KEY,
  data jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABELA INDIVIDUAL DE MILITARES / USUÁRIOS
CREATE TABLE IF NOT EXISTS fmb_users (
  id TEXT PRIMARY KEY,
  username TEXT,
  "habboNick" TEXT,
  "habboAvatar" TEXT,
  "habboMotto" TEXT,
  "habboCreated" TEXT,
  role TEXT,
  status TEXT,
  "activeState" TEXT,
  "joinedAt" TEXT,
  "totalServiceSeconds" BIGINT,
  medals TEXT[],
  "trainingsCreated" INT,
  "promotionsGiven" INT
);

-- 3. TABELA INDIVIDUAL DE SENHAS DE ACESSO MILITAR
CREATE TABLE IF NOT EXISTS fmb_passwords (
  id TEXT PRIMARY KEY,
  "passwordHash" TEXT NOT NULL
);

-- 4. TABELA INDIVIDUAL DE HISTÓRICO DE PROMOÇÕES
CREATE TABLE IF NOT EXISTS fmb_promotions (
  id TEXT PRIMARY KEY,
  "promotedMilitarId" TEXT,
  "promotedMilitarName" TEXT,
  "promoterId" TEXT,
  "promoterName" TEXT,
  "oldRank" TEXT,
  "newRank" TEXT,
  reason TEXT,
  date TEXT,
  time TEXT
);

-- 5. TABELA INDIVIDUAL DE ATAS DE TREINAMENTO REALIZADAS
CREATE TABLE IF NOT EXISTS fmb_trainings (
  id TEXT PRIMARY KEY,
  name TEXT,
  "instructorId" TEXT,
  "instructorName" TEXT,
  participants TEXT[],
  category TEXT,
  description TEXT,
  date TEXT,
  time TEXT,
  status TEXT
);

-- 6. TABELA INDIVIDUAL DE CONTROLE DE PONTO ELETRÔNICO (SENTINELA)
CREATE TABLE IF NOT EXISTS fmb_pontes (
  id TEXT PRIMARY KEY,
  "userId" TEXT,
  "userNick" TEXT,
  date TEXT,
  "checkInTime" TEXT,
  "checkOutTime" TEXT,
  "durationSeconds" INT
);

-- 7. TABELA INDIVIDUAL DE MISSÕES OPERACIONAIS
CREATE TABLE IF NOT EXISTS fmb_missions (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  "rewardMedals" TEXT[],
  "rewardPoints" INT,
  "rewardDestaque" BOOLEAN,
  active BOOLEAN,
  "targetCategory" TEXT,
  "targetCount" INT
);

-- 8. TABELA INDIVIDUAL DE PROGRESSO DAS MISSÕES
CREATE TABLE IF NOT EXISTS fmb_mission_progress (
  id TEXT PRIMARY KEY,
  "missionId" TEXT,
  "userId" TEXT,
  "currentCount" INT,
  completed BOOLEAN,
  "completedAt" TEXT
);

-- 9. TABELA INDIVIDUAL DE RECRUTAS E AULAS POSTADAS
CREATE TABLE IF NOT EXISTS fmb_recruit_lessons (
  id TEXT PRIMARY KEY,
  "instructorId" TEXT,
  "instructorName" TEXT,
  "studentNick" TEXT,
  category TEXT,
  status TEXT,
  notes TEXT,
  "screenshotUrl" TEXT,
  "createdAt" TEXT
);

-- 10. TABELA INDIVIDUAL DE DOCUMENTOS E MANUAIS DO QG
CREATE TABLE IF NOT EXISTS fmb_documents (
  id TEXT PRIMARY KEY,
  title TEXT,
  category TEXT,
  content TEXT,
  "attachmentUrl" TEXT,
  "authorNick" TEXT,
  "createdAt" TEXT
);

-- 11. TABELA INDIVIDUAL DE PATENTES E PERMISSÕES MILITARES
CREATE TABLE IF NOT EXISTS fmb_rank_configs (
  rank TEXT PRIMARY KEY,
  label TEXT,
  description TEXT,
  permissions jsonb
);

-- 12. TABELA INDIVIDUAL DE LOGS E AUDITORIAS DO SISTEMA
CREATE TABLE IF NOT EXISTS fmb_logs (
  id TEXT PRIMARY KEY,
  "userId" TEXT,
  "userNick" TEXT,
  action TEXT,
  details TEXT,
  timestamp TEXT
);

-- 13. HABILITAR SEGURANÇA (RLS) PARA TODAS AS TABELAS
ALTER TABLE fmb_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE fmb_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE fmb_passwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE fmb_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fmb_trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE fmb_pontes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fmb_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fmb_mission_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE fmb_recruit_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE fmb_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE fmb_rank_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fmb_logs ENABLE ROW LEVEL SECURITY;

-- 14. EXCLUIR POLÍTICAS ANTIGAS SE EXISTIREM EM LOOP PARA CADA TABELA
DROP POLICY IF EXISTS "Acesso Total" ON fmb_state;
DROP POLICY IF EXISTS "Acesso Total" ON fmb_users;
DROP POLICY IF EXISTS "Acesso Total" ON fmb_passwords;
DROP POLICY IF EXISTS "Acesso Total" ON fmb_promotions;
DROP POLICY IF EXISTS "Acesso Total" ON fmb_trainings;
DROP POLICY IF EXISTS "Acesso Total" ON fmb_pontes;
DROP POLICY IF EXISTS "Acesso Total" ON fmb_missions;
DROP POLICY IF EXISTS "Acesso Total" ON fmb_mission_progress;
DROP POLICY IF EXISTS "Acesso Total" ON fmb_recruit_lessons;
DROP POLICY IF EXISTS "Acesso Total" ON fmb_documents;
DROP POLICY IF EXISTS "Acesso Total" ON fmb_rank_configs;
DROP POLICY IF EXISTS "Acesso Total" ON fmb_logs;

-- 15. CRIAR POLÍTICAS INDEPENDENTES DE ACESSO E CONEXÃO IRRESTRITA PARA O PAINEL
CREATE POLICY "Acesso Total" ON fmb_state FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso Total" ON fmb_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso Total" ON fmb_passwords FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso Total" ON fmb_promotions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso Total" ON fmb_trainings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso Total" ON fmb_pontes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso Total" ON fmb_missions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso Total" ON fmb_mission_progress FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso Total" ON fmb_recruit_lessons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso Total" ON fmb_documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso Total" ON fmb_rank_configs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso Total" ON fmb_logs FOR ALL USING (true) WITH CHECK (true);`}
              </div>

              <div className="flex flex-col gap-1 text-[10px] text-gray-400 bg-fmb-black/40 border border-fmb-army/20 p-2.5 rounded">
                <p className="font-bold text-fmb-gold uppercase">Siga estas etapas no Supabase:</p>
                <ol className="list-decimal pl-4 space-y-1 mt-1 text-[9px] leading-relaxed">
                  <li>Acessee o seu painel do <strong>Supabase</strong> e entre no projeto correspondente.</li>
                  <li>Clique no botão <strong>"SQL Editor"</strong> (ou "SQL Query") na barra lateral esquerda.</li>
                  <li>Clique em <strong>"New query"</strong> para abrir uma aba em branco.</li>
                  <li>Cole todo o código acima e clique no botão verde <strong>"Run"</strong> no canto inferior direito.</li>
                  <li>Clique em <strong>"Verificar Conexão"</strong> acima para sincronizar imediatamente.</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CENTRO DE SEGURANÇA: BACKUP E RESTAURAÇÃO INTEGRAL */}
      <div className="bg-fmb-black/95 border border-fmb-army/30 rounded-lg p-5 text-left font-mono text-xs space-y-4 shadow-lg animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-fmb-army/20 pb-3 gap-2">
          <div className="flex items-center space-x-3">
            <div className="bg-amber-500/10 p-2 border border-amber-500/30 rounded text-amber-500">
              <FileJson className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-white uppercase font-bold text-sm tracking-tight">Célula de Segurança: Backup & Restauração</h4>
              <span className="text-[10px] text-gray-400 block mt-0.5">Gestão tática e salvaguarda integral de dados militares da FMB</span>
            </div>
          </div>
          <span className="text-[9px] px-2 py-0.5 bg-amber-950/40 border border-amber-500/35 text-amber-400 font-bold rounded uppercase">
            Manual Redundância Ativa
          </span>
        </div>

        <p className="text-[11px] text-gray-400 leading-relaxed">
          Exporte ou importe a base militar inteira em formato JSON contendo todos os cadastros, patentes editadas, atas, logs detalhados e relatórios de recrutas. Use o arquivo para backups locais ou para migração entre servidores e instâncias de redundância.
        </p>

        {/* FEEDBACK LABELS */}
        {backupSuccess && (
          <div className="p-3 bg-green-950/20 border border-green-500/30 text-green-300 rounded leading-relaxed text-[11px] flex justify-between items-center gap-2">
            <div><strong>✓ SUCESSO:</strong> {backupSuccess}</div>
            <button 
              onClick={() => setBackupSuccess(null)} 
              className="text-[9.5px] font-bold text-white uppercase bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded transition-all cursor-pointer"
            >
              OK
            </button>
          </div>
        )}

        {backupError && (
          <div className="p-3 bg-red-950/20 border border-red-500/30 text-red-300 rounded leading-relaxed text-[11px] flex justify-between items-center gap-2">
            <div><strong>⚠ REJEITADO:</strong> {backupError}</div>
            <button 
              onClick={() => setBackupError(null)} 
              className="text-[9.5px] font-bold text-white uppercase bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded transition-all cursor-pointer"
            >
              Fechar
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
          {/* SECÇÃO EXPORTAR */}
          <div className="p-4 bg-fmb-slate/40 border border-fmb-army/20 rounded-lg flex flex-col justify-between space-y-4">
            <div className="space-y-1.5">
              <h5 className="font-bold text-[11px] text-fmb-gold uppercase flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" />
                Exportar Estado Militar (Baixar Backup)
              </h5>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                Descarrega o banco de dados militar idêntico ao estado ativo em tempo real no servidor. Útil para guardar cópias regulares e auditáveis.
              </p>
            </div>

            <button
              onClick={handleDownloadBackup}
              disabled={backupLoading}
              className={`w-full py-2.5 rounded text-[10px] uppercase font-bold tracking-wider transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                backupLoading 
                  ? "bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed" 
                  : "bg-fmb-army hover:bg-fmb-olive border border-fmb-gold/40 hover:border-fmb-gold text-white shadow"
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{backupLoading ? "Gerando JSON..." : "Baixar Backup Integral (.JSON)"}</span>
            </button>
          </div>

          {/* SECÇÃO IMPORTAR */}
          <div className="p-4 bg-fmb-slate/40 border border-fmb-army/20 rounded-lg flex flex-col justify-between space-y-4">
            <div className="space-y-1.5">
              <h5 className="font-bold text-[11px] text-amber-500 uppercase flex items-center gap-1.5">
                <UploadCloud className="w-3.5 h-3.5" />
                Restaurar Estado Militar (Enviar Backup)
              </h5>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                Selecione um arquivo de backup <code className="text-gray-300 font-bold">.json</code> baixado anteriormente para sobregravar absolutamente todo o banco local e no Supabase Cloud.
              </p>
            </div>

            <div className="space-y-3">
              {/* FILE PICKER INPUT ZONE */}
              <div className="relative border border-dashed border-fmb-army/45 rounded p-3 bg-fmb-black/30 text-center hover:border-amber-500/55 transition-all">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleBackupFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center space-y-1 text-gray-400">
                  <UploadCloud className="w-5 h-5 text-fmb-gold" />
                  <span className="text-[10px] uppercase font-bold text-gray-300">
                    {backupFileName ? backupFileName : "Escolher arquivo de backup"}
                  </span>
                  <span className="text-[8px] text-gray-500">Apenas arquivos no formato JSON (.JSON)</span>
                </div>
              </div>

              {/* STATS PREVIEW BOX */}
              {selectedBackupJson && (
                <div className="p-3 bg-amber-950/20 border border-amber-500/25 rounded space-y-1.5">
                  <div className="text-[9px] uppercase font-bold text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
                    Validação do Backup Concluída:
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] font-mono text-gray-400">
                    <div>• Militares na base: <strong className="text-white">{selectedBackupJson.users?.length || 0}</strong></div>
                    <div>• Senhas salvas: <strong className="text-white">{Object.keys(selectedBackupJson.passwords || {}).length || 0}</strong></div>
                    <div>• Patentes ativas: <strong className="text-white">{selectedBackupJson.rankConfigs?.length || 0}</strong></div>
                    <div>• Atas de treino: <strong className="text-white">{selectedBackupJson.trainings?.length || 0}</strong></div>
                    <div>• Presenças ponto: <strong className="text-white">{selectedBackupJson.pontes?.length || 0}</strong></div>
                    <div>• Logs auditáveis: <strong className="text-white">{selectedBackupJson.logs?.length || 0}</strong></div>
                  </div>
                  <button
                    onClick={handleConfirmRestoreBackup}
                    disabled={backupLoading}
                    className={`w-full mt-2 py-2 rounded text-[10px] uppercase font-bold tracking-wider transition-all flex items-center justify-center space-x-1.5 cursor-pointer bg-red-700 hover:bg-red-800 text-white border border-red-500/40`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{backupLoading ? "Sincronizando..." : "Confirmar Restauração Total"}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO: CONTROLE DE ACESSO DE ABAS EXCLUSIVAS */}
      <div className="bg-fmb-slate/40 border border-fmb-army/30 rounded-lg p-5 text-left space-y-4 shadow-xl backdrop-blur-sm mt-6">
        <div className="border-b border-fmb-army/20 pb-2.5 flex items-center justify-between">
          <div>
            <h4 className="font-sans font-bold uppercase text-xs text-fmb-gold tracking-wider flex items-center space-x-1.5">
              <Sliders className="w-4 h-4 text-fmb-gold" />
              <span>Controle de Acesso de Abas (Instrutores, AMAN & CDM)</span>
            </h4>
            <p className="text-[10px] text-gray-400 mt-0.5">Selecione quais patentes e sub-cargos de militares cadastrados têm outorga e permissão para visualizar e acessar cada aba do QG.</p>
          </div>
        </div>

        {tabPermSuccess && (
          <div className="p-3 bg-green-950/20 border border-green-500/30 rounded text-[11px] text-green-300 font-mono">
            {tabPermSuccess}
          </div>
        )}
        {tabPermError && (
          <div className="p-3 bg-red-950/20 border border-red-500/30 rounded text-[11px] text-red-300 font-mono">
            {tabPermError}
          </div>
        )}

        <form onSubmit={handleSaveTabPermissions} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* 1. ABA INSTRUTORES */}
            <div className="border border-fmb-army/15 bg-fmb-black/35 rounded-lg p-4 space-y-3 flex flex-col">
              <div className="border-b border-fmb-army/10 pb-1.5 shrink-0">
                <span className="text-[11px] font-bold text-white uppercase block">1. Aba Instrutores</span>
                <span className="text-[9px] text-gray-500 block">Selecione os cargos para visualizar a aba Instrutores. Deixe vazio para usar a permissão padrão.</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 max-h-[220px] pr-1 scrollbar-thin">
                <div>
                  <span className="text-[9px] text-fmb-gold uppercase block font-semibold mb-1">Patentes Autorizadas</span>
                  <div className="space-y-1 bg-fmb-black/20 p-2 rounded max-h-[100px] overflow-y-auto scrollbar-thin border border-fmb-army/5">
                    {hierarchyList.map(rc => {
                      const isChecked = instrutoresAllowed.includes(rc.rank);
                      return (
                        <label key={rc.rank} className="flex items-center space-x-2 text-[10px] text-gray-300 cursor-pointer hover:text-white select-none">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setInstrutoresAllowed(instrutoresAllowed.filter(x => x !== rc.rank));
                              } else {
                                setInstrutoresAllowed([...instrutoresAllowed, rc.rank]);
                              }
                            }}
                            className="rounded border-fmb-army/30 text-fmb-gold focus:ring-fmb-gold bg-fmb-slate"
                          />
                          <span>{rc.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="text-[9px] text-fmb-gold uppercase block font-semibold mb-1">Sub-Cargos Autorizados</span>
                  <div className="space-y-1 bg-fmb-black/20 p-2 rounded max-h-[100px] overflow-y-auto scrollbar-thin border border-fmb-army/5">
                    {subCargosList.map(sc => {
                      const isChecked = instrutoresAllowed.includes(sc.id);
                      return (
                        <label key={sc.id} className="flex items-center space-x-2 text-[10px] text-gray-300 cursor-pointer hover:text-white select-none">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setInstrutoresAllowed(instrutoresAllowed.filter(x => x !== sc.id));
                              } else {
                                setInstrutoresAllowed([...instrutoresAllowed, sc.id]);
                              }
                            }}
                            className="rounded border-fmb-army/30 text-fmb-gold focus:ring-fmb-gold bg-fmb-slate"
                          />
                          <span>{sc.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. ABA AMAN */}
            <div className="border border-fmb-army/15 bg-fmb-black/35 rounded-lg p-4 space-y-3 flex flex-col">
              <div className="border-b border-fmb-army/10 pb-1.5 shrink-0">
                <span className="text-[11px] font-bold text-white uppercase block">2. Aba AMAN</span>
                <span className="text-[9px] text-gray-500 block">Selecione os cargos para visualizar a aba AMAN. Deixe vazio para usar a permissão padrão.</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 max-h-[220px] pr-1 scrollbar-thin">
                <div>
                  <span className="text-[9px] text-fmb-gold uppercase block font-semibold mb-1">Patentes Autorizadas</span>
                  <div className="space-y-1 bg-fmb-black/20 p-2 rounded max-h-[100px] overflow-y-auto scrollbar-thin border border-fmb-army/5">
                    {hierarchyList.map(rc => {
                      const isChecked = amanAllowed.includes(rc.rank);
                      return (
                        <label key={rc.rank} className="flex items-center space-x-2 text-[10px] text-gray-300 cursor-pointer hover:text-white select-none">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setAmanAllowed(amanAllowed.filter(x => x !== rc.rank));
                              } else {
                                setAmanAllowed([...amanAllowed, rc.rank]);
                              }
                            }}
                            className="rounded border-fmb-army/30 text-fmb-gold focus:ring-fmb-gold bg-fmb-slate"
                          />
                          <span>{rc.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="text-[9px] text-fmb-gold uppercase block font-semibold mb-1">Sub-Cargos Autorizados</span>
                  <div className="space-y-1 bg-fmb-black/20 p-2 rounded max-h-[100px] overflow-y-auto scrollbar-thin border border-fmb-army/5">
                    {subCargosList.map(sc => {
                      const isChecked = amanAllowed.includes(sc.id);
                      return (
                        <label key={sc.id} className="flex items-center space-x-2 text-[10px] text-gray-300 cursor-pointer hover:text-white select-none">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setAmanAllowed(amanAllowed.filter(x => x !== sc.id));
                              } else {
                                setAmanAllowed([...amanAllowed, sc.id]);
                              }
                            }}
                            className="rounded border-fmb-army/30 text-fmb-gold focus:ring-fmb-gold bg-fmb-slate"
                          />
                          <span>{sc.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. ABA CDM / DISPATCHER */}
            <div className="border border-fmb-army/15 bg-fmb-black/35 rounded-lg p-4 space-y-3 flex flex-col">
              <div className="border-b border-fmb-army/10 pb-1.5 shrink-0">
                <span className="text-[11px] font-bold text-white uppercase block">3. Aba CDM</span>
                <span className="text-[9px] text-gray-500 block">Selecione os cargos para visualizar o painel CDM. Deixe vazio para usar a permissão padrão.</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 max-h-[220px] pr-1 scrollbar-thin">
                <div>
                  <span className="text-[9px] text-fmb-gold uppercase block font-semibold mb-1">Patentes Autorizadas</span>
                  <div className="space-y-1 bg-fmb-black/20 p-2 rounded max-h-[100px] overflow-y-auto scrollbar-thin border border-fmb-army/5">
                    {hierarchyList.map(rc => {
                      const isChecked = cdmAllowed.includes(rc.rank);
                      return (
                        <label key={rc.rank} className="flex items-center space-x-2 text-[10px] text-gray-300 cursor-pointer hover:text-white select-none">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setCdmAllowed(cdmAllowed.filter(x => x !== rc.rank));
                              } else {
                                setCdmAllowed([...cdmAllowed, rc.rank]);
                              }
                            }}
                            className="rounded border-fmb-army/30 text-fmb-gold focus:ring-fmb-gold bg-fmb-slate"
                          />
                          <span>{rc.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="text-[9px] text-fmb-gold uppercase block font-semibold mb-1">Sub-Cargos Autorizados</span>
                  <div className="space-y-1 bg-fmb-black/20 p-2 rounded max-h-[100px] overflow-y-auto scrollbar-thin border border-fmb-army/5">
                    {subCargosList.map(sc => {
                      const isChecked = cdmAllowed.includes(sc.id);
                      return (
                        <label key={sc.id} className="flex items-center space-x-2 text-[10px] text-gray-300 cursor-pointer hover:text-white select-none">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setCdmAllowed(cdmAllowed.filter(x => x !== sc.id));
                              } else {
                                setCdmAllowed([...cdmAllowed, sc.id]);
                              }
                            }}
                            className="rounded border-fmb-army/30 text-fmb-gold focus:ring-fmb-gold bg-fmb-slate"
                          />
                          <span>{sc.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

          </div>

          <div className="flex justify-end pt-2 border-t border-fmb-army/15 shrink-0">
            <button
              type="submit"
              disabled={savingTabPerms}
              className="bg-fmb-army border border-fmb-gold/40 hover:bg-fmb-olive text-white font-mono text-[10px] uppercase font-bold py-2 px-6 rounded transition-colors cursor-pointer flex items-center space-x-1.5 shadow-md"
            >
              <Sliders className="w-3.5 h-3.5 text-fmb-gold" />
              <span>{savingTabPerms ? "Salvando..." : "Salvar Permissões de Abas"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* MONOCHROME COMPILER AUDITING LOGS */}
      <div className="bg-fmb-black border border-fmb-army/30 rounded-lg p-5 font-mono text-[10px] text-left relative flex flex-col h-[320px] shadow-lg animate-fade-in mt-6">
        <div className="flex items-center justify-between border-b border-fmb-army/20 pb-2 mb-2 text-gray-500 font-bold shrink-0 text-xs">
          <span className="flex items-center">
            <Terminal className="w-4 h-4 mr-1.5 text-fmb-gold animate-pulse" />
            <span className="text-white uppercase font-bold tracking-wider font-display">Integridade dos Logs de Auditoria de Sistema</span>
          </span>
          <button onClick={fetchAuditLogs} className="hover:text-white cursor-pointer" title="Atualizar Logs">
            <RefreshCw className={`w-4 h-4 ${loadingLogs ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 h-full scrollbar-thin">
          {loadingLogs ? (
            <div className="text-gray-500 py-6 text-center italic">Descodificando canais operacionais...</div>
          ) : logs.length === 0 ? (
            <div className="text-gray-500 py-6 text-center italic">Nenhum evento registrado.</div>
          ) : (
            logs.map(lg => {
              let alertText = "text-gray-400";
              if (lg.action.includes("BAN") || lg.action.includes("ESTAURA") || lg.action.includes("SUSPEN")) alertText = "text-red-400 font-bold";
              if (lg.action.includes("PROM")) alertText = "text-green-400 font-bold";
              if (lg.action.includes("SERVIC")) alertText = "text-amber-400";

              return (
                <div key={lg.id} className="border-b border-fmb-slate/30 pb-2 last:border-0 text-[10px]">
                  <div className="flex items-center justify-between text-gray-600 font-bold text-[8.5px] mb-1">
                    <span>{new Date(lg.timestamp).toLocaleString("pt-BR")}</span>
                    <span className={alertText}>{lg.action}</span>
                  </div>
                  <p className="text-gray-300 leading-normal">
                    <strong className="text-fmb-gold">@{lg.userNick}:</strong> {lg.details}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
      </>)}

      {adminTab === "membros" && (
        <>
          {/* PAINEL FLUTUANTE DE PESQUISA DE INTEGRANTES */}
          <div className="bg-fmb-black/95 border border-fmb-army/30 p-4 rounded-lg font-mono text-xs text-left relative flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg animate-fade-in">
        <div className="flex items-center space-x-3">
          <div className="bg-fmb-army/20 p-1.5 border border-fmb-gold/30 rounded">
            <Users className="w-4 h-4 text-fmb-gold" />
          </div>
          <div>
            <h4 className="text-white uppercase text-[11px] font-bold tracking-wider">Filtro Rápido de Integrantes</h4>
            <span className="text-[9px] text-gray-500 block leading-tight">Filtre nicks de militares para redefinir senhas, sanções ou destaques do Hall</span>
          </div>
        </div>
        <div className="relative w-full md:w-80">
          <span className="absolute left-3 top-2.5 text-fmb-gold font-bold">@</span>
          <input
            type="text"
            placeholder="Pesquisar por nick ou patente militar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-fmb-slate border border-fmb-army/45 focus:border-fmb-gold rounded py-2 pl-7 pr-8 text-white font-mono text-[11px] outline-none transition-all placeholder:text-gray-600 shadow-inner"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-white font-bold text-sm cursor-pointer transition-colors"
              title="Limpar pesquisa"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* ACTION COLUMN 1: PASSWORD RESET, PENDING ENLISTMENTS & HALL CONFIG */}
        <div className="space-y-6">
          
          {/* ALISTAMENTO (PEDIDOS PENDENTES) CARD */}
          <div className="bg-fmb-black/95 border border-fmb-army/20 p-5 rounded-lg font-mono text-xs text-left relative">
            <Users className="absolute top-4 right-4 w-5 h-5 text-fmb-gold opacity-30" />
            <h4 className="text-white uppercase text-xs font-bold font-display border-b border-fmb-army/10 pb-2 mb-4 flex items-center space-x-1.5">
              <span>Aprovar Alistamentos de Recrutas</span>
              <span className="text-[9px] bg-fmb-gold/10 text-fmb-gold border border-fmb-gold/30 px-1.5 py-0.5 rounded font-mono ml-2 lowercase">
                {pendingEnlistments.length} fila de espera
              </span>
            </h4>

            {enlistSuccess && (
              <div className="mb-3 p-2 bg-green-950/20 border border-green-500/30 text-green-300 rounded text-[10px]">
                {enlistSuccess}
              </div>
            )}
            {enlistError && (
              <div className="mb-3 p-2 bg-red-950/20 border border-red-500/30 text-red-300 rounded text-[10px]">
                {enlistError}
              </div>
            )}

            <div className="space-y-3 font-mono text-xs max-h-[300px] overflow-y-auto pr-1">
              {pendingEnlistments.length === 0 ? (
                <div className="text-center py-6 text-gray-500 italic text-[11px]">
                  Nenhum pedido de alistamento no limbo militar.
                </div>
              ) : (
                pendingEnlistments.map((req) => (
                  <div key={req.id} className="p-3 bg-fmb-slate/40 border border-fmb-army/25 rounded flex items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-white text-[11.5px]">@{req.habboNick}</p>
                      <p className="text-[8px] text-gray-400 mt-1 uppercase">Solicitado em: {new Date(req.createdAt).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <div className="flex items-center space-x-1.5 shrink-0">
                      <button
                        onClick={() => handleApproveEnlistment(req.id, req.habboNick)}
                        disabled={enlisting}
                        className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-bold px-2.5 py-1 rounded text-[10px] uppercase transition-colors pointer-events-auto cursor-pointer"
                        title="Aproveitar com Farda de Recruta"
                      >
                        Aprovar
                      </button>
                      <button
                        onClick={() => handleRejectEnlistment(req.id, req.habboNick)}
                        disabled={enlisting}
                        className="bg-red-900 hover:bg-red-850 disabled:opacity-50 text-white font-bold px-2.5 py-1 rounded text-[10px] uppercase transition-colors pointer-events-auto cursor-pointer"
                        title="Recusar registro definitivamente"
                      >
                        Recusar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ALTERAR CARGO DIRETAMENTE (ADMINISTRAÇÃO GERAL) */}
          <div className="bg-fmb-black/95 border border-fmb-army/20 p-5 rounded-lg font-mono text-xs text-left relative">
            <Shield className="absolute top-4 right-4 w-5 h-5 text-fmb-gold opacity-30" />
            <h4 className="text-white uppercase text-xs font-bold font-display border-b border-fmb-army/10 pb-2 mb-4">
              Mudar Cargo do Usuário Diretamente
            </h4>

            {directRoleSuccess && <div className="mb-3 p-2 bg-green-950/20 border border-green-500/30 text-green-300 rounded text-[10px]">{directRoleSuccess}</div>}
            {directRoleError && <div className="mb-3 p-2 bg-red-950/20 border border-red-500/30 text-red-300 rounded text-[10px]">{directRoleError}</div>}

            <form onSubmit={handleDirectRoleUpdate} className="space-y-3">
              <div>
                <label className="text-[9px] text-fmb-gold uppercase block mb-1">Nick do Militar</label>
                <input
                  type="text"
                  placeholder="Ex: NickMilitar"
                  value={directRoleTargetNick}
                  onChange={(e) => setDirectRoleTargetNick(e.target.value)}
                  className="w-full bg-fmb-black border border-fmb-army/30 rounded px-2.5 py-1.5 text-white text-[11px] focus:outline-none focus:border-fmb-gold font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-[9px] text-fmb-gold uppercase block mb-1">Selecione a Nova Patente / Cargo</label>
                <select
                  value={directRoleNewRank}
                  onChange={(e) => setDirectRoleNewRank(e.target.value)}
                  className="w-full bg-fmb-black border border-fmb-army/30 rounded px-2.5 py-1.5 text-white text-[11px] focus:outline-none focus:border-fmb-gold cursor-pointer"
                >
                  <option value="">Selecione...</option>
                  {hierarchyList.map(h => (
                    <option key={h.rank} value={h.rank}>
                      {h.label} ({h.rank})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={directRoleUpdating || !directRoleTargetNick || !directRoleNewRank}
                className="w-full bg-fmb-army hover:bg-fmb-gold disabled:opacity-40 text-black font-bold uppercase py-2 px-3 rounded text-[10px] tracking-wider transition-all cursor-pointer"
              >
                {directRoleUpdating ? "Alterando..." : "Alterar Cargo Diretamente"}
              </button>
            </form>
          </div>

          {/* RESET CREDENTIALS PANEL */}
          <div className="bg-fmb-black/95 border border-fmb-army/20 p-5 rounded-lg font-mono text-xs text-left relative">
            <KeyRound className="absolute top-4 right-4 w-5 h-5 text-fmb-gold opacity-30" />
            <h4 className="text-white uppercase text-xs font-bold font-display border-b border-fmb-army/10 pb-2 mb-4">
              Restaurar Senha Militar
            </h4>

            {passSuccess && <div className="mb-3 p-2 bg-green-950/20 border border-green-500/30 text-green-300 rounded text-[10px]">{passSuccess}</div>}
            {passError && <div className="mb-3 p-2 bg-red-950/20 border border-red-500/30 text-red-300 rounded text-[10px]">{passError}</div>}

            <form onSubmit={handlePasswordReset} className="space-y-3">
              <div>
                <label className="text-[9px] text-fmb-gold uppercase block mb-1">Nick do Militar</label>
                <input 
                  type="text"
                  placeholder="Ex: NickMilitar"
                  value={selectedMilitarNick}
                  onChange={(e) => setSelectedMilitarNick(e.target.value)}
                  className="w-full bg-fmb-slate border border-fmb-army/30 rounded py-1 px-2 text-white outline-none font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-[9px] text-fmb-gold uppercase block mb-1">Nova Senha Provisória</label>
                <input 
                  type="password"
                  placeholder="NovaSenhaFMB1"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  className="w-full bg-fmb-slate border border-fmb-army/30 rounded py-1 px-2 text-white outline-none"
                  required
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-fmb-army hover:bg-fmb-olive border border-fmb-gold/40 text-white font-bold py-1.5 rounded uppercase tracking-wider text-[10px]"
              >
                Atualizar Senha
              </button>
            </form>
          </div>

          {/* HALL OF FAME HEROES CONFIGURATION */}
          <div className="bg-fmb-black/95 border border-fmb-army/20 p-5 rounded-lg font-mono text-xs text-left relative">
            <Star className="absolute top-4 right-4 w-5 h-5 text-fmb-gold opacity-30" />
            <h4 className="text-white uppercase text-xs font-bold font-display border-b border-fmb-army/10 pb-2 mb-4">
              Configurar Quadro do Hall da Fama
            </h4>

            {hallSuccess && <div className="mb-3 p-2 bg-green-950/20 border border-green-500/30 text-green-300 rounded text-[10px]">{hallSuccess}</div>}

            <div className="space-y-3">
              <div>
                <label className="text-[9px] text-fmb-gold uppercase block mb-1">🏆 Nick do Militar do Mês</label>
                <input 
                  type="text"
                  placeholder="Ex: NickMilitar"
                  value={hallMilitarNick}
                  onChange={(e) => setHallMilitarNick(e.target.value)}
                  className="w-full bg-fmb-slate border border-fmb-army/30 rounded py-1.5 px-2 text-white outline-none font-mono"
                />
                <span className="text-[8px] text-gray-500 mt-0.5 block">Automático: Concede medalha de Militar do Mês.</span>
              </div>

              <div>
                <label className="text-[9px] text-fmb-gold uppercase block mb-1">🎓 Nick do Instrutor de Elite do Mês</label>
                <input 
                  type="text"
                  placeholder="Ex: NickMilitar"
                  value={hallInstructorNick}
                  onChange={(e) => setHallInstructorNick(e.target.value)}
                  className="w-full bg-fmb-slate border border-fmb-army/30 rounded py-1.5 px-2 text-white outline-none font-mono"
                />
                <span className="text-[8px] text-gray-500 mt-0.5 block">Automático: Concede medalha de Instrutor do Mês.</span>
              </div>

              <div>
                <label className="text-[9px] text-fmb-gold uppercase block mb-1">⚡ Nick do Destaque Operacional</label>
                <input 
                  type="text"
                  placeholder="Ex: NickMilitar"
                  value={hallDestaqueNick}
                  onChange={(e) => setHallDestaqueNick(e.target.value)}
                  className="w-full bg-fmb-slate border border-fmb-army/30 rounded py-1.5 px-2 text-white outline-none font-mono"
                />
                <span className="text-[8px] text-gray-500 mt-0.5 block">Automático: Concede medalha de Crachá de Bravura.</span>
              </div>

              <button 
                onClick={handleDestaquesSave}
                className="w-full bg-fmb-army hover:bg-fmb-olive border border-fmb-gold/45 text-white font-bold py-2 rounded uppercase tracking-wider text-[10px]"
              >
                Gravar Quadro Tático
              </button>
            </div>
          </div>

        </div>

        {/* ACTION COLUMN 2: SECURITY & AUDITING TERMS */}
        <div className="space-y-6">
          
          {/* USER MANAGEMENT (BAN/SUSPEND/PURGE) */}
          <div className="bg-fmb-black/95 border border-fmb-army/20 p-5 rounded-lg font-mono text-xs text-left relative">
            <ShieldAlert className="absolute top-4 right-4 w-5 h-5 text-red-500 opacity-35" />
            <h4 className="text-white uppercase text-xs font-bold font-display border-b border-fmb-army/10 pb-2 mb-4">
              Célula de Sanções & Punições Militars
            </h4>

            {actionSuccess && <div className="mb-3 p-2 bg-green-950/20 border border-green-500/30 text-green-300 rounded text-[10px]">{actionSuccess}</div>}
            {actionError && <div className="mb-3 p-2 bg-red-950/20 border border-red-500/30 text-red-300 rounded text-[10px]">{actionError}</div>}

            <div className="space-y-3">
              <div>
                <label className="text-[9px] text-fmb-gold uppercase block mb-1">Nick do Militar Alvo</label>
                <input 
                  type="text"
                  placeholder="Ex: NickMilitar"
                  value={actionTargetNick}
                  onChange={(e) => setActionTargetNick(e.target.value)}
                  className="w-full bg-fmb-slate border border-fmb-army/30 rounded py-1.5 px-2 text-white outline-none font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-[9px] text-fmb-gold uppercase block mb-1">Justificativa da Punição (Bans/Suspensão)</label>
                <textarea 
                  placeholder="Insira as ordens ou termos infringidos de nossa disciplina..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  rows={2}
                  className="w-full bg-fmb-slate border border-fmb-army/30 rounded py-1.5 px-2 text-white outline-none resize-none"
                />
              </div>

              {/* Sanction row button controllers */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button 
                  onClick={handleSuspendSubmit}
                  className="bg-amber-900/60 hover:bg-amber-800 text-white font-bold py-1.5 rounded uppercase tracking-wider text-[9px] border border-amber-600/30"
                >
                  Suspender
                </button>
                <button 
                  onClick={handleBanSubmit}
                  className="bg-red-900/60 hover:bg-red-800 text-white font-bold py-1.5 rounded uppercase tracking-wider text-[9px] border border-red-600/30"
                >
                  Banir Conta
                </button>
                <button 
                  onClick={handleReactivateSubmit}
                  className="bg-fmb-army hover:bg-fmb-olive text-white font-bold py-1.5 rounded uppercase tracking-wider text-[9px] border border-fmb-gold/20"
                >
                  Reativar
                </button>
                <button 
                  onClick={handleDeleteSubmit}
                  className="bg-red-950 hover:bg-red-900 text-red-200 font-bold py-1.5 rounded uppercase tracking-wider text-[9px] border border-red-800/40"
                >
                  Purgar B.D
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
      </>)}

      {adminTab === "categorias" && (
        <div className="bg-fmb-black/95 border border-fmb-army/30 rounded-lg p-6 font-mono text-xs text-left relative shadow-lg animate-fade-in">
          <BookOpen className="absolute top-5 right-6 w-5 h-5 text-fmb-gold opacity-30" />
          <h4 className="text-white uppercase font-bold font-display border-b border-fmb-army/25 pb-3 mb-4 flex items-center gap-2 text-sm tracking-tight">
            <BookOpen className="w-5 h-5 text-fmb-gold" />
            <span>Gerenciamento de Categorias do Sistema</span>
          </h4>
          <p className="text-gray-400 text-[11px] mb-4 leading-relaxed">
            Customize as categorias operacionais de Instruções (Treinamentos) e Documentações (Manuais). Categorias táticas organizam os relatórios e exigem patentes mínimas para controle de instrutores.
          </p>

          {categorySuccess && (
            <div className="mb-4 p-3 bg-green-950/20 border border-green-500/35 text-green-300 rounded text-[10px] uppercase font-bold">
              {categorySuccess}
            </div>
          )}

          {/* Grid de 2 colunas: Lista à esquerda, Formulário à direita */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* COLUNA 1: LISTA DE CATEGORIAS */}
            <div className="space-y-4">
              {/* Tab navigation */}
              <div className="flex border-b border-fmb-army/15 mb-3">
                <button 
                  onClick={() => { setCategoryTab("instrucoes"); setEditingCategory(null); setNewCategoryName(""); }}
                  className={`py-1.5 px-3 uppercase text-[9px] font-bold tracking-wider cursor-pointer border-t border-x rounded-t -mb-[1px] transition-all ${
                    categoryTab === "instrucoes" 
                      ? "bg-fmb-army/20 border-fmb-army/20 text-white font-black" 
                      : "border-transparent text-gray-500 hover:text-gray-300"
                  }`}
                >
                  Instruções/Treinos
                </button>
                <button 
                  onClick={() => { setCategoryTab("documentos"); setEditingCategory(null); setNewCategoryName(""); }}
                  className={`py-1.5 px-3 uppercase text-[9px] font-bold tracking-wider cursor-pointer border-t border-x rounded-t -mb-[1px] transition-all ${
                    categoryTab === "documentos" 
                      ? "bg-fmb-army/20 border-fmb-army/20 text-white font-black" 
                      : "border-transparent text-gray-500 hover:text-gray-300"
                  }`}
                >
                  Documentos/Manuais
                </button>
              </div>

              {/* List of current categories with Edit and Delete buttons */}
              <div className="space-y-1.5 h-[280px] overflow-y-auto border border-fmb-army/15 rounded p-3 bg-fmb-black/40 scrollbar-thin">
                <span className="text-[9px] text-fmb-gold uppercase block font-bold border-b border-fmb-army/10 pb-1 mb-1">
                  Categorias de {categoryTab === "instrucoes" ? "Instruções" : "Documentos"} Ativas
                </span>
                
                {categoryTab === "instrucoes" ? (
                  categoriesList.length === 0 ? (
                    <div className="text-gray-500 italic text-[10px] py-10 text-center">Nenhuma categoria cadastrada.</div>
                  ) : (
                    categoriesList.map(cat => {
                      const nameStr = typeof cat === 'string' ? cat : cat.name;
                      const minRankVal = typeof cat === 'string' ? "Soldado" : cat.minRank;
                      return (
                        <div key={nameStr} className="flex items-center justify-between py-2 border-b border-fmb-army/10 last:border-b-0 text-[10px]">
                          <div className="flex flex-col">
                            <span className="text-gray-200 font-bold">{nameStr}</span>
                            <span className="text-[8px] text-fmb-gold uppercase font-bold">Instrutor mín: {minRankVal}</span>
                          </div>
                          <div className="flex gap-1.5 font-sans">
                            <button 
                              onClick={() => handleStartEditCategory(cat)}
                              className="text-fmb-gold hover:text-white p-1 transition-colors cursor-pointer"
                              title="Editar categoria"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteCategory(nameStr)}
                              className="text-red-400 hover:text-red-200 p-1 transition-colors cursor-pointer"
                              title="Deletar categoria"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )
                ) : (
                  docCategoriesList.length === 0 ? (
                    <div className="text-gray-500 italic text-[10px] py-10 text-center">Nenhuma categoria cadastrada.</div>
                  ) : (
                    docCategoriesList.map(cat => (
                      <div key={cat} className="flex items-center justify-between py-2 border-b border-fmb-army/10 last:border-b-0 text-[10px]">
                        <span className="text-gray-200 font-bold">{cat}</span>
                        <div className="flex gap-1.5 font-sans">
                          <button 
                            onClick={() => handleStartEditCategory(cat)}
                            className="text-fmb-gold hover:text-white p-1 transition-colors cursor-pointer"
                            title="Editar categoria"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteCategory(cat)}
                            className="text-red-400 hover:text-red-200 p-1 transition-colors cursor-pointer"
                            title="Deletar categoria"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )
                )}
              </div>
            </div>

            {/* COLUNA 2: FORMULÁRIO */}
            <div className="flex flex-col justify-center font-mono">
              {editingCategory ? (
                <form onSubmit={handleSaveEditCategory} className="border border-fmb-gold/30 bg-fmb-gold/5 rounded p-4 space-y-3 text-left">
                  <div className="flex items-center justify-between border-b border-fmb-gold/15 pb-1.5 mb-2">
                    <span className="text-[10px] text-fmb-gold uppercase font-bold">Editar Categoria Selecionada</span>
                    <button 
                      type="button" 
                      onClick={() => setEditingCategory(null)}
                      className="text-gray-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[9px] text-gray-400 block mb-1 uppercase font-bold">Nome da Categoria</label>
                      <input 
                        type="text"
                        value={editingCategory.name}
                        onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                        className="w-full bg-fmb-slate border border-fmb-army/45 rounded py-1.5 px-2.5 text-white outline-none focus:border-fmb-gold text-[11px]"
                        required
                      />
                    </div>
                    {editingCategory.type === "training" && (
                      <div>
                        <label className="text-[9px] text-gray-400 block mb-1 uppercase font-bold">Patente Mínima do Instrutor</label>
                        <select
                          value={editingCategory.minRank || "SOLDADO"}
                          onChange={(e) => setEditingCategory({ ...editingCategory, minRank: e.target.value })}
                          className="w-full bg-fmb-slate border border-fmb-army/45 rounded py-1.5 px-2 text-white outline-none focus:border-fmb-gold text-[11px]"
                        >
                          {hierarchyList.map(h => (
                            <option key={h.rank} value={h.rank}>{h.label || h.rank}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <button 
                      type="button"
                      onClick={() => setEditingCategory(null)}
                      className="border border-gray-600 hover:bg-gray-800 text-gray-300 font-bold px-3 py-1.5 rounded uppercase text-[9px] transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      className="bg-fmb-gold hover:bg-fmb-gold/80 text-fmb-black font-black px-3 py-1.5 rounded uppercase text-[9px] transition-all cursor-pointer"
                    >
                      Salvar Alterações
                    </button>
                  </div>
                </form>
              ) : (
                /* Add form */
                <form onSubmit={handleAddCategory} className="border border-fmb-army/25 bg-fmb-black/40 rounded p-4 space-y-3 text-left">
                  <span className="text-[10px] text-fmb-gold uppercase block font-bold border-b border-fmb-army/15 pb-1.5 mb-2">
                    Adicionar Nova Categoria
                  </span>
                  <div className="space-y-3">
                    {categoryTab === "instrucoes" ? (
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-1">
                          <label className="text-[9px] text-gray-400 block mb-1 uppercase font-bold">Abreviação</label>
                          <input 
                            type="text"
                            placeholder="Ex: T.T"
                            value={newCategoryAbbrev}
                            onChange={(e) => setNewCategoryAbbrev(e.target.value)}
                            className="w-full bg-fmb-slate border border-fmb-army/30 rounded py-1.5 px-2 text-white outline-none focus:border-fmb-gold text-[11px] font-mono text-center uppercase"
                            required
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[9px] text-gray-400 block mb-1 uppercase font-bold">Nome do Curso</label>
                          <input 
                            type="text"
                            placeholder="Ex: Tiro Tático"
                            value={newCategoryFullName}
                            onChange={(e) => setNewCategoryFullName(e.target.value)}
                            className="w-full bg-fmb-slate border border-fmb-army/30 rounded py-1.5 px-2.5 text-white outline-none focus:border-fmb-gold text-[11px]"
                            required
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="text-[9px] text-gray-400 block mb-1 uppercase font-bold">Nome da Categoria</label>
                        <input 
                          type="text"
                          placeholder="Ex: Relatórios Oficiais"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          className="w-full bg-fmb-slate border border-fmb-army/30 rounded py-1.5 px-2.5 text-white outline-none focus:border-fmb-gold text-[11px]"
                          required
                        />
                      </div>
                    )}
                    {categoryTab === "instrucoes" && (
                      <div>
                        <label className="text-[9px] text-gray-400 block mb-1 uppercase font-bold">Patente Mínima do Instrutor</label>
                        <select
                          value={newCategoryMinRank}
                          onChange={(e) => setNewCategoryMinRank(e.target.value)}
                          className="w-full bg-fmb-slate border border-fmb-army/30 rounded py-1.5 px-2 text-white outline-none focus:border-fmb-gold text-[11px]"
                        >
                          {hierarchyList.map(h => (
                            <option key={h.rank} value={h.rank}>{h.label || h.rank}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-fmb-army hover:bg-fmb-olive border border-fmb-gold/45 text-white font-bold py-1.5 rounded uppercase text-[10px] tracking-wider transition-all cursor-pointer"
                  >
                    Registrar Categoria
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {deletingCategoryItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-fmb-black border border-fmb-gold/40 rounded-lg p-6 max-w-sm w-full space-y-4 shadow-2xl text-left font-mono">
            <div className="flex items-center space-x-2 text-red-500 border-b border-fmb-army/20 pb-2">
              <Trash2 className="w-5 h-5 text-red-500 animate-pulse" />
              <h4 className="text-white uppercase font-bold text-xs font-display tracking-wider">Confirmar Exclusão</h4>
            </div>
            <p className="text-gray-300 text-xs leading-relaxed">
              Tem certeza que deseja descredenciar e remover a categoria de{" "}
              <strong className="text-fmb-gold uppercase">
                {deletingCategoryItem.type === "instrucoes" ? "instrução" : "documentação"}
              </strong>{" "}
              denominada:
            </p>
            <div className="bg-fmb-slate border border-fmb-army/20 p-3 rounded text-center">
              <span className="text-white font-bold text-sm uppercase">{deletingCategoryItem.name}</span>
            </div>
            <p className="text-[10px] text-gray-500 italic">
              Esta ação descredenciará esta categoria do sistema. Essa mudança não poderá ser desfeita.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setDeletingCategoryItem(null)}
                className="px-3 py-1.5 border border-gray-600 hover:bg-gray-800 text-gray-300 rounded font-bold uppercase text-[9px] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={executeDeleteCategory}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded font-bold uppercase text-[9px] flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Deletar Categoria
              </button>
            </div>
          </div>
        </div>
      )}

      {adminTab === "hierarquia_subcargos" && (
        <>
          {/* SEÇÃO EXTRA DE SUB-CARGOS (SUB-ROLES) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
            
            {/* COLUNA 1: LISTA DE SUB-CARGOS ATIVOS E ESTATÍSTICAS */}
            <div className="bg-fmb-black/95 border border-fmb-army/30 rounded-lg p-5 font-mono text-xs text-left relative space-y-4">
              <Shield className="absolute top-4 right-4 w-5 h-5 text-fmb-gold opacity-35" />
              <h4 className="text-white uppercase text-xs font-bold font-display border-b border-fmb-army/15 pb-2 mb-2 flex items-center gap-2">
                <span>Sub-Cargos Militares Ativos no Sistema</span>
              </h4>

              {subCargoError && <div className="p-2.5 bg-red-950/25 border border-red-500/35 text-red-300 rounded text-[10px] font-bold">{subCargoError}</div>}
              {subCargoSuccess && <div className="p-2.5 bg-green-950/25 border border-green-500/35 text-green-300 rounded text-[10px] font-bold">{subCargoSuccess}</div>}

              {loadingSubCargos ? (
                <div className="text-gray-500 italic py-10 text-center">Carregando subcargos do sistema...</div>
              ) : subCargosList.length === 0 ? (
                <div className="text-gray-500 italic py-10 text-center border border-dashed border-fmb-army/15 rounded bg-fmb-slate/5">
                  Nenhum subcargo tático criado ainda. Use o formulário ao lado para registrar o primeiro subcargo (ex: Instrutor, Supervisor, etc.).
                </div>
              ) : (
                <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1 scrollbar-thin">
                  {subCargosList.map((sc) => {
                    // Count militars with this subcargo
                    const assignedCount = militarsList.filter(m => m.subCargos?.includes(sc.id)).length;
                    
                    return (
                      <div key={sc.id} className="border border-fmb-army/15 p-3 rounded bg-fmb-black/40 hover:bg-fmb-black/80 transition-all space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[10px] text-fmb-gold font-bold uppercase tracking-wider">{sc.label}</span>
                            <span className="text-[8px] bg-fmb-slate text-gray-400 border border-fmb-army/20 px-1.5 py-0.2 rounded ml-2 font-mono uppercase">{sc.id}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setEditingSubCargo(sc)}
                              className="text-gray-400 hover:text-white transition-colors cursor-pointer p-0.5"
                              title="Editar Subcargo"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSubCargo(sc.id)}
                              className="text-red-500 hover:text-red-400 transition-colors cursor-pointer p-0.5"
                              title="Excluir Subcargo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        
                        <p className="text-[10px] text-gray-400 leading-normal italic">"{sc.description}"</p>
                        
                        <div className="flex items-center justify-between text-[8px] font-mono text-gray-500 pt-1 border-t border-fmb-army/5">
                          <span>REQ. MÍNIMO: <strong className="text-gray-300">{sc.minRank || "SOLDADO"}</strong></span>
                          <span>MILITARES ATRIBUÍDOS: <strong className="text-fmb-gold">{assignedCount}</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* COLUNA 2: FORMULÁRIOS DE CRIAÇÃO, EDIÇÃO E ATRIBUIÇÃO */}
            <div className="space-y-6">
              
              {/* FORMULÁRIO 1: CRIAR / EDITAR SUB-CARGO */}
              <div className="bg-fmb-black/95 border border-fmb-army/30 rounded-lg p-5 font-mono text-xs text-left relative space-y-4">
                <h4 className="text-white uppercase text-xs font-bold font-display border-b border-fmb-army/15 pb-2 mb-1">
                  {editingSubCargo ? "Editar Sub-Cargo Tático" : "Criar Novo Sub-Cargo Tático"}
                </h4>

                <form onSubmit={editingSubCargo ? handleEditSubCargo : handleCreateSubCargo} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] text-fmb-gold uppercase block mb-1">ID Único (Fixo)</label>
                      <input
                        type="text"
                        disabled={!!editingSubCargo}
                        placeholder="Ex: instrutor_a"
                        value={editingSubCargo ? editingSubCargo.id : newSubCargoId}
                        onChange={(e) => setNewSubCargoId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                        className="w-full bg-fmb-slate disabled:opacity-40 border border-fmb-army/30 rounded py-1.5 px-2 text-white outline-none font-mono text-xs"
                        required
                      />
                      <span className="text-[8px] text-gray-500 mt-0.5 block">Apenas letters, números e underline.</span>
                    </div>

                    <div>
                      <label className="text-[9px] text-fmb-gold uppercase block mb-1">Nome de Exibição (Label)</label>
                      <input
                        type="text"
                        placeholder="Ex: Instrutor Auxiliar"
                        value={editingSubCargo ? editingSubCargo.label : newSubCargoLabel}
                        onChange={(e) => editingSubCargo ? setEditingSubCargo({...editingSubCargo, label: e.target.value}) : setNewSubCargoLabel(e.target.value)}
                        className="w-full bg-fmb-slate border border-fmb-army/30 rounded py-1.5 px-2 text-white outline-none text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] text-fmb-gold uppercase block mb-1">Descrição das Atribuições</label>
                    <textarea
                      placeholder="Descreva as funções, privilégios ou propósitos deste subcargo..."
                      value={editingSubCargo ? editingSubCargo.description : newSubCargoDesc}
                      onChange={(e) => editingSubCargo ? setEditingSubCargo({...editingSubCargo, description: e.target.value}) : setNewSubCargoDesc(e.target.value)}
                      rows={2}
                      className="w-full bg-fmb-slate border border-fmb-army/30 rounded py-1.5 px-2 text-white outline-none resize-none text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[9px] text-fmb-gold uppercase block mb-1">Patente Mínima Requerida</label>
                    <select
                      value={editingSubCargo ? editingSubCargo.minRank : newSubCargoMinRank}
                      onChange={(e) => editingSubCargo ? setEditingSubCargo({...editingSubCargo, minRank: e.target.value}) : setNewSubCargoMinRank(e.target.value)}
                      className="w-full bg-fmb-slate border border-fmb-army/30 rounded py-1.5 px-2 text-white outline-none focus:border-fmb-gold text-xs"
                    >
                      <option value={MilitaryRank.ADMSUPREMO}>Administrador Supremo</option>
                      {hierarchyList
                        .filter(rc => rc.rank !== MilitaryRank.ADMSUPREMO)
                        .map(rc => (
                          <option key={rc.rank} value={rc.rank}>{rc.label}</option>
                        ))
                      }
                    </select>
                    <span className="text-[8px] text-gray-500 mt-0.5 block">Garante que apenas militares a partir desta patente consigam possuir este subcargo.</span>
                  </div>

                  <div className="border border-fmb-army/20 rounded p-3 bg-fmb-slate/20 space-y-2">
                    <label className="text-[9px] text-fmb-gold uppercase block font-bold border-b border-fmb-army/10 pb-1">Permissões deste Sub-Cargo</label>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <label className="flex items-center gap-1.5 text-gray-300 hover:text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!!subCargoPermissions.canEnlist}
                          onChange={(e) => setSubCargoPermissions({...subCargoPermissions, canEnlist: e.target.checked})}
                          className="rounded border-fmb-army/40 text-fmb-gold focus:ring-0 focus:ring-offset-0 bg-fmb-slate"
                        />
                        <span>Alistar Recrutas</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-gray-300 hover:text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!!subCargoPermissions.canPromote}
                          onChange={(e) => setSubCargoPermissions({...subCargoPermissions, canPromote: e.target.checked})}
                          className="rounded border-fmb-army/40 text-fmb-gold focus:ring-0 focus:ring-offset-0 bg-fmb-slate"
                        />
                        <span>Promover/Rebaixar</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-gray-300 hover:text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!!subCargoPermissions.canTrain}
                          onChange={(e) => setSubCargoPermissions({...subCargoPermissions, canTrain: e.target.checked})}
                          className="rounded border-fmb-army/40 text-fmb-gold focus:ring-0 focus:ring-offset-0 bg-fmb-slate"
                        />
                        <span>Treinar/Postar Atas</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-gray-300 hover:text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!!subCargoPermissions.canManageDocs}
                          onChange={(e) => setSubCargoPermissions({...subCargoPermissions, canManageDocs: e.target.checked})}
                          className="rounded border-fmb-army/40 text-fmb-gold focus:ring-0 focus:ring-offset-0 bg-fmb-slate"
                        />
                        <span>Gerenciar Manuais</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-gray-300 hover:text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!!subCargoPermissions.canManageCategories}
                          onChange={(e) => setSubCargoPermissions({...subCargoPermissions, canManageCategories: e.target.checked})}
                          className="rounded border-fmb-army/40 text-fmb-gold focus:ring-0 focus:ring-offset-0 bg-fmb-slate"
                        />
                        <span>Gerenciar Categorias</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-gray-300 hover:text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!!subCargoPermissions.canManageMissions}
                          onChange={(e) => setSubCargoPermissions({...subCargoPermissions, canManageMissions: e.target.checked})}
                          className="rounded border-fmb-army/40 text-fmb-gold focus:ring-0 focus:ring-offset-0 bg-fmb-slate"
                        />
                        <span>Gerenciar Missões</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-gray-300 hover:text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!!subCargoPermissions.canAdminSystem}
                          onChange={(e) => setSubCargoPermissions({...subCargoPermissions, canAdminSystem: e.target.checked})}
                          className="rounded border-fmb-army/40 text-fmb-gold focus:ring-0 focus:ring-offset-0 bg-fmb-slate"
                        />
                        <span>Coordenar Sistema</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-gray-300 hover:text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!!subCargoPermissions.canViewInstrucoes}
                          onChange={(e) => setSubCargoPermissions({...subCargoPermissions, canViewInstrucoes: e.target.checked})}
                          className="rounded border-fmb-army/40 text-fmb-gold focus:ring-0 focus:ring-offset-0 bg-fmb-slate"
                        />
                        <span>Acessar Instruções</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-gray-300 hover:text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!!subCargoPermissions.canViewOperacoes}
                          onChange={(e) => setSubCargoPermissions({...subCargoPermissions, canViewOperacoes: e.target.checked})}
                          className="rounded border-fmb-army/40 text-fmb-gold focus:ring-0 focus:ring-offset-0 bg-fmb-slate"
                        />
                        <span>Acessar Operações</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-gray-300 hover:text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!!subCargoPermissions.canViewPostarAulas}
                          onChange={(e) => setSubCargoPermissions({...subCargoPermissions, canViewPostarAulas: e.target.checked})}
                          className="rounded border-fmb-army/40 text-fmb-gold focus:ring-0 focus:ring-offset-0 bg-fmb-slate"
                        />
                        <span>Postar Aulas</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-gray-300 hover:text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!!subCargoPermissions.canViewBaterPonto}
                          onChange={(e) => setSubCargoPermissions({...subCargoPermissions, canViewBaterPonto: e.target.checked})}
                          className="rounded border-fmb-army/40 text-fmb-gold focus:ring-0 focus:ring-offset-0 bg-fmb-slate"
                        />
                        <span>Bater Ponto</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-gray-300 hover:text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!!subCargoPermissions.canEnterService}
                          onChange={(e) => setSubCargoPermissions({...subCargoPermissions, canEnterService: e.target.checked})}
                          className="rounded border-fmb-army/40 text-fmb-gold focus:ring-0 focus:ring-offset-0 bg-fmb-slate"
                        />
                        <span>Entrar em Serviço</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-gray-300 hover:text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!!subCargoPermissions.canWarn}
                          onChange={(e) => setSubCargoPermissions({...subCargoPermissions, canWarn: e.target.checked})}
                          className="rounded border-fmb-army/40 text-fmb-gold focus:ring-0 focus:ring-offset-0 bg-fmb-slate"
                        />
                        <span>Aplicar Advertências</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-1">
                    {editingSubCargo && (
                      <button
                        type="button"
                        onClick={() => setEditingSubCargo(null)}
                        className="bg-fmb-slate border border-fmb-army/20 hover:bg-fmb-army text-white text-[9px] uppercase font-bold py-1.5 px-4 rounded transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      type="submit"
                      className="bg-fmb-army border border-fmb-gold/40 hover:bg-fmb-olive text-white text-[9px] uppercase font-bold py-1.5 px-6 rounded transition-colors cursor-pointer"
                    >
                      {editingSubCargo ? "Salvar Alterações" : "Criar Sub-Cargo"}
                    </button>
                  </div>
                </form>
              </div>

              {/* FORMULÁRIO 2: ATRIBUIR SUB-CARGO A MILITAR */}
              <div className="bg-fmb-black/95 border border-fmb-army/30 rounded-lg p-5 font-mono text-xs text-left relative space-y-4">
                <h4 className="text-white uppercase text-xs font-bold font-display border-b border-fmb-army/15 pb-2 mb-1">
                  Atribuir Sub-Cargo a Militar
                </h4>

                {assignError && <div className="p-2.5 bg-red-950/25 border border-red-500/35 text-red-300 rounded text-[10px] font-bold">{assignError}</div>}
                {assignSuccess && <div className="p-2.5 bg-green-950/25 border border-green-500/35 text-green-300 rounded text-[10px] font-bold">{assignSuccess}</div>}

                <form onSubmit={handleAssignSubCargo} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] text-fmb-gold uppercase block mb-1">Nick do Militar Alvo</label>
                      <input
                        type="text"
                        placeholder="Ex: NickMilitar"
                        value={assignTargetNick}
                        onChange={(e) => setAssignTargetNick(e.target.value)}
                        className="w-full bg-fmb-slate border border-fmb-army/30 rounded py-1.5 px-2 text-white outline-none font-mono text-xs"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[9px] text-fmb-gold uppercase block mb-1">Sub-Cargo a Atribuir</label>
                      <select
                        value={assignSelectedSubCargoId}
                        onChange={(e) => setAssignSelectedSubCargoId(e.target.value)}
                        className="w-full bg-fmb-slate border border-fmb-army/30 rounded py-1.5 px-2 text-white outline-none focus:border-fmb-gold text-xs"
                        required
                      >
                        <option value="">Selecione...</option>
                        {subCargosList.map(sc => (
                          <option key={sc.id} value={sc.id}>{sc.label} ({sc.id})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={assigningSub}
                      className="bg-fmb-army border border-fmb-gold/45 hover:bg-fmb-olive disabled:opacity-50 text-white text-[9px] uppercase font-bold py-1.5 px-6 rounded transition-colors cursor-pointer"
                    >
                      {assigningSub ? "Atribuindo..." : "Atribuir Cargo Adicional"}
                    </button>
                  </div>
                </form>

                {/* SEÇÃO INTEGRADA: BUSCA E REMOÇÃO RÁPIDA DE SUB-CARGOS JÁ ATRIBUÍDOS */}
                <div className="border-t border-fmb-army/15 pt-3 mt-3 space-y-2">
                  <span className="text-[9px] text-gray-400 font-bold uppercase block">Militares com Sub-Cargos Ativos</span>
                  
                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin">
                    {militarsList.filter(m => m.subCargos && m.subCargos.length > 0).length === 0 ? (
                      <div className="text-gray-500 italic text-[9px] py-2 text-center">Nenhum militar possui cargos adicionais atribuídos no momento.</div>
                    ) : (
                      militarsList
                        .filter(m => m.subCargos && m.subCargos.length > 0)
                        .map(m => (
                          <div key={m.id} className="flex items-center justify-between p-2 rounded bg-fmb-slate/10 border border-fmb-army/5 text-[10px]">
                            <div>
                              <strong className="text-white">@{m.habboNick}</strong>
                              <span className="text-[8px] text-gray-500 ml-1.5 uppercase">({m.role})</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {m.subCargos?.map(scId => {
                                  const scName = subCargosList.find(x => x.id === scId)?.label || scId;
                                  return (
                                    <span key={scId} className="bg-amber-500/10 text-amber-300 text-[8px] border border-amber-500/25 px-1 rounded uppercase font-semibold flex items-center gap-1">
                                      {scName}
                                      <button
                                        onClick={() => handleRemoveSubCargo(m.id, scId)}
                                        className="text-red-400 hover:text-red-500 font-black cursor-pointer font-sans"
                                        title={`Remover subcargo ${scName} deste militar`}
                                      >
                                        ×
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>

              </div>

            </div>

          </div>

        {/* FULL-WIDTH SECTION: POLICE HIERARCHY & PERMISSIONS ASSIGNMENT */}
          <div className="bg-fmb-black/95 border border-fmb-army/30 rounded-lg p-6 font-mono text-xs text-left relative space-y-4">
        <Users className="absolute top-5 right-6 w-5 h-5 text-fmb-gold opacity-30" />
        <h4 className="text-white uppercase text-xs font-bold font-display border-b border-fmb-army/15 pb-2 mb-4 flex items-center space-x-2">
          <Shield className="w-4 h-4 text-fmb-gold" />
          <span>Configuração de Hierarquia e Atribuição de Funções Táticas</span>
        </h4>

        {hierarchySuccess && (
          <div className="p-2.5 bg-green-950/20 border border-green-500/30 text-green-300 rounded text-[10px] uppercase font-bold">
            {hierarchySuccess}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Rank list column */}
          <div className="border border-fmb-army/20 rounded p-3 space-y-2 max-h-[380px] overflow-y-auto bg-fmb-black/40 scrollbar-thin">
            <div className="flex items-center justify-between border-b border-fmb-army/10 pb-1 mb-2">
              <span className="text-[9px] text-fmb-gold uppercase block font-bold">
                Selecione Patente / Cargo
              </span>
              <button
                type="button"
                onClick={handleCreateRankClick}
                className="bg-amber-600 hover:bg-amber-700 text-white font-mono text-[8px] px-1.5 py-0.5 rounded uppercase font-bold"
              >
                + Criar Novo
              </button>
            </div>
            {hierarchyList.map(rc => (
              <button
                key={rc.rank}
                onClick={() => handleSelectRank(rc)}
                className={`w-full text-left p-2 rounded transition-all font-mono text-[10px] flex items-center justify-between ${
                  selectedRankToEdit === rc.rank
                    ? "bg-fmb-army text-white font-bold border-l-4 border-fmb-gold shadow-md"
                    : "text-gray-300 hover:bg-fmb-slate/40"
                }`}
              >
                <span>{rc.label}</span>
                <span className="text-[8px] text-gray-500 font-semibold uppercase">{rc.rank}</span>
              </button>
            ))}
          </div>

          {/* Form and Toggles column */}
          <div className="lg:col-span-2 border border-fmb-army/20 rounded p-4 bg-fmb-slate/15 space-y-4">
            {selectedRankToEdit || isCreatingRank ? (
              <form onSubmit={handleSaveRankConfig} className="space-y-4">
                <div className="flex justify-between items-center border-b border-fmb-army/10 pb-2">
                  <span className="text-[10px] text-fmb-gold font-bold">
                    {isCreatingRank ? "DECRETAR DESIGNAR NOVO CARGO" : `AJUSTANDO CREDENCIAIS DE CARGO: ${selectedRankToEdit}`}
                  </span>
                  {!isCreatingRank && (
                    <span className="bg-fmb-black py-0.5 px-2 border border-fmb-army/30 rounded text-[9px] text-gray-400 font-bold">
                      ID: {selectedRankToEdit}
                    </span>
                  )}
                </div>

                {isCreatingRank && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded space-y-1">
                    <label className="text-[9px] text-amber-400 uppercase font-bold block">
                      Código de Identificação do Cargo (Ex: CABO, TENENTE, CAPITAO)
                    </label>
                    <input
                      type="text"
                      value={newRankId}
                      onChange={(e) => setNewRankId(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
                      className="w-full bg-fmb-black border border-amber-500/30 rounded py-1.5 px-3 font-mono text-xs text-amber-300 focus:outline-none focus:border-amber-400"
                      placeholder="Apenas letras maiúsculas e sem espaços..."
                      required
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] text-fmb-gold block uppercase mb-1">Nome de Exibição / Sigla</label>
                    <input
                      type="text"
                      value={editRankLabel}
                      onChange={(e) => setEditRankLabel(e.target.value)}
                      className="w-full bg-fmb-black border border-fmb-army/30 py-1.5 px-2.5 rounded text-white outline-none focus:border-fmb-gold text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[9px] text-fmb-gold block uppercase mb-1">Descrição do Cargo</label>
                    <input
                      type="text"
                      value={editRankDesc}
                      onChange={(e) => setEditRankDesc(e.target.value)}
                      className="w-full bg-fmb-black border border-fmb-army/30 py-1.5 px-2.5 rounded text-white outline-none focus:border-fmb-gold text-xs"
                      placeholder="Diretrizes do Cargo..."
                    />
                  </div>
                </div>

                {/* Permissions Toggles */}
                <div>
                  <label className="text-[10px] text-fmb-gold block uppercase mb-2.5 font-bold border-b border-fmb-army/10 pb-1">
                    Atribuir Atividades e Permissões Administrativas
                  </label>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    
                    {/* canEnlist Toggle */}
                    <div 
                      onClick={() => handlePermissionToggle("canEnlist")}
                      className={`p-3 rounded border transition-all cursor-pointer flex flex-col justify-between h-[85px] leading-tight ${
                        editRankPermissions.canEnlist 
                          ? "border-green-500/35 bg-green-950/25 text-white" 
                          : "border-fmb-army/20 bg-fmb-black/40 text-gray-400 hover:border-fmb-army/45"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[9px]">ALISTAR RECRUTAS</span>
                        <input
                          type="checkbox"
                          checked={!!editRankPermissions.canEnlist}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 accent-green-500 cursor-pointer pointer-events-none"
                        />
                      </div>
                      <span className="text-[8px] text-gray-500 block mt-1 uppercase leading-normal">
                        Acesso ao portão para fardar novos integrantes.
                      </span>
                    </div>

                    {/* canPromote Toggle */}
                    <div 
                      onClick={() => handlePermissionToggle("canPromote")}
                      className={`p-3 rounded border transition-all cursor-pointer flex flex-col justify-between h-[85px] leading-tight ${
                        editRankPermissions.canPromote 
                          ? "border-green-500/35 bg-green-950/25 text-white" 
                          : "border-fmb-army/20 bg-fmb-black/40 text-gray-400 hover:border-fmb-army/45"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[9px]">EFETUAR PROMOÇÕES</span>
                        <input
                          type="checkbox"
                          checked={!!editRankPermissions.canPromote}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 accent-green-500 cursor-pointer pointer-events-none"
                        />
                      </div>
                      <span className="text-[8px] text-gray-500 block mt-1 uppercase leading-normal">
                        Pode conceder ascensões táticas oficiais a praças.
                      </span>
                    </div>

                    {/* canTrain Toggle */}
                    <div 
                      onClick={() => handlePermissionToggle("canTrain")}
                      className={`p-3 rounded border transition-all cursor-pointer flex flex-col justify-between h-[85px] leading-tight ${
                        editRankPermissions.canTrain 
                          ? "border-green-500/35 bg-green-950/25 text-white" 
                          : "border-fmb-army/20 bg-fmb-black/40 text-gray-400 hover:border-fmb-army/45"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[9px]">MINISTRAR TREINOS</span>
                        <input
                          type="checkbox"
                          checked={!!editRankPermissions.canTrain}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 accent-green-500 cursor-pointer pointer-events-none"
                        />
                      </div>
                      <span className="text-[8px] text-gray-500 block mt-1 uppercase leading-normal">
                        Ministrar instruções de tiro e doutrinas.
                      </span>
                    </div>

                    {/* canManageDocs Toggle */}
                    <div 
                      onClick={() => handlePermissionToggle("canManageDocs")}
                      className={`p-3 rounded border transition-all cursor-pointer flex flex-col justify-between h-[85px] leading-tight ${
                        editRankPermissions.canManageDocs 
                          ? "border-green-500/35 bg-green-950/25 text-white" 
                          : "border-fmb-army/20 bg-fmb-black/40 text-gray-400 hover:border-fmb-army/45"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[9px]">GERENCIAR MANUAIS</span>
                        <input
                          type="checkbox"
                          checked={!!editRankPermissions.canManageDocs}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 accent-green-500 cursor-pointer pointer-events-none"
                        />
                      </div>
                      <span className="text-[8px] text-gray-500 block mt-1 uppercase leading-normal">
                        Postar slides de aula, apostilas (PDF) e scripts.
                      </span>
                    </div>

                    {/* canManageCategories Toggle */}
                    <div 
                      onClick={() => handlePermissionToggle("canManageCategories")}
                      className={`p-3 rounded border transition-all cursor-pointer flex flex-col justify-between h-[85px] leading-tight ${
                        editRankPermissions.canManageCategories 
                          ? "border-green-500/35 bg-green-950/25 text-white" 
                          : "border-fmb-army/20 bg-fmb-black/40 text-gray-400 hover:border-fmb-army/45"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[9px]">GERENCIAR CATEGORIAS</span>
                        <input
                          type="checkbox"
                          checked={!!editRankPermissions.canManageCategories}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 accent-green-500 cursor-pointer pointer-events-none"
                        />
                      </div>
                      <span className="text-[8px] text-gray-500 block mt-1 uppercase leading-normal">
                        Gerenciar (criar, editar e excluir) categorias de instruções e de documentos.
                      </span>
                    </div>

                    {/* canManageMissions Toggle */}
                    <div 
                      onClick={() => handlePermissionToggle("canManageMissions")}
                      className={`p-3 rounded border transition-all cursor-pointer flex flex-col justify-between h-[85px] leading-tight ${
                        editRankPermissions.canManageMissions 
                          ? "border-green-500/35 bg-green-950/25 text-white" 
                          : "border-fmb-army/20 bg-fmb-black/40 text-gray-400 hover:border-fmb-army/45"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[9px]">ATIVAR OPERAÇÕES</span>
                        <input
                          type="checkbox"
                          checked={!!editRankPermissions.canManageMissions}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 accent-green-500 cursor-pointer pointer-events-none"
                        />
                      </div>
                      <span className="text-[8px] text-gray-500 block mt-1 uppercase leading-normal">
                        Criar e retificar metas do quadro de missões.
                      </span>
                    </div>

                    {/* canAdminSystem Toggle */}
                    <div 
                      onClick={() => handlePermissionToggle("canAdminSystem")}
                      className={`p-3 rounded border transition-all cursor-pointer flex flex-col justify-between h-[85px] leading-tight ${
                        editRankPermissions.canAdminSystem 
                          ? "border-red-500/35 bg-red-950/25 text-white" 
                          : "border-fmb-army/20 bg-fmb-black/40 text-gray-400 hover:border-fmb-army/45"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[9px] text-red-400">ADMIN SUPREMO</span>
                        <input
                          type="checkbox"
                          checked={!!editRankPermissions.canAdminSystem}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 accent-red-500 cursor-pointer pointer-events-none"
                        />
                      </div>
                      <span className="text-[8px] text-gray-500 block mt-1 uppercase leading-normal">
                        Controle irrestrito de senhas, sanções e exclusões.
                      </span>
                    </div>

                    {/* canViewInstrucoes Toggle */}
                    <div 
                      onClick={() => handlePermissionToggle("canViewInstrucoes")}
                      className={`p-3 rounded border transition-all cursor-pointer flex flex-col justify-between h-[85px] leading-tight ${
                        editRankPermissions.canViewInstrucoes 
                          ? "border-green-500/35 bg-green-950/25 text-white" 
                          : "border-fmb-army/20 bg-fmb-black/40 text-gray-400 hover:border-fmb-army/45"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[9px]">VER INSTRUÇÕES</span>
                        <input
                          type="checkbox"
                          checked={!!editRankPermissions.canViewInstrucoes}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 accent-green-500 cursor-pointer pointer-events-none"
                        />
                      </div>
                      <span className="text-[8px] text-gray-500 block mt-1 uppercase leading-normal">
                        Permissão para visualizar aba de Instruções de Treino.
                      </span>
                    </div>

                    {/* canViewOperacoes Toggle */}
                    <div 
                      onClick={() => handlePermissionToggle("canViewOperacoes")}
                      className={`p-3 rounded border transition-all cursor-pointer flex flex-col justify-between h-[85px] leading-tight ${
                        editRankPermissions.canViewOperacoes 
                          ? "border-green-500/35 bg-green-950/25 text-white" 
                          : "border-fmb-army/20 bg-fmb-black/40 text-gray-400 hover:border-fmb-army/45"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[9px]">VER OPERAÇÕES</span>
                        <input
                          type="checkbox"
                          checked={!!editRankPermissions.canViewOperacoes}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 accent-green-500 cursor-pointer pointer-events-none"
                        />
                      </div>
                      <span className="text-[8px] text-gray-500 block mt-1 uppercase leading-normal">
                        Permissão para ver aba de Operações & Missões.
                      </span>
                    </div>

                    {/* canViewPostarAulas Toggle */}
                    <div 
                      onClick={() => handlePermissionToggle("canViewPostarAulas")}
                      className={`p-3 rounded border transition-all cursor-pointer flex flex-col justify-between h-[85px] leading-tight ${
                        editRankPermissions.canViewPostarAulas 
                          ? "border-green-500/35 bg-green-950/25 text-white" 
                          : "border-fmb-army/20 bg-fmb-black/40 text-gray-400 hover:border-fmb-army/45"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[9px]">VER POSTAR AULAS</span>
                        <input
                          type="checkbox"
                          checked={!!editRankPermissions.canViewPostarAulas}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 accent-green-500 cursor-pointer pointer-events-none"
                        />
                      </div>
                      <span className="text-[8px] text-gray-500 block mt-1 uppercase leading-normal">
                        Permissão para ver aba de Relatório de Aulas de Recruta.
                      </span>
                    </div>

                    {/* canViewBaterPonto Toggle */}
                    <div 
                      onClick={() => handlePermissionToggle("canViewBaterPonto")}
                      className={`p-3 rounded border transition-all cursor-pointer flex flex-col justify-between h-[85px] leading-tight ${
                        editRankPermissions.canViewBaterPonto 
                          ? "border-green-500/35 bg-green-950/25 text-white" 
                          : "border-fmb-army/20 bg-fmb-black/40 text-gray-400 hover:border-fmb-army/45"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[9px]">VER BATER PONTOS</span>
                        <input
                          type="checkbox"
                          checked={!!editRankPermissions.canViewBaterPonto}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 accent-green-500 cursor-pointer pointer-events-none"
                        />
                      </div>
                      <span className="text-[8px] text-gray-500 block mt-1 uppercase leading-normal">
                        Acesso à aba de espelho de ponto e logs de serviço.
                      </span>
                    </div>

                    {/* canEnterService Toggle */}
                    <div 
                      onClick={() => handlePermissionToggle("canEnterService")}
                      className={`p-3 rounded border transition-all cursor-pointer flex flex-col justify-between h-[85px] leading-tight ${
                        editRankPermissions.canEnterService 
                          ? "border-green-500/35 bg-green-950/25 text-white" 
                          : "border-fmb-army/20 bg-fmb-black/40 text-gray-400 hover:border-fmb-army/45"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[9px]">ENTRAR EM SERVIÇO</span>
                        <input
                          type="checkbox"
                          checked={!!editRankPermissions.canEnterService}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 accent-green-500 cursor-pointer pointer-events-none"
                        />
                      </div>
                      <span className="text-[8px] text-gray-500 block mt-1 uppercase leading-normal">
                        Permissão para poder bater ponto e entrar em serviço de farda.
                      </span>
                    </div>

                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-fmb-army/10">
                  {(!isCreatingRank && selectedRankToEdit !== "SOLDADO" && selectedRankToEdit !== "ADMSUPREMO" && selectedRankToEdit !== "Administrador Supremo") ? (
                    <button
                      type="button"
                      onClick={handleDeleteRankConfig}
                      className="bg-red-800 hover:bg-red-900 border border-red-500/30 text-white font-bold py-2 px-4 rounded uppercase tracking-wider text-[10px] transition-colors cursor-pointer"
                    >
                      Excluir Cargo
                    </button>
                  ) : (
                    <div />
                  )}
                  <div className="flex space-x-2">
                    {isCreatingRank && (
                      <button
                        type="button"
                        onClick={() => setIsCreatingRank(false)}
                        className="bg-fmb-slate hover:bg-fmb-slate/80 text-gray-300 font-bold py-2 px-4 rounded uppercase tracking-wider text-[10px] transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      type="submit"
                      className="bg-fmb-army hover:bg-fmb-olive border border-fmb-gold/45 text-white font-bold py-2 px-6 rounded uppercase tracking-wider text-[10px] transition-colors cursor-pointer"
                    >
                      {isCreatingRank ? "Decretar Novo Cargo" : "Publicar Alterações de Cargo"}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <p className="text-gray-500 italic text-center py-20">Selecione uma patente na árvore ao lado para editar ou clique em "+ Criar Novo".</p>
            )}
          </div>
        </div>
      </div>
      </>)}

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Expulsar e Excluir Militar"
        message="ATENÇÃO MÁXIMA: Deseja apagar essa conta militar para sempre do banco de dados FMB? Toda e qualquer pontuação, medalhas e registros desta conta serão excluídos de forma definitiva e irreversível."
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

    </div>
  );
}
