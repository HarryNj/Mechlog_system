const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Fix handleEmailSignIn
code = code.replace(/const res = await fetch\("\/api\/auth\/sync"[\s\S]*?if \(!res\.ok\) \{\s*throw new Error\(data\.error \|\| "Failed to sync user data"\);\s*\}/, 
`let data = { user: {} };
      try {
        const res = await fetch("/api/auth/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: currentUser.email })
        });
        if (res.ok) {
          data = await res.json();
        } else {
          console.warn("Backend auth sync not available, using local session.");
        }
      } catch (err) {
        console.warn("Backend auth sync failed, using local session.", err);
      }`);

// Fix handleEmailRegister
code = code.replace(/const res = await fetch\("\/api\/auth\/sync", \{\s*method: "POST",\s*headers: \{ "Content-Type": "application\/json", "Authorization": \`Bearer \$\{token\}\` \},\s*body: JSON\.stringify\(\{ email: currentUser\.email, name: authName, phoneNumber: finalPhone \}\)\s*\}\);\s*const data = await res\.json\(\);\s*if \(!res\.ok\) \{\s*throw new Error\(data\.error \|\| "Failed to sync user data"\);\s*\}/,
`let data = { user: {} };
      try {
        const res = await fetch("/api/auth/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": \`Bearer \$\{token\}\` },
          body: JSON.stringify({ email: currentUser.email, name: authName, phoneNumber: finalPhone })
        });
        if (res.ok) {
          data = await res.json();
        } else {
          console.warn("Backend auth sync not available, using local session.");
        }
      } catch (err) {
        console.warn("Backend auth sync failed, using local session.", err);
      }`);

fs.writeFileSync('src/App.tsx', code);
