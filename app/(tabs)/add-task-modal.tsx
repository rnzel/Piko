import { Colors } from "@/constants/theme";
import { taskService } from "@/services/taskService";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    Animated,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

const AddTaskModal = () => {
  const [taskText, setTaskText] = useState("");
  const [reminder, setReminder] = useState(false);
  const [groupId, setGroupId] = useState<string | undefined>(undefined);
  const slideAnim = useRef(new Animated.Value(height)).current;
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  useEffect(() => {
    // Animate modal in
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    return () => {
      // Animate modal out on unmount
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 200,
        useNativeDriver: true,
      }).start();
    };
  }, []);

  const closeModal = () => {
    Animated.timing(slideAnim, {
      toValue: height,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      router.back();
    });
  };

  const handleSaveTask = async () => {
    if (!taskText.trim()) return;

    try {
      await taskService.createTask(taskText.trim(), {
        reminder,
        groupId,
      });
      closeModal();
    } catch (error) {
      console.error("Error creating task:", error);
    }
  };

  return (
    <View style={styles.overlay}>
      <TouchableWithoutFeedback onPress={closeModal}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.modalContainer,
          {
            transform: [{ translateY: slideAnim }],
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={closeModal} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>New Task</Text>
            <TouchableOpacity
              onPress={handleSaveTask}
              style={[
                styles.saveButton,
                !taskText.trim() && styles.saveButtonDisabled,
              ]}
              disabled={!taskText.trim()}
            >
              <Text
                style={[
                  styles.saveButtonText,
                  !taskText.trim() && styles.saveButtonTextDisabled,
                ]}
              >
                Save
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Task input */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.taskInput}
                placeholder="What needs to be done?"
                placeholderTextColor={Colors.light.textTertiary}
                value={taskText}
                onChangeText={setTaskText}
                multiline
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSaveTask}
              />
            </View>

            {/* Options */}
            <View style={styles.optionsContainer}>
              <Text style={styles.optionsTitle}>Options</Text>

              {/* Reminder toggle */}
              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => setReminder(!reminder)}
                activeOpacity={0.7}
              >
                <View style={styles.optionLeft}>
                  <Ionicons
                    name="alarm-outline"
                    size={22}
                    color={
                      reminder ? Colors.light.tint : Colors.light.iconDefault
                    }
                  />
                  <Text
                    style={[
                      styles.optionText,
                      reminder && styles.optionTextActive,
                    ]}
                  >
                    Add Reminder
                  </Text>
                </View>
                <View style={[styles.toggle, reminder && styles.toggleActive]}>
                  <View
                    style={[
                      styles.toggleKnob,
                      reminder && styles.toggleKnobActive,
                    ]}
                  />
                </View>
              </TouchableOpacity>

              {/* Group assignment (placeholder) */}
              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => {
                  // TODO: Open group selector
                }}
                activeOpacity={0.7}
              >
                <View style={styles.optionLeft}>
                  <Ionicons
                    name="people-outline"
                    size={22}
                    color={Colors.light.iconDefault}
                  />
                  <Text style={styles.optionText}>Assign to Group</Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={Colors.light.iconDefault}
                />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: height * 0.85,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: "#E0E0E0",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  cancelButtonText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    fontWeight: "500",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.text,
  },
  saveButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.light.border,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  saveButtonTextDisabled: {
    color: Colors.light.textTertiary,
  },
  content: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 24,
  },
  taskInput: {
    fontSize: 18,
    fontWeight: "500",
    color: Colors.light.text,
    minHeight: 60,
    textAlignVertical: "top",
    padding: 0,
  },
  optionsContainer: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.divider,
    paddingTop: 16,
  },
  optionsTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  optionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionText: {
    fontSize: 16,
    color: Colors.light.text,
    fontWeight: "500",
  },
  optionTextActive: {
    color: Colors.light.tint,
  },
  toggle: {
    width: 51,
    height: 31,
    borderRadius: 15.5,
    backgroundColor: Colors.light.border,
    justifyContent: "center",
    padding: 3,
  },
  toggleActive: {
    backgroundColor: Colors.light.tint,
  },
  toggleKnob: {
    width: 25,
    height: 25,
    borderRadius: 12.5,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleKnobActive: {
    alignSelf: "flex-end",
  },
});

export default AddTaskModal;
