
import { createClient } from 'npm:@supabase/supabase-js';

const SUPABASE_URL = 'https://sdzyhihtqrgsntbxlugp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkenloaWh0cXJnc250YnhsdWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NDk2MTEsImV4cCI6MjA5NjEyNTYxMX0.4L2K8gmIvWn6FwkECofkvJ-cpFr8hXCZbjxOqpECN38';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    const { data: d1, error: e1 } = await supabase.from('users').select('id').limit(1);
    console.log('users id:', typeof d1?.[0]?.id, d1?.[0]?.id);

    const { data: d2, error: e2 } = await supabase.from('global_messages').select('related_user_id').limit(1);
    console.log('related_user_id error:', e2);
}
main();
