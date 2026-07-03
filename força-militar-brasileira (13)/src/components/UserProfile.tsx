import React, { useEffect, useState } from "react";
import { 
  ArrowLeft, Calendar, Clock, GraduationCap, Award, Shield, UserX, 
  UserCheck, AlertTriangle, Medal, Timer, Target, CheckCircle2,
  RefreshCw, Bell, Send, Copy
} from "lucide-react";
import { motion } from "motion/react";
import { api } from "../lib/api.js";
import { User, Promotion, Training, PontoLog, LIST_OF_MEDALS, RecruitLesson, SubCargo, MilitaryRank } from "../types.js";

interface UserProfileProps {
  militarId: string;
  onClose: () => void;
  viewer: User;
}

export default function UserProfile({ militarId, onClose, viewer }: UserProfileProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [profile, setProfile] = useState<User | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [pontes, setPontes] = useState<PontoLog[]>([]);
  const [recruitLessons, setRecruitLessons] = useState<RecruitLesson[]>([]);
  const [allSubCargos, setAllSubCargos] = useState<SubCargo[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [hierarchyList, setHierarchyList] = useState<any[]>([]);
  
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMsg, setNotifMsg] = useState("");
  const [sendingNotif, setSendingNotif] = useState(false);

  // Warnings form states
  const [warnReason, setWarnReason] = useState("");
  const [submittingWarn, setSubmittingWarn] = useState(false);
  const [warnSuccess, setWarnSuccess] = useState<string | null>(null);
  const [warnError, setWarnError] = useState<string | null>(null);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await api.getUserById(militarId);
      setProfile(data.user);
      setPromotions(data.promotions || []);
      setTrainings(data.trainings || []);
      setPontes(data.pontes || []);
      setRecruitLessons(data.recruitLessons || []);
      
      try {
        const scs = await api.getSubCargos();
        setAllSubCargos(scs || []);
      } catch (scErr) {
        console.error("Erro ao carregar subcargos no perfil", scErr);
      }

      try {
        const hierarchy = await api.getHierarchy();
        setHierarchyList(hierarchy || []);
      } catch (hErr) {
        console.error("Erro ao carregar hierarquia no perfil", hErr);
      }

      try {
        const notifs = await api.getUserNotifications(militarId);
        setNotifications(notifs || []);
      } catch (notifErr) {
        console.error("Erro ao carregar notificações no perfil", notifErr);
      }
    } catch (err: any) {
      setError(err.message || "Erro ao obter ficha militar.");
    } finally {
      setLoading(false);
    }
  };

  const [syncing, setSyncing] = useState(false);

  const handleSyncHabbo = async () => {
    if (!profile) return;
    setSyncing(true);
    try {
      const updatedUser = await api.syncUserHabboProfile(profile.id);
      setProfile(updatedUser);
    } catch (err: any) {
      alert("Erro ao sincronizar dados da farda FMB: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [militarId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <span className="inline-block animate-spin border-4 border-fmb-gold border-t-transparent w-8 h-8 rounded-full" />
        <p className="text-xs font-mono text-gray-400">CARREGANDO ARQUIVO DE IDENTIFICAÇÃO CONFIDENCIAL...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-4 border border-red-500/20 bg-red-950/20 rounded text-center">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-sm font-mono text-red-200">{error || "Não foi possível resgatar o arquivo militar."}</p>
        <button onClick={onClose} className="mt-4 text-xs font-mono text-fmb-gold hover:underline">Voltar ao QG</button>
      </div>
    );
  }

  // Calculate worked hours
  const hoursWorked = (profile.totalServiceSeconds / 3600).toFixed(1);

  const hasWarnPermission = (() => {
    if (viewer.role === MilitaryRank.ADMSUPREMO) return true;
    
    // Check viewer's rank config permissions
    const viewerRankConfig = hierarchyList.find(x => x.rank === viewer.role);
    if (viewerRankConfig?.permissions?.canWarn || viewerRankConfig?.permissions?.canAdminSystem) return true;
    
    // Check viewer's subcargo permissions
    const hasSubCargoPerm = (viewer.subCargos || []).some(scId => {
      const scObj = allSubCargos.find(x => x.id === scId);
      return scObj?.permissions?.canWarn || scObj?.permissions?.canAdminSystem;
    });
    return hasSubCargoPerm;
  })();

  // Compute daily, weekly, and monthly hours worked from pontes logs
  const getHoursInPeriod = (daysCount: number) => {
    const cutOff = Date.now() - daysCount * 24 * 60 * 60 * 1000;
    const totalSeconds = pontes
      .filter(p => {
        const time = new Date(p.checkInTime).getTime();
        return time >= cutOff;
      })
      .reduce((sum, p) => {
        let sec = p.durationSeconds;
        if (!p.checkOutTime) {
          // If checkOutTime is null (meaning user is currently clocked in right now),
          // dynamically compute elapsed time from checkInTime to NOW so hours update live!
          sec = Math.max(0, Math.floor((Date.now() - new Date(p.checkInTime).getTime()) / 1000));
        }
        return sum + sec;
      }, 0);
    return (totalSeconds / 3600).toFixed(1);
  };

  const dailyHours = getHoursInPeriod(1);
  const weeklyHours = getHoursInPeriod(7);
  const monthlyHours = getHoursInPeriod(30);

  return (
    <div className="space-y-6">
      {/* Return Header */}
      <div className="flex items-center justify-between pb-3 border-b border-fmb-army/20">
        <button 
          onClick={onClose}
          className="flex items-center text-xs font-mono uppercase text-gray-400 hover:text-fmb-gold transition-colors space-x-1.5"
          id="profile-back-btn"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Efetivo militar</span>
        </button>
        <span className="text-[9px] font-mono text-fmb-gold uppercase tracking-widest bg-fmb-slate px-2 py-0.5 border border-fmb-army/20">
          DOC militar Nº {profile.id.toUpperCase()}
        </span>
      </div>

      {/* Profile Header Details card */}
      <div className="bg-fmb-slate/40 border border-fmb-army/30 rounded-lg p-6 relative overflow-hidden">
        {/* Overhead tactical scanline container */}
        <div className="absolute top-0 right-0 p-4 bg-fmb-army/5 rounded">
          <Shield className="w-16 h-16 text-fmb-army/10 shrink-0 select-none" />
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6 relative">
          <div className="relative shrink-0">
            <div className="w-24 h-24 rounded-full bg-fmb-black border border-fmb-army/45 overflow-hidden flex items-center justify-center shadow-lg">
              <img 
                src={`https://www.habbo.com/habbo-imaging/avatarimage?figure=${profile.habboAvatar}&size=l&direction=3&head_direction=3&gesture=sml&action=std`} 
                alt={profile.habboNick}
                className="scale-125 translate-y-3"
                referrerPolicy="no-referrer"
              />
            </div>
            {profile.activeState === "Em Serviço" && (
              <span className="absolute bottom-0 right-1 px-2 py-0.5 bg-amber-500 text-fmb-black text-[8px] font-mono font-black uppercase rounded border border-fmb-black animate-pulse">
                SERVIÇO
              </span>
            )}
          </div>

          <div className="text-center sm:text-left leading-tight space-y-2">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <h3 className="font-display font-black text-2xl text-white">@{profile.habboNick}</h3>
                <button
                  onClick={handleSyncHabbo}
                  disabled={syncing}
                  className={`px-2 py-1 rounded bg-fmb-slate/80 text-[9px] uppercase font-mono tracking-widest border border-fmb-army/30 hover:bg-fmb-army hover:text-white transition-all flex items-center gap-1.5 ${
                    syncing ? "opacity-50 pointer-events-none" : ""
                  }`}
                  id="militar-sync-habbo-btn"
                  title="Puxar visual farda, farda do exército e missão atualizado do habbo.com.br"
                >
                  <RefreshCw className={`w-3 h-3 text-fmb-gold ${syncing ? "animate-spin" : ""}`} />
                  <span>{syncing ? "Sincronizando..." : "Sincronizar Habbo BR"}</span>
                </button>
              </div>
              <p className="text-xs text-fmb-gold font-mono uppercase tracking-widest font-bold mt-1">{profile.role}</p>
              
              {/* WARNINGS BADGE */}
              <div className="flex items-center gap-1.5 mt-1.5 text-xs font-mono justify-center sm:justify-start">
                <AlertTriangle className={`w-3.5 h-3.5 ${profile.warnings && profile.warnings > 0 ? "text-red-500 animate-pulse" : "text-gray-500"}`} />
                <span className="text-gray-400 text-[10px] uppercase">ADVERTÊNCIA(S): </span>
                <span className={`font-black uppercase px-2 py-0.5 rounded text-[10px] ${
                  profile.warnings === 1 ? "bg-amber-500/15 text-amber-400 border border-amber-500/35" :
                  profile.warnings === 2 ? "bg-orange-500/20 text-orange-400 border border-orange-500/40" :
                  profile.warnings && profile.warnings >= 3 ? "bg-red-500/25 text-red-400 border border-red-500/50 animate-pulse" :
                  "bg-gray-500/10 text-gray-500 border border-gray-500/20"
                }`}>
                  {profile.warnings || 0} / 3
                </span>
              </div>

              {profile.subCargos && profile.subCargos.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 justify-center sm:justify-start">
                  {allSubCargos
                    .filter(sc => profile.subCargos?.includes(sc.id))
                    .map(sc => (
                      <span
                        key={sc.id}
                        className="bg-amber-500/10 text-[9px] text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded font-mono uppercase tracking-wider font-bold"
                        title={sc.description}
                      >
                        {sc.label}
                      </span>
                    ))}
                </div>
              )}
            </div>
            
            <p className="text-xs text-gray-400 italic">"{profile.habboMotto}"</p>

            {profile.missaoCorreta && (
              <div className="bg-fmb-army/10 border border-fmb-gold/30 rounded p-2.5 mt-2 max-w-md text-left font-mono">
                <span className="text-[9px] text-fmb-gold uppercase block font-black tracking-widest mb-0.5">Missão Correta:</span>
                <div className="flex gap-2 items-center mt-1">
                  <span 
                    className="text-xs text-white font-bold select-all bg-fmb-black/45 px-2 py-1.5 rounded flex-1 border border-fmb-army/15" 
                  >
                    {profile.missaoCorreta}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(profile.missaoCorreta || "");
                      alert("Missão copiada com sucesso!");
                    }}
                    className="flex items-center gap-1.5 bg-fmb-gold text-fmb-black hover:bg-amber-400 font-bold px-3 py-1.5 rounded text-xs transition-colors cursor-pointer shrink-0"
                    id="copy-missao-btn"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>COPIAR</span>
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap justify-center sm:justify-start gap-4 text-[10px] font-mono text-gray-500 pt-1">
              <span className="flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-1 text-fmb-gold" />
                INGRESSO: {new Date(profile.joinedAt).toLocaleDateString("pt-BR")}
              </span>
              <span className="flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1 text-fmb-gold" />
                HABBO DE: {profile.habboCreated}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CORE HISTORIC STATISTICS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-fmb-black border border-fmb-army/20 p-4 rounded text-center">
          <span className="text-[10px] font-mono text-gray-500 block uppercase tracking-wider">Patrulha Acumulada</span>
          <span className="font-mono text-xl font-bold text-white block mt-1">{hoursWorked} hs</span>
          <span className="text-[9px] font-mono text-fmb-gold mt-0.5 block">TEMPO DE FOLHA</span>
        </div>

        <div className="bg-fmb-black border border-fmb-army/20 p-4 rounded text-center">
          <span className="text-[10px] font-mono text-gray-500 block uppercase tracking-wider">Treinos Ministrados</span>
          <span className="font-mono text-xl font-bold text-white block mt-1">{profile.trainingsCreated} ts</span>
          <span className="text-[9px] font-mono text-fmb-gold mt-0.5 block">ATAS CONCLUÍDAS</span>
        </div>

        <div className="bg-fmb-black border border-fmb-army/20 p-4 rounded text-center">
          <span className="text-[10px] font-mono text-gray-500 block uppercase tracking-wider">Promotores Crachá</span>
          <span className="font-mono text-xl font-bold text-white block mt-1">{profile.promotionsGiven}</span>
          <span className="text-[9px] font-mono text-fmb-gold mt-0.5 block">PROMOCÕES DADAS</span>
        </div>

        <div className="bg-fmb-black border border-fmb-army/20 p-4 rounded text-center">
          <span className="text-[10px] font-mono text-gray-500 block uppercase tracking-wider">Conquistas Medalhas</span>
          <span className="font-mono text-xl font-bold text-white block mt-1">{profile.medals.length} / {LIST_OF_MEDALS.length}</span>
          <span className="text-[9px] font-mono text-fmb-gold mt-0.5 block">LAUREADOS ATIVOS</span>
        </div>
      </div>

      {/* DETAILED TIME CLOCK SHEETS STATS */}
      <div className="bg-fmb-black/40 border border-fmb-army/30 rounded-lg p-5 leading-tight">
        <h4 className="font-display font-extrabold text-sm text-white uppercase tracking-wider mb-4 pb-2 border-b border-fmb-army/20 flex items-center space-x-1.5">
          <Clock className="w-4 h-4 text-fmb-gold" />
          <span>Frequência e Rendimento de Patrulhas Ativas</span>
        </h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-fmb-slate/20 border border-fmb-army/10 p-3.5 rounded text-center">
            <span className="text-[9px] font-mono text-gray-400 block uppercase tracking-widest">Diário (24h)</span>
            <span className="font-mono text-xl font-black text-fmb-gold block mt-1.5">{dailyHours} hs</span>
            <span className="text-[8px] font-mono text-gray-500 block mt-0.5 uppercase">HOJE EM SERVIÇO</span>
          </div>
          <div className="bg-fmb-slate/20 border border-fmb-army/10 p-3.5 rounded text-center">
            <span className="text-[9px] font-mono text-gray-400 block uppercase tracking-widest">Semanal (7d)</span>
            <span className="font-mono text-xl font-black text-fmb-gold block mt-1.5">{weeklyHours} hs</span>
            <span className="text-[8px] font-mono text-gray-500 block mt-0.5 uppercase">SEMANA ATIVA</span>
          </div>
          <div className="bg-fmb-slate/20 border border-fmb-army/10 p-3.5 rounded text-center">
            <span className="text-[9px] font-mono text-gray-400 block uppercase tracking-widest">Mensal (30d)</span>
            <span className="font-mono text-xl font-black text-fmb-gold block mt-1.5">{monthlyHours} hs</span>
            <span className="text-[8px] font-mono text-gray-500 block mt-0.5 uppercase">DESEMPENHO MENSAL</span>
          </div>
        </div>
      </div>

      {/* CENTRAL DE COMANDOS / ALERTAS DO MILITAR */}
      <div className="bg-fmb-black/40 border border-fmb-army/30 rounded-lg p-5 leading-tight">
        <h4 className="font-display font-extrabold text-sm text-white uppercase tracking-wider mb-4 pb-2 border-b border-fmb-army/20 flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <Bell className="w-4 h-4 text-fmb-gold" />
            <span>Painel de Notificações & Alertas Militares</span>
          </div>
          {viewer.id === profile.id && notifications.some(n => !n.read) && (
            <button
              onClick={async () => {
                try {
                  await api.markNotificationsAsRead();
                  const updated = await api.getUserNotifications(profile.id);
                  setNotifications(updated || []);
                } catch (err: any) {
                  alert(err.message);
                }
              }}
              className="text-[10px] font-mono text-fmb-gold hover:underline uppercase bg-fmb-black/60 px-2 py-0.5 rounded border border-fmb-army/20"
              id="militar-read-all-notifs"
            >
              Marcar como lidas
            </button>
          )}
        </h4>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Notifications List */}
          <div className="lg:col-span-2 space-y-3">
            <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block">Histórico de Alertas Recentes</span>
            {notifications.length === 0 ? (
              <p className="text-xs font-mono text-gray-500 py-6 text-center italic bg-fmb-black/20 rounded border border-fmb-army/10">
                Nenhum alerta ou notificação militar ativa registrada neste perfil.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
                {notifications.map(n => (
                  <div key={n.id} className={`p-3 bg-fmb-black/80 border rounded font-mono text-[10px] leading-tight space-y-1 ${
                    n.read ? "border-fmb-army/10 opacity-70" : "border-fmb-gold/40 bg-fmb-gold/5"
                  }`}>
                    <div className="flex justify-between items-center text-[9px] text-gray-500 border-b border-fmb-army/10 pb-1 mb-1">
                      <span>{new Date(n.createdAt).toLocaleString("pt-BR")}</span>
                      <span className={`font-bold px-1 rounded ${
                        n.read ? "text-gray-400 bg-gray-900" : "text-fmb-gold bg-fmb-gold/10"
                      }`}>
                        {n.read ? "LIDA" : "NOVA"}
                      </span>
                    </div>
                    <p className="text-white font-bold text-xs">{n.title}</p>
                    <p className="text-gray-400 mt-1 leading-normal">{n.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Send custom notification form */}
          <div className="bg-fmb-black/30 border border-fmb-army/20 p-4 rounded-lg flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-mono text-fmb-gold uppercase tracking-wider block mb-2.5 font-bold">Enviar Despacho / Alerta Particular</span>
              <p className="text-[10px] font-mono text-gray-400 mb-3 leading-normal">
                Transmita uma notificação ou instrução oficial que será exibida em destaque no painel militar desta pessoa.
              </p>
              
              <div className="space-y-2 text-left">
                <div>
                  <label className="text-[9px] font-mono text-gray-500 block uppercase mb-1">Título do Alerta</label>
                  <input
                    type="text"
                    value={notifTitle}
                    onChange={(e) => setNotifTitle(e.target.value)}
                    placeholder="Ex: Alerta de Patrulha ou Convocação"
                    className="w-full bg-fmb-black border border-fmb-army/30 rounded p-1.5 text-xs text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-fmb-gold"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-mono text-gray-500 block uppercase mb-1">Mensagem de Conteúdo</label>
                  <textarea
                    value={notifMsg}
                    onChange={(e) => setNotifMsg(e.target.value)}
                    placeholder="Ex: Solicitamos sua presença na sala de instruções..."
                    rows={2}
                    className="w-full bg-fmb-black border border-fmb-army/30 rounded p-1.5 text-xs text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-fmb-gold resize-none"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={async () => {
                if (!notifTitle.trim() || !notifMsg.trim()) {
                  alert("Preencha o título e a mensagem do alerta.");
                  return;
                }
                setSendingNotif(true);
                try {
                  await api.sendNotification(profile.id, notifTitle, notifMsg);
                  setNotifTitle("");
                  setNotifMsg("");
                  // Refresh list
                  const updated = await api.getUserNotifications(profile.id);
                  setNotifications(updated || []);
                } catch (err: any) {
                  alert("Erro ao enviar: " + err.message);
                } finally {
                  setSendingNotif(false);
                }
              }}
              disabled={sendingNotif}
              className="mt-3 w-full bg-fmb-gold text-fmb-black hover:bg-white hover:text-fmb-black transition-all py-1.5 rounded font-mono text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sendingNotif ? "Enviando..." : "Despachar Alerta"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* SEÇÃO DE CONTROLE DE ADVERTÊNCIAS E GESTÃO DISCIPLINAR */}
      <div className="bg-fmb-black/40 border border-fmb-army/30 rounded-lg p-5 leading-tight">
        <h4 className="font-display font-extrabold text-sm text-white uppercase tracking-wider mb-4 pb-2 border-b border-fmb-army/20 flex items-center space-x-1.5">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <span>Gestão Disciplinar e Histórico de Punições</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Status Box */}
          <div className="bg-fmb-slate/10 border border-fmb-army/20 p-4 rounded-lg flex flex-col justify-between">
            <div className="space-y-3">
              <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider block font-bold">Estado Disciplinar Militar</span>
              
              <div className="flex items-center gap-4 bg-fmb-black/45 p-4 rounded border border-fmb-army/10">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center border font-sans text-lg font-black shrink-0 ${
                  (profile.warnings || 0) === 0 ? "bg-green-500/10 text-green-400 border-green-500/35" :
                  (profile.warnings || 0) === 1 ? "bg-amber-500/10 text-amber-400 border-amber-500/35" :
                  (profile.warnings || 0) === 2 ? "bg-orange-500/15 text-orange-400 border-orange-500/40" :
                  "bg-red-500/20 text-red-400 border-red-500/50 animate-pulse"
                }`}>
                  {profile.warnings || 0}/3
                </div>
                <div className="font-mono text-[11px] leading-snug">
                  <p className="text-white font-bold text-left">
                    {(profile.warnings || 0) === 0 ? "Ficha Limpa / Excelente Conduta" :
                     (profile.warnings || 0) === 1 ? "1ª Advertência Aplicada" :
                     (profile.warnings || 0) === 2 ? "2ª Advertência (Aviso de Prisão ou Rebaixamento)" :
                     "Limite Máximo de Tolerância Atingido"}
                  </p>
                  <p className="text-gray-400 mt-1 text-left">
                    {(profile.warnings || 0) === 0 ? "Nenhum desvio disciplinar ou punição ativa registrada." :
                     (profile.warnings || 0) === 1 ? "Militar sob observação tática. Evite novos desvios." :
                     (profile.warnings || 0) === 2 ? "Militar no limiar de rebaixamento compulsório ou exclusão das dependências táticas." :
                     "Excedeu todas as advertências permitidas pelo regulamento militar do exército FMB."}
                  </p>
                </div>
              </div>
            </div>

            {hasWarnPermission && (profile.warnings || 0) > 0 && (
              <div className="mt-4 pt-3 border-t border-fmb-army/10 flex justify-end">
                <button
                  onClick={async () => {
                    if (!window.confirm(`Deseja realmente abonar / remover uma advertência de @${profile.habboNick}?`)) return;
                    setSubmittingWarn(true);
                    setWarnSuccess(null);
                    setWarnError(null);
                    try {
                      const res = await api.removeWarning(profile.habboNick);
                      setWarnSuccess("Advertência militar removida com sucesso!");
                      // reload
                      const data = await api.getUserById(militarId);
                      setProfile(data.user);
                    } catch (err: any) {
                      setWarnError(err.message || "Erro ao remover advertência.");
                    } finally {
                      setSubmittingWarn(false);
                    }
                  }}
                  disabled={submittingWarn}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-mono text-[10px] uppercase font-bold py-1.5 px-4 rounded transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>Remover 1 Advertência (Abonar)</span>
                </button>
              </div>
            )}
          </div>

          {/* Action Box */}
          <div className="bg-fmb-slate/10 border border-fmb-army/20 p-4 rounded-lg">
            {hasWarnPermission ? (
              <div className="space-y-3 text-left font-mono">
                <span className="text-[10px] font-mono text-fmb-gold uppercase tracking-wider block font-bold">Aplicar Nova Advertência Oficial</span>
                <p className="text-[10px] text-gray-400 leading-normal">
                  Selecione ou justifique o desvio disciplinar do militar. Advertências adicionam +1 no contador de punição e registram uma fita no CDM.
                </p>

                {warnSuccess && <div className="p-2 bg-green-950/25 border border-green-500/35 text-green-300 rounded text-[9px] font-bold">{warnSuccess}</div>}
                {warnError && <div className="p-2 bg-red-950/25 border border-red-500/35 text-red-300 rounded text-[9px] font-bold">{warnError}</div>}

                <div className="space-y-2">
                  <div>
                    <label className="text-[9px] text-gray-500 block uppercase mb-1">Motivação da Punição (Regulamento Disciplinar)</label>
                    <textarea
                      value={warnReason}
                      onChange={(e) => setWarnReason(e.target.value)}
                      placeholder="Ex: Conduta incompatível com a farda, desacato, ausência sem justificativa no posto de patrulha..."
                      rows={2.5}
                      className="w-full bg-fmb-black border border-fmb-army/30 rounded p-1.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-fmb-gold resize-none font-mono"
                    />
                  </div>

                  <button
                    onClick={async () => {
                      if (!warnReason.trim()) {
                        alert("Forneça a justificativa disciplinar oficial.");
                        return;
                      }
                      if (!window.confirm(`Confirmar aplicação de advertência a @${profile.habboNick}?`)) return;
                      setSubmittingWarn(true);
                      setWarnSuccess(null);
                      setWarnError(null);
                      try {
                        const res = await api.applyWarning(profile.habboNick, warnReason);
                        setWarnSuccess("Advertência militar aplicada com sucesso!");
                        setWarnReason("");
                        // reload
                        const data = await api.getUserById(militarId);
                        setProfile(data.user);
                      } catch (err: any) {
                        setWarnError(err.message || "Erro ao aplicar advertência.");
                      } finally {
                        setSubmittingWarn(false);
                      }
                    }}
                    disabled={submittingWarn}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-[10px] uppercase font-bold py-1.5 rounded transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{submittingWarn ? "Registrando Advertência..." : "Aplicar Advertência (+1)"}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col justify-center items-center py-6 text-center text-gray-500 font-mono text-[10px] space-y-1">
                <Shield className="w-8 h-8 text-gray-700 mb-1" />
                <p className="text-gray-400 font-bold uppercase">ACESSO DISCIPLINAR RESTRITO</p>
                <p className="leading-relaxed max-w-xs">Você não possui atribuição de patente ou subcargo militar ativo com permissão para aplicar advertências.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* MEDAL CABINET */}
        <div className="lg:col-span-2 bg-fmb-black/40 border border-fmb-army/30 p-5 rounded-lg">
          <h4 className="font-display font-extrabold text-sm text-white uppercase tracking-wider mb-4 border-b border-fmb-army/20 pb-2 flex items-center space-x-1.5">
            <Medal className="w-4 h-4 text-fmb-gold" />
            <span>Gabinete de Láureas e Medalhas</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {LIST_OF_MEDALS.map(medal => {
              const hasMedal = profile.medals.includes(medal.id);
              return (
                <div 
                  key={medal.id}
                  className={`p-3 border rounded-lg flex items-start space-x-3 transition-colors ${
                    hasMedal 
                      ? "bg-fmb-gold/5 border-fmb-gold/45" 
                      : "bg-fmb-black/40 border-fmb-army/20 opacity-40 select-none"
                  }`}
                >
                  <div className={`p-2 rounded-full shrink-0 ${
                    hasMedal ? "bg-fmb-gold text-fmb-black font-extrabold" : "bg-gray-800 text-gray-500"
                  }`}>
                    {/* Dynamic award icon simulation */}
                    {medal.id.includes("treinos") && <GraduationCap className="w-5 h-5" />}
                    {medal.id.includes("servico") && <Timer className="w-5 h-5" />}
                    {medal.id.includes("mes") && <Medal className="w-5 h-5" />}
                    {medal.id.includes("operacional") && <Award className="w-5 h-5" />}
                  </div>

                  <div className="text-left font-mono leading-tight">
                    <span className={`text-xs block font-bold ${hasMedal ? "text-fmb-gold" : "text-gray-400"}`}>
                      {medal.title}
                    </span>
                    <span className="text-[9px] text-gray-400 block mt-1 leading-normal">
                      {medal.description}
                    </span>
                    {hasMedal ? (
                      <span className="text-[8px] text-green-400 block uppercase mt-1.5 font-bold flex items-center">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Conquistada
                      </span>
                    ) : (
                      <span className="text-[8px] text-gray-500 block uppercase mt-1.5 font-bold">
                        🔒 Bloqueada
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* LOG OF CHANGES / SERVICE HISTORICAL */}
        <div className="bg-fmb-black/40 border border-fmb-army/30 p-5 rounded-lg space-y-4">
          <h4 className="font-display font-extrabold text-sm text-white uppercase tracking-wider border-b border-fmb-army/20 pb-2 flex items-center space-x-1.5">
            <Award className="w-4 h-4 text-fmb-gold" />
            <span>Histórico de Patentes</span>
          </h4>

          {promotions.length === 0 ? (
            <p className="text-xs font-mono text-gray-500 py-6 text-center italic">
              Nenhuma alteração de patente documentada para este militar.
            </p>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {promotions.map(p => (
                <div key={p.id} className="p-3 bg-fmb-black border border-fmb-army/20 rounded font-mono text-[10px]">
                  <div className="flex justify-between items-center text-gray-500 mb-1 border-b border-fmb-army/10 pb-1">
                    <span>{p.date} • {p.time}</span>
                    <span className="text-fmb-gold font-bold">DECRETO</span>
                  </div>
                  <p className="text-gray-300">
                    Alteração de <strong className="text-red-400">{p.oldRank}</strong> para <strong className="text-green-400">{p.newRank}</strong>.
                  </p>
                  <p className="text-gray-400 mt-1 leading-normal">
                    Justificativa: <span className="italic">"{p.reason}"</span>
                  </p>
                  <p className="text-right text-fmb-gold font-bold mt-2 text-[9px] uppercase">
                    Por: @{p.promoterName}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* HISTÓRICO DE INSTRUÇÕES DE TREINO */}
      <div className="bg-fmb-black/40 border border-fmb-army/30 p-5 rounded-lg text-left shadow-md">
        <h4 className="font-display font-extrabold text-sm text-white uppercase tracking-wider mb-4 pb-2 border-b border-fmb-army/20 flex items-center space-x-1.5">
          <GraduationCap className="w-4 h-4 text-fmb-gold" />
          <span>Controle de Instruções e Doutrinas de Treinamentos</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Aulas de Recruta / Doutrinas Básicas */}
          <div className="space-y-3">
            <h5 className="font-mono text-xs text-fmb-gold uppercase tracking-wider font-bold border-b border-fmb-army/10 pb-1 flex items-center justify-between">
              <span>Instruções Recrutas / Básicas</span>
              <span className="text-[9px] text-gray-400 bg-fmb-black px-1.5 py-0.5 border border-fmb-army/25 rounded lowercase">{recruitLessons.length} aula(s)</span>
            </h5>

            {recruitLessons.length === 0 ? (
              <p className="text-xs font-mono text-gray-400 py-6 text-center italic bg-fmb-black/25 rounded border border-fmb-army/10">
                Nenhuma instrução básica ou doutrina de recrutas para este militar.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {recruitLessons.map(lesson => {
                  const isInstructor = lesson.instructorId === profile.id || lesson.instructorName.toLowerCase() === profile.habboNick.toLowerCase();
                  return (
                    <div key={lesson.id} className="p-3 bg-fmb-black/80 border border-fmb-army/20 rounded font-mono text-[10px] leading-tight space-y-1.5">
                      <div className="flex justify-between items-center text-[9px] text-gray-500 border-b border-fmb-army/10 pb-1">
                        <span>{new Date(lesson.createdAt).toLocaleDateString("pt-BR")}</span>
                        <span className={`font-bold px-1 rounded ${
                          lesson.status === "Aprovado" ? "text-green-400 bg-green-950/20" : "text-red-400 bg-red-950/20"
                        }`}>
                          {lesson.status.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-white font-bold text-xs uppercase">{lesson.category}</p>
                        <p className="text-gray-400 mt-1 pb-1">
                          {isInstructor ? (
                            <span>Papel: <strong className="text-fmb-gold">INSTRUTOR RESISTENTE</strong></span>
                          ) : (
                            <span>Papel: <strong className="text-green-400">PARTICIPANTE</strong></span>
                          )}
                        </p>
                        <p className="text-gray-400 mt-1">
                          {isInstructor ? (
                            <span>Ministrado para: <strong className="text-white">@{lesson.studentNick}</strong></span>
                          ) : (
                            <span>Recebido de: <strong className="text-white">@{lesson.instructorName}</strong></span>
                          )}
                        </p>
                      </div>
                      {lesson.notes && (
                        <p className="text-gray-500 italic bg-fmb-slate/20 p-2 rounded text-[9px] mt-1 border-l border-fmb-gold/30">
                          Obs: "{lesson.notes}"
                        </p>
                      )}
                      {lesson.screenshotUrl && (
                        <div className="mt-1 pt-1 border-t border-fmb-army/10">
                          <a 
                            href={lesson.screenshotUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-[9px] text-fmb-gold hover:underline"
                            referrerPolicy="no-referrer"
                          >
                            <span className="mr-1">📷</span> Ver Captura da Aula (Comprovante)
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Atas de Treinamentos Concluídos / Agendados */}
          <div className="space-y-3">
            <h5 className="font-mono text-xs text-fmb-gold uppercase tracking-wider font-bold border-b border-fmb-army/10 pb-1 flex items-center justify-between">
              <span>Atas de Treinamentos Oficial</span>
              <span className="text-[9px] text-gray-400 bg-fmb-black px-1.5 py-0.5 border border-fmb-army/25 rounded lowercase">{trainings.length} ata(s)</span>
            </h5>

            {trainings.length === 0 ? (
              <p className="text-xs font-mono text-gray-400 py-6 text-center italic bg-fmb-black/25 rounded border border-fmb-army/10">
                Nenhum treinamento oficial agendado ou concluído para este militar.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {trainings.map(t => {
                  const isInstructor = t.instructorId === profile.id || t.instructorName.toLowerCase() === profile.habboNick.toLowerCase();
                  return (
                    <div key={t.id} className="p-3 bg-fmb-black/80 border border-fmb-army/20 rounded font-mono text-[10px] leading-tight space-y-1.5">
                      <div className="flex justify-between items-center text-[9px] text-gray-500 border-b border-fmb-army/10 pb-1">
                        <span>{t.date} • {t.time}</span>
                        <span className={`font-bold px-1 rounded ${
                          t.status === "Concluido" ? "text-green-400 bg-green-950/20" : t.status === "Agendado" ? "text-amber-400 bg-amber-950/20" : "text-gray-400 bg-gray-900"
                        }`}>
                          {t.status.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-white font-bold text-xs uppercase">{t.name}</p>
                        <span className="text-[9px] text-gray-500 uppercase">{t.category}</span>
                      </div>
                      <p className="text-gray-400 mt-1">
                        {isInstructor ? (
                          <span>Papel: <strong className="text-fmb-gold">INSTRUTOR RESISTENTE</strong></span>
                        ) : (
                          <span>Papel: <strong className="text-green-400">PARTICIPANTE</strong></span>
                        )}
                      </p>
                      {t.participants && t.participants.length > 0 && (
                        <p className="text-[9px] text-gray-500 leading-normal">
                          Integrantes: {t.participants.map(p => `@${p}`).join(", ")}
                        </p>
                      )}
                      {t.description && (
                        <p className="text-gray-500 italic bg-fmb-slate/20 p-2 rounded text-[9px] mt-1 border-l border-fmb-gold/30">
                          "{t.description}"
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
