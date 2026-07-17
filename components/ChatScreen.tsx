import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Platform, FlatList, ActivityIndicator, Keyboard, Dimensions, type KeyboardEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { IconSymbol } from './ui/icon-symbol';
import { useChat, ChatType, ChatMessage } from '@/hooks/useChat';
import { fetchColors } from '@/services/users/get_colors';
import dayjs from 'dayjs';
import { router } from 'expo-router';
import { useUnreadMessages } from '@/contexts/UnreadMessagesContext';
import { useIsFocused } from '@react-navigation/native';

interface ChatScreenProps {
  type: ChatType;
  series_id?: number;
  instance_date?: string;
  currentUserId: number | string;
  /** @deprecated — výška se bere z Keyboard API */
  keyboardOffset?: number;
  eventTitle?: string;
}

export default function ChatScreen({ type, series_id, instance_date, currentUserId, eventTitle }: ChatScreenProps) {
  const { messages, isLoading, sendMessage } = useChat({ type, series_id, instance_date, currentUserId, eventTitle });
  const [inputText, setInputText] = useState('');
  const [colors, setColors] = useState<any[]>([]);
  const [keyboardPad, setKeyboardPad] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const backgroundColor = useThemeColor({ light: '#fff', dark: '#151718' }, 'background');
  const textColor = useThemeColor({ light: '#11181C', dark: '#ECEDEE' }, 'text');
  const inputBgColor = useThemeColor({ light: '#f0f0f0', dark: '#2A2A2A' }, 'background');
  const otherBubbleBgColor = useThemeColor({ light: '#e6e0f8', dark: '#2A2A2A' }, 'background');

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const onShow = (e: KeyboardEvent) => {
      const h = e.endCoordinates?.height ?? 0;
      if (Platform.OS === 'android') {
        const screenH = Dimensions.get('screen').height;
        const windowH = Dimensions.get('window').height;
        const shrunk = screenH - windowH;
        // resize mode: window už sedí nad klávesnicí
        setKeyboardPad(shrunk > h * 0.45 ? 8 : Math.max(0, h - Math.min(insets.bottom, 24)));
      } else {
        setKeyboardPad(Math.max(0, h));
      }
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    };
    const onHide = () => setKeyboardPad(0);
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(showEvt, onShow);
    const b = Keyboard.addListener(hideEvt, onHide);
    return () => {
      a.remove();
      b.remove();
    };
  }, [insets.bottom]);
  
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
      const roomId = instance_date
        ? `instance-${series_id}-${dayjs(instance_date).format('YYYY-MM-DD')}`
        : `series-${series_id}`;
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
    <View
      style={[styles.container, { backgroundColor, paddingBottom: keyboardPad }]}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, index) => item.id ? item.id.toString() : `fallback-${index}`}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      />
      
      <View style={[styles.inputContainer, { backgroundColor: inputBgColor }]}>
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

    </View>
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
});
