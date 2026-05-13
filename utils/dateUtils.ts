/**
 * Calendar and Due Date utility functions.
 * All timestamp operations are normalized to start-of-day (midnight local time)
 * to prevent timezone drift and incorrect overdue comparisons.
 */

/**
 * Returns the start-of-day timestamp (midnight) for a given Date.
 * Normalizes hours, minutes, seconds, ms to 0.
 */
export const getStartOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Returns the start-of-day timestamp in milliseconds for "today" in local time.
 */
export const getStartOfTodayMs = (): number => {
  return getStartOfDay(new Date()).getTime();
};

/**
 * Returns a Date set to start-of-day for "today" in local time.
 */
export const getStartOfToday = (): Date => {
  return getStartOfDay(new Date());
};

/**
 * Returns start-of-day for a given timestamp.
 * If timestamp is undefined, returns undefined (safe for tasks without dueDate).
 */
export const normalizeToDay = (timestamp?: number): number | undefined => {
  if (timestamp === undefined || timestamp === null) return undefined;
  return getStartOfDay(new Date(timestamp)).getTime();
};

/**
 * Checks if a task is overdue.
 * Overdue = task has a dueDate AND is NOT completed AND dueDate is before start of today.
 */
export const isOverdue = (dueDate?: number, completed?: boolean): boolean => {
  if (dueDate === undefined || dueDate === null) return false;
  if (completed) return false;
  return dueDate < getStartOfTodayMs();
};

/**
 * Checks if a task's dueDate falls on "today".
 */
export const isDueToday = (dueDate?: number): boolean => {
  if (dueDate === undefined || dueDate === null) return false;
  return dueDate === getStartOfTodayMs();
};

/**
 * Checks if a task's dueDate falls within the next 7 days (inclusive of today).
 * "This week" from today through 6 days from now.
 */
export const isDueThisWeek = (dueDate?: number): boolean => {
  if (dueDate === undefined || dueDate === null) return false;
  const today = getStartOfTodayMs();
  const endOfWeek = today + 7 * 24 * 60 * 60 * 1000; // 7 days from start of today
  return dueDate >= today && dueDate < endOfWeek;
};

/**
 * Formats a due-date timestamp into a human-readable label.
 * Returns: "Overdue!", "Today", "Tomorrow", or "Mon, May 15"
 * If timestamp is undefined, returns empty string.
 */
export const formatDueLabel = (dueDate?: number): string => {
  if (dueDate === undefined || dueDate === null) return "";

  const today = getStartOfTodayMs();
  const diff = dueDate - today;
  const daysDiff = Math.round(diff / (24 * 60 * 60 * 1000));

  if (daysDiff < 0) return "Overdue!";
  if (daysDiff === 0) return "Today";
  if (daysDiff === 1) return "Tomorrow";

  const date = new Date(dueDate);
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

/**
 * Returns a short day-month label for a timestamp.
 * Example: "May 15"
 */
export const formatShortDate = (dueDate?: number): string => {
  if (dueDate === undefined || dueDate === null) return "";
  return new Date(dueDate).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
};

/**
 * Converts a millisecond timestamp to "YYYY-MM-DD" format
 * required by react-native-calendars.
 * Returns undefined if timestamp is missing.
 */
export const toCalendarDateString = (
  timestamp?: number,
): string | undefined => {
  if (timestamp === undefined || timestamp === null) return undefined;
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Creates a Date from a "YYYY-MM-DD" calendar string, normalized to start-of-day.
 */
export const fromCalendarDateString = (dateString: string): Date => {
  const [year, month, day] = dateString.split("-").map(Number);
  return getStartOfDay(new Date(year, month - 1, day));
};

/**
 * Returns the "YYYY-MM-DD" string for today.
 */
export const getTodayCalendarString = (): string => {
  return toCalendarDateString(getStartOfTodayMs())!;
};
