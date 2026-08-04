const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Helper to safely parse JSON
code = code.replace(/if \(res\.ok\) \{\s*data = await res\.json\(\);\s*\}/g, 
`if (res.ok) {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            data = await res.json();
          } else {
            console.warn("Backend auth sync returned non-JSON.");
          }
        }`);

fs.writeFileSync('src/App.tsx', code);
