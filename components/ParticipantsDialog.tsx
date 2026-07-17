import React from 'react';
import { ScrollView, Pressable } from 'react-native';
import { Button, Checkbox, Dialog, Portal } from 'react-native-paper';
import { ThemedText } from '@/components/themed-text';

export type SelectableUserId = string | number;

interface ParticipantsDialogProps {
    visible: boolean;
    onDismiss: () => void;
    users: any[];
    currentUserId?: SelectableUserId;
    selectedParticipants: SelectableUserId[];
    setSelectedParticipants: (ids: SelectableUserId[]) => void;
    /** Pokud je nastaveno, omezí počet vybraných (+ zakladatel). Pro pozvané nechte undefined. */
    peopleCount?: number;
    title?: string;
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
    title = 'Vyber účastníky',
    buttonColor,
    cardBackgroundColor
}: ParticipantsDialogProps) => {
    const selectedSet = new Set(selectedParticipants.map(String));
    const enforceLimit = typeof peopleCount === 'number' && peopleCount > 0;

    return (
        <Portal>
            <Dialog visible={visible} onDismiss={onDismiss} style={{ backgroundColor: cardBackgroundColor }}>
                <Dialog.Title style={{ color: buttonColor }}>{title}</Dialog.Title>
                <Dialog.ScrollArea>
                    <ScrollView style={{ maxHeight: 300 }}>
                        {users.filter(u => String(u.id) !== String(currentUserId)).map(u => {
                            const idStr = String(u.id);
                            const isSelected = selectedSet.has(idStr);
                            const isLimitReached = enforceLimit && (selectedParticipants.length + 1) >= peopleCount!;

                            return (
                                <Pressable
                                    key={idStr}
                                    style={{ flexDirection: 'row', alignItems: 'center', padding: 8, opacity: !isSelected && isLimitReached ? 0.5 : 1 }}
                                    onPress={() => {
                                        if (isSelected) {
                                            setSelectedParticipants(selectedParticipants.filter(id => String(id) !== idStr));
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
