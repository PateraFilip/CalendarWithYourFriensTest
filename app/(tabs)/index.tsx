import DayCalendar from '@/components/CustomDay/CustomDay';
import MonthCalendar from '@/components/CustomMonth/CustomMonth';
import WeekCalendar from '@/components/CustomWeek/CustomWeek';
import { ThemedSafeView } from '@/components/ThemedSafeView';
import dayjs from 'dayjs';
import 'dayjs/locale/cs';
import React, { useState } from 'react';
import { Modal, Button as RNButton, TextInput as RNTextInput, StyleSheet, Text, View } from 'react-native';
dayjs.locale('cs')




export default function SharedCalendar() {
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

  const [mode, setMode] = useState('week'); // week | month | day
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [modalVisible, setModalVisible] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');


  const handlePressDay = (date) => {
    setSelectedDate(date);
    setMode('day');
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
    if (mode == "week") {
      return (
        <WeekCalendar
          events={events}
          onPressCell={(date) => {
            setSelectedDate(date);
            setModalVisible(true);
          }}
          onPressDay={handlePressDay}
          hourHeight={100}
        />
      )
    }
    else if (mode == "day") {
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
      <RNButton onPress={() => {
        if (mode === 'week') setMode('month');
        else if (mode === 'month') setMode('day');
        else setMode('week');
      }} title={`Přepnout na ${mode === 'week' ? 'měsíc' : mode === 'month' ? 'den' : 'týden'}`} />



      {selectCalendar()}

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text>Přidat novou událost</Text>
            <RNTextInput
              placeholder="Název události"
              value={newEventTitle}
              onChangeText={setNewEventTitle}
              style={styles.input}
            />
            <RNButton title="Přidat" onPress={addEvent} />
            <RNButton title="Zrušit" onPress={() => setModalVisible(false)} />
          </View>
        </View>
      </Modal>
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
