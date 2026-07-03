/**
 * Client API Utility for FMB Full-Stack application
 */

// Global interceptor for fetch to handle HTML responses (like 502 Bad Gateway or server restarts) gracefully
const originalFetch = typeof window !== "undefined" ? window.fetch : undefined;

const apiFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  if (!originalFetch) {
    throw new Error("Ambiente de execução inválido: fetch global não encontrado.");
  }
  const res = await originalFetch(input, init);
  const contentType = res.headers.get("content-type");
  if (contentType && (contentType.includes("text/html") || contentType.includes("application/json"))) {
    try {
      const cloned = res.clone();
      const text = await cloned.text();
      if (text.trim().startsWith("<")) {
        throw new Error("O servidor está reiniciando ou indisponível temporariamente. Por favor, aguarde alguns instantes e tente novamente.");
      }
    } catch (err) {
      // ignore
    }
  }
  return res;
};

// Shading the global fetch within this module safely
const fetch = apiFetch;

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem("fmb_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {})
  };
};

export const api = {
  // Authentication
  login: async (username: string, pass: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: pass })
    });
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro de login");
      }
      return data;
    } else {
      const text = await res.text();
      if (!res.ok) {
        const cleanText = text.length > 100 ? text.substring(0, 100) + "..." : text;
        throw new Error(cleanText || "Erro do servidor (Militar)");
      }
      throw new Error("Resposta inválida do servidor.");
    }
  },

  logout: async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: getAuthHeaders()
      });
    } catch (e) {
      console.warn("Logout error:", e);
    }
    localStorage.removeItem("fmb_token");
  },

  getMe: async () => {
    const res = await fetch("/api/me", {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      localStorage.removeItem("fmb_token");
      throw new Error("Sessão expirada");
    }
    return res.json();
  },

  // Users Management
  getUsers: async () => {
    const res = await fetch("/api/users", {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Erro ao obter militares");
    return res.json();
  },

  getUserById: async (id: string) => {
    const res = await fetch(`/api/users/${id}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Erro ao obter registro do militar");
    return res.json();
  },

  createMilitar: async (habboNick: string, pass: string, role: string) => {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ habboNick, password: pass, role })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao alistar militar");
    }
    return res.json();
  },

  updateMilitarRank: async (id: string, newRank: string, reason: string) => {
    const res = await fetch(`/api/users/${id}/rank`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ newRank, reason })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao processar promoção");
    }
    return res.json();
  },

  updateMilitarRoleDirectly: async (id: string, newRole: string) => {
    const res = await fetch(`/api/users/${id}/direct-role`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ newRole })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao atualizar cargo diretamente");
    }
    return res.json();
  },

  banMilitar: async (id: string, reason: string) => {
    const res = await fetch(`/api/users/${id}/ban`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao banir");
    }
    return res.json();
  },

  suspendMilitar: async (id: string, reason: string) => {
    const res = await fetch(`/api/users/${id}/suspend`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao suspender");
    }
    return res.json();
  },

  reactivateMilitar: async (id: string) => {
    const res = await fetch(`/api/users/${id}/reactivate`, {
      method: "PUT",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao reativar militar");
    }
    return res.json();
  },

  resetPassword: async (userId: string, pass: string) => {
    const res = await fetch(`/api/users/${userId}/password`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ newPassword: pass })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao redefinir acesso");
    }
    return res.json();
  },

  deleteMilitar: async (id: string) => {
    const res = await fetch(`/api/users/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao excluir militar");
    }
    return res.json();
  },

  // 서비스 Clock In/Out
  clockIn: async () => {
    const res = await fetch("/api/service/clock-in", {
      method: "POST",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao entrar em serviço");
    }
    return res.json();
  },

  clockOut: async () => {
    const res = await fetch("/api/service/clock-out", {
      method: "POST",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao encerrar serviço");
    }
    return res.json();
  },

  getPontes: async () => {
    const res = await fetch("/api/service/pontes", {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao obter folha de pontos");
    }
    return res.json();
  },

  getStats: async () => {
    const res = await fetch("/api/dashboard/stats", {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Erro ao obter estatísticas");
    return res.json();
  },

  getRankings: async () => {
    const res = await fetch("/api/dashboard/rankings", {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Erro ao obter rankings de destaques");
    return res.json();
  },

  // Trainings
  getTrainings: async () => {
    const res = await fetch("/api/trainings", {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Erro ao listar treinamentos");
    return res.json();
  },

  createTraining: async (name: string, category: string, description: string, participants: string[], date?: string, time?: string) => {
    const res = await fetch("/api/trainings", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, category, description, participants, date, time })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao criar treinamento");
    }
    return res.json();
  },

  completeTraining: async (id: string, participants: string[]) => {
    const res = await fetch(`/api/trainings/${id}/complete`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ participants })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao concluir treinamento");
    }
    return res.json();
  },

  cancelTraining: async (id: string) => {
    const res = await fetch(`/api/trainings/${id}/cancel`, {
      method: "PUT",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao cancelar treinamento");
    }
    return res.json();
  },

  // Missions
  getMissions: async () => {
    const res = await fetch("/api/missions", {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Erro ao buscar missões");
    return res.json();
  },

  createMission: async (title: string, description: string, category: string, targetCount: number, rewardMedals: string[], rewardPoints: number, rewardDestaque: boolean) => {
    const res = await fetch("/api/missions", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, description, category, targetCount, rewardMedals, rewardPoints, rewardDestaque })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao cadastrar missão");
    }
    return res.json();
  },

  deleteMission: async (id: string) => {
    const res = await fetch(`/api/missions/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao expurgar missão");
    }
    return res.json();
  },

  // Destaques (Hall da fama config)
  getDestaques: async () => {
    const res = await fetch("/api/destaques");
    if (!res.ok) throw new Error("Erro ao carregar destaques");
    return res.json();
  },

  updateDestaques: async (militaryOfTheMonth: string | null, instructorOfTheMonth: string | null, destaqueOperacional: string | null) => {
    const res = await fetch("/api/destaques", {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ militaryOfTheMonth, instructorOfTheMonth, destaqueOperacional })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao atualizar Destaques FMB");
    }
    return res.json();
  },

  // System secret logs
  getLogs: async () => {
    const res = await fetch("/api/logs", {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Sem autorização de acesso aos logs confidenciais.");
    }
    return res.json();
  },

  // Habbo User Fetch
  getHabboNick: async (nick: string) => {
    const res = await fetch(`/api/habbo/${encodeURIComponent(nick)}`);
    if (!res.ok) throw new Error("Militar não localizado no Habbo original.");
    return res.json();
  },

  // Edit Mission
  updateMission: async (id: string, updates: any) => {
    const res = await fetch(`/api/missions/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao editar parameters da missão");
    }
    return res.json();
  },

  // Rank configurations
  getHierarchy: async () => {
    const res = await fetch("/api/hierarchy", {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Erro ao carregar dados da hierarquia");
    return res.json();
  },

  updateHierarchy: async (rank: string, label: string, description: string, permissions: any) => {
    const res = await fetch("/api/hierarchy", {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ rank, label, description, permissions })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao salvar alterações da hierarquia");
    }
    return res.json();
  },

  deleteHierarchy: async (rank: string) => {
    const res = await fetch(`/api/hierarchy/${encodeURIComponent(rank)}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao apagar cargo");
    }
    return res.json();
  },

  // Documents & Classes
  getDocuments: async () => {
    const res = await fetch("/api/documents", {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Erro ao carregar os documentos da corporação");
    return res.json();
  },

  createDocument: async (
    title: string, 
    category: string, 
    content: string, 
    attachmentUrl?: string,
    section?: "instrutores" | "aman" | "standard",
    allowedRanks?: string[],
    allowedSubCargos?: string[],
    instructorTag?: string
  ) => {
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, category, content, attachmentUrl, section, allowedRanks, allowedSubCargos, instructorTag })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao postar script/documento");
    }
    return res.json();
  },

  updateDocument: async (
    id: string, 
    title: string, 
    category: string, 
    content: string, 
    attachmentUrl?: string,
    section?: "instrutores" | "aman" | "standard",
    allowedRanks?: string[],
    allowedSubCargos?: string[],
    instructorTag?: string
  ) => {
    const res = await fetch(`/api/documents/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, category, content, attachmentUrl, section, allowedRanks, allowedSubCargos, instructorTag })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao editar script/documento");
    }
    return res.json();
  },

  deleteDocument: async (id: string) => {
    const res = await fetch(`/api/documents/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao excluir o documento");
    }
    return res.json();
  },

  // Trainings extra edit/delete
  updateTraining: async (id: string, updates: any) => {
    const res = await fetch(`/api/trainings/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao editar fita de treinamento");
    }
    return res.json();
  },

  deleteTraining: async (id: string) => {
    const res = await fetch(`/api/trainings/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao apagar ata do treinamento");
    }
    return res.json();
  },

  // Recruit lessons & Classes Taught logging
  getRecruitLessons: async () => {
    const res = await fetch("/api/recruit-lessons", {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Erro ao carregar os relatórios de aula de recrutas");
    return res.json();
  },

  createRecruitLesson: async (lessonData: { studentNick: string, category: string, status: "Aprovado" | "Reprovado", notes?: string, screenshotUrl?: string }) => {
    const res = await fetch("/api/recruit-lessons", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(lessonData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao postar relatório de aula");
    }
    return res.json();
  },

  deleteRecruitLesson: async (id: string) => {
    const res = await fetch(`/api/recruit-lessons/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao excluir o relatório de aula");
    }
    return res.json();
  },

  getTrainingCategories: async () => {
    const res = await fetch("/api/training-categories", {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Erro ao carregar as categorias de treinamentos.");
    return res.json(); // returns { name: string, minRank: MilitaryRank }[]
  },

  addTrainingCategory: async (category: string, minRank?: string) => {
    const res = await fetch("/api/training-categories", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ category, minRank })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao adicionar categoria.");
    }
    return res.json();
  },

  updateTrainingCategory: async (oldCategory: string, newCategory: string, minRank?: string) => {
    const res = await fetch(`/api/training-categories/${encodeURIComponent(oldCategory)}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ newCategory, minRank })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao editar categoria.");
    }
    return res.json();
  },

  deleteTrainingCategory: async (category: string) => {
    const res = await fetch(`/api/training-categories/${encodeURIComponent(category)}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao deletar categoria.");
    }
    return res.json();
  },

  getDocumentCategories: async () => {
    const res = await fetch("/api/document-categories", {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Erro ao carregar as categorias de documentos.");
    return res.json();
  },

  addDocumentCategory: async (category: string) => {
    const res = await fetch("/api/document-categories", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ category })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao adicionar categoria de documento.");
    }
    return res.json();
  },

  updateDocumentCategory: async (oldCategory: string, newCategory: string) => {
    const res = await fetch(`/api/document-categories/${encodeURIComponent(oldCategory)}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ newCategory })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao editar categoria de documento.");
    }
    return res.json();
  },

  deleteDocumentCategory: async (category: string) => {
    const res = await fetch(`/api/document-categories/${encodeURIComponent(category)}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao deletar categoria de documento.");
    }
    return res.json();
  },

  // Habbo profile real-time synchronizer
  syncUserHabboProfile: async (userId: string) => {
    const res = await fetch(`/api/users/${userId}/sync`, {
      method: "POST",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro de comunicação ao sincronizar farda FMB");
    }
    return res.json();
  },

  uploadPrintImage: async (file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch("/api/upload-image", {
      method: "POST",
      headers: {
        ...(localStorage.getItem("fmb_token")
          ? { "Authorization": `Bearer ${localStorage.getItem("fmb_token")}` }
          : {})
      },
      body: formData
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao fazer upload da imagem.");
    }
    return res.json();
  },

  submitEnlistmentRequest: async (habboNick: string, pass: string) => {
    const res = await fetch("/api/public/enlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ habboNick, password: pass })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao solicitar alistamento");
    }
    return res.json();
  },

  getEnlistmentRequests: async () => {
    const res = await fetch("/api/admin/enlistments", {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Erro ao obter lista de alistamentos");
    return res.json();
  },

  approveEnlistmentRequest: async (id: string) => {
    const res = await fetch(`/api/admin/enlistments/${id}/approve`, {
      method: "POST",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao aprovar alistamento");
    }
    return res.json();
  },

  rejectEnlistmentRequest: async (id: string) => {
    const res = await fetch(`/api/admin/enlistments/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao recusar alistamento");
    }
    return res.json();
  },

  downloadBackup: async () => {
    const res = await fetch("/api/admin/backup", {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Erro de rede ao baixar backup" }));
      throw new Error(err.error || "Erro ao fazer download do backup");
    }
    return res.json();
  },

  restoreBackup: async (backupData: any) => {
    const res = await fetch("/api/admin/restore", {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ backupData })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Erro de rede ao restaurar backup" }));
      throw new Error(err.error || "Erro ao restaurar o backup enviado");
    }
    return res.json();
  },

  // --- SUB-CARGOS (SUB-ROLES) API CLIENT METHODS ---
  getSubCargos: async () => {
    const res = await fetch("/api/sub-cargos", {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Erro ao obter subcargos");
    return res.json();
  },

  createSubCargo: async (id: string, label: string, description: string, minRank?: string, permissions?: any) => {
    const res = await fetch("/api/sub-cargos", {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ id, label, description, minRank, permissions })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Erro ao criar subcargo" }));
      throw new Error(err.error || "Erro ao criar subcargo");
    }
    return res.json();
  },

  updateSubCargo: async (id: string, label: string, description: string, minRank?: string, permissions?: any) => {
    const res = await fetch(`/api/sub-cargos/${id}`, {
      method: "PUT",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ label, description, minRank, permissions })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Erro ao atualizar subcargo" }));
      throw new Error(err.error || "Erro ao atualizar subcargo");
    }
    return res.json();
  },

  deleteSubCargo: async (id: string) => {
    const res = await fetch(`/api/sub-cargos/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Erro ao excluir subcargo" }));
      throw new Error(err.error || "Erro ao excluir subcargo");
    }
    return res.json();
  },

  assignSubCargo: async (userId: string, subCargoId: string) => {
    const res = await fetch(`/api/users/${userId}/sub-cargos`, {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ subCargoId })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Erro ao atribuir subcargo" }));
      throw new Error(err.error || "Erro ao atribuir subcargo");
    }
    return res.json();
  },

  removeSubCargo: async (userId: string, subCargoId: string) => {
    const res = await fetch(`/api/users/${userId}/sub-cargos/${subCargoId}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Erro ao remover subcargo" }));
      throw new Error(err.error || "Erro ao remover subcargo");
    }
    return res.json();
  },

  // --- NEWS / NOTICIAS CLIENT API ---
  getPublicNews: async () => {
    const res = await fetch("/api/public/news", {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Erro ao buscar notícias" }));
      throw new Error(err.error || "Erro ao buscar notícias");
    }
    return res.json();
  },

  getPublicHierarchy: async () => {
    const res = await fetch("/api/public/hierarchy", {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Erro ao buscar hierarquia pública" }));
      throw new Error(err.error || "Erro ao buscar hierarquia pública");
    }
    return res.json();
  },

  createNews: async (title: string, content: string, imageUrl?: string) => {
    const res = await fetch("/api/news", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, content, imageUrl })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Erro ao postar notícia" }));
      throw new Error(err.error || "Erro ao postar notícia");
    }
    return res.json();
  },

  deleteNews: async (id: string) => {
    const res = await fetch(`/api/news/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Erro ao excluir notícia" }));
      throw new Error(err.error || "Erro ao excluir notícia");
    }
    return res.json();
  },

  getNotifications: async () => {
    const res = await fetch("/api/notifications", {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Erro ao obter notificações");
    return res.json();
  },

  getUserNotifications: async (userId: string) => {
    const res = await fetch(`/api/notifications/user/${userId}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Erro ao obter notificações do militar");
    return res.json();
  },

  sendNotification: async (userId: string, title: string, message: string) => {
    const res = await fetch("/api/notifications/send", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ userId, title, message })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao enviar notificação.");
    }
    return res.json();
  },

  getInstructorCategories: async () => {
    const res = await fetch("/api/instructor-categories", {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Erro ao carregar as categorias de instrutores.");
    return res.json();
  },

  addInstructorCategory: async (category: string) => {
    const res = await fetch("/api/instructor-categories", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ category })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao adicionar categoria.");
    }
    return res.json();
  },

  deleteInstructorCategory: async (category: string) => {
    const res = await fetch(`/api/instructor-categories/${encodeURIComponent(category)}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao deletar categoria.");
    }
    return res.json();
  },

  getAmanCategories: async () => {
    const res = await fetch("/api/aman-categories", {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Erro ao carregar as categorias AMAN.");
    return res.json();
  },

  addAmanCategory: async (category: string) => {
    const res = await fetch("/api/aman-categories", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ category })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao adicionar categoria.");
    }
    return res.json();
  },

  deleteAmanCategory: async (category: string) => {
    const res = await fetch(`/api/aman-categories/${encodeURIComponent(category)}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao deletar categoria.");
    }
    return res.json();
  },

  markNotificationsAsRead: async () => {
    const res = await fetch("/api/notifications/read", {
      method: "POST",
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Erro ao ler notificações");
    return res.json();
  },

  getCustomPermissions: async () => {
    const res = await fetch("/api/custom-permissions", {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao obter permissões de abas.");
    }
    return res.json();
  },

  updateCustomPermissions: async (payload: { instrutoresViewAllowed: string[], amanViewAllowed: string[], cdmViewAllowed: string[] }) => {
    const res = await fetch("/api/custom-permissions", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao salvar permissões de abas.");
    }
    return res.json();
  },

  getEsaoCategories: async () => {
    const res = await fetch("/api/esao-categories", {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Erro ao carregar as categorias EsAO.");
    return res.json();
  },

  addEsaoCategory: async (category: string) => {
    const res = await fetch("/api/esao-categories", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ category })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao adicionar categoria.");
    }
    return res.json();
  },

  deleteEsaoCategory: async (category: string) => {
    const res = await fetch(`/api/esao-categories/${encodeURIComponent(category)}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao deletar categoria.");
    }
    return res.json();
  },

  saveInstructorTag: async (tag: string) => {
    const res = await fetch("/api/users/me/tag", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ tag })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao salvar TAG.");
    }
    return res.json();
  },

  applyWarning: async (targetNick: string, reason: string) => {
    const res = await fetch("/api/users/warn", {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ targetNick, reason })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Erro ao aplicar advertência." }));
      throw new Error(err.error || "Erro ao aplicar advertência.");
    }
    return res.json();
  },

  removeWarning: async (targetNick: string) => {
    const res = await fetch("/api/users/unwarn", {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ targetNick })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Erro ao remover advertência." }));
      throw new Error(err.error || "Erro ao remover advertência.");
    }
    return res.json();
  }
};
