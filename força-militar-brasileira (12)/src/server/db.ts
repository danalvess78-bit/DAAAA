import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { 
  User, 
  MilitaryRank, 
  UserStatus, 
  UserActiveState, 
  Promotion, 
  Training, 
  PontoLog, 
  Mission, 
  MissionProgress, 
  SystemLog, 
  SystemDestaques,
  LIST_OF_MEDALS,
  RankConfig,
  PoliceDocument,
  RankPermissions,
  RecruitLesson,
  getRankOrder,
  SubCargo,
  NewsPost,
  MilitaryNotification
} from "../types.js";

const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA || process.env.NETLIFY);
const DATA_DIR = isServerless ? "/tmp/data" : path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "fmb_database.json");

// Structure of our file DB
interface DBStructure {
  users: User[];
  passwords: Record<string, string>; // userId -> passwordHash
  promotions: Promotion[];
  trainings: Training[];
  pontes: PontoLog[];
  missions: Mission[];
  missionProgress: MissionProgress[];
  logs: SystemLog[];
  destaques: SystemDestaques;
  rankConfigs: RankConfig[];
  documents: PoliceDocument[];
  recruitLessons: RecruitLesson[];
  subCargos?: SubCargo[];
  news?: NewsPost[];
  enlistmentRequests?: any[];
  notifications?: MilitaryNotification[];
  trainingCategories?: string[];
  trainingCategoriesConfig?: Record<string, { minRank?: MilitaryRank }>;
  documentCategories?: string[];
  instructorCategories?: string[];
  amanCategories?: string[];
  esaoCategories?: string[];
  customPermissions?: {
    instrutoresViewAllowed?: string[];
    amanViewAllowed?: string[];
    cdmViewAllowed?: string[];
  };
  permissionsCleaned?: boolean;
  permissionsCleanedV2?: boolean;
  seededCategoriesAndDocsCleaned?: boolean;
  fmbCleanWipe2026_v4?: boolean;
  updatedAt?: string;
}

// Fallback visual figures for army looking Habbo avatars
const SOLDIER_HABBO_FIGURE_FALLBACKS = [
  "hr-115-42.hd-180-2.ch-215-62.lg-270-62.sh-300-64", // Green military uniform
  "hr-893-45.hd-180-1.ch-3030-92.lg-275-64.sh-300-64.ha-1002-62.he-1607", // Tactical squad green
  "hr-125-31.hd-209-3.ch-210-92.lg-270-92.sh-300-92.ha-1002-92", // Dark military hat green
  "hr-802-37.hd-190-2.ch-215-64.lg-275-64.sh-905-64.he-1607-64", // Female tactician green
  "hr-115-31.hd-195-3.ch-210-62.lg-270-62.sh-300-62.ha-1002-62"  // Officer
];

// Helper to hash password
function hashPassword(password: string): string {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
}

// In-memory cache
let hasSyncedFromSupabase = false;
let lastSyncFromSupabaseTime = 0;
let lastSupabaseError: string | null = null;
let lastSupabaseErrorTime: number = 0;

export interface SupabaseSyncLog {
  timestamp: string;
  type: "info" | "success" | "warn" | "error";
  message: string;
}

let supabaseLogs: SupabaseSyncLog[] = [
  { timestamp: new Date().toISOString(), type: "info", message: "Módulo de redundância carregado. Pronto para conectar." }
];

export function addSupabaseLog(type: "info" | "success" | "warn" | "error", message: string) {
  const timestamp = new Date().toISOString();
  console.log(`[SUPABASE LOG] [${type.toUpperCase()}] ${message}`);
  supabaseLogs.unshift({ timestamp, type, message });
  if (supabaseLogs.length > 50) {
    supabaseLogs = supabaseLogs.slice(0, 50);
  }
}

// Helper to read Supabase credentials tolerating environment variations (e.g. Vercel)
export function getSupabaseCredentials() {
  const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
  const key = (
    process.env.VITE_SUPABASE_ANON_KEY || 
    process.env.SUPABASE_ANON_KEY || 
    process.env.VITE_SUPABASE_KEY || 
    process.env.SUPABASE_KEY || 
    ""
  ).trim();
  return { url, key, configured: !!url && !!key };
}

export function getSupabaseStatus() {
  const { configured, url, key } = getSupabaseCredentials();
  const maskedKey = key ? `${key.substring(0, 6)}...${key.substring(key.length - 6)}` : "";
  return {
    configured,
    synced: hasSyncedFromSupabase,
    status: configured ? (hasSyncedFromSupabase ? "connected" : "syncing") : "not_configured",
    lastError: lastSupabaseError,
    lastErrorTime: lastSupabaseErrorTime,
    dbUpdatedAt: db ? (db.updatedAt || null) : null,
    url: url || null,
    maskedKey: maskedKey || null,
    logs: supabaseLogs
  };
}

export async function ensureFreshData() {
  const { configured } = getSupabaseCredentials();
  if (!configured) {
    hasSyncedFromSupabase = true;
    return;
  }
  
  if (!hasSyncedFromSupabase || (Date.now() - lastSyncFromSupabaseTime > 30000)) {
    console.log(`[SUPABASE] Atualizando cache local com base em sincronização periódica (Última atualização há ${Math.floor((Date.now() - lastSyncFromSupabaseTime) / 1000)}s)...`);
    await syncFromSupabase();
  }
}

let db: DBStructure = {
  users: [],
  passwords: {},
  promotions: [],
  trainings: [],
  pontes: [],
  missions: [],
  missionProgress: [],
  logs: [],
  destaques: {
    militaryOfTheMonth: null,
    instructorOfTheMonth: null,
    destaqueOperacional: null
  },
  rankConfigs: [],
  documents: [],
  recruitLessons: [],
  news: [],
  notifications: [],
  trainingCategories: ["Ata Básico", "Tiro Tático", "Patrulhamento", "Doutrina Básica", "Curso de Oficiais"],
  instructorCategories: ["Manual de Treino", "Instruções Gerais", "Avaliações"],
  amanCategories: ["Doutrinas", "Cursos AMAN", "Manuais de Cadete"],
  customPermissions: {
    instrutoresViewAllowed: [],
    amanViewAllowed: [],
    cdmViewAllowed: []
  }
};

// Write in-memory cache to disk
function saveDB() {
  try {
    // Anexar carimbo de data/hora atualizado na cache em memória de forma imutável / persistente
    db.updatedAt = new Date().toISOString();

    // Try to write to local disk, but do not block Supabase replication if it fails
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
    } catch (fsErr: any) {
      console.warn("[DB FS WARNING] Falha ao escrever cache de redundância em disco (Esperado em hospedagens serverless de leitura integral):", fsErr.message);
    }
    
    const { url, key, configured } = getSupabaseCredentials();
    // Asynchronously replicate to Supabase
    if (configured && !hasSyncedFromSupabase) {
      console.log("[SUPABASE] Evitando gravação preventiva no Supabase antes da sincronização inicial (Prevenindo perda de dados).");
      return;
    }
    
    syncToSupabase();
  } catch (error) {
    console.error("Erro no fluxo do salvamento geral:", error);
  }
}

export async function syncToSupabase() {
  let { url: supabaseUrl, key: supabaseKey, configured } = getSupabaseCredentials();

  if (!configured) {
    addSupabaseLog("warn", "Tentativa de sincronizar sem dados de conexão do Supabase configurados.");
    return;
  }

  supabaseUrl = supabaseUrl.trim();
  if (supabaseUrl.includes("/rest/v1")) {
    supabaseUrl = supabaseUrl.split("/rest/v1")[0];
  }
  if (supabaseUrl.endsWith("/")) {
    supabaseUrl = supabaseUrl.slice(0, -1);
  }

  addSupabaseLog("info", `Iniciando gravação redundante no Supabase (URL: ${supabaseUrl})...`);

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Try table upsert
    addSupabaseLog("info", "Iniciando upsert na tabela relacional 'fmb_state'...");
    const currentUpdateTime = db.updatedAt || new Date().toISOString();
    const { error: upsertError } = await supabase
      .from("fmb_state")
      .upsert({ id: 1, data: db, updated_at: currentUpdateTime });

    if (!upsertError) {
      console.log("[SUPABASE] Sincronização concluída na tabela 'fmb_state'!");
      addSupabaseLog("success", `Backup salvo com êxito na tabela 'fmb_state'. Registros de usuários ativos: ${(db.users || []).length}.`);
      lastSupabaseError = null;
      
      // Sincronizar tabelas individuais de forma assíncrona em background
      syncIndividualTables(supabase).catch(err => {
        console.warn("[SUPABASE BACKGROUND SYNC WARNING]", err.message);
      });
      return;
    }

    const tableErrMsg = upsertError.message || JSON.stringify(upsertError);
    console.warn("[SUPABASE] Tabela 'fmb_state' não localizada ou erro (" + tableErrMsg + "). Tentando via Storage bucket...");
    addSupabaseLog("warn", `Tabela fmb_state indisponível: ${tableErrMsg}. Tentando criar backup no Bucket 'fmb-assets'...`);
    lastSupabaseError = "Tabela 'fmb_state': " + tableErrMsg;
    lastSupabaseErrorTime = Date.now();

    // 2. Backup using a storage bucket (fmb-assets / database/fmb_database.json)
    addSupabaseLog("info", "Iniciando upload do arquivo JSON em 'fmb-assets/database/fmb_database.json'...");
    const jsonStr = JSON.stringify(db, null, 2);
    const { error: uploadError } = await supabase.storage
      .from("fmb-assets")
      .upload("database/fmb_database.json", Buffer.from(jsonStr), {
        contentType: "application/json",
        upsert: true
      });

    if (!uploadError) {
      console.log("[SUPABASE] Sincronização concluída no bucket 'fmb-assets' com sucesso!");
      addSupabaseLog("success", "Backup de segurança gravado com sucesso via arquivo JSON no Storage fmb-assets!");
      lastSupabaseError = null; // Succeeded on storage backup
    } else {
      const storageErrMsg = uploadError.message;
      console.error("[SUPABASE] Falha ao persistir em tabela ou de storage:", storageErrMsg);
      addSupabaseLog("error", `Falha total no backup de persistência. Tabela: ${tableErrMsg} | Bucket fmb-assets: ${storageErrMsg}`);
      lastSupabaseError = `Tabela: ${tableErrMsg} | Bucket fmb-assets: ${storageErrMsg}`;
      lastSupabaseErrorTime = Date.now();
    }
  } catch (err: any) {
    console.error("[SUPABASE ERROR] Erro no motor de sincronização:", err.message);
    addSupabaseLog("error", `Erro grave de conexão no motor: ${err.message}`);
    lastSupabaseError = "Motor Supabase: " + err.message;
    lastSupabaseErrorTime = Date.now();
  }
}

export async function syncIndividualTables(supabase: any) {
  try {
    // 1. fmb_users
    if (db.users && db.users.length > 0) {
      const { error } = await supabase.from("fmb_users").upsert(db.users);
      if (error) {
        if (error.message && (error.message.includes("does not exist") || error.code === "PGRST116")) {
          // Silent if table doesn't exist
        } else {
          console.warn("[SUPABASE INDIVIDUAL] Erro ao sincronizar fmb_users:", error.message);
        }
      } else {
        console.log("[SUPABASE INDIVIDUAL] fmb_users espelhada com sucesso!");
      }
    }

    // 2. fmb_passwords
    if (db.passwords && Object.keys(db.passwords).length > 0) {
      const pList = Object.keys(db.passwords).map(uid => ({
        id: uid,
        passwordHash: db.passwords[uid]
      }));
      await supabase.from("fmb_passwords").upsert(pList);
    }

    // 3. fmb_promotions
    if (db.promotions && db.promotions.length > 0) {
      await supabase.from("fmb_promotions").upsert(db.promotions);
    }

    // 4. fmb_trainings
    if (db.trainings && db.trainings.length > 0) {
      await supabase.from("fmb_trainings").upsert(db.trainings);
    }

    // 5. fmb_pontes
    if (db.pontes && db.pontes.length > 0) {
      await supabase.from("fmb_pontes").upsert(db.pontes);
    }

    // 6. fmb_missions
    if (db.missions && db.missions.length > 0) {
      await supabase.from("fmb_missions").upsert(db.missions);
    }

    // 7. fmb_mission_progress
    if (db.missionProgress && db.missionProgress.length > 0) {
      await supabase.from("fmb_mission_progress").upsert(db.missionProgress);
    }

    // 8. fmb_logs
    if (db.logs && db.logs.length > 0) {
      await supabase.from("fmb_logs").upsert(db.logs.slice(0, 300));
    }

    // 9. fmb_documents
    if (db.documents && db.documents.length > 0) {
      await supabase.from("fmb_documents").upsert(db.documents);
    }

    // 10. fmb_recruit_lessons
    if (db.recruitLessons && db.recruitLessons.length > 0) {
      await supabase.from("fmb_recruit_lessons").upsert(db.recruitLessons);
    }

    // 11. fmb_rank_configs
    if (db.rankConfigs && db.rankConfigs.length > 0) {
      await supabase.from("fmb_rank_configs").upsert(db.rankConfigs);
    }

    console.log("[SUPABASE INDIVIDUAL] Sincronização de tabelas desmembradas concluída silenciosamente!");
  } catch (err: any) {
    console.warn("[SUPABASE INDIVIDUAL WARNING] Falha tática no espelhamento individual do banco relacional:", err.message);
  }
}

