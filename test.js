require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
async function test() {
  const { data } = await supabase.from('event_series').select('id, nazev, valid_from, valid_until, recurrence_rule').order('id', { ascending: false }).limit(5);
  console.log(JSON.stringify(data, null, 2));
}
test();
