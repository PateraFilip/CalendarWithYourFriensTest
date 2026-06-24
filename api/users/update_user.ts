import { supabase } from '@/lib/supabaseClient';

export interface UpdateUserData {
  username?: string;
  jmeno?: string;
  prijmeni?: string;
  email?: string;
}

export const updateUser = async (userId: string | number, data: UpdateUserData) => {
  // Aktualizace v Auth (pokud se mění email)
  if (data.email) {
    const { error: authError } = await supabase.auth.updateUser({ email: data.email });
    if (authError) {
      console.error('Error updating auth email:', authError);
      throw new Error('Nelze změnit přihlašovací e-mail. Je validní a nepoužívá ho už někdo?');
    }
  }

  // Aktualizace v public tabulce
  const { data: updatedUser, error } = await supabase
    .from('users')
    .update(data)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating user:', error);
    throw error;
  }

  return updatedUser;
};
