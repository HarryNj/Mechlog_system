import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as dotenv from "dotenv";
import crypto from "crypto";
import http from "http";
import { Server } from "socket.io";

// Load environment variables
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'eff-fleet-maintenance-system-secret-2026';

function hashPassword(password: string) {
  return crypto.createHmac("sha256", JWT_SECRET).update(password).digest("hex");
}

function generateCustomToken(user: { uid: string; email: string; role: string; name?: string | null; phoneNumber?: string | null }) {
  const payload = {
    uid: user.uid,
    email: user.email,
    role: user.role,
    name: user.name || "",
    phoneNumber: user.phoneNumber || "",
    expires: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64");
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(payloadStr).digest("hex");
  return `${payloadStr}.${signature}`;
}

import { db } from "./src/db/index.ts";
import { users, bikes, sparesInventory, serviceLogs, serviceLogSpares, serviceRequests } from "./src/db/schema.ts";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth, AuthRequest } from "./src/middleware/auth.ts";
import { getOrCreateUser } from "./src/db/users.ts";
import { 
  getAllUsers, getUserByUid, getUserByEmail, getUserByPhone, createUser, updateUser, updateUserById, deleteUser,
  getAllBikes, getBikeByReg, getBikeById, createBike, updateBike, deleteBike,
  getAllSpares, getSpareByName, getSpareById, createSpare, updateSpare, deleteSpare,
  getAllLogs, getLogById, createLog, updateLog, deleteLog,
  getAllRequests, createRequest, updateRequest, deleteRequest,
  useFirestore, setUseFirestore
} from "./src/db/adapters.ts";



