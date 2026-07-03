import React, { useState, useEffect } from "react";
import { 
  Shield, 
  Search, 
  Award, 
  TrendingUp, 
  Coins, 
  Terminal, 
  Clock, 
  Activity, 
  Filter,
  RefreshCw,
  Sliders,
  AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../lib/api.js";
import { User } from "../types.js";

interface CdmPanelProps {
  viewer: User;
}

interface SystemLog {
  id: string;
  userId: string | null;
  userNick: string;
  action: string;
  details: string;
  timestamp: string;
}

export function CdmPanel({ viewer }: CdmPanelProps) {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"ALL" | "PROMOTION" | "GRATIFICATION" | "SERVICE" | "WARNING" | "SYSTEM">("ALL");

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const [logsData, usersData] = await Promise.all([
        api.getLogs(),
        api.getUsers()
      ]);
      setLogs(logsData || []);
      setUsers(usersData || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro ao conectar com a Central de Despachos Militares.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Helper to categorize logs based on action
  const getLogCategory = (action: string): "PROMOTION" | "GRATIFICATION" | "SERVICE" | "WARNING" | "SYSTEM" => {
    const act = action.toUpperCase();
    if (act.includes("ADVERTENCIA") || act.includes("ADVERTÊNCIA") || act.includes("WARN")) {
      return "WARNING";
    }
    if (act.includes("PROMOCAO") || act.includes("PROMOCÃO") || act.includes("REBAIXAMENTO") || act.includes("DEMISS") || act.includes("CONTRATADO")) {
      return "PROMOTION";
    }
    if (act.includes("PONTUACAO") || act.includes("PONTO") || act.includes("RECOMPENSA") || act.includes("GRATIF") || act.includes("ADICIONAR_PONTOS") || act.includes("REMOVER_PONTOS")) {
      return "GRATIFICATION";
    }
    if (act.includes("SERVICO") || act.includes("SERVIÇO") || act.includes("PATRULHA") || act.includes("ATIVIDADE") || act.includes("TREINO") || act.includes("NOVO_TREINO")) {
      return "SERVICE";
    }
    return "SYSTEM";
  };

  const filteredLogs = logs.filter(log => {
    // Search filter
    const matchesSearch = 
      log.userNick.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // Type filter
    if (selectedFilter === "ALL") return true;
    return getLogCategory(log.action) === selectedFilter;
  });

  // Calculate quick stats
  const promoCount = logs.filter(l => getLogCategory(l.action) === "PROMOTION").length;
  const gratCount = logs.filter(l => getLogCategory(l.action) === "GRATIFICATION").length;
  const serviceCount = logs.filter(l => getLogCategory(l.action) === "SERVICE").length;
  const warnCount = logs.filter(l => getLogCategory(l.action) === "WARNING").length;
  const usersWithTwoWarnings = (users || []).filter(u => u.warnings === 2);

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    } catch (e) {
      return isoString;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header Panel */}
      <div className="bg-fmb-slate/40 border border-fmb-army/30 rounded p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-xl backdrop-blur-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-fmb-army/35 border border-fmb-gold/40 rounded shadow-md">
            <Shield className="w-6 h-6 text-fmb-gold" />
          </div>
          <div>
            <h2 className="text-sm font-sans font-bold tracking-wider text-white uppercase flex items-center space-x-1.5">
              <span>Central de Despachos Militares</span>
              <span className="text-[10px] text-fmb-gold px-1.5 py-0.5 rounded border border-fmb-gold/30 bg-fmb-gold/10 font-mono">CDM</span>
            </h2>
            <p className="text-[10px] text-gray-400 font-mono mt-0.5">Auditoria tática unificada de gratificações, promoções, pontos e despachos do Comando Supremo.</p>
          </div>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center space-x-1.5 self-start md:self-auto text-[10px] uppercase tracking-wider font-mono bg-fmb-army hover:bg-fmb-olive text-white border border-fmb-gold/30 rounded py-1.5 px-3 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-fmb-gold" : "text-white"}`} />
          <span>Sincronizar Rede</span>
        </button>
      </div>

      {/* Quick Dashboard Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-fmb-black/40 border border-fmb-army/15 rounded p-3 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[8px] text-gray-500 uppercase font-bold tracking-wider block">Registros Totais</span>
            <span className="text-xl font-mono text-white font-bold">{logs.length}</span>
          </div>
          <Activity className="w-7 h-7 text-gray-600" />
        </div>

        <div className="bg-fmb-black/40 border border-fmb-army/15 rounded p-3 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[8px] text-emerald-500 uppercase font-bold tracking-wider block">Promoções Realizadas</span>
            <span className="text-xl font-mono text-emerald-400 font-bold">{promoCount}</span>
          </div>
          <Award className="w-7 h-7 text-emerald-700/60" />
        </div>

        <div className="bg-fmb-black/40 border border-fmb-army/15 rounded p-3 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[8px] text-fmb-gold uppercase font-bold tracking-wider block">Gratificações & Pontos</span>
            <span className="text-xl font-mono text-fmb-gold font-bold">{gratCount}</span>
          </div>
          <Coins className="w-7 h-7 text-fmb-gold/40" />
        </div>

        <div className="bg-fmb-black/40 border border-fmb-army/15 rounded p-3 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[8px] text-sky-500 uppercase font-bold tracking-wider block">Patrulhas & Treinos</span>
            <span className="text-xl font-mono text-sky-400 font-bold">{serviceCount}</span>
          </div>
          <TrendingUp className="w-7 h-7 text-sky-700/60" />
        </div>

        <div className="bg-fmb-black/40 border border-fmb-army/15 rounded p-3 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[8px] text-red-500 uppercase font-bold tracking-wider block">Advertências</span>
            <span className="text-xl font-mono text-red-400 font-bold">{warnCount}</span>
          </div>
          <AlertTriangle className="w-7 h-7 text-red-700/60" />
        </div>
      </div>

      {/* ALERTA DISCIPLINAR: MILITARES COM 2 ADVERTÊNCIAS (PRESTES A TOMAR A 3ª) */}
      <div className="bg-red-950/20 border border-red-500/35 rounded p-4 space-y-3 shadow-lg">
        <h3 className="text-xs font-mono font-black uppercase text-red-400 tracking-wider flex items-center space-x-2 border-b border-red-500/20 pb-2">
          <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
          <span>Alerta de Risco de Expulsão (2 Advertências / Prestes a tomar a 3ª)</span>
        </h3>
        
        {usersWithTwoWarnings.length === 0 ? (
          <p className="text-[10px] text-gray-400 font-mono italic text-left">
            Nenhum militar com 2 advertências ativas neste momento. Disciplina exemplar no QG!
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {usersWithTwoWarnings.map(u => {
              const cleanedNick = u.habboNick.replace(/^@/, "").trim();
              const avatarHeadUrl = `https://www.habbo.com.br/habbo-imaging/avatarimage?img_format=png&user=${encodeURIComponent(cleanedNick)}&direction=2&head_direction=2&gesture=std&size=s&headonly=1`;
              
              // Find the last warning log for this user to show reason
              const lastWarnLog = logs.find(l => 
                (l.action.toUpperCase().includes("ADVERTENCIA") || l.action.toUpperCase().includes("ADVERTÊNCIA")) && 
                l.details.toLowerCase().includes(cleanedNick.toLowerCase()) && 
                !l.action.toUpperCase().includes("REMOVER")
              );

              return (
                <div key={u.id} className="bg-red-900/10 border border-red-500/40 rounded p-3 flex items-start space-x-2.5">
                  <div className="w-9 h-9 rounded-full border border-red-500/30 bg-fmb-black shrink-0 overflow-hidden flex items-center justify-center">
                    <img src={avatarHeadUrl} alt={u.habboNick} className="scale-110 translate-y-1" referrerPolicy="no-referrer" />
                  </div>
                  <div className="flex-1 font-mono text-[10px] space-y-1 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-black">@{u.habboNick}</span>
                      <span className="text-red-400 font-bold bg-red-500/20 px-1.5 py-0.5 rounded border border-red-500/30">
                        2/3 ADVS
                      </span>
                    </div>
                    <span className="text-fmb-gold text-[9px] block uppercase font-bold">{u.role}</span>
                    <p className="text-gray-300 text-[9.5px] leading-tight">
                      {lastWarnLog ? lastWarnLog.details : "Acumulou 2 advertências disciplinares e está sujeito a expulsão em caso de nova infração."}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Controls & Search */}
      <div className="bg-fmb-slate/20 border border-fmb-army/15 rounded p-4 space-y-3.5">
        <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
          {/* Tabs filters */}
          <div className="flex flex-wrap gap-1.5 w-full lg:w-auto">
            <button
              onClick={() => setSelectedFilter("ALL")}
              className={`px-3 py-1.5 rounded text-[9px] uppercase tracking-wider font-mono transition-colors border cursor-pointer ${
                selectedFilter === "ALL"
                  ? "bg-fmb-army text-white border-fmb-gold/40 shadow-sm"
                  : "bg-fmb-black/30 text-gray-400 border-fmb-army/10 hover:bg-fmb-slate/40"
              }`}
            >
              Todos os Despachos
            </button>
            <button
              onClick={() => setSelectedFilter("PROMOTION")}
              className={`px-3 py-1.5 rounded text-[9px] uppercase tracking-wider font-mono transition-colors border cursor-pointer ${
                selectedFilter === "PROMOTION"
                  ? "bg-emerald-800 text-emerald-100 border-emerald-500/50 shadow-sm"
                  : "bg-fmb-black/30 text-gray-400 border-fmb-army/10 hover:bg-fmb-slate/40"
              }`}
            >
              Promoções & Rebaixamentos
            </button>
            <button
              onClick={() => setSelectedFilter("GRATIFICATION")}
              className={`px-3 py-1.5 rounded text-[9px] uppercase tracking-wider font-mono transition-colors border cursor-pointer ${
                selectedFilter === "GRATIFICATION"
                  ? "bg-amber-800 text-amber-100 border-amber-500/50 shadow-sm"
                  : "bg-fmb-black/30 text-gray-400 border-fmb-army/10 hover:bg-fmb-slate/40"
              }`}
            >
              Gratificações de Pontos
            </button>
            <button
              onClick={() => setSelectedFilter("SERVICE")}
              className={`px-3 py-1.5 rounded text-[9px] uppercase tracking-wider font-mono transition-colors border cursor-pointer ${
                selectedFilter === "SERVICE"
                  ? "bg-sky-850 text-sky-100 border-sky-500/50 shadow-sm"
                  : "bg-fmb-black/30 text-gray-400 border-fmb-army/10 hover:bg-fmb-slate/40"
              }`}
            >
              Patrulhas & Treinamentos
            </button>
            <button
              onClick={() => setSelectedFilter("WARNING")}
              className={`px-3 py-1.5 rounded text-[9px] uppercase tracking-wider font-mono transition-colors border cursor-pointer ${
                selectedFilter === "WARNING"
                  ? "bg-red-800 text-red-100 border-red-500/50 shadow-sm"
                  : "bg-fmb-black/30 text-gray-400 border-fmb-army/10 hover:bg-fmb-slate/40"
              }`}
            >
              Advertências
            </button>
            <button
              onClick={() => setSelectedFilter("SYSTEM")}
              className={`px-3 py-1.5 rounded text-[9px] uppercase tracking-wider font-mono transition-colors border cursor-pointer ${
                selectedFilter === "SYSTEM"
                  ? "bg-gray-800 text-gray-100 border-gray-600/50 shadow-sm"
                  : "bg-fmb-black/30 text-gray-400 border-fmb-army/10 hover:bg-fmb-slate/40"
              }`}
            >
              Configurações / Sistema
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full lg:w-80">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Pesquisar militar ou ação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-fmb-black/30 border border-fmb-army/20 rounded py-2 pl-9 pr-3 text-white placeholder-gray-500 text-xs outline-none focus:border-fmb-gold transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Dispatch List */}
      <div className="bg-fmb-black/25 border border-fmb-army/15 rounded shadow-lg overflow-hidden">
        <div className="bg-fmb-slate/30 border-b border-fmb-army/15 px-4 py-2.5 flex items-center justify-between">
          <span className="text-[10px] text-fmb-gold uppercase font-mono tracking-wider font-bold flex items-center space-x-1.5">
            <Terminal className="w-3.5 h-3.5" />
            <span>Fita de Transmissão Militar</span>
          </span>
          <span className="text-[9px] text-gray-500 font-mono font-semibold">
            {filteredLogs.length} despachos listados
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center space-y-2">
            <RefreshCw className="w-8 h-8 text-fmb-gold animate-spin" />
            <span className="text-xs font-mono uppercase tracking-widest text-fmb-gold/80">Sintonizando canais criptografados...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-400 bg-red-950/15 border-l-4 border-red-600 text-xs font-mono">
            {error}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-gray-500 font-mono text-xs">
            Nenhum despacho militar encontrado com os critérios fornecidos.
          </div>
        ) : (
          <div className="divide-y divide-fmb-army/10 max-h-[600px] overflow-y-auto scrollbar-thin">
            <AnimatePresence>
              {filteredLogs.map((log) => {
                const cat = getLogCategory(log.action);
                
                // Color mapping for layout
                let badgeColor = "text-gray-400 bg-gray-500/10 border-gray-500/25";
                let borderColor = "border-l-2 border-l-gray-600";
                const isTakingTwoWarnings = log.details.includes("Total: 2/3") || log.details.includes("2/3") || log.details.includes("acumulou 2") || log.details.toLowerCase().includes("segunda advert") || log.details.toLowerCase().includes("2a advert");

                if (log.action.toUpperCase().includes("ADVERTENCIA") || log.action.toUpperCase().includes("ADVERTÊNCIA")) {
                  badgeColor = isTakingTwoWarnings 
                    ? "text-red-500 bg-red-500/20 border-red-500/40 font-black" 
                    : "text-red-400 bg-red-500/10 border-red-500/25";
                  borderColor = isTakingTwoWarnings 
                    ? "border-l-4 border-l-red-650 bg-red-950/15" 
                    : "border-l-2 border-l-red-500";
                } else if (cat === "PROMOTION") {
                  badgeColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/25";
                  borderColor = "border-l-2 border-l-emerald-500";
                } else if (cat === "GRATIFICATION") {
                  badgeColor = "text-fmb-gold bg-fmb-gold/10 border-fmb-gold/25";
                  borderColor = "border-l-2 border-l-fmb-gold";
                } else if (cat === "SERVICE") {
                  badgeColor = "text-sky-400 bg-sky-500/10 border-sky-500/25";
                  borderColor = "border-l-2 border-l-sky-500";
                }

                const cleanedNick = log.userNick.replace(/^@/, "").trim();
                const avatarHeadUrl = `https://www.habbo.com.br/habbo-imaging/avatarimage?img_format=png&user=${encodeURIComponent(cleanedNick)}&direction=2&head_direction=2&gesture=std&size=s&headonly=1`;

                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`p-3.5 hover:bg-fmb-slate/10 transition-colors flex items-start space-x-3.5 ${borderColor}`}
                  >
                    {/* Habbo Face Avatar */}
                    <div className="w-8 h-8 rounded-full border border-fmb-army/30 bg-fmb-slate flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                      <img
                        src={avatarHeadUrl}
                        alt={log.userNick}
                        onError={(e) => {
                          // Fallback icon
                          e.currentTarget.style.display = 'none';
                        }}
                        className="scale-125 translate-y-0.5"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    {/* Dispatch Details */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <div className="flex items-center flex-wrap gap-1.5">
                          <span className="text-xs font-bold text-gray-200 font-mono">@{cleanedNick}</span>
                          <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border font-mono ${badgeColor}`}>
                            {log.action}
                          </span>
                          {isTakingTwoWarnings && (
                            <span className="text-[8px] font-black uppercase text-red-500 bg-red-500/20 px-1.5 py-0.5 rounded border border-red-500/30 animate-pulse flex items-center space-x-1 shrink-0">
                              <AlertTriangle className="w-2.5 h-2.5 text-red-500 shrink-0" />
                              <span>2ª ADVERTÊNCIA - RISCO EXPULSÃO</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1 text-[9px] text-gray-500 font-mono">
                          <Clock className="w-3 h-3 text-gray-600" />
                          <span>{formatDate(log.timestamp)}</span>
                        </div>
                      </div>

                      <p className="text-[11px] text-gray-300 leading-relaxed font-sans font-medium whitespace-pre-wrap">
                        {log.details}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}
