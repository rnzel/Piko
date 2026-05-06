import { Colors } from "@/constants/theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import {
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

const { width } = Dimensions.get("window");

type Props = {
  insetsTop: number;
  onSignIn: () => void;
  onContinueAsGuest: () => void;
};

const AuthScreen = ({ insetsTop, onSignIn, onContinueAsGuest }: Props) => {
  return (
    <View style={[styles.container, { paddingTop: insetsTop + 20 }]}>
      <View style={styles.authContainer}>
        <Text style={styles.greeting}>Hi there</Text>
        <Text style={styles.subtitle}>Welcome to Piko</Text>
        <Text style={styles.description}>
          Sign in to sync your tasks across devices, or continue as a guest to
          use Piko locally.
        </Text>

        <TouchableOpacity style={styles.authButton} onPress={onSignIn}>
          <Ionicons name="logo-google" size={20} color="#FFFFFF" />
          <Text style={styles.authButtonText}>Sign in with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.authButton, styles.guestButton]}
          onPress={onContinueAsGuest}
        >
          <Text style={styles.guestButtonText}>Continue as Guest</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  authContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  greeting: {
    fontSize: 26,
    fontWeight: "bold",
    color: Colors.light.text,
    marginBottom: 6,
    paddingHorizontal: 20,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    paddingHorizontal: 20,
  },
  description: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 32,
    lineHeight: 22,
  },
  authButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.tint,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    width: width * 0.8,
    marginBottom: 12,
  },
  authButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  guestButton: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: Colors.light.border,
  },
  guestButtonText: {
    color: Colors.light.textSecondary,
    fontSize: 16,
    fontWeight: "600",
  },
});

export default AuthScreen;
