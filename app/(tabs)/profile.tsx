import AuthScreen from "@/components/tasks/AuthScreen";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { notificationService } from "@/services/notificationService";
import { SyncState } from "@/types";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

const ProfileScreen = () => {
  const {
    user,
    isGuest,
    isOffline,
    signIn,
    signOut,
    continueAsGuest,
    syncState,
    syncError,
  } = useAuth();
  const insets = useSafeAreaInsets();
  const [prefs, setPrefs] = useState({ sound: true, vibrate: true });

  const syncStatusConfig = React.useMemo(() => {
    if (isOffline) {
      return {
        title: "Offline",
        badge: "Offline",
        description:
          "You’re not connected to the internet. Your changes stay on this device and will sync when you’re back online.",
      };
    }

    switch (syncState) {
      case SyncState.DEGRADED:
        return {
          title: "Sync degraded",
          badge: "Retrying",
          description:
            syncError ||
            "Some cloud sync operations failed. Your local data is preserved and retries will continue.",
        };
      case SyncState.ERROR:
        return {
          title: "Sync error",
          badge: "Error",
          description:
            syncError ||
            "Cloud sync is currently unavailable. Your local data remains on this device.",
        };
      case SyncState.AUTHENTICATING:
      case SyncState.MIGRATING:
      case SyncState.UPLOADING_LOCAL:
      case SyncState.HYDRATING:
      case SyncState.REALTIME_READY:
        return {
          title: "Syncing",
          badge: "Syncing",
          description: "Your tasks are syncing across devices.",
        };
      case SyncState.READY:
      default:
        return {
          title: "Synced",
          badge: "Synced",
          description: "Your tasks automatically sync across all your devices.",
        };
    }
  }, [isOffline, syncError, syncState]);

  useEffect(() => {
    notificationService.getPreferences().then(setPrefs);
  }, []);

  const previewSoundSample = useCallback(async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Sound enabled",
          body: "This is how your reminder sound will play.",
          sound: "default",
        },
        trigger: null,
      });
    } catch (error) {
      console.error("Error previewing notification sound:", error);
    }
  }, []);

  const previewVibrationSample = useCallback(async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.warn(
        "Haptics preview unavailable, using vibration fallback:",
        error,
      );
      Vibration.vibrate([0, 150, 80, 150]);
    }
  }, []);

  const handleToggleSound = useCallback(
    async (value: boolean) => {
      const next = { ...prefs, sound: value };
      setPrefs(next);
      await notificationService.setPreferences(next);

      if (value) {
        await previewSoundSample();
      }
    },
    [prefs, previewSoundSample],
  );

  const handleToggleVibrate = useCallback(
    async (value: boolean) => {
      const next = { ...prefs, vibrate: value };
      setPrefs(next);
      await notificationService.setPreferences(next);

      if (value) {
        await previewVibrationSample();
      }
    },
    [prefs, previewVibrationSample],
  );

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
      <AuthScreen
        insetsTop={insets.top}
        onSignIn={signIn}
        onContinueAsGuest={continueAsGuest}
      />
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
          <View style={styles.statusCard}>
            <View style={styles.statusCardContent}>
              <View style={styles.statusTopRow}>
                <Text style={styles.statusText}>{syncStatusConfig.title}</Text>
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>{syncStatusConfig.badge}</Text>
                </View>
              </View>
              <Text style={styles.statusSubtext}>
                {syncStatusConfig.description}
              </Text>
            </View>
          </View>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.settingsContainer}>
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIconContainer}>
                  <Ionicons
                    name="volume-high-outline"
                    size={20}
                    color={Colors.light.iconDefault}
                  />
                </View>
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingLabel}>Sound</Text>
                  <Text style={styles.settingDescription}>
                    Play a sound when a reminder arrives
                  </Text>
                </View>
              </View>
              <Switch
                value={prefs.sound}
                onValueChange={handleToggleSound}
                trackColor={{
                  false: Colors.light.border,
                  true: Colors.light.tintMedium,
                }}
                thumbColor={prefs.sound ? Colors.light.tint : "#f4f3f4"}
              />
            </View>

            <View style={styles.settingDivider} />

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIconContainer}>
                  <Ionicons
                    name="notifications-outline"
                    size={20}
                    color={Colors.light.iconDefault}
                  />
                </View>
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingLabel}>Vibrate</Text>
                  <Text style={styles.settingDescription}>
                    Vibrate the device on notification
                  </Text>
                </View>
              </View>
              <Switch
                value={prefs.vibrate}
                onValueChange={handleToggleVibrate}
                trackColor={{
                  false: Colors.light.border,
                  true: Colors.light.tintMedium,
                }}
                thumbColor={prefs.vibrate ? Colors.light.tint : "#f4f3f4"}
              />
            </View>
          </View>
        </View>

        {/* App Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App</Text>
          <View style={styles.menuContainer}>
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
    borderRadius: 50,
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
    borderRadius: 50,
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
    backgroundColor: Colors.light.tint,
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
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  statusCard: {
    borderColor: Colors.light.border,
    borderWidth: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  statusCardContent: {
    flex: 1,
  },
  statusTopRow: {
    justifyContent: "center",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 10,
  },
  statusText: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.tintLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.light.tint,
  },
  liveText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.light.tint,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statusSubtext: {
    justifyContent: "center",
    textAlign: "center",
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 20,
  },
  settingsContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  settingIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.light.card,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: Colors.light.text,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    lineHeight: 16,
  },
  settingDivider: {
    height: 1,
    backgroundColor: Colors.light.divider,
    marginHorizontal: 16,
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
