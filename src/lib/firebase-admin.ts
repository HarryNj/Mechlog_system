import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where as firestoreWhere, 
  orderBy as firestoreOrderBy, 
  limit as firestoreLimit,
  QueryConstraint
} from 'firebase/firestore';
import { initializeApp as initAdminApp, getApps as getAdminApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

// Initialize Admin App (only for Auth token verification, which doesn't need DB access)
if (!getAdminApps().length) {
  initAdminApp({
    projectId: firebaseConfig.projectId,
  });
}
export const adminAuth = getAuth();

// Initialize Client App on the server (for Firestore API-key auth)
const clientApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const clientDb = getFirestore(clientApp, firebaseConfig.firestoreDatabaseId);

// Custom compatibility layer that matches the adminDb / firebase-admin collection API
class DocRefCompat {
  private colName: string;
  private docId: string;

  constructor(colName: string, docId: string) {
    this.colName = colName;
    this.docId = docId;
  }

  async set(data: any) {
    const dRef = doc(clientDb, this.colName, this.docId);
    await setDoc(dRef, data);
  }

  async update(data: any) {
    const dRef = doc(clientDb, this.colName, this.docId);
    await updateDoc(dRef, data);
  }

  async delete() {
    const dRef = doc(clientDb, this.colName, this.docId);
    await deleteDoc(dRef);
  }

  async get() {
    const dRef = doc(clientDb, this.colName, this.docId);
    const snap = await getDoc(dRef);
    return {
      exists: snap.exists(),
      id: snap.id,
      ref: this,
      data: () => snap.data()
    };
  }
}

class QueryCompat {
  private colName: string;
  private constraints: QueryConstraint[] = [];

  constructor(colName: string, initialConstraints: QueryConstraint[] = []) {
    this.colName = colName;
    this.constraints = [...initialConstraints];
  }

  where(field: string, op: any, val: any) {
    return new QueryCompat(this.colName, [
      ...this.constraints,
      firestoreWhere(field, op, val)
    ]);
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
    return new QueryCompat(this.colName, [
      ...this.constraints,
      firestoreOrderBy(field, direction)
    ]);
  }

  limit(num: number) {
    return new QueryCompat(this.colName, [
      ...this.constraints,
      firestoreLimit(num)
    ]);
  }

  async get() {
    const colRef = collection(clientDb, this.colName);
    const q = query(colRef, ...this.constraints);
    const snap = await getDocs(q);
    
    const docs = snap.docs.map(d => ({
      id: d.id,
      ref: new DocRefCompat(this.colName, d.id),
      data: () => d.data()
    }));

    return {
      empty: snap.empty,
      size: snap.size,
      docs
    };
  }
}

class CollectionCompat {
  private colName: string;

  constructor(colName: string) {
    this.colName = colName;
  }

  doc(id: string) {
    return new DocRefCompat(this.colName, id);
  }

  where(field: string, op: any, val: any) {
    return new QueryCompat(this.colName).where(field, op, val);
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
    return new QueryCompat(this.colName).orderBy(field, direction);
  }

  limit(num: number) {
    return new QueryCompat(this.colName).limit(num);
  }

  async get() {
    return new QueryCompat(this.colName).get();
  }
}

class AdminDbCompat {
  collection(colName: string) {
    return new CollectionCompat(colName);
  }
}

export const adminDb = new AdminDbCompat() as any;
