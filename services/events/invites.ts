import { supabase } from '@/lib/supabaseClient';
import { fetchMyFriendships } from '@/services/friends/friendships';

export async function fetchEventInviteIds(seriesId: number): Promise<string[]> {
  const { data, error } = await supabase
    .from('event_invites')
    .select('user_id')
    .eq('series_id', seriesId);

  if (error) {
    console.error('fetchEventInviteIds:', error.message);
    return [];
  }
  return (data ?? []).map((r) => String(r.user_id));
}

export async function fetchInvitedSeriesIds(userId: string | number): Promise<number[]> {
  const { data, error } = await supabase
    .from('event_invites')
    .select('series_id')
    .eq('user_id', String(userId));

  if (error) {
    console.error('fetchInvitedSeriesIds:', error.message);
    return [];
  }
  return (data ?? []).map((r) => Number(r.series_id));
}

/** Default: všichni accepted přátelé (bez sebe). */
export async function getDefaultInviteIds(userId: string | number): Promise<string[]> {
  const userIdStr = String(userId);
  const friendships = await fetchMyFriendships(userIdStr);
  return friendships
    .filter((f) => f.status === 'accepted')
    .map((f) => (String(f.user_id) === userIdStr ? String(f.friend_id) : String(f.user_id)));
}

export async function setEventInvites(seriesId: number, inviteUserIds: Array<string | number>) {
  const unique = Array.from(new Set(inviteUserIds.map(String).filter(Boolean)));

  const { error: delError } = await supabase
    .from('event_invites')
    .delete()
    .eq('series_id', seriesId);

  if (delError) {
    console.error('setEventInvites delete:', delError.message);
    throw delError;
  }

  if (unique.length === 0) return;

  const { error: insError } = await supabase.from('event_invites').insert(
    unique.map((user_id) => ({ series_id: seriesId, user_id }))
  );

  if (insError) {
    console.error('setEventInvites insert:', insError.message);
    throw insError;
  }
}

export async function setEventInvitesForSeriesIds(
  seriesIds: number[],
  inviteUserIds: Array<string | number>
) {
  for (const seriesId of seriesIds) {
    await setEventInvites(seriesId, inviteUserIds);
  }
}
