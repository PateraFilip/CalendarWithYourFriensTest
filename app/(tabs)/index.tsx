import SegmentedControl from '@react-native-segmented-control/segmented-control'
import dayjs from 'dayjs'
import 'dayjs/locale/cs'
import React, { useEffect, useState } from 'react'
import { Dimensions, StyleSheet } from 'react-native'

import { CellModal } from '@/components/CellModal'
import DayCalendar from '@/components/CustomDay/CustomDay'
import MonthCalendar from '@/components/CustomMonth/CustomMonth'
import WeekCalendar from '@/components/CustomWeek/CustomWeek'
import { EventModal } from '@/components/EventModal'
import { ThemedSafeView } from '@/components/ThemedSafeView'
import { useRouter } from 'expo-router'

dayjs.locale('cs')

export default function SharedCalendar() {
  const SCREEN_HEIGHT = Dimensions.get('window').height
  const router = useRouter()

  const [events, setEvents] = useState([
    {
      title: 'Událost B',
      start: new Date(2025, 9, 13, 10, 0),
      end: new Date(2025, 9, 13, 11, 0),
      user_id: 1,
    },
    {
      title: 'Událost A',
      start: new Date(2025, 9, 13, 10, 30),
      end: new Date(2025, 9, 13, 12, 0),
      user_id: 2,
    },
  ])

  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [cellModalVisible, setCellModalVisible] = useState(false)
  const [eventModalVisible, setEventModalVisible] = useState(false)
  const [navigateAfterClose, setNavigateAfterClose] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(1)
  const [newEventTitle, setNewEventTitle] = useState('')
  const [newEventPeopleCount, setNewEventPeopleCount] = useState(1)

  const handlePressDay = (date: Date) => {
    setSelectedDate(date)
    setSelectedIndex(0)
  }

  const handleCellPress = (date: Date) => {
    setSelectedDate(date)
    setCellModalVisible(true)
  }

  const addEvent = (title: string, peopleCount: number) => {
    if (!title || !selectedDate) return

    setEvents(prev => [
      ...prev,
      {
        title,
        start: selectedDate,
        end: new Date(selectedDate.getTime() + 60 * 60 * 1000),
        user_id: 1,
      },
    ])
    setNewEventTitle('')
    setNewEventPeopleCount(1)
    setEventModalVisible(false)
  }

  const selectCalendar = () => {
    if (selectedIndex === 1) {
      return (
        <WeekCalendar
          events={events}
          onPressCell={handleCellPress}
          onPressDay={handlePressDay}
          hourHeight={(SCREEN_HEIGHT - 170) / 7}
        />
      )
    } else if (selectedIndex === 0) {
      return (
        <DayCalendar
          events={events}
          defaultDate={selectedDate ?? new Date()}
          onPressCell={handleCellPress}
          hourHeight={100}
        />
      )
    } else {
      return (
        <MonthCalendar
          events={events}
          defaultDate={selectedDate ?? new Date()}
          onPressDay={handlePressDay}
        />
      )
    }
  }

  // useEffect sleduje zavření modalu a spustí navigaci
  useEffect(() => {
    if (!cellModalVisible && navigateAfterClose) {
      router.replace('/newEvent')
    }
  }, [cellModalVisible, navigateAfterClose])

  return (
    <ThemedSafeView style={styles.container}>
      <SegmentedControl
        values={['Den', 'Týden', 'Měsíc']}
        selectedIndex={selectedIndex}
        onChange={event =>
          setSelectedIndex(event.nativeEvent.selectedSegmentIndex)
        }
      />

      {selectCalendar()}

      <CellModal
        visible={cellModalVisible}
        date={selectedDate}
        events={events}
        onCreateEvent={() => {
          setNavigateAfterClose(true) // flag pro navigaci po zavření
          setCellModalVisible(false)   // zavření modalu
        }}
      />

      <EventModal
        visible={eventModalVisible}
        onDismiss={() => setEventModalVisible(false)}
        onCreate={addEvent}
      />
    </ThemedSafeView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
