const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
`    try {
      const res = await mockFetch("/api/auth/custom-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to sign in");
      }

      const sessionUser = {
        uid: data.user.uid,
        email: data.user.email,
        name: data.user.name,
        phoneNumber: data.user.phoneNumber,
        role: data.user.role,
        token: data.token
      };`,
`    try {
      const userCredential = await signInWithEmailAndPassword(auth, authEmail, authPassword);
      const currentUser = userCredential.user;
      const token = await currentUser.getIdToken();

      const res = await mockFetch("/api/auth/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": \`Bearer \${token}\` },
        body: JSON.stringify({ email: currentUser.email, name: currentUser.displayName || "", phoneNumber: currentUser.phoneNumber || "" })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to sync user data");
      }

      const sessionUser = {
        uid: data.user.uid,
        email: data.user.email,
        name: data.user.name,
        phoneNumber: data.user.phoneNumber,
        role: data.user.role,
        token: token
      };`
);

fs.writeFileSync('src/App.tsx', code);
