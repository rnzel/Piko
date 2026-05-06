# Firebase Sync Service - Implementation

> ✅ **Status: Implemented**
> The Firebase sync facade (`services/syncFacade.ts`) is fully built and wired into the app.
> What follows is a summary of the architecture and rollout, not a forward plan.

## Status Summary

- `@react-native-firebase/firestore` is installed and configured.
- `services/syncFacade.ts` provides write-through to Firestore for authenticated users while keeping local storage fast.
- `taskService` and `groupService` now call `syncFacade` methods for all write operations.
- AuthContext calls `syncFacade.initialize(uid)` after successful sign-in, runs `syncDown()` (pull remote → merge local), and `uploadLocalData()` (push local-only items to Firestore).
- Guest users continue to use local-only storage (no Firestore access).
- Sign-out calls `syncFacade.deinitialize()` to stop sync.

## Notes

- The facade uses a simple last-write-wins conflict strategy.
- Firestore security rules must be deployed separately (see `Security Rules` section below).
- No real-time listener is active yet — that would be Phase 2.

## Goal

Provide optional Firebase-based persistence for logged-in users while keeping local-only storage for guests.

## Architecture

```
┌─────────────────────────────┐
│      UI / Components        │
└──────────┬──────────────────┘
           │
┌──────────▼──────────────────┐
│      Data Facade            │  ← taskService / groupService call this
│  (syncFacade.ts)            │     instead of taskStorage / groupStorage directly
├─────────────────────────────┤
│  LocalStorage  FireStorage  │
│  (existing)    (new)        │
└─────────────────────────────┘
```

### SyncFacade (new file: `services/syncFacade.ts`)

- Interface: `StorageProvider<Task>`, `StorageProvider<Group>`
- Two implementations:
  - `LocalTaskStorage` — wraps existing `taskStorage` (no change).
  - `FirebaseTaskStorage` — reads/writes from Firestore under `users/{uid}/tasks/{taskId}`.
- Facade decides which implementation to use based on `user` / `isGuest` from AuthContext.

## Phase 1 — Write-Through (opt-in)

- When user is authenticated, writes go to both local (fast) + Firestore (backup).
- Reads always come from local (fast).
- On app start: pull remote data and merge into local store (last-write-wins by `updatedAt`).

## Phase 2 — Real-time (optional)

- Subscribe to Firestore `onSnapshot` for active user's task/group collections.
- Merge changes into local state automatically (last-write-wins).

## Migration Plan

### Step 1: Add dependency

```bash
npm install @react-native-firebase/firestore
```

### Step 2: Create `syncFacade.ts`

- `initializeFirebaseSync(uid: string)` — sets up Firestore listener (opt-in).
- `uploadLocalData()` — called once on first sync to push all local data to Firestore.
- `syncDown()` — pulls all documents from Firestore and merges into AsyncStorage.

### Step 3: Update `taskService` and `groupService`

- Swap out direct `taskStorage` calls for `syncFacade` calls (behind a thin adapter).
- Keep existing interfaces unchanged (no UI changes).

### Step 4: Toggle in AuthContext

- After successful sign-in, call `initializeFirebaseSync(user.uid)`.
- On sign-out, call `stopFirebaseSync()` and revert to local-only.

## Conflict Resolution

- **Strategy**: Last-write-wins based on `updatedAt` timestamp.
- **Rationale**: Simple, predictable, minimal complexity for a productivity app.
- **Future enhancement**: Surface merge conflicts for shared group tasks.

## Data Structure (Firestore)

```
users/{uid}/
  tasks/{taskId}/
    id, text, completed, groupId, reminder, reminderAt, createdAt, updatedAt
  groups/{groupId}/
    id, name, code, members[], createdBy, createdAt
```

## Security Rules (Firestore)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Rollout

1. Add Firestore dependency.
2. Implement `syncFacade.ts` with local-only fallback.
3. Test with emulator, then deploy.
4. Monitor migration success rate; add retry logic if needed.
