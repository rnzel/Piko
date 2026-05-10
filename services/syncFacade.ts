/**
 * @deprecated This file is deprecated. Use syncOrchestrator from "@/services/SyncOrchestrator" instead.
 *
 * This wrapper is kept for backward compatibility during the transition period.
 * All functionality has been moved to SyncOrchestrator.
 *
 * Migration guide:
 * - Replace `import { syncFacade } from "@/services/syncFacade"`
 *   with `import { syncOrchestrator } from "@/services/SyncOrchestrator"`
 * - Replace `syncFacade.initialize(uid)` with `syncOrchestrator.initialize(uid)`
 * - Replace `syncFacade.deinitialize()` with `syncOrchestrator.deinitialize()`
 * - Replace `syncFacade.subscribeRealtime()` - no longer needed, handled automatically
 * - Replace `syncFacade.unsubscribeRealtime()` - no longer needed, handled automatically
 * - Replace `syncFacade.currentSyncState` with `syncOrchestrator.syncState`
 * - Replace `syncFacade.isInitialized` with `syncOrchestrator.isInitialized`
 * - Replace `syncFacade.currentUid` with `syncOrchestrator.uid`
 */

import { syncOrchestrator } from "@/services/SyncOrchestrator";
import { Group, GroupMember, SyncState, Task } from "@/types";

// Re-export SyncLifecycleState as SyncState for compatibility
export { syncOrchestrator };

/**
 * @deprecated Use syncOrchestrator instead
 */
export const syncFacade = {
  /** @deprecated Use syncOrchestrator.initialize() instead */
  initialize(uid: string): void {
    console.warn(
      "[syncFacade] initialize() is deprecated. Use syncOrchestrator.initialize() instead.",
    );
    // Note: syncOrchestrator.initialize() is async, but the old API was sync
    // We fire-and-forget here for backward compatibility
    syncOrchestrator.initialize(uid).catch((e) => {
      console.error("[syncFacade] initialize error:", e);
    });
  },

  /** @deprecated Use syncOrchestrator.deinitialize() instead */
  deinitialize(): void {
    console.warn(
      "[syncFacade] deinitialize() is deprecated. Use syncOrchestrator.deinitialize() instead.",
    );
    syncOrchestrator.deinitialize().catch((e) => {
      console.error("[syncFacade] deinitialize error:", e);
    });
  },

  /** @deprecated Use syncOrchestrator.isInitialized instead */
  get isInitialized(): boolean {
    console.warn(
      "[syncFacade] isInitialized is deprecated. Use syncOrchestrator.isInitialized instead.",
    );
    return syncOrchestrator.isInitialized;
  },

  /** @deprecated Use syncOrchestrator.uid instead */
  get currentUid(): string | null {
    console.warn(
      "[syncFacade] currentUid is deprecated. Use syncOrchestrator.uid instead.",
    );
    return syncOrchestrator.uid;
  },

  /** @deprecated Use syncOrchestrator.syncState instead */
  get currentSyncState(): SyncState {
    console.warn(
      "[syncFacade] currentSyncState is deprecated. Use syncOrchestrator.syncState instead.",
    );
    return syncOrchestrator.syncState;
  },

  /** @deprecated Realtime listeners are now managed automatically by SyncOrchestrator */
  subscribeRealtime(): void {
    console.warn(
      "[syncFacade] subscribeRealtime() is deprecated. Realtime listeners are now managed automatically by SyncOrchestrator.",
    );
    // No-op - realtime listeners are managed automatically by SyncOrchestrator
  },

  /** @deprecated Realtime listeners are now managed automatically by SyncOrchestrator */
  unsubscribeRealtime(): void {
    console.warn(
      "[syncFacade] unsubscribeRealtime() is deprecated. Realtime listeners are now managed automatically by SyncOrchestrator.",
    );
    // No-op - realtime listeners are managed automatically by SyncOrchestrator
  },

  // Task write-through methods
  /** @deprecated Use syncOrchestrator.addTask() instead */
  async addTask(task: Task): Promise<void> {
    return syncOrchestrator.addTask(task);
  },

  /** @deprecated Use syncOrchestrator.updateTask() instead */
  async updateTask(task: Task): Promise<void> {
    return syncOrchestrator.updateTask(task);
  },

  /** @deprecated Use syncOrchestrator.deleteTask() instead */
  async deleteTask(taskId: string): Promise<void> {
    return syncOrchestrator.deleteTask(taskId);
  },

  /** @deprecated Use syncOrchestrator.saveTasks() instead */
  async saveTasks(tasks: Task[]): Promise<void> {
    return syncOrchestrator.saveTasks(tasks);
  },

// Group write-through methods
   /** @deprecated Use syncOrchestrator.addGroup() instead */
   async addGroup(group: Group, creatorRole: GroupMember): Promise<{ success: boolean; error?: string }> {
     return syncOrchestrator.addGroup(group, creatorRole);
   },

  /** @deprecated Use syncOrchestrator.updateGroup() instead */
  async updateGroup(group: Group): Promise<void> {
    return syncOrchestrator.updateGroup(group);
  },

  /** @deprecated Use syncOrchestrator.deleteGroup() instead */
  async deleteGroup(groupId: string): Promise<void> {
    return syncOrchestrator.deleteGroup(groupId);
  },

  /** @deprecated Use syncOrchestrator.saveGroups() instead */
  async saveGroups(groups: Group[]): Promise<void> {
    return syncOrchestrator.saveGroups(groups);
  },

  // Group member methods
  /** @deprecated Use syncOrchestrator.addGroupMember() instead */
  async addGroupMember(groupId: string, member: GroupMember): Promise<void> {
    return syncOrchestrator.addGroupMember(groupId, member);
  },

  /** @deprecated Use syncOrchestrator.removeGroupMember() instead */
  async removeGroupMember(groupId: string, memberUid: string): Promise<void> {
    return syncOrchestrator.removeGroupMember(groupId, memberUid);
  },

  /** @deprecated Use syncOrchestrator.updateGroupMemberRole() instead */
  async updateGroupMemberRole(
    groupId: string,
    memberUid: string,
    role: GroupMember["role"],
  ): Promise<void> {
    return syncOrchestrator.updateGroupMemberRole(groupId, memberUid, role);
  },

  // Invitation methods
  /** @deprecated Use syncOrchestrator.createInvitation() instead */
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
    return syncOrchestrator.createInvitation(invitation);
  },

  /** @deprecated Use syncOrchestrator.acceptInvitation() instead */
  async acceptInvitation(
    invitationId: string,
    groupId: string,
    uid: string,
  ): Promise<void> {
    return syncOrchestrator.acceptInvitation(invitationId, groupId, uid);
  },

  // Activity logging
  /** @deprecated Use syncOrchestrator.logActivity() instead */
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
    return syncOrchestrator.logActivity(groupId, activity);
  },

  // Legacy sync methods (now handled internally by SyncOrchestrator)
  /** @deprecated Use syncOrchestrator.initialize() which handles this internally */
  async syncDown(): Promise<void> {
    console.warn(
      "[syncFacade] syncDown() is deprecated. This is now handled internally by SyncOrchestrator during initialization.",
    );
    // No-op - syncDown is now handled internally by SyncOrchestrator
  },

  /** @deprecated Use syncOrchestrator.initialize() which handles this internally */
  async uploadLocalData(): Promise<void> {
    console.warn(
      "[syncFacade] uploadLocalData() is deprecated. This is now handled internally by SyncOrchestrator during initialization.",
    );
    // No-op - uploadLocalData is now handled internally by SyncOrchestrator
  },
};

export default syncFacade;
