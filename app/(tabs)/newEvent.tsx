import { EventCreateForm } from '@/components/EventCreateForm';
import { ThemedSafeView } from '@/components/ThemedSafeView';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';

/** Skrytá route pro zpětnou kompatibilitu – formulář je primárně v modalu (FAB). */
export default function NewEvent() {
    const { pickedDate } = useLocalSearchParams();
    const dateStr = Array.isArray(pickedDate) ? pickedDate[0] : pickedDate;

    return (
        <ThemedSafeView style={{ flex: 1 }}>
            <EventCreateForm pickedDate={dateStr} />
        </ThemedSafeView>
    );
}
