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
}

// Group types
export interface Group {
  id: string;
  name: string;
  code: string;
  members: string[];
  createdAt: number;
  createdBy: string;
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
