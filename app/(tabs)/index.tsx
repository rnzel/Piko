import { useAuth } from "@/contexts/AuthContext";
import { taskService } from "@/services/taskService";
import { Task, TaskFilter } from "@/types";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AddTaskModal from "@/components/tasks/AddTaskModal";
import AuthScreen from "@/components/tasks/AuthScreen";
import BottomActionBar from "@/components/tasks/BottomActionBar";
import TaskItem from "@/components/tasks/TaskItem";
import EmptyState from "@/components/ui/EmptyState";
import Loading from "@/components/ui/Loading";
import styles from "./index.styles";

const formatReminderDateTime = (date: Date) => {
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const priorityMap = {
  high: 3,
  medium: 2,
  low: 1,
};

const sortTasks = (a: Task, b: Task) => {
  const aPriority = a.priority ?? "medium"; // Fallback for safety, though normalizeTask should handle
  const bPriority = b.priority ?? "medium"; // Fallback for safety

  const priorityDiff = priorityMap[bPriority] - priorityMap[aPriority];
  if (priorityDiff !== 0) {
    return priorityDiff;
  }
  return b.createdAt - a.createdAt;
};

const TasksScreen = () => {
  const { user, isGuest, signIn, continueAsGuest } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState<boolean>(true);
  const [filter, setFilter] = useState<TaskFilter>("ongoing");
  const [selectedFolderId, setSelectedFolderId] = useState<string>("all");
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
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

  const folderOptions: { id: string; label: string }[] = [
    { id: "all", label: "All" },
    { id: "personal", label: "Personal" },
  ];

  const filteredTasks = tasks.filter((task) => {
    const matchesStatus =
      filter === "ongoing" ? !task.completed : task.completed;
    const matchesFolder =
      selectedFolderId === "all"
        ? true
        : selectedFolderId === "personal"
          ? !task.groupId
          : task.groupId === selectedFolderId;
    return matchesStatus && matchesFolder;
  });

  const getTaskFolderLabel = (task: Task) => {
    if (!task.groupId) return "Personal";
    return "Personal";
  };

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

  const deleteTask = (taskId: string) => {
    Alert.alert("Delete Task", "Are you sure you want to delete this task?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await taskService.deleteTask(taskId);
            setTasks((prev) =>
              prev.filter((t) => t.id !== taskId).sort(sortTasks),
            );
          } catch (error) {
            console.error("Error deleting task:", error);
          }
        },
      },
    ]);
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

  const deleteCompletedTasks = () => {
    const completedCount = tasks.filter((t) => t.completed).length;
    if (completedCount === 0) {
      Alert.alert(
        "No Completed Tasks",
        "There are no completed tasks to clear.",
      );
      return;
    }

    Alert.alert(
      "Clear Completed",
      `Are you sure you want to delete ${completedCount} completed task${completedCount > 1 ? "s" : ""}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            try {
              await taskService.deleteCompletedTasks();
              setTasks((prev) =>
                prev.filter((t) => !t.completed).sort(sortTasks),
              );
            } catch (error) {
              console.error("Error clearing completed tasks:", error);
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
    },
  ) => {
    try {
      const newTask = await taskService.createTask(text, {
        reminder: options.reminder,
        reminderAt: options.reminderAt ?? undefined,
        groupId: options.groupId,
        priority: options.priority,
      });
      setShowAddTaskModal(false);
      setTasks((prev) => [newTask, ...prev].sort(sortTasks));
    } catch (error) {
      console.error("Error creating task:", error);
    }
  };

  const handleCloseModal = () => {
    setShowAddTaskModal(false);
  };

  const pendingCount = tasks.filter((t) => !t.completed).length;
  const completedCount = tasks.filter((t) => t.completed).length;

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
              : "Let\'s get things done today."}
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

      <View style={styles.filterContainer}>
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {(["ongoing", "completed"] as TaskFilter[]).map((f) => (
              <TouchableOpacity
                key={f}
                style={[
                  styles.filterTab,
                  filter === f &&
                    (f === "completed"
                      ? styles.filterTabActiveCompleted
                      : styles.filterTabActiveOngoing),
                ]}
                onPress={() => setFilter(f)}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    filter === f && styles.filterTabTextActive,
                  ]}
                >
                  {f === "ongoing" ? "Ongoing" : "Completed"}
                </Text>
              </TouchableOpacity>
            ))}
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
                : "clipboard-outline"
            }
            title={
              filter === "completed"
                ? "No completed tasks yet"
                : "No ongoing tasks"
            }
            subtitle={
              filter === "completed"
                ? "Complete some tasks to see them here"
                : "Tap the + button to add your next task"
            }
          />
        ) : (
          filteredTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              isSelected={selectedTaskIds.includes(task.id)}
              isSelectionMode={isSelectionMode}
              getTaskFolderLabel={getTaskFolderLabel}
              formatReminderDateTime={formatReminderDateTime}
              onPress={toggleTask}
              onLongPress={toggleTaskSelection}
            />
          ))
        )}
      </ScrollView>

      <AddTaskModal
        visible={showAddTaskModal}
        onClose={handleCloseModal}
        onSave={handleModalSave}
      />

      <TouchableOpacity
        onPress={() => setShowAddTaskModal(true)}
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
