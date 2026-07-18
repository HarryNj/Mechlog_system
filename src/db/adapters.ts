import { db } from "./index.ts";
import { users, bikes, sparesInventory, serviceLogs, serviceLogSpares, serviceRequests } from "./schema.ts";
import { eq, desc, and, sql } from "drizzle-orm";
import { adminDb } from "../lib/firebase-admin.ts";

export let useFirestore = true; // Default to Google Firebase Firestore as safe default

export function setUseFirestore(val: boolean) {
  useFirestore = val;
  console.log(`[DB System] useFirestore updated to: ${val}`);
}

// Proactively probe SQL connection at startup to see if it is healthy.
// If it succeeds, switch useFirestore to false. Otherwise, stay on Firestore.
if (process.env.DATABASE_URL || process.env.SQL_HOST) {
  (async () => {
    try {
      console.log("[DB System] Probing SQL database connection health...");
      await db.execute(sql`SELECT 1`);
      console.log("[DB System] SQL database connection is healthy and responsive! Enabling SQL storage.");
      useFirestore = false;
    } catch (err: any) {
      useFirestore = true;
    }
  })();
}

// Helper to get next sequential ID in Firestore
async function getNextFirestoreId(collectionName: string): Promise<number> {
  try {
    const snapshot = await adminDb.collection(collectionName).orderBy("id", "desc").limit(1).get();
    if (snapshot.empty) return 1;
    const maxDoc = snapshot.docs[0].data();
    return (maxDoc.id || 0) + 1;
  } catch (err) {
    console.error(`Error getting next ID for ${collectionName}:`, err);
    return Date.now(); // Fallback to timestamp if querying fails
  }
}

// --- USERS ADAPTERS ---

export async function getAllUsers(): Promise<any[]> {
  if (useFirestore) {
    const snapshot = await adminDb.collection("users").get();
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : doc.data().createdAt
    }));
  }
  return await db.select().from(users).orderBy(desc(users.createdAt));
}

export async function getUserByUid(uid: string): Promise<any> {
  if (useFirestore) {
    const snapshot = await adminDb.collection("users").where("uid", "==", uid).limit(1).get();
    if (snapshot.empty) return null;
    const data = snapshot.docs[0].data();
    return {
      ...data,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt
    };
  }
  const result = await db.select().from(users).where(eq(users.uid, uid));
  return result[0] || null;
}

export async function getUserByEmail(email: string): Promise<any> {
  const lowerEmail = email.trim().toLowerCase();
  if (useFirestore) {
    const snapshot = await adminDb.collection("users").where("email", "==", lowerEmail).limit(1).get();
    if (snapshot.empty) return null;
    const data = snapshot.docs[0].data();
    return {
      ...data,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt
    };
  }
  const result = await db.select().from(users).where(eq(users.email, lowerEmail));
  return result[0] || null;
}

export async function getUserByPhone(phone: string): Promise<any> {
  if (useFirestore) {
    const snapshot = await adminDb.collection("users").where("phoneNumber", "==", phone).limit(1).get();
    if (snapshot.empty) return null;
    const data = snapshot.docs[0].data();
    return {
      ...data,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt
    };
  }
  const result = await db.select().from(users).where(eq(users.phoneNumber, phone));
  return result[0] || null;
}

export async function createUser(data: any): Promise<any> {
  if (useFirestore) {
    const id = await getNextFirestoreId("users");
    const newUser = {
      id,
      uid: data.uid,
      email: data.email.trim().toLowerCase(),
      passwordHash: data.passwordHash || null,
      name: data.name || null,
      phoneNumber: data.phoneNumber || null,
      role: data.role || "user",
      createdAt: new Date()
    };
    await adminDb.collection("users").doc(data.uid).set(newUser);
    return newUser;
  }
  const [result] = await db.insert(users).values(data).returning();
  return result;
}

export async function updateUser(uid: string, data: any): Promise<any> {
  if (useFirestore) {
    const docRef = adminDb.collection("users").doc(uid);
    await docRef.update(data);
    const updated = await docRef.get();
    return updated.data();
  }
  const [result] = await db.update(users).set(data).where(eq(users.uid, uid)).returning();
  return result;
}

export async function updateUserById(id: number, data: any): Promise<any> {
  if (useFirestore) {
    const snapshot = await adminDb.collection("users").where("id", "==", id).limit(1).get();
    if (snapshot.empty) throw new Error("User not found");
    const docRef = snapshot.docs[0].ref;
    await docRef.update(data);
    const updated = await docRef.get();
    return updated.data();
  }
  const [result] = await db.update(users).set(data).where(eq(users.id, id)).returning();
  return result;
}

