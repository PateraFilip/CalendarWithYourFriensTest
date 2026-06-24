import { supabase } from '@/lib/supabaseClient';

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export const fetchMyFriendships = async (userId: string) => {
  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

  if (error) {
    console.error('Error fetching friendships:', error);
    return [];
  }
  return data as Friendship[];
};

export const sendFriendRequest = async (userId: string, friendId: string) => {
  const { error } = await supabase
    .from('friendships')
    .insert([{
      user_id: userId,
      friend_id: friendId,
      status: 'pending'
    }]);

  if (error) throw error;
  return true;
};

export const acceptFriendRequest = async (friendshipId: string) => {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId);

  if (error) throw error;
  return true;
};

export const rejectFriendRequest = async (friendshipId: string) => {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendshipId);

  if (error) throw error;
  return true;
};

export const removeFriend = async (friendshipId: string) => {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendshipId);

  if (error) throw error;
  return true;
};
