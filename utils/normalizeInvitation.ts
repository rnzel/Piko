import { Invitation } from "@/types";

export const normalizeInvitation = (input: any): Invitation | null => {
  if (!input) return null;

  const id = String(input.id ?? "").trim();
  const groupId = String(input.groupId ?? "").trim();
  const groupName = String(input.groupName ?? "").trim();
  const groupCode = String(input.groupCode ?? "").trim();
  const invitedByUid = String(input.invitedByUid ?? "").trim();
  const invitedByDisplayName = String(input.invitedByDisplayName ?? "").trim();
  const invitedEmail = String(input.invitedEmail ?? "")
    .trim()
    .toLowerCase();

  if (
    !id ||
    !groupId ||
    !groupName ||
    !groupCode ||
    !invitedByUid ||
    !invitedEmail
  ) {
    return null;
  }

  const now = Date.now();
  const status =
    input.status === "accepted" ||
    input.status === "declined" ||
    input.status === "expired"
      ? input.status
      : "pending";

  return {
    id,
    groupId,
    groupName,
    groupCode,
    invitedByUid,
    invitedByDisplayName,
    invitedEmail,
    invitedUid:
      typeof input.invitedUid === "string" ? input.invitedUid : undefined,
    status,
    createdAt: typeof input.createdAt === "number" ? input.createdAt : now,
    updatedAt: typeof input.updatedAt === "number" ? input.updatedAt : now,
    expiresAt:
      typeof input.expiresAt === "number"
        ? input.expiresAt
        : now + 7 * 24 * 60 * 60 * 1000,
    message: typeof input.message === "string" ? input.message : undefined,
    isArchived: Boolean(input.isArchived),
    lastSyncedAt:
      typeof input.lastSyncedAt === "number" ? input.lastSyncedAt : undefined,
    syncStatus:
      input.syncStatus === "synced" || input.syncStatus === "pending"
        ? input.syncStatus
        : "local",
    pendingChanges: Boolean(input.pendingChanges),
  };
};

export const normalizeInvitations = (inputs: any[]): Invitation[] => {
  const map = new Map<string, Invitation>();
  for (const input of inputs) {
    const invitation = normalizeInvitation(input);
    if (!invitation) continue;
    const existing = map.get(invitation.id);
    if (!existing || invitation.updatedAt! >= (existing.updatedAt ?? 0)) {
      map.set(invitation.id, invitation);
    }
  }
  return Array.from(map.values());
};
