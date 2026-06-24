import React, { createContext, useCallback, useContext, useState } from 'react';
import { NewEventModal } from '@/components/NewEventModal';

interface NewEventContextValue {
    openNewEvent: (date?: Date) => void;
}

const NewEventContext = createContext<NewEventContextValue>({
    openNewEvent: () => {},
});

export function NewEventProvider({ children }: { children: React.ReactNode }) {
    const [visible, setVisible] = useState(false);
    const [pickedDate, setPickedDate] = useState<Date | undefined>();

    const openNewEvent = useCallback((date?: Date) => {
        setPickedDate(date);
        setVisible(true);
    }, []);

    return (
        <NewEventContext.Provider value={{ openNewEvent }}>
            {children}
            <NewEventModal
                visible={visible}
                onDismiss={() => setVisible(false)}
                pickedDate={pickedDate}
            />
        </NewEventContext.Provider>
    );
}

export function useNewEvent() {
    return useContext(NewEventContext);
}
