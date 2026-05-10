import { Membership } from "@/types";

/**
 * Normalizes a single membership entity from Firestore/local payloads.
 * Ensures required fields are present and types are stable.
 */
export const normalizeMembership = (input: any): Membership | null => {
  if (!input) return null;

  const groupId = String(input.groupId ?? "").trim();
  const groupName = String(input.groupName ?? "").trim();
  const groupCode = String(input.groupCode ?? "").trim();

  if (!groupId || !groupName || !groupCode) {
    return null;
  }

  const role =
    input.role === "owner" || input.role === "admin" || input.role === "member"
      ? input.role
      : "member";

  const joinedAt =
    typeof input.joinedAt === "number" && Number.isFinite(input.joinedAt)
      ? input.joinedAt
      : Date.now();

  const updatedAt =
    typeof input.updatedAt === "number" && Number.isFinite(input.updatedAt)
      ? input.updatedAt
      : joinedAt;

  return {
    groupId,
    groupName,
    groupCode,
    role,
    joinedAt,
    updatedAt,
    lastSyncedAt:
      typeof input.lastSyncedAt === "number" ? input.lastSyncedAt : undefined,
    membershipVersion:
      typeof input.membershipVersion === "number" ? input.membershipVersion : 1,
    syncStatus:
      input.syncStatus === "synced" || input.syncStatus === "pending"
        ? input.syncStatus
        : "local",
    pendingChanges: Boolean(input.pendingChanges),
    lastViewedAt:
      typeof input.lastViewedAt === "number" ? input.lastViewedAt : undefined,
    unreadCount:
      typeof input.unreadCount === "number" ? input.unreadCount : undefined,
  };
};

/**
 * Normalizes and deduplicates memberships by groupId.
 * Keeps the freshest record by updatedAt/joinedAt for duplicate IDs.
 */
export const normalizeMemberships = (inputs: any[]): Membership[] => {
  const map = new Map<string, Membership>();

  for (const raw of inputs) {
    const membership = normalizeMembership(raw);
    if (!membership) continue;

    const existing = map.get(membership.groupId);
    const membershipTime = membership.updatedAt ?? membership.joinedAt;
    const existingTime = existing
      ? (existing.updatedAt ?? existing.joinedAt)
      : Number.MIN_SAFE_INTEGER;
    if (!existing || membershipTime >= existingTime) {
      map.set(membership.groupId, membership);
    }
  }

  return Array.from(map.values());
};
