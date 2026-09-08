const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchTables() {
  const { data, error } = await supabase.from('recolhas').select('*');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Recolhas:', JSON.stringify(data, null, 2));
  }
}
fetchTables();
