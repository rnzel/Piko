import { Colors } from "@/constants/theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const NotificationsScreen = () => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.emptyState}>
          <View style={styles.iconContainer}>
            <Ionicons
              name="notifications-outline"
              size={36}
              color={Colors.light.tint}
            />
          </View>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySubtitle}>
            Updates about tasks, reminders, and group activity will appear here.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

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
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: Colors.light.text,
  },
  emptyState: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: "center",
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.light.tintLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});

export default NotificationsScreen;
