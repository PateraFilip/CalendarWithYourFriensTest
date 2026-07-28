import { Brand } from '@/constants/brand'
import { CellModal } from '@/components/CellModal'
import DayCalendar from '@/components/CustomDay/CustomDay'
import MonthCalendar from '@/components/CustomMonth/CustomMonth'
import WeekCalendar from '@/components/CustomWeek/CustomWeek'
import { AgendaTimeline } from '@/components/AgendaTimeline'
import { CalendarSwipeArea } from '@/components/CalendarSwipeArea'
import { CalendarViewMenu } from '@/components/CalendarViewMenu'
import { FilterModal } from '@/components/FilterModal'
import { MonthYearPickerModal } from '@/components/MonthYearPickerModal'
import { ThemedSafeView } from '@/components/ThemedSafeView'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { useNewEvent } from '@/contexts/NewEventContext'
import { useAppData } from '@/contexts/AppDataContext'
import { useAuth } from '@/hooks/useAuth'
import { useThemeColor } from '@/hooks/use-theme-color'
import { requestUserPermission } from '@/hooks/useNotificationHandler'
import { useCalendarEvents } from '@/hooks/useCalendarEvents'
import { registerAndSavePushToken } from '@/lib/push-notifications'
import { loadStorage, saveStorage } from '@/lib/storage'
import { shiftVisibleDate } from '@/lib/calendarPeriod'
import {
    CALENDAR_VIEW_OPTIONS,
    calendarViewFromLegacyIndex,
    loadCalendarViewMode,
    saveCalendarViewMode,
    type CalendarViewMode,
} from '@/lib/calendarViewPrefs'
import dayjs from 'dayjs'
import 'dayjs/locale/cs'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'

interface WeeklyEvent { id: number; title: string; cas_od: Date; cas_do: Date; user_id: number; den: string; }
interface Event { id: number; title: string; start: Date; end: Date; user_id: number; pocet_lidi: number; pravidelnost: boolean; is_group: boolean; original_start?: Date; original_end?: Date; }
interface EventException { id: number; start: Date; end: Date; event_id: number; typ: string; puvodni_start: Date; puvodni_end: Date; }
interface Color { id: number; name: string; background_color: string; text_color: string; user_id: string | null; }
interface User { id: number; username: string; jmeno: string; prijmeni: string; email: string; datum_narozeni: string }

dayjs.locale('cs')

const weeklyEvents: WeeklyEvent[] = []

/** Google-style: toolbar always shows month + year (picker target). */
function headerTitleForView(viewMode: CalendarViewMode, visibleDate: Date): string {
    if (viewMode === 'agenda') return 'Osa'
    return dayjs(visibleDate).format('MMMM YYYY')
}

