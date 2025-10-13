import WeekCalendar from '@/components/CustomWeek/CustomWeek';
import { ThemedSafeView } from '@/components/ThemedSafeView';
import dayjs from 'dayjs';
import 'dayjs/locale/cs';
import React, { useState } from 'react';
import { Modal, Button as RNButton, TextInput as RNTextInput, StyleSheet, Text, View } from 'react-native';
import { Calendar } from 'react-native-big-calendar';
dayjs.locale('cs')





export default function SharedCalendar() {
  const [events, setEvents] = useState([
    {
      title: 'Událost A',
      start: new Date(2025, 9, 13, 10, 0),
      end: new Date(2025, 9, 13, 11, 0),
      color: 'red',
    },
  ]);

  const [mode, setMode] = useState('week'); // week | month | day
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [modalVisible, setModalVisible] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');

  const handlePressCell = (date) => {
    if (mode === 'month') {
      // kliknutí v měsíčním zobrazení → přepni na den
      setSelectedDate(date);
      setMode('day');
    } else {
      // kliknutí v týdnu/den → otevři modal pro přidání události
      setSelectedDate(date);
      setModalVisible(true);
    }
  };

  const addEvent = () => {
    if (!newEventTitle) return;
    const colors = ['red', 'blue', 'green', 'orange'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    setEvents([
      ...events,
      {
        title: newEventTitle,
        start: selectedDate,
        end: new Date(selectedDate.getTime() + 60 * 60 * 1000),
        color: randomColor,
      },
    ]);
    setNewEventTitle('');
    setModalVisible(false);
  };

  return (
    <ThemedSafeView style={styles.container}>
      <RNButton onPress={() => {
        if (mode === 'week') setMode('month');
        else if (mode === 'month') setMode('day');
        else setMode('week');
      }} title={`Přepnout na ${mode === 'week' ? 'měsíc' : mode === 'month' ? 'den' : 'týden'}`} />

      <Calendar
  events={events}
  height={500}
  mode={mode}
  date={selectedDate}
  weekStartsOn={1}
  locale="cs"
  onPressCell={handlePressCell}
  onPressEvent={(event) => {
    setSelectedDate(event.start);
    setModalVisible(true);
  }}  // menší výška
  showAllDayEventCell={false} // <-- skryje prázdné top buňky
  eventCellStyle={(event) => ({
    backgroundColor: event.color,
  })}
/>

<WeekCalendar
      events={events}
      onPressCell={(date) => {
    console.log('Kliknuto na buňku:', date);
  }}
      />

      {/* Modal pro přidání události */}
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