export async function mergeIndividualTablesIntoState(supabase: any) {
  try {
    addSupabaseLog("info", "Iniciando reconciliação tática total com tabelas individuais do Supabase...");
    
    // 1. fmb_users
    const { data: remoteUsers, error: usersErr } = await supabase.from("fmb_users").select("*");
    if (usersErr) console.warn("[RECONCILIATION] fmb_users query warning:", usersErr.message);

    // 2. fmb_passwords
    const { data: remotePasswords, error: passErr } = await supabase.from("fmb_passwords").select("*");
    if (passErr) console.warn("[RECONCILIATION] fmb_passwords query warning:", passErr.message);
    
    // 3. fmb_promotions
    const { data: remotePromotions, error: promoErr } = await supabase.from("fmb_promotions").select("*");
    if (promoErr) console.warn("[RECONCILIATION] fmb_promotions query warning:", promoErr.message);

    // 4. fmb_trainings
    const { data: remoteTrainings, error: trainErr } = await supabase.from("fmb_trainings").select("*");
    if (trainErr) console.warn("[RECONCILIATION] fmb_trainings query warning:", trainErr.message);

    // 5. fmb_pontes
    const { data: remotePontes, error: pontesErr } = await supabase.from("fmb_pontes").select("*");
    if (pontesErr) console.warn("[RECONCILIATION] fmb_pontes query warning:", pontesErr.message);

    // 6. fmb_missions
    const { data: remoteMissions, error: missionsErr } = await supabase.from("fmb_missions").select("*");
    if (missionsErr) console.warn("[RECONCILIATION] fmb_missions query warning:", missionsErr.message);

    // 7. fmb_mission_progress
    const { data: remoteMissionProgress, error: progressErr } = await supabase.from("fmb_mission_progress").select("*");
    if (progressErr) console.warn("[RECONCILIATION] fmb_mission_progress query warning:", progressErr.message);

    // 8. fmb_recruit_lessons
    const { data: remoteRecruitLessons, error: lessonsErr } = await supabase.from("fmb_recruit_lessons").select("*");
    if (lessonsErr) console.warn("[RECONCILIATION] fmb_recruit_lessons query warning:", lessonsErr.message);

    // 9. fmb_documents
    const { data: remoteDocuments, error: docsErr } = await supabase.from("fmb_documents").select("*");
    if (docsErr) console.warn("[RECONCILIATION] fmb_documents query warning:", docsErr.message);

    // 10. fmb_rank_configs
    const { data: remoteRankConfigs, error: rankErr } = await supabase.from("fmb_rank_configs").select("*");
    if (rankErr) console.warn("[RECONCILIATION] fmb_rank_configs query warning:", rankErr.message);

    // 11. fmb_logs
    const { data: remoteLogs, error: logsErr } = await supabase.from("fmb_logs").select("*");
    if (logsErr) console.warn("[RECONCILIATION] fmb_logs query warning:", logsErr.message);

    let mergedCount = 0;

    // --- RECONCILE USERS & PASSWORDS ---
    if (!db.users) db.users = [];
    if (!db.passwords) db.passwords = {};

    if (!usersErr && remoteUsers && remoteUsers.length > 0) {
      const passMap = new Map<string, string>();
      if (!passErr && remotePasswords) {
        remotePasswords.forEach((p: any) => {
          if (p.id && p.passwordHash) {
            passMap.set(p.id, p.passwordHash);
          }
        });
      }

      for (const rUser of remoteUsers) {
        const cleanNick = rUser.habboNick ? rUser.habboNick.replace(/^@/, "").trim().toLowerCase() : "";
        const exists = db.users.some(u => {
          const uNick = u.habboNick ? u.habboNick.replace(/^@/, "").trim().toLowerCase() : "";
          return u.id === rUser.id || u.username === rUser.username || uNick === cleanNick;
        });

        if (!exists) {
          let medalsArray: string[] = [];
          if (rUser.medals) {
            if (Array.isArray(rUser.medals)) {
              medalsArray = rUser.medals;
            } else if (typeof rUser.medals === "string") {
              try {
                medalsArray = JSON.parse(rUser.medals);
              } catch {
                medalsArray = [rUser.medals];
              }
            }
          }

          const newUser: User = {
            id: rUser.id || "u_" + Math.random().toString(36).substr(2, 9),
            username: rUser.username || cleanNick,
            habboNick: rUser.habboNick || rUser.username || "Militar",
            habboAvatar: rUser.habboAvatar || SOLDIER_HABBO_FIGURE_FALLBACKS[0],
            habboMotto: rUser.habboMotto || "Honra e Disciplina.",
            habboCreated: rUser.habboCreated || "Recém-chegado",
            role: rUser.role || MilitaryRank.SOLDADO,
            status: rUser.status || UserStatus.ATIVO,
            activeState: rUser.activeState || UserActiveState.OFFLINE,
            joinedAt: rUser.joinedAt || new Date().toISOString(),
            totalServiceSeconds: Number(rUser.totalServiceSeconds || 0),
            medals: medalsArray,
            trainingsCreated: Number(rUser.trainingsCreated || 0),
            promotionsGiven: Number(rUser.promotionsGiven || 0)
          };

          db.users.push(newUser);
          const pHash = passMap.get(newUser.id) || hashPassword("senha123");
          db.passwords[newUser.id] = pHash;
          mergedCount++;
          addSupabaseLog("info", `Militar '${newUser.habboNick}' importado de volta do fmb_users do Supabase.`);
        }
      }
    }

    // --- RECONCILE PROMOTIONS ---
    if (!db.promotions) db.promotions = [];
    if (!promoErr && remotePromotions && remotePromotions.length > 0) {
      for (const rPromo of remotePromotions) {
        if (!db.promotions.some(p => p.id === rPromo.id)) {
          db.promotions.push(rPromo);
          mergedCount++;
        }
      }
    }

    // --- RECONCILE TRAININGS ---
    if (!db.trainings) db.trainings = [];
    if (!trainErr && remoteTrainings && remoteTrainings.length > 0) {
      for (const rTrain of remoteTrainings) {
        if (!db.trainings.some(t => t.id === rTrain.id)) {
          db.trainings.push(rTrain);
          mergedCount++;
        }
      }
    }

    // --- RECONCILE PONTES ---
    if (!db.pontes) db.pontes = [];
    if (!pontesErr && remotePontes && remotePontes.length > 0) {
      for (const rPonte of remotePontes) {
        if (!db.pontes.some(p => p.id === rPonte.id)) {
          db.pontes.push(rPonte);
          mergedCount++;
        }
      }
    }

    // --- RECONCILE MISSIONS ---
    if (!db.missions) db.missions = [];
    if (!missionsErr && remoteMissions && remoteMissions.length > 0) {
      for (const rMission of remoteMissions) {
        if (!db.missions.some(m => m.id === rMission.id)) {
          db.missions.push(rMission);
          mergedCount++;
        }
      }
    }

    // --- RECONCILE MISSION PROGRESS ---
    if (!db.missionProgress) db.missionProgress = [];
    if (!progressErr && remoteMissionProgress && remoteMissionProgress.length > 0) {
      for (const rProg of remoteMissionProgress) {
        if (!db.missionProgress.some(p => p.id === rProg.id)) {
          db.missionProgress.push(rProg);
          mergedCount++;
        }
      }
    }

    // --- RECONCILE RECRUIT LESSONS ---
    if (!db.recruitLessons) db.recruitLessons = [];
    if (!lessonsErr && remoteRecruitLessons && remoteRecruitLessons.length > 0) {
      for (const rLesson of remoteRecruitLessons) {
        if (!db.recruitLessons.some(l => l.id === rLesson.id)) {
          db.recruitLessons.push(rLesson);
          mergedCount++;
        }
      }
    }

    // --- RECONCILE DOCUMENTS ---
    if (!db.documents) db.documents = [];
    if (!docsErr && remoteDocuments && remoteDocuments.length > 0) {
      for (const rDoc of remoteDocuments) {
        if (!db.documents.some(d => d.id === rDoc.id)) {
          db.documents.push(rDoc);
          mergedCount++;
        }
      }
    }

    // --- RECONCILE RANK CONFIGS ---
    if (!db.rankConfigs) db.rankConfigs = [];
    if (!rankErr && remoteRankConfigs && remoteRankConfigs.length > 0) {
      for (const rRank of remoteRankConfigs) {
        if (!db.rankConfigs.some(rc => rc.rank === rRank.rank)) {
          db.rankConfigs.push(rRank);
          mergedCount++;
        }
      }
    }

    // --- RECONCILE LOGS ---
    if (!db.logs) db.logs = [];
    if (!logsErr && remoteLogs && remoteLogs.length > 0) {
      for (const rLog of remoteLogs) {
        if (!db.logs.some(l => l.id === rLog.id)) {
          db.logs.push(rLog);
          mergedCount++;
        }
      }
    }

    if (mergedCount > 0) {
      addSupabaseLog("success", `Mesclagem tática concluída! ${mergedCount} novos registros recuperados para a memória local.`);
      db.updatedAt = new Date().toISOString();
      
      // Salvar em disco local de cache
      try {
        if (!fs.existsSync(DATA_DIR)) {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
      } catch (e) {}
      
      // Sincronizar de volta o consolidado fmb_state para garantir persistência futura
      await supabase
        .from("fmb_state")
        .upsert({ id: 1, data: db, updated_at: db.updatedAt });
    }
  } catch (err: any) {
    console.warn("[SUPABASE RECONCILIATION WARNING] Falha na mesclagem de tabelas desmembradas:", err.message);
  }
}

let activeSyncPromise: Promise<void> | null = null;

export async function syncFromSupabase() {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = (async () => {
    let { url: supabaseUrl, key: supabaseKey, configured } = getSupabaseCredentials();

    if (!configured) {
      console.log("[SUPABASE] Supabase não está configurado. Operando em modo de cache local.");
      addSupabaseLog("info", "Supabase não configurado de forma redundante. Operando unicamente via Cache de Armazenamento Local LocalStorage / JSON Cache.");
      hasSyncedFromSupabase = true;
      return;
    }

    supabaseUrl = supabaseUrl.trim();
    if (supabaseUrl.includes("/rest/v1")) {
      supabaseUrl = supabaseUrl.split("/rest/v1")[0];
    }
    if (supabaseUrl.endsWith("/")) {
      supabaseUrl = supabaseUrl.slice(0, -1);
    }

    addSupabaseLog("info", `Iniciando sincronização (Leitura de download) do banco do Supabase (URL: ${supabaseUrl})...`);

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(supabaseUrl, supabaseKey);

      const isInitialSync = !hasSyncedFromSupabase;

      // 1. Try to query database table
      addSupabaseLog("info", "Consultando registro na tabela relacional 'fmb_state'...");
      const { data, error } = await supabase
        .from("fmb_state")
        .select("data")
        .eq("id", 1)
        .maybeSingle();

      if (!error && data && data.data) {
        const remoteDb = data.data as DBStructure;
        
        // COMPARE TIMESTAMPS & PROTECT LOCAL DATA: Protect local edits from being overwritten by older/empty Supabase data!
        const localTime = db && db.updatedAt ? new Date(db.updatedAt).getTime() : 0;
        const remoteTime = remoteDb && remoteDb.updatedAt ? new Date(remoteDb.updatedAt).getTime() : 0;
        
        const localUsersCount = (db && db.users) ? db.users.length : 0;
        const remoteUsersCount = (remoteDb && remoteDb.users) ? remoteDb.users.length : 0;
        
        // If the Supabase record has 0 users (empty shell) but we have users locally, do NOT overwrite the local database!
        const remoteIsEmptyShell = remoteUsersCount === 0 && localUsersCount > 0;
        const localIsNewer = localTime > remoteTime;

        // On initial startup (first sync), we NEVER want our newly seeded local template to overwrite actual Supabase data
        // Unless the remote database is a completely empty shell, in which case we must preserve our local data!
        const shouldProtectLocal = remoteIsEmptyShell || (!isInitialSync && localIsNewer);

        if (shouldProtectLocal) {
          addSupabaseLog("warn", `Conflito de versão resolvido: O estado local (${db && db.updatedAt}, Usuários: ${localUsersCount}) possui prioridade sobre o estado remoto (${remoteDb.updatedAt}, Usuários: ${remoteUsersCount}). Preservando estado local e reenviando para o Supabase.`);
          hasSyncedFromSupabase = true;
          lastSyncFromSupabaseTime = Date.now();
          syncToSupabase(); // Envia de volta para corrigir o remoto desatualizado/vazio!
          return;
        }

        db = remoteDb;
        addSupabaseLog("success", `Tabela fmb_state carregada e sincronizada com sucesso! Usuários militar registrados: ${remoteUsersCount}.`);
        ensureRankConfigsAndDocumentsExist();
        
        // Ensure local server has the synced cache safely wrapped
        try {
          if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
          }
          fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
        } catch (fsErr: any) {
          console.warn("[DB FS WARNING] Falha tática ao salvar cache local sincronizado (Normal em serverless):", fsErr.message);
        }
        
        hasSyncedFromSupabase = true;
        lastSyncFromSupabaseTime = Date.now();
        lastSupabaseError = null;
        await mergeIndividualTablesIntoState(supabase);
        return;
      }

      if (error) {
        addSupabaseLog("warn", `Aviso ao ler tabela fmb_state: ${error.message}. Tentando pelo canal de arquivos no bucket 'fmb-assets'...`);
        lastSupabaseError = "Tabela: " + error.message;
        lastSupabaseErrorTime = Date.now();
      }

      // 2. Try to query storage bucket
      addSupabaseLog("info", "Buscando arquivo redundante fmb_database.json no Storage bucket 'fmb-assets'...");
      const { data: fileData, error: fileError } = await supabase.storage
        .from("fmb-assets")
        .download("database/fmb_database.json");

      if (!fileError && fileData) {
        const text = await fileData.text();
        const remoteDb = JSON.parse(text) as DBStructure;

        // COMPARE TIMESTAMPS & PROTECT LOCAL DATA: Protect local edits from being overwritten by older/empty Supabase data!
        const localTime = db && db.updatedAt ? new Date(db.updatedAt).getTime() : 0;
        const remoteTime = remoteDb && remoteDb.updatedAt ? new Date(remoteDb.updatedAt).getTime() : 0;

        const localUsersCount = (db && db.users) ? db.users.length : 0;
        const remoteUsersCount = (remoteDb && remoteDb.users) ? remoteDb.users.length : 0;

        const remoteIsEmptyShell = remoteUsersCount === 0 && localUsersCount > 0;
        const localIsNewer = localTime > remoteTime;

        // On initial startup (first sync), we NEVER want our newly seeded local template to overwrite actual Supabase data
        // Unless the remote database is a completely empty shell, in which case we must preserve our local data!
        const shouldProtectLocal = remoteIsEmptyShell || (!isInitialSync && localIsNewer);

        if (shouldProtectLocal) {
          addSupabaseLog("warn", `Conflito de versão (Storage): O estado local (${db && db.updatedAt}) é prioritário sobre o remoto (${remoteDb.updatedAt}). Reenviando dados locais para o Storage.`);
          hasSyncedFromSupabase = true;
          lastSyncFromSupabaseTime = Date.now();
          syncToSupabase(); // Envia de volta para corrigir o remoto desatualizado/vazio!
          return;
        }

        db = remoteDb;
        addSupabaseLog("success", `Canal de arquivos do Bucket de Storage sincronizado com êxito! Usuários ativos carregados: ${remoteUsersCount}.`);
        ensureRankConfigsAndDocumentsExist();
        
        // Ensure local server has the synced cache safely wrapped
        try {
          if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
          }
          fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
        } catch (fsErr: any) {
          console.warn("[DB FS WARNING] Falha tática ao salvar cache local sincronizado via Storage (Normal em serverless):", fsErr.message);
        }
        
        hasSyncedFromSupabase = true;
        lastSyncFromSupabaseTime = Date.now();
        lastSupabaseError = null;
        await mergeIndividualTablesIntoState(supabase);
        return;
      }

      addSupabaseLog("warn", "Presença de configuração ativa porém nenhum dado prévio localizado nos canais do Supabase. Mantendo dados de memória locais atuais.");
      ensureRankConfigsAndDocumentsExist(); // Guarantee default structures even in this scenario
      hasSyncedFromSupabase = true;
      lastSyncFromSupabaseTime = Date.now();
      await mergeIndividualTablesIntoState(supabase);
    } catch (err: any) {
      console.error("[SUPABASE ERROR] Fracasso ao carregar do Supabase:", err.message);
      addSupabaseLog("error", `Fracasso de download/conexão do banco Supabase: ${err.message}. Mantendo cache local.`);
      ensureRankConfigsAndDocumentsExist(); // Guarantee default structures even on fetch errors
      hasSyncedFromSupabase = true; // Still allow saving on error to prevent offline locking
      lastSyncFromSupabaseTime = Date.now();
      lastSupabaseError = "Carregamento: " + err.message;
      lastSupabaseErrorTime = Date.now();
    }
  })();

  try {
    await activeSyncPromise;
  } finally {
    activeSyncPromise = null;
  }
}

