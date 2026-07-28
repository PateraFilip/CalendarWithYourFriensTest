import { createEvent, createMultiDateEvent, createPatternEvent } from '@/services/events/create_event';
import { fetchUsers } from '@/services/users/get_users';
import { joinEvent } from '@/services/events/join_event';
import { getDefaultInviteIds } from '@/services/events/invites';
import { fetchMyFriendships } from '@/services/friends/friendships';
import { ThemedText } from '@/components/themed-text';
import { KeyboardScreen } from '@/components/KeyboardScreen';
import { Brand } from '@/constants/brand';
import { useAppData } from '@/contexts/AppDataContext';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/useAuth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import 'dayjs/locale/cs';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  LogBox,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { LocaleConfig } from 'react-native-calendars';
import {
  IconButton,
} from 'react-native-paper';
import {
  DatePickerModal,
  TimePickerModal,
  cs,
  registerTranslation,
} from 'react-native-paper-dates';
import { FormChip, WhenRow } from '@/components/formUi';
import { LocationAutocomplete } from './LocationAutocomplete';
import { ParticipantsDialog, SelectableUserId } from './ParticipantsDialog';

LogBox.ignoreLogs(['VirtualizedLists should never be nested']);

LocaleConfig.locales['cs'] = {
  monthNames: [
    'Leden',
    'Únor',
    'Březen',
    'Duben',
    'Květen',
    'Červen',
    'Červenec',
    'Srpen',
    'Září',
    'Říjen',
    'Listopad',
    'Prosinec',
  ],
  monthNamesShort: [
    'Led',
    'Úno',
    'Bře',
    'Dub',
    'Kvě',
    'Čer',
    'Čvc',
    'Srp',
    'Zář',
    'Říj',
    'Lis',
    'Pro',
  ],
  dayNames: [
    'Neděle',
    'Pondělí',
    'Úterý',
    'Středa',
    'Čtvrtek',
    'Pátek',
    'Sobota',
  ],
  dayNamesShort: ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'],
  today: 'Dnes',
};
LocaleConfig.defaultLocale = 'cs';

dayjs.locale('cs');
registerTranslation('cs', cs);

interface EventCreateFormProps {
  pickedDate?: string | Date;
  onSuccess?: () => void;
}

interface PatternSegment {
  id: string;
  type: 'work' | 'off';
  days: number;
  startTime?: Date;
  endTime?: Date;
}

type EventMode = 'once' | 'monthly' | 'pattern';

