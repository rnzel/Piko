import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import "react-native-reanimated";

import { AuthProvider } from "@/contexts/AuthContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { notificationService } from "@/services/notificationService";

// Configure how notifications are shown when the app is in the foreground
// Reads user preferences dynamically for sound and vibrate behavior
Notifications.setNotificationHandler({
  handleNotification: async () => {
    try {
      const prefs = await notificationService.getPreferences();
      return {
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: prefs.sound,
        shouldSetBadge: false,
      };
    } catch {
      return {
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      };
    }
  },
});

// Create Android notification channel once at startup.
// Channel settings (vibration, sound, importance) override per-notification payload.
// Android caches channels aggressively — reinstall app if changes don't apply.
// NOTE: sound is NOT set here — it's controlled per-notification in scheduleReminder()
// via sound: undefined (system default) vs sound: false (silent).
Notifications.setNotificationChannelAsync("tasks", {
  name: "Task Reminders",
  importance: Notifications.AndroidImportance.HIGH,
  vibrationPattern: [0, 200, 100, 200],
  enableVibrate: true,
  lightColor: "#5E748C",
}).catch((e) =>
  console.warn("[RootLayout] Failed to create notification channel", e),
);

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Request notification permissions on launch
    notificationService.requestPermissions();
  }, []);

  // Listen for notification taps (when user taps a notification from the system tray)
  useEffect(() => {
    const receivedListener = Notifications.addNotificationReceivedListener(
      async (notification) => {
        const taskId = notification.request.content.data?.taskId as
          | string
          | undefined;
        if (!taskId) return;

        await notificationService.createAppNotification(
          taskId,
          notification.request.content.title || "Task Reminder",
          notification.request.content.body || "You have a task reminder.",
          Date.now(),
        );
      },
    );

    const responseListener =
      Notifications.addNotificationResponseReceivedListener(
        async (response) => {
          const taskId = response.notification.request.content.data?.taskId as
            | string
            | undefined;
          if (taskId) {
            const notificationId =
              await notificationService.createAppNotification(
                taskId,
                response.notification.request.content.title || "Task Reminder",
                response.notification.request.content.body ||
                  "You have a task reminder.",
                Date.now(),
              );
            // Mark the corresponding in-app notification as read
            await notificationService.markAsRead(notificationId);
          }
        },
      );

    return () => {
      receivedListener.remove();
      responseListener.remove();
    };
  }, []);

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
