const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://sdzyhihtqrgsntbxlugp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkenloaWh0cXJnc250YnhsdWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NDk2MTEsImV4cCI6MjA5NjEyNTYxMX0.4L2K8gmIvWn6FwkECofkvJ-cpFr8hXCZbjxOqpECN38';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
    console.log("Fetching all leagues...");
    const { data: allLeagues, error: err1 } = await supabase.from('leagues').select('*');
    if (err1) {
        console.error("Error fetching all leagues:", err1);
    } else {
        console.log("All leagues:", allLeagues.length);
        console.log(allLeagues.map(l => `${l.id}: ${l.name} (is_global: ${l.is_global})`).join('\n'));
    }

    console.log("\nFetching league_players...");
    const { data: players, error: err4 } = await supabase.from('league_players').select('*');
    if (err4) {
        console.error("Error fetching players:", err4);
    } else {
        console.log("Players:", players.length);
        console.log(players.map(p => `League ${p.league_id}, User ${p.user_id}`).join('\n'));
    }
}

run();
