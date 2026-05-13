import { Colors } from "@/constants/theme";
import { taskService } from "@/services/taskService";
import { Task } from "@/types";
import { isOverdue } from "@/utils/dateUtils";
import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import BottomSheet from "@/components/ui/BottomSheet";

type Props = {
  visible: boolean;
  dateString: string | null; // "YYYY-MM-DD" of selected day
  onClose: () => void;
  onTaskToggle: () => void; // called after toggling to refresh parent
  onAddTask: (dueDate: number) => void;
};

const priorityOrder = { high: 0, medium: 1, low: 2 };

const DayTasksModal = ({
  visible,
  dateString,
  onClose,
  onTaskToggle,
  onAddTask,
}: Props) => {
  const [tasks, setTasks] = useState<Task[]>([]);

  const loadTasks = useCallback(async () => {
    if (!dateString) return;
    const allTasks = await taskService.getTasks();
    // Get start-of-day timestamp for this dateString
    const [year, month, day] = dateString.split("-").map(Number);
    const targetDate = new Date(year, month - 1, day);
    targetDate.setHours(0, 0, 0, 0);
    const targetTs = targetDate.getTime();

    const filtered = allTasks.filter((t) => {
      if (!t.dueDate) return false;
      return t.dueDate === targetTs;
    });

    // Sort: incomplete first, then by priority (high→low), then by createdAt
    filtered.sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      const pDiff =
        (priorityOrder[a.priority ?? "medium"] ?? 1) -
        (priorityOrder[b.priority ?? "medium"] ?? 1);
      if (pDiff !== 0) return pDiff;
      return b.createdAt - a.createdAt;
    });

    setTasks(filtered);
  }, [dateString]);

  useEffect(() => {
    if (visible) {
      loadTasks();
    } else {
      setTasks([]);
    }
  }, [visible, dateString, loadTasks]);

  const handleToggle = async (taskId: string) => {
    await taskService.toggleTask(taskId);
    await loadTasks();
    onTaskToggle();
  };

  const handleAddTask = () => {
    if (!dateString) return;
    const [year, month, day] = dateString.split("-").map(Number);
    const targetDate = new Date(year, month - 1, day);
    targetDate.setHours(0, 0, 0, 0);
    onAddTask(targetDate.getTime());
  };

  const headerDate = useMemo(() => {
    if (!dateString) return "";
    const [year, month, day] = dateString.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, [dateString]);

  const overdueCount = useMemo(
    () =>
      tasks.filter((t) => !t.completed && isOverdue(t.dueDate, t.completed))
        .length,
    [tasks],
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} title={headerDate}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.taskCount}>
            {tasks.length} task{tasks.length !== 1 ? "s" : ""}
            {overdueCount > 0 && (
              <Text style={styles.overdueCount}> · {overdueCount} overdue</Text>
            )}
          </Text>
        </View>

        {tasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="calendar-outline"
              size={40}
              color={Colors.light.textTertiary}
            />
            <Text style={styles.emptyText}>No tasks due this day</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.taskList}
            showsVerticalScrollIndicator={false}
          >
            {tasks.map((task) => {
              const overdue = isOverdue(task.dueDate, task.completed);
              const getPriorityColor = () => {
                switch (task.priority) {
                  case "high":
                    return Colors.light.priorityHighText;
                  case "medium":
                    return Colors.light.priorityMediumText;
                  default:
                    return Colors.light.priorityLowText;
                }
              };

              return (
                <TouchableOpacity
                  key={task.id}
                  style={[
                    styles.taskRow,
                    task.completed && styles.taskRowCompleted,
                  ]}
                  onPress={() => handleToggle(task.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.taskCheckbox}>
                    <Ionicons
                      name={
                        task.completed ? "checkmark-circle" : "ellipse-outline"
                      }
                      size={22}
                      color={
                        task.completed
                          ? Colors.light.tint
                          : Colors.light.iconDefault
                      }
                    />
                  </View>
                  <View style={styles.taskContent}>
                    <Text
                      style={[
                        styles.taskText,
                        task.completed && styles.taskTextCompleted,
                      ]}
                      numberOfLines={2}
                    >
                      {task.text}
                    </Text>
                    <View style={styles.taskMetaRow}>
                      <View
                        style={[
                          styles.priorityDot,
                          { backgroundColor: getPriorityColor() },
                        ]}
                      />
                      <Text style={styles.priorityText}>
                        {task.priority
                          ? task.priority.charAt(0).toUpperCase() +
                            task.priority.slice(1)
                          : "Medium"}{" "}
                        Priority
                      </Text>
                      {overdue && (
                        <Text style={styles.overdueLabel}>Overdue</Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddTask}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add Task</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
    minHeight: 200,
    maxHeight: 500,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  taskCount: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  overdueCount: {
    color: Colors.light.overdueText,
    fontWeight: "500",
  },
  taskList: {
    maxHeight: 340,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
  },
  taskRowCompleted: {
    opacity: 0.5,
  },
  taskCheckbox: {
    marginRight: 12,
  },
  taskContent: {
    flex: 1,
  },
  taskText: {
    fontSize: 15,
    color: Colors.light.text,
    fontWeight: "500",
  },
  taskTextCompleted: {
    textDecorationLine: "line-through",
    color: Colors.light.textTertiary,
  },
  taskMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 6,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  overdueLabel: {
    fontSize: 12,
    color: Colors.light.overdueText,
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.light.textTertiary,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.light.tint,
    borderRadius: 50,
    paddingVertical: 10,
    marginTop: 16,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 15,
  },
});

export default DayTasksModal;
