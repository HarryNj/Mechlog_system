const fs = require('fs');

const helper = `
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from './lib/firebase.ts';

const mockFetch = async (url, options = {}) => {
  const method = options.method || 'GET';
  const path = url.split('?')[0].replace('/api/', '');
  const segments = path.split('/');
  const collectionName = segments[0];
  const id = segments[1];

  try {
    if (method === 'GET') {
      if (id) {
        const snap = await getDoc(doc(db, collectionName, id));
        return { ok: true, json: async () => ({ id: snap.id, ...snap.data() }), status: 200 };
      } else {
        const snap = await getDocs(collection(db, collectionName));
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return { ok: true, json: async () => data, status: 200 };
      }
    } else if (method === 'POST') {
      if (path === 'auth/sync') {
        const body = JSON.parse(options.body);
        const userRef = doc(db, 'users', body.email); // using email as id for simplicity
        const userSnap = await getDoc(userRef);
        let userData = { ...body, role: 'user' };
        if (userSnap.exists()) {
          userData = { ...userSnap.data(), ...body };
        }
        await setDoc(userRef, userData, { merge: true });
        return { ok: true, json: async () => ({ status: 'success', user: { uid: userRef.id, ...userData } }), status: 200 };
      }
      
      const body = JSON.parse(options.body);
      // Auto generate ID
      const newRef = doc(collection(db, collectionName));
      await setDoc(newRef, body);
      return { ok: true, json: async () => ({ id: newRef.id, ...body }), status: 200 };
    } else if (method === 'PUT') {
      const body = JSON.parse(options.body);
      await updateDoc(doc(db, collectionName, id), body);
      return { ok: true, json: async () => ({ id, ...body }), status: 200 };
    } else if (method === 'DELETE') {
      await deleteDoc(doc(db, collectionName, id));
      return { ok: true, json: async () => ({ status: 'success' }), status: 200 };
    }
  } catch (err) {
    console.error('Mock fetch error:', err);
    return { ok: false, status: 500, statusText: err.message, json: async () => ({ error: err.message }) };
  }
};
`;

let code = fs.readFileSync('src/App.tsx', 'utf8');

// remove API_BASE_URL logic
code = code.replace(/const originalFetch = window\.fetch;[\s\S]*?return new Response\([\s\S]*?\}\n\n/m, '');
code = code.replace(/const API_BASE_URL = \(import\.meta as any\)\.env\.VITE_API_BASE_URL \|\| "";\n/g, '');

// Replace offlineFetch to use mockFetch instead of fetch
code = code.replace(/return await fetch\(url, options\);/, 'return await mockFetch(url, options);');

// Replace fetch in fetchData
code = code.replace(/fetch\("\/api\//g, 'mockFetch("/api/');
code = code.replace(/fetch\(`\/api\//g, 'mockFetch(`/api/');

// Replace fetch in syncUser
code = code.replace(/fetch\("\/api\/auth\/sync"/g, 'mockFetch("/api/auth/sync"');

// Inject mockFetch
code = code.replace('import { auth, googleAuthProvider }', helper + '\nimport { auth, googleAuthProvider }');

fs.writeFileSync('src/App.tsx', code);
