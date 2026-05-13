import { Task } from "@/types";
import { normalizeToDay } from "@/utils/dateUtils";

/**
 * Authoritative normalizer for Task objects.
 * Ensures all task objects conform to the latest schema across all layers:
 * - AsyncStorage
 * - Firestore
 * - Realtime sync
 * - Migration flow
 */
export const normalizeTask = (task: any): Task => {
  const now = Date.now();

  // Basic property extraction with defaults
  const normalized: Task = {
    id: String(task.id || ""),
    text: String(task.text || ""),
    completed: Boolean(task.completed),
    groupId: task.groupId || undefined,
    reminder: Boolean(task.reminder),
    reminderAt:
      typeof task.reminderAt === "number" ? task.reminderAt : undefined,
    createdAt: typeof task.createdAt === "number" ? task.createdAt : now,
    updatedAt: typeof task.updatedAt === "number" ? task.updatedAt : now,

    // Priority normalization - default to "medium"
    priority: isValidPriority(task.priority) ? task.priority : "medium",

    // Collaboration fields
    completedAt:
      typeof task.completedAt === "number" ? task.completedAt : undefined,
    completedBy: task.completedBy || undefined,
    createdBy: task.createdBy || undefined,
    assignedTo: task.assignedTo || undefined,
    dueDate: normalizeToDay(
      typeof task.dueDate === "number" ? task.dueDate : undefined,
    ),
    deleted: Boolean(task.deleted),
    lastModifiedBy: task.lastModifiedBy || undefined,

    // Sync metadata
    syncVersion:
      typeof task.syncVersion === "number" ? task.syncVersion : undefined,
    syncStatus: isValidSyncStatus(task.syncStatus) ? task.syncStatus : "local",
  };

  return normalized;
};

/**
 * Validates if a value is a valid priority level.
 */
const isValidPriority = (
  priority: any,
): priority is "low" | "medium" | "high" => {
  return ["low", "medium", "high"].includes(priority);
};

/**
 * Validates if a value is a valid sync status.
 */
const isValidSyncStatus = (
  status: any,
): status is "local" | "synced" | "conflict" => {
  return ["local", "synced", "conflict"].includes(status);
};
