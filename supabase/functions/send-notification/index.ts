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
  
  // Ensure all data values are strings (FCM requirement)
  const stringifiedData: Record<string, string> = {};
  if (data) {
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && value !== undefined) {
        stringifiedData[key] = String(value);
      }
    }
  }

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
        data: stringifiedData
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`FCM error: ${response.status} ${errText}`);
  }

  return response;
}

serve(async (req) => {
  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const webhookSecret = Deno.env.get("NOTIFICATION_WEBHOOK_SECRET") ?? ""
    const authHeader = req.headers.get("Authorization") ?? ""
    const webhookHeader = req.headers.get("x-webhook-secret") ?? ""

    // Pokud je nastaven NOTIFICATION_WEBHOOK_SECRET, vyžaduj ho (nebo service role).
    // Bez secretu: zpětná kompatibilita s existujícími Database Webhooks.
    if (webhookSecret) {
      const ok =
        webhookHeader === webhookSecret ||
        (serviceKey && authHeader === `Bearer ${serviceKey}`)
      if (!ok) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      }
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceKey
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

    // 2. Event zprávy (jen běžný chat — systémové hlášky jdou přes user_notifications)
    if (table === 'event_messages' && payload.type === 'INSERT') {
      if (record.is_system_message) {
        return new Response(JSON.stringify({ success: true, skipped: 'system_message' }), {
          headers: { "Content-Type": "application/json" },
        })
      }
      const chat_id = record.instance_date ? `instance_${record.series_id}_${record.instance_date}` : `series_${record.series_id}`;
      const { data: participants } = await supabaseClient.from('event_users').select('user_id').eq('series_id', record.series_id)
      
      const { data: sender } = await supabaseClient.from('users').select('username').eq('id', record.user_id).single()

      for (const p of participants || []) {
        if (p.user_id === record.user_id) continue;
        const { data: user } = await supabaseClient.from('users').select('notify_chat_messages').eq('id', p.user_id).single()
        const { data: muted } = await supabaseClient.from('muted_chats').select('*').eq('user_id', p.user_id).eq('chat_id', chat_id).single()
        
        if (user?.notify_chat_messages !== false && !muted) {
           const cleanMsg = record.message ? record.message.replace(/\[EVENT:[^\]]+\]/g, '').trim() : '';
           const body = `${sender?.username || 'Uživatel'}: ${cleanMsg}`;
           const title = "Nová zpráva v události";
           await notifyUser(p.user_id, title, body, { type: 'event_chat', series_id: record.series_id, instance_date: record.instance_date });
        }
      }
    }

    // 3. Osobní inbox notifikací (nahrazuje global_messages)
    if (table === 'user_notifications' && payload.type === 'INSERT') {
      const { data: user } = await supabaseClient.from('users').select('notify_global_chat').eq('id', record.recipient_id).single()
      if (user?.notify_global_chat === false) {
        return new Response(JSON.stringify({ success: true, skipped: true }), { headers: { "Content-Type": "application/json" } })
      }

      const { data: actor } = record.actor_id
        ? await supabaseClient.from('users').select('username').eq('id', record.actor_id).single()
        : { data: null }

      const cleanMsg = record.message ? record.message.replace(/\[EVENT:[^\]]+\]/g, '').trim() : '';
      const body = actor?.username ? `${actor.username} ${cleanMsg}` : cleanMsg;
      const title = record.type === 'birthday' ? 'Narozeniny' : 'Oznámení';
      await notifyUser(record.recipient_id, title, body, {
        type: 'user_notification',
        series_id: record.series_id,
        notification_type: record.type,
      });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } })
  } catch (err) {
    console.error(err)
    return new Response(String(err?.message ?? err), { status: 500 })
  }
})
