import { Brand, BrandSurfaces } from '@/constants/brand'
import { createPatternEvent } from '@/services/events/create_event'

import { createException } from '@/services/events/create_exception'

import { deleteEvent } from '@/services/events/delete_event'

import { fetchUserEvents, UserEvent } from '@/services/events/getUserEvents'

import { fetchColors } from '@/services/users/get_colors'
import { fetchUsers } from '@/services/users/get_users'

import { cancelEvent } from '@/services/events/cancel_event'
import { joinEvent } from '@/services/events/join_event'
import {
    fetchEventInviteIds,
    getDefaultInviteIds,
    setEventInvites,
} from '@/services/events/invites'
import {
    notifyEventParticipants,
    notifyInvitesAboutSlotFreed,
    notifyNewlyInvited,
} from '@/services/notifications/eventNotify'
import { fetchMyFriendships } from '@/services/friends/friendships'

import { updateEvent, updateWeeklyEvent } from '@/services/events/update_event'

import { ThemedSafeView } from '@/components/ThemedSafeView'

import { ThemedText } from '@/components/themed-text'

import { ThemedView } from '@/components/themed-view'

import { useThemeColor } from '@/hooks/use-theme-color'
import { useColorScheme } from '@/hooks/use-color-scheme'

import { useAuth } from '@/hooks/useAuth'
import { useAppDataOptional } from '@/contexts/AppDataContext'

import { getSafeDates } from '@/lib/eventDates'
import { supabase } from '@/lib/supabaseClient'

import dayjs from 'dayjs'
import 'dayjs/locale/cs'

import { Stack, useLocalSearchParams, useRouter } from 'expo-router'

import { MaterialCommunityIcons } from '@expo/vector-icons'

import React, { useEffect, useState } from 'react'

import {
    ActivityIndicator,
    Alert,
    Linking,
    LogBox,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput as RNTextInput,
    View,
} from 'react-native'

import EventMap from '@/components/EventMap'
import { FormChip, WhenRow } from '@/components/formUi'
import { LocationAutocomplete } from '@/components/LocationAutocomplete'
import { SelectablePeopleList } from '@/components/SelectablePeopleList'

import {
    Button,
    Dialog,
    IconButton,
    Modal,
    Portal,
} from 'react-native-paper'

import { DatePickerModal, TimePickerModal } from 'react-native-paper-dates'

LogBox.ignoreLogs(['VirtualizedLists should never be nested'])

function userInitials(u?: {
    jmeno?: string | null
    prijmeni?: string | null
    username?: string | null
} | null): string {
    if (!u) return '?'
    const a = (u.jmeno || '').trim().charAt(0)
    const b = (u.prijmeni || '').trim().charAt(0)
    if (a || b) return `${a}${b}`.toUpperCase()
    return (u.username || '?').slice(0, 2).toUpperCase()
}

interface User {
    id: number
    username: string
    jmeno: string
    prijmeni: string
    email: string
    datum_narozeni: string
}

interface PatternSegment {
    id: string
    type: 'work' | 'off'
    days: number
    startTime?: Date
    endTime?: Date
}

