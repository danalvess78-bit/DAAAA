import React, { useEffect, useState } from "react";
import { 
  Award, Shield, Plus, Target, CheckCircle2, ChevronRight, X, 
  Trash2, HelpCircle, Trophy, Sparkles, BookOpen, Timer, Send 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../lib/api.js";
import { User, Mission, MissionProgress, MilitaryRank, LIST_OF_MEDALS } from "../types.js";
import ConfirmModal from "./ConfirmModal.js";

interface MissionsPanelProps {
  viewer: User;
}

export default function MissionsPanel({ viewer }: MissionsPanelProps) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [progresses, setProgresses] = useState<MissionProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add state for supreme command
  const [showAddModal, setShowAddModal] = useState(false);
  const [mTitle, setMTitle] = useState("");
  const [mDesc, setMDesc] = useState("");
  const [mCategory, setMCategory] = useState<"trainings" | "service_hours" | "promotions" | "operations">("trainings");
  const [mTarget, setMTarget] = useState<number>(3);
  const [mRewardPoints, setMRewardPoints] = useState<number>(10);
  const [mRewardDestaque, setMRewardDestaque] = useState(false);
  const [selectedRewardMedals, setSelectedRewardMedals] = useState<string[]>([]);

  // Edit mission parameters
  const [editingMissionId, setEditingMissionId] = useState<string | null>(null);
  const [editMTitle, setEditMTitle] = useState("");
  const [editMDesc, setEditMDesc] = useState("");
  const [editMCategory, setEditMCategory] = useState<"trainings" | "service_hours" | "promotions" | "operations">("trainings");
  const [editMTarget, setEditMTarget] = useState<number>(3);
  const [editMRewardPoints, setEditMRewardPoints] = useState<number>(10);
  const [editMRewardDestaque, setEditMRewardDestaque] = useState(false);
  const [editRewardMedals, setEditRewardMedals] = useState<string[]>([]);

  // Permissions checker
  const [hasMissionAccess, setHasMissionAccess] = useState(false);

  // Deletion confirmation modal state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await api.getMissions();
      setMissions(list || []);

      // Get progress for current active logged-in user
      const meData = await api.getUserById(viewer.id);
      setProgresses(meData.progress || []);

      try {
        const hierarchy = await api.getHierarchy();
        const userConfig = hierarchy.find((rc: any) => rc.rank === viewer.role);
        const canManageMissions = viewer.role === MilitaryRank.ADMSUPREMO || !!userConfig?.permissions?.canManageMissions || !!userConfig?.permissions?.canAdminSystem;
        setHasMissionAccess(canManageMissions);
      } catch (hierErr) {
        console.warn("Erro ao obter hierarquia de missões:", hierErr);
        setHasMissionAccess(viewer.role === MilitaryRank.ADMSUPREMO);
      }
    } catch (err: any) {
      setError(err.message || "Erro ao obter plano de operações.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStartEdit = (m: Mission) => {
    setEditingMissionId(m.id);
    setEditMTitle(m.title);
    setEditMDesc(m.description);
    setEditMCategory(m.targetCategory as any);
    setEditMTarget(m.targetCount);
    setEditMRewardPoints(m.rewardPoints);
    setEditMRewardDestaque(m.rewardDestaque);
    setEditRewardMedals(m.rewardMedals || []);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMTitle || !editMDesc || !editingMissionId) {
      alert("Título e descrição são requeridos.");
      return;
    }

    try {
      await api.updateMission(editingMissionId, {
        title: editMTitle,
        description: editMDesc,
        targetCategory: editMCategory,
        targetCount: editMTarget,
        rewardMedals: editRewardMedals,
        rewardPoints: editMRewardPoints,
        rewardDestaque: editMRewardDestaque
      });
      setEditingMissionId(null);
      loadData();
    } catch (err: any) {
      alert(err.message || "Erro ao atualizar parâmetros da missão.");
    }
  };

  const toggleEditMedalSelection = (medalId: string) => {
    if (editRewardMedals.includes(medalId)) {
      setEditRewardMedals(prev => prev.filter(id => id !== medalId));
    } else {
      setEditRewardMedals(prev => [...prev, medalId]);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mTitle || !mDesc) {
      alert("Título e descrição são requeridos.");
      return;
    }

    try {
      await api.createMission(
        mTitle, 
        mDesc, 
        mCategory, 
        mTarget, 
        selectedRewardMedals, 
        mRewardPoints, 
        mRewardDestaque
      );
      setShowAddModal(false);
      setMTitle("");
      setMDesc("");
      setMTarget(3);
      setSelectedRewardMedals([]);
      loadData();
    } catch (err: any) {
      alert(err.message || "Erro ao criar missão.");
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await api.deleteMission(confirmDeleteId);
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const toggleMedalSelection = (medalId: string) => {
    if (selectedRewardMedals.includes(medalId)) {
      setSelectedRewardMedals(prev => prev.filter(id => id !== medalId));
    } else {
      setSelectedRewardMedals(prev => [...prev, medalId]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-fmb-army/20">
        <div className="flex items-center space-x-2">
          <Target className="w-5 h-5 text-fmb-gold" />
          <h3 className="font-display font-bold text-lg text-white uppercase tracking-tight">Quadro de Missões Táticas</h3>
        </div>

        {hasMissionAccess && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-fmb-army hover:bg-fmb-olive border border-fmb-gold/40 text-white px-3 py-1.5 rounded font-mono text-[10px] uppercase tracking-wider font-bold flex items-center space-x-1"
            id="admin-create-mission-btn"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Criar Nova Missão</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-6 font-mono text-gray-500 text-xs">Sincronizando banco operacional...</div>
      ) : missions.length === 0 ? (
        <div className="border border-fmb-army/20 p-6 rounded text-center text-xs font-mono text-gray-500">
          Nenhuma missão ativa despachada pelo Comando Supremo neste período.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {missions.map(m => {
            // Find relative progress for active user
            const progress = progresses.find(p => p.missionId === m.id);
            const current = progress ? progress.currentCount : 0;
            const completed = progress ? progress.completed : false;

            // Define display targets
            let targetLabel = `${current} / ${m.targetCount}`;
            let percentage = Math.min(100, Math.round((current / m.targetCount) * 100));

            if (m.targetCategory === "service_hours") {
              const currentHrs = (current / 3600).toFixed(1);
              const targetHrs = (m.targetCount / 3600).toFixed(0);
              targetLabel = `${currentHrs}h / ${targetHrs}h`;
              percentage = Math.min(100, Math.round((parseFloat(currentHrs) / parseFloat(targetHrs)) * 100));
            }

            return (
              <div 
                key={m.id}
                className={`bg-fmb-black border p-5 rounded-lg font-mono text-xs relative overflow-hidden flex flex-col justify-between ${
                  completed 
                    ? "border-green-500/35 bg-green-950/5" 
                    : "border-fmb-army/30 hover:border-fmb-gold/40 transition-colors"
                }`}
              >
                {/* Admin edit/delete overlay */}
                {hasMissionAccess && (
                  <div className="absolute top-2 right-2 flex items-center space-x-1">
                    <button 
                      onClick={() => handleStartEdit(m)}
                      className="text-gray-500 hover:text-fmb-gold p-1 bg-fmb-slate/20 hover:bg-fmb-slate/60 rounded transition-colors"
                      title="Editar Missão"
                    >
                      <Plus className="w-3.5 h-3.5 rotate-45" />
                    </button>
                    <button 
                      onClick={() => handleDelete(m.id)}
                      className="text-gray-500 hover:text-red-400 p-1 bg-fmb-slate/20 hover:bg-fmb-slate/60 rounded transition-colors"
                      title="Remover Missão"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center space-x-1.5 font-bold mb-1">
                    {completed ? (
                      <CheckCircle2 className="w-4.5 h-4.5 text-green-500" />
                    ) : (
                      <Trophy className="w-4.5 h-4.5 text-fmb-gold shrink-0 animate-pulse" />
                    )}
                    <span className="text-white text-sm">{m.title}</span>
                  </div>

                  <p className="text-gray-400 leading-normal text-[11px]">{m.description}</p>
                </div>

                {/* Progress bar info */}
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-gray-500">PROGRESSO MILITAR</span>
                    <strong className={completed ? "text-green-400" : "text-fmb-gold"}>
                      {completed ? "100% COMPLETO" : `${targetLabel} (${percentage}%)`}
                    </strong>
                  </div>

                  {/* Visual tracking slider */}
                  <div className="h-1.5 w-full bg-fmb-slate/60 rounded overflow-hidden border border-fmb-army/10">
                    <div 
                      className={`h-full transition-all duration-500 ${completed ? "bg-green-500" : "bg-fmb-gold"}`} 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  {/* Rewards list display */}
                  <div className="pt-3 border-t border-fmb-army/10 flex flex-wrap gap-2 items-center text-[9px] text-gray-500">
                    <span>RECOMPENSAS:</span>
                    
                    {m.rewardPoints > 0 && (
                      <span className="px-1.5 py-0.5 bg-fmb-slate text-fmb-gold uppercase border border-fmb-army/25 rounded">
                        +{m.rewardPoints} Pontos
                      </span>
                    )}

                    {m.rewardDestaque && (
                      <span className="px-1.5 py-0.5 bg-fmb-slate text-green-400 uppercase border border-fmb-army/25 rounded">
                        Destaque Semanal
                      </span>
                    )}

                    {m.rewardMedals && m.rewardMedals.map(medalId => {
                      const medal = LIST_OF_MEDALS.find(md => md.id === medalId);
                      return medal ? (
                        <span key={medalId} className="px-1.5 py-0.5 bg-fmb-gold/10 text-fmb-gold border border-fmb-gold/30 rounded uppercase font-bold">
                          🥇 Medalha: {medal.title}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* CREATE MISSION MODAL (SUPREME COMMAND) */}
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
                <Target className="w-10 h-10 text-fmb-gold mx-auto mb-2" />
                <h3 className="font-display font-extrabold text-lg text-white uppercase">Registrar Missão Corporativa</h3>
                <p className="text-[10px] font-mono text-gray-400 text-center">PRIVILÉGIO ADMINISTRATIVO - ALTO COMANDO FMB</p>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4 font-mono text-xs text-left">
                <div>
                  <label className="text-[10px] text-fmb-gold block uppercase mb-1">Título do Objetivo</label>
                  <input
                    type="text"
                    placeholder="Ex: Treinamento Intensivo CFS"
                    value={mTitle}
                    onChange={(e) => setMTitle(e.target.value)}
                    className="w-full bg-fmb-slate border border-fmb-army/30 py-2 px-3 rounded text-white outline-none focus:border-fmb-gold"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] text-fmb-gold block uppercase mb-1">Missão / Descrição</label>
                  <textarea
                    placeholder="Descreva as ordens que os soldados devem obedecer..."
                    value={mDesc}
                    onChange={(e) => setMDesc(e.target.value)}
                    rows={2}
                    className="w-full bg-fmb-slate border border-fmb-army/30 py-2 px-3 rounded text-white outline-none resize-none focus:border-fmb-gold"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-fmb-gold block uppercase mb-1">Tipo de Evento Alvo</label>
                    <select
                      value={mCategory}
                      onChange={(e) => setMCategory(e.target.value as any)}
                      className="w-full bg-fmb-slate border border-fmb-army/30 py-2 px-3 rounded text-white outline-none cursor-pointer"
                    >
                      <option value="trainings">Instruções de Treino Ministradas</option>
                      <option value="service_hours">Segundos de Serviço Ativo</option>
                      <option value="promotions">Promoções Despachadas</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-fmb-gold block uppercase mb-1">Meta Acumulada</label>
                    <input
                      type="number"
                      value={mTarget}
                      onChange={(e) => setMTarget(Number(e.target.value))}
                      className="w-full bg-fmb-slate border border-fmb-army/30 py-2 px-3 rounded text-white outline-none"
                      required
                    />
                    <span className="text-[9px] text-gray-500 mt-1 block">Atenção: Para tempo de patrulha, insira em segundos (Ex: 36000 para 10 horas).</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-fmb-gold block uppercase mb-1">Pontos de Crédito</label>
                    <input
                      type="number"
                      value={mRewardPoints}
                      onChange={(e) => setMRewardPoints(Number(e.target.value))}
                      className="w-full bg-fmb-slate border border-fmb-army/30 py-1.5 px-3 rounded text-white outline-none"
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-5">
                    <input
                      type="checkbox"
                      id="destaqueCheck"
                      checked={mRewardDestaque}
                      onChange={(e) => setMRewardDestaque(e.target.checked)}
                      className="w-4 h-4 rounded cursor-pointer accent-fmb-gold bg-fmb-slate"
                    />
                    <label htmlFor="destaqueCheck" className="text-[10px] text-white uppercase cursor-pointer select-none">Consagrar Destaque Semanal</label>
                  </div>
                </div>

                {/* Select reward medals */}
                <div>
                  <label className="text-[10px] text-fmb-gold block uppercase mb-2">Conceder Medalha ao Completar</label>
                  <div className="grid grid-cols-2 gap-2 max-h-[110px] overflow-y-auto border border-fmb-army/20 p-2.5 bg-fmb-slate/20 rounded">
                    {LIST_OF_MEDALS.map(md => (
                      <button
                        type="button"
                        key={md.id}
                        onClick={() => toggleMedalSelection(md.id)}
                        className={`text-[9px] px-2 py-1 text-left rounded border transition-colors ${
                          selectedRewardMedals.includes(md.id)
                            ? "bg-fmb-gold/15 border-fmb-gold text-fmb-gold font-bold"
                            : "bg-fmb-black/40 border-fmb-army/25 text-gray-400"
                        }`}
                      >
                        🥇 {md.title}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-fmb-army hover:bg-fmb-olive border border-fmb-gold/55 py-2.5 rounded font-bold text-xs uppercase tracking-wider text-white"
                >
                  Publicar Missão no Quartel
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {editingMissionId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-fmb-black border border-fmb-gold/40 text-white rounded-lg shadow-2xl p-6 relative"
            >
              <button 
                onClick={() => setEditingMissionId(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-6">
                <Target className="w-10 h-10 text-fmb-gold mx-auto mb-2" />
                <h3 className="font-display font-extrabold text-lg text-white uppercase">Retificar Missão Tática</h3>
                <p className="text-[10px] font-mono text-gray-400 text-center">PRIVILÉGIO ADMINISTRATIVO - ALTO COMANDO FMB</p>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4 font-mono text-xs text-left">
                <div>
                  <label className="text-[10px] text-fmb-gold block uppercase mb-1">Título do Objetivo</label>
                  <input
                    type="text"
                    value={editMTitle}
                    onChange={(e) => setEditMTitle(e.target.value)}
                    className="w-full bg-fmb-slate border border-fmb-army/30 py-2 px-3 rounded text-white outline-none focus:border-fmb-gold"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] text-fmb-gold block uppercase mb-1">Missão / Descrição</label>
                  <textarea
                    value={editMDesc}
                    onChange={(e) => setEditMDesc(e.target.value)}
                    rows={2}
                    className="w-full bg-fmb-slate border border-fmb-army/30 py-2 px-3 rounded text-white outline-none resize-none focus:border-fmb-gold"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-fmb-gold block uppercase mb-1">Tipo de Evento Alvo</label>
                    <select
                      value={editMCategory}
                      onChange={(e) => setEditMCategory(e.target.value as any)}
                      className="w-full bg-fmb-slate border border-fmb-army/30 py-2 px-3 rounded text-white outline-none cursor-pointer"
                    >
                      <option value="trainings">Instruções de Treino Ministradas</option>
                      <option value="service_hours">Segundos de Serviço Ativo</option>
                      <option value="promotions">Promoções Despachadas</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-fmb-gold block uppercase mb-1">Meta Acumulada</label>
                    <input
                      type="number"
                      value={editMTarget}
                      onChange={(e) => setEditMTarget(Number(e.target.value))}
                      className="w-full bg-fmb-slate border border-fmb-army/30 py-2 px-3 rounded text-white outline-none"
                      required
                    />
                    <span className="text-[9px] text-gray-500 mt-1 block">Para tempo de patrulha, insira em segundos (Ex: 36000 para 10 horas).</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-fmb-gold block uppercase mb-1">Pontos de Crédito</label>
                    <input
                      type="number"
                      value={editMRewardPoints}
                      onChange={(e) => setEditMRewardPoints(Number(e.target.value))}
                      className="w-full bg-fmb-slate border border-fmb-army/30 py-1.5 px-3 rounded text-white outline-none"
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-5">
                    <input
                      type="checkbox"
                      id="editDestaqueCheck"
                      checked={editMRewardDestaque}
                      onChange={(e) => setEditMRewardDestaque(e.target.checked)}
                      className="w-4 h-4 rounded cursor-pointer accent-fmb-gold bg-fmb-slate"
                    />
                    <label htmlFor="editDestaqueCheck" className="text-[10px] text-white uppercase cursor-pointer select-none">Consagrar Destaque Semanal</label>
                  </div>
                </div>

                {/* Select reward medals */}
                <div>
                  <label className="text-[10px] text-fmb-gold block uppercase mb-2">Conceder Medalha ao Completar</label>
                  <div className="grid grid-cols-2 gap-2 max-h-[110px] overflow-y-auto border border-fmb-army/20 p-2.5 bg-fmb-slate/20 rounded">
                    {LIST_OF_MEDALS.map(md => (
                      <button
                        type="button"
                        key={md.id}
                        onClick={() => toggleEditMedalSelection(md.id)}
                        className={`text-[9px] px-2 py-1 text-left rounded border transition-colors ${
                          editRewardMedals.includes(md.id)
                            ? "bg-fmb-gold/15 border-fmb-gold text-fmb-gold font-bold"
                            : "bg-fmb-black/40 border-fmb-army/25 text-gray-400"
                        }`}
                      >
                        🥇 {md.title}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-fmb-army hover:bg-fmb-olive border border-fmb-gold/55 py-2.5 rounded font-bold text-xs uppercase tracking-wider text-white"
                >
                  Salvar Missão Retificada
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={confirmDeleteId !== null}
        title="Expurgar Missão Tática"
        message="Atenção Militar: Confirmar expurgação definitiva desta missão? Ela sumirá de absolutamente todo o QG e dos registros gerais, sendo imediata e irreversível."
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />

    </div>
  );
}
