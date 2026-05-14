import { notificationService } from "@/services/notificationService";
import {
  clearAllStorage,
  guestStorage,
  userStorage,
} from "@/services/storageService";
import { syncOrchestrator } from "@/services/SyncOrchestrator";
import { AuthState, SyncState, UserProfile } from "@/types";
import {
  signOut as firebaseSignOut,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
} from "@react-native-firebase/auth";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert } from "react-native";

import MigrationModal from "@/components/tasks/MigrationModal";
import {
  detectGuestData,
  GuestDataInfo,
  migrateGuestData,
  MigrationStrategy,
} from "@/services/migrationService";

const SIGN_IN_TIMEOUT_MS = 20000;

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  isGuest: false,
  signIn: async () => {},
  signOut: async () => {},
  continueAsGuest: () => {},
  syncState: SyncState.IDLE,
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>(SyncState.IDLE);

  // Migration state
  const [showMigration, setShowMigration] = useState(false);
  const [migrationInfo, setMigrationInfo] = useState<GuestDataInfo | null>(
    null,
  );
  const [migrationLoading, setMigrationLoading] = useState(false);

  // Subscribe to orchestrator state changes
  useEffect(() => {
    const unsubscribe = syncOrchestrator.subscribe((state) => {
      // Map orchestrator state to SyncState
      const syncState = syncOrchestrator.syncState;
      setSyncState(syncState);
      console.log(
        `[AuthContext] SyncOrchestrator state changed to: ${SyncState[syncState]}`,
      );
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async () => {
    console.log("[AuthContext] Starting sign-in process...");
    setSyncState(SyncState.AUTHENTICATING);
    try {
      await GoogleSignin.signOut();

      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
      console.log("[AuthContext] Google Play services available");

      const signInResult = await Promise.race([
        GoogleSignin.signIn(),
        new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  "Google Sign-In timed out. Please retry and ensure Google account picker appears.",
                ),
              ),
            SIGN_IN_TIMEOUT_MS,
          ),
        ),
      ]);
      console.log("[AuthContext] Google Sign-In successful");

      let idToken = (signInResult as { data?: { idToken?: string } }).data
        ?.idToken;
      if (!idToken) {
        idToken = (signInResult as { idToken?: string }).idToken;
      }
      if (!idToken) {
        throw new Error("No ID token found");
      }

      const googleCredential = GoogleAuthProvider.credential(idToken);
      const firebaseUserCredential = await signInWithCredential(
        getAuth(),
        googleCredential,
      );

      const uid = firebaseUserCredential.user.uid;
      console.log(`[AuthContext] Firebase authenticated for uid: ${uid}`);

      const userProfile: UserProfile = {
        uid,
        email: firebaseUserCredential.user.email || "",
        displayName: firebaseUserCredential.user.displayName || "",
        photoURL: firebaseUserCredential.user.photoURL || undefined,
      };
      await userStorage.saveUser(userProfile);
      await guestStorage.setIsGuest(false);
      setUser(userProfile);
      setIsGuest(false);

      // Migration check should happen before any sync orchestrator initialization
      setSyncState(SyncState.MIGRATING);
      console.log("[AuthContext] Detecting guest data for migration...");
      const guestData = await detectGuestData();
      if (guestData.hasTasks || guestData.hasGroups) {
        setMigrationInfo(guestData);
        setShowMigration(true);
        // Migration modal will handle the next steps in handleMigrationChoice
        return;
      }

      // No guest data, proceed with normal sync initialization
      await initializeSync(uid);
    } catch (error) {
      console.error("[AuthContext] Sign-in process error:", error);
      setSyncState(SyncState.IDLE); // Reset sync state on error

      const errorCode =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error as { code: unknown }).code === "string"
          ? (error as { code: string }).code
          : undefined;

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error as { code: unknown }).code === "string"
      ) {
        switch (errorCode) {
          case statusCodes.SIGN_IN_CANCELLED:
            Alert.alert("Sign-in cancelled", "You cancelled Google sign-in.");
            break;
          case statusCodes.IN_PROGRESS:
            Alert.alert("Sign-in in progress", "Please wait and try again.");
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            Alert.alert(
              "Google Play Services unavailable",
              "Please update Google Play Services and try again.",
            );
            break;
          default:
            Alert.alert(
              "Google Sign-in error",
              `Error code: ${errorCode}. Check Metro logs for details.`,
            );
        }
      } else {
        console.error(error);
        Alert.alert(
          "Sign-in failed",
          error instanceof Error ? error.message : "Unknown sign-in error",
        );
      }
    }
  }, [setSyncState]);

  const initializeSync = useCallback(async (uid: string) => {
    console.log(`[AuthContext] Initializing sync for uid: ${uid}`);
    // Delegate all sync initialization to the orchestrator
    await syncOrchestrator.initialize(uid);
    console.log(`[AuthContext] Sync initialization complete.`);
  }, []);

  const handleMigrationChoice = useCallback(
    async (strategy: MigrationStrategy) => {
      const uid = getAuth().currentUser?.uid;
      if (!uid) {
        console.error("[AuthContext] No UID available for migration.");
        return;
      }

      if (strategy === "cancel") {
        console.log("[AuthContext] Migration cancelled. Signing out.");
        setShowMigration(false);
        setMigrationInfo(null);
        setSyncState(SyncState.IDLE);
        try {
          await syncOrchestrator.deinitialize();
          await firebaseSignOut(getAuth());
          await GoogleSignin.signOut();
        } catch (e) {
          console.error("Error signing out after migration cancel:", e);
        }
        setUser(null);
        setIsGuest(true);
        return;
      }

      setMigrationLoading(true);
      setSyncState(SyncState.MIGRATING);
      console.log("[AuthContext] Starting guest data migration...");

      try {
        await migrateGuestData(uid, strategy);
        setShowMigration(false);
        setMigrationInfo(null);
        console.log("[AuthContext] Guest data migration complete.");

        // After migration, proceed with the normal sync initialization flow
        await initializeSync(uid);
      } catch (error) {
        console.error("[AuthContext] Migration failed:", error);
        setSyncState(SyncState.IDLE); // Reset sync state on error
        Alert.alert(
          "Migration Error",
          "Failed to migrate your data. Please try signing in again.",
        );
      } finally {
        setMigrationLoading(false);
      }
    },
    [initializeSync, setSyncState],
  );

  const signOut = useCallback(async () => {
    console.log("[AuthContext] Signing out...");
    setSyncState(SyncState.IDLE); // Reset sync state on sign out
    try {
      await syncOrchestrator.deinitialize();
      await firebaseSignOut(getAuth());
      await GoogleSignin.signOut();
      await clearAllStorage();
      setUser(null);
      setIsGuest(false);
      console.log("[AuthContext] Sign out complete.");
    } catch (error) {
      console.error("[AuthContext] Error signing out:", error);
      Alert.alert("Sign-out failed", "There was an error signing out.");
    }
  }, [setSyncState]);

  const continueAsGuest = useCallback(async () => {
    console.log("[AuthContext] Continuing as guest...");
    // Deinitialize orchestrator first to clear any previous authenticated state
    await syncOrchestrator.deinitialize();
    await guestStorage.setIsGuest(true);
    setIsGuest(true);
    setLoading(false);
    setSyncState(SyncState.READY); // Guest mode is always READY locally
  }, [setSyncState]);

  // Ref to track syncState without stale closures in the onAuthStateChanged listener
  const syncStateRef = useRef(syncState);
  syncStateRef.current = syncState;
  // Ref to track isGuest without stale closures
  const isGuestRef = useRef(isGuest);
  isGuestRef.current = isGuest;

  useEffect(() => {
    notificationService
      .requestPermissions()
      .catch((e) =>
        console.warn("[AuthContext] notification permission request failed", e),
      );

    GoogleSignin.configure({
      webClientId:
        "1015788618693-28qa1mih7g9tec9fmfsfin36eb8g91kl.apps.googleusercontent.com",
    });

    const initializeAuth = async () => {
      try {
        console.log("[AuthContext] Initializing auth...");
        const savedIsGuest = await guestStorage.getIsGuest();
        if (savedIsGuest) {
          console.log("[AuthContext] Guest session detected.");
          setIsGuest(true);
          setLoading(false);
          setSyncState(SyncState.READY);
          return;
        }

        const firebaseUser = getAuth().currentUser;
        if (firebaseUser) {
          console.log(
            "[AuthContext] Authenticated user detected on app start.",
          );
          const userProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || "",
            displayName: firebaseUser.displayName || "",
            photoURL: firebaseUser.photoURL || undefined,
          };
          setUser(userProfile);
          setIsGuest(false);
          await initializeSync(firebaseUser.uid);
        } else {
          console.log(
            "[AuthContext] No active user, setting guest mode (false).",
          );
          setIsGuest(false);
          setSyncState(SyncState.IDLE);
        }
      } catch (error) {
        console.error("[AuthContext] Error initializing auth:", error);
        setIsGuest(false);
        setSyncState(SyncState.IDLE);
      } finally {
        setLoading(false);
      }
    };

    const subscriber = onAuthStateChanged(getAuth(), async (firebaseUser) => {
      console.log("[AuthContext] onAuthStateChanged fired.");
      if (firebaseUser) {
        console.log(
          `[AuthContext] User signed in via onAuthStateChanged: ${firebaseUser.uid}`,
        );
        const userProfile: UserProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || "",
          displayName: firebaseUser.displayName || "",
          photoURL: firebaseUser.photoURL || undefined,
        };
        setUser(userProfile);
        setIsGuest(false);

        // Use refs to avoid stale closures — read the latest syncState/isGuest values
        const currentSyncState = syncStateRef.current;
        const currentIsGuest = isGuestRef.current;

        // If we are already mid-sync (e.g., from signIn flow), don't re-initialize.
        // Otherwise, this is a fresh app start with an existing authenticated session.
        if (
          currentSyncState === SyncState.IDLE ||
          currentSyncState === SyncState.AUTHENTICATING
        ) {
          await initializeSync(firebaseUser.uid);
        } else {
          console.log(
            "[AuthContext] Sync already in progress, skipping re-initialization from onAuthStateChanged.",
          );
        }
      } else {
        console.log(
          "[AuthContext] User signed out or no user detected via onAuthStateChanged.",
        );
        const currentIsGuest = isGuestRef.current;
        if (!currentIsGuest) {
          setUser(null);
          setSyncState(SyncState.IDLE);
        }
      }
      setLoading(false);
    });

    initializeAuth();

    return () => {
      console.log(
        "[AuthContext] Cleaning up auth listener and sync orchestrator.",
      );
      subscriber();
      syncOrchestrator.deinitialize(); // Ensure realtime listeners are unsubscribed
    };
  }, [isGuest, initializeSync]); // Removed syncState from deps — uses ref instead

  const contextValue = useMemo(
    () => ({
      user,
      loading,
      isGuest,
      signIn,
      signOut,
      continueAsGuest,
      syncState,
    }),
    [user, loading, isGuest, signIn, signOut, continueAsGuest, syncState],
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}

      <MigrationModal
        visible={showMigration}
        loading={migrationLoading}
        taskCount={migrationInfo?.taskCount ?? 0}
        onSelect={handleMigrationChoice}
      />
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;