export async function deleteUser(id: number) {
  if (useFirestore) {
    const snapshot = await adminDb.collection("users").where("id", "==", id).limit(1).get();
    if (!snapshot.empty) {
      await snapshot.docs[0].ref.delete();
    }
    return;
  }
  await db.delete(users).where(eq(users.id, id));
}

// --- BIKES ADAPTERS ---

export async function getAllBikes() {
  if (useFirestore) {
    const snapshot = await adminDb.collection("bikes").get();
    const list = snapshot.docs.map(doc => ({
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : doc.data().createdAt
    })) as any[];
    return list.sort((a, b) => b.id - a.id);
  }
  return await db.select().from(bikes).orderBy(desc(bikes.createdAt));
}

export async function getBikeByReg(regNo: string) {
  const formattedRegNo = regNo.trim().toUpperCase();
  if (useFirestore) {
    const snapshot = await adminDb.collection("bikes").where("regNo", "==", formattedRegNo).limit(1).get();
    if (snapshot.empty) return null;
    return snapshot.docs[0].data();
  }
  const result = await db.select().from(bikes).where(eq(bikes.regNo, formattedRegNo));
  return result[0] || null;
}

export async function getBikeById(id: number) {
  if (useFirestore) {
    const snapshot = await adminDb.collection("bikes").where("id", "==", id).limit(1).get();
    if (snapshot.empty) return null;
    return snapshot.docs[0].data();
  }
  const result = await db.select().from(bikes).where(eq(bikes.id, id));
  return result[0] || null;
}

export async function createBike(data: any) {
  if (useFirestore) {
    const id = await getNextFirestoreId("bikes");
    const newBike = {
      id,
      regNo: data.regNo.trim().toUpperCase(),
      province: data.province,
      district: data.district,
      model: data.model,
      officer: data.officer,
      dateAdded: data.dateAdded,
      createdAt: new Date()
    };
    await adminDb.collection("bikes").doc(String(id)).set(newBike);
    return newBike;
  }
  const [result] = await db.insert(bikes).values(data).returning();
  return result;
}

export async function updateBike(id: number, data: any) {
  if (useFirestore) {
    const snapshot = await adminDb.collection("bikes").where("id", "==", id).limit(1).get();
    if (snapshot.empty) throw new Error("Bike not found");
    const docRef = snapshot.docs[0].ref;
    await docRef.update(data);
    const updated = await docRef.get();
    return updated.data();
  }
  const [result] = await db.update(bikes).set(data).where(eq(bikes.id, id)).returning();
  return result;
}

export async function deleteBike(id: number) {
  if (useFirestore) {
    const snapshot = await adminDb.collection("bikes").where("id", "==", id).limit(1).get();
    if (!snapshot.empty) {
      await snapshot.docs[0].ref.delete();
    }
    return;
  }
  await db.delete(bikes).where(eq(bikes.id, id));
}

// --- SPARES ADAPTERS ---

export async function getAllSpares() {
  if (useFirestore) {
    const snapshot = await adminDb.collection("spares").get();
    const list = snapshot.docs.map(doc => ({
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : doc.data().createdAt
    })) as any[];
    return list.sort((a, b) => b.id - a.id);
  }
  return await db.select().from(sparesInventory).orderBy(desc(sparesInventory.createdAt));
}

export async function getSpareByName(name: string) {
  const formattedName = name.trim();
  if (useFirestore) {
    const snapshot = await adminDb.collection("spares").where("name", "==", formattedName).limit(1).get();
    if (snapshot.empty) return null;
    return snapshot.docs[0].data();
  }
  const result = await db.select().from(sparesInventory).where(eq(sparesInventory.name, formattedName));
  return result[0] || null;
}

export async function getSpareById(id: number) {
  if (useFirestore) {
    const snapshot = await adminDb.collection("spares").where("id", "==", id).limit(1).get();
    if (snapshot.empty) return null;
    return snapshot.docs[0].data();
  }
  const result = await db.select().from(sparesInventory).where(eq(sparesInventory.id, id));
  return result[0] || null;
}

export async function createSpare(data: any) {
  if (useFirestore) {
    const id = await getNextFirestoreId("spares");
    const newSpare = {
      id,
      name: data.name.trim(),
      quantity: Number(data.quantity),
      dateAdded: data.dateAdded,
      addedBy: data.addedBy,
      createdAt: new Date()
    };
    await adminDb.collection("spares").doc(String(id)).set(newSpare);
    return newSpare;
  }
  const [result] = await db.insert(sparesInventory).values(data).returning();
  return result;
}

