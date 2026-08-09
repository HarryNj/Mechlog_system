import { initializeApp as initAdminApp, getApps as getAdminApps } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { initializeApp as initClientApp, getApps as getClientApps, getApp as getClientApp } from 'firebase/app';
import { getFirestore, collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const projectId = firebaseConfig.projectId;
const databaseId = firebaseConfig.firestoreDatabaseId;

console.log(`[Firebase Admin Workaround] Initializing with Project: ${projectId}, Database: ${databaseId}`);

// Admin App for Auth (this usually works as it uses the identity toolkit API)
export const adminApp = getAdminApps()[0] || initAdminApp({ projectId });
export const adminAuth = getAdminAuth(adminApp);

// Client SDK for Firestore (Workaround for Admin SDK permission issues in AI Studio)
const clientApp = getClientApps().length > 0 ? getClientApp() : initClientApp(firebaseConfig);
const db = getFirestore(clientApp, databaseId);

/**
 * A minimal shim to provide a firebase-admin-like API for Firestore using the Client SDK.
 * This allows src/db/adapters.ts to continue working without massive rewrites.
 */
export const adminDb = {
  collection: (path: string) => {
    let currentQuery: any = collection(db, path);
    
    const wrapper: any = {
      doc: (id: string) => {
        const d = doc(db, path, String(id));
        return {
          get: async () => {
            const s = await getDoc(d);
            return { 
              exists: s.exists(), 
              data: () => s.data(), 
              ref: { 
                update: (data: any) => updateDoc(d, data), 
                delete: () => deleteDoc(d),
                get: async () => {
                   const s2 = await getDoc(d);
                   return { data: () => s2.data() };
                }
              } 
            };
          },
          set: (data: any) => setDoc(d, data),
          update: (data: any) => updateDoc(d, data),
          delete: () => deleteDoc(d),
        };
      },
      where: (field: string, op: any, val: any) => {
        currentQuery = query(currentQuery, where(field, op, val));
        return wrapper;
      },
      orderBy: (field: string, dir: any) => {
        currentQuery = query(currentQuery, orderBy(field, dir));
        return wrapper;
      },
      limit: (num: number) => {
        currentQuery = query(currentQuery, limit(num));
        return wrapper;
      },
      get: async () => {
        const s = await getDocs(currentQuery);
        return {
          empty: s.empty,
          size: s.size,
          docs: s.docs.map(d => ({
            id: d.id,
            data: () => d.data(),
            ref: { 
              update: (data: any) => updateDoc(d.ref, data), 
              delete: () => deleteDoc(d.ref),
              get: async () => {
                 const s2 = await getDoc(d.ref);
                 return { data: () => s2.data() };
              }
            }
          }))
        };
      }
    };
    return wrapper;
  }
};
