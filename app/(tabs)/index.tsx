import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { taskService } from "@/services/taskService";
import { Task } from "@/types";
import {
  formatReminderDateTime,
  isDueThisWeek,
  isDueToday,
  isOverdue,
} from "@/utils/dateUtils";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AddTaskModal from "@/components/tasks/AddTaskModal";
import AuthScreen from "@/components/tasks/AuthScreen";
import BottomActionBar from "@/components/tasks/BottomActionBar";
import TaskDetailModal from "@/components/tasks/TaskDetailModal";
import TaskItem from "@/components/tasks/TaskItem";
import EmptyState from "@/components/ui/EmptyState";
import Loading from "@/components/ui/Loading";
import styles from "./index.styles";

const priorityMap = {
  high: 3,
  medium: 2,
  low: 1,
};

// Date-based sort: overdue first, then by priority, then by dueDate, then by createdAt
const sortTasks = (a: Task, b: Task) => {
  const aOverdue = isOverdue(a.dueDate, a.completed);
  const bOverdue = isOverdue(b.dueDate, b.completed);

  if (aOverdue !== bOverdue) {
    return aOverdue ? -1 : 1;
  }

  const aPriority = a.priority ?? "medium";
  const bPriority = b.priority ?? "medium";

  const priorityDiff = priorityMap[bPriority] - priorityMap[aPriority];
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  // Tasks with dueDate sort before those without
  if (a.dueDate && !b.dueDate) return -1;
  if (!a.dueDate && b.dueDate) return 1;
  if (a.dueDate && b.dueDate) {
    if (a.dueDate !== b.dueDate) return a.dueDate - b.dueDate;
  }

  return b.createdAt - a.createdAt;
};

type TaskFilter = "all" | "today" | "upcoming" | "completed";

