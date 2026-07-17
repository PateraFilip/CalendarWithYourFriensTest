import { supabase } from '@/lib/supabaseClient';

/** Uloží FCM token pod auth.uid() (RPC — obejde konflikt RLS při upsertu). */
export async function saveFcmTokenToSupabase(token: string): Promise<boolean> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user?.id) {
    console.error('[push] Nelze uložit token — nejsi přihlášen:', authError?.message);
    return false;
  }

  const { error } = await supabase.rpc('register_fcm_token', { p_token: token });

  if (error) {
    // Fallback bez RPC (starší DB): smaž vlastní + insert
    console.warn('[push] RPC register_fcm_token selhalo, zkouším fallback:', error.message);

    await supabase.from('user_devices').delete().eq('user_id', authData.user.id).eq('fcm_token', token);

    const { error: delTokenErr } = await supabase
      .from('user_devices')
      .delete()
      .eq('fcm_token', token);

    if (delTokenErr) {
      // nemáme právo smazat cizí řádek — zkus aspoň insert (selže na UNIQUE)
      console.warn('[push] Nelze smazat starý token:', delTokenErr.message);
    }

    const { error: insertError } = await supabase.from('user_devices').insert({
      user_id: authData.user.id,
      fcm_token: token,
    });

    if (insertError) {
      console.error('Chyba při ukládání tokenu:', insertError);
      return false;
    }
  }

  console.log('Token uložen ✅');
  return true;
}
