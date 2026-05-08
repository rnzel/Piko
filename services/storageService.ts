import { Group, Membership, Task, UserProfile } from "@/types";
import { normalizeTask } from "@/utils/normalizeTask";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEYS = {
  TASKS: "@piko_tasks",
  GROUPS: "@piko_groups",
  USER: "@piko_user",
  IS_GUEST: "@piko_is_guest",
  SCHEMA_VERSION: "@piko_schema_version",
  GUEST_TASKS: "@piko_guest_tasks",
  GUEST_GROUPS: "@piko_guest_groups",
};

const userTasksKey = (uid: string) => `@piko_user_tasks_${uid}`;
const userGroupsKey = (uid: string) => `@piko_user_groups_${uid}`;
const userMembershipsKey = (uid: string) => `@piko_user_memberships_${uid}`;

const CURRENT_SCHEMA_VERSION = 3;

// Schema migration runner
const runMigrations = async (): Promise<void> => {
  try {
    const storedVersion = await AsyncStorage.getItem(
      STORAGE_KEYS.SCHEMA_VERSION,
    );
    const version = storedVersion ? parseInt(storedVersion, 10) : 0;

    if (version >= CURRENT_SCHEMA_VERSION) return;
    if (isNaN(version)) return;

    // Migration from v0 to v1: ensure timestamps are numbers
    if (version < 1) {
      const tasksJson = await AsyncStorage.getItem(STORAGE_KEYS.TASKS);
      if (tasksJson) {
        const tasks: Task[] = JSON.parse(tasksJson);
        let changed = false;
        const migrated = tasks.map((t) => {
          if (typeof t.createdAt === "string") {
            changed = true;
            return {
              ...t,
              createdAt: new Date(t.createdAt).getTime(),
              updatedAt: new Date(t.updatedAt).getTime(),
            };
          }
          return t;
        });
        if (changed) {
          await AsyncStorage.setItem(
            STORAGE_KEYS.TASKS,
            JSON.stringify(migrated),
          );
        }
      }
    }

    // Migration v1 to v2: groups already migrated (handled at app level)
    if (version < 2) {
      // No automated migration needed — handled by groupService
    }

    // Migration v2 to v3: Normalize all tasks (ensure priority, stable schema)
    if (version < 3) {
      console.log("[storageService] migrating to v3: normalizing tasks...");
      const tasksJson = await AsyncStorage.getItem(STORAGE_KEYS.TASKS);
      if (tasksJson) {
        const tasks: any[] = JSON.parse(tasksJson);
        const migrated = tasks.map(normalizeTask);
        await AsyncStorage.setItem(
          STORAGE_KEYS.TASKS,
          JSON.stringify(migrated),
        );
      }

      // Also migrate user-scoped tasks if any
      const keys = await AsyncStorage.getAllKeys();
      const userTaskKeys = keys.filter((k) =>
        k.startsWith("@piko_user_tasks_"),
      );
      for (const key of userTaskKeys) {
        const json = await AsyncStorage.getItem(key);
        if (json) {
          const tasks: any[] = JSON.parse(json);
          const migrated = tasks.map(normalizeTask);
          await AsyncStorage.setItem(key, JSON.stringify(migrated));
        }
      }

      // Also migrate guest-scoped tasks
      const guestTasksJson = await AsyncStorage.getItem(
        STORAGE_KEYS.GUEST_TASKS,
      );
      if (guestTasksJson) {
        const tasks: any[] = JSON.parse(guestTasksJson);
        const migrated = tasks.map(normalizeTask);
        await AsyncStorage.setItem(
          STORAGE_KEYS.GUEST_TASKS,
          JSON.stringify(migrated),
        );
      }
    }

    await AsyncStorage.setItem(
      STORAGE_KEYS.SCHEMA_VERSION,
      String(CURRENT_SCHEMA_VERSION),
    );
    console.log(
      `[storageService] schema migrated to v${CURRENT_SCHEMA_VERSION}`,
    );
  } catch (e) {
    console.error("[storageService] migration error", e);
  }
};

// Run migrations immediately on import
runMigrations();

// Task storage operations
export const taskStorage = {
  async getTasks(): Promise<Task[]> {
    try {
      console.log(
        `[storageService] Reading tasks from key: ${STORAGE_KEYS.TASKS}`,
      );
      const tasksJson = await AsyncStorage.getItem(STORAGE_KEYS.TASKS);
      const tasks: any[] = tasksJson ? JSON.parse(tasksJson) : [];
      const normalizedTasks = tasks.map(normalizeTask);
      console.log(
        `[storageService] Retrieved ${normalizedTasks.length} tasks.`,
      );
      return normalizedTasks;
    } catch (error) {
      console.error("Error getting tasks:", error);
      return [];
    }
  },

  async saveTasks(tasks: Task[]): Promise<void> {
    try {
      console.log(
        `[storageService] Saving ${tasks.length} tasks to key: ${STORAGE_KEYS.TASKS}`,
      );
      await AsyncStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
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

  async clearTasks(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.TASKS);
    } catch (error) {
      console.error("Error clearing tasks:", error);
    }
  },
};

