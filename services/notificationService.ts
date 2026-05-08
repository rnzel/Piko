import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

/**
 * Notification service using expo-notifications for local reminders.
 * - Schedules notifications and stores mapping taskId -> scheduledId in AsyncStorage.
 * - Cancels scheduled notifications and cleans up mapping.
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

export const notificationService = {
  // Request permissions for notifications (returns granted boolean)
  async requestPermissions(): Promise<boolean> {
    try {
      const permissions = await Notifications.requestPermissionsAsync();
      // NotificationPermissionsStatus extends PermissionResponse, which has `status`.
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

  // Schedule a local reminder for a task id at a unix timestamp (ms)
  async scheduleReminder(
    taskId: string,
    timestamp: number,
    taskText?: string,
  ): Promise<void> {
    try {
      // ensure timestamp is in the future
      const now = Date.now();
      const triggerDate = new Date(Math.max(timestamp, now + 1000));

      const scheduledId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Task Reminder",
          body: taskText || "You have a task reminder.",
          data: { taskId },
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
    } catch (e) {
      console.error("[notificationService] scheduleReminder error", e);
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
