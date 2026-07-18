const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/await currentUser\.getIdToken\(\)/g, '"dummy-token"');
code = code.replace(/await user\.getIdToken\(\)/g, '"dummy-token"');

fs.writeFileSync('src/App.tsx', code);
