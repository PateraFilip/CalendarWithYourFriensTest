import { ThemedText } from '@/components/themed-text'
import { Brand } from '@/constants/brand'
import { useAppData } from '@/contexts/AppDataContext'
import { useThemeColor } from '@/hooks/use-theme-color'
import { useAuth } from '@/hooks/useAuth'
import { dedupeCalendarEvents, eventInstanceKey } from '@/lib/calendarEvents'
import { getEventParticipants } from '@/lib/eventParticipants'
import { formatShortLocation } from '@/lib/formatLocation'
import { UserEvent } from '@/services/events/getUserEvents'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import dayjs from 'dayjs'
import 'dayjs/locale/cs'
import React from 'react'
import { FlatList, Pressable, StyleSheet, View } from 'react-native'
import { Modal, Portal } from 'react-native-paper'
import { ThemedView } from './themed-view'

dayjs.locale('cs')

type CellEvent = {
  id: number
  title: string
  start: Date
  end: Date
  user_id: number
  pocet_lidi: number
  pravidelnost: boolean
  is_group: boolean
  original_start?: Date
  original_end?: Date
  poloha?: string
  instance_date?: string
}

interface CellModalProps {
  visible: boolean
  date: Date | null
  events: CellEvent[]
  weeklyEvents?: unknown[]
  onCreateEvent: () => void
  onDismiss: () => void
  onPressEvent?: (event: CellEvent) => void
  colors: {
    id: number
    name: string
    background_color: string
    text_color: string
    user_id: number
  }[]
  users: {
    id: number
    username: string
    jmeno: string
    prijmeni: string
    email: string
    datum_narozeni: string
  }[]
  eventsException?: unknown
}