export function EventCreateForm({ pickedDate, onSuccess }: EventCreateFormProps) {
  const [name, setName] = useState('');
  const [poloha, setPoloha] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [isGroup, setIsGroup] = useState(false);
  const [peopleCount, setPeopleCount] = useState(2);
  const { user } = useAuth();
  const { colors } = useAppData();

  const [eventMode, setEventMode] = useState<EventMode>('once');

  const [dateRange, setDateRange] = useState<{
    startDate?: Date;
    endDate?: Date;
  }>({});
  const [timeRange, setTimeRange] = useState<{ start?: Date; end?: Date }>({});

  const [multiDates, setMultiDates] = useState<Date[]>([]);
  const [multiTimes, setMultiTimes] = useState<
    Record<string, { start?: Date; end?: Date }>
  >({});
  const [editingMultiDate, setEditingMultiDate] = useState<string | null>(null);

  const [patternStartDate, setPatternStartDate] = useState<Date | undefined>();
  const [patternEndDate, setPatternEndDate] = useState<Date | undefined>();
  const [patternSegments, setPatternSegments] = useState<PatternSegment[]>([
    {
      id: '1',
      type: 'work',
      days: 2,
      startTime: dayjs().hour(8).minute(0).toDate(),
      endTime: dayjs().hour(16).minute(0).toDate(),
    },
    { id: '2', type: 'off', days: 1 },
  ]);
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [multiDateModalVisible, setMultiDateModalVisible] = useState(false);
  const [patternStartDateModalVisible, setPatternStartDateModalVisible] =
    useState(false);
  const [patternEndDateModalVisible, setPatternEndDateModalVisible] =
    useState(false);

  const [timeModalVisible, setTimeModalVisible] = useState(false);
  const [timeStep, setTimeStep] = useState<'start' | 'end'>('start');
  const [timeContext, setTimeContext] = useState<
    'once' | 'multi' | 'patternSegment'
  >('once');

  const [selectedInvites, setSelectedInvites] = useState<SelectableUserId[]>(
    []
  );
  const [selectedParticipants, setSelectedParticipants] = useState<
    SelectableUserId[]
  >([]);
  const [friendUsers, setFriendUsers] = useState<any[]>([]);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [participantModalVisible, setParticipantModalVisible] = useState(false);

  const buttonTextColor = Brand.onPrimary;
  const cardBackgroundColor = useThemeColor(
    { light: '#f5f5f5', dark: '#2c2c2e' },
    'background'
  );
  const borderColorTheme = useThemeColor(
    { light: '#e5e5ea', dark: '#38383a' },
    'border'
  );
  const secondaryTextColor = useThemeColor(
    { light: '#5f6368', dark: '#9aa0a6' },
    'text'
  );
  const textColor = useThemeColor({}, 'text');
  const chipInactive = useThemeColor(
    { light: '#3c4043', dark: '#E8EAED' },
    'text'
  );
  const chipInactiveBorder = useThemeColor(
    { light: '#80868b', dark: '#BDC1C6' },
    'text'
  );

  const userColor = useMemo(() => {
    const c = colors.find(
      (x) => x != null && String(x.user_id) === String(user?.id)
    );
    return c?.background_color || Brand.primary;
  }, [colors, user?.id]);

  /** Accent: barva uživatele / magenta u skupiny */
  const barColor = isGroup ? Brand.groupEvent : userColor;

  const resetForm = () => {
    setName('');
    setPoloha('');
    setLatitude(null);
    setLongitude(null);
    setPeopleCount(2);
    setDateRange({});
    setTimeRange({});
    setMultiDates([]);
    setMultiTimes({});
    setPatternStartDate(undefined);
    setPatternEndDate(undefined);
    setPatternSegments([
      {
        id: Math.random().toString(),
        type: 'work',
        days: 2,
        startTime: dayjs().hour(8).minute(0).toDate(),
        endTime: dayjs().hour(16).minute(0).toDate(),
      },
      { id: Math.random().toString(), type: 'off', days: 1 },
    ]);
    setIsGroup(false);
    setEventMode('once');
    setSelectedInvites([]);
    setSelectedParticipants([]);
  };

  useEffect(() => {
    if (!pickedDate) {
      setDateRange({});
      setTimeRange({});
      setPatternStartDate(undefined);
      setMultiDates([]);
      setMultiTimes({});
      return;
    }
    const dateStr =
      typeof pickedDate === 'string' ? pickedDate : pickedDate.toISOString();
    const start = new Date(dateStr);
    if (Number.isNaN(start.getTime())) {
      setDateRange({});
      setTimeRange({});
      return;
    }
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    setDateRange({ startDate: start, endDate: end });
    setTimeRange({ start, end });
    setPatternStartDate(start);
    setMultiDates([start]);
  }, [pickedDate]);

  useEffect(() => {
    const loadFriends = async () => {
      if (!user?.id) return;
      try {
        const [allUsers, defaultInvites] = await Promise.all([
          fetchUsers(),
          getDefaultInviteIds(user.id),
        ]);
        const friendships = await fetchMyFriendships(String(user.id));
        const friendIdSet = new Set(
          friendships
            .filter((f) => f.status === 'accepted')
            .map((f) =>
              String(f.user_id) === String(user.id)
                ? String(f.friend_id)
                : String(f.user_id)
            )
        );
        setFriendUsers(
          allUsers.filter((u: any) => friendIdSet.has(String(u.id)))
        );
        setSelectedInvites(defaultInvites);
      } catch (err) {
        console.error(err);
      }
    };
    loadFriends();
  }, [user?.id]);

  useEffect(() => {
    const inviteSet = new Set(selectedInvites.map(String));
    setSelectedParticipants((prev) =>
      prev.filter((id) => inviteSet.has(String(id)))
    );
  }, [selectedInvites]);

  const increase = () => setPeopleCount((prev) => prev + 1);
  const decrease = () =>
    setPeopleCount((prev) => {
      const minAllowed = selectedParticipants.length + 1;
      const nextCount = prev > 2 ? prev - 1 : 2;
      return nextCount >= minAllowed ? nextCount : prev;
    });

  const assignParticipants = async (eventId: number) => {
    if (!eventId || !user?.id) return;
    await joinEvent({
      user_id: String(user.id),
      event_id: eventId,
      instance_date: undefined,
      skipNotify: true,
    });
    for (const participantId of selectedParticipants) {
      await joinEvent({
        user_id: String(participantId),
        event_id: eventId,
        instance_date: undefined,
        skipNotify: true,
      });
    }
  };

  const formatTime = (d?: Date) => (d ? dayjs(d).format('H:mm') : '');
  const formatWhen = (date?: Date, time?: Date) => {
    if (!date && !time) return 'Vyber datum a čas';
    const d = date || time;
    const t = time || date;
    if (!d || !t) return 'Vyber datum a čas';
    return `${dayjs(d)
      .format('ddd D. M.')
      .replace(/\.$/, '')
      .replace(/^./, (c) => c.toUpperCase())} · ${dayjs(t).format('H:mm')}`;
  };

  const handleCreate = async () => {
    if (!user?.id || !name.trim() || creating) return;
    const finalIsGroup = isGroup;
    const finalPeopleCount = isGroup ? peopleCount : 1;

    setCreating(true);
    try {
      if (eventMode === 'once') {
        if (!dateRange.startDate || !timeRange.start) return;
        const start = new Date(dateRange.startDate);
        start.setHours(
          timeRange.start.getHours(),
          timeRange.start.getMinutes()
        );
        const end = dateRange.endDate
          ? new Date(dateRange.endDate)
          : new Date(start);
        if (timeRange.end)
          end.setHours(timeRange.end.getHours(), timeRange.end.getMinutes());

        const result = await createEvent({
          title: name,
          poloha,
          latitude,
          longitude,
          user_id: user.id,
          start,
          end,
          peopleCount: finalPeopleCount,
          pravidelnost: false,
          is_group: finalIsGroup,
          inviteUserIds: finalIsGroup ? selectedInvites : undefined,
        });
        const eventId = result?.data?.[0]?.id || result?.id;
        if (finalIsGroup) await assignParticipants(eventId);
      } else if (eventMode === 'monthly') {
        const result = await createMultiDateEvent({
          title: name,
          poloha,
          latitude,
          longitude,
          user_id: user.id,
          dates: multiDates,
          times: multiTimes,
          is_group: finalIsGroup,
          peopleCount: finalPeopleCount,
          inviteUserIds: finalIsGroup ? selectedInvites : undefined,
        });
        if (finalIsGroup && result?.[0]?.id) {
          for (const event of result) {
            await assignParticipants(event.id);
          }
        }
      } else if (eventMode === 'pattern') {
        const pattern = [];
        let cycleDays = 0;

        patternSegments.forEach((segment) => {
          const sTime = segment.startTime
            ? formatTime(segment.startTime)
            : '08:00';
          const eTime = segment.endTime
            ? formatTime(segment.endTime)
            : '16:00';

          for (let i = 0; i < segment.days; i++) {
            if (segment.type === 'work') {
              pattern.push({ work: true, start: sTime, end: eTime });
            } else {
              pattern.push({ work: false });
            }
            cycleDays++;
          }
        });

        if (cycleDays === 0) return;

        const firstWorkSegment = patternSegments.find((s) => s.type === 'work');

        const result = await createPatternEvent({
          title: name,
          poloha,
          latitude,
          longitude,
          user_id: user.id,
          anchor_date: patternStartDate || new Date(),
          valid_until: patternEndDate
            ? dayjs(patternEndDate).format('YYYY-MM-DD')
            : undefined,
          cycle_days: cycleDays,
          pattern,
          cas_od: firstWorkSegment?.startTime
            ? formatTime(firstWorkSegment.startTime)
            : '08:00',
          cas_do: firstWorkSegment?.endTime
            ? formatTime(firstWorkSegment.endTime)
            : '16:00',
          is_group: finalIsGroup,
          peopleCount: finalPeopleCount,
          inviteUserIds: finalIsGroup ? selectedInvites : undefined,
        });
        const eventId = result?.id || result?.data?.[0]?.id;
        if (finalIsGroup) await assignParticipants(eventId);
      }

      resetForm();
      onSuccess?.();
    } catch (err) {
      console.error('Chyba při vytváření události:', err);
    } finally {
      setCreating(false);
    }
  };

  const isDisabled = (() => {
    if (creating) return true;
    if (!name.trim()) return true;
    if (eventMode === 'once')
      return !dateRange.startDate || !timeRange.start || !timeRange.end;
    if (eventMode === 'monthly')
      return (
        multiDates.length === 0 ||
        multiDates.some((d) => {
          const t = multiTimes[dayjs(d).format('YYYY-MM-DD')];
          return !t || !t.start || !t.end;
        })
      );
    if (eventMode === 'pattern') {
      if (!patternStartDate || patternSegments.length === 0) return true;
      return patternSegments.some(
        (s) =>
          s.days <= 0 || (s.type === 'work' && (!s.startTime || !s.endTime))
      );
    }
    return false;
  })();

  const addSegment = (type: 'work' | 'off') => {
    setPatternSegments((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        type,
        days: 1,
        startTime:
          type === 'work' ? dayjs().hour(8).minute(0).toDate() : undefined,
        endTime:
          type === 'work' ? dayjs().hour(16).minute(0).toDate() : undefined,
      },
    ]);
  };

  const bumpSegmentDays = (id: string, delta: number) => {
    setPatternSegments((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, days: Math.max(1, s.days + delta) } : s
      )
    );
  };

  const removeSegment = (id: string) => {
    setPatternSegments((prev) => prev.filter((s) => s.id !== id));
  };

  const cycleDaysTotal = patternSegments.reduce((sum, s) => sum + (s.days || 0), 0);

  const openOnceTime = (step: 'start' | 'end') => {
    if (!dateRange.startDate) {
      setDateModalVisible(true);
      return;
    }
    setTimeContext('once');
    setTimeStep(step);
    setTimeModalVisible(true);
  };

  const handleTimeConfirm = ({
    hours,
    minutes,
  }: {
    hours: number;
    minutes: number;
  }) => {
    const newTime = new Date();
    newTime.setHours(hours, minutes, 0, 0);

    if (timeContext === 'once') {
      if (timeStep === 'start') {
        const end = new Date(newTime.getTime() + 60 * 60 * 1000);
        setTimeRange({ start: newTime, end: timeRange.end || end });
        setTimeStep('end');
        setTimeout(() => setTimeModalVisible(true), 100);
      } else {
        setTimeRange((prev) => ({ ...prev, end: newTime }));
        setTimeModalVisible(false);
      }
    } else if (timeContext === 'multi' && editingMultiDate) {
      const currentObj = multiTimes[editingMultiDate] || {};

      if (timeStep === 'start') {
        const end =
          currentObj.end || new Date(newTime.getTime() + 60 * 60 * 1000);
        const updatedTimes = {
          ...multiTimes,
          [editingMultiDate]: { start: newTime, end },
        };

        multiDates.forEach((d) => {
          const str = dayjs(d).format('YYYY-MM-DD');
          if (
            !updatedTimes[str] ||
            (!updatedTimes[str].start && !updatedTimes[str].end)
          ) {
            updatedTimes[str] = { start: newTime, end };
          }
        });

        setMultiTimes(updatedTimes);
        setTimeStep('end');
        setTimeout(() => setTimeModalVisible(true), 100);
      } else {
        setMultiTimes((prev) => ({
          ...prev,
          [editingMultiDate]: { ...currentObj, end: newTime },
        }));
        setTimeModalVisible(false);
        setEditingMultiDate(null);
      }
    } else if (timeContext === 'patternSegment' && editingSegmentId) {
      setPatternSegments((prev) =>
        prev.map((s) => {
          if (s.id === editingSegmentId) {
            if (timeStep === 'start') {
              return {
                ...s,
                startTime: newTime,
                endTime: s.endTime || new Date(newTime.getTime() + 3600000),
              };
            }
            return { ...s, endTime: newTime };
          }
          return s;
        })
      );

      if (timeStep === 'start') {
        setTimeStep('end');
        setTimeout(() => setTimeModalVisible(true), 100);
      } else {
        setTimeModalVisible(false);
        setEditingSegmentId(null);
      }
    }
  };

  const pickerHours = useMemo(() => {
    if (timeContext === 'once') {
      const t = timeStep === 'start' ? timeRange.start : timeRange.end;
      return t ? t.getHours() : 8;
    }
    if (timeContext === 'multi' && editingMultiDate) {
      const t = multiTimes[editingMultiDate];
      const d = timeStep === 'start' ? t?.start : t?.end;
      return d ? d.getHours() : 8;
    }
    if (timeContext === 'patternSegment' && editingSegmentId) {
      const s = patternSegments.find((x) => x.id === editingSegmentId);
      const d = timeStep === 'start' ? s?.startTime : s?.endTime;
      return d ? d.getHours() : 8;
    }
    return 8;
  }, [
    timeContext,
    timeStep,
    timeRange,
    multiTimes,
    editingMultiDate,
    patternSegments,
    editingSegmentId,
  ]);

  const pickerMinutes = useMemo(() => {
    if (timeContext === 'once') {
      const t = timeStep === 'start' ? timeRange.start : timeRange.end;
      return t ? t.getMinutes() : 0;
    }
    if (timeContext === 'multi' && editingMultiDate) {
      const t = multiTimes[editingMultiDate];
      const d = timeStep === 'start' ? t?.start : t?.end;
      return d ? d.getMinutes() : 0;
    }
    if (timeContext === 'patternSegment' && editingSegmentId) {
      const s = patternSegments.find((x) => x.id === editingSegmentId);
      const d = timeStep === 'start' ? s?.startTime : s?.endTime;
      return d ? d.getMinutes() : 0;
    }
    return 0;
  }, [
    timeContext,
    timeStep,
    timeRange,
    multiTimes,
    editingMultiDate,
    patternSegments,
    editingSegmentId,
  ]);

  const setGroup = async (value: boolean) => {
    setIsGroup(value);
    if (value && user?.id) {
      setSelectedInvites(await getDefaultInviteIds(user.id));
    } else {
      setSelectedInvites([]);
      setSelectedParticipants([]);
    }
  };

  return (
    <KeyboardScreen scroll={false}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        <RNTextInput
          value={name}
          onChangeText={setName}
          placeholder="Název události"
          placeholderTextColor={secondaryTextColor}
          style={[
            styles.titleInput,
            { color: textColor, borderBottomColor: borderColorTheme },
          ]}
          autoFocus={!name}
        />

        <View style={styles.chipRow}>
          <FormChip
            label="Soukromá"
            active={!isGroup}
            onPress={() => void setGroup(false)}
            activeColor={userColor}
            inactiveColor={chipInactive}
            inactiveBorder={chipInactiveBorder}
          />
          <FormChip
            label="Skupinová"
            active={isGroup}
            onPress={() => void setGroup(true)}
            activeColor={Brand.groupEvent}
            inactiveColor={chipInactive}
            inactiveBorder={chipInactiveBorder}
          />
        </View>

        <View style={styles.chipRow}>
          <FormChip
            label="Jednorázová"
            active={eventMode === 'once'}
            onPress={() => setEventMode('once')}
            activeColor={barColor}
            inactiveColor={chipInactive}
            inactiveBorder={chipInactiveBorder}
          />
          <FormChip
            label="Více dnů"
            active={eventMode === 'monthly'}
            onPress={() => setEventMode('monthly')}
            activeColor={barColor}
            inactiveColor={chipInactive}
            inactiveBorder={chipInactiveBorder}
          />
          <FormChip
            label="Cyklus"
            active={eventMode === 'pattern'}
            onPress={() => setEventMode('pattern')}
            activeColor={barColor}
            inactiveColor={chipInactive}
            inactiveBorder={chipInactiveBorder}
          />
        </View>

        {eventMode === 'once' && (
          <View style={styles.whenBlock}>
            <WhenRow
              label="Od"
              value={formatWhen(dateRange.startDate, timeRange.start)}
              onPress={() => openOnceTime('start')}
              onPressCalendar={() => setDateModalVisible(true)}
              barColor={barColor}
              secondary={secondaryTextColor}
              borderColor={borderColorTheme}
            />
            <WhenRow
              label="Do"
              value={formatWhen(
                dateRange.endDate || dateRange.startDate,
                timeRange.end
              )}
              onPress={() => openOnceTime('end')}
              onPressCalendar={() => setDateModalVisible(true)}
              barColor={barColor}
              secondary={secondaryTextColor}
              borderColor={borderColorTheme}
            />
            <DatePickerModal
              locale="cs"
              mode="range"
              startWeekOnMonday
              visible={dateModalVisible}
              onDismiss={() => setDateModalVisible(false)}
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
              onConfirm={({ startDate, endDate }) => {
                setDateModalVisible(false);
                setDateRange({
                  startDate,
                  endDate: endDate || startDate,
                });
                if (!timeRange.start && startDate) {
                  const s = dayjs(startDate).hour(9).minute(0).toDate();
                  const e = dayjs(startDate).hour(10).minute(0).toDate();
                  setTimeRange({ start: s, end: e });
                }
              }}
              label="Vyberte datum od - do"
              saveLabel="Uložit"
              startLabel="Od"
              endLabel="Do"
            />
          </View>
        )}

        {eventMode === 'monthly' && (
          <View style={styles.section}>
            <Pressable
              onPress={() => setMultiDateModalVisible(true)}
              style={[
                styles.selectBtn,
                { borderColor: barColor, backgroundColor: `${barColor}14` },
              ]}
            >
              <MaterialCommunityIcons
                name="calendar-multiselect"
                size={20}
                color={barColor}
              />
              <ThemedText style={{ color: barColor, fontWeight: '700' }}>
                Vybrat dny ({multiDates.length})
              </ThemedText>
            </Pressable>
            <DatePickerModal
              locale="cs"
              mode="multiple"
              startWeekOnMonday
              visible={multiDateModalVisible}
              onDismiss={() => setMultiDateModalVisible(false)}
              dates={multiDates}
              onConfirm={(params) => {
                setMultiDateModalVisible(false);
                setMultiDates(params.dates || []);
              }}
              label="Vyberte dny konání"
              saveLabel="Uložit"
            />
            {multiDates.length > 0 && (
              <View style={{ gap: 4, marginTop: 8 }}>
                <ThemedText
                  style={{
                    fontSize: 12,
                    color: secondaryTextColor,
                    marginBottom: 4,
                  }}
                >
                  Čas u jednoho dne se doplní i prázdným dnům.
                </ThemedText>
                {[...multiDates]
                  .sort((a, b) => a.getTime() - b.getTime())
                  .map((d) => {
                    const dStr = dayjs(d).format('YYYY-MM-DD');
                    const t = multiTimes[dStr];
                    return (
                      <View
                        key={dStr}
                        style={[
                          styles.multiDayRow,
                          { backgroundColor: cardBackgroundColor },
                        ]}
                      >
                        <ThemedText style={styles.multiDayDate}>
                          {dayjs(d)
                            .format('ddd D. M.')
                            .replace(/\.$/, '')
                            .replace(/^./, (c) => c.toUpperCase())}
                        </ThemedText>
                        <Pressable
                          style={styles.multiTimeTap}
                          onPress={() => {
                            setEditingMultiDate(dStr);
                            setTimeContext('multi');
                            setTimeStep('start');
                            setTimeModalVisible(true);
                          }}
                        >
                          <ThemedText style={{ fontWeight: '600' }}>
                            {t?.start ? formatTime(t.start) : 'Od'}
                          </ThemedText>
                        </Pressable>
                        <ThemedText style={{ color: secondaryTextColor }}>
                          –
                        </ThemedText>
                        <Pressable
                          style={styles.multiTimeTap}
                          onPress={() => {
                            setEditingMultiDate(dStr);
                            setTimeContext('multi');
                            setTimeStep('end');
                            setTimeModalVisible(true);
                          }}
                        >
                          <ThemedText style={{ fontWeight: '600' }}>
                            {t?.end ? formatTime(t.end) : 'Do'}
                          </ThemedText>
                        </Pressable>
                      </View>
                    );
                  })}
              </View>
            )}
          </View>
        )}

        {eventMode === 'pattern' && (
          <View style={styles.section}>
            <WhenRow
              label="Začátek cyklu"
              value={
                patternStartDate
                  ? dayjs(patternStartDate)
                      .format('ddd D. M. YYYY')
                      .replace(/\.$/, '')
                      .replace(/^./, (c) => c.toUpperCase())
                  : 'Vyber datum'
              }
              onPress={() => setPatternStartDateModalVisible(true)}
              barColor={barColor}
              secondary={secondaryTextColor}
              borderColor={borderColorTheme}
            />
            <DatePickerModal
              locale="cs"
              mode="single"
              startWeekOnMonday
              visible={patternStartDateModalVisible}
              onDismiss={() => setPatternStartDateModalVisible(false)}
              date={patternStartDate}
              onConfirm={(params) => {
                setPatternStartDateModalVisible(false);
                if (params.date) setPatternStartDate(params.date);
              }}
              label="Začátek cyklu"
              saveLabel="Uložit"
            />
            <WhenRow
              label="Konec (volitelné)"
              value={
                patternEndDate
                  ? dayjs(patternEndDate)
                      .format('ddd D. M. YYYY')
                      .replace(/\.$/, '')
                      .replace(/^./, (c) => c.toUpperCase())
                  : 'Bez omezení'
              }
              onPress={() => setPatternEndDateModalVisible(true)}
              barColor={barColor}
              secondary={secondaryTextColor}
              borderColor={borderColorTheme}
            />
            <DatePickerModal
              locale="cs"
              mode="single"
              startWeekOnMonday
              visible={patternEndDateModalVisible}
              onDismiss={() => setPatternEndDateModalVisible(false)}
              date={patternEndDate}
              onConfirm={(params) => {
                setPatternEndDateModalVisible(false);
                if (params.date) setPatternEndDate(params.date);
              }}
              label="Konec cyklu"
              saveLabel="Uložit"
            />

            <View style={styles.cycleHeader}>
              <ThemedText
                style={[styles.sectionLabel, { color: secondaryTextColor, marginTop: 12, marginBottom: 0 }]}
              >
                Sestavení cyklu
              </ThemedText>
              <ThemedText style={[styles.cycleTotal, { color: barColor }]}>
                {cycleDaysTotal} {cycleDaysTotal === 1 ? 'den' : cycleDaysTotal < 5 ? 'dny' : 'dní'}
              </ThemedText>
            </View>

            {cycleDaysTotal > 0 && (
              <View style={styles.cycleStrip}>
                {patternSegments.map((segment) => (
                  <View
                    key={`strip-${segment.id}`}
                    style={[
                      styles.cycleStripSeg,
                      {
                        flex: Math.max(segment.days, 1),
                        backgroundColor:
                          segment.type === 'work' ? barColor : 'transparent',
                        borderColor:
                          segment.type === 'work' ? barColor : secondaryTextColor,
                        borderStyle: segment.type === 'work' ? 'solid' : 'dashed',
                      },
                    ]}
                  />
                ))}
              </View>
            )}

            <View style={styles.cycleLegend}>
              <View style={styles.cycleLegendItem}>
                <View style={[styles.cycleLegendDot, { backgroundColor: barColor }]} />
                <ThemedText style={[styles.cycleLegendText, { color: secondaryTextColor }]}>
                  Událost
                </ThemedText>
              </View>
              <View style={styles.cycleLegendItem}>
                <View
                  style={[
                    styles.cycleLegendDot,
                    {
                      backgroundColor: 'transparent',
                      borderWidth: 1.5,
                      borderColor: secondaryTextColor,
                      borderStyle: 'dashed',
                    },
                  ]}
                />
                <ThemedText style={[styles.cycleLegendText, { color: secondaryTextColor }]}>
                  Pauza
                </ThemedText>
              </View>
            </View>

            {patternSegments.map((segment, index) => {
              const isWork = segment.type === 'work';
              const accent = isWork ? barColor : secondaryTextColor;
              return (
                <View
                  key={segment.id}
                  style={[
                    styles.segmentCard,
                    {
                      backgroundColor: isWork ? `${barColor}12` : cardBackgroundColor,
                      borderColor: isWork ? `${barColor}55` : borderColorTheme,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.segmentAccent,
                      isWork
                        ? { backgroundColor: barColor }
                        : {
                            backgroundColor: 'transparent',
                            borderRightWidth: 2,
                            borderRightColor: secondaryTextColor,
                            borderStyle: 'dashed',
                          },
                    ]}
                  />
                  <View style={styles.segmentMain}>
                    <View style={styles.segmentHeader}>
                      <View style={styles.segmentTitleRow}>
                        <View
                          style={[
                            styles.segmentIconWrap,
                            { backgroundColor: isWork ? `${barColor}22` : `${secondaryTextColor}22` },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={isWork ? 'briefcase-outline' : 'coffee-outline'}
                            size={18}
                            color={accent}
                          />
                        </View>
                        <View>
                          <ThemedText style={[styles.segmentIndex, { color: secondaryTextColor }]}>
                            Blok {index + 1}
                          </ThemedText>
                          <ThemedText style={[styles.segmentTitle, { color: textColor }]}>
                            {isWork ? 'Událost' : 'Pauza'}
                          </ThemedText>
                        </View>
                      </View>

                      <View style={styles.segmentControls}>
                        <View
                          style={[
                            styles.daysStepper,
                            { borderColor: borderColorTheme, backgroundColor: cardBackgroundColor },
                          ]}
                        >
                          <Pressable
                            onPress={() => bumpSegmentDays(segment.id, -1)}
                            hitSlop={6}
                            style={styles.daysBtn}
                          >
                            <MaterialCommunityIcons name="minus" size={18} color={textColor} />
                          </Pressable>
                          <ThemedText style={styles.daysValue}>
                            {segment.days}
                            <ThemedText style={{ fontSize: 12, color: secondaryTextColor }}>
                              {' '}
                              d
                            </ThemedText>
                          </ThemedText>
                          <Pressable
                            onPress={() => bumpSegmentDays(segment.id, 1)}
                            hitSlop={6}
                            style={styles.daysBtn}
                          >
                            <MaterialCommunityIcons name="plus" size={18} color={textColor} />
                          </Pressable>
                        </View>
                        {patternSegments.length > 1 && (
                          <Pressable
                            onPress={() => removeSegment(segment.id)}
                            hitSlop={8}
                            style={styles.segmentRemove}
                          >
                            <MaterialCommunityIcons
                              name="close"
                              size={18}
                              color={Brand.danger}
                            />
                          </Pressable>
                        )}
                      </View>
                    </View>

                    {isWork && (
                      <View style={styles.segmentTimes}>
                        <Pressable
                          style={[
                            styles.segmentTimeTap,
                            { borderColor: borderColorTheme, backgroundColor: cardBackgroundColor },
                          ]}
                          onPress={() => {
                            setEditingSegmentId(segment.id);
                            setTimeContext('patternSegment');
                            setTimeStep('start');
                            setTimeModalVisible(true);
                          }}
                        >
                          <ThemedText style={{ color: secondaryTextColor, fontSize: 11, fontWeight: '500' }}>
                            Od
                          </ThemedText>
                          <ThemedText style={{ fontWeight: '700', fontSize: 16, color: textColor }}>
                            {segment.startTime ? formatTime(segment.startTime) : '—'}
                          </ThemedText>
                        </Pressable>
                        <MaterialCommunityIcons
                          name="arrow-right"
                          size={16}
                          color={secondaryTextColor}
                          style={{ alignSelf: 'center' }}
                        />
                        <Pressable
                          style={[
                            styles.segmentTimeTap,
                            { borderColor: borderColorTheme, backgroundColor: cardBackgroundColor },
                          ]}
                          onPress={() => {
                            setEditingSegmentId(segment.id);
                            setTimeContext('patternSegment');
                            setTimeStep('end');
                            setTimeModalVisible(true);
                          }}
                        >
                          <ThemedText style={{ color: secondaryTextColor, fontSize: 11, fontWeight: '500' }}>
                            Do
                          </ThemedText>
                          <ThemedText style={{ fontWeight: '700', fontSize: 16, color: textColor }}>
                            {segment.endTime ? formatTime(segment.endTime) : '—'}
                          </ThemedText>
                        </Pressable>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}

            <View style={styles.cycleAddRow}>
              <Pressable
                onPress={() => addSegment('work')}
                style={[
                  styles.cycleAddBtn,
                  { borderColor: barColor, backgroundColor: `${barColor}14` },
                ]}
              >
                <MaterialCommunityIcons name="briefcase-plus-outline" size={18} color={barColor} />
                <ThemedText style={{ color: barColor, fontWeight: '700', fontSize: 13 }}>
                  Událost
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => addSegment('off')}
                style={[
                  styles.cycleAddBtn,
                  { borderColor: chipInactiveBorder },
                ]}
              >
                <MaterialCommunityIcons
                  name="coffee-outline"
                  size={18}
                  color={chipInactive}
                />
                <ThemedText style={{ color: chipInactive, fontWeight: '700', fontSize: 13 }}>
                  Pauza
                </ThemedText>
              </Pressable>
            </View>
          </View>
        )}

        <TimePickerModal
          visible={timeModalVisible}
          onDismiss={() => {
            setTimeModalVisible(false);
            setEditingMultiDate(null);
            setEditingSegmentId(null);
          }}
          onConfirm={handleTimeConfirm}
          hours={pickerHours}
          minutes={pickerMinutes}
          use24HourClock
          label={timeStep === 'start' ? 'Čas od' : 'Čas do'}
        />

        <View style={{ marginTop: 8, zIndex: 2 }}>
          <LocationAutocomplete
            poloha={poloha}
            setPoloha={setPoloha}
            latitude={latitude}
            setLatitude={setLatitude}
            setLongitude={setLongitude}
            accentColor={barColor}
            borderColorTheme={borderColorTheme}
          />
        </View>

        {isGroup && (
          <View style={styles.section}>
            <ThemedText
              style={[styles.sectionLabel, { color: secondaryTextColor }]}
            >
              Kapacita (včetně tebe)
            </ThemedText>
            <View style={styles.counterRow}>
              <IconButton
                icon="minus"
                mode="contained"
                onPress={decrease}
                iconColor={buttonTextColor}
                containerColor={barColor}
              />
              <ThemedText style={styles.counterValue}>{peopleCount}</ThemedText>
              <IconButton
                icon="plus"
                mode="contained"
                onPress={increase}
                iconColor={buttonTextColor}
                containerColor={barColor}
              />
            </View>
            <Pressable
              onPress={() => setInviteModalVisible(true)}
              style={({ pressed }) => [
                styles.peopleCard,
                {
                  borderColor: `${barColor}55`,
                  backgroundColor: `${barColor}10`,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <View style={[styles.peopleCardIcon, { backgroundColor: `${barColor}22` }]}>
                <MaterialCommunityIcons
                  name="account-eye-outline"
                  size={22}
                  color={barColor}
                />
              </View>
              <View style={styles.peopleCardBody}>
                <ThemedText style={[styles.peopleCardTitle, { color: textColor }]}>
                  Kdo událost vidí
                </ThemedText>
                <ThemedText style={[styles.peopleCardHint, { color: secondaryTextColor }]}>
                  {selectedInvites.length === 0
                    ? 'Nikdo další zatím nevidí'
                    : `Pozváno ${selectedInvites.length} ${
                        selectedInvites.length === 1 ? 'přítel' : 'přátel'
                      }`}
                </ThemedText>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={secondaryTextColor} />
            </Pressable>
            <Pressable
              onPress={() => setParticipantModalVisible(true)}
              style={({ pressed }) => [
                styles.peopleCard,
                {
                  borderColor: `${barColor}55`,
                  backgroundColor: `${barColor}10`,
                  marginTop: 8,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <View style={[styles.peopleCardIcon, { backgroundColor: `${barColor}22` }]}>
                <MaterialCommunityIcons
                  name="account-plus-outline"
                  size={22}
                  color={barColor}
                />
              </View>
              <View style={styles.peopleCardBody}>
                <ThemedText style={[styles.peopleCardTitle, { color: textColor }]}>
                  Přihlášení k účasti
                </ThemedText>
                <ThemedText style={[styles.peopleCardHint, { color: secondaryTextColor }]}>
                  {selectedParticipants.length + 1}/{peopleCount} míst obsazeno
                </ThemedText>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={secondaryTextColor} />
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={handleCreate}
          disabled={isDisabled}
          style={({ pressed }) => [
            styles.saveBtn,
            {
              backgroundColor: isDisabled ? '#9AA0A6' : barColor,
              opacity: pressed && !isDisabled ? 0.9 : 1,
            },
          ]}
        >
          {creating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.saveBtnText}>Uložit</ThemedText>
          )}
        </Pressable>

        <ParticipantsDialog
          visible={inviteModalVisible}
          onDismiss={() => setInviteModalVisible(false)}
          users={friendUsers}
          currentUserId={user?.id}
          selectedParticipants={selectedInvites}
          setSelectedParticipants={setSelectedInvites}
          title="Kdo událost vidí"
          subtitle={
            friendUsers.length === 0
              ? undefined
              : `Pozváno ${selectedInvites.length} z ${friendUsers.length}`
          }
          buttonColor={barColor}
          cardBackgroundColor={cardBackgroundColor}
          colors={colors}
          headerActionLabel={
            selectedInvites.length > 0 ? 'Zrušit pozvánky' : 'Pozvat všechny'
          }
          onHeaderAction={() => {
            if (selectedInvites.length > 0) {
              setSelectedInvites([]);
              return;
            }
            setSelectedInvites(friendUsers.map((u) => u.id));
          }}
          emptyText="Nejdřív přidej přátele — pak je tu můžeš pozvat."
        />

        <ParticipantsDialog
          visible={participantModalVisible}
          onDismiss={() => setParticipantModalVisible(false)}
          users={friendUsers.filter((u) =>
            selectedInvites.map(String).includes(String(u.id))
          )}
          currentUserId={user?.id}
          selectedParticipants={selectedParticipants}
          setSelectedParticipants={setSelectedParticipants}
          peopleCount={peopleCount}
          title="Přihlášení k účasti"
          buttonColor={barColor}
          cardBackgroundColor={cardBackgroundColor}
          colors={colors}
          headerActionLabel={
            selectedParticipants.length > 0 ? 'Zrušit výběr' : 'Vybrat z pozvaných'
          }
          onHeaderAction={() => {
            if (selectedParticipants.length > 0) {
              setSelectedParticipants([]);
              return;
            }
            const inviteSet = new Set(selectedInvites.map(String));
            const others = friendUsers
              .map((u) => u.id)
              .filter(
                (id) =>
                  inviteSet.has(String(id)) &&
                  String(id) !== String(user?.id)
              );
            setSelectedParticipants(others.slice(0, Math.max(0, peopleCount - 1)));
          }}
          emptyText="Nejdřív pozvi přátele výše — účastníky vybíráš z pozvaných."
        />
      </ScrollView>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  colorBar: {
    width: 4,
    borderRadius: 2,
    marginRight: 12,
    alignSelf: 'stretch',
    minHeight: 36,
  },
  titleInput: {
    fontSize: 22,
    fontWeight: '700',
    paddingVertical: 10,
    marginBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  chipText: { fontSize: 13 },
  whenBlock: { marginBottom: 8 },
  whenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  whenBody: { flex: 1, gap: 2 },
  whenLabel: { fontSize: 12, fontWeight: '500' },
  whenValue: { fontSize: 16, fontWeight: '600' },
  whenIcon: { padding: 6 },
  section: { marginBottom: 12 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 8,
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  peopleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  peopleCardIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peopleCardBody: { flex: 1, gap: 2 },
  peopleCardTitle: { fontSize: 15, fontWeight: '700' },
  peopleCardHint: { fontSize: 12, fontWeight: '500' },
  multiDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  multiDayDate: { width: 88, fontWeight: '600', fontSize: 13 },
  multiTimeTap: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    minWidth: 48,
    alignItems: 'center',
  },
  segmentCard: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
    minHeight: 64,
  },
  segmentAccent: {
    width: 4,
  },
  segmentMain: {
    flex: 1,
    padding: 12,
    gap: 10,
  },
  segmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  segmentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  segmentIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentIndex: {
    fontSize: 11,
    fontWeight: '500',
  },
  segmentTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  segmentControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  daysStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  daysBtn: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  daysValue: {
    minWidth: 36,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
  },
  segmentRemove: {
    padding: 6,
  },
  segmentTimes: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  segmentTimeTap: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 2,
  },
  cycleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cycleTotal: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
  },
  cycleStrip: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    gap: 3,
    marginBottom: 8,
  },
  cycleStripSeg: {
    borderRadius: 4,
    borderWidth: 1.5,
    minWidth: 8,
  },
  cycleLegend: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 12,
  },
  cycleLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cycleLegendDot: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  cycleLegendText: {
    fontSize: 12,
    fontWeight: '500',
  },
  cycleAddRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  cycleAddBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 12,
  },
  counterValue: {
    fontSize: 22,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'center',
  },
  saveBtn: {
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
