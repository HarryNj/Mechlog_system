const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const oldCode = `        if (!res.ok) {
          if (res.status === 404 || res.status === 405 || res.status >= 500) {
            throw new Error("Server or API Error");
          }
        }
          throw new Error("Server Error");
        }`;

const newCode = `        if (!res.ok) {
          if (res.status === 404 || res.status === 405 || res.status >= 500) {
            throw new Error("Server or API Error");
          }
        }`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('src/App.tsx', code);
