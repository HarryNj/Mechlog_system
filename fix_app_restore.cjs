const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Find the broken syncUser function
const syncUserStart = `  const syncUser = async (currentUser: SupabaseUser, overrideName?: string, overridePhone?: string) => {
    try {
      const token = "dummy-token";`;

const syncUserEnd = `      // Set session persistently in localStorage
      localStorage.setItem("eff_user_session", JSON.stringify(sessionUser));
      const customUser = {
        uid: sessionUser.uid,
        email: sessionUser.email,
        displayName: sessionUser.name,
        name: sessionUser.name,
        phoneNumber: sessionUser.phoneNumber,
        token: sessionUser.token,
        getIdToken: async () => sessionUser.token
      };`;

// We'll replace everything from syncUserStart to syncUserEnd with the reconstructed code
const brokenStartIdx = code.indexOf('  const syncUser = async (currentUser: SupabaseUser');
if (brokenStartIdx === -1) {
  console.log("Could not find syncUser start");
  process.exit(1);
}

const brokenEndString = `      setUser(customUser as any);
      setDbUser(sessionUser);
      setAuthSuccess(data.message || "Signed in successfully!");
      await fetchData(customUser as any, sessionUser);
    } catch (err: any) {
      console.error("Sign-in failed:", err);
      setAuthError(err.message || "Incorrect email or password. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };`;

const brokenEndIdx = code.indexOf(brokenEndString);
if (brokenEndIdx === -1) {
  console.log("Could not find broken end string");
  process.exit(1);
}

const beforeCode = code.substring(0, brokenStartIdx);
const afterCode = code.substring(brokenEndIdx + brokenEndString.length);

