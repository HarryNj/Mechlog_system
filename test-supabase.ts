async function test() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  console.log('Testing Supabase REST API with Secret Key...');
  
  try {
    const res = await fetch(`${url}/rest/v1/users`, { // Try users table
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    console.log('  Status:', res.status);
    const data = await res.json();
    console.log('  Data:', data);
  } catch (err) {
    console.log('  FAIL:', err.message);
  }
}

test();
