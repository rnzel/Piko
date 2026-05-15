// Task types
export interface Task {
  id: string;
  text: string;
  completed: boolean;
  /** @deprecated Group collaboration removed. Kept for backward compat with stored data. */
  groupId?: string;
  reminder?: boolean;
  reminderAt?: number;
  createdAt: number;
  updatedAt: number;
  /** @deprecated Group collaboration removed. Kept for backward compat. */
  completedAt?: number;
  /** @deprecated Group collaboration removed. Kept for backward compat. */
  completedBy?: string;
  /** @deprecated Group collaboration removed. Kept for backward compat. */
  createdBy?: string;
  /** @deprecated Group collaboration removed. Kept for backward compat. */
  assignedTo?: string;
  priority?: "low" | "medium" | "high";
  dueDate?: number;
  deleted?: boolean; // Soft delete flag
  lastModifiedBy?: string;
  // Sync metadata
  syncVersion?: number;
  syncStatus?: "local" | "synced" | "conflict";
}

// Group types — deprecated, kept for backward compatibility
/** @deprecated Group collaboration has been removed. */
export interface Group {
  id: string;
  name: string;
  code: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  description?: string;
  avatarURL?: string;
  memberCount: number;
  maxMembers?: number;
  isArchived?: boolean;
  lastActivityAt?: number;
  taskCount?: number;
  syncStatus?: "local" | "synced" | "pending";
  pendingChanges?: boolean;
  lastSyncedAt?: number;
}

/** @deprecated Group collaboration has been removed. */
export interface GroupMember {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: "member" | "admin" | "owner";
  joinedAt: number;
  invitedBy?: string;
  lastActiveAt?: number;
  isOnline?: boolean;
  notificationsEnabled?: boolean;
}

/** @deprecated Group collaboration has been removed. */
export interface Membership {
  groupId: string;
  groupName: string;
  groupCode: string;
  role: "member" | "admin" | "owner";
  joinedAt: number;
  lastViewedAt?: number;
  unreadCount?: number;
  updatedAt?: number;
  lastSyncedAt?: number;
  membershipVersion?: number;
  syncStatus?: "local" | "synced" | "pending";
  pendingChanges?: boolean;
}

/** @deprecated Group collaboration has been removed. */
export interface Invitation {
  id: string;
  groupId: string;
  groupName: string;
  groupCode: string;
  invitedByUid: string;
  invitedByDisplayName: string;
  invitedEmail: string;
  invitedUid?: string;
  status: "pending" | "accepted" | "declined" | "expired";
  createdAt: number;
  expiresAt: number;
  message?: string;
  isArchived?: boolean;
  updatedAt?: number;
  lastSyncedAt?: number;
  syncStatus?: "local" | "synced" | "pending";
  pendingChanges?: boolean;
}

// Notification
export interface AppNotification {
  id: string;
  type: "task_reminder";
  title: string;
  body: string;
  data: {
    /** @deprecated Group collaboration removed. */
    groupId?: string;
    taskId?: string;
    /** @deprecated Group collaboration removed. */
    invitationId?: string;
    /** @deprecated Group collaboration removed. */
    screen?: string;
  };
  read: boolean;
  readAt?: number;
  createdAt: number;
}

/** @deprecated Group collaboration has been removed. */
export interface ActivityLog {
  id: string;
  type: string;
  actorUid: string;
  actorName: string;
  targetId?: string;
  targetText?: string;
  metadata?: Record<string, any>;
  createdAt: number;
}

// User types
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

// Auth context types
export interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  isGuest: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  continueAsGuest: () => void;
  syncState: SyncState;
  syncError?: string | null;
}

export enum SyncState {
  IDLE,
  AUTHENTICATING,
  MIGRATING,
  UPLOADING_LOCAL,
  HYDRATING,
  REALTIME_READY,
  READY,
  DEGRADED,
  ERROR,
}

// Task service types
export type TaskFilter = "ongoing" | "completed";

/** @deprecated Group collaboration has been removed. */
export interface CreateGroupResult {
  success: boolean;
  group?: Group;
  error?: string;
}

/** @deprecated Group collaboration has been removed. */
export interface JoinGroupResult {
  success: boolean;
  group?: Group;
  status?:
    | "joining"
    | "already_member"
    | "group_not_found"
    | "group_archived"
    | "join_success"
    | "join_failed";
  error?: string;
}

/** @deprecated Group collaboration has been removed. */
export type GroupRole = "member" | "admin" | "owner";
