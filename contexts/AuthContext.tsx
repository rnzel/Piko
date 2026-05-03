import {
    clearAllStorage,
    guestStorage,
    userStorage,
} from "@/services/storageService";
import { AuthState, UserProfile } from "@/types";
import {
    signOut as firebaseSignOut,
    getAuth,
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithCredential
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
    useState,
} from "react";
import { Alert } from "react-native";

const SIGN_IN_TIMEOUT_MS = 20000;

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  isGuest: false,
  signIn: async () => {},
  signOut: async () => {},
  continueAsGuest: () => {},
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  const signIn = useCallback(async () => {
    console.log("Starting sign in process...");
    try {
      // Force account picker
      await GoogleSignin.signOut();

      // Check if your device supports Google Play
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
      console.log("Play services available");

      // Get the users ID token
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
      console.log("Google Sign-In successful", JSON.stringify(signInResult));

      // Try the new style of google-sign in result, from v13+ of that module
      // @ts-ignore - for compatibility between different versions of the library
      let idToken = (signInResult as { data?: { idToken?: string } }).data
        ?.idToken;
      if (!idToken) {
        // if you are using older versions of google-signin, try old style result
        // @ts-ignore - for older versions
        idToken = (signInResult as { idToken?: string }).idToken;
      }
      if (!idToken) {
        throw new Error("No ID token found");
      }
      console.log("ID Token obtained");

      // Create a Google credential with the token
      const googleCredential = GoogleAuthProvider.credential(idToken);
      console.log("Firebase credential created");

      // Sign-in the user with the credential
      const firebaseUserCredential = await signInWithCredential(
        getAuth(),
        googleCredential,
      );
      console.log(
        "Firebase sign in successful",
        firebaseUserCredential.user.email,
      );

      // Save user profile
      const userProfile: UserProfile = {
        uid: firebaseUserCredential.user.uid,
        email: firebaseUserCredential.user.email || "",
        displayName: firebaseUserCredential.user.displayName || "",
        photoURL: firebaseUserCredential.user.photoURL || undefined,
      };
      await userStorage.saveUser(userProfile);
      await guestStorage.setIsGuest(false);
      setUser(userProfile);
      setIsGuest(false);
    } catch (error) {
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
  }, []);

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(getAuth());
      await GoogleSignin.signOut();
      await clearAllStorage();
      setUser(null);
      setIsGuest(false);
    } catch (error) {
      console.error("Error signing out:", error);
      Alert.alert("Sign-out failed", "There was an error signing out.");
    }
  }, []);

  const continueAsGuest = useCallback(async () => {
    await guestStorage.setIsGuest(true);
    setIsGuest(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Configure Google Sign-In
    GoogleSignin.configure({
      webClientId:
        "1015788618693-28qa1mih7g9tec9fmfsfin36eb8g91kl.apps.googleusercontent.com",
    });

    // Check initial auth state
    const initializeAuth = async () => {
      try {
        // Check if user is marked as guest
        const savedIsGuest = await guestStorage.getIsGuest();
        if (savedIsGuest) {
          setIsGuest(true);
          setLoading(false);
          return;
        }

        // Check if user is logged in with Firebase
        const firebaseUser = getAuth().currentUser;
        if (firebaseUser) {
          const userProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || "",
            displayName: firebaseUser.displayName || "",
            photoURL: firebaseUser.photoURL || undefined,
          };
          setUser(userProfile);
          setIsGuest(false);
        } else {
          // No user logged in, show guest option
          setIsGuest(false);
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
        setIsGuest(false);
      } finally {
        setLoading(false);
      }
    };

    // Subscribe to auth state changes
    const subscriber = onAuthStateChanged(getAuth(), (firebaseUser) => {
      if (firebaseUser) {
        const userProfile: UserProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || "",
          displayName: firebaseUser.displayName || "",
          photoURL: firebaseUser.photoURL || undefined,
        };
        setUser(userProfile);
        setIsGuest(false);
      } else {
        // Only clear user if not a guest
        if (!isGuest) {
          setUser(null);
        }
      }
      setLoading(false);
    });

    initializeAuth();

    return subscriber;
  }, [isGuest]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isGuest,
        signIn,
        signOut,
        continueAsGuest,
      }}
    >
      {children}
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