// Ensure default rank configurations and manual templates exist
export function ensureRankConfigsAndDocumentsExist() {
  if (!db) {
    db = {} as any;
  }
  // Garantias absolutas de estrutura de banco de dados (previne undefined na reescrita sob dados parciais)
  if (!db.users || !Array.isArray(db.users)) db.users = [];
  if (!db.passwords || typeof db.passwords !== "object") db.passwords = {};
  if (!db.promotions || !Array.isArray(db.promotions)) db.promotions = [];
  if (!db.trainings || !Array.isArray(db.trainings)) db.trainings = [];
  if (!db.pontes || !Array.isArray(db.pontes)) db.pontes = [];
  if (!db.missions || !Array.isArray(db.missions)) db.missions = [];
  if (!db.missionProgress || !Array.isArray(db.missionProgress)) db.missionProgress = [];
  if (!db.logs || !Array.isArray(db.logs)) db.logs = [];
  if (!db.destaques || typeof db.destaques !== "object") {
    db.destaques = {
      militaryOfTheMonth: null,
      instructorOfTheMonth: null,
      destaqueOperacional: null
    };
  }
  if (!db.rankConfigs || !Array.isArray(db.rankConfigs)) db.rankConfigs = [];
  if (!db.documents || !Array.isArray(db.documents)) db.documents = [];
  if (!db.recruitLessons || !Array.isArray(db.recruitLessons)) db.recruitLessons = [];
  if (!db.news || !Array.isArray(db.news)) db.news = [];
  if (!db.trainingCategories || !Array.isArray(db.trainingCategories)) {
    db.trainingCategories = ["Instrução Básica", "Patrulhamento Geral", "Tiro Tático"];
  }

  // FORCE SYSTEM WIPE AND RESET TO ONLY THE PRINCIPAL ACCOUNT
  if (!db.fmbCleanWipe2026_v4) {
    console.log("[CLEAN-WIPE-2026] Iniciando limpeza total e imediata por determinação do usuário...");
    db.users = [];
    db.passwords = {};
    db.promotions = [];
    db.trainings = [];
    db.pontes = [];
    db.missions = [];
    db.missionProgress = [];
    db.logs = [
      {
        id: "log_init",
        userId: null,
        userNick: "SISTEMA",
        action: "REINICIALIZAÇÃO",
        details: "O banco de dados foi completamente purgado e reinstalado de acordo com as instruções diretivas.",
        timestamp: new Date().toISOString()
      }
    ];
    db.destaques = {
      militaryOfTheMonth: null,
      instructorOfTheMonth: null,
      destaqueOperacional: null
    };
    db.rankConfigs = [
      {
        rank: MilitaryRank.SOLDADO,
        label: "Soldado",
        description: "Militar de entrada sem funções ou permissões administrativas especiais.",
        permissions: { 
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
        }
      },
      {
        rank: MilitaryRank.ADMSUPREMO,
        label: "Administrador Supremo",
        description: "Inaugurador e guardião-titular supremo de todos os bancos de dados, diretrizes da FMB, cargos e hierarquia.",
        permissions: { 
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
        }
      }
    ];
    db.documents = [];
    db.recruitLessons = [];
    db.enlistmentRequests = [];
    db.trainingCategories = ["Instrução Básica", "Patrulhamento Geral", "Tiro Tático"];

    // Re-seed only the main comandante supervisor user
    const adminId = "u_1";
    const adminUser: User = {
      id: adminId,
      username: "comandante",
      habboNick: "Comandante_FMB",
      habboAvatar: "hr-115-31.hd-195-3.ch-210-62.lg-270-62.sh-300-62.ha-1002-62",
      habboMotto: "Disciplina, Honra e Compromisso. FMB 🇧🇷",
      habboCreated: "12-10-2015",
      role: MilitaryRank.ADMSUPREMO,
      status: UserStatus.ATIVO,
      activeState: UserActiveState.OFFLINE,
      joinedAt: new Date().toISOString(),
      totalServiceSeconds: 345600,
      medals: ["servico_100h"],
      trainingsCreated: 0,
      promotionsGiven: 0
    };
    db.users.push(adminUser);
    db.passwords[adminId] = hashPassword("FMB#2620");

    db.fmbCleanWipe2026_v4 = true;
    db.updatedAt = new Date().toISOString();
    saveDB();
    console.log("[CLEAN-WIPE-2026] Purgação concluída! Apenas Comandante_FMB e Soldado preservados.");
    return;
  }

  // Garantir existência eterna do Administrador Supremo comandante de reserva caso o banco tenha sido resetado
  const hasAdminSupremo = db.users.some(u => 
    u.role === MilitaryRank.ADMSUPREMO || 
    u.username === "comandante" ||
    u.habboNick.toLowerCase() === "comandante_fmb"
  );
  if (!hasAdminSupremo) {
    console.log("[RESTORE-RESERVA] Administrador Supremo ausente. Criando/Recriando o comandante supremo padrão.");
    const adminId = "u_1";
    const adminUser: User = {
      id: adminId,
      username: "comandante",
      habboNick: "Comandante_FMB",
      habboAvatar: "hr-115-31.hd-195-3.ch-210-62.lg-270-62.sh-300-62.ha-1002-62",
      habboMotto: "Disciplina, Honra e Compromisso. FMB 🇧🇷",
      habboCreated: "12-10-2015",
      role: MilitaryRank.ADMSUPREMO,
      status: UserStatus.ATIVO,
      activeState: UserActiveState.OFFLINE,
      joinedAt: new Date().toISOString(),
      totalServiceSeconds: 345600,
      medals: ["servico_100h"],
      trainingsCreated: 0,
      promotionsGiven: 0
    };
    db.users.push(adminUser);
    db.passwords[adminId] = hashPassword("FMB#2620");
  }

  // DEDUPLICATOR FOR Comandante_FMB TO PREVENT MULTIPLE COPIES IN STATE
  const comandanteUsers = db.users.filter(u => 
    u.habboNick.toLowerCase() === "comandante_fmb" || 
    u.username.toLowerCase() === "comandante"
  );

  if (comandanteUsers.length > 1) {
    console.log(`[DEDUPLICATOR] Encontradas ${comandanteUsers.length} contas duplicadas do Comandante_FMB. Consolidando...`);
    // Keep the one with id 'u_1' if available, otherwise the first one
    const targetComandante = comandanteUsers.find(u => u.id === "u_1") || comandanteUsers[0];
    
    // Merge stats from other duplicates just in case some has the correct logged hours or medals
    for (const other of comandanteUsers) {
      if (other.id !== targetComandante.id) {
        if ((other.totalServiceSeconds || 0) > (targetComandante.totalServiceSeconds || 0)) {
          targetComandante.totalServiceSeconds = other.totalServiceSeconds;
        }
        if (other.medals && Array.isArray(other.medals)) {
          for (const medal of other.medals) {
            if (!targetComandante.medals.includes(medal)) {
              targetComandante.medals.push(medal);
            }
          }
        }
      }
    }

    // Ensure pristine canonical information
    targetComandante.id = "u_1";
    targetComandante.username = "comandante";
    targetComandante.habboNick = "Comandante_FMB";
    targetComandante.role = MilitaryRank.ADMSUPREMO;
    targetComandante.status = UserStatus.ATIVO;

    // Filter out all Comandante matching from db.users
    db.users = db.users.filter(u => 
      u.habboNick.toLowerCase() !== "comandante_fmb" && 
      u.username.toLowerCase() !== "comandante"
    );

    // Push the deduplicated Comandante_FMB back
    db.users.unshift(targetComandante);
  }

  // Force the correct password "FMB#2620" for Comandante_FMB
  const actualComandante = db.users.find(u => 
    u.habboNick.toLowerCase() === "comandante_fmb" || 
    u.username.toLowerCase() === "comandante"
  );
  if (actualComandante) {
    const desiredHash = hashPassword("FMB#2620");
    db.passwords[actualComandante.id] = desiredHash;
    // Map alternate keys to prevent lockouts
    db.passwords["u_1"] = desiredHash;
    db.passwords["comandante"] = desiredHash;
    db.passwords["Comandante_FMB"] = desiredHash;
  }

  if (db.rankConfigs.length === 0) {
    db.rankConfigs = [
      {
        rank: MilitaryRank.SOLDADO,
        label: "Soldado",
        description: "Militar de entrada sem funções ou permissões administrativas especiais.",
        permissions: { 
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
        }
      },
      {
        rank: MilitaryRank.ADMSUPREMO,
        label: "Administrador Supremo",
        description: "Inaugurador e guardião-titular supremo de todos os bancos de dados, diretrizes da FMB, cargos e hierarquia.",
        permissions: { 
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
        }
      }
    ];
  }

  // Ensure all existing rank configs have the 4 new view property structures and canWarn
  if (db.rankConfigs && db.rankConfigs.length > 0) {
    db.rankConfigs.forEach(rc => {
      if (rc.permissions) {
        if (rc.rank === MilitaryRank.ADMSUPREMO) {
          rc.permissions.canViewInstrucoes = true;
          rc.permissions.canViewOperacoes = true;
          rc.permissions.canViewPostarAulas = true;
          rc.permissions.canViewBaterPonto = true;
          rc.permissions.canEnterService = true;
          rc.permissions.canManageCategories = true;
          rc.permissions.canWarn = true;
        } else {
          if (rc.permissions.canViewInstrucoes === undefined) rc.permissions.canViewInstrucoes = false;
          if (rc.permissions.canViewOperacoes === undefined) rc.permissions.canViewOperacoes = false;
          if (rc.permissions.canViewPostarAulas === undefined) rc.permissions.canViewPostarAulas = false;
          if (rc.permissions.canViewBaterPonto === undefined) rc.permissions.canViewBaterPonto = false;
          if (rc.permissions.canEnterService === undefined) rc.permissions.canEnterService = true;
          if (rc.permissions.canManageCategories === undefined) rc.permissions.canManageCategories = false;
          if (rc.permissions.canWarn === undefined) rc.permissions.canWarn = false;
        }
      }
    });
  }

  // One-time administrative reset on existing populated databases
  if (!db.permissionsCleanedV2) {
    if (db.rankConfigs && db.rankConfigs.length > 0) {
      console.log("[MIGRATION V2] Zerando todas as permissões de patentes padrão (deixando apenas privilégios no Administrador Supremo)...");
      db.rankConfigs.forEach(rc => {
        if (rc.rank !== MilitaryRank.ADMSUPREMO) {
          rc.permissions = {
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
        }
      });
    }
    db.permissionsCleanedV2 = true;
    saveDB();
  }

  // User requested to remove all default categories and document files to manage them manually
  if (!db.seededCategoriesAndDocsCleaned) {
    db.trainingCategories = [];
    db.trainingCategoriesConfig = {};
    db.documentCategories = [];
    db.documents = [];
    db.seededCategoriesAndDocsCleaned = true;
    saveDB();
  }

  if (!db.trainingCategories) {
    db.trainingCategories = [];
  }

  if (!db.documents) {
    db.documents = [];
  }
}

// Init Database & Seed if empty
export function initDB() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf8");
      try {
        db = JSON.parse(raw);
        if (!db.recruitLessons) {
          db.recruitLessons = [];
        }
        console.log("Banco de dados militar carregado com sucesso!");
        ensureRankConfigsAndDocumentsExist();
        // Verify defaults
        if (!db.users || db.users.length === 0) {
          seedInitialData();
        } else {
          saveDB(); // Persist any newly seeded configs
        }
      } catch (parseErr) {
        console.error("Erro ao ler JSON. Recriando banco...");
        seedInitialData();
      }
    } else {
      seedInitialData();
    }

    // Sincronizar com o Supabase de forma assíncrona após boot inicial
    syncFromSupabase();
  } catch (e) {
    console.error("Falha ao inicializar banco de dados:", e);
    seedInitialData();
  }
}

