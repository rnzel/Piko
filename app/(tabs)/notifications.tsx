import AuthScreen from "@/components/tasks/AuthScreen";
import EmptyState from "@/components/ui/EmptyState";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const NotificationsScreen = () => {
  const { user, isGuest, signIn, continueAsGuest } = useAuth();
  const insets = useSafeAreaInsets();

  // Not logged in state
  if (!user && !isGuest) {
    return (
      <AuthScreen
        insetsTop={insets.top}
        onSignIn={signIn}
        onContinueAsGuest={continueAsGuest}
      />
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <EmptyState
          icon="notifications-outline"
          title="No notifications yet"
          subtitle="Updates about tasks, reminders, and group activity will appear here."
        />
      </ScrollView>
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
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
  },
});

export default NotificationsScreen;
