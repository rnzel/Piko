import {
  pendingDeleteStorage,
  pendingUpsertStorage,
  taskStorage,
  userStorage,
} from "@/services/storageService";
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
  DEGRADED = 6,
  ERROR = 7,
}

// Map internal state to public SyncState for AuthContext
const stateToSyncState: Record<SyncLifecycleState, SyncState> = {
  [SyncLifecycleState.IDLE]: SyncState.IDLE,
  [SyncLifecycleState.AUTHENTICATING]: SyncState.AUTHENTICATING,
  [SyncLifecycleState.UPLOADING_LOCAL]: SyncState.UPLOADING_LOCAL,
  [SyncLifecycleState.HYDRATING]: SyncState.HYDRATING,
  [SyncLifecycleState.REALTIME_READY]: SyncState.REALTIME_READY,
  [SyncLifecycleState.READY]: SyncState.READY,
  [SyncLifecycleState.DEGRADED]: SyncState.DEGRADED,
  [SyncLifecycleState.ERROR]: SyncState.ERROR,
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
      // Keep locked and hand off to next waiter
      // Wrap in try to prevent deadlock if next() throws
      try {
        next();
      } catch (e) {
        // If next throws, we must still release for subsequent waiters
        this.release();
        throw e;
      }
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
  private _lastError: string | null = null;

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

  get lastError(): string | null {
    return this._lastError;
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
      this._lastError = null;
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
    let encounteredRecoverableError = false;

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
        this._lastError = this._formatError(uploadError);
        encounteredRecoverableError = true;
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
        this._lastError = this._formatError(syncError);
        encounteredRecoverableError = true;
        // Continue even if syncDown fails
      }

      // Process any pending deletes that were queued while offline
      try {
        await this._processPendingDeletes();
      } catch (pendingError) {
        console.warn(
          `[SyncOrchestrator] _processPendingDeletes failed:`,
          pendingError,
        );
      }

      // Process any pending upserts that were queued while write-through
      // wasn't available or previously failed.
      try {
        await this._processPendingUpserts();
      } catch (pendingUpsertError) {
        console.warn(
          `[SyncOrchestrator] _processPendingUpserts failed:`,
          pendingUpsertError,
        );
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
      this._setState(
        encounteredRecoverableError
          ? SyncLifecycleState.DEGRADED
          : SyncLifecycleState.READY,
      );
      this._syncLock.release();

      console.log(
        `[SyncOrchestrator] Sync lifecycle complete. System ${encounteredRecoverableError ? "DEGRADED" : "READY"}.`,
      );
    } catch (error) {
      console.error(`[SyncOrchestrator] Initialization error:`, error);
      this._lastError = this._formatError(error);
      await this._syncLock.acquire();
      this._setState(SyncLifecycleState.ERROR);
      this._syncLock.release();
      throw error;
    } finally {
      this._initializationPromise = null;
    }
  }

  private _formatError(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown sync error";
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

    // Phase 1: Merge remote tasks into local map (newer wins)
    // Local-only tasks that have never been uploaded (syncStatus === "local")
    // are NEVER overwritten by remote data, protecting offline-created tasks.
    for (const rt of remoteTasks) {
      const local = localMap.get(rt.id);
      if (!local) {
        // Remote task not present locally — add it
        localMap.set(rt.id, rt);
      } else if (
        local.syncStatus === "synced" ||
        local.syncStatus === "conflict"
      ) {
        // Only overwrite if the task was previously synced (i.e., remote knows about it)
        // and remote is newer
        if (rt.updatedAt >= local.updatedAt) {
          localMap.set(rt.id, { ...rt, syncStatus: "synced" });
        }
      }
      // If local.syncStatus === "local", preserve local version — it hasn't been uploaded yet
    }

    // Phase 2: Remove local tasks that were previously synced but are now absent from remote.
    // This handles the case where another device deleted a synced task.
    // CRITICALLY: Local-only tasks (syncStatus === "local") are NEVER removed,
    // preventing data loss of offline-created tasks.
    for (const [localId, localTask] of localMap) {
      if (!remoteIds.has(localId) && localTask.syncStatus === "synced") {
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

        // After each remote sync, try to process any queued pending deletes.
        // This ensures offline deletes are eventually retried when connectivity returns.
        try {
          await this._processPendingDeletes();
        } catch (pendingError) {
          console.warn(
            `[SyncOrchestrator] _processPendingDeletes after onSnapshot failed:`,
            pendingError,
          );
        }

        // Also retry queued add/update writes after remote sync events
        try {
          await this._processPendingUpserts();
        } catch (pendingUpsertError) {
          console.warn(
            `[SyncOrchestrator] _processPendingUpserts after onSnapshot failed:`,
            pendingUpsertError,
          );
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
  // Pending deletes processing
  // ──────────────────────────────────────────────────────────

  /**
   * Process any pending deletes that were queued while offline.
   * Retries marking them as deleted in Firestore.
   */
  private async _processPendingDeletes(): Promise<void> {
    const pendingIds = await pendingDeleteStorage.getPendingDeleteIds();
    if (pendingIds.length === 0) {
      return;
    }

    console.log(
      `[SyncOrchestrator] Processing ${pendingIds.length} pending deletes...`,
    );

    if (!this._uid) {
      console.log(`[SyncOrchestrator] No UID set, skipping pending deletes.`);
      return;
    }

    const successfullyDeleted: string[] = [];
    for (const taskId of pendingIds) {
      try {
        const taskDocRef = getDocRef(userPrivateTasksPath(this._uid), taskId);
        await setDoc(
          taskDocRef,
          sanitizeForFirestore({
            deleted: true,
            updatedAt: Date.now(),
            lastModifiedBy: this._uid,
          }),
          { merge: true },
        );
        successfullyDeleted.push(taskId);
        console.log(
          `[SyncOrchestrator] Pending delete processed for task: ${taskId}`,
        );
      } catch (e) {
        console.warn(
          `[SyncOrchestrator] Failed to process pending delete for task ${taskId}, will retry later:`,
          e,
        );
      }
    }

    // Remove successfully synced deletes from the queue
    for (const taskId of successfullyDeleted) {
      await pendingDeleteStorage.removePendingDeleteId(taskId);
    }

    if (successfullyDeleted.length > 0) {
      console.log(
        `[SyncOrchestrator] Processed ${successfullyDeleted.length}/${pendingIds.length} pending deletes.`,
      );
    }
  }

  /**
   * Process queued add/update writes that failed earlier or happened before
   * write-through was available.
   */
  private async _processPendingUpserts(): Promise<void> {
    const pendingIds = await pendingUpsertStorage.getPendingUpsertIds();
    if (pendingIds.length === 0) {
      return;
    }

    if (!this._uid || !this._canWriteThrough()) {
      console.log(
        `[SyncOrchestrator] Skipping pending upserts: canWriteThrough=${this._canWriteThrough()} uid=${this._uid}`,
      );
      return;
    }

    console.log(
      `[SyncOrchestrator] Processing ${pendingIds.length} pending upserts...`,
    );

    const localTasks = await taskStorage.getTasks();
    const taskMap = new Map(localTasks.map((t) => [t.id, t]));
    const successfullyUpserted: string[] = [];

    for (const taskId of pendingIds) {
      const task = taskMap.get(taskId);
      if (!task) {
        // Task no longer exists locally (possibly deleted) — remove from queue
        successfullyUpserted.push(taskId);
        continue;
      }

      try {
        const taskDocRef = getDocRef(userPrivateTasksPath(this._uid), task.id);
        await setDoc(
          taskDocRef,
          sanitizeForFirestore({
            ...task,
            createdBy: this._uid,
            lastModifiedBy: this._uid,
            syncStatus: "synced",
            updatedAt: Date.now(),
          }),
          { merge: true },
        );
        successfullyUpserted.push(taskId);
      } catch (e) {
        console.warn(
          `[SyncOrchestrator] Failed pending upsert for task ${taskId}, will retry later:`,
          e,
        );
      }
    }

    for (const taskId of successfullyUpserted) {
      await pendingUpsertStorage.removePendingUpsertId(taskId);
    }

    if (successfullyUpserted.length > 0) {
      console.log(
        `[SyncOrchestrator] Processed ${successfullyUpserted.length}/${pendingIds.length} pending upserts.`,
      );
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
        await pendingUpsertStorage.removePendingUpsertId(task.id);
      } catch (e) {
        console.error(
          `[SyncOrchestrator] addTask firestore error (uid=${this._uid}, state=${SyncLifecycleState[this._state]}):`,
          e,
        );
        await pendingUpsertStorage.addPendingUpsertId(task.id);
      }
    } else {
      console.log(
        `[SyncOrchestrator] addTask queued for upsert retry (canWriteThrough=${this._canWriteThrough()}, uid=${this._uid}, state=${SyncLifecycleState[this._state]}).`,
      );
      await pendingUpsertStorage.addPendingUpsertId(task.id);
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
        await pendingUpsertStorage.removePendingUpsertId(task.id);
      } catch (e) {
        console.error(
          `[SyncOrchestrator] updateTask firestore error (uid=${this._uid}, state=${SyncLifecycleState[this._state]}):`,
          e,
        );
        await pendingUpsertStorage.addPendingUpsertId(task.id);
      }
    } else {
      console.log(
        `[SyncOrchestrator] updateTask queued for upsert retry (canWriteThrough=${this._canWriteThrough()}, uid=${this._uid}, state=${SyncLifecycleState[this._state]}).`,
      );
      await pendingUpsertStorage.addPendingUpsertId(task.id);
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    console.log(`[SyncOrchestrator] deleteTask: ${taskId}`);
    await taskStorage.deleteTask(taskId);

    // Always try to write-through to Firestore if possible.
    // If it fails (offline), queue for later retry.
    let firestoreSucceeded = false;
    if (this._canWriteThrough()) {
      try {
        const taskDocRef = getDocRef(userPrivateTasksPath(this._uid!), taskId);
        await setDoc(
          taskDocRef,
          sanitizeForFirestore({
            deleted: true,
            updatedAt: Date.now(),
            lastModifiedBy: this._uid,
          }),
          { merge: true },
        );
        console.log(
          `[SyncOrchestrator] deleteTask: ${taskId} marked as deleted in Firestore.`,
        );
        firestoreSucceeded = true;
      } catch (e) {
        console.error(`[SyncOrchestrator] deleteTask firestore error:`, e);
      }
    }

    // If write-through wasn't attempted or failed, queue for later retry
    if (!firestoreSucceeded) {
      console.log(
        `[SyncOrchestrator] deleteTask: ${taskId} queued for later sync.`,
      );
      await pendingDeleteStorage.addPendingDeleteId(taskId);
    }
  }

  async deleteTasks(taskIds: string[]): Promise<void> {
    console.log(`[SyncOrchestrator] deleteTasks: ${taskIds.length} tasks`);
    await taskStorage.deleteTasks(taskIds);

    let firestoreSucceeded = false;
    if (this._canWriteThrough()) {
      try {
        const batch = writeBatch(db);
        const now = Date.now();
        for (const taskId of taskIds) {
          const taskDocRef = getDocRef(
            userPrivateTasksPath(this._uid!),
            taskId,
          );
          batch.set(
            taskDocRef,
            sanitizeForFirestore({
              deleted: true,
              updatedAt: now,
              lastModifiedBy: this._uid,
            }),
            { merge: true },
          );
        }
        await batch.commit();
        console.log(
          `[SyncOrchestrator] deleteTasks: ${taskIds.length} tasks marked as deleted in Firestore.`,
        );
        firestoreSucceeded = true;
      } catch (e) {
        console.error(`[SyncOrchestrator] deleteTasks firestore error:`, e);
      }
    }

    // If write-through wasn't attempted or failed, queue for later retry
    if (!firestoreSucceeded) {
      console.log(
        `[SyncOrchestrator] deleteTasks: ${taskIds.length} tasks queued for later sync.`,
      );
      for (const taskId of taskIds) {
        await pendingDeleteStorage.addPendingDeleteId(taskId);
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
