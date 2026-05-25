import { AppNotification, Task, UserProfile } from "@/types";
import { normalizeTask } from "@/utils/normalizeTask";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ────────────────────────────────────────────────────────────
// Storage keys
// ────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  TASKS_LEGACY: "@piko_tasks",
  USER: "@piko_user",
  IS_GUEST: "@piko_is_guest",
  NOTIFICATIONS: "@piko_notifications",
  PENDING_DELETES_LEGACY: "@piko_pending_deletes",
  PENDING_UPSERTS_LEGACY: "@piko_pending_upserts",
  TASKS_GUEST: "@piko_tasks_guest",
  PENDING_DELETES_GUEST: "@piko_pending_deletes_guest",
  PENDING_UPSERTS_GUEST: "@piko_pending_upserts_guest",
} as const;

const STORAGE_PREFIXES = {
  TASKS_USER: "@piko_tasks_user_",
  PENDING_DELETES_USER: "@piko_pending_deletes_user_",
  PENDING_UPSERTS_USER: "@piko_pending_upserts_user_",
} as const;

type SessionScope =
  | { type: "guest" }
  | { type: "user"; uid: string };

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

// ────────────────────────────────────────────────────────────
// Storage versioning
// ────────────────────────────────────────────────────────────

const APP_STORAGE_VERSION_KEY = "@piko_storage_version";
const CURRENT_STORAGE_VERSION = 2;

function getTaskStorageKey(scope: SessionScope): string {
  return scope.type === "guest"
    ? STORAGE_KEYS.TASKS_GUEST
    : `${STORAGE_PREFIXES.TASKS_USER}${scope.uid}`;
}

function getPendingDeletesStorageKey(scope: SessionScope): string {
  return scope.type === "guest"
    ? STORAGE_KEYS.PENDING_DELETES_GUEST
    : `${STORAGE_PREFIXES.PENDING_DELETES_USER}${scope.uid}`;
}

function getPendingUpsertsStorageKey(scope: SessionScope): string {
  return scope.type === "guest"
    ? STORAGE_KEYS.PENDING_UPSERTS_GUEST
    : `${STORAGE_PREFIXES.PENDING_UPSERTS_USER}${scope.uid}`;
}

async function getCurrentSessionScope(): Promise<SessionScope> {
  try {
    const [userJson, isGuestValue] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.USER),
      AsyncStorage.getItem(STORAGE_KEYS.IS_GUEST),
    ]);

    if (isGuestValue === "true") {
      return { type: "guest" };
    }

    if (userJson) {
      const user = JSON.parse(userJson) as UserProfile | null;
      if (user?.uid) {
        return { type: "user", uid: user.uid };
      }
    }
  } catch (error) {
    console.error("Error resolving current session scope:", error);
  }

  return { type: "guest" };
}

async function getTasksForScope(scope: SessionScope): Promise<Task[]> {
  try {
    const storageKey = getTaskStorageKey(scope);
    let tasksJson = await AsyncStorage.getItem(storageKey);

    if (!tasksJson && scope.type === "user") {
      const legacyTasksJson = await AsyncStorage.getItem(STORAGE_KEYS.TASKS_LEGACY);
      if (legacyTasksJson) {
        tasksJson = legacyTasksJson;
        await AsyncStorage.setItem(storageKey, legacyTasksJson);
      }
    }

    const tasks = tasksJson ? JSON.parse(tasksJson) : [];
    return tasks.map((t: any) => normalizeTask(t)).filter(Boolean) as Task[];
  } catch (error) {
    console.error("Error getting tasks:", error);
    return [];
  }
}

async function saveTasksForScope(
  scope: SessionScope,
  tasks: Task[],
): Promise<void> {
  try {
    const normalized = tasks.map((t) =>
      normalizeTask({
        ...t,
        updatedAt: t.updatedAt || Date.now(),
      }),
    );
    await AsyncStorage.setItem(
      getTaskStorageKey(scope),
      JSON.stringify(normalized),
    );
  } catch (error) {
    console.error("Error saving tasks:", error);
  }
}

