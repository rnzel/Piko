import {
  groupStorage,
  membershipStorage,
  taskStorage,
  userStorage,
} from "@/services/storageService";
import { Group, GroupMember, Membership, SyncState, Task } from "@/types";
import { normalizeMemberships } from "@/utils/normalizeMembership";
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
// Collection path helpers (unchanged - paths are the same)
// ────────────────────────────────────────────────────────────

const userDocPath = (uid: string) => `users/${uid}`;
const userPrivateTasksPath = (uid: string) => `users/${uid}/private_tasks`;
const userMembershipsPath = (uid: string) => `users/${uid}/memberships`;
const groupsPath = `groups`;
const groupMembersPath = (groupId: string) => `groups/${groupId}/members`;
const invitationsPath = `invitations`;
const groupActivityPath = (groupId: string) => `groups/${groupId}/activity`;

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
  private _groupUnsubscribe: (() => void) | null = null;
  private _lastMembershipDocCount: number | null = null;

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
        const localGroups = await groupStorage.getGroups();

        if (localTasks.length > 0 || localGroups.length > 0) {
          console.log(
            `[SyncOrchestrator] Uploading ${localTasks.length} tasks and ${localGroups.length} groups...`,
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
  // Upload local data
  // ──────────────────────────────────────────────────────────

  private async _uploadLocalData(
    uid: string,
    signal: AbortSignal,
  ): Promise<void> {
    await this._syncLock.acquire();
    try {
      if (signal.aborted) return;

      const tasks = await taskStorage.getTasks();
      const groups = await groupStorage.getGroups();
      const batch = writeBatch(db);

      console.log(
        `[SyncOrchestrator] Preparing to upload ${tasks.length} tasks and ${groups.length} groups.`,
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

      // Write groups + creator memberships
      for (const group of groups) {
        if (signal.aborted) return;

        const groupRef = getDocRef(groupsPath, group.id);
        batch.set(
          groupRef,
          sanitizeForFirestore({
            ...group,
            memberCount: group.memberCount || 1,
          }),
        );

        const memberRef = getDocRef(groupMembersPath(group.id), uid);
        const userProfile = await userStorage.getUser();
        batch.set(
          memberRef,
          sanitizeForFirestore({
            uid,
            email: userProfile?.email || "",
            displayName: userProfile?.displayName || "",
            role: "owner",
            joinedAt: Date.now(),
            notificationsEnabled: true,
          }),
        );

        const membershipRef = getDocRef(userMembershipsPath(uid), group.id);
        batch.set(
          membershipRef,
          sanitizeForFirestore({
            groupId: group.id,
            groupName: group.name,
            groupCode: group.code,
            role: "owner",
            joinedAt: Date.now(),
          }),
        );
      }
      console.log(
        `[SyncOrchestrator] Added ${groups.length} groups and memberships to batch.`,
      );

      await batch.commit();
      console.log(
        `[SyncOrchestrator] Uploaded ${tasks.length} tasks and ${groups.length} groups.`,
      );
    } finally {
      this._syncLock.release();
    }
  }

  // ──────────────────────────────────────────────────────────
  // Sync down from Firestore
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

      if (signal.aborted) return;

      // 3. Sync memberships + groups
      console.log(
        `[SyncOrchestrator] Fetching remote memberships from: ${userMembershipsPath(uid)}`,
      );
      const membershipsColRef = getCollectionRef(userMembershipsPath(uid));
      const membershipSnapshot = await getDocs(membershipsColRef);
      const rawMemberships: any[] = [];
      membershipSnapshot.forEach((docSnap) => {
        const data = docSnap.data() as Membership;
        rawMemberships.push({ ...data, groupId: docSnap.id });
      });

      const memberships = normalizeMemberships(rawMemberships);

      // Persist normalized memberships even if empty; reconciliation behavior
      // is handled by _mergeMemberships safety guards.
      await membershipStorage.saveMemberships(uid, memberships);

      if (!signal.aborted) {
        console.log(
          `[SyncOrchestrator] syncDown memberships normalized count: ${memberships.length}. Reconciling groups...`,
        );
        await this._mergeMemberships(uid, memberships, {
          source: "syncDown",
          remoteDocCount: membershipSnapshot.size,
          allowEmptyRemoteReplace: false,
        });
        console.log(`[SyncOrchestrator] Memberships merged.`);
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

  private async _mergeMemberships(
    uid: string,
    memberships: Membership[],
    options?: {
      source?: "syncDown" | "realtime";
      remoteDocCount?: number;
      allowEmptyRemoteReplace?: boolean;
    },
  ): Promise<void> {
    const normalizedMemberships = normalizeMemberships(memberships);
    const localMemberships = await membershipStorage.getMemberships(uid);
    const localMembershipIds = new Set(localMemberships.map((m) => m.groupId));
    const normalizedRemoteIds = new Set(
      normalizedMemberships.map((m) => m.groupId),
    );

    const remoteDocCount =
      options?.remoteDocCount ?? normalizedMemberships.length;
    const allowEmptyRemoteReplace = options?.allowEmptyRemoteReplace === true;

    // Guard against destructive overwrite during transient empty/partial snapshots.
    const hasLocalMemberships = localMemberships.length > 0;
    const isRemoteEmpty = normalizedMemberships.length === 0;
    const shouldProtectLocalFromEmpty =
      hasLocalMemberships && isRemoteEmpty && !allowEmptyRemoteReplace;

    if (shouldProtectLocalFromEmpty) {
      console.warn(
        `[SyncOrchestrator] Membership merge guard (${options?.source ?? "unknown"}): remote empty while local has ${localMemberships.length}. Preserving local memberships/groups.`,
      );
      return;
    }

    // If remote set is a strict subset of local, treat as potentially partial during
    // uncertain sync windows and avoid destructive local replacement.
    const isRemoteStrictSubsetOfLocal =
      normalizedMemberships.length > 0 &&
      normalizedMemberships.length < localMemberships.length &&
      Array.from(normalizedRemoteIds).every((id) => localMembershipIds.has(id));

    if (isRemoteStrictSubsetOfLocal && !allowEmptyRemoteReplace) {
      console.warn(
        `[SyncOrchestrator] Membership merge guard (${options?.source ?? "unknown"}): remote subset (${normalizedMemberships.length}/${localMemberships.length}). Preserving local until stable snapshot.`,
      );
      return;
    }

    const groupIds = normalizedMemberships.map((m) => m.groupId);
    const groups: Group[] = [];

    for (const gid of groupIds) {
      try {
        const groupDocRef = getDocRef(groupsPath, gid);
        const groupDocSnap = await getDoc(groupDocRef);
        if (groupDocSnap.exists()) {
          const data = groupDocSnap.data() as Group;
          groups.push({ ...data, id: groupDocSnap.id });
        }
      } catch (e) {
        console.warn(`[SyncOrchestrator] Failed to fetch group ${gid}:`, e);
      }
    }

    // If remote fetch failed to resolve any group docs while memberships exist,
    // avoid wiping local groups as this likely indicates transient inconsistency.
    if (
      groupIds.length > 0 &&
      groups.length === 0 &&
      !allowEmptyRemoteReplace
    ) {
      console.warn(
        `[SyncOrchestrator] Membership merge guard (${options?.source ?? "unknown"}): 0/${groupIds.length} groups resolved. Preserving local groups.`,
      );
      return;
    }

    // Save normalized memberships before updating groups to keep entity lifecycle stable.
    await membershipStorage.saveMemberships(uid, normalizedMemberships);

    if (groups.length > 0 || remoteDocCount === 0 || allowEmptyRemoteReplace) {
      await groupStorage.saveGroups(groups);
    }
  }

  // ──────────────────────────────────────────────────────────
  // Realtime listeners
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

    // Groups/memberships listener
    const membershipsColRef = getCollectionRef(userMembershipsPath(uid));
    this._groupUnsubscribe = onSnapshot(
      membershipsColRef,
      async (snapshot) => {
        console.log(
          `[SyncOrchestrator] Memberships onSnapshot: ${snapshot.docs.length} docs, ${snapshot.docChanges().length} changes`,
        );
        const rawMemberships: any[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Membership;
          rawMemberships.push({ ...data, groupId: docSnap.id });
        });

        const memberships = normalizeMemberships(rawMemberships);
        await membershipStorage.saveMemberships(uid, memberships);

        // Realtime safety guard: ignore first empty snapshot if we previously had docs,
        // as it can be transient during listener attach/reconnect.
        if (
          snapshot.size === 0 &&
          this._lastMembershipDocCount &&
          this._lastMembershipDocCount > 0
        ) {
          console.warn(
            `[SyncOrchestrator] Realtime memberships guard: transient empty snapshot detected after previously having ${this._lastMembershipDocCount} docs. Skipping destructive merge.`,
          );
          return;
        }

        this._lastMembershipDocCount = snapshot.size;

        if (snapshot.docChanges().length > 0 || memberships.length > 0) {
          await this._mergeMemberships(uid, memberships, {
            source: "realtime",
            remoteDocCount: snapshot.size,
            allowEmptyRemoteReplace: false,
          });
        }
      },
      (error) =>
        console.error(`[SyncOrchestrator] Realtime groups error:`, error),
    );
  }

  private _detachRealtimeListeners(): void {
    if (this._taskUnsubscribe) {
      this._taskUnsubscribe();
      this._taskUnsubscribe = null;
    }
    if (this._groupUnsubscribe) {
      this._groupUnsubscribe();
      this._groupUnsubscribe = null;
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

// ──────────────────────────────────────────────────────────
   // Group write-through methods
   // ──────────────────────────────────────────────────────────

   async addGroup(group: Group, creatorRole: GroupMember): Promise<{ success: boolean; error?: string }> {
     console.log(`[SyncOrchestrator] addGroup: ${group.id}`);
     await groupStorage.addGroup(group);

     if (this._canWriteThrough()) {
       try {
         const batch = writeBatch(db);

         const groupRef = getDocRef(groupsPath, group.id);
         batch.set(
           groupRef,
           sanitizeForFirestore({ ...group, memberCount: 1, isArchived: false }),
         );

         const memberRef = getDocRef(groupMembersPath(group.id), this._uid!);
         batch.set(memberRef, sanitizeForFirestore(creatorRole));

         const membershipRef = getDocRef(
           userMembershipsPath(this._uid!),
           group.id,
         );
         batch.set(
           membershipRef,
           sanitizeForFirestore({
             groupId: group.id,
             groupName: group.name,
             groupCode: group.code,
             role: creatorRole.role,
             joinedAt: creatorRole.joinedAt,
           }),
         );

         await batch.commit();
         console.log(
           `[SyncOrchestrator] addGroup: ${group.id} committed to Firestore.`,
         );
         return { success: true };
       } catch (e) {
         console.error(`[SyncOrchestrator] addGroup firestore error:`, e);
         return { success: false, error: String(e) };
       }
     } else {
       console.warn(
         `[SyncOrchestrator] addGroup: Skipping Firestore write - orchestrator not ready. State: ${SyncLifecycleState[this._state]}, UID: ${this._uid}`,
       );
       return { success: false, error: "Sync not ready - group saved locally only" };
     }
   }

  async updateGroup(group: Group): Promise<void> {
    console.log(`[SyncOrchestrator] updateGroup: ${group.id}`);
    await groupStorage.updateGroup(group);

    if (this._canWriteThrough()) {
      try {
        const groupRef = getDocRef(groupsPath, group.id);
        await setDoc(
          groupRef,
          sanitizeForFirestore({ ...group, updatedAt: Date.now() }),
          {
            merge: true,
          },
        );
        console.log(
          `[SyncOrchestrator] updateGroup: ${group.id} updated in Firestore.`,
        );
      } catch (e) {
        console.error(`[SyncOrchestrator] updateGroup firestore error:`, e);
      }
    }
  }

  async deleteGroup(groupId: string): Promise<void> {
    console.log(`[SyncOrchestrator] deleteGroup: ${groupId}`);
    await groupStorage.deleteGroup(groupId);

    if (this._canWriteThrough()) {
      try {
        const batch = writeBatch(db);

        const groupRef = getDocRef(groupsPath, groupId);
        batch.update(groupRef, {
          isArchived: true,
          memberCount: 0,
          updatedAt: Date.now(),
        });

        // Delete all group members + denormalized memberships for lifecycle integrity.
        const membersColRef = getCollectionRef(groupMembersPath(groupId));
        const membersSnapshot = await getDocs(membersColRef);
        membersSnapshot.forEach((memberDoc) => {
          const memberUid = memberDoc.id;
          const memberRef = getDocRef(groupMembersPath(groupId), memberUid);
          batch.delete(memberRef);

          const membershipRef = getDocRef(
            userMembershipsPath(memberUid),
            groupId,
          );
          batch.delete(membershipRef);
        });

        await batch.commit();
        console.log(
          `[SyncOrchestrator] deleteGroup: ${groupId} archived and memberships cleaned up.`,
        );
      } catch (e) {
        console.error(`[SyncOrchestrator] deleteGroup firestore error:`, e);
      }
    }
  }

  async saveGroups(groups: Group[]): Promise<void> {
    console.log(`[SyncOrchestrator] saveGroups: ${groups.length} groups`);
    await groupStorage.saveGroups(groups);

    if (this._canWriteThrough()) {
      try {
        const batch = writeBatch(db);
        for (const group of groups) {
          const groupRef = getDocRef(groupsPath, group.id);
          batch.set(groupRef, sanitizeForFirestore(group), { merge: true });
        }
        await batch.commit();
        console.log(
          `[SyncOrchestrator] saveGroups: ${groups.length} groups committed to Firestore.`,
        );
      } catch (e) {
        console.error(`[SyncOrchestrator] saveGroups firestore error:`, e);
      }
    }
  }

  // ──────────────────────────────────────────────────────────
  // Group member write-through methods
  // ──────────────────────────────────────────────────────────

  async addGroupMember(
    groupId: string,
    member: GroupMember,
    options?: {
      skipGroupCountUpdate?: boolean;
    },
  ): Promise<void> {
    if (!this._uid) return;

    try {
      const batch = writeBatch(db);

      const memberRef = getDocRef(groupMembersPath(groupId), member.uid);
      batch.set(memberRef, sanitizeForFirestore(member));

      const groupDocRef = getDocRef(groupsPath, groupId);
      const groupDocSnap = await getDoc(groupDocRef);
      const groupData = groupDocSnap.exists()
        ? (groupDocSnap.data() as Group)
        : undefined;

      if (groupData) {
        const membershipRef = getDocRef(
          userMembershipsPath(member.uid),
          groupId,
        );
        batch.set(
          membershipRef,
          sanitizeForFirestore({
            groupId,
            groupName: groupData.name,
            groupCode: groupData.code,
            role: member.role,
            joinedAt: member.joinedAt,
          }),
        );

        if (!options?.skipGroupCountUpdate) {
          batch.update(groupDocRef, {
            memberCount: FieldValue.increment(1),
          });
        }
      }

      await batch.commit();
    } catch (e) {
      console.error(`[SyncOrchestrator] addGroupMember firestore error:`, e);
    }
  }

  async removeGroupMember(groupId: string, memberUid: string): Promise<void> {
    if (!this._uid) return;

    try {
      const batch = writeBatch(db);

      const memberRef = getDocRef(groupMembersPath(groupId), memberUid);
      batch.delete(memberRef);

      const membershipRef = getDocRef(userMembershipsPath(memberUid), groupId);
      batch.delete(membershipRef);

      const groupRef = getDocRef(groupsPath, groupId);
      batch.update(groupRef, {
        memberCount: FieldValue.increment(-1),
      });

      await batch.commit();
    } catch (e) {
      console.error(`[SyncOrchestrator] removeGroupMember firestore error:`, e);
    }
  }

  async updateGroupMemberRole(
    groupId: string,
    memberUid: string,
    role: GroupMember["role"],
  ): Promise<void> {
    if (!this._uid) return;

    try {
      const memberRef = getDocRef(groupMembersPath(groupId), memberUid);
      await updateDoc(memberRef, sanitizeForFirestore({ role }));
    } catch (e) {
      console.error(
        `[SyncOrchestrator] updateGroupMemberRole firestore error:`,
        e,
      );
    }
  }

  // ──────────────────────────────────────────────────────────
  // Invitation write-through methods
  // ──────────────────────────────────────────────────────────

  async createInvitation(invitation: {
    id: string;
    groupId: string;
    groupName: string;
    groupCode: string;
    invitedByUid: string;
    invitedByDisplayName: string;
    invitedEmail: string;
    message?: string;
  }): Promise<void> {
    if (!this._uid) return;

    try {
      const invitationRef = getDocRef(invitationsPath, invitation.id);
      await setDoc(
        invitationRef,
        sanitizeForFirestore({
          ...invitation,
          invitedUid: null,
          status: "pending",
          createdAt: Date.now(),
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        }),
      );
    } catch (e) {
      console.error(`[SyncOrchestrator] createInvitation firestore error:`, e);
    }
  }

  async acceptInvitation(
    invitationId: string,
    groupId: string,
    uid: string,
  ): Promise<void> {
    if (!this._uid) return;

    try {
      const batch = writeBatch(db);

      const invitationRef = getDocRef(invitationsPath, invitationId);
      batch.update(invitationRef, {
        status: "accepted",
        invitedUid: uid,
      });

      const memberRef = getDocRef(groupMembersPath(groupId), uid);
      batch.set(
        memberRef,
        sanitizeForFirestore({
          uid,
          role: "member",
          joinedAt: Date.now(),
          invitedBy: this._uid,
          notificationsEnabled: true,
        }),
      );

      const groupRef = getDocRef(groupsPath, groupId);
      batch.update(groupRef, {
        memberCount: FieldValue.increment(1),
      });

      await batch.commit();
    } catch (e) {
      console.error(`[SyncOrchestrator] acceptInvitation firestore error:`, e);
    }
  }

  // ──────────────────────────────────────────────────────────
  // Activity logging
  // ──────────────────────────────────────────────────────────

  async logActivity(
    groupId: string,
    activity: {
      type: string;
      actorUid: string;
      actorName: string;
      targetId?: string;
      targetText?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<void> {
    if (!this._uid) return;

    try {
      const activityRef = getDocRef(
        groupActivityPath(groupId),
        `${Date.now()}_${activity.actorUid}`,
      );
      await setDoc(
        activityRef,
        sanitizeForFirestore({
          ...activity,
          createdAt: Date.now(),
        }),
      );
    } catch (e) {
      console.error(`[SyncOrchestrator] logActivity firestore error:`, e);
    }
  }
}

// ────────────────────────────────────────────────────────────
// Singleton export
// ────────────────────────────────────────────────────────────

export const syncOrchestrator = new SyncOrchestrator();
export default syncOrchestrator;
