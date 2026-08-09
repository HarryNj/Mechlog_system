import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

async function test() {
  console.log('Testing with Client SDK...');
  try {
    console.log('  Initializing app...');
    const app = initializeApp(config);
    console.log('  Getting Firestore instance...');
    const db = getFirestore(app, config.firestoreDatabaseId);
    
    console.log('  Database ID:', config.firestoreDatabaseId);
    
    console.log('  Fetching documents from test-collection...');
    const querySnapshot = await getDocs(collection(db, 'test-collection'));
    console.log(`  SUCCESS! Found ${querySnapshot.size} documents in test-collection`);
  } catch (err) {
    console.log('  FAIL:', err.message);
  }
}

test();
