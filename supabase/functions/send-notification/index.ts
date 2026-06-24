// supabase/functions/send-notification/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { GoogleAuth } from "https://esm.sh/google-auth-library@8.7.0"

// Tuto proměnnou (klíč v JSON formátu jako string) musíš nastavit v Supabase Dashboard -> Edge Functions -> Secrets
const FB_SERVICE_ACCOUNT = Deno.env.get("FIREBASE_SERVICE_ACCOUNT")

async function getAccessToken() {
  if (!FB_SERVICE_ACCOUNT) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT secret.")
  }
  const credentials = JSON.parse(FB_SERVICE_ACCOUNT)
  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return { token: token.token, projectId: credentials.project_id };
}

async function sendFcmMessage(fcmToken: string, title: string, body: string, data: any = {}) {
  const { token, projectId } = await getAccessToken();
  
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message: {
        token: fcmToken,
        notification: { title, body },
        data: data
      },
    }),
  });

  return response.json();
}

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    const payload = await req.json()
    const table = payload.table
    const record = payload.record

    // Funkce pro získání tokenů a odeslání
    const notifyUser = async (userId: string, title: string, body: string, data: any) => {
      const { data: devices } = await supabaseClient.from('user_devices').select('fcm_token').eq('user_id', userId)
      for (const device of devices || []) {
        if (device.fcm_token) {
          await sendFcmMessage(device.fcm_token, title, body, data).catch(console.error)
        }
      }
    }

    // 1. Žádosti o přátelství
    if (table === 'friendships' && payload.type === 'INSERT') {
      // friend_id = ten, komu žádost přišla. user_id = ten, kdo ji poslal.
      if (record.status === 'pending') {
        const { data: user } = await supabaseClient.from('users').select('notify_friend_requests').eq('id', record.friend_id).single()
        if (user?.notify_friend_requests !== false) {
          const { data: fromUser } = await supabaseClient.from('users').select('username').eq('id', record.user_id).single()
          await notifyUser(record.friend_id, "Nová žádost o přátelství", `${fromUser?.username || 'Někdo'} ti poslal žádost o přátelství!`, { type: 'friend_request' });
        }
      }
    }

    // 2. Event zprávy
    if (table === 'event_messages' && payload.type === 'INSERT') {
      const chat_id = record.instance_date ? `instance_${record.series_id}_${record.instance_date}` : `series_${record.series_id}`;
      const { data: participants } = await supabaseClient.from('event_participants').select('user_id').eq('series_id', record.series_id)
      
      const { data: sender } = await supabaseClient.from('users').select('username').eq('id', record.user_id).single()

      for (const p of participants || []) {
        if (p.user_id === record.user_id) continue;
        const { data: user } = await supabaseClient.from('users').select('notify_chat_messages').eq('id', p.user_id).single()
        const { data: muted } = await supabaseClient.from('muted_chats').select('*').eq('user_id', p.user_id).eq('chat_id', chat_id).single()
        
        if (user?.notify_chat_messages !== false && !muted) {
           await notifyUser(p.user_id, "Nová zpráva v události", `${sender?.username || 'Uživatel'}: ${record.message}`, { type: 'event_chat', series_id: record.series_id, instance_date: record.instance_date });
        }
      }
    }

    // 3. Globální zprávy (včetně systémových)
    if (table === 'global_messages' && payload.type === 'INSERT') {
       // Pro normální globální zprávy
       if (!record.is_system_message) {
         const { data: sender } = await supabaseClient.from('users').select('username').eq('id', record.user_id).single()
         const { data: allUsers } = await supabaseClient.from('users').select('id, notify_global_chat')
         
         for (const u of allUsers || []) {
           if (u.id === record.user_id) continue;
           const { data: muted } = await supabaseClient.from('muted_chats').select('*').eq('user_id', u.id).eq('chat_id', 'global').single()
           
           if (u.notify_global_chat !== false && !muted) {
              await notifyUser(u.id, "Globální chat", `${sender?.username || 'Uživatel'}: ${record.message}`, { type: 'global_chat' });
           }
         }
       } else if (record.is_system_message && record.related_user_id) {
         // Je to narozeninová zpráva -> upozornit přátele a přátele přátel
         const { data: netData } = await supabaseClient.rpc('get_extended_network_ids', { p_user_id: record.related_user_id })
         
         for (const friend of netData || []) {
           // Možná ignorovat, pokud má vyplé globální notifikace, ale u narozenin to možná chce vědět?
           const { data: u } = await supabaseClient.from('users').select('notify_global_chat').eq('id', friend.u_id).single()
           const { data: muted } = await supabaseClient.from('muted_chats').select('*').eq('user_id', friend.u_id).eq('chat_id', 'global').single()
           if (u?.notify_global_chat !== false && !muted) {
              await notifyUser(friend.u_id, "Oznámení", record.message, { type: 'system_message' });
           }
         }
       }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } })
  } catch (err) {
    console.error(err)
    return new Response(String(err?.message ?? err), { status: 500 })
  }
})
