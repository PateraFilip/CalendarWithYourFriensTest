import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, FlatList, ActivityIndicator, Keyboard, Modal } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { IconSymbol } from './ui/icon-symbol';
import { useChat, ChatType, ChatMessage } from '@/hooks/useChat';
import { fetchColors } from '@/services/users/get_colors';
import dayjs from 'dayjs';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabaseClient';
import { useUnreadMessages } from '@/contexts/UnreadMessagesContext';
import { useIsFocused } from '@react-navigation/native';
import { fetchEvents } from '@/services/events/get_events';
import { fetchEventsException } from '@/services/events/get_event_exceptions';
import { fetchUserEvents } from '@/services/events/getUserEvents';
import { fetchMyFriendships } from '@/services/friends/friendships';
import { getMyUpcomingEvents } from '@/lib/myEventsHelpers';

interface ChatScreenProps {
  type: ChatType;
  series_id?: number;
  instance_date?: string;
  currentUserId: number | string;
  keyboardOffset?: number;
}

export default function ChatScreen({ type, series_id, instance_date, currentUserId, keyboardOffset }: ChatScreenProps) {
  const { messages, isLoading, sendMessage } = useChat({ type, series_id, instance_date, currentUserId });
  const [inputText, setInputText] = useState('');
  const [colors, setColors] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'group' | 'personal'>('all');
  const [isAttachModalVisible, setIsAttachModalVisible] = useState(false);
  const [attachableEvents, setAttachableEvents] = useState<any[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const backgroundColor = useThemeColor({ light: '#fff', dark: '#151718' }, 'background');
  const textColor = useThemeColor({ light: '#11181C', dark: '#ECEDEE' }, 'text');
  const inputBgColor = useThemeColor({ light: '#f0f0f0', dark: '#2A2A2A' }, 'background');
  const otherBubbleBgColor = useThemeColor({ light: '#e6e0f8', dark: '#2A2A2A' }, 'background');
  
  // Scrollování dolů při nové zprávě
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const { markRoomAsRead } = useUnreadMessages();

  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      const roomId = type === 'global' ? 'global' : (instance_date ? `instance-${series_id}-${dayjs(instance_date).format('YYYY-MM-DD')}` : `series-${series_id}`);
      const lastMessageTime = messages.length > 0 ? messages[messages.length - 1].created_at : undefined;
      markRoomAsRead(roomId, lastMessageTime);
    }
  }, [isFocused, messages, type, series_id, instance_date, markRoomAsRead]);

  useEffect(() => {
    fetchColors().then(setColors).catch(console.error);
  }, []);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    await sendMessage(inputText.trim());
    setInputText('');
    Keyboard.dismiss();
  };

  const openAttachModal = async () => {
    setIsAttachModalVisible(true);
    try {
      const currentIdStr = String(currentUserId);
      const [evs, exceptions, userEv, fr, usersData, colorsData] = await Promise.all([
        fetchEvents(currentUserId, undefined, dayjs().add(1, 'year').toDate()),
        fetchEventsException(),
        fetchUserEvents(),
        fetchMyFriendships(currentIdStr),
        supabase.from('users').select('id, username'),
        fetchColors()
      ]);
      
      setUsers(usersData?.data || []);
      setColors(colorsData || []);
      
      const joinedEventIds = userEv.filter(ue => String(ue.user_id) === currentIdStr).map(ue => ue.event_id);
      const friendIds = fr.filter(f => f.status === 'accepted').map(f => String(f.user_id) === currentIdStr ? f.friend_id : f.user_id);
      const allowedIds = [currentIdStr, ...friendIds];

      const myTimeline = getMyUpcomingEvents(evs, [], exceptions, allowedIds, joinedEventIds, 365);
      
      const eventsMap = new Map();
      myTimeline.forEach(e => {
        const sId = e.id;
        const iDate = (!e.pravidelnost) ? undefined : dayjs(e.start).format('YYYY-MM-DD');
        const title = e.title;
        const key = iDate ? `instance-${sId}-${iDate}` : `series-${sId}`;
        if (!eventsMap.has(key)) {
            eventsMap.set(key, { 
                id: sId, 
                date: iDate, 
                title, 
                user_id: e.user_id, 
                is_group: e.is_group,
                event_start: dayjs(e.start).format('YYYY-MM-DD'),
                is_recurring: !!e.pravidelnost
            });
        }
      });
      const sortedEvents = Array.from(eventsMap.values()).sort((a, b) => {
        const dateA = a.date || a.event_start || '9999-12-31';
        const dateB = b.date || b.event_start || '9999-12-31';
        return dateA.localeCompare(dateB);
      });
      setAttachableEvents(sortedEvents);
    } catch(e) { console.error(e); }
  };

  const renderMessageText = (text: string, isMe: boolean, system: boolean = false) => {
    const eventRegex = /\[EVENT:(\d+):([^\]:]*):([^\]]+)\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = eventRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<ThemedText key={`text-${lastIndex}`} style={{ color: system ? '#888' : isMe ? '#fff' : textColor, fontSize: system ? 12 : undefined }}>{text.substring(lastIndex, match.index)}</ThemedText>);
      }
      
      const sId = match[1];
      const iDate = match[2];
      const title = match[3];

      parts.push(
        <TouchableOpacity 
          key={`link-${match.index}`} 
          onPress={() => {
            const params: any = { eventId: sId };
            if (iDate && iDate.trim() !== '' && iDate !== 'undefined' && iDate !== 'null') {
              params.instance_date = iDate;
            }
            router.push({ pathname: '/events/[eventId]', params });
          }}
          style={{ backgroundColor: system ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.2)', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, marginVertical: 4, borderWidth: 1, borderColor: system ? '#ccc' : isMe ? '#fff' : '#6366f1' }}
        >
          <ThemedText style={{ color: system ? (textColor as string) : isMe ? '#fff' : '#6366f1', fontWeight: 'bold', fontSize: system ? 12 : 14 }}>
            📅 {title}
          </ThemedText>
        </TouchableOpacity>
      );
      
      lastIndex = eventRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(<ThemedText key={`text-${lastIndex}`} style={{ color: system ? '#888' : isMe ? '#fff' : textColor, fontSize: system ? 12 : undefined }}>{text.substring(lastIndex)}</ThemedText>);
    }

    return <View style={{ flexDirection: system ? 'column' : 'column', alignItems: system ? 'center' : 'flex-start' }}>{parts}</View>;
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
      if (item.is_system_message) {
        return (
          <View style={{ marginVertical: 12, alignItems: 'center' }}>
            {renderMessageText(`${item.users?.username} ${item.message}`, false, true)}
          </View>
        );
      }

    const isMe = item.user_id === currentUserId;
    const timeStr = dayjs(item.created_at).format('HH:mm');
    const userColorObj = colors.find(c => c.user_id === item.user_id);
    const userColorStr = userColorObj ? userColorObj.background_color : undefined;

    return (
      <View style={[styles.messageWrapper, isMe ? styles.messageWrapperRight : styles.messageWrapperLeft]}>
        {!isMe && (
          <ThemedText style={[styles.senderName, { color: userColorStr || '#888' }]}>
            {item.users?.username || item.users?.jmeno}
          </ThemedText>
        )}
          <View style={[
            styles.bubble, 
            isMe ? styles.bubbleRight : [
              styles.bubbleLeft, 
              { backgroundColor: otherBubbleBgColor },
              userColorStr ? { borderColor: userColorStr, borderWidth: 1 } : {}
            ]
          ]}>
            {renderMessageText(item.message, isMe, false)}
            <ThemedText style={[styles.time, { color: isMe ? '#e0e0e0' : '#888' }]}>{timeStr}</ThemedText>
          </View>
      </View>
    );
  };

  if (isLoading && messages.length === 0) {
    return (
      <ThemedView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#6366f1" />
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardOffset !== undefined ? keyboardOffset : (Platform.OS === 'ios' ? 90 : 60)}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, index) => item.id ? item.id.toString() : `fallback-${index}`}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />
      
      <View style={[styles.inputContainer, { backgroundColor: inputBgColor }]}>
        <TouchableOpacity style={styles.attachButton} onPress={openAttachModal}>
          <IconSymbol name="calendar.fill" size={24} color="#888" />
        </TouchableOpacity>
        <TextInput
          style={[styles.input, { color: textColor as string }]}
          placeholder="Napište zprávu..."
          placeholderTextColor="#888"
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        <TouchableOpacity 
          style={[styles.sendButton, !inputText.trim() && { opacity: 0.5 }]} 
          onPress={handleSend}
          disabled={!inputText.trim()}
        >
          <IconSymbol name="paperplane.fill" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Modal pro výběr události k připojení */}
      {isAttachModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: backgroundColor as string, borderColor: textColor as string }]}>
            <ThemedText style={styles.modalTitle}>Připojit událost</ThemedText>
            
            {/* Filtr modalu */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 12, gap: 10 }}>
              <TouchableOpacity onPress={() => setFilterMode('all')} style={[styles.filterChip, filterMode === 'all' && styles.filterChipActive]}>
                <ThemedText style={[styles.filterChipText, filterMode === 'all' && { color: '#fff' }]}>Vše</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFilterMode('group')} style={[styles.filterChip, filterMode === 'group' && styles.filterChipActive]}>
                <ThemedText style={[styles.filterChipText, filterMode === 'group' && { color: '#fff' }]}>Skupinové</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFilterMode('personal')} style={[styles.filterChip, filterMode === 'personal' && styles.filterChipActive]}>
                <ThemedText style={[styles.filterChipText, filterMode === 'personal' && { color: '#fff' }]}>Osobní</ThemedText>
              </TouchableOpacity>
            </View>

            {attachableEvents.filter(r => filterMode === 'all' || (filterMode === 'group' ? r.is_group : !r.is_group)).length === 0 ? (
              <ThemedText style={{ opacity: 0.6, marginBottom: 20 }}>Nenašli jsme žádné události.</ThemedText>
            ) : (
              <FlatList
                data={attachableEvents.filter(r => filterMode === 'all' || (filterMode === 'group' ? r.is_group : !r.is_group))}
                keyExtractor={item => `${item.id}-${item.date || 'none'}`}
                style={{ maxHeight: 300, width: '100%' }}
                renderItem={({ item }) => {
                  const owner = users.find(u => String(u.id) === String(item.user_id));
                  const ownerName = owner ? owner.username : 'Neznámý';
                  const userColorInfo = colors.find(c => String(c.user_id) === String(item.user_id));
                  const userColor = userColorInfo ? userColorInfo.background_color : '#FF00AA';
                  const isGroup = item.is_group;
                  const itemBorderColor = isGroup ? '#FF00AA' : userColor;
                  const itemBgColor = isGroup ? 'rgba(255,0,170,0.1)' : `${userColor}1A`;

                  return (
                    <TouchableOpacity 
                      style={[styles.roomItem, { borderLeftWidth: 4, borderLeftColor: itemBorderColor, backgroundColor: itemBgColor, marginBottom: 8, borderRadius: 6, borderBottomWidth: 0 }]} 
                      onPress={() => {
                          const evtCode = `[EVENT:${item.id}:${item.date || ''}:${item.title}]`;
                          setInputText(prev => prev + (prev.length > 0 && !prev.endsWith(' ') ? ' ' : '') + evtCode);
                          setIsAttachModalVisible(false);
                      }}
                    >
                      <ThemedText style={styles.roomTitle}>{item.title}</ThemedText>
                      <ThemedText style={{ fontSize: 12, opacity: 0.8, color: isGroup ? '#FF00AA' : userColor, fontWeight: 'bold' }}>
                          {isGroup ? 'Skupinová událost' : `Od: ${ownerName}`}
                      </ThemedText>
                      <ThemedText style={[styles.roomType, { marginTop: 4 }]}>
                        {item.date 
                           ? dayjs(item.date).format('D. M. YYYY') 
                           : (!item.is_recurring && item.event_start ? dayjs(item.event_start).format('D. M. YYYY') : 'Obecný chat události')}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
            <TouchableOpacity 
              style={[styles.closeButton, { borderColor: textColor as string }]} 
              onPress={() => setIsAttachModalVisible(false)}
            >
              <ThemedText style={{ color: '#FF00AA' }}>Zrušit</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      )}

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 20,
  },
  messageWrapper: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  messageWrapperLeft: {
    alignSelf: 'flex-start',
  },
  messageWrapperRight: {
    alignSelf: 'flex-end',
  },
  senderName: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
    marginLeft: 4,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 80,
  },
  bubbleLeft: {
    borderBottomLeftRadius: 4,
  },
  bubbleRight: {
    backgroundColor: '#6366f1',
    borderBottomRightRadius: 4,
  },
  time: {
    fontSize: 10,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    alignItems: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 20,
    marginRight: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachButton: {
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    width: '85%',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FF00AA',
  },
  filterChipActive: {
    backgroundColor: '#FF00AA',
  },
  filterChipText: {
    fontSize: 13,
    color: '#FF00AA',
  },
  closeButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
  },
  roomItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    width: '100%'
  },
  roomTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  roomType: {
    fontSize: 13,
    color: '#888',
  }
});
