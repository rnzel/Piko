import NotificationItem from "@/components/notifications/NotificationItem";
import AuthScreen from "@/components/tasks/AuthScreen";
import EmptyState from "@/components/ui/EmptyState";
import Loading from "@/components/ui/Loading";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { notificationService } from "@/services/notificationService";
import { taskService } from "@/services/taskService";
import { AppNotification } from "@/types";
import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const NotificationsScreen = () => {
  const { user, isGuest, signIn, continueAsGuest } = useAuth();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Cache task overdue states by taskId to avoid repeated lookups
  const [overdueCache, setOverdueCache] = useState<Record<string, boolean>>({});

  // Load notifications from storage
  const loadNotifications = useCallback(async () => {
    try {
      const items = await notificationService.getNotifications();
      setNotifications(items);

      // Build overdue cache by checking related tasks
      const allTasks = await taskService.getTasks();
      const taskMap = new Map(allTasks.map((t) => [t.id, t]));
      const cache: Record<string, boolean> = {};
      const now = Date.now();
      for (const n of items) {
        if (n.type === "task_reminder" && n.data?.taskId) {
          const task = taskMap.get(n.data.taskId);
          if (task) {
            cache[n.data.taskId] =
              task.completed ||
              (task.reminderAt ? task.reminderAt < now : false);
          } else {
            // Task might have been deleted, still show as overdue
            cache[n.data.taskId] = true;
          }
        }
      }
      setOverdueCache(cache);
    } catch (e) {
      console.error("Failed to load notifications:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Refresh on focus
  React.useEffect(() => {
    const unsubscribe = () => {
      loadNotifications();
    };
    loadNotifications();
    return unsubscribe;
  }, [loadNotifications]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }, [loadNotifications]);

  // Handle tapping a notification: mark as read
  const handleNotificationPress = useCallback(
    async (notificationId: string) => {
      await notificationService.markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId
            ? { ...n, read: true, readAt: Date.now() }
            : n,
        ),
      );
    },
    [],
  );

  // Handle long-press: show ActionSheet with delete / mark as read
  const handleNotificationLongPress = useCallback(
    (notificationId: string) => {
      const notification = notifications.find((n) => n.id === notificationId);
      if (!notification) return;

      const options: string[] = [];
      if (!notification.read) {
        options.push("Mark as Read");
      }
      options.push("Delete");

      Alert.alert(notification.title, undefined, [
        ...options.map((option) => ({
          text: option,
          style:
            option === "Delete"
              ? ("destructive" as const)
              : ("default" as const),
          onPress: async () => {
            if (option === "Mark as Read") {
              await notificationService.markAsRead(notificationId);
              setNotifications((prev) =>
                prev.map((n) =>
                  n.id === notificationId
                    ? { ...n, read: true, readAt: Date.now() }
                    : n,
                ),
              );
            } else if (option === "Delete") {
              await notificationService.deleteNotification(notificationId);
              setNotifications((prev) =>
                prev.filter((n) => n.id !== notificationId),
              );
            }
          },
        })),
        { text: "Cancel", style: "cancel" },
      ]);
    },
    [notifications],
  );

  // Handle Mark All as Read
  const handleMarkAllAsRead = useCallback(async () => {
    await notificationService.markAllAsRead();
    setNotifications((prev) =>
      prev.map((n) => (n.read ? n : { ...n, read: true, readAt: Date.now() })),
    );
  }, []);

  // Determine if a notification's related task is overdue
  const getIsOverdue = useCallback(
    (notification: AppNotification): boolean => {
      if (notification.type !== "task_reminder") return false;
      const taskId = notification.data?.taskId;
      if (!taskId) return false;
      return overdueCache[taskId] ?? true;
    },
    [overdueCache],
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

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
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {notifications.length > 0 && (
            <Text style={styles.headerCount}>{notifications.length}</Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={handleMarkAllAsRead}
            activeOpacity={0.7}
            style={styles.markAllButton}
          >
            <Text style={styles.markAllText}>Mark all as read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationItem
            notification={item}
            isOverdue={getIsOverdue(item)}
            onPress={handleNotificationPress}
            onLongPress={handleNotificationLongPress}
          />
        )}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 100 },
          notifications.length === 0 && styles.listEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? (
            <Loading />
          ) : (
            <EmptyState
              icon="notifications-outline"
              title="No notifications yet"
              subtitle="Updates about tasks and reminders will appear here."
            />
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Colors.light.tint]}
            tintColor={Colors.light.tint}
          />
        }
      />
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: Colors.light.text,
  },
  headerCount: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.textTertiary,
    backgroundColor: Colors.light.card,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: "hidden",
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.light.tintLight,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.tint,
  },
  listContent: {
    flexGrow: 1,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: "center",
  },
});

export default NotificationsScreen;