export async function updateSpare(id: number, data: any) {
  if (useFirestore) {
    const snapshot = await adminDb.collection("spares").where("id", "==", id).limit(1).get();
    if (snapshot.empty) throw new Error("Spare not found");
    const docRef = snapshot.docs[0].ref;
    const updateData = { ...data };
    if (updateData.quantity !== undefined) {
      updateData.quantity = Number(updateData.quantity);
    }
    await docRef.update(updateData);
    const updated = await docRef.get();
    return updated.data();
  }
  const [result] = await db.update(sparesInventory).set(data).where(eq(sparesInventory.id, id)).returning();
  return result;
}

export async function deleteSpare(id: number) {
  if (useFirestore) {
    const snapshot = await adminDb.collection("spares").where("id", "==", id).limit(1).get();
    if (!snapshot.empty) {
      await snapshot.docs[0].ref.delete();
    }
    return;
  }
  await db.delete(sparesInventory).where(eq(sparesInventory.id, id));
}

// --- SERVICE LOGS ADAPTERS ---

export async function getAllLogs() {
  if (useFirestore) {
    const snapshot = await adminDb.collection("service_logs").get();
    const logs = snapshot.docs.map(doc => ({
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : doc.data().createdAt
    })) as any[];
    logs.sort((a, b) => b.id - a.id);

    // Populate the bike relationship and spares
    const populatedLogs = [];
    for (const log of logs) {
      const bike = await getBikeById(log.bikeId);
      populatedLogs.push({
        ...log,
        bike
      });
    }
    return populatedLogs;
  }

  // Postgres relations query equivalent
  const result = await db.query.serviceLogs.findMany({
    orderBy: [desc(serviceLogs.createdAt)],
    with: {
      bike: true,
      spares: true,
    },
  });
  return result;
}

export async function getLogById(id: number) {
  if (useFirestore) {
    const snapshot = await adminDb.collection("service_logs").where("id", "==", id).limit(1).get();
    if (snapshot.empty) return null;
    const log = snapshot.docs[0].data();
    const bike = await getBikeById(log.bikeId);
    return {
      ...log,
      bike
    };
  }
  const result = await db.query.serviceLogs.findFirst({
    where: eq(serviceLogs.id, id),
    with: {
      bike: true,
      spares: true,
    },
  });
  return result || null;
}

export async function createLog(logData: any, sparesUsedList: any[]) {
  if (useFirestore) {
    const id = await getNextFirestoreId("service_logs");
    const newLog = {
      id,
      bikeId: Number(logData.bikeId),
      date: logData.date,
      nextServiceDate: logData.nextServiceDate || null,
      nextServiceMileage: logData.nextServiceMileage ? Number(logData.nextServiceMileage) : null,
      mileage: Number(logData.mileage),
      officer: logData.officer,
      province: logData.province,
      district: logData.district,
      workDone: logData.workDone || null,
      workPending: logData.workPending || null,
      status: logData.status,
      spares: sparesUsedList,
      createdAt: new Date()
    };
    await adminDb.collection("service_logs").doc(String(id)).set(newLog);

    // Deduct quantities of spares used from spares collection
    for (const item of sparesUsedList) {
      const spare = await getSpareById(item.spareId);
      if (spare) {
        const newQty = Math.max(0, spare.quantity - item.quantity);
        await updateSpare(spare.id, { quantity: newQty });
      }
    }

    return newLog;
  }

  // Relational Transaction
  const result = await db.transaction(async (tx) => {
    const [insertedLog] = await tx.insert(serviceLogs).values({
      bikeId: logData.bikeId,
      date: logData.date,
      nextServiceDate: logData.nextServiceDate || null,
      nextServiceMileage: logData.nextServiceMileage ? Number(logData.nextServiceMileage) : null,
      mileage: logData.mileage,
      officer: logData.officer,
      province: logData.province,
      district: logData.district,
      workDone: logData.workDone,
      workPending: logData.workPending,
      status: logData.status,
    }).returning();

    const populatedSpares = [];
    for (const sp of sparesUsedList) {
      const [insertedSpareRelation] = await tx.insert(serviceLogSpares).values({
        serviceLogId: insertedLog.id,
        spareId: sp.spareId,
        spareName: sp.spareName,
        quantity: sp.quantity,
      }).returning();

      // Deduct quantity from inventory
      await tx.execute(sql`
        UPDATE spares_inventory 
        SET quantity = GREATEST(0, quantity - ${sp.quantity}) 
        WHERE id = ${sp.spareId}
      `);

      populatedSpares.push(insertedSpareRelation);
    }

    return {
      ...insertedLog,
      spares: populatedSpares,
    };
  });

  return result;
}

