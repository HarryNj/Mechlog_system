import { db } from './index.ts';
import { users } from './schema.ts';
import { eq } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string, name?: string, phoneNumber?: string) {
  const lowerEmail = email.trim().toLowerCase();
  
  // 1. Check if user already exists by UID
  const existingUid = await db.select().from(users).where(eq(users.uid, uid));
  if (existingUid.length > 0) {
    const isAdminEmail = lowerEmail === "harrisonnjobvu@gmail.com" || lowerEmail === "harrisonnjobvu@gamil.com";
    if (isAdminEmail && existingUid[0].role !== "admin") {
      const updated = await db.update(users)
        .set({ 
          role: "admin", 
          email: lowerEmail, 
          name: name || existingUid[0].name,
          phoneNumber: phoneNumber || existingUid[0].phoneNumber 
        })
        .where(eq(users.id, existingUid[0].id))
        .returning();
      return updated[0];
    }
    const updated = await db.update(users)
      .set({ 
        email: lowerEmail, 
        name: name || existingUid[0].name,
        phoneNumber: phoneNumber || existingUid[0].phoneNumber 
      })
      .where(eq(users.id, existingUid[0].id))
      .returning();
    return updated[0];
  }

  // 2. Check if user already exists by Email (pre-registered by Admin)
  const existingEmail = await db.select().from(users).where(eq(users.email, lowerEmail));
  if (existingEmail.length > 0) {
    const updated = await db.update(users)
      .set({ 
        uid, 
        name: name || existingEmail[0].name,
        phoneNumber: phoneNumber || existingEmail[0].phoneNumber 
      })
      .where(eq(users.id, existingEmail[0].id))
      .returning();
    return updated[0];
  }

  // 3. Create a brand new user
  const isAdminEmail = lowerEmail === "harrisonnjobvu@gmail.com" || lowerEmail === "harrisonnjobvu@gamil.com";
  const defaultRole = isAdminEmail ? "admin" : "user";

  const result = await db.insert(users)
    .values({
      uid,
      email: lowerEmail,
      name: name || null,
      phoneNumber: phoneNumber || null,
      role: defaultRole,
    })
    .returning();

  return result[0];
}
