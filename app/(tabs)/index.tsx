import DayCalendar from '@/components/CustomDay/CustomDay';
import MonthCalendar from '@/components/CustomMonth/CustomMonth';
import WeekCalendar from '@/components/CustomWeek/CustomWeek';
import { EventModal } from '@/components/EventModal';
import { ThemedSafeView } from '@/components/ThemedSafeView';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import dayjs from 'dayjs';
import 'dayjs/locale/cs';
import React, { useState } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
dayjs.locale('cs')




export default function SharedCalendar() {
  const SCREEN_HEIGHT = Dimensions.get('window').height;
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
  ]);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [modalVisible, setModalVisible] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(1);


  const handlePressDay = (date) => {
    setSelectedDate(date);
    setSelectedIndex(0);
  };

  const addEvent = () => {
    if (!newEventTitle) return;

    setEvents([
      ...events,
      {
        title: newEventTitle,
        start: selectedDate,
        end: new Date(selectedDate.getTime() + 60 * 60 * 1000),
        user_id: 1,
      },
    ]);
    setNewEventTitle('');
    setModalVisible(false);
  };

  const selectCalendar = () => {
    if (selectedIndex == 1) {
      return (
        <WeekCalendar
          events={events}
          onPressCell={(date) => {
            setSelectedDate(date);
            setModalVisible(true);
          }}
          onPressDay={handlePressDay}
          hourHeight={(SCREEN_HEIGHT - 170) / 7}
        />
      )
    }
    else if (selectedIndex == 0) {
      return (
        <DayCalendar
          events={events}
          defaultDate={selectedDate}
          onPressCell={(date) => {
            setSelectedDate(date);
            setModalVisible(true);
          }}
          hourHeight={100}
        />
      )
    }
    else {
      return (
        <MonthCalendar
          events={events}
          defaultDate={selectedDate}
          onPressDay={handlePressDay}
        />
      )
    }
  }

  return (
    <ThemedSafeView style={styles.container}>
      <SegmentedControl
        values={['Den', 'Týden', 'Měsíc']}
        selectedIndex={selectedIndex}
        onChange={(event) => {
          setSelectedIndex(event.nativeEvent.selectedSegmentIndex);
        }}
      />


      {selectCalendar()}

      <EventModal visible={modalVisible} onCreate={addEvent} onDismiss={() => setModalVisible(false)} />
    </ThemedSafeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 8,
    marginVertical: 10,
  },
});
