import { adminDb } from "./src/lib/firebase-admin.ts";
async function test() {
  const snapshot = await adminDb.collection("users").limit(1).get();
  console.log(snapshot.docs[0].data());
}
test();
