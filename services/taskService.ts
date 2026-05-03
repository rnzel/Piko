import { taskStorage } from "@/services/storageService";
import { Task } from "@/types";

// Generate unique ID
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Task service for local storage (guest mode)
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
    options?: { groupId?: string; reminder?: boolean },
  ): Promise<Task> {
    const newTask: Task = {
      id: generateId(),
      text,
      completed: false,
      groupId: options?.groupId,
      reminder: options?.reminder,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await taskStorage.addTask(newTask);
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
      await taskStorage.updateTask(updatedTask);
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
      const updatedTask: Task = {
        ...task,
        ...updates,
        updatedAt: Date.now(),
      };
      await taskStorage.updateTask(updatedTask);
      return updatedTask;
    }
    return null;
  },

  // Delete task
  async deleteTask(taskId: string): Promise<void> {
    await taskStorage.deleteTask(taskId);
  },

  // Delete completed tasks
  async deleteCompletedTasks(): Promise<void> {
    const tasks = await this.getTasks();
    const pendingTasks = tasks.filter((t) => !t.completed);
    await taskStorage.saveTasks(pendingTasks);
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
    await taskStorage.clearTasks();
  },
};

export default taskService;
