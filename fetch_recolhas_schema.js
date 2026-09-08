const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchSchema() {
  const { data, error } = await supabase.rpc('get_recolhas_schema', {});
  console.log(data);
  // Alternative: insert a dummy and delete, or just fetch the psql schema
}
fetchSchema();
