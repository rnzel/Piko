import { taskStorage } from "@/services/storageService";
import { syncOrchestrator } from "@/services/SyncOrchestrator";
import { taskService } from "@/services/taskService";
import { Task } from "@/types";

export type MigrationStrategy = "merge" | "keepAccount" | "cancel";

export interface GuestDataInfo {
  hasTasks: boolean;
  hasGroups: boolean;
  taskCount: number;
  groupCount: number;
}

/**
 * Detects guest data that was created while using the app in guest mode.
 * Only tasks are migrated — groups are no longer supported.
 */
export async function detectGuestData(): Promise<GuestDataInfo> {
  const tasks = await loadGuestTasks();
  return {
    hasTasks: tasks.length > 0,
    hasGroups: false,
    taskCount: tasks.length,
    groupCount: 0,
  };
}

/**
 * Loads guest tasks from the task storage adapter.
 */
async function loadGuestTasks(): Promise<Task[]> {
  // Guest tasks are stored in the same local task storage.
  return await taskStorage.getTasks();
}

/**
 * Clears all guest data after successful migration.
 */
async function clearGuestData(): Promise<void> {
  // Only task data needs to be cleared now.
  await taskStorage.clearTasks();
}

/**
 * Migrates guest data to the authenticated user's account.
 *
 * @param uid - The authenticated user's UID
 * @param strategy - Migration strategy ("merge" or "keepAccount")
 */
export async function migrateGuestData(
  uid: string,
  strategy: MigrationStrategy,
): Promise<void> {
  console.log(
    `[migrationService] Starting migration with strategy: ${strategy}`,
  );

  if (strategy === "keepAccount") {
    // Discard guest data, keep account data as-is
    console.log(
      `[migrationService] Keeping account data only. Clearing guest data.`,
    );
    await clearGuestData();
    return;
  }

  // Strategy: "merge" — merge guest tasks into account
  const guestTasks = await loadGuestTasks();

  if (guestTasks.length > 0) {
    console.log(
      `[migrationService] Migrating ${guestTasks.length} guest tasks.`,
    );

    // Merge guest tasks with existing account tasks
    const existingTasks = await taskService.getTasks();
    const existingIds = new Set(existingTasks.map((t) => t.id));

    const mergedTasks = [...existingTasks];
    let addedCount = 0;

    for (const task of guestTasks) {
      if (!existingIds.has(task.id)) {
        mergedTasks.push(task);
        addedCount++;
      }
    }

    // Save merged tasks locally first
    await taskStorage.saveTasks(mergedTasks);

    // Upload to Firestore via orchestrator
    if (uid) {
      await syncOrchestrator.saveTasks(mergedTasks);
    }

    console.log(
      `[migrationService] Migration complete: added ${addedCount} guest tasks.`,
    );
  }

  // Clear guest data after migration
  await clearGuestData();
  console.log(`[migrationService] Guest data cleared.`);
}
