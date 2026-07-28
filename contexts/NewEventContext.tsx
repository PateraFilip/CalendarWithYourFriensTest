import React, { createContext, useCallback, useContext, useState } from 'react';
import { NewEventModal } from '@/components/NewEventModal';
import { useAppDataOptional } from '@/contexts/AppDataContext';

interface NewEventContextValue {
  openNewEvent: (date?: Date) => void;
}

const NewEventContext = createContext<NewEventContextValue>({
  openNewEvent: () => {},
});

export function NewEventProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [pickedDate, setPickedDate] = useState<Date | undefined>();
  const [formKey, setFormKey] = useState(0);
  const appData = useAppDataOptional();

  const openNewEvent = useCallback((date?: Date) => {
    setPickedDate(date);
    setFormKey((k) => k + 1);
    setVisible(true);
  }, []);

  const handleSuccess = useCallback(() => {
    setVisible(false);
    setPickedDate(undefined);
    void appData?.refreshTimeline?.(true);
  }, [appData]);

  return (
    <NewEventContext.Provider value={{ openNewEvent }}>
      {children}
      <NewEventModal
        visible={visible}
        formKey={formKey}
        onDismiss={() => {
          setVisible(false);
          setPickedDate(undefined);
        }}
        onSuccess={handleSuccess}
        pickedDate={pickedDate}
      />
    </NewEventContext.Provider>
  );
}

export function useNewEvent() {
  return useContext(NewEventContext);
}
