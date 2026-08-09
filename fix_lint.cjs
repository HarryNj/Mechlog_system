const fs = require('fs');

// Fix App.tsx
let appTsx = fs.readFileSync('src/App.tsx', 'utf8');
// Rename User icon import
appTsx = appTsx.replace(/\s+User,\s+/g, (match) => match.replace('User,', 'User as UserIcon,'));
// Fix handleSignUp token and typing
appTsx = appTsx.replace(/const token = \(typeof \(user as any\)\?\.getIdToken === "function"\) \? await \(user as any\)\.getIdToken\(\) : "";\s+let data = \{ user: \{\} \};/g, 
  'const token = await currentUser.getIdToken();\n      let data: any = { user: {} };');
// Fix another place where User is used as a type but it's a value
// The error says: src/App.tsx(283,36): error TS2749: 'User' refers to a value, but is being used as a type here.
// This is likely because the icon User (now UserIcon) was shadowing the type User.
// By renaming the icon to UserIcon, the type User from firebase/auth should be used correctly.
fs.writeFileSync('src/App.tsx', appTsx);

// Fix firebase-admin.ts
let adminTs = fs.readFileSync('src/lib/firebase-admin.ts', 'utf8');
if (!adminTs.includes('export const adminApp')) {
  adminTs = adminTs.replace(/if \(!getAdminApps\(\)\.length\) \{[\s\S]+?\}\s+export const adminAuth = getAuth\(\);/,
    'export const adminApp = getAdminApps().length === 0 ? initAdminApp({ projectId: firebaseConfig.projectId }) : getAdminApps()[0];\nexport const adminAuth = getAuth(adminApp);');
}
fs.writeFileSync('src/lib/firebase-admin.ts', adminTs);

console.log("Fixes applied successfully.");