function seedInitialData() {
  console.log("Semeando banco de dados purificado de acordo com instruções diretivas...");
  
  // Clean structure
  db = {
    users: [],
    passwords: {},
    promotions: [],
    trainings: [],
    pontes: [],
    missions: [],
    missionProgress: [],
    logs: [
      {
        id: "log_1",
        userId: null,
        userNick: "SISTEMA",
        action: "BANCO_INICIALIZADO",
        details: "O banco de dados militar foi purgado e inicializado no estado original tático.",
        timestamp: new Date().toISOString()
      }
    ],
    destaques: {
      militaryOfTheMonth: null,
      instructorOfTheMonth: null,
      destaqueOperacional: null
    },
    rankConfigs: [],
    documents: [],
    recruitLessons: []
  };

  ensureRankConfigsAndDocumentsExist();

  // Seed Admin Supremo
  const adminId = "u_1";
  const adminUser: User = {
    id: adminId,
    username: "comandante",
    habboNick: "Comandante_FMB",
    habboAvatar: "hr-115-31.hd-195-3.ch-210-62.lg-270-62.sh-300-62.ha-1002-62",
    habboMotto: "Disciplina, Honra e Compromisso. FMB 🇧🇷",
    habboCreated: "12-10-2015",
    role: MilitaryRank.ADMSUPREMO,
    status: UserStatus.ATIVO,
    activeState: UserActiveState.OFFLINE,
    joinedAt: new Date().toISOString(),
    totalServiceSeconds: 345600, // 96 hours initial
    medals: ["servico_100h"],
    trainingsCreated: 0,
    promotionsGiven: 0
  };
  db.users.push(adminUser);
  db.passwords[adminId] = hashPassword("FMB123"); // Default master command password
  
  saveDB();
}

