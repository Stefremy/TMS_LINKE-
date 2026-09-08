const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchCols() {
  const { data, error } = await supabase.from('recolhas').select('*').limit(1);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Recolhas limit 1:', data);
  }
}
fetchCols();
