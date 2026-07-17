const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const offlineBadge = `
            {!isOnline && (
              <div className="flex items-center gap-2 mt-4 px-3 py-2 bg-amber-500/10 text-amber-500 rounded-lg text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                Offline Mode ({offlineQueue.length} unsynced)
              </div>
            )}
`;

code = code.replace(
  '<p className="text-xs text-slate-400">Fleet MechLog</p>',
  '<p className="text-xs text-slate-400">Fleet MechLog</p>' + offlineBadge
);

fs.writeFileSync('src/App.tsx', code);
