import SegmentedControl from '@react-native-segmented-control/segmented-control'
import dayjs from 'dayjs'
import 'dayjs/locale/cs'
import React, { useEffect, useState } from 'react'
import { Dimensions, StyleSheet } from 'react-native'

import { fetchEvents } from '@/api/get_events'
import { CellModal } from '@/components/CellModal'
import DayCalendar from '@/components/CustomDay/CustomDay'
import MonthCalendar from '@/components/CustomMonth/CustomMonth'
import WeekCalendar from '@/components/CustomWeek/CustomWeek'
import { ThemedSafeView } from '@/components/ThemedSafeView'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'expo-router'

const SUPABASE_URL = 'https://tzbpcbmxwbsixrtorijk.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YnBjYm14d2JzaXhydG9yaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTIwMjEsImV4cCI6MjA3NTc2ODAyMX0.QTlHAHIPIJJ8FHDQowpZQIOckhHnAykn2CLbfJ2YbOw'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

dayjs.locale('cs')

export default function SharedCalendar() {
  const SCREEN_HEIGHT = Dimensions.get('window').height
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])

  const loadEvents = async () => {
    try {
      const data = await fetchEvents()
      setEvents(data)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    let mounted = true;

    loadEvents(); // načtení na start

    const channel = supabase.channel('realtime:public:events');

    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'events'
    }, (payload) => {
      console.log('Change in events:', payload);
      if (mounted) loadEvents(); // načti nové eventy
    });

    channel.subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);


  // run once

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

    </ThemedSafeView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
