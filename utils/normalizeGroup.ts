import { Group } from "@/types";

export const normalizeGroup = (input: any): Group | null => {
  if (!input) return null;

  const id = String(input.id ?? "").trim();
  const name = String(input.name ?? "").trim();
  const code = String(input.code ?? "").trim();
  const createdBy = String(input.createdBy ?? "").trim();

  if (!id || !name || !code || !createdBy) return null;

  const now = Date.now();

  return {
    id,
    name,
    code,
    createdBy,
    createdAt: typeof input.createdAt === "number" ? input.createdAt : now,
    updatedAt: typeof input.updatedAt === "number" ? input.updatedAt : now,
    description:
      typeof input.description === "string" ? input.description : undefined,
    avatarURL:
      typeof input.avatarURL === "string" ? input.avatarURL : undefined,
    memberCount: typeof input.memberCount === "number" ? input.memberCount : 1,
    maxMembers:
      typeof input.maxMembers === "number" ? input.maxMembers : undefined,
    isArchived: Boolean(input.isArchived),
    lastActivityAt:
      typeof input.lastActivityAt === "number"
        ? input.lastActivityAt
        : undefined,
    taskCount:
      typeof input.taskCount === "number" ? input.taskCount : undefined,
    syncStatus:
      input.syncStatus === "local" ||
      input.syncStatus === "synced" ||
      input.syncStatus === "pending"
        ? input.syncStatus
        : "local",
    pendingChanges: Boolean(input.pendingChanges),
    lastSyncedAt:
      typeof input.lastSyncedAt === "number" ? input.lastSyncedAt : undefined,
  };
};

export const normalizeGroups = (inputs: any[]): Group[] => {
  const map = new Map<string, Group>();
  for (const input of inputs) {
    const group = normalizeGroup(input);
    if (!group) continue;
    const existing = map.get(group.id);
    if (!existing || group.updatedAt >= existing.updatedAt) {
      map.set(group.id, group);
    }
  }
  return Array.from(map.values());
};
