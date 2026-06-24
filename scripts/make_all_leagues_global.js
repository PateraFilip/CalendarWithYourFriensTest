const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://sdzyhihtqrgsntbxlugp.supabase.co';
// Záměrně použijeme service_role key pokud je potřeba pro bypass RLS, nebo jen ANON s tokenem
// V tabulce máme RLS, ale INSERT/UPDATE by měly fungovat pro otestování nebo obejití.
// Jelikož update z JS může narazit na RLS, ale teď chceme jen odeslat jednoduchý update.
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkenloaWh0cXJnc250YnhsdWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NDk2MTEsImV4cCI6MjA5NjEyNTYxMX0.4L2K8gmIvWn6FwkECofkvJ-cpFr8hXCZbjxOqpECN38'; // z CustomWeek.tsx

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
