const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Fix the infinite recursion in safeJson
code = code.replace(/return await safeJson\(res\) \|\| \{\};/, "return await res.clone().json();");

fs.writeFileSync('src/App.tsx', code);
