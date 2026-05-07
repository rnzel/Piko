import {
  groupStorage,
  taskStorage,
  userStorage,
} from "@/services/storageService";
import { Group, GroupMember, Membership, Task, SyncState } from "@/types";
import firestore from "@react-native-firebase/firestore";
import { sanitizeForFirestore } from "./serialization";

let _uid: string | null = null;
let _initialized = false;
let _syncInProgress = false;
let _currentSyncState: SyncState = SyncState.IDLE;

// Unsubscribe functions for real-time listeners
let _taskUnsubscribe: (() => void) | null = null;
let _groupUnsubscribe: (() => void) | null = null;

// In-memory cache for memberships during a session
const _membershipCache: Map<string, Membership[]> = new Map();
const _groupCache: Map<string, Group[]> = new Map();

// Firestore collection path helpers
const userDocPath = (uid: string) => `users/${uid}`;
const userPrivateTasksPath = (uid: string) => `users/${uid}/private_tasks`;
const userMembershipsPath = (uid: string) => `users/${uid}/memberships`;
const groupsPath = `groups`;
const groupMembersPath = (groupId: string) => `groups/${groupId}/members`;
const groupActivityPath = (groupId: string) => `groups/${groupId}/activity`;
const invitationsPath = `invitations`;

const isAuthenticated = (): boolean => !!_uid;

