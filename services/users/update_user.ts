import { supabase } from '@/lib/supabaseClient';

export interface UpdateUserData {
  username?: string;
  jmeno?: string;
  prijmeni?: string;
  email?: string;
  notify_friend_requests?: boolean;
  notify_chat_messages?: boolean;
  notify_global_chat?: boolean;
}

export const updateUser = async (
  userId: string | number,
  data: UpdateUserData
) => {
  if (data.email) {
    const { error: authError } = await supabase.auth.updateUser({
      email: data.email,
    });
    if (authError) {
      console.error('Error updating auth email:', authError);
      throw new Error(
        'Nelze změnit přihlašovací e-mail. Je validní a nepoužívá ho už někdo?'
      );
    }
  }

  const payload = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  ) as UpdateUserData;

  if (Object.keys(payload).length === 0) return null;

  // Bez .single() — po UPDATE může RLS skrýt řádek a .single() hodí
  // „Cannot coerce the result to a single JSON object“.
  const { data: rows, error } = await supabase
    .from('users')
    .update(payload)
    .eq('id', String(userId))
    .select('*');

  if (error) {
    console.error('Error updating user:', error);
    throw error;
  }

  return rows?.[0] ?? null;
};
