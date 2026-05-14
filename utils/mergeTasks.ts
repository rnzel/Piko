import { Task } from "@/types";
import { normalizeTask } from "./normalizeTask";

/**
 * Canonical merge for task arrays with conflict resolution.
 *
 * SyncOrchestrator._mergeTasks uses this logic internally (replicated for
 * lock-scoped execution). Keep both in sync.
 *
 * Rules:
 * - Same ID → keep the one with the newer updatedAt
 * - Local-only tasks (syncStatus === "local") are never overwritten by remote
 * - Tasks with syncStatus === "synced" are overwritten if remote is newer
 * - Remote-only tasks are added
 * - Different ID → keep both
 *
 * @param local - The source array (e.g., guest tasks)
 * @param remote - The target array (e.g., authenticated user tasks)
 * @returns A merged, deduplicated array of tasks sorted by createdAt desc
 */
export function mergeTasks(local: Task[], remote: Task[]): Task[] {
  const map = new Map<string, Task>();

  // Index remote tasks first
  for (const task of remote) {
    map.set(task.id, normalizeTask(task));
  }

  // Merge local tasks with conflict resolution
  for (const task of local) {
    const existing = map.get(task.id);
    if (!existing) {
      map.set(task.id, normalizeTask(task));
    } else {
      // Same ID — only overwrite if local was previously synced and local is newer
      if (task.syncStatus === "synced" && task.updatedAt > existing.updatedAt) {
        map.set(task.id, normalizeTask(task));
      }
      // If local.syncStatus === "local", preserve remote version
    }
  }

  return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
}
