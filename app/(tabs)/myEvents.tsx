import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ThemedSafeView } from '@/components/ThemedSafeView';
import { useAppData } from '@/contexts/AppDataContext';
import { useAuth } from '@/hooks/useAuth';
import { formatPause, getMyUpcomingEvents, type CalendarEvent } from '@/lib/myEventsHelpers';
import dayjs from 'dayjs';
import 'dayjs/locale/cs';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View, FlatList } from 'react-native';
import { ActivityIndicator, Chip } from 'react-native-paper';

dayjs.locale('cs');

export default function MyEventsScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const {
        events,
        eventExceptions,
        userEvents,
        joinedEventIds,
        friendIds,
        colors,
        users,
        booting,
        ready,
        refreshing,
        ensureLoaded,
        refreshTimeline,
    } = useAppData();

    const [ticker, setTicker] = useState(0);
    const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
    const [pullRefreshing, setPullRefreshing] = useState(false);

    useEffect(() => {
        if (user?.id && selectedFilters.length === 0) {
            setSelectedFilters([String(user.id)]);
        }
    }, [user?.id]);

    useEffect(() => {
        const interval = setInterval(() => setTicker((t) => t + 1), 60000);
        return () => clearInterval(interval);
    }, []);

    useFocusEffect(
        useCallback(() => {
            ensureLoaded();
        }, [ensureLoaded])
    );

    const onRefresh = async () => {
        setPullRefreshing(true);
        await refreshTimeline(true);
        setPullRefreshing(false);
    };

    const allTimeline = useMemo(() => {
        if (!user?.id) return [];
        const allIds = [String(user.id), ...friendIds];
        return getMyUpcomingEvents(events, [], eventExceptions, allIds, joinedEventIds, 365);
    }, [events, eventExceptions, joinedEventIds, user?.id, friendIds, ticker]);

    const myEvents = useMemo(() => {
        return allTimeline.filter((e) => {
            const isMine = selectedFilters.includes(String(e.user_id));
            const isJoinedGroup = joinedEventIds.includes(e.id);
            return isMine || isJoinedGroup;
        });
    }, [allTimeline, selectedFilters, joinedEventIds]);

    const openEvent = (event: CalendarEvent) => {
        const originalEvent = events.find((e) => e.id === event.id) || event;
        const isRecurringOrMulti = !!originalEvent.pravidelnost || !!(originalEvent as any).group_id;

        const params: any = {
            eventId: String(originalEvent.id),
            event: JSON.stringify(originalEvent),
        };
        if (isRecurringOrMulti) {
            params.instance_date =
                (event as any).instance_date || dayjs(event.start).format('YYYY-MM-DD');
        }

        router.push({
            pathname: '/events/[eventId]',
            params,
        });
    };

    // Spinner jen při prvním načtení bez cache
    if (booting && !ready) {
        return (
            <ThemedSafeView style={styles.center}>
                <ActivityIndicator size="large" />
            </ThemedSafeView>
        );
    }

    return (
        <ThemedSafeView style={styles.container}>
            <View style={styles.headerContainer}>
                <ThemedText type="title" style={styles.header}>
                    Moje události
                </ThemedText>
                <ThemedText style={styles.subtitle}>
                    Osobní a skupinové události seřazené v čase
                    {refreshing ? ' · aktualizuji…' : ''}
                </ThemedText>
            </View>

            <View style={{ paddingBottom: 16 }}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
                >
                    <Chip
                        selected={selectedFilters.length === friendIds.length + 1}
                        onPress={() => {
                            if (selectedFilters.length === friendIds.length + 1) {
                                setSelectedFilters([String(user?.id)]);
                            } else {
                                setSelectedFilters([String(user?.id), ...friendIds]);
                            }
                        }}
                        style={{
                            backgroundColor:
                                selectedFilters.length === friendIds.length + 1
                                    ? '#FF00AA'
                                    : 'transparent',
                            borderWidth: 1,
                            borderColor: '#FF00AA',
                        }}
                        textStyle={{
                            color:
                                selectedFilters.length === friendIds.length + 1
                                    ? '#FFF'
                                    : '#FF00AA',
                        }}
                    >
                        Všichni
                    </Chip>
                    <Chip
                        selected={selectedFilters.includes(String(user?.id))}
                        onPress={() => {
                            setSelectedFilters((prev) => {
                                if (prev.includes(String(user?.id)))
                                    return prev.filter((id) => id !== String(user?.id));
                                return [...prev, String(user?.id)];
                            });
                        }}
                        style={{
                            backgroundColor: selectedFilters.includes(String(user?.id))
                                ? '#FF00AA'
                                : 'transparent',
                            borderWidth: 1,
                            borderColor: '#FF00AA',
                        }}
                        textStyle={{
                            color: selectedFilters.includes(String(user?.id))
                                ? '#FFF'
                                : '#FF00AA',
                        }}
                    >
                        Já
                    </Chip>
                    {friendIds.map((fid) => {
                        const usr = users.find((u) => String(u.id) === fid);
                        const name = usr ? usr.username : 'Neznámý';
                        const isSelected = selectedFilters.includes(fid);
                        return (
                            <Chip
                                key={fid}
                                selected={isSelected}
                                onPress={() => {
                                    setSelectedFilters((prev) => {
                                        if (prev.includes(fid))
                                            return prev.filter((id) => id !== fid);
                                        return [...prev, fid];
                                    });
                                }}
                                style={{
                                    backgroundColor: isSelected ? '#FF00AA' : 'transparent',
                                    borderWidth: 1,
                                    borderColor: '#FF00AA',
                                }}
                                textStyle={{ color: isSelected ? '#FFF' : '#FF00AA' }}
                            >
                                {name}
                            </Chip>
                        );
                    })}
                </ScrollView>
            </View>

            <FlatList
                data={myEvents}
                keyExtractor={(event, index) =>
                    `${event.id}-${dayjs(event.start).valueOf()}-${index}`
                }
                style={styles.scrollView}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl refreshing={pullRefreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                    <ThemedText style={styles.empty}>
                        Nemáš žádné nadcházející události.
                    </ThemedText>
                }
                renderItem={({ item: event, index }) => {
                    const prev = index > 0 ? myEvents[index - 1] : null;
                    const next = index < myEvents.length - 1 ? myEvents[index + 1] : null;
                    const now = dayjs();
                    const sameDayAsPrev = prev && dayjs(prev.start).isSame(event.start, 'day');
                    const sameDayAsNext = next && dayjs(next.start).isSame(event.start, 'day');
                    const isToday = dayjs(event.start).isSame(now, 'day');
                    const nowMs = dayjs().valueOf();
                    const startMs = dayjs(event.start).valueOf();
                    const endMs = dayjs(event.end).valueOf();
                    const isCurrentTime = isToday && nowMs >= startMs && nowMs < endMs;

                    let maxEndBeforeMs = dayjs(event.start).startOf('day').valueOf();
                    let maxEndTodayMs = endMs;
                    for (let i = index - 1; i >= 0; i--) {
                        const p = myEvents[i];
                        if (!dayjs(p.start).isSame(event.start, 'day')) break;
                        const pEndMs = dayjs(p.end).valueOf();
                        if (pEndMs > maxEndBeforeMs) maxEndBeforeMs = pEndMs;
                        if (pEndMs > maxEndTodayMs) maxEndTodayMs = pEndMs;
                    }

                    const pauseMs = startMs - maxEndBeforeMs;
                    const morningPauseMs = !sameDayAsPrev ? pauseMs : 0;
                    const eveningPauseMs = !sameDayAsNext
                        ? dayjs(event.end).endOf('day').valueOf() - maxEndTodayMs
                        : 0;

                    const userColor = colors.find((c) => c.user_id === event.user_id);
                    const backgroundColor = userColor?.background_color || '#ccc';
                    const textColor = userColor?.text_color || '#000';
                    const durationMs = endMs - startMs;
                    let progress =
                        durationMs > 0
                            ? Math.max(
                                  0,
                                  Math.min(100, ((nowMs - startMs) / durationMs) * 100)
                              )
                            : 0;

                    const relevantUserEvents = event.is_group
                        ? userEvents.filter(
                              (u) =>
                                  u.event_id === event.id &&
                                  (u.instance_date ===
                                      dayjs(event.start).format('YYYY-MM-DD') ||
                                      !u.instance_date)
                          )
                        : [];
                    const count = relevantUserEvents.length;
                    const isJoinedGroup = relevantUserEvents.some(
                        (u) => u.user_id === user?.id
                    );
                    const participantNames = relevantUserEvents
                        .map((u) => {
                            const usr = users.find((x) => x.id === u.user_id);
                            return usr ? usr.username : 'Neznámý';
                        })
                        .join(', ');

                    const owner = users.find((u) => String(u.id) === String(event.user_id));
                    const ownerName = owner ? owner.username : 'Neznámý';

                    const groupBackgroundColor =
                        isJoinedGroup && count > 0 ? '#FF00AA' : 'rgba(200, 200, 200, 0.1)';
                    const groupBorderColor = '#FF00AA';
                    const groupTextColor = isJoinedGroup ? '#FFFFFF' : '#FF00AA';

                    return (
                        <View
                            key={`${event.id}-${startMs}`}
                            style={{ overflow: 'visible' }}
                        >
                            {index === 0 && (
                                <ThemedText style={styles.dayDivider}>
                                    {isToday
                                        ? 'Dnes'
                                        : dayjs(event.start).format('dddd D. MMMM')}
                                </ThemedText>
                            )}
                            {prev && !sameDayAsPrev && (
                                <ThemedText style={styles.dayDivider}>
                                    {isToday
                                        ? 'Dnes'
                                        : dayjs(event.start).format('dddd D. MMMM')}
                                </ThemedText>
                            )}

                            {morningPauseMs > 0 && !sameDayAsPrev && (
                                <Pressable
                                    style={{
                                        position: 'relative',
                                        marginBottom: 0,
                                        overflow: 'visible',
                                    }}
                                >
                                    <ThemedView style={styles.pauseCard}>
                                        <ThemedText style={styles.pauseText}>
                                            ⏳ 00:00 - {dayjs(event.start).format('HH:mm')} (
                                            {formatPause(morningPauseMs)} volno)
                                        </ThemedText>
                                    </ThemedView>
                                    {isToday &&
                                        nowMs >=
                                            dayjs(event.start).startOf('day').valueOf() &&
                                        nowMs < startMs && (
                                            <View
                                                style={[
                                                    styles.timeIndicatorWrapper,
                                                    {
                                                        top: `${((nowMs - dayjs(event.start).startOf('day').valueOf()) / morningPauseMs) * 100}%`,
                                                    },
                                                ]}
                                                pointerEvents="none"
                                            >
                                                <View style={styles.currentTimeDot} />
                                                <View style={styles.currentTimeLine} />
                                            </View>
                                        )}
                                </Pressable>
                            )}

                            {prev && sameDayAsPrev && pauseMs > 0 && (
                                <Pressable
                                    style={{
                                        position: 'relative',
                                        marginBottom: 0,
                                        overflow: 'visible',
                                    }}
                                >
                                    <ThemedView style={styles.pauseCard}>
                                        <ThemedText style={styles.pauseText}>
                                            ⏳ {dayjs(maxEndBeforeMs).format('HH:mm')} -{' '}
                                            {dayjs(event.start).format('HH:mm')} (
                                            {formatPause(pauseMs)} volno)
                                        </ThemedText>
                                    </ThemedView>
                                    {isToday && nowMs >= maxEndBeforeMs && nowMs < startMs && (
                                        <View
                                            style={[
                                                styles.timeIndicatorWrapper,
                                                {
                                                    top: `${((nowMs - maxEndBeforeMs) / pauseMs) * 100}%`,
                                                },
                                            ]}
                                            pointerEvents="none"
                                        >
                                            <View style={styles.currentTimeDot} />
                                            <View style={styles.currentTimeLine} />
                                        </View>
                                    )}
                                </Pressable>
                            )}

                            <Pressable
                                onPress={() => openEvent(event)}
                                style={{
                                    position: 'relative',
                                    marginBottom: 8,
                                    overflow: 'visible',
                                }}
                            >
                                <ThemedView
                                    style={[
                                        styles.eventCard,
                                        isCurrentTime && styles.currentEventCard,
                                        event.is_group && {
                                            backgroundColor: groupBackgroundColor,
                                            borderColor: groupBorderColor,
                                        },
                                        !event.is_group && {
                                            backgroundColor,
                                            borderColor: backgroundColor,
                                        },
                                        { marginBottom: 0 },
                                    ]}
                                >
                                    <ThemedText
                                        style={[
                                            styles.eventDate,
                                            {
                                                color: event.is_group
                                                    ? groupTextColor
                                                    : textColor,
                                            },
                                        ]}
                                    >
                                        {isToday ? 'Dnes' : dayjs(event.start).format('ddd D. M.')}{' '}
                                        · {dayjs(event.start).format('HH:mm')} –{' '}
                                        {dayjs(event.end).format('HH:mm')}
                                    </ThemedText>
                                    <ThemedText
                                        type="defaultSemiBold"
                                        style={{
                                            color: event.is_group
                                                ? groupTextColor
                                                : textColor,
                                        }}
                                    >
                                        {event.title}
                                    </ThemedText>
                                    {String(event.user_id) !== String(user?.id) && (
                                        <ThemedText
                                            style={[
                                                {
                                                    fontSize: 13,
                                                    marginBottom: 4,
                                                    opacity: 0.8,
                                                },
                                                {
                                                    color: event.is_group
                                                        ? groupTextColor
                                                        : textColor,
                                                },
                                            ]}
                                        >
                                            Od: {ownerName}
                                        </ThemedText>
                                    )}
                                    <ThemedText
                                        style={[
                                            styles.eventType,
                                            {
                                                color: event.is_group
                                                    ? groupTextColor
                                                    : textColor,
                                            },
                                        ]}
                                    >
                                        {event.is_group
                                            ? `Skupinová událost · ${participantNames || 'Žádní účastníci'} (${count}/${event.pocet_lidi})`
                                            : event.pravidelnost
                                              ? 'Pravidelná událost'
                                              : 'Osobní událost'}
                                    </ThemedText>
                                </ThemedView>

                                {isCurrentTime && (
                                    <View
                                        style={[
                                            styles.timeIndicatorWrapper,
                                            { top: `${progress}%` },
                                        ]}
                                        pointerEvents="none"
                                    >
                                        <View style={styles.currentTimeDot} />
                                        <View style={styles.currentTimeLine} />
                                    </View>
                                )}
                            </Pressable>

                            {eveningPauseMs > 0 && !sameDayAsNext && (
                                <Pressable
                                    style={{
                                        position: 'relative',
                                        marginBottom: 0,
                                        overflow: 'visible',
                                    }}
                                >
                                    <ThemedView style={styles.pauseCard}>
                                        <ThemedText style={styles.pauseText}>
                                            ⏳ {dayjs(maxEndTodayMs).format('HH:mm')} - 23:59 (
                                            {formatPause(eveningPauseMs)} volno)
                                        </ThemedText>
                                    </ThemedView>
                                    {isToday &&
                                        nowMs >= maxEndTodayMs &&
                                        nowMs < dayjs(event.end).endOf('day').valueOf() && (
                                            <View
                                                style={[
                                                    styles.timeIndicatorWrapper,
                                                    {
                                                        top: `${((nowMs - maxEndTodayMs) / eveningPauseMs) * 100}%`,
                                                    },
                                                ]}
                                                pointerEvents="none"
                                            >
                                                <View style={styles.currentTimeDot} />
                                                <View style={styles.currentTimeLine} />
                                            </View>
                                        )}
                                </Pressable>
                            )}
                        </View>
                    );
                }}
            />
        </ThemedSafeView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerContainer: { paddingHorizontal: 16, paddingTop: 16 },
    scrollView: { flex: 1 },
    list: { paddingBottom: 100, paddingHorizontal: 16 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { marginBottom: 4 },
    subtitle: { opacity: 0.7, marginBottom: 16 },
    eventCard: {
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        position: 'relative',
    },
    currentEventCard: {
        borderColor: '#00AAFF',
        borderWidth: 2,
        backgroundColor: 'rgba(0, 170, 255, 0.1)',
    },
    pauseCard: {
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ccc',
        marginBottom: 8,
        backgroundColor: 'rgba(200, 200, 200, 0.1)',
    },
    dayDivider: {
        textAlign: 'center',
        marginVertical: 12,
        fontWeight: '600',
        opacity: 0.8,
    },
    timeIndicatorWrapper: {
        position: 'absolute',
        left: -8,
        right: -8,
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 20,
        elevation: 10,
        marginTop: -5,
    },
    currentTimeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ff0000' },
    currentTimeLine: { flex: 1, height: 2, backgroundColor: '#ff0000' },
    empty: { textAlign: 'center', marginTop: 40, opacity: 0.6 },
    eventDate: { fontSize: 13, opacity: 0.7, marginBottom: 4 },
    eventType: { fontSize: 12, opacity: 0.6, marginTop: 4 },
    pauseText: { fontSize: 12, opacity: 0.7 },
});
