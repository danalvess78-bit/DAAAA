import express, { Request, Response, NextFunction } from "express";
import path from "path";
import jwt from "jsonwebtoken";
import fs from "fs";
import multer from "multer";
import { initDB, dbOperations, fetchHabboData, ensureFreshData, getSupabaseStatus, syncToSupabase, getSupabaseCredentials } from "./src/server/db.js";
import { MilitaryRank, UserStatus, UserActiveState, getRankOrder } from "./src/types.js";

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.GEMINI_API_KEY || "FMB_ESPIRITO_NACIONAL_TACTICAL_SECRET_2026";

// Initialize persistent database
initDB();

// Ensure local uploads directory exists
const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA || process.env.NETLIFY);
const UPLOADS_DIR = isServerless ? "/tmp/uploads" : path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploaded files statically
app.use("/uploads", express.static(UPLOADS_DIR));

// Configure multer file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase() || ".pdf";
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== ".pdf") {
      return cb(new Error("Apenas arquivos no formato PDF são autorizados para o acervo de manuais táticos."));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB maximum
  }
});

const uploadImage = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
    if (!allowed.includes(ext)) {
      return cb(new Error("Apenas imagens são autorizadas para relatórios de aulas (.png, .jpg, .jpeg, .webp, .gif)."));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB maximum for prints
  }
});


app.use(express.json());

// Middleware to keep Supabase data fresh across serverless containers / multi-instances
app.use(async (req, res, next) => {
  if (req.path.startsWith("/api")) {
    try {
      await ensureFreshData();
    } catch (err: any) {
      console.error("[SUPABASE RUNTIME SYNC ERROR]:", err.message);
    }
  }
  next();
});

// TYPES AND INTERFACES FOR EXPRESS LOGS/REQUESTS
interface AuthRequest extends Request {
  userId?: string;
  userRank?: MilitaryRank;
  userNick?: string;
}

// Authentication Middleware
const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ error: "Sua sessão expirou ou o token é inválido. Autentique-se novamente." });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = dbOperations.getUserById(decoded.userId);
    
    if (!user) {
      res.status(403).json({ error: "Militar não localizado no centro de comando." });
      return;
    }

    if (user.status === UserStatus.BANIDO) {
      res.status(403).json({ error: "Esta conta se encontra BANIDA do sistema." });
      return;
    }

    if (user.status === UserStatus.SUSPENSO) {
      res.status(403).json({ error: "Sua conta está temporariamente SUSPENSA do sistema." });
      return;
    }

    req.userId = user.id;
    req.userRank = user.role;
    req.userNick = user.habboNick;
    next();
  } catch (err) {
    res.status(403).json({ error: "Token inválido, corrompido ou expirado." });
  }
};

// --- AUTHENTICATION ENDPOINTS ---

// Login
app.post("/api/auth/login", (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "Identificação militar errada: Nick e Senha são de preenchimento obrigatório." });
    return;
  }

  try {
    const user = dbOperations.authenticateUser(username, password);
    if (!user) {
      res.status(400).json({ error: "Militar não localizado ou senha tática incorreta." });
      return;
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "24h" });
    res.json({
      token,
      user
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Erro durante o login militar." });
  }
});

// Logout
app.post("/api/auth/logout", authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.userId) {
    dbOperations.logoutUser(req.userId);
  }
  res.json({ message: "Desconexão efetuada com sucesso!" });
});

function getRankDisplayLabel(role: string): string {
  if (!role) return "";
  
  // 1. Try to find in db.rankConfigs
  const configs = dbOperations.getRankConfigs();
  const config = configs.find(rc => rc.rank === role || rc.label === role);
  if (config && config.label) {
    return config.label.trim();
  }
  
  // 2. Try to map from MilitaryRank enum if it's an uppercase ID/key
  const enumVal = MilitaryRank[role as keyof typeof MilitaryRank];
  if (enumVal) {
    return enumVal;
  }
  
  // 3. Check if there's a key matching uppercase of role
  const upperRole = role.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  const enumValUpper = MilitaryRank[upperRole as keyof typeof MilitaryRank];
  if (enumValUpper) {
    return enumValUpper;
  }
  
  // 4. Return the role as-is
  return role;
}

