import { taskStorage, userStorage } from "@/services/storageService";
import { SyncState, Task } from "@/types";
import { normalizeTask } from "@/utils/normalizeTask";
// Modular Firebase imports
import { getApp } from "@react-native-firebase/app";
import {
  collection,
  doc,
  FieldValue,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
} from "@react-native-firebase/firestore";
import { sanitizeForFirestore } from "./serialization";

// ────────────────────────────────────────────────────────────
// State Machine
// ────────────────────────────────────────────────────────────

export enum SyncLifecycleState {
  IDLE = 0,
  AUTHENTICATING = 1,
  UPLOADING_LOCAL = 2,
  HYDRATING = 3,
  REALTIME_READY = 4,
  READY = 5,
  ERROR = 6,
}

// Map internal state to public SyncState for AuthContext
const stateToSyncState: Record<SyncLifecycleState, SyncState> = {
  [SyncLifecycleState.IDLE]: SyncState.IDLE,
  [SyncLifecycleState.AUTHENTICATING]: SyncState.AUTHENTICATING,
  [SyncLifecycleState.UPLOADING_LOCAL]: SyncState.UPLOADING_LOCAL,
  [SyncLifecycleState.HYDRATING]: SyncState.HYDRATING,
  [SyncLifecycleState.REALTIME_READY]: SyncState.REALTIME_READY,
  [SyncLifecycleState.READY]: SyncState.READY,
  [SyncLifecycleState.ERROR]: SyncState.IDLE,
};

// ────────────────────────────────────────────────────────────
// Listener types
// ────────────────────────────────────────────────────────────

export type StateChangeListener = (state: SyncLifecycleState) => void;

// ────────────────────────────────────────────────────────────
// Mutex (simple async lock)
// ────────────────────────────────────────────────────────────

class Mutex {
  private _locked = false;
  private _queue: Array<() => void> = [];

  async acquire(): Promise<void> {
    if (!this._locked) {
      this._locked = true;
      return;
    }
    return new Promise<void>((resolve) => {
      this._queue.push(resolve);
    });
  }

  release(): void {
    const next = this._queue.shift();
    if (next) {
      this._locked = true;
      next();
    } else {
      this._locked = false;
    }
  }
}

// ────────────────────────────────────────────────────────────
// Firestore helpers (Modular API)
// ────────────────────────────────────────────────────────────

const db = getFirestore(getApp());

// Helper to get collection reference
const getCollectionRef = (path: string) => {
  return collection(db, path);
};

// Helper to get document reference
const getDocRef = (collectionPath: string, docId: string) => {
  return doc(db, collectionPath, docId);
};

// ────────────────────────────────────────────────────────────
// Collection path helpers
// ────────────────────────────────────────────────────────────

const userDocPath = (uid: string) => `users/${uid}`;
const userPrivateTasksPath = (uid: string) => `users/${uid}/private_tasks`;

// ────────────────────────────────────────────────────────────
// SyncOrchestrator Class
// ────────────────────────────────────────────────────────────

class SyncOrchestrator {
  private _uid: string | null = null;
  private _state: SyncLifecycleState = SyncLifecycleState.IDLE;
  private _syncLock = new Mutex();
  private _abortController: AbortController | null = null;
  private _initializationPromise: Promise<void> | null = null;
  private _listeners: Set<StateChangeListener> = new Set();

  // Realtime listener unsubscribe functions
  private _taskUnsubscribe: (() => void) | null = null;

  // ──────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────

  /** Current sync lifecycle state */
  get state(): SyncLifecycleState {
    return this._state;
  }

  /** Current UID (null if not authenticated) */
  get uid(): string | null {
    return this._uid;
  }

  /** Whether the orchestrator is initialized */
  get isInitialized(): boolean {
    return this._uid !== null;
  }

  /** Map internal state to public SyncState */
  get syncState(): SyncState {
    return stateToSyncState[this._state] ?? SyncState.IDLE;
  }

  /**
   * Initialize the orchestrator for a user.
   * Idempotent — concurrent calls return the same promise.
   */
  async initialize(uid: string): Promise<void> {
    if (this._initializationPromise) {
      console.log(
        `[SyncOrchestrator] Initialization already in progress, returning existing promise`,
      );
      return this._initializationPromise;
    }

    this._initializationPromise = this._initializeInternal(uid);
    return this._initializationPromise;
  }

  /**
   * Deinitialize the orchestrator.
   * Cleans up listeners, aborts ongoing operations, resets state.
   */
  async deinitialize(): Promise<void> {
    console.log(`[SyncOrchestrator] Deinitializing...`);

    // Abort any ongoing operations
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }

    // Detach realtime listeners
    this._detachRealtimeListeners();

