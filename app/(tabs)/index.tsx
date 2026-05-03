import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { taskService } from "@/services/taskService";
import { Task, TaskFilter } from "@/types";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

const TasksScreen = () => {
  const { user, isGuest, signIn, continueAsGuest } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<TaskFilter>("all");
  const insets = useSafeAreaInsets();

  // Load tasks
  const loadTasks = useCallback(async () => {
    try {
      const loadedTasks = await taskService.getTasks();
      // Sort by creation date (newest first)
      loadedTasks.sort((a, b) => b.createdAt - a.createdAt);
      setTasks(loadedTasks);
    } catch (error) {
      console.error("Error loading tasks:", error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks]),
  );

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    if (filter === "pending") return !task.completed;
    if (filter === "completed") return task.completed;
    return true;
  });

  // Toggle task completion
  const toggleTask = async (taskId: string) => {
    try {
      const updatedTask = await taskService.toggleTask(taskId);
      if (updatedTask) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? updatedTask : t)),
        );
      }
    } catch (error) {
      console.error("Error toggling task:", error);
    }
  };

  // Delete task
  const deleteTask = (taskId: string) => {
    Alert.alert("Delete Task", "Are you sure you want to delete this task?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await taskService.deleteTask(taskId);
            setTasks((prev) => prev.filter((t) => t.id !== taskId));
          } catch (error) {
            console.error("Error deleting task:", error);
          }
        },
      },
    ]);
  };

  // Delete completed tasks
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
              setTasks((prev) => prev.filter((t) => !t.completed));
            } catch (error) {
              console.error("Error clearing completed tasks:", error);
            }
          },
        },
      ],
    );
  };

  const pendingCount = tasks.filter((t) => !t.completed).length;
  const completedCount = tasks.filter((t) => t.completed).length;

  // Guest login prompt
  if (!user && !isGuest) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
        <View style={styles.authContainer}>
          <Text style={styles.greeting}>Hi there</Text>
          <Text style={styles.subtitle}>Welcome to Piko</Text>
          <Text style={styles.description}>
            Sign in to sync your tasks across devices, or continue as a guest to
            use Piko locally.
          </Text>

          <TouchableOpacity style={styles.authButton} onPress={signIn}>
            <Ionicons name="logo-google" size={20} color="#FFFFFF" />
            <Text style={styles.authButtonText}>Sign in with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.authButton, styles.guestButton]}
            onPress={continueAsGuest}
          >
            <Text style={styles.guestButtonText}>Continue as Guest</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      {/* Header */}
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
        {completedCount > 0 && (
          <TouchableOpacity
            onPress={deleteCompletedTasks}
            style={styles.clearButton}
          >
            <Ionicons
              name="trash-outline"
              size={18}
              color={Colors.light.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={[styles.statCard, styles.statCardCompleted]}>
          <Text style={[styles.statNumber, styles.statNumberCompleted]}>
            {completedCount}
          </Text>
          <Text style={[styles.statLabel, styles.statLabelCompleted]}>
            Completed
          </Text>
        </View>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(["all", "pending", "completed"] as TaskFilter[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, filter === f && styles.filterTabActive]}
              onPress={() => setFilter(f)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  filter === f && styles.filterTabTextActive,
                ]}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Task list */}
      <ScrollView
        style={styles.taskList}
        contentContainerStyle={styles.taskListContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredTasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name={
                filter === "completed"
                  ? "checkmark-circle-outline"
                  : "clipboard-outline"
              }
              size={64}
              color={Colors.light.textTertiary}
            />
            <Text style={styles.emptyTitle}>
              {filter === "completed"
                ? "No completed tasks yet"
                : filter === "pending"
                  ? "No pending tasks"
                  : "No tasks yet"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {filter === "completed"
                ? "Complete some tasks to see them here"
                : filter === "pending"
                  ? "All tasks are completed!"
                  : "Tap the + button to add your first task"}
            </Text>
          </View>
        ) : (
          filteredTasks.map((task) => (
            <TouchableOpacity
              key={task.id}
              style={[
                styles.taskItem,
                task.completed && styles.taskItemCompleted,
              ]}
              onPress={() => toggleTask(task.id)}
              activeOpacity={0.7}
            >
              <View style={styles.taskCheckbox}>
                <Ionicons
                  name={task.completed ? "checkbox" : "square-outline"}
                  size={24}
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
                {task.reminder && (
                  <View style={styles.taskBadge}>
                    <Ionicons
                      name="alarm-outline"
                      size={12}
                      color={Colors.light.warning}
                    />
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => deleteTask(task.id)}
              >
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color={Colors.light.textTertiary}
                />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Bottom padding for tab bar */}
      <View style={{ height: 100 }} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 20,
  },
  authContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  greeting: {
    fontSize: 28,
    fontWeight: "bold",
    color: Colors.light.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.light.textSecondary,
  },
  description: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 32,
    lineHeight: 22,
  },
  authButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.tint,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    width: width * 0.8,
    marginBottom: 12,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  authButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  guestButton: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  guestButtonText: {
    color: Colors.light.textSecondary,
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  clearButton: {
    padding: 8,
    marginTop: -8,
  },
  statsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  statCardCompleted: {
    backgroundColor: Colors.light.tintLight,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "bold",
    color: Colors.light.text,
  },
  statNumberCompleted: {
    color: Colors.light.tint,
  },
  statLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  statLabelCompleted: {
    color: Colors.light.tint,
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.light.card,
    marginRight: 8,
  },
  filterTabActive: {
    backgroundColor: Colors.light.tint,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.light.textSecondary,
  },
  filterTabTextActive: {
    color: "#FFFFFF",
  },
  taskList: {
    flex: 1,
  },
  taskListContent: {
    paddingBottom: 20,
  },
  taskItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  taskItemCompleted: {
    opacity: 0.6,
    backgroundColor: Colors.light.card,
  },
  taskCheckbox: {
    marginRight: 12,
  },
  taskContent: {
    flex: 1,
  },
  taskText: {
    fontSize: 16,
    color: Colors.light.text,
    fontWeight: "500",
  },
  taskTextCompleted: {
    textDecorationLine: "line-through",
    color: Colors.light.textTertiary,
  },
  taskBadge: {
    position: "absolute",
    top: -4,
    right: 0,
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingBottom: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.textTertiary,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.light.textTertiary,
    marginTop: 8,
    textAlign: "center",
  },
});

export default TasksScreen;
