import React, { useCallback, useEffect, useState } from 'react';
import { Alert, TouchableOpacity } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { ThemedText } from '@/components/themed-text';
import { ParticipantsDialog, SelectableUserId } from '@/components/ParticipantsDialog';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/lib/supabaseClient';
import { fetchMyFriendships } from '@/services/friends/friendships';
import {
  addFriendsToEventChat,
  fetchChatParticipantIds,
} from '@/services/events/addFriendsToChat';
import { useAppDataOptional } from '@/contexts/AppDataContext';

type Props = {
  seriesId: number;
  instanceDate?: string;
  currentUserId: string | number;
  eventTitle?: string;
};

export default function AddFriendsToChatButton({
  seriesId,
  instanceDate,
  currentUserId,
  eventTitle,
}: Props) {
  const [isOwner, setIsOwner] = useState(false);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [friendUsers, setFriendUsers] = useState<any[]>([]);
  const [selected, setSelected] = useState<SelectableUserId[]>([]);
  const [alreadyIn, setAlreadyIn] = useState<Set<string>>(new Set());

  const buttonColor = useThemeColor({ light: '#00AAFF', dark: '#00AAFF' }, 'tint');
  const cardBackgroundColor = useThemeColor(
    { light: '#fff', dark: '#1e1e1e' },
    'background'
  );
  const appData = useAppDataOptional();

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from('event_series')
        .select('zakladatel_id')
        .eq('id', seriesId)
        .maybeSingle();
      if (mounted) {
        setIsOwner(String(data?.zakladatel_id) === String(currentUserId));
      }
    })();
    return () => {
      mounted = false;
    };
  }, [seriesId, currentUserId]);

  const openDialog = useCallback(async () => {
    setLoading(true);
    setVisible(true);
    try {
      const me = String(currentUserId);
      const [fr, participantIds, usersRes] = await Promise.all([
        fetchMyFriendships(me),
        fetchChatParticipantIds(seriesId, instanceDate || null),
        appData?.users?.length
          ? Promise.resolve({ data: appData.users })
          : supabase.from('users').select('id, username, jmeno, prijmeni'),
      ]);

      const friendIds = fr
        .filter((f) => f.status === 'accepted')
        .map((f) => (String(f.user_id) === me ? String(f.friend_id) : String(f.user_id)));

      const friendIdSet = new Set(friendIds);
      const friends = (usersRes.data || []).filter((u: any) =>
        friendIdSet.has(String(u.id))
      );

      const inChat = new Set(participantIds);
      // Zakladatel je vždy „v chatu“
      inChat.add(me);

      setAlreadyIn(inChat);
      setFriendUsers(friends);
      setSelected(friends.filter((u: any) => inChat.has(String(u.id))).map((u: any) => u.id));
    } catch (e) {
      console.error(e);
      Alert.alert('Chyba', 'Nepodařilo se načíst přátele.');
      setVisible(false);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, seriesId, instanceDate, appData?.users]);

  const handleConfirm = async () => {
    const newlySelected = selected
      .map(String)
      .filter((id) => !alreadyIn.has(id));

    if (newlySelected.length === 0) {
      setVisible(false);
      return;
    }

    setSaving(true);
    try {
      const { added } = await addFriendsToEventChat({
        seriesId,
        instanceDate: instanceDate || null,
        friendIds: newlySelected,
        actorId: currentUserId,
        eventTitle,
      });
      setVisible(false);
      void appData?.refreshTimeline?.(false);
      if (added.length > 0) {
        Alert.alert(
          'Hotovo',
          added.length === 1
            ? 'Přítel byl přidán do chatu.'
            : `Přidáno ${added.length} přátel do chatu.`
        );
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert('Chyba', e?.message || 'Nepodařilo se přidat přátele.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOwner) return null;

  return (
    <>
      <TouchableOpacity
        onPress={openDialog}
        disabled={loading || saving}
        style={{ marginRight: 12, paddingVertical: 4 }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={buttonColor as string} />
        ) : (
          <ThemedText style={{ color: buttonColor as string }}>Přidat</ThemedText>
        )}
      </TouchableOpacity>

      <ParticipantsDialog
        visible={visible && !loading}
        onDismiss={() => {
          if (!saving) setVisible(false);
        }}
        users={friendUsers}
        currentUserId={currentUserId}
        selectedParticipants={selected}
        setSelectedParticipants={setSelected}
        title="Přidat přátele do chatu"
        buttonColor={buttonColor as string}
        cardBackgroundColor={cardBackgroundColor as string}
        onConfirm={handleConfirm}
        confirmLabel="Přidat"
        confirmLoading={saving}
        emptyText="Nemáš žádné přátele k přidání."
      />
    </>
  );
}