async function clearTasksForScope(scope: SessionScope): Promise<void> {
  try {
    await AsyncStorage.setItem(getTaskStorageKey(scope), JSON.stringify([]));
  } catch (error) {
    console.error("Error clearing tasks:", error);
  }
}

async function getPendingIdsForScope(storageKey: string): Promise<string[]> {
  try {
    const json = await AsyncStorage.getItem(storageKey);
    return json ? sanitizeStringArray(JSON.parse(json)) : [];
  } catch (error) {
    console.error("Error getting pending ids:", error);
    return [];
  }
}

async function getPendingIdsWithLegacyFallback(
  scope: SessionScope,
  scopedKey: string,
  legacyKey: string,
): Promise<string[]> {
  try {
    let json = await AsyncStorage.getItem(scopedKey);

    if (!json && scope.type === "user") {
      const legacyJson = await AsyncStorage.getItem(legacyKey);
      if (legacyJson) {
        json = legacyJson;
        await AsyncStorage.setItem(scopedKey, legacyJson);
      }
    }

    return json ? sanitizeStringArray(JSON.parse(json)) : [];
  } catch (error) {
    console.error("Error getting pending ids:", error);
    return [];
  }
}

async function addPendingIdForScope(
  storageKey: string,
  taskId: string,
): Promise<void> {
  try {
    const ids = await getPendingIdsForScope(storageKey);
    if (!ids.includes(taskId)) {
      ids.push(taskId);
      await AsyncStorage.setItem(storageKey, JSON.stringify(ids));
    }
  } catch (error) {
    console.error("Error adding pending id:", error);
  }
}

async function removePendingIdForScope(
  storageKey: string,
  taskId: string,
): Promise<void> {
  try {
    const ids = await getPendingIdsForScope(storageKey);
    const filtered = ids.filter((id) => id !== taskId);
    await AsyncStorage.setItem(storageKey, JSON.stringify(filtered));
  } catch (error) {
    console.error("Error removing pending id:", error);
  }
}

async function clearPendingIdsForScope(storageKey: string): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey, JSON.stringify([]));
  } catch (error) {
    console.error("Error clearing pending ids:", error);
  }
}

async function checkAndMigrateStorage(): Promise<void> {
  try {
    const versionStr = await AsyncStorage.getItem(APP_STORAGE_VERSION_KEY);
    const version = versionStr ? parseInt(versionStr, 10) : 0;

    const migrations: Record<number, () => Promise<void>> = {
      1: async () => {
        // Migration v1 to v2: groups/memberships were handled at app level.
        // No group migration needed anymore.
      },
    };

    for (let v = version; v < CURRENT_STORAGE_VERSION; v++) {
      if (migrations[v]) {
        await migrations[v]();
      }
    }

    await AsyncStorage.setItem(
      APP_STORAGE_VERSION_KEY,
      String(CURRENT_STORAGE_VERSION),
    );
  } catch (error) {
    console.error("Storage migration failed:", error);
  }
}

// ────────────────────────────────────────────────────────────
// Task storage operations
// ────────────────────────────────────────────────────────────

