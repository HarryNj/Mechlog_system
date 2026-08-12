import { getUserByUid, getUserByEmail, createUser, updateUser } from './adapters.ts';

const ADMIN_EMAILS = [
  "harrisonnjobvu@gmail.com",
  "harrisonnjobvu@gamil.com",
  "admin@effzambia.org",
  "admin@eff.org",
  "mathewshamzy@gmail.com"
];

function isEmailAdmin(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

export async function getOrCreateUser(uid: string, email: string, name?: string, phoneNumber?: string) {
  const lowerEmail = email.trim().toLowerCase();
  const isAdmin = isEmailAdmin(lowerEmail);

  // 1. Check if user already exists by UID
  const existingUid = await getUserByUid(uid) as any;
  if (existingUid) {
    const targetRole = (isAdmin || existingUid.role === "admin") ? "admin" : "user";
    if (targetRole !== existingUid.role) {
      return await updateUser(uid, {
        role: targetRole,
        email: lowerEmail,
        name: name || existingUid.name,
        phoneNumber: phoneNumber || existingUid.phoneNumber
      });
    }
    return await updateUser(uid, {
      email: lowerEmail,
      name: name || existingUid.name,
      phoneNumber: phoneNumber || existingUid.phoneNumber
    });
  }

  // 2. Check if user already exists by Email (pre-registered by Admin)
  const existingEmail = await getUserByEmail(lowerEmail) as any;
  if (existingEmail) {
    const targetRole = (isAdmin || existingEmail.role === "admin") ? "admin" : "user";
    return await updateUser(existingEmail.uid, {
      uid,
      role: targetRole,
      name: name || existingEmail.name,
      phoneNumber: phoneNumber || existingEmail.phoneNumber
    });
  }

  // 3. Create a brand new user
  const defaultRole = isAdmin ? "admin" : "user";

  return await createUser({
    uid,
    email: lowerEmail,
    name: name || null,
    phoneNumber: phoneNumber || null,
    role: defaultRole,
  });
}