export async function updateLog(id: number, logData: any) {
  if (useFirestore) {
    const snapshot = await adminDb.collection("service_logs").where("id", "==", id).limit(1).get();
    if (snapshot.empty) throw new Error("Service log not found");
    const docRef = snapshot.docs[0].ref;
    
    const cleanData = { ...logData };
    if (cleanData.bikeId !== undefined) cleanData.bikeId = Number(cleanData.bikeId);
    if (cleanData.mileage !== undefined) cleanData.mileage = Number(cleanData.mileage);
    if (cleanData.nextServiceMileage !== undefined && cleanData.nextServiceMileage !== null) {
      cleanData.nextServiceMileage = Number(cleanData.nextServiceMileage);
    }

    await docRef.update(cleanData);
    const updated = await docRef.get();
    return updated.data();
  }

  const [result] = await db.update(serviceLogs).set(logData).where(eq(serviceLogs.id, id)).returning();
  return result;
}

export async function deleteLog(id: number) {
  if (useFirestore) {
    const snapshot = await adminDb.collection("service_logs").where("id", "==", id).limit(1).get();
    if (!snapshot.empty) {
      const log = snapshot.docs[0].data();
      
      // Return spares used to inventory
      if (log.spares && Array.isArray(log.spares)) {
        for (const item of log.spares) {
          const spare = await getSpareById(item.spareId);
          if (spare) {
            const newQty = spare.quantity + item.quantity;
            await updateSpare(spare.id, { quantity: newQty });
          }
        }
      }

      await snapshot.docs[0].ref.delete();
    }
    return;
  }

  await db.transaction(async (tx) => {
    // 1. Find all spares used in this service log to return them to stock
    const sparesUsed = await tx.select().from(serviceLogSpares).where(eq(serviceLogSpares.serviceLogId, id));
    for (const used of sparesUsed) {
      if (used.spareId) {
        await tx.execute(sql`
          UPDATE spares_inventory 
          SET quantity = quantity + ${used.quantity} 
          WHERE id = ${used.spareId}
        `);
      }
    }
    // 2. Delete log (cascades to service_log_spares relation)
    await tx.delete(serviceLogs).where(eq(serviceLogs.id, id));
  });
}

// --- SERVICE REQUESTS ADAPTERS ---

export async function getAllRequests() {
  if (useFirestore) {
    const snapshot = await adminDb.collection("service_requests").get();
    const requests = snapshot.docs.map(doc => ({
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : doc.data().createdAt
    })) as any[];
    return requests.sort((a, b) => b.id - a.id);
  }
  return await db.select().from(serviceRequests).orderBy(desc(serviceRequests.createdAt));
}

export async function createRequest(data: any) {
  if (useFirestore) {
    const id = await getNextFirestoreId("service_requests");
    const newRequest = {
      id,
      bikeId: Number(data.bikeId),
      bikeReg: data.bikeReg,
      officerUid: data.officerUid || null,
      requestedBy: data.requestedBy,
      serviceType: data.serviceType,
      problemDescription: data.problemDescription,
      status: data.status || "pending",
      dateRequested: data.dateRequested,
      createdAt: new Date()
    };
    await adminDb.collection("service_requests").doc(String(id)).set(newRequest);
    return newRequest;
  }
  const [result] = await db.insert(serviceRequests).values(data).returning();
  return result;
}

export async function updateRequest(id: number, data: any) {
  if (useFirestore) {
    const snapshot = await adminDb.collection("service_requests").where("id", "==", id).limit(1).get();
    if (snapshot.empty) throw new Error("Request not found");
    const docRef = snapshot.docs[0].ref;
    await docRef.update(data);
    const updated = await docRef.get();
    return updated.data();
  }
  const [result] = await db.update(serviceRequests).set(data).where(eq(serviceRequests.id, id)).returning();
  return result;
}

export async function deleteRequest(id: number) {
  if (useFirestore) {
    const snapshot = await adminDb.collection("service_requests").where("id", "==", id).limit(1).get();
    if (!snapshot.empty) {
      await snapshot.docs[0].ref.delete();
    }
    return;
  }
  await db.delete(serviceRequests).where(eq(serviceRequests.id, id));
}