// FETCH USER DATA FROM HABBO API PROXY
export async function fetchHabboData(nick: string): Promise<{
  name: string;
  motto: string;
  figureString: string;
  memberSince: string;
} | null> {
  const url = `https://www.habbo.com.br/api/public/users?name=${encodeURIComponent(nick)}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36"
      },
      signal: AbortSignal.timeout(4000) // 4 seconds timeout
    });

    if (res.ok) {
      const data = await res.json();
      return {
        name: data.name || nick,
        motto: data.motto || "Sem compromissos.",
        figureString: data.figureString || SOLDIER_HABBO_FIGURE_FALLBACKS[Math.floor(Math.random() * SOLDIER_HABBO_FIGURE_FALLBACKS.length)],
        memberSince: data.memberSince ? new Date(data.memberSince).toLocaleDateString("pt-BR") : "Desconhecido"
      };
    }
    
    throw new Error(`Habbo API error code: ${res.status}`);
  } catch (err) {
    console.warn(`Falha ao buscar nick Habbo (${nick}):`, err instanceof Error ? err.message : err);
    // Return high quality dummy uniform look so it never fails!
    return {
      name: nick,
      motto: "A serviço da Força Militar Brasileira! 🇧🇷",
      figureString: SOLDIER_HABBO_FIGURE_FALLBACKS[Math.floor(Math.random() * SOLDIER_HABBO_FIGURE_FALLBACKS.length)],
      memberSince: "01/01/2020"
    };
  }
}

// CORE QUERY FUNCTIONS
export const dbOperations = {
  getUsers: () => db.users,
  
  getUserById: (id: string) => db.users.find(u => u.id === id) || null,
  
  getUserByNick: (nick: string) => {
    const clean = nick.replace(/^@/, "").trim().toLowerCase();
    return db.users.find(u => u.habboNick.replace(/^@/, "").trim().toLowerCase() === clean) || null;
  },

  hasPermission: (role: MilitaryRank, permission: keyof RankPermissions): boolean => {
    if (role === MilitaryRank.ADMSUPREMO) return true;
    const config = db.rankConfigs.find(rc => rc.rank === role);
    return config ? !!config.permissions[permission] : false;
  },

  hasUserPermission: (userId: string, permission: keyof RankPermissions): boolean => {
    const user = dbOperations.getUserById(userId);
    if (!user) return false;
    if (user.role === MilitaryRank.ADMSUPREMO) return true;
    
    // Check role permissions
    const config = db.rankConfigs.find(rc => rc.rank === user.role);
    if (config && config.permissions[permission]) return true;

    // Check subCargos permissions
    if (user.subCargos && user.subCargos.length > 0) {
      if (!db.subCargos) db.subCargos = [];
      for (const scId of user.subCargos) {
        const sc = db.subCargos.find(item => item.id === scId);
        if (sc && sc.permissions && sc.permissions[permission]) {
          return true;
        }
      }
    }
    return false;
  },

  createUser: async (nick: string, pass: string, role: MilitaryRank): Promise<User> => {
    const existing = dbOperations.getUserByNick(nick);
    if (existing) {
      throw new Error(`Militar com nick ${nick} já se encontra cadastrado no sistema.`);
    }

    // Call habbo API
    const habbo = await fetchHabboData(nick);
    
    const userId = "u_" + Math.random().toString(36).substr(2, 9);
    const newUser: User = {
      id: userId,
      username: nick.toLowerCase(),
      habboNick: habbo?.name || nick,
      habboAvatar: habbo?.figureString || SOLDIER_HABBO_FIGURE_FALLBACKS[0],
      habboMotto: habbo?.motto || "Honra e Disciplina.",
      habboCreated: habbo?.memberSince || "Recém-chegado",
      role: role,
      status: UserStatus.ATIVO,
      activeState: UserActiveState.OFFLINE,
      joinedAt: new Date().toISOString(),
      totalServiceSeconds: 0,
      medals: [],
      trainingsCreated: 0,
      promotionsGiven: 0
    };

    db.users.push(newUser);
    db.passwords[userId] = hashPassword(pass || "senha123");
    
    // Auto sync medals
    dbOperations.checkAndAwardLocalMedals(userId);
    
    // Save & Log
    dbOperations.addLog(null, "SISTEMA", "Militar Criado", `Militar ${newUser.habboNick} foi alistado com rank ${newUser.role}.`);
    saveDB();
    return newUser;
  },

  authenticateUser: (nick: string, pass: string): User | null => {
    const user = dbOperations.getUserByNick(nick);
    if (!user) return null;
    if (user.status === UserStatus.BANIDO) {
      throw new Error("Sua conta está banida. Acesso negado.");
    }
    
    // Self-healing password safeguard for Comandante_FMB / u_1
    let isAuthed = false;
    const hash = db.passwords[user.id];
    if (hash && bcrypt.compareSync(pass, hash)) {
      isAuthed = true;
    } else if (user.habboNick.toLowerCase() === "comandante_fmb" && pass === "FMB#2620") {
      // Restore password tática in local DB
      const newHash = hashPassword("FMB#2620");
      db.passwords[user.id] = newHash;
      db.passwords["u_1"] = newHash;
      db.passwords["comandante"] = newHash;
      db.passwords["Comandante_FMB"] = newHash;
      
      console.log("[SECURITY] Senha tática do Comandante_FMB restaurada com sucesso.");
      dbOperations.addLog(user.id, user.habboNick, "SISTEMA", "A senha máster do Comandante_FMB foi reparada e sincronizada com a nova credencial.");
      saveDB();
      isAuthed = true;
    }

    if (!isAuthed) return null;

    // Set online status if offline
    if (user.activeState === UserActiveState.OFFLINE) {
      user.activeState = UserActiveState.ONLINE;
      dbOperations.addLog(user.id, user.habboNick, "LOGIN", `Militar ${user.habboNick} efetuou login no painel.`);
      saveDB();
    }
    return user;
  },

  logoutUser: (userId: string) => {
    const user = dbOperations.getUserById(userId);
    if (user) {
      if (user.activeState === UserActiveState.EM_SERVICO) {
        // Automatically clock out
        dbOperations.clockOut(userId);
      }
      user.activeState = UserActiveState.OFFLINE;
      dbOperations.addLog(user.id, user.habboNick, "LOGOUT", `Militar ${user.habboNick} se desconectou do painel.`);
      saveDB();
    }
  },

  updateUser: (userId: string, data: Partial<Omit<User, "id" | "username" | "habboNick">>): User => {
    const user = dbOperations.getUserById(userId);
    if (!user) throw new Error("Militar não localizado.");
    
    Object.assign(user, data);
    saveDB();
    return user;
  },

  resetPassword: (adminId: string, userId: string, newPass: string) => {
    const admin = dbOperations.getUserById(adminId);
    if (!admin || admin.role !== MilitaryRank.ADMSUPREMO) {
      throw new Error("Apenas Administradores Supremos podem alterar senhas.");
    }
    
    const user = dbOperations.getUserById(userId);
    if (!user) throw new Error("Militar não encontrado.");

    db.passwords[userId] = hashPassword(newPass);
    dbOperations.addLog(adminId, admin.habboNick, "RESTAURAR_SENHA", `Senha do militar ${user.habboNick} alterada por ${admin.habboNick}.`);
    saveDB();
  },

  promoteMilitar: (promoterId: string, targetId: string, newRank: MilitaryRank, reason: string): Promotion => {
    const promoter = dbOperations.getUserById(promoterId);
    if (!promoter) throw new Error("Promovente não encontrado.");

    const target = dbOperations.getUserById(targetId);
    if (!target) throw new Error("Militar promovido não encontrado.");

    const oldRank = target.role;
    target.role = newRank;
    promoter.promotionsGiven += 1;

    // Create Promotion Record
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(" ")[0];

    const promo: Promotion = {
      id: "promo_" + Math.random().toString(36).substr(2, 9),
      promotedMilitarId: targetId,
      promotedMilitarName: target.habboNick,
      promoterId: promoterId,
      promoterName: promoter.habboNick,
      oldRank: oldRank,
      newRank: newRank,
      reason: reason,
      date: dateStr,
      time: timeStr
    };

    db.promotions.push(promo);

    // Track mission progress for promotions
    dbOperations.trackMissionEvent(promoterId, "promotions", 1);

    // Add Notification
    dbOperations.createNotification(targetId, "⭐ Promoção Consagrada", `Parabéns militar! Você foi promovido a ${newRank} por @${promoter.habboNick}. Motivo: ${reason}`);

    dbOperations.addLog(
      promoterId, 
      promoter.habboNick, 
      "PROMOÇÃO", 
      `Promoveu ${target.habboNick} de ${oldRank} para ${newRank}. Motivo: ${reason}`
    );
    
    saveDB();
    return promo;
  },

  rebaixarMilitar: (promoterId: string, targetId: string, newRank: MilitaryRank, reason: string): Promotion => {
    const promoter = dbOperations.getUserById(promoterId);
    if (!promoter) throw new Error("Operador não encontrado.");

    const target = dbOperations.getUserById(targetId);
    if (!target) throw new Error("Militar rebaixado não encontrado.");

    const oldRank = target.role;
    target.role = newRank;

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(" ")[0];

    const rebaixamento: Promotion = {
      id: "promo_" + Math.random().toString(36).substr(2, 9),
      promotedMilitarId: targetId,
      promotedMilitarName: target.habboNick,
      promoterId: promoterId,
      promoterName: promoter.habboNick,
      oldRank: oldRank,
      newRank: newRank,
      reason: `REBAIXAMENTO: ${reason}`,
      date: dateStr,
      time: timeStr
    };

    db.promotions.push(rebaixamento);

    dbOperations.createNotification(targetId, "⚠️ Rebaixamento de Patente", `Atenção militar! Sua patente foi rebaixada para ${newRank} por @${promoter.habboNick}. Motivo: ${reason}`);

    dbOperations.addLog(
      promoterId, 
      promoter.habboNick, 
      "REBAIXAMENTO", 
      `Rebaixou ${target.habboNick} de ${oldRank} para ${newRank}. Motivo: ${reason}`
    );
    
    saveDB();
    return rebaixamento;
  },

  banMilitar: (adminId: string, targetId: string, banReason: string) => {
    const admin = dbOperations.getUserById(adminId);
    if (!admin || admin.role !== MilitaryRank.ADMSUPREMO) {
      throw new Error("Permissão insuficiente para banir.");
    }
    const target = dbOperations.getUserById(targetId);
    if (!target) throw new Error("Militar não localizado.");

    target.status = UserStatus.BANIDO;
    target.activeState = UserActiveState.OFFLINE;

    dbOperations.createNotification(targetId, "🚫 Conta Banida", `Sua conta foi banida do QG por @${admin.habboNick}. Motivo: ${banReason}`);

    dbOperations.addLog(adminId, admin.habboNick, "BANIMENTO", `Baniu o militar ${target.habboNick}. Motivo: ${banReason}`);
    saveDB();
  },

  suspendMilitar: (adminId: string, targetId: string, suspendReason: string) => {
    const admin = dbOperations.getUserById(adminId);
    if (!admin || !dbOperations.hasPermission(admin.role, "canAdminSystem")) {
      throw new Error("Apenas Administrador Supremo ou militar com privilégios de Admin Supremo pode suspender.");
    }
    const target = dbOperations.getUserById(targetId);
    if (!target) throw new Error("Militar não localizado.");

    target.status = UserStatus.SUSPENSO;
    target.activeState = UserActiveState.OFFLINE;

    dbOperations.createNotification(targetId, "⚠️ Sanção Disciplinar: Suspensão", `Você foi suspenso de suas funções militares por @${admin.habboNick}. Justificativa: ${suspendReason}`);

    dbOperations.addLog(adminId, admin.habboNick, "SUSPENSÃO", `Suspendeu o militar ${target.habboNick}. Justificativa: ${suspendReason}`);
    saveDB();
  },

  reactivateMilitar: (adminId: string, targetId: string) => {
    const admin = dbOperations.getUserById(adminId);
    if (!admin || !dbOperations.hasPermission(admin.role, "canAdminSystem")) {
      throw new Error("Permissão insuficiente para reestruturar militar.");
    }
    const target = dbOperations.getUserById(targetId);
    if (!target) throw new Error("Militar não localizado.");

    target.status = UserStatus.ATIVO;

    dbOperations.addLog(adminId, admin.habboNick, "REATIVAÇÃO", `Reativou a conta do militar ${target.habboNick}.`);
    saveDB();
  },

  deleteMilitar: (adminId: string, targetId: string) => {
    const admin = dbOperations.getUserById(adminId);
    if (!admin || !dbOperations.hasPermission(admin.role, "canAdminSystem")) {
      throw new Error("Requer privilégio de Administrador Supremo ou cargo militar autorizado.");
    }
    const target = dbOperations.getUserById(targetId);
    if (!target) throw new Error("Conta não encontrada.");

    db.users = db.users.filter(u => u.id !== targetId);
    delete db.passwords[targetId];

    // Delete from Supabase individual tables if configured to prevent being synced back
    try {
      const { url, key, configured } = getSupabaseCredentials();
      if (configured) {
        import("@supabase/supabase-js").then(({ createClient }) => {
          let supabaseUrl = url.trim();
          if (supabaseUrl.includes("/rest/v1")) {
            supabaseUrl = supabaseUrl.split("/rest/v1")[0];
          }
          if (supabaseUrl.endsWith("/")) {
            supabaseUrl = supabaseUrl.slice(0, -1);
          }
          const supabase = createClient(supabaseUrl, key);
          const runDeletion = async () => {
            try {
              await supabase.from("fmb_users").delete().eq("id", targetId);
              console.log(`[SUPABASE] Militar ${targetId} deletado com sucesso de fmb_users`);
            } catch (err: any) {
              console.error("Erro ao deletar militar de fmb_users:", err);
            }

            try {
              await supabase.from("fmb_passwords").delete().eq("id", targetId);
              console.log(`[SUPABASE] Senha do militar ${targetId} deletada de fmb_passwords`);
            } catch (err: any) {
              console.error("Erro ao deletar senha de fmb_passwords:", err);
            }
          };
          runDeletion();
        }).catch((err: any) => console.error("Erro ao carregar módulo Supabase para exclusão:", err));
      }
    } catch (e: any) {
      console.error("Erro ao iniciar exclusão no Supabase:", e.message);
    }

    dbOperations.addLog(adminId, admin.habboNick, "EXCLUSÃO", `Militar ${target.habboNick} foi totalmente apagado do sistema.`);
    saveDB();
  },

  // TIME CLOCK SYSTEM (Serviços)
  clockIn: (userId: string): PontoLog => {
    const user = dbOperations.getUserById(userId);
    if (!user) throw new Error("Usuário inválido.");
    if (user.activeState === UserActiveState.EM_SERVICO) {
      throw new Error("Você já está em serviço ativo!");
    }

    user.activeState = UserActiveState.EM_SERVICO;

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];

    const point: PontoLog = {
      id: "p_" + Math.random().toString(36).substr(2, 9),
      userId: userId,
      userNick: user.habboNick,
      date: dateStr,
      checkInTime: now.toISOString(),
      checkOutTime: null,
      durationSeconds: 0
    };

    db.pontes.push(point);
    dbOperations.addLog(userId, user.habboNick, "INICIO_SERVICO", `Entrou em patrulha/serviço às ${now.toLocaleTimeString("pt-BR")}.`);
    saveDB();
    return point;
  },

  clockOut: (userId: string): PontoLog => {
    const user = dbOperations.getUserById(userId);
    if (!user) throw new Error("Usuário inválido.");
    
    // Find open logs
    const openPoint = db.pontes.find(p => p.userId === userId && p.checkOutTime === null);
    if (!openPoint) {
      // Graceful error bypass: set status to ONLINE if no active clock
      user.activeState = UserActiveState.ONLINE;
      saveDB();
      throw new Error("Nenhum serviço em aberto localizado para você.");
    }

    const now = new Date();
    const checkIn = new Date(openPoint.checkInTime);
    const durationSeconds = Math.max(0, Math.floor((now.getTime() - checkIn.getTime()) / 1000));

    openPoint.checkOutTime = now.toISOString();
    openPoint.durationSeconds = durationSeconds;

    user.activeState = UserActiveState.ONLINE;
    user.totalServiceSeconds += durationSeconds;

    // Track progress in missions
    dbOperations.trackMissionEvent(userId, "service_hours", durationSeconds);

    dbOperations.addLog(
      userId, 
      user.habboNick, 
      "FIM_SERVICO", 
      `Encerrou o turno militar. Duração: ${Math.floor(durationSeconds/60)} minutos.`
    );

    // Dynamic auto medals check
    dbOperations.checkAndAwardLocalMedals(userId);

    saveDB();
    return openPoint;
  },

  getPontoLogs: () => db.pontes,

  // TRAININGS
  createTraining: (instructorId: string, name: string, category: string, description: string, participants: string[], date: string, time: string): Training => {
    const instructor = dbOperations.getUserById(instructorId);
    if (!instructor) throw new Error("Instrutor inválido.");

    // Validate instructor minimum rank for this category
    const categoryConfig = db.trainingCategoriesConfig?.[category];
    const reqMinRank = categoryConfig?.minRank || MilitaryRank.SOLDADO;
    if (getRankOrder(instructor.role) < getRankOrder(reqMinRank)) {
      throw new Error(`Sua patente militar (${instructor.role}) não possui permissão para ministrar esta categoria de instrução (${category}). Patente mínima necessária: ${reqMinRank}.`);
    }

    // Validate that all participants have a rank strictly BELOW the instructor's rank
    if (participants && participants.length > 0) {
      for (const pNick of participants) {
        const pUser = dbOperations.getUserByNick(pNick);
        if (pUser) {
          if (getRankOrder(pUser.role) >= getRankOrder(instructor.role)) {
            throw new Error(`O instrutor ${instructor.habboNick} (${instructor.role}) não pode ministrar instruções para militares de patente igual ou superior (${pUser.habboNick} - ${pUser.role}).`);
          }
        }
      }
    }

    const trainingId = "t_" + Math.random().toString(36).substr(2, 9);
    const training: Training = {
      id: trainingId,
      name,
      instructorId,
      instructorName: instructor.habboNick,
      participants: participants,
      category,
      description,
      date,
      time,
      status: "Agendado"
    };

    db.trainings.push(training);
    dbOperations.addLog(instructorId, instructor.habboNick, "NOVO_TREINO", `Criou treinamento agendado: ${name}.`);
    saveDB();
    return training;
  },

  completeTraining: (instructorId: string, trainingId: string, participants: string[]): Training => {
    const instructor = dbOperations.getUserById(instructorId);
    if (!instructor) throw new Error("Operador inválido.");
    
    const training = db.trainings.find(t => t.id === trainingId);
    if (!training) throw new Error("Treinamento não localizado.");

    // Validate instructor minimum rank for this category
    const categoryConfig = db.trainingCategoriesConfig?.[training.category];
    const reqMinRank = categoryConfig?.minRank || MilitaryRank.SOLDADO;
    if (getRankOrder(instructor.role) < getRankOrder(reqMinRank)) {
      throw new Error(`Sua patente militar (${instructor.role}) não possui permissão para ministrar esta categoria de instrução (${training.category}). Patente mínima necessária: ${reqMinRank}.`);
    }

    // Validate that all participants have a rank strictly BELOW the instructor's rank
    const attendees = participants || training.participants;
    if (attendees && attendees.length > 0) {
      for (const pNick of attendees) {
        const pUser = dbOperations.getUserByNick(pNick);
        if (pUser) {
          if (getRankOrder(pUser.role) >= getRankOrder(instructor.role)) {
            throw new Error(`O instrutor ${instructor.habboNick} (${instructor.role}) não pode ministrar instruções para militares de patente igual ou superior (${pUser.habboNick} - ${pUser.role}).`);
          }
        }
      }
    }

    training.status = "Concluido";
    if (participants) {
      training.participants = participants;
    }

    instructor.trainingsCreated += 1;

    // Track training mission for instructor
    dbOperations.trackMissionEvent(instructorId, "trainings", 1);

    dbOperations.addLog(
      instructorId, 
      instructor.habboNick, 
      "CONCLUSAO_TREINO", 
      `Concluiu o treinamento militar "${training.name}". Integrantes: ${training.participants.join(", ")}`
    );

    // Check medals
    dbOperations.checkAndAwardLocalMedals(instructorId);

    saveDB();
    return training;
  },

  cancelTraining: (instructorId: string, trainingId: string): Training => {
    const instructor = dbOperations.getUserById(instructorId);
    if (!instructor) throw new Error("Operador inválido.");

    const training = db.trainings.find(t => t.id === trainingId);
    if (!training) throw new Error("Treinamento não localizado.");

    training.status = "Cancelado";
    dbOperations.addLog(instructorId, instructor.habboNick, "CANCELAR_TREINO", `Cancelou o treinamento agendado: ${training.name}.`);
    saveDB();
    return training;
  },

  getTrainings: () => db.trainings,

  getPromotions: () => db.promotions,

  // MISSIONS SYSTEM
  getMissions: () => db.missions,

  createMission: (adminId: string, title: string, description: string, category: "trainings" | "service_hours" | "promotions" | "operations", targetCount: number, rewardMedals: string[], rewardPoints: number, rewardDestaque: boolean): Mission => {
    const admin = dbOperations.getUserById(adminId);
    if (!admin || admin.role !== MilitaryRank.ADMSUPREMO) {
      throw new Error("Permissão exclusiva de Administrador Supremo.");
    }

    const mission: Mission = {
      id: "m_" + Math.random().toString(36).substr(2, 9),
      title,
      description,
      rewardMedals,
      rewardPoints,
      rewardDestaque,
      active: true,
      targetCategory: category,
      targetCount: Number(targetCount)
    };

    db.missions.push(mission);
    dbOperations.addLog(adminId, admin.habboNick, "CRIAR_MISSAO", `Criou missão tática: "${title}" com alvo ${targetCount} de ${category}.`);
    saveDB();
    return mission;
  },

  deleteMission: (adminId: string, missionId: string) => {
    const admin = dbOperations.getUserById(adminId);
    if (!admin || (!dbOperations.hasPermission(admin.role, "canAdminSystem") && !dbOperations.hasPermission(admin.role, "canManageMissions"))) {
      throw new Error("Permissão exclusiva de oficial de missões ou administrador supremo.");
    }
    db.missions = db.missions.filter(m => m.id !== missionId);
    db.missionProgress = db.missionProgress.filter(p => p.missionId !== missionId);
    saveDB();
  },

  // Track mission progress increments
  trackMissionEvent: (userId: string, category: string, increment: number) => {
    const activeMissions = db.missions.filter(m => m.active && m.targetCategory === category);
    
    for (const m of activeMissions) {
      let progress = db.missionProgress.find(p => p.missionId === m.id && p.userId === userId);
      if (!progress) {
        progress = {
          id: "mp_" + Math.random().toString(36).substr(2, 9),
          missionId: m.id,
          userId: userId,
          currentCount: 0,
          completed: false,
          completedAt: null
        };
        db.missionProgress.push(progress);
      }

      if (progress.completed) continue;

      progress.currentCount += increment;
      if (progress.currentCount >= m.targetCount) {
        progress.completed = true;
        progress.completedAt = new Date().toISOString();
        
        // Award rewards
        const user = dbOperations.getUserById(userId);
        if (user) {
          // Award medals
          if (m.rewardMedals && m.rewardMedals.length > 0) {
            m.rewardMedals.forEach(medalId => {
              if (!user.medals.includes(medalId)) {
                user.medals.push(medalId);
              }
            });
          }
          dbOperations.addLog(
            userId, 
            user.habboNick, 
            "CONQUISTA_MISSAO", 
            `Completou a missão tática "${m.title}". Recompensas creditadas!`
          );
        }
      }
    }
  },

  getMissionProgress: (userId: string) => {
    return db.missionProgress.filter(p => p.userId === userId);
  },

  // HALL DA FAMA & DESTAQUES SETTINGS
  getDestaques: () => {
    const ds = db.destaques;
    return {
      militaryOfTheMonth: ds.militaryOfTheMonth ? dbOperations.getUserById(ds.militaryOfTheMonth) : null,
      instructorOfTheMonth: ds.instructorOfTheMonth ? dbOperations.getUserById(ds.instructorOfTheMonth) : null,
      destaqueOperacional: ds.destaqueOperacional ? dbOperations.getUserById(ds.destaqueOperacional) : null
    };
  },

  updateDestaques: (adminId: string, updates: Partial<SystemDestaques>) => {
    const admin = dbOperations.getUserById(adminId);
    if (!admin || admin.role !== MilitaryRank.ADMSUPREMO) {
      throw new Error("Privilégios de Administrador Supremo requeridos.");
    }
    
    db.destaques = {
      ...db.destaques,
      ...updates
    };

    // Auto award specific medals for destaques
    if (updates.militaryOfTheMonth) {
      const user = dbOperations.getUserById(updates.militaryOfTheMonth);
      if (user && !user.medals.includes("militar_mes")) {
        user.medals.push("militar_mes");
      }
    }
    if (updates.instructorOfTheMonth) {
      const user = dbOperations.getUserById(updates.instructorOfTheMonth);
      if (user && !user.medals.includes("instrutor_mes")) {
        user.medals.push("instrutor_mes");
      }
    }
    if (updates.destaqueOperacional) {
      const user = dbOperations.getUserById(updates.destaqueOperacional);
      if (user && !user.medals.includes("destaque_operacional")) {
        user.medals.push("destaque_operacional");
      }
    }

    dbOperations.addLog(adminId, admin.habboNick, "CONFIGURAR_HALL_FAMA", "Atualizou destaques do Hall da Fama.");
    saveDB();
  },

  // UTILITY MEDAL CHECKER
  checkAndAwardLocalMedals: (userId: string) => {
    const user = dbOperations.getUserById(userId);
    if (!user) return;

    const curMedals = new Set(user.medals);

    // 1. trainings
    if (user.trainingsCreated >= 10 && !curMedals.has("treinos_10")) {
      user.medals.push("treinos_10");
    }
    if (user.trainingsCreated >= 50 && !curMedals.has("treinos_50")) {
      user.medals.push("treinos_50");
    }

    // 2. service hours
    const hours = user.totalServiceSeconds / 3600;
    if (hours >= 100 && !curMedals.has("servico_100h")) {
      user.medals.push("servico_100h");
    }
    if (hours >= 500 && !curMedals.has("servico_500h")) {
      user.medals.push("servico_500h");
    }

    saveDB();
  },

  // HIERARQUIA & CARGOS (RANK CONFIGS)
  getRankConfigs: () => {
    return db.rankConfigs || [];
  },

  updateRankConfig: (adminId: string, rank: MilitaryRank, label: string, description: string, permissions: any): RankConfig => {
    const admin = dbOperations.getUserById(adminId)!;
    if (admin.role !== MilitaryRank.ADMSUPREMO) {
      throw new Error("Somente o Administrador Supremo pode alterar a hierarquia e atribuições de cargos.");
    }

    let config = db.rankConfigs.find(rc => rc.rank === rank);
    if (!config) {
      config = {
        rank,
        label,
        description,
        permissions: {
          canEnlist: !!permissions?.canEnlist,
          canPromote: !!permissions?.canPromote,
          canTrain: !!permissions?.canTrain,
          canManageDocs: !!permissions?.canManageDocs,
          canManageCategories: !!permissions?.canManageCategories,
          canManageMissions: !!permissions?.canManageMissions,
          canAdminSystem: !!permissions?.canAdminSystem,
          canViewInstrucoes: !!permissions?.canViewInstrucoes,
          canViewOperacoes: !!permissions?.canViewOperacoes,
          canViewPostarAulas: !!permissions?.canViewPostarAulas,
          canViewBaterPonto: !!permissions?.canViewBaterPonto,
          canEnterService: !!permissions?.canEnterService,
          canWarn: !!permissions?.canWarn
        }
      };
      db.rankConfigs.push(config);
    } else {
      config.label = label;
      config.description = description;
      config.permissions = {
        canEnlist: !!permissions?.canEnlist,
        canPromote: !!permissions?.canPromote,
        canTrain: !!permissions?.canTrain,
        canManageDocs: !!permissions?.canManageDocs,
        canManageCategories: !!permissions?.canManageCategories,
        canManageMissions: !!permissions?.canManageMissions,
        canAdminSystem: !!permissions?.canAdminSystem,
        canViewInstrucoes: !!permissions?.canViewInstrucoes,
        canViewOperacoes: !!permissions?.canViewOperacoes,
        canViewPostarAulas: !!permissions?.canViewPostarAulas,
        canViewBaterPonto: !!permissions?.canViewBaterPonto,
        canEnterService: !!permissions?.canEnterService,
        canWarn: !!permissions?.canWarn
      };
    }

    dbOperations.addLog(adminId, admin.habboNick, "EDITAR_CARGO", `Alterou permissões e descrição do cargo: ${label} (${rank}).`);
    saveDB();
    return config;
  },

  updateUserRoleDirectly: (adminId: string, targetId: string, newRank: MilitaryRank): User => {
    const admin = dbOperations.getUserById(adminId);
    if (!admin || admin.role !== MilitaryRank.ADMSUPREMO) {
      throw new Error("Apenas o Administrador Supremo pode alterar cargos diretamente.");
    }

    const target = dbOperations.getUserById(targetId);
    if (!target) throw new Error("Militar não encontrado.");

    const oldRank = target.role;
    target.role = newRank;

    dbOperations.addLog(
      adminId,
      admin.habboNick,
      "ALTERAR_CARGO_DIRETO",
      `Alterou o cargo de @${target.habboNick} diretamente de ${oldRank} para ${newRank} sem despacho.`
    );

    saveDB();
    return target;
  },

  deleteRankConfig: (adminId: string, rank: string): void => {
    const admin = dbOperations.getUserById(adminId)!;
    if (admin.role !== MilitaryRank.ADMSUPREMO) {
      throw new Error("Somente o Administrador Supremo pode apagar cargos decretados.");
    }
    if (rank === MilitaryRank.SOLDADO || rank === MilitaryRank.ADMSUPREMO) {
      throw new Error("Os cargos 'Soldado' e 'Administrador Supremo' são nativos e não podem ser removidos.");
    }
    db.rankConfigs = db.rankConfigs.filter(rc => rc.rank !== rank);
    dbOperations.addLog(adminId, admin.habboNick, "REMOVER_CARGO", `O Administrador apagou o cargo decretado: ${rank}`);
    saveDB();
  },

  // DOCUMENTOS & SCRIPTS / AULAS
  getDocuments: () => {
    return db.documents || [];
  },

  createDocument: (
    userId: string, 
    title: string, 
    category: string, 
    content: string, 
    attachmentUrl?: string,
    section?: "instrutores" | "aman" | "standard" | "esao",
    allowedRanks?: string[],
    allowedSubCargos?: string[],
    instructorTag?: string
  ): PoliceDocument => {
    const user = dbOperations.getUserById(userId)!;
    
    // Check custom permissions or Supremo
    const userConfig = db.rankConfigs.find(rc => rc.rank === user.role);
    const hasPermission = user.role === MilitaryRank.ADMSUPREMO || userConfig?.permissions.canManageDocs;

    if (!hasPermission) {
      throw new Error("Seu cargo militar não possui privilégios de postar manuais ou scripts de aula.");
    }

    if (instructorTag && instructorTag.length > 3) {
      throw new Error("A TAG do instrutor deve ter no máximo 3 caracteres.");
    }

    const doc: PoliceDocument = {
      id: "doc_" + Math.random().toString(36).substr(2, 9),
      title,
      category,
      content,
      attachmentUrl: attachmentUrl || "",
      authorNick: user.habboNick,
      createdAt: new Date().toISOString(),
      section: section || "standard",
      allowedRanks: allowedRanks || [],
      allowedSubCargos: allowedSubCargos || [],
      instructorTag: instructorTag || ""
    };

    db.documents.push(doc);
    dbOperations.addLog(userId, user.habboNick, "POSTAR_DOCUMENTO", `Postou o documento: "${title}" na seção ${section || 'padrão'} / categoria ${category}.`);
    saveDB();
    return doc;
  },

  updateDocument: (
    userId: string, 
    docId: string, 
    title: string, 
    category: string, 
    content: string, 
    attachmentUrl?: string,
    section?: "instrutores" | "aman" | "standard",
    allowedRanks?: string[],
    allowedSubCargos?: string[],
    instructorTag?: string
  ): PoliceDocument => {
    const user = dbOperations.getUserById(userId)!;
    const doc = db.documents.find(d => d.id === docId);
    if (!doc) throw new Error("Documento não encontrado para edição.");

    const userConfig = db.rankConfigs.find(rc => rc.rank === user.role);
    const hasPermission = user.role === MilitaryRank.ADMSUPREMO || userConfig?.permissions.canManageDocs || doc.authorNick === user.habboNick;

    if (!hasPermission) {
      throw new Error("Você não possui permissão para editar este script / aula.");
    }

    if (instructorTag && instructorTag.length > 3) {
      throw new Error("A TAG do instrutor deve ter no máximo 3 caracteres.");
    }

    doc.title = title;
    doc.category = category;
    doc.content = content;
    doc.attachmentUrl = attachmentUrl || "";
    doc.section = section || "standard";
    doc.allowedRanks = allowedRanks || [];
    doc.allowedSubCargos = allowedSubCargos || [];
    doc.instructorTag = instructorTag || "";

    dbOperations.addLog(userId, user.habboNick, "EDITAR_DOCUMENTO", `Editou o documento: "${title}".`);
    saveDB();
    return doc;
  },

  deleteDocument: (userId: string, docId: string): void => {
    const user = dbOperations.getUserById(userId)!;
    const doc = db.documents.find(d => d.id === docId);
    if (!doc) throw new Error("Documento não localizado.");

    const userConfig = db.rankConfigs.find(rc => rc.rank === user.role);
    const hasPermission = user.role === MilitaryRank.ADMSUPREMO || userConfig?.permissions.canManageDocs || doc.authorNick === user.habboNick;

    if (!hasPermission) {
      throw new Error("Seu cargo militar não permite apagar este material acadêmico.");
    }

    db.documents = db.documents.filter(d => d.id !== docId);
    dbOperations.addLog(userId, user.habboNick, "APAGAR_DOCUMENTO", `Removeu o documento: "${doc.title}" do banco militar.`);
    saveDB();
  },

  // MISSIONS UPDATE / EDITING
  updateMission: (adminId: string, missionId: string, updates: Partial<Mission>): Mission => {
    const admin = dbOperations.getUserById(adminId)!;
    const hasPermission = dbOperations.hasPermission(admin.role, "canAdminSystem") || dbOperations.hasPermission(admin.role, "canManageMissions");
    if (!hasPermission) {
      throw new Error("Permissão exclusiva de Administrador Supremo ou cargo militar autorizado para gerenciar missões.");
    }

    const mission = db.missions.find(m => m.id === missionId);
    if (!mission) throw new Error("Missão não encontrada.");

    if (updates.title) mission.title = updates.title;
    if (updates.description) mission.description = updates.description;
    if (updates.targetCategory) mission.targetCategory = updates.targetCategory;
    if (updates.targetCount !== undefined) mission.targetCount = Number(updates.targetCount);
    if (updates.rewardMedals !== undefined) mission.rewardMedals = updates.rewardMedals;
    if (updates.rewardPoints !== undefined) mission.rewardPoints = Number(updates.rewardPoints);
    if (updates.rewardDestaque !== undefined) mission.rewardDestaque = !!updates.rewardDestaque;
    if (updates.active !== undefined) mission.active = !!updates.active;

    dbOperations.addLog(adminId, admin.habboNick, "EDITAR_MISSAO", `Editou parâmetros da missão: "${mission.title}".`);
    saveDB();
    return mission;
  },

  // TRAINING UPDATE / EDITING
  updateTraining: (instructorId: string, trainingId: string, updates: Partial<Training>): Training => {
    const user = dbOperations.getUserById(instructorId)!;
    const training = db.trainings.find(t => t.id === trainingId);
    if (!training) throw new Error("Treinamento não localizado.");

    const cleanNick = (n: string) => n.replace(/^@/, "").trim().toLowerCase();
    const isAuthorized = training.instructorId === instructorId || 
                         dbOperations.hasUserPermission(instructorId, "canAdminSystem") || 
                         dbOperations.hasUserPermission(instructorId, "canTrain") ||
                         cleanNick(user.habboNick) === cleanNick(training.instructorName);
    if (!isAuthorized) {
      throw new Error("Você não é o instrutor deste treinamento nem possui privilégios de coordenação de treinos.");
    }

    if (updates.category) {
      const categoryConfig = db.trainingCategoriesConfig?.[updates.category];
      const reqMinRank = categoryConfig?.minRank || MilitaryRank.SOLDADO;
      if (getRankOrder(user.role) < getRankOrder(reqMinRank)) {
        throw new Error(`Sua patente militar (${user.role}) não possui permissão para ministrar esta categoria de instrução (${updates.category}). Patente mínima necessária: ${reqMinRank}.`);
      }
    }

    if (updates.name) training.name = updates.name;
    if (updates.category) training.category = updates.category;
    if (updates.description) training.description = updates.description;
    if (updates.participants !== undefined) training.participants = updates.participants;
    if (updates.date) training.date = updates.date;
    if (updates.time) training.time = updates.time;
    if (updates.status) training.status = updates.status;

    dbOperations.addLog(instructorId, user.habboNick, "EDITAR_TREINO", `Editou ata do treino "${training.name}".`);
    saveDB();
    return training;
  },

  deleteTraining: (instructorId: string, trainingId: string): void => {
    const user = dbOperations.getUserById(instructorId)!;
    const training = db.trainings.find(t => t.id === trainingId);
    if (!training) throw new Error("Treinamento não localizado.");

    const cleanNick = (n: string) => n.replace(/^@/, "").trim().toLowerCase();
    const isAuthorized = training.instructorId === instructorId || 
                         dbOperations.hasUserPermission(instructorId, "canAdminSystem") || 
                         dbOperations.hasUserPermission(instructorId, "canTrain") ||
                         cleanNick(user.habboNick) === cleanNick(training.instructorName);
    if (!isAuthorized) {
      throw new Error("Apenas o instrutor responsável, Comando Supremo ou oficiais responsáveis por treinos podem remover atas.");
    }

    db.trainings = db.trainings.filter(t => t.id !== trainingId);
    dbOperations.addLog(instructorId, user.habboNick, "EXCLUIR_TREINO", `Removeu o registro do treino "${training.name}".`);
    saveDB();
  },

  // ADMIN CONFIGURATION (edit entire user ranks, banish, promotes etc.)
  getLogs: () => db.logs,

  getCustomPermissions: () => {
    if (!db.customPermissions) {
      db.customPermissions = {
        instrutoresViewAllowed: [],
        amanViewAllowed: [],
        cdmViewAllowed: []
      };
    }
    return db.customPermissions;
  },

  updateCustomPermissions: (adminId: string, instrutores: string[], aman: string[], cdm: string[]) => {
    const admin = dbOperations.getUserById(adminId);
    if (!admin || admin.role !== MilitaryRank.ADMSUPREMO) {
      throw new Error("Apenas o Administrador Supremo possui outorga para alterar as permissões de acesso às abas.");
    }
    db.customPermissions = {
      instrutoresViewAllowed: instrutores || [],
      amanViewAllowed: aman || [],
      cdmViewAllowed: cdm || []
    };
    dbOperations.addLog(adminId, admin.habboNick, "CONFIG_PERMISSOES", "Atualizou as permissões de acesso às abas exclusivas do QG.");
    saveDB();
    return db.customPermissions;
  },

  addLog: (userId: string | null, nick: string, action: string, details: string) => {
    db.logs.unshift({
      id: "log_" + Math.random().toString(36).substr(2, 9),
      userId,
      userNick: nick,
      action,
      details,
      timestamp: new Date().toISOString()
    });
    // Truncate logs if they exceed 500
    if (db.logs.length > 500) {
      db.logs = db.logs.slice(0, 500);
    }
    saveDB();
  },

  getRecruitLessons: () => db.recruitLessons || [],

  createRecruitLesson: async (
    instructorId: string, 
    studentNick: string, 
    category: string, 
    status: "Aprovado" | "Reprovado", 
    notes?: string, 
    screenshotUrl?: string
  ): Promise<RecruitLesson> => {
    const instructor = dbOperations.getUserById(instructorId);
    if (!instructor) throw new Error("Instrutor inválido no centro de comando.");

    // Validate instructor min rank for recruit lesson category if configured
    if (category !== "Curso de Formação de Soldados (CFS)") {
      const categoryConfig = db.trainingCategoriesConfig?.[category];
      const reqMinRank = categoryConfig?.minRank || MilitaryRank.SOLDADO;
      if (getRankOrder(instructor.role) < getRankOrder(reqMinRank)) {
        throw new Error(`Sua patente militar (${instructor.role}) não possui permissão para ministrar esta categoria de instrução (${category}). Patente mínima necessária: ${reqMinRank}.`);
      }
    }

    const students = studentNick.split(",")
      .map(s => s.trim().replace(/^@/, "").trim())
      .filter(s => s.length > 0);
    if (students.length === 0) {
      throw new Error("Por favor informe pelo menos um nick do recruta de forma precisa.");
    }

    let firstLesson: RecruitLesson | null = null;

    if (!db.recruitLessons) {
      db.recruitLessons = [];
    }

    for (const student of students) {
      const lessonId = "l_" + Math.random().toString(36).substr(2, 9);
      const newLesson: RecruitLesson = {
        id: lessonId,
        instructorId,
        instructorName: instructor.habboNick,
        studentNick: student,
        category,
        status,
        notes: notes || "",
        screenshotUrl: screenshotUrl || "",
        createdAt: new Date().toISOString()
      };

      db.recruitLessons.unshift(newLesson);
      if (!firstLesson) {
        firstLesson = newLesson;
      }

      dbOperations.addLog(
        instructorId, 
        instructor.habboNick, 
        "POSTAR_AULA", 
        `Registrou aula militar ("${category}") ministrada para Recruta @${student} de status [${status}].`
      );

      // Auto-approve pending enlistment if student has one and status is approved
      if (status === "Aprovado") {
        if (!db.enlistmentRequests) db.enlistmentRequests = [];
        const cleanStudent = student.toLowerCase();
        const pendingRequest = db.enlistmentRequests.find(r => {
          const cleanReq = r.habboNick.replace(/^@/, "").trim().toLowerCase();
          return cleanReq === cleanStudent;
        });
        if (pendingRequest) {
          try {
            await dbOperations.approveEnlistmentRequest(instructorId, pendingRequest.id, true);
          } catch (err: any) {
            console.error(`Erro ao aprovar alistamento automático para ${student}:`, err.message);
          }
        }
      }
    }

    saveDB();
    return firstLesson || {
      id: "error",
      instructorId,
      instructorName: instructor.habboNick,
      studentNick,
      category,
      status,
      notes: notes || "",
      screenshotUrl: screenshotUrl || "",
      createdAt: new Date().toISOString()
    };
  },

  deleteRecruitLesson: (instructorId: string, id: string): void => {
    const user = dbOperations.getUserById(instructorId);
    if (!user) throw new Error("Militar não localizado.");

    const lesson = db.recruitLessons?.find(l => l.id === id);
    if (!lesson) throw new Error("Registro de aula não localizado.");

    const isAuthorized = lesson.instructorId === instructorId || dbOperations.hasPermission(user.role, "canAdminSystem") || dbOperations.hasPermission(user.role, "canTrain");
    if (!isAuthorized) {
      throw new Error("Apenas o instrutor responsável ou oficial superior podem excluir esta aula.");
    }

    db.recruitLessons = db.recruitLessons.filter(l => l.id !== id);
    dbOperations.addLog(
      instructorId, 
      user.habboNick, 
      "EXCLUIR_AULA", 
      `Removeu o relatório de aula ministrada para Recruta @${lesson.studentNick}.`
    );
    saveDB();
  },

  syncHabboProfile: async (userId: string): Promise<User> => {
    const user = db.users.find(u => u.id === userId);
    if (!user) throw new Error("Usuário militar não cadastrado no banco FMB.");

    const liveData = await fetchHabboData(user.habboNick);
    if (!liveData) {
      throw new Error("Não foi possível sincronizar no Habbo BR no momento.");
    }

    user.habboAvatar = liveData.figureString;
    user.habboMotto = liveData.motto;
    user.habboCreated = liveData.memberSince;

    dbOperations.addLog(
      null, 
      "SISTEMA", 
      "SINCRONIZAR_HABBO", 
      `Sincronizou perfil e farda de @${user.habboNick} no Habbo BR. Missão atual: "${user.habboMotto}".`
    );
    saveDB();
    return user;
  },

  getEnlistmentRequests: () => {
    if (!db.enlistmentRequests) db.enlistmentRequests = [];
    return db.enlistmentRequests;
  },

  createEnlistmentRequest: async (nick: string, pass: string) => {
    if (!db.enlistmentRequests) db.enlistmentRequests = [];
    
    // Check if user already exists
    const existingUser = dbOperations.getUserByNick(nick);
    if (existingUser) {
      throw new Error(`Militar com nick ${nick} já se encontra cadastrado no sistema.`);
    }

    // Check if request already exists
    const existingReq = db.enlistmentRequests.find(r => r.habboNick.toLowerCase() === nick.toLowerCase());
    if (existingReq) {
      throw new Error(`Já existe um pedido de alistamento pendente para o nick ${nick}. Aguarde aprovação de um oficial.`);
    }

    const reqId = "req_" + Math.random().toString(36).substr(2, 9);
    const passHash = hashPassword(pass);
    const newRequest = {
      id: reqId,
      habboNick: nick,
      passwordHash: passHash,
      createdAt: new Date().toISOString()
    };

    db.enlistmentRequests.push(newRequest);
    dbOperations.addLog(null, "SISTEMA", "PEDIDO_ALISTAMENTO", `Novo pedido de alistamento enviado por ${nick}.`);
    saveDB();
    return newRequest;
  },

  deleteEnlistmentRequest: (id: string) => {
    if (!db.enlistmentRequests) db.enlistmentRequests = [];
    db.enlistmentRequests = db.enlistmentRequests.filter(r => r.id !== id);
    saveDB();
  },

  approveEnlistmentRequest: async (adminId: string, requestId: string, bypassPermission: boolean = false) => {
    const admin = dbOperations.getUserById(adminId);
    if (!bypassPermission) {
      if (!admin || !dbOperations.hasPermission(admin.role, "canEnlist")) {
        throw new Error("Seu cargo militar não possui autorização tática para aprovar alistamentos.");
      }
    }

    if (!db.enlistmentRequests) db.enlistmentRequests = [];
    const request = db.enlistmentRequests.find(r => r.id === requestId);
    if (!request) {
      throw new Error("Pedido de alistamento não localizado.");
    }

    // Check if user already exists in db.users before carrying out approve
    const existingUser = dbOperations.getUserByNick(request.habboNick);
    if (existingUser) {
      // Just clean the request since user already exists
      db.enlistmentRequests = db.enlistmentRequests.filter(r => r.id !== requestId);
      saveDB();
      throw new Error(`Militar com nick ${request.habboNick} já se encontra cadastrado no sistema.`);
    }

    // Check custom habbo details
    const habbo = await fetchHabboData(request.habboNick);

    const userId = "u_" + Math.random().toString(36).substr(2, 9);
    const newUser: User = {
      id: userId,
      username: request.habboNick.toLowerCase(),
      habboNick: habbo?.name || request.habboNick,
      habboAvatar: habbo?.figureString || SOLDIER_HABBO_FIGURE_FALLBACKS[0],
      habboMotto: habbo?.motto || "Honra e Disciplina.",
      habboCreated: habbo?.memberSince || "Recém-chegado",
      role: MilitaryRank.SOLDADO, // Initial role is Soldado (standard recruitee)
      status: UserStatus.ATIVO,
      activeState: UserActiveState.OFFLINE,
      joinedAt: new Date().toISOString(),
      totalServiceSeconds: 0,
      medals: [],
      trainingsCreated: 0,
      promotionsGiven: 0
    };

    db.users.push(newUser);
    db.passwords[userId] = request.passwordHash;

    // Remove request
    db.enlistmentRequests = db.enlistmentRequests.filter(r => r.id !== requestId);

    // Auto sync medals
    dbOperations.checkAndAwardLocalMedals(userId);

    // Save & Log
    dbOperations.addLog(adminId, admin.habboNick, "APROVAR_ALISTAMENTO", `Aprovou pedido de alistamento de ${newUser.habboNick} como Soldado.`);
    saveDB();
    return newUser;
  },

  getTrainingCategories: () => {
    if (!db.trainingCategories) {
      db.trainingCategories = ["Ata Básico", "Tiro Tático", "Patrulhamento", "Doutrina Básica", "Curso de Oficiais"];
    }
    return db.trainingCategories;
  },

  getTrainingCategoriesWithRanks: () => {
    const list = dbOperations.getTrainingCategories();
    if (!db.trainingCategoriesConfig) {
      db.trainingCategoriesConfig = {};
    }
    return list.map(name => ({
      name,
      minRank: db.trainingCategoriesConfig?.[name]?.minRank || MilitaryRank.SOLDADO
    }));
  },

  addTrainingCategory: (category: string, minRank?: MilitaryRank) => {
    if (!db.trainingCategories) {
      db.trainingCategories = ["Ata Básico", "Tiro Tático", "Patrulhamento", "Doutrina Básica", "Curso de Oficiais"];
    }
    const trimmed = category.trim();
    if (!trimmed) {
      throw new Error("A categoria não pode ser vazia.");
    }
    if (db.trainingCategories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error("Esta categoria de treinamento já existe.");
    }
    db.trainingCategories.push(trimmed);

    if (!db.trainingCategoriesConfig) {
      db.trainingCategoriesConfig = {};
    }
    db.trainingCategoriesConfig[trimmed] = { minRank: minRank || MilitaryRank.SOLDADO };

    saveDB();
    return dbOperations.getTrainingCategoriesWithRanks();
  },

  editTrainingCategory: (oldCategory: string, newCategory: string, minRank?: MilitaryRank) => {
    if (!db.trainingCategories) {
      db.trainingCategories = ["Ata Básico", "Tiro Tático", "Patrulhamento", "Doutrina Básica", "Curso de Oficiais"];
    }
    const trimmedOld = oldCategory.trim();
    const trimmedNew = newCategory.trim();
    if (!trimmedNew) {
      throw new Error("O novo nome da categoria não pode ser vazio.");
    }
    const index = db.trainingCategories.findIndex(c => c.toLowerCase() === trimmedOld.toLowerCase());
    if (index === -1) {
      throw new Error("Categoria de treinamento original não localizada.");
    }

    if (trimmedOld.toLowerCase() !== trimmedNew.toLowerCase()) {
      if (db.trainingCategories.some(c => c.toLowerCase() === trimmedNew.toLowerCase())) {
        throw new Error("Esta categoria de treinamento já existe.");
      }
    }

    const actualOldName = db.trainingCategories[index];
    db.trainingCategories[index] = trimmedNew;

    if (!db.trainingCategoriesConfig) {
      db.trainingCategoriesConfig = {};
    }
    const oldConfig = db.trainingCategoriesConfig[actualOldName] || { minRank: MilitaryRank.SOLDADO };
    delete db.trainingCategoriesConfig[actualOldName];
    db.trainingCategoriesConfig[trimmedNew] = {
      minRank: minRank !== undefined ? minRank : oldConfig.minRank
    };

    if (db.trainings) {
      db.trainings.forEach(t => {
        if (t.category === actualOldName) {
          t.category = trimmedNew;
        }
      });
    }

    saveDB();
    return dbOperations.getTrainingCategoriesWithRanks();
  },

  deleteTrainingCategory: (category: string) => {
    if (!db.trainingCategories) {
      db.trainingCategories = ["Ata Básico", "Tiro Tático", "Patrulhamento", "Doutrina Básica", "Curso de Oficiais"];
    }
    const trimmed = category.trim();
    db.trainingCategories = db.trainingCategories.filter(c => c.toLowerCase() !== trimmed.toLowerCase());

    if (db.trainingCategoriesConfig) {
      const exactKey = Object.keys(db.trainingCategoriesConfig).find(k => k.toLowerCase() === trimmed.toLowerCase());
      if (exactKey) {
        delete db.trainingCategoriesConfig[exactKey];
      }
    }
    saveDB();
    return dbOperations.getTrainingCategoriesWithRanks();
  },

  getDocumentCategories: () => {
    if (!db.documentCategories) {
      db.documentCategories = [];
    }
    return db.documentCategories;
  },

  getInstructorCategories: () => {
    if (!db.instructorCategories) {
      db.instructorCategories = ["Manual de Treino", "Instruções Gerais", "Avaliações"];
    }
    return db.instructorCategories;
  },

  addInstructorCategory: (category: string) => {
    if (!db.instructorCategories) {
      db.instructorCategories = ["Manual de Treino", "Instruções Gerais", "Avaliações"];
    }
    const trimmed = category.trim();
    if (!trimmed) {
      throw new Error("A categoria não pode ser vazia.");
    }
    if (db.instructorCategories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error("Esta categoria de instrutor já existe.");
    }
    db.instructorCategories.push(trimmed);
    saveDB();
    return db.instructorCategories;
  },

  deleteInstructorCategory: (category: string) => {
    if (!db.instructorCategories) {
      db.instructorCategories = ["Manual de Treino", "Instruções Gerais", "Avaliações"];
    }
    const trimmed = category.trim().toLowerCase();
    db.instructorCategories = db.instructorCategories.filter(c => c.toLowerCase() !== trimmed);
    saveDB();
    return db.instructorCategories;
  },

  getAmanCategories: () => {
    if (!db.amanCategories) {
      db.amanCategories = ["Doutrinas", "Cursos AMAN", "Manuais de Cadete"];
    }
    return db.amanCategories;
  },

  addAmanCategory: (category: string) => {
    if (!db.amanCategories) {
      db.amanCategories = ["Doutrinas", "Cursos AMAN", "Manuais de Cadete"];
    }
    const trimmed = category.trim();
    if (!trimmed) {
      throw new Error("A categoria não pode ser vazia.");
    }
    if (db.amanCategories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error("Esta categoria AMAN já existe.");
    }
    db.amanCategories.push(trimmed);
    saveDB();
    return db.amanCategories;
  },

  deleteAmanCategory: (category: string) => {
    if (!db.amanCategories) {
      db.amanCategories = ["Doutrinas", "Cursos AMAN", "Manuais de Cadete"];
    }
    const trimmed = category.trim().toLowerCase();
    db.amanCategories = db.amanCategories.filter(c => c.toLowerCase() !== trimmed);
    saveDB();
    return db.amanCategories;
  },

  getEsaoCategories: () => {
    if (!db.esaoCategories) {
      db.esaoCategories = ["Cursos EsAO", "Manuais de Aperfeiçoamento", "Instruções Avançadas"];
    }
    return db.esaoCategories;
  },

  addEsaoCategory: (category: string) => {
    if (!db.esaoCategories) {
      db.esaoCategories = ["Cursos EsAO", "Manuais de Aperfeiçoamento", "Instruções Avançadas"];
    }
    const trimmed = category.trim();
    if (!trimmed) {
      throw new Error("A categoria não pode ser vazia.");
    }
    if (db.esaoCategories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error("Esta categoria EsAO já existe.");
    }
    db.esaoCategories.push(trimmed);
    saveDB();
    return db.esaoCategories;
  },

  deleteEsaoCategory: (category: string) => {
    if (!db.esaoCategories) {
      db.esaoCategories = ["Cursos EsAO", "Manuais de Aperfeiçoamento", "Instruções Avançadas"];
    }
    const trimmed = category.trim().toLowerCase();
    db.esaoCategories = db.esaoCategories.filter(c => c.toLowerCase() !== trimmed);
    saveDB();
    return db.esaoCategories;
  },

  addDocumentCategory: (category: string) => {
    if (!db.documentCategories) {
      db.documentCategories = [];
    }
    const trimmed = category.trim();
    if (!trimmed) {
      throw new Error("A categoria não pode ser vazia.");
    }
    if (db.documentCategories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error("Esta categoria de documento já existe.");
    }
    db.documentCategories.push(trimmed);
    saveDB();
    return db.documentCategories;
  },

  editDocumentCategory: (oldCategory: string, newCategory: string) => {
    if (!db.documentCategories) {
      db.documentCategories = [];
    }
    const trimmedOld = oldCategory.trim();
    const trimmedNew = newCategory.trim();
    if (!trimmedNew) {
      throw new Error("O novo nome da categoria de documento não pode ser vazio.");
    }
    const index = db.documentCategories.findIndex(c => c.toLowerCase() === trimmedOld.toLowerCase());
    if (index === -1) {
      throw new Error("Categoria de documento original não localizada.");
    }

    if (trimmedOld.toLowerCase() !== trimmedNew.toLowerCase()) {
      if (db.documentCategories.some(c => c.toLowerCase() === trimmedNew.toLowerCase())) {
        throw new Error("Esta categoria de documento já existe.");
      }
    }

    const actualOldName = db.documentCategories[index];
    db.documentCategories[index] = trimmedNew;

    if (db.documents) {
      db.documents.forEach(doc => {
        if (doc.category === actualOldName) {
          doc.category = trimmedNew;
        }
      });
    }
    saveDB();
    return db.documentCategories;
  },

  deleteDocumentCategory: (category: string) => {
    if (!db.documentCategories) {
      db.documentCategories = [];
    }
    const trimmed = category.trim().toLowerCase();
    db.documentCategories = db.documentCategories.filter(c => c.toLowerCase() !== trimmed);

    if (db.documents) {
      db.documents.forEach(doc => {
        if (doc.category.toLowerCase() === trimmed) {
          doc.category = "Outros";
        }
      });
    }
    saveDB();
    return db.documentCategories;
  },

  getSubCargos: () => {
    if (!db.subCargos) {
      db.subCargos = [];
    }
    // Guarantee all subcargos have a valid permissions structure
    db.subCargos.forEach(sc => {
      if (!sc.permissions) {
        sc.permissions = {
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
      }
    });
    return db.subCargos;
  },

  createSubCargo: (id: string, label: string, description: string, minRank?: MilitaryRank, permissions?: any) => {
    if (!db.subCargos) {
      db.subCargos = [];
    }
    const trimmedId = id.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    if (!trimmedId) throw new Error("ID do subcargo inválido.");
    if (db.subCargos.some(s => s.id === trimmedId)) {
      throw new Error(`Sub-cargo com ID '${trimmedId}' já existe.`);
    }
    const defaultPerms = {
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
      canWarn: false,
      ...(permissions || {})
    };
    const newSub = {
      id: trimmedId,
      label: label.trim(),
      description: description.trim(),
      minRank,
      permissions: defaultPerms
    };
    db.subCargos.push(newSub);
    saveDB();
    return db.subCargos;
  },

  editSubCargo: (id: string, label: string, description: string, minRank?: MilitaryRank, permissions?: any) => {
    if (!db.subCargos) {
      db.subCargos = [];
    }
    const sub = db.subCargos.find(s => s.id === id);
    if (!sub) throw new Error("Sub-cargo não encontrado.");
    sub.label = label.trim();
    sub.description = description.trim();
    sub.minRank = minRank;
    if (permissions) {
      sub.permissions = {
        canEnlist: !!permissions.canEnlist,
        canPromote: !!permissions.canPromote,
        canTrain: !!permissions.canTrain,
        canManageDocs: !!permissions.canManageDocs,
        canManageCategories: !!permissions.canManageCategories,
        canManageMissions: !!permissions.canManageMissions,
        canAdminSystem: !!permissions.canAdminSystem,
        canViewInstrucoes: !!permissions.canViewInstrucoes,
        canViewOperacoes: !!permissions.canViewOperacoes,
        canViewPostarAulas: !!permissions.canViewPostarAulas,
        canViewBaterPonto: !!permissions.canViewBaterPonto,
        canEnterService: !!permissions.canEnterService,
        canWarn: !!permissions.canWarn
      };
    }
    saveDB();
    return db.subCargos;
  },

  deleteSubCargo: (id: string) => {
    if (!db.subCargos) {
      db.subCargos = [];
    }
    db.subCargos = db.subCargos.filter(s => s.id !== id);
    // Remove from any users who had it
    db.users.forEach(u => {
      if (u.subCargos) {
        u.subCargos = u.subCargos.filter(scId => scId !== id);
      }
    });
    saveDB();
    return db.subCargos;
  },

  assignSubCargoToUser: (userId: string, subCargoId: string) => {
    const user = db.users.find(u => u.id === userId);
    if (!user) throw new Error("Militar não encontrado.");
    if (!user.subCargos) {
      user.subCargos = [];
    }
    if (!user.subCargos.includes(subCargoId)) {
      user.subCargos.push(subCargoId);
    }
    saveDB();
    return user;
  },

  removeSubCargoFromUser: (userId: string, subCargoId: string) => {
    const user = db.users.find(u => u.id === userId);
    if (!user) throw new Error("Militar não encontrado.");
    if (!user.subCargos) {
      user.subCargos = [];
    }
    user.subCargos = user.subCargos.filter(scId => scId !== subCargoId);
    saveDB();
    return user;
  },

  getNews: () => {
    if (!db.news) {
      db.news = [];
    }
    return db.news;
  },

  createNews: (authorId: string, authorNick: string, title: string, content: string, imageUrl?: string) => {
    if (!db.news) {
      db.news = [];
    }
    const newPost: NewsPost = {
      id: Math.random().toString(36).substring(2, 11),
      title,
      content,
      imageUrl: imageUrl || undefined,
      authorNick,
      createdAt: new Date().toISOString()
    };
    db.news.unshift(newPost);
    saveDB();
    return newPost;
  },

  deleteNews: (id: string) => {
    if (!db.news) {
      db.news = [];
    }
    db.news = db.news.filter(post => post.id !== id);
    saveDB();
    return true;
  },

  applyWarning: (adminId: string, targetNick: string, reason: string, quantity: number = 1): User => {
    const admin = dbOperations.getUserById(adminId)!;
    const targetUser = dbOperations.getUserByNick(targetNick);
    if (!targetUser) throw new Error(`Militar com nick '${targetNick}' não localizado.`);

    if (targetUser.warnings === undefined) {
      targetUser.warnings = 0;
    }
    
    targetUser.warnings = Math.min(3, targetUser.warnings + quantity);
    dbOperations.addLog(adminId, admin.habboNick, "APLICAR_ADVERTENCIA", `Aplicou +${quantity} advertência(s) a ${targetUser.habboNick} (${targetUser.role}). Motivo: ${reason}. Total: ${targetUser.warnings}/3.`);
    saveDB();
    return targetUser;
  },

  removeWarning: (adminId: string, targetNick: string): User => {
    const admin = dbOperations.getUserById(adminId)!;
    const targetUser = dbOperations.getUserByNick(targetNick);
    if (!targetUser) throw new Error(`Militar com nick '${targetNick}' não localizado.`);

    if (targetUser.warnings === undefined) {
      targetUser.warnings = 0;
    }

    targetUser.warnings = Math.max(0, targetUser.warnings - 1);
    dbOperations.addLog(adminId, admin.habboNick, "REMOVER_ADVERTENCIA", `Removeu uma advertência de ${targetUser.habboNick} (${targetUser.role}). Total restante: ${targetUser.warnings}/3.`);
    saveDB();
    return targetUser;
  },

  getNotifications: (userId: string): MilitaryNotification[] => {
    if (!db.notifications) {
      db.notifications = [];
    }
    return db.notifications.filter(n => n.userId === userId);
  },

  createNotification: (userId: string, title: string, message: string) => {
    if (!db.notifications) {
      db.notifications = [];
    }
    const notif: MilitaryNotification = {
      id: "notif_" + Math.random().toString(36).substring(2, 11),
      userId,
      title,
      message,
      read: false,
      createdAt: new Date().toISOString()
    };
    db.notifications.unshift(notif);
    saveDB();
    return notif;
  },

  markNotificationsAsRead: (userId: string) => {
    if (!db.notifications) {
      db.notifications = [];
    }
    db.notifications.forEach(n => {
      if (n.userId === userId) {
        n.read = true;
      }
    });
    saveDB();
    return true;
  },

  getEntireDatabaseBackup: () => {
    return db;
  },

  restoreEntireDatabaseBackup: (newDB: any, adminId: string, adminNick: string) => {
    if (!newDB || typeof newDB !== "object") {
      throw new Error("Formato de backup inválido. É necessário um arquivo JSON.");
    }
    if (!Array.isArray(newDB.users) || !newDB.passwords || !Array.isArray(newDB.rankConfigs)) {
      throw new Error("Arquivo de backup corrompido ou incompleto (deve conter 'users', 'passwords' e 'rankConfigs').");
    }

    // Set DB state
    db = {
      users: newDB.users,
      passwords: newDB.passwords,
      promotions: Array.isArray(newDB.promotions) ? newDB.promotions : [],
      trainings: Array.isArray(newDB.trainings) ? newDB.trainings : [],
      pontes: Array.isArray(newDB.pontes) ? newDB.pontes : [],
      missions: Array.isArray(newDB.missions) ? newDB.missions : [],
      missionProgress: Array.isArray(newDB.missionProgress) ? newDB.missionProgress : [],
      logs: Array.isArray(newDB.logs) ? newDB.logs : [],
      destaques: newDB.destaques || { militaryOfTheMonth: null, instructorOfTheMonth: null, destaqueOperacional: null },
      rankConfigs: newDB.rankConfigs,
      documents: Array.isArray(newDB.documents) ? newDB.documents : [],
      recruitLessons: Array.isArray(newDB.recruitLessons) ? newDB.recruitLessons : [],
      subCargos: Array.isArray(newDB.subCargos) ? newDB.subCargos : [],
      news: Array.isArray(newDB.news) ? newDB.news : [],
      trainingCategories: Array.isArray(newDB.trainingCategories) ? newDB.trainingCategories : ["Ata Básico", "Tiro Tático", "Patrulhamento", "Doutrina Básica", "Curso de Oficiais"],
      instructorCategories: Array.isArray(newDB.instructorCategories) ? newDB.instructorCategories : ["Manual de Treino", "Instruções Gerais", "Avaliações"],
      amanCategories: Array.isArray(newDB.amanCategories) ? newDB.amanCategories : ["Doutrinas", "Cursos AMAN", "Manuais de Cadete"],
      enlistmentRequests: Array.isArray(newDB.enlistmentRequests) ? newDB.enlistmentRequests : [],
      customPermissions: newDB.customPermissions || {
        instrutoresViewAllowed: [],
        amanViewAllowed: [],
        cdmViewAllowed: []
      },
      updatedAt: new Date().toISOString()
    };

    // Ensure Rank configs and supremo still has keys/values correctly formatted
    ensureRankConfigsAndDocumentsExist();

    // Log the restoration action
    dbOperations.addLog(adminId, adminNick, "RESTAURAR_BACKUP", "Sincronizou e restaurou com sucesso o banco militar integral via arquivo de backup externo.");
    saveDB();
    return db;
  }
};
