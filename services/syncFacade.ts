import { groupStorage, taskStorage } from "@/services/storageService";
import { Group, Task } from "@/types";
import firestore from "@react-native-firebase/firestore";

/**
 * SyncFacade — transparent layer between services and storage.
 *
 * For guest users: all operations go to AsyncStorage (local-only).
 * For authenticated users: all operations write to Firestore *and* AsyncStorage,
 * and read from AsyncStorage (fast). On first sync, local data is uploaded.
 *
 * This keeps the existing UI/service contract unchanged while adding
 * optional cloud persistence.
 */

// Firestore collection paths
const userTasksPath = (uid: string) => `users/${uid}/tasks`;
const userGroupsPath = (uid: string) => `users/${uid}/groups`;

let _initialized = false;
let _uid: string | null = null;

// In-memory lock to prevent concurrent full-sync operations
let _syncInProgress = false;

const isAuthenticated = (): boolean => !!_uid;

export const syncFacade = {
  /** Call after sign-in to enable Firestore sync */
  initialize(uid: string): void {
    _uid = uid;
    _initialized = true;
    _syncInProgress = false;
    console.log(`[syncFacade] initialized for uid=${uid}`);
  },

  /** Call on sign-out to revert to local-only */
  deinitialize(): void {
    _uid = null;
    _initialized = false;
    _syncInProgress = false;
    console.log("[syncFacade] deinitialized");
  },

  get isInitialized(): boolean {
    return _initialized;
  },

  get currentUid(): string | null {
    return _uid;
  },

  // ────────────────────────────────
  //  Initial one-time upload
  // ────────────────────────────────

  /**
   * Uploads local data to Firestore for the current user.
   * Called once after first sign-in or when migrating existing local data.
   */
  async uploadLocalData(): Promise<void> {
    if (!_uid) return;
    if (_syncInProgress) return;
    _syncInProgress = true;

    try {
      const tasks = await taskStorage.getTasks();
      const groups = await groupStorage.getGroups();

      const batch = firestore().batch();

      // Write tasks
      const tasksCol = firestore().collection(userTasksPath(_uid));
      for (const task of tasks) {
        const docRef = tasksCol.doc(task.id);
        batch.set(docRef, task);
      }

      // Write groups
      const groupsCol = firestore().collection(userGroupsPath(_uid));
      for (const group of groups) {
        const docRef = groupsCol.doc(group.id);
        batch.set(docRef, group);
      }

      await batch.commit();
      console.log(
        `[syncFacade] uploaded ${tasks.length} tasks and ${groups.length} groups`,
      );
    } catch (e) {
      console.error("[syncFacade] uploadLocalData error", e);
    } finally {
      _syncInProgress = false;
    }
  },

  /**
   * Pulls all documents from Firestore and merges them into AsyncStorage.
   * Called on app start for authenticated users. Uses last-write-wins.
   */
  async syncDown(): Promise<void> {
    if (!_uid) return;
    if (_syncInProgress) return;
    _syncInProgress = true;

    try {
      // Sync tasks
      const taskSnapshot = await firestore()
        .collection(userTasksPath(_uid))
        .get();
      const remoteTasks: Task[] = taskSnapshot.docs.map((doc) => ({
        ...(doc.data() as Task),
        id: doc.id,
      }));

      if (remoteTasks.length > 0) {
        const localTasks = await taskStorage.getTasks();
        const localMap = new Map(localTasks.map((t) => [t.id, t]));
        for (const rt of remoteTasks) {
          const local = localMap.get(rt.id);
          if (!local || rt.updatedAt >= local.updatedAt) {
            localMap.set(rt.id, rt);
          }
        }
        const merged = Array.from(localMap.values());
        await taskStorage.saveTasks(merged);
        console.log(`[syncFacade] synced ${merged.length} tasks`);
      }

      // Sync groups
      const groupSnapshot = await firestore()
        .collection(userGroupsPath(_uid))
        .get();
      const remoteGroups: Group[] = groupSnapshot.docs.map((doc) => ({
        ...(doc.data() as Group),
        id: doc.id,
      }));

      if (remoteGroups.length > 0) {
        const localGroups = await groupStorage.getGroups();
        const localMap = new Map(localGroups.map((g) => [g.id, g]));
        for (const rg of remoteGroups) {
          const local = localMap.get(rg.id);
          if (!local || rg.createdAt >= local.createdAt) {
            localMap.set(rg.id, rg);
          }
        }
        const merged = Array.from(localMap.values());
        await groupStorage.saveGroups(merged);
        console.log(`[syncFacade] synced ${merged.length} groups`);
      }
    } catch (e) {
      console.error("[syncFacade] syncDown error", e);
    } finally {
      _syncInProgress = false;
    }
  },

  // ────────────────────────────────
  //  Task write-through helpers
  // ────────────────────────────────

  async addTask(task: Task): Promise<void> {
    await taskStorage.addTask(task);
    if (isAuthenticated() && _uid) {
      try {
        await firestore()
          .collection(userTasksPath(_uid))
          .doc(task.id)
          .set(task);
      } catch (e) {
        console.error("[syncFacade] addTask firestore error", e);
      }
    }
  },

  async updateTask(task: Task): Promise<void> {
    await taskStorage.updateTask(task);
    if (isAuthenticated() && _uid) {
      try {
        await firestore()
          .collection(userTasksPath(_uid))
          .doc(task.id)
          .set(task);
      } catch (e) {
        console.error("[syncFacade] updateTask firestore error", e);
      }
    }
  },

  async deleteTask(taskId: string): Promise<void> {
    await taskStorage.deleteTask(taskId);
    if (isAuthenticated() && _uid) {
      try {
        await firestore().collection(userTasksPath(_uid)).doc(taskId).delete();
      } catch (e) {
        console.error("[syncFacade] deleteTask firestore error", e);
      }
    }
  },

  async saveTasks(tasks: Task[]): Promise<void> {
    await taskStorage.saveTasks(tasks);
    if (isAuthenticated() && _uid) {
      try {
        const batch = firestore().batch();
        const col = firestore().collection(userTasksPath(_uid));
        for (const task of tasks) {
          batch.set(col.doc(task.id), task);
        }
        await batch.commit();
      } catch (e) {
        console.error("[syncFacade] saveTasks firestore error", e);
      }
    }
  },

  // ────────────────────────────────
  //  Group write-through helpers
  // ────────────────────────────────

  async addGroup(group: Group): Promise<void> {
    await groupStorage.addGroup(group);
    if (isAuthenticated() && _uid) {
      try {
        await firestore()
          .collection(userGroupsPath(_uid))
          .doc(group.id)
          .set(group);
      } catch (e) {
        console.error("[syncFacade] addGroup firestore error", e);
      }
    }
  },

  async updateGroup(group: Group): Promise<void> {
    await groupStorage.updateGroup(group);
    if (isAuthenticated() && _uid) {
      try {
        await firestore()
          .collection(userGroupsPath(_uid))
          .doc(group.id)
          .set(group);
      } catch (e) {
        console.error("[syncFacade] updateGroup firestore error", e);
      }
    }
  },

  async deleteGroup(groupId: string): Promise<void> {
    await groupStorage.deleteGroup(groupId);
    if (isAuthenticated() && _uid) {
      try {
        await firestore()
          .collection(userGroupsPath(_uid))
          .doc(groupId)
          .delete();
      } catch (e) {
        console.error("[syncFacade] deleteGroup firestore error", e);
      }
    }
  },

  async saveGroups(groups: Group[]): Promise<void> {
    await groupStorage.saveGroups(groups);
    if (isAuthenticated() && _uid) {
      try {
        const batch = firestore().batch();
        const col = firestore().collection(userGroupsPath(_uid));
        for (const group of groups) {
          batch.set(col.doc(group.id), group);
        }
        await batch.commit();
      } catch (e) {
        console.error("[syncFacade] saveGroups firestore error", e);
      }
    }
  },
};

export default syncFacade;