export const taskStorage = {
  async getTasks(): Promise<Task[]> {
    const scope = await getCurrentSessionScope();
    return getTasksForScope(scope);
  },

  async getGuestTasks(): Promise<Task[]> {
    return getTasksForScope({ type: "guest" });
  },

  async getUserTasks(uid: string): Promise<Task[]> {
    return getTasksForScope({ type: "user", uid });
  },

  async saveTasks(tasks: Task[]): Promise<void> {
    const scope = await getCurrentSessionScope();
    await saveTasksForScope(scope, tasks);
  },

  async saveGuestTasks(tasks: Task[]): Promise<void> {
    await saveTasksForScope({ type: "guest" }, tasks);
  },

  async saveUserTasks(uid: string, tasks: Task[]): Promise<void> {
    await saveTasksForScope({ type: "user", uid }, tasks);
  },

  async addTask(task: Task): Promise<void> {
    try {
      const tasks = await this.getTasks();
      tasks.push(task);
      await this.saveTasks(tasks);
    } catch (error) {
      console.error("Error adding task:", error);
    }
  },

  async updateTask(updatedTask: Task): Promise<void> {
    try {
      const tasks = await this.getTasks();
      const index = tasks.findIndex((t) => t.id === updatedTask.id);
      if (index !== -1) {
        tasks[index] = updatedTask;
        await this.saveTasks(tasks);
      }
    } catch (error) {
      console.error("Error updating task:", error);
    }
  },

  async upsertTask(task: Task): Promise<void> {
    try {
      const tasks = await this.getTasks();
      const index = tasks.findIndex((t) => t.id === task.id);
      const normalizedTask = normalizeTask(task);
      if (index === -1) {
        tasks.push(normalizedTask);
      } else {
        tasks[index] = normalizedTask;
      }
      await this.saveTasks(tasks);
    } catch (error) {
      console.error("Error upserting task:", error);
    }
  },

  async markTasksSynced(
    taskIds: string[],
    metadata?: Partial<Pick<Task, "createdBy" | "lastModifiedBy">>,
  ): Promise<void> {
    try {
      if (taskIds.length === 0) return;
      const ids = new Set(taskIds);
      const tasks = await this.getTasks();
      const updated = tasks.map((task) =>
        ids.has(task.id)
          ? normalizeTask({
              ...task,
              createdBy: task.createdBy ?? metadata?.createdBy,
              lastModifiedBy: metadata?.lastModifiedBy ?? task.lastModifiedBy,
              syncStatus: "synced",
            })
          : task,
      );
      await this.saveTasks(updated);
    } catch (error) {
      console.error("Error marking tasks as synced:", error);
    }
  },

  async deleteTask(taskId: string): Promise<void> {
    try {
      const tasks = await this.getTasks();
      const filteredTasks = tasks.filter((t) => t.id !== taskId);
      await this.saveTasks(filteredTasks);
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  },

  async deleteTasks(taskIds: string[]): Promise<void> {
    try {
      const tasks = await this.getTasks();
      const idsSet = new Set(taskIds);
      const filteredTasks = tasks.filter((t) => !idsSet.has(t.id));
      await this.saveTasks(filteredTasks);
    } catch (error) {
      console.error("Error deleting tasks:", error);
    }
  },

  async clearTasks(): Promise<void> {
    const scope = await getCurrentSessionScope();
    await clearTasksForScope(scope);
  },

  async clearGuestTasks(): Promise<void> {
    await clearTasksForScope({ type: "guest" });
  },

  async clearUserTasks(uid: string): Promise<void> {
    await clearTasksForScope({ type: "user", uid });
  },
};

// ────────────────────────────────────────────────────────────
// User storage operations
// ────────────────────────────────────────────────────────────

export const userStorage = {
  async getUser(): Promise<UserProfile | null> {
    try {
      const userJson = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      return userJson ? JSON.parse(userJson) : null;
    } catch (error) {
      console.error("Error getting user:", error);
      return null;
    }
  },

  async saveUser(user: UserProfile): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } catch (error) {
      console.error("Error saving user:", error);
    }
  },

  async clearUser(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.USER);
    } catch (error) {
      console.error("Error clearing user:", error);
    }
  },
};

// ────────────────────────────────────────────────────────────
// Guest storage operations
// ────────────────────────────────────────────────────────────

export const guestStorage = {
  async setIsGuest(isGuest: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.IS_GUEST, String(isGuest));
    } catch (error) {
      console.error("Error setting guest status:", error);
    }
  },

  async getIsGuest(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(STORAGE_KEYS.IS_GUEST);
      return value === "true";
    } catch (error) {
      console.error("Error getting guest status:", error);
      return false;
    }
  },

  async clearGuestStatus(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.IS_GUEST);
    } catch (error) {
      console.error("Error clearing guest status:", error);
    }
  },
};

// ────────────────────────────────────────────────────────────
// Notification storage operations
// ────────────────────────────────────────────────────────────