    // Reset state
    await this._syncLock.acquire();
    try {
      this._uid = null;
      this._setState(SyncLifecycleState.IDLE);
      this._initializationPromise = null;
      console.log(`[SyncOrchestrator] Deinitialized, state: ${this._state}`);
    } finally {
      this._syncLock.release();
    }
  }

  /** Subscribe to state changes */
  subscribe(listener: StateChangeListener): () => void {
    this._listeners.add(listener);
    // Return unsubscribe function
    return () => {
      this._listeners.delete(listener);
    };
  }

  // ──────────────────────────────────────────────────────────
  // Internal initialization
  // ──────────────────────────────────────────────────────────

  private async _initializeInternal(uid: string): Promise<void> {
    console.log(`[SyncOrchestrator] Initializing for uid: ${uid}`);

    try {
      // Create new abort controller for this initialization session
      const controller = this._ensureAbortController();
      const signal = controller.signal;

      // Step 1: Set UID and enter AUTHENTICATING state
      await this._syncLock.acquire();
      this._uid = uid;
      this._setState(SyncLifecycleState.UPLOADING_LOCAL);
      this._syncLock.release();

      if (signal.aborted) return;

      // Step 2: Upload local data to Firestore
      try {
        const localTasks = await taskStorage.getTasks();

        if (localTasks.length > 0) {
          console.log(
            `[SyncOrchestrator] Uploading ${localTasks.length} tasks...`,
          );
          await this._uploadLocalData(uid, signal);
          console.log(`[SyncOrchestrator] Local data uploaded.`);
        } else {
          console.log(`[SyncOrchestrator] No local data to upload.`);
        }
      } catch (uploadError) {
        console.warn(`[SyncOrchestrator] uploadLocalData failed:`, uploadError);
        // Continue even if upload fails
      }

      if (signal.aborted) return;

      // Step 3: Sync down from Firestore
      await this._syncLock.acquire();
      this._setState(SyncLifecycleState.HYDRATING);
      this._syncLock.release();

      try {
        console.log(`[SyncOrchestrator] Performing initial syncDown...`);
        await this._syncDown(uid, signal);
        console.log(`[SyncOrchestrator] Initial syncDown complete.`);
      } catch (syncError) {
        console.warn(`[SyncOrchestrator] syncDown failed:`, syncError);
        // Continue even if syncDown fails
      }

      if (signal.aborted) return;

      // Step 4: Attach realtime listeners
      await this._syncLock.acquire();
      this._setState(SyncLifecycleState.REALTIME_READY);
      this._syncLock.release();

      console.log(`[SyncOrchestrator] Attaching realtime listeners...`);
      await this._attachRealtimeListeners(uid);
      console.log(`[SyncOrchestrator] Realtime listeners attached.`);

      if (signal.aborted) return;

      // Step 5: Mark as READY
      await this._syncLock.acquire();
      this._setState(SyncLifecycleState.READY);
      this._syncLock.release();

      console.log(`[SyncOrchestrator] Sync lifecycle complete. System READY.`);
    } catch (error) {
      console.error(`[SyncOrchestrator] Initialization error:`, error);
      await this._syncLock.acquire();
      this._setState(SyncLifecycleState.ERROR);
      this._syncLock.release();
      throw error;
    } finally {
      this._initializationPromise = null;
    }
  }

  private _ensureAbortController(): AbortController {
    if (this._abortController) {
      this._abortController.abort();
    }
    this._abortController = new AbortController();
    return this._abortController;
  }

  private _setState(state: SyncLifecycleState): void {
    this._state = state;
    console.log(
      `[SyncOrchestrator] State changed to: ${SyncLifecycleState[state]}`,
    );
    this._listeners.forEach((listener) => listener(state));
  }

  // ──────────────────────────────────────────────────────────
  // Upload local data (tasks only)
  // ──────────────────────────────────────────────────────────

  private async _uploadLocalData(
    uid: string,
    signal: AbortSignal,
  ): Promise<void> {
    await this._syncLock.acquire();
    try {
      if (signal.aborted) return;

      const tasks = await taskStorage.getTasks();
      const batch = writeBatch(db);

      console.log(
        `[SyncOrchestrator] Preparing to upload ${tasks.length} tasks.`,
      );

      // Write private tasks
      const tasksColPath = userPrivateTasksPath(uid);
      for (const task of tasks) {
        if (signal.aborted) return;
        const taskDocRef = doc(db, tasksColPath, task.id);
        batch.set(
          taskDocRef,
          sanitizeForFirestore({
            ...task,
            createdBy: uid,
            lastModifiedBy: uid,
            syncStatus: "synced",
          }),
        );
      }
      console.log(`[SyncOrchestrator] Added ${tasks.length} tasks to batch.`);

      await batch.commit();
      console.log(`[SyncOrchestrator] Uploaded ${tasks.length} tasks.`);
    } finally {
      this._syncLock.release();
    }
  }

  // ──────────────────────────────────────────────────────────
  // Sync down from Firestore (tasks only)
  // ──────────────────────────────────────────────────────────

  private async _syncDown(uid: string, signal: AbortSignal): Promise<void> {
    await this._syncLock.acquire();
    try {
      if (signal.aborted) return;

      // 1. Ensure user document exists
      console.log(`[SyncOrchestrator] Checking user document: users/${uid}`);
      const userDocRef = doc(db, "users", uid);
      const userDocSnap = await getDoc(userDocRef);
      const userData = userDocSnap.exists() ? userDocSnap.data() : undefined;

      if (!userData) {
        console.log(
          `[SyncOrchestrator] User document not found. Creating for uid: ${uid}`,
        );
        const profile = await userStorage.getUser();
        if (profile && !signal.aborted) {
          await setDoc(
            userDocRef,
            sanitizeForFirestore({
              uid: profile.uid,
              email: profile.email,
              displayName: profile.displayName,
              photoURL: profile.photoURL || null,
              createdAt: FieldValue.serverTimestamp(),
              lastLoginAt: FieldValue.serverTimestamp(),
              isGuest: false,
            }),
          );
          console.log(
            `[SyncOrchestrator] User document created for uid: ${uid}`,
          );
        }
      } else {
        console.log(`[SyncOrchestrator] User document exists for uid: ${uid}`);
      }

      if (signal.aborted) return;

      // 2. Sync private tasks
      console.log(
        `[SyncOrchestrator] Fetching remote private tasks from: ${userPrivateTasksPath(uid)}`,
      );
      const tasksColRef = getCollectionRef(userPrivateTasksPath(uid));
      const taskSnapshot = await getDocs(tasksColRef);
      const remoteTasks: Task[] = [];
      taskSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data.deleted) {
          remoteTasks.push(normalizeTask({ ...data, id: docSnap.id }));
        }
      });

      if (remoteTasks.length > 0 && !signal.aborted) {
        console.log(
          `[SyncOrchestrator] Found ${remoteTasks.length} remote tasks. Merging with local...`,
        );
        await this._mergeTasks(remoteTasks);
        console.log(`[SyncOrchestrator] Tasks merged.`);
      } else {
        console.log(`[SyncOrchestrator] No remote private tasks found.`);
      }

      console.log(`[SyncOrchestrator] syncDown completed successfully.`);
    } finally {
      this._syncLock.release();
    }
  }

  // ──────────────────────────────────────────────────────────
  // Merge operations (called under lock)
  // ──────────────────────────────────────────────────────────

  private async _mergeTasks(remoteTasks: Task[]): Promise<void> {
    const localTasks = await taskStorage.getTasks();
    const localMap = new Map(localTasks.map((t) => [t.id, t]));

    // Build a set of remote task IDs for fast lookup
    const remoteIds = new Set(remoteTasks.map((t) => t.id));

    for (const rt of remoteTasks) {
      const local = localMap.get(rt.id);
      if (!local || rt.updatedAt >= local.updatedAt) {
        localMap.set(rt.id, rt);
      }
    }

    // Remove local tasks that are not present in the remote set.
    // Remote snapshot already excludes tasks marked as `deleted: true`,
    // so any local task missing from the remote set was deleted and
    // should be removed locally as well.
    for (const [localId] of localMap) {
      if (!remoteIds.has(localId)) {
        localMap.delete(localId);
      }
    }

    await taskStorage.saveTasks(Array.from(localMap.values()));
  }

  // ──────────────────────────────────────────────────────────
  // Realtime listeners (tasks only)
  // ──────────────────────────────────────────────────────────

  private async _attachRealtimeListeners(uid: string): Promise<void> {
    // Detach existing listeners first to prevent duplicates
    this._detachRealtimeListeners();

    // Tasks listener
    const tasksColRef = getCollectionRef(userPrivateTasksPath(uid));
    this._taskUnsubscribe = onSnapshot(
      tasksColRef,
      async (snapshot) => {
        console.log(
          `[SyncOrchestrator] Tasks onSnapshot: ${snapshot.docs.length} docs, ${snapshot.docChanges().length} changes`,
        );
        const remoteTasks: Task[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (!data.deleted) {
            remoteTasks.push(normalizeTask({ ...data, id: docSnap.id }));
          }
        });

        if (remoteTasks.length > 0 || snapshot.docChanges().length > 0) {
          await this._mergeTasks(remoteTasks);
        }
      },
      (error) =>
        console.error(`[SyncOrchestrator] Realtime tasks error:`, error),
    );
  }

  private _detachRealtimeListeners(): void {
    if (this._taskUnsubscribe) {
      this._taskUnsubscribe();
      this._taskUnsubscribe = null;
    }
  }

  // ──────────────────────────────────────────────────────────
  // Write-through eligibility check
  // ──────────────────────────────────────────────────────────

  private _canWriteThrough(): boolean {
    return (
      (this._state === SyncLifecycleState.READY ||
        this._state === SyncLifecycleState.REALTIME_READY) &&
      this._uid !== null
    );
  }

  // ──────────────────────────────────────────────────────────
  // Task write-through methods
  // ──────────────────────────────────────────────────────────

  async addTask(task: Task): Promise<void> {
    console.log(`[SyncOrchestrator] addTask: ${task.id}`);
    await taskStorage.addTask(task);

    if (this._canWriteThrough()) {
      try {
        const taskDocRef = getDocRef(userPrivateTasksPath(this._uid!), task.id);
        await setDoc(
          taskDocRef,
          sanitizeForFirestore({
            ...task,
            createdBy: this._uid,
            lastModifiedBy: this._uid,
            syncStatus: "synced",
          }),
        );
        console.log(
          `[SyncOrchestrator] addTask: ${task.id} written to Firestore.`,
        );
      } catch (e) {
        console.error(`[SyncOrchestrator] addTask firestore error:`, e);
      }
    }
  }

  async updateTask(task: Task): Promise<void> {
    console.log(`[SyncOrchestrator] updateTask: ${task.id}`);
    await taskStorage.updateTask(task);

    if (this._canWriteThrough()) {
      try {
        const taskDocRef = getDocRef(userPrivateTasksPath(this._uid!), task.id);
        await setDoc(
          taskDocRef,
          sanitizeForFirestore({
            ...task,
            lastModifiedBy: this._uid,
            updatedAt: Date.now(),
          }),
          { merge: true },
        );
        console.log(
          `[SyncOrchestrator] updateTask: ${task.id} updated in Firestore.`,
        );
      } catch (e) {
        console.error(`[SyncOrchestrator] updateTask firestore error:`, e);
      }
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    console.log(`[SyncOrchestrator] deleteTask: ${taskId}`);
    await taskStorage.deleteTask(taskId);

    if (this._canWriteThrough()) {
      try {
        const taskDocRef = getDocRef(userPrivateTasksPath(this._uid!), taskId);
        await updateDoc(
          taskDocRef,
          sanitizeForFirestore({
            deleted: true,
            updatedAt: Date.now(),
            lastModifiedBy: this._uid,
          }),
        );
        console.log(
          `[SyncOrchestrator] deleteTask: ${taskId} marked as deleted in Firestore.`,
        );
      } catch (e) {
        console.error(`[SyncOrchestrator] deleteTask firestore error:`, e);
      }
    }
  }

  async deleteTasks(taskIds: string[]): Promise<void> {
    console.log(`[SyncOrchestrator] deleteTasks: ${taskIds.length} tasks`);
    await taskStorage.deleteTasks(taskIds);

    if (this._canWriteThrough()) {
      try {
        const batch = writeBatch(db);
        const now = Date.now();
        for (const taskId of taskIds) {
          const taskDocRef = getDocRef(
            userPrivateTasksPath(this._uid!),
            taskId,
          );
          batch.update(
            taskDocRef,
            sanitizeForFirestore({
              deleted: true,
              updatedAt: now,
              lastModifiedBy: this._uid,
            }),
          );
        }
        await batch.commit();
        console.log(
          `[SyncOrchestrator] deleteTasks: ${taskIds.length} tasks marked as deleted in Firestore.`,
        );
      } catch (e) {
        console.error(`[SyncOrchestrator] deleteTasks firestore error:`, e);
      }
    }
  }

  async saveTasks(tasks: Task[]): Promise<void> {
    console.log(`[SyncOrchestrator] saveTasks: ${tasks.length} tasks`);
    await taskStorage.saveTasks(tasks);

    if (this._canWriteThrough()) {
      try {
        const batch = writeBatch(db);
        const tasksColPath = userPrivateTasksPath(this._uid!);
        for (const task of tasks) {
          const taskDocRef = getDocRef(tasksColPath, task.id);
          batch.set(
            taskDocRef,
            sanitizeForFirestore({
              ...task,
              lastModifiedBy: this._uid,
            }),
            { merge: true },
          );
        }
        await batch.commit();
        console.log(
          `[SyncOrchestrator] saveTasks: ${tasks.length} tasks committed to Firestore.`,
        );
      } catch (e) {
        console.error(`[SyncOrchestrator] saveTasks firestore error:`, e);
      }
    }
  }
}

// ────────────────────────────────────────────────────────────
// Singleton export
// ────────────────────────────────────────────────────────────

export const syncOrchestrator = new SyncOrchestrator();
export default syncOrchestrator;
