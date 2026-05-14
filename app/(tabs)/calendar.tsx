import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { taskService } from "@/services/taskService";
import { Task } from "@/types";
import {
  isOverdue as checkIsOverdue,
  getTodayCalendarString,
  toCalendarDateString,
} from "@/utils/dateUtils";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import DayTasksModal from "@/components/calendar/DayTasksModal";
import AddTaskModal from "@/components/tasks/AddTaskModal";
import AuthScreen from "@/components/tasks/AuthScreen";

const priorityDotColors: Record<string, string> = {
  high: Colors.light.priorityHighText,
  medium: Colors.light.priorityMediumText,
  low: Colors.light.priorityLowText,
};

const { width: screenWidth } = Dimensions.get("window");

const CalendarScreen = () => {
  const { user, isGuest, signIn, continueAsGuest } = useAuth();
  const insets = useSafeAreaInsets();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showDayTasks, setShowDayTasks] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [addTaskPrefillDate, setAddTaskPrefillDate] = useState<
    number | undefined
  >(undefined);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const loadedTasks = await taskService.getTasks();
      setTasks(loadedTasks);
    } catch (error) {
      console.error("Error loading tasks:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks]),
  );

  // Build markedDates from tasks — single dot per date, color = highest priority task
  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    const todayStr = getTodayCalendarString();

    for (const task of tasks) {
      if (!task.dueDate) continue;
      const dateStr = toCalendarDateString(task.dueDate);
      if (!dateStr) continue;

      if (!marks[dateStr]) {
        const priorityColor =
          priorityDotColors[task.priority ?? "medium"] ??
          priorityDotColors.medium;
        marks[dateStr] = {
          marked: true,
          dotColor: priorityColor,
          selectedDotColor: priorityColor,
        };
      } else {
        // Already marked — could show higher priority but single dot is kept as-is
        // to avoid visual noise (minimalist design)
      }
    }

    // Ensure today is properly highlighted
    if (!marks[todayStr]) {
      marks[todayStr] = { marked: false };
    }

    return marks;
  }, [tasks]);

  // Overdue count for display
  const overdueCount = useMemo(
    () =>
      tasks.filter(
        (t) => !t.completed && checkIsOverdue(t.dueDate, t.completed),
      ).length,
    [tasks],
  );

  const handleDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
    setShowDayTasks(true);
  };

  const handleDayTasksClose = () => {
    setShowDayTasks(false);
    setSelectedDate(null);
  };

  const handleAddTaskFromCalendar = (dueDate: number) => {
    setShowDayTasks(false);
    setAddTaskPrefillDate(dueDate);
    setShowAddTask(true);
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
      await taskService.createTask(text, {
        reminder: options.reminder,
        reminderAt: options.reminderAt ?? undefined,
        groupId: options.groupId,
        priority: options.priority,
        dueDate: options.dueDate,
      });
      setShowAddTask(false);
      setAddTaskPrefillDate(undefined);
      loadTasks();
    } catch (error) {
      console.error("Error creating task:", error);
    }
  };

  const today = getTodayCalendarString();

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
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Calendar</Text>
          <Text style={styles.subtitle}>
            {overdueCount > 0
              ? `${overdueCount} overdue task${overdueCount !== 1 ? "s" : ""}`
              : "Plan your tasks by due date"}
          </Text>
        </View>
      </View>

      {/* Calendar */}
      <View style={styles.calendarWrapper}>
        <Calendar
          current={today}
          onDayPress={handleDayPress}
          markedDates={{
            ...markedDates,
            [today]: {
              ...(markedDates[today] || {}),
              selected: true,
              selectedColor: Colors.light.calendarToday,
              selectedTextColor: Colors.light.tint,
            },
          }}
          markingType={"dot"}
          theme={{
            backgroundColor: "#FFFFFF",
            calendarBackground: "#FFFFFF",
            textSectionTitleColor: Colors.light.textSecondary,
            selectedDayBackgroundColor: Colors.light.tint,
            selectedDayTextColor: Colors.light.tint,
            todayTextColor: Colors.light.tint,
            todayBackgroundColor: "transparent",
            dayTextColor: Colors.light.text,
            textDisabledColor: Colors.light.textTertiary,
            dotColor: Colors.light.tint,
            selectedDotColor: Colors.light.tint,
            arrowColor: Colors.light.tint,
            monthTextColor: Colors.light.text,
            indicatorColor: Colors.light.tint,
            textDayFontWeight: "400",
            textMonthFontWeight: "600",
            textDayHeaderFontWeight: "500",
            textDayFontSize: 15,
            textMonthFontSize: 17,
            textDayHeaderFontSize: 13,
          }}
          hideArrows={false}
          hideExtraDays={true}
          enableSwipeMonths={true}
          style={styles.calendar}
        />
      </View>

      {/* Day tasks modal */}
      <DayTasksModal
        visible={showDayTasks}
        dateString={selectedDate}
        onClose={handleDayTasksClose}
        onTaskToggle={loadTasks}
        onAddTask={handleAddTaskFromCalendar}
      />

      {/* Add task modal from calendar context */}
      <AddTaskModal
        visible={showAddTask}
        onClose={() => {
          setShowAddTask(false);
          setAddTaskPrefillDate(undefined);
        }}
        onSave={handleModalSave}
        preselectedDueDate={addTaskPrefillDate}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.light.text,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  calendarWrapper: {
    marginHorizontal: 8,
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: "hidden",
    minHeight: 360,
  },
  calendar: {
    borderRadius: 16,
    minHeight: 360,
  },
});

export default CalendarScreen;
