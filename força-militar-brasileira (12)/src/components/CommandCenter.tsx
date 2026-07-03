import React, { useEffect, useState } from "react";
import { 
  Shield, Clock, Power, Users, GraduationCap, Award, Star, BookOpen, 
  Map, Activity, ClipboardList, Settings, Lock, LogOut, Check, ChevronRight, Zap,
  ClipboardCheck, Newspaper, Bell, AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../lib/api.js";
import { User, MilitaryRank, UserActiveState, UserStatus, SubCargo, MilitaryNotification } from "../types.js";
import logoImg from "../assets/images/regenerated_image_1781102632223.png";

// Helper components & panels
import UserProfile from "./UserProfile.js";
import TrainingsPanel from "./TrainingsPanel.js";
import MissionsPanel from "./MissionsPanel.js";
import AdminPanel from "./AdminPanel.js";
import DocumentsPanel from "./DocumentsPanel.js";
import InstructorsPanel from "./InstructorsPanel.js";
import RecruitLessonsPanel from "./RecruitLessonsPanel.js";
import { PontoPanel } from "./PontoPanel.js";
import JournalPanel from "./JournalPanel.js";
import { CdmPanel } from "./CdmPanel.js";

interface CommandCenterProps {
  user: User;
  onLogout: () => void;
  onUpdateMe: (updatedUser: User) => void;
}

export default function CommandCenter({ user, onLogout, onUpdateMe }: CommandCenterProps) {
  const [activeTab, setActiveTab] = useState<"operacional" | "militares" | "instrucoes" | "missoes" | "documentos" | "admin" | "postar-aulas" | "pontes" | "jornal" | "instrutores" | "cdm">("operacional");
  
  // Dashboard indicators
  const [stats, setStats] = useState<{
    totalMilitars: number;
    online: number;
    emServico: number;
    trainingsConcluded: number;
    promotionsTotal: number;
    totalHoursActivity: number;
  }>({
    totalMilitars: 0,
    online: 0,
    emServico: 0,
    trainingsConcluded: 0,
    promotionsTotal: 0,
    totalHoursActivity: 0
  });

  const [serviceTimer, setServiceTimer] = useState<number>(0);
  const [militars, setMilitars] = useState<User[]>([]);
  const [selectedMilitarId, setSelectedMilitarId] = useState<string | null>(null);
  const [militarsSearch, setMilitarsSearch] = useState("");
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [pendingEnlistments, setPendingEnlistments] = useState<any[]>([]);
  const [allSubCargos, setAllSubCargos] = useState<SubCargo[]>([]);

  // Quick Action Forms State
  const [enlistSuccess, setEnlistSuccess] = useState<string | null>(null);
  const [enlistError, setEnlistError] = useState<string | null>(null);
  const [enlisting, setEnlisting] = useState(false);

  // Promotion/Demotion Form
  const [promTargetNick, setPromTargetNick] = useState("");
  const [promRank, setPromRank] = useState<string>("");
  const [promReason, setPromReason] = useState("");
  const [promSuccess, setPromSuccess] = useState<string | null>(null);
  const [promError, setPromError] = useState<string | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [hierarchyList, setHierarchyList] = useState<any[]>([]);

  // Warnings subtab states
  const [operacionalSubTab, setOperacionalSubTab] = useState<"status" | "advertencias">("status");
  const [warningLogs, setWarningLogs] = useState<any[]>([]);
  const [loadingWarnings, setLoadingWarnings] = useState(false);
  const [warningsError, setWarningsError] = useState<string | null>(null);

  const fetchWarningLogs = async () => {
    setLoadingWarnings(true);
    setWarningsError(null);
    try {
      const logs = await api.getLogs();
      const warns = (logs || []).filter((log: any) => 
        log.action.toUpperCase().includes("ADVERTENCIA") || 
        log.action.toUpperCase().includes("ADVERTÊNCIA")
      );
      setWarningLogs(warns);
    } catch (err: any) {
      console.error(err);
      setWarningsError(err.message || "Erro ao carregar registros de advertência.");
    } finally {
      setLoadingWarnings(false);
    }
  };

  // Notifications states
  const [notifications, setNotifications] = useState<MilitaryNotification[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  // User configured permissions
  const [userPermissions, setUserPermissions] = useState<{
    canEnlist: boolean;
    canPromote: boolean;
    canTrain: boolean;
    canManageDocs: boolean;
    canManageCategories: boolean;
    canManageMissions: boolean;
    canAdminSystem: boolean;
    canViewInstrucoes: boolean;
    canViewOperacoes: boolean;
    canViewPostarAulas: boolean;
    canViewBaterPonto: boolean;
    canEnterService: boolean;
    canWarn: boolean;
  } | null>(null);

  // Custom Tab Permissions State
  const [customPermissions, setCustomPermissions] = useState<{
    instrutoresViewAllowed: string[];
    amanViewAllowed: string[];
    cdmViewAllowed: string[];
  }>({
    instrutoresViewAllowed: [],
    amanViewAllowed: [],
    cdmViewAllowed: []
  });

  const handleToggleNotifications = async () => {
    const nextState = !showNotifMenu;
    setShowNotifMenu(nextState);
    if (nextState) {
      try {
        await api.markNotificationsAsRead();
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      } catch (err) {
        console.warn("Erro ao marcar notificações como lidas:", err);
      }
    }
  };

  // Load stats and active militars
  const loadDashboardData = async () => {
    try {
      const statsData = await api.getStats();
      setStats(statsData);
      
      const militarsList = await api.getUsers();
      setMilitars(militarsList);

      try {
        const scList = await api.getSubCargos();
        setAllSubCargos(scList || []);
      } catch (scErr) {
        console.error("Erro ao obter subcargos no CommandCenter", scErr);
      }

      try {
        const notifList = await api.getNotifications();
        setNotifications(notifList || []);
      } catch (notifErr) {
        console.warn("Erro ao carregar notificações", notifErr);
      }

      try {
        const enlistReqs = await api.getEnlistmentRequests();
        setPendingEnlistments(enlistReqs);
      } catch (reqErr) {
        setPendingEnlistments([]);
      }

      try {
        const perms = await api.getCustomPermissions();
        setCustomPermissions(perms);
      } catch (permErr) {
        console.warn("Erro ao obter customPermissions no CommandCenter", permErr);
      }

      try {
        const hierarchy = await api.getHierarchy();
        setHierarchyList(hierarchy || []);
        if (hierarchy && hierarchy.length > 0 && !promRank) {
          const defaultRank = hierarchy.find((h: any) => h.rank !== "SOLDADO");
          if (defaultRank) {
            setPromRank(defaultRank.rank);
          } else {
            setPromRank(hierarchy[0].rank);
          }
        }
        const userConfig = hierarchy.find((rc: any) => rc.rank === user.role);
        
        if (user.role === MilitaryRank.ADMSUPREMO) {
          const supremoPerms = {
            canEnlist: true,
            canPromote: true,
            canTrain: true,
            canManageDocs: true,
            canManageCategories: true,
            canManageMissions: true,
            canAdminSystem: true,
            canViewInstrucoes: true,
            canViewOperacoes: true,
            canViewPostarAulas: true,
            canViewBaterPonto: true,
            canEnterService: true,
            canWarn: true
          };
          setUserPermissions(supremoPerms);
          setIsAdminUser(true);
        } else {
          const perms = userConfig?.permissions || {
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
          };
          setUserPermissions({
            canEnlist: !!perms.canEnlist,
            canPromote: !!perms.canPromote,
            canTrain: !!perms.canTrain,
            canManageDocs: !!perms.canManageDocs,
            canManageCategories: !!perms.canManageCategories,
            canManageMissions: !!perms.canManageMissions,
            canAdminSystem: !!perms.canAdminSystem,
            canViewInstrucoes: !!perms.canViewInstrucoes,
            canViewOperacoes: !!perms.canViewOperacoes,
            canViewPostarAulas: !!perms.canViewPostarAulas,
            canViewBaterPonto: !!perms.canViewBaterPonto,
            canEnterService: perms.canEnterService !== undefined ? !!perms.canEnterService : true,
            canWarn: !!perms.canWarn
          });
          const canAdmin = !!perms.canAdminSystem;
          setIsAdminUser(canAdmin);
        }
      } catch (hierErr) {
        console.warn("Erro ao obter hierarquias de administração:", hierErr);
        setIsAdminUser(user.role === MilitaryRank.ADMSUPREMO);
        if (user.role === MilitaryRank.ADMSUPREMO) {
          setUserPermissions({
            canEnlist: true,
            canPromote: true,
            canTrain: true,
            canManageDocs: true,
            canManageCategories: true,
            canManageMissions: true,
            canAdminSystem: true,
            canViewInstrucoes: true,
            canViewOperacoes: true,
            canViewPostarAulas: true,
            canViewBaterPonto: true,
            canEnterService: true,
            canWarn: true
          });
        } else {
          setUserPermissions({
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
      }
    } catch (err) {
      console.error("Erro ao carregar dados do QG:", err);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 10000); // refresh metadata every 10s
    return () => clearInterval(interval);
  }, []);

  // Time Clock counter execution
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (user.activeState === UserActiveState.EM_SERVICO) {
      // Find relative check-in time by requesting user profile once or local simulation
      // We'll increment every second
      timer = setInterval(() => {
        setServiceTimer(prev => prev + 1);
      }, 1000);
    } else {
      setServiceTimer(0);
    }
    return () => clearInterval(timer);
  }, [user.activeState]);

  // Enforce tab access permissions
  useEffect(() => {
    if (userPermissions) {
      if (activeTab === "instrucoes" && !userPermissions.canViewInstrucoes) {
        setActiveTab("operacional");
      }
      if (activeTab === "missoes" && !userPermissions.canViewOperacoes) {
        setActiveTab("operacional");
      }
      if (activeTab === "postar-aulas" && !userPermissions.canViewPostarAulas) {
        setActiveTab("operacional");
      }
      if (activeTab === "pontes" && !userPermissions.canViewBaterPonto) {
        setActiveTab("operacional");
      }
    }
  }, [activeTab, userPermissions]);

  const handleClockToggle = async () => {
    try {
      if (user.activeState === UserActiveState.EM_SERVICO) {
        const res = await api.clockOut();
        // Update user state
        const updated = { ...user, activeState: UserActiveState.ONLINE };
        onUpdateMe(updated);
        setServiceTimer(0);
      } else {
        if (userPermissions && !userPermissions.canEnterService) {
          alert("Você não possui permissão regulamentar para entrar em serviço.");
          return;
        }
        const res = await api.clockIn();
        const updated = { ...user, activeState: UserActiveState.EM_SERVICO };
        onUpdateMe(updated);
        setServiceTimer(1); // begin counting
      }
      loadDashboardData();
    } catch (err: any) {
      alert(err.message || "Erro operacional ao registrar folha de ponto.");
    }
  };

  const handleApproveEnlistment = async (id: string, nick: string) => {
    setEnlisting(true);
    setEnlistError(null);
    setEnlistSuccess(null);
    try {
      await api.approveEnlistmentRequest(id);
      setEnlistSuccess(`Alistamento de @${nick} aprovado com sucesso!`);
      loadDashboardData();
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
    if (!window.confirm(`Tem certeza de que deseja recusar e remover o alistamento de @${nick}?`)) {
      setEnlisting(false);
      return;
    }
    try {
      await api.rejectEnlistmentRequest(id);
      setEnlistSuccess(`Pedido de @${nick} recusado com sucesso.`);
      loadDashboardData();
    } catch (err: any) {
      setEnlistError(err.message || "Erro ao recusar alistamento.");
    } finally {
      setEnlisting(false);
    }
  };

  const handlePromotionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promTargetNick.trim() || !promReason) {
      setPromError("Digite o nick do militar e insira a justificativa oficial.");
      return;
    }

    setPromoting(true);
    setPromError(null);
    setPromSuccess(null);

    try {
      const targetUser = militars.find(m => m.habboNick.trim().toLowerCase() === promTargetNick.trim().toLowerCase());
      if (!targetUser) {
        throw new Error(`Militar com o nick @${promTargetNick} não foi encontrado no sistema.`);
      }

      await api.updateMilitarRank(targetUser.id, promRank, promReason);
      setPromSuccess(`Promoção/rebaixamento do militar @${targetUser.habboNick} consagrado com sucesso!`);
      setPromReason("");
      setPromTargetNick("");
      loadDashboardData();
    } catch (err: any) {
      setPromError(err.message || "Erro ao processar despacho de promoção.");
    } finally {
      setPromoting(false);
    }
  };

  const handleLogInOutBtn = async () => {
    await api.logout();
    onLogout();
  };

  const canViewInstrutoresOrAman = (() => {
    if (user.role === MilitaryRank.ADMSUPREMO) return true;
    
    const instAllowed = customPermissions.instrutoresViewAllowed || [];
    const amanAllowed = customPermissions.amanViewAllowed || [];
    
    if (instAllowed.length > 0 || amanAllowed.length > 0) {
      const userHasRank = instAllowed.includes(user.role) || amanAllowed.includes(user.role);
      const userHasSubCargo = (user.subCargos || []).some(scId => instAllowed.includes(scId) || amanAllowed.includes(scId));
      return userHasRank || userHasSubCargo;
    }
    
    return (user.subCargos || []).some(scId => {
      const label = scId.toLowerCase();
      return label.includes("instrutor") || label.includes("aman") || label.includes("instructor");
    });
  })();

  const canViewCdm = (() => {
    if (user.role === MilitaryRank.ADMSUPREMO) return true;
    if (userPermissions?.canAdminSystem) return true;
    
    const cdmAllowed = customPermissions.cdmViewAllowed || [];
    if (cdmAllowed.length > 0) {
      const userHasRank = cdmAllowed.includes(user.role);
      const userHasSubCargo = (user.subCargos || []).some(scId => cdmAllowed.includes(scId));
      return userHasRank || userHasSubCargo;
    }
    
    return false;
  })();

  return (
    <div className="min-h-screen bg-fmb-black text-gray-100 flex flex-col font-sans military-grid-coarse">
      
      {/* GLOBAL TELEMETRY HEADER STATUS */}
      <header className="border-b border-fmb-army/30 bg-fmb-slate/90 text-xs px-4 py-3 flex flex-wrap gap-4 items-center justify-between sticky top-0 z-40 backdrop-blur-md shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 flex items-center justify-center">
            <img 
              src={logoImg} 
              alt="FMB Logo" 
              className="w-full h-full object-contain"
              onError={(e) => {
                e.currentTarget.src = "https://images.habbo.com/c_images/album1500/ADM.png";
              }}
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h2 className="font-display font-extrabold text-sm tracking-widest text-white uppercase leading-none">
              FORÇA MILITAR BRASILEIRA • FMB 🇧🇷
            </h2>
            <span className="text-[10px] font-mono text-fmb-gold tracking-widest block uppercase mt-0.5">
              Terminal de Operações de Comando
            </span>
          </div>
        </div>

        {/* User Telemetry Card */}
        <div className="flex items-center space-x-4 ml-auto border-l border-fmb-army/30 pl-4">
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-full bg-fmb-black border border-fmb-army/40 overflow-hidden shrink-0 flex items-center justify-center">
              <img 
                src={`https://www.habbo.com/habbo-imaging/avatarimage?figure=${user.habboAvatar}&size=m&direction=3&head_direction=3&gesture=sml&action=std`} 
                alt={user.habboNick}
                className="scale-125 translate-y-1.5"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="text-left leading-none">
              <span className="font-bold text-white text-xs block">{user.habboNick}</span>
              <span className="text-[9px] font-mono text-fmb-gold uppercase mt-0.5 block font-semibold">{user.role}</span>
            </div>
          </div>

          {/* Active status indicator */}
          <div className="hidden sm:flex flex-col items-start px-3 py-1 bg-fmb-black/50 border border-fmb-army/20 rounded font-mono text-[9px]">
            <span className="text-gray-500">ESTADO ATIVO</span>
            {user.activeState === UserActiveState.EM_SERVICO ? (
              <span className="text-amber-400 font-bold flex items-center">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping mr-1" /> EM SERVIÇO
              </span>
            ) : (
              <span className="text-green-500 font-bold flex items-center">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1" /> ONLINE
              </span>
            )}
          </div>
          
          {/* PONTO SYSTEM CONTROL */}
          {userPermissions?.canViewBaterPonto && (
            <div className="flex items-center space-x-2">
              {user.activeState === UserActiveState.EM_SERVICO && (
                <div className="font-mono text-xs px-2.5 py-1 bg-fmb-dark border border-amber-500/30 text-amber-300 rounded flex items-center font-bold">
                  <Clock className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  <span>
                    {Math.floor(serviceTimer / 3600).toString().padStart(2, "0")}:
                    {Math.floor((serviceTimer % 3600) / 60).toString().padStart(2, "0")}:
                    {(serviceTimer % 60).toString().padStart(2, "0")}
                  </span>
                </div>
              )}

              <button
                onClick={handleClockToggle}
                className={`px-3 py-1.5 rounded transition-all font-mono text-[10px] uppercase tracking-wider font-bold shrink-0 shadow flex items-center space-x-1.5 ${
                  user.activeState === UserActiveState.EM_SERVICO
                    ? "bg-red-700 hover:bg-red-800 text-white border border-red-500/30"
                    : "bg-fmb-army hover:bg-fmb-olive text-white border border-fmb-gold/40 animate-pulse"
                }`}
                id="ponto-clock-btn"
              >
                <Power className="w-3.5 h-3.5" />
                <span>{user.activeState === UserActiveState.EM_SERVICO ? "Encerrar Serviço" : "Entrar em Serviço"}</span>
              </button>
            </div>
          )}

          {/* NOTIFICATION BELL CONTROL */}
          <div className="relative">
            <button
              onClick={handleToggleNotifications}
              className="text-gray-400 hover:text-white p-1.5 hover:bg-fmb-slate/60 rounded relative cursor-pointer"
              title="Central de Alertas e Despachos"
            >
              <Bell className="w-5 h-5 text-fmb-gold hover:scale-105 transition-transform" />
              {notifications.some(n => !n.read) && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse border border-fmb-black" />
              )}
            </button>

            {/* Notifications Popover */}
            <AnimatePresence>
              {showNotifMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 mt-2 w-72 bg-fmb-black border border-fmb-gold/40 rounded shadow-2xl p-3 z-50 text-left font-mono"
                >
                  <div className="flex justify-between items-center border-b border-fmb-army/30 pb-2 mb-2">
                    <span className="text-[9px] text-fmb-gold uppercase font-bold tracking-wider">Alertas & Despachos Oficiais</span>
                    <button
                      onClick={() => setShowNotifMenu(false)}
                      className="text-[8px] text-gray-500 hover:text-white uppercase font-bold"
                    >
                      Fechar
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {notifications.length === 0 ? (
                      <p className="text-[9px] text-gray-500 italic text-center py-4">Sem notificações militares registradas.</p>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          className={`p-2 rounded text-[9px] border transition-colors ${
                            n.read 
                              ? "bg-fmb-slate/10 border-fmb-army/10 text-gray-400" 
                              : "bg-fmb-slate/30 border-fmb-gold/30 text-white"
                          }`}
                        >
                          <div className="flex justify-between items-center font-bold mb-1">
                            <span className="text-fmb-gold uppercase truncate max-w-[150px]">{n.title}</span>
                            <span className="text-[7.5px] text-gray-500">{new Date(n.createdAt).toLocaleDateString("pt-BR")}</span>
                          </div>
                          <p className="leading-tight break-words">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={handleLogInOutBtn}
            className="text-gray-400 hover:text-white p-1 hover:bg-fmb-slate/60 rounded"
            title="Desconectar do Terminal"
            id="header-logout-btn"
          >
            <LogOut className="w-5 h-5 text-red-400 hover:scale-105 transition-transform" />
          </button>
        </div>
      </header>

      {/* DASHBOARD STRUCTURE WITH PERSISTENT SIDEBAR */}
      <div className="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto p-4 md:p-6 gap-6">
        
        {/* SIDEBAR TACTICAL NAV */}
        <aside className="w-full md:w-64 shrink-0 flex flex-col gap-2">
          
          <div className="p-4 bg-fmb-slate/40 border border-fmb-army/20 rounded-lg select-none text-center">
            <span className="text-[10px] font-mono text-gray-500 block uppercase tracking-widest">PATTRIA E HONRA</span>
            <div className="font-display font-black text-xs text-white uppercase tracking-widest mt-1">
              BRASIL ACIMA DE TUDO! 🇧🇷
            </div>
          </div>

          <div className="bg-fmb-black/80 border border-fmb-army/30 rounded-lg p-2.5 space-y-1">
            <button
              onClick={() => { setActiveTab("operacional"); setSelectedMilitarId(null); }}
              className={`w-full text-left px-3 py-2.5 rounded transition-all font-mono text-[11px] uppercase tracking-wider flex items-center space-x-2.5 ${
                activeTab === "operacional" && !selectedMilitarId
                  ? "bg-fmb-army text-white font-bold border-l-4 border-fmb-gold shadow-md"
                  : "text-gray-300 hover:bg-fmb-slate/60"
              }`}
              id="sidebar-operacional-btn"
            >
              <Activity className="w-4 h-4 text-fmb-gold shrink-0" />
              <span>Central Operacional</span>
            </button>

            <button
              onClick={() => { setActiveTab("militares"); setSelectedMilitarId(null); }}
              className={`w-full text-left px-3 py-2.5 rounded transition-all font-mono text-[11px] uppercase tracking-wider flex items-center space-x-2.5 ${
                activeTab === "militares" && !selectedMilitarId
                  ? "bg-fmb-army text-white font-bold border-l-4 border-fmb-gold shadow-md"
                  : "text-gray-300 hover:bg-fmb-slate/60"
              }`}
              id="sidebar-militares-btn"
            >
              <Users className="w-4 h-4 text-fmb-gold shrink-0" />
              <span>Efetivo Militar</span>
            </button>

            {userPermissions?.canViewInstrucoes && (
              <button
                onClick={() => { setActiveTab("instrucoes"); setSelectedMilitarId(null); }}
                className={`w-full text-left px-3 py-2.5 rounded transition-all font-mono text-[11px] uppercase tracking-wider flex items-center space-x-2.5 ${
                  activeTab === "instrucoes" && !selectedMilitarId
                    ? "bg-fmb-army text-white font-bold border-l-4 border-fmb-gold shadow-md"
                    : "text-gray-300 hover:bg-fmb-slate/60"
                }`}
                id="sidebar-instrucoes-btn"
              >
                <GraduationCap className="w-4 h-4 text-fmb-gold shrink-0" />
                <span>Instruções de Treino</span>
              </button>
            )}

            {userPermissions?.canViewOperacoes && (
              <button
                onClick={() => { setActiveTab("missoes"); setSelectedMilitarId(null); }}
                className={`w-full text-left px-3 py-2.5 rounded transition-all font-mono text-[11px] uppercase tracking-wider flex items-center space-x-2.5 ${
                  activeTab === "missoes" && !selectedMilitarId
                    ? "bg-fmb-army text-white font-bold border-l-4 border-fmb-gold shadow-md"
                    : "text-gray-300 hover:bg-fmb-slate/60"
                }`}
                id="sidebar-missoes-btn"
              >
                <Award className="w-4 h-4 text-fmb-gold shrink-0" />
                <span>Operações & Missões</span>
              </button>
            )}

            <button
              onClick={() => { setActiveTab("documentos"); setSelectedMilitarId(null); }}
              className={`w-full text-left px-3 py-2.5 rounded transition-all font-mono text-[11px] uppercase tracking-wider flex items-center space-x-2.5 ${
                activeTab === "documentos" && !selectedMilitarId
                  ? "bg-fmb-army text-white font-bold border-l-4 border-fmb-gold shadow-md"
                  : "text-gray-300 hover:bg-fmb-slate/60"
              }`}
              id="sidebar-documentos-btn"
            >
              <BookOpen className="w-4 h-4 text-fmb-gold shrink-0" />
              <span>Documentos</span>
            </button>

            {canViewInstrutoresOrAman && (
              <button
                onClick={() => { setActiveTab("instrutores"); setSelectedMilitarId(null); }}
                className={`w-full text-left px-3 py-2.5 rounded transition-all font-mono text-[11px] uppercase tracking-wider flex items-center space-x-2.5 ${
                  activeTab === "instrutores" && !selectedMilitarId
                    ? "bg-fmb-army text-white font-bold border-l-4 border-fmb-gold shadow-md"
                    : "text-gray-300 hover:bg-fmb-slate/60"
                }`}
                id="sidebar-instrutores-btn"
              >
                <GraduationCap className="w-4 h-4 text-fmb-gold shrink-0" />
                <span>INSTRUTORES, AMAN & EsAO</span>
              </button>
            )}

            {canViewCdm && (
              <button
                onClick={() => { setActiveTab("cdm"); setSelectedMilitarId(null); }}
                className={`w-full text-left px-3 py-2.5 rounded transition-all font-mono text-[11px] uppercase tracking-wider flex items-center space-x-2.5 ${
                  activeTab === "cdm" && !selectedMilitarId
                    ? "bg-fmb-army text-white font-bold border-l-4 border-fmb-gold shadow-md"
                    : "text-gray-300 hover:bg-fmb-slate/60"
                }`}
                id="sidebar-cdm-btn"
              >
                <Shield className="w-4 h-4 text-fmb-gold shrink-0" />
                <span>Central CDM</span>
              </button>
            )}

            {userPermissions?.canViewPostarAulas && (
              <button
                onClick={() => { setActiveTab("postar-aulas"); setSelectedMilitarId(null); }}
                className={`w-full text-left px-3 py-2.5 rounded transition-all font-mono text-[11px] uppercase tracking-wider flex items-center space-x-2.5 ${
                  activeTab === "postar-aulas" && !selectedMilitarId
                    ? "bg-fmb-army text-white font-bold border-l-4 border-fmb-gold shadow-md"
                    : "text-gray-300 hover:bg-fmb-slate/60"
                }`}
                id="sidebar-postar-aulas-btn"
              >
                <ClipboardCheck className="w-4 h-4 text-fmb-gold shrink-0" />
                <span>Postar Aulas (Recrutas)</span>
              </button>
            )}

            {userPermissions?.canViewBaterPonto && (
              <button
                onClick={() => { setActiveTab("pontes"); setSelectedMilitarId(null); }}
                className={`w-full text-left px-3 py-2.5 rounded transition-all font-mono text-[11px] uppercase tracking-wider flex items-center space-x-2.5 ${
                  activeTab === "pontes" && !selectedMilitarId
                    ? "bg-fmb-army text-white font-bold border-l-4 border-fmb-gold shadow-md"
                    : "text-gray-300 hover:bg-fmb-slate/60"
                }`}
                id="sidebar-pontes-btn"
              >
                <Clock className="w-4 h-4 text-fmb-gold shrink-0" />
                <span>Bater Pontos</span>
              </button>
            )}

            {(user.role === MilitaryRank.ADMSUPREMO || user.subCargos?.some(scId => scId.toLowerCase().includes("jornal") || allSubCargos.find(x => x.id === scId)?.label.toLowerCase().includes("jornal"))) && (
              <button
                onClick={() => { setActiveTab("jornal"); setSelectedMilitarId(null); }}
                className={`w-full text-left px-3 py-2.5 rounded transition-all font-mono text-[11px] uppercase tracking-wider flex items-center space-x-2.5 ${
                  activeTab === "jornal" && !selectedMilitarId
                    ? "bg-fmb-army text-white font-bold border-l-4 border-fmb-gold shadow-md"
                    : "text-gray-300 hover:bg-fmb-slate/60"
                }`}
                id="sidebar-jornal-btn"
              >
                <Newspaper className="w-4 h-4 text-fmb-gold shrink-0" />
                <span>Redação do Jornal</span>
              </button>
            )}

            <button
              onClick={() => {
                if (isAdminUser) {
                  setActiveTab("admin");
                  setSelectedMilitarId(null);
                } else {
                  alert("Acesso exclusivo reservado ao Alto Comando com privilégios administrativos.");
                }
              }}
              className={`w-full text-left px-3 py-2.5 rounded transition-all font-mono text-[11px] uppercase tracking-wider flex items-center space-x-2.5 ${
                activeTab === "admin" && !selectedMilitarId
                  ? "bg-fmb-army text-white font-bold border-l-4 border-fmb-gold shadow-md"
                  : "text-gray-300 hover:bg-fmb-slate/60"
              }`}
              id="sidebar-admin-btn"
            >
              <Settings className="w-4 h-4 text-fmb-gold shrink-0" />
              <span>Administração Geral</span>
              {!isAdminUser && (
                <Lock className="w-3 h-3 text-gray-500 ml-auto" />
              )}
            </button>
          </div>
        </aside>

        {/* MAIN PANEL CONTENT BOX */}
        <main className="flex-1 bg-fmb-black/80 border border-fmb-army/30 rounded-lg p-5 shadow-xl min-w-0">
          
          {/* PROFILE VIEW OVERLAY DIRECTIVE */}
          {selectedMilitarId ? (
            <UserProfile 
              militarId={selectedMilitarId} 
              onClose={() => setSelectedMilitarId(null)}
              viewer={user}
            />
          ) : (
            <AnimatePresence mode="wait">
              
              {/* TAB 1: CENTRAL OPERACIONAL (DASHBOARD) */}
              {activeTab === "operacional" && (
                <motion.div
                  key="operacional-view"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-fmb-army/20 gap-3">
                    <div className="flex items-center space-x-2">
                      <Activity className="w-5 h-5 text-fmb-gold" />
                      <h3 className="font-display font-bold text-lg text-white uppercase tracking-tight">Central de Inteligência Operacional</h3>
                    </div>
                    {/* Sub-tabs Selector */}
                    <div className="flex p-0.5 bg-fmb-black/55 border border-fmb-army/25 rounded gap-1 self-start sm:self-auto font-mono text-[10px]">
                      <button
                        type="button"
                        onClick={() => setOperacionalSubTab("status")}
                        className={`px-3 py-1.5 rounded transition-all cursor-pointer font-bold uppercase ${
                          operacionalSubTab === "status"
                            ? "bg-fmb-army text-white font-bold border border-fmb-gold/25"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        Painel de Controle
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOperacionalSubTab("advertencias");
                          fetchWarningLogs();
                        }}
                        className={`px-3 py-1.5 rounded transition-all cursor-pointer font-bold uppercase flex items-center space-x-1.5 ${
                          operacionalSubTab === "advertencias"
                            ? "bg-red-950/45 text-red-400 border border-red-500/35"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500 animate-pulse shrink-0" />
                        <span>Aba de Advertências</span>
                      </button>
                    </div>
                  </div>

                  {operacionalSubTab === "status" ? (
                    <>
                      {/* Operational Counters Grid */}
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="bg-fmb-slate/60 border border-fmb-army/30 p-4 rounded text-center">
                          <span className="text-[10px] font-mono text-gray-400 block uppercase tracking-widest">FORÇA ONLINE</span>
                          <span className="font-mono text-3xl font-extrabold text-white block mt-1">{stats.online}</span>
                          <span className="text-[9px] font-mono text-green-400 mt-1 block">CONEXÃO IP ATIVA</span>
                        </div>

                        <div className="bg-fmb-slate/60 border border-fmb-army/30 p-4 rounded text-center">
                          <span className="text-[10px] font-mono text-gray-400 block uppercase tracking-widest">MILITARES EM SERVIÇO</span>
                          <span className="font-mono text-3xl font-extrabold text-amber-400 block mt-1">{stats.emServico}</span>
                          <span className="text-[9px] font-mono text-amber-500 mt-1 block">EFETIVO ATIVO NESSE INSTANTE</span>
                        </div>

                        <div className="bg-fmb-slate/60 border border-fmb-army/30 p-4 rounded text-center col-span-2 lg:col-span-1">
                          <span className="text-[10px] font-mono text-gray-400 block uppercase tracking-widest">HORAS DE COMBATE</span>
                          <span className="font-mono text-3xl font-extrabold text-fmb-gold block mt-1">{stats.totalHoursActivity} hs</span>
                          <span className="text-[9px] font-mono text-gray-500 mt-1 block">EFETIVO ACUMULADO</span>
                        </div>
                      </div>

                      {/* QUICK COMBAT CONTROL ROOM (PROMOTION DESK) */}
                      {(user.role === MilitaryRank.ADMSUPREMO || userPermissions?.canPromote) && (
                        <div className="mt-6 pt-2">
                          {/* PROMOTION DESK */}
                          <div className="bg-fmb-black/95 border border-fmb-army/30 p-5 rounded-lg relative">
                            <div className="absolute top-0 right-0 p-2 bg-fmb-army/10 text-fmb-gold">
                              <Award className="w-5 h-5" />
                            </div>
                            <h4 className="font-display font-bold text-sm text-white uppercase tracking-wider mb-4 border-b border-fmb-army/20 pb-2">
                              Despacho de Promoções & Cargos
                            </h4>

                            {promSuccess && (
                              <div className="mb-4 p-2.5 border border-green-500/30 bg-green-950/20 text-green-300 text-xs rounded">
                                {promSuccess}
                              </div>
                            )}
                            {promError && (
                              <div className="mb-4 p-2.5 border border-red-500/30 bg-red-950/20 text-red-300 text-xs rounded">
                                {promError}
                              </div>
                            )}

                            <form onSubmit={handlePromotionSubmit} className="space-y-3 font-mono text-xs text-left">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[10px] uppercase text-fmb-gold block mb-1">Nick do Militar</label>
                                  <input
                                    type="text"
                                    value={promTargetNick}
                                    onChange={(e) => setPromTargetNick(e.target.value)}
                                    placeholder="Digite o nick do militar..."
                                    className="w-full bg-fmb-slate border border-fmb-army/30 focus:border-fmb-gold py-1.5 px-2 rounded text-white outline-none"
                                    required
                                  />
                                </div>

                                <div>
                                  <label className="text-[10px] uppercase text-fmb-gold block mb-1">Destino Militar</label>
                                  <select
                                    value={promRank}
                                    onChange={(e) => setPromRank(e.target.value)}
                                    className="w-full bg-fmb-slate border border-fmb-army/30 focus:border-fmb-gold py-1.5 px-2 rounded text-white outline-none cursor-pointer font-bold"
                                  >
                                    {hierarchyList.map(h => (
                                      <option key={h.rank} value={h.rank}>
                                        {h.label} ({h.rank})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div>
                                <label className="text-[10px] uppercase text-fmb-gold block mb-1">Justificativa Oficial de Decreto</label>
                                <textarea
                                  placeholder="Descreva detalhadamente o desempenho e a razão militar para este despacho..."
                                  rows={2}
                                  value={promReason}
                                  onChange={(e) => setPromReason(e.target.value)}
                                  className="w-full bg-fmb-slate border border-fmb-army/30 focus:border-fmb-gold py-1.5 px-2 rounded text-white outline-none resize-none"
                                  required
                                />
                              </div>

                              <button
                                type="submit"
                                disabled={promoting}
                                className="w-full bg-fmb-army hover:bg-fmb-olive border border-fmb-gold/40 hover:border-gold py-2 text-white font-bold rounded text-xs uppercase tracking-wider transition-colors"
                              >
                                {promoting ? "DESPACHANDO..." : "Consagrar Despacho"}
                              </button>
                            </form>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    /* SUBTAB: ADVERTENCIAS */
                    <div className="space-y-4">
                      <div className="bg-fmb-slate/20 border border-fmb-army/15 rounded p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
                        <div>
                          <h4 className="text-sm font-sans font-black uppercase text-red-400 tracking-wider flex items-center space-x-1.5">
                            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                            <span>Mural Disciplinar Militar (CDM)</span>
                          </h4>
                          <p className="text-[10px] text-gray-400 font-mono mt-1">
                            Histórico consolidado de todas as advertências aplicadas e revogadas pela Central de Despachos Militares.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={fetchWarningLogs}
                          disabled={loadingWarnings}
                          className="px-3 py-1.5 bg-fmb-army hover:bg-fmb-olive disabled:opacity-50 text-white font-mono text-[10px] uppercase font-bold rounded border border-fmb-gold/30 flex items-center space-x-1.5 cursor-pointer"
                        >
                          <svg className={`w-3.5 h-3.5 ${loadingWarnings ? "animate-spin text-fmb-gold" : "text-white"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                          </svg>
                          <span>Sincronizar Logs</span>
                        </button>
                      </div>

                      {warningsError && (
                        <div className="p-3 bg-red-950/25 border border-red-500/35 text-red-300 rounded font-mono text-xs text-left">
                          {warningsError}
                        </div>
                      )}

                      <div className="bg-fmb-black/35 border border-fmb-army/20 rounded overflow-hidden">
                        <div className="bg-fmb-slate/35 px-4 py-2 flex items-center justify-between border-b border-fmb-army/15 border-t border-t-fmb-army/10">
                          <span className="text-[10px] font-mono text-fmb-gold uppercase tracking-wider font-bold">Transmissões de Auditoria Disciplinar</span>
                          <span className="text-[9px] font-mono text-gray-500 font-black">
                            {warningLogs.length} registros de advertência
                          </span>
                        </div>

                        {loadingWarnings ? (
                          <div className="p-12 text-center text-gray-400 flex flex-col items-center space-y-2">
                            <svg className="w-8 h-8 text-fmb-gold animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                            </svg>
                            <span className="text-xs font-mono uppercase tracking-widest text-fmb-gold/80">Reconstruindo canais de auditoria...</span>
                          </div>
                        ) : warningLogs.length === 0 ? (
                          <div className="p-12 text-center text-gray-500 font-mono text-xs">
                            Nenhuma advertência ativa ou histórica localizada no banco de dados.
                          </div>
                        ) : (
                          <div className="divide-y divide-fmb-army/10 max-h-[450px] overflow-y-auto scrollbar-thin">
                            {warningLogs.map((log: any) => {
                              const cleanedNick = log.userNick.replace(/^@/, "").trim();
                              const avatarHeadUrl = `https://www.habbo.com.br/habbo-imaging/avatarimage?img_format=png&user=${encodeURIComponent(cleanedNick)}&direction=2&head_direction=2&gesture=std&size=s&headonly=1`;
                              
                              const isRemove = log.action.toUpperCase().includes("REMOVER") || log.action.toUpperCase().includes("ABONAR");

                              return (
                                <div
                                  key={log.id}
                                  className={`p-3.5 hover:bg-fmb-slate/10 transition-colors flex items-start space-x-3 text-left border-l-2 ${
                                    isRemove ? "border-l-green-500 bg-green-500/5" : "border-l-red-500 bg-red-500/5"
                                  }`}
                                >
                                  {/* Habbo Face Avatar */}
                                  <div className="w-8 h-8 rounded-full border border-fmb-army/30 bg-fmb-slate flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                                    <img
                                      src={avatarHeadUrl}
                                      alt={log.userNick}
                                      className="w-8 h-8 scale-110 object-center mt-1"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>

                                  <div className="flex-1 font-mono text-[11px] leading-snug space-y-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="text-white font-black">@{log.userNick}</span>
                                      <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-black border ${
                                        isRemove 
                                          ? "text-green-400 bg-green-500/15 border-green-500/25" 
                                          : "text-red-400 bg-red-500/15 border-red-500/25"
                                      }`}>
                                        {isRemove ? "Abono Disciplinar" : "Advertência Militar"}
                                      </span>
                                    </div>
                                    <p className="text-gray-300 leading-normal">{log.details}</p>
                                    <div className="flex items-center space-x-2 text-[9px] text-gray-500 pt-0.5">
                                      <span>{new Date(log.timestamp).toLocaleDateString("pt-BR")} às {new Date(log.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </motion.div>
              )}

              {/* TAB 2: EFETIVO MILITAR LIST (PROFILES SEARCH) */}
              {activeTab === "militares" && (
                <motion.div
                  key="militares-view"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <div className="flex items-center space-x-2 pb-3 border-b border-fmb-army/20">
                    <Users className="w-5 h-5 text-fmb-gold" />
                    <h3 className="font-display font-bold text-lg text-white uppercase tracking-tight">Efetivo de Oficiais e Praças</h3>
                  </div>

                  <p className="text-xs text-gray-400">
                     Selecione um soldado da Força Militar Brasileira para visualizar sua ficha de cadastro militar integral, conquistas, medalhas e folha de serviço.
                  </p>

                  {/* FILTRO RAPIDO DE PESQUISA */}
                  <div className="bg-fmb-slate/30 border border-fmb-army/30 p-4 rounded-lg font-mono text-xs text-left flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="bg-fmb-army/20 p-2 border border-fmb-gold/30 rounded">
                        <Users className="w-4 h-4 text-fmb-gold" />
                      </div>
                      <div>
                        <h4 className="text-white uppercase text-[11px] font-bold tracking-wider">Filtro Rápido de Patrulha / Efetivo</h4>
                        <span className="text-[9px] text-gray-400 block leading-tight">Busque por qualquer Habbo Nick ou Patente Militar no efetivo</span>
                      </div>
                    </div>
                    <div className="relative w-full md:w-80">
                      <span className="absolute left-3 top-2.5 text-fmb-gold font-bold">@</span>
                      <input
                        type="text"
                        placeholder="Pesquisar militar por nick ou patente..."
                        value={militarsSearch}
                        onChange={(e) => setMilitarsSearch(e.target.value)}
                        className="w-full bg-fmb-black/80 border border-fmb-army/45 focus:border-fmb-gold rounded py-2 pl-7 pr-8 text-white font-mono text-[11px] outline-none transition-all placeholder:text-gray-650 shadow-inner"
                      />
                      {militarsSearch && (
                        <button
                          onClick={() => setMilitarsSearch("")}
                          className="absolute right-3 top-2.5 text-gray-400 hover:text-white font-bold text-xs cursor-pointer transition-colors"
                          title="Limpar filtro"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {militars
                      .filter(m => {
                        if (!militarsSearch.trim()) return true;
                        const query = militarsSearch.toLowerCase().trim();
                        return (
                          m.habboNick.toLowerCase().includes(query) ||
                          m.role.toLowerCase().includes(query)
                        );
                      })
                      .map(m => {
                        let activeIndicator = "border-gray-800 bg-gray-500";
                        if (m.activeState === UserActiveState.ONLINE) activeIndicator = "border-green-500 bg-green-500";
                        if (m.activeState === UserActiveState.EM_SERVICO) activeIndicator = "border-amber-400 bg-amber-400";

                        return (
                          <div 
                            key={m.id}
                            onClick={() => setSelectedMilitarId(m.id)}
                            className="bg-fmb-slate/40 border border-fmb-army/30 hover:border-fmb-gold/40 p-4 rounded-lg flex items-center justify-between cursor-pointer group transition-all"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="relative">
                                <div className="w-12 h-12 rounded-full bg-fmb-black border border-fmb-army/30 overflow-hidden flex items-center justify-center shrink-0">
                                  <img 
                                    src={`https://www.habbo.com/habbo-imaging/avatarimage?figure=${m.habboAvatar}&size=m&direction=3&head_direction=3&gesture=sml&action=std`} 
                                    alt={m.habboNick}
                                    className="scale-125 translate-y-2 group-hover:scale-135 transition-transform"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                                <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 ${activeIndicator}`} />
                              </div>

                              <div className="text-left font-mono leading-tight">
                                <span className="font-bold text-white text-xs block group-hover:text-fmb-gold transition-colors">@{m.habboNick}</span>
                                <span className="text-[10px] text-fmb-gold mt-1 block font-semibold">{m.role}</span>
                                
                                {m.subCargos && m.subCargos.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1 max-w-[180px]">
                                    {allSubCargos
                                      .filter(sc => m.subCargos?.includes(sc.id))
                                      .slice(0, 2) // Limit to 2 items in grid view to keep layout beautiful
                                      .map(sc => (
                                        <span 
                                          key={sc.id} 
                                          className="text-[8px] bg-amber-500/10 text-amber-300 border border-amber-500/25 px-1 py-0.2 rounded font-semibold uppercase block"
                                          title={sc.description}
                                        >
                                          {sc.label}
                                        </span>
                                      ))}
                                    {m.subCargos.length > 2 && (
                                      <span className="text-[8px] text-gray-400 font-mono">+ {m.subCargos.length - 2}</span>
                                    )}
                                  </div>
                                )}
                                
                                {m.status === UserStatus.BANIDO && (
                                  <span className="text-[8px] bg-red-950 text-red-200 border border-red-500/20 px-1.5 py-0.5 rounded mt-1.5 inline-block uppercase">BANIDO</span>
                                )}
                                {m.status === UserStatus.SUSPENSO && (
                                  <span className="text-[8px] bg-amber-950 text-amber-200 border border-amber-500/20 px-1.5 py-0.5 rounded mt-1.5 inline-block uppercase">SUSPENSO</span>
                                )}
                              </div>
                            </div>

                            <ChevronRight className="w-5 h-5 text-gray-500 group-hover:translate-x-1 transition-transform" />
                          </div>
                        );
                      })}
                  </div>
                </motion.div>
              )}

              {/* TAB 3: COMPANHIA DE INSTRUÇÃO (TREINAMENTOS) */}
              {activeTab === "instrucoes" && (
                <TrainingsPanel viewer={user} onRefreshStats={loadDashboardData} />
              )}

              {/* TAB 4: MISSÕES */}
              {activeTab === "missoes" && (
                <MissionsPanel viewer={user} />
              )}

              {/* TAB 4.5: DOCUMENTS */}
              {activeTab === "documentos" && (
                <DocumentsPanel viewer={user} />
              )}

              {/* TAB 4.5.1: INSTRUTORES & AMAN */}
              {activeTab === "instrutores" && (
                <InstructorsPanel viewer={user} />
              )}

              {/* TAB 4.6: RECRUIT LESSONS (POSTAR AULAS) */}
              {activeTab === "postar-aulas" && (
                <RecruitLessonsPanel user={user} />
              )}

              {/* TAB 4.7: BATER PONTOS */}
              {activeTab === "pontes" && (
                <PontoPanel viewer={user} />
              )}

              {/* TAB 4.8: JORNAL / NOTICIAS DO QG */}
              {activeTab === "jornal" && (
                <JournalPanel user={user} />
              )}

              {/* TAB 4.9: CENTRAL CDM */}
              {activeTab === "cdm" && (
                <CdmPanel viewer={user} />
              )}

              {/* TAB 5: ADMIN CONTROLS DESIGN */}
              {activeTab === "admin" && (
                <AdminPanel 
                  viewer={user} 
                  militarsList={militars}
                  onRefreshDashboard={loadDashboardData}
                />
              )}

            </AnimatePresence>
          )}

        </main>
      </div>
    </div>
  );
}