export const CellModal: React.FC<CellModalProps> = ({
  visible,
  date,
  events,
  weeklyEvents,
  colors,
  users,
  onCreateEvent,
  onDismiss,
  onPressEvent,
}) => {
  void weeklyEvents
  const { user } = useAuth()
  const { userEvents: appUserEvents } = useAppData()

  const textColor = useThemeColor({}, 'text')
  const secondary = useThemeColor(
    { light: '#5f6368', dark: '#9aa0a6' },
    'text'
  )
  const borderColor = useThemeColor(
    { light: '#dadce0', dark: '#3c4043' },
    'background'
  )
  const rowHover = useThemeColor(
    { light: 'rgba(60,64,67,0.04)', dark: 'rgba(255,255,255,0.04)' },
    'background'
  )

  const userEvents = (appUserEvents as UserEvent[] | undefined) || []

  if (!date) return null

  const hourStart = dayjs(date).startOf('hour')
  const hourEnd = hourStart.add(1, 'hour')
  const hourEvents = dedupeCalendarEvents(
    events.filter(
      (e) =>
        dayjs(e.start).isBefore(hourEnd) && dayjs(e.end).isAfter(hourStart)
    )
  ) as CellEvent[]

  const headerTitle = `${hourStart
    .format('ddd D. M.')
    .replace(/\.$/, '')
    .replace(/^./, (c) => c.toUpperCase())} · ${hourStart.format('H:mm')}`

  const countLabel =
    hourEvents.length === 0
      ? 'Žádné události'
      : hourEvents.length === 1
        ? '1 událost'
        : hourEvents.length < 5
          ? `${hourEvents.length} události`
          : `${hourEvents.length} událostí`

  const formatTimeRange = (item: CellEvent) => {
    const startDate = item.original_start || item.start
    const endDate = item.original_end || item.end
    const sameDay = dayjs(startDate).isSame(endDate, 'day')
    if (sameDay) {
      return `${dayjs(startDate).format('H:mm')} – ${dayjs(endDate).format('H:mm')}`
    }
    return `${dayjs(startDate).format('D.M. H:mm')} – ${dayjs(endDate).format('D.M. H:mm')}`
  }

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContainer}
      >
        <ThemedView style={styles.content}>
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <ThemedText style={[styles.headerTitle, { color: textColor }]}>
                {headerTitle}
              </ThemedText>
              <ThemedText style={[styles.headerCount, { color: secondary }]}>
                {countLabel}
              </ThemedText>
            </View>
            <Pressable
              onPress={onCreateEvent}
              style={({ pressed }) => [
                styles.addBtn,
                {
                  backgroundColor: Brand.primarySoft,
                  borderColor: Brand.primary,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              accessibilityLabel="Vytvořit událost"
            >
              <MaterialCommunityIcons name="plus" size={22} color={Brand.primary} />
            </Pressable>
          </View>

          {hourEvents.length > 0 ? (
            <FlatList
              data={hourEvents}
              keyExtractor={(item) => eventInstanceKey(item)}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => (
                <View style={[styles.separator, { backgroundColor: borderColor }]} />
              )}
              renderItem={({ item }) => {
                const colorObj = colors.find(
                  (c) => c != null && String(c.user_id) === String(item.user_id)
                )
                const barColor = item.is_group
                  ? Brand.groupEvent
                  : colorObj?.background_color || Brand.primary

                const owner = users.find(
                  (u) => u != null && String(u.id) === String(item.user_id)
                )
                const ownerName =
                  owner?.username || owner?.jmeno || 'Neznámý'

                let meta = ''
                if (item.is_group) {
                  const participants = getEventParticipants(userEvents, item)
                  const names = participants
                    .map((ue) => {
                      const p = users.find(
                        (u) =>
                          u != null && String(u.id) === String(ue.user_id)
                      )
                      return p?.username || p?.jmeno || null
                    })
                    .filter(Boolean) as string[]
                  const capacity = `${participants.length}/${item.pocet_lidi}`
                  meta = names.length
                    ? `${names.join(' · ')} · ${capacity}`
                    : `Žádní účastníci · ${capacity}`
                } else if (String(item.user_id) !== String(user?.id)) {
                  meta = ownerName
                }
                if (item.poloha) {
                  const short = formatShortLocation(item.poloha)
                  if (short) {
                    meta = meta ? `${meta} · ${short}` : short
                  }
                }

                return (
                  <Pressable
                    onPress={() => onPressEvent?.(item)}
                    style={({ pressed }) => [
                      styles.eventRow,
                      pressed && { backgroundColor: rowHover },
                    ]}
                  >
                    <View
                      style={[styles.colorBar, { backgroundColor: barColor }]}
                    />
                    <View style={styles.eventBody}>
                      <ThemedText
                        style={[styles.eventTime, { color: secondary }]}
                        numberOfLines={1}
                      >
                        {formatTimeRange(item)}
                      </ThemedText>
                      <ThemedText
                        style={[styles.eventTitle, { color: textColor }]}
                        numberOfLines={2}
                      >
                        {item.title}
                      </ThemedText>
                      {!!meta && (
                        <ThemedText
                          style={[styles.eventMeta, { color: secondary }]}
                          numberOfLines={1}
                        >
                          {meta}
                        </ThemedText>
                      )}
                    </View>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={20}
                      color={secondary}
                      style={styles.chevron}
                    />
                  </Pressable>
                )
              }}
            />
          ) : (
            <ThemedText style={[styles.empty, { color: secondary }]}>
              Žádné události v tuto hodinu. Klepni na + a něco vytvoř.
            </ThemedText>
          )}
        </ThemedView>
      </Modal>
    </Portal>
  )
}

const styles = StyleSheet.create({
  modalContainer: {
    marginHorizontal: 16,
    marginVertical: 24,
  },
  content: {
    borderRadius: 16,
    paddingTop: 16,
    paddingBottom: 8,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerCount: {
    fontSize: 13,
    fontWeight: '500',
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    maxHeight: 420,
  },
  listContent: {
    paddingBottom: 8,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 30,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  colorBar: {
    width: 4,
    borderRadius: 2,
    marginRight: 12,
    alignSelf: 'stretch',
    minHeight: 40,
  },
  eventBody: {
    flex: 1,
    justifyContent: 'center',
    gap: 1,
  },
  eventTime: {
    fontSize: 12,
    fontWeight: '500',
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  eventMeta: {
    fontSize: 12,
    marginTop: 1,
  },
  chevron: {
    alignSelf: 'center',
    marginLeft: 4,
  },
  empty: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    fontSize: 14,
    lineHeight: 20,
  },
})
