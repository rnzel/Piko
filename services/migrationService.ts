import {
  groupStorage,
  guestScopedStorage,
  membershipStorage,
  taskStorage,
  userScopedStorage,
} from "@/services/storageService";
import { Group, Task } from "@/types";
import { mergeGroups } from "@/utils/mergeGroups";
import { mergeTasks } from "@/utils/mergeTasks";

export type MigrationStrategy = "merge" | "keepAccount" | "cancel";

export interface GuestDataInfo {
  hasTasks: boolean;
  hasGroups: boolean;
  taskCount: number;
  groupCount: number;
}

export async function detectGuestData(): Promise<GuestDataInfo> {
  const legacyTasks = await taskStorage.getTasks();
  const legacyGroups = await groupStorage.getGroups();
  const guestTasks = await guestScopedStorage.getTasks();
  const guestGroups = await guestScopedStorage.getGroups();

  const allTasks = legacyTasks.length > 0 || guestTasks.length > 0;
  const allGroups = legacyGroups.length > 0 || guestGroups.length > 0;

  return {
    hasTasks: allTasks,
    hasGroups: allGroups,
    taskCount: legacyTasks.length + guestTasks.length,
    groupCount: legacyGroups.length + guestGroups.length,
  };
}

async function loadGuestTasks(): Promise<Task[]> {
  const legacy = await taskStorage.getTasks();
  const scoped = await guestScopedStorage.getTasks();
  const map = new Map<string, Task>();
  for (const t of legacy) map.set(t.id, t);
  for (const t of scoped) map.set(t.id, t);
  return Array.from(map.values());
}

async function loadGuestGroups(): Promise<Group[]> {
  const legacy = await groupStorage.getGroups();
  const scoped = await guestScopedStorage.getGroups();
  const map = new Map<string, Group>();
  for (const g of legacy) map.set(g.id, g);
  for (const g of scoped) map.set(g.id, g);
  return Array.from(map.values());
}

async function clearGuestData(): Promise<void> {
  await taskStorage.clearTasks();
  await groupStorage.clearGroups();
  await guestScopedStorage.clearAll();
}

export async function migrateGuestData(
  uid: string,
  strategy: MigrationStrategy,
): Promise<boolean> {
  if (strategy === "cancel") return false;

  try {
    if (strategy === "merge") {
      const guestTasks = await loadGuestTasks();
      const guestGroups = await loadGuestGroups();
      const userTasks = await userScopedStorage.getTasks(uid);
      const userGroups = await userScopedStorage.getGroups(uid);

      console.log(
        `[migrationService] Merging guest tasks (${guestTasks.length}) with user tasks (${userTasks.length})`,
      );
      const mergedTasks = mergeTasks(guestTasks, userTasks).map((task) => ({
        ...task,
        updatedAt: Date.now(),
      }));
      console.log(
        `[migrationService] Merged tasks count: ${mergedTasks.length}`,
      );

      console.log(
        `[migrationService] Merging guest groups (${guestGroups.length}) with user groups (${userGroups.length})`,
      );
      const mergedGroups = mergeGroups(guestGroups, userGroups).map(
        (group) => ({ ...group, updatedAt: Date.now() }),
      );
      console.log(
        `[migrationService] Merged groups count: ${mergedGroups.length}`,
      );

      // Save merged data to user-scoped storage
      await userScopedStorage.saveTasks(uid, mergedTasks);
      await userScopedStorage.saveGroups(uid, mergedGroups);
      console.log(
        "[migrationService] Merged data saved to user-scoped storage.",
      );

      // Write to legacy storage for immediate app pickup
      await taskStorage.saveTasks(mergedTasks);
      await groupStorage.saveGroups(mergedGroups);
      console.log(
        "[migrationService] Merged data saved to legacy storage for immediate app pickup.",
      );

      // Create memberships for merged groups
      const memberships = mergedGroups.map((g) => ({
        groupId: g.id,
        groupName: g.name,
        groupCode: g.code,
        role: (g.createdBy === uid ? "owner" : "member") as "owner" | "member",
        joinedAt: Date.now(),
      }));
      if (memberships.length > 0) {
        await membershipStorage.saveMemberships(uid, memberships);
      }

      await clearGuestData();
    } else if (strategy === "keepAccount") {
      const userTasks = await userScopedStorage.getTasks(uid);
      const userGroups = await userScopedStorage.getGroups(uid);

      await taskStorage.saveTasks(userTasks);
      await groupStorage.saveGroups(userGroups);

      // Create memberships for kept groups
      const memberships = userGroups.map((g) => ({
        groupId: g.id,
        groupName: g.name,
        groupCode: g.code,
        role: (g.createdBy === uid ? "owner" : "member") as "owner" | "member",
        joinedAt: Date.now(),
      }));
      if (memberships.length > 0) {
        await membershipStorage.saveMemberships(uid, memberships);
      }

      await clearGuestData();
    }

    return true;
  } catch (error) {
    console.error("[migrationService] migration failed:", error);
    throw error;
  }
}

export const migrationService = {
  detectGuestData,
  migrateGuestData,
};
