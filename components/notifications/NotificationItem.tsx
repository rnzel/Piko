import { Colors } from "@/constants/theme";
import { AppNotification } from "@/types";
import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  notification: AppNotification;
  isOverdue: boolean;
  onPress: (notificationId: string) => void;
  onLongPress?: (notificationId: string) => void;
};

const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

const NotificationItem = ({
  notification,
  isOverdue,
  onPress,
  onLongPress,
}: Props) => {
  const isRead = notification.read;

  return (
    <TouchableOpacity
      style={[styles.container, isRead ? styles.read : styles.unread]}
      onPress={() => onPress(notification.id)}
      onLongPress={() => onLongPress?.(notification.id)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${notification.title}, ${isRead ? "read" : "unread"}`}
    >
      <View style={styles.iconContainer}>
        <Ionicons
          name={isOverdue ? "alarm" : "alarm-outline"}
          size={20}
          color={isOverdue ? Colors.light.error : Colors.light.tint}
        />
      </View>
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text
            style={[styles.title, !isRead && styles.titleUnread]}
            numberOfLines={1}
          >
            {notification.title}
          </Text>
          <Text style={styles.time}>
            {formatRelativeTime(notification.createdAt)}
          </Text>
        </View>
        <Text style={styles.body} numberOfLines={2}>
          {notification.body}
        </Text>
      </View>
      {!isRead && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
  },
  unread: {
    borderColor: Colors.light.tint,
    backgroundColor: Colors.light.tintLight,
  },
  read: {
    borderColor: Colors.light.border,
    backgroundColor: "#FFFFFF",
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.card,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  title: {
    fontSize: 15,
    color: Colors.light.text,
    flex: 1,
    marginRight: 8,
  },
  titleUnread: {
    fontWeight: "700",
  },
  time: {
    fontSize: 11,
    color: Colors.light.textTertiary,
  },
  body: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.tint,
    marginLeft: 8,
  },
});

export default NotificationItem;