const TasksScreen = () => {
  const { user, isGuest, signIn, continueAsGuest } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState<boolean>(true);
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const insets = useSafeAreaInsets();

  const isSelectionMode = selectedTaskIds.length > 0;

  const loadTasks = useCallback(async () => {
    setLoadingTasks(true);
    try {
      const loadedTasks = await taskService.getTasks();
      loadedTasks.sort(sortTasks);
      setTasks(loadedTasks);
    } catch (error) {
      console.error("Error loading tasks:", error);
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks]),
  );

  // Single unified filter
  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (filter === "completed") {
      result = result.filter((t) => t.completed);
    } else if (filter === "today") {
      result = result.filter(
        (t) =>
          !t.completed &&
          (isDueToday(t.dueDate) || isOverdue(t.dueDate, t.completed)),
      );
    } else if (filter === "upcoming") {
      result = result.filter(
        (t) =>
          !t.completed &&
          isDueThisWeek(t.dueDate) &&
          !isDueToday(t.dueDate) &&
          !isOverdue(t.dueDate, t.completed),
      );
    } else {
      // "all" — show everything
      result = result;
    }

    return result;
  }, [tasks, filter]);

  const overdueCount = useMemo(
    () => tasks.filter((t) => isOverdue(t.dueDate, t.completed)).length,
    [tasks],
  );

  const toggleTask = async (taskId: string) => {
    try {
      const updatedTask = await taskService.toggleTask(taskId);
      if (updatedTask) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? updatedTask : t)).sort(sortTasks),
        );
      }
    } catch (error) {
      console.error("Error toggling task:", error);
    }
  };

  const handleOpenDetail = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      setDetailTask(task);
      setShowDetailModal(true);
    }
  };

  const handleDetailUpdated = () => {
    loadTasks();
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setShowAddTaskModal(true);
  };

  const handleDeleteTask = (taskId: string) => {
    // handled inside modal via callback
    loadTasks();
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId],
    );
  };

  const clearTaskSelection = () => {
    setSelectedTaskIds([]);
  };

  const deleteSelectedTasks = () => {
    if (selectedTaskIds.length === 0) return;

    Alert.alert(
      "Delete Tasks",
      `Are you sure you want to delete ${selectedTaskIds.length} task${selectedTaskIds.length > 1 ? "s" : ""}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await taskService.deleteTasks(selectedTaskIds);
              setTasks((prev) =>
                prev
                  .filter((task) => !selectedTaskIds.includes(task.id))
                  .sort(sortTasks),
              );
              clearTaskSelection();
            } catch (error) {
              console.error("Error deleting selected tasks:", error);
            }
          },
        },
      ],
    );
  };

  const handleModalSave = async (
    text: string,
    options: {
      reminder: boolean;
      reminderAt: number | null;
      groupId?: string;
      priority: "low" | "medium" | "high";
      dueDate?: number;
    },
  ) => {
    try {
      if (editingTask) {
        // Update existing task
        await taskService.updateTask(editingTask.id, {
          text,
          reminder: options.reminder,
          reminderAt: options.reminderAt ?? undefined,
          priority: options.priority,
          dueDate: options.dueDate,
        });
      } else {
        await taskService.createTask(text, {
          reminder: options.reminder,
          reminderAt: options.reminderAt ?? undefined,
          groupId: options.groupId,
          priority: options.priority,
          dueDate: options.dueDate,
        });
      }
      setShowAddTaskModal(false);
      setEditingTask(null);
      loadTasks();
    } catch (error) {
      console.error("Error saving task:", error);
    }
  };

  const handleCloseModal = () => {
    setShowAddTaskModal(false);
    setEditingTask(null);
  };

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
        <View>
          <Text style={styles.greeting}>
            Hi {user ? user.displayName?.split(" ")[0] || "there" : "there"}
          </Text>
          <Text style={styles.subtitle}>
            {isGuest
              ? "Your tasks are saved on this device."
              : "Let's get things done today."}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {isSelectionMode && (
            <Text style={styles.selectedCountText}>
              {selectedTaskIds.length} selected
            </Text>
          )}
        </View>
      </View>

      {/* Single flat filter row */}
      <View style={styles.filterContainer}>
        <View style={styles.filterRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
          >
            {(["all", "today", "upcoming", "completed"] as TaskFilter[]).map(
              (f) => {
                const isActive = filter === f;
                const isTodayTab = f === "today";
                const showOverdueBadge = isTodayTab && overdueCount > 0;

                return (
                  <TouchableOpacity
                    key={f}
                    style={[
                      styles.filterTab,
                      isActive && styles.filterTabActive,
                      showOverdueBadge && styles.filterTabOverdue,
                    ]}
                    onPress={() => setFilter(f)}
                  >
                    <Text
                      style={[
                        styles.filterTabText,
                        isActive && styles.filterTabTextActive,
                        showOverdueBadge &&
                          isActive &&
                          styles.filterTabTextOverdue,
                      ]}
                    >
                      {f === "all"
                        ? "All"
                        : f === "today"
                          ? `Today${overdueCount > 0 ? ` (${overdueCount})` : ""}`
                          : f === "upcoming"
                            ? "Upcoming"
                            : "Completed"}
                    </Text>
                  </TouchableOpacity>
                );
              },
            )}
          </ScrollView>
        </View>
      </View>

      <ScrollView
        style={styles.taskList}
        contentContainerStyle={styles.taskListContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Task</Text>
        {loadingTasks ? (
          <Loading />
        ) : filteredTasks.length === 0 ? (
          <EmptyState
            icon={
              filter === "completed"
                ? "checkmark-circle-outline"
                : filter === "today"
                  ? "alarm-outline"
                  : filter === "upcoming"
                    ? "calendar-outline"
                    : "clipboard-outline"
            }
            title={
              filter === "completed"
                ? "No completed tasks"
                : filter === "today"
                  ? "All caught up for today!"
                  : filter === "upcoming"
                    ? "No tasks due this week"
                    : "No tasks yet"
            }
            subtitle={
              filter === "completed"
                ? "Complete some tasks to see them here"
                : filter === "today"
                  ? "No tasks due today or overdue"
                  : filter === "upcoming"
                    ? "Add a due date to upcoming tasks"
                    : "Tap the + button to add your next task"
            }
          />
        ) : (
          <>
            {filter === "all" && overdueCount > 0 && (
              <TouchableOpacity
                style={styles.overdueBanner}
                onPress={() => setFilter("today")}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="alert-circle"
                  size={14}
                  color={Colors.light.overdueText}
                />
                <Text style={styles.overdueBannerText}>
                  {overdueCount} overdue task{overdueCount !== 1 ? "s" : ""} —
                  tap to view
                </Text>
              </TouchableOpacity>
            )}
            {filteredTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                isSelected={selectedTaskIds.includes(task.id)}
                isSelectionMode={isSelectionMode}
                formatReminderDateTime={formatReminderDateTime}
                onToggle={toggleTask}
                onPress={handleOpenDetail}
                onLongPress={toggleTaskSelection}
              />
            ))}
          </>
        )}
      </ScrollView>

      <TaskDetailModal
        visible={showDetailModal}
        task={detailTask}
        onClose={() => {
          setShowDetailModal(false);
          setDetailTask(null);
        }}
        onTaskUpdated={handleDetailUpdated}
        onEdit={handleEditTask}
        onDelete={handleDeleteTask}
      />

      <AddTaskModal
        visible={showAddTaskModal}
        onClose={handleCloseModal}
        onSave={handleModalSave}
        preselectedDueDate={undefined}
        editingTask={editingTask}
      />

      <TouchableOpacity
        onPress={() => {
          setEditingTask(null);
          setShowAddTaskModal(true);
        }}
        style={[styles.floatingAddButton, { bottom: insets.bottom + 96 }]}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {isSelectionMode && (
        <BottomActionBar
          selectedCount={selectedTaskIds.length}
          onCancel={clearTaskSelection}
          onDelete={deleteSelectedTasks}
          insetsBottom={insets.bottom}
        />
      )}
    </View>
  );
};

export default TasksScreen;
