import { Colors } from "@/constants/theme";
import { taskService } from "@/services/taskService";
import { Task } from "@/types";
import { formatDueLabel, formatShortDate, isOverdue } from "@/utils/dateUtils";
import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import BottomSheet from "@/components/ui/BottomSheet";

type Props = {
  visible: boolean;
  task: Task | null;
  onClose: () => void;
  onTaskUpdated: () => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
};

const getPriorityColor = (priority?: "low" | "medium" | "high") => {
  switch (priority) {
    case "high":
      return Colors.light.priorityHighText;
    case "medium":
      return Colors.light.priorityMediumText;
    case "low":
      return Colors.light.priorityLowText;
    default:
      return Colors.light.textSecondary;
  }
};

const getPriorityBg = (priority?: "low" | "medium" | "high") => {
  switch (priority) {
    case "high":
      return Colors.light.priorityHighBackground;
    case "medium":
      return Colors.light.priorityMediumBackground;
    case "low":
      return Colors.light.priorityLowBackground;
    default:
      return Colors.light.card;
  }
};

const formatDateTime = (timestamp?: number) => {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const TaskDetailModal = ({
  visible,
  task,
  onClose,
  onTaskUpdated,
  onEdit,
  onDelete,
}: Props) => {
  if (!task) return null;

  const overdue = isOverdue(task.dueDate, task.completed);
  const priorityColor = getPriorityColor(task.priority);
  const priorityBg = getPriorityBg(task.priority);

  const handleToggle = async () => {
    await taskService.toggleTask(task.id);
    onTaskUpdated();
    onClose();
  };

  const handleEdit = () => {
    onClose();
    onEdit(task);
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Task",
      `Are you sure you want to delete "${task.text}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await taskService.deleteTask(task.id);
            onTaskUpdated();
            onClose();
          },
        },
      ],
    );
  };

  const dueLabel = task.dueDate ? formatDueLabel(task.dueDate) : null;
  const formattedDueDate = task.dueDate ? formatShortDate(task.dueDate) : null;
  const formattedReminder = task.reminderAt
    ? formatDateTime(task.reminderAt)
    : null;
  const formattedCreated = formatDateTime(task.createdAt);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Task Detail">
      <View style={styles.container}>
        {/* Task text */}
        <View style={styles.taskTextCard}>
          <Text
            style={[
              styles.taskText,
              task.completed && styles.taskTextCompleted,
            ]}
          >
            {task.text}
          </Text>
        </View>

        {/* Badges row */}
        <View style={styles.badgesRow}>
          {task.priority && (
            <View
              style={[
                styles.badge,
                { backgroundColor: priorityBg, borderColor: priorityColor },
              ]}
            >
              <Text style={[styles.badgeText, { color: priorityColor }]}>
                {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}{" "}
                Priority
              </Text>
            </View>
          )}

          {overdue && (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: Colors.light.overdueBackground,
                  borderColor: Colors.light.overdueText,
                },
              ]}
            >
              <Ionicons
                name="alert-circle"
                size={14}
                color={Colors.light.overdueText}
              />
              <Text
                style={[styles.badgeText, { color: Colors.light.overdueText }]}
              >
                Overdue
              </Text>
            </View>
          )}

          {task.completed && (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: Colors.light.tintLight,
                  borderColor: Colors.light.success,
                },
              ]}
            >
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={Colors.light.success}
              />
              <Text style={[styles.badgeText, { color: Colors.light.success }]}>
                Completed
              </Text>
            </View>
          )}
        </View>

        {/* Info rows */}
        <View style={styles.infoSection}>
          {task.dueDate && (
            <View style={styles.infoRow}>
              <Ionicons
                name="calendar-outline"
                size={16}
                color={overdue ? Colors.light.overdueText : Colors.light.tint}
              />
              <Text
                style={[
                  styles.infoText,
                  {
                    color: overdue
                      ? Colors.light.overdueText
                      : Colors.light.text,
                  },
                ]}
              >
                Due {dueLabel}
                {dueLabel !== "Today" &&
                  dueLabel !== "Tomorrow" &&
                  dueLabel !== "Overdue!" &&
                  ` (${formattedDueDate})`}
              </Text>
            </View>
          )}

          {formattedReminder && (
            <View style={styles.infoRow}>
              <Ionicons
                name="alarm-outline"
                size={16}
                color={Colors.light.tint}
              />
              <Text style={styles.infoText}>Reminder: {formattedReminder}</Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Ionicons
              name="time-outline"
              size={16}
              color={Colors.light.textSecondary}
            />
            <Text style={styles.infoSecondaryText}>
              Created {formattedCreated}
            </Text>
          </View>
        </View>

        {/* Complete button */}
        {!task.completed && (
          <TouchableOpacity
            style={styles.completeButton}
            onPress={handleToggle}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
            <Text style={styles.completeButtonText}>Mark Complete</Text>
          </TouchableOpacity>
        )}

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={handleEdit}
            activeOpacity={0.7}
          >
            <Ionicons
              name="pencil-outline"
              size={18}
              color={Colors.light.text}
            />
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            activeOpacity={0.7}
          >
            <Ionicons
              name="trash-outline"
              size={18}
              color={Colors.light.error}
            />
            <Text
              style={[styles.actionButtonText, { color: Colors.light.error }]}
            >
              Delete
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 4,
  },
  taskTextCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  taskText: {
    fontSize: 16,
    color: Colors.light.text,
    lineHeight: 28,
  },
  taskTextCompleted: {
    textDecorationLine: "line-through",
    color: Colors.light.textTertiary,
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "500",
  },
  infoSection: {
    gap: 12,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  infoText: {
    fontSize: 15,
    color: Colors.light.text,
  },
  infoSecondaryText: {
    fontSize: 15,
    color: Colors.light.textSecondary,
  },
  completeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.tint,
    borderRadius: 50,
    paddingVertical: 10,
    marginBottom: 12,
  },
  completeButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  editButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: "#FFFFFF",
  },
  deleteButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: Colors.light.error,
    backgroundColor: "#FFFFFF",
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: "500",
    color: Colors.light.text,
  },
});

export default TaskDetailModal;
