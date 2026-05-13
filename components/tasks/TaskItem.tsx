import { Colors } from "@/constants/theme";
import { Task } from "@/types";
import { formatDueLabel, isDueToday, isOverdue } from "@/utils/dateUtils";
import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  task: Task;
  isSelected: boolean;
  isSelectionMode: boolean;
  formatReminderDateTime: (date: Date) => string;
  onToggle: (taskId: string) => void;
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
  formatReminderDateTime,
  onToggle,
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
      {/* Mini completion circle — tap to quick-toggle */}
      <TouchableOpacity
        style={styles.taskCheckbox}
        onPress={(e) => {
          e.stopPropagation?.();
          onToggle(task.id);
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.6}
      >
        <View
          style={[
            styles.miniCircle,
            task.completed && styles.miniCircleCompleted,
          ]}
        >
          {task.completed && (
            <Ionicons name="checkmark" size={10} color="#FFFFFF" />
          )}
        </View>
      </TouchableOpacity>

      <View style={styles.taskContent}>
        <Text
          style={[styles.taskText, task.completed && styles.taskTextCompleted]}
          numberOfLines={2}
        >
          {task.text}
        </Text>

        {/* Meta badges — visible only when not in selection mode for cleaner look */}
        {!isSelectionMode && (
          <View style={styles.taskMetaRow}>
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
                    task.priority.slice(1)}
                </Text>
              </View>
            )}

            {/* Due Date Badge */}
            {task.dueDate &&
              (() => {
                const dueLabel = formatDueLabel(task.dueDate);
                const overdue = isOverdue(task.dueDate, task.completed);
                const dueToday = isDueToday(task.dueDate);

                let bgColor: string;
                let textColor: string;

                if (overdue) {
                  bgColor = Colors.light.overdueBackground;
                  textColor = Colors.light.overdueText;
                } else if (dueToday) {
                  bgColor = Colors.light.tintLight;
                  textColor = Colors.light.dueToday;
                } else {
                  bgColor = Colors.light.card;
                  textColor = Colors.light.textSecondary;
                }

                return (
                  <View
                    style={{
                      backgroundColor: bgColor,
                      borderColor: textColor,
                      borderWidth: 1,
                      borderRadius: 999,
                      paddingVertical: 4,
                      paddingHorizontal: 8,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    <Ionicons
                      name={overdue ? "alert-circle" : "calendar-outline"}
                      size={10}
                      color={textColor}
                    />
                    <Text
                      style={{ color: textColor, fontSize: 11 }}
                      numberOfLines={1}
                    >
                      {dueLabel}
                    </Text>
                  </View>
                );
              })()}

            {task.reminderAt &&
              (() => {
                const now = Date.now();
                const reminderOverdue = task.completed || task.reminderAt < now;
                return (
                  <View
                    style={{
                      backgroundColor: reminderOverdue
                        ? "rgba(239, 83, 80, 0.1)"
                        : Colors.light.tintLight,
                      borderColor: reminderOverdue
                        ? Colors.light.error
                        : Colors.light.tint,
                      borderWidth: 1,
                      borderRadius: 999,
                      paddingVertical: 4,
                      paddingHorizontal: 8,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    <Ionicons
                      name={reminderOverdue ? "alarm" : "alarm-outline"}
                      size={10}
                      color={
                        reminderOverdue ? Colors.light.error : Colors.light.tint
                      }
                    />
                    <Text
                      style={{
                        color: reminderOverdue
                          ? Colors.light.error
                          : Colors.light.tint,
                        fontSize: 11,
                      }}
                      numberOfLines={1}
                    >
                      {formatReminderDateTime(new Date(task.reminderAt))}
                    </Text>
                  </View>
                );
              })()}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  taskItem: {
    flexDirection: "row",
    alignItems: "flex-start",
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
  taskItemCompleted: { opacity: 0.55, backgroundColor: Colors.light.card },
  taskCheckbox: {
    marginRight: 12,
    marginTop: 2,
  },
  miniCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.light.iconDefault,
    alignItems: "center",
    justifyContent: "center",
  },
  miniCircleCompleted: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  taskContent: { flex: 1 },
  taskText: { fontSize: 16, color: Colors.light.text, fontWeight: "500" },
  taskTextCompleted: {
    textDecorationLine: "line-through",
    color: Colors.light.textTertiary,
  },
  taskMetaRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  taskMetaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: Colors.light.card,
    maxWidth: "100%",
    borderColor: Colors.light.border,
    borderWidth: 1,
  },
  taskMetaText: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
});

export default TaskItem;