const reconstructedCode = `  // Sync authenticated user to PostgreSQL database
  const syncUser = async (currentUser: SupabaseUser, overrideName?: string, overridePhone?: string) => {
    try {
      const token = "dummy-token";
      const res = await fetch("/api/auth/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": \`Bearer \${token}\`
        },
        body: JSON.stringify({
          uid: currentUser.id,
          name: overrideName || authName || undefined,
          phoneNumber: overridePhone || authPhone || undefined,
          email: currentUser.email
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === "success" && data.user) {
          setDbUser(data.user);
          saveToStorage("dbUser", data.user);
          await fetchData(currentUser as any, data.user);
          return;
        }
      }
      await fetchData(currentUser as any, null);
    } catch (err) {
      console.warn("Backend auth sync not available, using local session.", err);
      await fetchData(currentUser as any, null);
    }
  };

  const fetchData = async (customUser?: any, syncedDbUser?: any, silent = false) => {
    if (!customUser && !user) return;
    const currentUser = customUser || user;

    if (!silent) {
      setLoading(true);
      await processOfflineQueue();
    }

    try {
      const token = "dummy-token";
      const headers = { "Authorization": \`Bearer \${token}\` };

      // Refresh user role
      let userRes;
      try {
        userRes = await fetch("/api/auth/me", { headers });
      } catch (e) {
        userRes = { ok: false };
      }

      let finalDbUser = syncedDbUser;
      if (userRes && userRes.ok) {
        const userData = await userRes.json();
        if (userData.status === "success") {
          finalDbUser = userData.user;
          setDbUser(finalDbUser);
          saveToStorage("dbUser", finalDbUser);
        }
      } else {
        const cachedUser = loadFromStorage("dbUser");
        if (cachedUser && !Array.isArray(cachedUser)) {
          finalDbUser = cachedUser;
          setDbUser(cachedUser);
        }
      }

      const lowerEmail = currentUser.email?.toLowerCase() || "";
      const isAdminEmail = lowerEmail === "harrisonnjobvu@gmail.com" || lowerEmail === "harrisonnjobvu@gamil.com" || lowerEmail === "admin@effzambia.org" || lowerEmail === "admin@eff.org" || lowerEmail === "mathewshamzy@gmail.com";
      const isAdminUser = finalDbUser?.role === "admin" || isAdminEmail;

      const fetchPromises: Promise<any>[] = [
        fetch("/api/bikes", { headers }).catch(e => ({ ok: false })),
        fetch("/api/spares", { headers }).catch(e => ({ ok: false })),
        fetch("/api/logs", { headers }).catch(e => ({ ok: false })),
        fetch("/api/requests", { headers }).catch(e => ({ ok: false }))
      ];

      if (isAdminUser) {
        fetchPromises.push(fetch("/api/users", { headers }).catch(e => ({ ok: false })));
      }

      const results = await Promise.all(fetchPromises);
      
      // Bikes
      let freshBikes: any[] = [];
      if (results[0] && results[0].ok) {
        freshBikes = await results[0].json();
        setBikesList(freshBikes);
        saveToStorage("bikes", freshBikes);
      } else {
        freshBikes = loadFromStorage("bikes") || [];
        setBikesList(freshBikes);
      }

      // Spares
      let freshSpares: any[] = [];
      if (results[1] && results[1].ok) {
        freshSpares = await results[1].json();
        setSparesList(freshSpares);
        saveToStorage("spares", freshSpares);
      } else {
        freshSpares = loadFromStorage("spares") || [];
        setSparesList(freshSpares);
      }

      // Logs
      if (results[2] && results[2].ok) {
        const data = await results[2].json();
        const mappedLogs = data.map((l: any) => {
          const bikeInfo = l.bike || freshBikes.find((b: any) => String(b.id) === String(l.bikeId));
          return {
            ...l,
            bikeReg: bikeInfo?.regNo || \`Bike #\${l.bikeId}\`,
            spares: l.spares?.map((s: any) => {
              let name = s.spareName;
              if (!name || name === "undefined" || name === "null") {
                const spareInfo = freshSpares.find((sp: any) => String(sp.id) === String(s.spareId));
                name = spareInfo?.name || \`Spare ID \${s.spareId}\`;
              }
              return { ...s, spareName: name };
            })
          };
        });
        setLogsList(mappedLogs);
        saveToStorage("logs", mappedLogs);
      } else {
        const cachedLogs = loadFromStorage("logs") || [];
        setLogsList(cachedLogs);
      }

      // Requests
      if (results[3] && results[3].ok) {
        const data = await results[3].json();
        setRequestsList(data);
        saveToStorage("requests", data);
      } else {
        setRequestsList(loadFromStorage("requests") || []);
      }

      // Users
      if (isAdminUser && results[4] && results[4].ok) {
        const data = await results[4].json();
        setUsersList(data);
        saveToStorage("users", data);
      } else if (isAdminUser) {
        setUsersList(loadFromStorage("users") || []);
      }

      setLastSynced(new Date());
      localStorage.setItem("lastSynced", new Date().toISOString());

    } catch (error) {
      console.error("Error fetching data:", error);
      // Fallback
      setBikesList(loadFromStorage("bikes") || []);
      setSparesList(loadFromStorage("spares") || []);
      setLogsList(loadFromStorage("logs") || []);
      setRequestsList(loadFromStorage("requests") || []);
      setUsersList(loadFromStorage("users") || []);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Automated background polling to sync data dynamically across all devices
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        fetchData(user, dbUser, true);
      }
    }, 10000); // Sync silently every 10 seconds
    return () => clearInterval(interval);
  }, [user, dbUser]);

  // Handle Email/Password Sign-In (Custom Secure Relational DB Login)
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      setAuthError("Email and password are required");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    setAuthSuccess("");
    try {
      const { data: supaData, error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
      if (error) throw error;
      const userCredential = { user: supaData.user };
      const currentUser = userCredential.user;

      let data = { user: {} as any };
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
      }

      const sessionUser = {
        uid: data.user?.uid || data.user?.id || supaData.user?.id,
        email: data.user?.email || supaData.user?.email,
        name: data.user?.name || supaData.user?.user_metadata?.full_name,
        phoneNumber: data.user?.phoneNumber || data.user?.phone || supaData.user?.phone,
        role: data.user?.role || "user",
        token: "dummy-token"
      };
      
      localStorage.setItem("eff_user_session", JSON.stringify(sessionUser));
      const customUser = {
        uid: sessionUser.uid,
        email: sessionUser.email,
        displayName: sessionUser.name,
        name: sessionUser.name,
        phoneNumber: sessionUser.phoneNumber,
        token: sessionUser.token,
        getIdToken: async () => sessionUser.token
      };
      setUser(customUser as any);
      setDbUser(sessionUser as any);
      setAuthSuccess("Signed in successfully!");
      await fetchData(customUser as any, sessionUser);
    } catch (err: any) {
      console.error("Sign-in failed:", err);
      setAuthError(err.message || "Incorrect email or password. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };
`;

code = beforeCode + reconstructedCode + afterCode;
fs.writeFileSync('src/App.tsx', code);
