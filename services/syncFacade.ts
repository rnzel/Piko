// ────────────────────────────────────────────────────────────
// syncFacade — Deprecated compatibility layer
// ────────────────────────────────────────────────────────────
// All sync is now delegated directly to SyncOrchestrator.
// This file exists only for backward compatibility during the
// staged deprecation of the Groups/Collaboration feature.
// ────────────────────────────────────────────────────────────

import { syncOrchestrator } from "@/services/SyncOrchestrator";
import { SyncState, Task } from "@/types";

/** @deprecated Use syncOrchestrator directly. This is a thin compatibility wrapper. */
export const syncFacade = {
  initialize(uid: string): void {
    syncOrchestrator.initialize(uid);
  },

  deinitialize(): void {
    syncOrchestrator.deinitialize();
  },

  get isInitialized(): boolean {
    return syncOrchestrator.isInitialized;
  },

  get currentUid(): string | null {
    return syncOrchestrator.uid;
  },

  get currentSyncState(): SyncState {
    return syncOrchestrator.syncState;
  },

  subscribeRealtime(): void {
    // Realtime listeners are managed by SyncOrchestrator internally.
  },

  unsubscribeRealtime(): void {
    // Realtime listeners are managed by SyncOrchestrator internally.
  },

  async addTask(task: Task): Promise<void> {
    return syncOrchestrator.addTask(task);
  },

  async updateTask(task: Task): Promise<void> {
    return syncOrchestrator.updateTask(task);
  },

  async deleteTask(taskId: string): Promise<void> {
    return syncOrchestrator.deleteTask(taskId);
  },

  async saveTasks(tasks: Task[]): Promise<void> {
    return syncOrchestrator.saveTasks(tasks);
  },

  async syncDown(): Promise<void> {
    // Sync down is handled by SyncOrchestrator.initialize().
  },

  async uploadLocalData(): Promise<void> {
    // Upload is handled by SyncOrchestrator.initialize().
  },
};

export default syncFacade;
