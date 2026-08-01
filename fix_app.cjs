const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// The replacement script might have replaced things blindly. Let's make the supabase data variables unique.
code = code.replace(/const \{ data, error \} = await supabase/g, "const { data: supaData, error } = await supabase");
code = code.replace(/data\.user/g, "supaData.user");

fs.writeFileSync('src/App.tsx', code);
