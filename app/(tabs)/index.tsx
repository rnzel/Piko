import {
  FirebaseAuthTypes,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signOut,
} from "@react-native-firebase/auth";
import {
  GoogleSignin,
  GoogleSigninButton,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import React, { useEffect, useState } from "react";
import { Alert, Button, StyleSheet, Text, View } from "react-native";

GoogleSignin.configure({
  webClientId:
    "1015788618693-28qa1mih7g9tec9fmfsfin36eb8g91kl.apps.googleusercontent.com",
});

const SIGN_IN_TIMEOUT_MS = 20000;

const Index = () => {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);

  const signIn = async () => {
    console.log("Starting sign in process...");
    try {
      // force account picker
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
      return firebaseUserCredential;
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
            // operation (eg. sign in) already in progress
            Alert.alert("Sign-in in progress", "Please wait and try again.");
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            // Android only, play services not available or outdated
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
        // an error that's not related to google sign in occurred
        console.error(error);
        Alert.alert(
          "Sign-in failed",
          error instanceof Error ? error.message : "Unknown sign-in error",
        );
      }
    }
  };

  // Handle user state changes
  function handleAuthStateChanged(user: FirebaseAuthTypes.User | null) {
    console.log("Auth state changed:", user ? user.email : "no user");
    setUser(user);
    if (initializing) setInitializing(false);
  }

  useEffect(() => {
    const subscriber = onAuthStateChanged(getAuth(), handleAuthStateChanged);
    return subscriber; // unsubscribe on unmount
  }, []);

  if (initializing) return null;

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Login</Text>
        <GoogleSigninButton onPress={signIn} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>Welcome {user.email}</Text>
      <Button title="Sign Out" onPress={() => signOut(getAuth())} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
  },
  welcome: {
    fontSize: 18,
  },
});

export default Index;
