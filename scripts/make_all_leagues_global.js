const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and a Supabase key env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    const { data, error } = await supabase
        .from('leagues')
        .update({ is_global: true })
        .neq('id', 0); // Hack to update all rows
        
    if (error) {
        console.error('Error updating leagues:', error);
    } else {
        console.log('Successfully updated leagues to global:', data);
    }
}

run();
