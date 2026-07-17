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
    /** Pokud je nastaveno, zobrazí potvrzovací tlačítko místo pouhého zavření. */
    onConfirm?: () => void;
    confirmLabel?: string;
    confirmLoading?: boolean;
    emptyText?: string;
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
    cardBackgroundColor,
    onConfirm,
    confirmLabel = 'Přidat',
    confirmLoading = false,
    emptyText = 'Žádní přátelé k výběru.',
}: ParticipantsDialogProps) => {
    const selectedSet = new Set(selectedParticipants.map(String));
    const enforceLimit = typeof peopleCount === 'number' && peopleCount > 0;
    const list = users.filter(u => String(u.id) !== String(currentUserId));

    return (
        <Portal>
            <Dialog
                visible={visible}
                onDismiss={() => {
                    if (!confirmLoading) onDismiss();
                }}
                style={{ backgroundColor: cardBackgroundColor }}
            >
                <Dialog.Title style={{ color: buttonColor }}>{title}</Dialog.Title>
                <Dialog.ScrollArea>
                    <ScrollView style={{ maxHeight: 300 }}>
                        {list.length === 0 ? (
                            <ThemedText style={{ padding: 12, opacity: 0.7 }}>{emptyText}</ThemedText>
                        ) : (
                            list.map(u => {
                                const idStr = String(u.id);
                                const isSelected = selectedSet.has(idStr);
                                const isLimitReached = enforceLimit && (selectedParticipants.length + 1) >= peopleCount!;

                                return (
                                    <Pressable
                                        key={idStr}
                                        style={{ flexDirection: 'row', alignItems: 'center', padding: 8, opacity: !isSelected && isLimitReached ? 0.5 : 1 }}
                                        onPress={() => {
                                            if (confirmLoading) return;
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
                            })
                        )}
                    </ScrollView>
                </Dialog.ScrollArea>
                <Dialog.Actions>
                    {onConfirm ? (
                        <>
                            <Button onPress={onDismiss} disabled={confirmLoading}>Zrušit</Button>
                            <Button onPress={onConfirm} loading={confirmLoading} disabled={confirmLoading}>
                                {confirmLabel}
                            </Button>
                        </>
                    ) : (
                        <Button onPress={onDismiss}>Hotovo</Button>
                    )}
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
});
