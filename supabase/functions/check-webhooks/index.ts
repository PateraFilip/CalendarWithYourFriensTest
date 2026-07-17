import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

/** Diagnostika webhooků / triggerů pro notifikace (ne global_messages). */
serve(async (req) => {
  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const authHeader = req.headers.get("Authorization") ?? ""
    if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceKey
    )

    const { data, error } = await supabaseClient.rpc("exec_sql", {
      sql: `
        SELECT event_object_table AS table_name, trigger_name, action_statement
        FROM information_schema.triggers
        WHERE event_object_table IN ('user_notifications', 'event_messages', 'friendships');
      `,
    })

    if (error) {
      // Fallback bez exec_sql: vrať hint
      return new Response(
        JSON.stringify({
          error,
          hint: "Očekávané tabulky webhooků: user_notifications, event_messages, friendships",
        }),
        { headers: { "Content-Type": "application/json" } }
      )
    }

    return new Response(JSON.stringify({ data }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(String((err as Error)?.message ?? err), { status: 500 })
  }
})
