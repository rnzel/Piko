import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import {
  Alert,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

const ProfileScreen = () => {
  const { user, isGuest, signIn, signOut, continueAsGuest } = useAuth();
  const insets = useSafeAreaInsets();

  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out? Your tasks will remain saved on this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              console.error("Error signing out:", error);
            }
          },
        },
      ],
    );
  };

  // Not logged in state - show login prompt
  if (!user && !isGuest) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
        <View style={styles.authContainer}>
          <View style={styles.avatarPlaceholder}>
            <Ionicons
              name="person-outline"
              size={40}
              color={Colors.light.textTertiary}
            />
          </View>
          <Text style={styles.authTitle}>Welcome to Piko</Text>
          <Text style={styles.authSubtitle}>
            Sign in to sync your tasks across devices and collaborate with
            others.
          </Text>

          <TouchableOpacity style={styles.signInButton} onPress={signIn}>
            <Ionicons name="logo-google" size={20} color="#FFFFFF" />
            <Text style={styles.signInButtonText}>Sign in with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.signInButton, styles.guestButton]}
            onPress={continueAsGuest}
          >
            <Text style={styles.guestButtonText}>Continue as Guest</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Guest mode
  if (isGuest && !user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
        <View style={styles.authContainer}>
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={40} color={Colors.light.tint} />
          </View>
          <Text style={styles.authTitle}>Guest Mode</Text>
          <Text style={styles.authSubtitle}>
            Your tasks are saved locally on this device. Sign in to sync across
            devices.
          </Text>

          <TouchableOpacity style={styles.signInButton} onPress={signIn}>
            <Ionicons name="logo-google" size={20} color="#FFFFFF" />
            <Text style={styles.signInButtonText}>Sign in with Google</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Logged in state
  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {user?.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {user?.displayName?.charAt(0).toUpperCase() || "U"}
                </Text>
              </View>
            )}
            <View style={styles.onlineIndicator} />
          </View>
          <Text style={styles.userName}>{user?.displayName || "User"}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        {/* Sync Status */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons
              name="checkmark-done-circle-outline"
              size={20}
              color={Colors.light.success}
            />
            <Text style={styles.sectionTitle}>Sync Status</Text>
          </View>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Synced with cloud</Text>
            </View>
            <Text style={styles.statusSubtext}>
              Your tasks are automatically synced across all your devices.
            </Text>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.menuContainer}>
            <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
              <View style={styles.menuIconContainer}>
                <Ionicons
                  name="person-outline"
                  size={22}
                  color={Colors.light.iconDefault}
                />
              </View>
              <Text style={styles.menuItemText}>Edit Profile</Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={Colors.light.textTertiary}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
              <View style={styles.menuIconContainer}>
                <Ionicons
                  name="notifications-outline"
                  size={22}
                  color={Colors.light.iconDefault}
                />
              </View>
              <Text style={styles.menuItemText}>Notifications</Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={Colors.light.textTertiary}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
              <View style={styles.menuIconContainer}>
                <Ionicons
                  name="lock-closed-outline"
                  size={22}
                  color={Colors.light.iconDefault}
                />
              </View>
              <Text style={styles.menuItemText}>Privacy & Security</Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={Colors.light.textTertiary}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
              <View style={styles.menuIconContainer}>
                <Ionicons
                  name="help-circle-outline"
                  size={22}
                  color={Colors.light.iconDefault}
                />
              </View>
              <Text style={styles.menuItemText}>Help & Support</Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={Colors.light.textTertiary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* App Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App</Text>
          <View style={styles.menuContainer}>
            <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
              <View style={styles.menuIconContainer}>
                <Ionicons
                  name="color-palette-outline"
                  size={22}
                  color={Colors.light.iconDefault}
                />
              </View>
              <Text style={styles.menuItemText}>Appearance</Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={Colors.light.textTertiary}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
              <View style={styles.menuIconContainer}>
                <Ionicons
                  name="language-outline"
                  size={22}
                  color={Colors.light.iconDefault}
                />
              </View>
              <Text style={styles.menuItemText}>Language</Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={Colors.light.textTertiary}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
              <View style={styles.menuIconContainer}>
                <Ionicons
                  name="information-circle-outline"
                  size={22}
                  color={Colors.light.iconDefault}
                />
              </View>
              <Text style={styles.menuItemText}>About</Text>
              <Text style={styles.menuItemVersion}>v1.0.0</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          activeOpacity={0.7}
        >
          <Ionicons
            name="log-out-outline"
            size={20}
            color={Colors.light.error}
          />
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Bottom padding */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Bottom padding for tab bar */}
      <View style={{ height: 100 }} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 20,
  },
  authContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.light.tintLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "bold",
    color: Colors.light.tint,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.light.text,
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: "center",
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  signInButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.tint,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    width: width * 0.8,
    marginBottom: 12,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  signInButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  guestButton: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  guestButtonText: {
    color: Colors.light.textSecondary,
    fontSize: 16,
    fontWeight: "600",
  },
  profileHeader: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 24,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.light.success,
    borderWidth: 3,
    borderColor: Colors.light.background,
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.light.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  statusCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.light.success,
    marginRight: 10,
  },
  statusText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.success,
  },
  statusSubtext: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 20,
  },
  menuContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.light.card,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: Colors.light.text,
    fontWeight: "500",
  },
  menuItemVersion: {
    fontSize: 14,
    color: Colors.light.textTertiary,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.error,
  },
});

export default ProfileScreen;