export const notificationStorage = {
  async getNotifications(): Promise<AppNotification[]> {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      return json ? JSON.parse(json) : [];
    } catch (error) {
      console.error("Error getting notifications:", error);
      return [];
    }
  },

  async saveNotifications(notifications: AppNotification[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.NOTIFICATIONS,
        JSON.stringify(notifications),
      );
    } catch (error) {
      console.error("Error saving notifications:", error);
    }
  },

  async addNotification(notification: AppNotification): Promise<void> {
    try {
      const notifications = await this.getNotifications();
      notifications.unshift(notification); // newest first
      await this.saveNotifications(notifications);
    } catch (error) {
      console.error("Error adding notification:", error);
    }
  },

  async markAsRead(notificationId: string): Promise<void> {
    try {
      const notifications = await this.getNotifications();
      const index = notifications.findIndex((n) => n.id === notificationId);
      if (index !== -1 && !notifications[index].read) {
        notifications[index] = {
          ...notifications[index],
          read: true,
          readAt: Date.now(),
        };
        await this.saveNotifications(notifications);
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  },

  async deleteNotification(notificationId: string): Promise<void> {
    try {
      const notifications = await this.getNotifications();
      const filtered = notifications.filter((n) => n.id !== notificationId);
      await this.saveNotifications(filtered);
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  },

  async deleteNotificationsForTask(taskId: string): Promise<void> {
    try {
      const notifications = await this.getNotifications();
      const filtered = notifications.filter((n) => n.data?.taskId !== taskId);
      if (filtered.length !== notifications.length) {
        await this.saveNotifications(filtered);
      }
    } catch (error) {
      console.error("Error deleting task notifications:", error);
    }
  },

  async clearNotifications(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.NOTIFICATIONS,
        JSON.stringify([]),
      );
    } catch (error) {
      console.error("Error clearing notifications:", error);
    }
  },

  /** Mark all notifications as read */
  async markAllAsRead(): Promise<void> {
    try {
      const notifications = await this.getNotifications();
      const updated = notifications.map((n) =>
        n.read ? n : { ...n, read: true, readAt: Date.now() },
      );
      await this.saveNotifications(updated);
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  },

  /** Get unread count */
  async getUnreadCount(): Promise<number> {
    try {
      const notifications = await this.getNotifications();
      return notifications.filter((n) => !n.read).length;
    } catch {
      return 0;
    }
  },
};

// ────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────
// Pending deletes storage (for offline deletes that need to sync)
// ────────────────────────────────────────────────────────────

export const pendingDeleteStorage = {
  async getPendingDeleteIds(): Promise<string[]> {
    const scope = await getCurrentSessionScope();
    return getPendingIdsWithLegacyFallback(
      scope,
      getPendingDeletesStorageKey(scope),
      STORAGE_KEYS.PENDING_DELETES_LEGACY,
    );
  },

  async getGuestPendingDeleteIds(): Promise<string[]> {
    return getPendingIdsForScope(
      getPendingDeletesStorageKey({ type: "guest" }),
    );
  },

  async addPendingDeleteId(taskId: string): Promise<void> {
    const scope = await getCurrentSessionScope();
    await addPendingIdForScope(getPendingDeletesStorageKey(scope), taskId);
  },

  async removePendingDeleteId(taskId: string): Promise<void> {
    const scope = await getCurrentSessionScope();
    await removePendingIdForScope(getPendingDeletesStorageKey(scope), taskId);
  },

  async clearPendingDeletes(): Promise<void> {
    const scope = await getCurrentSessionScope();
    await clearPendingIdsForScope(getPendingDeletesStorageKey(scope));
  },

  async clearGuestPendingDeletes(): Promise<void> {
    await clearPendingIdsForScope(
      getPendingDeletesStorageKey({ type: "guest" }),
    );
  },
};

// ────────────────────────────────────────────────────────────
// Pending upserts storage (for offline add/update that need sync)
// ────────────────────────────────────────────────────────────

export const pendingUpsertStorage = {
  async getPendingUpsertIds(): Promise<string[]> {
    const scope = await getCurrentSessionScope();
    return getPendingIdsWithLegacyFallback(
      scope,
      getPendingUpsertsStorageKey(scope),
      STORAGE_KEYS.PENDING_UPSERTS_LEGACY,
    );
  },

  async getGuestPendingUpsertIds(): Promise<string[]> {
    return getPendingIdsForScope(
      getPendingUpsertsStorageKey({ type: "guest" }),
    );
  },

  async addPendingUpsertId(taskId: string): Promise<void> {
    const scope = await getCurrentSessionScope();
    await addPendingIdForScope(getPendingUpsertsStorageKey(scope), taskId);
  },

  async removePendingUpsertId(taskId: string): Promise<void> {
    const scope = await getCurrentSessionScope();
    await removePendingIdForScope(getPendingUpsertsStorageKey(scope), taskId);
  },

  async clearPendingUpserts(): Promise<void> {
    const scope = await getCurrentSessionScope();
    await clearPendingIdsForScope(getPendingUpsertsStorageKey(scope));
  },

  async clearGuestPendingUpserts(): Promise<void> {
    await clearPendingIdsForScope(
      getPendingUpsertsStorageKey({ type: "guest" }),
    );
  },
};

// Clear all storage
// ────────────────────────────────────────────────────────────

export async function clearAllStorage(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const scopedKeys = allKeys.filter(
      (key) =>
        key.startsWith(STORAGE_PREFIXES.TASKS_USER) ||
        key.startsWith(STORAGE_PREFIXES.PENDING_DELETES_USER) ||
        key.startsWith(STORAGE_PREFIXES.PENDING_UPSERTS_USER),
    );

    await AsyncStorage.multiRemove([
      STORAGE_KEYS.TASKS_LEGACY,
      STORAGE_KEYS.TASKS_GUEST,
      STORAGE_KEYS.USER,
      STORAGE_KEYS.IS_GUEST,
      STORAGE_KEYS.NOTIFICATIONS,
      STORAGE_KEYS.PENDING_DELETES_LEGACY,
      STORAGE_KEYS.PENDING_UPSERTS_LEGACY,
      STORAGE_KEYS.PENDING_DELETES_GUEST,
      STORAGE_KEYS.PENDING_UPSERTS_GUEST,
      ...scopedKeys,
    ]);
  } catch (error) {
    console.error("Error clearing storage:", error);
  }
}

