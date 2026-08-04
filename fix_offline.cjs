const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Fix offlineFetch to handle 404 correctly
code = code.replace(/if \(\!res\.ok \&\& res\.status \>\= 500\) \{/, 
`if (!res.ok) {
          if (res.status === 404 || res.status === 405 || res.status >= 500) {
            throw new Error("Server or API Error");
          }
        }`);

fs.writeFileSync('src/App.tsx', code);
