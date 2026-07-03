import React, { useState, useEffect } from "react";
import { 
  Clock, 
  Search, 
  Calendar, 
  User as UserIcon, 
  Power, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw,
  FileSpreadsheet,
  ArrowUpDown
} from "lucide-react";
import { api } from "../lib/api";
import { PontoLog, User, UserActiveState } from "../types";

interface PontoPanelProps {
  viewer: User;
}

export const PontoPanel: React.FC<PontoPanelProps> = ({ viewer }) => {
  const [logs, setLogs] = useState<PontoLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterNick, setFilterNick] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [updatingState, setUpdatingState] = useState(false);
  const [localUserState, setLocalUserState] = useState<UserActiveState>(viewer.activeState);
  
  // Dynamic timer state for current viewer's session if active
  const [localTimer, setLocalTimer] = useState(0);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await api.getPontes();
      // Sort logs descending by check-in time by default
      const sorted = [...data].sort((a, b) => {
        return new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime();
      });
      setLogs(sorted);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Erro ao buscar registros de ponto.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // Update local user active state
    setLocalUserState(viewer.activeState);
  }, [viewer.activeState]);

  // Find active point for this user if exists
  const activeUserPoint = logs.find(l => l.userId === viewer.id && !l.checkOutTime);
  
  useEffect(() => {
    let timerInterval: NodeJS.Timeout;
    if (activeUserPoint) {
      const checkInMs = new Date(activeUserPoint.checkInTime).getTime();
      const updateTimer = () => {
        const elapsedSeconds = Math.floor((Date.now() - checkInMs) / 1000);
        setLocalTimer(elapsedSeconds > 0 ? elapsedSeconds : 0);
      };
      updateTimer();
      timerInterval = setInterval(updateTimer, 1000);
    } else {
      setLocalTimer(0);
    }
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [activeUserPoint, logs]);

  const handlePontoToggle = async () => {
    try {
      setUpdatingState(true);
      if (localUserState === UserActiveState.EM_SERVICO) {
        await api.clockOut();
        setLocalUserState(UserActiveState.ONLINE);
      } else {
        await api.clockIn();
        setLocalUserState(UserActiveState.EM_SERVICO);
      }
      // Re-fetch points list immediately to dynamically update
      await fetchLogs();
      // Refresh the global page data
      window.location.reload(); 
    } catch (err: any) {
      alert(err.message || "Falha ao registrar ponto.");
    } finally {
      setUpdatingState(false);
    }
  };

  const activePoints = logs.filter(l => !l.checkOutTime);
  const closedPoints = logs.filter(l => !!l.checkOutTime);

  // Apply filters
  const filteredClosedPoints = closedPoints.filter(l => {
    const matchesNick = l.userNick.toLowerCase().includes(filterNick.toLowerCase());
    const matchesDate = filterDate ? l.date === filterDate : true;
    return matchesNick && matchesDate;
  });

  const formatSeconds = (totalSeconds: number) => {
    if (totalSeconds <= 0) return "0s";
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    let parts: string[] = [];
    if (hrs > 0) parts.push(`${hrs}h`);
    if (mins > 0) parts.push(`${mins}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    return parts.join(" ");
  };

  const formatHourString = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return "--:--:--";
    }
  };

  const formatDateString = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch {
      return "Data inválida";
    }
  };

  return (
    <div className="space-y-6">
      
      {/* TITLE & HEADER CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-fmb-army/20">
        <div className="flex items-center space-x-2">
          <Clock className="w-5 h-5 text-fmb-gold" />
          <h3 className="font-display font-bold text-lg text-white uppercase tracking-tight">Registro & Folha de Pontos</h3>
        </div>
        
        <button
          onClick={fetchLogs}
          className="flex items-center space-x-1.5 px-3 py-1 bg-fmb-slate text-[10px] font-mono hover:bg-fmb-slate/80 text-gray-300 rounded border border-fmb-army/20 transition-all uppercase"
          disabled={loading}
          id="refresh-pontes-btn"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Sincronizar Folha</span>
        </button>
      </div>

      {/* MY DIRECT CONTROL BOX */}
      <div className="p-5 rounded-lg border bg-fmb-black/95 relative overflow-hidden border-fmb-army/30">
        <div className="absolute top-0 right-0 p-3 bg-fmb-army/10 text-fmb-gold uppercase font-mono text-[9px] tracking-widest rounded-bl">
          Espelho de Ponto Individual
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-fmb-dark border border-fmb-army rounded-full overflow-hidden flex items-center justify-center shrink-0">
              <img 
                src={`https://www.habbo.com/habbo-imaging/avatarimage?figure=${viewer.habboAvatar}&size=m&direction=3&head_direction=3&gesture=sml&action=std`}
                alt={viewer.habboNick}
                className="scale-125 translate-y-2 mt-1"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h4 className="font-bold text-white text-base leading-none mb-1">{viewer.habboNick}</h4>
              <p className="text-xs font-mono text-fmb-gold uppercase tracking-wider">{viewer.role}</p>
              
              {localUserState === UserActiveState.EM_SERVICO ? (
                <div className="flex items-center text-[10px] font-mono text-amber-400 mt-1">
                  <span className="w-2 h-2 bg-amber-400 rounded-full animate-ping mr-1.5 shrink-0" />
                  <span>Militar em serviço • Tempo: {formatSeconds(localTimer)}</span>
                </div>
              ) : (
                <div className="flex items-center text-[10px] font-mono text-green-400 mt-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full mr-1.5 shrink-0" />
                  <span>Disponível para serviço ativo</span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handlePontoToggle}
            disabled={updatingState}
            className={`px-5 py-3 rounded font-mono text-xs uppercase tracking-widest font-bold shadow flex items-center justify-center space-x-2 transition-all ${
              localUserState === UserActiveState.EM_SERVICO
                ? "bg-red-700 hover:bg-red-800 text-white border border-red-500/30 active:scale-95"
                : "bg-fmb-army hover:bg-fmb-olive text-white border border-fmb-gold/40 active:scale-95 animate-pulse"
            }`}
            id="panel-clocking-ponto-btn"
          >
            <Power className="w-4 h-4" />
            <span>{localUserState === UserActiveState.EM_SERVICO ? "Encerrar Expediente FMB" : "Iniciar Expediente Militar"}</span>
          </button>
        </div>
      </div>

      {/* LOADING / ERROR STATE BAR */}
      {error && (
        <div className="bg-red-950/40 border border-red-500/20 p-3 rounded flex items-center space-x-2 text-red-200 text-xs">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* ACTIVE EXPEDIENTS SECTION */}
      <div className="space-y-3">
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse" />
          <h4 className="font-display font-semibold text-white text-sm uppercase tracking-wider">Pontos em Andamento ({activePoints.length})</h4>
        </div>

        {activePoints.length === 0 ? (
          <div className="p-4 rounded border border-fmb-army/10 bg-fmb-slate/20 text-center text-xs text-gray-500 font-mono">
            Nenhum militar possui folha de serviço aberta neste instante.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activePoints.map(p => {
              const checkInMs = new Date(p.checkInTime).getTime();
              // Calculate dynamic seconds for each loop card
              const initialSec = Math.floor((Date.now() - checkInMs) / 1000);
              return (
                <ActiveTimerCard 
                  key={p.id} 
                  p={p} 
                  initialSeconds={initialSec > 0 ? initialSec : 0} 
                  formatSeconds={formatSeconds}
                  formatHourString={formatHourString}
                  formatDateString={formatDateString}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* HISTORIC AUDIT EXPEDIENTS SECTION */}
      <div className="space-y-3 mt-8">
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 bg-green-500 rounded-full" />
          <h4 className="font-display font-semibold text-white text-sm uppercase tracking-wider">Histórico de Expedientes Fechados</h4>
        </div>

        {/* Filters bar */}
        <div className="bg-fmb-black/50 border border-fmb-army/20 p-4 rounded-lg flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="text-xs font-mono text-gray-400">
            Filtrando <span className="text-fmb-gold font-bold">{filteredClosedPoints.length}</span> registros de {closedPoints.length} totais
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative shrink-0 w-full sm:w-48">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Pesquisar por Habbo Nick..."
                value={filterNick}
                onChange={(e) => setFilterNick(e.target.value)}
                className="w-full bg-fmb-dark border border-fmb-army/30 rounded pl-8 pr-3 py-1.5 font-mono text-[11px] text-white focus:outline-none focus:border-fmb-gold placeholder:text-gray-600"
                id="filter-ponto-nick"
              />
            </div>

            <div className="relative shrink-0 w-full sm:w-44">
              <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full bg-fmb-dark border border-fmb-army/30 rounded pl-8 pr-3 py-1.5 font-mono text-[11px] text-white focus:outline-none focus:border-fmb-gold"
                id="filter-ponto-date"
              />
            </div>

            {(filterNick || filterDate) && (
              <button
                onClick={() => { setFilterNick(""); setFilterDate(""); }}
                className="px-2.5 py-1.5 bg-fmb-slate hover:bg-fmb-slate/80 text-[10px] font-mono text-fmb-gold rounded border border-fmb-gold/25 uppercase shrink-0"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Desktop Table / Mobile Cards */}
        {loading ? (
          <div className="p-8 text-center text-xs text-gray-400 font-mono flex items-center justify-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin text-fmb-gold" />
            <span>Consultando banco tático de expedição...</span>
          </div>
        ) : filteredClosedPoints.length === 0 ? (
          <div className="p-8 rounded border border-fmb-army/10 bg-fmb-slate/10 text-center text-xs text-gray-500 font-mono">
            Nenhum registro correspondente aos filtros foi localizado militarmente.
          </div>
        ) : (
          <div className="overflow-x-auto border border-fmb-army/30 rounded-lg bg-fmb-black/95">
            <table className="min-w-full divide-y divide-fmb-army/20 text-xs text-left" id="point-logs-audit-table">
              <thead className="bg-fmb-slate/30 text-[10px] font-mono text-gray-400 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-semibold">Militar (Nick)</th>
                  <th className="px-4 py-3 font-semibold">Data Expediente</th>
                  <th className="px-4 py-3 font-semibold">Horário Abertura</th>
                  <th className="px-4 py-3 font-semibold">Horário Término</th>
                  <th className="px-4 py-3 font-semibold text-right">Tempo Servido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fmb-army/10 font-mono text-gray-200">
                {filteredClosedPoints.map((log) => (
                  <tr key={log.id} className="hover:bg-fmb-slate/10 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <UserIcon className="w-3.5 h-3.5 text-fmb-gold shrink-0" />
                        <span className="font-bold text-white">{log.userNick}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {formatDateString(log.checkInTime)}
                    </td>
                    <td className="px-4 py-3 text-green-400 font-semibold">
                      {formatHourString(log.checkInTime)}
                    </td>
                    <td className="px-4 py-3 text-red-400">
                      {log.checkOutTime ? formatHourString(log.checkOutTime) : "Em aberto"}
                    </td>
                    <td className="px-4 py-3 text-right text-fmb-gold font-bold">
                      {formatSeconds(log.durationSeconds)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

/* INTERNAL COMPONENT: ActiveTimerCard */
interface ActiveTimerCardProps {
  p: PontoLog;
  initialSeconds: number;
  formatSeconds: (sec: number) => string;
  formatHourString: (isoStr: string) => string;
  formatDateString: (isoStr: string) => string;
}

const ActiveTimerCard: React.FC<ActiveTimerCardProps> = ({ 
  p, 
  initialSeconds, 
  formatSeconds,
  formatHourString,
  formatDateString
}) => {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 bg-fmb-black border border-amber-500/30 rounded-lg relative overflow-hidden shadow-md flex flex-col justify-between">
      <div className="absolute top-0 right-0 p-1.5 bg-amber-500/10 text-amber-400 rounded-bl text-[8px] font-mono uppercase tracking-widest font-semibold">
        Serviço em Progresso
      </div>

      <div className="flex items-center space-x-3.5 mb-3">
        <div className="w-10 h-10 border border-amber-500/30 rounded-full p-0.5 shrink-0 flex items-center justify-center bg-fmb-dark font-display font-black text-amber-500 text-sm">
          FMB
        </div>
        <div>
          <h5 className="font-bold text-white text-sm leading-none mb-1">{p.userNick}</h5>
          <span className="text-[10px] font-mono text-gray-500 block">ABRIU ÀS {formatHourString(p.checkInTime)}</span>
        </div>
      </div>

      <div className="pt-2 border-t border-fmb-army/20 flex items-center justify-between text-xs font-mono">
        <span className="text-gray-400">Tempo:</span>
        <span className="text-amber-400 font-bold tracking-wider animate-pulse">{formatSeconds(seconds)}</span>
      </div>
    </div>
  );
};
