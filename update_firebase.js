const fs = require('fs');
let code = fs.readFileSync('src/lib/firebase.ts', 'utf8');
code = "import { getFirestore } from 'firebase/firestore';\n" + code;
code += "\nexport const db = getFirestore(app);\n";
fs.writeFileSync('src/lib/firebase.ts', code);
