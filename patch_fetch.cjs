const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const offlineLogic = `
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlineQueue, setOfflineQueue] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('eff_offline_queue') || '[]'); }
    catch { return []; }
  });

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      await processOfflineQueue();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const processOfflineQueue = async () => {
    const queue = JSON.parse(localStorage.getItem('eff_offline_queue') || '[]');
    if (queue.length === 0) return;
    
    setSyncing(true);
    const newQueue = [];
    let syncedCount = 0;
    for (const req of queue) {
      try {
        const res = await fetch(req.url, req.options);
        if (res.ok) {
          syncedCount++;
        } else {
          newQueue.push(req);
        }
      } catch (err) {
        newQueue.push(req);
      }
    }
    
    localStorage.setItem('eff_offline_queue', JSON.stringify(newQueue));
    setOfflineQueue(newQueue);
    if (syncedCount > 0) {
      fetchData();
      alert(\`Synced \${syncedCount} offline actions successfully.\`);
    }
    setSyncing(false);
  };

  const offlineFetch = async (url: string, options: any) => {
    if (navigator.onLine) {
      return await fetch(url, options);
    } else {
      const queue = JSON.parse(localStorage.getItem('eff_offline_queue') || '[]');
      queue.push({ url, options });
      localStorage.setItem('eff_offline_queue', JSON.stringify(queue));
      setOfflineQueue(queue);
      alert('You are currently offline. This action has been saved locally and will sync when network is available.');
      return { ok: true, json: async () => ({ status: "success", offline: true }) } as any;
    }
  };
`;

code = code.replace('const [syncing, setSyncing] = useState(false);', 'const [syncing, setSyncing] = useState(false);' + offlineLogic);

code = code.replace(/await fetch\((url|`\/api\/requests\/.*`|`\/api\/bikes\/.*`|`\/api\/spares\/.*`|`\/api\/logs\/.*`|`\/api\/users\/.*`), \{\s*method/g, 'await offlineFetch($1, { method');
code = code.replace(/await fetch\("\/api\/requests",/g, 'await offlineFetch("/api/requests",');

fs.writeFileSync('src/App.tsx', code);
