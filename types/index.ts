// Task types
export interface Task {
  id: string;
  text: string;
  completed: boolean;
  groupId?: string;
  reminder?: boolean;
  reminderAt?: number;
  createdAt: number;
  updatedAt: number;
  // New fields for collaboration
  completedAt?: number;
  completedBy?: string;
  createdBy?: string; // For group tasks — who created it
  assignedTo?: string; // For task assignment
  priority?: "low" | "medium" | "high";
  dueDate?: number;
  deleted?: boolean; // Soft delete flag
  lastModifiedBy?: string;
  // Sync metadata
  syncVersion?: number;
  syncStatus?: "local" | "synced" | "conflict";
}

// Group types
export interface Group {
  id: string;
  name: string;
  code: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  // New fields
  description?: string;
  avatarURL?: string;
  memberCount: number;
  maxMembers?: number;
  isArchived?: boolean;
  lastActivityAt?: number;
  taskCount?: number;
}

// Group member (stored in /groups/{groupId}/members/{uid})
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

// Denormalized membership (stored in /users/{uid}/memberships/{groupId})
export interface Membership {
  groupId: string;
  groupName: string;
  groupCode: string;
  role: "member" | "admin" | "owner";
  joinedAt: number;
  lastViewedAt?: number;
  unreadCount?: number;
}

// Invitation
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
}

// Notification
export interface AppNotification {
  id: string;
  type:
    | "task_reminder"
    | "group_invite"
    | "member_joined"
    | "task_assigned"
    | "task_completed_by_other"
    | "mention";
  title: string;
  body: string;
  data: {
    groupId?: string;
    taskId?: string;
    invitationId?: string;
    screen?: string;
  };
  read: boolean;
  readAt?: number;
  createdAt: number;
}

// Activity log
export interface ActivityLog {
  id: string;
  type:
    | "task_created"
    | "task_completed"
    | "task_updated"
    | "member_joined"
    | "member_left"
    | "member_removed"
    | "group_updated"
    | "task_assigned"
    | "task_unassigned";
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
}

export enum SyncState {
  IDLE,
  AUTHENTICATING,
  MIGRATING,
  UPLOADING_LOCAL,
  HYDRATING,
  REALTIME_READY,
  READY,
}

// Task service types
export type TaskFilter = "ongoing" | "completed";

// Group service types
export interface CreateGroupResult {
  success: boolean;
  group?: Group;
  error?: string;
}

export interface JoinGroupResult {
  success: boolean;
  group?: Group;
  error?: string;
}

// Role types
export type GroupRole = "member" | "admin" | "owner";