export default function SharedCalendar() {
    const router = useRouter()

    const { user } = useAuth()
    const { openNewEvent } = useNewEvent()
    const { friendIds, colors, users } = useAppData()

    const filterUsers = useMemo(() => {
        const allowed = new Set(friendIds.map(String))
        if (user?.id) allowed.add(String(user.id))
        return (users as User[]).filter((u) => allowed.has(String(u.id)))
    }, [users, friendIds, user?.id])

    const { calendar, day } = useLocalSearchParams()
    const [selectedDate, setSelectedDate] = useState<Date | null>(day ? new Date(day as string) : new Date())
    const [visibleDate, setVisibleDate] = useState<Date>(day ? new Date(day as string) : new Date())
    const [viewMode, setViewMode] = useState<CalendarViewMode>('week')
    const [viewReady, setViewReady] = useState(false)
    const [viewMenuOpen, setViewMenuOpen] = useState(false)
    const [monthPickerOpen, setMonthPickerOpen] = useState(false)

    const { events, eventException, isLoading: isEventsLoading } = useCalendarEvents(user, visibleDate)

    const [uncheckedUserIds, setUncheckedUserIds] = useState<number[]>([])

    const textColor = useThemeColor({}, 'text')

    useEffect(() => {
        (async () => {
            try {
                const stored = await loadStorage('uncheckedUsersArray')
                if (stored) setUncheckedUserIds(JSON.parse(stored))
            } catch (e) {
                console.error('Chyba při načítání filtru:', e)
            }
            try {
                const mode = await loadCalendarViewMode()
                setViewMode(mode)
            } finally {
                setViewReady(true)
            }
        })()
    }, [])

    useEffect(() => {
        if (calendar !== undefined && calendar !== null && calendar !== '') {
            const idx = Number(calendar)
            if (!Number.isNaN(idx)) {
                const mode = calendarViewFromLegacyIndex(idx)
                setViewMode(mode)
                void saveCalendarViewMode(mode)
            }
        }
        if (day) {
            const d = new Date(day as string)
            setSelectedDate(d)
            setVisibleDate(d)
        }
    }, [calendar, day])

    const handleSelectView = (mode: CalendarViewMode) => {
        setViewMode(mode)
        setViewMenuOpen(false)
        void saveCalendarViewMode(mode)
    }

    const shiftPeriod = useCallback((direction: -1 | 1) => {
        setVisibleDate((prev) => shiftVisibleDate(prev, viewMode, direction))
    }, [viewMode])

    const handleSwipePrev = useCallback(() => shiftPeriod(-1), [shiftPeriod])
    const handleSwipeNext = useCallback(() => shiftPeriod(1), [shiftPeriod])

    const handleToggleUser = (userId: number) => {
        setUncheckedUserIds(prev => {
            let nextState
            if (prev.includes(userId)) {
                nextState = prev.filter(id => id !== userId)
            } else {
                nextState = [...prev, userId]
            }
            saveStorage('uncheckedUsersArray', JSON.stringify(nextState)).catch(e => console.error(e))
            return nextState
        })
    }

    const filteredEvents = useMemo(() => {
        if (uncheckedUserIds.length === 0) return events
        return events.filter(e => e.is_group === true || !uncheckedUserIds.includes(e.user_id))
    }, [events, uncheckedUserIds])

    const filteredWeeklyEvents = useMemo(() => {
        if (uncheckedUserIds.length === 0) return weeklyEvents
        return weeklyEvents.filter(e => !uncheckedUserIds.includes(e.user_id))
    }, [uncheckedUserIds])

    useEffect(() => {
        const initNotifications = async () => {
            const userId = user?.auth_user_id || user?.id
            if (!userId) return
            if (Platform.OS === 'web') {
                if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                    await registerAndSavePushToken(String(userId))
                }
                return
            }
            await requestUserPermission()
            await registerAndSavePushToken(String(userId))
        }
        initNotifications()
    }, [user])

    const [cellModalVisible, setCellModalVisible] = useState(false)
    const [pendingCreateDate, setPendingCreateDate] = useState<Date | null>(null)
    const [filterModalVisible, setFilterModalVisible] = useState(false)

    const selectCalendar = () => {
        if (viewMode === 'agenda') {
            return (
                <AgendaTimeline
                    showHeader={false}
                    uncheckedUserIds={uncheckedUserIds}
                />
            )
        }

        return (
            <CalendarSwipeArea
                enabled
                onSwipePrev={handleSwipePrev}
                onSwipeNext={handleSwipeNext}
            >
                {isEventsLoading && (
                    <ThemedView style={{ position: 'absolute', top: 8, left: 0, right: 0, zIndex: 10, alignItems: 'center' }}>
                        <ThemedView style={{ backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 }}>
                            <Text style={{ color: 'white' }}>Načítání událostí...</Text>
                        </ThemedView>
                    </ThemedView>
                )}
                {viewMode === 'week' || viewMode === 'threeDay' ? (
                    <WeekCalendar
                        events={filteredEvents}
                        weeklyEvents={filteredWeeklyEvents}
                        eventsException={eventException}
                        defaultDate={visibleDate}
                        dayCount={viewMode === 'threeDay' ? 3 : 7}
                        onPressCell={(date) => { setSelectedDate(date); setCellModalVisible(true) }}
                        onPressDay={(date) => { setSelectedDate(date); setVisibleDate(date); handleSelectView('day') }}
                        onPressEvent={(event, atHour) => {
                            setSelectedDate(atHour ?? event.start);
                            setCellModalVisible(true);
                        }}
                        hourHeight={viewMode === 'threeDay' ? 60 : 52}
                        colors={colors}
                        onVisibleDateChange={setVisibleDate}
                    />
                ) : viewMode === 'day' ? (
                    <DayCalendar
                        events={filteredEvents}
                        weeklyEvents={filteredWeeklyEvents}
                        eventsException={eventException}
                        defaultDate={visibleDate}
                        onPressCell={(date) => { setSelectedDate(date); setCellModalVisible(true) }}
                        onPressEvent={(event, atHour) => {
                            setSelectedDate(atHour ?? event.start);
                            setCellModalVisible(true);
                        }}
                        hourHeight={100}
                        colors={colors}
                        onVisibleDateChange={setVisibleDate}
                    />
                ) : (
                    <MonthCalendar
                        events={filteredEvents}
                        weeklyEvents={filteredWeeklyEvents}
                        eventsException={eventException}
                        defaultDate={visibleDate}
                        selectedDate={selectedDate}
                        onPressDay={(date) => { setSelectedDate(date) }}
                        onPressEvent={(event) => { setSelectedDate(event.start); setCellModalVisible(true) }}
                        colors={colors}
                        onVisibleDateChange={setVisibleDate}
                    />
                )}
            </CalendarSwipeArea>
        )
    }

    useEffect(() => {
        if (!cellModalVisible && pendingCreateDate) { openNewEvent(pendingCreateDate); setPendingCreateDate(null) }
    }, [cellModalVisible, pendingCreateDate, openNewEvent])

    const activeViewLabel = CALENDAR_VIEW_OPTIONS.find(o => o.value === viewMode)?.label ?? 'Týden'
    const canPickMonth = viewMode !== 'agenda'

    return (
        <ThemedSafeView style={styles.container}>
            <ThemedView style={styles.headerBar}>
                <Pressable
                    onPress={() => setViewMenuOpen(true)}
                    style={styles.menuButton}
                    hitSlop={12}
                    accessibilityLabel="Přepnout pohled kalendáře"
                    accessibilityRole="button"
                >
                    <MaterialCommunityIcons name="menu" size={26} color={textColor} />
                </Pressable>

                <TouchableOpacity
                    style={styles.headerTitleWrap}
                    onPress={() => canPickMonth && setMonthPickerOpen(true)}
                    disabled={!canPickMonth}
                    accessibilityLabel="Vybrat měsíc a rok"
                    accessibilityRole="button"
                >
                    <View style={styles.headerTitleRow}>
                        <ThemedText style={styles.headerTitle} numberOfLines={1}>
                            {viewReady ? headerTitleForView(viewMode, visibleDate) : '…'}
                        </ThemedText>
                        {canPickMonth && (
                            <MaterialCommunityIcons
                                name="menu-down"
                                size={22}
                                color={textColor}
                                style={styles.headerChevron}
                            />
                        )}
                    </View>
                    <ThemedText style={styles.headerViewHint}>{activeViewLabel}</ThemedText>
                </TouchableOpacity>

                <View style={styles.headerActions}>
                    <TouchableOpacity
                        onPress={() => openNewEvent()}
                        style={styles.addButton}
                        accessibilityLabel="Přidat událost"
                        accessibilityRole="button"
                    >
                        <MaterialCommunityIcons name="plus" size={22} color={Brand.onPrimary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setFilterModalVisible(true)}
                        style={styles.filterButton}
                        accessibilityLabel="Filtr lidí"
                        accessibilityRole="button"
                    >
                        <IconSymbol color={Brand.primary} name="filter.fill" />
                        <ThemedText style={styles.filterCount}>
                            ({uncheckedUserIds.length})
                        </ThemedText>
                    </TouchableOpacity>
                </View>
            </ThemedView>

            <CalendarViewMenu
                visible={viewMenuOpen}
                current={viewMode}
                onDismiss={() => setViewMenuOpen(false)}
                onSelect={handleSelectView}
            />

            {viewReady ? selectCalendar() : (
                <View style={styles.loadingWrap}>
                    <Text style={{ color: textColor }}>Načítám pohled…</Text>
                </View>
            )}

            <MonthYearPickerModal
                visible={monthPickerOpen}
                date={visibleDate}
                onDismiss={() => setMonthPickerOpen(false)}
                onSelect={(d) => {
                    setVisibleDate(d)
                    setSelectedDate(d)
                }}
            />

            <CellModal visible={cellModalVisible} date={selectedDate} events={filteredEvents} weeklyEvents={[]} colors={colors} users={users} eventsException={eventException}
                onCreateEvent={() => { setPendingCreateDate(selectedDate ?? new Date()); setCellModalVisible(false) }}
                onPressEvent={(event: any) => {
                    setCellModalVisible(false)
                    const instanceDate = event.instance_date || dayjs(event.start).format('YYYY-MM-DD')
                    router.push({
                        pathname: `/events/${event.id}`,
                        params: {
                            event: JSON.stringify(event),
                            instance_date: instanceDate,
                        },
                    })
                }}
                onDismiss={() => setCellModalVisible(false)}
            />

            <FilterModal
                visible={filterModalVisible}
                uncheckedUserIds={uncheckedUserIds}
                users={filterUsers}
                onToggleUser={handleToggleUser}
                onDismiss={() => setFilterModalVisible(false)}
                colors={colors}
            />
        </ThemedSafeView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 4,
        paddingVertical: 6,
        minHeight: 48,
        zIndex: 20,
        elevation: 4,
    },
    menuButton: {
        padding: 8,
        marginRight: 4,
        zIndex: 21,
    },
    headerTitleWrap: {
        flex: 1,
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingVertical: 2,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        textTransform: 'capitalize',
    },
    headerChevron: {
        marginLeft: 2,
        marginTop: 1,
    },
    headerViewHint: {
        fontSize: 12,
        opacity: 0.55,
        marginTop: 1,
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Brand.primarySoft,
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderRadius: 20,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginRight: 4,
    },
    addButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Brand.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterCount: {
        fontWeight: 'bold',
        marginLeft: 4,
        color: Brand.primary,
    },
    loadingWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
})
