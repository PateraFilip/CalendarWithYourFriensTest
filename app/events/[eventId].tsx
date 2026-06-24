import { createPatternEvent } from '@/api/events/create_event'

import { createException } from '@/api/events/create_exception'

import { deleteEvent } from '@/api/events/delete_event'

import { fetchUserEvents, UserEvent } from '@/api/events/getUserEvents'

import { fetchColors } from '@/api/users/get_colors'
import { fetchUsers } from '@/api/users/get_users'

import { cancelEvent } from '@/api/events/cancel_event'
import { joinEvent } from '@/api/events/join_event'
import { sendSystemMessage } from '@/api/system/send_system_message'

import { updateEvent, updateWeeklyEvent } from '@/api/events/update_event'

import { ThemedSafeView } from '@/components/ThemedSafeView'

import { ThemedText } from '@/components/themed-text'

import { ThemedView } from '@/components/themed-view'

import { useThemeColor } from '@/hooks/use-theme-color'

import { useAuth } from '@/hooks/useAuth'

import { createClient } from '@supabase/supabase-js'

import dayjs from 'dayjs'

import { Stack, useLocalSearchParams, useRouter } from 'expo-router'

import { ArrowLeft } from 'lucide-react-native'

import React, { useEffect, useState } from 'react'

import {
    ActivityIndicator,
    Alert,
    Linking,
    LogBox,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native'

import EventMap from '@/components/EventMap'

import {
    Button,
    Dialog,
    IconButton,
    Modal,
    TextInput as PaperTextInput,
    Portal,
    TextInput,
} from 'react-native-paper'

import { DatePickerModal, TimePickerModal } from 'react-native-paper-dates'

LogBox.ignoreLogs(['VirtualizedLists should never be nested'])

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

const SUPABASE_URL = 'https://sdzyhihtqrgsntbxlugp.supabase.co'

const SUPABASE_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkenloaWh0cXJnc250YnhsdWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NDk2MTEsImV4cCI6MjA5NjEyNTYxMX0.4L2K8gmIvWn6FwkECofkvJ-cpFr8hXCZbjxOqpECN38'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const getSafeDates = (ev: any) => {
    if (!ev) return { s: new Date(), e: new Date(Date.now() + 3600000) }

    const s = ev.start ? new Date(ev.start) : (ev.startTime ? new Date(ev.startTime) : new Date())

    let e = ev.end ? new Date(ev.end) : (ev.endTime ? new Date(ev.endTime) : new Date(s.getTime() + 3600000))

    if (ev.cas_od) {
        const parts = String(ev.cas_od).split(':')

        if (parts.length >= 2)
            s.setHours(Number(parts[0]), Number(parts[1]), 0, 0)
    }

    if (ev.cas_do) {
        const parts = String(ev.cas_do).split(':')

        if (parts.length >= 2)
            e.setHours(Number(parts[0]), Number(parts[1]), 0, 0)
    }

    if (isNaN(s.getTime())) s.setTime(new Date().getTime())

    if (isNaN(e.getTime())) e.setTime(s.getTime() + 3600000)

    return { s, e }
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

    const initialEventObj = eventParam ? JSON.parse(eventParam) : null

    const [eventObj, setEventObj] = useState<any>(initialEventObj)
    const [isLoadingEvent, setIsLoadingEvent] = useState(
        !initialEventObj && !!eventId
    )

    const [userEvents, setUserEvents] = useState<UserEvent[]>([])

    const { user } = useAuth()

    const buttonColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text')

    const buttonTextColor = useThemeColor(
        { light: '#fff', dark: '#000' },
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

    const borderColorTheme = useThemeColor(
        { light: '#e5e5ea', dark: '#38383a' },
        'border'
    )

    const secondaryTextColor = useThemeColor(
        { light: '#666', dark: '#aaa' },
        'text'
    )

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

    const [title, setTitle] = useState(eventObj?.title || '')

    const [poloha, setPoloha] = useState(eventObj?.poloha || '')

    const [latitude, setLatitude] = useState<number | null>(
        eventObj?.latitude || null
    )

    const [longitude, setLongitude] = useState<number | null>(
        eventObj?.longitude || null
    )

    const [locationResults, setLocationResults] = useState<any[]>([])

    const [isSearchingLocation, setIsSearchingLocation] = useState(false)

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

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (poloha.length > 2) {
                setIsSearchingLocation(true)

                try {
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(poloha)}&format=json&addressdetails=1&limit=5&countrycodes=cz,sk`,
                        {
                            headers: {
                                'User-Agent':
                                    'share calendar with you friends/1.0',
                                Accept: 'application/json',
                            },
                        }
                    )

                    if (response.ok) {
                        const data = await response.json()
                        setLocationResults(data)
                    }
                } catch (err) {
                } finally {
                    setIsSearchingLocation(false)
                }
            } else {
                setLocationResults([])
            }
        }, 600)

        return () => clearTimeout(delayDebounceFn)
    }, [poloha])

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

    const formatDate = (d: string | Date) => dayjs(d).format('DD. MM. YYYY')

    const formatTime = (d: string | Date) => dayjs(d).format('HH:mm')

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

        if (field === 'capacity') setPeopleCount(eventObj.pocet_lidi || 2)

        if (field === 'participants') {
            const isRecurring = !!eventObj.pravidelnost;

            if (!editAllInstances && isRecurring) {
                const instanceDateStr = dayjs(eventObj.start).format(
                    'YYYY-MM-DD'
                )
                const clearedMarker = userEvents.find(
                    (u) => u.event_id === eventObj.id && u.instance_date === `CLEARED-${instanceDateStr}`
                )
                const instanceSpecificEvents = userEvents.filter(
                    (u) => u.event_id === eventObj.id && u.instance_date === instanceDateStr
                )

                if (clearedMarker) {
                    setSelectedParticipants([])
                } else if (instanceSpecificEvents.length > 0) {
                    setSelectedParticipants(
                        instanceSpecificEvents.map((ue) => ue.user_id)
                    )
                } else {
                    setSelectedParticipants(
                        userEvents
                            .filter((u) => u.event_id === eventObj.id && !u.instance_date)
                            .map((ue) => ue.user_id)
                    )
                }
            } else {
                setSelectedParticipants(
                    userEvents
                        .filter((u) => u.event_id === eventObj.id && !u.instance_date)
                        .map((ue) => ue.user_id)
                )
            }
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

    const handleScopeSelection = (allInstances: boolean) => {
        setScopeDialogVisible(false)

        setEditAllInstances(allInstances)

        openMainModal(allInstances)
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
        const { start, end } = getSaveDates()

        const origDates = getSafeDates(eventObj)

        const finalIsGroup = peopleCount > 1
        const isChangingToGroup = !eventObj.is_group && finalIsGroup
        const isChangingToPrivate = eventObj.is_group && !finalIsGroup

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

                    puvodni_den: origDates.s,
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
            if (editField === 'participants') {
                const isRecurring = !!eventObj.pravidelnost

                if (isRecurring) {
                    console.log('Saving participants for single recurring instance:', {
                        eventId: eventObj.id,
                        selectedParticipants,
                    })
                    const instanceDateStr = dayjs(eventObj.start).format(
                        'YYYY-MM-DD'
                    )
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
                // Update all instances in the multi-date group
                if (editField === 'datetime' || editField === 'all') {
                    // Delete all existing instances in the group
                    await supabase
                        .from('event_series')
                        .delete()
                        .eq('group_id', eventObj.group_id)

                    // Create new instances from multiDateInstances
                    const eventsToInsert = multiDateInstances.map(
                        (instance) => ({
                            nazev: payload.title !== undefined ? payload.title : (instance.nazev || eventObj.title),
                            zakladatel_id: eventObj.user_id,
                            cas_od: dayjs(instance.startTime).format('HH:mm'),
                            cas_do: dayjs(instance.endTime).format('HH:mm'),
                            pocet_lidi: payload.peopleCount !== undefined ? payload.peopleCount : (instance.pocet_lidi !== undefined ? instance.pocet_lidi : eventObj.pocet_lidi),
                            is_group: payload.is_group !== undefined ? payload.is_group : (instance.is_group !== undefined ? instance.is_group : eventObj.is_group),
                            poloha: payload.poloha !== undefined ? payload.poloha : (instance.poloha !== undefined ? instance.poloha : eventObj.poloha),
                            latitude: payload.latitude !== undefined ? payload.latitude : (instance.latitude !== undefined ? instance.latitude : eventObj.latitude),
                            longitude: payload.longitude !== undefined ? payload.longitude : (instance.longitude !== undefined ? instance.longitude : eventObj.longitude),
                            recurrence_rule: {
                                type: 'once',
                                start_date: dayjs(instance.date).format(
                                    'YYYY-MM-DD'
                                ),
                                end_date: dayjs(instance.date).format(
                                    'YYYY-MM-DD'
                                ),
                            },
                            valid_from: dayjs(instance.date).format(
                                'YYYY-MM-DD'
                            ),
                            valid_until: dayjs(instance.date).format(
                                'YYYY-MM-DD'
                            ),
                            group_id: eventObj.group_id,
                        })
                    )

                    const { error } = await supabase
                        .from('event_series')
                        .insert(eventsToInsert)
                    if (error) {
                        console.error('Error updating multi-date group:', error)
                    }
                } else {
                    // Update non-datetime fields for all instances
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

                    const { error } = await supabase
                        .from('event_series')
                        .update(updateData)
                        .eq('group_id', eventObj.group_id)
                    if (error) {
                        console.error(
                            'Error updating multi-date group fields:',
                            error
                        )
                    }
                }

                // Handle participants for multi-date group (all instances)
                if (editField === 'participants') {
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
                if (editField === 'participants') {
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
                if (editField === 'datetime' || editField === 'all') {
                    // Rozdělení historie a vytvoření nové větve cyklu

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
                                pattern.push({
                                    work: true,
                                    start: sTime,
                                    end: eTime,
                                })
                            else pattern.push({ work: false })

                            cycleDays++
                        }
                    })

                    const firstWork = patternSegments.find(
                        (s) => s.type === 'work'
                    )

                    const oldValidUntil = dayjs(newStartDateStr)
                        .subtract(1, 'day')
                        .format('YYYY-MM-DD')

                    await supabase
                        .from('event_series')
                        .update({ valid_until: oldValidUntil })
                        .eq('id', eventObj.id)

                    const result = await createPatternEvent({
                        title: payload.title,
                        poloha: payload.poloha,
                        latitude: payload.latitude,
                        longitude: payload.longitude,

                        user_id: eventObj.user_id,
                        anchor_date: new Date(newStartDateStr),
                        valid_until: newValidUntilStr || undefined,

                        cycle_days: cycleDays,
                        pattern: pattern,

                        cas_od: firstWork?.startTime
                            ? formatTime(firstWork.startTime)
                            : '08:00',

                        cas_do: firstWork?.endTime
                            ? formatTime(firstWork.endTime)
                            : '16:00',

                        is_group: payload.is_group,
                        peopleCount: payload.peopleCount,
                    })

                    const newEventId = result?.id || result?.data?.[0]?.id

                    if (newEventId) {
                        const currentParticipants = [
                            ...new Set(userEvents.map((u) => u.user_id)),
                        ]

                        for (const participantId of currentParticipants) {
                            await joinEvent({
                                user_id: participantId,
                                event_id: newEventId,
                            })
                        }
                    }
                } else {
                    // Změna polí (Title, Poloha, Kapacita) pro celý vzor od začátku řady

                    await updateWeeklyEvent({
                        id: eventObj.id,
                        ...payload,
                        valid_from: eventObj.valid_from,
                        valid_until: eventObj.valid_until,
                    })

                    // Handle participants for pattern series (all instances)
                    if (editField === 'participants') {
                        console.log(
                            'Saving participants for all instances (pattern series):',
                            { eventId: eventObj.id, selectedParticipants }
                        )
                        // Remove all participants for the series (both with and without instance_date)
                        await supabase
                            .from('event_users')
                            .delete()
                            .eq('series_id', eventObj.id)
                        // Add selected participants for all instances (without instance_date)
                        if (selectedParticipants.length > 0) {
                            const participantsToInsert =
                                selectedParticipants.map((userId) => ({
                                    series_id: eventObj.id,
                                    user_id: userId,
                                }))
                            const { error: insertError } = await supabase
                                .from('event_users')
                                .insert(participantsToInsert)
                            console.log(
                                'Insert participants for all instances error:',
                                insertError
                            )
                        }
                    }

                    // Aktualizujeme výjimky (přepíšeme i existující hodnoty)
                    const { data: exceptions } = await supabase
                        .from('series_exceptions')
                        .select('*')
                        .eq('series_id', eventObj.id)
                    console.log(
                        'Updating exceptions for series:',
                        eventObj.id,
                        'found:',
                        exceptions?.length,
                        'exceptions'
                    )
                    console.log(
                        'Exceptions details:',
                        exceptions?.map((e) => ({
                            id: e.id,
                            puvodni_den: e.puvodni_den,
                            poloha: e.poloha,
                        }))
                    )
                    if (exceptions && exceptions.length > 0) {
                        // Zjistíme, jaké sloupce má tabulka
                        if (exceptions.length > 0) {
                            console.log(
                                'Available columns in series_exceptions:',
                                Object.keys(exceptions[0])
                            )
                        }
                        const updateData: any = {}
                        // Aktualizujeme pouze pole, která se liší od původních hodnot
                        if (
                            payload.title !== undefined &&
                            payload.title !== eventObj.title
                        )
                            updateData.title = payload.title
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

                        console.log('Update data for exceptions:', updateData)
                        // Aktualizujeme všechny výjimky pomocí SQL příkazu
                        for (const exc of exceptions) {
                            if (Object.keys(updateData).length > 0) {
                                console.log(
                                    'Updating exception:',
                                    exc.id,
                                    'puvodni_den:',
                                    exc.puvodni_den,
                                    'with:',
                                    updateData
                                )
                                // Zkusíme použít SQL příkaz přímo
                                const rpcParams: any = {
                                    p_id: exc.id,
                                    p_title: updateData.title,
                                    p_poloha: updateData.poloha,
                                    p_latitude: updateData.latitude,
                                    p_longitude: updateData.longitude,
                                    p_pocet_lidi: updateData.pocet_lidi,
                                    p_is_group:
                                        updateData.is_group !== undefined
                                            ? updateData.is_group
                                            : exc.is_group,
                                }
                                const { data: updatedExc, error } =
                                    await supabase.rpc(
                                        'update_series_exception',
                                        rpcParams
                                    )
                                console.log('RPC update response:', {
                                    error,
                                    data: updatedExc,
                                })
                                if (error) {
                                    console.error(
                                        'RPC error, trying direct update:',
                                        error
                                    )
                                    // Fallback na přímý update
                                    const {
                                        data: fallbackData,
                                        error: fallbackError,
                                    } = await supabase
                                        .from('series_exceptions')
                                        .update(updateData)
                                        .eq('id', exc.id)
                                        .select()
                                    console.log('Fallback update response:', {
                                        error: fallbackError,
                                        data: fallbackData,
                                    })
                                }
                                // Ověříme stav výjimky po update
                                const { data: verifyExc } = await supabase
                                    .from('series_exceptions')
                                    .select('*')
                                    .eq('id', exc.id)
                                console.log(
                                    'Verified exception after update:',
                                    verifyExc
                                )
                                console.log(
                                    'RPC returned row count:',
                                    updatedExc,
                                    '- should be 1 if update succeeded'
                                )
                            }
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

        // SYSTÉMOVÉ ZPRÁVY
        const changes: string[] = []
        if (payload.title !== undefined && payload.title !== eventObj.title)
            changes.push(`změnil(a) název na "${payload.title}"`)
        if (payload.poloha !== undefined && payload.poloha !== eventObj.poloha)
            changes.push(`změnil(a) polohu na "${payload.poloha}"`)
        if (
            payload.peopleCount !== undefined &&
            payload.peopleCount !== eventObj.pocet_lidi
        )
            changes.push(`změnil(a) kapacitu na ${payload.peopleCount} lidí`)

        const dateChanged =
            (editField === 'datetime' || editField === 'all') &&
            (finalStart !== origDates.s || finalEnd !== origDates.e)
        if (dateChanged) {
            changes.push(
                `změnil(a) datum a čas na ${dayjs(finalStart).format('D.M. HH:mm')} - ${dayjs(finalEnd).format('HH:mm')}`
            )
            if (finalIsGroup && user?.id) {
                const t = payload.title || eventObj.title
                const dStr =
                    !eventObj.pravidelnost || !editAllInstances
                        ? dayjs(origDates.s).format('YYYY-MM-DD')
                        : ''
                sendSystemMessage({
                    type: 'global',
                    message: `změnil(a) termín skupinové události "${t}" na ${dayjs(finalStart).format('D.M.YYYY HH:mm')}. [EVENT:${eventObj.id}:${dStr}:${t}]`,
                    user_id: user.id,
                }).catch(console.error)
            }
        }

        if (editField === 'participants') {
            const currentEventLinks = userEvents.filter((u) => String(u.event_id) === String(eventObj.id));
            const currentParticipantIds = Array.from(new Set(currentEventLinks.map((u) => u.user_id)));
            const removed = currentParticipantIds.filter(
                (id) => !selectedParticipants.includes(id)
            );
            const added = selectedParticipants.filter(
                (id) => !currentParticipantIds.includes(id)
            );
            if (removed.length > 0 || added.length > 0) {
                const getNames = (ids: number[]) => ids.map(id => users.find(u => String(u.id) === String(id))?.username || 'Neznámý').join(', ');
                let text = '';
                if (added.length > 0) {
                    text += `přidal(a): ${getNames(added)}`;
                }
                if (removed.length > 0) {
                    if (text) text += ' a ';
                    text += `odebral(a): ${getNames(removed)}`;
                }
                if (text) {
                    changes.push(text);
                }
            }
            if (removed.length > 0 && finalIsGroup && user?.id) {
                const t = payload.title || eventObj.title
                const dStr =
                    !eventObj.pravidelnost || !editAllInstances
                        ? dayjs(origDates.s).format('YYYY-MM-DD')
                        : ''
                sendSystemMessage({
                    type: 'global',
                    message: `Uvolnilo se místo ve skupinové události "${t}"! [EVENT:${eventObj.id}:${dStr}:${t}]`,
                    user_id: user.id,
                }).catch(console.error)
            }
        }

        if (
            changes.length > 0 &&
            user?.id &&
            (finalIsGroup || eventObj.is_group)
        ) {
            const instanceStr =
                eventObj.pravidelnost && !editAllInstances
                    ? dayjs(origDates.s).format('YYYY-MM-DD')
                    : undefined
            changes.forEach((ch) => {
                sendSystemMessage({
                    type: 'event',
                    message: ch,
                    user_id: user.id,
                    series_id: eventObj.id,
                    instance_date: instanceStr,
                }).catch(console.error)
            })
        }

        if (isChangingToGroup && user?.id) {
            const t = payload.title || eventObj.title
            const dStr =
                !eventObj.pravidelnost || !editAllInstances
                    ? dayjs(origDates.s).format('YYYY-MM-DD')
                    : ''
            sendSystemMessage({
                type: 'global',
                message: `změnil(a) soukromou událost "${t}" na skupinovou. [EVENT:${eventObj.id}:${dStr}:${t}]`,
                user_id: user.id,
            }).catch(console.error)
        }

        if (isChangingToPrivate && user?.id) {
            const t = payload.title || eventObj.title
            const dStr =
                !eventObj.pravidelnost || !editAllInstances
                    ? dayjs(origDates.s).format('YYYY-MM-DD')
                    : ''
            sendSystemMessage({
                type: 'global',
                message: `změnil(a) skupinovou událost "${t}" na soukromou. [EVENT:${eventObj.id}:${dStr}:${t}]`,
                user_id: user.id,
            }).catch(console.error)
        }
        // KONEC SYSTÉMOVÝCH ZPRÁV

        setModalVisible(false)

        router.back()
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
        const typ =
            eventObj.pravidelnost === 'Týdně' ? 'cancelled_weekly' : 'cancelled'
        await createException({
            event_id: eventObj.series_id || eventObj.id,
            start: eventObj.start,
            end: eventObj.end,
            typ: typ,
            puvodni_den: eventObj.start,
            puvodni_cas_od: eventObj.start,
            puvodni_cas_do: eventObj.end,
        })
        router.back()
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

    const updateSegmentDays = (id: string, val: string) => {
        setPatternSegments((prev) =>
            prev.map((s) =>
                s.id === id ? { ...s, days: parseInt(val) || 0 } : s
            )
        )
    }

    const removeSegment = (id: string) => {
        setPatternSegments((prev) => prev.filter((s) => s.id !== id))
    }

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
        if (!user) return
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
        }
    }

    const handleCancelEvent = async () => {
        if (!user) return
        try {
            const isRecurringOrMulti =
                !!eventObj.pravidelnost || !!eventObj.group_id
            const instanceDate = isRecurringOrMulti
                ? eventObj.instance_date || eventObj.den_od
                : undefined
            await cancelEvent({
                user_id: String(user.id),
                event_id: eventObj.series_id || eventObj.id,
                instance_date: instanceDate ? String(instanceDate) : undefined,
            })
            loadUserEvent()
        } catch (e) {
            console.error(e)
        }
    }

    const isRepeatingNonPattern =
        !eventObj.pravidelnost && relatedEvents.length > 1

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />

            <ThemedSafeView style={styles.container}>
                <ThemedView
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginBottom: 12,
                    }}
                >
                    <Pressable onPress={() => router.back()}>
                        <ArrowLeft size={30} color={buttonColor} />
                    </Pressable>
                    <ThemedText type="subtitle" style={{ marginLeft: 20 }}>
                        Detail události
                    </ThemedText>
                    {eventObj.user_id === user?.id && (
                        <IconButton
                            icon="trash-can"
                            iconColor="red"
                            size={24}
                            style={{ marginLeft: 'auto', margin: 0 }}
                            onPress={handleMainDeletePress}
                        />
                    )}
                </ThemedView>

                <ScrollView
                    contentContainerStyle={{ paddingBottom: 32 }}
                    keyboardShouldPersistTaps="handled"
                >
                    <ThemedView style={styles.field}>
                        <ThemedView
                            style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                            }}
                        >
                            <ThemedView style={{ flex: 1 }}>
                                <ThemedView style={{ flexDirection: 'row', alignItems: 'center', height: 24 }}>
                                    <ThemedText
                                        style={[
                                            styles.label,
                                            { color: secondaryTextColor, marginBottom: 0, lineHeight: 24 },
                                        ]}
                                    >
                                        Název události
                                    </ThemedText>

                                    {eventObj.user_id === user?.id && (
                                        <IconButton
                                            style={{ margin: 0, padding: 0, marginLeft: 0 }}
                                            icon="pencil"
                                            size={18}
                                            onPress={() => handleEditClick('title')}
                                        />
                                    )}
                                </ThemedView>

                                <ThemedView
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'flex-start',
                                        flexShrink: 1,
                                        marginTop: 0,
                                    }}
                                >
                                    <ThemedText
                                        style={{ fontSize: 18, flexShrink: 1 }}
                                    >
                                        {eventObj.title}
                                    </ThemedText>
                                </ThemedView>
                            </ThemedView>

                            <ThemedView style={{ marginLeft: 16 }}>
                                {(() => {
                                    const founder = users.find(
                                        (u) => u.id === eventObj.user_id
                                    )
                                    const colorObj = colors.find(
                                        (c) =>
                                            String(c.user_id) ===
                                            String(eventObj.user_id)
                                    )
                                    const dotColor =
                                        colorObj?.background_color || '#ccc'
                                    return founder ? (
                                        <ThemedView>
                                            <ThemedView style={{ height: 24, justifyContent: 'center' }}>
                                                <ThemedText
                                                    style={[
                                                        styles.label,
                                                        { color: secondaryTextColor, marginBottom: 0, lineHeight: 24 },
                                                    ]}
                                                >
                                                    Zakladatel
                                                </ThemedText>
                                            </ThemedView>
                                            <ThemedView
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    marginTop: 0,
                                                }}
                                            >
                                                <ThemedView
                                                    style={{
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: 4,
                                                        backgroundColor:
                                                            dotColor,
                                                        marginRight: 6,
                                                    }}
                                                />
                                                <ThemedText style={{ fontSize: 16 }}>
                                                    {founder.username}
                                                </ThemedText>
                                            </ThemedView>
                                        </ThemedView>
                                    ) : null
                                })()}
                            </ThemedView>
                        </ThemedView>
                    </ThemedView>


                    <ThemedView style={styles.field}>
                        <ThemedView style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }}>
                            <ThemedText
                                style={[
                                    styles.label,
                                    { color: secondaryTextColor, marginBottom: 0 },
                                ]}
                            >
                                Datum a čas
                            </ThemedText>
                            {eventObj.user_id === user?.id && (
                                <IconButton
                                    style={{ margin: 0, padding: 0, marginLeft: 0 }}
                                    icon="pencil"
                                    size={18}
                                    onPress={() => handleEditClick('datetime')}
                                />
                            )}
                        </ThemedView>

                        <ThemedView
                            style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                marginTop: 0,
                            }}
                        >
                            <ThemedText>
                                {dayjs(eventObj.start).isSame(
                                    eventObj.end,
                                    'day'
                                )
                                    ? `${formatDate(eventObj.start)} ${formatTime(eventObj.start)} - ${formatTime(eventObj.end)}`
                                    : `${formatDate(eventObj.start)} ${formatTime(eventObj.start)} - ${formatDate(eventObj.end)} ${formatTime(eventObj.end)}`}
                            </ThemedText>
                        </ThemedView>
                    </ThemedView>

                    {eventObj.is_group ? (
                        <ThemedView style={styles.field}>
                            <ThemedView
                                style={{
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                }}
                            >
                                <ThemedView
                                    style={{ flex: 1, marginRight: 16 }}
                                >
                                    <ThemedView style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }}>
                                        <ThemedText
                                            style={[
                                                styles.label,
                                                { color: secondaryTextColor, marginBottom: 0 },
                                            ]}
                                        >
                                            Účastníci
                                        </ThemedText>
                                        {eventObj.user_id === user?.id && (
                                            <IconButton
                                                style={{ margin: 0, padding: 0, marginLeft: 0 }}
                                                icon="pencil"
                                                size={18}
                                                onPress={() => handleEditClick('participants')}
                                            />
                                        )}
                                    </ThemedView>
                                    <ThemedView style={{ marginTop: 0 }}>
                                        {relevantUserEvents.length > 0 ? (
                                            <ThemedView
                                                style={{
                                                    flexDirection: 'row',
                                                    flexWrap: 'wrap',
                                                    alignItems: 'center',
                                                }}
                                            >
                                                {relevantUserEvents.map(
                                                    (ue, idx) => {
                                                        const participant =
                                                            users.find(
                                                                (u) =>
                                                                    u.id ===
                                                                    ue.user_id
                                                            )
                                                        const colorObj =
                                                            colors.find(
                                                                (c) =>
                                                                    String(
                                                                        c.user_id
                                                                    ) ===
                                                                    String(
                                                                        ue.user_id
                                                                    )
                                                            )
                                                        const dotColor =
                                                            colorObj?.background_color ||
                                                            '#ccc'
                                                        const name = participant
                                                            ? participant.username
                                                            : `User ${ue.user_id}`
                                                        return (
                                                            <ThemedView
                                                                key={ue.user_id}
                                                                style={{
                                                                    flexDirection:
                                                                        'row',
                                                                    alignItems:
                                                                        'center',
                                                                    marginRight: 8,
                                                                    marginVertical: 2,
                                                                }}
                                                            >
                                                                <View
                                                                    style={{
                                                                        width: 8,
                                                                        height: 8,
                                                                        borderRadius: 4,
                                                                        backgroundColor:
                                                                            dotColor,
                                                                        marginRight: 4,
                                                                    }}
                                                                />
                                                                <ThemedText>
                                                                    {name}
                                                                    {idx <
                                                                        relevantUserEvents.length -
                                                                        1
                                                                        ? ','
                                                                        : ''}
                                                                </ThemedText>
                                                            </ThemedView>
                                                        )
                                                    }
                                                )}
                                            </ThemedView>
                                        ) : (
                                            <ThemedText
                                                style={{
                                                    color: secondaryTextColor,
                                                }}
                                            >
                                                Žádní účastníci
                                            </ThemedText>
                                        )}
                                    </ThemedView>
                                </ThemedView>
                                <ThemedView>
                                    <ThemedView style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }}>
                                        <ThemedText
                                            style={[
                                                styles.label,
                                                { color: secondaryTextColor, marginBottom: 0 },
                                            ]}
                                        >
                                            Obsazenost
                                        </ThemedText>
                                        {eventObj.user_id === user?.id && (
                                            <IconButton
                                                style={{ margin: 0, padding: 0, marginLeft: 0 }}
                                                icon="pencil"
                                                size={18}
                                                onPress={() => handleEditClick('capacity')}
                                            />
                                        )}
                                    </ThemedView>
                                    <ThemedView
                                        style={{
                                            flexDirection: 'row',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginTop: 0,
                                        }}
                                    >
                                        <ThemedText>
                                            {count} / {eventObj.pocet_lidi}
                                        </ThemedText>
                                    </ThemedView>
                                </ThemedView>
                            </ThemedView>
                        </ThemedView>
                    ) : (
                        <ThemedView style={styles.field}>
                            <ThemedView style={{ flex: 1 }}>
                                <ThemedView style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }}>
                                    <ThemedText
                                        style={[
                                            styles.label,
                                            { color: secondaryTextColor, marginBottom: 0 },
                                        ]}
                                    >
                                        Obsazenost
                                    </ThemedText>
                                    {eventObj.user_id === user?.id && (
                                        <IconButton
                                            style={{ margin: 0, padding: 0, marginLeft: 0 }}
                                            icon="pencil"
                                            size={18}
                                            onPress={() => handleEditClick('capacity')}
                                        />
                                    )}
                                </ThemedView>
                                <ThemedView
                                    style={{
                                        flexDirection: 'row',
                                        justifyContent: 'space-between',
                                        marginTop: 0,
                                    }}
                                >
                                    <ThemedText>1 / 1</ThemedText>
                                </ThemedView>
                            </ThemedView>
                        </ThemedView>
                    )}

                    <ThemedView style={styles.field}>
                        <ThemedView style={{ flex: 1 }}>
                            <ThemedView style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }}>
                                <ThemedText
                                    style={[
                                        styles.label,
                                        { color: secondaryTextColor, marginBottom: 0 },
                                    ]}
                                >
                                    Poloha
                                </ThemedText>
                                {eventObj.user_id === user?.id && (
                                    <IconButton
                                        style={{ margin: 0, padding: 0, marginLeft: 0 }}
                                        icon="pencil"
                                        size={18}
                                        onPress={() => handleEditClick('location')}
                                    />
                                )}
                            </ThemedView>

                            <ThemedView style={{ marginTop: 0 }}>
                                <ThemedText>
                                    {eventObj.poloha || 'Není zadána'}
                                </ThemedText>
                            </ThemedView>
                        </ThemedView>
                    </ThemedView>

                    {eventObj.latitude && eventObj.longitude && (
                        <>
                            <ThemedView
                                style={{
                                    marginTop: 8,
                                    borderRadius: 12,
                                    overflow: 'hidden',
                                    borderWidth: 1,
                                    borderColor: borderColorTheme,
                                }}
                            >
                                <EventMap
                                    latitude={Number(eventObj.latitude)}
                                    longitude={Number(eventObj.longitude)}
                                    title={eventObj.title}
                                    description={eventObj.poloha}
                                />
                            </ThemedView>
                            <Button
                                icon="map-marker"
                                mode="text"
                                onPress={() =>
                                    Linking.openURL(
                                        `https://www.google.com/maps/search/?api=1&query=${eventObj.latitude},${eventObj.longitude}`
                                    )
                                }
                                style={{
                                    marginTop: 4,
                                    alignSelf: 'flex-start',
                                }}
                            >
                                Otevřít v Google Maps
                            </Button>
                        </>
                    )}

                    <View style={{ marginTop: 24, gap: 12 }}>
                        {eventObj.is_group &&
                            (userJoined ? (
                                <Button
                                    mode="contained"
                                    buttonColor="#f44336"
                                    textColor="#fff"
                                    onPress={handleCancelEvent}
                                    style={{
                                        borderRadius: 8,
                                        paddingVertical: 4,
                                    }}
                                >
                                    Zrušit účast
                                </Button>
                            ) : (
                                <Button
                                    mode="contained"
                                    buttonColor={buttonColor}
                                    textColor={buttonTextColor}
                                    onPress={handleJoinEvent}
                                    disabled={isFull}
                                    style={{
                                        borderRadius: 8,
                                        paddingVertical: 4,
                                    }}
                                >
                                    {isFull ? 'Plno' : 'Zúčastnit se'}
                                </Button>
                            ))}
                        <Button
                            mode="contained"
                            icon="chat"
                            onPress={() => {
                                const isRecurringOrMulti =
                                    !!eventObj.pravidelnost ||
                                    !!eventObj.group_id
                                const isInstance =
                                    isRecurringOrMulti &&
                                    (!!eventObj.instance_date ||
                                        !!eventObj.den_od)
                                router.push({
                                    pathname: '/events/[id]/chat',
                                    params: {
                                        id: eventObj.series_id || eventObj.id,
                                        event_title: eventObj.title,
                                        instance_date: isInstance
                                            ? String(
                                                eventObj.instance_date ||
                                                eventObj.den_od
                                            )
                                            : undefined,
                                    },
                                })
                            }}
                            buttonColor={buttonColor}
                            textColor={buttonTextColor}
                            style={{ borderRadius: 8, paddingVertical: 4 }}
                        >
                            Přejít do chatu události
                        </Button>
                    </View>
                </ScrollView>
            </ThemedSafeView>

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
                            Chcete provést tuto změnu pouze pro tuto konkrétní
                            instanci, nebo upravit celou budoucí sérii/cyklus?
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
                            onPress={() => handleScopeSelection(false)}
                        >
                            Pouze tuto jednu instanci
                        </Button>
                        <Button
                            mode="outlined"
                            style={{ borderColor: buttonColor }}
                            textColor={buttonColor}
                            onPress={() => handleScopeSelection(true)}
                        >
                            Všechny budoucí instance (Celá série)
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
                        <ScrollView
                            keyboardShouldPersistTaps="handled"
                            nestedScrollEnabled={true}
                            style={{ flexShrink: 1 }}
                        >
                            <ThemedText style={styles.modalTitle}>
                                {!eventObj.pravidelnost && !eventObj.group_id
                                    ? 'Úprava události'
                                    : editAllInstances
                                        ? 'Úprava celé řady / cyklus'
                                        : 'Úprava konkrétní instance'}
                            </ThemedText>

                            {editField === 'title' && (
                                <PaperTextInput
                                    label="Název"
                                    value={title}
                                    onChangeText={setTitle}
                                    mode="outlined"
                                    style={styles.field}
                                />
                            )}

                            {editField === 'location' && (
                                <ThemedView style={styles.field}>
                                    <PaperTextInput
                                        placeholder="Nová poloha..."
                                        value={poloha}
                                        onChangeText={(text) => {
                                            setPoloha(text)
                                            setLatitude(null)
                                            setLongitude(null)
                                        }}
                                        mode="outlined"
                                        right={
                                            isSearchingLocation ? (
                                                <TextInput.Icon
                                                    icon={() => (
                                                        <ActivityIndicator
                                                            size="small"
                                                            color={buttonColor}
                                                        />
                                                    )}
                                                />
                                            ) : (
                                                <TextInput.Icon icon="map-marker-outline" />
                                            )
                                        }
                                    />

                                    {locationResults.length > 0 && (
                                        <ScrollView
                                            style={{
                                                marginTop: 8,
                                                maxHeight: 200,
                                                borderWidth: 1,
                                                borderColor: borderColorTheme,
                                                borderRadius: 8,
                                            }}
                                        >
                                            {locationResults.map(
                                                (result, idx) => (
                                                    <Pressable
                                                        key={idx}
                                                        onPress={() => {
                                                            setPoloha(
                                                                result.display_name
                                                            )
                                                            setLatitude(
                                                                parseFloat(
                                                                    result.lat
                                                                )
                                                            )
                                                            setLongitude(
                                                                parseFloat(
                                                                    result.lon
                                                                )
                                                            )
                                                            setLocationResults(
                                                                []
                                                            )
                                                        }}
                                                        style={{
                                                            padding: 12,
                                                            borderBottomWidth:
                                                                idx <
                                                                    locationResults.length -
                                                                    1
                                                                    ? 1
                                                                    : 0,
                                                            borderBottomColor:
                                                                borderColorTheme,
                                                            backgroundColor:
                                                                modalBackgroundColor,
                                                        }}
                                                    >
                                                        <ThemedText
                                                            style={{
                                                                fontSize: 14,
                                                                color: secondaryTextColor,
                                                            }}
                                                        >
                                                            {
                                                                result.display_name
                                                            }
                                                        </ThemedText>
                                                    </Pressable>
                                                )
                                            )}
                                        </ScrollView>
                                    )}
                                </ThemedView>
                            )}

                            {editField === 'capacity' && (
                                <ThemedView style={styles.counterRow}>
                                    <IconButton
                                        icon="minus"
                                        mode="contained"
                                        onPress={decrease}
                                        iconColor={buttonTextColor}
                                        containerColor={buttonColor}
                                    />

                                    <PaperTextInput
                                        value={String(peopleCount)}
                                        mode="outlined"
                                        style={styles.counterInput}
                                        editable={false}
                                    />

                                    <IconButton
                                        icon="plus"
                                        mode="contained"
                                        onPress={increase}
                                        iconColor={buttonTextColor}
                                        containerColor={buttonColor}
                                    />
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
                                        Účastníci
                                    </ThemedText>

                                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 }}>
                                        <Button
                                            mode="text"
                                            compact
                                            onPress={() => {
                                                if (selectedParticipants.length > 1) {
                                                    setSelectedParticipants(user?.id ? [user.id] : []);
                                                } else {
                                                    const allIds = users.map(u => u.id);
                                                    const me = user?.id ? [user.id] : [];
                                                    const others = allIds.filter(id => id !== user?.id);
                                                    const toSelect = [...me, ...others].slice(0, peopleCount);
                                                    setSelectedParticipants(toSelect);
                                                }
                                            }}
                                        >
                                            {selectedParticipants.length > 1 ? 'Zrušit výběr' : 'Vybrat všechny'}
                                        </Button>
                                    </View>
                                    <ScrollView style={{ maxHeight: 300, paddingRight: 8 }} persistentScrollbar={true}>
                                        {editAllInstances &&
                                            (eventObj.pravidelnost ||
                                                eventObj.group_id) ? (
                                            <>
                                                <ThemedText
                                                    style={{ marginBottom: 8 }}
                                                >
                                                    Účastníci pro všechny instance:
                                                </ThemedText>

                                                {users.map((u) => {
                                                    const colorObj = colors.find(
                                                        (c) =>
                                                            String(c.user_id) ===
                                                            String(u.id)
                                                    )
                                                    const dotColor =
                                                        colorObj?.background_color ||
                                                        '#ccc'
                                                    return (
                                                        <View
                                                            key={u.id}
                                                            style={{
                                                                flexDirection:
                                                                    'row',
                                                                alignItems:
                                                                    'center',
                                                                justifyContent:
                                                                    'space-between',
                                                                paddingVertical: 4,
                                                                borderBottomWidth: 1,
                                                                borderBottomColor:
                                                                    borderColorTheme,
                                                            }}
                                                        >
                                                            <View
                                                                style={{
                                                                    flexDirection:
                                                                        'row',
                                                                    alignItems:
                                                                        'center',
                                                                }}
                                                            >
                                                                <View
                                                                    style={{
                                                                        width: 8,
                                                                        height: 8,
                                                                        borderRadius: 4,
                                                                        backgroundColor:
                                                                            dotColor,
                                                                        marginRight: 8,
                                                                    }}
                                                                />
                                                                <ThemedText>
                                                                    {u.username}
                                                                </ThemedText>
                                                            </View>
                                                            <IconButton
                                                                icon={
                                                                    selectedParticipants.includes(
                                                                        u.id
                                                                    )
                                                                        ? 'checkbox-marked'
                                                                        : 'checkbox-blank-outline'
                                                                }
                                                                size={20}
                                                                onPress={() => {
                                                                    if (
                                                                        selectedParticipants.includes(
                                                                            u.id
                                                                        )
                                                                    ) {
                                                                        setSelectedParticipants(
                                                                            (
                                                                                prev
                                                                            ) =>
                                                                                prev.filter(
                                                                                    (
                                                                                        id
                                                                                    ) =>
                                                                                        id !==
                                                                                        u.id
                                                                                )
                                                                        )
                                                                    } else {
                                                                        if (
                                                                            selectedParticipants.length <
                                                                            peopleCount
                                                                        ) {
                                                                            setSelectedParticipants(
                                                                                (
                                                                                    prev
                                                                                ) => [
                                                                                        ...prev,
                                                                                        u.id,
                                                                                    ]
                                                                            )
                                                                        }
                                                                    }
                                                                }}
                                                            />
                                                        </View>
                                                    )
                                                })}
                                            </>
                                        ) : (
                                            <>
                                                <ThemedText
                                                    style={{ marginBottom: 8 }}
                                                >
                                                    Účastníci pro tuto instanci:
                                                </ThemedText>

                                                {users.map((u) => {
                                                    const colorObj = colors.find(
                                                        (c) =>
                                                            String(c.user_id) ===
                                                            String(u.id)
                                                    )
                                                    const dotColor =
                                                        colorObj?.background_color ||
                                                        '#ccc'
                                                    return (
                                                        <View
                                                            key={u.id}
                                                            style={{
                                                                flexDirection:
                                                                    'row',
                                                                alignItems:
                                                                    'center',
                                                                justifyContent:
                                                                    'space-between',
                                                                paddingVertical: 4,
                                                                borderBottomWidth: 1,
                                                                borderBottomColor:
                                                                    borderColorTheme,
                                                            }}
                                                        >
                                                            <View
                                                                style={{
                                                                    flexDirection:
                                                                        'row',
                                                                    alignItems:
                                                                        'center',
                                                                }}
                                                            >
                                                                <View
                                                                    style={{
                                                                        width: 8,
                                                                        height: 8,
                                                                        borderRadius: 4,
                                                                        backgroundColor:
                                                                            dotColor,
                                                                        marginRight: 8,
                                                                    }}
                                                                />
                                                                <ThemedText>
                                                                    {u.username}
                                                                </ThemedText>
                                                            </View>
                                                            <IconButton
                                                                icon={
                                                                    selectedParticipants.includes(
                                                                        u.id
                                                                    )
                                                                        ? 'checkbox-marked'
                                                                        : 'checkbox-blank-outline'
                                                                }
                                                                size={20}
                                                                onPress={() => {
                                                                    if (
                                                                        selectedParticipants.includes(
                                                                            u.id
                                                                        )
                                                                    ) {
                                                                        setSelectedParticipants(
                                                                            (
                                                                                prev
                                                                            ) =>
                                                                                prev.filter(
                                                                                    (
                                                                                        id
                                                                                    ) =>
                                                                                        id !==
                                                                                        u.id
                                                                                )
                                                                        )
                                                                    } else {
                                                                        if (
                                                                            selectedParticipants.length <
                                                                            peopleCount
                                                                        ) {
                                                                            setSelectedParticipants(
                                                                                (
                                                                                    prev
                                                                                ) => [
                                                                                        ...prev,
                                                                                        u.id,
                                                                                    ]
                                                                            )
                                                                        }
                                                                    }
                                                                }}
                                                            />
                                                        </View>
                                                    )
                                                })}
                                            </>
                                        )}
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
                                                    ? 'Nastavit výjimku pro tento den:'
                                                    : 'Datum události:'}
                                            </ThemedText>

                                            <Pressable
                                                onPress={() =>
                                                    setDateModalVisible(true)
                                                }
                                            >
                                                <PaperTextInput
                                                    value={
                                                        dateRange.startDate &&
                                                            dateRange.endDate &&
                                                            dateRange.startDate.getTime() !==
                                                            dateRange.endDate.getTime()
                                                            ? `${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}`
                                                            : dateRange.startDate
                                                                ? formatDate(
                                                                    dateRange.startDate
                                                                )
                                                                : ''
                                                    }
                                                    label={
                                                        eventObj.pravidelnost ||
                                                            eventObj.group_id
                                                            ? 'Datum výjimky'
                                                            : 'Datum'
                                                    }
                                                    mode="outlined"
                                                    editable={false}
                                                />
                                            </Pressable>

                                            <View
                                                style={{
                                                    flexDirection: 'row',
                                                    gap: 8,
                                                    marginTop: 8,
                                                }}
                                            >
                                                <Pressable
                                                    style={{ flex: 1 }}
                                                    onPress={() => {
                                                        setTimeContext('once')
                                                        setTimeStep('start')
                                                        setTimeModalVisible(
                                                            true
                                                        )
                                                    }}
                                                >
                                                    <PaperTextInput
                                                        value={formatTime(
                                                            timeRange.start
                                                        )}
                                                        label="Od"
                                                        mode="outlined"
                                                        editable={false}
                                                    />
                                                </Pressable>

                                                <Pressable
                                                    style={{ flex: 1 }}
                                                    onPress={() => {
                                                        setTimeContext('once')
                                                        setTimeStep('end')
                                                        setTimeModalVisible(
                                                            true
                                                        )
                                                    }}
                                                >
                                                    <PaperTextInput
                                                        value={formatTime(
                                                            timeRange.end
                                                        )}
                                                        label="Do"
                                                        mode="outlined"
                                                        editable={false}
                                                    />
                                                </Pressable>
                                            </View>
                                        </ThemedView>
                                    ) : (
                                        <>
                                            {eventObj.pravidelnost ? (
                                                <ThemedView
                                                    style={styles.field}
                                                >
                                                    <ThemedText
                                                        style={[
                                                            styles.label,
                                                            {
                                                                color: secondaryTextColor,
                                                            },
                                                        ]}
                                                    >
                                                        Nový vzor začne platit
                                                        od data:
                                                    </ThemedText>

                                                    <Pressable
                                                        onPress={() =>
                                                            setDateModalVisible(
                                                                true
                                                            )
                                                        }
                                                    >
                                                        <PaperTextInput
                                                            value={formatDate(
                                                                dateRange.startDate
                                                            )}
                                                            label="Datum účinnosti nového cyklu"
                                                            mode="outlined"
                                                            editable={false}
                                                            right={
                                                                <TextInput.Icon
                                                                    icon="calendar-outline"
                                                                    onPress={() =>
                                                                        setDateModalVisible(
                                                                            true
                                                                        )
                                                                    }
                                                                />
                                                            }
                                                            style={{
                                                                backgroundColor:
                                                                    'transparent',
                                                            }}
                                                        />
                                                    </Pressable>

                                                    <ThemedText
                                                        style={[
                                                            styles.label,
                                                            {
                                                                color: secondaryTextColor,
                                                                marginTop: 12,
                                                            },
                                                        ]}
                                                    >
                                                        Opakovat do (nepovinné):
                                                    </ThemedText>

                                                    <Pressable
                                                        onPress={() =>
                                                            setEndDateModalVisible(
                                                                true
                                                            )
                                                        }
                                                    >
                                                        <PaperTextInput
                                                            value={
                                                                validUntilDate
                                                                    ? formatDate(
                                                                        validUntilDate
                                                                    )
                                                                    : 'Bez omezení (opakovat navždy)'
                                                            }
                                                            mode="outlined"
                                                            editable={false}
                                                            style={{
                                                                backgroundColor:
                                                                    'transparent',
                                                            }}
                                                            right={
                                                                validUntilDate ? (
                                                                    <TextInput.Icon
                                                                        icon="close"
                                                                        onPress={() =>
                                                                            setValidUntilDate(
                                                                                undefined
                                                                            )
                                                                        }
                                                                    />
                                                                ) : (
                                                                    <TextInput.Icon
                                                                        icon="calendar-outline"
                                                                        onPress={() =>
                                                                            setEndDateModalVisible(
                                                                                true
                                                                            )
                                                                        }
                                                                    />
                                                                )
                                                            }
                                                        />
                                                    </Pressable>

                                                    <ThemedText
                                                        style={[
                                                            styles.label,
                                                            {
                                                                color: secondaryTextColor,
                                                                marginTop: 16,
                                                                marginBottom: 8,
                                                            },
                                                        ]}
                                                    >
                                                        Sestavení cyklu:
                                                    </ThemedText>

                                                    <View style={{ gap: 10 }}>
                                                        {patternSegments.map(
                                                            (segment, idx) => (
                                                                <View
                                                                    key={
                                                                        segment.id
                                                                    }
                                                                    style={{
                                                                        backgroundColor:
                                                                            cardBackgroundColor,
                                                                        padding: 12,
                                                                        borderRadius: 8,
                                                                        borderWidth: 1,
                                                                        borderColor:
                                                                            borderColorTheme,
                                                                    }}
                                                                >
                                                                    <View
                                                                        style={{
                                                                            flexDirection:
                                                                                'row',
                                                                            justifyContent:
                                                                                'space-between',
                                                                            alignItems:
                                                                                'center',
                                                                        }}
                                                                    >
                                                                        <ThemedText
                                                                            style={{
                                                                                fontWeight:
                                                                                    '600',
                                                                                color:
                                                                                    segment.type ===
                                                                                        'work'
                                                                                        ? '#4CAF50'
                                                                                        : '#FF9800',
                                                                            }}
                                                                        >
                                                                            {segment.type ===
                                                                                'work'
                                                                                ? `${idx + 1}. Práce`
                                                                                : `${idx + 1}. Pauza`}
                                                                        </ThemedText>

                                                                        <View
                                                                            style={{
                                                                                flexDirection:
                                                                                    'row',
                                                                                alignItems:
                                                                                    'center',
                                                                                gap: 6,
                                                                            }}
                                                                        >
                                                                            <ThemedText>
                                                                                Dní:
                                                                            </ThemedText>

                                                                            <PaperTextInput
                                                                                value={String(
                                                                                    segment.days
                                                                                )}
                                                                                keyboardType="numeric"
                                                                                onChangeText={(
                                                                                    v
                                                                                ) =>
                                                                                    updateSegmentDays(
                                                                                        segment.id,
                                                                                        v
                                                                                    )
                                                                                }
                                                                                mode="outlined"
                                                                                style={{
                                                                                    width: 45,
                                                                                    height: 30,
                                                                                    textAlign:
                                                                                        'center',
                                                                                    backgroundColor:
                                                                                        'transparent',
                                                                                }}
                                                                            />

                                                                            <IconButton
                                                                                icon="close"
                                                                                size={
                                                                                    16
                                                                                }
                                                                                iconColor="red"
                                                                                onPress={() =>
                                                                                    removeSegment(
                                                                                        segment.id
                                                                                    )
                                                                                }
                                                                            />
                                                                        </View>
                                                                    </View>

                                                                    {segment.type ===
                                                                        'work' && (
                                                                            <View
                                                                                style={{
                                                                                    flexDirection:
                                                                                        'row',
                                                                                    gap: 8,
                                                                                    marginTop: 8,
                                                                                }}
                                                                            >
                                                                                <Pressable
                                                                                    style={{
                                                                                        flex: 1,
                                                                                    }}
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
                                                                                    <PaperTextInput
                                                                                        value={formatTime(
                                                                                            segment.startTime
                                                                                        )}
                                                                                        label="Od"
                                                                                        mode="outlined"
                                                                                        editable={
                                                                                            false
                                                                                        }
                                                                                        style={{
                                                                                            height: 35,
                                                                                            backgroundColor:
                                                                                                'transparent',
                                                                                        }}
                                                                                    />
                                                                                </Pressable>

                                                                                <Pressable
                                                                                    style={{
                                                                                        flex: 1,
                                                                                    }}
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
                                                                                    <PaperTextInput
                                                                                        value={formatTime(
                                                                                            segment.endTime
                                                                                        )}
                                                                                        label="Do"
                                                                                        mode="outlined"
                                                                                        editable={
                                                                                            false
                                                                                        }
                                                                                        style={{
                                                                                            height: 35,
                                                                                            backgroundColor:
                                                                                                'transparent',
                                                                                        }}
                                                                                    />
                                                                                </Pressable>
                                                                            </View>
                                                                        )}
                                                                </View>
                                                            )
                                                        )}
                                                    </View>

                                                    <View
                                                        style={{
                                                            flexDirection:
                                                                'row',
                                                            gap: 8,
                                                            marginTop: 12,
                                                        }}
                                                    >
                                                        <Button
                                                            mode="outlined"
                                                            icon="briefcase-plus"
                                                            compact
                                                            onPress={() =>
                                                                addSegment(
                                                                    'work'
                                                                )
                                                            }
                                                            style={{
                                                                flex: 1,
                                                                borderColor:
                                                                    buttonColor,
                                                            }}
                                                            textColor={
                                                                buttonColor
                                                            }
                                                        >
                                                            + Práci
                                                        </Button>

                                                        <Button
                                                            mode="outlined"
                                                            icon="beach"
                                                            compact
                                                            onPress={() =>
                                                                addSegment(
                                                                    'off'
                                                                )
                                                            }
                                                            style={{
                                                                flex: 1,
                                                                borderColor:
                                                                    buttonColor,
                                                            }}
                                                            textColor={
                                                                buttonColor
                                                            }
                                                        >
                                                            + Pauzu
                                                        </Button>
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
                                                                        padding: 12,
                                                                        backgroundColor:
                                                                            cardBackgroundColor,
                                                                        borderRadius: 8,
                                                                    }}
                                                                >
                                                                    <Pressable
                                                                        onPress={() => {
                                                                            setDateModalVisible(
                                                                                true
                                                                            )
                                                                        }}
                                                                    >
                                                                        <PaperTextInput
                                                                            value={formatDate(
                                                                                multiDateInstances[
                                                                                    editingMultiDateIndex
                                                                                ]
                                                                                    ?.date
                                                                            )}
                                                                            label="Datum"
                                                                            mode="outlined"
                                                                            editable={
                                                                                false
                                                                            }
                                                                        />
                                                                    </Pressable>
                                                                    <View
                                                                        style={{
                                                                            flexDirection:
                                                                                'row',
                                                                            gap: 8,
                                                                            marginTop: 8,
                                                                        }}
                                                                    >
                                                                        <Pressable
                                                                            style={{
                                                                                flex: 1,
                                                                            }}
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
                                                                        >
                                                                            <PaperTextInput
                                                                                value={formatTime(
                                                                                    multiDateInstances[
                                                                                        editingMultiDateIndex
                                                                                    ]
                                                                                        ?.startTime
                                                                                )}
                                                                                label="Od"
                                                                                mode="outlined"
                                                                                editable={
                                                                                    false
                                                                                }
                                                                            />
                                                                        </Pressable>
                                                                        <Pressable
                                                                            style={{
                                                                                flex: 1,
                                                                            }}
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
                                                                        >
                                                                            <PaperTextInput
                                                                                value={formatTime(
                                                                                    multiDateInstances[
                                                                                        editingMultiDateIndex
                                                                                    ]
                                                                                        ?.endTime
                                                                                )}
                                                                                label="Do"
                                                                                mode="outlined"
                                                                                editable={
                                                                                    false
                                                                                }
                                                                            />
                                                                        </Pressable>
                                                                    </View>
                                                                    <Button
                                                                        mode="contained"
                                                                        onPress={() => {
                                                                            setEditingMultiDateIndex(
                                                                                null
                                                                            )
                                                                        }}
                                                                        style={{
                                                                            marginTop: 12,
                                                                        }}
                                                                    >
                                                                        Uložit
                                                                    </Button>
                                                                    <Button
                                                                        mode="text"
                                                                        onPress={() =>
                                                                            setEditingMultiDateIndex(
                                                                                null
                                                                            )
                                                                        }
                                                                    >
                                                                        Zrušit
                                                                    </Button>
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
                                                                                style={{
                                                                                    flexDirection:
                                                                                        'row',
                                                                                    alignItems:
                                                                                        'center',
                                                                                    justifyContent:
                                                                                        'space-between',
                                                                                    paddingVertical: 6,
                                                                                    borderBottomWidth: 1,
                                                                                    borderBottomColor:
                                                                                        borderColorTheme,
                                                                                }}
                                                                            >
                                                                                <ThemedText>
                                                                                    {formatDate(
                                                                                        instance.date
                                                                                    )}{' '}
                                                                                    {formatTime(
                                                                                        instance.startTime
                                                                                    )}{' '}
                                                                                    -{' '}
                                                                                    {formatTime(
                                                                                        instance.endTime
                                                                                    )}
                                                                                </ThemedText>
                                                                                <View
                                                                                    style={{
                                                                                        flexDirection:
                                                                                            'row',
                                                                                    }}
                                                                                >
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
                                                                                        iconColor="red"
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
                                                                            </View>
                                                                        )
                                                                    )}
                                                                    <Button
                                                                        mode="outlined"
                                                                        icon="plus"
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
                                                                        style={{
                                                                            marginTop: 12,
                                                                            borderColor:
                                                                                buttonColor,
                                                                        }}
                                                                        textColor={
                                                                            buttonColor
                                                                        }
                                                                    >
                                                                        Přidat
                                                                        nový den
                                                                    </Button>
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
                                                                        padding: 12,
                                                                        backgroundColor:
                                                                            cardBackgroundColor,
                                                                        borderRadius: 8,
                                                                    }}
                                                                >
                                                                    <Pressable
                                                                        onPress={() =>
                                                                            setDateModalVisible(
                                                                                true
                                                                            )
                                                                        }
                                                                    >
                                                                        <PaperTextInput
                                                                            value={getFormattedDateRange()}
                                                                            label="Datum"
                                                                            mode="outlined"
                                                                            editable={
                                                                                false
                                                                            }
                                                                        />
                                                                    </Pressable>

                                                                    <View
                                                                        style={{
                                                                            flexDirection:
                                                                                'row',
                                                                            gap: 8,
                                                                            marginTop: 8,
                                                                        }}
                                                                    >
                                                                        <Pressable
                                                                            style={{
                                                                                flex: 1,
                                                                            }}
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
                                                                        >
                                                                            <PaperTextInput
                                                                                value={formatTime(
                                                                                    timeRange.start
                                                                                )}
                                                                                label="Od"
                                                                                mode="outlined"
                                                                                editable={
                                                                                    false
                                                                                }
                                                                            />
                                                                        </Pressable>

                                                                        <Pressable
                                                                            style={{
                                                                                flex: 1,
                                                                            }}
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
                                                                        >
                                                                            <PaperTextInput
                                                                                value={formatTime(
                                                                                    timeRange.end
                                                                                )}
                                                                                label="Do"
                                                                                mode="outlined"
                                                                                editable={
                                                                                    false
                                                                                }
                                                                            />
                                                                        </Pressable>
                                                                    </View>

                                                                    <Button
                                                                        mode="contained"
                                                                        onPress={
                                                                            handleSaveSpecificRelatedEvent
                                                                        }
                                                                        style={{
                                                                            marginTop: 12,
                                                                        }}
                                                                    >
                                                                        Uložit
                                                                        čas
                                                                    </Button>

                                                                    <Button
                                                                        mode="text"
                                                                        onPress={() =>
                                                                            setEditingRelatedEvent(
                                                                                null
                                                                            )
                                                                        }
                                                                    >
                                                                        Zpět na
                                                                        seznam
                                                                    </Button>
                                                                </ThemedView>
                                                            ) : (
                                                                (multiDateInstances.length > 0 ? multiDateInstances : relatedEvents).map(
                                                                    (ev: any) => (
                                                                        <View
                                                                            key={
                                                                                ev.id
                                                                            }
                                                                            style={{
                                                                                flexDirection:
                                                                                    'row',
                                                                                alignItems:
                                                                                    'center',
                                                                                justifyContent:
                                                                                    'space-between',
                                                                                paddingVertical: 6,
                                                                                borderBottomWidth: 1,
                                                                                borderBottomColor:
                                                                                    borderColorTheme,
                                                                            }}
                                                                        >
                                                                            <ThemedText>
                                                                                {formatDate(
                                                                                    ev.startTime || ev.start
                                                                                )}{' '}
                                                                                {formatTime(
                                                                                    ev.startTime || ev.start
                                                                                )}{' '}
                                                                                -{' '}
                                                                                {formatTime(
                                                                                    ev.endTime || ev.end
                                                                                )}
                                                                            </ThemedText>

                                                                            <View
                                                                                style={{
                                                                                    flexDirection:
                                                                                        'row',
                                                                                }}
                                                                            >
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
                                                                                    iconColor="red"
                                                                                    onPress={() =>
                                                                                        handleDeleteRelatedEvent(
                                                                                            ev.id
                                                                                        )
                                                                                    }
                                                                                />
                                                                            </View>
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
                                <View style={{ marginTop: 16 }}>
                                    <Button
                                        mode="contained"
                                        onPress={handleSave}
                                        style={{ paddingVertical: 4 }}
                                    >
                                        Uložit změny
                                    </Button>
                                    <Button
                                        mode="text"
                                        onPress={() => setModalVisible(false)}
                                        style={{ marginTop: 4 }}
                                    >
                                        Zavřít
                                    </Button>
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
    container: { flex: 1, padding: 16, paddingTop: 0 },

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

    counterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },

    counterInput: {
        textAlign: 'center',
        width: 60,
        backgroundColor: 'transparent',
    },
})
