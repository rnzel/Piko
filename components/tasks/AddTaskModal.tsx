import { Colors } from "@/constants/theme";
import { Group } from "@/types";
import Ionicons from "@expo/vector-icons/Ionicons";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React, { useEffect, useRef, useState } from "react";
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

import BottomSheet from "@/components/ui/BottomSheet";

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
    },
  ) => void;
  groups: Group[];
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

const AddTaskModal = ({ visible, onClose, onSave, groups }: Props) => {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskReminder, setNewTaskReminder] = useState(false);
  const [newTaskReminderAt, setNewTaskReminderAt] = useState<Date | null>(null);
  const [showReminderDatePicker, setShowReminderDatePicker] = useState(false);
  const [showReminderTimePicker, setShowReminderTimePicker] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("personal");
  const [selectedPriority, setSelectedPriority] = useState<
    "low" | "medium" | "high"
  >("medium");
  const [showGroupPicker, setShowGroupPicker] = useState(false);

  const trimmedTaskText = newTaskText.trim();
  const screenHeight = Dimensions.get("window").height;
  const modalSheetMaxHeight = screenHeight - insets.top - insets.bottom - 48;
  const isTaskLengthValid =
    trimmedTaskText.length >= MIN_TASK_LENGTH &&
    trimmedTaskText.length <= MAX_TASK_LENGTH;

  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    } else {
      setNewTaskText("");
      setNewTaskReminder(false);
      setNewTaskReminderAt(null);
      setShowReminderDatePicker(false);
      setShowReminderTimePicker(false);
      setSelectedGroupId("personal");
      setSelectedPriority("medium");
      setShowGroupPicker(false);
    }
  }, [visible]);

  const selectedGroupName =
    selectedGroupId === "personal"
      ? "Personal"
      : groups.find((g) => g.id === selectedGroupId)?.name || "Personal";

  const groupOptions: { id: string; label: string }[] = [
    { id: "personal", label: "Personal" },
    ...groups.map((g) => ({ id: g.id, label: g.name })),
  ];

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
      groupId: selectedGroupId === "personal" ? undefined : selectedGroupId,
      priority: selectedPriority,
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => handleClose(true)}
    >
      <View
        style={[
          styles.modalRoot,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 3,
          },
        ]}
      >
        <TouchableWithoutFeedback onPress={() => handleClose(true)}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>

        <KeyboardAvoidingView
          behavior="padding"
          keyboardVerticalOffset={20}
          style={{ width: "100%" }}
        >
          <View
            style={[
              styles.modalSheet,
              {
                maxHeight: modalSheetMaxHeight,
              },
            ]}
          >
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Task</Text>
            </View>
            <ScrollView
              contentContainerStyle={[
                styles.modalScrollContent,
                { flexGrow: 1, paddingBottom: 8 },
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
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

              <TouchableOpacity
                style={styles.modalGroupButton}
                onPress={() => setShowGroupPicker(true)}
                activeOpacity={0.7}
              >
                <View style={styles.modalGroupButtonLeft}>
                  <Ionicons
                    name="folder-outline"
                    size={18}
                    color={Colors.light.tint}
                  />
                  <Text style={styles.modalGroupButtonText} numberOfLines={1}>
                    {selectedGroupName}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-down"
                  size={16}
                  color={Colors.light.textSecondary}
                />
              </TouchableOpacity>

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
            </ScrollView>
            <View style={styles.modalFooter} />
          </View>
        </KeyboardAvoidingView>
      </View>

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

      <BottomSheet
        visible={showGroupPicker}
        onClose={() => setShowGroupPicker(false)}
        title="Select folder"
      >
        {groupOptions.map((option) => {
          const isSelected = selectedGroupId === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 14,
                paddingHorizontal: 4,
                borderBottomWidth: 1,
                borderBottomColor: Colors.light.divider,
              }}
              onPress={() => {
                setSelectedGroupId(option.id);
                setShowGroupPicker(false);
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <Ionicons
                  name={
                    option.id === "personal"
                      ? "person-outline"
                      : "folder-outline"
                  }
                  size={20}
                  color={
                    isSelected ? Colors.light.tint : Colors.light.textSecondary
                  }
                />
                <Text
                  style={{
                    fontSize: 16,
                    color: isSelected ? Colors.light.tint : Colors.light.text,
                    fontWeight: isSelected ? "600" : "400",
                  }}
                >
                  {option.label}
                </Text>
              </View>
              {isSelected && (
                <Ionicons
                  name="checkmark"
                  size={20}
                  color={Colors.light.tint}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </BottomSheet>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    minHeight: 260,
    maxWidth: 420,
    width: "100%",
    alignSelf: "stretch",
  },
  modalScrollContent: {
    paddingBottom: 4,
  },
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
  modalHandle: {
    width: 48,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.light.border,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: "600", color: Colors.light.text },
  modalFooter: {
    alignItems: "stretch",
  },
  modalGroupButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: Colors.light.tint,
    borderRadius: 50,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: Colors.light.tintLight,
    marginBottom: 8,
  },
  modalPriorityRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
  },
  modalPriorityButton: {
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
  modalGroupButtonLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  modalGroupButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.tint,
  },
  modalActionRow: {
    marginTop: 12,
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
