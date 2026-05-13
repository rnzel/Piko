import { Colors } from "@/constants/theme";
import { formatDueLabel } from "@/utils/dateUtils";
import Ionicons from "@expo/vector-icons/Ionicons";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import BottomSheet from "@/components/ui/BottomSheet";
import { Task } from "@/types";

type Props = {
  visible: boolean;
  onClose: (force?: boolean) => void;
  onSave: (
    text: string,
    options: {
      reminder: boolean;
      reminderAt: number | null;
      groupId?: string;
      priority: "low" | "medium" | "high";
      dueDate?: number;
    },
  ) => void;
  /** When opened from the calendar tab, pre-fill dueDate with the selected date */
  preselectedDueDate?: number;
  editingTask?: Task | null;
};

const MIN_TASK_LENGTH = 3;
const MAX_TASK_LENGTH = 120;

const formatReminderDateTime = (date: Date) => {
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const AddTaskModal = ({
  visible,
  onClose,
  onSave,
  preselectedDueDate,
  editingTask,
}: Props) => {
  const inputRef = useRef<TextInput>(null);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskReminder, setNewTaskReminder] = useState(false);
  const [newTaskReminderAt, setNewTaskReminderAt] = useState<Date | null>(null);
  const [showReminderDatePicker, setShowReminderDatePicker] = useState(false);
  const [showReminderTimePicker, setShowReminderTimePicker] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState<
    "low" | "medium" | "high"
  >("low");
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | null>(null);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);

  const trimmedTaskText = newTaskText.trim();
  const isTaskLengthValid =
    trimmedTaskText.length >= MIN_TASK_LENGTH &&
    trimmedTaskText.length <= MAX_TASK_LENGTH;

  useEffect(() => {
    if (visible) {
      if (editingTask) {
        setNewTaskText(editingTask.text);
        setSelectedPriority(editingTask.priority ?? "low");
        if (editingTask.dueDate) {
          setNewTaskDueDate(new Date(editingTask.dueDate));
        } else {
          setNewTaskDueDate(null);
        }
        if (editingTask.reminderAt) {
          setNewTaskReminderAt(new Date(editingTask.reminderAt));
          setNewTaskReminder(true);
        } else {
          setNewTaskReminderAt(null);
          setNewTaskReminder(false);
        }
      } else if (preselectedDueDate) {
        setNewTaskDueDate(new Date(preselectedDueDate));
      }
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    } else {
      setNewTaskText("");
      setNewTaskReminder(false);
      setNewTaskReminderAt(null);
      setShowReminderDatePicker(false);
      setShowReminderTimePicker(false);
      setShowDueDatePicker(false);
      setSelectedPriority("low");
      setNewTaskDueDate(null);
    }
  }, [visible, preselectedDueDate, editingTask]);

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

  const onDueDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShowDueDatePicker(false);

    if (event.type !== "set" || !selected) {
      return;
    }

    // Normalize to start-of-day
    const startOfDay = new Date(selected);
    startOfDay.setHours(0, 0, 0, 0);
    setNewTaskDueDate(startOfDay);
  };

  const openReminderPicker = () => {
    setShowReminderDatePicker(true);
  };

  const openDueDatePicker = () => {
    setShowDueDatePicker(true);
  };

  const handleClose = (force = false) => {
    const hasInput = newTaskText.trim().length > 0;

    const closeNow = () => {
      onClose(true);
      Keyboard.dismiss();
    };

    if (!force && hasInput) {
      Alert.alert("Discard task?", "Your current input will be lost.", [
        { text: "Keep Editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: closeNow,
        },
      ]);
      return;
    }

    closeNow();
  };

  const handleSave = async () => {
    if (!isTaskLengthValid) {
      Alert.alert(
        "Task length requirement",
        `Task must be between ${MIN_TASK_LENGTH} and ${MAX_TASK_LENGTH} characters.`,
      );
      return;
    }
    onSave(trimmedTaskText, {
      reminder: newTaskReminder,
      reminderAt: newTaskReminderAt?.getTime() ?? null,
      groupId: undefined,
      priority: selectedPriority,
      dueDate: newTaskDueDate?.getTime() ?? undefined,
    });
    handleClose(true);
  };

  const getPriorityButtonStyles = (
    priorityOption: "low" | "medium" | "high",
    isSelected: boolean,
  ) => {
    let buttonStyle = { ...styles.modalPriorityButton };
    let textStyle = { ...styles.modalPriorityButtonText };

    if (isSelected) {
      switch (priorityOption) {
        case "low":
          buttonStyle = {
            ...buttonStyle,
            backgroundColor: Colors.light.priorityLowBackground,
            borderColor: Colors.light.priorityLowText,
            borderWidth: 1,
          };
          textStyle = { ...textStyle, color: Colors.light.priorityLowText };
          break;
        case "medium":
          buttonStyle = {
            ...buttonStyle,
            backgroundColor: Colors.light.priorityMediumBackground,
            borderColor: Colors.light.priorityMediumText,
            borderWidth: 1,
          };
          textStyle = { ...textStyle, color: Colors.light.priorityMediumText };
          break;
        case "high":
          buttonStyle = {
            ...buttonStyle,
            backgroundColor: Colors.light.priorityHighBackground,
            borderColor: Colors.light.priorityHighText,
            borderWidth: 1,
          };
          textStyle = { ...textStyle, color: Colors.light.priorityHighText };
          break;
      }
    }
    return { buttonStyle, textStyle };
  };

  const getDueDateLabel = (): string => {
    if (!newTaskDueDate) return "Add Due Date";
    return formatDueLabel(newTaskDueDate.getTime());
  };

  const getDueDateIconColor = (): string => {
    if (!newTaskDueDate) return Colors.light.iconDefault;
    return Colors.light.tint;
  };

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={() => handleClose()}
        title={editingTask ? "Edit Task" : "New Task"}
      >
        <View style={styles.modalInputCard}>
          <TextInput
            ref={inputRef}
            style={styles.modalInput}
            placeholder="What needs to be done?"
            placeholderTextColor={Colors.light.textTertiary}
            value={newTaskText}
            onChangeText={setNewTaskText}
            maxLength={MAX_TASK_LENGTH}
            multiline
            autoFocus={false}
            onFocus={() => {}}
          />
          <Text style={styles.modalInputHint}>
            {`${newTaskText.length}/${MAX_TASK_LENGTH}`}
          </Text>
        </View>

        <Text style={styles.modalLabel}>Priority</Text>

        <View style={styles.modalPriorityRow}>
          {(["low", "medium", "high"] as const).map((priorityOption) => {
            const isSelected = selectedPriority === priorityOption;
            const { buttonStyle, textStyle } = getPriorityButtonStyles(
              priorityOption,
              isSelected,
            );
            return (
              <TouchableOpacity
                key={priorityOption}
                style={buttonStyle}
                onPress={() => setSelectedPriority(priorityOption)}
              >
                <Text style={textStyle}>
                  {priorityOption.charAt(0).toUpperCase() +
                    priorityOption.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Due Date Row */}
        <Text style={styles.modalLabel}>Due Date</Text>
        <View style={styles.modalActionRow}>
          <TouchableOpacity
            style={[
              styles.modalReminderButton,
              newTaskDueDate && styles.modalReminderButtonActive,
            ]}
            onPress={openDueDatePicker}
            activeOpacity={0.7}
          >
            <View style={styles.modalReminderButtonLeft}>
              <Ionicons
                name="calendar-outline"
                size={18}
                color={getDueDateIconColor()}
              />
              <Text
                style={[
                  styles.modalReminderButtonText,
                  newTaskDueDate && styles.modalReminderButtonTextActive,
                ]}
                numberOfLines={1}
              >
                {getDueDateLabel()}
              </Text>
            </View>

            {newTaskDueDate && (
              <TouchableOpacity
                style={styles.modalReminderClearIconButton}
                onPress={() => {
                  setNewTaskDueDate(null);
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
        </View>

        {/* Reminder Row */}
        <Text style={styles.modalLabel}>Reminder</Text>
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
                  newTaskReminder ? Colors.light.tint : Colors.light.iconDefault
                }
              />
              <Text
                style={[
                  styles.modalReminderButtonText,
                  newTaskReminderAt && styles.modalReminderButtonTextActive,
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
            onPress={handleSave}
            disabled={!isTaskLengthValid}
            style={[
              styles.modalSaveButton,
              !isTaskLengthValid && styles.modalSaveButtonDisabled,
            ]}
          >
            <Text style={styles.modalSaveText}>Save</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

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

      {showDueDatePicker && (
        <DateTimePicker
          value={newTaskDueDate ?? new Date()}
          mode="date"
          display="default"
          onChange={onDueDateChange}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  modalInputCard: {
    borderColor: Colors.light.border,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  modalLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  modalPriorityRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  modalPriorityButton: {
    alignItems: "center",
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.card,
  },
  modalPriorityButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.light.textSecondary,
  },
  modalActionRow: {
    marginTop: 4,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
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
    borderRadius: 50,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  modalSaveButtonDisabled: { backgroundColor: Colors.light.border },
  modalSaveText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  modalInput: {
    fontSize: 16,
    color: Colors.light.text,
    minHeight: 72,
    textAlignVertical: "top",
    marginBottom: 0,
  },
});

export default AddTaskModal;