// Automatic self-healing database schema verification
async function ensureDatabaseSchema() {
  if (useFirestore) {
    console.log("Using serverless Firebase Firestore fallback storage. Skipping PostgreSQL self-healing migrations.");
    return;
  }
  console.log("Starting automatic self-healing database schema check...");
  try {
    // 1. Create tables if they do not exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        uid TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT,
        name TEXT NOT NULL,
        phone_number TEXT,
        role TEXT DEFAULT 'user' NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS bikes (
        id SERIAL PRIMARY KEY,
        reg_no TEXT NOT NULL UNIQUE,
        province TEXT NOT NULL,
        district TEXT NOT NULL,
        model TEXT NOT NULL,
        officer TEXT NOT NULL,
        date_added TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS spares_inventory (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        quantity INTEGER NOT NULL,
        date_added TEXT NOT NULL,
        added_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS service_logs (
        id SERIAL PRIMARY KEY,
        bike_id INTEGER NOT NULL REFERENCES bikes(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        next_service_date TEXT,
        next_service_mileage INTEGER,
        mileage INTEGER NOT NULL,
        officer TEXT NOT NULL,
        province TEXT NOT NULL,
        district TEXT NOT NULL,
        work_done TEXT,
        work_pending TEXT,
        status TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS service_log_spares (
        id SERIAL PRIMARY KEY,
        service_log_id INTEGER NOT NULL REFERENCES service_logs(id) ON DELETE CASCADE,
        spare_id INTEGER REFERENCES spares_inventory(id) ON DELETE SET NULL,
        spare_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS service_requests (
        id SERIAL PRIMARY KEY,
        bike_id INTEGER NOT NULL REFERENCES bikes(id) ON DELETE CASCADE,
        bike_reg TEXT NOT NULL,
        officer_uid TEXT REFERENCES users(uid) ON DELETE SET NULL,
        requested_by TEXT NOT NULL,
        service_type TEXT NOT NULL,
        problem_description TEXT NOT NULL,
        status TEXT DEFAULT 'pending' NOT NULL,
        date_requested TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Self-heal/Migrate missing columns on existing tables
    const columnsCheck = [
      { table: "users", column: "email", type: "TEXT NOT NULL UNIQUE" },
      { table: "users", column: "name", type: "TEXT NOT NULL DEFAULT 'User'" },
      { table: "users", column: "password_hash", type: "TEXT" },
      { table: "users", column: "phone_number", type: "TEXT" },
      { table: "users", column: "role", type: "TEXT DEFAULT 'user' NOT NULL" },
      { table: "users", column: "created_at", type: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP" },
      { table: "bikes", column: "date_added", type: "TEXT NOT NULL DEFAULT ''" },
      { table: "bikes", column: "created_at", type: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP" },
      { table: "spares_inventory", column: "date_added", type: "TEXT NOT NULL DEFAULT ''" },
      { table: "spares_inventory", column: "added_by", type: "TEXT NOT NULL DEFAULT 'admin'" },
      { table: "spares_inventory", column: "created_at", type: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP" },
      { table: "service_logs", column: "next_service_date", type: "TEXT" },
      { table: "service_logs", column: "next_service_mileage", type: "INTEGER" },
      { table: "service_logs", column: "work_done", type: "TEXT" },
      { table: "service_logs", column: "work_pending", type: "TEXT" },
      { table: "service_logs", column: "created_at", type: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP" },
      { table: "service_requests", column: "bike_reg", type: "TEXT NOT NULL DEFAULT 'Unknown'" },
      { table: "service_requests", column: "status", type: "TEXT DEFAULT 'pending' NOT NULL" },
      { table: "service_requests", column: "date_requested", type: "TEXT NOT NULL DEFAULT ''" },
      { table: "service_requests", column: "officer_uid", type: "TEXT" },
      { table: "service_requests", column: "created_at", type: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP" }
    ];

    for (const check of columnsCheck) {
      const res = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = ${check.table} AND column_name = ${check.column};
      `);
      if (res.rows.length === 0) {
        console.log(`Self-healing: Adding column '${check.column}' to table '${check.table}'...`);
        try {
          await db.execute(sql.raw(`ALTER TABLE ${check.table} ADD COLUMN ${check.column} ${check.type};`));
          console.log(`Self-healing: Column '${check.column}' added successfully.`);
        } catch (alterErr: any) {
          console.error(`Failed to add column '${check.column}':`, alterErr.message);
        }
      }
    }

    console.log("Database schema check completed. Self-healing active & database is ready!");
  } catch (err: any) {
    console.error("Critical error in database self-healing schema setup:", err);
    console.warn("[Database Recovery] SQL migration failed, falling back to Firebase Firestore.");
    setUseFirestore(true);
  }
}

async function startServer() {
  await ensureDatabaseSchema();
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: "*" }
  });

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);
  });

  // Make io accessible in routes
  app.set("io", io);

  app.use(express.json());

  // --- CORS MIDDLEWARE (To support hosting frontend on Cloudflare Pages / external domains) ---
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // --- API ROUTES ---

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", useFirestore });
  });

  // Custom Registration Route (using relational PostgreSQL storage)
  app.post("/api/auth/custom-register", async (req, res) => {
    try {
      const { email, password, name, phoneNumber } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const lowerEmail = email.trim().toLowerCase();
      
      // Check if user already exists
      const existing = await getUserByEmail(lowerEmail);
      if (existing) {
        return res.status(400).json({ error: "An account with this email already exists" });
      }

      // Hash password
      const passwordHash = hashPassword(password);
      const uid = "cust_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
      
      // Determine role
      const allUsers = await getAllUsers();
      const isFirstUser = allUsers.length === 0;
      const isAdminEmail = lowerEmail === "harrisonnjobvu@gmail.com" || lowerEmail === "harrisonnjobvu@gamil.com" || lowerEmail === "admin@effzambia.org";
      const role = (isFirstUser || isAdminEmail) ? "admin" : "user";

      const newUser = await createUser({
        uid,
        email: lowerEmail,
        passwordHash,
        name: name || null,
        phoneNumber: phoneNumber || null,
        role
      });

      const token = generateCustomToken(newUser);
      res.json({ status: "success", user: newUser, token });
    } catch (error: any) {
      console.error("Custom registration error:", error);
      res.status(500).json({ error: "Failed to register user", details: error.message });
    }
  });

  app.post("/api/auth/feo-login", async (req, res) => {
    try {
      const { name, phoneNumber } = req.body;
      if (!name || !phoneNumber) {
        return res.status(400).json({ error: "Name and phone number are required" });
      }

      // Check if user already exists
      const existing = await getUserByPhone(phoneNumber);
      
      let user;
      if (existing) {
        // update name just in case
        user = await updateUser(existing.uid, { name });
      } else {
        const uid = "feo_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
        const email = `feo_${phoneNumber.replace(/\D/g, '')}@eff.zambia`;
        user = await createUser({
          uid,
          email,
          name,
          phoneNumber,
          role: "user"
        });
      }

      const token = generateCustomToken(user);
      res.json({ status: "success", user, token });
    } catch (error: any) {
      console.error("FEO login error:", error);
      res.status(500).json({ error: "Failed to login as FEO", details: error.message });
    }
  });

  // Custom Login Route (using relational PostgreSQL storage)
  app.post("/api/auth/custom-login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const lowerEmail = email.trim().toLowerCase();
      const user = await getUserByEmail(lowerEmail);
      
      if (!user) {
        return res.status(400).json({ error: "Invalid email or password" });
      }

      const passwordHash = hashPassword(password);

      // If passwordHash matches, log in
      if (user.passwordHash && user.passwordHash === passwordHash) {
        const token = generateCustomToken(user);
        return res.json({ status: "success", user, token });
      }
      
      // First-time password initialization for pre-registered users or empty passwords
      if (!user.passwordHash) {
        const updatedUser = await updateUser(user.uid, { passwordHash });
        
        const token = generateCustomToken(updatedUser);
        return res.json({ status: "success", user: updatedUser, token, message: "Welcome! Since this is your first sign-in, your password has been set." });
      }

      return res.status(400).json({ error: "Invalid email or password" });
    } catch (error: any) {
      console.error("Custom login error:", error);
      res.status(500).json({ error: "Failed to login", details: error.message });
    }
  });

  // Sync user profile with PostgreSQL on Sign-In
  app.post("/api/auth/sync", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { uid, email, name, phone_number } = req.user!;
      const clientPhone = req.body?.phoneNumber || req.body?.phone;
      const clientName = req.body?.name;
      const user = await getOrCreateUser(
        uid, 
        email || req.body?.email || "", 
        name || clientName || undefined, 
        phone_number || clientPhone || undefined
      );
      res.json({ status: "success", user });
    } catch (error: any) {
      console.error("Error syncing user:", error);
      res.status(500).json({ error: "Failed to sync user", details: error.message });
    }
  });

  // BIKE REGISTRY ROUTES
  app.get("/api/bikes", requireAuth, async (req, res) => {
    try {
      const allBikes = await getAllBikes();
      res.json(allBikes);
    } catch (error: any) {
      console.error("Error fetching bikes:", error);
      res.status(500).json({ error: "Failed to fetch bikes", details: error.message });
    }
  });

  app.post("/api/bikes", requireAuth, async (req, res) => {
    try {
      const { regNo, province, district, model, officer, dateAdded } = req.body;
      if (!regNo || !province || !district || !model || !officer || !dateAdded) {
        return res.status(400).json({ error: "Missing required bike fields" });
      }

      const formattedRegNo = regNo.trim().toUpperCase();

      // Check for existing regNo
      const existing = await getBikeByReg(formattedRegNo);
      if (existing) {
        return res.status(400).json({ error: "A bike with this registration number already exists" });
      }

      const newBike = await createBike({
        regNo: formattedRegNo,
        province,
        district,
        model,
        officer,
        dateAdded,
      });

      req.app.get("io").emit("data:updated", { type: "bikes" });
      res.json({ status: "success", bike: newBike });
    } catch (error: any) {
      console.error("Error creating bike:", error);
      res.status(500).json({ error: "Failed to create bike", details: error.message });
    }
  });

  app.put("/api/bikes/:id", requireAuth, async (req, res) => {
    try {
      const bikeId = parseInt(req.params.id);
      const { regNo, province, district, model, officer, dateAdded } = req.body;

      const formattedRegNo = regNo?.trim().toUpperCase();

      if (formattedRegNo) {
        // Check unique constraint excluding this bike
        const existing = await getBikeByReg(formattedRegNo);
        if (existing && existing.id !== bikeId) {
          return res.status(400).json({ error: "A bike with this registration number already exists" });
        }
      }

      const updatedBike = await updateBike(bikeId, {
        regNo: formattedRegNo,
        province,
        district,
        model,
        officer,
        dateAdded,
      });

      req.app.get("io").emit("data:updated", { type: "bikes" });
      res.json({ status: "success", bike: updatedBike });
    } catch (error: any) {
      console.error("Error updating bike:", error);
      res.status(500).json({ error: "Failed to update bike", details: error.message });
    }
  });

  app.delete("/api/bikes/:id", requireAuth, async (req, res) => {
    try {
      const bikeId = parseInt(req.params.id);
      await deleteBike(bikeId);
      req.app.get("io").emit("data:updated", { type: "bikes" });
      res.json({ status: "success", message: "Bike deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting bike:", error);
      res.status(500).json({ error: "Failed to delete bike", details: error.message });
    }
  });


  // SPARES INVENTORY ROUTES
  app.get("/api/spares", requireAuth, async (req, res) => {
    try {
      const allSpares = await getAllSpares();
      res.json(allSpares);
    } catch (error: any) {
      console.error("Error fetching spares:", error);
      res.status(500).json({ error: "Failed to fetch spares", details: error.message });
    }
  });

  app.post("/api/spares", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { name, quantity, dateAdded } = req.body;
      const addedBy = req.user?.name || req.user?.email || "Admin";

      if (!name || quantity === undefined || !dateAdded) {
        return res.status(400).json({ error: "Missing required spare fields (name, quantity, dateAdded)" });
      }

      const formattedName = name.trim();

      // Check unique constraint
      const existing = await getSpareByName(formattedName);
      if (existing) {
        return res.status(400).json({ error: "A spare part with this name already exists in inventory" });
      }

      const newSpare = await createSpare({
        name: formattedName,
        quantity: parseInt(quantity),
        dateAdded,
        addedBy,
      });

      req.app.get("io").emit("data:updated", { type: "spares" });
      res.json({ status: "success", spare: newSpare });
    } catch (error: any) {
      console.error("Error creating spare:", error);
      res.status(500).json({ error: "Failed to create spare", details: error.message });
    }
  });

  app.put("/api/spares/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const spareId = parseInt(req.params.id);
      const { name, quantity, dateAdded } = req.body;
      const addedBy = req.user?.name || req.user?.email || "Admin";

      const formattedName = name?.trim();

      if (formattedName) {
        const existing = await getSpareByName(formattedName);
        if (existing && existing.id !== spareId) {
          return res.status(400).json({ error: "A spare part with this name already exists in inventory" });
        }
      }

      const updatedSpare = await updateSpare(spareId, {
        name: formattedName,
        quantity: quantity !== undefined ? parseInt(quantity) : undefined,
        dateAdded,
        addedBy,
      });

      req.app.get("io").emit("data:updated", { type: "spares" });
      res.json({ status: "success", spare: updatedSpare });
    } catch (error: any) {
      console.error("Error updating spare:", error);
      res.status(500).json({ error: "Failed to update spare", details: error.message });
    }
  });

  app.delete("/api/spares/:id", requireAuth, async (req, res) => {
    try {
      const spareId = parseInt(req.params.id);
      await deleteSpare(spareId);
      req.app.get("io").emit("data:updated", { type: "spares" });
      res.json({ status: "success", message: "Spare deleted from inventory" });
    } catch (error: any) {
      console.error("Error deleting spare:", error);
      res.status(500).json({ error: "Failed to delete spare", details: error.message });
    }
  });


  // SERVICE LOG ROUTES
  app.get("/api/logs", requireAuth, async (req, res) => {
    try {
      const allLogs = await getAllLogs();
      res.json(allLogs);
    } catch (error: any) {
      console.error("Error fetching service logs:", error);
      res.status(500).json({ error: "Failed to fetch service logs", details: error.message });
    }
  });

  app.post("/api/logs", requireAuth, async (req, res) => {
    try {
      const {
        bikeId,
        date,
        nextServiceDate,
        nextServiceMileage,
        mileage,
        officer,
        province,
        district,
        workDone,
        workPending,
        status,
        spares, // Array of { spareId: number, spareName: string, quantity: number }
      } = req.body;

      if (!bikeId || !date || isNaN(mileage) || !officer || !province || !district || !status) {
        return res.status(400).json({ error: "Missing required service log fields" });
      }

      const sparesList = (spares && Array.isArray(spares)) ? spares.map(item => ({
        spareId: parseInt(item.spareId),
        spareName: item.spareName || `Spare ID ${item.spareId}`,
        quantity: parseInt(item.quantity) || 1
      })).filter(item => !isNaN(item.spareId)) : [];

      const result = await createLog({
        bikeId: parseInt(bikeId),
        date,
        nextServiceDate: nextServiceDate || null,
        nextServiceMileage: nextServiceMileage ? parseInt(nextServiceMileage) : null,
        mileage: parseInt(mileage),
        officer,
        province,
        district,
        workDone,
        workPending,
        status,
      }, sparesList);

      req.app.get("io").emit("data:updated", { type: "logs" });
      res.json({ status: "success", log: result });
    } catch (error: any) {
      console.error("Error creating service log:", error);
      res.status(500).json({ error: "Failed to create service log", details: error.message });
    }
  });

  app.put("/api/logs/:id", requireAuth, async (req, res) => {
    try {
      const logId = parseInt(req.params.id);
      const {
        bikeId,
        date,
        nextServiceDate,
        nextServiceMileage,
        mileage,
        officer,
        province,
        district,
        workDone,
        workPending,
        status,
        // Spares updates are handled gracefully by delete/re-creation in raw,
        // but for standard adapter edits, we keep fields update direct or delete-recreate
      } = req.body;

      if (!bikeId || !date || isNaN(mileage) || !officer || !province || !district || !status) {
        return res.status(400).json({ error: "Missing required service log fields" });
      }

      // To update the log and handle spares easily, we can delete the old log and insert a new one,
      // or simply update the metadata of this log using our robust adapter.
      // Let's use updateLog adapter.
      await updateLog(logId, {
        bikeId: parseInt(bikeId),
        date,
        nextServiceDate: nextServiceDate || null,
        nextServiceMileage: nextServiceMileage ? parseInt(nextServiceMileage) : null,
        mileage: parseInt(mileage),
        officer,
        province,
        district,
        workDone,
        workPending,
        status,
      });

      req.app.get("io").emit("data:updated", { type: "logs" });
      res.json({ status: "success", message: "Service log updated successfully" });
    } catch (error: any) {
      console.error("Error updating service log:", error);
      res.status(500).json({ error: "Failed to update service log", details: error.message });
    }
  });

  app.delete("/api/logs/:id", requireAuth, async (req, res) => {
    try {
      const logId = parseInt(req.params.id);
      await deleteLog(logId);
      req.app.get("io").emit("data:updated", { type: "logs" });
      res.json({ status: "success", message: "Service log deleted and spares returned to inventory" });
    } catch (error: any) {
      console.error("Error deleting service log:", error);
      res.status(500).json({ error: "Failed to delete service log", details: error.message });
    }
  });

  // --- USER MANAGEMENT API ROUTES ---
  app.get("/api/users", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.uid) return res.status(401).json({ error: "Unauthorized" });
      const dbUser = await getUserByUid(req.user.uid);
      if (!dbUser || dbUser.role !== "admin") {
        return res.status(403).json({ error: "Forbidden: Admins only" });
      }
      const allUsers = await getAllUsers();
      res.json(allUsers);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users", details: error.message });
    }
  });

  app.post("/api/users", requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getUserByUid(req.user!.uid);
      if (!dbUser || dbUser.role !== "admin") {
        return res.status(403).json({ error: "Forbidden: Admins only" });
      }
      const { email, name, role, phoneNumber } = req.body;
      if (!email || !role) {
        return res.status(400).json({ error: "Email and Role are required" });
      }
      const lowerEmail = email.trim().toLowerCase();
      // Check if user already exists
      const existing = await getUserByEmail(lowerEmail);
      if (existing) {
        return res.status(400).json({ error: "A user with this email already exists" });
      }

      // Generate a unique dummy/pending UID so we satisfy unique constraints
      const dummyUid = "pending_auth_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);

      const newUser = await createUser({
        uid: dummyUid,
        email: lowerEmail,
        name: name || null,
        phoneNumber: phoneNumber || null,
        role: role || "user"
      });

      res.json({ status: "success", user: newUser });
    } catch (error: any) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Failed to create user", details: error.message });
    }
  });

  app.put("/api/users/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getUserByUid(req.user!.uid);
      if (!dbUser || dbUser.role !== "admin") {
        return res.status(403).json({ error: "Forbidden: Admins only" });
      }
      const userId = parseInt(req.params.id);
      const { name, role, email, phoneNumber } = req.body;
      
      const lowerEmail = email ? email.trim().toLowerCase() : undefined;
      
      const updatedUser = await updateUserById(userId, {
        name,
        role,
        email: lowerEmail,
        phoneNumber: phoneNumber || null
      });

      res.json({ status: "success", user: updatedUser });
    } catch (error: any) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user", details: error.message });
    }
  });

  app.delete("/api/users/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getUserByUid(req.user!.uid);
      if (!dbUser || dbUser.role !== "admin") {
        return res.status(403).json({ error: "Forbidden: Admins only" });
      }
      const userId = parseInt(req.params.id);
      
      if (userId === dbUser.id) {
        return res.status(400).json({ error: "You cannot delete your own admin account" });
      }

      await deleteUser(userId);
      res.json({ status: "success", message: "User deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Failed to delete user", details: error.message });
    }
  });


  // --- SERVICE REQUESTS (MAILBOX) API ROUTES ---
  app.post("/api/requests", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { bikeId, serviceType, problemDescription, dateRequested } = req.body;
      const requestedBy = req.user!.email || "Unknown User";

      if (!bikeId || !serviceType || !problemDescription || !dateRequested) {
        return res.status(400).json({ error: "Missing required service request fields" });
      }

      // Fetch bike registration to store in request
      const bike = await getBikeById(parseInt(bikeId));
      if (!bike) {
        return res.status(404).json({ error: "Bike not found" });
      }

      const newRequest = await createRequest({
        bikeId: parseInt(bikeId),
        bikeReg: bike.regNo,
        requestedBy,
        serviceType,
        problemDescription,
        status: "pending",
        dateRequested
      });

      req.app.get("io").emit("data:updated", { type: "requests" });
      res.json({ status: "success", request: newRequest });
    } catch (error: any) {
      console.error("Error creating service request:", error);
      res.status(500).json({ error: "Failed to create service request", details: error.message });
    }
  });

  app.get("/api/requests", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.uid) return res.status(401).json({ error: "Unauthorized" });
      const dbUser = await getUserByUid(req.user.uid);
      if (!dbUser) {
        return res.status(403).json({ error: "User profile not found in database" });
      }

      const allReqs = await getAllRequests();
      let list;
      if (dbUser.role === "admin") {
        list = allReqs;
      } else {
        list = allReqs.filter((r: any) => r.requestedBy === dbUser.email);
      }
      res.json(list);
    } catch (error: any) {
      console.error("Error fetching service requests:", error);
      res.status(500).json({ error: "Failed to fetch service requests", details: error.message });
    }
  });

  app.put("/api/requests/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const requestId = parseInt(req.params.id);
      const { status } = req.body;
      const dbUser = await getUserByUid(req.user!.uid);
      if (!dbUser || dbUser.role !== "admin") {
        return res.status(403).json({ error: "Forbidden: Admins only" });
      }

      const updatedRequest = await updateRequest(requestId, { status });

      req.app.get("io").emit("data:updated", { type: "requests" });
      res.json({ status: "success", request: updatedRequest });
    } catch (error: any) {
      console.error("Error updating request status:", error);
      res.status(500).json({ error: "Failed to update service request status", details: error.message });
    }
  });

  app.delete("/api/requests/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const requestId = parseInt(req.params.id);
      const dbUser = await getUserByUid(req.user!.uid);
      if (!dbUser) {
        return res.status(403).json({ error: "User profile not found" });
      }

      const allReqs = await getAllRequests();
      const reqObj = allReqs.find((r: any) => r.id === requestId);
      if (!reqObj) {
        return res.status(404).json({ error: "Request not found" });
      }

      if (dbUser.role !== "admin" && reqObj.requestedBy !== dbUser.email) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      await deleteRequest(requestId);
      res.json({ status: "success", message: "Service request deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting service request:", error);
      res.status(500).json({ error: "Failed to delete service request", details: error.message });
    }
  });



  // --- VITE MIDDLEWARE SETUP ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