export default function EventDetail() {
    const router = useRouter()

    const {
        event: eventParam,
        eventId,
        instance_date,
    } = useLocalSearchParams<{
        event?: string
        eventId?: string
        instance_date?: string
    }>()

    const initialEventObj = eventParam
        ? {
              ...JSON.parse(eventParam),
              instance_date:
                  instance_date &&
                  instance_date !== 'undefined' &&
                  instance_date !== 'null'
                      ? instance_date
                      : JSON.parse(eventParam).instance_date,
          }
        : null

    const [eventObj, setEventObj] = useState<any>(initialEventObj)
    const [isLoadingEvent, setIsLoadingEvent] = useState(
        !initialEventObj && !!eventId
    )

    const [userEvents, setUserEvents] = useState<UserEvent[]>([])

    const { user } = useAuth()
    const appData = useAppDataOptional()

    const scheme = useColorScheme() ?? 'light'
    const surfaces = BrandSurfaces[scheme]

    const buttonColor = Brand.primary

    const buttonTextColor = Brand.onPrimary

    const chipInactive = useThemeColor(
        { light: '#3c4043', dark: '#E8EAED' },
        'text'
    )
    const chipInactiveBorder = useThemeColor(
        { light: '#80868b', dark: '#BDC1C6' },
        'text'
    )

    const modalBackgroundColor = useThemeColor(
        { light: '#ffffff', dark: '#1c1c1e' },
        'background'
    )

    const cardBackgroundColor = useThemeColor(
        { light: '#f5f5f5', dark: '#2c2c2e' },
        'background'
    )

    const borderColorTheme = surfaces.border

    const secondaryTextColor = surfaces.textSecondary

    const [isModalVisible, setModalVisible] = useState(false)

    const [scopeDialogVisible, setScopeDialogVisible] = useState(false)
    const [deleteDialogVisible, setDeleteDialogVisible] = useState(false)
    const [multiDateDeleteModalVisible, setMultiDateDeleteModalVisible] =
        useState(false)

    const [editField, setEditField] = useState<
        | 'title'
        | 'datetime'
        | 'capacity'
        | 'participants'
        | 'location'
        | 'all'
        | null
    >(null)

    const [editAllInstances, setEditAllInstances] = useState(false)
    /** true = tento den a budoucí (ne celá historie) */
    const [editFutureOnly, setEditFutureOnly] = useState(false)

    const [isGroupEvent, setIsGroupEvent] = useState(!!eventObj?.is_group)

    const [title, setTitle] = useState(eventObj?.title || '')

    const [poloha, setPoloha] = useState(eventObj?.poloha || '')

    const [latitude, setLatitude] = useState<number | null>(
        eventObj?.latitude || null
    )

    const [longitude, setLongitude] = useState<number | null>(
        eventObj?.longitude || null
    )

    const [actionBusy, setActionBusy] = useState(false)

    const [peopleCount, setPeopleCount] = useState(eventObj?.pocet_lidi || 2)

    const initialDates = getSafeDates(eventObj)

    const [dateRange, setDateRange] = useState<{
        startDate?: Date
        endDate?: Date
    }>({ startDate: initialDates.s, endDate: initialDates.e })

    const [timeRange, setTimeRange] = useState<{ start?: Date; end?: Date }>({
        start: initialDates.s,
        end: initialDates.e,
    })

    useEffect(() => {
        if (eventObj && !initialEventObj) {
            setTitle(eventObj.title || '')
            setPoloha(eventObj.poloha || '')
            setLatitude(eventObj.latitude || null)
            setLongitude(eventObj.longitude || null)
            setPeopleCount(eventObj.pocet_lidi || 2)
            setIsGroupEvent(!!eventObj.is_group)
            const safeDates = getSafeDates(eventObj)
            setDateRange({ startDate: safeDates.s, endDate: safeDates.e })
            setTimeRange({ start: safeDates.s, end: safeDates.e })
        }
    }, [eventObj?.id])

    const [validUntilDate, setValidUntilDate] = useState<Date | undefined>(
        undefined
    )

    const [endDateModalVisible, setEndDateModalVisible] = useState(false)

    const [dateModalVisible, setDateModalVisible] = useState(false)

    const [timeModalVisible, setTimeModalVisible] = useState(false)

    const [timeStep, setTimeStep] = useState<'start' | 'end'>('start')

    const [timeContext, setTimeContext] = useState<
        'once' | 'multi' | 'patternSegment'
    >('once')

    const [relatedEvents, setRelatedEvents] = useState<any[]>([])

    const [editingRelatedEvent, setEditingRelatedEvent] = useState<any | null>(
        null
    )

    const [multiDateInstances, setMultiDateInstances] = useState<
        Array<{ id?: number; date: Date; startTime: Date; endTime: Date; nazev?: string; poloha?: string; latitude?: number | null; longitude?: number | null; pocet_lidi?: number; is_group?: boolean }>
    >([])

    const [editingMultiDateIndex, setEditingMultiDateIndex] = useState<
        number | null
    >(null)

    const [patternSegments, setPatternSegments] = useState<PatternSegment[]>([])

    const [editingSegmentId, setEditingSegmentId] = useState<string | null>(
        null
    )

    const [users, setUsers] = useState<User[]>([])

    const [cancelAllInstances, setCancelAllInstances] = useState(false)

    const [selectedParticipants, setSelectedParticipants] = useState<number[]>(
        []
    )

    const [selectedInvites, setSelectedInvites] = useState<Array<string | number>>(
        []
    )

    const [friendUsers, setFriendUsers] = useState<User[]>([])

    const [participantModalVisible, setParticipantModalVisible] =
        useState(false)

    const [colors, setColors] = useState<any[]>([])

    const loadUserEvent = async () => {
        try {
            const data = await fetchUserEvents()
            setUserEvents(data)
        } catch (err) { }
    }

    const loadUsers = async () => {
        try {
            const data = await fetchUsers()
            setUsers(data)
        } catch (err) { }
    }

    const loadColors = async () => {
        try {
            const data = await fetchColors()
            setColors(data)
        } catch (err) { }
    }

    const loadRecurrenceRule = async () => {
        if (!eventObj?.id) return

        try {
            const { data } = await supabase
                .from('event_series')
                .select('recurrence_rule, group_id')
                .eq('id', eventObj.id)
                .single()

            if (data) {
                const updates: any = {}
                if (data.recurrence_rule && !eventObj.recurrence_rule)
                    updates.recurrence_rule = data.recurrence_rule
                if (
                    data.group_id !== undefined &&
                    eventObj.group_id === undefined
                )
                    updates.group_id = data.group_id
                if (Object.keys(updates).length > 0) {
                    setEventObj((prev) => ({ ...prev, ...updates }))
                }
            }
        } catch (err) {
            console.error('Error loading recurrence_rule:', err)
        }
    }

    const loadRelatedEvents = async () => {
        if (!eventObj) return

        if (eventObj.series_id) {
            const { data } = await supabase
                .from('events')
                .select('*')
                .eq('series_id', eventObj.series_id)
                .order('start', { ascending: true })

            if (data) setRelatedEvents(data)
        } else if (eventObj.group_id) {
            const { data } = await supabase
                .from('event_series')
                .select('*')
                .eq('group_id', eventObj.group_id)
                .order('valid_from', { ascending: true })

            if (data) {
                setRelatedEvents(data)
                const instances = data.map((ev: any) => {
                    const s = new Date(ev.valid_from)
                    const [hours, minutes] = String(ev.cas_od)
                        .split(':')
                        .map(Number)
                    s.setHours(hours || 8, minutes || 0, 0, 0)
                    const e = new Date(s)
                    const [endHours, endMinutes] = String(ev.cas_do)
                        .split(':')
                        .map(Number)
                    e.setHours(endHours || 9, endMinutes || 0, 0, 0)
                    return {
                        id: ev.id,
                        date: s,
                        startTime: s,
                        endTime: e,
                        nazev: ev.nazev,
                        poloha: ev.poloha,
                        latitude: ev.latitude,
                        longitude: ev.longitude,
                        pocet_lidi: ev.pocet_lidi,
                        is_group: ev.is_group
                    }
                })
                setMultiDateInstances(instances)
            }
        } else {
            setRelatedEvents([eventObj])
        }
    }

    useEffect(() => {
        loadUsers()
        loadUserEvent()
        loadRelatedEvents()
        loadRecurrenceRule()
        loadColors()
    }, [])

    // Realtime: účastníci + změny série / výjimek
    useEffect(() => {
        const seriesId = eventObj?.id || (eventId ? Number(eventId) : null)
        if (!seriesId) return

        const channel = supabase
            .channel(`event-detail-${seriesId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'event_users',
                    filter: `series_id=eq.${seriesId}`,
                },
                () => {
                    loadUserEvent()
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'event_series',
                    filter: `id=eq.${seriesId}`,
                },
                () => {
                    fetchEventFromDb(String(seriesId), instance_date)
                    loadRelatedEvents()
                    loadRecurrenceRule()
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'series_exceptions',
                    filter: `series_id=eq.${seriesId}`,
                },
                () => {
                    fetchEventFromDb(String(seriesId), instance_date)
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'event_invites',
                    filter: `series_id=eq.${seriesId}`,
                },
                () => {
                    // pozvánky → obnov seznam (loadInvitesAndFriends běží přes users)
                    loadUserEvent()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [eventObj?.id, eventId, instance_date])

    useEffect(() => {
        if (!initialEventObj && eventId) {
            fetchEventFromDb(eventId, instance_date)
        }
    }, [eventId, instance_date])

    useEffect(() => {
        if (eventObj && relatedEvents.length === 0) {
            loadRelatedEvents()
        }
    }, [eventObj?.series_id, eventObj?.group_id, eventObj?.id])

    useEffect(() => {
        const loadInvitesAndFriends = async () => {
            if (!user?.id || users.length === 0) return
            try {
                const friendships = await fetchMyFriendships(String(user.id))
                const friendIdSet = new Set(
                    friendships
                        .filter((f) => f.status === 'accepted')
                        .map((f) =>
                            String(f.user_id) === String(user.id)
                                ? String(f.friend_id)
                                : String(f.user_id)
                        )
                )
                setFriendUsers(users.filter((u) => friendIdSet.has(String(u.id))))

                if (eventObj?.id && eventObj.is_group) {
                    const invites = await fetchEventInviteIds(eventObj.id)
                    setSelectedInvites(invites)
                } else if (eventObj?.id && !eventObj.is_group) {
                    const defaults = await getDefaultInviteIds(user.id)
                    setSelectedInvites(defaults)
                }
            } catch (err) {
                console.error(err)
            }
        }
        loadInvitesAndFriends()
    }, [user?.id, users, eventObj?.id, eventObj?.is_group])

    const fetchEventFromDb = async (id: string, date?: string) => {
        try {
            const { data: series } = await supabase
                .from('event_series')
                .select('*')
                .eq('id', id)
                .single()
            if (series) {
                const isInvalidString = typeof date === 'string' && (date === 'undefined' || date === 'null' || date.trim() === '');
                const actualDate = !date || isInvalidString ? undefined : date;
                const r = series.recurrence_rule

                let startDateStr = series.valid_from
                let endDateStr = series.valid_until

                if (r?.type === 'pattern' && actualDate) {
                    startDateStr = actualDate
                    endDateStr = actualDate
                } else if (r?.type === 'once') {
                    if (r.start_date) startDateStr = r.start_date
                    if (r.end_date) endDateStr = r.end_date
                }

                const s = new Date(startDateStr || new Date())
                const [h, m] = series.cas_od.split(':')
                s.setHours(Number(h) || 8, Number(m) || 0, 0, 0)

                const e = new Date(endDateStr || s)
                const [eh, em] = series.cas_do.split(':')
                e.setHours(Number(eh) || 9, Number(em) || 0, 0, 0)

                setEventObj({
                    id: series.id,
                    series_id: series.recurrence_rule?.type === 'pattern' ? series.id : undefined,
                    title: series.nazev,
                    start: s,
                    end: e,
                    user_id: series.zakladatel_id,
                    pocet_lidi: series.pocet_lidi,
                    pravidelnost: series.recurrence_rule?.type === 'pattern',
                    is_group: !!series.is_group,
                    recurrence_rule: series.recurrence_rule,
                    group_id: series.group_id,
                    instance_date: date,
                    poloha: series.poloha,
                    latitude: series.latitude,
                    longitude: series.longitude,
                })
            }
        } catch (e) {
            console.error(e)
        } finally {
            setIsLoadingEvent(false)
        }
    }

    if (isLoadingEvent)
        return (
            <ThemedSafeView
                style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
            >
                <ActivityIndicator size="large" />
            </ThemedSafeView>
        )

    if (!eventObj)
        return (
            <ThemedSafeView>
                <ThemedText>Event nenalezen</ThemedText>
            </ThemedSafeView>
        )

    const formatDate = (d: string | Date) => dayjs(d).format('D. M. YYYY')

    const formatTime = (d?: string | Date | null) =>
        d ? dayjs(d).format('H:mm') : '—'

    const formatWhen = (date?: Date | null, time?: Date | null) => {
        if (!date && !time) return 'Vyber datum a čas'
        const d = date || time
        const t = time || date
        if (!d || !t) return 'Vyber datum a čas'
        return `${dayjs(d)
            .format('ddd D. M.')
            .replace(/\.$/, '')
            .replace(/^./, (c) => c.toUpperCase())} · ${dayjs(t).format('H:mm')}`
    }

    const founderId = String(
        eventObj.user_id ?? eventObj.zakladatel_id ?? user?.id ?? ''
    )
    const founderColor =
        colors.find((c) => String(c.user_id) === founderId)
            ?.background_color || Brand.primary
    const accentColor = isGroupEvent ? Brand.groupEvent : founderColor

    const editModalTitle =
        editField === 'title'
            ? 'Název'
            : editField === 'location'
              ? 'Místo'
              : editField === 'capacity'
                ? 'Typ, kapacita a lidé'
                : editField === 'participants'
                  ? 'Účastníci'
                  : editField === 'datetime'
                    ? !eventObj.pravidelnost && !eventObj.group_id
                        ? 'Datum a čas'
                        : editAllInstances
                          ? 'Úprava řady / cyklu'
                          : 'Výjimka pro den'
                    : 'Úprava'

    const increase = () => setPeopleCount((prev) => prev + 1)

    const decrease = () =>
        setPeopleCount((prev) => {
            let minAllowed = 1
            if (eventObj) {
                const itemInstanceDate = dayjs(eventObj.start).format(
                    'YYYY-MM-DD'
                )
                const clearedMarker = userEvents.find(
                    (u) =>
                        u.event_id === eventObj.id &&
                        u.instance_date === `CLEARED-${itemInstanceDate}`
                )
                const instanceSpecificEvents = userEvents.filter(
                    (u) =>
                        u.event_id === eventObj.id &&
                        u.instance_date === itemInstanceDate
                )
                let relevant: any[] = []
                if (eventObj.pravidelnost) {
                    if (clearedMarker) relevant = []
                    else if (instanceSpecificEvents.length > 0)
                        relevant = instanceSpecificEvents
                    else
                        relevant = userEvents.filter(
                            (u) =>
                                u.event_id === eventObj.id && !u.instance_date
                        )
                } else {
                    relevant = userEvents.filter(
                        (u) => u.event_id === eventObj.id && !u.instance_date
                    )
                }
                minAllowed = Math.max(1, relevant.length)
            }
            return prev > minAllowed ? prev - 1 : prev
        })

    // --- JEDNOTNÁ FUNKCE PRO KLIKNUTÍ NA JAKOUKOLIV TUŽKU ---

    const loadPeopleForEdit = () => {
        const isRecurring = !!eventObj.pravidelnost

        if (!editAllInstances && isRecurring) {
            const instanceDateStr = dayjs(
                eventObj.instance_date || eventObj.start
            ).format('YYYY-MM-DD')
            const clearedMarker = userEvents.find(
                (u) =>
                    u.event_id === eventObj.id &&
                    u.instance_date === `CLEARED-${instanceDateStr}`
            )
            const instanceSpecificEvents = userEvents.filter(
                (u) =>
                    u.event_id === eventObj.id &&
                    u.instance_date === instanceDateStr
            )

            if (clearedMarker) {
                setSelectedParticipants([])
            } else if (instanceSpecificEvents.length > 0) {
                setSelectedParticipants(
                    instanceSpecificEvents.map((ue) => Number(ue.user_id))
                )
            } else {
                setSelectedParticipants(
                    userEvents
                        .filter(
                            (u) =>
                                u.event_id === eventObj.id && !u.instance_date
                        )
                        .map((ue) => Number(ue.user_id))
                )
            }
        } else {
            setSelectedParticipants(
                userEvents
                    .filter(
                        (u) => u.event_id === eventObj.id && !u.instance_date
                    )
                    .map((ue) => Number(ue.user_id))
            )
        }

        fetchEventInviteIds(eventObj.id)
            .then(async (invites) => {
                if (invites.length > 0) {
                    setSelectedInvites(invites)
                } else if (user?.id) {
                    setSelectedInvites(await getDefaultInviteIds(user.id))
                }
            })
            .catch(console.error)
    }

    const handleEditClick = (
        field: 'title' | 'datetime' | 'capacity' | 'participants' | 'location'
    ) => {
        setEditField(field)

        // Předvyplnění hodnot pro formuláře v modalu

        if (field === 'title') setTitle(eventObj.title || '')

        if (field === 'location') {
            setPoloha(eventObj.poloha || '')

            setLatitude(eventObj.latitude || null)

            setLongitude(eventObj.longitude || null)
        }

        if (field === 'capacity') {
            setPeopleCount(eventObj.pocet_lidi || 2)
            setIsGroupEvent(!!eventObj.is_group)
            loadPeopleForEdit()
        }

        if (field === 'participants') {
            loadPeopleForEdit()
        }

        // Pokud jde o cyklus/sérii nebo multi-date skupinu, vždy vyvoláme Dialog s rozcestníkem rozsahu změn
        const recurrenceRule =
            typeof eventObj.recurrence_rule === 'string'
                ? JSON.parse(eventObj.recurrence_rule)
                : eventObj.recurrence_rule
        console.log('handleEditClick debug:', {
            field,
            pravidelnost: eventObj.pravidelnost,
            relatedEventsLength: relatedEvents.length,
            group_id: eventObj.group_id,
            recurrenceRuleType: recurrenceRule?.type,
        })
        const isRecurring =
            eventObj.pravidelnost ||
            relatedEvents.length > 1 ||
            eventObj.group_id ||
            (recurrenceRule?.type && recurrenceRule.type !== 'once')

        console.log('isRecurring:', isRecurring)

        if (isRecurring) {
            setScopeDialogVisible(true)
        } else {
            setEditAllInstances(false)

            openMainModal(false)
        }
    }

    const handleScopeSelection = (scope: 'instance' | 'future' | 'all') => {
        setScopeDialogVisible(false)
        setEditAllInstances(scope !== 'instance')
        setEditFutureOnly(scope === 'future')
        openMainModal(scope !== 'instance')
    }

    // --- PARSER CYKLU Z DATABÁZE ---

    const openMainModal = (allInstancesFlag?: boolean) => {
        const isAll =
            allInstancesFlag !== undefined ? allInstancesFlag : editAllInstances

        setDateRange({
            startDate: new Date(eventObj.valid_from || eventObj.start),

            endDate: new Date(eventObj.end),
        })

        const endValidity = eventObj.valid_until
            ? new Date(eventObj.valid_until)
            : undefined

        setValidUntilDate(endValidity)

        setTimeRange({
            start: new Date(eventObj.start),
            end: new Date(eventObj.end),
        })

        setEditingRelatedEvent(null)

        setEditingMultiDateIndex(null)

        // Load multi-date instances if editing all instances of a multi-date event
        if (isAll && eventObj.group_id && multiDateInstances.length === 0) {
            loadRelatedEvents()
        }

        if (eventObj.pravidelnost && isAll && eventObj.recurrence_rule) {
            try {
                let rule = eventObj.recurrence_rule

                if (typeof rule === 'string') {
                    try {
                        rule = JSON.parse(rule)
                    } catch (e) { }
                }

                if (typeof rule === 'string') {
                    try {
                        rule = JSON.parse(rule)
                    } catch (e) { }
                }

                if (rule && rule.pattern && Array.isArray(rule.pattern)) {
                    if (rule.anchor_date) {
                        setDateRange((prev) => ({
                            ...prev,
                            startDate: new Date(rule.anchor_date),
                        }))
                    }

                    const parsedSegments: any[] = []

                    let curr: any = null

                    rule.pattern.forEach((day: any) => {
                        const type = day.work ? 'work' : 'off'

                        const start = day.work
                            ? String(day.start || '08:00')
                            : undefined

                        const end = day.work
                            ? String(day.end || '16:00')
                            : undefined

                        if (!curr) {
                            curr = { type, days: 1, start, end }
                        } else if (
                            curr.type === type &&
                            (type === 'off' ||
                                (curr.start === start && curr.end === end))
                        ) {
                            curr.days++
                        } else {
                            parsedSegments.push(curr)

                            curr = { type, days: 1, start, end }
                        }
                    })

                    if (curr) parsedSegments.push(curr)

                    const finalSegments = parsedSegments.map((s, idx) => {
                        const sTime = new Date()
                        const eTime = new Date()

                        if (s.start && s.start.includes(':')) {
                            const parts = s.start.split(':')
                            sTime.setHours(
                                Number(parts[0]) || 8,
                                Number(parts[1]) || 0,
                                0,
                                0
                            )
                        } else {
                            sTime.setHours(8, 0, 0, 0)
                        }

                        if (s.end && s.end.includes(':')) {
                            const parts = s.end.split(':')
                            eTime.setHours(
                                Number(parts[0]) || 16,
                                Number(parts[1]) || 0,
                                0,
                                0
                            )
                        } else {
                            eTime.setHours(16, 0, 0, 0)
                        }

                        return {
                            id: `seg-${idx}-${Date.now()}`,

                            type: s.type,
                            days: s.days,

                            startTime: s.type === 'work' ? sTime : undefined,

                            endTime: s.type === 'work' ? eTime : undefined,
                        }
                    })

                    setPatternSegments(finalSegments)

                    setModalVisible(true)

                    return
                }
            } catch (err) {
                console.error('Chyba při dekódování cyklu z databáze:', err)
            }
        }

        if (eventObj.pravidelnost) {
            setPatternSegments([
                {
                    id: 'def-1',
                    type: 'work',
                    days: 2,
                    startTime: dayjs().hour(8).minute(0).toDate(),
                    endTime: dayjs().hour(16).minute(0).toDate(),
                },

                { id: 'def-2', type: 'off', days: 1 },
            ])
        }

        setModalVisible(true)
    }

    const getSaveDates = () => {
        if (dateRange.startDate && timeRange.start) {
            const s = new Date(dateRange.startDate)
            s.setHours(
                timeRange.start.getHours(),
                timeRange.start.getMinutes(),
                0,
                0
            )

            const e =
                dateRange.endDate && timeRange.end
                    ? new Date(dateRange.endDate)
                    : new Date(s)

            if (timeRange.end)
                e.setHours(
                    timeRange.end.getHours(),
                    timeRange.end.getMinutes(),
                    0,
                    0
                )

            return { start: s, end: e }
        }

        return { start: new Date(eventObj.start), end: new Date(eventObj.end) }
    }

    const handleSave = async () => {
      if (actionBusy) return
      setActionBusy(true)
      try {
        const { start, end } = getSaveDates()

        const origDates = getSafeDates(eventObj)

        const finalIsGroup =
            editField === 'participants' || editField === 'capacity' || editField === 'all'
                ? isGroupEvent
                : !!eventObj.is_group
        const isChangingToGroup = !eventObj.is_group && finalIsGroup
        const isChangingToPrivate = eventObj.is_group && !finalIsGroup
        const saveParticipants =
            editField === 'participants' ||
            (editField === 'capacity' && finalIsGroup) ||
            editField === 'all'

        const newStartDateStr = dayjs(start).format('YYYY-MM-DD')

        const newEndDateStr = dayjs(end).format('YYYY-MM-DD')

        const newValidUntilStr = validUntilDate
            ? dayjs(validUntilDate).format('YYYY-MM-DD')
            : null

        const finalStart =
            editField === 'datetime' || editField === 'all'
                ? start
                : origDates.s
        const finalEnd =
            editField === 'datetime' || editField === 'all' ? end : origDates.e

        const payloadStart =
            editField === 'datetime' || editField === 'all'
                ? finalStart
                : new Date(
                    `${eventObj.den_od || dayjs(eventObj.start).format('YYYY-MM-DD')}T${eventObj.cas_od || dayjs(eventObj.start).format('HH:mm')}`
                )
        const payloadEnd =
            editField === 'datetime' || editField === 'all'
                ? finalEnd
                : new Date(
                    `${eventObj.den_do || dayjs(eventObj.end).format('YYYY-MM-DD')}T${eventObj.cas_do || dayjs(eventObj.end).format('HH:mm')}`
                )

        const payload: any = {}
        if (editField === 'title' || editField === 'all') payload.title = title
        if (editField === 'location' || editField === 'all') {
            payload.poloha = poloha
            payload.latitude = latitude
            payload.longitude = longitude
        }
        if (editField === 'capacity' || editField === 'all') payload.peopleCount = peopleCount
        if (editField === 'participants' || editField === 'capacity' || editField === 'all') payload.is_group = finalIsGroup
        if (editField === 'datetime' || editField === 'all') {
            payload.start = payloadStart
            payload.end = payloadEnd
            payload.cas_od = dayjs(payloadStart).format('HH:mm')
            payload.cas_do = dayjs(payloadEnd).format('HH:mm')
            payload.den_od = dayjs(payloadStart).format('YYYY-MM-DD')
            payload.den_do = dayjs(payloadEnd).format('YYYY-MM-DD')
        }

        if (!editAllInstances) {
            // --- VARIANTA A: POUZE TATO JEDNA INSTANCE (VÝJIMKA PRO JAKÉKOLIV POLE) ---

            if (eventObj.pravidelnost) {
                await createException({
                    event_id: eventObj.id,
                    start: finalStart,
                    end: finalEnd,
                    typ: 'UPDATE',

                    puvodni_den:
                        eventObj.instance_date ||
                        dayjs(origDates.s).format('YYYY-MM-DD'),
                    puvodni_cas_od: origDates.s,
                    puvodni_cas_do: origDates.e,

                    title: payload.title,
                    poloha: payload.poloha,
                    latitude: payload.latitude,
                    longitude: payload.longitude,
                    pocet_lidi: payload.peopleCount,
                    is_group: payload.is_group,
                })
            } else {
                payload.recurrence_rule = {
                    type: 'once',
                    start_date: newStartDateStr,
                    end_date: newEndDateStr,
                }

                payload.valid_from = newStartDateStr
                payload.valid_until = newEndDateStr

                await updateEvent({ id: eventObj.id, ...payload })
            }

            // Handle participants for single instance or one-time event
            if (saveParticipants) {
                const isRecurring = !!eventObj.pravidelnost

                if (isRecurring) {
                    console.log('Saving participants for single recurring instance:', {
                        eventId: eventObj.id,
                        selectedParticipants,
                    })
                    const instanceDateStr = dayjs(
                        eventObj.instance_date || eventObj.start
                    ).format('YYYY-MM-DD')
                    // Remove all current participants for this instance
                    await supabase
                        .from('event_users')
                        .delete()
                        .eq('series_id', eventObj.id)
                        .eq('instance_date', instanceDateStr)
                    // Add selected participants for this instance
                    if (selectedParticipants.length > 0) {
                        const participantsToInsert = selectedParticipants.map(
                            (userId) => ({
                                series_id: eventObj.id,
                                user_id: userId,
                                instance_date: instanceDateStr,
                            })
                        )
                        const { error: insertError } = await supabase
                            .from('event_users')
                            .insert(participantsToInsert)
                        console.log('Insert participants error:', insertError)
                    } else {
                        // Insert a marker entry to indicate this instance has explicitly no participants
                        const { error: markerError } = await supabase
                            .from('event_users')
                            .insert({
                                series_id: eventObj.id,
                                user_id: user?.id || 1,
                                instance_date: `CLEARED-${instanceDateStr}`,
                            })
                        console.log(
                            'Insert marker for explicitly cleared participants error:',
                            markerError
                        )
                    }
                } else {
                    console.log('Saving participants for one-time event:', {
                        eventId: eventObj.id,
                        selectedParticipants,
                    })
                    // Remove all current participants for this event
                    await supabase
                        .from('event_users')
                        .delete()
                        .eq('series_id', eventObj.id)
                    // Add selected participants
                    if (selectedParticipants.length > 0) {
                        const participantsToInsert = selectedParticipants.map(
                            (userId) => ({
                                series_id: eventObj.id,
                                user_id: userId,
                                instance_date: null,
                            })
                        )
                        const { error: insertError } = await supabase
                            .from('event_users')
                            .insert(participantsToInsert)
                        console.log('Insert participants error:', insertError)
                    }
                }
            }
        } else {
            // --- VARIANTA B: VŠECHNY BUDOUCÍ INSTANCE (CELÝ CYKLUS / SÉRIE) ---

            // Check if this is a multi-type series
            const recurrenceRule =
                typeof eventObj.recurrence_rule === 'string'
                    ? JSON.parse(eventObj.recurrence_rule)
                    : eventObj.recurrence_rule

            if (eventObj.group_id) {
                // Update all / future instances in the multi-date group (IN PLACE — bez mazání)
                const instanceDay = dayjs(
                    eventObj.instance_date || eventObj.start
                ).format('YYYY-MM-DD')

                if (editField === 'datetime' || editField === 'all') {
                    for (const instance of multiDateInstances) {
                        if (!instance.id) continue
                        const instDay = dayjs(instance.date).format('YYYY-MM-DD')
                        if (editFutureOnly && instDay < instanceDay) continue

                        const { error } = await supabase
                            .from('event_series')
                            .update({
                                nazev:
                                    payload.title !== undefined
                                        ? payload.title
                                        : instance.nazev || eventObj.title,
                                cas_od: dayjs(instance.startTime).format('HH:mm'),
                                cas_do: dayjs(instance.endTime).format('HH:mm'),
                                pocet_lidi:
                                    payload.peopleCount !== undefined
                                        ? payload.peopleCount
                                        : instance.pocet_lidi !== undefined
                                          ? instance.pocet_lidi
                                          : eventObj.pocet_lidi,
                                is_group:
                                    payload.is_group !== undefined
                                        ? payload.is_group
                                        : instance.is_group !== undefined
                                          ? instance.is_group
                                          : eventObj.is_group,
                                poloha:
                                    payload.poloha !== undefined
                                        ? payload.poloha
                                        : instance.poloha !== undefined
                                          ? instance.poloha
                                          : eventObj.poloha,
                                latitude:
                                    payload.latitude !== undefined
                                        ? payload.latitude
                                        : instance.latitude !== undefined
                                          ? instance.latitude
                                          : eventObj.latitude,
                                longitude:
                                    payload.longitude !== undefined
                                        ? payload.longitude
                                        : instance.longitude !== undefined
                                          ? instance.longitude
                                          : eventObj.longitude,
                                recurrence_rule: {
                                    type: 'once',
                                    start_date: instDay,
                                    end_date: instDay,
                                },
                                valid_from: instDay,
                                valid_until: instDay,
                            })
                            .eq('id', instance.id)
                        if (error) {
                            console.error('Error updating multi-date instance:', error)
                            throw new Error(error.message)
                        }
                    }
                } else {
                    // Update non-datetime fields for all / future instances
                    const updateData: any = {}
                    if (payload.title !== undefined) updateData.nazev = payload.title
                    if (payload.poloha !== undefined) updateData.poloha = payload.poloha
                    if (payload.latitude !== undefined) updateData.latitude = payload.latitude
                    if (payload.longitude !== undefined) updateData.longitude = payload.longitude
                    if (payload.peopleCount !== undefined) updateData.pocet_lidi = payload.peopleCount
                    if (payload.is_group !== undefined) updateData.is_group = payload.is_group

                    if (Object.keys(updateData).length > 0) {
                        let query = supabase
                            .from('event_series')
                            .update(updateData)
                            .eq('group_id', eventObj.group_id)
                        if (editFutureOnly) {
                            query = query.gte('valid_from', instanceDay)
                        }
                        const { error } = await query
                        if (error) {
                            console.error('Error updating multi-date group fields:', error)
                            throw new Error(error.message)
                        }
                    }
                }

                // Handle participants for multi-date group (all instances)
                if (saveParticipants) {
                    console.log(
                        'Saving participants for all instances (multi-date group):',
                        { eventId: eventObj.id, selectedParticipants }
                    )
                    const groupInstanceIds = multiDateInstances
                        .filter(i => i.is_group)
                        .map(i => i.id)
                        .filter(id => id !== undefined) as number[];
                    if (groupInstanceIds.length === 0 && eventObj.is_group) {
                        groupInstanceIds.push(eventObj.id);
                    }

                    if (groupInstanceIds.length > 0) {
                        // Remove all participants for all group instances in the group
                        await supabase
                            .from('event_users')
                            .delete()
                            .in('series_id', groupInstanceIds)
                        // Add selected participants for all group instances
                        if (selectedParticipants.length > 0) {
                            const participantsToInsert = groupInstanceIds.flatMap(
                                (id) => selectedParticipants.map((userId) => ({
                                    series_id: id,
                                    user_id: userId,
                                    instance_date: null
                                }))
                            )
                            const { error: insertError } = await supabase
                                .from('event_users')
                                .insert(participantsToInsert)
                            console.log(
                                'Insert participants for all instances error:',
                                insertError
                            )
                        }
                    }
                }
            } else if (recurrenceRule?.type === 'multi') {
                // Update the multi-type series directly
                const updateData: any = {}
                if (
                    payload.title !== undefined &&
                    payload.title !== eventObj.title
                )
                    updateData.nazev = payload.title
                if (
                    payload.poloha !== undefined &&
                    payload.poloha !== eventObj.poloha
                )
                    updateData.poloha = payload.poloha
                if (
                    payload.latitude !== undefined &&
                    payload.latitude !== eventObj.latitude
                )
                    updateData.latitude = payload.latitude
                if (
                    payload.longitude !== undefined &&
                    payload.longitude !== eventObj.longitude
                )
                    updateData.longitude = payload.longitude
                if (
                    payload.peopleCount !== undefined &&
                    payload.peopleCount !== eventObj.pocet_lidi
                )
                    updateData.pocet_lidi = payload.peopleCount
                if (
                    payload.is_group !== undefined &&
                    payload.is_group !== eventObj.is_group
                )
                    updateData.is_group = payload.is_group

                // Update time if editing datetime or all
                if (editField === 'datetime' || editField === 'all') {
                    updateData.cas_od = payload.cas_od
                    updateData.cas_do = payload.cas_do
                }

                console.log(
                    'Updating multi-type series:',
                    eventObj.id,
                    'with:',
                    updateData
                )
                const { error } = await supabase
                    .from('event_series')
                    .update(updateData)
                    .eq('id', eventObj.id)
                if (error) {
                    console.error('Error updating multi-type series:', error)
                }

                // Handle participants for multi-type series (all instances)
                if (saveParticipants) {
                    console.log(
                        'Saving participants for all instances (multi-type series):',
                        { eventId: eventObj.id, selectedParticipants }
                    )
                    // Remove all participants for the series (both with and without instance_date)
                    await supabase
                        .from('event_users')
                        .delete()
                        .eq('series_id', eventObj.id)
                    // Add selected participants for all instances (without instance_date)
                    if (selectedParticipants.length > 0) {
                        const participantsToInsert = selectedParticipants.map(
                            (userId) => ({
                                series_id: eventObj.id,
                                user_id: userId,
                            })
                        )
                        const { error: insertError } = await supabase
                            .from('event_users')
                            .insert(participantsToInsert)
                        console.log(
                            'Insert participants for all instances error:',
                            insertError
                        )
                    }
                }
            } else if (eventObj.pravidelnost) {
                const buildPatternPayload = () => {
                    const pattern: any[] = []
                    let cycleDays = 0
                    patternSegments.forEach((segment) => {
                        const sTime = segment.startTime
                            ? formatTime(segment.startTime)
                            : '08:00'
                        const eTime = segment.endTime
                            ? formatTime(segment.endTime)
                            : '16:00'
                        for (let i = 0; i < segment.days; i++) {
                            if (segment.type === 'work')
                                pattern.push({ work: true, start: sTime, end: eTime })
                            else pattern.push({ work: false })
                            cycleDays++
                        }
                    })
                    const firstWork = patternSegments.find((s) => s.type === 'work')
                    return { pattern, cycleDays, firstWork }
                }

                if (editFutureOnly) {
                    // Tento den a budoucí: ukonči starou sérii a založ novou větev
                    const { pattern, cycleDays, firstWork } = buildPatternPayload()
                    const oldValidUntil = dayjs(
                        eventObj.instance_date || newStartDateStr
                    )
                        .subtract(1, 'day')
                        .format('YYYY-MM-DD')

                    await supabase
                        .from('event_series')
                        .update({ valid_until: oldValidUntil })
                        .eq('id', eventObj.id)

                    const result = await createPatternEvent({
                        title: payload.title ?? eventObj.title,
                        poloha: payload.poloha ?? eventObj.poloha,
                        latitude: payload.latitude ?? eventObj.latitude,
                        longitude: payload.longitude ?? eventObj.longitude,
                        user_id: eventObj.user_id,
                        anchor_date: new Date(
                            eventObj.instance_date || newStartDateStr
                        ),
                        valid_until: newValidUntilStr || undefined,
                        cycle_days: cycleDays || 1,
                        pattern:
                            pattern.length > 0
                                ? pattern
                                : [{ work: true, start: '08:00', end: '16:00' }],
                        cas_od: firstWork?.startTime
                            ? formatTime(firstWork.startTime)
                            : dayjs(finalStart).format('HH:mm'),
                        cas_do: firstWork?.endTime
                            ? formatTime(firstWork.endTime)
                            : dayjs(finalEnd).format('HH:mm'),
                        is_group: payload.is_group ?? eventObj.is_group,
                        peopleCount: payload.peopleCount ?? eventObj.pocet_lidi,
                        inviteUserIds: selectedInvites,
                    })

                    const newEventId = result?.id || result?.data?.[0]?.id
                    if (newEventId) {
                        const currentParticipants = [
                            ...new Set(userEvents.map((u) => u.user_id)),
                        ]
                        for (const participantId of currentParticipants) {
                            await joinEvent({
                                user_id: String(participantId),
                                event_id: newEventId,
                                skipSystemMessage: true,
                            })
                        }
                    }
                } else {
                    // Celá série včetně minulosti — update in place
                    const updatePayload: any = { ...payload }
                    if (editField === 'datetime' || editField === 'all') {
                        const { pattern, cycleDays, firstWork } = buildPatternPayload()
                        if (pattern.length > 0 && cycleDays > 0) {
                            updatePayload.recurrence_rule = {
                                type: 'pattern',
                                cycle_days: cycleDays,
                                anchor_date:
                                    dayjs(dateRange.startDate || eventObj.start).format(
                                        'YYYY-MM-DD'
                                    ),
                                pattern,
                            }
                            updatePayload.cas_od = firstWork?.startTime
                                ? formatTime(firstWork.startTime)
                                : dayjs(finalStart).format('HH:mm')
                            updatePayload.cas_do = firstWork?.endTime
                                ? formatTime(firstWork.endTime)
                                : dayjs(finalEnd).format('HH:mm')
                        }
                        if (newValidUntilStr) updatePayload.valid_until = newValidUntilStr
                    }

                    await updateWeeklyEvent({
                        id: eventObj.id,
                        ...updatePayload,
                        valid_from: eventObj.valid_from,
                        valid_until:
                            updatePayload.valid_until ?? eventObj.valid_until,
                    })

                    if (saveParticipants) {
                        await supabase
                            .from('event_users')
                            .delete()
                            .eq('series_id', eventObj.id)
                        if (selectedParticipants.length > 0) {
                            await supabase.from('event_users').insert(
                                selectedParticipants.map((userId) => ({
                                    series_id: eventObj.id,
                                    user_id: userId,
                                }))
                            )
                        }
                    }
                }
            } else {
                await updateEvent({ id: eventObj.id, ...payload })
            }
        }

        if (isChangingToGroup && user?.id) {
            const isAlreadyJoined = userEvents.some(
                (u) => u.user_id === user.id && u.event_id === eventObj.id
            )

            if (!isAlreadyJoined) {
                const instance_date =
                    eventObj.pravidelnost && !editAllInstances
                        ? dayjs(origDates.s).format('YYYY-MM-DD')
                        : undefined

                await joinEvent({
                    user_id: user.id,
                    event_id: eventObj.id,
                    instance_date,
                })
            }
        }

        // SYSTÉMOVÉ ZPRÁVY + OZNÁMENÍ
        // Účastníci: změny termínu / kapacity / účasti / detailu
        // Pozvaní: jen nová pozvánka / založení + uvolnění místa
        const changes: string[] = []
        const t = payload.title || eventObj.title
        const dStr =
            !eventObj.pravidelnost || !editAllInstances
                ? dayjs(origDates.s).format('YYYY-MM-DD')
                : ''

        if (payload.title !== undefined && payload.title !== eventObj.title)
            changes.push(`změnil(a) název na "${payload.title}"`)
        if (payload.poloha !== undefined && payload.poloha !== eventObj.poloha)
            changes.push(`změnil(a) polohu na "${payload.poloha}"`)

        const capacityChanged =
            payload.peopleCount !== undefined &&
            payload.peopleCount !== eventObj.pocet_lidi
        if (capacityChanged)
            changes.push(`změnil(a) kapacitu na ${payload.peopleCount} lidí`)

        const dateChanged =
            (editField === 'datetime' || editField === 'all') &&
            (finalStart !== origDates.s || finalEnd !== origDates.e)
        if (dateChanged) {
            changes.push(
                `změnil(a) datum a čas na ${dayjs(finalStart).format('D.M. HH:mm')} - ${dayjs(finalEnd).format('HH:mm')}`
            )
        }

        const currentEventLinks = userEvents.filter(
            (u) => String(u.event_id) === String(eventObj.id)
        )
        const previousParticipantIds = Array.from(
            new Set(currentEventLinks.map((u) => String(u.user_id)))
        )
        let removed: string[] = []
        let added: string[] = []
        if (saveParticipants) {
            const selectedIds = selectedParticipants.map(String)
            removed = previousParticipantIds.filter((id) => !selectedIds.includes(id))
            added = selectedIds.filter((id) => !previousParticipantIds.includes(id))
            if (removed.length > 0 || added.length > 0) {
                const getNames = (ids: string[]) =>
                    ids
                        .map(
                            (id) =>
                                users.find((u) => String(u.id) === id)?.username ||
                                'Neznámý'
                        )
                        .join(', ')
                let text = ''
                if (added.length > 0) text += `přidal(a): ${getNames(added)}`
                if (removed.length > 0) {
                    if (text) text += ' a '
                    text += `odebral(a): ${getNames(removed)}`
                }
                if (text) changes.push(text)
            }
        }

        const participantRecipients = saveParticipants
            ? selectedParticipants.map(String)
            : previousParticipantIds

        if (finalIsGroup && user?.id) {
            if (dateChanged) {
                notifyEventParticipants({
                    participantIds: participantRecipients,
                    actorId: user.id,
                    message: `změnil(a) termín skupinové události "${t}" na ${dayjs(finalStart).format('D.M.YYYY HH:mm')}. [EVENT:${eventObj.id}:${dStr}:${t}]`,
                    seriesId: eventObj.id,
                    instanceDate: dStr || null,
                }).catch(console.error)
            }

            if (capacityChanged) {
                notifyEventParticipants({
                    participantIds: participantRecipients,
                    actorId: user.id,
                    message: `změnil(a) kapacitu skupinové události "${t}" na ${payload.peopleCount} lidí. [EVENT:${eventObj.id}:${dStr}:${t}]`,
                    seriesId: eventObj.id,
                    instanceDate: dStr || null,
                }).catch(console.error)
            }

            if (saveParticipants && (added.length > 0 || removed.length > 0)) {
                const getNames = (ids: string[]) =>
                    ids
                        .map(
                            (id) =>
                                users.find((u) => String(u.id) === id)?.username ||
                                'Neznámý'
                        )
                        .join(', ')
                let partMsg = `změnil(a) účast u "${t}"`
                if (added.length > 0) partMsg += ` — přidal(a): ${getNames(added)}`
                if (removed.length > 0) partMsg += ` — odebral(a): ${getNames(removed)}`
                partMsg += `. [EVENT:${eventObj.id}:${dStr}:${t}]`
                notifyEventParticipants({
                    participantIds: participantRecipients,
                    actorId: user.id,
                    message: partMsg,
                    seriesId: eventObj.id,
                    instanceDate: dStr || null,
                }).catch(console.error)
            }

            const finalCapacity = payload.peopleCount ?? eventObj.pocet_lidi
            const finalCount = participantRecipients.length
            const capacityIncreased =
                capacityChanged &&
                (payload.peopleCount as number) > (eventObj.pocet_lidi || 0)
            const hasFreeSlot = finalCount < (finalCapacity || 0)
            const shouldNotifySlotFreed =
                (removed.length > 0 || capacityIncreased) && hasFreeSlot

            if (shouldNotifySlotFreed) {
                const inviteIds = selectedInvites.length
                    ? selectedInvites
                    : await fetchEventInviteIds(eventObj.id)
                notifyInvitesAboutSlotFreed({
                    seriesId: eventObj.id,
                    actorId: user.id,
                    title: t,
                    instanceDate: dStr || null,
                    inviteIds,
                    participantIds: participantRecipients,
                }).catch(console.error)
            }
        }

        // Oznámení jdou jen do inboxu (user_notifications), ne do chatu
        const titleOrPlaceChanged =
            (payload.title !== undefined && payload.title !== eventObj.title) ||
            (payload.poloha !== undefined && payload.poloha !== eventObj.poloha)
        if (
            titleOrPlaceChanged &&
            finalIsGroup &&
            user?.id &&
            changes.length > 0
        ) {
            const leftover = changes.filter(
                (ch) => ch.includes('název') || ch.includes('polohu')
            )
            if (leftover.length > 0) {
                notifyEventParticipants({
                    participantIds: participantRecipients,
                    actorId: user.id,
                    message: `${leftover.join('; ')}. [EVENT:${eventObj.id}:${dStr}:${t}]`,
                    seriesId: eventObj.id,
                    instanceDate: dStr || null,
                }).catch(console.error)
            }
        }

        if (
            finalIsGroup &&
            user?.id &&
            (editField === 'participants' ||
                editField === 'capacity' ||
                editField === 'all' ||
                isChangingToGroup)
        ) {
            const previousInviteIds = await fetchEventInviteIds(eventObj.id)
            const inviteIds = selectedInvites.length
                ? selectedInvites
                : await getDefaultInviteIds(user.id)
            await setEventInvites(eventObj.id, inviteIds)
            setSelectedInvites(inviteIds)

            if (!isChangingToGroup) {
                const prevSet = new Set(previousInviteIds.map(String))
                const newlyInvited = inviteIds
                    .map(String)
                    .filter((id) => !prevSet.has(id))
                if (newlyInvited.length > 0) {
                    notifyNewlyInvited({
                        inviteIds: newlyInvited,
                        actorId: user.id,
                        message: `tě pozval(a) na skupinovou událost "${t}". [EVENT:${eventObj.id}:${dStr}:${t}]`,
                        seriesId: eventObj.id,
                        instanceDate: dStr || null,
                    }).catch(console.error)
                }
            }
        }

        if (isChangingToGroup && user?.id) {
            const inviteIds = selectedInvites.length
                ? selectedInvites
                : await getDefaultInviteIds(user.id)
            notifyNewlyInvited({
                inviteIds,
                actorId: user.id,
                message: `změnil(a) soukromou událost "${t}" na skupinovou. [EVENT:${eventObj.id}:${dStr}:${t}]`,
                seriesId: eventObj.id,
                instanceDate: dStr || null,
            }).catch(console.error)
        }

        if (isChangingToPrivate && user?.id) {
            // Jen zúčastnění — pozvaní už událost neuvidí
            notifyEventParticipants({
                participantIds: participantRecipients,
                actorId: user.id,
                message: `změnil(a) skupinovou událost "${t}" na soukromou. [EVENT:${eventObj.id}:${dStr}:${t}]`,
                seriesId: eventObj.id,
                instanceDate: dStr || null,
            }).catch(console.error)
            await setEventInvites(eventObj.id, [])
            setSelectedInvites([])
        }
        // KONEC SYSTÉMOVÝCH ZPRÁV / OZNÁMENÍ

        // Okamžitě propsat změny do detailu + kalendářové cache
        setEventObj((prev: any) =>
            prev
                ? {
                      ...prev,
                      ...(payload.title !== undefined
                          ? { title: payload.title, nazev: payload.title }
                          : {}),
                      ...(payload.poloha !== undefined
                          ? { poloha: payload.poloha }
                          : {}),
                      ...(payload.latitude !== undefined
                          ? { latitude: payload.latitude }
                          : {}),
                      ...(payload.longitude !== undefined
                          ? { longitude: payload.longitude }
                          : {}),
                      ...(payload.peopleCount !== undefined
                          ? { pocet_lidi: payload.peopleCount }
                          : {}),
                      ...(payload.is_group !== undefined
                          ? { is_group: payload.is_group }
                          : {}),
                  }
                : prev
        )

        setModalVisible(false)

        try {
            await appData?.refreshTimeline?.(true)
        } catch (e) {
            console.error('refreshTimeline after save:', e)
        }

        router.back()
      } catch (e: any) {
        console.error('handleSave error:', e)
        Alert.alert('Chyba při ukládání', e?.message || 'Změny se nepodařilo uložit.')
      } finally {
        setActionBusy(false)
      }
    }

    const handleSaveSpecificRelatedEvent = async () => {
        if (!editingRelatedEvent) return

        const { start, end } = getSaveDates()

        await updateEvent({
            id: editingRelatedEvent.id,
            title: editingRelatedEvent.nazev || editingRelatedEvent.title || '',
            start,
            end,
        })

        setEditingRelatedEvent(null)

        loadRelatedEvents()
    }

    const handleDeleteRelatedEvent = (id: number) => {
        Alert.alert('Smazat instanci', 'Opravdu chcete tuto událost smazat?', [
            { text: 'Zrušit', style: 'cancel' },
            {
                text: 'Smazat',
                style: 'destructive',
                onPress: async () => {
                    await deleteEvent(id)
                    if (id === eventObj.id) {
                        router.back()
                    } else {
                        loadRelatedEvents()
                    }
                },
            },
        ])
    }

    const handleMainDeletePress = () => {
        if (eventObj.pravidelnost) {
            setDeleteDialogVisible(true)
        } else if (isRepeatingNonPattern) {
            setMultiDateDeleteModalVisible(true)
        } else {
            Alert.alert(
                'Smazat událost',
                'Opravdu chcete tuto událost smazat?',
                [
                    { text: 'Zrušit', style: 'cancel' },
                    {
                        text: 'Smazat',
                        style: 'destructive',
                        onPress: async () => {
                            await deleteEvent(eventObj.series_id || eventObj.id)
                            router.back()
                        },
                    },
                ]
            )
        }
    }

    const handleDeleteInstance = async () => {
        setDeleteDialogVisible(false)
        try {
            // Multi-date = smaž jeden řádek; pattern/weekly = DELETE výjimka
            if (eventObj.group_id && !eventObj.pravidelnost) {
                await deleteEvent(eventObj.id)
            } else {
                await createException({
                    event_id: eventObj.series_id || eventObj.id,
                    typ: 'DELETE',
                    puvodni_den:
                        eventObj.instance_date ||
                        dayjs(eventObj.start).format('YYYY-MM-DD'),
                    start: eventObj.start,
                    end: eventObj.end,
                    puvodni_cas_od: eventObj.start,
                    puvodni_cas_do: eventObj.end,
                })
            }
            router.back()
        } catch (e: any) {
            console.error(e)
            Alert.alert('Chyba', e?.message || 'Nepodařilo se smazat termín.')
        }
    }

    const handleDeleteSeries = async () => {
        setDeleteDialogVisible(false)
        await deleteEvent(eventObj.series_id || eventObj.id)
        router.back()
    }

    const handleDeleteAllMultiDate = async () => {
        Alert.alert(
            'Smazat všechny',
            'Opravdu chcete smazat všechny termíny této události?',
            [
                { text: 'Zrušit', style: 'cancel' },
                {
                    text: 'Smazat',
                    style: 'destructive',
                    onPress: async () => {
                        for (const ev of relatedEvents) {
                            await deleteEvent(ev.id)
                        }
                        setMultiDateDeleteModalVisible(false)
                        router.back()
                    },
                },
            ]
        )
    }

    const onConfirmDate = ({ startDate, endDate }: any) => {
        setDateModalVisible(false)

        if (startDate) {
            setDateRange({ startDate, endDate: endDate || startDate })
            // Update multi-date instance date if editing
            if (editingMultiDateIndex !== null) {
                setMultiDateInstances((prev) =>
                    prev.map((inst, idx) => {
                        if (idx === editingMultiDateIndex) {
                            return {
                                ...inst,
                                date: startDate,
                                startTime: startDate,
                                endTime: inst.endTime,
                            }
                        }
                        return inst
                    })
                )
            }
        }
    }

    const handleTimeConfirm = ({
        hours,
        minutes,
    }: {
        hours: number
        minutes: number
    }) => {
        const newTime = new Date()
        newTime.setHours(hours, minutes, 0, 0)

        if (timeContext === 'once') {
            if (timeStep === 'start') {
                setTimeRange({
                    start: newTime,
                    end: timeRange.end || new Date(newTime.getTime() + 3600000),
                })

                setTimeStep('end')
                setTimeout(() => setTimeModalVisible(true), 100)
            } else {
                setTimeRange((prev) => ({ ...prev, end: newTime }))
                setTimeModalVisible(false)
            }
        } else if (timeContext === 'multi' && editingMultiDateIndex !== null) {
            setMultiDateInstances((prev) =>
                prev.map((inst, idx) => {
                    if (idx === editingMultiDateIndex) {
                        if (timeStep === 'start') {
                            return {
                                ...inst,
                                startTime: newTime,
                                endTime:
                                    inst.endTime ||
                                    new Date(newTime.getTime() + 3600000),
                            }
                        } else {
                            return { ...inst, endTime: newTime }
                        }
                    }
                    return inst
                })
            )
            if (timeStep === 'start') {
                setTimeStep('end')
                setTimeout(() => setTimeModalVisible(true), 100)
            } else {
                setTimeModalVisible(false)
            }
        } else if (timeContext === 'patternSegment' && editingSegmentId) {
            setPatternSegments((prev) =>
                prev.map((s) =>
                    s.id === editingSegmentId
                        ? timeStep === 'start'
                            ? {
                                ...s,
                                startTime: newTime,
                                endTime:
                                    s.endTime ||
                                    new Date(newTime.getTime() + 3600000),
                            }
                            : { ...s, endTime: newTime }
                        : s
                )
            )

            if (timeStep === 'start') {
                setTimeStep('end')
                setTimeout(() => setTimeModalVisible(true), 100)
            } else {
                setTimeModalVisible(false)
                setEditingSegmentId(null)
            }
        }
    }

    const addSegment = (type: 'work' | 'off') => {
        setPatternSegments((prev) => [
            ...prev,
            {
                id: Math.random().toString(),
                type,
                days: 1,
                startTime:
                    type === 'work'
                        ? dayjs().hour(8).minute(0).toDate()
                        : undefined,
                endTime:
                    type === 'work'
                        ? dayjs().hour(16).minute(0).toDate()
                        : undefined,
            },
        ])
    }

    const bumpSegmentDays = (id: string, delta: number) => {
        setPatternSegments((prev) =>
            prev.map((s) =>
                s.id === id
                    ? { ...s, days: Math.max(1, (s.days || 1) + delta) }
                    : s
            )
        )
    }

    const removeSegment = (id: string) => {
        setPatternSegments((prev) => prev.filter((s) => s.id !== id))
    }

    const cycleDaysTotal = patternSegments.reduce(
        (sum, s) => sum + (s.days || 0),
        0
    )

    const itemInstanceDate = dayjs(eventObj.start).format('YYYY-MM-DD')

    // Check for CLEARED marker for this specific instance
    const clearedMarker = userEvents.find(
        (u) =>
            u.event_id === eventObj.id &&
            u.instance_date === `CLEARED-${itemInstanceDate}`
    )
    const instanceSpecificEvents = userEvents.filter(
        (u) =>
            u.event_id === eventObj.id && u.instance_date === itemInstanceDate
    )
    let relevantUserEvents: any[]
    if (eventObj.pravidelnost) {
        if (clearedMarker) {
            relevantUserEvents = []
        } else if (instanceSpecificEvents.length > 0) {
            relevantUserEvents = instanceSpecificEvents
        } else {
            relevantUserEvents = userEvents.filter(
                (u) => u.event_id === eventObj.id && !u.instance_date
            )
        }
    } else {
        relevantUserEvents = userEvents.filter(
            (u) => u.event_id === eventObj.id && !u.instance_date
        )
    }

    const count = relevantUserEvents.length
    const isFull = count >= (eventObj.pocet_lidi || 0)
    const userJoined = relevantUserEvents.some(
        (u) => String(u.user_id) === String(user?.id)
    )

    const handleJoinEvent = async () => {
        if (!user || actionBusy) return
        setActionBusy(true)
        try {
            const isRecurringOrMulti =
                !!eventObj.pravidelnost || !!eventObj.group_id
            const instanceDate = isRecurringOrMulti
                ? eventObj.instance_date || eventObj.den_od
                : undefined
            await joinEvent({
                user_id: String(user.id),
                event_id: eventObj.series_id || eventObj.id,
                instance_date: instanceDate ? String(instanceDate) : undefined,
            })
            loadUserEvent()
        } catch (e) {
            console.error(e)
        } finally {
            setActionBusy(false)
        }
    }

    const handleCancelEvent = async () => {
        if (!user || actionBusy) return
        setActionBusy(true)
        try {
            const isRecurringOrMulti =
                !!eventObj.pravidelnost || !!eventObj.group_id
            const instanceDate = isRecurringOrMulti
                ? eventObj.instance_date || eventObj.den_od
                : undefined
            const seriesId = eventObj.series_id || eventObj.id
            const instanceDateStr = instanceDate ? String(instanceDate) : undefined

            await cancelEvent({
                user_id: String(user.id),
                event_id: seriesId,
                instance_date: instanceDateStr,
            })

            if (eventObj.is_group) {
                const remaining = userEvents
                    .filter(
                        (u) =>
                            String(u.event_id) === String(seriesId) &&
                            String(u.user_id) !== String(user.id)
                    )
                    .map((u) => String(u.user_id))
                const title = eventObj.title
                const dStr = instanceDateStr || ''

                notifyEventParticipants({
                    participantIds: remaining,
                    actorId: user.id,
                    message: `odhlásil(a) se z události "${title}". [EVENT:${seriesId}:${dStr}:${title}]`,
                    seriesId,
                    instanceDate: dStr || null,
                }).catch(console.error)

                notifyInvitesAboutSlotFreed({
                    seriesId,
                    actorId: user.id,
                    title,
                    instanceDate: dStr || null,
                    participantIds: remaining,
                }).catch(console.error)
            }

            loadUserEvent()
        } catch (e) {
            console.error(e)
        } finally {
            setActionBusy(false)
        }
    }

    const isRepeatingNonPattern =
        !eventObj.pravidelnost && relatedEvents.length > 1

    const isOwner = String(eventObj.user_id) === String(user?.id)
    const iconAccent = scheme === 'dark' ? Brand.primaryMuted : Brand.primary

    const datePrimary = dayjs(eventObj.start).isSame(eventObj.end, 'day')
        ? dayjs(eventObj.start).locale('cs').format('dddd D. MMMM YYYY')
        : `${dayjs(eventObj.start).locale('cs').format('D. MMMM')} – ${dayjs(eventObj.end).locale('cs').format('D. MMMM YYYY')}`
    const dateSecondary = dayjs(eventObj.start).isSame(eventObj.end, 'day')
        ? `${formatTime(eventObj.start)} – ${formatTime(eventObj.end)}`
        : `${formatTime(eventObj.start)} – ${formatTime(eventObj.end)}`

    const polohaRaw = String(eventObj.poloha || '').trim()
    const polohaParts = polohaRaw
        ? polohaRaw.split(',').map((s: string) => s.trim()).filter(Boolean)
        : []
    const locationPrimary = polohaParts[0] || 'Poloha není zadána'
    const locationSecondary =
        polohaParts.length > 1 ? polohaParts.slice(1).join(', ') : null

    const AVATAR_VISIBLE = 7
    const overflowCount = Math.max(0, relevantUserEvents.length - AVATAR_VISIBLE)
    const visibleParticipants = relevantUserEvents.slice(0, AVATAR_VISIBLE)

    const privateParticipants =
        relevantUserEvents.length > 0
            ? relevantUserEvents
            : eventObj.user_id
              ? [{ user_id: eventObj.user_id }]
              : []

    const sheetParticipants = eventObj.is_group
        ? relevantUserEvents
        : privateParticipants

    const openEventChat = () => {
        const isRecurringOrMulti = !!eventObj.pravidelnost || !!eventObj.group_id
        const isInstance =
            isRecurringOrMulti && (!!eventObj.instance_date || !!eventObj.den_od)
        router.push({
            pathname: '/events/[id]/chat',
            params: {
                id: eventObj.series_id || eventObj.id,
                event_title: eventObj.title,
                instance_date: isInstance
                    ? String(eventObj.instance_date || eventObj.den_od)
                    : undefined,
            },
        })
    }

    const InfoRow = ({
        icon,
        primary,
        secondary,
        onEdit,
        children,
    }: {
        icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']
        primary: string
        secondary?: string | null
        onEdit?: () => void
        children?: React.ReactNode
    }) => (
        <View style={styles.infoRow}>
            <MaterialCommunityIcons name={icon} size={22} color={iconAccent} />
            <View style={styles.infoTextCol}>
                <View style={styles.infoPrimaryRow}>
                    <ThemedText
                        style={[styles.infoPrimary, { color: surfaces.text }]}
                        numberOfLines={2}
                    >
                        {primary}
                    </ThemedText>
                    {isOwner && onEdit ? (
                        <Pressable onPress={onEdit} hitSlop={10} style={styles.editHint}>
                            <MaterialCommunityIcons
                                name="pencil-outline"
                                size={15}
                                color={surfaces.textSecondary}
                            />
                        </Pressable>
                    ) : null}
                </View>
                {!!secondary && (
                    <ThemedText
                        style={[styles.infoSecondary, { color: surfaces.textSecondary }]}
                        numberOfLines={2}
                    >
                        {secondary}
                    </ThemedText>
                )}
                {children}
            </View>
        </View>
    )

    const ParticipantAvatar = ({
        userId,
        onPress,
    }: {
        userId: string | number
        onPress: () => void
    }) => {
        const participant = users.find((u) => String(u.id) === String(userId))
        const colorObj = colors.find(
            (c) => String(c.user_id) === String(userId)
        )
        const bg = colorObj?.background_color || '#5F6368'
        const label = participant?.username || participant?.jmeno || '?'

        return (
            <Pressable onPress={onPress} style={styles.avatarItem}>
                <View style={[styles.avatar, { backgroundColor: bg }]}>
                    <ThemedText style={styles.avatarText}>
                        {userInitials(participant)}
                    </ThemedText>
                </View>
                <ThemedText
                    style={[styles.avatarName, { color: surfaces.textSecondary }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                >
                    {label}
                </ThemedText>
            </Pressable>
        )
    }

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />

            <ThemedSafeView
                style={[styles.container, { backgroundColor: surfaces.background }]}
            >
                <View style={styles.topBar}>
                    <Pressable
                        onPress={() => router.back()}
                        hitSlop={12}
                        style={styles.iconBtn}
                    >
                        <MaterialCommunityIcons
                            name="arrow-left"
                            size={24}
                            color={surfaces.text}
                        />
                    </Pressable>
                    <View style={{ flex: 1 }} />
                    {isOwner && (
                        <Pressable
                            onPress={handleMainDeletePress}
                            hitSlop={12}
                            style={styles.iconBtn}
                        >
                            <MaterialCommunityIcons
                                name="trash-can-outline"
                                size={22}
                                color={Brand.danger}
                            />
                        </Pressable>
                    )}
                </View>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.titleRow}>
                        <ThemedText
                            style={[styles.heroTitle, { color: surfaces.text }]}
                        >
                            {eventObj.title}
                        </ThemedText>
                        {isOwner && (
                            <Pressable
                                onPress={() => handleEditClick('title')}
                                hitSlop={10}
                                style={styles.editHint}
                            >
                                <MaterialCommunityIcons
                                    name="pencil-outline"
                                    size={16}
                                    color={surfaces.textSecondary}
                                />
                            </Pressable>
                        )}
                    </View>

                    <View style={styles.infoBlock}>
                        <InfoRow
                            icon="calendar-month-outline"
                            primary={
                                datePrimary.charAt(0).toUpperCase() +
                                datePrimary.slice(1)
                            }
                            secondary={dateSecondary}
                            onEdit={() => handleEditClick('datetime')}
                        />

                        <InfoRow
                            icon="map-marker-outline"
                            primary={locationPrimary}
                            secondary={locationSecondary}
                            onEdit={() => handleEditClick('location')}
                        />

                        {eventObj.is_group ? (
                            <InfoRow
                                icon="account-group-outline"
                                primary="Účastníci"
                                secondary={
                                    eventObj.pocet_lidi
                                        ? `${count} z ${eventObj.pocet_lidi} se zúčastní`
                                        : `${count} se zúčastní`
                                }
                                onEdit={() => handleEditClick('capacity')}
                            >
                                <View style={styles.avatarRow}>
                                    {visibleParticipants.map((ue) => (
                                        <ParticipantAvatar
                                            key={String(ue.user_id)}
                                            userId={ue.user_id}
                                            onPress={() =>
                                                setParticipantModalVisible(true)
                                            }
                                        />
                                    ))}
                                    {overflowCount > 0 && (
                                        <Pressable
                                            onPress={() =>
                                                setParticipantModalVisible(true)
                                            }
                                            style={styles.avatarItem}
                                        >
                                            <View
                                                style={[
                                                    styles.avatar,
                                                    styles.avatarOverflow,
                                                    {
                                                        backgroundColor:
                                                            surfaces.surfaceElevated,
                                                        borderColor: surfaces.border,
                                                    },
                                                ]}
                                            >
                                                <ThemedText
                                                    style={[
                                                        styles.avatarText,
                                                        { color: surfaces.text },
                                                    ]}
                                                >
                                                    +{overflowCount}
                                                </ThemedText>
                                            </View>
                                            <ThemedText
                                                style={[
                                                    styles.avatarName,
                                                    { color: surfaces.textSecondary },
                                                ]}
                                                numberOfLines={1}
                                            >
                                                další
                                            </ThemedText>
                                        </Pressable>
                                    )}
                                </View>
                            </InfoRow>
                        ) : (
                            <InfoRow
                                icon="account-outline"
                                primary={
                                    privateParticipants.length > 1
                                        ? 'Účastníci'
                                        : 'Účastník'
                                }
                                onEdit={() => handleEditClick('capacity')}
                            >
                                <View style={styles.avatarRow}>
                                    {privateParticipants.map((ue: any) => (
                                        <ParticipantAvatar
                                            key={String(ue.user_id)}
                                            userId={ue.user_id}
                                            onPress={() =>
                                                setParticipantModalVisible(true)
                                            }
                                        />
                                    ))}
                                </View>
                            </InfoRow>
                        )}
                    </View>

                    {eventObj.latitude && eventObj.longitude && (
                        <View style={styles.mapBlock}>
                            <View
                                style={[
                                    styles.mapWrap,
                                    { borderColor: surfaces.border },
                                ]}
                            >
                                <EventMap
                                    latitude={Number(eventObj.latitude)}
                                    longitude={Number(eventObj.longitude)}
                                    title={eventObj.title}
                                    description={eventObj.poloha}
                                />
                            </View>
                            <Pressable
                                onPress={() =>
                                    Linking.openURL(
                                        `https://www.google.com/maps/search/?api=1&query=${eventObj.latitude},${eventObj.longitude}`
                                    )
                                }
                                style={styles.mapsLink}
                            >
                                <MaterialCommunityIcons
                                    name="open-in-new"
                                    size={16}
                                    color={Brand.primary}
                                />
                                <ThemedText
                                    style={{
                                        color: Brand.primary,
                                        fontWeight: '600',
                                        fontSize: 14,
                                    }}
                                >
                                    Otevřít v Mapách
                                </ThemedText>
                            </Pressable>
                        </View>
                    )}

                    <View style={styles.actions}>
                        {eventObj.is_group &&
                            (userJoined ? (
                                <Button
                                    mode="contained"
                                    icon="account-remove-outline"
                                    buttonColor={Brand.danger}
                                    textColor="#fff"
                                    onPress={handleCancelEvent}
                                    loading={actionBusy}
                                    disabled={actionBusy}
                                    style={styles.primaryBtn}
                                    contentStyle={styles.primaryBtnContent}
                                    labelStyle={styles.btnLabel}
                                >
                                    Zrušit účast
                                </Button>
                            ) : (
                                <Button
                                    mode="contained"
                                    icon="account-plus-outline"
                                    buttonColor={Brand.primary}
                                    textColor={Brand.onPrimary}
                                    onPress={handleJoinEvent}
                                    loading={actionBusy}
                                    disabled={isFull || actionBusy}
                                    style={styles.primaryBtn}
                                    contentStyle={styles.primaryBtnContent}
                                    labelStyle={styles.btnLabel}
                                >
                                    {isFull ? 'Plno' : 'Zúčastnit se'}
                                </Button>
                            ))}

                        <Button
                            mode="outlined"
                            icon="chat-outline"
                            textColor={Brand.primary}
                            onPress={openEventChat}
                            style={[
                                styles.secondaryBtn,
                                { borderColor: Brand.primary },
                            ]}
                            contentStyle={styles.primaryBtnContent}
                            labelStyle={styles.btnLabel}
                        >
                            Otevřít chat
                        </Button>
                    </View>
                </ScrollView>
            </ThemedSafeView>

            <Portal>
                <Modal
                    visible={participantModalVisible}
                    onDismiss={() => setParticipantModalVisible(false)}
                    contentContainerStyle={[
                        styles.participantsSheet,
                        { backgroundColor: surfaces.surface },
                    ]}
                >
                    <View style={styles.participantsSheetHeader}>
                        <ThemedText
                            style={[styles.participantsSheetTitle, { color: surfaces.text }]}
                        >
                            Účastníci
                        </ThemedText>
                        <Pressable
                            onPress={() => setParticipantModalVisible(false)}
                            hitSlop={12}
                        >
                            <MaterialCommunityIcons
                                name="close"
                                size={22}
                                color={surfaces.textSecondary}
                            />
                        </Pressable>
                    </View>

                    {sheetParticipants.length === 0 ? (
                        <ThemedText
                            style={{
                                color: surfaces.textSecondary,
                                textAlign: 'center',
                                paddingVertical: 24,
                            }}
                        >
                            Zatím nikdo.
                        </ThemedText>
                    ) : (
                        <ScrollView style={{ maxHeight: 420 }}>
                            {sheetParticipants.map((ue: any) => {
                                const p = users.find(
                                    (u) => String(u.id) === String(ue.user_id)
                                )
                                const colorObj = colors.find(
                                    (c) =>
                                        String(c.user_id) === String(ue.user_id)
                                )
                                const bg =
                                    colorObj?.background_color || '#5F6368'
                                const fullName = [p?.jmeno, p?.prijmeni]
                                    .filter(Boolean)
                                    .join(' ')
                                const isFounder =
                                    String(ue.user_id) ===
                                    String(eventObj.user_id)
                                const isMe =
                                    String(ue.user_id) === String(user?.id)
                                const birthday = p?.datum_narozeni
                                    ? dayjs(p.datum_narozeni)
                                          .locale('cs')
                                          .format('D. MMMM YYYY')
                                    : null

                                return (
                                    <View
                                        key={String(ue.user_id)}
                                        style={[
                                            styles.participantDetailRow,
                                            { borderBottomColor: surfaces.border },
                                        ]}
                                    >
                                        <View
                                            style={[
                                                styles.avatarLg,
                                                { backgroundColor: bg },
                                            ]}
                                        >
                                            <ThemedText style={styles.avatarLgText}>
                                                {userInitials(p)}
                                            </ThemedText>
                                        </View>
                                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                                            <ThemedText
                                                style={[
                                                    styles.participantDetailName,
                                                    { color: surfaces.text },
                                                ]}
                                                numberOfLines={1}
                                            >
                                                {p?.username || 'Neznámý'}
                                                {isMe ? ' · ty' : ''}
                                            </ThemedText>
                                            {!!fullName && (
                                                <ThemedText
                                                    style={{
                                                        color: surfaces.textSecondary,
                                                        fontSize: 13,
                                                    }}
                                                    numberOfLines={1}
                                                >
                                                    {fullName}
                                                </ThemedText>
                                            )}
                                            {!!p?.email && (
                                                <ThemedText
                                                    style={{
                                                        color: surfaces.textSecondary,
                                                        fontSize: 12,
                                                    }}
                                                    numberOfLines={1}
                                                >
                                                    {p.email}
                                                </ThemedText>
                                            )}
                                            {!!birthday && (
                                                <ThemedText
                                                    style={{
                                                        color: surfaces.textSecondary,
                                                        fontSize: 12,
                                                    }}
                                                >
                                                    Narozeniny: {birthday}
                                                </ThemedText>
                                            )}
                                            {isFounder && (
                                                <ThemedText
                                                    style={{
                                                        color: Brand.primary,
                                                        fontSize: 12,
                                                        fontWeight: '700',
                                                        marginTop: 2,
                                                    }}
                                                >
                                                    Zakladatel
                                                </ThemedText>
                                            )}
                                        </View>
                                    </View>
                                )
                            })}
                        </ScrollView>
                    )}
                </Modal>
            </Portal>

            {/* DIALOG: ROZCESTNÍK ROZSAHU ÚPRAV */}
            <Portal>
                <Dialog
                    visible={scopeDialogVisible}
                    onDismiss={() => setScopeDialogVisible(false)}
                    style={{ backgroundColor: modalBackgroundColor }}
                >
                    <Dialog.Title style={{ color: buttonColor }}>
                        Rozsah úpravy
                    </Dialog.Title>
                    <Dialog.Content>
                        <ThemedText>
                            Jaký rozsah má mít tato změna?
                        </ThemedText>
                    </Dialog.Content>
                    <Dialog.Actions
                        style={{
                            flexDirection: 'column',
                            gap: 8,
                            alignItems: 'stretch',
                        }}
                    >
                        <Button
                            mode="contained"
                            buttonColor={buttonColor}
                            textColor={buttonTextColor}
                            onPress={() => handleScopeSelection('instance')}
                        >
                            Jen tento den
                        </Button>
                        <Button
                            mode="outlined"
                            style={{ borderColor: buttonColor }}
                            textColor={buttonColor}
                            onPress={() => handleScopeSelection('future')}
                        >
                            Tento den a budoucí
                        </Button>
                        <Button
                            mode="outlined"
                            style={{ borderColor: buttonColor }}
                            textColor={buttonColor}
                            onPress={() => handleScopeSelection('all')}
                        >
                            Celá série (včetně minulosti)
                        </Button>
                    </Dialog.Actions>
                </Dialog>

                {/* DIALOG: SMAZÁNÍ PRAVIDELNÉ UDÁLOSTI */}
                <Dialog
                    visible={deleteDialogVisible}
                    onDismiss={() => setDeleteDialogVisible(false)}
                    style={{ backgroundColor: modalBackgroundColor }}
                >
                    <Dialog.Title style={{ color: buttonColor }}>
                        Smazat událost
                    </Dialog.Title>
                    <Dialog.Content>
                        <ThemedText>
                            Chcete smazat pouze tuto konkrétní instanci, nebo
                            celou opakující se sérii?
                        </ThemedText>
                    </Dialog.Content>
                    <Dialog.Actions
                        style={{
                            flexDirection: 'column',
                            gap: 8,
                            alignItems: 'stretch',
                        }}
                    >
                        <Button
                            mode="contained"
                            buttonColor="#f44336"
                            textColor="#fff"
                            onPress={handleDeleteInstance}
                        >
                            Smazat pouze tuto instanci
                        </Button>
                        <Button
                            mode="outlined"
                            style={{ borderColor: '#f44336' }}
                            textColor="#f44336"
                            onPress={handleDeleteSeries}
                        >
                            Smazat celou sérii
                        </Button>
                        <Button
                            onPress={() => setDeleteDialogVisible(false)}
                            textColor={secondaryTextColor}
                        >
                            Zrušit
                        </Button>
                    </Dialog.Actions>
                </Dialog>

                {/* MODAL: SMAZÁNÍ MULTI-DATE UDÁLOSTI */}
                <Modal
                    visible={multiDateDeleteModalVisible}
                    onDismiss={() => setMultiDateDeleteModalVisible(false)}
                    contentContainerStyle={{
                        backgroundColor: modalBackgroundColor,
                        padding: 20,
                        margin: 20,
                        borderRadius: 12,
                    }}
                >
                    <ThemedText type="subtitle" style={{ marginBottom: 16 }}>
                        Vyberte instanci ke smazání
                    </ThemedText>
                    <ScrollView style={{ maxHeight: 300 }}>
                        {(multiDateInstances.length > 0 ? multiDateInstances : relatedEvents).map((ev: any) => (
                            <View
                                key={ev.id}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    paddingVertical: 8,
                                    borderBottomWidth: 1,
                                    borderBottomColor: borderColorTheme,
                                }}
                            >
                                <ThemedText>
                                    {formatDate(ev.startTime || ev.start)}{' '}
                                    {formatTime(ev.startTime || ev.start)} -{' '}
                                    {formatTime(ev.endTime || ev.end)}
                                </ThemedText>
                                <IconButton
                                    icon="trash-can"
                                    size={20}
                                    iconColor="red"
                                    onPress={() =>
                                        handleDeleteRelatedEvent(ev.id)
                                    }
                                    style={{ margin: 0 }}
                                />
                            </View>
                        ))}
                    </ScrollView>
                    <View style={{ marginTop: 24, gap: 8 }}>
                        <Button
                            mode="contained"
                            buttonColor="#f44336"
                            textColor="#fff"
                            onPress={handleDeleteAllMultiDate}
                        >
                            Smazat všechny instance
                        </Button>
                        <Button
                            mode="text"
                            onPress={() =>
                                setMultiDateDeleteModalVisible(false)
                            }
                            textColor={secondaryTextColor}
                        >
                            Zavřít
                        </Button>
                    </View>
                </Modal>
            </Portal>

            {/* HLAVNÍ MODAL */}

            <Portal>
                <Modal
                    visible={isModalVisible}
                    onDismiss={() => setModalVisible(false)}
                    contentContainerStyle={styles.modalContainer}
                >
                    <ThemedView
                        style={[
                            styles.content,
                            { backgroundColor: modalBackgroundColor },
                        ]}
                    >
                        <View
                            style={[
                                styles.editModalHeader,
                                { borderBottomColor: borderColorTheme },
                            ]}
                        >
                            <View style={{ flex: 1 }}>
                                <ThemedText style={styles.editModalTitle}>
                                    {editModalTitle}
                                </ThemedText>
                                {(eventObj.pravidelnost || eventObj.group_id) &&
                                    editField === 'datetime' && (
                                        <ThemedText
                                            style={{
                                                color: secondaryTextColor,
                                                fontSize: 12,
                                                marginTop: 2,
                                            }}
                                        >
                                            {editAllInstances
                                                ? 'Celá řada / cyklus'
                                                : 'Konkrétní instance'}
                                        </ThemedText>
                                    )}
                            </View>
                            <Pressable
                                onPress={() => setModalVisible(false)}
                                hitSlop={10}
                                style={styles.editModalClose}
                            >
                                <MaterialCommunityIcons
                                    name="close"
                                    size={22}
                                    color={secondaryTextColor}
                                />
                            </Pressable>
                        </View>

                        <ScrollView
                            keyboardShouldPersistTaps="handled"
                            nestedScrollEnabled={true}
                            style={{ flexShrink: 1 }}
                            contentContainerStyle={{ paddingBottom: 8 }}
                        >
                            {editField === 'title' && (
                                <RNTextInput
                                    value={title}
                                    onChangeText={setTitle}
                                    placeholder="Název události"
                                    placeholderTextColor={secondaryTextColor}
                                    style={[
                                        styles.titleInput,
                                        {
                                            color: surfaces.text,
                                            borderBottomColor: borderColorTheme,
                                        },
                                    ]}
                                    autoFocus
                                />
                            )}

                            {editField === 'location' && (
                                <LocationAutocomplete
                                    poloha={poloha}
                                    setPoloha={setPoloha}
                                    latitude={latitude}
                                    setLatitude={setLatitude}
                                    setLongitude={setLongitude}
                                    accentColor={accentColor}
                                    borderColorTheme={borderColorTheme}
                                />
                            )}

                            {editField === 'capacity' && (
                                <ThemedView style={{ gap: 12 }}>
                                    <View style={styles.chipRow}>
                                        <FormChip
                                            label="Soukromá"
                                            active={!isGroupEvent}
                                            onPress={() => setIsGroupEvent(false)}
                                            activeColor={founderColor}
                                            inactiveColor={chipInactive}
                                            inactiveBorder={chipInactiveBorder}
                                        />
                                        <FormChip
                                            label="Skupinová"
                                            active={isGroupEvent}
                                            onPress={() => {
                                                setIsGroupEvent(true)
                                                if (
                                                    selectedInvites.length ===
                                                        0 &&
                                                    user?.id
                                                ) {
                                                    getDefaultInviteIds(user.id)
                                                        .then(setSelectedInvites)
                                                        .catch(console.error)
                                                }
                                                if (
                                                    user?.id &&
                                                    !selectedParticipants
                                                        .map(String)
                                                        .includes(
                                                            String(user.id)
                                                        )
                                                ) {
                                                    setSelectedParticipants(
                                                        (prev) =>
                                                            [
                                                                Number(user.id),
                                                                ...prev,
                                                            ].slice(
                                                                0,
                                                                Math.max(
                                                                    peopleCount,
                                                                    1
                                                                )
                                                            )
                                                    )
                                                }
                                            }}
                                            activeColor={Brand.groupEvent}
                                            inactiveColor={chipInactive}
                                            inactiveBorder={chipInactiveBorder}
                                        />
                                    </View>
                                    {isGroupEvent && (
                                        <>
                                            <ThemedText
                                                style={[
                                                    styles.label,
                                                    {
                                                        color: secondaryTextColor,
                                                        marginBottom: 4,
                                                    },
                                                ]}
                                            >
                                                Kapacita (včetně tebe)
                                            </ThemedText>
                                            <View style={styles.counterRow}>
                                                <IconButton
                                                    icon="minus"
                                                    mode="contained"
                                                    onPress={decrease}
                                                    iconColor={buttonTextColor}
                                                    containerColor={accentColor}
                                                />
                                                <ThemedText
                                                    style={styles.counterValue}
                                                >
                                                    {peopleCount}
                                                </ThemedText>
                                                <IconButton
                                                    icon="plus"
                                                    mode="contained"
                                                    onPress={increase}
                                                    iconColor={buttonTextColor}
                                                    containerColor={accentColor}
                                                />
                                            </View>

                                            <ThemedText
                                                style={[
                                                    styles.label,
                                                    {
                                                        color: secondaryTextColor,
                                                        marginTop: 8,
                                                        marginBottom: 8,
                                                    },
                                                ]}
                                            >
                                                Kdo událost vidí (pozvaní)
                                            </ThemedText>
                                            <View
                                                style={{
                                                    flexDirection: 'row',
                                                    justifyContent: 'flex-end',
                                                    marginBottom: 4,
                                                }}
                                            >
                                                <Pressable
                                                    onPress={async () => {
                                                        if (
                                                            selectedInvites.length >
                                                            0
                                                        ) {
                                                            setSelectedInvites(
                                                                []
                                                            )
                                                        } else if (user?.id) {
                                                            setSelectedInvites(
                                                                await getDefaultInviteIds(
                                                                    user.id
                                                                )
                                                            )
                                                        }
                                                    }}
                                                    hitSlop={8}
                                                    style={{
                                                        paddingVertical: 4,
                                                    }}
                                                >
                                                    <ThemedText
                                                        style={{
                                                            color: accentColor,
                                                            fontWeight: '700',
                                                            fontSize: 13,
                                                        }}
                                                    >
                                                        {selectedInvites.length >
                                                        0
                                                            ? 'Zrušit pozvánky'
                                                            : 'Pozvat všechny přátele'}
                                                    </ThemedText>
                                                </Pressable>
                                            </View>
                                            <ScrollView
                                                style={{ maxHeight: 220, marginBottom: 12 }}
                                                nestedScrollEnabled
                                                showsVerticalScrollIndicator={false}
                                            >
                                                <SelectablePeopleList
                                                    users={friendUsers.length ? friendUsers : users}
                                                    selectedIds={selectedInvites}
                                                    colors={colors}
                                                    onToggle={(id) => {
                                                        const invited = selectedInvites
                                                            .map(String)
                                                            .includes(String(id))
                                                        if (invited) {
                                                            setSelectedInvites(
                                                                selectedInvites.filter(
                                                                    (x) => String(x) !== String(id)
                                                                )
                                                            )
                                                            setSelectedParticipants(
                                                                selectedParticipants.filter(
                                                                    (x) => String(x) !== String(id)
                                                                )
                                                            )
                                                        } else {
                                                            setSelectedInvites([...selectedInvites, id])
                                                        }
                                                    }}
                                                />
                                            </ScrollView>

                                            <ThemedText
                                                style={[
                                                    styles.label,
                                                    {
                                                        color: secondaryTextColor,
                                                        marginBottom: 8,
                                                    },
                                                ]}
                                            >
                                                Přihlášení k účasti
                                            </ThemedText>
                                            <View
                                                style={{
                                                    flexDirection: 'row',
                                                    justifyContent: 'flex-end',
                                                    marginBottom: 4,
                                                }}
                                            >
                                                <Pressable
                                                    onPress={() => {
                                                        if (
                                                            selectedParticipants.length >
                                                            1
                                                        ) {
                                                            setSelectedParticipants(
                                                                user?.id
                                                                    ? [
                                                                          Number(
                                                                              user.id
                                                                          ),
                                                                      ]
                                                                    : []
                                                            )
                                                        } else {
                                                            const inviteSet =
                                                                new Set(
                                                                    selectedInvites.map(
                                                                        String
                                                                    )
                                                                )
                                                            const me = user?.id
                                                                ? [
                                                                      Number(
                                                                          user.id
                                                                      ),
                                                                  ]
                                                                : []
                                                            const others = (
                                                                friendUsers.length
                                                                    ? friendUsers
                                                                    : users
                                                            )
                                                                .map(
                                                                    (u) => u.id
                                                                )
                                                                .filter(
                                                                    (id) =>
                                                                        inviteSet.has(
                                                                            String(
                                                                                id
                                                                            )
                                                                        ) &&
                                                                        String(
                                                                            id
                                                                        ) !==
                                                                            String(
                                                                                user?.id
                                                                            )
                                                                )
                                                            setSelectedParticipants(
                                                                [
                                                                    ...me,
                                                                    ...others,
                                                                ].slice(
                                                                    0,
                                                                    peopleCount
                                                                )
                                                            )
                                                        }
                                                    }}
                                                    hitSlop={8}
                                                    style={{
                                                        paddingVertical: 4,
                                                    }}
                                                >
                                                    <ThemedText
                                                        style={{
                                                            color: accentColor,
                                                            fontWeight: '700',
                                                            fontSize: 13,
                                                        }}
                                                    >
                                                        {selectedParticipants.length >
                                                        1
                                                            ? 'Zrušit výběr'
                                                            : 'Vybrat z pozvaných'}
                                                    </ThemedText>
                                                </Pressable>
                                            </View>
                                            <ScrollView
                                                style={{ maxHeight: 240 }}
                                                nestedScrollEnabled
                                                showsVerticalScrollIndicator={false}
                                            >
                                                <SelectablePeopleList
                                                    users={users}
                                                    selectedIds={selectedParticipants}
                                                    colors={colors}
                                                    limitReached={selectedParticipants.length >= peopleCount}
                                                    onToggle={(id) => {
                                                        const selected = selectedParticipants
                                                            .map(String)
                                                            .includes(String(id))
                                                        if (selected) {
                                                            setSelectedParticipants((prev) =>
                                                                prev.filter((x) => String(x) !== String(id))
                                                            )
                                                        } else if (selectedParticipants.length < peopleCount) {
                                                            setSelectedParticipants((prev) => [...prev, id as any])
                                                        }
                                                    }}
                                                />
                                            </ScrollView>
                                        </>
                                    )}
                                </ThemedView>
                            )}

                            {editField === 'participants' && (
                                <ThemedView style={styles.field}>
                                    <ThemedText
                                        style={[
                                            styles.label,
                                            {
                                                color: secondaryTextColor,
                                                marginBottom: 8,
                                            },
                                        ]}
                                    >
                                        Pozvaní (vidí událost, výchozí všichni
                                        přátelé)
                                    </ThemedText>
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            justifyContent: 'flex-end',
                                            marginBottom: 4,
                                        }}
                                    >
                                        <Pressable
                                            onPress={async () => {
                                                if (
                                                    selectedInvites.length > 0
                                                ) {
                                                    setSelectedInvites([])
                                                } else if (user?.id) {
                                                    setSelectedInvites(
                                                        await getDefaultInviteIds(
                                                            user.id
                                                        )
                                                    )
                                                }
                                            }}
                                            hitSlop={8}
                                            style={{ paddingVertical: 4 }}
                                        >
                                            <ThemedText
                                                style={{
                                                    color: accentColor,
                                                    fontWeight: '700',
                                                    fontSize: 13,
                                                }}
                                            >
                                                {selectedInvites.length > 0
                                                    ? 'Zrušit pozvánky'
                                                    : 'Pozvat všechny přátele'}
                                            </ThemedText>
                                        </Pressable>
                                    </View>
                                    <ScrollView
                                        style={{ maxHeight: 220, marginBottom: 16 }}
                                        showsVerticalScrollIndicator={false}
                                    >
                                        <SelectablePeopleList
                                            users={friendUsers.length ? friendUsers : users}
                                            selectedIds={selectedInvites}
                                            colors={colors}
                                            onToggle={(id) => {
                                                const invited = selectedInvites
                                                    .map(String)
                                                    .includes(String(id))
                                                if (invited) {
                                                    setSelectedInvites(
                                                        selectedInvites.filter(
                                                            (x) => String(x) !== String(id)
                                                        )
                                                    )
                                                    setSelectedParticipants(
                                                        selectedParticipants.filter(
                                                            (x) => String(x) !== String(id)
                                                        )
                                                    )
                                                } else {
                                                    setSelectedInvites([...selectedInvites, id])
                                                }
                                            }}
                                        />
                                    </ScrollView>

                                    <ThemedText
                                        style={[
                                            styles.label,
                                            {
                                                color: secondaryTextColor,
                                                marginBottom: 8,
                                            },
                                        ]}
                                    >
                                        Přihlášení k účasti
                                    </ThemedText>

                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            justifyContent: 'flex-end',
                                            marginBottom: 4,
                                        }}
                                    >
                                        <Pressable
                                            onPress={() => {
                                                if (
                                                    selectedParticipants.length >
                                                    1
                                                ) {
                                                    setSelectedParticipants(
                                                        user?.id
                                                            ? [Number(user.id)]
                                                            : []
                                                    )
                                                } else {
                                                    const inviteSet = new Set(
                                                        selectedInvites.map(
                                                            String
                                                        )
                                                    )
                                                    const me = user?.id
                                                        ? [Number(user.id)]
                                                        : []
                                                    const others = (
                                                        friendUsers.length
                                                            ? friendUsers
                                                            : users
                                                    )
                                                        .map((u) => u.id)
                                                        .filter(
                                                            (id) =>
                                                                inviteSet.has(
                                                                    String(id)
                                                                ) &&
                                                                String(id) !==
                                                                    String(
                                                                        user?.id
                                                                    )
                                                        )
                                                    const toSelect = [
                                                        ...me,
                                                        ...others,
                                                    ].slice(0, peopleCount)
                                                    setSelectedParticipants(
                                                        toSelect
                                                    )
                                                }
                                            }}
                                            hitSlop={8}
                                            style={{ paddingVertical: 4 }}
                                        >
                                            <ThemedText
                                                style={{
                                                    color: accentColor,
                                                    fontWeight: '700',
                                                    fontSize: 13,
                                                }}
                                            >
                                                {selectedParticipants.length > 1
                                                    ? 'Zrušit výběr'
                                                    : 'Vybrat z pozvaných'}
                                            </ThemedText>
                                        </Pressable>
                                    </View>
                                    <ScrollView
                                        style={{ maxHeight: 320 }}
                                        showsVerticalScrollIndicator={false}
                                    >
                                        <ThemedText
                                            style={{
                                                marginBottom: 10,
                                                color: secondaryTextColor,
                                                fontSize: 12,
                                                fontWeight: '600',
                                            }}
                                        >
                                            {editAllInstances &&
                                            (eventObj.pravidelnost ||
                                                eventObj.group_id)
                                                ? 'Účastníci pro všechny instance'
                                                : 'Účastníci pro tuto instanci'}
                                        </ThemedText>
                                        <SelectablePeopleList
                                            users={users}
                                            selectedIds={selectedParticipants}
                                            colors={colors}
                                            limitReached={selectedParticipants.length >= peopleCount}
                                            onToggle={(id) => {
                                                const selected = selectedParticipants
                                                    .map(String)
                                                    .includes(String(id))
                                                if (selected) {
                                                    setSelectedParticipants((prev) =>
                                                        prev.filter((x) => String(x) !== String(id))
                                                    )
                                                } else if (selectedParticipants.length < peopleCount) {
                                                    setSelectedParticipants((prev) => [...prev, id as any])
                                                }
                                            }}
                                        />
                                        })}
                                    </ScrollView>
                                </ThemedView>
                            )}

                            {editField === 'datetime' && (
                                <>
                                    {!editAllInstances ? (
                                        <ThemedView style={styles.field}>
                                            <ThemedText
                                                style={[
                                                    styles.label,
                                                    {
                                                        color: secondaryTextColor,
                                                        marginBottom: 8,
                                                    },
                                                ]}
                                            >
                                                {eventObj.pravidelnost ||
                                                eventObj.group_id
                                                    ? 'Výjimka pro tento den'
                                                    : 'Kdy'}
                                            </ThemedText>
                                            <WhenRow
                                                label="Od"
                                                value={formatWhen(
                                                    dateRange.startDate,
                                                    timeRange.start
                                                )}
                                                onPress={() => {
                                                    setTimeContext('once')
                                                    setTimeStep('start')
                                                    setTimeModalVisible(true)
                                                }}
                                                onPressCalendar={() =>
                                                    setDateModalVisible(true)
                                                }
                                                barColor={accentColor}
                                                secondary={secondaryTextColor}
                                                borderColor={borderColorTheme}
                                            />
                                            <WhenRow
                                                label="Do"
                                                value={formatWhen(
                                                    dateRange.endDate ||
                                                        dateRange.startDate,
                                                    timeRange.end
                                                )}
                                                onPress={() => {
                                                    setTimeContext('once')
                                                    setTimeStep('end')
                                                    setTimeModalVisible(true)
                                                }}
                                                onPressCalendar={() =>
                                                    setDateModalVisible(true)
                                                }
                                                barColor={accentColor}
                                                secondary={secondaryTextColor}
                                                borderColor={borderColorTheme}
                                            />
                                        </ThemedView>
                                    ) : (
                                        <>
                                            {eventObj.pravidelnost ? (
                                                <ThemedView
                                                    style={styles.field}
                                                >
                                                    <WhenRow
                                                        label="Začátek cyklu"
                                                        value={
                                                            dateRange.startDate
                                                                ? dayjs(
                                                                      dateRange.startDate
                                                                  )
                                                                      .format(
                                                                          'ddd D. M. YYYY'
                                                                      )
                                                                      .replace(
                                                                          /\.$/,
                                                                          ''
                                                                      )
                                                                      .replace(
                                                                          /^./,
                                                                          (c) =>
                                                                              c.toUpperCase()
                                                                      )
                                                                : 'Vyber datum'
                                                        }
                                                        onPress={() =>
                                                            setDateModalVisible(
                                                                true
                                                            )
                                                        }
                                                        barColor={accentColor}
                                                        secondary={
                                                            secondaryTextColor
                                                        }
                                                        borderColor={
                                                            borderColorTheme
                                                        }
                                                    />
                                                    <WhenRow
                                                        label="Konec (volitelné)"
                                                        value={
                                                            validUntilDate
                                                                ? dayjs(
                                                                      validUntilDate
                                                                  )
                                                                      .format(
                                                                          'ddd D. M. YYYY'
                                                                      )
                                                                      .replace(
                                                                          /\.$/,
                                                                          ''
                                                                      )
                                                                      .replace(
                                                                          /^./,
                                                                          (c) =>
                                                                              c.toUpperCase()
                                                                      )
                                                                : 'Bez omezení'
                                                        }
                                                        onPress={() =>
                                                            setEndDateModalVisible(
                                                                true
                                                            )
                                                        }
                                                        barColor={accentColor}
                                                        secondary={
                                                            secondaryTextColor
                                                        }
                                                        borderColor={
                                                            borderColorTheme
                                                        }
                                                    />
                                                    {!!validUntilDate && (
                                                        <Pressable
                                                            onPress={() =>
                                                                setValidUntilDate(
                                                                    undefined
                                                                )
                                                            }
                                                            style={{
                                                                alignSelf:
                                                                    'flex-end',
                                                                paddingVertical: 4,
                                                            }}
                                                        >
                                                            <ThemedText
                                                                style={{
                                                                    color: secondaryTextColor,
                                                                    fontSize: 12,
                                                                    fontWeight:
                                                                        '600',
                                                                }}
                                                            >
                                                                Zrušit konec
                                                            </ThemedText>
                                                        </Pressable>
                                                    )}

                                                    <View
                                                        style={
                                                            styles.cycleHeader
                                                        }
                                                    >
                                                        <ThemedText
                                                            style={[
                                                                styles.label,
                                                                {
                                                                    color: secondaryTextColor,
                                                                    marginBottom: 0,
                                                                },
                                                            ]}
                                                        >
                                                            Sestavení cyklu
                                                        </ThemedText>
                                                        <ThemedText
                                                            style={[
                                                                styles.cycleTotal,
                                                                {
                                                                    color: accentColor,
                                                                },
                                                            ]}
                                                        >
                                                            {cycleDaysTotal}{' '}
                                                            {cycleDaysTotal === 1
                                                                ? 'den'
                                                                : cycleDaysTotal <
                                                                    5
                                                                  ? 'dny'
                                                                  : 'dní'}
                                                        </ThemedText>
                                                    </View>

                                                    {cycleDaysTotal > 0 && (
                                                        <View
                                                            style={
                                                                styles.cycleStrip
                                                            }
                                                        >
                                                            {patternSegments.map(
                                                                (segment) => (
                                                                    <View
                                                                        key={`strip-${segment.id}`}
                                                                        style={[
                                                                            styles.cycleStripSeg,
                                                                            {
                                                                                flex: Math.max(
                                                                                    segment.days,
                                                                                    1
                                                                                ),
                                                                                backgroundColor:
                                                                                    segment.type ===
                                                                                    'work'
                                                                                        ? accentColor
                                                                                        : 'transparent',
                                                                                borderColor:
                                                                                    segment.type ===
                                                                                    'work'
                                                                                        ? accentColor
                                                                                        : secondaryTextColor,
                                                                                borderStyle:
                                                                                    segment.type ===
                                                                                    'work'
                                                                                        ? 'solid'
                                                                                        : 'dashed',
                                                                            },
                                                                        ]}
                                                                    />
                                                                )
                                                            )}
                                                        </View>
                                                    )}

                                                    <View
                                                        style={
                                                            styles.cycleLegend
                                                        }
                                                    >
                                                        <View
                                                            style={
                                                                styles.cycleLegendItem
                                                            }
                                                        >
                                                            <View
                                                                style={[
                                                                    styles.cycleLegendDot,
                                                                    {
                                                                        backgroundColor:
                                                                            accentColor,
                                                                    },
                                                                ]}
                                                            />
                                                            <ThemedText
                                                                style={[
                                                                    styles.cycleLegendText,
                                                                    {
                                                                        color: secondaryTextColor,
                                                                    },
                                                                ]}
                                                            >
                                                                Událost
                                                            </ThemedText>
                                                        </View>
                                                        <View
                                                            style={
                                                                styles.cycleLegendItem
                                                            }
                                                        >
                                                            <View
                                                                style={[
                                                                    styles.cycleLegendDot,
                                                                    {
                                                                        backgroundColor:
                                                                            'transparent',
                                                                        borderWidth: 1.5,
                                                                        borderColor:
                                                                            secondaryTextColor,
                                                                        borderStyle:
                                                                            'dashed',
                                                                    },
                                                                ]}
                                                            />
                                                            <ThemedText
                                                                style={[
                                                                    styles.cycleLegendText,
                                                                    {
                                                                        color: secondaryTextColor,
                                                                    },
                                                                ]}
                                                            >
                                                                Pauza
                                                            </ThemedText>
                                                        </View>
                                                    </View>

                                                    {patternSegments.map(
                                                        (segment, index) => {
                                                            const isWork =
                                                                segment.type ===
                                                                'work'
                                                            const segAccent =
                                                                isWork
                                                                    ? accentColor
                                                                    : secondaryTextColor
                                                            return (
                                                                <View
                                                                    key={
                                                                        segment.id
                                                                    }
                                                                    style={[
                                                                        styles.segmentCard,
                                                                        {
                                                                            backgroundColor:
                                                                                isWork
                                                                                    ? `${accentColor}12`
                                                                                    : cardBackgroundColor,
                                                                            borderColor:
                                                                                isWork
                                                                                    ? `${accentColor}55`
                                                                                    : borderColorTheme,
                                                                        },
                                                                    ]}
                                                                >
                                                                    <View
                                                                        style={[
                                                                            styles.segmentAccent,
                                                                            isWork
                                                                                ? {
                                                                                      backgroundColor:
                                                                                          accentColor,
                                                                                  }
                                                                                : {
                                                                                      backgroundColor:
                                                                                          'transparent',
                                                                                      borderRightWidth: 2,
                                                                                      borderRightColor:
                                                                                          secondaryTextColor,
                                                                                      borderStyle:
                                                                                          'dashed',
                                                                                  },
                                                                        ]}
                                                                    />
                                                                    <View
                                                                        style={
                                                                            styles.segmentMain
                                                                        }
                                                                    >
                                                                        <View
                                                                            style={
                                                                                styles.segmentHeader
                                                                            }
                                                                        >
                                                                            <View
                                                                                style={
                                                                                    styles.segmentTitleRow
                                                                                }
                                                                            >
                                                                                <View
                                                                                    style={[
                                                                                        styles.segmentIconWrap,
                                                                                        {
                                                                                            backgroundColor:
                                                                                                isWork
                                                                                                    ? `${accentColor}22`
                                                                                                    : `${secondaryTextColor}22`,
                                                                                        },
                                                                                    ]}
                                                                                >
                                                                                    <MaterialCommunityIcons
                                                                                        name={
                                                                                            isWork
                                                                                                ? 'briefcase-outline'
                                                                                                : 'coffee-outline'
                                                                                        }
                                                                                        size={
                                                                                            18
                                                                                        }
                                                                                        color={
                                                                                            segAccent
                                                                                        }
                                                                                    />
                                                                                </View>
                                                                                <View>
                                                                                    <ThemedText
                                                                                        style={[
                                                                                            styles.segmentIndex,
                                                                                            {
                                                                                                color: secondaryTextColor,
                                                                                            },
                                                                                        ]}
                                                                                    >
                                                                                        Blok{' '}
                                                                                        {index +
                                                                                            1}
                                                                                    </ThemedText>
                                                                                    <ThemedText
                                                                                        style={[
                                                                                            styles.segmentTitle,
                                                                                            {
                                                                                                color: surfaces.text,
                                                                                            },
                                                                                        ]}
                                                                                    >
                                                                                        {isWork
                                                                                            ? 'Událost'
                                                                                            : 'Pauza'}
                                                                                    </ThemedText>
                                                                                </View>
                                                                            </View>

                                                                            <View
                                                                                style={
                                                                                    styles.segmentControls
                                                                                }
                                                                            >
                                                                                <View
                                                                                    style={[
                                                                                        styles.daysStepper,
                                                                                        {
                                                                                            borderColor:
                                                                                                borderColorTheme,
                                                                                            backgroundColor:
                                                                                                cardBackgroundColor,
                                                                                        },
                                                                                    ]}
                                                                                >
                                                                                    <Pressable
                                                                                        onPress={() =>
                                                                                            bumpSegmentDays(
                                                                                                segment.id,
                                                                                                -1
                                                                                            )
                                                                                        }
                                                                                        hitSlop={
                                                                                            6
                                                                                        }
                                                                                        style={
                                                                                            styles.daysBtn
                                                                                        }
                                                                                    >
                                                                                        <MaterialCommunityIcons
                                                                                            name="minus"
                                                                                            size={
                                                                                                18
                                                                                            }
                                                                                            color={
                                                                                                surfaces.text
                                                                                            }
                                                                                        />
                                                                                    </Pressable>
                                                                                    <ThemedText
                                                                                        style={
                                                                                            styles.daysValue
                                                                                        }
                                                                                    >
                                                                                        {
                                                                                            segment.days
                                                                                        }
                                                                                        <ThemedText
                                                                                            style={{
                                                                                                fontSize: 12,
                                                                                                color: secondaryTextColor,
                                                                                            }}
                                                                                        >
                                                                                            {' '}
                                                                                            d
                                                                                        </ThemedText>
                                                                                    </ThemedText>
                                                                                    <Pressable
                                                                                        onPress={() =>
                                                                                            bumpSegmentDays(
                                                                                                segment.id,
                                                                                                1
                                                                                            )
                                                                                        }
                                                                                        hitSlop={
                                                                                            6
                                                                                        }
                                                                                        style={
                                                                                            styles.daysBtn
                                                                                        }
                                                                                    >
                                                                                        <MaterialCommunityIcons
                                                                                            name="plus"
                                                                                            size={
                                                                                                18
                                                                                            }
                                                                                            color={
                                                                                                surfaces.text
                                                                                            }
                                                                                        />
                                                                                    </Pressable>
                                                                                </View>
                                                                                {patternSegments.length >
                                                                                    1 && (
                                                                                    <Pressable
                                                                                        onPress={() =>
                                                                                            removeSegment(
                                                                                                segment.id
                                                                                            )
                                                                                        }
                                                                                        hitSlop={
                                                                                            8
                                                                                        }
                                                                                        style={
                                                                                            styles.segmentRemove
                                                                                        }
                                                                                    >
                                                                                        <MaterialCommunityIcons
                                                                                            name="close"
                                                                                            size={
                                                                                                18
                                                                                            }
                                                                                            color={
                                                                                                Brand.danger
                                                                                            }
                                                                                        />
                                                                                    </Pressable>
                                                                                )}
                                                                            </View>
                                                                        </View>

                                                                        {isWork && (
                                                                            <View
                                                                                style={
                                                                                    styles.segmentTimes
                                                                                }
                                                                            >
                                                                                <Pressable
                                                                                    style={[
                                                                                        styles.segmentTimeTap,
                                                                                        {
                                                                                            borderColor:
                                                                                                borderColorTheme,
                                                                                            backgroundColor:
                                                                                                cardBackgroundColor,
                                                                                        },
                                                                                    ]}
                                                                                    onPress={() => {
                                                                                        setEditingSegmentId(
                                                                                            segment.id
                                                                                        )
                                                                                        setTimeContext(
                                                                                            'patternSegment'
                                                                                        )
                                                                                        setTimeStep(
                                                                                            'start'
                                                                                        )
                                                                                        setTimeModalVisible(
                                                                                            true
                                                                                        )
                                                                                    }}
                                                                                >
                                                                                    <ThemedText
                                                                                        style={{
                                                                                            color: secondaryTextColor,
                                                                                            fontSize: 11,
                                                                                            fontWeight:
                                                                                                '500',
                                                                                        }}
                                                                                    >
                                                                                        Od
                                                                                    </ThemedText>
                                                                                    <ThemedText
                                                                                        style={{
                                                                                            fontWeight:
                                                                                                '700',
                                                                                            fontSize: 16,
                                                                                            color: surfaces.text,
                                                                                        }}
                                                                                    >
                                                                                        {formatTime(
                                                                                            segment.startTime
                                                                                        )}
                                                                                    </ThemedText>
                                                                                </Pressable>
                                                                                <MaterialCommunityIcons
                                                                                    name="arrow-right"
                                                                                    size={
                                                                                        16
                                                                                    }
                                                                                    color={
                                                                                        secondaryTextColor
                                                                                    }
                                                                                    style={{
                                                                                        alignSelf:
                                                                                            'center',
                                                                                    }}
                                                                                />
                                                                                <Pressable
                                                                                    style={[
                                                                                        styles.segmentTimeTap,
                                                                                        {
                                                                                            borderColor:
                                                                                                borderColorTheme,
                                                                                            backgroundColor:
                                                                                                cardBackgroundColor,
                                                                                        },
                                                                                    ]}
                                                                                    onPress={() => {
                                                                                        setEditingSegmentId(
                                                                                            segment.id
                                                                                        )
                                                                                        setTimeContext(
                                                                                            'patternSegment'
                                                                                        )
                                                                                        setTimeStep(
                                                                                            'end'
                                                                                        )
                                                                                        setTimeModalVisible(
                                                                                            true
                                                                                        )
                                                                                    }}
                                                                                >
                                                                                    <ThemedText
                                                                                        style={{
                                                                                            color: secondaryTextColor,
                                                                                            fontSize: 11,
                                                                                            fontWeight:
                                                                                                '500',
                                                                                        }}
                                                                                    >
                                                                                        Do
                                                                                    </ThemedText>
                                                                                    <ThemedText
                                                                                        style={{
                                                                                            fontWeight:
                                                                                                '700',
                                                                                            fontSize: 16,
                                                                                            color: surfaces.text,
                                                                                        }}
                                                                                    >
                                                                                        {formatTime(
                                                                                            segment.endTime
                                                                                        )}
                                                                                    </ThemedText>
                                                                                </Pressable>
                                                                            </View>
                                                                        )}
                                                                    </View>
                                                                </View>
                                                            )
                                                        }
                                                    )}

                                                    <View
                                                        style={
                                                            styles.cycleAddRow
                                                        }
                                                    >
                                                        <Pressable
                                                            onPress={() =>
                                                                addSegment(
                                                                    'work'
                                                                )
                                                            }
                                                            style={[
                                                                styles.cycleAddBtn,
                                                                {
                                                                    borderColor:
                                                                        accentColor,
                                                                    backgroundColor: `${accentColor}14`,
                                                                },
                                                            ]}
                                                        >
                                                            <MaterialCommunityIcons
                                                                name="briefcase-plus-outline"
                                                                size={18}
                                                                color={
                                                                    accentColor
                                                                }
                                                            />
                                                            <ThemedText
                                                                style={{
                                                                    color: accentColor,
                                                                    fontWeight:
                                                                        '700',
                                                                    fontSize: 13,
                                                                }}
                                                            >
                                                                Událost
                                                            </ThemedText>
                                                        </Pressable>
                                                        <Pressable
                                                            onPress={() =>
                                                                addSegment(
                                                                    'off'
                                                                )
                                                            }
                                                            style={[
                                                                styles.cycleAddBtn,
                                                                {
                                                                    borderColor:
                                                                        chipInactiveBorder,
                                                                },
                                                            ]}
                                                        >
                                                            <MaterialCommunityIcons
                                                                name="coffee-outline"
                                                                size={18}
                                                                color={
                                                                    chipInactive
                                                                }
                                                            />
                                                            <ThemedText
                                                                style={{
                                                                    color: chipInactive,
                                                                    fontWeight:
                                                                        '700',
                                                                    fontSize: 13,
                                                                }}
                                                            >
                                                                Pauza
                                                            </ThemedText>
                                                        </Pressable>
                                                    </View>
                                                </ThemedView>
                                            ) : (
                                                <ThemedView
                                                    style={styles.field}
                                                >
                                                    {eventObj.group_id ? (
                                                        <>
                                                            <ThemedText
                                                                style={[
                                                                    styles.label,
                                                                    {
                                                                        color: secondaryTextColor,
                                                                        marginBottom: 8,
                                                                    },
                                                                ]}
                                                            >
                                                                Seznam všech
                                                                instancí v této
                                                                skupině:
                                                            </ThemedText>

                                                            {editingMultiDateIndex !==
                                                                null ? (
                                                                <ThemedView
                                                                    style={{
                                                                        paddingVertical: 4,
                                                                    }}
                                                                >
                                                                    <WhenRow
                                                                        label="Od"
                                                                        value={formatWhen(
                                                                            multiDateInstances[
                                                                                editingMultiDateIndex
                                                                            ]
                                                                                ?.date,
                                                                            multiDateInstances[
                                                                                editingMultiDateIndex
                                                                            ]
                                                                                ?.startTime
                                                                        )}
                                                                        onPress={() => {
                                                                            setTimeContext(
                                                                                'multi'
                                                                            )
                                                                            setTimeStep(
                                                                                'start'
                                                                            )
                                                                            setTimeModalVisible(
                                                                                true
                                                                            )
                                                                        }}
                                                                        onPressCalendar={() =>
                                                                            setDateModalVisible(
                                                                                true
                                                                            )
                                                                        }
                                                                        barColor={
                                                                            accentColor
                                                                        }
                                                                        secondary={
                                                                            secondaryTextColor
                                                                        }
                                                                        borderColor={
                                                                            borderColorTheme
                                                                        }
                                                                    />
                                                                    <WhenRow
                                                                        label="Do"
                                                                        value={formatWhen(
                                                                            multiDateInstances[
                                                                                editingMultiDateIndex
                                                                            ]
                                                                                ?.date,
                                                                            multiDateInstances[
                                                                                editingMultiDateIndex
                                                                            ]
                                                                                ?.endTime
                                                                        )}
                                                                        onPress={() => {
                                                                            setTimeContext(
                                                                                'multi'
                                                                            )
                                                                            setTimeStep(
                                                                                'end'
                                                                            )
                                                                            setTimeModalVisible(
                                                                                true
                                                                            )
                                                                        }}
                                                                        onPressCalendar={() =>
                                                                            setDateModalVisible(
                                                                                true
                                                                            )
                                                                        }
                                                                        barColor={
                                                                            accentColor
                                                                        }
                                                                        secondary={
                                                                            secondaryTextColor
                                                                        }
                                                                        borderColor={
                                                                            borderColorTheme
                                                                        }
                                                                    />
                                                                    <Pressable
                                                                        onPress={() => {
                                                                            setEditingMultiDateIndex(
                                                                                null
                                                                            )
                                                                        }}
                                                                        style={[
                                                                            styles.saveBtn,
                                                                            {
                                                                                backgroundColor:
                                                                                    accentColor,
                                                                                marginTop: 12,
                                                                            },
                                                                        ]}
                                                                    >
                                                                        <ThemedText
                                                                            style={
                                                                                styles.saveBtnText
                                                                            }
                                                                        >
                                                                            Hotovo
                                                                        </ThemedText>
                                                                    </Pressable>
                                                                    <Pressable
                                                                        onPress={() =>
                                                                            setEditingMultiDateIndex(
                                                                                null
                                                                            )
                                                                        }
                                                                        style={
                                                                            styles.cancelBtn
                                                                        }
                                                                    >
                                                                        <ThemedText
                                                                            style={{
                                                                                color: secondaryTextColor,
                                                                                fontWeight:
                                                                                    '600',
                                                                            }}
                                                                        >
                                                                            Zrušit
                                                                        </ThemedText>
                                                                    </Pressable>
                                                                </ThemedView>
                                                            ) : (
                                                                <>
                                                                    {multiDateInstances.map(
                                                                        (
                                                                            instance,
                                                                            idx
                                                                        ) => (
                                                                            <View
                                                                                key={
                                                                                    idx
                                                                                }
                                                                                style={[
                                                                                    styles.dayInstanceRow,
                                                                                    {
                                                                                        borderBottomColor:
                                                                                            borderColorTheme,
                                                                                    },
                                                                                ]}
                                                                            >
                                                                                <View
                                                                                    style={[
                                                                                        styles.dayInstanceBar,
                                                                                        {
                                                                                            backgroundColor:
                                                                                                accentColor,
                                                                                        },
                                                                                    ]}
                                                                                />
                                                                                <View
                                                                                    style={{
                                                                                        flex: 1,
                                                                                    }}
                                                                                >
                                                                                    <ThemedText
                                                                                        style={{
                                                                                            fontWeight:
                                                                                                '700',
                                                                                            fontSize: 15,
                                                                                        }}
                                                                                    >
                                                                                        {formatDate(
                                                                                            instance.date
                                                                                        )}
                                                                                    </ThemedText>
                                                                                    <ThemedText
                                                                                        style={{
                                                                                            color: secondaryTextColor,
                                                                                            fontSize: 13,
                                                                                        }}
                                                                                    >
                                                                                        {formatTime(
                                                                                            instance.startTime
                                                                                        )}{' '}
                                                                                        –{' '}
                                                                                        {formatTime(
                                                                                            instance.endTime
                                                                                        )}
                                                                                    </ThemedText>
                                                                                </View>
                                                                                <IconButton
                                                                                    icon="pencil"
                                                                                    size={
                                                                                        18
                                                                                    }
                                                                                    onPress={() => {
                                                                                        setDateRange(
                                                                                            {
                                                                                                startDate:
                                                                                                    instance.date,
                                                                                                endDate:
                                                                                                    instance.date,
                                                                                            }
                                                                                        )
                                                                                        setTimeRange(
                                                                                            {
                                                                                                start: instance.startTime,
                                                                                                end: instance.endTime,
                                                                                            }
                                                                                        )
                                                                                        setEditingMultiDateIndex(
                                                                                            idx
                                                                                        )
                                                                                    }}
                                                                                />
                                                                                <IconButton
                                                                                    icon="trash-can"
                                                                                    size={
                                                                                        18
                                                                                    }
                                                                                    iconColor={
                                                                                        Brand.danger
                                                                                    }
                                                                                    onPress={() => {
                                                                                        setMultiDateInstances(
                                                                                            (
                                                                                                prev
                                                                                            ) =>
                                                                                                prev.filter(
                                                                                                    (
                                                                                                        _,
                                                                                                        i
                                                                                                    ) =>
                                                                                                        i !==
                                                                                                        idx
                                                                                                )
                                                                                        )
                                                                                    }}
                                                                                />
                                                                            </View>
                                                                        )
                                                                    )}
                                                                    <Pressable
                                                                        onPress={() => {
                                                                            const newDate =
                                                                                new Date()
                                                                            newDate.setDate(
                                                                                newDate.getDate() +
                                                                                    1
                                                                            )
                                                                            setMultiDateInstances(
                                                                                (
                                                                                    prev
                                                                                ) => [
                                                                                    ...prev,
                                                                                    {
                                                                                        date: newDate,
                                                                                        startTime:
                                                                                            new Date(
                                                                                                newDate.setHours(
                                                                                                    8,
                                                                                                    0,
                                                                                                    0,
                                                                                                    0
                                                                                                )
                                                                                            ),
                                                                                        endTime:
                                                                                            new Date(
                                                                                                newDate.setHours(
                                                                                                    9,
                                                                                                    0,
                                                                                                    0,
                                                                                                    0
                                                                                                )
                                                                                            ),
                                                                                    },
                                                                                ]
                                                                            )
                                                                        }}
                                                                        style={[
                                                                            styles.cycleAddBtn,
                                                                            {
                                                                                marginTop: 12,
                                                                                borderColor:
                                                                                    accentColor,
                                                                                backgroundColor: `${accentColor}14`,
                                                                            },
                                                                        ]}
                                                                    >
                                                                        <MaterialCommunityIcons
                                                                            name="plus"
                                                                            size={
                                                                                18
                                                                            }
                                                                            color={
                                                                                accentColor
                                                                            }
                                                                        />
                                                                        <ThemedText
                                                                            style={{
                                                                                color: accentColor,
                                                                                fontWeight:
                                                                                    '700',
                                                                                fontSize: 13,
                                                                            }}
                                                                        >
                                                                            Přidat
                                                                            den
                                                                        </ThemedText>
                                                                    </Pressable>
                                                                </>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ThemedText
                                                                style={[
                                                                    styles.label,
                                                                    {
                                                                        color: secondaryTextColor,
                                                                        marginBottom: 8,
                                                                    },
                                                                ]}
                                                            >
                                                                Seznam všech
                                                                instancí v této
                                                                sérii:
                                                            </ThemedText>

                                                            {editingRelatedEvent ? (
                                                                <ThemedView
                                                                    style={{
                                                                        paddingVertical: 4,
                                                                    }}
                                                                >
                                                                    <WhenRow
                                                                        label="Od"
                                                                        value={formatWhen(
                                                                            dateRange.startDate,
                                                                            timeRange.start
                                                                        )}
                                                                        onPress={() => {
                                                                            setTimeContext(
                                                                                'once'
                                                                            )
                                                                            setTimeStep(
                                                                                'start'
                                                                            )
                                                                            setTimeModalVisible(
                                                                                true
                                                                            )
                                                                        }}
                                                                        onPressCalendar={() =>
                                                                            setDateModalVisible(
                                                                                true
                                                                            )
                                                                        }
                                                                        barColor={
                                                                            accentColor
                                                                        }
                                                                        secondary={
                                                                            secondaryTextColor
                                                                        }
                                                                        borderColor={
                                                                            borderColorTheme
                                                                        }
                                                                    />
                                                                    <WhenRow
                                                                        label="Do"
                                                                        value={formatWhen(
                                                                            dateRange.endDate ||
                                                                                dateRange.startDate,
                                                                            timeRange.end
                                                                        )}
                                                                        onPress={() => {
                                                                            setTimeContext(
                                                                                'once'
                                                                            )
                                                                            setTimeStep(
                                                                                'end'
                                                                            )
                                                                            setTimeModalVisible(
                                                                                true
                                                                            )
                                                                        }}
                                                                        onPressCalendar={() =>
                                                                            setDateModalVisible(
                                                                                true
                                                                            )
                                                                        }
                                                                        barColor={
                                                                            accentColor
                                                                        }
                                                                        secondary={
                                                                            secondaryTextColor
                                                                        }
                                                                        borderColor={
                                                                            borderColorTheme
                                                                        }
                                                                    />

                                                                    <Pressable
                                                                        onPress={
                                                                            handleSaveSpecificRelatedEvent
                                                                        }
                                                                        style={[
                                                                            styles.saveBtn,
                                                                            {
                                                                                backgroundColor:
                                                                                    accentColor,
                                                                                marginTop: 12,
                                                                            },
                                                                        ]}
                                                                    >
                                                                        <ThemedText
                                                                            style={
                                                                                styles.saveBtnText
                                                                            }
                                                                        >
                                                                            Uložit
                                                                            čas
                                                                        </ThemedText>
                                                                    </Pressable>

                                                                    <Pressable
                                                                        onPress={() =>
                                                                            setEditingRelatedEvent(
                                                                                null
                                                                            )
                                                                        }
                                                                        style={
                                                                            styles.cancelBtn
                                                                        }
                                                                    >
                                                                        <ThemedText
                                                                            style={{
                                                                                color: secondaryTextColor,
                                                                                fontWeight:
                                                                                    '600',
                                                                            }}
                                                                        >
                                                                            Zpět
                                                                            na
                                                                            seznam
                                                                        </ThemedText>
                                                                    </Pressable>
                                                                </ThemedView>
                                                            ) : (
                                                                (multiDateInstances.length >
                                                                0
                                                                    ? multiDateInstances
                                                                    : relatedEvents
                                                                ).map(
                                                                    (
                                                                        ev: any
                                                                    ) => (
                                                                        <View
                                                                            key={
                                                                                ev.id
                                                                            }
                                                                            style={[
                                                                                styles.dayInstanceRow,
                                                                                {
                                                                                    borderBottomColor:
                                                                                        borderColorTheme,
                                                                                },
                                                                            ]}
                                                                        >
                                                                            <View
                                                                                style={[
                                                                                    styles.dayInstanceBar,
                                                                                    {
                                                                                        backgroundColor:
                                                                                            accentColor,
                                                                                    },
                                                                                ]}
                                                                            />
                                                                            <View
                                                                                style={{
                                                                                    flex: 1,
                                                                                }}
                                                                            >
                                                                                <ThemedText
                                                                                    style={{
                                                                                        fontWeight:
                                                                                            '700',
                                                                                        fontSize: 15,
                                                                                    }}
                                                                                >
                                                                                    {formatDate(
                                                                                        ev.startTime ||
                                                                                            ev.start
                                                                                    )}
                                                                                </ThemedText>
                                                                                <ThemedText
                                                                                    style={{
                                                                                        color: secondaryTextColor,
                                                                                        fontSize: 13,
                                                                                    }}
                                                                                >
                                                                                    {formatTime(
                                                                                        ev.startTime ||
                                                                                            ev.start
                                                                                    )}{' '}
                                                                                    –{' '}
                                                                                    {formatTime(
                                                                                        ev.endTime ||
                                                                                            ev.end
                                                                                    )}
                                                                                </ThemedText>
                                                                            </View>

                                                                            <IconButton
                                                                                icon="pencil"
                                                                                size={
                                                                                    18
                                                                                }
                                                                                onPress={() => {
                                                                                    const safeD =
                                                                                        getSafeDates(
                                                                                            ev
                                                                                        )
                                                                                    setDateRange(
                                                                                        {
                                                                                            startDate:
                                                                                                safeD.s,
                                                                                            endDate:
                                                                                                safeD.e,
                                                                                        }
                                                                                    )
                                                                                    setTimeRange(
                                                                                        {
                                                                                            start: safeD.s,
                                                                                            end: safeD.e,
                                                                                        }
                                                                                    )
                                                                                    setEditingRelatedEvent(
                                                                                        ev
                                                                                    )
                                                                                }}
                                                                            />

                                                                            <IconButton
                                                                                icon="trash-can"
                                                                                size={
                                                                                    18
                                                                                }
                                                                                iconColor={
                                                                                    Brand.danger
                                                                                }
                                                                                onPress={() =>
                                                                                    handleDeleteRelatedEvent(
                                                                                        ev.id
                                                                                    )
                                                                                }
                                                                            />
                                                                        </View>
                                                                    )
                                                                )
                                                            )}
                                                        </>
                                                    )}
                                                </ThemedView>
                                            )}
                                        </>
                                    )}
                                </>
                            )}
                        </ScrollView>

                        {(!isRepeatingNonPattern ||
                            editField !== 'datetime' ||
                            !editingRelatedEvent) && (
                                <View style={styles.editModalFooter}>
                                    <Pressable
                                        onPress={handleSave}
                                        disabled={actionBusy}
                                        style={({ pressed }) => [
                                            styles.saveBtn,
                                            {
                                                backgroundColor: actionBusy
                                                    ? '#9AA0A6'
                                                    : accentColor,
                                                opacity:
                                                    pressed && !actionBusy
                                                        ? 0.9
                                                        : 1,
                                            },
                                        ]}
                                    >
                                        {actionBusy ? (
                                            <ActivityIndicator color="#fff" />
                                        ) : (
                                            <ThemedText style={styles.saveBtnText}>
                                                Uložit
                                            </ThemedText>
                                        )}
                                    </Pressable>
                                    <Pressable
                                        onPress={() => setModalVisible(false)}
                                        disabled={actionBusy}
                                        style={styles.cancelBtn}
                                    >
                                        <ThemedText
                                            style={{
                                                color: secondaryTextColor,
                                                fontWeight: '600',
                                            }}
                                        >
                                            Zavřít
                                        </ThemedText>
                                    </Pressable>
                                </View>
                            )}
                    </ThemedView>
                </Modal>
            </Portal>

            <DatePickerModal
                startWeekOnMonday={true}
                locale="cs"
                mode="range"
                visible={dateModalVisible}
                onDismiss={() => setDateModalVisible(false)}
                startDate={dateRange.startDate}
                endDate={dateRange.endDate}
                date={dateRange.startDate}
                onConfirm={onConfirmDate}
                label="Vyberte datum od - do"
                saveLabel="Uložit"
                startLabel="Od"
                endLabel="Do"
            />

            <DatePickerModal
                startWeekOnMonday={true}
                locale="cs"
                mode="single"
                visible={endDateModalVisible}
                onDismiss={() => setEndDateModalVisible(false)}
                date={validUntilDate}
                onConfirm={({ date }: any) => {
                    setEndDateModalVisible(false)
                    if (date) setValidUntilDate(date)
                }}
                label="Konec platnosti série"
                saveLabel="Uložit"
            />

            <TimePickerModal
                visible={timeModalVisible}
                onDismiss={() => setTimeModalVisible(false)}
                onConfirm={handleTimeConfirm}
                hours={8}
                minutes={0}
                use24HourClock
                label={
                    timeStep === 'start' ? 'Nastavit čas od' : 'Nastavit čas do'
                }
            />
        </>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 20, paddingTop: 0 },

    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        minHeight: 44,
    },
    iconBtn: {
        padding: 6,
        borderRadius: 10,
    },
    scrollContent: {
        paddingBottom: 40,
        paddingTop: 4,
        gap: 0,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginBottom: 28,
        marginTop: 8,
    },
    heroTitle: {
        flex: 1,
        fontSize: 34,
        fontWeight: '800',
        lineHeight: 40,
        letterSpacing: -0.6,
    },
    infoBlock: {
        gap: 22,
        marginBottom: 24,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 14,
    },
    infoTextCol: {
        flex: 1,
        minWidth: 0,
        gap: 2,
    },
    infoPrimaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    infoPrimary: {
        flex: 1,
        fontSize: 16,
        fontWeight: '700',
        lineHeight: 22,
    },
    infoSecondary: {
        fontSize: 14,
        lineHeight: 20,
        marginTop: 1,
    },
    editHint: {
        padding: 2,
    },
    avatarRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 12,
    },
    avatarItem: {
        width: 40,
        alignItems: 'center',
        gap: 4,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarOverflow: {
        borderWidth: StyleSheet.hairlineWidth,
    },
    avatarText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '800',
    },
    avatarName: {
        fontSize: 10,
        fontWeight: '600',
        textAlign: 'center',
        width: '100%',
        lineHeight: 12,
    },
    avatarLg: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarLgText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '800',
    },
    participantsSheet: {
        marginHorizontal: 20,
        borderRadius: 20,
        padding: 18,
        maxHeight: '80%',
    },
    participantsSheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    participantsSheetTitle: {
        fontSize: 18,
        fontWeight: '800',
    },
    participantDetailRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    participantDetailName: {
        fontSize: 16,
        fontWeight: '700',
    },
    mapBlock: {
        marginBottom: 28,
        gap: 10,
    },
    mapWrap: {
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
    },
    mapsLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
    },
    actions: {
        gap: 12,
        marginTop: 4,
    },
    primaryBtn: {
        borderRadius: 14,
        width: '100%',
    },
    secondaryBtn: {
        borderRadius: 14,
        width: '100%',
        borderWidth: 1.5,
        backgroundColor: 'transparent',
    },
    primaryBtnContent: {
        paddingVertical: 8,
    },
    btnLabel: {
        fontSize: 16,
        fontWeight: '700',
    },

    field: { marginBottom: 16, zIndex: 1 },

    label: { fontWeight: '800', marginBottom: 2 },

    buttons: { flexDirection: 'column', marginTop: 24, gap: 12 },

    button: { borderRadius: 6, width: '100%' },

    modalContainer: { margin: 10, flex: 1, justifyContent: 'center' },

    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 16,
        textAlign: 'center',
    },

    content: { padding: 20, borderRadius: 16, maxHeight: '95%', width: '100%' },

    editModalHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingBottom: 12,
        marginBottom: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    editModalTitle: {
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: -0.3,
    },
    editModalClose: {
        padding: 4,
        marginLeft: 8,
    },
    editModalFooter: {
        marginTop: 12,
        gap: 4,
    },
    titleInput: {
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: -0.4,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        marginBottom: 8,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    personRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: 10,
    },
    personDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    personName: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
    },
    dayInstanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: 4,
    },
    dayInstanceBar: {
        width: 4,
        borderRadius: 2,
        alignSelf: 'stretch',
        minHeight: 28,
        marginRight: 8,
    },
    cycleHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 16,
        marginBottom: 8,
    },
    cycleTotal: {
        fontSize: 13,
        fontWeight: '700',
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
        marginTop: 8,
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
    segmentCard: {
        flexDirection: 'row',
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
        marginBottom: 10,
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
        alignItems: 'center',
        justifyContent: 'space-between',
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
        fontWeight: '600',
    },
    segmentTitle: {
        fontSize: 15,
        fontWeight: '700',
    },
    segmentControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
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
        paddingVertical: 6,
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

    counterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    counterValue: {
        fontSize: 22,
        fontWeight: '700',
        minWidth: 36,
        textAlign: 'center',
    },
    saveBtn: {
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
    cancelBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
    },

    counterInput: {
        textAlign: 'center',
        width: 60,
        backgroundColor: 'transparent',
    },
})
