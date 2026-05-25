import { taskStorage } from "@/services/storageService";
import { syncOrchestrator } from "@/services/SyncOrchestrator";
import { Task } from "@/types";
import { isDueThisWeek, isDueToday, isOverdue } from "@/utils/dateUtils";
import { generateId } from "@/utils/ids";
import { normalizeTask } from "@/utils/normalizeTask";

// Task service with sync support
export const taskService = {
  // Get all tasks
  async getTasks(): Promise<Task[]> {
    return await taskStorage.getTasks();
  },

  // Get tasks by filter
  async getTasksByFilter(
    filter: "all" | "pending" | "completed",
  ): Promise<Task[]> {
    const tasks = await this.getTasks();
    switch (filter) {
      case "pending":
        return tasks.filter((t) => !t.completed);
      case "completed":
        return tasks.filter((t) => t.completed);
      default:
        return tasks;
    }
  },

  // Create new task
  async createTask(
    text: string,
    options?: {
      groupId?: string;
      reminder?: boolean;
      reminderAt?: number;
      priority?: "low" | "medium" | "high";
      dueDate?: number;
    },
  ): Promise<Task> {
    const newTask = normalizeTask({
      id: generateId(),
      text,
      completed: false,
      groupId: options?.groupId,
      reminder: options?.reminder ?? !!options?.reminderAt,
      reminderAt: options?.reminderAt,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      priority: options?.priority,
      dueDate: options?.dueDate,
      syncStatus: "local",
    });

    await syncOrchestrator.addTask(newTask);
    // Schedule reminder if set
    if (newTask.reminder && newTask.reminderAt) {
      try {
        const { notificationService } =
          await import("@/services/notificationService");
        await notificationService.scheduleReminder(
          newTask.id,
          newTask.reminderAt,
          newTask.text,
        );
      } catch (e) {
        console.error("Failed to schedule reminder:", e);
      }
    }
    return newTask;
  },

  // Toggle task completion
  async toggleTask(taskId: string): Promise<Task | null> {
    const tasks = await this.getTasks();
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      const updatedTask: Task = {
        ...task,
        completed: !task.completed,
        updatedAt: Date.now(),
      };
      await syncOrchestrator.updateTask(updatedTask);
      // Cancel reminder if marking completed
      if (updatedTask.completed && updatedTask.reminder) {
        try {
          const { notificationService } =
            await import("@/services/notificationService");
          await notificationService.cancelReminder(updatedTask.id);
        } catch (e) {
          console.error("Failed to cancel reminder:", e);
        }
      }
      return updatedTask;
    }
    return null;
  },

  // Update task
  async updateTask(
    taskId: string,
    updates: Partial<Omit<Task, "id" | "createdAt" | "updatedAt">>,
  ): Promise<Task | null> {
    const tasks = await this.getTasks();
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      const updatedTask = normalizeTask({
        ...task,
        ...updates,
        updatedAt: Date.now(),
      });
      await syncOrchestrator.updateTask(updatedTask);

      const reminderChanged =
        task.reminder !== updatedTask.reminder ||
        task.reminderAt !== updatedTask.reminderAt ||
        task.text !== updatedTask.text;

      if (reminderChanged) {
        try {
          const { notificationService } =
            await import("@/services/notificationService");

          // Clear previous reminder whenever reminder settings changed
          await notificationService.cancelReminder(task.id);

          // Re-schedule only if updated task still has an active reminder
          if (
            updatedTask.reminder &&
            updatedTask.reminderAt &&
            !updatedTask.completed
          ) {
            await notificationService.scheduleReminder(
              updatedTask.id,
              updatedTask.reminderAt,
              updatedTask.text,
            );
          }
        } catch (e) {
          console.error("Failed to reconcile reminder after task update:", e);
        }
      }

      return updatedTask;
    }
    return null;
  },

  // Delete task
  async deleteTask(taskId: string): Promise<void> {
    // Cancel scheduled reminder if any
    try {
      const { notificationService } =
        await import("@/services/notificationService");
      await notificationService.cancelReminder(taskId);
      await notificationService.deleteNotificationsForTask(taskId);
    } catch (e) {
      // ignore
    }
    await syncOrchestrator.deleteTask(taskId);
  },

  // Delete multiple tasks (batch)
  async deleteTasks(taskIds: string[]): Promise<void> {
    // Cancel scheduled reminders if any
    try {
      const { notificationService } =
        await import("@/services/notificationService");
      await Promise.allSettled(
        taskIds.flatMap((id) => [
          notificationService.cancelReminder(id),
          notificationService.deleteNotificationsForTask(id),
        ]),
      );
    } catch (e) {
      // ignore
    }
    await syncOrchestrator.deleteTasks(taskIds);
  },

  // Delete completed tasks — uses batch delete to avoid overwriting remote
  async deleteCompletedTasks(): Promise<void> {
    const tasks = await this.getTasks();
    const completedTaskIds = tasks.filter((t) => t.completed).map((t) => t.id);
    if (completedTaskIds.length > 0) {
      await syncOrchestrator.deleteTasks(completedTaskIds);
    }
  },

  // Get task by ID
  async getTaskById(taskId: string): Promise<Task | null> {
    const tasks = await this.getTasks();
    return tasks.find((t) => t.id === taskId) || null;
  },

  // Get tasks due today
  async getTasksDueToday(): Promise<Task[]> {
    const tasks = await this.getTasks();
    return tasks.filter((t) => isDueToday(t.dueDate));
  },

  // Get overdue tasks
  async getOverdueTasks(): Promise<Task[]> {
    const tasks = await this.getTasks();
    return tasks.filter((t) => isOverdue(t.dueDate, t.completed));
  },

  // Get tasks due this week (including today)
  async getTasksDueThisWeek(): Promise<Task[]> {
    const tasks = await this.getTasks();
    return tasks.filter((t) => isDueThisWeek(t.dueDate));
  },

  // Get pending tasks count
  async getPendingCount(): Promise<number> {
    const tasks = await this.getTasks();
    return tasks.filter((t) => !t.completed).length;
  },

  // Get completed tasks count
  async getCompletedCount(): Promise<number> {
    const tasks = await this.getTasks();
    return tasks.filter((t) => t.completed).length;
  },

  // Clear all tasks
  async clearAllTasks(): Promise<void> {
    await syncOrchestrator.saveTasks([]);
  },
};

export default taskService;