export async function clearSessionStorage(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([STORAGE_KEYS.USER, STORAGE_KEYS.IS_GUEST]);
  } catch (error) {
    console.error("Error clearing session storage:", error);
  }
}

// ────────────────────────────────────────────────────────────
// Deprecated storage exports (kept for backward compatibility)
// These are no longer used by the app but are exported so that
// existing import references do not break during staged deprecation.
// ────────────────────────────────────────────────────────────

/** @deprecated Groups are no longer supported. Returns an empty array. */
export const groupStorage = {
  getGroups: async (): Promise<any[]> => [],
  saveGroups: async (_groups: any[]): Promise<void> => {},
  addGroup: async (_group: any): Promise<void> => {},
  updateGroup: async (_group: any): Promise<void> => {},
  deleteGroup: async (_groupId: string): Promise<void> => {},
  clearGroups: async (): Promise<void> => {},
};

/** @deprecated Memberships are no longer supported. Returns an empty array. */
export const membershipStorage = {
  getMemberships: async (_uid: string): Promise<any[]> => [],
  saveMemberships: async (
    _uid: string,
    _memberships: any[],
  ): Promise<void> => {},
};

/** @deprecated User-scoped storage for groups — no longer supported. */
export const userScopedStorage = {
  getGroups: async (_uid: string): Promise<any[]> => [],
  saveGroups: async (_uid: string, _groups: any[]): Promise<void> => {},
};

/** @deprecated Guest-scoped storage for groups — no longer supported. */
export const guestScopedStorage = {
  getGroups: async (): Promise<any[]> => [],
  saveGroups: async (_groups: any[]): Promise<void> => {},
};

// Run storage migration on import
checkAndMigrateStorage();
