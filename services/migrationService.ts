import { taskStorage } from "@/services/storageService";
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
    // Discard guest data, keep account data as-is.
    // IMPORTANT: Do NOT clear local tasks yet — the orchestrator hasn't synced down
    // the Firestore tasks. The syncDown in initializeSync will populate the correct
    // task list from the remote. If we clear local tasks here, the user sees an empty
    // list until syncDown completes (which is bad UX but not data loss).
    // Instead, we mark that tasks should be replaced by remote on sync.
    // The simplest safe approach: do nothing now. The syncDown in initializeSync
    // will merge remote tasks, and local guest tasks with syncStatus "local" will
    // NOT be deleted by the improved _mergeTasks logic (which protects local-only).
    // This avoids the brief empty state entirely.
    console.log(
      `[migrationService] KeepAccount: deferring to syncDown for remote tasks. Local guest tasks with syncStatus="synced" will be removed by merge.`,
    );
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

    // Mark guest tasks as "local" so they won't be removed by _mergeTasks
    // during the syncDown that follows initialization.
    for (const task of guestTasks) {
      if (!existingIds.has(task.id)) {
        mergedTasks.push({
          ...task,
          syncStatus: "local" as const,
        });
        addedCount++;
      }
    }

    // Save merged tasks locally only.
    // Do NOT upload to Firestore here — the orchestrator is not initialized yet.
    // After migration, AuthContext calls initializeSync(uid), which will:
    //   1. Upload the merged local data to Firestore via _uploadLocalData
    //   2. Sync down from Firestore via _syncDown
    await taskStorage.saveTasks(mergedTasks);

    console.log(
      `[migrationService] Migration complete: added ${addedCount} guest tasks.`,
    );
  }
}
