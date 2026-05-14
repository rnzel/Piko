import { notificationStorage } from "@/services/storageService";
import { AppNotification } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

/**
 * Notification service using expo-notifications for local reminders.
 * - Schedules notifications and stores mapping taskId -> scheduledId in AsyncStorage.
 * - Cancels scheduled notifications and cleans up mapping.
 * - Creates and persists in-app AppNotification records for the notification screen.
 *
 * This keeps a lightweight, non-breaking integration for local reminders.
 */

const STORAGE_KEY = "@piko_notifications_map";

type NotificationMap = Record<string, string>; // taskId -> expo scheduledId

async function loadMap(): Promise<NotificationMap> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    return json ? JSON.parse(json) : {};
  } catch (e) {
    console.error("notificationService: failed to load map", e);
    return {};
  }
}

async function saveMap(map: NotificationMap): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.error("notificationService: failed to save map", e);
  }
}

/** Generate a unique id for local AppNotification records */
function generateNotificationId(): string {
  return `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export const notificationService = {
  // Request permissions for notifications (returns granted boolean)
  async requestPermissions(): Promise<boolean> {
    try {
      const permissions = await Notifications.requestPermissionsAsync();
      const granted =
        (permissions as { status?: string }).status === "granted" ||
        (permissions as { status?: string }).status === "provisional";
      console.log(
        "[notificationService] permission status:",
        (permissions as { status?: string }).status,
      );
      return granted;
    } catch (e) {
      console.error("[notificationService] requestPermissions error", e);
      return false;
    }
  },

  // Get all in-app notification records
  async getNotifications(): Promise<AppNotification[]> {
    return await notificationStorage.getNotifications();
  },

  // Get unread notification count
  async getUnreadCount(): Promise<number> {
    return await notificationStorage.getUnreadCount();
  },

  // Mark a notification as read
  async markAsRead(notificationId: string): Promise<void> {
    await notificationStorage.markAsRead(notificationId);
  },

  // Mark all notifications as read
  async markAllAsRead(): Promise<void> {
    await notificationStorage.markAllAsRead();
  },

  // Delete a notification
  async deleteNotification(notificationId: string): Promise<void> {
    await notificationStorage.deleteNotification(notificationId);
  },

  // Create an in-app AppNotification record
  async createAppNotification(
    taskId: string,
    title: string,
    body: string,
  ): Promise<void> {
    const notification: AppNotification = {
      id: generateNotificationId(),
      type: "task_reminder",
      title,
      body,
      data: { taskId },
      read: false,
      createdAt: Date.now(),
    };
    await notificationStorage.addNotification(notification);
    console.log(
      `[notificationService] created in-app notification id=${notification.id} for task=${taskId}`,
    );
  },

  // Schedule a local reminder for a task id at a unix timestamp (ms)
  // Also creates a persistent in-app notification record.
  // Respects user's sound and vibrate preferences automatically.
  async scheduleReminder(
    taskId: string,
    timestamp: number,
    taskText?: string,
  ): Promise<void> {
    try {
      // ensure timestamp is in the future
      const now = Date.now();
      const triggerDate = new Date(Math.max(timestamp, now + 1000));

      // Read user preferences — no refresh needed, reads fresh from storage
      const prefs = await this.getPreferences();

      const scheduledId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Task Reminder",
          body: taskText || "You have a task reminder.",
          data: { taskId },
          // sound: undefined → plays default sound; false → silent
          sound: prefs.sound ? undefined : false,
          // Android-specific vibrate & channel targeting
          // Channel must be created via setNotificationChannelAsync before scheduling.
          ...(prefs.vibrate
            ? ({
                android: {
                  channelId: "tasks",
                  enableVibrate: true,
                  vibrationPattern: [0, 200, 100, 200],
                },
              } as any)
            : ({
                android: {
                  channelId: "tasks",
                  enableVibrate: false,
                },
              } as any)),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE as string,
          date: triggerDate,
        } as any,
      });

      const map = await loadMap();
      map[taskId] = scheduledId;
      await saveMap(map);

      console.log(
        `[notificationService] scheduled reminder for task=${taskId} id=${scheduledId} at=${triggerDate.toISOString()}`,
      );

      // Create in-app notification record
      await this.createAppNotification(
        taskId,
        "Task Reminder",
        `Reminder set for: ${taskText || "a task"}`,
      );
    } catch (e) {
      console.error("[notificationService] scheduleReminder error", e);
    }
  },

  // Get notification preferences (sound, vibrate)
  async getPreferences(): Promise<{ sound: boolean; vibrate: boolean }> {
    try {
      const json = await AsyncStorage.getItem("@piko_notification_prefs");
      if (json) return JSON.parse(json);
      return { sound: true, vibrate: true };
    } catch (e) {
      console.error("[notificationService] getPreferences error", e);
      return { sound: true, vibrate: true };
    }
  },

  // Save notification preferences
  async setPreferences(prefs: {
    sound: boolean;
    vibrate: boolean;
  }): Promise<void> {
    try {
      await AsyncStorage.setItem(
        "@piko_notification_prefs",
        JSON.stringify(prefs),
      );
    } catch (e) {
      console.error("[notificationService] setPreferences error", e);
    }
  },

  // Cancel scheduled reminder by task id
  async cancelReminder(taskId: string): Promise<void> {
    try {
      const map = await loadMap();
      const scheduledId = map[taskId];
      if (scheduledId) {
        await Notifications.cancelScheduledNotificationAsync(scheduledId);
        delete map[taskId];
        await saveMap(map);
        console.log(
          `[notificationService] cancelled reminder for task=${taskId} scheduledId=${scheduledId}`,
        );
      }
    } catch (e) {
      console.error("[notificationService] cancelReminder error", e);
    }
  },
};

export default notificationService;