// Group storage operations
export const groupStorage = {
  async getGroups(): Promise<Group[]> {
    try {
      console.log(
        `[storageService] Reading groups from key: ${STORAGE_KEYS.GROUPS}`,
      );
      const groupsJson = await AsyncStorage.getItem(STORAGE_KEYS.GROUPS);
      const groups = groupsJson ? JSON.parse(groupsJson) : [];
      console.log(`[storageService] Retrieved ${groups.length} groups.`);
      return groups;
    } catch (error) {
      console.error("Error getting groups:", error);
      return [];
    }
  },

  async saveGroups(groups: Group[]): Promise<void> {
    try {
      console.log(
        `[storageService] Saving ${groups.length} groups to key: ${STORAGE_KEYS.GROUPS}`,
      );
      await AsyncStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
    } catch (error) {
      console.error("Error saving groups:", error);
    }
  },

  async addGroup(group: Group): Promise<void> {
    try {
      const groups = await this.getGroups();
      groups.push(group);
      await this.saveGroups(groups);
    } catch (error) {
      console.error("Error adding group:", error);
    }
  },

  async updateGroup(updatedGroup: Group): Promise<void> {
    try {
      const groups = await this.getGroups();
      const index = groups.findIndex((g) => g.id === updatedGroup.id);
      if (index !== -1) {
        groups[index] = updatedGroup;
        await this.saveGroups(groups);
      }
    } catch (error) {
      console.error("Error updating group:", error);
    }
  },

  async deleteGroup(groupId: string): Promise<void> {
    try {
      const groups = await this.getGroups();
      const filteredGroups = groups.filter((g) => g.id !== groupId);
      await this.saveGroups(filteredGroups);
    } catch (error) {
      console.error("Error deleting group:", error);
    }
  },

  async clearGroups(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.GROUPS);
    } catch (error) {
      console.error("Error clearing groups:", error);
    }
  },
};

// Membership storage (denormalized per-user memberships)
export const membershipStorage = {
  async getMemberships(uid: string): Promise<Membership[]> {
    try {
      const json = await AsyncStorage.getItem(userMembershipsKey(uid));
      return json ? JSON.parse(json) : [];
    } catch (error) {
      console.error("Error getting memberships:", error);
      return [];
    }
  },

  async saveMemberships(uid: string, memberships: Membership[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        userMembershipsKey(uid),
        JSON.stringify(memberships),
      );
    } catch (error) {
      console.error("Error saving memberships:", error);
    }
  },
};

// User storage operations
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

// Guest mode operations
export const guestStorage = {
  async setIsGuest(isGuest: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.IS_GUEST,
        JSON.stringify(isGuest),
      );
    } catch (error) {
      console.error("Error setting guest status:", error);
    }
  },

  async getIsGuest(): Promise<boolean> {
    try {
      const isGuestJson = await AsyncStorage.getItem(STORAGE_KEYS.IS_GUEST);
      return isGuestJson ? JSON.parse(isGuestJson) : false;
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

/**
 * User-scoped storage for authenticated users.
 * Keys are scoped by uid to prevent cross-user data leaks.
 */
export const userScopedStorage = {
  async getTasks(uid: string): Promise<Task[]> {
    try {
      const key = userTasksKey(uid);
      console.log(`[storageService] Reading user tasks from key: ${key}`);
      const json = await AsyncStorage.getItem(key);
      const tasks: any[] = json ? JSON.parse(json) : [];
      const normalizedTasks = tasks.map(normalizeTask);
      console.log(
        `[storageService] Retrieved ${normalizedTasks.length} user tasks for uid: ${uid}.`,
      );
      return normalizedTasks;
    } catch (error) {
      console.error("Error getting user tasks:", error);
      return [];
    }
  },
  async saveTasks(uid: string, tasks: Task[]): Promise<void> {
    try {
      const key = userTasksKey(uid);
      console.log(
        `[storageService] Saving ${tasks.length} user tasks to key: ${key}`,
      );
      await AsyncStorage.setItem(key, JSON.stringify(tasks));
    } catch (error) {
      console.error("Error saving user tasks:", error);
    }
  },
  async getGroups(uid: string): Promise<Group[]> {
    try {
      const json = await AsyncStorage.getItem(userGroupsKey(uid));
      return json ? JSON.parse(json) : [];
    } catch (error) {
      console.error("Error getting user groups:", error);
      return [];
    }
  },
  async saveGroups(uid: string, groups: Group[]): Promise<void> {
    try {
      await AsyncStorage.setItem(userGroupsKey(uid), JSON.stringify(groups));
    } catch (error) {
      console.error("Error saving user groups:", error);
    }
  },
};

/**
 * Guest-scoped storage — separate from the legacy @piko_tasks/@piko_groups keys.
 */
export const guestScopedStorage = {
  async getTasks(): Promise<Task[]> {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.GUEST_TASKS);
      const tasks: any[] = json ? JSON.parse(json) : [];
      return tasks.map(normalizeTask);
    } catch (error) {
      console.error("Error getting guest tasks:", error);
      return [];
    }
  },
  async saveTasks(tasks: Task[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.GUEST_TASKS,
        JSON.stringify(tasks),
      );
    } catch (error) {
      console.error("Error saving guest tasks:", error);
    }
  },
  async getGroups(): Promise<Group[]> {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.GUEST_GROUPS);
      return json ? JSON.parse(json) : [];
    } catch (error) {
      console.error("Error getting guest groups:", error);
      return [];
    }
  },
  async saveGroups(groups: Group[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.GUEST_GROUPS,
        JSON.stringify(groups),
      );
    } catch (error) {
      console.error("Error saving guest groups:", error);
    }
  },
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.GUEST_TASKS);
      await AsyncStorage.removeItem(STORAGE_KEYS.GUEST_GROUPS);
    } catch (error) {
      console.error("Error clearing guest storage:", error);
    }
  },
};

// Clear all storage
export const clearAllStorage = async (): Promise<void> => {
  try {
    await taskStorage.clearTasks();
    await groupStorage.clearGroups();
    await userStorage.clearUser();
    await guestStorage.clearGuestStatus();
  } catch (error) {
    console.error("Error clearing all storage:", error);
  }
};
