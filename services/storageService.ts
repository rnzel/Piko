import { AppNotification, Task, UserProfile } from "@/types";
import { normalizeTask } from "@/utils/normalizeTask";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ────────────────────────────────────────────────────────────
// Storage keys
// ────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  TASKS: "@piko_tasks",
  USER: "@piko_user",
  IS_GUEST: "@piko_is_guest",
  NOTIFICATIONS: "@piko_notifications",
  PENDING_DELETES: "@piko_pending_deletes",
} as const;

// ────────────────────────────────────────────────────────────
// Storage versioning
// ────────────────────────────────────────────────────────────

const APP_STORAGE_VERSION_KEY = "@piko_storage_version";
const CURRENT_STORAGE_VERSION = 2;

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
    try {
      const tasksJson = await AsyncStorage.getItem(STORAGE_KEYS.TASKS);
      const tasks = tasksJson ? JSON.parse(tasksJson) : [];
      return tasks.map((t: any) => normalizeTask(t)).filter(Boolean) as Task[];
    } catch (error) {
      console.error("Error getting tasks:", error);
      return [];
    }
  },

  async saveTasks(tasks: Task[]): Promise<void> {
    try {
      const normalized = tasks.map((t) => ({
        ...t,
        updatedAt: t.updatedAt || Date.now(),
      }));
      await AsyncStorage.setItem(
        STORAGE_KEYS.TASKS,
        JSON.stringify(normalized),
      );
    } catch (error) {
      console.error("Error saving tasks:", error);
    }
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
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify([]));
    } catch (error) {
      console.error("Error clearing tasks:", error);
    }
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
    } catch (error) {
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
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_DELETES);
      return json ? JSON.parse(json) : [];
    } catch (error) {
      console.error("Error getting pending deletes:", error);
      return [];
    }
  },

  async addPendingDeleteId(taskId: string): Promise<void> {
    try {
      const ids = await this.getPendingDeleteIds();
      if (!ids.includes(taskId)) {
        ids.push(taskId);
        await AsyncStorage.setItem(
          STORAGE_KEYS.PENDING_DELETES,
          JSON.stringify(ids),
        );
      }
    } catch (error) {
      console.error("Error adding pending delete:", error);
    }
  },

  async removePendingDeleteId(taskId: string): Promise<void> {
    try {
      const ids = await this.getPendingDeleteIds();
      const filtered = ids.filter((id) => id !== taskId);
      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_DELETES,
        JSON.stringify(filtered),
      );
    } catch (error) {
      console.error("Error removing pending delete:", error);
    }
  },

  async clearPendingDeletes(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_DELETES,
        JSON.stringify([]),
      );
    } catch (error) {
      console.error("Error clearing pending deletes:", error);
    }
  },
};

// Clear all storage
// ────────────────────────────────────────────────────────────

export async function clearAllStorage(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.TASKS,
      STORAGE_KEYS.USER,
      STORAGE_KEYS.IS_GUEST,
      STORAGE_KEYS.NOTIFICATIONS,
      STORAGE_KEYS.PENDING_DELETES,
    ]);
  } catch (error) {
    console.error("Error clearing storage:", error);
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
