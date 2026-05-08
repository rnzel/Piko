import { Task } from "@/types";
import { normalizeTask } from "./normalizeTask";

/**
 * Merge two task arrays with conflict resolution.
 *
 * Rules:
 * - Same ID → keep the one with the newer updatedAt
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
      // Same ID → keep the one with the newer updatedAt
      if (task.updatedAt > existing.updatedAt) {
        map.set(task.id, normalizeTask(task));
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
}
