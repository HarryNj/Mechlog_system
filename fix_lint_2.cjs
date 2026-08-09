const fs = require('fs');
let appTsx = fs.readFileSync('src/App.tsx', 'utf8');

// Replace <User with <UserIcon (for the icon components)
appTsx = appTsx.replace(/<User /g, '<UserIcon ');

// Fix currentUser.id to currentUser.uid
appTsx = appTsx.replace(/currentUser\.id/g, 'currentUser.uid');

fs.writeFileSync('src/App.tsx', appTsx);
console.log("Fixes applied.");
