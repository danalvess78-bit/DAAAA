import React, { useEffect, useState } from "react";
import { 
  GraduationCap, Plus, Calendar, Clock, BookOpen, AlertTriangle, 
  Check, X, Users, Award, Shield, UserCheck 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../lib/api.js";
import { User, Training, MilitaryRank, getRankOrder } from "../types.js";
import ConfirmModal from "./ConfirmModal.js";

interface TrainingsPanelProps {
  viewer: User;
  onRefreshStats?: () => void;
}

const parseCategory = (cat: string) => {
  const match = cat.match(/^\[(.*?)\]\s*(.*)$/);
  if (match) {
    return { abbrev: match[1], fullName: match[2] };
  }
  return { abbrev: cat, fullName: cat };
};

const compareNicks = (n1: string, n2: string) => {
  const clean = (n: string) => n.replace(/^@/, "").trim().toLowerCase();
  return clean(n1) === clean(n2);
};

export default function TrainingsPanel({ viewer, onRefreshStats }: TrainingsPanelProps) {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Leaderboard lists
  const [topInstructors, setTopInstructors] = useState<User[]>([]);

  // Form State for manual scheduling
  const [showAddModal, setShowAddModal] = useState(false);
  const [trName, setTrName] = useState("");
  const [trCategory, setTrCategory] = useState("Ata Básico");
  const [trDesc, setTrDesc] = useState("");
  const [trDate, setTrDate] = useState(new Date().toISOString().split("T")[0]);
  const [trTime, setTrTime] = useState(new Date().toTimeString().slice(0, 5));
  const [participantsCount, setParticipantsCount] = useState<string>("");

  // Edit state variables
  const [editingTrainingId, setEditingTrainingId] = useState<string | null>(null);
  const [editTrName, setEditTrName] = useState("");
  const [editTrCategory, setEditTrCategory] = useState("Ata Básico");
  const [editTrDesc, setEditTrDesc] = useState("");
  const [editTrDate, setEditTrDate] = useState("");
  const [editTrTime, setEditTrTime] = useState("");
  const [editParticipants, setEditParticipants] = useState("");

  // Complete Training form state
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [finalAttendees, setFinalAttendees] = useState("");
  
  // Custom permissions checker
  const [hasTrainAccess, setHasTrainAccess] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  // Deletion and cancellation confirmation states
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await api.getTrainings();
      setTrainings(list || []);

      const rankings = await api.getRankings();
      setTopInstructors(rankings.topInstructors || []);

      let subCargoCanTrain = false;
      try {
        const subCargos = await api.getSubCargos();
        subCargoCanTrain = (viewer.subCargos || []).some(scId => {
          const scObj = subCargos.find((x: any) => x.id === scId);
          return scObj?.permissions?.canTrain || scObj?.permissions?.canAdminSystem;
        });
      } catch (scErr) {
        console.warn("Erro ao obter subcargos em TrainingsPanel", scErr);
      }

      try {
        const hierarchy = await api.getHierarchy();
        const userConfig = hierarchy.find((rc: any) => rc.rank === viewer.role);
        const canTrain = viewer.role === MilitaryRank.ADMSUPREMO || 
                         !!userConfig?.permissions?.canTrain || 
                         !!userConfig?.permissions?.canAdminSystem ||
                         subCargoCanTrain;
        setHasTrainAccess(canTrain);
      } catch (hierErr) {
        console.warn("Erro ao obter hierarquias de instrução:", hierErr);
        setHasTrainAccess(viewer.role === MilitaryRank.ADMSUPREMO || subCargoCanTrain);
      }

      try {
        const categories = await api.getTrainingCategories();
        // Filter categories so only those with minRank <= viewer.role are visible
        const allowedCategories = (categories || []).filter((c: any) => {
          const minRankVal = typeof c === 'string' ? MilitaryRank.SOLDADO : (c.minRank || MilitaryRank.SOLDADO);
          return getRankOrder(viewer.role) >= getRankOrder(minRankVal);
        });
        const catNames = allowedCategories.map((c: any) => typeof c === 'string' ? c : c.name);
        setAvailableCategories(catNames);
        if (catNames && catNames.length > 0) {
          // Only preset default if not already set or standard fallback
          setTrCategory(prev => {
            if (prev === "Ata Básico" && !catNames.includes("Ata Básico")) {
              const parsed = parseCategory(catNames[0]);
              setTrName(parsed.fullName);
              return parsed.abbrev;
            } else {
              // Also ensure we set title if default matches
              const activeCat = catNames.find(c => parseCategory(c).abbrev === prev) || prev;
              const parsed = parseCategory(activeCat);
              setTrName(parsed.fullName);
            }
            return prev;
          });
          setEditTrCategory(prev => {
            if (prev === "Ata Básico" && !catNames.includes("Ata Básico")) {
              return parseCategory(catNames[0]).abbrev;
            }
            return prev;
          });
        }
      } catch (catErr) {
        console.warn("Erro ao obter categorias dinâmicas de treinamento:", catErr);
      }
    } catch (err: any) {
      setError(err.message || "Erro ao listar atas de instrução.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStartEdit = (t: Training) => {
    setEditingTrainingId(t.id);
    setEditTrName(t.name);
    setEditTrCategory(t.category);
    setEditTrDesc(t.description);
    setEditTrDate(t.date);
    setEditTrTime(t.time);
    setEditParticipants(t.participants.join(", "));
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTrName || !editTrDesc || !editingTrainingId) {
      alert("Insira os dados indispensáveis para edição.");
      return;
    }
    const attendees = editParticipants
      .split(",")
      .map(p => p.trim())
      .filter(p => p.length > 0);

    try {
      await api.updateTraining(editingTrainingId, {
        name: editTrName,
        category: editTrCategory,
        description: editTrDesc,
        date: editTrDate,
        time: editTrTime,
        participants: attendees
      });
      setEditingTrainingId(null);
      loadData();
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      alert(err.message || "Erro ao atualizar dados do treinamento.");
    }
  };

  const handleDeleteTraining = (id: string) => {
    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await api.deleteTraining(confirmDeleteId);
      loadData();
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      alert(err.message || "Falha ao apagar ata.");
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trName || !trDesc) {
      alert("Insira os dados indispensáveis.");
      return;
    }

    // Split participants by commas
    const attendees = participantsCount
      .split(",")
      .map(p => p.trim())
      .filter(p => p.length > 0);

    try {
      await api.createTraining(trName, trCategory, trDesc, attendees, trDate, trTime);
      setShowAddModal(false);
      setTrName("");
      setTrDesc("");
      setParticipantsCount("");
      loadData();
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      alert(err.message || "Erro ao marcar treinamento.");
    }
  };

  const handleCompleteSubmit = async (id: string) => {
    const attendees = finalAttendees
      .split(",")
      .map(p => p.trim())
      .filter(p => p.length > 0);

    try {
      await api.completeTraining(id, attendees);
      setCompletingId(null);
      setFinalAttendees("");
      loadData();
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      alert(err.message || "Tentativa frustrada.");
    }
  };

  const handleCancel = (id: string) => {
    setConfirmCancelId(id);
  };

  const handleConfirmCancel = async () => {
    if (!confirmCancelId) return;
    try {
      await api.cancelTraining(confirmCancelId);
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setConfirmCancelId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-fmb-army/20">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-5 h-5 text-fmb-gold" />
          <h3 className="font-display font-bold text-lg text-white uppercase tracking-tight">Companhia Integrada de Instruções</h3>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-fmb-army hover:bg-fmb-olive border border-fmb-gold/40 text-white px-3 py-1.5 rounded font-mono text-[10px] uppercase tracking-wider font-bold flex items-center space-x-1"
          id="create-training-btn"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Agendar Instrução</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: ACTIVE WORKSHOPS & LOGS */}
        <div className="lg:col-span-2 space-y-4">
          <h4 className="font-mono text-[10px] text-fmb-gold uppercase tracking-wider block font-black">
            COORDENADAS MILITARES DE TREINO EM DIAGNÓSTICO
          </h4>

          {loading ? (
            <div className="text-center py-6 font-mono text-gray-500 text-xs">Aguarde...</div>
          ) : trainings.length === 0 ? (
            <div className="border border-fmb-army/20 p-6 rounded text-center text-xs font-mono text-gray-500">
              Nenhuma ata de treinamento agendada ou registrada na corporação.
            </div>
          ) : (
            <div className="space-y-4">
              {trainings.map(t => (
                <div 
                  key={t.id} 
                  className={`bg-fmb-black border p-4 rounded-lg font-mono text-xs ${
                    t.status === "Concluido" 
                      ? "border-green-500/20 bg-green-950/5" 
                      : t.status === "Cancelado" 
                      ? "border-red-500/10 bg-red-950/2" 
                      : "border-fmb-gold/30"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-fmb-army/10 pb-2 mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="bg-fmb-slate px-2 py-0.5 border border-fmb-army/30 rounded text-[9px] text-fmb-gold font-bold">
                        {t.category}
                      </span>
                      <strong className="text-sm text-white">{t.name}</strong>
                    </div>

                    <div className="text-right">
                      {t.status === "Concluido" && (
                        <span className="text-[10px] font-bold text-green-400 uppercase">● CONCLUÍDO</span>
                      )}
                      {t.status === "Cancelado" && (
                        <span className="text-[10px] font-bold text-red-400/70 uppercase">● CANCELADO</span>
                      )}
                      {t.status === "Agendado" && (
                        <span className="text-[10px] font-bold text-amber-400 uppercase animate-pulse">● AGENDADO ATIVO</span>
                      )}
                    </div>
                  </div>

                  <p className="text-gray-400 leading-normal">{t.description}</p>

                  <div className="mt-3 pt-3 border-t border-fmb-army/10 grid grid-cols-2 gap-2 text-[10px] text-gray-500">
                    <div className="text-left space-y-1">
                      <div>INSTRUTOR: <strong className="text-fmb-gold">@{t.instructorName}</strong></div>
                      <div>PARTICIPANTES ({t.participants.length}): <span className="text-white">{t.participants.join(", ") || "Nenhum participante adicionado ainda."}</span></div>
                    </div>
                    <div className="text-right space-y-1">
                      <div>DATA: <strong className="text-white">{t.date}</strong></div>
                      <div>HORÁRIO: <strong className="text-white">{t.time}</strong></div>
                    </div>
                  </div>

                  {/* ACTIVE BUTTON ACTIONS */}
                  {t.status === "Agendado" && (compareNicks(viewer.habboNick, t.instructorName) || hasTrainAccess) && (
                    <div className="mt-4 pt-3 border-t border-fmb-army/15 flex flex-wrap justify-end gap-2">
                      <button
                        onClick={() => handleCancel(t.id)}
                        className="bg-red-950/30 border border-red-900/40 hover:bg-red-950/80 hover:border-red-500 text-red-200 px-3 py-1 rounded text-[10px] uppercase font-bold transition-all"
                      >
                        Cancelar
                      </button>

                      {completingId === t.id ? (
                        <div className="w-full mt-3 p-3 bg-fmb-slate border border-fmb-army/20 rounded space-y-2">
                          <label className="text-[9px] text-fmb-gold block uppercase font-bold">Relate os Nicks de quem Concluiu com Sucesso (Separados por Vírgula)</label>
                          <input 
                            type="text"
                            placeholder="Nick1, Nick2, Nick3"
                            value={finalAttendees}
                            onChange={(e) => setFinalAttendees(e.target.value)}
                            className="w-full bg-fmb-black border border-fmb-army/40 rounded py-1 px-2 text-white text-xs outline-none focus:border-fmb-gold"
                          />
                          <div className="flex justify-end space-x-2">
                            <button 
                              onClick={() => setCompletingId(null)}
                              className="px-2 py-1 bg-gray-800 text-gray-400 rounded text-[9px] uppercase"
                            >
                              Cancelar
                            </button>
                            <button 
                              onClick={() => handleCompleteSubmit(t.id)}
                              className="px-3 py-1 bg-green-700 text-white rounded text-[9px] font-bold uppercase"
                            >
                              Finalizar Ata
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setCompletingId(t.id);
                            setFinalAttendees(t.participants.join(", "));
                          }}
                          className="bg-green-700 hover:bg-green-800 text-white px-4 py-1 rounded text-[10px] uppercase font-bold flex items-center space-x-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Finalizar Treinamento</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* ADMIN EDIT / DELETE CORRECTIONS ACTION */}
                  {(compareNicks(viewer.habboNick, t.instructorName) || hasTrainAccess) && (
                    <div className="mt-4 pt-3 border-t border-fmb-army/15 flex justify-end space-x-2">
                      <button
                        onClick={() => handleStartEdit(t)}
                        className="bg-blue-950/20 border border-blue-900/35 hover:bg-blue-900/60 hover:text-white text-blue-300 py-1 px-3 rounded text-[9px] font-mono uppercase font-bold transition-all"
                      >
                        Editar Ata
                      </button>
                      <button
                        onClick={() => handleDeleteTraining(t.id)}
                        className="bg-red-950/20 border border-red-900/35 hover:bg-red-900/60 hover:text-white text-red-300 py-1 px-3 rounded text-[9px] font-mono uppercase font-bold transition-all"
                      >
                        Excluir Ata
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: LEADERS OF ACADEMY (TOP INSTRUCTORS) */}
        <div className="bg-fmb-black/85 border border-fmb-army/30 p-5 rounded-lg h-fit space-y-4">
          <h4 className="font-display font-extrabold text-sm text-fmb-gold uppercase tracking-wider border-b border-fmb-army/20 pb-2 flex items-center space-x-1.5">
            <Award className="w-4 h-4" />
            <span>Top Instrutores (Turmas)</span>
          </h4>

          {topInstructors.length === 0 ? (
            <p className="text-xs font-mono text-gray-500 py-6 text-center italic">
              Nenhum instrutor catalogado com treinamento concluído.
            </p>
          ) : (
            <div className="space-y-4">
              {topInstructors.map((ins, index) => (
                <div 
                  key={ins.id}
                  className="flex items-center justify-between p-3 bg-fmb-slate/20 border border-fmb-army/15 rounded-lg"
                >
                  <div className="flex items-center space-x-2.5">
                    <span className="font-mono text-xs font-black text-fmb-gold w-4">#{index + 1}</span>
                    
                    <div className="w-10 h-10 bg-fmb-black border border-fmb-army/20 rounded-full overflow-hidden shrink-0 flex items-center justify-center relative">
                      <img 
                        src={`https://www.habbo.com/habbo-imaging/avatarimage?figure=${ins.habboAvatar}&size=m&direction=3&head_direction=3&gesture=sml&action=std`} 
                        alt={ins.habboNick}
                        className="scale-125 translate-y-1.5"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    <div className="text-left font-mono leading-tight">
                      <strong className="text-white text-xs block">@{ins.habboNick}</strong>
                      <span className="text-[9px] text-fmb-gold mt-0.5 block font-bold truncate max-w-[110px]">{ins.role}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-mono text-sm font-bold text-white block">
                      {ins.trainingsCreated}
                    </span>
                    <span className="text-[8px] text-gray-500 uppercase block font-semibold">Instruções</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* CREATE INSTRUCTION DIALOG MODAL */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-fmb-black border border-fmb-gold/40 text-white rounded-lg shadow-2xl p-6 relative"
            >
              <button 
                onClick={() => setShowAddModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-6">
                <GraduationCap className="w-10 h-10 text-fmb-gold mx-auto mb-2" />
                <h3 className="font-display font-extrabold text-lg text-white uppercase">Ata de Ensino e Instrução</h3>
                <p className="text-[10px] font-mono text-gray-400">AGENDAR CAPACITAÇÃO NO COMANDAMENTO FMB</p>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4 font-mono text-xs text-left">
                <div>
                  <label className="text-[10px] text-fmb-gold block uppercase mb-1">Título de Capacitação / Nome</label>
                  <input
                    type="text"
                    placeholder="Ex: Treinamento Ortográfico Básico"
                    value={trName}
                    onChange={(e) => setTrName(e.target.value)}
                    className="w-full bg-fmb-slate border border-fmb-army/30 py-2 px-3 rounded text-white outline-none focus:border-fmb-gold"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-fmb-gold block uppercase mb-1">Categoria</label>
                    <select
                      value={availableCategories.find(cat => parseCategory(cat).abbrev === trCategory) || trCategory}
                      onChange={(e) => {
                        const selectedRaw = e.target.value;
                        const parsed = parseCategory(selectedRaw);
                        setTrCategory(parsed.abbrev);
                        setTrName(parsed.fullName);
                      }}
                      className="w-full bg-fmb-slate border border-fmb-army/30 py-2 px-3 rounded text-white outline-none cursor-pointer"
                    >
                      {availableCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      {availableCategories.length === 0 && (
                        <option value="Ata Básico">Ata Básico</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-fmb-gold block uppercase mb-1">Instrutor de Comando</label>
                    <input
                      type="text"
                      value={`@${viewer.habboNick}`}
                      disabled
                      className="w-full bg-fmb-slate/40 border border-fmb-army/10 py-2 px-3 rounded text-gray-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-fmb-gold block uppercase mb-1">Data Agendada</label>
                    <input
                      type="date"
                      value={trDate}
                      onChange={(e) => setTrDate(e.target.value)}
                      className="w-full bg-fmb-slate border border-fmb-army/30 py-1.5 px-3 rounded text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-fmb-gold block uppercase mb-1">Horário Agendado</label>
                    <input
                      type="time"
                      value={trTime}
                      onChange={(e) => setTrTime(e.target.value)}
                      className="w-full bg-fmb-slate border border-fmb-army/30 py-1.5 px-3 rounded text-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-fmb-gold block uppercase mb-1">Descrição Curricular de Atividades</label>
                  <textarea
                    placeholder="Especifique as matérias abordadas nas lições táticas da ata..."
                    value={trDesc}
                    onChange={(e) => setTrDesc(e.target.value)}
                    rows={2}
                    className="w-full bg-fmb-slate border border-fmb-army/30 py-2 px-3 rounded text-white outline-none resize-none focus:border-fmb-gold"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] text-fmb-gold block uppercase mb-1">Nicks dos Candidatos (Separados por Vírgula)</label>
                  <input
                    type="text"
                    placeholder="Recruta1, Recruta2"
                    value={participantsCount}
                    onChange={(e) => setParticipantsCount(e.target.value)}
                    className="w-full bg-fmb-slate border border-fmb-army/30 py-2 px-3 rounded text-white outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-fmb-army hover:bg-fmb-olive border border-fmb-gold/55 py-2.5 rounded font-bold text-xs uppercase tracking-wider text-white"
                >
                  Confirmar Agendamento Tático
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {editingTrainingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-fmb-black border border-fmb-gold/40 text-white rounded-lg shadow-2xl p-6 relative"
            >
              <button 
                onClick={() => setEditingTrainingId(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-6">
                <GraduationCap className="w-10 h-10 text-fmb-gold mx-auto mb-2" />
                <h3 className="font-display font-extrabold text-lg text-white uppercase">Retificar Ata de Ensino</h3>
                <p className="text-[10px] font-mono text-gray-400">CORREÇÕES DE SEGURANÇA NO LIVRO DE ATAS</p>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4 font-mono text-xs text-left">
                <div>
                  <label className="text-[10px] text-fmb-gold block uppercase mb-1">Título de Capacitação / Nome</label>
                  <input
                    type="text"
                    value={editTrName}
                    onChange={(e) => setEditTrName(e.target.value)}
                    className="w-full bg-fmb-slate border border-fmb-army/30 py-2 px-3 rounded text-white outline-none focus:border-fmb-gold"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-fmb-gold block uppercase mb-1">Categoria de Treino</label>
                    <select
                      value={availableCategories.find(cat => parseCategory(cat).abbrev === editTrCategory) || editTrCategory}
                      onChange={(e) => {
                        const selectedRaw = e.target.value;
                        const parsed = parseCategory(selectedRaw);
                        setEditTrCategory(parsed.abbrev);
                        setEditTrName(parsed.fullName);
                      }}
                      className="w-full bg-fmb-slate border border-fmb-army/30 py-2 px-3 rounded text-white outline-none cursor-pointer"
                    >
                      {availableCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      {availableCategories.length === 0 && (
                        <option value="Ata Básico">Ata Básico</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-fmb-gold block uppercase mb-1">Instrutor Designado</label>
                    <input
                      type="text"
                      value={`@${viewer.habboNick}`}
                      disabled
                      className="w-full bg-fmb-slate/40 border border-fmb-army/10 py-2 px-3 rounded text-gray-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-fmb-gold block uppercase mb-1">Data</label>
                    <input
                      type="date"
                      value={editTrDate}
                      onChange={(e) => setEditTrDate(e.target.value)}
                      className="w-full bg-fmb-slate border border-fmb-army/30 py-1.5 px-3 rounded text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-fmb-gold block uppercase mb-1">Horário</label>
                    <input
                      type="time"
                      value={editTrTime}
                      onChange={(e) => setEditTrTime(e.target.value)}
                      className="w-full bg-fmb-slate border border-fmb-army/30 py-1.5 px-3 rounded text-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-fmb-gold block uppercase mb-1">Descrição Curricular</label>
                  <textarea
                    value={editTrDesc}
                    onChange={(e) => setEditTrDesc(e.target.value)}
                    rows={2}
                    className="w-full bg-fmb-slate border border-fmb-army/30 py-2 px-3 rounded text-white outline-none resize-none focus:border-fmb-gold"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] text-fmb-gold block uppercase mb-1">Nicks dos Participantes (Separados por Vírgula)</label>
                  <input
                    type="text"
                    value={editParticipants}
                    onChange={(e) => setEditParticipants(e.target.value)}
                    className="w-full bg-fmb-slate border border-fmb-army/30 py-2 px-3 rounded text-white outline-none focus:border-fmb-gold"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-fmb-army hover:bg-fmb-olive border border-fmb-gold/55 py-2.5 rounded font-bold text-xs uppercase tracking-wider text-white"
                >
                  Salvar Mudanças na Ata
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={confirmDeleteId !== null}
        title="Excluir Ata de Instrução"
        message="Atenção Militar: Tem certeza que deseja excluir permanentemente esta ata de instrução do QG? Esta operação não pode ser desfeita e será reportada nas auditorias do comando."
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />

      <ConfirmModal
        isOpen={confirmCancelId !== null}
        title="Cancelar Treinamento"
        message="Atenção Militar: Deseja realmente confirmar o cancelamento oficial destas coordenadas de ensino militar? O status passará a Cancelado."
        onConfirm={handleConfirmCancel}
        onCancel={() => setConfirmCancelId(null)}
        isDanger={true}
        confirmLabel="Cancelar Treino"
      />

    </div>
  );
}
