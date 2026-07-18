import { createEvent, createMultiDateEvent, createPatternEvent } from '@/services/events/create_event';
import { fetchUsers } from '@/services/users/get_users';
import { joinEvent } from '@/services/events/join_event';
import { getDefaultInviteIds } from '@/services/events/invites';
import { fetchMyFriendships } from '@/services/friends/friendships';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { KeyboardScreen } from '@/components/KeyboardScreen';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/useAuth';
import dayjs from 'dayjs';
import 'dayjs/locale/cs';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, LogBox, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LocaleConfig } from 'react-native-calendars';
import { Button, IconButton, TextInput as PaperTextInput, RadioButton, Switch, TextInput } from 'react-native-paper';
import { DatePickerModal, TimePickerModal, cs, registerTranslation } from 'react-native-paper-dates';
import { LocationAutocomplete } from './LocationAutocomplete';
import { ParticipantsDialog, SelectableUserId } from './ParticipantsDialog';

// Skryje otravné varování o vnořených seznamech
LogBox.ignoreLogs(['VirtualizedLists should never be nested']);

LocaleConfig.locales['cs'] = {
    monthNames: ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'],
    monthNamesShort: ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čer', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'],
    dayNames: ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'],
    dayNamesShort: ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'],
    today: 'Dnes'
};
LocaleConfig.defaultLocale = 'cs';

dayjs.locale('cs');
registerTranslation('cs', cs);

interface EventCreateFormProps {
    pickedDate?: string | Date;
    onSuccess?: () => void;
}

// Rozhraní pro jeden blok v pravidelném cyklu
interface PatternSegment {
    id: string;
    type: 'work' | 'off';
    days: number;
    startTime?: Date;
    endTime?: Date;
}

