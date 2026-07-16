import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

import { db } from "./src/db/index.ts";
import { users, bikes, sparesInventory, serviceLogs, serviceLogSpares, serviceRequests } from "./src/db/schema.ts";
import { eq, desc } from "drizzle-orm";
import { requireAuth, AuthRequest } from "./src/middleware/auth.ts";
import { getOrCreateUser } from "./src/db/users.ts";


async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API ROUTES ---

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Sync user profile with PostgreSQL on Sign-In
  app.post("/api/auth/sync", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { uid, email, name } = req.user!;
      const user = await getOrCreateUser(uid, email || "", name || undefined);
      res.json({ status: "success", user });
    } catch (error: any) {
      console.error("Error syncing user:", error);
      res.status(500).json({ error: "Failed to sync user", details: error.message });
    }
  });

  // BIKE REGISTRY ROUTES
  app.get("/api/bikes", requireAuth, async (req, res) => {
    try {
      const allBikes = await db.select().from(bikes).orderBy(desc(bikes.createdAt));
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
      const existing = await db.select().from(bikes).where(eq(bikes.regNo, formattedRegNo));
      if (existing.length > 0) {
        return res.status(400).json({ error: "A bike with this registration number already exists" });
      }

      const [newBike] = await db.insert(bikes).values({
        regNo: formattedRegNo,
        province,
        district,
        model,
        officer,
        dateAdded,
      }).returning();

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
        const existing = await db.select().from(bikes).where(eq(bikes.regNo, formattedRegNo));
        if (existing.length > 0 && existing[0].id !== bikeId) {
          return res.status(400).json({ error: "A bike with this registration number already exists" });
        }
      }

      const [updatedBike] = await db.update(bikes)
        .set({
          regNo: formattedRegNo,
          province,
          district,
          model,
          officer,
          dateAdded,
        })
        .where(eq(bikes.id, bikeId))
        .returning();

      res.json({ status: "success", bike: updatedBike });
    } catch (error: any) {
      console.error("Error updating bike:", error);
      res.status(500).json({ error: "Failed to update bike", details: error.message });
    }
  });

  app.delete("/api/bikes/:id", requireAuth, async (req, res) => {
    try {
      const bikeId = parseInt(req.params.id);
      await db.delete(bikes).where(eq(bikes.id, bikeId));
      res.json({ status: "success", message: "Bike deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting bike:", error);
      res.status(500).json({ error: "Failed to delete bike", details: error.message });
    }
  });


  // SPARES INVENTORY ROUTES
  app.get("/api/spares", requireAuth, async (req, res) => {
    try {
      const allSpares = await db.select().from(sparesInventory).orderBy(desc(sparesInventory.createdAt));
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
      const existing = await db.select().from(sparesInventory).where(eq(sparesInventory.name, formattedName));
      if (existing.length > 0) {
        return res.status(400).json({ error: "A spare part with this name already exists in inventory" });
      }

      const [newSpare] = await db.insert(sparesInventory).values({
        name: formattedName,
        quantity: parseInt(quantity),
        dateAdded,
        addedBy,
      }).returning();

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
        const existing = await db.select().from(sparesInventory).where(eq(sparesInventory.name, formattedName));
        if (existing.length > 0 && existing[0].id !== spareId) {
          return res.status(400).json({ error: "A spare part with this name already exists in inventory" });
        }
      }

      const [updatedSpare] = await db.update(sparesInventory)
        .set({
          name: formattedName,
          quantity: quantity !== undefined ? parseInt(quantity) : undefined,
          dateAdded,
          addedBy,
        })
        .where(eq(sparesInventory.id, spareId))
        .returning();

      res.json({ status: "success", spare: updatedSpare });
    } catch (error: any) {
      console.error("Error updating spare:", error);
      res.status(500).json({ error: "Failed to update spare", details: error.message });
    }
  });

  app.delete("/api/spares/:id", requireAuth, async (req, res) => {
    try {
      const spareId = parseInt(req.params.id);
      await db.delete(sparesInventory).where(eq(sparesInventory.id, spareId));
      res.json({ status: "success", message: "Spare deleted from inventory" });
    } catch (error: any) {
      console.error("Error deleting spare:", error);
      res.status(500).json({ error: "Failed to delete spare", details: error.message });
    }
  });


  // SERVICE LOG ROUTES
  app.get("/api/logs", requireAuth, async (req, res) => {
    try {
      const allLogs = await db.query.serviceLogs.findMany({
        with: {
          bike: true,
          spares: true,
        },
        orderBy: (serviceLogs, { desc }) => [desc(serviceLogs.date)],
      });
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
        spares, // Array of { spareId: number, quantity: number }
      } = req.body;

      if (!bikeId || !date || isNaN(mileage) || !officer || !province || !district || !status) {
        return res.status(400).json({ error: "Missing required service log fields" });
      }

      // Execute inside SQL transaction
      const result = await db.transaction(async (tx) => {
        // 1. Create the service log
        const [log] = await tx.insert(serviceLogs).values({
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
        }).returning();

        // 2. Adjust inventory and link spares
        if (spares && Array.isArray(spares) && spares.length > 0) {
          for (const item of spares) {
            const qty = parseInt(item.quantity) || 1;
            const spareIdVal = parseInt(item.spareId);

            if (isNaN(spareIdVal)) continue;

            // Fetch spare to get the name and check quantity
            const [invItem] = await tx.select().from(sparesInventory).where(eq(sparesInventory.id, spareIdVal));
            if (!invItem) {
              throw new Error(`Spare part ID ${spareIdVal} not found in inventory.`);
            }

            // Deduct quantity from inventory
            const newQty = invItem.quantity - qty;
            await tx.update(sparesInventory)
              .set({ quantity: newQty })
              .where(eq(sparesInventory.id, spareIdVal));

            // Log spare used
            await tx.insert(serviceLogSpares).values({
              serviceLogId: log.id,
              spareId: spareIdVal,
              spareName: invItem.name,
              quantity: qty,
            });
          }
        }

        // Return compiled log with relations
        return log;
      });

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
        spares, // Array of { spareId: number, quantity: number }
      } = req.body;

      if (!bikeId || !date || isNaN(mileage) || !officer || !province || !district || !status) {
        return res.status(400).json({ error: "Missing required service log fields" });
      }

      await db.transaction(async (tx) => {
        // 1. Restore previous spares to inventory
        const oldSpares = await tx.select().from(serviceLogSpares).where(eq(serviceLogSpares.serviceLogId, logId));
        for (const oldItem of oldSpares) {
          if (oldItem.spareId) {
            const [invItem] = await tx.select().from(sparesInventory).where(eq(sparesInventory.id, oldItem.spareId));
            if (invItem) {
              await tx.update(sparesInventory)
                .set({ quantity: invItem.quantity + oldItem.quantity })
                .where(eq(sparesInventory.id, oldItem.spareId));
            }
          }
        }

        // 2. Delete old service log spares
        await tx.delete(serviceLogSpares).where(eq(serviceLogSpares.serviceLogId, logId));

        // 3. Update the service log
        await tx.update(serviceLogs).set({
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
        }).where(eq(serviceLogs.id, logId));

        // 4. Deduct new spares from inventory and save
        if (spares && Array.isArray(spares) && spares.length > 0) {
          for (const item of spares) {
            const qty = parseInt(item.quantity) || 1;
            const spareIdVal = parseInt(item.spareId);

            if (isNaN(spareIdVal)) continue;

            const [invItem] = await tx.select().from(sparesInventory).where(eq(sparesInventory.id, spareIdVal));
            if (!invItem) {
              throw new Error(`Spare part ID ${spareIdVal} not found in inventory.`);
            }

            // Deduct quantity from inventory
            const newQty = invItem.quantity - qty;
            await tx.update(sparesInventory)
              .set({ quantity: newQty })
              .where(eq(sparesInventory.id, spareIdVal));

            // Log spare used
            await tx.insert(serviceLogSpares).values({
              serviceLogId: logId,
              spareId: spareIdVal,
              spareName: invItem.name,
              quantity: qty,
            });
          }
        }
      });

      res.json({ status: "success", message: "Service log updated successfully" });
    } catch (error: any) {
      console.error("Error updating service log:", error);
      res.status(500).json({ error: "Failed to update service log", details: error.message });
    }
  });

  app.delete("/api/logs/:id", requireAuth, async (req, res) => {
    try {
      const logId = parseInt(req.params.id);

      await db.transaction(async (tx) => {
        // 1. Restore used spares back to inventory
        const oldSpares = await tx.select().from(serviceLogSpares).where(eq(serviceLogSpares.serviceLogId, logId));
        for (const oldItem of oldSpares) {
          if (oldItem.spareId) {
            const [invItem] = await tx.select().from(sparesInventory).where(eq(sparesInventory.id, oldItem.spareId));
            if (invItem) {
              await tx.update(sparesInventory)
                .set({ quantity: invItem.quantity + oldItem.quantity })
                .where(eq(sparesInventory.id, oldItem.spareId));
            }
          }
        }

        // 2. Delete service log (onDelete cascade handles serviceLogSpares deletion)
        await tx.delete(serviceLogs).where(eq(serviceLogs.id, logId));
      });

      res.json({ status: "success", message: "Service log deleted and spares returned to inventory" });
    } catch (error: any) {
      console.error("Error deleting service log:", error);
      res.status(500).json({ error: "Failed to delete service log", details: error.message });
    }
  });

  // --- USER MANAGEMENT API ROUTES ---
  app.get("/api/users", requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await db.select().from(users).where(eq(users.uid, req.user!.uid));
      if (!dbUser[0] || dbUser[0].role !== "admin") {
        return res.status(403).json({ error: "Forbidden: Admins only" });
      }
      const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
      res.json(allUsers);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users", details: error.message });
    }
  });

  app.post("/api/users", requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await db.select().from(users).where(eq(users.uid, req.user!.uid));
      if (!dbUser[0] || dbUser[0].role !== "admin") {
        return res.status(403).json({ error: "Forbidden: Admins only" });
      }
      const { email, name, role } = req.body;
      if (!email || !role) {
        return res.status(400).json({ error: "Email and Role are required" });
      }
      const lowerEmail = email.trim().toLowerCase();
      // Check if user already exists
      const existing = await db.select().from(users).where(eq(users.email, lowerEmail));
      if (existing.length > 0) {
        return res.status(400).json({ error: "A user with this email already exists" });
      }

      // Generate a unique dummy/pending UID so we satisfy notNull() and unique constraints
      const dummyUid = "pending_auth_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);

      const [newUser] = await db.insert(users).values({
        uid: dummyUid,
        email: lowerEmail,
        name: name || null,
        role: role || "user"
      }).returning();

      res.json({ status: "success", user: newUser });
    } catch (error: any) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Failed to create user", details: error.message });
    }
  });

  app.put("/api/users/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await db.select().from(users).where(eq(users.uid, req.user!.uid));
      if (!dbUser[0] || dbUser[0].role !== "admin") {
        return res.status(403).json({ error: "Forbidden: Admins only" });
      }
      const userId = parseInt(req.params.id);
      const { name, role, email } = req.body;
      
      const lowerEmail = email ? email.trim().toLowerCase() : undefined;
      
      const [updatedUser] = await db.update(users)
        .set({
          name,
          role,
          email: lowerEmail
        })
        .where(eq(users.id, userId))
        .returning();

      res.json({ status: "success", user: updatedUser });
    } catch (error: any) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user", details: error.message });
    }
  });

  app.delete("/api/users/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await db.select().from(users).where(eq(users.uid, req.user!.uid));
      if (!dbUser[0] || dbUser[0].role !== "admin") {
        return res.status(403).json({ error: "Forbidden: Admins only" });
      }
      const userId = parseInt(req.params.id);
      
      if (userId === dbUser[0].id) {
        return res.status(400).json({ error: "You cannot delete your own admin account" });
      }

      await db.delete(users).where(eq(users.id, userId));
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
      const [bike] = await db.select().from(bikes).where(eq(bikes.id, parseInt(bikeId)));
      if (!bike) {
        return res.status(404).json({ error: "Bike not found" });
      }

      const [newRequest] = await db.insert(serviceRequests).values({
        bikeId: parseInt(bikeId),
        bikeReg: bike.regNo,
        requestedBy,
        serviceType,
        problemDescription,
        status: "pending",
        dateRequested
      }).returning();

      res.json({ status: "success", request: newRequest });
    } catch (error: any) {
      console.error("Error creating service request:", error);
      res.status(500).json({ error: "Failed to create service request", details: error.message });
    }
  });

  app.get("/api/requests", requireAuth, async (req: AuthRequest, res) => {
    try {
      const [dbUser] = await db.select().from(users).where(eq(users.uid, req.user!.uid));
      if (!dbUser) {
        return res.status(403).json({ error: "User profile not found" });
      }

      let list;
      if (dbUser.role === "admin") {
        list = await db.select().from(serviceRequests).orderBy(desc(serviceRequests.createdAt));
      } else {
        list = await db.select()
          .from(serviceRequests)
          .where(eq(serviceRequests.requestedBy, dbUser.email))
          .orderBy(desc(serviceRequests.createdAt));
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
      const [dbUser] = await db.select().from(users).where(eq(users.uid, req.user!.uid));
      if (!dbUser || dbUser.role !== "admin") {
        return res.status(403).json({ error: "Forbidden: Admins only" });
      }

      const [updatedRequest] = await db.update(serviceRequests)
        .set({ status })
        .where(eq(serviceRequests.id, requestId))
        .returning();

      res.json({ status: "success", request: updatedRequest });
    } catch (error: any) {
      console.error("Error updating request status:", error);
      res.status(500).json({ error: "Failed to update service request status", details: error.message });
    }
  });

  app.delete("/api/requests/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const requestId = parseInt(req.params.id);
      const [dbUser] = await db.select().from(users).where(eq(users.uid, req.user!.uid));
      if (!dbUser) {
        return res.status(403).json({ error: "User profile not found" });
      }

      const [reqObj] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, requestId));
      if (!reqObj) {
        return res.status(404).json({ error: "Request not found" });
      }

      if (dbUser.role !== "admin" && reqObj.requestedBy !== dbUser.email) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      await db.delete(serviceRequests).where(eq(serviceRequests.id, requestId));
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