export const syncFacade = {
  /** Call after sign-in to enable Firestore sync */
  initialize(uid: string): void {
    _uid = uid;
    _initialized = true;
    _syncInProgress = false;
    _currentSyncState = SyncState.UPLOADING_LOCAL;
    console.log(
      `[syncFacade] initialized for uid=${uid}, state: ${_currentSyncState}`,
    );
  },

  /** Call on sign-out */
  deinitialize(): void {
    this.unsubscribeRealtime();
    _uid = null;
    _initialized = false;
    _syncInProgress = false;
    _membershipCache.clear();
    _groupCache.clear();
    _currentSyncState = SyncState.IDLE;
    console.log("[syncFacade] deinitialized, state: " + _currentSyncState);
  },

  get isInitialized(): boolean {
    return _initialized;
  },

  get currentUid(): string | null {
    return _uid;
  },

  get currentSyncState(): SyncState {
    return _currentSyncState;
  },

  // ────────────────────────────────
  //  Real-time listeners
  // ────────────────────────────────

  subscribeRealtime(): void {
    if (!_uid) return;
    this.unsubscribeRealtime();
    _currentSyncState = SyncState.REALTIME_READY;
    console.log(
      `[syncFacade] subscribing to real-time updates, state: ${_currentSyncState}`,
    );

    _taskUnsubscribe = firestore()
      .collection(userPrivateTasksPath(_uid))
      .onSnapshot(
        async (snapshot) => {
          console.log(
            `[syncFacade] tasks onSnapshot: ${snapshot.docs.length} docs, ${snapshot.docChanges().length} changes. Current sync state: ${_currentSyncState}`,
          );
          const remoteTasks: Task[] = snapshot.docs
            .map((doc) => ({
              ...(doc.data() as Task),
              id: doc.id,
            }))
            .filter((t) => !t.deleted);

          if (remoteTasks.length > 0 || snapshot.docChanges().length > 0) {
            const localTasks = await taskStorage.getTasks();
            const localMap = new Map(localTasks.map((t) => [t.id, t]));

            console.log(
              `[syncFacade] before tasks merge - local: ${localTasks.length}, remote: ${remoteTasks.length}`,
            );

            for (const rt of remoteTasks) {
              const local = localMap.get(rt.id);
              if (!local || rt.updatedAt >= local.updatedAt) {
                localMap.set(rt.id, rt);
              }
            }
            await taskStorage.saveTasks(Array.from(localMap.values()));
            console.log(
              `[syncFacade] after tasks merge - local storage has: ${Array.from(localMap.values()).length} tasks`,
            );
          }
        },
        (error) => console.error("[syncFacade] realtime tasks error:", error),
      );

    _groupUnsubscribe = firestore()
      .collection(userMembershipsPath(_uid))
      .onSnapshot(
        async (snapshot) => {
          console.log(
            `[syncFacade] groups onSnapshot: ${snapshot.docs.length} docs, ${snapshot.docChanges().length} changes. Current sync state: ${_currentSyncState}`,
          );
          const memberships: Membership[] = snapshot.docs.map((doc) => ({
            ...(doc.data() as Membership),
            groupId: doc.id,
          }));

          if (memberships.length > 0 || snapshot.docChanges().length > 0) {
            _membershipCache.set(_uid!, memberships);

            const groupIds = memberships.map((m) => m.groupId);
            const groups: Group[] = [];
            for (const gid of groupIds) {
              try {
                const doc = await firestore()
                  .collection(groupsPath)
                  .doc(gid)
                  .get();
                const data = doc.data();
                if (data) {
                  groups.push({ ...(data as Group), id: doc.id });
                }
              } catch (e) {
                console.warn(`[syncFacade] failed to fetch group ${gid}:`, e);
              }
            }
            _groupCache.set(_uid!, groups);
            await groupStorage.saveGroups(groups);
          }
        },
        (error) => console.error("[syncFacade] realtime groups error:", error),
      );
  },

  unsubscribeRealtime(): void {
    if (_taskUnsubscribe) {
      _taskUnsubscribe();
      _taskUnsubscribe = null;
    }
    if (_groupUnsubscribe) {
      _groupUnsubscribe();
      _groupUnsubscribe = null;
    }
  },

  // ────────────────────────────────
  //  Initial sync (pull + push)
  // ────────────────────────────────

  async syncDown(): Promise<void> {
    if (!_uid || _syncInProgress) {
      console.log(
        `[syncFacade] syncDown skipped. uid: ${_uid}, syncInProgress: ${_syncInProgress}`,
      );
      return;
    }
    _syncInProgress = true;
    _currentSyncState = SyncState.HYDRATING;
    console.log(
      `[syncFacade] syncDown started for uid: ${_uid}, state: ${_currentSyncState}`,
    );

    try {
      // 1. Ensure user document exists
      console.log(`[syncFacade] Checking user document: ${userDocPath(_uid)}`);
      const userDoc = await firestore().doc(userDocPath(_uid)).get();
      const userData = userDoc.data();
      if (!userData) {
        console.log(
          `[syncFacade] User document not found. Creating for uid: ${_uid}`,
        );
         const profile = await userStorage.getUser();
         if (profile) {
           await firestore()
             .doc(userDocPath(_uid))
             .set(
               sanitizeForFirestore({
                 uid: profile.uid,
                 email: profile.email,
                 displayName: profile.displayName,
                 photoURL: profile.photoURL || null,
                 createdAt: firestore.FieldValue.serverTimestamp(),
                 lastLoginAt: firestore.FieldValue.serverTimestamp(),
                 isGuest: false,
               })
             );
          console.log(`[syncFacade] User document created for uid: ${_uid}`);
        }
      } else {
        console.log(`[syncFacade] User document exists for uid: ${_uid}`);
      }

      // 2. Sync private tasks
      console.log(
        `[syncFacade] Fetching remote private tasks from: ${userPrivateTasksPath(_uid)}`,
      );
      const taskSnapshot = await firestore()
        .collection(userPrivateTasksPath(_uid))
        .get();
      const remoteTasks: Task[] = taskSnapshot.docs
        .map((doc) => ({ ...(doc.data() as Task), id: doc.id }))
        .filter((t) => !t.deleted);

      if (remoteTasks.length > 0) {
        console.log(
          `[syncFacade] Found ${remoteTasks.length} remote tasks. Merging with local...`,
        );
        const localTasks = await taskStorage.getTasks();
        const localMap = new Map(localTasks.map((t) => [t.id, t]));
        for (const rt of remoteTasks) {
          const local = localMap.get(rt.id);
          if (!local || rt.updatedAt >= local.updatedAt) {
            localMap.set(rt.id, rt);
          }
        }
        await taskStorage.saveTasks(Array.from(localMap.values()));
        console.log(
          `[syncFacade] Merged remote tasks. Local storage now has ${Array.from(localMap.values()).length} tasks.`,
        );
      } else {
        console.log("[syncFacade] No remote private tasks found.");
      }

      // 3. Sync memberships + groups
      console.log(
        `[syncFacade] Fetching remote memberships from: ${userMembershipsPath(_uid)}`,
      );
      const membershipSnapshot = await firestore()
        .collection(userMembershipsPath(_uid))
        .get();
      const memberships: Membership[] = membershipSnapshot.docs.map((doc) => ({
        ...(doc.data() as Membership),
        groupId: doc.id,
      }));

      if (memberships.length > 0) {
        console.log(
          `[syncFacade] Found ${memberships.length} remote memberships. Fetching groups...`,
        );
        _membershipCache.set(_uid, memberships);
        const groupIds = memberships.map((m) => m.groupId);
        const groups: Group[] = [];
        for (const gid of groupIds) {
          try {
            const doc = await firestore().collection(groupsPath).doc(gid).get();
            const data = doc.data();
            if (data) {
              groups.push({ ...(data as Group), id: doc.id });
            }
          } catch (e) {
            console.warn(`[syncFacade] failed to fetch group ${gid}:`, e);
          }
        }
        _groupCache.set(_uid, groups);
        await groupStorage.saveGroups(groups);
        console.log(
          `[syncFacade] Synced ${groups.length} groups. Local storage updated.`,
        );
      } else {
        console.log("[syncFacade] No remote memberships found.");
      }
      console.log("[syncFacade] syncDown completed successfully.");
    } catch (e) {
      console.error("[syncFacade] syncDown error", e);
    } finally {
      _syncInProgress = false;
    }
  },

  async uploadLocalData(): Promise<void> {
    if (!_uid || _syncInProgress) {
      console.log(
        `[syncFacade] uploadLocalData skipped. uid: ${_uid}, syncInProgress: ${_syncInProgress}`,
      );
      return;
    }
    _syncInProgress = true;
    // State for upload is set in AuthContext before calling this
    console.log(
      `[syncFacade] uploadLocalData started for uid: ${_uid}, state: ${_currentSyncState}`,
    );

    try {
      const tasks = await taskStorage.getTasks();
      const groups = await groupStorage.getGroups();
      const batch = firestore().batch();

      console.log(
        `[syncFacade] Preparing to upload ${tasks.length} tasks and ${groups.length} groups.`,
      );

       // Write private tasks
       const tasksCol = firestore().collection(userPrivateTasksPath(_uid));
       for (const task of tasks) {
         batch.set(tasksCol.doc(task.id), 
           sanitizeForFirestore({
             ...task,
             createdBy: _uid,
             lastModifiedBy: _uid,
             syncStatus: "synced",
           })
         );
       }
      console.log(
        `[syncFacade] Added ${tasks.length} tasks to batch for upload.`,
      );

       // Write groups + creator memberships
       for (const group of groups) {
         const groupRef = firestore().collection(groupsPath).doc(group.id);
         batch.set(groupRef, 
           sanitizeForFirestore({
             ...group,
             memberCount: group.memberCount || 1,
           })
         );

         const memberRef = firestore()
           .collection(groupMembersPath(group.id))
           .doc(_uid);
         batch.set(memberRef, 
           sanitizeForFirestore({
             uid: _uid,
             email: (await userStorage.getUser())?.email || "",
             displayName: (await userStorage.getUser())?.displayName || "",
             role: "owner",
             joinedAt: Date.now(),
             notificationsEnabled: true,
           })
         );

         const membershipRef = firestore()
           .collection(userMembershipsPath(_uid))
           .doc(group.id);
         batch.set(membershipRef, 
           sanitizeForFirestore({
             groupId: group.id,
             groupName: group.name,
             groupCode: group.code,
             role: "owner",
             joinedAt: Date.now(),
           })
         );
       }
      console.log(
        `[syncFacade] Added ${groups.length} groups and memberships to batch for upload.`,
      );

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

  // ────────────────────────────────
  //  Private Task write-through
  // ────────────────────────────────

  async addTask(task: Task): Promise<void> {
    console.log(
      `[syncFacade] addTask: ${task.id}, state: ${_currentSyncState}`,
    );
    await taskStorage.addTask(task);
    if (
      isAuthenticated() &&
      _uid &&
      _currentSyncState >= SyncState.UPLOADING_LOCAL
    ) {
       try {
         await firestore()
           .collection(userPrivateTasksPath(_uid))
           .doc(task.id)
           .set(
             sanitizeForFirestore({
               ...task,
               createdBy: _uid,
               lastModifiedBy: _uid,
               syncStatus: "synced",
             })
           );
        console.log(`[syncFacade] addTask: ${task.id} written to Firestore.`);
      } catch (e) {
        console.error("[syncFacade] addTask firestore error", e);
      }
    }
  },

  async updateTask(task: Task): Promise<void> {
    console.log(
      `[syncFacade] updateTask: ${task.id}, state: ${_currentSyncState}`,
    );
    await taskStorage.updateTask(task);
     if (
       isAuthenticated() &&
       _uid &&
       _currentSyncState >= SyncState.UPLOADING_LOCAL
     ) {
       try {
         await firestore()
           .collection(userPrivateTasksPath(_uid))
           .doc(task.id)
           .set(
             sanitizeForFirestore({ ...task, lastModifiedBy: _uid, updatedAt: Date.now() })
           );
        console.log(
          `[syncFacade] updateTask: ${task.id} updated in Firestore.`,
        );
      } catch (e) {
        console.error("[syncFacade] updateTask firestore error", e);
      }
    }
  },

  async deleteTask(taskId: string): Promise<void> {
    console.log(
      `[syncFacade] deleteTask: ${taskId}, state: ${_currentSyncState}`,
    );
    await taskStorage.deleteTask(taskId);
    if (
      isAuthenticated() &&
      _uid &&
      _currentSyncState >= SyncState.UPLOADING_LOCAL
     ) {
       try {
         await firestore()
           .collection(userPrivateTasksPath(_uid))
           .doc(taskId)
           .update(
             sanitizeForFirestore({
               deleted: true,
               updatedAt: Date.now(),
               lastModifiedBy: _uid,
             })
           );
        console.log(
          `[syncFacade] deleteTask: ${taskId} marked as deleted in Firestore.`,
        );
      } catch (e) {
        console.error("[syncFacade] deleteTask firestore error", e);
      }
    }
  },

  async saveTasks(tasks: Task[]): Promise<void> {
    console.log(
      `[syncFacade] saveTasks: ${tasks.length} tasks, state: ${_currentSyncState}`,
    );
    await taskStorage.saveTasks(tasks);
    if (
      isAuthenticated() &&
      _uid &&
      _currentSyncState >= SyncState.UPLOADING_LOCAL
    ) {
      try {
        const batch = firestore().batch();
        const col = firestore().collection(userPrivateTasksPath(_uid));
        for (const task of tasks) {
          batch.set(col.doc(task.id), { ...task, lastModifiedBy: _uid });
        }
        await batch.commit();
        console.log(
          `[syncFacade] saveTasks: ${tasks.length} tasks committed to Firestore batch.`,
        );
      } catch (e) {
        console.error("[syncFacade] saveTasks firestore error", e);
      }
    }
  },

  // ────────────────────────────────
  //  Group write-through (global)
  // ────────────────────────────────

  async addGroup(group: Group, creatorRole: GroupMember): Promise<void> {
    console.log(
      `[syncFacade] addGroup: ${group.id}, state: ${_currentSyncState}`,
    );
    await groupStorage.addGroup(group);
    if (
      isAuthenticated() &&
      _uid &&
      _currentSyncState >= SyncState.UPLOADING_LOCAL
    ) {
       try {
         const batch = firestore().batch();
         const groupRef = firestore().collection(groupsPath).doc(group.id);
         batch.set(groupRef, 
           sanitizeForFirestore({ ...group, memberCount: 1, isArchived: false })
         );

         const memberRef = firestore()
           .collection(groupMembersPath(group.id))
           .doc(_uid);
         batch.set(memberRef, sanitizeForFirestore(creatorRole));

         const membershipRef = firestore()
           .collection(userMembershipsPath(_uid))
           .doc(group.id);
         batch.set(membershipRef, 
           sanitizeForFirestore({
             groupId: group.id,
             groupName: group.name,
             groupCode: group.code,
             role: creatorRole.role,
             joinedAt: creatorRole.joinedAt,
           })
         );

         await batch.commit();
        console.log(
          `[syncFacade] addGroup: ${group.id} committed to Firestore batch.`,
        );
      } catch (e) {
        console.error("[syncFacade] addGroup firestore error", e);
      }
    }
  },

  async updateGroup(group: Group): Promise<void> {
    console.log(
      `[syncFacade] updateGroup: ${group.id}, state: ${_currentSyncState}`,
    );
    await groupStorage.updateGroup(group);
     if (
       isAuthenticated() &&
       _uid &&
       _currentSyncState >= SyncState.UPLOADING_LOCAL
     ) {
       try {
         await firestore()
           .collection(groupsPath)
           .doc(group.id)
           .set(
             sanitizeForFirestore({ ...group, updatedAt: Date.now() }),
             { merge: true }
           );
        console.log(
          `[syncFacade] updateGroup: ${group.id} updated in Firestore.`,
        );
      } catch (e) {
        console.error("[syncFacade] updateGroup firestore error", e);
      }
    }
  },

  async deleteGroup(groupId: string): Promise<void> {
    console.log(
      `[syncFacade] deleteGroup: ${groupId}, state: ${_currentSyncState}`,
    );
    await groupStorage.deleteGroup(groupId);
    if (
      isAuthenticated() &&
      _uid &&
      _currentSyncState >= SyncState.UPLOADING_LOCAL
    ) {
      try {
        const batch = firestore().batch();
        batch.update(firestore().collection(groupsPath).doc(groupId), {
          isArchived: true,
          updatedAt: Date.now(),
        });
        batch.delete(
          firestore().collection(userMembershipsPath(_uid)).doc(groupId),
        );
        await batch.commit();
        console.log(
          `[syncFacade] deleteGroup: ${groupId} committed to Firestore batch.`,
        );
      } catch (e) {
        console.error("[syncFacade] deleteGroup firestore error", e);
      }
    }
  },

  async saveGroups(groups: Group[]): Promise<void> {
    console.log(
      `[syncFacade] saveGroups: ${groups.length} groups, state: ${_currentSyncState}`,
    );
    await groupStorage.saveGroups(groups);
     if (
       isAuthenticated() &&
       _uid &&
       _currentSyncState >= SyncState.UPLOADING_LOCAL
     ) {
       try {
         const batch = firestore().batch();
         for (const group of groups) {
           batch.set(firestore().collection(groupsPath).doc(group.id), 
             sanitizeForFirestore(group),
             { merge: true }
           );
         }
         await batch.commit();
        console.log(
          `[syncFacade] saveGroups: ${groups.length} groups committed to Firestore batch.`,
        );
      } catch (e) {
        console.error("[syncFacade] saveGroups firestore error", e);
      }
    }
  },

  // ────────────────────────────────
  //  Group Member write-through
  // ────────────────────────────────

   async addGroupMember(groupId: string, member: GroupMember): Promise<void> {
     if (!_uid) return;
     try {
       const batch = firestore().batch();
       const memberRef = firestore()
         .collection(groupMembersPath(groupId))
         .doc(member.uid);
       batch.set(memberRef, sanitizeForFirestore(member));

       const groupDoc = await firestore()
         .collection(groupsPath)
         .doc(groupId)
         .get();
       const groupData = groupDoc.data() as Group | undefined;

       if (groupData) {
         const membershipRef = firestore()
           .collection(userMembershipsPath(member.uid))
           .doc(groupId);
         batch.set(membershipRef, 
           sanitizeForFirestore({
             groupId,
             groupName: groupData.name,
             groupCode: groupData.code,
             role: member.role,
             joinedAt: member.joinedAt,
           })
         );
         batch.update(firestore().collection(groupsPath).doc(groupId), {
           memberCount: firestore.FieldValue.increment(1),
         });
       }

       await batch.commit();
     } catch (e) {
       console.error("[syncFacade] addGroupMember firestore error", e);
     }
   },

  async removeGroupMember(groupId: string, memberUid: string): Promise<void> {
    if (!_uid) return;
    try {
      const batch = firestore().batch();
      batch.delete(
        firestore().collection(groupMembersPath(groupId)).doc(memberUid),
      );
      batch.delete(
        firestore().collection(userMembershipsPath(memberUid)).doc(groupId),
      );
      batch.update(firestore().collection(groupsPath).doc(groupId), {
        memberCount: firestore.FieldValue.increment(-1),
      });
      await batch.commit();
    } catch (e) {
      console.error("[syncFacade] removeGroupMember firestore error", e);
    }
  },

   async updateGroupMemberRole(
     groupId: string,
     memberUid: string,
     role: GroupMember["role"],
   ): Promise<void> {
     if (!_uid) return;
     try {
       await firestore()
         .collection(groupMembersPath(groupId))
         .doc(memberUid)
         .update(sanitizeForFirestore({ role }));
     } catch (e) {
       console.error("[syncFacade] updateGroupMemberRole firestore error", e);
     }
   },

  // ────────────────────────────────
  //  Invitation write-through
  // ────────────────────────────────

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
     if (!_uid) return;
     try {
       await firestore()
         .collection(invitationsPath)
         .doc(invitation.id)
         .set(
           sanitizeForFirestore({
             ...invitation,
             invitedUid: null,
             status: "pending",
             createdAt: Date.now(),
             expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
           })
         );
     } catch (e) {
       console.error("[syncFacade] createInvitation firestore error", e);
     }
   },

   async acceptInvitation(
     invitationId: string,
     groupId: string,
     uid: string,
   ): Promise<void> {
     if (!_uid) return;
     try {
       const batch = firestore().batch();
       batch.update(firestore().collection(invitationsPath).doc(invitationId), {
         status: "accepted",
         invitedUid: uid,
       });
       const memberRef = firestore()
         .collection(groupMembersPath(groupId))
         .doc(uid);
       batch.set(memberRef, 
         sanitizeForFirestore({
           uid,
           role: "member",
           joinedAt: Date.now(),
           invitedBy: _uid,
           notificationsEnabled: true,
         })
       );
       batch.update(firestore().collection(groupsPath).doc(groupId), {
         memberCount: firestore.FieldValue.increment(1),
       });
       await batch.commit();
     } catch (e) {
       console.error("[syncFacade] acceptInvitation firestore error", e);
     }
   },

  // ────────────────────────────────
  //  Activity Logging
  // ────────────────────────────────

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
     if (!_uid) return;
     try {
       const activityRef = firestore()
         .collection(groupActivityPath(groupId))
         .doc();
       await activityRef.set(
         sanitizeForFirestore({
           ...activity,
           id: activityRef.id,
           createdAt: Date.now(),
         })
       );
     } catch (e) {
       console.error("[syncFacade] logActivity firestore error", e);
     }
   },
};

export default syncFacade;
