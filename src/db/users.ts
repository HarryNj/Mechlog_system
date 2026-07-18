import { getUserByUid, getUserByEmail, createUser, updateUser } from './adapters.ts';

export async function getOrCreateUser(uid: string, email: string, name?: string, phoneNumber?: string) {
  const lowerEmail = email.trim().toLowerCase();
  
  // 1. Check if user already exists by UID
  const existingUid = await getUserByUid(uid) as any;
  if (existingUid) {
    const isAdminEmail = lowerEmail === "harrisonnjobvu@gmail.com" || lowerEmail === "harrisonnjobvu@gamil.com";
    if (isAdminEmail && existingUid.role !== "admin") {
      return await updateUser(uid, {
        role: "admin",
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
    // If we're updating a user from an email reservation, they need a uid
    return await updateUser(existingEmail.uid, {
      uid,
      name: name || existingEmail.name,
      phoneNumber: phoneNumber || existingEmail.phoneNumber
    });
  }

  // 3. Create a brand new user
  const isAdminEmail = lowerEmail === "harrisonnjobvu@gmail.com" || lowerEmail === "harrisonnjobvu@gamil.com";
  const defaultRole = isAdminEmail ? "admin" : "user";

  return await createUser({
    uid,
    email: lowerEmail,
    name: name || null,
    phoneNumber: phoneNumber || null,
    role: defaultRole,
  });
}
