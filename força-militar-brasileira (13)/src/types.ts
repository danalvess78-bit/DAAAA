/**
 * Types definition for Força Militar Brasileira (FMB)
 * Inspired by Habbo BR and Modern Military Tactical Dashboard
 */

export enum MilitaryRank {
  ADMSUPREMO = "Administrador Supremo",
  COMANDANTE_GERAL = "Comandante-Geral",
  GENERAL_EXERCITO = "General de Exército",
  GENERAL_DIVISAO = "General de Divisão",
  GENERAL_BRIGADA = "General de Brigada",
  CORONEL = "Coronel",
  TENENTE_CORONEL = "Tenente-Coronel",
  MAJOR = "Major",
  CAPITAO = "Capitão",
  PRIMEIRO_TENENTE = "Primeiro-Tenente",
  SEGUNDO_TENENTE = "Segundo-Tenente",
  ASPIRANTE = "Aspirante",
  SUBTENENTE = "Subtenente",
  SARGENTO = "Sargento",
  CABO = "Cabo",
  SOLDADO = "Soldado"
}

export enum UserStatus {
  ATIVO = "Ativo",
  SUSPENSO = "Suspenso",
  BANIDO = "Banido"
}

export enum UserActiveState {
  OFFLINE = "Offline",
  ONLINE = "Online",
  EM_SERVICO = "Em Serviço"
}

export interface RankPermissions {
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
}

export interface RankConfig {
  rank: MilitaryRank;
  label: string;
  description: string;
  permissions: RankPermissions;
}

export interface PoliceDocument {
  id: string;
  title: string;
  category: string;
  content: string;
  attachmentUrl?: string;
  authorNick: string;
  createdAt: string;
  section?: "instrutores" | "aman" | "standard" | "esao";
  allowedRanks?: string[];
  allowedSubCargos?: string[];
  instructorTag?: string;
}

export interface User {
  id: string;
  username: string; // The same as Habbo Nick in lowercase (or display)
  habboNick: string; // Display habbo nick
  habboAvatar: string; // Habbo avatar image look string (or cache url)
  habboMotto: string; // Motto
  habboCreated: string; // Creation date in habbo
  role: MilitaryRank; // Military Rank
  status: UserStatus;
  activeState: UserActiveState;
  joinedAt: string;
  totalServiceSeconds: number; // Stored in seconds for high-precision
  medals: string[]; // List of medal IDs
  trainingsCreated: number; // Count of trainings led
  promotionsGiven: number; // Count of promotions given
  subCargos?: string[]; // Custom roles/tags assigned to the user
  instructorTag?: string; // Instructor unique tag (3 characters)
  missaoCorreta?: string; // Calculated correct mission for profile
  warnings?: number; // Warnings applied
  warningRecords?: WarningRecord[];
}

export interface WarningRecord {
  id: string;
  reason: string;
  quantity: number;
  dateApplied: string; // ISO string
  promoterNick: string;
}

export interface SubCargo {
  id: string; // unique slug e.g. "SUB_INSTRUTOR"
  label: string; // name e.g. "Instrutor de Infantaria"
  description: string; // description
  minRank?: MilitaryRank; // optional min rank required or associated
  permissions?: RankPermissions;
}

export interface Promotion {
  id: string;
  promotedMilitarId: string;
  promotedMilitarName: string; // habboNick
  promoterId: string;
  promoterName: string; // habboNick
  oldRank: MilitaryRank;
  newRank: MilitaryRank;
  reason: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM:SS
}

export interface Training {
  id: string;
  name: string;
  instructorId: string;
  instructorName: string; // habboNick
  participants: string[]; // List of Habbo Nicks of participants
  category: string; // e.g. "CFS", "Tático", "Liderança"
  description: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  status: "Agendado" | "Concluido" | "Cancelado";
}

export interface PontoLog {
  id: string;
  userId: string;
  userNick: string;
  date: string; // YYYY-MM-DD
  checkInTime: string; // ISO String
  checkOutTime: string | null; // ISO String or null if active
  durationSeconds: number;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  rewardMedals: string[]; // Medal IDs awarded
  rewardPoints: number; // Points / hours simulation
  rewardDestaque: boolean; // True if it flags destaque
  active: boolean;
  targetCategory: "trainings" | "service_hours" | "promotions" | "operations";
  targetCount: number;
}

export interface MissionProgress {
  id: string;
  missionId: string;
  userId: string;
  currentCount: number;
  completed: boolean;
  completedAt: string | null;
}

export interface SystemLog {
  id: string;
  userId: string | null; // null if guest/system
  userNick: string; // "SISTEMA" or user nick
  action: string;
  details: string;
  timestamp: string; // ISO String
}

export interface SystemDestaques {
  militaryOfTheMonth: string | null; // User ID
  instructorOfTheMonth: string | null; // User ID
  destaqueOperacional: string | null; // User ID
}

export interface Medal {
  id: string;
  title: string;
  description: string;
  icon: string; // Lucide icon identifier or visual design pattern
  category: "treinamentos" | "servico" | "destaque" | "promocoes";
}

export const LIST_OF_MEDALS: Medal[] = [
  { id: "treinos_10", title: "Instrutor Aspirante", description: "Ministrou 10 treinamentos", icon: "GraduationCap", category: "treinamentos" },
  { id: "treinos_50", title: "Mestre de Instruções", description: "Ministrou 50 treinamentos", icon: "ShieldAlert", category: "treinamentos" },
  { id: "servico_100h", title: "Guerreiro de Ferro", description: "Cumpriu 100 horas de serviço ativo", icon: "Timer", category: "servico" },
  { id: "servico_500h", title: "Comandante de Sentinela", description: "Cumpriu 500 horas de serviço ativo", icon: "Award", category: "servico" },
  { id: "militar_mes", title: "Militar do Mês", description: "Consagrado Militar do Mês no Hall da Fama", icon: "Medal", category: "destaque" },
  { id: "instrutor_mes", title: "Instrutor do Mês", description: "Consagrado Instrutor de Elite no Hall da Fama", icon: "Target", category: "destaque" },
  { id: "destaque_operacional", title: "Crachá de Bravura", description: "Concedido por Destaque Operacional sob ordem do Comando", icon: "Zap", category: "destaque" }
];

// Returns rank order to compare hierarchy power
export function getRankOrder(rank: MilitaryRank): number {
  const ranks = [
    MilitaryRank.SOLDADO,
    MilitaryRank.CABO,
    MilitaryRank.SARGENTO,
    MilitaryRank.SUBTENENTE,
    MilitaryRank.ASPIRANTE,
    MilitaryRank.SEGUNDO_TENENTE,
    MilitaryRank.PRIMEIRO_TENENTE,
    MilitaryRank.CAPITAO,
    MilitaryRank.MAJOR,
    MilitaryRank.TENENTE_CORONEL,
    MilitaryRank.CORONEL,
    MilitaryRank.GENERAL_BRIGADA,
    MilitaryRank.GENERAL_DIVISAO,
    MilitaryRank.GENERAL_EXERCITO,
    MilitaryRank.COMANDANTE_GERAL,
    MilitaryRank.ADMSUPREMO
  ];
  return ranks.indexOf(rank);
}

export interface RecruitLesson {
  id: string;
  instructorId: string;
  instructorName: string;
  studentNick: string;
  category: string;
  status: "Aprovado" | "Reprovado";
  notes?: string;
  screenshotUrl?: string;
  createdAt: string;
}

export interface NewsPost {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  authorNick: string;
  createdAt: string;
}

export interface MilitaryNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}


