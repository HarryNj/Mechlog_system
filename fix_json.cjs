const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const safeJsonParse = `  const safeJson = async (res: Response) => {
    try {
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return await res.json();
      }
      return null;
    } catch {
      return null;
    }
  };
`;

code = code.replace("  const offlineFetch = async", safeJsonParse + "\n  const offlineFetch = async");

// Now replace await res.json() with safeJson(res) in all places in App.tsx
code = code.replace(/await res\.json\(\)/g, "await safeJson(res) || {}");
code = code.replace(/await results\[0\]\.json\(\)/g, "await safeJson(results[0]) || []");
code = code.replace(/await results\[1\]\.json\(\)/g, "await safeJson(results[1]) || []");
code = code.replace(/await results\[2\]\.json\(\)/g, "await safeJson(results[2]) || []");
code = code.replace(/await results\[3\]\.json\(\)/g, "await safeJson(results[3]) || []");
code = code.replace(/await results\[4\]\.json\(\)/g, "await safeJson(results[4]) || []");
code = code.replace(/await userRes\.json\(\)/g, "await safeJson(userRes) || {}");

fs.writeFileSync('src/App.tsx', code);
