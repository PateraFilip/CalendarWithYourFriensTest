import React from 'react';
import { ScrollView, Pressable } from 'react-native';
import { Button, Checkbox, Dialog, Portal } from 'react-native-paper';
import { ThemedText } from '@/components/themed-text';

interface ParticipantsDialogProps {
    visible: boolean;
    onDismiss: () => void;
    users: any[];
    currentUserId?: number;
    selectedParticipants: number[];
    setSelectedParticipants: (ids: number[]) => void;
    peopleCount: number;
    buttonColor: string;
    cardBackgroundColor: string;
}

export const ParticipantsDialog = React.memo(({
    visible,
    onDismiss,
    users,
    currentUserId,
    selectedParticipants,
    setSelectedParticipants,
    peopleCount,
    buttonColor,
    cardBackgroundColor
}: ParticipantsDialogProps) => {
    return (
        <Portal>
            <Dialog visible={visible} onDismiss={onDismiss} style={{ backgroundColor: cardBackgroundColor }}>
                <Dialog.Title style={{ color: buttonColor }}>Vyber účastníky</Dialog.Title>
                <Dialog.ScrollArea>
                    <ScrollView style={{ maxHeight: 300 }}>
                        {users.filter(u => u.id !== currentUserId).map(u => {
                            const isSelected = selectedParticipants.includes(u.id);
                            const isLimitReached = (selectedParticipants.length + 1) >= peopleCount;

                            return (
                                <Pressable
                                    key={u.id}
                                    style={{ flexDirection: 'row', alignItems: 'center', padding: 8, opacity: !isSelected && isLimitReached ? 0.5 : 1 }}
                                    onPress={() => {
                                        if (isSelected) {
                                            setSelectedParticipants(selectedParticipants.filter(id => id !== u.id));
                                        } else if (!isLimitReached) {
                                            setSelectedParticipants([...selectedParticipants, u.id]);
                                        }
                                    }}
                                >
                                    <Checkbox status={isSelected ? 'checked' : 'unchecked'} color={buttonColor} disabled={!isSelected && isLimitReached} />
                                    <ThemedText style={{ marginLeft: 8 }}>{u.username}</ThemedText>
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                </Dialog.ScrollArea>
                <Dialog.Actions>
                    <Button onPress={onDismiss}>Hotovo</Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
});
