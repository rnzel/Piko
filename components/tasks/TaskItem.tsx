import { Colors } from "@/constants/theme";
import { Task } from "@/types";
import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  task: Task;
  isSelected: boolean;
  isSelectionMode: boolean;
  getTaskFolderLabel: (task: Task) => string;
  formatReminderDateTime: (date: Date) => string;
  onPress: (taskId: string) => void;
  onLongPress: (taskId: string) => void;
};

const getPriorityStyles = (priority: "low" | "medium" | "high") => {
  switch (priority) {
    case "low":
      return {
        backgroundColor: Colors.light.priorityLowBackground,
        textColor: Colors.light.priorityLowText,
        borderColor: Colors.light.priorityLowText,
      };
    case "medium":
      return {
        backgroundColor: Colors.light.priorityMediumBackground,
        textColor: Colors.light.priorityMediumText,
        borderColor: Colors.light.priorityMediumText,
      };
    case "high":
      return {
        backgroundColor: Colors.light.priorityHighBackground,
        textColor: Colors.light.priorityHighText,
        borderColor: Colors.light.priorityHighText,
      };
    default:
      return {
        backgroundColor: Colors.light.card,
        textColor: Colors.light.textSecondary,
        borderColor: Colors.light.border,
      };
  }
};

const TaskItem = ({
  task,
  isSelected,
  isSelectionMode,
  getTaskFolderLabel,
  formatReminderDateTime,
  onPress,
  onLongPress,
}: Props) => {
  return (
    <TouchableOpacity
      style={[
        styles.taskItem,
        task.completed && styles.taskItemCompleted,
        isSelected && styles.taskItemSelected,
      ]}
      onPress={() =>
        isSelectionMode ? onLongPress(task.id) : onPress(task.id)
      }
      onLongPress={() => onLongPress(task.id)}
      delayLongPress={300}
      activeOpacity={0.7}
      accessibilityLabel={`${task.text}, ${task.completed ? "completed" : "pending"}`}
      accessibilityRole="button"
      accessibilityState={{
        selected: isSelected,
        checked: task.completed,
      }}
    >
      <View style={styles.taskCheckbox}>
        <Ionicons
          name={
            isSelectionMode
              ? isSelected
                ? "checkmark-circle"
                : "ellipse-outline"
              : task.completed
                ? "checkmark-circle"
                : "ellipse-outline"
          }
          size={24}
          color={
            isSelectionMode
              ? isSelected
                ? Colors.light.tint
                : Colors.light.iconDefault
              : task.completed
                ? Colors.light.tint
                : Colors.light.iconDefault
          }
        />
      </View>
      <View style={styles.taskContent}>
        <Text
          style={[styles.taskText, task.completed && styles.taskTextCompleted]}
          numberOfLines={2}
        >
          {task.text}
        </Text>
        <View style={styles.taskMetaRow}>
          <View style={styles.taskMetaBadge}>
            <Ionicons
              name="folder-open-outline"
              size={12}
              color={Colors.light.textSecondary}
            />
            <Text style={styles.taskMetaText} numberOfLines={1}>
              {getTaskFolderLabel(task)}
            </Text>
          </View>

          {task.priority && (
            <View
              style={[
                styles.taskMetaBadge,
                {
                  backgroundColor: getPriorityStyles(task.priority)
                    .backgroundColor,
                  borderColor: getPriorityStyles(task.priority).borderColor,
                },
              ]}
            >
              <Text
                style={[
                  styles.taskMetaText,
                  { color: getPriorityStyles(task.priority).textColor },
                ]}
              >
                {task.priority.charAt(0).toUpperCase() +
                  task.priority.slice(1) +
                  " Priority"}
              </Text>
            </View>
          )}

          {task.reminderAt &&
            (() => {
              const now = Date.now();
              const isOverdue = task.completed || task.reminderAt < now;
              return (
                <View
                  style={{
                    backgroundColor: isOverdue
                      ? "rgba(239, 83, 80, 0.1)"
                      : Colors.light.tintLight,
                    borderColor: isOverdue
                      ? Colors.light.error
                      : Colors.light.tint,
                    borderWidth: 1,
                    borderRadius: 999,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Ionicons
                    name={isOverdue ? "alarm" : "alarm-outline"}
                    size={12}
                    color={isOverdue ? Colors.light.error : Colors.light.tint}
                  />
                  <Text
                    style={{
                      color: isOverdue ? Colors.light.error : Colors.light.tint,
                      fontSize: 12,
                    }}
                    numberOfLines={1}
                  >
                    {formatReminderDateTime(new Date(task.reminderAt))}
                  </Text>
                </View>
              );
            })()}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  taskItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 32,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  taskItemSelected: {
    borderColor: Colors.light.tint,
    backgroundColor: Colors.light.tintLight,
  },
  taskItemCompleted: { opacity: 0.6, backgroundColor: Colors.light.card },
  taskCheckbox: { marginRight: 14 },
  taskContent: { flex: 1 },
  taskText: { fontSize: 17, color: Colors.light.text, fontWeight: "500" },
  taskTextCompleted: {
    textDecorationLine: "line-through",
    color: Colors.light.textTertiary,
  },
  taskMetaRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  taskMetaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: Colors.light.card,
    maxWidth: "100%",
    borderColor: Colors.light.border,
    borderWidth: 1,
  },
  taskMetaText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
});

export default TaskItem;
