import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { groupService } from "@/services/groupService";
import { taskService } from "@/services/taskService";
import { Group, Task, TaskFilter } from "@/types";
import Ionicons from "@expo/vector-icons/Ionicons";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");
const MIN_TASK_LENGTH = 3;
const MAX_TASK_LENGTH = 120;

const TasksScreen = () => {
  const { user, isGuest, signIn, continueAsGuest } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<TaskFilter>("ongoing");
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("personal");
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskReminder, setNewTaskReminder] = useState(false);
  const [newTaskReminderAt, setNewTaskReminderAt] = useState<Date | null>(null);
  const [showReminderDatePicker, setShowReminderDatePicker] = useState(false);
  const [showReminderTimePicker, setShowReminderTimePicker] = useState(false);
  const insets = useSafeAreaInsets();
  const trimmedTaskText = newTaskText.trim();
  const isSelectionMode = selectedTaskIds.length > 0;
  const isTaskLengthValid =
    trimmedTaskText.length >= MIN_TASK_LENGTH &&
    trimmedTaskText.length <= MAX_TASK_LENGTH;

  const formatReminderDateTime = (date: Date) => {
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const loadTasks = useCallback(async () => {
    try {
      const loadedTasks = await taskService.getTasks();
      loadedTasks.sort((a, b) => b.createdAt - a.createdAt);
      setTasks(loadedTasks);
    } catch (error) {
      console.error("Error loading tasks:", error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
      groupService
        .getGroups()
        .then(setGroups)
        .catch((error) => console.error("Error loading groups:", error));
    }, [loadTasks]),
  );

  const selectedFolderName =
    selectedFolderId === "personal"
      ? "Personal"
      : groups.find((g) => g.id === selectedFolderId)?.name || "Personal";

  const openFolderPicker = () => {
    Alert.alert("Select folder", "Choose where to view tasks", [
      {
        text: selectedFolderId === "personal" ? "✓ Personal" : "Personal",
        onPress: () => setSelectedFolderId("personal"),
      },
      ...groups.map((group) => ({
        text:
          selectedFolderId === group.id ? `✓ ${group.name}` : `${group.name}`,
        onPress: () => setSelectedFolderId(group.id),
      })),
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const filteredTasks = tasks.filter((task) => {
    const matchesStatus =
      filter === "ongoing" ? !task.completed : task.completed;
    const matchesFolder =
      selectedFolderId === "personal"
        ? !task.groupId
        : task.groupId === selectedFolderId;
    return matchesStatus && matchesFolder;
  });

  const getTaskFolderLabel = (task: Task) => {
    if (!task.groupId) return "Personal";
    return (
      groups.find((group) => group.id === task.groupId)?.name ?? "Personal"
    );
  };

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
              await Promise.all(
                selectedTaskIds.map((taskId) => taskService.deleteTask(taskId)),
              );
              setTasks((prev) =>
                prev.filter((task) => !selectedTaskIds.includes(task.id)),
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
              setTasks((prev) => prev.filter((t) => !t.completed));
            } catch (error) {
              console.error("Error clearing completed tasks:", error);
            }
          },
        },
      ],
    );
  };

  const createTaskFromModal = async () => {
    if (!isTaskLengthValid) {
      Alert.alert(
        "Task length requirement",
        `Task must be between ${MIN_TASK_LENGTH} and ${MAX_TASK_LENGTH} characters.`,
      );
      return;
    }
    try {
      await taskService.createTask(trimmedTaskText, {
        reminder: newTaskReminder,
        reminderAt: newTaskReminderAt?.getTime(),
      });
      setShowAddTaskModal(false);
      setNewTaskText("");
      setNewTaskReminder(false);
      setNewTaskReminderAt(null);
      await loadTasks();
    } catch (error) {
      console.error("Error creating task:", error);
    }
  };

  const onReminderDateChange = (
    event: DateTimePickerEvent,
    selected?: Date,
  ) => {
    setShowReminderDatePicker(false);

    if (event.type !== "set" || !selected) {
      return;
    }

    const base = newTaskReminderAt ?? new Date();
    const merged = new Date(selected);
    merged.setHours(base.getHours(), base.getMinutes(), 0, 0);
    setNewTaskReminderAt(merged);
    setNewTaskReminder(true);
    setShowReminderTimePicker(true);
  };

  const onReminderTimeChange = (
    event: DateTimePickerEvent,
    selected?: Date,
  ) => {
    setShowReminderTimePicker(false);

    if (event.type !== "set" || !selected) {
      return;
    }

    const base = newTaskReminderAt ?? new Date();
    const merged = new Date(base);
    merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    setNewTaskReminderAt(merged);
    setNewTaskReminder(true);
  };

  const openReminderPicker = () => {
    setShowReminderDatePicker(true);
  };

  const handleCloseAddTaskModal = (force = false) => {
    const hasInput = newTaskText.trim().length > 0;

    const closeNow = () => {
      setShowAddTaskModal(false);
      Keyboard.dismiss();
      setShowReminderDatePicker(false);
      setShowReminderTimePicker(false);
    };

    if (!force && hasInput) {
      Alert.alert("Discard task?", "Your current input will be lost.", [
        { text: "Keep Editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: closeNow },
      ]);
      return;
    }

    closeNow();
  };

  const pendingCount = tasks.filter((t) => !t.completed).length;
  const completedCount = tasks.filter((t) => t.completed).length;

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
            <>
              <TouchableOpacity
                onPress={clearTaskSelection}
                style={styles.headerAction}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={Colors.light.text} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={deleteSelectedTasks}
                style={[styles.headerAction, styles.headerActionDanger]}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            onPress={() => setShowAddTaskModal(true)}
            style={styles.headerAction}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={22} color={Colors.light.tint} />
          </TouchableOpacity>
        </View>
      </View>

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

          <TouchableOpacity
            style={[
              styles.folderDropdown,
              selectedFolderId === "personal" && styles.folderDropdownActive,
            ]}
            onPress={openFolderPicker}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.folderDropdownText,
                selectedFolderId === "personal" &&
                  styles.folderDropdownTextActive,
              ]}
              numberOfLines={1}
            >
              {selectedFolderName}
            </Text>
            <Ionicons
              name="chevron-down"
              size={16}
              style={{ color: "#FFFFFF" }}
              color={
                selectedFolderId === "personal"
                  ? Colors.light.tint
                  : Colors.light.textSecondary
              }
            />
          </TouchableOpacity>
        </View>
      </View>

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
                : "No ongoing tasks"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {filter === "completed"
                ? "Complete some tasks to see them here"
                : "Tap the + button to add your next task"}
            </Text>
          </View>
        ) : (
          filteredTasks.map((task) =>
            (() => {
              const isSelected = selectedTaskIds.includes(task.id);
              return (
                <TouchableOpacity
                  key={task.id}
                  style={[
                    styles.taskItem,
                    task.completed && styles.taskItemCompleted,
                    isSelected && styles.taskItemSelected,
                  ]}
                  onPress={() =>
                    isSelectionMode
                      ? toggleTaskSelection(task.id)
                      : toggleTask(task.id)
                  }
                  onLongPress={() => toggleTaskSelection(task.id)}
                  delayLongPress={300}
                  activeOpacity={0.7}
                >
                  <View style={styles.taskCheckbox}>
                    <Ionicons
                      name={
                        isSelectionMode
                          ? isSelected
                            ? "checkmark-circle"
                            : "ellipse-outline"
                          : task.completed
                            ? "checkbox"
                            : "square-outline"
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
                      style={[
                        styles.taskText,
                        task.completed && styles.taskTextCompleted,
                      ]}
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

                      {task.reminderAt && (
                        <View style={styles.taskMetaBadge}>
                          <Ionicons
                            name="alarm-outline"
                            size={12}
                            color={Colors.light.tint}
                          />
                          <Text style={styles.taskMetaText} numberOfLines={1}>
                            {formatReminderDateTime(new Date(task.reminderAt))}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })(),
          )
        )}
      </ScrollView>

      <Modal
        visible={showAddTaskModal}
        transparent
        animationType="slide"
        onRequestClose={() => handleCloseAddTaskModal(true)}
      >
        <KeyboardAvoidingView
          behavior="padding"
          keyboardVerticalOffset={16}
          style={styles.modalRoot}
        >
          <TouchableWithoutFeedback
            onPress={() => handleCloseAddTaskModal(true)}
          >
            <View style={styles.modalOverlay} />
          </TouchableWithoutFeedback>

          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Task</Text>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalInputCard}>
                <TextInput
                  style={styles.modalInput}
                  placeholder="What needs to be done?"
                  placeholderTextColor={Colors.light.textTertiary}
                  value={newTaskText}
                  onChangeText={setNewTaskText}
                  maxLength={MAX_TASK_LENGTH}
                  multiline
                  autoFocus
                />
                <Text style={styles.modalInputHint}>
                  {`${newTaskText.length}/${MAX_TASK_LENGTH} characters`}
                </Text>
              </View>

              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={[
                    styles.modalReminderButton,
                    newTaskReminderAt && styles.modalReminderButtonActive,
                  ]}
                  onPress={openReminderPicker}
                  activeOpacity={0.7}
                >
                  <View style={styles.modalReminderButtonLeft}>
                    <Ionicons
                      name="alarm-outline"
                      size={18}
                      color={
                        newTaskReminder
                          ? Colors.light.tint
                          : Colors.light.iconDefault
                      }
                    />
                    <Text
                      style={[
                        styles.modalReminderButtonText,
                        newTaskReminderAt &&
                          styles.modalReminderButtonTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {newTaskReminderAt
                        ? formatReminderDateTime(newTaskReminderAt)
                        : "Add Reminder"}
                    </Text>
                  </View>

                  {newTaskReminderAt && (
                    <TouchableOpacity
                      style={styles.modalReminderClearIconButton}
                      onPress={() => {
                        setNewTaskReminder(false);
                        setNewTaskReminderAt(null);
                      }}
                      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    >
                      <Ionicons
                        name="close"
                        size={14}
                        color={Colors.light.textSecondary}
                      />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={createTaskFromModal}
                  disabled={!isTaskLengthValid}
                  style={[
                    styles.modalSaveButton,
                    !isTaskLengthValid && styles.modalSaveButtonDisabled,
                  ]}
                >
                  <Text style={styles.modalSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalFooter} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {showReminderDatePicker && (
        <DateTimePicker
          value={newTaskReminderAt ?? new Date()}
          mode="date"
          display="default"
          onChange={onReminderDateChange}
          minimumDate={new Date()}
        />
      )}

      {showReminderTimePicker && (
        <DateTimePicker
          value={newTaskReminderAt ?? new Date()}
          mode="time"
          display="default"
          onChange={onReminderTimeChange}
        />
      )}

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
  subtitle: { fontSize: 15, color: Colors.light.textSecondary },
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
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerAction: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerActionDanger: {
    backgroundColor: Colors.light.error,
    borderColor: Colors.light.error,
  },
  statsContainer: { flexDirection: "row", gap: 12, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  statCardCompleted: { backgroundColor: Colors.light.tintLight },
  statNumber: { fontSize: 28, fontWeight: "bold", color: Colors.light.text },
  statNumberCompleted: { color: Colors.light.tint },
  statLabel: { fontSize: 13, color: Colors.light.textSecondary, marginTop: 4 },
  statLabelCompleted: { color: Colors.light.tint },
  filterContainer: { marginBottom: 16 },
  filterRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: "#FFFFFF",
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  filterTabActiveOngoing: {
    backgroundColor: "#FFFFFF",
    borderColor: Colors.light.tint,
  },
  filterTabActiveCompleted: {
    backgroundColor: "#FFFFFF",
    borderColor: Colors.light.tint,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.light.textSecondary,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  filterTabTextActive: { color: Colors.light.tint },
  folderDropdown: {
    maxWidth: 150,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  folderDropdownActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  folderDropdownText: {
    fontSize: 13,
    color: "white",
    fontWeight: "500",
    maxWidth: 100,
  },
  folderDropdownTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  taskList: { flex: 1 },
  taskListContent: { paddingBottom: 20 },
  taskItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  taskItemSelected: {
    borderColor: Colors.light.tint,
    backgroundColor: Colors.light.tintLight,
  },
  taskItemCompleted: { opacity: 0.6, backgroundColor: Colors.light.card },
  taskCheckbox: { marginRight: 12 },
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
    gap: 4,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: Colors.light.card,
    maxWidth: "100%",
  },
  taskMetaText: {
    fontSize: 11,
    color: Colors.light.textSecondary,
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
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    minHeight: 300,
    maxHeight: "80%",
  },
  modalInputCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  modalInputHint: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.light.textSecondary,
    textAlign: "right",
    alignSelf: "flex-end",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.border,
    alignSelf: "center",
    marginBottom: 12,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "600", color: Colors.light.text },
  modalFooter: {
    marginTop: 12,
    alignItems: "stretch",
  },
  modalActionRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  modalReminderButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 50,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: "#FFFFFF",
  },
  modalReminderButtonActive: {
    borderColor: Colors.light.tint,
  },
  modalReminderButtonLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginRight: 6,
  },
  modalReminderButtonText: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.text,
  },
  modalReminderButtonTextActive: {
    color: Colors.light.tint,
  },
  modalReminderClearIconButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.card,
  },
  modalSaveButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalSaveButtonDisabled: { backgroundColor: Colors.light.border },
  modalSaveText: { color: "#FFFFFF", fontWeight: "600" },
  modalInput: {
    fontSize: 18,
    color: Colors.light.text,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 0,
  },
});

export default TasksScreen;
