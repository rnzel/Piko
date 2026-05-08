import { taskStorage } from "@/services/storageService";
import { syncOrchestrator } from "@/services/SyncOrchestrator";
import { Task } from "@/types";
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
    } catch (e) {
      // ignore
    }
    await syncOrchestrator.deleteTask(taskId);
  },

  // Delete completed tasks
  async deleteCompletedTasks(): Promise<void> {
    const tasks = await this.getTasks();
    const pendingTasks = tasks.filter((t) => !t.completed);
    await syncOrchestrator.saveTasks(pendingTasks);
  },

  // Get task by ID
  async getTaskById(taskId: string): Promise<Task | null> {
    const tasks = await this.getTasks();
    return tasks.find((t) => t.id === taskId) || null;
  },

  // Get tasks by group
  async getTasksByGroup(groupId: string): Promise<Task[]> {
    const tasks = await this.getTasks();
    return tasks.filter((t) => t.groupId === groupId);
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
