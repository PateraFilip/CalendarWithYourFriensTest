import { supabase } from '@/lib/supabaseClient';

export const updateColor = async (
  color_id: number,
  _user_id?: number | string
) => {
  // RLS kontroluje auth.uid() — ber ID ze session, ne z profilu (může se lišit)
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user?.id) {
    throw new Error('Nejsi přihlášený.');
  }
  const uid = authData.user.id;

  // Uvolni stávající barvu
  const { error: clearError } = await supabase
    .from('colors')
    .update({ user_id: null })
    .eq('user_id', uid);

  if (clearError) {
    throw new Error(clearError.message || 'Failed to clear previous color');
  }

  // Přiřaď novou (volná nebo už tvoje)
  const { data: rows, error } = await supabase
    .from('colors')
    .update({ user_id: uid })
    .eq('id', color_id)
    .select('*');

  if (error) {
    throw new Error(error.message || 'Failed to update color');
  }

  if (!rows?.length) {
    throw new Error('Barvu se nepodařilo přiřadit (možná ji má někdo jiný).');
  }

  return rows[0];
};
