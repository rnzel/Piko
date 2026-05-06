import { Group, Task, UserProfile } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEYS = {
  TASKS: "@piko_tasks",
  GROUPS: "@piko_groups",
  USER: "@piko_user",
  IS_GUEST: "@piko_is_guest",
  SCHEMA_VERSION: "@piko_schema_version",
};

const CURRENT_SCHEMA_VERSION = 1;

// Schema migration runner
const runMigrations = async (): Promise<void> => {
  try {
    const storedVersion = await AsyncStorage.getItem(
      STORAGE_KEYS.SCHEMA_VERSION,
    );
    const version = storedVersion ? parseInt(storedVersion, 10) : 0;

    if (version >= CURRENT_SCHEMA_VERSION) return;
    if (isNaN(version)) return;

    // Migration from v0 to v1: ensure timestamps are numbers (legacy fix)
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
      const tasksJson = await AsyncStorage.getItem(STORAGE_KEYS.TASKS);
      return tasksJson ? JSON.parse(tasksJson) : [];
    } catch (error) {
      console.error("Error getting tasks:", error);
      return [];
    }
  },

  async saveTasks(tasks: Task[]): Promise<void> {
    try {
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
      const groupsJson = await AsyncStorage.getItem(STORAGE_KEYS.GROUPS);
      return groupsJson ? JSON.parse(groupsJson) : [];
    } catch (error) {
      console.error("Error getting groups:", error);
      return [];
    }
  },

  async saveGroups(groups: Group[]): Promise<void> {
    try {
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
      return isGuestJson ? JSON.parse(isGuestJson) : true;
    } catch (error) {
      console.error("Error getting guest status:", error);
      return true;
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
