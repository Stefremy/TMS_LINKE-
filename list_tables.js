const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
  const { data, error } = await supabase.rpc('get_tables', {});
  if (error) {
    console.error('Error with RPC, trying alternative...');
    // let's just do a generic postgrest fetch if possible, or skip
  } else {
    console.log(data);
  }
}
listTables();
