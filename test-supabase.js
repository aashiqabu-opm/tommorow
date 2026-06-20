require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.from('pipelines').select('*').order('createdAt', { ascending: false }).limit(1);
  console.log("createdAt error:", error);
  const { data: d2, error: e2 } = await supabase.from('pipelines').select('*').limit(1);
  console.log("select * error:", e2);
  console.log("data:", d2);
}
run();
