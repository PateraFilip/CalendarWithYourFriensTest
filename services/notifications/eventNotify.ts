import { createNotificationsForRecipients } from '@/services/notifications/notifications';
import { fetchEventInviteIds } from '@/services/events/invites';

/** Pozvaní, kteří ještě nejsou přihlášení k účasti. */
export function invitedOnlyIds(
  inviteIds: Array<string | number>,
  participantIds: Array<string | number>
): string[] {
  const inEvent = new Set(participantIds.map(String));
  return Array.from(new Set(inviteIds.map(String))).filter((id) => !inEvent.has(id));
}

/** Změny události (termín, kapacita, účast, …) → jen zúčastnění. */
export function notifyEventParticipants(params: {
  participantIds: Array<string | number>;
  actorId: string | number;
  type?: string;
  message: string;
  seriesId: number;
  instanceDate?: string | null;
}) {
  return createNotificationsForRecipients({
    recipientIds: params.participantIds,
    actorId: params.actorId,
    type: params.type || 'event_updated',
    message: params.message,
    seriesId: params.seriesId,
    instanceDate: params.instanceDate ?? null,
  });
}

/**
 * Uvolnění místa → jen pozvaní (ne účastníci).
 * Volá se při odhlášení / odebrání / zvýšení kapacity.
 */
export async function notifyInvitesAboutSlotFreed(params: {
  seriesId: number;
  actorId: string | number;
  title: string;
  instanceDate?: string | null;
  /** Aktuální pozvánky (jinak načte z DB) */
  inviteIds?: Array<string | number>;
  /** Aktuální účastníci — ti nedostanou „uvolnilo se místo“ */
  participantIds: Array<string | number>;
}) {
  const invites =
    params.inviteIds ?? (await fetchEventInviteIds(params.seriesId));
  const recipients = invitedOnlyIds(invites, params.participantIds);
  if (recipients.length === 0) return;

  const dStr = params.instanceDate || '';
  const t = params.title;
  return createNotificationsForRecipients({
    recipientIds: recipients,
    actorId: params.actorId,
    type: 'event_slot_freed',
    message: `Uvolnilo se místo ve skupinové události "${t}"! [EVENT:${params.seriesId}:${dStr}:${t}]`,
    seriesId: params.seriesId,
    instanceDate: params.instanceDate ?? null,
  });
}

/** Nová pozvánka / založení → jen nově pozvaní. */
export function notifyNewlyInvited(params: {
  inviteIds: Array<string | number>;
  actorId: string | number;
  message: string;
  seriesId: number;
  instanceDate?: string | null;
}) {
  return createNotificationsForRecipients({
    recipientIds: params.inviteIds,
    actorId: params.actorId,
    type: 'event_created',
    message: params.message,
    seriesId: params.seriesId,
    instanceDate: params.instanceDate ?? null,
  });
}