export function EventCreateForm({ pickedDate, onSuccess }: EventCreateFormProps) {
    const [name, setName] = useState('');
    const [poloha, setPoloha] = useState('');
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);

    const [type, setType] = useState(false);
    const [peopleCount, setPeopleCount] = useState(2);
    const { user } = useAuth();

    const [eventMode, setEventMode] = useState<'once' | 'monthly' | 'pattern'>('once');
    const [groupEventMode, setGroupEventMode] = useState<'once' | 'monthly' | 'pattern'>('once');
    const getCurrentEventMode = () => type ? groupEventMode : eventMode;

    // --- STAVY PRO JEDNORÁZOVOU UDÁLOST ---
    const [dateRange, setDateRange] = useState<{ startDate?: Date; endDate?: Date }>({});
    const [timeRange, setTimeRange] = useState<{ start?: Date; end?: Date }>({});

    // --- STAVY PRO OPAKUJÍCÍ SE (VÍCE DNÍ) ---
    const [multiDates, setMultiDates] = useState<Date[]>([]);
    const [multiTimes, setMultiTimes] = useState<Record<string, { start?: Date, end?: Date }>>({});
    const [editingMultiDate, setEditingMultiDate] = useState<string | null>(null);

    // --- STAVY PRO PRAVIDELNÝ CYKLUS (STAVEBNICE) ---
    const [patternStartDate, setPatternStartDate] = useState<Date | undefined>(undefined);
    const [patternEndDate, setPatternEndDate] = useState<Date | undefined>(undefined); // Dobrovolný konec cyklu
    const [patternSegments, setPatternSegments] = useState<PatternSegment[]>([
        { id: '1', type: 'work', days: 2, startTime: dayjs().hour(8).minute(0).toDate(), endTime: dayjs().hour(16).minute(0).toDate() },
        { id: '2', type: 'off', days: 1 }
    ]);
    const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    // --- SDÍLENÉ STAVY PRO MODALY ---
    const [dateModalVisible, setDateModalVisible] = useState(false);
    const [multiDateModalVisible, setMultiDateModalVisible] = useState(false);
    const [patternStartDateModalVisible, setPatternStartDateModalVisible] = useState(false);
    const [patternEndDateModalVisible, setPatternEndDateModalVisible] = useState(false);

    const [timeModalVisible, setTimeModalVisible] = useState(false);
    const [timeStep, setTimeStep] = useState<'start' | 'end'>('start');
    const [timeContext, setTimeContext] = useState<'once' | 'multi' | 'patternSegment'>('once');

    const [selectedInvites, setSelectedInvites] = useState<SelectableUserId[]>([]);
    const [selectedParticipants, setSelectedParticipants] = useState<SelectableUserId[]>([]);
    const [friendUsers, setFriendUsers] = useState<any[]>([]);
    const [inviteModalVisible, setInviteModalVisible] = useState(false);
    const [participantModalVisible, setParticipantModalVisible] = useState(false);

    // Téma barev
    const buttonColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
    const buttonTextColor = useThemeColor({ light: '#fff', dark: '#000' }, 'text');
    const cardBackgroundColor = useThemeColor({ light: '#f5f5f5', dark: '#2c2c2e' }, 'background');
    const borderColorTheme = useThemeColor({ light: '#e5e5ea', dark: '#38383a' }, 'border');
    const secondaryTextColor = useThemeColor({ light: '#666', dark: '#aaa' }, 'text');

    const resetForm = () => {
        setName(''); setPoloha(''); setLatitude(null); setLongitude(null);
        setPeopleCount(2); setDateRange({}); setTimeRange({}); setMultiDates([]); setMultiTimes({});
        setPatternStartDate(undefined); setPatternEndDate(undefined);
        setPatternSegments([
            { id: Math.random().toString(), type: 'work', days: 2, startTime: dayjs().hour(8).minute(0).toDate(), endTime: dayjs().hour(16).minute(0).toDate() },
            { id: Math.random().toString(), type: 'off', days: 1 }
        ]);
        setType(false); setEventMode('once'); setGroupEventMode('once');
        setSelectedInvites([]); setSelectedParticipants([]);
    };

    useEffect(() => {
        if (!pickedDate) return;
        const dateStr = typeof pickedDate === 'string' ? pickedDate : pickedDate.toISOString();
        const start = new Date(dateStr);
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
                            String(f.user_id) === String(user.id) ? String(f.friend_id) : String(f.user_id)
                        )
                );
                setFriendUsers(allUsers.filter((u: any) => friendIdSet.has(String(u.id))));
                setSelectedInvites(defaultInvites);
            } catch (err) {
                console.error(err);
            }
        };
        loadFriends();
    }, [user?.id]);

    useEffect(() => {
        // Přihlášení musí být podmnožinou pozvaných
        const inviteSet = new Set(selectedInvites.map(String));
        setSelectedParticipants((prev) => prev.filter((id) => inviteSet.has(String(id))));
    }, [selectedInvites]);

    const increase = () => setPeopleCount(prev => prev + 1);
    const decrease = () => setPeopleCount(prev => {
        const minAllowed = selectedParticipants.length + 1;
        const nextCount = prev > 2 ? prev - 1 : 2;
        return nextCount >= minAllowed ? nextCount : prev;
    });

    const assignParticipants = async (eventId: number) => {
        if (!eventId || !user?.id) return;
        await joinEvent({ user_id: String(user.id), event_id: eventId, instance_date: undefined, skipNotify: true });
        for (const participantId of selectedParticipants) {
            await joinEvent({ user_id: String(participantId), event_id: eventId, instance_date: undefined, skipNotify: true });
        }
    };

    // --- ULOŽENÍ ---
    const handleCreate = async () => {
        if (!user?.id || !name.trim() || creating) return;
        const currentMode = getCurrentEventMode();
        const finalIsGroup = type;
        const finalPeopleCount = type ? peopleCount : 1;

        setCreating(true);
        try {
            if (currentMode === 'once') {
                if (!dateRange.startDate || !timeRange.start) return;
                const start = new Date(dateRange.startDate); start.setHours(timeRange.start.getHours(), timeRange.start.getMinutes());
                const end = dateRange.endDate ? new Date(dateRange.endDate) : new Date(start);
                if (timeRange.end) end.setHours(timeRange.end.getHours(), timeRange.end.getMinutes());

                const result = await createEvent({
                    title: name, poloha, latitude, longitude, user_id: user.id, start, end,
                    peopleCount: finalPeopleCount, pravidelnost: false, is_group: finalIsGroup,
                    inviteUserIds: finalIsGroup ? selectedInvites : undefined,
                });
                const eventId = result?.data?.[0]?.id || result?.id;
                if (finalIsGroup) await assignParticipants(eventId);

            } else if (currentMode === 'monthly') {
                // Create individual events with shared group_id
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

                // result is now an array of events
                const firstEventId = result?.[0]?.id;
                if (finalIsGroup && firstEventId) {
                    // Assign participants to all events in the group
                    for (const event of result) {
                        await assignParticipants(event.id);
                    }
                }

            } else if (currentMode === 'pattern') {
                const pattern = [];
                let cycleDays = 0;

                patternSegments.forEach(segment => {
                    const sTime = segment.startTime ? formatTime(segment.startTime) : '08:00';
                    const eTime = segment.endTime ? formatTime(segment.endTime) : '16:00';

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

                const firstWorkSegment = patternSegments.find(s => s.type === 'work');

                const result = await createPatternEvent({
                    title: name, poloha, latitude, longitude, user_id: user.id,
                    anchor_date: patternStartDate || new Date(),
                    valid_until: patternEndDate ? dayjs(patternEndDate).format('YYYY-MM-DD') : undefined, // Přidáno volitelné datum konce
                    cycle_days: cycleDays, pattern,
                    cas_od: firstWorkSegment?.startTime ? formatTime(firstWorkSegment.startTime) : '08:00',
                    cas_do: firstWorkSegment?.endTime ? formatTime(firstWorkSegment.endTime) : '16:00',
                    is_group: finalIsGroup, peopleCount: finalPeopleCount,
                    inviteUserIds: finalIsGroup ? selectedInvites : undefined,
                });
                const eventId = result?.id || result?.data?.[0]?.id;
                if (finalIsGroup) await assignParticipants(eventId);
            }

            resetForm();
            onSuccess?.();
        } catch (err) {
            console.error('❌ Chyba při vytváření události:', err);
        } finally {
            setCreating(false);
        }
    };

    const isDisabled = (() => {
        if (creating) return true;
        if (!name.trim()) return true;
        const currentMode = getCurrentEventMode();
        if (currentMode === 'once') return !dateRange.startDate || !timeRange.start || !timeRange.end;
        if (currentMode === 'monthly') return multiDates.length === 0 || multiDates.some(d => {
            const t = multiTimes[dayjs(d).format('YYYY-MM-DD')];
            return !t || !t.start || !t.end;
        });
        if (currentMode === 'pattern') {
            if (!patternStartDate || patternSegments.length === 0) return true;
            return patternSegments.some(s => s.days <= 0 || (s.type === 'work' && (!s.startTime || !s.endTime)));
        }
        return false;
    })();

    const formatDate = (d?: Date) => (d ? dayjs(d).format('DD. MM. YYYY') : '');
    const formatTime = (d?: Date) => (d ? dayjs(d).format('HH:mm') : '');

    const addSegment = (type: 'work' | 'off') => {
        setPatternSegments(prev => [
            ...prev,
            {
                id: Math.random().toString(),
                type,
                days: 1,
                startTime: type === 'work' ? dayjs().hour(8).minute(0).toDate() : undefined,
                endTime: type === 'work' ? dayjs().hour(16).minute(0).toDate() : undefined
            }
        ]);
    };

    const updateSegmentDays = (id: string, daysStr: string) => {
        const days = parseInt(daysStr) || 0;
        setPatternSegments(prev => prev.map(s => s.id === id ? { ...s, days } : s));
    };

    const removeSegment = (id: string) => {
        setPatternSegments(prev => prev.filter(s => s.id !== id));
    };

    const handleTimeConfirm = ({ hours, minutes }: { hours: number; minutes: number }) => {
        const newTime = new Date();
        newTime.setHours(hours, minutes, 0, 0);

        if (timeContext === 'once') {
            if (timeStep === 'start') {
                const end = new Date(newTime.getTime() + 60 * 60 * 1000);
                setTimeRange({ start: newTime, end: timeRange.end || end });
                setTimeStep('end');
                setTimeout(() => setTimeModalVisible(true), 100);
            } else {
                setTimeRange(prev => ({ ...prev, end: newTime }));
                setTimeModalVisible(false);
            }
        }
        else if (timeContext === 'multi' && editingMultiDate) {
            const currentObj = multiTimes[editingMultiDate] || {};

            if (timeStep === 'start') {
                const end = currentObj.end || new Date(newTime.getTime() + 60 * 60 * 1000);
                const updatedTimes = { ...multiTimes, [editingMultiDate]: { start: newTime, end } };

                multiDates.forEach(d => {
                    const str = dayjs(d).format('YYYY-MM-DD');
                    if (!updatedTimes[str] || (!updatedTimes[str].start && !updatedTimes[str].end)) {
                        updatedTimes[str] = { start: newTime, end };
                    }
                });

                setMultiTimes(updatedTimes);
                setTimeStep('end');
                setTimeout(() => setTimeModalVisible(true), 100);
            } else {
                setMultiTimes(prev => ({ ...prev, [editingMultiDate]: { ...currentObj, end: newTime } }));
                setTimeModalVisible(false);
                setEditingMultiDate(null);
            }
        }
        else if (timeContext === 'patternSegment' && editingSegmentId) {
            setPatternSegments(prev => prev.map(s => {
                if (s.id === editingSegmentId) {
                    if (timeStep === 'start') {
                        return { ...s, startTime: newTime, endTime: s.endTime || new Date(newTime.getTime() + 3600000) };
                    } else {
                        return { ...s, endTime: newTime };
                    }
                }
                return s;
            }));

            if (timeStep === 'start') {
                setTimeStep('end');
                setTimeout(() => setTimeModalVisible(true), 100);
            } else {
                setTimeModalVisible(false);
                setEditingSegmentId(null);
            }
        }
    };

    return (
        <KeyboardScreen scroll={false}>
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" nestedScrollEnabled={true}>
            <ThemedView style={styles.field}>
                <ThemedText style={styles.label}>Název události</ThemedText>
                <PaperTextInput placeholder="Zadej název..." value={name} onChangeText={setName} mode="outlined" style={styles.input} activeOutlineColor={buttonColor} />
            </ThemedView>

            <LocationAutocomplete poloha={poloha} setPoloha={setPoloha} latitude={latitude} setLatitude={setLatitude} setLongitude={setLongitude} buttonColor={buttonColor} borderColorTheme={borderColorTheme} />

            <ThemedView style={[styles.field, styles.rowCenter, { zIndex: 1 }]}>
                <ThemedText style={styles.label}>Skupinová událost</ThemedText>
                <Switch
                    value={type}
                    color={buttonColor}
                    onValueChange={async (value) => {
                        setType(value);
                        if (value && user?.id) {
                            setSelectedInvites(await getDefaultInviteIds(user.id));
                        } else {
                            setSelectedInvites([]);
                            setSelectedParticipants([]);
                        }
                    }}
                />
            </ThemedView>

            {/* VÝBĚR TYPU UDÁLOSTI */}
            <ThemedView style={[styles.field, { zIndex: 1 }]}>
                <ThemedText style={styles.label}>{type ? 'Typ skupinové události' : 'Typ události'}</ThemedText>
                <ThemedView style={{ flexDirection: 'column', gap: 8 }}>
                    {[
                        { val: 'once', label: 'Jednorázová událost' },
                        { val: 'monthly', label: 'Opakující se (Výběr více dní)' },
                        { val: 'pattern', label: 'Pravidelný cyklus (Stavebnice)' }
                    ].map((m) => (
                        <Pressable key={m.val} style={{ flexDirection: 'row', alignItems: 'center' }} onPress={() => type ? setGroupEventMode(m.val as any) : setEventMode(m.val as any)}>
                            <RadioButton value={m.val} status={getCurrentEventMode() === m.val ? 'checked' : 'unchecked'} onPress={() => type ? setGroupEventMode(m.val as any) : setEventMode(m.val as any)} />
                            <ThemedText style={{ marginLeft: 8 }}>{m.label}</ThemedText>
                        </Pressable>
                    ))}
                </ThemedView>
            </ThemedView>

            {/* --- UI PRO JEDNORÁZOVOU UDÁLOST --- */}
            {getCurrentEventMode() === 'once' && (
                <>
                    <ThemedView style={[styles.field, { zIndex: 1 }]}>
                        <Pressable onPress={() => setDateModalVisible(true)}>
                            <PaperTextInput
                                value={dateRange.startDate ? `${formatDate(dateRange.startDate)}${dateRange.endDate && !dayjs(dateRange.startDate).isSame(dateRange.endDate, 'day') ? ` → ${formatDate(dateRange.endDate)}` : ''}` : 'Vyber datum'}
                                mode="outlined" editable={false} right={<TextInput.Icon icon="calendar-outline" />} style={{ backgroundColor: 'transparent' }}
                            />
                        </Pressable>
                        <DatePickerModal locale="cs" mode="range" startWeekOnMonday={true} visible={dateModalVisible} onDismiss={() => setDateModalVisible(false)} startDate={dateRange.startDate} endDate={dateRange.endDate} onConfirm={({ startDate, endDate }) => { setDateModalVisible(false); setDateRange({ startDate, endDate: endDate || startDate }); }} label="Vyberte datum od - do" saveLabel="Uložit" startLabel="Od" endLabel="Do" />
                    </ThemedView>

                    <ThemedView style={[styles.field, { zIndex: 1 }]}>
                        <ThemedView style={{ flexDirection: 'row', gap: 8 }}>
                            <ThemedView style={{ flex: 1 }}>
                                <Pressable onPress={() => { setTimeContext('once'); setTimeStep('start'); setTimeModalVisible(true); }}>
                                    <PaperTextInput value={timeRange.start ? formatTime(timeRange.start) : 'Čas od'} mode="outlined" editable={false} right={<TextInput.Icon icon="clock-outline" />} />
                                </Pressable>
                            </ThemedView>
                            <ThemedView style={{ flex: 1 }}>
                                <Pressable onPress={() => { setTimeContext('once'); setTimeStep('end'); setTimeModalVisible(true); }}>
                                    <PaperTextInput value={timeRange.end ? formatTime(timeRange.end) : 'Čas do'} mode="outlined" editable={false} right={<TextInput.Icon icon="clock-outline" />} />
                                </Pressable>
                            </ThemedView>
                        </ThemedView>
                    </ThemedView>
                </>
            )}

            {/* --- UI PRO OPAKUJÍCÍ SE UDÁLOST (VÍCE DNÍ) --- */}
            {getCurrentEventMode() === 'monthly' && (
                <>
                    <ThemedView style={[styles.field, { zIndex: 1 }]}>
                        <Button mode="outlined" onPress={() => setMultiDateModalVisible(true)} icon="calendar-multiselect" textColor={buttonColor} style={{ borderColor: buttonColor }}>
                            Vybrat dny do série ({multiDates.length})
                        </Button>
                        <DatePickerModal locale="cs" mode="multiple" startWeekOnMonday={true} visible={multiDateModalVisible} onDismiss={() => setMultiDateModalVisible(false)} dates={multiDates} onConfirm={(params) => { setMultiDateModalVisible(false); setMultiDates(params.dates || []); }} label="Vyberte dny konání" saveLabel="Uložit" />
                    </ThemedView>

                    {multiDates.length > 0 && (
                        <ThemedView style={{ gap: 8, marginBottom: 16 }}>
                            <ThemedText style={{ fontSize: 13, color: secondaryTextColor, marginBottom: 4 }}>Při nastavení času u jednoho dne se automaticky doplní i prázdným dnům.</ThemedText>
                            {multiDates.sort((a, b) => a.getTime() - b.getTime()).map((d, index) => {
                                const dStr = dayjs(d).format('YYYY-MM-DD');
                                const t = multiTimes[dStr];
                                return (
                                    <ThemedView key={index} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: cardBackgroundColor, padding: 8, borderRadius: 8, gap: 8 }}>
                                        <ThemedText style={{ width: 90, fontWeight: '600' }}>{formatDate(d)}</ThemedText>
                                        <Pressable style={{ flex: 1 }} onPress={() => { setEditingMultiDate(dStr); setTimeContext('multi'); setTimeStep('start'); setTimeModalVisible(true); }}>
                                            <PaperTextInput value={t?.start ? formatTime(t.start) : 'Od'} mode="outlined" editable={false} style={{ height: 40, backgroundColor: 'transparent' }} />
                                        </Pressable>
                                        <Pressable style={{ flex: 1 }} onPress={() => { setEditingMultiDate(dStr); setTimeContext('multi'); setTimeStep('end'); setTimeModalVisible(true); }}>
                                            <PaperTextInput value={t?.end ? formatTime(t.end) : 'Do'} mode="outlined" editable={false} style={{ height: 40, backgroundColor: 'transparent' }} />
                                        </Pressable>
                                    </ThemedView>
                                );
                            })}
                        </ThemedView>
                    )}
                </>
            )}

            {/* --- UI PRO PRAVIDELNÝ CYKLUS (STAVEBNICE) --- */}
            {getCurrentEventMode() === 'pattern' && (
                <>
                    {/* POLÍČKO 1: ZAČÁTEK CYKLU (POVINNÉ) */}
                    <ThemedView style={[styles.field, { zIndex: 1 }]}>
                        <ThemedText style={[styles.label, { color: secondaryTextColor }]}>Datum začátku cyklu</ThemedText>
                        <Pressable onPress={() => setPatternStartDateModalVisible(true)}>
                            <PaperTextInput value={patternStartDate ? formatDate(patternStartDate) : 'Vyber datum začátku'} mode="outlined" editable={false} right={<TextInput.Icon icon="calendar-outline" onPress={() => setPatternStartDateModalVisible(true)} />} style={{ backgroundColor: 'transparent' }} />
                        </Pressable>
                        <DatePickerModal locale="cs" mode="single" startWeekOnMonday={true} visible={patternStartDateModalVisible} onDismiss={() => setPatternStartDateModalVisible(false)} date={patternStartDate} onConfirm={(params) => { setPatternStartDateModalVisible(false); if (params.date) setPatternStartDate(params.date); }} label="Začátek cyklu" saveLabel="Uložit" />
                    </ThemedView>

                    {/* POLÍČKO 2: KONEC CYKLU (DOBROVOLNÉ) */}
                    <ThemedView style={[styles.field, { zIndex: 1 }]}>
                        <ThemedText style={[styles.label, { color: secondaryTextColor }]}>Opakovat do (nepovinné)</ThemedText>
                        <Pressable onPress={() => setPatternEndDateModalVisible(true)}>
                            <PaperTextInput
                                value={patternEndDate ? formatDate(patternEndDate) : 'Bez omezení (opakovat navždy)'}
                                mode="outlined"
                                editable={false}
                                style={{ backgroundColor: 'transparent' }}
                                // Pokud je datum vybráno, ikonka ho křížkem smaže, jinak otevře kalendář
                                right={
                                    patternEndDate
                                        ? <TextInput.Icon icon="close" onPress={() => setPatternEndDate(undefined)} />
                                        : <TextInput.Icon icon="calendar-outline" onPress={() => setPatternEndDateModalVisible(true)} />
                                }
                            />
                        </Pressable>
                        <DatePickerModal locale="cs" mode="single" startWeekOnMonday={true} visible={patternEndDateModalVisible} onDismiss={() => setPatternEndDateModalVisible(false)} date={patternEndDate} onConfirm={(params) => { setPatternEndDateModalVisible(false); if (params.date) setPatternEndDate(params.date); }} label="Konec cyklu" saveLabel="Uložit" />
                    </ThemedView>

                    <ThemedView style={{ marginBottom: 16 }}>
                        <ThemedText style={[styles.label, { color: secondaryTextColor, marginBottom: 8 }]}>Sestavení opakujícího se cyklu</ThemedText>

                        <ThemedView style={{ gap: 12 }}>
                            {patternSegments.map((segment, index) => (
                                <ThemedView key={segment.id} style={{ backgroundColor: cardBackgroundColor, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: borderColorTheme }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: segment.type === 'work' ? 12 : 0 }}>
                                        <ThemedText style={{ fontWeight: '600', color: segment.type === 'work' ? '#4CAF50' : '#FF9800' }}>
                                            {segment.type === 'work' ? `${index + 1}. Událost (Práce)` : `${index + 1}. Volno (Pauza)`}
                                        </ThemedText>

                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <ThemedText>Dní:</ThemedText>
                                            <PaperTextInput
                                                value={String(segment.days)}
                                                keyboardType="numeric"
                                                onChangeText={(val) => updateSegmentDays(segment.id, val)}
                                                mode="outlined"
                                                style={{ width: 50, height: 35, textAlign: 'center', backgroundColor: 'transparent' }}
                                            />
                                            {patternSegments.length > 1 && (
                                                <IconButton icon="close" size={20} iconColor="red" onPress={() => removeSegment(segment.id)} style={{ margin: 0 }} />
                                            )}
                                        </View>
                                    </View>

                                    {segment.type === 'work' && (
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                            <Pressable style={{ flex: 1 }} onPress={() => { setEditingSegmentId(segment.id); setTimeContext('patternSegment'); setTimeStep('start'); setTimeModalVisible(true); }}>
                                                <PaperTextInput value={segment.startTime ? formatTime(segment.startTime) : 'Čas od'} label="Od" mode="outlined" editable={false} style={{ height: 45, backgroundColor: 'transparent' }} />
                                            </Pressable>
                                            <Pressable style={{ flex: 1 }} onPress={() => { setEditingSegmentId(segment.id); setTimeContext('patternSegment'); setTimeStep('end'); setTimeModalVisible(true); }}>
                                                <PaperTextInput value={segment.endTime ? formatTime(segment.endTime) : 'Čas do'} label="Do" mode="outlined" editable={false} style={{ height: 45, backgroundColor: 'transparent' }} />
                                            </Pressable>
                                        </View>
                                    )}
                                </ThemedView>
                            ))}
                        </ThemedView>

                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                            <Button mode="outlined" icon="briefcase-plus" onPress={() => addSegment('work')} style={{ flex: 1, borderColor: buttonColor }} textColor={buttonColor}>
                                Přidat událost
                            </Button>
                            <Button mode="outlined" icon="beach" onPress={() => addSegment('off')} style={{ flex: 1, borderColor: buttonColor }} textColor={buttonColor}>
                                Přidat pauzu
                            </Button>
                        </View>
                    </ThemedView>
                </>
            )}

            {/* UNIVERZÁLNÍ TIME PICKER PRO VŠECHNY MÓDY */}
            <TimePickerModal
                visible={timeModalVisible}
                onDismiss={() => { setTimeModalVisible(false); setEditingMultiDate(null); setEditingSegmentId(null); }}
                onConfirm={handleTimeConfirm}
                hours={8} minutes={0}
                use24HourClock
                label={timeStep === 'start' ? 'Nastavit čas od' : 'Nastavit čas do'}
            />

            {/* --- KAPACITA A ÚČASTNÍCI --- */}
            {type && (
                <ThemedView style={[styles.peopleSection, { zIndex: 1 }]}>
                    <ThemedText style={styles.label}>Maximální počet lidí (včetně Vás)</ThemedText>
                    <ThemedView style={styles.counterRow}>
                        <IconButton icon="minus" mode="contained" onPress={decrease} iconColor={buttonTextColor} containerColor={buttonColor} />
                        <PaperTextInput value={String(peopleCount)} keyboardType="numeric" mode="outlined" style={styles.counterInput} activeOutlineColor={buttonColor} editable={false} />
                        <IconButton icon="plus" mode="contained" onPress={increase} iconColor={buttonTextColor} containerColor={buttonColor} />
                    </ThemedView>
                </ThemedView>
            )}

            {type && (
                <>
                    <ThemedView style={[styles.field, { zIndex: 1 }]}>
                        <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                            Pozvaní vidí událost a dostanou oznámení (výchozí: všichni přátelé)
                        </ThemedText>
                        <Button mode="outlined" onPress={() => setInviteModalVisible(true)} icon="account-eye" style={{ borderColor: buttonColor }} labelStyle={{ color: buttonColor }}>
                            Pozvaní ({selectedInvites.length})
                        </Button>
                    </ThemedView>
                    <ThemedView style={[styles.field, { zIndex: 1 }]}>
                        <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                            Přihlášení k účasti (volitelné, počítá se do kapacity)
                        </ThemedText>
                        <Button mode="outlined" onPress={() => setParticipantModalVisible(true)} icon="account-plus" style={{ borderColor: buttonColor }} labelStyle={{ color: buttonColor }}>
                            Přihlášení ({selectedParticipants.length + 1}/{peopleCount})
                        </Button>
                    </ThemedView>
                </>
            )}

            <Button mode="contained" onPress={handleCreate} loading={creating} disabled={isDisabled} buttonColor={buttonColor} labelStyle={{ color: buttonTextColor }} style={[styles.createButton, { zIndex: 1 }]}>
                Vytvořit událost
            </Button>

            <ParticipantsDialog
                visible={inviteModalVisible}
                onDismiss={() => setInviteModalVisible(false)}
                users={friendUsers}
                currentUserId={user?.id}
                selectedParticipants={selectedInvites}
                setSelectedParticipants={setSelectedInvites}
                title="Komu zobrazit (pozvaní)"
                buttonColor={buttonColor}
                cardBackgroundColor={cardBackgroundColor}
            />

            <ParticipantsDialog
                visible={participantModalVisible}
                onDismiss={() => setParticipantModalVisible(false)}
                users={friendUsers.filter((u) => selectedInvites.map(String).includes(String(u.id)))}
                currentUserId={user?.id}
                selectedParticipants={selectedParticipants}
                setSelectedParticipants={setSelectedParticipants}
                peopleCount={peopleCount}
                title="Přihlášení k účasti"
                buttonColor={buttonColor}
                cardBackgroundColor={cardBackgroundColor}
            />
            </ScrollView>
        </KeyboardScreen>
    );
}

const styles = StyleSheet.create({
    container: { padding: 16, paddingBottom: 32 },
    field: { marginBottom: 12, zIndex: 1 },
    label: { fontSize: 14, marginBottom: 6, fontWeight: '600' },
    input: { fontSize: 16, backgroundColor: 'transparent' },
    rowCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    peopleSection: { alignItems: 'center', gap: 6, marginBottom: 12 },
    counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 },
    counterInput: { textAlign: 'center', width: 60, backgroundColor: 'transparent' },
    createButton: { borderRadius: 6, width: '100%', marginTop: 12 },
});