function getDecoratedUser(user: any) {
  if (!user) return null;
  
  const userTrainings = dbOperations.getTrainings().filter(
    t => t.status === "Concluido" && t.participants.includes(user.habboNick)
  );
  
  const sortedTrainings = [...userTrainings].sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.time || "00:00"}`).getTime();
    const dateB = new Date(`${b.date}T${b.time || "00:00"}`).getTime();
    return dateB - dateA;
  });

  const userLessons = dbOperations.getRecruitLessons().filter(
    l => l.studentNick.toLowerCase() === user.habboNick.toLowerCase() && l.status === "Aprovado"
  );
  
  const sortedLessons = [...userLessons].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  let latestCourseName = "";
  let latestInstructorTag = "";

  const latestTraining = sortedTrainings[0];
  const latestLesson = sortedLessons[0];

  if (latestTraining && latestLesson) {
    const tTime = new Date(`${latestTraining.date}T${latestTraining.time || "00:00"}`).getTime();
    const lTime = new Date(latestLesson.createdAt).getTime();
    if (tTime > lTime) {
      latestCourseName = latestTraining.category;
      const inst = dbOperations.getUserById(latestTraining.instructorId);
      latestInstructorTag = inst?.instructorTag || "";
    } else {
      latestCourseName = latestLesson.category;
      const inst = dbOperations.getUserById(latestLesson.instructorId);
      latestInstructorTag = inst?.instructorTag || "";
    }
  } else if (latestTraining) {
    latestCourseName = latestTraining.category;
    const inst = dbOperations.getUserById(latestTraining.instructorId);
    latestInstructorTag = inst?.instructorTag || "";
  } else if (latestLesson) {
    latestCourseName = latestLesson.category;
    const inst = dbOperations.getUserById(latestLesson.instructorId);
    latestInstructorTag = inst?.instructorTag || "";
  }

  const roleLabel = getRankDisplayLabel(user.role);
  let missaoCorreta = `[FMB] ${roleLabel}`;
  if (latestCourseName) {
    const tagPart = latestInstructorTag ? ` [${latestInstructorTag}]` : "";
    missaoCorreta = `[FMB] ${roleLabel}${tagPart} [${latestCourseName.toUpperCase()}]`;
  }

  // Convert to JSON or clean object and attach field
  const userObj = JSON.parse(JSON.stringify(user));
  userObj.missaoCorreta = missaoCorreta;
  return userObj;
}

// Get session militar info
app.get("/api/me", authenticateToken, (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    res.status(400).json({ error: "Militar não identificado." });
    return;
  }
  const user = dbOperations.getUserById(req.userId);
  res.json(getDecoratedUser(user));
});

// Update current user's instructor tag
app.post("/api/users/me/tag", authenticateToken, (req: AuthRequest, res: Response) => {
  const { tag } = req.body;
  if (tag === undefined) {
    res.status(400).json({ error: "A TAG do instrutor é obrigatória." });
    return;
  }

  const cleanTag = tag.trim();
  if (cleanTag && cleanTag.length > 3) {
    res.status(400).json({ error: "A TAG de instrução deve conter no máximo 3 caracteres." });
    return;
  }

  const user = dbOperations.getUserById(req.userId!);
  if (!user) {
    res.status(404).json({ error: "Militar não encontrado." });
    return;
  }

  // We can update the tag directly
  user.instructorTag = cleanTag || undefined;
  
  // Call helper to save
  dbOperations.updateUser(req.userId!, { instructorTag: cleanTag || undefined });

  res.json({ success: true, user: getDecoratedUser(user) });
});


// --- MILITARY PERSONNEL MANAGEMENT ---

// List all militars
app.get("/api/users", authenticateToken, (req: AuthRequest, res: Response) => {
  const users = dbOperations.getUsers().map(getDecoratedUser);
  res.json(users);
});

// Get single militar (including detailed logs/stats)
app.get("/api/users/:id", authenticateToken, (req: AuthRequest, res: Response) => {
  const user = dbOperations.getUserById(req.params.id);
  if (!user) {
    res.status(404).json({ error: "Registro militar não localizado." });
    return;
  }
  
  // Return their detailed history
  const promotions = dbOperations.getPromotions().filter(
    p => p.promotedMilitarId === user.id || p.promoterId === user.id
  );
  const trainings = dbOperations.getTrainings().filter(
    t => t.instructorId === user.id || t.participants.includes(user.habboNick)
  );
  const pontes = dbOperations.getPontoLogs().filter(p => p.userId === user.id);
  const progress = dbOperations.getMissionProgress(user.id);
  const recruitLessons = dbOperations.getRecruitLessons().filter(
    l => l.instructorId === user.id || l.studentNick.toLowerCase() === user.habboNick.toLowerCase()
  );

  res.json({
    user: getDecoratedUser(user),
    promotions,
    trainings,
    pontes,
    progress,
    recruitLessons
  });
});

// Alistar Militar (Insert Count)
app.post("/api/users", authenticateToken, async (req: AuthRequest, res: Response) => {
  const isSupremo = req.userRank === MilitaryRank.ADMSUPREMO;
  const hasEnlistPermission = req.userRank && dbOperations.hasPermission(req.userRank, "canEnlist");

  if (!isSupremo && !hasEnlistPermission) {
    res.status(403).json({ error: "Seu cargo militar não possui autorização tática para alistar recrutas." });
    return;
  }

  const { habboNick, password, role } = req.body;
  if (!habboNick || !password || !role) {
    res.status(400).json({ error: "Dados incompletos. Informe Nick Habbo, Senha e Patente inicial." });
    return;
  }

  try {
    const newUser = await dbOperations.createUser(habboNick, password, role as MilitaryRank);
    res.status(201).json(newUser);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Falha ao alistar militar." });
  }
});

// Alistamento Autônomo e Público (A própria pessoa se alista)
app.post("/api/public/enlist", async (req: Request, res: Response) => {
  const { habboNick, password } = req.body;
  if (!habboNick || !password) {
    res.status(400).json({ error: "Informe seu Nick Habbo e sua senha táctica." });
    return;
  }

  try {
    const request = await dbOperations.createEnlistmentRequest(habboNick, password);
    res.status(201).json({ message: "Pedido enviado com sucesso! Aguarde aprovação de um Oficial no quartel.", request });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Falha ao alistar militar." });
  }
});

// Status de conexao do Banco Supabase para o Painel Administrativo
app.get("/api/admin/supabase-status", authenticateToken, (req: AuthRequest, res: Response) => {
  res.json(getSupabaseStatus());
});

// Forçar sincronização imediata com feedback detalhado de erros
app.post("/api/admin/supabase-sync-force", authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.userRank || !dbOperations.hasPermission(req.userRank, "canAdminSystem")) {
    res.status(403).json({ error: "Acesso tático negado. Requer patente de Administrador Supremo." });
    return;
  }

  try {
    console.log("[ADMIN SYNC FORCE] Disparando sincronização imediata com o Supabase a pedido do Administrador...");
    await syncToSupabase();
    const status = getSupabaseStatus();
    res.json({
      success: !status.lastError,
      status: status.status,
      lastError: status.lastError,
      dbUpdatedAt: status.dbUpdatedAt
    });
  } catch (err: any) {
    res.status(500).json({ error: "Erro interno ao processar sincronização: " + err.message });
  }
});

// Baixar backup do banco de dados (Requer canAdminSystem)
app.get("/api/admin/backup", authenticateToken, (req: AuthRequest, res: Response) => {
  if (!req.userRank || !dbOperations.hasPermission(req.userRank, "canAdminSystem")) {
    res.status(403).json({ error: "Acesso tático negado. Requer patente com permissões de administrador." });
    return;
  }

  try {
    const backup = dbOperations.getEntireDatabaseBackup();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", "attachment; filename=fmb_database_backup.json");
    res.json(backup);
  } catch (err: any) {
    res.status(500).json({ error: "Erro ao gerar arquivo de backup: " + err.message });
  }
});

// Enviar/Restaurar backup do banco de dados (Requer canAdminSystem)
app.post("/api/admin/restore", authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.userId || !dbOperations.hasUserPermission(req.userId, "canAdminSystem")) {
    res.status(403).json({ error: "Acesso tático negado. Requer patente com permissões de administrador." });
    return;
  }

  const { backupData } = req.body;
  if (!backupData) {
    res.status(400).json({ error: "Conteúdo do backup não fornecido ou corrompido." });
    return;
  }

  try {
    const admin = dbOperations.getUserById(req.userId!)!;
    dbOperations.restoreEntireDatabaseBackup(backupData, admin.id, admin.habboNick);
    res.json({ success: true, message: "Banco de dados militar restaurado, salvo localmente e sincronizado na nuvem com êxito!" });
  } catch (err: any) {
    res.status(450).json({ error: err.message || "Falha na restauração do backup." });
  }
});

// Listar pedidos de alistamento (Requer login de oficial com canEnlist)
app.get("/api/admin/enlistments", authenticateToken, (req: AuthRequest, res: Response) => {
  if (!req.userId || !dbOperations.hasUserPermission(req.userId, "canEnlist")) {
    res.status(403).json({ error: "Acesso tático negado." });
    return;
  }
  res.json(dbOperations.getEnlistmentRequests());
});

// Aprovar alistamento (Cria a conta do militar com senha criptografada escolhida por ele)
app.post("/api/admin/enlistments/:id/approve", authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.userId || !dbOperations.hasUserPermission(req.userId, "canEnlist")) {
    res.status(403).json({ error: "Acesso tático negado." });
    return;
  }

  const requestId = req.params.id;
  const adminId = req.userId!;

  try {
    const newUser = await dbOperations.approveEnlistmentRequest(adminId, requestId);
    res.status(201).json({ message: "Militar aprovado e alistado com sucesso!", user: newUser });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Falha ao aprovar alistamento." });
  }
});

// Recusar/Excluir pedido de alistamento
app.delete("/api/admin/enlistments/:id", authenticateToken, (req: AuthRequest, res: Response) => {
  if (!req.userId || !dbOperations.hasUserPermission(req.userId, "canEnlist")) {
    res.status(403).json({ error: "Acesso tático negado." });
    return;
  }

  const requestId = req.params.id;
  try {
    dbOperations.deleteEnlistmentRequest(requestId);
    res.json({ message: "Pedido de alistamento removido com sucesso." });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Falha ao excluir pedido." });
  }
});

// Direct role modification (without formal promotion log)
app.put("/api/users/:id/direct-role", authenticateToken, (req: AuthRequest, res: Response) => {
  const { newRole } = req.body;
  const targetId = req.params.id;
  const adminId = req.userId!;

  if (!newRole) {
    res.status(400).json({ error: "Especifique o novo cargo/patente militar." });
    return;
  }

  try {
    const adminUser = dbOperations.getUserById(adminId)!;
    if (adminUser.role !== MilitaryRank.ADMSUPREMO) {
      res.status(403).json({ error: "Apenas o Administrador Supremo possui autonomia para alterar cargos diretamente sem despacho de promoção." });
      return;
    }

    const updated = dbOperations.updateUserRoleDirectly(adminId, targetId, newRole as any);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Promote / Demote Militar
app.put("/api/users/:id/rank", authenticateToken, (req: AuthRequest, res: Response) => {
  const { newRank, reason } = req.body;
  const targetId = req.params.id;
  const promoterId = req.userId!;

  if (!newRank || !reason) {
    res.status(400).json({ error: "Especifique a nova patente militar e a justificativa oficial." });
    return;
  }

  try {
    const promoter = dbOperations.getUserById(promoterId)!;
    const target = dbOperations.getUserById(targetId);
    if (!target) {
      res.status(404).json({ error: "Militar não localizado." });
      return;
    }

    // Role hierarchies
    const isSupremo = promoter.role === MilitaryRank.ADMSUPREMO;

    if (!isSupremo) {
      // Must have canPromote permission in DB
      const hasPromotePermission = dbOperations.hasPermission(promoter.role, "canPromote");
      if (!hasPromotePermission) {
        res.status(403).json({ error: "Sua patente militar não possui permissão ou autonomia para realizar promoções/rebaixamentos." });
        return;
      }
    }

    // Compare hierarchies
    // Promoted rank or old rank can't be above promoter's rank unless they are Supremo
    if (!isSupremo) {
      const getRankValue = (r: MilitaryRank) => {
        const order = Object.values(MilitaryRank);
        return order.indexOf(r);
      };
      // High indexes are higher ranks in the enum list!
      // Soldado is last in Enum definition? No, look at types.ts getRankOrder!
      // In types.ts we coded a helper getRankOrder()
      const pOrder = getRankOrder(promoter.role);
      const tOrder = getRankOrder(target.role);
      const nOrder = getRankOrder(newRank as MilitaryRank);

      if (tOrder >= pOrder) {
        res.status(403).json({ error: "Você não possui precedência para alterar a patente de um militar de nível igual ou superior ao seu." });
        return;
      }

      if (nOrder >= pOrder) {
        res.status(403).json({ error: "Você não pode promover um militar para um nível igual ou acima do seu próprio." });
        return;
      }
    }

    // Determine if it is a promotion or demotion
    const tOrder = getRankOrder(target.role);
    const nOrder = getRankOrder(newRank as MilitaryRank);

    let result;
    if (nOrder > tOrder) {
      result = dbOperations.promoteMilitar(promoterId, targetId, newRank as MilitaryRank, reason);
      try {
        dbOperations.createNotification(targetId, "Promoção Militar Consagrada!", `Você foi promovido para a patente de ${newRank} por @${promoter.habboNick}. Justificativa: ${reason}`);
      } catch (notifErr) {
        console.error("Erro ao criar notificação de promoção:", notifErr);
      }
    } else {
      result = dbOperations.rebaixarMilitar(promoterId, targetId, newRank as MilitaryRank, reason);
      try {
        dbOperations.createNotification(targetId, "Rebaixamento / Ajuste Militar!", `Sua patente foi alterada para ${newRank} por @${promoter.habboNick}. Motivo: ${reason}`);
      } catch (notifErr) {
        console.error("Erro ao criar notificação de rebaixamento:", notifErr);
      }
    }

    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Erro ao processar promoção militar." });
  }
});

// Ban militar (Supremo only)
app.put("/api/users/:id/ban", authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.userRank !== MilitaryRank.ADMSUPREMO) {
    res.status(403).json({ error: "Ação restrita ao Administrador Supremo do Comando Militar." });
    return;
  }
  const { reason } = req.body;
  if (!reason) {
    res.status(400).json({ error: "Informe a justificativa do banimento oficial." });
    return;
  }

  try {
    dbOperations.banMilitar(req.userId!, req.params.id, reason);
    try {
      dbOperations.createNotification(req.params.id, "Banimento Decretado!", `Seu cadastro militar foi marcado como BANIDO por @${req.userNick}. Motivo: ${reason}`);
    } catch (notifErr) {
      console.error("Erro ao criar notificação de banimento:", notifErr);
    }
    res.json({ message: "Militar banido com êxito." });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Suspend militar (Supremo only)
app.put("/api/users/:id/suspend", authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.userRank !== MilitaryRank.ADMSUPREMO) {
    res.status(403).json({ error: "Militar sem autonomia. Ação restrita ao Administrador Supremo." });
    return;
  }
  const { reason } = req.body;
  if (!reason) {
    res.status(400).json({ error: "Informe os motivos táticos para suspensão militar." });
    return;
  }

  try {
    dbOperations.suspendMilitar(req.userId!, req.params.id, reason);
    try {
      dbOperations.createNotification(req.params.id, "Suspensão Decretada!", `Você foi suspenso temporariamente do QG por @${req.userNick}. Motivo: ${reason}`);
    } catch (notifErr) {
      console.error("Erro ao criar notificação de suspensão:", notifErr);
    }
    res.json({ message: "Militar suspenso com sucesso." });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Reactivate militar (Supremo only)
app.put("/api/users/:id/reactivate", authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.userRank !== MilitaryRank.ADMSUPREMO) {
    res.status(403).json({ error: "Apenas Administradores do Alto Comando podem reativar cadastros." });
    return;
  }
  try {
    dbOperations.reactivateMilitar(req.userId!, req.params.id);
    try {
      dbOperations.createNotification(req.params.id, "Conta Reativada!", `Seu cadastro militar foi reativado por @${req.userNick}. Bem-vindo de volta ao serviço ativo!`);
    } catch (notifErr) {
      console.error("Erro ao criar notificação de reativação:", notifErr);
    }
    res.json({ message: "Militar reativado com sucesso." });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Create custom role (Requested by user under Supremo)
app.put("/api/users/:id/password", authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.userRank !== MilitaryRank.ADMSUPREMO) {
    res.status(403).json({ error: "Somente Administradores Supremos podem alterar credenciais alheias." });
    return;
  }
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) {
    res.status(400).json({ error: "Forneça uma senha segura de ao menos 4 caracteres." });
    return;
  }

  try {
    dbOperations.resetPassword(req.userId!, req.params.id, newPassword);
    res.json({ message: "Credenciais de acesso redefinidas sob chancela do Comando Supremo." });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete account (Supremo only)
app.delete("/api/users/:id", authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.userRank !== MilitaryRank.ADMSUPREMO) {
    res.status(403).json({ error: "Apenas Administradores Supremos podem purgar registros militares do sistema." });
    return;
  }
  try {
    dbOperations.deleteMilitar(req.userId!, req.params.id);
    res.json({ message: "Registro militar banido definitivamente e apagado do banco tático." });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Warnings (Advertências) endpoints
app.post("/api/users/warn", authenticateToken, (req: AuthRequest, res: Response) => {
  const { targetNick, reason, quantity } = req.body;
  if (!targetNick || !reason) {
    res.status(400).json({ error: "O nick do militar e o motivo da advertência são obrigatórios." });
    return;
  }

  const hasAccess = req.userRank === MilitaryRank.ADMSUPREMO || 
                    dbOperations.hasUserPermission(req.userId!, "canWarn") ||
                    dbOperations.hasUserPermission(req.userId!, "canAdminSystem");
  if (!hasAccess) {
    res.status(403).json({ error: "Sua patente militar ou subcargo não possui permissão para aplicar advertências." });
    return;
  }

  try {
    const qty = quantity ? parseInt(quantity, 10) : 1;
    const updatedUser = dbOperations.applyWarning(req.userId!, targetNick, reason, qty);
    res.json({ success: true, user: getDecoratedUser(updatedUser) });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/users/unwarn", authenticateToken, (req: AuthRequest, res: Response) => {
  const { targetNick } = req.body;
  if (!targetNick) {
    res.status(400).json({ error: "O nick do militar é obrigatório para remover a advertência." });
    return;
  }

  const hasAccess = req.userRank === MilitaryRank.ADMSUPREMO || 
                    dbOperations.hasUserPermission(req.userId!, "canWarn") ||
                    dbOperations.hasUserPermission(req.userId!, "canAdminSystem");
  if (!hasAccess) {
    res.status(403).json({ error: "Sua patente militar ou subcargo não possui permissão para remover advertências." });
    return;
  }

  try {
    const updatedUser = dbOperations.removeWarning(req.userId!, targetNick);
    res.json({ success: true, user: getDecoratedUser(updatedUser) });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// --- TIME CLOCK SYSTEM (Folha de Ponto) ---

// Clock In
app.post("/api/service/clock-in", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const user = dbOperations.getUserById(req.userId!)!;
    const rankConfigs = dbOperations.getRankConfigs();
    const config = rankConfigs.find(rc => rc.rank === user.role);
    if (config && config.permissions && config.permissions.canEnterService === false) {
      res.status(403).json({ error: "Você não possui permissão para entrar em serviço." });
      return;
    }

    const point = dbOperations.clockIn(req.userId!);
    res.json(point);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Clock Out
app.post("/api/service/clock-out", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const point = dbOperations.clockOut(req.userId!);
    res.json(point);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Retrieve all Clock In/Out Logs (Folha de Ponto)
app.get("/api/service/pontes", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const user = dbOperations.getUserById(req.userId!)!;
    const rankConfigs = dbOperations.getRankConfigs();
    const config = rankConfigs.find(rc => rc.rank === user.role);
    if (config && config.permissions && config.permissions.canViewBaterPonto === false) {
      res.status(403).json({ error: "Você não possui permissão para visualizar o espelho de ponto." });
      return;
    }

    const logs = dbOperations.getPontoLogs();
    res.json(logs);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get operations summary
app.get("/api/dashboard/stats", authenticateToken, (req: AuthRequest, res: Response) => {
  const users = dbOperations.getUsers();
  const trainings = dbOperations.getTrainings();
  const promotions = dbOperations.getPromotions();
  
  const online = users.filter(u => u.activeState === UserActiveState.ONLINE).length;
  const emServico = users.filter(u => u.activeState === UserActiveState.EM_SERVICO).length;
  
  // Calculate total operational hours
  const totalSeconds = users.reduce((sum, u) => sum + u.totalServiceSeconds, 0);
  const totalHours = Math.round(totalSeconds / 3600);

  res.json({
    totalMilitars: users.length,
    online,
    emServico,
    trainingsConcluded: trainings.filter(t => t.status === "Concluido").length,
    promotionsTotal: promotions.length,
    totalHoursActivity: totalHours
  });
});


// --- MILITARY TRAINING SYSTEM ---

// Get trainings
app.get("/api/trainings", authenticateToken, (req: AuthRequest, res: Response) => {
  res.json(dbOperations.getTrainings());
});

// Create training
app.post("/api/trainings", authenticateToken, (req: AuthRequest, res: Response) => {
  const { name, category, description, participants, date, time } = req.body;
  
  if (!name || !category || !description) {
    res.status(400).json({ error: "Preencha todos os campos fundamentais da ata de instrução." });
    return;
  }

  try {
    const tr = dbOperations.createTraining(
      req.userId!,
      name,
      category,
      description,
      participants || [],
      date || new Date().toISOString().split("T")[0],
      time || new Date().toTimeString().slice(0, 5)
    );
    res.status(201).json(tr);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Complete / cancel training
app.put("/api/trainings/:id/complete", authenticateToken, (req: AuthRequest, res: Response) => {
  const { participants } = req.body;
  try {
    const tr = dbOperations.completeTraining(req.userId!, req.params.id, participants);
    res.json(tr);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.put("/api/trainings/:id/cancel", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const tr = dbOperations.cancelTraining(req.userId!, req.params.id);
    res.json(tr);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/trainings/:id", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    dbOperations.deleteTraining(req.userId!, req.params.id);
    res.json({ message: "Treinamento removido com sucesso de forma definitiva do banco militar." });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// --- MISSIONS SYSTEM ---

// Get active missions
app.get("/api/missions", authenticateToken, (req: AuthRequest, res: Response) => {
  const list = dbOperations.getMissions();
  res.json(list);
});

// Create task mission (Admin supremo)
app.post("/api/missions", authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.userRank !== MilitaryRank.ADMSUPREMO) {
    res.status(403).json({ error: "Requer privilégios de Administrador Supremo." });
    return;
  }

  const { title, description, category, targetCount, rewardMedals, rewardPoints, rewardDestaque } = req.body;
  if (!title || !description || !category || !targetCount) {
    res.status(400).json({ error: "Campos obrigatórios ausentes para registro de missão tática." });
    return;
  }

  try {
    const mission = dbOperations.createMission(
      req.userId!,
      title,
      description,
      category,
      targetCount,
      rewardMedals || [],
      Number(rewardPoints) || 0,
      !!rewardDestaque
    );
    res.status(201).json(mission);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Purge mission (Admin supremo)
app.delete("/api/missions/:id", authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.userRank !== MilitaryRank.ADMSUPREMO) {
    res.status(403).json({ error: "Apenas Administrador Supremo pode expurgar missões." });
    return;
  }
  try {
    dbOperations.deleteMission(req.userId!, req.params.id);
    res.json({ message: "Missão tática removida do quartel-general." });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update mission (Admin supremo)
app.put("/api/missions/:id", authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.userRank !== MilitaryRank.ADMSUPREMO) {
    res.status(403).json({ error: "Apenas Administrador Supremo pode editar missões." });
    return;
  }
  try {
    const updated = dbOperations.updateMission(req.userId!, req.params.id, req.body);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// --- NOTIFICATIONS ---
app.get("/api/notifications", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const list = dbOperations.getNotifications(req.userId!);
    res.json(list);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/notifications/user/:userId", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const list = dbOperations.getNotifications(req.params.userId);
    res.json(list);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/notifications/send", authenticateToken, (req: AuthRequest, res: Response) => {
  const { userId, title, message } = req.body;
  if (!userId || !title || !message) {
    res.status(400).json({ error: "ID do usuário, título e mensagem são obrigatórios." });
    return;
  }
  try {
    const notif = dbOperations.createNotification(userId, title, message);
    res.status(201).json(notif);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/notifications/read", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    dbOperations.markNotificationsAsRead(req.userId!);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// --- HIERARCHY & CARGOS / PERMISSOES ---
app.get("/api/hierarchy", authenticateToken, (req: AuthRequest, res: Response) => {
  res.json(dbOperations.getRankConfigs());
});

app.put("/api/hierarchy", authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.userRank !== MilitaryRank.ADMSUPREMO) {
    res.status(403).json({ error: "Apenas o Administrador Supremo pode alterar permissões ou hierarquias decretadas." });
    return;
  }
  const { rank, label, description, permissions } = req.body;
  if (!rank || !label) {
    res.status(400).json({ error: "Informe a patente do cargo e o rótulo descritivo." });
    return;
  }
  try {
    const updated = dbOperations.updateRankConfig(req.userId!, rank, label, description, permissions);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/hierarchy/:rank", authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.userRank !== MilitaryRank.ADMSUPREMO) {
    res.status(403).json({ error: "Apenas o Administrador Supremo pode apagar cargos decretados." });
    return;
  }
  const { rank } = req.params;
  try {
    dbOperations.deleteRankConfig(req.userId!, rank);
    res.json({ success: true, message: `Cargo ${rank} removido com sucesso.` });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// --- FILE STORAGE & PDF UPLOADS ---
app.post("/api/upload", authenticateToken, upload.single("pdf"), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "Nenhum arquivo PDF foi enviado." });
    return;
  }

  // File saved locally, let's construct local URL path
  let fileUrl = `/uploads/${req.file.filename}`;

  // If Supabase credentials exist, try uploading to Supabase Storage!
  const creds = getSupabaseCredentials();

  if (creds.configured) {
    let supabaseUrl = creds.url.trim();
    const supabaseKey = creds.key;

    if (supabaseUrl.includes("/rest/v1")) {
      supabaseUrl = supabaseUrl.split("/rest/v1")[0];
    }
    if (supabaseUrl.endsWith("/")) {
      supabaseUrl = supabaseUrl.slice(0, -1);
    }

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const fileBuffer = fs.readFileSync(req.file.path);
      const fileName = `pdfs/${Date.now()}-${req.file.filename}`;
      
      // Upload to "fmb-assets" bucket
      const { data, error } = await supabase.storage
        .from("fmb-assets")
        .upload(fileName, fileBuffer, {
          contentType: "application/pdf",
          upsert: true
        });

      if (!error && data) {
        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from("fmb-assets")
          .getPublicUrl(fileName);
          
        if (publicUrlData?.publicUrl) {
          fileUrl = publicUrlData.publicUrl;
          console.log("[SUPABASE] PDF carregado no Storage do Supabase com sucesso:", fileUrl);
        }
      } else {
        console.warn("[SUPABASE] Falha ao gravar no Storage, usando fallback de link local:", error?.message);
      }
    } catch (uploadErr: any) {
      console.warn("[SUPABASE ERROR] Erro ao instanciar ou subir no Supabase, usando backup local:", uploadErr.message);
    }
  }

  res.json({ url: fileUrl });
});

// --- FILE STORAGE & IMAGE UPLOADS FOR PRINTS ---
app.post("/api/upload-image", authenticateToken, uploadImage.single("image"), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "Nenhuma imagem de farda ou print foi enviada." });
    return;
  }

  let fileUrl = `/uploads/${req.file.filename}`;

  const creds = getSupabaseCredentials();

  if (creds.configured) {
    let supabaseUrl = creds.url.trim();
    const supabaseKey = creds.key;

    if (supabaseUrl.includes("/rest/v1")) {
      supabaseUrl = supabaseUrl.split("/rest/v1")[0];
    }
    if (supabaseUrl.endsWith("/")) {
      supabaseUrl = supabaseUrl.slice(0, -1);
    }

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const fileBuffer = fs.readFileSync(req.file.path);
      const fileName = `prints/${Date.now()}-${req.file.filename}`;
      const ext = path.extname(req.file.filename).toLowerCase();
      let contentType = "image/png";
      if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
      if (ext === ".gif") contentType = "image/gif";
      if (ext === ".webp") contentType = "image/webp";
      
      const { data, error } = await supabase.storage
        .from("fmb-assets")
        .upload(fileName, fileBuffer, {
          contentType: contentType,
          upsert: true
        });

      if (!error && data) {
        const { data: publicUrlData } = supabase.storage
          .from("fmb-assets")
          .getPublicUrl(fileName);
          
        if (publicUrlData?.publicUrl) {
          fileUrl = publicUrlData.publicUrl;
          console.log("[SUPABASE] Print carregado no Storage do Supabase com sucesso:", fileUrl);
        }
      } else {
        console.warn("[SUPABASE] Falha ao gravar print no Storage, usando fallback local:", error?.message);
      }
    } catch (uploadErr: any) {
      console.warn("[SUPABASE ERROR] Erro ao carregar print no Supabase, usando backup local:", uploadErr.message);
    }
  }

  res.json({ url: fileUrl });
});

// --- RECRUIT LESSONS ENDPOINTS ---
app.get("/api/recruit-lessons", authenticateToken, (req: AuthRequest, res: Response) => {
  res.json(dbOperations.getRecruitLessons());
});

app.post("/api/recruit-lessons", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { studentNick, category, status, notes, screenshotUrl } = req.body;
  if (!studentNick || !category || !status) {
    res.status(400).json({ error: "Nick do recruta, tipo de aula e resultado final são obrigatórios." });
    return;
  }
  try {
    const lesson = await dbOperations.createRecruitLesson(req.userId!, studentNick, category, status, notes, screenshotUrl);
    res.status(201).json(lesson);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/recruit-lessons/:id", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    dbOperations.deleteRecruitLesson(req.userId!, req.params.id);
    res.json({ message: "Relatório de aula para recruta excluído com sucesso do QG FMB." });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- TRAINING CATEGORIES ENDPOINTS ---
app.get("/api/training-categories", authenticateToken, (req: AuthRequest, res: Response) => {
  res.json(dbOperations.getTrainingCategoriesWithRanks());
});

app.post("/api/training-categories", authenticateToken, (req: AuthRequest, res: Response) => {
  const { category, minRank } = req.body;
  if (!category) {
    res.status(400).json({ error: "O nome da categoria é obrigatório." });
    return;
  }
  
  const hasAccess = req.userRank === MilitaryRank.ADMSUPREMO || dbOperations.hasUserPermission(req.userId!, "canManageCategories") || dbOperations.hasUserPermission(req.userId!, "canAdminSystem");
  if (!hasAccess) {
    res.status(403).json({ error: "Sua patente militar não possui permissão para gerenciar categorias de treinamento." });
    return;
  }

  try {
    const list = dbOperations.addTrainingCategory(category, minRank);
    res.status(201).json(list);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put("/api/training-categories/:category", authenticateToken, (req: AuthRequest, res: Response) => {
  const { newCategory, minRank } = req.body;
  if (!newCategory) {
    res.status(400).json({ error: "O novo nome da categoria é obrigatório." });
    return;
  }

  const hasAccess = req.userRank === MilitaryRank.ADMSUPREMO || dbOperations.hasUserPermission(req.userId!, "canManageCategories") || dbOperations.hasUserPermission(req.userId!, "canAdminSystem");
  if (!hasAccess) {
    res.status(403).json({ error: "Sua patente militar não possui permissão para editar categorias de treinamento." });
    return;
  }

  try {
    const list = dbOperations.editTrainingCategory(req.params.category, newCategory, minRank);
    res.json(list);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/training-categories/:category", authenticateToken, (req: AuthRequest, res: Response) => {
  const category = req.params.category;
  
  const hasAccess = req.userRank === MilitaryRank.ADMSUPREMO || dbOperations.hasUserPermission(req.userId!, "canManageCategories") || dbOperations.hasUserPermission(req.userId!, "canAdminSystem");
  if (!hasAccess) {
    res.status(403).json({ error: "Sua patente militar não possui permissão para gerenciar categorias de treinamento." });
    return;
  }

  try {
    const list = dbOperations.deleteTrainingCategory(category);
    res.json(list);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- DOCUMENT CATEGORIES ENDPOINTS ---
app.get("/api/document-categories", authenticateToken, (req: AuthRequest, res: Response) => {
  res.json(dbOperations.getDocumentCategories());
});

app.post("/api/document-categories", authenticateToken, (req: AuthRequest, res: Response) => {
  const { category } = req.body;
  if (!category) {
    res.status(400).json({ error: "O nome da categoria é obrigatório." });
    return;
  }
  
  const hasAccess = req.userRank === MilitaryRank.ADMSUPREMO || dbOperations.hasUserPermission(req.userId!, "canManageCategories") || dbOperations.hasUserPermission(req.userId!, "canManageDocs") || dbOperations.hasUserPermission(req.userId!, "canAdminSystem");
  if (!hasAccess) {
    res.status(403).json({ error: "Sua patente militar não possui permissão para gerenciar categorias de documentos." });
    return;
  }

  try {
    const list = dbOperations.addDocumentCategory(category);
    res.status(201).json(list);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put("/api/document-categories/:category", authenticateToken, (req: AuthRequest, res: Response) => {
  const { newCategory } = req.body;
  if (!newCategory) {
    res.status(400).json({ error: "O novo nome da categoria é obrigatório." });
    return;
  }

  const hasAccess = req.userRank === MilitaryRank.ADMSUPREMO || dbOperations.hasUserPermission(req.userId!, "canManageCategories") || dbOperations.hasUserPermission(req.userId!, "canManageDocs") || dbOperations.hasUserPermission(req.userId!, "canAdminSystem");
  if (!hasAccess) {
    res.status(403).json({ error: "Sua patente militar não possui permissão para editar categorias de documentos." });
    return;
  }

  try {
    const list = dbOperations.editDocumentCategory(req.params.category, newCategory);
    res.json(list);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/document-categories/:category", authenticateToken, (req: AuthRequest, res: Response) => {
  const category = req.params.category;
  
  const hasAccess = req.userRank === MilitaryRank.ADMSUPREMO || dbOperations.hasUserPermission(req.userId!, "canManageCategories") || dbOperations.hasUserPermission(req.userId!, "canManageDocs") || dbOperations.hasUserPermission(req.userId!, "canAdminSystem");
  if (!hasAccess) {
    res.status(403).json({ error: "Sua patente militar não possui permissão para gerenciar categorias de documentos." });
    return;
  }

  try {
    const list = dbOperations.deleteDocumentCategory(category);
    res.json(list);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- INSTRUCTOR & AMAN CATEGORIES ENDPOINTS ---
app.get("/api/instructor-categories", authenticateToken, (req: AuthRequest, res: Response) => {
  res.json(dbOperations.getInstructorCategoriesWithRanks());
});

app.post("/api/instructor-categories", authenticateToken, (req: AuthRequest, res: Response) => {
  const { category, minRank } = req.body;
  if (!category) {
    res.status(400).json({ error: "O nome da categoria é obrigatório." });
    return;
  }
  
  // Supremo, canManageCategories or canManageDocs
  const hasAccess = req.userRank === MilitaryRank.ADMSUPREMO || dbOperations.hasUserPermission(req.userId!, "canManageCategories") || dbOperations.hasUserPermission(req.userId!, "canManageDocs") || dbOperations.hasUserPermission(req.userId!, "canAdminSystem");
  if (!hasAccess) {
    res.status(403).json({ error: "Sua patente militar não possui permissão para gerenciar categorias." });
    return;
  }

  try {
    const list = dbOperations.addInstructorCategory(category, minRank);
    res.status(201).json(list);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/instructor-categories/:category", authenticateToken, (req: AuthRequest, res: Response) => {
  const { category } = req.params;
  const hasAccess = req.userRank === MilitaryRank.ADMSUPREMO || dbOperations.hasUserPermission(req.userId!, "canManageCategories") || dbOperations.hasUserPermission(req.userId!, "canManageDocs") || dbOperations.hasUserPermission(req.userId!, "canAdminSystem");
  if (!hasAccess) {
    res.status(403).json({ error: "Sua patente militar não possui permissão para gerenciar categorias." });
    return;
  }

  try {
    const list = dbOperations.deleteInstructorCategory(category);
    res.json(list);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/aman-categories", authenticateToken, (req: AuthRequest, res: Response) => {
  res.json(dbOperations.getAmanCategoriesWithRanks());
});

app.post("/api/aman-categories", authenticateToken, (req: AuthRequest, res: Response) => {
  const { category, minRank } = req.body;
  if (!category) {
    res.status(400).json({ error: "O nome da categoria é obrigatório." });
    return;
  }
  
  const hasAccess = req.userRank === MilitaryRank.ADMSUPREMO || dbOperations.hasUserPermission(req.userId!, "canManageCategories") || dbOperations.hasUserPermission(req.userId!, "canManageDocs") || dbOperations.hasUserPermission(req.userId!, "canAdminSystem");
  if (!hasAccess) {
    res.status(403).json({ error: "Sua patente militar não possui permissão para gerenciar categorias." });
    return;
  }

  try {
    const list = dbOperations.addAmanCategory(category, minRank);
    res.status(201).json(list);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/aman-categories/:category", authenticateToken, (req: AuthRequest, res: Response) => {
  const { category } = req.params;
  const hasAccess = req.userRank === MilitaryRank.ADMSUPREMO || dbOperations.hasUserPermission(req.userId!, "canManageCategories") || dbOperations.hasUserPermission(req.userId!, "canManageDocs") || dbOperations.hasUserPermission(req.userId!, "canAdminSystem");
  if (!hasAccess) {
    res.status(403).json({ error: "Sua patente militar não possui permissão para gerenciar categorias." });
    return;
  }

  try {
    const list = dbOperations.deleteAmanCategory(category);
    res.json(list);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/esao-categories", authenticateToken, (req: AuthRequest, res: Response) => {
  res.json(dbOperations.getEsaoCategoriesWithRanks());
});

app.post("/api/esao-categories", authenticateToken, (req: AuthRequest, res: Response) => {
  const { category, minRank } = req.body;
  if (!category) {
    res.status(400).json({ error: "O nome da categoria é obrigatório." });
    return;
  }
  
  const hasAccess = req.userRank === MilitaryRank.ADMSUPREMO || dbOperations.hasUserPermission(req.userId!, "canManageCategories") || dbOperations.hasUserPermission(req.userId!, "canManageDocs") || dbOperations.hasUserPermission(req.userId!, "canAdminSystem");
  if (!hasAccess) {
    res.status(403).json({ error: "Sua patente militar não possui permissão para gerenciar categorias." });
    return;
  }

  try {
    const list = dbOperations.addEsaoCategory(category, minRank);
    res.status(201).json(list);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/esao-categories/:category", authenticateToken, (req: AuthRequest, res: Response) => {
  const { category } = req.params;
  const hasAccess = req.userRank === MilitaryRank.ADMSUPREMO || dbOperations.hasUserPermission(req.userId!, "canManageCategories") || dbOperations.hasUserPermission(req.userId!, "canManageDocs") || dbOperations.hasUserPermission(req.userId!, "canAdminSystem");
  if (!hasAccess) {
    res.status(403).json({ error: "Sua patente militar não possui permissão para gerenciar categorias." });
    return;
  }

  try {
    const list = dbOperations.deleteEsaoCategory(category);
    res.json(list);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- SUB-CARGOS (SUB-ROLES) ENDPOINTS ---
app.get("/api/sub-cargos", authenticateToken, (req: AuthRequest, res: Response) => {
  res.json(dbOperations.getSubCargos());
});

app.post("/api/sub-cargos", authenticateToken, (req: AuthRequest, res: Response) => {
  const { id, label, description, minRank, permissions } = req.body;
  if (!id || !label) {
    res.status(400).json({ error: "O ID e o nome do subcargo são obrigatórios." });
    return;
  }

  const hasAccess = req.userRank === MilitaryRank.ADMSUPREMO || dbOperations.hasPermission(req.userRank!, "canAdminSystem");
  if (!hasAccess) {
    res.status(403).json({ error: "Apenas administradores supremos ou coordenadores de sistema podem gerenciar subcargos." });
    return;
  }

  try {
    const list = dbOperations.createSubCargo(id, label, description || "", minRank, permissions);
    dbOperations.addLog(req.userId!, req.userNick!, "CRIAR_SUBCARGO", `Criou o subcargo militar '${label}' [${id}] no sistema.`);
    res.status(201).json(list);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put("/api/sub-cargos/:id", authenticateToken, (req: AuthRequest, res: Response) => {
  const { label, description, minRank, permissions } = req.body;
  if (!label) {
    res.status(400).json({ error: "O nome do subcargo é obrigatório." });
    return;
  }

  const hasAccess = req.userRank === MilitaryRank.ADMSUPREMO || dbOperations.hasPermission(req.userRank!, "canAdminSystem");
  if (!hasAccess) {
    res.status(403).json({ error: "Apenas administradores supremos ou coordenadores de sistema podem gerenciar subcargos." });
    return;
  }

  try {
    const list = dbOperations.editSubCargo(req.params.id, label, description || "", minRank, permissions);
    dbOperations.addLog(req.userId!, req.userNick!, "EDITAR_SUBCARGO", `Editou dados do subcargo militar '${label}' [${req.params.id}] no sistema.`);
    res.json(list);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/sub-cargos/:id", authenticateToken, (req: AuthRequest, res: Response) => {
  const hasAccess = req.userRank === MilitaryRank.ADMSUPREMO || dbOperations.hasPermission(req.userRank!, "canAdminSystem");
  if (!hasAccess) {
    res.status(403).json({ error: "Apenas administradores supremos ou coordenadores de sistema podem gerenciar subcargos." });
    return;
  }

  try {
    const list = dbOperations.deleteSubCargo(req.params.id);
    dbOperations.addLog(req.userId!, req.userNick!, "DELETAR_SUBCARGO", `Excluiu permanentemente o subcargo militar [${req.params.id}] do sistema.`);
    res.json(list);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/users/:userId/sub-cargos", authenticateToken, (req: AuthRequest, res: Response) => {
  const { subCargoId } = req.body;
  if (!subCargoId) {
    res.status(400).json({ error: "O ID do subcargo é obrigatório para atribuição." });
    return;
  }

  const hasAccess = req.userRank === MilitaryRank.ADMSUPREMO || dbOperations.hasPermission(req.userRank!, "canAdminSystem") || dbOperations.hasPermission(req.userRank!, "canPromote");
  if (!hasAccess) {
    res.status(403).json({ error: "Sua patente militar não possui permissão para atribuir subcargos." });
    return;
  }

  try {
    const updatedUser = dbOperations.assignSubCargoToUser(req.params.userId, subCargoId);
    dbOperations.addLog(req.userId!, req.userNick!, "ATRIBUIR_SUBCARGO", `Atribuiu o subcargo [${subCargoId}] ao militar @${updatedUser.habboNick}.`);
    try {
      const allScs = dbOperations.getSubCargos();
      const scObj = allScs.find(x => x.id === subCargoId);
      const scName = scObj ? scObj.label : subCargoId;
      dbOperations.createNotification(req.params.userId, "Subcargo Militar Atribuído!", `Você recebeu o subcargo militar "${scName}" por @${req.userNick}.`);
    } catch (notifErr) {
      console.error("Erro ao notificar atribuição de subcargo:", notifErr);
    }
    res.json(updatedUser);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/users/:userId/sub-cargos/:subCargoId", authenticateToken, (req: AuthRequest, res: Response) => {
  const hasAccess = req.userRank === MilitaryRank.ADMSUPREMO || dbOperations.hasPermission(req.userRank!, "canAdminSystem") || dbOperations.hasPermission(req.userRank!, "canPromote");
  if (!hasAccess) {
    res.status(403).json({ error: "Sua patente militar não possui permissão para remover subcargos." });
    return;
  }

  try {
    const updatedUser = dbOperations.removeSubCargoFromUser(req.params.userId, req.params.subCargoId);
    dbOperations.addLog(req.userId!, req.userNick!, "REMOVER_SUBCARGO", `Removeu o subcargo [${req.params.subCargoId}] do militar @${updatedUser.habboNick}.`);
    try {
      const allScs = dbOperations.getSubCargos();
      const scObj = allScs.find(x => x.id === req.params.subCargoId);
      const scName = scObj ? scObj.label : req.params.subCargoId;
      dbOperations.createNotification(req.params.userId, "Subcargo Militar Exonerado!", `O subcargo militar "${scName}" foi removido do seu perfil por @${req.userNick}.`);
    } catch (notifErr) {
      console.error("Erro ao notificar remoção de subcargo:", notifErr);
    }
    res.json(updatedUser);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- SYNC HABBO PROFILE ---
app.post("/api/users/:id/sync", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const updatedUser = await dbOperations.syncHabboProfile(req.params.id);
    res.json(updatedUser);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Erro de sincronização." });
  }
});


// --- DOCUMENTOS & SCRIPTS AULAS ---
app.get("/api/documents", authenticateToken, (req: AuthRequest, res: Response) => {
  res.json(dbOperations.getDocuments());
});

app.post("/api/documents", authenticateToken, (req: AuthRequest, res: Response) => {
  const { title, category, content, attachmentUrl, section, allowedRanks, allowedSubCargos, instructorTag } = req.body;
  if (!title || !category || !content) {
    res.status(400).json({ error: "Título, categoria e o conteúdo de texto são de preenchimento obrigatório." });
    return;
  }
  try {
    const doc = dbOperations.createDocument(
      req.userId!, 
      title, 
      category, 
      content, 
      attachmentUrl,
      section,
      allowedRanks,
      allowedSubCargos,
      instructorTag
    );
    res.status(201).json(doc);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.put("/api/documents/:id", authenticateToken, (req: AuthRequest, res: Response) => {
  const { title, category, content, attachmentUrl, section, allowedRanks, allowedSubCargos, instructorTag } = req.body;
  if (!title || !category || !content) {
    res.status(400).json({ error: "Título, categoria e o conteúdo de texto são obrigatórios." });
    return;
  }
  try {
    const updated = dbOperations.updateDocument(
      req.userId!, 
      req.params.id, 
      title, 
      category, 
      content, 
      attachmentUrl,
      section,
      allowedRanks,
      allowedSubCargos,
      instructorTag
    );
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/documents/:id", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    dbOperations.deleteDocument(req.userId!, req.params.id);
    res.json({ message: "Material de aula excluído com sucesso do QG FMB." });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// --- TRAININGS EXTRA EDIT/DELETE ---
app.put("/api/trainings/:id", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const tr = dbOperations.updateTraining(req.userId!, req.params.id, req.body);
    res.json(tr);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/trainings/:id", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    dbOperations.deleteTraining(req.userId!, req.params.id);
    res.json({ message: "Ata de treinamento excluída com sucesso pelo comando." });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// --- HALL OF FAME DIRECTIVE ---

app.get("/api/destaques", (req: Request, res: Response) => {
  res.json(dbOperations.getDestaques());
});

app.put("/api/destaques", authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.userRank !== MilitaryRank.ADMSUPREMO) {
    res.status(403).json({ error: "Configuração restrita ao Administrador Supremo." });
    return;
  }
  const { militaryOfTheMonth, instructorOfTheMonth, destaqueOperacional } = req.body;
  try {
    dbOperations.updateDestaques(req.userId!, {
      militaryOfTheMonth: militaryOfTheMonth || null,
      instructorOfTheMonth: instructorOfTheMonth || null,
      destaqueOperacional: destaqueOperacional || null
    });
    res.json({ message: "Quadro de Destaques e Medalhas do Hall da Fama atualizados!" });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// --- GENERAL AUDIT LOGS ---
app.get("/api/logs", authenticateToken, (req: AuthRequest, res: Response) => {
  const isSupremo = req.userRank === MilitaryRank.ADMSUPREMO;
  const hasAdminPermission = req.userRank && dbOperations.hasPermission(req.userRank, "canAdminSystem");

  const user = req.userId ? dbOperations.getUserById(req.userId) : null;
  const userSubCargos = user?.subCargos || [];

  const perms = dbOperations.getCustomPermissions();
  const cdmAllowed = perms.cdmViewAllowed || [];

  const isCdmAllowedByConfig = cdmAllowed.length > 0 && (
    (req.userRank && cdmAllowed.includes(req.userRank)) ||
    userSubCargos.some(sc => cdmAllowed.includes(sc))
  );

  const isAuthorized = isSupremo || hasAdminPermission || isCdmAllowedByConfig;

  if (!isAuthorized) {
    res.status(403).json({ error: "Sua patente militar não confere autorização tática para auditar as caixas de logs secretos do CDM." });
    return;
  }
  res.json(dbOperations.getLogs());
});


// --- CUSTOM TAB PERMISSIONS ---
app.get("/api/custom-permissions", authenticateToken, (req: AuthRequest, res: Response) => {
  res.json(dbOperations.getCustomPermissions());
});

app.post("/api/custom-permissions", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { instrutoresViewAllowed, amanViewAllowed, cdmViewAllowed } = req.body;
    const updated = dbOperations.updateCustomPermissions(
      req.userId!,
      instrutoresViewAllowed,
      amanViewAllowed,
      cdmViewAllowed
    );
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// --- HABBO API ACCESS PROXY ---
app.get("/api/habbo/:nick", async (req: Request, res: Response) => {
  const result = await fetchHabboData(req.params.nick);
  if (result) {
    res.json(result);
  } else {
    res.status(404).json({ error: "Avatar Habbo não foi localizado na rede oficial." });
  }
});

// HABBO EMBEDDED CONSTANTS FOR RANKING OF INSTRUCTORS
app.get("/api/dashboard/rankings", authenticateToken, (req: AuthRequest, res: Response) => {
  const users = dbOperations.getUsers();
  // Sort by trainingCount
  const sortedInstructors = [...users]
    .filter(u => u.trainingsCreated > 0)
    .sort((a, b) => b.trainingsCreated - a.trainingsCreated)
    .slice(0, 5);

  // Sort by hours
  const sortedServiceHours = [...users]
    .filter(u => u.totalServiceSeconds > 0)
    .sort((a, b) => b.totalServiceSeconds - a.totalServiceSeconds)
    .slice(0, 5);

  // Sort by promotions
  const sortedPromotions = [...users]
    .filter(u => u.promotionsGiven > 0)
    .sort((a, b) => b.promotionsGiven - a.promotionsGiven)
    .slice(0, 5);

  res.json({
    topInstructors: sortedInstructors,
    topService: sortedServiceHours,
    topPromoters: sortedPromotions
  });
});

// --- NEWS (NOTICIAS) ENDPOINTS ---
app.get("/api/public/news", (req: Request, res: Response) => {
  try {
    const news = dbOperations.getNews();
    res.json(news);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/public/hierarchy", (req: Request, res: Response) => {
  try {
    res.json(dbOperations.getRankConfigs());
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/news", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: "Não autorizado." });
      return;
    }
    const user = dbOperations.getUserById(req.userId);
    if (!user) {
      res.status(404).json({ error: "Militar não encontrado." });
      return;
    }

    const isSupremo = user.role === MilitaryRank.ADMSUPREMO;
    const allSubCargos = dbOperations.getSubCargos();
    const userSubCargoIds = user.subCargos || [];
    const hasJournalistSubCargo = userSubCargoIds.some(scId => {
      if (scId.toLowerCase().includes("jornal")) return true;
      const subInfo = allSubCargos.find(x => x.id === scId);
      if (subInfo && subInfo.label.toLowerCase().includes("jornal")) return true;
      return false;
    });

    if (!isSupremo && !hasJournalistSubCargo) {
      res.status(403).json({ error: "Acesso negado. Somente militares com sub-cargo de Jornalista ou Administrador Supremo podem postar notícias." });
      return;
    }

    const { title, content, imageUrl } = req.body;
    if (!title || !content) {
      res.status(400).json({ error: "O título e o conteúdo são de preenchimento obrigatório." });
      return;
    }

    const newPost = dbOperations.createNews(user.id, user.habboNick, title, content, imageUrl);
    dbOperations.addLog(user.id, user.habboNick, "POST_NOTICIA", `Publicou uma nova notícia militar oficial: "${title}"`);
    res.status(201).json(newPost);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/news/:id", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: "Não autorizado." });
      return;
    }
    const user = dbOperations.getUserById(req.userId);
    if (!user) {
      res.status(404).json({ error: "Militar não encontrado." });
      return;
    }

    const newsList = dbOperations.getNews();
    const post = newsList.find(n => n.id === req.params.id);
    if (!post) {
      res.status(404).json({ error: "Notícia não encontrada." });
      return;
    }

    const isSupremo = user.role === MilitaryRank.ADMSUPREMO;
    const isAuthor = post.authorNick.toLowerCase() === user.habboNick.toLowerCase();
    const allSubCargos = dbOperations.getSubCargos();
    const userSubCargoIds = user.subCargos || [];
    const hasJournalistSubCargo = userSubCargoIds.some(scId => {
      if (scId.toLowerCase().includes("jornal")) return true;
      const subInfo = allSubCargos.find(x => x.id === scId);
      if (subInfo && subInfo.label.toLowerCase().includes("jornal")) return true;
      return false;
    });

    if (!isSupremo && !isAuthor && !hasJournalistSubCargo) {
      res.status(403).json({ error: "Acesso negado. Apenas o autor, Jornalistas ou Administrador Supremo podem excluir esta notícia." });
      return;
    }

    dbOperations.deleteNews(req.params.id);
    dbOperations.addLog(user.id, user.habboNick, "DELETE_NOTICIA", `Excluiu a notícia militar oficial: "${post.title}"`);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// --- VITE WEB APP ROUTING MIDDLEWARE ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[FMB BANNER] COMANDO ATIVO NA PORTA ${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
